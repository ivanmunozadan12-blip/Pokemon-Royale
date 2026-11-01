/** Generador pseudoaleatorio determinista (mulberry32). Misma semilla => misma secuencia. */
export class Rng {
    s;
    constructor(seed) {
        this.s = (seed >>> 0) || 0x9e3779b9;
    }
    /** Número real en [0, 1). */
    next() {
        this.s = (this.s + 0x6d2b79f5) >>> 0;
        let t = this.s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Entero en [0, n). */
    int(n) {
        return Math.floor(this.next() * n);
    }
    range(a, b) {
        return a + (b - a) * this.next();
    }
    pick(arr) {
        return arr[this.int(arr.length)];
    }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.int(i + 1);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    get state() {
        return this.s;
    }
}
/** Semilla no determinista para partidas reales (usa el generador criptográfico del navegador si existe). */
export function randomSeed() {
    const c = globalThis.crypto;
    if (c?.getRandomValues) {
        const a = new Uint32Array(1);
        c.getRandomValues(a);
        return a[0] >>> 0;
    }
    return (Math.floor(Math.random() * 4294967296) ^ Date.now()) >>> 0;
}
