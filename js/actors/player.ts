import * as THREE from 'three';
import {clamp,rand,nodeX,SWIM_BOUND,groundHeight,
  isLand,BOAT_SPAWN_X,BOAT_SPAWN_Z} from '@/core/constants.js';
import {state,input,carNames,carColors,refs} from '@/core/state.js';
import {economy} from '@/core/economy.js';
import {scene,camera} from '@/core/engine.js';
import {makeCar,makeMotorcycle,makeBoat,makePed,makePlayerPed,makePlane,spinWheels,dentCar} from '@/core/entities.js';
import * as Entities from '@/core/entities.js';
import {makeWakePuff} from '../../assets/models/effects/boat-wake.js';
import {makeSmokePuff} from '../../assets/models/effects/smoke-puff.js';
import {makeRcController} from '../../assets/models/props/rc-controller.js';
import {buildCarInteriorFp} from '../../assets/models/vehicles/car-interior-fp.js';
import {makeTractor} from '../../assets/models/vehicles/tractor.js';
import {SEAT_OFFSET,poseRider} from '@/actors/vehicle-pose.js';
import {thud,blip,splash} from '@/audio/audio.js';
import {radioOn,radioOff,radioEnter} from '@/ui/radio.js';
import {collideStatics,addWanted} from '@/core/physics.js';
import {message,bigText,hideBig,hudCar} from '@/ui/hud.js';
import type {Vehicle} from '@/core/types.js';

// The player ped wrapper: the on-foot/swimming avatar plus its swim physics state.
interface Player{
  g:THREE.Object3D;
  heading:number;
  bob:number;
  swimVX:number;
  swimVZ:number;
  swimPose:number;
  stroke:number;
  cadence:number;
  lastHalf:number;
}

// The orbit/first-person camera rig (yaw/pitch + look tuning).
interface CameraRig{
  yaw:number;
  pitch:number;
  fpPitch:number;
  sensitivity:number;
  invertY:boolean;
  shoulder:number;
  touchLookIdle:number;
}

// O JOGADOR nunca projeta sombra (pedido: a sombra seguindo fica estranha) — some
// permanentemente nas meshes do ped.
function noShadow(g:THREE.Object3D){g.traverse(o=>{if((o as THREE.Mesh).isMesh)(o as THREE.Mesh).castShadow=false;});}

// Liga/desliga a sombra de um veículo inteiro, LEMBRANDO quais meshes projetavam
// (vidro/detalhes que nunca projetam não voltam a projetar por engano). Usado só
// no veículo que o jogador está dirigindo: enquanto pilota, sem sombra; ao largar,
// a sombra volta (volta a ser um carro/moto parado normal).
function setVehicleShadow(g:THREE.Object3D,on:boolean){
  g.traverse(o=>{
    if(!(o as THREE.Mesh).isMesh)return;
    if(on){if(o.userData.castOrig)(o as THREE.Mesh).castShadow=true;}
    else if((o as THREE.Mesh).castShadow){o.userData.castOrig=true;(o as THREE.Mesh).castShadow=false;}
  });
}
// Sincroniza por frame: a sombra some só do carro/moto atualmente dirigido (não do
// avião/lancha — a sombra deles no chão/água é útil/inofensiva). Chamado em main.js.
let shadowless:THREE.Object3D|null=null;
export function updateDrivenShadow(){
  const g=(cur&&!cur.plane&&!cur.boat)?cur.g:null;
  if(g===shadowless)return;
  if(shadowless)setVehicleShadow(shadowless,true); // largou o veículo: sombra volta
  if(g)setVehicleShadow(g,false);                  // assumiu o volante: sombra some
  shadowless=g;
}

// Campos de nado (ver updateSwim): velocidade própria com inércia, mistura de
// pose boiando↔crawl, fase/cadência da braçada e marcador da última braçada.
export const player:Player={g:makePlayerPed(0x19e3ff),heading:0,bob:0,
  swimVX:0,swimVZ:0,swimPose:0,stroke:0,cadence:2.4,lastHalf:0};
player.g.position.set(nodeX(4)+9,0,nodeX(4)+9);
noShadow(player.g); // jogador sempre sem sombra (a pé ou dirigindo)
document.getElementById('buildver')?.insertAdjacentText('beforeend',' ◆ CAM-R ◆ BIKE');
export const cameraRig:CameraRig={
  yaw:player.heading,
  pitch:.34,
  fpPitch:0,        // first-person look pitch (rad): +down / -up after the sign flip below
  sensitivity:.0024,
  invertY:false,
  shoulder:.28,
  touchLookIdle:0,
};

export const playerCar:Vehicle={g:makeCar(0xff2e88,false),heading:Math.PI/2,speed:0,name:'PINK COMET',police:false};
playerCar.g.position.set(nodeX(4)+3.5,0,nodeX(4)+16);
playerCar.g.rotation.y=playerCar.heading;
export const idleCars:Vehicle[]=[playerCar];

// Motos estacionadas pela cidade: veículos livres como o playerCar (`bike`).
// Montar/descer é direto (sem porta), o piloto fica visível por cima inclinando
// nas curvas. A pose/offset de quem monta vive em vehicle-pose.js (poseRider),
// junto com a da lancha e do avião. Ver o flag bike em completeEnter/updateCar.
function spawnBike(color:number,name:string,x:number,y:number,z:number,heading:number):Vehicle{
  const b:Vehicle={g:makeMotorcycle(color),heading,speed:0,name,police:false,bike:true};
  b.g.position.set(x,y,z);b.g.rotation.y=heading;
  idleCars.push(b);
  return b;
}
// uma ao lado do carro inicial; outra num cruzamento (sempre asfalto livre)
spawnBike(0xd11f3a,'STREET ROCKET',nodeX(4)+3.5,0,nodeX(4)+10,Math.PI/2);
spawnBike(0x18b0a6,'NEON BLADE',nodeX(5),0,nodeX(5),0);
// a getaway bike waiting in the fort courtyard, by where the escape tunnel surfaces
{const b=spawnBike(0x8a3b2a,'FORT RUNNER',600,0,84,Math.PI);b.g.position.y=groundHeight(600,84);}

export let cur:Vehicle|null=null;

// Avião estacionado na praia oeste; a faixa de areia é a pista de decolagem
export function spawnPlane():Vehicle{
  const pl:Vehicle={g:makePlane(),heading:Math.PI,speed:0,name:'CROP HOPPER',police:false,
    plane:true,vy:0};
  pl.g.position.set(-202,0,40);pl.g.rotation.y=pl.heading;
  idleCars.push(pl);
  return pl;
}
spawnPlane();

// Lancha ancorada no mar ao sul da praia: anda só sobre a água (encalha na areia).
// É um veículo livre como a moto/avião; o flag `boat` define a física em updateBoat.
function spawnBoat(color:number,name:string,x:number,z:number,heading:number):Vehicle{
  const b:Vehicle={g:(makeBoat as any)(color),heading,speed:0,name,police:false,boat:true,bobT:Math.random()*6};
  b.g.position.set(x,0,z);b.g.rotation.y=heading;
  idleCars.push(b);
  return b;
}
spawnBoat(0xff5a3c,'SEA BLASTER',BOAT_SPAWN_X,BOAT_SPAWN_Z,Math.PI);

// Tractor parked out at the rural farms (east of the city). A slow, chunky utility
// vehicle (flag `tractor`): car-style physics but low top speed, open seat (rider
// posed via vehicle-pose.js), and it never dents/explodes. Only one, only out here.
function spawnTractor(x:number,z:number,heading:number):Vehicle{
  const t:Vehicle={g:makeTractor(),heading,speed:0,name:'FIELD MULE',police:false,tractor:true};
  t.g.position.set(x,groundHeight(x,z),z);t.g.rotation.y=heading;
  idleCars.push(t);
  return t;
}
spawnTractor(398,40,Math.PI/2);
spawnTractor(630,-12,0);  // a second one parked by the rural village (Pine Hollow), clear of the town sign

export function playerPos():THREE.Vector3{return state.mode==='car'?cur!.g.position:player.g.position;}

// ===== Dano progressivo do carro do jogador: bate -> amassa feio; bate de novo
// -> solta fumaça; bate mais -> explode. Tudo barato: o contador/timer mora no
// userData do carro, o amassado reusa o dentCar (sem geometria nova por batida)
// e a fumaça é um POOL de baforadas recicladas (zero alocação por frame). =====
const SMOKE_CRASHES=2;   // 2ª batida: motor começa a fumegar
const HEAVY_CRASHES=3;   // 3ª batida: fumaça densa (prestes a explodir)
const EXPLODE_CRASHES=4; // 4ª batida: pega fogo e explode
const CRASH_CD=.7;       // debounce: roçar na parede conta como UMA batida só

