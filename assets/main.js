import { AudioEngine } from "./audio/audio.js";
import { Profile } from "./game/profile.js";
import { SpriteStore } from "./render/sprites.js";
import { App } from "./ui/app.js";
/** Almacenamiento seguro: si localStorage está bloqueado (modo privado, políticas…) el juego sigue funcionando sin guardar. */
function storage() {
    try {
        const k = '__pr_test__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return localStorage;
    }
    catch {
        return null;
    }
}
function boot() {
    const root = document.getElementById('app');
    const profile = new Profile(storage());
    const audio = new AudioEngine(() => profile.data.settings);
    profile.onChange(() => audio.applySettings());
    const sprites = new SpriteStore('sprites/');
    const app = new App(profile, audio, sprites);
    try {
        app.mount(root);
    } catch (error) {
        console.error('Pokémon Royale no pudo iniciar:', error);
        const bootScreen = document.getElementById('boot');
        if (bootScreen) {
            bootScreen.style.flexDirection = 'column';
            bootScreen.style.gap = '12px';
            bootScreen.style.padding = '24px';
            bootScreen.style.textAlign = 'center';
            bootScreen.replaceChildren(
                Object.assign(document.createElement('strong'), { textContent: 'No se pudo iniciar Pokémon Royale' }),
                Object.assign(document.createElement('p'), { textContent: 'Recarga la página. Si el problema continúa, borra los datos del sitio y vuelve a abrirlo.' })
            );
        }
        window.__PR_BOOT_ERROR__ = String(error?.stack || error);
        return;
    }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
        void navigator.serviceWorker.register('./sw.js').catch(() => { });
    }
    window.__PR = { app, profile, audio, sprites };
    window.addEventListener('error', (e) => {
        window.__PR_ERRORS ??= [];
        window.__PR_ERRORS.push(String(e.message));
    });
    document.getElementById('boot')?.remove();
}
if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
else
    boot();
