import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';

// Prefeitura Municipal de Divinolândia — Rua XV de Novembro, modelled from Google Street
// View (panoramas SGqi-j3SSfA-ri1jDv0C5A and neighbours, captured with
// tools/capture-streetview.ts; images kept locally in
// docs/divinolandia/referencias-streetview/prefeitura*/). A one-storey civic compound in
// royal-blue limewash under clay-tile hipped roofs:
//   - the PAVILION on the left (west) reaching the pavement: an open porch behind two
//     wide round-headed arches, white inside, a white frieze with the name and a thin red
//     stripe under the eaves, raised on four blue-edged steps;
//   - the MAIN BLOCK set back behind a clay-paver forecourt, its glass door in a white
//     round-headed surround, reached by a ramp with red tubular railings;
//   - a smaller two-arch PORCH on its right, three FLAGPOLES (São Paulo, Brasil,
//     Divinolândia) in the forecourt and the parking area on the east side.
// build() is pure; the street front faces +z, x = east (the pavilion is at -x). The
// origin is at street level under the middle of the lot; PREF_FOOT are its collision
// boxes [cx, cz, w, d, height] in this frame.
const FL=.9;                                   // floor level of the raised rooms
const blueM=matte({color:DIVINO.civicBlue}),whiteM=matte({color:DIVINO.civicWhite});
const stripeM=matte({color:DIVINO.civicStripe}),railM=matte({color:DIVINO.railing});
const treadM=matte({color:DIVINO.stepTread}),glassM=matte({color:0x2e3a44}),frameM=matte({color:0x2a2a2e});
const roofM=matte({color:DIVINO.roofTiles[1],flatShading:true}),poleM=matte({color:0xdedede});
const paverM=matte({map:paverTexture()});

export const PREF_FOOT:[number,number,number,number,number][]=[
  [-8,8,10,10,FL+3.4],     // pavilion
  [0,-5,26,16,FL+3.6],     // main block
  [8.75,4.75,7.5,3.5,FL+3.2], // right porch
];

function box(g:THREE.Group,m:THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=true;b.receiveShadow=true;g.add(b);return b;
}

// a flat wall (in the x-y plane, facing +z) pierced by round-headed openings
function arcadeWall(w:number,h:number,t:number,holes:{x:number;w:number;h:number}[]):THREE.BufferGeometry{
  const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h);s.lineTo(-w/2,h);s.closePath();
  for(const o of holes){
    const r=o.w/2,p=new THREE.Path();
    p.moveTo(o.x-r,0);p.lineTo(o.x-r,o.h-r);p.absarc(o.x,o.h-r,r,Math.PI,0,true);p.lineTo(o.x+r,0);p.closePath();
    s.holes.push(p);
  }
  const geo=new THREE.ExtrudeGeometry(s,{depth:t,bevelEnabled:false,curveSegments:10});
  geo.translate(0,0,-t/2);
  return geo;
}

// hipped clay roof over a w×d rectangle: eave at y, rising `rise` to a ridge along the long side
function hipRoof(w:number,d:number,rise:number):THREE.BufferGeometry{
  const hw=w/2,hd=d/2,along=w>=d,r=along?hw-hd:hd-hw;
  const A=[-hw,0,-hd],B=[hw,0,-hd],C=[hw,0,hd],D=[-hw,0,hd];
  const R1=along?[-r,rise,0]:[0,rise,-r],R2=along?[r,rise,0]:[0,rise,r];
  const tris=along
    ?[[D,C,R2],[D,R2,R1],[B,A,R1],[B,R1,R2],[A,D,R1],[C,B,R2]]
    :[[A,R1,B],[C,R2,D],[D,R2,R1],[D,R1,A],[B,R1,R2],[B,R2,C]];
  const pos:number[]=[];for(const t of tris)for(const v of t)pos.push(...v);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.computeVertexNormals();
  return geo;
}
function roof(g:THREE.Group,cx:number,cz:number,w:number,d:number,y:number,rise:number):void{
  const m=new THREE.Mesh(hipRoof(w,d,rise),roofM);m.position.set(cx,y,cz);m.castShadow=true;g.add(m);
  // white fascia board + the thin red stripe just under it
  for(const[ww,dd,yy,mat,hh]of[[w,d,y-.22,whiteM,.22],[w-.5,d-.5,y-.32,stripeM,.1]] as [number,number,number,THREE.Material,number][]){
    const f=new THREE.Mesh(new THREE.BoxGeometry(ww,hh,dd),mat);f.position.set(cx,yy+hh/2,cz);g.add(f);
  }
}

function paverTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d')!;
  const hex=(n:number)=>'#'+n.toString(16).padStart(6,'0');
  x.fillStyle=hex(DIVINO.pavers);x.fillRect(0,0,128,128);
  x.strokeStyle=hex(DIVINO.paversDark);x.lineWidth=2;
  for(let r=0;r<8;r++)for(let k=0;k<4;k++){const ox=(r%2)*16;x.strokeRect(k*32+ox-32,r*16,32,16);x.strokeRect(k*32+ox,r*16,32,16);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,4);
  return t;
}

