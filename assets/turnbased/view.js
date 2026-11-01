import { h, spriteImg, toast } from "../ui/dom.js";
import { activeOf, resolveTurnPhased, continueTurnPhased } from "./engine.js";
export function openTurnBattle(app, cfg, onDone) {
  const layer=h("div",{class:"tb-layer"});
  const battle=cfg.battle;
  let locked=false,done=false;
  const close=(result)=>{if(done)return;done=true;layer.remove();app.battleRoot.hidden=true;app.battleRoot.className="";onDone?.(result,battle);};
  const render=()=>{
    const p=activeOf(battle,"player"),e=activeOf(battle,"enemy");
    const bar=(x)=>h("div",{class:"tb-hp"},h("i",{style:`width:${Math.max(0,x.hp/x.maxHp*100)}%`}),h("small",null,`${x.hp}/${x.maxHp} PS`));
    const statusNames={burn:"Quemado",poison:"Envenenado",toxic:"Envenenamiento grave",paralysis:"Paralizado",sleep:"Dormido",freeze:"Congelado"};
    const mon=(x,side)=>{const im=spriteImg(x.id,side==="player"?"b":"f",`tb-sprite tb-sprite-${side}`);im.src=`sprites/static/${side==="player"?"b":"f"}${x.id}.png`;if((battle.lastEvents||[]).some(e=>e.type==="attack"&&e.side===side))im.classList.add("tb-sprite-attack");if((battle.lastEvents||[]).some(e=>e.type==="damage"&&e.side===side))im.classList.add("tb-sprite-hit");if((battle.lastEvents||[]).some(e=>e.type==="heal"&&e.side===side))im.classList.add("tb-sprite-heal");const conditions=[x.status?statusNames[x.status]||x.status:null,x.volatile.confusionTurns>0?"Confuso":null,x.volatile.leech?"Drenadoras":null,x.volatile.trapped?"Atrapado":null].filter(Boolean);return h("div",{class:`tb-mon ${side}`},im,h("div",{class:"tb-info"},h("b",null,`${x.name} · Nv. ${x.level}`),h("small",null,x.types.join(" / ")),bar(x),h("small",null,conditions.length?conditions.join(" · "):"Sin alteraciones"),x.ability?h("small",null,`Habilidad: ${x.ability}`):null));};
    const log=h("div",{class:"tb-log","aria-live":"polite"},...battle.log.slice(-5).map(x=>h("p",null,x)));
    const moves=h("div",{class:"tb-moves"},...p.moves.map((m,i)=>h("button",{class:"tb-move",disabled:locked||m.pp<=0||battle.over,on:{click:()=>turn({kind:"move",move:m})}},h("b",null,m.name),h("small",null,`${m.type} · ${m.category==="physical"?"Físico":m.category==="special"?"Especial":"Estado"}`),h("small",null,`PP ${m.pp}/${m.maxPp} · ${m.power?m.power+" POT":"—"} · ${m.accuracy===null?"No falla":`Prec. ${m.accuracy}%`}`),m.priority?h("small",null,`Prioridad ${m.priority>0?"+":""}${m.priority}`):null)));
    const switches=battle.player.map((x,i)=>h("button",{class:"btn btn-blue sm",disabled:locked||i===battle.active.player||x.hp<=0,on:{click:()=>turn({kind:"switch",index:i})}},`${x.name} (${x.hp}/${x.maxHp})`));
    const forced=battle.pendingSwitch==="player";
    const actions=forced?h("div",{class:"tb-actions"},h("div",{class:"tb-moves-title"},"¡Tu Pokémon ha sido debilitado! Elige quién entra."),h("div",{class:"row"},...switches)):h("div",{class:"tb-actions"},h("div",{class:"tb-moves-title"},"¿Qué debería hacer "+p.name+"?"),moves,h("div",{class:"row"},...switches),h("div",{class:"row"},h("button",{class:"btn btn-blue sm",disabled:locked||battle.items.potion<=0,on:{click:()=>turn({kind:"item",item:"potion"})}},"Poción ×"+battle.items.potion),cfg.allowCapture&&battle.kind==="wild"?h("button",{class:"btn btn-green sm",disabled:locked||battle.items.pokeballs<=0,on:{click:()=>turn({kind:"capture"})}},"Poké Ball ×"+battle.items.pokeballs):null,battle.escapeAllowed?h("button",{class:"btn btn-red sm",disabled:locked,on:{click:()=>turn({kind:"run"})}},"Huir"):null));
    const result=battle.over?h("section",{class:"tb-result"},h("h2",null,battle.winner==="player"?"¡Victoria!":battle.winner==="capture"?"¡Captura conseguida!":battle.winner==="escape"?"Has escapado":battle.winner==="draw"?"Empate":"Derrota"),h("button",{class:"btn btn-gold btn-big",on:{click:()=>close(battle.winner)}},"Continuar")):actions;
    layer.replaceChildren(h("div",{class:"tb-shell"},h("header",{class:"tb-header"},h("b",null,cfg.title||"Combate Pokémon"),h("span",{class:"tb-turn-indicator","aria-live":"polite"},`${battle.pendingTurn?`Actúa ${battle.phaseSide==="player"?"el jugador":"el rival"}`:battle.pendingSwitch?"Relevo del jugador":battle.over?"Combate finalizado":"Turno del jugador"} · Turno ${battle.turn}${battle.field.weather?` · ${battle.field.weather}`:""}`),h("button",{class:"iconbtn",on:{click:()=>{if(cfg.allowClose)close("escape");}},"aria-label":"Cerrar"},"×")),h("div",{class:"tb-arena"},mon(e,"enemy"),mon(p,"player")),log,result));
  };
  const turn=async(a)=>{if(locked||battle.over)return;locked=true;resolveTurnPhased(battle,a);render();
    // La primera acción se anima y se presenta antes de ejecutar la respuesta rival.
    await new Promise(r=>setTimeout(r,560));
    if(battle.pendingTurn&&!battle.over){
      battle.phaseSide=battle.pendingTurn.order[battle.pendingTurn.next]?.side||"enemy";
      render();
      await new Promise(r=>setTimeout(r,220));
      continueTurnPhased(battle);render();await new Promise(r=>setTimeout(r,560));
    }
    locked=false;render();
  };
  render();app.battleRoot.hidden=false;app.battleRoot.className="turn-based";app.battleRoot.replaceChildren(layer);
  return {close:()=>close("escape"),battle};
}
