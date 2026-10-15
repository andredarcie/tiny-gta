import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO,AWNINGS} from '@/core/palette.ts';

// Casa de Divinolândia — the interior-paulista town house: a limewashed masonry box
// set right at the sidewalk, a clay-tile hip roof (or a flat slab hidden behind a
// "platibanda" parapet on the two-storey ones), a wooden door, steel-framed windows,
// and in the centre the ground floor opens as a shop (steel roll-up door + a coloured
// awning band). On a slope the house keeps its door at street level and the wall
// simply runs down to the ground on the low side, as the real ones do.
//
// The town has thousands of them, so they are NOT separate objects: addCasa() writes
// world-space triangles with per-vertex colour into per-chunk buckets (one material
// per role), and finalizeCasas() merges each chunk into a handful of meshes.
export const wallMat=matte({vertexColors:true});
export const roofMat=matte({vertexColors:true,flatShading:true});
export const trimMat=matte({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});

type Buf={p:number[];n:number[];c:number[]};
type Bucket={wall:Buf;roof:Buf;trim:Buf};
const newBuf=():Buf=>({p:[],n:[],c:[]});
const CHUNK=200;
const chunks=new Map<string,Bucket>();
const col=new THREE.Color();
const FAC=DIVINO.facades.map(h=>new THREE.Color(h)),TILE=DIVINO.roofTiles.map(h=>new THREE.Color(h));
const SLAB=new THREE.Color(DIVINO.slab),FRAME=new THREE.Color(DIVINO.frame),SHUT=new THREE.Color(DIVINO.shutter);
const GLASS=new THREE.Color('#3b4650'),WOOD=new THREE.Color('#6a4630'),SILL=new THREE.Color('#e9e4d8');
const AWN=AWNINGS.map(h=>new THREE.Color(h));

// Local frame of one house: x along the street (width w), z out of the façade (+z faces
// the street), y up from the floor. T() maps local → world for yaw `rot`.
type Frame={x:number;y:number;z:number;c:number;s:number};
const T=(f:Frame,lx:number,ly:number,lz:number):[number,number,number]=>[f.x+lx*f.c-lz*f.s,f.y+ly,f.z+lx*f.s+lz*f.c];
const TN=(f:Frame,nx:number,ny:number,nz:number):[number,number,number]=>[nx*f.c-nz*f.s,ny,nx*f.s+nz*f.c];

