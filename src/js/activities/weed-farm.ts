import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {playerPos,player,idleCars,cameraRig,cur,getBusted} from '@/actors/player.ts';
import {economy} from '@/core/economy.ts';
import {addWanted} from '@/core/physics.ts';
import {groundHeight} from '@/core/constants.ts';
import {roadside} from '@/world/divinolandia/nav.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {blip} from '@/audio/audio.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {makePed,animatePed,makeMotorcycle} from '@/core/entities.ts';
import {say} from '@/ui/speech.ts';
import {WEED_CX,WEED_CZ,WEED_SLOTS,WEED_BOX,WEED_TAP,WEED_RACK,WEED_GATE,GATE_HALF,
  TAP_YAW,SALE_YAW,TAP_SPOUT,TAP_BUCKET_REST,CRATE_LOCAL,CRATE_INNER,
  TABLE_TOP_Y,TRIM_PLANT_LOCAL,TRIM_TRAY_LOCAL,TRIM_SHEARS_LOCAL,TRIM_STAND_LOCAL,
  makeWeedPlant,addWeedFarm} from '../../assets/models/rural/weed-farm.ts';
import {makeFarmBucket} from '../../assets/models/rural/farm-bucket.ts';
import {makeHarvestedPlant,makeFlowerBud} from '../../assets/models/rural/weed-harvest.ts';
import {makeTrimShears} from '../../assets/models/rural/trim-shears.ts';
import {makeBudTray,TRAY_W,TRAY_D} from '../../assets/models/rural/bud-tray.ts';
import {fpHeld,fpHeldObject,fpBusy,setHeld,fpPickUp,fpPlace,fpFill,fpPour,fpSow,fpUproot,fpSnip,fpTipTray,tossPiece,flyTo,
  abortActions,updateFarmFocus} from '@/activities/weed-farm-fp.ts';
import {makeWeedBackpack} from '../../assets/models/rural/weed-backpack.ts';
import {MiniGameId} from '@/activities/minigame.ts';
import {markMiniGamePlayed} from '@/activities/minigame-intro.ts';
import {STRAINS,STRAIN_BY_ID,FERTILIZER} from '@/activities/strains.ts';
import {getDay} from '@/world/daynight.ts';
import {Npc} from '@/actors/npc.ts';
import {peds,type Ped} from '@/world/pedestrians.ts'; // street peds that like weed (flag you down)

// ============================================================================
// GREEN ACRES — the HIDDEN weed-farm activity, played entirely in the 3D world on
// foot inside the walled compound (the compound is in
// assets/models/rural/weed-farm.ts). No map blip, no HUD, no floating markers:
// the FARM ITSELF tells you everything. Everything is done BY HAND, in first
// person (the hands, what they hold and every animation live in
// js/activities/weed-farm-fp.ts):
//
//   1. SOW    — at an empty planter bed, pinch seeds, flick them into the soil and
//               pat it down → a seedling pops up.
//   2. WATER  — pick up the BUCKET at the standpipe, hold it under the faucet and
//               watch it fill; carry it to a bed and TIP it — the water pours onto
//               the soil (which darkens). One bucket (or more, with upgrades) per fill.
//   3. GROW   — read the crop by LOOKING at it: a thirsty plant droops and its soil
//               dries pale; keeping it watered raises its QUALITY; left dry it dies.
//   4. HARVEST— grip a ripe plant with both hands and PULL it out, roots and all. You
//               carry ONE plant at a time (better-tended plants hold more buds).
//   5. DRY    — hang each plant upside down on the drying RACK (mandatory): in a few
//               seconds it dries and turns golden-brown. Take it back down.
//   6. TRIM   — lay the dried plant on the work table, pick up the trimming shears, cut
//               off the fan leaves and snip each bud off the stem into the tray (the
//               "bucking + manicure" growers do before curing). The bare stem is tossed.
//   7. STASH  — tip the tray of buds into the wooden CRATE.
//   8. DELIVER— take the stash OUT of the crate: the player straps on a backpack and
//               enters a DELIVERY RUN to buyers across the country and the city.
//
// Open-world activity: zone actions + a per-frame update, no world lock.
// ============================================================================

const WEED_BUILD=' ◆ PLANTAÇÃO';
document.getElementById('buildver')?.insertAdjacentText('beforeend',WEED_BUILD);

// ---------- tuning ----------
const RANGE=2.8;          // interaction radius to a bed / tap / sale table
const BUCKET_DROP_DIST=18;// wander this far from the plot and a carried bucket is left behind
const GROW_TIME=REWARDS.weedFarm.growTimeSec;       // seconds of HYDRATED growth from seedling to ripe
const HYD_DRAIN=REWARDS.weedFarm.hydrationDrainPerSec;        // hydration lost per second (a bucket lasts ~25 s)
const DRY_DEATH=REWARDS.weedFarm.dryDeathSec;       // seconds bone-dry before the plant wilts and dies
const SEED_F=0.18;        // growth fraction where the seedling becomes a plant
const POUR_TIME=REWARDS.weedFarm.pourTimeSec;      // length of the pour-the-bucket animation (s)
const PRICE=REWARDS.weedFarm.pricePerBud;  // base cash per bud at the sale table
// quality (care matters): recovers while well-watered, bleeds while parched
const QUALITY_START=78, QUALITY_RECOVER=3, QUALITY_DROP=9, HYD_HEALTHY=30;
const YIELD_MIN=2, YIELD_MAX=6; // buds from a ripe plant, by its locked quality

// a planted crop growing on a bed (its body shows its state)
interface Plant{
  g: THREE.Object3D;
  wet: THREE.Mesh;
  glow: THREE.Mesh|null;
  stage: 'seed'|'growing'|'ripe'|'dead';
  t: number;
  hyd: number;
  dryT: number;
  strain: string;
  quality: number;
  baseY: number;
  phase: number;
  pop: number;
  fed?: boolean;
}
// a planter bed (world-space) with the plant currently on it (or none)
interface Slot{x:number;z:number;plant:Plant|null;}

// world-space slot / sale / tap / rack positions (mirror the baked compound)
const slots: Slot[]=WEED_SLOTS.map(s=>({x:WEED_CX+s.x,z:WEED_CZ+s.z,plant:null}));
const box={x:WEED_CX+WEED_BOX.x,z:WEED_CZ+WEED_BOX.z};
const tap={x:WEED_CX+WEED_TAP.x,z:WEED_CZ+WEED_TAP.z};
const rackPos={x:WEED_CX+WEED_RACK.x,z:WEED_CZ+WEED_RACK.z};
const shackPos={x:WEED_CX-7.5,z:WEED_CZ-4};   // grow-shack front doubles as the upgrade bench

let waterCharges=0;       // pours left in the carried bucket (filled at the tap)
// ---------- farm upgrades (bought at the grow shack; persisted via the save) ----------
// Tiers of watering gear cut the tap-trip tedium; the top tier waters the beds for you.
const UPGRADES=[
  {name:'BALDE MAIOR',    price:REWARDS.weedFarm.upgradePrices[0],  desc:'REGA 3 PLANTAS POR ENCHIDA'},
  {name:'MANGUEIRA',      price:REWARDS.weedFarm.upgradePrices[1], desc:'REGA 8 PLANTAS POR ENCHIDA'},
  {name:'IRRIGAÇÃO POR GOTEJO',price:REWARDS.weedFarm.upgradePrices[2], desc:'OS CANTEIROS SE REGAM SOZINHOS'},
];
const WATER_CAP=[1,3,8,8];   // bucket capacity by upgrade level
let upLevel=0;               // 0 = bare bucket … 3 = sprinklers installed
const canCapacity=()=>WATER_CAP[Math.min(upLevel,3)];
const hasSprinklers=()=>upLevel>=3;
let boxed=0;              // flowers delivered this life (debug)

