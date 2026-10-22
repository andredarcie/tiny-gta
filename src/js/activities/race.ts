import * as THREE from 'three';
import {pick,groundHeight,rubberSpeed,separateRacers,diminishPrize,smoothPace} from '@/core/constants.ts';
import {routeWalk,randomRoadPoint,nearestNode,nodes,pavedRoad} from '@/world/divinolandia/nav.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {state,refs,carColors} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {makeCar,spinWheels,seatDriver,shirtColors} from '@/core/entities.ts';
import {cur,playerPos,cameraRig} from '@/actors/player.ts';
import {gangs} from '@/actors/gangs.ts';
import {makeMarkerRing} from '../../assets/models/missions/marker-ring.ts';
import {Beacon} from '@/core/beacon.ts';
import {makeRaceGate} from '../../assets/models/missions/race-gate.ts';
import {makeRaceFinish} from '../../assets/models/missions/race-finish.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip,raceSiren} from '@/audio/audio.ts';
import {radioOff} from '@/ui/radio.ts';
import {raceMusicOn,raceMusicOff} from '@/audio/race-music.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {markMiniGamePlayed} from '@/activities/minigame-intro.ts';
import type {Racer,PrizeStreak,Blip} from '@/core/types.ts';

// percurso/waypoint: ponto (x,z) na ordem; o waypoint de rua marca se é checkpoint
interface RoutePoint{x: number; z: number;}
interface RoadWaypoint{x: number; z: number; cp?: boolean;}
// marcador 3D de um checkpoint (anel/facho) ou da chegada (público + bandeira)
interface CpMarker{ring?: THREE.Mesh; beacon?: Beacon; finish?: THREE.Object3D;}

// mini game (sessão): trava o mundo durante a prova. A corrida desenha seus
// próprios checkpoints no radar (ver raceOn no hud.js), então não expõe blips de
// alvo aqui — a trava só garante o "um por vez" e o mapa sem outras atividades.
const game=new MiniGame({id:MiniGameId.RACE,name:'Racha de Rua'});

// Open-world street race: a chequered start gate stands at a junction of
// Divinolândia. Drive under it, stop, and the race starts: the car snaps to the line,
// siren + 3-2-1, then a course of checkpoints (one at a time) to cross IN ORDER to
// the finish. The course is a real route through the town's streets (nav.routeWalk),
// so the three rivals drive the same streets — they follow its polyline turn by turn,
// passing every point, never cutting through the houses. Gangs vanish during the race
// and come back after. Music/radio belong to the race; if every rival finishes first
// you lose. Each finished race makes the next one start somewhere else.

const RACE_BUILD=' ◆ RACHA';
document.getElementById('buildver')?.insertAdjacentText('beforeend',RACE_BUILD);

const CP_COUNT=6;      // checkpoints do percurso (corrida curta; o último é a chegada)
const ROUTE_LEN=1300;  // course length along the streets (m)
const CP_RADIUS=9;     // raio pra contar a passagem no checkpoint
const CP_AHEAD=0;      // checkpoints à frente visíveis além do atual (0 = só o atual)
const NPC_COUNT=3;     // adversários
const NPC_REACH=3.5;   // rivais precisam passar PERTO do ponto pra avançar (nada de burlar)
const RIVAL_PACES=[0.82,0.90,0.96]; // per-rival pace, all <1 so a CLEAN run wins; the catch-up surge keeps trailing rivals dangerous if you slack (a sloppy run can still drop to 2nd/3rd).
const SEP=3.8;         // distância mínima entre dois rivais (carro ~1.7 largo): separa quem encosta
const GANG_MARGIN=8;   // folga extra além do raio do território
const ORANGE=0xff8a1e;

// largada e chegada NUNCA podem cair em território de gangue (centro fixo, raio
// só encolhe — checar o raio atual já garante que continua fora)
function inGangTerritory(x: number,z: number){
  for(const g of gangs)if(Math.hypot(x-g.x,z-g.z)<g.r+GANG_MARGIN)return true;
  return false;
}

