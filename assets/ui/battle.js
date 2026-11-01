import { CONFIG, DIFFICULTY_LABEL } from "../config.js";
import { ARENAS, getArena } from "../data/arenas.js";
import { SPECIES, getSpecies } from "../data/species.js";
import { maxLevel } from "../data/levels.js";
import { levelInfo } from "../game/profile.js";
import { BattleView } from "../render/battleView.js";
import { AI_STYLES, AI_STYLE_INFO, AiPlayer, buildEnemyDeck, enemyLevelsFor } from "../sim/ai.js";
import { Battle } from "../sim/battle.js";
import { randomSeed } from "../sim/rng.js";
import { PeerRoom } from "../net/room.js";
import { Lockstep } from "../net/lockstep.js";
import { append, ballIcon, clear, coinIcon, confirmBox, h, icon, mmss, pokeCard, spriteImg, toast } from "./dom.js";
import { trainingPicker } from "./training.js";
const BC = CONFIG.battle;
const REASON = {
    rey: 'Torre del Rey destruida',
    torres: 'Más torres destruidas al terminar el tiempo',
    dano: 'Empate de torres: más daño causado a las torres',
    empate: 'Empate total',
    rendicion: 'Rendición',
    subita: 'Muerte súbita: la primera torre decide',
};
const EMOTES = ['😀', '😂', '😡', '😭', '👍', '🔥'];
/**
 * Controlador de una partida: crea la simulación, el dibujado, la IA y la interfaz táctil (mano, energía, especiales, pausa).
 * Bucle: acumulador de tiempo con paso FIJO de simulación (la lógica no depende de los FPS) y tope de pasos por fotograma
 * (al volver de una pestaña en segundo plano la partida NO se acelera).
 */
