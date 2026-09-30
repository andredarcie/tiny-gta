import * as THREE from 'three';
import {camera,scene} from '@/core/engine.ts';
import {state,input,refs} from '@/core/state.ts';
import {groundHeight} from '@/core/constants.ts';
import {cameraRig,player,isFirstPerson} from '@/actors/player.ts';
import {setHose,splash,thud} from '@/audio/audio.ts';
import {makeFpHands} from '../../assets/models/characters/fp-hands.ts';
import {makeWaterStream} from '../../assets/models/rural/water-stream.ts';
import {makeSeed,makeSeedPinch} from '../../assets/models/rural/weed-seed.ts';
import {makeSoilClod} from '../../assets/models/rural/weed-harvest.ts';
import {makeWaterDrop} from '../../assets/models/rural/weed-farm.ts';

// ============================================================================
// GREEN ACRES in FIRST PERSON — the hands, the things they hold and every farm
// animation, seen through the player's eyes (js/activities/weed-farm.ts decides WHAT
// happens; this module shows it):
//
//   • CARRY   — the bucket hangs from the right fist by its bail (look down into it and
//               you see the water level); a pulled plant is held upright by the stem.
//               Both sway with DOOM's weapon bob while walking.
//   • ACTIONS — short keyframed clips: reach → grab → lift; dock under the faucet → fill;
//               raise → tip → pour; pinch → flick → pat; grip → uproot → carry;
//               carry → lower → release. While one plays the view gently turns to FOCUS
//               on the hands' work, the player steps in/out to a working distance, and
//               movement/look input is held so the clip reads cleanly; afterwards the
//               view eases back up.
//
// Arms: the same box hands as the weapon viewmodel, but each forearm is AIMED from the
// hand toward an "elbow" anchor off the lower screen corner and its sleeve is stretched to
// reach it — so wherever the hand goes (a faucet, a bed, a crate) it stays visible, with
// the arm coming in from the edge of the screen like any FPS viewmodel. While the hands
// are busy the weapon viewmodel is hidden and firing is blocked (refs.farmHandsActive,
// read by js/combat/weapons.ts).
// ============================================================================

export type HeldKind='none'|'bucket'|'plant'|'shears';

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp01=(v: number)=>v<0?0:v>1?1:v;
const seg=(t: number,a: number,b: number)=>clamp01((t-a)/(b-a));
const ease=(t: number)=>t*t*(3-2*t);
const easeOut=(t: number)=>1-(1-t)*(1-t)*(1-t);
const lerp=(a: number,b: number,t: number)=>a+(b-a)*t;
const lerpV=(a: THREE.Vector3,b: THREE.Vector3,t: number)=>a.clone().lerp(b,t);

// ---------- the rig: a box-hands pair parented to the camera ----------
const rig=new THREE.Group();
rig.name='farm-fp-rig';
rig.visible=false;
camera.add(rig);
const hands=makeFpHands({sleeve:0x19e3ff});   // same cyan sleeves as the weapon viewmodel
rig.add(hands);
interface Arm{g: THREE.Group;hand: THREE.Object3D;sleeve: THREE.Mesh;anchor: THREE.Vector3;side: number;}
function armOf(g: THREE.Group,side: number): Arm{
  let sleeve: THREE.Mesh|null=null,hand: THREE.Object3D|null=null;
  for(const c of g.children){
    const m=c as THREE.Mesh;
    if(m.isMesh&&(m.geometry as THREE.BoxGeometry).parameters?.height===.3)sleeve=m;
    else hand=c;
  }
  // "elbow" anchors just past the lower screen corners, a little behind the camera plane
  sleeve!.scale.x=sleeve!.scale.z=.78;          // a touch slimmer than the gun arms (they fill more of the view)
  return{g,hand:hand!,sleeve:sleeve!,anchor:V(side*.44,-.7,-.02),side};
}
const R=armOf(hands.userData.right as THREE.Group,1), L=armOf(hands.userData.left as THREE.Group,-1);
const FIST=V(0,.015,-.03);                    // fist centre in arm space (wrist = origin)
const REST_R=V(.36,-.66,-.3), REST_L=V(-.36,-.66,-.3); // hands tucked below the view
R.g.visible=L.g.visible=false;                 // each clip shows only the hands it uses