// ---------- deposit box → backpack → delivery run ----------
// The crate is a DEPOSIT box: stashing pays nothing. Take the stash OUT and the
// player straps on a backpack and enters a DELIVERY RUN — carry it to buyers spread
// across the countryside and the city and DEAL it for cash (city buyers pay a premium
// for the trek). Touch the box again (empty-handed) to hand the backpack back.
const deposit={buds:0,val:0};                 // stash sitting in the box (no cash here)
const pack={active:false,buds:0,val:0,orig:0}; // what the backpack carries on a run
let backpackObj: THREE.Object3D|null=null;     // the 3D pack worn on the player's back
let delivering=false;
let packItems: {buds:number;val:number;strain:string;quality:number;cured:boolean}[]=[]; // the plants the pack holds (to refill the crate on return)
const DELIV_RANGE=2.6;
// buyers: a few country roadside spots + a few corners in the town (spawned only during
// a run), each on the kerb of a real Divinolândia street (nav.roadside, town-local
// coordinates). `gated` marks a buyer that is hard to reach: it is EXCLUDED from the
// "out of buyers → respawn a fresh batch" check so a player is never left holding a
// stash with no reachable buyer (see deliverTo).
const buyerSpot=(lx:number,lz:number,city:boolean,gated=false)=>({...roadside(lx,lz,2),city,gated});
const DELIV_POINTS: {x:number;z:number;city:boolean;gated?:boolean}[]=[
  buyerSpot(-150,560,false),   // the road out past the cemetery, toward the hospital
  buyerSpot(-560,-610,false),  // the rodovia west, by the river bridge
  buyerSpot(900,520,false),    // dirt road south-east, past the last houses
  buyerSpot(60,-20,true),      // the Matriz square
  buyerSpot(560,90,true),      // Praça Jorge Galhano
  buyerSpot(-300,140,true),    // the west neighbourhoods
  buyerSpot(716,1940,true,true), // up at the Morro da Torre mirante (premium, a long climb)
];
// a live delivery buyer placed in the world during a run
// A weed buyer waiting at a deal point. Extends Npc (so 100% of NPCs share the
// base class) with register:false — buyers are dealt to, never shot, so they stay
// out of the unified weapon scan. `ped` aliases the base `g` for the existing code.
class Buyer extends Npc{
  x:number;z:number;city:boolean;gated:boolean;served:boolean;want:number;t:number;
  constructor(g:THREE.Object3D,x:number,z:number,city:boolean,gated:boolean,want:number){
    super(g,{kind:'buyer',hp:1,register:false,area:city?'Comprador da cidade':'Comprador da roça'});
    this.x=x;this.z=z;this.city=city;this.gated=gated;this.served=false;this.want=want;this.t=0;
  }
  get ped():THREE.Object3D{return this.g;}
  override aliveState():string{return this.served?'Negócio fechado':'Esperando o negócio';}
}
let buyers: Buyer[]=[];

addWeedFarm(); // the walled compound in its hollow across the Rio do Peixe
// HEAT — the push-your-luck risk. Each deal raises it (city more), it cools over time.
// Above WARM, deals can be a STING (undercover cop → no pay + a wanted spike); linger
// at the farm while HOT and you draw a RAID. The run HUD shows it so it's never blind RNG.
let heat=0, runEarned=0, farmLinger=0;
const HEAT_WARM=40, HEAT_HOT=60;
const weedHud=typeof document!=='undefined'?document.getElementById('weedhud'):null;
const nearFarm=()=>{const p=playerPos();return Math.hypot(p.x-WEED_CX,p.z-WEED_CZ)<30;};

// ---------- parked motorcycle waiting outside the gate ----------
// A free idle bike (flag `bike`, like the city ones) always sits just NORTH of the
// gate, off to the side so it never blocks the walk-in. Roll up, run the farm on
// foot, then hop on it to start the delivery run. The worn backpack auto-hides on
// any vehicle (see updateWeedFarm), and a driven vehicle can't ride in through the
// gate (the gate guard in updateWeedFarm bounces it back out).
(function spawnFarmBike(){
  const x=WEED_GATE.x+4.5, z=WEED_GATE.z+0.8;          // beside the gate, clear of the opening
  const g=makeMotorcycle(0x6a7c3f);                    // muted farm-green
  g.position.set(x,groundHeight(x,z),z);g.rotation.y=0;// nose pointing away from the gate
  idleCars.push({g,heading:0,speed:0,name:'BIZ',police:false,bike:true});
})();

// ---------- buyers' patter: a fat pool of random, funny one-liners a buyer blurts
// out when you deal to them (shown as a floating speech bubble during the deal). ----
const pick=<T>(a: T[]): T=>a[(Math.random()*a.length)|0];
const WEED_BUYER_LINES=[
  "Valeu pela erva, parceiro!",
  "Esse bud vai salvar minha semana inteira.",
  "A larica tá chamando — fui!",
  "Você salvou minha vida, mano.",
  "Da melhor, do jeito que você prometeu.",
  "Eu e meu sofá agradecemos do fundo do coração.",
  "Finalmente, da BOA!",
  "Prazer fazer negócio, amigo.",
  "Já tá com cheiro de fim de semana bom.",
  "Mantém verde, mantém limpo.",
  "Eu tava QUASE ficando careta. Ufa.",
  "Deus abençoe você e sua hortinha.",
  "Fala pras plantas que eu agradeci.",
  "É medicinal. Pra minha vibe.",
  "Na hora certa, os salgadinhos tão esperando.",
  "Você planta, eu queimo!",
  "O controle de qualidade aprova.",
  "Meu médico não aprova, mas minha alma sim.",
  "Até a próxima colheita, lenda.",
  "Discreto como sempre. Adoro.",
  "Agora é desenho animado a noite toda.",
  "Melhor fornecedor da região inteira.",
  "Suave, verdinho e muito sereno.",
  "Não conta pro dono da casa, beleza?",
  "Vou dar seu nome pra minha próxima planta.",
  "A pizza tá chegando — timing perfeito.",
  "Você ganhou minha terça-feira.",
  "Sempre vale a viagem até aqui.",
  "Psiu — você não me viu, eu não te vi.",
  "Combina demais com não ter nada pra fazer.",
  "Modo sofá: ativado.",
  "Que alívio. Valeu, chefe.",
  "Meu gato vai amar como eu fico tranquilo.",
  "Cinco estrelas. Compraria de novo.",
  "Fica com o troco e com o segredo.",
  "A melhor da região, sem dúvida.",
  "Ahh, o remédio pra semana puxada.",
  "Cheirinho de casa. Valeu mesmo.",
];

let armPosed=false;       // true while the hero's arm is posed (deal hand-off)
const _wp=new THREE.Vector3();

// ---------- world anchors (the standpipe faucet, the bucket's rest spot, the crate) ----------
// Rotate a LOCAL (x,z) offset by a prop's yaw exactly as THREE's rotation.y does.
const yawXZ=(x: number,z: number,yaw: number)=>({x:x*Math.cos(yaw)+z*Math.sin(yaw),z:-x*Math.sin(yaw)+z*Math.cos(yaw)});
const tapGY=groundHeight(tap.x,tap.z);
const spoutW=(()=>{const o=yawXZ(TAP_SPOUT.x,TAP_SPOUT.z,TAP_YAW);return new THREE.Vector3(tap.x+o.x,tapGY+TAP_SPOUT.y,tap.z+o.z);})();
const bucketRestW=(()=>{const o=yawXZ(TAP_BUCKET_REST.x,TAP_BUCKET_REST.z,TAP_YAW);return new THREE.Vector3(tap.x+o.x,tapGY+TAP_BUCKET_REST.y,tap.z+o.z);})();
const crateW=(()=>{const o=yawXZ(CRATE_LOCAL.x,CRATE_LOCAL.z,SALE_YAW);
  return new THREE.Vector3(box.x+o.x,groundHeight(box.x,box.z)+CRATE_LOCAL.y+CRATE_INNER.floorY,box.z+o.z);})();

// ---------- the ONE bucket: resting under the faucet, in your hand, or set down ----------
const bucket=makeFarmBucket();
const setBucketWater=bucket.userData.setWater as (f: number)=>void;
function restBucketAtTap(): void{
  if(bucket.parent!==scene)scene.add(bucket);
  bucket.position.copy(bucketRestW);bucket.rotation.set(0,TAP_YAW,0);bucket.scale.setScalar(1);
}
restBucketAtTap();
const holdingBucket=()=>fpHeld()==='bucket';
const bucketFree=()=>!holdingBucket()&&bucket.parent===scene; // lying in the world, pick-up-able

// ---------- a harvested plant: carried one at a time, laid in the crate / hung / dropped ----------
interface Harvest{buds:number;val:number;strain:string;quality:number;cured:boolean;}
let heldPlant: Harvest|null=null;
const groundPlants: {obj:THREE.Object3D;data:Harvest}[]=[];   // plants put down anywhere
const holdingPlant=()=>fpHeld()==='plant'&&!!heldPlant;
const handsFree=()=>fpHeld()==='none';

const rand=(a: number,b: number)=>a+Math.random()*(b-a);
const dist=(p: {x:number;z:number},o: {x:number;z:number})=>Math.hypot(p.x-o.x,p.z-o.z);
const clamp01=(v: number)=>v<0?0:v>1?1:v;
const playerLimbs=()=>player?.g?.userData?.limbs||null;

const grade=(q: number)=>q>=85?'PREMIUM':q>=65?'DA BOA':q>=40?'MEDIANA':'PRENSADO';
// ---------- seeds & strains ----------
const seedCount=(id: string)=>state.seeds[id]|0;
const totalSeeds=()=>STRAINS.reduce((s,st)=>s+seedCount(st.id),0);
// which strain the next planting uses: the one selected at the store if you still
// have it, else the first strain you DO have seeds of.
function plantStrain(): string{
  if(seedCount(state.seedSel)>0)return state.seedSel;
  const s=STRAINS.find(st=>seedCount(st.id)>0);
  return s?s.id:'';
}
// the street price swings each in-game day (a stable per-day factor in
// [marketFactorMin, marketFactorMin+marketFactorSpan], tuned in minigame-rewards.json),
// so WHEN you run the deliveries matters; city buyers add a premium on top.
const marketFactor=()=>{const r=Math.abs(Math.sin((getDay()+1)*12.9898))%1;return REWARDS.weedFarm.marketFactorMin+r*REWARDS.weedFarm.marketFactorSpan;};

