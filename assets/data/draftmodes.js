/**
 * Los 11 modos Draft. Son partidas contra la IA con una baraja temporal y reglas especiales; NUNCA dan ni quitan trofeos.
 * `mods` son los modificadores que entiende la simulación (sim/battle.js · normalizeModifiers).
 * `deck`: 'pick' = eliges 8 de 16 · 'random' = baraja sorteada · 'mirror' = tú y la IA con la misma baraja sorteada.
 */
export const DRAFT_MODES = Object.freeze([
    { id: 'aleatorio', name: 'Aleatorio', deck: 'random', mods: {}, desc: 'Reglas sorteadas de forma simétrica: ambos bandos comparten tipo, rareza, clima y modificadores para evitar ventajas de sorteo.' },
    { id: 'draft', name: 'Draft', deck: 'pick', mods: {}, desc: 'Elige 8 Pokémon entre 16 sorteados. Reglas normales.' },
    { id: 'caos', name: 'Caos', deck: 'random', mods: {}, desc: 'Se sortea tu baraja de 8 Pokémon. Reglas normales.' },
    { id: 'espejo', name: 'Espejo', deck: 'mirror', mods: {}, desc: 'Tú y la IA jugáis con la misma baraja sorteada: gana la mejor estrategia.' },
    { id: 'elixir2', name: 'Elixir x2', deck: 'random', mods: { energyMul: 2 }, desc: 'La energía se recarga el doble de rápido para los dos bandos durante toda la partida.' },
    { id: 'elixir3', name: 'Elixir x3', deck: 'random', mods: { energyMul: 3 }, desc: 'La energía se recarga el triple de rápido para los dos bandos.' },
    { id: 'elixir_acelerado', name: 'Elixir acelerado', deck: 'random', mods: { energyRamp: [[0, 1], [60, 2], [120, 3]] }, desc: 'La recarga de energía sube con el tiempo: normal el primer minuto, doble el segundo y triple el tercero.' },
    { id: 'coste_reducido', name: 'Coste reducido', deck: 'random', mods: { costDelta: -1 }, desc: 'Todos los Pokémon cuestan 1 de energía menos (mínimo 1) para los dos bandos.' },
    { id: 'aleatorios', name: 'Pokémon aleatorios', deck: 'random', mods: { randomSpawn: true }, desc: 'Cada carta que juegas invoca un Pokémon aleatorio del mismo coste (también la IA). Sorpresa garantizada.' },
    { id: 'ataques_acelerados', name: 'Ataques acelerados', deck: 'random', mods: { attackSpeedMul: 1.5 }, desc: 'Todos los Pokémon atacan un 50 % más rápido y recargan antes su especial.' },
    { id: 'supervivencia', name: 'Supervivencia', deck: 'random', mods: { firstCrownWins: true }, desc: 'Muerte súbita desde el principio: gana quien destruya primero una torre. Si se acaba el tiempo, rige el desempate normal.' },
]);
export const DRAFT_MODE_BY_ID = new Map(DRAFT_MODES.map((m) => [m.id, m]));
/** Normaliza y limita los modificadores (también los recibidos por red o guardado): valores fuera de rango se ignoran. */
export function normalizeModifiers(m) {
    const n = { energyMul: 1, energyRamp: null, costDelta: 0, attackSpeedMul: 1, randomSpawn: false, firstCrownWins: false };
    if (!m || typeof m !== 'object')
        return n;
    const clamp = (v, lo, hi, d) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
    n.energyMul = clamp(m.energyMul, 1, 3, 1);
    n.costDelta = Math.round(clamp(m.costDelta, -2, 0, 0));
    n.attackSpeedMul = clamp(m.attackSpeedMul, 1, 2, 1);
    n.randomSpawn = m.randomSpawn === true;
    n.firstCrownWins = m.firstCrownWins === true;
    if (Array.isArray(m.energyRamp) && m.energyRamp.length <= 8)
        n.energyRamp = m.energyRamp.map((p) => [clamp(p?.[0], 0, 1000, 0), clamp(p?.[1], 1, 3, 1)]).sort((a, b) => a[0] - b[0]);
    return n;
}
