import {scene} from '@/core/engine.ts';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {groundHeight,rand} from '@/core/constants.ts';
import {playerPos} from '@/actors/player.ts';
import {solids} from '@/world/world.ts';
import {message} from '@/ui/hud.ts';
import {blip,thud} from '@/audio/audio.ts';
import {playCutscene} from '@/story/story.ts';
import {buildRick} from '../../assets/models/characters/rick.ts';
import campfire from '../../assets/models/rural/campfire.ts';
import tent from '../../assets/models/rural/tent.ts';
import logSeat from '../../assets/models/rural/log-seat.ts';
import woodPile from '../../assets/models/rural/wood-pile.ts';
import forestSicko from '../../assets/models/missions/forest-sicko.ts';
import {Npc,NPC_SEED} from '@/actors/npc.ts';
import {makeRng} from '@/core/rng.ts';
import type * as THREE from 'three';

// ============================================================================
// MISSÃO SECRETA DO RICK — acampamento na zona rural, no pé sul da montanha (do
// lado OPOSTO à casa de campo, que fica em z=-80). Rick é um eremita hippie que
// pede pra caçar os "doentes da floresta": criaturinhas verdes escondidas pela
// zona rural. SEM blip no mapa, SEM seta de navegação — é procurar de verdade.
// Tudo aqui é separado do STORY (js/story/story.ts): só reaprovamos a cut-scene.
// ============================================================================
const CAMP={x:474,z:62};       // centro do acampamento, no sopé sul da montanha
const TOTAL=5;                  // doentes a caçar
const REWARD=800;
const TALK_R=3.2;              // distância pra falar com o Rick
const CATCH_R=2.0;            // distância pra abater um doente a pé
const RICK_VOICE={freq:150,type:'sine' as OscillatorType}; // voz calma de hippie

const INTRO=[
  "Whoa, easy there, city slicker. Didn't expect anyone to wander this far from the concrete jungle.",
  "Name's Rick. I left all that noise behind, man — out here it's just me, the mountain, and the great green hush.",
  "But something's been creeping through my woods. The sickos. Little green wretches, rotting from the inside, spreading their plague tree to tree.",
  "I need you to hunt them down. All five. Comb the whole countryside — the fields, the farms, the mountainside, all of it.",
  "And listen — I won't put them on any map. The land doesn't hand you a map, brother. You hunt with your own two eyes. Now go.",
];
const OUTRO=[
  "You did it. Five sickos, back to the soil where they belong. The forest can breathe again.",
  "You've got the eyes of a true hunter, friend. The wild remembers the ones who protect it.",
  "Take this for your trouble. And hey... this stays between us and the trees.",
];

// Esconderijos curados pela zona rural: atrás de fazendas, dentro das roças, no
// sopé da montanha, no canto distante da península. Pequeno jitter no spawn.
const SPOTS=[
  {x:340,z:-20},   // atrás da fazenda noroeste
  {x:416,z:70},    // no meio da roça nordeste
  {x:486,z:46},    // no sopé sul da montanha, junto às pedras
  {x:558,z:-96},   // canto distante da península, no matagal
  {x:350,z:-55},   // na beira da roça sudoeste
];

// ---- monta o acampamento e o Rick (uma vez, no load do módulo) ----
function place(obj: THREE.Object3D,x: number,z: number,ry=0){
  obj.position.set(x,groundHeight(x,z),z);
  if(ry)obj.rotation.y=ry;
  scene.add(obj);
  return obj;
}

const rick=buildRick();
place(rick,CAMP.x+1.3,CAMP.z+1.3);
rick.rotation.y=Math.atan2(CAMP.x-rick.position.x,CAMP.z-rick.position.z); // encara o fogo

const fire=campfire.build();
place(fire,CAMP.x,CAMP.z);
const flames: THREE.Object3D[]=fire.userData.flames||[];
const fireGlow: THREE.Mesh|undefined=fire.userData.glow;

place(tent.build(),CAMP.x-2.5,CAMP.z-1.2,Math.PI*.12);
place(woodPile.build(),CAMP.x+2.0,CAMP.z-1.5,.6);
for(const[dx,dz]of[[1.7,.4],[-1.1,1.7],[-.3,-1.8]])
  place(logSeat.build(),CAMP.x+dx,CAMP.z+dz,Math.atan2(dx,dz)+Math.PI/2);

// colisão só da barraca (o resto é decorativo, dá pra passar perto do fogo)
solids.push({x0:CAMP.x-3.7,x1:CAMP.x-1.3,z0:CAMP.z-2.7,z1:CAMP.z+.3,h:1.5});

