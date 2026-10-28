// The Hospital Regional's front, from the satellite (referencias-satelite/frente-hospital,
// acesso-hospital) and the visitors' photos on Google Maps (referencias-streetview/hp-fotos,
// local — Street View's car never went in past the gatehouse): two one-way drives of
// hexagonal pavers run along the sanatorium's north front (OSM 1215144212 out, 1215144213
// in along the building, joined at the west end by the reception), the little square between
// them — lawn edged with grey stone kerbs under low, wide-crowned trees, a row of small round
// ones toward the gate —, north of the outer drive the red-earth car park full of cars up to
// the dirt track, the great dome of rock on its lawn by the entrance road, the yellow-kerbed
// beds of agaves along the building, and the little orange-roofed house at the west end.
// All in town-local metres (x east, z south; +DIV_OX/OZ for world).
import * as THREE from 'three';
import {matte} from '../../../../assets/models/matte.ts';
import ArvorePraca from '../../../../assets/models/divinolandia/arvore-praca.ts';
import {DIV_OX,DIV_OZ} from '../data.ts';
import {addObb} from '../collide.ts';
import {addSurfacePolygon} from '../../surface-lift.ts';
import type {ExtrasCtx} from './extras.ts';

type P2=[number,number];
// the drives' centre lines (OSM), service roads 2.6 m half-width
const OUT:P2[]=[[-264.2,618.9],[-269.6,621.4],[-273.9,623.1],[-278.7,624.9],[-292.3,629],[-307.3,632],[-317.2,633.9],[-325.6,636.3],[-333.1,639],[-343.7,643.7],[-359.6,653.5],[-365.7,657.6],[-367.1,660]];
const IN:P2[]=[[-367.1,660],[-364.7,664.4],[-362.7,666.3],[-359.7,667.1],[-356.4,667.3],[-351.6,665.1],[-342.5,661.1],[-299.9,642.1],[-278.4,629.7],[-274.7,627.6],[-271.9,625.2],[-264.2,618.9]];
const HWD=2.6;
// the red-earth car park: from the outer drive's kerb up past the dirt track
const PARK:P2[]=[[-373,627],[-367,619],[-358.8,614],[-350.4,609],[-341.2,605],[-332.1,603],[-320.1,601],[-309,599.3],[-300.2,596.3],[-292,593],
  [-292,625.6],[-307,628.9],[-317,630.9],[-325.6,633.3],[-333,636],[-343.7,640.8],[-359.6,650.6],[-366,654.6],[-373,650]];
const ROCK:P2=[-283.5,620.5];
const HOUSE={x:-384,z:647,w:14,d:8};

const dirtM=matte({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const kerbM=matte({color:0x9c9a94}),yellowM=matte({color:0xe0b52a}),rockM=matte({color:0x5a4c40,flatShading:true});
const agaveM=matte({color:0x7f9a86}),bedM=matte({color:0x8a5a3e});
const wallM=matte({color:0xeadfbe}),roofM=matte({color:0xc0613c}),doorM=matte({color:0x6a4a34});

function rng(seed:number):()=>number{let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// z of a polyline at x (the first segment spanning it)
function zAt(P:P2[],x:number):number{
  for(let i=1;i<P.length;i++){const[ax,az]=P[i-1],[bx,bz]=P[i];if((x-ax)*(x-bx)<=0&&ax!==bx)return az+(bz-az)*(x-ax)/(bx-ax);}
  return NaN;
}
// a point along the polyline at arc length s, with its unit direction
function along(P:P2[],s:number):{x:number;z:number;ux:number;uz:number}{
  for(let i=1;i<P.length;i++){
    const[ax,az]=P[i-1],[bx,bz]=P[i],L=Math.hypot(bx-ax,bz-az);
    if(s<=L||i===P.length-1){const t=Math.min(1,s/L);return{x:ax+(bx-ax)*t,z:az+(bz-az)*t,ux:(bx-ax)/L,uz:(bz-az)/L};}
    s-=L;
  }
  return{x:P[0][0],z:P[0][1],ux:1,uz:0};
}
const len=(P:P2[]):number=>{let L=0;for(let i=1;i<P.length;i++)L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);return L;};
function box(w:number,h:number,d:number,m:THREE.Material,x:number,y:number,z:number,ry:number):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);b.rotation.y=ry;b.castShadow=true;b.receiveShadow=true;return b;
}

