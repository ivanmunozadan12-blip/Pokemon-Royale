import { BALL_KINDS, CONFIG, RARITIES, RARITY_LABEL } from "../../config.js";
import { getSpecies } from "../../data/species.js";
import { ballIcon, coinIcon, fmt, h, hms, modal, pokeCard, rarityTag, spriteImg, toast } from "../dom.js";
export function bolasScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    const stage = h('div', { class: 'ballstage', id: 'ball-stage', 'aria-live': 'polite' });
    const list = h('div', { class: 'stack' });
    let busy = false;
    let skip = false;
    let wake = null;
    let alive = true;
    app.onLeave(() => { alive = false; skip = true; wake?.(); });
    const idle = (msg = 'Elige una Poké Ball para abrirla') => {
        stage.replaceChildren(h('div', { class: 'bigball', 'aria-hidden': 'true' }), h('div', { class: 'sub' }, msg));
    };
    /** Espera `ms` o hasta que el jugador pulse "saltar". */
    const sleep = (ms) => new Promise((res) => {
        if (skip)
            return res();
        const t = setTimeout(done, ms);
        function done() { clearTimeout(t); wake = null; res(); }
        wake = done;
    });
    const animate = async (o) => {
        skip = false;
        const sp = getSpecies(o.speciesId);
        const ball = h('div', { class: `bigball ball-${o.kind}` });
        stage.replaceChildren(ball, h('button', { class: 'btn btn-blue sm', type: 'button', id: 'skip-ball', on: { click: () => { skip = true; wake?.(); } } }, 'Saltar'));
        stage.onclick = () => { skip = true; wake?.(); };
        ball.classList.add('shake');
        for (let i = 0; i < 3 && !skip; i++) {
            app.audio.sfx('ballShake');
            await sleep(520);
        }
        if (!alive)
            return;
        app.audio.sfx('ballOpen');
        if (!skip) {
            stage.appendChild(h('div', { class: 'flash' }));
            await sleep(350);
        }
        if (!alive)
            return;
        stage.onclick = null;
        stage.className = `ballstage rar-${o.rarity}`;
        stage.replaceChildren(h('div', { class: 'reveal', id: 'ball-result' }, o.isNew && h('span', { class: 'newtag' }, '¡NUEVO!'), h('div', { class: 'rimg' }, spriteImg(sp.id, 'f', o.shiny ? 'shiny' : '')), o.shiny && h('div', { class: 'newtag shiny-tag' }, '✨ ¡SHINY! · Probabilidad especial'), h('div', { class: 'nm' }, sp.nameEs), h('div', { class: 'row' }, rarityTag(o.rarity), ...sp.types.map((t) => h('span', { class: 'tchip', style: `--tc:var(--r-${o.rarity})` }, t))), o.isNew ? h('div', { class: 'sub' }, 'Añadido a tu colección') : h('div', { class: 'stack', style: 'align-items:center' }, h('div', { class: 'row' }, 'Ya lo tenías: ', coinIcon(), h('b', null, `+${fmt(o.coins)} monedas`)), o.copies > 0 && h('div', { class: 'row', style: 'color:#ffe27a' }, `+${o.copies} copia${o.copies > 1 ? 's' : ''} para subir de nivel`, o.canUpgrade ? ' · ¡ya puedes mejorarlo!' : ''))));
        if (o.rarity === 'epico' || o.rarity === 'legendario')
            app.audio.sfx('rare');
        else if (o.isNew)
            app.audio.sfx('coin');
    };
    const open = async (kind) => {
        if (busy)
            return; // protege contra doble toque: una sola bola por apertura
        busy = true;
        drawList();
        const r = p.openBall(kind); // el resultado queda decidido y guardado ANTES de la animación
        if (!r.ok) {
            busy = false;
            toast('No tienes esa Poké Ball', 'err');
            drawList();
            return;
        }
        await animate(r.opening);
        busy = false;
        if (alive)
            drawList();
    };
    const openAll = async (kind) => {
        if (busy)
            return;
        busy = true;
        drawList();
        const res = [];
        for (let i = 0; i < 50; i++) {
            const r = p.openBall(kind);
            if (!r.ok)
                break;
            res.push(r.opening);
        }
        busy = false;
        idle(`Abiertas ${res.length} ${CONFIG.balls[kind].name}`);
        drawList();
        if (!res.length)
            return;
        const news = res.filter((r) => r.isNew);
        const coins = res.reduce((a, r) => a + r.coins, 0);
        if (res.some((r) => r.rarity === 'epico' || r.rarity === 'legendario'))
            app.audio.sfx('rare');
        modal(`Resultado de ${res.length} bolas`, h('div', { class: 'stack', id: 'open-all-result' }, h('div', null, `Nuevos Pokémon: ${news.length} · Duplicados: ${res.length - news.length} (+${fmt(coins)} monedas)`), h('div', { class: 'cards' }, res.map((r) => pokeCard(getSpecies(r.speciesId), { small: true, badge: r.shiny ? '✨ Shiny' : r.isNew ? 'Nuevo' : r.copies ? `+${r.copies} copias` : `+${r.coins}` })))), { wide: true });
    };
    const drawList = () => {
        list.replaceChildren(...BALL_KINDS.map((k) => {
            const n = p.data.balls[k];
            const b = CONFIG.balls[k];
            return h('div', { class: 'panel', data: { ball: k } }, h('div', { class: 'ball-card' }, h('span', { class: `ball-ico big-ball ball-${k}` }), h('div', { class: 'stack' }, h('div', { class: 'row between' }, h('b', { style: 'font-size:17px' }, b.name), h('b', { id: `count-${k}` }, `×${n}`)), h('div', { class: 'row' }, h('button', { class: 'btn btn-gold sm', type: 'button', disabled: n < 1 || busy, data: { open: k }, on: { click: () => void open(k) } }, 'Abrir'), h('button', { class: 'btn btn-blue sm', type: 'button', disabled: n < 2 || busy, on: { click: () => void openAll(k) } }, `Abrir todas (${Math.min(n, 50)})`), h('div', { class: 'stack', style: 'gap:4px' }, h('span', { class: 'shiny-odds-label' }, `✨ SHINY: ${k === 'master' ? '1 % (1 de cada 100)' : '0,15 % (1 de cada 667)'}`), h('div', { class: 'odds ball-odds' }, RARITIES.map((r) => h('div', { class: `rar-${r}` }, h('b', null, `${(b.odds[r] / 100).toFixed(b.odds[r] % 100 ? 2 : 0)} %`), RARITY_LABEL[r].split(' ')[0]))))))));
        }));
    };
    /* Poké Ball gratis con temporizador (se acumulan hasta el máximo). Las compradas con monedas siguen siendo instantáneas. */
    const freeBox = h('section', { class: 'panel free-ball', id: 'free-ball' });
    const drawFree = () => {
        const f = p.freeBallsState();
        const ready = f.stored > 0;
        freeBox.replaceChildren(h('div', { class: 'row', style: 'gap:8px' }, ballIcon('poke'), h('div', { class: 'stack', style: 'gap:0' }, h('b', null, 'Poké Ball gratis'), h('span', { class: 'sub', id: 'free-state' }, `${f.stored}/${f.max} listas · ${f.stored >= f.max ? 'almacén lleno' : `siguiente en `}`, f.stored < f.max && h('span', { class: 'timer', id: 'free-timer' }, hms(Math.ceil(f.msLeft / 1000)))))), h('button', { class: 'btn btn-green sm', type: 'button', id: 'free-claim', disabled: !ready || busy, on: { click: () => {
                    const r = p.claimFreeBall();
                    if (r.ok) {
                        app.audio.sfx('coin');
                        toast('+1 Poké Ball gratis', 'ok');
                    }
                    else
                        toast('Aún no está lista', 'err');
                } } }, ready ? 'Recoger' : 'En espera'));
    };
    const tick = setInterval(() => { if (alive) {
        const f = p.freeBallsState();
        const t = document.getElementById('free-timer');
        if (t)
            t.textContent = hms(Math.ceil(f.msLeft / 1000));
        if (f.stored !== lastStored)
            drawFree();
        lastStored = f.stored;
    } }, 1000);
    let lastStored = -1;
    app.onLeave(() => clearInterval(tick));
    idle();
    drawList();
    drawFree();
    app.watch(() => { if (!busy) {
        drawList();
        drawFree();
    } });
    root.append(h('h1', null, 'Poké Balls'), freeBox, h('section', { class: 'panel' }, stage), h('section', { class: 'stack' }, list), h('p', { class: 'sub' }, 'Las probabilidades de cada bola están en la Tienda. Si te toca un Pokémon repetido, recibes monedas y copias para subirlo de nivel. Cada 8 h se prepara una Poké Ball gratis (hasta 3 guardadas); las bolas compradas con monedas se abren al instante.'));
    void RARITY_LABEL;
    return root;
}
