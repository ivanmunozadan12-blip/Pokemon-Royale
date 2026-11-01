/**
 * Sala privada de 2 jugadores a través del servidor propio (WebSocket, ver /server/server.mjs, preparado para Render).
 * Mantiene la misma interfaz que usaba el antiguo P2P (create/join/send/onMessage/onStatus/connected/history),
 * de modo que el chat, las invitaciones y el lockstep de la batalla no cambian. El servidor solo empareja y retransmite.
 */
import { CONFIG } from "../config.js";

const STORE_KEY = 'pokeroyale.serverUrl';
const ERRORS = {
    'sala-no-existe': 'Esa sala no existe o ya se cerró. Comprueba el código.',
    'sala-llena': 'La sala ya tiene dos jugadores.',
    'servidor-lleno': 'El servidor está lleno. Inténtalo en unos minutos.',
    'ya-en-sala': 'Ya estás en una sala.',
};
/** Tiempos de conexión pensados para Render: el plan gratuito "duerme" el servicio tras 15 min sin uso y tarda hasta ~1 min en despertar. */
const CONNECT_TOTAL_MS = 75000;
const CONNECT_ATTEMPT_MS = 20000;
const CONNECT_RETRY_MS = 2000;
const KEEPALIVE_MS = 25000;
/**
 * Normaliza lo que el jugador escriba: "mi-servidor.onrender.com", "https://mi-servidor.onrender.com/" o "wss://…"
 * se convierten en "wss://mi-servidor.onrender.com". En local ("localhost") se usa ws://.
 */
