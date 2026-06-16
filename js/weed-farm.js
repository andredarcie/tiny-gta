import * as THREE from 'three';
import {state,refs} from './state.js';
import {scene} from './engine.js';
import {playerPos,player} from './player.js';
import {economy} from './economy.js';
import {groundHeight} from './constants.js';
import {blip} from './audio.js';
import {message,bigText,hideBig} from './hud.js';
import {WEED_CX,WEED_CZ,WEED_SLOTS,WEED_BOX,WEED_TAP,makeWeedPlant,makeBud,
  makeBucket,makeWaterDrop} from '../assets/models/rural/weed-farm.js';
import {MiniGameId} from './minigame.js';
import {reportMiniGameResult} from './minigame-leaderboard.js';

// ============================================================================
// GREEN ACRES — the HIDDEN weed-farm activity, played entirely in the 3D world on
// foot inside the walled compound (the compound is in
// assets/models/rural/weed-farm.js). No map blip, no HUD, no floating markers:
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
//   5. SELL   — take the flowers to the SALE TABLE crate and press E to box them.
//               Bigger batches fetch a better price per bud.
//
// Open-world activity: a zone action + a per-frame update, no world lock.
// ============================================================================

const WEED_BUILD=' ◆ GREEN ACRES';
document.getElementById('buildver')?.insertAdjacentText('beforeend',WEED_BUILD);

// ---------- tuning ----------
const RANGE=2.8;          // interaction radius to a bed / tap / sale table
const GROW_TIME=36;       // seconds of HYDRATED growth from seedling to ripe
const HYD_DRAIN=4;        // hydration lost per second (a bucket lasts ~25 s)
const DRY_DEATH=16;       // seconds bone-dry before the plant wilts and dies
const SEED_F=0.18;        // growth fraction where the seedling becomes a plant
const POUR_TIME=1.1;      // length of the pour-the-bucket animation (s)
const PRICE=10;           // base cash per bud at the sale table
const PILE_CAP=27;        // max bud nuggets shown piled in the crate
// quality (care matters): recovers while well-watered, bleeds while parched
const QUALITY_START=78, QUALITY_RECOVER=3, QUALITY_DROP=9, HYD_HEALTHY=30;
const YIELD_MIN=2, YIELD_MAX=6; // buds from a ripe plant, by its locked quality

// world-space slot / sale / tap positions (mirror the baked compound)
const slots=WEED_SLOTS.map(s=>({x:WEED_CX+s.x,z:WEED_CZ+s.z,plant:null}));
const box={x:WEED_CX+WEED_BOX.x,z:WEED_CZ+WEED_BOX.z};
const tap={x:WEED_CX+WEED_TAP.x,z:WEED_CZ+WEED_TAP.z};

let hasWater=false;       // the carried bucket holds one charge (filled at the tap)
let carried=0;            // flowers in hand (harvested, not yet sold)
let boxed=0;              // flowers sold this life (debug)
const pile=[];            // visual bud nuggets in the crate

let bucketObj=null;       // the 3D bucket parented to the player's hand while carrying
let pourT=0;              // pour-animation timer (>0 while tipping the bucket)
let pourSlot=null;        // the slot being watered during the pour
let pourApplied=false;    // whether the water has landed (hyd set) this pour
const fx=[];              // live particles (water droplets + harvest bud burst)
const _wp=new THREE.Vector3();

const rand=(a,b)=>a+Math.random()*(b-a);
const dist=(p,o)=>Math.hypot(p.x-o.x,p.z-o.z);
const clamp01=v=>v<0?0:v>1?1:v;
const playerLimbs=()=>player?.g?.userData?.limbs||null;

const grade=q=>q>=85?'FIRE':q>=65?'DANK':q>=40?'MIDS':'SCHWAG';
// total cash for selling n buds — a batch bonus rewards harvesting then selling
// together rather than one bud at a time (+$2/bud per 4 buds, capped at +$6).
const bulkPrice=n=>n*(PRICE+Math.min(6,((n/4)|0)*2));

// ---------- bucket carried in hand ----------
function attachBucket(){
  const l=playerLimbs();
  if(!l?.rightForearm)return;
  detachBucket();
  bucketObj=makeBucket(true);
  bucketObj.position.set(0,-.30,.06);  // hangs from the hand, slightly in front
  bucketObj.rotation.set(0,0,0);
  l.rightForearm.add(bucketObj);
}
function detachBucket(){
  if(bucketObj){bucketObj.parent?.remove(bucketObj);bucketObj=null;}
}

