import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {playerPos,player,idleCars,cameraRig,cur,getBusted} from '@/actors/player.ts';
import {economy} from '@/core/economy.ts';
import {addWanted} from '@/core/physics.ts';
import {groundHeight,TOWN_CX,RURAL_GAP} from '@/core/constants.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {blip} from '@/audio/audio.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {makePed,animatePed,makeMotorcycle} from '@/core/entities.ts';
import {say} from '@/ui/speech.ts';
import {WEED_CX,WEED_CZ,WEED_SLOTS,WEED_BOX,WEED_TAP,WEED_RACK,WEED_GATE,GATE_HALF,
  makeWeedPlant,makeBud,makeBucket,makeWaterDrop} from '../../assets/models/rural/weed-farm.ts';
import {makeWeedBackpack} from '../../assets/models/rural/weed-backpack.ts';
import {MiniGameId} from '@/activities/minigame.ts';
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.ts';
import {STRAINS,STRAIN_BY_ID,FERTILIZER} from '@/activities/strains.ts';
import {getDay} from '@/world/daynight.ts';
import {Npc} from '@/actors/npc.ts';

// ============================================================================
// GREEN ACRES — the HIDDEN weed-farm activity, played entirely in the 3D world on
// foot inside the walled compound (the compound is in
// assets/models/rural/weed-farm.ts). No map blip, no HUD, no floating markers:
// the FARM ITSELF tells you everything. The loop:
//
//   1. PLANT  — stand on an empty planter bed, press E → a 3D seedling pops in.
//   2. WATER  — water is carried ONE bucket at a time: fill at the TAP (a bucket
//               appears in the player's hand), walk to a plant, press E to POUR it
//               (the arm tips the bucket and water arcs onto the bed). One bucket
//               waters one plant; you CANNOT water with an empty hand.
//   3. GROW   — read the crop by LOOKING at it: a thirsty plant visibly droops and
//               its soil dries pale; a watered plant stands up and the soil goes
//               dark and wet. Keeping it well-watered raises its QUALITY; letting
//               it run dry wilts it and, if ignored, kills it.
//   4. HARVEST— a ripe plant glistens (frosted cola + soft pulsing glow). Press E
//               to cut it — buds burst off and you carry the FLOWERS. Better-tended
//               plants give more, higher-grade buds (SCHWAG → FIRE).
//   5. STASH  — drop the harvest in the DEPOSIT crate (no cash here, just storage).
//   6. DELIVER— take the stash OUT of the box: the player straps on a backpack and
//               enters a DELIVERY RUN. Carry it to buyers spread across the country
//               and the city and DEAL it for cash (city buyers pay a premium). Touch
//               the box again empty-handed to hand the backpack back.
//
// Open-world activity: zone actions + a per-frame update, no world lock.
// ============================================================================

const WEED_BUILD=' ◆ GREEN ACRES';
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
const PILE_CAP=27;        // max bud nuggets shown piled in the crate
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
// the drying rack: 'empty' → hang a harvest → 'drying' (cures over weedFarm.cureTimeSec) → 'cured'
const rack: {state:'empty'|'drying'|'cured';buds:number;val:number;t:number;fx:THREE.Object3D[]}={state:'empty',buds:0,val:0,t:0,fx:[]};

let waterCharges=0;       // pours left in the carried bucket (filled at the tap)
// ---------- farm upgrades (bought at the grow shack; persisted via the save) ----------
// Tiers of watering gear cut the tap-trip tedium; the top tier waters the beds for you.
const UPGRADES=[
  {name:'BIGGER CAN',     price:REWARDS.weedFarm.upgradePrices[0],  desc:'WATER 3 PLANTS PER FILL'},
  {name:'GARDEN HOSE',    price:REWARDS.weedFarm.upgradePrices[1], desc:'WATER 8 PLANTS PER FILL'},
  {name:'DRIP SPRINKLERS',price:REWARDS.weedFarm.upgradePrices[2], desc:'THE BEDS WATER THEMSELVES'},
];
const WATER_CAP=[1,3,8,8];   // bucket capacity by upgrade level
let upLevel=0;               // 0 = bare bucket … 3 = sprinklers installed
const canCapacity=()=>WATER_CAP[Math.min(upLevel,3)];
const hasSprinklers=()=>upLevel>=3;
let carried=0;            // FRESH flowers in hand (harvested, not yet stashed)
let carriedVal=0;         // accrued cash value of the carried buds (strains differ in $/bud)
let boxed=0;              // flowers delivered this life (debug)
const pile: THREE.Object3D[]=[];            // visual bud nuggets stashed in the deposit crate

