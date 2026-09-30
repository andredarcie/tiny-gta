import * as THREE from 'three';
import {groundHeight} from '@/core/constants.ts';
import {state} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {message} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {player,playerPos,cameraRig} from '@/actors/player.ts';
import {CAMP,campers,type Camper} from '@/story/redneck-camp.ts';
import {fpHeld,fpBusy,fpOnAbort,fpTakeShovel,fpStep,fpDig,fpPlantShovel,fpDrag,fpFill,fpPat,dropShovel} from '@/story/story-fp.ts';
import type {GraveRec} from '@/story/chain.ts';
import shovelModel from '../../assets/models/props/shovel.ts';
import {buildGrave} from '../../assets/models/missions/grave.ts';

// ============================================================================
// THE BURIAL — the story's second job (js/story/story.ts). The camp's six dead lie
// where they fell; a shovel stands stuck in the ground by the woodpile. Take it, walk
// up to a body and bury it, all in first person (the clips live in story-fp.ts):
//   dig the pit beside the body (the soil flies onto a heap) → plant the shovel and
//   drag the body into the pit with both hands → take the shovel back and shovel the
//   heap in → pat the mound, and a little cross goes up at its head.
// Six bodies, six graves. The graves stay in the woods after the job is done.
// ============================================================================

interface Grave{g: THREE.Object3D;rec: GraveRec;}

const STAND_AT={x:CAMP.x+1.4,z:CAMP.z-6.6};       // where the shovel waits (by the woodpile)
const TALK_R=2.4;

let active=false;
let shovel: THREE.Object3D|null=null;
const graves: Grave[]=[];
let burying: Camper|null=null;
let onAllBuried: (() => void)|null=null;
let onBuried: ((done: number,total: number) => void)|null=null;

function standPose(): {pos: THREE.Vector3;quat: THREE.Quaternion}{
  const y=groundHeight(STAND_AT.x,STAND_AT.z)-.16;
  return{pos:new THREE.Vector3(STAND_AT.x,y,STAND_AT.z),
    quat:new THREE.Quaternion().setFromEuler(new THREE.Euler(.12,.6,.05))};
}
function returnShovel(){
  if(!shovel)return;
  if(fpHeld()==='shovel')dropShovel(scene,standPose());
  else{const p=standPose();scene.attach(shovel);shovel.position.copy(p.pos);shovel.quaternion.copy(p.quat);}
}

/** Lay out a grave (used live, and to restore the finished ones from a save). */
function addGrave(rec: GraveRec,finished: boolean): Grave{
  const g=buildGrave();
  g.position.set(rec.x,groundHeight(rec.x,rec.z),rec.z);g.rotation.y=rec.ry;
  scene.add(g);
  if(finished){g.userData.setDig(1);g.userData.setFill(1);g.userData.setCross(true);}
  const gr={g,rec};graves.push(gr);
  return gr;
}
export function restoreGraves(recs: GraveRec[]){
  for(const r of recs)if(Number.isFinite(r?.x)&&Number.isFinite(r?.z))addGrave({x:r.x,z:r.z,ry:+r.ry||0},true);
}
export const graveRecords=(): GraveRec[]=>graves.map(g=>({...g.rec}));
export function clearGraves(){
  for(const g of graves)scene.remove(g.g);
  graves.length=0;
}

/** Start the job: the shovel appears at the camp. */
export function startBurial(opts: {onBuried?: (done: number,total: number) => void;onAllBuried?: () => void}){
  active=true;onBuried=opts.onBuried??null;onAllBuried=opts.onAllBuried??null;
  if(!shovel)shovel=shovelModel.build();
  scene.add(shovel);
  const p=standPose();shovel.position.copy(p.pos);shovel.quaternion.copy(p.quat);
}
/** End the job: the shovel goes away (graves stay). */
export function stopBurial(){
  if(fpHeld()==='shovel')dropShovel(scene,standPose());
  if(shovel)scene.remove(shovel);
  active=false;burying=null;onAllBuried=null;onBuried=null;
}

const unburied=()=>campers.filter(c=>c.dead&&!c.buried);
function nearestBody(): Camper|null{
  const pp=playerPos();let best: Camper|null=null,bd=TALK_R;
  for(const c of unburied()){
    const d=Math.hypot(c.g.position.x-pp.x,c.g.position.z-pp.z);
    if(d<bd){bd=d;best=c;}
  }
  return best;
}

// Where the job points next (radar/arrow): the shovel if it is not in hand, else the
// nearest body waiting to be buried.
export function burialGoal(): {x: number;z: number;kind: 'shovel'|'body'}|null{
  if(!active)return null;
  if(fpHeld()!=='shovel')return{x:STAND_AT.x,z:STAND_AT.z,kind:'shovel'};
  const pp=playerPos();let best: Camper|null=null,bd=1e9;
  for(const c of unburied()){const d=Math.hypot(c.g.position.x-pp.x,c.g.position.z-pp.z);if(d<bd){bd=d;best=c;}}
  return best?{x:best.g.position.x,z:best.g.position.z,kind:'body'}:null;
}

