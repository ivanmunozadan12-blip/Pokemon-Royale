const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
/** Pasos de cada pista: [nota MIDI de melodía | 0, nota MIDI de bajo | 0] por corchea. */
const TRACKS = {
    menu: {
        bpm: 84,
        lead: 'triangle',
        bass: 'sine',
        steps: [
            [69, 45], [72, 0], [76, 0], [72, 0], [65, 41], [69, 0], [72, 0], [69, 0],
            [67, 36], [71, 0], [74, 0], [71, 0], [67, 43], [71, 0], [74, 0], [79, 0],
            [69, 45], [72, 0], [76, 0], [81, 0], [77, 41], [72, 0], [69, 0], [72, 0],
            [74, 43], [71, 0], [67, 0], [71, 0], [69, 45], [0, 0], [64, 0], [0, 0],
        ],
    },
    battle: {
        bpm: 148,
        lead: 'square',
        bass: 'sawtooth',
        steps: [
            [69, 33], [0, 0], [72, 33], [0, 33], [74, 33], [0, 0], [72, 33], [0, 0],
            [69, 29], [0, 0], [72, 29], [0, 29], [76, 29], [0, 0], [74, 29], [0, 0],
            [67, 31], [0, 0], [71, 31], [0, 31], [74, 31], [0, 0], [71, 31], [0, 0],
            [72, 28], [74, 0], [76, 28], [0, 28], [79, 28], [76, 0], [74, 28], [72, 0],
        ],
    },
};
// Pistas chiptune originales generadas para cada gimnasio/ciudad. No contienen
// melodías extraídas de los juegos oficiales ni muestras con copyright.
const ARENA_KEYS = {
  pewter: [0, 2, 3, 7, 10], cerulean: [0, 2, 4, 7, 9],
  vermilion: [0, 2, 5, 7, 9], celadon: [0, 2, 4, 7, 11],
  fuchsia: [0, 3, 5, 7, 10], saffron: [0, 2, 5, 8, 10],
  cinnabar: [0, 3, 5, 7, 10], viridian: [0, 2, 4, 7, 9],
  'victory-road': [0, 2, 3, 7, 9], 'indigo-plateau': [0, 2, 4, 7, 11]
};
function arenaTrack(id) {
  const scale = ARENA_KEYS[id] || ARENA_KEYS.pewter;
  const seed = Object.keys(ARENA_KEYS).indexOf(id);
  const root = 57 + (seed % 4) * 2;
  const pattern = Array.from({ length: 32 }, (_, i) => {
    const degree = [0, 2, 4, 2, 1, 3, 4, 2, 0, 2, 3, 1, 4, 3, 2, 1][(i + seed * 3) % 16];
    const note = root + scale[degree % scale.length] + (i % 16 >= 8 ? 12 : 0);
    const bass = i % 4 === 0 ? root - 12 + scale[(Math.floor(i / 4) + seed) % scale.length] : 0;
    return [i % 8 === 7 && seed % 2 ? 0 : note, bass];
  });
  return { bpm: 96 + seed * 2, lead: 'triangle', bass: 'sine', steps: pattern };
}
TRACKS.overtime = {
  bpm: 164, lead: 'square', bass: 'sawtooth',
  steps: Array.from({ length: 32 }, (_, i) => {
    const lead = [81, 84, 88, 91, 88, 84, 86, 93, 81, 84, 89, 93, 96, 93, 89, 86][i % 16];
    return [lead, i % 2 === 0 ? [33, 36, 38, 31][Math.floor(i / 8)] : 0];
  })
};
export class AudioEngine {
    ctx = null;
    sfxGain = null;
    musicGain = null;
    noiseBuf = null;
    getSettings;
    track = 'none';
    step = 0;
    nextTime = 0;
    timer = null;
    lastHit = 0;
    /** Contadores para pruebas: cuántos efectos se han pedido y cuántos se han reproducido. */
    stats = { requested: 0, played: 0, musicSteps: 0 };
    constructor(getSettings) {
        this.getSettings = getSettings;
    }
    get supported() {
        return typeof globalThis.AudioContext !== 'undefined' ||
            typeof globalThis.webkitAudioContext !== 'undefined';
    }
    get running() {
        return !!this.ctx && this.ctx.state === 'running';
    }
    /** Debe llamarse dentro de un gesto del usuario (toque/clic/tecla). */
    unlock() {
        try {
            if (!this.ctx) {
                const AC = globalThis;
                const C = AC.AudioContext ?? AC.webkitAudioContext;
                if (!C)
                    return;
                this.ctx = new C();
                this.sfxGain = this.ctx.createGain();
                this.musicGain = this.ctx.createGain();
                this.sfxGain.connect(this.ctx.destination);
                this.musicGain.connect(this.ctx.destination);
                const len = this.ctx.sampleRate;
                this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
                const d = this.noiseBuf.getChannelData(0);
                for (let i = 0; i < len; i++)
                    d[i] = Math.random() * 2 - 1;
                this.applySettings();
            }
            if (this.ctx.state === 'suspended')
                void this.ctx.resume();
            if (this.track !== 'none')
                this.startScheduler();
        }
        catch {
            this.ctx = null;
        }
    }
    applySettings() {
        const s = this.getSettings();
        if (!this.ctx || !this.sfxGain || !this.musicGain)
            return;
        const t = this.ctx.currentTime;
        this.sfxGain.gain.setTargetAtTime(s.sfxOn ? s.sfxVol * 0.9 : 0, t, 0.02);
        this.musicGain.gain.setTargetAtTime(s.musicOn ? s.musicVol * 0.35 : 0, t, 0.05);
    }
    /** Suspende todo el sonido (pestaña en segundo plano) o lo reanuda. */
    setSuspended(on) {
        if (!this.ctx)
            return;
        try {
            if (on)
                void this.ctx.suspend();
            else
                void this.ctx.resume();
        }
        catch { /* nada */ }
    }
    vibrate(ms) {
        if (!this.getSettings().vibration)
            return;
        try {
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
                navigator.vibrate(ms);
        }
        catch { /* nada */ }
    }
    /* ───────── música ───────── */
    playTrack(t) {
        if (this.track === t)
            return;
        this.track = t;
        this.step = 0;
        if (t === 'none') {
            if (this.timer)
                clearInterval(this.timer);
            this.timer = null;
            return;
        }
        if (this.ctx)
            this.startScheduler();
    }
    startScheduler() {
        if (!this.ctx || this.timer)
            return;
        this.nextTime = this.ctx.currentTime + 0.1;
        this.timer = setInterval(() => this.schedule(), 90);
    }
    schedule() {
        const c = this.ctx;
        if (!c || this.track === 'none')
            return;
        const def = TRACKS[this.track] || (this.track.startsWith('arena-') ? arenaTrack(this.track.slice(6)) : TRACKS.menu);
        const stepDur = 60 / def.bpm / 2;
        const s = this.getSettings();
        if (c.currentTime - this.nextTime > 1)
            this.nextTime = c.currentTime + 0.05;
        while (this.nextTime < c.currentTime + 0.35) {
            const [lead, bass] = def.steps[this.step % def.steps.length];
            if (s.musicOn && c.state === 'running') {
                if (lead)
                    this.tone(NOTE(lead), stepDur * 0.9, def.lead, 0.22, this.nextTime, this.musicGain, 0);
                if (bass)
                    this.tone(NOTE(bass), stepDur * 1.8, def.bass, 0.3, this.nextTime, this.musicGain, 0);
                if (this.track === 'battle' && this.step % 2 === 0)
                    this.noise(0.04, 0.12, this.nextTime, this.musicGain, 6000);
                if (this.track === 'overtime' && this.step % 2 === 0)
                    this.noise(0.065, 0.2, this.nextTime, this.musicGain, 4200);
                this.stats.musicSteps++;
            }
            this.nextTime += stepDur;
            this.step++;
        }
    }
    /* ───────── efectos ───────── */
    sfx(name, type) {
        this.stats.requested++;
        const c = this.ctx;
        if (!c || !this.sfxGain || c.state !== 'running')
            return;
        const s = this.getSettings();
        if (!s.sfxOn || s.sfxVol <= 0)
            return;
        const now = c.currentTime;
        if (name === 'hit' || name === 'crit') {
            if (now - this.lastHit < 0.045)
                return;
            this.lastHit = now;
        }
        this.stats.played++;
        const g = this.sfxGain;
        switch (name) {
            case 'click':
                this.tone(660, 0.05, 'square', 0.18, now, g, 880);
                break;
            case 'select':
                this.tone(520, 0.06, 'triangle', 0.25, now, g, 780);
                break;
            case 'back':
                this.tone(440, 0.08, 'triangle', 0.22, now, g, 300);
                break;
            case 'error':
                this.tone(180, 0.16, 'sawtooth', 0.25, now, g, 120);
                break;
            case 'ready':
                this.tone(880, 0.07, 'sine', 0.2, now, g, 1320);
                break;
            case 'coin':
                this.tone(988, 0.07, 'square', 0.2, now, g, 0);
                this.tone(1319, 0.14, 'square', 0.2, now + 0.07, g, 0);
                break;
            case 'deploy':
                this.tone(220, 0.18, 'triangle', 0.35, now, g, 520);
                this.noise(0.12, 0.2, now, g, 1800);
                break;
            case 'hit':
                this.hitSound(type, 0.22, now, g);
                break;
            case 'crit':
                this.hitSound(type, 0.35, now, g);
                this.tone(140, 0.12, 'square', 0.25, now, g, 70);
                break;
            case 'special':
                this.specialSound(type, now, g);
                break;
            case 'towerHit':
                this.noise(0.14, 0.3, now, g, 700);
                this.tone(110, 0.12, 'square', 0.28, now, g, 80);
                break;
            case 'towerDown':
                this.noise(0.8, 0.5, now, g, 500);
                this.tone(160, 0.7, 'sawtooth', 0.4, now, g, 40);
                break;
            case 'death':
                this.tone(420, 0.25, 'triangle', 0.25, now, g, 120);
                break;
            case 'final':
                this.tone(660, 0.12, 'square', 0.25, now, g, 0);
                this.tone(660, 0.12, 'square', 0.25, now + 0.16, g, 0);
                this.tone(990, 0.25, 'square', 0.25, now + 0.32, g, 0);
                break;
            case 'win':
                [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'square', 0.28, now + i * 0.13, g, 0));
                break;
            case 'lose':
                [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.3, now + i * 0.18, g, 0));
                break;
            case 'draw':
                [440, 440, 392].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.28, now + i * 0.15, g, 0));
                break;
            case 'ballShake':
                this.tone(200, 0.06, 'square', 0.3, now, g, 150);
                this.noise(0.05, 0.18, now, g, 900);
                break;
            case 'ballOpen':
                this.noise(0.5, 0.35, now, g, 3000);
                this.tone(300, 0.5, 'sawtooth', 0.25, now, g, 1500);
                break;
            case 'rare':
                [659, 784, 988, 1319, 1568].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.3, now + i * 0.09, g, 0));
                break;
        }
    }
    hitSound(type, vol, t, g) {
        switch (type) {
            case 'fuego':
                this.noise(0.14, vol, t, g, 1400);
                break;
            case 'agua':
                this.tone(500, 0.12, 'sine', vol, t, g, 200);
                break;
            case 'electrico':
                this.tone(1200, 0.08, 'sawtooth', vol * 0.8, t, g, 300);
                break;
            case 'planta':
                this.tone(380, 0.09, 'triangle', vol, t, g, 560);
                break;
            case 'hielo':
                this.tone(1500, 0.1, 'triangle', vol * 0.7, t, g, 900);
                break;
            case 'psiquico':
                this.tone(700, 0.15, 'sine', vol, t, g, 350);
                break;
            case 'fantasma':
                this.tone(260, 0.2, 'sine', vol, t, g, 120);
                break;
            case 'veneno':
                this.tone(300, 0.14, 'sawtooth', vol * 0.7, t, g, 200);
                break;
            case 'tierra':
            case 'roca':
                this.noise(0.14, vol * 1.1, t, g, 500);
                break;
            case 'lucha':
                this.noise(0.08, vol * 1.2, t, g, 1100);
                this.tone(150, 0.1, 'square', vol, t, g, 90);
                break;
            default:
                this.noise(0.07, vol, t, g, 1600);
                this.tone(240, 0.06, 'square', vol * 0.6, t, g, 140);
        }
    }
    specialSound(type, t, g) {
        switch (type) {
            case 'fuego':
                this.noise(0.6, 0.4, t, g, 1200);
                this.tone(180, 0.5, 'sawtooth', 0.25, t, g, 420);
                break;
            case 'agua':
                this.noise(0.5, 0.3, t, g, 2200);
                this.tone(400, 0.45, 'sine', 0.3, t, g, 900);
                break;
            case 'electrico':
                for (let i = 0; i < 5; i++)
                    this.tone(900 + i * 150, 0.05, 'sawtooth', 0.3, t + i * 0.04, g, 200);
                break;
            case 'planta':
                this.tone(300, 0.4, 'triangle', 0.35, t, g, 700);
                this.noise(0.3, 0.2, t, g, 3000);
                break;
            case 'hielo':
                this.tone(1800, 0.4, 'triangle', 0.3, t, g, 600);
                break;
            case 'psiquico':
                this.tone(500, 0.5, 'sine', 0.35, t, g, 1400);
                this.tone(750, 0.5, 'sine', 0.25, t + 0.05, g, 1800);
                break;
            case 'fantasma':
                this.tone(200, 0.6, 'sine', 0.35, t, g, 70);
                break;
            case 'tierra':
            case 'roca':
                this.noise(0.7, 0.5, t, g, 400);
                this.tone(80, 0.6, 'square', 0.3, t, g, 40);
                break;
            default:
                this.tone(300, 0.4, 'sawtooth', 0.3, t, g, 800);
                this.noise(0.3, 0.25, t, g, 1800);
        }
    }
    /* ───────── primitivas ───────── */
    tone(freq, dur, type, vol, when, dest, slideTo) {
        const c = this.ctx;
        if (!c || !dest)
            return;
        try {
            const o = c.createOscillator();
            const g = c.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq, when);
            if (slideTo > 0)
                o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), when + dur);
            g.gain.setValueAtTime(0.0001, when);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), when + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
            o.connect(g);
            g.connect(dest);
            o.start(when);
            o.stop(when + dur + 0.02);
        }
        catch { /* nada */ }
    }
    noise(dur, vol, when, dest, cutoff) {
        const c = this.ctx;
        if (!c || !dest || !this.noiseBuf)
            return;
        try {
            const src = c.createBufferSource();
            src.buffer = this.noiseBuf;
            const f = c.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = cutoff;
            const g = c.createGain();
            g.gain.setValueAtTime(Math.max(0.0002, vol), when);
            g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
            src.connect(f);
            f.connect(g);
            g.connect(dest);
            src.start(when, Math.random() * 0.5);
            src.stop(when + dur + 0.02);
        }
        catch { /* nada */ }
    }
}
