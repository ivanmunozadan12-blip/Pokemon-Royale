import { CONFIG } from "../config.js";
import { getSpecies } from "../data/species.js";
import { typeMult } from "../data/types.js";
import { Rng } from "./rng.js";
import { ITEM_BY_ID } from "../data/items.js";
const F = CONFIG.field;
export const AI_STYLES = ['agresiva', 'defensiva', 'ciclo'];
export const AI_STYLE_INFO = {
    agresiva: { name: 'Agresiva', desc: 'ataca sin parar con cartas fuertes y casi no se guarda energía.' },
    defensiva: { name: 'Defensiva', desc: 'espera tu ataque, contraataca y presiona cuando tiene energía de sobra.' },
    ciclo: { name: 'Ciclo rápido', desc: 'despliega cartas baratas muy rápido para presionar sin descanso.' },
};
const STYLE = {
    base: { think: 1, reserve: 0, threat: 0, attackAt: 0, prefer: 'default', field: 0, back: 0 },
    agresiva: { think: 0.8, reserve: -1, threat: 1.6, attackAt: 0, prefer: 'power', field: 3, back: 0 },
    defensiva: { think: 1.05, reserve: 1.5, threat: -1.0, attackAt: 7.5, prefer: 'default', field: -2, back: 1.2 },
    ciclo: { think: 0.6, reserve: -1, threat: 0.4, attackAt: 0, prefer: 'cheap', field: 2, back: 0 },
};
function laneOf(x) {
    return x < F.centerX ? 0 : 1;
}
export class AiPlayer {
    team;
    difficulty;
    style;
    sp;
    rng;
    p;
    thinkT;
    specialT = 0.5;
    /** Historial para pruebas y para el informe de depuración. */
    log = [];
    deployed = 0;
    adaptive = { lane: [0,0], types: {}, samples: 0 };
    memory = null;
    battle;
    constructor(battle, team, difficulty, seed, style = null, memory = null) {
        this.battle = battle;
        this.team = team;
        this.difficulty = difficulty;
        this.rng = new Rng(seed ^ 0xa11ce);
        this.p = CONFIG.ai[difficulty];
        this.style = style;
        this.memory = memory && typeof memory === 'object' ? memory : null;
        if (this.memory) this.memory.games = Math.min(1e6, (this.memory.games ?? 0) + 1);
        this.adaptive.lane = Array.isArray(this.memory?.lanes) ? this.memory.lanes.slice(0,2) : [0,0];
        this.adaptive.types = this.memory?.types && typeof this.memory.types === 'object' ? {...this.memory.types} : {};
        this.sp = STYLE[style ?? 'base'];
        this.equipItem(seed);
        this.thinkT = this.rng.range(this.p.thinkMin * 0.6, this.p.thinkMax * 0.8) * this.sp.think;
    }
    /** Elige un objeto legítimo (del catálogo real) para la especie más potente del mazo; solo si el jugador de esa IA no trae uno. */
    equipItem(seed) {
        const b = this.battle;
        if (b.noItems || b.itemLoadouts[this.team] || !this.p.itemRarities?.length)
            return;
        const f = (b.towerLevel - 1) / Math.max(1, CONFIG.towerLevels.max - 1);
        const chance = byLevel(this.p.itemChance, 3 + 6 * f);
        const r = new Rng(seed ^ 0x17e3);
        if (r.next() >= chance)
            return;
        const deck = b.hands[this.team].deck.map((id) => getSpecies(id));
        const ranked = deck.slice().sort((a, c) => c.hp * c.dps - a.hp * a.dps);
        const TYPE_ITEM = { dragon: 'dragon_fang', fuego: 'charcoal', agua: 'mystic_water', electrico: 'magnet', bicho: 'silver_powder', tierra: 'soft_sand', hielo: 'never_melt_ice', lucha: 'black_belt', fantasma: 'spell_tag', psiquico: 'twisted_spoon' };
        const ok = (id) => ITEM_BY_ID.has(id) && this.p.itemRarities.includes(ITEM_BY_ID.get(id).rarity);
        for (const sp of ranked.slice(0, 3)) {
            const cands = [];
            if (TYPE_ITEM[sp.attackType] && ok(TYPE_ITEM[sp.attackType]))
                cands.push(TYPE_ITEM[sp.attackType]);
            const phys = sp.damageKind === 'fisico';
            for (const id of phys ? ['choice_band', 'life_orb', 'muscle_band'] : ['choice_specs', 'life_orb', 'wise_glasses'])
                if (ok(id))
                    cands.push(id);
            for (const id of ['focus_sash', 'sitrus_berry'])
                if (ok(id))
                    cands.push(id);
            if (cands.length) {
                b.itemLoadouts[this.team] = { itemId: cands[0], pokemonId: sp.id };
                this.item = b.itemLoadouts[this.team];
                return;
            }
        }
    }
    /** Se llama una vez por paso de simulación con el mismo `dt` fijo que la batalla. */
    update(dt) {
        const b = this.battle;
        if (b.ended)
            return;
        this.specialT -= dt;
        if (this.specialT <= 0) {
            this.specialT = 0.45;
            this.trySpecials();
        }
        this.thinkT -= dt;
        if (this.thinkT > 0)
            return;
        this.thinkT = this.rng.range(this.p.thinkMin, this.p.thinkMax) * this.sp.think;
        this.think();
    }
    /* ───────── análisis del campo ───────── */
    threats() {
        const lane = [0, 0];
        const top = [null, null];
        let air = false;
        const topVal = [0, 0];
        for (const e of this.battle.units) {
            if (e.team === this.team || e.state === 'dead' || e.dummy)
                continue;
            // el rival aún en su campo pesa poco; al cruzar el río y acercarse a mis torres, mucho
            const mine = this.team === 1 ? e.y < F.riverY1 + 0.5 : e.y > F.riverY0 - 0.5;
            const depth = this.team === 1 ? (F.h / 2 - e.y) / (F.h / 2) : (e.y - F.h / 2) / (F.h / 2);
            const w = e.sp.cost * (mine ? 1 + Math.max(0, depth) * 1.2 : 0.25);
            const l = laneOf(e.x);
            lane[l] += w;
            if (w > topVal[l]) {
                topVal[l] = w;
                top[l] = e;
            }
            if (mine && e.sp.flying)
                air = true;
        }
        return { lane, top, total: lane[0] + lane[1], air };
    }
    myUnits() {
        return this.battle.units.filter((u) => u.team === this.team && u.state !== 'dead');
    }
    counterScore(card, threat) {
        if (!threat)
            return 0;
        const t = threat.sp;
        // Aprende patrones observables del jugador: carriles y tipos desplegados. No consulta mano ni mazo futuro.
        const observed = this.battle.units.filter(u => u.team === 0 && u.state !== 'dead');
        this.adaptive.lane = [0,0]; this.adaptive.types = {}; this.adaptive.samples = observed.length;
        for (const u of observed) {
            this.adaptive.lane[u.x < F.centerX ? 0 : 1]++;
            for (const ty of u.sp.types) this.adaptive.types[ty] = (this.adaptive.types[ty] || 0) + 1;
        }
        if (this.memory) {
            this.memory.lanes = this.adaptive.lane.map((v,i)=>Math.min(10000,Math.round((this.memory.lanes?.[i]??0)*.94+v*.06)));
            const merged={...(this.memory.types??{})};
            for(const [k,v] of Object.entries(this.adaptive.types)) merged[k]=Math.min(10000,Math.round((merged[k]??0)*.94+v*.06));
            this.memory.types=merged;
        }
        let s = typeMult(card.attackType, t.types) / typeMult(t.attackType, card.types);
        if (t.flying && card.targets === 'ground')
            s *= 0.1;
        if (!t.flying && card.targets === 'air')
            s *= 0.1;
        // eficiencia: responder con algo que cueste parecido (o menos) que la amenaza
        s *= 1 + Math.max(-0.4, (t.cost - card.cost) * 0.08);
        // una carta con poca vida frente a un luchador fuerte es mala respuesta
        s *= Math.min(1.3, 0.6 + (card.hp * card.dps) / Math.max(1, t.hp * t.dps));
        // Refuerza ligeramente los counters de tipos que el jugador está desplegando con frecuencia.
        const dominant = Object.entries(this.adaptive.types).sort((a,b)=>b[1]-a[1])[0]?.[0];
        if (dominant && t.types.includes(dominant)) s *= this.difficulty === 'dificil' ? 1.14 : this.difficulty === 'normal' ? 1.08 : 1.02;
        return s;
    }
    /* ───────── decisión principal ───────── */
    think() {
        const b = this.battle;
        const hand = b.hands[this.team].hand;
        const energy = b.energy[this.team];
        const th = this.threats();
        const myCount = this.myUnits().length;
        const affordable = hand.map((id, slot) => ({ id, slot, sp: getSpecies(id) })).filter((c) => b.canAfford(this.team, c.id));
        // evita acumulaciones enormes (la dificultad fácil es más conservadora)
        const maxField = (this.difficulty === 'facil' ? 5 : this.difficulty === 'normal' ? 9 : 12) + this.sp.field;
        if (myCount >= maxField && th.total < 4)
            return this.waited();
        if (affordable.length === 0)
            return this.waited();
        const mistake = this.rng.next() < this.p.mistake;
        const underThreat = th.total >= (this.difficulty === 'facil' ? 6 : 3.2) + this.sp.threat;
        const rich = energy >= this.p.maxEnergyHold;
        if (underThreat && !(mistake && this.difficulty === 'facil')) {
            return this.defend(affordable, th, mistake);
        }
        // sin amenaza: ahorrar o presionar
        const reserve = Math.max(0, this.p.reserve + this.sp.reserve);
        if (this.sp.attackAt > 0 && !rich && energy < this.sp.attackAt && this.timeLeftFrac() > 0.25 && !this.battle.overtime)
            return this.waited();
        const cheapest = Math.min(...affordable.map((c) => c.sp.cost));
        if (!rich && energy - cheapest < reserve && this.timeLeftFrac() > 0.15)
            return this.waited();
        // el nivel difícil espera a tener energía para una jugada con sentido, salvo energía casi llena
        if (this.difficulty === 'dificil' && !rich && energy < 5.5 && this.timeLeftFrac() > 0.2)
            return this.waited();
        if (this.difficulty === 'normal' && !rich && energy < 4 && this.timeLeftFrac() > 0.2)
            return this.waited();
        this.attack(affordable, th, mistake);
    }
    timeLeftFrac() {
        return this.battle.endless ? 1 : this.battle.timeLeft / this.battle.duration;
    }
    waited() {
        this.log.push({ t: this.battle.time, kind: 'espera' });
        if (this.log.length > 400)
            this.log.splice(0, 200);
    }
    defend(affordable, th, mistake) {
        const lane = th.lane[0] >= th.lane[1] ? 0 : 1;
        const threat = th.top[lane];
        let pool = affordable;
        // respuesta barata ante amenazas pequeñas: no malgastar una carta cara
        if (this.difficulty !== 'facil' && threat) {
            const cap = Math.max(2, threat.sp.cost + 1);
            const cheaper = affordable.filter((c) => c.sp.cost <= cap);
            if (cheaper.length)
                pool = cheaper;
        }
        let pick = pool[0];
        if (mistake)
            pick = this.rng.pick(pool);
        else if (this.rng.next() < this.p.counters) {
            let best = -Infinity;
            for (const c of pool) {
                const s = this.counterScore(c.sp, threat) + this.rng.next() * 0.05;
                if (s > best) {
                    best = s;
                    pick = c;
                }
            }
        }
        else
            pick = this.rng.pick(pool);
        // coloca detrás de sus torres, algo más adelantada si es cuerpo a cuerpo
        const bx = F.bridgeXs[lane];
        const x = clampX(bx + this.rng.range(-1.4, 1.4) + (threat ? (threat.x - bx) * 0.3 : 0));
        const back = this.sp.back;
        const base = this.team === 1 ? (pick.sp.ranged ? 8.2 : 10.4) - back : F.h - (pick.sp.ranged ? 8.2 : 10.4) + back;
        this.place(pick, x, base + this.rng.range(-0.8, 0.8), 'defensa', lane);
    }
    attack(affordable, th, mistake) {
        const mine = this.myUnits();
        const perLane = [0, 0];
        for (const u of mine)
            perLane[laneOf(u.x)]++;
        const enemy = this.team === 1 ? 0 : 1;
        // carril: prefiere el más débil del rival; con empate, el menos poblado por mí; usa los dos carriles
        const hpOf = (l) => this.battle.towerOf(enemy, l === 0 ? 'left' : 'right');
        const eL = hpOf(0), eR = hpOf(1);
        let lane;
        if (eL.destroyed !== eR.destroyed)
            lane = eL.destroyed ? 1 : 0; // el que aún tiene torre lateral viva
        else if (this.difficulty === 'dificil' && Math.abs(eL.hp - eR.hp) > 300)
            lane = eL.hp < eR.hp ? 0 : 1;
        else
            lane = perLane[0] === perLane[1] ? (this.rng.next() < 0.5 ? 0 : 1) : perLane[0] < perLane[1] ? 0 : 1;
        // evita cargar contra un carril con mucha amenaza enemiga
        if (!mistake && th.lane[lane] > th.lane[lane === 0 ? 1 : 0] + 2)
            lane = lane === 0 ? 1 : 0;
        let pool = affordable;
        if (this.difficulty === 'facil')
            pool = affordable.filter((c) => c.sp.cost <= 4).length ? affordable.filter((c) => c.sp.cost <= 4) : affordable;
        let pick;
        if (mistake)
            pick = this.rng.pick(affordable);
        else if (this.difficulty === 'dificil') {
            // mejor jugada: el tanque va delante y un atacante a distancia detrás si ya hay unidades en el carril
            const hasFront = mine.some((u) => laneOf(u.x) === lane && !u.sp.ranged);
            const cand = pool.filter((c) => (hasFront ? c.sp.ranged || c.sp.flying : !c.sp.ranged) || pool.length === 1);
            const list = cand.length ? cand : pool;
            pick = list.reduce((a, c) => (c.sp.cost * c.sp.dps > a.sp.cost * a.sp.dps ? c : a), list[0]);
        }
        else if (this.sp.prefer === 'power') {
            pick = pool.reduce((a, c) => (c.sp.cost * c.sp.dps > a.sp.cost * a.sp.dps ? c : a), pool[0]);
        }
        else if (this.sp.prefer === 'cheap') {
            const cheap = pool.filter((c) => c.sp.cost <= 3);
            pick = this.rng.pick(cheap.length ? cheap : pool);
        }
        else
            pick = this.rng.pick(pool);
        const bx = F.bridgeXs[lane];
        const ahead = mine.filter((u) => laneOf(u.x) === lane && !u.sp.ranged).sort((a, b) => (this.team === 1 ? b.y - a.y : a.y - b.y));
        // apoya detrás de una unidad que ya presiona; si no hay, coloca en la línea de despliegue
        let y;
        if (this.team === 1) {
            y = ahead.length && this.difficulty !== 'facil' ? Math.max(4, ahead[0].y - 1.5) : pick.sp.ranged ? 9.5 : 12.8;
            y = Math.min(y, pick.sp.ranged ? 11.5 : 13.6);
        }
        else {
            y = F.h - (ahead.length ? Math.max(4, F.h - (ahead[0].y + 1.5)) : pick.sp.ranged ? 9.5 : 12.8);
        }
        this.place(pick, clampX(bx + this.rng.range(-1.2, 1.2)), y, 'ataque', lane);
    }
    place(c, x, y, kind, lane) {
        const b = this.battle;
        // si el punto es inválido (junto a una torre, p. ej.), prueba unos desplazamientos deterministas
        const tries = [[0, 0], [1.4, 0.8], [-1.4, 0.8], [0, 1.6], [2.2, 0], [-2.2, 0], [0, -1.5]];
        for (const [dx, dy] of tries) {
            const px = clampX(x + dx);
            const py = this.team === 1 ? y + dy : y - dy;
            const r = b.deploy(this.team, c.slot, px, py);
            if (r.ok) {
                this.deployed++;
                this.log.push({ t: b.time, kind, slot: c.slot, speciesId: c.id, lane, x: px, y: py });
                if (this.log.length > 400)
                    this.log.splice(0, 200);
                return;
            }
            if (r.reason === 'energia' || r.reason === 'fin' || r.reason === 'limite')
                return;
        }
    }
    /* ───────── especiales ───────── */
    /** Valor esperado (en "elixir") de lanzar ahora el especial de `u`: daño útil, remates, control, curación y torres. */
    specialValue(u, def) {
        const b = this.battle;
        const D = u.sp.dps * def.power;
        const enemy = this.team === 0 ? 1 : 0;
        const hitsOk = (e) => def.hits === 'both' || (def.hits === 'air' ? e.sp.flying : !e.sp.flying);
        const dist = (e, r) => Math.hypot(e.x - cx, e.y - cy) - r;
        let cx = u.x, cy = u.y;
        let reach = def.radius;
        if (def.delivery !== 'aoe' && def.delivery !== 'heal') {
            const t = b.specialTarget(u, def);
            if (!t)
                return { v: 0, kill: 0 };
            cx = t.x;
            cy = t.y;
            reach = Math.max(def.radius || 0, 0.6);
        }
        const ctl = def.effects && Object.keys(def.effects).length > 0 ? 0.35 : 0;
        let v = 0, kill = 0;
        if (def.delivery === 'heal') {
            for (const a of b.units) {
                if (a.team !== this.team || a.state === 'dead' || dist(a, a.sp.radius) > reach)
                    continue;
                const miss = a.maxHp - a.hp;
                v += (Math.min(miss, D) / a.maxHp) * a.sp.cost;
            }
            return { v, kill: 0 };
        }
        for (const e of b.units) {
            if (e.team !== enemy || e.state === 'dead' || !hitsOk(e) || dist(e, e.sp.radius) > reach)
                continue;
            const dmg = D * typeMult(def.type, e.sp.types);
            const frac = Math.min(1, dmg / Math.max(1, e.hp));
            v += e.sp.cost * (frac + ctl * (e.sp.cost >= 4 ? 1 : 0.6));
            if (dmg >= e.hp) {
                v += e.sp.cost * 0.6;
                kill++;
            }
        }
        const sm = CONFIG.towers.specialMul ?? 0.8;
        for (const t of b.towers) {
            if (t.team !== enemy || t.destroyed || dist(t, t.radius) > reach)
                continue;
            const frac = Math.min(1, (D * sm) / Math.max(1, t.hp));
            v += 4 * frac + (t.hp <= D * sm ? 3 : 0) + (t.kind === 'king' ? 0.5 : 0);
        }
        return { v, kill };
    }
    /** Umbral de valor mínimo para lanzar un especial: depende de la dificultad y del nivel de torres. */
    specialThreshold() {
        const tl = this.battle.towerLevel;
        const f = (tl - 1) / Math.max(1, CONFIG.towerLevels.max - 1);
        const th = this.p.specialMin;
        return th * (1 + (this.p.specialTowerScale ?? 0) * f);
    }
    /** ¿Hay presión sobre mis torres? (enemigos cerca de ellas) */
    pressure() {
        const b = this.battle;
        let p = 0;
        for (const e of b.units) {
            if (e.team === this.team || e.state === 'dead')
                continue;
            for (const t of b.towers) {
                if (t.team !== this.team || t.destroyed)
                    continue;
                if (Math.hypot(e.x - t.x, e.y - t.y) < 7.5) {
                    p += e.sp.cost;
                    break;
                }
            }
        }
        return p;
    }
    trySpecials() {
        const b = this.battle;
        const thr = this.specialThreshold();
        const press = this.pressure();
        for (const u of this.myUnits()) {
            if (u.spCd > 0 || u.dummy) {
                this.readySince?.delete(u.id);
                continue;
            }
            if (this.rng.next() > this.p.useSpecial)
                continue;
            const chk = b.canCastSpecial(u);
            if (!chk.ok)
                continue;
            const def = u.sp.special.pool ? u.sp.special.pool[0] : u.sp.special;
            if (!this.readySince)
                this.readySince = new Map();
            if (!this.readySince.has(u.id))
                this.readySince.set(u.id, b.time);
            const waited = b.time - this.readySince.get(u.id);
            if (def.selfDestruct) {
                const near = b.units.filter((e) => e.team !== this.team && e.state !== 'dead' && Math.hypot(e.x - u.x, e.y - u.y) < def.radius + 0.8).length;
                const hurt = u.hp < u.maxHp * 0.5;
                if (near < 2 && !hurt)
                    continue;
            }
            const { v, kill } = this.specialValue(u, def);
            if (v <= 0)
                continue;
            // paciencia: si lleva tiempo listo sin objetivo ideal, acepta menos valor (no acapara eternamente)
            const patience = this.p.specialPatience ?? 0;
            const need = thr * (patience > 0 ? Math.max(0.45, 1 - waited / patience) : 1);
            // defensa de emergencia: si hay presión en mis torres, baja el listón
            const urgent = press >= (this.p.specialPressure ?? 99) ? 0.6 : 1;
            // remate seguro de una unidad: siempre merece la pena si el valor es razonable
            const ok = v >= need * urgent || (kill > 0 && v >= need * 0.6 * urgent);
            if (!ok)
                continue;
            const r = b.castSpecial(this.team, u.id);
            if (r.ok) {
                this.readySince.delete(u.id);
                this.log.push({ t: b.time, kind: 'especial', speciesId: u.sp.id, value: Math.round(v * 10) / 10 });
            }
        }
    }
}
function clampX(x) {
    return Math.max(1.2, Math.min(F.w - 1.2, x));
}
/** Interpola [valor con nivel ≤3, con nivel 6, con nivel ≥9] según el nivel medio del jugador (progresión gradual, sin saltos). */
export function byLevel(tri, level) {
    const L = Math.max(3, Math.min(9, level));
    return L <= 6 ? tri[0] + (tri[1] - tri[0]) * ((L - 3) / 3) : tri[1] + (tri[2] - tri[1]) * ((L - 6) / 3);
}
/** Elige 8 Pokémon variados para el mazo rival según la dificultad (usa SOLO especies del catálogo). */
export function buildEnemyDeck(allIds, seed, difficulty, playerLevel = 1) {
    const rng = new Rng(seed ^ 0xdec0de);
    const cost = (id) => getSpecies(id).cost;
    const cfg = CONFIG.ai[difficulty];
    const maxCost = cfg.maxCost;
    const quality = (playerLevel >= cfg.deckQuality[0] ? cfg.deckQuality[1] : 0);
    const value = (id) => { const sp = getSpecies(id); return (sp.hp * sp.dps) / Math.pow(sp.cost, CONFIG.ai.valueCostExp ?? 0.5); };
    const pool = allIds.filter((id) => cost(id) <= maxCost);
    const deck = [];
    const need = (f, n) => {
        const c = pool.filter((id) => f(getSpecies(id)) && !deck.includes(id));
        rng.shuffle(c);
        for (let k = 0; k < n && c.length; k++) {
            // Con probabilidad `quality` se elige entre los 5 mejores candidatos por valor; si no, al azar.
            let idx = 0;
            if (quality > 0 && rng.next() < quality) {
                const top = c.map((id, i) => [id, i]).sort((a, b) => value(b[0]) - value(a[0])).slice(0, 5);
                idx = top[Math.floor(rng.next() * top.length)][1];
            }
            deck.push(c.splice(idx, 1)[0]);
        }
    };
    need((s) => s.cost <= 3, 2);
    need((s) => s.cost >= 4 && s.cost <= 5 && !s.ranged && !s.flying, 2);
    need((s) => s.ranged, 2);
    need((s) => s.flying, 1);
    need((s) => s.cost >= 5 || difficulty === 'facil', 1);
    while (deck.length < CONFIG.battle.deckSize) {
        const id = rng.pick(pool);
        if (!deck.includes(id))
            deck.push(id);
    }
    return deck.slice(0, CONFIG.battle.deckSize);
}
/**
 * Niveles de las cartas del rival: parten del nivel medio del mazo del jugador y la dificultad lo desplaza
 * (fácil -1,5 · normal 0 · difícil +1), siempre dentro del tope de cada carta. Así la IA nunca queda muy por debajo ni por encima.
 */
export function enemyLevelsFor(deck, playerAvg, difficulty, maxLevelOf, seed) {
    const rng = new Rng(seed ^ 0x1e7e1);
    const off = byLevel(CONFIG.ai[difficulty].levelOffset, playerAvg);
    const out = {};
    for (const id of deck) {
        const sp = getSpecies(id);
        const lv = Math.round(playerAvg + off + rng.range(-0.6, 0.6));
        out[id] = Math.max(1, Math.min(maxLevelOf(sp), lv));
    }
    return out;
}
