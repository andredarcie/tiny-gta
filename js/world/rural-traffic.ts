import * as THREE from 'three';
import {ruralRoadPath,groundHeight,clamp,wrapA,pick,rand,irand,SWIM_BOUND} from '@/core/constants.js';
import {state,carNames,carColors} from '@/core/state.js';
import {makeCar,spinWheels,dentCar,seatDriver,shirtColors} from '@/core/entities.js';
import {collideStatics,addWanted} from '@/core/physics.js';
import {thud} from '@/audio/audio.js';
import {playerPos,cur,player,getWasted} from '@/actors/player.js';

// A straight arc-length segment of the country road polyline.
interface RoadSeg{ax:number;az:number;dx:number;dz:number;len:number;}
// A laned road sample (position + travel direction).
interface RoadSample{x:number;z:number;tx:number;tz:number;}
// A country-traffic car wrapper.
interface RuralCar{
  g:THREE.Object3D;
  u:number;
  dir:number;
  speed:number;
  heading:number;
  name:string;
  brakeT:number;
  stuckT:number;
  driver?:THREE.Object3D;
}

// Country traffic: a HANDFUL of cars cruising the dirt road that links the city to
// Pine Hollow (out of town, around the mountain by the north arc, into the village).
// Far fewer than the city grid (5 vs ~14) to keep the countryside quiet. Unlike the
// grid traffic (which hops node-to-node on the street lattice) these follow the same
// single-source road polyline used by the ground texture and the radar — so the cars
// sit exactly on the drawn road. They drive in lanes, brake for the player and each
// other, and reseat onto the terrain height every frame (the peninsula is nearly
// flat, but the helper keeps them grounded over the corridor hummocks).
export const ruralTraffic:RuralCar[]=[];

const COUNT=5;            // fewer than the city
const CRUISE=6.5;         // slower, easy country pace (city cruises 8.5)
const LANE=2.2;           // lateral offset from the road centerline (keep-right)
const CAR_CULL2=180*180;  // LOD: rural car beyond this isn't drawn/animated
const _push=new THREE.Vector3();
const _mid=new THREE.Vector3();

// Build the road as arc-length segments ONCE. Drop duplicate points (ruralRoadPath
// repeats a vertex where the straight meets the arc) so no leg has zero length.
const PATH:RoadSeg[]=(()=>{
  const raw=ruralRoadPath(),pts:[number,number][]=[];
  for(const p of raw){
    const last=pts[pts.length-1];
    if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>.5)pts.push(p);
  }
  const segs:RoadSeg[]=[];
  for(let i=0;i<pts.length-1;i++){
    const a=pts[i],b=pts[i+1];
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1e-3;
    segs.push({ax:a[0],az:a[1],dx:dx/len,dz:dz/len,len});
  }
  return segs;
})();
const LAST=PATH.length-1;
// cumulative arc length, so a single coordinate `u` ∈ [U_MIN,TOTAL] locates a car
const CUM:number[]=[0];
for(const s of PATH)CUM.push(CUM[CUM.length-1]+s.len);
const TOTAL=CUM[CUM.length-1];
// Keep country cars EAST of the off-road race circuit (which lives at x<=320, |z|<=84
// and is intentionally kept clear of obstacles — see offroad.js). U_MIN is the road
// distance at the farm-hamlet edge (~x 340); cars turn around there instead of
// driving the quiet approach straight back to the city, so the race pasture stays
// empty. Everything they roam (fields, mountain bypass, Pine Hollow) is east of it.
const EAST_GUARD=340;
let U_MIN=0;
for(let i=0;i<=LAST;i++){if(PATH[i].ax>=EAST_GUARD){U_MIN=CUM[i];break;}}

// map u -> segment index (linear scan; ~45 segments × 5 cars = negligible)
function locate(u:number):number{let i=0;while(i<LAST&&u>CUM[i+1])i++;return i;}

// sample the laned road position + travel direction at coordinate `u` going `dir`.
// keep-right: offset to the right of travel is (tz,-tx); a car going the other way
// has a reversed travel dir, so it naturally rides the opposite side of the road.
const _smp:RoadSample={x:0,z:0,tx:0,tz:0};
function sample(u:number,dir:number,out:RoadSample=_smp):RoadSample{
  const i=locate(u),g=PATH[i],s=u-CUM[i];
  const tx=g.dx*dir,tz=g.dz*dir;
  out.x=g.ax+g.dx*s+tz*LANE;out.z=g.az+g.dz*s-tx*LANE;out.tx=tx;out.tz=tz;
  return out;
}

