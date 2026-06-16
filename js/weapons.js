import * as THREE from 'three';
import {state,input,refs} from './state.js';
import {economy} from './economy.js';
import {scene,camera} from './engine.js';
import {N,ROAD,BLOCK,SIDE,rand,irand,nodeX,groundHeight,SWIM_BOUND} from './constants.js';
import {isPark} from './world.js';
import {blip,thud,gunshot} from './audio.js';
import {message} from './hud.js';
import {addWanted,collideStatics} from './physics.js';
import {player,playerPos,cameraRig,idleCars,cur,getWasted,isFirstPerson} from './player.js';
import {peds,addBloodPuddle} from './pedestrians.js';
import {traffic,spawnTraffic} from './traffic.js';
import {cops,officers as copOfficers,killOfficer} from './police.js';
import {spawnDrop} from './missions.js';
import {gangPeds,killGangPed} from './gangs.js';
import {dentCar,poseAiming,disposeGeometries} from './entities.js';
import {makePistolModel} from '../assets/models/weapons/pistol.js';
import {makeRocketLauncherModel,makeMissileModel} from '../assets/models/weapons/rocket-launcher.js';
import {makeGrenadeModel} from '../assets/models/weapons/grenade.js';
import {makeMolotovModel} from '../assets/models/weapons/molotov.js';
import {makeExplosionModel} from '../assets/models/effects/explosion.js';
import {makeImpactRing} from '../assets/models/effects/impact-ring.js';
import {makeBulletModel} from '../assets/models/effects/bullet.js';
import {makeFireModel} from '../assets/models/effects/fire.js';
import {makeFlameJetModel} from '../assets/models/effects/flame-jet.js';
import {makeWeaponTracerLine} from '../assets/models/effects/weapon-tracer.js';
import {makeFpHands} from '../assets/models/characters/fp-hands.js';
import {WEAPONS,ARSENAL,FIST,bySlot} from './weapon-catalog.js';
import {reportMiniGameResult} from './minigame-leaderboard.js';
import {MiniGame,MiniGameId} from './minigame.js';

const weaponPickups=[];
function makeWeaponPickup(x,z){
  const g=makePistolModel({pickup:true});
  g.scale.set(1.05,1.05,1.05);
  g.position.set(x,.82,z);
  g.userData.baseY=.82;
  scene.add(g);
  weaponPickups.push(g);
}

for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  if(!isPark(i,j))continue;
  const x0=nodeX(i)+ROAD/2+SIDE,z0=nodeX(j)+ROAD/2+SIDE;
  const tucked=Math.random()<.5?-1:1;
  makeWeaponPickup(
    x0+BLOCK*.5+tucked*rand(7,12),
    z0+BLOCK*.5+rand(-11,11)
  );
}
if(!weaponPickups.length)makeWeaponPickup(nodeX(4)+12,nodeX(4)+12);

// ----- INVENTÁRIO -----
// `owned` é o que o jogador tem (sempre ao menos o punho); `curWeapon` é a
// selecionada. O modelo na mão vive em `heldHolder` (filho do player) e é
// reconstruído na troca. O catálogo (js/weapon-catalog.js) define todas as
// armas como instâncias da classe base Weapon (js/weapon-types.js).
let owned=[FIST];
let curWeapon=FIST;
let heldModel=null,curMuzzle=null;
let heldBaseScale=1; // hold.scale captured at equip (restored when leaving first person)
const heldHolder=new THREE.Group();
heldHolder.visible=false;
player.g.add(heldHolder);

function equip(w){
  if(!owned.includes(w))return;
  curWeapon=w;
  state.weaponHeld=state.mode==='foot'&&w.aimed;
  if(heldModel){disposeGeometries(heldModel);heldHolder.remove(heldModel);heldModel=null;curMuzzle=null;}
  if(w.makeModel){
    heldModel=w.makeModel({held:true});
    heldHolder.add(heldModel);
    heldBaseScale=w.hold?.scale||1;
    heldHolder.scale.setScalar(heldBaseScale);
    curMuzzle=heldModel.userData?.muzzlePoint||null;
  }
  syncWeaponState();
}

// Espelha a arma atual nos campos de state que o HUD/áudio/fala já leem.
function syncWeaponState(){
  state.hasGun=owned.some(w=>w!==FIST);
  state.weaponName=curWeapon.name;
  state.weaponInfinite=curWeapon.infiniteAmmo;
  state.weaponCategory=curWeapon.category;
  state.ammo=curWeapon.infiniteAmmo?0:Math.max(0,curWeapon.ammo);
  state.maxAmmo=curWeapon.infiniteAmmo?0:curWeapon.maxAmmo;
}

// Troca cíclica (roda do mouse / tecla / botão) entre as armas que possui.
export function switchWeapon(dir=1){
  if(state.mode!=='foot'||owned.length<2)return;
  const i=owned.indexOf(curWeapon);
  equip(owned[(i+dir+owned.length)%owned.length]);
  blip([520,640],.05,'square',.1);
}
// Seleção direta pela tecla numérica (slot do catálogo).
export function selectWeaponSlot(slot){
  if(state.mode!=='foot')return;
  const w=bySlot(slot);
  if(w&&owned.includes(w)){equip(w);blip([560,700],.05,'square',.1);}
}
// Inventário atual (na ordem do ciclo) para a roda de seleção (js/weapon-wheel.js).
export function getInventory(){
  return owned.map(w=>({
    id:w.id,name:w.name,category:w.category,
    infinite:w.infiniteAmmo,
    ammo:w.infiniteAmmo?Infinity:Math.max(0,w.ammo),
    max:w.maxAmmo,
    current:w===curWeapon
  }));
}
// Equipa direto pelo id (a roda chama isto ao soltar/tocar no setor escolhido).
export function equipWeaponById(id){
  if(state.mode!=='foot')return false;
  const w=owned.find(x=>x.id===id);
  if(!w||w===curWeapon)return false;
  equip(w);
  blip([560,720],.05,'square',.1);
  return true;
}
export const getWeaponHud=()=>({
  id:curWeapon.id,name:curWeapon.name,ammo:curWeapon.ammoLabel(),max:curWeapon.maxAmmo,
  infinite:curWeapon.infiniteAmmo,category:curWeapon.category,
  low:!curWeapon.infiniteAmmo&&curWeapon.ammo<=Math.max(6,Math.ceil(curWeapon.maxAmmo*.15))
});

// ----- LANÇA-FOGUETES: item mais potente do jogo, escondida na zona rural -----
// Encostar nela inicia um rampage estilo mundo aberto: destruir N carros em
// T segundos com mísseis (cada míssil destrói um carro de uma vez e a onda
// de choque mata grupos inteiros). Ganhou, leva o prêmio; perdeu, fica tudo
// normal. A lança-foguetes só existe durante o rampage e reaparece no campo depois.
const RAMPAGE_GOAL=3,RAMPAGE_TIME=80,RAMPAGE_REWARD=1000;
const rampage={active:false,end:0,kills:0};
// mini game (sessão): igual à chacina das caveiras (js/rampage.js), trava o mundo
// (state.activeMiniGame) enquanto roda, pra que outras atividades não rodem junto.
const rampageGame=new MiniGame({id:MiniGameId.ROCKET_RAMPAGE,name:'Rocket Frenzy'});
const missiles=[];
const ROCKET_X=320,ROCKET_Z=0; // fim da estrada de terra, no pé da montanha
const rocketPickup=makeRocketLauncherModel({pickup:true});
rocketPickup.scale.set(1.4,1.4,1.4);
rocketPickup.position.set(ROCKET_X,groundHeight(ROCKET_X,ROCKET_Z)+.95,ROCKET_Z);
scene.add(rocketPickup);
let rocketRespawnAt=-1;

const heldRocket=makeRocketLauncherModel();
heldRocket.position.set(.43,1.48,.15); // apoiada no ombro direito
heldRocket.visible=false;
player.g.add(heldRocket);

const rampageEl=document.getElementById('rampage');

