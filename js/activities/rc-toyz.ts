import * as THREE from 'three';
import {state,input,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {playerPos,cur,idleCars,cameraRig} from '@/actors/player.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip,thud} from '@/audio/audio.ts';
import {N,nodeX,HALF,CELL,ROAD,SIDE,irand,pick,clamp,wrapA,groundHeight} from '@/core/constants.ts';
import {makeCar,spinWheels} from '@/core/entities.ts';
import {makeDeliveryMarker} from '../../assets/models/missions/delivery-marker.ts';
import {makeRcRager} from '../../assets/models/vehicles/rc-rager.ts';
import {makeRcPad} from '../../assets/models/props/rc-pad.ts';
import {makeRcCrate} from '../../assets/models/props/rc-crate.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.ts';
import type {ZoneAction} from '@/core/types.ts';

// RC SMASH — a remote-control demolition mini-game: you pilot a tiny RC car that is
// a MOBILE BOMB. Ram a gang car (or press fire to detonate) and the RC blows up,
// destroying every car in the blast. It is now a fast arcade SCORE-ATTACK:
//   • COMBO CHAINS — wrecks landed within a few seconds build a streak with a cash
//     multiplier and DOUBLE/TRIPLE/RAMPAGE callouts; the sound climbs with the chain.
//   • TIME-ATTACK CLOCK — you start with a short clock and every wreck adds seconds,
//     so a hot streak keeps the round alive (a single kill still passes).
//   • MOVING / FLEEING TARGETS — most gang cars cruise the streets and scatter when
//     the RC gets close, so you chase and intercept instead of hitting static dots.
//   • POWER-UPS + GOLDEN CAR — floating crates grant NITRO / extra TIME / MEGA BLAST,
//     and a rare GOLD car pays triple cash and a big time bonus (it runs away fast).
// Each detonation SPENDS the RC, so a fresh one instantly respawns on the pad.
// Leaving the RC ends the session; it returns to the pad to replay.

const RC_BUILD=' ◆ RC SMASH';
document.getElementById('buildver')?.insertAdjacentText('beforeend',RC_BUILD);

const GREEN=0x5eff8a;
const GOLD_COLOR=0xffd23a;
const ROUND_TIME=70;   // short starting clock — you earn more time by wrecking cars
const TIME_CAP=99;     // clock ceiling (keeps it 2-digit and the round bounded)
const TIME_PER_KILL=1.8; // seconds added per normal wreck
const POOL=5;          // gang cars roaming at once (refilled as they are destroyed)
const HIT_RANGE=2.2;   // RC→car distance that auto-detonates on contact (RC is tiny)
const BLAST=5;         // base blast radius (matches weapons.blastDamage) — a cluster chains
const MEGA_BONUS=4;    // extra blast radius while a MEGA crate is active
const PER_KILL=100;    // base cash per wrecked car (scaled by the combo multiplier)
const GOLD_MULT=3;     // gold car pays triple
const GOLD_TIME=5;     // gold car also gives a big time bonus
const GOLD_CHANCE=.12; // chance a fresh spawn is the rare golden bonus car (max 1 alive)
const MOVE_CHANCE=.55; // chance a normal target cruises the streets instead of parking
const SPAWN_MIN=18, SPAWN_MAX=72; // target spawn distance from the player/pad

// Combo: wrecks within COMBO_WINDOW of each other chain. The cash multiplier steps
// up the longer the chain runs (capped at ×3 to keep payouts near the original
// per-kill and under the backend's plausibility cap); callouts fire per chain length.
const COMBO_WINDOW=3.5;
function comboMult(c: number){ return c>=7?3:c>=4?2:1; }
interface Callout{c:number;txt:string;col:string;}
const CALLOUTS: Callout[]=[
  {c:12,txt:'UNSTOPPABLE!',col:'#ff3bd0'},
  {c:8, txt:'RAMPAGE!',    col:'#ff5a2e'},
  {c:5, txt:'MULTI KILL!', col:'#ffb02e'},
  {c:3, txt:'TRIPLE!',     col:'#ffd23a'},
  {c:2, txt:'DOUBLE!',     col:'#5eff8a'},
];
function callout(c: number): Callout|null{ for(const m of CALLOUTS)if(c>=m.c)return m; return null; }

// Cruising-target speeds (m/s). Fleeing/gold cars sprint but stay under the RC's
// top speed (~32) so the chase is winnable with effort.
const CRUISE_SLOW=7, CRUISE_FAST=15;
const PANIC_R=16, PANIC_TIME=2.2; // RC proximity that makes a car scatter, and for how long

// Power-up crates: one hue per type. They hover over road intersections; drive the
// RC through one to grab it. Staggered respawn keeps a few on the map at all times.
const CRATE_POOL=3, CRATE_RANGE=2.6, CRATE_RESPAWN=5;
const CRATE_TIME=8;                 // seconds a TIME crate adds
const NITRO_TIME=6, NITRO_MUL=1.7;  // duration + top-speed/accel multiplier of NITRO
const MEGA_TIME=8;                  // duration of MEGA BLAST
interface CrateType{id:string;color:number;label:string;}
const CRATE_TYPES: CrateType[]=[
  {id:'nitro',color:0x19e3ff,label:'NITRO!'},
  {id:'time', color:0x5eff8a,label:'+TIME'},
  {id:'mega', color:0xff3bd0,label:'MEGA BLAST!'},
];
const cssHex=(n: number)=>'#'+n.toString(16).padStart(6,'0');

// One gang color per round so the targets read as "a single gang's cars".
const GANG_COLORS=[0x8b1a1a,0x14422a,0x1a2f6b,0x6b2f6b,0xb5862a];
let gangColor=GANG_COLORS[0];

// Pad/RC rest on the SIDEWALK CORNER of block (1,4), just off the intersection in
// front of the gun shop — NOT on the asphalt. nodeX(i) is a road centerline, so
// offsetting by ROAD/2+SIDE/2 lands on the curb; -z keeps it on the block whose
// north edge faces the road, so heading 0 (north, +z) drives straight out.
const PAD_X=nodeX(1)+ROAD/2+SIDE/2, PAD_Z=nodeX(5)-ROAD/2-SIDE/2; // (-123, 35)
const padY=groundHeight(PAD_X,PAD_Z);

// pad on the ground (decoration only, fixed). Scaled to fit the 4 m sidewalk band.
const pad=makeRcPad();
pad.scale.setScalar(.8);
pad.position.set(PAD_X,padY+.02,PAD_Z);
scene.add(pad);

// the RC: a dedicated TOY model (rc-rager), not a gameplay car. It is flagged
// remote:true so player.js does NOT seat the player inside it — the operator stays
// standing by the pad and pilots it from afar, exactly like the genre's classic RC missions.
// makeRcRager is ~1.2 m; at ×1.5 the footprint is ~1.8 m, which the car-cam frames well.
const RC_SCALE=1.5;
const rc=makeRcRager();
rc.scale.setScalar(RC_SCALE);
scene.add(rc); // makeRcRager is a PURE build() (no scene.add), so we add it here
const rcObj: any={g:rc,heading:0,speed:0,name:'RC RAGER',remote:true};

// grab the antenna parts to wobble them (search the built group)
let _ant: THREE.Object3D|null=null,_antTip: THREE.Object3D|null=null;
{
  // the rod is the thin CylinderGeometry and the ball is the SphereGeometry (MeshBasic)
  rc.traverse((o: any)=>{
    if(!o.isMesh)return;
    const g=o.geometry;
    if(g?.type==='CylinderGeometry'&&g.parameters?.radiusTop<.05)_ant=o;
    if(g?.type==='SphereGeometry')_antTip=o;
  });
}
const _antBaseRotZ=_ant?(_ant as THREE.Object3D).rotation.z:0;

// Return the RC to the pad. With keepIfDriving=true (round end), do NOT yank
// it out from under a still-seated player: just reset state and leave it where it
// is. With keepIfDriving=false (a fresh RC after a detonation, or arranging
// the parked one) it always teleports back to the pad, facing the road.
function parkRc(keepIfDriving=false){
  rcObj.speed=0;rcObj.heading=0;
  if(keepIfDriving&&cur===rcObj)return;
  rc.position.set(PAD_X,padY,PAD_Z);
  rc.rotation.set(0,0,0);
}
parkRc();
idleCars.push(rcObj);

// a gang car target cruising the grid (or the rare golden bonus car)
interface Target{g:THREE.Object3D;ring:THREE.Mesh|null;beacon:THREE.Mesh|null;alive:boolean;gold:boolean;moving:boolean;axis:string;dir:number;speed:number;nextNode:number;panic:number;}
// a floating power-up crate
interface Crate{g:THREE.Object3D;type:CrateType;base:number;t:number;alive:boolean;}

let active=false;
let timeLeft=0;
let destroyed=0;
let targets: Target[]=[]; // [{g, ring, beacon, alive, gold, moving, axis, dir, speed, nextNode, panic}]
let crates: Crate[]=[];  // [{g, type, base, t, alive}]
let cooldown=0; // pause between rounds (lets the result banner be read)
let _firePrev=false; // edge-detect the (held) fire button for manual detonation
let goldAlive=false; // at most one golden bonus car alive at a time
let crateCd=0;  // staggers power-up respawns

// score-attack state
let combo=0,comboT=0,bestCombo=0;
let timeFlash=0;        // brief green flash on the clock when time is earned
let nitroT=0,megaT=0;   // active power-up timers

// mini game (session): locks the world during the round; targets are the live cars
const game=new MiniGame({id:MiniGameId.RC_TOYZ,name:'RC Smash',
  blips:()=>targets.filter(t=>t.alive).map(t=>({x:t.g.position.x,z:t.g.position.z,
    icon:'target',color:t.gold?'#ffd23a':'#5eff8a',label:t.gold?'GOLD':'TARGET',current:true,reveal:false}))});

// reused scratch (zero allocation in the loop)
const _hit=new THREE.Vector3();
const _off=new THREE.Vector3();

// ---------- registries (auto-register at the top of the module) ----------
// E prompt next to the parked RC
(refs.carEnterLabels||(refs.carEnterLabels=[])).push((c: any)=>
  c===rcObj?{label:'RC',prompt:'START RC SMASH',enabled:true} as ZoneAction:null);

// radar/map blips: during the round, the live targets + power-up crates (always
// visible); outside the round, the fixed point of the RC
(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  active
    ?[
      ...targets.filter(t=>t.alive).map(t=>({x:t.g.position.x,z:t.g.position.z,
        icon:'target',color:t.gold?'#ffd23a':'#5eff8a',label:t.gold?'GOLD':'TARGET',current:true,reveal:false})),
      ...crates.filter(c=>c.alive).map(c=>({x:c.g.position.x,z:c.g.position.z,
        icon:'taxi',color:cssHex(c.type.color),label:'POWER-UP',reveal:false})),
     ]
    :[{x:rc.position.x,z:rc.position.z,icon:'taxi',color:'#ffb02e',label:'RC SMASH'}]);

// debug
refs.getRcToyzState=()=>({active,timeLeft,destroyed,combo,bestCombo,
  nitro:nitroT>0,mega:megaT>0,crates:crates.filter(c=>c.alive).length});

const aliveCount=()=>{let n=0;for(const t of targets)if(t.alive)n++;return n;};

// is there already a live target on (about) this intersection?
function occupied(x: number,z: number){
  for(const t of targets)
    if(t.alive&&Math.hypot(t.g.position.x-x,t.g.position.z-z)<8)return true;
  return false;
}

// ---------- road-cruise helpers (keep moving targets on the street grid) ----------
// Snap a world coordinate to the nearest road-centerline node value.
const snapNode=(v: number)=>nodeX(clamp(Math.round((v+HALF)/CELL),0,N));
// Car yaw for an axis-aligned heading (engine forward = (sin h, cos h)).
const axisYaw=(ax: string,dr: number)=>ax==='x'?(dr>0?Math.PI/2:-Math.PI/2):(dr>0?0:Math.PI);
function turnTo(g: THREE.Object3D,yaw: number,dt: number){ g.rotation.y+=wrapA(yaw-g.rotation.y)*Math.min(1,10*dt); }
// Aim a cruiser at the next intersection along its current axis/dir, bouncing off
// the city edge if it would drive off the grid.
function aimNextNode(t: Target){
  const on=t.axis==='x'?t.g.position.x:t.g.position.z;
  const fi=(on+HALF)/CELL;
  let ni=t.dir>0?Math.floor(fi+1e-4)+1:Math.ceil(fi-1e-4)-1;
  if(ni<0||ni>N){t.dir=-t.dir;ni=t.dir>0?Math.floor(fi+1e-4)+1:Math.ceil(fi-1e-4)-1;}
  t.nextNode=nodeX(clamp(ni,0,N));
}
// At an intersection, choose where to go next. Fleeing cars pick the turn that
// moves most directly away from the RC; otherwise they mostly go straight.
function chooseAtNode(t: Target,rp: THREE.Vector3,fleeing: boolean){
  const x=t.g.position.x,z=t.g.position.z;
  const ix=Math.round((x+HALF)/CELL),iz=Math.round((z+HALF)/CELL);
  const cands: {ax:string;dr:number;rev:boolean}[]=[];
  for(const[ax,dr]of[['x',1],['x',-1],['z',1],['z',-1]] as [string,number][]){
    if(ax==='x'){if(dr>0&&ix>=N)continue;if(dr<0&&ix<=0)continue;}
    else{if(dr>0&&iz>=N)continue;if(dr<0&&iz<=0)continue;}
    cands.push({ax,dr,rev:ax===t.axis&&dr===-t.dir});
  }
  let pool=cands.filter(c=>!c.rev);
  if(!pool.length)pool=cands; // dead-end: U-turn is the only way out
  let ch;
  if(fleeing){
    let best=pool[0],bs=-Infinity;
    for(const c of pool){
      const fx=c.ax==='x'?c.dr:0,fz=c.ax==='z'?c.dr:0;
      const away=fx*(x-rp.x)+fz*(z-rp.z); // dot with the "away from RC" vector
      if(away>bs){bs=away;best=c;}
    }
    ch=best;
  }else{
    const straight=pool.find(c=>c.ax===t.axis&&c.dr===t.dir);
    ch=(straight&&Math.random()<.6)?straight:pick(pool);
  }
  t.axis=ch.ax;t.dir=ch.dr;
  aimNextNode(t);
}
// Drive a cruising target one frame along the grid; scatter when the RC is near.
function moveTarget(t: Target,dt: number,rp: THREE.Vector3){
  const near=Math.hypot(t.g.position.x-rp.x,t.g.position.z-rp.z)<PANIC_R;
  if(near)t.panic=PANIC_TIME;else if(t.panic>0)t.panic-=dt;
  const fleeing=t.panic>0;
  const tgt=(fleeing||t.gold)?CRUISE_FAST:CRUISE_SLOW;
  t.speed+=(tgt-t.speed)*Math.min(1,3.5*dt);
  if(t.axis==='x')t.g.position.x+=t.speed*dt*t.dir;else t.g.position.z+=t.speed*dt*t.dir;
  const on=t.axis==='x'?t.g.position.x:t.g.position.z;
  if((t.dir>0&&on>=t.nextNode)||(t.dir<0&&on<=t.nextNode)){
    if(t.axis==='x')t.g.position.x=t.nextNode;else t.g.position.z=t.nextNode;
    chooseAtNode(t,rp,fleeing);
  }
  turnTo(t.g,axisYaw(t.axis,t.dir),dt);
  t.g.position.y=groundHeight(t.g.position.x,t.g.position.z);
  spinWheels(t.g,t.speed,dt,0);
}

// spawn a gang car SPAWN_MIN–SPAWN_MAX away from the player. Most cruise the streets;
// a rare one is the GOLDEN bonus car. Never stacks two on the same crossing.
function spawnTarget(){
  const pp=playerPos();
  let x=PAD_X,z=PAD_Z,tries=0;
  do{
    x=nodeX(irand(1,N-1));z=nodeX(irand(1,N-1));tries++;
    const d=Math.hypot(x-pp.x,z-pp.z);
    if(d>=SPAWN_MIN&&d<=SPAWN_MAX&&!occupied(x,z))break;
  }while(tries<40);
  const gold=!goldAlive&&Math.random()<GOLD_CHANCE;
  const g=makeCar(gold?GOLD_COLOR:gangColor,false);
  g.position.set(x,groundHeight(x,z),z);
  g.rotation.y=irand(0,3)*Math.PI/2;
  const{ring,beacon}=makeDeliveryMarker(gold?GOLD_COLOR:GREEN);
  ring.position.set(x,.4,z);
  beacon.position.set(x,30,z);
  scene.add(ring,beacon);
  const moving=gold||Math.random()<MOVE_CHANCE;
  const t: Target={g,ring,beacon,alive:true,gold,moving,axis:'x',dir:1,speed:0,nextNode:0,panic:0};
  if(moving){ // park exactly on the grid and pick a road to cruise
    g.position.x=snapNode(x);g.position.z=snapNode(z);
    ring.position.set(g.position.x,.4,g.position.z);
    beacon.position.set(g.position.x,30,g.position.z);
    t.axis=Math.random()<.5?'x':'z';t.dir=Math.random()<.5?1:-1;
    aimNextNode(t);
  }
  if(gold)goldAlive=true;
  targets.push(t);
}

// keep the streets stocked with POOL live targets (only while the round runs)
function refill(){
  while(active&&timeLeft>0&&aliveCount()<POOL)spawnTarget();
}

function clearTargets(){
  for(const t of targets){
    scene.remove(t.g);
    if(t.ring)scene.remove(t.ring,t.beacon!);
  }
  targets=[];
  goldAlive=false;
}

// ---------- power-up crates ----------
// avoid dropping two crates on the same crossing
function crateAt(x: number,z: number){
  for(const c of crates)
    if(c.alive&&Math.hypot(c.g.position.x-x,c.g.position.z-z)<10)return true;
  return false;
}
function spawnCrate(){
  const pp=playerPos();
  let x=PAD_X,z=PAD_Z,tries=0;
  do{
    x=nodeX(irand(0,N));z=nodeX(irand(0,N));tries++;
    const d=Math.hypot(x-pp.x,z-pp.z);
    if(d>=14&&d<=90&&!crateAt(x,z))break;
  }while(tries<30);
  const type=pick(CRATE_TYPES);
  const base=groundHeight(x,z)+1.3;
  const g=makeRcCrate(type.color);
  g.position.set(x,base,z);
  scene.add(g);
  crates.push({g,type,base,t:Math.random()*6,alive:true});
}
function clearCrates(){
  for(const c of crates)scene.remove(c.g);
  crates=[];
}
function collectCrate(c: Crate){
  c.alive=false;scene.remove(c.g);
  if(c.type.id==='nitro')nitroT=NITRO_TIME;
  else if(c.type.id==='mega')megaT=MEGA_TIME;
  else{timeLeft=Math.min(TIME_CAP,timeLeft+CRATE_TIME);timeFlash=.9;}
  blip([784,1047,1319],.07,'square',.18);
  state.shake=Math.max(state.shake,.18); // one-shot kick (no constant rumble)
  bigText(c.type.id==='time'?`+${CRATE_TIME}s`:c.type.label,cssHex(c.type.color));
  setTimeout(hideBig,650);
  crateCd=CRATE_RESPAWN;
}
function updateCrates(dt: number){
  const rp=rc.position;
  // backward walk so a collected crate can splice out in place (no per-frame alloc)
  for(let i=crates.length-1;i>=0;i--){
    const c=crates[i];
    c.t+=dt;
    c.g.position.y=c.base+Math.sin(c.t*2.2)*.18; // hover bob
    c.g.rotation.y+=1.4*dt;                        // slow spin
    if(c.g.userData.halo)c.g.userData.halo.rotation.z+=2.4*dt;
    if(rp.distanceTo(c.g.position)<CRATE_RANGE){collectCrate(c);crates.splice(i,1);}
  }
  if(crateCd>0)crateCd-=dt;
  if(crates.length<CRATE_POOL&&crateCd<=0){spawnCrate();crateCd=CRATE_RESPAWN;}
}

// textual round HUD: wreck counter + combo + active buffs + countdown clock. Reuses
// message() (a single line, refreshed per frame) so no new element is created.
function hudRound(){
  const left=Math.max(0,Math.ceil(timeLeft));
  // clock flashes green when time was just earned, red in the final 10 s
  const col=timeFlash>0?'#5eff8a':(left<=10?'var(--pink)':'var(--cyan)');
  let line=`RC SMASH   ${destroyed} WRECKED`;
  if(combo>=2)line+=`   COMBO x${comboMult(combo)} (${combo})`;
  const buffs=[];
  if(nitroT>0)buffs.push('NITRO');
  if(megaT>0)buffs.push('MEGA');
  if(buffs.length)line+=`   ${buffs.join(' ')}`;
  line+=`   ${left}s`;
  message(line,col);
}

function startRound(){
  // first round of the session? (begin() reuses an already-active session on
  // restarts, so capture the flag BEFORE begin() to only brief once)
  const firstRound=!game.active;
  if(!game.begin())return; // another mini-game session is running: don't start
  active=true;timeLeft=ROUND_TIME;destroyed=0;
  combo=0;comboT=0;bestCombo=0;timeFlash=0;nitroT=0;megaT=0;crateCd=0;
  rc.userData.speedMul=1;
  gangColor=GANG_COLORS[irand(0,GANG_COLORS.length-1)];
  clearTargets();clearCrates();
  for(let i=0;i<POOL;i++)spawnTarget();
  for(let i=0;i<CRATE_POOL;i++)spawnCrate();
  blip([523,659,784],.08,'square',.16);
  // Clear, short instructions on the FIRST round only (don't spam on restarts and
  // don't fight the per-frame hudRound, which owns message() during the round).
  if(firstRound){
    bigText('RAM CARS OR FIRE TO BLAST - CHAIN WRECKS, GRAB CRATES','var(--cyan)');
    setTimeout(hideBig,3600);
  }
}

// keepIfDriving=true on finish: the player stays in the RC, so we don't yank
// it to the pad; we just clear the round and breathe before the next one (to read
// the banner). Left the RC → false: tidy it back onto the pad and free the world.
function endRound(keepIfDriving=false){
  active=false;
  clearTargets();clearCrates();
  parkRc(keepIfDriving);
  nitroT=0;megaT=0;rc.userData.speedMul=1; // buffs never carry out of a round
  if(keepIfDriving){
    // still seated: KEEP the session (lock + briefing cover the whole stay in the
    // RC; otherwise the ranking would re-pop each round). Just a breath.
    cooldown=2.4;
  }else{
    cooldown=0;
    game.end(); // left the RC: release the world lock
  }
}

// Wreck one car: scores it, banks combo-scaled cash, and adds clock time. Returns
// the cash + whether it was the gold car (the caller sums these for the blast banner).
function killTarget(t: Target){
  scene.remove(t.g);
  if(t.ring)scene.remove(t.ring,t.beacon!);
  t.alive=false;t.ring=t.beacon=null;
  if(t.gold)goldAlive=false;
  destroyed++;
  combo++;comboT=COMBO_WINDOW;bestCombo=Math.max(bestCombo,combo);
  // gold is its own flat bonus (not multiplied by the combo) so a single kill can
  // never spike past the backend's per-second cap; it still advances the chain.
  const cash=t.gold?PER_KILL*GOLD_MULT:PER_KILL*comboMult(combo);
  economy.earn(cash,'rc-toyz');
  timeLeft=Math.min(TIME_CAP,timeLeft+(t.gold?GOLD_TIME:TIME_PER_KILL)); // time-attack reward
  timeFlash=.7;
  return {cash,gold:t.gold};
}

// MEGA blast: a second explosion offset from the centre so it LOOKS as big as it
// hits, without stacking so many booms that the audio turns to mush.
function bigBoom(center: THREE.Vector3){
  refs.explodeAt?.(center.clone(),{noSelf:true});
  const a=Math.random()*Math.PI*2;
  _off.set(Math.cos(a)*3.4,0,Math.sin(a)*3.4).add(center);
  refs.explodeAt?.(_off.clone(),{noSelf:true});
}

// The RC IS the bomb: it blows up where it stands, wrecking every gang car caught in
// the blast (a MEGA crate widens it). Spending the RC respawns a fresh one on the pad.
function detonate(){
  _hit.copy(rc.position);
  // noSelf: the RC sits inside its own blast; without this every kill would dent
  // and brake the very car the player is driving.
  if(megaT>0)bigBoom(_hit);else refs.explodeAt?.(_hit.clone(),{noSelf:true});
  const blast=BLAST+(megaT>0?MEGA_BONUS:0);
  let kills=0,cash=0,gold=false;
  for(const t of targets){
    if(t.alive&&_hit.distanceTo(t.g.position)<=blast){const r=killTarget(t);kills++;cash+=r.cash;gold=gold||r.gold;}
  }
  if(kills)targets=targets.filter(t=>t.alive); // drop wrecked cars so the array stays small over long rounds
  thud(megaT>0?13:10);                              // deeper, more satisfying blast
  state.shake=Math.max(state.shake,megaT>0?.34:.25);// camera kick on detonation
  parkRc(false);                                    // spend the RC: a fresh one on the pad
  cameraRig.yaw=rcObj.heading;cameraRig.touchLookIdle=1; // face the road again
  refill();                                         // keep targets coming
  if(kills){
    const co=callout(combo);
    const banner=gold?`GOLD!  +$${cash}`:(co?`${co.txt}  +$${cash}`:`+$${cash}`);
    const col=gold?'#ffd23a':(co?co.col:'var(--gold)');
    if(timeLeft>.8){bigText(banner,col);setTimeout(hideBig,720);}
    const k=1+Math.min(combo,12)*.03; // pitch climbs with the chain
    blip([392*k,523*k,659*k],.07,'square',.16);
  }else{
    blip([220,180],.06,'square',.12);  // dud: detonated with nothing in range
  }
}

function finishRound(){
  const won=destroyed>=1; // a single kill already passes
  reportMiniGameResult(game.id,{won,score:destroyed});
  if(won){
    bigText(`RC SMASH: ${destroyed} WRECKED`,'var(--gold)');
    message(`RC SMASH DONE - ${destroyed} WRECKED - BEST COMBO ${bestCombo}`,'var(--gold)');
    blip([523,659,784,1047],.09,'square',.2);
  }else{
    bigText('RC SMASH FAILED','var(--pink)');
    message('RC SMASH FAILED - NO CARS WRECKED','var(--pink)');
    blip([330,247,180],.12,'sawtooth',.18);
  }
  setTimeout(hideBig,1200);
  endRound(true);
}

// antenna wobble: sways proportional to the RC speed (toy feel)
function wobbleAntenna(dt: number){
  if(!_ant)return;
  const sp=Math.abs(rcObj.speed);
  const amp=clamp(sp*.018,0,.28);
  const w=Math.sin(state.time*14)*amp;
  _ant.rotation.z=_antBaseRotZ+w;
  if(_antTip){ // the ball follows the rod tip (rides the sway)
    _antTip.position.x=-.23+w*.5;
  }
}

export function updateRcToyz(dt: number){
  const driving=state.mode==='car'&&cur===rcObj;

  // the antenna sways whenever the RC exists (barely moves when parked)
  wobbleAntenna(dt);

  // edge-detect the (held) fire button → one manual detonation per press
  const fire=!!input.shootHeld;
  const firePressed=fire&&!_firePrev;
  _firePrev=fire;

  if(cooldown>0)cooldown-=dt; // pause between rounds: lets the banner be read

  if(!active){
    // left the RC between rounds (session still locked): end for good
    if(!driving){if(game.active)endRound();return;}
    // still in it after a round: restart — but only after the cooldown breath
    // (else the round restarts the same frame). begin() reuses the session: no new briefing.
    if(cooldown<=0)startRound();
    return;
  }
  if(!driving){endRound();return;} // left the RC mid-round: end (clears everything)

  timeLeft-=dt;
  if(timeFlash>0)timeFlash-=dt;
  if(comboT>0){comboT-=dt;if(comboT<=0)combo=0;} // chain expires: streak resets
  if(nitroT>0){nitroT-=dt;rc.userData.speedMul=NITRO_MUL;if(nitroT<=0)rc.userData.speedMul=1;}
  if(megaT>0)megaT-=dt;
  hudRound();      // wrecked count + combo + buffs + clock, every frame
  updateCrates(dt);// hover/spin power-ups and pick them up on contact

  let contact=false;
  const rp=rc.position;
  for(const t of targets){
    if(!t.alive)continue;
    if(t.moving)moveTarget(t,dt,rp); // cruise the streets / flee the RC
    if(t.ring){
      if(t.moving){ // keep the marker glued to the moving car
        t.ring.position.set(t.g.position.x,.4,t.g.position.z);
        t.beacon!.position.set(t.g.position.x,30,t.g.position.z);
      }
      t.ring.rotation.z+=2*dt;
      const sc=1+Math.sin(state.time*4)*.12;t.ring.scale.set(sc,sc,1);
    }
    if(rp.distanceTo(t.g.position)<HIT_RANGE)contact=true;
  }
  if(contact||firePressed)detonate();

  if(timeLeft<=0){finishRound();return;}
}