function signTexture():THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=1024;c.height=64;const x=c.getContext('2d')!;
  x.fillStyle='#f1efe8';x.fillRect(0,0,1024,64);
  x.fillStyle='#2f4f8f';x.font='700 34px serif';x.textAlign='center';x.textBaseline='middle';
  x.fillText('PREFEITURA MUNICIPAL DE DIVINOLÂNDIA',512,34);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// the three flags of the forecourt, painted on canvas
function flagTexture(kind:'sp'|'br'|'div'):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=192;c.height=128;const x=c.getContext('2d')!;
  if(kind==='br'){
    x.fillStyle='#1f8a3c';x.fillRect(0,0,192,128);
    x.fillStyle='#f2c818';x.beginPath();x.moveTo(96,12);x.lineTo(180,64);x.lineTo(96,116);x.lineTo(12,64);x.fill();
    x.fillStyle='#22408c';x.beginPath();x.arc(96,64,30,0,Math.PI*2);x.fill();
    x.strokeStyle='#f1efe8';x.lineWidth=4;x.beginPath();x.arc(96,98,44,-2.3,-.84);x.stroke();
  }else if(kind==='sp'){
    for(let i=0;i<13;i++){x.fillStyle=i%2?'#f1efe8':'#1b1b1b';x.fillRect(0,i*128/13,192,128/13+1);}
    x.fillStyle='#c62a2a';x.fillRect(0,0,80,59);
    x.fillStyle='#f1efe8';x.beginPath();x.arc(40,29,19,0,Math.PI*2);x.fill();
    x.fillStyle='#22408c';x.beginPath();x.moveTo(40,14);x.lineTo(52,29);x.lineTo(40,44);x.lineTo(28,29);x.fill();
  }else{
    const bands=['#a8312c','#f1efe8','#2a4c8f','#f1efe8','#a8312c'];
    bands.forEach((b,i)=>{x.fillStyle=b;x.fillRect(0,i*128/5,192,128/5+1);});
    x.fillStyle='#2a4c8f';x.fillRect(74,10,44,108);
    x.fillStyle='#f1efe8';x.beginPath();x.arc(96,64,30,0,Math.PI*2);x.fill();
    x.strokeStyle='#1b1b1b';x.lineWidth=5;x.beginPath();x.arc(96,64,30,0,Math.PI*2);x.stroke();
    x.fillStyle='#2f78b8';x.fillRect(86,58,20,16);x.fillStyle='#c62a2a';x.fillRect(86,52,20,6);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// a round-headed door: dark glass in a white surround
function door(g:THREE.Group,x:number,y:number,z:number,w:number,h:number):void{
  const sur=new THREE.Mesh(arcadeWall(w+.6,h+.35,.12,[]),whiteM);sur.position.set(x,y,z);g.add(sur);
  const s=new THREE.Shape();const r=w/2;s.moveTo(-r,0);s.lineTo(-r,h-r);s.absarc(0,h-r,r,Math.PI,0,true);s.lineTo(r,0);s.closePath();
  const gl=new THREE.Mesh(new THREE.ShapeGeometry(s,10),glassM);gl.position.set(x,y,z+.07);g.add(gl);
  const bar=new THREE.Mesh(new THREE.BoxGeometry(.06,h-.1,.02),frameM);bar.position.set(x,y+(h-.1)/2,z+.08);g.add(bar);
}
function windowAt(g:THREE.Group,x:number,y:number,z:number,w:number,h:number):void{
  const f=new THREE.Mesh(new THREE.BoxGeometry(w+.2,h+.2,.08),whiteM);f.position.set(x,y+h/2,z);g.add(f);
  const gl=new THREE.Mesh(new THREE.PlaneGeometry(w,h),glassM);gl.position.set(x,y+h/2,z+.05);g.add(gl);
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,.05,.02),whiteM);m.position.set(x,y+h*.55,z+.07);g.add(m);
}
// red tubular railing between two points (posts every ~1.2 m + top and mid rails)
function railing(g:THREE.Group,ax:number,ay:number,az:number,bx:number,by:number,bz:number):void{
  const n=Math.max(2,Math.round(Math.hypot(bx-ax,bz-az)/1.2));
  for(let i=0;i<=n;i++){const t=i/n;const p=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.95,6),railM);
    p.position.set(ax+(bx-ax)*t,ay+(by-ay)*t+.47,az+(bz-az)*t);g.add(p);}
  for(const hy of[.95,.5]){
    const a=new THREE.Vector3(ax,ay+hy,az),b=new THREE.Vector3(bx,by+hy,bz),len=a.distanceTo(b);
    const r=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,len,6),railM);
    r.position.copy(a).lerp(b,.5);r.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());g.add(r);
  }
}

