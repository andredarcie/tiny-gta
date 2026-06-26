import {rand,wrapA,groundHeight,SWIM_BOUND} from '@/core/constants.ts';
import {makeRedneck} from '../../assets/models/characters/redneck.ts';
import * as Entities from '@/core/entities.ts';
import {collideStatics} from '@/core/physics.ts';
import {state} from '@/core/state.ts';
import {playerPos,cur} from '@/actors/player.ts';
import {Npc,NPC_SEED} from '@/actors/npc.ts';
import {setNpcGlbGesture} from '../../assets/models/characters/npc-glb.ts';
import {makeRng} from '@/core/rng.ts';
import {npcDefsByKind} from '@/core/npc-defs.ts';
import type * as THREE from 'three';

// Ambient rural NPCs ("rednecks") living across the eastern peninsula. Each one now
// EXTENDS the shared Npc base (js/actors/npc.ts), so it inherits the COMMON combat
// behaviour for free: it takes bullets / punches / explosions / fire, dies in a
// ragdoll tumble with a blood pool and a little dropped cash (+1 wanted star for
// gunning down a civilian) — exactly like a city pedestrian. (Before, they were in
// none of the combat's NPC lists, so they were literally bullet-proof — the bug
// the base class fixes.) The state machine below is just the AMBIENT behaviour:
//   idle  — stand, breathe, glance around (and look at / wave to a passer-by)
//   walk  — stroll to a random spot within their home patch and back
//   work  — farm folk hoe their field (a stooped chopping action)
//   wave  — greet the player when they wander close on foot
//   flee  — scramble away from a car / a nearby gunshot
// Death itself is handled by the base; a fallen folk then revives back at its home
// patch so the countryside stays inhabited. LOD: far live folk are hidden + skipped.

class RuralFolk extends Npc{
  role:string;
  home:{x:number;z:number};
  wander:number;
  state:string;
  stateT:number;
  face:number;
  lookT:number;
  phase:number;
  bob:number;
  tx:number;
  tz:number;

  constructor(g:THREE.Object3D,role:string,gender?:'M'|'F',name?:string,likes?:string[],dialogues?:string[]){
    // civilian: one shot kills, drops a little cash, +1 wanted (like a pedestrian)
    super(g,{kind:'rural',hp:1,drop:[20,60],wanted:1,wantedMsg:'SHOT FIRED!',crime:'rural_shot',
      area:role==='town'?'Pine Hollow':'Countryside',gender,name,likes,dialogues});
    this.role=role;
    this.home={x:g.position.x,z:g.position.z};
    this.wander=role==='farm'?14:11;
    this.state='idle';this.stateT=rand(1,4);
    this.face=g.rotation.y;this.lookT=rand(1,4);
    this.phase=rand(0,6);this.bob=rand(0,6);this.tx=0;this.tz=0;
  }
  override aliveState():string{
    switch(this.state){
      case 'walk':return 'Strolling';
      case 'work':return 'Working the field';
      case 'wave':return 'Greeting';
      case 'flee':return 'Fleeing';
      default:return 'Idle';
    }
  }
  override pathTarget():{x:number;z:number}|null{
    // strolling toward a spot in its patch; otherwise anchored at its home spot
    return this.state==='walk'?{x:this.tx,z:this.tz}:{x:this.home.x,z:this.home.z};
  }
}

const folk:RuralFolk[]=[];
const CULL2=150*150;

// Home anchors [x,z,role]. Each folk wanders a patch around its anchor. 'farm' folk
// also tend the fields; 'town' folk loiter the Pine Hollow square (cx 650). The
// abandoned fort (~606,88) is left deserted on purpose — no folk there. Farm spots
// stay at x>=345 so nobody stands in the off-road race circuit (x<=320, |z|<=84).
const spots:[number,number,string][]=[
  // Pine Hollow village square (town folk)
  [641,5,'town'],[660,7,'town'],[650,-7,'town'],[632,3,'town'],[668,-4,'town'],
  // farms and fields (farm folk)
  [360,20,'farm'],[430,26,'farm'],[470,-30,'farm'],[352,42,'farm'],[455,34,'farm'],
];

