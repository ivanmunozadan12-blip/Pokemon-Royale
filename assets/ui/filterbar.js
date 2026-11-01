import { RARITIES, RARITY_LABEL } from "../config.js";
import { noFilter } from "../game/filters.js";
import { PTYPES, TYPE_LABEL } from "../data/types.js";
import { h } from "./dom.js";
/** Barra de búsqueda y filtros. Llama a `onChange` sin recrearse (no pierde el foco del teclado). */
export function filterBar(onChange, opts = {}) {
    const f = noFilter();
    const sel = (label, options, set) => h('select', { 'aria-label': label, on: { change: (e) => { set(e.target.value); onChange(f); } } }, options.map(([v, t]) => h('option', { value: v }, t)));
    const el = h('div', { class: 'filters' }, h('input', { class: 'full', type: 'search', placeholder: 'Buscar por nombre o número…', 'aria-label': 'Buscar', autocomplete: 'off',
        on: { input: (e) => { f.q = e.target.value; onChange(f); } } }), sel('Tipo', [['', 'Todos los tipos'], ...PTYPES.map((t) => [t, TYPE_LABEL[t]])], (v) => { f.type = v; }), sel('Rareza', [['', 'Todas las rarezas'], ...RARITIES.map((r) => [r, RARITY_LABEL[r]])], (v) => { f.rarity = v; }), sel('Coste', [['0', 'Cualquier coste'], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => [String(c), `Coste ${c}`])], (v) => { f.cost = Number(v); }), opts.status ? sel('Estado', [['todos', 'Todos'], ['desbloqueados', 'Desbloqueados'], ['bloqueados', 'Bloqueados']], (v) => { f.status = v; }) : null);
    return { el, f };
}
