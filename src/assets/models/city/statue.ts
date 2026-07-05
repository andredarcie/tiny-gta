import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';
import {groundHeight} from '@/core/constants.ts';

// City-plaza MEMORIAL STATUE: a bronze figure of a man, arm raised in triumph, on a
// stepped stone plinth with an engraved plaque. It makes the title-screen prize real
// — honouring DIGUIFI, the player who finished #1 on the global leaderboard in the
// game's first month. build() is pure (statue at the origin, base on the ground);
// addStatue positions it, bakes it into the shared prop chunks and returns the
// collision AABB. Placed as the centrepiece of one city pracinha in place of the
// fountain (js/world/world.ts → js/../park.ts).

const STONE=matte({color:0xb9b2a4});      // pedestal (same warm stone as the fountain)
const STONE_DK=matte({color:0x968f82});   // darker steps / cap
const BRONZE=matte({color:0x7a5f34});     // aged bronze figure
const BRONZE_DK=matte({color:0x5c4726});  // deeper bronze for the shadowed masses

// Engraved plaque: text drawn once to a <canvas> and mapped onto the plinth's front
// face. Font stacks fall back to always-present generics, so the plate is legible even
// if the web fonts haven't finished loading when the world is built (it bakes once).
function plaqueTexture(): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=512;c.height=256;
  const x=c.getContext('2d')!;
  x.fillStyle='#3f3016';x.fillRect(0,0,512,256);                 // dark bronze plate
  x.fillStyle='#6b542c';x.fillRect(12,12,488,232);              // inset face
  x.strokeStyle='#241a0c';x.lineWidth=6;x.strokeRect(12,12,488,232); // engraved border
  x.textAlign='center';
  x.fillStyle='#e9d9ab';
  x.font='700 30px "IBM Plex Mono",monospace';
  x.fillText('IN HONOR OF',256,62);
  x.font='900 82px "Bowlby One SC",Impact,sans-serif';
  x.fillText('DIGUIFI',256,146);
  x.font='700 26px "IBM Plex Mono",monospace';
  x.fillText('#1 PLAYER · FIRST MONTH',256,196);
  x.font='600 20px "IBM Plex Mono",monospace';
  x.fillStyle='#c7b586';
  x.fillText('TINY THEFT AUTO',256,226);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
  return t;
}
const PLAQUE=matte({map:plaqueTexture()});

// Cylinder between two points (a posed limb): length = distance, oriented from +Y to p0->p1.
const _up=new THREE.Vector3(0,1,0),_d=new THREE.Vector3();
function limb(g:THREE.Group,p0:THREE.Vector3,p1:THREE.Vector3,r:number,mat:THREE.Material):void{
  _d.subVectors(p1,p0);
  const len=_d.length()||1e-4;
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,8),mat);
  m.position.copy(p0).addScaledVector(_d,.5);
  m.quaternion.setFromUnitVectors(_up,_d.clone().normalize());
  m.castShadow=true;g.add(m);
}
function box(g:THREE.Group,w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number):void{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);
}
function ball(g:THREE.Group,r:number,mat:THREE.Material,x:number,y:number,z:number):void{
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),mat);
  m.position.set(x,y,z);m.castShadow=true;g.add(m);
}

function build(): THREE.Group{
  const g=new THREE.Group();

  // ---- stepped stone plinth ----
  box(g,3.0,.42,3.0,STONE_DK,0,.21,0);        // bottom step
  box(g,2.3,.40,2.3,STONE,0,.62,0);           // second step
  box(g,1.4,2.0,1.4,STONE,0,1.82,0);          // plinth body (front face carries the plaque)
  box(g,1.66,.22,1.66,STONE_DK,0,2.93,0);     // cap under the figure
  // engraved plaque on the front (-z) face of the plinth body
  const plaque=new THREE.Mesh(new THREE.BoxGeometry(1.12,.62,.06),PLAQUE);
  plaque.position.set(0,1.72,-0.72);plaque.receiveShadow=true;g.add(plaque);

  // ---- bronze figure: heroic stance, right arm raised in triumph ----
  const fy=3.04;                              // feet rest on the cap
  // legs (hips -> knees -> feet), slight contrapposto
  const hipL=new THREE.Vector3(-.17,fy+1.16,0),hipR=new THREE.Vector3(.17,fy+1.16,-.02);
  limb(g,hipL,new THREE.Vector3(-.2,fy+.6,.06),.17,BRONZE);   // left thigh
  limb(g,new THREE.Vector3(-.2,fy+.6,.06),new THREE.Vector3(-.19,fy,.08),.14,BRONZE); // left shin
  limb(g,hipR,new THREE.Vector3(.2,fy+.58,-.04),.17,BRONZE);  // right thigh
  limb(g,new THREE.Vector3(.2,fy+.58,-.04),new THREE.Vector3(.19,fy,-.02),.14,BRONZE); // right shin
  box(g,.44,.16,.5,BRONZE_DK,-.19,fy+.06,.16);  // left boot
  box(g,.44,.16,.5,BRONZE_DK,.19,fy+.06,.06);   // right boot
  // pelvis + torso (tapered up to the shoulders)
  box(g,.56,.36,.32,BRONZE_DK,0,fy+1.22,-.01);  // pelvis block
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.42,.34,1.0,12),BRONZE);
  torso.position.set(0,fy+1.9,0);torso.castShadow=true;g.add(torso);
  box(g,.86,.24,.36,BRONZE,0,fy+2.32,0);        // shoulders
  // neck + head
  limb(g,new THREE.Vector3(0,fy+2.36,0),new THREE.Vector3(0,fy+2.6,.02),.13,BRONZE);
  ball(g,.29,BRONZE_DK,-.02,fy+2.9,-.06);       // hair mass (set back and up)
  ball(g,.27,BRONZE,0,fy+2.86,.03);             // head/face over the hair
  // left arm resting at the side
  const shL=new THREE.Vector3(-.42,fy+2.3,0);
  limb(g,shL,new THREE.Vector3(-.5,fy+1.8,.06),.13,BRONZE);   // upper
  limb(g,new THREE.Vector3(-.5,fy+1.8,.06),new THREE.Vector3(-.46,fy+1.26,.14),.11,BRONZE); // fore
  ball(g,.12,BRONZE_DK,-.45,fy+1.2,.16);        // left hand
  // right arm raised high in triumph
  const shR=new THREE.Vector3(.42,fy+2.3,0);
  limb(g,shR,new THREE.Vector3(.7,fy+2.86,-.04),.13,BRONZE);  // upper (up & out)
  limb(g,new THREE.Vector3(.7,fy+2.86,-.04),new THREE.Vector3(.86,fy+3.5,-.02),.11,BRONZE); // fore (skyward)
  ball(g,.13,BRONZE_DK,.88,fy+3.6,-.02);        // raised fist

  g.userData.r=1.6;g.userData.h=3.1;
  return g;
}

export default {category:'City',label:'Memorial Statue',build};

// Place at (x,z) on the ground, bake into the shared prop chunks, and return the
// collision AABB around the plinth (the figure high above is thin and unreachable, so
// blocking up to the cap is enough — players can still walk the steps to read the plaque).
export function addStatue(x: number,z: number): {x0:number;x1:number;z0:number;z1:number;h:number}{
  const g=build();g.position.set(x,groundHeight(x,z),z);bakeProp(g);
  const e=1.0;
  return{x0:x-e,x1:x+e,z0:z-e,z1:z+e,h:3.0};
}
