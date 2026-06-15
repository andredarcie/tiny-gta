import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// ARMY truck (GTA "Barracks" style): low cab up front + open bed at the back with
// side lockers and canvas bows, GREEN CAMO paint (procedural <canvas> texture),
// 6 wheels. Shows up at 6 stars (max wanted) — see js/army.js — carrying 4
// soldiers standing in the bed who dismount and gun down the player. build() is
// PURE (returns an Object3D, never scene.add); the game's driving engine drives
// the group like a normal car.
//
// userData contracts read by the game (do NOT rename):
//  dentable[] (dentCar), wheels[]/front[] (spinWheels), tailM (brake light),
//  seats[] {x,y,z,ry} LOCAL positions of the 4 soldiers in the bed (army.js
//  boards/dismounts them).
//
// Axes (same as the other vehicles): +z = front, x = width, y = height off ground.

// ---------- camo texture (canvas -> map) ----------
// Military blobs (olive/dark-green/khaki/black). Deterministic apart from the
// blobs (cosmetic) and cheap: one small repeated canvas.
function camoTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#4b5320';x.fillRect(0,0,128,128);            // olive base
  const blobs=[['#3a4017',46],['#5e6b2f',40],['#2b2f14',30],['#7a7142',24]];
  for(const[col,n]of blobs){
    x.fillStyle=col;
    for(let i=0;i<n;i++){
      const bx=Math.random()*128,by=Math.random()*128,r=6+Math.random()*16;
      x.beginPath();
      for(let a=0;a<7;a++){ // irregular polygon = blob
        const th=a/7*Math.PI*2,rr=r*(.6+Math.random()*.6);
        const px=bx+Math.cos(th)*rr,py=by+Math.sin(th)*rr;
        a?x.lineTo(px,py):x.moveTo(px,py);
      }
      x.closePath();x.fill();
    }
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// ---------- materials (shared; color is NOT mutated at runtime) ----------
const camoMap=camoTexture();
const camoM=new THREE.MeshStandardMaterial({map:camoMap,roughness:.85,metalness:.1}); // camo body
const canvasM=new THREE.MeshStandardMaterial({color:0x3e4626,roughness:.95});          // dark-olive canvas/bows
const darkM=new THREE.MeshStandardMaterial({color:0x14140f,roughness:.7,metalness:.2}); // details/grille/lockers
const glassM=new THREE.MeshStandardMaterial({color:0x14201a,roughness:.55,metalness:.15,
  transparent:true,opacity:.78,depthWrite:false});                                      // dark military (blackout) glass — won't blow out white under strong light
const tireM=new THREE.MeshStandardMaterial({color:0x12110d,roughness:.95});
const hubM=new THREE.MeshStandardMaterial({color:0x3a3a2e,roughness:.5,metalness:.6});
const lightM=new THREE.MeshBasicMaterial({color:0xfff2c0});

function placed(geo,x,y,z,rx=0,rz=0){
  const g=geo.clone();
  if(rx)g.rotateX(rx);
  if(rz)g.rotateZ(rz);
  g.translate(x,y,z);
  return g;
}

// ---------- camo body (merged): chassis + cab + open bed -------
const bodyGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(2.0,.55,5.0),0,.62,0),        // long chassis
  placed(new THREE.BoxGeometry(1.96,1.15,1.5),0,1.5,1.55),   // cab (front)
  placed(new THREE.BoxGeometry(2.04,.12,3.1),0,.95,-.85),    // bed floor
  placed(new THREE.BoxGeometry(.12,.62,3.1),.98,1.32,-.85),  // right side wall
  placed(new THREE.BoxGeometry(.12,.62,3.1),-.98,1.32,-.85), // left side wall
  placed(new THREE.BoxGeometry(2.04,.62,.12),0,1.32,.62),    // bed front wall
  placed(new THREE.BoxGeometry(2.04,.5,.12),0,1.26,-2.4),    // tailgate (lower)
  placed(new THREE.BoxGeometry(2.16,.42,1.1),0,.5,1.55),     // front fender
  placed(new THREE.BoxGeometry(2.16,.42,2.0),0,.5,-1.3),     // rear fender (dual axle)
],false);

// ---------- olive canvas: bows over the bed (skeleton, no roof = soldiers visible) ----------
const ribG=new THREE.TorusGeometry(.98,.05,6,12,Math.PI); // half-arch
const canvasGeo=mergeGeometries([
  placed(ribG,0,1.63,.2,0,0),
  placed(ribG,0,1.63,-.9,0,0),
  placed(ribG,0,1.63,-2.0,0,0),
  placed(new THREE.BoxGeometry(.05,.05,2.5),.92,2.6,-.85),  // top rail right
  placed(new THREE.BoxGeometry(.05,.05,2.5),-.92,2.6,-.85), // top rail left
],false);

