import * as THREE from 'three';
import {camera,scene} from '@/core/engine.ts';
import {state,refs} from '@/core/state.ts';
import {groundHeight} from '@/core/constants.ts';
import {cameraRig,player,isFirstPerson} from '@/actors/player.ts';
import {phoneClick,dirtSound,thud} from '@/audio/audio.ts';
import {makeFpHands} from '../../assets/models/characters/fp-hands.ts';
import {makeSoilClod} from '../../assets/models/rural/weed-harvest.ts';

// ============================================================================
// STORY in FIRST PERSON — the player's own hands for the story's physical beats:
//   • the PAY PHONE: reach for the receiver, lift it to the ear (the cinematic call
//     takes over from there) and, after the call, hang it back on its hook;
//   • the BURIAL: a two-handed shovel — dig strokes that throw soil onto the heap, the
//     shovel planted upright while both hands drag the body into the pit, fill strokes
//     that shovel the heap back in, and a couple of pats on the mound.
// Same technique as the weed farm hands (js/activities/weed-farm-fp.ts): box hands
// parented to the camera, each forearm aimed at an "elbow" anchor off the bottom corner
// of the screen so the hand can go anywhere; short keyframed clips queued and played
// one after another, turning the view to what the hands work on and holding input.
// ============================================================================

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp01=(v: number)=>v<0?0:v>1?1:v;
const seg=(t: number,a: number,b: number)=>clamp01((t-a)/(b-a));
const ease=(t: number)=>t*t*(3-2*t);
const lerpV=(a: THREE.Vector3,b: THREE.Vector3,t: number)=>a.clone().lerp(b,t);

// ---------- the rig ----------
const rig=new THREE.Group();
rig.name='story-fp-rig';rig.visible=false;
camera.add(rig);
const hands=makeFpHands({sleeve:0x19e3ff});
rig.add(hands);
interface Arm{g: THREE.Group;hand: THREE.Object3D;sleeve: THREE.Mesh;anchor: THREE.Vector3;side: number;}
function armOf(g: THREE.Group,side: number): Arm{
  let sleeve: THREE.Mesh|null=null,hand: THREE.Object3D|null=null;
  for(const c of g.children){
    const m=c as THREE.Mesh;
    if(m.isMesh&&(m.geometry as THREE.BoxGeometry).parameters?.height===.3)sleeve=m;
    else hand=c;
  }
  sleeve!.scale.x=sleeve!.scale.z=.78;
  return{g,hand:hand!,sleeve:sleeve!,anchor:V(side*.44,-.7,-.02),side};
}
const R=armOf(hands.userData.right as THREE.Group,1), L=armOf(hands.userData.left as THREE.Group,-1);
const FIST=V(0,.015,-.03);
const REST_R=V(.36,-.66,-.3), REST_L=V(-.36,-.66,-.3);
R.g.visible=L.g.visible=false;

const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_v=new THREE.Vector3(),_d=new THREE.Vector3();
const DOWN=V(0,-1,0);
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

// ---------- what the hands hold ----------
export type Held='none'|'handset'|'shovel';
let held: Held='none';
let heldObj: THREE.Object3D|null=null;
export const fpHeld=(): Held=>held;

// ---------- world particles: soil clods thrown by the shovel ----------
interface Clod{m: THREE.Object3D;v: THREE.Vector3;floor: number;life: number;onLand?: ()=>void;}
const clods: Clod[]=[];
function throwClods(from: THREE.Vector3,to: THREE.Vector3,n: number,onLand?: ()=>void): void{
  for(let i=0;i<n;i++){
    const m=makeSoilClod();m.scale.setScalar(1.4+Math.random()*1.4);
    m.position.copy(from);scene.add(m);
    const tgt=V(to.x+(Math.random()-.5)*.5,to.y,to.z+(Math.random()-.5)*.5);
    const tf=.38+Math.random()*.12;
    const v=V((tgt.x-from.x)/tf,(tgt.y-from.y)/tf+4.5*tf,(tgt.z-from.z)/tf);
    clods.push({m,v,floor:tgt.y,life:tf+.4,onLand:i===0?onLand:undefined});
  }
}
function updateClods(dt: number): void{
  for(let i=clods.length-1;i>=0;i--){
    const c=clods[i];
    c.life-=dt;c.v.y-=9*dt;c.m.position.addScaledVector(c.v,dt);
    c.m.rotation.x+=dt*6;c.m.rotation.z+=dt*4;
    if((c.m.position.y<=c.floor&&c.v.y<0)||c.life<=0){c.onLand?.();scene.remove(c.m);clods.splice(i,1);}
  }
}

