import { getSpecies } from "../data/species.js";
import { TYPE_COLOR } from "../data/types.js";
export class SpriteStore {
    manifest = null;
    manifestState = 'idle';
    shinyManifest = null;
    shinyManifestPromise = null;
    statics = new Map();
    anims = new Map();
    placeholders = new Map();
    base;
    /** Cuenta de errores de carga (visible en el informe de pruebas). */
    failures = 0;
    constructor(base = 'sprites/') {
        this.base = base;
    }
    async init() {
        if (this.manifestState === 'ok')
            return true;
        if (this.manifestState === 'loading')
            return false;
        this.manifestState = 'loading';
        try {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeout = controller ? setTimeout(() => controller.abort(), 5000) : null;
            try {
                const r = await fetch(`${this.base}manifest.json`, controller ? { signal: controller.signal } : undefined);
                if (!r.ok)
                    throw new Error(String(r.status));
                this.manifest = await r.json();
                this.manifestState = 'ok';
                return true;
            }
            finally { if (timeout) clearTimeout(timeout); }
        }
        catch {
            this.manifestState = 'fail';
            this.failures++;
            return false;
        }
    }
    get ready() {
        return this.manifestState === 'ok';
    }
    staticSize(id, side) {
        return this.manifest?.static[`${side}${id}`] ?? null;
    }
    url(kind, id, side) {
        return `${this.base}${kind}/${side}${id}.png`;
    }
    async ensureShinyManifest() {
        if (this.shinyManifest || this.shinyManifestPromise) return this.shinyManifestPromise ?? Promise.resolve();
        this.shinyManifestPromise = (async () => {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeout = controller ? setTimeout(() => controller.abort(), 10000) : null;
            try { const r = await fetch(`${this.base}shiny/manifest.json`, controller ? { signal: controller.signal } : undefined); if (!r.ok) throw new Error(`HTTP ${r.status}`); this.shinyManifest = await r.json(); }
            catch { this.shinyManifest = null; this.shinyManifestPromise = null; }
            finally { if (timeout) clearTimeout(timeout); }
        })();
        return this.shinyManifestPromise;
    }
    loadImg(url, timeoutMs = 12000) {
        return new Promise((resolve) => {
            let attempt = 0, done = false;
            const finish = (value) => { if (done) return; done = true; resolve(value); };
            const run = () => {
                const img = new Image();
                img.decoding = 'async';
                let settled = false;
                const timer = setTimeout(() => {
                    if (settled || done) return;
                    settled = true;
                    if (attempt++ < 1) run();
                    else { this.failures++; finish(null); }
                }, timeoutMs);
                const settle = (value) => {
                    if (settled || done) return;
                    settled = true; clearTimeout(timer);
                    if (value) finish(value);
                    else if (attempt++ < 1) run();
                    else { this.failures++; finish(null); }
                };
                img.onload = () => settle(img);
                img.onerror = () => settle(null);
                img.src = attempt ? `${url}${url.includes('?') ? '&' : '?'}retry=1` : url;
            };
            run();
        });
    }
    async loadAnim(id, side, shiny = false) {
        if (shiny) await this.ensureShinyManifest();
        else if (!this.ready && !(await this.init())) throw new Error('No se pudo cargar el manifiesto de animaciones.');
        const key = shiny ? `shiny-${side}${id}` : `${side}${id}`;
        const manifest = shiny ? this.shinyManifest : this.manifest?.anim;
        const meta = manifest?.[`${side}${id}`];
        if (!meta) throw new Error(`No existe animación ${shiny ? 'shiny ' : ''}${side}${id}.`);
        const existing = this.anims.get(key);
        if (existing?.state === 'ok') return existing.value;
        if (existing?.promise) return existing.promise;
        const entry = { state: 'loading', value: null, promise: null };
        entry.promise = this.loadImg(shiny ? `${this.base}shiny/anim/${side}${id}.png` : this.url('anim', id, side), 12000).then((img) => {
            if (!img) { entry.state = 'fail'; throw new Error(`No se pudo descargar la animación ${key}.`); }
            const cum = []; let total = 0;
            for (const d of meta.d) { total += Math.max(30, d); cum.push(total); }
            entry.value = { img, w: meta.w, h: meta.h, n: meta.n, c: meta.c, d: meta.d, cum, total };
            entry.state = 'ok';
            return entry.value;
        }).catch((error) => {
            entry.state = 'fail';
            if (this.anims.get(key) === entry) this.anims.delete(key);
            throw error;
        });
        this.anims.set(key, entry);
        return entry.promise;
    }
    /** Devuelve el sprite estático si ya cargó (y lo pide si aún no). */
    staticImg(id, side) {
        const key = `${side}${id}`;
        let e = this.statics.get(key);
        if (!e) {
            e = { state: 'loading', value: null };
            this.statics.set(key, e);
            const entry = e;
            void this.loadImg(this.url('static', id, side)).then((img) => {
                entry.value = img;
                entry.state = img ? 'ok' : 'fail';
            });
        }
        return e.state === 'ok' ? e.value : null;
    }
    animSheet(id, side) {
        const key = `${side}${id}`;
        let e = this.anims.get(key);
        if (!e) {
            const m = this.manifest?.anim[key];
            if (!m)
                return null;
            e = { state: 'loading', value: null };
            this.anims.set(key, e);
            const entry = e;
            void this.loadImg(this.url('anim', id, side)).then((img) => {
                if (!img) {
                    entry.state = 'fail';
                    return;
                }
                const cum = [];
                let t = 0;
                for (const d of m.d) {
                    t += Math.max(30, d);
                    cum.push(t);
                }
                entry.value = { img, w: m.w, h: m.h, n: m.n, c: m.c, d: m.d, cum, total: t };
                entry.state = 'ok';
            });
        }
        return e.state === 'ok' ? e.value : null;
    }
    /** Precarga obligatoriamente las hojas animadas necesarias para el combate. */
    async preload(ids, sides, shinyIds = [], timeoutMs = 12000) {
        const uniqueIds = [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 151))];
        if (!(await this.init())) {
            this.manifestState = 'idle';
            if (!(await this.init())) throw new Error('No se pudo descargar sprites/manifest.json. Comprueba la conexión y vuelve a intentarlo.');
        }
        const shiny = new Set(shinyIds.map(Number));
        const jobs = [];
        for (const id of uniqueIds) for (const side of sides) jobs.push(this.loadAnim(id, side, false));
        if (shiny.size) {
            await this.ensureShinyManifest();
            if (!this.shinyManifest) throw new Error('No se pudo cargar el manifiesto de animaciones variocolor.');
            for (const id of shiny) for (const side of sides) jobs.push(this.loadAnim(id, side, true));
        }
        let timer;
        try {
            await Promise.race([
                Promise.all(jobs),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('La descarga de las animaciones está tardando demasiado. Reintenta con una conexión estable.')), timeoutMs); })
            ]);
        } finally { clearTimeout(timer); }
        return true;
    }
    whenStaticSettled(id, side) {
        return new Promise((resolve) => {
            const t0 = Date.now();
            const tick = () => {
                const s = this.statics.get(`${side}${id}`);
                if (!s || s.state !== 'loading' || Date.now() - t0 > 6000) resolve();
                else setTimeout(tick, 35);
            };
            tick();
        });
    }
    whenSettled(id, side) {
        return new Promise((resolve) => {
            const t0 = Date.now();
            const tick = () => {
                const s = this.statics.get(`${side}${id}`);
                const a = this.anims.get(`${side}${id}`);
                const sOk = !s || s.state !== 'loading';
                const aOk = !a || a.state !== 'loading';
                if ((sOk && aOk) || Date.now() - t0 > 6000)
                    resolve();
                else
                    setTimeout(tick, 40);
            };
            tick();
        });
    }
    /** Ficha de sustitución (solo cuando no hay ningún sprite disponible). */
    placeholder(id) {
        let c = this.placeholders.get(id);
        if (c)
            return c;
        c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const sp = getSpecies(id);
        g.fillStyle = 'rgba(0,0,0,.25)';
        g.beginPath();
        g.ellipse(32, 56, 22, 6, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = TYPE_COLOR[sp.types[0]];
        g.strokeStyle = '#1b2a41';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(32, 32, 24, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#fff';
        g.font = 'bold 20px sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`#${id}`, 32, 33);
        this.placeholders.set(id, c);
        return c;
    }
    /**
     * Dibuja un Pokémon con los pies en (x, footY) y `hPx` de alto.
     * Devuelve qué nivel de recurso se usó (para pruebas y diagnóstico).
     */
    draw(g, id, side, x, footY, hPx, timeMs, alpha = 1, shiny = false) {
        g.imageSmoothingEnabled = false;
        const prev = g.globalAlpha;
        g.globalAlpha = prev * alpha;
        try {
            const key = shiny ? `shiny-${side}${id}` : `${side}${id}`;
            const sheet = this.anims.get(key)?.value;
            if (sheet) {
                const t = ((timeMs % sheet.total) + sheet.total) % sheet.total;
                let f = 0;
                while (f < sheet.n - 1 && sheet.cum[f] <= t) f++;
                const sx = (f % sheet.c) * sheet.w;
                const sy = Math.floor(f / sheet.c) * sheet.h;
                const scale = hPx / sheet.h;
                const w = sheet.w * scale;
                g.drawImage(sheet.img, sx, sy, sheet.w, sheet.h, Math.round(x - w / 2), Math.round(footY - hPx), Math.round(w), Math.round(hPx));
                return 'anim';
            }
            // Nunca sustituir una animación requerida por un sprite estático.
            return 'loading';
        }
        finally {
            g.globalAlpha = prev;
        }
    }
}
