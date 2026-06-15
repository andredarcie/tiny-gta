import * as THREE from 'three';
import {N,nodeX,rand,irand,pick,clamp} from './constants.js';
import {state,refs} from './state.js';
import {economy} from './economy.js';
import {scene} from './engine.js';
import {makePed,shirtColors} from './entities.js';
import {idleCars,cur,playerPos} from './player.js';
import {makeDeliveryMarker} from '../assets/models/missions/delivery-marker.js';
import {makeAmbulance} from '../assets/models/vehicles/ambulance.js';
import {message,bigText,hideBig} from './hud.js';
import {blip} from './audio.js';
import {HOSP_I,HOSP_J} from '../assets/models/city/hospital.js';
import {MiniGame,MiniGameId} from './minigame.js';
import {reportMiniGameResult} from './minigame-leaderboard.js';

// Side-mission de paramédico estilo GTA (Vigilante/Paramedic): uma ambulância
// fica estacionada na esquina do hospital. Entrou nela, começa o plantão: feridos
// caídos pela cidade precisam ser recolhidos (passe perto e pare) e levados ao
// hospital. Cada nível tem MAIS feridos e um tempo MENOR de folga; entregar todos
// paga e sobe de nível. Estourou o tempo, perdeu os pacientes — e como o jogador
// segue na ambulância, recomeça no nível 1 no frame seguinte (mesmo ciclo do táxi).
// Sair da ambulância encerra o plantão.

const MED_BUILD=' ◆ MEDIC';
document.getElementById('buildver')?.insertAdjacentText('beforeend',MED_BUILD);

const PATIENT_CAP=6;                 // teto de feridos simultâneos por nível
const dropX=nodeX(HOSP_I)+4,dropZ=nodeX(HOSP_J); // entrega na frente do ponto da ambulância

// Ambulância estacionada no asfalto da interseção do hospital
const amb={g:makeAmbulance(),heading:0,speed:0,name:'AMBULANCE',police:false,ambulance:true};
amb.g.position.set(nodeX(HOSP_I)+4,0,nodeX(HOSP_J));
amb.g.rotation.y=0;
idleCars.push(amb);

let phase='off';   // off | rescue (recolhendo feridos) | hospital (levando ao hospital)
let level=1;
let onboard=0;     // feridos já dentro da ambulância
let needed=0;      // feridos do nível atual
let timeLeft=0;    // tempo restante do nível
let timeMax=1;     // tempo total do nível (pra barra do HUD)
const patients=[]; // {g,x,z,ring,beacon,loaded}
let hospMk=null;   // marcador do hospital quando todos a bordo
let wreckT=0;      // ambulância destruída: volta pro ponto depois de um tempo
let runRescues=0;  // pacientes entregues no plantão (resumo)

// mini game (sessão): trava o mundo durante o plantão; os alvos são os feridos
// (fase rescue) ou o hospital (fase hospital)
const game=new MiniGame({id:MiniGameId.PARAMEDIC,name:'Paramedic',
  blips:()=>phase==='hospital'
    ?[{x:dropX,z:dropZ,icon:'cross',color:'#19e3ff',label:'HOSPITAL',current:true,reveal:false}]
    :patients.filter(p=>!p.loaded).map(p=>({x:p.x,z:p.z,icon:'cross',color:'#5eff8a',
      label:'PATIENT',current:true,reveal:false}))});

const _v=new THREE.Vector3(); // scratch pra contas por frame (sem new no loop)
const medHud=document.getElementById('medhud');

// ---- contrato exposto (o orquestrador depende destes nomes EXATOS) ----
refs.isAmbulanceCar=c=>c===amb;
refs.paramedicBlips=()=>{
  if(phase==='off')return[];
  if(phase==='hospital')return[{x:dropX,z:dropZ,col:'#19e3ff',current:true}];
  const out=[];
  for(const p of patients)if(!p.loaded)out.push({x:p.x,z:p.z,col:'#5eff8a'});
  return out;
};
// ponto da ambulância quando fora de serviço (pro mapa achar o minigame)
refs.paramedicStart=()=>phase==='off'?{x:amb.g.position.x,z:amb.g.position.z}:null;
refs.getParamedicState=()=>({phase,level,onboard,needed,timeLeft,active:phase!=='off'});

