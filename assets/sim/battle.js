import { CONFIG } from "../config.js";
import { leveled, shinyLeveled, towerMul } from "../data/levels.js";
import { getSpecies, SPECIES } from "../data/species.js";
import { typeMult } from "../data/types.js";
import { FIELD_H, FIELD_W, RIVER_MID, dist, inDeployHalf, inRiverBand, nearestBridgeIndex, onBridgeX, towerLayout, } from "./field.js";
import { Rng } from "./rng.js";
import { ITEM_BY_ID } from "../data/items.js";
import { TRAIN_STATS, cleanLevel, statFactor } from "../game/training.js";
import { applyLearned } from "../game/learning.js";
import { normalizeModifiers } from "../data/draftmodes.js";
import { abilityFor, ABILITY_RULES } from "../data/abilities.js";
import { WEATHER, weatherAllowed, weatherDamageMul } from "../data/weather.js";
/** Función (no comparación directa) para que TypeScript no estreche `state` tras llamadas que pueden matar a la unidad. */
const isDead = (u) => u.state === 'dead';
const BC = CONFIG.battle;
const FLD = CONFIG.field;
/** Multiplicador de daño de los ataques especiales contra torres (configurable en CONFIG.towers.specialMul). */
const TOWER_SPECIAL_MUL = CONFIG.towers.specialMul;
const SPLASH_FALLOFF = 0.6;
const CORPSE_SEC = 0.9;
/* ───────── utilidades ───────── */
const isAlive = (t) => !!t && (t.isTower ? !t.destroyed : t.state !== 'dead' && t.hp > 0);
const radiusOf = (t) => (t.isTower ? t.radius : t.sp.radius);
const isFlying = (t) => !t.isTower && t.sp.flying;
const canHit = (mask, t) => t.isTower || mask === 'both' || (mask === 'air') === t.sp.flying;
const edge = (a, ar, b, br) => Math.hypot(a.x - b.x, a.y - b.y) - ar - br;
function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export class Battle {
    opts;
    matchId;
    mode;
    endless;
    duration;
    rng;
    time = 0;
    timeLeft;
    ended = false;
    result = null;
    finalPhase = false;
    /** Tiempo extra (muerte súbita): empieza si se acaba el tiempo con las mismas coronas. */
    overtime = false;
    overtimeLeft = 0;
    levels;
    shinyIds;
    trainingStats;
    towerLevel;
    energy;
    hands;
    units = [];
    towers = [];
    projectiles = [];
    zones = [];
    events = [];
    crowns = [0, 0];
    towerDamage = [0, 0];
    usage = {};
    kills = {};
    trainingCfg;
    itemLoadouts = [];
    itemRuntime = [new Map(), new Map()];
    nextId = 1;
    emitEvents;
    constructor(opts) {
        this.opts = opts;
        this.mode = opts.mode;
        this.featureMode = opts.mode === 'story' || opts.mode === 'tournament';
        this.weather = this.featureMode && weatherAllowed(opts.mode) ? (WEATHER[opts.weather] ? opts.weather : 'neutral') : 'neutral';
        this.weatherLeft = this.featureMode && WEATHER[this.weather]?.duration ? WEATHER[this.weather].duration : 0;
        this.weatherTick = 0;
        this.matchId = opts.matchId ?? `m-${opts.seed}-${opts.mode}`;
        this.endless = opts.mode === 'training';
        this.duration = opts.durationSec ?? BC.durationSec;
        this.timeLeft = this.endless ? Infinity : this.duration;
        this.rng = new Rng(opts.seed ^ 0x51ed270b);
        this.emitEvents = opts.emitEvents ?? true;
        this.trainingCfg = opts.training;
        this.noItems = !!opts.noItems;
        this.itemLoadouts = Array.isArray(opts.itemLoadouts) ? opts.itemLoadouts : [];
        this.energy = [BC.energyStart, BC.energyStart];
        this.levels = [opts.playerLevels ?? {}, opts.enemyLevels ?? {}];
        this.shinyIds = [new Set(opts.playerShiny ?? []), new Set(opts.enemyShiny ?? [])];
        this.trainingStats = [opts.playerTraining ?? {}, opts.enemyTraining ?? {}];
        /** Ataques aprendidos por equipo ({ [id]: { basic, special } }); se validan en applyLearned (candidato real y nivel). */
        /** Reglas especiales de los modos Draft (ver data/draftmodes.js). Sin modificadores = partida normal. */
        this.mod = normalizeModifiers(opts.modifiers);
        this.draftMode = opts.draftMode ?? null;
        this.spawnRng = new Rng((opts.seed ^ 0x5a17) >>> 0);
        this.learnedMoves = [opts.playerMoves ?? {}, opts.enemyMoves ?? {}];
        this.towerLevel = Math.max(1, Math.min(CONFIG.towerLevels.max, Math.floor(opts.towerLevel ?? 1)));
        for (const s of towerLayout()) {
            const c = s.kind === 'king' ? CONFIG.towers.king : CONFIG.towers.side;
            const tm = towerMul(this.towerLevel);
            const thp = Math.round((c.hp * tm) / 5) * 5;
            this.towers.push({
                isTower: true, id: this.towers.length, team: s.team, kind: s.kind, x: s.x, y: s.y, radius: c.radius,
                hp: thp, maxHp: thp, dmg: Math.round(c.dmg * tm), interval: c.interval, range: c.range, projSpeed: c.projSpeed,
                cd: 0.4, active: s.kind !== 'king', destroyed: false, destroyedAt: -1, target: null, attackAt: -9, hurtAt: -9,
                px: s.x, py: s.y,
            });
        }
        const mk = (deck, seedXor, fixed) => {
            if (fixed) {
                const h = fixed.slice(0, BC.handSize);
                while (h.length < BC.handSize)
                    h.push(fixed[h.length % fixed.length]);
                return { deck: fixed.slice(), hand: h, queue: [], fixed: true };
            }
            const d = new Rng(opts.seed ^ seedXor).shuffle(deck.slice());
            return { deck: deck.slice(), hand: d.slice(0, BC.handSize), queue: d.slice(BC.handSize), fixed: false };
        };
        this.hands = [
            mk(opts.playerDeck, 0x1234abcd, opts.training ? opts.training.hand : null),
            mk(opts.enemyDeck, 0x9876fedc, null),
        ];
        if (opts.training?.infiniteEnergy)
            this.energy[0] = BC.energyMax;
    }
    /* ───────── API pública ───────── */
    drainEvents() {
        const e = this.events;
        this.events = [];
        return e;
    }
    towerOf(team, kind) {
        return this.towers[team * 3 + (kind === 'left' ? 0 : kind === 'right' ? 1 : 2)];
    }
    unitsOf(team) {
        return this.units.filter((u) => u.team === team && u.state !== 'dead');
    }
    unitById(id) {
        return this.units.find((u) => u.id === id);
    }
    /** Segundos que muestra el reloj: el tiempo normal o, en el tiempo extra, lo que queda de él. */
    get clock() {
        return this.overtime ? this.overtimeLeft : this.timeLeft;
    }
    energyRate() {
        const base = this.overtime ? BC.regenOvertime : this.timeLeft <= BC.finalPhaseSec ? BC.regenFinal : BC.regenNormal;
        let mul = this.mod.energyMul;
        const ramp = this.mod.energyRamp;
        if (ramp) {
            mul = 1;
            for (const [from, m] of ramp)
                if (this.time >= from)
                    mul = m;
        }
        return base * mul;
    }
    /** Coste real de un Pokémon en esta partida (modo "Coste reducido"). */
    costOf(speciesId) {
        return Math.max(1, getSpecies(speciesId).cost + this.mod.costDelta);
    }
    nextCardOf(team) {
        const h = this.hands[team];
        return h.fixed ? null : h.queue[0] ?? null;
    }
    canAfford(team, speciesId) {
        if (this.isInfinite(team))
            return true;
        return this.energy[team] + 1e-9 >= this.costOf(speciesId);
    }
    /** Despliega la carta `slot` de la mano en (x, y). */
    deploy(team, slot, x, y) {
        if (this.ended)
            return { ok: false, reason: 'fin' };
        const h = this.hands[team];
        const sid = h.hand[slot];
        if (sid === undefined)
            return { ok: false, reason: 'slot' };
        const sp = getSpecies(sid);
        if (!this.canAfford(team, sid))
            return { ok: false, reason: 'energia' };
        if (!this.validSpawnPoint(team, x, y, sp.radius))
            return { ok: false, reason: 'zona' };
        if (this.units.filter((u) => u.team === team && u.state !== 'dead').length >= BC.maxUnitsPerTeam) {
            return { ok: false, reason: 'limite' };
        }
        if (!this.isInfinite(team))
            this.energy[team] = Math.max(0, this.energy[team] - this.costOf(sid));
        if (!h.fixed) {
            const played = h.hand[slot];
            h.hand[slot] = h.queue.shift();
            h.queue.push(played);
        }
        let spawnId = sid;
        if (this.mod.randomSpawn) {
            const same = SPECIES.filter((q) => q.cost === sp.cost);
            spawnId = same[this.spawnRng.int(same.length)].id;
            if (this.levels[team][spawnId] === undefined) this.levels[team][spawnId] = this.levels[team][sid] ?? 1;
        }
        const u = this.makeUnit(team, spawnId, x, y, false);
        if (team === 0)
            this.usage[sid] = (this.usage[sid] ?? 0) + 1;
        this.emit({ type: 'deploy', t: this.time, team, unitId: u.id, speciesId: spawnId, x: u.x, y: u.y });
        this.abilityProc(u, 'deploy');
        return { ok: true, unitId: u.id };
    }
    /** Coloca un maniquí de entrenamiento (no ataca, no se mueve). */
    spawnDummy(team, speciesId, x, y) {
        const u = this.makeUnit(team, speciesId, x, y, true);
        u.hp = u.maxHp = u.sp.hp * 3;
        u.spawnT = 0;
        u.state = 'advancing';
        return u;
    }
    /** Despliega directamente una especie (entrenamiento / pruebas) sin pasar por la mano ni gastar energía. */
    spawnDirect(team, speciesId, x, y) {
        const u = this.makeUnit(team, speciesId, x, y, false);
        this.emit({ type: 'deploy', t: this.time, team, unitId: u.id, speciesId, x: u.x, y: u.y });
        this.abilityProc(u, 'deploy');
        return u;
    }
    validSpawnPoint(team, x, y, r = 0.4) {
        if (!Number.isFinite(x) || !Number.isFinite(y))
            return false;
        if (x < 0.6 || x > FIELD_W - 0.6 || y < 0.6 || y > FIELD_H - 0.6)
            return false;
        if (!this.inDeployZone(team, x, y, r))
            return false;
        for (const t of this.towers) {
            if (!t.destroyed && dist(x, y, t.x, t.y) < t.radius + r * 0.6 + 0.15)
                return false;
        }
        return true;
    }
    /**
     * Despliegue estándar en la mitad propia. Al caer una torre lateral se abre además
     * el corredor enemigo de ese carril, desde el río hasta la línea donde estaba la torre.
     */
    inDeployZone(team, x, y, r) {
        if (inDeployHalf(team, x, y))
            return true;
        const enemy = team === 0 ? 1 : 0;
        const riverNear = team === 0 ? CONFIG.field.riverY0 : CONFIG.field.riverY1;
        for (const kind of ['left', 'right']) {
            const tower = this.towerOf(enemy, kind);
            if (!tower.destroyed)
                continue;
            const onLane = kind === 'left' ? x <= CONFIG.field.centerX : x >= CONFIG.field.centerX;
            if (!onLane)
                continue;
            if (team === 0 && y >= tower.y + tower.radius + r * 0.5 && y <= riverNear - r * 0.5)
                return true;
            if (team === 1 && y <= tower.y - tower.radius - r * 0.5 && y >= riverNear + r * 0.5)
                return true;
        }
        return false;
    }
    /** ¿Puede el especial de la unidad lanzarse ahora mismo? (sin efectos secundarios) */
    canCastSpecial(u) {
        if (this.ended)
            return { ok: false, reason: 'fin' };
        if (u.state === 'dead' || u.dummy)
            return { ok: false, reason: 'no_existe' };
        if (u.state === 'spawning' || u.stunT > 0)
            return { ok: false, reason: 'inactivo' };
        if (u.spCd > 0)
            return { ok: false, reason: 'recarga' };
        const def = u.sp.special.pool ? u.sp.special.pool[0] : u.sp.special;
        return this.checkSpecialTarget(u, def);
    }
    castSpecial(team, unitId) {
        const u = this.unitById(unitId);
        if (!u || u.team !== team)
            return { ok: false, reason: 'no_existe' };
        if (this.ended)
            return { ok: false, reason: 'fin' };
        if (u.state === 'dead' || u.dummy)
            return { ok: false, reason: 'no_existe' };
        if (u.state === 'spawning' || u.stunT > 0)
            return { ok: false, reason: 'inactivo' };
        if (u.spCd > 0)
            return { ok: false, reason: 'recarga' };
        let def = u.sp.special;
        if (def.pool)
            def = def.pool[this.rng.int(def.pool.length)];
        const chk = this.checkSpecialTarget(u, def);
        if (!chk.ok)
            return chk;
        this.executeSpecial(u, def);
        u.spCd = u.sp.special.cd;
        u.castAt = this.time;
        u.atkCd = Math.max(u.atkCd, 0.5);
        u.windT = 0;
        u.windTarget = null;
        return { ok: true };
    }
    surrender(team) {
        if (this.ended)
            return;
        this.finish(team === 0 ? 1 : 0, 'rendicion');
    }
    /* ───────── bucle ───────── */
    /** Avanza la simulación exactamente `dt` segundos (paso fijo). */
    step(dt) {
        if (this.ended)
            return;
        this.time += dt;
        if (this.featureMode) this.updateWeather(dt);
        if (!this.endless)
            this.timeLeft = Math.max(0, this.duration - this.time);
        if (this.overtime)
            this.overtimeLeft = Math.max(0, this.overtimeLeft - dt);
        if (!this.finalPhase && !this.endless && this.timeLeft <= BC.finalPhaseSec) {
            this.finalPhase = true;
            this.emit({ type: 'phase', t: this.time, name: 'final' });
        }
        // energía: una única fuente de tiempo (dt de simulación)
        const rate = this.energyRate();
        for (const team of [0, 1]) {
            if (this.isInfinite(team))
                this.energy[team] = BC.energyMax;
            else
                this.energy[team] = Math.min(BC.energyMax, this.energy[team] + rate * dt);
        }
        for (const u of this.units) {
            u.px = u.x;
            u.py = u.y;
        }
        for (const p of this.projectiles) {
            p.px = p.x;
            p.py = p.y;
        }
        for (const u of this.units)
            this.updateUnit(u, dt);
        this.separate();
        for (const t of this.towers)
            this.updateTower(t, dt);
        this.updateProjectiles(dt);
        this.updateZones(dt);
        this.cleanup();
        this.checkEnd();
    }
    /* ───────── creación ───────── */
    makeUnit(team, sid, x, y, dummy) {
        const isShiny = this.shinyIds[team].has(sid);
        let sp = isShiny ? shinyLeveled(sid, this.levels[team][sid] ?? 1) : leveled(sid, this.levels[team][sid] ?? 1);
        sp = applyLearned(sp, this.learnedMoves[team]?.[String(sid)], this.levels[team][sid] ?? 1);
        const trained = this.trainingStats[team]?.[String(sid)] ?? {};
        if (TRAIN_STATS.some((k) => cleanLevel(trained[k]) > 0)) {
            // Cada punto = +1 % exacto sobre la estadística base (máx. 8 %, ver game/training.js). No se redondea la base para que
            // estadísticas pequeñas no superen el tope por culpa del redondeo.
            const f = (k) => statFactor(trained[k]);
            const base = { ...sp.base };
            for (const key of TRAIN_STATS) base[key] = base[key] * f(key);
            sp = { ...sp, base };
            if (cleanLevel(trained.hp) > 0) sp.hp = Math.round(sp.hp * f('hp'));
            const attackKey = sp.damageKind === 'fisico' ? 'atk' : 'spa';
            sp.dmg = Math.max(1, Math.round(sp.dmg * f(attackKey))); sp.dps = Math.round(sp.dmg / sp.interval * 10) / 10;
            sp.speed = Math.round(sp.speed * f('spe') * 100) / 100;
            sp.interval = Math.max(0.25, Math.round(sp.interval / f('spe') * 1000) / 1000);
        }
        if (this.mod.attackSpeedMul > 1) {
            const m = this.mod.attackSpeedMul;
            sp = { ...sp, interval: Math.max(0.25, Math.round(sp.interval / m * 1000) / 1000), special: { ...sp.special, cd: Math.round(sp.special.cd / m * 100) / 100 } };
        }
        const u = {
            isTower: false, id: this.nextId++, team, sp, x, y, px: x, py: y, hp: sp.hp, maxHp: sp.hp,
            state: 'spawning', lane: nearestBridgeIndex(x), spawnT: BC.spawnDelaySec, spawnInvulnT: 0.02, towerLockId: null, isShiny, atkCd: 0.2, windT: 0, windTarget: null,
            spCd: Math.min(4, sp.special.cd * 0.35), target: null, lastAttackerId: 0, attackerT: 0, slowT: 0, slowPct: 0,
            stunT: 0, stunImmuneT: 0, burn: null, poisonT: 0, poisonDps: 0, knockT: 0, knockVx: 0, knockVy: 0, stuckT: 0, sideT: 0,
            ability: abilityFor(sid), abilityState: { cooldown: 0, used: false, procs: 0, timer: 0 }, attackDebuffT: 0, attackDebuffPct: 0, lastMoveX: x, lastMoveY: y, faceX: 0, faceY: team === 0 ? -1 : 1,
            attackAt: -9, hurtAt: -9, castAt: -9, shieldHp: 0, shieldUntil: 0, asleepT: 0, bornAt: this.time, deadAt: -1, dummy, age: 0,
        };
        this.units.push(u);
        return u;
    }
    updateWeather(dt) {
        if (!this.featureMode || this.weather === 'neutral') return;
        this.weatherLeft = Math.max(0, this.weatherLeft - dt);
        if (this.weather === 'hail' || this.weather === 'sand') {
            this.weatherTick += dt;
            if (this.weatherTick >= 4) {
                this.weatherTick = 0;
                for (const u of this.units) {
                    if (u.state === 'dead') continue;
                    const immune = this.weather === 'hail' ? u.sp.types.includes('hielo') : ['roca','tierra','acero'].some(t=>u.sp.types.includes(t));
                    if (!immune) {
                        u.hp -= u.maxHp * 0.008 * (u.ability?.effect==='weather_neutral'?.65:1);
                        this.emit({type:'weatherHit',t:this.time,unitId:u.id,weather:this.weather});
                        if (u.hp <= 0) this.killUnit(u, -1, 0);
                    }
                }
            }
        }
        if (this.weatherLeft <= 0) {
            const next = ['neutral','sun','rain','storm','hail','sand'][this.rng.int(6)];
            this.setWeather(next);
        }
    }
    setWeather(kind, duration = null) {
        if (!this.featureMode || !WEATHER[kind]) return false;
        this.weather = kind;
        this.weatherLeft = duration ?? WEATHER[kind].duration ?? 0;
        this.weatherTick = 0;
        this.emit({type:'weather',t:this.time,weather:kind,duration:this.weatherLeft});
        for (const u of this.units) if (u.state !== 'dead') this.abilityProc(u,'weather',{weather:kind});
        return true;
    }
    abilityProc(u, trigger, context = {}) {
        if (!u || u.state === 'dead' || !u.ability || !u.abilityState) return false;
        const id = u.ability.effect, r = ABILITY_RULES[id] ?? {};
        const cooldown = u.ability.cooldown || 0;
        if (u.abilityState.cooldown > 0 && trigger !== 'low_hp') return false;
        let fired = false;
        if (trigger === 'deploy' && id === 'entry_intimidate') {
            for (const e of this.units) if (e.team !== u.team && e.state !== 'dead' && Math.hypot(e.x-u.x,e.y-u.y) <= (r.radius||4)) {
                e.attackDebuffT = Math.max(e.attackDebuffT, r.duration||3); e.attackDebuffPct = Math.max(e.attackDebuffPct,.10);
            }
            fired = true;
        } else if (trigger === 'deploy' && id === 'fear_pulse') {
            for (const e of this.units) if (e.team !== u.team && e.state !== 'dead' && Math.hypot(e.x-u.x,e.y-u.y) <= (r.radius||3)) {
                e.attackDebuffT = Math.max(e.attackDebuffT,r.duration||2); e.attackDebuffPct=Math.max(e.attackDebuffPct,.07);
            }
            fired = true;
        } else if (trigger === 'deploy' && id === 'lane_snare') {
            for (const e of this.units) if (e.team !== u.team && e.state !== 'dead' && Math.abs(e.x-u.x)<=2.5 && Math.abs(e.y-u.y)<=3) {
                e.slowT=Math.max(e.slowT,r.duration||1.2);e.slowPct=Math.max(e.slowPct,r.slow||.12);
            }
            fired = true;
        } else if (trigger === 'damage') {
            const elem = context.sourceType;
            if ((id === 'fire_absorb' && elem === 'fuego') || (id === 'water_absorb' && elem === 'agua') || (id === 'electric_absorb' && elem === 'electrico')) {
                u.hp = Math.min(u.maxHp,u.hp+u.maxHp*(r.heal||.06)); fired = true;
            } else if (['contact_poison','contact_burn','contact_spore','contact_slow','contact_charm'].includes(id)) {
                const a=context.attacker;
                if (a && a.team !== u.team) {
                    if (id==='contact_slow') {a.slowT=Math.max(a.slowT,r.duration||1.5);a.slowPct=Math.max(a.slowPct,r.slow||.15);}
                    if (id==='contact_poison') {a.poisonT=Math.max(a.poisonT,r.duration||2);a.poisonDps=a.maxHp*.018;}
                    if (id==='contact_burn') {a.burn={t:r.duration||2,dps:a.maxHp*.02};}
                    if (id==='contact_spore') {a.slowT=Math.max(a.slowT,r.duration||1.8);a.slowPct=Math.max(a.slowPct,r.slow||.12);}
                    if (id==='contact_charm') {a.attackDebuffT=Math.max(a.attackDebuffT,r.duration||2);a.attackDebuffPct=Math.max(a.attackDebuffPct,.06);}
                    fired=true;
                }
            }
        } else if (trigger === 'attack' && (id.startsWith('low_hp_') && u.hp <= u.maxHp*(r.threshold||.35))) fired=true;
        else if (trigger === 'low_hp' && id === 'survival_once' && !u.abilityState.used && u.hp <= u.maxHp*.2) {
            u.hp=Math.max(1,u.maxHp*.2);u.abilityState.used=true;fired=true;
        } else if (trigger === 'weather' && r.weather && context.weather===r.weather) fired=true;
        else if (trigger === 'kill' && id === 'energy_pickup') {
            this.energy[u.team]=Math.min(BC.energyMax,this.energy[u.team]+(r.energy||.25));fired=true;
        }
        if (fired) {
            u.abilityState.procs++;
            if (cooldown>0) u.abilityState.cooldown=cooldown;
            this.emit({type:'ability',t:this.time,team:u.team,unitId:u.id,speciesId:u.sp.id,ability:u.ability.ability,trigger});
        }
        return fired;
    }
    itemFor(team, speciesId) {
        const item = this.itemLoadouts[team];
        return item && ITEM_BY_ID.has(item.itemId) && Number(item.pokemonId) === Number(speciesId) ? item.itemId : null;
    }
    itemState(team, speciesId) {
        const id = this.itemFor(team, speciesId);
        if (!id) return null;
        let state = this.itemRuntime[team].get(id);
        if (!state) { state = { used: false, healed: 0, lastTarget: null, stacks: 0, lastProc: -Infinity, lastSecond: -1, healedThisSecond: 0, lastTickAt: this.time, fullAtSpawn: true, crits: 0 }; this.itemRuntime[team].set(id, state); }
        return state;
    }
    isInfinite(team) {
        return team === 0 && !!this.trainingCfg?.infiniteEnergy;
    }
    emit(e) {
        if (this.emitEvents) {
            this.events.push(e);
            if (this.events.length > 2000)
                this.events.splice(0, 1000);
        }
    }
    /* ───────── unidades ───────── */
    speedOf(u) {
        let speed = u.sp.speed * (u.slowT > 0 ? 1 - u.slowPct : 1);
        if (u.ability) {
            const ar=ABILITY_RULES[u.ability.effect]??{};
            if (ar.speed && this.featureMode && ((ar.weather==='sun'&&this.weather==='sun')||(ar.weather==='rain'&&this.weather==='rain'))) speed*=ar.speed;
            if (ar.speed && !ar.weather && u.hp <= u.maxHp*.4) speed*=ar.speed;
            if (ar.weather==='sand' && this.featureMode && this.weather==='sand' && ar.damageTaken) speed*=1.02;
        }
        const item = this.itemFor(u.team, u.sp.id);
        if (item === 'choice_band' || item === 'choice_specs' || item === 'assault_vest') speed *= 0.9;
        if (item === 'choice_scarf') speed *= 1.2;
        if (item === 'macho_brace') speed *= 0.85;
        if (item === 'shed_shell' && u.itemSpeedUntil > this.time) speed *= 1.25;
        const trapped=this.units.some(e=>e.team!==u.team&&e.state!=='dead'&&e.ability?.effect==='lane_snare'&&Math.abs(e.x-u.x)<2.5&&Math.abs(e.y-u.y)<3);
        if(trapped) speed*=.92;
        return Math.min(u.sp.speed * 1.25, speed);
    }
    updateUnit(u, dt) {
        if (u.state === 'dead')
            return;
        u.age += dt;
        if (u.abilityState) {
            u.abilityState.cooldown = Math.max(0, u.abilityState.cooldown - dt);
            u.abilityState.timer += dt;
            if (u.attackDebuffT > 0) u.attackDebuffT = Math.max(0, u.attackDebuffT - dt);
            if (u.ability?.effect === 'status_cleanse' && u.abilityState.timer >= 12 && (u.slowT>0 || u.stunT>0 || u.asleepT>0 || u.burn)) {
                u.abilityState.timer=0;u.slowT=0;u.slowPct=0;u.stunT=0;u.asleepT=0;u.burn=null;
                this.emit({type:'ability',t:this.time,team:u.team,unitId:u.id,speciesId:u.sp.id,ability:u.ability.ability,trigger:'cleanse'});
            }
            if (u.ability?.effect === 'regen_reserve' && u.hp < u.maxHp && u.abilityState.timer >= 3) {
                u.abilityState.timer = 0;
                u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.012);
                this.emit({type:'ability',t:this.time,team:u.team,unitId:u.id,speciesId:u.sp.id,ability:u.ability.ability});
            }
            if (u.hp <= u.maxHp * 0.35) this.abilityProc(u, 'low_hp');
        }
        if (u.spawnInvulnT > 0)
            u.spawnInvulnT = Math.max(0, u.spawnInvulnT - dt);
        const heldItem = this.itemFor(u.team, u.sp.id);
        const heldState = this.itemState(u.team, u.sp.id);
        if (heldItem === 'leftovers' && heldState && heldState.healed < u.maxHp * 0.15 && u.hp > 0) {
            const heal = Math.min(u.maxHp * 0.01 * dt, u.maxHp - u.hp, u.maxHp * 0.15 - heldState.healed);
            if (heal > 0) { u.hp += heal; heldState.healed += heal; }
        }
        if (heldItem === 'black_sludge' && u.hp > 0) {
            const poison = u.sp.types.includes('veneno');
            const amount = u.maxHp * 0.01 * dt;
            if (poison) u.hp = Math.min(u.maxHp, u.hp + amount);
            else { u.hp -= amount; if (u.hp <= 0) this.killUnit(u, -1, 0); }
        }
        if (u.state === 'dead') return;
        if (heldItem === 'chesto_berry' && heldState && !heldState.used && u.asleepT > 0) { u.asleepT = 0; heldState.used = true; }
        if (heldItem === 'sitrus_berry' && heldState && !heldState.used && u.hp < u.maxHp * 0.5) {
            const heal = Math.min(u.maxHp * 0.25, u.maxHp - u.hp);
            if (heal > 0) { u.hp += heal; heldState.used = true; }
        }
        if (u.slowT > 0) {
            u.slowT -= dt;
            if (u.slowT <= 0)
                u.slowPct = 0;
        }
        if (u.stunImmuneT > 0)
            u.stunImmuneT -= dt;
        if (u.spCd > 0)
            u.spCd -= dt;
        if (u.atkCd > 0) {
            const pressured = this.units.some(e=>e.team!==u.team&&e.state!=='dead'&&e.ability?.effect==='pressure_aura'&&Math.hypot(e.x-u.x,e.y-u.y)<=3);
            u.atkCd -= dt * (pressured ? 0.94 : 1);
        }
        if (u.attackerT > 0)
            u.attackerT -= dt;
        if (u.burn)
            this.tickBurn(u, dt);
        if (isDead(u))
            return;
        if (u.spawnT > 0) {
            u.spawnT -= dt;
            if (u.spawnT <= 0)
                u.state = 'advancing';
            else {
                u.state = 'spawning';
                return;
            }
        }
        if (u.knockT > 0) {
            u.knockT -= dt;
            u.x += u.knockVx * dt;
            u.y += u.knockVy * dt;
            this.constrain(u);
            return;
        }
        if (u.asleepT > 0) {
            u.asleepT = Math.max(0, u.asleepT - dt);
            u.windT = 0; u.windTarget = null;
            return;
        }
        if (u.stunT > 0) {
            u.stunT -= dt;
            u.windT = 0;
            u.windTarget = null;
            return;
        }
        if (u.dummy)
            return;
        if (u.windT > 0) {
            u.windT -= dt;
            if (u.windT <= 0)
                this.resolveAttack(u);
            return;
        }
        const sp = u.sp;
        // Una vez que una unidad empieza a golpear una torre, la fija como objetivo.
        // El daño normal no rompe el bloqueo; los efectos de control sí lo hacen en applyEffects().
        let target = null;
        let towerGoal = false;
        if (u.towerLockId !== null) {
            const locked = this.towers.find((t) => t.id === u.towerLockId);
            if (locked && !locked.destroyed) {
                target = locked;
                towerGoal = true;
            }
            else {
                u.towerLockId = null;
            }
        }
        if (!target) {
            target = this.acquireUnitTarget(u);
            if (!target) {
                target = this.acquireTowerTarget(u);
                towerGoal = true;
            }
        }
        u.target = target;
        if (!target) {
            u.state = 'advancing';
            return;
        }
        const gap = edge(u, sp.radius, target, radiusOf(target));
        const inRange = gap <= sp.range;
        if (inRange) {
            u.state = towerGoal ? 'attackingTower' : 'fighting';
            if (towerGoal && target?.isTower && u.towerLockId === null)
                u.towerLockId = target.id;
            u.faceX = target.x - u.x;
            u.faceY = target.y - u.y;
            const fl = Math.hypot(u.faceX, u.faceY) || 1;
            u.faceX /= fl;
            u.faceY /= fl;
            u.stuckT = 0;
            if (u.atkCd <= 0) {
                u.atkCd = sp.interval;
                u.windT = Math.min(0.28, sp.interval * 0.35);
                u.windTarget = target;
                const held = this.itemFor(u.team, u.sp.id), heldState = this.itemState(u.team, u.sp.id);
                if (held === 'power_herb' && heldState && !heldState.used) { heldState.used = true; u.windT = 0; this.resolveAttack(u); }
                u.attackAt = this.time;
                this.emit({ type: 'attack', t: this.time, unitId: u.id, ranged: sp.ranged, vType: sp.attackType });
            }
            return;
        }
        // 2) moverse hacia el objetivo
        u.state = towerGoal ? 'advancing' : 'seeking';
        const before = { x: u.x, y: u.y };
        this.moveToward(u, target.x, target.y, dt);
        this.constrain(u);
        // detección de atascos: avanzar muy poco durante un rato -> pequeño paso lateral
        const moved = Math.hypot(u.x - before.x, u.y - before.y);
        const want = this.speedOf(u) * dt;
        if (want > 0 && moved < want * 0.25)
            u.stuckT += dt;
        else
            u.stuckT = Math.max(0, u.stuckT - dt * 2);
        if (u.stuckT > 0.5) {
            u.sideT = 0.6;
            u.stuckT = 0;
            u.sideDir = -u.sideDir;
        }
        if (u.sideT > 0)
            u.sideT -= dt;
    }
    tickBurn(u, dt) {
        const b = u.burn;
        b.t -= dt;
        b.acc += dt;
        while (b.acc >= 0.5 && u.state !== 'dead') {
            b.acc -= 0.5;
            this.tickHit = true;
            this.hitTarget(u, b.perTick, null, b.srcTeam, b.srcUnitId, b.srcSpeciesId, b.type, true, 1, false);
            this.tickHit = false;
        }
        if (b.t <= 0)
            u.burn = null;
    }
    reachable(u, e) {
        if (u.sp.flying || e.sp.flying)
            return true;
        const su = u.y < FLD.riverY0 ? 1 : u.y > FLD.riverY1 ? 0 : -1;
        const se = e.y < FLD.riverY0 ? 1 : e.y > FLD.riverY1 ? 0 : -1;
        if (su === -1 || se === -1 || su === se)
            return true;
        // al otro lado del río: solo si puede disparar desde la orilla
        return u.sp.ranged && edge(u, u.sp.radius, e, e.sp.radius) <= u.sp.range + 0.6;
    }
    acquireUnitTarget(u) {
        const sp = u.sp;
        const aggro = sp.ranged ? sp.range + 1.6 : 5.4;
        let best = null;
        let bestScore = Infinity;
        for (const e of this.units) {
            if (e.team === u.team || e.state === 'dead' || !canHit(sp.targets, e))
                continue;
            const d = edge(u, sp.radius, e, e.sp.radius);
            if (d > aggro)
                continue;
            if (!this.reachable(u, e))
                continue;
            const score = d - (e.id === u.lastAttackerId && u.attackerT > 0 ? 2 : 0);
            if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && best && e.id < best.id)) {
                best = e;
                bestScore = score;
            }
        }
        const cur = u.target && !u.target.isTower && isAlive(u.target) ? u.target : null;
        if (cur && canHit(sp.targets, cur) && this.reachable(u, cur)) {
            const dc = edge(u, sp.radius, cur, cur.sp.radius);
            if (dc <= aggro * 1.4 && !(best && best !== cur && bestScore < dc * 0.6 - 0.2))
                return cur;
        }
        return best;
    }
    acquireTowerTarget(u) {
        const sp = u.sp;
        const enemy = u.team === 0 ? 1 : 0;
        // oportunista: cualquier torre enemiga ya a tiro
        let near = null;
        let nd = Infinity;
        for (let k = 0; k < 3; k++) {
            const t = this.towers[enemy * 3 + k];
            if (t.destroyed)
                continue;
            const d = edge(u, sp.radius, t, t.radius);
            if (d <= sp.range && d < nd) {
                near = t;
                nd = d;
            }
        }
        if (near)
            return near;
        // carril: torre lateral de su carril; si ya cayó, la Torre del Rey; si no, la otra lateral
        const lane = this.towerOf(enemy, u.lane === 0 ? 'left' : 'right');
        if (!lane.destroyed)
            return lane;
        const king = this.towerOf(enemy, 'king');
        if (!king.destroyed)
            return king;
        const other = this.towerOf(enemy, u.lane === 0 ? 'right' : 'left');
        return other.destroyed ? null : other;
    }
    /** Punto intermedio al que debe dirigirse una unidad terrestre (puentes). */
    groundWaypoint(u, gx, gy) {
        const bx = FLD.bridgeXs[u.lane];
        const inBand = inRiverBand(u.y);
        const uTop = u.y < RIVER_MID;
        const gTop = gy < RIVER_MID;
        if (inBand) {
            // sobre el río: sigue por el puente hasta la orilla del lado del objetivo
            return [bx, gTop ? FLD.riverY0 - 0.5 : FLD.riverY1 + 0.5];
        }
        if (uTop === gTop)
            return [gx, gy];
        const bankY = uTop ? FLD.riverY0 - 0.35 : FLD.riverY1 + 0.35;
        const exitY = uTop ? FLD.riverY1 + 0.6 : FLD.riverY0 - 0.6;
        const aligned = Math.abs(u.x - bx) <= FLD.bridgeHalfW * 0.45;
        return aligned ? [bx, exitY] : [bx, bankY];
    }
    moveToward(u, gx, gy, dt) {
        let wx = gx, wy = gy;
        if (!u.sp.flying)
            [wx, wy] = this.groundWaypoint(u, gx, gy);
        let dx = wx - u.x, dy = wy - u.y;
        const d = Math.hypot(dx, dy);
        if (d < 1e-4)
            return;
        dx /= d;
        dy /= d;
        if (u.sideT > 0) {
            dx += -dy * 0.9 * u.sideDir;
            dy += dx * 0.9 * u.sideDir;
            const l = Math.hypot(dx, dy) || 1;
            dx /= l;
            dy /= l;
        }
        const step = Math.min(this.speedOf(u) * dt, d);
        u.x += dx * step;
        u.y += dy * step;
        u.faceX = dx;
        u.faceY = dy;
    }
    /** Reglas de terreno: límites del campo, río solo por los puentes, torres sólidas (solo terrestres). */
    constrain(u) {
        const r = u.sp.radius;
        u.x = Math.max(r, Math.min(FIELD_W - r, u.x));
        u.y = Math.max(r, Math.min(FIELD_H - r, u.y));
        if (u.sp.flying)
            return;
        if (inRiverBand(u.y) && !onBridgeX(u.x, r)) {
            u.y = u.y < RIVER_MID ? FLD.riverY0 : FLD.riverY1;
        }
        for (const t of this.towers) {
            if (t.destroyed)
                continue;
            const min = t.radius + r * 0.7;
            const dx = u.x - t.x, dy = u.y - t.y;
            const d = Math.hypot(dx, dy);
            if (d < min) {
                if (d < 1e-4) {
                    u.x = t.x + min;
                }
                else {
                    u.x = t.x + (dx / d) * min;
                    u.y = t.y + (dy / d) * min;
                }
            }
        }
        u.x = Math.max(r, Math.min(FIELD_W - r, u.x));
        u.y = Math.max(r, Math.min(FIELD_H - r, u.y));
    }
    separate() {
        const us = this.units;
        for (let i = 0; i < us.length; i++) {
            const a = us[i];
            if (a.state === 'dead')
                continue;
            for (let j = i + 1; j < us.length; j++) {
                const b = us[j];
                if (b.state === 'dead' || a.sp.flying !== b.sp.flying)
                    continue;
                const min = (a.sp.radius + b.sp.radius) * 0.9;
                let dx = b.x - a.x, dy = b.y - a.y;
                let d = Math.hypot(dx, dy);
                if (d >= min)
                    continue;
                if (d < 1e-4) {
                    dx = ((a.id * 7 + b.id) % 2 ? 1 : -1) * 0.01;
                    dy = 0.01;
                    d = Math.hypot(dx, dy);
                }
                const ma = this.pushMass(a), mb = this.pushMass(b);
                const over = min - d;
                const wa = mb / (ma + mb), wb = ma / (ma + mb);
                const nx = dx / d, ny = dy / d;
                a.x -= nx * over * wa;
                a.y -= ny * over * wa;
                b.x += nx * over * wb;
                b.y += ny * over * wb;
            }
        }
        for (const u of us)
            if (u.state !== 'dead')
                this.constrain(u);
    }
    pushMass(u) {
        let m = u.sp.mass;
        if (u.dummy)
            m *= 50;
        else if (u.state === 'fighting' || u.state === 'attackingTower')
            m *= 2.2;
        else if (u.state === 'spawning')
            m *= 3;
        return m;
    }
    /* ───────── ataques básicos ───────── */
    resolveAttack(u) {
        const t = u.windTarget;
        u.windTarget = null;
        if (!t || !isAlive(t) || u.state === 'dead')
            return;
        const sp = u.sp;
        this.abilityProc(u, 'attack', { target: t });
        if (edge(u, sp.radius, t, radiusOf(t)) > sp.range + 0.9)
            return;
        if (sp.ranged) {
            this.spawnProjectile({
                team: u.team, x: u.x, y: u.y, speed: sp.projectileSpeed, target: t, homing: true, dmg: sp.dmg,
                atkType: sp.attackType, vType: sp.attackType, radius: sp.splash, effects: {}, hits: sp.targets,
                special: false, srcUnitId: u.id, srcSpeciesId: sp.id, towerMul: 1, fromTower: false,
            });
        }
        else {
            this.hitTarget(t, sp.dmg, sp.attackType, u.team, u.id, sp.id, sp.attackType, false, 1, true);
            if (sp.splash > 0)
                this.areaDamage(t.x, t.y, sp.splash, u.team, sp.dmg * SPLASH_FALLOFF, sp.attackType, sp.targets, u.id, sp.id, sp.attackType, false, 1, t);
        }
    }
    spawnProjectile(p) {
        const proj = {
            ...p, id: this.nextId++, px: p.x, py: p.y, tx: p.tx ?? (p.target ? p.target.x : p.x), ty: p.ty ?? (p.target ? p.target.y : p.y),
            life: 4, splashFalloff: SPLASH_FALLOFF,
        };
        this.projectiles.push(proj);
        this.emit({ type: 'projectile', t: this.time, id: proj.id, vType: proj.vType, special: proj.special, fromTower: proj.fromTower });
        return proj;
    }
    /* ───────── daño ───────── */
    /** Aplica daño una única vez. Devuelve el daño real aplicado. */
    /** Marca los golpes periódicos (quemadura, zonas) para que la interfaz los dibuje pequeños. */
    tickHit = false;
    isMelee(special, srcSpeciesId) {
        return !special && srcSpeciesId > 0 && !getSpecies(srcSpeciesId).ranged;
    }
    hitTarget(t, amount, atkType, srcTeam, srcUnitId, srcSpeciesId, vType, special, towerMul, applyAttackerMark) {
        if (!isAlive(t))
            return 0;
        if (!t.isTower && t.spawnInvulnT > 0)
            return 0;
        let mult = 1;
        if (!t.isTower && atkType)
            mult = typeMult(atkType, t.sp.types);
        const baseStats = !t.isTower ? t.sp.base : null;
        const lowest = baseStats ? Math.min(baseStats.hp, baseStats.atk, baseStats.def, baseStats.spa, baseStats.spd, baseStats.spe) : -1;
        const shinyDefense = baseStats && t.isShiny && (baseStats.def === lowest || baseStats.spd === lowest) && baseStats.hp !== lowest && baseStats.atk !== lowest && baseStats.spa !== lowest && baseStats.spe !== lowest ? (1 / 1.2) : 1;
        // Las estadísticas base son parte real del combate, no solo de la descripción: ataque/defensa
        // físicos o especiales modifican cada impacto. La raíz suaviza extremos entre especies.
        let statMultiplier = 1;
        if (srcSpeciesId > 0 && !t.isTower) {
            const attacker = getSpecies(srcSpeciesId);
            const physical = attacker.damageKind === 'fisico';
            const attackStat = physical ? attacker.base.atk : attacker.base.spa;
            const defenseStat = physical ? baseStats.def : baseStats.spd;
            statMultiplier = Math.sqrt(Math.max(1, attackStat) / Math.max(1, defenseStat));
            statMultiplier = Math.max(0.55, Math.min(1.8, statMultiplier));
        }
        const attackerUnit = srcUnitId > 0 ? this.unitById(srcUnitId) : null;
        const attackerSp = srcSpeciesId > 0 ? getSpecies(srcSpeciesId) : null;
        const attackItem = attackerUnit ? this.itemFor(srcTeam, attackerUnit.sp.id) : null;
        const attackState = attackerUnit ? this.itemState(srcTeam, attackerUnit.sp.id) : null;
        const targetTeam = t.team;
        const targetItem = !t.isTower ? this.itemFor(targetTeam, t.sp.id) : null;
        const targetState = !t.isTower ? this.itemState(targetTeam, t.sp.id) : null;
        let itemOffense = 1;
        if (attackItem === 'life_orb') itemOffense *= 1.2;
        if (attackItem === 'choice_band' && attackerSp?.damageKind === 'fisico') itemOffense *= 1.3;
        if (attackItem === 'choice_specs' && attackerSp?.damageKind !== 'fisico') itemOffense *= 1.3;
        if (attackItem === 'muscle_band' && attackerSp?.damageKind === 'fisico') itemOffense *= 1.15;
        if (attackItem === 'wise_glasses' && attackerSp?.damageKind !== 'fisico') itemOffense *= 1.15;
        if (attackItem === 'choice_scarf') itemOffense *= 0.9;
        const typeItem = { dragon_fang:'dragon', charcoal:'fuego', mystic_water:'agua', magnet:'electrico', silver_powder:'bicho', soft_sand:'tierra', never_melt_ice:'hielo', black_belt:'lucha', spell_tag:'fantasma', twisted_spoon:'psiquico' };
        if (typeItem[attackItem] && typeItem[attackItem] === atkType) itemOffense *= 1.2;
        if (attackItem === 'expert_belt' && mult > 1) itemOffense *= 1.2;
        if (attackItem === 'metronome_item' && attackState) {
            const targetKey = t.isTower ? `tower:${t.id}` : `unit:${t.id}`;
            if (attackState.lastTarget === targetKey) attackState.stacks = Math.min(5, attackState.stacks + 1);
            else { attackState.lastTarget = targetKey; attackState.stacks = 0; }
            itemOffense *= 1 + attackState.stacks * 0.04;
        }
        let itemDefense = 1;
        const specialHit = attackerSp && attackerSp.damageKind !== 'fisico';
        if (targetItem === 'assault_vest' && specialHit) itemDefense *= 0.8;
        if (targetItem === 'macho_brace') itemDefense *= 0.9;
        if (targetItem === 'eviolite' && !t.sp.evolutionFinal && t.sp.canEvolve) itemDefense *= 0.8;
        if (targetItem === 'rocky_helmet' && targetState && attackerUnit && this.time - targetState.lastProc >= 0) { /* retaliation is applied after the direct hit */ }
        let berryReduction = false;
        if (!t.isTower && targetState && !targetState.used && ((targetItem === 'shuca_berry' && atkType === 'tierra' && mult > 1) || (targetItem === 'wacan_berry' && atkType === 'electrico' && mult > 1))) { itemDefense *= 0.5; berryReduction = true; }
        // Los críticos solo existen para estos objetos: sin ellos el combate conserva exactamente su daño base.
        let critical = false;
        if (!t.isTower && attackerUnit && (attackItem === 'scope_lens' || attackItem === 'razor_claw')) {
            const chance = attackItem === 'scope_lens' ? 0.10 : 0.15;
            critical = this.rng.next() < chance;
        }
        const critMultiplier = critical ? 1.25 : 1;
        let passiveOffense = 1, passiveDefense = 1;
        if (attackerUnit?.ability) {
            const ar = ABILITY_RULES[attackerUnit.ability.effect] ?? {};
            const low = attackerUnit.hp <= attackerUnit.maxHp * (ar.threshold ?? 0);
            if (ar.damage && (!ar.threshold || low)) passiveOffense *= ar.damage;
            if (attackerUnit.ability?.effect === 'status_rage' && (attackerUnit.burn || attackerUnit.slowT>0 || attackerUnit.stunT>0)) passiveOffense *= 1.10;
            if (ar.towerDamage && t.isTower) passiveOffense *= ar.towerDamage;
            if (ar.element && ar.element === atkType && ar.damage) passiveOffense *= ar.damage;
            if (ar.weather && this.featureMode && ((ar.weather === 'sun' && this.weather === 'sun') || (ar.weather === 'rain' && this.weather === 'rain'))) passiveOffense *= ar.speed ? 1.04 : 1.06;
            if (attackerUnit.attackDebuffT > 0 && attackerUnit.ability?.effect !== 'attack_guard') passiveOffense *= 1 - attackerUnit.attackDebuffPct;
        }
        if (!t.isTower && t.ability) {
            const dr = ABILITY_RULES[t.ability.effect] ?? {};
            if (dr.damageTaken && (!dr.element || dr.element === atkType) && (!dr.elements || dr.elements.includes(atkType)) && (!dr.weather || (this.featureMode && this.weather===dr.weather))) passiveDefense *= dr.damageTaken;
            if (dr.critGuard && critical) passiveDefense *= dr.critGuard;
            if (dr.weatherResist && this.featureMode && ['hail','sand','storm'].includes(this.weather)) passiveDefense *= (1-dr.weatherResist);
        }
        const weatherMul = this.featureMode ? weatherDamageMul(this.weather, atkType) : 1;
        let dmg = Math.max(1, Math.round(amount * mult * weatherMul * (t.isTower ? towerMul : 1) * shinyDefense * statMultiplier * itemOffense * itemDefense * passiveOffense * passiveDefense * critMultiplier));
        if (!t.isTower && ((t.ability?.effect==='fire_absorb'&&atkType==='fuego') || (t.ability?.effect==='water_absorb'&&atkType==='agua') || (t.ability?.effect==='electric_absorb'&&atkType==='electrico'))) {
            dmg=0;
            this.abilityProc(t,'damage',{sourceType:atkType,attacker:attackerUnit,amount:0});
        }
        if (t.isTower) {
            const before = t.hp;
            t.hp -= dmg;
            t.hurtAt = this.time;
            if (srcTeam !== -1)
                this.towerDamage[srcTeam] += Math.min(dmg, before);
            if (!t.active) {
                t.active = true;
                this.emit({ type: 'kingActive', t: this.time, towerId: t.id, team: t.team });
            }
            this.emit({ type: 'towerHit', t: this.time, towerId: t.id });
            this.emit({ type: 'hit', t: this.time, x: t.x, y: t.y, amount: dmg, mult: 1, vType, targetIsTower: true, targetId: t.id, team: t.team, special, src: srcUnitId, melee: this.isMelee(special, srcSpeciesId), tick: this.tickHit });
            if (t.hp <= 0)
                this.destroyTower(t, srcTeam);
        }
        else {
            const beforeHp = t.hp;
            let applied = dmg;
            var actualApplied = dmg;
            if (t.shieldUntil > this.time && t.shieldHp > 0) { const absorbed = Math.min(t.shieldHp, applied); t.shieldHp -= absorbed; applied -= absorbed; if (applied <= 0) applied = 0; }
            if (targetItem === 'focus_sash' && targetState && !targetState.used && t.hp >= t.maxHp - 1e-6 && dmg >= t.hp) { applied = Math.max(0, t.hp - 1); targetState.used = true; }
            actualApplied = applied;
            const preHitHp = t.hp;
            if (srcTeam !== targetTeam && dmg > 0) this.abilityProc(t, 'damage', { sourceType: atkType, attacker: attackerUnit, amount: applied });
            
            // Botón Escape: una sola activación al cruzar el umbral por daño enemigo.
            if (targetItem === 'eject_button' && targetState && !targetState.used && srcTeam !== targetTeam && applied > 0 && (preHitHp - applied) <= t.maxHp * 0.2) {
                targetState.used = true;
                const safeY = targetTeam === 0 ? FIELD_H * 0.78 : FIELD_H * 0.22;
                const safeX = FIELD_W * 0.5;
                const candidates = [[safeX,safeY],[safeX-3,safeY],[safeX+3,safeY],[safeX-5,safeY],[safeX+5,safeY]];
                const spot = candidates.find(([x,y]) => this.validSpawnPoint(targetTeam,x,y,t.sp.radius));
                if (spot) { t.x=t.px=spot[0]; t.y=t.py=spot[1]; t.target=null; t.towerLockId=null; t.windT=0; t.windTarget=null; t.shieldHp=t.maxHp*0.1; t.shieldUntil=this.time+3; }
            }
            if (dmg > 0 && t.asleepT > 0) { t.asleepT = 0; this.emit({ type: 'status', t: this.time, unitId: t.id, what: 'wake' }); }
            t.hp -= applied;
            if (berryReduction && targetState) targetState.used = true;
            t.hurtAt = this.time;
            if (applyAttackerMark && srcUnitId > 0) {
                t.lastAttackerId = srcUnitId;
                t.attackerT = 2.5;
            }
            if (critical) this.emit({ type: 'status', t: this.time, unitId: attackerUnit?.id ?? 0, what: 'critical' });
            if (t.shieldUntil <= this.time) { t.shieldHp = 0; t.shieldUntil = 0; }
            this.emit({ type: 'hit', t: this.time, x: t.x, y: t.y, amount: applied, mult, vType, targetIsTower: false, targetId: t.id, team: t.team, special, src: srcUnitId, melee: this.isMelee(special, srcSpeciesId), tick: this.tickHit });
            if (t.hp <= 0)
                this.killUnit(t, srcTeam, srcSpeciesId);
            // Efectos posteriores, una sola vez y sin volver a entrar en hitTarget.
            if (attackerUnit && attackerUnit.state !== 'dead' && applied > 0) {
                if (attackItem === 'life_orb') attackerUnit.hp = Math.max(1, attackerUnit.hp - Math.round(attackerUnit.maxHp * 0.04));
                if (attackItem === 'shell_bell' && attackState) {
                    const sec = Math.floor(this.time); if (attackState.lastSecond !== sec) { attackState.lastSecond = sec; attackState.healedThisSecond = 0; }
                    const cap = attackerUnit.maxHp * 0.1;
                    const heal = Math.min(Math.round(applied * 0.1), Math.max(0, cap - attackState.healedThisSecond), attackerUnit.maxHp - attackerUnit.hp);
                    if (heal > 0) { attackerUnit.hp += heal; attackState.healedThisSecond += heal; }
                }
                if (attackItem === 'kings_rock' && !t.isTower && this.time - attackState.lastProc >= 5 && this.rng.next() < 0.1) { t.slowT = Math.max(t.slowT, 1); t.slowPct = Math.max(t.slowPct, 0.25); attackState.lastProc = this.time; }
                if (attackItem === 'quick_claw' && this.time - attackState.lastProc >= 8 && this.rng.next() < 0.2) { attackerUnit.atkCd = Math.max(0, attackerUnit.atkCd * 0.5); attackState.lastProc = this.time; }
            }
            if (targetItem === 'rocky_helmet' && targetState && attackerUnit && applied > 0 && !this.tickHit) {
                const reflected = Math.round(applied * 0.08);
                if (reflected > 0 && attackerUnit.state !== 'dead') { attackerUnit.hp -= reflected; if (attackerUnit.hp <= 0) this.killUnit(attackerUnit, targetTeam, t.sp.id); }
            }
        }
        return t.isTower ? dmg : actualApplied;
    }
    killUnit(u, srcTeam, srcSpeciesId) {
        if (u.state === 'dead')
            return;
        u.hp = 0;
        u.state = 'dead';
        u.deadAt = this.time;
        u.windT = 0;
        u.windTarget = null;
        const killer = this.units.find(v => v.team === srcTeam && v.sp.id === srcSpeciesId && v.state !== 'dead');
        if (killer) this.abilityProc(killer, 'kill', { target: u });
        if (srcTeam === 0 && srcSpeciesId > 0)
            this.kills[srcSpeciesId] = (this.kills[srcSpeciesId] ?? 0) + 1;
        this.emit({ type: 'death', t: this.time, unitId: u.id, team: u.team, speciesId: u.sp.id, x: u.x, y: u.y, flying: u.sp.flying });
    }
    destroyTower(t, srcTeam) {
        t.hp = 0;
        t.destroyed = true;
        t.destroyedAt = this.time;
        t.target = null;
        if (srcTeam !== -1)
            this.crowns[srcTeam] += 1;
        this.emit({ type: 'towerDown', t: this.time, towerId: t.id, team: t.team, kind: t.kind, x: t.x, y: t.y });
        if (t.kind === 'king' && !this.ended) {
            const ownKing = this.towerOf(t.team, 'king');
            const otherKing = this.towerOf(1 - t.team, 'king');
            if (ownKing.destroyed || otherKing.destroyed) {
                if (ownKing.destroyed && otherKing.destroyed) this.finishByTiebreak();
                else this.finish(otherKing.destroyed ? t.team : 1 - t.team, 'rey');
            }
        }
    }
    areaDamage(cx, cy, radius, srcTeam, amount, atkType, hits, srcUnitId, srcSpeciesId, vType, special, towerMul, skip, fx, src, fxType) {
        let n = 0;
        for (const e of this.units) {
            if (e === skip || e.team === srcTeam || e.state === 'dead' || !canHit(hits, e))
                continue;
            if (edge({ x: cx, y: cy }, 0, e, e.sp.radius) > radius)
                continue;
            this.hitTarget(e, amount, atkType, srcTeam, srcUnitId, srcSpeciesId, vType, special, towerMul, true);
            if (fx && src && !isDead(e))
                this.applyEffects(fx, e, src, cx, cy, fxType ?? vType);
            n++;
        }
        for (const t of this.towers) {
            if (t === skip || t.team === srcTeam || t.destroyed)
                continue;
            if (edge({ x: cx, y: cy }, 0, t, t.radius) > radius)
                continue;
            this.hitTarget(t, amount, atkType, srcTeam, srcUnitId, srcSpeciesId, vType, special, towerMul, false);
            n++;
        }
        return n;
    }
    applyEffects(fx, t, src, cx, cy, type) {
        if (t.state === 'dead')
            return;
        const passiveStatus = t.ability ? (ABILITY_RULES[t.ability.effect]?.statusResist ?? 0) : 0;
        if (fx.sleep && t.asleepT <= 0 && t.stunImmuneT <= 0 && t.ability?.effect !== 'sleep_guard') {
            // Sleep is brief, interrupts attacks, and ends early on the next damaging hit.
            const sleepItem = this.itemFor(t.team, t.sp.id);
            const duration = Math.min(1.7, Math.max(0.5, fx.sleep)) * (t.sp.sizeClass >= 5 ? 0.6 : 1) * (sleepItem === 'covert_cloak' ? 0.5 : 1) * (1-passiveStatus);
            t.towerLockId = null; t.asleepT = duration; t.stunImmuneT = Math.max(t.stunImmuneT, duration + 1.0); t.windT = 0; t.windTarget = null;
            this.emit({ type: 'status', t: this.time, unitId: t.id, what: 'sleep' });
        }
        if (fx.slow) {
            if (t.ability?.effect === 'status_echo' && src && src.team !== t.team && this.rng.next() < 0.25) {
                src.slowT=Math.max(src.slowT,fx.slow[1]*.5);src.slowPct=Math.max(src.slowPct,Math.min(.25,fx.slow[0]*.5));
                this.emit({type:'ability',t:this.time,team:t.team,unitId:t.id,speciesId:t.sp.id,ability:t.ability.ability,trigger:'reflect'});
                return;
            }
            const held = this.itemFor(t.team, t.sp.id);
            const heldState = this.itemState(t.team, t.sp.id);
            if (held === 'shed_shell' && heldState && !heldState.used) {
                heldState.used = true; t.slowT = 0; t.slowPct = 0; t.stunT = 0; t.itemSpeedUntil = this.time + 2;
                this.emit({ type: 'status', t: this.time, unitId: t.id, what: 'shed-shell' });
                return;
            }
            const duration = fx.slow[1] * (held === 'covert_cloak' ? 0.5 : 1) * (1-passiveStatus) * (t.ability?.effect==='slow_resist'?.5:1);
            t.towerLockId = null;
            t.slowT = Math.max(t.slowT, duration);
            t.slowPct = Math.max(t.slowPct, Math.min(0.6, fx.slow[0]));
            this.emit({ type: 'status', t: this.time, unitId: t.id, what: 'slow' });
        }
        if (fx.stun && t.stunImmuneT <= 0) {
            const held = this.itemFor(t.team, t.sp.id);
            const heldState = this.itemState(t.team, t.sp.id);
            if (held === 'shed_shell' && heldState && !heldState.used) {
                heldState.used = true; t.slowT = 0; t.slowPct = 0; t.stunT = 0; t.itemSpeedUntil = this.time + 2;
                this.emit({ type: 'status', t: this.time, unitId: t.id, what: 'shed-shell' });
                return;
            }
            t.towerLockId = null;
            const dur = fx.stun * (t.sp.sizeClass >= 5 ? 0.5 : 1) * (held === 'covert_cloak' ? 0.5 : 1) * (1-passiveStatus);
            t.stunT = Math.max(t.stunT, dur);
            t.stunImmuneT = dur + 2.0;
            t.windT = 0;
            t.windTarget = null;
            this.emit({ type: 'status', t: this.time, unitId: t.id, what: 'stun' });
        }
        if (fx.push) {
            t.towerLockId = null;
            let dx = t.x - cx, dy = t.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            dx /= d;
            dy /= d;
            const dd = Math.max(0.25, fx.push / Math.sqrt(t.sp.mass * 2));
            t.knockT = 0.25;
            t.knockVx = (dx * dd) / 0.25;
            t.knockVy = (dy * dd) / 0.25;
        }
        if (fx.dot) {
            const [mul, dur] = fx.dot;
            const effectiveDuration = dur * (1 - passiveStatus);
            const perTick = Math.max(1, (src.sp.dps * mul) / (dur / 0.5));
            if (!t.burn || t.burn.perTick <= perTick) {
                t.burn = { t: effectiveDuration, acc: 0, perTick, type, srcTeam: src.team, srcUnitId: src.id, srcSpeciesId: src.sp.id };
                this.emit({ type: 'status', t: this.time, unitId: t.id, what: 'burn' });
            }
        }
    }
    /* ───────── especiales ───────── */
    specialTarget(u, def) {
        const cur = u.target;
        const inReach = (t) => isAlive(t) && canHit(def.hits, t) && edge(u, u.sp.radius, t, radiusOf(t)) <= def.range;
        if (cur && inReach(cur))
            return cur;
        let best = null;
        let bd = Infinity;
        for (const e of this.units) {
            if (e.team === u.team || e.state === 'dead' || !inReach(e))
                continue;
            const d = edge(u, u.sp.radius, e, e.sp.radius);
            if (d < bd) {
                bd = d;
                best = e;
            }
        }
        if (best)
            return best;
        for (let k = 0; k < 3; k++) {
            const t = this.towers[(u.team === 0 ? 1 : 0) * 3 + k];
            if (t.destroyed)
                continue;
            const d = edge(u, u.sp.radius, t, t.radius);
            if (d <= def.range && d < bd) {
                bd = d;
                best = t;
            }
        }
        return best;
    }
    checkSpecialTarget(u, def) {
        if (def.delivery === 'heal') {
            const any = this.units.some((a) => a.team === u.team && a.state !== 'dead' && a.hp < a.maxHp * 0.97 && edge(u, 0, a, a.sp.radius) <= def.radius);
            return any ? { ok: true } : { ok: false, reason: 'sin_objetivo' };
        }
        if (def.delivery === 'aoe') {
            const enemy = u.team === 0 ? 1 : 0;
            const any = this.units.some((e) => e.team === enemy && e.state !== 'dead' && canHit(def.hits, e) && edge(u, 0, e, e.sp.radius) <= def.radius) ||
                this.towers.some((t) => t.team === enemy && !t.destroyed && edge(u, 0, t, t.radius) <= def.radius);
            return any ? { ok: true } : { ok: false, reason: 'sin_objetivo' };
        }
        return this.specialTarget(u, def) ? { ok: true } : { ok: false, reason: 'sin_objetivo' };
    }
    executeSpecial(u, def) {
        const sp = u.sp;
        const D = sp.dps * def.power;
        const team = u.team;
        const fx = def.effects;
        const tgt = def.delivery === 'aoe' || def.delivery === 'heal' ? null : this.specialTarget(u, def);
        const tx = tgt ? tgt.x : u.x;
        const ty = tgt ? tgt.y : u.y;
        this.emit({ type: 'special', t: this.time, unitId: u.id, team, speciesId: sp.id, def, x: u.x, y: u.y, tx, ty });
        const dx0 = tx - u.x, dy0 = ty - u.y;
        const dl = Math.hypot(dx0, dy0) || 1;
        if (tgt) {
            u.faceX = dx0 / dl;
            u.faceY = dy0 / dl;
        }
        switch (def.delivery) {
            case 'burst': {
                if (!tgt)
                    break;
                const r = def.radius;
                this.hitTarget(tgt, D, def.type, team, u.id, sp.id, def.type, true, TOWER_SPECIAL_MUL, true);
                if (!tgt.isTower && tgt.state !== 'dead')
                    this.applyEffects(fx, tgt, u, u.x, u.y, def.type);
                if (r > 0)
                    this.areaDamage(tgt.x, tgt.y, r, team, D, def.type, def.hits, u.id, sp.id, def.type, true, TOWER_SPECIAL_MUL, tgt, fx, u, def.type);
                break;
            }
            case 'bolt':
                if (tgt) {
                    this.spawnProjectile({
                        team, x: u.x, y: u.y, speed: def.speed, target: tgt, homing: true, dmg: D, atkType: def.type, vType: def.type,
                        radius: 0, effects: fx, hits: def.hits, special: true, srcUnitId: u.id, srcSpeciesId: sp.id,
                        towerMul: TOWER_SPECIAL_MUL, fromTower: false,
                    });
                }
                break;
            case 'lob':
                if (tgt) {
                    this.spawnProjectile({
                        team, x: u.x, y: u.y, speed: def.speed, target: null, tx, ty, homing: false, dmg: D, atkType: def.type,
                        vType: def.type, radius: def.radius, effects: fx, hits: def.hits, special: true, srcUnitId: u.id,
                        srcSpeciesId: sp.id, towerMul: TOWER_SPECIAL_MUL, fromTower: false,
                    });
                }
                break;
            case 'beam': {
                const len = def.range + sp.radius;
                const ex = u.x + (dx0 / dl) * len, ey = u.y + (dy0 / dl) * len;
                // se resuelve sobre una instantánea para que el orden no altere el resultado
                const victims = [];
                for (const e of this.units) {
                    if (e.team === team || e.state === 'dead' || !canHit(def.hits, e))
                        continue;
                    if (segDist(e.x, e.y, u.x, u.y, ex, ey) <= def.radius + e.sp.radius)
                        victims.push(e);
                }
                for (const t of this.towers) {
                    if (t.team === team || t.destroyed)
                        continue;
                    if (segDist(t.x, t.y, u.x, u.y, ex, ey) <= def.radius + t.radius * 0.8)
                        victims.push(t);
                }
                for (const v of victims) {
                    this.hitTarget(v, D, def.type, team, u.id, sp.id, def.type, true, TOWER_SPECIAL_MUL, true);
                    if (!v.isTower && v.state !== 'dead')
                        this.applyEffects(fx, v, u, u.x, u.y, def.type);
                }
                this.emit({ type: 'special', t: this.time, unitId: u.id, team, speciesId: sp.id, def, x: u.x, y: u.y, tx: ex, ty: ey });
                break;
            }
            case 'aoe':
                this.areaDamage(u.x, u.y, def.radius, team, D, def.type, def.hits, u.id, sp.id, def.type, true, TOWER_SPECIAL_MUL, null, fx, u, def.type);
                if (def.selfDestruct)
                    this.killUnit(u, -1, 0);
                break;
            case 'zone':
                if (tgt) {
                    const ticks = Math.max(1, Math.round(def.zoneDur / 0.5));
                    this.zones.push({
                        id: this.nextId++, team, x: tgt.x, y: tgt.y, r: def.radius, t: def.zoneDur, acc: 0, perTick: D / ticks,
                        type: def.type, hits: def.hits, effects: fx, srcUnitId: u.id, srcSpeciesId: sp.id, towerMul: TOWER_SPECIAL_MUL,
                    });
                }
                break;
            case 'heal':
                for (const a of this.units) {
                    if (a.team !== team || a.state === 'dead' || edge(u, 0, a, a.sp.radius) > def.radius)
                        continue;
                    const amt = Math.min(a.maxHp - a.hp, Math.round(a.maxHp * (fx.healPct ?? 0.2)));
                    if (amt > 0) {
                        a.hp += amt;
                        this.emit({ type: 'heal', t: this.time, x: a.x, y: a.y, amount: amt, unitId: a.id });
                    }
                    if (fx.shieldPct) {
                        const shieldItem = this.itemFor(a.team, a.sp.id);
                        const baseDuration = Math.min(3.5, Math.max(1, fx.shieldDur ?? 3));
                        const duration = baseDuration * (shieldItem === 'light_clay' ? 1.15 : 1);
                        const shield = Math.round(a.maxHp * Math.min(0.12, fx.shieldPct));
                        // Refresh only when it improves the remaining protection; never stack shield HP.
                        if (shield > a.shieldHp || a.shieldUntil <= this.time) {
                            a.shieldHp = Math.max(a.shieldHp, shield);
                            a.shieldUntil = Math.max(a.shieldUntil, this.time + duration);
                            this.emit({ type: 'status', t: this.time, unitId: a.id, what: 'shield' });
                        }
                    }
                }
                break;
        }
    }
    /* ───────── torres ───────── */
    towerZoneOk(t, u, current) {
        if (t.kind === 'king')
            return true;
        const m = current ? 0.8 : 0;
        return t.kind === 'left' ? u.x < FLD.centerX + m : u.x >= FLD.centerX - m;
    }
    updateTower(t, dt) {
        if (t.destroyed)
            return;
        if (t.cd > 0)
            t.cd -= dt;
        if (!t.active)
            return;
        if (this.mode === 'training' && t.team === 1 && this.trainingCfg && !this.trainingCfg.enemyTowersAttack)
            return;
        const inReach = (u, current) => u.state !== 'dead' && u.team !== t.team && dist(t.x, t.y, u.x, u.y) - u.sp.radius - (t.kind === 'king' ? t.radius : 0) <= t.range && this.towerZoneOk(t, u, current);
        if (!(t.target && inReach(t.target, true))) {
            t.target = null;
            let bd = Infinity;
            for (const u of this.units) {
                if (!inReach(u, false))
                    continue;
                const d = dist(t.x, t.y, u.x, u.y);
                if (d < bd - 1e-9) {
                    bd = d;
                    t.target = u;
                }
            }
        }
        if (t.target && t.cd <= 0) {
            t.cd = t.interval;
            t.attackAt = this.time;
            this.spawnProjectile({
                team: t.team, x: t.x, y: t.y - (t.team === 0 ? 0.6 : -0.6), speed: t.projSpeed, target: t.target, homing: true,
                dmg: t.dmg, atkType: null, vType: 'normal', radius: 0, effects: {}, hits: 'both', special: false, srcUnitId: 0,
                srcSpeciesId: 0, towerMul: 1, fromTower: true,
            });
        }
    }
    /* ───────── proyectiles y zonas ───────── */
    updateProjectiles(dt) {
        const keep = [];
        for (const p of this.projectiles) {
            p.life -= dt;
            if (p.homing && p.target) {
                if (isAlive(p.target)) {
                    p.tx = p.target.x;
                    p.ty = p.target.y;
                }
                else if (!p.special || p.radius === 0) {
                    p.target = null;
                }
            }
            const dx = p.tx - p.x, dy = p.ty - p.y;
            const d = Math.hypot(dx, dy);
            const step = p.speed * dt;
            const tr = p.target ? radiusOf(p.target) * 0.5 : 0;
            if (d <= step + 0.12 + tr) {
                p.x = p.tx;
                p.y = p.ty;
                this.impact(p);
                continue;
            }
            if (p.life <= 0)
                continue;
            p.x += (dx / d) * step;
            p.y += (dy / d) * step;
            keep.push(p);
        }
        this.projectiles = keep;
    }
    impact(p) {
        const src = p.srcUnitId ? this.unitById(p.srcUnitId) : undefined;
        const team = p.team;
        if (p.homing) {
            // golpe a un objetivo concreto (si murió en vuelo, el proyectil se pierde)
            if (!p.target || !isAlive(p.target))
                return;
            this.hitTarget(p.target, p.dmg, p.atkType, team, p.srcUnitId, p.srcSpeciesId, p.vType, p.special, p.towerMul, true);
            if (src && !p.target.isTower && p.target.state !== 'dead')
                this.applyEffects(p.effects, p.target, src, p.x, p.y, p.vType);
            if (p.radius > 0) {
                this.areaDamage(p.x, p.y, p.radius, team, p.dmg * p.splashFalloff, p.atkType, p.hits, p.srcUnitId, p.srcSpeciesId, p.vType, p.special, p.towerMul, p.target);
            }
        }
        else {
            // proyectil lento de área
            const srcU = src ?? null;
            this.areaDamage(p.x, p.y, p.radius, team, p.dmg, p.atkType, p.hits, p.srcUnitId, p.srcSpeciesId, p.vType, p.special, p.towerMul, null, p.effects, srcU ?? undefined, p.vType);
            this.emit({ type: 'special', t: this.time, unitId: p.srcUnitId, team, speciesId: p.srcSpeciesId, def: { ...{}, delivery: 'lob', type: p.vType, radius: p.radius, name: '', power: 0, range: 0, cd: 0, speed: 0, zoneDur: 0, effects: {}, hits: p.hits, desc: '' }, x: p.x, y: p.y, tx: p.x, ty: p.y });
        }
    }
    updateZones(dt) {
        const keep = [];
        for (const z of this.zones) {
            z.t -= dt;
            z.acc += dt;
            while (z.acc >= 0.5) {
                z.acc -= 0.5;
                const src = this.unitById(z.srcUnitId);
                for (const e of this.units) {
                    if (e.team === z.team || e.state === 'dead' || !canHit(z.hits, e))
                        continue;
                    if (edge({ x: z.x, y: z.y }, 0, e, e.sp.radius) > z.r)
                        continue;
                    this.tickHit = true;
                    this.hitTarget(e, z.perTick, z.type, z.team, z.srcUnitId, z.srcSpeciesId, z.type, true, 1, true);
                    this.tickHit = false;
                    if (src && !isDead(e) && z.effects.slow)
                        this.applyEffects({ slow: [z.effects.slow[0], 1.0] }, e, src, z.x, z.y, z.type);
                }
                for (const t of this.towers) {
                    if (t.team === z.team || t.destroyed)
                        continue;
                    if (edge({ x: z.x, y: z.y }, 0, t, t.radius) > z.r)
                        continue;
                    this.tickHit = true;
                    this.hitTarget(t, z.perTick, z.type, z.team, z.srcUnitId, z.srcSpeciesId, z.type, true, z.towerMul ?? TOWER_SPECIAL_MUL, false);
                    this.tickHit = false;
                }
            }
            if (z.t > 0)
                keep.push(z);
        }
        this.zones = keep;
    }
    cleanup() {
        let any = false;
        for (const u of this.units)
            if (u.state === 'dead' && this.time - u.deadAt > CORPSE_SEC)
                any = true;
        if (any) {
            this.units = this.units.filter((u) => u.state !== 'dead' || this.time - u.deadAt <= CORPSE_SEC);
        }
        for (const u of this.units) {
            if (u.target && !isAlive(u.target))
                u.target = null;
        }
    }
    /* ───────── final de partida ───────── */
    checkEnd() {
        if (this.ended) return;
        const k0 = this.towerOf(0, 'king').destroyed;
        const k1 = this.towerOf(1, 'king').destroyed;
        if (k0 || k1) { if (k0 && k1) this.finishByTiebreak(); else this.finish(k1 ? 0 : 1, 'rey'); return; }
        if (this.endless) return;
        if (this.mod.firstCrownWins && this.crowns[0] !== this.crowns[1]) { this.finish(this.crowns[0] > this.crowns[1] ? 0 : 1, 'corona'); return; }
        if (k0 && k1) {
            this.finishByTiebreak();
        }
        else if (k0 || k1) {
            this.finish(k1 ? 0 : 1, 'rey');
        }
        else if (this.overtime) {
            if (this.crowns[0] !== this.crowns[1])
                this.finish(this.crowns[0] > this.crowns[1] ? 0 : 1, 'subita');
            else if (this.overtimeLeft <= 0)
                this.finishByTiebreak();
        }
        else if (this.timeLeft <= 0) {
            if (this.crowns[0] === this.crowns[1]) {
                this.overtime = true;
                this.overtimeLeft = BC.overtimeSec;
                this.emit({ type: 'phase', t: this.time, name: 'overtime' });
            }
            else
                this.finishByTiebreak();
        }
    }
    /** Empate de torres -> daño acumulado a torres -> empate. Todo determinista. */
    finishByTiebreak() {
        if (this.crowns[0] !== this.crowns[1])
            this.finish(this.crowns[0] > this.crowns[1] ? 0 : 1, 'torres');
        else if (Math.round(this.towerDamage[0]) !== Math.round(this.towerDamage[1])) {
            this.finish(this.towerDamage[0] > this.towerDamage[1] ? 0 : 1, 'dano');
        }
        else
            this.finish(null, 'empate');
    }
    finish(winner, reason) {
        if (this.ended)
            return;
        this.ended = true;
        this.result = {
            matchId: this.matchId, mode: this.mode, winner, reason, crowns: [this.crowns[0], this.crowns[1]],
            towerDamage: [Math.round(this.towerDamage[0]), Math.round(this.towerDamage[1])],
            durationSec: Math.round(Math.min(this.time, this.duration + BC.overtimeSec) * 10) / 10, overtime: this.overtime, arena: this.opts.arena, towerLevel: this.towerLevel, difficulty: this.opts.difficulty, draftMode: this.draftMode,
            usage: { ...this.usage }, kills: { ...this.kills }, deckPlayer: this.opts.playerDeck.slice(),
        };
        this.emit({ type: 'end', t: this.time, result: this.result });
    }
}
