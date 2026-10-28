// The Hospital Regional's front, from the satellite (referencias-satelite/frente-hospital,
// pracinha-z21) and the visitors' photos on Google Maps (referencias-streetview/hp-maps,
// local — Street View's car never went in past the gatehouse). Two one-way drives of
// hexagonal pavers run along the sanatorium's north front (OSM 1215144212 out, 1215144213
// in along the building), and between the building and the inner drive lies a paver strip
// where the cars park nose-in under the façade, either side of the porch. Between the drives
// the garden square: a yellow-painted kerb, a cement walk and a grey kerb on the inner side,
// a low white kerb on the outer one; double rows of clipped hedges along both edges; egg-shaped
// thujas, big and dense in front of the porch and in a row toward the gate; tall slender
// palms; double-armed street lamps; a paver path across from the porch steps; the CONDERG
// direction sign and the white "E" parking signs. At the gate end the drives close round a
// yellow-kerbed island with a pointed cypress. North of the outer drive the red-earth car
// park full of cars up to the dirt track, the great dome of rock on its lawn by the entrance
// road, and the little orange-roofed house at the west end.
// Most of it is laid in the hospital model's frame (hospital-regional.ts: x along the front,
// +x west, +z out of the façade, the front at z 7.5) — the drives run straight in it.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {matte} from '../../../../assets/models/matte.ts';
import {leafMat,leafMass} from '../../../../assets/models/divinolandia/copa.ts';
import Palmeira from '../../../../assets/models/divinolandia/palmeira-imperial.ts';
import ArvorePraca from '../../../../assets/models/divinolandia/arvore-praca.ts';
import placa from '../../../../assets/models/divinolandia/placa.ts';
import {hexMat} from '../../../../assets/models/divinolandia/rua.ts';
import {SEXT_W,SEXT_H} from '../../../../assets/models/divinolandia/texturas.ts';
import {SITE_TABLE} from '../sites-table.ts';
import {DIV_OX,DIV_OZ} from '../data.ts';
import {addObb} from '../collide.ts';
import {addSurfacePolygon} from '../../surface-lift.ts';
import type {ExtrasCtx} from './extras.ts';

type P2=[number,number];
// the drives' centre lines (OSM, town-local), service roads 2.6 m half-width
const OUT:P2[]=[[-264.2,618.9],[-269.6,621.4],[-273.9,623.1],[-278.7,624.9],[-292.3,629],[-307.3,632],[-317.2,633.9],[-325.6,636.3],[-333.1,639],[-343.7,643.7],[-359.6,653.5],[-365.7,657.6],[-367.1,660]];
const IN:P2[]=[[-367.1,660],[-364.7,664.4],[-362.7,666.3],[-359.7,667.1],[-356.4,667.3],[-351.6,665.1],[-342.5,661.1],[-299.9,642.1],[-278.4,629.7],[-274.7,627.6],[-271.9,625.2],[-264.2,618.9]];
const HWD=2.6;
// the hospital model's frame in town-local metres (sites-table `hospital` minus HOSP_LOT
// of hospital-regional.ts, turned by the lot's facing)
const HS=SITE_TABLE.hospital,YAW=HS.face,C=Math.cos(YAW),S=Math.sin(YAW),LOT={x:-8.5,z:-19};
const HX=HS.x-(LOT.x*C+LOT.z*S),HZ=HS.z-(-LOT.x*S+LOT.z*C);
const T=(x:number,z:number):P2=>[HX+x*C+z*S,HZ-x*S+z*C];            // model frame → town-local
const L=(x:number,z:number):P2=>[(x-HX)*C-(z-HZ)*S,(x-HX)*S+(z-HZ)*C];  // town-local → model frame
const FRONT=7.5;                                                     // the wings' façade line
const PORCH:[number,number]=[-11.8,4.8];                             // ramp ... steps (model x)
const BAYS_OFF=1.2;                                                  // bays stop this short of it
const IN_L=IN.map(p=>L(...p)),OUT_L=OUT.map(p=>L(...p));
// the red-earth car park: from the outer drive's kerb up past the dirt track (town-local)
const PARK:P2[]=[[-373,627],[-367,619],[-358.8,614],[-350.4,609],[-341.2,605],[-332.1,603],[-320.1,601],[-309,599.3],[-300.2,596.3],[-292,593],
  [-292,625.6],[-307,628.9],[-317,630.9],[-325.6,633.3],[-333,636],[-343.7,640.8],[-359.6,650.6],[-366,654.6],[-373,650]];
