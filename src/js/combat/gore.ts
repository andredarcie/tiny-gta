// ============================================================================
// GORE — the violence layer: blood spray, arterial spurts, ground splatter, growing
// pools, and dismemberment of ANY NPC (head, arms, legs, or the whole body blown apart).
//
// Wired through `refs` (the cross-module pattern) so any system can use it without
// importing this module:
//   refs.spawnBlood(x,y,z,dir?,amount?)   — a burst of blood droplets at a world point
//   refs.severHead(npc,dir?)              — decapitate (kills): head flies, neck gushes
//   refs.severArm(npc,'L'|'R',dir?)       — tear an arm off: arm flies, shoulder spurts
//   refs.severLeg(npc,'L'|'R',dir?)       — blow a leg off: leg flies, hip spurts (both legs = fatal)
//   refs.gibNpc(npc,dir?,force?)          — blow the whole body apart (explosions, point-blank
//                                            shotgun, high-speed run-overs)
//   refs.addBloodPool(x,z,size?)          — a pool of blood that spreads on the ground
// updateGore(dt) is pumped from updateWeapons() every frame.
//
// The ped is ONE merged SkinnedMesh of boxes, each box rigidly bound to a bone
// (assets/models/characters/pedestrian.ts). Dismemberment = collapse that bone to scale
// ~0 (animatePed/poseAiming only ever set bone .rotation, so the collapse persists) and
// fling a box gib built from the same colours. Npc.restoreLimbs() undoes it on revival.
//
// Everything blood is InstancedMesh pools (a few draw calls total, whatever the carnage).
// ============================================================================
import * as THREE from 'three';
import {scene} from '@/core/engine.ts';
import {refs} from '@/core/state.ts';
import {groundHeight} from '@/core/constants.ts';
import {BLEED_INTERVAL} from '@/core/difficulty.ts';

const BLOOD=0x7a0707,BLOOD_DARK=0x4a0303;

// ---------- flying droplets: one InstancedMesh (1 draw call) ------------------
const CAP=1600;
const dropGeo=new THREE.BoxGeometry(.06,.06,.06);
const dropMat=new THREE.MeshStandardMaterial({color:BLOOD,roughness:.35,metalness:0});
let inst:THREE.InstancedMesh|null=null;
const _hide=new THREE.Matrix4().makeScale(0,0,0);
const _m4=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_pv=new THREE.Vector3(),_sv=new THREE.Vector3();

interface Drop{i:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;s:number;life:number;max:number;splat:boolean;}
const drops:Drop[]=[];
const freeSlots:number[]=[];

function ensureInst():void{
  if(inst)return;
  inst=new THREE.InstancedMesh(dropGeo,dropMat,CAP);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.frustumCulled=false;inst.castShadow=false;
  for(let i=0;i<CAP;i++){inst.setMatrixAt(i,_hide);freeSlots.push(i);}
  inst.instanceMatrix.needsUpdate=true;
  scene.add(inst);
}

// A burst of blood at a world point, sprayed roughly along `dir` (the shot/impact direction).
export function spawnBlood(x:number,y:number,z:number,dir?:THREE.Vector3,amount=12):void{
  ensureInst();
  for(let k=0;k<amount;k++){
    const i=freeSlots.pop();
    if(i===undefined)break;                       // pool exhausted: drop the extra
    let vx=(Math.random()*2-1)*2.6,vy=1.4+Math.random()*3.6,vz=(Math.random()*2-1)*2.6;
    if(dir){const sp=2.5+Math.random()*5.5;vx+=dir.x*sp;vy+=dir.y*sp*.4;vz+=dir.z*sp;}
    drops.push({i,x,y,z,vx,vy,vz,s:.5+Math.random()*1.4,life:0,max:.7+Math.random()*1.1,splat:Math.random()<.55});
  }
}
refs.spawnBlood=spawnBlood;

// A jet from a point: tight, fast, along `dir` (arterial spurt from a stump).
function spurt(x:number,y:number,z:number,dx:number,dy:number,dz:number,n:number):void{
  ensureInst();
  for(let k=0;k<n;k++){
    const i=freeSlots.pop();if(i===undefined)return;
    const sp=3+Math.random()*3;
    drops.push({i,x,y,z,
      vx:dx*sp+(Math.random()-.5)*.8,vy:dy*sp+(Math.random()-.5)*.8+.6,vz:dz*sp+(Math.random()-.5)*.8,
      s:.45+Math.random()*.8,life:0,max:.6+Math.random()*.6,splat:Math.random()<.7});
  }
}