function build():THREE.Group{
  const g=new THREE.Group();
  // ---- forecourt (clay pavers) + parking, at street level
  const court=new THREE.Mesh(new THREE.PlaneGeometry(16,11.6),paverM);
  court.rotation.x=-Math.PI/2;court.position.set(5,.03,8.8);court.receiveShadow=true;g.add(court);

  // ---- MAIN BLOCK: x -13..13, z -13..3 (front wall seen at x > -3 behind the forecourt)
  box(g,blueM,26,FL+.02,16,0,0,-5);                                   // plinth
  box(g,blueM,26,3.6,16,0,FL,-5);                                     // body
  roof(g,0,-5,27.2,17.2,FL+3.6,2.6);
  door(g,.5,FL,3.02,1.4,2.5);
  windowAt(g,-1.6,FL+1.1,3.03,.9,.8);windowAt(g,3.2,FL+1,3.03,1.1,1);
  // landing in front of the door, and the ramp down along the pavilion to the street
  box(g,treadM,3.2,FL,2,.5,0,4);
  {
    const ramp=new THREE.Mesh(new THREE.BoxGeometry(1.5,.2,8.4),treadM);
    ramp.position.set(-2.2,FL/2,9.2);ramp.rotation.x=Math.atan2(FL,8.4);g.add(ramp);
    railing(g,-2.95,FL,5,-2.95,0,13.4);railing(g,-1.45,FL,5,-1.45,0,13.4);
  }
  // downspouts
  for(const x of[-2.7,12.8])box(g,whiteM,.12,FL+3.5,.12,x,0,3.1);

  // ---- PAVILION: x -13..-3, z 3..13, open porch behind the two arches (z 10.6..13)
  box(g,blueM,10,FL+.02,10,-8,0,8);                                    // plinth
  const arc=new THREE.Mesh(arcadeWall(10,3.4,.35,[{x:-2.45,w:3.9,h:2.75},{x:2.45,w:3.9,h:2.75}]),blueM);
  arc.position.set(-8,FL,12.82);arc.castShadow=true;g.add(arc);
  box(g,blueM,.35,3.4,10,-12.83,FL,8);box(g,blueM,.35,3.4,10,-3.17,FL,8);   // side walls
  box(g,whiteM,9.3,3.4,.2,-8,FL,10.6);                                // white porch back wall
  box(g,whiteM,9.3,.12,2.2,-8,FL+3.28,11.7);                           // porch ceiling
  door(g,-8,FL,10.71,1.8,2.6);
  windowAt(g,-11.2,FL+1,10.71,1.1,1.1);
  {const tag=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.75),matte({map:flagTexture('div')}));tag.position.set(-5.1,FL+1.8,10.72);g.add(tag);}
  // small arched niche on the east side wall, like the real one
  {const n=new THREE.Mesh(arcadeWall(1.0,1.6,.04,[]),whiteM);n.position.set(-2.98,FL+.8,6.5);n.rotation.y=Math.PI/2;g.add(n);}
  // white frieze with the name over the arches
  {const f=new THREE.Mesh(new THREE.BoxGeometry(10.1,.5,.05),matte({map:signTexture()}));f.position.set(-8,FL+3.1,13.02);g.add(f);}
  roof(g,-8,8,11.2,11.2,FL+3.4,2.2);
  // the four steps up to the porch, all along the front
  for(let k=0;k<4;k++){
    const top=FL-k*.225,d=.4;
    box(g,blueM,10.2,top-.02,d,-8,0,13+.2+k*d);                       // blue riser block
    const t=new THREE.Mesh(new THREE.BoxGeometry(10.2,.04,d),treadM);t.position.set(-8,top-.02,13+.2+k*d);g.add(t);
  }

  // ---- RIGHT PORCH: x 5..12.5, z 3..6.5, two smaller arches facing the forecourt
  box(g,blueM,7.5,FL,3.5,8.75,0,4.75);
  {const a=new THREE.Mesh(arcadeWall(7.5,3.2,.3,[{x:-1.85,w:3,h:2.5},{x:1.85,w:3,h:2.5}]),blueM);a.position.set(8.75,FL,6.35);g.add(a);}
  box(g,blueM,.3,3.2,3.5,12.35,FL,4.75);
  box(g,whiteM,7,.1,3.2,8.75,FL+3.12,4.75);
  for(let k=0;k<2;k++){const t=new THREE.Mesh(new THREE.BoxGeometry(7.5,FL-k*.45,.45),treadM);t.position.set(8.75,(FL-k*.45)/2,6.7+k*.45);g.add(t);}
  roof(g,8.75,4.75,8.3,4.3,FL+3.2,1.4);

  // ---- three flagpoles in the forecourt: São Paulo, Brasil, Divinolândia
  ([['sp',2.3],['br',3.4],['div',4.5]] as ['sp'|'br'|'div',number][]).forEach(([k,x],i)=>{
    const h=9.2-i*.3,p=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,h,8),poleM);p.position.set(x,h/2,9);g.add(p);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(1.6,1.07),matte({map:flagTexture(k),side:THREE.DoubleSide}));
    f.position.set(x+.82,h-.6,9);g.add(f);
  });
  return g;
}

export default {category:'Divinolândia',label:'Prefeitura Municipal',build};
