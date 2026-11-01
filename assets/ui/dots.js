import { claimableMissions } from "./screens/progreso.js";

/**
 * Puntos rojos de "pendiente". Todos salen del estado real del perfil: si no hay nada que hacer, no hay punto.
 *  · inicio: regalo diario sin recoger · bolas: Poké Balls gratis listas o sin abrir · progreso: recompensas listas para reclamar
 *  · mazos/coleccion: Pokémon mejorables (copias y monedas suficientes) o con ataque nuevo por elegir · tienda: ofertas de hoy sin ver.
 */
export function pendingDots(p) {
    const d = {};
    d.inicio = p.giftAvailable();
    d.ruleta = p.wheelAvailable();
    d.bolas = p.freeBallsState().stored > 0 || p.ballCount() > 0;
    d.progreso = claimableMissions(p) > 0;
    const learn = p.pendingLearning().length > 0;
    const upgrade = p.data.unlocked.some((id) => p.upgradeInfo(id).can);
    d.mazos = learn || upgrade;
    d.coleccion = learn || upgrade;
    d.tienda = p.shopUnseen();
    return d;
}