// The start is a junction of the town (always on the street). It moves after every
// finished race, so a new one always appears somewhere else. The first one is on the
// streets east of the Matriz.
const start={x:0,z:0};
{const sp=randomRoadPoint({f:pavedRoad,near:{x:5300,z:5000},min:0,max:220});const n=nodes[nearestNode(sp.x,sp.z,pavedRoad)];start.x=n.x;start.z=n.z;}
const gate=makeRaceGate(ORANGE); // makeCar/makeRaceGate NÃO adicionam à cena
gate.position.set(start.x,groundHeight(start.x,start.z),start.z);
scene.add(gate);

// Pré-monta a corrida da largada atual: sorteia o percurso, o caminho de rua dos
// rivais e VIRA o pórtico de frente pro primeiro checkpoint (o jogador nasce
// dentro do arco já apontado pra ele).
function prepareRace(){
  route=genRoute();
  npcPath=buildRoadPath();
  gate.rotation.y=courseHeading();
}

// heading of the first stretch of the course (the gate and the grid face it)
function courseHeading(){
  for(const p of coursePts){const dx=p[0]-start.x,dz=p[1]-start.z;if(dx*dx+dz*dz>16)return Math.atan2(dx,dz);}
  return route.length?Math.atan2(route[0].x-start.x,route[0].z-start.z):0;
}

function relocateStart(){
  const pp=playerPos();
  let x=start.x,z=start.z,tries=0;
  do{
    const sp=randomRoadPoint({f:pavedRoad,near:{x:pp.x,z:pp.z},min:120,max:700});
    const n=nodes[nearestNode(sp.x,sp.z,pavedRoad)];x=n.x;z=n.z;tries++;
  }while(tries<60&&((x===start.x&&z===start.z)||inGangTerritory(x,z))); // start outside gang turf
  start.x=x;start.z=z;
  const y=groundHeight(x,z);
  gate.position.set(x,y,z);
  startMk.ring.position.set(x,y+.4,z);
  startMk.beacon.at(x,z);
  prepareRace(); // novo percurso e nova orientação do pórtico
}

// marcador fixo da largada (anel + facho)
const startMk={ring:makeMarkerRing(ORANGE),beacon:new Beacon(ORANGE)};
startMk.ring.rotation.x=Math.PI/2;startMk.ring.position.set(start.x,groundHeight(start.x,start.z)+.4,start.z);
startMk.beacon.at(start.x,start.z).mount();
scene.add(startMk.ring);

let phase='idle';   // idle | countdown | racing
let route: RoutePoint[]=[];       // [{x,z}] pontos do percurso na ordem
let cpMarkers: CpMarker[]=[];   // marcadores 3D de cada checkpoint
let npcPath: RoadWaypoint[]=[];     // the course polyline the rivals follow (cp = a checkpoint)
let playerCp=0;     // próximo checkpoint do jogador
let raceT=0;        // cronômetro da corrida
let cdT=0;          // contagem regressiva
let lastCdShown=-1; // último número da contagem já exibido/apitado
let freezePos: THREE.Vector3|null=null; // posição travada do carro durante a contagem
let freezeHeading=0; // direção travada do carro/câmera durante a contagem
const racers: Racer[]=[];    // adversários {g,cp,speed,finished}
let finishedNpcs=0; // quantos adversários já cruzaram a chegada
const prizeState: PrizeStreak={streak:0,last:-Infinity}; // anti-farm: prêmio decresce em vitórias seguidas
let paceRef=0;      // ritmo de referência suavizado do jogador (rubber banding sutil; ver smoothPace)
const raceHud=document.getElementById('racehud');

// Cancellable banner-hide timer: a stale hideBig from a previous session must not
// fire and wipe a banner shown by a new one. scheduleHide always replaces the pending timer.
let hideTimer: ReturnType<typeof setTimeout>|null=null;
function scheduleHide(ms: number){clearTimeout(hideTimer!);hideTimer=setTimeout(()=>{hideTimer=null;hideBig();},ms);}

