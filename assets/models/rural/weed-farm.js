import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';
import {scene} from '../../../js/engine.js'; // halo sprites are added individually (bakeProp skips sprites)
// Shared night-faded lamp materials (driven by js/daynight.js): the ground-glow
// pool + bulb tint + halo sprite that street lamps use. Reusing them lights the
// grow yard at night for free — no real lights, no daynight edits.
import {lampGlowMat,lampHaloMat,lampBulbMat} from '../props/street-lamp.js';

// ============================================================================
// WEED FARM — a HIDDEN, walled grow-op compound on the deserted south-east shore
// of the rural peninsula. Pure 3D set-dressing (the playable loop lives in
// js/weed-farm.js): a tall concrete perimeter wall with a gated opening encloses
// a dirt yard holding a poly-tunnel greenhouse (pink grow lamps), a grow shack
// with a corrugated roof + extractor vent, a galvanized WATER STANDPIPE (the tap
// you fill a can at), a SALE TABLE with a hanging scale + cash box + crate, and a
// row of raised planter beds (the interactive slots).
//
// build() returns the whole compound on the origin (plot W along +x, D along +z,
// the gate facing +z). addWeedFarm() positions it, bakes it into the shared prop
// chunks and pushes the WALL + shack + greenhouse collision boxes into `solids`.
// The yard, beds, tap and sale table stay walkable; only the gate opening lets
// the player in. The exact local slot / crate / tap positions are exported so
// js/weed-farm.js drops its plants and water in the same spots.
// ============================================================================

export const PLOT_W=22, PLOT_D=16;        // inner yard size (x, z)
const HALF_W=12, HALF_D=9;                // wall ring half-extents (a touch outside the yard)
const WALL_H=3, WALL_T=0.4;               // wall height / thickness
const GATE_HALF=1.9;                      // half-width of the gate opening (north wall)

// World placement: an open, deserted pocket of the south-east shore — clear of
// the ploughed fields (x<=440), the ranch (550,-80), the mountain (x~509) and
// the village (x~650). Flat ground; js/world.js also keeps pines off it.
export const WEED_CX=620, WEED_CZ=-90;
// Approach point just outside the gate (north). Kept for reference.
export const WEED_GATE={x:WEED_CX, z:WEED_CZ+HALF_D+1.5};

// Interactive raised-planter slots (LOCAL, plot-centre origin) — two rows.
export const WEED_SLOTS=[
  {x:-6,z:4},{x:0,z:4},{x:6,z:4},
  {x:-6,z:-1},{x:0,z:-1},{x:6,z:-1},
];
export const WEED_BOX={x:9.5,z:6.5};      // sale table / crate (LOCAL)
export const WEED_TAP={x:-9.5,z:6.5};     // water standpipe (LOCAL)
export const WEED_RACK={x:-2.5,z:-7.3};   // drying rack — hang the harvest to cure (LOCAL)

// ---- materials (shared, so bakeProp merges every farm mesh by material) ----
const concreteM=matte({color:0xb9b3a6,roughness:1});      // wall body
const concreteDarkM=matte({color:0x847e72,roughness:1});  // wall base course
const copingM=matte({color:0x9a948a,roughness:.95});      // wall cap
const pierM=matte({color:0xa89f8e,roughness:1});          // gate piers / pilasters
const grooveM=matte({color:0x6f6a60,roughness:1});        // block-course grooves
const gateMetalM=matte({color:0x7c8a93,roughness:.55,metalness:.5}); // rolling gate
const roofM=matte({color:0x46423b,roughness:.8});         // corrugated tin (dark)
const shackM=matte({color:0x8a6b46,roughness:.95});       // shack planks
const shackTrimM=matte({color:0x5e3c24,roughness:.9});
const winGlowM=new THREE.MeshBasicMaterial({color:0xff8a3a});
const glassM=matte({color:0xcfeede,roughness:.15,transparent:true,opacity:.3,side:THREE.DoubleSide});
const frameM=matte({color:0xc9cdd2,roughness:.4,metalness:.5}); // aluminium frame
const growLampM=new THREE.MeshBasicMaterial({color:0xff4fbf});  // pink grow-lamp glow
const pipeM=matte({color:0xb4b9bf,roughness:.4,metalness:.6});  // galvanized standpipe
const valveM=matte({color:0xb6302a,roughness:.6});
const waterM=matte({color:0x2a4a66,roughness:.15,transparent:true,opacity:.7});
const tableM=matte({color:0x9c7338,roughness:.9});
const tableTopM=matte({color:0xb88a4a,roughness:.85});
const metalBoxM=matte({color:0x3a4750,roughness:.5,metalness:.5});
const scaleM=matte({color:0xd23b3b,roughness:.6});
const hoseM=matte({color:0x2f6f3a,roughness:.85});
const sackM=matte({color:0xcabf94,roughness:1});
const barrelM=matte({color:0x3f7a52,roughness:.7,metalness:.2});
const soilM=matte({color:0x3e2a1b,roughness:1});
const soilRimM=matte({color:0x6e4a32,roughness:.95});
const lampGlowM=new THREE.MeshBasicMaterial({color:0xffd37a});
const crateM=matte({color:0x9c7338,roughness:.95});
const crateDarkM=matte({color:0x6e4a26,roughness:.95});
const budM=matte({color:0x86c552,roughness:.7});
// plant materials
const stemM=matte({color:0x3c6b2f,roughness:.9});
const leafM=matte({color:0x4f9a3d,roughness:.85});
const leafDarkM=matte({color:0x3c7a30,roughness:.85});
const colaM=matte({color:0x9fd36a,roughness:.7});