interface Smoke{g:THREE.Mesh;t:number;life:number;vx:number;vy:number;vz:number;s0:number;s1:number;}
const smoke:Smoke[]=[];      // baforadas ativas {g,t,life,vx,vy,vz,s0,s1}
const smokePool:THREE.Mesh[]=[];  // baforadas recicláveis (já na cena, invisíveis)
let smokeTimer=0;
function spawnSmoke(x:number,y:number,z:number,grow:number){
  const g=smokePool.pop()||makeSmokePuff();
  if(!g.parent)scene.add(g);
  g.position.set(x+rand(-.3,.3),y,z+rand(-.3,.3));
  const s0=.25,s1=.9+grow*.7;
  g.scale.setScalar(s0);(g.material as THREE.Material).opacity=0;g.visible=true;
  smoke.push({g,t:0,life:rand(1.0,1.5),vx:rand(-.4,.4),vy:rand(.9,1.5),
    vz:rand(-.4,.4),s0,s1});
}
// Chamado todo frame (main.js). Emite do capô do carro DIRIGIDO se ele estiver
// danificado, e anima as baforadas em voo (continuam mesmo depois de sair/morrer).
export function updateCarFx(dt:number){
  if(cur&&!cur.bike&&!cur.boat&&!cur.plane){
    const n=cur.g.userData.crashCount||0;
    if(n>=SMOKE_CRASHES){
      smokeTimer-=dt;
      if(smokeTimer<=0){
        smokeTimer=n>=HEAVY_CRASHES?.10:.22; // mais batido = mais fumaça
        const p=cur.g.position,h=cur.heading;
        spawnSmoke(p.x+Math.sin(h)*1.8,p.y+.8,p.z+Math.cos(h)*1.8,n-SMOKE_CRASHES);
      }
    }
  }
  for(let i=smoke.length-1;i>=0;i--){
    const s=smoke[i];s.t+=dt;const k=s.t/s.life;
    s.g.position.x+=s.vx*dt;s.g.position.y+=s.vy*dt;s.g.position.z+=s.vz*dt;
    s.vy*=Math.exp(-1.4*dt); // sobe e desacelera
    s.g.scale.setScalar(s.s0+(s.s1-s.s0)*k);
    (s.g.material as THREE.Material).opacity=Math.min(1,k*5)*(1-k)*.55; // surge e desbota
    if(k>=1){s.g.visible=false;smokePool.push(s.g);smoke.splice(i,1);}
  }
}

// Zera o dano acumulado de um carro (a oficina chama isto ao reparar o lataria)
export function resetCarDamage(g:THREE.Object3D|null|undefined){
  if(!g)return;const ud=g.userData;ud.crashCount=0;ud.crashCd=0;
}

// O carro DIRIGIDO explode: efeito + onda de choque (mata/empurra ao redor e
// pode detonar carros vizinhos em cadeia), tira o destroço da cena e mata o
// jogador (acorda no hospital). Devolve true pro updateCar abortar o frame.
function explodePlayerCar():boolean{
  const g=cur!.g,pos=g.position.clone();
  refs.explodeAt?.(pos); // enquanto cur ainda é válido (a onda de choque usa)
  scene.remove(g);
  resetCarDamage(g);
  g.userData.driver=null;
  cur=null;            // wastedCut não devolve o destroço pra idleCars
  state.shake=1;
  getWasted();         // dentro de veículo -> corte WASTED direto
  return true;
}

// Uma batida do carro do jogador: amassa BEM mais que um carro qualquer e, por
// debounce, conta como evento único. Escala: dent maior -> fumaça -> explosão.
// Devolve true se o carro foi destruído (o chamador deve abortar o frame).
function registerCrash(speed:number,pt:THREE.Vector3,dir:THREE.Vector3):boolean{
  if(cur!.bike||cur!.tractor)return false; // moto/trator não amassam/explodem (só carro tem lataria)
  const ud=cur!.g.userData;
  // amassado bem maior: zona ampliada (radius) e afundando mais fundo (max),
  // crescendo com a velocidade do impacto
  dentCar(cur!.g,pt,dir,Math.min(.7,.34+speed*.012),{radius:2.2,max:.85});
  if((ud.crashCd||0)>0)return false; // ainda na mesma colisão: não conta de novo
  ud.crashCd=CRASH_CD;
  ud.crashCount=(ud.crashCount||0)+1;
  if(ud.crashCount>=EXPLODE_CRASHES)return explodePlayerCar();
  if(ud.crashCount===SMOKE_CRASHES)message('ENGINE DAMAGED!','var(--gold)');
  else if(ud.crashCount===HEAVY_CRASHES)message('ENGINE ON FIRE!','var(--pink)');
  return false;
}

const _dentPt=new THREE.Vector3(),_dentDir=new THREE.Vector3();
// Scratch vectors reaproveitados nos hot loops (evita alocar por frame).
// updateFoot: camF/camR/mv vivem juntos -> 3 instâncias distintas.
const _footF=new THREE.Vector3(),_footR=new THREE.Vector3(),_footMv=new THREE.Vector3();
// updateCamera: forward/right/focus/want vivem juntos -> 4 instâncias distintas.
const _camFwd=new THREE.Vector3(),_camRight=new THREE.Vector3(),_camFocus=new THREE.Vector3(),_camWant=new THREE.Vector3();
// First-person: eye position + look direction (live together -> 2 distinct instances).
const _fpEye=new THREE.Vector3(),_fpDir=new THREE.Vector3();

export function nearestCar(maxD:number):{c:Vehicle;kind:string}|null{
  let best:Vehicle|null=null,bd=maxD,kind:string|null=null;
  const pp=player.g.position;
  const traffic:Vehicle[]=refs.traffic||[];
  const cops:Vehicle[]=refs.cops||[];
  for(const c of idleCars){
    const d=pp.distanceTo(c.g.position);if(d<bd){bd=d;best=c;kind='idle';}
  }
  for(const t of traffic){
    const d=pp.distanceTo(t.g.position);if(d<bd){bd=d;best=t;kind='traffic';}
  }
  for(const c of cops){
    const d=pp.distanceTo(c.g.position);if(d<bd){bd=d;best=c;kind='cop';}
  }
  return best?{c:best,kind:kind!}:null;
}

// Pose de motorista do CARRO: sentado com as coxas pra frente, pés no piso, mãos
// no volante. Fica aqui (e não em vehicle-pose.js como moto/lancha/avião) porque
// spinWheels reescreve os braços do motorista sobre o volante a cada frame — o
// carro não dá pra posar uma vez e largar. setDrivePose(false) também é o reset
// neutro usado ao sair de QUALQUER veículo (zera todos os ossos dos membros).
function setDrivePose(on:boolean){
  const l=player.g.userData.limbs;if(!l)return;
  l.leftLeg.visible=l.rightLeg.visible=true; // pernas sempre visíveis (cabine é oca)
  if(on){
    l.leftLeg.rotation.set(-2.0,0,0);
    l.rightLeg.rotation.set(-2.0,0,0);
    l.leftCalf?.rotation.set(.5,0,0);
    l.rightCalf?.rotation.set(.5,0,0);
    // braços esticados à frente, mãos convergindo até tocar o aro do volante
    l.leftArm.rotation.set(-1.3,0,.42);
    l.rightArm.rotation.set(-1.3,0,-.42);
    l.leftForearm?.rotation.set(-.78,0,0);
    l.rightForearm?.rotation.set(-.78,0,0);
  }else{
    for(const k of['leftArm','rightArm','leftForearm','rightForearm',
      'leftLeg','rightLeg','leftCalf','rightCalf'])l[k]?.rotation.set(0,0,0);
  }
}

// RC Toyz: the operator holds a remote controller while piloting the bandit. The
// controller is parented to the ped (fixed in front of the chest — the operator
// stands still) and both arms are posed gripping it. Built lazily and reused.
let rcController:THREE.Object3D|null=null;
function attachRemoteController(){
  if(!rcController){rcController=makeRcController();noShadow(rcController);} // match: player casts no shadow
  if(rcController.parent!==player.g)player.g.add(rcController);
  rcController.position.set(0,1.02,.36);
  rcController.rotation.set(-.45,0,0);
  rcController.visible=true;
  // pose: both arms forward, elbows bent, hands meeting at the controller; legs neutral
  const l=player.g.userData.limbs;if(!l)return;
  l.leftArm.rotation.set(-.7,0,.5);
  l.rightArm.rotation.set(-.7,0,-.5);
  l.leftForearm?.rotation.set(-1.0,0,-.3);
  l.rightForearm?.rotation.set(-1.0,0,.3);
  l.leftLeg.rotation.set(0,0,0);l.rightLeg.rotation.set(0,0,0);
  l.leftCalf?.rotation.set(0,0,0);l.rightCalf?.rotation.set(0,0,0);
}
function detachRemoteController(){
  if(rcController&&rcController.parent)rcController.parent.remove(rcController);
}

// Tira o jogador de dentro do veículo (reparenta na cena e desfaz a pose)
function unseatPlayer(){
  detachRemoteController(); // drop the RC controller if we were operating one
  scene.add(player.g);
  player.g.rotation.set(0,player.heading,0);
  setDrivePose(false);
}

// Entrar no carro é uma sequência: anda até a porta, ela abre, senta, fecha
interface Entering{f:{c:Vehicle;kind:string};door:THREE.Object3D|null;side:number;t:number;phase:number;}
let entering:Entering|null=null;
export function enterCar(){
  if(entering)return;
  const f=nearestCar(3.6);if(!f)return;
  // escolhe a porta do lado em que o jogador está (carro tem duas portas)
  const cg=f.c.g,h=f.c.heading??cg.rotation.y;
  const dx=player.g.position.x-cg.position.x,dz=player.g.position.z-cg.position.z;
  const side=(dx*Math.cos(h)-dz*Math.sin(h))>0?1:-1;
  const doors=cg.userData.doors;
  const door=doors?(side>0?doors[1]:doors[0]):cg.userData.door||null;
  entering={f,door,side,t:0,phase:0};
  state.controlsLocked=true;
  if(f.kind==='traffic')f.c.brakeT=1.8; // carro do tráfego espera parado
  blip([220],.06,'square',.1); // clique da maçaneta
}

export function cancelEntering(){
  if(entering){if(entering.door)entering.door.rotation.y=0;entering=null;}
  if(exiting){exiting.door.rotation.y=0;exiting=null;}
  state.controlsLocked=false;
}

