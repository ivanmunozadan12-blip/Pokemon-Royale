/**
 * Sincronización "lockstep" determinista para partidas privadas de 2 jugadores.
 *
 * Idea: las dos consolas ejecutan EXACTAMENTE la misma simulación (misma semilla, mismos mazos, mismos niveles) y solo se
 * intercambian las órdenes de los jugadores (desplegar, especial, rendirse). Para que ambas simulaciones den el mismo
 * resultado, cada orden se ejecuta en un "tick" concreto (1 tick = 1/30 s) que conocen los dos, y ningún cliente avanza
 * un tick hasta saber que el rival no tiene más órdenes para ese tick:
 *
 *   · Cada cliente promete "no tendré más órdenes hasta el tick U" (`upto`) y lo envía junto con sus órdenes.
 *   · Una orden hecha en el tick c se programa para el tick c + D (D = retardo de entrada, 3-12 ticks = 0,1-0,4 s),
 *     que se calcula a partir del ping medido para que casi nunca haga falta esperar.
 *   · Si la red se atrasa, los dos relojes se paran a la vez (nunca divergen); al volver, se recupera el tiempo perdido.
 *
 * Como el reloj de la partida (temporizador, energía, fases finales, muerte súbita…) sale de los ticks simulados, ambas
 * pantallas muestran siempre el mismo tiempo, las mismas unidades y el mismo daño en torres.
 */
export const STEP = 1 / 30;
const MIN_DELAY = 1;
const MAX_DELAY = 6;
const START_DELAY = 1;

export class Lockstep {
    constructor(room, localTeam) {
        this.room = room;
        this.localTeam = localTeam === 1 ? 1 : 0;
        /** Retardo de entrada actual (ticks). */
        this.delay = START_DELAY;
        /** Último tick hasta el que hemos prometido no enviar más órdenes. */
        this.sentUpto = START_DELAY;
        /** Último tick hasta el que el rival ha prometido no enviar más órdenes. Los primeros ticks no necesitan mensajes. */
        this.remoteUpto = START_DELAY;
        /** tick -> órdenes (de ambos equipos) pendientes de ejecutar. */
        this.actions = new Map();
        this.seq = 0;
        this.rtt = 0;
        this.rttAvg = 0;
        this.jitter = 0;
        this.pings = 0;
        this.lastRx = performance.now();
        this.lastPingAt = 0;
        this.stalledMs = 0;
        this.disposed = false;
        this.unsub = room.onMessage((m) => this.onMessage(m));
    }
    dispose() {
        this.disposed = true;
        this.unsub?.();
        this.unsub = null;
    }
    /** ¿Se puede simular el tick `tick`? Solo si el rival ya prometió no tener órdenes pendientes para él. */
    ready(tick) {
        return this.remoteUpto >= tick;
    }
    /** Órdenes que deben ejecutarse al empezar `tick`, ya ordenadas igual en los dos clientes. */
    take(tick) {
        const list = this.actions.get(tick);
        if (!list)
            return [];
        this.actions.delete(tick);
        return list.sort((a, b) => a.team - b.team || a.seq - b.seq);
    }
    /** Programa una orden local para dentro de `delay` ticks y la envía al instante. Devuelve el tick de ejecución. */
    schedule(curTick, action) {
        const tick = Math.max(curTick + this.delay, this.sentUpto + 1);
        const msg = { ...action, t: tick, team: this.localTeam, seq: ++this.seq };
        this.store(msg);
        this.sentUpto = tick;
        this.room.send({ type: 'ls', a: [msg], upto: tick });
        return tick;
    }
    /** Llamar tras cada tick simulado: renueva la promesa "no habrá más órdenes hasta c + D" para que el rival no espere. */
    afterTick(curTick) {
        const upto = curTick + this.delay;
        // Se envía cada 2 ticks, pero SIEMPRE que la promesa vigente esté a punto de agotarse para el rival (si no, los dos
        // relojes se bloquean mutuamente: error detectado en v1.4.7, la partida se quedaba parada en el tick 1).
        const need = upto - this.sentUpto;
        if (need >= 2 || (need >= 1 && this.sentUpto <= curTick + 1)) {
            this.sentUpto = upto;
            this.room.send({ type: 'ls', upto });
        }
        const now = performance.now();
        if (now - this.lastPingAt > 1000) {
            this.lastPingAt = now;
            this.room.send({ type: 'ls-ping', at: now });
        }
    }
    /** Reenvía la promesa vigente si el reloj lleva parado esperando al rival (también recupera mensajes perdidos). */
    pump(curTick) {
        const upto = curTick + this.delay;
        if (upto > this.sentUpto)
            this.sentUpto = upto;
        this.room.send({ type: 'ls', upto: this.sentUpto });
    }
    store(msg) {
        const list = this.actions.get(msg.t) ?? [];
        list.push(msg);
        this.actions.set(msg.t, list);
    }
    onMessage(m) {
        if (this.disposed)
            return;
        if (m.type === 'ls') {
            this.lastRx = performance.now();
            if (Array.isArray(m.a)) {
                for (const a of m.a) {
                    const t = Number(a.t);
                    if (!Number.isInteger(t) || t < 1 || t > 1e8)
                        continue;
                    this.store({ ...a, t, team: this.localTeam === 1 ? 0 : 1, seq: Number(a.seq) || 0 });
                }
            }
            const upto = Number(m.upto);
            if (Number.isFinite(upto) && upto > this.remoteUpto)
                this.remoteUpto = upto;
        }
        else if (m.type === 'ls-ping') {
            this.room.send({ type: 'ls-pong', at: m.at });
        }
        else if (m.type === 'ls-pong') {
            this.lastRx = performance.now();
            const rtt = performance.now() - Number(m.at);
            if (!(rtt >= 0 && rtt < 10000))
                return;
            this.rtt = rtt;
            this.pings++;
            this.jitter = this.pings === 1 ? 0 : this.jitter * 0.8 + Math.abs(rtt - this.rttAvg) * 0.2;
            this.rttAvg = this.pings === 1 ? rtt : this.rttAvg * 0.8 + rtt * 0.2;
            // retardo = ida (RTT/2) + margen por variación de red, en ticks, +1 de seguridad
            const oneWay = this.rttAvg / 2 + this.jitter * 1.5;
            const want = Math.ceil(oneWay / (STEP * 1000)) + 1;
            this.delay = Math.max(MIN_DELAY, Math.min(MAX_DELAY, want));
        }
    }
    /** Mensaje de estado de la red para el indicador de la partida. */
    get quality() {
        const ms = Math.round(this.rttAvg);
        return { ms, level: this.pings === 0 ? 'unknown' : ms < 90 ? 'good' : ms < 200 ? 'ok' : 'bad' };
    }
    get silentMs() {
        return performance.now() - this.lastRx;
    }
}
