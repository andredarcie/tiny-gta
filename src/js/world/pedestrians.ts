import * as THREE from 'three';
import {rand,irand,groundHeight} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {NPC_HP_CIVILIAN} from '@/core/difficulty.ts';
import {scene} from '@/core/engine.ts';
import {makePed,shirtColors} from '@/core/entities.ts';
import * as Entities from '@/core/entities.ts';
import {collideStatics,addWanted} from '@/core/physics.ts';
import {thud} from '@/audio/audio.ts';
import {message} from '@/ui/hud.ts';
import {playerPos,cur} from '@/actors/player.ts';
import {spawnDrop} from '@/activities/courier.ts';
import {makeBloodPuddle} from '../../assets/models/effects/blood-puddle.ts';
import {Npc,NPC_SEED} from '@/actors/npc.ts';
import {makeRng} from '@/core/rng.ts';
import {npcDefsByKind} from '@/core/npc-defs.ts';
import {CITY_NEIGHBORHOODS,neighborhoodStreets,inNeighborhood} from '@/world/neighborhoods.ts';
import type {Neighborhood} from '@/world/neighborhoods.ts';
import {LaneRunner,randomRoadPoint,nearestRoad,edges,walkOff,type RoadPos} from '@/world/divinolandia/nav.ts';

// ============================================================================
// Pedestrians — the PERSISTENT town civilians with fixed identities (npcs.json).
// Each ped belongs to a Divinolândia neighbourhood (world/neighborhoods.ts) and only
// ever walks the sidewalks of that area's streets, turning at random at the corners
// (a LaneRunner on the street graph, offset past the kerb). On death they go to the
// hospital (60 s) then return to their neighbourhood.
// ============================================================================

export class Ped extends Npc{
  run!:LaneRunner;  // the sidewalk being walked (the "carrot" a few steps ahead)
  aiState!:string; // 'walk'|'idle'|'panic'|'flee'|'weed'  (dead/grounded live on the base Npc)
  baseState!:string; // 'walk' or 'idle' — what they return to after a transient state
  t!:number;
  speed!:number;
  panicT!:number;
  neighborhood!:Neighborhood;
  likesWeed!:boolean; // 30% of peds — wave the player over to buy weed when they carry the pack
  wantBuds!:number;   // how many buds this ped buys in one deal
  weedCdT!:number;    // cooldown after a deal before they will flag you down again
  override aliveState():string{
    if(this.aiState==='weed')return 'Wants to buy weed';
    if(this.aiState==='idle')return 'Standing';
    return this.aiState==='panic'?'Panicking':this.aiState==='flee'?'Fleeing':'Walking';
  }
  override pathTarget():{x:number;z:number}|null{
    if(this.aiState==='weed')return null; // standing still, flagging you down
    const c=this.run.at(4,_carrot); // a few steps along the sidewalk it is walking
    return{x:c.x,z:c.z};
  }
  // Called by the weed-farm deal logic after a sale: back to walking, on cooldown.
  markWeedSold(){this.weedCdT=WEED_DEAL_CD;this.aiState='walk';}
}

const _carrot:RoadPos={x:0,z:0,dx:0,dz:0};
// a sidewalk runner on a random street of the neighbourhood (or, with `at`, the street
// nearest to that world point — after a panic run, so they pick up where they are)
function sidewalkRunner(nh:Neighborhood,rnd:()=>number=Math.random,at?:{x:number;z:number}):LaneRunner{
  const f=neighborhoodStreets(nh);
  const hit=at?nearestRoad(at.x,at.z,80,f):null;
  if(hit){const dir:1|-1=rnd()<.5?1:-1;return new LaneRunner(hit.e,dir,dir>0?hit.s:edges[hit.e].len-hit.s,{off:walkOff,f,round:2,rnd});}
  const sp=randomRoadPoint({f,rnd,inPlay:false});
  const dir:1|-1=rnd()<.5?1:-1;
  return new LaneRunner(sp.e,dir,dir>0?sp.s:edges[sp.e].len-sp.s,{off:walkOff,f,round:2,rnd});
}