// ---- canvas textures (no binary assets; drawn at load) ----
let yardTex=null;
function yardTexture(){
  if(yardTex)return yardTex;
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const x=c.getContext('2d');
  x.fillStyle='#5a4632';x.fillRect(0,0,256,256);                 // packed dirt
  for(let i=0;i<1400;i++){                                        // gravel speckle
    const g=40+Math.random()*120|0;
    x.fillStyle=`rgba(${g+30},${g+18},${g},${.25+Math.random()*.4})`;
    const r=Math.random()*2.2;
    x.beginPath();x.arc(Math.random()*256,Math.random()*256,r,0,7);x.fill();
  }
  x.strokeStyle='rgba(30,20,12,.35)';x.lineWidth=7;              // tyre tracks
  for(const ty of[96,150]){x.beginPath();x.moveTo(0,ty);x.bezierCurveTo(80,ty-12,170,ty+14,256,ty);x.stroke();}
  yardTex=new THREE.CanvasTexture(c);yardTex.colorSpace=THREE.SRGBColorSpace;
  yardTex.wrapS=yardTex.wrapT=THREE.RepeatWrapping;yardTex.repeat.set(5,4);
  return yardTex;
}
let signTex=null;
function signTexture(){
  if(signTex)return signTex;
  const c=document.createElement('canvas');c.width=256;c.height=160;
  const x=c.getContext('2d');
  x.fillStyle='#2a1d12';x.fillRect(0,0,256,160);
  x.fillStyle='#d7c9a8';x.fillRect(8,8,240,144);
  x.fillStyle='#b22a2a';x.textAlign='center';x.textBaseline='middle';
  x.font='900 44px monospace';x.fillText('KEEP',128,54);x.fillText('OUT',128,104);
  signTex=new THREE.CanvasTexture(c);signTex.colorSpace=THREE.SRGBColorSpace;return signTex;
}
let priceTex=null;
function priceTexture(){
  if(priceTex)return priceTex;
  const c=document.createElement('canvas');c.width=128;c.height=96;
  const x=c.getContext('2d');
  x.fillStyle='#14201a';x.fillRect(0,0,128,96);
  x.fillStyle='#9dff2e';x.textAlign='center';x.textBaseline='middle';
  x.font='900 24px monospace';x.fillText('STASH',64,28);
  x.font='900 26px monospace';x.fillText('BOX',64,64);
  priceTex=new THREE.CanvasTexture(c);priceTex.colorSpace=THREE.SRGBColorSpace;return priceTex;
}