function updateEntering(dt:number){
  const e=entering!;e.t+=dt;
  const car=e.f.c;
  if(e.phase===0){ // porta abrindo enquanto o jogador chega nela
    const k=Math.min(1,e.t/.4);
    if(e.door)e.door.rotation.y=(e.door.userData.sign||1)*1.15*k;
    const h=car.heading??car.g.rotation.y;
    const lx=e.side*1.25,lz=.35; // ponto ao lado da porta escolhida
    const wx=car.g.position.x+lx*Math.cos(h)+lz*Math.sin(h);
    const wz=car.g.position.z-lx*Math.sin(h)+lz*Math.cos(h);
    player.g.position.x+=(wx-player.g.position.x)*Math.min(1,10*dt);
    player.g.position.z+=(wz-player.g.position.z)*Math.min(1,10*dt);
    player.bob+=dt*8;Entities.animatePed?.(player.g,player.bob,.7);
    if(e.t>=.45){completeEnter(e.f);e.phase=1;e.t=0;}
  }else{ // sentado: porta fechando
    const k=Math.min(1,e.t/.35);
    if(e.door)e.door.rotation.y=(e.door.userData.sign||1)*1.15*(1-k);
    if(cur)cur.speed=0;
    if(k>=1){
      if(e.door)e.door.rotation.y=0;
      blip([180],.05,'square',.12); // porta bate
      entering=null;state.controlsLocked=false;
    }
  }
}

function completeEnter(f:{c:Vehicle;kind:string}){
  const{c,kind}=f;
  const traffic:Vehicle[]=refs.traffic||[];
  const cops:Vehicle[]=refs.cops||[];
  if(kind==='idle'){idleCars.splice(idleCars.indexOf(c),1);cur=c;}
  else if(kind==='traffic'){
    traffic.splice(traffic.indexOf(c),1);
    const p=refs.trafficPos({...c,t:c.t});
    cur={g:c.g,heading:Math.atan2(p.dx,p.dz),speed:0,name:c.name,police:false};
    refs.ejectDriver?.(c.g.position.x,c.g.position.z,cur.heading);
    addWanted(1,'STOLEN CAR!','vehicle_theft');refs.spawnTraffic?.();
  }else{
    cops.splice(cops.indexOf(c),1);
    cur={g:c.g,heading:c.heading,speed:0,name:'CRUISER 47',police:true};
    addWanted(2,'STOLEN POLICE CAR!','police_vehicle_theft');
  }
  // motorista NPC some do banco (o ejetado/fugitivo é tratado à parte)
  if(c.driver){c.g.remove(c.driver);c.driver=null;}
  state.mode='car';state.weaponHeld=false;
  // boarded a vehicle (e.g. a boat from the water): drop the swimming state so the
  // camera/pose aren't stuck in swim mode. Breath then recovers in updateBoat.
  if(state.swimming){
    state.swimming=false;
    player.swimVX=player.swimVZ=0;player.swimPose=0;
    player.g.rotation.order='XYZ';
  }
  // RC Toyz (remote-control toy): the player does NOT board it. Like the genre's classic RC
  // missions, they stay standing where they are — the "operator" by the pad — and
  // pilot the bandit from afar. The camera follows the car (updateCamera targets
  // cur.g), so the ped stays put in the scene: no reparent, no seat, no radio.
  if(cur.remote){
    player.g.rotation.set(0,player.heading,0);
    attachRemoteController();                 // stand holding the remote controller
    cameraRig.yaw=cur.heading;cameraRig.touchLookIdle=1;
    hudCar!.textContent=cur.name;hudCar!.style.display='block';
    blip([330,440],0.07,'triangle',.12);
    radioOff();
    return;
  }
  // jogador sentado no banco do motorista (carro: visível pelo vidro; moto: por cima)
  cur.g.add(player.g);
  if(cur.bike||cur.boat||cur.plane||cur.tractor){
    // Moto/lancha/avião/trator: piloto totalmente à vista. Offset (banco) + pose
    // (membros sobre os controles) vivem em vehicle-pose.js, casados com o corpo.
    // Não usam userData.driver (spinWheels não deve mexer nos braços posados); o
    // avião pode receber driver (não tem rodas esterçadas, então é inócuo).
    const kind=cur.bike?'bike':cur.boat?'boat':cur.plane?'plane':'tractor';
    if(cur.plane)cur.g.userData.driver=player.g;
    player.g.position.fromArray(SEAT_OFFSET[kind]);
    player.g.rotation.set(0,0,0);
    poseRider(player.g.userData.limbs,kind);
  }else{
    cur.g.userData.driver=player.g; // braços seguem o volante via spinWheels
    player.g.position.set(-.38,-.52,-.15); // sentado no banco do motorista
    player.g.rotation.set(0,0,0);
    setDrivePose(true);
  }
  // entrou no veículo: câmera já posicionada atrás dele (não nasce de lado/torta)
  cameraRig.yaw=cur.heading;cameraRig.touchLookIdle=1;
  hudCar!.textContent=cur.name;hudCar!.style.display='block';
  blip([330,440],0.07,'triangle',.12);
  // moto não tem rádio; carro/avião ligam a estação (exceto no overkill)
  if(cur.bike||refs.getOverkillState?.()?.active)radioOff();
  else{radioEnter();radioOn();}
}

// Sair também abre e fecha a porta (avião não tem porta: sai direto)
interface Exiting{t:number;phase:number;door:THREE.Object3D;}
let exiting:Exiting|null=null;
export function exitCar(){
  if(exiting||entering)return;
  if(cur!.plane&&cur!.g.position.y>groundHeight(cur!.g.position.x,cur!.g.position.z)+1.2){
    message('LAND BEFORE BAILING OUT!','var(--gold)');return;
  }
  cur!.speed=0;
  const door=cur!.g.userData.doors?.[0]||cur!.g.userData.door||null; // sai pela porta do motorista
  if(!door){completeExit();return;}
  exiting={t:0,phase:0,door};
  state.controlsLocked=true;
  blip([220],.06,'square',.1); // clique da maçaneta
}

function completeExit(){
  if(cur!.remote){
    // RC Toyz operator: never boarded, so just stop piloting and stay standing
    // right where we are (don't teleport beside the faraway bandit).
    detachRemoteController();
    setDrivePose(false);              // drop the controller grip, back to neutral
    cur!.g.userData.driver=null;
    player.g.visible=true;
    idleCars.push(cur!);
    cur=null;state.mode='foot';state.weaponHeld=!!state.hasGun;hudCar!.style.display='none';
    radioOff();
    return;
  }
  player.heading=cur!.heading;
  cur!.g.userData.driver=null;
  unseatPlayer();
  const right=new THREE.Vector3(Math.cos(cur!.heading),0,-Math.sin(cur!.heading));
  player.g.position.copy(cur!.g.position).addScaledVector(right,-2.0);
  collideStatics(player.g.position,.5,SWIM_BOUND);
  player.g.position.y=groundHeight(player.g.position.x,player.g.position.z);
  player.g.visible=true;
  // veículo abandonado afundando some no mar; os outros viram veículo parado
  if(cur!.sinkT){scene.remove(cur!.g);if(cur!.plane)spawnPlane();}
  else idleCars.push(cur!);
  cur=null;state.mode='foot';state.weaponHeld=!!state.hasGun;hudCar!.style.display='none';
  radioOff();
}

function updateExiting(dt:number){
  const e=exiting!;e.t+=dt;
  if(e.phase===0){ // porta abrindo, ainda sentado
    e.door.rotation.y=(e.door.userData.sign||1)*1.15*Math.min(1,e.t/.35);
    if(cur)cur.speed=0;
    if(e.t>=.4){completeExit();e.phase=1;e.t=0;}
  }else{ // já fora: porta fechando
    e.door.rotation.y=(e.door.userData.sign||1)*1.15*(1-Math.min(1,e.t/.35));
    if(e.t>=.4){
      e.door.rotation.y=0;
      blip([180],.05,'square',.12); // porta bate
      exiting=null;state.controlsLocked=false;
    }
  }
}

export const inWater=(p:{x:number;z:number})=>{
  if(state.interior)return false; // interiores ficam fora do mapa, mas são chão seco
  return !isLand(p.x,p.z);        // costa irregular da ilha (mesma fonte do visual)
};

export function startCut(text:string,col:string,fn:(()=>void)|null){
  state.mode='cut';state.cutT=2.6;state.cutFn=fn;bigText(text,col);
  if(cur)cur.speed=0;
}

export function getBusted(){
  if(dying)return; // morrendo não é preso
  refs.endOverkill?.(); // prisão também encerra o modo overkill na hora
  cancelEntering();
  startCut('BUSTED','#3e7bff',()=>{
    state.onRoof=null;roofFall=null; // presídio fica no chão, não no telhado
    state.wanted=0;state.bustT=0;
    refs.clearCops?.(); // viaturas, policiais a pé, mísseis e tracers
    refs.clearArmy?.(); // army truck + soldiers (★6)
    if(cur){cur.g.userData.driver=null;idleCars.push(cur);cur=null;}
    unseatPlayer();
    player.g.visible=true;
    state.mode='foot';hudCar!.style.display='none';radioOff();
    // Busted while carrying the weed delivery backpack: a crooked cop drives you
    // out to the woods and shakes you down for a bribe instead of booking you
    // (see js/drug-bust.js). The seized stash + the bribe are the price — no
    // booking happens, so no jail penalty and no weapon confiscation here.
    if(refs.isCarryingDrugs?.()){refs.startDrugBust();return;}
    economy.penalty(.85,'busted');
    refs.confiscateWeapon?.();
    if(refs.prisonAdmit)refs.prisonAdmit();
    else{player.g.position.set(nodeX(2)+4,0,nodeX(2)+4);message('YOU WERE RELEASED. BEHAVE.','var(--cyan)');}
  });
}

function wastedCut(){
  startCut('WASTED','#ff2e88',()=>{
    state.onRoof=null;roofFall=null;
    state.health=100; // wake up at the hospital fully healed
    // Hospital bill on death: a FIXED $100 fee (capped at the balance), not a
    // percentage of the wallet. The lost cash drops as a PUDDLE where the player fell
    // (Souls-like async multiplayer) that another online player can grab —
    // flatPenalty() returns the amount lost, which is what the puddle carries.
    refs.dropDeathPool?.(deathSpotX,deathSpotZ,economy.flatPenalty(100,'wasted'));
    state.wanted=0;state.bustT=0;
    refs.clearCops?.(); // viaturas, policiais a pé, mísseis e tracers
    refs.clearArmy?.(); // army truck + soldiers (★6)
    if(cur){cur.g.userData.driver=null;idleCars.push(cur);cur=null;} // larga o carro
    unseatPlayer();
    player.g.visible=true;
    state.weaponHeld=!!state.hasGun;
    state.mode='foot';hudCar!.style.display='none';radioOff();
    // acorda DENTRO do hospital (teleporta pra sala fora do mapa); tem que sair
    refs.hospitalAdmit?.();
  });
}

