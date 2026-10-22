import * as THREE from 'three';
import {buildHandGeometry,type HandCurl,type HandGeometry} from './hand-sdf.ts';
import type {FpArmPose,FpHandsPose} from '@/combat/weapon-types.ts';

// First-person hands — anatomical: one smooth skin surface per hand shape (palm with
// thenar/hypothenar pads, four three-phalanx fingers, the thumb and the wrist, see
// hand-sdf.ts) plus a small nail mesh, painted by vertex colour (paler palm, ruddier
// knuckles and creases, pink fingertips). Used by the gun viewmodel, the weed-farm hands
// and the car cockpit grip.
//
// Hand frame (unchanged from the old box fist, so every weapon pose still fits): the
// wrist sits at the origin, the hand reaches up +Y, the PALM faces -Z (toward what it
// grips) and the back of the hand +Z. `side` = +1 right hand / -1 left hand (the thumb
// is on the -side·X edge). The curled fingers wrap around a tube along X centred near
// (0, .015, -.03) — where the old cube fist sat — so grips land where they did.

type Shape='grip'|'fist'|'rim';
// curl per finger [MCP, PIP, DIP] (rad) and the direction of each thumb bone
const SHAPES: Record<Shape,HandCurl>={
  grip:{fingers:[[1.0,1.45,.75],[1.08,1.5,.75],[1.15,1.52,.75],[1.22,1.48,.7]],
    thumb:[[.45,.75,-.45],[.05,.65,-.75],[-.45,.35,-.8]]},
  fist:{fingers:[[1.45,1.85,1.0],[1.5,1.9,1.0],[1.55,1.9,.95],[1.6,1.85,.9]],
    thumb:[[.4,.7,-.6],[-.4,.4,-.8],[-.85,-.35,-.4]]},
  rim:{fingers:[[.95,1.35,.7],[1.0,1.4,.7],[1.05,1.42,.7],[1.1,1.4,.65]],
    thumb:[[.45,.75,-.45],[.1,.7,-.7],[-.35,.45,-.8]]},
};

const _c=new THREE.Color();

// A skin material for these hands from the caller's (its colour = the skin tone).
const skinCache=new Map<string,{skin: THREE.MeshStandardMaterial;nail: THREE.MeshStandardMaterial}>();
function materialsFor(skinMat: THREE.Material): {skin: THREE.MeshStandardMaterial;nail: THREE.MeshStandardMaterial;tone: THREE.Color}{
  const tone=((skinMat as THREE.MeshStandardMaterial).color||new THREE.Color(0xd9a06b)).clone();
  const key=tone.getHexString();
  let m=skinCache.get(key);
  if(!m){
    m={
      skin:new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.55,metalness:0}),
      nail:new THREE.MeshStandardMaterial({color:_c.copy(tone).lerp(new THREE.Color(0xe9b8a8),.45).getHex(),roughness:.38,metalness:0}),
    };
    skinCache.set(key,m);
  }
  return{...m,tone};
}

// The hand surfaces take ~40-70 ms each to generate, so they are NOT built at load
// (the game boots instantly): a hand starts as a placeholder and its geometry is made in
// idle time shortly after boot, one shape per idle slot — or right away the first time
// a still-pending hand is about to be drawn.
interface Pending{side: number;shape: Shape;tone: THREE.Color;meshes: [THREE.Mesh,THREE.Mesh][];}
const shapeCache=new Map<string,HandGeometry>();
const pending=new Map<string,Pending>();
const PLACEHOLDER=new THREE.BufferGeometry();
PLACEHOLDER.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3));
PLACEHOLDER.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(9),3));
PLACEHOLDER.setAttribute('color',new THREE.BufferAttribute(new Float32Array(9),3));

function realise(key: string): HandGeometry{
  let geo=shapeCache.get(key);
  const p=pending.get(key);
  if(!geo){geo=buildHandGeometry(p!.side,SHAPES[p!.shape],p!.tone);shapeCache.set(key,geo);}
  if(p){for(const[s,n]of p.meshes){s.geometry=geo.skin;n.geometry=geo.nails;}pending.delete(key);}
  return geo;
}
let idleArmed=false;
function drainWhenIdle(): void{
  if(idleArmed||typeof window==='undefined')return;
  idleArmed=true;
  const ric=(window as unknown as {requestIdleCallback?: (f: ()=>void,o?: {timeout: number})=>number}).requestIdleCallback;
  const next=(): void=>{
    const key=pending.keys().next().value as string|undefined;
    if(key===undefined){idleArmed=false;return;}
    realise(key);
    if(ric)ric(next,{timeout:1500});else setTimeout(next,60);
  };
  setTimeout(()=>{if(ric)ric(next,{timeout:1500});else next();},2500);   // after the boot settles
}

function handMesh(skinMat: THREE.Material,side: number,shape: Shape): THREE.Group{
  const {skin,nail,tone}=materialsFor(skinMat);
  const key=tone.getHexString()+side+shape;
  const geo=shapeCache.get(key);
  const h=new THREE.Group();
  const s=new THREE.Mesh(geo?geo.skin:PLACEHOLDER,skin),n=new THREE.Mesh(geo?geo.nails:PLACEHOLDER,nail);
  s.castShadow=n.castShadow=false;
  if(!geo){
    let p=pending.get(key);
    if(!p){p={side,shape,tone,meshes:[]};pending.set(key,p);}
    p.meshes.push([s,n]);
    s.frustumCulled=n.frustumCulled=false;               // the placeholder has no real bounds
    // needed before its idle turn: build it now (it shows from the next frame)
    s.onBeforeRender=()=>{if(pending.has(key))realise(key);s.onBeforeRender=()=>{};};
    drainWhenIdle();
  }
  h.add(s,n);
  return h;
}

