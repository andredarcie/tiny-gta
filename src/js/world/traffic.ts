import * as THREE from 'three';
import {pick,irand,wrapA,clamp,groundHeight} from '@/core/constants.ts';
import {poseOnGround,chassisOf} from '@/actors/vehicle-ground.ts';
import {state,carNames,carColors} from '@/core/state.ts';
import {PLAYER_DAMAGE_TAKEN} from '@/core/difficulty.ts';
import {makeCar,makeKombi,makeFiatUno,makeHilux,spinWheels,dentCar,seatDriver,shirtColors} from '@/core/entities.ts';
import {addWanted} from '@/core/physics.ts';
import {thud} from '@/audio/audio.ts';
import {playerPos,cur,player,getWasted} from '@/actors/player.ts';
import {LaneRunner,randomRoadPoint,edges,laneOff,type RoadPos,type NavEdge} from '@/world/divinolandia/nav.ts';

// ============================================================================
// Town traffic — cars driving Divinolândia's real streets (world/divinolandia/nav.ts).
// Each car rides a LaneRunner: its lane polyline is strung edge after edge, turning at
// random at every junction, keeping to the right-hand lane with rounded corners. The
// town has ~60 km of streets, far more than a handful of cars could fill, so the pool
// is recycled around the player: a car that ends up far away respawns on a street in a
// ring around them, out of sight, and drives back into the action.
// ============================================================================

// A town-traffic car wrapper (shares the Vehicle shape the player steals: g/heading/name).
interface TrafficCar{
  g:THREE.Object3D;
  run:LaneRunner;
  speed:number;
  brakeT:number;
  name:string;
  heading:number;
  driver?:THREE.Object3D;
  stuckT?:number;
  hitT?:number;
}

export const traffic:TrafficCar[]=[];
const POOL=16;                    // cars alive at once (each ~25 draws: the main cost; far ones are culled)
const CAR_CULL2=140*140;          // drawn within this radius
const RECYCLE_R=300;              // farther than this from the player → respawn nearer
const SPAWN_MIN=145,SPAWN_MAX=260;// respawn ring: just beyond the draw radius, so cars drive into view
const _push=new THREE.Vector3();
const _mid=new THREE.Vector3();
const _p:RoadPos={x:0,z:0,dx:0,dz:0};

// streets cars drive: paved, or the long dirt roads between the farms (not the short
// service stubs into yards)
export const carRoad=(e:NavEdge):boolean=>e.paved?e.kind!=='service'||e.len>30:e.len>60;
// cruising speed by street class (m/s)
const cruise=(e:NavEdge):number=>e.kind==='primary'||e.kind==='secondary'?12:e.paved?9:7;

// Body variety: mostly the regular sedan, plus the two Brazilian classics — a white
// VW Kombi van and a boxy Fiat Uno (random colour) — and the farmers' Hilux pickup. All
// ride the SAME car rig, so they drive, brake, dent, get stolen and seat a driver exactly
// the same way (the Hilux on its own longer chassis).
// Hilux paints: silver (the most common, so listed twice), black, white
const HILUX_COLORS=[0xaeb2b5,0xaeb2b5,0x1c1e21,0xeceae4];
function pickTrafficBody():{g:THREE.Object3D;name:string}{
  const r=Math.random();
  if(r<.16)return{g:makeKombi(),name:'KOMBI'};
  if(r<.4){const ci=irand(0,carColors.length-1);return{g:makeFiatUno(carColors[ci]),name:'UNO MILLE'};}
  if(r<.5)return{g:makeHilux(pick(HILUX_COLORS)),name:'HILUX'};
  const ci=irand(0,carColors.length-1);
  return{g:makeCar(carColors[ci],false),name:carNames[ci]};
}

function runnerNear(minD:number,maxD:number):LaneRunner{
  const pp=playerPos();
  const sp=randomRoadPoint({f:carRoad,near:{x:pp.x,z:pp.z},min:minD,max:maxD});
  const dir:1|-1=Math.random()<.5?1:-1;
  return new LaneRunner(sp.e,dir,dir>0?sp.s:edges[sp.e].len-sp.s,{off:laneOff,f:carRoad,round:7});
}

export function spawnTraffic(){
  const body=pickTrafficBody();
  const run=runnerNear(60,SPAWN_MAX);
  const p=run.at(0,_p);
  const t:TrafficCar={g:body.g,run,speed:6,brakeT:0,name:body.name,heading:Math.atan2(p.dx,p.dz)};
  t.g.rotation.order='YXZ'; // yaw, then pitch with the slope, then roll
  t.g.position.set(p.x,groundHeight(p.x,p.z),p.z);
  t.driver=seatDriver(t.g,pick(shirtColors));
  traffic.push(t);
}

// The car's lane position (stealing it: player.ts reads the heading it was driving at).
export function trafficPos(t:{run?:LaneRunner}):RoadPos{
  return t.run?t.run.at(0,_p):_p;
}

for(let k=0;k<POOL;k++)spawnTraffic();

