export function sp(name, type, delivery, power, cd, o = {}) {
    const radius = o.radius ?? (delivery === 'aoe' ? 2.2 : delivery === 'lob' ? 1.6 : delivery === 'zone' ? 1.8 : delivery === 'heal' ? 2.6 : delivery === 'beam' ? 0.7 : 0);
    const range = o.range ?? (delivery === 'aoe' || delivery === 'heal' ? radius : delivery === 'burst' ? 2.4 : delivery === 'beam' ? 6.0 : 5.5);
    const speed = o.speed ?? (delivery === 'lob' ? 7 : 15);
    const fx = o.fx ?? {};
    return {
        name, type, delivery, power, radius, range, cd, speed,
        zoneDur: o.zoneDur ?? 3.5, effects: fx,
        // Los golpes especiales de contacto (burst corto) solo alcanzan unidades terrestres.
        // Los ataques de alcance largo/área mantienen ambos objetivos salvo que la ficha indique hits explícitamente.
        hits: o.hits ?? (delivery === 'burst' && (o.range ?? 2.4) <= 2.8 ? 'ground' : 'both'),
        selfDestruct: o.selfDestruct, pool: o.pool,
        desc: describeSpecial({ delivery, power, radius, effects: fx, cd, selfDestruct: o.selfDestruct, hits: o.hits ?? 'both' }),
    };
}
function describeSpecial(s) {
    const parts = [];
    const dmg = `${s.power.toFixed(1)}× su daño por segundo`;
    switch (s.delivery) {
        case 'burst':
            parts.push(s.radius > 0 ? `Golpe en área (${dmg})` : `Golpe directo (${dmg})`);
            break;
        case 'bolt':
            parts.push(`Proyectil veloz (${dmg})`);
            break;
        case 'lob':
            parts.push(`Proyectil lento que explota en área (${dmg})`);
            break;
        case 'beam':
            parts.push(`Rayo que atraviesa a todas las unidades de la línea (${dmg})`);
            break;
        case 'aoe':
            parts.push(s.selfDestruct ? `Explosión que lo derrota (${dmg} en área)` : `Onda a su alrededor (${dmg})`);
            break;
        case 'zone':
            parts.push(`Zona de daño continuo (${dmg} en total)`);
            break;
        case 'heal':
            parts.push('Cura a los aliados cercanos');
            break;
    }
    const e = s.effects;
    if (e.slow)
        parts.push(`ralentiza ${Math.round(e.slow[0] * 100)} % durante ${e.slow[1]} s`);
    if (e.stun)
        parts.push(`aturde ${e.stun} s`);
    if (e.sleep)
        parts.push(`duerme ${e.sleep} s (se interrumpe al recibir daño)`);
    if (e.shieldPct)
        parts.push(`otorga escudo del ${Math.round(e.shieldPct * 100)} % durante ${e.shieldDur ?? 3} s`);
    if (e.push)
        parts.push('empuja');
    if (e.dot)
        parts.push(`daño continuo ${e.dot[1]} s`);
    if (e.healPct)
        parts.push(`${Math.round(e.healPct * 100)} % de la vida`);
    if (s.hits === 'ground')
        parts.push('solo terrestres');
    return parts.join(', ') + `. Recarga ${s.cd} s.`;
}
/* ───────── Ataques básicos (nombre por tipo, cuerpo a cuerpo / a distancia) ───────── */
export const BASIC_NAMES = {
    normal: { melee: 'Placaje', ranged: 'Onda Sónica' },
    fuego: { melee: 'Puño Fuego', ranged: 'Ascuas' },
    agua: { melee: 'Martillazo', ranged: 'Pistola Agua' },
    electrico: { melee: 'Puño Trueno', ranged: 'Impactrueno' },
    planta: { melee: 'Látigo Cepa', ranged: 'Hoja Afilada' },
    hielo: { melee: 'Puño Hielo', ranged: 'Nieve Polvo' },
    lucha: { melee: 'Golpe Kárate', ranged: 'Esfera Aural' },
    veneno: { melee: 'Colmillo Veneno', ranged: 'Ácido' },
    tierra: { melee: 'Bofetón Lodo', ranged: 'Disparo Lodo' },
    volador: { melee: 'Ataque Ala', ranged: 'Tornado' },
    psiquico: { melee: 'Cabezazo Zen', ranged: 'Confusión' },
    bicho: { melee: 'Doble Ataque', ranged: 'Zumbido' },
    roca: { melee: 'Golpe Roca', ranged: 'Lanzarrocas' },
    fantasma: { melee: 'Lengüetazo', ranged: 'Tinieblas' },
    dragon: { melee: 'Garra Dragón', ranged: 'Furia Dragón' },
    siniestro: { melee: 'Mordisco', ranged: 'Pulso Umbrío' },
    acero: { melee: 'Garra Metal', ranged: 'Foco Resplandor' },
};
/** Algunos básicos con nombre propio e icónico. */
export const BASIC_OVERRIDE = {
    4: 'Ascuas', 7: 'Pistola Agua', 1: 'Látigo Cepa', 25: 'Impactrueno', 26: 'Impactrueno',
    19: 'Ataque Rápido', 20: 'Hiper Colmillo', 129: 'Salpicadura', 113: 'Bomba Huevo', 143: 'Golpe Cuerpo',
    95: 'Cola Férrea', 150: 'Confusión', 151: 'Confusión', 74: 'Lanzarrocas', 66: 'Golpe Kárate',
    63: 'Confusión', 16: 'Tornado', 94: 'Lengüetazo', 52: 'Arañazo', 53: 'Arañazo', 133: 'Ataque Rápido',
};
/* ───────── Especiales por defecto: 3 variantes por tipo ───────── */
export const SPECIAL_POOL = {
    normal: [
        sp('Hiperrayo', 'normal', 'beam', 4.2, 16, { range: 6.5 }),
        sp('Golpe Cuerpo', 'normal', 'burst', 4.0, 12, { fx: { stun: 0.6 } }),
        sp('Vozarrón', 'normal', 'aoe', 3.0, 13, { radius: 2.5 }),
    ],
    fuego: [
        sp('Lanzallamas', 'fuego', 'beam', 3.4, 13, { fx: { dot: [1.2, 3] } }),
        sp('Llamarada', 'fuego', 'lob', 4.2, 15, { radius: 1.9 }),
        sp('Giro Fuego', 'fuego', 'zone', 4.0, 14, { radius: 1.6, zoneDur: 3.5 }),
    ],
    agua: [
        sp('Hidrobomba', 'agua', 'beam', 4.2, 15, { fx: { push: 0.7 } }),
        sp('Surf', 'agua', 'aoe', 3.2, 14, { radius: 2.7, fx: { push: 1.5 } }),
        sp('Rayo Burbuja', 'agua', 'bolt', 2.8, 11, { fx: { slow: [0.4, 3] } }),
    ],
    electrico: [
        sp('Rayo', 'electrico', 'bolt', 3.8, 12, { fx: { stun: 0.5 } }),
        sp('Onda Trueno', 'electrico', 'aoe', 1.4, 13, { radius: 2.5, fx: { slow: [0.5, 3.5] } }),
        sp('Trueno', 'electrico', 'burst', 4.2, 14, { range: 5.5, radius: 1.3 }),
    ],
    planta: [
        sp('Rayo Solar', 'planta', 'beam', 4.2, 16, { range: 6.5 }),
        sp('Hoja Afilada', 'planta', 'bolt', 3.4, 11),
        sp('Paralizador', 'planta', 'aoe', 1.4, 13, { radius: 2.4, fx: { slow: [0.45, 3.5] } }),
    ],
    hielo: [
        sp('Rayo Hielo', 'hielo', 'bolt', 3.2, 12, { fx: { slow: [0.4, 3] } }),
        sp('Ventisca', 'hielo', 'aoe', 3.0, 15, { radius: 2.9, fx: { slow: [0.45, 3] } }),
        sp('Puño Hielo', 'hielo', 'burst', 3.6, 12, { fx: { stun: 0.7 } }),
    ],
    lucha: [
        sp('Sumisión', 'lucha', 'burst', 4.4, 13),
        sp('Dinamopuño', 'lucha', 'burst', 3.4, 14, { fx: { stun: 0.9 } }),
        sp('Patada Giro', 'lucha', 'aoe', 3.4, 12, { radius: 1.9, hits: 'ground', fx: { push: 1.0 } }),
    ],
    veneno: [
        sp('Bomba Lodo', 'veneno', 'lob', 3.0, 13, { radius: 1.6, fx: { dot: [1.4, 4] } }),
        sp('Residuos', 'veneno', 'zone', 4.0, 14, { radius: 1.8, zoneDur: 4 }),
        sp('Ácido', 'veneno', 'bolt', 2.6, 11, { fx: { slow: [0.3, 3], dot: [0.8, 3] } }),
    ],
    tierra: [
        sp('Terremoto', 'tierra', 'aoe', 3.6, 14, { radius: 3.0, hits: 'ground' }),
        sp('Excavar', 'tierra', 'burst', 4.2, 12),
        sp('Tormenta Arena', 'tierra', 'zone', 3.0, 14, { radius: 2.2, zoneDur: 3.5, hits: 'ground', fx: { slow: [0.3, 1.5] } }),
    ],
    volador: [
        sp('Tornado', 'volador', 'aoe', 2.6, 12, { radius: 2.2, fx: { push: 1.4 } }),
        sp('Pico Taladro', 'volador', 'burst', 4.2, 13),
        sp('Ataque Aéreo', 'volador', 'bolt', 3.8, 13),
    ],
    psiquico: [
        sp('Psíquico', 'psiquico', 'bolt', 3.6, 12, { fx: { slow: [0.35, 2.5] } }),
        sp('Psicorrayo', 'psiquico', 'beam', 3.2, 13),
        sp('Psicocarga', 'psiquico', 'aoe', 3.2, 13, { radius: 2.3 }),
    ],
    bicho: [
        sp('Pin Misil', 'bicho', 'bolt', 3.4, 11),
        sp('Tijera X', 'bicho', 'aoe', 3.6, 12, { radius: 1.8 }),
        sp('Disparo Demora', 'bicho', 'aoe', 1.0, 13, { radius: 2.5, fx: { slow: [0.6, 3.5] } }),
    ],
    roca: [
        sp('Avalancha', 'roca', 'lob', 4.0, 14, { radius: 1.9 }),
        sp('Lanzarrocas', 'roca', 'bolt', 3.4, 11, { fx: { push: 0.5 } }),
        sp('Roca Afilada', 'roca', 'burst', 4.6, 14),
    ],
    fantasma: [
        sp('Bola Sombra', 'fantasma', 'bolt', 3.4, 12, { fx: { slow: [0.3, 3] } }),
        sp('Maldición', 'fantasma', 'bolt', 2.0, 13, { fx: { dot: [2.2, 5] } }),
        sp('Come Sueños', 'fantasma', 'burst', 4.0, 13, { range: 4.0 }),
    ],
    dragon: [
        sp('Pulso Dragón', 'dragon', 'beam', 4.0, 14),
        sp('Enfado', 'dragon', 'aoe', 3.6, 14, { radius: 2.1 }),
        sp('Furia Dragón', 'dragon', 'burst', 4.4, 12, { range: 4.5 }),
    ],
    siniestro: [
        sp('Pulso Umbrío', 'siniestro', 'bolt', 3.4, 12),
        sp('Mordisco', 'siniestro', 'burst', 3.8, 12, { fx: { stun: 0.5 } }),
        sp('Tinieblas', 'siniestro', 'aoe', 3.0, 13, { radius: 2.2 }),
    ],
    acero: [
        sp('Foco Resplandor', 'acero', 'beam', 3.4, 13),
        sp('Cabeza Hierro', 'acero', 'burst', 3.8, 12, { fx: { stun: 0.6 } }),
        sp('Garra Metal', 'acero', 'burst', 3.4, 11),
    ],
};
/* ───────── Especiales icónicos por especie ───────── */
const METRONOME_POOL = [
    sp('Psíquico', 'psiquico', 'bolt', 3.8, 1, { fx: { slow: [0.35, 2.5] } }),
    sp('Lanzallamas', 'fuego', 'beam', 3.6, 1, { fx: { dot: [1.2, 3] } }),
    sp('Hidrobomba', 'agua', 'beam', 4.0, 1, { fx: { push: 0.7 } }),
    sp('Rayo', 'electrico', 'bolt', 3.8, 1, { fx: { stun: 0.5 } }),
    sp('Ventisca', 'hielo', 'aoe', 3.0, 1, { radius: 2.9, fx: { slow: [0.45, 3] } }),
    sp('Terremoto', 'tierra', 'aoe', 3.4, 1, { radius: 3.0, hits: 'ground' }),
];
export const SPECIAL_OVERRIDE = {
    3: sp('Rayo Solar', 'planta', 'beam', 4.4, 15, { range: 6.5, radius: 0.9 }),
    6: sp('Lanzallamas', 'fuego', 'beam', 3.6, 12, { fx: { dot: [1.3, 3] } }),
    9: sp('Hidrocañón', 'agua', 'beam', 4.6, 15, { range: 6.5, fx: { push: 0.8 } }),
    12: sp('Somnífero', 'bicho', 'aoe', 0.7, 15, { radius: 2.3, fx: { sleep: 1.6, slow: [0.2, 1.5] } }),
    25: sp('Rayo', 'electrico', 'bolt', 4.0, 10, { fx: { stun: 0.5 }, speed: 18 }),
    26: sp('Trueno', 'electrico', 'burst', 4.4, 12, { range: 5.5, radius: 1.4, fx: { stun: 0.4 } }),
    35: sp('Canto', 'normal', 'aoe', 0.6, 17, { radius: 2.2, fx: { sleep: 1.2 } }),
    36: sp('Canto', 'normal', 'aoe', 0.8, 17, { radius: 2.5, fx: { sleep: 1.4 } }),
    39: sp('Canto', 'normal', 'aoe', 0.6, 17, { radius: 2.2, fx: { sleep: 1.2 } }),
    40: sp('Canto', 'normal', 'aoe', 0.8, 17, { radius: 2.5, fx: { sleep: 1.4 } }),
    59: sp('Envite Ígneo', 'fuego', 'burst', 4.8, 13, { fx: { dot: [0.8, 2] } }),
    65: sp('Psíquico', 'psiquico', 'bolt', 4.4, 12, { fx: { slow: [0.4, 3] }, speed: 18 }),
    68: sp('Sumisión', 'lucha', 'burst', 5.0, 13),
    80: sp('Psíquico', 'psiquico', 'bolt', 3.4, 13, { fx: { slow: [0.4, 3] } }),
    94: sp('Bola Sombra', 'fantasma', 'bolt', 3.2, 11, { fx: { slow: [0.35, 3], dot: [1.2, 3] } }),
    95: sp('Terremoto', 'tierra', 'aoe', 4.0, 14, { radius: 3.2, hits: 'ground', fx: { push: 1.2 } }),
    96: sp('Hipnosis', 'psiquico', 'burst', 0.4, 17, { range: 5.0, fx: { sleep: 1.5 } }),
    97: sp('Hipnosis', 'psiquico', 'burst', 0.5, 17, { range: 5.5, fx: { sleep: 1.7 } }),
    100: sp('Autodestrucción', 'normal', 'aoe', 5.0, 99, { radius: 2.3, selfDestruct: true }),
    101: sp('Explosión', 'normal', 'aoe', 7.0, 99, { radius: 2.9, selfDestruct: true }),
    106: sp('Patada Salto Alta', 'lucha', 'burst', 5.2, 13),
    107: sp('Puño Fuego', 'fuego', 'burst', 4.4, 12, { fx: { dot: [1.0, 3] } }),
    113: sp('Amortiguador', 'normal', 'heal', 0, 13, { radius: 3.0, fx: { healPct: 0.28 } }),
    122: sp('Pantalla de Luz', 'psiquico', 'heal', 0, 16, { radius: 3.2, fx: { shieldPct: 0.10, shieldDur: 3.0 } }),
    123: sp('Tijera X', 'bicho', 'aoe', 3.8, 12, { radius: 1.9 }),
    129: sp('Salpicadura', 'agua', 'aoe', 0.2, 6, { radius: 1.3, fx: { push: 0.6 } }),
    130: sp('Hiperrayo', 'normal', 'beam', 4.6, 16, { range: 6.5 }),
    131: sp('Ventisca', 'hielo', 'aoe', 3.2, 15, { radius: 3.0, fx: { slow: [0.45, 3.5] } }),
    134: sp('Hidrobomba', 'agua', 'beam', 4.2, 14, { fx: { push: 0.7 } }),
    135: sp('Rayo', 'electrico', 'bolt', 4.0, 11, { fx: { stun: 0.5 } }),
    136: sp('Lanzallamas', 'fuego', 'beam', 3.6, 13, { fx: { dot: [1.2, 3] } }),
    142: sp('Roca Afilada', 'roca', 'burst', 4.8, 13),
    143: sp('Golpe Cuerpo', 'normal', 'burst', 4.6, 13, { fx: { stun: 0.8 } }),
    144: sp('Ventisca', 'hielo', 'aoe', 3.4, 14, { radius: 3.0, fx: { slow: [0.5, 3.5] } }),
    145: sp('Trueno', 'electrico', 'burst', 4.8, 13, { range: 6.0, radius: 1.5, fx: { stun: 0.5 } }),
    146: sp('Llamarada', 'fuego', 'lob', 4.6, 14, { radius: 2.1, fx: { dot: [1.0, 3] } }),
    149: sp('Pulso Dragón', 'dragon', 'beam', 4.4, 13, { fx: { push: 0.6 } }),
    150: sp('Psíquico', 'psiquico', 'bolt', 4.8, 12, { fx: { slow: [0.4, 3], stun: 0.4 }, speed: 20 }),
    151: sp('Metrónomo', 'normal', 'bolt', 3.8, 10, { pool: METRONOME_POOL }),
};
