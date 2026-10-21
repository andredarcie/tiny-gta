import * as THREE from 'three';
import {matte} from '../matte.ts';
import {telhaTexture,ROOF_TILE_M} from './texturas.ts';

// Igreja Matriz do Divino Espírito Santo, Divinolândia — rebuilt 1:1 from the satellite
// footprint (Google z20, ~0.14 m/px) and the Street View panoramas round the Praça
// (pm-front*, pm-s2, pm-w, pm-nw in docs/divinolandia/referencias-streetview/). A
// mid-century neo-gothic church in white render with salmon-red trim:
//   - the NAVE runs west→east (34 m), a tall clerestory (13 m) with triplets of lancet
//     windows per bay under a cornice and a pink balustrade, and lower SIDE AISLES (6 m)
//     with paired round-headed windows, pink pilasters, cornice and balustrade, all on a
//     salmon tile plinth; a low sacristy block across the west end under the west gable;
//   - the EAST FRONT: a projecting portal under a pointed arched gable, the deep arch
//     filled with red cobogó above the choir window and a pink balcony slab, the entrance
//     hall and steps below; the clerestory gable behind it;
//   - the slender TOWER at the south-east corner (~33 m): pink corner and middle pilasters,
//     two bays a face of very tall paired stained-glass lancets, short lancets, the clock,
//     cobogó belfry panels, the cornice with corner finials and the cross.
// build() is pure. Frame: +x = east (toward the front), +z = south, y = 0 the nave floor
// (the plinth runs down to y = -6 so the church can stand on the square's slope); the
// origin is the middle of the nave. IGREJA_FOOT are collision boxes [cx, cz, w, d, h].
const WALL=0xf4efe4,PINK=0xc86f60;
const wallM=matte({color:WALL}),pinkM=matte({color:PINK});
const tileBaseM=matte({color:0xffffff,map:baseTileTexture()});
const glassM=matte({color:0xffffff,map:stainedTexture(),emissive:0x0d1424});
const plainGlassM=matte({color:0x2c3a52});
const cobogoM=matte({color:0xffffff,map:cobogoTexture()});
const balM=matte({color:PINK,map:balusterTexture(),transparent:true,alphaTest:.5,side:THREE.DoubleSide});
const roofM=matte({color:0xe0aa86,map:telhaTexture(),side:THREE.DoubleSide});
const shutterM=matte({color:0x7f9f86}),doorM=matte({color:0x4a3324}),stepM=matte({color:0xcfc8bb});

export const NAVE={x0:-16,x1:18,z:6.25,H:13.2},AISLE={z:10,H:6.2};
export const TOWER={x0:17.5,x1:23.1,z0:6.5,z1:12.1,H:30.5};
export const IGREJA_FOOT:[number,number,number,number,number][]=[
  [1,0,34,20,14],[-17.75,0,3.5,20,7],[20,0,4,8,15],[20.3,9.3,5.6,5.6,33],
];

// ---------------- textures ----------------
function canvas(w:number,h:number,paint:(x:CanvasRenderingContext2D)=>void,repeat=true):THREE.Texture{
  if(typeof document==='undefined')return new THREE.Texture();
  const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d')!);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;if(repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;
}
// stained glass: small panes in blues and greens with a few reds and ambers, dark leading
function stainedTexture():THREE.Texture{
  return canvas(64,128,x=>{
    const cols=['#1d3f8f','#2a5bb8','#1f6e5a','#2f8f63','#183070','#8f2a2a','#c79a2a','#3c78c8'];
    let s=7;const r=():number=>{s=(s*16807)%2147483647;return s/2147483647;};
    x.fillStyle='#111';x.fillRect(0,0,64,128);
    for(let j=0;j<8;j++)for(let i=0;i<2;i++){x.fillStyle=cols[Math.floor(r()*r()*cols.length*1.6)%cols.length];x.fillRect(i*32+2,j*16+2,28,12);}
  });
}
// cobogó: red-brown pierced concrete blocks (square openings in a grid)
function cobogoTexture():THREE.Texture{
  return canvas(64,64,x=>{
    x.fillStyle='#a8573f';x.fillRect(0,0,64,64);x.fillStyle='#2b1712';
    for(let j=0;j<4;j++)for(let i=0;i<4;i++)x.fillRect(i*16+4,j*16+4,8,8);
  });
}
// salmon ceramic tile cladding of the plinth
function baseTileTexture():THREE.Texture{
  return canvas(64,64,x=>{
    x.fillStyle='#e9c7b9';x.fillRect(0,0,64,64);
    for(let j=0;j<2;j++)for(let i=0;i<2;i++){x.fillStyle=(i+j)%2?'#d8957f':'#dc9c86';x.fillRect(i*32+1,j*32+1,30,30);}
  });
}
// balustrade: a row of turned balusters (alpha cut-out), 1 tile = 1 m
function balusterTexture():THREE.Texture{
  return canvas(64,32,x=>{
    x.clearRect(0,0,64,32);x.fillStyle='#fff';
    for(let i=0;i<4;i++){const cx=i*16+8;x.beginPath();x.moveTo(cx-3,32);x.lineTo(cx-5,26);x.quadraticCurveTo(cx-7,16,cx-3,8);x.lineTo(cx-4,2);x.lineTo(cx+4,2);x.lineTo(cx+3,8);x.quadraticCurveTo(cx+7,16,cx+5,26);x.lineTo(cx+3,32);x.fill();}
  });
}

