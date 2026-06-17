import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';
import {scene} from '../../../js/engine.js';
import {makePed} from '../characters/pedestrian.js';
import {makeDoorArrow} from '../city/door-arrow.js';

// ============================================================================
// GENERAL STORE — the small-town country shop on the main street of the rural
// village (Pine Hollow). The EXTERIOR is the old false-front emporium (a tall
// straight parapet, sign, covered porch over the window). The new bit is a real
// WALK-IN INTERIOR a la gun-shop: a separate visible=false group ~600m off-map,
// turned on only while the player is inside. Touch the porch door to enter; touch
// the inner door to leave. Inside there is a SEED COUNTER where the player buys
// crop seeds (js/general-store.js handles the buying); those seeds are then what
// the weed farm needs to plant (js/weed-farm.js).
//
// build() stays pure (the standalone storefront on the origin, front facing +z)
// so the model gallery still shows it. addGeneralStore(solids) places the baked
// exterior in the village, builds the off-map interior and pushes collision.
// ============================================================================

// ---- world placement: Pine Hollow main street, front facing the square (south) ----
export const GENSTORE_CX=620, GENSTORE_CZ=22, GENSTORE_RY=Math.PI;
// street door (south face) and the spawn back out on the street
export const GENSTORE_DOOR={x:GENSTORE_CX, z:GENSTORE_CZ-2.8};   // (620, 19.2)
export const GENSTORE_SPAWN_OUT={x:GENSTORE_CX, z:GENSTORE_CZ-6}; // (620, 16) — clear of the porch

// ---- off-map interior: its own clear pocket (other interiors live at x~-800,
// z = -430..330; this one sits further south at z=-560 so its wall solids never
// overlap another room). Room footprint ~16 wide (x) x 12 deep (z). ----
export const INT_CENTER={x:-800,z:-560};
export const INT_DOOR={x:-806.8,z:-560};   // inner exit door (west wall)
export const INT_SPAWN={x:-805.2,z:-560};  // spawn just inside, facing east (+x)
export const INT_BOUNDS={x0:-806.7,x1:-793.3,z0:-564.7,z1:-555.3,y1:4.6};
export const SEED_COUNTER={x:-795.6,z:-560}; // front edge of the sales counter

export const genStoreFx={keeper:null,exitArrow:null,facade:null,facadeArrow:null,
  footprint:null,seedCrate:null};
export const generalStoreInterior=new THREE.Group();
generalStoreInterior.visible=false;

// ---- exterior materials (warm honey planks, western false front) ----
const wallM=matte({color:0xcf8f5a,roughness:.95});
const frontM=matte({color:0xb87a48,roughness:.95});
const roofM=matte({color:0x5b5048,roughness:.9});
const trimM=matte({color:0x5e3c24,roughness:.85});
const winM=matte({color:0x9ecbe0,roughness:.4});
const doorM=matte({color:0x6e4a32,roughness:.9});

let signTex=null;
function signTexture(){
  if(signTex)return signTex;
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const x=c.getContext('2d');
  x.fillStyle='#3a2415';x.fillRect(0,0,256,64);
  x.fillStyle='#f2e3c0';x.font='900 30px monospace';x.textAlign='center';x.textBaseline='middle';
  x.fillText('GENERAL STORE',128,36);
  signTex=new THREE.CanvasTexture(c);signTex.colorSpace=THREE.SRGBColorSpace;return signTex;
}