// Morte a pé: o corpo tomba de costas (rosto pra cima) com poça de sangue,
// como os NPCs; o letreiro WASTED só aparece depois do corpo no chão
let dying:{t:number;puddle:boolean}|null=null;
// Onde o jogador morreu (x,z): o multiplayer assíncrono (js/bloodstains.js) deixa
// aqui a "poça" com o dinheiro perdido na morte pra outro jogador online pegar.
let deathSpotX=0,deathSpotZ=0;
export function getWasted(){
  if(dying)return;
  {const dp=playerPos();deathSpotX=dp.x;deathSpotZ=dp.z;} // lembra o lugar da morte (poça)
  // morrer nadando: endireita a postura do nado antes da animação de queda
  if(state.swimming){
    state.swimming=false;state.swimAir=1;
    player.g.rotation.order='XYZ';player.g.rotation.x=0;player.g.rotation.z=0;
    player.swimVX=player.swimVZ=0;player.swimPose=0;
  }
  refs.endOverkill?.(); // morrer encerra o modo overkill (banca o resumo)
  cancelEntering();
  if(state.mode==='car'||cur)return wastedCut(); // dentro de veículo: corte direto
  dying={t:0,puddle:false};
  state.controlsLocked=true;
  state.weaponHeld=false;
  Entities.animatePed?.(player.g,0,0); // relaxa os membros antes de cair
  thud(10);
}

function updateDying(dt:number){
  const d=dying!;d.t+=dt;
  const k=Math.min(1,d.t/.45);
  // morrendo no telhado o corpo tomba na laje, não no asfalto lá embaixo
  const gh=state.onRoof?state.onRoof.y
    :groundHeight(player.g.position.x,player.g.position.z);
  player.g.rotation.x=-Math.PI/2*k; // mesma pose dos NPCs mortos
  player.g.position.y=gh+.35*k;
  if(k>=1&&!d.puddle){
    d.puddle=true;
    if(!state.onRoof)refs.addBloodPuddle?.(player.g.position.x,player.g.position.z);
  }
  if(d.t>1.5){dying=null;state.controlsLocked=false;wastedCut();}
}

// Queda do telhado: passou da borda do parapeito, despenca sem controle e
// morre no impacto com o chão (queda de prédio mata na hora)
interface RoofFall{vy:number;dx:number;dz:number;t:number;wx:number;wy:number;wz:number;}
let roofFall:RoofFall|null=null;
function startRoofFall(){
  // Seed a tumbling ragdoll: a forward-ish body spin (wx) plus random roll/yaw so
  // the body cartwheels off the edge and every limb goes loose on the way down.
  roofFall={vy:0,dx:Math.sin(player.heading)*2.4,dz:Math.cos(player.heading)*2.4,t:0,
    wx:2.6+Math.random()*2.4, wy:(Math.random()*2-1)*2.6, wz:(Math.random()*2-1)*3.4};
  state.controlsLocked=true;
  state.weaponHeld=false;
}
function updateRoofFall(dt:number){
  const p=player.g.position,rf=roofFall!;
  rf.t+=dt;
  rf.vy-=30*dt;
  p.x+=rf.dx*dt;p.z+=rf.dz*dt;p.y+=rf.vy*dt;
  collideStatics(p,.5,SWIM_BOUND); // escorrega pela fachada em vez de entrar nela
  // RAGDOLL: tumble the whole body and let every limb flop loosely (membros moles).
  const g=player.g;
  g.rotation.x+=rf.wx*dt;g.rotation.y+=rf.wy*dt;g.rotation.z+=rf.wz*dt;
  const L=g.userData.limbs;
  if(L){
    const tt=rf.t,jig=(k:number)=>Math.sin(tt*12+k)*.4; // fast, loose jiggle = limp/floppy
    L.rightArm&&L.rightArm.rotation.set(-1.3+jig(0),0,-.5+jig(1));
    L.leftArm&&L.leftArm.rotation.set(-1.3+jig(2),0,.5+jig(3));
    L.rightForearm&&L.rightForearm.rotation.set(-1+jig(4),0,0);
    L.leftForearm&&L.leftForearm.rotation.set(-1+jig(5),0,0);
    L.rightLeg&&L.rightLeg.rotation.set(.45+jig(6),0,-.3+jig(7)*.5);
    L.leftLeg&&L.leftLeg.rotation.set(.45+jig(8),0,.3+jig(9)*.5);
  }
  const gh=groundHeight(p.x,p.z);
  if(p.y<=gh){
    p.y=gh;roofFall=null;state.controlsLocked=false;
    g.rotation.x=0;g.rotation.z=0; // straighten the body before the death-on-ground anim
    thud(18);state.shake=.45;
    getWasted();
  }
}

const PMAX=55,VTO=22,PCEIL=130; // avião: velocidade máx, decolagem, teto

function wreckPlane(){
  thud(20);state.shake=.8;
  scene.remove(cur!.g);
  spawnPlane();
  getWasted();
}

function updatePlane(dt:number){
  const c=cur!,p=c.g.position;
  const prop=c.g.userData.prop;
  if(prop)prop.rotation.z+=(6+c.speed)*dt*4;
  // amerissagem: tocou a água = afunda, jogador sai nadando
  if(inWater(p)&&p.y<=.05){
    c.sinkT=(c.sinkT||0)+dt;
    if(c.sinkT<dt*1.5){message('YOUR PLANE IS SINKING!','var(--pink)');thud(8);}
    c.speed*=Math.exp(-2.4*dt);
    p.x+=Math.sin(c.heading)*c.speed*dt;
    p.z+=Math.cos(c.heading)*c.speed*dt;
    p.y=-Math.min(2.6,c.sinkT);
    c.g.rotation.x=Math.min(.22,c.sinkT*.1);
    if(c.sinkT>2.1){
      scene.remove(c.g);
      player.heading=c.heading;unseatPlayer();
      player.g.position.set(p.x,0,p.z);
      player.g.visible=true;
      cur=null;state.mode='foot';state.weaponHeld=!!state.hasGun;
      hudCar!.style.display='none';radioOff();
      spawnPlane();
      message('SWIM BACK TO SHORE!','var(--cyan)');
    }
    return;
  }
  const th=input.moveY,st=input.moveX,hb=input.brake;
  const gh=groundHeight(p.x,p.z);
  const onGround=p.y<=gh+.06;
  // empuxo e arrasto
  if(th>0)c.speed+=(onGround?16:9)*dt*Math.max(.2,1-c.speed/PMAX);
  else if(th<0&&onGround)c.speed-=24*dt;
  // arrasto de solo baixo: a velocidade de equilíbrio fica BEM acima da de decolagem
  c.speed*=Math.exp(-(onGround?(hb?2.2:.12):.05)*dt);
  c.speed=clamp(c.speed,onGround?-6:0,PMAX);
  // guinada: taxi como carro; no ar, curva inclinada
  const turn=onGround?1.6*clamp(c.speed/11,-1,1):1.05*clamp(c.speed/32,0,1.15);
  c.heading+=st*turn*dt;
  // sustentação: só acima da velocidade de decolagem; no ar W sobe / S desce;
  // sem velocidade o avião estola e cai
  const lift=clamp((c.speed-VTO)/7,0,1);
  let vyT;
  if(onGround)vyT=th>0&&lift>0?12*lift:0;
  else if(lift>0)vyT=th>0?14*Math.max(lift,.4):th<0?-(7+9*lift):0;
  else vyT=-10; // estol
  c.vy+=(vyT-c.vy)*Math.min(1,2.6*dt);
  p.x+=Math.sin(c.heading)*c.speed*dt;
  p.z+=Math.cos(c.heading)*c.speed*dt;
  p.y+=c.vy*dt;
  if(p.y>PCEIL){p.y=PCEIL;c.vy=Math.min(c.vy,0);}
  // contato com o chão: pouso suave ou acidente (encosta da montanha conta)
  const gh2=groundHeight(p.x,p.z);
  if(p.y<=gh2){
    if(c.vy<-14||(gh2>1&&c.speed>20))return wreckPlane();
    p.y=gh2;c.vy=0;
  }
  // O limite do mundo (±520) vale em qualquer altura.
  p.x=clamp(p.x,-520,520);p.z=clamp(p.z,-520,520);
  // Colisão com PRÉDIOS só vale rente aos telhados (decolagem/pouso/voo rasante).
  // Acima disso o céu é livre: o avião cruza a cidade/vila por cima de tudo —
  // inclusive da torre alta da igreja, da caixa d'água e do moinho — sem mais
  // explodir "do nada" só por sobrevoar a vila (a caixa de colisão da torre
  // sobe ~22u; antes qualquer prédio até y<50 derrubava o avião).
  if(p.y<12&&collideStatics(p,2.1,520)){
    if(c.speed>16)return wreckPlane();
    c.speed*=-.25;thud(Math.abs(c.speed)+4);
  }
  // visual: nariz acompanha a subida/descida, asa inclina na curva
  c.g.rotation.y=c.heading;
  c.g.rotation.x=THREE.MathUtils.lerp(c.g.rotation.x,
    -Math.atan2(c.vy,Math.max(c.speed,10)),Math.min(1,6*dt));
  c.g.rotation.z=THREE.MathUtils.lerp(c.g.rotation.z,
    -st*(onGround?.06:.55)*clamp(c.speed/PMAX,0,1)*1.5,Math.min(1,5*dt));
}

