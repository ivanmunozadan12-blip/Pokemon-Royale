import { CONFIG } from "../config.js";
const F = CONFIG.field;
export const FIELD_W = F.w;
export const FIELD_H = F.h;
export const RIVER_MID = (F.riverY0 + F.riverY1) / 2;
/** Posición de las 6 torres. Índices 0-2: jugador (izq., der., rey). 3-5: rival. */
export function towerLayout() {
    const t = CONFIG.towers;
    const out = [];
    for (const team of [0, 1]) {
        const sy = team === 0 ? t.sideY.player : t.sideY.enemy;
        const ky = team === 0 ? t.kingY.player : t.kingY.enemy;
        out.push({ team, kind: 'left', x: t.sideX[0], y: sy });
        out.push({ team, kind: 'right', x: t.sideX[1], y: sy });
        out.push({ team, kind: 'king', x: F.centerX, y: ky });
    }
    return out;
}
export function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
}
/** Banda del río (sin puentes). */
export function inRiverBand(y, margin = 0) {
    return y > F.riverY0 - margin && y < F.riverY1 + margin;
}
export function nearestBridgeIndex(x) {
    return Math.abs(x - F.bridgeXs[0]) <= Math.abs(x - F.bridgeXs[1]) ? 0 : 1;
}
/** ¿Está x dentro de algún puente (con margen negativo = más estricto)? */
export function onBridgeX(x, r) {
    for (const bx of F.bridgeXs)
        if (Math.abs(x - bx) <= F.bridgeHalfW - r * 0.35)
            return true;
    return false;
}
/** Zona de despliegue válida para un equipo (sin comprobar torres). */
export function inDeployHalf(team, x, y) {
    if (x < 0.6 || x > F.w - 0.6)
        return false;
    return team === 0 ? y >= F.playerDeployMinY && y <= F.h - 0.6 : y <= F.enemyDeployMaxY && y >= 0.6;
}
export const riverSide = (y) => (y < RIVER_MID ? 1 : 0);
