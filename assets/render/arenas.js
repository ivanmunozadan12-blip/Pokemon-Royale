import { CONFIG } from "../config.js";
import { Rng } from "../sim/rng.js";
import { towerLayout } from "../sim/field.js";
import { PX, R, disc, mk } from "./art.js";
const F = CONFIG.field;
export const THEMES = {
    pewter: {
        id: 'pewter',
        grass: { enemy: ['#a58a67', '#9c8260'], player: ['#b09470', '#a68b69'] },
        blotch: ['rgba(70,50,30,.14)', 'rgba(240,215,170,.10)'],
        speck: ['#8a6f4f', '#c4a77f'],
        path: { edge: '#6e5a42', fill: '#cdb48c', a: '#bda27a', b: '#ddc9a4', kind: 'dirt' },
        river: { base: '#4f7fa8', hi: '#6a9cc4', lo: '#3f6a90', foam: '#dbe9f2', sand: '#c9b48a', kind: 'stream' },
        bridge: { deck: '#8d8a86', line: '#6c6966', edge: '#4d4b49', rail: '#6b6865', railHi: '#a7a39e', kind: 'stone' },
        plaza: { rim: '#5b5148', player: '#9c9aa8', enemy: '#a8908c' },
        stone: { a: '#b79b78', b: '#c9ae8a', l1: '#8f7656', l2: '#a1875f', hi: '#e2cca8', cren: '#d8bf98', crenHi: '#f3e3c4', base: '#a58a66', baseLine: '#7e6446', out: '#3b2c1c' },
        fence: { post: '#6b5a48', rail: '#8b7860', hi: '#b3a086', kind: 'wall' },
        surround: { base: '#8f7656', dark: '#7a6247', light: '#a58a66' },
        props: [['boulder', 3], ['stalag', 3], ['rock', 3], ['deadtree', 1], ['pillar', 1]],
        ambient: { kind: 'dust', color: '#e3cfa6' },
        accent: '#d9b27a',
    },
    cerulean: {
        id: 'cerulean',
        grass: { enemy: ['#9fd6e8', '#93cde0'], player: ['#a9ddee', '#9dd4e6'] },
        blotch: ['rgba(40,110,170,.10)', 'rgba(255,255,255,.14)'],
        speck: ['#7cbad2', '#e6f7ff'],
        path: { edge: '#5d93b0', fill: '#f2f7f9', a: '#dce9ef', b: '#ffffff', kind: 'tiles' },
        river: { base: '#1f8fe0', hi: '#4fb4f2', lo: '#1676c4', foam: '#ffffff', sand: '#eef6f8', kind: 'pool' },
        bridge: { deck: '#f2f4f6', line: '#c3ccd4', edge: '#7c8e9c', rail: '#e44b4b', railHi: '#ffffff', kind: 'dock' },
        plaza: { rim: '#4f86a6', player: '#a9c4ea', enemy: '#e3b3c0' },
        stone: { a: '#c9e3f2', b: '#dff1fa', l1: '#92b9d1', l2: '#a7c9de', hi: '#ffffff', cren: '#eaf6fd', crenHi: '#ffffff', base: '#b5d3e6', baseLine: '#82a9c2', out: '#27506b' },
        fence: { post: '#e9eef2', rail: '#ff6a6a', hi: '#ffffff', kind: 'rope' },
        surround: { base: '#7dc0d8', dark: '#63aac6', light: '#a3dcee' },
        props: [['palm', 2], ['parasol', 2], ['buoy', 2], ['fountain', 1], ['bush', 1], ['starfish', 2]],
        ambient: { kind: 'bubble', color: '#e8fbff' },
        accent: '#5fc4ff',
    },
    vermilion: {
        id: 'vermilion',
        grass: { enemy: ['#5b6270', '#535a67'], player: ['#646c7b', '#5b6371'] },
        blotch: ['rgba(10,14,24,.18)', 'rgba(255,230,120,.07)'],
        speck: ['#454b57', '#8b94a5'],
        path: { edge: '#2e333d', fill: '#8a93a2', a: '#7b8493', b: '#9aa3b2', kind: 'plates' },
        river: { base: '#0f3d57', hi: '#2fa8d8', lo: '#0a2c40', foam: '#fff27a', sand: '#d9b625', kind: 'canal' },
        bridge: { deck: '#7d8694', line: '#505865', edge: '#2e333d', rail: '#f2c418', railHi: '#fff08a', kind: 'metal' },
        plaza: { rim: '#2b303a', player: '#7f9ac4', enemy: '#c49090' },
        stone: { a: '#8f98a8', b: '#a6afbf', l1: '#5f6776', l2: '#727b8b', hi: '#d5dbe6', cren: '#c4ccd8', crenHi: '#fff08a', base: '#7d8594', baseLine: '#4e5562', out: '#1a1e27' },
        fence: { post: '#f2c418', rail: '#3a3f4a', hi: '#fff08a', kind: 'chain' },
        surround: { base: '#454b57', dark: '#363b46', light: '#58606e' },
        props: [['pylon', 3], ['crate', 3], ['barrel', 2], ['lamp', 2], ['sandbag', 2]],
        ambient: { kind: 'spark', color: '#fff27a' },
        accent: '#ffd83d',
    },
    celadon: {
        id: 'celadon',
        grass: { enemy: ['#6cb860', '#64b058'], player: ['#74c068', '#6bb860'] },
        blotch: ['rgba(20,100,50,.12)', 'rgba(255,250,170,.10)'],
        speck: ['#4f9a47', '#a9e08a'],
        path: { edge: '#7e8a86', fill: '#d8dbd2', a: '#c3c8be', b: '#eceee6', kind: 'stones' },
        river: { base: '#3aa38f', hi: '#66c9b3', lo: '#2b8372', foam: '#f2fff8', sand: '#d9cfa0', kind: 'pond' },
        bridge: { deck: '#b57a46', line: '#8c5a2c', edge: '#5a3a1c', rail: '#d4474f', railHi: '#ff8a8f', kind: 'arch' },
        plaza: { rim: '#5d6e66', player: '#a4c0d4', enemy: '#d4aeb4' },
        stone: { a: '#c9d6c8', b: '#dbe6d9', l1: '#92a891', l2: '#a8bba7', hi: '#f2faf0', cren: '#e6efe4', crenHi: '#ffffff', base: '#b7c7b6', baseLine: '#869c85', out: '#2b4332' },
        fence: { post: '#a56a3c', rail: '#3f9a48', hi: '#8ee07f', kind: 'hedge' },
        surround: { base: '#5aa24f', dark: '#48893f', light: '#7cc46e' },
        props: [['sakura', 3], ['tree', 2], ['hedge', 2], ['flowerbed', 3], ['lantern', 2]],
        ambient: { kind: 'petal', color: '#ffc8dc' },
        accent: '#7be07a',
    },
};
/* Seis temas nuevos mantienen la misma escala 16 px/casilla, perspectiva y composición de las arenas originales. */
const themeVariant = (id, from, patch) => {
    const src = THEMES[from];
    const out = { ...src, id };
    for (const [key, value] of Object.entries(patch))
        out[key] = value && typeof value === 'object' && !Array.isArray(value)
            ? { ...src[key], ...value }
            : value;
    return out;
};
Object.assign(THEMES, {
    fuchsia: themeVariant('fuchsia', 'celadon', {
        grass: { enemy: ['#6b8270', '#5c7463'], player: ['#77947a', '#68866d'] },
        blotch: ['rgba(55,30,70,.20)', 'rgba(150,220,110,.12)'], speck: ['#48674f', '#9bbd85'],
        path: { edge: '#44364f', fill: '#b9b3a0', a: '#9c9a8c', b: '#d7d1bb', kind: 'stones' },
        river: { base: '#477b58', hi: '#88b76a', lo: '#304f42', foam: '#c5ee8c', sand: '#6e9360', kind: 'toxic' },
        bridge: { deck: '#625b49', line: '#3f3b34', edge: '#282b29', rail: '#8eae65', railHi: '#d1e89a', kind: 'stone' },
        plaza: { rim: '#4b4b42', player: '#8baf80', enemy: '#9e8ca9' },
        fence: { post: '#514b43', rail: '#7a946b', hi: '#b6d59b', kind: 'bamboo' },
        surround: { base: '#536b57', dark: '#3d5545', light: '#71876c' },
        props: [['bamboo', 3], ['toxic_vent', 2], ['bush', 2], ['mushroom', 2], ['lantern', 1]],
        ambient: { kind: 'spore', color: '#bce58a' }, accent: '#b4df80',
    }),
    saffron: themeVariant('saffron', 'celadon', {
        grass: { enemy: ['#665a91', '#5c4f86'], player: ['#7765a5', '#6b5b98'] },
        blotch: ['rgba(220,150,255,.14)', 'rgba(80,40,140,.18)'], speck: ['#8977b9', '#c4b6ed'],
        path: { edge: '#3e315e', fill: '#b5a6d7', a: '#8c7ab7', b: '#d8cafa', kind: 'tiles' },
        river: { base: '#4c3d8c', hi: '#a98df2', lo: '#30245e', foam: '#e5d8ff', sand: '#9580d2', kind: 'psychic' },
        bridge: { deck: '#9d8cc8', line: '#d8cafa', edge: '#42325f', rail: '#9d8aff', railHi: '#f0e8ff', kind: 'glass' },
        plaza: { rim: '#3f315b', player: '#a8a0e6', enemy: '#e4a7d8' },
        fence: { post: '#4a3a70', rail: '#a98df2', hi: '#eadfff', kind: 'crystal' },
        surround: { base: '#514374', dark: '#392d5c', light: '#7666a0' },
        props: [['psychic_crystal', 3], ['orb', 2], ['pillar', 2], ['lantern', 1]],
        ambient: { kind: 'spark', color: '#e5d8ff' }, accent: '#c7a8ff',
    }),
    cinnabar: themeVariant('cinnabar', 'vermilion', {
        grass: { enemy: ['#493d43', '#3e343b'], player: ['#5b4544', '#4b3b3c'] },
        blotch: ['rgba(255,80,20,.16)', 'rgba(255,210,80,.08)'], speck: ['#6d4c47', '#c16a43'],
        path: { edge: '#2b2428', fill: '#66565a', a: '#4d4147', b: '#8d6b68', kind: 'plates' },
        river: { base: '#3b2027', hi: '#ff6b2c', lo: '#24191f', foam: '#ffe16b', sand: '#c84d27', kind: 'lava' },
        bridge: { deck: '#373036', line: '#6d4140', edge: '#1e1a20', rail: '#b74c30', railHi: '#ffb34e', kind: 'obsidian' },
        plaza: { rim: '#2b2229', player: '#86534d', enemy: '#a75a45' },
        fence: { post: '#2b2428', rail: '#d35b32', hi: '#ffcb62', kind: 'chain' },
        surround: { base: '#392b30', dark: '#241d23', light: '#634044' },
        props: [['volcano', 3], ['flame', 3], ['rock', 2], ['toxic_vent', 1]],
        ambient: { kind: 'ember', color: '#ff9b42' }, accent: '#ff7638',
    }),
    viridian: themeVariant('viridian', 'pewter', {
        grass: { enemy: ['#496e43', '#3f633b'], player: ['#56804b', '#4b7243'] },
        blotch: ['rgba(25,55,35,.18)', 'rgba(175,190,90,.10)'], speck: ['#315734', '#89a86a'],
        path: { edge: '#354a3a', fill: '#9b9b78', a: '#7e8964', b: '#c0b991', kind: 'stones' },
        river: { base: '#416c55', hi: '#72a778', lo: '#2d4e40', foam: '#b6d7a4', sand: '#8c9d6c', kind: 'stream' },
        bridge: { deck: '#817c62', line: '#5b5a47', edge: '#34392e', rail: '#71845a', railHi: '#c0c99a', kind: 'stone' },
        plaza: { rim: '#3e4c3c', player: '#8eaa84', enemy: '#a7a08b' },
        fence: { post: '#394633', rail: '#6d8a58', hi: '#b3c994', kind: 'hedge' },
        surround: { base: '#405c40', dark: '#2d462f', light: '#5d7952' },
        props: [['tree', 3], ['boulder', 2], ['hedge', 2], ['mossy_rock', 2], ['pillar', 1]],
        ambient: { kind: 'leaf', color: '#c4dc87' }, accent: '#a6ce72',
    }),
    'victory-road': themeVariant('victory-road', 'pewter', {
        grass: { enemy: ['#626d7a', '#525d6b'], player: ['#727d8a', '#606d7a'] },
        blotch: ['rgba(25,32,48,.22)', 'rgba(190,205,220,.09)'], speck: ['#465260', '#a3afbd'],
        path: { edge: '#303a49', fill: '#9ca7b2', a: '#7e8a98', b: '#c4cbd1', kind: 'stones' },
        river: { base: '#355d7a', hi: '#6997b5', lo: '#263f58', foam: '#d9e6ef', sand: '#9aa9ae', kind: 'stream' },
        bridge: { deck: '#737d89', line: '#4d5865', edge: '#2b3541', rail: '#596574', railHi: '#bac5d0', kind: 'stone' },
        plaza: { rim: '#394452', player: '#8d9daf', enemy: '#b2a1a0' },
        surround: { base: '#4d5966', dark: '#333f4c', light: '#687785' },
        props: [['mountain', 3], ['boulder', 3], ['stalag', 2], ['rock', 2], ['pillar', 1]],
        ambient: { kind: 'dust', color: '#c3d0dd' }, accent: '#b9c9db',
    }),
    'indigo-plateau': themeVariant('indigo-plateau', 'cerulean', {
        grass: { enemy: ['#7887a7', '#6a7897'], player: ['#8798b7', '#7889a8'] },
        blotch: ['rgba(38,48,100,.15)', 'rgba(255,225,130,.12)'], speck: ['#65769a', '#d5d9e8'],
        path: { edge: '#4d5677', fill: '#e3e4e7', a: '#c4c8d3', b: '#ffffff', kind: 'tiles' },
        river: { base: '#3f5084', hi: '#8ba4dc', lo: '#29345f', foam: '#f5f6ff', sand: '#c4c8d3', kind: 'psychic' },
        bridge: { deck: '#c7cbd7', line: '#9ea7bb', edge: '#4b5574', rail: '#d8b65b', railHi: '#fff0a9', kind: 'marble' },
        plaza: { rim: '#46506c', player: '#c2cbe1', enemy: '#d9c4c8' },
        stone: { a: '#d5d8e1', b: '#f0f1f5', l1: '#9da8c0', l2: '#b5bed0', hi: '#ffffff', cren: '#f5f4ec', crenHi: '#fff3bb', base: '#c2c9d8', baseLine: '#8c98b0', out: '#343d5b' },
        fence: { post: '#4e5876', rail: '#d8b65b', hi: '#fff0a9', kind: 'wall' },
        surround: { base: '#566486', dark: '#3d4b6b', light: '#7c8bb0' },
        props: [['marble_column', 3], ['banner', 2], ['orb', 2], ['fountain', 1], ['crystal', 1]],
        ambient: { kind: 'spark', color: '#fff0a9' }, accent: '#e7ca72',
    }),
});
/* ───────── sprites de decorado (se hornean una vez) ───────── */
const propCache = new Map();
const ORIGINAL_ARENA_IDS = new Set(['pewter', 'cerulean', 'vermilion', 'celadon']);
function arenaSeed(id, base = 20241024) {
    if (ORIGINAL_ARENA_IDS.has(id)) return base + id.length * (base === 777 ? 1 : 977);
    let hash = base >>> 0;
    for (const ch of id) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
    return hash;
}
/** Dibuja un objeto en un lienzo de 56×56 con los pies en (28, 52). */
function makeProp(kind, th) {
    const key = `${th.id}:${kind}`;
    const hit = propCache.get(key);
    if (hit)
        return hit;
    const [c, g] = mk(56, 56);
    const x = 28, y = 52;
    const shade = () => R(g, x - 9, y - 1, 18, 3, 'rgba(0,0,0,.22)');
    switch (kind) {
        case 'tree':
            shade();
            R(g, x - 2, y - 14, 4, 15, '#6b4423');
            disc(g, x, y - 22, 11, '#1f6b2c');
            disc(g, x - 2, y - 24, 9, '#2f8a3a');
            disc(g, x - 4, y - 27, 4, '#59b862');
            break;
        case 'sakura':
            shade();
            R(g, x - 2, y - 14, 4, 15, '#6b4423');
            disc(g, x, y - 22, 12, '#e987a8');
            disc(g, x - 2, y - 24, 10, '#f6a8c2');
            disc(g, x - 4, y - 27, 5, '#ffd3e2');
            for (let i = 0; i < 6; i++)
                R(g, x - 9 + i * 3, y - 14 + (i % 2) * 8, 2, 2, '#ffe8f0');
            break;
        case 'bush':
        case 'hedge':
            shade();
            disc(g, x, y - 5, kind === 'hedge' ? 8 : 6, '#2a7a35');
            disc(g, x - 5, y - 4, 5, '#2a7a35');
            disc(g, x + 5, y - 4, 5, '#2a7a35');
            disc(g, x, y - 7, 5, '#3f9a48');
            R(g, x - 3, y - 9, 2, 2, '#7fd183');
            break;
        case 'rock':
            shade();
            R(g, x - 7, y - 6, 14, 8, '#8b7a66');
            R(g, x - 5, y - 9, 10, 4, '#a69480');
            R(g, x - 5, y - 6, 5, 3, '#bfae98');
            R(g, x - 7, y, 14, 2, '#5f5244');
            break;
        case 'boulder':
            shade();
            disc(g, x, y - 12, 13, '#6f6153');
            disc(g, x - 2, y - 14, 11, '#8a7a68');
            disc(g, x - 5, y - 18, 5, '#b5a48f');
            R(g, x - 4, y - 8, 9, 1, '#5a4d40');
            R(g, x + 1, y - 16, 1, 7, '#5a4d40');
            break;
        case 'stalag':
            shade();
            for (const [dx, h, w] of [[-6, 22, 5], [0, 32, 6], [6, 18, 4]]) {
                for (let r = 0; r < h; r++)
                    R(g, x + dx - Math.round(w * (1 - r / h) / 2), y - r, Math.max(1, Math.round(w * (1 - r / h))), 1, r % 5 < 2 ? '#a08c75' : '#85735e');
            }
            break;
        case 'pillar':
            shade();
            R(g, x - 5, y - 30, 10, 31, '#8a8178');
            R(g, x - 5, y - 30, 3, 31, '#aaa196');
            R(g, x - 7, y - 33, 14, 4, '#b8afa4');
            R(g, x - 7, y - 3, 14, 4, '#6e665e');
            break;
        case 'deadtree':
            shade();
            R(g, x - 2, y - 26, 4, 27, '#5a4430');
            R(g, x - 9, y - 22, 8, 2, '#5a4430');
            R(g, x + 1, y - 17, 9, 2, '#5a4430');
            R(g, x - 9, y - 26, 2, 5, '#5a4430');
            R(g, x + 8, y - 22, 2, 6, '#5a4430');
            break;
        case 'palm':
            shade();
            for (let i = 0; i < 24; i++)
                R(g, x - 1 + Math.round(Math.sin(i / 7) * 2), y - i, 3, 1, i % 3 ? '#a8794a' : '#8d6238');
            for (const [dx, dy] of [[-10, -4], [-6, -9], [0, -11], [6, -9], [10, -4]]) {
                for (let k = 0; k < 9; k++)
                    R(g, x + Math.round(dx * k / 9), y - 26 + Math.round(dy * k / 9) + Math.round(k * k / 30), 3, 2, '#2f9a4a');
            }
            R(g, x - 1, y - 27, 3, 3, '#7a4a22');
            break;
        case 'parasol':
            shade();
            R(g, x - 1, y - 22, 2, 23, '#e8e8e8');
            for (let i = 0; i < 6; i++)
                R(g, x - 12 + i * 4, y - 26 + Math.round(Math.abs(i - 2.5) * 1.2), 4, 6 - Math.round(Math.abs(i - 2.5)), i % 2 ? '#ffffff' : '#ff5a5a');
            break;
        case 'buoy':
            shade();
            disc(g, x, y - 7, 7, '#ffffff');
            for (let i = 0; i < 4; i++)
                R(g, x - 7 + i * 4, y - 12 + (i % 2) * 2, 3, 12, i % 2 ? '#ffffff' : '#ff4d4d');
            disc(g, x, y - 7, 2, '#7cc6e8');
            break;
        case 'fountain':
            shade();
            disc(g, x, y - 4, 11, '#9fc1d6');
            disc(g, x, y - 5, 9, '#4fb4f2');
            R(g, x - 2, y - 18, 4, 14, '#cfdde6');
            for (let i = 0; i < 5; i++)
                R(g, x - 4 + i * 2, y - 22 + Math.abs(i - 2) * 2, 1, 4, '#bfe9ff');
            break;
        case 'starfish':
            for (let a = 0; a < 5; a++) {
                const an = (a / 5) * Math.PI * 2 - Math.PI / 2;
                for (let r = 0; r < 7; r++)
                    R(g, x + Math.cos(an) * r, y - 6 + Math.sin(an) * r * 0.7, 2, 2, '#ff8a5a');
            }
            disc(g, x, y - 6, 2, '#ffb08a');
            break;
        case 'pylon':
            shade();
            R(g, x - 3, y - 28, 6, 29, '#4a505c');
            R(g, x - 5, y - 4, 10, 5, '#3a3f4a');
            for (let i = 0; i < 4; i++)
                R(g, x - 5 - i, y - 14 - i * 4, 10 + i * 2, 2, '#8b94a5');
            disc(g, x, y - 32, 5, '#ffe45a');
            disc(g, x, y - 32, 3, '#ffffff');
            R(g, x - 8, y - 33, 3, 1, '#fff27a');
            R(g, x + 6, y - 31, 3, 1, '#fff27a');
            break;
        case 'crate':
            shade();
            R(g, x - 9, y - 16, 18, 17, '#8a6a3a');
            R(g, x - 8, y - 15, 16, 15, '#a9854e');
            R(g, x - 9, y - 9, 18, 2, '#6b4f2a');
            R(g, x - 1, y - 16, 2, 17, '#6b4f2a');
            R(g, x - 7, y - 14, 3, 1, '#d4b074');
            break;
        case 'barrel':
            shade();
            R(g, x - 6, y - 15, 12, 16, '#3f5d86');
            R(g, x - 5, y - 15, 3, 16, '#5a80b0');
            R(g, x - 6, y - 11, 12, 2, '#2a3f5e');
            R(g, x - 6, y - 5, 12, 2, '#2a3f5e');
            R(g, x - 3, y - 14, 6, 2, '#f2c418');
            break;
        case 'lamp':
            shade();
            R(g, x - 1, y - 28, 3, 29, '#3a3f4a');
            R(g, x - 5, y - 31, 11, 4, '#4a505c');
            R(g, x - 4, y - 28, 9, 3, '#fff27a');
            R(g, x - 3, y - 25, 7, 2, 'rgba(255,242,122,.35)');
            break;
        case 'sandbag':
            shade();
            for (const [dx, dy] of [[-8, 0], [0, 0], [8, 0], [-4, -6], [4, -6]]) {
                R(g, x + dx - 5, y + dy - 6, 11, 6, '#b59a63');
                R(g, x + dx - 5, y + dy - 6, 11, 2, '#d1b97f');
            }
            break;
        case 'flowerbed':
            shade();
            R(g, x - 10, y - 5, 20, 6, '#3f8a3a');
            for (let i = 0; i < 9; i++) {
                const col = ['#ff6fa0', '#ffd23f', '#ffffff', '#c58aff'][i % 4];
                R(g, x - 9 + i * 2, y - 8 + (i % 3) * 2, 3, 3, col);
            }
            break;
        case 'lantern':
            shade();
            R(g, x - 1, y - 14, 3, 15, '#6b4423');
            R(g, x - 5, y - 24, 11, 11, '#ff7a3d');
            R(g, x - 4, y - 23, 9, 9, '#ffb25a');
            R(g, x - 5, y - 24, 11, 2, '#b8451c');
            R(g, x - 5, y - 15, 11, 2, '#b8451c');
            R(g, x - 2, y - 21, 5, 4, '#fff0a8');
            break;
        case 'bamboo':
            shade();
            for (const dx of [-7, -1, 5]) {
                R(g, x + dx, y - 34, 3, 34, '#426b3f');
                R(g, x + dx, y - 34, 1, 34, '#8fb66b');
                for (let yy = y - 25; yy < y - 2; yy += 10) R(g, x + dx - 1, yy, 5, 1, '#2e5035');
            }
            R(g, x - 9, y - 25, 10, 2, '#426b3f'); R(g, x + 2, y - 17, 9, 2, '#426b3f');
            break;
        case 'toxic_vent':
            shade();
            R(g, x - 10, y - 7, 20, 7, '#39463e'); R(g, x - 7, y - 12, 14, 5, '#526252');
            R(g, x - 5, y - 13, 10, 2, '#b8d85d');
            for (const [dx, dy] of [[-5, -18], [3, -22], [7, -15]]) disc(g, x + dx, y + dy, 3, '#8dcf65');
            break;
        case 'mushroom':
            shade();
            R(g, x - 2, y - 12, 5, 12, '#e5d8bb'); disc(g, x, y - 13, 9, '#6c3d87');
            disc(g, x - 2, y - 16, 6, '#9e67bd'); for (const [dx,dy] of [[-4,-15],[3,-17],[1,-10]]) disc(g,x+dx,y+dy,1,'#d8f08a');
            break;
        case 'psychic_crystal':
        case 'crystal':
            shade();
            R(g, x - 5, y - 2, 10, 3, '#51416f'); R(g, x - 6, y - 8, 12, 6, '#6e5ab1');
            R(g, x - 5, y - 20, 3, 12, '#a98df2'); R(g, x - 2, y - 28, 5, 8, '#e1d4ff');
            R(g, x + 3, y - 18, 3, 10, '#8c73d4'); R(g, x - 3, y - 18, 2, 8, '#f0e8ff');
            break;
        case 'orb':
            shade(); disc(g, x, y - 16, 10, '#55438e'); disc(g, x, y - 17, 7, '#a98df2');
            disc(g, x - 2, y - 20, 3, '#f0e8ff'); R(g, x - 1, y - 27, 2, 4, '#d8cafa');
            break;
        case 'flame':
            shade();
            R(g, x - 2, y - 3, 4, 3, '#7d3026'); R(g, x - 6, y - 7, 12, 5, '#ff572e');
            R(g, x - 4, y - 14, 8, 7, '#ff9d32'); R(g, x - 2, y - 20, 5, 7, '#ffe56b');
            R(g, x - 1, y - 12, 2, 5, '#fff4ad');
            break;
        case 'volcano':
            shade();
            R(g, x - 13, y - 6, 26, 6, '#302a31'); R(g, x - 10, y - 13, 20, 7, '#49363a');
            R(g, x - 6, y - 20, 12, 7, '#624448'); R(g, x - 3, y - 25, 6, 5, '#302a31');
            R(g, x - 3, y - 24, 6, 2, '#ff6b2c'); R(g, x - 1, y - 22, 3, 2, '#ffe16b');
            break;
        case 'mountain':
            shade();
            R(g, x - 15, y - 7, 30, 7, '#515e6b'); R(g, x - 11, y - 14, 22, 7, '#657382');
            R(g, x - 7, y - 22, 14, 8, '#7f8d9d'); R(g, x - 3, y - 29, 7, 7, '#b8c7d5');
            R(g, x - 1, y - 29, 2, 5, '#e7eef5');
            break;
        case 'mossy_rock':
            shade();
            disc(g, x, y - 8, 10, '#626e59'); disc(g, x - 2, y - 12, 7, '#879575');
            R(g, x - 7, y - 13, 5, 2, '#5fa05d'); R(g, x + 2, y - 8, 5, 2, '#6bb76b');
            break;
        case 'marble_column':
            shade();
            R(g, x - 7, y - 29, 14, 27, '#9da8c0'); R(g, x - 5, y - 28, 4, 25, '#f0f1f5');
            R(g, x - 8, y - 32, 16, 4, '#d8b65b'); R(g, x - 9, y - 2, 18, 3, '#b5bed0');
            R(g, x - 1, y - 26, 2, 22, '#ffffff');
            break;
        case 'banner':
            shade();
            R(g, x - 1, y - 35, 2, 35, '#d8b65b'); R(g, x - 8, y - 32, 16, 22, '#34466f');
            R(g, x - 6, y - 30, 12, 2, '#d8b65b'); R(g, x - 5, y - 24, 10, 2, '#d8b65b');
            R(g, x - 4, y - 18, 8, 2, '#d8b65b');
            break;
        default:
            shade();
            disc(g, x, y - 6, 6, '#2a7a35');
    }
    propCache.set(key, c);
    return c;
}
const artCache = new Map();
export function bakeArena(id) {
    const hit = artCache.get(id);
    if (hit)
        return hit;
    const th = THEMES[id];
    const W = F.w * PX;
    const H = F.h * PX;
    const [c, g] = mk(W, H);
    const rng = new Rng(arenaSeed(id));
    // suelo en damero + textura propia de cada gimnasio
    for (let ty = 0; ty < F.h; ty++) {
        for (let tx = 0; tx < F.w; tx++) {
            const set = ty < F.h / 2 ? th.grass.enemy : th.grass.player;
            R(g, tx * PX, ty * PX, PX, PX, (tx + ty) % 2 ? set[0] : set[1]);
        }
    }
    for (let i = 0; i < 38; i++) {
        const x = rng.range(0, W), y = rng.range(0, H);
        g.fillStyle = rng.next() < 0.5 ? th.blotch[0] : th.blotch[1];
        g.beginPath();
        g.ellipse(x, y, rng.range(10, 26), rng.range(6, 14), 0, 0, Math.PI * 2);
        g.fill();
    }
    for (let i = 0; i < 900; i++)
        R(g, rng.range(0, W), rng.range(0, H), 1, 1, rng.next() < 0.5 ? th.speck[0] : th.speck[1]);
    if (id === 'cerulean') {
        g.fillStyle = 'rgba(255,255,255,.55)';
        for (let x = 0; x < W; x += PX * 2)
            g.fillRect(x, 0, 1, H);
        for (let y = 0; y < H; y += PX * 2)
            g.fillRect(0, y, W, 1);
    }
    else if (id === 'vermilion') {
        for (let y = 0; y < H; y += PX * 2)
            for (let x = 0; x < W; x += PX * 2) {
                R(g, x + 1, y + 1, 1, 1, '#2a2f39');
                R(g, x + PX * 2 - 3, y + 1, 1, 1, '#2a2f39');
                R(g, x + 1, y + PX * 2 - 3, 1, 1, '#2a2f39');
                R(g, x + PX * 2 - 3, y + PX * 2 - 3, 1, 1, '#2a2f39');
            }
        g.fillStyle = 'rgba(0,0,0,.25)';
        for (let x = 0; x < W; x += PX * 2)
            g.fillRect(x, 0, 1, H);
        for (let y = 0; y < H; y += PX * 2)
            g.fillRect(0, y, W, 1);
    }
    else if (id === 'celadon') {
        for (let i = 0; i < 70; i++) {
            const col = ['#ff9ec0', '#ffffff', '#ffe27a', '#d9a8ff'][i % 4];
            const x = rng.range(4, W - 4), y = rng.range(4, H - 4);
            R(g, x, y, 2, 2, col);
            R(g, x + 1, y - 1, 1, 1, '#2f7a38');
        }
    }
    else if (id === 'saffron') {
        // Motivos geométricos psíquicos, en píxeles, sin invadir la lectura de los carriles.
        for (let y = 24; y < H - 24; y += 44) for (let x = 20; x < W - 20; x += 48) {
            R(g, x, y, 8, 1, 'rgba(231,216,255,.28)');
            R(g, x + 3, y - 3, 1, 7, 'rgba(231,216,255,.28)');
            R(g, x + 2, y - 2, 3, 3, 'rgba(231,216,255,.35)');
        }
    }
    else if (id === 'cinnabar') {
        // Grietas de lava contenidas en el suelo, fuera de los puentes y de las torres.
        for (let i = 0; i < 34; i++) {
            const x = rng.range(4, W - 8), y = rng.range(8, H - 8);
            if ([...F.bridgeXs].some((bx) => Math.abs(x / PX - bx) < 2.5)) continue;
            R(g, x, y, 5, 1, '#a8432c'); R(g, x + 3, y - 2, 1, 3, '#ff8a35');
        }
    }
    else if (id === 'viridian') {
        for (let i = 0; i < 80; i++) {
            const x = rng.range(4, W - 4), y = rng.range(4, H - 4);
            R(g, x, y, 3, 1, '#2f5737'); R(g, x + 1, y - 1, 2, 1, '#8fb66b');
        }
    }
    else if (id === 'victory-road') {
        for (let i = 0; i < 42; i++) {
            const x = rng.range(4, W - 8), y = rng.range(4, H - 8);
            R(g, x, y, 6, 2, '#465260'); R(g, x + 1, y - 1, 3, 1, '#a3afbd');
        }
    }
    else if (id === 'indigo-plateau') {
        for (let x = 8; x < W - 8; x += 32) {
            R(g, x, 8, 2, H - 16, 'rgba(216,182,91,.35)');
            R(g, x + 1, 8, 1, H - 16, 'rgba(255,240,169,.25)');
        }
    }
    else {
        for (let i = 0; i < 40; i++) {
            const x = rng.range(6, W - 8), y = rng.range(6, H - 8);
            R(g, x, y, 4, 2, '#7a634a');
            R(g, x, y, 4, 1, '#b79d78');
        }
    }
    // caminos por los dos carriles
    const path = (x0, y0, x1, y1) => {
        R(g, x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2, th.path.edge);
        R(g, x0, y0, x1 - x0, y1 - y0, th.path.fill);
        if (th.path.kind === 'dirt') {
            for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 22; i++)
                R(g, rng.range(x0, x1), rng.range(y0, y1), 1, 1, rng.next() < 0.5 ? th.path.a : th.path.b);
        }
        else {
            const step = th.path.kind === 'plates' ? 16 : th.path.kind === 'tiles' ? 16 : 10;
            for (let y = y0; y < y1; y += step)
                R(g, x0, y, x1 - x0, 1, th.path.a);
            for (let x = x0; x < x1; x += step + (th.path.kind === 'stones' ? 3 : 0))
                R(g, x, y0, 1, y1 - y0, th.path.a);
            if (th.path.kind === 'plates')
                for (let y = y0 + 2; y < y1; y += step)
                    for (let x = x0 + 2; x < x1; x += step)
                        R(g, x, y, 1, 1, '#555d6b');
        }
    };
    for (const bx of F.bridgeXs) {
        path((bx - 1.9) * PX, 3.2 * PX, (bx + 1.9) * PX, (F.riverY0 - 0.2) * PX);
        path((bx - 1.9) * PX, (F.riverY1 + 0.2) * PX, (bx + 1.9) * PX, (F.h - 3.2) * PX);
    }
    for (const ky of [CONFIG.towers.kingY.enemy, CONFIG.towers.kingY.player]) {
        const dir = ky < F.h / 2 ? 1 : -1;
        for (let s = 0; s <= 24; s++) {
            for (const bx of F.bridgeXs) {
                const px = F.centerX * PX + (bx - F.centerX) * PX * (s / 24);
                const py = (ky + dir * 1.2) * PX + dir * s * 1.6;
                R(g, px - 6, py - 4, 12, 8, th.path.fill);
            }
        }
    }
    // río
    const y0 = F.riverY0 * PX, y1 = F.riverY1 * PX;
    const RV = th.river;
    R(g, 0, y0, W, y1 - y0, RV.base);
    R(g, 0, y0 + 3, W, 4, RV.hi);
    R(g, 0, y1 - 8, W, 4, RV.lo);
    if (RV.kind === 'lava') {
        R(g, 0, y0, W, y1 - y0, '#3b2027');
        for (let x = 0; x < W; x += 13) {
            const yy = y0 + 5 + (Math.sin(x * 0.15) * 3);
            R(g, x, yy, 9, 2, '#ff6b2c'); R(g, x + 3, yy - 2, 4, 2, '#ffe16b');
            R(g, x + 7, yy + 4, 3, 2, '#c84d27');
        }
        for (let x = 5; x < W; x += 19) R(g, x, y1 - 6, 7, 2, '#ff8a35');
    }
    else if (RV.kind === 'toxic') {
        R(g, 0, y0, W, y1 - y0, '#477b58');
        for (let x = 0; x < W; x += 18) {
            const yy = (y0 + y1) / 2 + Math.sin(x * 0.13) * 5;
            R(g, x, yy, 11, 2, '#b8d85d'); R(g, x + 4, yy - 2, 5, 1, '#d8ef91');
        }
        for (let i = 0; i < 14; i++) disc(g, rng.range(4, W - 4), rng.range(y0 + 3, y1 - 3), rng.range(1, 3), i % 2 ? '#a8d65c' : '#d0ed83');
    }
    else if (RV.kind === 'psychic') {
        R(g, 0, y0, W, y1 - y0, RV.base);
        for (let x = 0; x < W; x += 24) {
            R(g, x, y0 + 5, 10, 1, RV.hi); R(g, x + 8, y0 + 6, 1, y1 - y0 - 12, 'rgba(229,216,255,.22)');
            R(g, x + 9, y1 - 6, 8, 1, RV.hi);
        }
    }
    else if (RV.kind === 'canal') {
        // hazard amarillo y negro en las orillas + arcos eléctricos
        for (let x = 0; x < W; x += 8) {
            R(g, x, y0 - 5, 4, 4, '#f2c418');
            R(g, x + 4, y0 - 5, 4, 4, '#1b1f27');
            R(g, x, y1 + 2, 4, 4, '#f2c418');
            R(g, x + 4, y1 + 2, 4, 4, '#1b1f27');
        }
        for (let k = 0; k < 7; k++) {
            let x = rng.range(0, W - 40), yy = rng.range(y0 + 6, y1 - 8);
            for (let i = 0; i < 18; i++) {
                R(g, x, yy, 2, 2, '#bff6ff');
                x += 2 + rng.range(0, 2);
                yy += rng.range(-2, 2.9) | 0;
                yy = Math.max(y0 + 4, Math.min(y1 - 6, yy));
            }
        }
    }
    else {
        for (let x = 0; x < W; x += 2) {
            const j = (Math.sin(x * 0.7) * 1.2) | 0;
            R(g, x, y0 - 2 + j, 2, 2, RV.foam);
            R(g, x, y1 + j, 2, 2, RV.foam);
        }
        R(g, 0, y0 - 5, W, 3, RV.sand);
        R(g, 0, y1 + 3, W, 3, RV.sand);
    }
    if (RV.kind === 'pool') {
        // corcheras de la piscina (cuerda roja y blanca) a lo largo del río
        const my = (y0 + y1) / 2;
        for (let x = 0; x < W; x += 6) {
            R(g, x, my - 1, 3, 2, (x / 6) % 2 ? '#ffffff' : '#ff4d4d');
            R(g, x + 3, my - 1, 3, 2, (x / 6) % 2 ? '#ff4d4d' : '#ffffff');
        }
    }
    if (RV.kind === 'pool' || RV.kind === 'pond') {
        for (let i = 0; i < 9; i++) {
            const x = rng.range(10, W - 10), yy = rng.range(y0 + 6, y1 - 8);
            if (F.bridgeXs.some((b) => Math.abs(x / PX - b) < 2.4))
                continue;
            disc(g, x, yy, 4, RV.kind === 'pond' ? '#2f9a55' : '#3fb86a');
            R(g, x, yy - 4, 1, 4, RV.base);
            if (RV.kind === 'pond' && i % 2 === 0)
                disc(g, x + 1, yy - 1, 2, '#ff8ab4');
        }
    }
    if (RV.kind === 'stream') {
        for (const sx of [2.2, 6.4, 9.6, 12.3, 16]) {
            if (F.bridgeXs.some((b) => Math.abs(sx - b) < 2.2))
                continue;
            R(g, sx * PX - 5, (y0 + y1) / 2 - 3, 10, 6, '#7d7468');
            R(g, sx * PX - 4, (y0 + y1) / 2 - 4, 8, 3, '#9a9186');
        }
    }
    // puentes (cada gimnasio tiene el suyo)
    for (const bx of F.bridgeXs) {
        const x0 = (bx - F.bridgeHalfW) * PX, x1 = (bx + F.bridgeHalfW) * PX;
        const by0 = y0 - 7, by1 = y1 + 7;
        const B = th.bridge;
        R(g, x0 - 2, by0, x1 - x0 + 4, by1 - by0, B.edge);
        R(g, x0, by0, x1 - x0, by1 - by0, B.deck);
        if (B.kind === 'stone') {
            for (let y = by0 + 6; y < by1; y += 8)
                R(g, x0, y, x1 - x0, 1, B.line);
            for (let y = by0, r = 0; y < by1; y += 8, r++)
                for (let x = x0 + (r % 2 ? 6 : 0); x < x1; x += 12)
                    R(g, x, y, 1, 8, B.line);
        }
        else if (B.kind === 'metal') {
            for (let y = by0 + 3; y < by1; y += 4)
                R(g, x0, y, x1 - x0, 1, B.line);
            for (let x = x0 + 3; x < x1; x += 6)
                for (let y = by0 + 1; y < by1; y += 8)
                    R(g, x, y, 1, 1, '#aab3c2');
            for (let y = by0; y < by1; y += 8) {
                R(g, x0, y, 4, 4, '#f2c418');
                R(g, x0 + 4, y + 4, 4, 4, '#f2c418');
                R(g, x1 - 8, y, 4, 4, '#f2c418');
                R(g, x1 - 4, y + 4, 4, 4, '#f2c418');
            }
        }
        else if (B.kind === 'glass') {
            for (let y = by0 + 2; y < by1; y += 8) {
                R(g, x0, y, x1 - x0, 1, B.line);
                for (let x = x0 + 4; x < x1; x += 12) R(g, x, y + 1, 1, 6, '#e5d8ff');
            }
            R(g, x0 + 2, by0 + 2, x1 - x0 - 4, 2, 'rgba(255,255,255,.28)');
        }
        else if (B.kind === 'obsidian') {
            for (let y = by0 + 3; y < by1; y += 6) {
                R(g, x0, y, x1 - x0, 1, B.line);
                for (let x = x0 + 3; x < x1; x += 17) R(g, x, y + 1, 5, 1, '#ff6b2c');
            }
        }
        else if (B.kind === 'marble') {
            for (let y = by0 + 5; y < by1; y += 8) R(g, x0, y, x1 - x0, 1, B.line);
            for (let x = x0 + 8; x < x1; x += 16) R(g, x, by0, 1, by1 - by0, '#d8b65b');
            R(g, x0 + 2, by0 + 2, x1 - x0 - 4, 1, '#ffffff');
        }
        else {
            for (let y = by0 + 2; y < by1; y += 4)
                R(g, x0, y, x1 - x0, 1, B.line);
            for (let y = by0 + 4; y < by1; y += 8)
                R(g, x0 + 2, y, 3, 1, 'rgba(255,255,255,.35)');
        }
        // barandillas
        R(g, x0 - 3, by0 - 2, 5, by1 - by0 + 4, B.rail);
        R(g, x1 - 2, by0 - 2, 5, by1 - by0 + 4, B.rail);
        for (let y = by0; y < by1; y += 12) {
            R(g, x0 - 3, y, 5, 3, B.railHi);
            R(g, x1 - 2, y, 5, 3, B.railHi);
        }
        if (B.kind === 'arch') {
            for (let y = by0; y < by1; y += 6) {
                R(g, x0 - 4, y + (y % 12 ? 0 : 2), 2, 3, '#3f9a48');
                R(g, x1 + 2, y + (y % 12 ? 2 : 0), 2, 3, '#3f9a48');
            }
        }
    }
    // plazas bajo las torres
    for (const t of towerLayout()) {
        const r = (t.kind === 'king' ? CONFIG.towers.king.radius : CONFIG.towers.side.radius) * PX + 6;
        disc(g, t.x * PX, t.y * PX + 3, r, th.plaza.rim);
        disc(g, t.x * PX, t.y * PX + 3, r - 2, t.team === 0 ? th.plaza.player : th.plaza.enemy);
        for (let i = 0; i < 14; i++) {
            const a = rng.range(0, Math.PI * 2), d = rng.range(0, r - 4);
            R(g, t.x * PX + Math.cos(a) * d, t.y * PX + 3 + Math.sin(a) * d, 2, 1, 'rgba(0,0,0,.18)');
        }
    }
    // decorado dentro del campo: solo junto a los bordes, lejos de caminos y torres
    const blocked = (x, y) => {
        const tx = x / PX, ty = y / PX;
        for (const bx of F.bridgeXs)
            if (Math.abs(tx - bx) < 2.6)
                return true;
        if (ty > F.riverY0 - 1 && ty < F.riverY1 + 1)
            return true;
        for (const t of towerLayout())
            if (Math.hypot(tx - t.x, ty - t.y) < 3.6)
                return true;
        return false;
    };
    const deco = [];
    const weights = th.props.flatMap(([k, w]) => Array(w).fill(k));
    for (let i = 0; i < 260 && deco.length < 30; i++) {
        const x = rng.range(10, W - 10), y = rng.range(16, H - 6);
        if (blocked(x, y))
            continue;
        if (deco.some((d) => Math.hypot(d.x - x, d.y - y) < 26))
            continue;
        const edge = x < 2.6 * PX || x > W - 2.6 * PX;
        if (!edge && rng.next() < 0.6)
            continue;
        deco.push({ kind: weights[Math.floor(rng.next() * weights.length)], x, y });
    }
    deco.sort((a, b) => a.y - b.y);
    for (const d of deco) {
        const sp = makeProp(d.kind, th);
        g.drawImage(sp, Math.round(d.x - 28), Math.round(d.y - 52));
    }
    // valla perimetral (0,6 casillas de grosor: coincide con el límite de despliegue)
    const FN = th.fence;
    const fb = 0.6 * PX;
    g.fillStyle = FN.post;
    R(g, 0, 0, W, fb, FN.post);
    R(g, 0, H - fb, W, fb, FN.post);
    R(g, 0, 0, fb, H, FN.post);
    R(g, W - fb, 0, fb, H, FN.post);
    R(g, 2, 2, W - 4, 3, FN.rail);
    R(g, 2, H - 5, W - 4, 3, FN.rail);
    R(g, 2, 2, 3, H - 4, FN.rail);
    R(g, W - 5, 2, 3, H - 4, FN.rail);
    for (let i = 0; i < W; i += 12) {
        R(g, i, 0, 3, fb, FN.hi);
        R(g, i, H - fb, 3, fb, FN.hi);
    }
    for (let i = 0; i < H; i += 12) {
        R(g, 0, i, fb, 3, FN.hi);
        R(g, W - fb, i, fb, 3, FN.hi);
    }
    const art = { canvas: c, theme: th };
    artCache.set(id, art);
    return art;
}
/**
 * Pinta TODO el fondo de una vez (decorado envolvente + campo en perspectiva) para que cada fotograma
 * solo tenga que copiarlo. Se rehace al cambiar el tamaño de pantalla o la arena.
 */
