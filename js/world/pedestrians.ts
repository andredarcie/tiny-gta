import * as THREE from 'three';
import {N,CELL,HALF,nodeX,irand,rand,clamp,groundHeight} from '@/core/constants.ts';
import {state} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {makePed,shirtColors} from '@/core/entities.ts';
import * as Entities from '@/core/entities.ts';
import {collideStatics,addWanted} from '@/core/physics.ts';
import {thud} from '@/audio/audio.ts';
import {message} from '@/ui/hud.ts';
import {playerPos,cur} from '@/actors/player.ts';
import {spawnDrop} from '@/story/missions.ts';
import {makeBloodPuddle} from '../../assets/models/effects/blood-puddle.ts';
import {Npc,NPC_SEED,pickName,balancedGenders} from '@/actors/npc.ts';
import {makeRng} from '@/core/rng.ts';
import {CITY_NEIGHBORHOODS,randomBlockIn} from '@/world/neighborhoods.ts';
import type {Neighborhood} from '@/world/neighborhoods.ts';

// ============================================================================
// Pedestrians — 42 PERSISTENT city civilians with fixed identities.
// Each ped belongs to a neighborhood (one of 4 city quadrants) and only ever
// walks within its district. On death they go to the hospital (60 s) then
// return to their neighborhood, keeping the streets populated at all times.
// ============================================================================

export class Ped extends Npc{
  block!:[number,number];
  corner!:number;
  dir!:number;
  aiState!:string; // 'walk'|'panic'|'flee'  (dead/grounded live on the base Npc)
  t!:number;
  speed!:number;
  panicT!:number;
  neighborhood!:Neighborhood;
  override aliveState():string{
    return this.aiState==='panic'?'Panicking':this.aiState==='flee'?'Fleeing':'Walking';
  }
}

const _corner:[number,number]=[0,0];
export function pedCorner(p:Ped):[number,number]{
  const[i,j]=p.block;
  const xa=nodeX(i)+9,xb=nodeX(i+1)-9,za=nodeX(j)+9,zb=nodeX(j+1)-9;
  _corner[0]=(p.corner===1||p.corner===2)?xb:xa;
  _corner[1]=p.corner>=2?zb:za;
  return _corner;
}

export const peds:Ped[]=[];
const PED_CULL2=130*130;
const bloodPuddles:THREE.Object3D[]=[];
const _tgt=new THREE.Vector3();
const _d=new THREE.Vector3();
const _dir=new THREE.Vector3();
const _rnd=new THREE.Vector3();

const HOSPITAL_TIME=60; // seconds before a killed ped returns from hospital

export function addBloodPuddle(x:number,z:number){
  const puddle=makeBloodPuddle();
  puddle.position.set(x+rand(-.12,.12),groundHeight(x,z)+.02,z+rand(-.12,.12));
  puddle.rotation.y=rand(0,Math.PI*2);
  scene.add(puddle);
  bloodPuddles.push(puddle);
  while(bloodPuddles.length>36)scene.remove(bloodPuddles.shift()!);
}

// Build 42 peds distributed across the 4 city neighborhoods (11+11+10+10).
// DETERMINISTIC: a fixed-seed stream drives every identity/placement choice, so
// every player gets the exact same 42 named civilians in the same homes. The 50/50
// male/female split is computed up-front across the whole population.
const TOTAL_PEDS=CITY_NEIGHBORHOODS.reduce((s,nh)=>s+nh.pedCount,0); // 42
const pedRng=makeRng(NPC_SEED+1);
const pedGenders=balancedGenders(TOTAL_PEDS,pedRng);
let pedGi=0;
for(const nh of CITY_NEIGHBORHOODS){
  for(let k=0;k<nh.pedCount;k++){
    const gender=pedGenders[pedGi++];
    const[bi,bj]=randomBlockIn(nh,pedRng);
    const tmpCorner=pedRng.irand(0,3);
    const xa=nodeX(bi)+9,xb=nodeX(bi+1)-9,za=nodeX(bj)+9,zb=nodeX(bj+1)-9;
    const cx=(tmpCorner===1||tmpCorner===2)?xb:xa;
    const cz=tmpCorner>=2?zb:za;
    const g=makePed(shirtColors[pedRng.irand(0,shirtColors.length-1)]);
    g.position.set(cx+pedRng.rand(-2,2),0,cz+pedRng.rand(-2,2));
    const p=new Ped(g,{
      kind:'ped',hp:1,drop:[15,55],wanted:1,wantedMsg:'SHOT FIRED!',crime:'ped_shot',
      punchToDown:3,showLabel:true,area:nh.name,
      gender,name:pickName(gender,pedRng),
    });
    p.block=[bi,bj];
    p.corner=tmpCorner;
    p.dir=pedRng.random()<.5?1:-1;
    p.aiState='walk';
    p.t=0;
    p.speed=pedRng.rand(1,1.8);
    p.panicT=0;
    p.neighborhood=nh;
    peds.push(p);
  }
}

