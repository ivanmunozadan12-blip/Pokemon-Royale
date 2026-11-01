import { TYPE_LABEL } from "../data/types.js";
import { leveled } from "../data/levels.js";
import { applyLearned } from "../game/learning.js";
import { confirmBox, h, modal, toast, typeChip } from "./dom.js";

const DELIVERY = { burst: 'Golpe directo/en área', bolt: 'Proyectil veloz', lob: 'Proyectil en arco (área)', beam: 'Rayo en línea', aoe: 'Onda alrededor', zone: 'Zona de daño continuo', heal: 'Curación' };
const HITS = { both: 'Tierra y aire', ground: 'Solo terrestres', air: 'Solo aéreos' };
const KIND = { fisico: 'Físico', especial: 'Especial' };
const fmt1 = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

/** Filas comparables de un ataque básico (datos de juego tras aplicar nivel y bono). */
function basicRows(sp, official) {
    return [
        ['Tipo', typeChip(sp.attackType, true)],
        ['Categoría', KIND[sp.damageKind]],
        ['Potencia oficial', official ? String(official.power) : '—'],
        ['Daño por golpe', { v: sp.dmg, num: true }],
        ['Cada', { v: sp.interval, num: true, lowerBetter: true, unit: ' s' }],
        ['DPS', { v: sp.dps, num: true }],
        ['Alcance', sp.ranged ? `${sp.range} casillas (distancia)` : 'Cuerpo a cuerpo'],
        ['Alcanza', sp.targets === 'both' ? 'Tierra y aire' : 'Solo terrestres'],
    ];
}
function specialRows(s) {
    return [
        ['Tipo', typeChip(s.type, true)],
        ['Forma', DELIVERY[s.delivery] ?? s.delivery],
        ['Potencia (× daño/s)', { v: s.power, num: true }],
        ['Recarga', { v: s.cd, num: true, lowerBetter: true, unit: ' s' }],
        ['Alcance', s.delivery === 'aoe' ? `Radio ${s.radius}` : `${s.range} casillas`],
        ['Alcanza', HITS[s.hits] ?? 'Tierra y aire'],
        ['Efectos', s.desc],
    ];
}
function cell(c, ref) {
    if (c && typeof c === 'object' && c.num) {
        const better = ref && (c.lowerBetter ? c.v < ref.v : c.v > ref.v);
        const worse = ref && (c.lowerBetter ? c.v > ref.v : c.v < ref.v);
        return h('td', { class: better ? 'lm-up' : worse ? 'lm-down' : '', style: better ? 'color:#7dffa0' : worse ? 'color:#ff9d8f' : '' }, `${fmt1(c.v)}${c.unit ?? ''}${better ? ' ▲' : worse ? ' ▼' : ''}`);
    }
    return h('td', null, c);
}

/**
 * Ventana de elección: ataque actual frente a los candidatos reales. Elegir uno o mantener el actual es DEFINITIVO
 * (el rechazo también: no se vuelve a ofrecer).
 */
export function openLearning(profile, id, slot, onDone) {
    const info = profile.learnInfo(id, slot);
    if (!info.pending)
        return;
    const base = leveled(id, profile.levelOf(id));
    const isBasic = slot === 'basic';
    const curRows = isBasic ? basicRows(base, null) : specialRows(base.special.pool ? { ...base.special, name: 'Metrónomo', power: base.special.pool.reduce((a, p) => a + p.power, 0) / base.special.pool.length, cd: base.special.cd, radius: 0, range: 0, hits: 'both', desc: base.special.desc, type: base.types[0], delivery: 'bolt' } : base.special);
    const curName = isBasic ? base.attackName : (base.special.pool ? 'Metrónomo (al azar)' : base.special.name);
    let handle = null;
    const finish = (msg) => { handle?.close(); toast(msg, 'ok'); onDone?.(); };
    const cards = info.candidates.map((c) => {
        const learned = applyLearned(base, isBasic ? { basic: c.id } : { special: c.name }, 99);
        const rows = isBasic ? basicRows(learned, c) : specialRows(learned.special);
        const name = isBasic ? c.name : c.name;
        return h('section', { class: 'panel stack lm-card', data: { cand: isBasic ? c.id : c.name }, style: 'padding:10px;gap:6px' }, h('div', { class: 'row between' }, h('b', null, name), isBasic ? h('span', { class: 'sub' }, `Bono de daño +${fmt1(c.bonus * 100)} %`) : h('span', { class: 'sub' }, `Valor ×${c.ratio.toFixed(2)} del actual`)), h('table', { class: 'table' }, rows.map(([k, v], i) => h('tr', null, h('th', null, k), cell(v, curRows[i][1] && typeof curRows[i][1] === 'object' && curRows[i][1].num ? curRows[i][1] : null)))), h('button', { class: 'btn btn-gold sm', type: 'button', data: { learn: isBasic ? c.id : c.name }, on: { click: async () => {
                    if (!(await confirmBox(`Aprender ${name}`, `${base.nameEs} sustituirá ${curName} por ${name}. La decisión es definitiva y no se volverá a ofrecer otro cambio.`, 'Aprender')))
                        return;
                    const r = profile.learnMove(id, slot, isBasic ? c.id : c.name);
                    if (r.ok)
                        finish(`${base.nameEs} ha aprendido ${name}`);
                    else
                        toast('No se pudo aprender el ataque', 'err');
                } } }, 'Elegir este ataque'));
    });
    const body = h('div', { class: 'stack' }, h('p', { class: 'sub' }, isBasic
        ? 'Candidatos reales de los videojuegos que este Pokémon puede aprender (mismo tipo y mismo alcance). Los efectos secundarios de los juegos (quemar, paralizar…) no se aplican en combate: cuentan el tipo, la categoría y el daño.'
        : 'Ataques especiales reales que este Pokémon puede aprender y que equivalen a su especial actual en valor. Los efectos secundarios no listados no se aplican.'), h('section', { class: 'panel stack', style: 'padding:10px;gap:6px' }, h('div', { class: 'row between' }, h('b', null, `Actual: ${curName}`), h('span', { class: 'rtag', style: 'background:#8892a8' }, 'En uso')), h('table', { class: 'table' }, curRows.map(([k, v]) => h('tr', null, h('th', null, k), cell(v, null))))), ...cards, h('button', { class: 'btn btn-blue', type: 'button', id: 'keep-move', on: { click: async () => {
                if (!(await confirmBox('Mantener el ataque actual', `${base.nameEs} conservará ${curName} y no se volverán a ofrecer alternativas para este ataque.`, 'Mantener')))
                    return;
                const r = profile.learnMove(id, slot, null);
                if (r.ok)
                    finish(`${base.nameEs} mantiene ${curName}`);
            } } }, 'Mantener el actual (rechazar todos)'));
    handle = modal(`${isBasic ? 'Ataque básico' : 'Ataque especial'} de ${base.nameEs}`, body, { wide: true });
}
void TYPE_LABEL;
