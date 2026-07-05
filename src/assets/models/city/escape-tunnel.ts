import * as THREE from 'three';
import {matte} from '../matte.ts';
import {scene} from '@/core/engine.ts';
import {groundHeight} from '@/core/constants.ts';

// Hidden ESCAPE TUNNEL linking the prison cell-block hole to the abandoned fort in
// the rural area. The tunnel room lives off-map (toggled by the Interior in
// js/activities/jail-break.ts); a metal gate at its far end surfaces at the fort, and a floor
// button at the fort drops back into the tunnel. All procedural, no image assets.

const TZ=330, X0=-720, X1=-680, ZW=3;          // corridor: x span, half-width in z
const WH=4.4;                                   // wall height (clearance: eye sits at ~1.58)
export const TUNNEL_CENTER={x:(X0+X1)/2,z:TZ};
export const TUNNEL_START ={x:-716,z:TZ};       // ladder bottom (under the prison hole)
export const TUNNEL_GATE  ={x:-684,z:TZ};       // metal gate (-> fort)
export const TUNNEL_BOUNDS={x0:X0-1,x1:X1+1,z0:TZ-ZW-1,z1:TZ+ZW+1,y1:WH+1};
export const FORT_BUTTON={x:606,z:88};          // floor plate in the fort courtyard (-> tunnel)
export const FORT_EXIT  ={x:606,z:82};          // where the gate drops you (a few m off the button)

const dirtM =matte({color:0x6e5538,roughness:1});
const dirtDk=matte({color:0x49381f,roughness:1});
const dirtLt=matte({color:0x86663f,roughness:1});      // lighter excavated dirt / piles
const woodM =matte({color:0x5a3f24,roughness:.9});
const woodDk=matte({color:0x3c2a18,roughness:.95});    // older / shadowed timber
const rockM =matte({color:0x6b655c,roughness:1});      // grey embedded stone
const rustM =matte({color:0x6e4630,metalness:.45,roughness:.7});
const clothM=matte({color:0x787059,roughness:1});      // canvas sacks / tarp
const steelM=matte({color:0x535d66,metalness:.7,roughness:.35});
const gateM =matte({color:0x394049,metalness:.7,roughness:.4});
const glowM =new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.9});

export const tunnelGroup=new THREE.Group();
tunnelGroup.visible=false;
export const tunnelFx:{gateGlow:THREE.Mesh|null,buttonGlow:THREE.Mesh|null,bulbs:{m:THREE.Mesh,base:number,sp:number,ph:number}[]}={gateGlow:null,buttonGlow:null,bulbs:[]};

