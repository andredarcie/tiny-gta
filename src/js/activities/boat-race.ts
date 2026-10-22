import * as THREE from 'three';
import {clamp,pick,rubberSpeed,separateRacers,diminishPrize,smoothPace} from '@/core/constants.ts';
import {riverAt,riverArcAt,waterSurface,RIVER_LEN,BOAT_MOOR_S} from '@/world/divinolandia/water.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {makeBoat,makePed,shirtColors,disposeGeometries,vehicleOccupants} from '@/core/entities.ts';
import {cur,playerPos,cameraRig} from '@/actors/player.ts';
import {makeBuoy} from '../../assets/models/missions/buoy.ts';
import {makeSeaMine} from '../../assets/models/missions/sea-mine.ts';
import {makeExplosionModel} from '../../assets/models/effects/explosion.ts';
import {makeBoatRaceGate} from '../../assets/models/missions/boat-race-gate.ts';
import {makeMarkerRing} from '../../assets/models/missions/marker-ring.ts';
import {Beacon} from '@/core/beacon.ts';
import {makeWakePuff} from '../../assets/models/effects/boat-wake.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip,raceSiren} from '@/audio/audio.ts';
import {radioOff} from '@/ui/radio.ts';
import {raceMusicOn,raceMusicOff} from '@/audio/race-music.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {markMiniGamePlayed} from '@/activities/minigame-intro.ts';
import type {Racer,PrizeStreak,Blip} from '@/core/types.ts';

// boia (x,z) na ordem do percurso (a última é a chegada)
interface RoutePoint{x: number; z: number;}
// waypoint dos rivais: boias (cp:true) + desvios laterais das minas (cp:false)
interface BoatWaypoint{x: number; z: number; cp: boolean;}
// posição de uma bomba aquática + o ponto de desvio lateral que os rivais usam
interface MineSpec{leg: number; x: number; z: number; dx: number; dz: number;}
// bomba 3D viva na cena durante a prova
interface Mine{g: THREE.Group; x: number; z: number; bobT: number;}
// explosão ativa de uma mina detonada
interface Blast{g: THREE.Object3D; t: number;}
// marcador 3D de uma boia ou da chegada flutuante
interface CpMarker{buoy?: THREE.Group; beacon?: Beacon; finish?: THREE.Object3D;}
// puff de espuma recicladle do rastro das rivais
interface RivalWake{g: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; t: number; life: number; s0: number; s1: number;}
// objeto que carrega o estado de "pulo" de mina (lancha do jogador ou rival)
interface HopHolder{mineHopV?: number; mineHopY?: number; [k: string]: any;}

// mini game (sessão): trava o mundo durante a prova de lanchas. A corrida desenha
// suas próprias boias no radar (ver raceOn no hud.js), então não expõe blips de
// alvo aqui — a trava garante o "um por vez" e o mapa sem outras atividades.
const game=new MiniGame({id:MiniGameId.BOAT_RACE,name:'Corrida de Lanchas'});

// BOAT RACE down the Rio do Peixe: same scheme as the street race (race.ts), on the
// water. A floating start gate sits on the river; arrive by boat, stop under it and the
// race starts: the boat snaps to the line, siren + 3-2-1, then a course of BUOYS (one
// at a time) to round IN ORDER down to the floating finish. The course follows the
// river DOWNSTREAM (water.ts: the channel's surface always runs downhill), so every
// race is a real descent of a stretch of the Rio do Peixe; the buoys slalom across the
// 12 m wide channel and a few water mines sit in the middle of the legs. Three rival
// boats run the same water, following the river's own curves. Gangs vanish during the
// race and come back after. Music/radio belong to the race; if every rival finishes
// first you lose. Each finished race starts the next one on another stretch.

const RACE_BUILD=' ◆ RIO';
document.getElementById('buildver')?.insertAdjacentText('beforeend',RACE_BUILD);