function spawnRuralCar(){
  const ci=irand(0,carColors.length-1);
  const t:RuralCar={g:makeCar(carColors[ci],false),u:rand(U_MIN,TOTAL),dir:Math.random()<.5?1:-1,
    speed:CRUISE,heading:0,name:carNames[ci],brakeT:0,stuckT:0};
  t.driver=seatDriver(t.g,pick(shirtColors));
  const s=sample(t.u,t.dir);
  t.g.position.set(s.x,groundHeight(s.x,s.z),s.z);
  t.heading=Math.atan2(s.tx,s.tz);t.g.rotation.y=t.heading;
  ruralTraffic.push(t);
}
for(let k=0;k<COUNT;k++)spawnRuralCar();

export function updateRuralTraffic(dt:number){
  const pp=playerPos();
  const activeCur=cur;
  for(const t of ruralTraffic){
    const s0=sample(t.u,t.dir);
    // brake for the player (or their car) sitting on the road just ahead
    const ax=s0.x+s0.tx*5,az=s0.z+s0.tz*5;
    let blocked=Math.hypot(ax-pp.x,az-pp.z)<3.8;
    // brake for another country car ahead in my lane (narrow forward cone, no sqrt)
    if(!blocked)for(const o of ruralTraffic){
      if(o===t)continue;
      const rx=o.g.position.x-s0.x,rz=o.g.position.z-s0.z;
      const fwd=rx*s0.tx+rz*s0.tz;
      if(fwd<=.5||fwd>6.5)continue;
      if(Math.abs(rx*s0.tz-rz*s0.tx)<1.8){blocked=true;break;}
    }
    if(t.brakeT>0){t.brakeT-=dt;blocked=true;}
    // anti-stuck: if pinned too long, ignore the block briefly to unjam (same trick
    // as the city traffic) — single-lane country road rarely deadlocks, but a U-turn
    // meeting an oncoming car could otherwise lock.
    if(blocked){
      t.stuckT=(t.stuckT||0)+dt;
      if(t.stuckT>2.5)t.stuckT=0;else if(t.stuckT>2)blocked=false;
    }else t.stuckT=0;

    const target=blocked?0:CRUISE;
    t.speed+=(target-t.speed)*4*dt;
    t.u+=t.speed*dt*t.dir;
    // dead ends: reflect off both ends of the road (the car turns around). The lane
    // side swaps at the turn — a small lateral hop, but it only happens at the far
    // tips of the road (town / city edge), which are usually past the cull radius.
    if(t.u>TOTAL){t.u=2*TOTAL-t.u;t.dir=-1;}
    else if(t.u<U_MIN){t.u=2*U_MIN-t.u;t.dir=1;}

    const s1=sample(t.u,t.dir);
    t.g.position.set(s1.x,0,s1.z);
    collideStatics(t.g.position,1.1,SWIM_BOUND); // swerve around roadside props (the village well / market stalls hug the road)
    t.g.position.y=groundHeight(t.g.position.x,t.g.position.z);
    const dh=wrapA(Math.atan2(s1.tx,s1.tz)-t.heading);
    t.heading+=dh*Math.min(1,10*dt);
    t.g.rotation.y=t.heading;

    const cdx=t.g.position.x-pp.x,cdz=t.g.position.z-pp.z;
    if(cdx*cdx+cdz*cdz>=CAR_CULL2){t.g.visible=false;continue;}
    t.g.visible=true;
    spinWheels(t.g,t.speed,dt,clamp(dh*2,-1,1));

    // player interaction: ram with the player's car (push + dent + heat) or run the
    // player over on foot — same feel as the city traffic.
    if(state.mode==='car'&&activeCur){
      const d=t.g.position.distanceTo(activeCur.g.position);
      if(d<2.9){
        const push=_push.subVectors(t.g.position,activeCur.g.position).setY(0).normalize();
        activeCur.g.position.addScaledVector(push,-(2.9-d)*.6);
        if(Math.abs(activeCur.speed)>8){
          addWanted(.25,null as unknown as string,'pursuit');thud(Math.abs(activeCur.speed));state.shake=.3;
          const mid=_mid.addVectors(t.g.position,activeCur.g.position).multiplyScalar(.5).setY(.7);
          dentCar(activeCur.g,mid,push.clone().negate(),.2);
          dentCar(t.g,mid,push,.2);
        }
        activeCur.speed*=.6;t.brakeT=2;
      }
    }else if(state.mode==='foot'&&t.speed>5){
      if(t.g.position.distanceTo(player.g.position)<1.5)getWasted();
    }
  }
}
