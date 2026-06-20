import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';
import {addFountain} from '../props/fountain.ts';
import {addParkBench} from '../props/park-bench.ts';
import {addStreetLamp} from '../props/street-lamp.ts';
import {addTree} from '../props/tree.ts';
import {addBush} from '../props/bush.ts';
import {groundHeight,rand,irand} from '@/core/constants.ts';

// Upgraded city park ("pracinha"): textured grass ground, a stone plaza round the fountain
// and stone walkways down the four arms, a clipped hedge border with path openings, raised
// flower beds and planter gateposts, plus denser trees/bushes/lamps/benches. All surfaces use
// crisp procedural canvas textures (grass / pavers / soil / foliage) — drawn once, REPEAT-
// wrapped and anisotropic — and the whole thing is built into one group and baked through
// prop-merge (merged per material + distance-culled), so it stays a handful of draw calls.

type Solid = { x0:number; x1:number; z0:number; z1:number; h:number };

// ---- procedural textures (one <canvas> each; no image assets at runtime) ----
function canvasTex(s:number,draw:(x:CanvasRenderingContext2D,s:number)=>void):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=c.height=s;
  draw(c.getContext('2d')!,s);
  const t=new THREE.CanvasTexture(c);
  t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;
  return t;
}
const grassTex=canvasTex(256,(x,s)=>{
  x.fillStyle='#4d8c3c';x.fillRect(0,0,s,s);
  for(let i=0;i<48;i++){x.fillStyle=`rgba(${irand(58,92)},${irand(120,160)},${irand(48,80)},.5)`;
    x.beginPath();x.arc(Math.random()*s,Math.random()*s,irand(10,30),0,7);x.fill();}
  for(let i=0;i<1100;i++){const gx=Math.random()*s,gy=Math.random()*s,c=irand(80,160);
    x.strokeStyle=`rgba(${c-46},${c},${c-62},.65)`;x.lineWidth=1;
    x.beginPath();x.moveTo(gx,gy);x.lineTo(gx+rand(-2,2),gy-rand(3,8));x.stroke();}
});
function drawStone(x:CanvasRenderingContext2D,s:number){
  x.fillStyle='#5e574c';x.fillRect(0,0,s,s);                 // grout
  const n=4,ts=s/n;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const sh=irand(-12,12);
    x.fillStyle=`rgb(${168+sh},${162+sh},${150+sh})`;
    x.fillRect(i*ts+2,j*ts+2,ts-4,ts-4);                     // paver
    for(let k=0;k<14;k++){x.fillStyle=`rgba(0,0,0,${Math.random()*.12})`;
      x.fillRect(i*ts+Math.random()*ts,j*ts+Math.random()*ts,2,2);}
  }
}
const stoneTex=canvasTex(256,drawStone);        // walkways / plaza (tiled via world UVs)
const stoneBoxTex=canvasTex(256,drawStone);     // curbs / planters (tiled via map.repeat)
stoneBoxTex.repeat.set(2,2);
const soilTex=canvasTex(128,(x,s)=>{
  x.fillStyle='#4a3829';x.fillRect(0,0,s,s);
  for(let i=0;i<300;i++){const c=irand(-30,42);x.fillStyle=`rgba(${92+c},${66+c},${44+c},.6)`;
    x.beginPath();x.arc(Math.random()*s,Math.random()*s,irand(1,4),0,7);x.fill();}
  for(let i=0;i<16;i++){x.fillStyle=`rgba(${irand(120,160)},${irand(110,140)},${irand(95,120)},.85)`;
    x.beginPath();x.arc(Math.random()*s,Math.random()*s,irand(2,4),0,7);x.fill();}
});
soilTex.repeat.set(2,2);
const hedgeTex=canvasTex(128,(x,s)=>{
  x.fillStyle='#2c6330';x.fillRect(0,0,s,s);
  for(let i=0;i<820;i++){const c=irand(-26,48);x.fillStyle=`rgba(${40+c},${112+c},${48+c},.72)`;
    x.beginPath();x.arc(Math.random()*s,Math.random()*s,irand(2,5),0,7);x.fill();}
  for(let i=0;i<140;i++){x.fillStyle=`rgba(8,28,10,${Math.random()*.4})`;
    x.fillRect(Math.random()*s,Math.random()*s,irand(1,3),irand(1,3));}
});
hedgeTex.repeat.set(2.4,1.2);

