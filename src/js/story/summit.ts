import * as THREE from 'three';
import {groundHeight,MOUNT_X} from '@/core/constants.ts';
import {scene} from '@/core/engine.ts';
import {player} from '@/actors/player.ts';
import {reachHand,setTalkPose,type CinePhase} from '@/story/cutscene.ts';
import logSeat from '../../assets/models/rural/log-seat.ts';
import cigaretteModel from '../../assets/models/props/cigarette.ts';
import lighterModel from '../../assets/models/props/lighter.ts';
import {makeSmokePuff} from '../../assets/models/effects/smoke-puff.ts';

// ============================================================================
// THE SUMMIT — after the burial's time skip the player is found sitting on a log at
// the top of the mountain, looking out over the forest where the graves are, and has a
// cigarette: the right hand brings it to the lips, the left flicks a lighter under the
// tip, the ember catches, a long drag, the smoke is blown out, the hand comes down —
// and only then does he talk (js/story/story.ts drives the monologue through
// cutscene.ts; this module places the scene and poses the body frame by frame).
// The closing shot cuts to him standing up; then the player has control again.
// ============================================================================

export const INTRO_T=6.4, OUTRO_T=1.8;

// Head-bone-local points (the doll's head bone sits at the neck, pedestrian.ts).
const MOUTH=new THREE.Vector3(0,.09,.2);
// Forearm-bone-local: between the fingers of the hand (the hand box is at (.03,-.34,0)).
const FINGERS=new THREE.Vector3(.03,-.37,.05);

let seat: THREE.Object3D|null=null;
let cig: THREE.Object3D|null=null;
let lighter: THREE.Object3D|null=null;
let lit=0;
interface Puff{m: THREE.Mesh;v: THREE.Vector3;t: number;life: number;s0: number;}
const puffs: Puff[]=[];
const pool: THREE.Mesh[]=[];
let wispT=0;

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp01=(v: number)=>v<0?0:v>1?1:v;
const seg=(t: number,a: number,b: number)=>clamp01((t-a)/(b-a));
const ease=(t: number)=>t*t*(3-2*t);

function puff(at: THREE.Vector3,v: THREE.Vector3,size: number,life: number){
  const m=pool.pop()??makeSmokePuff(0xd9d9de);
  m.position.copy(at);m.scale.setScalar(size);
  (m.material as THREE.MeshBasicMaterial).opacity=.45;
  scene.add(m);
  puffs.push({m,v,t:0,life,s0:size});
}

// Sitting on the log: thighs level, shins hanging, the body lowered onto the seat.
const SIT_DROP=.48;
function sitPose(){
  const l=player.g.userData.limbs;if(!l)return;
  l.leftLeg.rotation.set(-1.5,0,.06);l.rightLeg.rotation.set(-1.5,0,-.06);
  l.leftCalf?.rotation.set(1.45,0,0);l.rightCalf?.rotation.set(1.45,0,0);
}
function standPose(){
  const l=player.g.userData.limbs;if(!l)return;
  for(const k of['leftLeg','rightLeg','leftCalf','rightCalf','leftArm','rightArm','leftForearm','rightForearm','head'])
    l[k]?.rotation.set(0,0,0);
  l.rightArm.rotation.z=-.12;l.leftArm.rotation.z=.12;
}

/** Sit the player on a log at the summit, facing `look` (a world point). Returns the
 *  point the monologue camera should look toward. */
export function setupSummit(look: THREE.Vector3): THREE.Vector3{
  const peak=V(MOUNT_X,0,0);
  const dir=V(look.x-peak.x,0,look.z-peak.z).normalize();
  const at=peak.clone().addScaledVector(dir,1.6);           // just off the flagpole, toward the view
  const gy=groundHeight(at.x,at.z);
  const heading=Math.atan2(dir.x,dir.z);
  seat=logSeat.build();
  seat.position.set(at.x-dir.x*.08,gy,at.z-dir.z*.08);seat.rotation.y=heading;
  scene.add(seat);
  player.heading=heading;
  player.g.rotation.set(0,heading,0);
  player.g.position.set(at.x,gy-SIT_DROP,at.z);
  sitPose();
  // the cigarette between the right fingers, the lighter in the left hand (hidden)
  const l=player.g.userData.limbs;
  cig=cigaretteModel.build();cig.scale.setScalar(1.4);
  cig.position.copy(FINGERS);cig.rotation.set(Math.PI/2,0,0);        // pointing forward out of the fist
  l.rightForearm.add(cig);
  lighter=lighterModel.build();lighter.scale.setScalar(1.4);
  lighter.position.set(-.03,-.36,.03);lighter.visible=false;
  l.leftForearm.add(lighter);
  lit=0;(cig.userData.setLit as (k: number)=>void)(0);
  return at.clone().addScaledVector(dir,10).setY(gy);
}

/** Tear the scene down: the cigarette is flicked away and the log goes too. */
export function endSummit(){
  cig?.parent?.remove(cig);lighter?.parent?.remove(lighter);cig=lighter=null;
  seat?.parent?.remove(seat);seat=null;
  standPose();
}

