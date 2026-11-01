import { CONFIG } from "../config.js";
import { getSpecies } from "../data/species.js";
import { bakeTowerArt, PX } from "./art.js";
import { THEMES, bakeBackground } from "./arenas.js";
import { Camera } from "./camera.js";
import { Fx, PALETTE, drawProjectile, fxSettingsFor } from "./fx.js";
const F = CONFIG.field;
const BC = CONFIG.battle;
const CORPSE = 0.9;
/** Duración de la animación de derrumbe de una torre. */
const COLLAPSE = 1.1;
const towerArtCache = new Map();
/**
 * Dibuja una `Battle` en un <canvas> a pantalla completa con la cámara en perspectiva.
 * Solo LEE el estado de la simulación (nunca lo modifica): la lógica de combate es independiente de las animaciones.
 */
export class BattleView {
    canvas;
    g;
    sprites;
    audio;
    battle = null;
    fx;
    cam = new Camera();
    arena = 'pewter';
    bg = null;
    towerArt;
    preview = null;
    deployHint = false;
    onEvent = null;
    /** Niveles que se muestran en las insignias de las torres. */
    towerLevels = [1, 1];
    animT = 0;
    lobStart = new Map();
    lastBeam = new Map();
    lastTowerAtk = new Map();
    motes = [];
    reduce = false;
    supportsFilter = false;
    /** Diagnóstico para pruebas de navegador. */
    dbg = { frames: 0, anim: 0, stat: 0, placeholder: 0, maxFx: 0 };
    constructor(canvas, sprites, audio) {
        this.canvas = canvas;
        this.g = canvas.getContext('2d', { alpha: false });
        this.sprites = sprites;
        this.audio = audio;
        this.fx = new Fx(fxSettingsFor('alta', false, true));
        this.supportsFilter = 'filter' in this.g;
        this.setArena('pewter');
    }
    setArena(id) {
        if (!THEMES[id]) id = 'pewter';
        this.arena = id;
        let art = towerArtCache.get(id);
        if (!art) {
            art = bakeTowerArt(THEMES[id].stone);
            towerArtCache.set(id, art);
        }
        this.towerArt = art;
        this.bg = null;
        this.motes = [];
    }
    applySettings(s) {
        this.fx.cfg = fxSettingsFor(s.quality, s.reduceFx, s.shake);
        this.reduce = s.reduceFx;
        const dpr = Math.min(window.devicePixelRatio || 1, s.quality === 'baja' ? 1.25 : s.quality === 'media' ? 2 : 2.5);
        if (dpr !== this.cam.dpr)
            this.bg = null;
        this.cam.dpr = dpr;
    }
    attach(b) {
        this.battle = b;
        this.fx.clear();
        this.lobStart.clear();
        this.lastBeam.clear();
        this.lastTowerAtk.clear();
        this.preview = null;
        this.deployHint = false;
        this.animT = 0;
        b.drainEvents();
    }
    /**
     * Ajusta el lienzo (SIEMPRE a pantalla completa) y coloca el campo entero entre `topInset` y `bottomY`
     * (donde empieza el panel de cartas). Rehace el fondo si cambió algo.
     */
    resize(W, H, topInset, bottomY, sideInset = 0) {
        const dpr = this.cam.dpr;
        const c = this.canvas;
        c.style.width = `${W}px`;
        c.style.height = `${H}px`;
        const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
        if (c.width !== pw || c.height !== ph) {
            c.width = pw;
            c.height = ph;
        }
        this.cam.layout(W, H, dpr, topInset, bottomY, sideInset);
        this.bg = null;
    }
    ensureBg() {
        if (this.bg)
            return;
        this.bg = bakeBackground(this.cam, this.arena);
        // partículas ambientales de la arena
        const n = this.reduce ? 0 : this.fx.cfg.density >= 0.7 ? 22 : 8;
        this.motes = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.02, vy: -0.01 - Math.random() * 0.03, ph: Math.random() * 6, s: 0.6 + Math.random() }));
    }
    /** Coordenadas de pantalla (clientX/Y) -> casillas del campo. */
    toField(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return this.cam.inv(clientX - r.left, clientY - r.top);
    }
    /** ¿Está el punto (casillas) dentro del campo visible? */
    inField(p) {
        return p.x >= 0 && p.x <= F.w && p.y >= 0 && p.y <= F.h;
    }
    /** Unidad propia bajo un toque: se comprueba sobre el cuerpo dibujado (no sobre los pies). */
    unitAt(clientX, clientY, team = 0) {
        if (!this.battle)
            return null;
        const r = this.canvas.getBoundingClientRect();
        const px = clientX - r.left, py = clientY - r.top;
        const cam = this.cam;
        let best = null;
        let bd = Infinity;
        for (const u of this.battle.units) {
            if (u.team !== team || u.state === 'dead')
                continue;
            const T = cam.ts(u.y);
            const lift = u.sp.flying ? 0.85 : 0;
            const X = cam.sx(u.x, u.y);
            const foot = cam.sy(u.y + u.sp.radius * 0.5) - lift * T;
            const cy = foot - u.sp.heightTiles * T * 0.5;
            const reach = Math.max(0.75, u.sp.heightTiles * 0.5) * T + 10;
            const d = Math.hypot(px - X, py - cy);
            if (d < reach && d < bd) {
                bd = d;
                best = u;
            }
        }
        return best;
    }
    /* ───────── eventos de la simulación -> efectos y sonido ───────── */
    handleEvents(evs) {
        const fx = this.fx;
        const au = this.audio;
        const b = this.battle;
        for (const e of evs) {
            this.onEvent?.(e);
            switch (e.type) {
                case 'ability': {
                    const unit=b.unitById(e.unitId);
                    if(unit && unit.state!=='dead') fx.text(unit.x,unit.y,`✦ ${e.ability}`,'#ffe58a',0.9,1.2,unit.sp.heightTiles*0.55+0.9);
                    break;
                }
                case 'weather': {
                    fx.flashColor = '#c8ddff'; fx.flashA = Math.max(fx.flashA,0.08);
                    break;
                }
                case 'deploy': {
                    const sp = getSpecies(e.speciesId);
                    const own = e.team === (this.cam.flip ? 1 : 0);
                    const col = own ? '#7aa6ff' : '#ff8a7a';
                    fx.ring(e.x, e.y, 0.2, 1.3 + sp.radius, col, 0.5, 0.16, false, true);
                    fx.pillar(e.x, e.y, col, 2.6, 0.45);
                    fx.puff(e.x, e.y + 0.3, 8);
                    if (own) {
                        au.sfx('deploy');
                        au.vibrate(12);
                    }
                    break;
                }
                case 'hit': {
                    const tgtUnit = e.targetIsTower ? null : b.unitById(e.targetId);
                    const z = e.targetIsTower ? 1.7 : (tgtUnit ? tgtUnit.sp.heightTiles * 0.45 + (tgtUnit.sp.flying ? 0.85 : 0) : 0.6);
                    const jitter = (((e.targetId * 7) % 5) - 2) * 0.12;
                    if (e.tick) {
                        fx.burst(e.vType, e.x + jitter, e.y, 2, 0.45, z);
                        if (!this.reduce)
                            fx.text(e.x + jitter, e.y, String(e.amount), '#ffb066', 0.62, 0.6, z + 0.5);
                        break;
                    }
                    if (!this.reduce || e.special) {
                        if (e.melee)
                            fx.melee(e.vType, e.x, e.y, z, false);
                        else
                            fx.impact(e.vType, e.x, e.y, z, e.special ? 1.7 : 0.8);
                    }
                    const eff = e.mult >= 1.3 ? 1.3 : e.mult < 0.9 ? 0.85 : 1;
                    const color = e.targetIsTower ? '#ffe9a8' : e.team === 0 ? '#ff8f8f' : e.mult >= 1.3 ? '#ffc23d' : e.mult < 0.9 ? '#b9c2d4' : '#ffffff';
                    if (!this.reduce || e.special || e.mult >= 1.3)
                        fx.text(e.x + jitter, e.y, String(e.amount), color, (e.special ? 1.25 : 1) * eff, 0.9, z + 0.6);
                    if (e.mult >= 1.3) {
                        fx.text(e.x, e.y, '¡Súper eficaz!', '#ffc23d', 0.78, 0.95, z + 1.5);
                        au.sfx('crit', e.vType);
                        fx.shake(0.05);
                    }
                    else if (e.mult > 0 && e.mult <= 0.75 && !e.targetIsTower) {
                        fx.text(e.x, e.y, e.mult <= 0.45 ? 'Casi inmune…' : 'Poco eficaz…', '#aab6cc', 0.62, 0.9, z + 1.4);
                    }
                    if (!e.targetIsTower && e.mult < 1.3)
                        au.sfx('hit', e.vType);
                    break;
                }
                case 'special': {
                    const def = e.def;
                    const pal = PALETTE[def.type];
                    const col = pal[0];
                    const caster = b.unitById(e.unitId);
                    if (def.delivery === 'lob' && def.name === '') {
                        fx.impact(def.type, e.x, e.y, 0.4, 1.9);
                        fx.ring(e.x, e.y, 0.2, def.radius, col, 0.55, 0.2, true);
                        fx.ring(e.x, e.y, 0.2, def.radius * 1.2, pal[2], 0.45, 0.12, false, true);
                        fx.shake(0.14);
                        au.sfx('hit', def.type);
                        break;
                    }
                    if (def.delivery === 'beam') {
                        const last = this.lastBeam.get(e.unitId) ?? -1;
                        if (e.t - last > 0.05) {
                            au.sfx('special', def.type);
                            fx.shake(0.1);
                        }
                        if (e.t - last > 0.5 && def.name)
                            fx.text(e.x, e.y, def.name, col, 0.9, 1.1, (caster?.sp.heightTiles ?? 1.5) + 1.2);
                        this.lastBeam.set(e.unitId, e.t);
                        fx.beam(e.x, e.y, e.tx, e.ty, def.type, 0.5, def.radius * 1.4 + 0.45, (caster?.sp.heightTiles ?? 1.5) * 0.5, 0.7);
                        break;
                    }
                    au.sfx('special', def.type);
                    fx.castAura(def.type, e.x, e.y);
                    if (def.name)
                        fx.text(e.x, e.y, def.name, col, 0.95, 1.3, (caster?.sp.heightTiles ?? 1.5) + 1.4);
                    if (def.delivery === 'aoe') {
                        fx.impact(def.type, e.x, e.y, 0.5, 2.0);
                        fx.ring(e.x, e.y, 0.3, def.radius, col, 0.6, 0.22, true);
                        fx.ring(e.x, e.y, 0.3, def.radius * 1.05, pal[2], 0.5, 0.14, false, true);
                        fx.flash(pal[1], 0.3);
                        fx.shake(0.22);
                    }
                    else if (def.delivery === 'burst') {
                        fx.impact(def.type, e.tx, e.ty, 0.6, 1.9);
                        fx.ring(e.tx, e.ty, 0.2, Math.max(1.2, def.radius), col, 0.5, 0.2, false, true);
                        fx.flash(pal[1], 0.2);
                        fx.shake(0.15);
                    }
                    else if (def.delivery === 'zone') {
                        fx.ring(e.tx, e.ty, 0.2, def.radius, col, 0.6, 0.16, false, true);
                        fx.impact(def.type, e.tx, e.ty, 0.3, 1.3);
                    }
                    else if (def.delivery === 'heal') {
                        fx.ring(e.x, e.y, 0.3, def.radius, '#6fe08a', 0.7, 0.2, true);
                        fx.ring(e.x, e.y, 0.2, def.radius * 0.7, '#c9ffd6', 0.55, 0.14, false, true);
                        fx.pillar(e.x, e.y, '#6fe08a', 3, 0.7);
                    }
                    else {
                        fx.burst(def.type, e.x, e.y, 10, 1.0, 0.8);
                    }
                    break;
                }
                case 'heal':
                    fx.text(e.x, e.y, `+${e.amount}`, '#6fe08a', 0.95, 0.9, 1.6);
                    fx.burst('planta', e.x, e.y, 5, 0.6, 0.8);
                    break;
                case 'death': {
                    const sp = getSpecies(e.speciesId);
                    fx.puff(e.x, e.y, 10 + sp.sizeClass * 2);
                    fx.ring(e.x, e.y, 0.2, 0.9 + sp.radius, '#ffffff', 0.4, 0.12, false, true);
                    fx.burst('normal', e.x, e.y, 6, 0.7, sp.heightTiles * 0.4);
                    au.sfx('death');
                    break;
                }
                case 'towerHit':
                    {
                        const t = b.towers[e.towerId];
                        if (t) {
                            fx.burst('roca', t.x + (Math.random() - 0.5) * 1.6, t.y, 4, 0.8, 1.6 + Math.random());
                            if (t.team === (this.cam.flip ? 1 : 0)) {
                                au.sfx('towerHit');
                                au.vibrate(20);
                            }
                        }
                    }
                    break;
                case 'towerDown':
                    fx.burst('roca', e.x, e.y, 46, 1.8, 1.5);
                    fx.burst('fuego', e.x, e.y, 26, 1.3, 1.2);
                    fx.puff(e.x, e.y, 28, '#9aa3ad');
                    fx.ring(e.x, e.y, 0.4, 4.5, '#ffd27a', 0.8, 0.28, true, true);
                    fx.ring(e.x, e.y, 0.2, 3, '#ffffff', 0.5, 0.2, false, true);
                    fx.flare(e.x, e.y, 1.5, 3.4, '#ffd27a', 0.5, 1.8);
                    fx.flash('#ffd27a', 0.4);
                    fx.shake(0.5);
                    au.sfx('towerDown');
                    au.vibrate([60, 40, 90]);
                    break;
                case 'kingActive': {
                    const t = b.towers[e.towerId];
                    if (t) {
                        fx.ring(t.x, t.y, 0.5, 3.8, '#ffe27a', 0.8, 0.24, false, true);
                        fx.pillar(t.x, t.y, '#ffe27a', 5, 0.9);
                        fx.flare(t.x, t.y, 3, 2.6, '#ffe27a', 0.5, 1.6);
                        fx.text(t.x, t.y, '¡Torre del Rey activa!', '#ffe27a', 0.85, 1.5, 4.4);
                    }
                    au.sfx('ready');
                    break;
                }
                case 'phase':
                    au.sfx('final');
                    fx.flash(e.name === 'overtime' ? '#ff4d4d' : '#ffd23f', 0.28);
                    if (e.name === 'overtime') {
                        fx.shake(0.6);
                        fx.text(9, 16, '¡MUERTE SÚBITA!', '#ff6b6b', 1.4, 2.6, 6);
                    }
                    break;
                default:
                    break;
            }
        }
    }
    /* ───────── fotograma ───────── */
    /**
     * `dt`: segundos reales desde el fotograma anterior (0 en pausa; congela efectos y animaciones).
     * `alpha`: fracción del paso de simulación pendiente (interpolación de posiciones).
     */
    drawWeather(g, weather) {
        if (!weather || weather === 'neutral') return;
        const W=this.cam.W,H=this.cam.H,t=this.animT;
        g.save();
        if(weather==='sun'){g.fillStyle='rgba(255,205,80,0.055)';g.fillRect(0,0,W,H);}
        const weatherName={sun:'SOL INTENSO',rain:'LLUVIA',storm:'TORMENTA',hail:'NIEVE / GRANIZO',sand:'TORMENTA DE ARENA'}[weather];
        if(weatherName){g.fillStyle='rgba(8,18,42,.62)';g.fillRect(148,8,126,19);g.font='bold 9px sans-serif';g.textBaseline='middle';g.fillStyle='#fff0b0';g.fillText(weatherName,154,17);}
        if(weather==='rain'||weather==='storm'){
            g.strokeStyle=weather==='storm'?'rgba(170,205,255,.42)':'rgba(190,220,255,.30)';
            g.lineWidth=1;
            for(let i=0;i<70;i++){const x=(i*97+t*150)%W,y=(i*53+t*360)%H;g.beginPath();g.moveTo(x,y);g.lineTo(x-5,y+13);g.stroke();}
            if(weather==='storm' && Math.sin(t*1.7)>0.992){g.fillStyle='rgba(220,235,255,.12)';g.fillRect(0,0,W,H);}
        }
        if(weather==='hail'){
            g.fillStyle='rgba(245,250,255,.65)';
            for(let i=0;i<45;i++){const x=(i*71+t*17)%W,y=(i*43+t*70)%H;g.fillRect(x,y,2,2);}
        }
        if(weather==='sand'){
            g.fillStyle='rgba(218,174,105,.20)';
            for(let i=0;i<60;i++){const x=(i*83+t*30)%W,y=(i*47+t*12)%H;g.fillRect(x,y,2,1);}
        }
        g.restore();
    }
    frame(dt, alpha) {
        const b = this.battle;
        if (!b)
            return;
        this.ensureBg();
        const g = this.g;
        const cam = this.cam;
        const dpr = cam.dpr;
        this.handleEvents(b.drainEvents());
        if (dt > 0) {
            this.animT += dt;
            this.fx.update(dt);
            this.ambient(dt);
        }
        this.dbg.frames++;
        this.dbg.maxFx = Math.max(this.dbg.maxFx, this.fx.count);
        const now = b.time;
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.imageSmoothingEnabled = false;
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
        // El fondo ya se pinta con la cámara (incluido el giro del invitado): copiarlo tal cual.
        g.drawImage(this.bg.canvas, 0, 0);
        const sh = this.fx.cfg.shake ? this.fx.shakeAmp * cam.tile * 0.5 : 0;
        g.setTransform(dpr, 0, 0, dpr, sh > 0 ? (Math.random() - 0.5) * 2 * sh * dpr : 0, sh > 0 ? (Math.random() - 0.5) * 2 * sh * dpr : 0);
        this.drawWater(g);
        this.drawWeather(g, b.weather);
        this.drawMotes(g, dt);
        if (this.deployHint)
            this.drawDeployHint(g);
        this.drawZones(g, now);
        this.fx.drawGround(g, cam);
        const list = [];
        for (const t of b.towers)
            list.push({ z: (cam.flip ? F.h - t.y : t.y) + 1.2, draw: () => this.drawTower(g, t, now) });
        for (const u of b.units) {
            if (u.state === 'dead' && now - u.deadAt > CORPSE)
                continue;
            list.push({ z: (u.sp.flying ? 100 : 0) + (cam.flip ? F.h - u.y : u.y), draw: () => this.drawUnit(g, u, alpha, now) });
        }
        list.sort((a, c) => a.z - c.z);
        for (const d of list)
            d.draw();
        for (const p of b.projectiles)
            this.drawProj(g, p, alpha);
        this.drawPreview(g);
        this.fx.drawAir(g, cam);
        // barras y marcadores por encima de todo
        for (const t of b.towers)
            this.drawTowerBar(g, t, now);
        for (const u of b.units)
            if (u.state !== 'dead')
                this.drawUnitBar(g, u, alpha, now);
        this.fx.drawFloats(g, cam);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (this.fx.flashA > 0.01) {
            g.globalAlpha = this.fx.flashA;
            g.fillStyle = this.fx.flashColor;
            g.fillRect(0, 0, cam.W, cam.H);
            g.globalAlpha = 1;
        }
        g.setTransform(1, 0, 0, 1, 0, 0);
    }
    /** Efectos ambientales y de estado (llamas en quemados, humo de torres dañadas, polvo del derrumbe, estelas…). */
    ambient(dt) {
        const b = this.battle;
        if (this.reduce)
            return;
        const fx = this.fx;
        for (const u of b.units) {
            if (u.state === 'dead')
                continue;
            const z = u.sp.heightTiles * 0.4 + (u.sp.flying ? 0.85 : 0);
            if (u.burn && Math.random() < dt * 16)
                fx.burst('fuego', u.x, u.y, 1, 0.5, z);
            if (u.stunT > 0 && Math.random() < dt * 8)
                fx.burst('electrico', u.x, u.y, 1, 0.3, u.sp.heightTiles + 0.4);
        }
        for (const z of b.zones) {
            if (Math.random() < dt * 22) {
                const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * z.r;
                fx.burst(z.type, z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * 0.8, 1, 0.5, 0.2);
            }
        }
        for (const p of b.projectiles) {
            if (fx.cfg.trails && Math.random() < dt * 40) {
                const arc = this.lobArc(p);
                fx.trail(p.fromTower ? 'normal' : p.vType, p.x, p.y, (p.fromTower ? 1.8 : 0.9) + arc, p.special ? 1.5 : 1);
            }
        }
        for (const t of b.towers) {
            const hpk = t.hp / t.maxHp;
            if (!t.destroyed && hpk < 0.5 && Math.random() < dt * (hpk < 0.25 ? 9 : 4)) {
                fx.smoke(t.x + (Math.random() - 0.5) * 1.2, t.y, 2.6 + Math.random() * 0.6, hpk < 0.25);
            }
            if (t.destroyed && b.time - t.destroyedAt < COLLAPSE && Math.random() < dt * 40) {
                fx.puff(t.x + (Math.random() - 0.5) * 2.4, t.y + 0.3, 1, '#a9a49c');
                if (Math.random() < 0.5)
                    fx.burst('roca', t.x + (Math.random() - 0.5) * 2, t.y, 1, 0.6, 2 + Math.random());
            }
            const last = this.lastTowerAtk.get(t.id) ?? -9;
            if (t.attackAt !== last) {
                this.lastTowerAtk.set(t.id, t.attackAt);
                if (t.attackAt > 0) {
                    const dir = t.team === 0 ? -1 : 1;
                    fx.flare(t.x, t.y + dir * 0.4, t.kind === 'king' ? 2.6 : 2.2, 0.9, '#ffe9a8', 0.16, 1.4);
                    fx.burst('normal', t.x, t.y + dir * 0.5, 2, 0.4, 2.3);
                }
            }
        }
        if (this.lobStart.size > 50) {
            const alive = new Set(b.projectiles.map((p) => p.id));
            for (const k of this.lobStart.keys())
                if (!alive.has(k))
                    this.lobStart.delete(k);
        }
    }
    /** Altura (casillas) de un proyectil lento que describe un arco. */
    lobArc(p) {
        if (p.homing || p.radius <= 0)
            return 0;
        const rem = Math.hypot(p.tx - p.x, p.ty - p.y);
        let total = this.lobStart.get(p.id);
        if (total === undefined) {
            total = rem + 0.01;
            this.lobStart.set(p.id, total);
        }
        const prog = 1 - rem / total;
        return Math.sin(Math.PI * Math.max(0, Math.min(1, prog))) * 2.2;
    }
    drawWater(g) {
        if (this.reduce)
            return;
        const cam = this.cam;
        const th = THEMES[this.arena];
        const rows = 4;
        g.save();
        g.lineWidth = Math.max(1, cam.tile * 0.07);
        for (let row = 0; row < rows; row++) {
            const wy = F.riverY0 + (F.riverY1 - F.riverY0) * ((row + 0.5) / rows);
            g.strokeStyle = th.river.kind === 'canal' ? (row % 2 ? 'rgba(190,246,255,.55)' : 'rgba(255,242,122,.4)') : 'rgba(255,255,255,.38)';
            g.beginPath();
            for (let x = 0.7; x <= F.w - 0.7; x += 0.5) {
                const wob = Math.sin(x * 1.1 + this.animT * 2.2 + row * 1.7) * 0.09;
                const sx = cam.sx(x, wy), sy = cam.sy(wy + wob);
                if (x === 0.7)
                    g.moveTo(sx, sy);
                else
                    g.lineTo(sx, sy);
            }
            g.stroke();
        }
        g.restore();
    }
    /** Motas ambientales de la arena (polvo, burbujas, chispas, pétalos), muy sutiles. */
    drawMotes(g, dt) {
        if (!this.motes.length)
            return;
        const cam = this.cam;
        const am = THEMES[this.arena].ambient;
        g.fillStyle = am.color;
        for (const m of this.motes) {
            m.x += (m.vx + Math.sin(this.animT * 0.8 + m.ph) * 0.01) * dt;
            m.y += (am.kind === 'petal' ? 0.03 : am.kind === 'spark' ? -0.08 * Math.random() : m.vy) * dt;
            if (m.y < -0.05)
                m.y = 1.05;
            if (m.y > 1.05)
                m.y = -0.05;
            if (m.x < -0.05)
                m.x = 1.05;
            if (m.x > 1.05)
                m.x = -0.05;
            const X = cam.cx - cam.fw / 2 + m.x * cam.fw, Y = cam.topY + m.y * cam.fh;
            const s = Math.max(1.5, cam.tile * 0.12 * m.s);
            g.globalAlpha = am.kind === 'spark' ? 0.4 + 0.5 * Math.abs(Math.sin(this.animT * 12 + m.ph)) : 0.5;
            if (am.kind === 'bubble') {
                g.strokeStyle = am.color;
                g.lineWidth = 1;
                g.beginPath();
                g.arc(X, Y, s, 0, Math.PI * 2);
                g.stroke();
            }
            else if (am.kind === 'petal')
                g.fillRect(X, Y, s * 1.4, s * 0.8);
            else
                g.fillRect(X, Y, s, s);
        }
        g.globalAlpha = 1;
    }
    /** Cuadrilátero del suelo (casillas) proyectado. */
    quad(g, x0, y0, x1, y1) {
        const cam = this.cam;
        g.beginPath();
        g.moveTo(cam.sx(x0, y0), cam.sy(y0));
        g.lineTo(cam.sx(x1, y0), cam.sy(y0));
        g.lineTo(cam.sx(x1, y1), cam.sy(y1));
        g.lineTo(cam.sx(x0, y1), cam.sy(y1));
        g.closePath();
    }
    groundEllipse(g, x, y, r) {
        const cam = this.cam;
        const s = cam.ts(y);
        g.beginPath();
        g.ellipse(cam.sx(x, y), cam.sy(y), r * s, r * s * cam.vr(y), 0, 0, Math.PI * 2);
    }
    drawDeployHint(g) {
        const b = this.battle;
        const cam = this.cam;
        const team = cam.flip ? 1 : 0;
        const ownLine = team === 0 ? F.playerDeployMinY : F.enemyDeployMaxY;
        g.fillStyle = 'rgba(80,140,255,.16)';
        if (team === 0)
            this.quad(g, 0, F.playerDeployMinY, F.w, F.h);
        else
            this.quad(g, 0, 0, F.w, F.enemyDeployMaxY);
        g.fill();
        g.fillStyle = 'rgba(190,30,30,.22)';
        if (team === 0)
            this.quad(g, 0, 0, F.w, F.enemyDeployMaxY + 0.6);
        else
            this.quad(g, 0, F.playerDeployMinY, F.w, F.h);
        g.fill();
        // Cuando cae una torre lateral, colorea la franja del carril que acaba de desbloquearse.
        const enemy = team === 0 ? 1 : 0;
        for (const kind of ['left', 'right']) {
            const tower = b.towers.find((t) => t.team === enemy && t.kind === kind);
            if (!tower?.destroyed)
                continue;
            const x0 = kind === 'left' ? 0 : F.centerX;
            const x1 = kind === 'left' ? F.centerX : F.w;
            const y0 = team === 0 ? tower.y + tower.radius : F.riverY1;
            const y1 = team === 0 ? F.riverY0 : tower.y - tower.radius;
            g.fillStyle = 'rgba(65,235,160,.26)';
            this.quad(g, x0, y0, x1, y1);
            g.fill();
            g.strokeStyle = 'rgba(95,255,185,.8)';
            g.setLineDash([cam.tile * .3, cam.tile * .2]);
            this.quad(g, x0, y0, x1, y1);
            g.stroke();
            g.setLineDash([]);
        }
        g.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(this.animT * 5) * 0.2})`;
        g.lineWidth = Math.max(1.5, cam.tile * 0.09);
        g.setLineDash([cam.tile * 0.5, cam.tile * 0.35]);
        g.beginPath();
        g.moveTo(cam.sx(0, ownLine), cam.sy(ownLine));
        g.lineTo(cam.sx(F.w, ownLine), cam.sy(ownLine));
        g.stroke();
        g.setLineDash([]);
        for (const t of b.towers) {
            if (t.destroyed || t.team !== team)
                continue;
            g.fillStyle = 'rgba(200,40,40,.24)';
            this.groundEllipse(g, t.x, t.y, t.radius + 0.55);
            g.fill();
        }
    }
    drawZones(g, now) {
        const b = this.battle;
        const cam = this.cam;
        for (const z of b.zones) {
            const pal = PALETTE[z.type];
            const pulse = 0.88 + Math.sin(now * 6) * 0.07;
            g.globalAlpha = 0.3;
            g.fillStyle = pal[0];
            this.groundEllipse(g, z.x, z.y, z.r * pulse);
            g.fill();
            g.globalAlpha = 0.85;
            g.strokeStyle = pal[2];
            g.lineWidth = Math.max(1.5, cam.tile * 0.07);
            g.setLineDash([cam.tile * 0.3, cam.tile * 0.25]);
            this.groundEllipse(g, z.x, z.y, z.r);
            g.stroke();
            g.setLineDash([]);
            g.globalAlpha = 1;
        }
    }
    towerKey(t) {
        const king = t.kind === 'king';
        const k = king ? 'king' : 'side';
        const visualTeam = this.cam.flip ? (t.team === 0 ? 1 : 0) : t.team;
        if (t.destroyed)
            return `${visualTeam}-${k}-ruin`;
        if (king && !t.active)
            return `${visualTeam}-${k}-off`;
        const hp = t.hp / t.maxHp;
        return `${visualTeam}-${k}-${hp > 0.66 ? 'on' : hp > 0.33 ? 'd1' : 'd2'}`;
    }
    drawTower(g, t, now) {
        const cam = this.cam;
        const king = t.kind === 'king';
        const T = cam.ts(t.y);
        const baseY = cam.sy(t.y + (king ? 1.8 : 1.45));
        const X = cam.sx(t.x, t.y);
        let key = this.towerKey(t);
        let art = this.towerArt[key];
        let w = (art.width / PX) * T, h = (art.height / PX) * T;
        let jx = 0;
        let sink = 0;
        let alpha = 1;
        const since = t.destroyed ? now - t.destroyedAt : 0;
        if (t.destroyed && since < COLLAPSE) {
            // derrumbe: la torre dañada se hunde y tiembla mientras aparecen los escombros
            const k = since / COLLAPSE;
            const visualTeam = cam.flip ? (t.team === 0 ? 1 : 0) : t.team;
            key = `${visualTeam}-${king ? 'king' : 'side'}-d2`;
            const rubble = this.towerArt[`${visualTeam}-${king ? 'king' : 'side'}-ruin`];
            g.drawImage(rubble, Math.round(X - w / 2), Math.round(baseY - (rubble.height / PX) * T), Math.round((rubble.width / PX) * T), Math.round((rubble.height / PX) * T));
            art = this.towerArt[key];
            sink = k * h * 0.9;
            jx = Math.round(Math.sin(now * 90) * (1 - k) * 0.12 * T);
            alpha = 1 - k * k;
        }
        else if (!t.destroyed && now - t.hurtAt < 0.12) {
            jx = Math.round((Math.random() - 0.5) * 0.14 * T);
        }
        // retroceso al disparar
        let squash = 1;
        const sa = now - t.attackAt;
        if (!t.destroyed && sa >= 0 && sa < 0.18)
            squash = 1 - Math.sin((Math.PI * sa) / 0.18) * 0.045;
        if (!(t.destroyed && since >= COLLAPSE) || true) {
            g.save();
            g.globalAlpha = alpha;
            if (t.destroyed && since < COLLAPSE) {
                g.beginPath();
                g.rect(X - w, baseY - h - T, w * 2, h + T);
                g.clip();
            }
            if (!t.destroyed && now - t.hurtAt < 0.09 && this.supportsFilter)
                g.filter = 'brightness(1.9)';
            const hh = h * squash;
            g.drawImage(art, Math.round(X - w / 2 + jx), Math.round(baseY - hh + sink), Math.round(w), Math.round(hh));
            g.filter = 'none';
            g.restore();
        }
        if (king && !t.active && !t.destroyed && !this.reduce) {
            const zz = (this.animT * 0.8) % 1.6;
            g.globalAlpha = 1 - zz / 1.6;
            g.fillStyle = '#e8f0ff';
            g.font = `800 ${Math.round(T * 0.6)}px system-ui`;
            g.textAlign = 'center';
            g.fillText('z', X + (1.1 + zz * 0.5) * T, baseY - h - zz * 0.8 * T + T);
            g.globalAlpha = 1;
        }
    }
    /** Barra de vida sobre la torre, con insignia de nivel y corona como en los juegos de cartas móviles. */
    drawTowerBar(g, t, now) {
        if (t.destroyed)
            return;
        const cam = this.cam;
        const king = t.kind === 'king';
        const T = cam.ts(t.y);
        const art = this.towerArt[this.towerKey(t)];
        const topY = cam.sy(t.y + (king ? 1.8 : 1.45)) - (art.height / PX) * T;
        const w = (king ? 3.0 : 2.5) * T, h = 0.5 * T;
        const X = cam.sx(t.x, t.y);
        const x = X - w / 2 + 0.25 * T, y = topY - h * 0.2 - (king ? 0.1 : 0.2) * T;
        const k = Math.max(0, t.hp / t.maxHp);
        const hurt = now - t.hurtAt < 0.25;
        // base
        g.fillStyle = 'rgba(8,14,28,.9)';
        this.roundRect(g, x - 1.5, y - 1.5, w + 3, h + 3, h * 0.45);
        g.fill();
        const visualTeam = this.cam.flip ? (t.team === 0 ? 1 : 0) : t.team;
        g.fillStyle = visualTeam === 0 ? '#2f8bff' : '#ff4f3f';
        this.roundRect(g, x, y, Math.max(h * 0.5, w * k), h, h * 0.4);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.28)';
        this.roundRect(g, x, y, Math.max(h * 0.5, w * k), h * 0.42, h * 0.3);
        g.fill();
        if (hurt) {
            g.fillStyle = 'rgba(255,255,255,.55)';
            this.roundRect(g, x, y, Math.max(h * 0.5, w * k), h, h * 0.4);
            g.fill();
        }
        // número de vida
        g.fillStyle = '#fff';
        g.strokeStyle = 'rgba(8,14,28,.95)';
        g.lineWidth = Math.max(2, T * 0.14);
        g.lineJoin = 'round';
        g.font = `900 ${Math.round(T * 0.46)}px "Trebuchet MS", system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const txt = String(Math.max(0, Math.ceil(t.hp)));
        g.strokeText(txt, x + w / 2 + 0.1 * T, y + h / 2 + 0.02 * T);
        g.fillText(txt, x + w / 2 + 0.1 * T, y + h / 2 + 0.02 * T);
        // insignia de nivel (escudo con corona)
        const bx = x - 0.05 * T, by = y + h / 2, br = 0.46 * T;
        g.fillStyle = '#10192c';
        g.beginPath();
        g.arc(bx, by, br + 1.5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = king ? '#f6c945' : visualTeam === 0 ? '#3b8dff' : '#ff5a4a';
        g.beginPath();
        g.arc(bx, by, br, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,.3)';
        g.beginPath();
        g.arc(bx - br * 0.2, by - br * 0.25, br * 0.55, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#fff';
        g.font = `900 ${Math.round(T * 0.5)}px "Trebuchet MS", system-ui, sans-serif`;
        g.strokeText(String(this.towerLevels[t.team]), bx, by + 0.03 * T);
        g.fillText(String(this.towerLevels[t.team]), bx, by + 0.03 * T);
    }
    roundRect(g, x, y, w, h, r) {
        const rr = Math.min(r, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + rr, y);
        g.arcTo(x + w, y, x + w, y + h, rr);
        g.arcTo(x + w, y + h, x, y + h, rr);
        g.arcTo(x, y + h, x, y, rr);
        g.arcTo(x, y, x + w, y, rr);
        g.closePath();
    }
    drawUnit(g, u, alpha, now) {
        const cam = this.cam;
        const sp = u.sp;
        const ix = u.px + (u.x - u.px) * alpha, iy = u.py + (u.y - u.py) * alpha;
        const T = cam.ts(iy);
        let a = 1, scale = 1, lift = sp.flying ? 0.85 + Math.sin(this.animT * 3 + u.id) * 0.1 : 0;
        let ox = 0, oy = 0;
        if (u.state === 'spawning') {
            const k = 1 - Math.max(0, u.spawnT) / BC.spawnDelaySec;
            a = 0.25 + 0.75 * k;
            scale = 0.55 + 0.45 * k;
        }
        else if (u.state === 'dead') {
            const k = Math.min(1, (now - u.deadAt) / CORPSE);
            a = 1 - k;
            scale = 1 + 0.15 * k;
            lift += k * 0.5;
        }
        else {
            const since = now - u.attackAt;
            if (since >= 0 && since < 0.32) {
                const l = Math.sin((Math.PI * since) / 0.32) * (sp.ranged ? 0.1 : 0.45);
                ox += u.faceX * l;
                oy += u.faceY * l;
            }
            if (now - u.hurtAt < 0.12)
                ox += Math.sin(this.animT * 90) * 0.06;
            const cs = now - u.castAt;
            if (cs >= 0 && cs < 0.4)
                scale += Math.sin((Math.PI * cs) / 0.4) * 0.14;
        }
        const X = cam.sx(ix + ox, iy + oy);
        const feetWorldY = iy + oy + sp.radius * 0.5;
        const groundY = cam.sy(feetWorldY);
        const vr = cam.vr(iy);
        if (u.state === 'spawning') {
            const k = 1 - Math.max(0, u.spawnT) / BC.spawnDelaySec;
            g.strokeStyle = u.team === (cam.flip ? 1 : 0) ? 'rgba(122,166,255,.9)' : 'rgba(255,138,122,.9)';
            g.lineWidth = Math.max(2, T * 0.1);
            g.beginPath();
            g.ellipse(X, groundY, (0.6 + (1 - k) * 0.9 + sp.radius) * T, (0.6 + (1 - k) * 0.9 + sp.radius) * T * vr, 0, 0, Math.PI * 2);
            g.stroke();
        }
        // sombra (sirve también como indicador de posición para los voladores)
        g.globalAlpha = a * (sp.flying ? 0.35 : 0.3);
        g.fillStyle = '#10182b';
        g.beginPath();
        const sr = Math.max(0.5, sp.radius * 1.25) * T * (sp.flying ? 0.8 : 1);
        g.ellipse(X, groundY, sr, Math.max(sr * vr * 1.1, 2), 0, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        const hPx = sp.heightTiles * T * scale;
        const stunned = u.stunT > 0;
        const timeMs = stunned || u.state === 'spawning' ? u.id * 131 : this.animT * 1000 + u.id * 131;
        const flashHit = this.supportsFilter && now - u.hurtAt < 0.09 && u.state !== 'dead';
        if (flashHit)
            g.filter = 'brightness(2.1) saturate(.6)';
        const level = this.sprites.draw(g, sp.id, u.team === (cam.flip ? 1 : 0) ? 'b' : 'f', X, groundY - lift * T, hPx, timeMs, a, u.isShiny);
        if (flashHit)
            g.filter = 'none';
        if (level === 'anim')
            this.dbg.anim++;
        else if (level === 'static')
            this.dbg.stat++;
        else
            this.dbg.placeholder++;
        if (u.state === 'dead')
            return;
        const top = groundY - lift * T - hPx;
        if (stunned) {
            g.fillStyle = '#ffe24a';
            for (let i = 0; i < 3; i++) {
                const ang = this.animT * 5 + (i * Math.PI * 2) / 3;
                g.fillRect(X + Math.cos(ang) * T * 0.55 - T * 0.1, top + Math.sin(ang) * T * 0.16 - T * 0.1, T * 0.22, T * 0.22);
            }
        }
        if (u.slowT > 0) {
            g.strokeStyle = 'rgba(140,220,255,.9)';
            g.lineWidth = Math.max(2, T * 0.08);
            g.beginPath();
            g.ellipse(X, groundY, (sp.radius + 0.35) * T, (sp.radius + 0.35) * T * vr, 0, 0, Math.PI * 2);
            g.stroke();
        }
    }
    drawUnitBar(g, u, alpha, now) {
        if (u.state === 'spawning' && u.hp >= u.maxHp)
            return;
        const cam = this.cam;
        const sp = u.sp;
        const ix = u.px + (u.x - u.px) * alpha, iy = u.py + (u.y - u.py) * alpha;
        const T = cam.ts(iy);
        const lift = sp.flying ? 0.9 : 0;
        const recent = now - u.hurtAt < 3 || u.dummy;
        const ready = u.team === (cam.flip ? 1 : 0) && !u.dummy && u.spCd <= 0 && u.state !== 'spawning';
        const w = Math.max(1.2, sp.radius * 2.5) * T, h = 0.24 * T;
        const X = cam.sx(ix, iy);
        const x = X - w / 2;
        const y = cam.sy(iy + sp.radius * 0.5) - lift * T - sp.heightTiles * T - 0.38 * T;
        if (u.hp < u.maxHp || recent) {
            g.fillStyle = 'rgba(8,14,28,.88)';
            this.roundRect(g, x - 1, y - 1, w + 2, h + 2, h * 0.5);
            g.fill();
            g.fillStyle = u.team === (cam.flip ? 1 : 0) ? '#3ea0ff' : '#ff5a4a';
            this.roundRect(g, x, y, Math.max(h * 0.6, w * Math.max(0, u.hp / u.maxHp)), h, h * 0.45);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,.28)';
            this.roundRect(g, x, y, Math.max(h * 0.6, w * Math.max(0, u.hp / u.maxHp)), h * 0.4, h * 0.3);
            g.fill();
        }
        if (ready) {
            // marcador de especial disponible (rayo amarillo que late)
            const p = 1 + Math.sin(this.animT * 8 + u.id) * 0.12;
            const cx = X, cy = y - 0.5 * T, s = 0.36 * T * p;
            g.fillStyle = '#ffd23f';
            g.strokeStyle = '#1b2230';
            g.lineWidth = Math.max(1.5, T * 0.07);
            g.beginPath();
            g.moveTo(cx + s * 0.2, cy - s);
            g.lineTo(cx - s * 0.7, cy + s * 0.15);
            g.lineTo(cx - s * 0.05, cy + s * 0.15);
            g.lineTo(cx - s * 0.25, cy + s);
            g.lineTo(cx + s * 0.7, cy - s * 0.25);
            g.lineTo(cx + s * 0.05, cy - s * 0.25);
            g.closePath();
            g.fill();
            g.stroke();
        }
    }
    drawProj(g, p, alpha) {
        const cam = this.cam;
        const x = p.px + (p.x - p.px) * alpha, y = p.py + (p.y - p.py) * alpha;
        const T = cam.ts(y);
        const arc = this.lobArc(p);
        const z = (p.fromTower ? 1.8 : 0.9) + arc;
        const X = cam.sx(x, y), Y = cam.sy(y) - z * T;
        const X2 = cam.sx(p.tx, p.ty), Y2 = cam.sy(p.ty) - (p.fromTower ? 0.8 : 0.5) * cam.ts(p.ty);
        let ang = Math.atan2(Y2 - Y, X2 - X);
        if (!Number.isFinite(ang))
            ang = 0;
        if (!p.homing && p.radius > 0) {
            // sombra en el suelo bajo el proyectil lanzado
            g.globalAlpha = 0.32;
            g.fillStyle = '#10182b';
            g.beginPath();
            g.ellipse(X, cam.sy(y), T * 0.45, T * 0.45 * cam.vr(y), 0, 0, Math.PI * 2);
            g.fill();
            g.globalAlpha = 1;
        }
        const size = p.fromTower ? 0.42 : p.special ? (p.radius > 0 ? 0.95 : 0.75) : 0.5;
        drawProjectile(g, { X, Y, r: size * T * (1 + arc * 0.06), ang, type: p.vType, t: this.animT, team: p.team, tower: p.fromTower, special: p.special }, this.fx.cfg.glow);
    }
    drawPreview(g) {
        const pv = this.preview;
        if (!pv)
            return;
        const cam = this.cam;
        const sp = getSpecies(pv.speciesId);
        const T = cam.ts(pv.y);
        const X = cam.sx(pv.x, pv.y), Y = cam.sy(pv.y);
        g.strokeStyle = pv.valid ? 'rgba(255,255,255,.6)' : 'rgba(255,90,90,.85)';
        g.lineWidth = Math.max(1.5, T * 0.07);
        g.setLineDash([T * 0.35, T * 0.3]);
        this.groundEllipse(g, pv.x, pv.y, sp.range + sp.radius);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = pv.valid ? 'rgba(120,170,255,.32)' : 'rgba(255,70,70,.34)';
        this.groundEllipse(g, pv.x, pv.y, sp.radius + 0.55);
        g.fill();
        const foot = cam.sy(pv.y + sp.radius * 0.5);
        this.sprites.draw(g, sp.id, 'b', X, foot - (sp.flying ? 0.85 * T : 0), sp.heightTiles * T, this.animT * 1000, pv.valid ? 0.75 : 0.4);
        void Y;
    }
    /** Para pruebas: tipos de efecto activos. */
    describeFx() {
        return { particles: this.fx.parts.length, rings: this.fx.rings.length, beams: this.fx.beams.length, floats: this.fx.floats.length };
    }
}