const CP_COUNT=7;       // boias do percurso (a última é a chegada)
const CP_SPACING=190;   // river arc between buoys (m)
const LEAD=70;          // da linha de largada até a 1ª boia
const CP_AHEAD=0;       // boias visíveis além da atual (0 = SÓ a próxima boia que o jogador tem que pegar)
const CP_RADIUS=12;     // raio pra contar a passagem na boia (lancha é rápida/larga)
const NPC_COUNT=3;      // adversários
const NPC_REACH=8;      // rivais precisam chegar PERTO da boia pra avançar
const RIVAL_PACES=[0.82,0.90,0.96]; // per-rival pace, all <1 so a CLEAN run wins; the catch-up surge keeps trailing rivals dangerous if you slack (a sloppy run can still drop to 2nd/3rd).
const SEP=6;            // distância mínima entre duas lanchas: separa quem encosta
const MINE_MAX=3;       // só ALGUMAS bombas aquáticas por prova
const MINE_HIT=3.4;     // raio de colisão da mina (lancha é larga): encostou, levou
const MINE_DODGE=12;    // desvio lateral que os rivais fazem pra contornar a mina
const HOP_V=7.5;        // impulso vertical do "pulo" ao bater numa mina
const HOP_G=22;         // gravidade que traz a lancha de volta à água depois do pulo
const LAT_AMP=2.6;       // slalom: how far a buoy sits off the river's centre line (channel half-width 6)
const BOAT_FLOAT=.3;    // altura de flutuação da lancha acima da água (igual updateBoat)
const ORANGE=0xff8a1e;
const boatColors=[0x1fc4c4,0xffd24a,0xff2e88]; // rivais (a do jogador é coral)
const surf=(x: number,z: number)=>waterSurface(x,z)??riverAt(riverArcAt(x,z).s).y; // water height at a point
const SPAN=LEAD+(CP_COUNT-1)*CP_SPACING;

// the river's centre point at arc s, pushed `off` metres to the right of the flow
function riverPt(s: number,off=0): {x: number; z: number}{
  const r=riverAt(s);
  return{x:r.x-r.dz*off,z:r.z+r.dx*off};
}

// start (the first one right by the boat moored north of the centre, see player.ts)
const start={x:0,z:0};
const gate=makeBoatRaceGate({color:ORANGE}); // make* NÃO adiciona à cena
scene.add(gate);

// marcador da largada: anel pulsante na superfície da água + facho (igual à
// corrida de rua; a lancha estaciona dentro dele, sob o pórtico)
const startMk={ring:makeMarkerRing(ORANGE),beacon:new Beacon(ORANGE)};
startMk.ring.rotation.x=Math.PI/2;(startMk.ring.material as THREE.Material).transparent=true;
startMk.beacon.mount();
scene.add(startMk.ring);

let phase='idle';   // idle | countdown | racing
let startS=0;       // river arc of the start line (the course runs downstream from it)
let route: RoutePoint[]=[];       // [{x,z}] boias na ordem (a última é a chegada)
let cpMarkers: CpMarker[]=[];   // marcadores 3D de cada boia
let npcPath: BoatWaypoint[]=[];     // the rivals' waypoints: the river line, the buoys and the mine dodges
let mineSpecs: MineSpec[]=[];   // posições das bombas aquáticas do percurso (sorteadas por prova)
let mines: Mine[]=[];       // bombas 3D na cena durante a prova {g,x,z,bobT}
const blasts: Blast[]=[];    // explosões ativas das minas detonadas {g,t}
let playerCp=0;     // próxima boia do jogador
let raceT=0;        // cronômetro
let cdT=0;          // contagem regressiva
let lastCdShown=-1; // último número da contagem exibido/apitado
let freezePos: THREE.Vector3|null=null; // posição travada da lancha durante a contagem
let freezeHeading=0;// direção travada durante a contagem
const racers: Racer[]=[];    // adversários {g,cp,wpi,speed,finished,bobT}
let finishedNpcs=0; // quantos rivais já cruzaram a chegada
const prizeState: PrizeStreak={streak:0,last:-Infinity}; // anti-farm: prêmio decresce em vitórias seguidas
let paceRef=0;      // ritmo de referência suavizado do jogador (rubber banding sutil; ver smoothPace)

// alvos da corrida pro radar: largada quando ocioso, boia atual em prova
refs.boatRaceBlips=(): Blip[]=>{
  if(phase==='idle')return[{x:start.x,z:start.z,current:true}];
  const out: Blip[]=[];
  for(let i=playerCp;i<Math.min(route.length,playerCp+1+CP_AHEAD);i++)
    out.push({x:route[i].x,z:route[i].z,current:i===playerCp});
  return out;
};
refs.getBoatRaceState=()=>({
  phase,
  cp:playerCp,
  total:route.length,
  time:phase==='racing'?raceT:0,
  pos:phase==='racing'?playerPlace():0,
  racers:racers.length+1,
});
// Largada SÓ por interação (tecla E / botão): de lancha, parada embaixo do pórtico
refs.boatRaceNear=()=>{
  if(phase!=='idle'||state.mode!=='car'||!cur||!cur.boat)return false;
  const p=playerPos();
  return Math.hypot(p.x-start.x,p.z-start.z)<7&&Math.abs(cur.speed)<4;
};
refs.startBoatRaceInteract=()=>{
  if(!refs.boatRaceNear())return false;
  startRace();return true;
};

