import { BALL_KINDS, CONFIG, DIFFICULTIES, RARITIES } from "../config.js";
import { ARENAS, GENERATIONS, GENERATION_BY_ID } from "../data/arenas.js";
import { maxLevel } from "../data/levels.js";
import { getSpecies, hasSpecies } from "../data/species.js";
import { ITEM_BY_ID } from "../data/items.js";
import { TRAIN_STATS, chosenStats, cleanLevels } from "./training.js";
/**
 * Guardado local versionado (localStorage). Todo lo que entra o sale pasa por `sanitizeSave`:
 * nunca se confía en datos guardados ni importados.
 */
export const SAVE_SCHEMA = CONFIG.save.schema;
export const TROPHY_PROGRESS_VERSION = CONFIG.trophies.version ?? 2;
export const MAX_DECKS = 5;
export const HISTORY_MAX = 20;
export const REWARDED_MAX = 60;
export function defaultSettings() {
    return {
        musicOn: true, sfxOn: true, musicVol: 0.5, sfxVol: 0.8, reduceFx: false, vibration: true, shake: true,
        quality: 'alta', difficulty: CONFIG.start.difficulty, playerName: 'Entrenador', notify: false,
    };
}
export function defaultStats() {
    return {
        played: 0, wins: 0, losses: 0, draws: 0, towersDestroyed: 0, timeSec: 0, coinsEarned: 0, ballsEarned: 0,
        usage: {}, kills: {}, history: [], trainingSessions: 0, trainingTimeSec: 0,
    };
}
export function defaultSave() {
    const S = CONFIG.start;
    const obtained = {};
    for (const id of S.unlocked)
        obtained[String(id)] = 'inicial';
    return {
        schema: SAVE_SCHEMA,
        coins: S.coins,
        balls: { ...S.balls },
        unlocked: [...S.unlocked].sort((a, b) => a - b),
        decks: [{ name: 'Mazo 1', ids: [...S.deck], equippedItem: null, equippedPokemon: null }],
        itemInventory: {},
        itemProgress: { poco_comun: 0, raro: 0, epico: 0 },
        activeDeck: 0,
        xp: 0,
        levels: {},
        copies: {},
        trophies: 0,
        bestTrophies: 0,
        trophyVersion: TROPHY_PROGRESS_VERSION,
        activeGeneration: 'kanto',
        generationProgress: { kanto: { trophies: 0, bestTrophies: 0 } },
        trophyMigration: { version: TROPHY_PROGRESS_VERSION, quality: 'native', events: 0, migratedAt: '' },
        arena: 'auto',
        freeBalls: { stored: 1, since: 0 },
        stats: defaultStats(),
        settings: defaultSettings(),
        rewarded: [],
        daily: { day: '', ids: [], bought: [] },
        shop: { day: '', bought: [], seen: '' },
        clock: { lastDay: '' },
        draft: { played: 0, wins: 0, losses: 0, draws: 0, day: '', earned: 0, ballAcc: 0, byMode: {} },
        battleCoinDaily: { day: '', earned: 0 },
        lastGiftDay: '',
        dailyWheel: { claimedDay: '', lastClaimAt: 0, prize: null },
        slotTokens: 0,
        slotsDaily: { day: '', spins: 0, played: 0, won: 0, best: 0, lastSpinAt: 0 },
        obtained,
        shinyIds: [],
        shinySelected: [],
        training: { stats: {}, chosen: {}, resources: { crystals: 0, medals: 0, cores: 0 } },
        /** Ataques aprendidos por Pokémon: { basic: id|null, special: nombre|null, doneBasic, doneSpecial } (ver game/learning.js). */
        moves: {},
        progressClaimed: [],
        progressCounters: { day: '', dailyPlayed: 0, dailyWins: 0, week: '', weeklyPlayed: 0, weeklyWins: 0, month: '', monthlyPlayed: 0, monthlyWins: 0 },
        storyProgress: { chapter: 0, stage: 0, completed: [], medals: [] },
        tournamentProgress: null,
        aiMemory: { lanes: [0,0], types: {}, games: 0 },
        savedAt: '',
    };
}
/* ───────── utilidades de validación ───────── */
const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v, def, lo, hi) => typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
const int = (v, def, lo, hi) => Math.round(num(v, def, lo, hi));
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const str = (v, def, max = 60) => (typeof v === 'string' ? v.slice(0, max) : def);
const validId = (v) => typeof v === 'number' && Number.isInteger(v) && hasSpecies(v);
function counter(v) {
    const out = {};
    if (!isObj(v))
        return out;
    for (const [k, n] of Object.entries(v)) {
        const id = Number(k);
        if (Number.isInteger(id) && hasSpecies(id) && typeof n === 'number' && Number.isFinite(n) && n > 0)
            out[k] = Math.min(1e9, Math.floor(n));
    }
    return out;
}
/** Migra y valida un objeto cualquiera hasta convertirlo en un SaveData seguro. */
export function sanitizeSave(raw) {
    const repaired = [];
    const base = defaultSave();
    if (!isObj(raw))
        return { data: base, repaired: ['datos no válidos: se usan valores por defecto'] };
    const migrated = migrate(raw, repaired);
    const trophyMigration = migrateTrophyProgress(migrated, repaired);
    migrated.trophies = trophyMigration.trophies;
    migrated.bestTrophies = trophyMigration.bestTrophies;
    migrated.trophyVersion = TROPHY_PROGRESS_VERSION;
    migrated.activeGeneration = trophyMigration.activeGeneration;
    migrated.generationProgress = trophyMigration.generationProgress;
    migrated.trophyMigration = trophyMigration.migration;
    if (isObj(migrated.stats)) migrated.stats = { ...migrated.stats, history: trophyMigration.history };
    const d = defaultSave();
    d.coins = int(migrated.coins, base.coins, 0, 1e9);
    const balls = isObj(migrated.balls) ? migrated.balls : {};
    for (const k of BALL_KINDS)
        d.balls[k] = int(balls[k], 0, 0, 1e6);
    if (!isObj(migrated.balls)) {
        d.balls = { ...base.balls };
        repaired.push('Poké Balls restauradas');
    }
    const unlockedRaw = Array.isArray(migrated.unlocked) ? migrated.unlocked : [];
    const unlocked = [...new Set(unlockedRaw.filter(validId))].sort((a, b) => a - b);
    if (unlocked.length === 0) {
        d.unlocked = [...base.unlocked];
        repaired.push('colección restaurada a los iniciales');
    }
    else
        d.unlocked = unlocked;
    const owned = new Set(d.unlocked);
    d.obtained = {};
    const obt = isObj(migrated.obtained) ? migrated.obtained : {};
    for (const id of d.unlocked)
        d.obtained[String(id)] = str(obt[String(id)], 'desconocido', 24);
    const shinyIds = Array.isArray(migrated.shinyIds) ? migrated.shinyIds.filter(validId) : [];
    d.shinyIds = [...new Set(shinyIds)].filter((id) => owned.has(id)).sort((a, b) => a - b);
    const shinySelected = Array.isArray(migrated.shinySelected) ? migrated.shinySelected.filter(validId) : [];
    d.shinySelected = [...new Set(shinySelected)].filter((id) => d.shinyIds.includes(id)).sort((a, b) => a - b);
    const tr = isObj(migrated.training) ? migrated.training : {};
    const trStats = isObj(tr.stats) ? tr.stats : {};
    d.training = { stats: {}, chosen: {}, resources: { crystals: 0, medals: 0, cores: 0 } };
    const trChosen = isObj(tr.chosen) ? tr.chosen : {};
    for (const id of d.unlocked) {
        // Los puntos se limitan al máximo vigente (8 %). Si un guardado antiguo tenía más de 3 estadísticas con puntos
        // se CONSERVAN todas (nada se borra); simplemente no se podrán elegir estadísticas nuevas en ese Pokémon.
        const clean = cleanLevels(trStats[String(id)]);
        const chosen = chosenStats(clean, trChosen[String(id)]);
        if (Object.values(clean).some(v => v > 0)) d.training.stats[String(id)] = clean;
        if (chosen.length > 0) d.training.chosen[String(id)] = chosen;
        if (isObj(trStats[String(id)]) && TRAIN_STATS.some((k) => Number(trStats[String(id)][k]) > clean[k]))
            repaired.push('entrenamiento limitado al máximo del 8 %');
    }
    const rs = isObj(tr.resources) ? tr.resources : {};
    d.training.resources = { crystals: int(rs.crystals, 0, 0, 999999), medals: int(rs.medals, 0, 0, 999999), cores: int(rs.cores, 0, 0, 999999) };
    d.progressClaimed = Array.isArray(migrated.progressClaimed)
        ? [...new Set(migrated.progressClaimed.filter((x) => typeof x === 'string' && x.length <= 80))].slice(0, 500)
        : [];
    const pc = isObj(migrated.progressCounters) ? migrated.progressCounters : {};
    d.progressCounters = {
        day: str(pc.day, '', 10), dailyPlayed: int(pc.dailyPlayed, 0, 0, 1e6), dailyWins: int(pc.dailyWins, 0, 0, 1e6),
        week: str(pc.week, '', 10), weeklyPlayed: int(pc.weeklyPlayed, 0, 0, 1e6), weeklyWins: int(pc.weeklyWins, 0, 0, 1e6),
        month: str(pc.month, '', 7), monthlyPlayed: int(pc.monthlyPlayed, 0, 0, 1e6), monthlyWins: int(pc.monthlyWins, 0, 0, 1e6),
    };
    const decksRaw = Array.isArray(migrated.decks) ? migrated.decks : [];
    d.decks = [];
    for (const dk of decksRaw.slice(0, MAX_DECKS)) {
        if (!isObj(dk))
            continue;
        const ids = (Array.isArray(dk.ids) ? dk.ids : []).filter((x) => validId(x) && owned.has(x));
        const uniq = [...new Set(ids)].slice(0, CONFIG.battle.deckSize);
        if (uniq.length !== (Array.isArray(dk.ids) ? dk.ids.length : 0))
            repaired.push('mazo corregido (duplicados o Pokémon bloqueados)');
        d.decks.push({ name: str(dk.name, `Mazo ${d.decks.length + 1}`, 24) || `Mazo ${d.decks.length + 1}`, ids: uniq, equippedItem: null, equippedPokemon: null });
    }
    if (d.decks.length === 0) {
        d.decks = [{ name: 'Mazo 1', ids: base.decks[0].ids.filter((x) => owned.has(x)) }];
        repaired.push('mazo restaurado');
    }
    // Inventario y ranura global de objeto por mazo. La migración conserva como máximo un equipamiento válido por mazo.
    d.itemInventory = {};
    const inv = isObj(migrated.itemInventory) ? migrated.itemInventory : {};
    for (const [id, count] of Object.entries(inv)) {
        if (ITEM_BY_ID.has(id) && Number.isFinite(count) && count > 0) d.itemInventory[id] = Math.min(100000, Math.floor(count));
    }
    const ip = isObj(migrated.itemProgress) ? migrated.itemProgress : {};
    d.itemProgress = { poco_comun: num(ip.poco_comun, 0, 0, 1e9), raro: num(ip.raro, 0, 0, 1e9), epico: num(ip.epico, 0, 0, 1e9) };
    const equippedCounts = {};
    for (let i = 0; i < d.decks.length; i++) {
        const rawDeck = decksRaw[i] && isObj(decksRaw[i]) ? decksRaw[i] : {};
        const itemId = typeof rawDeck.equippedItem === 'string' && ITEM_BY_ID.has(rawDeck.equippedItem) ? rawDeck.equippedItem : null;
        const pokemonId = Number(rawDeck.equippedPokemon);
        if (itemId && Number.isInteger(pokemonId) && d.decks[i].ids.includes(pokemonId) &&
            (equippedCounts[itemId] || 0) < (d.itemInventory[itemId] || 0)) {
            d.decks[i].equippedItem = itemId;
            d.decks[i].equippedPokemon = pokemonId;
            equippedCounts[itemId] = (equippedCounts[itemId] || 0) + 1;
        } else if (itemId) repaired.push(`equipamiento inválido retirado del mazo ${i + 1}`);
    }
    d.activeDeck = int(migrated.activeDeck, 0, 0, d.decks.length - 1);
    d.xp = int(migrated.xp, 0, 0, 1e9);
    d.levels = {};
    const lv = isObj(migrated.levels) ? migrated.levels : {};
    for (const id of d.unlocked) {
        const n = int(lv[String(id)], 1, 1, 99);
        if (n > 1)
            d.levels[String(id)] = Math.min(n, maxLevel(getSpecies(id)));
    }
    d.copies = {};
    const cp = isObj(migrated.copies) ? migrated.copies : {};
    for (const id of d.unlocked) {
        const n = int(cp[String(id)], 0, 0, 1e6);
        if (n > 0)
            d.copies[String(id)] = n;
    }
    d.trophies = int(migrated.trophies, 0, 0, CONFIG.trophies.maxPerGeneration);
    d.bestTrophies = Math.max(d.trophies, int(migrated.bestTrophies, 0, 0, CONFIG.trophies.maxPerGeneration));
    d.trophyVersion = TROPHY_PROGRESS_VERSION;
    d.activeGeneration = GENERATION_BY_ID.has(migrated.activeGeneration) ? migrated.activeGeneration : 'kanto';
    d.generationProgress = {};
    const gp = isObj(migrated.generationProgress) ? migrated.generationProgress : {};
    for (const gen of GENERATIONS) {
        const old = isObj(gp[gen.id]) ? gp[gen.id] : {};
        const isActive = gen.id === d.activeGeneration;
        d.generationProgress[gen.id] = {
            trophies: isActive ? d.trophies : int(old.trophies, 0, 0, gen.maxTrophies),
            bestTrophies: isActive ? d.bestTrophies : Math.max(int(old.trophies, 0, 0, gen.maxTrophies), int(old.bestTrophies, 0, 0, gen.maxTrophies)),
        };
    }
    d.generationProgress[d.activeGeneration].trophies = d.trophies;
    d.generationProgress[d.activeGeneration].bestTrophies = d.bestTrophies;
    const tm = isObj(migrated.trophyMigration) ? migrated.trophyMigration : {};
    d.trophyMigration = {
        version: TROPHY_PROGRESS_VERSION,
        quality: ['native', 'exact', 'approximate'].includes(tm.quality) ? tm.quality : 'native',
        events: int(tm.events, 0, 0, 1e9),
        migratedAt: str(tm.migratedAt, '', 40),
    };
    d.arena = typeof migrated.arena === 'string' && (migrated.arena === 'auto' || ARENAS.some((a) => a.id === migrated.arena)) ? migrated.arena : 'auto';
    const fb = isObj(migrated.freeBalls) ? migrated.freeBalls : {};
    d.freeBalls = { stored: int(fb.stored, 1, 0, CONFIG.freeBalls.max), since: num(fb.since, 0, 0, 1e15) };
    const st = isObj(migrated.stats) ? migrated.stats : {};
    d.stats = {
        played: int(st.played, 0, 0, 1e9), wins: int(st.wins, 0, 0, 1e9), losses: int(st.losses, 0, 0, 1e9),
        draws: int(st.draws, 0, 0, 1e9), towersDestroyed: int(st.towersDestroyed, 0, 0, 1e9),
        timeSec: num(st.timeSec, 0, 0, 1e9), coinsEarned: int(st.coinsEarned, 0, 0, 1e9), ballsEarned: int(st.ballsEarned, 0, 0, 1e9),
        usage: counter(st.usage), kills: counter(st.kills), history: [],
        trainingSessions: int(st.trainingSessions, 0, 0, 1e9), trainingTimeSec: num(st.trainingTimeSec, 0, 0, 1e9),
    };
    const seenHistoryIds = new Set();
    for (const h of (Array.isArray(st.history) ? st.history : []).slice(0, HISTORY_MAX)) {
        if (!isObj(h))
            continue;
        if (typeof h.id === 'string' && h.id && seenHistoryIds.has(h.id)) {
            repaired.push('se eliminaron registros de batalla duplicados');
            continue;
        }
        if (typeof h.id === 'string' && h.id) seenHistoryIds.add(h.id);
        const outcome = h.outcome === 'win' || h.outcome === 'loss' || h.outcome === 'draw' ? h.outcome : null;
        if (!outcome)
            continue;
        const cr = Array.isArray(h.crowns) ? h.crowns : [0, 0];
        d.stats.history.push({
            id: str(h.id, '', 80), at: str(h.at, '', 40), outcome, crowns: [int(cr[0], 0, 0, 3), int(cr[1], 0, 0, 3)],
            reason: str(h.reason, '', 20), durationSec: num(h.durationSec, 0, 0, 100000),
            difficulty: DIFFICULTIES.includes(h.difficulty) ? h.difficulty : 'normal',
            deck: (Array.isArray(h.deck) ? h.deck : []).filter(validId).slice(0, 8), coins: int(h.coins, 0, 0, 1e6), balls: int(h.balls, 0, 0, 1e6),
            trophies: int(h.trophies, 0, -1000, 1000), arena: str(h.arena, '', 24), overtime: bool(h.overtime, false),
            generation: GENERATION_BY_ID.has(h.generation) ? h.generation : 'kanto',
            mode: str(h.mode, 'normal', 24),
            trophiesBefore: int(h.trophiesBefore, 0, 0, CONFIG.trophies.maxPerGeneration),
            trophiesAfter: int(h.trophiesAfter, 0, 0, CONFIG.trophies.maxPerGeneration),
            trophyVersion: int(h.trophyVersion, TROPHY_PROGRESS_VERSION, 1, TROPHY_PROGRESS_VERSION),
            trophyApplied: bool(h.trophyApplied, true),
            legacyTrophies: int(h.legacyTrophies, 0, -1000, 1000),
            migrationApproximate: bool(h.migrationApproximate, false),
        });
    }
    const se = isObj(migrated.settings) ? migrated.settings : {};
    const ds = defaultSettings();
    d.settings = {
        musicOn: bool(se.musicOn, ds.musicOn), sfxOn: bool(se.sfxOn, ds.sfxOn),
        musicVol: num(se.musicVol, ds.musicVol, 0, 1), sfxVol: num(se.sfxVol, ds.sfxVol, 0, 1),
        reduceFx: bool(se.reduceFx, ds.reduceFx), vibration: bool(se.vibration, ds.vibration), shake: bool(se.shake, ds.shake),
        quality: se.quality === 'alta' || se.quality === 'media' || se.quality === 'baja' ? se.quality : ds.quality,
        difficulty: DIFFICULTIES.includes(se.difficulty) ? se.difficulty : ds.difficulty,
        playerName: str(se.playerName, ds.playerName, 20).replace(/[<>\r\n]/g, '').trim() || ds.playerName,
        notify: bool(se.notify, false),
    };
    d.rewarded = (Array.isArray(migrated.rewarded) ? migrated.rewarded : []).filter((x) => typeof x === 'string').slice(-REWARDED_MAX);
    const dl = isObj(migrated.daily) ? migrated.daily : {};
    d.daily = {
        day: str(dl.day, '', 12),
        ids: (Array.isArray(dl.ids) ? dl.ids : []).filter(validId).slice(0, 6),
        bought: (Array.isArray(dl.bought) ? dl.bought : []).filter(validId).slice(0, 6),
    };
    d.moves = {};
    const mv = isObj(migrated.moves) ? migrated.moves : {};
    for (const id of d.unlocked) {
        const m = mv[String(id)];
        if (!isObj(m))
            continue;
        const e = { basic: Number.isInteger(m.basic) && m.basic > 0 && m.basic < 100000 ? m.basic : null, special: typeof m.special === 'string' ? m.special.slice(0, 40) : null, doneBasic: m.doneBasic === true || Number.isInteger(m.basic), doneSpecial: m.doneSpecial === true || typeof m.special === 'string' };
        if (e.basic !== null || e.special !== null || e.doneBasic || e.doneSpecial)
            d.moves[String(id)] = e;
    }
    const sh = isObj(migrated.shop) ? migrated.shop : {};
    d.shop = {
        day: str(sh.day, '', 12),
        bought: (Array.isArray(sh.bought) ? sh.bought : []).filter((x) => Number.isInteger(x) && x >= 0 && x < 6).slice(0, 6),
        seen: str(sh.seen, '', 12),
    };
    const dr = isObj(migrated.draft) ? migrated.draft : {};
    d.draft = { played: int(dr.played, 0, 0, 1e9), wins: int(dr.wins, 0, 0, 1e9), losses: int(dr.losses, 0, 0, 1e9), draws: int(dr.draws, 0, 0, 1e9),
        day: str(dr.day, '', 12), earned: int(dr.earned, 0, 0, 1e9), ballAcc: num(dr.ballAcc, 0, 0, 0.999), byMode: {} };
    if (isObj(dr.byMode))
        for (const [k, v] of Object.entries(dr.byMode).slice(0, 20))
            if (/^[a-z0-9_]{1,24}$/.test(k) && isObj(v))
                d.draft.byMode[k] = { played: int(v.played, 0, 0, 1e9), wins: int(v.wins, 0, 0, 1e9) };
    d.clock = { lastDay: str(isObj(migrated.clock) ? migrated.clock.lastDay : '', '', 12) };
    const bcd = isObj(migrated.battleCoinDaily) ? migrated.battleCoinDaily : {};
    d.battleCoinDaily = { day: str(bcd.day, '', 12), earned: int(bcd.earned, 0, 0, CONFIG.dailyBattleCoinCap) };
    d.lastGiftDay = str(migrated.lastGiftDay, '', 12);
    const wheel = isObj(migrated.dailyWheel) ? migrated.dailyWheel : {};
    d.slotTokens = int(migrated.slotTokens, 0, 0, 99);
    d.dailyWheel = { claimedDay: str(wheel.claimedDay, '', 12), lastClaimAt: int(wheel.lastClaimAt, 0, 0, 9e15), prize: isObj(wheel.prize) ? wheel.prize : null };
    const slots = isObj(migrated.slotsDaily) ? migrated.slotsDaily : {};
    d.slotsDaily = { day: str(slots.day, '', 12), spins: int(slots.spins, 0, 0, 20), played: int(slots.played, 0, 0, 1e9), won: int(slots.won, 0, 0, 1e9), best: int(slots.best, 0, 0, 1e9), lastSpinAt: int(slots.lastSpinAt, 0, 0, 9e15) };
    const story = isObj(migrated.storyProgress) ? migrated.storyProgress : {};
    d.storyProgress = {
        chapter: int(story.chapter, 0, 0, 10), stage: int(story.stage, 0, 0, 4),
        completed: Array.isArray(story.completed) ? [...new Set(story.completed.filter(x => typeof x === 'string' && /^[a-z-]{2,24}$/.test(x)))].slice(0,10) : [],
        medals: Array.isArray(story.medals) ? [...new Set(story.medals.filter(x => typeof x === 'string' && x.length <= 30))].slice(0,8) : []
    };
    const tp = isObj(migrated.tournamentProgress) ? migrated.tournamentProgress : null;
    if (tp && typeof tp.id === 'string' && [4,8,16].includes(tp.size) && Array.isArray(tp.entrants)) {
        const entrants = tp.entrants.slice(0,tp.size).map((e,i)=>({
            id: str(e?.id,`cpu-${i}`,24), name: str(e?.name,`Entrenador ${i+1}`,32),
            seed: int(e?.seed, i+1, 0, 1e9)
        }));
        d.tournamentProgress = {
            id: str(tp.id,'',48), size: tp.size, rule: str(tp.rule,'open',24),
            entrants, currentRound: int(tp.currentRound,0,0,4),
            complete: bool(tp.complete,false), champion: str(tp.champion,'',32),
            rounds: Array.isArray(tp.rounds) ? tp.rounds.slice(0,4).map((round,ri)=>Array.isArray(round)?round.slice(0,tp.size/2).map((m,mi)=>({
                id:str(m?.id,`r${ri}-${mi}`,24),
                a: isObj(m?.a)?{id:str(m.a.id,'',24),name:str(m.a.name,'',32),seed:int(m.a.seed,0,0,1e9)}:null,
                b: isObj(m?.b)?{id:str(m.b.id,'',24),name:str(m.b.name,'',32),seed:int(m.b.seed,0,0,1e9)}:null,
                result: m?.result===0||m?.result===1||m?.result==='bye'?m.result:null
            })):[] ) : []
        };
    } else d.tournamentProgress = null;
    const aim = isObj(migrated.aiMemory) ? migrated.aiMemory : {};
    d.aiMemory = { lanes: Array.isArray(aim.lanes) ? [num(aim.lanes[0],0,0,1e6),num(aim.lanes[1],0,0,1e6)] : [0,0],
        types: isObj(aim.types) ? Object.fromEntries(Object.entries(aim.types).slice(0,18).map(([k,v])=>[k,num(v,0,0,1e6)])) : {},
        games: int(aim.games,0,0,1e6) };
    d.savedAt = str(migrated.savedAt, '', 40);
    d.schema = SAVE_SCHEMA;
    return { data: d, repaired };
}
/**
 * Recalcula trofeos de guardados anteriores al sistema por generación.
 * El historial actual solo conserva las últimas HISTORY_MAX partidas: solo se considera exacto
 * si el contador total de partidas cabe en el historial y cada evento tiene resultado/dificultad.
 */