// ---- a single stylized cannabis plant on the origin (base at y=0) ----
export function makeWeedPlant(s=1,frosty=false,leafColor=null){
  const g=new THREE.Group();
  const H=0.9*s;
  // optional per-strain leaf tint (only a handful of live plants, so per-plant mats are fine)
  let mLeaf=leafM,mDark=leafDarkM,mCola=colaM;
  if(leafColor!=null){
    const c=new THREE.Color(leafColor);
    mLeaf=matte({color:c.getHex(),roughness:.85});
    mDark=matte({color:c.clone().multiplyScalar(.78).getHex(),roughness:.85});
    mCola=matte({color:c.clone().lerp(new THREE.Color(0xffffff),.32).getHex(),roughness:.7});
  }
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.03*s,.05*s,H,6),stemM);
  stem.position.y=H/2;stem.castShadow=true;g.add(stem);
  const tiers=[{y:.30,n:5,len:.40,mat:mDark,spread:1.5},
               {y:.55,n:5,len:.46,mat:mLeaf,spread:1.35},
               {y:.78,n:5,len:.34,mat:mLeaf,spread:1.1}];
  for(const t of tiers){
    for(const side of[-1,1]){
      const fan=new THREE.Group();
      for(let i=0;i<t.n;i++){
        const a=(i/(t.n-1)-.5)*t.spread;
        const blade=new THREE.Mesh(new THREE.ConeGeometry(.07*s,t.len*s,5),t.mat);
        blade.scale.z=.18;blade.position.y=t.len*s/2;
        const arm=new THREE.Group();arm.add(blade);
        arm.rotation.z=a;arm.rotation.x=-.5;fan.add(arm);
      }
      fan.position.y=t.y*s;fan.rotation.y=side>0?0:Math.PI;fan.rotation.z=side*.15;
      g.add(fan);
    }
  }
  const cola=new THREE.Mesh(new THREE.ConeGeometry(.11*s,.34*s,7),frosty?mCola:mLeaf);
  cola.position.y=H+.1*s;cola.castShadow=true;g.add(cola);
  return g;
}

// A small frosty bud nugget — piles up inside the sale crate as you deposit.
export function makeBud(s=1){
  return new THREE.Mesh(new THREE.IcosahedronGeometry(.11*s,0),budM);
}

// Galvanized water bucket carried in the player's hand. Origin sits at the rim /
// handle so it hangs from the hand; the body drops below in local -Y.
export function makeBucket(withWater=true){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.15,.115,.26,12,1,true),pipeM);
  body.position.y=-.15;body.castShadow=true;g.add(body);
  const bottom=new THREE.Mesh(new THREE.CylinderGeometry(.115,.115,.02,12),pipeM);
  bottom.position.y=-.28;g.add(bottom);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.15,.016,6,16),metalBoxM);
  rim.rotation.x=Math.PI/2;rim.position.y=-.02;g.add(rim);
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.15,.012,6,14,Math.PI),metalBoxM);
  handle.position.y=-.02;g.add(handle);                 // bail arcs up over the rim
  if(withWater){
    const water=new THREE.Mesh(new THREE.CylinderGeometry(.135,.135,.02,12),waterM);
    water.position.y=-.06;g.add(water);
  }
  return g;
}

// A single water droplet (shared geo+material — spawned in bunches when pouring).
const dropGeo=new THREE.SphereGeometry(.045,6,5);
const dropM=new THREE.MeshBasicMaterial({color:0x57b6ff});
export function makeWaterDrop(){return new THREE.Mesh(dropGeo,dropM);}

// ---- compound wall (a run along +x, centred), with base, coping, grooves
// and evenly-spaced pilasters. `len` is the run length. ----
function makeWall(len){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(len,WALL_H,WALL_T),concreteM);
  body.position.y=WALL_H/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
  const base=new THREE.Mesh(new THREE.BoxGeometry(len,.55,WALL_T+.16),concreteDarkM);
  base.position.y=.275;g.add(base);
  const coping=new THREE.Mesh(new THREE.BoxGeometry(len+.06,.18,WALL_T+.26),copingM);
  coping.position.y=WALL_H+.02;g.add(coping);
  for(const y of[1.15,1.95]){
    const groove=new THREE.Mesh(new THREE.BoxGeometry(len,.05,WALL_T+.02),grooveM);
    groove.position.y=y;g.add(groove);
  }
  const n=Math.max(1,Math.round(len/4));
  for(let i=0;i<=n;i++){
    const px=-len/2+len*i/n;
    const pil=new THREE.Mesh(new THREE.BoxGeometry(.55,WALL_H,WALL_T+.34),pierM);
    pil.position.set(px,WALL_H/2,0);pil.castShadow=true;g.add(pil);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.7,.16,WALL_T+.5),copingM);
    cap.position.set(px,WALL_H+.08,0);g.add(cap);
  }
  return g;
}

// stout gate pier with a glowing lamp on top
function makeGatePier(){
  const g=new THREE.Group();
  const H=WALL_H+.9;
  const col=new THREE.Mesh(new THREE.BoxGeometry(.95,H,.95),pierM);
  col.position.y=H/2;col.castShadow=true;g.add(col);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(1.2,.2,1.2),copingM);
  cap.position.y=H+.1;g.add(cap);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),lampGlowM);
  lamp.position.y=H+.34;g.add(lamp);
  return g;
}