// ---------- the action player ----------
interface Action{
  dur: number;
  focus?: ()=>THREE.Vector3|null;              // world point the view turns to
  moveTo?: ()=>THREE.Vector3|null;             // glide the player's feet to this point
  update: (t: number,dt: number)=>void;
  done?: ()=>void;
  t: number;
  fired: Set<string>;
}
const queue: Action[]=[];
let cur: Action|null=null;
function play(a: Omit<Action,'t'|'fired'>): void{queue.push({...a,t:0,fired:new Set()});}
function once(key: string,when: boolean,fn: ()=>void): void{
  if(cur&&when&&!cur.fired.has(key)){cur.fired.add(key);fn();}
}
export const fpBusy=()=>!!cur||queue.length>0;

// ===================== the pay phone =====================
const EAR=V(-.17,-.04,-.16);                       // receiver at the (left) ear, rig space
const EAR_Q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.35,Math.PI,.3)); // cups toward the head, mouthpiece forward-down
function earPose(o: THREE.Object3D): void{
  o.position.copy(EAR);o.quaternion.copy(EAR_Q);
  const bob=Math.sin(state.time*1.7)*.004;o.position.y+=bob;
}

/** Walk into the booth, reach for the receiver, lift it off the hook to the ear. */
export function fpAnswer(handset: THREE.Object3D,stand: THREE.Vector3,cb: {onGrab?: ()=>void;onDone?: ()=>void}={}): void{
  let from: {p: THREE.Vector3;q: THREE.Quaternion}|null=null;
  const wp=V();
  play({dur:1.35,
    moveTo:()=>stand,
    focus:()=>from?null:handset.getWorldPosition(wp),
    update:(t)=>{
      if(!from){
        const k=ease(seg(t,.1,.6));
        placeArm(L,lerpV(REST_L,toRig(handset.getWorldPosition(wp)),k),.4*k,-.4*k);
      }
      once('grab',t>=.6,()=>{
        rig.attach(handset);
        from={p:handset.position.clone(),q:handset.quaternion.clone()};
        held='handset';heldObj=handset;
        phoneClick();cb.onGrab?.();
      });
      if(from){
        const k=ease(seg(t,.6,1.3));
        handset.position.lerpVectors(from.p,EAR,k);
        handset.quaternion.slerpQuaternions(from.q,EAR_Q,k);
        placeArm(L,handset.position,.4*(1-k)+.9*k,-.4*(1-k));
      }
    },
    done:cb.onDone});
}

/** Right after the call: the receiver comes off the ear and goes back on its hook. */
export function fpHangUp(handset: THREE.Object3D,hook: ()=>{pos: THREE.Vector3;quat: THREE.Quaternion},
  cb: {onRelease?: ()=>void;onDone?: ()=>void}={}): void{
  rig.attach(handset);earPose(handset);
  held='handset';heldObj=handset;
  const from={p:EAR.clone(),q:EAR_Q.clone()};
  const dock={p:V(),q:new THREE.Quaternion()};
  let released=false;const last=V();
  play({dur:1.05,
    focus:()=>released?null:hook().pos,
    update:(t)=>{
      if(!released){
        const k=ease(seg(t,0,.6));
        const h=hook();
        toRig(h.pos,dock.p);
        rig.getWorldQuaternion(_q);dock.q.copy(_q).invert().multiply(h.quat);
        handset.position.lerpVectors(from.p,dock.p,k);
        handset.quaternion.slerpQuaternions(from.q,dock.q,k);
        placeArm(L,handset.position,.9*(1-k)+.4*k,-.3*k);
        last.copy(handset.position);
      }
      once('release',t>=.62,()=>{
        released=true;held='none';heldObj=null;
        phoneClick(true);cb.onRelease?.();
      });
      if(released){
        const k=ease(seg(t,.62,1.05));
        placeArm(L,lerpV(last,REST_L,k),.4*(1-k));
      }
    },
    done:()=>{L.g.visible=false;cb.onDone?.();}});
}

