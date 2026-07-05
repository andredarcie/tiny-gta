import * as THREE from 'three';
import {N,nodeX,irand,pick,groundHeight,rubberSpeed,separateRacers,diminishPrize,smoothPace} from '@/core/constants.ts';
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
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.ts';
import type {Racer,PrizeStreak,Blip} from '@/core/types.ts';

// percurso/waypoint: ponto (x,z) na ordem; o waypoint de rua marca se é checkpoint
interface RoutePoint{x: number; z: number;}
interface RoadWaypoint{x: number; z: number; cp?: boolean;}
// marcador 3D de um checkpoint (anel/facho) ou da chegada (público + bandeira)
interface CpMarker{ring?: THREE.Mesh; beacon?: Beacon; finish?: THREE.Object3D;}

// mini game (sessão): trava o mundo durante a prova. A corrida desenha seus
// próprios checkpoints no radar (ver raceOn no hud.js), então não expõe blips de
// alvo aqui — a trava só garante o "um por vez" e o mapa sem outras atividades.
const game=new MiniGame({id:MiniGameId.RACE,name:'Street Race'});

// Minigame de corrida estilo open-world 3D: um pórtico de largada xadrez fica numa
// esquina da cidade. Chegue de carro, pare embaixo dele e a corrida começa:
// o carro teleporta pra linha, sirene + contagem 3-2-1, e então um percurso de
// checkpoints (um por vez) que você cruza NA ORDEM até a chegada. Três rivais
// dirigem PELAS RUAS (waypoints em L sobre as linhas de rua) e passam de fato
// por cada ponto, sem cortar caminho. As gangues somem durante a prova e voltam
// no fim. Música/rádio são exclusivos da corrida; se todos os rivais chegarem
// antes, você perde. Cada corrida concluída faz a próxima nascer noutro lugar.

const RACE_BUILD=' ◆ RACE';
document.getElementById('buildver')?.insertAdjacentText('beforeend',RACE_BUILD);

const CP_COUNT=6;      // checkpoints do percurso (corrida curta; o último é a chegada)
const CP_SPACING=35;   // distância mínima entre checkpoints (mais perto um do outro)
const CP_RADIUS=8;     // raio pra contar a passagem no checkpoint
const CP_AHEAD=0;      // checkpoints à frente visíveis além do atual (0 = só o atual)
const NPC_COUNT=3;     // adversários
const NPC_REACH=3.5;   // rivais precisam passar PERTO do ponto pra avançar (nada de burlar)
const RIVAL_PACES=[0.82,0.90,0.96]; // per-rival pace, all <1 so a CLEAN run wins; the catch-up surge keeps trailing rivals dangerous if you slack (a sloppy run can still drop to 2nd/3rd).
const SEP=3.8;         // distância mínima entre dois rivais (carro ~1.7 largo): separa quem encosta
const TURN_MIN=-0.1;   // produto escalar mínimo entre trechos: proíbe curva de ré/180
const GANG_MARGIN=8;   // folga extra além do raio do território
const ORANGE=0xff8a1e;

// largada e chegada NUNCA podem cair em território de gangue (centro fixo, raio
// só encolhe — checar o raio atual já garante que continua fora)
function inGangTerritory(x: number,z: number){
  for(const g of gangs)if(Math.hypot(x-g.x,z-g.z)<g.r+GANG_MARGIN)return true;
  return false;
}

// largada numa esquina da cidade (interseção = sempre em cima da rua). Muda de
// lugar a cada corrida concluída, então sempre nasce uma nova prova noutro ponto.
const start={x:nodeX(2),z:nodeX(5)};
const gate=makeRaceGate(ORANGE); // makeCar/makeRaceGate NÃO adicionam à cena
gate.position.set(start.x,0,start.z);
scene.add(gate);