// ---------- plant lifecycle ----------
const soilPoint=(slot: Slot)=>new THREE.Vector3(slot.x,groundHeight(slot.x,slot.z)+.38,slot.z);
const reserved=new Set<Slot>();                 // beds with a clip in flight on them

function sow(slot: Slot): void{
  if(slot.plant||reserved.has(slot))return;
  // seeds are bought at the rural General Store (js/places/general-store.ts); no seed, no planting
  const sid=plantStrain();
  if(!sid){
    message('SEM SEMENTES - COMPRE NO ARMAZÉM','var(--pink)');
    blip([300,220],.06,'square',.08);
    return;
  }
  state.seeds[sid]--;
  reserved.add(slot);
  const st=STRAIN_BY_ID[sid];
  fpSow(soilPoint(slot),false,{
    onLand:()=>{
      const y=soilPoint(slot).y;                    // sits on the raised planter soil
      const g=makeWeedPlant(1,false,st.color);      // tinted to the strain
      g.position.set(slot.x,y,slot.z);g.rotation.y=rand(0,Math.PI*2);g.scale.setScalar(.01);
      // wet-soil decal: a dark disc over the bed whose opacity tracks hydration
      const wet=new THREE.Mesh(new THREE.CircleGeometry(.95,16),
        new THREE.MeshBasicMaterial({color:0x1c0d04,transparent:true,opacity:0,depthWrite:false}));
      wet.rotation.x=-Math.PI/2;wet.position.set(slot.x,y+.005,slot.z);
      scene.add(g,wet);
      slot.plant={g,wet,glow:null,stage:'seed',t:0,hyd:45,dryT:0,strain:sid,
        quality:QUALITY_START,baseY:y,phase:rand(0,6.28),pop:.9};
      blip([392,523],.06,'sine',.13);
    },
    onDone:()=>{reserved.delete(slot);message(`${st.name} PLANTADA - PEGUE O BALDE NA TORNEIRA E REGUE`,'var(--cyan)');},
  });
}

function pickUpBucket(): void{
  fpPickUp(bucket,'bucket',{onGrab:()=>blip([330,392],.05,'sine',.1)});
}
function fillBucket(): void{
  const cap=canCapacity();
  fpFill(spoutW,waterCharges/cap,1,{onDone:()=>{
    waterCharges=cap;
    message(cap>1?`BALDE CHEIO - ${cap} REGADAS`:'BALDE CHEIO - LEVE ATÉ UMA PLANTA E REGUE','var(--cyan)');
    blip([392,523,659],.06,'sine',.13);
  }});
}
// set the bucket down: back under the faucet, or on the ground right in front of you
function putBucketDown(atTap: boolean): void{
  const pos=atTap?bucketRestW.clone():(()=>{
    // beside you, on your right and a step ahead — pushed out of any planter bed
    const p=playerPos(),f=cameraRig.yaw;
    let x=p.x+Math.sin(f)*.45-Math.cos(f)*.6,z=p.z+Math.cos(f)*.45+Math.sin(f)*.6;
    for(const sl of slots){
      const dx=x-sl.x,dz=z-sl.z;
      if(Math.abs(dx)<1.2&&Math.abs(dz)<1.2){
        if(Math.abs(dx)>Math.abs(dz))x=sl.x+Math.sign(dx||1)*1.3;else z=sl.z+Math.sign(dz||1)*1.3;
      }
    }
    return new THREE.Vector3(x,groundHeight(x,z)+.3,z);
  })();
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),atTap?TAP_YAW:cameraRig.yaw);
  fpPlace({pos,quat:q,scale:1},{hover:.15,focus:pos,stepDist:atTap?.9:undefined});
}

// Tip the bucket over a bed: the soil drinks as the water lands.
function water(slot: Slot): void{
  const pl=slot.plant;
  if(!pl||pl.stage==='dead'||waterCharges<=0||reserved.has(slot))return;
  const cap=canCapacity(),h0=pl.hyd;
  const from=waterCharges/cap;waterCharges--;
  reserved.add(slot);
  fpPour(soilPoint(slot),from,waterCharges/cap,{pourTime:POUR_TIME,
    onProgress:(k)=>{const p=slot.plant;if(p&&p.stage!=='dead')p.hyd=Math.max(p.hyd,h0+(100-h0)*k);},
    onDone:()=>{
      reserved.delete(slot);
      const p=slot.plant;if(p&&p.stage!=='dead'){p.hyd=100;p.pop=.35;}
      if(waterCharges<=0)message('BALDE VAZIO - ENCHA DE NOVO NA TORNEIRA','var(--cyan)');
    }});
}

// rebuild the plant as a frosted, ripe cola at full size + a soft glistening glow
function setRipe(slot: Slot): void{
  const pl=slot.plant!;
  scene.remove(pl.g);
  const g=makeWeedPlant(1,true,STRAIN_BY_ID[pl.strain]?.color);
  g.position.set(slot.x,pl.baseY,slot.z);g.rotation.y=rand(0,Math.PI*2);g.scale.setScalar(1);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),
    new THREE.MeshBasicMaterial({color:0xeaffc0,transparent:true,opacity:.3,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  glow.position.y=1.0;g.add(glow);          // sits on the ripe cola, scales/sways with it
  scene.add(g);
  pl.g=g;pl.glow=glow;pl.stage='ripe';
}

function killPlant(slot: Slot): void{
  const pl=slot.plant!;
  pl.stage='dead';
  pl.g.rotation.set(0,pl.g.rotation.y,1.3);pl.g.scale.y*=.45; // wilt over and droop
}

function removePlant(slot: Slot,keepModel=false): void{
  const pl=slot.plant;
  if(!pl)return;
  if(!keepModel)scene.remove(pl.g);
  scene.remove(pl.wet);
  (pl.wet.material as THREE.Material).dispose();
  (pl.glow?.material as THREE.Material|undefined)?.dispose();
  slot.plant=null;
}

// Pull a dead plant out and toss it over your shoulder.
function clearSlot(slot: Slot): void{
  const pl=slot.plant;if(!pl||reserved.has(slot))return;
  reserved.add(slot);
  const obj=pl.g;
  obj.rotation.set(0,obj.rotation.y,0);
  fpUproot(obj,{toss:true,onPull:()=>removePlant(slot,true),
    onDone:()=>{reserved.delete(slot);message('CANTEIRO LIMPO','var(--cream)');blip([300,220],.05,'square',.08);}});
}

// Grip the ripe plant and pull it out — it ends up in your hand (one at a time).
function harvest(slot: Slot): void{
  const pl=slot.plant;if(!pl||pl.stage!=='ripe'||reserved.has(slot))return;
  const q=pl.quality;
  const st=STRAIN_BY_ID[pl.strain]||STRAIN_BY_ID.hybrid;
  const fed=pl.fed?FERTILIZER.yieldMul:1;
  const buds=Math.max(YIELD_MIN,Math.round((YIELD_MIN+(YIELD_MAX-YIELD_MIN)*(q/100))*st.yieldMul*fed));
  const data: Harvest={buds,val:buds*Math.round(PRICE*REWARDS.weedFarm.strainValues[st.id]),strain:pl.strain,quality:q,cured:false};
  reserved.add(slot);
  // with the bucket in hand, set it down beside you first (both hands are needed)
  if(holdingBucket())putBucketDown(false);
  // swap the bed plant for the uprootable one (same ripe plant + its root ball, hidden in the soil)
  const obj=makeHarvestedPlant(st.color);
  obj.position.set(slot.x,pl.baseY,slot.z);obj.rotation.y=pl.g.rotation.y;
  obj.userData.harvest=data;
  scene.remove(pl.g);scene.add(obj);              // identical look; the root ball hides in the soil
  fpUproot(obj,{
    onPull:()=>{removePlant(slot,true);blip([523,392],.05,'square',.1);},
    onUprooted:()=>{heldPlant=data;},
    onDone:()=>{
      reserved.delete(slot);
      bigText(`${st.name} ${grade(q)} - ${buds} BUDS`,'var(--gold)');setTimeout(hideBig,1100);
      message('PENDURE NO VARAL DE SECAGEM','var(--gold)');
      blip([659,880,1175],.07,'square',.18);
    }});
}

// ---------- the work table: trimming (lay the plant down, shears, fan leaves, buds) ----------
const tableGY=groundHeight(box.x,box.z);
const tableW=(lx: number,ly: number,lz: number)=>{const o=yawXZ(lx,lz,SALE_YAW);return new THREE.Vector3(box.x+o.x,tableGY+ly,box.z+o.z);};
const tableYaw=(extra=0)=>new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),SALE_YAW+extra);
const trimStand=tableW(TRIM_STAND_LOCAL.x,0,TRIM_STAND_LOCAL.z);
// the shears rest flat on the table; the tray sits to the right
const shears=makeTrimShears();
const shearsRest={pos:tableW(TRIM_SHEARS_LOCAL.x,TABLE_TOP_Y+.012,TRIM_SHEARS_LOCAL.z),quat:tableYaw(.6)};
function restShears(): void{
  if(shears.parent!==scene)scene.add(shears);
  shears.position.copy(shearsRest.pos);shears.quaternion.copy(shearsRest.quat);shears.scale.setScalar(1);
}
restShears();
const tray=makeBudTray();
tray.position.copy(tableW(TRIM_TRAY_LOCAL.x,TABLE_TOP_Y,TRIM_TRAY_LOCAL.z));tray.quaternion.copy(tableYaw());
scene.add(tray);
let trayItems: Harvest[]=[];                      // trimmed plants whose buds are in the tray

