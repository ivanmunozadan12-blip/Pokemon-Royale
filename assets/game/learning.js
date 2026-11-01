import { maxLevel } from "../data/levels.js";
import { getSpecies } from "../data/species.js";
import { LEARN_BASICS, LEARN_SPECIALS } from "../data/learnsets.js";
import { SPECIAL_OVERRIDE, SPECIAL_POOL } from "../data/moves.js";

/**
 * Aprendizaje de ataques (reglas puras, usadas por el perfil, la interfaz y la simulación).
 *
 *  · Los candidatos salen de data/learnsets.js, generado desde los CSV oficiales de PokeAPI: solo movimientos que ese Pokémon puede
 *    aprender en los juegos, del tipo de la especie, de daño directo y con el mismo alcance (contacto = cuerpo a cuerpo).
 *  · Ataque básico: se puede cambiar al llegar a la MITAD del nivel máximo de la carta (mín. 3), p. ej. nivel 6 de 12.
 *    Ataque especial: al llegar al nivel MÁXIMO de la carta. (El documento pedía nivel 10 y 20; el nivel máximo real de las
 *    cartas es 5-12, así que se escala: el especial siempre exige más nivel que el básico.)
 *  · Los efectos secundarios de los juegos (quemar, paralizar…) NO se aplican; el combate usa tipo, categoría y daño.
 *  · Equilibrio: un básico nuevo sube el daño como máximo un 10 % según su potencia oficial (60 = +2,5 %, 120 = +10 %);
 *    un especial nuevo debe valer entre 0,85× y 1,4× el actual (potencia / recarga).
 */
export const BASIC_MAX_BONUS = 0.10;
export const BASIC_MIN_POWER = 60;
export const SPECIAL_SCORE_RANGE = [0.85, 1.4];
export const MAX_CANDIDATES = 4;

export const basicLevelOf = (id) => Math.max(3, Math.round(maxLevel(getSpecies(id)) / 2));
export const specialLevelOf = (id) => Math.max(basicLevelOf(id) + 1, maxLevel(getSpecies(id)));
export const basicBonus = (power) => BASIC_MAX_BONUS * (Math.min(120, Math.max(40, power)) - 40) / 80;

const SPECIAL_DEFS = new Map();
for (const list of Object.values(SPECIAL_POOL))
    for (const d of list)
        SPECIAL_DEFS.set(d.name, d);
for (const d of Object.values(SPECIAL_OVERRIDE)) {
    if (d.pool)
        for (const p of d.pool)
            SPECIAL_DEFS.set(p.name, p);
    else
        SPECIAL_DEFS.set(d.name, d);
}
export const specialDef = (name) => SPECIAL_DEFS.get(name) ?? null;
const scoreOf = (d) => d.power / d.cd;
const currentScore = (sp) => (sp.pool ? sp.pool.reduce((a, p) => a + scoreOf(p), 0) / sp.pool.length : scoreOf(sp));

/** Candidatos de ataque básico (ya filtrados y ordenados de mayor a menor potencia). */
export function basicCandidates(id) {
    const base = getSpecies(id);
    const out = [];
    for (const m of LEARN_BASICS[id] ?? []) {
        if (m.contact === base.ranged || m.power < BASIC_MIN_POWER || m.name === base.attackName)
            continue;
        out.push({ ...m, bonus: basicBonus(m.power) });
    }
    return out.slice(0, MAX_CANDIDATES);
}
/** Candidatos de ataque especial (definiciones del propio juego con nombre y datos oficiales). */
export function specialCandidates(id) {
    const base = getSpecies(id);
    const cur = base.special;
    const names = new Set(cur.pool ? cur.pool.map((p) => p.name) : [cur.name]);
    const ref = currentScore(cur);
    const out = [];
    for (const n of LEARN_SPECIALS[id] ?? []) {
        const d = SPECIAL_DEFS.get(n);
        if (!d || names.has(n) || d.delivery === 'heal' || (d.selfDestruct && !cur.selfDestruct))
            continue;
        const r = scoreOf(d) / ref;
        if (r < SPECIAL_SCORE_RANGE[0] || r > SPECIAL_SCORE_RANGE[1])
            continue;
        out.push({ name: n, def: d, ratio: r });
    }
    out.sort((a, b) => b.ratio - a.ratio || a.name.localeCompare(b.name, 'es'));
    return out.slice(0, MAX_CANDIDATES);
}
/**
 * Aplica los ataques aprendidos a una especie ya escalada a su nivel. `learned` = { basic: idMovimiento, special: nombre }.
 * Se valida TODO (candidato real y nivel mínimo): datos manipulados o de un rival no cambian nada.
 */
export function applyLearned(sp, learned, level) {
    if (!learned)
        return sp;
    const id = sp.id;
    let out = sp;
    if (Number.isInteger(learned.basic) && level >= basicLevelOf(id)) {
        const m = basicCandidates(id).find((c) => c.id === learned.basic);
        if (m) {
            const dmg = Math.max(1, Math.round(out.dmg * (1 + m.bonus)));
            out = { ...out, attackName: m.name, attackType: m.type, damageKind: m.kind, dmg, dps: Math.round((dmg / out.interval) * 10) / 10 };
        }
    }
    if (typeof learned.special === 'string' && level >= specialLevelOf(id)) {
        const c = specialCandidates(id).find((x) => x.name === learned.special);
        if (c) {
            const factor = sp.special.cd / getSpecies(id).special.cd;
            out = { ...out, special: { ...c.def, pool: undefined, cd: Math.round(c.def.cd * factor * 10) / 10 } };
        }
    }
    return out;
}
