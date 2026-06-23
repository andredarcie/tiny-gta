import * as THREE from 'three';
import {N,nodeX,rand,irand,pick,ROAD,clamp} from '@/core/constants.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {state,refs,saveBest} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {makeCar,makePed,animatePed,shirtColors} from '@/core/entities.ts';
import {Npc} from '@/actors/npc.ts';
import {idleCars,cur,playerPos} from '@/actors/player.ts';
import {parks} from '@/world/world.ts';
import {makeMarkerRing} from '../../assets/models/missions/marker-ring.ts';
import {Beacon} from '@/core/beacon.ts';
import {message} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.ts';
import type {Blip} from '@/core/types.ts';

// Current ride: the passenger + origin/destination + payment and deadline. Extends
// Npc (so 100% of NPCs share the base class) with register:false — fares ride in
// your cab, they are not weapon targets. `ped` aliases the base `g` for the code below.
class Fare extends Npc{
  x: number; z: number;
  dropX: number; dropZ: number;
  ring?: THREE.Mesh|null;
  beacon?: Beacon|null;
  pay: number; tip: number;
  rideStart: number; deadline: number;
  constructor(ped: THREE.Object3D,x: number,z: number){
    super(ped,{kind:'fare',hp:1,register:false,area:'Taxi passenger'});
    this.x=x;this.z=z;this.dropX=0;this.dropZ=0;
    this.pay=0;this.tip=0;this.rideStart=0;this.deadline=0;
  }
  get ped(): THREE.Object3D{return this.g;}
  override aliveState():string{return 'Riding the cab';}
}
// A just-dropped-off passenger walking away (carries its Npc so it leaves the
// census once it has wandered off and is removed).
interface LeavingPed{g: THREE.Object3D; npc: Fare; t: number; bob: number; h: number;}

// Minigame de táxi estilo Open-world: um táxi amarelo fica estacionado na rua ao
// lado de uma praça. Entrou nele, começa o expediente: sempre tem um
// passageiro acenando em algum canto da cidade — pare do lado que ele
// embarca (e fica sentado no banco do carona, visível pelo vidro), leve até
// o marcador e ele desce pagando a corrida. Emenda corridas sem limite;
// sair do táxi encerra o expediente.

const TAXI_BUILD=' ◆ CAB HUSTLE';
document.getElementById('buildver')?.insertAdjacentText('beforeend',TAXI_BUILD);

const standKey=[...parks][0]||'4_4';
const[standI,standJ]=standKey.split('_').map(Number);
const stand={
  x:nodeX(standI)+3.5,
  z:nodeX(standJ)+ROAD/2+10,
  heading:0,
};

export const taxi: any={g:makeCar(0xffd24a,false),heading:stand.heading,speed:0,
  name:'TAXI CAB',police:false,taxi:true};
{
  // letreiro TAXI no teto (base escura + caixa amarela acesa)
  const base=new THREE.Mesh(new THREE.BoxGeometry(.78,.06,.44),
    new THREE.MeshStandardMaterial({color:0x14161a,roughness:.6}));
  base.position.set(0,1.42,-.2);taxi.g.add(base);
  const sign=new THREE.Mesh(new THREE.BoxGeometry(.7,.24,.36),
    new THREE.MeshBasicMaterial({color:0xfff0a0}));
  sign.position.set(0,1.56,-.2);taxi.g.add(sign);
  // estacionado na rua que margeia a primeira praça sorteada
  taxi.g.position.set(stand.x,0,stand.z);
  taxi.g.rotation.y=taxi.heading;
  idleCars.push(taxi);
}

let phase='off'; // off | pickup (passageiro acenando) | ride (a bordo)
let fare: Fare|null=null;   // {ped,x,z,dropX,dropZ,ring,beacon,pay,tip,rideStart,deadline}
const leaving: LeavingPed[]=[];// passageiros recém-desembarcados indo embora a pé
let wreckT=0;    // táxi destruído: volta pro ponto depois de um tempo
let shiftFares=0,shiftEarnings=0,shiftStartedAt=0;
const taxiHud=document.getElementById('taxihud');

