import { TUNE } from "./tune.js";
import { CONFIG } from "../config.js";
import { RAW } from "./pokedex-raw.js";
import { BASIC_NAMES, BASIC_OVERRIDE, SPECIAL_OVERRIDE, SPECIAL_POOL } from "./moves.js";
import { resistancesOf, weaknessesOf } from "./types.js";
const B = CONFIG.balance;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function costFromBst(bst) {
    for (const [lim, c] of B.costByBst)
        if (bst <= lim)
            return c;
    return B.maxCost;
}
export function rarityFromBst(id, bst) {
    if (CONFIG.legendaryIds.includes(id))
        return 'legendario';
    const t = CONFIG.rarityBst;
    if (bst >= t.epico)
        return 'epico';
    if (bst >= t.raro)
        return 'raro';
    if (bst >= t.poco_comun)
        return 'poco_comun';
    return 'comun';
}
function roleOf(r, ranged, flying, speed, cost, splash) {
    if (cost <= 2 && speed >= 1.5)
        return 'Hostigador veloz';
    if (r >= 1.6)
        return ranged ? 'Tanque a distancia' : 'Tanque';
    if (ranged && r < 0.8)
        return flying ? 'Artillero aéreo' : 'Artillero frágil';
    if (ranged)
        return flying ? 'Atacante aéreo' : splash > 0 ? 'Atacante de área' : 'Atacante a distancia';
    if (flying)
        return 'Cazador aéreo';
    if (r < 0.85)
        return 'Asaltante';
    return 'Luchador equilibrado';
}
const ROLE_TEXT = {
    'Hostigador veloz': 'barato y escurridizo: presiona y distrae.',
    Tanque: 'aguanta muchísimo daño, pero golpea poco.',
    'Tanque a distancia': 'resistente y con ataques a distancia constantes.',
    'Artillero frágil': 'gran daño a distancia, se rompe con facilidad.',
    'Artillero aéreo': 'castiga desde el aire con poca resistencia.',
    'Atacante aéreo': 'vuela y ataca a distancia.',
    'Atacante de área': 'sus golpes alcanzan a varias unidades.',
    'Atacante a distancia': 'dispara desde lejos con buen equilibrio.',
    'Cazador aéreo': 'vuela directo a por el rival y golpea tierra y aire.',
    Asaltante: 'mucho daño a corta distancia a cambio de vida.',
    'Luchador equilibrado': 'cuerpo a cuerpo con vida y daño parejos.',
};
function derive(row) {
    const [id, nameEs, slug, t1, t2, hp, atk, def, spa, spd, spe, size, flags] = row;
    const types = t2 ? [t1, t2] : [t1];
    const bst = hp + atk + def + spa + spd + spe;
    const cost = costFromBst(bst);
    const flying = flags.includes('A');
    const reach = flags.includes('W');
    const ranged = flags.includes('R') || (!reach && spa >= atk * 0.98);
    const splash = flags.includes('S') ? 1.1 : 0;
    const heavy = flags.includes('H');
    const range = ranged ? clamp(3.0 + (spa / 130) * 3.4, 3.0, 6.4) : reach ? 2.2 : 0.4;
    const targets = flying || ranged ? 'both' : 'ground';
    const speed = clamp((B.speed.base + B.speed.span * Math.pow(spe / 130, B.speed.exp)) * (heavy ? B.speed.heavyMul : 1) * (ranged ? B.speed.rangedMul : 1), B.speed.min, B.speed.max);
    let V = B.vBase * Math.pow(cost, B.vExp) * (TUNE[id] ?? 1);
    if (ranged)
        V *= B.rangedVMul - 0.02 * (range - 3);
    if (flying)
        V *= B.airVMul;
    if (splash > 0)
        V *= B.splashVMul;
    if (speed > 1.8)
        V *= B.fastVMul;
    const bulk = hp + 0.5 * def + 0.5 * spd;
    const off = 0.9 * Math.max(atk, spa) + 0.1 * Math.min(atk, spa);
    const r = clamp(bulk / 100 / (off / 75), 0.25, 6);
    const hpGame = Math.round(Math.sqrt(V * B.hpK * Math.pow(r, B.shapeExp)) / 5) * 5;
    const dpsRaw = V / hpGame;
    const interval = Math.round(clamp(1.75 - spe * 0.0075, 0.8, 1.7) * 100 + (ranged ? 20 : 0)) / 100;
    const dmg = Math.max(3, Math.round(dpsRaw * interval));
    const sizeClass = size;
    const radius = B.sizeRadius[sizeClass];
    const mass = Math.round((0.3 + radius * radius * 2) * (1 + hpGame / 1500) * 100) / 100;
    const special = SPECIAL_OVERRIDE[id] ?? SPECIAL_POOL[t1][id % 3];
    const names = BASIC_NAMES[t1];
    const attackName = BASIC_OVERRIDE[id] ?? (ranged ? names.ranged : names.melee);
    const role = roleOf(r, ranged, flying, speed, cost, splash);
    const base = { hp, atk, def, spa, spd, spe };
    const sp = special.pool
        ? { ...special, desc: `Lanza un ataque al azar entre ${special.pool.map((p) => p.name).join(', ')}. Recarga ${special.cd} s.` }
        : special;
    return {
        id, nameEs, slug, types, rarity: rarityFromBst(id, bst), cost, hp: hpGame,
        attackName, attackType: t1, damageKind: ranged ? 'especial' : 'fisico',
        dmg, interval, range: Math.round(range * 100) / 100, ranged,
        projectileSpeed: ranged ? 11 : 0, splash, targets, speed: Math.round(speed * 100) / 100, flying,
        special: sp, weak: weaknessesOf(types), resist: resistancesOf(types),
        sizeClass, heightTiles: B.sizeTiles[sizeClass], radius, mass,
        role, desc: `${role}: ${ROLE_TEXT[role]}`, base, bst,
        dps: Math.round((dmg / interval) * 10) / 10,
    };
}
export const SPECIES = RAW.map(derive);
const BY_ID = new Map(SPECIES.map((s) => [s.id, s]));
export function getSpecies(id) {
    const s = BY_ID.get(id);
    if (!s)
        throw new Error(`Especie desconocida: ${id}`);
    return s;
}
export function hasSpecies(id) {
    return BY_ID.has(id);
}
export const TARGET_LABEL = { ground: 'Solo terrestres', air: 'Solo aéreos', both: 'Tierra y aire' };
/** Comprobaciones de integridad usadas por las pruebas y por el arranque en modo desarrollo. */
export function validateSpecies(s) {
    const p = [];
    const num = (k, v, lo, hi) => {
        if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)
            p.push(`${k}=${v} fuera de [${lo},${hi}]`);
    };
    num('id', s.id, 1, 151);
    num('cost', s.cost, 1, B.maxCost);
    num('hp', s.hp, 100, 4000);
    num('dmg', s.dmg, 3, 600);
    num('interval', s.interval, 0.5, 3);
    num('range', s.range, 0.1, 8);
    num('speed', s.speed, 0.3, 3);
    num('radius', s.radius, 0.2, 1.2);
    num('dps', s.dps, 5, 400);
    num('special.cd', s.special.cd, 1, 120);
    num('special.power', s.special.power, 0, 12);
    if (!s.nameEs || !s.slug)
        p.push('sin nombre');
    if (s.types.length < 1 || s.types.length > 2)
        p.push('tipos');
    if (!s.attackName || !s.special.name || !s.desc)
        p.push('textos vacíos');
    if (!['ground', 'air', 'both'].includes(s.targets))
        p.push('targets');
    return p;
}
