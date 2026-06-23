import * as THREE from 'three';
import {scene} from '@/core/engine.ts';
import {groundHeight,clamp,wrapA} from '@/core/constants.ts';
import {collideStatics} from '@/core/physics.ts';
import {playerPos} from '@/actors/player.ts';
import {makeAmbulance} from '../../assets/models/vehicles/ambulance.ts';
import {peds,HOSPITAL_TIME,type Ped} from '@/world/pedestrians.ts';

// ============================================================================
// AMBULANCE BODY RECOVERY. When a city pedestrian is killed its body now LIES on
// the street as a corpse (pedestrians.ts no longer fades it). This service collects
// the corpse and "takes it to the hospital" (sets the ped's hospitalT, after which
// the existing flow revives it in its neighbourhood):
//   • NEAR the player  → a real ambulance drives up, pauses to load, then leaves.
//   • FAR from the player (out of view) → the pickup happens NUMERICALLY only: the
//     body is hidden and, after a short delay, sent to the hospital with no vehicle.
// One ambulance handles the nearest visible corpse at a time; everything else far
// away is reconciled in numbers, so the city always clears its dead either way.
// ============================================================================

const VISUAL_RANGE=110;     // corpses within this of the player get the ambulance visual
const VISUAL_RANGE2=VISUAL_RANGE*VISUAL_RANGE;
const FAR_PICKUP_DELAY=6;   // seconds before a far/off-screen body is recovered numerically
const SPAWN_DIST=82;        // it comes in from FAR down the street (was 34)
const REACH=5;              // stops a little short of the body, then loads it
const LOAD_TIME=5.2;        // STOP and wait this long, THEN pick the body up (was 1.7)
const LEAVE_OFF2=(VISUAL_RANGE+28)*(VISUAL_RANGE+28); // drive away until this far from the player
const LEAVE_MAX=15;         // hard cap so it always despawns even if the player follows
const AMB_TOP=17;           // cruise speed
const ACCEL=2.4;            // how briskly it speeds up
const BRAKE=4.5;            // how briskly it slows / stops
const STUCK_GIVEUP=12;      // seconds stuck en route → load numerically and leave

let amb:THREE.Object3D|null=null;
let mode:'idle'|'enroute'|'loading'|'leaving'='idle';
let target:Ped|null=null;
let heading=0;
let speed=0;       // current speed, eased for smooth approach/stop/depart
let modeT=0;       // time in the current mode
let bestDist=1e9;  // closest the ambulance has gotten to the target (stuck detection)
let stuckT=0;

// A body that has come to rest and not yet been collected.
function isCorpse(p:Ped):boolean{return p.dead&&p.grounded&&p.hospitalT<=0;}

// Hand a body to the hospital: the ped vanishes from the street and its existing
// hospitalT countdown (pedestrians.ts) later revives it back home.
function sendToHospital(p:Ped){
  p.hospitalT=HOSPITAL_TIME;
  p.g.visible=false;
}

function placeAmbulance(c:THREE.Vector3){
  if(!amb){amb=makeAmbulance();}
  if(!amb.parent)scene.add(amb);
  // drive in from the player's side of the body so it's seen arriving
  const pp=playerPos();
  let ax=c.x-pp.x,az=c.z-pp.z;const m=Math.hypot(ax,az)||1;ax/=m;az/=m;
  const sx=c.x+ax*SPAWN_DIST,sz=c.z+az*SPAWN_DIST;
  amb.position.set(sx,groundHeight(sx,sz),sz);
  heading=Math.atan2(c.x-sx,c.z-sz);
  amb.rotation.set(0,heading,0);
  speed=0;
}

function retire(){
  if(amb&&amb.parent)scene.remove(amb);
  mode='idle';target=null;modeT=0;stuckT=0;bestDist=1e9;speed=0;
}