// A hand gripping a wheel rim: the rim runs along X through the origin and the curled
// fingers wrap over it (palm toward the rim, back of the hand toward the driver).
export function buildGripHand(skinMat: THREE.Material,side=1): THREE.Group{
  const h=handMesh(skinMat,side,'rim');
  h.position.set(0,-.004,.03);
  return h;
}

// A bare gripping hand (no sleeve). Reused by the gun viewmodel and the farm rig.
export function buildHand(skinMat: THREE.Material,side=1,shape: Shape='grip'): THREE.Group{
  return handMesh(skinMat,side,shape);
}

// The shirt sleeve: an oval, slightly tapered tube (forearms are wider than deep) with a
// few soft fabric folds. Kept 0.3 m tall and centred so callers can stretch it on Y.
function sleeveGeometry(): THREE.BufferGeometry{
  const g=new THREE.CylinderGeometry(.041,.046,.3,22,12,false);
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const a=Math.atan2(z,x);
    const fold=1+.045*Math.sin(y*58+Math.sin(a*3)*1.4)*Math.max(0,Math.cos(a*2+y*9)); // soft creases
    p.setXYZ(i,x*fold*1.08,y,z*fold*.86);
  }
  g.computeVertexNormals();
  return g;
}
const SLEEVE_GEO=sleeveGeometry();
const CUFF_GEO=new THREE.CylinderGeometry(.044,.044,.022,22,1,true).applyMatrix4(new THREE.Matrix4().makeScale(1.1,1,.88));

// A full arm: hand + the shirt sleeve with its cuff, hanging toward the elbow. The arm
// exposes userData {hand, fist, sleeve, cuff} so rigs can pose and stretch it.
function buildArm(skinMat: THREE.Material,sleeveMat: THREE.Material,side: number): THREE.Group{
  const arm=new THREE.Group();
  const hand=buildHand(skinMat,side,'grip');
  hand.position.set(0,0,-.02);
  const fist=buildHand(skinMat,side,'fist');
  fist.position.copy(hand.position);fist.visible=false;
  arm.add(hand,fist);
  const fore=new THREE.Mesh(SLEEVE_GEO,sleeveMat);
  fore.position.set(0,-.19,.02);
  fore.castShadow=false;
  const cuff=new THREE.Mesh(CUFF_GEO,sleeveMat);
  cuff.position.set(0,-.052,.0);cuff.castShadow=false;
  arm.add(fore,cuff);
  arm.userData.hand=hand;arm.userData.fist=fist;arm.userData.sleeve=fore;arm.userData.cuff=cuff;
  arm.rotation.set(-.5,0,side*.32);                       // down-back-outward toward the corner
  return arm;
}

export function makeFpHands({skin=0xd9a06b,sleeve=0x19e3ff}: {skin?: number; sleeve?: number}={}): THREE.Group{
  const g=new THREE.Group();
  const skinMat=new THREE.MeshStandardMaterial({color:skin,roughness:.85});
  const sleeveMat=new THREE.MeshStandardMaterial({color:sleeve,roughness:.92});
  // right hand on the grip (toward the viewer); left hand forward, supporting the barrel
  const right=buildArm(skinMat,sleeveMat,1);
  right.position.set(.04,-.05,.06);
  const left=buildArm(skinMat,sleeveMat,-1);
  left.position.set(-.02,-.06,-.16);
  g.add(right,left);
  g.userData.right=right;g.userData.left=left;
  return g;
}

export function poseFpHands(hands: THREE.Group,pose: FpHandsPose):void{
  const right=hands.userData.right as THREE.Group;
  const left=hands.userData.left as THREE.Group;
  applyArmPose(right,pose.right,pose.shape);
  applyArmPose(left,pose.left,pose.shape);
}

function applyArmPose(arm: THREE.Group,pose: FpArmPose,shape?: 'grip'|'fist'):void{
  arm.position.set(...pose.position);
  arm.rotation.set(...pose.rotation);
  arm.visible=pose.visible!==false;
  const fist=shape==='fist';
  (arm.userData.hand as THREE.Object3D).visible=!fist;
  (arm.userData.fist as THREE.Object3D).visible=fist;
}

// Model-viewer descriptor (auto-discovered): a right hand in its grip, plus the fist and
// the left hand as variants.
const viewerSkin=()=>new THREE.MeshStandardMaterial({color:0xc8956a,roughness:.85});
export default {category:'Personagens',label:'Mão (1ª pessoa)',build:()=>buildHand(viewerSkin(),1),zoom:5,
  variants:[
    {label:'Mão direita — empunhando',build:()=>buildHand(viewerSkin(),1,'grip')},
    {label:'Mão direita — punho fechado',build:()=>buildHand(viewerSkin(),1,'fist')},
    {label:'Mão esquerda — empunhando',build:()=>buildHand(viewerSkin(),-1,'grip')},
    {label:'Braço com manga',build:()=>{
      const g=makeFpHands();const r=g.userData.right as THREE.Group;r.position.set(0,0,0);r.rotation.set(0,0,0);
      g.remove(g.userData.left as THREE.Group);return g;}},
  ]};
