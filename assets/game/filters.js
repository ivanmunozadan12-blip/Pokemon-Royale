export const noFilter = () => ({ q: '', type: '', rarity: '', cost: 0, status: 'todos' });
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Búsqueda por nombre (sin tildes ni mayúsculas) o número de Pokédex, más filtros de tipo, rareza, coste y estado. */
export function filterSpecies(list, f, unlocked) {
    const q = fold(f.q.trim());
    const num = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null;
    return list.filter((s) => {
        if (q) {
            if (num !== null) {
                if (s.id !== num)
                    return false;
            }
            else if (!fold(s.nameEs).includes(q) && !fold(s.slug).includes(q))
                return false;
        }
        if (f.type && !s.types.includes(f.type))
            return false;
        if (f.rarity && s.rarity !== f.rarity)
            return false;
        if (f.cost && s.cost !== f.cost)
            return false;
        const u = unlocked(s.id);
        if (f.status === 'desbloqueados' && !u)
            return false;
        if (f.status === 'bloqueados' && u)
            return false;
        return true;
    });
}
