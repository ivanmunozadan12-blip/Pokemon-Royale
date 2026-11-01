import { getSpecies } from "../data/species.js";
import { LEARN_BASICS } from "../data/learnsets.js";
import { rawEffectiveness } from "../data/types.js";
import { ABILITIES } from "../data/abilities.js";
import { MOVE_META } from "./move-metadata.js";
import { MOVE_EFFECT_META, MOVE_STAT_CHANGES } from "./move-effects.js";
import { resolveGender } from "./gender-rates.js";

export const IMPLEMENTED_ABILITY_EFFECTS = new Set(["low_hp_grass","low_hp_fire","low_hp_water","low_hp_bug","status_rage","entry_intimidate","contact_slow","contact_poison","contact_burn","contact_spore","water_absorb","electric_absorb","fire_absorb","crit_guard","survival_once","ground_resist","sleep_guard","slow_resist","status_echo","stat_guard","attack_guard","recoil_guard","pressure_aura","weather_neutral","lane_snare","adaptive_copy","confusion_guard","regen_reserve","status_guard","status_cleanse","accuracy_focus","precision","contact_charm","fear_pulse","control_guard","sun_speed","rain_speed","sand_evasion","retreat_speed","electric_focus","sound_guard","reveal","energy_pickup","damage_padding"]);
export const PENDING_ABILITY_EFFECTS = new Set();
const ABILITY_BY_ID = new Map(ABILITIES.map(x => [x.id, x]));

