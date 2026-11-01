import { SPECIES } from "../../data/species.js";
import { filterSpecies } from "../../game/filters.js";
import { showDetail } from "../detail.js";
import { h, pokeCard } from "../dom.js";
import { filterBar } from "../filterbar.js";
import { trainingPicker } from "../training.js";
export function coleccionScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    const grid = h('div', { class: 'cards', id: 'collection-grid' });
    const prog = h('div');
    let showVariants = false;
    const variantsToggle = h('button', { class: 'btn btn-blue sm', type: 'button', id: 'show-variants', on: { click: () => { showVariants = !showVariants; variantsToggle.textContent = showVariants ? 'Ver solo colección obtenida' : 'Ver normal + shiny (incluidos bloqueados)'; draw(); } } }, 'Ver normal + shiny (incluidos bloqueados)');
    const bar = filterBar(() => draw(), { status: true });
    const draw = () => {
        const n = p.data.unlocked.length;
        prog.replaceChildren(h('div', { class: 'row between' }, h('b', { id: 'coll-progress' }, `${n}/${SPECIES.length} desbloqueados`), h('span', { class: 'sub' }, `${Math.round((n / SPECIES.length) * 100)} %`)), h('div', { class: 'bar' }, h('i', { style: `width:${(n / SPECIES.length) * 100}%` })));
        grid.replaceChildren();
        const list = filterSpecies(SPECIES, bar.f, (id) => showVariants || p.isUnlocked(id));
        for (const sp of list) {
            const locked = !p.isUnlocked(sp.id);
            const onClick = () => showDetail(p, sp.id, h('button', { class: 'btn btn-blue', type: 'button', on: { click: () => trainingPicker(app, [sp.id]) } }, 'Probar en entrenamiento'));
            if (showVariants) {
                grid.appendChild(pokeCard(sp, { locked, preview: true, shiny: false, level: p.levelOf(sp.id), badge: locked ? 'NORMAL · BLOQUEADO' : 'NORMAL', onClick }));
                grid.appendChild(pokeCard(sp, { locked, preview: true, shiny: true, level: p.levelOf(sp.id), badge: p.hasShiny(sp.id) ? '✨ SHINY OBTENIDO' : '✨ SHINY · BLOQUEADO', onClick }));
            }
            else {
                grid.appendChild(pokeCard(sp, { locked, level: p.levelOf(sp.id), badge: !locked && p.upgradeInfo(sp.id).can ? '¡Mejorable!' : undefined, onClick }));
            }
        }
        if (!list.length)
            grid.appendChild(h('div', { class: 'sub' }, 'Ningún Pokémon coincide con el filtro.'));
    };
    root.append(h('h1', null, 'Colección'), h('section', { class: 'panel stack' }, prog, variantsToggle, h('p', { class: 'sub' }, 'El catálogo de variantes es solo visual: ver un Pokémon bloqueado no lo desbloquea.'), bar.el), h('section', { class: 'panel' }, grid));
    draw();
    app.watch(draw);
    return root;
}
