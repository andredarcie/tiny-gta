import * as THREE from 'three';
import {pick,clamp,groundHeight} from '@/core/constants.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {makePed,shirtColors} from '@/core/entities.ts';
import {idleCars,cur,playerPos} from '@/actors/player.ts';
import {makeMarkerRing} from '../../assets/models/missions/marker-ring.ts';
import {Beacon} from '@/core/beacon.ts';
import {makeAmbulance} from '../../assets/models/vehicles/ambulance.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {HOSP_DOOR} from '../../assets/models/city/hospital.ts';
import {nearestRoad,pointAt,laneOff,streetSpot} from '@/world/divinolandia/nav.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {markMiniGamePlayed} from '@/activities/minigame-intro.ts';
import {Npc} from '@/actors/npc.ts';

// Side-mission de paramédico estilo open-world (Vigilante/Paramedic): uma ambulância
// fica estacionada na rua em frente ao Hospital Regional. Entrou nela, começa o plantão: feridos
// caídos pela cidade precisam ser recolhidos (passe perto e pare) e levados ao
// hospital. Cada nível tem MAIS feridos e um tempo MENOR de folga; entregar todos
// paga e sobe de nível. Estourou o tempo, perdeu os pacientes — e como o jogador
// segue na ambulância, recomeça no nível 1 no frame seguinte (mesmo ciclo do táxi).
// Sair da ambulância encerra o plantão.

const MED_BUILD=' ◆ RESGATE';
document.getElementById('buildver')?.insertAdjacentText('beforeend',MED_BUILD);

const PATIENT_CAP=6;                 // teto de feridos simultâneos por nível
// the ambulance bay: the lane of the street nearest the Hospital Regional's entrance,
// which is also where the patients are delivered
const bay=(()=>{
  const r=nearestRoad(HOSP_DOOR.x,HOSP_DOOR.z,300);
  if(!r)return{x:HOSP_DOOR.x,z:HOSP_DOOR.z,h:0};
  const p=pointAt(r.e,r.s,1);
  return{x:r.x-p.dz*laneOff(r.e),z:r.z+p.dx*laneOff(r.e),h:Math.atan2(p.dx,p.dz)};
})();
const dropX=bay.x,dropZ=bay.z;

// Ambulância estacionada na rua em frente ao hospital
const amb: any={g:makeAmbulance(),heading:bay.h,speed:0,name:'AMBULÂNCIA',police:false,ambulance:true};
amb.g.position.set(bay.x,groundHeight(bay.x,bay.z),bay.z);
amb.g.rotation.y=bay.h;
idleCars.push(amb);

// An injured civilian collapsed in the street (ped + ground marker). Extends Npc
// (so 100% of NPCs share the base class) but with register:false — a patient must
// be RESCUED, never shot, so it stays out of the unified weapon scan.
class Patient extends Npc{
  x:number;z:number;ring:THREE.Mesh|null;beacon:Beacon|null;loaded:boolean;
  constructor(g:THREE.Object3D,x:number,z:number,ring:THREE.Mesh,beacon:Beacon){
    super(g,{kind:'patient',hp:1,register:false,area:'Ruas da cidade'});
    this.x=x;this.z=z;this.ring=ring;this.beacon=beacon;this.loaded=false;
  }
  override aliveState():string{return this.loaded?'Na ambulância':'Ferido — precisa de resgate';}
}
interface Marker{ring:THREE.Mesh;beacon:Beacon;}

let phase='off';   // off | rescue (recolhendo feridos) | hospital (levando ao hospital)
let level=1;
let onboard=0;     // feridos já dentro da ambulância
let needed=0;      // feridos do nível atual
let timeLeft=0;    // tempo restante do nível
let timeMax=1;     // tempo total do nível (pra barra do HUD)
const patients: Patient[]=[]; // {g,x,z,ring,beacon,loaded}
let hospMk: Marker|null=null;   // marcador do hospital quando todos a bordo
let wreckT=0;      // ambulância destruída: volta pro ponto depois de um tempo
let runRescues=0;  // pacientes entregues no plantão (resumo)

