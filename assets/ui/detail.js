import { RARITY_LABEL } from "../config.js";
import { TARGET_LABEL, getSpecies } from "../data/species.js";
import { TYPE_LABEL } from "../data/types.js";
import { leveled } from "../data/levels.js";
import { openLearning } from "./learnmodal.js";
import { applyLearned } from "../game/learning.js";
import { abilityFor } from "../data/abilities.js";
import { coinIcon, fmt, h, modal, rarityTag, spriteImg, toast, typeChip } from "./dom.js";
function statBar(label, v, max = 160) {
    return h('div', { class: 'statbar' }, h('span', null, label), h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (v / max) * 100)}%` })), h('b', null, String(v)));
}
/** Ficha completa de un Pokémon (colección, editor de mazos, entrenamiento). */
export function showDetail(profile, id, actions = null) {
    const owned = profile.isUnlocked(id);
    const lvl = profile.levelOf(id);
    const sp = applyLearned(leveled(id, lvl), profile.deckMoves([id])[String(id)], lvl);
    const base = getSpecies(id);
    const passive = abilityFor(id);
    const abilityDescriptions = {
        low_hp_grass:'Aumenta un 16 % el daño cuando baja del 35 % de vida.',
        low_hp_fire:'Aumenta un 16 % el daño cuando baja del 35 % de vida.',
        low_hp_water:'Aumenta un 16 % el daño cuando baja del 35 % de vida.',
        low_hp_bug:'Aumenta un 14 % el daño cuando baja del 35 % de vida.',
        entry_intimidate:'Al entrar, reduce un 10 % el daño de enemigos cercanos durante 3 s.',
        fire_absorb:'Absorbe impactos de fuego y recupera hasta un 6 % de su vida máxima.',
        water_absorb:'Absorbe impactos de agua y recupera hasta un 6 % de su vida máxima.',
        electric_absorb:'Absorbe impactos eléctricos y recupera hasta un 6 % de su vida máxima.',
        survival_once:'Una vez por despliegue, evita caer derrotado al cruzar el 20 % de vida.',
        regen_reserve:'Recupera un 1,2 % de vida máxima cada 3 segundos.',
        status_cleanse:'Elimina periódicamente algunos estados alterados.',
        contact_slow:'Puede ralentizar brevemente al atacante que le daña.',
        contact_poison:'Puede envenenar al atacante que le daña.',
        contact_spore:'Puede ralentizar al atacante que le daña.',
        pressure_aura:'Los enemigos cercanos tardan ligeramente más en atacar.',
        energy_pickup:'Al derrotar a un enemigo recupera una pequeña cantidad de energía.',
        sun_speed:'Se mueve más rápido bajo sol intenso.',
        rain_speed:'Se mueve más rápido bajo lluvia.',
        tower_hunter:'Inflige un 8 % más de daño a las torres.',
        status_guard:'Reduce la duración de determinados estados alterados.',
        sleep_guard:'Es inmune al sueño.',
        status_echo:'Puede devolver parcialmente una ralentización al atacante.',
    };
    const passivePanel = h('section',{class:'panel stack',style:'padding:10px'},h('b',null,`Habilidad pasiva · ${passive.ability}`),h('div',{class:'sub'},abilityDescriptions[passive.effect]??'Proporciona una ventaja pasiva moderada según sus condiciones de activación.'),h('div',{class:'sub'},`Activación: ${passive.trigger}`));
    let handle = null;
    const up = profile.upgradeInfo(id);
    const levelPanel = owned && h('div', { class: 'panel stack', id: 'level-panel', style: 'padding:8px' }, h('div', { class: 'row between' }, h('b', { id: 'lvl-now' }, `Nivel ${lvl} / ${up.max}`), up.atMax ? h('span', { class: 'rtag', style: 'background:var(--gold2);color:#000' }, 'Nivel máximo') : h('span', { class: 'sub' }, `${up.copies}/${up.needCopies} copias`)), !up.atMax && h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (up.copies / up.needCopies) * 100)}%` })), !up.atMax && h('button', { class: 'btn btn-gold sm', type: 'button', id: 'upgrade-btn', disabled: !up.can, on: { click: () => {
                const r = profile.upgrade(id);
                if (r.ok) {
                    toast(`${base.nameEs} sube al nivel ${r.level}`, 'ok');
                    handle?.close();
                    showDetail(profile, id, actions);
                }
                else
                    toast('No se puede mejorar todavía', 'err');
            } } }, h('span', { class: 'row', style: 'gap:4px;justify-content:center' }, 'Mejorar · ', coinIcon(), fmt(up.coins))), h('div', { class: 'sub' }, up.atMax ? `Este Pokémon (coste ${base.cost}) no puede subir más: el tope depende de su coste.` : 'Consigue copias con Poké Balls repetidas. Cada nivel da más vida y daño, ataca algo más rápido y recarga antes su especial.'));
    const learnPanel = owned && ['basic', 'special'].map((slot) => {
        const li = profile.learnInfo(id, slot);
        const isB = slot === 'basic';
        const learnedName = isB ? (li.chosen !== null ? ((profile.learnInfo(id, 'basic').candidates.find((c) => c.id === li.chosen) ?? { name: 'Ataque aprendido' }).name) : null) : li.chosen;
        const state = !li.reached ? `Se desbloquea al nivel ${li.need} (ahora ${li.level})` : li.done ? (li.chosen !== null ? `Aprendido: ${learnedName ?? 'ataque elegido'}` : 'Decidido: mantiene el ataque original') : li.candidates.length ? 'Disponible: puedes elegir un ataque nuevo' : 'Sin alternativas oficiales equivalentes para este Pokémon';
        return h('div', { class: 'row between', style: 'gap:8px;flex-wrap:wrap', data: { learn: slot } }, h('span', { class: 'sub', style: 'flex:1;min-width:150px' }, `${isB ? 'Cambiar ataque básico' : 'Cambiar ataque especial'}: ${state}`), li.pending && h('button', { class: 'btn btn-green sm', type: 'button', data: { learnOpen: slot }, on: { click: () => { handle?.close(); openLearning(profile, id, slot, () => showDetail(profile, id, actions)); } } }, 'Elegir'));
    });
    const s = sp.special;
    const body = h('div', { class: 'stack' }, passivePanel, h('div', { class: 'detail' }, h('div', { class: 'big' }, spriteImg(id, 'f', `${owned ? '' : 'sil'}${profile.isShinySelected(id) ? ' shiny' : ''}`)), h('div', { class: 'stack' }, h('div', { class: 'row' }, h('b', { style: 'font-size:20px' }, sp.nameEs), h('span', { class: 'sub' }, `#${String(id).padStart(3, '0')}`)), h('div', { class: 'tlist' }, sp.types.map((t) => typeChip(t)), rarityTag(sp.rarity)), h('div', { class: 'sub' }, sp.desc), owned && lvl > 1 && h('div', { class: 'sub', style: 'color:#ffe27a' }, `Estadísticas de nivel ${lvl}`), h('div', { class: 'row' }, h('span', { class: 'en-ico' }), h('b', null, `Coste ${sp.cost}`), owned ? h('span', { class: 'rtag', style: 'background:var(--good)' }, 'Desbloqueado') : h('span', { class: 'rtag', style: 'background:#8892a8' }, 'Bloqueado')))), owned && profile.hasShiny(id) && h('section', { class: 'panel stack shiny-panel' }, h('b', null, '✨ Variante shiny obtenida'), h('div', { class: 'sub' }, 'La variante shiny mejora un 20 % la estadística base más baja de este Pokémon.'), h('button', { class: 'btn btn-gold sm', type: 'button', id: 'toggle-shiny', on: { click: () => { const on = profile.toggleShiny(id); handle?.close(); showDetail(profile, id, actions); toast(on ? 'Variante shiny equipada' : 'Variante normal equipada', 'ok'); } } }, profile.isShinySelected(id) ? 'Usar variante normal' : 'Usar variante shiny')), levelPanel, learnPanel && h('section', { class: 'panel stack', id: 'learn-panel', style: 'padding:8px' }, h('b', null, 'Aprendizaje de ataques'), ...learnPanel), h('dl', { class: 'kv' }, h('dt', null, 'Vida'), h('dd', null, String(sp.hp)), h('dt', null, 'Ataque básico'), h('dd', null, `${sp.attackName} (${TYPE_LABEL[sp.attackType]}, ${sp.damageKind === 'fisico' ? 'físico' : 'especial'})`), h('dt', null, 'Daño'), h('dd', null, `${sp.dmg} cada ${sp.interval} s (${sp.dps} por s)`), h('dt', null, 'Alcance'), h('dd', null, sp.ranged ? `${sp.range} casillas (a distancia)` : sp.range > 1 ? `${sp.range} casillas` : 'Cuerpo a cuerpo'), h('dt', null, 'Velocidad'), h('dd', null, `${sp.speed} casillas/s`), h('dt', null, 'Movimiento'), h('dd', null, sp.flying ? 'Aéreo' : 'Terrestre'), h('dt', null, 'Alcanza'), h('dd', null, TARGET_LABEL[sp.targets]), h('dt', null, 'Tamaño'), h('dd', null, ['', 'Diminuto', 'Pequeño', 'Mediano', 'Grande', 'Enorme'][sp.sizeClass]), sp.splash > 0 ? [h('dt', null, 'Área'), h('dd', null, 'Sus golpes alcanzan a varias unidades')] : null), h('div', { class: 'panel', style: 'padding:8px' }, h('div', { class: 'row' }, h('b', null, `⚡ Especial: ${s.pool ? 'Metrónomo' : s.name}`), s.pool ? null : typeChip(s.type, true)), h('div', { class: 'sub' }, s.desc)), h('div', null, h('div', { class: 'sub' }, 'Débil contra'), h('div', { class: 'tlist' }, sp.weak.length ? sp.weak.map((t) => typeChip(t, true)) : h('span', { class: 'sub' }, 'Nada')), h('div', { class: 'sub', style: 'margin-top:4px' }, 'Resiste'), h('div', { class: 'tlist' }, sp.resist.length ? sp.resist.map((t) => typeChip(t, true)) : h('span', { class: 'sub' }, 'Nada'))), h('div', null, h('div', { class: 'sub' }, 'Estadísticas base (videojuegos)'), statBar('PS', sp.base.hp), statBar('Ataque', sp.base.atk), statBar('Defensa', sp.base.def), statBar('At. Esp.', sp.base.spa), statBar('Def. Esp.', sp.base.spd), statBar('Velocidad', sp.base.spe)), h('div', { class: 'sub' }, `Obtención: ${profile.obtainText(id)}. Rareza ${RARITY_LABEL[sp.rarity]}.`));
    handle = modal(sp.nameEs, body, { wide: true, actions });
}