export function bakeBackground(cam, id) {
    const dpr = cam.dpr;
    const cw = Math.round(cam.W * dpr), ch = Math.round(cam.H * dpr);
    const [c, g] = mk(cw, ch);
    const th = THEMES[id];
    const art = bakeArena(id);
    const rng = new Rng(arenaSeed(id, 777));
    // 1) suelo envolvente
    g.fillStyle = th.surround.base;
    g.fillRect(0, 0, cw, ch);
    const grad = g.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, 'rgba(0,0,0,.28)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,.15)');
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);
    const top = cam.inv(0, 0);
    const minY = Math.max(-70, top.y - 4);
    const maxY = F.h + 4;
    const xAt = (sx, wy) => F.w / 2 + (sx - cam.cx) / cam.ts(wy);
    // manchas y briznas proyectadas
    for (let i = 0; i < 90; i++) {
        const wy = rng.range(minY, maxY);
        const wx = rng.range(xAt(0, wy), xAt(cam.W, wy));
        const px = cam.sx(wx, wy) * dpr, py = cam.sy(wy) * dpr;
        const s = cam.ts(wy) * dpr;
        g.fillStyle = rng.next() < 0.5 ? th.blotch[0] : th.blotch[1];
        g.beginPath();
        g.ellipse(px, py, s * rng.range(1.2, 3.4), s * rng.range(0.5, 1.3), 0, 0, Math.PI * 2);
        g.fill();
    }
    for (let i = 0; i < 700; i++) {
        const wy = rng.range(minY, maxY);
        const wx = rng.range(xAt(0, wy), xAt(cam.W, wy));
        const s = Math.max(1, Math.round(cam.ts(wy) * dpr * 0.1));
        g.fillStyle = rng.next() < 0.5 ? th.surround.dark : th.surround.light;
        g.fillRect(Math.round(cam.sx(wx, wy) * dpr), Math.round(cam.sy(wy) * dpr), s * 2, s);
    }
    // 2) campo en perspectiva: tiras horizontales del arte, estrechadas hacia el fondo
    g.imageSmoothingEnabled = false;
    const srcH = F.h * PX, srcW = F.w * PX;
    const r0 = Math.floor(cam.topY * dpr), r1 = Math.ceil(cam.baseY * dpr);
    for (let r = r0; r < r1; r++) {
        const p = cam.inv(cam.cx, (r + 0.5) / dpr);
        const sy = Math.max(0, Math.min(srcH - 1, Math.floor((p.y / F.h) * srcH)));
        const hw = cam.halfW(p.y) * dpr;
        g.drawImage(art.canvas, 0, sy, srcW, 1, Math.round(cam.cx * dpr - hw), r, Math.round(hw * 2), 1);
    }
    // sombra del borde de la valla sobre el suelo
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.fillRect(0, Math.round(cam.baseY * dpr), cw, Math.round(4 * dpr));
    const props = [];
    const kinds = th.props.flatMap(([k, w]) => Array(w).fill(k));
    for (let wy = minY; wy < maxY; wy += 2.1) {
        const lx = xAt(-40, wy), rx = xAt(cam.W + 40, wy);
        for (let wx = lx; wx < rx; wx += 2.6) {
            const jx = wx + rng.range(-0.9, 0.9), jy = wy + rng.range(-0.8, 0.8);
            const inField = jx > -1.7 && jx < F.w + 1.7 && jy > -1.2 && jy < F.h + 1.2;
            if (inField || rng.next() < 0.28)
                continue;
            props.push({ kind: kinds[Math.floor(rng.next() * kinds.length)], wx: jx, wy: jy });
        }
    }
    props.sort((a, b) => a.wy - b.wy);
    for (const p of props) {
        const sp = makeProp(p.kind, th);
        const sc = (cam.ts(p.wy) * dpr) / PX;
        const w = sp.width * sc, hh = sp.height * sc;
        const px = cam.sx(p.wx, p.wy) * dpr, py = cam.sy(p.wy) * dpr;
        if (px + w < 0 || px - w > cw || py - hh > ch || py + hh * 0.2 < 0)
            continue;
        g.drawImage(sp, Math.round(px - w / 2), Math.round(py - hh * (52 / 56)), Math.round(w), Math.round(hh));
    }
    return { canvas: c, key: `${id}:${cw}x${ch}:${cam.fw}:${cam.baseY}` };
}
