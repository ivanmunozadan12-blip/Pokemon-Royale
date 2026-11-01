export const WEATHER = Object.freeze({
  neutral:{id:'neutral',name:'Despejado',duration:0,desc:'Sin modificadores meteorológicos.'},
  sun:{id:'sun',name:'Sol intenso',duration:38,desc:'Fuego +12 %, agua −8 %.'},
  rain:{id:'rain',name:'Lluvia',duration:38,desc:'Agua +12 %, fuego −8 %.'},
  storm:{id:'storm',name:'Tormenta eléctrica',duration:30,desc:'Ataques eléctricos +8 %.'},
  hail:{id:'hail',name:'Nieve y granizo',duration:30,desc:'Daño leve periódico a unidades no resistentes al hielo.'},
  sand:{id:'sand',name:'Tormenta de arena',duration:30,desc:'Daño leve periódico a unidades no resistentes a roca, tierra o acero.'}
});
export function weatherAllowed(mode){return mode==='story'||mode==='tournament';}
export function weatherDamageMul(weather, type){
  if(weather==='sun') return type==='fuego'?1.12:type==='agua'?.92:1;
  if(weather==='rain') return type==='agua'?1.12:type==='fuego'?.92:1;
  if(weather==='storm') return type==='electrico'?1.08:1;
  return 1;
}
export function weatherForStage(stage, seed=1){
  if(stage?.weather && WEATHER[stage.weather]) return stage.weather;
  const list=['neutral','sun','rain','storm','hail','sand'];
  return list[Math.abs(seed)%list.length];
}