// Builds start/route/npcPath for a stretch of river starting at arc s0, downstream.
// The buoys slalom across the channel (the first and the finish sit mid-river); the
// rivals follow the river line every ~12 m (so they take its bends instead of cutting
// over the banks), the buoys in order (cp:true) and a sidestep before each mine.
function buildRoute(s0: number){
  startS=s0;
  const p0=riverPt(startS);start.x=p0.x;start.z=p0.z;
  const flip=Math.random()<.5?1:-1;
  const arcs: number[]=[];
  route=[];
  for(let k=0;k<CP_COUNT;k++){
    const s=startS+LEAD+k*CP_SPACING;arcs.push(s);
    const off=k>0&&k<CP_COUNT-1?flip*((k%2)?1:-1)*LAT_AMP*(.6+Math.random()*.4):0;
    route.push(riverPt(s,off));
  }
  buildMineSpecs(arcs);
  npcPath=[];
  let k=0;
  for(let s=startS+12;s<=arcs[arcs.length-1]+1e-6&&k<route.length;s+=12){
    while(k<route.length&&arcs[k]<=s){
      const m=mineSpecs.find(ms=>ms.leg===k);
      if(m)npcPath.push({x:m.dx,z:m.dz,cp:false});
      npcPath.push({x:route[k].x,z:route[k].z,cp:true});k++;
    }
    if(k<route.length){const p=riverPt(s);npcPath.push({x:p.x,z:p.z,cp:false});}
  }
  while(k<route.length){npcPath.push({x:route[k].x,z:route[k].z,cp:true});k++;}
}

// Water mines: a few, in the middle of interior legs, across the line the boats take;
// everyone has to dodge. Also keeps the sidestep point the rivals use (the other half
// of the channel).
function buildMineSpecs(arcs: number[]){
  mineSpecs=[];
  const legs: number[]=[];
  for(let k=2;k<CP_COUNT-1;k++)legs.push(k); // interior legs (route[k-1]→route[k])
  for(let i=legs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[legs[i],legs[j]]=[legs[j],legs[i]];}
  for(const k of legs.slice(0,Math.min(MINE_MAX,legs.length))){
    const s=arcs[k-1]+(arcs[k]-arcs[k-1])*(.42+Math.random()*.16);
    const side=Math.random()<.5?1:-1;
    const m=riverPt(s,side*1.8),d=riverPt(s,-side*3.6);
    mineSpecs.push({leg:k,x:m.x,z:m.z,dx:d.x,dz:d.z});
  }
}

// keep the whole course on the river (the start no closer than LEAD to either end)
const fitS=(s0: number)=>clamp(s0,40,RIVER_LEN-SPAN-40);

// FIRST race: the start right by the moored boat, running downstream
function prepareInitial(){buildRoute(fitS(BOAT_MOOR_S));}

// Picks a new stretch of river away from the player and lays out its buoys.
function pickCourse(){
  const pp=playerPos();
  let s0=0,tries=0;
  do{
    s0=fitS(Math.random()*RIVER_LEN);
    tries++;
    const p0=riverPt(s0);
    if(Math.hypot(p0.x-pp.x,p0.z-pp.z)>=150)break;
  }while(tries<50);
  buildRoute(s0);
}

// Prepares the current race and TURNS the gate toward the first buoy (the boat is born
// inside it already aimed). `initial`: the start by the moored boat.
function prepareRace(initial?: boolean){
  if(initial)prepareInitial();else pickCourse();
  const h=route.length?Math.atan2(route[0].x-start.x,route[0].z-start.z):0;
  const y=surf(start.x,start.z);
  gate.position.set(start.x,y,start.z);gate.rotation.y=h;
  startMk.ring.position.set(start.x,y+.05,start.z);
  startMk.beacon.at(start.x,start.z);
}

