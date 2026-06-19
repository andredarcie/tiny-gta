import {rand,wrapA,groundHeight,SWIM_BOUND} from './constants.js';
import {makeRedneck} from '../assets/models/characters/redneck.js';
import * as Entities from './entities.js';
import {collideStatics} from './physics.js';
import {state} from './state.js';
import {playerPos,cur} from './player.js';

// Ambient rural NPCs ("rednecks") living across the eastern peninsula. Unlike the
// old version (they just stood and swayed), each one now runs a small behaviour
// state machine so the countryside feels inhabited:
//   idle  — stand, breathe, glance around (and look at / wave to a passer-by)
//   walk  — stroll to a random spot within their home patch and back
//   work  — farm folk hoe their field (a stooped chopping action)
//   wave  — greet the player when they wander close on foot
//   flee  — scramble away from a car barrelling past at speed
// They still carry no combat AI — they are flavour, not threats. LOD: far folk are
// hidden AND skipped (same idea as pedestrians.js / traffic.js).
const folk=[];
const CULL2=150*150;

// Home anchors [x,z,role]. Each folk wanders a patch around its anchor. 'farm' folk
// also tend the fields; 'town' folk loiter the Pine Hollow square (cx 650). The
// abandoned fort (~606,88) is left deserted on purpose — no folk there. Farm spots
// stay at x>=345 so nobody stands in the off-road race circuit (x<=320, |z|<=84).
const spots=[
  // Pine Hollow village square (town folk)
  [641,5,'town'],[660,7,'town'],[650,-7,'town'],[632,3,'town'],[668,-4,'town'],
  // farms and fields (farm folk)
  [360,20,'farm'],[430,26,'farm'],[470,-30,'farm'],[352,42,'farm'],[455,34,'farm'],
];

for(const[x,z,role]of spots){
  const g=makeRedneck();
  const px=x+rand(-1.5,1.5),pz=z+rand(-1.5,1.5);
  g.position.set(px,groundHeight(px,pz),pz);
  collideStatics(g.position,.4,SWIM_BOUND);   // never start stuck; SWIM_BOUND keeps the peninsula reachable
  g.rotation.y=rand(-Math.PI,Math.PI);
  const f={g,role,home:{x:g.position.x,z:g.position.z},wander:role==='farm'?14:11,
    state:'idle',stateT:rand(1,4),face:g.rotation.y,lookT:rand(1,4),
    phase:rand(0,6),bob:rand(0,6),tx:0,tz:0};
  folk.push(f);
}

// ---- action poses (called instead of animatePed for the custom actions) -------
// Hoeing/digging: both arms swing down together in a stooped stance.
function poseWork(g,phase){
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
function poseWave(g,phase){
  const l=g.userData.limbs;if(!l)return;
  l.rightArm.rotation.set(-2.6,0,-.3+Math.sin(phase*6)*.35);
  l.rightForearm?.rotation.set(-.2,0,0);
  l.leftArm.rotation.set(-.1,0,.14);
  l.leftForearm?.rotation.set(-.3,0,0);
  l.leftLeg.rotation.x=0;l.rightLeg.rotation.x=0;
  l.leftCalf?.rotation.set(0,0,0);l.rightCalf?.rotation.set(0,0,0);
}

function turnTo(f,target,rate,dt){
  f.g.rotation.y+=wrapA(target-f.g.rotation.y)*Math.min(1,rate*dt);
}

// Pick the next behaviour when the current one ends. Roles diverge: farm folk often
// go back to work, town folk mostly stroll the square.
function nextAction(f){
  const r=Math.random();
  if(f.role==='farm'){
    if(r<.45)startWork(f);else if(r<.85)startWalk(f);else startIdle(f);
  }else{
    if(r<.6)startWalk(f);else startIdle(f);
  }
}
function startIdle(f){f.state='idle';f.stateT=rand(2,5);f.lookT=rand(.5,2);}
function startWalk(f){
  const a=rand(-Math.PI,Math.PI),rad=rand(3,f.wander);
  f.tx=f.home.x+Math.cos(a)*rad;f.tz=f.home.z+Math.sin(a)*rad;
  f.state='walk';f.stateT=rand(5,9);
}
function startWork(f){f.state='work';f.stateT=rand(3,6);f.phase=0;f.face=rand(-Math.PI,Math.PI);}
function startWave(f){f.state='wave';f.stateT=rand(2,3.2);f.phase=0;}
function startFlee(f){f.state='flee';f.stateT=rand(1.4,2.4);}

const SHOT_R=34;   // a gunshot scatters rural folk within this radius

export function updateRuralFolk(dt){
  const pp=playerPos();
  const activeCur=cur;
  const carDanger=state.mode==='car'&&activeCur&&Math.abs(activeCur.speed)>6;
  const onFoot=state.mode==='foot';
  // a recent gunshot (broadcast by js/weapons.js) panics anyone nearby
  const shotRecent=state.time-(state.shotT??-99)<0.6;
  for(const f of folk){
    const dx=f.g.position.x-pp.x,dz=f.g.position.z-pp.z;
    if(dx*dx+dz*dz>CULL2){f.g.visible=false;continue;}
    f.g.visible=true;
    f.bob+=dt*1.6;

    // Reactive: a fast car coming close scatters everyone (no matter what they were
    // doing). Triggered once; the flee state then plays out on its own timer.
    if(carDanger&&f.state!=='flee'){
      const cx=f.g.position.x-activeCur.g.position.x,cz=f.g.position.z-activeCur.g.position.z;
      if(cx*cx+cz*cz<11*11)startFlee(f);
    }
    // ...and a gunshot ringing out close by sends them running (from the shooter)
    if(shotRecent&&f.state!=='flee'){
      const gx=f.g.position.x-state.shotX,gz=f.g.position.z-state.shotZ;
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
      f.g.position.y=groundHeight(f.g.position.x,f.g.position.z);
      if(f.stateT<=0)startIdle(f);
      continue;
    }

    if(f.state==='wave'){
      turnTo(f,Math.atan2(pp.x-f.g.position.x,pp.z-f.g.position.z),8,dt);
      f.phase+=dt;
      poseWave(f.g,f.phase);
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
