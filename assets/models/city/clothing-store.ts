import * as THREE from 'three';
import {matte} from '../matte.ts';
import {scene} from '@/core/engine.ts';
import {makeDoorArrow} from './door-arrow.ts';
import {buildToonPlayer} from '../characters/pedestrian.ts';

// Clothing store "THREADS": a storefront on a reserved city block plus a separate interior
// ~1000m off the map (a Group toggled visible only while the player is inside). Same mould
// as the gun shop / hospital. Inside, a CHANGING STATION (mirror + podium) lets the player
// open the custom-cars-style outfit menu (see js/places/clothing-store.ts). Display
// mannequins wear sample outfits and slowly turn.

export const CLOTHES_I=3,CLOTHES_J=6;                 // reserved block (see js/world/world-gen.ts RESERVED)
const CX=44*CLOTHES_I-154, CZ=44*CLOTHES_J-154;       // building centre = (-22,110)

// street door (west face) + spawn back onto the street
export const CLOTHES_DOOR={x:CX-8.6,z:CZ};
export const CLOTHES_SPAWN_OUT={x:CX-10.6,z:CZ};
// interior: centre, exit door, entry spawn, camera bounds, and the changing station
export const INT_CENTER={x:-900,z:-380};
export const INT_DOOR={x:-913.2,z:-377};
export const INT_SPAWN={x:-911.3,z:-377};
export const INT_BOUNDS={x0:-914,x1:-886,z0:-390,z1:-370,y1:5};
export const CLOTHES_STATION={x:-900,z:-384};         // mirror/podium: press E here to open the menu

export const clothesFx:{facade:THREE.Group|null;facadeArrow:THREE.Object3D|null;footprint:{x0:number;x1:number;z0:number;z1:number}|null;exitArrow:THREE.Object3D|null;stationArrow:THREE.Object3D|null;mannequins:THREE.Object3D[];}={
  facade:null,facadeArrow:null,footprint:null,exitArrow:null,stationArrow:null,mannequins:[]};
export const clothesInterior=new THREE.Group();
clothesInterior.visible=false;

function canvasTexture(w:number,h:number,draw:(x:CanvasRenderingContext2D,w:number,h:number)=>void):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d')!,w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

const wallM=matte({color:0x2a2630,roughness:.95});
const darkM=matte({color:0x16141a,roughness:.85});
const accentM=new THREE.MeshBasicMaterial({color:0xff6fae});      // THREADS pink
const woodM=matte({color:0x5a4632,roughness:.7});
const steelM=matte({color:0x9aa0aa,metalness:.7,roughness:.4});
const carpetM=matte({color:0x3a2740,roughness:.97});
const mirrorM=matte({color:0xcfe6f2,roughness:.08,metalness:.5});
const glowM=new THREE.MeshBasicMaterial({color:0xffe8f3});

function signTexture():THREE.CanvasTexture{
  return canvasTexture(512,128,(x,w,h)=>{
    x.textAlign='center';x.textBaseline='middle';
    x.font='900 52px monospace';
    x.shadowColor='#ff6fae';x.shadowBlur=22;
    x.fillStyle='#ffe6f3';
    for(let k=0;k<3;k++)x.fillText('THREADS',w/2,h/2);
  });
}
function panelTexture(lines:string,{bg='#1a121f',fg='#ffe6f3',sub='#ff6fae'}={}):THREE.CanvasTexture{
  const arr=String(lines).split('\n');
  return canvasTexture(512,256,(x,w,h)=>{
    x.fillStyle=bg;x.fillRect(0,0,w,h);
    x.strokeStyle=sub;x.lineWidth=10;x.strokeRect(8,8,w-16,h-16);
    x.textAlign='center';x.textBaseline='middle';
    arr.forEach((line,i)=>{
      x.font=`900 ${i===0?46:28}px monospace`;
      x.lineWidth=7;x.strokeStyle='#000';
      const y=h/2+i*54-(arr.length-1)*27;
      x.strokeText(line,w/2,y);
      x.fillStyle=i===0?fg:sub;x.fillText(line,w/2,y);
    });
  });
}
function makePanel(lines:string,w:number,h:number,opts={}):THREE.Mesh{
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:panelTexture(lines,opts),transparent:true,side:THREE.DoubleSide}));
}

function addBox(x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,group:THREE.Group=clothesInterior):THREE.Mesh{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;group.add(m);
  return m;
}