export function migrateTrophyProgress(raw, notes = []) {
    const currentVersion = TROPHY_PROGRESS_VERSION;
    const activeGeneration = GENERATION_BY_ID.has(raw.activeGeneration) ? raw.activeGeneration : 'kanto';
    const gen = GENERATION_BY_ID.get(activeGeneration) ?? GENERATIONS[0];
    const clampScore = (v) => Math.max(0, Math.min(gen.maxTrophies, Math.round(Number.isFinite(Number(v)) ? Number(v) : 0)));
    const legacyCurrent = typeof raw.trophies === 'number' && Number.isFinite(raw.trophies)
        ? Math.max(0, Math.min(1e9, Math.trunc(raw.trophies))) : 0;
    const current = clampScore(legacyCurrent);
    const bestRaw = clampScore(raw.bestTrophies ?? legacyCurrent);
    const inputHistory = Array.isArray(raw.stats?.history) ? raw.stats.history : [];
    const playedNow = Number.isFinite(raw.stats?.played) ? Math.max(0, Math.trunc(raw.stats.played)) : 0;
    const marker = isObj(raw.trophyMigration) ? raw.trophyMigration : {};
    const markerValid = marker.version === currentVersion &&
        ['native', 'exact', 'approximate'].includes(marker.quality) &&
        Number.isInteger(marker.events) && marker.events >= 0 &&
        (marker.quality !== 'exact' || marker.events <= inputHistory.length);
    const currentHistoryValid = inputHistory.every((h) => isObj(h) &&
        h.trophyVersion === currentVersion && h.trophyApplied === true &&
        GENERATION_BY_ID.has(h.generation) &&
        Number.isInteger(h.trophiesBefore) && h.trophiesBefore >= 0 && h.trophiesBefore <= gen.maxTrophies &&
        Number.isInteger(h.trophiesAfter) && h.trophiesAfter >= 0 && h.trophiesAfter <= gen.maxTrophies &&
        Number.isInteger(h.trophies) && h.trophiesAfter === clampScore(h.trophiesBefore + h.trophies));
    const latestBalanceValid = inputHistory.length === 0
        ? (playedNow === 0 || (marker.quality === 'approximate' && marker.events === 0))
        : inputHistory[0]?.trophiesAfter === current;
    const claimedCurrent = Number.isInteger(raw.trophyVersion) && raw.trophyVersion >= currentVersion;
    const alreadyMigrated = claimedCurrent && markerValid && currentHistoryValid && latestBalanceValid;
    if (alreadyMigrated) {
        const generationProgress = { ...(isObj(raw.generationProgress) ? raw.generationProgress : {}) };
        generationProgress[activeGeneration] = { trophies: current, bestTrophies: Math.max(current, bestRaw) };
        if (legacyCurrent > gen.maxTrophies || Number(raw.bestTrophies) > gen.maxTrophies || Number(raw.trophies) < 0)
            notes.push(`Trofeos normalizados al límite de ${gen.maxTrophies} de ${gen.name}.`);
        return {
            trophies: current, bestTrophies: Math.max(current, bestRaw), activeGeneration, generationProgress,
            migration: marker,
            history: inputHistory,
        };
    }
    if (claimedCurrent) {
        notes.push('La marca de versión de trofeos no coincidía con el historial; se ha vuelto a validar la progresión.');
        // Si los propios eventos ya tienen saldos/versiones consistentes, no convertirlos como si fueran datos antiguos.
        const looksCurrent = inputHistory.length > 0 && currentHistoryValid;
        if (looksCurrent) {
            const generationProgress = { ...(isObj(raw.generationProgress) ? raw.generationProgress : {}) };
            generationProgress[activeGeneration] = { trophies: current, bestTrophies: Math.max(current, bestRaw) };
            return {
                trophies: current, bestTrophies: Math.max(current, bestRaw), activeGeneration, generationProgress,
                migration: { version: currentVersion, quality: 'approximate', events: inputHistory.length, migratedAt: new Date().toISOString() },
                history: inputHistory,
            };
        }
    }
    const seen = new Set();
    const records = [];
    let duplicateCount = 0;
    for (let i = 0; i < inputHistory.length; i++) {
        const h = inputHistory[i];
        if (!isObj(h)) continue;
        const id = typeof h.id === 'string' ? h.id.slice(0, 80) : '';
        if (id && seen.has(id)) { duplicateCount++; continue; }
        if (id) seen.add(id);
        const oldDelta = typeof h.trophies === 'number' && Number.isFinite(h.trophies) ? Math.max(-1000, Math.min(1000, Math.trunc(h.trophies))) : null;
        const outcome = ['win', 'loss', 'draw'].includes(h.outcome) ? h.outcome : null;
        let difficulty = DIFFICULTIES.includes(h.difficulty) ? h.difficulty : null;
        // Las victorias antiguas tenían deltas exactos (20/30/40): si la etiqueta no coincide,
        // se infiere a partir de la recompensa efectivamente registrada, no del texto importado.
        if (outcome === 'win' && oldDelta !== null) {
            const inferred = Object.entries({ facil: 20, normal: 30, dificil: 40 }).find(([, value]) => value === oldDelta)?.[0] ?? null;
            if (inferred) difficulty = inferred;
            else difficulty = null;
        }
        // En derrotas el suelo de arena podía reducir la pérdida real; se valida que el delta
        // sea plausible para la dificultad, pero un JSON local no permite autenticarla criptográficamente.
        if (outcome === 'loss' && oldDelta !== null) {
            const legacyLoss = { facil: -25, normal: -20, dificil: -12 };
            // Si el delta no coincide exactamente, el antiguo suelo de arena pudo alterarlo:
            // no se puede verificar la dificultad real desde un JSON local y no se usa esa etiqueta.
            if (!difficulty || oldDelta !== legacyLoss[difficulty]) difficulty = null;
        }
        if (outcome === 'draw' && oldDelta !== null && oldDelta !== 0) difficulty = null;
        records.push({ ...h, id, _index: i, _oldDelta: oldDelta, _outcome: outcome, _difficulty: difficulty,
            _validAt: typeof h.at === 'string' && Number.isFinite(Date.parse(h.at)) ? Date.parse(h.at) : null });
    }
    const allDatesValid = records.length > 0 && records.every((r) => r._validAt !== null);
    const chronological = records.slice().reverse();
    if (allDatesValid) chronological.sort((a, b) => a._validAt - b._validAt || a._index - b._index);
    const played = Number.isFinite(raw.stats?.played) ? Math.max(0, Math.trunc(raw.stats.played)) : 0;
    const allEventsAvailable = chronological.length > 0 && played === chronological.length && played > 0 &&
        duplicateCount === 0 && allDatesValid &&
        chronological.every((r) => r.id && r._outcome && r._difficulty && r._oldDelta !== null);
    const hasAnyUsableHistory = chronological.length > 0;
    const sumOld = chronological.reduce((sum, r) => sum + (r._oldDelta ?? 0), 0);
    let balance = clampScore(legacyCurrent - sumOld);
    let best = allEventsAvailable ? balance : Math.max(balance, bestRaw);
    const transformed = [];
    for (const r of chronological) {
        const before = balance;
        let delta = 0;
        if (r._outcome && r._difficulty) {
            if (r._outcome === 'win') delta = CONFIG.trophies.win[r._difficulty];
            else if (r._outcome === 'loss') delta = CONFIG.trophies.loss[r._difficulty];
            else delta = CONFIG.trophies.draw;
        } else {
            // Fallback conservador: no conceder una victoria de dificultad incierta; conservar
            // una pérdida antigua negativa para no convertir un registro incompleto en un bonus.
            delta = Math.min(0, r._oldDelta ?? 0);
        }
        balance = clampScore(balance + delta);
        best = Math.max(best, balance);
        transformed.push({
            ...r, difficulty: r._difficulty ?? (DIFFICULTIES.includes(r.difficulty) ? r.difficulty : 'normal'),
            legacyTrophies: r._oldDelta ?? 0, trophiesBefore: before,
            trophies: balance - before, trophiesAfter: balance, trophyVersion: currentVersion,
            generation: activeGeneration, trophyApplied: true,
            migrationApproximate: !allEventsAvailable || !r._outcome || !r._difficulty || r._oldDelta === null,
        });
    }
    let cleanedHistory = transformed.reverse().map(({ _index, _oldDelta, _outcome, _difficulty, _validAt, ...h }) => h);
    const quality = allEventsAvailable ? 'exact' : 'approximate';
    if (quality === 'exact') {
        notes.push(`Trofeos migrados de forma exacta según ${chronological.length} batallas registradas.`);
    } else if (!hasAnyUsableHistory) {
        balance = clampScore(current);
        best = Math.max(balance, bestRaw);
        notes.push(`Migración de trofeos aproximada: no hay historial utilizable; el saldo se ha limitado a ${gen.maxTrophies}.`);
    } else {
        notes.push(`Migración de trofeos aproximada: se han recalculado ${chronological.length} registros disponibles; el historial antiguo no es completo o contiene datos ausentes.`);
    }
    if (duplicateCount) notes.push(`Se ignoraron ${duplicateCount} registros de batalla duplicados durante la migración.`);
    const generationProgress = { ...(isObj(raw.generationProgress) ? raw.generationProgress : {}) };
    generationProgress[activeGeneration] = { trophies: balance, bestTrophies: clampScore(best) };
    return {
        trophies: balance, bestTrophies: clampScore(best), activeGeneration, generationProgress,
        migration: { version: currentVersion, quality, events: chronological.length, migratedAt: new Date().toISOString() },
        history: cleanedHistory,
    };
}
/**
 * Migraciones entre versiones del esquema. El esquema de guardado actual es 4; la versión de reglas de trofeos se versiona por separado en `trophyVersion`.
 * Las versiones anteriores a la 1 (sin campo `schema`) se tratan como v0 y se reinterpretan campo a campo. Añade aquí un `if (v < N)` por cada cambio de formato.
 */