// ===================== the shovel =====================
// A shovel pose = where its blade TIP is + its orientation (local +Y = the shaft from
// the tip toward the grip, local +Z = the blade face). Poses blend tip-lerp + slerp.
interface SPose{tip: THREE.Vector3;q: THREE.Quaternion;}
const newSP=(): SPose=>({tip:V(),q:new THREE.Quaternion()});
const _m=new THREE.Matrix4(),_x=new THREE.Vector3(),_y=new THREE.Vector3(),_z=new THREE.Vector3();
/** Orientation with the shaft along `dir` and the blade facing as close to `face` as it can. */
function aimQ(dir: THREE.Vector3,face: THREE.Vector3,out: THREE.Quaternion): THREE.Quaternion{
  _y.copy(dir).normalize();
  _z.copy(face).addScaledVector(_y,-face.dot(_y));
  if(_z.lengthSq()<1e-6)_z.set(0,0,1).addScaledVector(_y,-_y.z);
  _z.normalize();
  _x.crossVectors(_y,_z).normalize();
  _m.makeBasis(_x,_y,_z);
  return out.setFromRotationMatrix(_m);
}
// Carry: diagonal across the view, blade low on the left, D-grip low on the right.
const CARRY_TIP=V(-.2,-1.05,-1.15);
const CARRY_Q=aimQ(V(.46,.77,.85),V(-.3,.4,-1),new THREE.Quaternion());
function carrySP(out: SPose): SPose{
  const sway=Math.sin(state.time*1.6)*.006;
  out.tip.copy(CARRY_TIP);out.tip.y+=sway;rig.localToWorld(out.tip);
  rig.getWorldQuaternion(_q);out.q.copy(_q).multiply(CARRY_Q);
  return out;
}
function blendSP(a: SPose,b: SPose,k: number,out: SPose): SPose{
  out.tip.lerpVectors(a.tip,b.tip,k);out.q.slerpQuaternions(a.q,b.q,k);return out;
}
const _gw=new THREE.Vector3();
/** Put the held shovel at a world pose and both fists on its grips. */
function applyShovel(sp: SPose): void{
  const s=heldObj;if(!s)return;
  s.position.copy(sp.tip);rig.worldToLocal(s.position);
  rig.getWorldQuaternion(_q);s.quaternion.copy(_q).invert().multiply(sp.q);
  s.updateMatrixWorld(true);
  placeArm(R,toRig(s.localToWorld(_gw.copy(s.userData.gripTop as THREE.Vector3))),.2);
  placeArm(L,toRig(s.localToWorld(_gw.copy(s.userData.gripMid as THREE.Vector3))),.5,-.2);
}
/** A world pose for the shovel from the tip, the point its shaft leans toward, and the blade face. */
function worldSP(tip: THREE.Vector3,toward: THREE.Vector3,face: THREE.Vector3,out: SPose): SPose{
  out.tip.copy(tip);aimQ(_d.subVectors(toward,tip),face,out.q);return out;
}
// A point on the player's body (`right` metres to the view's right, `up` above the
// feet) — the shaft leans toward it, so the grips stay in front of the chest.
// View forward is (sin yaw, cos yaw), so view-right is (-cos yaw, sin yaw).
function bodyRef(right: number,up: number,out: THREE.Vector3): THREE.Vector3{
  const p=player.g.position,yaw=cameraRig.yaw;
  return out.set(p.x-Math.cos(yaw)*right,p.y+up,p.z+Math.sin(yaw)*right);
}
function currentSP(o: THREE.Object3D,out: SPose): SPose{
  o.getWorldPosition(out.tip);o.getWorldQuaternion(out.q);return out;
}