// Pré-monta a corrida da largada atual: sorteia o percurso, o caminho de rua dos
// rivais e VIRA o pórtico de frente pro primeiro checkpoint (o jogador nasce
// dentro do arco já apontado pra ele).
function prepareRace(){
  route=genRoute();
  npcPath=buildRoadPath();
  const h=route.length?Math.atan2(route[0].x-start.x,route[0].z-start.z):0;
  gate.rotation.y=h;
}

function relocateStart(){
  const pp=playerPos();
  let i,j,x,z,tries=0;
  do{
    i=irand(1,N-1);j=irand(1,N-1);x=nodeX(i);z=nodeX(j);tries++;
  }while(tries<60&&(Math.hypot(x-pp.x,z-pp.z)<70||(x===start.x&&z===start.z)
    ||inGangTerritory(x,z))); // largada fora de território de gangue
  start.x=x;start.z=z;
  gate.position.set(x,0,z);
  startMk.ring.position.set(x,.4,z);
  startMk.beacon.at(x,z);
  prepareRace(); // novo percurso e nova orientação do pórtico
}

// marcador fixo da largada (anel + facho)
const startMk={ring:makeMarkerRing(ORANGE),beacon:new Beacon(ORANGE)};
startMk.ring.rotation.x=Math.PI/2;startMk.ring.position.set(start.x,.4,start.z);
startMk.beacon.at(start.x,start.z).mount();
scene.add(startMk.ring);

let phase='idle';   // idle | countdown | racing
let route: RoutePoint[]=[];       // [{x,z}] pontos do percurso na ordem
let cpMarkers: CpMarker[]=[];   // marcadores 3D de cada checkpoint
let npcPath: RoadWaypoint[]=[];     // waypoints de RUA (interseções) que os rivais seguem
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

// Percurso: esquinas (interseções) espaçadas, na ordem. Cada nova perna só pode
// virar pra frente/esquerda/direita em relação à anterior (nunca dar ré/180) —
// o produto escalar entre direções consecutivas tem que ficar acima de TURN_MIN.
function tryRoute(){
  const all: [number, number][]=[];
  for(let i=1;i<N;i++)for(let j=1;j<N;j++)all.push([nodeX(i),nodeX(j)]);
  for(let k=all.length-1;k>0;k--){const m=irand(0,k);[all[k],all[m]]=[all[m],all[k]];}
  const pts: RoutePoint[]=[];let px=start.x,pz=start.z,dirx: number|null=null,dirz: number|null=null;
  for(const[x,z]of all){
    if(pts.length>=CP_COUNT)break;
    const dx=x-px,dz=z-pz,dd=Math.hypot(dx,dz);
    if(dd<CP_SPACING)continue;          // checkpoints próximos uns dos outros
    const ndx=dx/dd,ndz=dz/dd;
    if(dirx!==null&&dirx*ndx+dirz!*ndz<TURN_MIN)continue; // sem curva ao contrário
    // o ÚLTIMO ponto (chegada) não pode cair em território de gangue
    if(pts.length===CP_COUNT-1&&inGangTerritory(x,z))continue;
    pts.push({x,z});px=x;pz=z;dirx=ndx;dirz=ndz;
  }
  return pts;
}
function genRoute(){
  let best: RoutePoint[]=[];
  for(let attempt=0;attempt<16;attempt++){
    const r=tryRoute();
    if(r.length>best.length)best=r;
    if(best.length>=CP_COUNT)break;
  }
  return best;
}

// Caminho de RUA pros rivais: as interseções (checkpoints e cantos) ligadas por
// trechos em L que correm SEMPRE sobre as linhas de rua (x=nodeX ou z=nodeX),
// então os carros inimigos viram nas esquinas em vez de varar os prédios.
function buildRoadPath(){
  const wps: RoadWaypoint[]=[];let cx=start.x,cz=start.z;
  for(const cp of route){
    if(cp.z!==cz){wps.push({x:cx,z:cp.z});cz=cp.z;}      // trecho ao longo de z
    if(cp.x!==cx){wps.push({x:cp.x,z:cz});cx=cp.x;}      // trecho ao longo de x
    const last=wps[wps.length-1];
    if(!last||last.x!==cp.x||last.z!==cp.z)wps.push({x:cp.x,z:cp.z});
    wps[wps.length-1].cp=true;                            // este waypoint é um checkpoint
  }
  return wps;
}