// ---------- dark details (grille, side lockers, mirrors, bumpers) ----------
const darkGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.4,.5,.08),0,1.2,2.32),     // front grille
  placed(new THREE.BoxGeometry(2.2,.24,.34),0,.5,2.36),     // front bumper
  placed(new THREE.BoxGeometry(2.16,.22,.3),0,.5,-2.5),     // rear bumper
  placed(new THREE.BoxGeometry(.06,.4,1.0),1.05,.85,-.85),  // right side locker
  placed(new THREE.BoxGeometry(.06,.4,1.0),-1.05,.85,-.85), // left side locker
  placed(new THREE.BoxGeometry(.2,.05,.05),1.06,1.62,2.05), // right mirror arm
  placed(new THREE.BoxGeometry(.05,.3,.14),1.18,1.56,2.07), // right mirror head
  placed(new THREE.BoxGeometry(.2,.05,.05),-1.06,1.62,2.05),
  placed(new THREE.BoxGeometry(.05,.3,.14),-1.18,1.56,2.07),
],false);

// ---------- glass (merged) ----------
const glassGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.8,.52,.05),0,1.74,2.32,-.28), // windshield
  placed(new THREE.BoxGeometry(.05,.46,1.1),.99,1.66,1.55),    // right window
  placed(new THREE.BoxGeometry(.05,.46,1.1),-.99,1.66,1.55),   // left window
],false);

const headlightG=new THREE.CylinderGeometry(.12,.12,.08,10);
const headlightsGeo=mergeGeometries([
  placed(headlightG,.74,1.2,2.35,Math.PI/2),
  placed(headlightG,-.74,1.2,2.35,Math.PI/2),
],false);
const taillightsGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(.2,.3,.06),.84,1.0,-2.46),
  placed(new THREE.BoxGeometry(.2,.3,.06),-.84,1.0,-2.46),
],false);

const wheelG=new THREE.CylinderGeometry(.44,.44,.36,12);

// LOCAL positions of the 4 soldiers standing in the bed (feet on the floor ~y=1.01),
// facing slightly outward — army.js uses these to board/dismount.
const SEATS=[
  {x:-.5,y:1.01,z:.0,ry:-.5},
  {x:.5,y:1.01,z:.0,ry:.5},
  {x:-.5,y:1.01,z:-1.5,ry:-.5},
  {x:.5,y:1.01,z:-1.5,ry:.5},
];

function buildArmyTruck(){
  const g=new THREE.Group();

  const body=new THREE.Mesh(bodyGeo,camoM);
  body.castShadow=true;g.add(body);
  g.userData.dentable=[body];

  g.add(new THREE.Mesh(canvasGeo,canvasM)); // canvas bows
  g.add(new THREE.Mesh(darkGeo,darkM));     // grille/lockers/mirrors/bumpers
  const glass=new THREE.Mesh(glassGeo,glassM);glass.renderOrder=3;g.add(glass);
  g.add(new THREE.Mesh(headlightsGeo,lightM));

  const tlMat=new THREE.MeshBasicMaterial({color:0x6a1212}); // tail light (lights up on brake/reverse)
  g.add(new THREE.Mesh(taillightsGeo,tlMat));
  g.userData.tailM=tlMat;

  // 6 wheels (front axle + dual rear axle). spinWheels rolls userData.wheels and
  // steers userData.front.
  g.userData.wheels=[];g.userData.front=[];
  for(const[sx,sz]of[[1,1.6],[-1,1.6],[1,-1.0],[-1,-1.0],[1,-1.9],[-1,-1.9]]){
    const wg=new THREE.Group();wg.position.set(sx*.95,.44,sz);wg.rotation.order='YXZ';
    const w=new THREE.Mesh(wheelG,[tireM,hubM,hubM]);
    w.rotation.z=Math.PI/2;wg.add(w);
    g.add(wg);g.userData.wheels.push(wg);
    if(sz>0)g.userData.front.push(wg);
  }

  g.userData.seats=SEATS.map(s=>({...s})); // copy (each truck gets its own)
  return g;
}

export function makeArmyTruck(){return buildArmyTruck();}

export default {category:'Vehicles',label:'Army truck',build:buildArmyTruck,zoom:.55,yaw:-.6};
