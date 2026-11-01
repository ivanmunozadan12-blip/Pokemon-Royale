import { CONFIG } from "../../config.js";
import { SPECIES, getSpecies } from "../../data/species.js";
import { filterSpecies } from "../../game/filters.js";
import { avgCost } from "../../game/profile.js";
import { showDetail } from "../detail.js";
import { confirmBox, h, pokeCard, toast } from "../dom.js";
import { filterBar } from "../filterbar.js";
const MSG = {
    lleno: 'El mazo ya tiene 8 Pokémon. Quita uno primero.',
    duplicado: 'Ese Pokémon ya está en el mazo.',
    bloqueado: 'Ese Pokémon está bloqueado.',
    limite: 'Máximo 5 mazos.',
    indice: 'Mazo no encontrado.',
};
export function mazosScreen(app) {
    const p = app.profile;
    let idx = p.data.activeDeck;
    let mode = 'editar';
    const root = h('div', { class: 'page' });
    const top = h('div');
    const gridWrap = h('div', { class: 'cards', id: 'deck-pool' });
    const bar = filterBar(() => drawPool());
    const toggle = (id) => {
        const d = p.data.decks[idx];
        const r = d.ids.includes(id) ? p.removeFromDeck(idx, id) : p.addToDeck(idx, id);
        if (!r.ok) {
            app.audio.sfx('error');
            toast(MSG[r.reason] ?? 'No se puede hacer eso', 'err');
        }
        else
            app.audio.sfx('select');
    };
    const drawTop = () => {
        top.replaceChildren();
        const d = p.data.decks[idx];
        const full = d.ids.length === CONFIG.battle.deckSize;
        const active = p.data.activeDeck === idx;
        const slots = h('div', { class: 'slots', id: 'deck-slots' });
        for (let i = 0; i < CONFIG.battle.deckSize; i++) {
            const id = d.ids[i];
            slots.appendChild(id ? pokeCard(getSpecies(id), { small: true, level: p.levelOf(id), upgradeable: p.upgradeInfo(id).can, onClick: () => (mode === 'ficha' ? showDetail(p, id) : toggle(id)) })
                : h('div', { class: 'slot' }, `Hueco ${i + 1}`));
        }
        top.append(h('div', { class: 'tabs', role: 'tablist' }, p.data.decks.map((dk, i) => h('button', { type: 'button', role: 'tab', aria: { selected: i === idx }, on: { click: () => { idx = i; drawTop(); drawPool(); } } }, `${dk.name}${i === p.data.activeDeck ? ' ★' : ''}`)), p.data.decks.length < 5 && h('button', { type: 'button', id: 'new-deck', on: { click: () => {
                    const r = p.createDeck();
                    if (r.ok) {
                        idx = r.index;
                        drawTop();
                        drawPool();
                    }
                    else
                        toast(MSG[r.reason], 'err');
                } } }, '+ Nuevo')), h('section', { class: 'panel' }, h('div', { class: 'row between' }, h('input', { type: 'text', value: d.name, maxlength: '24', 'aria-label': 'Nombre del mazo', style: 'max-width:200px',
            on: { change: (e) => { if (!p.renameDeck(idx, e.target.value))
                    toast('Nombre no válido', 'err'); drawTop(); } } }), h('span', null, h('b', { id: 'deck-count' }, `${d.ids.length}/8`), ' · ', h('span', { class: 'avg', id: 'deck-avg' }, `Coste medio ${avgCost(d.ids)}`))), slots, h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn btn-gold', type: 'button', id: 'use-deck', disabled: !full || active, on: { click: () => { p.setActiveDeck(idx); toast(`"${d.name}" es ahora tu mazo activo`, 'ok'); } } }, active ? 'Mazo activo ✓' : 'Usar este mazo'), h('button', { class: 'btn btn-red sm', type: 'button', disabled: p.data.decks.length <= 1, on: { click: async () => {
                    if (await confirmBox('Borrar mazo', `¿Borrar "${d.name}"?`, 'Borrar', true)) {
                        p.deleteDeck(idx);
                        idx = Math.min(idx, p.data.decks.length - 1);
                        drawTop();
                        drawPool();
                    }
                } } }, 'Borrar'), h('span', { class: 'sub', id: 'deck-msg' }, full ? (active ? 'Listo para batalla' : 'Mazo completo: pulsa "Usar este mazo"') : `Faltan ${8 - d.ids.length} Pokémon para poder jugar con este mazo`)), h('div', { class: 'seg', style: 'margin-top:8px' }, h('button', { type: 'button', aria: { pressed: mode === 'editar' }, on: { click: () => { mode = 'editar'; drawTop(); drawPool(); } } }, 'Tocar: añadir/quitar'), h('button', { type: 'button', aria: { pressed: mode === 'ficha' }, on: { click: () => { mode = 'ficha'; drawTop(); drawPool(); } } }, 'Tocar: ver ficha'))));
    };
    const drawPool = () => {
        gridWrap.replaceChildren();
        const d = p.data.decks[idx];
        const list = filterSpecies(SPECIES, { ...bar.f, status: 'desbloqueados' }, (id) => p.isUnlocked(id));
        for (const sp of list) {
            const inDeck = d.ids.includes(sp.id);
            gridWrap.appendChild(pokeCard(sp, { inDeck, level: p.levelOf(sp.id), upgradeable: p.upgradeInfo(sp.id).can, badge: inDeck ? 'En mazo' : undefined,
                onClick: () => (mode === 'ficha' ? showDetail(p, sp.id) : toggle(sp.id)) }));
        }
        if (!list.length)
            gridWrap.appendChild(h('div', { class: 'sub' }, 'Ningún Pokémon desbloqueado coincide con el filtro.'));
    };
    root.append(h('h1', null, 'Mazos'), top, h('section', { class: 'panel' }, h('h3', null, 'Tus Pokémon desbloqueados'), bar.el, gridWrap));
    const refresh = () => { drawTop(); drawPool(); };
    refresh();
    app.watch(refresh);
    return root;
}