// A clothing rack: a steel frame with hanging garment "blocks" in varied colours.
function addRack(x:number,z:number,rotY:number):void{
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotY;
  for(const dx of[-1.4,1.4]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,2,8),steelM);
    post.position.set(dx,1,0);g.add(post);
  }
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,2.9,8),steelM);
  bar.rotation.z=Math.PI/2;bar.position.set(0,1.95,0);g.add(bar);
  const cols=[0xc23b4e,0x3b7ac2,0xcf9a3a,0x3aa06b,0xd96fae,0x7a4f9e,0x40c8c0,0xe8e3d2];
  for(let i=0;i<8;i++){
    const gar=new THREE.Mesh(new THREE.BoxGeometry(.26,.95,.16),matte({color:cols[i%cols.length],roughness:.8}));
    gar.position.set(-1.25+i*.36,1.32,0);gar.castShadow=true;g.add(gar);
  }
  clothesInterior.add(g);
}

// A small podium with a display mannequin (a recoloured doll) that slowly turns.
function addMannequin(x:number,z:number,shirt:number,pants:number,shoe:number):void{
  const podium=new THREE.Mesh(new THREE.CylinderGeometry(.62,.7,.18,20),darkM);
  podium.position.set(x,.09,z);clothesInterior.add(podium);
  const doll=buildToonPlayer({color:shirt,pantsColor:pants});
  doll.userData.setClothing?.({shirt,pants,shoe});
  doll.position.set(x,.18,z);
  doll.traverse(o=>{(o as THREE.Mesh).castShadow=false;});
  clothesInterior.add(doll);
  clothesFx.mannequins.push(doll);
}

