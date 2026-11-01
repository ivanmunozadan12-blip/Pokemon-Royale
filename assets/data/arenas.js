/** Generaciones disponibles. Las futuras generaciones se incorporan añadiendo sus arenas y límites aquí. */
export const GENERATIONS = [
    { id: 'kanto', name: 'Kanto', maxTrophies: 1000, arenaCount: 10 },
];
export const GENERATION_BY_ID = new Map(GENERATIONS.map((g) => [g.id, g]));
export const ARENAS = [
    { id: 'pewter', generation: 'kanto', order: 1, name: 'Gimnasio de Ciudad Plateada', city: 'Ciudad Plateada', leader: 'Brock', badge: 'Medalla Roca', type: 'roca', minTrophies: 0,
        desc: 'Terreno rocoso y polvoriento entre peñascos y estalagmitas. El primer reto de Kanto.' },
    { id: 'cerulean', generation: 'kanto', order: 2, name: 'Gimnasio de Ciudad Celeste', city: 'Ciudad Celeste', leader: 'Misty', badge: 'Medalla Cascada', type: 'agua', minTrophies: 100,
        desc: 'Una piscina gigante con nenúfares, boyas y cubierta de baldosas azules.' },
    { id: 'vermilion', generation: 'kanto', order: 3, name: 'Gimnasio de Ciudad Carmín', city: 'Ciudad Carmín', leader: 'Lt. Surge', badge: 'Medalla Trueno', type: 'electrico', minTrophies: 200,
        desc: 'Una fábrica militar de suelo metálico, canales eléctricos y bobinas de Tesla.' },
    { id: 'celadon', generation: 'kanto', order: 4, name: 'Gimnasio de Ciudad Azulona', city: 'Ciudad Azulona', leader: 'Erika', badge: 'Medalla Arcoíris', type: 'planta', minTrophies: 300,
        desc: 'Un jardín florido con estanque de lotos, setos y faroles de papel.' },
    { id: 'fuchsia', generation: 'kanto', order: 5, name: 'Gimnasio de Ciudad Fucsia', city: 'Ciudad Fucsia', leader: 'Koga', badge: 'Medalla Alma', type: 'veneno', minTrophies: 400,
        desc: 'Un dojo de ninjas entre bambú, vapores tóxicos y estanques de color esmeralda.' },
    { id: 'saffron', generation: 'kanto', order: 6, name: 'Gimnasio de Ciudad Azafrán', city: 'Ciudad Azafrán', leader: 'Sabrina', badge: 'Medalla Pantano', type: 'psiquico', minTrophies: 500,
        desc: 'Una sala psíquica de geometría imposible, cristales violetas y plataformas suspendidas.' },
    { id: 'cinnabar', generation: 'kanto', order: 7, name: 'Gimnasio de Isla Canela', city: 'Isla Canela', leader: 'Blaine', badge: 'Medalla Volcán', type: 'fuego', minTrophies: 600,
        desc: 'Una arena volcánica de roca negra, grietas incandescentes y calor de la isla.' },
    { id: 'viridian', generation: 'kanto', order: 8, name: 'Gimnasio de Ciudad Verde', city: 'Ciudad Verde', leader: 'Giovanni', badge: 'Medalla Tierra', type: 'tierra', minTrophies: 700,
        desc: 'Un gimnasio final de piedra antigua, muros verdes y ornamentación de tierra.' },
    { id: 'victory-road', generation: 'kanto', order: 9, name: 'Camino a la Liga Pokémon', city: 'Camino a la Liga', leader: 'Alto mando', badge: 'Paso de la Victoria', type: 'roca', minTrophies: 800,
        desc: 'Un desfiladero de montaña que conduce a la Meseta Añil, con roca expuesta y un camino monumental.' },
    { id: 'indigo-plateau', generation: 'kanto', order: 10, name: 'Liga Pokémon de Kanto', city: 'Meseta Añil', leader: 'Campeón', badge: 'Liga Pokémon', type: 'psiquico', minTrophies: 900,
        desc: 'La arena culminante de Kanto, con mármol, detalles dorados y una atmósfera de gran final.' },
];
export function getGeneration(id = 'kanto') {
    return GENERATION_BY_ID.get(id) ?? GENERATIONS[0];
}
export function getArena(id) {
    return ARENAS.find((a) => a.id === id) ?? ARENAS[0];
}
/** Arena más alta desbloqueada con esos trofeos; el máximo se limita a la generación. */
export function arenaForTrophies(trophies, generation = 'kanto') {
    const gen = getGeneration(generation);
    const score = Math.max(0, Math.min(gen.maxTrophies, Number(trophies) || 0));
    let best = ARENAS.find((a) => a.generation === gen.id) ?? ARENAS[0];
    for (const a of ARENAS)
        if (a.generation === gen.id && score >= a.minTrophies)
            best = a;
    return best;
}
export function arenaForTrophyBoundary(trophies, generation = 'kanto') {
    return arenaForTrophies(trophies, generation);
}