export class BattleController {
    onExit = () => { };
    battle;
    view;
    ai = null;
    finalized = false;
    paused = false;
    reward = null;
    app;
    root;
    cfg;
    /** Sincronización determinista de 2 jugadores (solo en partidas privadas). */
    ls = null;
    /** Ticks de simulación ya ejecutados (contador entero, igual en los dos móviles). */
    simTick = 0;
    lastPump = 0;
    /** Despliegues propios ya enviados pero aún no ejecutados: { tick, cost, slot }. */
    pendingDeploys = [];
    stalledMs = 0;
    netEl = null;
    waitEl = null;
    unhookNet = null;
    remoteLoaded = false;
    localHashes = new Map();
    remoteHashes = new Map();
    lastHashTick = 0;
    hashMismatchCount = 0;
    netReadyResolve = null;
    get localTeam() { return this.cfg.multiplayer?.localTeam ?? 0; }
    canvas;
    stage;
    panelEl;
    floatEl;
    hintEl;
    timerEl;
    timerLbl;
    crownMe;
    crownFoe;
    energyBox;
    energyNum;
    energyFill;
    handEl;
    nextEl;
    specialsEl;
    infoEl = null;
    logEl;
    raf = 0;
    running = false;
    last = 0;
    acc = 0;
    selected = -1;
    lastDeploy = 0;
    handKey = '';
    affKey = '';
    specKey = '';
    hintT = null;
    endT = null;
    timeouts = [];
    startedAt = 0;
    disposed = false;
    slowmo = false;
    dummyMode = false;
    dummyId = 95;
    hits = [];
    lastHit = '';
    levelBefore = 1;
    aiStyle = 'agresiva';
    emotePick;
    emoteAt = -1e9;
    pauseEl = null;
    resizeFn = () => this.layout();
    ro = null;
    visFn = () => { if (document.hidden && this.running && !this.battle.ended)
        this.pause(); };
    popFn = () => { if (this.running && !this.disposed) {
        this.pause();
        history.pushState({ battle: 1 }, '');
    } };
    keyFn = (e) => {
        if (e.key === 'Escape' && !document.querySelector('.overlay'))
            (this.paused ? this.resume() : this.pause());
        const n = Number(e.key);
        if (n >= 1 && n <= 4 && !this.paused)
            this.selectSlot(n - 1);
    };
    constructor(app, root, cfg) {
        this.app = app;
        this.root = root;
        // Historia (y otros modos) pueden enviar arena:'auto' o un valor no válido:
        // se resuelve siempre a una arena real para que el combate no falle al arrancar.
        const arenaId = ARENAS.some((a) => a.id === cfg.arena) ? cfg.arena : app.profile.currentArena.id;
        this.cfg = { ...cfg, arena: arenaId };
    }
    get training() {
        return this.cfg.mode === 'training';
    }
    /* ───────── arranque ───────── */
    async start() {
        const app = this.app;
        this.buildDom();
        const loading = h('div', { class: 'banner', style: 'animation:none;opacity:1;font-size:20px' }, 'Cargando Pokémon…');
        this.stage.appendChild(loading);
        this.view = new BattleView(this.canvas, app.sprites, app.audio);
        const qa = new URLSearchParams(location.search).get('arena');
        if (qa && ARENAS.some((a) => a.id === qa))
            this.cfg.arena = qa;
        this.view.setArena(this.cfg.arena ?? 'pewter');
        this.view.applySettings(app.profile.data.settings);
        this.view.onEvent = (e) => this.onViewEvent(e);
        this.newBattle();
        if (this.cfg.multiplayer) {
            this.view.cam.flip = this.localTeam === 1;
            this.unhookNet = this.cfg.multiplayer.room.onMessage((m) => this.onNetworkMessage(m));
            this.ls = new Lockstep(this.cfg.multiplayer.room, this.localTeam);
        }
        const ids = new Set([...this.battle.hands[0].deck, ...this.battle.hands[1].deck, ...(this.cfg.training?.hand ?? [])]);
        if (this.battle.mod.randomSpawn) {
            const costs = new Set([...ids].map((i) => getSpecies(i).cost));
            for (const q of SPECIES) if (costs.has(q.cost)) ids.add(q.id);
        }
        const shinyIds = this.battle.shinyIds.flatMap((set) => [...set]);
        while (!this.disposed) {
            try {
                await app.sprites.preload([...ids], ['b', 'f'], shinyIds, 20000);
                break;
            } catch (error) {
                loading.replaceChildren(
                    h('div', { style: 'display:grid;gap:12px;justify-items:center;text-align:center;padding:12px' },
                        h('b', null, 'No se pudieron cargar todas las animaciones'),
                        h('span', { class: 'sub' }, error?.message ?? 'Error al descargar los sprites animados.'),
                        h('button', { class: 'btn btn-gold', type: 'button', on: { click: () => { loading.dispatchEvent(new Event('sprite-retry')); } } }, 'Reintentar')
                    )
                );
                await new Promise((resolve) => loading.addEventListener('sprite-retry', resolve, { once: true }));
            }
        }
        if (this.disposed)
            return;
        loading.remove();
        if (this.cfg.multiplayer) {
            this.cfg.multiplayer.room.send({ type: 'battle-loaded' });
            if (!this.remoteLoaded)
                await new Promise((resolve) => { this.netReadyResolve = resolve; setTimeout(resolve, 15000); });
            if (this.disposed)
                return;
        }
        this.layout();
        window.addEventListener('resize', this.resizeFn);
        if (typeof ResizeObserver !== 'undefined') {
            this.ro = new ResizeObserver(() => this.layout());
            this.ro.observe(this.root);
            this.ro.observe(this.panelEl);
        }
        window.addEventListener('orientationchange', this.resizeFn);
        document.addEventListener('visibilitychange', this.visFn);
        window.addEventListener('popstate', this.popFn);
        document.addEventListener('keydown', this.keyFn);
        history.pushState({ battle: 1 }, '');
        app.audio.playTrack(`arena-${this.cfg.arena}`);
        this.levelBefore = levelInfo(app.profile.data.xp).level;
        this.banner(this.training ? 'Entrenamiento' : '¡A combatir!');
        this.startedAt = performance.now();
        this.resume();
    }
    /** Crea una simulación nueva (también para "reiniciar campo" en entrenamiento). */
    newBattle() {
        const seedOverride = Number(new URLSearchParams(location.search).get('seed'));
        const seed = this.cfg.seed ?? (Number.isFinite(seedOverride) && seedOverride > 0 ? seedOverride : randomSeed());
        const t = this.cfg.training;
        const prof = this.app.profile;
        const opponentDeck = this.cfg.enemyDeck?.slice() ?? buildEnemyDeck(SPECIES.map((s) => s.id), seed, this.cfg.difficulty, prof.deckAvgLevel(this.cfg.deck));
        this.aiStyle = AI_STYLES[seed % AI_STYLES.length];
        const playerIds = [...this.cfg.deck, ...(t?.hand ?? [])];
        const mp = this.cfg.multiplayer;
        const team0Deck = mp?.localTeam === 1 ? opponentDeck : this.cfg.deck;
        const team1Deck = mp?.localTeam === 1 ? this.cfg.deck : opponentDeck;
        const localLevels = prof.deckLevels(playerIds);
        const localShiny = prof.data.shinySelected.filter((id) => playerIds.includes(id));
        const activeDeck = prof.data.decks[prof.data.activeDeck] ?? prof.deck;
        const localItem = !this.cfg.noItems && activeDeck?.equippedItem && activeDeck?.equippedPokemon ? { itemId: activeDeck.equippedItem, pokemonId: activeDeck.equippedPokemon } : null;
        const itemLoadouts = mp ? (mp.localTeam === 1 ? [mp.opponentItem ?? null, localItem] : [localItem, mp.opponentItem ?? null]) : [localItem, null];
        const team0Levels = mp?.localTeam === 1 ? mp.opponentLevels : localLevels;
        const team1Levels = mp?.localTeam === 1 ? localLevels : (mp?.opponentLevels ?? enemyLevelsFor(opponentDeck, prof.deckAvgLevel(this.cfg.deck), this.cfg.difficulty, maxLevel, seed));
        const team0Shiny = mp?.localTeam === 1 ? mp.opponentShiny : localShiny;
        const team1Shiny = mp?.localTeam === 1 ? localShiny : (mp?.opponentShiny ?? []);
        this.battle = new Battle({
            seed, mode: this.cfg.mode, weather: this.cfg.weather, modifiers: this.cfg.modifiers, draftMode: this.cfg.draftMode ?? null, playerDeck: team0Deck, enemyDeck: team1Deck, difficulty: this.cfg.difficulty,
            arena: this.cfg.arena, aiStyle: this.aiStyle, towerLevel: mp?.localTeam === 1 ? mp.opponentTowerLevel : prof.towerLevel,
            playerLevels: team0Levels, enemyLevels: team1Levels, playerShiny: team0Shiny, enemyShiny: team1Shiny,
            playerTraining: mp?.localTeam === 1 ? (mp.opponentTraining ?? {}) : prof.data.training.stats,
            enemyTraining: mp?.localTeam === 1 ? prof.data.training.stats : (mp?.opponentTraining ?? {}), itemLoadouts,
            playerMoves: mp?.localTeam === 1 ? (mp.opponentMoves ?? {}) : prof.deckMoves(this.cfg.deck),
            enemyMoves: mp?.localTeam === 1 ? prof.deckMoves(this.cfg.deck) : (mp?.opponentMoves ?? {}),
            matchId: `m-${seed.toString(36)}-${mp ? 'private' : Date.now().toString(36)}`,
            training: t ? { infiniteEnergy: this.trainState.energy, enemyTowersAttack: this.trainState.towers, hand: t.hand } : undefined,
        });
        this.ai = mp ? null : new AiPlayer(this.battle, 1, this.cfg.difficulty, seed, this.aiStyle, prof.data.aiMemory);
        this.view.towerLevels = [this.battle.towerLevel, this.battle.towerLevel];
        this.view.attach(this.battle);
        this.acc = 0;
        this.finalized = false;
        this.hits = [];
        this.handKey = this.affKey = this.specKey = '';
        this.selected = -1;
        this.view.preview = null;
        this.view.deployHint = false;
    }
    onNetworkMessage(m) {
        if (m.type === 'battle-loaded') {
            this.remoteLoaded = true;
            this.netReadyResolve?.();
            this.netReadyResolve = null;
            return;
        }
        if ((m.type === 'net-peer-left' || m.type === 'net-closed') && this.cfg.multiplayer && !this.battle.ended) {
            // El rival salió o se cayó la conexión (también si estaba en pausa): tras 8 s de gracia gana el que sigue conectado.
            setTimeout(() => {
                const room = this.cfg.multiplayer?.room;
                if (this.disposed || this.battle.ended || room?.connected)
                    return;
                this.battle.surrender(1 - this.localTeam);
                if (this.battle.result)
                    this.finalize(this.battle.result);
            }, 8000);
            return;
        }
        if (m.type === 'battle-pause') {
            if (m.paused === true)
                this.pause(false, true);
            else
                this.resume(true);
            return;
        }
        if (m.type === 'battle-forfeit' && this.cfg.multiplayer && !this.battle.ended) {
            const team = Number(m.team) === 1 ? 1 : 0;
            this.battle.surrender(team);
            if (this.battle.result)
                this.finalize(this.battle.result);
            return;
        }
        if (m.type === 'state-hash' && this.cfg.multiplayer) {
            const tick = Number(m.tick);
            if (!Number.isInteger(tick))
                return;
            const hash = String(m.hash ?? '');
            this.remoteHashes.set(tick, hash);
            const local = this.localHashes.get(tick);
            if (local && local !== hash) {
                this.hashMismatchCount++;
                if (this.hashMismatchCount >= 3) this.hint('Las dos partidas se han desincronizado. Si sigue ocurriendo, sal y vuelve a crear la sala.', true);
            } else if (local && local === hash) this.hashMismatchCount = 0;
            while (this.remoteHashes.size > 8)
                this.remoteHashes.delete(this.remoteHashes.keys().next().value);
            return;
        }
        if (m.type === 'emote' && typeof m.value === 'string')
            this.hint(`Amigo: ${m.value}`, false);
    }
    /** Programa una orden propia: se ejecutará en el mismo tick en los dos móviles. */
    queueNetworkAction(action) {
        const mp = this.cfg.multiplayer;
        if (!mp || !this.ls)
            return;
        if (!mp.room.connected)
            this.hint('Conexión interrumpida: la acción podría no sincronizarse.', true);
        const tick = this.ls.schedule(this.simTick, action);
        if (action.action === 'deploy') {
            const sid = this.battle.hands[this.localTeam].hand[action.slot];
            this.pendingDeploys.push({ tick, slot: action.slot, cost: sid !== undefined ? this.battle.costOf(sid) : 0 });
        }
    }
    /** Ejecuta las órdenes (de los dos jugadores) que tocan en este tick, en el mismo orden en ambos móviles. */
    applyNetworkActions(nextTick) {
        const list = this.ls.take(nextTick);
        this.pendingDeploys = this.pendingDeploys.filter((d) => d.tick > nextTick);
        for (const m of list) {
            const team = (Number(m.team) === 1 ? 1 : 0);
            if (m.action === 'deploy') {
                const r = this.battle.deploy(team, Number(m.slot), Number(m.x), Number(m.y));
                if (!r.ok && team === this.localTeam)
                    this.hint(r.reason === 'energia' ? 'Energía insuficiente' : 'Despliegue no válido o fuera de zona', true);
            }
            else if (m.action === 'special')
                this.battle.castSpecial(team, Number(m.unitId));
        }
    }
    stateHash() {
        const b = this.battle;
        const raw = [
            b.time.toFixed(3), b.timeLeft.toFixed(3), b.energy.map((x) => x.toFixed(3)).join(','),
            b.towers.map((t) => `${t.id}:${Math.round(t.hp)}:${t.destroyed ? 1 : 0}:${t.active ? 1 : 0}`).join('|'),
            b.units.filter((u) => u.state !== 'dead').map((u) => `${u.id}:${u.team}:${u.sp.id}:${u.x.toFixed(2)}:${u.y.toFixed(2)}:${Math.round(u.hp)}:${u.state}:${u.towerLockId ?? 0}`).join('|'),
            b.hands.map((h) => h.hand.join(',') + '/' + h.queue.join(',')).join(';'),
        ].join('#');
        let h = 2166136261;
        for (let i = 0; i < raw.length; i++)
            h = Math.imul(h ^ raw.charCodeAt(i), 16777619);
        return (h >>> 0).toString(16);
    }
    trainState = { energy: true, towers: false, ai: false };
    /* ───────── interfaz ───────── */
    buildDom() {
        const r = this.root;
        clear(r);
        const prof = this.app.profile;
        this.canvas = h('canvas', { id: 'bcanvas', 'aria-label': 'Campo de batalla', role: 'img' });
        this.hintEl = h('div', { class: 'hint', hidden: true, role: 'status' });
        // capa de avisos (banners, ayudas, carga) por encima del campo y sin interceptar toques
        this.stage = h('div', { class: 'b-stage' }, this.hintEl);
        this.timerEl = h('div', { class: 'b-timer', id: 'b-timer' }, '3:00');
        this.timerLbl = h('small', null, 'Termina en');
        this.timerEl.prepend(this.timerLbl);
        if (this.cfg.multiplayer) {
            this.netEl = h('small', { class: 'net-ping', id: 'net-ping', 'aria-label': 'Latencia' }, '📶 …');
            this.timerEl.insertBefore(this.netEl, this.timerEl.lastChild);
        }
        this.crownMe = h('span', { class: 'me', id: 'crown-me' }, '0');
        this.crownFoe = h('span', { class: 'foe', id: 'crown-foe' }, '0');
        const pauseBtn = h('button', { class: 'iconbtn', type: 'button', id: 'pause-btn', aria: { label: 'Pausa' }, on: { click: () => this.pause() } }, icon('pausa'));
        const lvl = levelInfo(prof.data.xp).level;
        const name = h('div', { class: 'b-name', id: 'b-name' }, h('div', { class: 'avatar' }, h('b', null, String(lvl))), h('div', { class: 'who' }, h('span', { class: 'nm' }, this.cfg.multiplayer?.playerName || prof.data.settings.playerName || 'Entrenador'), h('span', { class: 'tr', id: 'b-trophies' }, this.training ? `Nivel ${lvl}` : `🏆 ${prof.trophies}`)));
        const rival = h('div', { class: 'b-rival', id: 'b-rival' }, this.rivalLabel());
        const hud = h('div', { class: 'b-hud' }, name, h('div', { class: 'b-right' }, this.timerEl, h('div', { class: 'b-score' }, pauseBtn, h('div', { class: 'crowns', 'aria-label': 'Torres destruidas por ti' }, icon('bandera'), this.crownMe), h('div', { class: 'crowns', 'aria-label': 'Torres destruidas por el rival' }, this.crownFoe, icon('bandera')))), rival);
        this.specialsEl = h('div', { class: 'b-specials', id: 'b-specials' });
        this.energyNum = h('div', { class: 'num', id: 'energy-num' }, '5');
        this.energyFill = h('i');
        this.energyBox = h('div', { class: 'energy', id: 'energy' }, this.energyNum, h('div', { class: 'meter' }, this.energyFill, h('u'), h('em', null, 'Máx.: 10')));
        this.handEl = h('div', { class: 'hand', id: 'hand' });
        this.nextEl = h('div', { class: 'nextc' });
        this.panelEl = h('div', { class: 'b-panel', id: 'b-panel' });
        if (this.training) {
            this.infoEl = h('div', { class: 'tinfo', id: 'tinfo' }, 'Toca el campo para desplegar y ver los datos de daño.');
            this.panelEl.append(this.trainBar(), this.infoEl);
        }
        this.panelEl.append(this.handEl, this.energyBox);
        this.floatEl = h('div', { class: 'b-float', id: 'b-float' }, this.specialsEl);
        this.logEl = h('div', { class: 'stack', id: 'b-log', style: 'font-size:12px' });
        const left = h('aside', { class: 'b-side b-left panel' }, h('h3', null, this.training ? 'Entrenamiento' : 'Partida'), h('div', { class: 'sub' }, this.training ? 'Sin recompensas ni estadísticas' : `Dificultad: ${DIFFICULTY_LABEL[this.cfg.difficulty]}`), h('h3', { style: 'margin-top:8px' }, 'Tu mano'), h('div', { class: 'sub' }, 'Teclas 1–4 para elegir carta · Esc para pausar'));
        const right = h('aside', { class: 'b-side b-rightside panel' }, h('h3', null, 'Registro'), this.logEl);
        append(r, [this.canvas, left, right, hud, this.stage, this.floatEl, this.emoteUi(), this.panelEl]);
        // interacción con el campo
        const field = (e) => this.view.toField(e.clientX, e.clientY);
        this.canvas.addEventListener('pointermove', (e) => this.updatePreview(field(e)));
        this.canvas.addEventListener('pointerdown', (e) => this.updatePreview(field(e)));
        this.canvas.addEventListener('pointerleave', () => { if (!this.dragging)
            this.view.preview = null; });
        this.canvas.addEventListener('click', (e) => this.onFieldTap(this.view.toField(e.clientX, e.clientY), e.clientX, e.clientY));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    /** Botón de emoticonos (como en Clash Royale) y su selector. */
    emoteUi() {
        this.emotePick = h('div', { class: 'emote-pick', id: 'emote-pick', hidden: true, role: 'menu' }, EMOTES.map((e, i) => h('button', { type: 'button', role: 'menuitem', data: { emote: String(i) }, aria: { label: `Emoticono ${e}` }, on: { click: () => this.sendEmote(e) } }, e)));
        const btn = h('button', { class: 'emote-btn', type: 'button', id: 'emote-btn', aria: { label: 'Emoticonos' }, on: { click: () => { this.emotePick.hidden = !this.emotePick.hidden; } } }, '😀');
        return h('div', { class: 'b-emote' }, this.emotePick, btn);
    }
    bubble(side, e) {
        this.root.querySelectorAll(`.emote-bubble.${side}`).forEach((n) => n.remove());
        const el = h('div', { class: `emote-bubble ${side}`, role: 'status' }, e);
        this.root.appendChild(el);
        const t = setTimeout(() => el.remove(), 2300);
        this.timeouts.push(t);
    }
    sendEmote(e) {
        this.emotePick.hidden = true;
        const now = performance.now();
        if (now - this.emoteAt < 1500)
            return;
        this.emoteAt = now;
        this.bubble('me', e);
        // el rival responde a veces, con calma (no afecta a la simulación)
        if (!this.training && Math.random() < 0.6) {
            const reply = e === '😡' ? '😡' : e === '😭' ? '😂' : e === '🔥' ? '👍' : '😀';
            const t = setTimeout(() => !this.disposed && this.bubble('foe', reply), 900);
            this.timeouts.push(t);
        }
    }
    /** Texto del rival (arena y dificultad). */
    rivalLabel() {
        return this.training ? 'Entrenamiento' : this.cfg.multiplayer ? `Rival: ${this.cfg.multiplayer.opponentName || 'Amigo'}` : this.cfg.label ?? `${getArena(this.cfg.arena ?? 'pewter').leader} · ${DIFFICULTY_LABEL[this.cfg.difficulty]} · ${AI_STYLE_INFO[this.aiStyle].name}`;
    }
    dragging = false;
    trainBar() {
        const mk = (label, key, on, fn) => {
            const b = h('button', { class: 'btn btn-blue', type: 'button', data: { t: key }, aria: { pressed: on } }, label);
            b.addEventListener('click', () => {
                const v = b.getAttribute('aria-pressed') !== 'true';
                b.setAttribute('aria-pressed', String(v));
                fn(v);
            });
            return b;
        };
        const sel = h('select', { 'aria-label': 'Maniquí', style: 'width:auto;min-height:34px;padding:2px 6px;font-size:12px', id: 'dummy-select',
            on: { change: (e) => { this.dummyId = Number(e.target.value); } } }, SPECIES.map((s) => h('option', { value: String(s.id), selected: s.id === this.dummyId }, `#${s.id} ${s.nameEs}`)));
        return h('div', { class: 'tbar', id: 'tbar' }, mk('Energía ∞', 'energy', true, (v) => { this.trainState.energy = v; if (this.battle.trainingCfg)
            this.battle.trainingCfg.infiniteEnergy = v; }), mk('Torres rivales atacan', 'towers', false, (v) => { this.trainState.towers = v; if (this.battle.trainingCfg)
            this.battle.trainingCfg.enemyTowersAttack = v; }), mk('IA enemiga', 'ai', false, (v) => { this.trainState.ai = v; }), mk('Cámara lenta', 'slow', false, (v) => { this.slowmo = v; }), mk('Colocar maniquí', 'dummy', false, (v) => { this.dummyMode = v; this.view.deployHint = v || this.selected >= 0; }), sel, h('button', { class: 'btn btn-blue', type: 'button', id: 'dummy-clear', on: { click: () => { this.battle.units = this.battle.units.filter((u) => !u.dummy); } } }, 'Quitar maniquíes'), h('button', { class: 'btn btn-blue', type: 'button', id: 'train-reset', on: { click: () => this.resetField() } }, 'Reiniciar campo'), h('button', { class: 'btn btn-blue', type: 'button', id: 'train-hand', on: { click: () => this.changeHand() } }, 'Cambiar mano'), h('button', { class: 'btn btn-red', type: 'button', id: 'train-exit', on: { click: () => this.exit('home') } }, 'Salir'));
    }
    resetField() {
        this.newBattle();
        this.trainState.ai = this.trainState.ai && true;
        toast('Campo reiniciado', 'info', 1200);
    }
    changeHand() {
        this.pause(true);
        trainingPicker(this.app, this.cfg.training?.hand ?? [], { change: (hand) => {
                this.cfg.training = { hand };
                this.cfg.deck = hand;
                this.resetField();
                this.resume();
            } });
    }
    /* ───────── entrada ───────── */
    updatePreview(p) {
        if (this.selected < 0 || this.paused) {
            this.view.preview = null;
            return;
        }
        const sid = this.battle.hands[this.localTeam].hand[this.selected];
        if (sid === undefined)
            return;
        this.view.preview = { speciesId: sid, x: p.x, y: p.y, valid: this.battle.validSpawnPoint(this.localTeam, p.x, p.y, getSpecies(sid).radius) };
    }
    selectSlot(i) {
        if (this.paused || this.battle.ended)
            return;
        this.selected = this.selected === i ? -1 : i;
        this.view.deployHint = this.selected >= 0 || this.dummyMode;
        if (this.selected < 0)
            this.view.preview = null;
        else
            this.app.audio.sfx('select');
        this.affKey = '';
    }
    onFieldTap(p, cx, cy) {
        if (this.paused || this.battle.ended)
            return;
        const b = this.battle;
        if (this.training && this.dummyMode) {
            if (p.y <= CONFIG.field.enemyDeployMaxY + 0.6 && b.validSpawnPoint(1, p.x, p.y, 0.5)) {
                b.spawnDummy(1, this.dummyId, p.x, p.y);
                this.app.audio.sfx('deploy');
            }
            else
                this.hint('Coloca el maniquí en la mitad rival', true);
            return;
        }
        if (this.selected >= 0) {
            this.tryDeploy(p.x, p.y);
            return;
        }
        const u = this.view.unitAt(cx, cy, this.localTeam);
        if (u)
            this.cast(u);
        else if (this.training)
            this.inspect(p.x, p.y);
    }
    tryDeploy(x, y) {
        const nowT = performance.now();
        if (nowT - this.lastDeploy < 160)
            return false; // evita doble despliegue por doble toque
        const slot = this.selected;
        if (slot < 0)
            return false;
        if (this.cfg.multiplayer) {
            const sid = this.battle.hands[this.localTeam].hand[slot];
            if (this.pendingDeploys.some((d) => d.slot === slot)) {
                this.hint('Esa carta ya está en camino', true);
                return false;
            }
            const reserved = this.pendingDeploys.reduce((a, d) => a + d.cost, 0);
            if (sid === undefined || this.battle.energy[this.localTeam] - reserved < this.battle.costOf(sid) - 1e-9 || !this.battle.validSpawnPoint(this.localTeam, x, y, getSpecies(sid).radius)) {
                this.hint('Energía insuficiente o zona de despliegue bloqueada', true);
                return false;
            }
            this.queueNetworkAction({ action: 'deploy', slot, x, y });
            this.lastDeploy = nowT;
            this.selected = -1;
            this.view.preview = null;
            this.view.deployHint = this.dummyMode;
            this.log(`Orden de despliegue enviada: ${getSpecies(sid).nameEs}`);
            return true;
        }
        const r = this.battle.deploy(this.localTeam, slot, x, y);
        if (r.ok) {
            this.lastDeploy = nowT;
            this.selected = -1;
            this.view.preview = null;
            this.view.deployHint = this.dummyMode;
            this.log(`Despliegas a ${getSpecies(this.battle.unitById(r.unitId)?.sp.id ?? 1).nameEs}`);
            return true;
        }
        switch (r.reason) {
            case 'energia':
                this.energyBox.classList.remove('nope');
                void this.energyBox.offsetWidth;
                this.energyBox.classList.add('nope');
                this.hint('Energía insuficiente', true);
                this.app.audio.sfx('error');
                break;
            case 'zona':
                this.hint('Despliega en tu mitad del campo, lejos de las torres', true);
                this.app.audio.sfx('error');
                break;
            case 'limite':
                this.hint('Demasiadas unidades en el campo', true);
                break;
            default:
                break;
        }
        return false;
    }
    cast(u) {
        if (this.cfg.multiplayer) {
            this.queueNetworkAction({ action: 'special', unitId: u.id });
            return;
        }
        const r = this.battle.castSpecial(this.localTeam, u.id);
        if (r.ok) {
            this.app.audio.vibrate(25);
            this.specKey = '';
        }
        else if (r.reason === 'sin_objetivo')
            this.hint('Sin objetivo a tiro para ese especial', true);
        else if (r.reason === 'recarga')
            this.hint('Especial en recarga', true);
    }
    inspect(x, y) {
        let best = null;
        let bd = 1.6;
        for (const u of this.battle.units) {
            if (u.state === 'dead')
                continue;
            const d = Math.hypot(u.x - x, u.y - y);
            if (d < bd) {
                bd = d;
                best = u;
            }
        }
        if (best && this.infoEl) {
            const s = best.sp;
            this.infoEl.textContent = `${s.nameEs} (${best.team === this.localTeam ? 'tuyo' : 'rival'}) · PS ${Math.ceil(best.hp)}/${best.maxHp} · daño ${s.dmg} / ${s.interval}s (${s.dps}/s) · alcance ${s.range} · vel ${s.speed} · estado ${best.state} · especial ${best.spCd > 0 ? `en ${best.spCd.toFixed(1)}s` : 'listo'}`;
        }
    }
    /* ───────── mano y HUD ───────── */
    renderHand() {
        const b = this.battle;
        const hand = b.hands[this.localTeam].hand;
        clear(this.handEl);
        const nx = b.nextCardOf(this.localTeam);
        this.nextEl = h('div', { class: 'nextc' }, nx !== null ? [h('span', null, 'SIGUIENTE'), pokeCard(getSpecies(nx), { small: true, showTypes: false, disabled: true })] : h('span', null, this.training ? 'MANO FIJA' : ''));
        this.handEl.appendChild(this.nextEl);
        hand.forEach((id, i) => {
            const sp = getSpecies(id);
            const c = pokeCard(sp, { small: true, showTypes: false, level: b.levels[this.localTeam][id] ?? 1, cost: b.costOf(id) });
            c.classList.add('hcard');
            c.dataset.slot = String(i);
            c.addEventListener('pointerdown', (e) => this.cardDown(e, i, c));
            c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.selectSlot(i);
            } });
            this.handEl.appendChild(c);
        });
        this.affKey = '';
    }
    cardDown(e, i, el) {
        if (this.paused || this.battle.ended)
            return;
        e.preventDefault();
        const sx = e.clientX, sy = e.clientY;
        let moved = false;
        const wasSel = this.selected === i;
        this.selected = i;
        this.view.deployHint = true;
        el.setPointerCapture?.(e.pointerId);
        const touchOff = e.pointerType === 'touch' ? 34 : 0;
        const move = (m) => {
            if (!moved && Math.hypot(m.clientX - sx, m.clientY - sy) > 12) {
                moved = true;
                this.dragging = true;
            }
            if (moved)
                this.updatePreview(this.view.toField(m.clientX, m.clientY - touchOff));
        };
        const up = (u) => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', cancel);
            this.dragging = false;
            if (moved) {
                const pr = this.panelEl.getBoundingClientRect();
                const p = this.view.toField(u.clientX, u.clientY - touchOff);
                const inside = u.clientY - touchOff < pr.top && this.view.inField(p);
                if (inside)
                    this.tryDeploy(p.x, p.y);
                if (this.selected >= 0 && !inside) {
                    this.selected = -1;
                    this.view.deployHint = this.dummyMode;
                }
                this.view.preview = null;
            }
            else if (wasSel) {
                this.selected = -1;
                this.view.preview = null;
                this.view.deployHint = this.dummyMode;
            }
            else
                this.app.audio.sfx('select');
            this.affKey = '';
        };
        const cancel = () => { this.dragging = false; this.view.preview = null; };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', cancel);
        this.affKey = '';
    }
    hud() {
        const b = this.battle;
        // temporizador
        if (this.training) {
            this.timerEl.lastChild.textContent = mmss(b.time);
            this.timerLbl.textContent = 'Entrenamiento';
        }
        else {
            this.timerEl.lastChild.textContent = mmss(b.clock);
            this.timerLbl.textContent = b.overtime ? '¡Muerte súbita!' : b.finalPhase ? '¡Energía ×2!' : 'Termina en';
            this.timerEl.classList.toggle('final', b.finalPhase);
            this.timerEl.classList.toggle('sudden', b.overtime);
        }
        this.crownMe.textContent = String(b.crowns[this.localTeam]);
        this.crownFoe.textContent = String(b.crowns[1 - this.localTeam]);
        // energía
        const e = b.energy[this.localTeam];
        const inf = !!b.trainingCfg?.infiniteEnergy;
        this.energyFill.style.width = `${Math.min(100, (e / BC.energyMax) * 100)}%`;
        this.energyNum.textContent = inf ? '∞' : String(Math.floor(e + 1e-9));
        this.energyBox.classList.toggle('x2', b.finalPhase);
        this.energyBox.classList.toggle('x3', b.overtime);
        // mano
        const key = b.hands[this.localTeam].hand.join(',') + '|' + (b.nextCardOf(this.localTeam) ?? '');
        if (key !== this.handKey) {
            this.handKey = key;
            this.renderHand();
        }
        const aff = b.hands[this.localTeam].hand.map((id, i) => `${b.canAfford(this.localTeam, id) ? 1 : 0}${this.selected === i ? 's' : ''}`).join('');
        if (aff !== this.affKey) {
            this.affKey = aff;
            b.hands[this.localTeam].hand.forEach((id, i) => {
                const c = this.handEl.querySelector(`[data-slot="${i}"]`);
                if (!c)
                    return;
                c.classList.toggle('cant', !b.canAfford(this.localTeam, id));
                c.classList.toggle('sel', this.selected === i);
                c.setAttribute('aria-pressed', String(this.selected === i));
            });
        }
        this.hudSpecials();
        if (this.training)
            this.hudTraining();
    }
    hudSpecials() {
        const b = this.battle;
        const ready = b.units.filter((u) => u.team === this.localTeam && !u.dummy && u.state !== 'dead' && u.state !== 'spawning' && u.stunT <= 0 && u.spCd <= 0).slice(0, 6);
        const key = ready.map((u) => u.id).join(',');
        if (key === this.specKey)
            return;
        this.specKey = key;
        clear(this.specialsEl);
        if (!ready.length) {
            this.specialsEl.appendChild(h('span', { class: 'none' }, 'Especiales: aparecerán aquí cuando estén listos (⚡)'));
            return;
        }
        for (const u of ready) {
            const s = u.sp.special;
            this.specialsEl.appendChild(h('button', { class: 'spbtn', type: 'button', title: s.desc, data: { unit: u.id }, aria: { label: `Especial de ${u.sp.nameEs}: ${s.pool ? 'Metrónomo' : s.name}` },
                on: { click: () => this.cast(u) } }, spriteImg(u.sp.id, 'f'), h('span', null, s.pool ? 'Metrónomo' : s.name)));
        }
    }
    hudTraining() {
        if (!this.infoEl)
            return;
        const now = this.battle.time;
        this.hits = this.hits.filter((x) => now - x.t < 5);
        const dps = this.hits.reduce((a, x) => a + x.amount, 0) / 5;
        const el = this.infoEl;
        if (this.lastHit || dps > 0)
            el.textContent = `${this.lastHit}${this.lastHit ? ' · ' : ''}DPS contra el rival (5 s): ${dps.toFixed(1)}`;
        if (this.trainState.ai && this.ai) { /* la IA se actualiza en el bucle */ }
    }
    hint(text, err = false) {
        this.hintEl.textContent = text;
        this.hintEl.hidden = false;
        this.hintEl.classList.toggle('err', err);
        if (this.hintT)
            clearTimeout(this.hintT);
        this.hintT = setTimeout(() => { this.hintEl.hidden = true; }, 1700);
    }
    banner(text) {
        const b = h('div', { class: 'banner' }, text);
        this.stage.appendChild(b);
        this.timeouts.push(setTimeout(() => b.remove(), 2300));
    }
    log(line) {
        this.logEl.prepend(h('div', null, `${mmss(this.training ? this.battle.time : this.battle.duration - this.battle.time)} ${line}`));
        while (this.logEl.children.length > 14)
            this.logEl.lastChild?.remove();
    }
    onViewEvent(e) {
        switch (e.type) {
            case 'phase':
                if (e.name === 'overtime') {
                    this.app.audio.playTrack('overtime');
                    this.banner('¡Tiempo extra! Muerte súbita');
                    this.log('Muerte súbita: gana quien derribe la primera torre');
                }
                else {
                    this.banner('¡Último minuto! Energía ×2');
                    this.log('Último minuto');
                }
                break;
            case 'towerDown':
                this.banner(e.team !== this.localTeam ? '¡Torre enemiga destruida!' : '¡Pierdes una torre!');
                this.log(e.team !== this.localTeam ? 'Destruyes una torre' : 'Pierdes una torre');
                break;
            case 'kingActive':
                this.log(e.team !== this.localTeam ? 'La Torre del Rey rival despierta' : 'Tu Torre del Rey despierta');
                break;
            case 'hit':
                if (this.training) {
                    const tgt = e.targetIsTower ? 'Torre' : this.battle.unitById(e.targetId)?.sp.nameEs ?? '?';
                    this.lastHit = `Golpe ${e.amount} (×${e.mult.toFixed(2)}, ${e.vType}) → ${tgt}`;
                    if (e.team !== this.localTeam)
                        this.hits.push({ t: this.battle.time, amount: e.amount });
                }
                break;
            default: break;
        }
    }
    /* ───────── bucle ───────── */
    layout() {
        if (this.disposed)
            return;
        const rect = this.root.getBoundingClientRect();
        const W = Math.round(rect.width), H = Math.round(rect.height);
        if (W < 50 || H < 50)
            return;
        const panelTop = this.panelEl.getBoundingClientRect().top - rect.top;
        const panelH = Math.max(0, H - panelTop);
        this.root.style.setProperty('--panel-h', `${Math.round(panelH)}px`);
        const wide = W >= 900;
        this.view.resize(W, H, 0, Math.min(H, panelTop), wide ? 250 : 0);
        this.view.cam.flip = this.localTeam === 1;
        if (this.paused || !this.running)
            this.view.frame(0, 0);
    }
    loop = (ts) => {
        if (!this.running)
            return;
        this.raf = requestAnimationFrame(this.loop);
        const real = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
        this.last = ts;
        const b = this.battle;
        const step = BC.stepSec;
        this.acc += real * (this.slowmo ? 0.3 : 1);
        let n = 0;
        const mp = !!this.cfg.multiplayer;
        let stalled = false;
        while (this.acc >= step && n < BC.maxStepsPerFrame && !b.ended) {
            const nextTick = this.simTick + 1;
            if (mp) {
                // Lockstep: no se avanza hasta saber que el rival no tiene más órdenes para este tick (los dos relojes se paran a la vez).
                if (!this.ls.ready(nextTick)) {
                    stalled = true;
                    break;
                }
                this.applyNetworkActions(nextTick);
            }
            if (!mp && (this.training ? this.trainState.ai : true))
                this.ai?.update(step);
            b.step(step);
            this.simTick = nextTick;
            if (mp) {
                this.ls.afterTick(this.simTick);
                if (this.simTick % 60 === 0 && this.simTick !== this.lastHashTick) {
                    this.lastHashTick = this.simTick;
                    const hash = this.stateHash();
                    this.localHashes.set(this.simTick, hash);
                    this.cfg.multiplayer.room.send({ type: 'state-hash', tick: this.simTick, hash });
                    const remote = this.remoteHashes.get(this.simTick);
                    if (remote && remote !== hash) {
                        this.hashMismatchCount++;
                        if (this.hashMismatchCount >= 3)
                            this.hint('Las dos partidas se han desincronizado. Si sigue ocurriendo, sal y vuelve a crear la sala.', true);
                    }
                    else if (remote && remote === hash)
                        this.hashMismatchCount = 0;
                    while (this.localHashes.size > 40)
                        this.localHashes.delete(this.localHashes.keys().next().value);
                }
            }
            this.acc -= step;
            n++;
        }
        if (n >= BC.maxStepsPerFrame)
            this.acc = Math.min(this.acc, step * 2); // tras un tirón se recupera de forma gradual, sin acelerar de golpe
        if (mp)
            this.netTick(stalled, real);
        if (b.ended && b.result && !this.finalized)
            this.finalize(b.result);
        this.view.frame(real, b.ended ? 0 : Math.min(1, this.acc / step));
        this.hud();
    };
    /** Espera de red (reloj parado), pérdida de conexión e indicador de ping. */
    netTick(stalled, real) {
        const mp = this.cfg.multiplayer;
        if (stalled) {
            this.stalledMs += real * 1000;
            if (this.stalledMs - this.lastPump > 250) {
                this.lastPump = this.stalledMs;
                this.ls.pump(this.simTick);
            }
            this.acc = Math.min(this.acc, 0.25); // el tiempo perdido se recupera después, pero con un tope
            // No se muestra una capa de espera: el estado de conexión permanece en el indicador de ping.
            // La simulación sigue bloqueando ticks no confirmados para evitar divergencias entre clientes.
            const gone = !mp.room.connected || this.ls.silentMs > 15000;
            if (gone && this.stalledMs > 6000 && !this.battle.ended) {
                this.battle.surrender(1 - this.localTeam);
                if (this.battle.result)
                    this.finalize(this.battle.result);
            }
        }
        else {
            this.stalledMs = 0;
            this.lastPump = 0;
            if (this.waitEl) {
                this.waitEl.remove();
                this.waitEl = null;
            }
        }
        if (this.netEl) {
            const q = this.ls.quality;
            const txt = q.level === 'unknown' ? '📶 …' : `📶 ${q.ms} ms`;
            if (this.netEl.textContent !== txt) {
                this.netEl.textContent = txt;
                this.netEl.dataset.q = q.level;
            }
        }
    }
    pause(silent = false, fromRemote = false) {
        if (this.paused || this.disposed)
            return;
        if (this.cfg.multiplayer && !fromRemote)
            this.cfg.multiplayer.room.send({ type: 'battle-pause', paused: true });
        this.paused = true;
        this.running = false;
        cancelAnimationFrame(this.raf);
        this.app.audio.setSuspended(true);
        this.view.preview = null;
        this.view.frame(0, 0);
        if (!silent && !this.battle.ended)
            this.showPause();
    }
    resume(fromRemote = false) {
        if (this.cfg.multiplayer && !fromRemote)
            this.cfg.multiplayer.room.send({ type: 'battle-pause', paused: false });
        if (this.disposed || (this.battle.ended && this.finalized && this.paused === false && this.running))
            return;
        this.pauseEl?.remove();
        this.pauseEl = null;
        this.paused = false;
        this.app.audio.setSuspended(false);
        this.running = true;
        this.last = performance.now();
        cancelAnimationFrame(this.raf);
        this.raf = requestAnimationFrame(this.loop);
    }
    showPause() {
        this.pauseEl?.remove();
        const btn = (label, cls, fn, id) => h('button', { class: `btn ${cls}`, type: 'button', id, on: { click: fn } }, label);
        const body = h('div', { class: 'stack' }, btn('Continuar', 'btn-gold', () => this.resume(), 'resume'), this.training
            ? [btn('Reiniciar campo', 'btn-blue', () => { this.resetField(); this.resume(); }, 'p-restart'), btn('Salir al menú', 'btn-red', () => this.exit('home'), 'p-exit')]
            : [
                btn('Reiniciar partida', 'btn-blue', async () => {
                    if (await confirmBox('Reiniciar partida', 'Se abandona esta partida (sin recompensa) y empieza una nueva.', 'Reiniciar', true))
                        this.exit('again');
                }, 'p-restart'),
                btn('Rendirse', 'btn-red', async () => {
                    if (await confirmBox('Rendirse', 'Perderás la partida y recibirás la recompensa de derrota.', 'Rendirme', true))
                        this.surrender();
                }, 'p-surrender'),
                btn('Volver al menú', 'btn-blue', async () => {
                    if (await confirmBox('Volver al menú', 'Si sales ahora se pierde esta partida: no hay resultado ni recompensa.', 'Salir', true))
                        this.exit('home');
                }, 'p-exit'),
            ]);
        this.pauseEl = h('div', { class: 'overlay center', id: 'pause-overlay', role: 'dialog', aria: { modal: 'true', label: 'Pausa' } }, h('div', { class: 'sheet' }, h('div', { class: 'sheet-head' }, h('h2', null, 'Pausa')), h('div', { class: 'sheet-body' }, body)));
        this.root.appendChild(this.pauseEl);
    }
    surrender() {
        this.pauseEl?.remove();
        this.pauseEl = null;
        if (this.cfg.multiplayer)
            this.cfg.multiplayer.room.send({ type: 'battle-forfeit', team: this.localTeam });
        this.battle.surrender(this.localTeam);
        if (this.battle.result)
            this.finalize(this.battle.result);
        this.view.frame(0, 0);
    }
    /* ───────── final de partida ───────── */
    /** Se ejecuta UNA sola vez por partida (indicador `finalized` + `matchId` en el perfil): la recompensa no se duplica. */
    finalize(result) {
        if (this.finalized)
            return;
        this.finalized = true;
        this.app.audio.playTrack('none');
        this.selected = -1;
        this.view.preview = null;
        this.view.deployHint = false;
        const localResult = this.localResult(result);
        if (this.cfg.mode === 'normal' || this.cfg.mode === 'draft') {
            this.reward = this.app.profile.applyMatch(localResult).reward;
            const itemDrops = this.reward.itemDrops?.length ? this.reward.itemDrops : (this.reward.itemDrop ? [this.reward.itemDrop] : []);
            for (const item of itemDrops) toast(`¡Objeto obtenido: ${item.name}!`, 'ok', 6500);
        }
        // Historia y torneo guardaban el resultado al salir de la pantalla, pero nunca
        // mostraban una pantalla final. Eso dejaba la partida congelada en el campo.
        if (typeof this.cfg.onComplete === 'function' && !this.cfg.__completionCalled) {
            this.cfg.__completionCalled = true;
            try { this.cfg.onComplete(localResult); }
            catch (e) { console.error('No se pudo guardar el resultado del modo especial', e); }
        }
        this.app.audio.sfx(localResult.winner === 0 ? 'win' : localResult.winner === 1 ? 'lose' : 'draw');
        this.endT = setTimeout(() => this.showEnd(localResult), this.battle.ended && result.reason !== 'rendicion' ? 1600 : 300);
    }
    localResult(result) {
        if (this.localTeam === 0)
            return result;
        return { ...result, winner: result.winner === null ? null : result.winner === 0 ? 1 : 0,
            crowns: [result.crowns[1], result.crowns[0]], towerDamage: [result.towerDamage[1], result.towerDamage[0]], deckPlayer: this.cfg.deck.slice() };
    }
    showEnd(result) {
        if (this.disposed)
            return;
        this.running = false;
        cancelAnimationFrame(this.raf);
        this.paused = true;
        const outcome = result.winner === 0 ? 'win' : result.winner === 1 ? 'loss' : 'draw';
        const rw = this.reward ?? { coins: 0, balls: 0, xp: 0, trophies: 0 };
        const specialMode = this.cfg.mode === 'story' || this.cfg.mode === 'tournament';
        const returnLabel = this.cfg.mode === 'story' ? 'Volver a historia' : this.cfg.mode === 'tournament' ? 'Volver al torneo' : 'Volver al inicio';
        const returnTarget = this.cfg.mode === 'story' ? 'historia' : this.cfg.mode === 'tournament' ? 'torneos' : 'home';
        const totalKos = Object.values(result.kills).reduce((a, n) => a + n, 0);
        const used = Object.entries(result.usage).sort((a, b) => b[1] - a[1]);
        const mvp = Object.entries(result.kills).sort((a, b) => b[1] - a[1])[0];
        const deployed = used.reduce((a, [, n]) => a + n, 0);
        const levelNow = levelInfo(this.app.profile.data.xp).level;
        const el = h('div', { class: 'overlay center', id: 'end-overlay', role: 'dialog', aria: { modal: 'true', label: 'Resultado' } }, h('div', { class: 'sheet' }, h('div', { class: 'sheet-body' }, h('div', { class: `endcard ${outcome}` }, h('h2', { id: 'end-title' }, outcome === 'win' ? '¡VICTORIA!' : outcome === 'loss' ? 'DERROTA' : 'EMPATE'), h('div', { class: 'sub' }, REASON[result.reason] ?? ''), h('div', { style: 'font-size:22px;font-weight:900' }, `Torres  ${result.crowns[0]} – ${result.crowns[1]}`), h('div', { class: 'sub' }, `Daño a torres: ${result.towerDamage[0]} (tú) · ${result.towerDamage[1]} (rival) · ${Math.round(result.durationSec)} s`), !specialMode && h('div', { class: 'rewards', id: 'end-rewards' }, h('span', { class: 'chip' }, coinIcon(), `+${rw.coins}`), rw.balls > 0 && h('span', { class: 'chip' }, ballIcon('poke'), `+${rw.balls}`), h('span', { class: 'chip' }, `+${rw.xp} XP`)), (specialMode ? h('div', { class: 'trophy' }, this.cfg.mode === 'story' ? (result.winner === 0 ? '¡Has superado este combate de la historia!' : 'Puedes volver a intentarlo') : (result.winner === 0 ? '¡Has ganado la eliminatoria!' : 'Has quedado eliminado del torneo')) : this.cfg.mode === 'draft' ? h('div', { class: 'trophy', id: 'end-trophies' }, 'Modo Draft: no afecta a los trofeos') : h('div', { class: `trophy ${rw.trophies >= 0 ? 'up' : 'down'}`, id: 'end-trophies' }, `🏆 ${rw.trophies >= 0 ? '+' : ''}${rw.trophies}  (${this.app.profile.trophies})`)), h('div', { class: 'summary', id: 'end-summary' }, h('div', null, h('b', null, String(deployed)), 'Pokémon desplegados'), h('div', null, h('b', null, String(totalKos)), 'KO conseguidos'), h('div', null, h('b', null, mvp ? getSpecies(Number(mvp[0])).nameEs : '—'), mvp ? `MVP · ${mvp[1]} KO` : 'MVP'), used[0] && h('div', null, h('b', null, getSpecies(Number(used[0][0])).nameEs), `Más usado · ${used[0][1]}×`), h('div', null, h('b', null, result.overtime ? 'Sí' : 'No'), 'Tiempo extra'), h('div', null, h('b', null, getArena(result.arena ?? 'pewter').leader), 'Arena')), levelNow > this.levelBefore && h('div', { class: 'newtag' }, `¡Subes al nivel ${levelNow}!`), h('div', { class: 'stack', style: 'width:100%' }, !specialMode && h('button', { class: 'btn btn-gold', type: 'button', id: 'again', on: { click: () => this.exit('again') } }, 'Jugar otra vez'), h('button', { class: 'btn btn-blue', type: 'button', id: 'home', on: { click: () => this.exit(returnTarget) } }, returnLabel), h('button', { class: 'btn btn-blue', type: 'button', on: { click: () => this.exit('decks') } }, 'Editar mazos'))))));
        this.root.appendChild(el);
    }
    /** Sale de la partida liberando todos los temporizadores y escuchas. */
    exit(next) {
        if (this.disposed)
            return;
        if (this.cfg.multiplayer && !this.battle.ended)
            this.cfg.multiplayer.room.send({ type: 'battle-forfeit', team: this.localTeam });
        if (this.training)
            this.app.profile.recordTraining((performance.now() - this.startedAt) / 1000);
        this.dispose();
        this.onExit(next);
    }
    dispose() {
        this.disposed = true;
        this.unhookNet?.();
        this.unhookNet = null;
        this.ls?.dispose();
        this.ls = null;
        this.running = false;
        cancelAnimationFrame(this.raf);
        window.removeEventListener('resize', this.resizeFn);
        this.ro?.disconnect();
        window.removeEventListener('orientationchange', this.resizeFn);
        document.removeEventListener('visibilitychange', this.visFn);
        window.removeEventListener('popstate', this.popFn);
        document.removeEventListener('keydown', this.keyFn);
        if (this.hintT)
            clearTimeout(this.hintT);
        if (this.endT)
            clearTimeout(this.endT);
        for (const t of this.timeouts)
            clearTimeout(t);
        this.app.audio.setSuspended(false);
        this.app.audio.playTrack('menu');
        this.view?.fx?.clear?.();
        this.pauseEl?.remove();
        document.querySelectorAll('#modal-root .overlay').forEach((o) => o.remove());
    }
    /** Estado resumido para las pruebas de navegador. */
    snapshot() {
        const b = this.battle;
        return {
            time: b.time, ended: b.ended, paused: this.paused, energy: b.energy[this.localTeam], units: b.units.length, projectiles: b.projectiles.length,
            crowns: b.crowns, finalized: this.finalized, finalPhase: b.finalPhase, result: b.result, fx: this.view.describeFx(), dbg: this.view.dbg,
            selected: this.selected, towers: b.towers.map((t) => ({ hp: t.hp, d: t.destroyed, a: t.active })),
        };
    }
}