// ---------- ground splatter + growing pools: one InstancedMesh ----------------
// Persistent flat stains (a ring buffer: the oldest is recycled). Droplets that land leave
// a small splat; corpses and stumps leave pools that spread over a couple of seconds.
const STAIN_CAP=900;
const stainGeo=new THREE.BoxGeometry(1,.01,1);
const stainMat=new THREE.MeshStandardMaterial({color:BLOOD_DARK,roughness:.25,metalness:0,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
let stains:THREE.InstancedMesh|null=null;
let stainNext=0;
interface Stain{x:number;y:number;z:number;rot:number;sx:number;sz:number;grow:number;tx:number;tz:number;}
const stainData:(Stain|null)[]=new Array(STAIN_CAP).fill(null);
const growing:number[]=[];

function ensureStains():void{
  if(stains)return;
  stains=new THREE.InstancedMesh(stainGeo,stainMat,STAIN_CAP);
  stains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  stains.frustumCulled=false;stains.receiveShadow=true;stains.castShadow=false;
  for(let i=0;i<STAIN_CAP;i++)stains.setMatrixAt(i,_hide);
  stains.instanceMatrix.needsUpdate=true;
  scene.add(stains);
}
function writeStain(i:number):void{
  const s=stainData[i]!;
  _q.setFromEuler(_e.set(0,s.rot,0));
  _m4.compose(_pv.set(s.x,s.y,s.z),_q,_sv.set(s.sx,1,s.sz));
  stains!.setMatrixAt(i,_m4);
}
// A stain at (x,z): `size` final width in metres; grows from small when `grow`>0 (seconds).
function addStain(x:number,z:number,size:number,grow=0,stretch=1):void{
  ensureStains();
  const i=stainNext;stainNext=(stainNext+1)%STAIN_CAP;
  const y=groundHeight(x,z)+.012+Math.random()*.006;
  const tx=size*stretch,tz=size/Math.sqrt(stretch);
  stainData[i]={x,y,z,rot:Math.random()*Math.PI,sx:grow?tx*.15:tx,sz:grow?tz*.15:tz,grow,tx,tz};
  writeStain(i);
  if(grow&&!growing.includes(i))growing.push(i);
  stains!.instanceMatrix.needsUpdate=true;
}
// A pool of blood that spreads out under a body / stump.
export function addBloodPool(x:number,z:number,size=1.6+Math.random()*1.2):void{
  addStain(x,z,size,2.5+Math.random()*2);
  // a few satellite blobs so the pool isn't a single square
  for(let k=0;k<3;k++)addStain(x+(Math.random()-.5)*size*.7,z+(Math.random()-.5)*size*.7,size*(.35+Math.random()*.3),2+Math.random()*2);
}
refs.addBloodPool=addBloodPool;

// ---------- bleeders: stumps that keep spurting for a few seconds ------------
interface Bleeder{o:THREE.Object3D;t:number;dur:number;acc:number;dx:number;dy:number;dz:number;pooled:boolean;}
const bleeders:Bleeder[]=[];
const _bw=new THREE.Vector3();
function addBleeder(o:THREE.Object3D|undefined,dur:number,dx:number,dy:number,dz:number):void{
  if(!o)return;
  bleeders.push({o,t:0,dur,acc:0,dx,dy,dz,pooled:false});
  if(bleeders.length>40)bleeders.shift();
}

// ---------- gibs (box body parts) ---------------------------------------------
interface Gib{g:THREE.Object3D;vx:number;vy:number;vz:number;rx:number;ry:number;rz:number;life:number;rest:boolean;trail:number;}
const gibs:Gib[]=[];
const MAX_GIBS=70;
const GIB_LIFE=25;          // seconds a severed part stays on the ground before fading
const boxG=new THREE.BoxGeometry(1,1,1);
const matCache=new Map<number,THREE.MeshStandardMaterial>();
// Gib materials are shared per colour (never disposed; the palette is small).
function gibMat(c:number):THREE.MeshStandardMaterial{
  let m=matCache.get(c);
  if(!m){m=new THREE.MeshStandardMaterial({color:c,roughness:.85,flatShading:true});matCache.set(c,m);}
  return m;
}
const bloodCapMat=new THREE.MeshStandardMaterial({color:BLOOD,roughness:.3});
function part(g:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,c:number|THREE.Material):void{
  const m=new THREE.Mesh(boxG,typeof c==='number'?gibMat(c):c);
  m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;g.add(m);
}
function launchGib(g:THREE.Object3D,wx:number,wy:number,wz:number,dir?:THREE.Vector3,force=1):void{
  g.position.set(wx,wy,wz);g.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);scene.add(g);
  const sp=(dir?(3+Math.random()*4):1.5)*force;
  gibs.push({g,
    vx:(Math.random()*2-1)*2.8+(dir?dir.x*sp:0),vy:(3.2+Math.random()*3.6)*Math.min(1.6,force),vz:(Math.random()*2-1)*2.8+(dir?dir.z*sp:0),
    rx:(Math.random()*2-1)*11,ry:(Math.random()*2-1)*11,rz:(Math.random()*2-1)*11,life:0,rest:false,trail:0});
  while(gibs.length>MAX_GIBS){const old=gibs.shift()!;scene.remove(old.g);}
}

const col=(ud:any,k:string,fb:number):number=>ud?.clothing?.[k]??fb;
function boneWorld(b:THREE.Object3D|undefined,fb:THREE.Vector3):THREE.Vector3{
  if(b){b.getWorldPosition(_bw);return _bw.clone();}return fb;
}
// Kill the NPC if the wound is fatal (no one walks around headless or legless).
function killIt(npc:any,dir?:THREE.Vector3):void{ if(npc&&!npc.dead&&npc.kill)npc.kill(dir); }

// ---------- bleeding out: every missing limb drains HP until the victim dies ------------
const bleeding=new Set<any>();
function startBleeding(npc:any):void{
  if(!npc||npc.dead||!npc.takeDamage)return;
  npc.g.userData.bleedT=npc.g.userData.bleedT??0;
  bleeding.add(npc);
}

// ---------- dismemberment -----------------------------------------------------
// Decapitate: collapse the head bone, hide the non-skinned head extras, fling the head,
// and leave the neck gushing. Fatal.
export function severHead(npc:any,dir?:THREE.Vector3):void{
  const g=npc.g,ud=g.userData;
  if(ud.headless)return;ud.headless=true;
  const head=ud.limbs?.head as THREE.Object3D|undefined;
  const at=boneWorld(head,new THREE.Vector3(g.position.x,g.position.y+1.6,g.position.z));
  if(head)head.scale.setScalar(1e-4);
  if(ud.mouth)(ud.mouth as THREE.Object3D).visible=false;
  const gib=new THREE.Group();
  part(gib,.26,.28,.26,0,0,0,col(ud,'skin',0xd9a06b));
  part(gib,.28,.07,.28,0,.15,0,ud.hairColor??0x2a1911);
  part(gib,.2,.03,.2,0,-.15,0,bloodCapMat);                 // bloody neck
  launchGib(gib,at.x,at.y+.15,at.z,dir,1.2);
  spawnBlood(at.x,at.y,at.z,dir,40);
  addBleeder(head,4,0,1,0);                                 // the neck fountains upward
  killIt(npc,dir);
}
refs.severHead=severHead;

// Tear an arm off at the shoulder. Not always fatal — they can bleed out running.
export function severArm(npc:any,side:'L'|'R',dir?:THREE.Vector3):void{
  const g=npc.g,ud=g.userData,limbs=ud.limbs;if(!limbs)return;
  ud.lostArm=ud.lostArm||{};
  if(ud.lostArm[side])return;ud.lostArm[side]=true;
  const ua=(side==='L'?limbs.leftArm:limbs.rightArm) as THREE.Object3D|undefined;
  const la=(side==='L'?limbs.leftForearm:limbs.rightForearm) as THREE.Object3D|undefined;
  const at=boneWorld(ua,new THREE.Vector3(g.position.x,g.position.y+1.3,g.position.z));
  if(ua)ua.scale.setScalar(1e-4);
  if(la)la.scale.setScalar(1e-4);
  const gib=new THREE.Group();
  part(gib,.11,.34,.11,0,.15,0,col(ud,'shirt',0xc23b4e));   // sleeve
  part(gib,.09,.3,.09,0,-.17,0,col(ud,'skin',0xd9a06b));    // forearm
  part(gib,.09,.09,.09,0,-.36,0,col(ud,'skin',0xd9a06b));   // hand
  part(gib,.1,.03,.1,0,.33,0,bloodCapMat);
  launchGib(gib,at.x,at.y-.1,at.z,dir);
  spawnBlood(at.x,at.y,at.z,dir,28);
  const s=side==='L'?-1:1,ry=g.rotation.y;
  addBleeder(ua,3.5,Math.cos(ry)*s*.7,.5,-Math.sin(ry)*s*.7);  // the shoulder sprays sideways
  ud.bleedingOut=(ud.bleedingOut||0)+1;
  startBleeding(npc);
}
refs.severArm=severArm;

// Blow a leg off at the hip. They hop on and bleed out; losing BOTH legs is fatal.
export function severLeg(npc:any,side:'L'|'R',dir?:THREE.Vector3):void{
  const g=npc.g,ud=g.userData,limbs=ud.limbs;if(!limbs)return;
  ud.lostLeg=ud.lostLeg||{};
  if(ud.lostLeg[side])return;ud.lostLeg[side]=true;
  const ul=(side==='L'?limbs.leftLeg:limbs.rightLeg) as THREE.Object3D|undefined;
  const ll=(side==='L'?limbs.leftCalf:limbs.rightCalf) as THREE.Object3D|undefined;
  const at=boneWorld(ul,new THREE.Vector3(g.position.x,g.position.y+.9,g.position.z));
  if(ul)ul.scale.setScalar(1e-4);
  if(ll)ll.scale.setScalar(1e-4);
  const gib=new THREE.Group();
  part(gib,.14,.44,.15,0,.2,0,col(ud,'pants',0x263454));    // thigh
  part(gib,.12,.44,.13,0,-.22,0,col(ud,'pants',0x263454));  // calf
  part(gib,.13,.08,.25,0,-.46,.04,col(ud,'shoe',0x111117)); // shoe
  part(gib,.13,.03,.14,0,.43,0,bloodCapMat);
  launchGib(gib,at.x,at.y-.2,at.z,dir,.9);
  spawnBlood(at.x,at.y,at.z,dir,30);
  addBleeder(ul,3,0,.3,0);
  ud.bleedingOut=(ud.bleedingOut||0)+1;
  if(ud.lostLeg.L&&ud.lostLeg.R)killIt(npc,dir);
  else startBleeding(npc);
}
refs.severLeg=severLeg;

// Blow the WHOLE body apart: every limb and the head fly off, the torso splits in
// chunks, a huge blood burst and a wide pool. The skinned body is collapsed entirely.
export function gibNpc(npc:any,dir?:THREE.Vector3,force=1.4):void{
  const g=npc.g,ud=g.userData;
  if(ud.gibbed)return;
  const d=dir||new THREE.Vector3(Math.random()-.5,0,Math.random()-.5).normalize();
  severHead(npc,d);severArm(npc,'L',d);severArm(npc,'R',d);severLeg(npc,'L',d);severLeg(npc,'R',d);
  ud.gibbed=true;
  const root=ud.rootBone as THREE.Object3D|undefined;
  const at=boneWorld(root,new THREE.Vector3(g.position.x,g.position.y+1,g.position.z));
  if(root)root.scale.setScalar(1e-4);                       // the torso is gone too
  // torso chunks
  const shirt=col(ud,'shirt',0xc23b4e),pants=col(ud,'pants',0x263454);
  for(let k=0;k<4;k++){
    const gib=new THREE.Group();
    const w=.14+Math.random()*.12,h=.12+Math.random()*.14;
    part(gib,w,h,.14,0,0,0,k<2?shirt:pants);
    part(gib,w*.8,.03,.1,0,h/2,0,bloodCapMat);
    launchGib(gib,at.x+(Math.random()-.5)*.3,at.y+.1+Math.random()*.4,at.z+(Math.random()-.5)*.3,d,force*(1.1+Math.random()*.5));
  }
  // every launched part flies harder
  for(let k=Math.max(0,gibs.length-9);k<gibs.length;k++){gibs[k].vx*=force;gibs[k].vz*=force;gibs[k].vy*=1+(force-1)*.5;}
  spawnBlood(at.x,at.y,at.z,d,120);
  spawnBlood(at.x,at.y+.4,at.z,undefined,60);
  addBloodPool(g.position.x,g.position.z,2.6+Math.random()*1.2);
  for(let k=0;k<14;k++)addStain(at.x+(Math.random()-.5)*5,at.z+(Math.random()-.5)*5,.12+Math.random()*.28,0,1+Math.random()*.4);
  killIt(npc,d);
}
refs.gibNpc=gibNpc;

// A random maiming for a lethal hit: head, an arm or a leg (or two).
export function maimRandom(npc:any,dir?:THREE.Vector3):void{
  const r=Math.random(),s:'L'|'R'=Math.random()<.5?'L':'R';
  if(r<.34)severHead(npc,dir);
  else if(r<.67){severArm(npc,s,dir);if(Math.random()<.35)severArm(npc,s==='L'?'R':'L',dir);}
  else severLeg(npc,s,dir);
}
refs.maimRandom=maimRandom;

// ---------- per-frame update (pumped from updateWeapons) ---------------------
export function updateGore(dt:number):void{
  // maimed NPCs lose 1 HP every BLEED_INTERVAL/limbs seconds, with blood dripping from them
  for(const npc of bleeding){
    const ud=npc.g.userData;
    if(npc.dead||!npc.g.parent){bleeding.delete(npc);ud.bleedT=0;continue;}
    const limbs=Math.max(1,ud.bleedingOut||1);
    ud.bleedT+=dt;
    if(Math.random()<dt*6*limbs)spawnBlood(npc.g.position.x,npc.g.position.y+.9,npc.g.position.z,undefined,1);
    if(ud.bleedT>=BLEED_INTERVAL/limbs){ud.bleedT=0;npc.takeDamage(undefined,1);}
  }
  // bleeders: stumps spurt in pulses (a heartbeat) that weaken, and pool underneath
  for(let k=bleeders.length-1;k>=0;k--){
    const b=bleeders[k];b.t+=dt;
    if(b.t>=b.dur||!b.o.parent){bleeders.splice(k,1);continue;}
    const strength=1-b.t/b.dur;
    const beat=Math.max(0,Math.sin(b.t*8.5));              // pulsing arterial jet
    b.acc+=dt*60*strength*beat;
    b.o.getWorldPosition(_bw);
    while(b.acc>=1){b.acc-=1;spurt(_bw.x,_bw.y,_bw.z,b.dx,b.dy,b.dz,1);}
    if(!b.pooled&&b.t>.8){b.pooled=true;addBloodPool(_bw.x,_bw.z,1+Math.random()*.8);}
  }
  if(inst&&drops.length){
    for(let k=drops.length-1;k>=0;k--){
      const d=drops[k];d.life+=dt;d.vy-=24*dt;
      d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;
      const gy=groundHeight(d.x,d.z)+.02;
      if(d.y<gy){
        if(d.splat){d.splat=false;addStain(d.x,d.z,.08+Math.random()*.16*d.s,0,1+Math.min(.6,Math.hypot(d.vx,d.vz)*.12));}
        d.y=gy;d.vy=0;d.vx*=.2;d.vz*=.2;
      }
      if(d.life>=d.max){inst.setMatrixAt(d.i,_hide);freeSlots.push(d.i);drops.splice(k,1);continue;}
      const sc=d.s*(1-d.life/d.max*.5);
      _m4.compose(_pv.set(d.x,d.y,d.z),_q.identity(),_sv.set(sc,sc,sc));
      inst.setMatrixAt(d.i,_m4);
    }
    inst.instanceMatrix.needsUpdate=true;
  }
  if(stains&&growing.length){
    for(let k=growing.length-1;k>=0;k--){
      const i=growing[k],s=stainData[i];
      if(!s||!s.grow){growing.splice(k,1);continue;}
      const kk=Math.min(1,dt/s.grow*2.2);
      s.sx+=(s.tx-s.sx)*kk;s.sz+=(s.tz-s.sz)*kk;
      writeStain(i);
      if(Math.abs(s.tx-s.sx)<.01){s.grow=0;growing.splice(k,1);}
    }
    stains.instanceMatrix.needsUpdate=true;
  }
  for(let k=gibs.length-1;k>=0;k--){
    const G=gibs[k];G.life+=dt;
    if(!G.rest){
      G.vy-=22*dt;
      G.g.position.x+=G.vx*dt;G.g.position.y+=G.vy*dt;G.g.position.z+=G.vz*dt;
      G.g.rotation.x+=G.rx*dt;G.g.rotation.y+=G.ry*dt;G.g.rotation.z+=G.rz*dt;
      G.trail+=dt;
      if(G.trail>.05){G.trail=0;spawnBlood(G.g.position.x,G.g.position.y,G.g.position.z,undefined,1);} // blood trail in flight
      const gy=groundHeight(G.g.position.x,G.g.position.z)+.08;
      if(G.g.position.y<gy&&G.vy<0){
        if(Math.abs(G.vy)>4){G.vy*=-.3;G.vx*=.5;G.vz*=.5;G.g.position.y=gy;   // bounce once
          addStain(G.g.position.x,G.g.position.z,.2+Math.random()*.15,0,1.3);}
        else{G.g.position.y=gy;G.rest=true;addStain(G.g.position.x,G.g.position.z,.35+Math.random()*.25,1.5);}
      }
    }
    if(G.life>GIB_LIFE){
      const s=Math.max(0,1-(G.life-GIB_LIFE)/1.2);
      G.g.scale.setScalar(s);                                 // shrink away (materials are shared)
      if(G.life>GIB_LIFE+1.2){scene.remove(G.g);gibs.splice(k,1);}
    }
  }
}