const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_v=new THREE.Vector3(),_d=new THREE.Vector3(),_e=new THREE.Euler();
const DOWN=V(0,-1,0);
// Put an arm with its FIST exactly on `grip` (rig space): the forearm points from the
// hand to the arm's elbow anchor, the sleeve stretches to reach it, `roll` twists the arm
// about its own axis and `flick` bends the wrist (hand pitch).
function placeArm(a: Arm,grip: THREE.Vector3,roll=0,flick=0): void{
  a.g.visible=true;
  _d.subVectors(a.anchor,grip);
  const len=_d.length();
  _d.normalize();
  _q.setFromUnitVectors(DOWN,_d);
  _q2.setFromAxisAngle(_d,roll*a.side);
  a.g.quaternion.copy(_q2).multiply(_q);
  _v.copy(FIST).applyQuaternion(a.g.quaternion);
  a.g.position.copy(grip).sub(_v);
  const sl=Math.max(.3,len+.05);
  a.sleeve.scale.y=sl/.3;a.sleeve.position.y=-.04-sl/2;
  a.hand.rotation.x=flick;
}
const toRig=(w: THREE.Vector3,out=new THREE.Vector3())=>rig.worldToLocal(out.copy(w));

// ---------- carry poses (rig space) ----------
interface Pose{pos: THREE.Vector3;quat: THREE.Quaternion;scale: number;}
type Carried=Exclude<HeldKind,'none'>;
const CARRY: Record<Carried,{pos:[number,number,number];rot:[number,number,number];scale:number}>={
  bucket:{pos:[.2,-.13,-.48],rot:[.12,-.35,0],scale:.5},
  plant:{pos:[.19,-.37,-.55],rot:[-.12,.4,-.1],scale:.36},
  shears:{pos:[.17,-.19,-.42],rot:[-.55,.35,.35],scale:1},    // blades up and forward, ready to snip
};
const VM_SWAY=2*Math.PI*35*128/8192;            // DOOM's weapon-bob phase speed (as the guns)
let vmMove=0;
function carryPose(kind: Carried,out: Pose): Pose{
  const c=CARRY[kind];
  const ph=state.time*VM_SWAY;
  const bx=Math.cos(ph)*.045*vmMove, by=-Math.abs(Math.sin(ph))*.03*vmMove+Math.sin(state.time*1.6)*.004*(1-vmMove);
  out.pos.set(c.pos[0]+bx,c.pos[1]+by,c.pos[2]);
  // the bucket swings like a pendulum on its bail; the plant nods
  const swing=kind==='bucket'?Math.sin(ph)*.14*vmMove:Math.sin(ph)*.05*vmMove;
  _e.set(c.rot[0]+(kind==='plant'?Math.abs(Math.sin(ph))*.05*vmMove:0),c.rot[1],c.rot[2]+swing);
  out.quat.setFromEuler(_e);
  out.scale=c.scale;
  return out;
}
const newPose=(): Pose=>({pos:V(),quat:new THREE.Quaternion(),scale:1});
function capture(o: THREE.Object3D): Pose{return{pos:o.position.clone(),quat:o.quaternion.clone(),scale:o.scale.x};}
function applyBlend(o: THREE.Object3D,a: Pose,b: Pose,k: number): void{
  o.position.lerpVectors(a.pos,b.pos,k);
  o.quaternion.slerpQuaternions(a.quat,b.quat,k);
  o.scale.setScalar(lerp(a.scale,b.scale,k));
}
// A world placement expressed in rig space (so a held object can "dock" onto it).
function worldToRigPose(pos: THREE.Vector3,quat: THREE.Quaternion,scale: number,out: Pose): Pose{
  toRig(pos,out.pos);
  rig.getWorldQuaternion(_q);
  out.quat.copy(_q).invert().multiply(quat);
  out.scale=scale;
  return out;
}
// Where a hand holds an object, in rig space (bucket: the bail top = origin; plant: its grip).
const _gp=new THREE.Vector3();
function gripInRig(o: THREE.Object3D,out=new THREE.Vector3()): THREE.Vector3{
  o.updateMatrixWorld(true);
  const g=o.userData.grip as THREE.Object3D|undefined;
  out.copy(g?g.position:_gp.set(0,0,0)).applyMatrix4(o.matrixWorld);
  return toRig(out,out);
}
const yawQuat=(yaw: number)=>new THREE.Quaternion().setFromAxisAngle(V(0,1,0),yaw);