// A dried plant lying on the table being trimmed: its fan-leaf pairs, then its buds.
interface TrimJob{obj:THREE.Object3D;data:Harvest;fans:THREE.Object3D[];buds:THREE.Object3D[];fanPairs:number;}
let trimJob: TrimJob|null=null;
const holdingShears=()=>fpHeld()==='shears';
const nearTable=(p: {x:number;z:number})=>dist(p,trimStand)<1.9||dist(p,box)<1.9;

function layOnTable(): void{
  const data=heldPlant;if(!data||!holdingPlant()||!data.cured||trimJob)return;
  const pos=tableW(TRIM_PLANT_LOCAL.x,TABLE_TOP_Y+.07,TRIM_PLANT_LOCAL.z);
  // lying along the table, stem base to the left, a little tilt so both fan sides show
  const quat=tableYaw().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(.25,0,-Math.PI/2)));
  fpPlace({pos,quat,scale:.62},{focus:pos,hover:.2,stepDist:1.0,
    onRelease:(obj)=>{
      heldPlant=null;
      const fans=[...(obj.userData.fans as THREE.Object3D[])];
      trimJob={obj,data,fans,buds:[...(obj.userData.buds as THREE.Object3D[])],fanPairs:Math.ceil(fans.length/2)};
    },
    onDone:()=>message('PEGUE A TESOURA E APARE','var(--gold)')});
}
function pickUpShears(): void{ fpPickUp(shears,'shears',{onGrab:()=>blip([660,880],.03,'square',.06)}); }
function putShearsDown(): void{ fpPlace({pos:shearsRest.pos,quat:shearsRest.quat,scale:1},{hover:.08}); }
const stemPoint=(j: TrimJob)=>j.obj.localToWorld(new THREE.Vector3(0,.15,0));

// cut the next fan-leaf pair off: they drop off the table
function snipFan(): void{
  const j=trimJob;if(!j||!j.fans.length||!holdingShears())return;
  const pair=j.fans.splice(0,2);
  fpSnip(()=>pair[0].getWorldPosition(new THREE.Vector3()),()=>stemPoint(j),{
    onCut:()=>{
      for(const f of pair){
        const a=Math.random()*Math.PI*2;
        tossPiece(f,new THREE.Vector3(Math.cos(a)*.9,1.2,Math.sin(a)*.9));
      }
    },
    onDone:()=>{if(!j.fans.length)message('FOLHAS GRANDES FORA - AGORA CORTE OS BUDS NA BANDEJA','var(--gold)');},
  });
}
// snip the next bud off the stem: it arcs into the tray. The last one leaves a bare stem.
function snipBud(): void{
  const j=trimJob;if(!j||j.fans.length||!j.buds.length||!holdingShears())return;
  const bud=j.buds.shift()!;
  const last=!j.buds.length;
  fpSnip(()=>bud.getWorldPosition(new THREE.Vector3()),()=>stemPoint(j),{
    onCut:()=>{
      // the cola is part of the plant model: swap it for a loose bud nugget before it flies
      let piece: THREE.Object3D=bud;
      if(!(bud as THREE.Mesh).geometry||(bud as THREE.Mesh).geometry.type!=='IcosahedronGeometry'){
        piece=makeFlowerBud(true);
        bud.getWorldPosition(piece.position);scene.add(piece);bud.visible=false;
      }
      piece.scale.setScalar(.62*1.25);
      const inside=tray.userData.inside as THREE.Object3D;
      const to=inside.localToWorld(new THREE.Vector3((Math.random()-.5)*TRAY_W*.6,.03,(Math.random()-.5)*TRAY_D*.6));
      flyTo(piece,to,.35,()=>inside.attach(piece));
    },
    onDone:()=>{
      if(!last)return;
      // bare stem goes in the bin; the plant's buds are now in the tray
      tossPiece(j.obj,new THREE.Vector3(-Math.sin(cameraRig.yaw)*1.5,2.2,-Math.cos(cameraRig.yaw)*1.5));
      trayItems.push(j.data);trimJob=null;
      const n=trayItems.reduce((a,t)=>a+t.buds,0);
      message(`APARADA - ${n} BUDS NA BANDEJA - DESPEJE NO CAIXOTE`,'var(--gold)');
      blip([659,880,1175],.07,'square',.16);
      putShearsDown();
    },
  });
}

// ---------- the crate: a growing pile of trimmed, dried buds ----------
const PILE_CAP=36;
const pile: THREE.Object3D[]=[];
let crateItems: Harvest[]=[];                     // what's in the crate (for a returned pack)
const cratePilePoint=()=>{
  const lx=(Math.random()-.5)*CRATE_INNER.halfW*1.5,lz=(Math.random()-.5)*CRATE_INNER.halfD*1.5;
  const o=yawXZ(lx,lz,SALE_YAW);
  return new THREE.Vector3(crateW.x+o.x,crateW.y+.05+Math.min(.3,pile.length*.008),crateW.z+o.z);
};
function addPileBud(): void{
  if(pile.length>=PILE_CAP)return;
  const b=makeFlowerBud(true);b.scale.setScalar(.8);
  b.position.copy(cratePilePoint());b.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
  scene.add(b);pile.push(b);
}
function clearPile(): void{for(const b of pile)scene.remove(b);pile.length=0;}

// Tip the tray: every bud in it tumbles into the crate; the harvest joins the stash.
function tipTrayIntoCrate(): void{
  if(!trayItems.length||!handsFree())return;
  const items=trayItems;
  fpTipTray(tray,crateW,{
    onTip:()=>{
      const inside=tray.userData.inside as THREE.Object3D;
      for(const b of [...inside.children]){
        if(pile.length>=PILE_CAP){inside.remove(b);continue;}
        flyTo(b,cratePilePoint(),.35+Math.random()*.15,()=>pile.push(b));
      }
      for(const it of items){deposit.buds+=it.buds;deposit.val+=it.val;crateItems.push(it);}
      trayItems=[];
    },
    onDone:()=>{
      message(`NO CAIXOTE: ${deposit.buds} BUDS - AQUI NÃO RENDE DINHEIRO; LEVE PRA FAZER ENTREGAS`,'var(--gold)');
      blip([330,392],.06,'sine',.12);
    },
  });
}

// ---------- a plant put down anywhere (walked off, or set down on purpose) ----------
function dropPlantHere(animated: boolean): void{
  const data=heldPlant;const obj=fpHeldObject();
  if(!data||!obj)return;
  const p=playerPos(),f=cameraRig.yaw;
  const x=p.x+Math.sin(f)*.8,z=p.z+Math.cos(f)*.8;
  const pos=new THREE.Vector3(x,groundHeight(x,z)+.1,z);
  const quat=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,f+Math.PI/2,Math.PI/2,'YXZ'));
  const keep=()=>{heldPlant=null;groundPlants.push({obj,data});};
  if(animated)fpPlace({pos,quat,scale:.8},{hover:.25,onRelease:keep});
  else{
    scene.add(obj);obj.position.copy(pos);obj.quaternion.copy(quat);obj.scale.setScalar(.8);
    setHeld('none',null);keep();
  }
}
function pickUpPlant(i: number): void{
  const it=groundPlants[i];if(!it)return;
  groundPlants.splice(i,1);
  fpPickUp(it.obj,'plant',{onGrab:()=>{heldPlant=it.data;}});
}

// ---------- deposit box: stash (no pay) / take out (backpack + run) / return ----------
function withdrawPack(): void{
  if(pack.active||deposit.buds<=0)return;
  pack.active=true;pack.buds=deposit.buds;pack.val=deposit.val;pack.orig=deposit.buds;
  deposit.buds=0;deposit.val=0;clearPile();
  packItems=crateItems;crateItems=[];
  runEarned=0;
  attachBackpack();spawnBuyers();delivering=true;
  bigText('RODADA DE ENTREGAS','var(--gold)');setTimeout(hideBig,1100);
  message(`${pack.buds} BUDS NAS COSTAS - VENDA PROS COMPRADORES DO MAPA (A CIDADE PAGA MAIS)`,'var(--gold)');
  blip([392,523,659,784],.08,'sine',.14);
}
function returnPack(): void{
  if(!pack.active)return;
  deposit.buds+=pack.buds;deposit.val+=pack.val;
  crateItems=packItems;packItems=[];
  for(let i=0;i<deposit.buds;i++)addPileBud();
  endRunCleanup();
  message('MOCHILA DEVOLVIDA - A ERVA VOLTOU PRO CAIXOTE','var(--cream)');
  blip([300,240],.05,'square',.1);
}
function endRunCleanup(): void{
  pack.active=false;pack.buds=0;pack.val=0;pack.orig=0;
  delivering=false;detachBackpack();despawnBuyers();
  if(weedHud)weedHud.classList.remove('show');
}
function finishRun(): void{
  const sold=pack.orig;
  markMiniGamePlayed(MiniGameId.WEED_FARM);
  boxed+=sold;
  endRunCleanup();
  bigText('TUDO ENTREGUE','var(--gold)');setTimeout(hideBig,1100);
  message(`RODADA CONCLUÍDA - ${sold} BUDS ENTREGUES`,'var(--gold)');
  blip([659,880,1047,1319],.1,'square',.2);
}