// ---------- plant lifecycle ----------
function plantSeed(slot){
  if(slot.plant)return;
  const y=groundHeight(slot.x,slot.z)+.38;        // sits on the raised planter soil
  const g=makeWeedPlant(1,false);
  g.position.set(slot.x,y,slot.z);g.rotation.y=rand(0,Math.PI*2);g.scale.setScalar(.3);
  // wet-soil decal: a dark disc over the bed whose opacity tracks hydration
  const wet=new THREE.Mesh(new THREE.CircleGeometry(.95,16),
    new THREE.MeshBasicMaterial({color:0x1c0d04,transparent:true,opacity:0,depthWrite:false}));
  wet.rotation.x=-Math.PI/2;wet.position.set(slot.x,y,slot.z);
  scene.add(g,wet);
  slot.plant={g,wet,glow:null,stage:'seed',t:0,hyd:45,dryT:0,
    quality:QUALITY_START,baseY:y,phase:rand(0,6.28),pop:0};
  message('PLANTED - FILL A BUCKET AT THE TAP AND POUR IT','var(--cyan)');
  blip([392,523],.06,'sine',.13);
}

function fillCan(){
  if(hasWater)return;
  hasWater=true;
  attachBucket();                          // the player now visibly carries a full bucket
  message('BUCKET FILLED - CARRY IT TO A PLANT','var(--cyan)');
  blip([392,523,659],.06,'sine',.13);
}

// Start pouring the bucket over a plant. The water only lands (and the bucket is
// only emptied) partway through the pour animation — see updateWeedFarm.
function water(slot){
  const pl=slot.plant;
  if(!pl||pl.stage==='dead'||!hasWater||pourT>0)return; // need a full bucket; one pour at a time
  pourSlot=slot;pourT=POUR_TIME;pourApplied=false;
  message('POURING THE WATER','var(--cyan)');
  blip([523,659],.05,'sine',.13);
}

// rebuild the plant as a frosted, ripe cola at full size + a soft glistening glow
function setRipe(slot){
  const pl=slot.plant;
  scene.remove(pl.g);
  const g=makeWeedPlant(1,true);
  g.position.set(slot.x,pl.baseY,slot.z);g.rotation.y=rand(0,Math.PI*2);g.scale.setScalar(1);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),
    new THREE.MeshBasicMaterial({color:0xeaffc0,transparent:true,opacity:.3,
      blending:THREE.AdditiveBlending,depthWrite:false}));
  glow.position.y=1.0;g.add(glow);          // sits on the ripe cola, scales/sways with it
  scene.add(g);
  pl.g=g;pl.glow=glow;pl.stage='ripe';
}

function killPlant(slot){
  const pl=slot.plant;
  pl.stage='dead';
  pl.g.rotation.set(0,pl.g.rotation.y,1.3);pl.g.scale.y*=.45; // wilt over and droop
}

function removePlant(slot){
  const pl=slot.plant;
  if(!pl)return;
  scene.remove(pl.g,pl.wet);
  pl.wet.material.dispose();
  pl.glow?.material.dispose();
  slot.plant=null;
}

function clearSlot(slot){
  removePlant(slot);
  message('CLEARED THE BED','var(--cream)');
  blip([300,220],.05,'square',.08);
}

function harvest(slot){
  const pl=slot.plant;
  const q=pl.quality;
  const buds=Math.max(YIELD_MIN,Math.round(YIELD_MIN+(YIELD_MAX-YIELD_MIN)*(q/100)));
  carried+=buds;
  spawnBurst(slot);
  removePlant(slot);
  bigText(`+${buds} ${grade(q)} FLOWERS`,'var(--gold)');setTimeout(hideBig,1000);
  message(`CARRYING ${carried} BUDS - SELL THEM AT THE TABLE`,'var(--gold)');
  blip([659,880,1175],.07,'square',.18);
}

function addBudsToPile(n){
  const y0=groundHeight(box.x,box.z)+1.05;   // on top of the sale crate
  for(let i=0;i<n&&pile.length<PILE_CAP;i++){
    const b=makeBud(rand(.8,1.1));
    const layer=(pile.length/8)|0;
    b.position.set(box.x+rand(-.4,.4),y0+layer*.13,box.z+rand(-.28,.28));
    b.rotation.set(rand(0,3),rand(0,3),rand(0,3));
    scene.add(b);pile.push(b);
  }
}

function sell(){
  if(carried<=0)return;
  // regra 1x/dia: uma venda por dia in-game (anti-farm da plantação).
  if(refs.mgPlayedToday?.(MiniGameId.WEED_FARM)){message('ALREADY SOLD TODAY - COME BACK TOMORROW','var(--pink)');return;}
  const paid=economy.earn(bulkPrice(carried),'weed-farm');
  boxed+=carried;
  reportMiniGameResult(MiniGameId.WEED_FARM,{won:true,score:carried});
  addBudsToPile(carried);
  message(`SOLD ${carried} BUDS - +$${paid}`,'var(--gold)');
  blip([523,659,784,1047],.09,'square',.18);
  carried=0;
}