function buildCpMarkers(){
  for(let i=0;i<route.length;i++){
    const p=route[i];
    if(i===route.length-1){
      // última boia: pórtico de chegada flutuante, virado pra quem chega
      const finish=makeBoatRaceGate({color:ORANGE,finish:true});
      const prev=route[i-1]||start;
      finish.position.set(p.x,surf(p.x,p.z),p.z);
      finish.rotation.y=Math.atan2(p.x-prev.x,p.z-prev.z);
      scene.add(finish);
      const beacon=new Beacon(ORANGE).at(p.x,p.z).mount(); // só o facho de luz da chegada
      cpMarkers.push({beacon,finish});
    }else{
      const buoy=makeBuoy(ORANGE);
      buoy.position.set(p.x,surf(p.x,p.z),p.z);
      const beacon=new Beacon(ORANGE).at(p.x,p.z).mount();
      scene.add(buoy);
      cpMarkers.push({buoy,beacon});
    }
  }
}

function clearCpMarkers(){
  for(const m of cpMarkers){
    if(m.buoy)scene.remove(m.buoy);
    if(m.beacon)m.beacon.dispose();
    if(m.finish)scene.remove(m.finish);
  }
  cpMarkers=[];
}

// instancia as bombas aquáticas do percurso atual (só existem durante a prova)
function buildMines(){
  for(const s of mineSpecs){
    const g=(makeSeaMine as ()=>THREE.Group)();
    g.position.set(s.x,surf(s.x,s.z),s.z);
    g.rotation.y=Math.random()*Math.PI*2;
    scene.add(g);
    mines.push({g,x:s.x,z:s.z,bobT:Math.random()*6});
  }
}
function clearMines(){
  for(const m of mines){scene.remove(m.g);disposeGeometries(m.g);}
  mines.length=0;
}

// "pulo" ao bater numa mina: integra um salto vertical com gravidade. Devolve o
// deslocamento atual em y (0 quando a lancha já voltou à água). Compartilhado
// pelo jogador e pelos rivais (cada um carrega seu próprio mineHopV/mineHopY).
function hopOffset(o: HopHolder,dt: number){
  if(!o.mineHopV&&!o.mineHopY)return 0;
  o.mineHopY=(o.mineHopY||0)+o.mineHopV!*dt;
  o.mineHopV!-=HOP_G*dt;
  if(o.mineHopY<=0){o.mineHopY=0;o.mineHopV=0;}
  return o.mineHopY;
}

// detona a mina: explode (modelo de explosão reaproveitado), SOME da cena e do
// percurso e levanta uma coluna de água. Quem bateu já recebeu o pulo/freada em
// updateMines/updateRacers. Uma mina só explode uma vez (é removida na hora).
function detonateMine(m: Mine){
  spawnMineBlast(m.x,m.z);
  scene.remove(m.g);disposeGeometries(m.g);
  const i=mines.indexOf(m);if(i>=0)mines.splice(i,1);
}
function spawnMineBlast(x: number,z: number){
  const g=makeExplosionModel();
  g.position.set(x,surf(x,z)+1,z);
  scene.add(g);
  blasts.push({g,t:0});
  for(let i=0;i<8;i++) // borrifo/espuma do estouro
    spawnRivalPuff(x+(Math.random()-.5)*2.5,z+(Math.random()-.5)*2.5,1.4,4,.9);
  blip([150,90,55],.2,'sawtooth',.3); // estouro grave
}
function updateBlasts(dt: number){
  for(let i=blasts.length-1;i>=0;i--){
    const b=blasts[i];b.t+=dt;const s=1+b.t*4;
    b.g.scale.set(s,s,s);
    b.g.traverse((o: any)=>{if(o.material)o.material.opacity=Math.max(0,o.material.opacity-dt*1.6);});
    if(b.t>.75){scene.remove(b.g);disposeGeometries(b.g);blasts.splice(i,1);}
  }
}