// The country folk are DEFINED in npcs.json (kind 'rural') — fixed identities, no
// random people. Each 'rural' entry takes one home spot below (Pine Hollow square
// for town folk, the fields for farm folk); name / sex / likes come from the file.
// Placement is seeded for determinism.
const townSpots=spots.filter(s=>s[2]==='town');
const farmSpots=spots.filter(s=>s[2]==='farm');
const folkRng=makeRng(NPC_SEED+2);
let townI=0,farmI=0;
for(const def of npcDefsByKind('rural')){
  const role=def.neighborhood==='Pine Hollow'?'town':'farm';
  const spot=role==='town'?townSpots[townI++]:farmSpots[farmI++];
  if(!spot)continue; // more rural defs than home spots — skip the overflow
  const[x,z]=spot;
  const g=makeRedneck();
  const px=x+folkRng.rand(-1.5,1.5),pz=z+folkRng.rand(-1.5,1.5);
  g.position.set(px,groundHeight(px,pz),pz);
  collideStatics(g.position,.4,SWIM_BOUND);   // never start stuck; SWIM_BOUND keeps the peninsula reachable
  g.rotation.y=folkRng.rand(-Math.PI,Math.PI);
  folk.push(new RuralFolk(g,role,def.sex,def.name,def.likes,def.dialogues));
}

// ---- action poses (called instead of animatePed for the custom actions) -------
// Hoeing/digging: both arms swing down together in a stooped stance.
function poseWork(g:THREE.Object3D,phase:number){
  const l=g.userData.limbs;if(!l)return;
  const chop=Math.sin(phase);
  l.leftArm.rotation.set(-1.15+chop*.5,0,.14);
  l.rightArm.rotation.set(-1.15+chop*.5,0,-.14);
  l.leftForearm?.rotation.set(-.7,0,0);
  l.rightForearm?.rotation.set(-.7,0,0);
  l.leftLeg.rotation.x=-.1;l.rightLeg.rotation.x=.1;
  l.leftCalf?.rotation.set(.18,0,0);l.rightCalf?.rotation.set(.18,0,0);
}
// Greeting: right arm raised, hand swinging side to side.
function poseWave(g:THREE.Object3D,phase:number){
  const l=g.userData.limbs;if(!l)return;
  l.rightArm.rotation.set(-2.6,0,-.3+Math.sin(phase*6)*.35);
  l.rightForearm?.rotation.set(-.2,0,0);
  l.leftArm.rotation.set(-.1,0,.14);
  l.leftForearm?.rotation.set(-.3,0,0);
  l.leftLeg.rotation.x=0;l.rightLeg.rotation.x=0;
  l.leftCalf?.rotation.set(0,0,0);l.rightCalf?.rotation.set(0,0,0);
}

function turnTo(f:RuralFolk,target:number,rate:number,dt:number){
  f.g.rotation.y+=wrapA(target-f.g.rotation.y)*Math.min(1,rate*dt);
}

// Pick the next behaviour when the current one ends. Roles diverge: farm folk often
// go back to work, town folk mostly stroll the square.
function nextAction(f:RuralFolk){
  const r=Math.random();
  if(f.role==='farm'){
    if(r<.45)startWork(f);else if(r<.85)startWalk(f);else startIdle(f);
  }else{
    if(r<.6)startWalk(f);else startIdle(f);
  }
}
function startIdle(f:RuralFolk){f.state='idle';f.stateT=rand(2,5);f.lookT=rand(.5,2);}
function startWalk(f:RuralFolk){
  const a=rand(-Math.PI,Math.PI),rad=rand(3,f.wander);
  f.tx=f.home.x+Math.cos(a)*rad;f.tz=f.home.z+Math.sin(a)*rad;
  f.state='walk';f.stateT=rand(5,9);
}
function startWork(f:RuralFolk){f.state='work';f.stateT=rand(3,6);f.phase=0;f.face=rand(-Math.PI,Math.PI);}
function startWave(f:RuralFolk){f.state='wave';f.stateT=rand(2,3.2);f.phase=0;}
function startFlee(f:RuralFolk){f.state='flee';f.stateT=rand(1.4,2.4);}

// A fallen folk comes back at its home patch (keeps the countryside populated).
function reviveFolk(f:RuralFolk){
  f.dead=false;f.grounded=false;f.deadT=0;f.bloodDropped=false;f.hp=f.maxHp;
  f.punchHits=0;f.lastPunchT=-99;
  const px=f.home.x+rand(-1.5,1.5),pz=f.home.z+rand(-1.5,1.5);
  f.g.position.set(px,groundHeight(px,pz),pz);
  f.g.rotation.set(0,rand(-Math.PI,Math.PI),0);
  Entities.setOpacity?.(f.g,1);
  startIdle(f);f.face=f.g.rotation.y;
}

const SHOT_R=34;   // a gunshot scatters rural folk within this radius