export function addClothingStore(solids:{x0:number;x1:number;z0:number;z1:number;h:number}[]):void{
  // ---- exterior: storefront with a pink band, canopy and THREADS sign ----
  const bld=new THREE.Mesh(new THREE.BoxGeometry(16,7,16),wallM);
  bld.position.set(CX,3.5,CZ);bld.castShadow=true;bld.receiveShadow=true;scene.add(bld);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(16.2,.25,16.2),darkM);
  roof.position.set(CX,7.1,CZ);scene.add(roof);
  const band=new THREE.Mesh(new THREE.BoxGeometry(16.3,.5,16.3),accentM);
  band.position.set(CX,5.4,CZ);scene.add(band);

  const facade=new THREE.Group();
  const door=new THREE.Mesh(new THREE.BoxGeometry(.18,3.2,2.6),darkM);
  door.position.set(CX-8.02,1.6,CZ);facade.add(door);
  // shop window panes either side of the door
  for(const dz of[-3.4,3.4]){
    const glass=new THREE.Mesh(new THREE.BoxGeometry(.12,3.4,2.8),
      matte({color:0xbfe6f2,roughness:.05,metalness:.05,transparent:true,opacity:.26,depthWrite:false}));
    glass.position.set(CX-8.04,2,CZ+dz);facade.add(glass);
  }
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,4.4),matte({color:0x3a2a33,roughness:.8}));
  canopy.position.set(CX-9.3,3.3,CZ);canopy.castShadow=true;facade.add(canopy);
  for(const dz of[-1.9,1.9]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3.2,6),steelM);
    pole.position.set(CX-10.4,1.6,CZ+dz);facade.add(pole);
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.3),
    new THREE.MeshBasicMaterial({map:signTexture(),transparent:true}));
  sign.position.set(CX-8.12,6,CZ);sign.rotation.y=-Math.PI/2;facade.add(sign);
  clothesFx.facadeArrow=makeDoorArrow();
  clothesFx.facadeArrow.position.set(CX-9.3,1.7,CZ);facade.add(clothesFx.facadeArrow);
  scene.add(facade);
  clothesFx.facade=facade;
  clothesFx.footprint={x0:CX-8.2,x1:CX+8.2,z0:CZ-8.2,z1:CZ+8.2};
  solids.push({x0:CX-8.2,x1:CX+8.2,z0:CZ-8.2,z1:CZ+8.2,h:7.2});

  // ---- interior: 28x20 room ~1000m off the map, in a toggled group ----
  addBox(-900,5.92,-380,28.4,.22,20.4,darkM);                      // ceiling
  addBox(-914.08,3,-380,.36,6,20.7,wallM);                         // west wall
  addBox(-885.92,3,-380,.36,6,20.7,wallM);                         // east wall
  addBox(-900,3,-390.08,28.5,6,.36,wallM);                         // north wall
  addBox(-900,3,-369.92,28.5,6,.36,wallM);                         // south wall
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(27.4,19.4),carpetM);
  floor.rotation.x=-Math.PI/2;floor.position.set(-900,.02,-380);clothesInterior.add(floor);
  const outer=new THREE.Mesh(new THREE.BoxGeometry(30,10,22),
    new THREE.MeshBasicMaterial({color:0x07060a,side:THREE.BackSide}));
  outer.position.set(-900,3.8,-380);clothesInterior.add(outer);

  // pink trim around the walls (matches the storefront)
  for(const z of[-390.9,-369.1]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(27.6,.1,.1),accentM);
    s.position.set(-900,3.2,z);clothesInterior.add(s);
  }
  for(const x of[-913.9,-886.1]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,19.6),accentM);
    s.position.set(x,3.2,-380);clothesInterior.add(s);
  }
  const logo=makePanel('THREADS\nWEAR IT LOUD',5.2,1.55);
  logo.position.set(-900,4.55,-390.86);clothesInterior.add(logo);

  // ceiling lights
  for(const x of[-907,-900,-893]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(5.2,.08,.28),glowM);
    bar.position.set(x,5.72,-380);clothesInterior.add(bar);
    const l=new THREE.PointLight(0xffe6f3,16,14,1.6);
    l.position.set(x,5.4,-380);clothesInterior.add(l);
  }
  const light=new THREE.PointLight(0xffe9f3,80,52,1.5);
  light.position.set(-900,4.7,-380);clothesInterior.add(light);

  // racks along the north + side walls
  addRack(-907,-388.6,0);addRack(-901,-388.6,0);addRack(-895,-388.6,0);
  addRack(-912.4,-384,Math.PI/2);addRack(-887.6,-376,-Math.PI/2);

  // display mannequins (different sample outfits), slowly turning
  addMannequin(-906,-374.5,0xc23b4e,0x263454,0x111117);
  addMannequin(-900,-374.5,0x3aa06b,0x2e2a24,0xe8e3d2);
  addMannequin(-894,-374.5,0x7a4f9e,0x18191f,0x33251e);

  // ---- changing station: mirror + podium where the player opens the outfit menu ----
  const st=CLOTHES_STATION;
  const podium=new THREE.Mesh(new THREE.CylinderGeometry(1.0,1.1,.12,24),darkM);
  podium.position.set(st.x,.07,st.z);clothesInterior.add(podium);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.95,1.12,28),
    new THREE.MeshBasicMaterial({color:0xff6fae,transparent:true,opacity:.5,side:THREE.DoubleSide}));
  ring.rotation.x=-Math.PI/2;ring.position.set(st.x,.14,st.z);clothesInterior.add(ring);
  // tri-fold mirror behind the podium
  for(const[dx,ry] of [[-1.5,.5],[0,0],[1.5,-.5]] as [number,number][]){
    const mir=new THREE.Mesh(new THREE.BoxGeometry(1.35,3.0,.08),mirrorM);
    mir.position.set(st.x+dx,1.7,st.z-1.7);mir.rotation.y=ry;clothesInterior.add(mir);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.5,3.2,.12),woodM);
    frame.position.set(st.x+dx,1.7,st.z-1.78);frame.rotation.y=ry;clothesInterior.add(frame);
  }
  const stSign=makePanel('CHANGING ROOM\nPRESS E TO DRESS UP',3.6,1.0);
  stSign.position.set(st.x,3.9,-390.84);clothesInterior.add(stSign);
  clothesFx.stationArrow=makeDoorArrow();
  clothesFx.stationArrow.position.set(st.x,1.9,st.z);clothesInterior.add(clothesFx.stationArrow);

  // checkout counter near the entrance
  addBox(-911,.55,-383,1.4,1.1,4,woodM);
  addBox(-911,1.16,-383,1.6,.12,4.2,matte({color:0x2a2630,roughness:.6}));

  // exit door (west wall) + bouncing arrow
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,3,2.4),darkM);
  exitDoor.position.set(-913.85,1.5,-377);clothesInterior.add(exitDoor);
  const exitSign=makePanel('EXIT',1.15,.42);
  exitSign.position.set(-913.7,3.3,-377);exitSign.rotation.y=Math.PI/2;clothesInterior.add(exitSign);
  clothesFx.exitArrow=makeDoorArrow();
  clothesFx.exitArrow.position.set(-912.6,1.7,-377);clothesInterior.add(clothesFx.exitArrow);

  scene.add(clothesInterior);

  // solid walls (player can't leave the room except through the door)
  solids.push(
    {x0:-914,x1:-913.0,z0:-390.5,z1:-369.5,h:6},   // west
    {x0:-887.0,x1:-886,z0:-390.5,z1:-369.5,h:6},   // east
    {x0:-914.5,x1:-885.5,z0:-390.6,z1:-389.9,h:6}, // north
    {x0:-914.5,x1:-885.5,z0:-370.1,z1:-369.4,h:6}, // south
  );
}