// ---------- the worn backpack ----------
function attachBackpack(): void{
  detachBackpack();
  backpackObj=makeWeedBackpack();
  backpackObj.scale.setScalar(.92);
  backpackObj.position.set(0,1.18,-0.22); // chest height, on the back (model faces +z)
  player.g.add(backpackObj);
}
function detachBackpack(): void{ if(backpackObj){backpackObj.parent?.remove(backpackObj);backpackObj=null;} }

// ---------- buyers spread across the map during a run ----------
function spawnBuyers(): void{
  despawnBuyers();
  buyers=DELIV_POINTS.map(d=>{
    const ped=makePed(d.city?0x6a4a8a:0x7a5a3a,0x2a2a30); // makePed adds itself to the scene
    ped.position.set(d.x,groundHeight(d.x,d.z),d.z);ped.rotation.y=Math.random()*6.28;
    const b=new Buyer(ped,d.x,d.z,d.city,!!d.gated,4+((Math.random()*5)|0));
    b.t=Math.random()*6; // random walk-cycle phase so they don't bob in sync
    return b;
  });
}
function despawnBuyers(): void{ for(const b of buyers)b.despawn(); buyers=[]; } // despawn clears the scene + NPC census
// turn the player and the buyer to face each other and frame the camera on the deal
function faceForDeal(b: Buyer): void{
  const p=playerPos();
  const toBuyer=Math.atan2(b.x-p.x,b.z-p.z);
  player.heading=toBuyer;player.g.rotation.set(0,toBuyer,0);
  if(b.ped)b.ped.rotation.y=Math.atan2(p.x-b.x,p.z-b.z);
  cameraRig.yaw=toBuyer;cameraRig.touchLookIdle=1;
}
// A brief hand-off "mini-cutscene": the two face off, the player reaches out with the
// goods and the cash banner pops, then control returns. Runs in mode 'cut' (input
// frozen) for one beat; the buyer's funny line is already floating from deliverTo.
// Deferred bookkeeping (finishRun / fresh batch) happens when the beat ends, so the
// buyer stays visible through the whole exchange.
function dealCutscene(b: Buyer,pay: number,after: ()=>void): void{
  faceForDeal(b);
  const l=playerLimbs();
  if(l){l.rightArm.rotation.set(-1.25,0,-.2);l.rightForearm?.rotation.set(-.5,0,0);} // reach out
  armPosed=true;
  bigText(`+$${pay}`,'var(--gold)');
  state.mode='cut';state.cutT=1.8;
  state.cutFn=()=>{state.mode='foot';armPosed=false;after();};
}

function deliverTo(b: Buyer): void{
  if(!b||b.served||pack.buds<=0)return;
  b.served=true; // the buyer now STAYS put in the world (no longer vanishes the instant you deal)
  // STING: the hotter you are, the likelier a buyer is an undercover cop. No pay, the
  // law lands on you, and you bolt with the stash still on your back.
  if(heat>HEAT_WARM&&Math.random()<(heat-HEAT_WARM)/120){
    // STING: the buyer was an undercover cop. Caught red-handed wearing the pack,
    // you're nabbed ON THE SPOT — getBusted sees the backpack and runs the crooked-
    // cop shakedown story cut-scene (js/activities/drug-bust.ts), wherever the deal happened
    // (country / beach / island), since no patrol could ever corner you out here.
    heat=Math.max(0,heat-50);
    message('ARMADILHA! - O COMPRADOR ERA POLICIAL À PAISANA!','var(--pink)');
    blip([400,200,400,160],.13,'square',.2);
    getBusted(); // carrying the pack -> getBusted routes into the drug-bust cut-scene
    return; // the shakedown seizes the stash; nothing paid
  }
  const perBud=pack.val/Math.max(1,pack.buds);
  const chunk=Math.min(pack.buds,b.want);
  const pay=Math.min(REWARDS.weedFarm.maxPayPerDeal,Math.max(1,Math.round(chunk*perBud*marketFactor()*(b.city?REWARDS.weedFarm.cityPriceMultiplier:1))));
  economy.earn(pay,'weed-deal'); // no anti-rapid-fire cooldown (deals can be close together)
  runEarned+=pay;
  heat=Math.min(100,heat+(b.city?14:8)); // dealing draws heat — city corners more so
  pack.buds-=chunk;pack.val=Math.max(0,pack.val-chunk*perBud);
  message(`VENDEU ${chunk} BUDS - +R$${pay}${pack.buds>0?` (RESTAM ${pack.buds})`:''}`,'var(--gold)');
  blip([523,659,784,1047],.08,'square',.16);
  // the buyer blurts a random funny line over the hand-off
  if(b.ped)say(b.ped,pick(WEED_BUYER_LINES),{life:3.8,yOff:2.45});
  const after=()=>{
    if(pack.buds<=0)finishRun();
    // Out of REACHABLE buyers but still holding buds: spawn a fresh batch. The far
    // ISLAND buyer (gated) is excluded so a player who can't cross water is never left
    // with a stash and no one to deal to.
    else if(buyers.every(x=>x.served||x.gated))spawnBuyers();
  };
  // mini-cutscene beat — but never freeze mid-chase: while WANTED the deal is instant
  if(state.wanted<1&&state.mode==='foot')dealCutscene(b,pay,after);
  else after();
}

// ---------- farm upgrades: reinvest earnings into watering gear ----------
const sprMat=new THREE.MeshStandardMaterial({color:0x9aa0a6,roughness:.4,metalness:.55});
let sprinklerFx: THREE.Object3D[]=[];
function installSprinklerVisuals(): void{
  if(sprinklerFx.length)return;                 // a riser + nozzle in each bed corner
  for(const s of slots){
    const x=s.x+.95,z=s.z+.95,y=groundHeight(x,z);
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.02,.025,.55,6),sprMat);
    pipe.position.set(x,y+.28,z);scene.add(pipe);sprinklerFx.push(pipe);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),sprMat);
    head.position.set(x,y+.56,z);scene.add(head);sprinklerFx.push(head);
  }
}
function buyUpgrade(): void{
  if(upLevel>=UPGRADES.length)return;
  const u=UPGRADES[upLevel];
  if(!economy.spend(u.price,'spend')){message(`DINHEIRO INSUFICIENTE - PRECISA DE R$${u.price}`,'var(--pink)');return;}
  upLevel++;
  if(hasSprinklers())installSprinklerVisuals();
  bigText('PLANTAÇÃO MELHORADA','var(--gold)');setTimeout(hideBig,1000);
  message(`${u.name} INSTALADA - ${u.desc}`,'var(--gold)');
  blip([523,659,784,1047],.09,'square',.16);
}

// ---------- fertilizer: feed a growing plant once for a bigger, better harvest ----------
function fertilize(slot: Slot): void{
  const pl=slot.plant;
  if(!pl||pl.fed||pl.stage==='dead'||pl.stage==='ripe'||reserved.has(slot))return;
  if((state.fertilizer|0)<=0){message('SEM ADUBO - COMPRE NO ARMAZÉM','var(--pink)');return;}
  state.fertilizer--;
  reserved.add(slot);
  fpSow(soilPoint(slot),true,{
    onLand:()=>{const p=slot.plant;if(p){p.fed=true;p.pop=.4;}blip([523,659,880],.07,'sine',.14);},
    onDone:()=>{reserved.delete(slot);message(`${STRAIN_BY_ID[pl.strain]?.name||''} ADUBADA - BUDS MAIORES E MELHORES`,'var(--gold)');},
  });
}

