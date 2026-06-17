import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';
import {scene} from '../../../js/engine.js';
import {makePed} from '../characters/pedestrian.js';
import {makeDoorArrow} from '../city/door-arrow.js';
import {lampGlowMat,lampHaloMat,lampBulbMat} from '../props/street-lamp.js'; // night porch light
import {STRAINS,FERTILIZER} from '../../../js/strains.js'; // seed-counter + plant-food display data

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
// The three strain displays along the sales counter (world coords). js/general-store.js
// finds the nearest one and offers THAT strain for sale — pick which to buy by walking
// the counter, like the gun-shop. One entry per strain in js/strains.js.
const _SEED_DZ=[-1.5,0,1.5];
export const SEED_DISPLAYS=STRAINS.map((s,i)=>({id:s.id,x:-800+4.05,z:-560+(_SEED_DZ[i]||0)}));
// plant food is bought at the corner feed-sacks (SW corner of the room)
export const FERT_DISPLAY={x:-800-8+1.2, z:-560+6-1.3};

export const genStoreFx={keeper:null,exitArrow:null,facade:null,facadeArrow:null,
  footprint:null,seedCrates:[]};
export const generalStoreInterior=new THREE.Group();
generalStoreInterior.visible=false;

// ---- exterior textures (warm honey clapboards, porch boards) ----
const plankExtTex=repeatTex(canvasTexture(128,128,(x,w,h)=>{
  x.fillStyle='#c98a52';x.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=12){
    x.fillStyle=(y/12)%2?'#cf905a':'#bd7e48';x.fillRect(0,y,w,11);   // clapboard courses
    x.strokeStyle='rgba(70,42,20,.45)';x.lineWidth=1.5;
    x.beginPath();x.moveTo(0,y+11.4);x.lineTo(w,y+11.4);x.stroke();
  }
  for(let k=0;k<48;k++){x.fillStyle=`rgba(80,48,22,${Math.random()*.16})`;
    x.fillRect(Math.random()*w,Math.random()*h,Math.random()*20,1);}   // grain flecks
}),2,1.5);
const deckTex=repeatTex(canvasTexture(128,128,(x,w,h)=>{
  x.fillStyle='#7a5232';x.fillRect(0,0,w,h);
  for(let xx=0;xx<w;xx+=20){
    x.fillStyle=(xx/20)%2?'#80582f':'#6e4a2a';x.fillRect(xx,0,19,h);
    x.strokeStyle='rgba(35,22,10,.5)';x.lineWidth=1.5;
    x.beginPath();x.moveTo(xx+19.4,0);x.lineTo(xx+19.4,h);x.stroke();
  }
}),3,3);

// ---- exterior materials ----
const bodyM=matte({map:plankExtTex,roughness:.92});
const frontM=matte({color:0xb87a48,roughness:.95});       // false front (flat, darker)
const roofM=matte({color:0x5b5048,roughness:.9});
const trimM=matte({color:0x5e3c24,roughness:.85});
const winM=matte({color:0x9ecbe0,roughness:.3,metalness:.1});
const doorM=matte({color:0x6e4a32,roughness:.9});
const deckM=matte({map:deckTex,roughness:.9});
const stoneM=matte({color:0x6f6a62,roughness:1});         // foundation course
const barrelWoodM=matte({color:0x8a5a30,roughness:.9});
const hoopM=matte({color:0x4a3320,roughness:.6,metalness:.3});
const crateWoodM=matte({color:0x9c7338,roughness:.9});
const benchM=matte({color:0x6e4a2c,roughness:.9});
const brassM=matte({color:0xc89536,roughness:.4,metalness:.4});
const pipeM=matte({color:0x3a3530,roughness:.7,metalness:.3}); // stovepipe
const produceMats=[0xb6402f,0x2f7a4a,0xc89a3a,0xcf7a2c,0x8a3f6e].map(c=>matte({color:c,roughness:.6}));