// senta um "capitão" no banco do console da lancha rival (offset/pose casados com
// completeEnter/boat.js pra não ficar com a lancha vazia)
function seatCaptain(boatG: THREE.Object3D,shirt: number){
  const d=makePed(shirt);
  d.traverse((o: any)=>{if(o.isMesh)o.castShadow=false;});
  const l=d.userData.limbs;
  if(l){
    l.leftLeg.rotation.set(-1.3,0,.12);l.rightLeg.rotation.set(-1.3,0,-.12);
    l.leftCalf?.rotation.set(1.4,0,0);l.rightCalf?.rotation.set(1.4,0,0);
    l.leftArm.rotation.set(-1.15,0,.30);l.rightArm.rotation.set(-1.15,0,-.30);
    l.leftForearm?.rotation.set(-.55,0,0);l.rightForearm?.rotation.set(-.55,0,0);
  }
  d.position.set(0,-.05,-.15);
  boatG.add(d);
  vehicleOccupants.push(d); // tagged as a named NPC by the runtime reconcile pass
  return d;
}

function spawnRacers(h0: number){
  const rx=Math.cos(h0),rz=-Math.sin(h0);   // vetor "direita" da linha
  const bx=-Math.sin(h0),bz=-Math.cos(h0);  // vetor "atrás" da linha
  for(let i=0;i<NPC_COUNT;i++){
    const g=(makeBoat as (color: number)=>THREE.Group)(boatColors[i%boatColors.length]); // makeBoat já adiciona à cena
    seatCaptain(g,pick(shirtColors));
    const lane=(i-1)*3;  // three abreast across the 12 m channel
    const gx=start.x+rx*lane+bx*(6+i*3),gz=start.z+rz*lane+bz*(6+i*3);
    g.position.set(gx,surf(gx,gz)+BOAT_FLOAT,gz);
    g.rotation.y=h0;
    // mais lentos pra dar chance ao jogador; largam escalonados
    racers.push({g,cp:0,wpi:0,speed:16+i*1.8,pace:RIVAL_PACES[i%RIVAL_PACES.length],finished:false,bobT:Math.random()*6});
  }
}

function clearRacers(){
  for(const r of racers)scene.remove(r.g);
  racers.length=0;
  finishedNpcs=0;
}

function playerPlace(){
  // métrica de progresso: boias passadas menos distância à próxima
  const pp=playerPos();
  const next=route[playerCp];
  const pd=next?Math.hypot(pp.x-next.x,pp.z-next.z):0;
  const pscore=playerCp*1e4-pd;
  let place=1;
  for(const r of racers){
    const rn=route[r.cp];
    const rd=rn?Math.hypot(r.g.position.x-rn.x,r.g.position.z-rn.z):0;
    const rscore=(r.finished?route.length:r.cp)*1e4-rd;
    if(rscore>pscore)place++;
  }
  return place;
}

function startRace(){
  if(!game.begin())return; // outra sessão de mini game rolando: não larga
  if(!route.length)prepareRace();
  buildCpMarkers();
  buildMines(); // bombas aquáticas no meio do percurso
  cur!.mineHopV=cur!.mineHopY=0; // zera estado de "pulo" de mina
  playerCp=0;raceT=0;cdT=REWARDS.boatRace.countdownSec;lastCdShown=-1;paceRef=0;
  startMk.ring.visible=startMk.beacon.visible=false; // some a largada durante a prova
  gate.visible=false;                                // tira o pórtico depois de largar
  // teleporta a lancha do jogador pra linha, virada pra 1ª boia
  const h0=Math.atan2(route[0].x-start.x,route[0].z-start.z);
  cur!.g.position.set(start.x,surf(start.x,start.z)+BOAT_FLOAT,start.z);
  cur!.heading=h0;cur!.g.rotation.set(0,h0,0);cur!.speed=0;cur!.bobT=cur!.bobT||0;
  cameraRig.yaw=h0;
  freezePos=cur!.g.position.clone();freezeHeading=h0;
  spawnRacers(h0);
  phase='countdown';
  state.controlsLocked=true; // sem pilotar/sair/atirar durante a contagem
  refs.setGangsHidden?.(true);
  radioOff();
  raceSiren();
  updateRaceHud();
}

function finishRace(){
  clearRacers();clearCpMarkers();clearMines();
  prepareRace(); // próxima corrida nasce noutro trecho do litoral (ciclo infinito)
  startMk.ring.visible=startMk.beacon.visible=true;
  gate.visible=true;
  phase='idle';freezePos=null;
  state.controlsLocked=false;
  game.end(); // libera a trava do mundo
  refs.setGangsHidden?.(false);
  raceMusicOff();
  hideRaceHud();
}

