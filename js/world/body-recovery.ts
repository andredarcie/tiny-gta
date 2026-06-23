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
const SPAWN_DIST=34;        // how far from the corpse the ambulance drives in from
const REACH=3.6;            // distance at which the ambulance can load the body
const LOAD_TIME=1.7;        // seconds paused loading the body
const LEAVE_TIME=3;         // seconds driving away before the ambulance despawns
const AMB_SPEED=20;         // ambulance cruise speed
const STUCK_GIVEUP=7;       // seconds stuck en route → load numerically and leave

let amb:THREE.Object3D|null=null;
let mode:'idle'|'enroute'|'loading'|'leaving'='idle';
let target:Ped|null=null;
let heading=0;
let modeT=0;       // time in the current mode
let bestDist=1e9;  // closest the ambulance has gotten to the target (stuck detection)
let stuckT=0;

const _v=new THREE.Vector3();

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
}

function retire(){
  if(amb&&amb.parent)scene.remove(amb);
  mode='idle';target=null;modeT=0;stuckT=0;bestDist=1e9;
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

  // target gone (revived, or already collected some other way)? stand down.
  if(!amb||!target||!isCorpse(target)){retire();return;}
  // player walked away from the active job → let the numeric path take it.
  const tdx=target.g.position.x-pp.x,tdz=target.g.position.z-pp.z;
  if(tdx*tdx+tdz*tdz>VISUAL_RANGE2){retire();return;}

  modeT+=dt;
  const ap=amb.position,tp=target.g.position;
  const dist=Math.hypot(tp.x-ap.x,tp.z-ap.z);

  if(mode==='enroute'){
    // steer toward the body, slide around buildings; load when close enough
    const desired=Math.atan2(tp.x-ap.x,tp.z-ap.z),diff=wrapA(desired-heading);
    heading+=clamp(diff,-1,1)*2.4*dt;
    ap.x+=Math.sin(heading)*AMB_SPEED*dt;
    ap.z+=Math.cos(heading)*AMB_SPEED*dt;
    if(collideStatics(ap,1.6))stuckT+=dt;
    ap.y=groundHeight(ap.x,ap.z);
    amb.rotation.y=heading;
    if(dist<bestDist-.5){bestDist=dist;stuckT=Math.max(0,stuckT-dt);}else stuckT+=dt;
    if(dist<REACH){mode='loading';modeT=0;}
    else if(stuckT>STUCK_GIVEUP){sendToHospital(target);retire();} // can't reach: numeric
    return;
  }
  if(mode==='loading'){
    if(modeT>=LOAD_TIME){sendToHospital(target);target=null;mode='leaving';modeT=0;}
    return;
  }
  // leaving: drive straight on for a bit, then despawn
  ap.x+=Math.sin(heading)*AMB_SPEED*dt;
  ap.z+=Math.cos(heading)*AMB_SPEED*dt;
  collideStatics(ap,1.6);
  ap.y=groundHeight(ap.x,ap.z);
  if(modeT>=LEAVE_TIME)retire();
}