// tocar a lança-foguetes começa a chacina (igual à das caveiras em js/rampage.js):
// pega a trava do mundo via rampageGame.begin(), que também abre o briefing (top 5)
// e congela até o jogador "passar". Aborta se outra sessão de mini game já roda.
function beginRampage(){
  if(!rampageGame.begin())return;      // outra sessão rolando: não começa
  // NB: rockets are fired via fireMissile() while rampage.active (see updateWeapons),
  // independent of the weapon inventory — so no weapon is granted/altered here.
  rampage.active=true;rampage.end=state.time+RAMPAGE_TIME;rampage.kills=0;
  rocketPickup.visible=false;
  message(`ROCKET FRENZY! DESTROY ${RAMPAGE_GOAL} CARS WITH THE ROCKET LAUNCHER`,'var(--pink)');
  blip([220,330,440,660],.09,'square',.2);
}

function endRampage(won){
  if(!rampage.active)return;            // guarda: nunca finaliza duas vezes
  rampage.active=false;
  if(rampageEl)rampageEl.style.display='none';
  rocketRespawnAt=state.time+75; // a lança-foguetes volta pro pasto um tempo depois
  reportMiniGameResult(rampageGame.id,{won,score:rampage.kills}); // ranking (top 5)
  rampageGame.end();                   // libera a trava do mundo (idempotente)
  if(won){
    economy.earn(RAMPAGE_REWARD,'rocket-rampage');
    message(`ROCKET FRENZY PASSED! +$${RAMPAGE_REWARD}`,'var(--gold)');
    blip([523,659,784,1047],.09,'sine',.18);
  }else{
    message('ROCKET FRENZY FAILED','var(--pink)');
    blip([220,170,120],.1,'sawtooth',.16);
  }
}

const explosions=[];
const tracers=[];
const impacts=[];
const bullets=[];
const thrown=[];     // granadas/molotovs em arco
const flameJets=[];  // jatos do lança-chamas (efeito visual, vida curta)
const firePools=[];  // poças de fogo (molotov / carga do detonador)
let plantedBomb=null; // carga do detonador esperando o segundo aperto
let lastShot=-99;
let gunKick=0;
let meleeAnim=null,punchSide=1;
const meleeTrails=[];
document.getElementById('buildver')?.insertAdjacentText('beforeend',' ◆ ARSENAL');

// Mira/crosshair só pra armas de pontaria (fogo, pesadas, arremesso); punho e
// detonador atacam sem retículo. O rampage da lança-foguetes também conta como armado.
export function isWeaponHeld(){
  if(state.mode!=='foot'||state.swimming)return false; // nadando não se empunha arma
  return rampage.active||(curWeapon.aimed&&state.weaponHeld);
}

// No modo a pé sempre dá pra atacar (nem que seja com o punho) — usado pelo
// botão de tiro do mobile e pela lógica de disparo.
export function canAttack(){
  return state.mode==='foot'&&!state.swimming&&!!curWeapon;
}

export function canPickWeapon(){
  if(state.hasGun||state.mode!=='foot')return false;
  return !!nearestWeaponPickup(3);
}

// Concede o arsenal inteiro com munição cheia (o pickup do mundo e o espólio
// dos telhados em js/doors.js usam isto). Equipa a pistola se vier desarmado.
export function grantWeapon(){
  const wasUnarmed=!state.hasGun;
  owned=[FIST,...ARSENAL];
  for(const w of ARSENAL)w.refill();
  for(const g of weaponPickups)scene.remove(g);
  if(wasUnarmed||curWeapon===FIST)equip(byIdSafe('pistol'));
  else syncWeaponState();
  blip([440,660,880],.07,'square',.14);
}
const byIdSafe=id=>WEAPONS.find(w=>w.id===id)||FIST;

// DEV: rodando em localhost o jogador já começa com o arsenal completo e munição
// cheia (atalho de teste pra não ter que caçar a arma no parque). Em qualquer
// outro host (LAN/produção) nada muda — a arma continua sendo um pickup.
if(location.hostname==='localhost'||location.hostname==='127.0.0.1')grantWeapon();

// Já tem essa arma? (a loja mostra "OWNED" e bloqueia recompra)
export function ownsWeapon(id){return owned.some(w=>w.id===id);}

// Compra de UMA arma na loja (js/gun-shop.js): adiciona ao inventário com
// munição cheia, mantém a ordem do catálogo e equipa se ainda estava só no
// punho. Quem cobra o dinheiro é a loja; aqui só concede a arma.
export function buyWeapon(id){
  const w=WEAPONS.find(x=>x.id===id);
  if(!w||w===FIST||owned.includes(w))return false;
  owned.push(w);
  owned.sort((a,b)=>WEAPONS.indexOf(a)-WEAPONS.indexOf(b));
  w.refill();
  if(curWeapon===FIST)equip(w);else syncWeaponState();
  blip([440,660,880],.07,'square',.14);
  return true;
}

// Info de munição de UMA arma (a loja usa pra oferecer recarga a quem já a tem).
// `full` = não há munição a comprar (arma de munição infinita, ex. punho/bat/
// detonador, ou já está com o pente cheio).
export function weaponAmmoInfo(id){
  const w=WEAPONS.find(x=>x.id===id);
  if(!w)return null;
  return{
    infinite:w.infiniteAmmo,
    ammo:w.infiniteAmmo?Infinity:Math.max(0,w.ammo),
    max:w.maxAmmo,
    full:w.infiniteAmmo||w.ammo>=w.maxAmmo,
  };
}

// Recarrega a munição de uma arma JÁ possuída até o máximo (loja: "BUY AMMO").
// Quem cobra o dinheiro é a loja; aqui só repõe. Devolve false se não há o que
// repor (arma não possuída ou de munição infinita).
export function refillAmmo(id){
  const w=WEAPONS.find(x=>x.id===id);
  if(!w||w.infiniteAmmo||!owned.includes(w))return false;
  w.refill();
  syncWeaponState();
  blip([440,660,880],.07,'square',.14);
  return true;
}

// Pick up ONE weapon from the world (a hidden world pickup): add it to the
// inventory if missing and ALWAYS refill its ammo (even if already owned, so the
// pickup doubles as an ammo crate). Equips it if the player was only on fists.
// Returns true when the weapon was new (lets the caller say "NEW WEAPON").
export function pickupArsenalWeapon(id){
  const w=WEAPONS.find(x=>x.id===id);
  if(!w||w===FIST)return false;
  const isNew=!owned.includes(w);
  if(isNew){
    owned.push(w);
    owned.sort((a,b)=>WEAPONS.indexOf(a)-WEAPONS.indexOf(b));
  }
  w.refill();
  if(curWeapon===FIST)equip(w);else syncWeaponState();
  blip([440,660,880],.07,'square',.14);
  return isNew;
}

// ----- SAVE: inventário persistente (js/save.js) -----
// Serializa as armas possuídas (sem o punho) + munição atual, pra restaurar na
// próxima sessão. Salvamos a munição pra não dar recarga grátis nem devolver a
// arma vazia. Armas de munição infinita guardam só o id.
function getInventorySave(){
  return owned.filter(w=>w!==FIST).map(w=>
    w.infiniteAmmo?{id:w.id}:{id:w.id,ammo:Math.max(0,Math.floor(w.ammo))});
}
function restoreInventory(list){
  if(!Array.isArray(list))return;
  for(const it of list){
    const id=typeof it==='string'?it:(it&&it.id);
    const w=WEAPONS.find(x=>x.id===id);
    if(!w||w===FIST||owned.includes(w))continue;
    owned.push(w);
    if(!w.infiniteAmmo){
      const a=(it&&Number.isFinite(it.ammo))?Math.max(0,Math.min(w.maxAmmo,Math.floor(it.ammo))):w.maxAmmo;
      w.ammo=a;
    }
  }
  owned.sort((a,b)=>WEAPONS.indexOf(a)-WEAPONS.indexOf(b));
  // mantém o PUNHO na mão ao renascer (não saca arma sozinho); as armas ficam no
  // inventário/roda. Só reflete a posse nos campos de state (state.hasGun etc).
  syncWeaponState();
}
refs.getWeaponsSave=getInventorySave;
refs.restoreWeapons=restoreInventory;