function abortRace(text='CORRIDA ABANDONADA',col='var(--pink)'){
  finishRace();
  // morte/prisão no meio da prova: o cut de WASTED/BUSTED já assumiu o banner;
  // não apaga nem sobrescreve com "RACE ABANDONED".
  if(state.mode==='cut')return;
  hideBig();
  message(text,col);
}

function loseRace(){
  markMiniGamePlayed(game.id);
  finishRace();
  bigText('VOCÊ PERDEU','var(--pink)');
  setTimeout(hideBig,2200);
  message('OS RIVAIS CHEGARAM PRIMEIRO - SEM PRÊMIO','var(--pink)');
  blip([330,247,196],.12,'sawtooth',.18);
}

function completeRace(){
  const place=1+finishedNpcs;
  const total=racers.length+1;
  const prize=REWARDS.boatRace.placePrizes[place-1]??0;
  // bônus de tempo: corrida rápida paga mais
  const bonus=place===1?Math.max(0,Math.round(REWARDS.boatRace.fastWinBonusMax-raceT*REWARDS.boatRace.fastWinBonusDecayPerSec)):0;
  // anti-farm: refazer a prova em loop paga cada vez menos (recupera com o tempo)
  const paid=diminishPrize(prizeState,prize+bonus,state.time,REWARDS.boatRace.repeatWinDecay,REWARDS.boatRace.repeatWinRecoverSec);
  economy.earn(paid,'boat-race');
  // session over: counts toward the once-per-day lock
  markMiniGamePlayed(game.id);
  const ord=place+'º';
  finishRace();
  bigText(place===1?'VOCÊ VENCEU!':`${ord} LUGAR`,place===1?'var(--gold)':'var(--cyan)');
  setTimeout(hideBig,2200);
  message(paid>0?`${ord} DE ${total} - +R$${paid}${bonus>0?' BÔNUS DE VELOCIDADE!':''}`
    :`${ord} DE ${total} - SEM PRÊMIO`,paid>0?'var(--gold)':'var(--pink)');
  blip(place===1?[523,659,784,1047]:[440,330],.09,'sine',.18);
}

const raceHud=document.getElementById('racehud');
function hideRaceHud(){raceHud?.classList.remove('show');}

function updateRaceHud(){
  if(!raceHud)return;
  if(phase==='idle'){hideRaceHud();return;}
  raceHud.classList.add('show');
  if(phase==='countdown'){
    raceHud.innerHTML=`
      <div class="race-label">CORRIDA DE LANCHAS</div>
      <div class="race-main"><span>PREPARE-SE</span><b>${Math.max(1,Math.ceil(cdT))}</b></div>`;
    return;
  }
  const t=raceT,mm=Math.floor(t/60),ss=Math.floor(t%60);
  const clock=`${mm}:${String(ss).padStart(2,'0')}`;
  raceHud.innerHTML=`
    <div class="race-label">CORRIDA DE LANCHAS</div>
    <div class="race-main"><span>POSIÇÃO</span><b>${playerPlace()}/${racers.length+1}</b></div>
    <div class="race-row"><span>BOIA</span><b>${Math.min(playerCp+1,route.length)}/${route.length}</b></div>
    <div class="race-row"><span>TEMPO</span><b>${clock}</b></div>`;
}

// marcadores: mostra SÓ a boia atual (a próxima que o jogador tem que pegar);
// ela balança na água. A chegada tem bandeira tremulando.
function updateCpMarkers(dt: number){
  for(let i=0;i<cpMarkers.length;i++){
    const m=cpMarkers[i];
    const show=i>=playerCp&&i<=playerCp+CP_AHEAD;
    const current=i===playerCp;
    if(m.beacon){m.beacon.visible=show;if(show)m.beacon.opacity=current?.18:.08;}
    if(m.finish){
      m.finish.visible=show;
      if(show){
        m.finish.position.y=surf(m.finish.position.x,m.finish.position.z)+Math.sin(state.time*1.6+i)*.08; // bobs on the water
        if(m.finish.userData.flag)m.finish.userData.flag.rotation.y=Math.sin(state.time*6)*.5;
      }
      continue;
    }
    if(m.buoy){
      m.buoy.visible=show;
      if(show){
        m.buoy.position.y=surf(m.buoy.position.x,m.buoy.position.z)+Math.sin(state.time*1.8+i*1.3)*.12;
        m.buoy.rotation.y+=.6*dt;
      }
    }
  }
}

