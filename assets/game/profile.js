import { BALL_KINDS, CONFIG, DIFFICULTIES, RARITIES } from "../config.js";
import { ARENAS, arenaForTrophies, getArena } from "../data/arenas.js";
import { copiesNeeded, maxLevel, upgradeCoins } from "../data/levels.js";
import { SPECIES, getSpecies, hasSpecies } from "../data/species.js";
import { TRAIN_STATS, chosenStats, cleanLevels, trainingSummary } from "./training.js";
import { ITEM_BY_ID, ITEM_CATALOG } from "../data/items.js";
import { Rng } from "../sim/rng.js";
import { buildShop } from "./shop.js";
import { basicCandidates, basicLevelOf, specialCandidates, specialLevelOf } from "./learning.js";
import { HISTORY_MAX, MAX_DECKS, REWARDED_MAX, defaultSave, exportBackup, importBackup, loadSave, persistSave, sanitizeSave, } from "./save.js";
export function checkOdds(odds) {
    return RARITIES.reduce((a, r) => a + odds[r], 0);
}
/** Elige una rareza con las probabilidades en puntos básicos (suman 10000). */
export function rollRarity(odds, rand) {
    const total = checkOdds(odds);
    let x = rand() * total;
    for (const r of RARITIES) {
        if (odds[r] <= 0)
            continue;
        if (x < odds[r])
            return r;
        x -= odds[r];
    }
    for (let i = RARITIES.length - 1; i >= 0; i--)
        if (odds[RARITIES[i]] > 0)
            return RARITIES[i];
    return 'comun';
}
export function speciesOfRarity(r) {
    return SPECIES.filter((s) => s.rarity === r);
}
export function xpForNext(level) {
    // +35% de XP requerida: progresión más larga sin capar la experiencia de desafíos.
    return Math.ceil((CONFIG.level.xpBase + CONFIG.level.xpStep * (level - 1)) * 1.35);
}
export function levelInfo(xp) {
    let level = 1;
    let rest = xp;
    while (rest >= xpForNext(level) && level < 999) {
        rest -= xpForNext(level);
        level++;
    }
    return { level, into: rest, need: xpForNext(level) };
}
export function todayKey(d = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function weekKey(d) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
    const y = x.getUTCFullYear();
    const start = new Date(Date.UTC(y, 0, 1));
    const week = Math.ceil((((x.getTime() - start.getTime()) / 86400000) + 1) / 7);
    return `${y}-W${String(week).padStart(2, '0')}`;
}
function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++)
        h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}
export function secureRand() {
    const c = globalThis.crypto;
    if (c?.getRandomValues) {
        const a = new Uint32Array(1);
        c.getRandomValues(a);
        return a[0] / 4294967296;
    }
    return Math.random();
}
/**
 * Perfil del jugador: todo el estado persistente y sus reglas. Cada operación es SÍNCRONA y atómica
 * (comprueba, modifica y guarda de una vez), de modo que un doble toque no puede ejecutarla dos veces a medias.
 */
