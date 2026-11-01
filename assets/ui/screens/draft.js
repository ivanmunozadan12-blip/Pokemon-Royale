import { SPECIES, getSpecies } from "../../data/species.js";
import { DRAFT_MODES, DRAFT_MODE_BY_ID } from "../../data/draftmodes.js";
import { CONFIG } from "../../config.js";
import { pickRandomDraftRule, randomDraftRules, buildRandomDraft } from "../../game/draft-random.js";
import { h, pokeCard, toast } from "../dom.js";
function sample(items, count) {
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, count);
}
const ALL = SPECIES.map((s) => s.id);
export function draftScreen(app) {
    const root = h('div', { class: 'page' });
    let modeId = 'draft';
    let candidates = sample(ALL, 16);
    let picked = [];
    let randomRule = null;
    const randomRules = randomDraftRules();
    const launch = (m, deck, enemyDeck) => {
        let label = m.name;
        let modifiers={...m.mods},weather=undefined;
        if (m.id === 'aleatorio') {
            const draft=buildRandomDraft(randomRule||randomRules[0]);
            deck=draft.deck;enemyDeck=draft.enemyDeck;modifiers={...modifiers,...draft.mods};weather=draft.weather;
            label += ` · ${draft.label}`;
            toast(`Regla: ${draft.label}. Ambos equipos reciben la misma baraja y condiciones.`, 'ok');
        }
        void app.startBattle({ mode: 'draft', draftMode: m.id, modifiers, weather, difficulty: app.profile.data.settings.difficulty, deck, enemyDeck, label: `Draft · ${label}` });
    };
    const draw = () => {
        const m = DRAFT_MODE_BY_ID.get(modeId);
        const F = CONFIG.draftRewards;
        if (m.id === 'aleatorio' && !randomRule) randomRule = pickRandomDraftRule(randomRules);
        const list = h('div', { class: 'seg draft-modes', role: 'group', 'aria-label': 'Modo Draft' }, DRAFT_MODES.map((x) => h('button', { type: 'button', id: `dm-${x.id}`, 'aria-pressed': modeId === x.id, on: { click: () => { modeId = x.id; picked = []; randomRule = x.id === 'aleatorio' ? sample(randomRules, 1)[0] : null; candidates = sample(ALL, 16); draw(); } } }, x.name)));
        const controls = h('section', { class: 'panel stack' }, h('p', { class: 'sub' }, 'Partidas contra la IA con reglas especiales y una baraja temporal. Los Pokémon de Draft no se añaden a tu colección y estas partidas nunca suben ni bajan tus trofeos.'), list, h('div', { class: 'sub', id: 'dm-desc' }, h('b', null, m.name + ': '), m.id === 'aleatorio' ? `${randomRule.label}. Ambos equipos recibirán una selección idéntica de 8 Pokémon y compartirán los modificadores.` : m.desc), m.id === 'aleatorio' ? h('button', { class: 'btn btn-blue sm', type: 'button', on: { click: () => { randomRule = pickRandomDraftRule(randomRules); draw(); } } }, 'Volver a sortear reglas') : null);
        let start;
        if (m.deck === 'random')
            start = h('button', { class: 'btn btn-gold btn-big', type: 'button', id: 'dm-start', on: { click: () => launch(m, sample(ALL, 8)) } }, 'Sortear y jugar');
        else if (m.deck === 'mirror')
            start = h('button', { class: 'btn btn-gold btn-big', type: 'button', id: 'dm-start', on: { click: () => { const deck = sample(ALL, 8); launch(m, deck, deck.slice()); } } }, 'Crear espejo y jugar');
        else
            start = h('div', { class: 'row between' }, h('b', null, `Elegidos: ${picked.length}/8`), h('button', { class: 'btn btn-blue sm', type: 'button', on: { click: () => { candidates = sample(ALL, 16); picked = []; draw(); } } }, 'Nuevas opciones'));
        const picker = m.deck === 'pick' ? h('section', { class: 'panel stack' }, h('h2', null, 'Elige tu baraja'), h('div', { class: 'cards' }, candidates.map((id) => h('button', { type: 'button', class: `draft-card${picked.includes(id) ? ' selected' : ''}`, on: { click: () => {
                    if (picked.includes(id))
                        picked = picked.filter((x) => x !== id);
                    else if (picked.length < 8)
                        picked.push(id);
                    else
                        toast('Solo puedes elegir 8 Pokémon', 'info');
                    draw();
                } } }, pokeCard(getSpecies(id), { small: true, badge: picked.includes(id) ? `Elegido ${picked.indexOf(id) + 1}` : undefined })))), h('button', { class: 'btn btn-gold btn-big', type: 'button', id: 'dm-start', disabled: picked.length !== 8, on: { click: () => { if (picked.length === 8)
                    launch(m, picked.slice()); } } }, 'Jugar con esta baraja')) : null;
        const rules = h('section', { class: 'panel stack' }, h('h2', null, 'Reglas'), h('div', { class: 'sub' }, `Los niveles de cartas que no hayas obtenido se consideran nivel 1. Recompensa reducida (${Math.round(F.fraction * 100)} % de una partida normal, máximo ${F.dailyCoinCap} monedas al día entre todos los Draft) y solo una vez por partida. Sin trofeos, misiones ni progreso de objetos.`));
        root.replaceChildren(h('h1', null, 'Draft'), controls, start, ...(picker ? [picker] : []), rules);
    };
    draw();
    return root;
}