// ---------- deposit box → backpack → delivery run ----------
// The crate is a DEPOSIT box: stashing pays nothing. Take the stash OUT and the
// player straps on a backpack and enters a DELIVERY RUN — carry it to buyers spread
// across the countryside and the city and DEAL it for cash (city buyers pay a premium
// for the trek). Touch the box again (empty-handed) to hand the backpack back.
const deposit={buds:0,val:0};                 // stash sitting in the box (no cash here)
const pack={active:false,buds:0,val:0,orig:0}; // what the backpack carries on a run
let backpackObj: THREE.Object3D|null=null;     // the 3D pack worn on the player's back
let delivering=false;
const DELIV_RANGE=2.6;
// buyers: a few rural roadside spots + a couple of city road junctions (spawned only
// during a run). All sit on open road/clearing ground — clear of buildings/fences.
// `gated` marks a buyer that needs a boat/plane to reach: it is EXCLUDED from the
// "out of buyers → respawn a fresh batch" check so a player who can't cross water is
// never left holding a stash with no reachable buyer (see deliverTo).
const DELIV_POINTS: {x:number;z:number;city:boolean;gated?:boolean}[]=[
  {x:TOWN_CX,        z:12,  city:false}, // Pine Hollow village square (north of the flag)
  {x:320+RURAL_GAP,  z:5,   city:false}, // open countryside, roadside (x=450)
  {x:236+RURAL_GAP,  z:-6,  city:false}, // farmhouse row, out on the dirt road (x=366)
  {x:49,             z:5,   city:true },  // city: by a central road junction
  {x:-49,            z:5,   city:true },  // city: by a road junction
  {x:30,             z:200, city:false}, // city BEACH: a buyer down on the sand by the water
  {x:-380,           z:-44, city:true, gated:true },  // far ISLAND: needs a boat/plane to reach (premium rate)
];
// a live delivery buyer placed in the world during a run
// A weed buyer waiting at a deal point. Extends Npc (so 100% of NPCs share the
// base class) with register:false — buyers are dealt to, never shot, so they stay
// out of the unified weapon scan. `ped` aliases the base `g` for the existing code.
class Buyer extends Npc{
  x:number;z:number;city:boolean;gated:boolean;served:boolean;want:number;t:number;
  constructor(g:THREE.Object3D,x:number,z:number,city:boolean,gated:boolean,want:number){
    super(g,{kind:'buyer',hp:1,register:false,area:city?'City buyer':'Country buyer'});
    this.x=x;this.z=z;this.city=city;this.gated=gated;this.served=false;this.want=want;this.t=0;
  }
  get ped():THREE.Object3D{return this.g;}
  override aliveState():string{return this.served?'Deal done':'Waiting for a deal';}
}
let buyers: Buyer[]=[];
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
  idleCars.push({g,heading:0,speed:0,name:'DIRT RUNNER',police:false,bike:true});
})();