export function normalizeServerUrl(raw) {
    let u = String(raw ?? '').trim();
    if (!u)
        return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u))
        u = `${/^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(u) ? 'ws' : 'wss'}://${u}`;
    u = u.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
    return u.replace(/\/+$/, '');
}
/** URL del servidor: la que el jugador guardó en Equipo o, si no, la de config.js. Solo se admite ws:// o wss://. */
export function getServerUrl() {
    let v = '';
    try { v = localStorage.getItem(STORE_KEY) ?? ''; } catch { /* sin almacenamiento */ }
    return normalizeServerUrl(v || CONFIG.multiplayer?.serverUrl || '');
}
export function setServerUrl(url) {
    const u = normalizeServerUrl(url);
    if (u && !isValidServerUrl(u))
        return false;
    try { if (u) localStorage.setItem(STORE_KEY, u); else localStorage.removeItem(STORE_KEY); } catch { /* sin almacenamiento */ }
    return true;
}
/** Despierta el servicio de Render con una petición HTTP normal (no espera respuesta ni da error si falla). */
function wakeServer(wsUrl) {
    try {
        const x = new URL(wsUrl);
        x.protocol = x.protocol === 'wss:' ? 'https:' : 'http:';
        x.pathname = '/healthz';
        x.search = '';
        void fetch(x.toString(), { mode: 'no-cors', cache: 'no-store' }).catch(() => { });
    }
    catch { /* URL no válida: ya se informa en open() */ }
}
export function isValidServerUrl(u) {
    try {
        const x = new URL(u);
        if (x.protocol === 'wss:')
            return true;
        // ws:// sin cifrar solo se permite en local (en una página https el navegador lo bloquea igualmente).
        return x.protocol === 'ws:' && ['localhost', '127.0.0.1', '[::1]'].includes(x.hostname);
    }
    catch {
        return false;
    }
}
export class PeerRoom {
    history = [];
    pendingInvite = null;
    static active = null;
    ws = null;
    keepalive = 0;
    gen = 0;
    code = '';
    handlers = new Set();
    statusHandlers = new Set();
    host = false;
    connected = false;
    inRoom = false;
    get isHost() { return this.host; }
    /** Compatibilidad con la interfaz anterior: `room.conn?.open === true` significa "rival conectado". */
    get conn() { return this.ws && this.connected ? { open: true } : null; }
    get peer() { return this.inRoom ? this.ws : null; }
    static current() { return PeerRoom.active?.inRoom ? PeerRoom.active : null; }
    onMessage(fn) { this.handlers.add(fn); return () => this.handlers.delete(fn); }
    onStatus(fn) { this.statusHandlers.add(fn); return () => this.statusHandlers.delete(fn); }
    status(s) { for (const fn of this.statusHandlers)
        fn(s); }
    emit(m) {
        if (m.type === 'chat' && typeof m.text === 'string')
            this.history.push({ name: String(m.name ?? 'Amigo').slice(0, 24), text: m.text.slice(0, 500), at: String(m.at ?? ''), mine: false });
        if (m.type === 'match-invite')
            this.pendingInvite = m;
        if (m.type === 'match-start')
            this.pendingInvite = null;
        for (const fn of this.handlers)
            fn(m);
    }
    /**
     * Abre el WebSocket y espera a la primera respuesta del servidor a `first`.
     * Si el servidor de Render estaba dormido (plan gratuito), reintenta durante ~75 s mientras despierta.
     * Los rechazos del servidor (sala inexistente, llena…) no se reintentan.
     */
    open(first, expect) {
        const url = getServerUrl();
        if (!url)
            return Promise.reject(new Error('Falta la dirección del servidor. Escríbela en "Servidor" (Equipo) o en config.js.'));
        if (!isValidServerUrl(url))
            return Promise.reject(new Error('La dirección del servidor debe empezar por wss:// (o ws://localhost para pruebas).'));
        if (PeerRoom.active && PeerRoom.active !== this)
            PeerRoom.active.close();
        this.close();
        wakeServer(url);
        const gen = this.gen; // si el jugador cierra la sala mientras conecta, los reintentos se cancelan
        const deadline = Date.now() + CONNECT_TOTAL_MS;
        return new Promise((resolve, reject) => {
            let finished = false;
            let attemptTimer = 0;
            let retryTimer = 0;
            let current = null;
            const done = (fn, v) => { if (finished) return; finished = true; clearTimeout(attemptTimer); clearTimeout(retryTimer); fn(v); };
            const giveUp = (msg) => { const s = current; current = null; try { s?.close(); } catch { /* ya cerrado */ } if (s && this.ws === s) this.ws = null; done(reject, new Error(msg)); };
            const attempt = () => {
                if (finished) return;
                if (gen !== this.gen) return done(reject, new Error('Conexión cancelada.'));
                let sock;
                try { sock = new WebSocket(url); } catch { return giveUp('No se pudo abrir la conexión con el servidor.'); }
                current = sock;
                this.ws = sock;
                let over = false; // este intento ya terminó (bien, mal o rechazado)
                let ok = false;
                const retry = () => {
                    if (over || finished) return;
                    over = true;
                    if (gen !== this.gen) return done(reject, new Error('Conexión cancelada.'));
                    clearTimeout(attemptTimer);
                    try { sock.close(); } catch { /* ya cerrado */ }
                    if (this.ws === sock) this.ws = null;
                    if (Date.now() + CONNECT_RETRY_MS + 1500 >= deadline) return giveUp('El servidor no responde. Si usas el plan gratuito de Render puede tardar un minuto en despertar: inténtalo de nuevo en unos segundos.');
                    this.status('Despertando el servidor (Render)… puede tardar hasta un minuto.');
                    retryTimer = setTimeout(attempt, CONNECT_RETRY_MS);
                };
                attemptTimer = setTimeout(retry, CONNECT_ATTEMPT_MS);
                sock.onopen = () => { try { sock.send(JSON.stringify(first)); } catch { retry(); } };
                sock.onerror = () => retry();
                sock.onclose = () => {
                    if (!ok) return retry();
                    if (this.ws === sock) { this.stopKeepalive(); this.connected = false; this.inRoom = false; this.status('Conexión con el servidor cerrada.'); this.emit({ type: 'net-closed' }); }
                };
                sock.onmessage = (ev) => {
                    let m;
                    try { m = JSON.parse(ev.data); } catch { return; }
                    if (!m || typeof m.op !== 'string')
                        return;
                    if (m.op === 'error' && !ok) {
                        over = true;
                        clearTimeout(attemptTimer);
                        try { sock.close(); } catch { /* ya cerrado */ }
                        if (this.ws === sock) this.ws = null;
                        return done(reject, new Error(ERRORS[m.reason] ?? 'El servidor rechazó la petición.'));
                    }
                    if (m.op === expect && !ok && !finished) {
                        ok = true;
                        over = true;
                        clearTimeout(attemptTimer);
                        this.startKeepalive(sock);
                        return done(resolve, m);
                    }
                    if (ok)
                        this.onServer(m);
                };
            };
            attempt();
        });
    }
    /** Latido del cliente: mantiene activo el servicio de Render (el plan gratuito se duerme tras 15 min sin tráfico entrante). */
    startKeepalive(sock) {
        this.stopKeepalive();
        this.keepalive = setInterval(() => { try { if (sock.readyState === 1) sock.send('{"op":"ping"}'); } catch { /* conexión caída */ } }, KEEPALIVE_MS);
    }
    stopKeepalive() {
        if (this.keepalive) { clearInterval(this.keepalive); this.keepalive = 0; }
    }
    onServer(m) {
        if (m.op === 'peer') {
            this.connected = m.state === 'joined';
            this.status(this.connected ? 'Amigo conectado.' : 'Tu amigo ha salido de la sala.');
            if (!this.connected)
                this.emit({ type: 'net-peer-left' });
        }
        else if (m.op === 'msg' && m.d && typeof m.d === 'object' && typeof m.d.type === 'string')
            this.emit(m.d);
    }
    async create() {
        this.host = true;
        const r = await this.open({ op: 'create' }, 'created');
        this.code = String(r.code);
        this.inRoom = true;
        PeerRoom.active = this;
        this.status('Sala creada. Esperando al amigo…');
        return this.code;
    }
    async join(remoteCode) {
        const code = String(remoteCode ?? '').trim().toUpperCase();
        if (!/^[A-Z0-9]{4,8}$/.test(code))
            throw new Error('Introduce el código de la sala (5 letras o números).');
        this.host = false;
        await this.open({ op: 'join', code }, 'joined');
        this.code = code;
        this.inRoom = true;
        this.connected = true;
        PeerRoom.active = this;
        this.status('Conectado a la sala privada.');
    }
    send(message) {
        if (!this.ws || !this.connected || this.ws.readyState !== 1)
            return false;
        try {
            this.ws.send(JSON.stringify({ op: 'msg', d: message }));
            if (message.type === 'chat' && typeof message.text === 'string')
                this.history.push({ name: String(message.name ?? 'Entrenador'), text: message.text.slice(0, 500), at: String(message.at ?? ''), mine: true });
            return true;
        }
        catch {
            return false;
        }
    }
    close() {
        this.gen++;
        this.stopKeepalive();
        const ws = this.ws;
        this.ws = null;
        this.connected = false;
        this.inRoom = false;
        this.code = '';
        try { ws?.close(); } catch { /* ya cerrado */ }
        if (PeerRoom.active === this)
            PeerRoom.active = null;
    }
}