let trainingSnapshot=null;
function restoreTrainingAmmo(){
  if(!trainingSnapshot)return;
  for(const s of trainingSnapshot.weapons){
    s.w.ammo=s.ammo;
    s.w._last=s.last;
  }
  if(plantedBomb){scene.remove(plantedBomb.g);plantedBomb=null;}
}
export function beginTrainingWeapon(id){
  const w=WEAPONS.find(x=>x.id===id);
  if(!w||w===FIST)return false;
  if(!trainingSnapshot){
    trainingSnapshot={owned:owned.slice(),cur:curWeapon,weapons:WEAPONS.map(x=>({
      w:x,ammo:x.ammo,last:x._last
    }))};
  }else restoreTrainingAmmo();
  owned=[FIST,w];
  w.reset();
  equip(w);
  state.weaponHeld=!!w.aimed;
  blip([520,660,880],.06,'square',.13);
  return true;
}
export function clearTrainingWeapon(){
  if(!trainingSnapshot)return false;
  const snap=trainingSnapshot;
  restoreTrainingAmmo();
  trainingSnapshot=null;
  owned=snap.owned.slice();
  const restore=snap.cur&&owned.includes(snap.cur)?snap.cur:FIST;
  equip(restore);
  blip([300,240],.05,'square',.1);
  return true;
}
export const isTrainingWeaponActive=()=>!!trainingSnapshot;
export const getTrainingWeaponId=()=>trainingSnapshot&&curWeapon!==FIST?curWeapon.id:null;

// ----- Snapshot/restore arsenal (session-temporary grants) -----
// Capture the full inventory state so a mini-game (rampage) can hand the player a
// temporary arsenal via grantWeapon() and roll it back on EVERY exit. Records the
// owned set, the current selection and per-weapon ammo/cooldown so nothing leaks
// (no permanent weapons, no free ammo refills). Standalone: any caller can pair
// snapshotArsenal() before granting with restoreArsenal() after.
export function snapshotArsenal(){
  return{
    owned:owned.slice(),
    cur:curWeapon,
    weapons:WEAPONS.map(w=>({w,ammo:w.ammo,last:w._last})),
  };
}
export function restoreArsenal(snap){
  if(!snap)return false;
  for(const s of snap.weapons){s.w.ammo=s.ammo;s.w._last=s.last;}
  owned=snap.owned.slice();
  // re-select a still-owned weapon (fall back to fists if the prior one is gone)
  const restore=snap.cur&&owned.includes(snap.cur)?snap.cur:FIST;
  equip(restore);
  return true;
}

export function pickupWeapon(){
  const pickup=nearestWeaponPickup(3);
  if(!pickup)return;
  grantWeapon();
  message('WEAPONS PICKED UP - HOLD TAB (OR WPN) FOR WEAPON WHEEL','var(--gold)');
}

export function confiscateWeapon(){
  owned=[FIST];
  for(const w of ARSENAL)w.ammo=w.infiniteAmmo?Infinity:0;
  if(plantedBomb){scene.remove(plantedBomb.g);plantedBomb=null;}
  equip(FIST);
  for(const g of weaponPickups)if(!g.parent)scene.add(g);
}

function nearestWeaponPickup(maxD){
  const pp=playerPos();
  let best=null,bd=maxD;
  for(const g of weaponPickups){
    if(!g.parent)continue;
    const d=pp.distanceTo(g.position);
    if(d<bd){bd=d;best=g;}
  }
  return best;
}

function rayHitXZ(origin,dir,pos,radius,range){
  const dx=pos.x-origin.x,dz=pos.z-origin.z;
  const ahead=dx*dir.x+dz*dir.z;
  if(ahead<0||ahead>range)return null;
  const side=Math.abs(dx*dir.z-dz*dir.x);
  return side<=radius?ahead:null;
}

// Scratch reaproveitado pela mira. aimRay() roda TODO frame com arma em punho
// (checagem de alvo do crosshair) e a cada tiro — antes alocava ~4 Vector3 por
// chamada. _ray é um objeto fixo (origin=_muzzle, dir=_aimPoint) devolvido sem
// alocar. Os chamadores consomem o resultado na hora (clonam o que guardam),
// então reusar os mesmos scratch entre chamadas é seguro.
const _camDir=new THREE.Vector3(),_muzzle=new THREE.Vector3(),
  _flatDir=new THREE.Vector3(),_aimPoint=new THREE.Vector3(),_gmRight=new THREE.Vector3();
const _ray={origin:_muzzle,dir:_aimPoint};
const _molDir=new THREE.Vector3(); // direção do molotov em voo (scratch)
const _hand=new THREE.Vector3();   // firing-hand world position (gun placement)
let _xhairT=0; // acumulador do throttle do alvo do crosshair
function aimRay(range=48){
  camera.getWorldDirection(_camDir);
  const muzzle=getMuzzleWorldPosition(_muzzle);
  // First person: the gun barrel rides the camera, so the shot must follow the
  // camera's TRUE 3D direction starting AT the muzzle — then the bullet/tracer
  // visibly leaves the barrel toward the crosshair (vertical aim included). Third
  // person keeps the horizontal aim below (shots travel level at muzzle height).
  if(fpHolderActive()){
    _aimPoint.copy(_camDir);
    if(_aimPoint.lengthSq()<.0001)_aimPoint.set(Math.sin(cameraRig.yaw),0,Math.cos(cameraRig.yaw));
    _aimPoint.normalize();
    return _ray; // origin=_muzzle (barrel tip), dir=_aimPoint (camera forward)
  }
  _flatDir.set(_camDir.x,0,_camDir.z);
  if(_flatDir.lengthSq()<.0001)_flatDir.set(Math.sin(cameraRig.yaw),0,Math.cos(cameraRig.yaw));
  _flatDir.normalize();
  let haveAim=false;
  if(Math.abs(_camDir.y)>.001){
    const t=(muzzle.y-camera.position.y)/_camDir.y;
    if(t>3&&t<range*2){_aimPoint.copy(camera.position).addScaledVector(_camDir,t);haveAim=true;}
  }
  if(!haveAim)_aimPoint.copy(muzzle).addScaledVector(_flatDir,range);
  const dir=_aimPoint.sub(muzzle); // dir === _aimPoint (distinto de _muzzle)
  dir.y=0;
  if(dir.lengthSq()<.0001)dir.copy(_flatDir);
  dir.normalize();
  muzzle.addScaledVector(dir,.42); // origin === _muzzle
  return _ray;
}

function getMuzzleWorldPosition(out){
  if(heldRocket.visible)return heldRocket.userData.muzzlePoint.getWorldPosition(out);
  if(heldHolder.visible&&curMuzzle)return curMuzzle.getWorldPosition(out);
  const pp=playerPos();
  return out.set(pp.x,pp.y,pp.z)
    .addScaledVector(_gmRight.set(Math.cos(cameraRig.yaw),0,-Math.sin(cameraRig.yaw)),.46)
    .setY(pp.y+1.12);
}

function posePlayerWithGun(){
  const limbs=player.g.userData.limbs;
  if(!limbs?.rightArm)return;
  poseAiming(player.g,gunKick); // base aiming pose (shared with NPCs/police)
  applyGripPose(curWeapon.hold?.grip,limbs); // weapon-specific arm posture (player only)
  const h=curWeapon.hold||{};
  // Seat the weapon IN the firing hand: read the (now-posed) forearm bone and place
  // the holder at the hand, so the gun sits in the grip at any scale instead of
  // floating at a fixed body point. Refresh the bone world matrices for the pose
  // set above; the hand is ~0.28 down the forearm bone's local axis.
  player.g.updateWorldMatrix(true,true);
  const fore=limbs.rightForearm||limbs.rightArm;
  _hand.set(0,-.28,0).applyMatrix4(fore.matrixWorld);
  player.g.worldToLocal(_hand);
  heldHolder.position.set(
    _hand.x+(h.x||0),
    _hand.y+(h.y||0),
    _hand.z+(h.z||0)-gunKick*.75);
  heldHolder.rotation.set(-.03-gunKick*.9+(h.rx||0),(h.ry||0),-.03+(h.rz||0));
}

// Player-only realistic posture per weapon, layered ON TOP of poseAiming (which
// already extends the firing arm forward). Only the player calls this — NPC/police
// keep the generic two-arm aim. Arm bones: rotation.x ≈ -π/2 points the arm
// straight forward; the support (left) arm reaches onto the weapon.
function applyGripPose(grip,l){
  if(!grip||!l.leftArm)return;
  if(grip==='pistol'){
    // two-handed clasp: the support hand comes up to meet the firing hand
    l.leftArm.rotation.set(-1.46,.16,.12);
    if(l.leftForearm)l.leftForearm.rotation.x=-.32;
  }else if(grip==='smg'||grip==='rifle'){
    // support hand forward on the foregrip, both elbows tucked in
    l.leftArm.rotation.set(-1.30,.12,.16);
    if(l.leftForearm)l.leftForearm.rotation.x=-.55;
    l.rightArm.rotation.z=-.05;
  }else if(grip==='shoulder'){
    // launcher braced on the shoulder: firing elbow up at the rear grip, support
    // hand under the tube
    l.rightArm.rotation.set(-1.24,-.06,-.30);
    if(l.rightForearm)l.rightForearm.rotation.x=-.22;
    l.leftArm.rotation.set(-1.06,.20,.30);
    if(l.leftForearm)l.leftForearm.rotation.x=-.70;
  }
}