const grassMat = matte({ map:grassTex, roughness:1 });
const pathMat  = matte({ map:stoneTex, roughness:.9 });   // flat walkways/plaza (world-UV tiled)
const stoneMat = matte({ map:stoneBoxTex, roughness:.9 }); // box curbs/rims/planter bodies
const soilMat  = matte({ map:soilTex, roughness:1 });
const hedgeMat = matte({ map:hedgeTex, roughness:1 });
const stemM    = matte({ color:0x3a7a34, roughness:1 });
const FLOWERS = [0xe23b4e,0xf4c534,0xede7d6,0xd96fae,0x8a5cf0,0xff7a1e].map(
  c => matte({ color:c, roughness:.7, flatShading:true }));

const petalG = new THREE.IcosahedronGeometry(.085, 0);
const stemG  = new THREE.CylinderGeometry(.013, .013, .24, 5);
const leafG  = new THREE.IcosahedronGeometry(.18, 0);

// Scale a geometry's UVs so a REPEAT-wrapped texture tiles at a fixed WORLD size (crisp,
// consistent tiling regardless of the surface's dimensions). Flat planes/circles only.
function tileUV(geo:THREE.BufferGeometry, su:number, sv:number):THREE.BufferGeometry{
  const uv=geo.attributes.uv as THREE.BufferAttribute|undefined;
  if(uv){ for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*su, uv.getY(i)*sv); uv.needsUpdate=true; }
  return geo;
}
function flower(g:THREE.Group, x:number, y:number, z:number):void {
  const st = new THREE.Mesh(stemG, stemM); st.position.set(x, y + .12, z); g.add(st);
  const p = new THREE.Mesh(petalG, FLOWERS[irand(0, FLOWERS.length - 1)]);
  p.position.set(x, y + .26, z); p.scale.set(1, .72, 1); g.add(p);
}
function box(g:THREE.Group, mat:THREE.Material, x:number, y:number, z:number, w:number, h:number, d:number):void {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; g.add(m);
}
function flatPlane(g:THREE.Group, geo:THREE.BufferGeometry, mat:THREE.Material, x:number, y:number, z:number):void {
  const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z);
  m.receiveShadow = true; g.add(m);
}