// a flat polygon draped on the ground: triangulated, then split until no edge passes 2.5 m
function drape(poly:P2[],H:(x:number,z:number)=>number,lift:number,m:THREE.Material,col?:number):THREE.Mesh{
  const tris=THREE.ShapeUtils.triangulateShape(poly.map(([x,z])=>new THREE.Vector2(x,z)),[]);
  const pos:number[]=[];
  const put=(a:P2,b:P2,c:P2):void=>{
    const ab=Math.hypot(a[0]-b[0],a[1]-b[1]),bc=Math.hypot(b[0]-c[0],b[1]-c[1]),ca=Math.hypot(c[0]-a[0],c[1]-a[1]);
    if(Math.max(ab,bc,ca)>2.5){
      const m=(p:P2,q:P2):P2=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
      if(ab>=bc&&ab>=ca){const n=m(a,b);put(a,n,c);put(n,b,c);}
      else if(bc>=ca){const n=m(b,c);put(a,b,n);put(a,n,c);}
      else{const n=m(c,a);put(a,b,n);put(n,b,c);}
      return;
    }
    for(const p of[a,c,b])pos.push(p[0],H(p[0],p[1])+lift,p[1]);   // wound up (x east, z south)
  };
  for(const[i,j,k]of tris)put(poly[i],poly[j],poly[k]);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  if(col){                                     // mottled: each spot of ground its own shade
    const c:number[]=[],base=new THREE.Color(col),k=new THREE.Color();
    for(let i=0;i<pos.length;i+=3){
      const x=pos[i],z=pos[i+2],n=Math.sin(x*.71+z*.33)*Math.sin(z*.53-x*.21)*.5+Math.sin(x*2.3+z*1.9)*.25;
      k.copy(base).multiplyScalar(.86+n*.3);c.push(k.r,k.g,k.b);
    }
    g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));
  }
  const mesh=new THREE.Mesh(g,m);mesh.receiveShadow=true;return mesh;
}

// the dome of dark weathered rock: a flattened, lumpy hemisphere
function rock(r:number,seed:number):THREE.Mesh{
  const geo=new THREE.SphereGeometry(r,14,9,0,Math.PI*2,0,Math.PI/2),p=geo.getAttribute('position'),rnd=rng(seed);
  for(let i=0;i<p.count;i++){const k=.92+rnd()*.12;p.setXYZ(i,p.getX(i)*k,p.getY(i)*1.05*k,p.getZ(i)*k*.85);}
  geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,rockM);m.castShadow=true;m.receiveShadow=true;return m;
}
// a hipped roof W × D (eaves included) rising `h` to a ridge along x; origin at the eaves' middle
function hipRoof(W:number,D:number,h:number):THREE.BufferGeometry{
  const a=W/2,b=D/2,r=Math.max(0,a-b);
  const e=[[-a,0,-b],[a,0,-b],[a,0,b],[-a,0,b]],R0=[-r,h,0],R1=[r,h,0];
  const t=[e[3],e[2],R1,e[3],R1,R0, e[1],e[0],R0,e[1],R0,R1, e[0],e[3],R0, e[2],e[1],R1];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(t.flat(),3));g.computeVertexNormals();
  return g;
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
  const H=(x:number,z:number):number=>ctx.H(x+DIV_OX,z+DIV_OZ);
  const g=new THREE.Group();g.position.set(DIV_OX,0,DIV_OZ);   // children in town-local x,z
  const rnd=rng(1945);

  // --- the red-earth car park
  g.add(drape(PARK,H,.05,dirtM,0x9a5a3e));
  addSurfacePolygon(PARK.map(([x,z])=>[x+DIV_OX,z+DIV_OZ] as P2),.05);

  // --- the square between the drives: grey stone kerbs along both drives, low wide trees
  // over the lawn at the west end, a row of small round ones toward the gate
  const SIDES:[P2[],number][]=[[OUT,1],[IN,-1]];
  for(const[P,sg]of SIDES){
    const L=len(P);
    for(let s=0;s<L-1;s+=1.5){
      const a=along(P,s),nx=-a.uz*sg,nz=a.ux*sg;   // the square's side of the drive
      const x=a.x+nx*(HWD+.12),z=a.z+nz*(HWD+.12);
      if(x>-290||x<-362)continue;
      g.add(box(1.5,.22,.24,kerbM,x,H(x,z)+.12,z,Math.atan2(-a.uz,a.ux)));
    }
  }
  for(let x=-356,k=0;x<-292;x+=(x < -322)?8.5:6,k++){
    const zo=zAt(OUT,x),zi=zAt(IN,x),gap=zi-zo-2*HWD;
    if(!(gap>3.5))continue;
    const big=x<-322,z=(zo+zi)/2+(rnd()-.5)*Math.max(0,gap-(big?7:4));
    const t=ArvorePraca.build(big?{kind:'copa',r:3.6+rnd()*1.4,h:4.8+rnd()*1.2,seed:k+7}:{kind:'copa',r:1.7+rnd()*.5,h:3.4,seed:k+40});
    t.position.set(x,H(x,z),z);t.rotation.y=rnd()*6;g.add(t);addObb(x+DIV_OX,z+DIV_OZ,.6,.6,0,H(x,z)+3);
  }

  // --- along the building: the yellow-painted kerb and the beds of agaves
  {
    const L=len(IN);
    for(let s=0;s<L;s+=1.5){
      const a=along(IN,s),nx=a.uz,nz=-a.ux;           // the building's side (left of the inbound run)
      const x=a.x+nx*(HWD+.12),z=a.z+nz*(HWD+.12);
      if(x>-300||x<-345)continue;
      g.add(box(1.5,.2,.22,yellowM,x,H(x,z)+.11,z,Math.atan2(-a.uz,a.ux)));
      if(Math.round(s/1.5)%5===0){
        const bx=a.x+nx*(HWD+1.3),bz=a.z+nz*(HWD+1.3),y=H(bx,bz);
        g.add(box(2,.06,1.6,bedM,bx,y+.03,bz,Math.atan2(-a.uz,a.ux)));
        agave(g,bx,y+.05,bz,Math.round(s));
      }
    }
  }

  // --- the dome of rock on its lawn by the entrance road, edged with loose stone blocks
  {
    const[x,z]=ROCK,y=H(x,z)-.4,r=rock(2.7,3);r.position.set(x,y,z);g.add(r);
    addObb(x+DIV_OX,z+DIV_OZ,5,4.4,0,y+3);
    for(let i=0;i<7;i++){const bx=x-4.5+i*1.1,bz=z+3.4;g.add(box(1,.18,.35,kerbM,bx,H(bx,bz)+.07,bz,.08*(i%3)));}
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
  ctx.place(g);
  return 1;
}