const ROCK:P2=[-283.5,620.5];
const HOUSE={x:-384,z:647,w:14,d:8};

const dirtM=matte({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const yellowM=matte({color:0xe0b52a}),whiteKerbM=matte({color:0xd9d6cc}),greyKerbM=matte({color:0xa9a69e}),cementM=matte({color:0xc4beb2});
const rockM=matte({color:0x5a4c40,flatShading:true}),agaveM=matte({color:0x7f9a86}),bedM=matte({color:0x8a5a3e});
const wallM=matte({color:0xeadfbe}),roofM=matte({color:0xc0613c}),doorM=matte({color:0x6a4a34});
const poleM=matte({color:0x9aa0a4}),lampM=matte({color:0xd8dcdc});
const hedgeM=leafMat(0x3e5a2c),thujaMs=[0x3c5a2a,0x46652f,0x34502a].map(c=>leafMat(c));

function rng(seed:number):()=>number{let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// z of a polyline at x (the first segment spanning it)
function zAt(P:P2[],x:number):number{
  for(let i=1;i<P.length;i++){const[ax,az]=P[i-1],[bx,bz]=P[i];if((x-ax)*(x-bx)<=0&&ax!==bx)return az+(bz-az)*(x-ax)/(bx-ax);}
  return NaN;
}
// the drives in the model frame: the inner one's centre and the outer one's, at model x
// (the inner one from where it comes round the west loop: model x ≤ 12.4)
const zIn=(x:number):number=>zAt(IN_L.slice(2),x),zOut=(x:number):number=>zAt(OUT_L,x);
function box(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,ry:number):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.rotation.y=ry;b.castShadow=true;b.receiveShadow=true;return b;
}

// a flat polygon draped on the ground: triangulated, then split until no edge passes 2.5 m.
// `H` gives the ground under a polygon point; `uv` (optional) its texture coordinates
function drape(poly:P2[],H:(x:number,z:number)=>number,lift:number,m:THREE.Material,o:{col?:number;uv?:(x:number,z:number)=>P2}={}):THREE.Mesh{
  const tris=THREE.ShapeUtils.triangulateShape(poly.map(([x,z])=>new THREE.Vector2(x,z)),[]);
  const pos:number[]=[],uvs:number[]=[];
  const put=(a:P2,b:P2,c:P2):void=>{
    const ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(b[0]-c[0],b[1]-c[1]),ca=Math.hypot(c[0]-a[0],c[1]-a[1]);
    if(Math.max(ab,bc,ca)>2.5){
      const m=(p:P2,q:P2):P2=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
      if(ab>=bc&&ab>=ca){const n=m(a,b);put(a,n,c);put(n,b,c);}
      else if(bc>=ca){const n=m(b,c);put(a,b,n);put(a,n,c);}
      else{const n=m(c,a);put(a,b,n);put(n,b,c);}
      return;
    }
    // wound to face up whichever way the polygon runs
    const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1])>0;
    for(const p of up?[a,b,c]:[a,c,b]){pos.push(p[0],H(p[0],p[1])+lift,p[1]);if(o.uv)uvs.push(...o.uv(p[0],p[1]));}
  };
  for(const[i,j,k]of tris)put(poly[i],poly[j],poly[k]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  if(o.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.computeVertexNormals();
  if(o.col){                                   // mottled: each spot of ground its own shade
    const c:number[]=[],base=new THREE.Color(o.col),k=new THREE.Color();
    for(let i=0;i<pos.length;i+=3){
      const x=pos[i],z=pos[i+2],n=Math.sin(x*.71+z*.33)*Math.sin(z*.53-x*.21)*.5+Math.sin(x*2.3+z*1.9)*.25;
      k.copy(base).multiplyScalar(.86+n*.3);c.push(k.r,k.g,k.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  }
  const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true;return mesh;
}

// the hundreds of kerb, hedge, bay-line and leaf pieces a group holds directly: merged into
// one mesh per material (same attributes), so the front draws in a few calls
function mergeChildren(g:THREE.Group):void{
  const by=new Map<string,{m:THREE.Material;geos:THREE.BufferGeometry[];meshes:THREE.Mesh[]}>();
  for(const o of g.children){
    if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))continue;
    const geo=o.geometry as THREE.BufferGeometry,key=o.material.uuid+'|'+Object.keys(geo.attributes).sort().join(',')+'|'+!!geo.index;
    let e=by.get(key);if(!e){e={m:o.material,geos:[],meshes:[]};by.set(key,e);}
    o.updateMatrix();e.geos.push(geo.clone().applyMatrix4(o.matrix));e.meshes.push(o);
  }
  for(const e of by.values()){
    if(e.meshes.length<2)continue;
    const merged=mergeGeometries(e.geos,false);if(!merged)continue;
    for(const o of e.meshes){g.remove(o);o.geometry.dispose();}
    const m=new THREE.Mesh(merged,e.m);m.castShadow=true;m.receiveShadow=true;g.add(m);
  }
}

// a thuja as the hospital's are clipped: a dense egg of foliage down to the ground, broad
// low and rounding to a blunt point; h tall, r wide
function thuja(h:number,r:number,seed:number):THREE.Group{
  const g=new THREE.Group(),src=leafMass(seed%5+1,.16,3),geo=src.clone(),p=geo.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),k=1-.36*y-.14*y*y;                   // y −1..1 → wider below, tapering above
    p.setXYZ(i,p.getX(i)*r*k,(y+1)/2*h-.05,p.getZ(i)*r*k);
  }
  geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,thujaMs[seed%3]);m.castShadow=true;m.receiveShadow=true;g.add(m);
  return g;
}
// a street lamp of the hospital's grounds: a grey steel pole with two curved arms in a Y
function lamp(h=8.2):THREE.Group{
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,h,8),poleM);pole.position.y=h/2;pole.castShadow=true;g.add(pole);
  for(const sd of[-1,1]){
    const a=new THREE.Vector3(0,h-.1,0),b=new THREE.Vector3(sd*1.7,h+.8,0);
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.045,.05,a.distanceTo(b),6),poleM);
    arm.position.copy(a).lerp(b,.5);arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());g.add(arm);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.32,10,6),lampM);head.scale.set(1.4,.45,.8);head.position.set(sd*1.95,h+.82,0);g.add(head);
  }
  return g;
}
// a hipped roof W × D (eaves included) rising `h` to a ridge along x; origin at the eaves' middle
function hipRoof(W:number,D:number,h:number):THREE.BufferGeometry{
  const a=W/2,b=D/2,r=Math.max(0,a-b);
  const e=[[-a,0,-b],[a,0,-b],[a,0,b],[-a,0,b]],R0=[-r,h,0],R1=[r,h,0];
  const t=[e[3],e[2],R1,e[3],R1,R0, e[1],e[0],R0,e[1],R0,R1, e[0],e[3],R0, e[2],e[1],R1];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(t.flat(),3));g.computeVertexNormals();
  return g;
}
// the dome of dark weathered rock: a lumpy, rounded hemisphere
function rock(r:number,seed:number):THREE.Mesh{
  const geo=new THREE.SphereGeometry(r,14,9,0,Math.PI*2,0,Math.PI/2),p=geo.getAttribute('position'),rnd=rng(seed);
  for(let i=0;i<p.count;i++){const k=.92+rnd()*.12;p.setXYZ(i,p.getX(i)*k,p.getY(i)*1.05*k,p.getZ(i)*k*.85);}
  geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,rockM);m.castShadow=true;m.receiveShadow=true;return m;
}
// an agave: a rosette of stiff blue-grey leaves
function agave(g:THREE.Group,x:number,y:number,z:number,seed:number):void{
  const rnd=rng(seed);
  for(let i=0;i<9;i++){
    const a=i/9*Math.PI*2+rnd(),tilt=.5+rnd()*.5,l=.7+rnd()*.4;
    const leaf=new THREE.Mesh(new THREE.ConeGeometry(.08,l,4),agaveM);
    leaf.position.set(x+Math.sin(a)*Math.sin(tilt)*l/2,y+Math.cos(tilt)*l/2,z+Math.cos(a)*Math.sin(tilt)*l/2);
    leaf.rotation.set(Math.cos(a)*tilt,0,-Math.sin(a)*tilt);g.add(leaf);
  }
}