// Build everything for one park centred at (cx,cz) with playable side `inner`.
export function buildPark(cx:number, cz:number, inner:number, solids:Solid[]):void {
  const h = inner / 2, gy = groundHeight(cx, cz);
  const g = new THREE.Group(); g.position.set(cx, gy, cz);   // all bespoke decor, baked once

  // --- textured ground: grass base, stone plaza, stone walkways down the 4 arms ---
  const gw = inner - .6;
  flatPlane(g, tileUV(new THREE.PlaneGeometry(gw, gw), gw / 2.5, gw / 2.5), grassMat, 0, .015, 0);
  flatPlane(g, tileUV(new THREE.CircleGeometry(3.2, 40), 6.4 / 1.6, 6.4 / 1.6), pathMat, 0, .05, 0);
  const pw = 2.6, plen = h - 3.0;
  for (const dir of [0, 1, 2, 3]) {            // +x, -x, +z, -z
    const along = dir < 2, s = (dir % 2) ? -1 : 1, mid = (3.0 + h) / 2;
    const geo = along ? new THREE.PlaneGeometry(plen, pw) : new THREE.PlaneGeometry(pw, plen);
    tileUV(geo, (along ? plen : pw) / 1.6, (along ? pw : plen) / 1.6);
    flatPlane(g, geo, pathMat, along ? s * mid : 0, .04, along ? 0 : s * mid);
  }
  // stone curb flanking each walkway
  const armLen = h - 3.1;
  for (const dir of [0, 1, 2, 3]) {
    const along = dir < 2, s = (dir % 2) ? -1 : 1, mid = (3.1 + h) / 2;
    for (const off of [-1.5, 1.5]) {
      if (along) box(g, stoneMat, s * mid, .08, off, armLen, .18, .18);
      else       box(g, stoneMat, off, .08, s * mid, .18, .18, armLen);
    }
  }

  // --- clipped hedge border: 2 segments per side, leaving a GAP at each path arm ---
  const GAP = 3.6, T = .55, seg = (inner - GAP) / 2 - .35;
  const edge = h - T / 2 - .15, segOff = GAP / 2 + .35 + seg / 2;
  const hedgeSeg = (x:number, z:number, w:number, d:number) => {
    box(g, hedgeMat, x, .36, z, w, .72, d);
    solids.push({ x0:cx + x - w / 2, x1:cx + x + w / 2, z0:cz + z - d / 2, z1:cz + z + d / 2, h:.75 });
  };
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) hedgeSeg(sx * segOff, sz * edge, seg, T); // N & S
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) hedgeSeg(sx * edge, sz * segOff, T, seg); // E & W

  // --- raised flower beds in the four quadrants ---
  const q = h * .56;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const bx = sx * q, bz = sz * q, w = 2.3, d = 2.3;
    box(g, stoneMat, bx, .1, bz, w, .2, d);                   // curb
    box(g, soilMat, bx, .2, bz, w - .2, .18, d - .2);         // soil
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++)
      flower(g, bx - .8 + i * .8, .26, bz - .8 + j * .8);
    solids.push({ x0:cx + bx - w / 2, x1:cx + bx + w / 2, z0:cz + bz - d / 2, z1:cz + bz + d / 2, h:.45 });
  }

  // --- planters flanking the 4 path entrances as gateposts (OFF the walkway centre) ---
  for (const dir of [0, 1, 2, 3]) for (const f of [-1, 1]) {
    const along = dir < 2, s = (dir % 2) ? -1 : 1, p = h - 2.2;
    const px = along ? s * p : f * 1.6, pz = along ? f * 1.6 : s * p;
    box(g, stoneMat, px, .23, pz, .8, .46, .8);              // body
    box(g, stoneMat, px, .47, pz, .9, .1, .9);               // rim
    box(g, soilMat, px, .5, pz, .6, .1, .6);                 // soil
    const leaf = new THREE.Mesh(leafG, hedgeMat); leaf.position.set(px, .64, pz); leaf.scale.set(1.5, .85, 1.5); g.add(leaf);
    for (let k = 0; k < 3; k++) flower(g, px + rand(-.2, .2), .54, pz + rand(-.2, .2));
    solids.push({ x0:cx + px - .48, x1:cx + px + .48, z0:cz + pz - .48, z1:cz + pz + .48, h:.7 });
  }

  bakeProp(g); // merge ALL of the above into the shared prop chunks

  // --- world-space props with their own add*/collision/bake ---
  solids.push(addFountain(cx, cz));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    addStreetLamp(cx + sx * (h - 1.4), cz + sz * (h - 1.4));            // corner lamps
    solids.push(addParkBench(cx + sx * 3.7, cz + sz * 3.7, Math.atan2(-sx, -sz))); // benches face the fountain
    addTree(cx + sx * (h - 1.6), cz + sz * (h - 1.6));                  // corner trees
  }
  for (const dir of [0, 1, 2, 3]) {                                     // mid-arm path lamps
    const along = dir < 2, s = (dir % 2) ? -1 : 1, p = h - 4.4;
    addStreetLamp(along ? cx + s * p : cx, along ? cz : cz + s * p);
  }
  for (let k = 0; k < 8; k++) {                                         // scattered bushes
    const a = rand(0, Math.PI * 2), r = rand(q - 1.4, h - 2.2);
    addBush(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
  }
}
