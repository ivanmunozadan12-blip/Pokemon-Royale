export const TOURNAMENT_SIZES=[4,8,16];
export const TOURNAMENT_RULES=[
 {id:'open',name:'Copa abierta',type:null,weather:'random'},
 {id:'fire',name:'Copa de fuego',type:'fuego',weather:'sun'},
 {id:'water',name:'Copa de agua',type:'agua',weather:'rain'},
 {id:'grass',name:'Copa de planta',type:'planta',weather:'sun'},
 {id:'electric',name:'Copa eléctrica',type:'electrico',weather:'storm'},
 {id:'no-items',name:'Sin objetos',noItems:true,weather:'random'},
 {id:'budget',name:'Coste limitado',maxCost:3,weather:'neutral'}
];
export function makeTournament(size,rule,seed=1){
 const count=TOURNAMENT_SIZES.includes(size)?size:4;
 let x=(seed>>>0)||1; const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
 const names=['Rojo','Azul','Verde','Amarillo','Lance','Lorelei','Bruno','Agatha','Gary','Aura','Néstor','Maya','Cintia','Máximo','Cathy'];
 const entrants=Array.from({length:count-1},(_,i)=>({id:`cpu-${i}`,name:names[i%names.length],seed:Math.floor(rand()*1e9)}));
 entrants.splice(Math.floor(rand()*count),0,{id:'player',name:'Tú',seed});
 const rounds=[]; let current=Array.from({length:count/2},(_,i)=>({id:`r0-${i}`,a:entrants[i*2],b:entrants[i*2+1],result:null}));
 rounds.push(current);
 let matches=count/4, round=1;
 while(matches>=1){rounds.push(Array.from({length:matches},(_,i)=>({id:`r${round}-${i}`,a:null,b:null,result:null})));matches/=2;round++;}
 return {id:`cup-${seed}`,size:count,rule,entrants,rounds,currentRound:0,complete:false,champion:null};
}


import { runHeadless } from "../sim/runner.js";
import { SPECIES } from "../data/species.js";

const WEATHER_IDS=['neutral','sun','rain','storm','hail','sand'];
export function tournamentDeck(entrant, ruleDef) {
 const pool=SPECIES.filter(s=>(!ruleDef.type||s.types.includes(ruleDef.type))&&(!ruleDef.maxCost||s.cost<=ruleDef.maxCost));
 const source=pool.length>=8?pool:SPECIES;
 const seed=Math.max(1,entrant.seed>>>0);
 const deck=[]; let x=seed;
 while(deck.length<8){x^=x<<13;x^=x>>>17;x^=x<<5;const sp=source[(x>>>0)%source.length];if(!deck.includes(sp.id))deck.push(sp.id);}
 return deck;
}
export function tournamentWeather(entrant, ruleDef){return ruleDef.weather==='random'?WEATHER_IDS[(entrant.seed>>>0)%WEATHER_IDS.length]:ruleDef.weather;}
/** Simula los cruces CPU pendientes de una ronda con el mismo motor de combate del juego. */
export function resolveCpuMatches(cup, roundIndex=cup.currentRound){
 const round=cup.rounds[roundIndex]; if(!round)return cup;
 const ruleDef=TOURNAMENT_RULES.find(r=>r.id===cup.rule)??TOURNAMENT_RULES[0];
 for(const match of round){
  if(match.result!==null||!match.a||!match.b||match.a.id==='player'||match.b.id==='player')continue;
  const seed=(match.a.seed^Math.imul(match.b.seed,31)^((roundIndex+1)*0x9e3779b9))>>>0;
  const aDeck=tournamentDeck(match.a,ruleDef), bDeck=tournamentDeck(match.b,ruleDef);
  const sim=runHeadless({seed,mode:'tournament',playerDeck:aDeck,enemyDeck:bDeck,difficulty:'normal',player0Ai:'normal',towerLevel:1,maxSeconds:250,weather:tournamentWeather(match.a,ruleDef),noItems:!!ruleDef.noItems});
  match.result=sim.result.winner===0?0:sim.result.winner===1?1:(sim.result.crowns?.[0]>=sim.result.crowns?.[1]?0:1);
  match.winner=match.result===0?match.a:match.b;
  match.cpuSummary={durationSec:Math.round(sim.result.durationSec),crowns:sim.result.crowns??[0,0]};
 }
 return cup;
}
/** Registra el ganador humano y construye el siguiente nivel con todos los ganadores ya resueltos. */
export function recordPlayerMatch(cup, won){
 const ri=cup.currentRound, round=cup.rounds[ri];
 const match=round?.find(m=>m.a?.id==='player'||m.b?.id==='player');
 if(!match)throw new Error('No se encuentra el cruce del jugador');
 match.result=match.a.id==='player'?(won?0:1):(won?1:0);
 match.winner=match.result===0?match.a:match.b;
 resolveCpuMatches(cup,ri);
 const winners=round.map(m=>m.winner??(m.result===0?m.a:m.b));
 if(winners.some(x=>!x))throw new Error('El cuadro contiene un combate sin resolver');
 if(winners.length===1){cup.complete=true;cup.champion=winners[0].name;cup.won= cup.champion==='Tú';return cup;}
 let next=[];
 for(let i=0;i<winners.length;i+=2)next.push({id:`r${ri+1}-${i/2}`,a:winners[i],b:winners[i+1],result:null,winner:null});
 cup.rounds[ri+1]=next; cup.currentRound=ri+1;
 // Si el jugador ha sido eliminado, la competición CPU continúa hasta decidir un campeón real.
 while(!next.some(m=>m.a?.id==='player'||m.b?.id==='player')){
  resolveCpuMatches(cup,cup.currentRound);
  const cpuWinners=next.map(m=>m.winner??(m.result===0?m.a:m.b));
  if(cpuWinners.some(x=>!x))throw new Error('El cuadro CPU contiene un combate sin resolver');
  if(cpuWinners.length===1){cup.complete=true;cup.champion=cpuWinners[0].name;cup.won=false;return cup;}
  const nr=cup.currentRound+1, following=[];
  for(let i=0;i<cpuWinners.length;i+=2)following.push({id:`r${nr}-${i/2}`,a:cpuWinners[i],b:cpuWinners[i+1],result:null,winner:null});
  cup.rounds[nr]=following; cup.currentRound=nr; next=following;
 }
 return cup;
}
export function tournamentPlayerOpponent(cup){
 const round=cup.rounds[cup.currentRound]??[];
 return round.find(m=>m.a?.id==='player'||m.b?.id==='player')??null;
}