// ---------- world particles (water drops, seeds, soil clods, a tossed plant) ----------
interface Particle{m: THREE.Object3D;v: THREE.Vector3;floor: number;life: number;spin?: THREE.Vector3;onLand?: ()=>void;keep?: boolean;}
const parts: Particle[]=[];
function spawn(m: THREE.Object3D,from: THREE.Vector3,v: THREE.Vector3,floor: number,opts: Partial<Particle>={}): void{
  m.position.copy(from);scene.add(m);
  parts.push({m,v,floor,life:opts.life??3,spin:opts.spin,onLand:opts.onLand});
}
// Launch velocity that lands a particle on `to` after `tFlight` seconds (gravity 9).
function ballistic(from: THREE.Vector3,to: THREE.Vector3,tFlight: number): THREE.Vector3{
  return V((to.x-from.x)/tFlight,(to.y-from.y)/tFlight+4.5*tFlight,(to.z-from.z)/tFlight);
}
function updateParticles(dt: number): void{
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];
    p.life-=dt;p.v.y-=9*dt;
    p.m.position.addScaledVector(p.v,dt);
    if(p.spin){p.m.rotation.x+=p.spin.x*dt;p.m.rotation.y+=p.spin.y*dt;p.m.rotation.z+=p.spin.z*dt;}
    if((p.m.position.y<=p.floor&&(!p.keep||p.v.y<0))||p.life<=0){ // kept pieces land only on the way down
      if(p.keep)p.m.position.y=Math.max(p.m.position.y,p.floor);
      p.onLand?.();
      if(!p.keep)scene.remove(p.m);
      parts.splice(i,1);
    }
  }
}
/** Throw a piece off (a cut fan leaf, a bare stem): it tumbles to the ground and is gone. */
export function tossPiece(o: THREE.Object3D,v: THREE.Vector3,spin=new THREE.Vector3(5,2,6)): void{
  scene.attach(o);
  const w=o.getWorldPosition(new THREE.Vector3());
  parts.push({m:o,v,floor:groundHeight(w.x,w.z)-.05,life:2,spin});
}
/** Fly a piece in an arc onto a world point and KEEP it there (a bud into the tray/crate). */
export function flyTo(o: THREE.Object3D,to: THREE.Vector3,tFlight: number,onLand?: ()=>void): void{
  scene.attach(o);
  const w=o.getWorldPosition(new THREE.Vector3());
  parts.push({m:o,v:ballistic(w,to,tFlight),floor:to.y,life:tFlight+.5,spin:V(3,4,2),keep:true,onLand});
}
/** Soil clods kicked up around a world point (planting pat, uprooting). */
export function soilBurst(at: THREE.Vector3,n=8,power=1): void{
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,s=(.6+Math.random()*.9)*power;
    spawn(makeSoilClod(),V(at.x,at.y+.04,at.z),V(Math.cos(a)*s,1.2+Math.random()*1.6*power,Math.sin(a)*s),at.y-.02,{life:1.5});
  }
}
function waterSplash(at: THREE.Vector3,n=5): void{
  for(let i=0;i<n;i++){
    const d=makeWaterDrop();d.scale.setScalar(.45);
    const a=Math.random()*Math.PI*2,s=.4+Math.random()*.7;
    spawn(d,V(at.x,at.y+.02,at.z),V(Math.cos(a)*s,.8+Math.random()*1.1,Math.sin(a)*s),at.y-.05,{life:1});
  }
}

// ---------- held state ----------
let held: HeldKind='none';
let heldObj: THREE.Object3D|null=null;
export const fpHeld=(): HeldKind=>held;
export const fpHeldObject=(): THREE.Object3D|null=>heldObj;
export function setHeld(kind: HeldKind,obj: THREE.Object3D|null): void{held=kind;heldObj=obj;}

// ---------- action player ----------
interface Action{
  dur: number;
  focus?: ()=>THREE.Vector3|null;              // world point the view turns to
  step?: {at: ()=>THREE.Vector3;dist: number}; // move to this horizontal distance from `at`
  update: (t: number,dt: number)=>void;
  done?: ()=>void;
  t: number;
  fired: Set<string>;
  pitch0: number;
}
const queue: Action[]=[];
let cur: Action|null=null;
function play(a: Omit<Action,'t'|'fired'|'pitch0'>): void{queue.push({...a,t:0,fired:new Set(),pitch0:0});}
function once(key: string,when: boolean,fn: ()=>void): void{
  if(cur&&when&&!cur.fired.has(key)){cur.fired.add(key);fn();}
}
export const fpBusy=()=>!!cur||queue.length>0;
// the idle carry of whatever the right hand holds (used while the left hand works)
function keepCarry(): void{
  if(!heldObj||held==='none')return;
  const p=carryPose(held,newPose());
  heldObj.position.copy(p.pos);heldObj.quaternion.copy(p.quat);heldObj.scale.setScalar(p.scale);
  placeArm(R,gripInRig(heldObj));
}

