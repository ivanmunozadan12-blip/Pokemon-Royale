import { CONFIG, RARITY_LABEL } from "../config.js";
import { getSpecies } from "../data/species.js";
import { TYPE_COLOR, TYPE_LABEL } from "../data/types.js";
export function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
        for (const [k, v] of Object.entries(props)) {
            if (v === undefined || v === null || v === false)
                continue;
            if (k === 'class')
                el.className = String(v);
            else if (k === 'text')
                el.textContent = String(v);
            else if (k === 'html')
                el.innerHTML = String(v);
            else if (k === 'style')
                el.setAttribute('style', String(v));
            else if (k === 'data')
                for (const [dk, dv] of Object.entries(v))
                    el.dataset[dk] = String(dv);
            else if (k === 'aria')
                for (const [ak, av] of Object.entries(v))
                    el.setAttribute(`aria-${ak}`, String(av));
            else if (k === 'on')
                for (const [ek, ef] of Object.entries(v))
                    el.addEventListener(ek, ef);
            else if (k === 'disabled' || k === 'hidden' || k === 'checked')
                el[k] = !!v;
            else if (k === 'value')
                el.value = String(v);
            else
                el.setAttribute(k, String(v));
        }
    }
    append(el, children);
    return el;
}
export function append(el, children) {
    for (const c of children) {
        if (c === null || c === undefined || c === false)
            continue;
        if (Array.isArray(c))
            append(el, c);
        else
            el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
}
export function clear(el) {
    while (el.firstChild)
        el.removeChild(el.firstChild);
}
/* ───────── iconos SVG (trazo, heredan el color del texto) ───────── */
const ICONS = {
    inicio: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
    batalla: '<path d="M4 4l9 9M20 4l-9 9M4 20l5-5M20 20l-5-5M3 3l4 1-1 4M21 3l-4 1 1 4"/>',
    draft: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v5h4M8 13h8M8 16h5"/>',
    equipo: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2-6 6-6s6 2 6 6M15 15c3 0 5 1.5 6 4"/>',
    progreso: '<path d="M4 19V5M4 19h17"/><path d="M7 15l4-4 3 2 5-6"/><circle cx="19" cy="7" r="1"/>',
    mazos: '<rect x="5" y="8" width="12" height="13" rx="2"/><path d="M8 5h9a2 2 0 012 2v11"/>',
    coleccion: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
    tienda: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
    bolas: '<circle cx="12" cy="12" r="9"/><path d="M3 12h6M15 12h6"/><circle cx="12" cy="12" r="3"/>',
    estadisticas: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    objetos: '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M8 12l2.5 2.5L16 9"/>',
    entrenamiento: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    pausa: '<path d="M9 5v14M15 5v14"/>',
    bandera: '<path d="M6 21V4M6 5h12l-3 4 3 4H6"/>',
    cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
    entrenar: '<path d="M6 4v16M18 4v16M6 12h12M3 8v8M21 8v8"/>',
};
export function icon(name, cls = '') {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', `icon ${cls}`);
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] ?? '';
    return s;
}
export function coinIcon() {
    return h('span', { class: 'coin-ico', aria: { hidden: 'true' } });
}
export function ballIcon(kind) {
    return h('span', { class: `ball-ico ball-${kind}`, aria: { hidden: 'true' } });
}
export function energyIcon() {
    return h('span', { class: 'en-ico', aria: { hidden: 'true' } });
}
/* ───────── sprites y tarjetas ───────── */
export function spriteBase() {
    return 'sprites/';
}
/**
 * Imagen de un Pokémon con respaldo: si el archivo no carga se muestra una ficha con su número,
 * claramente distinta de un sprite oficial.
 */