export class Profile {
    data;
    notices;
    fresh;
    kv;
    listeners = new Set();
    /** Si el guardado falla (almacenamiento lleno o bloqueado) se avisa una vez. */
    persistOk = true;
    constructor(kv) {
        this.kv = kv;
        if (kv) {
            const r = loadSave(kv);
            this.data = r.data;
            this.notices = r.notices;
            this.fresh = r.fresh;
            // Persistir inmediatamente cualquier migración detectada; persistSave conserva el guardado previo como backup.
            if (r.notices.some((n) => n.includes('Migración de trofeos') || n.includes('Trofeos migrados'))) {
                this.persistOk = persistSave(kv, this.data);
                if (!this.persistOk) this.notices.push('La migración se calculó, pero no se pudo guardar; exporta una copia antes de seguir.');
            }
        }
        else {
            this.data = defaultSave();
            this.notices = [];
            this.fresh = true;
        }
    }
    onChange(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }
    commit() {
        if (this.kv)
            this.persistOk = persistSave(this.kv, this.data);
        for (const f of this.listeners)
            f();
    }
    /* ───────── consultas ───────── */
    isUnlocked(id) {
        return this.data.unlocked.includes(id);
    }
    hasShiny(id) {
        return this.data.shinyIds.includes(id);
    }
    isShinySelected(id) {
        return this.data.shinySelected.includes(id);
    }
    toggleShiny(id) {
        if (!this.isUnlocked(id) || !this.hasShiny(id))
            return false;
        if (this.isShinySelected(id))
            this.data.shinySelected = this.data.shinySelected.filter((x) => x !== id);
        else
            this.data.shinySelected = [...this.data.shinySelected, id];
        this.commit();
        return this.isShinySelected(id);
    }
    wheelAvailable(now = Date.now()) {
        const w = this.data.dailyWheel || {};
        return w.claimedDay !== todayKey(new Date(now)) && (!w.lastClaimAt || now >= w.lastClaimAt + 20 * 60 * 60 * 1000);
    }
    claimDailyWheel(now = Date.now(), rand = secureRand) {
        if (!this.wheelAvailable(now)) return { ok: false, reason: 'recogida' };
        const prizes = [
            ...Array.from({length:8},(_,i)=>({type:'coins',amount:[50,75,100,125,150,200,250,300][i],weight:900})),
            ...Array.from({length:5},(_,i)=>({type:'ball',ball:['poke','poke','super','super','ultra'][i],amount:1,weight:[850,700,500,350,100][i]})),
            {type:'coins',amount:400,weight:350},{type:'coins',amount:600,weight:180},
            {type:'token',amount:1,weight:250},{type:'token',amount:2,weight:100},
            {type:'pokemon',rarity:'raro',weight:90},{type:'pokemon',rarity:'epico',weight:15},
            {type:'ball',ball:'ultra',amount:1,weight:30}
        ];
        const total=prizes.reduce((a,x)=>a+x.weight,0); let n=rand()*total, prize=prizes[0];
        for(const x of prizes){ if(n<x.weight){prize=x;break;} n-=x.weight; }
        let result={...prize};
        if(prize.type==='pokemon'){
            const pool=SPECIES.filter(x=>x.rarity===prize.rarity && !this.isUnlocked(x.id));
            const fallback=SPECIES.filter(x=>x.rarity==='raro' && !this.isUnlocked(x.id));
            const chosen=(pool.length?pool:fallback)[Math.floor(rand()*(pool.length?pool:fallback).length)];
            if(chosen){this.data.unlocked.push(chosen.id);this.data.unlocked.sort((a,b)=>a-b);this.data.obtained[String(chosen.id)]='ruleta';this.data.copies[String(chosen.id)]=(this.data.copies[String(chosen.id)]||0)+1;result.id=chosen.id;result.name=chosen.name;}
            else result={type:'coins',amount:500};
        }
        if(result.type==='coins') this.data.coins+=result.amount;
        if(result.type==='ball') this.data.balls[result.ball]=(this.data.balls[result.ball]||0)+result.amount;
        if(result.type==='token') this.data.slotTokens=Math.min(99,(this.data.slotTokens||0)+result.amount);
        this.data.dailyWheel={claimedDay:todayKey(new Date(now)),lastClaimAt:now,prize:result};
        this.commit(); return {ok:true,prize:result};
    }
    spinSlots(bet, now=Date.now(), rand=secureRand) {
        if(![50,100,250].includes(bet)) return {ok:false,reason:'apuesta'};
        const day=todayKey(new Date(now)); let d=this.data.slotsDaily;
        if(d.day!==day && (!d.lastSpinAt || now>=d.lastSpinAt+20*60*60*1000))d={...d,day,spins:0};
        if(d.spins>=20)return {ok:false,reason:'limite'};
        const useToken=(this.data.slotTokens||0)>0;
        if(!useToken && this.data.coins<bet)return {ok:false,reason:'saldo'};
        if(useToken)this.data.slotTokens--; else this.data.coins-=bet;
        const symbols=['poke','super','ultra','pikachu','coin','ticket'];
        const reels=Array.from({length:3},()=>symbols[Math.floor(rand()*symbols.length)]);
        const counts={}; for(const x of reels)counts[x]=(counts[x]||0)+1;
        let mult=0;
        if(counts.ticket===3)mult=7; else if(counts.ultra===3)mult=6;
        else if(counts.pikachu===3)mult=5; else if(counts.super===3)mult=4; else if(counts.poke===3||counts.coin===3)mult=3;
        else if(Object.values(counts).some(x=>x===2))mult=1.83;
        // Una ficha sustituye el coste de la apuesta, no anula los premios:
        // las combinaciones pagan la misma tabla tanto en tiradas pagadas como gratuitas.
        // Las monedas son enteras; se redondea hacia abajo el multiplicador 1,83.
        const payout=Math.floor(bet*mult);
        this.data.coins=Math.max(0, this.data.coins+payout);
        d.day=day; d.lastSpinAt=now; d.spins++; d.played++; if(payout>0)d.won++; d.best=Math.max(d.best,payout); this.data.slotsDaily=d;
        this.commit(); return {ok:true,reels,payout,net:useToken?payout:payout-bet,spinsLeft:20-d.spins,free:useToken};
    }
    claimProgressReward(key, coins, xp, resources = {}) {
        if (typeof key !== 'string' || !key || this.data.progressClaimed.includes(key)) return false;
        // Las recompensas se aplican en una única operación y quedan ligadas a una clave
        // de misión/temporada para impedir reclamaciones dobles tras refrescar la página.
        this.data.progressClaimed.push(key);
        if (this.data.progressClaimed.length > 500) this.data.progressClaimed.splice(0, this.data.progressClaimed.length - 500);
        this.data.coins += Math.max(0, Math.floor(coins));
        this.data.xp += Math.max(0, Math.floor(xp));
        const r = this.data.training.resources;
        for (const k of ['crystals', 'medals', 'cores']) r[k] = Math.min(999999, r[k] + Math.max(0, Math.floor(Number(resources[k]) || 0)));
        this.commit();
        return true;
    }
    /** Añade una copia al inventario; solo acepta IDs del catálogo oficial. */
    grantItem(itemId, count = 1) {
        if (!ITEM_BY_ID.has(itemId) || !Number.isInteger(count) || count < 1) return false;
        this.data.itemInventory ??= {};
        this.data.itemInventory[itemId] = Math.min(100000, (this.data.itemInventory[itemId] || 0) + count);
        this.commit();
        return true;
    }
    /** Un objeto global por mazo; la misma copia no puede equiparse en dos mazos. */
    equipItem(deckIndex, itemId, pokemonId) {
        const deck = this.data.decks[deckIndex];
        if (!deck) return { ok: false, reason: 'mazo' };
        if (!ITEM_BY_ID.has(itemId)) return { ok: false, reason: 'objeto' };
        if (!deck.ids.includes(Number(pokemonId))) return { ok: false, reason: 'pokemon' };
        if (deck.equippedItem) return { ok: false, reason: 'ocupado' };
        const owned = this.data.itemInventory?.[itemId] || 0;
        const used = this.data.decks.filter(d => d.equippedItem === itemId).length;
        if (used >= owned) return { ok: false, reason: 'inventario' };
        deck.equippedItem = itemId;
        deck.equippedPokemon = Number(pokemonId);
        this.commit();
        return { ok: true };
    }
    unequipItem(deckIndex) {
        const deck = this.data.decks[deckIndex];
        if (!deck || !deck.equippedItem) return false;
        deck.equippedItem = null;
        deck.equippedPokemon = null;
        this.commit();
        return true;
    }
    get level() {
        return levelInfo(this.data.xp).level;
    }
    /* ───────── niveles de Pokémon ───────── */
    levelOf(id) {
        return this.data.levels[String(id)] ?? 1;
    }
    copiesOf(id) {
        return this.data.copies[String(id)] ?? 0;
    }
    maxLevelOf(id) {
        return maxLevel(getSpecies(id));
    }
    /** Estado de la mejora de una carta: copias y monedas que pide y si se puede hacer ya. */
    upgradeInfo(id) {
        const level = this.levelOf(id);
        const max = this.maxLevelOf(id);
        const atMax = level >= max;
        const needCopies = copiesNeeded(level);
        const coins = upgradeCoins(getSpecies(id).rarity, level);
        const copies = this.copiesOf(id);
        return { level, max, atMax, copies, needCopies, coins, can: this.isUnlocked(id) && !atMax && copies >= needCopies && this.data.coins >= coins };
    }
    upgrade(id) {
        if (!this.isUnlocked(id))
            return { ok: false, reason: 'bloqueado' };
        const i = this.upgradeInfo(id);
        if (i.atMax)
            return { ok: false, reason: 'maximo' };
        if (i.copies < i.needCopies)
            return { ok: false, reason: 'copias' };
        if (this.data.coins < i.coins)
            return { ok: false, reason: 'saldo' };
        this.data.coins -= i.coins;
        const left = i.copies - i.needCopies;
        if (left > 0)
            this.data.copies[String(id)] = left;
        else
            delete this.data.copies[String(id)];
        this.data.levels[String(id)] = i.level + 1;
        this.commit();
        return { ok: true, level: i.level + 1 };
    }
    /** Niveles de las cartas de un mazo (para la partida). */
    deckLevels(ids = this.deck.ids) {
        const out = {};
        for (const id of ids)
            out[id] = this.levelOf(id);
        return out;
    }
    deckAvgLevel(ids = this.deck.ids) {
        if (!ids.length)
            return 1;
        return ids.reduce((a, id) => a + this.levelOf(id), 0) / ids.length;
    }
    /** Nivel de las torres: el del jugador (limitado), igual para los dos bandos. */
    get towerLevel() {
        return Math.min(CONFIG.towerLevels.max, this.level);
    }
    /* ───────── trofeos y arenas ───────── */
    get trophies() {
        return this.data.trophies;
    }
    unlockedArenas() {
        return ARENAS.filter((a) => this.data.trophies >= a.minTrophies);
    }
    /** Arena en la que se juega: la elegida (si sigue desbloqueada) o la mejor desbloqueada. */
    get currentArena() {
        const sel = this.data.arena;
        if (sel !== 'auto') {
            const a = getArena(sel);
            if (this.data.trophies >= a.minTrophies)
                return a;
        }
        return arenaForTrophies(this.data.trophies);
    }
    setArena(id) {
        if (id !== 'auto') {
            const a = ARENAS.find((x) => x.id === id);
            if (!a || this.data.trophies < a.minTrophies)
                return false;
        }
        this.data.arena = id;
        this.commit();
        return true;
    }
    /* ───────── bolas gratis con temporizador ───────── */
    /** Pone al día el temporizador. `now` en ms (inyectable para pruebas). */
    tickFree(now) {
        const f = this.data.freeBalls;
        const iv = CONFIG.freeBalls.intervalH * 3600_000;
        if (f.since <= 0 || f.since > now + 60_000) {
            // primera vez o reloj movido hacia atrás: el temporizador empieza ahora
            f.since = now;
            return;
        }
        if (f.stored >= CONFIG.freeBalls.max) {
            f.since = now;
            return;
        }
        while (f.stored < CONFIG.freeBalls.max && now - f.since >= iv) {
            f.stored++;
            f.since += iv;
        }
        if (f.stored >= CONFIG.freeBalls.max)
            f.since = now;
    }
    freeBallsState(now = Date.now()) {
        const before = JSON.stringify(this.data.freeBalls);
        this.tickFree(now);
        if (JSON.stringify(this.data.freeBalls) !== before)
            this.commit();
        const f = this.data.freeBalls;
        const iv = CONFIG.freeBalls.intervalH * 3600_000;
        return { stored: f.stored, max: CONFIG.freeBalls.max, msLeft: f.stored >= CONFIG.freeBalls.max ? 0 : Math.max(0, iv - (now - f.since)) };
    }
    /** Recoge una Poké Ball gratis lista. */
    claimFreeBall(now = Date.now()) {
        this.tickFree(now);
        const f = this.data.freeBalls;
        if (f.stored < 1)
            return { ok: false, reason: 'no_lista' };
        if (f.stored >= CONFIG.freeBalls.max)
            f.since = now;
        f.stored--;
        this.data.balls.poke += 1;
        this.commit();
        return { ok: true, kind: 'poke' };
    }
    get deck() {
        return this.data.decks[this.data.activeDeck];
    }
    deckValid(d = this.deck) {
        return deckError(d.ids, (id) => this.isUnlocked(id)) === null;
    }
    ballCount() {
        return BALL_KINDS.reduce((a, k) => a + this.data.balls[k], 0);
    }
    obtainText(id) {
        const o = this.data.obtained[String(id)];
        if (!this.isUnlocked(id))
            return 'Sin conseguir: Poké Balls o la oferta diaria de la tienda';
        if (o === 'inicial')
            return 'Pokémon inicial';
        if (o === 'oferta')
            return 'Comprado en la oferta diaria';
        if (o?.startsWith('bola:'))
            return `Sacado de una ${CONFIG.balls[o.slice(5)]?.name ?? 'Poké Ball'}`;
        return 'Conseguido';
    }
    /* ───────── mazos ───────── */
    /** Guarda inmediatamente los cambios del mazo (los borradores incompletos se guardan, pero no se pueden usar en batalla). */
    setDeckIds(index, ids) {
        const d = this.data.decks[index];
        if (!d)
            return { ok: false, reason: 'indice' };
        const uniq = [];
        for (const id of ids) {
            if (!this.isUnlocked(id))
                return { ok: false, reason: 'bloqueado' };
            if (uniq.includes(id))
                return { ok: false, reason: 'duplicado' };
            uniq.push(id);
        }
        if (uniq.length > CONFIG.battle.deckSize)
            return { ok: false, reason: 'lleno' };
        d.ids = uniq;
        this.commit();
        return { ok: true };
    }
    addToDeck(index, id) {
        const d = this.data.decks[index];
        if (!d)
            return { ok: false, reason: 'indice' };
        if (!this.isUnlocked(id))
            return { ok: false, reason: 'bloqueado' };
        if (d.ids.includes(id))
            return { ok: false, reason: 'duplicado' };
        if (d.ids.length >= CONFIG.battle.deckSize)
            return { ok: false, reason: 'lleno' };
        return this.setDeckIds(index, [...d.ids, id]);
    }
    removeFromDeck(index, id) {
        const d = this.data.decks[index];
        if (!d)
            return { ok: false, reason: 'indice' };
        return this.setDeckIds(index, d.ids.filter((x) => x !== id));
    }
    createDeck(name) {
        if (this.data.decks.length >= MAX_DECKS)
            return { ok: false, reason: 'limite' };
        this.data.decks.push({ name: (name ?? `Mazo ${this.data.decks.length + 1}`).slice(0, 24), ids: [] });
        this.commit();
        return { ok: true, index: this.data.decks.length - 1 };
    }
    renameDeck(index, name) {
        const d = this.data.decks[index];
        const n = name.trim().slice(0, 24);
        if (!d || !n)
            return false;
        d.name = n;
        this.commit();
        return true;
    }
    deleteDeck(index) {
        if (this.data.decks.length <= 1 || !this.data.decks[index])
            return false;
        this.data.decks.splice(index, 1);
        if (this.data.activeDeck >= this.data.decks.length)
            this.data.activeDeck = this.data.decks.length - 1;
        else if (this.data.activeDeck > index)
            this.data.activeDeck--;
        this.commit();
        return true;
    }
    setActiveDeck(index) {
        if (!this.data.decks[index])
            return false;
        this.data.activeDeck = index;
        this.commit();
        return true;
    }
    /* ───────── partidas y recompensas ───────── */
    /**
     * Aplica el resultado de una partida contra la IA UNA sola vez (se identifica por `matchId`).
     * El entrenamiento no pasa por aquí: no toca monedas, bolas ni estadísticas competitivas.
     */
    applyMatch(result) {
        const none = { coins: 0, balls: 0, xp: 0, trophies: 0 };
        if (result.mode === 'draft')
            return this.applyDraftMatch(result);
        if (result.mode !== 'normal')
            return { applied: false, reward: none };
        if (this.data.rewarded.includes(result.matchId))
            return { applied: false, reward: none };
        const outcome = result.winner === 0 ? 'win' : result.winner === 1 ? 'loss' : 'draw';
        // La dificultad procede de la configuración efectiva de la partida; no se aceptan etiquetas arbitrarias.
        const difficulty = DIFFICULTIES.includes(result.difficulty) ? result.difficulty : this.data.settings.difficulty;
        let itemDrop = null;
        const R = CONFIG.rewards[outcome === 'win' ? 'win' : outcome === 'loss' ? 'loss' : 'draw'];
        const s = this.data.stats;
        this.data.rewarded.push(result.matchId);
        if (this.data.rewarded.length > REWARDED_MAX)
            this.data.rewarded.splice(0, this.data.rewarded.length - REWARDED_MAX);
        const activeDeck = this.data.decks[this.data.activeDeck];
        const dayKey = todayKey();
        const dailyCoins = this.data.battleCoinDaily ?? (this.data.battleCoinDaily = { day: dayKey, earned: 0 });
        if (dailyCoins.day !== dayKey) { dailyCoins.day = dayKey; dailyCoins.earned = 0; }
        const requestedCoins = activeDeck?.equippedItem === 'amulet_coin' ? Math.round(R.coins * 1.1) : R.coins;
        const coinReward = Math.min(requestedCoins, Math.max(0, CONFIG.dailyBattleCoinCap - dailyCoins.earned));
        dailyCoins.earned = Math.min(CONFIG.dailyBattleCoinCap, dailyCoins.earned + coinReward);
        this.data.coins += coinReward;
        this.data.balls.poke += R.balls;
        if (outcome === 'win') { this.data.training.resources.crystals = Math.min(999999, this.data.training.resources.crystals + 1); if ((s.wins + 1) % 5 === 0) this.data.training.resources.medals = Math.min(999999, this.data.training.resources.medals + 1); if ((s.wins + 1) % 20 === 0) this.data.training.resources.cores = Math.min(999999, this.data.training.resources.cores + 1); }
        this.data.xp += R.xp;
        const tr = outcome === 'win' ? CONFIG.trophies.win[difficulty] : outcome === 'loss' ? CONFIG.trophies.loss[difficulty] : CONFIG.trophies.draw;
        const before = this.data.trophies;
        this.data.trophies = Math.max(0, Math.min(CONFIG.trophies.maxPerGeneration, before + tr));
        const trophyDelta = this.data.trophies - before;
        this.data.bestTrophies = Math.max(this.data.bestTrophies, this.data.trophies);
        this.data.bestTrophies = Math.min(CONFIG.trophies.maxPerGeneration, this.data.bestTrophies);
        this.data.trophyVersion = CONFIG.trophies.version;
        this.data.activeGeneration = 'kanto';
        this.data.generationProgress ??= {};
        this.data.generationProgress.kanto = { trophies: this.data.trophies, bestTrophies: this.data.bestTrophies };
        s.played++;
        if (outcome === 'win')
            s.wins++;
        else if (outcome === 'loss')
            s.losses++;
        else
            s.draws++;
        s.towersDestroyed += result.crowns[0];
        s.timeSec += result.durationSec;
        s.coinsEarned += coinReward;
        s.ballsEarned += R.balls;
        for (const [k, n] of Object.entries(result.usage))
            s.usage[k] = (s.usage[k] ?? 0) + n;
        for (const [k, n] of Object.entries(result.kills))
            s.kills[k] = (s.kills[k] ?? 0) + n;
        const rec = {
            id: result.matchId, at: new Date().toISOString(), outcome, crowns: [result.crowns[0], result.crowns[1]], reason: result.reason,
            durationSec: result.durationSec, difficulty, mode: result.mode ?? 'normal', deck: result.deckPlayer.slice(), coins: coinReward, balls: R.balls,
            trophiesBefore: before, trophies: trophyDelta, trophiesAfter: this.data.trophies, trophyVersion: CONFIG.trophies.version,
            generation: 'kanto', trophyApplied: true, migrationApproximate: false,
            arena: result.arena ?? '', overtime: !!result.overtime,
        };
        s.history.unshift(rec);
        if (s.history.length > HISTORY_MAX)
            s.history.length = HISTORY_MAX;
        const pc = this.data.progressCounters;
        const now = new Date();
        const day = todayKey(now);
        const week = weekKey(now);
        const month = day.slice(0, 7);
        if (pc.day !== day) {
            pc.day = day;
            pc.dailyPlayed = 0;
            pc.dailyWins = 0;
        }
        if (pc.week !== week) {
            pc.week = week;
            pc.weeklyPlayed = 0;
            pc.weeklyWins = 0;
        }
        if (pc.month !== month) {
            pc.month = month;
            pc.monthlyPlayed = 0;
            pc.monthlyWins = 0;
        }
        pc.dailyPlayed++;
        pc.weeklyPlayed++;
        pc.monthlyPlayed++;
        if (outcome === 'win') {
            pc.dailyWins++;
            pc.weeklyWins++;
            pc.monthlyWins++;
        }
        // Cada rareza progresa de forma independiente: victoria +1, empate +0,75 y derrota +0,5.
        // Al obtener un objeto solo se descuenta el umbral de ESA rareza; los otros contadores no se reinician.
        const progressGain = CONFIG.items.points[outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'loss'];
        this.data.itemProgress ??= { poco_comun: 0, raro: 0, epico: 0 };
        const thresholds = CONFIG.items.thresholds;
        const itemDrops = [];
        for (const rarity of ['poco_comun', 'raro', 'epico']) {
            this.data.itemProgress[rarity] = Math.max(0, (this.data.itemProgress[rarity] || 0) + progressGain);
            // Use while, not a shared break: each rarity can award independently and retains its own remainder.
            while (this.data.itemProgress[rarity] >= thresholds[rarity]) {
                this.data.itemProgress[rarity] -= thresholds[rarity];
                const pool = ITEM_CATALOG.filter(x => x.rarity === rarity);
                if (!pool.length) break;
                const index = hashStr(String(result.matchId) + ':' + rarity + ':' + itemDrops.length) % pool.length;
                const drop = pool[index];
                itemDrops.push(drop);
                this.data.itemInventory[drop.id] = Math.min(100000, (this.data.itemInventory[drop.id] || 0) + 1);
            }
        }
        itemDrop = itemDrops[0] ?? null; // Compatibilidad con pantallas/integraciones antiguas.
        this.commit();
        return { applied: true, reward: { coins: coinReward, coinsRequested: requestedCoins, dailyCoinsEarned: dailyCoins.earned, dailyCoinsCap: CONFIG.dailyBattleCoinCap, balls: R.balls, xp: R.xp, trophies: trophyDelta, itemDrop, itemDrops } };
    }
    /**
     * Resultado de un modo Draft: NUNCA toca trofeos, misiones, objetos ni recursos de entrenamiento.
     * Recompensa = fracción de la normal, una sola vez por partida (`rewarded`), con tope diario propio de monedas.
     */
    applyDraftMatch(result) {
        const none = { coins: 0, balls: 0, xp: 0, trophies: 0, draft: true };
        if (this.data.rewarded.includes(result.matchId))
            return { applied: false, reward: none };
        const outcome = result.winner === 0 ? 'win' : result.winner === 1 ? 'loss' : 'draw';
        const R = CONFIG.rewards[outcome];
        const F = CONFIG.draftRewards;
        this.data.rewarded.push(result.matchId);
        if (this.data.rewarded.length > REWARDED_MAX)
            this.data.rewarded.splice(0, this.data.rewarded.length - REWARDED_MAX);
        const d = this.data.draft;
        const dayKey = todayKey();
        if (d.day !== dayKey) { d.day = dayKey; d.earned = 0; }
        const coins = Math.min(Math.round(R.coins * F.fraction), Math.max(0, F.dailyCoinCap - d.earned));
        const xp = Math.round(R.xp * F.fraction);
        d.earned += coins;
        d.ballAcc += R.balls * F.fraction;
        let balls = 0;
        while (d.ballAcc >= 1) { d.ballAcc -= 1; balls++; }
        this.data.coins += coins;
        this.data.balls.poke += balls;
        this.data.xp += xp;
        d.played++;
        if (outcome === 'win') d.wins++; else if (outcome === 'loss') d.losses++; else d.draws++;
        const id = String(result.draftMode ?? 'draft');
        const m = d.byMode[id] ?? (d.byMode[id] = { played: 0, wins: 0 });
        m.played++;
        if (outcome === 'win') m.wins++;
        this.commit();
        return { applied: true, reward: { coins, balls, xp, trophies: 0, draft: true, dailyCoinsEarned: d.earned, dailyCoinsCap: F.dailyCoinCap } };
    }
    /* ───────── aprendizaje de ataques (reglas en game/learning.js) ───────── */
    /** Estado de un hueco ('basic' | 'special'): nivel requerido, si ya se decidió, ataque elegido y candidatos reales. */
    learnInfo(id, slot) {
        const m = this.data.moves[String(id)] ?? {};
        const isBasic = slot === 'basic';
        const need = isBasic ? basicLevelOf(id) : specialLevelOf(id);
        const level = this.levelOf(id);
        const done = isBasic ? m.doneBasic === true : m.doneSpecial === true;
        const candidates = isBasic ? basicCandidates(id) : specialCandidates(id);
        const reached = this.isUnlocked(id) && level >= need;
        return { slot, need, level, reached, done, chosen: (isBasic ? m.basic : m.special) ?? null, candidates, pending: reached && !done && candidates.length > 0 };
    }
    /** ¿Tiene este Pokémon una decisión de ataque pendiente? (punto rojo) */
    learnPending(id) {
        return this.learnInfo(id, 'basic').pending || this.learnInfo(id, 'special').pending;
    }
    pendingLearning() {
        return this.data.unlocked.filter((id) => this.learnPending(id));
    }
    /** Elige un candidato (`choice` = id de movimiento o nombre) o lo rechaza todo (`choice` = null). La decisión es definitiva. */
    learnMove(id, slot, choice) {
        const info = this.learnInfo(id, slot);
        if (!this.isUnlocked(id))
            return { ok: false, reason: 'bloqueado' };
        if (!info.reached)
            return { ok: false, reason: 'nivel' };
        if (info.done)
            return { ok: false, reason: 'ya_decidido' };
        const key = String(id);
        const e = this.data.moves[key] ?? { basic: null, special: null, doneBasic: false, doneSpecial: false };
        if (choice !== null) {
            const ok = slot === 'basic' ? info.candidates.some((c) => c.id === choice) : info.candidates.some((c) => c.name === choice);
            if (!ok)
                return { ok: false, reason: 'candidato' };
        }
        if (slot === 'basic') {
            e.basic = choice;
            e.doneBasic = true;
        }
        else {
            e.special = choice;
            e.doneSpecial = true;
        }
        this.data.moves[key] = e;
        this.commit();
        return { ok: true };
    }
    /** Ataques aprendidos de un mazo en el formato que entiende la simulación: { [id]: { basic, special } }. */
    deckMoves(ids = this.deck.ids) {
        const out = {};
        for (const id of ids) {
            const m = this.data.moves[String(id)];
            if (m && (m.basic !== null || m.special !== null))
                out[String(id)] = { basic: m.basic, special: m.special };
        }
        return out;
    }
    /** Estado de entrenamiento de un Pokémon (puntos, estadísticas elegidas/bloqueadas y coste de cada intento). */
    trainingState(id) {
        const sp = getSpecies(id);
        return trainingSummary(sp, this.data.training.stats[String(id)], this.data.training.chosen?.[String(id)]);
    }
    /** Información de UNA estadística: coste, probabilidad y si se puede entrenar ahora mismo (y, si no, por qué). */
    trainingInfo(id, stat) {
        const st = this.trainingState(id);
        const row = st.stats.find((x) => x.stat === stat);
        const res = this.data.training.resources;
        if (!row)
            return { ok: false, reason: 'estadistica' };
        let reason = null;
        if (!this.isUnlocked(id))
            reason = 'pokemon';
        else if (row.maxed)
            reason = 'max';
        else if (row.locked)
            reason = 'bloqueada';
        else if (this.data.coins < row.cost.coins)
            reason = 'coins';
        else if (res.crystals < row.cost.crystals)
            reason = 'crystals';
        else if (res.medals < row.cost.medals)
            reason = 'medals';
        else if (res.cores < row.cost.cores)
            reason = 'cores';
        return { ok: true, level: row.level, max: row.max, base: row.base, bonus: row.bonus, cost: row.cost, chance: row.chance, locked: row.locked, maxed: row.maxed, reason, can: reason === null };
    }
    /**
     * Un intento de entrenamiento (síncrono y atómico: comprueba, cobra UNA vez, tira el dado y guarda).
     * El tope de puntos, el límite de estadísticas y los costes se validan aquí, no en la interfaz.
     * `rand` es inyectable para las pruebas.
     */
    trainStat(id, stat, rand = secureRand) {
        if (!TRAIN_STATS.includes(stat) || !hasSpecies(id))
            return { ok: false, reason: 'estadistica' };
        const info = this.trainingInfo(id, stat);
        if (!info.ok || info.reason)
            return { ok: false, reason: info.reason ?? 'estadistica' };
        const { coins, crystals, medals, cores } = info.cost;
        const res = this.data.training.resources;
        this.data.coins -= coins;
        res.crystals -= crystals;
        res.medals -= medals;
        res.cores -= cores;
        // La estadística queda elegida al pagar el primer intento (aunque falle): así las otras quedan bloqueadas de forma persistente.
        const key = String(id);
        const levels = cleanLevels(this.data.training.stats[key]);
        const chosen = chosenStats(levels, this.data.training.chosen?.[key]);
        if (!chosen.includes(stat))
            chosen.push(stat);
        this.data.training.chosen ??= {};
        this.data.training.chosen[key] = chosen;
        const success = rand() < info.chance;
        if (success) {
            levels[stat] = Math.min(CONFIG.training.maxLevel, levels[stat] + 1);
            this.data.training.stats[key] = levels;
        }
        else if (!this.data.training.stats[key])
            this.data.training.stats[key] = levels;
        this.commit();
        return { ok: true, success, level: levels[stat], chance: info.chance, spent: { coins, crystals, medals, cores } };
    }
    /** Recompensas gratuitas para entrenamiento permanente, ligadas a hitos reales de partida. */
    grantTrainingResources(result) {
        if (!result || result.mode !== 'normal') return;
        const r = this.data.training.resources;
        if (result.winner === 0) { r.crystals += 1; if ((this.data.stats.wins + 1) % 5 === 0) r.medals += 1; if ((this.data.stats.wins + 1) % 20 === 0) r.cores += 1; }
        this.commit();
    }
    /** El entrenamiento solo suma sus propios contadores (separados de las estadísticas competitivas). */
    recordTraining(seconds) {
        if (!(seconds > 1))
            return;
        this.data.stats.trainingSessions++;
        this.data.stats.trainingTimeSec += Math.min(seconds, 36000);
        this.commit();
    }
    /* ───────── tienda y bolas ───────── */
    buyBall(kind, qty = 1) {
        if (!Number.isInteger(qty) || qty < 1 || qty > 99)
            return { ok: false, reason: 'cantidad' };
        const cost = CONFIG.balls[kind].price * qty;
        if (this.data.coins < cost)
            return { ok: false, reason: 'saldo' };
        this.data.coins -= cost;
        this.data.balls[kind] += qty;
        this.commit();
        return { ok: true, spent: cost };
    }
    /**
     * Abre UNA bola. El resultado queda decidido y guardado aquí, antes de cualquier animación:
     * la animación solo lo muestra. Consume la bola y aplica el desbloqueo o la conversión en una sola operación.
     */
    openBall(kind, rand = secureRand) {
        if (this.data.balls[kind] < 1)
            return { ok: false, reason: 'sin_bolas' };
        const rarity = rollRarity(CONFIG.balls[kind].odds, rand);
        const pool = speciesOfRarity(rarity);
        const sp = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
        const isNew = !this.isUnlocked(sp.id);
        const shinyChance = kind === 'master' ? 0.01 : 0.0015;
        const shiny = rand() < shinyChance;
        if (shiny && !this.data.shinyIds.includes(sp.id))
            this.data.shinyIds.push(sp.id);
        this.data.balls[kind] -= 1;
        let coins = 0;
        let copies = 0;
        if (isNew) {
            this.data.unlocked.push(sp.id);
            this.data.unlocked.sort((a, b) => a - b);
            this.data.obtained[String(sp.id)] = `bola:${kind}`;
        }
        else {
            coins = CONFIG.duplicateCoins[sp.rarity];
            this.data.coins += coins;
            if (this.levelOf(sp.id) < this.maxLevelOf(sp.id)) {
                copies = CONFIG.cardLevels.dupCopies[sp.rarity];
                this.data.copies[String(sp.id)] = this.copiesOf(sp.id) + copies;
            }
        }
        this.commit();
        return { ok: true, opening: { kind, speciesId: sp.id, rarity: sp.rarity, isNew, coins, copies, level: this.levelOf(sp.id), canUpgrade: !isNew && this.levelOf(sp.id) < this.maxLevelOf(sp.id) && this.copiesOf(sp.id) >= copiesNeeded(this.levelOf(sp.id)), shiny } };
    }
    /* ───────── tienda diaria (6 ofertas) y regalo ───────── */
    /**
     * Día efectivo de la tienda: nunca retrocede. Si el reloj del móvil se atrasa, se sigue usando el último día visto,
     * así que cambiar la hora no regenera ofertas ni permite volver a comprar.
     */
    effectiveDay(now = new Date()) {
        const today = todayKey(now);
        const last = this.data.clock.lastDay;
        return last && last > today ? last : today;
    }
    /** Fija el día y reinicia las compras al cambiar de día. Devuelve el día efectivo. */
    ensureShop(now = new Date()) {
        const day = this.effectiveDay(now);
        let changed = false;
        if (this.data.clock.lastDay !== day) {
            this.data.clock.lastDay = day;
            changed = true;
        }
        if (this.data.shop.day !== day) {
            this.data.shop = { day, bought: [], seen: this.data.shop.seen };
            changed = true;
        }
        if (changed)
            this.commit();
        return day;
    }
    /** Marca las ofertas de hoy como vistas (quita el punto rojo de la Tienda). */
    markShopSeen(now = new Date()) {
        const day = this.ensureShop(now);
        if (this.data.shop.seen !== day) {
            this.data.shop.seen = day;
            this.commit();
        }
    }
    shopUnseen(now = new Date()) {
        return this.data.shop.seen !== this.effectiveDay(now);
    }
    /** Las 6 ofertas del día con su estado actual. */
    shopOffers(now = new Date()) {
        const day = this.ensureShop(now);
        return buildShop(day).map((o, index) => {
            const owned = this.isUnlocked(o.id);
            const atMax = owned && this.levelOf(o.id) >= this.maxLevelOf(o.id);
            return { ...o, index, owned, atMax, copies: owned && !atMax ? CONFIG.cardLevels.dupCopies[o.rarity] : 0, bought: this.data.shop.bought.includes(index), weekly: o.rarity === 'epico' };
        });
    }
    /** Compra la oferta `index` (0-5): Pokémon nuevo si no lo tienes; si ya lo tienes, copias para subirlo de nivel. */
    buyShop(index, now = new Date()) {
        const offers = this.shopOffers(now);
        const o = offers[index];
        if (!o)
            return { ok: false, reason: 'no_oferta' };
        if (o.bought)
            return { ok: false, reason: 'ya_comprado' };
        if (o.atMax)
            return { ok: false, reason: 'nivel_max' };
        if (this.data.coins < o.price)
            return { ok: false, reason: 'saldo' };
        this.data.coins -= o.price;
        if (!o.owned) {
            this.data.unlocked.push(o.id);
            this.data.unlocked.sort((a, b) => a - b);
            this.data.obtained[String(o.id)] = 'oferta';
        }
        else
            this.data.copies[String(o.id)] = this.copiesOf(o.id) + o.copies;
        this.data.shop.bought.push(index);
        this.commit();
        return { ok: true, isNew: !o.owned, copies: o.copies, id: o.id, price: o.price };
    }
    giftAvailable(day = todayKey()) {
        return this.data.lastGiftDay !== day;
    }
    claimGift(day = todayKey()) {
        if (!this.giftAvailable(day))
            return { ok: false, reason: 'ya_recogido' };
        this.data.lastGiftDay = day;
        this.data.coins += 100;
        this.data.balls.poke += 1;
        this.commit();
        return { ok: true, coins: 100, balls: 1 };
    }
    /* ───────── ajustes y copias ───────── */
    updateSettings(patch) {
        this.data.settings = sanitizeSave({ ...this.data, settings: { ...this.data.settings, ...patch } }).data.settings;
        this.commit();
    }
    exportJson() {
        return exportBackup(this.data);
    }
    importJson(text) {
        const r = importBackup(text);
        if (!r.ok)
            return r;
        let needsTrophyMigration = false;
        try {
            const parsed = JSON.parse(text);
            needsTrophyMigration = !Number.isInteger(parsed?.data?.trophyVersion) || parsed.data.trophyVersion < CONFIG.trophies.version;
        } catch { /* importBackup ya valida JSON */ }
        if (needsTrophyMigration && this.kv) {
            try {
                // Copia exacta del archivo importado, anterior a su transformación.
                this.kv.setItem(`${CONFIG.save.key}:trophy-migration-backup`, text);
            } catch {
                return { ok: false, error: 'No se pudo guardar una copia de la partida antigua; no se ha importado nada. Libera espacio o exporta el archivo original y vuelve a intentarlo.' };
            }
        }
        const previousData = this.data;
        this.data = r.data;
        if (this.kv) {
            this.persistOk = persistSave(this.kv, this.data);
            if (!this.persistOk) {
                this.data = previousData;
                return { ok: false, error: 'No se pudo guardar la partida importada. El progreso actual no se ha reemplazado; libera espacio y vuelve a intentarlo.' };
            }
        }
        for (const listener of this.listeners) listener();
        return { ok: true, repaired: r.repaired };
    }
    hasTrophyMigrationBackup() {
        try {
            if (!this.kv) return false;
            if (this.kv.getItem(`${CONFIG.save.key}:trophy-migration-backup`)) return true;
            return ['exact', 'approximate'].includes(this.data.trophyMigration?.quality) && !!this.kv.getItem(CONFIG.save.backupKey);
        } catch { return false; }
    }
    exportTrophyMigrationBackup() {
        try {
            if (!this.kv) return null;
            const imported = this.kv.getItem(`${CONFIG.save.key}:trophy-migration-backup`);
            if (imported) return imported;
            if (!['exact', 'approximate'].includes(this.data.trophyMigration?.quality)) return null;
            const previous = this.kv.getItem(CONFIG.save.backupKey);
            if (!previous) return null;
            // El backup automático contiene el objeto SaveData previo; envolverlo para que pueda reimportarse.
            return exportBackup(JSON.parse(previous));
        } catch { return null; }
    }
    /** Reinicio completo (la interfaz pide confirmación antes de llamarlo). Conserva los ajustes de sonido y vista. */
    resetProgress(keepSettings = true) {
        const settings = this.data.settings;
        this.data = defaultSave();
        if (keepSettings)
            this.data.settings = settings;
        this.commit();
    }
}
/** Valida un mazo: exactamente 8, sin repetidos, todos desbloqueados. null = válido. */
export function deckError(ids, unlocked) {
    if (ids.length !== CONFIG.battle.deckSize)
        return 'incompleto';
    if (new Set(ids).size !== ids.length)
        return 'duplicado';
    if (!ids.every(unlocked))
        return 'bloqueado';
    return null;
}
export function avgCost(ids) {
    if (!ids.length)
        return 0;
    return Math.round((ids.reduce((a, id) => a + getSpecies(id).cost, 0) / ids.length) * 10) / 10;
}