// ===================== the clips =====================

/** Reach for a world object (the bucket, a dropped or cured plant) and bring it to the carry pose. */
export function fpPickUp(obj: THREE.Object3D,kind: Carried,cb: {onGrab?: ()=>void;onDone?: ()=>void}={}): void{
  let from: Pose|null=null;const to=newPose();
  play({dur:1.3,
    focus:()=>{const w=obj.getWorldPosition(V());w.y+=.15;return from?null:w;},
    step:{at:()=>obj.getWorldPosition(V()),dist:.8},
    update:(t)=>{
      if(!from){
        const k=ease(seg(t,.08,.55));
        placeArm(R,lerpV(REST_R,gripInRig(obj),k),.3*k,-.5*k);
      }
      once('grab',t>=.55,()=>{
        rig.attach(obj);from=capture(obj);setHeld(kind,obj);
        thud(2);cb.onGrab?.();
      });
      if(from){
        const k=ease(seg(t,.55,1.3));
        applyBlend(obj,from,carryPose(kind,to),k);
        placeArm(R,gripInRig(obj),.3*(1-k),-.5*(1-k));
      }
    },
    done:cb.onDone});
}

/** Carry the held object to a world placement and let go (crate, rack hook, the ground). */
export function fpPlace(target: {pos: THREE.Vector3;quat: THREE.Quaternion;scale: number},
  cb: {focus?: THREE.Vector3;hover?: number;stepDist?: number;onRelease?: (o: THREE.Object3D)=>void;onDone?: ()=>void}={}): void{
  const obj=heldObj;if(!obj)return;
  let from: Pose|null=null;const dock=newPose();
  const hoverPos=target.pos.clone();hoverPos.y+=cb.hover??.3;
  let released=false;const lift=V();
  play({dur:1.75,
    focus:()=>cb.focus??target.pos,
    step:cb.stepDist?{at:()=>target.pos,dist:cb.stepDist}:undefined,
    update:(t)=>{
      if(!from)from=capture(obj);
      if(!released){
        const k=ease(seg(t,.05,.95)), down=ease(seg(t,.95,1.2));
        const p=hoverPos.clone().lerp(target.pos,down);
        worldToRigPose(p,target.quat,target.scale,dock);
        applyBlend(obj,from,dock,k);
        placeArm(R,gripInRig(obj),.2*k);
      }
      once('release',t>=1.2,()=>{
        scene.attach(obj);
        obj.position.copy(target.pos);obj.quaternion.copy(target.quat);obj.scale.setScalar(target.scale);
        released=true;setHeld('none',null);thud(3);
        lift.copy(gripInRig(obj));
        cb.onRelease?.(obj);
      });
      if(released){
        const k=ease(seg(t,1.2,1.75));
        const g=lift.clone();g.y+=.07*Math.min(1,k*3);        // the open hand lifts off...
        placeArm(R,lerpV(g,REST_R,k),.2*(1-k),.4*Math.min(1,k*3)*(1-k)); // ...and drops away
      }
    },
    done:cb.onDone});
}

/** Hold the bucket under the faucet: the tap runs and the water visibly rises. */
export function fpFill(spout: THREE.Vector3,from: number,to: number,cb: {onDone?: ()=>void}={}): void{
  const obj=heldObj;if(!obj||held!=='bucket')return;
  const stream=makeWaterStream();stream.visible=false;scene.add(stream);
  const carry=newPose(),dock=newPose();
  const dockPos=V(spout.x,spout.y-.24,spout.z);
  const setWater=obj.userData.setWater as (f: number)=>void;
  const surf=new THREE.Vector3();
  play({dur:2.5,
    focus:()=>V(spout.x,spout.y-.28,spout.z),
    step:{at:()=>spout,dist:.72},
    update:(t)=>{
      const w=ease(seg(t,0,.6))*(1-ease(seg(t,2.0,2.5)));
      worldToRigPose(dockPos,yawQuat(cameraRig.yaw+Math.PI),1,dock);
      applyBlend(obj,carryPose('bucket',carry),dock,w);
      placeArm(R,gripInRig(obj),.25*w);
      const running=t>=.6&&t<1.95;
      const f=lerp(from,to,ease(seg(t,.7,1.9)));
      setWater(f);
      stream.visible=running;
      if(running){
        (obj.userData.waterMesh as THREE.Object3D).getWorldPosition(surf);
        if(f<.03){obj.getWorldPosition(surf);surf.y-=.24;}
        stream.userData.span(spout,surf,.022+.006*Math.sin(t*40));
        if(Math.random()<.35)waterSplash(surf,1);
      }
      once('on',running,()=>setHose(true));
      once('off',t>=1.95,()=>{setHose(false);splash(.4);});
    },
    done:()=>{scene.remove(stream);setHose(false);cb.onDone?.();}});
}

