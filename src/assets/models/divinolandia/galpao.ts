import * as THREE from 'three';
import {matte} from '../matte.ts';
import {canvasTex,signMat,glassM,darkM} from './posto-kit.ts';
import {corrugatedTexture,rebocoTexture,PLASTER_TILE_M} from './texturas.ts';
import type {GroundAt,P2} from './praca-chao.ts';

// A shed (galpão) of Divinolândia — the warehouses, coffee and agro stores, workshops,
// bus and truck depots, the gym and the covered court that the footprints of the Microsoft
// building data show and the town did not model (data: src/js/world/divinolandia/galpoes.ts,
// one entry per real building, each from its Street View photo and the satellite).
// Brazilian sheds as the photos show them: walls of painted render, exposed clay block
// (bloco cerâmico), grey concrete block or galvanised sheet, often a band of sheet above
// masonry; a roof of trapezoidal steel or fibre-cement sheet — a low gable, an arch, a
// lean-to or several spans side by side — sometimes covered in solar panels; big roll-up
// doors and the company's sign on the street front, a row of high windows on the sides.
// Or an open shed (posts and roof only), or a shade-net nursery.
//
// Local frame: x along the street front, z toward the street (the front wall is at
// z = +d/2), y up from the floor = the ground at the middle of the front. Walls reach down
// to the lowest ground under the footprint (groundAt, relative to that floor). build() is pure.

export type WallKind='reboco'|'bloco'|'concreto'|'chapa';
export type RoofKind='gable'|'arch'|'mono'|'flat';
export type RoofColor='galv'|'fibro'|'azul'|'branco'|'ferrugem'|'verde';
export interface Door{x:number;w:number;h:number;kind:'roll'|'open'|'gate'|'door';c?:string}
export interface GalpaoOpts{
  w:number;d:number;h:number;               // footprint and eave height above the floor
  roof?:RoofKind;ridge?:'x'|'z';            // ridge along x (eaves on the street) or z (gable end on the street)
  spans?:number;                            // parallel roof spans across the ridge (default 1)
  pitch?:number;                            // rise / half-span (gable), rise / span (arch)
  roofColor?:RoofColor;solar?:number;       // fraction of the roof covered in panels (from the back)
  wall?:WallKind;wallColor?:string;
  band?:{c:string;h:number};                // a painted base band (barrado)
  upper?:{kind:'chapa'|'reboco';c:string;from:number};   // cladding from `from` m up to the eave
  open?:'none'|'front'|'all';               // open sides on posts (the back wall stays unless 'all')
  doors?:Door[];
  windows?:{y:number;h:number;w:number;every:number;sides?:boolean;front?:boolean};
  sign?:{lines:string[];bg:string;fg:string;x:number;y:number;w:number;h:number};
  mural?:'checker';
  porch?:{w:number;d:number;h:number;c:string};           // a canopy over the front door (gym entrance)
  frontFace?:{c:string;trim:string};        // painted gable end on the street (gym)
  net?:boolean;                             // a shade-net nursery: posts and black net
  groundAt?:GroundAt;
}

// ------------------------------------------------------------------ materials (cached)
const cache=new Map<string,THREE.Material>();
const M=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=cache.get(k);if(!m){m=f();cache.set(k,m);}return m;};
const repeatTex=(t:THREE.Texture):THREE.Texture=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;};
// exposed hollow clay block (bloco cerâmico 14×19×39): big orange blocks, thin grey mortar
const BLOCO_M=1;
const blocoTex=():THREE.Texture=>repeatTex(canvasTex(256,256,(x,w,h)=>{
  x.fillStyle='#9b8e82';x.fillRect(0,0,w,h);
  const rows=5,bh=h/rows,bw=w/2.5;
  for(let j=0;j<rows;j++)for(let i=-1;i<4;i++){
    const ox=(j%2)*bw/2,v=((i*37+j*53)%30)-15;
    x.fillStyle=`rgb(${190+v},${104+v/2},${70+v/3})`;x.fillRect(i*bw+ox+2,j*bh+2,bw-4,bh-4);
    x.fillStyle='rgba(90,40,20,.18)';x.fillRect(i*bw+ox+2,j*bh+bh*.45,bw-4,3);
  }}));