function build(){
  const g=new THREE.Group();
  const W=6,D=5,H=3.2,fz=D/2;
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wallM);
  body.position.y=H/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W,.2,D),roofM);
  roof.position.y=H+.1;g.add(roof);
  // false front (straight parapet, taller than the roof)
  const front=new THREE.Mesh(new THREE.BoxGeometry(W+.2,H+1.2,.3),frontM);
  front.position.set(0,(H+1.2)/2,fz+.15);front.castShadow=true;g.add(front);
  // sign on the false front
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(W-.6,1.1),
    new THREE.MeshBasicMaterial({map:signTexture()}));
  sign.position.set(0,H+.25,fz+.32);g.add(sign);
  // covered porch over the front
  const awning=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.16,1.8),roofM);
  awning.position.set(0,H-.3,fz+.9);awning.castShadow=true;g.add(awning);
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,H-.4,8),trimM);
    post.position.set(sx*(W/2-.2),(H-.4)/2,fz+1.7);g.add(post);
  }
  // central door (recessed dark frame so it reads as the way in) + two windows
  const doorFrame=new THREE.Mesh(new THREE.BoxGeometry(1.3,2.3,.12),trimM);
  doorFrame.position.set(0,1.15,fz+.04);g.add(doorFrame);
  const door=new THREE.Mesh(new THREE.BoxGeometry(1,2,.1),doorM);
  door.position.set(0,1,fz+.1);g.add(door);
  for(const sx of[-1,1]){
    const win=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.3,.08),winM);
    win.position.set(sx*1.7,1.5,fz+.06);g.add(win);
  }
  g.userData.r=Math.max(W,D)/2+.3;g.userData.h=H+1.2;
  return g;
}

export default {category:'Rural',label:'General store',build};

// ---- interior helpers -------------------------------------------------------
function canvasTexture(w,h,draw){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}
function repeatTex(t,x,y){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(x,y);return t;}

const plankFloorTex=repeatTex(canvasTexture(128,128,(x,w,h)=>{
  x.fillStyle='#6e4a2c';x.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=16){
    x.fillStyle=y/16%2?'#7a5331':'#684527';x.fillRect(0,y,w,15);
    x.strokeStyle='rgba(40,24,12,.5)';x.lineWidth=1.5;
    x.beginPath();x.moveTo(0,y+15.5);x.lineTo(w,y+15.5);x.stroke();
  }
  for(let k=0;k<40;k++){x.fillStyle=`rgba(40,24,10,${Math.random()*.18})`;
    x.fillRect(Math.random()*w,Math.random()*h,Math.random()*22,1);}
}),5,4);
const plankWallTex=repeatTex(canvasTexture(128,128,(x,w,h)=>{
  x.fillStyle='#caa06a';x.fillRect(0,0,w,h);
  for(let xx=0;xx<w;xx+=18){
    x.fillStyle=xx/18%2?'#d3a972':'#bf9560';x.fillRect(xx,0,17,h);
    x.strokeStyle='rgba(70,44,22,.4)';x.lineWidth=1.5;
    x.beginPath();x.moveTo(xx+17.5,0);x.lineTo(xx+17.5,h);x.stroke();
  }
}),4,2);

const floorM=matte({map:plankFloorTex,roughness:.92});
const intWallM=matte({map:plankWallTex,roughness:.95});
const ceilM=matte({color:0x2a221a,roughness:.95});
const counterBodyM=matte({color:0x6b4327,roughness:.85});
const counterTopM=matte({color:0x8a5d34,roughness:.6});
const shelfM=matte({color:0x70492a,roughness:.8});
const crateM=matte({color:0x9c7338,roughness:.9});
const glowM=new THREE.MeshBasicMaterial({color:0xffe6b0});
const goodsCols=[0xb6402f,0x2f7a4a,0x3a5f9e,0xc89a3a,0x8a3f6e,0xcf7a2c];
const goodsMats=goodsCols.map(c=>matte({color:c,roughness:.6})); // shared per-colour, no per-can churn
const packCols=[0x3a8f4a,0xd8a32c,0xc7503a,0x2f6f8f,0x9a4f8f];
const packMats=packCols.map(c=>new THREE.MeshBasicMaterial({color:c}));
const paperM=matte({color:0xe9d9a8,roughness:.85});   // seed-packet card stock
const ironM=matte({color:0x1d1c1f,roughness:.7,metalness:.3}); // cast-iron stove / pipe
const brassM=matte({color:0xc89536,roughness:.4,metalness:.4});