{
  const g=tunnelGroup, len=X1-X0, cxm=(X0+X1)/2;
  // Deterministic PRNG so the clutter layout is identical every load.
  let _s=20260616; const rnd=():number=>{_s=(_s*1664525+1013904223)&0x7fffffff;return _s/0x7fffffff;};
  const rr=(a:number,b:number):number=>a+(b-a)*rnd();
  const add=(geo:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,fn?:(o:THREE.Mesh)=>void):THREE.Mesh=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);if(fn)fn(o);g.add(o);return o;};

  // ---------- shell: floor, ceiling, dirt walls, light-blocking outer box ----------
  add(new THREE.PlaneGeometry(len,ZW*2),dirtM,cxm,0,TZ,o=>o.rotation.x=-Math.PI/2);
  // solid dirt CEILING slab; bottom at the wall top (WH). Sagging boards for texture.
  add(new THREE.BoxGeometry(len,.4,ZW*2+.6),dirtDk,cxm,WH+.2,TZ);
  for(let x=X0+3;x<X1;x+=2.6)
    add(new THREE.BoxGeometry(.42,.1,ZW*2-.2),woodM,x,WH-.06,TZ,o=>{o.rotation.z=rr(-.03,.03);o.rotation.x=rr(-.02,.02);});
  // dark outer shell so the off-map void never shows around the higher roof
  add(new THREE.BoxGeometry(len+3,WH+5,ZW*2+3),
    new THREE.MeshBasicMaterial({color:0x07060a,side:THREE.BackSide}),cxm,(WH+5)/2-1,TZ);
  for(const sz of[-1,1])                                    // dirt side walls
    add(new THREE.BoxGeometry(len,WH,.3),dirtM,cxm,WH/2,TZ+sz*ZW);
  add(new THREE.BoxGeometry(.3,WH,ZW*2),dirtDk,X0,WH/2,TZ); // start end wall

  // ---------- timber portal frames (mine-shaft "sets") every ~3.5m ----------
  // Each set = two posts + a head beam + a foot sill + corner braces. Between sets,
  // horizontal "lagging" boards retain the dirt wall — the classic dug-tunnel look.
  for(let x=X0+2;x<X1-1;x+=3.5){
    const tw=woodM, ty=WH-.18;
    for(const sz of[-1,1]){
      add(new THREE.BoxGeometry(.22,WH,.22),tw,x,WH/2,TZ+sz*(ZW-.18));        // post
      add(new THREE.BoxGeometry(.5,.5,.18),tw,x,WH-.55,TZ+sz*(ZW-.4),         // corner brace
        o=>o.rotation.x=sz*Math.PI/4);
    }
    add(new THREE.BoxGeometry(.22,.22,ZW*2-.2),tw,x,ty,TZ);                   // head beam
    add(new THREE.BoxGeometry(.2,.14,ZW*2-.2),woodDk,x,.07,TZ);              // foot sill
    // lagging: a couple of horizontal retaining boards on each wall in this bay
    for(const sz of[-1,1])for(const yy of[WH*.34,WH*.66])
      add(new THREE.BoxGeometry(3.3,.16,.08),woodDk,x+1.75,yy,TZ+sz*(ZW-.05),
        o=>o.rotation.z=rr(-.02,.02));
  }

  // ---------- embedded rocks studding the dirt walls ----------
  for(let i=0;i<26;i++){
    const sz=rnd()<.5?-1:1, x=rr(X0+1,X1-1);
    add(new THREE.DodecahedronGeometry(rr(.12,.32),0),rockM,x,rr(.3,WH-.5),TZ+sz*(ZW-.12),
      o=>{o.rotation.set(rr(0,3),rr(0,3),rr(0,3));o.scale.z=.5;});
  }
  // hanging roots dangling from the ceiling
  for(let i=0;i<14;i++){
    const x=rr(X0+2,X1-2),z=TZ+rr(-ZW+.4,ZW-.4),h=rr(.3,.9);
    add(new THREE.ConeGeometry(.05,h,5),woodDk,x,WH-.2-h/2,z,o=>o.rotation.x=Math.PI);
  }

  // ---------- floor: duckboard walkway, scattered rock/dirt debris, puddles ----------
  for(let x=X0+1.5;x<X1-.5;x+=1.25)
    add(new THREE.BoxGeometry(1.15,.06,ZW*1.5),woodDk,x,.04,TZ,
      o=>{o.rotation.y=rr(-.05,.05);o.position.z+=rr(-.18,.18);});
  for(let i=0;i<22;i++)                                     // loose rocks
    add(new THREE.DodecahedronGeometry(rr(.08,.2),0),rockM,rr(X0+1,X1-1),rr(.04,.12),TZ+rr(-ZW+.4,ZW-.4),
      o=>o.rotation.set(rr(0,3),rr(0,3),rr(0,3)));
  for(let i=0;i<10;i++)                                     // dirt clumps
    add(new THREE.SphereGeometry(rr(.18,.34),6,5),dirtLt,rr(X0+1,X1-1),0,TZ+rr(-ZW+.4,ZW-.4),
      o=>o.scale.y=.3);
  for(let i=0;i<5;i++)                                      // dark damp puddles
    add(new THREE.CircleGeometry(rr(.3,.6),12),
      matte({color:0x18242b,roughness:.12,metalness:.3}),rr(X0+3,X1-3),.015,TZ+rr(-1.5,1.5),
      o=>o.rotation.x=-Math.PI/2);

  // ---------- hanging bulb string down the centre (flickers via tunnelFx.bulbs) ----------
  add(new THREE.CylinderGeometry(.015,.015,len-2,5),woodDk,cxm,WH-.32,TZ,
    o=>{o.rotation.z=Math.PI/2;});
  for(let x=X0+3.5;x<X1-1;x+=4.5){
    add(new THREE.CylinderGeometry(.01,.01,.3,4),woodDk,x,WH-.5,TZ);          // drop wire
    add(new THREE.SphereGeometry(.07,8,6),steelM,x,WH-.64,TZ,o=>o.scale.y=1.3);// socket
    const bulb=add(new THREE.SphereGeometry(.1,10,8),
      new THREE.MeshBasicMaterial({color:0xffe6a8,transparent:true,opacity:.95}),x,WH-.78,TZ);
    tunnelFx.bulbs.push({m:bulb,base:.92,sp:rr(7,12),ph:rr(0,6)});
  }
  // two DIM warm fill lights along the run (kept low so the tunnel stays murky and the
  // auto-equipped flashlight actually matters; low-count for perf)
  for(const lx of[cxm-len*.25,cxm+len*.25]){
    const pl=new THREE.PointLight(0xffd9a0,11,30,1.9);pl.position.set(lx,WH-.8,TZ);g.add(pl);
  }

  // ---------- excavation props (dug-out theme) ----------
  dirtPile(TUNNEL_START.x+2.2,TZ-ZW+.7);                    // spoil heap by the ladder
  wheelbarrow(X0+8,TZ+ZW-.8,-.4);
  crate(X0+12.5,TZ-ZW+.6,.3); crate(X0+13.4,TZ-ZW+.55,-.5,.7);
  sacks(X0+18,TZ+ZW-.7);
  pickaxe(X0+6.3,TZ-ZW+.15,-.5);                            // leaning on the wall
  shovel(X1-7,TZ+ZW-.15,.5);
  lantern(TUNNEL_GATE.x-2,WH-1.0,TZ+ZW-.3);                 // hung near the gate

  // ---------- ladder up at the start (beneath the prison hole) ----------
  // Two vertical rails set apart in Z; rungs run ALONG Z to connect them (the rails
  // and rungs used to be perpendicular — the rungs spanned X while the rails sat in Z).
  const LX=TUNNEL_START.x-.7;
  for(const sz of[-1,1])
    add(new THREE.BoxGeometry(.08,WH+.3,.08),steelM,LX,(WH+.3)/2,TZ+sz*.45);   // rails
  const RUNGS=Math.round(WH/.4)+1;
  for(let r=0;r<RUNGS;r++)
    add(new THREE.BoxGeometry(.06,.05,1.0),steelM,LX,.35+r*.4,TZ);             // rungs (along Z)

  // ---------- METAL GATE at the far end (timber portal + riveted steel door) ----------
  for(const sz of[-1,1])                                    // heavy timber jambs framing it
    add(new THREE.BoxGeometry(.32,WH,.32),woodM,X1-.45,WH/2,TZ+sz*(ZW-.1));
  add(new THREE.BoxGeometry(.32,.32,ZW*2),woodM,X1-.45,WH-.2,TZ);
  add(new THREE.BoxGeometry(.5,WH,ZW*2),gateM,X1,WH/2,TZ);                    // frame
  add(new THREE.BoxGeometry(.3,WH-.4,ZW*2-.5),gateM,X1-.2,(WH-.4)/2,TZ);     // door
  for(let i=-2;i<=2;i++)                                     // riveted bands
    add(new THREE.BoxGeometry(.34,.16,.5),steelM,X1-.2,(WH-.4)/2,TZ+i*1.0);
  add(new THREE.TorusGeometry(.14,.04,8,14),steelM,X1-.38,(WH-.4)/2,TZ+.6,   // handle wheel
    o=>o.rotation.y=Math.PI/2);
  const gg=add(new THREE.TorusGeometry(.55,.06,8,22),glowM,TUNNEL_GATE.x+.6,1.5,TZ,
    o=>o.rotation.y=Math.PI/2);
  tunnelFx.gateGlow=gg;

  // ---- prop builders ----
  function dirtPile(x:number,z:number):void{
    add(new THREE.SphereGeometry(.9,10,8),dirtLt,x,-.2,z,o=>{o.scale.set(1.4,.55,1.1);});
    for(let i=0;i<6;i++)
      add(new THREE.DodecahedronGeometry(rr(.1,.22),0),rockM,x+rr(-.8,.8),rr(.1,.4),z+rr(-.6,.6));
    add(new THREE.BoxGeometry(.06,.06,1.0),woodM,x+.5,.3,z+.4,o=>o.rotation.x=.5); // a board stuck in it
  }
  function wheelbarrow(x:number,z:number,ry:number):void{
    const b=new THREE.Group();b.position.set(x,0,z);b.rotation.y=ry;g.add(b);
    const tray=new THREE.Mesh(new THREE.BoxGeometry(1.0,.34,.62),rustM);tray.position.y=.5;b.add(tray);
    const inside=new THREE.Mesh(new THREE.BoxGeometry(.9,.26,.52),dirtLt);inside.position.y=.6;b.add(inside);
    const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.12,14),woodDk);
    wheel.rotation.x=Math.PI/2;wheel.position.set(.62,.26,0);b.add(wheel);
    for(const sz of[-1,1]){
      const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.4,.06),steelM);leg.position.set(-.45,.2,sz*.26);b.add(leg);
      const h=new THREE.Mesh(new THREE.BoxGeometry(1.3,.06,.06),woodM);h.position.set(-.1,.55,sz*.26);h.rotation.z=-.18;b.add(h);
    }
  }
  function crate(x:number,z:number,ry:number,s?:number):void{
    s=s||.85;const c=new THREE.Mesh(new THREE.BoxGeometry(s,s,s),woodM);
    c.position.set(x,s/2,z);c.rotation.y=ry;g.add(c);
    for(const ax of[-1,1]){const r=new THREE.Mesh(new THREE.BoxGeometry(s*1.02,.06,.06),woodDk);
      r.position.set(x,s*.5+ax*s*.32,z);r.rotation.y=ry;g.add(r);}
  }
  function sacks(x:number,z:number):void{
    const spots=[[0,0,.34],[.5,0,.32],[.25,.5,.3]];
    for(const[dx,dy,r]of spots)
      add(new THREE.SphereGeometry(r,8,6),clothM,x+dx,r*.8+dy,z,o=>o.scale.y=1.25);
  }
  function pickaxe(x:number,y:number,z:number):void{
    const p=new THREE.Group();p.position.set(x,0,z);p.rotation.z=.32;g.add(p);
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.5,7),woodM);handle.position.y=.75;p.add(handle);
    const head=new THREE.Mesh(new THREE.CylinderGeometry(.05,.02,.7,6),steelM);
    head.rotation.z=Math.PI/2;head.position.y=1.45;p.add(head);
  }
  function shovel(x:number,y:number,z:number):void{
    const p=new THREE.Group();p.position.set(x,0,z);p.rotation.z=-.3;g.add(p);
    const handle=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,1.4,7),woodM);handle.position.y=.7;p.add(handle);
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.28,.34,.04),steelM);blade.position.y=1.4;p.add(blade);
  }
  function lantern(x:number,y:number,z:number):void{
    add(new THREE.CylinderGeometry(.008,.008,.4,4),woodDk,x,y+.25,z);          // hook wire
    add(new THREE.BoxGeometry(.16,.26,.16),rustM,x,y,z);                       // body
    const flame=add(new THREE.SphereGeometry(.06,8,6),
      new THREE.MeshBasicMaterial({color:0xffe0b0,transparent:true,opacity:.95}),x,y,z);
    const pl=new THREE.PointLight(0xffcaa0,12,10,2);pl.position.set(x,y,z);g.add(pl);
    tunnelFx.bulbs.push({m:flame,base:.9,sp:rr(9,14),ph:rr(0,6)});
  }
}
scene.add(tunnelGroup);

