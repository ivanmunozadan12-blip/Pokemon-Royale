import { h } from "../dom.js";
import { makeTournament, TOURNAMENT_RULES, TOURNAMENT_SIZES, resolveCpuMatches, recordPlayerMatch, tournamentPlayerOpponent, tournamentDeck, tournamentWeather } from "../../game/tournaments.js";
import { SPECIES } from "../../data/species.js";
export function torneosScreen(app){
 const p=app.profile,root=h('div',{class:'page'});let size=4,rule='open';
 const draw=()=>{root.replaceChildren(h('h1',null,'Torneos'),h('p',{class:'sub'},'Compite en copas eliminatorias. Cada ronda se juega con el motor normal de combate; el clima solo se activa en este modo.'));
 const active=p.data.tournamentProgress;
 if(!active){root.append(h('section',{class:'panel stack'},h('h3',null,'Nueva copa'),
 h('label',null,'Participantes'),h('select',{on:{change:e=>{size=Number(e.target.value);}}},TOURNAMENT_SIZES.map(n=>h('option',{value:String(n)},String(n)))),
 h('label',null,'Reglas'),h('select',{on:{change:e=>{rule=e.target.value;}}},TOURNAMENT_RULES.map(r=>h('option',{value:r.id},r.name))),
 h('button',{class:'btn btn-gold',on:{click:()=>{p.data.tournamentProgress=makeTournament(size,rule,Date.now());p.commit();draw();}}},'Crear torneo')));}
 else {
  const ruleDef=TOURNAMENT_RULES.find(r=>r.id===active.rule)??TOURNAMENT_RULES[0];
  const bracket=active.rounds.map((rd,i)=>h('div',{class:'panel stack'},h('strong',null,i===0?'Cuartos / primera ronda':`Ronda ${i+1}`),...rd.map(m=>h('p',{class:'sub'},`${m.a?.name??'—'}  vs  ${m.b?.name??'—'}  ·  ${m.winner?.name??(m.result===null?'Pendiente':'Resuelto')}`))));
  root.append(h('section',{class:'panel stack'},h('h3',null,`Copa de ${active.size}`),h('p',{class:'sub'},`${active.complete?'Finalizada':`Ronda ${active.currentRound+1}`} · ${ruleDef.name}`),h('p',{class:'sub'},active.complete?`Campeón: ${active.champion}`:'El cuadro completo se resuelve ronda a ronda; los cruces CPU se simulan automáticamente.'),h('button',{class:'btn btn-gold',disabled:active.complete,on:{click:()=>playRound(active)}},active.currentRound===Math.log2(active.size)-1?'Jugar final':'Jugar siguiente ronda'),h('button',{class:'btn btn-blue',on:{click:()=>{p.data.tournamentProgress=null;p.commit();draw();}}},'Abandonar torneo')),...bracket);
 }

 };
 const playRound=(cup)=>{
  const round=cup.currentRound, ruleDef=TOURNAMENT_RULES.find(r=>r.id===cup.rule)??TOURNAMENT_RULES[0];
  try { resolveCpuMatches(cup,round); } catch(e) { console.error(e); alert('No se pudo simular un cruce CPU: '+e.message); return; }
  const match=tournamentPlayerOpponent(cup);
  if(!match){alert('El cuadro no contiene tu próximo cruce.');return;}
  const rival=match.a.id==='player'?match.b:match.a;
  let playerDeck=p.deck.ids.slice();
  if(ruleDef.type) playerDeck=playerDeck.filter(id=>SPECIES.find(s=>s.id===id)?.types.includes(ruleDef.type));
  if(ruleDef.maxCost) playerDeck=playerDeck.filter(id=>SPECIES.find(s=>s.id===id)?.cost<=ruleDef.maxCost);
  if(playerDeck.length<8){alert('Tu mazo necesita 8 Pokémon que cumplan las reglas de este torneo.');return;}
  p.data.tournamentProgress=cup;p.commit();
  app.startBattle({mode:'tournament',deck:playerDeck,enemyDeck:tournamentDeck(rival,ruleDef),difficulty:round>=2?'dificil':'normal',noItems:!!ruleDef.noItems,weather:tournamentWeather(rival,ruleDef),onComplete:(result)=>{
   const current=p.data.tournamentProgress;if(!current)return;
   try {
    recordPlayerMatch(current,result?.winner===0);
    if(current.complete&&current.won)p.data.coins+=250*current.size;
    p.data.tournamentProgress=current;p.commit();draw();
   } catch(e){console.error(e);alert('Error al actualizar el cuadro: '+e.message);}
  }});
 };

 draw();app.watch(draw);return root;
}