// Wooden sign panel: a 512-wide canvas (so long titles never clip) with the font
// auto-shrunk to fit, the first line bigger than the rest.
function labelPanel(lines,w,h,{bg='#2a1a0e',fg='#ffe7b0',sub='#f4c542'}={}){
  const arr=String(lines).split('\n');
  const CW=512,CH=192,max=CW-48;
  const tex=canvasTexture(CW,CH,x=>{
    x.fillStyle=bg;x.fillRect(0,0,CW,CH);
    x.strokeStyle=sub;x.lineWidth=14;x.strokeRect(10,10,CW-20,CH-20);
    x.textAlign='center';x.textBaseline='middle';
    arr.forEach((line,i)=>{
      let fs=i===0?66:44;x.font=`900 ${fs}px monospace`;
      while(x.measureText(line).width>max&&fs>10){fs-=2;x.font=`900 ${fs}px monospace`;}
      const y=CH/2+(i-(arr.length-1)/2)*(CH*0.42);
      x.lineWidth=8;x.strokeStyle='#000';x.strokeText(line,CW/2,y);
      x.fillStyle=i===0?fg:sub;x.fillText(line,CW/2,y);
    });
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w,h),
    new THREE.MeshBasicMaterial({map:tex,transparent:true,side:THREE.DoubleSide}));
}

function addBox(x,y,z,w,h,d,mat){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;
  generalStoreInterior.add(m);return m;
}

// A wall shelf unit with rows of little canned/jarred goods (colored boxes).
function addShelfUnit(x,z,rotY,len){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotY;
  const back=new THREE.Mesh(new THREE.BoxGeometry(len,2.6,.12),shelfM);
  back.position.set(0,1.85,0);g.add(back);
  for(const y of[1.0,1.75,2.5]){
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(len,.08,.5),shelfM);
    shelf.position.set(0,y,.22);g.add(shelf);
    const n=Math.max(3,Math.floor(len/.6));
    for(let i=0;i<n;i++){
      const m=goodsMats[(i+Math.round(y*10))%goodsMats.length];
      const gx=-len/2+.35+i*((len-.7)/(n-1||1));
      let item; // alternate tins and boxed goods so the shelf reads as varied stock
      if(i%2){ item=new THREE.Mesh(new THREE.BoxGeometry(.26,.4,.22),m); item.position.set(gx,y+.24,.22); }
      else   { item=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.32,10),m); item.position.set(gx,y+.22,.22); }
      item.castShadow=true;g.add(item);
    }
  }
  generalStoreInterior.add(g);
}

// Stacked produce/feed sacks in a corner (just for set-dressing).
function addSacks(x,z){
  const g=new THREE.Group();g.position.set(x,0,z);
  const sackM=matte({color:0xb8a070,roughness:.95});
  for(const[dx,dz,dy] of[[0,0,0],[.42,.05,0],[.2,-.35,0],[.22,-.1,.42]]){
    const s=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),sackM);
    s.scale.set(1,.8,1);s.position.set(dx,.26+dy,dz);s.castShadow=true;g.add(s);
  }
  generalStoreInterior.add(g);
}

// The SEED counter centerpiece: an open crate of seed packets on the counter top,
// with a SEEDS sign. Kept on genStoreFx.seedCrate so js/general-store.js can bob it.
const cardGeo=new THREE.BoxGeometry(.02,.30,.16);  // a seed packet (thin in x → faces the customer)
const headGeo=new THREE.BoxGeometry(.022,.09,.16); // its coloured header strip
function addSeedCrate(x,topY,z){
  const g=new THREE.Group();g.position.set(x,topY,z);
  const crate=new THREE.Mesh(new THREE.BoxGeometry(1.4,.5,.9),crateM);
  crate.position.y=.25;crate.castShadow=true;g.add(crate);
  // a slat front so it reads as an open produce crate, not a solid block
  for(const sz of[-.3,0,.3]){
    const slat=new THREE.Mesh(new THREE.BoxGeometry(.04,.46,.18),shelfM);
    slat.position.set(-.7,.25,sz);g.add(slat);
  }
  // rows of upright seed packets, broad face toward the customer (west, -x)
  for(let i=0;i<7;i++){
    const z0=-.34+i*.11, lean=(Math.random()-.5)*.12;
    const card=new THREE.Mesh(cardGeo,paperM);
    card.position.set(-.46,.62,z0);card.rotation.x=lean;card.castShadow=true;g.add(card);
    const head=new THREE.Mesh(headGeo,packMats[i%packMats.length]);
    head.position.set(-.462,.735,z0);head.rotation.x=lean;g.add(head);
  }
  generalStoreInterior.add(g);
  return g;
}