export function updateCar(dt:number){
  if(entering){if(cur)cur.speed=0;return updateEntering(dt);}
  if(exiting){if(cur)cur.speed=0;return updateExiting(dt);}
  if(cur!.plane)return updatePlane(dt);
  if(cur!.boat)return updateBoat(dt);
  // The RC toy is immune to the sea: it can never sink, and the player (who stays
  // standing by the pad) is never unseated/teleported by the water code. Deep water
  // is treated as a wall — see the shoreline guard at the move step below.
  if(cur!.remote){
    cur!.sinkT=0;
  }else if(inWater(cur!.g.position)){
    // No mar o carro perde tração, afunda aos poucos e o jogador escapa nadando
    const p=cur!.g.position;
    if(!cur!.sinkT){cur!.sinkT=1e-6;message('YOUR CAR IS SINKING!','var(--pink)');thud(8);}
    cur!.sinkT+=dt;
    cur!.speed*=Math.exp(-2.4*dt);
    p.x+=Math.sin(cur!.heading)*cur!.speed*dt;
    p.z+=Math.cos(cur!.heading)*cur!.speed*dt;
    p.y=-Math.min(2.6,cur!.sinkT);
    cur!.g.rotation.x=Math.min(.22,cur!.sinkT*.1);
    spinWheels(cur!.g,cur!.speed,dt);
    if(cur!.sinkT>2.1){
      scene.remove(cur!.g);
      player.heading=cur!.heading;unseatPlayer();
      player.g.position.set(p.x,0,p.z);
      player.g.visible=true;
      cur=null;state.mode='foot';state.weaponHeld=!!state.hasGun;
      hudCar!.style.display='none';radioOff();
      message('SWIM BACK TO SHORE!','var(--cyan)');
    }
    return;
  }
  // voltou pra terra firme: cancela o afundamento, senão o carro some na
  // próxima saída (completeExit remove veículo com sinkT marcado)
  cur!.sinkT=0;
  if(cur!.g.userData.crashCd>0)cur!.g.userData.crashCd-=dt; // debounce de batida
  const th=input.moveY;
  const st=input.moveX;
  const hb=input.brake;
  // moto: mais rápida e acelera mais forte, esterça mais fino e quase não dá ré.
  // trator: lento (teto baixo), arranque modesto, esterço lento — sente o peso.
  const bike=cur!.bike, trac=cur!.tractor;
  // upgrade de motor da oficina de custom (car-customs/mod-shop): topo + arranque
  const mul=cur!.g.userData.speedMul||1;
  const MAX=trac?15:(bike?42:32)*mul;
  if(th>0)cur!.speed+=(trac?9:(bike?22:16)*mul)*dt*Math.max(.15,1-cur!.speed/MAX);
  else if(th<0)cur!.speed-=(cur!.speed>0?(trac?16:(bike?34:30)):(trac?7:(bike?12:9)))*dt;
  cur!.speed*=Math.exp(-(hb?2.2:.45)*dt);
  cur!.speed=clamp(cur!.speed,trac?-5:(bike?-8:-11),MAX);
  cur!.heading+=st*(trac?1.5:(bike?2.4:2.0))*dt*clamp(cur!.speed/(trac?7:(bike?9:11)),-1,1)*(hb?1.55:1);
  const p=cur!.g.position;
  const px0=p.x,pz0=p.z; // pre-move position (used by the RC shoreline guard)
  p.x+=Math.sin(cur!.heading)*cur!.speed*dt;
  p.z+=Math.cos(cur!.heading)*cur!.speed*dt;
  // RC toy: the sea is a wall. If this step would land in deep water, revert to the
  // shoreline and kill the velocity — a tiny remote car simply can't drive into it.
  if(cur!.remote&&inWater(p)){
    p.x=px0;p.z=pz0;
    cur!.speed=0;
  }
  if(collideStatics(p,1.3,SWIM_BOUND)){
    const spd=Math.abs(cur!.speed);
    if(spd>4){
      // até batida leve já amassa feio; em alta velocidade destrói a frente
      if(spd>6){thud(spd);state.shake=Math.min(.6,spd*.02);}
      const fwd=cur!.speed>0?1:-1;
      _dentPt.set(p.x+Math.sin(cur!.heading)*2.2*fwd,p.y+.65,p.z+Math.cos(cur!.heading)*2.2*fwd);
      _dentDir.set(-Math.sin(cur!.heading)*fwd,0,-Math.cos(cur!.heading)*fwd);
      if(registerCrash(spd,_dentPt,_dentDir))return; // bateu demais: carro explodiu
    }
    cur!.speed*=-.25;
  }
  // carros estacionados também são sólidos pro carro dirigido
  for(const c of idleCars){
    if(c.plane)continue;
    const d=p.distanceTo(c.g.position);
    if(d<2.9&&d>.001){
      const push=new THREE.Vector3().subVectors(p,c.g.position).setY(0).normalize();
      p.addScaledVector(push,2.9-d);
      const spd=Math.abs(cur!.speed);
      if(spd>6){
        thud(spd);state.shake=.3;
        const mid=new THREE.Vector3().addVectors(p,c.g.position).multiplyScalar(.5).setY(.6);
        dentCar(c.g,mid,push.clone().negate(),.2); // o carro batido amassa normal
        if(registerCrash(spd,mid,push))return;     // o nosso amassa feio / explode
      }
      cur!.speed*=.5;
    }
  }
  cur!.g.rotation.y=cur!.heading;
  // moto inclina pra DENTRO da curva, já perceptível em velocidade média;
  // carro só rola levemente. clamp em 0 evita inclinar dando ré.
  const leanT=bike
    ?-st*clamp(cur!.speed/18,0,1)*.42
    :-st*clamp(cur!.speed/MAX,0,1)*.06;
  cur!.g.rotation.z=THREE.MathUtils.lerp(cur!.g.rotation.z,leanT,bike?6*dt:10*dt);
  // Terreno: o carro acompanha a altura (dá pra subir a montanha) e inclina no morro.
  // Segue a altura rápido o bastante pra não enterrar o nariz na rampa em alta.
  const gh=groundHeight(p.x,p.z);
  p.y+=(gh-p.y)*Math.min(1,12*dt);
  if(p.y<gh)p.y=gh;                       // nunca afunda no terreno
  const fx=Math.sin(cur!.heading),fz=Math.cos(cur!.heading);
  const slope=groundHeight(p.x+fx*1.3,p.z+fz*1.3)-groundHeight(p.x-fx*1.3,p.z-fz*1.3);
  cur!.g.rotation.x=THREE.MathUtils.lerp(cur!.g.rotation.x,-Math.atan2(slope,2.6),Math.min(1,8*dt));
  // A montanha "pesa": a gravidade na rampa segura a subida e puxa na descida, então
  // o morro respeita a física — você precisa de embalo pra escalar e ganha na descida.
  const grade=clamp(slope/2.6,-1.2,1.2);             // inclinação à frente (subida>0)
  if(Math.abs(grade)>.02){
    cur!.speed-=grade*(trac?16:13)*dt;                // componente da gravidade ao longo da pista
    cur!.speed=clamp(cur!.speed,trac?-6:(bike?-9:-12),MAX*1.15); // permite leve excesso na descida
  }
  spinWheels(cur!.g,cur!.speed,dt,st);
  const tail=cur!.g.userData.tailM;
  if(tail)tail.color.setHex(cur!.speed<-.5?0xffd6d6:(th<0||hb)?0xff4444:0xa01515);
}

// Esteira da lancha: pool de retalhos de espuma na superfície da água. A lancha
// cospe borrifo pelos lados da proa (jogado pra fora) e um rastro atrás da popa;
// cada retalho cresce e some. Reciclados num freelist pra não alocar por frame.
interface Wake{g:THREE.Mesh;t:number;life:number;vx:number;vz:number;s0:number;s1:number;}
const wake:Wake[]=[];      // ativos: {g,t,life,vx,vz,s0,s1}
const wakePool:THREE.Mesh[]=[];  // espuma reaproveitável (já na cena, invisível)
function spawnPuff(x:number,y:number,z:number,vx:number,vz:number,s0:number,s1:number,life:number){
  const g=wakePool.pop()||makeWakePuff();
  if(!g.parent)scene.add(g);
  g.position.set(x,y,z);
  g.rotation.y=Math.random()*Math.PI; // varia o recorte da textura
  g.scale.setScalar(s0);
  (g.material as THREE.Material).opacity=0;g.visible=true;
  wake.push({g,t:0,life,vx,vz,s0,s1});
}
function updateWake(dt:number){
  for(let i=wake.length-1;i>=0;i--){
    const w=wake[i];w.t+=dt;const k=w.t/w.life;
    w.g.position.x+=w.vx*dt;w.g.position.z+=w.vz*dt;
    w.vx*=Math.exp(-2.2*dt);w.vz*=Math.exp(-2.2*dt); // perde força espalhando
    w.g.scale.setScalar(w.s0+(w.s1-w.s0)*k);
    // aparece num átimo e desbota até zerar
    (w.g.material as THREE.Material).opacity=Math.min(1,k*7)*(1-k)*.9;
    if(k>=1){w.g.visible=false;wakePool.push(w.g);wake.splice(i,1);}
  }
}