// esteira das rivais: rastro de espuma na popa (pool reciclado compartilhado pelas
// 3 lanchas, igual ao do jogador mas só o rastro traseiro pra não pesar).
const rwake: RivalWake[]=[],rwakePool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]=[];
function spawnRivalPuff(x: number,z: number,s0: number,s1: number,life: number){
  const g=rwakePool.pop()||makeWakePuff();
  if(!g.parent)scene.add(g);
  g.position.set(x,surf(x,z)+.02,z);
  g.rotation.y=Math.random()*Math.PI;
  g.scale.setScalar(s0);
  g.material.opacity=0;g.visible=true;
  rwake.push({g,t:0,life,s0,s1});
}
function updateRivalWake(dt: number){
  for(let i=rwake.length-1;i>=0;i--){
    const w=rwake[i];w.t+=dt;const k=w.t/w.life;
    w.g.scale.setScalar(w.s0+(w.s1-w.s0)*k);
    w.g.material.opacity=Math.min(1,k*7)*(1-k)*.7;
    if(k>=1){w.g.visible=false;rwakePool.push(w.g);rwake.splice(i,1);}
  }
}

// progresso ao longo do percurso em "unidades de boia": boias já passadas +
// fração da perna atual (0..1). Compara jogador e rival de forma contínua pra
// alimentar o rubber banding.
function legProgress(cp: number,x: number,z: number){
  const to=route[cp];
  if(!to)return route.length;            // já cruzou a chegada
  const from=cp>0?route[cp-1]:start;
  const legLen=Math.hypot(to.x-from.x,to.z-from.z)||1;
  const distToNext=Math.hypot(to.x-x,to.z-z);
  return cp+THREE.MathUtils.clamp(1-distToNext/legLen,0,1);
}

function updateRacers(dt: number){
  const pp=playerPos();
  const playerProg=legProgress(playerCp,pp.x,pp.z);
  paceRef=smoothPace(paceRef,Math.abs(cur?.speed||0),dt); // sobe rápido, cai devagar
  for(const r of racers){
    if(r.finished)continue;
    const wp=npcPath[r.wpi];
    if(!wp){r.finished=true;finishedNpcs++;continue;}
    // mira na boia (mar aberto: vai direto). A direção visual gira mais devagar.
    const dx=wp.x-r.g.position.x,dz=wp.z-r.g.position.z;
    const d=Math.hypot(dx,dz);
    const h=Math.atan2(dx,dz);
    const c0=r.g.rotation.y;
    let diff=THREE.MathUtils.euclideanModulo(h-c0+Math.PI,Math.PI*2)-Math.PI;
    r.g.rotation.y=c0+diff*Math.min(1,4*dt);
    // rubber banding (helper): velocidade ancorada no ritmo de REFERÊNCIA suavizado
    // do jogador (paceRef) — rival ATRÁS surta pra colar, rival à frente alivia pra
    // ser pego. Frear NÃO faz o rival frear junto (paceRef cai devagar): quem para
    // de verdade é ultrapassado depois de ~1-2s, não no mesmo frame.
    const gap=playerProg-legProgress(r.cp,r.g.position.x,r.g.position.z);
    const spd=rubberSpeed(r.speed,gap,paceRef,r.pace);
    let step=Math.min(d,spd*dt);
    if(r.mineStun>0){step*=.2;r.mineStun-=dt;} // batido numa mina: quase parado
    r.g.position.x+=Math.sin(h)*step;
    r.g.position.z+=Math.cos(h)*step;
    // bateu numa mina (raro: eles desviam pelos waypoints) → pulo + perda de ritmo;
    // a mina explode e some na hora
    for(const m of mines){
      if(Math.hypot(r.g.position.x-m.x,r.g.position.z-m.z)<MINE_HIT){
        r.mineHopV=HOP_V;r.mineStun=.9;detonateMine(m);break;
      }
    }
    // flutuação + proa levantada planando + inclinação pra dentro da curva + pulo de mina
    r.bobT=(r.bobT||0)+dt;
    r.g.position.y=surf(r.g.position.x,r.g.position.z)+BOAT_FLOAT+Math.sin(r.bobT*2.2)*.05+hopOffset(r,dt);
    r.g.rotation.x=THREE.MathUtils.lerp(r.g.rotation.x,-.1,Math.min(1,3*dt));
    r.g.rotation.z=THREE.MathUtils.lerp(r.g.rotation.z,-diff*.4,Math.min(1,4*dt));
    // rastro de espuma jogado atrás da popa
    r.wakeT=(r.wakeT||0)+dt;
    const interval=Math.max(.05,.16-spd*.003);
    const fx=Math.sin(r.g.rotation.y),fz=Math.cos(r.g.rotation.y);
    while(r.wakeT>=interval){
      r.wakeT-=interval;
      spawnRivalPuff(r.g.position.x-fx*2+(Math.random()-.5)*.6,
        r.g.position.z-fz*2+(Math.random()-.5)*.6,.7,2.6,.85);
    }
    // só avança quando REALMENTE chegou na boia (sem cortar caminho)
    if(d<NPC_REACH){
      if(wp.cp){
        r.cp++;
        if(r.cp>=route.length){r.finished=true;finishedNpcs++;continue;}
      }
      r.wpi++;
    }
  }
  separateRacers(racers,SEP,cur); // ninguém anda por dentro de ninguém (inclui a lancha do jogador)
}