const _m=new THREE.Vector3(),_k=new THREE.Vector3(),_t=new THREE.Vector3(),_h=new THREE.Vector3();
/** Pose one frame of the scene (cutscene onFrame). */
export function poseSummit(t: number,talking: 'npc'|'player'|null,phase: CinePhase,pt: number){
  const l=player.g.userData.limbs;if(!l||!cig)return;
  if(phase==='outro'){
    // the cut: he stands up, cigarette hanging from the right hand, looking out
    const p=player.g.position;
    if(p.y<groundHeight(p.x,p.z)-.1){                         // first frame of the shot
      p.addScaledVector(V(Math.sin(player.heading),0,Math.cos(player.heading)),.45);  // a step off the log
      p.y=groundHeight(p.x,p.z);standPose();
    }
    l.rightArm.rotation.set(-.15,0,-.1);l.rightForearm.rotation.set(-.35,0,0);
    smokeFromTip(1/60);
    return;
  }
  sitPose();
  player.g.updateMatrixWorld(true);
  l.head.localToWorld(_m.copy(MOUTH));
  // the "rest": the right hand on the right knee
  const fwd=V(Math.sin(player.heading),0,Math.cos(player.heading));
  l.rightLeg.getWorldPosition(_k).addScaledVector(fwd,.38);_k.y+=.1;
  const setLit=cig.userData.setLit as (k: number)=>void;
  let toMouth: number;
  if(phase==='intro'){
    // 0.5-1.3 up to the lips · 1.3-2.7 the lighter · 2.7-3.6 the drag · 3.6-4.6 blow the
    // smoke out · 4.6-5.6 the hand comes down to the knee
    toMouth=ease(seg(pt,.5,1.3))*(1-ease(seg(pt,3.5,4.1)))+ease(seg(pt,3.5,4.1))*(1-ease(seg(pt,4.6,5.6)))*.45;
    // the lighter: up under the tip, the flame, back down
    const lup=ease(seg(pt,1.3,1.9))*(1-ease(seg(pt,2.5,3.1)));
    lighter!.visible=lup>.02;
    (lighter!.userData.flame as THREE.Object3D).visible=pt>1.85&&pt<2.55;
    if(lup>.02){
      cig.localToWorld(_t.copy(cig.userData.tip as THREE.Vector3));
      _t.y-=.07;                                               // just under the tip
      l.leftLeg.getWorldPosition(_h).addScaledVector(fwd,.38);_h.y+=.1;
      reachHand(player.g,'left',_h.lerp(_t,lup));
    }else{l.leftArm.rotation.set(-.35,0,.12);l.leftForearm.rotation.set(-.9,0,0);}
    lit=pt<2.1?0:pt<3.5?Math.min(1,(pt-2.1)*1.5):.4;
    setLit(lit);
    // the smoke blown out of the mouth after the drag
    if(pt>3.7&&pt<4.7&&Math.random()<.5)
      puff(_m.clone().addScaledVector(fwd,.08),fwd.clone().multiplyScalar(.55).add(V((Math.random()-.5)*.2,.18,(Math.random()-.5)*.2)),.05,2.2);
  }else{
    // the lines: the cigarette rests at the knee; a small gesture while he talks
    if(talking==='player')setTalkPose(player.g,t,true,false);
    else setTalkPose(player.g,t,false,false);
    toMouth=talking==='player'?.12+Math.max(0,Math.sin(t*1.8))*.12:0;
    setLit(.4+Math.sin(t*2)*.05);
    lighter!.visible=false;                                    // (the opening may have been skipped mid-light)
    l.leftArm.rotation.set(-.35,0,.12);l.leftForearm.rotation.set(-.9,0,0);
  }
  reachHand(player.g,'right',_t.copy(_k).lerp(_m.clone().addScaledVector(fwd,.07),toMouth));
  if(pt>2.1||phase!=='intro')smokeFromTip(1/60);
}

function smokeFromTip(dt: number){
  if(!cig)return;
  wispT-=dt;
  if(wispT>0)return;
  wispT=.28;
  cig.localToWorld(_h.copy(cig.userData.tip as THREE.Vector3));
  puff(_h.clone(),V((Math.random()-.5)*.05,.25,(Math.random()-.5)*.05),.025,2.4);
}

export function updateSummitFx(dt: number){
  for(let i=puffs.length-1;i>=0;i--){
    const p=puffs[i];p.t+=dt;
    p.m.position.addScaledVector(p.v,dt);p.v.multiplyScalar(1-dt*.8);p.v.y+=dt*.05;
    const k=p.t/p.life;
    p.m.scale.setScalar(p.s0*(1+k*5));
    (p.m.material as THREE.MeshBasicMaterial).opacity=.45*(1-k);
    if(k>=1){scene.remove(p.m);pool.push(p.m);puffs.splice(i,1);}
  }
}
