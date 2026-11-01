import { CONFIG } from "../config.js";
import { Rng } from "../sim/rng.js";
import { towerLayout } from "../sim/field.js";
/**
 * Arte del escenario generado por código en pixel art: se pinta a 16 px por casilla (288 × 512) y se amplía sin
 * suavizado, igual que los sprites. Sin imágenes externas: no puede fallar la carga ni tiene derechos de terceros.
 */
export const PX = 16;
const F = CONFIG.field;
export function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return [c, g];
}
export const R = (g, x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
/** Círculo relleno en pixel art (líneas horizontales). */
export function disc(g, cx, cy, r, c) {
    g.fillStyle = c;
    for (let y = -r; y <= r; y++) {
        const w = Math.floor(Math.sqrt(r * r - y * y) + 0.3);
        g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1);
    }
}
export function tree(g, x, y) {
    R(g, x - 1, y - 2, 3, 6, '#6b4423');
    R(g, x - 1, y - 2, 1, 6, '#7d5530');
    disc(g, x, y - 7, 7, '#1f6b2c');
    disc(g, x - 1, y - 8, 6, '#2f8a3a');
    disc(g, x - 2, y - 10, 3, '#4aae52');
    R(g, x - 3, y - 11, 2, 1, '#7fd183');
}
export function bush(g, x, y) {
    disc(g, x, y - 2, 4, '#2a7a35');
    disc(g, x - 1, y - 3, 3, '#3f9a48');
    R(g, x - 2, y - 4, 1, 1, '#7fd183');
    R(g, x + 2, y - 3, 1, 1, '#e86a8a');
}
export function rock(g, x, y) {
    R(g, x - 4, y - 3, 9, 5, '#7b8591');
    R(g, x - 3, y - 4, 7, 1, '#7b8591');
    R(g, x - 3, y - 3, 4, 2, '#a5afb9');
    R(g, x - 4, y + 1, 9, 1, '#586069');
}
export const STONE_DEFAULT = {
    a: '#a3acb6', b: '#b4bdc7', l1: '#7d8791', l2: '#8b95a0', hi: '#cfd6dd', cren: '#c9d0d8', crenHi: '#eef1f4', base: '#9aa3ad', baseLine: '#7d8791', out: '#2b3340',
};
const TEAM_COL = {
    0: { main: '#3b6fd8', light: '#7aa6ff', dark: '#243f87' },
    1: { main: '#d8463b', light: '#ff8a7a', dark: '#85231d' },
};
function brick(g, x, y, w, h, base, line) {
    R(g, x, y, w, h, base);
    for (let yy = y + 3; yy < y + h; yy += 4)
        R(g, x, yy, w, 1, line);
    for (let yy = y, row = 0; yy < y + h; yy += 4, row++) {
        for (let xx = x + (row % 2 ? 3 : 0); xx < x + w; xx += 6)
            R(g, xx, yy, 1, 3, line);
    }
}
function sideTower(team, state, P) {
    const [c, g] = mk(44, 52);
    const T = TEAM_COL[team];
    R(g, 5, 46, 34, 3, 'rgba(0,0,0,.28)');
    if (state === 'ruin') {
        R(g, 8, 40, 28, 7, '#5f6872');
        R(g, 11, 36, 10, 6, '#7d8791');
        R(g, 22, 38, 12, 5, P.l2);
        R(g, 15, 33, 6, 4, '#a5afb9');
        R(g, 26, 35, 5, 3, '#6b7480');
        R(g, 6, 44, 8, 3, '#6b7480');
        R(g, 31, 44, 7, 3, '#7d8791');
        R(g, 18, 31, 2, 3, T.dark);
        return c;
    }
    // base y cuerpo
    R(g, 7, 36, 30, 10, P.out);
    brick(g, 8, 37, 28, 8, P.a, P.l1);
    R(g, 10, 14, 24, 24, P.out);
    brick(g, 11, 15, 22, 22, P.b, P.l2);
    R(g, 11, 15, 3, 22, P.hi);
    R(g, 30, 15, 3, 22, P.l2);
    // estandarte del equipo
    R(g, 16, 20, 12, 14, T.dark);
    R(g, 17, 20, 10, 12, T.main);
    R(g, 17, 20, 10, 2, T.light);
    R(g, 20, 32, 4, 3, T.main);
    R(g, 21, 24, 2, 4, '#f6e27a');
    // almenas
    R(g, 7, 8, 30, 8, P.out);
    for (let i = 0; i < 4; i++)
        R(g, 8 + i * 8, 5, 6, 8, P.out);
    for (let i = 0; i < 4; i++) {
        R(g, 9 + i * 8, 6, 4, 6, P.cren);
        R(g, 9 + i * 8, 6, 4, 1, P.crenHi);
    }
    R(g, 8, 13, 28, 3, P.base);
    // aspillera / cañón
    R(g, 19, 17, 6, 3, '#1b2230');
    return c;
}
function kingTower(team, state, P) {
    const [c, g] = mk(64, 70);
    const T = TEAM_COL[team];
    R(g, 6, 62, 52, 4, 'rgba(0,0,0,.3)');
    if (state === 'ruin') {
        R(g, 8, 54, 48, 9, '#5f6872');
        R(g, 12, 48, 14, 8, '#7d8791');
        R(g, 30, 50, 18, 7, P.l2);
        R(g, 20, 44, 9, 5, '#a5afb9');
        R(g, 38, 46, 7, 4, '#6b7480');
        R(g, 8, 60, 10, 3, '#6b7480');
        R(g, 44, 60, 10, 3, '#7d8791');
        R(g, 26, 42, 3, 4, T.dark);
        return c;
    }
    R(g, 6, 46, 52, 17, P.out);
    brick(g, 7, 47, 50, 15, P.a, P.l1);
    R(g, 12, 18, 40, 30, P.out);
    brick(g, 13, 19, 38, 28, P.b, P.l2);
    R(g, 13, 19, 4, 28, P.hi);
    R(g, 47, 19, 4, 28, P.l2);
    // puerta y estandarte
    R(g, 26, 34, 12, 14, '#2b1d12');
    R(g, 27, 35, 10, 13, '#6b4423');
    R(g, 31, 35, 2, 13, '#4d3218');
    R(g, 19, 22, 26, 8, T.dark);
    R(g, 20, 22, 24, 6, T.main);
    R(g, 20, 22, 24, 2, T.light);
    // torretas laterales
    for (const x of [4, 50]) {
        R(g, x, 26, 10, 22, P.out);
        brick(g, x + 1, 27, 8, 20, P.b, P.l2);
        R(g, x - 1, 22, 12, 6, P.out);
        R(g, x, 23, 10, 4, T.main);
        R(g, x, 23, 10, 1, T.light);
    }
    // almenas
    R(g, 10, 12, 44, 8, P.out);
    for (let i = 0; i < 5; i++)
        R(g, 11 + i * 9, 8, 7, 8, P.out);
    for (let i = 0; i < 5; i++) {
        R(g, 12 + i * 9, 9, 5, 6, P.cren);
        R(g, 12 + i * 9, 9, 5, 1, P.crenHi);
    }
    // corona (dorada si está activa, gris si duerme)
    const gold = state === 'on';
    const c1 = gold ? '#f6c945' : P.l2, c2 = gold ? '#ffe98a' : '#aab3bd', c3 = gold ? '#b9831b' : '#5f6872';
    R(g, 24, 3, 16, 7, c3);
    R(g, 25, 4, 14, 5, c1);
    R(g, 24, 0, 4, 5, c1);
    R(g, 30, -1, 4, 6, c1);
    R(g, 36, 0, 4, 5, c1);
    R(g, 25, 4, 14, 1, c2);
    if (gold) {
        R(g, 31, 5, 2, 2, T.main);
    }
    else {
        R(g, 44, 2, 2, 1, '#e8f0ff');
        R(g, 46, 0, 3, 1, '#e8f0ff');
        R(g, 44, 0, 1, 2, '#e8f0ff');
    }
    return c;
}
/** Grietas y pedazos que faltan: la torre se ve dañada al perder vida. */
function damaged(src, level, seed) {
    const [c, g] = mk(src.width, src.height);
    g.drawImage(src, 0, 0);
    const rng = new Rng(seed);
    const w = src.width, h = src.height;
    g.fillStyle = 'rgba(20,24,32,.85)';
    const n = level === 1 ? 4 : 9;
    for (let i = 0; i < n; i++) {
        let x = rng.range(w * 0.22, w * 0.78), y = rng.range(h * 0.28, h * 0.62);
        const len = rng.range(5, 12);
        for (let k = 0; k < len; k++) {
            g.fillRect(Math.round(x), Math.round(y), 1, 1);
            x += rng.next() < 0.5 ? 1 : -1;
            y += 1;
        }
    }
    if (level === 2) {
        // mordiscos en las almenas y manchas de hollín
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 3; i++)
            g.fillRect(Math.round(rng.range(w * 0.2, w * 0.75)), Math.round(h * 0.1 + rng.range(0, 6)), 4, 3);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = 'rgba(0,0,0,.22)';
        for (let i = 0; i < 6; i++)
            g.fillRect(Math.round(rng.range(w * 0.2, w * 0.7)), Math.round(rng.range(h * 0.2, h * 0.55)), 6, 3);
    }
    return c;
}
export function bakeTowerArt(P = STONE_DEFAULT) {
    const out = {};
    for (const team of [0, 1]) {
        out[`${team}-side-on`] = sideTower(team, 'on', P);
        out[`${team}-side-off`] = out[`${team}-side-on`];
        out[`${team}-side-ruin`] = sideTower(team, 'ruin', P);
        out[`${team}-side-d1`] = damaged(out[`${team}-side-on`], 1, 11 + team);
        out[`${team}-side-d2`] = damaged(out[`${team}-side-on`], 2, 21 + team);
        out[`${team}-king-on`] = kingTower(team, 'on', P);
        out[`${team}-king-off`] = kingTower(team, 'off', P);
        out[`${team}-king-ruin`] = kingTower(team, 'ruin', P);
        out[`${team}-king-d1`] = damaged(out[`${team}-king-on`], 1, 31 + team);
        out[`${team}-king-d2`] = damaged(out[`${team}-king-on`], 2, 41 + team);
    }
    return out;
}
