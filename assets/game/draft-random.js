import { SPECIES } from "../data/species.js";
import { PTYPES, TYPE_LABEL } from "../data/types.js";

export function randomDraftRules(species=SPECIES){
 const all=species;
 return [
  ...PTYPES.map(type=>({label:`Solo tipo ${TYPE_LABEL[type]}`,pool:all.filter(s=>s.types.includes(type)),ruleType:"type",type})).filter(r=>r.pool.length>=8),
  {label:"Equipo de Pokémon raros",pool:all.filter(s=>["raro","epico","legendario"].includes(s.rarity)),ruleType:"rarity"},
  {label:"Equipo de Pokémon comunes",pool:all.filter(s=>["comun","poco_comun"].includes(s.rarity)),ruleType:"rarity"},
  {label:"Equipo de tipos mezclados",pool:all,ruleType:"mixed"},
  {label:"Equipo completamente aleatorio",pool:all,ruleType:"random"},
  {label:"Clima soleado",pool:all,weather:"sun",ruleType:"weather"},
  {label:"Lluvia intensa",pool:all,weather:"rain",ruleType:"weather"},
  {label:"Tormenta de arena",pool:all,weather:"sand",ruleType:"weather"},
  {label:"Energía doble",pool:all,mods:{energyMul:2},ruleType:"modifier"},
  {label:"Ataques acelerados",pool:all,mods:{attackSpeedMul:1.5},ruleType:"modifier"},
  {label:"Coste reducido",pool:all,mods:{costDelta:-1},ruleType:"modifier"},
  {label:"Muerte súbita",pool:all,mods:{firstCrownWins:true},ruleType:"win-condition"},
 ];
}
export function pickRandomDraftRule(rules=randomDraftRules(),rng=Math.random){return rules[Math.floor(rng()*rules.length)];}
export function buildRandomDraft(rule,rng=Math.random,count=8){
 const pool=rule.pool.map(s=>typeof s==="number"?{id:s,types:[]}:s);
 if(pool.length<count)throw new Error(`La regla ${rule.label} no tiene suficientes Pokémon para un equipo de ${count}.`);
 const shuffle=a=>{const v=a.slice();for(let i=v.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[v[i],v[j]]=[v[j],v[i]];}return v;};
 let deck;
 if(rule.ruleType==="mixed"){
  const groups=new Map();for(const s of pool){const type=s.types?.[0]||"normal";if(!groups.has(type))groups.set(type,[]);groups.get(type).push(s);}
  const types=shuffle([...groups.keys()]);deck=types.slice(0,count).map(t=>shuffle(groups.get(t))[0]);
  if(deck.length<count){const used=new Set(deck.map(x=>x.id));deck.push(...shuffle(pool.filter(x=>!used.has(x.id))).slice(0,count-deck.length));}
 }else deck=shuffle(pool).slice(0,count);
 deck=deck.map(x=>x.id);
 return {rule,deck,enemyDeck:deck.slice(),weather:rule.weather||"neutral",mods:{...(rule.mods||{})},label:rule.label};
}