// Porte parado (arma melee não erguida): segura a arma baixa junto ao corpo e
// NÃO mexe nos braços, pra animação de andar continuar normal.
function carryPose(){
  const limbs=player.g.userData.limbs;
  if(!limbs?.rightArm)return;
  const h=curWeapon.hold||{};
  heldHolder.position.set(limbs.rightArm.position.x+.16+(h.x||0),.96+(h.y||0),.2+(h.z||0));
  heldHolder.rotation.set(.5+(h.rx||0),(h.ry||0),-.25+(h.rz||0));
}

// ----- FIRST-PERSON WEAPON VIEWMODEL (Counter-Strike style) -----------------
// In first person the body is hidden, so the held weapon is reparented from the
// body to the CAMERA and placed in the lower-right of the view with idle breathing,
// a walk bob and a recoil kick — the same heldHolder/heldModel built on equip, only
// the parent and transform change. engine.js adds the camera to the scene so its
// children render. Weapon models point their barrel down +Z, so a Y-flip (π) aims it
// into the screen (the camera looks down its own -Z).
const VM_SCALE=.6;              // shrink vs. the body-held scale (a gun fills less view)
const VM_POS=[.21,-.135,-.52];  // camera-local anchor: right / down / forward
const VM_ROCKET_BODY={pos:[.43,1.48,.15],rot:[0,0,0]}; // heldRocket's static body pose

// FP viewmodel hands: two arms gripping the gun. Parented to heldHolder so they
// recoil/bob WITH the weapon; a Y-flip cancels the holder's own flip so the arms
// sit in camera-aligned space, and a counter-scale keeps them unit-sized whatever
// the gun's hold.scale is. Hidden unless first person is the active view.
const fpHands=makeFpHands({sleeve:0x19e3ff}); // matches the player's cyan shirt
fpHands.rotation.y=Math.PI;
fpHands.visible=false;
heldHolder.add(fpHands);

const fpHolderActive=()=>isFirstPerson()&&state.mode==='foot';

// Reparent a holder to the camera (FP) or back to the body, restoring the body
// scale/placement when leaving FP. Idempotent: only acts on an actual parent change.
function syncHolderParent(obj,toCamera,bodyScale,bodyReset){
  if(toCamera){
    if(obj.parent!==camera)camera.add(obj);
  }else if(obj.parent!==player.g){
    player.g.add(obj);
    obj.scale.setScalar(bodyScale);
    if(bodyReset){obj.position.set(...bodyReset.pos);obj.rotation.set(...bodyReset.rot);}
  }
}

// Keep both holders parented correctly for the current view (called before posing,
// so the per-frame body pose writes into the right coordinate space).
function syncViewModel(){
  const onCam=fpHolderActive();
  syncHolderParent(heldHolder,onCam,heldBaseScale,null); // body pose resets it each frame
  syncHolderParent(heldRocket,onCam,1,VM_ROCKET_BODY);   // static on the shoulder in 3rd person
  // hands only in FP; the parent heldHolder's own visibility still gates them (no
  // hands for fists/rampage, where heldHolder is hidden)
  fpHands.visible=onCam;
}

// Place the active viewmodel in view space (after the body pose ran). Adds walk bob,
// idle breathing, the recoil kick (gunKick) and a forward jab for a melee swing.
function applyViewModel(){
  if(!fpHolderActive())return;
  const holder=heldRocket.visible?heldRocket:(heldHolder.visible?heldHolder:null);
  if(!holder)return;
  const gunScale=(holder===heldRocket?1:heldBaseScale)*VM_SCALE;
  holder.scale.setScalar(gunScale);
  // keep the hands unit-sized regardless of the gun's hold.scale (they ride heldHolder)
  fpHands.scale.setScalar(1/(heldBaseScale*VM_SCALE));
  const fp=curWeapon.hold?.fp||null; // optional per-weapon nudge (none defined yet)
  let px=VM_POS[0]+(fp?.x||0),py=VM_POS[1]+(fp?.y||0),pz=VM_POS[2]+(fp?.z||0);
  let rx=fp?.rx||0,ry=Math.PI+(fp?.ry||0),rz=fp?.rz||0;
  if(input.moveX||input.moveY){           // walk bob: sways with the stride (player.bob)
    px+=Math.sin(player.bob)*.012;
    py-=Math.abs(Math.sin(player.bob))*.014;
  }else{                                  // idle: a gentle breathing drift
    py+=Math.sin(state.time*1.6)*.004;
    px+=Math.sin(state.time*.9)*.003;
  }
  if(meleeAnim){                          // melee swing: thrust the viewmodel forward
    const p=clamp01(meleeAnim.t/meleeAnim.dur);
    const strike=Math.sin(clamp01((p-.06)/.5)*Math.PI);
    pz-=strike*.34;rx-=strike*.45;px-=strike*.1*meleeAnim.side;
  }
  pz+=gunKick*.3;                         // recoil: kick back toward the viewer...
  rx-=gunKick*.5;                         // ...and tip the muzzle up
  holder.position.set(px,py,pz);
  holder.rotation.set(rx,ry,rz);
}
const clamp01=v=>Math.max(0,Math.min(1,v));
const easeInOut=t=>t*t*(3-2*t);
const easeOut=t=>1-Math.pow(1-t,3);
const lerp=(a,b,t)=>a+(b-a)*t;
function mixArr(a,b,t){return a.map((v,i)=>lerp(v,b[i],t));}
function setRot(o,r){if(o)o.rotation.set(r[0],r[1],r[2]);}

function spawnMeleeTrail(kind,side){
  const bat=kind==='bat';
  const mat=new THREE.MeshBasicMaterial({
    color:bat?0xffd24a:0x8ceefb,transparent:true,opacity:bat ? .72 : .48,
    side:THREE.DoubleSide,depthWrite:false
  });
  const start=bat?(side>0?-2.2:Math.PI-.9):(side>0?-1.25:Math.PI-.55);
  const len=bat?2.15:1.25;
  const geo=new THREE.RingGeometry(bat ? .54 : .20,bat ? .72 : .32,28,1,start,len);
  const m=new THREE.Mesh(geo,mat);
  m.position.set(side*(bat ? .08 : .18),bat?1.22:1.14,bat ? .82 : .72);
  m.rotation.z=side*(bat ? .18 : .08);
  player.g.add(m);
  meleeTrails.push({m,t:0,life:bat ? .22 : .14});
}

function startMeleeAnimation(range,knock,lethal){
  const bat=curWeapon.id==='bat';
  const side=bat?1:punchSide;
  if(!bat)punchSide*=-1;
  meleeAnim={
    kind:curWeapon.id,
    side,
    t:0,
    dur:bat ? .58 : .38,
    hitAt:bat ? .36 : .20,
    hitDone:false,
    range:range||curWeapon.range||1.8,
    knock:knock||curWeapon.knock||7,
    lethal:lethal!==false
  };
  spawnMeleeTrail(curWeapon.id,side);
}

// Non-lethal melee (FISTS): a punch only staggers + knocks back; it takes several
// hits to down a person. punchHits accumulates per target; PUNCH_DECAY resets it
// if the same target isn't punched again soon (no cross-encounter carry-over).
const PUNCH_TO_DOWN_PED=3;   // punches to drop a pedestrian
const PUNCH_TO_DOWN_TOUGH=4; // gang members / officers are tougher
const PUNCH_DECAY=4;         // seconds: counter resets if not punched again in time
const PUNCH_SHOVE=.9;        // metres a punch shoves the target along the swing

// Register one non-lethal punch on a person target; returns true once it should be
// downed (counter reached the threshold). Resets the counter on a stale timeout.
function tallyPunch(target,threshold){
  if(state.time-(target.lastPunchT||-99)>PUNCH_DECAY)target.punchHits=0;
  target.punchHits=(target.punchHits||0)+1;
  target.lastPunchT=state.time;
  return target.punchHits>=threshold;
}