// The lowest point of a (tipped) bucket's rim in world space — where the water spills out.
const _rp=new THREE.Vector3();
function lowestRim(b: THREE.Object3D,out: THREE.Vector3): THREE.Vector3{
  const rim=b.userData.rim as {r:number;y:number};
  b.updateMatrixWorld(true);
  let best=Infinity;
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    b.localToWorld(_rp.set(Math.cos(a)*rim.r,rim.y,Math.sin(a)*rim.r));
    if(_rp.y<best){best=_rp.y;out.copy(_rp);}
  }
  return out;
}

/** Raise the bucket, tip it and pour it onto the bed; the water arcs down and lands on `soil`. */
export function fpPour(soil: THREE.Vector3,from: number,to: number,
  cb: {onProgress?: (p: number)=>void;onDone?: ()=>void;pourTime?: number}={}): void{
  const obj=heldObj;if(!obj||held!=='bucket')return;
  const T=Math.max(.8,cb.pourTime??1.1);
  const t0=.65,t1=t0+T,dur=t1+.65;
  const lipStream=makeWaterStream();lipStream.visible=false;scene.add(lipStream);
  const carry=newPose(),pour=newPose();
  const setWater=obj.userData.setWater as (f: number)=>void;
  const waterMesh=obj.userData.waterMesh as THREE.Object3D;
  const lipW=new THREE.Vector3(),lipEnd=new THREE.Vector3();
  let emit=0,landed=0;
  play({dur,
    focus:()=>V(soil.x,soil.y+.3,soil.z),
    step:{at:()=>soil,dist:1.25},
    update:(t,dt)=>{
      // raise it out in front, tip it forward ~110° (held by the bail + the left hand under
      // the base), hold the pour, then swing it back down to the carry
      const up=ease(seg(t,0,t0))*(1-ease(seg(t,t1,dur)));
      const tilt=easeOut(seg(t,.2,t0))*(1-ease(seg(t,t1,dur)));
      carryPose('bucket',carry);
      // tipped sideways (to the left) and a little forward: you see its side and the water
      // spilling off the low rim, arcing down onto the bed
      pour.pos.set(.17,-.05+Math.sin(t*9)*.004*tilt,-.6);
      _e.set(-.4*tilt,-.25,1.8*tilt);pour.quat.setFromEuler(_e);pour.scale=.58;
      applyBlend(obj,carry,pour,up);
      placeArm(R,gripInRig(obj),.35*up,-.3*up);
      const pouring=t>=t0&&t<t1;
      const p=seg(t,t0,t1);
      setWater(lerp(from,to,p));
      if(tilt>.35)waterMesh.visible=false;       // the surface would be tipped with the bucket
      lipStream.visible=pouring;
      if(pouring){
        lowestRim(obj,lipW);
        lipEnd.copy(lipW);lipEnd.y-=.2;
        lipStream.userData.span(lipW,lipEnd,.034+.008*Math.sin(t*30));
        // a dense ballistic stream of drops landing ON the soil (reads as a pour)
        emit+=dt*75;
        while(emit>=1){
          emit-=1;
          const d=makeWaterDrop();d.scale.setScalar(.5+Math.random()*.4);
          const tgt=V(soil.x+(Math.random()-.5)*.4,soil.y,soil.z+(Math.random()-.5)*.4);
          spawn(d,lipEnd.clone(),ballistic(lipEnd,tgt,.3+Math.random()*.1),soil.y-.02,{life:1.2,
            onLand:()=>{landed++;if(landed%6===0)waterSplash(tgt,2);}});
        }
        cb.onProgress?.(p);
      }
      once('on',pouring,()=>setHose(true));
      once('off',t>=t1,()=>{setHose(false);splash(.5);cb.onProgress?.(1);});
    },
    done:()=>{scene.remove(lipStream);setHose(false);cb.onDone?.();}});
}