// ---------- drying rack: hang plants upside down, let them cure, take them back ----------
const RACK_HOOKS=5;
const hooks: ({obj:THREE.Object3D;data:Harvest;t:number}|null)[]=new Array(RACK_HOOKS).fill(null);
// plants hang upside down from the rack's LOWER bar (1.45 m, on its yard side) — below eye
// level and clear of the lean-to roof, so you see them hang (assets/models/rural/weed-farm.ts)
const rackBarY=groundHeight(rackPos.x,rackPos.z)+1.45;
const hookPos=(i: number)=>new THREE.Vector3(rackPos.x-1.1+i*(2.2/(RACK_HOOKS-1)),rackBarY,rackPos.z+.22);
const HANG_QUAT=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI,0,0)); // upside down
function freeHook(): number{return hooks.findIndex(h=>!h);}
function nearestHook(filter: (h:{obj:THREE.Object3D;data:Harvest;t:number})=>boolean): number{
  const p=playerPos();let best=-1,bd=1e9;
  hooks.forEach((h,i)=>{if(h&&filter(h)){const d=hookPos(i).distanceTo(new THREE.Vector3(p.x,rackBarY,p.z));if(d<bd){bd=d;best=i;}}});
  return best;
}
function hangPlant(): void{
  const data=heldPlant;const i=freeHook();
  if(!data||i<0||!holdingPlant())return;
  if(data.cured){message('JÁ ESTÁ SECA - DEITE NO CAIXOTE','var(--cream)');return;}
  const hp=hookPos(i);hp.y-=.02;
  hooks[i]={obj:null as unknown as THREE.Object3D,data,t:0};   // reserve the hook
  fpPlace({pos:hp,quat:HANG_QUAT,scale:.6},{focus:hp,hover:.12,stepDist:1.0,
    onRelease:(obj)=>{heldPlant=null;hooks[i]={obj,data,t:0};},
    onDone:()=>{message(`SECANDO - PRONTA EM ${REWARDS.weedFarm.cureTimeSec}s`,'var(--cyan)');blip([392,330],.07,'sine',.12);}});
}
function takeCured(i: number): void{
  const h=hooks[i];if(!h||!h.data.cured||!h.obj)return;
  hooks[i]=null;
  fpPickUp(h.obj,'plant',{onGrab:()=>{heldPlant=h.data;},
    onDone:()=>{message(`${STRAIN_BY_ID[h.data.strain]?.name||''} SECA - DEITE NO CAIXOTE`,'var(--gold)');blip([659,880,1175],.08,'square',.18);}});
}
function cureHook(i: number): void{
  const h=hooks[i];if(!h||!h.obj)return;
  h.data.cured=true;h.data.val=Math.round(h.data.val*REWARDS.weedFarm.cureBonus);
  const cured=makeHarvestedPlant(STRAIN_BY_ID[h.data.strain]?.color,true);
  cured.position.copy(h.obj.position);cured.quaternion.copy(h.obj.quaternion);cured.scale.copy(h.obj.scale);
  scene.remove(h.obj);scene.add(cured);h.obj=cured;
}

// ---------- registry: ONE context-sensitive zone action on foot ----------
// What E does depends on what your hands hold and what you're next to. Nothing is
// offered while a clip is playing (so a hand animation always finishes cleanly).
type ZoneAct={label:string;prompt:string;enabled:boolean;run:()=>void};
const act=(label: string,prompt: string,run: ()=>void): ZoneAct=>({label,prompt,enabled:true,run});
function nearestSlot(): Slot|null{
  const p=playerPos();let best: Slot|null=null,bd=RANGE;
  for(const s of slots){const d=dist(p,s);if(d<bd){bd=d;best=s;}}
  return best;
}
(refs.zoneActions||(refs.zoneActions=[])).push((): ZoneAct|null=>{
  if(state.mode!=='foot'||state.swimming||fpBusy())return null;
  const p=playerPos();
  const nearCrate=dist(p,crateW)<RANGE, nearTap=dist(p,tap)<RANGE, nearRack=dist(p,rackPos)<RANGE;
  const slot=nearestSlot(), pl=slot?.plant||null;

  // ---- a plant in hand ----
  if(holdingPlant()){
    // drying is MANDATORY: only a dried plant goes in the crate; a fresh one goes on the rack
    const dry=heldPlant!.cured;
    if(nearTable(p)&&dry){
      if(!trimJob)return act('APARAR','DEITE NA MESA PRA APARAR',layOnTable);
      return act('OCUPADO','TERMINE DE APARAR A QUE ESTÁ NA MESA PRIMEIRO',()=>message('UMA PLANTA NA MESA POR VEZ','var(--cream)'));
    }
    if(nearCrate||nearTable(p))return dry?act('APARAR','APARE NA MESA PRIMEIRO',()=>message('SÓ BUDS - APARE NA MESA E DEPOIS DESPEJE A BANDEJA','var(--cyan)'))
      :act('ÚMIDA','AINDA ÚMIDA - SEQUE NO VARAL PRIMEIRO',()=>message('SEQUE NO VARAL PRIMEIRO E DEPOIS APARE NA MESA','var(--cyan)'));
    if(nearRack&&!dry){
      if(freeHook()>=0)return act('PENDURAR','PENDURE DE CABEÇA PRA BAIXO PRA SECAR',hangPlant);
      return act('CHEIO','O VARAL ESTÁ CHEIO - ESPERE UMA SECAR',()=>message('O VARAL ESTÁ CHEIO - TIRE UMA SECA PRIMEIRO','var(--cream)'));
    }
    if(slot&&pl?.stage==='ripe')return act('MÃOS CHEIAS',dry?'MÃOS CHEIAS - DEITE ESTA NO CAIXOTE PRIMEIRO':'MÃOS CHEIAS - PENDURE ESTA PRA SECAR PRIMEIRO',
      ()=>message(dry?'UMA PLANTA POR VEZ - LEVE ATÉ O CAIXOTE':'UMA PLANTA POR VEZ - PENDURE NO VARAL','var(--cream)'));
    return act('LARGAR','LARGAR A PLANTA',()=>dropPlantHere(true));
  }

  // ---- the shears in hand: trim the plant on the table ----
  if(holdingShears()){
    const j=trimJob;
    if(j&&j.fans.length){
      const done=j.fanPairs-Math.ceil(j.fans.length/2);
      return act('CORTAR',`TIRAR AS FOLHAS GRANDES (${done+1}/${j.fanPairs})`,snipFan);
    }
    if(j&&j.buds.length){
      const total=(j.obj.userData.buds as unknown[]).length,done=total-j.buds.length;
      return act('CORTAR',`CORTAR OS BUDS NA BANDEJA (${done+1}/${total})`,snipBud);
    }
    return act('TESOURA','LARGAR A TESOURA',putShearsDown);
  }

  // ---- the bucket in hand ----
  if(holdingBucket()){
    if(nearTap&&waterCharges<canCapacity())return act('ENCHER','ENCHER O BALDE NA TORNEIRA',fillBucket);
    if(slot&&pl&&!reserved.has(slot)){
      if(pl.stage==='ripe')return act('COLHER',`LARGUE O BALDE E COLHA A PLANTA ${grade(pl.quality)}`,()=>harvest(slot));
      if(pl.stage==='dead')return act('BALDE','LARGUE O BALDE PRIMEIRO',()=>putBucketDown(false));
      if(waterCharges>0&&pl.hyd<92)return act('REGAR',`REGAR${waterCharges>1?` (RESTAM ${waterCharges})`:''}`,()=>water(slot));
      if(waterCharges<=0)return act('VAZIO','BALDE VAZIO - ENCHA NA TORNEIRA',()=>message('ENCHA O BALDE NA TORNEIRA','var(--cyan)'));
      if(!pl.fed&&(state.fertilizer|0)>0)return act('ADUBAR',`ADUBAR (RESTAM ${state.fertilizer})`,()=>fertilize(slot));
    }
    if(slot&&!pl&&!reserved.has(slot)&&plantStrain())
      return act('PLANTAR',`PLANTAR ${STRAIN_BY_ID[plantStrain()].name} (RESTAM ${seedCount(plantStrain())})`,()=>sow(slot));
    if(nearTap)return act('BALDE','DEVOLVER O BALDE',()=>putBucketDown(true));
    return act('BALDE','LARGAR O BALDE',()=>putBucketDown(false));
  }

  // ---- empty hands ----
  if(nearTable(p)||nearCrate){
    if(trimJob&&nearTable(p))return act('TESOURA','PEGAR A TESOURA E APARAR',pickUpShears);
    if(trayItems.length)
      return act('CAIXOTE',`DESPEJAR ${trayItems.reduce((a,t)=>a+t.buds,0)} BUDS NO CAIXOTE`,tipTrayIntoCrate);
  }
  if(nearCrate){
    if(pack.active)return act('DEVOLVER','DEVOLVER A MOCHILA DE ENTREGA',returnPack);
    if(deposit.buds>0)return act('PEGAR',`PEGAR ${deposit.buds} BUDS PRA ENTREGA`,withdrawPack);
  }
  for(let i=0;i<groundPlants.length;i++){
    const gp=groundPlants[i].obj.position;
    if(Math.hypot(p.x-gp.x,p.z-gp.z)<1.6)return act('PEGAR','PEGAR A PLANTA',()=>pickUpPlant(i));
  }
  if(bucketFree()&&Math.hypot(p.x-bucket.position.x,p.z-bucket.position.z)<(nearTap?RANGE:1.8))
    return act('BALDE','PEGAR O BALDE',pickUpBucket);
  if(nearRack){
    const c=nearestHook(h=>h.data.cured&&!!h.obj);
    if(c>=0)return act('PEGAR','PEGAR A PLANTA SECA',()=>takeCured(c));
    const d=nearestHook(h=>!h.data.cured);
    if(d>=0){const h=hooks[d]!;return act('SECANDO',`SECANDO - FALTAM ${Math.max(1,Math.ceil(REWARDS.weedFarm.cureTimeSec-h.t))}s`,()=>message('AINDA SECANDO - DÊ TEMPO','var(--cyan)'));}
  }
  // grow-shack: reinvest earnings into farm upgrades (watering gear → sprinklers)
  if(dist(p,shackPos)<RANGE){
    if(upLevel>=UPGRADES.length)
      return{label:'GALPÃO',prompt:'TODAS AS MELHORIAS JÁ COMPRADAS',enabled:false,run:()=>{}};
    const u=UPGRADES[upLevel];
    if(state.money<u.price)
      return act('GALPÃO',`PRECISA DE R$${u.price} PARA ${u.name}`,()=>message(`DINHEIRO INSUFICIENTE - PRECISA DE R$${u.price}`,'var(--pink)'));
    return act('MELHORIA',`COMPRAR ${u.name} R$${u.price} - ${u.desc}`,buyUpgrade);
  }
  if(!slot||reserved.has(slot))return null;
  if(!pl){
    const sid=plantStrain();
    if(sid)return act('PLANTAR',`PLANTAR ${STRAIN_BY_ID[sid].name} (RESTAM ${seedCount(sid)})`,()=>sow(slot));
    return act('PLANTAR','PRECISA DE SEMENTES - COMPRE NO ARMAZÉM',()=>sow(slot)); // sow() shows the "buy seeds" hint
  }
  if(pl.stage==='dead')return act('LIMPAR','ARRANCAR A PLANTA MORTA',()=>clearSlot(slot));
  if(pl.stage==='ripe')return act('COLHER',`COLHER A PLANTA ${grade(pl.quality)}`,()=>harvest(slot));
  if((pl.stage==='seed'||pl.stage==='growing')&&!pl.fed&&(state.fertilizer|0)>0)
    return act('ADUBAR',`ADUBAR (RESTAM ${state.fertilizer})`,()=>fertilize(slot));
  if(pl.hyd<35)return act('REGAR','PRECISA DE ÁGUA - PEGUE O BALDE NA TORNEIRA',()=>message('PEGUE O BALDE NA TORNEIRA','var(--cyan)'));
  return act('CRESCENDO',pl.fed?'CRESCENDO (ADUBADA) - MANTENHA REGADA':'CRESCENDO - MANTENHA REGADA',()=>message('AINDA CRESCENDO','var(--cyan)'));
});