function resolveMeleeImpact(a){
  const{origin,dir}=aimRay(a.range);
  const hit=findWeaponHit(origin,dir,a.range);
  if(hit.kind==='miss'){thud(2);return;}
  const pos=origin.clone().addScaledVector(dir,hit.d);
  thud(a.kind==='bat'?8:6);
  // FISTS are non-lethal: stagger + shove the person and only down them after
  // enough punches. The BAT (lethal) and firearms keep their one/two-shot kill.
  const punch=a.lethal===false&&(hit.kind==='ped'||hit.kind==='gang'||hit.kind==='officer');
  if(punch){
    const tp=hit.target.g.position;
    tp.x+=dir.x*PUNCH_SHOVE;tp.z+=dir.z*PUNCH_SHOVE; // knock back along the swing
    if(hit.kind==='ped'){if(tallyPunch(hit.target,PUNCH_TO_DOWN_PED))killPed(hit.target,dir);}
    else if(hit.kind==='gang'){if(tallyPunch(hit.target,PUNCH_TO_DOWN_TOUGH))killGangPed(hit.target,dir);}
    else if(tallyPunch(hit.target,PUNCH_TO_DOWN_TOUGH))killOfficer(hit.target);
    return;
  }
  if(hit.kind==='ped')killPed(hit.target,dir);
  else if(hit.kind==='gang')killGangPed(hit.target,dir);
  else if(hit.kind==='officer')killOfficer(hit.target);
  else if(hit.kind==='story')hit.target.kill();
  else if(hit.kind==='rangeTarget')hit.target.hit?.();
  else if(hit.kind==='army')hit.target.hit?.();
  else if(hit.kind==='car'){dentCar(hit.target.g,pos,dir,a.kind==='bat' ? .18 : .1);addWanted(.4,'MELEE ATTACK','melee');}
}

function applyPunchPose(a,p){
  const l=player.g.userData.limbs;if(!l)return;
  const side=a.side;
  const lead=side>0?l.rightArm:l.leftArm;
  const guard=side>0?l.leftArm:l.rightArm;
  const leadFore=side>0?l.rightForearm:l.leftForearm;
  const guardFore=side>0?l.leftForearm:l.rightForearm;
  const wind=1-easeOut(clamp01(p/.18));
  const strike=Math.sin(clamp01((p-.08)/.48)*Math.PI);
  const recover=easeOut(clamp01((p-.48)/.52));
  player.heading=cameraRig.yaw;
  player.g.rotation.y=cameraRig.yaw+side*(.24*wind-.18*strike)*(1-recover);
  setRot(lead,[
    -0.52 - 1.05*strike + .48*wind,
    side*(.30*wind-.18*strike),
    -side*(.62-.42*strike)
  ]);
  setRot(leadFore,[-.88+.74*strike,0,side*.04]);
  setRot(guard,[-.88+.14*strike,-side*.10,side*.56]);
  setRot(guardFore,[-.62,0,0]);
  setRot(l.leftLeg,[-.08*side*strike,0,0]);
  setRot(l.rightLeg,[.08*side*strike,0,0]);
}

function applyBatPose(a,p){
  const l=player.g.userData.limbs;if(!l)return;
  const hit=easeInOut(clamp01((p-.12)/.40));
  const recover=easeOut(clamp01((p-.54)/.46));
  const wind=[-.98,-.46,-1.06],contact=[-1.52,.16,.34],rest=[-.55,0,-.25];
  const windL=[-1.05,.42,.90],contactL=[-1.38,-.20,-.42],restL=[-.38,0,.25];
  const windF=[-.72,0,0],contactF=[-.18,0,0],restF=[-.28,0,0];
  const hitR=mixArr(wind,contact,hit),hitL=mixArr(windL,contactL,hit);
  const recR=mixArr(hitR,rest,recover),recL=mixArr(hitL,restL,recover);
  player.heading=cameraRig.yaw;
  player.g.rotation.y=cameraRig.yaw+lerp(-.32,.34,hit)*(1-recover)+.12*recover;
  setRot(l.rightArm,recR);setRot(l.leftArm,recL);
  setRot(l.rightForearm,mixArr(mixArr(windF,contactF,hit),restF,recover));
  setRot(l.leftForearm,mixArr(mixArr(windF,contactF,hit),restF,recover));
  setRot(l.leftLeg,[-.16*hit,0,0]);setRot(l.rightLeg,[.10*hit,0,0]);

  const h=curWeapon.hold||{};
  const windPos=[.34,1.38,.10],hitPos=[.02,1.18,.80],restPos=[.30,.97,.26];
  const windRot=[-1.55,-.25,-1.20],hitRot=[-.22,.06,.92],restRot=[.52,0,-.28];
  const pos=mixArr(mixArr(windPos,hitPos,hit),restPos,recover);
  const rot=mixArr(mixArr(windRot,hitRot,hit),restRot,recover);
  heldHolder.position.set(pos[0]+(h.x||0),pos[1]+(h.y||0),pos[2]+(h.z||0));
  heldHolder.rotation.set(rot[0]+(h.rx||0),rot[1]+(h.ry||0),rot[2]+(h.rz||0));
}

function updateMeleeAnimation(dt){
  if(!meleeAnim)return false;
  meleeAnim.t+=dt;
  const p=clamp01(meleeAnim.t/meleeAnim.dur);
  if(!meleeAnim.hitDone&&meleeAnim.t>=meleeAnim.hitAt){
    meleeAnim.hitDone=true;
    resolveMeleeImpact(meleeAnim);
  }
  if(meleeAnim.kind==='bat')applyBatPose(meleeAnim,p);
  else applyPunchPose(meleeAnim,p);
  if(p>=1)meleeAnim=null;
  return true;
}

function updateMeleeTrails(dt){
  for(let i=meleeTrails.length-1;i>=0;i--){
    const s=meleeTrails[i];s.t+=dt;
    s.m.material.opacity=Math.max(0,s.m.material.opacity*(1-dt*5));
    s.m.scale.multiplyScalar(1+dt*1.6);
    if(s.t>=s.life){
      s.m.parent?.remove(s.m);
      s.m.geometry.dispose();s.m.material.dispose();
      meleeTrails.splice(i,1);
    }
  }
}

function findWeaponHit(origin,dir,range=48){
  let best={kind:'miss',d:range,target:null,arr:null};
  for(const p of peds){
    if(p.state==='dead'||p.state==='fly')continue;
    const d=rayHitXZ(origin,dir,p.g.position,1.05,range);
    if(d!==null&&d<best.d)best={kind:'ped',d,target:p};
  }
  for(const p of gangPeds){
    if(p.state==='dead'||p.state==='fly')continue;
    const d=rayHitXZ(origin,dir,p.g.position,1.05,range);
    if(d!==null&&d<best.d)best={kind:'gang',d,target:p};
  }
  for(const t of refs.storyTargets?.()||[]){ // alvo de missão de assassinato
    const d=rayHitXZ(origin,dir,t.g.position,1.05,range);
    if(d!==null&&d<best.d)best={kind:'story',d,target:t};
  }
  for(const o of copOfficers){ // policiais a pé também levam bala
    if(o.dead)continue;
    const d=rayHitXZ(origin,dir,o.g.position,1.05,range);
    if(d!==null&&d<best.d)best={kind:'officer',d,target:o};
  }
  for(const arr of[traffic,idleCars,cops]){
    for(const c of arr){
      const d=rayHitXZ(origin,dir,c.g.position,2.1,range);
      if(d!==null&&d<best.d)best={kind:'car',d,target:c,arr};
    }
  }
  for(const t of refs.gunShopTargets?.()||[]){
    const d=rayHitXZ(origin,dir,t,t.r||.8,range);
    if(d!==null&&d<best.d)best={kind:'rangeTarget',d,target:t};
  }
  for(const t of refs.armyTargets?.()||[]){ // dismounted army soldiers (★6)
    const d=rayHitXZ(origin,dir,t.g.position,t.r||1.05,range);
    if(d!==null&&d<best.d)best={kind:'army',d,target:t};
  }
  return best;
}

