import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {playerPos} from '@/actors/player.ts';
import {message} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {overkillMusicOn,overkillMusicOff} from '@/audio/overkill-music.ts';
import {makeOverkillTotem} from '../../assets/models/props/overkill-totem.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';

// modo livre (não trava o mundo: o overkill é justamente correr a cidade inteira
// sendo caçado). Registra a identidade no enum/registro de mini games; o totem
// some do radar enquanto uma sessão de outro mini game roda.
new MiniGame({id:MiniGameId.OVERKILL,name:'Overkill',exclusive:false});

// ============================================================================
// MODO OVERKILL (multiplicador de "heat") — opcional, ligado por um item.
//  - o jogador encosta no totem (perto do spawn) e aperta interagir (PC/mobile);
//  - aí começa o modo: um multiplicador SOBE enquanto você está sendo caçado
//    (mais rápido em estrela alta) e DECAI quando esfria;
//  - a renda por segundo = estrelas * multiplicador * K, ou seja, quanto mais
//    perigoso, mais dinheiro;
//  - o modo acaba quando o jogador MORRE ou é PRESO (player.js chama endOverkill).
//
// CUIDADO COM O BACKEND: o ranking (backend/lib/scores.js) só aceita score até
// BASE_MONEY + MONEY_PER_SEC(=200)/s ACUMULADO desde o início da run. Por isso a
// renda do overkill é limitada a MAX_RATE=75/s — fica BEM abaixo do teto e deixa
// folga pro resto da renda (delivery/taxi), então o cumulativo não estoura e a
// submissão não é rejeitada como implausible_score.
//
// BALANCEAMENTO: o overkill é high-risk (segurar estrela alta, morte/prisão tira
// 15–20%), então paga melhor que tudo — mas com teto e K moderados pra não virar
// a ÚNICA fonte de renda que vale a pena (antes ~$9k/min eclipsava todo o resto).
// ============================================================================

export const TOTEM={x:20,z:9}; // calçada norte do quarteirão do spawn (bem visível)
const RANGE=3;
const MAX_MULT=REWARDS.overkill.maxMultiplier, CLIMB=REWARDS.overkill.climbPerSec, DECAY=REWARDS.overkill.decayPerSec;
const K=REWARDS.overkill.rateFactor, MAX_RATE=REWARDS.overkill.maxPerSecond;

const hudEl=document.getElementById('overkill');
let totem: THREE.Object3D|null=null;
const ok={active:false,mult:1,peak:1,rate:0,acc:0,earned:0};

// cria a caveira do modo no ponto de interação
totem=makeOverkillTotem();
totem.position.set(TOTEM.x,0,TOTEM.z);
scene.add(totem);

// perto do totem, a pé, com o modo desligado -> mostra a ação (HUD/interact)
export function overkillNear(): string|null{
  if(ok.active||!state.started||state.mode!=='foot'||state.interior)return null;
  const pp=playerPos();
  return Math.hypot(pp.x-TOTEM.x,pp.z-TOTEM.z)<RANGE?'START OVERKILL MODE':null;
}

// blip do totem no mapa (some enquanto o modo já está ligado)
refs.overkillBlip=()=>ok.active?null:{x:TOTEM.x,z:TOTEM.z};

// liga o modo (chamado pelo performInteract). Devolve true se consumiu o aperto.
export function startOverkill(): boolean{
  if(!overkillNear())return false;
  ok.active=true;ok.mult=1;ok.peak=1;ok.rate=0;ok.acc=0;ok.earned=0;
  message('OVERKILL ON! GO LOUD - THE WILDER, THE RICHER','var(--pink)');
  blip([220,330,440,660,880],.12,'square',.2);
  overkillMusicOn();
  return true;
}

// acaba o modo (morte/prisão do jogador chamam isto via refs.endOverkill)
export function endOverkill(): void{
  if(!ok.active)return;
  ok.active=false;
  overkillMusicOff();
  message(`OVERKILL OVER - BANKED $${Math.round(ok.earned).toLocaleString('en-US')} (peak x${ok.peak.toFixed(1)})`,'var(--gold)');
  ok.mult=1;ok.peak=1;ok.rate=0;
  hudEl?.classList.remove('show');
}

export function getOverkillState(){
  return {
    active:ok.active,
    multiplier:+ok.mult.toFixed(2),
    peak:+ok.peak.toFixed(2),
    rate:+ok.rate.toFixed(2),
    earned:Math.round(ok.earned),
    totem:{x:TOTEM.x,z:TOTEM.z},
    near:!!overkillNear(),
  };
}

export function updateOverkill(dt: number): void{
  // anima a caveira sempre
  if(totem){
    const ic=totem.userData.icon;
    if(ic){
      const baseY=ic.userData.baseY??1.45;
      ic.rotation.y+=dt*(ok.active?5:1.6);
      ic.position.y=baseY+Math.sin(state.time*3)*.12;
    }
  }

  if(!ok.active){ok.rate=0;hudEl?.classList.remove('show');return;}
  // em cut-scene/interior o modo congela (sem crime, sem renda)
  if(state.mode==='cut'||state.cine||state.interior){
    ok.rate=0;
    hudEl?.classList.remove('show');
    return;
  }

  const w=Math.floor(state.wanted);
  // multiplicador: sobe com estrela (com um piso pra não ficar lento demais),
  // decai quando você esfria (sem procurado)
  if(w>0)ok.mult=Math.min(MAX_MULT,ok.mult+CLIMB*(.3+.7*w/5)*dt);
  else ok.mult=Math.max(1,ok.mult-DECAY*dt);
  ok.peak=Math.max(ok.peak,ok.mult);

  // renda por segundo, com TETO de segurança pro backend
  const rate=Math.min(MAX_RATE,w*ok.mult*K);
  ok.rate=rate;
  ok.acc+=rate*dt;
  if(ok.acc>=1){const add=Math.floor(ok.acc);ok.acc-=add;economy.earn(add,'overkill',{persist:false});ok.earned+=add;}

  if(hudEl){
    hudEl.classList.add('show');
    hudEl.textContent=`💀 OVERKILL  ×${ok.mult.toFixed(1)}   +$${Math.round(rate)}/s`;
  }
}
