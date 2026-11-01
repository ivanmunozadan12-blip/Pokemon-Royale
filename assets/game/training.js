import { CONFIG } from "../config.js";
/**
 * Reglas puras del entrenamiento permanente (sin DOM ni almacenamiento): se usan desde el perfil, el guardado, la simulación,
 * el servidor multijugador y las pruebas, de modo que el tope del 8 % y el límite de 3 estadísticas se impongan SIEMPRE en la lógica.
 */
export const TRAIN_STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
export const TRAIN_LABEL = { hp: 'PS', atk: 'Ataque', def: 'Defensa', spa: 'At. Esp.', spd: 'Def. Esp.', spe: 'Velocidad' };
const T = CONFIG.training;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Nivel de entrenamiento válido (entero entre 0 y el máximo). Cualquier valor raro (NaN, texto, negativo) cuenta como 0. */
export function cleanLevel(v) {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? clamp(Math.floor(n), 0, T.maxLevel) : 0;
}
/** Copia segura de los puntos de un Pokémon: solo las 6 estadísticas, enteros entre 0 y `maxLevel`. */
export function cleanLevels(raw) {
    const out = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (raw && typeof raw === 'object' && !Array.isArray(raw))
        for (const k of TRAIN_STATS)
            out[k] = cleanLevel(raw[k]);
    return out;
}
/** Porcentaje total de mejora de una estadística (nunca supera el máximo permitido). */
export function bonusPercent(level) {
    return cleanLevel(level) * T.percentPerLevel;
}
/** Multiplicador sobre la estadística base: 1 + puntos·1 %, con tope en maxLevel. */
export function statFactor(level) {
    return 1 + bonusPercent(level) / 100;
}
/** Estadísticas elegidas: las ya guardadas en `chosen` más cualquiera con puntos (compatibilidad con guardados antiguos). */
export function chosenStats(levels, chosen) {
    const set = new Set();
    for (const k of Array.isArray(chosen) ? chosen : [])
        if (TRAIN_STATS.includes(k))
            set.add(k);
    for (const k of TRAIN_STATS)
        if (levels[k] > 0)
            set.add(k);
    return TRAIN_STATS.filter((k) => set.has(k));
}
export function totalLevels(levels) {
    return TRAIN_STATS.reduce((a, k) => a + levels[k], 0);
}
/** ¿Se puede empezar a entrenar `stat`? Sí si ya estaba elegida o si todavía quedan huecos entre las `maxStats`. */
export function isStatLocked(stat, levels, chosen) {
    const c = chosenStats(levels, chosen);
    // Guardados antiguos podían traer más estadísticas entrenadas que el nuevo límite.
    // Conservamos todos sus puntos, pero solo las primeras maxStats (orden estable TRAIN_STATS)
    // siguen siendo entrenables; las demás quedan bloqueadas sin borrar el progreso histórico.
    if (c.length > T.maxStats)
        return !c.slice(0, T.maxStats).includes(stat);
    return !c.includes(stat) && c.length >= T.maxStats;
}
export function successChance(level) {
    return Math.max(T.chanceMin, T.chanceBase - T.chancePerLevel * cleanLevel(level));
}
const at = (arr, i) => arr[Math.min(arr.length - 1, Math.max(0, i))];
/** Coste de UN intento de subir `stat` un punto. Todo entero y mayor que 0 en monedas. */
export function trainingCost(species, stat, levels) {
    const lv = cleanLevel(levels[stat]);
    const cardFactor = clamp(species.cost / 3, T.cardCostMin, T.cardCostMax);
    const raw = T.coinBase * cardFactor * at(T.stageMul, lv) * (T.statMul[stat] ?? 1) * (1 + T.progressMulPerLevel * totalLevels(levels));
    const coins = Math.max(5, Math.round(raw / 5) * 5);
    return { coins, crystals: at(T.crystals, lv), medals: at(T.medals, lv), cores: at(T.cores, lv) };
}
/** Estado completo de entrenamiento de un Pokémon (para la interfaz y para validar compras). */
export function trainingSummary(species, rawLevels, rawChosen) {
    const levels = cleanLevels(rawLevels);
    const chosen = chosenStats(levels, rawChosen);
    const stats = TRAIN_STATS.map((stat) => {
        const level = levels[stat];
        const locked = isStatLocked(stat, levels, chosen);
        const maxed = level >= T.maxLevel;
        return { stat, level, max: T.maxLevel, bonus: bonusPercent(level), base: species.base[stat], locked, maxed, chance: successChance(level), cost: maxed ? null : trainingCost(species, stat, levels) };
    });
    return { levels, chosen, total: totalLevels(levels), maxStats: T.maxStats, legacy: chosen.length > T.maxStats, stats };
}