// An old brass cash register sitting on the counter.
function addRegister(x,y,z,rotY){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotY;
  const base=new THREE.Mesh(new THREE.BoxGeometry(.62,.16,.5),matte({color:0x5a3c22,roughness:.6}));
  base.position.y=.08;base.castShadow=true;g.add(base);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.5,.34,.4),brassM);
  body.position.y=.33;body.castShadow=true;g.add(body);
  const screen=new THREE.Mesh(new THREE.BoxGeometry(.4,.22,.05),matte({color:0x223a2a,roughness:.35}));
  screen.position.set(0,.55,-.13);screen.rotation.x=-.32;g.add(screen);
  const keys=new THREE.Mesh(new THREE.BoxGeometry(.44,.05,.24),matte({color:0x2a2420,roughness:.6}));
  keys.position.set(0,.46,.12);keys.rotation.x=.18;g.add(keys);
  generalStoreInterior.add(g);
}
// A pot-belly cast-iron stove with a stovepipe to the ceiling and an ember glow —
// the heart of any old country store.
function addStove(x,z,ceilY){
  const g=new THREE.Group();g.position.set(x,0,z);
  const belly=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,.82,16),ironM);
  belly.position.y=.62;belly.castShadow=true;g.add(belly);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.28,.42,.3,16),ironM);
  cap.position.y=1.16;g.add(cap);
  for(let k=0;k<4;k++){const a=k*Math.PI/2+Math.PI/4;
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.42,6),ironM);
    leg.position.set(Math.cos(a)*.32,.2,Math.sin(a)*.32);g.add(leg);}
  const pipeLen=ceilY-1.0;
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,pipeLen,10),ironM);
  pipe.position.y=1.3+pipeLen/2;g.add(pipe);
  const door=new THREE.Mesh(new THREE.CircleGeometry(.2,16),
    new THREE.MeshBasicMaterial({color:0xff7a1e}));
  door.position.set(0,.58,-.5);door.rotation.y=Math.PI;g.add(door);
  const ember=new THREE.PointLight(0xff7a2a,7,6,2);ember.position.set(0,.7,-.9);g.add(ember);
  generalStoreInterior.add(g);
}
// A hooped wooden barrel of apples.
function addBarrel(x,z){
  const g=new THREE.Group();g.position.set(x,0,z);
  const woodM=matte({color:0x7a4e28,roughness:.9});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.34,.3,.92,16),woodM);
  body.position.y=.46;body.castShadow=true;g.add(body);
  for(const hy of[.14,.46,.78]){
    const hoop=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.06,16),ironM);
    hoop.position.y=hy;g.add(hoop);
  }
  const appleM=matte({color:0xcf3a2e,roughness:.5});
  for(let k=0;k<6;k++){const a=k*1.05;
    const ap=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),appleM);
    ap.position.set(Math.cos(a)*.16,.95,Math.sin(a)*.16);g.add(ap);}
  generalStoreInterior.add(g);
}
// A glass candy jar for the counter.
function addCandyJar(x,y,z,candyCol){
  const g=new THREE.Group();g.position.set(x,y,z);
  const jar=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.26,14),
    matte({color:0xbfe0ea,roughness:.1,transparent:true,opacity:.4,depthWrite:false}));
  jar.position.y=.13;g.add(jar);
  const candy=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.2,12),
    new THREE.MeshBasicMaterial({color:candyCol}));
  candy.position.y=.12;g.add(candy);
  const lid=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.04,14),brassM);
  lid.position.y=.28;g.add(lid);
  generalStoreInterior.add(g);
}

