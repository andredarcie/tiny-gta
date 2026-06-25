// ============================================================================
// GORE — brutal violence layer: blood spray on every hit + head/arm dismemberment.
//
// Wired through `refs` (the cross-module pattern) so any system can splatter blood
// or tear a limb off without importing this module:
//   refs.spawnBlood(x,y,z,dir?,amount?)  — a burst of blood droplets at a world point
//   refs.severHead(npc,dir?)             — decapitate an NPC (collapse + flying head gib)
//   refs.severArm(npc,'L'|'R',dir?)      — tear an arm off (collapse + flying arm gib)
// updateGore(dt) is pumped from updateWeapons() every frame.
//
// The ped is ONE merged SkinnedMesh, so a "limb" is a vertex range bound to a bone
// (js/../characters/pedestrian.ts). Dismemberment = collapse that bone to scale 0
// (animatePed/poseAiming only ever set bone .rotation, so the collapse persists),
// hide the few non-skinned head extras (mouth, female hair), and fling a crude gib.
//
// Blood droplets are a SINGLE InstancedMesh (one draw call for the whole pool) to
// keep the carnage cheap on the GPU even in a firefight.
// ============================================================================
import * as THREE from 'three';
import {scene} from '@/core/engine.ts';
import {refs} from '@/core/state.ts';
import {groundHeight} from '@/core/constants.ts';

// ---------- blood spray: one InstancedMesh pool (1 draw call) ----------------
const CAP=300;                       // max simultaneous droplets
const dropGeo=new THREE.SphereGeometry(0.055,6,5);
const bloodMat=new THREE.MeshStandardMaterial({color:0x7e0a0a,roughness:.55,metalness:0});
let inst:THREE.InstancedMesh|null=null;
const _hide=new THREE.Matrix4().makeScale(0,0,0);
const _m4=new THREE.Matrix4(),_qi=new THREE.Quaternion(),_pv=new THREE.Vector3(),_sv=new THREE.Vector3();

interface Drop{i:number;x:number;y:number;z:number;vx:number;vy:number;vz:number;s:number;life:number;max:number;}
const drops:Drop[]=[];
const freeSlots:number[]=[];

function ensureInst():void{
  if(inst)return;
  inst=new THREE.InstancedMesh(dropGeo,bloodMat,CAP);
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
    if(i===undefined)break;                       // pool exhausted (firefight): drop the extra
    let vx=(Math.random()*2-1)*2.4,vy=1.6+Math.random()*3.4,vz=(Math.random()*2-1)*2.4;
    if(dir){const sp=2.5+Math.random()*4.5;vx+=dir.x*sp;vy+=dir.y*sp*.4;vz+=dir.z*sp;}
    drops.push({i,x,y,z,vx,vy,vz,s:.5+Math.random()*1.3,life:0,max:.5+Math.random()*.8});
  }
}
refs.spawnBlood=spawnBlood;

// ---------- gibs (severed head / arm) ----------------------------------------
interface Gib{g:THREE.Object3D;vx:number;vy:number;vz:number;rx:number;ry:number;rz:number;life:number;rest:boolean;}
const gibs:Gib[]=[];
const MAX_GIBS=28;
const _wp=new THREE.Vector3();
// shared gib geometries (module-level → never disposed; only the per-gib materials are)
const headGibGeo=new THREE.SphereGeometry(0.2,12,10);
const hairGibGeo=new THREE.SphereGeometry(0.205,10,8);
const armGibGeo=new THREE.CylinderGeometry(0.055,0.04,0.55,8);
const sleeveGibGeo=new THREE.CylinderGeometry(0.064,0.058,0.18,8);

function disposeGibMats(o:THREE.Object3D):void{
  o.traverse(c=>{const m=(c as THREE.Mesh).material as THREE.Material|undefined;if(m&&m.dispose)m.dispose();});
}
function launchGib(g:THREE.Object3D,wx:number,wy:number,wz:number,dir?:THREE.Vector3):void{
  g.position.set(wx,wy,wz);scene.add(g);
  const sp=dir?(2+Math.random()*3):0;
  gibs.push({g,
    vx:(Math.random()*2-1)*2.6+(dir?dir.x*sp:0),vy:3.4+Math.random()*3.2,vz:(Math.random()*2-1)*2.6+(dir?dir.z*sp:0),
    rx:(Math.random()*2-1)*9,ry:(Math.random()*2-1)*9,rz:(Math.random()*2-1)*9,life:0,rest:false});
  while(gibs.length>MAX_GIBS){const old=gibs.shift()!;scene.remove(old.g);disposeGibMats(old.g);}
}
const skinOf=(ud:any):number=>ud?.clothing?.skin??0xd9a06b;
const shirtOf=(ud:any):number=>ud?.clothing?.shirt??0xc23b4e;
function boneWorld(b:THREE.Object3D|undefined,fb:THREE.Vector3):THREE.Vector3{
  if(b){b.getWorldPosition(_wp);return _wp.clone();}return fb;
}