let signTex=null;
function signTexture(){
  if(signTex)return signTex;
  signTex=canvasTexture(512,96,(x)=>{
    x.fillStyle='#33200f';x.fillRect(0,0,512,96);
    x.strokeStyle='rgba(18,10,4,.5)';x.lineWidth=2;                  // plank seams
    for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,i*24);x.lineTo(512,i*24);x.stroke();}
    x.textAlign='center';x.textBaseline='middle';x.font='900 46px Georgia, serif';
    x.lineWidth=5;x.strokeStyle='#150c05';x.strokeText('GENERAL STORE',256,52);
    x.fillStyle='#f2e3c0';x.fillText('GENERAL STORE',256,49);
  });
  return signTex;
}
let chalkTex=null;
function chalkTexture(){
  if(chalkTex)return chalkTex;
  chalkTex=canvasTexture(128,176,(x)=>{
    x.fillStyle='#23302a';x.fillRect(0,0,128,176);
    x.textAlign='center';x.textBaseline='middle';x.fillStyle='#e8f0d8';
    x.font='900 20px monospace';
    x.fillText('SEEDS',64,38);x.fillText('FEED',64,74);
    x.fillText('DRY',64,116);x.fillText('GOODS',64,144);
  });
  return chalkTex;
}
let hangTex=null;
function hangTexture(){
  if(hangTex)return hangTex;
  hangTex=canvasTexture(128,96,(x)=>{
    x.fillStyle='#e6d3a8';x.fillRect(0,0,128,96);
    x.strokeStyle='#5e3c24';x.lineWidth=6;x.strokeRect(5,5,118,86);
    x.fillStyle='#5e3c24';x.textAlign='center';x.textBaseline='middle';
    x.font='900 30px Georgia, serif';x.fillText('STORE',64,50);
  });
  return hangTex;
}

// ---- small porch props ----
function extBarrel(){
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.3,.26,.84,14),barrelWoodM);
  b.position.y=.42;b.castShadow=true;g.add(b);
  for(const y of[.14,.42,.7]){
    const hp=new THREE.Mesh(new THREE.CylinderGeometry(.315,.315,.05,14),hoopM);
    hp.position.y=y;g.add(hp);
  }
  return g;
}
function extCrate(produce){
  const g=new THREE.Group();
  const box=new THREE.Mesh(new THREE.BoxGeometry(.8,.58,.6),crateWoodM);
  box.position.y=.29;box.castShadow=true;g.add(box);
  for(const y of[.12,.46]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(.84,.05,.62),benchM);
    s.position.y=y;g.add(s);
  }
  if(produce)for(let i=0;i<5;i++){
    const p=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),produceMats[i%produceMats.length]);
    p.position.set(-.24+(i%3)*.24,.64,-.14+Math.floor(i/3)*.28);g.add(p);
  }
  return g;
}
function extBench(){
  const g=new THREE.Group();
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.5,.1,.46),benchM);
  seat.position.y=.48;seat.castShadow=true;g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(1.5,.46,.1),benchM);
  back.position.set(0,.72,-.18);g.add(back);
  for(const sx of[-1,1]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.48,.44),benchM);
    leg.position.set(sx*.62,.24,0);g.add(leg);
  }
  return g;
}
// A-frame 'specials' chalkboard that stands on the porch deck.
function extChalkSign(){
  const g=new THREE.Group();
  const boardM=new THREE.MeshBasicMaterial({map:chalkTexture(),side:THREE.DoubleSide});
  for(const s of[1,-1]){
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(.6,.9),boardM);
    panel.position.set(0,.55,s*.13);panel.rotation.x=s*.16;g.add(panel);
  }
  const batten=new THREE.Mesh(new THREE.BoxGeometry(.64,.05,.34),trimM);
  batten.position.set(0,.12,0);g.add(batten);
  return g;
}

