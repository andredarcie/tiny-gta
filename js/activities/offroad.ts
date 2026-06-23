import * as THREE from 'three';
import {groundHeight,rubberSpeed,separateRacers,pick,diminishPrize,smoothPace} from '@/core/constants.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {makeCar,spinWheels,seatDriver,shirtColors} from '@/core/entities.ts';
import {cur,playerPos,cameraRig} from '@/actors/player.ts';
import {makeDeliveryMarker} from '../../assets/models/missions/delivery-marker.ts';
import {makeOffroadGate} from '../../assets/models/missions/offroad-gate.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip,raceSiren} from '@/audio/audio.ts';
import {radioOff} from '@/ui/radio.ts';
import {raceMusicOn,raceMusicOff} from '@/audio/race-music.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.ts';
import type {Racer,PrizeStreak,Blip} from '@/core/types.ts';

// checkpoint (x,z) na ordem do circuito
interface RoutePoint{x: number; z: number;}
// marcador 3D de um checkpoint (anel pulsante + facho)
interface CpMarker{ring: THREE.Mesh; beacon: THREE.Mesh;}

// ============================================================================
// OFF-ROAD — a 3ª corrida do jogo (estilo desafio off-road do open-world), na
// PRADARIA RURAL a leste da cidade. Mesmo esquema das outras corridas (rua e
// lancha), só que num CIRCUITO FIXO de terra em loop pelas colinas: chegue de
// carro no pórtico de largada, pare embaixo e a prova começa — o carro teleporta
// pra linha, sirene + contagem 3-2-1, e então uma volta por checkpoints (na
// ordem) cruzando o pasto até voltar ao pórtico (largada = chegada). Três rivais
// disputam de verdade, dirigindo ponto-a-ponto pelo terreno. Rubber banding
// compartilhado (rubberSpeed): rival que cai muito atrás ganha boost forte pra
// colar. Música/rádio exclusivos da prova; se todos os rivais chegarem antes,
// você perde. Sair do carro / WASTED / BUSTED abandona.
//
// O circuito fica na PRADARIA logo a LESTE da ponte (x∈[300,338], |z|≤99): a faixa
// de pasto aberta entre o rio/ponte (a oeste, x≤294) e as roças de Drycreek (a
// leste, x≥342). LONGE da água do estreito, das fazendas/silo, do rancho (x≈550) e
// da montanha (x≈509). Árvores/cercas não têm colisão; nenhum prédio no caminho.
// Gangues só existem na cidade, então a prova nunca cai em território.
// ============================================================================

const OFF_BUILD=' ◆ OFFROAD';
document.getElementById('buildver')?.insertAdjacentText('beforeend',OFF_BUILD);

const ORANGE=0xff8a1e;
const CP_RADIUS=9;     // raio pra contar a passagem no checkpoint (off-road é frouxo)
const CP_AHEAD=0;      // checkpoints visíveis além do atual (0 = SÓ o próximo que o jogador tem que cruzar)
const NPC_COUNT=3;     // adversários
const NPC_REACH=4.5;   // rivais precisam chegar PERTO do ponto pra avançar (sem cortar caminho)
const RIVAL_PACES=[0.82,0.90,0.96]; // per-rival pace, all <1 so a CLEAN run wins; the catch-up surge keeps trailing rivals dangerous if you slack (a sloppy run can still drop to 2nd/3rd).
const SEP=3.8;         // distância mínima entre dois rivais: separa quem encosta
const offColors=[0x2e6f3a,0xc9a227,0x8a3b2b]; // verde-mato, mostarda e barro (carro do jogador é o seu)

// Pórtico de largada (= chegada: o percurso é um loop que volta pra cá). O carro
// passa por baixo. Fica na estrada de terra (z≈0) logo a leste da ponte, fácil de
// alcançar atravessando o estreito de carro.
const start={x:308,z:0};
// Circuito em loop pela pradaria a leste da ponte (oval vertical: retas norte-sul
// no pasto, curvas abrindo pro pasto aberto). O ÚLTIMO ponto volta pra perto do
// pórtico — cruzar ele é a linha de chegada. Tudo a oeste das roças (x≥342) e a
// leste da água do estreito (x≤294); árvores/cercas não colidem.
const CPS: RoutePoint[]=[
  {x:302,z: 62}, // sobe a reta oeste
  {x:322,z: 99}, // curva norte
  {x:332,z: 84}, // abre pro pasto norte
  {x:322,z:-30}, // desce a reta leste
  {x:335,z:-94}, // abre pro pasto sul
  {x:308,z:-99}, // curva sul
  {x:300,z:-46}, // volta pela reta oeste
  {x:305,z: -6}, // chegada, de volta ao pórtico
];

