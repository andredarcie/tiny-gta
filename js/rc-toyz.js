import * as THREE from 'three';
import {state,input,refs} from './state.js';
import {economy} from './economy.js';
import {scene} from './engine.js';
import {playerPos,cur,idleCars,cameraRig} from './player.js';
import {message,bigText,hideBig} from './hud.js';
import {blip,thud} from './audio.js';
import {N,nodeX,ROAD,SIDE,irand,clamp,groundHeight} from './constants.js';
import {makeCar} from './entities.js';
import {makeDeliveryMarker} from '../assets/models/missions/delivery-marker.js';
import {makeRcRager} from '../assets/models/vehicles/rc-rager.js';
import {makeRcPad} from '../assets/models/props/rc-pad.js';
import {MiniGame,MiniGameId} from './minigame.js';
import {reportMiniGameResult} from './minigame-leaderboard.js';

// RC SMASH — a remote-control demolition mini-game: you drive a tiny RC car that is
// a MOBILE BOMB. Ram a gang car's wheels (or press fire to detonate) and the RC
// blows up, destroying the car. Each detonation SPENDS the RC, so a fresh one
// instantly respawns on the pad. You have 2 MINUTES to wreck as many gang cars as
// you can — there is no fixed quota: a single kill already passes, and the score is
// simply how many you destroy. Cash is paid per car. Leaving the RC ends the
// session; it returns to the pad to replay.

const RC_BUILD=' ◆ RC SMASH';
document.getElementById('buildver')?.insertAdjacentText('beforeend',RC_BUILD);

const GREEN=0x5eff8a;
const ROUND_TIME=120;  // 2 minutes, counts straight down, no time bonuses
const POOL=5;          // gang cars roaming at once (refilled as they are destroyed)
const HIT_RANGE=2.2;   // RC→car distance that auto-detonates on contact (RC is tiny)
const BLAST=5;         // blast radius (matches weapons.blastDamage) — a cluster chains
const PER_KILL=100;    // cash per wrecked car (below car-crusher's ~$190: the chain
                       // blast wrecks several fast, so per-kill pays less to compensate)
const SPAWN_MIN=18, SPAWN_MAX=72; // target spawn distance from the player/pad

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
const rcObj={g:rc,heading:0,speed:0,name:'RC RAGER',remote:true};

// grab the antenna parts to wobble them (search the built group)
let _ant=null,_antTip=null;
{
  // the rod is the thin CylinderGeometry and the ball is the SphereGeometry (MeshBasic)
  rc.traverse(o=>{
    if(!o.isMesh)return;
    const g=o.geometry;
    if(g?.type==='CylinderGeometry'&&g.parameters?.radiusTop<.05)_ant=o;
    if(g?.type==='SphereGeometry')_antTip=o;
  });
}
const _antBaseRotZ=_ant?_ant.rotation.z:0;

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

let active=false;
let timeLeft=0;
let destroyed=0;
let targets=[]; // [{g, ring, beacon, alive}]
let cooldown=0; // pause between rounds (lets the result banner be read)
let _firePrev=false; // edge-detect the (held) fire button for manual detonation

// mini game (session): locks the world during the round; targets are the live cars
const game=new MiniGame({id:MiniGameId.RC_TOYZ,name:'RC Smash',
  blips:()=>targets.filter(t=>t.alive).map(t=>({x:t.g.position.x,z:t.g.position.z,
    icon:'target',color:'#5eff8a',label:'TARGET',current:true,reveal:false}))});

// reused scratch (zero allocation in the loop)
const _hit=new THREE.Vector3();

// ---------- registries (auto-register at the top of the module) ----------
// E prompt next to the parked RC
(refs.carEnterLabels||(refs.carEnterLabels=[])).push(c=>
  c===rcObj?{label:'RC',prompt:'START RC SMASH',enabled:true}:null);

// radar/map blips: during the round, the live targets (always visible);
// outside the round, the fixed point of the RC
(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  active
    ?targets.filter(t=>t.alive).map(t=>({x:t.g.position.x,z:t.g.position.z,
        icon:'target',color:'#5eff8a',label:'TARGET',current:true,reveal:false}))
    :[{x:rc.position.x,z:rc.position.z,icon:'taxi',color:'#ffb02e',label:'RC SMASH'}]);

// debug
refs.getRcToyzState=()=>({active,timeLeft,destroyed});

const aliveCount=()=>{let n=0;for(const t of targets)if(t.alive)n++;return n;};

// is there already a live target on (about) this intersection?
function occupied(x,z){
  for(const t of targets)
    if(t.alive&&Math.hypot(t.g.position.x-x,t.g.position.z-z)<8)return true;
  return false;
}

// spawn a gang car on an intersection SPAWN_MIN–SPAWN_MAX away from the player,
// never stacking two on the same crossing (intersections are CELL=44 m apart, so
// the <8 m guard only rejects a spot already taken by another live target).
function spawnTarget(){
  const pp=playerPos();
  let x=PAD_X,z=PAD_Z,tries=0;
  do{
    x=nodeX(irand(1,N-1));z=nodeX(irand(1,N-1));tries++;
    const d=Math.hypot(x-pp.x,z-pp.z);
    if(d>=SPAWN_MIN&&d<=SPAWN_MAX&&!occupied(x,z))break;
  }while(tries<40);
  const g=makeCar(gangColor,false);
  g.position.set(x,groundHeight(x,z),z);
  g.rotation.y=irand(0,3)*Math.PI/2;
  const{ring,beacon}=makeDeliveryMarker(GREEN);
  ring.position.set(x,.4,z);
  beacon.position.set(x,30,z);
  scene.add(ring,beacon);
  targets.push({g,ring,beacon,alive:true});
}

