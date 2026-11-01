import { CONFIG, RARITY_LABEL } from "../../config.js";
import { getSpecies, SPECIES } from "../../data/species.js";
import { avgCost, levelInfo } from "../../game/profile.js";
import { ballIcon, coinIcon, fmt, h, hms, pokeCard, spriteImg, toast } from "../dom.js";
export function inicioScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    let menuOpen = false;
    const draw = () => {
        root.replaceChildren();
        const d = p.data;
        const li = levelInfo(d.xp);
        const deck = p.deck;
        const valid = p.deckValid();
        const last = d.stats.history[0];
        const showcase = (valid ? deck.ids : d.unlocked).slice(0, 5);
        root.append(h('section', { class: 'panel hero' }, h('div', { class: 'tag' }, 'KANTO · 151 POKÉMON'), h('h1', null, 'POKÉMON ROYALE'), h('div', { class: 'showcase' }, showcase.map((id) => spriteImg(id, 'f'))), h('div', { class: 'sub' }, 'Proyecto personal sin afiliación oficial con Nintendo, Game Freak ni The Pokémon Company')), h('div', { class: 'stat-grid' }, stat(`Nv. ${li.level}`, `${li.into}/${li.need} XP`), stat(h('span', { class: 'row', style: 'gap:4px' }, coinIcon(), fmt(d.coins)), 'Monedas'), stat(h('span', { class: 'row', style: 'gap:4px' }, ballIcon('poke'), String(p.ballCount())), 'Poké Balls'), stat(`🏆 ${d.trophies}`, p.currentArena.city), stat(`${d.unlocked.length}/${SPECIES.length}`, 'Pokémon desbloqueados')), h('div', { class: 'grid2' }, h('section', { class: 'panel stack' }, h('button', { class: 'btn btn-gold btn-big', type: 'button', id: 'go-battle', disabled: !valid, on: { click: () => void app.startBattle({ mode: 'normal', difficulty: d.settings.difficulty, deck: deck.ids.slice() }) } }, '¡BATALLA!'), !valid && h('div', { class: 'sub', style: 'color:#ffb4a8' }, `Tu mazo "${deck.name}" tiene ${deck.ids.length}/8 Pokémon. Complétalo para jugar.`), h('div', { class: 'row' }, h('button', { class: 'btn btn-blue', type: 'button', id: 'go-train', on: { click: () => app.go('batalla') } }, 'Entrenamiento y opciones'), h('button', { class: 'btn btn-blue', type: 'button', on: { click: () => app.go('tienda') } }, 'Tienda'), h('button', { class: 'btn btn-gold', type: 'button', on: { click: () => app.go('casino') } }, p.wheelAvailable() ? '🎰 Casino · premio diario' : '🎰 Casino'), h('button', { class: 'btn btn-blue', type: 'button', on: { click: () => app.go('coleccion') } }, 'Colección')), h('button', { class: 'btn btn-blue home-dropdown-toggle', type: 'button', 'aria-expanded': String(menuOpen), on: { click: () => { menuOpen = !menuOpen; draw(); } } }, 'Menú Desplegable', h('span', { class: 'home-dropdown-chevron', 'aria-hidden': 'true' }, menuOpen ? '▲' : '▼')), menuOpen && h('div', { class: 'home-dropdown-grid', role: 'group', 'aria-label': 'Secciones del juego' }, ...[['batalla','Batalla'],['casino','🎰 Casino'],['draft','Draft'],['expediciones','Expediciones'],['safari','Safari'],['equipo','Equipo'],['entrenamiento','Entrenamiento'],['objetos','Objetos'],['progreso','Progreso'],['mazos','Mazos'],['bolas','Poké Balls'],['estadisticas','Estadísticas'],['ajustes','Ajustes']].map(([id,label]) => h('button', { class: 'btn btn-blue sm', type: 'button', on: { click: () => app.go(id) } }, label))), p.giftAvailable() && h('button', { class: 'btn btn-green', type: 'button', id: 'gift', on: { click: () => {
                    const r = p.claimGift();
                    if (r.ok) {
                        app.audio.sfx('coin');
                        toast(`Regalo diario: +${r.coins} monedas y +${r.balls} Poké Ball`, 'ok');
                    }
                } } }, '🎁 Recoger regalo diario')), h('section', { class: 'panel' }, h('div', { class: 'row between' }, h('h3', null, `Mazo activo: ${deck.name}`), h('span', { class: 'avg' }, `Coste medio ${avgCost(deck.ids)}`)), h('div', { class: 'deck-strip' }, deck.ids.map((id) => pokeCard(getSpecies(id), { small: true, level: p.levelOf(id) }))), h('button', { class: 'btn btn-blue sm', type: 'button', style: 'margin-top:8px', on: { click: () => app.go('mazos') } }, 'Editar mazos'))), h('section', { class: 'panel' }, h('h3', null, 'Último resultado'), last
            ? h('div', { class: 'result' }, h('span', { class: `badge ${last.outcome}` }, last.outcome === 'win' ? 'VICTORIA' : last.outcome === 'loss' ? 'DERROTA' : 'EMPATE'), h('span', null, `Torres ${last.crowns[0]}–${last.crowns[1]} · ${hms(last.durationSec)} · ${last.difficulty}`), h('span', { class: 'sub' }, `+${last.coins} monedas${last.balls ? `, +${last.balls} Poké Ball` : ''}`))
            : h('div', { class: 'sub' }, 'Aún no has jugado ninguna partida. ¡Empieza una batalla!')), h('section', { class: 'panel' }, h('h3', null, 'Tareas y recompensas'), h('ul', { class: 'stack', style: 'margin:0;padding-left:18px' }, h('li', null, p.giftAvailable() ? 'Regalo diario disponible' : 'Regalo diario ya recogido hoy'), h('li', null, p.freeBallsState().stored > 0 ? `Tienes ${p.freeBallsState().stored} Poké Ball gratis por recoger (pestaña Bolas)` : 'Poké Ball gratis: aún no está lista (pestaña Bolas)'), h('li', null, p.ballCount() > 0 ? `Tienes ${p.ballCount()} Poké Ball sin abrir` : 'No tienes Poké Balls: gana batallas para conseguir más'), h('li', null, `Victoria: +${CONFIG.rewards.win.coins} monedas y ${CONFIG.rewards.win.balls} Poké Ball · Derrota: +${CONFIG.rewards.loss.coins} monedas · Rareza más alta: ${RARITY_LABEL.legendario}`))));
    };
    draw();
    app.watch(draw);
    return root;
}
function stat(v, label) {
    return h('div', { class: 'stat' }, h('b', null, v), h('span', null, label));
}