const gate=makeOffroadGate(ORANGE); // make* NÃO adiciona à cena
gate.position.set(start.x,groundHeight(start.x,start.z),start.z);
gate.rotation.y=Math.atan2(CPS[0].x-start.x,CPS[0].z-start.z); // arco apontado pra 1ª curva
scene.add(gate);

// marcador da largada: anel pulsante no chão + facho (igual às outras corridas)
const startMk=makeDeliveryMarker(ORANGE);
startMk.ring.rotation.x=Math.PI/2;
startMk.ring.position.set(start.x,groundHeight(start.x,start.z)+.4,start.z);
startMk.beacon.position.set(start.x,30,start.z);
scene.add(startMk.ring,startMk.beacon);

let phase='idle';   // idle | countdown | racing
let route: RoutePoint[]=CPS;      // [{x,z}] checkpoints na ordem (o último é a chegada)
let cpMarkers: CpMarker[]=[];   // marcadores 3D de cada checkpoint
let playerCp=0;     // próximo checkpoint do jogador
let raceT=0;        // cronômetro da corrida
let cdT=0;          // contagem regressiva
let lastCdShown=-1; // último número da contagem exibido/apitado
let freezePos: THREE.Vector3|null=null; // posição travada do carro durante a contagem
let freezeHeading=0;// direção travada do carro/câmera durante a contagem
const racers: Racer[]=[];    // adversários {g,cp,speed,finished}
let finishedNpcs=0; // quantos rivais já cruzaram a chegada
const prizeState: PrizeStreak={streak:0,last:-Infinity}; // anti-farm: prêmio decresce em vitórias seguidas
let paceRef=0;      // ritmo de referência suavizado do jogador (rubber banding sutil; ver smoothPace)

// Cancellable banner-hide timer: a stale hideBig from a previous session must not
// fire and wipe a banner shown by a new one. scheduleHide always replaces the pending timer.
let hideTimer: ReturnType<typeof setTimeout>|null=null;
function scheduleHide(ms: number){clearTimeout(hideTimer!);hideTimer=setTimeout(()=>{hideTimer=null;hideBig();},ms);}

// mini game (sessão exclusiva): trava o mundo durante a prova. Os blips dos
// checkpoints saem por aqui (MiniGame.activeBlips) e o hud.js desenha SÓ eles no
// radar/mapa enquanto a sessão roda — mapa limpo, sem editar os loops do hud.
const game=new MiniGame({id:MiniGameId.OFFROAD,name:'Off-Road',blips:(): Blip[]=>{
  if(phase==='idle')return[];
  const out: Blip[]=[];
  for(let i=playerCp;i<Math.min(route.length,playerCp+1+CP_AHEAD);i++)
    out.push({x:route[i].x,z:route[i].z,icon:'flag',color:'#ff8a1e',
      label:i===playerCp?'CHECKPOINT':null,current:i===playerCp,reveal:false} as Blip);
  return out;
}});

// blip da largada OCIOSA no radar/mapa completo (some durante a prova, que usa os
// blips do MiniGame acima). Mesmo registro dos outros minigames de ponto fixo.
(refs.miniBlips||(refs.miniBlips=[])).push((): Blip[]=>
  phase==='idle'?[{x:start.x,z:start.z,icon:'flag',color:'#ff8a1e',label:'OFF-ROAD'}]:[]);

refs.getOffroadState=()=>({
  phase,
  cp:playerCp,
  total:route.length,
  time:phase==='racing'?raceT:0,
  pos:phase==='racing'?playerPlace():0,
  racers:racers.length+1,
});
// Largada SÓ por interação (tecla E / botão): de carro, parado embaixo do pórtico
refs.offroadNear=()=>{
  // Only a road vehicle (car/motorcycle) can start this race — reject plane/boat/RC toy.
  if(phase!=='idle'||state.mode!=='car'||!cur||cur.plane||cur.boat||cur.remote)return false;
  const p=playerPos();
  return Math.hypot(p.x-start.x,p.z-start.z)<6&&Math.abs(cur.speed)<3;
};
refs.startOffroadInteract=()=>{
  if(!refs.offroadNear())return false;
  startRace();return true;
};

