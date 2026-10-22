import * as THREE from 'three';
import {pick,clamp,groundHeight,wrapA} from '@/core/constants.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {makeCar,seatDriver,spinWheels,shirtColors,dentCar} from '@/core/entities.ts';
import {idleCars,cur,playerPos,resetCarDamage} from '@/actors/player.ts';
import {makeMarkerRing} from '../../assets/models/missions/marker-ring.ts';
import {Beacon} from '@/core/beacon.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip,thud} from '@/audio/audio.ts';
import {PRISON_SPAWN_OUT} from '../../assets/models/city/prison.ts';
import {LaneRunner,randomRoadPoint,edges,laneOff,nearestRoad,pointAt,fleeChooser,type RoadPos} from '@/world/divinolandia/nav.ts';
import {carRoad} from '@/world/traffic.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {markMiniGamePlayed} from '@/activities/minigame-intro.ts';

// Vigilante estilo open-world clássico: uma viatura de polícia fica estacionada na
// esquina ao lado do presídio. Entrou nela, começa a patrulha: a cada nível
// nasce UM criminoso fugindo de carro pela cidade. Sem drive-by neste jogo
// (armas só a pé), então a captura é na MARRADA — encoste a viatura em
// velocidade pra bater nele; três pancadas e ele é preso. Cada captura paga,
// adiciona tempo e sobe o nível (fugitivos mais rápidos). Zerou o tempo, o
// suspeito escapa e a patrulha recomeça (igual ao expediente contínuo do táxi).
// Sair da viatura (ou WASTED/BUSTED) encerra a patrulha.

const VIG_BUILD=' ◆ STREET JUSTICE';
document.getElementById('buildver')?.insertAdjacentText('beforeend',VIG_BUILD);

const RED=0xff3b56;
const DUTY_TIME=REWARDS.vigilante.dutyTimeSec;      // initial patrol time (seconds)
const BUST_BONUS=REWARDS.vigilante.bustBonusSec;     // seconds added per capture
const HIT_RANGE=4.6;     // distance from cruiser to suspect to register a ram
const HIT_SPEED=4;       // minimum cruiser speed for a ram to count
const HIT_COOLDOWN=REWARDS.vigilante.ramCooldownSec;   // minimum interval between rams

// the cruiser waits in the street lane in front of the jail (by the Polícia Militar);
// it comes back here after being wrecked too
const spawn=(()=>{
  const r=nearestRoad(PRISON_SPAWN_OUT.x,PRISON_SPAWN_OUT.z,200,carRoad);
  if(!r)return{x:PRISON_SPAWN_OUT.x,z:PRISON_SPAWN_OUT.z,heading:0};
  const p=pointAt(r.e,r.s,1);
  return{x:r.x-p.dz*laneOff(r.e),z:r.z+p.dx*laneOff(r.e),heading:Math.atan2(p.dx,p.dz)};
})();

const cruiser: any={g:makeCar(0xe8e8ee,true),heading:spawn.heading,speed:0,
  name:'VIATURA',police:true,vigilante:true};
cruiser.g.position.set(spawn.x,groundHeight(spawn.x,spawn.z),spawn.z);
cruiser.g.rotation.y=spawn.heading;
idleCars.push(cruiser);

// the suspect: a car running along the streets (a LaneRunner that always turns away
// from the cruiser), its health and the ground marker following it
interface Criminal{g:THREE.Object3D;hp:number;run:LaneRunner;heading:number;speed:number;lastHit:number;slowT:number;ring?:THREE.Mesh|null;beacon?:Beacon|null;}

let phase='off';   // off | duty
let level=1;       // patrulha atual: dificuldade do fugitivo
let busts=0;       // capturas nesta patrulha
let timeLeft=0;    // cronômetro da patrulha
let criminal: Criminal|null=null; // {g,hp,destX,destZ,heading,speed,ring,beacon,lastHit}
let wreckT=0;      // viatura destruída: volta ao presídio depois de um tempo

// mini game (sessão): trava o mundo durante a patrulha; o alvo é o fugitivo
const game=new MiniGame({id:MiniGameId.VIGILANTE,name:'Street Justice',
  blips:()=>criminal?[{x:criminal.g.position.x,z:criminal.g.position.z,
    icon:'target',color:'#ff3b56',label:'SUSPECT',current:true,reveal:false}]:[]});

const vigHud=document.getElementById('vighud');

// Cancellable banner-hide timer: a stale hideBig from a previous session must not
// fire and wipe a banner shown by a new one. scheduleHide always replaces the pending timer.
let hideTimer: ReturnType<typeof setTimeout>|null=null;
function scheduleHide(ms: number){clearTimeout(hideTimer!);hideTimer=setTimeout(()=>{hideTimer=null;hideBig();},ms);}

// scratch reaproveitado nos cálculos por frame (zero alocação no loop)
const _v0=new THREE.Vector3(),_dir=new THREE.Vector3();