/** Pinch seeds (or plant food), flick them into the soil and pat it down. */
export function fpSow(soil: THREE.Vector3,food: boolean,cb: {onLand?: ()=>void;onDone?: ()=>void}={}): void{
  const useLeft=held==='bucket';                 // the bucket stays in the right hand
  const arm=useLeft?L:R;
  const rest=useLeft?REST_L:REST_R;
  const pinch=makeSeedPinch(food,food?4:3);
  pinch.position.set(0,-.01,-.07);pinch.scale.setScalar(1.3);
  const soilRig=new THREE.Vector3(),reach=new THREE.Vector3(),pat=new THREE.Vector3();
  let released=false;
  play({dur:2.0,
    focus:()=>V(soil.x,soil.y+.22,soil.z),
    step:{at:()=>soil,dist:.95},
    update:(t)=>{
      keepCarry();
      if(!pinch.parent&&!released)arm.hand.add(pinch);
      toRig(soil,soilRig);
      // the hand works a little short of the soil, toward the view centre
      reach.copy(soilRig).multiplyScalar(.52);reach.x+=arm.side*.04;reach.y+=.05;
      let g: THREE.Vector3,flick: number,roll: number;
      if(t<.55){
        const k=ease(seg(t,.05,.55));
        g=lerpV(rest,reach,k);roll=.5*k;flick=-.3*k;
      }else if(t<.9){
        // the flick: the wrist snaps down twice, spilling the seeds
        const f=Math.sin(seg(t,.55,.9)*Math.PI*2);
        g=reach.clone();g.y+=.02*f;roll=.5;flick=-.3+.75*Math.max(0,f);
      }else if(t<1.4){
        // pat the soil: dip toward the bed and back
        const d=Math.sin(seg(t,.9,1.4)*Math.PI);
        pat.copy(reach).lerp(soilRig,.22*d);
        g=pat;roll=.5;flick=-.3+.9*d;
      }else{
        const k=ease(seg(t,1.4,2.0));
        g=lerpV(reach,rest,k);roll=.5*(1-k);flick=-.3*(1-k);
      }
      placeArm(arm,g,roll,flick);
      once('drop',t>=.66,()=>{
        released=true;
        const w=new THREE.Vector3();
        for(const s of [...pinch.children]){
          s.getWorldPosition(w);
          const tgt=V(soil.x+(Math.random()-.5)*.14,soil.y,soil.z+(Math.random()-.5)*.14);
          spawn(makeSeed(food),w.clone(),ballistic(w,tgt,.32),soil.y-.01,{life:1.5,spin:V(8,5,3)});
        }
        pinch.parent?.remove(pinch);
      });
      once('land',t>=1.12,()=>{soilBurst(soil,6,.55);cb.onLand?.();thud(1.2);});
    },
    done:()=>{pinch.parent?.remove(pinch);if(useLeft)L.g.visible=false;cb.onDone?.();}});
}

/** Grip a bed plant with both hands and pull it out, roots and all. `toss` throws it
 *  away (clearing a dead plant); otherwise it ends up held upright in the right hand. */
export function fpUproot(plant: THREE.Object3D,cb: {toss?: boolean;onPull?: ()=>void;onUprooted?: ()=>void;onDone?: ()=>void}={}): void{
  const base0=plant.position.clone();
  let from: Pose|null=null;const carry=newPose();
  let tossed=false;const lastR=V(),lastL=V();
  play({dur:cb.toss?2.0:2.4,
    focus:()=>from||tossed?null:V(base0.x,base0.y+.5,base0.z),
    step:{at:()=>base0,dist:.8},
    update:(t)=>{
      // pull: the plant rises out of the soil, shaking as the roots let go
      if(!from&&!tossed){
        const pull=easeOut(seg(t,.8,1.35));
        const shake=t>.66&&t<1.35?Math.sin(t*55)*.06*(1-pull*.7):0;
        plant.position.set(base0.x,base0.y+pull*.36,base0.z);
        plant.rotation.z=shake;
        plant.updateMatrixWorld(true);
        const k=ease(seg(t,.05,.62));
        const squeeze=seg(t,.62,.74)*.015;
        const gr=toRig(plant.localToWorld(V(0,.5,0))),gl=toRig(plant.localToWorld(V(0,.32,0)));
        gr.x-=squeeze;gl.x+=squeeze;
        placeArm(R,lerpV(REST_R,gr,k),.6*k,-.2*k);
        placeArm(L,lerpV(REST_L,gl,k),.6*k,-.2*k);
        lastR.copy(gr);lastL.copy(gl);
      }
      once('pull',t>=.8,()=>{soilBurst(base0,12,1);thud(4);cb.onPull?.();});
      once('up',t>=1.35,()=>{
        if(cb.toss){
          tossed=true;
          scene.attach(plant);
          const side=cameraRig.yaw+1.3;
          const w=plant.getWorldPosition(V());
          parts.push({m:plant,v:V(Math.sin(side)*3.2,3.4,Math.cos(side)*3.2),floor:groundHeight(w.x,w.z)-.4,life:1.4,spin:V(4,1,6)});
        }else{
          rig.attach(plant);from=capture(plant);setHeld('plant',plant);
        }
        cb.onUprooted?.();
      });
      if(from){
        const k=ease(seg(t,1.35,2.4));
        applyBlend(plant,from,carryPose('plant',carry),k);
        placeArm(R,gripInRig(plant),.6*(1-k),-.2*(1-k));
        placeArm(L,lerpV(lastL,REST_L,k),.6*(1-k));
      }else if(tossed){
        const k=ease(seg(t,1.35,2.0));
        placeArm(R,lerpV(lastR,REST_R,k),.6*(1-k),.5*(1-k));
        placeArm(L,lerpV(lastL,REST_L,k),.6*(1-k),.5*(1-k));
      }
    },
    done:()=>{L.g.visible=false;cb.onDone?.();}});
}