// alvos da corrida pro radar: largada quando ocioso, checkpoints à frente em prova
refs.raceBlips=(): Blip[]=>{
  if(phase==='idle')return[{x:start.x,z:start.z,current:true}];
  const out: Blip[]=[];
  for(let i=playerCp;i<Math.min(route.length,playerCp+1+CP_AHEAD);i++)
    out.push({x:route[i].x,z:route[i].z,current:i===playerCp});
  return out;
};
refs.getRaceState=()=>({
  phase,
  cp:playerCp,
  total:route.length,
  time:phase==='racing'?raceT:0,
  pos:phase==='racing'?playerPlace():0,
  racers:racers.length+1,
});
// Largada SÓ por interação (tecla E / botão): de carro, parado embaixo do pórtico
refs.raceNear=()=>{
  // Only a road vehicle (car/motorcycle) can start this race — reject plane/boat/RC toy.
  if(phase!=='idle'||state.mode!=='car'||!cur||cur.plane||cur.boat||cur.remote)return false;
  const p=playerPos();
  return Math.hypot(p.x-start.x,p.z-start.z)<5&&Math.abs(cur.speed)<3;
};
refs.startRaceInteract=()=>{
  if(!refs.raceNear())return false;
  startRace();return true;
};

// The course: a walk through the paved streets from the start junction (never doubling
// back, nav.routeWalk), cut into CP_COUNT legs of equal length; the checkpoints sit at
// the cuts and the last one is the finish (never inside a gang's turf). The rivals
// follow the same polyline, with the checkpoints inserted as flagged waypoints.
let coursePts: [number,number][]=[];
function genRoute(){
  let best: [number,number][]=[];
  for(let attempt=0;attempt<12;attempt++){
    const pts=routeWalk(start.x,start.z,ROUTE_LEN,pavedRoad);
    const end=pts[pts.length-1];
    if(polyLen(pts)>polyLen(best)&&!(end&&inGangTerritory(end[0],end[1])))best=pts;
    if(polyLen(best)>=ROUTE_LEN*.9)break;
  }
  coursePts=best;
  const total=polyLen(best),out: RoutePoint[]=[];
  for(let i=1;i<=CP_COUNT;i++){const p=alongPoly(best,total*i/CP_COUNT);out.push({x:p[0],z:p[1]});}
  return out;
}
function polyLen(p: [number,number][]){let l=0;for(let i=1;i<p.length;i++)l+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);return l;}
function alongPoly(p: [number,number][],s: number): [number,number]{
  for(let i=1;i<p.length;i++){
    const l=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);
    if(s<=l){const t=l?s/l:0;return[p[i-1][0]+(p[i][0]-p[i-1][0])*t,p[i-1][1]+(p[i][1]-p[i-1][1])*t];}
    s-=l;
  }
  return p[p.length-1]||[start.x,start.z];
}

// the rivals' path: every vertex of the course, with the checkpoints inserted in order
function buildRoadPath(){
  const wps: RoadWaypoint[]=[];
  const total=polyLen(coursePts),cpAt=route.map((_,i)=>total*(i+1)/CP_COUNT);
  let acc=0,k=0;
  for(let i=1;i<coursePts.length;i++){
    const a=coursePts[i-1],b=coursePts[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);
    while(k<cpAt.length&&cpAt[k]<=acc+l+1e-6){
      const t=l?(cpAt[k]-acc)/l:0;
      wps.push({x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t,cp:true});k++;
    }
    if(k<cpAt.length)wps.push({x:b[0],z:b[1]});
    acc+=l;
  }
  while(k<route.length){wps.push({x:route[k].x,z:route[k].z,cp:true});k++;}
  return wps;
}

