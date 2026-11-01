import { h } from "../dom.js";
import { STORY_CHAPTERS, advanceStoryProgress, normalizeStoryProgress, storyStage } from "../../game/story.js";

const emptyProgress = () => ({ chapter: 0, stage: 0, completed: [], medals: [] });

function readProgress(profile) {
    return normalizeStoryProgress(profile.data.storyProgress ?? emptyProgress());
}

export function historiaScreen(app) {
    const profile = app.profile;
    const root = h('div', { class: 'page' });
    let launching = false;

    const draw = () => {
        const progress = readProgress(profile);
        root.replaceChildren(
            h('h1', null, 'Historia de Kanto'),
            h('p', { class: 'sub' }, 'Completa los gimnasios, supera al Alto Mando y conquista la Liga Pokémon. El progreso es independiente de tus trofeos.'),
            h('section', { class: 'panel stack' },
                h('div', { class: 'row between' }, h('b', null, 'Progreso de la aventura'), h('span', { class: 'sub' }, `${progress.completed.length}/${STORY_CHAPTERS.length} capítulos`)),
                h('div', { class: 'bar' }, h('i', { style: `width:${progress.completed.length / STORY_CHAPTERS.length * 100}%` })),
                progress.medals.length ? h('p', { class: 'sub' }, `Medallas conseguidas: ${progress.medals.join(' · ')}`) : h('p', { class: 'sub' }, 'Aún no has conseguido medallas.')
            )
        );

        STORY_CHAPTERS.forEach((chapter, index) => {
            const completed = progress.completed.includes(chapter.id);
            const unlocked = index === 0 || progress.completed.includes(STORY_CHAPTERS[index - 1].id);
            const current = !completed && index === progress.chapter;
            const stage = completed ? 0 : current ? Math.min(3, progress.stage) : 0;
            const nextBattle = storyStage(index, stage);
            const stageLabel = index === 8 ? `Alto Mando · ${stage + 1}/4` : `Combate ${stage + 1}/4`;
            const status = completed ? 'Completado' : unlocked ? (current ? `${stageLabel} · Disponible` : 'Disponible') : '🔒 Bloqueado';
            root.append(h('section', { class: 'panel stack' },
                h('div', { class: 'row between' }, h('h3', null, `${index + 1}. ${chapter.city}`), h('span', { class: 'sub' }, status)),
                h('p', { class: 'sub' }, `${completed ? chapter.leader : nextBattle.leader}${chapter.badge ? ` · ${chapter.badge}` : ''} · Clima: ${completed ? chapter.weather : nextBattle.weather}`),
                h('button', {
                    class: 'btn btn-gold', disabled: !unlocked || launching,
                    on: { click: () => startChapter(index) }
                }, completed ? 'Repetir capítulo completo' : current ? 'Continuar capítulo' : 'Comenzar capítulo')
            ));
        });
    };

    const startChapter = async (index) => {
        if (launching || index < 0 || index >= STORY_CHAPTERS.length) return;
        const progress = readProgress(profile);
        const chapter = STORY_CHAPTERS[index];
        const unlocked = index === 0 || progress.completed.includes(STORY_CHAPTERS[index - 1].id);
        if (!unlocked) return;

        // Al repetir un capítulo ya completado se empieza desde el primer combate,
        // no directamente desde el último líder/miembro del Alto Mando.
        const stage = progress.completed.includes(chapter.id) ? 0 : index === progress.chapter ? progress.stage : 0;
        const spec = storyStage(index, stage);
        const playerDeck = profile.deck?.ids?.slice() ?? [];
        if (!spec || playerDeck.length !== 8 || playerDeck.some((id) => !Number.isInteger(id) || id < 1 || id > 151)) {
            app.go('mazos');
            return;
        }

        launching = true;
        draw();
        let completionHandled = false;
        const onComplete = (result) => {
            if (completionHandled || result?.winner !== 0) return;
            completionHandled = true;
            const latest = readProgress(profile);
            const advanced = advanceStoryProgress(latest, index, stage);
            profile.data.storyProgress = advanced.progress;
            // Las recompensas se entregan al completar el capítulo entero, no
            // cuatro veces por ganar sus cuatro combates.
            if (advanced.reward) {
                profile.data.coins = Math.min(1e9, profile.data.coins + advanced.reward.coins);
                profile.data.xp = Math.min(1e9, profile.data.xp + advanced.reward.xp);
            }
            profile.commit();
        };

        try {
            await app.startBattle({ mode: 'story', deck: playerDeck, enemyDeck: spec.enemyDeck.slice(), difficulty: 'normal', weather: spec.weather, arena: 'auto', onComplete });
        } finally {
            launching = false;
            if (app.screen === 'historia') draw();
        }
    };

    draw();
    app.watch(draw);
    return root;
}