// open rolling gate parked inside the wall beside the opening (corrugated steel)
function makeRollingGate(){
  const g=new THREE.Group();
  const W=3.4,H=WALL_H-.3;
  const panel=new THREE.Mesh(new THREE.BoxGeometry(W,H,.1),gateMetalM);
  panel.position.y=H/2+.2;g.add(panel);
  for(let i=0;i<10;i++){                      // vertical corrugations
    const r=new THREE.Mesh(new THREE.BoxGeometry(.05,H-.1,.16),gateMetalM);
    r.position.set(-W/2+.2+i*((W-.4)/9),H/2+.2,.08);g.add(r);
  }
  const railTop=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.12,.18),frameM);
  railTop.position.y=H+.26;g.add(railTop);
  for(let i=0;i<4;i++){                        // little ground wheels
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.08,10),metalBoxM);
    w.rotation.z=Math.PI/2;w.position.set(-W/2+.4+i*((W-.8)/3),.12,0);g.add(w);
  }
  return g;
}

function makeShack(){
  const g=new THREE.Group();
  const W=4.6,H=2.9,D=3.6;
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),shackM);
  body.position.y=H/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
  // plank seams + corner trims
  for(let y=.5;y<H-.2;y+=.5){
    const ln=new THREE.Mesh(new THREE.BoxGeometry(W+.02,.04,.03),shackTrimM);
    ln.position.set(0,y,D/2+.01);g.add(ln);
  }
  for(const sx of[-1,1]){
    const corner=new THREE.Mesh(new THREE.BoxGeometry(.14,H,.14),shackTrimM);
    corner.position.set(sx*W/2,H/2,D/2);g.add(corner);
  }
  // corrugated tin roof (slight pitch + ridges)
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W+.6,.14,D+.6),roofM);
  roof.position.set(0,H+.16,0);roof.rotation.x=-.12;roof.castShadow=true;g.add(roof);
  for(let i=0;i<9;i++){
    const r=new THREE.Mesh(new THREE.BoxGeometry(.07,.06,D+.6),roofM);
    r.position.set(-W/2-.2+i*((W+.4)/8),H+.24,0);r.rotation.x=-.12;g.add(r);
  }
  // framed door with a warm light leak
  const doorFrame=new THREE.Mesh(new THREE.BoxGeometry(1.2,2.3,.1),shackTrimM);
  doorFrame.position.set(-1,1.15,D/2+.03);g.add(doorFrame);
  const door=new THREE.Mesh(new THREE.BoxGeometry(1,2.1,.06),matte({color:0x4a3422,roughness:.9}));
  door.position.set(-1,1.05,D/2+.07);g.add(door);
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(.55,1.5),winGlowM);
  glow.position.set(-1.55,1.05,D/2+.05);g.add(glow);
  // small window
  const win=new THREE.Mesh(new THREE.PlaneGeometry(.9,.7),winGlowM);
  win.position.set(1.1,1.7,D/2+.04);g.add(win);
  const winFrame=new THREE.Mesh(new THREE.BoxGeometry(1.04,.84,.06),shackTrimM);
  winFrame.position.set(1.1,1.7,D/2+.02);g.add(winFrame);
  // extractor fan + vent pipe (a grow-room tell)
  const fan=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.4),metalBoxM);
  fan.position.set(1.2,2.2,-D/2-.18);g.add(fan);
  const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,1.3,10),pipeM);
  pipe.position.set(-1.2,H+.75,-D/2+.6);g.add(pipe);
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.18,10),pipeM);
  cap.position.set(-1.2,H+1.4,-D/2+.6);g.add(cap);
  return g;
}