// ---------- second zone action: DEAL to a buyer during a delivery run ----------
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(!delivering||state.mode!=='foot'||pack.buds<=0)return null;
  const p=playerPos();
  let best: Buyer|null=null,bd=DELIV_RANGE;
  for(const b of buyers){if(b.served)continue;const d=dist(p,b);if(d<bd){bd=d;best=b;}}
  if(!best)return null;
  const chunk=Math.min(pack.buds,best.want);
  const pay=Math.min(REWARDS.weedFarm.maxPayPerDeal,Math.max(1,Math.round(chunk*(pack.val/Math.max(1,pack.buds))*marketFactor()*(best.city?REWARDS.weedFarm.cityPriceMultiplier:1))));
  const risk=heat>HEAT_WARM?' - ARRISCADO, POLÍCIA DE OLHO!':'';
  return{label:'VENDER',prompt:`VENDER ${chunk} BUDS (+R$${pay})${best.city?' CIDADE+':''}${risk}`,
    enabled:true,run:()=>deliverTo(best!)};
});

// ---------- street deals: weed-liking peds flag you down when you carry the pack ----------
// 30% of city peds like to smoke (Ped.likesWeed). pedestrians.js reads this flag to make
// them STOP and wave the player over while the pack is out (refs.isCarryingWeed). Here we
// close the sale: stand near a waving ped (aiState 'weed') and DEAL.
refs.isCarryingWeed=()=>delivering&&pack.buds>0;

const STREET_DEAL_RANGE=2.8;
function dealToPed(ped: Ped): void{
  if(pack.buds<=0)return;
  // same STING risk as the fixed buyers: the higher the heat, the likelier a setup
  if(heat>HEAT_WARM&&Math.random()<(heat-HEAT_WARM)/120){
    heat=Math.max(0,heat-50);
    message('ARMADILHA! - O COMPRADOR ERA POLICIAL À PAISANA!','var(--pink)');
    blip([400,200,400,160],.13,'square',.2);
    getBusted();return;
  }
  const perBud=pack.val/Math.max(1,pack.buds);
  const chunk=Math.min(pack.buds,ped.wantBuds);
  const pay=Math.min(REWARDS.weedFarm.maxPayPerDeal,
    Math.max(1,Math.round(chunk*perBud*marketFactor()*REWARDS.weedFarm.cityPriceMultiplier)));
  economy.earn(pay,'weed-deal');runEarned+=pay;
  heat=Math.min(100,heat+12);
  pack.buds-=chunk;pack.val=Math.max(0,pack.val-chunk*perBud);
  message(`VENDEU ${chunk} BUDS - +R$${pay}${pack.buds>0?` (RESTAM ${pack.buds})`:''}`,'var(--gold)');
  blip([523,659,784,1047],.08,'square',.16);
  say(ped.g,pick(WEED_BUYER_LINES),{life:3.8,yOff:2.45});
  ped.markWeedSold(); // back to walking, on cooldown before they flag you again
  if(pack.buds<=0)finishRun();
}

// DEAL zone action for a waving street ped (separate from the fixed-buyer one above).
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(!delivering||state.mode!=='foot'||pack.buds<=0)return null;
  const p=playerPos();
  let best: Ped|null=null,bd=STREET_DEAL_RANGE;
  for(const ped of peds){
    if(ped.aiState!=='weed')continue;
    const d=Math.hypot(p.x-ped.g.position.x,p.z-ped.g.position.z);
    if(d<bd){bd=d;best=ped;}
  }
  if(!best)return null;
  const chunk=Math.min(pack.buds,best.wantBuds);
  const pay=Math.min(REWARDS.weedFarm.maxPayPerDeal,
    Math.max(1,Math.round(chunk*(pack.val/Math.max(1,pack.buds))*marketFactor()*REWARDS.weedFarm.cityPriceMultiplier)));
  const risk=heat>HEAT_WARM?' - ARRISCADO, POLÍCIA DE OLHO!':'';
  return{label:'VENDER',prompt:`VENDER ${chunk} BUDS (+R$${pay})${risk}`,enabled:true,run:()=>dealToPed(best!)};
});

// The grow-op itself stays OFF the map (you find the walls). But while a delivery run
// is on, the BUYERS show on the radar/map so you know where to take the stash.
(refs.miniBlips||(refs.miniBlips=[])).push(()=>{
  if(!delivering)return[];
  const out=buyers.filter(b=>!b.served).map(b=>({x:b.x,z:b.z,icon:'person',
    color:b.city?'#19e3ff':'#9dff2e',label:'COMPRADOR'}));
  // street peds who like weed and are actively flagging you down also show as buyers,
  // so the "they only wave" deals aren't invisible — you can see who wants to buy.
  for(const ped of peds)if(ped.aiState==='weed')
    out.push({x:ped.g.position.x,z:ped.g.position.z,icon:'person',color:'#9dff2e',label:'COMPRADOR'});
  return out;
});

refs.getWeedFarmState=()=>{
  let planted=0,ripe=0;
  for(const s of slots){if(s.plant){planted++;if(s.plant.stage==='ripe')ripe++;}}
  return{planted,ripe,held:fpHeld(),busy:fpBusy(),heldPlant:heldPlant?{...heldPlant}:null,
    bucketWater:+((bucket.userData.water as number)||0).toFixed(2),crate:crateItems.length,
    trim:trimJob?{fans:trimJob.fans.length,buds:trimJob.buds.length}:null,tray:trayItems.length,
    hung:hooks.filter(Boolean).length,dropped:groundPlants.length,
    boxed,waterCharges,upLevel,sprinklers:hasSprinklers(),
    seeds:{...state.seeds},seedSel:state.seedSel||plantStrain(),
    deposit:{...deposit},delivering,heat:Math.round(heat),runEarned,
    pack:{active:pack.active,buds:pack.buds,val:pack.val},
    buyers:buyers.filter(b=>!b.served).length};
};

// Test scaffolding (window.__test.farm): stock seeds/food, ripen / dry out / kill every
// growing plant, or finish every curing plant — so the harness can reach each clip without waiting.
refs.farmTest=(cmd: string)=>{
  if(cmd==='state')return refs.getWeedFarmState!();
  if(cmd==='stock'){for(const st of STRAINS)state.seeds[st.id]=(state.seeds[st.id]|0)+3;state.fertilizer=(state.fertilizer|0)+3;}
  if(cmd==='ripen')for(const s of slots){const pl=s.plant;if(pl&&(pl.stage==='seed'||pl.stage==='growing'))setRipe(s);}
  if(cmd==='thirsty')for(const s of slots){const pl=s.plant;if(pl&&pl.stage!=='dead')pl.hyd=10;}
  if(cmd.startsWith('grow:')){ // timelapse: advance every growing plant, kept watered
    const sec=parseFloat(cmd.slice(5))||0;
    for(const s of slots){const pl=s.plant;if(pl&&(pl.stage==='seed'||pl.stage==='growing')){pl.t+=sec;pl.hyd=100;}}
  }
  if(cmd==='kill')for(const s of slots){const pl=s.plant;if(pl&&pl.stage!=='dead')killPlant(s);}
  if(cmd==='cure')hooks.forEach((h,i)=>{if(h&&h.obj&&!h.data.cured)cureHook(i);});
  return refs.getWeedFarmState!();
};