function build(){
  const g=new THREE.Group();
  const W=6,D=5,H=3.2,fz=D/2;

  // ---- main body (clapboards) on a stone foundation course ----
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),bodyM);
  body.position.y=H/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
  const base=new THREE.Mesh(new THREE.BoxGeometry(W+.12,.3,D+.12),stoneM);
  base.position.y=.15;base.receiveShadow=true;g.add(base);
  // corner trim boards (front two)
  for(const sx of[-1,1]){
    const corner=new THREE.Mesh(new THREE.BoxGeometry(.16,H,.16),trimM);
    corner.position.set(sx*W/2,H/2,fz);g.add(corner);
  }
  // shallow roof with a small overhang + a stovepipe (matches the inside stove)
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W+.3,.2,D+.3),roofM);
  roof.position.y=H+.1;roof.castShadow=true;g.add(roof);
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,1.4,10),pipeM);
  pipe.position.set(1.4,H+.85,-1.2);pipe.castShadow=true;g.add(pipe);
  const pcap=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.14,10),pipeM);
  pcap.position.set(1.4,H+1.5,-1.2);g.add(pcap);

  // ---- false front: a parapet that rises ABOVE the storefront (must NOT cover the
  // door/windows below it — that was hiding the whole shopfront) + cornice + sign ----
  const PARA_BASE=H-.2, PARA_TOP=H+1.4;              // 3.0 .. 4.6 (above the awning line)
  const front=new THREE.Mesh(new THREE.BoxGeometry(W+.2,PARA_TOP-PARA_BASE,.3),frontM);
  front.position.set(0,(PARA_BASE+PARA_TOP)/2,fz+.15);front.castShadow=true;g.add(front);
  const fcap=new THREE.Mesh(new THREE.BoxGeometry(W+.5,.24,.55),trimM);
  fcap.position.set(0,PARA_TOP,fz+.15);g.add(fcap);
  // corner pilasters frame the whole facade (storefront + parapet)
  for(const sx of[-1,1]){
    const pil=new THREE.Mesh(new THREE.BoxGeometry(.22,PARA_TOP,.36),trimM);
    pil.position.set(sx*(W/2+.0),PARA_TOP/2,fz+.16);g.add(pil);
  }
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(W-.5,.95),
    new THREE.MeshBasicMaterial({map:signTexture()}));
  sign.position.set(0,(PARA_BASE+PARA_TOP)/2,fz+.32);g.add(sign);

  // ---- covered porch: awning, valance, front beam, posts + knee braces ----
  const awning=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.16,1.9),roofM);
  awning.position.set(0,H-.3,fz+.95);awning.castShadow=true;g.add(awning);
  const valance=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.32,.06),trimM);
  valance.position.set(0,H-.5,fz+1.88);g.add(valance);
  const beam=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.16,.16),trimM);
  beam.position.set(0,H-.46,fz+1.84);g.add(beam);
  for(const sx of[-1,1]){
    const px=sx*(W/2-.2);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,H-.4,8),trimM);
    post.position.set(px,(H-.4)/2,fz+1.8);post.castShadow=true;g.add(post);
    const brace=new THREE.Mesh(new THREE.BoxGeometry(.08,.55,.08),trimM);
    brace.position.set(px-sx*.2,H-.75,fz+1.62);brace.rotation.z=sx*0.7;g.add(brace);
    // side railing between the building and the front post
    const rail=new THREE.Mesh(new THREE.BoxGeometry(.08,.08,1.7),trimM);
    rail.position.set(px,.95,fz+.95);g.add(rail);
    for(let i=0;i<3;i++){
      const bal=new THREE.Mesh(new THREE.BoxGeometry(.05,.85,.05),trimM);
      bal.position.set(px,.5,fz+.4+i*.6);g.add(bal);
    }
  }
  // raised plank boardwalk + a step lip
  const deck=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.12,2.0),deckM);
  deck.position.set(0,.06,fz+1.0);deck.receiveShadow=true;g.add(deck);
  const step=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.1,.4),deckM);
  step.position.set(0,-.0,fz+2.1);g.add(step);

  // ---- two display windows (frame + glass + muntins) ----
  for(const sx of[-1,1]){
    const wx=sx*1.7;
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.5,.12),trimM);
    frame.position.set(wx,1.55,fz+.02);g.add(frame);
    const glass=new THREE.Mesh(new THREE.BoxGeometry(1.55,1.25,.06),winM);
    glass.position.set(wx,1.55,fz+.08);g.add(glass);
    const mv=new THREE.Mesh(new THREE.BoxGeometry(.05,1.25,.08),trimM);
    mv.position.set(wx,1.55,fz+.1);g.add(mv);
    const mh=new THREE.Mesh(new THREE.BoxGeometry(1.55,.05,.08),trimM);
    mh.position.set(wx,1.55,fz+.1);g.add(mh);
  }

  // ---- door: frame, slab, upper pane, knob ----
  const doorFrame=new THREE.Mesh(new THREE.BoxGeometry(1.3,2.3,.12),trimM);
  doorFrame.position.set(0,1.15,fz+.04);g.add(doorFrame);
  const door=new THREE.Mesh(new THREE.BoxGeometry(1,2.1,.1),doorM);
  door.position.set(0,1.05,fz+.1);g.add(door);
  const pane=new THREE.Mesh(new THREE.BoxGeometry(.55,.5,.04),winM);
  pane.position.set(0,1.85,fz+.16);g.add(pane);
  const knob=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),brassM);
  knob.position.set(.34,1.0,fz+.16);g.add(knob);

  // ---- 'specials' chalkboard: an A-frame on the deck, left of the entrance
  // (free-standing, so it never covers the windows) ----
  const chalkSign=extChalkSign();chalkSign.position.set(-1.6,.12,fz+1.85);g.add(chalkSign);

  // ---- hanging bracket sign on the porch, facing along the street ----
  const bracket=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,.7),trimM);
  bracket.position.set(-(W/2-.2),H-.55,fz+1.5);g.add(bracket);
  for(const dz of[1.2,1.8]){
    const chain=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.3,4),hoopM);
    chain.position.set(-(W/2-.2),H-.7,fz+dz);g.add(chain);
  }
  const hang=new THREE.Mesh(new THREE.PlaneGeometry(.78,.52),
    new THREE.MeshBasicMaterial({map:hangTexture(),side:THREE.DoubleSide}));
  hang.position.set(-(W/2-.2),H-.95,fz+1.5);hang.rotation.y=Math.PI/2;g.add(hang);

  // ---- porch goods + seating (kept off the central approach to the door) ----
  const crate=extCrate(true);crate.position.set(-2.2,.12,fz+1.2);g.add(crate);     // produce, left
  const crate2=extCrate(false);crate2.position.set(-2.55,.12,fz+1.55);crate2.scale.setScalar(.78);g.add(crate2);
  const barrel=extBarrel();barrel.position.set(2.15,.12,fz+0.75);g.add(barrel);    // barrel, right (by the wall)
  const bench=extBench();bench.position.set(2.5,.12,fz+1.35);bench.rotation.y=-Math.PI/2;g.add(bench); // faces the door

  // ---- porch lamp: emissive bulb in a small cage + a night ground-glow pool ----
  const lantern=new THREE.Group();lantern.position.set(0,2.5,fz+.5);
  const lcap=new THREE.Mesh(new THREE.ConeGeometry(.12,.1,6),trimM);
  lcap.position.y=.14;lantern.add(lcap);
  const lbulb=new THREE.Mesh(new THREE.SphereGeometry(.09,8,6),lampBulbMat);
  lantern.add(lbulb);
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2;
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.012,.22,.012),trimM);
    bar.position.set(Math.cos(a)*.09,0,Math.sin(a)*.09);lantern.add(bar);
  }
  g.add(lantern);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(4,4),lampGlowMat);
  glow.rotation.x=-Math.PI/2;glow.position.set(0,.07,fz+.7);glow.renderOrder=2;g.add(glow);

  g.userData.r=Math.max(W,D)/2+1.4;g.userData.h=H+1.2;
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
// Muted, real-grocery product tones grouped PER SHELF ROW, so the stock reads as
// ordered stock rather than a cartoon rainbow. Everything is lit (matte), labeled.
const goodsRows=[
  [0x9c4a3a,0xab5a44,0x854335],  // tinned tomato / soup — dull reds
  [0x66734a,0x77855a,0x57633f],  // canned veg — olive / sage
  [0x4f6170,0xb0944e,0x7a5440],  // dry goods — steel blue, mustard, brown
];
const goodsMats=goodsRows.map(row=>row.map(c=>matte({color:c,roughness:.64})));
const labelM=matte({color:0xd8cdb2,roughness:.82});            // cream paper label
const ironM=matte({color:0x1d1c1f,roughness:.7,metalness:.3}); // cast-iron stove / pipe
// seed-packet card stock (the coloured header is tinted per strain in makeSeedDisplay)
const paperM=matte({color:0xd9c9a0,roughness:.85});
// (brassM is declared with the exterior materials near the top of the file)

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