export function migrate(raw, notes) {
    const v = typeof raw.schema === 'number' ? raw.schema : 0;
    const out = { ...raw };
    if (v > SAVE_SCHEMA)
        notes.push(`guardado de una versión más nueva (${v}); se leen solo los campos conocidos`);
    // v1 -> v2: niveles, trofeos y bolas gratis con temporizador. Los campos nuevos toman sus valores por defecto.
    if (v >= 1 && v < 2)
        notes.push('guardado migrado a la versión 2 (niveles, trofeos y bolas gratis)');
    if (v >= 2 && v < 3)
        notes.push('guardado migrado a la versión 3 (shiny y progreso)');
    // v3 -> v4: entrenamiento con tope del 8 %, máximo 3 estadísticas por Pokémon y lista `chosen`. No se pierde ninguna mejora válida.
    if (v >= 3 && v < 4)
        notes.push('guardado migrado a la versión 4 (entrenamiento limitado al 8 % y a 3 estadísticas)');
    if (v < 1) {
        notes.push('guardado anterior migrado a la versión 1');
        if (typeof out.pokeballs === 'number' && !out.balls)
            out.balls = { poke: out.pokeballs };
        if (Array.isArray(out.collection) && !out.unlocked)
            out.unlocked = out.collection;
    }
    return out;
}
export class MemoryKV {
    m = new Map();
    getItem(k) {
        return this.m.has(k) ? this.m.get(k) : null;
    }
    setItem(k, v) {
        this.m.set(k, v);
    }
    removeItem(k) {
        this.m.delete(k);
    }
}
export const CORRUPT_KEY = `${CONFIG.save.key}:corrupto`;
export function loadSave(kv) {
    const notices = [];
    let text = null;
    try {
        text = kv.getItem(CONFIG.save.key);
    }
    catch {
        return { data: defaultSave(), notices: ['No se puede acceder al almacenamiento del navegador: el progreso no se guardará.'], fresh: true };
    }
    if (text === null)
        return { data: defaultSave(), notices, fresh: true };
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        // datos corruptos: se conserva el texto original para poder recuperarlo y se intenta la copia anterior
        try {
            kv.setItem(CORRUPT_KEY, text);
        }
        catch { /* sin espacio: se continúa */ }
        let backup = null;
        try {
            const b = kv.getItem(CONFIG.save.backupKey);
            if (b)
                backup = sanitizeSave(JSON.parse(b)).data;
        }
        catch { /* copia también dañada */ }
        if (backup) {
            notices.push('El guardado estaba dañado: se ha recuperado la copia de seguridad anterior.');
            return { data: backup, notices, fresh: false };
        }
        notices.push('El guardado estaba dañado y no había copia anterior: se ha empezado de cero. El texto original se conserva por si quieres recuperarlo.');
        return { data: defaultSave(), notices, fresh: true };
    }
    const { data, repaired } = sanitizeSave(parsed);
    if (repaired.length)
        notices.push(`Se corrigieron datos del guardado: ${[...new Set(repaired)].join('; ')}.`);
    return { data, notices, fresh: false };
}
/** Guarda con copia de seguridad rotativa (la copia es siempre el guardado válido inmediatamente anterior). */
export function persistSave(kv, data) {
    try {
        const prev = kv.getItem(CONFIG.save.key);
        if (prev) {
            try {
                JSON.parse(prev);
                kv.setItem(CONFIG.save.backupKey, prev);
            }
            catch { /* el anterior estaba dañado: no sobrescribe la copia buena */ }
        }
        data.savedAt = new Date().toISOString();
        kv.setItem(CONFIG.save.key, JSON.stringify(data));
        return true;
    }
    catch {
        return false;
    }
}
/* ───────── exportar / importar copia de seguridad ───────── */
export const BACKUP_FORMAT = 'pokemon-royale-backup';
export function exportBackup(data) {
    return JSON.stringify({ format: BACKUP_FORMAT, schema: SAVE_SCHEMA, exportedAt: new Date().toISOString(), data }, null, 2);
}
export function importBackup(text) {
    if (text.length > 2_000_000)
        return { ok: false, error: 'El archivo es demasiado grande.' };
    let j;
    try {
        j = JSON.parse(text);
    }
    catch {
        return { ok: false, error: 'El archivo no es un JSON válido.' };
    }
    if (!isObj(j) || j.format !== BACKUP_FORMAT || !isObj(j.data))
        return { ok: false, error: 'No parece una copia de seguridad de Pokémon Royale.' };
    const { data, repaired } = sanitizeSave(j.data);
    return { ok: true, data, repaired };
}