// grey concrete block (bloco de concreto 19×39)
const concretoTex=():THREE.Texture=>repeatTex(canvasTex(256,256,(x,w,h)=>{
  x.fillStyle='#8f8c86';x.fillRect(0,0,w,h);
  const rows=5,bh=h/rows,bw=w/2.5;
  for(let j=0;j<rows;j++)for(let i=-1;i<4;i++){const ox=(j%2)*bw/2,v=((i*41+j*29)%26)-13;
    x.fillStyle=`rgb(${170+v},${167+v},${160+v})`;x.fillRect(i*bw+ox+2,j*bh+2,bw-4,bh-4);
    for(let k=0;k<40;k++){x.fillStyle='rgba(90,88,84,.25)';x.fillRect(i*bw+ox+2+((k*13)%(bw-6)),j*bh+2+((k*7)%(bh-6)),2,2);}}}));
const wallMat=(kind:WallKind,c:string):THREE.Material=>M('w'+kind+c,()=>{
  if(kind==='bloco')return matte({map:blocoTex()});
  if(kind==='concreto')return matte({map:concretoTex()});
  if(kind==='chapa'){const t=corrugatedTexture().clone();t.needsUpdate=true;repeatTex(t);return matte({color:c,map:t});}
  const t=rebocoTexture().clone();t.needsUpdate=true;repeatTex(t);return matte({color:c,map:t});
});
const wallTile=(kind:WallKind):number=>kind==='reboco'?PLASTER_TILE_M:kind==='chapa'?1.2:BLOCO_M;
const ROOF_C:Record<RoofColor,string>={galv:'#c3c7c9',fibro:'#9a9a94',azul:'#5f86b5',branco:'#e4e4e0',ferrugem:'#8a5b44',verde:'#5d7d5a'};
const roofMat=(c:RoofColor):THREE.Material=>M('roof'+c,()=>{const t=corrugatedTexture().clone();t.needsUpdate=true;repeatTex(t);
  return matte({color:ROOF_C[c],map:t,side:THREE.DoubleSide});});
const steelM=():THREE.Material=>M('steel',()=>matte({color:0x6d7276}));
const postBlueM=():THREE.Material=>M('postblue',()=>matte({color:0x2f5fa8}));
const rollM=():THREE.Material=>M('roll',()=>matte({color:0xb9bcbd,map:repeatTex(canvasTex(64,128,(c,w,h)=>{c.fillStyle='#c2c4c4';c.fillRect(0,0,w,h);c.fillStyle='#8e9193';for(let y=0;y<h;y+=6)c.fillRect(0,y,w,1.6);}))}));
const pvM=():THREE.Material=>M('pv',()=>matte({color:0x1d2a44,emissive:0x05070c,side:THREE.DoubleSide}));
const netM=():THREE.Material=>M('net',()=>matte({color:0x1c1d1c,transparent:true,opacity:.82,side:THREE.DoubleSide,depthWrite:false}));
const flatM=(c:string):THREE.Material=>M('f'+c,()=>matte({color:c}));
const checkerM=():THREE.Material=>M('checker',()=>matte({map:canvasTex(512,256,(c,w,h)=>{
  // a big chequered flag waving across the wall (the auto shop's mural): 10 × 4 squares,
  // each column lifted by the wave so the rows curve
  c.fillStyle='#ece9e1';c.fillRect(0,0,w,h);
  const cols=10,rows=4,cw=w/cols,rh=h*.62/rows;
  for(let i=0;i<cols;i++){const y0=h*.06+Math.sin(i/cols*Math.PI*1.6)*h*.12;
    for(let j=0;j<rows;j++){if((i+j)%2)continue;c.fillStyle='#141414';
      const k=Math.sin((i+1)/cols*Math.PI*1.6)*h*.12-Math.sin(i/cols*Math.PI*1.6)*h*.12;
      c.beginPath();c.moveTo(i*cw,y0+j*rh);c.lineTo((i+1)*cw,y0+j*rh+k);c.lineTo((i+1)*cw,y0+(j+1)*rh+k);c.lineTo(i*cw,y0+(j+1)*rh);c.fill();}}
  c.fillStyle='#c8322c';c.fillRect(0,h*.86,w,h*.14);})}));