export function hospitalFrente(ctx:ExtrasCtx):number{
  const H=(x:number,z:number):number=>ctx.H(x+DIV_OX,z+DIV_OZ);          // town-local ground
  const HL=(x:number,z:number):number=>H(...T(x,z));                     // model-frame ground
  const W=(x:number,z:number):P2=>{const[a,b]=T(x,z);return[a+DIV_OX,b+DIV_OZ];};
  const g=new THREE.Group();g.position.set(DIV_OX,0,DIV_OZ);           // children in town-local x,z
  const f=new THREE.Group();f.position.set(HX+DIV_OX,0,HZ+DIV_OZ);f.rotation.y=YAW;   // children in the model frame
  const rnd=rng(1945);
  // a model-frame object stood on the ground, with a collision box w × d (model axes)
  const stand=(o:THREE.Object3D,x:number,z:number,w=0,d=0,top=0):void=>{
    const y=HL(x,z);o.position.set(x,y,z);f.add(o);
    if(w)addObb(...W(x,z),w,d,-YAW,y+top);
  };
  // a run of boxes along model x at depth z(x) (kerbs, hedges): [x0,x1] in 1.5 m pieces
  const run=(x0:number,x1:number,z:(x:number)=>number,w:number,h:number,m:THREE.Material,y0=0):void=>{
    for(let x=x0;x<x1;x+=1.5){
      const xa=x,xb=Math.min(x1,x+1.5),za=z(xa),zb=z(xb);if(!isFinite(za)||!isFinite(zb))continue;
      const mx=(xa+xb)/2,mz=(za+zb)/2,len=Math.hypot(xb-xa,zb-za)+.02;
      f.add(box(len,h,w,m,mx,HL(mx,mz)+y0+h/2,mz,-Math.atan2(zb-za,xb-xa)));
    }
  };

  // --- the red-earth car park
  g.add(drape(PARK,H,.05,dirtM,{col:0x9a5a3e}));
  addSurfacePolygon(PARK.map(([x,z])=>[x+DIV_OX,z+DIV_OZ] as P2),.05);

  // --- the paver strip under the façade where the cars park nose-in, the yellow bay lines
  const X0=-46,X1=8,edge=(x:number):number=>zIn(x)-HWD;
  {
    const P:P2[]=[];
    for(let x=X0;x<=X1;x+=2)P.push([x,FRONT+.02]);
    for(let x=X1;x>=X0;x-=2)P.push([x,edge(x)+.05]);
    f.add(drape(P,HL,.16,hexMat,{uv:(x,z)=>{const[a,b]=W(x,z);return[a/SEXT_W,b/SEXT_H];}}));
    addSurfacePolygon(P.map(([x,z])=>W(x,z)),.16);
    for(let x=X0+1.3;x<X1;x+=2.6){
      if(x>PORCH[0]-BAYS_OFF&&x<PORCH[1]+BAYS_OFF)continue;
      const z0=FRONT+.4,z1=edge(x)-.5;
      f.add(box(.1,.02,z1-z0,yellowM,x,HL(x,(z0+z1)/2)+.175,(z0+z1)/2,0));
    }
    // the white "E" signs on the wall-side posts
    for(const x of[-40,-20,8]){const s=placa.build({lines:['E'],w:.5,h:.5,bg:'#f4f4f0',fg:'#1f3f8a',postH:1.6});s.rotation.y=0;stand(s,x,FRONT+.35);}
  }

  // --- the inner drive's square side: the yellow-painted kerb, a cement walk, a grey kerb
  const XA=-74,XB=9;                                   // the square, gate island ... west end
  const inK=(x:number):number=>zIn(x)+HWD+.12,outK=(x:number):number=>zOut(x)-HWD-.12;
  const gap=(x:number):number=>outK(x)-inK(x);
  run(XA,XB,inK,.22,.2,yellowM,.06);
  run(-60,XB,x=>inK(x)+.75,1.2,.1,cementM,.06);
  run(-60,XB,x=>inK(x)+1.42,.16,.24,greyKerbM,.04);
  // the outer drive's: a low white kerb, yellow on the gate island
  run(-60,XB,outK,.22,.18,whiteKerbM,.06);
  run(XA,-60,outK,.22,.2,yellowM,.06);

  // --- the paver path across the square from the porch steps
  const PATH=[1.4,3.6];
  {
    const P:P2[]=[[PATH[0],inK(PATH[0])+1.5],[PATH[1],inK(PATH[1])+1.5],[PATH[1],outK(PATH[1])],[PATH[0],outK(PATH[0])]];
    f.add(drape(P,HL,.12,hexMat,{uv:(x,z)=>{const[a,b]=W(x,z);return[a/SEXT_W,b/SEXT_H];}}));
    addSurfacePolygon(P.map(([x,z])=>W(x,z)),.12);
  }
  const onPath=(x0:number,x1:number):boolean=>x1>PATH[0]-.2&&x0<PATH[1]+.2;

  // --- the clipped hedges: a double row along the outer edge, one along the inner, broken
  // by the path
  const hedge=(x0:number,x1:number,z:(x:number)=>number):void=>{
    for(let x=x0;x<x1;x+=1.5){
      if(onPath(x,x+1.5)||gap(x)<3.4)continue;
      const xb=Math.min(x1,x+1.5),za=z(x),zb=z(xb),mx=(x+xb)/2,mz=(za+zb)/2;
      f.add(box(Math.hypot(xb-x,zb-za)+.05,.62,.6,hedgeM,mx,HL(mx,mz)+.31,mz,-Math.atan2(zb-za,xb-x)));
    }
  };
  hedge(-58,XB-1,x=>outK(x)-.75);hedge(-58,XB-1,x=>outK(x)-1.6);
  hedge(-58,XB-1,x=>inK(x)+2.1);

  // --- the thujas: big and dense round the path in front of the porch, a row toward the gate
  const thujas:[number,number,number,number][]=[];        // x, depth 0..1 across the square, h, r
  for(const[x,t,h,r]of[[-9,.62,6.2,2.5],[-4.5,.3,5.6,2.3],[-1,.7,6.4,2.6],[6.2,.35,5.8,2.4],[8.2,.75,5.4,2.2],[-13.5,.45,5,2.1]] as const)thujas.push([x,t,h,r]);
  for(let x=-19,k=0;x>-56;x-=6.4,k++)thujas.push([x,k%2?.38:.62,4.4+rnd()*.9,1.55+rnd()*.3]);
  thujas.forEach(([x,t,h,r],i)=>{
    const z=inK(x)+2.6+(gap(x)-4.2)*t;
    stand(thuja(h,r,i+3),x,z,.6,.6,3);f.children[f.children.length-1].rotation.y=rnd()*6;
  });
  // the tall slender palms: a pair by the path, more along the square
  for(const[x,t,h]of[[4.4,.45,13],[5.6,.62,12],[-24,.5,14],[-41,.4,12.5],[-52,.55,11]] as const){
    const z=inK(x)+2.6+(gap(x)-4.2)*t;
    stand(Palmeira.build({jeriva:true,h,seed:Math.round(-x)}),x,z,.5,.5,4);
  }
  // the double-armed lamps on the square's middle line, arms across the drives
  for(const x of[-7,-30,-50,-71]){
    const z=x<-60?(inK(x)+outK(x))/2:inK(x)+2.6+(gap(x)-4.2)*.5;
    const l=lamp();l.rotation.y=Math.PI/2;stand(l,x,z,.3,.3,8);
  }
  // the gate island's pointed cypress, and its grass
  stand(ArvorePraca.build({kind:'cipreste',r:1.1,h:7.5,seed:12}),-67,(inK(-67)+outK(-67))/2,.5,.5,4);
  // the CONDERG direction sign at the square's gate end, toward the incoming drive
  {
    const s=placa.build({lines:['CONDERG','← Almoxarifado · Estacionamento · Funcionários','Recepção · Estacionamento · Solar das Magnólias ↘'],w:2.4,h:1.4,bg:'#f4f4f0',fg:'#1d4e2f',postH:1.1});
    s.rotation.y=-Math.PI/2;stand(s,-59,outK(-59)-2.4,.3,.3,2.6);
  }
  // the "Pronto Socorro" sign past the east wing, where the drive turns to the emergency door
  {
    const s=placa.build({lines:['CONDERG','✚ Pronto Socorro ↘'],w:1.8,h:.9,bg:'#f4f4f0',fg:'#3a3a3a',postH:1.3});
    stand(s,-50,FRONT+1.2,.3,.3,2.4);
  }

  // --- under the west wing, past the strip: beds of agaves and a palm by the yellow kerb
  for(const[x,palm]of[[14,true],[20,false],[26,true]] as const){
    const z=FRONT+1.4;
    f.add(box(4.2,.06,2.2,bedM,x,HL(x,z)+.03,z,0));
    run(x-2.1,x+2.1,()=>FRONT+2.55,.18,.18,yellowM,0);
    for(const dx of[-1.2,0,1.2])agave(f,x+dx,HL(x+dx,z)+.05,z+(dx?.3:-.2),Math.round(x*7+dx*3));
    if(palm)stand(Palmeira.build({jeriva:true,h:11,seed:x}),x+1.5,z-.4,.5,.5,4);
  }
  mergeChildren(f);
  ctx.place(f);

  // --- the dome of rock on its lawn by the entrance road, edged with loose stone blocks
  {
    const[x,z]=ROCK,y=H(x,z)-.4,r=rock(2.7,3);r.position.set(x,y,z);g.add(r);
    addObb(x+DIV_OX,z+DIV_OZ,5,4.4,0,y+3);
    for(let i=0;i<7;i++){const bx=x-4.5+i*1.1,bz=z+3.4;g.add(box(1,.18,.35,greyKerbM,bx,H(bx,bz)+.07,bz,.08*(i%3)));}
  }
  // --- the little house at the west end: cream walls, an orange hipped roof
  {
    const{x,z,w,d}=HOUSE,th=Math.atan2(.42,.91),y=H(x,z);
    g.add(box(w,2.8,d,wallM,x,y+1.4,z,th));
    const roof=new THREE.Mesh(hipRoof(w+.8,d+.8,1.9),roofM);
    roof.position.set(x,y+2.8,z);roof.rotation.y=th;roof.castShadow=true;g.add(roof);
    // the door on the north wall (local -z), 2 m west of the middle (local -x)
    g.add(box(1,2.1,.08,doorM,x-2*Math.cos(th)-(d/2+.03)*Math.sin(th),y+1.05,z+2*Math.sin(th)-(d/2+.03)*Math.cos(th),th));
    addObb(x+DIV_OX,z+DIV_OZ,w,d,-th,y+3);
  }
  mergeChildren(g);
  ctx.place(g);
  return 1;
}