// ---------------- helpers ----------------
function box(g:THREE.Group,m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,cast=true):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m);b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);b.castShadow=cast;b.receiveShadow=true;g.add(b);return b;
}
// a face group standing on the plan: local x along the face, y up, +z out of the wall
function face(g:THREE.Group,x:number,z:number,ry:number):THREE.Group{const f=new THREE.Group();f.position.set(x,0,z);f.rotation.y=ry;g.add(f);return f;}
const uvScale=(geo:THREE.BufferGeometry,su:number,sv:number):THREE.BufferGeometry=>{
  const uv=geo.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);return geo;};
function lancetShape(w:number,h:number,tip:number,grow=0):THREE.Shape{
  const r=w/2+grow,s=new THREE.Shape();
  s.moveTo(-r,-grow);s.lineTo(-r,h);s.quadraticCurveTo(-r,h+tip*.62+grow,0,h+tip+grow);s.quadraticCurveTo(r,h+tip*.62+grow,r,h);s.lineTo(r,-grow);s.closePath();return s;
}
function roundShape(w:number,h:number,grow=0):THREE.Shape{
  const r=w/2+grow,s=new THREE.Shape();s.moveTo(-r,-grow);s.lineTo(-r,h);s.absarc(0,h,r,Math.PI,0,true);s.lineTo(r,-grow);s.closePath();return s;
}
// a window on a face: pink frame shape behind, glass shape in front (shape uv in metres)
function win(f:THREE.Group,x:number,y:number,shape:(grow:number)=>THREE.Shape,glass:THREE.Material=glassM,frame=.12):void{
  const fr=new THREE.Mesh(new THREE.ShapeGeometry(shape(frame),6),pinkM);fr.position.set(x,y,.02);f.add(fr);
  const gl=new THREE.Mesh(uvScale(new THREE.ShapeGeometry(shape(0),6),2,1),glass);gl.position.set(x,y,.04);f.add(gl);
}
// pink balustrade on a wall head: base rail, balusters, top rail (local x a..b, at height y)
function balustrade(f:THREE.Group,a:number,b:number,y:number,h=.8,t=.22):void{
  box(f,pinkM,a,b,y,y+.14,-t,.04);box(f,pinkM,a-.04,b+.04,y+h-.12,y+h,-t-.02,.06);
  const p=new THREE.Mesh(uvScale(new THREE.PlaneGeometry(b-a,h-.26),b-a,1),balM);p.position.set((a+b)/2,y+.14+(h-.26)/2,-t/2);f.add(p);
  for(let x=a;x<=b+1e-3;x+=Math.max(1,(b-a)/Math.round((b-a)/3)))box(f,pinkM,x-.12,x+.12,y,y+h,-t-.02,.06);  // posts
}
// a pitched roof over x0..x1 (ridge along x) or a lean-to (from yLo at z=zLo up to yHi at zHi)
function slope(g:THREE.Group,x0:number,x1:number,zLo:number,yLo:number,zHi:number,yHi:number):void{
  const len=Math.hypot(zHi-zLo,yHi-yLo),geo=uvScale(new THREE.PlaneGeometry(x1-x0,len),(x1-x0)/ROOF_TILE_M,len/ROOF_TILE_M);
  const m=new THREE.Mesh(geo,roofM);m.position.set((x0+x1)/2,(yLo+yHi)/2,(zLo+zHi)/2);
  m.rotation.x=-Math.PI/2+Math.atan2(yHi-yLo,Math.abs(zHi-zLo))*(zHi>zLo?-1:1);
  m.castShadow=true;g.add(m);
}