// A wall shelf unit stocked with LABELLED goods — tins (coloured label body with a
// cream text band) and boxed dry goods (kraft box with a printed front panel). Each
// row keeps to one muted palette so it reads as ordered grocery stock.
function addShelfUnit(x,z,rotY,len){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=rotY;
  const back=new THREE.Mesh(new THREE.BoxGeometry(len,2.6,.12),shelfM);
  back.position.set(0,1.85,0);g.add(back);
  [1.0,1.75,2.5].forEach((y,row)=>{
    const shelf=new THREE.Mesh(new THREE.BoxGeometry(len,.08,.5),shelfM);
    shelf.position.set(0,y,.22);g.add(shelf);
    const pal=goodsMats[row%goodsMats.length];
    const n=Math.max(3,Math.floor(len/.82));
    for(let i=0;i<n;i++){
      const m=pal[i%pal.length];
      const gx=-len/2+.4+i*((len-.8)/(n-1||1));
      if(i%3===2){ // a boxed dry good with a printed front panel
        const box=new THREE.Mesh(new THREE.BoxGeometry(.24,.42,.2),m);
        box.position.set(gx,y+.25,.22);box.castShadow=true;g.add(box);
        const lab=new THREE.Mesh(new THREE.PlaneGeometry(.18,.26),labelM);
        lab.position.set(gx,y+.27,.321);g.add(lab);
      }else{ // a tin can: coloured label body + a cream text band around the middle
        const can=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.3,12),m);
        can.position.set(gx,y+.21,.22);can.castShadow=true;g.add(can);
        const band=new THREE.Mesh(new THREE.CylinderGeometry(.103,.103,.12,12),labelM);
        band.position.set(gx,y+.21,.22);g.add(band);
      }
    }
  });
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