// ----- marcadores -----
function spawnMarker(col,x,z,y=.4){
  const{ring,beacon}=makeDeliveryMarker(col);
  ring.rotation.x=Math.PI/2;ring.position.set(x,y,z);scene.add(ring);
  beacon.position.set(x,30,z);scene.add(beacon);
  return{ring,beacon};
}
function pulse(mk,dt){
  if(!mk?.ring)return;
  mk.ring.rotation.z+=2*dt;
  const sc=1+Math.sin(state.time*4)*.12;mk.ring.scale.set(sc,sc,1);
}

// ----- spawn de feridos longe do jogador, deitados na beira da rua -----
function pickSpot(minD,fx,fz){
  let x,z,tries=0;
  do{x=nodeX(irand(0,N))+rand(-3.5,3.5);z=nodeX(irand(0,N))+rand(-3.5,3.5);tries++;}
  while(Math.hypot(x-fx,z-fz)<minD&&tries<30);
  return[x,z];
}

function spawnPatients(){
  const pp=playerPos();
  for(let i=0;i<needed;i++){
    const[x,z]=pickSpot(50,pp.x,pp.z);
    const g=makePed(pick(shirtColors));
    g.position.set(x,.35,z);             // caído como os mortos do jogo
    g.rotation.x=-Math.PI/2;
    g.rotation.y=Math.random()*Math.PI*2;
    scene.add(g);
    const mk=spawnMarker(0x5eff8a,x,z);
    patients.push({g,x,z,ring:mk.ring,beacon:mk.beacon,loaded:false});
  }
}

function clearPatients(){
  for(const p of patients){
    if(p.g.parent)scene.remove(p.g);
    if(p.ring)scene.remove(p.ring,p.beacon);
  }
  patients.length=0;
}

function clearHospMk(){
  if(hospMk){scene.remove(hospMk.ring,hospMk.beacon);hospMk=null;}
}

// ----- níveis -----
function startLevel(announce=true){
  needed=Math.min(PATIENT_CAP,level);
  onboard=0;
  timeMax=45+level*12;timeLeft=timeMax;
  clearHospMk();
  spawnPatients();
  if(announce){
    message(`PARAMEDIC - LEVEL ${level}: RESCUE ${needed} PATIENT${needed>1?'S':''}`,'var(--gold)');
    blip([523,659],.08,'sine',.16);
  }
  phase='rescue';
  updateMedHud();
}

function startDuty(){
  if(!game.begin())return; // outra sessão de mini game rolando: não começa
  level=1;runRescues=0;
  message('PARAMEDIC DUTY STARTED','var(--gold)');
  startLevel(false);
  message(`LEVEL 1: RESCUE ${needed} PATIENT${needed>1?'S':''}`,'var(--gold)');
  blip([440,587,740],.08,'sine',.16);
}

function endDuty(text='PARAMEDIC DUTY ENDED',col='var(--cyan)'){
  clearPatients();
  clearHospMk();
  const summary=runRescues>0?` - ${runRescues} PATIENTS SAVED`:'';
  // ranking: o plantão inteiro é UMA sessão; score = pacientes salvos
  reportMiniGameResult(game.id,{won:runRescues>0,score:runRescues});
  phase='off';onboard=0;needed=0;timeLeft=0;
  game.end(); // libera a trava do mundo
  hideMedHud();
  message(text+summary,col);
}

function loadPatient(p){
  if(p.g.parent)scene.remove(p.g);
  if(p.ring){scene.remove(p.ring,p.beacon);p.ring=p.beacon=null;}
  p.loaded=true;
  onboard++;
  blip([587,784],.07,'sine',.15);
  message(`PATIENT ${onboard}/${needed} ABOARD`,'var(--cyan)');
  if(onboard>=needed){
    // todos a bordo: abre a entrega no hospital
    hospMk=spawnMarker(0x19e3ff,dropX,dropZ);
    phase='hospital';
    message('TAKE THEM TO THE HOSPITAL','var(--gold)');
    blip([659,880],.08,'sine',.16);
  }
  updateMedHud();
}