function makeGreenhouse(){
  const g=new THREE.Group();
  const L=6.4,R=1.8;
  // aluminium ribs + glazing bars
  for(let i=0;i<=5;i++){
    const hoop=new THREE.Mesh(new THREE.TorusGeometry(R,.055,6,18,Math.PI),frameM);
    hoop.position.set(-L/2+L*i/5,0,0);hoop.rotation.y=Math.PI/2;g.add(hoop);
  }
  const ridge=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,L,8),frameM);
  ridge.rotation.z=Math.PI/2;ridge.position.y=R;g.add(ridge);
  for(const ang of[Math.PI*0.28,Math.PI*0.5,Math.PI*0.72]){
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,L,6),frameM);
    bar.rotation.z=Math.PI/2;bar.position.set(0,Math.sin(ang)*R,Math.cos(ang)*R);g.add(bar);
  }
  // glass skin + ends
  const skin=new THREE.Mesh(new THREE.CylinderGeometry(R,R,L,18,1,true,0,Math.PI),glassM);
  skin.rotation.z=Math.PI/2;g.add(skin);
  for(const sx of[-1,1]){
    const end=new THREE.Mesh(new THREE.CircleGeometry(R,18,0,Math.PI),glassM);
    end.position.set(sx*L/2,0,0);end.rotation.y=sx*Math.PI/2;g.add(end);
  }
  // door frame on the near end
  const dframe=new THREE.Mesh(new THREE.BoxGeometry(.06,1.9,1.0),frameM);
  dframe.position.set(L/2-.02,.55,0);g.add(dframe);
  // pink grow lamps glowing inside + plant silhouettes
  for(let i=0;i<3;i++){
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,.9),growLampM);
    lamp.position.set(-L/2+L*(i+.5)/3,R-.35,0);g.add(lamp);
  }
  for(let i=0;i<5;i++){
    const p=makeWeedPlant(.8,i%2===0);
    p.position.set(-L/2+L*(i+.5)/5,0,0);g.add(p);
  }
  return g;
}

// galvanized water standpipe with a faucet, red valve, base pad, puddle + bucket
function makeStandpipe(){
  const g=new THREE.Group();
  const pad=new THREE.Mesh(new THREE.BoxGeometry(1.4,.12,1.4),concreteDarkM);
  pad.position.y=.06;pad.receiveShadow=true;g.add(pad);
  const puddle=new THREE.Mesh(new THREE.CircleGeometry(.62,18),waterM);
  puddle.rotation.x=-Math.PI/2;puddle.position.set(.35,.13,.2);g.add(puddle);
  const riser=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,1.5,10),pipeM);
  riser.position.set(-.2,.75,-.2);riser.castShadow=true;g.add(riser);
  const spout=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.5,8),pipeM);
  spout.rotation.z=Math.PI/2.3;spout.position.set(0,1.35,-.2);g.add(spout);
  const tip=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.18,8),pipeM);
  tip.position.set(.22,1.2,-.2);g.add(tip);
  const valve=new THREE.Mesh(new THREE.TorusGeometry(.13,.035,6,14),valveM);
  valve.rotation.x=Math.PI/2;valve.position.set(-.2,1.42,-.2);g.add(valve);
  // a galvanized bucket under the spout
  const bucket=new THREE.Mesh(new THREE.CylinderGeometry(.2,.16,.34,12),pipeM);
  bucket.position.set(.3,.3,.1);bucket.castShadow=true;g.add(bucket);
  const bwater=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.02,12),waterM);
  bwater.position.set(.3,.45,.1);g.add(bwater);
  // a coiled hose hanging on the riser
  const hose=new THREE.Mesh(new THREE.TorusGeometry(.22,.04,6,16),hoseM);
  hose.position.set(-.2,.9,-.34);hose.rotation.x=.4;g.add(hose);
  return g;
}

// sale table: timber bench, hanging spring scale, locked cash box, price board
// and the open crate that the harvested flowers pile into.
function makeSaleTable(){
  const g=new THREE.Group();
  const top=new THREE.Mesh(new THREE.BoxGeometry(2.2,.12,1.1),tableTopM);
  top.position.y=.92;top.castShadow=true;g.add(top);
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.92,.12),tableM);
    leg.position.set(sx*.95,.46,sz*.45);g.add(leg);
  }
  // cash box
  const cash=new THREE.Mesh(new THREE.BoxGeometry(.5,.22,.34),metalBoxM);
  cash.position.set(-.6,1.09,0);g.add(cash);
  const slot=new THREE.Mesh(new THREE.BoxGeometry(.3,.02,.05),matte({color:0x10141a}));
  slot.position.set(-.6,1.21,0);g.add(slot);
  // hanging spring scale on a little gallows arm
  const post=new THREE.Mesh(new THREE.BoxGeometry(.08,1.1,.08),tableM);
  post.position.set(.85,1.5,-.4);g.add(post);
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.7,.08,.08),tableM);
  arm.position.set(.55,2.0,-.4);g.add(arm);
  const scaleBody=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.28,12),scaleM);
  scaleBody.position.set(.3,1.78,-.4);g.add(scaleBody);
  const pan=new THREE.Mesh(new THREE.CylinderGeometry(.18,.14,.06,14),pipeM);
  pan.position.set(.3,1.55,-.4);g.add(pan);
  // price board leaning at the back
  const board=new THREE.Mesh(new THREE.PlaneGeometry(.9,.66),
    new THREE.MeshBasicMaterial({map:priceTexture(),side:THREE.DoubleSide}));
  board.position.set(.3,1.4,.5);board.rotation.x=.12;g.add(board);
  // open crate on the table for the buds
  const crate=makeCrate(.8);crate.position.set(-.1,.98,.05);g.add(crate);
  return g;
}