function killPed(p,dir){
  if(p.state==='dead'||p.state==='fly')return;
  p.state='fly';state.kills++;
  p.bloodDropped=true;
  p.vel.copy(dir).multiplyScalar(9).add(new THREE.Vector3(rand(-1.5,1.5),rand(5,7),rand(-1.5,1.5)));
  addBloodPuddle(p.g.position.x,p.g.position.z);
  spawnDrop(p.g.position.x,p.g.position.z,irand(15,55));
  addWanted(1,'SHOT FIRED!','ped_shot');
}

function makeExplosion(pos){
  const g=makeExplosionModel();g.position.copy(pos);g.position.y=1.2;scene.add(g);
  explosions.push({g,t:0});
  thud(18);blip([80,52],.12,'sawtooth',.28);
}

// Onda de choque da explosão (raio 5): mata quem está perto, amassa e pode
// detonar carros vizinhos em cadeia
// opts.noSelf: skip damage/knockback to the player's own vehicle. Used by toy
// explosions (RC Toyz) whose tiny car is always within the blast radius of its
// own kills, which otherwise dents and brakes it every hit.
function blastDamage(pos,opts){
  const bp=pos.clone().setY(.6);
  const pp=playerPos();
  if(!opts?.noSelf&&pp.distanceTo(pos)<5){
    if(state.mode==='foot')getWasted();
    else if(cur){
      const dir=new THREE.Vector3().subVectors(cur.g.position,pos).setY(0).normalize();
      dentCar(cur.g,bp,dir,.3);cur.speed*=.5;state.shake=.9;
    }
  }
  for(const p of peds){
    if(p.state==='dead'||p.state==='fly')continue;
    if(p.g.position.distanceTo(pos)>=5)continue;
    const dir=new THREE.Vector3().subVectors(p.g.position,pos).setY(0).normalize();
    p.state='fly';p.bloodDropped=false;
    p.vel.copy(dir).multiplyScalar(8).add(new THREE.Vector3(rand(-1,1),rand(6,9),rand(-1,1)));
  }
  for(const p of gangPeds){
    if(p.state==='dead'||p.state==='fly')continue;
    if(p.g.position.distanceTo(pos)<5)
      killGangPed(p,new THREE.Vector3().subVectors(p.g.position,pos).setY(0).normalize());
  }
  for(const o of copOfficers){ // a onda de choque também derruba a dupla
    if(!o.dead&&o.g.position.distanceTo(pos)<5)killOfficer(o);
  }
  refs.blastArmy?.(pos); // army soldiers (★6) caught in the blast
  for(const arr of[traffic,idleCars,cops]){
    for(const c of arr){
      if(c===cur||c.plane)continue;
      const d=c.g.position.distanceTo(pos);
      if(d>=5)continue;
      const dir=new THREE.Vector3().subVectors(c.g.position,pos).setY(0).normalize();
      dentCar(c.g,bp,dir,.25);
      const ud=c.g.userData;
      ud.bulletHits=(ud.bulletHits||0)+2;
      if(ud.bulletHits>=4)
        setTimeout(()=>{if(arr.indexOf(c)>=0)explodeCar(c,arr);},220);
    }
  }
}

// explosão genérica exposta via refs: police.js detona os mísseis das
// lança-foguetes dos policiais sem criar import circular com este módulo
export function explodeAt(pos,opts){
  makeExplosion(pos.clone());
  blastDamage(pos,opts);
}
refs.explodeAt=explodeAt;

function explodeCar(car,arr){
  if(!car||car===cur)return;
  const pos=car.g.position.clone();
  scene.remove(car.g);
  const idx=arr.indexOf(car);
  if(idx>=0)arr.splice(idx,1);
  makeExplosion(pos);
  blastDamage(pos);
  addWanted(1.5,'VEHICLE DESTROYED!','vehicle_destroyed');
  state.shake=.7;
  if(arr===traffic)setTimeout(()=>spawnTraffic(),900);
  // rampage da lança-foguetes: todo carro destruído conta (em cadeia também)
  if(rampage.active){
    rampage.kills++;
    if(rampage.kills>=RAMPAGE_GOAL)endRampage(true);
  }
}

function damageCar(car,arr,pos,dir,dmg=1){
  if(!car||car===cur)return;
  if(pos&&dir)dentCar(car.g,pos,dir,.07); // amassadinho onde a bala pegou
  const ud=car.g.userData;
  ud.bulletHits=(ud.bulletHits||0)+dmg;
  state.shake=Math.max(state.shake,.04);
  addWanted(.35,'SHOT FIRED!','vehicle_shot');
  if(ud.bulletHits>=4)explodeCar(car,arr);
}

function addTracer(origin,end){
  // Keep the true 3D end so first-person tracers angle with the aim (in third
  // person the shot is already level, so end.y === origin.y and nothing changes).
  const line=makeWeaponTracerLine(origin.clone(),end.clone());
  scene.add(line);tracers.push({line,t:0});
}

function addImpact(pos,hit){
  const missed=hit?.kind==='miss';
  const impactRadius=missed ? .16 : .28;
  const ring=makeImpactRing(impactRadius,missed?0xfff2b0:0xffd24a);
  ring.position.set(pos.x,.08,pos.z);
  scene.add(ring);impacts.push({ring,t:0});
}

function makeBullet(origin,dir,{speed=86,range=52,damage=1}={}){
  const g=makeBulletModel();
  g.position.copy(origin);
  g.rotation.y=Math.atan2(dir.x,dir.z);
  g.position.addScaledVector(dir,.55);
  scene.add(g);
  bullets.push({
    g,dir:dir.clone(),prev:origin.clone(),
    speed,life:range/86+.1,dist:0,range,damage
  });
}

function handleBulletHit(hit,pos,dir,damage=1){
  addImpact(pos,hit);
  if(hit.kind==='ped')killPed(hit.target,dir);
  else if(hit.kind==='gang')killGangPed(hit.target,dir);
  else if(hit.kind==='officer')killOfficer(hit.target);
  else if(hit.kind==='story')hit.target.kill();
  else if(hit.kind==='car')damageCar(hit.target,hit.arr,pos,dir,damage);
  else if(hit.kind==='rangeTarget')hit.target.hit?.();
  else if(hit.kind==='army')hit.target.hit?.();
  else if(!refs.inGunShopRange?.())addWanted(.25,'SHOT FIRED!','gunfire');
}

// Spawn do míssil (compartilhado pela lança-foguetes do inventário e pelo rampage).
function spawnMissile(){
  const{origin,dir}=aimRay(70);
  const g=makeMissileModel();
  g.position.copy(origin);
  g.rotation.y=Math.atan2(dir.x,dir.z);
  scene.add(g);
  missiles.push({g,dir:dir.clone(),dist:0,range:75});
}

// Tiro da lança-foguetes do RAMPAGE: cadência lenta, sem munição pra controlar — o
// limite é o relógio. A lança-foguetes do inventário passa pela classe RocketWeapon.
function fireMissile(){
  if(state.time-lastShot<1.15)return;
  lastShot=state.time;
  api.aimPose();
  spawnMissile();
  api.boom();
  state.crosshairKick=1;
  state.shake=Math.max(state.shake,.2);
  gunKick=.16;
}

// Impacto do míssil: carro atingido em cheio explode na hora (explodeCar já
// faz a explosão + onda de choque); qualquer outro impacto detona no ponto
function missileBlast(pos,hit){
  if(hit&&hit.kind==='car')explodeCar(hit.target,hit.arr);
  else{
    if(hit&&hit.kind==='rangeTarget')hit.target.hit?.();
    makeExplosion(pos.clone());
    blastDamage(pos);
    if(!refs.inGunShopRange?.())addWanted(1,'EXPLOSION!','explosion');
  }
  if(hit&&hit.kind==='story')hit.target.kill();
  state.shake=Math.max(state.shake,.4);
}

// ----- comportamentos de disparo (chamados pelas classes via `api`) -----
const _up=new THREE.Vector3(0,1,0);
const _fwd=new THREE.Vector3(0,0,1);

// Uma bala hitscan com espalhamento horizontal opcional (shotgun/automáticas).
function fireOneBullet({range=52,speed=86,damage=1,spread=0}={}){
  const{origin,dir}=aimRay(range);
  if(spread>0){dir.applyAxisAngle(_up,(Math.random()*2-1)*spread);dir.normalize();}
  makeBullet(origin,dir,{speed,range,damage});
  addTracer(origin,origin.clone().addScaledVector(dir,3.2));
}

