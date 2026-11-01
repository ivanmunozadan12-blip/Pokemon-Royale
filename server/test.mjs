// Prueba de humo del servidor: `npm install && npm test`
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import assert from 'node:assert/strict';

const PORT = 18080 + Math.floor(Math.random() * 500);
const srv = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
const url = `ws://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const inbox = [];
        const waiters = [];
        ws.on('message', (d) => { const m = JSON.parse(d.toString()); const w = waiters.shift(); w ? w(m) : inbox.push(m); });
        ws.next = () => new Promise((res, rej) => { if (inbox.length) return res(inbox.shift()); const t = setTimeout(() => rej(new Error('timeout')), 3000); waiters.push((m) => { clearTimeout(t); res(m); }); });
        ws.json = (o) => ws.send(JSON.stringify(o));
        ws.on('open', () => resolve(ws));
        ws.on('error', reject);
    });
}

try {
    for (let i = 0; i < 40; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/healthz`); if (r.ok) break; } catch { await sleep(100); } }
    const health = await (await fetch(`http://127.0.0.1:${PORT}/healthz`)).json();
    assert.equal(health.ok, true);

    const a = await client(); a.json({ op: 'create' });
    const created = await a.next(); assert.equal(created.op, 'created'); assert.match(created.code, /^[A-Z0-9]{5}$/);

    const x = await client(); x.json({ op: 'join', code: 'ZZZZZ' });
    assert.deepEqual(await x.next(), { op: 'error', reason: 'sala-no-existe' }); x.close();

    const b = await client(); b.json({ op: 'join', code: created.code.toLowerCase() });
    assert.equal((await b.next()).op, 'joined');
    assert.deepEqual(await a.next(), { op: 'peer', state: 'joined' });

    const c = await client(); c.json({ op: 'join', code: created.code });
    assert.deepEqual(await c.next(), { op: 'error', reason: 'sala-llena' }); c.close();

    a.json({ op: 'msg', d: { type: 'chat', text: 'hola' } });
    assert.deepEqual(await b.next(), { op: 'msg', d: { type: 'chat', text: 'hola' } });
    b.json({ op: 'msg', d: { type: 'ls', upto: 5 } });
    assert.deepEqual(await a.next(), { op: 'msg', d: { type: 'ls', upto: 5 } });

    a.json({ op: 'create' });
    assert.deepEqual(await a.next(), { op: 'error', reason: 'ya-en-sala' });

    b.close(); // el invitado se va
    assert.deepEqual(await a.next(), { op: 'peer', state: 'left' });
    const b2 = await client(); b2.json({ op: 'join', code: created.code });
    assert.equal((await b2.next()).op, 'joined'); // puede volver a entrar
    assert.deepEqual(await a.next(), { op: 'peer', state: 'joined' });

    a.close(); // el creador se va: la sala se cierra
    assert.deepEqual(await b2.next(), { op: 'peer', state: 'left' });
    const d = await client(); d.json({ op: 'join', code: created.code });
    assert.deepEqual(await d.next(), { op: 'error', reason: 'sala-no-existe' });
    console.log('OK: servidor de salas — todas las pruebas pasan');
} catch (e) {
    console.error('FALLO:', e);
    process.exitCode = 1;
} finally {
    srv.kill();
    setTimeout(() => process.exit(process.exitCode ?? 0), 100);
}