// Open-top wooden crate the player drops harvested flowers into.
export function makeCrate(s=1){
  const g=new THREE.Group();
  const W=1.4*s,D=1.0*s,H=0.8*s;
  const floor=new THREE.Mesh(new THREE.BoxGeometry(W,.1,D),crateDarkM);
  floor.position.y=.05;g.add(floor);
  for(const[sx,sz,w,d]of[[0,D/2,W,.1],[0,-D/2,W,.1],[W/2,0,.1,D],[-W/2,0,.1,D]]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(w,H,d),crateM);
    wall.position.set(sx,H/2,sz);wall.castShadow=true;g.add(wall);
  }
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.12*s,H+.1,.12*s),crateDarkM);
    post.position.set(sx*W/2,(H+.1)/2,sz*D/2);g.add(post);
  }
  return g;
}

// raised timber planter (the interactive slot) with dark tilled soil + a label stake
function makeEmptyBed(){
  const g=new THREE.Group();
  const W=2.3,D=2.3,H=.42;
  for(const[sx,sz,w,d]of[[0,D/2,W,.14],[0,-D/2,W,.14],[W/2,0,.14,D],[-W/2,0,.14,D]]){
    const plank=new THREE.Mesh(new THREE.BoxGeometry(w,H,d),soilRimM);
    plank.position.set(sx,H/2,sz);plank.castShadow=true;g.add(plank);
  }
  const soil=new THREE.Mesh(new THREE.BoxGeometry(W-.24,.16,D-.24),soilM);
  soil.position.y=H-.12;soil.receiveShadow=true;g.add(soil);
  const stake=new THREE.Mesh(new THREE.BoxGeometry(.06,.5,.06),shackTrimM);
  stake.position.set(W/2-.2,H+.2,-D/2+.2);g.add(stake);
  const tag=new THREE.Mesh(new THREE.BoxGeometry(.22,.14,.02),matte({color:0xf0e6cf,roughness:.9}));
  tag.position.set(W/2-.2,H+.42,-D/2+.21);g.add(tag);
  return g;
}

// decorative props: a stack of fertilizer sacks
function makeSackStack(){
  const g=new THREE.Group();
  for(const[x,y,z,ry]of[[0,.22,0,.2],[.5,.22,.1,-.3],[.25,.62,.05,.5]]){
    const sack=new THREE.Mesh(new THREE.BoxGeometry(.6,.42,.42),sackM);
    sack.position.set(x,y,z);sack.rotation.y=ry;sack.castShadow=true;g.add(sack);
  }
  return g;
}
function makeBarrel(){
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.9,16),barrelM);
  b.position.y=.45;b.castShadow=true;g.add(b);
  for(const y of[.25,.65]){
    const band=new THREE.Mesh(new THREE.TorusGeometry(.345,.02,6,18),pipeM);
    band.rotation.x=Math.PI/2;band.position.y=y;g.add(band);
  }
  return g;
}

function makeSign(){
  const g=new THREE.Group();
  const board=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.88),
    new THREE.MeshBasicMaterial({map:signTexture(),side:THREE.DoubleSide}));
  board.position.set(0,0,0);g.add(board);
  return g;
}

// drying rack: two posts + hang bars under a little corrugated lean-to. The HARVEST
// hangs here to cure (the hanging buds are added live by js/weed-farm.js).
function makeDryingRack(){
  const g=new THREE.Group();
  const W=3.0,H=2.0;
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.12,H,.12),tableM);
    post.position.set(sx*W/2,H/2,0);post.castShadow=true;g.add(post);
  }
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,W+.2,8),pipeM);
  bar.rotation.z=Math.PI/2;bar.position.y=H-.1;g.add(bar);
  const bar2=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,W+.2,8),pipeM);
  bar2.rotation.z=Math.PI/2;bar2.position.set(0,H-.55,.22);g.add(bar2);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W+.5,.1,1.5),roofM);
  roof.position.set(0,H+.18,.1);roof.rotation.x=-.18;roof.castShadow=true;g.add(roof);
  return g;
}