// ---------------- the side walls ----------------
// one long side (north or south) as seen from outside: aisle wall + clerestory above
function side(g:THREE.Group,s:1|-1):void{
  const L=NAVE.x1-NAVE.x0,nb=8,bay=L/nb;
  // aisle wall (local x runs along the wall; for the south face local x = world x)
  const fa=face(g,s>0?0:0,s*AISLE.z,s>0?0:Math.PI),sx=(x:number):number=>s>0?x:-x;
  const a0=sx(s>0?NAVE.x0:NAVE.x1),a1=sx(s>0?NAVE.x1:NAVE.x0);
  box(fa,tileBaseM,a0,a1,-6,1.2,-.3,.06,false);
  for(let i=0;i<=nb;i++){const x=a0+i*bay;box(fa,pinkM,x-.3,x+.3,1.2,AISLE.H-.4,-.2,.12);}       // pilasters
  for(let i=0;i<nb;i++){
    const cx=a0+(i+.5)*bay;
    // the end bay under the tower (east, south side) is hidden: still draw — the tower covers it
    for(const dx of[-.6,.6])win(fa,cx+dx,1.9,gr=>roundShape(.7,2.2,gr),glassM,.1);
    box(fa,pinkM,cx-1.25,cx+1.25,1.65,1.75,-.05,.12);                                              // sill band
  }
  box(fa,pinkM,a0-.1,a1+.1,AISLE.H-.45,AISLE.H,-.25,.14);                                          // cornice
  balustrade(fa,a0,a1,AISLE.H);
  // clerestory wall above the aisle roof
  const fc=face(g,0,s*NAVE.z,s>0?0:Math.PI);
  for(let i=0;i<=nb;i++){const x=a0+i*bay;box(fc,pinkM,x-.25,x+.25,AISLE.H+1.5,NAVE.H-.5,-.15,.1);}
  for(let i=0;i<nb;i++){
    const cx=a0+(i+.5)*bay;
    box(fc,pinkM,cx-1.55,cx+1.55,8.75,12.35,-.02,.03);                                             // pink panel round the triplet
    box(fc,wallM,cx-1.4,cx+1.4,8.85,12.25,0,.04);
    for(const dx of[-.85,0,.85])win(fc,cx+dx,9.1,gr=>lancetShape(.5,2.3,.7,gr),glassM,.08);
  }
  box(fc,pinkM,a0-.1,a1+.1,NAVE.H-.45,NAVE.H,-.25,.14);
  balustrade(fc,a0,a1,NAVE.H);
}