function buildCpMarkers(){
  for(let i=0;i<route.length;i++){
    const p=route[i];
    if(i===route.length-1){
      // ponto final: linha de chegada com público e bandeira, virada pra quem chega
      const finish=makeRaceFinish();
      const prev=route[i-1]||start;
      finish.position.set(p.x,groundHeight(p.x,p.z),p.z);
      finish.rotation.y=Math.atan2(p.x-prev.x,p.z-prev.z);
      scene.add(finish);
      const beacon=new Beacon(ORANGE).at(p.x,p.z).mount(); // facho de luz pra achar de longe
      cpMarkers.push({beacon,finish});
    }else{
      const ring=makeMarkerRing(ORANGE);
      ring.rotation.x=Math.PI/2;ring.position.set(p.x,groundHeight(p.x,p.z)+.4,p.z);
      (ring.material as THREE.Material).transparent=true;
      const beacon=new Beacon(ORANGE).at(p.x,p.z).mount();
      scene.add(ring);
      cpMarkers.push({ring,beacon});
    }
  }
}

function clearCpMarkers(){
  for(const m of cpMarkers){
    if(m.ring)scene.remove(m.ring);
    if(m.beacon)m.beacon.dispose();
    if(m.finish)scene.remove(m.finish);
  }
  cpMarkers=[];
}

function spawnRacers(h0: number){
  const rx=Math.cos(h0),rz=-Math.sin(h0);   // vetor "direita" da linha
  const bx=-Math.sin(h0),bz=-Math.cos(h0);  // vetor "atrás" da linha
  for(let i=0;i<NPC_COUNT;i++){
    const g=makeCar(carColors[(i*3+2)%carColors.length],false);
    seatDriver(g,pick(shirtColors)); // motorista rival ao volante (carro não fica vazio)
    const lane=(i-1)*3.2;
    const gx=start.x+rx*lane+bx*(4+i*2.2),gz=start.z+rz*lane+bz*(4+i*2.2);
    g.position.set(gx,groundHeight(gx,gz),gz);
    g.rotation.y=h0;
    // mais lentos que antes pra dar chance ao jogador; largam escalonados
    racers.push({g,cp:0,wpi:0,speed:11+i*1.4,pace:RIVAL_PACES[i%RIVAL_PACES.length],finished:false});
  }
}

function clearRacers(){
  for(const r of racers)scene.remove(r.g);
  racers.length=0;
  finishedNpcs=0;
}

function playerPlace(){
  // métrica de progresso: checkpoints passados menos distância ao próximo
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
  clearTimeout(hideTimer!);hideTimer=null; // cancel any stale hide from a previous session
  if(!route.length)prepareRace(); // garante percurso (já vem pré-montado)
  buildCpMarkers();
  playerCp=0;raceT=0;cdT=REWARDS.race.countdownSec;lastCdShown=-1;paceRef=0;
  startMk.ring.visible=startMk.beacon.visible=false; // some a largada durante a prova
  gate.visible=false;                                // tira o pórtico depois de largar
  // snap the player's car to the line, facing down the course
  const h0=courseHeading();
  cur!.g.position.set(start.x,groundHeight(start.x,start.z),start.z);
  cur!.heading=h0;cur!.g.rotation.set(0,h0,0);cur!.speed=0;
  cameraRig.yaw=h0; // câmera já atrás do carro, olhando pro percurso
  freezePos=cur!.g.position.clone();freezeHeading=h0;
  spawnRacers(h0);
  phase='countdown';
  state.controlsLocked=true; // sem dirigir/sair/atirar durante a contagem
  refs.setGangsHidden?.(true); // gangues somem durante a corrida
  radioOff();                // rádio do carro cala: a corrida tem trilha própria
  raceSiren();               // sirene de largada
  updateRaceHud();
}