// ---- grow-yard night lighting -------------------------------------------------
// Two flood poles flank the planter beds, a festoon string runs between them, and
// warm ground-glow pools wash the soil — all using the shared lamp materials that
// js/daynight.js fades in after dark, so the plantation reads clearly at night.
const FLOOD_POS=[{x:-9.5,z:1,yaw:0},{x:9.5,z:1,yaw:Math.PI}];
const FLOOD_ARM=1.0, FLOOD_H=3.6;

function makeFloodlight(yaw){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.085,FLOOD_H,6),frameM);
  pole.position.y=FLOOD_H/2;pole.castShadow=true;g.add(pole);
  const arm=new THREE.Group();arm.position.y=FLOOD_H-.1;arm.rotation.y=yaw;
  const reach=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,FLOOD_ARM,6),frameM);
  reach.rotation.z=Math.PI/2;reach.position.set(FLOOD_ARM/2,0,0);arm.add(reach);
  const shade=new THREE.Mesh(new THREE.ConeGeometry(.3,.34,12,1,true),metalBoxM); // wide opening faces down
  shade.position.set(FLOOD_ARM,-.05,0);arm.add(shade);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),lampBulbMat);
  bulb.position.set(FLOOD_ARM,-.18,0);arm.add(bulb);
  g.add(arm);
  return g;
}

function addGrowLighting(g){
  for(const f of FLOOD_POS){
    const fl=makeFloodlight(f.yaw);fl.position.set(f.x,0,f.z);g.add(fl);
  }
  // warm ground-glow pools over the two planter rows (off by day, lit by night)
  for(const[gx,gz,s] of [[-4,1.5,9],[4,1.5,9],[0,4,8],[0,-1,8]]){
    const pool=new THREE.Mesh(new THREE.PlaneGeometry(s,s),lampGlowMat);
    pool.rotation.x=-Math.PI/2;pool.position.set(gx,.05,gz);pool.renderOrder=2;g.add(pool);
  }
  // festoon string strung between the flood poles, bulbs sagging over the beds
  const span=FLOOD_POS[1].x-FLOOD_POS[0].x, segs=9, z=FLOOD_POS[0].z, top=FLOOD_H-.2;
  let prev=null;
  for(let i=0;i<=segs;i++){
    const t=i/segs, x=FLOOD_POS[0].x+span*t, y=top-Math.sin(t*Math.PI)*.55;
    const pt=new THREE.Vector3(x,y,z);
    if(prev){
      const len=prev.distanceTo(pt), mid=prev.clone().add(pt).multiplyScalar(.5);
      const wire=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,len,4),shackTrimM);
      wire.position.copy(mid);
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pt.clone().sub(prev).normalize());
      g.add(wire);
    }
    if(i>0&&i<segs){
      const bulb=new THREE.Mesh(new THREE.SphereGeometry(.085,8,6),lampBulbMat);
      bulb.position.set(x,y-.13,z);g.add(bulb);
    }
    prev=pt;
  }
}

