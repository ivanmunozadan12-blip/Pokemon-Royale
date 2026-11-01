import { pendingDots } from "./dots.js";
import { startNotifier } from "./notify.js";
import { levelInfo } from "../game/profile.js";
import { BattleController } from "./battle.js";
import { append, ballIcon, clear, coinIcon, fmt, h, icon, toast } from "./dom.js";
import { ajustesScreen } from "./screens/ajustes.js";
import { batallaScreen } from "./screens/batalla.js";
import { bolasScreen } from "./screens/bolas.js";
import { coleccionScreen } from "./screens/coleccion.js";
import { estadisticasScreen } from "./screens/estadisticas.js";
import { inicioScreen } from "./screens/inicio.js";
import { mazosScreen } from "./screens/mazos.js";
import { tiendaScreen } from "./screens/tienda.js";
import { progresoScreen } from "./screens/progreso.js";
import { draftScreen } from "./screens/draft.js";
import { equipoScreen } from "./screens/equipo.js";
import { entrenamientoScreen } from "./screens/entrenamiento.js";
import { objetosScreen } from "./screens/objetos.js";
import { historiaScreen } from "./screens/historia.js";
import { torneosScreen } from "./screens/torneos.js";
import { expedicionesScreen, safariScreen } from "./screens/expediciones.js";
import { casinoScreen } from "./screens/casino.js";
export const SCREENS = [
    { id: 'inicio', label: 'Inicio', build: inicioScreen },
    { id: 'casino', label: 'Casino', build: casinoScreen },
    { id: 'batalla', label: 'Batalla', build: batallaScreen },
    { id: 'historia', label: 'Historia', build: historiaScreen },
    { id: 'torneos', label: 'Torneos', build: torneosScreen },
    { id: 'draft', label: 'Draft', build: draftScreen },
    { id: 'expediciones', label: 'Expediciones', build: expedicionesScreen },
    { id: 'safari', label: 'Safari', build: safariScreen },
    { id: 'equipo', label: 'Equipo', short: 'Equipo', build: equipoScreen },
    { id: 'entrenamiento', label: 'Entrenamiento', short: 'Entrena', build: entrenamientoScreen },
    { id: 'objetos', label: 'Objetos', short: 'Objetos', build: objetosScreen },
    { id: 'progreso', label: 'Progreso', short: 'Progreso', build: progresoScreen },
    { id: 'mazos', label: 'Mazos', build: mazosScreen },
    { id: 'coleccion', label: 'Colección', build: coleccionScreen },
    { id: 'tienda', label: 'Tienda', build: tiendaScreen },
    { id: 'bolas', label: 'Poké Balls', short: 'Bolas', build: bolasScreen },
    { id: 'estadisticas', label: 'Estadísticas', short: 'Datos', build: estadisticasScreen },
    { id: 'ajustes', label: 'Ajustes', build: ajustesScreen },
];
/** Aplicación: carcasa (barra superior, navegación), enrutado de pantallas y arranque de partidas. */
export class App {
    profile;
    audio;
    sprites;
    screen = 'inicio';
    battle = null;
    root;
    screenEl;
    topEl;
    navEl;
    battleRoot;
    cleanups = [];
    unsub = null;
    constructor(profile, audio, sprites) {
        this.profile = profile;
        this.audio = audio;
        this.sprites = sprites;
    }
    mount(root) {
        this.root = root;
        clear(root);
        this.topEl = h('header', { id: 'topbar' });
        this.screenEl = h('main', { id: 'screen', tabindex: -1 });
        this.navEl = h('nav', { id: 'nav', aria: { label: 'Navegación principal' } });
        this.battleRoot = h('div', { id: 'battle', hidden: true });
        append(root, [this.topEl, this.screenEl, this.navEl, this.battleRoot]);
        // desbloqueo del audio en el primer gesto (restricción de Chrome móvil)
        const unlock = () => this.audio.unlock();
        for (const ev of ['pointerdown', 'touchend', 'keydown'])
            window.addEventListener(ev, unlock, { once: false, passive: true });
        document.addEventListener('click', (e) => {
            const t = e.target;
            if (t.closest?.('button') && !t.closest('#battle'))
                this.audio.sfx('click');
        });
        this.unsub = this.profile.onChange(() => this.refreshChrome());
        this.profile.ensureShop();
        this.notifyTimer = startNotifier(this);
        this.go('inicio');
        for (const n of this.profile.notices)
            toast(n, 'info', 6000);
        if (!this.profile.persistOk)
            toast('No se puede guardar el progreso en este navegador.', 'err', 6000);
    }
    watch(fn) {
        this.cleanups.push(this.profile.onChange(fn));
    }
    onLeave(fn) {
        this.cleanups.push(fn);
    }
    go(id) {
        for (const c of this.cleanups.splice(0))
            c();
        this.screen = id;
        const def = SCREENS.find((s) => s.id === id);
        clear(this.screenEl);
        this.screenEl.appendChild(def.build(this));
        this.screenEl.scrollTop = 0;
        this.audio.playTrack('menu');
        this.refreshChrome();
        document.title = `${def.label} · Pokémon Royale`;
    }
    /** Barra superior y navegación (se refrescan con cada cambio del perfil). */
    refreshChrome() {
        const p = this.profile;
        const li = levelInfo(p.data.xp);
        clear(this.topEl);
        append(this.topEl, [
            h('div', { class: 'logo', 'aria-label': 'Pokémon Royale' }, 'POKÉMON', h('small', null, 'ROYALE')),
            h('div', { class: 'spacer' }),
            h('div', { class: 'lvl', title: `Nivel ${li.level}: ${li.into}/${li.need} XP` }, h('b', null, `Nv. ${li.level}`), h('div', { class: 'bar' }, h('i', { style: `width:${Math.round((li.into / li.need) * 100)}%` }))),
            h('div', { class: 'chip', title: 'Monedas', id: 'chip-coins' }, coinIcon(), fmt(p.data.coins)),
            h('div', { class: 'chip', title: 'Poké Balls', id: 'chip-balls' }, ballIcon('poke'), String(p.ballCount())),
        ]);
        const dots = pendingDots(p);
        clear(this.navEl);
        const home = SCREENS.find((s) => s.id === 'inicio');
        const homeButton = h('button', { type: 'button', class: 'nav-home', aria: { label: 'Casa' }, on: { click: () => this.go('inicio') } }, icon('inicio'), h('span', { class: 'nl' }, 'Casa'), dots.inicio && h('span', { class: 'dot', aria: { hidden: 'true' } }));
        if (this.screen === 'inicio') homeButton.setAttribute('aria-current', 'page');
        this.navEl.appendChild(homeButton);
        const menu = h('label', { class: 'nav-menu-wrap', 'aria-label': 'Abrir sección' }, h('span', { class: 'nav-menu-label' }, 'Menú', Object.entries(dots).some(([k, v]) => v && k !== 'inicio') && h('span', { class: 'dot', aria: { hidden: 'true' } })), h('select', { class: 'nav-menu', 'aria-label': 'Ir a una sección', value: this.screen, on: { change: (e) => this.go(e.target.value) } }, SCREENS.filter((s) => s.id !== 'inicio').map((s) => h('option', { value: s.id }, dots[s.id] ? `🔴 ${s.label}` : s.label))));
        if (this.screen !== 'inicio') menu.querySelector('select').value = this.screen;
        this.navEl.appendChild(menu);
    }
    /* ───────── partidas ───────── */
    async startBattle(cfg) {
        if (this.battle)
            return;
        this.audio.unlock();
        this.root.classList.add('in-battle');
        this.battleRoot.hidden = false;
        this.battleRoot.className = '';
        clear(this.battleRoot);
        const ctl = new BattleController(this, this.battleRoot, cfg);
        this.battle = ctl;
        ctl.onExit = (next) => {
            // El controlador trabaja sobre una copia de cfg: su indicador también cuenta,
            // para que el resultado de Historia/Torneo se registre una sola vez.
            if (typeof cfg.onComplete === 'function' && !cfg.__completionCalled && !ctl.cfg.__completionCalled) { cfg.__completionCalled = true; try { cfg.onComplete(ctl.battle?.result ?? null); } catch (e) { console.error('No se pudo guardar el resultado del modo especial', e); } }
            this.battle = null;
            this.battleRoot.hidden = true;
            clear(this.battleRoot);
            this.root.classList.remove('in-battle');
            if (next === 'again')
                void this.startBattle(cfg);
            else
                this.go(next === 'decks' ? 'mazos' : ['historia', 'torneos'].includes(next) ? next : 'inicio');
            this.refreshChrome();
        };
        try {
            await ctl.start();
        } catch (error) {
            // Un fallo al crear la simulación o precargar sprites no debe dejar
            // la aplicación atrapada en «Cargando Pokémon…».
            console.error('No se pudo iniciar el combate', error);
            try { ctl.dispose(); } catch (cleanupError) { console.warn('Limpieza parcial del combate', cleanupError); }
            if (this.battle !== ctl) return;
            this.battle = null;
            this.root.classList.remove('in-battle');
            this.battleRoot.hidden = false;
            clear(this.battleRoot);
            const target = cfg.mode === 'story' ? 'historia' : cfg.mode === 'tournament' ? 'torneos' : 'inicio';
            const message = error?.message || 'Se ha producido un error inesperado al preparar la partida.';
            try {
            append(this.battleRoot, [h('section', { class: 'panel stack', style: 'max-width:560px;margin:8vh auto;padding:24px;text-align:center' },
                h('h2', null, 'No se pudo iniciar el combate'),
                h('p', { class: 'sub' }, message),
                h('p', { class: 'sub' }, 'No se ha borrado ni avanzado tu progreso.'),
                h('button', { class: 'btn btn-gold btn-big', type: 'button', on: { click: () => {
                    this.battleRoot.hidden = true;
                    clear(this.battleRoot);
                    this.root.classList.remove('in-battle');
                    void this.startBattle({ ...cfg, __completionCalled: false });
                } } }, 'Reintentar'),
                h('button', { class: 'btn btn-blue', type: 'button', on: { click: () => {
                    this.battleRoot.hidden = true;
                    clear(this.battleRoot);
                    this.go(target);
                } } }, target === 'historia' ? 'Volver a Historia' : target === 'torneos' ? 'Volver a Torneos' : 'Volver al inicio')
            )]);
            } catch (panelError) {
                // Último recurso: si ni siquiera se puede dibujar el aviso, nunca dejar una capa negra vacía sobre el menú.
                console.error('No se pudo mostrar el aviso de error de combate', panelError);
                this.battleRoot.hidden = true;
                clear(this.battleRoot);
                this.go(target);
                toast('No se pudo iniciar el combate: ' + message, 'err', 8000);
            }
        }
    }
    destroy() {
        this.unsub?.();
        for (const c of this.cleanups.splice(0))
            c();
    }
}