/** One cut with the trimming shears: the left hand pins the stem at `hold`, the shears
 *  open, reach the leaf/bud at `target` and snap shut (onCut), then come back. */
export function fpSnip(target: ()=>THREE.Vector3,hold: ()=>THREE.Vector3,cb: {onCut?: ()=>void;onDone?: ()=>void}={}): void{
  const obj=heldObj;if(!obj||held!=='shears')return;
  const setOpen=obj.userData.setOpen as (k: number)=>void;
  const tip=(obj.userData.tip as THREE.Object3D).position;
  const carry=newPose(),at=newPose(),tipOff=new THREE.Vector3(),tRig=new THREE.Vector3();
  let aim: THREE.Vector3|null=null;                 // the target, frozen when the clip starts
  play({dur:.78,
    focus:()=>aim,
    update:(t)=>{
      if(!aim)aim=target().clone();
      const reach=ease(seg(t,0,.3))*(1-ease(seg(t,.46,.78)));
      carryPose('shears',carry);
      // shears pose that puts the blade tip on the target (keeping the carry orientation)
      toRig(aim,tRig);
      at.quat.copy(carry.quat);at.scale=carry.scale;
      tipOff.copy(tip).multiplyScalar(at.scale).applyQuaternion(at.quat);
      at.pos.copy(tRig).sub(tipOff);
      applyBlend(obj,carry,at,reach);
      placeArm(R,gripInRig(obj),.3*reach);
      // blades: open on the way in, snap shut on the stem
      setOpen(t<.3?seg(t,.05,.3):t<.4?1-seg(t,.34,.4):0);
      // the free hand pins the stem while the shears work
      const pin=ease(seg(t,0,.25))*(1-ease(seg(t,.5,.78)));
      if(pin>.02)placeArm(L,lerpV(REST_L,toRig(hold()),pin),.5*pin,-.3*pin);else L.g.visible=false;
      once('cut',t>=.4,()=>{thud(.6);cb.onCut?.();});
    },
    done:()=>{setOpen(0);L.g.visible=false;cb.onDone?.();}});
}

/** Lift the trim tray off the table, carry it over the crate, tip it (onTip — the buds
 *  pour out) and set it back where it was. */
export function fpTipTray(tray: THREE.Object3D,over: THREE.Vector3,cb: {onTip?: ()=>void;onDone?: ()=>void}={}): void{
  const home={pos:tray.position.clone(),quat:tray.quaternion.clone()};
  let from: Pose|null=null;const dock=newPose();
  const yaw=yawQuat(cameraRig.yaw);
  let back=false;
  play({dur:2.5,
    focus:()=>back?home.pos:(from?over:home.pos),
    step:{at:()=>over,dist:1.1},
    update:(t)=>{
      if(!from){
        const k=ease(seg(t,.05,.45));
        placeArm(R,lerpV(REST_R,gripInRig(tray),k),.3*k,-.4*k);
      }
      once('grab',t>=.45,()=>{rig.attach(tray);from=capture(tray);thud(1.5);});
      if(from&&!back){
        // carry it over the crate, then tip it forward to pour
        const k=ease(seg(t,.45,1.2)), tip=easeOut(seg(t,1.2,1.55))*(1-ease(seg(t,1.75,2.05)));
        const q=yaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),1.45*tip));
        worldToRigPose(V(over.x,over.y+.42,over.z),q,1,dock);
        applyBlend(tray,from,dock,k);
        placeArm(R,gripInRig(tray),.3,-.4);
      }
      once('tip',t>=1.4,()=>{cb.onTip?.();splash(.15);});
      once('back',t>=2.05,()=>{back=true;from=capture(tray);});
      if(back&&from){
        const k=ease(seg(t,2.05,2.45));
        worldToRigPose(home.pos,home.quat,1,dock);
        applyBlend(tray,from,dock,k);
        placeArm(R,gripInRig(tray),.3,-.4);
      }
      once('release',t>=2.45,()=>{scene.attach(tray);tray.position.copy(home.pos);tray.quaternion.copy(home.quat);thud(1.5);});
    },
    done:()=>{if(tray.parent!==scene){scene.attach(tray);tray.position.copy(home.pos);tray.quaternion.copy(home.quat);}R.g.visible=false;cb.onDone?.();}});
}