// keep the streets stocked with POOL live targets (only while the round runs)
function refill(){
  while(active&&timeLeft>0&&aliveCount()<POOL)spawnTarget();
}

function clearTargets(){
  for(const t of targets){
    scene.remove(t.g);
    if(t.ring)scene.remove(t.ring,t.beacon);
  }
  targets=[];
}

// textual round HUD: wreck counter + countdown clock. Reuses message() (a single
// line, refreshed per frame) so no new element is created.
function hudRound(){
  const left=Math.max(0,Math.ceil(timeLeft));
  // last 10 s turn red for urgency
  const col=left<=10?'var(--pink)':'var(--cyan)';
  message(`RC SMASH   ${destroyed} WRECKED   ${left}s`,col);
}

function startRound(){
  // first round of the session? (begin() reuses an already-active session on
  // restarts, so capture the flag BEFORE begin() to only brief once)
  const firstRound=!game.active;
  if(!game.begin())return; // another mini-game session is running: don't start
  active=true;timeLeft=ROUND_TIME;destroyed=0;
  gangColor=GANG_COLORS[irand(0,GANG_COLORS.length-1)];
  clearTargets();
  for(let i=0;i<POOL;i++)spawnTarget();
  blip([523,659,784],.08,'square',.16);
  // Clear, short instructions on the FIRST round only (don't spam on restarts and
  // don't fight the per-frame hudRound, which owns message() during the round).
  // The RC is a remote-piloted mobile bomb: people don't know to detonate it.
  if(firstRound){
    bigText('PILOT THE RC: RAM A CAR OR PRESS FIRE TO BLOW IT UP','var(--cyan)');
    setTimeout(hideBig,3200);
  }
}

// keepIfDriving=true on finish: the player stays in the RC, so we don't yank
// it to the pad; we just clear the round and breathe before the next one (to read
// the banner). Left the RC → false: tidy it back onto the pad and free the world.
function endRound(keepIfDriving=false){
  active=false;
  clearTargets();
  parkRc(keepIfDriving);
  if(keepIfDriving){
    // still seated: KEEP the session (lock + briefing cover the whole stay in the
    // RC; otherwise the ranking would re-pop each round). Just a breath.
    cooldown=2.4;
  }else{
    cooldown=0;
    game.end(); // left the RC: release the world lock
  }
}

function killTarget(t){
  scene.remove(t.g);
  if(t.ring)scene.remove(t.ring,t.beacon);
  t.alive=false;t.ring=t.beacon=null;
  destroyed++;
  economy.earn(PER_KILL,'rc-toyz');
}

// The RC IS the bomb: it blows up where it stands, wrecking every gang car
// caught in the blast (so a tight cluster chains). Spending the RC respawns a
// fresh one on the pad — exactly like the classics. Triggered by contact or by fire.
function detonate(){
  _hit.copy(rc.position);
  // noSelf: the RC sits inside its own blast; without this every kill would dent
  // and brake the very car the player is driving.
  refs.explodeAt?.(_hit.clone(),{noSelf:true});
  let kills=0;
  for(const t of targets){
    if(t.alive&&_hit.distanceTo(t.g.position)<=BLAST){killTarget(t);kills++;}
  }
  thud(10);                              // deeper, more satisfying blast
  state.shake=Math.max(state.shake,.25); // camera kick on detonation
  parkRc(false);                         // spend the RC: a fresh one on the pad
  cameraRig.yaw=rcObj.heading;cameraRig.touchLookIdle=1; // face the road again
  refill();                              // keep targets coming
  if(kills){
    blip([392,523,659],.07,'square',.16);
    // running tally in the center; skip near time-out so it won't fight the result banner
    if(timeLeft>.8){bigText(`${destroyed} CAR${destroyed>1?'S':''}`,'var(--gold)');setTimeout(hideBig,650);}
  }else{
    blip([220,180],.06,'square',.12);    // dud: detonated with nothing in range
  }
}

function finishRound(){
  const won=destroyed>=1; // a single kill already passes
  reportMiniGameResult(game.id,{won,score:destroyed});
  if(won){
    bigText(`RC SMASH: ${destroyed} CAR${destroyed>1?'S':''}`,'var(--gold)');
    message(`RC SMASH DONE - ${destroyed} WRECKED`,'var(--gold)');
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
function wobbleAntenna(dt){
  if(!_ant)return;
  const sp=Math.abs(rcObj.speed);
  const amp=clamp(sp*.018,0,.28);
  const w=Math.sin(state.time*14)*amp;
  _ant.rotation.z=_antBaseRotZ+w;
  if(_antTip){ // the ball follows the rod tip (rides the sway)
    _antTip.position.x=-.23+w*.5;
  }
}

export function updateRcToyz(dt){
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
  hudRound(); // wrecked count + clock on screen every frame during the round

  let contact=false;
  const rp=rc.position;
  for(const t of targets){
    if(!t.alive)continue;
    // pulsing/spinning marker for feedback
    if(t.ring){
      t.ring.rotation.z+=2*dt;
      const sc=1+Math.sin(state.time*4)*.12;t.ring.scale.set(sc,sc,1);
    }
    if(rp.distanceTo(t.g.position)<HIT_RANGE)contact=true;
  }
  if(contact||firePressed)detonate();

  if(timeLeft<=0){finishRound();return;}
}