// Decapitate: collapse the head bone, hide the non-skinned head extras, fling a head gib.
export function severHead(npc:any,dir?:THREE.Vector3):void{
  const g=npc.g,ud=g.userData;
  if(ud.headless)return;ud.headless=true;
  const head=ud.limbs?.head as THREE.Object3D|undefined;
  const at=boneWorld(head,new THREE.Vector3(g.position.x,g.position.y+1.6,g.position.z));
  if(head)head.scale.setScalar(1e-4);            // collapse the head vertices to the neck
  if(ud.mouth)(ud.mouth as THREE.Object3D).visible=false;
  if(ud.femaleHairMesh)(ud.femaleHairMesh as THREE.Object3D).visible=false;
  const gib=new THREE.Group();
  gib.add(new THREE.Mesh(headGibGeo,new THREE.MeshStandardMaterial({color:skinOf(ud),roughness:.9})));
  const cap=new THREE.Mesh(hairGibGeo,new THREE.MeshStandardMaterial({color:ud.hairColor??0x2a1911,roughness:.95}));
  cap.position.y=.05;cap.scale.set(1,.7,1);gib.add(cap);
  launchGib(gib,at.x,at.y,at.z,dir);
  spawnBlood(at.x,at.y-.05,at.z,dir,20);          // a fat spurt from the neck
  refs.addBloodPuddle?.(g.position.x,g.position.z);
}
refs.severHead=severHead;

// Tear an arm off: collapse the upper+lower arm bones, fling an arm gib.
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
  gib.add(new THREE.Mesh(armGibGeo,new THREE.MeshStandardMaterial({color:skinOf(ud),roughness:.92})));
  const slv=new THREE.Mesh(sleeveGibGeo,new THREE.MeshStandardMaterial({color:shirtOf(ud),roughness:.9}));
  slv.position.y=.2;gib.add(slv);
  launchGib(gib,at.x,at.y,at.z,dir);
  spawnBlood(at.x,at.y,at.z,dir,14);
}
refs.severArm=severArm;

// ---------- per-frame update (pumped from updateWeapons) ---------------------
export function updateGore(dt:number):void{
  if(inst&&drops.length){
    for(let k=drops.length-1;k>=0;k--){
      const d=drops[k];d.life+=dt;d.vy-=24*dt;
      d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;
      const gy=groundHeight(d.x,d.z)+.02;
      if(d.y<gy){d.y=gy;d.vy=0;d.vx*=.3;d.vz*=.3;}
      if(d.life>=d.max){inst.setMatrixAt(d.i,_hide);freeSlots.push(d.i);drops.splice(k,1);continue;}
      const sc=d.s*(1-d.life/d.max*.5);
      _m4.compose(_pv.set(d.x,d.y,d.z),_qi,_sv.set(sc,sc,sc));
      inst.setMatrixAt(d.i,_m4);
    }
    inst.instanceMatrix.needsUpdate=true;
  }
  for(let k=gibs.length-1;k>=0;k--){
    const G=gibs[k];G.life+=dt;
    if(!G.rest){
      G.vy-=22*dt;
      G.g.position.x+=G.vx*dt;G.g.position.y+=G.vy*dt;G.g.position.z+=G.vz*dt;
      G.g.rotation.x+=G.rx*dt;G.g.rotation.y+=G.ry*dt;G.g.rotation.z+=G.rz*dt;
      const gy=groundHeight(G.g.position.x,G.g.position.z)+.12;
      if(G.g.position.y<gy&&G.vy<0){G.g.position.y=gy;G.rest=true;}
    }
    if(G.life>5){
      const o=Math.max(0,1-(G.life-5)/1.2);
      G.g.traverse(c=>{const m=(c as THREE.Mesh).material as THREE.MeshStandardMaterial|undefined;if(m){m.transparent=true;m.opacity=o;}});
      if(G.life>6.2){scene.remove(G.g);disposeGibMats(G.g);gibs.splice(k,1);}
    }
  }
}
