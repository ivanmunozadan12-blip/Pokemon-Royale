import { CONFIG, RARITY_LABEL } from '../../config.js';
import { ITEM_CATALOG } from '../../data/items.js';
import { getSpecies } from '../../data/species.js';
import { h, pokeCard, rarityTag, toast } from '../dom.js';

const ITEM_RARITIES = ['poco_comun', 'raro', 'epico'];
const POOL = Object.fromEntries(ITEM_RARITIES.map((r) => [r, ITEM_CATALOG.filter((i) => i.rarity === r).length]));
const REASON = { ocupado: 'Este mazo ya tiene un objeto equipado.', inventario: 'No te quedan copias libres de este objeto.', pokemon: 'Elige un Pokémon del mazo.', mazo: 'Mazo no válido.', objeto: 'Objeto no válido.' };
const num = (n) => String(n).replace('.', ',');

/** Objetos equipables: un objeto por mazo, asignado a un Pokémon. Las reglas de obtención salen de CONFIG.items (mismos números que usa el código). */
export function objetosScreen(app) {
    const root = h('section', { class: 'screen-wrap items-screen' });
    const profile = app.profile;
    let deckIndex = profile.data.activeDeck || 0;
    let selectedPokemon = null;
    const filt = { q: '', rarity: '', status: '' };
    const grid = h('div', { class: 'item-grid', id: 'item-grid' });
    const iconOf = (item) => `assets/items/icons/${String(ITEM_CATALOG.findIndex((x) => x.id === item.id) + 1).padStart(2, '0')}.png`;
    const drawGrid = () => {
        const deck = profile.data.decks[deckIndex];
        const q = filt.q.trim().toLowerCase();
        const list = ITEM_CATALOG.filter((i) => {
            const owned = (profile.data.itemInventory?.[i.id] || 0) > 0;
            return (!q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)) && (!filt.rarity || i.rarity === filt.rarity) && (!filt.status || (filt.status === 'owned' ? owned : !owned));
        });
        grid.replaceChildren(...(list.length ? list.map((item) => {
            const owned = profile.data.itemInventory?.[item.id] || 0;
            const isEquipped = deck?.equippedItem === item.id;
            const free = owned - profile.data.decks.filter((d) => d.equippedItem === item.id).length;
            return h('article', { class: `item-card rar-${item.rarity}${owned > 0 ? ' owned' : ''}`, data: { item: item.id, owned: owned > 0 ? '1' : '0' } }, h('img', { class: 'item-art', src: iconOf(item), alt: item.name, loading: 'lazy' }), h('div', { class: 'item-card-title' }, h('b', null, item.name), rarityTag(item.rarity)), h('p', null, item.description), h('p', { class: 'muted' }, `Obtención: ${RARITY_LABEL[item.rarity]} → 1 de ${POOL[item.rarity]} al azar (${num((100 / POOL[item.rarity]).toFixed(1))} % cada uno) al reunir ${CONFIG.items.thresholds[item.rarity]} puntos.`), h('div', { class: 'item-card-foot' }, h('span', null, owned > 0 ? `✓ Tienes ${owned}${free < owned ? ` (${free} libres)` : ''}` : 'No lo tienes'), isEquipped ? h('span', { class: 'item-status' }, 'Equipado') : owned > 0 ? h('button', { class: 'btn primary', type: 'button', data: { equip: item.id }, disabled: !deck || !!deck.equippedItem || selectedPokemon === null || free < 1, on: { click: () => {
                        const res = profile.equipItem(deckIndex, item.id, selectedPokemon);
                        if (res.ok)
                            toast(`${item.name} equipado.`, 'ok');
                        else
                            toast(REASON[res.reason] ?? 'No se pudo equipar.', 'err');
                    } } }, 'Equipar') : null));
        }) : [h('p', { class: 'muted' }, 'Ningún objeto coincide con el filtro.')]));
    };
    const filters = h('div', { class: 'filters' }, h('input', { class: 'full', type: 'search', placeholder: 'Buscar objeto…', 'aria-label': 'Buscar', autocomplete: 'off', on: { input: (e) => { filt.q = e.target.value; drawGrid(); } } }), h('select', { 'aria-label': 'Rareza', on: { change: (e) => { filt.rarity = e.target.value; drawGrid(); } } }, h('option', { value: '' }, 'Todas las rarezas'), ITEM_RARITIES.map((r) => h('option', { value: r }, RARITY_LABEL[r]))), h('select', { 'aria-label': 'Estado', on: { change: (e) => { filt.status = e.target.value; drawGrid(); } } }, h('option', { value: '' }, 'Todos'), h('option', { value: 'owned' }, 'Poseídos'), h('option', { value: 'missing' }, 'No poseídos')));
    const top = h('div');
    const drawTop = () => {
        const decks = profile.data.decks;
        deckIndex = Math.max(0, Math.min(deckIndex, decks.length - 1));
        const deck = decks[deckIndex];
        const equipped = deck?.equippedItem ? ITEM_CATALOG.find((x) => x.id === deck.equippedItem) : null;
        const sel = h('select', { id: 'items-deck', class: 'input', on: { change: (e) => { deckIndex = Number(e.target.value); selectedPokemon = null; drawAll(); } } }, decks.map((d, i) => h('option', { value: i, selected: i === deckIndex }, d.name || `Mazo ${i + 1}`)));
        const pts = CONFIG.items.points;
        top.replaceChildren(h('div', { class: 'screen-head' }, h('div', null, h('h1', null, 'Objetos equipables'), h('p', null, 'Un único objeto por mazo, asignado a un Pokémon.')), h('span', { class: 'pill' }, `${ITEM_CATALOG.length} objetos`)), h('div', { class: 'panel item-equip-panel' }, h('label', { class: 'field-label', for: 'items-deck' }, 'Mazo'), sel, h('div', { class: 'item-global-slot' }, equipped ? h('div', { class: 'item-equipped' }, h('img', { src: iconOf(equipped), alt: equipped.name }), h('div', null, h('b', null, equipped.name), h('p', null, `Asignado a ${getSpecies(deck.equippedPokemon).nameEs}`), h('p', null, equipped.description), h('button', { class: 'btn', type: 'button', id: 'unequip', on: { click: () => { profile.unequipItem(deckIndex); } } }, 'Quitar objeto'))) : h('p', { class: 'empty-state' }, 'Ranura vacía · elige un objeto que tengas y un Pokémon del mazo.')), h('div', { class: 'field-label' }, 'Pokémon portador (los 8 de este mazo)'), h('div', { class: 'cards deck-grid', id: 'item-carriers', style: 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px' }, (deck?.ids ?? []).map((id) => pokeCard(getSpecies(id), { small: true, inDeck: true, selected: selectedPokemon === id, level: profile.levelOf(id), badge: deck.equippedItem && deck.equippedPokemon === id ? 'Objeto' : undefined, onClick: () => { selectedPokemon = id; drawAll(); } }))), h('p', { class: 'muted' }, 'El objeto afecta exclusivamente al Pokémon seleccionado, no al resto del mazo.')), h('div', { class: 'panel item-progress-panel', id: 'item-progress' }, h('h2', null, 'Cómo se consiguen'), h('p', { class: 'muted' }, `Solo en partidas normales contra la IA (no en entrenamiento ni en modos Draft). Cada resultado suma puntos a las tres rarezas: victoria ${num(pts.win)}, empate ${num(pts.draw)}, derrota ${num(pts.loss)}. Al llegar al objetivo de cada rareza recibes un objeto al azar de esa rareza (todos con la misma probabilidad). Cada rareza tiene su propio contador: al recibir un objeto solo se descuentan los puntos de esa rareza; los otros contadores siguen acumulando. Si varios umbrales se alcanzan en una misma partida, se conceden todos los objetos correspondientes. El progreso se conserva entre sesiones.`), ...ITEM_RARITIES.map((key) => {
            const val = profile.data.itemProgress?.[key] || 0;
            const target = CONFIG.items.thresholds[key];
            const left = Math.max(0, target - val);
            return h('div', { class: 'item-progress-row', data: { rarity: key } }, h('div', { class: 'row between' }, h('b', null, RARITY_LABEL[key]), h('small', null, `${num(Math.floor(val * 100) / 100)}/${target} puntos · faltan ${num(Math.ceil(left * 100) / 100)} (≈ ${Math.ceil(left / pts.win)} victorias) · ${POOL[key]} objetos posibles`)), h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (val / target) * 100)}%` })));
        })));
    };
    const drawAll = () => { drawTop(); drawGrid(); };
    root.append(top, filters, grid);
    const unsub = profile.onChange(drawAll);
    app.onLeave(unsub);
    drawAll();
    return root;
}