/** Pull the shovel out of wherever it stands (its stand at the camp, or planted in the ground). */
export function fpTakeShovel(shovel: THREE.Object3D,cb: {onGrab?: ()=>void;onDone?: ()=>void}={}): void{
  let from: SPose|null=null;const carry=newSP(),out=newSP();
  const wp=V();
  let standAt: THREE.Vector3|null=null;
  play({dur:1.0,
    // step up to arm's length from the shaft, from wherever the player is
    moveTo:()=>{
      if(!standAt){
        const s=shovel.getWorldPosition(V()),p=player.g.position;
        const d=V(p.x-s.x,0,p.z-s.z);if(d.lengthSq()<1e-4)d.set(1,0,0);
        standAt=s.addScaledVector(d.normalize(),.72);
      }
      return standAt;
    },
    focus:()=>from?null:shovel.localToWorld(wp.copy(shovel.userData.gripMid as THREE.Vector3)),
    update:(t)=>{
      if(!from){
        const k=ease(seg(t,.05,.42));
        shovel.updateMatrixWorld(true);
        placeArm(R,lerpV(REST_R,toRig(shovel.localToWorld(wp.copy(shovel.userData.gripTop as THREE.Vector3))),k),.3*k);
        placeArm(L,lerpV(REST_L,toRig(shovel.localToWorld(wp.copy(shovel.userData.gripMid as THREE.Vector3))),k),.5*k);
      }
      once('grab',t>=.42,()=>{
        from={tip:shovel.getWorldPosition(V()),q:shovel.getWorldQuaternion(new THREE.Quaternion())};
        rig.attach(shovel);held='shovel';heldObj=shovel;
        dirtSound('scoop',.5);cb.onGrab?.();
      });
      if(from)applyShovel(blendSP(from,carrySP(carry),ease(seg(t,.42,1)),out));
    },
    done:cb.onDone});
}

/** Stick the shovel upright in the ground at `at` and let go of it. */
export function fpPlantShovel(at: THREE.Vector3,cb: {onDone?: ()=>void}={}): void{
  const shovel=heldObj;if(!shovel||held!=='shovel')return;
  let start: SPose|null=null;const out=newSP(),dest=newSP();
  const tip=V(at.x,groundHeight(at.x,at.z)-.18,at.z);
  const face=V(),lean=V(),gw=V();
  let released=false;
  play({dur:.6,
    focus:()=>V(at.x,tip.y+.6,at.z),
    update:(t)=>{
      if(!released){
        if(!start)start=currentSP(shovel,newSP());
        // upright, the shaft leaning a touch back toward the player, blade facing away
        face.set(at.x-player.g.position.x,0,at.z-player.g.position.z).normalize();
        lean.set(tip.x-face.x*.3,tip.y+2,tip.z-face.z*.3);
        worldSP(tip,lean,face,dest);
        applyShovel(blendSP(start,dest,ease(seg(t,0,.4)),out));
      }
      once('release',t>=.4,()=>{
        scene.attach(shovel);released=true;held='none';heldObj=null;
        dirtSound('scoop',.8);
      });
      if(released){
        const k=ease(seg(t,.4,.6));
        shovel.updateMatrixWorld(true);
        placeArm(R,lerpV(toRig(shovel.localToWorld(gw.copy(shovel.userData.gripTop as THREE.Vector3))),REST_R,k));
        L.g.visible=false;
      }
    },
    done:()=>{R.g.visible=L.g.visible=false;cb.onDone?.();}});
}

interface DigCtx{
  grave: THREE.Object3D;      // grave model (setDig/setFill; userData.pile is local)
  center: THREE.Vector3;      // pit centre (world)
  pile: THREE.Vector3;        // spoil heap centre (world)
  stand?: THREE.Vector3;      // where the digger stands (defaults to the player's position now)
}

/** One shovel stroke: drive the blade in at `bite`, lever a load up and fling it at
 *  `land` (soil clods fly there; onLand when they hit). `last` ends the stroke back in
 *  the carry pose; otherwise it stays poised for the next stroke. */