// Tunnel wall AABBs for player collision (pushed into world solids by jail-break.js).
export const TUNNEL_SOLIDS=[
  {x0:X0-.25,x1:X0+.25,z0:TZ-ZW,z1:TZ+ZW,h:WH},
  {x0:X1-.4,x1:X1+.4,z0:TZ-ZW,z1:TZ+ZW,h:WH},
  {x0:X0,x1:X1,z0:TZ+ZW-.2,z1:TZ+ZW+.2,h:WH},
  {x0:X0,x1:X1,z0:TZ-ZW-.2,z1:TZ-ZW+.2,h:WH},
];

// ----- Fort floor button (rural world; always visible) -----
{
  const by=groundHeight(FORT_BUTTON.x,FORT_BUTTON.z);
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.95,1.05,.12,20),steelM);
  base.position.set(FORT_BUTTON.x,by+.06,FORT_BUTTON.z);scene.add(base);
  const plate=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.1,20),gateM);
  plate.position.set(FORT_BUTTON.x,by+.14,FORT_BUTTON.z);scene.add(plate);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.8,.05,8,24),glowM);
  ring.rotation.x=-Math.PI/2;ring.position.set(FORT_BUTTON.x,by+.18,FORT_BUTTON.z);scene.add(ring);
  tunnelFx.buttonGlow=ring;
}
