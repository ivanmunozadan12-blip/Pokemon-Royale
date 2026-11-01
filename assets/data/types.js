import { CONFIG } from "../config.js";
export const PTYPES = [
    'normal', 'fuego', 'agua', 'electrico', 'planta', 'hielo', 'lucha', 'veneno', 'tierra',
    'volador', 'psiquico', 'bicho', 'roca', 'fantasma', 'dragon', 'siniestro', 'acero', 'hada',
];
export const TYPE_LABEL = {
    normal: 'Normal', fuego: 'Fuego', agua: 'Agua', electrico: 'Eléctrico', planta: 'Planta',
    hielo: 'Hielo', lucha: 'Lucha', veneno: 'Veneno', tierra: 'Tierra', volador: 'Volador',
    psiquico: 'Psíquico', bicho: 'Bicho', roca: 'Roca', fantasma: 'Fantasma', dragon: 'Dragón',
    siniestro: 'Siniestro', acero: 'Acero', hada: 'Hada',
};
export const TYPE_COLOR = {
    normal: '#a8a878', fuego: '#f08030', agua: '#6890f0', electrico: '#f8d030', planta: '#78c850',
    hielo: '#98d8d8', lucha: '#c03028', veneno: '#a040a0', tierra: '#e0c068', volador: '#a890f0',
    psiquico: '#f85888', bicho: '#a8b820', roca: '#b8a038', fantasma: '#705898', dragon: '#7038f8',
    siniestro: '#705848', acero: '#b8b8d0', hada: '#ee99ac',
};
/** Efectividad oficial: ATACANTE -> DEFENSOR (solo las entradas distintas de 1). */
const CHART = {
    normal: { roca: 0.5, acero: 0.5, fantasma: 0 },
    fuego: { planta: 2, hielo: 2, bicho: 2, acero: 2, fuego: 0.5, agua: 0.5, roca: 0.5, dragon: 0.5 },
    agua: { fuego: 2, tierra: 2, roca: 2, agua: 0.5, planta: 0.5, dragon: 0.5 },
    electrico: { agua: 2, volador: 2, electrico: 0.5, planta: 0.5, dragon: 0.5, tierra: 0 },
    planta: { agua: 2, tierra: 2, roca: 2, fuego: 0.5, planta: 0.5, veneno: 0.5, volador: 0.5, bicho: 0.5, dragon: 0.5, acero: 0.5 },
    hielo: { planta: 2, tierra: 2, volador: 2, dragon: 2, fuego: 0.5, agua: 0.5, hielo: 0.5, acero: 0.5 },
    lucha: { normal: 2, hielo: 2, roca: 2, siniestro: 2, acero: 2, veneno: 0.5, volador: 0.5, psiquico: 0.5, bicho: 0.5, fantasma: 0 },
    veneno: { planta: 2, veneno: 0.5, tierra: 0.5, roca: 0.5, fantasma: 0.5, acero: 0 },
    tierra: { fuego: 2, electrico: 2, veneno: 2, roca: 2, acero: 2, planta: 0.5, bicho: 0.5, volador: 0 },
    volador: { planta: 2, lucha: 2, bicho: 2, electrico: 0.5, roca: 0.5, acero: 0.5 },
    psiquico: { lucha: 2, veneno: 2, psiquico: 0.5, acero: 0.5, siniestro: 0 },
    bicho: { planta: 2, psiquico: 2, siniestro: 2, fuego: 0.5, lucha: 0.5, veneno: 0.5, volador: 0.5, fantasma: 0.5, acero: 0.5 },
    roca: { fuego: 2, hielo: 2, volador: 2, bicho: 2, lucha: 0.5, tierra: 0.5, acero: 0.5 },
    fantasma: { psiquico: 2, fantasma: 2, siniestro: 0.5, acero: 0.5, normal: 0 },
    dragon: { dragon: 2, acero: 0.5 },
    siniestro: { psiquico: 2, fantasma: 2, lucha: 0.5, siniestro: 0.5, acero: 0.5 },
    acero: { hielo: 2, roca: 2, fuego: 0.5, agua: 0.5, electrico: 0.5, acero: 0.5 },
    hada: { lucha: 2, dragon: 2, siniestro: 2, fuego: 0.5, veneno: 0.5, acero: 0.5 },
};
/** Multiplicador oficial (producto sobre los tipos del defensor): 0, 0.25, 0.5, 1, 2, 4. */
export function rawEffectiveness(atk, defTypes) {
    let m = 1;
    const fairyDefense = { lucha: 0.5, bicho: 0.5, siniestro: 0.5, dragon: 0, veneno: 2, acero: 2 };
    for (const d of defTypes) {
        if (d === 'hada') m *= fairyDefense[atk] ?? 1;
        else m *= CHART[atk]?.[d] ?? 1;
    }
    return m;
}
/**
 * Multiplicador de DAÑO del juego. Se comprime la escala oficial para que ningún combate se decida por una
 * única ventaja de tipo:   x4 -> 1.6 (tope)   x2 -> 1.35   x1 -> 1   x0.5 -> 0.74   x0.25 -> 0.55 (suelo)   x0 -> 0.4
 */
export function typeMult(atk, defTypes) {
    const raw = rawEffectiveness(atk, defTypes);
    const b = CONFIG.balance;
    if (raw === 0)
        return b.typeImmune;
    const g = Math.pow(raw, b.typeExp);
    return Math.min(b.typeMax, Math.max(b.typeMin, g));
}
/** Tipos de ataque contra los que un defensor es débil (>1) o resistente (<1) según la tabla oficial. */
export function weaknessesOf(defTypes) {
    return PTYPES.filter((t) => rawEffectiveness(t, defTypes) > 1);
}
export function resistancesOf(defTypes) {
    return PTYPES.filter((t) => rawEffectiveness(t, defTypes) < 1);
}