// mini game (sessão): trava o mundo durante o plantão; os alvos são os feridos
// (fase rescue) ou o hospital (fase hospital)
const game=new MiniGame({id:MiniGameId.PARAMEDIC,name:'Plantão de Ambulância',
  blips:()=>phase==='hospital'
    ?[{x:dropX,z:dropZ,icon:'cross',color:'#19e3ff',label:'HOSPITAL',current:true,reveal:false}]
    :patients.filter(p=>!p.loaded).map(p=>({x:p.x,z:p.z,icon:'cross',color:'#5eff8a',
      label:'PACIENTE',current:true,reveal:false}))});

const _v=new THREE.Vector3(); // scratch pra contas por frame (sem new no loop)
const medHud=document.getElementById('medhud');

// ---- contrato exposto (o orquestrador depende destes nomes EXATOS) ----
refs.isAmbulanceCar=(c: any)=>c===amb;
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
function spawnMarker(col: number,x: number,z: number,y=.4): Marker{
  const ring=makeMarkerRing(col);
  ring.rotation.x=Math.PI/2;ring.position.set(x,groundHeight(x,z)+y,z);scene.add(ring);
  const beacon=new Beacon(col).at(x,z).mount();
  return{ring,beacon};
}
function pulse(mk: {ring:THREE.Mesh|null}|null,dt: number){
  if(!mk?.ring)return;
  mk.ring.rotation.z+=2*dt;
  const sc=1+Math.sin(state.time*4)*.12;mk.ring.scale.set(sc,sc,1);
}

// ----- injured people lying in the street, in the neighbourhoods down the hill from the
// hospital (within a run of the ambulance bay) -----
function spawnPatients(){
  const pp=playerPos();
  for(let i=0;i<needed;i++){
    const s=streetSpot({x:dropX,z:dropZ},120,520);
    let x=s.road.x,z=s.road.z;
    if(Math.hypot(x-pp.x,z-pp.z)<40){const t=streetSpot({x:dropX,z:dropZ},120,520);x=t.road.x;z=t.road.z;}
    const g=makePed(pick(shirtColors));
    g.position.set(x,groundHeight(x,z)+.35,z); // lying down like the game's dead
    g.rotation.x=-Math.PI/2;
    g.rotation.y=Math.random()*Math.PI*2;
    scene.add(g);
    const mk=spawnMarker(0x5eff8a,x,z);
    patients.push(new Patient(g,x,z,mk.ring,mk.beacon));
  }
}

function clearPatients(){
  for(const p of patients){
    if(p.ring){scene.remove(p.ring);p.beacon!.dispose();} // new Beacon class disposes itself
    p.despawn(); // removes the ped from the scene + the NPC census
  }
  patients.length=0;
}

function clearHospMk(){
  if(hospMk){scene.remove(hospMk.ring);hospMk.beacon.dispose();hospMk=null;}
}

// ----- níveis -----
function startLevel(announce=true){
  needed=Math.min(PATIENT_CAP,level);
  onboard=0;
  timeMax=REWARDS.paramedic.levelTimeBaseSec+level*REWARDS.paramedic.levelTimePerLevelSec;timeLeft=timeMax;
  clearHospMk();
  spawnPatients();
  if(announce){
    message(`PLANTÃO DE AMBULÂNCIA - NÍVEL ${level}: RESGATE ${needed} PACIENTE${needed>1?'S':''}`,'var(--gold)');
    blip([523,659],.08,'sine',.16);
  }
  phase='rescue';
  updateMedHud();
}

function startDuty(){
  if(!game.begin())return; // outra sessão de mini game rolando: não começa
  level=1;runRescues=0;
  message('PLANTÃO DE AMBULÂNCIA COMEÇOU','var(--gold)');
  startLevel(false);
  message(`NÍVEL 1: RESGATE ${needed} PACIENTE${needed>1?'S':''}`,'var(--gold)');
  blip([440,587,740],.08,'sine',.16);
}

