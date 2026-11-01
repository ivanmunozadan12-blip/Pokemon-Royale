import { DIFFICULTIES, DIFFICULTY_LABEL, CONFIG } from "../../config.js";
import { confirmBox, h, toast } from "../dom.js";
import { notifySupported, requestNotifyPermission } from "../notify.js";
export function ajustesScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    const sw = (label, on, set, id, disabled = false) => h('div', { class: 'switch' }, h('span', null, label), h('button', { type: 'button', role: 'switch', id, disabled, aria: { checked: on, label }, on: { click: () => set(!on) } }));
    const range = (label, v, key, id) => h('label', { class: 'stack' }, h('span', null, `${label}: ${Math.round(v * 100)} %`), h('input', { type: 'range', id, min: '0', max: '100', step: '5', value: String(Math.round(v * 100)),
        on: {
            input: (e) => { p.data.settings[key] = Number(e.target.value) / 100; app.audio.applySettings(); },
            change: (e) => { p.updateSettings({ [key]: Number(e.target.value) / 100 }); app.audio.applySettings(); app.audio.sfx('select'); },
        } }));
    const draw = () => {
        root.replaceChildren();
        const s = p.data.settings;
        const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator;
        const up = (patch) => { p.updateSettings(patch); app.audio.applySettings(); };
        const notifyOn = async (v) => {
            if (v) {
                const r = await requestNotifyPermission();
                if (r !== 'granted') {
                    toast(r === 'unsupported' ? 'Este navegador no admite avisos.' : 'Permiso de avisos denegado en el navegador.', 'err');
                    return;
                }
            }
            up({ notify: v });
        };
        root.append(h('h1', null, 'Ajustes'), h('section', { class: 'panel stack', id: 'notify-panel' }, h('h3', null, 'Avisos'), sw('Avisar cuando haya una Poké Ball gratis', s.notify && notifySupported(), (v) => void notifyOn(v), 'set-notify', !notifySupported()), h('p', { class: 'sub' }, 'Son avisos locales: solo salen mientras el juego siga abierto (también en segundo plano). Con la app cerrada del todo no es posible avisar sin un servidor de notificaciones. Los puntos rojos del menú sí se muestran siempre y reflejan lo que de verdad tienes pendiente.')), h('section', { class: 'panel stack' }, h('h3', null, 'Sonido'), sw('Música', s.musicOn, (v) => up({ musicOn: v }), 'set-music'), range('Volumen de la música', s.musicVol, 'musicVol', 'vol-music'), sw('Efectos de sonido', s.sfxOn, (v) => up({ sfxOn: v }), 'set-sfx'), range('Volumen de los efectos', s.sfxVol, 'sfxVol', 'vol-sfx'), h('div', { class: 'sub' }, app.audio.supported ? 'El sonido se activa tras tu primer toque (restricción de los navegadores móviles).' : 'Este navegador no admite Web Audio: el juego funciona sin sonido.')), h('section', { class: 'panel stack' }, h('h3', null, 'Gráficos'), sw('Reducir efectos visuales', s.reduceFx, (v) => up({ reduceFx: v }), 'set-reduce'), sw('Sacudidas de cámara', s.shake, (v) => up({ shake: v }), 'set-shake'), sw(canVibrate ? 'Vibración' : 'Vibración (no disponible en este dispositivo)', s.vibration && canVibrate, (v) => up({ vibration: v }), 'set-vib', !canVibrate), h('div', null, h('div', null, 'Calidad gráfica'), h('div', { class: 'seg', role: 'group' }, ['alta', 'media', 'baja'].map((q) => h('button', { type: 'button', data: { q }, aria: { pressed: s.quality === q }, on: { click: () => up({ quality: q }) } }, q[0].toUpperCase() + q.slice(1)))))), h('section', { class: 'panel stack' }, h('h3', null, 'Juego'), h('label', { class: 'stack' }, h('span', null, 'Nombre de jugador (visible en partidas privadas)'), h('input', { type: 'text', maxlength: '20', value: s.playerName || 'Entrenador', autocomplete: 'nickname', on: { change: (e) => { const v = String(e.target.value || '').replace(/[<>\r\n]/g, '').trim().slice(0,20) || 'Entrenador'; p.updateSettings({ playerName: v }); toast('Nombre guardado', 'ok'); } } })), h('div', null, 'Dificultad por defecto'), h('div', { class: 'seg', role: 'group' }, DIFFICULTIES.map((k) => h('button', { type: 'button', aria: { pressed: s.difficulty === k }, on: { click: () => up({ difficulty: k }) } }, DIFFICULTY_LABEL[k])))), h('section', { class: 'panel stack' }, h('h3', null, 'Progreso y copia de seguridad'), h('p', { class: 'sub' }, 'Tu progreso se guarda SOLO en este navegador y dispositivo. Si borras los datos del navegador, se pierde, salvo que tengas una copia. Si importas un guardado antiguo, se conserva el JSON original antes de migrarlo y podrás descargarlo de nuevo.'), h('div', { class: 'row' }, h('button', { class: 'btn btn-blue', type: 'button', id: 'export', on: { click: () => {
                    const blob = new Blob([p.exportJson()], { type: 'application/json' });
                    const a = h('a', { href: URL.createObjectURL(blob), download: `pokemon-royale-copia-${new Date().toISOString().slice(0, 10)}.json` });
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
                    toast('Copia de seguridad descargada', 'ok');
                } } }, 'Exportar copia (JSON)'), h('label', { class: 'btn btn-blue', style: 'cursor:pointer' }, 'Importar copia', h('input', { type: 'file', accept: 'application/json,.json', id: 'import', hidden: true, on: { change: async (e) => {
                    const inp = e.target;
                    const f = inp.files?.[0];
                    inp.value = '';
                    if (!f)
                        return;
                    const text = await f.text();
                    if (!(await confirmBox('Importar copia', 'Esto reemplaza tu progreso actual por el de la copia. ¿Continuar?', 'Importar', true)))
                        return;
                    const r = p.importJson(text);
                    if (r.ok) {
                        const migrationNote = r.repaired.find((x) => x.includes('Migración de trofeos') || x.includes('Trofeos migrados'));
                        toast(migrationNote || 'Copia importada correctamente', migrationNote?.includes('aproximada') ? 'err' : 'ok', migrationNote ? 8000 : 3500);
                        app.go('ajustes');
                    }
                    else
                        toast(r.error, 'err', 5000);
                } } }))), p.hasTrophyMigrationBackup() && h('button', { class: 'btn btn-blue', type: 'button', id: 'export-legacy-trophy-backup', on: { click: () => {
                    const original = p.exportTrophyMigrationBackup();
                    if (!original) { toast('No hay copia antigua disponible', 'err'); return; }
                    const blob = new Blob([original], { type: 'application/json' });
                    const a = h('a', { href: URL.createObjectURL(blob), download: `pokemon-royale-copia-original-previa-migracion-${new Date().toISOString().slice(0, 10)}.json` });
                    document.body.appendChild(a); a.click();
                    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
                    toast('Copia original previa a la migración descargada', 'ok');
                } } }, 'Exportar copia antigua'), h('button', { class: 'btn btn-red', type: 'button', id: 'reset', on: { click: async () => {
                    if (!(await confirmBox('Reiniciar progreso', 'Se borrarán monedas, Poké Balls, Pokémon desbloqueados, mazos y estadísticas. Esta acción no se puede deshacer (exporta antes una copia si quieres conservarla).', 'Borrar todo', true)))
                        return;
                    p.resetProgress();
                    toast('Progreso reiniciado', 'ok');
                    app.go('inicio');
                } } }, 'Reiniciar progreso')), h('section', { class: 'panel stack' }, h('h3', null, 'Acerca de'), h('p', { class: 'sub' }, `Pokémon Royale v${CONFIG.version} · prototipo personal, sin afiliación oficial con Nintendo, Game Freak ni The Pokémon Company. Pokémon y sus nombres son marcas de sus propietarios.`), h('p', { class: 'sub' }, 'Sprites: repositorio PokeAPI/sprites (Pokémon Blanco/Negro), uso personal sin ánimo de lucro; consulta docs/RECURSOS.md. Escenario, torres, efectos y sonido: generados por código en este proyecto.')));
    };
    draw();
    app.watch(() => { const a = document.activeElement; if (!(a instanceof HTMLInputElement && a.type === 'range'))
        draw(); });
    return root;
}