function finishRace(){
  clearRacers();clearCpMarkers();
  relocateStart(); // próxima corrida nasce noutro lugar (ciclo infinito)
  startMk.ring.visible=startMk.beacon.visible=true;
  gate.visible=true; // pórtico de largada reaparece no novo ponto
  phase='idle';freezePos=null;
  state.controlsLocked=false;
  game.end(); // libera a trava do mundo
  refs.setGangsHidden?.(false); // gangues voltam quando a corrida acaba
  raceMusicOff();
  hideRaceHud();
}

function abortRace(text='CORRIDA ABANDONADA',col='var(--pink)'){
  finishRace();
  // morte/prisão no meio da corrida: o cut de WASTED/BUSTED já assumiu o banner;
  // não apaga nem sobrescreve com "RACE ABANDONED".
  if(state.mode==='cut')return;
  hideBig();
  message(text,col);
}

function loseRace(){
  markMiniGamePlayed(game.id);
  finishRace();
  bigText('VOCÊ PERDEU','var(--pink)');
  scheduleHide(2200);
  message('OS RIVAIS CHEGARAM PRIMEIRO - SEM PRÊMIO','var(--pink)');
  blip([330,247,196],.12,'sawtooth',.18);
}

function completeRace(){
  const place=1+finishedNpcs;
  const total=racers.length+1;
  const prize=REWARDS.race.placePrizes[place-1]??0;
  // bônus de tempo: corrida rápida paga mais (some por volta de ~2min)
  const bonus=place===1?Math.max(0,Math.round(REWARDS.race.fastWinBonusMax-raceT*REWARDS.race.fastWinBonusDecayPerSec)):0;
  // anti-farm: refazer a corrida em loop paga cada vez menos (recupera com o tempo)
  const paid=diminishPrize(prizeState,prize+bonus,state.time,REWARDS.race.repeatWinDecay,REWARDS.race.repeatWinRecoverSec);
  economy.earn(paid,'race');
  // session over: counts toward the once-per-day lock
  markMiniGamePlayed(game.id);
  const ord=place+'º';
  finishRace();
  bigText(place===1?'VOCÊ VENCEU!':`${ord} LUGAR`,place===1?'var(--gold)':'var(--cyan)');
  scheduleHide(2200);
  message(paid>0?`${ord} DE ${total} - +R$${paid}${bonus>0?' BÔNUS DE VELOCIDADE!':''}`
    :`${ord} DE ${total} - SEM PRÊMIO`,paid>0?'var(--gold)':'var(--pink)');
  blip(place===1?[523,659,784,1047]:[440,330],.09,'sine',.18);
}

function hideRaceHud(){raceHud?.classList.remove('show');}

function updateRaceHud(){
  if(!raceHud)return;
  if(phase==='idle'){hideRaceHud();return;}
  raceHud.classList.add('show');
  if(phase==='countdown'){
    raceHud.innerHTML=`
      <div class="race-label">RACHA DE RUA</div>
      <div class="race-main"><span>PREPARE-SE</span><b>${Math.max(1,Math.ceil(cdT))}</b></div>`;
    return;
  }
  const t=raceT,mm=Math.floor(t/60),ss=Math.floor(t%60);
  const clock=`${mm}:${String(ss).padStart(2,'0')}`;
  raceHud.innerHTML=`
    <div class="race-label">RACHA DE RUA</div>
    <div class="race-main"><span>POSIÇÃO</span><b>${playerPlace()}/${racers.length+1}</b></div>
    <div class="race-row"><span>PC</span><b>${Math.min(playerCp+1,route.length)}/${route.length}</b></div>
    <div class="race-row"><span>TEMPO</span><b>${clock}</b></div>`;
}