// blip vermelho do fugitivo no radar (vazio quando fora de serviço)
refs.vigilanteBlips=()=>{
  if(phase==='duty'&&criminal)
    return[{x:criminal.g.position.x,z:criminal.g.position.z,col:'#ff3b56',current:true}];
  return[];
};
// ponto da viatura quando fora de serviço (pro mapa achar o minigame)
refs.vigilanteStart=()=>phase==='off'?{x:cruiser.g.position.x,z:cruiser.g.position.z}:null;
refs.isVigilanteCar=(c: any)=>c===cruiser;
refs.getVigilanteState=()=>({phase,level,busts,timeLeft,active:phase!=='off'});

const _rp:RoadPos={x:0,z:0,dx:0,dz:0};

function setCrimMarker(){
  const ring=makeMarkerRing(RED);
  ring.rotation.x=Math.PI/2;
  scene.add(ring);
  const beacon=new Beacon(RED).mount();
  criminal!.ring=ring;criminal!.beacon=beacon;
}

function clearCrimMarker(){
  if(criminal?.ring){scene.remove(criminal.ring);criminal.beacon!.dispose();
    criminal.ring=criminal.beacon=null;}
}

function spawnCriminal(){
  const pp=playerPos();
  // starts on a street 70–160 m from the player, driving away from them
  const sp=randomRoadPoint({f:carRoad,near:{x:pp.x,z:pp.z},min:70,max:160});
  const away=pointAt(sp.e,sp.s,1);
  const dir:1|-1=(away.x-pp.x)*away.dx+(away.z-pp.z)*away.dz>=0?1:-1;
  const run=new LaneRunner(sp.e,dir,dir>0?sp.s:edges[sp.e].len-sp.s,
    {off:laneOff,f:carRoad,round:6,choose:fleeChooser(()=>cruiser.g.position,carRoad)});
  const p=run.at(0,_rp);
  const g=makeCar(0x23252e,false); // the getaway's dark sedan
  seatDriver(g,pick(shirtColors));  // a visible driver at the wheel
  g.rotation.order='YXZ';
  g.position.set(p.x,groundHeight(p.x,p.z),p.z);
  const heading=Math.atan2(p.dx,p.dz);
  g.rotation.y=heading;
  // Suspect speed stays well under the cruiser top speed (32) so the cruiser can
  // always close the gap; it brakes into the sharp bends like any driver.
  criminal={g,hp:2,run,heading,speed:Math.min(22,15+level*0.8),lastHit:-99,slowT:0};
  setCrimMarker();
}

function removeCriminal(){
  if(!criminal)return;
  clearCrimMarker();
  scene.remove(criminal.g);
  criminal=null;
}

function hideVigHud(){
  vigHud?.classList.remove('show');
}

function updateVigHud(){
  if(!vigHud)return;
  if(phase!=='duty'){hideVigHud();return;}
  vigHud.classList.add('show');
  const pct=Math.round(clamp(timeLeft/DUTY_TIME,0,1)*100);
  vigHud.innerHTML=`
    <div class="vig-label">JUSTICE</div>
    <div class="vig-main"><span>LEVEL</span><b>${level}</b></div>
    <div class="vig-row"><span>BUSTS</span><b>${busts}</b></div>
    <div class="vig-row"><span>TIME</span><b>${Math.ceil(timeLeft)}s</b></div>
    <div class="vig-meter"><i style="width:${pct}%"></i></div>`;
}

function resetCruiser(){
  cruiser.speed=0;cruiser.sinkT=0;cruiser.heading=spawn.heading;
  cruiser.g.userData.bulletHits=0;
  resetCarDamage(cruiser.g); // also clear crashCount/crashCd so the fresh cruiser doesn't carry stale crash damage
  cruiser.g.position.set(spawn.x,groundHeight(spawn.x,spawn.z),spawn.z);
  cruiser.g.rotation.set(0,spawn.heading,0);
  for(const d of cruiser.g.userData.doors||[])d.rotation.y=0;
}

function startDuty(){
  if(!game.begin())return; // outra sessão de mini game rolando: não começa
  clearTimeout(hideTimer!);hideTimer=null; // cancel any stale hide from a previous session
  phase='duty';level=1;busts=0;timeLeft=DUTY_TIME;
  spawnCriminal();
  message('STREET JUSTICE - RAM THE FLEEING SUSPECT','var(--blue)');
  blip([523,659,784],.08,'square',.16);
  updateVigHud();
}

function endDuty(text='STREET JUSTICE OFF DUTY',col='var(--cyan)'){
  removeCriminal();
  const summary=busts>0?` - ${busts} BUSTS / LVL ${level}`:'';
  // session over: counts toward the once-per-day lock
  markMiniGamePlayed(game.id);
  phase='off';
  game.end(); // libera a trava do mundo
  hideVigHud();
  message(text+summary,col);
}