// Lancha: o oposto do carro — voa sobre a água e ENCALHA na areia/terra.
// Quica de leve parada, levanta a proa ao planar e inclina pra dentro da curva.
const SEA_Y=-.32; // mesma altura do mar (assets/models/environment/sea.js)
function updateBoat(dt:number){
  const c=cur!,p=c.g.position;
  const onWater=inWater(p);
  // boarding a boat gets the player out of the water: breath recovers just like
  // stepping back onto land (see updateFoot).
  if(state.swimAir<1)state.swimAir=Math.min(1,state.swimAir+dt*.55);
  const th=input.moveY,st=input.moveX,hb=input.brake;
  const MAX=48;
  if(onWater){
    if(th>0)c.speed+=20*dt*Math.max(.15,1-c.speed/MAX);
    else if(th<0)c.speed-=26*dt;
    c.speed*=Math.exp(-(hb?2.0:.4)*dt); // água segura menos que freio
  }else{
    // encalhou: arrasto pesado da areia, mal consegue se arrastar de volta
    c.speed*=Math.exp(-5*dt);
    if(th>0)c.speed+=3*dt;
  }
  c.speed=clamp(c.speed,-13,MAX);
  // leme só morde com a lancha em movimento (parada não gira)
  c.heading+=st*1.7*dt*clamp(c.speed/10,-1,1)*(hb?1.5:1);
  p.x+=Math.sin(c.heading)*c.speed*dt;
  p.z+=Math.cos(c.heading)*c.speed*dt;
  // parede invisível bem mar adentro (igual aos demais veículos)
  p.x=clamp(p.x,-SWIM_BOUND,SWIM_BOUND);
  p.z=clamp(p.z,-SWIM_BOUND,SWIM_BOUND);
  // flutua na linha d'água com balança suave; planando, a proa levanta
  c.bobT=(c.bobT||0)+dt;
  const plane=clamp(c.speed/MAX,0,1);
  p.y=SEA_Y+.3+Math.sin(c.bobT*2.2)*.05*(1-plane*.7);
  c.g.rotation.y=c.heading;
  c.g.rotation.x=THREE.MathUtils.lerp(c.g.rotation.x,-plane*.13,Math.min(1,4*dt));
  const leanT=-st*clamp(c.speed/22,0,1)*.3;
  c.g.rotation.z=THREE.MathUtils.lerp(c.g.rotation.z,leanT,Math.min(1,5*dt));
  // o aro do timão acompanha o leme (giro visível enquanto o piloto vira)
  const steer=c.g.userData.steer;
  if(steer)steer.rotation.z=THREE.MathUtils.lerp(steer.rotation.z,-st*1.1,Math.min(1,8*dt));

  // esteira: borrifo lateral jogado pra fora + rastro de espuma na popa
  c.wakeT=(c.wakeT||0)+dt;
  const sp=Math.abs(c.speed);
  if(onWater&&sp>3){
    const interval=Math.max(.03,.12-sp*.0016); // mais rápido = mais espuma
    const fx=Math.sin(c.heading),fz=Math.cos(c.heading);
    const rx=Math.cos(c.heading),rz=-Math.sin(c.heading);
    const dir=c.speed>=0?1:-1;
    while(c.wakeT>=interval){
      c.wakeT-=interval;
      // borrifo dos dois lados da proa: nasce junto ao casco e é atirado pra fora
      for(const s of[-1,1]){
        const ox=p.x+fx*.7*dir+rx*s*.8;
        const oz=p.z+fz*.7*dir+rz*s*.8;
        const out=1.5+sp*.06;
        spawnPuff(ox,SEA_Y+.02,oz,
          rx*s*out-fx*sp*.18*dir, rz*s*out-fz*sp*.18*dir, .45,2.2,.7);
      }
      // rastro largo atrás da popa (quase parado: a lancha é que se afasta)
      spawnPuff(p.x-fx*2*dir+(Math.random()-.5)*.5,SEA_Y+.02,
        p.z-fz*2*dir+(Math.random()-.5)*.5,
        (Math.random()-.5)*.7,(Math.random()-.5)*.7, .8,3,.95);
    }
  }
  updateWake(dt);
}

// ============================ NATAÇÃO ============================
// Dois modos que se misturam por player.swimPose (0 = boiando em pé, 1 = nado
// crawl deitado). Parado, o jogador pedala as pernas e scula os braços pra se
// sustentar; movendo, deita na superfície e cai no crawl, com propulsão pulsada
// a cada braçada e DESLIZE por inércia entre elas (não é velocidade constante).
// Sprint (run) acelera a cadência e a propulsão, gastando mais fôlego. Sem
// fôlego o jogador começa a se afogar (perde vida).
const SWIM_TREAD_Y=-1.42; // boiando em pé: linha d'água na altura do peito
const SWIM_PRONE_Y=-.62;  // deitado nadando: corpo na superfície
let swimRippleT=0;

// Borrifo na superfície: reaproveita a espuma da lancha (spawnPuff) como anel/
// jato d'água em volta do nadador. big = jato mais aberto e forte (entrada/braçada).
function spawnSplash(x:number,z:number,scale:number,life:number,big:boolean){
  const ang=Math.random()*Math.PI*2,sp=big?1.4:.5;
  spawnPuff(x+(Math.random()-.5)*.3,SEA_Y+.02,z+(Math.random()-.5)*.3,
    Math.cos(ang)*sp,Math.sin(ang)*sp,scale*.55,scale,life);
}

// Transição terra→água: estoura um anel de espuma, toca o splash grave e leva o
// embalo da corrida pra dentro d'água (entra deslizando, não para seco).
function enterWater(){
  const p=player.g.position;
  for(let i=0;i<7;i++)spawnSplash(p.x,p.z,1.3+Math.random()*1.3,.7,true);
  splash(1,true);state.shake=Math.max(state.shake,.16);
  player.swimVX=Math.sin(player.heading)*2.4;
  player.swimVZ=Math.cos(player.heading)*2.4;
  player.swimPose=0;player.stroke=0;player.lastHalf=0;
}

function updateSwim(dt:number){
  const p=player.g.position;
  const f=input.moveY,side=input.moveX;
  const moving=!!(f||side);
  // ----- fôlego: nadar cansa; sprint cansa mais; sem ar começa a afogar -----
  const sprint=input.run&&moving&&state.swimAir>.06;
  state.swimAir=clamp(state.swimAir-(moving?(sprint?.085:.045):.02)*dt,0,1);
  // ----- cadência da braçada (rad/s): dispara no sprint, lenta boiando -----
  const cadTgt=moving?(sprint?8.6:5.4):2.4;
  player.cadence+=(cadTgt-player.cadence)*Math.min(1,4*dt);
  player.stroke+=player.cadence*dt;
  const sp=player.stroke;
  // ----- propulsão pulsada + inércia -----
  if(moving){
    const camF=_footF.set(Math.sin(cameraRig.yaw),0,Math.cos(cameraRig.yaw));
    const camR=_footR.set(Math.cos(cameraRig.yaw),0,-Math.sin(cameraRig.yaw));
    const mv=_footMv.set(0,0,0).addScaledVector(camF,f).addScaledVector(camR,side).normalize();
    // dois pulsos por ciclo (uma puxada por braço): empurra forte na puxada,
    // quase nada no recobro → sensação de braçada+deslize
    const pulse=Math.pow(Math.abs(Math.sin(sp)),1.5);
    const accel=(sprint?15:9.5)*pulse*(state.swimAir>.06?1:.4);
    player.swimVX+=mv.x*accel*dt;
    player.swimVZ+=mv.z*accel*dt;
    // aponta na direção do nado (giro suave)
    const tgt=Math.atan2(mv.x,mv.z);
    let dh=tgt-player.heading;
    while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;
    player.heading+=dh*Math.min(1,6*dt);
  }
  // arrasto da água: segura mais quando se está parado (boiando)
  const drag=Math.exp(-(moving?1.5:2.5)*dt);
  player.swimVX*=drag;player.swimVZ*=drag;
  const vmag=Math.hypot(player.swimVX,player.swimVZ);
  const VMAX=sprint?5.8:3.6;
  if(vmag>VMAX){const s=VMAX/vmag;player.swimVX*=s;player.swimVZ*=s;}
  p.x+=player.swimVX*dt;p.z+=player.swimVZ*dt;
  // ----- pose: deita ao nadar, volta a ficar em pé ao boiar -----
  const poseTgt=moving?1:0;
  player.swimPose+=(poseTgt-player.swimPose)*Math.min(1,2.6*dt);
  const pose=player.swimPose;
  // ----- profundidade + ondinha da superfície -----
  const bob=Math.sin(state.time*1.5+p.x*.12+p.z*.12)*.05+Math.sin(sp*2)*pose*.04;
  const depthTgt=SWIM_TREAD_Y+(SWIM_PRONE_Y-SWIM_TREAD_Y)*pose+bob;
  p.y+=(depthTgt-p.y)*Math.min(1,6*dt);
  // ----- postura do corpo (ordem YXZ: guinada → inclina à frente → rola) -----
  player.g.rotation.order='YXZ';
  const pitch=pose*1.12;            // deita até ~64° na superfície
  const roll=pose*Math.sin(sp)*.13; // rola de leve a cada braçada (respiração)
  player.g.rotation.set(pitch,player.heading,roll);
  animateSwim(player.g,sp,pose);
  // ----- limites/colisão: parede invisível bem mar adentro -----
  collideStatics(p,.5,SWIM_BOUND);
  // ----- borrifos: braçada entrando na água + rastro de espuma na esteira -----
  const half=Math.floor(sp/Math.PI);
  if(half!==player.lastHalf){
    player.lastHalf=half;
    if(pose>.4){ // a mão da frente fura a água: jato + som de braçada
      const hx=p.x+Math.sin(player.heading)*1,hz=p.z+Math.cos(player.heading)*1;
      spawnSplash(hx,hz,.85+vmag*.12,.55,false);
      splash(.32+vmag*.05,false);
    }
  }
  swimRippleT-=dt;
  if(swimRippleT<=0){
    swimRippleT=vmag>1.2?.1:.27;
    spawnPuff(p.x,SEA_Y+.02,p.z,-player.swimVX*.08,-player.swimVZ*.08,
      .5,1+vmag*.12,1.4);
  }
  // ----- afogamento: sem fôlego, a vida cai (acorda no hospital) -----
  if(state.swimAir<=0){
    state.health-=14*dt;
    if(Math.random()<.05){splash(.5,false);state.shake=Math.max(state.shake,.05);}
    if(state.health<=0){state.health=100;getWasted();} // getWasted reseta a postura do nado
  }
}