function deliver(){
  const reward=30*onboard+40*level;
  economy.earn(reward,'paramedic');
  runRescues+=onboard;
  clearHospMk();
  clearPatients();
  message(`PATIENTS DELIVERED +$${reward}`,'var(--gold)');
  bigText('PATIENTS DELIVERED','var(--gold)');
  setTimeout(hideBig,1400);
  blip([523,659,784,1047],.09,'sine',.18);
  level++;
  startLevel(false);
  message(`LEVEL ${level}: RESCUE ${needed} PATIENT${needed>1?'S':''}`,'var(--gold)');
}

function timeout(){
  message('PATIENTS LOST - OUT OF TIME','var(--pink)');
  blip([220,165,110],.12,'sawtooth',.16);
  // Keep the session alive (do NOT call endDuty/game.end): the player is still in
  // the ambulance, so ending here would re-open the leaderboard briefing overlay
  // every timeout. Mirror taxi/vigilante: reset to level 1 and respawn in place.
  clearPatients();
  clearHospMk();
  level=1;
  startLevel(false);
  message(`LEVEL 1: RESCUE ${needed} PATIENT${needed>1?'S':''}`,'var(--gold)');
}

// ----- ambulância destruída: reaparece no ponto do hospital -----
function resetAmbulance(){
  amb.speed=0;amb.sinkT=0;amb.heading=0;
  amb.g.userData.bulletHits=0;
  amb.g.position.set(nodeX(HOSP_I)+4,0,nodeX(HOSP_J));
  amb.g.rotation.set(0,0,0);
  for(const d of amb.g.userData.doors||[])d.rotation.y=0;
}

// ----- HUD -----
function hideMedHud(){medHud?.classList.remove('show');}

function updateMedHud(){
  if(!medHud)return;
  if(phase==='off'){hideMedHud();return;}
  medHud.classList.add('show');
  const pct=Math.round(clamp(timeLeft/timeMax,0,1)*100);
  const rowState=phase==='hospital'
    ?'<div class="med-row"><span>TO HOSPITAL</span><b>DELIVER</b></div>'
    :'<div class="med-row"><span>TO HOSPITAL</span><b>--</b></div>';
  medHud.innerHTML=`
    <div class="med-label">PARAMEDIC</div>
    <div class="med-main"><span>LEVEL</span><b>${level}</b></div>
    <div class="med-row"><span>ONBOARD</span><b>${onboard}/${needed}</b></div>
    ${rowState}
    <div class="med-meter"><i style="width:${pct}%"></i></div>`;
}

export function updateParamedic(dt){
  // ambulância destruída: reaparece no ponto do hospital depois de um tempo
  if(!amb.g.parent&&cur!==amb){
    wreckT+=dt;
    if(wreckT>20){
      wreckT=0;resetAmbulance();
      scene.add(amb.g);
      if(!idleCars.includes(amb))idleCars.push(amb);
      message('A NEW AMBULANCE IS WAITING AT THE HOSPITAL','var(--cyan)');
    }
  }

  const driving=state.mode==='car'&&cur===amb;
  if(phase==='off'){
    if(driving)startDuty(); // entrou na ambulância: começa o plantão
    return;
  }
  if(!driving){endDuty();return;} // saiu (ou WASTED/BUSTED): encerra

  // cronômetro do nível
  timeLeft-=dt;
  if(timeLeft<=0){timeLeft=0;timeout();return;}

  if(phase==='rescue'){
    // recolhe feridos: passe perto e pare quase parado
    for(const p of patients){
      if(p.loaded)continue;
      _v.set(amb.g.position.x-p.x,0,amb.g.position.z-p.z);
      if(_v.length()<3.6&&Math.abs(amb.speed)<2){loadPatient(p);}
    }
  }else{ // hospital
    _v.set(amb.g.position.x-dropX,0,amb.g.position.z-dropZ);
    if(_v.length()<3.6&&Math.abs(amb.speed)<2){deliver();return;}
  }

  // pulsa os marcadores ativos
  for(const p of patients)if(!p.loaded)pulse(p,dt);
  pulse(hospMk,dt);
  updateMedHud();
}