function bustCriminal(){
  const reward=Math.min(REWARDS.vigilante.maxReward,REWARDS.vigilante.perBust*level);
  economy.earn(reward,'vigilante');
  busts++;
  message(`CRIMINAL BUSTED +$${reward}`,'var(--gold)');
  bigText('CRIMINAL BUSTED','var(--gold)');
  scheduleHide(1100);
  blip([523,659,784,1047],.09,'square',.2);
  removeCriminal();
  level++;
  timeLeft+=BUST_BONUS;
  spawnCriminal();
  updateVigHud();
}

function failDuty(){
  message('SUSPECT GOT AWAY','var(--pink)');
  bigText('SUSPECT GOT AWAY','var(--pink)');
  scheduleHide(1200);
  blip([330,247,180],.12,'sawtooth',.18);
  // patrulha CONTÍNUA (igual ao expediente do táxi): a fuga zera o nível/streak e o
  // cronômetro, mas manda outro suspeito sem expulsar o jogador da viatura.
  level=1;timeLeft=DUTY_TIME;
  removeCriminal();
  spawnCriminal();
  updateVigHud();
}

// pancada na viatura: tira 1 hp, amassa o bandido no ponto de contato, empurra
// um pouco e dá feedback. Na última vida, finaliza com explosão.
function registerHit(){
  const c=criminal!;
  const cp=cruiser.g.position,xp=c.g.position;
  c.lastHit=state.time;
  // ponto médio do contato e direção do empurrão (da viatura pro bandido)
  _dir.subVectors(xp,cp).setY(0);
  const len=Math.max(_dir.length(),.001);
  _dir.multiplyScalar(1/len);
  const mid=_v0.addVectors(cp,xp).multiplyScalar(.5);mid.y+=.7;
  c.hp--;
  thud(8);
  state.shake=.3;
  // the hit knocks the getaway off its stride for a moment
  c.slowT=1.2;
  cruiser.speed*=.55;
  if(c.hp<=0){
    dentCar(c.g,mid,_dir,.2);
    refs.explodeAt?.(xp.clone()); // finaliza com explosão (sem deixar destroços)
    bustCriminal();
  }else{
    dentCar(c.g,mid,_dir,.2);
    blip([392,294],.06,'square',.14);
  }
}

// The suspect's AI: floors it along the streets, turning at every junction onto the
// road that leads away from the cruiser (nav.fleeChooser), braking into sharp bends.
function updateCriminal(dt: number){
  const c=criminal!,p=c.g.position;
  if(c.slowT>0)c.slowT-=dt;
  const bend=c.run.bend(16);
  const v=c.speed*(bend>.12?.55:bend>.04?.8:1)*(c.slowT>0?.5:1);
  c.run.advance(v*dt);
  const np=c.run.at(0,_rp);
  p.set(np.x,groundHeight(np.x,np.z),np.z);
  const desired=Math.atan2(np.dx,np.dz),diff=wrapA(desired-c.heading);
  c.heading+=diff*Math.min(1,10*dt);
  const fx=Math.sin(c.heading),fz=Math.cos(c.heading);
  const slope=groundHeight(p.x+fx*1.3,p.z+fz*1.3)-groundHeight(p.x-fx*1.3,p.z-fz*1.3);
  c.g.rotation.set(-Math.atan2(slope,2.6),c.heading,0);
  spinWheels(c.g,v,dt,clamp(diff*2,-1,1));
  // the pulsing marker follows the suspect (ground ring + light beam)
  if(c.ring){
    c.ring.position.set(p.x,p.y+.4,p.z);
    c.beacon!.at(p.x,p.z);
    c.ring.rotation.z+=2*dt;
    const sc=1+Math.sin(state.time*4)*.12;c.ring.scale.set(sc,sc,1);
  }
  // pancada da viatura no fugitivo (em velocidade, com cooldown)
  if(state.time-c.lastHit>HIT_COOLDOWN&&
    cruiser.g.position.distanceTo(p)<HIT_RANGE&&Math.abs(cruiser.speed)>HIT_SPEED){
    registerHit();
  }
}

export function updateVigilante(dt: number){
  // viatura destruída: reaparece no presídio depois de um tempo
  if(!cruiser.g.parent&&cur!==cruiser){
    wreckT+=dt;
    if(wreckT>REWARDS.vigilante.wreckRespawnSec){
      wreckT=0;resetCruiser();
      scene.add(cruiser.g);
      if(!idleCars.includes(cruiser))idleCars.push(cruiser);
      message('A NEW POLICE CRUISER IS WAITING BY THE JAIL','var(--cyan)');
    }
  }

  const driving=state.mode==='car'&&cur===cruiser;
  if(phase==='off'){
    if(driving)startDuty(); // entrou na viatura: começa a patrulha
    return;
  }
  if(!driving){endDuty();return;} // saiu da viatura (ou WASTED/BUSTED): encerra

  timeLeft-=dt;
  if(timeLeft<=0){failDuty();return;}
  if(criminal)updateCriminal(dt);
  updateVigHud();
}