// The cars parked round the front (world x,z, heading): pure data, placed with the town's
// other parked cars by build.ts (they can be taken: E)
export type ParkedCar={k:'uno'|'kombi'|'hilux';c:number;x:number;z:number;h:number};
export function hospitalParked():ParkedCar[]{
  const rnd=rng(1950);
  const kinds:{k:'uno'|'kombi'|'hilux';c:number}[]=[{k:'uno',c:0xe8e6df},{k:'uno',c:0x5b5f6b},{k:'hilux',c:0xaeb2b5},{k:'uno',c:0x2a2a2c},
    {k:'uno',c:0xc23b4e},{k:'uno',c:0xd9d7d0},{k:'kombi',c:0},{k:'uno',c:0x3b7ac2},{k:'uno',c:0x8a8c90},{k:'hilux',c:0x2a2a2c},
    {k:'uno',c:0xf0efea},{k:'uno',c:0x6b2a2a},{k:'uno',c:0xb8bab8},{k:'uno',c:0x2f3b4a}];
  const spots:{x:number;z:number;h:number}[]=[];
  // nose-in under the façade, either side of the porch (model frame: toward −z)
  for(let x=-46+2.6;x<8;x+=2.6){
    if(x>PORCH[0]-BAYS_OFF-1.3&&x<PORCH[1]+BAYS_OFF+1.3)continue;
    const[tx,tz]=T(x,FRONT+2.5);spots.push({x:tx,z:tz,h:Math.atan2(-S,-C)});
  }
  // in the car park: nose-in along the outer drive's kerb, and a row by the dirt track
  const ROWS:[number,number,number][]=[[-362,-336,3.2],[-326,-306,3.6]];
  for(const[x0,x1,step]of ROWS)
    for(let x=x0;x<x1;x+=step){
      const z=zAt(OUT,x),dz=zAt(OUT,x+1)-z,L1=Math.hypot(1,dz),nx=dz/L1,nz=-1/L1;   // north of the drive
      spots.push({x:x+nx*(HWD+3),z:z+nz*(HWD+3),h:Math.atan2(-nx,-nz)});          // nose toward the drive
    }
  const TRACK:P2[]=[[-367,626],[-358.8,621.1],[-350.4,616],[-341.2,612.2],[-332.1,610],[-320.1,608.1],[-309,606.3],[-300.2,603.3]];
  for(const x of[-352,-344,-337,-322,-316,-304]){const z=zAt(TRACK,x);spots.push({x,z:z+4.6,h:Math.PI*.96});}   // south of the track, facing it
  const out:ParkedCar[]=[];
  spots.forEach((s,i)=>{
    if(rnd()<.3)return;                                   // gaps, as in the photos
    out.push({...kinds[i%kinds.length],x:s.x+DIV_OX,z:s.z+DIV_OZ,h:s.h+(rnd()-.5)*.12});
  });
  return out;
}