export function spriteImg(id, side = 'f', cls = '') {
    const sp = getSpecies(id);
    const img = h('img', {
        class: `spr ${cls}`, src: cls.split(' ').includes('shiny') ? `${spriteBase()}shiny/${side === 'b' ? 'back' : 'front'}/${id}.gif` : `${spriteBase()}static/${side}${id}.png`, alt: sp.nameEs, loading: 'lazy', decoding: 'async', draggable: 'false',
    });
    img.addEventListener('error', () => {
        const fb = h('span', { class: `spr spr-fb ${cls}`, style: `--tc:${TYPE_COLOR[sp.types[0]]}`, title: sp.nameEs }, `#${id}`);
        img.replaceWith(fb);
    }, { once: true });
    return img;
}
export function typeChip(t, small = false) {
    return h('span', { class: `tchip${small ? ' sm' : ''}`, style: `--tc:${TYPE_COLOR[t]}` }, TYPE_LABEL[t]);
}
export function rarityTag(r) {
    return h('span', { class: `rtag rar-${r}` }, RARITY_LABEL[r]);
}
/** Carta de Pokémon (colección, editor de mazos, mano de batalla): sprite, nombre, coste, rareza y tipo. */
export function pokeCard(sp, o = {}) {
    const el = h('button', {
        class: `pcard rar-${sp.rarity}${o.locked ? ' locked' : ''}${o.shiny ? ' shiny' : ''}${o.selected ? ' sel' : ''}${o.inDeck ? ' indeck' : ''}${o.upgradeable ? ' upgradeable' : ''}${o.small ? ' small' : ''}`,
        type: 'button',
        data: { id: sp.id },
        aria: { label: `${sp.nameEs}, coste ${sp.cost}${o.locked ? ', bloqueado' : ''}`, pressed: !!o.selected },
        disabled: !!o.disabled,
        on: o.onClick ? { click: o.onClick } : {},
    }, h('span', { class: 'pc-cost' }, String(o.cost ?? sp.cost)), o.level && !o.locked ? h('span', { class: 'pc-num pc-lvl' }, `Nv. ${o.level}`) : h('span', { class: 'pc-num' }, `#${String(sp.id).padStart(3, '0')}`), h('span', { class: 'pc-art' }, spriteImg(sp.id, 'f', o.locked && !o.preview ? 'sil' : o.shiny ? 'shiny' : '')), h('span', { class: 'pc-name' }, o.locked && !o.preview ? '???' : sp.nameEs), o.showTypes !== false && h('span', { class: 'pc-types' }, sp.types.map((t) => typeChip(t, true))), o.badge && h('span', { class: 'pc-badge' }, o.badge), o.locked && h('span', { class: 'pc-lock', aria: { hidden: 'true' } }, o.preview ? '🔒' : '🔒'));
    return el;
}
/* ───────── avisos, diálogos ───────── */
let toastRoot = null;
export function toast(msg, kind = 'info', ms = 2600) {
    toastRoot ??= document.getElementById('toast-root');
    if (!toastRoot)
        return;
    const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
    toastRoot.appendChild(t);
    while (toastRoot.children.length > 3)
        toastRoot.removeChild(toastRoot.children[0]);
    setTimeout(() => {
        t.classList.add('out');
        setTimeout(() => t.remove(), 300);
    }, ms);
}
/** Hoja modal que SIEMPRE se puede cerrar: botón ×, tocar fuera o tecla Escape. */
export function modal(title, body, opts = {}) {
    const root = document.getElementById('modal-root');
    const prevFocus = document.activeElement;
    let closed = false;
    const close = () => {
        if (closed)
            return;
        closed = true;
        document.removeEventListener('keydown', onKey);
        overlay.classList.add('out');
        setTimeout(() => overlay.remove(), 160);
        opts.onClose?.();
        prevFocus?.focus?.();
    };
    const onKey = (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            close();
        }
    };
    const closeBtn = h('button', { class: 'iconbtn', type: 'button', aria: { label: 'Cerrar' }, on: { click: close } }, icon('cerrar'));
    const overlay = h('div', { class: 'overlay', role: 'dialog', aria: { modal: 'true', label: title }, on: { pointerdown: (e) => { if (e.target === overlay)
                close(); } } }, h('div', { class: `sheet${opts.wide ? ' wide' : ''}` }, h('div', { class: 'sheet-head' }, h('h2', null, title), closeBtn), h('div', { class: 'sheet-body' }, body), opts.actions && h('div', { class: 'sheet-actions' }, opts.actions)));
    root.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    closeBtn.focus();
    return { el: overlay, close };
}
export function confirmBox(title, text, okText = 'Aceptar', danger = false, cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        let done = false;
        const finish = (v) => {
            if (done)
                return;
            done = true;
            m.close();
            resolve(v);
        };
        const m = modal(title, h('p', { class: 'confirm-text' }, text), {
            onClose: () => finish(false),
            actions: [
                h('button', { class: 'btn btn-blue', type: 'button', on: { click: () => finish(false) } }, cancelText),
                h('button', { class: `btn ${danger ? 'btn-red' : 'btn-gold'}`, type: 'button', on: { click: () => finish(true) } }, okText),
            ],
        });
    });
}
/* ───────── formato ───────── */
export const fmt = (n) => Math.round(n).toLocaleString('es-ES');
export const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '—');
export function mmss(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function hms(sec) {
    const s = Math.round(sec);
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60);
    return hh > 0 ? `${hh} h ${mm} min` : mm > 0 ? `${mm} min ${s % 60} s` : `${s} s`;
}
export function ballName(kind) {
    return CONFIG.balls[kind]?.name ?? kind;
}
