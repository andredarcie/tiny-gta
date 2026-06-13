import * as THREE from 'three';
import {N,nodeX,irand,pick,groundHeight} from './constants.js';
import {state,refs,carColors,saveBest} from './state.js';
import {scene} from './engine.js';
import {makeCar,spinWheels,seatDriver,shirtColors} from './entities.js';
import {cur,playerPos,cameraRig} from './player.js';
import {gangs} from './gangs.js';
import {makeDeliveryMarker} from '../assets/models/missions/delivery-marker.js';
import {makeRaceGate} from '../assets/models/missions/race-gate.js';
import {makeRaceFinish} from '../assets/models/missions/race-finish.js';
import {message,bigText,hideBig} from './hud.js';
import {blip,raceSiren} from './audio.js';
import {radioOff} from './radio.js';
import {raceMusicOn,raceMusicOff} from './race-music.js';

// Minigame de corrida estilo GTA 3D: um pórtico de largada xadrez fica numa
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
const TURN_MIN=-0.1;   // produto escalar mínimo entre trechos: proíbe curva de ré/180
const GANG_MARGIN=8;   // folga extra além do raio do território
const ORANGE=0xff8a1e;

// largada e chegada NUNCA podem cair em território de gangue (centro fixo, raio
// só encolhe — checar o raio atual já garante que continua fora)
function inGangTerritory(x,z){
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
  startMk.beacon.position.set(x,30,z);
  prepareRace(); // novo percurso e nova orientação do pórtico
}

// marcador fixo da largada (anel + facho)
const startMk=makeDeliveryMarker(ORANGE);
startMk.ring.rotation.x=Math.PI/2;startMk.ring.position.set(start.x,.4,start.z);
startMk.beacon.position.set(start.x,30,start.z);
scene.add(startMk.ring,startMk.beacon);

let phase='idle';   // idle | countdown | racing
let route=[];       // [{x,z}] pontos do percurso na ordem
let cpMarkers=[];   // marcadores 3D de cada checkpoint
let npcPath=[];     // waypoints de RUA (interseções) que os rivais seguem
let playerCp=0;     // próximo checkpoint do jogador
let raceT=0;        // cronômetro da corrida
let cdT=0;          // contagem regressiva
let lastCdShown=-1; // último número da contagem já exibido/apitado
let freezePos=null; // posição travada do carro durante a contagem
let freezeHeading=0; // direção travada do carro/câmera durante a contagem
const racers=[];    // adversários {g,cp,speed,finished}
let finishedNpcs=0; // quantos adversários já cruzaram a chegada
const raceHud=document.getElementById('racehud');

// alvos da corrida pro radar: largada quando ocioso, checkpoints à frente em prova
refs.raceBlips=()=>{
  if(phase==='idle')return[{x:start.x,z:start.z,current:true}];
  const out=[];
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
  if(phase!=='idle'||state.mode!=='car'||!cur)return false;
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
  const all=[];
  for(let i=1;i<N;i++)for(let j=1;j<N;j++)all.push([nodeX(i),nodeX(j)]);
  for(let k=all.length-1;k>0;k--){const m=irand(0,k);[all[k],all[m]]=[all[m],all[k]];}
  const pts=[];let px=start.x,pz=start.z,dirx=null,dirz=null;
  for(const[x,z]of all){
    if(pts.length>=CP_COUNT)break;
    const dx=x-px,dz=z-pz,dd=Math.hypot(dx,dz);
    if(dd<CP_SPACING)continue;          // checkpoints próximos uns dos outros
    const ndx=dx/dd,ndz=dz/dd;
    if(dirx!==null&&dirx*ndx+dirz*ndz<TURN_MIN)continue; // sem curva ao contrário
    // o ÚLTIMO ponto (chegada) não pode cair em território de gangue
    if(pts.length===CP_COUNT-1&&inGangTerritory(x,z))continue;
    pts.push({x,z});px=x;pz=z;dirx=ndx;dirz=ndz;
  }
  return pts;
}
function genRoute(){
  let best=[];
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
  const wps=[];let cx=start.x,cz=start.z;
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
      const m=makeDeliveryMarker(ORANGE);
      m.beacon.position.set(p.x,30,p.z); // facho de luz pra achar de longe
      scene.add(m.beacon);
      cpMarkers.push({beacon:m.beacon,finish});
    }else{
      const m=makeDeliveryMarker(ORANGE);
      m.ring.rotation.x=Math.PI/2;m.ring.position.set(p.x,.4,p.z);
      m.ring.material.transparent=true;
      m.beacon.position.set(p.x,30,p.z);
      scene.add(m.ring,m.beacon);
      cpMarkers.push({ring:m.ring,beacon:m.beacon});
    }
  }
}