// mini game (sessão): trava o mundo durante o expediente; o alvo é o passageiro
// (fase pickup) ou o destino da corrida (fase ride)
const game=new MiniGame({id:MiniGameId.TAXI,name:'Cab Hustle',
  blips:(): Blip[]=>{
    if(phase==='pickup'&&fare)
      return[{x:fare.x,z:fare.z,icon:'person',color:'#5eff8a',label:'PASSENGER',current:true,reveal:false}];
    if(phase==='ride'&&fare)
      return[{x:fare.dropX,z:fare.dropZ,icon:'flag',color:'#5eff8a',label:'DROP OFF',current:true,reveal:false}];
    return[];
  }});

// blip verde no radar: táxi livre, passageiro ou destino da corrida atual
refs.taxiTarget=()=>{
  if(phase==='pickup'&&fare)return{x:fare.x,z:fare.z,kind:'pickup'};
  if(phase==='ride'&&fare)return{x:fare.dropX,z:fare.dropZ,kind:'dropoff'};
  if(phase==='off'&&taxi.g.parent&&cur!==taxi)
    return{x:taxi.g.position.x,z:taxi.g.position.z,kind:'taxi'};
  return null;
};
refs.isTaxiCar=(c: any)=>c===taxi;
refs.getTaxiState=()=>({
  phase,
  fares:shiftFares,
  earnings:shiftEarnings,
  shiftTime:phase==='off'?0:Math.max(0,state.time-shiftStartedAt),
  target:refs.taxiTarget(),
  timeLeft:phase==='ride'&&fare?Math.max(0,fare.deadline-state.time):null,
  tip:currentTip(),
  active:phase!=='off',
});

function pickSpot(minD: number,fx: number,fz: number): [number, number]{
  // Sample candidate spots and return the first that is at least minD away.
  // If none clears the threshold within the try budget, return the FARTHEST
  // sampled candidate (not the last one), so pickup->dropoff stays as far
  // apart as the samples allow and trivial near-zero-distance fares can't occur.
  let bestX=0,bestZ=0,bestD=-1;
  for(let tries=0;tries<30;tries++){
    const x=nodeX(irand(0,N))+rand(-3.5,3.5),z=nodeX(irand(0,N))+rand(-3.5,3.5);
    const d=Math.hypot(x-fx,z-fz);
    if(d>=minD)return[x,z];      // good enough, take it immediately
    if(d>bestD){bestD=d;bestX=x;bestZ=z;} // track the farthest fallback
  }
  return[bestX,bestZ];
}

function setMarker(x: number,z: number){
  const ring=makeMarkerRing(0x5eff8a);
  ring.rotation.x=Math.PI/2;ring.position.set(x,.4,z);scene.add(ring);
  const beacon=new Beacon(0x5eff8a).at(x,z).mount();
  fare!.ring=ring;fare!.beacon=beacon;
}

function clearMarker(){
  if(fare?.ring){scene.remove(fare.ring);fare.beacon!.dispose();fare.ring=fare.beacon=null;}
}

function currentTip(){
  if(phase!=='ride'||!fare)return 0;
  const span=Math.max(.1,fare.deadline-fare.rideStart);
  return Math.round(fare.tip*clamp((fare.deadline-state.time)/span,0,1));
}

function hideTaxiHud(){
  if(!taxiHud)return;
  taxiHud.classList.remove('show','pickup','ride');
}

function updateTaxiHud(){
  if(!taxiHud)return;
  if(phase==='off'||!fare){hideTaxiHud();return;}
  taxiHud.classList.add('show');
  taxiHud.classList.toggle('pickup',phase==='pickup');
  taxiHud.classList.toggle('ride',phase==='ride');
  if(phase==='pickup'){
    const d=Math.hypot(taxi.g.position.x-fare.x,taxi.g.position.z-fare.z);
    taxiHud.innerHTML=`
      <div class="taxi-label">CAB</div>
      <div class="taxi-main"><span>PICK</span><b>${Math.ceil(d)}m</b></div>`;
  }else{
    const d=Math.hypot(taxi.g.position.x-fare.dropX,taxi.g.position.z-fare.dropZ);
    const span=Math.max(.1,fare.deadline-fare.rideStart);
    const pct=Math.round(clamp((fare.deadline-state.time)/span,0,1)*100);
    taxiHud.innerHTML=`
      <div class="taxi-label">CAB</div>
      <div class="taxi-main"><span>DROP</span><b>${Math.ceil(d)}m</b></div>
      <div class="taxi-meter"><i style="width:${pct}%"></i></div>`;
  }
}