// ---------- buyers' patter: a fat pool of random, funny one-liners a buyer blurts
// out when you deal to them (shown as a floating speech bubble during the deal). ----
const pick=<T>(a: T[]): T=>a[(Math.random()*a.length)|0];
const WEED_BUYER_LINES=[
  "Thanks for the stash, partner!",
  "This bud's gonna save my whole week.",
  "Munchies are calling — gotta run!",
  "You're a lifesaver, my guy.",
  "Top shelf, just like you promised.",
  "My couch and I thank you deeply.",
  "Finally, the GOOD stuff!",
  "Pleasure doing business, friend.",
  "Smells like a great weekend already.",
  "Keep it green, keep it clean.",
  "I was THIS close to going sober. Phew.",
  "Bless you and your little garden.",
  "Tell the plants I said thanks.",
  "It's medicinal. For my vibes.",
  "Right on time, the snacks are waiting.",
  "You grow it, I blow it!",
  "Quality control approves.",
  "My doctor won't, but my soul will.",
  "Catch you next harvest, legend.",
  "Discreet as always. Love that.",
  "Gonna watch cartoons all night now.",
  "Best dealer on the whole coast.",
  "Smooth, green, and oh so serene.",
  "Don't tell my landlord, alright?",
  "I'll name my next houseplant after you.",
  "Pizza's on the way — perfect timing.",
  "You just made my whole Tuesday.",
  "Worth the drive out here, every time.",
  "Shhh — you didn't see me, I didn't see you.",
  "Pairs great with absolutely nothing to do.",
  "Couch mode: activated.",
  "Sweet, sweet relief. Thank you, chief.",
  "My cat's gonna love how chill I get.",
  "Five stars. Would deal again.",
  "Keep the change, keep the secret.",
  "Dankest in the whole county, hands down.",
  "Ahh, the cure for a long week.",
  "Smells like home. Appreciate ya.",
];

let bucketObj: THREE.Object3D|null=null;       // the 3D bucket parented to the player's hand while carrying
let pourT=0;              // pour-animation timer (>0 while tipping the bucket)
let pourSlot: Slot|null=null;        // the slot being watered during the pour
let pourApplied=false;    // whether the water has landed (hyd set) this pour
// live particles (water droplets + harvest bud burst)
interface Particle{m: THREE.Object3D;vx:number;vy:number;vz:number;gy:number;}
const fx: Particle[]=[];              // live particles (water droplets + harvest bud burst)
const _wp=new THREE.Vector3();

const rand=(a: number,b: number)=>a+Math.random()*(b-a);
const dist=(p: {x:number;z:number},o: {x:number;z:number})=>Math.hypot(p.x-o.x,p.z-o.z);
const clamp01=(v: number)=>v<0?0:v>1?1:v;
const playerLimbs=()=>player?.g?.userData?.limbs||null;

const grade=(q: number)=>q>=85?'FIRE':q>=65?'DANK':q>=40?'MIDS':'SCHWAG';
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

// ---------- bucket carried in hand ----------
function attachBucket(): void{
  const l=playerLimbs();
  if(!l?.rightForearm)return;
  detachBucket();
  bucketObj=makeBucket(true);
  bucketObj.position.set(0,-.30,.06);  // hangs from the hand, slightly in front
  bucketObj.rotation.set(0,0,0);
  l.rightForearm.add(bucketObj);
}
function detachBucket(): void{
  if(bucketObj){bucketObj.parent?.remove(bucketObj);bucketObj=null;}
}

// ---------- plant lifecycle ----------
function plantSeed(slot: Slot): void{
  if(slot.plant)return;
  // seeds are bought at the rural General Store (js/places/general-store.ts); no seed, no planting
  const sid=plantStrain();
  if(!sid){
    message('NO SEEDS - BUY THEM AT THE GENERAL STORE','var(--pink)');
    blip([300,220],.06,'square',.08);
    return;
  }
  state.seeds[sid]--;
  const st=STRAIN_BY_ID[sid];
  const y=groundHeight(slot.x,slot.z)+.38;        // sits on the raised planter soil
  const g=makeWeedPlant(1,false,st.color);        // tinted to the strain
  g.position.set(slot.x,y,slot.z);g.rotation.y=rand(0,Math.PI*2);g.scale.setScalar(.3);
  // wet-soil decal: a dark disc over the bed whose opacity tracks hydration
  const wet=new THREE.Mesh(new THREE.CircleGeometry(.95,16),
    new THREE.MeshBasicMaterial({color:0x1c0d04,transparent:true,opacity:0,depthWrite:false}));
  wet.rotation.x=-Math.PI/2;wet.position.set(slot.x,y,slot.z);
  scene.add(g,wet);
  slot.plant={g,wet,glow:null,stage:'seed',t:0,hyd:45,dryT:0,strain:sid,
    quality:QUALITY_START,baseY:y,phase:rand(0,6.28),pop:0};
  message(`PLANTED ${st.name} - FILL A BUCKET AT THE TAP AND POUR IT`,'var(--cyan)');
  blip([392,523],.06,'sine',.13);
}