function tri(b:Buf,a:number[],bb:number[],c:number[],n:number[],cl:THREE.Color):void{
  // orient so the winding agrees with the intended normal
  const ux=bb[0]-a[0],uy=bb[1]-a[1],uz=bb[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const cx=uy*vz-uz*vy,cy=uz*vx-ux*vz,cz=ux*vy-uy*vx;
  const flip=cx*n[0]+cy*n[1]+cz*n[2]<0;
  for(const v of flip?[a,c,bb]:[a,bb,c]){b.p.push(v[0],v[1],v[2]);b.n.push(n[0],n[1],n[2]);b.c.push(cl.r,cl.g,cl.b);}
}
function quad(b:Buf,f:Frame,q:[number,number,number][],n:[number,number,number],cl:THREE.Color):void{
  const w=q.map(v=>T(f,v[0],v[1],v[2])),wn=TN(f,n[0],n[1],n[2]);
  tri(b,w[0],w[1],w[2],wn,cl);tri(b,w[0],w[2],w[3],wn,cl);
}
// axis box in the local frame (no bottom face)
function box(b:Buf,f:Frame,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,cl:THREE.Color,top:THREE.Color=cl):void{
  quad(b,f,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],[0,0,1],cl);
  quad(b,f,[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]],[0,0,-1],cl);
  quad(b,f,[[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0]],[1,0,0],cl);
  quad(b,f,[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]],[-1,0,0],cl);
  quad(b,f,[[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],[0,1,0],top);
}
// hip roof over [-hw,hw]×[-hd,hd] at height y, ridge height rh
function hipRoof(b:Buf,f:Frame,hw:number,hd:number,y:number,rh:number,cl:THREE.Color):void{
  const along=hw>=hd,r=Math.abs(hw-hd);
  const P=(lx:number,ly:number,lz:number):number[]=>T(f,lx,ly,lz);
  const c0=P(-hw,y,-hd),c1=P(hw,y,-hd),c2=P(hw,y,hd),c3=P(-hw,y,hd);
  const r0=along?P(-r,y+rh,0):P(0,y+rh,-r),r1=along?P(r,y+rh,0):P(0,y+rh,r);
  const face=(a:number[],bb:number[],c:number[],shade:number):void=>{
    const ux=bb[0]-a[0],uy=bb[1]-a[1],uz=bb[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;
    nx/=l;ny/=l;nz/=l;if(ny<0){nx=-nx;ny=-ny;nz=-nz;}
    col.copy(cl).multiplyScalar(shade);tri(b,a,bb,c,[nx,ny,nz],col);
  };
  if(along){
    face(c3,c2,r1,1);face(c3,r1,r0,1);          // front slope
    face(c1,c0,r0,.96);face(c1,r0,r1,.96);      // back slope
    face(c0,c3,r0,.92);face(c2,c1,r1,.92);      // hip ends
  }else{
    face(c0,c3,r0,1);face(c3,r1,r0,1);
    face(c2,c1,r1,.96);face(c1,r0,r1,.96);
    face(c3,c2,r1,.92);face(c1,c0,r0,.92);
  }
}

export type CasaSpec={x:number;z:number;w:number;d:number;rot:number;floor:number;base:number;floors:number;color:number;flat:boolean;shop:number;seed:number};
const FLOOR_H=3.1;
// Height of the top of a house above its floor (for collision / line of sight).
export const casaTop=(s:{floors:number;flat:boolean;w:number;d:number}):number=>s.floors*FLOOR_H+(s.flat?.9:Math.min(s.w,s.d)*.3+.2);

function writeCasa(bk:Bucket,s:CasaSpec):void{
  const f:Frame={x:s.x,y:s.floor,z:s.z,c:Math.cos(s.rot),s:Math.sin(s.rot)};
  const hw=s.w/2,hd=s.d/2,H=s.floors*FLOOR_H,wall=FAC[s.color%FAC.length];
  const rnd=(k:number):number=>{const v=Math.sin(s.seed*12.9898+k*78.233)*43758.5453;return v-Math.floor(v);};
  // masonry box from the ground (base, may be below the floor on the low side) to the eaves/parapet
  box(bk.wall,f,-hw,hw,s.base-s.floor,H+(s.flat?.9:0),-hd,hd,wall,s.flat?SLAB:wall);
  if(s.flat){box(bk.wall,f,-hw+.25,hw-.25,H+.05,H+.12,-hd+.25,hd-.25,SLAB);}
  else hipRoof(bk.roof,f,hw+.45,hd+.45,H,Math.min(s.w,s.d)*.3,TILE[Math.floor(rnd(1)*TILE.length)]);
  const fz=hd+.02;
  // ground floor
  if(s.shop){
    const sw=Math.min(s.w-1.6,3.6),sx=(rnd(2)-.5)*(s.w-sw-1.4);
    quad(bk.trim,f,[[sx-sw/2,0,fz],[sx+sw/2,0,fz],[sx+sw/2,2.7,fz],[sx-sw/2,2.7,fz]],[0,0,1],SHUT);
    box(bk.trim,f,-hw+.1,hw-.1,2.85,3.05,hd,hd+.9,AWN[(s.shop-1)%AWN.length]);   // awning / sign band
  }else{
    const dx=(rnd(3)<.5?-1:1)*(hw-1.4);
    quad(bk.trim,f,[[dx-.5,0,fz],[dx+.5,0,fz],[dx+.5,2.15,fz],[dx-.5,2.15,fz]],[0,0,1],WOOD);
    const nWin=s.w>8.5?2:1;
    for(let k=0;k<nWin;k++){
      const wx=-dx*(nWin===1?.55:(k?.2:.75));
      quad(bk.trim,f,[[wx-.65,1,fz],[wx+.65,1,fz],[wx+.65,2.2,fz],[wx-.65,2.2,fz]],[0,0,1],GLASS);
      quad(bk.trim,f,[[wx-.75,.9,fz+.01],[wx+.75,.9,fz+.01],[wx+.75,1,fz+.01],[wx-.75,1,fz+.01]],[0,0,1],SILL);
    }
  }
  // upper floors: a row of windows (2–3) on the façade
  for(let fl=1;fl<s.floors;fl++){
    const y0=fl*FLOOR_H+.9,n=s.w>8?3:2;
    for(let k=0;k<n;k++){
      const wx=-hw+(k+.5)*s.w/n;
      quad(bk.trim,f,[[wx-.6,y0,fz],[wx+.6,y0,fz],[wx+.6,y0+1.3,fz],[wx-.6,y0+1.3,fz]],[0,0,1],GLASS);
    }
  }
  // side windows (on the side that may face a gap between houses)
  quad(bk.trim,f,[[hw+.02,1,-.6],[hw+.02,1,.6],[hw+.02,2.1,.6],[hw+.02,2.1,-.6]].map(v=>[v[0],v[1],v[2]] as [number,number,number]),[1,0,0],FRAME);
}

export function addCasa(s:CasaSpec):void{
  const key=Math.round(s.x/CHUNK)+'_'+Math.round(s.z/CHUNK);
  let bk=chunks.get(key);
  if(!bk){bk={wall:newBuf(),roof:newBuf(),trim:newBuf()};chunks.set(key,bk);}
  writeCasa(bk,s);
}
const toMesh=(b:Buf,m:THREE.Material,cast:boolean):THREE.Mesh|null=>{
  if(!b.p.length)return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));
  g.computeBoundingSphere();
  const mesh=new THREE.Mesh(g,m);mesh.castShadow=cast;mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;
  return mesh;
};
// Merge every chunk; returns one Group per chunk (centre in userData.cx/cz for culling).
export function finalizeCasas():THREE.Group[]{
  const out:THREE.Group[]=[];
  for(const[key,bk]of chunks){
    const g=new THREE.Group();
    for(const m of[toMesh(bk.wall,wallMat,true),toMesh(bk.roof,roofMat,true),toMesh(bk.trim,trimMat,false)])if(m)g.add(m);
    const[i,j]=key.split('_').map(Number);g.userData.cx=i*CHUNK;g.userData.cz=j*CHUNK;
    g.matrixAutoUpdate=false;out.push(g);
  }
  chunks.clear();
  return out;
}

// Model-viewer sample: a short street front — houses, a two-storey shop, a slope.
function build():THREE.Group{
  const specs:CasaSpec[]=[
    {x:-12,z:0,w:8,d:12,rot:0,floor:0,base:-.3,floors:1,color:0,flat:false,shop:0,seed:1},
    {x:-3.5,z:0,w:8.5,d:12,rot:0,floor:.4,base:-.3,floors:2,color:3,flat:true,shop:2,seed:2},
    {x:5.5,z:0,w:9,d:12,rot:0,floor:.9,base:-.3,floors:1,color:6,flat:false,shop:0,seed:3},
    {x:14.5,z:0,w:8,d:12,rot:0,floor:1.4,base:-.3,floors:2,color:9,flat:false,shop:0,seed:4},
  ];
  const bk:Bucket={wall:newBuf(),roof:newBuf(),trim:newBuf()};
  for(const s of specs)writeCasa(bk,s);
  const g=new THREE.Group();
  for(const m of[toMesh(bk.wall,wallMat,true),toMesh(bk.roof,roofMat,true),toMesh(bk.trim,trimMat,false)])if(m){m.matrixAutoUpdate=true;g.add(m);}
  return g;
}
export default {category:'Divinolândia',label:'Casas (rua típica)',build};
