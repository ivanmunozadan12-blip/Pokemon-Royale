import { todayKey } from "../../game/profile.js";
import { CONFIG } from "../../config.js";
import { h, toast } from "../dom.js";
function weekKey(d = new Date()) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
    const y = x.getUTCFullYear();
    const start = new Date(Date.UTC(y, 0, 1));
    const week = Math.ceil((((x.getTime() - start.getTime()) / 86400000) + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
}
const resourceText = (r = {}) => [r.crystals ? `${r.crystals} cristales` : '', r.medals ? `${r.medals} medallas` : '', r.cores ? `${r.cores} núcleos` : ''].filter(Boolean).join(' · ');
/** Misiones, desafíos y logros del momento (mismos datos para la pantalla y para los puntos rojos). */
export function buildMissions(d, now = new Date()) {
        const today = todayKey(now), week = weekKey(now);
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const counters = d.progressCounters;
        if (counters.day !== today) { counters.day = today; counters.dailyPlayed = 0; counters.dailyWins = 0; }
        if (counters.week !== week) { counters.week = week; counters.weeklyPlayed = 0; counters.weeklyWins = 0; }
        if (counters.month !== month) { counters.month = month; counters.monthlyPlayed = 0; counters.monthlyWins = 0; }
        const missions = [
            { id: `daily:${today}:play`, title: 'Primera batalla del día', desc: 'Juega una partida normal.', progress: Math.min(1, counters.dailyPlayed), target: 1, coins: 100, xp: 30 },
            { id: `daily:${today}:win`, title: 'Victoria diaria', desc: 'Gana una partida normal hoy.', progress: Math.min(1, counters.dailyWins), target: 1, coins: 150, xp: 50, resources: { crystals: 1 } },
            { id: `daily:${today}:wins2`, title: 'Racha de entrenamiento', desc: 'Consigue 2 victorias normales hoy.', progress: Math.min(2, counters.dailyWins), target: 2, coins: 200, xp: 70 },
            { id: `weekly:${week}:wins`, title: 'Entrenador constante', desc: 'Consigue 3 victorias esta semana.', progress: Math.min(3, counters.weeklyWins), target: 3, coins: 350, xp: 120, resources: { crystals: 2 } },
            { id: `weekly:${week}:wins5`, title: 'Especialista de arena', desc: 'Consigue 5 victorias esta semana.', progress: Math.min(5, counters.weeklyWins), target: 5, coins: 600, xp: 180, resources: { crystals: 2, medals: 1 } },
            { id: `weekly:${week}:played10`, title: 'Actividad semanal', desc: 'Juega 10 partidas normales esta semana.', progress: Math.min(10, counters.weeklyPlayed), target: 10, coins: 450, xp: 150 },
            { id: 'achievement:played10', title: 'Debutante experto', desc: 'Juega 10 partidas normales en total.', progress: Math.min(10, d.stats.played), target: 10, coins: 500, xp: 150 },
            { id: 'achievement:played50', title: 'Veterano de la arena', desc: 'Juega 50 partidas normales en total.', progress: Math.min(50, d.stats.played), target: 50, coins: 1200, xp: 350, resources: { crystals: 3, medals: 1 } },
            { id: 'achievement:played100', title: 'Leyenda persistente', desc: 'Juega 100 partidas normales en total.', progress: Math.min(100, d.stats.played), target: 100, coins: 2200, xp: 600, resources: { crystals: 5, medals: 2, cores: 1 } },
            { id: 'achievement:collection20', title: 'Coleccionista', desc: 'Desbloquea 20 Pokémon.', progress: Math.min(20, d.unlocked.length), target: 20, coins: 500, xp: 150 },
            { id: 'achievement:wins50', title: 'Cincuenta victorias', desc: 'Gana 50 partidas normales.', progress: Math.min(50, d.stats.wins), target: 50, coins: 1000, xp: 300, resources: { crystals: 3, medals: 1 } },
        ];
    return { missions, today, week, month, counters };
}
/** Recompensas listas para reclamar (punto rojo). */
export function claimableMissions(profile) {
    const d = profile.data;
    return buildMissions(d).missions.filter((m) => m.progress >= m.target && !d.progressClaimed.includes(m.id)).length;
}
export function progresoScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    const draw = () => {
        const d = p.data;
        const { missions, today, week, month, counters } = buildMissions(d);
        const renderMission = (m) => {
            const claimed = d.progressClaimed.includes(m.id), done = m.progress >= m.target;
            const extras = resourceText(m.resources);
            const rewardLabel = [`${m.coins} monedas`, `${m.xp} XP`, extras].filter(Boolean).join(' · ');
            return h('div', { class: 'panel stack mission-card', style: 'padding:12px' },
                h('div', { class: 'row between' }, h('b', null, m.title), h('span', { class: 'sub' }, `${m.progress}/${m.target}`)),
                h('div', { class: 'sub' }, m.desc), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round(m.progress / m.target * 100)}%` })),
                h('div', { class: 'row between', style: 'gap:10px;flex-wrap:wrap' }, h('span', { class: 'sub' }, `Recompensa: ${rewardLabel}`),
                    h('button', { class: 'btn btn-gold sm', type: 'button', disabled: claimed || !done, on: { click: () => {
                        if (p.claimProgressReward(m.id, m.coins, m.xp, m.resources)) { toast(`Recompensa recibida: ${rewardLabel}`, 'ok'); draw(); }
                    } } }, claimed ? 'Reclamada' : done ? 'Reclamar' : 'En progreso')));
        };
        const daily = missions.filter(m => m.id.startsWith(`daily:${today}:`));
        const weekly = missions.filter(m => m.id.startsWith(`weekly:${week}:`));
        const achievements = missions.filter(m => m.id.startsWith('achievement:'));
        const resources = d.training.resources;
        root.replaceChildren(
            h('h1', null, 'Progreso'),
            h('section', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Recursos de entrenamiento'), h('span', { class: 'badge' }, 'Gratis jugando')),
                h('div', { class: 'stat-grid' }, stat(d.coins.toLocaleString('es-ES'), 'Monedas'), stat(resources.crystals.toLocaleString('es-ES'), 'Cristales'), stat(resources.medals.toLocaleString('es-ES'), 'Medallas'), stat(resources.cores.toLocaleString('es-ES'), 'Núcleos')),
                h('p', { class: 'sub' }, `Monedas obtenidas en partidas hoy: ${Math.min(CONFIG.dailyBattleCoinCap, d.battleCoinDaily?.day === today ? d.battleCoinDaily.earned : 0).toLocaleString('es-ES')}/${CONFIG.dailyBattleCoinCap.toLocaleString('es-ES')}. Al alcanzar el límite, las partidas dejan de dar monedas hasta mañana; las misiones, desafíos y logros siguen entregando sus monedas. La experiencia necesaria para subir de nivel es un 35% mayor. Las victorias normales dan cristales y los desafíos entregan recursos; el entrenamiento libre no concede recompensas competitivas.`)),
            h('section', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Misiones diarias'), h('span', { class: 'badge' }, `${daily.filter(m => d.progressClaimed.includes(m.id)).length}/${daily.length} reclamadas`)), ...daily.map(renderMission)),
            h('section', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Desafíos semanales'), h('span', { class: 'badge' }, week)), ...weekly.map(renderMission), h('p', { class: 'sub' }, 'Los desafíos se reinician al cambiar la semana. Las recompensas reclamadas quedan registradas y no se pueden cobrar dos veces.')),
            h('section', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Temporada mensual'), h('span', { class: 'badge' }, month)),
                h('p', { class: 'sub' }, 'La temporada se reinicia cada mes. Las cartas siguen siendo únicas: no existen evoluciones de cartas.'),
                h('div', { class: 'stat-grid' }, stat(`${counters.monthlyPlayed}`, 'Partidas del mes'), stat(`${counters.monthlyWins}`, 'Victorias del mes'), stat(`${d.stats.towersDestroyed}`, 'Torres destruidas'), stat(`${d.unlocked.length}/151`, 'Pokémon obtenidos')),
                ...[{ wins: 5, coins: 300, xp: 100, resources: { crystals: 1 } }, { wins: 15, coins: 700, xp: 250, resources: { crystals: 2, medals: 1 } }, { wins: 30, coins: 1500, xp: 500, resources: { crystals: 4, medals: 2, cores: 1 } }].map(tier => {
                    const id = `season:${month}:${tier.wins}`, wins = counters.monthlyWins, claimed = d.progressClaimed.includes(id), extra = resourceText(tier.resources);
                    return h('div', { class: 'row between panel', style: 'padding:10px;gap:10px;flex-wrap:wrap' }, h('div', { class: 'stack', style: 'gap:3px' }, h('b', null, `Hito de ${tier.wins} victorias`), h('span', { class: 'sub' }, `${Math.min(tier.wins, wins)}/${tier.wins} · ${tier.coins} monedas · ${tier.xp} XP${extra ? ` · ${extra}` : ''}`)), h('button', { class: 'btn btn-gold sm', type: 'button', disabled: claimed || wins < tier.wins, on: { click: () => { if (p.claimProgressReward(id, tier.coins, tier.xp, tier.resources)) { toast('Recompensa de temporada recibida', 'ok'); draw(); } } } }, claimed ? 'Reclamado' : wins >= tier.wins ? 'Reclamar' : 'Bloqueado'));
                })),
            h('section', { class: 'panel stack' }, h('h2', null, 'Logros'), ...achievements.map(renderMission), h('div', { class: 'row between' }, h('span', null, 'Dominador de arenas'), h('b', null, d.bestTrophies >= 500 ? '✓' : '—'), h('span', { class: 'sub' }, 'Alcanza 500 trofeos')))
        );
    };
    const stat = (value, label) => h('div', { class: 'stat' }, h('b', null, value), h('span', null, label));
    draw();
    app.watch(draw);
    return root;
}