function fillCan(): void{
  if(waterCharges>0)return;
  waterCharges=canCapacity();              // the player now visibly carries a full bucket
  attachBucket();
  message(canCapacity()>1?`BUCKET FILLED - ${canCapacity()} POURS`:'BUCKET FILLED - CARRY IT TO A PLANT','var(--cyan)');
  blip([392,523,659],.06,'sine',.13);
}

// Start pouring the bucket over a plant. The water only lands (and a charge is
// only spent) partway through the pour animation — see updateWeedFarm.
function water(slot: Slot): void{
  const pl=slot.plant;
  if(!pl||pl.stage==='dead'||waterCharges<=0||pourT>0)return; // need water; one pour at a time
  pourSlot=slot;pourT=POUR_TIME;pourApplied=false;
  message('POURING THE WATER','var(--cyan)');
  blip([523,659],.05,'sine',.13);
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

function removePlant(slot: Slot): void{
  const pl=slot.plant;
  if(!pl)return;
  scene.remove(pl.g,pl.wet);
  (pl.wet.material as THREE.Material).dispose();
  (pl.glow?.material as THREE.Material|undefined)?.dispose();
  slot.plant=null;
}

function clearSlot(slot: Slot): void{
  removePlant(slot);
  message('CLEARED THE BED','var(--cream)');
  blip([300,220],.05,'square',.08);
}

function harvest(slot: Slot): void{
  const pl=slot.plant!;
  const q=pl.quality;
  const st=STRAIN_BY_ID[pl.strain]||STRAIN_BY_ID.hybrid;
  const fed=pl.fed?FERTILIZER.yieldMul:1;
  const buds=Math.max(YIELD_MIN,Math.round((YIELD_MIN+(YIELD_MAX-YIELD_MIN)*(q/100))*st.yieldMul*fed));
  carried+=buds;
  carriedVal+=buds*Math.round(PRICE*REWARDS.weedFarm.strainValues[st.id]);   // this strain's $/bud locked in now
  spawnBurst(slot);
  removePlant(slot);
  bigText(`+${buds} ${st.name} ${grade(q)}`,'var(--gold)');setTimeout(hideBig,1000);
  message(`CARRYING ${carried} BUDS - STASH THEM IN THE DEPOSIT BOX`,'var(--gold)');
  blip([659,880,1175],.07,'square',.18);
}

function addBudsToPile(n: number): void{
  const y0=groundHeight(box.x,box.z)+1.05;   // piled inside the deposit crate
  for(let i=0;i<n&&pile.length<PILE_CAP;i++){
    const b=makeBud(rand(.8,1.1));
    const layer=(pile.length/8)|0;
    b.position.set(box.x+rand(-.4,.4),y0+layer*.13,box.z+rand(-.28,.28));
    b.rotation.set(rand(0,3),rand(0,3),rand(0,3));
    scene.add(b);pile.push(b);
  }
}
function clearPile(): void{ for(const b of pile)scene.remove(b); pile.length=0; }

// ---------- deposit box: stash (no pay) / take out (backpack + run) / return ----------
function depositBuds(): void{
  if(carried<=0)return;
  deposit.buds+=carried;deposit.val+=carriedVal;
  addBudsToPile(carried);
  message(`STASHED ${carried} BUDS - NO CASH HERE; TAKE IT OUT TO RUN DELIVERIES`,'var(--gold)');
  blip([330,392],.06,'sine',.12);
  carried=0;carriedVal=0;
}
function withdrawPack(): void{
  if(pack.active||deposit.buds<=0)return;
  pack.active=true;pack.buds=deposit.buds;pack.val=deposit.val;pack.orig=deposit.buds;
  deposit.buds=0;deposit.val=0;clearPile();
  runEarned=0;
  attachBackpack();spawnBuyers();delivering=true;
  bigText('DELIVERY RUN','var(--gold)');setTimeout(hideBig,1100);
  message(`${pack.buds} BUDS ON YOUR BACK - DEAL THEM TO BUYERS ON THE MAP (CITY PAYS MORE)`,'var(--gold)');
  blip([392,523,659,784],.08,'sine',.14);
}
function returnPack(): void{
  if(!pack.active)return;
  deposit.buds+=pack.buds;deposit.val+=pack.val;
  addBudsToPile(pack.buds);
  endRunCleanup();
  message('BACKPACK RETURNED - THE STASH IS BACK IN THE BOX','var(--cream)');
  blip([300,240],.05,'square',.1);
}
function endRunCleanup(): void{
  pack.active=false;pack.buds=0;pack.val=0;pack.orig=0;
  delivering=false;detachBackpack();despawnBuyers();
  if(weedHud)weedHud.classList.remove('show');
}
function finishRun(): void{
  const sold=pack.orig;
  reportMiniGameResult(MiniGameId.WEED_FARM,{won:true,score:sold});
  boxed+=sold;
  endRunCleanup();
  bigText('ALL DELIVERED','var(--gold)');setTimeout(hideBig,1100);
  message(`RUN COMPLETE - DELIVERED ${sold} BUDS`,'var(--gold)');
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
  bigText(`+$${pay}`,'var(--gold)');
  state.mode='cut';state.cutT=1.8;
  state.cutFn=()=>{state.mode='foot';after();};
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
    message('SETUP! - THE BUYER WAS AN UNDERCOVER COP!','var(--pink)');
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
  message(`DEALT ${chunk} BUDS - +$${pay}${pack.buds>0?` (${pack.buds} LEFT)`:''}`,'var(--gold)');
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
  if(!economy.spend(u.price,'spend')){message(`NOT ENOUGH MONEY - NEED $${u.price}`,'var(--pink)');return;}
  upLevel++;
  if(hasSprinklers())installSprinklerVisuals();
  bigText('FARM UPGRADED','var(--gold)');setTimeout(hideBig,1000);
  message(`${u.name} INSTALLED - ${u.desc}`,'var(--gold)');
  blip([523,659,784,1047],.09,'square',.16);
}

// ---------- fertilizer: feed a growing plant once for a bigger, better harvest ----------
function fertilize(slot: Slot): void{
  const pl=slot.plant;
  if(!pl||pl.fed||pl.stage==='dead'||pl.stage==='ripe')return;
  if((state.fertilizer|0)<=0){message('NO PLANT FOOD - BUY IT AT THE GENERAL STORE','var(--pink)');return;}
  state.fertilizer--;
  pl.fed=true;pl.pop=.4;
  message(`FED ${STRAIN_BY_ID[pl.strain]?.name||''} - BIGGER, BETTER BUDS`,'var(--gold)');
  blip([523,659,880],.07,'sine',.14);
}

// ---------- drying rack: hang a wet harvest, let it cure, collect for more cash ----------
function hangBuds(): void{
  if(rack.state!=='empty'||carried<=0)return;
  rack.state='drying';rack.buds=carried;rack.val=carriedVal;rack.t=0;
  const y0=groundHeight(rackPos.x,rackPos.z)+1.85;        // hang clusters along the top bar
  const n=Math.min(8,Math.max(3,carried));
  for(let i=0;i<n;i++){
    const b=makeBud(rand(1.0,1.4));
    b.position.set(rackPos.x-1.3+i*(2.6/(n-1||1)),y0-rand(.1,.3),rackPos.z);
    b.rotation.set(rand(0,3),rand(0,3),rand(0,3));
    scene.add(b);rack.fx.push(b);
  }
  carried=0;carriedVal=0;
  message('HUNG TO DRY - COME BACK ONCE IT HAS CURED','var(--cyan)');
  blip([392,330],.07,'sine',.12);
}
function collectCured(): void{
  if(rack.state!=='cured')return;
  carried=rack.buds;carriedVal=Math.round(rack.val*REWARDS.weedFarm.cureBonus);
  for(const b of rack.fx)scene.remove(b);rack.fx.length=0;
  rack.state='empty';rack.buds=0;rack.val=0;rack.t=0;
  bigText('CURED FLOWERS','var(--gold)');setTimeout(hideBig,1000);
  message(`COLLECTED ${carried} CURED BUDS - STASH THEM IN THE DEPOSIT BOX`,'var(--gold)');
  blip([659,880,1175],.08,'square',.18);
}

// ---------- particles (water droplets + harvest burst) ----------
function spawnDrops(slot: Slot|null): void{
  if(!slot?.plant)return;
  const py=slot.plant.baseY;
  if(bucketObj)bucketObj.getWorldPosition(_wp); else _wp.set(slot.x,py+1.4,slot.z);
  for(let i=0;i<14;i++){
    const d=makeWaterDrop();
    d.position.set(_wp.x+rand(-.05,.05),_wp.y,_wp.z+rand(-.05,.05));
    scene.add(d);
    fx.push({m:d,vx:(slot.x-_wp.x)*.7+rand(-.25,.25),vy:rand(.2,.9),
      vz:(slot.z-_wp.z)*.7+rand(-.25,.25),gy:py+.05});
  }
}
function spawnBurst(slot: Slot): void{
  const y=slot.plant!.baseY+.8, gy=groundHeight(slot.x,slot.z)+.1;
  for(let i=0;i<9;i++){
    const b=makeBud(rand(.5,.8));
    b.position.set(slot.x+rand(-.15,.15),y,slot.z+rand(-.15,.15));
    scene.add(b);
    fx.push({m:b,vx:rand(-1.3,1.3),vy:rand(1.6,3),vz:rand(-1.3,1.3),gy});
  }
}
function updateFx(dt: number): void{
  for(let i=fx.length-1;i>=0;i--){
    const p=fx[i];
    p.vy-=9*dt;
    p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;
    if(p.m.position.y<=p.gy){scene.remove(p.m);fx.splice(i,1);}
  }
}

// ---------- registry: ONE context-sensitive zone action on foot ----------
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='foot')return null;
  const p=playerPos();
  if(dist(p,box)<RANGE){
    if(carried>0) // fresh harvest in hand → stash it (no money here)
      return{label:'STASH',prompt:`STASH ${carried} BUD${carried>1?'S':''} (NO PAY - DELIVER FOR CASH)`,enabled:true,run:depositBuds};
    if(pack.active) // already on a run → hand the backpack back
      return{label:'STASH',prompt:'RETURN THE DELIVERY BACKPACK',enabled:true,run:returnPack};
    if(deposit.buds>0) // stash sitting in the box → strap on the backpack for a run
      return{label:'TAKE',prompt:`TAKE ${deposit.buds} BUDS FOR DELIVERY`,enabled:true,run:withdrawPack};
  }
  if(dist(p,tap)<RANGE&&waterCharges<=0)
    return{label:'FILL',prompt:'FILL THE WATERING BUCKET',enabled:true,run:fillCan};
  // drying rack: hang a wet harvest, watch it cure, then collect it for more cash
  if(dist(p,rackPos)<RANGE){
    if(rack.state==='cured')
      return{label:'COLLECT',prompt:`COLLECT ${rack.buds} CURED BUDS`,enabled:true,run:collectCured};
    if(rack.state==='drying')
      return{label:'DRY',prompt:`DRYING - ${Math.ceil(REWARDS.weedFarm.cureTimeSec-rack.t)}s LEFT`,enabled:true,
        run:()=>message('STILL DRYING - GIVE IT TIME','var(--cyan)')};
    if(carried>0)
      return{label:'DRY',prompt:`HANG ${carried} BUDS TO DRY (+${Math.round((REWARDS.weedFarm.cureBonus-1)*100)}% WHEN CURED)`,
        enabled:true,run:hangBuds};
  }
  // grow-shack: reinvest earnings into farm upgrades (watering gear → sprinklers)
  if(dist(p,shackPos)<RANGE){
    if(upLevel>=UPGRADES.length)
      return{label:'SHED',prompt:'ALL FARM UPGRADES OWNED',enabled:false,run:()=>{}};
    const u=UPGRADES[upLevel];
    if(state.money<u.price)
      return{label:'SHED',prompt:`NEED $${u.price} FOR ${u.name}`,enabled:true,
        run:()=>message(`NOT ENOUGH MONEY - NEED $${u.price}`,'var(--pink)')};
    return{label:'UPGRADE',prompt:`BUY ${u.name} $${u.price} - ${u.desc}`,enabled:true,run:buyUpgrade};
  }
  let best: Slot|null=null,bd=RANGE;
  for(const s of slots){const d=dist(p,s);if(d<bd){bd=d;best=s;}}
  if(!best)return null;
  const pl=best.plant;
  if(!pl){
    const sid=plantStrain();
    if(sid){
      const st=STRAIN_BY_ID[sid];
      return{label:'PLANT',prompt:`PLANT ${st.name} (${seedCount(sid)} LEFT)`,enabled:true,run:()=>plantSeed(best!)};
    }
    return{label:'PLANT',prompt:'NEED SEEDS - BUY AT THE GENERAL STORE',enabled:true,
      run:()=>plantSeed(best!)}; // plantSeed shows the "buy seeds" hint when empty
  }
  if(pl.stage==='dead')return{label:'CLEAR',prompt:'CLEAR THE DEAD PLANT',enabled:true,run:()=>clearSlot(best!)};
  if(pl.stage==='ripe')return{label:'HARVEST',prompt:`HARVEST THE ${grade(pl.quality)} FLOWERS`,enabled:true,run:()=>harvest(best!)};
  // with a full bucket you can pour on any not-full plant; without one you simply
  // CANNOT water — a thirsty plant just tells you to go fill a bucket at the tap.
  if(waterCharges>0&&pl.hyd<92)return{label:'WATER',prompt:`POUR THE BUCKET${waterCharges>1?` (${waterCharges} LEFT)`:''}`,enabled:true,run:()=>water(best!)};
  if(pl.hyd<35)return{label:'WATER',prompt:'NEEDS WATER - FILL A BUCKET AT THE TAP',enabled:true,
    run:()=>message('FILL A BUCKET AT THE TAP FIRST','var(--cyan)')};
  // well-watered & growing: offer to FEED it once if you carry plant food
  if((pl.stage==='seed'||pl.stage==='growing')&&!pl.fed&&(state.fertilizer|0)>0)
    return{label:'FEED',prompt:`FEED PLANT FOOD (${state.fertilizer} LEFT)`,enabled:true,run:()=>fertilize(best!)};
  return{label:'GROW',prompt:pl.fed?'GROWING (FED) - KEEP IT WATERED':'GROWING - KEEP IT WATERED',enabled:true,
    run:()=>message('STILL GROWING','var(--cyan)')};
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
  const risk=heat>HEAT_WARM?' - RISKY, HEAT HIGH!':'';
  return{label:'DEAL',prompt:`DEAL ${chunk} BUDS (+$${pay})${best.city?' CITY+':''}${risk}`,
    enabled:true,run:()=>deliverTo(best!)};
});