// Anima os membros do nado misturando crawl (deitado) e pedalada de sustentação
// (boiando) pelo fator pose. Gesto próprio do nado — não passa pelo animatePed.
function animateSwim(g:THREE.Object3D,sp:number,pose:number){
  const l=g.userData.limbs;if(!l)return;
  const tread=1-pose;
  // --- braços ---
  // crawl: moinho alternado, recobro por cima e puxada por baixo (rotação
  // contínua no ombro); braços opostos meia-volta defasados. A fase fica em
  // [0,2π) — visualmente 2π≡0 (sem salto) e o termo pose*aL desaparece limpo ao
  // voltar a boiar (senão um sp grande deixaria os braços travados num offset).
  const TAU=Math.PI*2,aL=sp%TAU,aR=(sp+Math.PI)%TAU;
  // boiando: braços abertos varrendo a água à frente (scull)
  const scull=Math.sin(sp*1.4);
  l.leftArm.rotation.x =pose*aL + tread*(-.45+scull*.3);
  l.rightArm.rotation.x=pose*aR + tread*(-.45-scull*.3);
  l.leftArm.rotation.z = pose*.1  + tread*.9;
  l.rightArm.rotation.z=-(pose*.1 + tread*.9);
  if(l.leftForearm){
    // crawl: o cotovelo dobra na puxada (braço embaixo) e estica no recobro/entrada
    const flexL=Math.max(0,Math.cos(aL))*.5,flexR=Math.max(0,Math.cos(aR))*.5;
    l.leftForearm.rotation.x =-(pose*(.2+flexL) + tread*(.9+scull*.3));
    l.rightForearm.rotation.x=-(pose*(.2+flexR) + tread*(.9-scull*.3));
  }
  // --- pernas ---
  const flutter=Math.sin(sp*2.4);                 // crawl: batida rápida alternada
  const pa=Math.sin(sp),pb=Math.sin(sp+Math.PI);  // boiando: pedalada alternada
  l.leftLeg.rotation.x = pose*(flutter*.3)  + tread*(.3+pa*.5);
  l.rightLeg.rotation.x= pose*(-flutter*.3) + tread*(.3+pb*.5);
  l.leftLeg.rotation.z = tread*.1;
  l.rightLeg.rotation.z=-tread*.1;
  if(l.leftCalf){
    l.leftCalf.rotation.x = pose*Math.max(0,flutter)*.35  + tread*(.5+Math.max(0,pa)*.7);
    l.rightCalf.rotation.x= pose*Math.max(0,-flutter)*.35 + tread*(.5+Math.max(0,pb)*.7);
  }
}

export function updateFoot(dt:number){
  if(wake.length)updateWake(dt); // a espuma deixada pela lancha some mesmo a pé
  if(dying)return updateDying(dt);
  if(roofFall)return updateRoofFall(dt);
  if(entering)return updateEntering(dt);
  if(exiting)return updateExiting(dt);
  if(state.dlgActive)return;
  // ----- água: o nado tem física, pose e efeitos próprios (updateSwim) -----
  if(inWater(player.g.position)){
    if(!state.swimming)enterWater(); // transição terra→água: splash de entrada
    state.swimming=true;
    return updateSwim(dt);
  }
  if(state.swimming){ // acabou de sair: zera a inércia do nado e o gesto de braçada
    state.swimming=false;
    player.swimVX=player.swimVZ=0;player.swimPose=0;
    player.g.rotation.order='XYZ';
  }
  // fôlego se recupera em terra firme
  if(state.swimAir<1)state.swimAir=Math.min(1,state.swimAir+dt*.55);
  // endireita suavemente qualquer resíduo de inclinação do nado ao pisar em terra
  const g=player.g;
  if(g.rotation.x||g.rotation.z){
    const ke=Math.max(0,1-9*dt);
    g.rotation.x*=ke;g.rotation.z*=ke;
    if(Math.abs(g.rotation.x)<.01)g.rotation.x=0;
    if(Math.abs(g.rotation.z)<.01)g.rotation.z=0;
  }
  const f=input.moveY;
  const side=input.moveX;
  let walkAmount=0;
  if(f||side){
    const camF=_footF.set(Math.sin(cameraRig.yaw),0,Math.cos(cameraRig.yaw));
    const camR=_footR.set(Math.cos(cameraRig.yaw),0,-Math.sin(cameraRig.yaw));
    const analog=Math.min(1,Math.hypot(f,side));
    walkAmount=analog;
    const mv=_footMv.set(0,0,0).addScaledVector(camF,f).addScaledVector(camR,side).normalize();
    const spd=(input.run?9:5.2)*analog;
    player.g.position.addScaledVector(mv,spd*dt);
    player.heading=Math.atan2(mv.x,mv.z);
    player.bob+=dt*spd*1.8;
  }
  {
    const r=state.onRoof,p=player.g.position;
    if(r){
      // bloco superior do prédio é sólido pra quem anda na laje (não tem
      // entrada própria no solids[]: lá em cima só este AABB importa)
      const t=r.top;
      if(t&&p.x>t.x0-.5&&p.x<t.x1+.5&&p.z>t.z0-.5&&p.z<t.z1+.5){
        const pl=p.x-t.x0+.5,pr=t.x1+.5-p.x,pt=p.z-t.z0+.5,pb=t.z1+.5-p.z;
        const m=Math.min(pl,pr,pt,pb);
        if(m===pl)p.x=t.x0-.5;else if(m===pr)p.x=t.x1+.5;
        else if(m===pt)p.z=t.z0-.5;else p.z=t.z1+.5;
      }
      // passou da borda do parapeito: vira queda livre (e morte no chão)
      if(p.x<r.x0||p.x>r.x1||p.z<r.z0||p.z>r.z1){
        state.onRoof=null;startRoofFall();return;
      }
    }
    const gh=r?r.y:groundHeight(p.x,p.z);
    if(f||side)p.y=gh+Math.abs(Math.sin(player.bob))*.09;
    else p.y=gh+(p.y-gh)*.8;
  }
  Entities.animatePed?.(player.g,player.bob,walkAmount);
  collideStatics(player.g.position,.5,SWIM_BOUND);
  // carros são sólidos a pé: dois círculos ao longo do eixo cobrem o carro
  // inteiro e empurram o jogador pra fora (também evita nascer dentro de um)
  const ppos=player.g.position;
  for(const arr of[idleCars,refs.traffic||[],refs.cops||[]] as Vehicle[][]){
    for(const c of arr){
      if(c.plane)continue;
      const h=c.heading??c.g.rotation.y;
      const fx=Math.sin(h),fz=Math.cos(h);
      for(const off of[1.1,-1.1]){
        const dx=ppos.x-(c.g.position.x+fx*off),dz=ppos.z-(c.g.position.z+fz*off);
        const d=Math.hypot(dx,dz);
        if(d<1.3&&d>.001){const push=(1.3-d)/d;ppos.x+=dx*push;ppos.z+=dz*push;}
      }
    }
  }
  // armado de pistola ou no rampage do lança-foguetes: vira junto com a câmera
  const armed=refs.isWeaponHeld?.()||false;
  if(armed){
    player.heading=cameraRig.yaw;
    player.g.rotation.y=cameraRig.yaw;
  }else player.g.rotation.y=player.heading;
}

// First-person view is a *mode of the same camera*, toggled by C. It only takes
// over while the player has normal control on foot or in a vehicle — every special
// state (cut-scenes, death, the roof fall, swimming, entering/leaving a car, the RC
// operator) gracefully falls back to the polished third-person camera, so those
// animations stay visible and nothing fights the FP positioning.
function fpEligible():boolean{
  if(!state.firstPerson||state.cine)return false;
  if(state.mode==='car')return !!cur&&!cur.remote;
  if(state.mode==='foot')
    return !state.swimming&&!dying&&!roofFall&&!entering&&!exiting&&!state.dlgActive;
  return false;
}
// Whether the FP camera is actually driving the view this frame. Used by weapons.js
// to decide when to show the first-person weapon viewmodel.
export function isFirstPerson():boolean{return fpEligible();}

// Toggle handler for the C key (wired in input.js). Flips the flag, recenters the
// look forward and lets the car view settle instead of snapping, plus a little SFX.
export function toggleFirstPerson(){
  state.firstPerson=!state.firstPerson;
  cameraRig.fpPitch=0;            // enter/exit looking straight ahead
  cameraRig.touchLookIdle=1;      // don't immediately yank the yaw on the toggle frame
  blip(state.firstPerson?[660,990]:[520,330],.06,'triangle',.1);
  message(state.firstPerson?'FIRST PERSON':'THIRD PERSON','var(--cyan)');
}

// Mouse-look (pointer lock) routed through here so the delta updates the RIGHT
// pitch — the wide FP pitch when first-person is live, the orbit pitch otherwise.
export function applyMouseLook(dx:number,dy:number){
  cameraRig.yaw-=dx*cameraRig.sensitivity;
  const dp=(cameraRig.invertY?-1:1)*dy*cameraRig.sensitivity;
  if(fpEligible())cameraRig.fpPitch=clamp(cameraRig.fpPitch+dp,-1.3,1.3);
  else cameraRig.pitch=clamp(cameraRig.pitch+dp,.18,.82);
  cameraRig.touchLookIdle=0; // mexeu o mouse: adia o auto-follow atrás do carro
}