function buildCpMarkers(){
  for(let i=0;i<route.length;i++){
    const p=route[i];
    const m=makeDeliveryMarker(ORANGE);
    m.ring.rotation.x=Math.PI/2;
    m.ring.position.set(p.x,groundHeight(p.x,p.z)+.4,p.z);
    (m.ring.material as THREE.Material).transparent=true;
    m.beacon.position.set(p.x,30,p.z);
    scene.add(m.ring,m.beacon);
    cpMarkers.push({ring:m.ring,beacon:m.beacon});
  }
}

function clearCpMarkers(){
  for(const m of cpMarkers){
    if(m.ring)scene.remove(m.ring);
    if(m.beacon)scene.remove(m.beacon);
  }
  cpMarkers=[];
}

function spawnRacers(h0: number){
  const rx=Math.cos(h0),rz=-Math.sin(h0);   // vetor "direita" da linha
  const bx=-Math.sin(h0),bz=-Math.cos(h0);  // vetor "atrás" da linha
  for(let i=0;i<NPC_COUNT;i++){
    const g=makeCar(offColors[i%offColors.length],false);
    seatDriver(g,pick(shirtColors)); // piloto rival ao volante (carro não fica vazio)
    const lane=(i-1)*3.2;
    const x=start.x+rx*lane+bx*(4+i*2.2), z=start.z+rz*lane+bz*(4+i*2.2);
    g.position.set(x,groundHeight(x,z),z);
    g.rotation.y=h0;
    // mais lentos pra dar chance ao jogador; largam escalonados. O rubber banding
    // (rubberSpeed) garante que o que fica pra trás cola de volta.
    racers.push({g,cp:0,speed:12+i*1.3,pace:RIVAL_PACES[i%RIVAL_PACES.length],finished:false});
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
  buildCpMarkers();
  playerCp=0;raceT=0;cdT=REWARDS.offroad.countdownSec;lastCdShown=-1;paceRef=0;
  startMk.ring.visible=startMk.beacon.visible=false; // some o marcador de largada na prova
  // teleporta o carro do jogador pra linha, virado pro 1º checkpoint
  const h0=Math.atan2(route[0].x-start.x,route[0].z-start.z);
  const sy=groundHeight(start.x,start.z);
  cur!.g.position.set(start.x,sy,start.z);
  cur!.heading=h0;cur!.g.rotation.set(0,h0,0);cur!.speed=0;
  cameraRig.yaw=h0; // câmera já atrás do carro, olhando pro percurso
  freezePos=cur!.g.position.clone();freezeHeading=h0;
  spawnRacers(h0);
  phase='countdown';
  state.controlsLocked=true; // sem dirigir/sair/atirar durante a contagem
  radioOff();                // rádio do carro cala: a corrida tem trilha própria
  raceSiren();               // sirene de largada
  updateRaceHud();
}

function finishRace(){
  clearRacers();clearCpMarkers();
  startMk.ring.visible=startMk.beacon.visible=true; // marcador da largada volta
  phase='idle';freezePos=null;
  state.controlsLocked=false;
  game.end(); // libera a trava do mundo
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
  const prize=REWARDS.offroad.placePrizes[place-1]??0;
  // bônus de tempo: volta rápida paga mais (some por volta de ~2min)
  const bonus=place===1?Math.max(0,Math.round(REWARDS.offroad.fastWinBonusMax-raceT*REWARDS.offroad.fastWinBonusDecayPerSec)):0;
  // anti-farm: refazer a prova em loop paga cada vez menos (recupera com o tempo)
  const paid=diminishPrize(prizeState,prize+bonus,state.time,REWARDS.offroad.repeatWinDecay,REWARDS.offroad.repeatWinRecoverSec);
  economy.earn(paid,'offroad');
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

// HUD da corrida (reusa o mesmo painel das corridas de rua/lancha — só uma roda
// por vez por causa da trava de mini game, então o elemento é compartilhado).
const raceHud=document.getElementById('racehud');
function hideRaceHud(){raceHud?.classList.remove('show');}

function updateRaceHud(){
  if(!raceHud)return;
  if(phase==='idle'){hideRaceHud();return;}
  raceHud.classList.add('show');
  if(phase==='countdown'){
    raceHud.innerHTML=`
      <div class="race-label">OFF-ROAD</div>
      <div class="race-main"><span>GET READY</span><b>${Math.max(1,Math.ceil(cdT))}</b></div>`;
    return;
  }
  const t=raceT,mm=Math.floor(t/60),ss=Math.floor(t%60);
  const clock=`${mm}:${String(ss).padStart(2,'0')}`;
  raceHud.innerHTML=`
    <div class="race-label">OFF-ROAD</div>
    <div class="race-main"><span>POS</span><b>${playerPlace()}/${racers.length+1}</b></div>
    <div class="race-row"><span>CP</span><b>${Math.min(playerCp+1,route.length)}/${route.length}</b></div>
    <div class="race-row"><span>TIME</span><b>${clock}</b></div>`;
}

// marcadores: mostra SÓ o checkpoint atual (o próximo que o jogador tem que
// cruzar); pulsa no chão da pradaria.
function updateCpMarkers(dt: number){
  for(let i=0;i<cpMarkers.length;i++){
    const m=cpMarkers[i];
    const show=i>=playerCp&&i<=playerCp+CP_AHEAD;
    const current=i===playerCp;
    m.ring.visible=show;
    m.beacon.visible=show;
    if(!show)continue;
    (m.beacon.material as THREE.Material).opacity=current?.18:.08;
    (m.ring.material as THREE.Material).opacity=current?1:.4;
    m.ring.rotation.z+=2*dt;
    const sc=(current?1:.8)+Math.sin(state.time*4)*.12;m.ring.scale.set(sc,sc,1);
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
    const wp=route[r.cp];
    if(!wp){r.finished=true;finishedNpcs++;continue;}
    // mira no checkpoint (off-road: vai direto pelo terreno, sem grade de rua)
    const dx=wp.x-r.g.position.x,dz=wp.z-r.g.position.z;
    const d=Math.hypot(dx,dz);
    const h=Math.atan2(dx,dz);
    const c0=r.g.rotation.y;
    let diff=THREE.MathUtils.euclideanModulo(h-c0+Math.PI,Math.PI*2)-Math.PI;
    r.g.rotation.y=c0+diff*Math.min(1,5*dt);
    // rubber banding (helper): velocidade ancorada no ritmo de REFERÊNCIA suavizado
    // do jogador (paceRef) — rival ATRÁS surta pra colar, rival à frente alivia pra
    // ser pego. Frear NÃO faz o rival frear junto (paceRef cai devagar): quem para
    // de verdade é ultrapassado depois de ~1-2s, não no mesmo frame.
    const gap=playerProg-legProgress(r.cp,r.g.position.x,r.g.position.z);
    const spd=rubberSpeed(r.speed,gap,paceRef,r.pace);
    const step=Math.min(d,spd*dt);
    r.g.position.x+=Math.sin(h)*step;
    r.g.position.z+=Math.cos(h)*step;
    r.g.position.y=groundHeight(r.g.position.x,r.g.position.z); // assenta no relevo
    spinWheels(r.g,spd,dt);
    // só avança quando REALMENTE chegou no ponto (raio curto = não corta caminho)
    if(d<NPC_REACH){
      r.cp++;
      if(r.cp>=route.length){r.finished=true;finishedNpcs++;}
    }
  }
  separateRacers(racers,SEP,cur); // ninguém anda por dentro de ninguém (inclui o carro do jogador)
}

export function updateOffroad(dt: number){
  // marcador da largada pulsando quando ocioso
  if(phase==='idle'&&startMk.ring.visible){
    startMk.ring.rotation.z+=2*dt;
    const sc=1+Math.sin(state.time*4)*.12;startMk.ring.scale.set(sc,sc,1);
  }

  // ociosa: largada é por interação do jogador (ver refs.startOffroadInteract)
  if(phase==='idle')return;

  // saiu do carro / WASTED / BUSTED no meio da prova: abandona
  if(state.mode!=='car'||!cur){abortRace();return;}

  if(phase==='countdown'){
    if(freezePos){cur.g.position.copy(freezePos);cur.speed=0;} // congela na linha
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