// The grow-op itself stays OFF the map (you find the walls). But while a delivery run
// is on, the BUYERS show on the radar/map so you know where to take the stash.
(refs.miniBlips||(refs.miniBlips=[])).push(()=>delivering
  ? buyers.filter(b=>!b.served).map(b=>({x:b.x,z:b.z,icon:'person',
      color:b.city?'#19e3ff':'#9dff2e',label:'BUYER'}))
  : []);

refs.getWeedFarmState=()=>{
  let planted=0,ripe=0;
  for(const s of slots){if(s.plant){planted++;if(s.plant.stage==='ripe')ripe++;}}
  return{planted,ripe,carried,carriedVal,boxed,waterCharges,upLevel,sprinklers:hasSprinklers(),
    seeds:{...state.seeds},seedSel:state.seedSel||plantStrain(),
    deposit:{...deposit},delivering,heat:Math.round(heat),runEarned,
    pack:{active:pack.active,buds:pack.buds,val:pack.val},
    buyers:buyers.filter(b=>!b.served).length};
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
  const tag=heat>HEAT_HOT?'HOT':heat>HEAT_WARM?'WARM':'CHILL';
  const col=heat>HEAT_HOT?'#ff4d4d':heat>HEAT_WARM?'#ffb43b':'#7fe07f';
  const left=buyers.filter(b=>!b.served).length;
  weedHud.innerHTML=
    `<div class="weed-label">WEED RUN</div>`+
    `<div class="weed-main"><span>BUDS</span><b>${pack.buds}</b></div>`+
    `<div class="weed-row"><span>EARNED</span><b>$${runEarned}</b></div>`+
    `<div class="weed-row"><span>BUYERS</span><b>${left}</b></div>`+
    `<div class="weed-heat" style="color:${col}">HEAT ${tag}</div>`+
    `<div class="weed-meter"><i style="width:${Math.min(100,heat)|0}%;background:${col}"></i></div>`;
}