// ---------- particles (water droplets + harvest burst) ----------
function spawnDrops(slot){
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
function spawnBurst(slot){
  const y=slot.plant.baseY+.8, gy=groundHeight(slot.x,slot.z)+.1;
  for(let i=0;i<9;i++){
    const b=makeBud(rand(.5,.8));
    b.position.set(slot.x+rand(-.15,.15),y,slot.z+rand(-.15,.15));
    scene.add(b);
    fx.push({m:b,vx:rand(-1.3,1.3),vy:rand(1.6,3),vz:rand(-1.3,1.3),gy});
  }
}
function updateFx(dt){
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
  if(carried>0&&dist(p,box)<RANGE)
    return{label:'SELL',prompt:`SELL ${carried} BUD${carried>1?'S':''} ($${bulkPrice(carried)})`,enabled:true,run:sell};
  if(dist(p,tap)<RANGE&&!hasWater)
    return{label:'FILL',prompt:'FILL THE WATERING BUCKET',enabled:true,run:fillCan};
  let best=null,bd=RANGE;
  for(const s of slots){const d=dist(p,s);if(d<bd){bd=d;best=s;}}
  if(!best)return null;
  const pl=best.plant;
  if(!pl)return{label:'PLANT',prompt:'PLANT A SEED',enabled:true,run:()=>plantSeed(best)};
  if(pl.stage==='dead')return{label:'CLEAR',prompt:'CLEAR THE DEAD PLANT',enabled:true,run:()=>clearSlot(best)};
  if(pl.stage==='ripe')return{label:'HARVEST',prompt:`HARVEST THE ${grade(pl.quality)} FLOWERS`,enabled:true,run:()=>harvest(best)};
  // with a full bucket you can pour on any not-full plant; without one you simply
  // CANNOT water — a thirsty plant just tells you to go fill a bucket at the tap.
  if(hasWater&&pl.hyd<92)return{label:'WATER',prompt:'POUR THE BUCKET',enabled:true,run:()=>water(best)};
  if(pl.hyd<35)return{label:'WATER',prompt:'NEEDS WATER - FILL A BUCKET AT THE TAP',enabled:true,
    run:()=>message('FILL A BUCKET AT THE TAP FIRST','var(--cyan)')};
  return{label:'GROW',prompt:'GROWING - KEEP IT WATERED',enabled:true,
    run:()=>message('STILL GROWING','var(--cyan)')};
});

// NO map blip on purpose — this grow-op is hidden; you have to find the walls.

refs.getWeedFarmState=()=>{
  let planted=0,ripe=0;
  for(const s of slots){if(s.plant){planted++;if(s.plant.stage==='ripe')ripe++;}}
  return{planted,ripe,carried,boxed,hasWater};
};

// ---------- per-frame update (called from main.js, no world lock) ----------
export function updateWeedFarm(dt){
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
    if(pourT<=0){pourT=0;hasWater=false;pourSlot=null;detachBucket();}
  }
  updateFx(dt);

  for(const slot of slots){
    const pl=slot.plant;
    if(!pl)continue;

    // hydration / growth / quality / death (only while still maturing)
    if(pl.stage==='seed'||pl.stage==='growing'){
      pl.hyd-=HYD_DRAIN*dt;if(pl.hyd<0)pl.hyd=0;
      if(pl.hyd>0){
        pl.dryT=0;
        if(pl.hyd>HYD_HEALTHY)pl.quality=Math.min(100,pl.quality+QUALITY_RECOVER*dt);
        pl.t+=dt;
        if(pl.t>=GROW_TIME)setRipe(slot);
        else if(pl.t>=GROW_TIME*SEED_F)pl.stage='growing';
      }else{
        pl.dryT+=dt;
        pl.quality=Math.max(0,pl.quality-QUALITY_DROP*dt);
        if(pl.dryT>=DRY_DEATH)killPlant(slot);
      }
    }
    if(pl.pop>0)pl.pop=Math.max(0,pl.pop-dt*1.5);

    // ---- diegetic state: the plant's body shows how it's doing ----
    if(pl.stage==='seed'||pl.stage==='growing'){
      const f=Math.min(1,pl.t/GROW_TIME);
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
        pl.glow.material.opacity=.2+.25*k;
        pl.glow.scale.setScalar(1+.18*k);
      }
    }
    // wet-soil gauge: dark when freshly watered, fading pale as it dries
    if(pl.wet)pl.wet.material.opacity=Math.min(.55,(pl.hyd/100)*.6);
  }
}
