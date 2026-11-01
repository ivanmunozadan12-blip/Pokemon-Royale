import { BALL_KINDS, CONFIG, RARITIES, RARITY_LABEL } from "../../config.js";
import { getSpecies } from "../../data/species.js";
import { ballIcon, coinIcon, fmt, h, pokeCard, toast } from "../dom.js";
export function tiendaScreen(app) {
    const p = app.profile;
    const root = h('div', { class: 'page' });
    const draw = () => {
        p.markShopSeen();
        root.replaceChildren();
        const d = p.data;
        root.append(h('h1', null, 'Tienda'), h('section', { class: 'panel' }, h('div', { class: 'row between' }, h('h3', null, 'Tu saldo'), h('b', { class: 'row', id: 'shop-coins', style: 'gap:6px;font-size:20px' }, coinIcon(), fmt(d.coins)))), h('section', { class: 'panel stack' }, h('h3', null, 'Poké Balls'), BALL_KINDS.map((k) => {
            const b = CONFIG.balls[k];
            const buy = (n) => {
                const r = p.buyBall(k, n);
                if (r.ok) {
                    app.audio.sfx('coin');
                    toast(`Comprado: ${n} × ${b.name} (−${fmt(r.spent)} monedas)`, 'ok');
                }
                else {
                    app.audio.sfx('error');
                    toast(r.reason === 'saldo' ? `No tienes suficientes monedas (faltan ${fmt(b.price * n - d.coins)})` : 'Cantidad no válida', 'err');
                }
            };
            return h('div', { class: 'panel', style: 'padding:10px', data: { ball: k } }, h('div', { class: 'ball-card' }, h('span', { class: `ball-ico big-ball ball-${k}` }), h('div', null, h('div', { class: 'row between' }, h('b', { style: 'font-size:17px' }, b.name), h('span', { class: 'row', style: 'gap:4px' }, coinIcon(), h('b', null, fmt(b.price))), h('span', { class: 'sub' }, `Tienes ${d.balls[k]}`)), h('div', { class: 'odds' }, RARITIES.map((r) => h('div', { class: `rar-${r}` }, h('b', null, `${(b.odds[r] / 100).toFixed(b.odds[r] % 100 ? 2 : 0)} %`), RARITY_LABEL[r].split(' ')[0]))))), h('div', { class: 'row', style: 'margin-top:8px' }, [1, 5, 10].map((n) => h('button', { class: 'btn btn-gold sm', type: 'button', data: { buy: `${k}:${n}` }, disabled: d.coins < b.price * n, on: { click: () => buy(n) } }, `×${n} · ${fmt(b.price * n)}`))));
        })), h('section', { class: 'panel stack', id: 'shop-offers' }, h('h3', null, 'Ofertas del día'), h('p', { class: 'sub' }, 'Seis ofertas que se renuevan cada día: 3 comunes, 2 poco comunes y 1 raro. Cada semana hay un 35 % de probabilidad de que una única oferta rara se sustituya por un épico; la semana y el día quedan fijados para evitar nuevos sorteos al recargar. No se venden legendarios. Si ya tienes el Pokémon, la compra te da copias para subirlo de nivel. Precios: común ' + fmt(CONFIG.dailyOffers.price.comun) + ' · poco común ' + fmt(CONFIG.dailyOffers.price.poco_comun) + ' · raro ' + fmt(CONFIG.dailyOffers.price.raro) + ' · épico ' + fmt(CONFIG.dailyOffers.price.epico) + ' monedas.'), h('div', { class: 'shop-grid', style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px' }, p.shopOffers().map((o) => {
            const sp = getSpecies(o.id);
            const why = o.bought ? 'Comprado ✓' : o.atMax ? 'Nivel máximo' : null;
            return h('div', { class: `shop-card stack rar-${o.rarity}`, style: 'gap:4px;align-items:center;min-width:0;display:flex;flex-direction:column', data: { offer: o.id, slot: o.index } }, pokeCard(sp, { small: true, disabled: true, badge: o.weekly ? 'Épico semanal' : undefined }), h('div', { class: 'sub', style: 'text-align:center' }, `${RARITY_LABEL[o.rarity]}${o.owned ? ` · ya lo tienes: +${o.copies} copia${o.copies === 1 ? '' : 's'}` : ' · nuevo'}`), h('button', { class: 'btn btn-gold sm', type: 'button', disabled: !!why || d.coins < o.price, data: { buy: o.index }, on: { click: () => {
                        const r = p.buyShop(o.index);
                        if (r.ok) {
                            app.audio.sfx('rare');
                            toast(r.isNew ? `¡${sp.nameEs} desbloqueado!` : `+${r.copies} copia${r.copies === 1 ? '' : 's'} de ${sp.nameEs}`, 'ok');
                        }
                        else {
                            app.audio.sfx('error');
                            toast(r.reason === 'saldo' ? 'No tienes suficientes monedas' : r.reason === 'nivel_max' ? 'Ya está al nivel máximo' : 'No disponible', 'err');
                        }
                    } } }, why ?? h('span', { class: 'row', style: 'gap:4px;justify-content:center' }, coinIcon(), fmt(o.price))));
        }))), h('section', { class: 'panel' }, h('h3', null, 'Recompensas y duplicados'), h('table', { class: 'table' }, h('tr', null, h('th', null, 'Resultado'), h('th', null, 'Monedas'), h('th', null, 'Poké Balls'), h('th', null, 'XP')), ['win', 'draw', 'loss'].map((k) => h('tr', null, h('td', null, k === 'win' ? 'Victoria' : k === 'draw' ? 'Empate' : 'Derrota'), h('td', null, String(CONFIG.rewards[k].coins)), h('td', null, ballIcon('poke'), ` ${CONFIG.rewards[k].balls}`), h('td', null, String(CONFIG.rewards[k].xp))))), h('p', { class: 'sub', style: 'margin-top:8px' }, 'Si una Poké Ball te da un Pokémon que ya tienes, se convierte en monedas:'), h('table', { class: 'table' }, RARITIES.map((r) => h('tr', null, h('td', null, RARITY_LABEL[r]), h('td', null, coinIcon(), ` ${fmt(CONFIG.duplicateCoins[r])}`))))));
    };
    draw();
    app.watch(draw);
    return root;
}