function stroke(bite: THREE.Vector3,land: THREE.Vector3,dur: number,last: boolean,onLand: ()=>void): void{
  let start: SPose|null=null;
  const carry=newSP(),out=newSP();
  const raised=newSP(),inSoil=newSP(),levered=newSP(),tossed=newSP();
  const face=V(),hip=V(),chest=V(),toss=V(),tip=V();
  play({dur,
    focus:()=>V(bite.x,bite.y+.25,bite.z),
    update:(t)=>{
      const s=heldObj;if(!s)return;
      if(!start)start=currentSP(s,newSP());
      // the blade faces away from the player, toward the bite
      face.set(bite.x-player.g.position.x,0,bite.z-player.g.position.z).normalize();
      const up=groundHeight(bite.x,bite.z);
      bodyRef(.32,.75,hip);bodyRef(.28,1.0,chest);
      worldSP(tip.set(bite.x,up+.38,bite.z),chest,face,raised);             // blade poised above
      worldSP(tip.set(bite.x,up-.16,bite.z),chest,face,inSoil);             // driven in
      worldSP(tip.set(bite.x,up+.06,bite.z).lerp(hip,.08),hip,
        V(face.x,1.2,face.z),levered);                                      // levered back, loaded
      toss.lerpVectors(bite,land,.35);toss.y=up+.7;
      worldSP(toss,chest,V(land.x-bite.x,.6,land.z-bite.z),tossed);         // flung at the landing point
      if(t<dur*.28)blendSP(start,raised,ease(seg(t,0,dur*.28)),out);
      else if(t<dur*.42)blendSP(raised,inSoil,ease(seg(t,dur*.28,dur*.42)),out);
      else if(t<dur*.58)blendSP(inSoil,levered,ease(seg(t,dur*.42,dur*.58)),out);
      else if(t<dur*.78)blendSP(levered,tossed,ease(seg(t,dur*.58,dur*.78)),out);
      else blendSP(tossed,last?carrySP(carry):raised,ease(seg(t,dur*.78,dur)),out);
      applyShovel(out);
      const dirt=s.userData.dirt as THREE.Object3D;
      once('bite',t>=dur*.42,()=>{dirtSound('scoop');dirt.visible=true;});
      once('throw',t>=dur*.74,()=>{
        dirt.visible=false;
        s.updateMatrixWorld(true);
        const from=s.localToWorld(V().copy(s.userData.scoop as THREE.Vector3));
        throwClods(from,land,6,()=>{dirtSound('land',.8);onLand();});
      });
    },
    done:()=>{const d=heldObj?.userData.dirt as THREE.Object3D|undefined;if(d)d.visible=false;}});
}

/** Dig the pit: `n` strokes biting the pit and throwing onto the heap. */
export function fpDig(ctx: DigCtx,n: number,cb: {onStroke?: (k: number)=>void;onDone?: ()=>void}={}): void{
  const from=ctx.stand??player.g.position;
  const toPlayer=V(from.x-ctx.center.x,0,from.z-ctx.center.z).normalize();
  for(let i=0;i<n;i++){
    // spread the bites over the pit, nearest end first, alternating sides
    const side=(i%2?-1:1)*.2;
    const bite=ctx.center.clone().addScaledVector(toPlayer,.4-i*.35);
    bite.x+=toPlayer.z*side;bite.z-=toPlayer.x*side;
    bite.y=groundHeight(bite.x,bite.z);
    const land=ctx.pile.clone();land.y=groundHeight(land.x,land.z)+.25;
    const k=(i+1)/n;
    stroke(bite,land,.72,i===n-1,()=>{ctx.grave.userData.setDig(k);cb.onStroke?.(k);});
  }
  play({dur:.01,update:()=>{},done:cb.onDone});
}