// Stolen-car driver: reuse the ped farthest from the player (the pool is fixed),
// place them stepping out of the car door and send them fleeing in panic.
export function ejectDriver(x:number,z:number,heading:number){
  const pp=playerPos();
  let best:Ped|null=null,bd=-1;
  for(const p of peds){
    if(p.dead||p.hospitalT>0)continue;
    const d=p.g.position.distanceTo(pp);
    if(d>bd){bd=d;best=p;}
  }
  if(!best)return;
  const right=new THREE.Vector3(Math.cos(heading),0,-Math.sin(heading));
  best.g.position.set(x,0,z).addScaledVector(right,1.6);
  best.g.rotation.set(0,heading,0);
  best.aiState='panic';best.panicT=rand(3.5,5);best.t=0;
  best.block=[clamp(Math.floor((x+HALF)/CELL),0,N-1),clamp(Math.floor((z+HALF)/CELL),0,N-1)];
  best.corner=irand(0,3);
}

export function updatePeds(dt:number){
  const pp=playerPos();
  const activeCur=cur;
  const danger=state.mode==='car'&&activeCur&&Math.abs(activeCur.speed)>6;
  for(const p of peds){
    // HOSPITAL: ped is recovering off-screen; count down then revive in neighborhood.
    if(p.hospitalT>0){
      p.hospitalT-=dt;
      p.g.visible=false;
      if(p.hospitalT<=0){
        const[bi,bj]=randomBlockIn(p.neighborhood);
        p.block=[bi,bj];p.corner=irand(0,3);
        const c=pedCorner(p);
        p.revive(c[0]+rand(-2,2),c[1]+rand(-2,2));
        p.aiState='walk';
        Entities.animatePed?.(p.g,0,0);
      }
      continue;
    }
    // DEAD: play the inherited ragdoll tumble, then send to hospital.
    if(p.dead){
      p.g.visible=true;
      if(p.updateRagdoll(dt)){
        p.hospitalT=HOSPITAL_TIME;
        p.g.visible=false;
      }
      continue;
    }
    // LOD: a ped far from the player is neither drawn nor simulated.
    const lx=p.g.position.x-pp.x,lz=p.g.position.z-pp.z;
    if(lx*lx+lz*lz>PED_CULL2){p.g.visible=false;continue;}
    p.g.visible=true;
    // Hit-and-run: ped is close to a fast car — launch without the standard `kill()`
    // path (different wanted message + combo multiplier).
    if(danger&&p.g.position.distanceTo(activeCur.g.position)<2.0){
      p.dead=true;p.grounded=false;p.deadT=0;p.bloodDropped=false;
      _dir.set(Math.sin(activeCur.heading),0,Math.cos(activeCur.heading));
      _rnd.set(rand(-2,2),rand(5,8),rand(-2,2));
      p.vel.copy(_dir).multiplyScalar(activeCur.speed*.4).add(_rnd);
      state.comboN=state.time-state.lastHit<4?state.comboN+1:1;
      state.lastHit=state.time;state.kills++;
      spawnDrop(p.g.position.x,p.g.position.z,irand(20,80)*state.comboN);
      addWanted(1,'HIT AND RUN! ★'+Math.min(6,Math.floor(state.wanted+1)),'hit_run');
      if(state.comboN>1)message('COMBO x'+state.comboN+'!','var(--pink)');
      thud(Math.abs(activeCur.speed));state.shake=.35;
      continue;
    }
    if(p.aiState==='panic'&&(p.panicT-=dt)<=0)p.aiState='walk';
    const tgt=_tgt;
    if(p.aiState==='panic'){
      tgt.subVectors(p.g.position,pp).setY(0).normalize()
        .multiplyScalar(20).add(p.g.position);
    }else if(danger&&p.g.position.distanceTo(activeCur.g.position)<11){
      p.aiState='flee';
      tgt.subVectors(p.g.position,activeCur.g.position).setY(0).normalize()
        .multiplyScalar(20).add(p.g.position);
    }else{
      if(p.aiState==='flee')p.aiState='walk';
      const c=pedCorner(p);tgt.set(c[0],0,c[1]);
    }
    const d=_d.subVectors(tgt,p.g.position);d.y=0;
    const dist=d.length();
    if(p.aiState==='walk'&&dist<1){
      p.corner=(p.corner+p.dir+4)%4;
      // If somehow outside neighborhood bounds, snap back.
      const[bi,bj]=p.block;
      if(bi<p.neighborhood.iMin||bi>p.neighborhood.iMax||bj<p.neighborhood.jMin||bj>p.neighborhood.jMax){
        const[nbi,nbj]=randomBlockIn(p.neighborhood);
        p.block=[nbi,nbj];p.corner=irand(0,3);
      }
      continue;
    }
    d.normalize();
    const spd=p.aiState==='flee'?5.5:p.aiState==='panic'?6.8:p.speed;
    p.g.position.addScaledVector(d,spd*dt);
    collideStatics(p.g.position,.4);
    p.g.rotation.y=Math.atan2(d.x,d.z);
    p.t+=dt*spd*2.2;
    p.g.position.y=groundHeight(p.g.position.x,p.g.position.z)+Math.abs(Math.sin(p.t))*.07;
    Entities.animatePed?.(p.g,p.t,Math.min(1,spd/5.5));
  }
}