// ---------- per-frame update (called from main.js, no world lock) ----------
export function updateWeedFarm(dt: number): void{
  // pour animation — runs AFTER the player's walk pose (updateFoot) each frame, so
  // tipping the arm here wins. Water lands mid-pour, then the bucket empties.
  if(pourT>0){
    pourT-=dt;
    if(state.mode==='foot'){
      const l=playerLimbs();
      if(l){l.rightArm.rotation.set(-1.45,0,-.25);l.rightForearm?.rotation.set(-.55,0,0);}
      if(bucketObj)bucketObj.rotation.z=Math.min(2.1,(POUR_TIME-pourT)*4.5);
    }
    if(!pourApplied&&pourT<=POUR_TIME*.55){
      pourApplied=true;
      const pl=pourSlot?.plant;
      if(pl&&pl.stage!=='dead'){pl.hyd=100;pl.pop=.35;}
      spawnDrops(pourSlot);
    }
    if(pourT<=0){pourT=0;waterCharges=Math.max(0,waterCharges-1);pourSlot=null;if(waterCharges<=0)detachBucket();}
  }
  updateFx(dt);

  // Carry the water only AT the plot: wander off (or hop on a vehicle) and a filled
  // bucket is left behind — you refill at the tap when you come back. Stops the
  // bucket dangling in the player's hand halfway across the map.
  if(waterCharges>0&&pourT<=0){
    const p=playerPos();
    if(state.mode!=='foot'||Math.hypot(p.x-WEED_CX,p.z-WEED_CZ)>BUCKET_DROP_DIST){
      const walked=state.mode==='foot';
      waterCharges=0;detachBucket();
      if(walked)message('LEFT THE BUCKET BEHIND - REFILL AT THE TAP','var(--cream)');
    }
  }

  // Vehicles can't ride into the grow-op. The gate gap stays open for the on-foot
  // player (so the activity works), but a DRIVEN vehicle that noses into it is bounced
  // back outside — keeps a moto/car out of the planter beds and off the crop.
  if(state.mode==='car'&&cur){
    const p=cur.g.position, gateZ=WEED_GATE.z-1.5; // the north wall line (gate plane)
    if(Math.abs(p.x-WEED_CX)<GATE_HALF+1.3&&p.z<gateZ+1.3&&p.z>gateZ-20){
      p.z=gateZ+1.3;cur.speed*=-.3;                // shove it back out the gate
    }
  }

  // drying rack: cure over time, then the hanging buds visibly shrink (dried)
  if(rack.state==='drying'){
    rack.t+=dt;
    if(rack.t>=REWARDS.weedFarm.cureTimeSec){rack.state='cured';for(const b of rack.fx)b.scale.multiplyScalar(.8);}
  }

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
    if(farmLinger>6){addWanted(3,'POLICE RAID ON THE FARM!','weed_raid');heat=Math.max(0,heat-40);farmLinger=0;}
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