function buildCpMarkers(){
  for(let i=0;i<route.length;i++){
    const p=route[i];
    if(i===route.length-1){
      // ponto final: linha de chegada com público e bandeira, virada pra quem chega
      const finish=makeRaceFinish();
      const prev=route[i-1]||start;
      finish.position.set(p.x,0,p.z);
      finish.rotation.y=Math.atan2(p.x-prev.x,p.z-prev.z);
      scene.add(finish);
      const beacon=new Beacon(ORANGE).at(p.x,p.z).mount(); // facho de luz pra achar de longe
      cpMarkers.push({beacon,finish});
    }else{
      const ring=makeMarkerRing(ORANGE);
      ring.rotation.x=Math.PI/2;ring.position.set(p.x,.4,p.z);
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
    g.position.set(start.x+rx*lane+bx*(4+i*2.2),0,start.z+rz*lane+bz*(4+i*2.2));
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
  // teleporta o carro do jogador pra linha, virado pro primeiro checkpoint
  const h0=Math.atan2(route[0].x-start.x,route[0].z-start.z);
  cur!.g.position.set(start.x,0,start.z);
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

function abortRace(text='RACE ABANDONED',col='var(--pink)'){
  finishRace();
  // morte/prisão no meio da corrida: o cut de WASTED/BUSTED já assumiu o banner;
  // não apaga nem sobrescreve com "RACE ABANDONED".
  if(state.mode==='cut')return;
  hideBig();
  message(text,col);
}

function loseRace(){
  reportMiniGameResult(game.id,{won:false,score:0}); // ranking: corrida perdida
  finishRace();
  bigText('YOU LOST','var(--pink)');
  scheduleHide(2200);
  message('THE RIVALS FINISHED FIRST - NO PRIZE','var(--pink)');
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
  // ranking: vitória = 1º lugar; score = prêmio ganho (justo entre as posições)
  reportMiniGameResult(game.id,{won:place===1,score:paid});
  const ord=['1ST','2ND','3RD','4TH','5TH'][place-1]||place+'TH';
  finishRace();
  bigText(place===1?'YOU WIN!':`${ord} PLACE`,place===1?'var(--gold)':'var(--cyan)');
  scheduleHide(2200);
  message(paid>0?`${ord} OF ${total} - +$${paid}${bonus>0?' SPEED BONUS!':''}`
    :`${ord} OF ${total} - NO PRIZE`,paid>0?'var(--gold)':'var(--pink)');
  blip(place===1?[523,659,784,1047]:[440,330],.09,'sine',.18);
}

function hideRaceHud(){raceHud?.classList.remove('show');}

function updateRaceHud(){
  if(!raceHud)return;
  if(phase==='idle'){hideRaceHud();return;}
  raceHud.classList.add('show');
  if(phase==='countdown'){
    raceHud.innerHTML=`
      <div class="race-label">STREET RACE</div>
      <div class="race-main"><span>GET READY</span><b>${Math.max(1,Math.ceil(cdT))}</b></div>`;
    return;
  }
  const t=raceT,mm=Math.floor(t/60),ss=Math.floor(t%60);
  const clock=`${mm}:${String(ss).padStart(2,'0')}`;
  raceHud.innerHTML=`
    <div class="race-label">STREET RACE</div>
    <div class="race-main"><span>POS</span><b>${playerPlace()}/${racers.length+1}</b></div>
    <div class="race-row"><span>CP</span><b>${Math.min(playerCp+1,route.length)}/${route.length}</b></div>
    <div class="race-row"><span>TIME</span><b>${clock}</b></div>`;
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
      bigText('GO!','var(--gold)');scheduleHide(700);
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
