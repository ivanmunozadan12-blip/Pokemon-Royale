import { CONFIG } from "../config.js";
import { SPECIES, getSpecies } from "./species.js";
const L = CONFIG.cardLevels;
/** Tope por coste (cuanto más cara, más alto). */
export function costCap(cost) {
    return Math.min(L.capMax, L.capBase + Math.ceil(cost / 2));
}
const caps = new Map();
/** Ninguna carta baja de este nivel máximo. */
export const MIN_CAP = 5;
/** Solo se protege frente a cartas con al menos este múltiplo de PODER (vida × DPS) base... */
export const POWER_GAP = 1.6;
/** ...y, para las de coste ≤3 frente a las de coste ≥8, este múltiplo de daño por golpe y de DPS base. */
export const DMG_GAP = 1.3;
/** Cartas que una carta al máximo nunca debe igualar (ver `maxLevel`). */
export function protectedAgainst(sp) {
    const b1 = build(sp.id, 1);
    return {
        power: SPECIES.filter((b) => b.cost >= sp.cost + 3 && power(b) >= power(b1) * POWER_GAP),
        dmg: sp.cost <= 3 ? SPECIES.filter((b) => b.cost >= 8 && b.dps >= b1.dps * DMG_GAP && b.dmg >= b1.dmg * DMG_GAP) : [],
    };
}
/**
 * Nivel máximo de una carta. Parte del tope por coste y se baja lo necesario para garantizar que, al máximo, la carta:
 *  - no iguala en poder (vida × DPS) a ninguna carta que cueste 3 o más que ella y tenga ≥1,6× su poder base, y
 *  - si cuesta 3 o menos, no iguala en daño por golpe ni en DPS a ninguna carta de coste 8 o más con ≥1,3× los suyos.
 * Siempre puede llegar al menos al nivel 5.
 */
export function maxLevel(sp) {
    const hit = caps.get(sp.id);
    if (hit !== undefined)
        return hit;
    const { power: hi3, dmg: hi8 } = protectedAgainst(sp);
    let lv = costCap(sp.cost);
    const ok = (n) => {
        const m = build(sp.id, n);
        return hi3.every((b) => power(m) < power(b) * 0.97) && hi8.every((b) => m.dps < b.dps && m.dmg < b.dmg);
    };
    while (lv > MIN_CAP && !ok(lv))
        lv--;
    caps.set(sp.id, lv);
    return lv;
}
/** Multiplicador de vida y daño de un nivel (nivel 1 = 1). */
export function statMul(level) {
    return 1 + L.perLevel * (Math.max(1, level) - 1);
}
export function towerMul(level) {
    return 1 + CONFIG.towerLevels.perLevel * (Math.max(1, level) - 1);
}
export function copiesNeeded(level) {
    const c = L.copies;
    return c[Math.min(c.length - 1, Math.max(0, level - 1))];
}
export function upgradeCoins(rarity, level) {
    return Math.round(L.coinBase * level * L.coinRarity[rarity]);
}
const cache = new Map();
/** Especie con las estadísticas de su nivel (vida, daño, velocidad de ataque y recarga del especial). */
export function leveled(id, level) {
    const base = getSpecies(id);
    return build(id, Math.max(1, Math.min(maxLevel(base), Math.floor(level) || 1)));
}
/** Aplica el bonus shiny del 20 % a la estadística base más baja, sin mutar el catálogo. */
export function shinyLeveled(id, level) {
    const s = leveled(id, level);
    const stats = s.base;
    const min = Math.min(stats.hp, stats.atk, stats.def, stats.spa, stats.spd, stats.spe);
    const out = { ...s, special: { ...s.special }, base: { ...stats } };
    if (stats.hp === min)
        out.hp = Math.round(out.hp * 1.2);
    else if (stats.atk === min || stats.spa === min) {
        out.dmg = Math.max(1, Math.round(out.dmg * 1.2));
        out.dps = Math.round((out.dmg / out.interval) * 10) / 10;
    }
    else if (stats.spe === min)
        out.speed = Math.round(out.speed * 1.2 * 100) / 100;
    // Si la estadística mínima es defensa, su +20 % se aplica como reducción de daño recibido en hitTarget().
    return out;
}
function build(id, lv) {
    const base = getSpecies(id);
    if (lv === 1)
        return base;
    const key = id * 100 + lv;
    const hit = cache.get(key);
    if (hit)
        return hit;
    const m = statMul(lv);
    const interval = Math.round(base.interval * (1 - L.atkSpeedPerLevel * (lv - 1)) * 1000) / 1000;
    const dmg = Math.max(1, Math.round(base.dmg * m));
    const cd = Math.round(base.special.cd * (1 - L.specialCdPerLevel * (lv - 1)) * 10) / 10;
    const sp = {
        ...base,
        hp: Math.round((base.hp * m) / 5) * 5,
        dmg,
        interval,
        dps: Math.round((dmg / interval) * 10) / 10,
        special: { ...base.special, cd },
    };
    cache.set(key, sp);
    return sp;
}
/** Poder teórico de una carta (vida × DPS), usado por las pruebas de equilibrio. */
export function power(sp) {
    return sp.hp * sp.dps;
}
