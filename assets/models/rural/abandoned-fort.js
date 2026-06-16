import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Abandoned military base: a square compound ringed by weathered concrete walls
// with a coping band, a wide GATE you can drive in through on the front (-z), and
// a crumbled BREACH on the back wall (a second way in on foot). Inside: a long
// bunker/barracks, a corner watchtower, sandbag emplacements, rusty barrels,
// crates, a leaning flagpole and a KEEP OUT sign. build() is pure (compound on
// the origin, gate toward -z); addAbandonedFort places it, bakes it into the
// shared props and pushes the wall/structure collision boxes into `solids`.
// All materials are module-level so bakeProp can batch the whole base.
const concM=matte({color:0x8c887d,roughness:1});       // weathered concrete
const concDarkM=matte({color:0x6d6a61,roughness:1});   // streaked/coping concrete
const rustM=matte({color:0x7c4a30,roughness:.95});     // rusted steel
const metalM=matte({color:0x686c70,roughness:.6,metalness:.5}); // grey metal
const sandM=matte({color:0x9a8b5e,roughness:1});       // sandbags
const woodM=matte({color:0x8a6a3e,roughness:.95});     // crates
const darkM=matte({color:0x14140f,roughness:1});       // dark openings/doorways
const flagM=matte({color:0x7a3030,roughness:.9,side:THREE.DoubleSide}); // faded flag
const tarmacM=matte({color:0x55534c,roughness:1});     // cracked yard

const HALF=22, WALL_H=3.2, WALL_T=0.7, GATE=6.5, BREACH=4.5;

// KEEP OUT sign face, painted once to a canvas and reused by both build() calls.
let signTex=null;
function keepOutTex(){
  if(signTex)return signTex;
  const c=document.createElement('canvas');c.width=256;c.height=160;
  const x=c.getContext('2d');
  x.fillStyle='#b8b29a';x.fillRect(0,0,256,160);
  x.fillStyle='#8a1f1f';x.fillRect(8,8,240,144);
  x.fillStyle='#e9e2cf';x.fillRect(18,18,220,124);
  x.fillStyle='#8a1f1f';x.textAlign='center';x.textBaseline='middle';
  x.font='900 46px monospace';x.fillText('KEEP',128,56);x.fillText('OUT',128,106);
  signTex=new THREE.CanvasTexture(c);signTex.colorSpace=THREE.SRGBColorSpace;
  return signTex;
}