// The E action at the camp.
export function burialAction(): {label: string;prompt: string;enabled: boolean;run?: () => void}|null{
  if(!active||state.mode!=='foot'||state.cine||fpBusy()||burying)return null;
  const pp=playerPos();
  const holding=fpHeld()==='shovel';
  if(!holding&&shovel&&Math.hypot(pp.x-STAND_AT.x,pp.z-STAND_AT.z)<TALK_R)
    return{label:'SHOVEL',prompt:'TAKE THE SHOVEL',enabled:true,run:()=>fpTakeShovel(shovel!)};
  const body=nearestBody();
  if(body){
    if(!holding)return{label:'...',prompt:'GET THE SHOVEL',enabled:false};
    return{label:'BURY',prompt:'BURY '+body.name.toUpperCase(),enabled:true,run:()=>bury(body)};
  }
  return null;
}

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
function bury(body: Camper){
  burying=body;
  const pp=player.g.position,B=body.g.position.clone();
  // u = from the player to the body; the pit is dug to the body's right (as seen by
  // the player), long axis along u, with the heap further right.
  const u=V(B.x-pp.x,0,B.z-pp.z);if(u.lengthSq()<1e-4)u.set(Math.sin(cameraRig.yaw),0,Math.cos(cameraRig.yaw));
  u.normalize();
  const right=V(-u.z,0,u.x);
  const G=B.clone().addScaledVector(right,1.35);G.y=groundHeight(G.x,G.z);
  const ry=Math.atan2(u.x,u.z)+Math.PI;              // local +x (the heap) → the view's right
  const grave=addGrave({x:G.x,z:G.z,ry},false);
  grave.g.updateMatrixWorld(true);
  const pile=grave.g.localToWorld((grave.g.userData.pile as THREE.Vector3).clone());
  const S=G.clone().addScaledVector(u,-1.55);S.y=groundHeight(S.x,S.z);
  const ctx={grave:grave.g,center:G,pile,stand:S};
  // for the fill: stand back between the heap and the pit
  const F=G.clone().addScaledVector(right,.7).addScaledVector(u,-1.5);F.y=groundHeight(F.x,F.z);
  // the body's move into the pit: feet end at -u, chest up, lowered below the rim
  const q0=body.g.quaternion.clone(),p0=body.g.position.clone();
  const qf=new THREE.Quaternion().setFromAxisAngle(V(0,1,0),Math.atan2(-u.x,-u.z))
    .multiply(new THREE.Quaternion().setFromAxisAngle(V(1,0,0),-Math.PI/2));
  const pf=G.clone().addScaledVector(u,-.9);pf.y=G.y-.3;
  const move=(k: number)=>{
    body.g.position.lerpVectors(p0,pf,k);
    body.g.position.y+=Math.sin(k*Math.PI)*.22;
    body.g.quaternion.slerpQuaternions(q0,qf,Math.min(1,k*1.3));
  };
  const grips=():[THREE.Vector3,THREE.Vector3]=>[
    body.g.localToWorld(V(-.2,1.3,.1)),body.g.localToWorld(V(.2,1.3,.1))];
  const plantAt=S.clone().addScaledVector(u,.75).addScaledVector(right,.6);
  // cut short (wasted/busted mid-job): undo this grave, the body goes back where it lay
  // and the shovel back to its stand — the job can simply be started over
  fpOnAbort(()=>{
    returnShovel();
    body.g.position.copy(p0);body.g.quaternion.copy(q0);
    const i=graves.indexOf(grave);if(i>=0)graves.splice(i,1);
    scene.remove(grave.g);
    burying=null;
  });
  fpStep(S,G);
  fpDig(ctx,3);
  fpPlantShovel(plantAt);
  fpDrag(body.g,grips,move,{onDrop:()=>{body.g.position.copy(pf);}});
  fpTakeShovel(shovel!);
  fpStep(F,pile,.45);
  fpFill(ctx,3);
  fpPat(G,{onDone:()=>{
    fpOnAbort(null);
    grave.g.userData.setCross(true);
    body.buried=true;body.despawn();
    burying=null;
    const total=campers.length,done=campers.filter(c=>c.buried).length;
    blip([392,494,587],.12,'sine',.14);
    onBuried?.(done,total);
    if(done>=total){const fn=onAllBuried;onAllBuried=null;fn?.();}
    else message('BURIED '+done+'/'+total,'var(--cream)');
  }});
}

export function updateBurial(): void{
  if(!active)return;
  // the shovel doesn't leave the camp: wander off or get in a vehicle and it goes back
  if(fpHeld()==='shovel'&&!fpBusy()){
    const pp=playerPos();
    if(state.mode!=='foot'||Math.hypot(pp.x-CAMP.x,pp.z-CAMP.z)>70){
      returnShovel();
      message('YOU LEFT THE SHOVEL AT THE CAMP','var(--cream)');
    }
  }
}

export function burialState(){
  return{active,holding:fpHeld()==='shovel',busy:fpBusy()||!!burying,
    left:unburied().length,graves:graves.length,
    shovel:{x:STAND_AT.x,z:STAND_AT.z},
    bodies:unburied().map(c=>({name:c.name,x:+c.g.position.x.toFixed(2),z:+c.g.position.z.toFixed(2)}))};
}