export function updateRuralFolk(dt:number){
  const pp=playerPos();
  const activeCur=cur;
  const carDanger=state.mode==='car'&&activeCur&&Math.abs(activeCur.speed)>6;
  const onFoot=state.mode==='foot';
  // a recent gunshot (broadcast by js/combat/weapons.ts) panics anyone nearby
  const shotRecent=state.time-(state.shotT??-99)<0.6;
  for(const f of folk){
    // DEAD: play the inherited ragdoll tumble, then revive at home. Runs even when
    // far so a body the player walked away from finishes its fall (like pedestrians).
    if(f.dead){f.g.visible=true;if(f.updateRagdoll(dt))reviveFolk(f);continue;}

    const dx=f.g.position.x-pp.x,dz=f.g.position.z-pp.z;
    if(dx*dx+dz*dz>CULL2){f.g.visible=false;continue;}
    f.g.visible=true;
    f.bob+=dt*1.6;
    setNpcGlbGesture(f.g,null);   // clear last frame's gesture; the work/wave branches re-set it

    // Reactive: a fast car coming close scatters everyone (no matter what they were
    // doing). Triggered once; the flee state then plays out on its own timer.
    if(carDanger&&f.state!=='flee'){
      const cx=f.g.position.x-activeCur.g.position.x,cz=f.g.position.z-activeCur.g.position.z;
      if(cx*cx+cz*cz<11*11)startFlee(f);
    }
    // ...and a gunshot ringing out close by sends them running (from the shooter)
    if(shotRecent&&f.state!=='flee'){
      const gx=f.g.position.x-state.shotX!,gz=f.g.position.z-state.shotZ!;
      if(gx*gx+gz*gz<SHOT_R*SHOT_R)startFlee(f);
    }

    f.stateT-=dt;

    if(f.state==='flee'){
      // run directly away from the car (fall back to fleeing the player on foot)
      const from=carDanger?activeCur.g.position:pp;
      let ax=f.g.position.x-from.x,az=f.g.position.z-from.z;
      const m=Math.hypot(ax,az)||1;ax/=m;az/=m;
      const spd=5.5;
      f.g.position.x+=ax*spd*dt;f.g.position.z+=az*spd*dt;
      collideStatics(f.g.position,.4,SWIM_BOUND);
      turnTo(f,Math.atan2(ax,az),12,dt);
      f.phase+=dt*spd*2.2;
      f.g.position.y=groundHeight(f.g.position.x,f.g.position.z)+Math.abs(Math.sin(f.phase))*.06;
      Entities.animatePed?.(f.g,f.phase,1);
      if(f.stateT<=0&&!carDanger)startIdle(f);
      continue;
    }

    if(f.state==='walk'){
      const dxw=f.tx-f.g.position.x,dzw=f.tz-f.g.position.z;
      const dist=Math.hypot(dxw,dzw);
      if(dist<.6||f.stateT<=0){startIdle(f);continue;}
      const nx=dxw/dist,nz=dzw/dist,spd=f.role==='farm'?1.2:1.5;
      f.g.position.x+=nx*spd*dt;f.g.position.z+=nz*spd*dt;
      collideStatics(f.g.position,.4,SWIM_BOUND);
      turnTo(f,Math.atan2(nx,nz),8,dt);
      f.phase+=dt*spd*2.4;
      f.g.position.y=groundHeight(f.g.position.x,f.g.position.z)+Math.abs(Math.sin(f.phase))*.06;
      Entities.animatePed?.(f.g,f.phase,Math.min(1,spd/2));
      continue;
    }

    if(f.state==='work'){
      turnTo(f,f.face,3,dt);
      f.phase+=dt*4.5;
      poseWork(f.g,f.phase);
      setNpcGlbGesture(f.g,'work');   // rigged folk: the farm-chop (procedural pose is invisible on GLB)
      f.g.position.y=groundHeight(f.g.position.x,f.g.position.z);
      if(f.stateT<=0)startIdle(f);
      continue;
    }

    if(f.state==='wave'){
      turnTo(f,Math.atan2(pp.x-f.g.position.x,pp.z-f.g.position.z),8,dt);
      f.phase+=dt;
      poseWave(f.g,f.phase);
      setNpcGlbGesture(f.g,'wave');   // rigged folk: greeting wave
      f.g.position.y=groundHeight(f.g.position.x,f.g.position.z)+Math.abs(Math.sin(f.bob))*.012;
      if(f.stateT<=0)startIdle(f);
      continue;
    }

    // idle: breathe, glance around, and notice a passer-by
    f.lookT-=dt;
    if(f.lookT<=0){
      f.lookT=rand(2,5);
      const near=dx*dx+dz*dz<8*8;
      if(onFoot&&near&&Math.random()<.5){startWave(f);continue;}   // greet the player
      f.face=onFoot&&near?Math.atan2(pp.x-f.g.position.x,pp.z-f.g.position.z) // watch them
        :rand(-Math.PI,Math.PI);
    }
    turnTo(f,f.face,2,dt);
    f.g.position.y=groundHeight(f.g.position.x,f.g.position.z)+Math.abs(Math.sin(f.bob))*.012;
    Entities.animatePed?.(f.g,f.bob,.12);
    if(f.stateT<=0)nextAction(f);
  }
}
