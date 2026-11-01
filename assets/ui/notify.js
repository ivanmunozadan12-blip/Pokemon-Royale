/**
 * Avisos de Poké Ball gratis lista (solo si el jugador los activa en Ajustes y concede el permiso del navegador).
 * LÍMITE REAL: son avisos locales, sin servidor de notificaciones push. Solo salen mientras el juego sigue abierto
 * (aunque esté en segundo plano); con la app cerrada del todo no se puede avisar. Chrome puede retrasar los
 * temporizadores de una pestaña en segundo plano.
 */
export const notifySupported = () => typeof Notification !== 'undefined' && 'serviceWorker' in navigator;
export async function requestNotifyPermission() {
    if (!notifySupported())
        return 'unsupported';
    if (Notification.permission === 'granted')
        return 'granted';
    if (Notification.permission === 'denied')
        return 'denied';
    try {
        return await Notification.requestPermission();
    }
    catch {
        return 'denied';
    }
}
async function show(title, body) {
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg)
            await reg.showNotification(title, { body, icon: 'assets/items/balls/poke.png', tag: 'free-ball', renotify: false });
    }
    catch { /* sin permiso o sin service worker */ }
}
export function startNotifier(app) {
    let last = app.profile.freeBallsState().stored;
    const tick = () => {
        const p = app.profile;
        const stored = p.freeBallsState().stored;
        if (stored > last && p.data.settings.notify && notifySupported() && Notification.permission === 'granted' && document.hidden)
            void show('¡Poké Ball gratis lista!', `Tienes ${stored} Poké Ball${stored === 1 ? '' : 's'} gratis esperando en Pokémon Royale.`);
        last = stored;
    };
    return setInterval(tick, 20000);
}
