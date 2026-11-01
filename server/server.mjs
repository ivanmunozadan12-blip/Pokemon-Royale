/**
 * Servidor de salas privadas de Pokémon Royale (WebSocket) — pensado para Render.
 *
 * Solo EMPAREJA a dos jugadores y RETRANSMITE sus mensajes (chat, invitaciones y órdenes del lockstep).
 * No simula la partida ni guarda nada en disco: todo vive en memoria y se pierde al reiniciar (las salas son temporales).
 *
 * Protocolo (JSON, compatible con assets/net/room.js):
 *   cliente -> servidor   {op:'create'}                       crea una sala
 *                         {op:'join', code}                   entra en una sala
 *                         {op:'msg', d:{type:'…', …}}         mensaje para el otro jugador
 *                         {op:'ping'}                         latido (mantiene despierto el servicio gratuito de Render)
 *   servidor -> cliente   {op:'created', code}  {op:'joined'}  {op:'peer', state:'joined'|'left'}
 *                         {op:'msg', d}  {op:'error', reason:'sala-no-existe'|'sala-llena'|'servidor-lleno'|'ya-en-sala'}
 *
 * Variables de entorno (todas opcionales): PORT (la pone Render), ALLOWED_ORIGINS (lista separada por comas, p. ej.
 * "https://mi-juego.netlify.app"; vacía = cualquier origen), MAX_ROOMS, MAX_CONNECTIONS.
 */
import http from 'node:http';
import { randomInt } from 'node:crypto';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 8080;
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 1000;
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS) || 2000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
const MAX_PAYLOAD = 64 * 1024; // las invitaciones con mazo, niveles y entrenamiento caben de sobra
const HEARTBEAT_MS = 25_000; // Render corta las conexiones inactivas; un ping cada 25 s las mantiene vivas
const HELLO_TIMEOUT_MS = 10_000; // quien conecta y no pide nada se descarta
const ROOM_IDLE_MS = 30 * 60_000; // sala sin segundo jugador durante 30 min
const RATE_PER_SEC = 120; // mensajes por segundo y jugador (el lockstep usa ~20-30)
const RATE_BURST = 300;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I/L para evitar confusiones
const CODE_LEN = 5;

/** @type {Map<string, {code:string, host:any, guest:any, createdAt:number}>} */
const rooms = new Map();
let connections = 0;

const httpServer = http.createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/healthz' || path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, rooms: rooms.size, connections }));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Pokémon Royale · servidor de salas en marcha.\n');
});

const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: MAX_PAYLOAD,
    perMessageDeflate: false, // menos latencia: los mensajes son pequeños
    verifyClient: ({ origin }) => ALLOWED_ORIGINS.length === 0 || (!!origin && ALLOWED_ORIGINS.includes(origin.replace(/\/$/, ''))),
});

function sendJson(ws, obj) {
    if (ws && ws.readyState === 1) {
        try { ws.send(JSON.stringify(obj)); } catch { /* conexión ya cerrada */ }
    }
}

function newCode() {
    for (let tries = 0; tries < 50; tries++) {
        let c = '';
        for (let i = 0; i < CODE_LEN; i++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
        if (!rooms.has(c)) return c;
    }
    return null;
}

function leaveRoom(ws) {
    const room = ws.room;
    if (!room) return;
    ws.room = null;
    if (room.host === ws) {
        // Si se va quien creó la sala, la sala se cierra; el invitado recibe el aviso y queda sin sala.
        rooms.delete(room.code);
        const guest = room.guest;
        room.host = null;
        room.guest = null;
        if (guest) {
            guest.room = null;
            sendJson(guest, { op: 'peer', state: 'left' });
        }
    } else if (room.guest === ws) {
        room.guest = null;
        room.createdAt = Date.now();
        sendJson(room.host, { op: 'peer', state: 'left' });
    }
}

function handle(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.op !== 'string') return;

    if (m.op === 'msg') {
        const room = ws.room;
        if (!room || !m.d || typeof m.d !== 'object' || typeof m.d.type !== 'string') return;
        const other = room.host === ws ? room.guest : room.host;
        if (other && other.readyState === 1) {
            try { other.send(raw); } catch { /* el otro jugador se acaba de ir */ }
        }
        return;
    }
    if (m.op === 'ping') return;

    if (m.op === 'create') {
        if (ws.room) return sendJson(ws, { op: 'error', reason: 'ya-en-sala' });
        if (rooms.size >= MAX_ROOMS) return sendJson(ws, { op: 'error', reason: 'servidor-lleno' });
        const code = newCode();
        if (!code) return sendJson(ws, { op: 'error', reason: 'servidor-lleno' });
        const room = { code, host: ws, guest: null, createdAt: Date.now() };
        rooms.set(code, room);
        ws.room = room;
        ws.helloDone = true;
        return sendJson(ws, { op: 'created', code });
    }

    if (m.op === 'join') {
        if (ws.room) return sendJson(ws, { op: 'error', reason: 'ya-en-sala' });
        const code = String(m.code ?? '').trim().toUpperCase();
        const room = /^[A-Z0-9]{4,8}$/.test(code) ? rooms.get(code) : null;
        if (!room || !room.host) return sendJson(ws, { op: 'error', reason: 'sala-no-existe' });
        if (room.guest) return sendJson(ws, { op: 'error', reason: 'sala-llena' });
        room.guest = ws;
        ws.room = room;
        ws.helloDone = true;
        sendJson(ws, { op: 'joined' });
        return sendJson(room.host, { op: 'peer', state: 'joined' });
    }
}

wss.on('connection', (ws, req) => {
    if (connections >= MAX_CONNECTIONS) return ws.close(1013, 'servidor-lleno');
    connections++;
    ws.room = null;
    ws.helloDone = false;
    ws.isAlive = true;
    ws.tokens = RATE_BURST;
    ws.tokensAt = Date.now();
    req.socket.setNoDelay(true); // sin retardo de Nagle: importante para el lockstep

    const hello = setTimeout(() => { if (!ws.helloDone) ws.close(1008, 'sin-peticion'); }, HELLO_TIMEOUT_MS);
    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data, isBinary) => {
        if (isBinary) return;
        ws.isAlive = true;
        const now = Date.now();
        ws.tokens = Math.min(RATE_BURST, ws.tokens + ((now - ws.tokensAt) / 1000) * RATE_PER_SEC);
        ws.tokensAt = now;
        if (--ws.tokens < 0) return ws.close(1008, 'demasiados-mensajes');
        handle(ws, data.toString());
    });
    ws.on('close', () => {
        clearTimeout(hello);
        connections--;
        leaveRoom(ws);
    });
    ws.on('error', () => { /* el cierre se gestiona en 'close' */ });
});

// Latido: descarta conexiones muertas (móvil sin cobertura, pestaña cerrada de golpe…) y mantiene vivas las demás.
const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
        if (!ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        try { ws.ping(); } catch { /* ya cerrado */ }
    }
}, HEARTBEAT_MS);

// Limpieza de salas olvidadas.
const sweeper = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
        if (!room.guest && now - room.createdAt > ROOM_IDLE_MS) {
            const host = room.host;
            rooms.delete(room.code);
            if (host) { host.room = null; host.close(1000, 'sala-caducada'); }
        }
    }
}, 60_000);

function shutdown() {
    clearInterval(heartbeat);
    clearInterval(sweeper);
    for (const ws of wss.clients) ws.close(1001, 'servidor-reiniciando');
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

httpServer.listen(PORT, '0.0.0.0', () => console.log(`Pokémon Royale · servidor de salas escuchando en el puerto ${PORT}`));
