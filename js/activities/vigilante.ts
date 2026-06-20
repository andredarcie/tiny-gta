import * as THREE from 'three';
import {N,nodeX,rand,irand,pick,clamp,ROAD,groundHeight,SWIM_BOUND,HALF} from '@/core/constants.js';
import {state,refs} from '@/core/state.js';
import {economy} from '@/core/economy.js';
import {scene} from '@/core/engine.js';
import {makeCar,seatDriver,spinWheels,shirtColors,dentCar} from '@/core/entities.js';
import {idleCars,cur,playerPos,resetCarDamage} from '@/actors/player.js';
import {makeDeliveryMarker} from '../../assets/models/missions/delivery-marker.js';
import {message,bigText,hideBig} from '@/ui/hud.js';
import {blip,thud} from '@/audio/audio.js';
import {collideStatics} from '@/core/physics.js';
import {PRISON_I,PRISON_J} from '../../assets/models/city/prison.js';
import {MiniGame,MiniGameId} from '@/activities/minigame.js';
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.js';

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
const DUTY_TIME=75;      // initial patrol time (seconds)
const BUST_BONUS=20;     // seconds added per capture
const HIT_RANGE=4.6;     // distance from cruiser to suspect to register a ram
const HIT_SPEED=4;       // minimum cruiser speed for a ram to count
const HIT_COOLDOWN=.6;   // minimum interval between rams
const JUKE_RANGE=6;      // player nearby: the suspect re-picks a destination to juke

// viatura estacionada na interseção ao lado do presídio (centro de cruzamento =
// sempre asfalto livre). Reposicionada aqui no respawn também.
const spawn={x:nodeX(PRISON_I)+4,z:nodeX(PRISON_J),heading:0};

const cruiser: any={g:makeCar(0xe8e8ee,true),heading:0,speed:0,
  name:'POLICE CRUISER',police:true,vigilante:true};
cruiser.g.position.set(spawn.x,0,spawn.z);
cruiser.g.rotation.y=0;
idleCars.push(cruiser);

// fugitivo: carro + estado de IA (destino, vida, marcador no chão)
interface Criminal{g:THREE.Object3D;hp:number;destX:number;destZ:number;heading:number;speed:number;lastHit:number;ring?:THREE.Mesh|null;beacon?:THREE.Mesh|null;}

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

// destino bem longe do jogador: interseção no lado OPOSTO do mapa (o fugitivo
// corre pra lá). Evita as bordas do mapa pra não se enroscar na praia/mar.
function pickDest(px: number,pz: number): [number,number]{
  let bx=spawn.x,bz=spawn.z,bd=-1;
  for(let t=0;t<14;t++){
    const i=irand(1,N-1),j=irand(1,N-1);
    const x=nodeX(i),z=nodeX(j);
    const d=Math.hypot(x-px,z-pz);
    if(d>bd){bd=d;bx=x;bz=z;}
  }
  return[bx,bz];
}

function setCrimMarker(){
  const{ring,beacon}=makeDeliveryMarker(RED);
  ring.rotation.x=Math.PI/2;
  scene.add(ring,beacon);
  criminal!.ring=ring;criminal!.beacon=beacon;
}

function clearCrimMarker(){
  if(criminal?.ring){scene.remove(criminal.ring,criminal.beacon!);
    criminal.ring=criminal.beacon=null;}
}

function spawnCriminal(){
  const pp=playerPos();
  // posição inicial: numa interseção a 60–120m do jogador (em cima da rua)
  let x=spawn.x,z=spawn.z,tries=0;
  do{
    x=nodeX(irand(1,N-1));z=nodeX(irand(1,N-1));tries++;
  }while((Math.hypot(x-pp.x,z-pp.z)<60||Math.hypot(x-pp.x,z-pp.z)>120)&&tries<40);
  const g=makeCar(0x23252e,false); // sedã escuro do bandido
  seatDriver(g,pick(shirtColors));  // motorista visível ao volante
  g.position.set(x,groundHeight(x,z),z);
  const[dx,dz]=pickDest(pp.x,pp.z);
  const heading=Math.atan2(dx-x,dz-z);
  g.rotation.y=heading;
  // Suspect speed stays well under the cruiser top speed (32) so the cruiser can
  // always close the gap. The suspect does not slow down in turns (the cruiser
  // does), so keeping it slower here keeps the chase catchable at every level.
  criminal={g,hp:2,destX:dx,destZ:dz,heading,
    speed:Math.min(22,15+level*0.8),lastHit:-99};
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
  cruiser.g.position.set(spawn.x,0,spawn.z);
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
  // ranking: a patrulha inteira é UMA sessão; score = prisões feitas
  reportMiniGameResult(game.id,{won:busts>0,score:busts});
  phase='off';
  game.end(); // libera a trava do mundo
  hideVigHud();
  message(text+summary,col);
}

function bustCriminal(){
  const reward=50*level;
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
  const mid=_v0.addVectors(cp,xp).multiplyScalar(.5).setY(.7);
  c.hp--;
  thud(8);
  state.shake=.3;
  // empurrão: afasta o bandido na direção da pancada
  xp.x+=_dir.x*1.1;xp.z+=_dir.z*1.1;
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

// IA do fugitivo: dirige para o destino distante, escorrega nos prédios com
// collideStatics e re-escolhe o destino ao chegar perto OU quando o jogador
// se aproxima (finta). Espelha a viatura da polícia, mas FUGINDO.
function updateCriminal(dt: number){
  const c=criminal!,p=c.g.position,pp=playerPos();
  const distPlayer=Math.hypot(pp.x-p.x,pp.z-p.z);
  let distDest=Math.hypot(c.destX-p.x,c.destZ-p.z);
  // re-escolhe destino: chegou perto, jogador colado (finta) ou perto da borda
  const nearEdge=Math.abs(p.x)>HALF+ROAD||Math.abs(p.z)>HALF+ROAD;
  if(distDest<12||distPlayer<JUKE_RANGE||nearEdge){
    const[dx,dz]=pickDest(pp.x,pp.z);
    c.destX=dx;c.destZ=dz;
    distDest=Math.hypot(dx-p.x,dz-p.z);
  }
  // vira na direção do destino (curva suave, igual aos carros de polícia/rivais)
  const desired=Math.atan2(c.destX-p.x,c.destZ-p.z);
  let diff=THREE.MathUtils.euclideanModulo(desired-c.heading+Math.PI,Math.PI*2)-Math.PI;
  c.heading+=clamp(diff,-1,1)*2.6*dt;
  // anda pra frente; collideStatics escorrega nos prédios e prende ao mundo
  p.x+=Math.sin(c.heading)*c.speed*dt;
  p.z+=Math.cos(c.heading)*c.speed*dt;
  collideStatics(p,1.3,SWIM_BOUND);
  p.y=groundHeight(p.x,p.z);
  c.g.rotation.y=c.heading;
  spinWheels(c.g,c.speed,dt,clamp(diff,-1,1));
  // marcador pulsando seguindo o bandido (anel no chão + facho de luz)
  if(c.ring){
    c.ring.position.set(p.x,.4,p.z);
    c.beacon!.position.set(p.x,30,p.z);
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
    if(wreckT>20){
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