// marcadores: mostra só o checkpoint atual (CP_AHEAD=0); a chegada tem público
function updateCpMarkers(dt: number){
  for(let i=0;i<cpMarkers.length;i++){
    const m=cpMarkers[i];
    const show=i>=playerCp&&i<=playerCp+CP_AHEAD;
    if(m.beacon)m.beacon.visible=show;
    if(m.finish){
      m.finish.visible=show;
      if(show&&m.finish.userData.flag) // bandeira tremulando
        m.finish.userData.flag.rotation.y=Math.sin(state.time*6)*.5;
      continue;
    }
    m.ring!.visible=show;
    if(!show)continue;
    (m.ring!.material as THREE.Material).opacity=1;m.beacon!.opacity=.18;
    m.ring!.rotation.z+=2*dt;
    const sc=1+Math.sin(state.time*4)*.12;m.ring!.scale.set(sc,sc,1);
  }
}

// progresso ao longo do percurso em "unidades de checkpoint": checkpoints já
// passados + fração da perna atual (0..1). Compara jogador e rival de forma
// contínua pra alimentar o rubber banding.
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
    // mira EXATAMENTE no ponto da rua (sem desvio): o rival passa de fato por ele
    const dx=wp.x-r.g.position.x,dz=wp.z-r.g.position.z;
    const d=Math.hypot(dx,dz);
    const h=Math.atan2(dx,dz);
    const c0=r.g.rotation.y;
    let diff=THREE.MathUtils.euclideanModulo(h-c0+Math.PI,Math.PI*2)-Math.PI;
    r.g.rotation.y=c0+diff*Math.min(1,6*dt);
    // rubber banding (helper): velocidade ancorada no ritmo de REFERÊNCIA suavizado
    // do jogador (paceRef) — rival ATRÁS surta pra colar, rival à frente alivia pra
    // ser pego. Frear NÃO faz o rival frear junto (paceRef cai devagar): quem para
    // de verdade é ultrapassado depois de ~1-2s, não no mesmo frame.
    const gap=playerProg-legProgress(r.cp,r.g.position.x,r.g.position.z);
    const spd=rubberSpeed(r.speed,gap,paceRef,r.pace);
    const step=Math.min(d,spd*dt);
    r.g.position.x+=Math.sin(h)*step;
    r.g.position.z+=Math.cos(h)*step;
    r.g.position.y=groundHeight(r.g.position.x,r.g.position.z);
    spinWheels(r.g,spd,dt);
    // só avança quando REALMENTE chegou no ponto (raio curto = não corta caminho)
    if(d<NPC_REACH){
      if(wp.cp){
        r.cp++;
        if(r.cp>=route.length){r.finished=true;finishedNpcs++;continue;}
      }
      r.wpi++;
    }
  }
  separateRacers(racers,SEP,cur); // ninguém anda por dentro de ninguém (inclui o carro do jogador)
}

export function updateRace(dt: number){
  // marcador da largada pulsando quando ocioso
  if(phase==='idle'&&startMk.ring.visible){
    startMk.ring.rotation.z+=2*dt;
    const sc=1+Math.sin(state.time*4)*.12;startMk.ring.scale.set(sc,sc,1);
  }

  // ociosa: largada é por interação do jogador (ver refs.startRaceInteract)
  if(phase==='idle')return;

  // saiu do carro / WASTED / BUSTED no meio da prova: abandona
  if(state.mode!=='car'||!cur){abortRace();return;}

  if(phase==='countdown'){
    if(freezePos){cur.g.position.copy(freezePos);cur.speed=0;} // congela na linha
    // trava carro e câmera olhando pra frente (pro percurso) durante a contagem
    cur.heading=freezeHeading;cur.g.rotation.set(0,freezeHeading,0);
    cameraRig.yaw=freezeHeading;
    cdT-=dt;
    const n=Math.ceil(cdT);
    if(n>0){
      bigText(String(n),'#ff8a1e');
      if(n!==lastCdShown){lastCdShown=n;blip([523],.12,'square',.18);} // bip por número
    }else{
      phase='racing';freezePos=null;state.controlsLocked=false;
      bigText('VAI!','var(--gold)');scheduleHide(700);
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
  // todos os rivais cruzaram a chegada antes de você: corrida encerrada, derrota
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

prepareRace(); // monta o primeiro percurso e orienta o pórtico já no carregamento