// bombas aquáticas: balançam/giram na água e colidem com a lancha do JOGADOR —
// encostou, ela pula pra cima e perde quase toda a velocidade (os rivais levam o
// mesmo tranco em updateRacers). Cooldown por lancha evita retrigger ao sobrepor.
function updateMines(dt: number){
  for(const m of mines){
    m.bobT+=dt;
    m.g.position.y=surf(m.x,m.z)+Math.sin(m.bobT*1.6)*.1; // bobbing
    m.g.rotation.y+=.4*dt;
  }
  if(!cur)return;
  const p=cur.g.position;
  for(const m of mines){
    if(Math.hypot(p.x-m.x,p.z-m.z)<MINE_HIT){
      cur.mineHopV=HOP_V;   // a lancha pula pra cima
      cur.speed*=.22;       // e perde quase toda a velocidade
      detonateMine(m);      // a mina explode e some
      break;
    }
  }
  const off=hopOffset(cur,dt);
  if(off){p.y+=off;cur.g.rotation.x-=off*.12;} // sobe e empina a proa enquanto no ar
}

export function updateBoatRace(dt: number){
  if(rwake.length)updateRivalWake(dt); // espuma das rivais some mesmo após a prova
  if(blasts.length)updateBlasts(dt);   // explosões das minas terminam mesmo após a prova
  // anel da largada pulsando quando ocioso
  if(phase==='idle'){
    if(startMk.ring.visible){
      startMk.ring.rotation.z+=2*dt;
      const sc=1+Math.sin(state.time*4)*.12;startMk.ring.scale.set(sc,sc,1);
    }
    return; // largada é por interação (ver refs.startBoatRaceInteract)
  }

  // saiu da lancha / WASTED / BUSTED no meio da prova: abandona
  if(state.mode!=='car'||!cur||!cur.boat){abortRace();return;}

  if(phase==='countdown'){
    if(freezePos){cur.g.position.copy(freezePos);cur.speed=0;} // congela na linha
    cur.heading=freezeHeading;cur.g.rotation.set(0,freezeHeading,0);
    cameraRig.yaw=freezeHeading;
    cdT-=dt;
    const n=Math.ceil(cdT);
    if(n>0){
      bigText(String(n),'#ff8a1e');
      if(n!==lastCdShown){lastCdShown=n;blip([523],.12,'square',.18);}
    }else{
      phase='racing';freezePos=null;state.controlsLocked=false;
      bigText('VAI!','var(--gold)');setTimeout(hideBig,700);
      blip([784,1047],.14,'square',.22);
      raceMusicOn();
    }
    updateCpMarkers(dt);
    updateRaceHud();
    return;
  }

  // racing
  raceT+=dt;
  updateRacers(dt);
  updateCpMarkers(dt);
  updateMines(dt); // bombas aquáticas balançam + colisão da lancha do jogador
  // todos os rivais cruzaram a chegada antes de você: derrota
  if(finishedNpcs>=NPC_COUNT){loseRace();return;}
  const pp=cur.g.position;
  const tgt=route[playerCp];
  if(tgt&&Math.hypot(pp.x-tgt.x,pp.z-tgt.z)<CP_RADIUS){
    playerCp++;
    if(playerCp>=route.length){completeRace();return;}
    blip([660,880],.07,'sine',.15);
  }
  updateRaceHud();
}

prepareRace(true); // 1º percurso com a largada colada na lancha ancorada