export const peds:Ped[]=[];
const PED_CULL2=105*105; // perf: 130→105. Cada ped é um SkinnedMesh de ~7930 tris; cortar distantes economiza vértices/skinning (dots minúsculos além disso)
const bloodPuddles:THREE.Object3D[]=[];
const _tgt=new THREE.Vector3();
const _d=new THREE.Vector3();
const _dir=new THREE.Vector3();
const _rnd=new THREE.Vector3();

export const HOSPITAL_TIME=60; // seconds before a killed ped returns from hospital
const WEED_NOTICE=15;     // a weed-liking ped flags you down within this range (pack out)
const WEED_DEAL_CD=45;    // seconds before a ped will flag you down again after a deal

// Wave pose for a weed-liking ped flagging the player down: right arm up, hand
// swinging side to side (animatePed restores the walk cycle once they move again).
function poseWavePed(g:THREE.Object3D,phase:number){
  const l=g.userData.limbs;if(!l)return;
  l.rightArm.rotation.set(-2.5,0,-.3+Math.sin(phase*6)*.45);
  l.rightForearm?.rotation.set(-.2,0,0);
  l.leftArm.rotation.set(-.12,0,.12);
  l.leftForearm?.rotation.set(-.22,0,0);
  l.leftLeg.rotation.set(0,0,0);l.rightLeg.rotation.set(0,0,0);
  l.leftCalf?.rotation.set(0,0,0);l.rightCalf?.rotation.set(0,0,0);
}

// Beckon pose for a weed-liking ped flagging you down for a DEAL — deliberately DISTINCT
// from the friendly one-arm greeting wave above: both arms reach forward and the hands
// curl inward in a "come over here" beckon, so a buyer reads clearly as a buyer (and not
// as a random passer-by saying hi).
function poseWeedBeckon(g:THREE.Object3D,phase:number){
  const l=g.userData.limbs;if(!l)return;
  const b=Math.sin(phase*5);
  l.rightArm.rotation.set(-1.45,0,-.18);
  l.rightForearm?.rotation.set(-1.0-Math.max(0,b)*.8,0,0);
  l.leftArm.rotation.set(-1.45,0,.18);
  l.leftForearm?.rotation.set(-1.0-Math.max(0,-b)*.8,0,0);
  l.leftLeg.rotation.set(0,0,0);l.rightLeg.rotation.set(0,0,0);
  l.leftCalf?.rotation.set(0,0,0);l.rightCalf?.rotation.set(0,0,0);
}

// Turn a ped to face the player (module-level so the hot loop allocates no closures).
function pedFace(p:Ped,pp:THREE.Vector3){
  p.g.rotation.y=Math.atan2(pp.x-p.g.position.x,pp.z-p.g.position.z);
}
// Face the player and idle in place (brave stare / greedy beg / hostile confront).
function pedStandFacing(p:Ped,pp:THREE.Vector3,dt:number,amt:number){
  pedFace(p,pp);p.t+=dt;
  p.g.position.y=groundHeight(p.g.position.x,p.g.position.z);
  Entities.animatePed?.(p.g,p.t,amt);
}

export function addBloodPuddle(x:number,z:number){
  const puddle=makeBloodPuddle();
  puddle.position.set(x+rand(-.12,.12),groundHeight(x,z)+.02,z+rand(-.12,.12));
  puddle.rotation.y=rand(0,Math.PI*2);
  scene.add(puddle);
  bloodPuddles.push(puddle);
  while(bloodPuddles.length>36)scene.remove(bloodPuddles.shift()!);
}

// The town civilians are DEFINED in npcs.json — a fixed roster, no random identities
// and nobody spawning "from beyond". Each 'civilian' entry becomes one Ped placed on a
// sidewalk of its named neighbourhood; name / sex / likes (e.g. smoke_weed) come
// straight from the file, so every player meets the same people. Placement is seeded.
const pedRng=makeRng(NPC_SEED+1);
for(const def of npcDefsByKind('civilian')){
  const nh=CITY_NEIGHBORHOODS.find(n=>n.name===def.neighborhood);
  if(!nh)continue; // unknown neighborhood in the data — skip rather than misplace
  const run=sidewalkRunner(nh,pedRng.random);
  const c=run.at(0,_carrot);
  const g=makePed(shirtColors[pedRng.irand(0,shirtColors.length-1)]);
  g.position.set(c.x,groundHeight(c.x,c.z),c.z);
  const p=new Ped(g,{
    kind:'ped',hp:NPC_HP_CIVILIAN,drop:[15,55],wanted:1,wantedMsg:'SHOT FIRED!',crime:'ped_shot',
    punchToDown:3,showLabel:true,area:nh.name,
    gender:def.sex,name:def.name,likes:def.likes,personality:def.personality,dialogues:def.dialogues,
  });
  p.run=run;
  p.baseState=def.state==='idle'?'idle':'walk'; // some people just stand around
  p.aiState=p.baseState;
  p.t=pedRng.rand(0,6);
  p.speed=pedRng.rand(1,1.8)*(def.personality==='chill'?.72:1); // chill folk amble
  p.panicT=0;
  p.neighborhood=nh;
  p.likesWeed=def.likes.includes('smoke_weed'); // who flags you down for a deal
  p.wantBuds=pedRng.irand(2,6);                 // how many buds they buy in one deal
  p.weedCdT=0;
  peds.push(p);
}