// Golpe corpo a corpo: acerta o alvo mais próximo logo à frente.
function meleeAttack(range,knock,lethal){
  startMeleeAnimation(range,knock,lethal);
  state.crosshairKick=1;
}

// Jato do lança-chamas: efeito de cone + dano de curto alcance.
function flameAttack(range){
  const{origin,dir}=aimRay(range);
  const jet=makeFlameJetModel();
  jet.position.copy(origin);
  jet.quaternion.setFromUnitVectors(_fwd,dir);
  jet.scale.setScalar(.45+Math.random()*.3);
  scene.add(jet);flameJets.push({g:jet,t:0});
  for(const p of peds){
    if(p.state==='dead'||p.state==='fly')continue;
    if(rayHitXZ(origin,dir,p.g.position,1.4,range)!==null)killPed(p,dir);
  }
  for(const p of gangPeds){
    if(p.state==='dead'||p.state==='fly')continue;
    if(rayHitXZ(origin,dir,p.g.position,1.4,range)!==null)killGangPed(p,dir);
  }
  for(const o of copOfficers){
    if(!o.dead&&rayHitXZ(origin,dir,o.g.position,1.4,range)!==null)killOfficer(o);
  }
  for(const arr of[traffic,idleCars,cops]){
    for(const c of arr){
      if(c===cur||c.plane)continue;
      if(rayHitXZ(origin,dir,c.g.position,2,range)===null)continue;
      const ud=c.g.userData;ud.bulletHits=(ud.bulletHits||0)+1;
      if(ud.bulletHits>=4)explodeCar(c,arr);
    }
  }
}

// Arremesso em arco (granada/molotov).
function throwProjectile(kind,{power=16,fuse}={}){
  const{origin,dir}=aimRay(40);
  const mesh=kind==='molotov'?makeMolotovModel():makeGrenadeModel();
  mesh.position.copy(origin).addScaledVector(dir,.5);
  scene.add(mesh);
  const vel=dir.clone().multiplyScalar(power);vel.y=6.5; // joga pra cima
  thrown.push({g:mesh,vel,kind,fuse:fuse!=null?fuse:0,
    spin:new THREE.Vector3(rand(-6,6),rand(-6,6),rand(-6,6)),life:6});
}

function grenadeExplode(pos){
  makeExplosion(pos.clone());
  blastDamage(pos);
  if(!refs.inGunShopRange?.())addWanted(1,'EXPLOSION!','explosion');
  state.shake=Math.max(state.shake,.4);
}

function molotovImpact(pos){
  addFirePool(pos);
  blastDamage(pos);            // estouro inicial pega quem está bem perto
  if(!refs.inGunShopRange?.())addWanted(1,'EXPLOSION!','explosion');
  thud(10);blip([120,80],.18,'sawtooth',.22);
  state.shake=Math.max(state.shake,.25);
}

function addFirePool(pos){
  const g=makeFireModel();
  g.position.set(pos.x,groundHeight(pos.x,pos.z)+.02,pos.z);
  scene.add(g);
  firePools.push({g,t:0,life:4.5,nextTick:0,radius:2.6});
}

// Detonador: planta a carga no 1º aperto, detona no 2º.
function detonatorAction(){
  if(!plantedBomb){
    const pp=playerPos();
    const g=makeGrenadeModel();g.scale.setScalar(1.3);
    g.position.set(pp.x,groundHeight(pp.x,pp.z)+.12,pp.z);
    scene.add(g);plantedBomb={g};
    message('BOMB PLANTED - FIRE AGAIN TO DETONATE','var(--gold)');
    blip([440,520],.08,'square',.14);
  }else{
    const pos=plantedBomb.g.position.clone();
    scene.remove(plantedBomb.g);plantedBomb=null;
    grenadeExplode(pos);
    message('DETONATED','var(--pink)');
  }
}

// Objeto injetado nas classes de arma (js/weapon-types.js): expõe mira, pose,
// recuo, sons e os spawns de projétil/efeito sem que as classes importem este
// módulo (evita ciclo de import).
const api={
  get now(){return state.time;},
  aimPose(){
    player.heading=cameraRig.yaw;
    player.g.rotation.y=cameraRig.yaw;
    // FP: place the viewmodel (its muzzle is what the shot reads); body pose would
    // put the holder in body-space and throw off the muzzle world position.
    if(fpHolderActive())applyViewModel();
    else if(curWeapon.category!=='melee')posePlayerWithGun();
    player.g.updateWorldMatrix(true,true);
  },
  recoil(r){
    if(!r)return;
    if(r.kick)gunKick=Math.max(gunKick,r.kick);
    state.crosshairKick=r.crosshair??1;
    if(r.shake)state.shake=Math.max(state.shake,r.shake);
  },
  outOfAmmo(){message('OUT OF AMMO','var(--pink)');},
  gunshot(v){gunshot(v);},
  bullet(opts){fireOneBullet(opts);},
  melee(range,knock,lethal){meleeAttack(range,knock,lethal);},
  swoosh(){blip([200,130],.05,'sawtooth',.1);},
  missile(){spawnMissile();},
  boom(){thud(7);blip([95,60],.16,'sawtooth',.3);},
  flame(range){flameAttack(range);},
  throwProjectile(kind,opts){throwProjectile(kind,opts);},
  toss(){blip([320,260],.06,'sine',.12);},
  detonator(){detonatorAction();}
};

export function shootWeapon(){
  if(state.mode!=='foot'||state.swimming)return; // sem disparo dentro d'água
  if(rampage.active)return fireMissile();
  curWeapon.tryFire(api);
}

const _missileProbe=new THREE.Vector3();

// Anima detalhes do modelo na mão: chama do molotov, piloto do lança-chamas e
// a luz pisca-pisca do detonador.
function animateHeldWeapon(){
  if(!heldModel||!heldHolder.visible)return;
  const u=heldModel.userData;
  if(u.flame)u.flame.scale.setScalar(.8+Math.random()*.5);
  if(u.pilot)u.pilot.scale.setScalar(.7+Math.random()*.7);
  if(u.lamp)u.lamp.visible=Math.floor(state.time*(plantedBomb?8:3))%2===0;
}