function buildInterior(){
  const {x:cx,z:cz}=INT_CENTER;
  const HW=8, HD=6;                 // wall ring half-extents (16 x 12 footprint)
  const X0=cx-HW, X1=cx+HW, Z0=cz-HD, Z1=cz+HD, WALL_H=5.0; // ceiling clears the camera (bounds y1=4.6)

  // floor + ceiling + a black outer shell so no void shows past the walls
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(HW*2-.4,HD*2-.4),floorM);
  floor.rotation.x=-Math.PI/2;floor.position.set(cx,.02,cz);
  floor.receiveShadow=true;generalStoreInterior.add(floor);
  addBox(cx,WALL_H-.05,cz,HW*2+.4,.2,HD*2+.4,ceilM);
  const outer=new THREE.Mesh(new THREE.BoxGeometry(HW*2+3,WALL_H+5,HD*2+3),
    new THREE.MeshBasicMaterial({color:0x07060a,side:THREE.BackSide}));
  outer.position.set(cx,(WALL_H+5)/2-1,cz);generalStoreInterior.add(outer);

  // four walls (planks)
  addBox(X0+.1,WALL_H/2,cz,.4,WALL_H,HD*2+.4,intWallM); // west
  addBox(X1-.1,WALL_H/2,cz,.4,WALL_H,HD*2+.4,intWallM); // east
  addBox(cx,WALL_H/2,Z0+.1,HW*2+.4,WALL_H,.4,intWallM); // north
  addBox(cx,WALL_H/2,Z1-.1,HW*2+.4,WALL_H,.4,intWallM); // south

  // store sign on the far (east) wall, behind the counter (just clear of the wall face)
  const sign=labelPanel('GENERAL STORE\nSEEDS & SUPPLIES',5.2,1.5,{});
  sign.position.set(X1-.55,3.2,cz);sign.rotation.y=-Math.PI/2;
  generalStoreInterior.add(sign);

  // wall shelving full of canned goods (north & south walls) + a sack pile
  addShelfUnit(cx-3,Z0+.35,0,6.4);
  addShelfUnit(cx+3,Z1-.35,Math.PI,6.4);
  addSacks(X0+1.2,Z1-1.3);

  // country-store character: a pot-belly stove (with its ember glow + pipe to the
  // ceiling), an apple barrel by the door, and a woven mat at the entrance.
  addStove(cx+3.5,Z0+.95,WALL_H-.1);
  addBarrel(X0+1.3,Z0+1.3);
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.4), // 1.7 into the room, 2.4 along the doorway
    matte({color:0x6e2b2b,roughness:.95}));
  rug.rotation.x=-Math.PI/2;
  rug.position.set(INT_SPAWN.x,.03,cz);generalStoreInterior.add(rug);

  // sales counter island near the east wall; player buys at its front (west) edge
  const counterZ=cz, counterX=cx+4.5;       // -795.5
  const body=addBox(counterX,.5,counterZ,1.4,1.0,6.0,counterBodyM);
  body.castShadow=true;
  addBox(counterX,1.05,counterZ,1.7,.12,6.4,counterTopM);   // overhanging top
  addBox(counterX-.72,.62,counterZ,.06,.1,6.2,counterTopM); // front trim line
  addRegister(counterX,1.11,counterZ+2.1,0);                // brass register, off to one side
  addCandyJar(counterX,1.11,counterZ+1.25,0xc7503a);        // two candy jars on the counter
  addCandyJar(counterX,1.11,counterZ+1.62,0x2f8f4a);
  // the seed crate sits on the counter, front-and-center
  genStoreFx.seedCrate=addSeedCrate(counterX-.1,1.11,counterZ-1.0);
  const seedSign=labelPanel('SEEDS',2.0,.7,{bg:'#1c3a1f',fg:'#d7ffcf',sub:'#7fe07f'});
  seedSign.position.set(counterX-.85,1.9,counterZ-1.0);seedSign.rotation.y=-Math.PI/2; // face the customer (west)
  generalStoreInterior.add(seedSign);

  // shopkeeper behind the counter, facing the customer (west)
  const keeper=makePed(0x6b4a2c,0xb8843f);
  keeper.position.set(counterX+.95,0,counterZ);keeper.rotation.y=-Math.PI/2;
  generalStoreInterior.add(keeper);
  genStoreFx.keeper={g:keeper,t:Math.random()*6};

  // ceiling lamps (warm) + an overall fill light
  for(const lx of[cx-3.5,cx+3.5]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(3.0,.1,.4),glowM);
    bar.position.set(lx,WALL_H-.3,cz);generalStoreInterior.add(bar);
    const l=new THREE.PointLight(0xffe2ad,14,18,1.7);
    l.position.set(lx,WALL_H-.6,cz);generalStoreInterior.add(l);
  }
  const fill=new THREE.PointLight(0xffe9c8,55,40,1.6);
  fill.position.set(cx,WALL_H-.7,cz);generalStoreInterior.add(fill);
  // a warm pendant bulb hanging over the sales counter (emissive mesh — no extra
  // light needed; the fill + ceiling bars already light the counter)
  const cord=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,1.3,6),matte({color:0x221f18,roughness:.8}));
  cord.position.set(cx+4.5,WALL_H-.85,cz-1.0);generalStoreInterior.add(cord);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.12,10,8),glowM);
  bulb.position.set(cx+4.5,WALL_H-1.55,cz-1.0);generalStoreInterior.add(bulb);

  // inner exit door (west wall) + bouncing arrow
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.14,2.6,1.7),doorM);
  exitDoor.position.set(X0+.28,1.3,cz);generalStoreInterior.add(exitDoor);
  const exitSign=labelPanel('EXIT',1.1,.42,{bg:'#2a1a0e',fg:'#ffe7b0',sub:'#f4c542'});
  exitSign.position.set(X0+.42,2.85,cz);exitSign.rotation.y=Math.PI/2;
  generalStoreInterior.add(exitSign);
  genStoreFx.exitArrow=makeDoorArrow();
  genStoreFx.exitArrow.position.set(INT_DOOR.x,1.7,INT_DOOR.z);
  generalStoreInterior.add(genStoreFx.exitArrow);
}