// ---- mission state ----
// A forest sicko extends Npc (so 100% of NPCs share the base class) but with
// register:false — it is hunted by proximity here, not by the player's weapons,
// so it stays out of the unified combat scan.
class Sicko extends Npc{
  baseY:number;
  phase:number;
  constructor(g:THREE.Object3D,baseY:number,gender:'M'|'F'){
    super(g,{kind:'sicko',hp:1,register:false,name:'Forest Sicko',area:'Wilderness',gender,femaleLook:false});
    this.baseY=baseY;this.phase=rand(0,6);
  }
  override aliveState():string{return 'Hiding';}
}
const sickos: Sicko[]=[];
let phase='idle'; // idle -> hunting -> returning -> done
let caught=0;

function spawnSickos(){
  // Fixed seed: every player hunts the same five sickos at the same spots.
  const rng=makeRng(NPC_SEED+4);
  for(const s of SPOTS){
    const x=s.x+rng.rand(-2,2),z=s.z+rng.rand(-2,2),y=groundHeight(x,z);
    const g=forestSicko.build();
    g.position.set(x,y,z);g.rotation.y=rng.rand(0,Math.PI*2);
    scene.add(g);
    sickos.push(new Sicko(g,y,rng.random()<.5?'M':'F'));
  }
}

function huntOne(s: Sicko){
  if(s.dead)return;
  s.dead=true;s.deadT=0;caught++;
  thud(6);blip([300,180,90],.12,'sawtooth',.18);
  if(caught>=TOTAL){
    phase='returning';
    message('ALL FOREST SICKOS HUNTED! RETURN TO RICK','var(--gold)');
  }else message('FOREST SICKO HUNTED  '+caught+'/'+TOTAL,'#9dff2e');
}

// ---- API exposta via refs (main.js) ----
export function rickNear(){
  if(state.mode!=='foot'||state.cine||state.dlgActive)return null;
  if(phase!=='idle'&&phase!=='returning')return null;
  const pp=playerPos();
  return Math.hypot(pp.x-rick.position.x,pp.z-rick.position.z)<TALK_R?'RICK':null;
}

export function rickInteract(){
  if(state.dlgActive||state.mode!=='foot'||!rickNear())return false;
  if(phase==='idle'){
    phase='briefing';
    playCutscene(rick,RICK_VOICE,INTRO,()=>{
      spawnSickos();
      phase='hunting';
      message('HUNT THE '+TOTAL+' FOREST SICKOS - NO MAP. SEARCH THE WILDERNESS.','#9dff2e');
    });
    return true;
  }
  if(phase==='returning'){
    phase='done';
    playCutscene(rick,RICK_VOICE,OUTRO,()=>{
      economy.earn(REWARD,'rick');
      message('SECRET MISSION COMPLETE  +$'+REWARD,'var(--gold)');
      blip([523,659,784,1047],.1,'sine',.18);
    });
    return true;
  }
  return false;
}

export function getRickState(){
  return{phase,caught,total:TOTAL,
    rick:{x:+rick.position.x.toFixed(1),z:+rick.position.z.toFixed(1)},
    sickos:sickos.filter(s=>!s.dead).map(s=>(
      {x:+s.g.position.x.toFixed(1),z:+s.g.position.z.toFixed(1)}))};
}

export function updateRick(dt: number){
  // fogueira sempre tremulando + poça de luz pulsando
  for(const f of flames){
    const k=.7+Math.random()*.6;
    f.scale.set(k,.8+Math.random()*.5,k);
  }
  if(fireGlow)(fireGlow.material as THREE.Material).opacity=.14+Math.random()*.12;

  if(phase!=='hunting'&&phase!=='returning')return;
  const pp=playerPos();
  const catchR=state.mode==='car'?2.8:CATCH_R; // atropelar também vale
  for(const s of sickos){
    if(s.dead){ // brief "squashed" animation, then it vanishes
      if(s.g.parent){
        s.deadT+=dt;
        s.g.scale.y=Math.max(.02,1-s.deadT*3);
        s.g.rotation.y+=dt*12;
        s.g.position.y=s.baseY+s.deadT*.35;
        if(s.deadT>.5)s.despawn(); // removes from the scene + the NPC census
      }
      continue;
    }
    // tremor doentio parado (escondido)
    s.phase+=dt;
    s.g.position.y=s.baseY+Math.abs(Math.sin(s.phase*3))*.04;
    s.g.rotation.y+=Math.sin(s.phase*2)*dt*.5;
    if(phase==='hunting'&&
       Math.hypot(pp.x-s.g.position.x,pp.z-s.g.position.z)<catchR)huntOne(s);
  }
}