export function updateWeapons(dt){
  // nadando o jogador guarda a arma: nada de modelo na mão, pose de mira ou tiro
  // (a pose do nado controla os membros — ver player.js animateSwim)
  const swimming=state.swimming;
  const rampaging=rampage.active&&state.mode==='foot'&&!swimming;
  heldRocket.visible=rampaging;
  // arma na mão: aparece sempre que está a pé e tem modelo (o punho não tem).
  const showHeld=state.mode==='foot'&&!rampaging&&!swimming&&!!curWeapon.makeModel;
  heldHolder.visible=showHeld;
  // first person: reparent the held weapon to the camera BEFORE posing, so the body
  // pose below writes into the correct space (and the body keeps it when not in FP).
  syncViewModel();
  // pose de mira pras armas de pontaria; melee tem animação própria de golpe.
  const meleeAnimating=!swimming&&updateMeleeAnimation(dt);
  if(!swimming&&!meleeAnimating){
    if(rampaging||(showHeld&&curWeapon.aimed))posePlayerWithGun();
    else if(showHeld)carryPose();
  }
  // first person: override the holder with its Counter-Strike-style viewmodel pose.
  applyViewModel();
  gunKick=Math.max(0,gunKick-dt*.55);
  updateMeleeTrails(dt);

  // fogo automático: segurar o botão mantém o disparo (uzi/ak/m16/lança-chamas)
  if(input.shootHeld&&curWeapon.automatic&&!rampaging&&!swimming&&state.mode==='foot'&&
     !state.paused&&!state.dlgActive&&!state.orientationBlocked&&!state.controlsLocked&&!state.wheelOpen)
    curWeapon.tryFire(api);

  syncWeaponState();
  animateHeldWeapon();

  // ----- rampage da lança-foguetes: relógio, placar e fim por morte/prisão -----
  if(rampage.active){
    if(state.mode==='cut')endRampage(false); // WASTED/BUSTED encerra o desafio
    else if(state.time>rampage.end)endRampage(false);
    else if(rampageEl){
      rampageEl.style.display='block';
      rampageEl.textContent=
        `ROCKET FRENZY ${rampage.kills}/${RAMPAGE_GOAL} CARS - ${Math.ceil(rampage.end-state.time)}s`;
    }
  }else{
    if(!rocketPickup.visible&&rocketRespawnAt>=0&&state.time>rocketRespawnAt)
      rocketPickup.visible=true;
    if(rocketPickup.visible){
      rocketPickup.rotation.y+=dt*1.2;
      rocketPickup.position.y=groundHeight(ROCKET_X,ROCKET_Z)+.95+Math.sin(state.time*2.6)*.1;
      // pegar é encostar (igual às portas): o rampage começa na hora — mas só se
      // nenhuma outra sessão de mini game estiver rolando (não concede arma/trava antes).
      if(state.started&&state.mode==='foot'&&!state.controlsLocked&&!MiniGame.busy&&
        playerPos().distanceTo(rocketPickup.position)<2.6)beginRampage();
    }
  }

  // mísseis em voo: raio contra alvos no passo, prédios/limites via solids
  for(let i=missiles.length-1;i>=0;i--){
    const m=missiles[i];
    const step=34*dt;
    const hit=findWeaponHit(m.g.position,m.dir,step+1.2);
    if(hit.kind!=='miss'){
      missileBlast(m.g.position.clone().addScaledVector(m.dir,hit.d),hit);
      disposeGeometries(m.g);scene.remove(m.g);missiles.splice(i,1);continue;
    }
    m.g.position.addScaledVector(m.dir,step);
    m.dist+=step;
    _missileProbe.copy(m.g.position);
    if(collideStatics(_missileProbe,.3,SWIM_BOUND)||m.dist>=m.range||
      m.g.position.y<=groundHeight(m.g.position.x,m.g.position.z)){ // encosta da montanha
      missileBlast(m.g.position.clone(),null);
      disposeGeometries(m.g);scene.remove(m.g);missiles.splice(i,1);continue;
    }
    m.g.userData.flame.scale.setScalar(.7+Math.random()*.6); // chama tremula
    addTracer(m.g.position.clone().addScaledVector(m.dir,-1.1),m.g.position);
  }
  // Alvo do crosshair (cor do retículo): findWeaponHit varre ~70 entidades. É
  // puramente cosmético, então recalcula a ~20fps em vez de todo frame.
  _xhairT-=dt;
  if(isWeaponHeld()&&!state.paused&&!state.dlgActive&&!state.orientationBlocked){
    if(_xhairT<=0){
      _xhairT=.05;
      const{origin,dir}=aimRay();
      state.crosshairTarget=findWeaponHit(origin,dir,48).kind!=='miss';
    }
  }else state.crosshairTarget=false;
  if(!state.hasGun){
    for(let i=0;i<weaponPickups.length;i++){
      const g=weaponPickups[i];
      if(!g.parent)continue;
      g.rotation.y+=dt*(1.45+i*.08);
      g.position.y=g.userData.baseY+Math.sin(state.time*3+i)*.08;
    }
  }
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.life-=dt;
    const step=b.speed*dt;
    const hit=findWeaponHit(b.g.position,b.dir,step);
    if(hit.kind!=='miss'){
      const hitPos=b.g.position.clone().addScaledVector(b.dir,hit.d);
      handleBulletHit(hit,hitPos,b.dir,b.damage);
      disposeGeometries(b.g);scene.remove(b.g);
      bullets.splice(i,1);
      continue;
    }
    b.prev.copy(b.g.position);
    b.g.position.addScaledVector(b.dir,step);
    b.dist+=step;
    const trailEnd=b.g.position.clone().addScaledVector(b.dir,-Math.min(1.8,b.dist*.45));
    addTracer(trailEnd,b.g.position);
    if(b.life<=0||b.dist>=b.range){
      addImpact(b.g.position,{kind:'miss'});
      disposeGeometries(b.g);scene.remove(b.g);
      bullets.splice(i,1);
    }
  }
  for(let i=explosions.length-1;i>=0;i--){
    const e=explosions[i];e.t+=dt;
    const s=1+e.t*4;
    e.g.scale.set(s,s,s);
    e.g.traverse(o=>{if(o.material)o.material.opacity=Math.max(0,o.material.opacity-dt*1.6);});
    if(e.t>.75){disposeGeometries(e.g);scene.remove(e.g);explosions.splice(i,1);}
  }
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.t+=dt;
    t.line.material.opacity=Math.max(0,1-t.t*8);
    if(t.t>.14){disposeGeometries(t.line);scene.remove(t.line);tracers.splice(i,1);}
  }
  for(let i=impacts.length-1;i>=0;i--){
    const p=impacts[i];p.t+=dt;
    const s=1+p.t*5;
    p.ring.scale.set(s,s,s);
    p.ring.material.opacity=Math.max(0,.85-p.t*4);
    if(p.t>.25){disposeGeometries(p.ring);scene.remove(p.ring);impacts.splice(i,1);}
  }

  // ----- arremessáveis em voo (granada/molotov) -----
  for(let i=thrown.length-1;i>=0;i--){
    const t=thrown[i];
    t.life-=dt;
    t.vel.y-=18*dt; // gravidade
    t.g.position.addScaledVector(t.vel,dt);
    t.g.rotation.x+=t.spin.x*dt;t.g.rotation.z+=t.spin.z*dt;
    const gh=groundHeight(t.g.position.x,t.g.position.z);
    if(t.kind==='molotov'){
      _molDir.set(t.vel.x,0,t.vel.z);
      const hitTarget=_molDir.lengthSq()>.0001&&
        findWeaponHit(t.g.position,_molDir.normalize(),.8).kind!=='miss';
      if(t.g.position.y<=gh+.1||hitTarget||t.life<=0){
        const pos=t.g.position.clone();
        if(t.g.position.y<=gh+.1)pos.y=gh;
        molotovImpact(pos);
        disposeGeometries(t.g);scene.remove(t.g);thrown.splice(i,1);
      }
    }else{ // granada: quica no chão e detona pelo tempo (fuse)
      t.fuse-=dt;
      if(t.g.position.y<=gh+.1){
        t.g.position.y=gh+.1;
        t.vel.y=Math.abs(t.vel.y)*.42;t.vel.x*=.6;t.vel.z*=.6;
      }
      if(t.fuse<=0||t.life<=0){
        grenadeExplode(t.g.position.clone());
        disposeGeometries(t.g);scene.remove(t.g);thrown.splice(i,1);
      }
    }
  }

  // ----- jatos do lança-chamas (efeito visual de vida curta) -----
  for(let i=flameJets.length-1;i>=0;i--){
    const f=flameJets[i];f.t+=dt;
    f.g.scale.multiplyScalar(1+dt*2.2);
    f.g.traverse(o=>{if(o.material&&o.material.opacity!=null)
      o.material.opacity=Math.max(0,o.material.opacity-dt*4.5);});
    if(f.t>.18){disposeGeometries(f.g);scene.remove(f.g);flameJets.splice(i,1);}
  }

  // ----- poças de fogo do molotov: dano por tempo a pé/peds/carros -----
  for(let i=firePools.length-1;i>=0;i--){
    const fp=firePools[i];fp.t+=dt;fp.nextTick-=dt;
    for(const fl of fp.g.userData.flames||[])fl.scale.y=.7+Math.random()*.7;
    if(fp.nextTick<=0){
      fp.nextTick=.5;
      const c=fp.g.position;
      const near=p=>Math.hypot(p.g.position.x-c.x,p.g.position.z-c.z)<fp.radius;
      for(const p of peds)if(p.state!=='dead'&&p.state!=='fly'&&near(p))killPed(p,_up);
      for(const p of gangPeds)if(p.state!=='dead'&&p.state!=='fly'&&near(p))killGangPed(p,_up);
      for(const arr of[traffic,idleCars,cops])for(const car of arr){
        if(car===cur||car.plane||!near(car))continue;
        const ud=car.g.userData;ud.bulletHits=(ud.bulletHits||0)+1;
        if(ud.bulletHits>=4)explodeCar(car,arr);
      }
      if(state.mode==='foot'&&playerPos().distanceTo(c)<fp.radius)getWasted();
    }
    if(fp.t>fp.life-1)
      fp.g.traverse(o=>{if(o.material&&o.material.opacity!=null)
        o.material.opacity=Math.max(0,o.material.opacity-dt*.9);});
    if(fp.t>fp.life){disposeGeometries(fp.g);scene.remove(fp.g);firePools.splice(i,1);}
  }
}