function clearCpMarkers(){
  for(const m of cpMarkers){
    if(m.ring)scene.remove(m.ring);
    if(m.beacon)scene.remove(m.beacon);
    if(m.finish)scene.remove(m.finish);
  }
  cpMarkers=[];
}

function spawnRacers(h0){
  const rx=Math.cos(h0),rz=-Math.sin(h0);   // vetor "direita" da linha
  const bx=-Math.sin(h0),bz=-Math.cos(h0);  // vetor "atrás" da linha
  for(let i=0;i<NPC_COUNT;i++){
    const g=makeCar(carColors[(i*3+2)%carColors.length],false);
    seatDriver(g,pick(shirtColors)); // motorista rival ao volante (carro não fica vazio)
    const lane=(i-1)*3.2;
    g.position.set(start.x+rx*lane+bx*(4+i*2.2),0,start.z+rz*lane+bz*(4+i*2.2));
    g.rotation.y=h0;
    // mais lentos que antes pra dar chance ao jogador; largam escalonados
    racers.push({g,cp:0,wpi:0,speed:11+i*1.4,finished:false});
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
  if(!route.length)prepareRace(); // garante percurso (já vem pré-montado)
  buildCpMarkers();
  playerCp=0;raceT=0;cdT=3;lastCdShown=-1;
  startMk.ring.visible=startMk.beacon.visible=false; // some a largada durante a prova
  gate.visible=false;                                // tira o pórtico depois de largar
  // teleporta o carro do jogador pra linha, virado pro primeiro checkpoint
  const h0=Math.atan2(route[0].x-start.x,route[0].z-start.z);
  cur.g.position.set(start.x,0,start.z);
  cur.heading=h0;cur.g.rotation.set(0,h0,0);cur.speed=0;
  cameraRig.yaw=h0; // câmera já atrás do carro, olhando pro percurso
  freezePos=cur.g.position.clone();freezeHeading=h0;
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
  refs.setGangsHidden?.(false); // gangues voltam quando a corrida acaba
  raceMusicOff();
  hideRaceHud();
}

function abortRace(text='RACE ABANDONED',col='var(--pink)'){
  finishRace();
  hideBig();
  message(text,col);
}

function loseRace(){
  finishRace();
  bigText('YOU LOST','var(--pink)');
  setTimeout(hideBig,2200);
  message('THE RIVALS FINISHED FIRST - NO PRIZE','var(--pink)');
  blip([330,247,196],.12,'sawtooth',.18);
}

function completeRace(){
  const place=1+finishedNpcs;
  const total=racers.length+1;
  const prize=[700,350,150,0][place-1]??0;
  // bônus de tempo: corrida rápida paga mais (some por volta de ~2min)
  const bonus=place===1?Math.max(0,Math.round(220-raceT*1.4)):0;
  const paid=prize+bonus;
  if(paid>0){state.money+=paid;saveBest();}
  const ord=['1ST','2ND','3RD','4TH','5TH'][place-1]||place+'TH';
  finishRace();
  bigText(place===1?'YOU WIN!':`${ord} PLACE`,place===1?'var(--gold)':'var(--cyan)');
  setTimeout(hideBig,2200);
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
function updateCpMarkers(dt){
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
    m.ring.visible=show;
    if(!show)continue;
    m.ring.material.opacity=1;m.beacon.material.opacity=.18;
    m.ring.rotation.z+=2*dt;
    const sc=1+Math.sin(state.time*4)*.12;m.ring.scale.set(sc,sc,1);
  }
}

function updateRacers(dt){
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
    const step=Math.min(d,r.speed*dt);
    r.g.position.x+=Math.sin(h)*step;
    r.g.position.z+=Math.cos(h)*step;
    r.g.position.y=groundHeight(r.g.position.x,r.g.position.z);
    spinWheels(r.g,r.speed,dt);
    // só avança quando REALMENTE chegou no ponto (raio curto = não corta caminho)
    if(d<NPC_REACH){
      if(wp.cp){
        r.cp++;
        if(r.cp>=route.length){r.finished=true;finishedNpcs++;continue;}
      }
      r.wpi++;
    }
  }
}

export function updateRace(dt){
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
      bigText('GO!','var(--gold)');setTimeout(hideBig,700);
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