// ------------------------------------------------------------------ helpers
const uvM=(geo:THREE.BufferGeometry,su:number,sv:number):THREE.BufferGeometry=>{
  const uv=geo.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*su,uv.getY(i)*sv);return geo;};
function boxAt(g:THREE.Object3D,m:THREE.Material,x:number,y0:number,y1:number,z:number,w:number,d:number,tile=0):THREE.Mesh{
  const geo=new THREE.BoxGeometry(w,y1-y0,d);if(tile)uvM(geo,Math.max(w,d)/tile,(y1-y0)/tile);
  const b=new THREE.Mesh(geo,m);b.position.set(x,(y0+y1)/2,z);b.castShadow=true;b.receiveShadow=true;g.add(b);return b;
}
// a wall between (x0,z0) and (x1,z1), from y0 to y1, thickness .2, texture in metres
function wall(g:THREE.Object3D,m:THREE.Material,a:P2,b:P2,y0:number,y1:number,tile:number):void{
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),geo=new THREE.BoxGeometry(L,y1-y0,.2);uvM(geo,L/tile,(y1-y0)/tile);
  const w=new THREE.Mesh(geo,m);w.position.set((a[0]+b[0])/2,(y0+y1)/2,(a[1]+b[1])/2);w.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);
  w.castShadow=true;w.receiveShadow=true;g.add(w);
}
// a roof surface from a profile across the span (pairs [u, y], u from 0..span) swept along
// the ridge (length L); `along` = the axis of the ridge
function sweep(g:THREE.Object3D,m:THREE.Material,prof:[number,number][],u0:number,L:number,along:'x'|'z',y:number):THREE.Mesh{
  const pos:number[]=[],uv:number[]=[],idx:number[]=[];let acc=0;
  for(let i=0;i<prof.length;i++){
    if(i)acc+=Math.hypot(prof[i][0]-prof[i-1][0],prof[i][1]-prof[i-1][1]);
    for(const s of[-L/2,L/2]){const u=u0+prof[i][0],v=y+prof[i][1];
      if(along==='x')pos.push(s,v,u);else pos.push(u,v,s);uv.push(acc/1.2,s/1.2);}
  }
  for(let i=0;i<prof.length-1;i++){const a=i*2;idx.push(a,a+1,a+3,a,a+3,a+2);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();
  const r=new THREE.Mesh(geo,m);r.castShadow=true;r.receiveShadow=true;g.add(r);return r;
}
// the gable/arch infill of an end wall (a profile over the eave line) in the plane x = xw or z = zw
function gableEnd(g:THREE.Object3D,m:THREE.Material,prof:[number,number][],u0:number,along:'x'|'z',at:number,y:number,tile:number):void{
  const s=new THREE.Shape();s.moveTo(prof[0][0],0);for(const[u,v]of prof)s.lineTo(u,v);s.lineTo(prof[prof.length-1][0],0);s.closePath();
  const geo=new THREE.ShapeGeometry(s,8);uvM(geo,1/tile,1/tile);
  const p=new THREE.Mesh(geo,m);p.material=m;(p.material as THREE.MeshLambertMaterial).side=THREE.DoubleSide;
  if(along==='x'){p.rotation.y=-Math.PI/2;p.position.set(at,y,u0);}else p.position.set(u0,y,at);
  g.add(p);
}
const profile=(kind:RoofKind,span:number,pitch:number):[number,number][]=>{
  if(kind==='arch'){const rise=span*pitch,n=14;return Array.from({length:n+1},(_,i)=>{const u=i/n;return[u*span,rise*4*u*(1-u)] as [number,number];});}
  if(kind==='mono')return[[0,span*pitch],[span,0]];
  if(kind==='flat')return[[0,.25],[span,0]];
  return[[0,0],[span/2,span/2*pitch],[span,0]];
};

function build(o:GalpaoOpts):THREE.Group{
  const g=new THREE.Group(),{w,d,h}=o,at:GroundAt=o.groundAt??(()=>0);
  const roof=o.roof??'gable',ridge=o.ridge??(w>=d?'x':'z'),spans=Math.max(1,o.spans??1);
  const pitch=o.pitch??(roof==='arch'?.14:roof==='mono'?.1:.18);
  // the lowest ground under the footprint (walls reach it)
  let lo=0;for(let i=0;i<=6;i++)for(let j=0;j<=6;j++)lo=Math.min(lo,at(-w/2+w*i/6,-d/2+d*j/6));
  const base=lo-.5,top=h;
  const wk=o.wall??'reboco',wc=o.wallColor??'#e8e4dc',wm=wallMat(wk,wc),tile=wallTile(wk);
  const cs:P2[]=[[-w/2,d/2],[w/2,d/2],[w/2,-d/2],[-w/2,-d/2]];        // front-left, front-right, back-right, back-left
  if(o.net){
    // shade-net nursery: a grid of posts, black net over the top and down the sides
    for(let x=-w/2;x<=w/2+.01;x+=w/Math.max(1,Math.round(w/4)))for(let z=-d/2;z<=d/2+.01;z+=d/Math.max(1,Math.round(d/4)))
      boxAt(g,flatM('#7a6a55'),x,at(x,z)-.3,3.1,z,.12,.12);
    const t=new THREE.Mesh(new THREE.PlaneGeometry(w,d),netM());t.rotation.x=-Math.PI/2;t.position.y=3.05;g.add(t);
    for(const[a,b]of[[cs[0],cs[1]],[cs[1],cs[2]],[cs[2],cs[3]],[cs[3],cs[0]]] as [P2,P2][]){
      const L=Math.hypot(b[0]-a[0],b[1]-a[1]),s=new THREE.Mesh(new THREE.PlaneGeometry(L,3),netM());
      s.position.set((a[0]+b[0])/2,1.55,(a[1]+b[1])/2);s.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(s);}
    return g;
  }
  const open=o.open??'none';
  // ---------- walls (or posts on the open sides)
  const sides:[P2,P2,'front'|'right'|'back'|'left'][]=[[cs[0],cs[1],'front'],[cs[1],cs[2],'right'],[cs[2],cs[3],'back'],[cs[3],cs[0],'left']];
  const posts=(a:P2,b:P2):void=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/6));
    for(let k=0;k<=n;k++){const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n;boxAt(g,o.wallColor==='#2f5fa8'?postBlueM():steelM(),x,at(x,z)-.3,top,z,.22,.22);}};
  for(const[a,b,s]of sides){
    const isOpen=open==='all'||(open==='front'&&s==='front');
    if(isOpen){posts(a,b);continue;}
    const upFrom=o.upper?Math.min(top,o.upper.from):top;
    wall(g,o.frontFace&&s==='front'?flatM(o.frontFace.c):wm,a,b,base,upFrom,tile);
    if(o.upper&&upFrom<top)wall(g,wallMat(o.upper.kind,o.upper.c),a,b,upFrom,top,wallTile(o.upper.kind));
    if(o.band){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L;
      const out:P2=[nx*.11,nz*.11],ctr:P2=[(a[0]+b[0])/2,(a[1]+b[1])/2],sign=(ctr[0]*out[0]+ctr[1]*out[1])>0?1:-1;
      wall(g,flatM(o.band.c),[a[0]+out[0]*sign,a[1]+out[1]*sign],[b[0]+out[0]*sign,b[1]+out[1]*sign],base,o.band.h,1);}
  }
  // ---------- roof: `spans` parallel spans across the ridge, eaves .5 m out
  const along=ridge,acrossLen=ridge==='x'?d:w,ridgeLen=(ridge==='x'?w:d)+1,span=(acrossLen+1)/spans;
  const prof=profile(roof,span,pitch),rm=roofMat(o.roofColor??'galv');
  for(let s=0;s<spans;s++){
    const u0=-(acrossLen+1)/2+s*span;
    sweep(g,rm,prof,u0,ridgeLen,along,top);
    // gable infill at both ends (closed walls only); a gutter between spans
    const endA=ridge==='x'?-w/2:-d/2,endB=-endA;
    for(const e of[endA,endB]){
      const endSide=ridge==='x'?(e<0?'left':'right'):(e<0?'back':'front');
      const isOpen=open==='all'||(open==='front'&&endSide==='front');
      if(!isOpen&&roof!=='flat')gableEnd(g,o.frontFace&&endSide==='front'?flatM(o.frontFace.c):(o.upper?wallMat(o.upper.kind,o.upper.c):wm),
        prof.map(([u,v])=>[Math.max(-acrossLen/2,Math.min(acrossLen/2,u0+u)),v] as [number,number]),0,along,e,top,o.upper?wallTile(o.upper.kind):tile);
    }
    if(s>0){const u=u0;boxAt(g,steelM(),along==='x'?0:u,top-.12,top+.04,along==='x'?u:0,along==='x'?ridgeLen:.4,along==='x'?.4:ridgeLen);}
  }
  // eave fascia (the gutter) along the eaves
  for(const sgn of[-1,1]){const u=sgn*(acrossLen+1)/2;boxAt(g,flatM('#d9d7d0'),along==='x'?0:u,top-.25,top+.05,along==='x'?u:0,along==='x'?ridgeLen:.18,along==='x'?.18:ridgeLen);}
  // solar panels over the back part of the roof
  if(o.solar&&roof!=='arch'){
    // the panels: the same roof profile, inset from the eaves and lifted 12 cm, over a
    // stretch of the ridge length starting at the back end
    const f=Math.min(1,o.solar),L=(ridgeLen-2)*f;
    const roofAt=(u:number):number=>{for(let i=1;i<prof.length;i++)if(u<=prof[i][0]){const[a,va]=prof[i-1],[b,vb]=prof[i];return va+(vb-va)*(u-a)/((b-a)||1);}return prof[prof.length-1][1];};
    const sub:[number,number][]=[[.6,roofAt(.6)+.12],...prof.filter(([u])=>u>.6&&u<span-.6).map(([u,v])=>[u,v+.12] as [number,number]),[span-.6,roofAt(span-.6)+.12]];
    for(let s=0;s<spans;s++){
      const u0=-(acrossLen+1)/2+s*span,panel=sweep(g,pvM(),sub,u0,L,along,top);
      if(along==='x')panel.position.x=-(ridgeLen-2)/2+L/2;else panel.position.z=-(ridgeLen-2)/2+L/2;
      panel.castShadow=false;
    }
  }
  // ---------- the street front: doors, windows, sign, mural, porch
  const fz=d/2+.11;
  if(open!=='all'&&open!=='front'){
    for(const dr of o.doors??[]){
      const m=dr.kind==='roll'?rollM():dr.kind==='open'?darkM():flatM(dr.c??'#6d7276');
      const p=new THREE.Mesh(new THREE.PlaneGeometry(dr.w,dr.h),m);p.position.set(dr.x,dr.h/2,fz);g.add(p);
      if(dr.kind!=='open'){const fr=new THREE.Mesh(new THREE.PlaneGeometry(dr.w+.2,.18),flatM('#5f6366'));fr.position.set(dr.x,dr.h+.09,fz+.005);g.add(fr);}
    }
    // the mural: ~16 m of wall round the door (a 2:1 picture, so the squares stay square)
    if(o.mural==='checker'){const mh=Math.min(top-.4,6),mw=Math.min(w*.92,mh*2.6),p=new THREE.Mesh(new THREE.PlaneGeometry(mw,mh),checkerM());p.position.set(Math.max(-w/2+mw/2+.3,(o.doors?.[0]?.x??0)),mh/2+.2,fz-.005);g.add(p);}
  }
  if(o.windows){
    const W=o.windows,gm=glassM();
    const row=(a:P2,b:P2,out:number):void=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L,nx=uz*out,nz=-ux*out;
      for(let s=W.every/2;s<L-1;s+=W.every){const p=new THREE.Mesh(new THREE.PlaneGeometry(W.w,W.h),gm);
        p.position.set(a[0]+ux*s+nx*.12,W.y+W.h/2,a[1]+uz*s+nz*.12);p.rotation.y=-Math.atan2(uz,ux)+(out>0?0:Math.PI);g.add(p);
        const sill=new THREE.Mesh(new THREE.BoxGeometry(W.w+.1,.08,.14),flatM('#d6d3cb'));sill.position.set(p.position.x,W.y-.04,p.position.z);sill.rotation.y=p.rotation.y;g.add(sill);}};
    if(W.sides!==false){row(cs[1],cs[2],1);row(cs[3],cs[0],1);}
    if(W.front)row(cs[0],cs[1],1);
  }
  if(o.sign){const s=o.sign,b=new THREE.Mesh(new THREE.PlaneGeometry(s.w,s.h),signMat(s.lines,{bg:s.bg,fg:s.fg,w:Math.round(256*s.w/s.h),h:256}));
    b.position.set(s.x,s.y,fz+.03);g.add(b);}
  if(o.porch){const p=o.porch;
    boxAt(g,flatM(p.c),0,p.h,p.h+.25,d/2+p.d/2,p.w,p.d);
    for(const x of[-p.w/2+.2,p.w/2-.2])boxAt(g,flatM(p.c),x,at(x,d/2+p.d-.2)-.2,p.h,d/2+p.d-.2,.3,.3);}
  if(o.frontFace&&roof==='arch'){
    // the gym's painted gable: trim along the arch
    const tr=flatM(o.frontFace.trim);
    for(let i=0;i<prof.length-1;i++){const[u0,v0]=prof[i],[u1,v1]=prof[i+1],ua=-(acrossLen+1)/2+u0,ub=-(acrossLen+1)/2+u1;
      const L=Math.hypot(ub-ua,v1-v0),b=new THREE.Mesh(new THREE.BoxGeometry(L,.3,.25),tr);
      b.position.set((ua+ub)/2,top+(v0+v1)/2-.1,d/2+.15);b.rotation.z=Math.atan2(v1-v0,ub-ua);g.add(b);}
  }
  // floor slab (open sheds show it)
  if(open!=='none'){const f=new THREE.Mesh(new THREE.BoxGeometry(w,.2,d),flatM('#a9a59c'));f.position.y=-.08;f.receiveShadow=true;g.add(f);}
  return g;
}

export default {category:'Divinolândia',label:'Galpão',build,variants:[
  {label:'Galpão de chapa',opts:{w:30,d:20,h:7,wall:'chapa',wallColor:'#c3c7c9',doors:[{x:0,w:6,h:5,kind:'roll'}]}},
  {label:'Galpão em arco',opts:{w:40,d:30,h:7,roof:'arch',ridge:'z',wall:'bloco',roofColor:'azul'}},
  {label:'Barracão aberto',opts:{w:40,d:16,h:5,open:'all',roofColor:'ferrugem'}},
]};