export function updateCamera(dt:number){
  const fp=fpEligible();
  // The player ped IS the first-person head: hide it so we never see inside our own
  // model (this also hides the held weapon, which is parented to the ped). Driven
  // every frame BEFORE the cut-scene early-out so the body always reappears the
  // instant FP isn't the active view — including story cut-scenes (fpEligible is
  // false during state.cine), where story.js controls the camera but shows the ped.
  player.g.visible=!fp;
  updateFpCarInterior(dt,fp); // load/unload the detailed cockpit (FP + car + player only)
  if(state.cine)return; // em cut-scene a câmera é controlada por story.js
  let tgt:THREE.Vector3,heading:number,dist:number,baseH:number;
  if(state.mode==='car'||state.mode==='cut'&&cur){
    tgt=cur?cur.g.position:player.g.position;heading=cur?cur.heading:player.heading;
    // carro: câmera colada e baixa, estilo open-world; avião continua afastado
    dist=cur?.plane?15.5:7.2;baseH=cur?.plane?1.95:1.1;
  }else{
    tgt=player.g.position;heading=player.heading;
    // nadando, a câmera baixa e chega mais perto, rente à água
    if(state.swimming){dist=5.6;baseH=1.0;}else{dist=6.2;baseH=1.25;}
  }
  if(input.lookActive&&!state.dlgActive&&!state.paused&&!state.orientationBlocked){
    // Positive lookX means "turn right". In this engine yaw increases to the LEFT
    // (forward = (sin yaw, cos yaw); keyboard A is moveX=+1; mouse-right does yaw-=),
    // so turning right requires subtracting, same as the pointer-lock mouse path.
    cameraRig.yaw-=input.lookX*dt;
    // FP uses a separate, wider look pitch so toggling never clamps the orbit pitch.
    if(fp)cameraRig.fpPitch+=(cameraRig.invertY?-1:1)*input.lookY*dt;
    else cameraRig.pitch+=(cameraRig.invertY?-1:1)*input.lookY*dt;
    cameraRig.touchLookIdle=0;
  }else cameraRig.touchLookIdle+=dt;
  // Auto-follow atrás do alvo: assim que o jogador para de mexer a câmera por um
  // instante, ela volta suavemente pra trás do carro OU do personagem (mesmo com
  // pointer-lock do mouse), pra não precisar reajustar o tempo todo. A pé recentra
  // atrás de player.heading (a direção que ele encara/anda), igual ao carro.
  //
  // Ressalva a pé: o movimento é RELATIVO à câmera (mv = camF*f + camR*side), então
  // player.heading = yaw + offset do input. Perseguir esse heading enquanto se faz
  // strafe (offset fixo ≠ 0) giraria a câmera num loop sem fim. Por isso o recentrar
  // é suprimido enquanto há strafe ativo. Parado (sem input) é estável e é o caso
  // principal — a câmera deriva pra trás de quem olhou pro lado. Andando reto pra
  // frente, heading == yaw, então é um no-op inofensivo.
  // FP a pé NÃO recentra (mira livre); FP no carro ainda volta a olhar pra frente.
  const idle=cameraRig.touchLookIdle>.45;
  const footStrafe=state.mode==='foot'&&Math.abs(input.moveX)>.2;
  const autoFollow=fp
    ?(state.mode==='car'&&idle)
    :(idle&&!footStrafe);
  if(autoFollow){
    const diff=THREE.MathUtils.euclideanModulo(heading-cameraRig.yaw+Math.PI,Math.PI*2)-Math.PI;
    cameraRig.yaw+=diff*Math.min(1,dt*(state.mode==='car'?2.0:1.5));
  }
  if(fp)return updateCameraFP(dt,tgt);
  cameraRig.pitch=clamp(cameraRig.pitch,.18,.82);
  const forward=_camFwd.set(Math.sin(cameraRig.yaw),0,Math.cos(cameraRig.yaw));
  const right=_camRight.set(Math.cos(cameraRig.yaw),0,-Math.sin(cameraRig.yaw));
  const flat=dist*Math.cos(cameraRig.pitch);
  const height=baseH+dist*Math.sin(cameraRig.pitch);
  const shoulder=(state.mode==='car'||state.swimming?0:cameraRig.shoulder);
  const focus=_camFocus.set(tgt.x,tgt.y+1.45,tgt.z).addScaledVector(right,shoulder);
  const want=_camWant.set(tgt.x,tgt.y+height,tgt.z)
    .addScaledVector(forward,-flat)
    .addScaledVector(right,shoulder);
  if(state.interior){ // no interior a câmera fica presa na sala (não vaza)
    const B=state.interior.bounds;
    want.x=clamp(want.x,B.x0,B.x1);
    want.y=Math.min(want.y,B.y1);
    want.z=clamp(want.z,B.z0,B.z1);
  }
  const k=1-Math.exp(-4.5*dt);
  camera.position.lerp(want,k);
  const tf=state.mode==='car'?62+Math.abs(cur!.speed)/32*13:62;
  camera.fov+=(tf-camera.fov)*Math.min(1,5*dt);
  camera.updateProjectionMatrix();
  if(state.shake>0){
    camera.position.x+=rand(-1,1)*state.shake;
    camera.position.y+=rand(-1,1)*state.shake*.5;
    state.shake=Math.max(0,state.shake-dt*1.6);
  }
  camera.lookAt(focus.x+forward.x*2.4,focus.y,focus.z+forward.z*2.4);
}

// Detailed first-person CAR cockpit: a single shared model that exists in the scene
// ONLY while the PLAYER is in first person inside a car (not bike/boat/plane/RC). It
// is built lazily once, attached to the player's car (so it rides along), and removed
// the instant FP ends, the car is left, or the player dies — with the stock low-poly
// steering wheel hidden behind the detailed one while it is loaded.
let fpInterior:THREE.Object3D|null=null,fpInteriorCar:THREE.Object3D|null=null,fpHiddenSteer:THREE.Object3D|null=null;
function updateFpCarInterior(dt:number,fp:boolean){
  const inCar=fp&&cur&&!cur.bike&&!cur.boat&&!cur.plane&&!cur.remote&&!cur.tractor;
  const want=inCar?cur!.g:null;
  if(want!==fpInteriorCar){
    if(fpInterior&&fpInterior.parent)fpInterior.parent.remove(fpInterior); // unload
    if(fpHiddenSteer){fpHiddenSteer.visible=true;fpHiddenSteer=null;}       // restore stock wheel
    if(want){                                                              // load into the car
      if(!fpInterior){fpInterior=buildCarInteriorFp();noShadow(fpInterior);}
      want.add(fpInterior);
      const steer=want.userData.steer;
      if(steer){steer.visible=false;fpHiddenSteer=steer;}
    }
    fpInteriorCar=want;
  }
  // live cockpit: the wheel turns with steering input, the speedo needle sweeps with speed
  if(fpInteriorCar&&fpInterior){
    const u=fpInterior.userData;
    if(u.steerWheel)
      u.steerWheel.rotation.z+=(-input.moveX*.7-u.steerWheel.rotation.z)*Math.min(1,10*dt);
    if(u.speedNeedle){
      const tgtN=2.2-Math.min(1,Math.abs(cur!.speed)/40)*4.4;
      u.speedNeedle.rotation.z+=(tgtN-u.speedNeedle.rotation.z)*Math.min(1,6*dt);
    }
  }
}

// First-person positioning: the eye sits at the head (on foot) or in the driver's
// seat (in a vehicle), and the view rotates with yaw + fpPitch. The eye is parented
// in spirit to the body, so it follows the same bob/terrain motion the ped already
// has — no separate smoothing that could lag behind or clip through the head.
function updateCameraFP(dt:number,tgt:THREE.Vector3){
  cameraRig.fpPitch=clamp(cameraRig.fpPitch,-1.3,1.3);
  const yaw=cameraRig.yaw,pitch=cameraRig.fpPitch;
  if(state.mode==='car'&&cur){
    // Eye fixed to the cabin: offset toward the driver side and the windshield using
    // the VEHICLE heading, then lifted to head height (per vehicle kind). Only the
    // view rotates with the look — the head stays put in the seat.
    const ch=cur.heading,cf=Math.sin(ch),cfz=Math.cos(ch);
    const crx=Math.cos(ch),crz=-Math.sin(ch);
    // Heights/offsets per cabin. For a CAR the eye sits at the driver's seat, BEHIND
    // the wheel, so the detailed cockpit (dash + wheel + gauges) reads in front of you
    // and the road shows through the windshield. Open vehicles (bike/boat/plane) keep
    // the eye further forward since they have no cabin to look into.
    const up=cur.plane?1.5:cur.boat?1.35:cur.bike?1.45:cur.tractor?1.7:1.06;
    const fwd=cur.plane?.7:cur.bike?.3:cur.boat?.2:cur.tractor?-.35:.1;
    const sideOff=(cur.bike||cur.boat||cur.plane||cur.tractor)?0:-.36; // cars: sit on the driver (left) seat
    _fpEye.set(tgt.x+cf*fwd+crx*sideOff,tgt.y+up,tgt.z+cfz*fwd+crz*sideOff);
  }else{
    // Standing/walking: eyes near the crown of the head. tgt.y already carries the
    // step bob and terrain height, so the view bobs naturally with the stride.
    _fpEye.set(tgt.x,tgt.y+1.58,tgt.z);
  }
  // Snap the eye to the head: zero follow-lag (most responsive), and it can never
  // interpolate through a wall the way a trailing camera could.
  camera.position.copy(_fpEye);
  const tf=state.mode==='car'&&cur?68+Math.abs(cur.speed)/32*14:70;
  camera.fov+=(tf-camera.fov)*Math.min(1,5*dt);
  camera.updateProjectionMatrix();
  if(state.shake>0){
    camera.position.x+=rand(-1,1)*state.shake;
    camera.position.y+=rand(-1,1)*state.shake*.5;
    state.shake=Math.max(0,state.shake-dt*1.6);
  }
  // Look direction from yaw + pitch. Sign matches third person and the mouse path:
  // dragging the look DOWN (fpPitch grows) tilts the view down (-Y).
  const cosP=Math.cos(pitch);
  _fpDir.set(Math.sin(yaw)*cosP,-Math.sin(pitch),Math.cos(yaw)*cosP);
  camera.lookAt(camera.position.x+_fpDir.x,camera.position.y+_fpDir.y,camera.position.z+_fpDir.z);
}