// One seed display per strain on the counter: an open crate with a few packets in
// the strain's colour + a heap of buds, plus a NAME / $PRICE tag facing the customer.
// Returned so js/general-store.js can bob it; the gameplay there finds the nearest
// display (SEED_DISPLAYS) and offers that strain for sale — pick by walking the counter.
const cardGeo=new THREE.BoxGeometry(.02,.28,.15);  // a seed packet (thin in x → faces the customer)
const headGeo=new THREE.BoxGeometry(.022,.085,.15); // its coloured header strip
function makeSeedDisplay(s){
  const g=new THREE.Group();
  const headM=matte({color:s.color,roughness:.8});  // strain-coloured packet header + buds
  const crate=new THREE.Mesh(new THREE.BoxGeometry(.62,.32,.58),crateM);
  crate.position.y=.16;crate.castShadow=true;g.add(crate);
  for(const sz of[-.18,.18]){                        // slat front
    const slat=new THREE.Mesh(new THREE.BoxGeometry(.03,.3,.16),shelfM);
    slat.position.set(-.31,.16,sz);g.add(slat);
  }
  for(let i=0;i<4;i++){                              // upright seed packets
    const z0=-.18+i*.12, lean=(Math.random()-.5)*.1;
    const card=new THREE.Mesh(cardGeo,paperM);
    card.position.set(-.2,.42,z0);card.rotation.x=lean;g.add(card);
    const head=new THREE.Mesh(headGeo,headM);
    head.position.set(-.202,.535,z0);head.rotation.x=lean;g.add(head);
  }
  for(let i=0;i<5;i++){                              // a little heap of strain-coloured buds
    const b=new THREE.Mesh(new THREE.IcosahedronGeometry(.05,0),headM);
    b.position.set(.05+Math.random()*.18,.34+Math.random()*.04,-.18+Math.random()*.36);g.add(b);
  }
  const tag=labelPanel(`${s.name}\n$${s.price}`,.95,.52,{bg:'#241a0e',fg:'#f0e2c0',sub:'#cdab63'});
  tag.position.set(0,.78,0);tag.rotation.y=-Math.PI/2;g.add(tag);
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
  // cast-iron door with a small fire-box grate glowing low (not a neon disc)
  const doorPlate=new THREE.Mesh(new THREE.CircleGeometry(.22,16),ironM);
  doorPlate.position.set(0,.58,-.502);doorPlate.rotation.y=Math.PI;g.add(doorPlate);
  const grate=new THREE.Mesh(new THREE.PlaneGeometry(.26,.12),
    new THREE.MeshBasicMaterial({color:0xc2521a}));
  grate.position.set(0,.5,-.503);grate.rotation.y=Math.PI;g.add(grate);
  const ember=new THREE.PointLight(0xd8662a,4,5,2.2);ember.position.set(0,.6,-.85);g.add(ember);
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
  const appleM=matte({color:0x9e4434,roughness:.6}); // muted, ripe — not candy-red
  for(let k=0;k<6;k++){const a=k*1.05;
    const ap=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),appleM);
    ap.position.set(Math.cos(a)*.16,.95,Math.sin(a)*.16);g.add(ap);}
  generalStoreInterior.add(g);
}
// A glass jar of dry goods for the counter.
function addCandyJar(x,y,z,candyCol){
  const g=new THREE.Group();g.position.set(x,y,z);
  const jar=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,.26,14),
    matte({color:0xcfe2e6,roughness:.12,transparent:true,opacity:.32,depthWrite:false}));
  jar.position.y=.13;g.add(jar);
  const candy=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.2,12),
    matte({color:candyCol,roughness:.7}));   // lit, so it shades like real contents
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
  // the feed-sacks double as the PLANT FOOD counter (buy point — see js/general-store.js)
  const fertTag=labelPanel(`${FERTILIZER.name}\n$${FERTILIZER.price}`,1.05,.6,{bg:'#1e2a16',fg:'#e6dcc0',sub:'#9caa82'});
  fertTag.position.set(FERT_DISPLAY.x+.55,1.25,FERT_DISPLAY.z);fertTag.rotation.y=Math.PI/2; // faces the room (east)
  generalStoreInterior.add(fertTag);

  // country-store character: a pot-belly stove (with its ember glow + pipe to the
  // ceiling), an apple barrel by the door, and a woven mat at the entrance.
  addStove(cx+3.5,Z0+.95,WALL_H-.1);
  addBarrel(X0+1.3,Z0+1.3);
  const rug=new THREE.Mesh(new THREE.PlaneGeometry(1.7,2.4), // 1.7 into the room, 2.4 along the doorway
    matte({color:0x6b4636,roughness:.97}));   // faded worn brown-red mat
  rug.rotation.x=-Math.PI/2;
  rug.position.set(INT_SPAWN.x,.03,cz);generalStoreInterior.add(rug);

  // sales counter island near the east wall; player buys at its front (west) edge
  const counterZ=cz, counterX=cx+4.5;       // -795.5
  const body=addBox(counterX,.5,counterZ,1.4,1.0,6.0,counterBodyM);
  body.castShadow=true;
  addBox(counterX,1.05,counterZ,1.7,.12,6.4,counterTopM);   // overhanging top
  addBox(counterX-.72,.62,counterZ,.06,.1,6.2,counterTopM); // front trim line
  addRegister(counterX,1.11,counterZ+2.45,0);   // brass register at the south end
  addCandyJar(counterX,1.11,counterZ+2.0,0x8a5a36); // one jar of dry goods by the register
  // THREE strain displays along the counter — pick which to buy by walking the counter
  genStoreFx.seedCrates=SEED_DISPLAYS.map(d=>{
    const s=STRAINS.find(st=>st.id===d.id);
    const disp=makeSeedDisplay(s);disp.position.set(d.x,1.11,d.z);
    generalStoreInterior.add(disp);return disp;
  });
  const seedSign=labelPanel('SEEDS - PICK A STRAIN',3.0,.6,{bg:'#2a3326',fg:'#e6dcc0',sub:'#9caa82'});
  seedSign.position.set(counterX-.85,2.4,counterZ);seedSign.rotation.y=-Math.PI/2; // faces the customer (west)
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
  // porch-lamp bloom halo (sprites can't bake) — over the door, faded in at night
  const halo=new THREE.Sprite(lampHaloMat);
  halo.position.set(GENSTORE_CX,2.5,GENSTORE_CZ-3.0);halo.scale.set(2.0,2.0,1);
  scene.add(halo);
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