function build():THREE.Group{
  const g=new THREE.Group();
  const {x0,x1,z:NZ,H:NH}=NAVE,{z:AZ,H:AH}=AISLE;
  // ---- the masses: nave body (clerestory), the two aisles, the west sacristy ----
  box(g,wallM,x0,x1,0,NH,-NZ,NZ);
  box(g,wallM,x0,x1,0,AH,-AZ,-NZ+.01);box(g,wallM,x0,x1,0,AH,NZ-.01,AZ);
  box(g,tileBaseM,x0-3.5,x1,-6,0,-AZ-.05,AZ+.05,false);                                            // plinth under all
  // aisle lean-to roofs (behind the balustrades) and the nave's pitched roof
  for(const s of[-1,1])slope(g,x0,x1,s*(AZ-.1),AH+.1,s*NZ,AH+1.6);
  slope(g,x0-.3,x1+.3,-NZ-.4,NH-.2,0,NH+3);slope(g,x0-.3,x1+.3,NZ+.4,NH-.2,0,NH+3);
  // solar panels on the north slope (seen on the satellite)
  {const p=new THREE.Mesh(new THREE.BoxGeometry(22,.08,1.6),plainGlassM);p.position.set(-3,NH+1.85,-2.6);p.rotation.x=Math.atan2(3.2,NZ+.4);g.add(p);}
  side(g,1);side(g,-1);
  // ---- west end: the sacristy block across the end, the nave gable above ----
  {
    box(g,wallM,x0-3.5,x0,0,AH,-AZ,AZ);
    const f=face(g,x0-3.5,0,-Math.PI/2);                                                            // local x = world z
    box(f,tileBaseM,-AZ,AZ,-6,1.2,-.3,.06,false);
    for(const z of[-6.5,-2.2,2.2,6.5]){const w0=new THREE.Group();f.add(w0);
      box(f,pinkM,z-1.05,z+1.05,1.95,3.45,0,.06);box(f,plainGlassM,z-.9,z+.9,2.05,3.35,0,.08);
      for(let k=1;k<4;k++)box(f,pinkM,z-.9+k*.45-.02,z-.9+k*.45+.02,2.05,3.35,0,.1);}
    box(f,pinkM,-AZ-.1,AZ+.1,AH-.45,AH,-.25,.14);balustrade(f,-AZ,AZ,AH);
    for(const s of[-1,1]){const fs=face(g,x0-1.75,s*AZ,s>0?0:Math.PI);box(fs,pinkM,-1.85,1.85,AH-.45,AH,-.25,.14);balustrade(fs,-1.75,1.75,AH);}
    slope(g,x0-3.5,x0,-AZ,AH-.1,-AZ+.1,AH+.6);
    // the nave's west gable: white wall with a pink coping, a small rose window
    const gw=face(g,x0,0,-Math.PI/2);
    const sh=new THREE.Shape();sh.moveTo(-NZ,NH);sh.lineTo(NZ,NH);sh.lineTo(0,NH+3.4);sh.closePath();
    const gm=new THREE.Mesh(new THREE.ShapeGeometry(sh),wallM);gm.position.z=.01;gw.add(gm);
    for(const s of[-1,1]){const c=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(NZ,3.4)+.5,.3,.4),pinkM);c.position.set(s*NZ/2,NH+1.7,.05);c.rotation.z=-s*Math.atan2(3.4,NZ);gw.add(c);}
    const rose=new THREE.Mesh(new THREE.CircleGeometry(.7,16),glassM);rose.position.set(0,NH+1.1,.06);gw.add(rose);
    box(gw,pinkM,-NZ-.1,NZ+.1,NH-.45,NH,-.25,.14);
    for(const[a,b]of[[-NZ,-AZ+3.5],[AZ-3.5,NZ]] as [number,number][])box(gw,pinkM,a,b,AH,AH+.01,0,.01);
  }
  // ---- east front ----
  {
    const fe=face(g,x1,0,Math.PI/2);                                                                // local x = -world z
    box(fe,tileBaseM,-AZ,AZ,-6,1.2,-.3,.06,false);
    // aisle ends: pink corner pilasters, a tall narrow window each
    for(const s of[-1,1]){
      const c=s*(AZ+NZ)/2;
      box(fe,pinkM,s*AZ-.35,s*AZ+.35,1.2,AH,-.2,.1);
      win(fe,c,1.8,gr=>lancetShape(.7,3.2,.7,gr),glassM,.1);
      box(fe,pinkM,c-2,c+2,AH-.45,AH,-.25,.14);balustrade(fe,s>0?NZ:-AZ,s>0?AZ:-NZ,AH);
    }
    // clerestory end above/behind the portal: pink-coped gable, a lancet pair each side
    for(const s of[-1,1])for(const dx of[-.45,.45])win(fe,s*5.1+dx,6.6,gr=>lancetShape(.45,4.6,.6,gr),glassM,.08);
    box(fe,pinkM,-NZ-.1,NZ+.1,NH-.45,NH,-.25,.14);
    const sh=new THREE.Shape();sh.moveTo(-NZ,NH);sh.lineTo(NZ,NH);sh.lineTo(0,NH+3.4);sh.closePath();
    const gm=new THREE.Mesh(new THREE.ShapeGeometry(sh),wallM);gm.position.z=.01;fe.add(gm);
    for(const s of[-1,1]){const c=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(NZ,3.4)+.5,.3,.4),pinkM);c.position.set(s*NZ/2,NH+1.7,.05);c.rotation.z=-s*Math.atan2(3.4,NZ);fe.add(c);}
    const cross=new THREE.Group();box(cross,pinkM,-.06,.06,0,1.1,-.06,.06);box(cross,pinkM,-.35,.35,.68,.8,-.06,.06);cross.position.set(0,NH+3.4,.05);fe.add(cross);
  }
  // ---- the portal: projecting block under the pointed gable, deep arch, cobogó ----
  {
    const PX=x1,PD=4,PW=4,PH=12.6,AW=2.8;                                                           // half-width, arch half-width
    // side walls of the portal block and its back (the hall)
    for(const s of[-1,1])box(g,wallM,PX,PX+PD,0,PH,s*PW-(s>0?.6:0)-(s<0?0:0),s*PW+(s<0?.6:0));
    box(g,tileBaseM,PX,PX+PD+.05,-6,0,-PW-.05,PW+.05,false);
    const ff=face(g,PX+PD,0,Math.PI/2);
    // front wall with the arch cut out, framed in pink
    const front=new THREE.Shape();front.moveTo(-PW,0);front.lineTo(PW,0);front.lineTo(PW,PH);front.lineTo(0,PH+2.4);front.lineTo(-PW,PH);front.closePath();
    const hole=new THREE.Path();hole.moveTo(-AW,0);hole.lineTo(-AW,7.6);hole.quadraticCurveTo(-AW,10.6,0,11.6);hole.quadraticCurveTo(AW,10.6,AW,7.6);hole.lineTo(AW,0);hole.closePath();front.holes.push(hole);
    const fw=new THREE.Mesh(new THREE.ExtrudeGeometry(front,{depth:.5,bevelEnabled:false,curveSegments:10}),wallM);fw.position.z=-.5;fw.castShadow=true;ff.add(fw);
    const outline=new THREE.Shape();outline.moveTo(-AW-.35,0);outline.lineTo(-AW-.35,7.6);outline.quadraticCurveTo(-AW-.35,10.9,0,12.05);outline.quadraticCurveTo(AW+.35,10.9,AW+.35,7.6);outline.lineTo(AW+.35,0);outline.closePath();
    const ohole=new THREE.Path();ohole.moveTo(-AW,0);ohole.lineTo(-AW,7.6);ohole.quadraticCurveTo(-AW,10.6,0,11.6);ohole.quadraticCurveTo(AW,10.6,AW,7.6);ohole.lineTo(AW,0);ohole.closePath();outline.holes.push(ohole);
    const om=new THREE.Mesh(new THREE.ShapeGeometry(outline,10),pinkM);om.position.z=.02;ff.add(om);
    for(const s of[-1,1]){const c=new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(PW,2.4)+.4,.28,.6),pinkM);c.position.set(s*PW/2,PH+1.2,-.2);c.rotation.z=-s*Math.atan2(2.4,PW);ff.add(c);}
    box(ff,pinkM,-PW-.1,-PW+.5,0,PH,-.5,.08);box(ff,pinkM,PW-.5,PW+.1,0,PH,-.5,.08);
    box(ff,tileBaseM,-PW+.5,-AW-.35,0,1.2,0,.04,false);box(ff,tileBaseM,AW+.35,PW-.5,0,1.2,0,.04,false);
    // the portal's own little roof behind the gable
    box(g,wallM,PX,PX+PD-.5,PH-.3,PH,-PW,PW);
    slope(g,PX,PX+PD-.3,-PW-.25,PH-.05,0,PH+2.2);slope(g,PX,PX+PD-.3,PW+.25,PH-.05,0,PH+2.2);
    const cr=new THREE.Group();box(cr,pinkM,-.06,.06,0,1.2,-.06,.06);box(cr,pinkM,-.38,.38,.75,.87,-.06,.06);cr.position.set(0,PH+2.4,-.2);ff.add(cr);
    // inside the arch (recessed 2.4 m): cobogó head, choir window with green shutters, pink
    // balcony slab, the entrance hall wall with its door and a small cobogó panel
    const back=face(g,PX+PD-2.4,0,Math.PI/2);
    const head=new THREE.Shape();head.moveTo(-AW,7.6);head.lineTo(AW,7.6);head.quadraticCurveTo(AW,10.6,0,11.6);head.quadraticCurveTo(-AW,10.6,-AW,7.6);
    const hm=new THREE.Mesh(uvScale(new THREE.ShapeGeometry(head,10),1.6,1.6),cobogoM);hm.position.z=.01;back.add(hm);
    box(back,cobogoM,-AW,-1,6.6,7.6,0,.02);box(back,cobogoM,1,AW,6.6,7.6,0,.02);
    box(back,wallM,-AW,AW,0,6.6,-.1,0);
    box(back,shutterM,-.9,.9,6.75,8.6,0,.06);box(back,wallM,-1,1,8.6,8.7,0,.08);
    box(g,pinkM,PX+PD-2.5,PX+PD+.25,6.2,6.55,-AW-.2,AW+.2);                                         // balcony slab
    box(g,wallM,PX+PD-2.4,PX+PD,6.55,6.75,-AW,AW);
    box(back,doorM,-1.1,1.1,0,3.1,0,.06);box(back,pinkM,-1.25,1.25,3.1,3.25,0,.08);
    box(back,cobogoM,-1.4,1.4,3.6,4.8,0,.04);
    box(g,stepM,PX+PD-2.4,PX+PD,-6,0,-AW,AW,false);                                                 // hall floor
    for(let k=0;k<5;k++)box(g,stepM,PX+PD+k*.36,PX+PD+(k+1)*.36,-6,-.2*(k+1),-PW-.6,PW+.6,false);  // steps down to the street
  }
  // ---- the tower ----
  {
    const {x0:tx0,x1:tx1,z0:tz0,z1:tz1,H:TH}=TOWER,W=tx1-tx0,cx=(tx0+tx1)/2,cz=(tz0+tz1)/2;
    box(g,wallM,tx0,tx1,0,TH,tz0,tz1);box(g,tileBaseM,tx0-.05,tx1+.05,-6,1.3,tz0-.05,tz1+.05,false);
    for(const[fx,fz,ry]of[[cx,tz1,0],[tx1,cz,Math.PI/2],[cx,tz0,Math.PI],[tx0,cz,-Math.PI/2]] as [number,number,number][]){
      const f=face(g,fx,fz,ry),hw=W/2;
      for(const x of[-hw,hw])box(f,pinkM,x-.4,x+.4,0,TH,-.4,.18);                                  // corner pilasters
      box(f,pinkM,-.28,.28,1.3,TH,-.1,.14);                                                         // middle pilaster
      for(const bx of[-hw/2-.05,hw/2+.05]){
        box(f,pinkM,bx-1.0,bx+1.0,1.5,21.3,-.02,.03);box(f,wallM,bx-.86,bx+.86,1.65,21.2,0,.04);
        for(const dx of[-.42,.42])win(f,bx+dx,1.9,gr=>lancetShape(.66,18.4,.6,gr),glassM,.05);
        box(f,pinkM,bx-.8,bx+.8,22.2,25.6,-.02,.03);box(f,wallM,bx-.68,bx+.68,22.3,25.5,0,.04);
        for(const dx of[-.27,.27])win(f,bx+dx,22.6,gr=>lancetShape(.36,2.1,.45,gr),glassM,.04);
        const clock=new THREE.Mesh(new THREE.CircleGeometry(.32,16),wallM);clock.position.set(bx,26.25,.06);f.add(clock);
        const rim=new THREE.Mesh(new THREE.RingGeometry(.32,.4,16),pinkM);rim.position.set(bx,26.25,.065);f.add(rim);
        box(f,pinkM,bx-.08,bx+.08,26.25,26.5,.06,.08);
        box(f,pinkM,bx-.9,bx+.9,26.9,30,-.02,.03);box(f,cobogoM,bx-.75,bx+.75,27.05,29.85,0,.05);
      }
      box(f,pinkM,-hw-.5,hw+.5,TH-.1,TH+.35,-.6,.28);                                              // top cornice
    }
    box(g,wallM,tx0+.2,tx1-.2,TH+.35,TH+.9,tz0+.2,tz1-.2);
    for(const[x,z]of[[tx0,tz0],[tx0,tz1],[tx1,tz0],[tx1,tz1]] as [number,number][]){
      const fin=new THREE.Mesh(new THREE.ConeGeometry(.16,.9,6),pinkM);fin.position.set(x,TH+.8,z);g.add(fin);}
    const cr=new THREE.Group();box(cr,pinkM,-.07,.07,0,2.2,-.07,.07);box(cr,pinkM,-.55,.55,1.35,1.5,-.07,.07);cr.position.set(cx,TH+.9,cz);g.add(cr);
  }
  g.userData.h=TOWER.H+3;
  return g;
}
export default {category:'Divinolândia',label:'Igreja Matriz (1:1)',build};