export function addGeneralStore(solids){
  // ----- exterior: the baked storefront, dropped on the village main street -----
  const ext=build();
  ext.position.set(GENSTORE_CX,-.02,GENSTORE_CZ);ext.rotation.y=GENSTORE_RY;
  bakeProp(ext);
  // body collision (the porch overhang stays walkable)
  const footprint={x0:GENSTORE_CX-3.2,x1:GENSTORE_CX+3.2,z0:GENSTORE_CZ-2.8,z1:GENSTORE_CZ+2.8};
  solids.push({...footprint,h:4.4});

  // a bouncing arrow over the street door so the entrance reads as enterable.
  // Lives in a tiny "facade" group the Interior base hides if the camera ever
  // ends up inside the building footprint (e.g. snapping back on exit).
  const facade=new THREE.Group();
  genStoreFx.facadeArrow=makeDoorArrow();
  genStoreFx.facadeArrow.position.set(GENSTORE_DOOR.x,1.7,GENSTORE_DOOR.z-.4);
  facade.add(genStoreFx.facadeArrow);
  scene.add(facade);
  genStoreFx.facade=facade;
  genStoreFx.footprint=footprint;

  // ----- interior: the off-map room, lit only while the player is inside -----
  buildInterior();
  scene.add(generalStoreInterior);

  // interior wall + counter collision (player can't leave except via the door)
  const {x:cx,z:cz}=INT_CENTER, HW=8, HD=6, WH=5.0;
  solids.push(
    {x0:cx-HW-.3,x1:cx-HW+.5,z0:cz-HD-.3,z1:cz+HD+.3,h:WH}, // west
    {x0:cx+HW-.5,x1:cx+HW+.3,z0:cz-HD-.3,z1:cz+HD+.3,h:WH}, // east
    {x0:cx-HW-.3,x1:cx+HW+.3,z0:cz-HD-.3,z1:cz-HD+.5,h:WH}, // north
    {x0:cx-HW-.3,x1:cx+HW+.3,z0:cz+HD-.5,z1:cz+HD+.3,h:WH}, // south
    {x0:cx+3.7,x1:cx+5.3,z0:cz-3.2,z1:cz+3.2,h:1.1},        // sales counter
  );
}