function resetTaxiCar(){
  taxi.speed=0;taxi.sinkT=0;taxi.heading=stand.heading;
  taxi.g.userData.bulletHits=0;
  taxi.g.position.set(stand.x,0,stand.z);
  taxi.g.rotation.set(0,taxi.heading,0);
  for(const d of taxi.g.userData.doors||[])d.rotation.y=0;
}

// pose sentada de carona: pernas dobradas, mãos no colo (sem volante)
function seatPassengerPose(g: THREE.Object3D){
  const l=g.userData.limbs;if(!l)return;
  l.leftLeg.rotation.set(-2.0,0,0);l.rightLeg.rotation.set(-2.0,0,0);
  l.leftCalf?.rotation.set(.5,0,0);l.rightCalf?.rotation.set(.5,0,0);
  l.leftArm.rotation.set(-.6,0,.15);l.rightArm.rotation.set(-.6,0,-.15);
  l.leftForearm?.rotation.set(-.5,0,0);l.rightForearm?.rotation.set(-.5,0,0);
}

function unseatPose(g: THREE.Object3D){
  const l=g.userData.limbs;if(!l)return;
  for(const k of['leftArm','rightArm','leftForearm','rightForearm',
    'leftLeg','rightLeg','leftCalf','rightCalf'])l[k]?.rotation.set(0,0,0);
}

function spawnFare(announce=true){
  const pp=playerPos();
  const[x,z]=pickSpot(70,pp.x,pp.z);
  const ped=makePed(pick(shirtColors));
  ped.position.set(x,0,z);
  ped.rotation.y=Math.random()*Math.PI*2;
  // makePed already added the ped to the scene; boardFare reparents it into the cab
  fare=new Fare(ped,x,z);
  setMarker(x,z);
  phase='pickup';
  if(announce)message('PICK UP THE FARE','var(--gold)');
  updateTaxiHud();
}

function boardFare(){
  clearMarker();
  const ped=fare!.ped;
  ped.rotation.set(0,0,0);
  seatPassengerPose(ped);
  ped.position.set(.38,-.52,-.15); // banco do carona, ao lado do jogador
  taxi.g.add(ped); // reparenta da cena pro carro: anda junto, visível pelo vidro
  const[dx,dz]=pickSpot(80,fare!.x,fare!.z);
  fare!.dropX=dx;fare!.dropZ=dz;
  const dist=Math.hypot(dx-fare!.x,dz-fare!.z);
  // Base pay scales with the REAL pickup->dropoff distance so trivial fares
  // pay little. Small flat floor ($6) keeps the shortest fares worthwhile but
  // far below the old guaranteed ~$28, killing the chain-short-fares exploit.
  // Tip stays distance-scaled and is paid out via the time-decaying currentTip().
  fare!.pay=Math.round(REWARDS.taxi.baseFare+dist*REWARDS.taxi.farePerMeter); // longer rides pay much more
  fare!.tip=Math.round(REWARDS.taxi.baseTip+dist*REWARDS.taxi.tipPerMeter);
  fare!.rideStart=state.time;
  fare!.deadline=state.time+clamp(REWARDS.taxi.deadlineBaseSec+dist/REWARDS.taxi.deadlinePerMeterDiv,REWARDS.taxi.deadlineMinSec,REWARDS.taxi.deadlineMaxSec);
  setMarker(dx,dz);
  phase='ride';
  message(`TAKE THE FARE TO THE MARKER - TIP $${fare!.tip}`,'var(--gold)');
  blip([440,550],.07,'sine',.14);
  updateTaxiHud();
}

// desce do carro (fim de corrida ou expediente encerrado) e vai embora a pé
function dropPassenger(){
  const f=fare!;
  const ped=f.ped;
  taxi.g.remove(ped);
  unseatPose(ped);
  const h=taxi.heading;
  ped.position.copy(taxi.g.position)
    .add(new THREE.Vector3(Math.cos(h)*2,0,-Math.sin(h)*2)); // sidewalk on the right
  ped.rotation.set(0,h+Math.PI/2,0);
  scene.add(ped);
  leaving.push({g:ped,npc:f,t:0,bob:0,h:ped.rotation.y}); // keep the Npc so it leaves the census on removal
}