// Ease the speed toward a target, drive forward by it (sliding around buildings),
// and keep the wheels on the ground. Shared by the approach and the departure.
function driveForward(ap:THREE.Vector3,targetSpeed:number,dt:number){
  const rate=targetSpeed>speed?ACCEL:BRAKE;
  speed+=(targetSpeed-speed)*Math.min(1,rate*dt);
  ap.x+=Math.sin(heading)*speed*dt;
  ap.z+=Math.cos(heading)*speed*dt;
  collideStatics(ap,1.6);
  ap.y=groundHeight(ap.x,ap.z);
  if(amb)amb.rotation.y=heading;
}

export function updateBodyRecovery(dt:number){
  const pp=playerPos();

  // ---- 1) numeric recovery of FAR / off-screen corpses ----------------------
  for(const p of peds){
    if(!isCorpse(p)||p===target)continue;
    const dx=p.g.position.x-pp.x,dz=p.g.position.z-pp.z;
    if(dx*dx+dz*dz>VISUAL_RANGE2){
      p.g.visible=false;                    // out of view: no body shown
      if(p.deadT>FAR_PICKUP_DELAY)sendToHospital(p);
    }else{
      p.g.visible=true;                     // near: the body stays on the street
    }
  }

  // ---- 2) the visual ambulance, one corpse at a time ------------------------
  if(mode==='idle'){
    let best:Ped|null=null,bd=VISUAL_RANGE2;
    for(const p of peds){
      if(!isCorpse(p))continue;
      const dx=p.g.position.x-pp.x,dz=p.g.position.z-pp.z,d2=dx*dx+dz*dz;
      if(d2<bd){bd=d2;best=p;}
    }
    if(best){target=best;placeAmbulance(best.g.position);mode='enroute';modeT=0;bestDist=1e9;stuckT=0;}
    return;
  }

  if(!amb){mode='idle';return;}
  modeT+=dt;
  const ap=amb.position;

  // LEAVING: the body is already loaded (no target anymore). Accelerate back up and
  // drive off down the street until it's well out of view (or a hard time cap), then
  // despawn — no abrupt vanish near the player. Handled BEFORE the target checks.
  if(mode==='leaving'){
    driveForward(ap,AMB_TOP,dt);
    const lx=ap.x-pp.x,lz=ap.z-pp.z;
    if(lx*lx+lz*lz>LEAVE_OFF2||modeT>=LEAVE_MAX)retire();
    return;
  }

  // enroute / loading still need their body: target gone (revived) or the player
  // walked off → stand down and let the numeric path handle it.
  if(!target||!isCorpse(target)){retire();return;}
  const tdx=target.g.position.x-pp.x,tdz=target.g.position.z-pp.z;
  if(tdx*tdx+tdz*tdz>VISUAL_RANGE2){retire();return;}
  const tp=target.g.position;
  const dist=Math.hypot(tp.x-ap.x,tp.z-ap.z);

  if(mode==='enroute'){
    // steer toward the body and ease the speed down as it nears, so it rolls up and
    // brakes to a smooth stop a little short of the body (no snapping to a halt).
    const desired=Math.atan2(tp.x-ap.x,tp.z-ap.z),diff=wrapA(desired-heading);
    heading+=clamp(diff,-1,1)*2.4*dt;
    const approach=Math.min(AMB_TOP,Math.max(0,(dist-REACH))*1.4); // slows toward REACH
    driveForward(ap,approach,dt);
    if(dist<bestDist-.5){bestDist=dist;stuckT=Math.max(0,stuckT-dt);}else stuckT+=dt;
    if(dist<REACH){mode='loading';modeT=0;speed=0;} // arrived: stop, then wait
    else if(stuckT>STUCK_GIVEUP){sendToHospital(target);retire();} // can't reach: numeric
    return;
  }
  // loading: STOPPED at the body. Sit still and wait; only at the END of the wait does
  // the crew actually load the body (it vanishes → hospital). Then pull away.
  driveForward(ap,0,dt); // hold the brake (eases any residual speed to 0)
  if(modeT>=LOAD_TIME){sendToHospital(target);target=null;mode='leaving';modeT=0;speed=0;}
}