// ===================== per-frame =====================
const _eye=new THREE.Vector3();
const angDiff=(a: number,b: number)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
let settle=0,settlePitch=0;   // after a clip the view eases back up toward where it was

/** BEFORE the camera update: start queued clips, step in and turn the view to focus. */
export function updateFarmFocus(dt: number): void{
  if(!cur&&queue.length){
    cur=queue.shift()!;
    cur.pitch0=settle>0?settlePitch:cameraRig.fpPitch;
    L.g.visible=false;
  }
  if(!cur){
    if(settle>0){
      settle=Math.max(0,settle-dt);
      cameraRig.fpPitch+=(settlePitch-cameraRig.fpPitch)*(1-Math.exp(-5*dt));
    }
    return;
  }
  if(state.mode!=='foot'){abortActions();return;}
  const a=cur;
  // step in/out to the working distance (short and eased)
  if(a.step&&a.t<.45){
    const tp=a.step.at(),p=player.g.position;
    const dx=p.x-tp.x,dz=p.z-tp.z,d=Math.hypot(dx,dz);
    if(Math.abs(d-a.step.dist)>.06&&d>1e-3){
      const want=a.step.dist/d;
      const k=1-Math.exp(-9*dt);
      p.x+=(tp.x+dx*want-p.x)*k;p.z+=(tp.z+dz*want-p.z)*k;
      p.y=groundHeight(p.x,p.z);
    }
  }
  const f=a.focus?.();
  if(f&&a.t<a.dur*.8){
    _eye.copy(camera.position);
    const yaw=Math.atan2(f.x-_eye.x,f.z-_eye.z);
    const pitch=Math.atan2(_eye.y-f.y,Math.hypot(f.x-_eye.x,f.z-_eye.z));
    const k=1-Math.exp(-6*dt);
    cameraRig.yaw+=angDiff(cameraRig.yaw,yaw)*k;
    cameraRig.fpPitch+=(Math.max(-1.1,Math.min(1.1,pitch))-cameraRig.fpPitch)*k;
    player.heading=cameraRig.yaw;
  }
}

/** AFTER the camera update: pose the hands/held object in view space, run the clip. */
export function updateFarmView(dt: number): void{
  const fp=isFirstPerson()&&state.mode==='foot';
  const moving=!!(input.moveX||input.moveY)&&!cur;
  vmMove+=((moving?1:0)-vmMove)*Math.min(1,dt*6);
  updateParticles(dt);
  rig.visible=fp&&(held!=='none'||!!cur);
  if(!rig.visible)return;
  camera.updateMatrixWorld(true);
  if(cur){
    cur.t+=dt;
    cur.update(Math.min(cur.t,cur.dur),dt);
    if(cur.t>=cur.dur){
      const a=cur;cur=null;
      // ease the view back up to a comfortable look once the hands are done
      settle=.8;settlePitch=Math.min(a.pitch0,.32);
      a.done?.();
    }
    return;
  }
  // idle carry
  L.g.visible=false;
  if(heldObj&&held!=='none')keepCarry();
  else R.g.visible=false;
}

/** Cancel everything (left foot mode mid-clip): drop streams/sound, keep what's held. */
export function abortActions(): void{
  queue.length=0;
  if(cur){const a=cur;cur=null;setHose(false);a.done?.();}
  L.g.visible=false;
}

// While the hands are busy (holding or animating) the weapon viewmodel hides and the
// player can't fire; while a clip plays, movement and look input are held.
refs.farmHandsActive=()=>isFirstPerson()&&state.mode==='foot'&&(held!=='none'||fpBusy());
refs.fpActionLock=()=>!!cur;
