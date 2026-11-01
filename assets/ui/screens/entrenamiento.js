import { CONFIG } from "../../config.js";
import { SPECIES, getSpecies } from "../../data/species.js";
import { filterSpecies } from "../../game/filters.js";
import { TRAIN_LABEL } from "../../game/training.js";
import { coinIcon, confirmBox, fmt, h, pokeCard, spriteImg, toast } from "../dom.js";
import { filterBar } from "../filterbar.js";

const REASON_TEXT = {
    max: 'Máximo alcanzado',
    bloqueada: 'Bloqueada: ya elegiste 3 estadísticas',
    coins: 'Faltan monedas',
    crystals: 'Faltan cristales',
    medals: 'Faltan medallas',
    cores: 'Faltan núcleos',
    pokemon: 'Pokémon no desbloqueado',
};
const T = CONFIG.training;

/**
 * Entrenamiento permanente de estadísticas. Reglas (todas validadas en game/profile.js, no solo aquí):
 * máximo +8 % por estadística, máximo 3 estadísticas entrenables por Pokémon y coste escalonado con confirmación previa.
 */
export function entrenamientoScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    const owned = () => SPECIES.filter((s) => p.isUnlocked(s.id));
    let selected = p.deck.ids.find((id) => p.isUnlocked(id)) ?? owned()[0]?.id ?? null;
    let busy = false;
    const grid = h('div', { class: 'cards', id: 'train-grid' });
    const detail = h('section', { class: 'panel stack', id: 'train-detail' });
    const bar = filterBar(() => drawGrid());
    const costChips = (c, res) => h('div', { class: 'row train-cost', style: 'gap:6px;flex-wrap:wrap' },
        h('span', { class: `tchip ${p.data.coins >= c.coins ? '' : 'short'}`, style: '--tc:#ffe27a' }, h('span', { class: 'row', style: 'gap:4px' }, coinIcon(), fmt(c.coins))),
        c.crystals > 0 && h('span', { class: `tchip ${res.crystals >= c.crystals ? '' : 'short'}`, style: '--tc:#8fe3ff' }, `💎 ${c.crystals}`),
        c.medals > 0 && h('span', { class: `tchip ${res.medals >= c.medals ? '' : 'short'}`, style: '--tc:#ffc98a' }, `🏅 ${c.medals}`),
        c.cores > 0 && h('span', { class: `tchip ${res.cores >= c.cores ? '' : 'short'}`, style: '--tc:#d9b3ff' }, `🔮 ${c.cores}`));
    const train = async (id, stat) => {
        if (busy)
            return;
        busy = true;
        try {
            const info = p.trainingInfo(id, stat);
            if (!info.ok || !info.can) {
                toast(REASON_TEXT[info.reason] ?? 'No se puede entrenar', 'err');
                return;
            }
            const sp = getSpecies(id);
            const st = p.trainingState(id);
            const isNew = info.level === 0 && !st.chosen.includes(stat);
            const lines = [
                `Coste: ${fmt(info.cost.coins)} monedas${info.cost.crystals ? `, ${info.cost.crystals} cristal(es)` : ''}${info.cost.medals ? `, ${info.cost.medals} medalla(s)` : ''}${info.cost.cores ? `, ${info.cost.cores} núcleo(s)` : ''}.`,
                `Probabilidad de éxito: ${Math.round(info.chance * 100)} %. Si falla, los recursos se pierden, pero nunca se restan mejoras anteriores.`,
                `Resultado si sale bien: ${TRAIN_LABEL[stat]} +${info.bonus + T.percentPerLevel} % (máximo +${T.maxLevel * T.percentPerLevel} %).`,
            ];
            if (isNew)
                lines.push(st.chosen.length + 1 >= T.maxStats
                    ? `Esta sería la estadística ${st.chosen.length + 1} de ${T.maxStats}: después, las demás quedarán bloqueadas para ${sp.nameEs}.`
                    : `Elegirás ${TRAIN_LABEL[stat]} como estadística entrenable (${st.chosen.length + 1}/${T.maxStats}).`);
            const ok = await confirmBox(`Entrenar ${TRAIN_LABEL[stat]} de ${sp.nameEs}`, lines.join(' '), 'Entrenar');
            if (!ok)
                return;
            const r = p.trainStat(id, stat);
            if (!r.ok) {
                app.audio.sfx('error');
                toast(REASON_TEXT[r.reason] ?? 'No se ha podido entrenar', 'err');
            }
            else if (r.success) {
                app.audio.sfx('coin');
                toast(`¡${TRAIN_LABEL[stat]} de ${sp.nameEs} sube a +${r.level} %!`, 'ok');
            }
            else {
                app.audio.sfx('error');
                toast(`El entrenamiento de ${TRAIN_LABEL[stat]} ha fallado (probabilidad ${Math.round(r.chance * 100)} %). Recursos gastados.`, 'info', 4000);
            }
        }
        finally {
            busy = false;
            drawAll();
        }
    };
    const drawDetail = () => {
        detail.replaceChildren();
        if (selected === null) {
            detail.append(h('div', { class: 'sub' }, 'Aún no tienes Pokémon para entrenar.'));
            return;
        }
        const sp = getSpecies(selected);
        const st = p.trainingState(selected);
        const res = p.data.training.resources;
        detail.append(h('div', { class: 'row', style: 'gap:12px;align-items:center' }, h('span', { style: 'width:64px;height:64px;display:flex;align-items:flex-end;justify-content:center' }, spriteImg(sp.id, 'f')), h('div', { class: 'stack', style: 'gap:2px' }, h('b', { style: 'font-size:18px' }, `${sp.nameEs} · Nv. ${p.levelOf(sp.id)}`), h('span', { class: 'sub', id: 'train-slots' }, `Estadísticas elegidas: ${st.chosen.length}/${T.maxStats}${st.legacy ? ' (guardado antiguo: se conservan todas, no se pueden elegir más)' : ''} · Puntos totales: ${st.total}`))), h('div', { class: 'sub' }, `Cada punto da +${T.percentPerLevel} % a la estadística base; máximo +${T.maxLevel * T.percentPerLevel} % por estadística. Solo puedes entrenar ${T.maxStats} de las 6 estadísticas de cada Pokémon.`), h('div', { class: 'cards stat-cards' }, st.stats.map((row) => {
            const info = p.trainingInfo(sp.id, row.stat);
            const shown = Math.round(row.base * (1 + row.bonus / 100) * 10) / 10;
            const reason = info.reason;
            return h('div', { class: `panel stack stat-train${row.locked ? ' locked' : ''}${row.maxed ? ' maxed' : ''}`, data: { stat: row.stat }, style: 'padding:10px;gap:6px' }, h('div', { class: 'row between' }, h('b', null, TRAIN_LABEL[row.stat]), h('span', { class: 'sub' }, `${row.base}${row.bonus ? ` → ${shown}` : ''}`)), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round((row.level / row.max) * 100)}%` })), h('div', { class: 'row between' }, h('span', { class: 'sub' }, `Puntos ${row.level}/${row.max}`), h('b', null, `+${row.bonus} %`)), row.maxed ? h('div', { class: 'sub' }, 'Máximo alcanzado') : [costChips(row.cost, res), h('div', { class: 'sub' }, `Éxito: ${Math.round(row.chance * 100)} %`)], row.locked ? h('div', { class: 'sub', style: 'color:#ffb4a8' }, '🔒 Bloqueada (ya elegiste 3 estadísticas)') : null, !row.maxed && h('button', { class: 'btn btn-gold sm', type: 'button', data: { train: row.stat }, disabled: !info.can || busy, title: reason ? REASON_TEXT[reason] : '', on: { click: () => void train(sp.id, row.stat) } }, info.can ? 'Entrenar' : (REASON_TEXT[reason] ?? 'No disponible')));
        })));
    };
    const drawGrid = () => {
        grid.replaceChildren();
        const list = filterSpecies(SPECIES, { ...bar.f, status: 'desbloqueados' }, (id) => p.isUnlocked(id));
        for (const sp of list) {
            const st = p.trainingState(sp.id);
            grid.appendChild(pokeCard(sp, { small: true, selected: sp.id === selected, level: p.levelOf(sp.id), badge: st.total > 0 ? `Entr. ${st.total}` : undefined, onClick: () => { selected = sp.id; drawAll(); } }));
        }
        if (!list.length)
            grid.appendChild(h('div', { class: 'sub' }, 'Ningún Pokémon desbloqueado coincide con el filtro.'));
    };
    const drawHead = () => {
        const r = p.data.training.resources;
        head.replaceChildren(h('div', { class: 'row between' }, h('h2', null, 'Recursos'), h('span', { class: 'badge' }, 'Se ganan jugando')), h('div', { class: 'stat-grid' }, stat(fmt(p.data.coins), 'Monedas'), stat(fmt(r.crystals), 'Cristales 💎'), stat(fmt(r.medals), 'Medallas 🏅'), stat(fmt(r.cores), 'Núcleos 🔮')), h('p', { class: 'sub' }, 'Cristales: 1 por victoria normal y en misiones. Medallas: 1 cada 5 victorias y en misiones. Núcleos: 1 cada 20 victorias y en logros. El entrenamiento libre contra maniquíes (menú Batalla) es otra cosa y no gasta nada.'));
    };
    const head = h('section', { class: 'panel stack' });
    const stat = (v, l) => h('div', { class: 'stat' }, h('b', null, v), h('span', null, l));
    const drawAll = () => { drawHead(); drawGrid(); drawDetail(); };
    root.append(h('h1', null, 'Entrenamiento'), head, h('section', { class: 'panel stack' }, h('h2', null, 'Elige un Pokémon'), bar.el, grid), detail);
    drawAll();
    app.watch(() => { if (!busy)
        drawAll(); });
    return root;
}