function build(){
  const g=new THREE.Group();

  // cracked tarmac yard inside the walls
  const yard=new THREE.Mesh(new THREE.PlaneGeometry(HALF*2-1,HALF*2-1),tarmacM);
  yard.rotation.x=-Math.PI/2;yard.position.y=.02;yard.receiveShadow=true;g.add(yard);

  // ---- perimeter wall: an axis-aligned run from (x0,z0) to (x1,z1) with a darker
  // coping band on top. Every side of the compound is one or two of these. ----
  const seg=(x0,z0,x1,z1,h=WALL_H)=>{
    const horiz=Math.abs(x1-x0)>=Math.abs(z1-z0);
    const len=Math.hypot(x1-x0,z1-z0);
    const wall=new THREE.Mesh(horiz?new THREE.BoxGeometry(len,h,WALL_T)
      :new THREE.BoxGeometry(WALL_T,h,len),concM);
    wall.position.set((x0+x1)/2,h/2,(z0+z1)/2);
    wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
    const cap=new THREE.Mesh(horiz?new THREE.BoxGeometry(len,.2,WALL_T+.22)
      :new THREE.BoxGeometry(WALL_T+.22,.2,len),concDarkM);
    cap.position.set((x0+x1)/2,h+.02,(z0+z1)/2);g.add(cap);
  };
  seg(-HALF,-HALF,-HALF,HALF);                 // left wall (-x)
  seg(HALF,-HALF,HALF,HALF);                   // right wall (+x)
  seg(-HALF,HALF,-BREACH/2,HALF);              // back wall, left of breach (+z)
  seg(BREACH/2,HALF,HALF,HALF);                // back wall, right of breach
  seg(-HALF,-HALF,-GATE/2,-HALF);              // front wall, left of gate (-z)
  seg(GATE/2,-HALF,HALF,-HALF);                // front wall, right of gate

  // corner pillars + buttress ribs for solidity
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(1,WALL_H+.4,1),concDarkM);
    post.position.set(sx*HALF,(WALL_H+.4)/2,sz*HALF);post.castShadow=true;g.add(post);
  }
  for(const sx of[-1,1])for(const z of[-11,0,11]){
    const rib=new THREE.Mesh(new THREE.BoxGeometry(.4,WALL_H,.5),concDarkM);
    rib.position.set(sx*(HALF-.3),WALL_H/2,z);g.add(rib);
  }

  // gate: two heavy pillars and a leaning, half-fallen steel gate panel
  for(const sx of[-1,1]){
    const pil=new THREE.Mesh(new THREE.BoxGeometry(1.1,4,1.1),concDarkM);
    pil.position.set(sx*(GATE/2+.55),2,-HALF);pil.castShadow=true;g.add(pil);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,.5),darkM);
    lamp.position.set(sx*(GATE/2+.55),4.1,-HALF);g.add(lamp);
  }
  const gate=new THREE.Group();          // a barred steel gate, knocked off its hinge
  const frame=new THREE.Mesh(new THREE.BoxGeometry(GATE-.5,2.6,.12),rustM);
  frame.position.y=1.3;gate.add(frame);
  for(let k=-2;k<=2;k++){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.1,2.6,.1),rustM);
    bar.position.set(k*1.2,1.3,0);gate.add(bar);
  }
  gate.position.set(-GATE*.18,0,-HALF+.3);gate.rotation.set(.0,.0,.5);g.add(gate);

  // rubble spilling out of the back-wall breach
  for(const[rx,rz,s,ry]of[[-1.4,HALF-.3,1.1,.5],[.9,HALF+.4,1.4,1.2],[0,HALF-1.2,.8,.2],
    [-.4,HALF+1.1,.7,2.1]]){
    const chunk=new THREE.Mesh(new THREE.BoxGeometry(s,s*.6,s*.8),concDarkM);
    chunk.position.set(rx,s*.3,rz);chunk.rotation.set(.2,ry,.3);chunk.castShadow=true;g.add(chunk);
  }

  // ---- bunker / barracks: long low concrete block near the right wall ----
  const bx=HALF-7, bw=6, bd=11;
  const bunker=new THREE.Mesh(new THREE.BoxGeometry(bw,3,bd),concM);
  bunker.position.set(bx,1.5,0);bunker.castShadow=true;bunker.receiveShadow=true;g.add(bunker);
  const broof=new THREE.Mesh(new THREE.BoxGeometry(bw+.5,.3,bd+.5),concDarkM);
  broof.position.set(bx,3.15,0);g.add(broof);
  const bdoor=new THREE.Mesh(new THREE.PlaneGeometry(1.4,2.2),darkM); // doorway on interior (-x) face
  bdoor.position.set(bx-bw/2-.02,1.1,0);bdoor.rotation.y=-Math.PI/2;g.add(bdoor);
  for(const dz of[-3.4,3.4]){          // dark slit windows
    const slit=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.5),darkM);
    slit.position.set(bx-bw/2-.02,1.8,dz);slit.rotation.y=-Math.PI/2;g.add(slit);
  }
  const vent=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.9,8),rustM);
  vent.position.set(bx+1.4,3.6,-3.5);g.add(vent);

  // ---- watchtower in the back-left corner ----
  const tx=-(HALF-6), tz=HALF-6;
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.28,5,.28),metalM);
    leg.position.set(tx+sx*1.3,2.5,tz+sz*1.3);leg.castShadow=true;g.add(leg);
  }
  for(const sx of[-1,1]){              // cross-braces on two faces
    const br=new THREE.Mesh(new THREE.BoxGeometry(.12,3.6,.12),metalM);
    br.position.set(tx+sx*1.3,2.5,tz);br.rotation.x=.65;g.add(br);
  }
  const deck=new THREE.Mesh(new THREE.BoxGeometry(3.6,.3,3.6),woodM);
  deck.position.set(tx,5.1,tz);deck.castShadow=true;g.add(deck);
  for(const[ox,oz,w,d]of[[0,1.7,3.6,.15],[0,-1.7,3.6,.15],[1.7,0,.15,3.6],[-1.7,0,.15,3.6]]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(w,.7,d),metalM);
    rail.position.set(tx+ox,5.6,tz+oz);g.add(rail);
  }
  const cabin=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.8,2.6),concM);
  cabin.position.set(tx,6.4,tz);cabin.castShadow=true;g.add(cabin);
  const cwin=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.8),darkM);
  cwin.position.set(tx,6.7,tz-1.32);g.add(cwin);
  const croof=new THREE.Mesh(new THREE.BoxGeometry(3,.2,3),rustM);
  croof.position.set(tx,7.4,tz);croof.rotation.x=.12;croof.castShadow=true;g.add(croof);
  for(let k=0;k<5;k++){               // ladder rungs up one leg
    const rung=new THREE.Mesh(new THREE.BoxGeometry(1,.08,.08),metalM);
    rung.position.set(tx,.6+k*.9,tz+1.3);g.add(rung);
  }

  // ---- sandbag emplacement just inside the gate (an L of stacked bags) ----
  const bag=(x,y,z)=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.4,.55),sandM);
    b.position.set(x,y,z);b.castShadow=true;g.add(b);
  };
  for(let r=0;r<2;r++){
    for(let i=0;i<4;i++)bag(-3.5+i*.95+(r?.45:0),.2+r*.42,-12);
    for(let i=0;i<3;i++)bag(-3.5,.2+r*.42,-12+.95+i*.9+(r?.45:0));
  }

  // ---- scattered barrels (one tipped over) and crates ----
  for(const[x,z,tip,ry]of[[9,-7,0,0],[10.4,-6,0,0],[9.6,-7.4,1,.6],[-9,-9,0,0],[6,9,0,0]]){
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,1.1,12),rustM);
    if(tip){bar.position.set(x,.45,z);bar.rotation.set(Math.PI/2,0,ry);}
    else bar.position.set(x,.55,z);
    bar.castShadow=true;g.add(bar);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(.47,.47,.1,12),concDarkM);
    band.position.copy(bar.position);band.rotation.copy(bar.rotation);
    if(!tip)band.position.y=.85;g.add(band);
  }
  for(const[x,z,s,ry]of[[-13,-9,1.1,.3],[-13.6,-10,1,.3],[-12.4,-10,.9,1.0],[5,11,1.2,-.4]]){
    const crate=new THREE.Mesh(new THREE.BoxGeometry(s,s,s),woodM);
    crate.position.set(x,s/2,z);crate.rotation.y=ry;crate.castShadow=true;g.add(crate);
    const edge=new THREE.Mesh(new THREE.BoxGeometry(s+.04,.1,.1),concDarkM);
    edge.position.set(x,s*.8,z);edge.rotation.y=ry;g.add(edge);
  }

  // ---- leaning flagpole with a tattered, faded flag ----
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,7,8),metalM);
  pole.position.set(3,3.4,4);pole.rotation.z=.16;pole.castShadow=true;g.add(pole);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.2),flagM);
  flag.position.set(4.5,6,4);flag.rotation.y=.2;g.add(flag);

  // ---- KEEP OUT sign on a leaning post, just outside the gate ----
  const signPost=new THREE.Mesh(new THREE.BoxGeometry(.14,2.6,.14),woodM);
  signPost.position.set(-(GATE/2+2.6),1.3,-HALF-1.4);signPost.rotation.z=.12;g.add(signPost);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1),
    new THREE.MeshBasicMaterial({map:keepOutTex(),side:THREE.DoubleSide}));
  sign.position.set(-(GATE/2+2.5),2.2,-HALF-1.4);sign.rotation.set(0,.12,.12);g.add(sign);

  return g;
}