function endShift(text='CAB SHIFT ENDED',col='var(--cyan)'){
  if(phase==='pickup'&&fare){clearMarker();fare.despawn();} // removes the waiting fare from the scene + census
  else if(phase==='ride'&&fare){clearMarker();dropPassenger();}
  // ranking: o expediente inteiro conta como UMA sessão (ganho = total da corrida)
  reportMiniGameResult(game.id,{won:shiftFares>0,score:shiftEarnings});
  fare=null;phase='off';
  game.end(); // libera a trava do mundo
  hideTaxiHud();
  const summary=shiftFares>0?` - ${shiftFares} FARES / $${shiftEarnings}`:'';
  message(text+summary,col);
}

function startShift(){
  if(!game.begin())return; // outra sessão de mini game rolando: não começa
  shiftFares=0;shiftEarnings=0;shiftStartedAt=state.time;
  spawnFare(false);
  message('CAB SHIFT STARTED - PICK UP THE FARE','var(--gold)');
  blip([523,659],.08,'sine',.16);
}

function failRide(){
  clearMarker();
  dropPassenger();
  fare=null;
  message('FARE LOST - TOO SLOW','var(--pink)');
  blip([196,146,110],.1,'sawtooth',.14);
  spawnFare(false);
}

function completeRide(){
  const tip=currentTip();
  const paid=Math.min(REWARDS.taxi.maxFare,fare!.pay+tip);
  clearMarker();
  dropPassenger();
  economy.earn(paid,'taxi');
  state.taxiFares++;
  state.taxiEarnings+=paid;
  shiftFares++;
  shiftEarnings+=paid;
  saveBest();
  message(tip>0?`FARE PAID +$${paid} - SPEED TIP!`:`FARE PAID +$${paid}`,'var(--gold)');
  blip([523,659,784,1047],.09,'sine',.18);
  fare=null;
  spawnFare(false); // expediente contínuo: já tem outro passageiro esperando
}

export function updateTaxi(dt: number){
  // passageiro desembarcado caminha alguns passos e some
  for(let i=leaving.length-1;i>=0;i--){
    const p=leaving[i];
    p.t+=dt;p.bob+=dt*8;
    p.g.position.x+=Math.sin(p.h)*1.6*dt;
    p.g.position.z+=Math.cos(p.h)*1.6*dt;
    animatePed(p.g,p.bob,.5);
    if(p.t>3.5){p.npc.despawn();leaving.splice(i,1);} // despawn clears the scene + census

  }
  // táxi destruído: reaparece no ponto da praça depois de um tempo
  if(!taxi.g.parent&&cur!==taxi){
    wreckT+=dt;
    if(wreckT>REWARDS.taxi.wreckRespawnSec){
      wreckT=0;resetTaxiCar();
      scene.add(taxi.g);
      if(!idleCars.includes(taxi))idleCars.push(taxi);
      message('A NEW CAB IS WAITING BY THE PLAZA','var(--cyan)');
    }
  }

  const driving=state.mode==='car'&&cur===taxi;
  if(phase==='off'){
    // pegou o táxi: começa o expediente
    if(driving)startShift();
    return;
  }
  if(!driving){endShift();return;} // saiu do táxi (ou WASTED/BUSTED): encerra

  if(phase==='pickup'){
    const ped=fare!.ped;
    // acenando pro táxi (braço pra cima balançando)
    const l=ped.userData.limbs;
    if(l){l.rightArm.rotation.x=-2.7;l.rightArm.rotation.z=Math.sin(state.time*7)*.18;}
    const d=Math.hypot(taxi.g.position.x-fare!.x,taxi.g.position.z-fare!.z);
    if(d<26)ped.rotation.y=Math.atan2(taxi.g.position.x-fare!.x,taxi.g.position.z-fare!.z);
    if(d<3.4&&Math.abs(taxi.speed)<1.5)boardFare(); // parou do lado: embarca
  }else{ // ride
    if(state.time>=fare!.deadline){failRide();return;}
    const d=Math.hypot(taxi.g.position.x-fare!.dropX,taxi.g.position.z-fare!.dropZ);
    if(d<3.4&&Math.abs(taxi.speed)<1.5){
      completeRide();
    }
  }
  // marcador pulsando (mesmo efeito do marcador de entrega)
  if(fare?.ring){
    fare.ring.rotation.z+=2*dt;
    const sc=1+Math.sin(state.time*4)*.12;fare.ring.scale.set(sc,sc,1);
  }
  updateTaxiHud();
}