// Generación 9 como referencia mecánica para el formato individual de Royale.
// Los datos de movimiento no disponibles en el learnset se mantienen explícitamente
// como fallback; no se hacen pasar por datos oficiales verificados.
const EXTRA = {
  "Danza Espada": {type:"normal",category:"status",power:0,accuracy:100,pp:20,effect:{boost:{atk:2}}},
  "Refugio": {type:"normal",category:"status",power:0,accuracy:100,pp:40,effect:{boost:{def:1}}},
  "Protección": {type:"normal",category:"status",power:0,accuracy:100,pp:10,priority:4,effect:{protect:true}},
  "Mofa": {type:"siniestro",category:"status",power:0,accuracy:100,pp:20,effect:{taunt:true}},
  "Descanso": {type:"psiquico",category:"status",power:0,accuracy:100,pp:5,effect:{rest:true}},
  "Drenadoras": {type:"planta",category:"status",power:0,accuracy:90,pp:10,effect:{leech:true}},
  "Gruñido": {type:"normal",category:"status",power:0,accuracy:100,pp:40,effect:{lower:{atk:1}}},
  "Pantalla de Humo": {type:"normal",category:"status",power:0,accuracy:100,pp:20,effect:{lower:{accuracy:1}}},
  "Síntesis": {type:"planta",category:"status",power:0,accuracy:100,pp:5,effect:{heal:.5}},
  "Rayo": {type:"electrico",category:"special",power:90,accuracy:100,pp:15,effect:{status:"paralysis",chance:10}},
  "Lanzallamas": {type:"fuego",category:"special",power:90,accuracy:100,pp:15,effect:{status:"burn",chance:10}},
  "Rayo Hielo": {type:"hielo",category:"special",power:90,accuracy:100,pp:10,effect:{status:"freeze",chance:10}},
  "Tóxico": {type:"veneno",category:"status",power:0,accuracy:90,pp:10,effect:{status:"toxic"}},
  "Polvo Veneno": {type:"veneno",category:"status",power:0,accuracy:75,pp:35,effect:{status:"poison"}},
  "Somnífero": {type:"planta",category:"status",power:0,accuracy:75,pp:15,effect:{status:"sleep"}},
  "Onda Trueno": {type:"electrico",category:"status",power:0,accuracy:90,pp:20,effect:{status:"paralysis"}},
  "Ataque Rápido": {type:"normal",category:"physical",power:40,accuracy:100,pp:30,priority:1},
  "Acua Jet": {type:"agua",category:"physical",power:40,accuracy:100,pp:20,priority:1},
  "Puño Bala": {type:"acero",category:"physical",power:40,accuracy:100,pp:30,priority:1},
  "Canto Helado": {type:"hielo",category:"physical",power:40,accuracy:100,pp:30,priority:1},
  "Sombra Vil": {type:"fantasma",category:"physical",power:40,accuracy:100,pp:30,priority:1},
  "Ultrapuño": {type:"lucha",category:"physical",power:40,accuracy:100,pp:30,priority:1},
  "Velocidad Extrema": {type:"normal",category:"physical",power:80,accuracy:100,pp:5,priority:2},
  "Placaje": {type:"normal",category:"physical",power:40,accuracy:100,pp:35,contact:true},
  "Picadura": {type:"bicho",category:"physical",power:60,accuracy:100,pp:20,contact:true},
  "Disparo Demora": {type:"bicho",category:"status",power:0,accuracy:95,pp:40,effect:{lower:{spe:2}}},
  "Picotazo Veneno": {type:"veneno",category:"physical",power:15,accuracy:100,pp:35,effect:{status:"poison",chance:30}},
  "Fortaleza": {type:"normal",category:"status",power:0,accuracy:100,pp:30,effect:{boost:{def:1}}},
  "Doble Patada": {type:"lucha",category:"physical",power:30,accuracy:100,pp:30,hits:2},
  "Mordisco": {type:"siniestro",category:"physical",power:60,accuracy:100,pp:25,effect:{flinch:30},contact:true},
  "Huesomerang": {type:"tierra",category:"physical",power:50,accuracy:90,pp:10,hits:2},
  "Smog": {type:"veneno",category:"special",power:30,accuracy:70,pp:20,effect:{status:"poison",chance:40}},
  "Guillotina": {type:"normal",category:"physical",power:0,accuracy:30,pp:5,effect:{ohko:true}},
  "Terremoto": {type:"tierra",category:"physical",power:100,accuracy:100,pp:10},
  "Salpicadura": {type:"normal",category:"status",power:0,accuracy:100,pp:40,effect:{}},
  "Azote": {type:"normal",category:"physical",power:20,accuracy:100,pp:15,effect:{variablePower:"flail"}},
  "Transformación": {type:"normal",category:"status",power:0,accuracy:100,pp:10,effect:{transform:true}},
  "Recuperación": {type:"normal",category:"status",power:0,accuracy:100,pp:5,effect:{heal:.5}},
  "Bola Sombra": {type:"fantasma",category:"special",power:80,accuracy:100,pp:15,effect:{lower:{spd:1},chance:20}},
  "Ventisca": {type:"hielo",category:"special",power:110,accuracy:70,pp:5,effect:{status:"freeze",chance:10}},
  "Poder Pasado": {type:"roca",category:"special",power:60,accuracy:100,pp:5,effect:{boost:{atk:1,def:1,spa:1,spd:1,spe:1},chance:10}},
  "Danza Dragón": {type:"dragon",category:"status",power:0,accuracy:100,pp:20,effect:{boost:{atk:1,spe:1}}},
  "Confusión": {type:"psiquico",category:"special",power:50,accuracy:100,pp:25,effect:{confuse:true,chance:10}},
  "Trampa Rocas": {type:"roca",category:"status",power:0,accuracy:100,pp:20,effect:{hazard:"stealthRock"}},
  "Púas": {type:"tierra",category:"status",power:0,accuracy:100,pp:20,effect:{hazard:"spikes"}},
  "Púas Tóxicas": {type:"veneno",category:"status",power:0,accuracy:100,pp:20,effect:{hazard:"toxicSpikes"}},
  "Red Viscosa": {type:"bicho",category:"status",power:0,accuracy:100,pp:20,effect:{hazard:"stickyWeb"}},
  "Giro Rápido": {type:"normal",category:"physical",power:50,accuracy:100,pp:40,effect:{clearHazards:true,boost:{spe:1}}},
  "Despejar": {type:"volador",category:"status",power:0,accuracy:100,pp:15,effect:{clearAllHazards:true,lowerTarget:{evasion:1}}},
  "Pantalla Luz": {type:"psiquico",category:"status",power:0,accuracy:100,pp:30,effect:{screen:"light"}},
  "Reflejo": {type:"psiquico",category:"status",power:0,accuracy:100,pp:20,effect:{screen:"reflect"}},
  "Día Soleado": {type:"fuego",category:"status",power:0,accuracy:100,pp:5,effect:{weather:"sun"}},
  "Danza Lluvia": {type:"agua",category:"status",power:0,accuracy:100,pp:5,effect:{weather:"rain"}},
  "Tormenta Arena": {type:"roca",category:"status",power:0,accuracy:100,pp:10,effect:{weather:"sand"}},
  "Granizo": {type:"hielo",category:"status",power:0,accuracy:100,pp:10,effect:{weather:"hail"}},
  "Espacio Raro": {type:"psiquico",category:"status",power:0,accuracy:100,pp:5,priority:-7,effect:{trickRoom:true}},
  "Falso Tortazo": {type:"normal",category:"physical",power:40,accuracy:100,pp:40,effect:{falseSwipe:true}},
};
const MOVE_PRIORITY = {"Ataque Rápido":1,"Aqua Jet":1,"Acua Jet":1,"Puño Bala":1,"Canto Helado":1,"Sombra Vil":1,"Ultrapuño":1,"Velocidad Extrema":2,"Fake Out":3,"Protección":4,"Detección":4,"Aguante":4,"Endurecer":4,"Escudo Real":4,"Espacio Raro":-7};
const MOVE_EFFECTS = {
  "Lanzallamas":{status:"burn",chance:10},"Ascuas":{status:"burn",chance:10},"Llamarada":{status:"burn",chance:10},"Puño Fuego":{status:"burn",chance:10},"Rueda Fuego":{status:"burn",chance:10},"Colmillo Ígneo":{status:"burn",chance:10},
  "Rayo":{status:"paralysis",chance:10},"Impactrueno":{status:"paralysis",chance:10},"Puño Trueno":{status:"paralysis",chance:10},"Chispa":{status:"paralysis",chance:30},"Electrocañón":{status:"paralysis",chance:100},
  "Rayo Hielo":{status:"freeze",chance:10},"Puño Hielo":{status:"freeze",chance:10},"Psíquico":{lower:{spd:1},chance:10},"Bomba Lodo":{status:"poison",chance:30},"Residuos":{status:"poison",chance:30},"Puya Nociva":{status:"poison",chance:30},"Lanzamugre":{status:"poison",chance:30},
  "Cascada":{flinch:20},"Tajo Aéreo":{flinch:30},"Golpe Cabeza":{flinch:30},"Cabeza de Hierro":{flinch:30},"Colmillo Rayo":{status:"paralysis",chance:10,flinch:10},"Colmillo Ígneo":{status:"burn",chance:10,flinch:10},"Colmillo Hielo":{status:"freeze",chance:10,flinch:10},
  "Bomba Fango":{lower:{accuracy:1},chance:30},"Disparo Lodo":{lower:{spe:1},chance:100},"Tierra Viva":{lower:{spd:1},chance:10},"Llama Embrujada":{lower:{spa:1},chance:100},"Energibola":{lower:{spd:1},chance:10},"Rayo Señal":{confuse:true,chance:10},"Hidropulso":{confuse:true,chance:20},"Puño Dinámico":{confuse:true,chance:100},"Treparrocas":{confuse:true,chance:20},
  "Latigazo":{recoil:.0},"Puño Dinámico":{confuse:true,chance:100},"Tumba Rocas":{lower:{spe:1},chance:100},"Concha Filo":{lower:{def:1},chance:50},"Cabezazo Zen":{flinch:20},"Arrumaco":{flinch:30},"Puya Nociva":{highCrit:true},"Psicocorte":{highCrit:true},"Cuchillada":{highCrit:true},"Tajo Cruzado":{highCrit:true},"Roca Afilada":{highCrit:true},"Veneno X":{highCrit:true},
};
const CURATED_STATUS = {1:"Drenadoras",2:"Drenadoras",3:"Drenadoras",4:"Día Soleado",5:"Día Soleado",6:"Día Soleado",7:"Acua Jet",8:"Acua Jet",9:"Acua Jet",12:"Somnífero",16:"Ataque Rápido",17:"Ataque Rápido",18:"Velocidad Extrema",19:"Ataque Rápido",20:"Ataque Rápido",25:"Onda Trueno",27:"Púas",28:"Púas",35:"Reflejo",36:"Pantalla Luz",37:"Día Soleado",38:"Día Soleado",43:"Somnífero",44:"Somnífero",45:"Somnífero",46:"Polvo Veneno",47:"Polvo Veneno",50:"Tormenta Arena",51:"Tormenta Arena",58:"Pantalla de Humo",59:"Pantalla de Humo",63:"Espacio Raro",64:"Espacio Raro",65:"Espacio Raro",66:"Ultrapuño",67:"Ultrapuño",68:"Ultrapuño",74:"Trampa Rocas",75:"Trampa Rocas",76:"Trampa Rocas",87:"Granizo",90:"Granizo",91:"Granizo",120:"Danza Lluvia",121:"Danza Lluvia",142:"Día Soleado"};
const CURATED_EXTRA = {
  10:["Placaje","Picadura","Disparo Demora","Ataque Rápido"],11:["Fortaleza","Placaje","Picadura","Refugio"],
  13:["Picotazo Veneno","Picadura","Disparo Demora","Placaje"],14:["Fortaleza","Picotazo Veneno","Picadura","Refugio"],
  15:["Ataque Rápido"],29:["Doble Patada"],30:["Doble Patada","Mordisco"],32:["Doble Patada"],33:["Doble Patada","Mordisco"],
  46:["Somnífero"],47:["Somnífero"],48:["Somnífero"],49:["Somnífero"],63:["Recuperación"],
  104:["Huesomerang"],105:["Huesomerang"],109:["Smog"],110:["Smog"],
  127:["Guillotina","Terremoto","Mordisco"],129:["Salpicadura","Placaje","Azote"],
  133:["Ataque Rápido"],137:["Recuperación","Bola Sombra"],144:["Ventisca","Poder Pasado"],
  124:["Mofa"],147:["Onda Trueno"],148:["Danza Dragón"]
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const STAGE_NUM=(n)=>n>=0?(2+n)/2:2/(2-n);
const STAT_KEYS=new Set(["atk","def","spa","spd","spe","accuracy","evasion"]);
const rand=(b)=>clamp((b.rng||Math.random)(),0,0.999999999);
const chance=(b,p)=>rand(b)<p/100;
const rollInt=(b,min,max)=>min+Math.floor(rand(b)*(max-min+1));

function moveFromLearnset(row) {
  const meta=MOVE_META.get(row.id),fx=MOVE_EFFECT_META.get(row.id)||{},statFx=MOVE_STAT_CHANGES.get(row.id)||{};
  const ov=EXTRA[row.name],explicit=ov?.effect||MOVE_EFFECTS[row.name]||{};
  const category=meta?.damageClassId===1?"status":meta?.damageClassId===2?"physical":meta?.damageClassId===3?"special":row.kind==="fisico"?"physical":row.kind==="especial"?"special":"status";
  const target=meta?.targetId===7?"self":meta?.targetId===12?"field":[4,6].includes(meta?.targetId)?"side":[9,11].includes(meta?.targetId)?"all":"opponent";
  const effect={...explicit};
  const ailmentMap={paralysis:"paralysis",sleep:"sleep",freeze:"freeze",burn:"burn",poison:"poison",confusion:"confusion",toxic:"toxic",trap:"trap",leech_seed:"leech"};
  if(fx.ailment){const a=ailmentMap[fx.ailment];if(a==="confusion")effect.confuse=true;else if(a==="leech")effect.leech=true;else if(a==="trap")effect.trap=true;else if(a)effect.status=a;}
  if(fx.ailmentChance!=null)effect.chance=fx.ailmentChance;
  if(fx.minTurns){effect.minTurns=fx.minTurns;effect.maxTurns=fx.maxTurns||fx.minTurns;}
  if(fx.drain)effect.drain=fx.drain/100;
  if(fx.recoil)effect.recoil=fx.recoil/100;
  if(fx.healing)effect.heal=fx.healing/100;
  if(fx.flinchChance)effect.flinch=fx.flinchChance;
  if(fx.critRate)effect.critRate=fx.critRate;
  for(const [k,v] of Object.entries(statFx.self||{})){if(v>0){effect.boost={...(effect.boost||{}),[k]:v};}else{effect.lowerSelf={...(effect.lowerSelf||{}),[k]:Math.abs(v)};}}
  for(const [k,v] of Object.entries(statFx.target||{})){if(v>0){effect.boostTarget={...(effect.boostTarget||{}),[k]:v};}else{effect.lower={...(effect.lower||{}),[k]:Math.abs(v)};}}
  if(statFx.chance!=null)effect.statChance=statFx.chance;
  if(fx.statChance!=null)effect.statChance=fx.statChance;
  if(fx.minHits)effect.hits=[fx.minHits,fx.maxHits||fx.minHits];
  if(fx.weather)effect.weather=fx.weather;
  if(fx.trickRoom)effect.trickRoom=true;
  if(fx.protect)effect.protect=true;
  if(fx.screen)effect.screen=fx.screen;
  if(fx.hazard)effect.hazard=fx.hazard;
  if(fx.clearHazards)effect.clearHazards=true;
  if(fx.forceSwitch)effect.forceSwitch=true;
  if(fx.switchAfterHit)effect.switchAfterHit=true;
  if(fx.recharge)effect.recharge=true;
  if(fx.rest)effect.rest=true;
  if(fx.selfDestruct)effect.selfDestruct=true;
  if(fx.ohko)effect.ohko=true;
  if(fx.endure)effect.endure=true;
  if(fx.crash)effect.crash=true;
  if(fx.boostAll){effect.boost={atk:1,def:1,spa:1,spd:1,spe:1};effect.chance=fx.boostChance??10;}
  if(fx.boost){effect.boost={...(effect.boost||{}),...fx.boost};effect.chance=fx.boostChance??effect.chance;}
  if(fx.lowerSelf){effect.lowerSelf={...(effect.lowerSelf||{}),...fx.lowerSelf};effect.lowerChance=fx.lowerChance??100;}
  if(fx.boostTarget){effect.boostTarget={...(effect.boostTarget||{}),...fx.boostTarget};}
  if(fx.variablePower)effect.variablePower=fx.variablePower;
  if(fx.doubleIfTargetLowHp)effect.doubleIfTargetLowHp=true;
  if(fx.doubleIfTargetMoved)effect.doubleIfTargetMoved=true;
  if(fx.doubleIfTargetDamaged)effect.doubleIfTargetDamaged=true;
  if(fx.doubleIfTargetPoison)effect.doubleIfTargetPoison=true;
  if(fx.doubleIfTargetStatus)effect.doubleIfTargetStatus=true;
  return {id:row.id,name:row.name,type:row.type,category,power:row.power||0,
    accuracy:row.accuracy===null?null:row.accuracy??100,contact:!!row.contact,
    pp:ov?.pp??meta?.pp??15,ppSource:ov?.pp?"curated":meta?"PokeAPI":"fallback",
    priority:ov?.priority??fx.priority??meta?.priority??MOVE_PRIORITY[row.name]??0,effect,effectChance:meta?.effectChance??effect?.chance??null,
    secondaryChance:effect?.chance??meta?.effectChance??0,target,targetId:meta?.targetId??10,
    hits:effect.hits||1,critStage:effect.critRate||0,highCrit:!!MOVE_EFFECTS[row.name]?.highCrit||!!effect.critRate,
    source:"learnset",metadataVerified:!!meta,verified:!!ov||!!MOVE_EFFECTS[row.name]||!!MOVE_EFFECT_META.has(row.id)};
}
const normalizeCuratedMove = (move) => ({
  ...move,
  priority: Number.isFinite(move.priority) ? move.priority : (MOVE_PRIORITY[move.name] ?? 0),
  target: move.target || "opponent",
  pp: Number.isFinite(move.pp) && move.pp > 0 ? move.pp : 10,
});
export function movesForSpecies(id) {
  if(id===132)return [normalizeCuratedMove({...EXTRA["Transformación"],id:"curated-132-transform",name:"Transformación",source:"curated",ppSource:"curated",metadataVerified:false,verified:true,maxPp:10,pp:10})];
  if(id===129)return ["Salpicadura","Placaje","Azote"].map(name=>normalizeCuratedMove({...EXTRA[name],id:`curated-129-${name}`,name,source:"curated",ppSource:"curated",metadataVerified:false,verified:true,maxPp:EXTRA[name].pp}));
  const rows=LEARN_BASICS[String(id)]||[];
  const list=rows.filter(x=>x.power>0).map(moveFromLearnset);
  const species=getSpecies(id), stab=list.filter(x=>species.types.includes(x.type));
  const out=[]; const add=m=>{if(m&&!out.some(x=>String(x.id)===String(m.id))&&out.length<4)out.push(normalizeCuratedMove({...m,source:m.source||"curated",ppSource:m.ppSource||"curated",metadataVerified:m.metadataVerified??false}));};
  const statusName=CURATED_STATUS[id];
  if(statusName)add({...EXTRA[statusName],name:statusName,id:`curated-${id}-${statusName}`,source:"curated",verified:true});
  for(const name of CURATED_EXTRA[id]||[])add({...EXTRA[name],name,id:`curated-${id}-${name}`,source:"curated",verified:true});
  // Selección equilibrada: STAB primero, cobertura después, evitando cuatro ataques de la misma clase.
  const ranked=[...stab.sort((a,b)=>b.power-a.power),...list.filter(x=>!stab.includes(x)).sort((a,b)=>b.power-a.power)];
  for(const category of ["physical","special"]){const pick=ranked.find(m=>m.category===category&&!out.some(x=>x.id===m.id));if(pick)add(pick);}
  for(const m of ranked)add(m);
  if(out.length<4)for(const n of ["Ataque Rápido","Gruñido","Protección","Confusión"])add({...EXTRA[n],name:n,id:`extra-${n}`,source:"fallback",verified:true});
  return out;
}
export function makeBattler(id, level=30, options={}) {
  const s=getSpecies(id), b=s.base, iv=options.iv??31, ev=options.ev??0;
  const stat=(v)=>Math.floor((Math.floor((2*v+iv+Math.floor(ev/4))*level/100)+5));
  const hp=Math.floor((Math.floor((2*b.hp+iv+Math.floor(ev/4))*level/100)+level+10));
  return {id,name:s.nameEs,types:s.types.slice(),rarity:s.rarity,level,gender:resolveGender(id,options.gender,options.genderRng||Math.random),maxHp:hp,hp,stats:{atk:stat(b.atk),def:stat(b.def),spa:stat(b.spa),spd:stat(b.spd),spe:stat(b.spe)},
    stages:{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0},status:null,toxicCounter:0,
    moves:movesForSpecies(id).map(m=>({...m,pp:m.pp,maxPp:m.pp})),ability:options.ability||ABILITY_BY_ID.get(id)?.ability||null,abilityEffect:ABILITY_BY_ID.get(id)?.effect||null,volatile:{},shiny:!!options.shiny};
}
export function typeEffectiveness(type,defTypes){return rawEffectiveness(type,defTypes);}
export function effectiveStat(p,k,opts={}) {
  let stage=p.stages?.[k]||0;
  if(opts.critical&&((k==="atk"||k==="spa")&&stage<0|| (k==="def"||k==="spd")&&stage>0))stage=0;
  let value=Math.floor(p.stats[k]*STAGE_NUM(stage));
  if(k==="spe"&&p.status==="paralysis")value=Math.floor(value*.5);
  return Math.max(1,value);
}
function setStatus(b,target,status,logs=[]) {
  if(target.status||target.volatile?.substitute)return false;
  if(["poison","toxic"].includes(status)&&(target.types.includes("acero")||target.types.includes("veneno")))return false;
  if(status==="burn"&&target.types.includes("fuego"))return false;
  if(status==="sleep"&&target.abilityEffect==="sleep_guard")return false;
  if(status==="paralysis"&&target.abilityEffect==="slow_resist")return false;
  if(status==="confusion"&&target.abilityEffect==="confusion_guard")return false;
  if(status==="paralysis"&&target.types.includes("electrico"))return false;
  if(status==="freeze"&&target.types.includes("hielo"))return false;
  if(status==="sleep"){target.volatile.sleepTurns=rollInt(b,1,3);}
  if(status==="toxic")target.toxicCounter=1;
  target.status=status;logs.push(`${target.name} ${({burn:"se ha quemado",poison:"ha sido envenenado",toxic:"ha sido gravemente envenenado",paralysis:"está paralizado",sleep:"se ha dormido",freeze:"se ha congelado"})[status]||"ha sufrido un estado alterado"}.`);return true;
}
function applyStages(target,changes,logs) {
  for(const [k,v] of Object.entries(changes||{})){if(!STAT_KEYS.has(k))continue;const before=target.stages[k]||0;target.stages[k]=clamp(before+v,-6,6);if(target.stages[k]!==before)logs.push(`${k.toUpperCase()} ${v>0?"sube":"baja"} ${Math.abs(target.stages[k]-before)} nivel(es).`);}
}
function criticalChance(move) { const stage=move.critStage||0;return stage>=3?1:stage===2?1/2:stage===1?1/8:move.highCrit?1/8:1/24; }
export function calculateDamage(user,target,move,field={},options={}) {
  if(move.effect?.ohko){const eff=typeEffectiveness(move.type,target.types);if(eff===0||target.abilityEffect==="survival_once")return {damage:0,critical:false,effectiveness:eff,roll:1};return {damage:target.hp,critical:false,effectiveness:eff,roll:1};}
  if(move.category==="status"||(!move.power&&!move.effect?.variablePower))return {damage:0,critical:false,effectiveness:typeEffectiveness(move.type,target.types),roll:1};
  const effectiveness=typeEffectiveness(move.type,target.types);if(effectiveness===0)return {damage:0,critical:false,effectiveness,roll:1};
  const rng=options.rng||Math.random;let critical=rng()<criticalChance(move);if(target.abilityEffect==="crit_guard")critical=false;
  const atkKey=move.category==="physical"?"atk":"spa",defKey=move.category==="physical"?"def":"spd";
  let power=move.power||1;
  if(move.effect?.variablePower==="hp")power=Math.max(1,Math.floor(power*user.hp/user.maxHp));
  if(move.effect?.variablePower==="speed")power=clamp(Math.floor(25*effectiveStat(target,"spe")/effectiveStat(user,"spe"))+1,1,150);
  if(move.effect?.variablePower==="flail"){const r=user.hp/user.maxHp;power=r<=.0417?200:r<=.1042?150:r<=.2083?100:r<=.3542?80:r<=.6875?40:20;}
  if(move.effect?.variablePower==="electroBall"){const ratio=effectiveStat(user,"spe")/Math.max(1,effectiveStat(target,"spe"));power=ratio>=4?150:ratio>=3?120:ratio>=2?80:ratio>=1?60:40;}
  if(move.effect?.variablePower==="weightTier"){if(target.weightKg==null)return {damage:0,critical:false,effectiveness,roll:1,invalidData:"weight"};const w=target.weightKg;power=w<10?20:w<25?40:w<50?60:w<100?80:w<200?100:120;}
  if(move.effect?.variablePower==="weightRatio"){if(user.weightKg==null||target.weightKg==null)return {damage:0,critical:false,effectiveness,roll:1,invalidData:"weight"};const ratio=user.weightKg/Math.max(1,target.weightKg);power=ratio>=5?120:ratio>=4?100:ratio>=3?80:ratio>=2?60:40;}
  if(move.effect?.doubleIfTargetMoved&&options.targetMoved)power*=2;
  if(move.effect?.doubleIfTargetDamaged&&options.targetDamaged)power*=2;
  if(move.effect?.doubleIfTargetLowHp&&target.hp<=target.maxHp/2)power*=2;
  if(move.effect?.doubleIfTargetStatus&&target.status)power*=2;
  if(move.effect?.doubleIfTargetPoison&&["poison","toxic"].includes(target.status))power*=2;
  let atk=effectiveStat(user,atkKey,{critical}),def=effectiveStat(target,defKey,{critical});
  if(user.status==="burn"&&move.category==="physical"&&move.name!=="Imagen"&&user.abilityEffect!=="status_rage")atk=Math.max(1,Math.floor(atk*.5));
  let damage=Math.floor(Math.floor(Math.floor(2*user.level/5+2)*power*atk/def)/50)+2;
  if(critical)damage=Math.floor(damage*1.5);
  const weather=(user.abilityEffect==="weather_neutral"||target.abilityEffect==="weather_neutral")?null:field.weather;
  if(weather==="sun"||weather==="rain"){
    if(weather==="sun"&&move.type==="fuego")damage=Math.floor(damage*1.5);
    if(weather==="sun"&&move.type==="agua")damage=Math.floor(damage*.5);
    if(weather==="rain"&&move.type==="agua")damage=Math.floor(damage*1.5);
    if(weather==="rain"&&move.type==="fuego")damage=Math.floor(damage*.5);
  }
  const randomRoll=85+Math.floor(rng()*16);damage=Math.floor(damage*randomRoll/100);
  if(user.types.includes(move.type))damage=Math.floor(damage*1.5);
  damage=Math.floor(damage*effectiveness);
  if(field.reflect?.[options.side]>0&&move.category==="physical"&&!critical)damage=Math.floor(damage*.5);
  if(field.lightScreen?.[options.side]>0&&move.category==="special"&&!critical)damage=Math.floor(damage*.5);
  if(user.abilityEffect==="status_rage"&&user.status&&move.category==="physical")damage=Math.floor(damage*1.5);
  if(user.volatile.flashFireBoost&&move.type==="fuego")damage=Math.floor(damage*1.5);
  if(user.hp/user.maxHp<=1/3&&((user.abilityEffect==="low_hp_grass"&&move.type==="planta")||(user.abilityEffect==="low_hp_fire"&&move.type==="fuego")||(user.abilityEffect==="low_hp_water"&&move.type==="agua")||(user.abilityEffect==="low_hp_bug"&&move.type==="bicho")))damage=Math.floor(damage*1.5);
  if(user.ability==="Adaptabilidad"&&user.types.includes(move.type))damage=Math.floor(damage*2/1.5);
  if(target.ability==="Sebo"&&["fuego","hielo"].includes(move.type))damage=Math.floor(damage*.5);
  if(target.abilityEffect==="ground_resist"&&move.type==="tierra")damage=0;
  if(target.abilityEffect==="fire_absorb"&&move.type==="fuego")damage=0;
  if(target.abilityEffect==="water_absorb"&&move.type==="agua")damage=0;
  if(target.abilityEffect==="electric_absorb"&&move.type==="electrico")damage=0;
  return {damage:damage>0?Math.max(1,damage):0,critical,effectiveness,roll:randomRoll};
}
export function createBattle(playerIds,enemyIds,options={}) {
  if(!Array.isArray(playerIds)||!playerIds.length||!Array.isArray(enemyIds)||!enemyIds.length)throw new Error("Un combate necesita al menos un Pokémon por equipo.");
  const level=options.level||30;
  const battle={turn:1,player:playerIds.map((id,i)=>{const p=makeBattler(id,level,{shiny:options.shinyIds?.includes(id),iv:options.iv,ev:options.ev,gender:options.playerGenders?.[i]});if(options.teamHp?.[i]!=null)p.hp=clamp(options.teamHp[i],0,p.maxHp);return p;}),enemy:enemyIds.map((id,i)=>makeBattler(id,level,{iv:options.enemyIv??31,gender:options.enemyGenders?.[i]})),
    active:{player:0,enemy:0},weather:options.weather||null,boss:!!options.boss,field:{weather:options.weather||null,weatherTurns:options.weather?5:0,trickRoom:0,reflect:{player:0,enemy:0},lightScreen:{player:0,enemy:0},spikes:{player:0,enemy:0},toxicSpikes:{player:0,enemy:0},stickyWeb:{player:false,enemy:false},stealthRock:{player:false,enemy:false}},
    log:["¡Comienza el combate!"],lastEvents:[],actedThisTurn:{player:false,enemy:false},damageDealtThisTurn:{player:0,enemy:0},over:false,winner:null,kind:options.kind||"trainer",items:{potion:Math.max(0,options.potions??3),enemyPotion:Math.max(0,options.enemyPotions??0),pokeballs:Math.max(0,options.pokeballs??0)},escapeAllowed:options.escapeAllowed??false,rng:options.rng||Math.random,pendingSwitch:null};
  for(const side of ["player","enemy"]){
    const firstAlive=battle[side].findIndex(p=>p.hp>0);if(firstAlive>=0)battle.active[side]=firstAlive;
  }
  if(battle.boss&&battle.enemy.length){const bossIndex=options.bossIndex??battle.enemy.length-1;const bossMon=battle.enemy[bossIndex];if(bossMon){bossMon.maxHp=Math.floor(bossMon.maxHp*1.2);bossMon.hp=bossMon.maxHp;for(const k of Object.keys(bossMon.stats))bossMon.stats[k]=Math.floor(bossMon.stats[k]*1.1);bossMon.volatile.boss=true;}}
  if(!living(battle.player)||!living(battle.enemy)){battle.over=true;battle.winner=!living(battle.player)?"enemy":"player";battle.log.push(battle.winner==="player"?"¡Has ganado el combate!":"Tu equipo no puede combatir.");}
  for(const side of ["player","enemy"]){
    const entrant=activeOf(battle,side),foe=activeOf(battle,side==="player"?"enemy":"player");
    if(entrant.abilityEffect==="entry_intimidate"&&foe.abilityEffect!=="stat_guard"&&foe.abilityEffect!=="attack_guard"){foe.stages.atk=clamp((foe.stages.atk||0)-1,-6,6);battle.log.push(`${entrant.name} intimida al rival: su Ataque baja.`);}
    if(entrant.abilityEffect==="adaptive_copy"){entrant.ability=foe.ability;entrant.abilityEffect=foe.abilityEffect;battle.log.push(`${entrant.name} copia la habilidad ${entrant.ability}.`);}
    if(entrant.abilityEffect==="reveal"){const strongest=foe.moves.reduce((best,m)=>m.power>(best?.power||0)?m:best,null);if(strongest)battle.log.push(`${entrant.name} presiente el movimiento más peligroso del rival: ${strongest.name}.`);}
  }
  return battle;
}
export function activeOf(b,side){return b[side][b.active[side]];}
const living=team=>team.some(p=>p.hp>0);
function actionPriority(a){return a.kind==="run"?7:(a.kind==="switch"||a.kind==="item"||a.kind==="capture")?6:(a.move?.priority||0);}
function effectiveSpeed(b,p){let speed=effectiveStat(p,"spe");const suppressed=[activeOf(b,"player"),activeOf(b,"enemy")].some(x=>x.abilityEffect==="weather_neutral");if(!suppressed&&b.field.weather==="sun"&&p.abilityEffect==="sun_speed")speed*=2;if(!suppressed&&b.field.weather==="rain"&&p.abilityEffect==="rain_speed")speed*=2;return speed;}
export function getTurnOrder(b,playerAction,enemyAction) {
  const actions=[{...playerAction,side:"player",actor:activeOf(b,"player")},{...enemyAction,side:"enemy",actor:activeOf(b,"enemy")}];
  // El desempate se resuelve una sola vez, sin depender de un comparator no transitivo.
  const rank=a=>({priority:actionPriority(a),speed:effectiveSpeed(b,a.actor)});
  const [a,c]=actions,ra=rank(a),rc=rank(c);
  if(ra.priority!==rc.priority)return ra.priority>rc.priority?actions:[c,a];
  if(a.kind!=="move"||c.kind!=="move"){
    const order={switch:0,item:1,move:2,run:-1};if(order[a.kind]!==order[c.kind])return order[a.kind]<order[c.kind]?actions:[c,a];
  }
  if(ra.speed===rc.speed)return rand(b)<.5?actions:[c,a];
  const faster=ra.speed>rc.speed?a:c;
  return b.field.trickRoom>0?(faster===a?[c,a]:[a,c]):(faster===a?actions:[c,a]);
}
function chooseAi(b) {
  const u=activeOf(b,"enemy"),t=activeOf(b,"player");
  const opts=u.moves.filter(m=>m.pp>0);
  if(!opts.length)return {kind:"struggle",side:"enemy"};
  let best=null;
  for(const m of opts){
    let score=0;
    const eff=typeEffectiveness(m.type,t.types),stab=u.types.includes(m.type)?1.5:1;
    if(m.effect?.transform)score=u.volatile.transformed?0:60;
    else if(m.category!=="status")score=m.power*eff*stab*(m.accuracy===null?1:m.accuracy/100);
    else if(m.effect?.boost)score=Object.values(m.effect.boost).reduce((a,x)=>a+x,0)*16+(u.hp/u.maxHp<.65?12:0);
    else if(m.effect?.heal)score=(1-u.hp/u.maxHp)*100*m.effect.heal;
    else if(m.effect?.status&&!t.status&&eff>0)score=25;
    else if(m.effect?.confuse&&!t.volatile.confusionTurns&&eff>0)score=22;
    else if(m.effect?.protect)score= u.hp/u.maxHp<.25?18:3;
    if(m.effect?.lower&&eff>0&&Object.keys(m.effect.lower).some(k=>(t.stages[k]||0)>-6))score+=12;
    if(!best||score>best.score)best={m,score};
  }
  if(b.boss&&u.volatile.boss&&u.hp/u.maxHp<.45&&b.items.enemyPotion>0)return {kind:"item",side:"enemy",item:"potion"};
  if(b.boss&&u.volatile.boss&&!u.volatile.bossPhase2&&u.hp/u.maxHp>.5){const setup=opts.find(m=>m.effect?.boost||m.effect?.boostAll);if(setup)return {kind:"move",side:"enemy",move:setup};}
  if(u.hp/u.maxHp<.25&&b.items.enemyPotion>0&&best?.score<40)return {kind:"item",side:"enemy",item:"potion"};
  // Cambia si el Pokémon activo está muy mal emparejado y existe un relevo resistente.
  if(u.hp/u.maxHp<.3){let switchTo=-1,bestMatch=-Infinity;for(let i=0;i<b.enemy.length;i++){const p=b.enemy[i];if(i===b.active.enemy||p.hp<=0)continue;const score=p.types.reduce((n,ty)=>n+typeEffectiveness(ty,t.types),0)+p.hp/p.maxHp;if(score>bestMatch){bestMatch=score;switchTo=i;}}if(switchTo>=0&&bestMatch>1.8)return {kind:"switch",side:"enemy",index:switchTo};}
  return {kind:"move",side:"enemy",move:best?.m||opts[0]};
}
function canAct(b,p,logs) {
  if(p.status==="sleep"){
    if((p.volatile.sleepTurns||1)>0){p.volatile.sleepTurns--;logs.push(`${p.name} está dormido.`);return false;}
    p.status=null;logs.push(`${p.name} se ha despertado.`);
  }
  if(p.status==="freeze"){
    if(chance(b,20)){p.status=null;logs.push(`${p.name} se ha descongelado.`);}else{logs.push(`${p.name} está congelado.`);return false;}
  }
  if(p.volatile.confusionTurns>0){p.volatile.confusionTurns--;if(p.volatile.confusionTurns===0){logs.push(`${p.name} ya no está confuso.`);}else if(chance(b,33.333)){const atk=effectiveStat(p,"atk"),def=effectiveStat(p,"def");const hit=Math.max(1,Math.floor(Math.floor(Math.floor(2*p.level/5+2)*40*atk/def)/50)+2);p.hp=Math.max(0,p.hp-hit);logs.push(`${p.name} se hiere por su confusión (${hit} PS).`);return false;}}
  if(p.volatile.recharge){p.volatile.recharge=false;logs.push(`${p.name} necesita recargar fuerzas.`);return false;}
  if(p.volatile.flinch){p.volatile.flinch=false;logs.push(`${p.name} retrocede y no puede moverse.`);return false;}
  if(p.status==="paralysis"&&chance(b,25)){logs.push(`${p.name} está paralizado y no puede moverse.`);return false;}
  if(p.volatile.infatuated&&chance(b,50)){logs.push(`${p.name} está enamorado y no puede atacar.`);return false;}
  return p.hp>0;
}
function switchPokemon(b,side,index,logs,forced=false) {
  const team=b[side],old=activeOf(b,side),next=team[index];
  if(!next||next.hp<=0||index===b.active[side])return false;
  if(!forced&&old.volatile.trapped){logs.push(`${old.name} no puede retirarse.`);return false;}
  const opposingNow=activeOf(b,side==="player"?"enemy":"player");
  if(old.abilityEffect==="contact_charm"&&opposingNow?.volatile?.infatuated){opposingNow.volatile.infatuated=false;logs.push(`${opposingNow.name} deja de estar enamorado al retirarse ${old.name}.`);}
  if(!forced&&opposingNow.abilityEffect==="lane_snare"&&!old.types.includes("volador")&&!old.types.includes("fantasma")&&old.abilityEffect!=="ground_resist"&&old.abilityEffect!=="retreat_speed"){logs.push(`${old.name} no puede escapar de Trampa Arena.`);return false;}
  if(!forced&&opposingNow.abilityEffect==="electric_focus"&&old.types.includes("acero")){logs.push(`${old.name} no puede retirarse: Magnet Pull lo mantiene atrapado.`);return false;}
  b.lastEvents.push({type:"switch",side,index});
  if(old.abilityEffect==="regen_reserve"&&old.status){old.status=null;old.toxicCounter=0;logs.push(`${old.name} se cura al retirarse gracias a Cura natural.`);}
  if(old.volatile.transformed&&old.volatile.transformBackup){const z=old.volatile.transformBackup;old.types=z.types;old.stats=z.stats;old.stages=z.stages;old.ability=z.ability;old.abilityEffect=z.abilityEffect;old.moves=z.moves;logs.push(`${old.name} vuelve a su forma original.`);}
  const sleepTurns=old.volatile.sleepTurns;old.stages={atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0};old.volatile={};if(old.status==="toxic")old.toxicCounter=1;if(old.status==="sleep")old.volatile.sleepTurns=sleepTurns||1;
  b.active[side]=index;logs.push(`${old.name}, ¡vuelve! ¡Adelante, ${next.name}!`);
  const opposing=activeOf(b,side==="player"?"enemy":"player");
  if(next.abilityEffect==="entry_intimidate"&&opposing.abilityEffect!=="stat_guard"&&opposing.abilityEffect!=="attack_guard"){opposing.stages.atk=clamp((opposing.stages.atk||0)-1,-6,6);logs.push(`${next.name} intimida al rival: su Ataque baja.`);}
  if(next.abilityEffect==="adaptive_copy"){next.ability=opposing.ability;next.abilityEffect=opposing.abilityEffect;logs.push(`${next.name} copia la habilidad ${next.ability}.`);}
  if(next.abilityEffect==="reveal"){const strongest=opposing.moves.reduce((best,m)=>m.power>(best?.power||0)?m:best,null);if(strongest)logs.push(`${next.name} presiente ${strongest.name} como el movimiento más peligroso del rival.`);}
  const hazards=b.field;
  if(hazards.stealthRock[side]){const n=Math.max(1,Math.floor(next.maxHp*typeEffectiveness("roca",next.types)/8));next.hp=Math.max(0,next.hp-n);logs.push(`${next.name} sufre ${n} PS por las Trampa Rocas.`);}
  if(next.hp>0&&hazards.spikes[side]>0&&!next.types.includes("volador")&&next.abilityEffect!=="ground_resist"){const frac=hazards.spikes[side]===1?1/8:hazards.spikes[side]===2?1/6:1/4;const n=Math.max(1,Math.floor(next.maxHp*frac));next.hp=Math.max(0,next.hp-n);logs.push(`${next.name} sufre ${n} PS por Púas.`);}
  if(next.hp>0&&hazards.toxicSpikes[side]>0&&!next.types.includes("volador")&&next.abilityEffect!=="ground_resist"){
    if(next.types.includes("veneno")){hazards.toxicSpikes[side]=0;logs.push(`${next.name} absorbe las Púas Tóxicas.`);}
    else setStatus(b,next,hazards.toxicSpikes[side]>1?"toxic":"poison",logs);
  }
  if(next.hp>0&&hazards.stickyWeb[side]&&!next.types.includes("volador")&&next.abilityEffect!=="ground_resist"&&next.abilityEffect!=="stat_guard"){applyStages(next,{spe:-1},logs);}
  if(next.hp<=0){logs.push(`${next.name} cae por las trampas al entrar.`);const replacement=team.findIndex((p,i)=>i!==index&&p.hp>0);if(side==="player"&&replacement>=0)b.pendingSwitch="player";else if(side==="enemy"&&replacement>=0)switchPokemon(b,side,replacement,logs,true);}
  else if(b.pendingSwitch===side)b.pendingSwitch=null;
  return true;
}
function applyMoveEffect(b,user,target,move,logs,damage=0,side="player") {
  const e=move.effect||{},foeSide=side==="player"?"enemy":"player";
  if(e.boost&&chance(b,e.statChance??e.chance??100))applyStages(user,e.boost,logs);
  if(target.hp>0&&e.boostTarget&&chance(b,e.statChance??e.chance??100))applyStages(target,e.boostTarget,logs);
  if(e.lowerSelf&&chance(b,e.lowerChance??e.statChance??100))applyStages(user,Object.fromEntries(Object.entries(e.lowerSelf).map(([k,v])=>[k,-v])),logs);
  if(target.hp>0&&e.lower&&target.abilityEffect!=="stat_guard"&&target.abilityEffect!=="attack_guard"&&chance(b,e.statChance??e.chance??100)){
    const changes=Object.fromEntries(Object.entries(e.lower).filter(([k])=>!(k==="atk"&&target.abilityEffect==="attack_guard")).map(([k,v])=>[k,-v]));applyStages(target,changes,logs);
  }
  if(e.heal){const n=Math.min(user.maxHp-user.hp,Math.max(1,Math.floor(user.maxHp*e.heal)));user.hp+=n;logs.push(`${user.name} recupera ${n} PS.`);if(n)b.lastEvents.push({type:"heal",side,amount:n});}
  if(e.rest){if(user.hp===user.maxHp)logs.push("Pero falló: sus PS ya están completos.");else{user.hp=user.maxHp;user.status="sleep";user.toxicCounter=0;user.volatile.sleepTurns=2;logs.push(`${user.name} recupera todos sus PS y se duerme.`);}}
  if(e.transform){if(user.volatile.transformed||target.id===user.id)logs.push("Pero falló la transformación.");else{user.volatile.transformBackup={types:user.types.slice(),stats:{...user.stats},stages:{...user.stages},ability:user.ability,abilityEffect:user.abilityEffect,moves:user.moves.map(m=>({...m}))};user.types=target.types.slice();user.stats={...target.stats};user.stages={...target.stages};user.ability=target.ability;user.abilityEffect=target.abilityEffect;user.moves=target.moves.map(m=>({...m,pp:Math.min(5,m.maxPp||m.pp),maxPp:5}));user.volatile.transformed=true;logs.push(`${user.name} se ha transformado en ${target.name}.`);}}
  if(e.taunt&&target.hp>0){if(target.abilityEffect==="control_guard")logs.push(`${target.name} no cae en la provocación gracias a Despiste.`);else{target.volatile.tauntTurns=3;logs.push(`${target.name} cae en la provocación y no podrá usar movimientos de estado durante tres turnos.`);}}
  if(e.protect){const n=user.volatile.protectChain||0;const p=n===0?100:Math.pow(1/3,n)*100;if(chance(b,p)){user.volatile.protect=true;user.volatile.protectChain=n+1;logs.push(`${user.name} se protege.`);}else{user.volatile.protectChain=0;logs.push("Pero falló Protección.");}}
  else if(move.name!=="Protección")user.volatile.protectChain=0;
  if(target.hp>0&&e.leech){if(target.types.includes("planta"))logs.push(`${target.name} es inmune a Drenadoras.`);else{target.volatile.leech=true;logs.push(`${target.name} queda bajo el efecto de Drenadoras.`);}}
  if(target.hp>0&&e.trap){target.volatile.trapped=true;target.volatile.bindTurns=rollInt(b,e.minTurns||2,e.maxTurns||5);logs.push(`${target.name} queda atrapado y no puede retirarse.`);}
  if(e.screen==="reflect")b.field.reflect[side]=5;if(e.screen==="light")b.field.lightScreen[side]=5;
  if(e.hazard==="stealthRock")b.field.stealthRock[foeSide]=true;
  if(e.hazard==="spikes")b.field.spikes[foeSide]=clamp(b.field.spikes[foeSide]+1,0,3);
  if(e.hazard==="toxicSpikes")b.field.toxicSpikes[foeSide]=clamp(b.field.toxicSpikes[foeSide]+1,0,2);
  if(e.hazard==="stickyWeb")b.field.stickyWeb[foeSide]=true;
  if(e.clearHazards||e.clearAllHazards){b.field.stealthRock[side]=false;b.field.spikes[side]=0;b.field.toxicSpikes[side]=0;b.field.stickyWeb[side]=false;}
  if(e.clearAllHazards){b.field.stealthRock[foeSide]=false;b.field.spikes[foeSide]=0;b.field.toxicSpikes[foeSide]=0;b.field.stickyWeb[foeSide]=false;b.field.reflect.player=0;b.field.reflect.enemy=0;b.field.lightScreen.player=0;b.field.lightScreen.enemy=0;}
  if(e.lowerTarget&&target.hp>0&&target.abilityEffect!=="stat_guard")applyStages(target,Object.fromEntries(Object.entries(e.lowerTarget).map(([k,v])=>[k,-v])),logs);
  if(e.endure)user.volatile.endure=true;
  if(target.hp>0&&e.confuse&&target.abilityEffect!=="confusion_guard"&&chance(b,e.chance??100)){target.volatile.confusionTurns=rollInt(b,e.minTurns||2,e.maxTurns||5);logs.push(`${target.name} está confuso.`);}
  if(target.hp>0&&e.status&&(move.category==="status"||target.abilityEffect!=="status_guard")&&chance(b,e.chance??100)){
    const before=target.status;if(!setStatus(b,target,e.status,logs))logs.push("Pero no tuvo efecto.");
    else {if(e.status==="sleep"&&e.minTurns)target.volatile.sleepTurns=rollInt(b,e.minTurns,e.maxTurns||e.minTurns);if(target.abilityEffect==="status_echo"&&user!==target&&target.status&&!before)setStatus(b,user,target.status,logs);}
  }
  if(target.hp>0&&e.flinch&&chance(b,e.flinch)&&!b.actedThisTurn?.[foeSide])target.volatile.flinch=true;
  if(e.drain&&damage>0){const n=Math.max(1,Math.floor(damage*e.drain));const got=Math.min(n,user.maxHp-user.hp);user.hp+=got;logs.push(`${user.name} absorbe ${got} PS.`);}
  if(e.recoil&&damage>0&&user.abilityEffect!=="recoil_guard"){const n=Math.max(1,Math.floor(damage*e.recoil));user.hp=Math.max(0,user.hp-n);logs.push(`${user.name} recibe ${n} PS de retroceso.`);}
  if(e.weather){b.field.weather=e.weather;b.field.weatherTurns=5;logs.push(`El clima cambia: ${e.weather}.`);}
  if(e.trickRoom){b.field.trickRoom=b.field.trickRoom>0?0:5;logs.push(b.field.trickRoom?"¡Se ha distorsionado el espacio!":"El espacio vuelve a la normalidad.");}
}
function executeAction(b,a,logs) {
  const side=a.side,foe=side==="player"?"enemy":"player",u=a.actor||activeOf(b,side),t=activeOf(b,foe);
  if(a.kind==="switch"){switchPokemon(b,side,a.index,logs);return;}
  if(a.kind==="item"){
    u.volatile.protectChain=0;
    const items=b.items,key=a.item||"potion",countKey=side==="enemy"?"enemyPotion":key;
    if((items[countKey]||0)>0&&u.hp>0){const heal=key==="potion"?Math.min(20+Math.floor(u.maxHp*.2),u.maxHp-u.hp):0;if(heal){u.hp+=heal;items[countKey]--;logs.push(`La poción restaura ${heal} PS a ${u.name}.`);b.lastEvents.push({type:"heal",side,amount:heal});}}return;
  }
  if(a.kind==="run"){u.volatile.protectChain=0;if(u.abilityEffect==="retreat_speed"||b.escapeAllowed){b.over=true;b.winner="escape";logs.push("¡Has escapado del combate!");}else logs.push("¡No puedes huir de este combate!");return;}
  if(a.kind==="capture"){
    u.volatile.protectChain=0;
    if(b.kind!=="wild"||b.items.pokeballs<=0){logs.push("No puedes capturar en este combate o no tienes Poké Balls.");return;}
    b.items.pokeballs--;const rate=t.rarity==="legendario"?3:t.rarity==="epico"?30:t.rarity==="raro"?90:t.rarity==="poco_comun"?150:220;
    const hpFactor=(3*t.maxHp-2*t.hp)/(3*t.maxHp);const statusFactor=t.status==="sleep"||t.status==="freeze"?2:(["burn","poison","toxic","paralysis"].includes(t.status)?1.5:1);
    const captureChance=clamp((rate/255)*hpFactor*statusFactor,0.02,0.95);
    if(chance(b,captureChance*100)){b.over=true;b.winner="capture";b.capturedId=t.id;logs.push(`¡${t.name} ha sido capturado!`);}else{logs.push(`¡${t.name} se ha escapado de la Poké Ball!`);}
    return;
  }
  let m=a.move||u.moves.find(x=>x.pp>0);
  if(a.kind==="struggle"||!m||m.pp<=0){m={name:"Forcejeo",type:"normal",category:"physical",power:50,accuracy:100,pp:1,priority:0,effect:{recoil:.25}};logs.push(`${u.name} no tiene PP. ¡Usa Forcejeo!`);}
  if(m.name!=="Protección"&&m.name!=="Detección"&&m.name!=="Endurecer")u.volatile.protectChain=0;
  if(!canAct(b,u,logs))return;
  if(u.volatile.tauntTurns>0&&m.category==="status"){if(m.pp!==undefined&&m.pp>0)m.pp--;logs.push(`${u.name} está bajo Mofa y no puede usar ${m.name}.`);return;}
  if(m.pp!==undefined&&m.pp>0)m.pp--;
  b.lastEvents.push({type:"attack",side,move:m.name,targetSide:foe});
  if(t.abilityEffect==="pressure_aura"&&m.pp!==undefined)m.pp=Math.max(0,m.pp-1);
  logs.push(`${u.name} usa ${m.name}.`);
  if(t.volatile.protect&&m.category!=="status"){logs.push("¡Pero el rival se protegió!");return;}
  if(m.sound&&t.abilityEffect==="sound_guard"){logs.push(`${t.name} es inmune al movimiento de sonido gracias a su habilidad.`);return;}
  if((m.effect?.status||m.effect?.confuse)&&typeEffectiveness(m.type,t.types)===0){logs.push(`${t.name} es inmune a ${m.name} por su tipo.`);return;}
  if(m.effect?.ohko&&u.level<t.level){logs.push("¡El movimiento fulminante no afecta a un Pokémon de mayor nivel!");return;}
  if(t.status==="freeze"&&m.type==="fuego"){t.status=null;logs.push(`${t.name} se descongela por el calor del ataque.`);}
  const acc=m.accuracy===null?100:m.accuracy??100;
  const accuracy=clamp(acc*STAGE_NUM(u.stages.accuracy||0)/STAGE_NUM(t.stages.evasion||0),1,100);
  if(m.accuracy!==0){const focus=u.abilityEffect==="accuracy_focus"?1.3:1;const evasionGuard=u.abilityEffect==="precision"?STAGE_NUM(Math.max(0,t.stages.evasion||0)):1;const weatherSuppressed=[activeOf(b,"player"),activeOf(b,"enemy")].some(x=>x.abilityEffect==="weather_neutral");const sandPenalty=!weatherSuppressed&&t.abilityEffect==="sand_evasion"&&b.field.weather==="sand"?.8:1;const ohkoBonus=m.effect?.ohko?Math.max(0,u.level-t.level):0;const finalAccuracy=clamp((accuracy+ohkoBonus)*focus*evasionGuard*sandPenalty,1,100);if(!chance(b,finalAccuracy)){logs.push("¡El ataque ha fallado!");if(m.effect?.crash){const n=Math.max(1,Math.floor(u.maxHp/2));u.hp=Math.max(0,u.hp-n);logs.push(`${u.name} recibe ${n} PS de daño por el fallo.`);}return;}}
  if(m.category==="status"||m.power===0){applyMoveEffect(b,u,t,m,logs);return;}
  const hits=Array.isArray(m.hits)?rollInt(b,m.hits[0],m.hits[1]):m.hits||1;
  let total=0,first=null,done=0;
  for(let i=0;i<hits&&t.hp>0;i++){
    if(i>0&&m.name==="Doble Patada"&&chance(b,100-accuracy))break;
    const hit=calculateDamage(u,t,m,b.field,{rng:b.rng,side:foe,targetMoved:b.actedThisTurn[foe],targetDamaged:b.damageDealtThisTurn[foe]>0});first??=hit;let actual=hit.damage;
    if(m.effect?.falseSwipe&&actual>=t.hp)actual=Math.max(0,t.hp-1);
    if(actual>=t.hp&&t.volatile.endure){actual=Math.max(0,t.hp-1);t.volatile.endure=false;logs.push(`${t.name} aguanta con 1 PS.`);}
    else if(actual>=t.hp&&t.abilityEffect==="survival_once"&&t.hp===t.maxHp&&!t.volatile.survivalUsed){actual=t.hp-1;t.volatile.survivalUsed=true;logs.push(`${t.name} resiste gracias a su habilidad.`);}
    if(hit.damage===0&&t.abilityEffect==="water_absorb"&&m.type==="agua"){const heal=Math.min(t.maxHp-t.hp,Math.floor(t.maxHp/4));t.hp+=heal;logs.push(`${t.name} absorbe el agua y recupera ${heal} PS.`);}
    if(hit.damage===0&&t.abilityEffect==="electric_absorb"&&m.type==="electrico"){
      if(t.ability==="Pararrayos"){t.stages.spa=clamp(t.stages.spa+1,-6,6);logs.push(`${t.name} atrae la electricidad: sube su Ataque Especial.`);}
      else{const heal=Math.min(t.maxHp-t.hp,Math.floor(t.maxHp/4));t.hp+=heal;logs.push(`${t.name} absorbe la electricidad y recupera ${heal} PS.`);}
    }
    if(hit.damage===0&&t.abilityEffect==="fire_absorb"&&m.type==="fuego"){t.volatile.flashFireBoost=true;logs.push(`${t.name} absorbe el fuego y potencia sus movimientos de Fuego.`);}
    t.hp=Math.max(0,t.hp-actual);total+=actual;done++;if(hit.effectiveness===0)break;
  }
  logs.push(`¡Impacta ${done} ${done===1?"vez":"veces"}! ${total} PS de daño.${first?.critical?" ¡Golpe crítico!":""}`);
  if(first?.effectiveness===0)logs.push("No afecta al rival.");else if(first?.effectiveness>=2)logs.push("¡Es supereficaz!");else if(first?.effectiveness<1)logs.push("No es muy eficaz…");
  if(total>0&&t.hp>0&&u.abilityEffect==="fear_pulse"&&!b.actedThisTurn[foe]&&chance(b,10)){t.volatile.flinch=true;logs.push(`${t.name} retrocede por el Hedor de ${u.name}.`);}
  applyMoveEffect(b,u,t,m,logs,total,side);
  if(t.hp>0){
    if(m.contact&&u.hp>0&&t.abilityEffect==="contact_slow"&&chance(b,30))setStatus(b,u,"paralysis",logs);
    if(m.contact&&u.hp>0&&t.abilityEffect==="contact_poison"&&chance(b,30))setStatus(b,u,"poison",logs);
    if(m.contact&&u.hp>0&&t.abilityEffect==="contact_burn"&&chance(b,30))setStatus(b,u,"burn",logs);
    if(m.contact&&u.hp>0&&t.abilityEffect==="contact_spore"&&chance(b,30)){const ailment=["sleep","poison","paralysis"][rollInt(b,0,2)];setStatus(b,u,ailment,logs);}
    if(m.contact&&u.hp>0&&t.abilityEffect==="contact_charm"&&u.gender&&t.gender&&u.gender!==t.gender&&u.abilityEffect!=="control_guard"&&!u.volatile.infatuated&&chance(b,30)){u.volatile.infatuated=true;logs.push(`${u.name} se ha enamorado de ${t.name} por Gran Encanto.`);}
  }
  if(b.boss&&side==="player"&&t.hp>0&&t.volatile.boss&&!t.volatile.bossPhase2&&t.hp/t.maxHp<=.5){t.volatile.bossPhase2=true;for(const k of ["atk","def","spa","spd","spe"])t.stages[k]=clamp((t.stages[k]||0)+1,-6,6);logs.push(`¡${t.name} entra en su segunda fase y aumenta todas sus estadísticas!`);if(b.field.weather){b.field.weatherTurns=5;logs.push(`El jefe intensifica el clima ${b.field.weather}.`);}}
  if(m.effect?.recharge&&u.hp>0)u.volatile.recharge=true;
  if(m.effect?.selfDestruct){u.hp=0;logs.push(`${u.name} se debilita por el ataque.`);}
  if(m.effect?.forceSwitch&&t.hp>0){const ix=b[foe].findIndex((p,i)=>i!==b.active[foe]&&p.hp>0);if(ix>=0)switchPokemon(b,foe,ix,logs);}
  if(m.effect?.switchAfterHit&&u.hp>0){const ix=b[side].findIndex((p,i)=>i!==b.active[side]&&p.hp>0);if(ix>=0)switchPokemon(b,side,ix,logs);}
  if(t.hp<=0)logs.push(`¡${t.name} se ha debilitado!`);
}
function residual(b,logs) {
  for(const side of ["player","enemy"]){const p=activeOf(b,side);if(p.hp<=0)continue;
    p.volatile.protect=false;p.volatile.endure=false;p.volatile.flinch=false;
    if(p.volatile.tauntTurns>0&&--p.volatile.tauntTurns===0)logs.push(`${p.name} ya no está bajo el efecto de Mofa.`);
    if(p.status==="burn"||p.status==="poison"||p.status==="toxic"){
      const n=p.status==="toxic"?Math.max(1,Math.floor(p.maxHp*p.toxicCounter++/16)):Math.max(1,Math.floor(p.maxHp*(p.status==="burn"?1/16:1/8)));
      p.hp=Math.max(0,p.hp-n);logs.push(`${p.name} pierde ${n} PS por ${p.status}.`);
    }
    const weather=b.field.weather;
    if(![activeOf(b,"player"),activeOf(b,"enemy")].some(x=>x.abilityEffect==="weather_neutral")&&((weather==="sand"&&!p.types.some(t=>["tierra","roca","acero"].includes(t)))||(weather==="hail"&&!p.types.includes("hielo")))){const n=Math.max(1,Math.floor(p.maxHp/16));p.hp=Math.max(0,p.hp-n);logs.push(`${p.name} recibe ${n} PS por el clima.`);}
    if(p.volatile.leech){const n=Math.max(1,Math.floor(p.maxHp/8));p.hp=Math.max(0,p.hp-n);const foe=activeOf(b,side==="player"?"enemy":"player");foe.hp=Math.min(foe.maxHp,foe.hp+n);logs.push(`${p.name} pierde ${n} PS por Drenadoras.`);}
  }
  for(const side of ["player","enemy"]){const p=activeOf(b,side);if(p.hp<=0)continue;if(p.abilityEffect==="status_cleanse"&&p.status&&chance(b,30)){logs.push(`${p.name} se ha curado gracias a Mudar.`);p.status=null;p.toxicCounter=0;}}
  if(b.field.trickRoom>0)b.field.trickRoom--;
  for(const side of ["player","enemy"]){if(b.field.reflect[side]>0)b.field.reflect[side]--;if(b.field.lightScreen[side]>0)b.field.lightScreen[side]--;const p=activeOf(b,side);if(p.volatile.bindTurns>0&&--p.volatile.bindTurns===0){p.volatile.trapped=false;logs.push(`${p.name} ha logrado liberarse.`);}}
  if(b.field.weatherTurns>0&&--b.field.weatherTurns===0){b.field.weather=null;logs.push("El clima vuelve a la normalidad.");}
}
function finishBattle(b,logs){
  const playerAlive=living(b.player),enemyAlive=living(b.enemy);
  if(!playerAlive&&!enemyAlive){b.over=true;b.winner="draw";logs.push("¡Ambos equipos han caído! El combate termina en empate.");}
  else if(!playerAlive){b.over=true;b.winner="enemy";logs.push("Tu equipo ha sido derrotado.");}
  else if(!enemyAlive){b.over=true;b.winner="player";logs.push("¡Has ganado el combate!");}
}
export function resolveTurn(b,playerAction) {
  if(b.over)return b;
  b.lastEvents=[];
  const logs=[];
  if(b.pendingSwitch==="player"){
    if(playerAction.kind!=="switch"||b.player[playerAction.index]?.hp<=0||playerAction.index===b.active.player){logs.push("Debes elegir un Pokémon disponible para continuar.");b.log.push(...logs);return b;}
    switchPokemon(b,"player",playerAction.index,logs,true);
    b.pendingSwitch=b.player[b.active.player]?.hp>0?null:"player";
    finishBattle(b,logs);b.log.push(...logs);return b;
  }
  const pa={...playerAction,side:"player",actor:activeOf(b,"player")},ea={...chooseAi(b),side:"enemy",actor:activeOf(b,"enemy")};
  const order=getTurnOrder(b,pa,ea);
  b.actedThisTurn={player:false,enemy:false};b.damageDealtThisTurn={player:0,enemy:0};
  for(const a of order){if(b.over)break;if(a.actor.hp<=0)continue;executeAction(b,a,logs);b.actedThisTurn[a.side]=true;finishBattle(b,logs);if(b.pendingSwitch)break;}
  if(!b.over){
    residual(b,logs);finishBattle(b,logs);
    if(!b.over){
      for(const side of ["player","enemy"]){
        if(activeOf(b,side).hp>0)continue;
        if(side==="player"){
          if(b.player.some(p=>p.hp>0)){b.pendingSwitch="player";logs.push("Elige un Pokémon para sustituir al debilitado.");}
        }else{
          let guard=0;
          while(activeOf(b,side).hp<=0&&guard++<b.enemy.length){
            const ix=b.enemy.findIndex((p,i)=>i!==b.active.enemy&&p.hp>0);
            if(ix<0)break;
            switchPokemon(b,"enemy",ix,logs,true);
          }
        }
      }
      finishBattle(b,logs);b.turn++;
    }
  }
  b.log.push(...logs);return b;
}

// API de presentación: ejecuta una acción por fase para que la interfaz pueda mostrar
// la animación y el resultado antes de permitir la siguiente acción. resolveTurn se
// conserva para simulaciones y compatibilidad con pruebas/sistemas existentes.
function finishPhasedTurn(b,logs){
  if(!b.over){
    residual(b,logs);finishBattle(b,logs);
    if(!b.over){
      for(const side of ["player","enemy"]){
        if(activeOf(b,side).hp>0)continue;
        if(side==="player"){
          if(b.player.some(p=>p.hp>0)){b.pendingSwitch="player";logs.push("Elige un Pokémon para sustituir al debilitado.");}
        }else{
          let guard=0;
          while(activeOf(b,side).hp<=0&&guard++<b.enemy.length){
            const ix=b.enemy.findIndex((p,i)=>i!==b.active.enemy&&p.hp>0);
            if(ix<0)break;
            switchPokemon(b,side,ix,logs,true);
          }
        }
      }
      finishBattle(b,logs);b.turn++;
    }
  }
  b.log.push(...logs);
  b.pendingTurn=null;b.phaseSide=null;
  return b;
}
export function resolveTurnPhased(b,playerAction){
  if(b.over)return b;
  if(b.pendingTurn)throw new Error("Hay una fase de turno pendiente.");
  if(b.pendingSwitch==="player")return resolveTurn(b,playerAction);
  b.lastEvents=[];
  const logs=[];
  const pa={...playerAction,side:"player",actor:activeOf(b,"player")};
  const ea={...chooseAi(b),side:"enemy",actor:activeOf(b,"enemy")};
  const order=getTurnOrder(b,pa,ea);
  b.actedThisTurn={player:false,enemy:false};b.damageDealtThisTurn={player:0,enemy:0};
  const first=order[0];
  if(first.actor.hp>0){executeAction(b,first,logs);b.actedThisTurn[first.side]=true;finishBattle(b,logs);}
  if(b.over||b.pendingSwitch||order.length<2||order[1].actor.hp<=0){
    finishPhasedTurn(b,logs);return b;
  }
  b.pendingTurn={order,next:1};b.phaseSide=first.side;
  b.log.push(...logs);
  return b;
}
export function continueTurnPhased(b){
  if(b.over||!b.pendingTurn)return b;
  b.lastEvents=[];
  const state=b.pendingTurn,logs=[];
  const action=state.order[state.next++];
  if(action&&action.actor.hp>0){executeAction(b,action,logs);b.actedThisTurn[action.side]=true;finishBattle(b,logs);}
  b.phaseSide=action?.side||null;
  finishPhasedTurn(b,logs);
  return b;
}

export function simulateBattle(playerIds,enemyIds,options={}) {
  const b=createBattle(playerIds,enemyIds,options);let guard=0;
  while(!b.over&&guard++<(options.maxTurns||500)){
    const p=activeOf(b,"player");const move=p.moves.find(m=>m.pp>0)||{kind:"struggle"};
    if(b.pendingSwitch==="player"){const ix=b.player.findIndex(x=>x.hp>0);if(ix<0)break;resolveTurn(b,{kind:"switch",index:ix});}
    else resolveTurn(b,move.kind?move:{kind:"move",move});
  }
  if(guard>=(options.maxTurns||500)&&!b.over){b.over=true;b.winner="timeout";b.log.push("El combate termina por límite de turnos.");}
  return b;
}