/** Fill it back: `n` strokes biting the heap and throwing into the pit. */
export function fpFill(ctx: DigCtx,n: number,cb: {onStroke?: (k: number)=>void;onDone?: ()=>void}={}): void{
  for(let i=0;i<n;i++){
    const bite=ctx.pile.clone();
    const toC=V(ctx.center.x-bite.x,0,ctx.center.z-bite.z).normalize();
    bite.addScaledVector(toC,.35);bite.x+=toC.z*(i-1)*.18;bite.z-=toC.x*(i-1)*.18;
    bite.y=groundHeight(bite.x,bite.z)+.12;
    const land=ctx.center.clone();land.y=groundHeight(land.x,land.z)+.05;
    const k=(i+1)/n;
    stroke(bite,land,.66,i===n-1,()=>{ctx.grave.userData.setFill(k);cb.onStroke?.(k);});
  }
  play({dur:.01,update:()=>{},done:cb.onDone});
}

/** Step to a working spot while turning to look at `look` (the shovel stays in carry). */
export function fpStep(to: THREE.Vector3,look: THREE.Vector3,dur=.5): void{
  const carry=newSP();
  play({dur,moveTo:()=>to,focus:()=>look,
    update:()=>{if(held==='shovel')applyShovel(carrySP(carry));}});
}

/** Two pats of the blade flat on the finished mound. */
export function fpPat(at: THREE.Vector3,cb: {onPat?: ()=>void;onDone?: ()=>void}={}): void{
  const out=newSP(),carry=newSP(),hi=newSP(),lo=newSP();
  play({dur:.75,
    focus:()=>at,
    update:(t)=>{
      const y=groundHeight(at.x,at.z);
      const chest=bodyRef(.28,1.0,V());
      worldSP(V(at.x,y+.45,at.z),chest,V(0,1,0),hi);
      worldSP(V(at.x,y+.16,at.z),chest,V(0,1,0),lo);
      if(t<.12)blendSP(carrySP(carry),hi,ease(seg(t,0,.12)),out);
      else if(t<.6){const p=Math.abs(Math.sin(seg(t,.12,.6)*Math.PI*2));blendSP(lo,hi,p,out);}
      else blendSP(hi,carrySP(carry),ease(seg(t,.6,.75)),out);
      applyShovel(out);
      once('p1',t>=.24,()=>{thud(1.2);});
      once('p2',t>=.48,()=>{thud(1.2);cb.onPat?.();});
    },
    done:cb.onDone});
}

/** Both hands grab the body and haul it into the pit: `move(k)` places the body along
 *  its way (0→1), `grips()` are the two world points the fists hold, and the player
 *  walks along with it, staying `reach` metres back from the grips. */
export function fpDrag(body: THREE.Object3D,grips: ()=>[THREE.Vector3,THREE.Vector3],
  move: (k: number)=>void,cb: {reach?: number;onDrop?: ()=>void;onDone?: ()=>void}={}): void{
  const lr=V(),ll=V(),mid=V(),to=V();
  const reachD=cb.reach??.85;
  const midGrip=()=>{const[a,b]=grips();return mid.addVectors(a,b).multiplyScalar(.5);};
  play({dur:1.9,
    moveTo:()=>{
      const m=midGrip(),p=player.g.position;
      const d=V(p.x-m.x,0,p.z-m.z);if(d.lengthSq()<1e-4)return null;
      return to.set(m.x,0,m.z).addScaledVector(d.normalize(),reachD);
    },
    focus:()=>midGrip(),
    update:(t)=>{
      const reach=ease(seg(t,0,.35));
      move(ease(seg(t,.4,1.55)));
      body.updateMatrixWorld(true);
      const[gr,gl]=grips();
      const rr=toRig(gr),rl=toRig(gl);
      if(t<1.6){
        placeArm(R,lerpV(REST_R,rr,reach),.6*reach,-.3*reach);
        placeArm(L,lerpV(REST_L,rl,reach),.6*reach,-.3*reach);
        lr.copy(rr);ll.copy(rl);
      }else{
        const k=ease(seg(t,1.6,1.9));
        placeArm(R,lerpV(lr,REST_R,k),.6*(1-k));
        placeArm(L,lerpV(ll,REST_L,k),.6*(1-k));
      }
      once('drop',t>=1.5,()=>{thud(5);dirtSound('land');cb.onDrop?.();});
    },
    done:()=>{R.g.visible=L.g.visible=false;cb.onDone?.();}});
}