export function updateTraffic(dt:number){
  const pp=playerPos();
  for(const t of traffic){
    // far from the player: drop it back onto a street in the ring around them
    const fdx=t.g.position.x-pp.x,fdz=t.g.position.z-pp.z;
    if(fdx*fdx+fdz*fdz>RECYCLE_R*RECYCLE_R){
      t.run=runnerNear(SPAWN_MIN,SPAWN_MAX);t.speed=6;t.brakeT=0;t.stuckT=0;
      const s=t.run.at(0,_p);t.heading=Math.atan2(s.dx,s.dz);
      t.g.position.set(s.x,groundHeight(s.x,s.z),s.z);
    }
    const pos=t.run.at(0,_p);
    const px=pos.x,pz=pos.z,dx=pos.dx,dz=pos.dz;
    if(t.hitT&&t.hitT>0)t.hitT-=dt; // cooldown between car-vs-pedestrian hits
    // Brake for the player / the player's car a few metres ahead.
    const ax=px+dx*5,az=pz+dz*5;
    let blocked=Math.hypot(ax-pp.x,az-pp.z)<3.8;
    // Brake for another car only when it is AHEAD and in MY lane (narrow cone). An
    // omnidirectional check deadlocked 4-way junctions forever.
    if(!blocked)for(const o of traffic){
      if(o===t)continue;
      const rx=o.g.position.x-px,rz=o.g.position.z-pz;
      const fwd=rx*dx+rz*dz;
      if(fwd<=.5||fwd>7)continue;
      if(Math.abs(rx*dz-rz*dx)<2){blocked=true;break;}
    }
    if(t.brakeT>0){t.brakeT-=dt;blocked=true;}
    // Anti-deadlock: stopped too long → ignore the block for ~0.5 s to untangle.
    if(blocked){
      t.stuckT=(t.stuckT||0)+dt;
      if(t.stuckT>2.5)t.stuckT=0;
      else if(t.stuckT>2)blocked=false;
    }else t.stuckT=0;
    // slow down into bends (corners and the winding hill roads)
    const bend=t.run.bend(14);
    const E=edges[t.run.e];
    const target=blocked?0:Math.min(cruise(E),bend>.12?5:bend>.04?7.5:99);
    t.speed+=(target-t.speed)*(target<t.speed?5:2.5)*dt;
    t.run.advance(Math.max(0,t.speed)*dt);
    const np=t.run.at(0,_p);
    const want=Math.atan2(np.dx,np.dz);
    const dh=wrapA(want-t.heading);
    t.heading+=dh*Math.min(1,10*dt);
    // LOD: a far car is neither drawn nor posed; it keeps driving (above).
    const cdx=np.x-pp.x,cdz=np.z-pp.z,cd2=cdx*cdx+cdz*cdz;
    if(cd2>=CAR_CULL2){t.g.visible=false;t.g.position.set(np.x,groundHeight(np.x,np.z),np.z);continue;}
    // sits on its four wheels (height, pitch AND roll from the contacts; the underside
    // never cuts into a crest) — the same model as the player's car (vehicle-ground.ts)
    const pose=poseOnGround(groundHeight,np.x,np.z,t.heading,chassisOf(t.g.userData));
    t.g.position.set(np.x,pose.y,np.z);
    t.g.rotation.set(-pose.pitch,t.heading,pose.roll);
    t.g.visible=true;
    if(t.driver)t.driver.visible=cd2<48*48;
    spinWheels(t.g,t.speed,dt,clamp(dh*2,-1,1));
    const activeCur=cur;
    if(state.mode==='car'&&activeCur){
      const d=t.g.position.distanceTo(activeCur.g.position);
      if(d<2.9){
        const push=_push.subVectors(t.g.position,activeCur.g.position).setY(0).normalize();
        activeCur.g.position.addScaledVector(push,-(2.9-d)*.6);
        if(Math.abs(activeCur.speed)>8){
          addWanted(.25,null as unknown as string,'pursuit');thud(Math.abs(activeCur.speed));state.shake=.3;
          const mid=_mid.addVectors(t.g.position,activeCur.g.position).multiplyScalar(.5);
          mid.y+=.7;
          dentCar(activeCur.g,mid,push.clone().negate(),.2);
          dentCar(t.g,mid,push,.2);
        }
        activeCur.speed*=.6;t.brakeT=2;
      }
    }else if(state.mode==='foot'&&t.speed>4&&!(t.hitT&&t.hitT>0)){
      // Hit a pedestrian: speed-scaled damage, a brief cooldown, WASTED only at 0 health.
      if(t.g.position.distanceTo(player.g.position)<1.5){
        t.hitT=.8;
        state.health-=(irand(10,18)+Math.round(Math.abs(t.speed)*1.5))*PLAYER_DAMAGE_TAKEN;
        state.shake=Math.max(state.shake,.35);thud(Math.abs(t.speed));
        if(state.health<=0){state.health=100;getWasted();}
      }
    }
  }
}