// The cars parked in the car park (world x,z, heading): pure data, placed with the town's
// other parked cars by build.ts (they can be taken: E)
export type ParkedCar={k:'uno'|'kombi'|'hilux';c:number;x:number;z:number;h:number};
export function hospitalParked():ParkedCar[]{
  const rnd=rng(1950);

  // nose-in along the outer drive's kerb, and a row by the dirt track
  const kinds:{k:'uno'|'kombi'|'hilux';c:number}[]=[{k:'uno',c:0xe8e6df},{k:'uno',c:0x5b5f6b},{k:'hilux',c:0xaeb2b5},{k:'uno',c:0x2a2a2c},
    {k:'uno',c:0xc23b4e},{k:'uno',c:0xd9d7d0},{k:'kombi',c:0},{k:'uno',c:0x3b7ac2},{k:'uno',c:0x8a8c90},{k:'hilux',c:0x2a2a2c},
    {k:'uno',c:0xf0efea},{k:'uno',c:0x6b2a2a},{k:'uno',c:0xb8bab8},{k:'uno',c:0x2f3b4a}];
  const spots:{x:number;z:number;h:number}[]=[];
  const ROWS:[number,number,number][]=[[-362,-336,3.2],[-326,-306,3.6]];
  for(const[x0,x1,step]of ROWS)
    for(let x=x0;x<x1;x+=step){
      const z=zAt(OUT,x),dz=zAt(OUT,x+1)-z,L=Math.hypot(1,dz),nx=dz/L,nz=-1/L;   // north of the drive
      spots.push({x:x+nx*(HWD+3),z:z+nz*(HWD+3),h:Math.atan2(-nx,-nz)});        // nose toward the drive
    }
  const TRACK:P2[]=[[-367,626],[-358.8,621.1],[-350.4,616],[-341.2,612.2],[-332.1,610],[-320.1,608.1],[-309,606.3],[-300.2,603.3]];
  for(const x of[-352,-344,-337,-322,-316,-304]){const z=zAt(TRACK,x);spots.push({x,z:z+4.6,h:Math.PI*.96});}   // south of the track, facing it
  const out:ParkedCar[]=[];
  spots.forEach((s,i)=>{
    if(rnd()<.3)return;                                   // gaps, as in the photos
    out.push({...kinds[i%kinds.length],x:s.x+DIV_OX,z:s.z+DIV_OZ,h:s.h+(rnd()-.5)*.25});
  });
  return out;
}