/** Put the carried shovel down (leaning at `at`), e.g. when the job is over or the player wanders off. */
export function dropShovel(to: THREE.Object3D|null,at: {pos: THREE.Vector3;quat: THREE.Quaternion}): void{
  const s=held==='shovel'?heldObj:null;
  if(!s)return;
  queue.length=0;cur=null;
  (to??scene).attach(s);
  s.position.copy(at.pos);s.quaternion.copy(at.quat);
  held='none';heldObj=null;R.g.visible=L.g.visible=false;
}
/** Hand the receiver over to someone else (the third-person call) without a clip. */
export function releaseHeld(): void{held='none';heldObj=null;R.g.visible=L.g.visible=false;}

// ===================== per-frame =====================
const angDiff=(a: number,b: number)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
const _eye=new THREE.Vector3();

/** BEFORE the camera update: start queued clips, glide the feet, turn the view to the work. */
export function updateStoryFocus(dt: number): void{
  if(!cur&&queue.length)cur=queue.shift()!;
  if(!cur)return;
  if(state.mode!=='foot'){abortStoryFp();return;}
  const a=cur;
  const to=a.moveTo?.();
  if(to&&a.t<a.dur*.7){
    const p=player.g.position,k=1-Math.exp(-8*dt);
    p.x+=(to.x-p.x)*k;p.z+=(to.z-p.z)*k;p.y=groundHeight(p.x,p.z);
  }
  const f=a.focus?.();
  if(f&&a.t<a.dur*.85){
    _eye.copy(camera.position);
    const yaw=Math.atan2(f.x-_eye.x,f.z-_eye.z);
    const pitch=Math.atan2(_eye.y-f.y,Math.hypot(f.x-_eye.x,f.z-_eye.z));
    const k=1-Math.exp(-7*dt);
    cameraRig.yaw+=angDiff(cameraRig.yaw,yaw)*k;
    cameraRig.fpPitch+=(Math.max(-1.1,Math.min(1.1,pitch))-cameraRig.fpPitch)*k;
    player.heading=cameraRig.yaw;
  }
}

/** AFTER the camera update: pose the hands/held object in view space, run the clip. */
export function updateStoryHands(dt: number): void{
  updateClods(dt);
  const fp=isFirstPerson()&&state.mode==='foot';
  rig.visible=fp&&(held!=='none'||!!cur);
  if(!rig.visible)return;
  camera.updateMatrixWorld(true);
  if(cur){
    cur.t+=dt;
    cur.update(Math.min(cur.t,cur.dur),dt);
    if(cur.t>=cur.dur){const a=cur;cur=null;a.done?.();}
    return;
  }
  // idle carry
  if(held==='shovel')applyShovel(carrySP(newSP()));
  else if(held==='handset'&&heldObj){earPose(heldObj);placeArm(L,heldObj.position,.9);}
  else R.g.visible=L.g.visible=false;
}

// Whoever queued the running sequence can ask to be told if it gets cut short, to put
// the world back in order (receiver on its hook, shovel on its stand, the body back).
let abortHandler: (()=>void)|null=null;
export function fpOnAbort(fn: (()=>void)|null): void{abortHandler=fn;}

/** Cancel everything (the player left foot mode mid-clip: wasted, busted...). The
 *  remaining clips are dropped (their callbacks never run) and the abort handler fires. */
export function abortStoryFp(): void{
  queue.length=0;cur=null;
  const h=abortHandler;abortHandler=null;
  h?.();
}

// During the (third-person) phone call the receiver is in the player's hand, so the
// weapon is put away then too.
let phoneHands=false;
export function setPhoneHands(on: boolean): void{phoneHands=on;}

// While the hands are busy the weapon viewmodel hides and firing is blocked; while a
// clip plays, movement and look input are held (player.ts / weapons.ts read these).
refs.storyHandsActive=()=>phoneHands||(isFirstPerson()&&state.mode==='foot'&&(held!=='none'||fpBusy()));
refs.storyFpLock=()=>!!cur||queue.length>0;