// Assemble the whole compound on the origin (plot centre). Pure: no scene.add.
function build(){
  const g=new THREE.Group();

  // dirt yard floor
  const yard=new THREE.Mesh(new THREE.PlaneGeometry(HALF_W*2,HALF_D*2),
    matte({color:0x5a4632,roughness:1,map:yardTexture()}));
  yard.rotation.x=-Math.PI/2;yard.position.y=.02;yard.receiveShadow=true;g.add(yard);

  // perimeter walls (gate opening on +z / north)
  const south=makeWall(HALF_W*2); south.position.set(0,0,-HALF_D); g.add(south);
  const west=makeWall(HALF_D*2);  west.rotation.y=Math.PI/2; west.position.set(-HALF_W,0,0); g.add(west);
  const east=makeWall(HALF_D*2);  east.rotation.y=Math.PI/2; east.position.set(HALF_W,0,0); g.add(east);
  // north wall split around the gate
  const nLen=HALF_W-GATE_HALF;
  const nWest=makeWall(nLen); nWest.position.set(-(GATE_HALF+nLen/2),0,HALF_D); g.add(nWest);
  const nEast=makeWall(nLen); nEast.position.set(GATE_HALF+nLen/2,0,HALF_D); g.add(nEast);
  // gate piers + open rolling gate + KEEP OUT sign
  for(const sx of[-1,1]){
    const pier=makeGatePier();pier.position.set(sx*GATE_HALF,0,HALF_D);g.add(pier);
  }
  const gate=makeRollingGate();gate.position.set(GATE_HALF+1.9,0,HALF_D-.45);g.add(gate);
  const sign=makeSign();sign.position.set(-GATE_HALF,2.2,HALF_D+.55);sign.rotation.y=Math.PI;g.add(sign);

  // raised planter beds at every interactive slot
  for(const s of WEED_SLOTS){
    const bed=makeEmptyBed();bed.position.set(s.x,0,s.z);g.add(bed);
  }

  // grow shack (back-west) + greenhouse (back-east), held clear of the south wall
  const shack=makeShack();shack.position.set(-7.5,0,-6.2);shack.rotation.y=.12;g.add(shack);
  const gh=makeGreenhouse();gh.position.set(6.5,0,-5.6);gh.rotation.y=-Math.PI/2;g.add(gh);

  // water standpipe + sale table at the two front corners
  const tap=makeStandpipe();tap.position.set(WEED_TAP.x,0,WEED_TAP.z);tap.rotation.y=.5;g.add(tap);
  const sale=makeSaleTable();sale.position.set(WEED_BOX.x,0,WEED_BOX.z);sale.rotation.y=-Math.PI/2.4;g.add(sale);

  // clutter for a lived-in grow-op
  const sacks=makeSackStack();sacks.position.set(-9,0,-2);g.add(sacks);
  const barrel=makeBarrel();barrel.position.set(9.3,0,-3.5);g.add(barrel);

  // drying rack at the back (harvest hangs here to cure — see js/weed-farm.js)
  const rack=makeDryingRack();rack.position.set(WEED_RACK.x,0,WEED_RACK.z);g.add(rack);

  // night lighting over the beds (flood poles + festoon + ground glow)
  addGrowLighting(g);

  g.userData.r=Math.max(HALF_W,HALF_D)+1;
  return g;
}

export default {category:'Rural',label:'Weed farm',build,
  variants:[
    {label:'Weed farm - compound',build,zoom:.42},
    {label:'Weed plant',build:()=>makeWeedPlant(2.4,true),zoom:1.1},
    {label:'Sale crate',build:()=>makeCrate(1.2),zoom:1.4},
    {label:'Water standpipe',build:makeStandpipe,zoom:.9},
    {label:'Water bucket',build:()=>makeBucket(true),zoom:1.8},
  ]};

// Place the compound at WEED_CX/CZ, bake it, and register collision for the
// perimeter WALLS (with the gate gap), the shack and the greenhouse. The yard,
// beds, tap and sale table stay walkable. Called by world.js.
export function addWeedFarm(solids){
  const g=build();
  g.position.set(WEED_CX,-.02,WEED_CZ);
  bakeProp(g);
  // bloom halos on the flood-lamp bulbs (sprites can't bake — added to the scene,
  // invisible by day, faded in at night by the shared lampHaloMat)
  for(const f of FLOOD_POS){
    const lx=f.x+FLOOD_ARM*Math.cos(f.yaw), lz=f.z-FLOOD_ARM*Math.sin(f.yaw);
    const halo=new THREE.Sprite(lampHaloMat);
    halo.position.set(WEED_CX+lx,FLOOD_H-.28,WEED_CZ+lz);halo.scale.set(2.6,2.6,1);
    scene.add(halo);
  }
  const cx=WEED_CX,cz=WEED_CZ,T=WALL_T/2+.1;
  solids.push(
    {x0:cx-HALF_W-T,x1:cx-HALF_W+T,z0:cz-HALF_D,z1:cz+HALF_D,h:WALL_H}, // west
    {x0:cx+HALF_W-T,x1:cx+HALF_W+T,z0:cz-HALF_D,z1:cz+HALF_D,h:WALL_H}, // east
    {x0:cx-HALF_W,x1:cx+HALF_W,z0:cz-HALF_D-T,z1:cz-HALF_D+T,h:WALL_H}, // south
    {x0:cx-HALF_W,x1:cx-GATE_HALF,z0:cz+HALF_D-T,z1:cz+HALF_D+T,h:WALL_H}, // north-west of gate
    {x0:cx+GATE_HALF,x1:cx+HALF_W,z0:cz+HALF_D-T,z1:cz+HALF_D+T,h:WALL_H}, // north-east of gate
    {x0:cx-7.5-2.5,x1:cx-7.5+2.5,z0:cz-8.3,z1:cz-4.1,h:2.9},  // shack
    {x0:cx+6.5-2.0,x1:cx+6.5+2.0,z0:cz-8.9,z1:cz-2.3,h:1.9},  // greenhouse
  );
}
