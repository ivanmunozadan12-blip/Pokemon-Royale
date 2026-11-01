/**
 * CONFIGURACIÓN CENTRAL de Pokémon Royale.
 *
 * Todo lo que se pueda querer ajustar sin tocar la lógica vive aquí:
 * recursos iniciales, recompensas, precios, probabilidades, energía,
 * geometría del campo, torres y escala de equilibrio de las unidades.
 */
export const RARITIES = ['comun', 'poco_comun', 'raro', 'epico', 'legendario'];
export const RARITY_LABEL = {
    comun: 'Común',
    poco_comun: 'Poco común',
    raro: 'Raro',
    epico: 'Épico',
    legendario: 'Legendario',
};
export const BALL_KINDS = ['poke', 'super', 'ultra', 'master'];
export const CONFIG = {
    version: '3.0.0',
    /** Recursos de la primera partida (modo prueba generoso). ÚNICO lugar donde se definen. */
    start: {
        coins: 5000,
        balls: { poke: 10, super: 0, ultra: 0, master: 0 },
        /** Pokémon desbloqueados desde el inicio (IDs nacionales). Forman el mazo inicial. */
        unlocked: [1, 4, 7, 16, 19, 25, 66, 74, 63, 54, 133, 129],
        /** Mazo inicial (8 IDs, subconjunto de `unlocked`). */
        deck: [1, 4, 7, 25, 74, 66, 16, 63],
        difficulty: 'normal',
    },
    /** Monedas de partidas normales por día; las misiones/desafíos no consumen este límite. */
    dailyBattleCoinCap: 2000,
    /** Modos Draft: recompensa = fracción de la normal (una sola vez por partida), tope diario propio y SIN trofeos. */
    draftRewards: { fraction: 0.25, dailyCoinCap: 400 },
    /** Recompensas por partida (solo modo batalla contra la IA, nunca entrenamiento). */
    rewards: {
        win: { coins: 130, balls: 1, xp: 24 },
        draw: { coins: 75, balls: 0, xp: 12 },
        loss: { coins: 40, balls: 0, xp: 8 },
    },
    /** XP necesaria para pasar del nivel N al N+1 = xpBase + xpStep * (N-1). */
    level: { xpBase: 85, xpStep: 35 },
    /** Precios y probabilidades. Las probabilidades se expresan en puntos básicos (suman 10000 = 100 %). */
    balls: {
        poke: {
            name: 'Poké Ball',
            price: 250,
            odds: { comun: 6000, poco_comun: 2700, raro: 1000, epico: 270, legendario: 30 },
        },
        super: {
            name: 'Super Ball',
            price: 650,
            odds: { comun: 2500, poco_comun: 4000, raro: 2600, epico: 800, legendario: 100 },
        },
        ultra: {
            name: 'Ultra Ball',
            price: 1500,
            odds: { comun: 0, poco_comun: 2000, raro: 5000, epico: 2700, legendario: 300 },
        },
        master: {
            name: 'Master Ball',
            price: 4500,
            odds: { comun: 0, poco_comun: 0, raro: 3500, epico: 5500, legendario: 1000 },
        },
    },
    /** Monedas que se obtienen al sacar una especie que ya se tenía. */
    duplicateCoins: { comun: 60, poco_comun: 120, raro: 300, epico: 700, legendario: 1500 },
    /** Oferta diaria de la tienda: compra directa de Pokémon con monedas. */
    dailyOffers: {
        count: 6,
        /** Probabilidad de que exista una aparición épica en una semana ISO (0–1). */
        weeklyEpicChance: 0.35,
        price: { comun: 300, poco_comun: 700, raro: 1800, epico: 4500, legendario: 12000 },
    },
    /** Umbrales de rareza por suma de estadísticas base (BST). */
    rarityBst: { poco_comun: 340, raro: 445, epico: 520 },
    legendaryIds: [144, 145, 146, 150, 151],
    /** Reglas de batalla. */
    battle: {
        durationSec: 180,
        finalPhaseSec: 60,
        energyMax: 10,
        energyStart: 5,
        regenNormal: 0.39,
        regenFinal: 0.78,
        /** Tiempo extra (muerte súbita) si se acaba el tiempo con las mismas coronas. */
        overtimeSec: 60,
        regenOvertime: 1.17,
        handSize: 4,
        deckSize: 8,
        /** Paso fijo de simulación (s). */
        stepSec: 1 / 30,
        /** Máximo de pasos de simulación por fotograma (evita el "efecto muelle" tras una pausa del navegador). */
        maxStepsPerFrame: 6,
        /** Máximo de unidades vivas por equipo (protección de rendimiento). */
        maxUnitsPerTeam: 24,
        spawnDelaySec: 0.7,
    },
    /** Geometría del campo, en "casillas" (18 x 32, como un campo de Clash Royale). */
    field: {
        w: 18,
        h: 32,
        riverY0: 15.0,
        riverY1: 17.0,
        bridgeXs: [4.5, 13.5],
        bridgeHalfW: 1.25,
        centerX: 9,
        /** Línea de despliegue del jugador: y >= playerDeployMinY. */
        playerDeployMinY: 17.6,
        enemyDeployMaxY: 14.4,
    },
    /** Obtención de objetos en partidas normales: progreso independiente por rareza; umbrales 60 / 90 / 120 puntos. */
    items: { points: { win: 1, draw: 0.75, loss: 0.5 }, thresholds: { poco_comun: 60, raro: 90, epico: 120 } },
    /** Multijugador: dirección del servidor de salas (wss://…). El jugador también puede cambiarla en Equipo. */
    multiplayer: { serverUrl: '' },
    towers: {
        side: { hp: 1600, dmg: 70, interval: 0.85, range: 8.4, radius: 1.15, projSpeed: 16 },
        /** Torre central: solo dispara cuando la dañan; alcance 7 casillas medido desde su borde (llega a todo lo que la ataque, incluso a distancia máxima 6,4) y más daño que las laterales. */
        king: { hp: 2600, dmg: 90, interval: 1.0, range: 7, radius: 1.5, projSpeed: 16 },
        sideY: { player: 25.5, enemy: 6.5 },
        kingY: { player: 29.4, enemy: 2.6 },
        sideX: [3.6, 14.4],
        /** Los ataques especiales hacen este porcentaje de su daño a torres (0.75–0.85). */
        specialMul: 0.8,
    },
    /**
     * ESCALA DE EQUILIBRIO de las unidades (ver docs/EQUILIBRIO.md).
     * Presupuesto de poder V = vBase * coste^vExp  (aprox. vida × DPS).
     * La forma (más vida o más daño) sale de las estadísticas base del Pokémon.
     */
    balance: {
        vBase: 9000,
        vExp: 1.5,
        hpK: 10.3,
        shapeExp: 0.85,
        /** Umbrales de BST -> coste de energía (el primero que cumpla BST <= umbral). */
        costByBst: [
            [230, 1],
            [300, 2],
            [340, 3],
            [420, 4],
            [480, 5],
            [525, 6],
            [560, 7],
            [610, 8],
        ],
        maxCost: 9,
        rangedVMul: 0.9,
        airVMul: 0.9,
        splashVMul: 0.88,
        fastVMul: 0.95,
        speed: { base: 0.45, span: 1.4, exp: 0.9, heavyMul: 0.65, rangedMul: 0.88, min: 0.6, max: 2.0 },
        /** Tamaño visual: factor de altura en casillas y radio de colisión por clase de tamaño (1..5). */
        sizeTiles: [0, 1.35, 1.6, 2.05, 2.4, 3.0],
        sizeRadius: [0, 0.36, 0.44, 0.54, 0.68, 0.9],
        /** Efectividad de tipos adaptada a la escala del juego (ver typeMult). */
        typeExp: 0.43,
        typeMin: 0.55,
        typeMax: 1.6,
        typeImmune: 0.4,
    },
    /**
     * NIVELES DE POKÉMON (como Clash Royale). Las cartas repetidas suben el nivel con "copias" + monedas.
     * Cada nivel multiplica vida y daño por (1 + perLevel·(N-1)). El nivel máximo depende del COSTE de la carta,
     * así una carta de coste 3 al máximo nunca supera en daño/poder a una de coste 8 (lo comprueban las pruebas).
     */
    cardLevels: {
        perLevel: 0.06,
        /** Bonos extra por nivel: ataque más rápido y especial con recarga más corta. */
        atkSpeedPerLevel: 0.008,
        specialCdPerLevel: 0.012,
        /** Nivel máximo = capBase + ceil(coste / 2), con tope capMax. */
        capBase: 7,
        capMax: 12,
        /** Copias necesarias para pasar del nivel N al N+1 (índice N-1). */
        copies: [2, 3, 5, 8, 12, 18, 26, 38, 55, 80, 110],
        /** Monedas por subir: coinBase · N · multiplicador de rareza. */
        coinBase: 80,
        coinRarity: { comun: 1, poco_comun: 1.5, raro: 2.5, epico: 4, legendario: 6 },
        /** Copias que da cada duplicado según rareza (las más raras dan menos). */
        dupCopies: { comun: 2, poco_comun: 2, raro: 1, epico: 1, legendario: 1 },
    },
    /** Trofeos por partida contra la IA (nunca en entrenamiento). Cada generación limita el saldo a su propio máximo. */
    trophies: {
        version: 2,
        maxPerGeneration: 1000,
        win: { facil: 5, normal: 7, dificil: 10 },
        loss: { facil: -5, normal: -5, dificil: -8 },
        draw: 0,
    },
    /** Poké Balls gratis con temporizador: una cada `intervalH` horas, se acumulan hasta `max`. */
    freeBalls: { intervalH: 8, max: 3 },
    /** Niveles de las torres (el mismo para ambos bandos): multiplica vida y daño. */
    towerLevels: { perLevel: 0.05, max: 12 },
    /** Valores de las dificultades de la IA (misma energía y reglas que el jugador). */
    ai: {
        /** Peso del coste al valorar cartas para el mazo (hp × dps / coste^exp). */
        valueCostExp: 0,
        /** levelOffset es [con nivel medio ≤3, con 6, con ≥9] y se interpola por tramos: la IA se adapta de forma gradual al nivel del jugador.
         *  deckQuality es [nivel mínimo, valor]: a partir de ese nivel medio del jugador la IA elige sus cartas entre las mejores (por debajo, al azar; mezclar ambos empeoraba sus mazos).
         *  levelOffset: niveles de las cartas rival respecto al nivel medio del mazo del jugador. maxCost: coste máx. de sus cartas.
         *  deckQuality: probabilidad de elegir cada carta entre las mejores por vida × DPS / coste (0 = al azar). Sin ventajas de energía ni trampas. */
        facil: { thinkMin: 2.6, thinkMax: 4.2, mistake: 0.35, reserve: 0, counters: 0.0, useSpecial: 0.25, specialMin: 0.4, specialPatience: 0, specialTowerScale: 0, specialPressure: 99, itemChance: [0, 0, 0], itemRarities: [], maxEnergyHold: 9.5, levelOffset: [0.1, -0.25, -0.5], maxCost: 6, deckQuality: [8, 0] },
        normal: { thinkMin: 1.5, thinkMax: 2.6, mistake: 0.12, reserve: 1, counters: 0.6, useSpecial: 0.7, specialMin: 1.4, specialPatience: 8, specialTowerScale: 0.5, specialPressure: 6, itemChance: [0.2, 0.6, 1], itemRarities: ['poco_comun'], maxEnergyHold: 9, levelOffset: [0, 0, 0], maxCost: 7, deckQuality: [8, 0] },
        dificil: { thinkMin: 0.9, thinkMax: 1.6, mistake: 0.02, reserve: 2, counters: 1.0, useSpecial: 1.0, specialMin: 2.2, specialPatience: 10, specialTowerScale: 0.6, specialPressure: 5, itemChance: [0.5, 1, 1], itemRarities: ['poco_comun', 'epico'], maxEnergyHold: 8.5, levelOffset: [0.5, 1.3, 1.5], maxCost: 9, deckQuality: [8, 0.9] },
    },
    /**
     * ENTRENAMIENTO PERMANENTE (pantalla Entrenamiento). Cada punto de entrenamiento da +1 % a una estadística base del Pokémon
     * (PS, Ataque, Defensa, At. Esp., Def. Esp., Velocidad). Reglas de v1.5.0:
     *  · Máximo `maxLevel` puntos por estadística (= +8 %). Se impone en el perfil, en el guardado y en la simulación.
     *  · Máximo `maxStats` estadísticas entrenables por Pokémon: la elección se guarda al pagar el primer intento.
     *  · Coste en monedas = coinBase · factor de la carta (coste de energía / 3, entre cardCostMin y cardCostMax)
     *    · stageMul[puntos actuales de esa estadística] · statMul[estadística] · (1 + progressMulPerLevel · puntos totales ya invertidos en el Pokémon).
     *  · Cada intento gasta también cristales / medallas / núcleos (tablas por puntos actuales). Si falla, los recursos se pierden pero
     *    jamás se restan mejoras ya conseguidas.
     *  · Probabilidad de éxito = max(chanceMin, chanceBase − chancePerLevel · puntos actuales).
     */
    training: {
        maxLevel: 8,
        percentPerLevel: 1,
        maxStats: 3,
        coinBase: 260,
        cardCostMin: 0.5,
        cardCostMax: 2.5,
        stageMul: [1, 1.6, 2.4, 3.4, 4.6, 6, 7.6, 9.6],
        statMul: { hp: 1, atk: 1.15, def: 0.9, spa: 1.15, spd: 0.9, spe: 1.1 },
        progressMulPerLevel: 0.03,
        crystals: [1, 1, 2, 2, 3, 3, 4, 4],
        medals: [0, 0, 0, 1, 1, 1, 2, 2],
        cores: [0, 0, 0, 0, 0, 1, 1, 1],
        chanceBase: 0.82,
        chancePerLevel: 0.065,
        chanceMin: 0.22,
    },
    save: { key: 'pokemon-royale:save', backupKey: 'pokemon-royale:backup', schema: 4 },
};
export const DIFFICULTIES = ['facil', 'normal', 'dificil'];
export const DIFFICULTY_LABEL = {
    facil: 'Fácil',
    normal: 'Normal',
    dificil: 'Difícil',
};
