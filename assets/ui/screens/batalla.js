import { DIFFICULTIES, DIFFICULTY_LABEL, CONFIG } from "../../config.js";
import { ARENAS } from "../../data/arenas.js";
import { getSpecies } from "../../data/species.js";
import { avgCost } from "../../game/profile.js";
import { h, pokeCard } from "../dom.js";
import { trainingPicker } from "../training.js";
const DIFF_TEXT = {
    facil: 'Despliegues sencillos, algún error y poca acumulación de unidades. Ideal para aprender.',
    normal: 'Gestiona la energía, responde a amenazas cercanas y presiona los dos carriles.',
    dificil: 'Detecta amenazas, contraataca por tipo, reserva energía y aprovecha las ventajas.',
};
export function batallaScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    const arenaBtn = (id, name, sub, open, sel, need) => h('button', { type: 'button', class: `arena-btn${sel ? ' sel' : ''}`, data: { arena: id }, disabled: !open, aria: { pressed: sel }, on: { click: () => p.setArena(id) } }, h('b', null, name), h('span', { class: 'sub' }, open ? sub : `🔒 ${need} trofeos`));
    const draw = () => {
        root.replaceChildren();
        const d = p.data;
        const deck = p.deck;
        const valid = p.deckValid();
        root.append(h('h1', null, 'Batalla'), h('section', { class: 'panel stack' }, h('h3', null, 'Dificultad de la IA'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Dificultad' }, DIFFICULTIES.map((k) => h('button', { type: 'button', data: { diff: k }, aria: { pressed: d.settings.difficulty === k }, on: { click: () => p.updateSettings({ difficulty: k }) } }, DIFFICULTY_LABEL[k]))), h('div', { class: 'sub' }, DIFF_TEXT[d.settings.difficulty]), h('div', { class: 'sub' }, 'La dificultad solo cambia la calidad de las decisiones: la IA usa la misma energía, costes y reglas que tú.'), h('h3', null, `Arena · 🏆 ${d.trophies} trofeos`), h('div', { class: 'arena-list', id: 'arena-list', role: 'group', 'aria-label': 'Arena' }, [
            arenaBtn('auto', 'Automática', `Según tus trofeos: ${p.currentArena.city}`, true, d.arena === 'auto', 0),
            ...ARENAS.map((a, i) => {
                const next = ARENAS[i + 1];
                const max = next && next.generation === a.generation ? next.minTrophies - 1 : CONFIG.trophies.maxPerGeneration;
                return arenaBtn(a.id, a.city, `${a.leader} · ${a.badge} · ${a.minTrophies}–${max} trofeos`, d.trophies >= a.minTrophies, d.trophies >= a.minTrophies && d.arena === a.id, a.minTrophies);
            }),
        ]), h('div', { class: 'sub' }, 'Victoria: +5/+7/+10 y derrota: −5/−5/−8 según dificultad. El saldo se limita a 0–1.000 trofeos en Kanto; solo puedes jugar en las arenas correspondientes a tu saldo actual de trofeos. Las arenas solo cambian el decorado.'), h('h3', null, 'Mazo'), h('select', { 'aria-label': 'Mazo para la batalla', id: 'deck-select', on: { change: (e) => p.setActiveDeck(Number(e.target.value)) } }, d.decks.map((dk, i) => h('option', { value: String(i), selected: i === d.activeDeck }, `${dk.name} (${dk.ids.length}/8)${dk.ids.length === 8 ? '' : ' · incompleto'}`))), h('div', { class: 'deck-strip' }, deck.ids.map((id) => pokeCard(getSpecies(id), { small: true, level: p.levelOf(id) }))), h('div', { class: 'row between' }, h('span', { class: 'avg' }, `Coste medio ${avgCost(deck.ids)}`), h('button', { class: 'btn btn-blue sm', type: 'button', on: { click: () => app.go('mazos') } }, 'Editar mazo')), !valid && h('div', { class: 'sub', style: 'color:#ffb4a8', id: 'deck-warn' }, `Este mazo tiene ${deck.ids.length}/8 Pokémon: no se puede iniciar una partida normal.`), h('button', { class: 'btn btn-gold btn-big', type: 'button', id: 'start-battle', disabled: !valid,
            on: { click: () => void app.startBattle({ mode: 'normal', difficulty: d.settings.difficulty, deck: deck.ids.slice() }) } }, '¡Empezar batalla!')), h('section', { class: 'panel stack' }, h('h3', null, 'Entrenamiento libre'), h('p', { class: 'sub' }, 'Prueba cualquier Pokémon sin gastar nada: energía infinita, maniquíes, cámara lenta y registro de daño. No da recompensas ni cuenta en tus estadísticas.'), h('button', { class: 'btn btn-blue', type: 'button', id: 'start-training', on: { click: () => trainingPicker(app, deck.ids.slice(0, CONFIG.battle.handSize)) } }, 'Entrenar')), h('section', { class: 'panel' }, h('h3', null, 'Cómo se juega'), h('ul', { style: 'margin:0;padding-left:18px' }, h('li', null, 'Toca una carta y después tu mitad del campo para desplegar el Pokémon (también puedes arrastrarla).'), h('li', null, 'La energía (máx. 10) se regenera sola; en el último minuto va al doble.'), h('li', null, 'Cuando un Pokémon tiene el rayo ⚡ amarillo, su ataque especial está listo: tócalo o usa la barra de especiales.'), h('li', null, 'Gana quien destruya más torres; si empatan, quien cause más daño a las torres. La Torre del Rey se activa al recibir daño.'))));
    };
    draw();
    app.watch(draw);
    return root;
}
