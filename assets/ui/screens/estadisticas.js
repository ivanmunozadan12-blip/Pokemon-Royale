import { getSpecies } from "../../data/species.js";
import { levelInfo } from "../../game/profile.js";
import { fmt, h, hms, pct, spriteImg } from "../dom.js";
export function estadisticasScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    const top = (rec, what) => {
        const rows = Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, 5);
        if (!rows.length)
            return h('div', { class: 'sub' }, 'Aún no hay datos.');
        return h('div', { class: 'stack toplist' }, rows.map(([id, n]) => h('div', { class: 'row', style: 'gap:10px' }, h('span', { style: 'width:40px;height:40px;display:flex;align-items:flex-end;justify-content:center' }, spriteImg(Number(id))), h('b', { style: 'flex:1' }, getSpecies(Number(id)).nameEs), h('span', null, `${n} ${what}`))));
    };
    const draw = () => {
        root.replaceChildren();
        const s = p.data.stats;
        const li = levelInfo(p.data.xp);
        root.append(h('h1', null, 'Estadísticas'), h('div', { class: 'stat-grid', id: 'stats-grid' }, box(String(s.played), 'Partidas jugadas'), box(String(s.wins), 'Victorias'), box(String(s.losses), 'Derrotas'), box(String(s.draws), 'Empates'), box(pct(s.wins, s.played), 'Porcentaje de victorias'), box(String(s.towersDestroyed), 'Torres destruidas'), box(hms(s.timeSec), 'Tiempo total de juego'), box(`Nv. ${li.level}`, `${p.data.xp} XP en total`), box(fmt(s.coinsEarned), 'Monedas ganadas en batalla'), box(String(s.ballsEarned), 'Poké Balls ganadas en batalla')), h('div', { class: 'grid2' }, h('section', { class: 'panel' }, h('h3', null, 'Pokémon más usados'), top(s.usage, 'despliegues')), h('section', { class: 'panel' }, h('h3', null, 'Más derrotas causadas'), top(s.kills, 'derrotas'))), h('section', { class: 'panel' }, h('h3', null, 'Últimas partidas'), s.history.length ? h('table', { class: 'table', id: 'history' }, h('tr', null, h('th', null, 'Resultado'), h('th', null, 'Torres'), h('th', null, 'Duración'), h('th', null, 'Dif.'), h('th', null, 'Trofeos'), h('th', null, 'Botín')), s.history.slice(0, 10).map((m) => h('tr', null, h('td', null, m.outcome === 'win' ? 'Victoria' : m.outcome === 'loss' ? 'Derrota' : 'Empate'), h('td', null, `${m.crowns[0]}–${m.crowns[1]}`), h('td', null, hms(m.durationSec)), h('td', null, m.difficulty), h('td', null, `${m.trophies >= 0 ? '+' : ''}${m.trophies ?? 0}`), h('td', null, `+${m.coins}${m.balls ? ` +${m.balls}🔴` : ''}`))))
            : h('div', { class: 'sub' }, 'Aún no has jugado ninguna partida.')), h('section', { class: 'panel' }, h('h3', null, 'Entrenamiento (aparte)'), h('div', { class: 'sub' }, `Sesiones: ${s.trainingSessions} · Tiempo: ${hms(s.trainingTimeSec)}. El entrenamiento no cuenta en las estadísticas competitivas ni da recompensas.`)));
    };
    draw();
    app.watch(draw);
    return root;
}
const box = (v, l) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, l));