function endDuty(text='PLANTÃO DE AMBULÂNCIA ENCERRADO',col='var(--cyan)'){
  clearPatients();
  clearHospMk();
  const summary=runRescues>0?` - ${runRescues} PACIENTES SALVOS`:'';
  // session over: counts toward the once-per-day lock
  markMiniGamePlayed(game.id);
  phase='off';onboard=0;needed=0;timeLeft=0;
  game.end(); // libera a trava do mundo
  hideMedHud();
  message(text+summary,col);
}

function loadPatient(p: Patient){
  if(p.g.parent)scene.remove(p.g);
  if(p.ring){scene.remove(p.ring);p.beacon!.dispose();p.ring=p.beacon=null;}
  p.loaded=true;
  onboard++;
  blip([587,784],.07,'sine',.15);
  message(`PACIENTE ${onboard}/${needed} A BORDO`,'var(--cyan)');
  if(onboard>=needed){
    // todos a bordo: abre a entrega no hospital
    hospMk=spawnMarker(0x19e3ff,dropX,dropZ);
    phase='hospital';
    message('LEVE TODOS PARA O HOSPITAL','var(--gold)');
    blip([659,880],.08,'sine',.16);
  }
  updateMedHud();
}

function deliver(){
  const reward=Math.min(REWARDS.paramedic.maxReward,REWARDS.paramedic.perPatient*onboard+REWARDS.paramedic.perLevel*level);
  economy.earn(reward,'paramedic');
  runRescues+=onboard;
  clearHospMk();
  clearPatients();
  message(`PACIENTES ENTREGUES +R$${reward}`,'var(--gold)');
  bigText('PACIENTES ENTREGUES','var(--gold)');
  setTimeout(hideBig,1400);
  blip([523,659,784,1047],.09,'sine',.18);
  level++;
  startLevel(false);
  message(`NÍVEL ${level}: RESGATE ${needed} PACIENTE${needed>1?'S':''}`,'var(--gold)');
}

function timeout(){
  message('PACIENTES PERDIDOS - ACABOU O TEMPO','var(--pink)');
  blip([220,165,110],.12,'sawtooth',.16);
  // Keep the session alive (do NOT call endDuty/game.end): the player is still in
  // the ambulance, so ending here would re-open the briefing overlay
  // every timeout. Mirror taxi/vigilante: reset to level 1 and respawn in place.
  clearPatients();
  clearHospMk();
  level=1;
  startLevel(false);
  message(`NÍVEL 1: RESGATE ${needed} PACIENTE${needed>1?'S':''}`,'var(--gold)');
}

// ----- ambulância destruída: reaparece no ponto do hospital -----
function resetAmbulance(){
  amb.speed=0;amb.sinkT=0;amb.heading=bay.h;
  amb.g.userData.bulletHits=0;
  amb.g.position.set(bay.x,groundHeight(bay.x,bay.z),bay.z);
  amb.g.rotation.set(0,bay.h,0);
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
    ?'<div class="med-row"><span>AO HOSPITAL</span><b>ENTREGAR</b></div>'
    :'<div class="med-row"><span>AO HOSPITAL</span><b>--</b></div>';
  medHud.innerHTML=`
    <div class="med-label">RESGATE</div>
    <div class="med-main"><span>NÍVEL</span><b>${level}</b></div>
    <div class="med-row"><span>A BORDO</span><b>${onboard}/${needed}</b></div>
    ${rowState}
    <div class="med-meter"><i style="width:${pct}%"></i></div>`;
}

export function updateParamedic(dt: number){
  // ambulância destruída: reaparece no ponto do hospital depois de um tempo
  if(!amb.g.parent&&cur!==amb){
    wreckT+=dt;
    if(wreckT>REWARDS.paramedic.wreckRespawnSec){
      wreckT=0;resetAmbulance();
      scene.add(amb.g);
      if(!idleCars.includes(amb))idleCars.push(amb);
      message('UMA NOVA AMBULÂNCIA ESPERA NO HOSPITAL','var(--cyan)');
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
