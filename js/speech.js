import * as THREE from 'three';
import {scene,camera} from './engine.js';
import {state} from './state.js';
import {rand,pick} from './constants.js';
import {getTod} from './daynight.js';
import {playerPos} from './player.js';
import {peds} from './pedestrians.js';
import {makeSpeechBubble} from '../assets/models/characters/speech-bubble.js';

// Balões de diálogo flutuantes no mundo: aparecem acima da cabeça de um NPC,
// seguem ele, fazem fade in/out e somem depois de um tempo (dá pra ler tudo).
// say(alvo,texto,opts) é genérico (qualquer Object3D); updateSpeech anima.
// Aqui também mora o "papo de rua": de tempos em tempos um pedestre perto e
// visível solta uma frase aleatória/contextual.

const active=[];
const tmp=new THREE.Vector3(),fwd=new THREE.Vector3();

export function say(target,text,{life=6,yOff=2.6,alive=null}={}){
  if(!target||target.userData.speaking)return false; // um balão por NPC
  const spr=makeSpeechBubble(text);
  spr.material.opacity=0;
  scene.add(spr);
  target.userData.speaking=spr;
  active.push({spr,target,yOff,t:0,life,alive});
  return true;
}

function dispose(b){
  scene.remove(b.spr);
  b.spr.material.map?.dispose?.();
  b.spr.material.dispose();
  if(b.target.userData.speaking===b.spr)b.target.userData.speaking=null;
}

export function updateSpeech(dt){
  for(let i=active.length-1;i>=0;i--){
    const b=active[i];
    b.t+=dt;
    if(b.t>=b.life||(b.alive&&!b.alive())){dispose(b);active.splice(i,1);continue;}
    b.target.getWorldPosition(tmp);
    b.spr.position.set(tmp.x,tmp.y+b.yOff,tmp.z);
    // visível só no mesmo "contexto" do jogador: balão de NPC em sala invisível
    // some; e dentro de uma sala não aparece balão de pedestre da rua (e vice-versa)
    let vis=true,inActive=false,o=b.target;
    while(o){if(!o.visible)vis=false;if(state.interior&&o===state.interior.group)inActive=true;o=o.parent;}
    if(state.interior&&!inActive)vis=false;
    b.spr.visible=vis;
    const fin=Math.min(1,b.t/.22),fout=Math.min(1,(b.life-b.t)/.6);
    b.spr.material.opacity=Math.min(fin,fout); // fade in rápido, fade out suave
  }
}

// ---------------------------------------------------------------------------
// Papo de rua: frases aleatórias e contextuais nos pedestres
// ---------------------------------------------------------------------------
const AMBIENT=[
  "Nice weather for a getaway.",
  "This city gets weirder every day.",
  "Spare some change? No? Figures.",
  "I'm late for absolutely nothing.",
  "Tourists. Everywhere.",
  "My horoscope said avoid strangers today. Whoops.",
  "Do these palm trees look fake to you?",
  "I left the stove on... probably.",
  "Five stars on this sidewalk. Would walk again.",
  "Is it just me, or is gravity stronger here?",
  "I came out for milk an hour ago.",
  "One day I'll move somewhere boring.",
  "Pretty sure that pigeon is following me.",
];
const WANTED=[
  "He's got a gun! RUN!",
  "Somebody call the cops!",
  "I didn't see anything, officer!",
  "Not today, not me!",
  "Why is it always MY block?!",
  "We're all gonna be on the news!",
];
const CAR=[
  "Learn to drive, maniac!",
  "Hey! Sidewalks are for people!",
  "My insurance can't take this!",
  "Ten and two, buddy!",
  "Was that a red light? It was red!",
];
const ARMED=[
  "Is that thing loaded?",
  "Easy there, cowboy.",
  "I'll just... walk the other way.",
  "Cool gun, please don't.",
];
const NIGHT=[
  "Bit late to be wandering around.",
  "This city never sleeps, huh?",
  "I should NOT be out this late.",
  "Everything's creepier after dark.",
];

function pickLine(){
  const r=Math.random();
  if(state.wanted>=2&&r<.7)return pick(WANTED);
  if(state.mode==='car'&&r<.45)return pick(CAR);
  if((state.weaponHeld||state.hasGun)&&r<.4)return pick(ARMED);
  const tod=getTod();
  if((tod<.22||tod>.8)&&r<.4)return pick(NIGHT);
  return pick(AMBIENT);
}

let chatterT=3;
export function updateStreetChatter(dt){
  if(!state.started||state.interior||state.mode==='cut'||state.cine)return;
  chatterT-=dt;
  if(chatterT>0)return;
  chatterT=rand(2.4,4.8); // intervalo até a próxima fala
  const pp=playerPos();
  camera.getWorldDirection(fwd);
  const cands=[];
  for(const p of peds){
    if(p.state!=='walk'&&p.state!=='flee'&&p.state!=='panic')continue;
    if(p.g.userData.speaking)continue;
    const d=p.g.position.distanceTo(pp);
    if(d<3||d>22)continue;           // perto pra ler, mas não em cima
    tmp.subVectors(p.g.position,camera.position);
    if(tmp.dot(fwd)<=0)continue;     // só quem está na frente da câmera
    cands.push(p);
  }
  if(!cands.length)return;
  const p=pick(cands);
  say(p.g,pickLine(),{life:6.5,yOff:2.55,
    alive:()=>p.state!=='fly'&&p.state!=='dead'});
}
