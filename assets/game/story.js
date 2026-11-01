export const STORY_CHAPTERS = Object.freeze([
    { id: 'pewter', city: 'Ciudad Plateada', leader: 'Brock', badge: 'Medalla Roca', weather: 'sand', theme: 'roca', enemyDeck: [74,95,27,50,111,95,74,111], reward: { coins: 180, xp: 30 } },
    { id: 'cerulean', city: 'Ciudad Celeste', leader: 'Misty', badge: 'Medalla Cascada', weather: 'rain', theme: 'agua', enemyDeck: [54,60,61,72,90,116,118,120], reward: { coins: 200, xp: 35 } },
    { id: 'vermilion', city: 'Ciudad Carmín', leader: 'Lt. Surge', badge: 'Medalla Trueno', weather: 'storm', theme: 'electrico', enemyDeck: [25,26,81,100,125,82,101,125], reward: { coins: 220, xp: 40 } },
    { id: 'celadon', city: 'Ciudad Azulona', leader: 'Erika', badge: 'Medalla Arcoíris', weather: 'sun', theme: 'planta', enemyDeck: [1,2,3,43,44,69,70,71], reward: { coins: 240, xp: 45 } },
    { id: 'fuchsia', city: 'Ciudad Fucsia', leader: 'Koga', badge: 'Medalla Alma', weather: 'neutral', theme: 'veneno', enemyDeck: [23,24,41,42,88,89,109,110], reward: { coins: 260, xp: 50 } },
    { id: 'saffron', city: 'Ciudad Azafrán', leader: 'Sabrina', badge: 'Medalla Pantano', weather: 'neutral', theme: 'psiquico', enemyDeck: [63,64,65,96,97,122,63,150], reward: { coins: 280, xp: 55 } },
    { id: 'cinnabar', city: 'Isla Canela', leader: 'Blaine', badge: 'Medalla Volcán', weather: 'sun', theme: 'fuego', enemyDeck: [4,5,6,37,38,58,59,126], reward: { coins: 300, xp: 60 } },
    { id: 'viridian', city: 'Ciudad Verde', leader: 'Giovanni', badge: 'Medalla Tierra', weather: 'sand', theme: 'tierra', enemyDeck: [27,28,31,34,50,51,104,112], reward: { coins: 340, xp: 70 } },
    { id: 'indigo-elite', city: 'Meseta Añil', leader: 'Alto Mando', badge: '', weather: 'storm', theme: 'elite', enemyDeck: [131,124,106,107,94,143,130,149], reward: { coins: 500, xp: 100 } },
    { id: 'champion', city: 'Liga Pokémon', leader: 'Campeón', badge: '', weather: 'neutral', theme: 'champion', enemyDeck: [3,6,9,25,130,149,150,151], reward: { coins: 800, xp: 150 } },
]);

export const STORY_TRAINERS = Object.freeze([
    { name: 'Entrenador de ruta', deck: [16,19,21,29,32,39,52,10] },
    { name: 'Rival de gimnasio', deck: [1,4,7,25,27,37,54,63] },
    { name: 'Especialista de Kanto', deck: [12,15,26,45,65,94,130,142] },
]);

export function normalizeStoryProgress(raw = {}) {
    return {
        chapter: Number.isInteger(raw.chapter) ? Math.max(0, Math.min(STORY_CHAPTERS.length, raw.chapter)) : 0,
        stage: Number.isInteger(raw.stage) ? Math.max(0, Math.min(3, raw.stage)) : 0,
        completed: Array.isArray(raw.completed) ? [...new Set(raw.completed.filter((id) => STORY_CHAPTERS.some((c) => c.id === id)))] : [],
        medals: Array.isArray(raw.medals) ? [...new Set(raw.medals.filter((medal) => typeof medal === 'string'))] : [],
    };
}

export function storyStage(chapter, stage = 0) {
    const config = STORY_CHAPTERS[chapter];
    if (!config) return null;
    const index = Math.max(0, Math.min(3, Number.isInteger(stage) ? stage : 0));
    if (chapter === 8) {
        const elite = [
            { name: 'Lorelei', deck: [87,91,131,124,144,87,91,131], weather: 'hail' },
            { name: 'Bruno', deck: [66,67,68,106,107,95,111,68], weather: 'sand' },
            { name: 'Agatha', deck: [92,93,94,41,42,109,110,94], weather: 'neutral' },
            { name: 'Lance', deck: [147,148,149,130,142,6,149,130], weather: 'storm' },
        ][index];
        return { ...config, leader: elite.name, enemyDeck: elite.deck.slice(), weather: elite.weather, final: index === 3 };
    }
    if (index < 3) {
        const trainer = STORY_TRAINERS[index];
        return { ...config, leader: trainer.name, enemyDeck: trainer.deck.slice(), weather: index === 0 ? 'neutral' : config.weather, final: false };
    }
    return { ...config, enemyDeck: config.enemyDeck.slice(), final: true };
}

/** Avanza únicamente una campaña activa; repetir un capítulo ya superado no reinicia ni regala progreso. */
export function advanceStoryProgress(raw, chapterIndex, stageIndex) {
    const progress = normalizeStoryProgress(raw);
    const chapter = STORY_CHAPTERS[chapterIndex];
    if (!chapter || progress.completed.includes(chapter.id)) {
        return { progress, chapterCompleted: false, reward: null };
    }
    if (stageIndex < 0 || stageIndex > 3 || !Number.isInteger(stageIndex)) {
        throw new RangeError('Fase de historia no válida.');
    }
    // Ignora resultados atrasados de otra fase/capítulo.
    if (progress.chapter !== chapterIndex || progress.stage !== stageIndex) {
        return { progress, chapterCompleted: false, reward: null };
    }
    if (stageIndex < 3) {
        return { progress: { ...progress, stage: stageIndex + 1 }, chapterCompleted: false, reward: null };
    }
    const completed = [...progress.completed, chapter.id];
    const medals = chapter.badge && !progress.medals.includes(chapter.badge) ? [...progress.medals, chapter.badge] : progress.medals;
    return {
        progress: { chapter: Math.min(STORY_CHAPTERS.length, chapterIndex + 1), stage: 0, completed, medals },
        chapterCompleted: true,
        reward: chapter.reward,
    };
}
