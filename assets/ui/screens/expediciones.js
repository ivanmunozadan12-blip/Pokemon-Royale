import { h, spriteImg, toast } from "../dom.js";
import { SPECIES, getSpecies } from "../../data/species.js";
import { createBattle, makeBattler } from "../../turnbased/engine.js";
import { openTurnBattle } from "../../turnbased/view.js";

const KEY="pr_turnbased_progress_v2";
const OLD_KEY="pr_turnbased_progress_v1";
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||localStorage.getItem(OLD_KEY)||"{}");}catch{return {};}};
const write=v=>{try{localStorage.setItem(KEY,JSON.stringify(v));}catch{toast("No se pudo guardar el progreso local de la expedición.","err");}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sample=a=>a[Math.floor(Math.random()*a.length)];
export const SAFARI_RARITY_WEIGHTS=Object.freeze({comun:55,poco_comun:30,raro:10,epico:4,legendario:1});
export const SAFARI_CAPTURE_BASE=Object.freeze({comun:.70,poco_comun:.45,raro:.15,epico:.05,legendario:.01});
export const SAFARI_BALL_MULTIPLIERS=Object.freeze({poke:1,super:1.5,ultra:2,master:100});
export function chooseSafariSpecies(pool,rng=Math.random){
 const groups=Object.keys(SAFARI_RARITY_WEIGHTS).map(r=>[r,pool.filter(id=>getSpecies(id).rarity===r)]).filter(([,ids])=>ids.length);
 if(!groups.length)throw new Error("El hábitat no contiene especies válidas.");
 // Se conserva la ponderación de rareza y se renormaliza solo si el hábitat no contiene alguna categoría.
 const total=groups.reduce((n,[r])=>n+SAFARI_RARITY_WEIGHTS[r],0);let roll=rng()*total,rarity=groups[groups.length-1][0];
 for(const [r] of groups){roll-=SAFARI_RARITY_WEIGHTS[r];if(roll<0){rarity=r;break;}}
 const candidates=groups.find(([r])=>r===rarity)[1];return candidates[Math.min(candidates.length-1,Math.floor(rng()*candidates.length))];
}
export function safariCaptureChance(rarity,ballKind="poke",bonus=0){const base=SAFARI_CAPTURE_BASE[rarity]??SAFARI_CAPTURE_BASE.comun;const multiplier=SAFARI_BALL_MULTIPLIERS[ballKind]??1;return ballKind==="master"?1:Math.min(1,base*multiplier+Math.max(0,bonus));}
const weighted=chooseSafariSpecies;
const maxHp=id=>makeBattler(id,26).maxHp;
const ownedTeam=app=>{const ids=(app.profile.deck?.ids||[]).filter(id=>app.profile.isUnlocked(id));const pool=ids.length?ids:app.profile.data.unlocked;return [...new Set(pool)].slice(0,6);};
function unlock(app,id,source="Safari"){
 const p=app.profile;if(!p.isUnlocked(id)){p.data.unlocked.push(id);p.data.unlocked.sort((a,b)=>a-b);p.data.obtained[String(id)]=source;p.commit();return true;}
 p.data.copies[String(id)]=(p.data.copies[String(id)]||0)+1;p.commit();return false;
}
export const BIOMES=[
 {id:"bosque",name:"Bosque Esmeralda",emoji:"🌲",types:["planta","bicho","veneno"],pool:[1,2,3,10,11,12,13,14,43,44,45,46,47,69,70,71],boss:45,weather:null},
 {id:"volcan",name:"Cráter Ígneo",emoji:"🌋",types:["fuego","roca","tierra"],pool:[4,5,6,37,38,58,59,77,78,95,104,111],boss:59,weather:"sun"},
 {id:"costa",name:"Costa Celeste",emoji:"🌊",types:["agua","volador"],pool:[7,8,9,54,55,60,61,72,73,79,80,90,98,116,118,120],boss:130,weather:"rain"},
 {id:"cueva",name:"Cueva Umbría",emoji:"🪨",types:["roca","tierra","fantasma"],pool:[27,28,41,42,50,51,74,75,76,92,93,94,95,104],boss:94,weather:"sand"},
 {id:"montana",name:"Cordillera del Dragón",emoji:"⛰️",types:["roca","volador","dragon"],pool:[6,18,22,41,42,74,75,76,95,111,142,147,148],boss:142,weather:null},
 {id:"nieve",name:"Glaciar Boreal",emoji:"❄️",types:["hielo","agua"],pool:[87,90,91,124,131,144],boss:144,weather:"hail"},
 {id:"pantano",name:"Pantano Venenoso",emoji:"🐊",types:["veneno","planta","agua"],pool:[23,24,43,44,45,69,70,71,72,73,88,89,109,110],boss:89,weather:"rain"},
 {id:"desierto",name:"Mar de Dunas",emoji:"🏜️",types:["tierra","roca"],pool:[27,28,50,51,74,75,76,95,104,105,111,112],boss:112,weather:"sand"},
 {id:"ruinas",name:"Ruinas Ancestrales",emoji:"🏛️",types:["psiquico","fantasma"],pool:[35,36,63,64,65,79,80,92,93,94,96,97,122,150,151],boss:150,weather:null},
 {id:"misterio",name:"Santuario Misterioso",emoji:"✨",types:["psiquico","dragon","hada"],pool:[35,36,39,40,63,64,65,120,121,137,147,148,149,150,151],boss:151,weather:null},
];

export function expedicionesScreen(app){
 const root=h("div",{class:"page"});const loaded=read();let prog=loaded&&typeof loaded==="object"&&!Array.isArray(loaded)?loaded:{};
 prog.completed=Array.isArray(prog.completed)?[...new Set(prog.completed.filter(id=>BIOMES.some(b=>b.id===id)))]:[];
 prog.achievements=Array.isArray(prog.achievements)?[...new Set(prog.achievements.filter(x=>typeof x==="string"))]:[];
 prog.unlockedBiomes=Array.isArray(prog.unlockedBiomes)?[...new Set(prog.unlockedBiomes.filter(id=>BIOMES.some(b=>b.id===id)))]:["bosque","volcan","costa"];
 if(!prog.unlockedBiomes.length)prog.unlockedBiomes=["bosque","volcan","costa"];
 let active=prog.run&&BIOMES.some(b=>b.id===prog.run.biome)&&Array.isArray(prog.run.team)?prog.run:null;
 if(active){active.team=[...new Set(active.team.filter(id=>SPECIES.some(s=>s.id===id)))].slice(0,6);if(!active.team.length)active=null;else{active.node=clamp(Number(active.node)||0,0,5);active.teamHp=active.team.map((id,i)=>Number.isFinite(active.teamHp?.[i])?clamp(active.teamHp[i],0,maxHp(id)):null);active.items=clamp(Number(active.items)||0,0,99);active.coins=clamp(Number(active.coins)||0,0,1e6);active.defeats=clamp(Number(active.defeats)||0,0,1e6);active.boosts=active.boosts&&typeof active.boosts==="object"?Object.fromEntries(Object.entries(active.boosts).filter(([k,v])=>["atk","def","spa","spd","spe"].includes(k)&&Number.isFinite(v)).map(([k,v])=>[k,clamp(v,-6,6)])):null;}}
 let eventOpen=null,teamMenu=false;
 const save=()=>{prog.run=active;write(prog);};
 const healTeam=fraction=>{active.teamHp=active.team.map((id,i)=>Math.min(maxHp(id),Math.max(0,active.teamHp?.[i]??maxHp(id))+Math.ceil(maxHp(id)*fraction)));};
 const draw=()=>{
  root.replaceChildren(h("h1",null,"Expediciones Pokémon"),h("p",{class:"sub"},"Aventuras con rutas alternativas, recursos persistentes y combates clásicos por turnos. El equipo conserva sus PS entre encuentros."));
  if(!active){
   root.append(h("section",{class:"panel stack"},h("h2",null,"Elige territorio"),h("p",{class:"sub"},`Territorios completados: ${prog.completed.length}/10 · Logros: ${prog.achievements.length}/3 · Se desbloquean nuevas zonas al superar jefes.`),...BIOMES.map((b,i)=>{
    const unlocked=prog.unlockedBiomes.includes(b.id);return h("button",{class:"tb-biome",disabled:!unlocked,on:{click:()=>{if(!unlocked)return;const team=ownedTeam(app);if(!team.length){toast("Necesitas al menos un Pokémon en tu colección.","err");return;}active={biome:b.id,node:0,team,teamHp:team.map(()=>null),visited:[],items:2,coins:0,defeats:0,boosts:null};eventOpen=null;teamMenu=false;save();draw();}}},h("span",null,unlocked?b.emoji:"🔒"),h("b",null,b.name),h("small",null,unlocked?`Tipos frecuentes: ${b.types.join(" · ")}`:`Zona bloqueada · Completa territorios anteriores`));
   })));
   return;
  }
  const biome=BIOMES.find(b=>b.id===active.biome)||BIOMES[0],team=active.team;
  root.append(h("section",{class:"panel stack"},h("div",{class:"row between"},h("h2",null,biome.emoji+" "+biome.name),h("span",{class:"badge"},`Etapa ${Math.min(active.node+1,5)}/5`)),h("p",{class:"sub"},`Clima del territorio: ${biome.weather||"normal"} · Monedas de expedición: ${active.coins} · Recursos: ${active.items}${active.boosts?` · Mejora temporal: ${Object.entries(active.boosts).map(([k,v])=>`${k.toUpperCase()} +${v}`).join(" / ")}`:""}`),h("div",{class:"tb-team"},...team.map((id,i)=>{const im=spriteImg(id,"f","tb-team-sprite");const hp=active.teamHp?.[i]??maxHp(id);im.title=`${getSpecies(id).nameEs}: ${hp}/${maxHp(id)} PS`;return im;})),h("div",{class:"bar"},h("i",{style:`width:${active.node/5*100}%`}))));
  if(teamMenu&&active.node<5){
   const owned=app.profile.data.unlocked||[],available=owned.filter(id=>!active.team.includes(id));
   const currentRows=active.team.map((id,i)=>h("div",{class:"row between tb-team-row"},
    h("span",null,`${getSpecies(id).nameEs} · ${active.teamHp?.[i]??maxHp(id)}/${maxHp(id)} PS`),
    h("button",{class:"btn btn-red sm",disabled:active.team.length<=1,on:{click:()=>{active.team.splice(i,1);active.teamHp.splice(i,1);save();draw();}}},"Quitar")
   ));
   const addButtons=available.map(id=>h("button",{class:"btn btn-blue sm",disabled:active.team.length>=6,on:{click:()=>{if(active.team.length<6){active.team.push(id);active.teamHp.push(null);save();draw();}}}},`${getSpecies(id).nameEs} · Añadir`));
   root.append(h("section",{class:"panel stack"},h("h2",null,"Gestionar equipo"),h("p",{class:"sub"},"Puedes cambiar integrantes entre encuentros. Los PS de quienes salen se conservan; los Pokémon nuevos entran con todos sus PS."),h("div",{class:"tb-team-manage"},...currentRows),h("h3",null,"Añadir desde la colección"),h("div",{class:"tb-team-add"},...addButtons),h("button",{class:"btn btn-gold",on:{click:()=>{teamMenu=false;draw();}}},"Volver a la expedición")));
   return;
  }
  if(active.node>=5){
   const claim=h("button",{class:"btn btn-gold",on:{click:()=>{
    app.profile.data.coins+=100+active.coins;app.profile.commit();
    prog.completed=[...new Set([...(prog.completed||[]),biome.id])];
    if(prog.completed.length>=1&&!prog.achievements.includes("primera_expedicion"))prog.achievements.push("primera_expedicion");
    if(prog.completed.length>=5&&!prog.achievements.includes("explorador"))prog.achievements.push("explorador");
    if(prog.completed.length>=10&&!prog.achievements.includes("maestro_expediciones"))prog.achievements.push("maestro_expediciones");
    const ix=BIOMES.findIndex(x=>x.id===biome.id);
    if(ix>=0&&BIOMES[ix+1]&&!prog.unlockedBiomes.includes(BIOMES[ix+1].id))prog.unlockedBiomes.push(BIOMES[ix+1].id);
    active=null;eventOpen=null;save();draw();toast("Recompensas cobradas y nueva zona desbloqueada.","ok");
   } }},"Cobrar recompensas y finalizar");
   const back=h("button",{class:"btn btn-blue sm",on:{click:()=>{active=null;eventOpen=null;save();draw();}}},"Volver al mapa");
   root.append(h("section",{class:"panel stack"},h("h2",null,"¡Expedición completada!"),h("p",null,`Has superado al jefe de ${biome.name}. Recompensa: ${100+active.coins} monedas.`),h("p",{class:"sub"},`Derrotas durante la expedición: ${active.defeats||0}.`),claim,back));
   return;
  }
  if(eventOpen){
   root.append(h("section",{class:"panel stack"},h("h2",null,eventOpen.title),h("p",null,eventOpen.description),...eventOpen.choices.map(c=>h("button",{class:"btn btn-blue",on:{click:()=>resolveEvent(c.id)}},c.label))));
   return;
  }
  root.append(h("button",{class:"btn btn-blue sm",on:{click:()=>{teamMenu=true;draw();}}},"Gestionar equipo"));
  const nodes=[
   {title:"Encuentro salvaje",desc:"Un Pokémon del bioma aparece en tu camino.",act:()=>encounter(false,false)},
   {title:"Entrenador rival",desc:"Un combate más exigente con un equipo de tres Pokémon.",act:()=>encounter(true,false)},
   {title:"Campamento",desc:"Recupera un 30 % de los PS de todo tu equipo.",act:()=>{healTeam(.3);active.node++;save();draw();toast("El equipo ha descansado.","ok");}},
   {title:"Evento misterioso",desc:"Investiga un hallazgo y decide qué hacer.",act:()=>openEvent()},
   {title:"Comerciante ambulante",desc:"Intercambia monedas por recursos para continuar.",act:()=>{eventOpen={title:"Comerciante ambulante",description:"El comerciante ofrece suministros. ¿Qué necesitas más?",choices:[{id:"potion",label:"Comprar una Poción (20 monedas)"},{id:"ball",label:"Comprar una Poké Ball (15 monedas)"},{id:"merchant_leave",label:"Seguir el camino sin comprar"}]};draw();}},
   {title:"Ruta secreta",desc:"Un desvío peligroso con posibilidad de encontrar especies raras.",act:()=>encounter(false,true,false)},
   {title:"Investigación",desc:"Ayuda a un investigador y consigue una recompensa segura.",act:()=>{active.coins+=18;active.items++;active.node++;save();draw();toast("Investigación completada: +18 monedas y +1 recurso.","ok");}},
  ];
  const choices=active.node===4?[{title:"Jefe de zona",desc:"El guardián del territorio espera al final del camino.",act:()=>encounter(true,false,true)}]:nodes;
  root.append(h("section",{class:"panel stack"},h("h2",null,active.node===4?"Desafío final":"Elige tu siguiente ruta"),h("div",{class:"tb-paths"},...choices.map((n,i)=>h("button",{class:"tb-path",on:{click:n.act}},h("b",null,n.title),h("small",null,n.desc))))),h("button",{class:"btn btn-red sm",on:{click:()=>{active=null;eventOpen=null;save();draw();toast("Has abandonado la expedición. Las recompensas no cobradas se pierden, pero tu colección se conserva.","info");}}},"Abandonar expedición"));
 };
 function openEvent(){
  const events=[
   {title:"Un Pokémon herido",description:"Encuentras un Pokémon salvaje agotado. Puedes ayudarlo o continuar sin intervenir.",choices:[{id:"rescue",label:"Ayudar: recuperar recursos y PS"},{id:"leave_wounded",label:"Dejarlo tranquilo y seguir"}]},
   {title:"Campamento abandonado",description:"Hay suministros, pero el lugar parece inestable.",choices:[{id:"search",label:"Registrar el campamento (riesgo y recompensa)"},{id:"rest",label:"Descansar con cautela"}]},
   {title:"Cueva oculta",description:"Dos túneles se abren ante ti. Uno parece seguro; el otro podría esconder algo raro.",choices:[{id:"safe",label:"Tomar el túnel iluminado"},{id:"risk",label:"Explorar el túnel oscuro"}]},
   {title:"Objeto misterioso",description:"Un artefacto antiguo emite una energía inestable. Podría fortalecer al equipo o provocar un contratiempo.",choices:[{id:"activate_mystery",label:"Activar el objeto"},{id:"ignore_mystery",label:"Dejarlo donde está"}]},
  ];eventOpen=sample(events);draw();
 }
 function resolveEvent(id){
  if(id==="rescue"){healTeam(.2);active.items++;active.coins+=10;toast("El Pokémon te agradece la ayuda: PS restaurados y suministros encontrados.","ok");}
  else if(id==="leave_wounded"){active.coins+=25;toast("Encuentras una pequeña bolsa de monedas junto al camino.","ok");}
  else if(id==="merchant_leave"){toast("Sigues el camino sin comprar.","info");}
  else if(id==="search"){if(Math.random()<.55){active.coins+=35;active.items++;toast("Has encontrado objetos valiosos.","ok");}else{healTeam(-.12);toast("¡Una trampa! El equipo pierde PS.","err");}}
  else if(id==="rest"){healTeam(.25);toast("El equipo recupera fuerzas.","ok");}
  else if(id==="safe"){active.coins+=12;toast("El túnel iluminado te lleva a una cámara con monedas.","ok");}
  else if(id==="activate_mystery"){if(Math.random()<.6){active.boosts={atk:1,spe:1};toast("El artefacto fortalece temporalmente Ataque y Velocidad para el próximo combate.","ok");}else{healTeam(-.1);active.coins+=20;toast("El artefacto libera una onda: el equipo pierde PS, pero encuentras monedas.","err");}}
  else if(id==="ignore_mystery"){active.coins+=5;toast("Dejas el objeto intacto y encuentras unas monedas junto a él.","info");}
  else if(id==="risk"){if(Math.random()<.45){active.coins+=55;active.items+=2;toast("¡Hallazgo extraordinario en la cueva secreta!","ok");}else{healTeam(-.18);toast("Un derrumbe os obliga a retroceder. El equipo sufre daños.","err");}}
  else if(id==="potion"){if(active.coins>=20){active.coins-=20;active.items++;toast("Has comprado una Poción de expedición.","ok");}else toast("No tienes monedas suficientes.","err");}
  else if(id==="ball"){if(active.coins>=15){active.coins-=15;app.profile.data.balls.poke++;app.profile.commit();toast("Has comprado una Poké Ball.","ok");}else toast("No tienes monedas suficientes.","err");}
  eventOpen=null;if(id!=="potion"&&id!=="ball")active.node++;save();draw();
 }
 function encounter(trainer=false,secret=false,boss=false){
  const biome=BIOMES.find(b=>b.id===active.biome)||BIOMES[0];
  const ids=boss?[sample(biome.pool),sample(biome.pool),biome.boss]:trainer?[sample(biome.pool),sample(biome.pool),sample(biome.pool)]:[secret?weighted(biome.pool):weighted(biome.pool)];
  const initialBalls=app.profile.data.balls.poke||0,initialPotions=active.items||0;
  const battle=createBattle(active.team,ids,{level:boss?42:secret?34:trainer?32:26,kind:trainer?"trainer":"wild",teamHp:active.teamHp,pokeballs:initialBalls,potions:initialPotions,enemyPotions:boss?2:0,weather:biome.weather,boss,bossIndex:2,escapeAllowed:!trainer});
  if(active.boosts){for(const p of battle.player)for(const [stat,delta] of Object.entries(active.boosts))p.stages[stat]=clamp((p.stages[stat]||0)+delta,-6,6);battle.log.push("El artefacto misterioso refuerza temporalmente a tu equipo.");active.boosts=null;}
  openTurnBattle(app,{battle,title:boss?"JEFE DE ZONA":secret?"RUTA SECRETA":trainer?"ENTRENADOR RIVAL":"POKÉMON SALVAJE",allowClose:false,allowCapture:!trainer},(winner,result)=>{
   active.teamHp=result.player.map(p=>p.hp);
   if(["player","capture"].includes(winner)&&result.player.some(p=>p.abilityEffect==="energy_pickup")&&Math.random()<.3){active.items++;toast("Recogida: un Pokémon de tu equipo ha encontrado una Poción.","ok");}
   const spent=Math.max(0,initialBalls-(result.items.pokeballs||0));if(spent>0){app.profile.data.balls.poke=Math.max(0,app.profile.data.balls.poke-spent);app.profile.commit();}
   active.items=Math.max(0,initialPotions-(result.items.potion||0));
   if(winner==="capture"&&result.capturedId){unlock(app,result.capturedId,"Expedición");active.coins+=12;active.node++;}
   else if(winner==="player"){active.coins+=boss?80:secret?45:trainer?25:10;active.node++;if(boss)active.node=5;}
   else if(winner==="escape"){active.node++;toast("Has abandonado el encuentro sin recompensa.","info");}
   else{active.node=Math.max(0,active.node-1);active.items=Math.max(0,active.items-1);active.defeats=(active.defeats||0)+1;if(active.teamHp.every(hp=>hp<=0)){const ix=active.teamHp.findIndex(hp=>hp<=0);if(ix>=0)active.teamHp[ix]=1;toast("El equipo se ha quedado sin fuerzas. Un aliado logra levantarse con 1 PS para que puedas continuar.","err");}}
   save();draw();
  });
 }

 draw();return root;
}

const SAFARI_DAILY_KEY="pr_safari_daily_v1";
const SAFARI_DAILY_LIMIT=4,SAFARI_VISIT_COST=100,SAFARI_RESET_MS=24*60*60*1000;
function safariDailyState(){
 const now=Date.now(),d=new Date(now),today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
 try{
  const saved=JSON.parse(localStorage.getItem(SAFARI_DAILY_KEY)||"null");
  if(saved&&Number.isInteger(saved.used)){
   const savedDate=String(saved.date||"");
   if(!Number.isFinite(saved.lastSeen)){
    if(savedDate===today)return {date:today,used:clamp(saved.used,0,SAFARI_DAILY_LIMIT),lastSeen:now};
    if(savedDate>today)return {date:savedDate,used:clamp(saved.used,0,SAFARI_DAILY_LIMIT),lastSeen:now};
   }
   const lastSeen=Math.max(0,Number(saved.lastSeen)||0);
   // En offline no existe un reloj seguro: se bloquean retrocesos y saltos de fecha prematuros.
   if(now<lastSeen||today<savedDate)return {date:savedDate||today,used:clamp(saved.used,0,SAFARI_DAILY_LIMIT),lastSeen};
   if(today!==savedDate&&now-lastSeen<SAFARI_RESET_MS)return {date:savedDate,used:clamp(saved.used,0,SAFARI_DAILY_LIMIT),lastSeen};
   if(today===savedDate)return {date:today,used:clamp(saved.used,0,SAFARI_DAILY_LIMIT),lastSeen:now};
  }
 }catch{}
 return {date:today,used:0,lastSeen:now};
}
function saveSafariDaily(state){
 try{state.lastSeen=Date.now();localStorage.setItem(SAFARI_DAILY_KEY,JSON.stringify(state));}
 catch{toast("No se pudo guardar el límite diario del Safari.","err");}
}
export function safariScreen(app){
 const root=h("div",{class:"page"});
 let zone="bosque",sight=null,actions=5,approachBonus=0,baitBonus=0,ballChoice="poke";
 let behavior="curioso",observed=new Set(),daily=safariDailyState(),visit=daily.used,encounterEnded=false,encounterResult="",reaction="idle";
 const hour=()=>{const n=new Date().getHours();return n<6?"noche":n<12?"mañana":n<19?"tarde":"noche";};
 const remaining=()=>Math.max(0,SAFARI_DAILY_LIMIT-daily.used);
 const newEncounter=(useBait=false)=>{
  const b=BIOMES.find(x=>x.id===zone)||BIOMES[0];
  sight=chooseSafariSpecies(b.pool,Math.random);
  const roll=Math.random();
  behavior=roll<.18?"escondido":roll<.42?"asustadizo":roll<.68?"curioso":"tranquilo";
  if(useBait){behavior=roll<.5?"curioso":"tranquilo";baitBonus=.04;}else baitBonus=0;
  approachBonus=0;observed.clear();encounterEnded=false;encounterResult="";reaction="idle";
 };
 const startVisit=()=>{
  if(!remaining()){toast("Has agotado tus 4 visitas de hoy. Vuelve mañana.","err");return;}
  if((Number(app.profile.data.coins)||0)<SAFARI_VISIT_COST){toast("Necesitas 100 monedas para comenzar una visita.","err");return;}
  app.profile.data.coins-=SAFARI_VISIT_COST;app.profile.commit();
  daily.used++;visit=daily.used;saveSafariDaily(daily);actions=5;newEncounter();draw();
 };
 const finishVisit=(message)=>{
  encounterEnded=true;actions=0;
  encounterResult=message?.toLowerCase().includes("capturaste")?"captured":message?.toLowerCase().includes("huye")||message?.toLowerCase().includes("escapado")||message?.toLowerCase().includes("se marcha")?"escape":"ended";
  if(message)toast(message,"info");
  draw();
 };
 const draw=()=>{
  if(actions<=0)encounterEnded=true;
  const b=BIOMES.find(x=>x.id===zone)||BIOMES[0];
  const sp=sight!=null?getSpecies(sight):null;
  const isObserved=sp&&observed.has(sight);
  const hidden=sp&&behavior==="escondido"&&!isObserved;
  root.replaceChildren(
   h("h1",null,"Safari interactivo"),
   h("p",{class:"sub"},"Cada salida es una oportunidad limitada: rastrea, estudia el comportamiento y calcula cuándo lanzar la Poké Ball."),
   h("section",{class:"panel safari-daily"},h("div",{class:"row between"},h("b",null,"📅 Visitas de hoy"),h("strong",null,`${daily.used}/${SAFARI_DAILY_LIMIT}`)),h("div",{class:"bar"},h("i",{style:`width:${daily.used/SAFARI_DAILY_LIMIT*100}%`})),h("small",{class:"sub"},remaining()?`Te ${remaining()===1?"queda":"quedan"} ${remaining()} ${remaining()===1?"visita":"visitas"} hoy. Cada visita cuesta ${SAFARI_VISIT_COST} monedas y permite hasta 5 acciones.`:"Has agotado las visitas de hoy. El contador se restablecerá mañana."),h("small",{class:"sub"},`Saldo: ${app.profile.data.coins} monedas · Coste máximo diario: ${SAFARI_VISIT_COST*SAFARI_DAILY_LIMIT} monedas`))
  );
  root.append(h("div",{class:"seg tb-zone"},...BIOMES.map(x=>h("button",{type:"button",disabled:!!sight&&!encounterEnded,"aria-pressed":zone===x.id,on:{click:()=>{zone=x.id;if(sight&&encounterEnded)sight=null;draw();}}},x.emoji+" "+x.name))));
  if(!sight){
   root.append(h("section",{class:"panel stack"},h("h2",null,"Preparado para explorar"),h("p",{class:"sub"},remaining()?"Elige un hábitat y comienza una visita. El Pokémon se moverá por el entorno y podrá huir si detecta peligro.":"No quedan visitas disponibles hoy."),h("button",{class:"btn btn-gold",disabled:!remaining()||(Number(app.profile.data.coins)||0)<SAFARI_VISIT_COST,on:{click:startVisit}},"🌿 Comenzar visita · 100 monedas")));
   return;
  }
  const posX=10+Math.random()*76,posY=38+Math.random()*25,wanderX=Math.round(Math.random()*44-22),wanderY=Math.round(Math.random()*20-10);
  const sprite=spriteImg(sight,"f","tb-safari-sprite");
  sprite.src=`sprites/static/f${sight}.png`;
  if(hidden)sprite.classList.add("tb-safari-hidden");
  const creature=h("div",{class:`tb-safari-creature safari-reaction-${reaction}${encounterEnded?` safari-${encounterResult}`:""}`,style:`left:${posX}%;top:${posY}%;--wander-x:${wanderX}px;--wander-y:${wanderY}px`},sprite);
  const scene=h("section",{class:`tb-safari-scene biome-${zone}`},
   h("div",{class:"tb-safari-sky"},b.emoji+" · "+b.name.toUpperCase()+" · "+hour().toUpperCase()),
   h("div",{class:"tb-safari-track"},h("span",{class:"tb-safari-grass grass-a"},"🌿"),h("span",{class:"tb-safari-grass grass-b"},"🌾"),creature),
   h("div",{class:"tb-safari-caption"},h("h2",null,hidden?"Algo se mueve entre la vegetación":isObserved?sp.nameEs:"¡Has visto movimiento!"),h("b",null,hidden?"No has identificado al Pokémon":isObserved?sp.types.join(" / "):"Pokémon sin identificar"),h("small",null,`Acciones restantes: ${actions}/5 · Visita ${visit}/${SAFARI_DAILY_LIMIT} · ${encounterEnded?"Visita terminada":`Comportamiento: ${isObserved?behavior:"desconocido"}`}`))
  );
  const observe=h("button",{class:"btn btn-blue",disabled:actions<=0||isObserved||encounterEnded,on:{click:()=>{actions--;observed.add(sight);toast(`${sp.nameEs}: ${sp.types.join(" / ")}. Comportamiento: ${behavior}.`,"info");draw();}}},isObserved?"Observado":"Observar");
  const bait=h("button",{class:"btn btn-blue",disabled:actions<=0||encounterEnded,on:{click:()=>{actions--;reaction="bait";behavior=Math.random()<.65?"curioso":"tranquilo";baitBonus=.04;observed.add(sight);toast(`${sp.nameEs} ha detectado el cebo y se ha acercado. La captura será más fácil.`,"ok");draw();}}},"Usar cebo");
  const approach=h("button",{class:"btn btn-blue",disabled:actions<=0||encounterEnded,on:{click:()=>{actions--;reaction="approach";const flee=behavior==="asustadizo"?.55:behavior==="escondido"?.35:behavior==="curioso"?.08:.18;if(Math.random()<flee){finishVisit(`${sp.nameEs} se asusta y huye. Has perdido esta visita.`);}else{approachBonus=.04;observed.add(sight);toast(`${sp.nameEs} tolera que te acerques. La captura será más fácil.`,"ok");draw();}}}},"Acercarse");
  const ballLabel=()=>`Lanzar ${({poke:"Poké Ball",super:"Super Ball",ultra:"Ultra Ball",master:"Master Ball"})[ballChoice]}`;
  const ballSelect=h("select",{class:"tb-ball-select",disabled:encounterEnded,on:{change:e=>{ballChoice=e.target.value;ballButton.textContent=ballLabel();ballButton.disabled=encounterEnded||actions<=0||!(app.profile.data.balls[ballChoice]>0);}}},...[["poke","Poké Ball"],["super","Super Ball"],["ultra","Ultra Ball"],["master","Master Ball"]].map(([v,l])=>h("option",{value:v},l)));
  ballSelect.value=ballChoice;
  const ballButton=h("button",{class:"btn btn-gold",disabled:actions<=0||encounterEnded||!(app.profile.data.balls[ballChoice]>0),on:{click:async()=>{
   actions--;app.profile.data.balls[ballChoice]--;app.profile.commit();
   const actionPanel=ballButton.closest(".panel");actionPanel?.querySelectorAll("button,select").forEach(el=>el.disabled=true);
   const bonus=(isObserved?.04:0)+approachBonus+baitBonus;
   ballButton.disabled=true;ballButton.classList.add("safari-throwing");creature.classList.add("safari-ball-throw");
   scene.appendChild(h("span",{class:"safari-ball-projectile","aria-hidden":"true",style:`--ball-x:${posX}%`},"●"));
   const chance=safariCaptureChance(sp.rarity,ballChoice,bonus);
   ballButton.dataset.captureChance=String(chance);
   await new Promise(resolve=>setTimeout(resolve,650));
   if(Math.random()<chance){
    const fresh=unlock(app,sight);finishVisit(`¡Capturaste a ${sp.nameEs}!${fresh?" Se ha añadido a tu colección.":" Has recibido una copia."}`);
   }else finishVisit(`${sp.nameEs} ha escapado de la Poké Ball. La visita ha terminado.`);
  }}},ballLabel());
  const wait=h("button",{class:"btn btn-blue",disabled:actions<=0||encounterEnded,on:{click:()=>{actions--;if(behavior==="escondido"&&!isObserved){observed.add(sight);toast("Esperas sin hacer ruido y consigues identificarlo.","info");draw();}else{const flee=behavior==="asustadizo"?.25:.06;if(Math.random()<flee)finishVisit(`${sp.nameEs} se marcha. La visita ha terminado.`);else{toast("Esperas pacientemente. El Pokémon sigue moviéndose por el hábitat.","info");draw();}}}}},"Esperar");
  if(actions<=0&&!encounterEnded)encounterEnded=true;
  const next=h("button",{class:"btn btn-blue",disabled:!remaining(),on:{click:()=>{sight=null;draw();startVisit();}}},"Nueva visita");
  root.append(scene,h("section",{class:"panel stack"},
   h("div",{class:"row safari-actions"},observe,approach,bait,ballSelect,ballButton,wait),
   h("small",{class:"sub"},`Poké Balls disponibles: Poké ${app.profile.data.balls.poke} · Super ${app.profile.data.balls.super} · Ultra ${app.profile.data.balls.ultra} · Master ${app.profile.data.balls.master}.`),
   h("small",{class:"sub"},`Captura base con Poké Ball: ${Math.round((SAFARI_CAPTURE_BASE[sp.rarity]??.70)*100)} % · Bonus: observación ${isObserved?"+4":"+0"} %, acercamiento +${Math.round(approachBonus*100)} %, cebo +${Math.round(baitBonus*100)} % · Poké Ball ${Math.round(safariCaptureChance(sp.rarity,"poke",(isObserved?.04:0)+approachBonus+baitBonus)*100)} % · Super Ball ${Math.round(safariCaptureChance(sp.rarity,"super",(isObserved?.04:0)+approachBonus+baitBonus)*100)} % · Ultra Ball ${Math.round(safariCaptureChance(sp.rarity,"ultra",(isObserved?.04:0)+approachBonus+baitBonus)*100)} % · Master Ball 100 %`),
   encounterEnded?h("div",{class:"row between"},h("b",null,"Visita finalizada"),next):null
  ));
 };
 draw();return root;
}
