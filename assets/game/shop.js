import { CONFIG } from "../config.js";
import { SPECIES } from "../data/species.js";
import { Rng } from "../sim/rng.js";

/** Reglas puras de la tienda diaria (sin acceso a guardado ni reloj): misma fecha -> misma tienda. */
export const SHOP_LAYOUT = ['comun', 'comun', 'comun', 'poco_comun', 'poco_comun', 'raro'];

export function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
const parts = (dayKey) => dayKey.split('-').map(Number);
/** Día de la semana (0 = lunes … 6 = domingo) de una clave AAAA-MM-DD. */
export function weekdayIndex(dayKey) {
    const [y, m, d] = parts(dayKey);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return (wd + 6) % 7;
}
/** Semana ISO (AAAA-Www) de una clave AAAA-MM-DD; el lunes empieza la semana. */
export function isoWeekKey(dayKey) {
    const [y, m, d] = parts(dayKey);
    const x = new Date(Date.UTC(y, m - 1, d));
    x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
    const yy = x.getUTCFullYear();
    const week = Math.ceil((((x.getTime() - Date.UTC(yy, 0, 1)) / 86400000) + 1) / 7);
    return `${yy}-W${String(week).padStart(2, '0')}`;
}
/** Un legendario real (clasificación de config.legendaryIds / rareza 'legendario') nunca se vende. */
export const isSellable = (s) => s.rarity !== 'legendario' && !CONFIG.legendaryIds.includes(s.id);
/** Día de la semana (0-6) de la aparición épica; null si esa semana no tiene épico.
 * La probabilidad y el día quedan fijados por semana ISO, por lo que recargar o cambiar la hora
 * del dispositivo no permite volver a sortear la misma semana.
 */
export function epicWeekday(weekKey) {
    const chance = Math.max(0, Math.min(1, Number(CONFIG.dailyOffers.weeklyEpicChance) || 0));
    const roll = hashStr(`epico-probabilidad:${weekKey}`) / 0x100000000;
    if (roll >= chance) return null;
    return hashStr(`epico-dia:${weekKey}`) % 7;
}
export function epicOfWeek(weekKey) {
    const pool = SPECIES.filter((s) => s.rarity === 'epico' && isSellable(s));
    return new Rng(hashStr(`epico:${weekKey}`)).pick(pool).id;
}
export function priceOf(rarity) {
    return CONFIG.dailyOffers.price[rarity];
}
/** Las 6 ofertas de un día: 3 comunes, 2 poco comunes y 1 raro (o el épico semanal ese día). Pueden ser Pokémon ya poseídos. */
export function buildShop(dayKey) {
    const rng = new Rng(hashStr(`tienda:${dayKey}`));
    const week = isoWeekKey(dayKey);
    const epicDay = weekdayIndex(dayKey) === epicWeekday(week);
    const slots = [];
    const used = new Set();
    for (const r of SHOP_LAYOUT) {
        if (r === 'raro' && epicDay) {
            const id = epicOfWeek(week);
            used.add(id);
            slots.push({ id, rarity: 'epico', price: priceOf('epico') });
            continue;
        }
        const pool = SPECIES.filter((s) => s.rarity === r && isSellable(s) && !used.has(s.id));
        const id = rng.pick(pool).id;
        used.add(id);
        slots.push({ id, rarity: r, price: priceOf(r) });
    }
    return slots;
}