// Stolen-car driver: reuse the ped farthest from the player (the pool is fixed),
// place them stepping out of the car door and send them fleeing in panic.
export function ejectDriver(x:number,z:number,heading:number){
  const pp=playerPos();
  let best:Ped|null=null,bd=-1;
  for(const p of peds){
    if(p.dead||p.hospitalT>0||p.aiState==='weed')continue; // don't yank a ped mid-deal
    const d=p.g.position.distanceTo(pp);
    if(d>bd){bd=d;best=p;}
  }
  if(!best)return;
  const right=new THREE.Vector3(Math.cos(heading),0,-Math.sin(heading));
  best.g.position.set(x,groundHeight(x,z),z).addScaledVector(right,1.6);
  best.g.rotation.set(0,heading,0);
  best.aiState='panic';best.panicT=rand(3.5,5);best.t=0;
  // when the panic ends it walks back to a sidewalk inside its OWN neighbourhood
  best.run=sidewalkRunner(best.neighborhood);
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
        p.run=sidewalkRunner(p.neighborhood);
        const c=p.run.at(0,_carrot);
        p.revive(c.x,c.z);
        p.aiState=p.baseState;
        Entities.animatePed?.(p.g,0,0);
      }
      continue;
    }
    // DEAD: the body tumbles, then LIES as a corpse (no fade). The ambulance service
    // (js/world/body-recovery.ts) collects it — a visual pickup when the player is near,
    // or a numeric one when far — setting hospitalT and managing the body's visibility.
    if(p.dead){
      p.updateRagdoll(dt,false);
      continue;
    }
    // LOD: a ped far from the player is neither drawn nor simulated.
    const lx=p.g.position.x-pp.x,lz=p.g.position.z-pp.z;
    if(lx*lx+lz*lz>PED_CULL2){p.g.visible=false;continue;}
    p.g.visible=true;
    // Hit-and-run: ped is close to a fast car — launch without the standard `kill()`
    // path (different wanted message + combo multiplier).
    if(danger&&p.g.position.distanceTo(activeCur.g.position)<2.0){
      p.dead=true;p.grounded=false;p.deadT=0;p.bloodDropped=true;
      addBloodPuddle(p.g.position.x,p.g.position.z); // run-over victims bleed like shot ones
      _dir.set(Math.sin(activeCur.heading),0,Math.cos(activeCur.heading));
      _rnd.set(rand(-2,2),rand(5,8),rand(-2,2));
      p.vel.copy(_dir).multiplyScalar(activeCur.speed*.4).add(_rnd);
      // fast impact blows the body apart; slower ones rip a limb off
      if(Math.abs(activeCur.speed)>24)refs.gibNpc?.(p,_dir,1.3);
      else refs.maimRandom?.(p,_dir);
      refs.spawnBlood?.(p.g.position.x,p.g.position.y+1,p.g.position.z,_dir,40);
      state.comboN=state.time-state.lastHit<4?state.comboN+1:1;
      state.lastHit=state.time;state.kills++;
      spawnDrop(p.g.position.x,p.g.position.z,irand(20,80)*state.comboN);
      addWanted(1,'HIT AND RUN! ★'+Math.min(6,Math.floor(state.wanted+1)),'hit_run');
      if(state.comboN>1)message('COMBO x'+state.comboN+'!','var(--pink)');
      thud(Math.abs(activeCur.speed));state.shake=.35;
      continue;
    }
    if(p.aiState==='panic'&&(p.panicT-=dt)<=0)p.aiState=p.baseState;
    if(p.weedCdT>0)p.weedCdT-=dt;
    // PERSONALITY shapes when they bolt from a speeding car: the nervous scatter from
    // way off, the brave barely budge until it's nearly on them.
    const fleeR=p.personality==='nervous'?16:p.personality==='brave'?7:11;
    // Weed buyer: carrying the backpack near a weed-liking ped → they STOP, face you
    // and wave you over. Danger (panic/flee) still takes priority below.
    const wantsWeed=p.likesWeed&&p.weedCdT<=0&&!!refs.isCarryingWeed?.()&&
      !(danger&&p.g.position.distanceTo(activeCur.g.position)<fleeR)&&p.aiState!=='panic';
    const tgt=_tgt;
    if(wantsWeed&&p.g.position.distanceTo(pp)<WEED_NOTICE){
      p.aiState='weed'; // stand still, face the player, wave
      p.g.rotation.y=Math.atan2(pp.x-p.g.position.x,pp.z-p.g.position.z);
      p.t+=dt*4;
      p.g.position.y=groundHeight(p.g.position.x,p.g.position.z);
      poseWeedBeckon(p.g,p.t); // distinct "come deal" beckon, not the plain greeting wave
      continue;
    }
    if(p.aiState==='panic'){
      tgt.subVectors(p.g.position,pp).setY(0).normalize()
        .multiplyScalar(20).add(p.g.position);
    }else if(danger&&p.g.position.distanceTo(activeCur.g.position)<fleeR){
      p.aiState='flee';
      tgt.subVectors(p.g.position,activeCur.g.position).setY(0).normalize()
        .multiplyScalar(20).add(p.g.position);
    }else{
      if(p.aiState==='flee'||p.aiState==='weed')p.aiState=p.baseState;
      // PERSONALITY reactions to a nearby player ON FOOT (no car danger) — each one
      // visibly different on the street:
      //   friendly → faces you and WAVES hello   brave → stands ground and stares
      //   greedy   → walks up and waits (begs)    hostile → strides up and confronts
      // (nervous/chill have their tells in the flee distance / walk speed above.)
      const distP=state.mode==='foot'?p.g.position.distanceTo(pp):1e9;
      if(p.personality==='friendly'&&distP<6){          // greet + wave
        pedFace(p,pp);p.t+=dt*4;p.g.position.y=groundHeight(p.g.position.x,p.g.position.z);
        poseWavePed(p.g,p.t);continue; // rigged ped: friendly greeting wave
      }
      if(p.personality==='brave'&&distP<4){pedStandFacing(p,pp,dt,.05);continue;} // stare you down
      const confront=p.personality==='hostile',beg=p.personality==='greedy';
      if((confront||beg)&&distP<(confront?7:9)){
        const stop=confront?1.8:2.7;
        if(distP<=stop){pedStandFacing(p,pp,dt,confront?.25:.08);continue;} // arrived: face the player
        tgt.copy(pp);tgt.y=0;                            // approach the player
      }else if(p.aiState==='idle'){                      // standing-around people idle in place
        p.t+=dt;p.g.position.y=groundHeight(p.g.position.x,p.g.position.z);
        Entities.animatePed?.(p.g,p.t,.05);continue;
      }else{
        // walk the sidewalk: the carrot moves along it at walking pace while the ped is
        // close to it, and waits when the ped was pushed away (they walk back to it)
        const c=p.run.at(0,_carrot);
        if(Math.hypot(c.x-p.g.position.x,c.z-p.g.position.z)<1.6)p.run.advance(p.speed*dt*1.05);
        const n=p.run.at(1.2,_carrot);tgt.set(n.x,0,n.z);
      }
    }
    const d=_d.subVectors(tgt,p.g.position);d.y=0;
    const dist=d.length();
    if(dist<.05)continue;
    // a ped that panicked out of its neighbourhood picks up the nearest sidewalk back home
    if(p.aiState==='walk'&&dist>40&&!inNeighborhood(p.neighborhood,p.g.position.x,p.g.position.z))
      p.run=sidewalkRunner(p.neighborhood,Math.random,p.g.position);
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