export default {category:'Rural',label:'Abandoned fort',build};

// Place the compound at (cx,cz) facing -z (gate toward the village/road) and bake
// it. ry stays 0 so the wall/structure collision boxes below are axis-aligned.
export function addAbandonedFort(solids,cx,cz){
  const g=build();g.position.set(cx,-.02,cz);bakeProp(g);
  const T=WALL_T/2;
  solids.push(
    {x0:cx-HALF-T,x1:cx-HALF+T,z0:cz-HALF,z1:cz+HALF,h:WALL_H},          // left wall
    {x0:cx+HALF-T,x1:cx+HALF+T,z0:cz-HALF,z1:cz+HALF,h:WALL_H},          // right wall
    {x0:cx-HALF,x1:cx-BREACH/2,z0:cz+HALF-T,z1:cz+HALF+T,h:WALL_H},      // back wall (left of breach)
    {x0:cx+BREACH/2,x1:cx+HALF,z0:cz+HALF-T,z1:cz+HALF+T,h:WALL_H},      // back wall (right of breach)
    {x0:cx-HALF,x1:cx-GATE/2,z0:cz-HALF-T,z1:cz-HALF+T,h:WALL_H},        // front wall (left of gate)
    {x0:cx+GATE/2,x1:cx+HALF,z0:cz-HALF-T,z1:cz-HALF+T,h:WALL_H},        // front wall (right of gate)
    {x0:cx+(HALF-7)-3,x1:cx+(HALF-7)+3,z0:cz-5.5,z1:cz+5.5,h:3},         // bunker
    {x0:cx-(HALF-6)-1.7,x1:cx-(HALF-6)+1.7,z0:cz+(HALF-6)-1.7,z1:cz+(HALF-6)+1.7,h:5}, // watchtower base
  );
}
