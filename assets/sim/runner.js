import { CONFIG } from "../config.js";
import { AiPlayer } from "./ai.js";
import { Battle } from "./battle.js";
/** Simula una partida completa sin dibujar nada, a paso fijo (la misma lógica que usa el juego). */
export function runHeadless(o) {
    const battle = new Battle({ ...o, emitEvents: false });
    const ai1 = new AiPlayer(battle, 1, o.difficulty, o.seed, o.aiStyle && o.aiStyle !== 'aleatoria' ? o.aiStyle : null);
    const ai0 = o.player0Ai ? new AiPlayer(battle, 0, o.player0Ai, o.seed ^ 0x77) : null;
    const dt = CONFIG.battle.stepSec;
    const limit = Math.ceil((o.maxSeconds ?? CONFIG.battle.durationSec + CONFIG.battle.overtimeSec + 5) / dt);
    for (let i = 0; i < limit && !battle.ended; i++) {
        ai0?.update(dt);
        ai1.update(dt);
        battle.step(dt);
    }
    if (!battle.result)
        throw new Error('La partida no terminó dentro del límite de tiempo');
    return { battle, result: battle.result, ai1, ai0 };
}
