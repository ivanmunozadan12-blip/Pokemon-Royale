import { h, toast, ballIcon, coinIcon } from '../dom.js';

const WHEEL_PRIZES = [
  ...[50,75,100,125,150,200,250,300].map(n=>({type:'coins',amount:n})),
  ...['poke','poke','super','super','ultra'].map(ball=>({type:'ball',ball,amount:1})),
  {type:'coins',amount:400},{type:'coins',amount:600},
  {type:'token',amount:1},{type:'token',amount:2},
  {type:'pokemon',rarity:'raro'},{type:'pokemon',rarity:'epico'},
  {type:'ball',ball:'ultra',amount:1}
];
const ballLabel = b => b==='ultra'?'Ultra Ball':b==='super'?'Super Ball':'Poké Ball';
function prizeIcon(prize){
  if(prize.type==='coins') return coinIcon();
  if(prize.type==='ball') return ballIcon(prize.ball);
  if(prize.type==='token') return h('span',{class:'wheel-prize-emoji'},'🎟️');
  const ball=prize.rarity==='epico'?'ultra':'super';
  return h('span',{class:'wheel-pokemon-icon'},ballIcon(ball),h('b',null,'?'));
}
function label(prize){
  if(prize.type==='coins')return `${prize.amount} monedas`;
  if(prize.type==='ball')return ballLabel(prize.ball);
  if(prize.type==='token')return `${prize.amount} ficha${prize.amount>1?'s':''}`;
  return prize.rarity==='epico'?'Pokémon épico':'Pokémon raro';
}
export function ruletaScreen(app) {
 const p=app.profile, root=h('div',{class:'casino-panel'}); let spinning=false;
 const draw=()=>{root.replaceChildren();
 const available=p.wheelAvailable(), last=p.data.dailyWheel?.prize;
 const wheel=h('div',{class:'wheel-wrap'},h('div',{class:'wheel-pointer','aria-label':'La flecha señala el premio ganador'},'▼'),h('div',{class:'wheel-board',id:'daily-wheel'},...WHEEL_PRIZES.map((prize,i)=>h('div',{class:'wheel-sector',style:`--i:${i}`},prizeIcon(prize)))));
 root.append(h('section',{class:'panel stack'},h('div',{class:'tag'},'RECOMPENSA DIARIA'),h('h2',null,'Ruleta diaria'),h('p',{class:'sub'},'Una tirada diaria · 20 sectores · premios sin legendarios ni Master Ball.'),wheel,
 h('div',{class:'prize-grid wheel-prize-list'},...WHEEL_PRIZES.map((prize,i)=>h('span',{class:'prize-chip'},h('b',null,String(i+1).padStart(2,'0')),prizeIcon(prize),h('small',null,label(prize))))),
 h('button',{class:'btn btn-gold btn-big',disabled:!available||spinning,on:{click:()=>{
   if(spinning)return; const r=p.claimDailyWheel(); if(!r.ok){toast('La ruleta ya se ha utilizado hoy.','info');return;}
   spinning=true; const prize=r.prize; let idx=WHEEL_PRIZES.findIndex(x=>x.type===prize.type && (x.type!=='coins'||x.amount===prize.amount) && (x.type!=='ball'||x.ball===prize.ball) && (x.type!=='token'||x.amount===prize.amount) && (x.type!=='pokemon'||x.rarity===prize.rarity)); if(idx<0)idx=0;
   const wheelEl=root.querySelector('.wheel-board'); const sector=360/20; const target=360*6+(360-(idx*sector+sector/2)); wheelEl.style.transform=`rotate(${target}deg)`; wheelEl.classList.add('is-spinning');
   app.audio.sfx('coin');
   setTimeout(()=>{spinning=false; const msg=prize.type==='pokemon'?`¡Has conseguido ${prize.name}!`:prize.type==='coins'?`¡Has ganado ${prize.amount} monedas!`:prize.type==='ball'?`¡Has ganado ${prize.amount} ${ballLabel(prize.ball)}!`:`¡Has ganado ${prize.amount} ficha(s) gratis!`;toast(msg,'ok',5000);draw();},4600);
 }}},spinning?'¡Mucha suerte!':available?'🎡 GIRAR RULETA':'Vuelve mañana'),
 !available&&h('p',{class:'sub'},'Tu tirada diaria ya está recogida.'),
 last&&h('div',{class:'result'},h('b',null,'Último premio guardado'),h('span',null,last.type==='pokemon'?last.name:last.type==='coins'?`${last.amount} monedas`:last.type==='ball'?`${last.amount} ${ballLabel(last.ball)}`:`${last.amount} fichas`))));
 }; draw(); app.watch(draw); return root;
}
