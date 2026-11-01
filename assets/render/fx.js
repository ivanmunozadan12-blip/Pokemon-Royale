/**
 * Biblioteca de efectos para los ataques. TODO lo que hay aquí es solo visual: el daño y las reglas viven en
 * `sim/battle.ts`, que no sabe nada de partículas. Cada uno de los 17 tipos tiene proyectil, estela e impacto propios
 * (forma, paleta, movimiento) para reconocerse a simple vista; los especiales usan versiones mucho más grandes.
 * Todo se posiciona en el SUELO (x, y en casillas) más una altura z, y se proyecta con la cámara en perspectiva.
 */
export const PALETTE = {
    fuego: ['#ff4d17', '#ff9a1f', '#ffd23f'],
    agua: ['#2f7fe0', '#6cbcff', '#e4f5ff'],
    electrico: ['#ffe84a', '#ffd000', '#ffffff'],
    planta: ['#3f9a48', '#7fd183', '#c9f2a6'],
    hielo: ['#b5f0ff', '#78d3ee', '#ffffff'],
    tierra: ['#b8894a', '#8a6a38', '#dcbc80'],
    roca: ['#8b95a0', '#a8b2bd', '#5b646e'],
    psiquico: ['#ff6fa0', '#ffa6c6', '#ffe2ee'],
    fantasma: ['#7a56b8', '#4a2f78', '#b48ae8'],
    veneno: ['#b04cc4', '#7a2a92', '#e48cff'],
    lucha: ['#e03a28', '#ffb066', '#fff0cc'],
    normal: ['#ffffff', '#f0e4c4', '#c8c8b8'],
    volador: ['#dce9ff', '#a8c2f2', '#ffffff'],
    bicho: ['#a8c11c', '#d6e85c', '#4e5f10'],
    dragon: ['#6a3af0', '#a384ff', '#ffd24a'],
    siniestro: ['#3f2f38', '#6f5668', '#b392a4'],
    acero: ['#c3cbdf', '#8a92aa', '#ffffff'],
};
const Shape = { Sq: 0, Circle: 1, Leaf: 2, Spark: 3, Plus: 4, Star: 5, Flame: 6, Drop: 7, Shard: 8, Smoke: 9, Ring: 10 };
export function fxSettingsFor(quality, reduce, shake) {
    if (reduce)
        return { maxParticles: 40, trails: false, shake: false, density: 0.25, glow: false };
    if (quality === 'baja')
        return { maxParticles: 90, trails: false, shake, density: 0.45, glow: false };
    if (quality === 'media')
        return { maxParticles: 200, trails: true, shake, density: 0.75, glow: true };
    return { maxParticles: 380, trails: true, shake, density: 1, glow: true };
}
const MAX_FLOATS = 36;
const MAX_RINGS = 44;
const MAX_BEAMS = 14;
const MAX_FLARES = 24;
const MAX_RAYS = 40;
const MAX_SLASH = 12;
export class Fx {
    parts = [];
    rings = [];
    beams = [];
    floats = [];
    flares = [];
    rays = [];
    slashes = [];
    cracks = [];
    pillars = [];
    shakeAmp = 0;
    /** Destello de pantalla completa (0..1) y su color. */
    flashA = 0;
    flashColor = '#ffffff';
    cfg;
    rnd;
    constructor(cfg, rnd = Math.random) {
        this.cfg = cfg;
        this.rnd = rnd;
    }
    clear() {
        this.parts.length = this.rings.length = this.beams.length = this.floats.length = 0;
        this.flares.length = this.rays.length = this.slashes.length = this.cracks.length = this.pillars.length = 0;
        this.shakeAmp = 0;
        this.flashA = 0;
    }
    get count() {
        return this.parts.length + this.rings.length + this.beams.length + this.floats.length + this.flares.length + this.rays.length + this.slashes.length;
    }
    r(a, b) {
        return a + this.rnd() * (b - a);
    }
    pick(pal) {
        return pal[Math.floor(this.rnd() * pal.length)];
    }
    add(p) {
        if (this.parts.length >= this.cfg.maxParticles)
            this.parts.shift();
        const max = p.max ?? 0.5;
        this.parts.push({ z: 0.3, vx: 0, vy: 0, vz: 0, size: 0.2, shape: Shape.Sq, rot: 0, vr: 0, grav: 0, drag: 0, grow: 0, add: false, ...p, life: max, max });
    }
    shake(amp) {
        if (!this.cfg.shake)
            return;
        this.shakeAmp = Math.min(0.6, Math.max(this.shakeAmp, amp));
    }
    flash(color, a) {
        if (!this.cfg.glow)
            return;
        this.flashColor = color;
        this.flashA = Math.min(0.7, Math.max(this.flashA, a));
    }
    ring(x, y, r0, r1, color, max = 0.4, width = 0.12, fill = false, add = false) {
        if (this.rings.length >= MAX_RINGS)
            this.rings.shift();
        this.rings.push({ x, y, r0, r1, life: max, max, color, width, fill, add });
    }
    flare(x, y, z, r, color, max = 0.3, grow = 1.6) {
        if (!this.cfg.glow)
            return;
        if (this.flares.length >= MAX_FLARES)
            this.flares.shift();
        this.flares.push({ x, y, z, r, life: max, max, color, grow });
    }
    ray(x, y, z, ang, len, color, max = 0.25, width = 0.12) {
        if (this.rays.length >= MAX_RAYS)
            this.rays.shift();
        this.rays.push({ x, y, z, ang, len, life: max, max, color, width });
    }
    slash(x, y, z, ang, len, color, edge, max = 0.28, width = 0.22) {
        if (this.slashes.length >= MAX_SLASH)
            this.slashes.shift();
        this.slashes.push({ x, y, z, ang, len, life: max, max, color, edge, width });
    }
    crack(x, y, r, max = 0.7) {
        if (this.cracks.length > 10)
            this.cracks.shift();
        this.cracks.push({ x, y, r, life: max, max, seed: this.rnd() * 100 });
    }
    pillar(x, y, color, h = 3, max = 0.5) {
        if (!this.cfg.glow)
            return;
        if (this.pillars.length > 8)
            this.pillars.shift();
        this.pillars.push({ x, y, color, h, life: max, max });
    }
    beam(x1, y1, x2, y2, type, max = 0.45, width = 0.5, z1 = 0.8, z2 = 0.6) {
        if (this.beams.length >= MAX_BEAMS)
            this.beams.shift();
        const pal = PALETTE[type];
        this.beams.push({ x1, y1, z1, x2, y2, z2, life: max, max, color: pal[1], core: pal[2], width, zig: type === 'electrico', seed: this.rnd() * 100 });
        const n = Math.round(10 * this.cfg.density);
        for (let i = 0; i < n; i++) {
            const t = this.rnd();
            this.burstOne(type, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, z1 + (z2 - z1) * t, 0.5);
        }
        this.flare(x2, y2, z2, 1.4, pal[0], 0.3);
    }
    text(x, y, text, color, size = 1, max = 0.9, z = 1.2) {
        if (this.floats.length >= MAX_FLOATS)
            this.floats.shift();
        this.floats.push({ x, y, z, text, life: max, max, color, size, vz: 1.5, pop: 1 });
    }
    /* ───────── partículas por tipo ───────── */
    /** Ráfaga de partículas con la identidad visual del tipo (la base de todos los impactos). */
    burst(type, x, y, n, power = 1, z = 0.5) {
        const k = Math.max(1, Math.round(n * this.cfg.density));
        for (let i = 0; i < k; i++)
            this.burstOne(type, x, y, z, power);
    }
    burstOne(type, x, y, z, power) {
        const pal = PALETTE[type];
        const col = this.pick(pal);
        const a = this.r(0, Math.PI * 2);
        const sp = this.r(1.0, 3.2) * power;
        const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp * 0.6;
        const up = this.r(0.5, 3.2) * power;
        switch (type) {
            case 'fuego':
                this.add({ x, y, z, vx: vx * 0.4, vy: vy * 0.4, vz: up * 0.9 + 0.6, color: col, size: this.r(0.22, 0.46) * power, shape: Shape.Flame, max: this.r(0.4, 0.8), grav: -1.2, grow: -0.25, add: true });
                break;
            case 'agua':
                this.add({ x, y, z, vx, vy, vz: up + 1.2, color: col, size: this.r(0.1, 0.22), shape: Shape.Drop, max: this.r(0.45, 0.8), grav: 9 });
                break;
            case 'electrico':
                this.add({ x, y, z, vx: vx * 1.8, vy: vy * 1.8, vz: up * 0.6, color: col, size: this.r(0.25, 0.55), shape: Shape.Spark, rot: a, max: this.r(0.12, 0.3), drag: 4, add: true });
                break;
            case 'planta':
                this.add({ x, y, z, vx: vx * 0.7, vy: vy * 0.7, vz: up * 0.8 + 0.5, color: col, size: this.r(0.2, 0.34), shape: Shape.Leaf, rot: this.r(0, 6), vr: this.r(-9, 9), max: this.r(0.6, 1.0), grav: 2.4, drag: 1.2 });
                break;
            case 'hielo':
                this.add({ x, y, z, vx, vy, vz: up, color: col, size: this.r(0.16, 0.34), shape: Shape.Shard, rot: a, vr: this.r(-5, 5), max: this.r(0.45, 0.8), grav: 4, drag: 1 });
                break;
            case 'tierra':
            case 'roca':
                this.add({ x, y, z, vx: vx * 0.8, vy: vy * 0.8, vz: up + 1.2, color: col, size: this.r(0.14, 0.3), shape: Shape.Sq, rot: a, vr: this.r(-10, 10), max: this.r(0.45, 0.85), grav: 11 });
                break;
            case 'psiquico':
                this.add({ x, y, z, vx: vx * 0.6, vy: vy * 0.6, vz: up * 0.5, color: col, size: this.r(0.14, 0.3), shape: Shape.Star, max: this.r(0.5, 0.95), drag: 2, rot: a, vr: 3, add: true });
                break;
            case 'fantasma':
                this.add({ x, y, z, vx: vx * 0.3, vy: vy * 0.3, vz: up * 0.4 + 0.4, color: col, size: this.r(0.22, 0.4), shape: Shape.Smoke, max: this.r(0.6, 1.1), grav: -0.6, drag: 1.5, grow: 0.25 });
                break;
            case 'veneno':
                this.add({ x, y, z, vx: vx * 0.4, vy: vy * 0.4, vz: up * 0.5 + 0.4, color: col, size: this.r(0.12, 0.3), shape: Shape.Ring, max: this.r(0.5, 1.0), grav: -0.9, drag: 1 });
                break;
            case 'lucha':
                this.add({ x, y, z, vx: vx * 1.3, vy: vy * 1.3, vz: up * 0.8, color: col, size: this.r(0.22, 0.42), shape: Shape.Star, max: this.r(0.22, 0.45), drag: 3, rot: a, vr: 6, add: true });
                break;
            case 'volador':
                this.add({ x, y, z, vx: vx * 1.2, vy: vy * 0.6, vz: up * 0.5, color: col, size: this.r(0.3, 0.6), shape: Shape.Spark, rot: a, max: this.r(0.22, 0.45), drag: 3 });
                break;
            case 'bicho':
                this.add({ x, y, z, vx, vy, vz: up * 0.6, color: col, size: this.r(0.14, 0.26), shape: Shape.Sq, rot: a, vr: 4, max: this.r(0.3, 0.6), drag: 2 });
                break;
            case 'dragon':
                this.add({ x, y, z, vx, vy, vz: up, color: col, size: this.r(0.18, 0.4), shape: Shape.Star, max: this.r(0.4, 0.8), drag: 1.5, rot: a, vr: -4, add: true });
                break;
            case 'siniestro':
                this.add({ x, y, z, vx: vx * 0.6, vy: vy * 0.6, vz: up * 0.4, color: col, size: this.r(0.2, 0.4), shape: Shape.Smoke, max: this.r(0.45, 0.9), drag: 2, grow: 0.1 });
                break;
            case 'acero':
                this.add({ x, y, z, vx: vx * 1.3, vy: vy * 1.3, vz: up * 0.8, color: col, size: this.r(0.12, 0.26), shape: Shape.Spark, rot: a, max: this.r(0.16, 0.38), drag: 3, add: true });
                break;
            default:
                this.add({ x, y, z, vx, vy, vz: up * 0.7, color: col, size: this.r(0.16, 0.3), shape: Shape.Star, rot: a, vr: 5, max: this.r(0.25, 0.5), drag: 2.5, add: true });
        }
    }
    /** Polvo de aparición/derrota. */
    puff(x, y, n, color = '#e8e0cc') {
        const k = Math.max(1, Math.round(n * this.cfg.density));
        for (let i = 0; i < k; i++) {
            const a = this.r(0, Math.PI * 2), s = this.r(0.5, 1.6);
            this.add({ x, y, z: 0.2, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: this.r(0.3, 1.4), color, size: this.r(0.22, 0.46), shape: Shape.Smoke, max: this.r(0.4, 0.7), drag: 2.5, grow: 0.4 });
        }
    }
    /** Humo que sale de una torre dañada. */
    smoke(x, y, z, dark = false) {
        this.add({ x, y, z, vx: this.r(-0.25, 0.25), vy: this.r(-0.1, 0.1), vz: 0.9, color: dark ? '#2b2b30' : '#bdbdc2', size: this.r(0.3, 0.55), shape: Shape.Smoke, max: this.r(0.9, 1.4), grow: 0.5 });
    }
    /** Estela de un proyectil en vuelo. */
    trail(type, x, y, z, power = 1) {
        if (!this.cfg.trails)
            return;
        const pal = PALETTE[type];
        const col = this.pick(pal);
        const j = () => this.r(-0.12, 0.12);
        switch (type) {
            case 'fuego':
                this.add({ x: x + j(), y: y + j(), z, vz: 0.6, color: col, size: this.r(0.22, 0.4) * power, shape: Shape.Flame, max: 0.35, grow: -0.5, add: true });
                if (this.rnd() < 0.3)
                    this.add({ x, y, z, vz: 1, vx: j() * 4, color: '#ffe9a8', size: 0.1, shape: Shape.Spark, max: 0.4, grav: 2, add: true });
                break;
            case 'agua':
                this.add({ x: x + j(), y: y + j(), z, vz: 0.5, color: col, size: this.r(0.1, 0.2), shape: Shape.Drop, max: 0.4, grav: 8 });
                break;
            case 'electrico':
                this.add({ x: x + j(), y: y + j(), z: z + j(), color: col, size: this.r(0.2, 0.4), shape: Shape.Spark, rot: this.r(0, 6), max: 0.14, add: true });
                break;
            case 'planta':
                this.add({ x: x + j(), y: y + j(), z, vz: 0.4, color: col, size: this.r(0.14, 0.24), shape: Shape.Leaf, rot: this.r(0, 6), vr: 6, max: 0.5, grav: 2 });
                break;
            case 'hielo':
                this.add({ x: x + j(), y: y + j(), z, color: col, size: this.r(0.1, 0.2), shape: Shape.Plus, max: 0.5, grav: 1, add: true });
                break;
            case 'tierra':
            case 'roca':
                this.add({ x: x + j(), y: y + j(), z, vz: 0.3, color: col, size: this.r(0.2, 0.36), shape: Shape.Smoke, max: 0.5, grow: 0.3 });
                break;
            case 'psiquico':
                this.add({ x: x + j(), y: y + j(), z, color: col, size: this.r(0.1, 0.22), shape: Shape.Star, max: 0.45, rot: 0, vr: 4, add: true });
                break;
            case 'fantasma':
                this.add({ x: x + j(), y: y + j(), z, vz: 0.4, color: col, size: this.r(0.2, 0.36), shape: Shape.Smoke, max: 0.6, grow: 0.3 });
                break;
            case 'veneno':
                this.add({ x: x + j(), y: y + j(), z, vz: 0.4, color: col, size: this.r(0.1, 0.22), shape: Shape.Ring, max: 0.5, grav: -0.5 });
                break;
            case 'dragon':
                this.add({ x: x + j(), y: y + j(), z, vz: 0.4, color: col, size: this.r(0.2, 0.36), shape: Shape.Flame, max: 0.4, grow: -0.4, add: true });
                break;
            case 'siniestro':
                this.add({ x: x + j(), y: y + j(), z, color: col, size: this.r(0.2, 0.34), shape: Shape.Smoke, max: 0.45, grow: 0.2 });
                break;
            case 'acero':
                this.add({ x: x + j(), y: y + j(), z, color: col, size: this.r(0.1, 0.2), shape: Shape.Spark, rot: this.r(0, 6), max: 0.18, add: true });
                break;
            default:
                this.add({ x: x + j(), y: y + j(), z, color: col, size: this.r(0.12, 0.24), shape: Shape.Circle, max: 0.3, grow: -0.2, add: true });
        }
    }
    /**
     * IMPACTO: la explosión característica de cada tipo. `power` 1 = golpe normal; ~1.8 = especial.
     */
    impact(type, x, y, z, power = 1) {
        const pal = PALETTE[type];
        const P = power;
        const n = (k) => Math.max(1, Math.round(k * P));
        this.flare(x, y, z, 1.1 * P, pal[1], 0.28, 1.5);
        switch (type) {
            case 'fuego':
                this.flare(x, y, z, 1.6 * P, pal[0], 0.35, 1.8);
                this.burst('fuego', x, y, n(9), P, z);
                this.puff(x, y, n(3), '#5a4a44');
                this.ring(x, y, 0.2, 0.9 * P, pal[1], 0.35, 0.18, false, true);
                break;
            case 'agua':
                this.burst('agua', x, y, n(14), P, z);
                this.ring(x, y, 0.2, 1.2 * P, '#e4f5ff', 0.5, 0.1);
                this.ring(x, y, 0.1, 0.8 * P, pal[1], 0.4, 0.14);
                break;
            case 'electrico':
                this.flare(x, y, z, 1.8 * P, '#fff6a0', 0.22, 1.4);
                for (let i = 0; i < n(5); i++) {
                    const a = this.r(0, Math.PI * 2), L = this.r(0.8, 1.6) * P;
                    this.beams.push({ x1: x, y1: y, z1: z, x2: x + Math.cos(a) * L, y2: y + Math.sin(a) * L * 0.6, z2: z + this.r(-0.4, 0.6), life: 0.16, max: 0.16, color: pal[1], core: '#fff', width: 0.18, zig: true, seed: this.rnd() * 100 });
                    if (this.beams.length > MAX_BEAMS + 8)
                        this.beams.shift();
                }
                this.burst('electrico', x, y, n(8), P, z);
                break;
            case 'planta':
                this.burst('planta', x, y, n(12), P, z);
                this.ring(x, y, 0.2, 1.0 * P, pal[1], 0.45, 0.12);
                this.flare(x, y, z, 1.0 * P, '#c9f2a6', 0.25, 1.4);
                break;
            case 'hielo':
                this.burst('hielo', x, y, n(10), P, z);
                this.ring(x, y, 0.2, 1.3 * P, '#e8fbff', 0.6, 0.16, true);
                this.ring(x, y, 0.2, 1.1 * P, pal[1], 0.5, 0.12);
                for (let i = 0; i < n(5); i++)
                    this.add({ x: x + this.r(-0.6, 0.6), y: y + this.r(-0.4, 0.4), z: z + this.r(0.2, 1.2), vz: -0.3, color: '#ffffff', size: this.r(0.12, 0.2), shape: Shape.Plus, max: this.r(0.7, 1.1), grav: 0.5, vr: 2, add: true });
                break;
            case 'tierra':
                this.puff(x, y, n(6), '#c7a46c');
                this.burst('tierra', x, y, n(9), P, z);
                this.crack(x, y, 1.3 * P);
                this.ring(x, y, 0.2, 1.4 * P, '#dcbc80', 0.4, 0.2);
                break;
            case 'roca':
                this.puff(x, y, n(6), '#aab2bb');
                this.burst('roca', x, y, n(11), P, z);
                this.crack(x, y, 1.5 * P);
                this.ring(x, y, 0.2, 1.5 * P, '#cfd6dd', 0.4, 0.2);
                this.shake(0.06 * P);
                break;
            case 'psiquico':
                for (let i = 0; i < 3; i++)
                    this.ring(x, y, 0.1 + i * 0.15, (1.0 + i * 0.45) * P, i % 2 ? pal[1] : pal[0], 0.35 + i * 0.12, 0.12, false, true);
                this.burst('psiquico', x, y, n(9), P, z);
                this.flare(x, y, z, 1.5 * P, pal[0], 0.35, 1.6);
                break;
            case 'fantasma':
                this.burst('fantasma', x, y, n(9), P, z);
                this.ring(x, y, 0.2, 1.2 * P, pal[2], 0.55, 0.14, true);
                this.ring(x, y, 0.2, 0.9 * P, pal[0], 0.45, 0.1);
                break;
            case 'veneno':
                this.burst('veneno', x, y, n(10), P, z);
                this.burst('agua', x, y, n(4), P * 0.7, z);
                this.ring(x, y, 0.2, 1.1 * P, pal[0], 0.7, 0.18, true);
                break;
            case 'lucha':
                this.flare(x, y, z, 1.8 * P, '#fff0cc', 0.2, 1.5);
                for (let i = 0; i < n(8); i++)
                    this.ray(x, y, z, (i / n(8)) * Math.PI * 2 + this.r(-0.2, 0.2), this.r(0.7, 1.3) * P, i % 2 ? '#ffb066' : '#ffffff', 0.22, 0.14);
                this.burst('lucha', x, y, n(7), P, z);
                this.ring(x, y, 0.2, 1.3 * P, '#ffffff', 0.3, 0.2);
                break;
            case 'volador':
                this.burst('volador', x, y, n(9), P, z);
                this.ring(x, y, 0.2, 1.2 * P, '#ffffff', 0.4, 0.1);
                for (let i = 0; i < n(3); i++)
                    this.add({ x, y, z, vx: this.r(-1.5, 1.5), vy: this.r(-0.8, 0.8), vz: this.r(0.5, 1.6), color: '#ffffff', size: this.r(0.22, 0.34), shape: Shape.Leaf, rot: this.r(0, 6), vr: this.r(-6, 6), max: this.r(0.7, 1.1), grav: 1.4, drag: 1 });
                break;
            case 'bicho':
                this.burst('bicho', x, y, n(10), P, z);
                for (let i = 0; i < n(5); i++)
                    this.ray(x, y, z, this.r(0, Math.PI * 2), this.r(0.6, 1.1) * P, '#d6e85c', 0.2, 0.08);
                this.ring(x, y, 0.2, 0.9 * P, pal[0], 0.35, 0.1);
                break;
            case 'dragon':
                this.flare(x, y, z, 2.0 * P, '#ffd24a', 0.35, 1.8);
                this.flare(x, y, z, 1.5 * P, pal[0], 0.4, 1.6);
                this.burst('dragon', x, y, n(12), P, z);
                this.ring(x, y, 0.2, 1.5 * P, pal[1], 0.5, 0.2, false, true);
                this.ring(x, y, 0.1, 1.0 * P, '#ffd24a', 0.4, 0.14, false, true);
                break;
            case 'siniestro':
                for (let i = 0; i < 3; i++)
                    this.slash(x + (i - 1) * 0.2, y, z + 0.2 - i * 0.15, -0.9 + i * 0.12, 1.5 * P, pal[0], pal[2], 0.3 + i * 0.04, 0.2 * P);
                this.burst('siniestro', x, y, n(7), P, z);
                this.ring(x, y, 0.2, 1.0 * P, pal[1], 0.45, 0.14);
                break;
            case 'acero':
                this.flare(x, y, z, 1.4 * P, '#ffffff', 0.18, 1.5);
                for (let i = 0; i < 4; i++)
                    this.ray(x, y, z, (i * Math.PI) / 2 + Math.PI / 4, 1.0 * P, '#ffffff', 0.22, 0.1);
                this.burst('acero', x, y, n(10), P, z);
                this.ring(x, y, 0.2, 1.1 * P, pal[1], 0.35, 0.14);
                break;
            default:
                this.flare(x, y, z, 1.4 * P, '#ffffff', 0.2, 1.5);
                for (let i = 0; i < n(6); i++)
                    this.ray(x, y, z, (i / n(6)) * Math.PI * 2, this.r(0.6, 1.1) * P, '#fff6d8', 0.2, 0.12);
                this.burst('normal', x, y, n(6), P, z);
                this.ring(x, y, 0.2, 1.0 * P, '#ffffff', 0.3, 0.16);
        }
    }
    /** Golpe cuerpo a cuerpo: marcas de garra/impacto además de las partículas del tipo. */
    melee(type, x, y, z, big = false) {
        const pal = PALETTE[type];
        if (type === 'normal' || type === 'lucha' || type === 'bicho' || type === 'siniestro' || type === 'acero') {
            const L = big ? 1.5 : 1.0;
            this.slash(x, y, z, -0.8, L, type === 'siniestro' ? pal[0] : '#ffffff', pal[1], 0.22, 0.16);
            if (big)
                this.slash(x + 0.15, y, z - 0.15, -0.8, L, '#ffffff', pal[1], 0.26, 0.16);
        }
        this.impact(type, x, y, z, big ? 1.0 : 0.6);
    }
    /** Aura de lanzamiento de un especial sobre quien lo usa. */
    castAura(type, x, y) {
        const pal = PALETTE[type];
        this.pillar(x, y, pal[0], 3.2, 0.55);
        this.ring(x, y, 0.3, 1.8, pal[1], 0.5, 0.2, false, true);
        this.ring(x, y, 0.1, 1.2, pal[2], 0.4, 0.14, false, true);
        this.flare(x, y, 0.8, 2.0, pal[0], 0.4, 1.5);
        for (let i = 0; i < Math.round(14 * this.cfg.density); i++) {
            const a = this.r(0, Math.PI * 2);
            this.add({ x: x + Math.cos(a) * 1.3, y: y + Math.sin(a) * 0.8, z: 0.1, vx: -Math.cos(a) * 1.5, vy: -Math.sin(a) * 0.9, vz: this.r(1.5, 3.5), color: this.pick(pal), size: this.r(0.12, 0.26), shape: Shape.Spark, rot: -Math.PI / 2, max: this.r(0.45, 0.8), drag: 1, add: true });
        }
    }
    update(dt) {
        if (dt <= 0)
            return;
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.life -= dt;
            if (p.life <= 0) {
                this.parts[i] = this.parts[this.parts.length - 1];
                this.parts.pop();
                continue;
            }
            if (p.drag) {
                const k = Math.max(0, 1 - p.drag * dt);
                p.vx *= k;
                p.vy *= k;
                p.vz *= k;
            }
            p.vz -= p.grav * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            if (p.z < 0 && p.grav > 0) {
                p.z = 0;
                p.vz *= -0.3;
                p.vx *= 0.6;
                p.vy *= 0.6;
            }
            p.rot += p.vr * dt;
            p.size = Math.max(0.02, p.size + p.grow * dt);
        }
        for (const arr of [this.rings, this.beams, this.floats, this.flares, this.rays, this.slashes, this.cracks, this.pillars]) {
            for (let i = arr.length - 1; i >= 0; i--) {
                arr[i].life -= dt;
                if (arr[i].life <= 0)
                    arr.splice(i, 1);
            }
        }
        for (const f of this.floats) {
            f.z += f.vz * dt;
            f.vz *= Math.max(0, 1 - 2.2 * dt);
            f.pop = Math.max(1, f.pop - dt * 5);
        }
        this.shakeAmp = Math.max(0, this.shakeAmp - dt * 1.6);
        this.flashA = Math.max(0, this.flashA - dt * 2.4);
    }
    /* ───────── dibujo ───────── */
    /** Capa del suelo (antes de las unidades): anillos, grietas y columnas de luz. */
    drawGround(g, cam) {
        for (const c of this.cracks) {
            const k = c.life / c.max;
            const X = cam.sx(c.x, c.y), Y = cam.sy(c.y), s = cam.ts(c.y), vr = cam.vr(c.y);
            g.globalAlpha = Math.min(1, k * 1.5) * 0.9;
            g.strokeStyle = '#2a1d12';
            g.lineWidth = Math.max(1.5, s * 0.08);
            g.lineCap = 'round';
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + c.seed;
                g.beginPath();
                g.moveTo(X, Y);
                let px = X, py = Y;
                for (let sgm = 1; sgm <= 3; sgm++) {
                    const rr = (c.r * sgm) / 3 * s * (1 - (1 - k) * 0.2);
                    px = X + Math.cos(a + Math.sin(c.seed * sgm) * 0.3) * rr;
                    py = Y + Math.sin(a + Math.sin(c.seed * sgm) * 0.3) * rr * vr;
                    g.lineTo(px, py);
                }
                g.stroke();
            }
        }
        for (const r of this.rings) {
            const k = 1 - r.life / r.max;
            const X = cam.sx(r.x, r.y), Y = cam.sy(r.y), s = cam.ts(r.y), vr = cam.vr(r.y);
            const rad = (r.r0 + (r.r1 - r.r0) * (1 - (1 - k) * (1 - k))) * s;
            g.globalAlpha = Math.max(0, r.life / r.max) * (r.fill ? 0.35 : 0.9);
            g.globalCompositeOperation = r.add && this.cfg.glow ? 'lighter' : 'source-over';
            g.beginPath();
            g.ellipse(X, Y, rad, rad * vr, 0, 0, Math.PI * 2);
            if (r.fill) {
                g.fillStyle = r.color;
                g.fill();
            }
            else {
                g.strokeStyle = r.color;
                g.lineWidth = Math.max(1, r.width * s * (1 - k * 0.6));
                g.stroke();
            }
        }
        g.globalCompositeOperation = 'source-over';
        for (const p of this.pillars) {
            const k = p.life / p.max;
            const X = cam.sx(p.x, p.y), Y = cam.sy(p.y), s = cam.ts(p.y);
            const w = s * 0.9 * (0.5 + k * 0.5), hh = s * p.h * (1 - k * 0.2);
            const grad = g.createLinearGradient(0, Y - hh, 0, Y);
            grad.addColorStop(0, 'rgba(255,255,255,0)');
            grad.addColorStop(1, p.color);
            g.globalAlpha = k * 0.8;
            g.globalCompositeOperation = this.cfg.glow ? 'lighter' : 'source-over';
            g.fillStyle = grad;
            g.fillRect(X - w / 2, Y - hh, w, hh);
        }
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
    }
    /** Capa aérea (después de las unidades): brillos, rayos, partículas, marcas de ataque. */
    drawAir(g, cam) {
        const glow = this.cfg.glow;
        for (const f of this.flares) {
            const k = 1 - f.life / f.max;
            const X = cam.sx(f.x, f.y), Y = cam.sy(f.y) - f.z * cam.ts(f.y), R = f.r * cam.ts(f.y) * (1 + (f.grow - 1) * k);
            g.globalAlpha = (1 - k) * 0.9;
            g.globalCompositeOperation = 'lighter';
            const gr = g.createRadialGradient(X, Y, 0, X, Y, R);
            gr.addColorStop(0, '#ffffff');
            gr.addColorStop(0.25, f.color);
            gr.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = gr;
            g.beginPath();
            g.arc(X, Y, R, 0, Math.PI * 2);
            g.fill();
        }
        g.globalCompositeOperation = 'source-over';
        for (const r of this.rays) {
            const k = r.life / r.max;
            const s = cam.ts(r.y);
            const X = cam.sx(r.x, r.y), Y = cam.sy(r.y) - r.z * s;
            const d0 = (1 - k) * r.len * 0.5 * s, d1 = (0.35 + (1 - k) * 0.65) * r.len * s;
            g.globalAlpha = Math.min(1, k * 1.6);
            g.strokeStyle = r.color;
            g.lineWidth = Math.max(1.5, r.width * s * k);
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(X + Math.cos(r.ang) * d0, Y + Math.sin(r.ang) * d0 * 0.8);
            g.lineTo(X + Math.cos(r.ang) * d1, Y + Math.sin(r.ang) * d1 * 0.8);
            g.stroke();
        }
        for (const sl of this.slashes) {
            const k = sl.life / sl.max;
            const s = cam.ts(sl.y);
            const X = cam.sx(sl.x, sl.y), Y = cam.sy(sl.y) - sl.z * s;
            const prog = Math.min(1, (1 - k) * 2.2);
            const L = sl.len * s * 0.5;
            const cx = Math.cos(sl.ang), cy = Math.sin(sl.ang);
            g.globalAlpha = Math.min(1, k * 2);
            g.lineCap = 'round';
            for (const [w, col] of [[sl.width * s, sl.edge], [sl.width * s * 0.45, sl.color]]) {
                g.strokeStyle = col;
                g.lineWidth = Math.max(1.5, w * (0.4 + k * 0.6));
                g.beginPath();
                g.moveTo(X - cx * L, Y - cy * L);
                g.lineTo(X - cx * L + cx * L * 2 * prog, Y - cy * L + cy * L * 2 * prog);
                g.stroke();
            }
        }
        for (const b of this.beams) {
            const k = b.life / b.max;
            g.globalAlpha = Math.min(1, k * 1.4);
            g.lineCap = 'round';
            g.lineJoin = 'round';
            const pts = this.beamPoints(b, cam);
            if (glow)
                g.globalCompositeOperation = 'lighter';
            const s = cam.ts((b.y1 + b.y2) / 2);
            g.strokeStyle = b.color;
            g.lineWidth = b.width * s * (0.7 + k * 0.7) * 1.7;
            g.globalAlpha = Math.min(1, k * 1.4) * 0.45;
            this.poly(g, pts);
            g.globalAlpha = Math.min(1, k * 1.4);
            g.strokeStyle = b.color;
            g.lineWidth = b.width * s * (0.5 + k * 0.6);
            this.poly(g, pts);
            g.strokeStyle = b.core;
            g.lineWidth = Math.max(1.5, b.width * s * 0.3 * k);
            this.poly(g, pts);
            g.globalCompositeOperation = 'source-over';
        }
        for (const p of this.parts) {
            g.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
            g.globalCompositeOperation = p.add && glow ? 'lighter' : 'source-over';
            const s = cam.ts(p.y);
            const X = Math.round(cam.sx(p.x, p.y)), Y = Math.round(cam.sy(p.y) - p.z * s);
            const sz = p.size * s;
            g.fillStyle = p.color;
            switch (p.shape) {
                case Shape.Circle:
                    g.beginPath();
                    g.arc(X, Y, sz / 2, 0, Math.PI * 2);
                    g.fill();
                    break;
                case Shape.Smoke: {
                    const a0 = g.globalAlpha;
                    g.globalAlpha = a0 * 0.55;
                    g.beginPath();
                    g.arc(X, Y, sz * 0.6, 0, Math.PI * 2);
                    g.fill();
                    g.globalAlpha = a0;
                    break;
                }
                case Shape.Ring:
                    g.strokeStyle = p.color;
                    g.lineWidth = Math.max(1.2, sz * 0.18);
                    g.beginPath();
                    g.arc(X, Y, sz / 2, 0, Math.PI * 2);
                    g.stroke();
                    g.globalAlpha *= 0.35;
                    g.beginPath();
                    g.arc(X, Y, sz / 2, 0, Math.PI * 2);
                    g.fill();
                    break;
                case Shape.Sq:
                    g.save();
                    g.translate(X, Y);
                    g.rotate(p.rot);
                    g.fillRect(-sz / 2, -sz / 2, sz, sz);
                    g.restore();
                    break;
                case Shape.Leaf:
                    g.save();
                    g.translate(X, Y);
                    g.rotate(p.rot);
                    g.beginPath();
                    g.moveTo(-sz, 0);
                    g.lineTo(0, -sz * 0.45);
                    g.lineTo(sz, 0);
                    g.lineTo(0, sz * 0.45);
                    g.closePath();
                    g.fill();
                    g.restore();
                    break;
                case Shape.Shard:
                    g.save();
                    g.translate(X, Y);
                    g.rotate(p.rot);
                    g.beginPath();
                    g.moveTo(-sz * 0.9, 0);
                    g.lineTo(0, -sz * 0.32);
                    g.lineTo(sz * 0.9, 0);
                    g.lineTo(0, sz * 0.32);
                    g.closePath();
                    g.fill();
                    g.fillStyle = 'rgba(255,255,255,.7)';
                    g.fillRect(-sz * 0.5, -1, sz, 2);
                    g.restore();
                    break;
                case Shape.Flame:
                    g.beginPath();
                    g.moveTo(X, Y - sz * 1.1);
                    g.quadraticCurveTo(X + sz * 0.7, Y - sz * 0.1, X + sz * 0.45, Y + sz * 0.25);
                    g.quadraticCurveTo(X, Y + sz * 0.55, X - sz * 0.45, Y + sz * 0.25);
                    g.quadraticCurveTo(X - sz * 0.7, Y - sz * 0.1, X, Y - sz * 1.1);
                    g.fill();
                    break;
                case Shape.Drop:
                    g.beginPath();
                    g.moveTo(X, Y - sz * 0.9);
                    g.quadraticCurveTo(X + sz * 0.6, Y, X, Y + sz * 0.4);
                    g.quadraticCurveTo(X - sz * 0.6, Y, X, Y - sz * 0.9);
                    g.fill();
                    break;
                case Shape.Spark:
                    g.strokeStyle = p.color;
                    g.lineWidth = Math.max(1.5, sz * 0.2);
                    g.lineCap = 'round';
                    g.beginPath();
                    g.moveTo(X - Math.cos(p.rot) * sz, Y - Math.sin(p.rot) * sz);
                    g.lineTo(X + Math.cos(p.rot) * sz, Y + Math.sin(p.rot) * sz);
                    g.stroke();
                    break;
                case Shape.Plus:
                    g.fillRect(X - sz / 2, Y - sz / 6, sz, sz / 3);
                    g.fillRect(X - sz / 6, Y - sz / 2, sz / 3, sz);
                    break;
                case Shape.Star:
                    g.save();
                    g.translate(X, Y);
                    g.rotate(p.rot);
                    g.fillRect(-sz / 2, -sz / 6, sz, sz / 3);
                    g.fillRect(-sz / 6, -sz / 2, sz / 3, sz);
                    g.restore();
                    break;
            }
        }
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
    }
    beamPoints(b, cam) {
        const pt = (x, y, z) => [cam.sx(x, y), cam.sy(y) - z * cam.ts(y)];
        const pts = [pt(b.x1, b.y1, b.z1)];
        if (b.zig) {
            const n = 7;
            const dx = b.x2 - b.x1, dy = b.y2 - b.y1, dz = b.z2 - b.z1;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;
            for (let i = 1; i < n; i++) {
                const t = i / n;
                const j = Math.sin(b.seed * 13.7 + i * 7.3 + b.life * 40) * 0.45;
                pts.push(pt(b.x1 + dx * t + nx * j, b.y1 + dy * t + ny * j, b.z1 + dz * t + Math.cos(b.seed + i * 3) * 0.2));
            }
        }
        pts.push(pt(b.x2, b.y2, b.z2));
        return pts;
    }
    poly(g, pts) {
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++)
            g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
    }
    drawFloats(g, cam) {
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';
        for (const f of this.floats) {
            const k = f.life / f.max;
            g.globalAlpha = Math.min(1, k * 2);
            const s = cam.ts(f.y);
            const px = Math.round(f.size * s * 0.62 * f.pop * (1 + (1 - k) * 0.12));
            g.font = `900 ${px}px "Trebuchet MS", system-ui, sans-serif`;
            g.lineWidth = Math.max(2.5, px * 0.3);
            g.strokeStyle = 'rgba(10,16,30,.95)';
            const X = cam.sx(f.x, f.y), Y = cam.sy(f.y) - f.z * s;
            g.strokeText(f.text, X, Y);
            g.fillStyle = f.color;
            g.fillText(f.text, X, Y);
        }
        g.globalAlpha = 1;
    }
}
/** Dibuja el proyectil con la forma de su familia de tipos (en capas, con brillo y cola). */
export function drawProjectile(g, d, glow) {
    const { X, Y, r, ang, type, t } = d;
    const pal = PALETTE[type];
    g.save();
    g.translate(X, Y);
    if (d.tower) {
        g.fillStyle = d.team === 0 ? '#9ec3ff' : '#ff9b8f';
        g.strokeStyle = '#1b2230';
        g.lineWidth = Math.max(1, r * 0.25);
        if (glow) {
            g.globalCompositeOperation = 'lighter';
            g.globalAlpha = 0.5;
            g.beginPath();
            g.arc(0, 0, r * 1.2, 0, Math.PI * 2);
            g.fill();
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = 1;
        }
        g.beginPath();
        g.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.restore();
        return;
    }
    const halo = (c, k, a = 0.5) => {
        if (!glow)
            return;
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, r * k);
        gr.addColorStop(0, c);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = a;
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, r * k, 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
    };
    const circle = (rad, c, ox = 0, oy = 0) => {
        g.fillStyle = c;
        g.beginPath();
        g.arc(ox, oy, rad, 0, Math.PI * 2);
        g.fill();
    };
    const sp = d.special ? 1.25 : 1;
    g.scale(sp, sp);
    g.rotate(ang);
    switch (type) {
        case 'fuego': {
            halo(pal[0], 2.2, 0.6);
            for (let i = 0; i < 3; i++) {
                const f = Math.sin(t * 30 + i * 2);
                g.fillStyle = [pal[0], pal[1], pal[2]][i];
                g.beginPath();
                const L = r * (1.5 - i * 0.3 + f * 0.15);
                g.moveTo(-L, f * r * 0.1);
                g.quadraticCurveTo(-L * 0.4, -r * (0.6 - i * 0.1), r * 0.1, -r * (0.35 - i * 0.05));
                g.lineTo(r * 0.1, r * (0.35 - i * 0.05));
                g.quadraticCurveTo(-L * 0.4, r * (0.6 - i * 0.1), -L, f * r * 0.1);
                g.fill();
            }
            circle(r * 0.55, pal[0]);
            circle(r * 0.4, pal[1], r * 0.05);
            circle(r * 0.22, '#fff6c8', r * 0.08);
            break;
        }
        case 'agua': {
            halo(pal[1], 1.8, 0.4);
            const gr = g.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.05, 0, 0, r * 0.62);
            gr.addColorStop(0, '#e4f5ff');
            gr.addColorStop(0.5, pal[1]);
            gr.addColorStop(1, pal[0]);
            g.fillStyle = gr;
            g.beginPath();
            g.ellipse(0, 0, r * (0.62 + Math.sin(t * 20) * 0.04), r * (0.5 - Math.sin(t * 20) * 0.04), 0, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = '#1d5fb4';
            g.lineWidth = Math.max(1, r * 0.08);
            g.stroke();
            circle(r * 0.12, '#ffffff', -r * 0.2, -r * 0.18);
            circle(r * 0.1, pal[1], -r * 0.9, r * 0.1);
            circle(r * 0.07, pal[1], -r * 1.2, -r * 0.1);
            break;
        }
        case 'electrico': {
            halo(pal[0], 2.4, 0.6);
            const seed = Math.floor(t * 26);
            g.strokeStyle = pal[0];
            g.lineWidth = Math.max(1.5, r * 0.14);
            g.lineJoin = 'round';
            for (let i = 0; i < 5; i++) {
                const a = ((seed * 1.7 + i * 1.26) % (Math.PI * 2));
                g.beginPath();
                g.moveTo(0, 0);
                let x = 0, y = 0;
                for (let s = 1; s <= 3; s++) {
                    x = Math.cos(a + (s % 2 ? 0.35 : -0.3)) * r * 0.55 * s;
                    y = Math.sin(a + (s % 2 ? 0.35 : -0.3)) * r * 0.55 * s;
                    g.lineTo(x, y);
                }
                g.stroke();
            }
            circle(r * 0.45, pal[0]);
            circle(r * 0.28, '#ffffff');
            break;
        }
        case 'planta': {
            halo(pal[1], 1.8, 0.35);
            for (let i = 0; i < 3; i++) {
                g.save();
                g.rotate(t * 14 + (i * Math.PI * 2) / 3);
                g.translate(r * 0.45, 0);
                g.fillStyle = i % 2 ? pal[1] : pal[0];
                g.beginPath();
                g.moveTo(-r * 0.6, 0);
                g.quadraticCurveTo(0, -r * 0.5, r * 0.6, 0);
                g.quadraticCurveTo(0, r * 0.5, -r * 0.6, 0);
                g.fill();
                g.strokeStyle = pal[2];
                g.lineWidth = Math.max(1, r * 0.06);
                g.beginPath();
                g.moveTo(-r * 0.5, 0);
                g.lineTo(r * 0.5, 0);
                g.stroke();
                g.restore();
            }
            break;
        }
        case 'hielo': {
            halo(pal[1], 2.0, 0.5);
            const gr = g.createLinearGradient(-r, 0, r, 0);
            gr.addColorStop(0, pal[1]);
            gr.addColorStop(0.6, pal[0]);
            gr.addColorStop(1, '#ffffff');
            g.fillStyle = gr;
            g.beginPath();
            g.moveTo(-r * 1.0, 0);
            g.lineTo(-r * 0.25, -r * 0.4);
            g.lineTo(r * 1.0, 0);
            g.lineTo(-r * 0.25, r * 0.4);
            g.closePath();
            g.fill();
            g.strokeStyle = '#4ba7c9';
            g.lineWidth = Math.max(1, r * 0.07);
            g.stroke();
            g.fillStyle = 'rgba(255,255,255,.85)';
            g.fillRect(-r * 0.4, -r * 0.05, r * 1.0, r * 0.1);
            break;
        }
        case 'tierra':
        case 'roca': {
            g.rotate(t * 9 - ang);
            g.fillStyle = pal[1];
            g.strokeStyle = '#2b2118';
            g.lineWidth = Math.max(1, r * 0.1);
            g.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2, rr = r * (0.62 + ((i * 37) % 7) * 0.035);
                if (i)
                    g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
                else
                    g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            g.closePath();
            g.fill();
            g.stroke();
            g.fillStyle = pal[0];
            g.beginPath();
            g.moveTo(-r * 0.4, -r * 0.35);
            g.lineTo(r * 0.1, -r * 0.5);
            g.lineTo(0, -r * 0.1);
            g.closePath();
            g.fill();
            g.fillStyle = pal[2];
            g.fillRect(r * 0.1, r * 0.1, r * 0.25, r * 0.15);
            break;
        }
        case 'psiquico': {
            halo(pal[0], 2.2, 0.55);
            g.rotate(-ang);
            for (let i = 0; i < 3; i++) {
                const ph = (t * 3 + i / 3) % 1;
                g.strokeStyle = i % 2 ? pal[1] : pal[0];
                g.globalAlpha = 1 - ph;
                g.lineWidth = Math.max(1.5, r * 0.16);
                g.beginPath();
                g.arc(0, 0, r * (0.25 + ph * 0.85), 0, Math.PI * 2);
                g.stroke();
            }
            g.globalAlpha = 1;
            circle(r * 0.3, pal[0]);
            circle(r * 0.16, '#ffffff');
            for (let i = 0; i < 3; i++) {
                const a = t * 6 + i * 2.1;
                g.fillStyle = pal[2];
                g.fillRect(Math.cos(a) * r * 0.9 - r * 0.07, Math.sin(a) * r * 0.9 - r * 0.07, r * 0.14, r * 0.14);
            }
            break;
        }
        case 'fantasma': {
            halo(pal[2], 2.2, 0.5);
            for (let i = 1; i <= 3; i++) {
                g.globalAlpha = 0.45 / i;
                circle(r * (0.55 - i * 0.08), pal[1], -r * 0.5 * i + Math.sin(t * 12 + i) * r * 0.08, Math.sin(t * 9 + i) * r * 0.15);
            }
            g.globalAlpha = 1;
            circle(r * 0.62, pal[1]);
            circle(r * 0.5, pal[0]);
            g.rotate(-ang);
            g.fillStyle = '#ffffff';
            g.fillRect(-r * 0.25, -r * 0.22, r * 0.14, r * 0.22);
            g.fillRect(r * 0.11, -r * 0.22, r * 0.14, r * 0.22);
            g.fillStyle = '#1d0f2e';
            g.fillRect(-r * 0.18, r * 0.14, r * 0.36, r * 0.08);
            break;
        }
        case 'veneno': {
            halo(pal[0], 2.0, 0.5);
            circle(r * 0.6, pal[1]);
            circle(r * 0.5, pal[0]);
            circle(r * 0.14, pal[2], -r * 0.2, -r * 0.2);
            for (let i = 0; i < 3; i++) {
                g.strokeStyle = pal[2];
                g.lineWidth = Math.max(1, r * 0.07);
                g.beginPath();
                g.arc(-r * 0.9 - i * r * 0.3, Math.sin(t * 10 + i * 2) * r * 0.25, r * (0.14 - i * 0.025), 0, Math.PI * 2);
                g.stroke();
            }
            break;
        }
        case 'lucha': {
            halo(pal[1], 2.0, 0.5);
            g.rotate(t * 13 - ang);
            g.fillStyle = pal[0];
            g.beginPath();
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2, rr = i % 2 ? r * 0.42 : r * 0.95;
                g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            g.closePath();
            g.fill();
            circle(r * 0.5, pal[1]);
            circle(r * 0.28, '#ffffff');
            break;
        }
        case 'volador': {
            halo('#ffffff', 1.8, 0.4);
            g.strokeStyle = '#ffffff';
            g.lineCap = 'round';
            for (const [rad, w, col] of [[0.85, 0.34, pal[1]], [0.85, 0.16, '#ffffff'], [0.55, 0.12, pal[0]]]) {
                g.strokeStyle = col;
                g.lineWidth = Math.max(1.5, r * w);
                g.beginPath();
                g.arc(-r * 0.1, 0, r * rad, -1.15, 1.15);
                g.stroke();
            }
            g.strokeStyle = 'rgba(255,255,255,.7)';
            g.lineWidth = Math.max(1, r * 0.07);
            for (let i = -1; i <= 1; i++) {
                g.beginPath();
                g.moveTo(-r * 0.9, i * r * 0.35);
                g.lineTo(-r * 1.6, i * r * 0.4);
                g.stroke();
            }
            break;
        }
        case 'bicho': {
            halo(pal[1], 1.6, 0.35);
            for (const [oy, ln] of [[-0.3, 1.0], [0, 1.2], [0.3, 1.0]]) {
                g.fillStyle = pal[1];
                g.beginPath();
                g.moveTo(r * ln, oy * r);
                g.lineTo(-r * 0.5, oy * r - r * 0.1);
                g.lineTo(-r * 0.5, oy * r + r * 0.1);
                g.closePath();
                g.fill();
                g.fillStyle = pal[2];
                g.fillRect(r * (ln - 0.35), oy * r - r * 0.05, r * 0.35, r * 0.1);
            }
            g.fillStyle = pal[0];
            g.fillRect(-r * 0.7, -r * 0.1, r * 0.2, r * 0.2);
            break;
        }
        case 'dragon': {
            halo(pal[0], 2.4, 0.6);
            g.strokeStyle = pal[1];
            g.lineWidth = Math.max(2, r * 0.3);
            g.lineCap = 'round';
            g.beginPath();
            for (let i = 0; i <= 8; i++) {
                const x = -i * r * 0.2, y = Math.sin(t * 16 - i * 0.9) * r * 0.25 * (i / 8 + 0.3);
                if (i)
                    g.lineTo(x, y);
                else
                    g.moveTo(x, y);
            }
            g.stroke();
            g.strokeStyle = pal[2];
            g.lineWidth = Math.max(1, r * 0.1);
            g.stroke();
            circle(r * 0.58, pal[0]);
            circle(r * 0.44, pal[1]);
            circle(r * 0.2, pal[2], r * 0.1, 0);
            break;
        }
        case 'siniestro': {
            halo(pal[1], 2.0, 0.55);
            g.strokeStyle = pal[2];
            g.lineCap = 'round';
            g.lineWidth = Math.max(2, r * 0.5);
            g.beginPath();
            g.arc(-r * 0.15, 0, r * 0.75, -1.2, 1.2);
            g.stroke();
            g.strokeStyle = pal[0];
            g.lineWidth = Math.max(1.5, r * 0.34);
            g.beginPath();
            g.arc(-r * 0.15, 0, r * 0.75, -1.2, 1.2);
            g.stroke();
            circle(r * 0.22, pal[1], -r * 0.2, 0);
            break;
        }
        case 'acero': {
            halo('#ffffff', 1.8, 0.4);
            g.rotate(t * 16 - ang);
            g.fillStyle = pal[1];
            g.strokeStyle = '#4a5268';
            g.lineWidth = Math.max(1, r * 0.1);
            g.beginPath();
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.55 : r * 0.9;
                g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            g.closePath();
            g.fill();
            g.stroke();
            circle(r * 0.3, pal[0]);
            g.fillStyle = '#ffffff';
            g.fillRect(-r * 0.5, -r * 0.1, r * 0.5, r * 0.1);
            break;
        }
        default: {
            halo('#ffffff', 2.0, 0.5);
            const gr = g.createLinearGradient(-r * 1.6, 0, 0, 0);
            gr.addColorStop(0, 'rgba(255,255,255,0)');
            gr.addColorStop(1, 'rgba(255,246,216,.9)');
            g.fillStyle = gr;
            g.beginPath();
            g.moveTo(-r * 1.6, 0);
            g.lineTo(0, -r * 0.5);
            g.lineTo(0, r * 0.5);
            g.closePath();
            g.fill();
            circle(r * 0.55, pal[0]);
            circle(r * 0.35, '#ffd23f');
        }
    }
    g.restore();
}
