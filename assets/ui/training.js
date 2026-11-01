import { CONFIG } from "../config.js";
import { SPECIES, getSpecies } from "../data/species.js";
import { filterSpecies } from "../game/filters.js";
import { h, modal, pokeCard, toast } from "./dom.js";
import { filterBar } from "./filterbar.js";
/**
 * Selector de Pokémon para el entrenamiento: puede elegir CUALQUIER especie (también las bloqueadas) porque
 * el entrenamiento no toca monedas, bolas, colección ni estadísticas competitivas.
 */
export function trainingPicker(app, initial, opts = {}) {
    let chosen = initial.slice(0, CONFIG.battle.handSize);
    const grid = h('div', { class: 'pickgrid' });
    const strip = h('div', { class: 'row', style: 'gap:6px;min-height:34px' });
    const go = h('button', { class: 'btn btn-gold', type: 'button', id: 'train-start', disabled: chosen.length < 1 }, opts.change ? 'Aplicar y reiniciar campo' : 'Empezar entrenamiento');
    const bar = filterBar(() => draw());
    const draw = () => {
        strip.replaceChildren(h('b', null, `Mano (${chosen.length}/4): `), ...chosen.map((id) => h('span', { class: 'tchip', style: '--tc:#ffe27a' }, getSpecies(id).nameEs)));
        go.disabled = chosen.length < 1;
        grid.replaceChildren();
        for (const sp of filterSpecies(SPECIES, bar.f, (id) => app.profile.isUnlocked(id))) {
            grid.appendChild(pokeCard(sp, { small: true, selected: chosen.includes(sp.id), locked: false,
                badge: app.profile.isUnlocked(sp.id) ? undefined : 'Prueba',
                onClick: () => {
                    if (chosen.includes(sp.id))
                        chosen = chosen.filter((x) => x !== sp.id);
                    else if (chosen.length < CONFIG.battle.handSize)
                        chosen = [...chosen, sp.id];
                    else
                        toast('Máximo 4 Pokémon en la mano de entrenamiento', 'err');
                    draw();
                } }));
        }
    };
    const m = modal('Entrenamiento libre', h('div', { class: 'stack' }, h('p', { class: 'sub' }, 'Elige hasta 4 Pokémon (aunque estén bloqueados). No gastas monedas ni Poké Balls y no se cuentan recompensas ni estadísticas.'), strip, bar.el, grid), { wide: true, actions: go });
    go.addEventListener('click', () => {
        if (!chosen.length)
            return;
        m.close();
        if (opts.change)
            opts.change(chosen.slice());
        else
            void app.startBattle({ mode: 'training', difficulty: 'facil', deck: chosen.slice(), training: { hand: chosen.slice() } });
    });
    draw();
}
