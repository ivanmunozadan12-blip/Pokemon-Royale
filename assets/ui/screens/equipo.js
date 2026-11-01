import { PeerRoom, getServerUrl, setServerUrl } from "../../net/room.js";
import { h, toast } from "../dom.js";
import { SPECIES } from "../../data/species.js";
/** Copia segura de un objeto recibido por red (solo números dentro de objetos simples). */
function cleanObj(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o))
        return {};
    try {
        return JSON.parse(JSON.stringify(o));
    }
    catch {
        return {};
    }
}
export function equipoScreen(app) {
    const root = h('div', { class: 'page' });
    let room = PeerRoom.current();
    let status = room ? 'Conexión activa' : 'Sin conexión';
    let code = room?.code ?? '';
    let joinCode = new URLSearchParams(location.search).get('room') ?? '';
    let chatText = '';
    let messages = room?.history.slice() ?? [];
    let incoming = room?.pendingInvite ?? null;
    let pendingInvite = null;
    let unsubscribe = null;
    let statusUnsub = null;
    let roomName = 'Entrenador';
    const draw = () => {
        root.replaceChildren(h('h1', null, 'Equipo y partidas privadas'), h('section', { class: 'panel stack' }, h('h2', null, 'Conexión entre amigos'), h('p', { class: 'sub' }, 'Crea una sala y comparte el código o el enlace. Tu amigo debe abrir el mismo juego. Las salas funcionan a través del servidor del juego (alojado en Render); necesitas Internet y que la dirección del servidor esté configurada. Si el servidor llevaba un rato sin uso, la primera conexión puede tardar hasta un minuto en despertar.'), h('div', { class: 'row' }, h('button', { class: 'btn btn-gold', type: 'button', disabled: !!room, on: { click: () => void createRoom() } }, 'Crear sala'), h('button', { class: 'btn btn-blue', type: 'button', disabled: !!room, on: { click: () => void joinRoom() } }, 'Unirse')), h('label', { class: 'stack' }, h('span', null, 'Servidor de Render (wss://…onrender.com)'), h('input', { id: 'server-url', value: getServerUrl(), placeholder: 'wss://pokemon-royale-server.onrender.com', disabled: !!room, on: { change: (e) => { if (!setServerUrl(e.target.value)) { toast('Dirección no válida: usa la dirección de Render (wss://tu-servicio.onrender.com)', 'err'); e.target.value = getServerUrl(); } else { e.target.value = getServerUrl(); toast('Servidor guardado', 'ok'); } } } })), h('label', { class: 'stack' }, h('span', null, 'Código de sala de tu amigo'), h('input', { id: 'room-code', value: joinCode, placeholder: 'Código de 5 caracteres', on: { input: (e) => { joinCode = e.target.value; } } })), room && h('div', { class: 'panel stack', style: 'padding:12px' }, h('b', null, 'Tu código de invitación'), h('code', null, code || '…'), h('button', { class: 'btn btn-blue sm', type: 'button', on: { click: () => { const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(code)}`; void navigator.clipboard?.writeText(url).then(() => toast('Enlace copiado', 'ok')).catch(() => toast(url, 'info', 8000)); } } }, 'Copiar enlace de invitación'), h('button', { class: 'btn btn-red sm', type: 'button', on: { click: () => { unsubscribe?.(); statusUnsub?.(); room?.close(); room = null; code = ''; status = 'Sin conexión'; draw(); } } }, 'Cerrar sala')), h('div', { class: 'sub', role: 'status' }, status)), h('section', { class: 'panel stack' }, h('div', { class: 'row between' }, h('h2', null, 'Chat del equipo'), h('span', { class: 'badge' }, room ? 'Servidor' : 'Desconectado')), h('div', { class: 'team-chat', id: 'team-chat', 'aria-live': 'polite' }, messages.length ? messages.map((m) => h('div', { class: `chat-line${m.mine ? ' mine' : ''}` }, h('b', null, `${m.name} · ${m.at}`), h('span', null, m.text))) : h('div', { class: 'sub' }, 'Conéctate a una sala para hablar con tu amigo.')), h('div', { class: 'row' }, h('input', { id: 'chat-input', value: chatText, placeholder: 'Escribe un mensaje…', disabled: !room || room.conn?.open !== true, on: { input: (e) => { chatText = e.target.value; const send = root.querySelector('#send-chat'); if (send)
                    send.disabled = !room || room.conn?.open !== true || !chatText.trim(); } } }), h('button', { id: 'send-chat', class: 'btn btn-gold', type: 'button', disabled: !room || room.conn?.open !== true || !chatText.trim(), on: { click: sendChat } }, 'Enviar'))), h('section', { class: 'panel stack' }, h('h2', null, 'Partida privada'), h('p', { class: 'sub' }, 'Invita al jugador conectado a una partida usando tus 8 cartas del mazo activo. Las partidas privadas se guardan en el historial local de cada jugador. No existe todavía un ranking global ni protección de servidor contra trampas.'), h('button', { class: 'btn btn-gold btn-big', type: 'button', disabled: !room || room.conn?.open !== true, on: { click: inviteMatch } }, 'Invitar a partida privada'), incoming && h('div', { class: 'panel stack', style: 'padding:12px' }, h('b', null, 'Invitación recibida'), h('span', { class: 'sub' }, 'Tu amigo quiere empezar una partida privada.'), h('button', { class: 'btn btn-green', type: 'button', on: { click: acceptInvite } }, 'Aceptar e iniciar'), h('button', { class: 'btn btn-blue sm', type: 'button', on: { click: () => { incoming = null; draw(); } } }, 'Rechazar'))), h('section', { class: 'panel stack' }, h('h2', null, 'Estado del equipo'), h('div', { class: 'sub' }, room ? 'La sala es temporal: mientras la conexión siga abierta podéis hablar y recibir invitaciones.' : 'Crea o únete a una sala para activar el chat y las invitaciones.'), h('div', { class: 'sub' }, `Colección local: ${app.profile.data.unlocked.length}/${SPECIES.length} Pokémon`)));
        const chat = root.querySelector('#chat-input');
        chat?.addEventListener('keydown', (e) => { if (e.key === 'Enter')
            sendChat(); });
    };
    const hookRoom = (r) => {
        unsubscribe?.();
        statusUnsub?.();
        unsubscribe = r.onMessage(onMessage);
        statusUnsub = r.onStatus((s) => { status = s; draw(); });
    };
    const createRoom = async () => {
        const mine = new PeerRoom();
        try {
            room = mine;
            hookRoom(room);
            status = 'Conectando con el servidor… si estaba dormido puede tardar hasta un minuto.';
            draw();
            code = await mine.create();
            status = 'Sala creada. Esperando al amigo…';
            draw();
        }
        catch (e) {
            if (room !== mine)
                return; // el jugador cerró la sala mientras conectaba
            toast(e instanceof Error ? e.message : 'No se pudo crear la sala', 'err', 6000);
            unsubscribe?.(); unsubscribe = null; statusUnsub?.(); statusUnsub = null;
            room = null;
            status = 'Sin conexión';
            draw();
        }
    };
    const joinRoom = async () => {
        const mine = new PeerRoom();
        try {
            room = mine;
            hookRoom(room);
            status = 'Conectando con el servidor… si estaba dormido puede tardar hasta un minuto.';
            draw();
            await mine.join(joinCode);
            code = mine.code;
            status = 'Conectado a la sala privada.';
            draw();
        }
        catch (e) {
            if (room !== mine)
                return; // el jugador cerró la sala mientras conectaba
            toast(e instanceof Error ? e.message : 'No se pudo conectar', 'err', 6000);
            unsubscribe?.(); unsubscribe = null; statusUnsub?.(); statusUnsub = null;
            room = null;
            status = 'Sin conexión';
            draw();
        }
    };
    const sendChat = () => {
        const text = chatText.trim().slice(0, 500);
        if (!room || !text)
            return;
        const at = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (!room.send({ type: 'chat', name: roomName, text, at })) {
            toast('No se pudo enviar: comprueba la conexión.', 'err');
            return;
        }
        messages = room.history.slice();
        chatText = '';
        draw();
    };
    const inviteMatch = () => {
        if (!room)
            return;
        const deck = app.profile.deck.ids.slice();
        if (deck.length !== 8) {
            toast('Completa un mazo de 8 Pokémon antes de invitar.', 'err');
            return;
        }
        const seed = Math.floor(Math.random() * 0x7fffffff) + 1;
        pendingInvite = { seed, deck, arena: app.profile.currentArena.id, difficulty: app.profile.data.settings.difficulty };
        const sent = room.send({ type: 'match-invite', seed, playerName: app.profile.data.settings.playerName || 'Entrenador', deck, levels: app.profile.deckLevels(deck), shiny: app.profile.data.shinySelected.filter((id) => deck.includes(id)), arena: app.profile.currentArena.id, difficulty: app.profile.data.settings.difficulty, towerLevel: app.profile.towerLevel, item: (()=>{const d=app.profile.data.decks[app.profile.data.activeDeck];return d?.equippedItem?{itemId:d.equippedItem,pokemonId:d.equippedPokemon}:null;})() });
        if (sent)
            toast('Invitación enviada. Espera a que tu amigo acepte.', 'ok');
        else
            toast('No se pudo enviar la invitación.', 'err');
    };
    const acceptInvite = () => {
        if (!room || !incoming)
            return;
        const deck = app.profile.deck.ids.slice();
        if (deck.length !== 8) {
            toast('Completa un mazo de 8 Pokémon antes de aceptar.', 'err');
            return;
        }
        room.send({ type: 'match-ready', moves: app.profile.deckMoves(deck), playerName: app.profile.data.settings.playerName || 'Entrenador', deck, levels: app.profile.deckLevels(deck), shiny: app.profile.data.shinySelected.filter((id) => deck.includes(id)), training: app.profile.data.training.stats, item: (()=>{const d=app.profile.data.decks[app.profile.data.activeDeck];return d?.equippedItem?{itemId:d.equippedItem,pokemonId:d.equippedPokemon}:null;})() });
        incoming = null;
        draw();
        toast('Has aceptado la invitación. Preparando la partida…', 'info', 5000);
    };
    const onMessage = (m) => {
        if (m.type === 'chat' && typeof m.text === 'string') {
            messages = room?.history.slice(-100) ?? [];
            draw();
        }
        else if (m.type === 'match-invite') {
            incoming = m;
            draw();
        }
        else if (m.type === 'match-ready' && room?.isHost) {
            const hostDeck = app.profile.deck.ids.slice();
            const guestDeck = Array.isArray(m.deck) ? m.deck.filter((x) => Number.isInteger(x) && x > 0 && x <= 151).slice(0, 8) : [];
            if (hostDeck.length !== 8 || guestDeck.length !== 8) {
                toast('Uno de los mazos no tiene 8 Pokémon válidos.', 'err');
                return;
            }
            const seed = Number(pendingInvite?.seed ?? 0) || Math.floor(Math.random() * 0x7fffffff) + 1;
            const hostLevels = app.profile.deckLevels(hostDeck);
            const hostShiny = app.profile.data.shinySelected.filter((id) => hostDeck.includes(id));
            const guestLevels = (m.levels && typeof m.levels === 'object') ? m.levels : {};
            const guestShiny = Array.isArray(m.shiny) ? m.shiny.filter((x) => Number.isInteger(x)) : [];
            const arena = String(pendingInvite?.arena ?? app.profile.currentArena.id);
            const difficulty = (pendingInvite?.difficulty === 'facil' || pendingInvite?.difficulty === 'dificil') ? pendingInvite.difficulty : 'normal';
            const towerLevel = Number(pendingInvite?.towerLevel ?? app.profile.towerLevel) || 1;
            const guestTraining = cleanObj(m.training);
            const hostTraining = app.profile.data.training.stats;
            const hostItem = (()=>{const d=app.profile.data.decks[app.profile.data.activeDeck];return d?.equippedItem?{itemId:d.equippedItem,pokemonId:d.equippedPokemon}:null;})();
            const guestItem = m.item && typeof m.item.itemId==='string' && Number.isInteger(Number(m.item.pokemonId)) && guestDeck.includes(Number(m.item.pokemonId)) ? {itemId:m.item.itemId,pokemonId:Number(m.item.pokemonId)} : null;
            const hostMoves = app.profile.deckMoves(hostDeck);
            const guestMoves = cleanObj(m.moves);
            room.send({ type: 'match-start', hostMoves, guestMoves, seed, hostDeck, guestDeck, hostLevels, guestLevels, hostShiny, guestShiny, hostTraining, guestTraining, hostItem, guestItem, hostName: app.profile.data.settings.playerName || 'Entrenador', guestName: String(m.playerName || 'Amigo').slice(0,20), arena, difficulty, towerLevel });
            const cfg = { mode: 'normal', difficulty, arena, deck: hostDeck, enemyDeck: guestDeck, seed, label: 'Partida privada · Amigo', multiplayer: { localTeam: 0, room, playerName: app.profile.data.settings.playerName || 'Entrenador', opponentName: String(m.playerName || 'Amigo').slice(0,20), opponentLevels: guestLevels, opponentShiny: guestShiny, opponentTraining: guestTraining, opponentMoves: guestMoves, opponentTowerLevel: towerLevel, opponentItem: guestItem } };
            void app.startBattle(cfg);
        }
        else if (m.type === 'match-start') {
            const guestDeck = Array.isArray(m.guestDeck) ? m.guestDeck : [];
            const hostDeck = Array.isArray(m.hostDeck) ? m.hostDeck : [];
            const seed = Number(m.seed);
            const levels = (m.hostLevels && typeof m.hostLevels === 'object') ? m.hostLevels : {};
            const shiny = Array.isArray(m.hostShiny) ? m.hostShiny.filter((x) => Number.isInteger(x)) : [];
            const cfg = { mode: 'normal', difficulty: (m.difficulty === 'facil' || m.difficulty === 'dificil' ? m.difficulty : 'normal'), arena: String(m.arena ?? app.profile.currentArena.id), deck: guestDeck, enemyDeck: hostDeck, seed, label: 'Partida privada · Amigo', multiplayer: { localTeam: 1, room: room, playerName: String(m.guestName || app.profile.data.settings.playerName || 'Entrenador').slice(0,20), opponentName: String(m.hostName || 'Amigo').slice(0,20), opponentLevels: levels, opponentShiny: shiny, opponentTraining: cleanObj(m.hostTraining), opponentMoves: cleanObj(m.hostMoves), opponentTowerLevel: Number(m.towerLevel ?? 1), opponentItem: m.hostItem && typeof m.hostItem.itemId==='string' && Number.isInteger(Number(m.hostItem.pokemonId)) && hostDeck.includes(Number(m.hostItem.pokemonId)) ? {itemId:m.hostItem.itemId,pokemonId:Number(m.hostItem.pokemonId)} : null } };
            if (room && guestDeck.length === 8 && hostDeck.length === 8 && seed > 0)
                void app.startBattle(cfg);
        }
    };
    app.onLeave(() => { unsubscribe?.(); unsubscribe = null; statusUnsub?.(); statusUnsub = null; /* La conexión se mantiene al cambiar de pestaña. */ });
    if (room) {
        messages = room.history.slice(-100);
        incoming = room.pendingInvite;
        hookRoom(room);
    }
    draw();
    return root;
}