// Busted while carrying the backpack: the crooked-cop shakedown (js/activities/drug-bust.ts)
// seizes the stash — clears the run and pulls the pack off the player's back.
refs.seizeDrugBackpack=()=>{const had=pack.active;if(had)endRunCleanup();return had;};

// Persisted grow-op economy: the farm upgrade level + bought seeds/plant-food survive
// a reload (crops/runs stay session-only). Save bridge in js/core/save.ts.
refs.getFarmSave=()=>({up:upLevel,seeds:{...state.seeds},fert:state.fertilizer|0});
refs.restoreFarm=(d: unknown)=>{
  if(!d||typeof d!=='object')return;
  const v=d as {up?: number; seeds?: Record<string, number>; fert?: number};
  if(Number.isFinite(v.up))upLevel=Math.max(0,Math.min(UPGRADES.length,Math.floor(v.up!)));
  if(v.seeds&&typeof v.seeds==='object')state.seeds={...v.seeds};
  if(Number.isFinite(v.fert))state.fertilizer=Math.max(0,Math.floor(v.fert!));
  if(hasSprinklers())installSprinklerVisuals();
};

// ---------- delivery-run HUD (buds left, cash, buyers, heat bar) ----------
function updateWeedHud(): void{
  if(!weedHud)return;
  if(!delivering){weedHud.classList.remove('show');return;}
  weedHud.classList.add('show');
  const tag=heat>HEAT_HOT?'ALTA':heat>HEAT_WARM?'MÉDIA':'BAIXA';
  const col=heat>HEAT_HOT?'#ff4d4d':heat>HEAT_WARM?'#ffb43b':'#7fe07f';
  const left=buyers.filter(b=>!b.served).length;
  weedHud.innerHTML=
    `<div class="weed-label">ENTREGAS</div>`+
    `<div class="weed-main"><span>BUDS</span><b>${pack.buds}</b></div>`+
    `<div class="weed-row"><span>GANHO</span><b>R$${runEarned}</b></div>`+
    `<div class="weed-row"><span>COMPRADORES</span><b>${left}</b></div>`+
    `<div class="weed-heat" style="color:${col}">VIGILÂNCIA ${tag}</div>`+
    `<div class="weed-meter"><i style="width:${Math.min(100,heat)|0}%;background:${col}"></i></div>`;
}

// ---------- per-frame update (called from main.js, no world lock) ----------
export function updateWeedFarm(dt: number): void{
  if(armPosed&&state.mode==='foot')armPosed=false;
  updateFarmFocus(dt);   // an active hand clip turns the view to its target (before the camera)

  // Hands full only AT the plot: wander off (or hop on a vehicle / into the water) and the
  // bucket goes back under the faucet and a carried plant is set down where you were.
  if(!fpBusy()&&fpHeld()!=='none'){
    const p=playerPos();
    const away=state.mode!=='foot'||state.swimming||Math.hypot(p.x-WEED_CX,p.z-WEED_CZ)>BUCKET_DROP_DIST
      ||(holdingShears()&&!nearTable(p));          // the shears stay at the table
    if(away){
      if(holdingBucket()){
        setHeld('none',null);waterCharges=0;setBucketWater(0);restBucketAtTap();
        if(state.mode==='foot')message('DEIXOU O BALDE NA TORNEIRA','var(--cream)');
      }else if(holdingShears()){
        setHeld('none',null);restShears();
      }else if(holdingPlant()){
        dropPlantHere(false);
        if(state.mode==='foot')message('VOCÊ LARGOU A PLANTA','var(--cream)');
      }
    }
  }else if(fpBusy()&&(state.mode!=='foot'||state.swimming))abortActions();

  // Vehicles can't ride into the grow-op. The gate gap stays open for the on-foot
  // player (so the activity works), but a DRIVEN vehicle that noses into it is bounced
  // back outside — keeps a moto/car out of the planter beds and off the crop.
  if(state.mode==='car'&&cur){
    const p=cur.g.position, gateZ=WEED_GATE.z-1.5; // the north wall line (gate plane)
    if(Math.abs(p.x-WEED_CX)<GATE_HALF+1.3&&p.z<gateZ+1.3&&p.z>gateZ-20){
      p.z=gateZ+1.3;cur.speed*=-.3;                // shove it back out the gate
    }
  }

  // drying rack: each hung plant cures on its own clock, then visibly dries (paler, thinner)
  hooks.forEach((h,i)=>{
    if(!h||!h.obj||h.data.cured)return;
    h.t+=dt;
    h.obj.rotation.z=Math.sin(state.time*1.3+i)*.04;   // hangs and sways a little
    if(h.t>=REWARDS.weedFarm.cureTimeSec)cureHook(i);
  });

  // idle the delivery buyers so they read as living NPCs waiting on the corner — and
  // keep idling the ones already served, so a buyer you dealt to stays put and alive
  // (it used to be deleted the instant you sold to it)
  if(delivering)for(const b of buyers){if(!b.ped)continue;b.t+=dt;animatePed(b.ped,b.t*.9,.05);}
  // the worn pack hides only INSIDE a closed car (body behind glass, pack would clip the
  // roof) — it stays on foot, through the hand-off cut-scene (mode 'cut'), AND on any
  // open/exposed ride (bike/boat/plane/tractor/RC) so the moto delivery run shows the
  // rucksack on the rider's back. Same "real closed car" test as player.js updateCarCockpit.
  if(backpackObj){
    const closedCar=cur&&!cur.bike&&!cur.boat&&!cur.plane&&!cur.tractor&&!cur.remote;
    backpackObj.visible=!closedCar;
  }
  // heat cools over time; lingering at the farm while HOT draws a police raid
  if(heat>0)heat=Math.max(0,heat-dt*3);
  if(heat>HEAT_HOT&&nearFarm()){
    farmLinger+=dt;
    if(farmLinger>6){addWanted(3.5,'BATIDA POLICIAL NA PLANTAÇÃO!','weed_raid');heat=Math.max(0,heat-40);farmLinger=0;}
  }else farmLinger=0;
  updateWeedHud();

  for(const slot of slots){
    const pl=slot.plant;
    if(!pl)continue;

    // hydration / growth / quality / death (only while still maturing). Each strain
    // grows at its own pace, drinks at its own rate and tolerates drought differently.
    const st=STRAIN_BY_ID[pl.strain]||STRAIN_BY_ID.hybrid;
    if(pl.stage==='seed'||pl.stage==='growing'){
      const growT=GROW_TIME*st.grow;
      pl.hyd-=HYD_DRAIN*st.drain*dt;if(pl.hyd<0)pl.hyd=0;
      // drip sprinklers (top upgrade): keep the beds watered hands-free
      if(hasSprinklers()&&pl.hyd<95)pl.hyd=Math.min(95,pl.hyd+(HYD_DRAIN*st.drain+5)*dt);
      if(pl.hyd>0){
        pl.dryT=0;
        if(pl.hyd>HYD_HEALTHY)pl.quality=Math.min(100,pl.quality+QUALITY_RECOVER*(pl.fed?FERTILIZER.qualBoost:1)*dt);
        pl.t+=dt;
        if(pl.t>=growT)setRipe(slot);
        else if(pl.t>=growT*SEED_F)pl.stage='growing';
      }else{
        pl.dryT+=dt;
        pl.quality=Math.max(0,pl.quality-QUALITY_DROP*dt);
        if(pl.dryT>=DRY_DEATH*st.hardy)killPlant(slot);
      }
    }
    if(pl.pop>0)pl.pop=Math.max(0,pl.pop-dt*1.5);

    // ---- diegetic state: the plant's body shows how it's doing ----
    if(pl.stage==='seed'||pl.stage==='growing'){
      const f=Math.min(1,pl.t/(GROW_TIME*st.grow));
      const baseS=.3+.7*f+pl.pop*.15;
      const droop=clamp01((40-pl.hyd)/40);          // 0 perky → 1 parched & wilting
      pl.g.scale.set(baseS,baseS*(1-droop*.28),baseS);
      pl.g.rotation.x=droop*.5;                      // leans over when thirsty
      pl.g.rotation.z=Math.sin(state.time*1.6+pl.phase)*.05*(1-droop*.6); // breeze sway
    }else if(pl.stage==='ripe'){
      pl.g.rotation.x=0;
      pl.g.rotation.z=Math.sin(state.time*1.4+pl.phase)*.04;
      const b=1+Math.sin(state.time*3+pl.phase)*.03; // gentle breathe
      pl.g.scale.set(b,b,b);
      if(pl.glow){
        const k=.5+.5*Math.sin(state.time*4+pl.phase);
        (pl.glow.material as THREE.Material).opacity=.2+.25*k;
        pl.glow.scale.setScalar(1+.18*k);
      }
    }
    // wet-soil gauge: dark when freshly watered, fading pale as it dries
    if(pl.wet)(pl.wet.material as THREE.Material).opacity=Math.min(.55,(pl.hyd/100)*.6);
  }
}
