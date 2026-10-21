import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO,AWNINGS} from '@/core/palette.ts';
import {rebocoTexture,telhaTexture} from './texturas.ts';

// Casa de Divinolândia — the interior-paulista town house: a limewashed masonry box
// set right at the sidewalk, a clay-tile hip roof (or a flat slab hidden behind a
// "platibanda" parapet on the two-storey ones), a wooden door, steel-framed windows,
// and in the centre the ground floor opens as a shop (steel roll-up door + a coloured
// awning band). On a slope the wall simply runs down to the ground on the low side, as
// the real ones do, and where the floor stands above the sidewalk a short concrete flight
// climbs to the door (and to the shop's roll-up door).
//
// The town has thousands of them, so they are NOT separate objects: addCasa() writes
// world-space triangles with per-vertex colour into per-chunk buckets (one material
// per role), and finalizeCasas() merges each chunk into a handful of meshes.
export const wallMat=matte({vertexColors:true,map:rebocoTexture()});
export const roofMat=matte({vertexColors:true,flatShading:true,map:telhaTexture()});
export const trimMat=matte({vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});

type Buf={p:number[];n:number[];c:number[];uv:number[]};
type Bucket={wall:Buf;roof:Buf;trim:Buf};
const newBuf=():Buf=>({p:[],n:[],c:[],uv:[]});
const CHUNK=200;
const chunks=new Map<string,Bucket>();
const col=new THREE.Color();
const FAC=DIVINO.facades.map(h=>new THREE.Color(h)),TILE=DIVINO.roofTiles.map(h=>new THREE.Color(h));
const SLAB=new THREE.Color(DIVINO.slab),FRAME=new THREE.Color(DIVINO.frame),SHUT=new THREE.Color(DIVINO.shutter);
const GLASS=new THREE.Color('#395367'),GLASS_LIGHT=new THREE.Color('#728d9c');
const WOOD=new THREE.Color('#6a4630'),SILL=new THREE.Color('#e9e4d8');
const METAL=new THREE.Color('#64737a'),RIB=new THREE.Color('#879096'),TILE_EDGE=new THREE.Color('#713a2a');
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
  for(const v of flip?[a,c,bb]:[a,bb,c]){
    b.p.push(v[0],v[1],v[2]);b.n.push(n[0],n[1],n[2]);b.c.push(cl.r,cl.g,cl.b);
    const roof=n[1]>.15,tile=roof?1:3;
    b.uv.push((roof?v[0]:-n[2]*v[0]+n[0]*v[2])/tile,(roof?v[2]:v[1])/tile);
  }
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

// step: how far the floor stands above the ground in front of the façade (0 = level);
// eave: how far the tiled roof overhangs the left (−x) and right (+x) walls — less than
// the usual EAVE where a neighbour stands close, so the two roofs never cut into each other
export type CasaSpec={x:number;z:number;w:number;d:number;rot:number;floor:number;base:number;floors:number;color:number;flat:boolean;shop:number;seed:number;step?:number;eave?:[number,number]};
export const EAVE=.45;
const FLOOR_H=3.1;
// Height of the top of a house above its floor (for collision / line of sight).
export const casaTop=(s:{floors:number;flat:boolean;w:number;d:number}):number=>s.floors*FLOOR_H+(s.flat?.9:Math.min(s.w,s.d)*.3+.2);

type CasaContext={bucket:Bucket;frame:Frame;spec:CasaSpec;halfWidth:number;halfDepth:number;wall:THREE.Color;random:(step:number)=>number};
type FrontPanel={x0:number;x1:number;y0:number;y1:number;color:THREE.Color;depth?:number};
type Opening={x:number;y:number;width:number;height:number;style?:number};
type GarageOpening={x:number;width:number;height:number};

function frontPanel(context:CasaContext,panel:FrontPanel):void{
  const z=context.halfDepth+.025+(panel.depth??0);
  quad(context.bucket.trim,context.frame,[[panel.x0,panel.y0,z],[panel.x1,panel.y0,z],[panel.x1,panel.y1,z],[panel.x0,panel.y1,z]],[0,0,1],panel.color);
}

function drawWindow(context:CasaContext,opening:Opening):void{
  const {x,y,width,height,style=0}=opening;
  const left=x-width/2,right=x+width/2,top=y+height;
  const sash=style===1?SILL:METAL;
  frontPanel(context,{x0:left-.09,x1:right+.09,y0:y-.08,y1:top+.09,color:FRAME});
  frontPanel(context,{x0:left,x1:right,y0:y,y1:top,color:GLASS,depth:.012});
  frontPanel(context,{x0:left+.04,x1:right-.04,y0:y+height*.55,y1:top-.04,color:GLASS_LIGHT,depth:.015});
  for(const edge of [left,right])frontPanel(context,{x0:edge-.045,x1:edge+.045,y0:y-.04,y1:top+.05,color:sash,depth:.025});
  for(const edge of [y,top])frontPanel(context,{x0:left-.045,x1:right+.045,y0:edge-.045,y1:edge+.045,color:sash,depth:.025});
  frontPanel(context,{x0:x-.025,x1:x+.025,y0:y,y1:top,color:sash,depth:.03});
  frontPanel(context,{x0:left-.14,x1:right+.14,y0:y-.15,y1:y-.06,color:SILL,depth:.045});
  if(style===2){
    for(let i=1;i<=3;i++){
      const bar=left+i*width/4;
      frontPanel(context,{x0:bar-.018,x1:bar+.018,y0:y,y1:top,color:FRAME,depth:.04});
    }
    frontPanel(context,{x0:left,x1:right,y0:y+height*.5-.018,y1:y+height*.5+.018,color:FRAME,depth:.04});
  }
}

function drawDoor(context:CasaContext,x:number):void{
  const width=1.08,height=2.22,left=x-width/2,right=x+width/2;
  const painted=context.random(14)<.35,door=painted?METAL:WOOD;
  frontPanel(context,{x0:left-.1,x1:right+.1,y0:0,y1:height+.12,color:FRAME});
  frontPanel(context,{x0:left,x1:right,y0:.035,y1:height,color:door,depth:.012});
  frontPanel(context,{x0:left+.12,x1:right-.12,y0:.23,y1:1.06,color:painted?RIB:FRAME,depth:.018});
  frontPanel(context,{x0:left+.12,x1:right-.12,y0:1.23,y1:height-.16,color:painted?RIB:FRAME,depth:.018});
  frontPanel(context,{x0:left+.19,x1:right-.19,y0:1.3,y1:height-.23,color:painted?METAL:WOOD,depth:.022});
  const knob=x+(context.random(15)<.5?-.32:.32);
  frontPanel(context,{x0:knob-.04,x1:knob+.04,y0:1.02,y1:1.08,color:SILL,depth:.03});
  frontPanel(context,{x0:left-.17,x1:right+.17,y0:-.03,y1:.035,color:SLAB,depth:.05});
}

function drawGarage(context:CasaContext,opening:GarageOpening):void{
  const {x,width,height}=opening,left=x-width/2,right=x+width/2;
  const shutter=context.random(16)<.45?SHUT:METAL;
  frontPanel(context,{x0:left-.12,x1:right+.12,y0:-.02,y1:height+.14,color:FRAME});
  frontPanel(context,{x0:left,x1:right,y0:.04,y1:height,color:shutter,depth:.012});
  for(let i=1;i<9;i++){
    const y=i*height/9;
    frontPanel(context,{x0:left+.05,x1:right-.05,y0:y-.022,y1:y+.01,color:i%2?FRAME:RIB,depth:.02});
  }
  for(const edge of [left,right])frontPanel(context,{x0:edge-.045,x1:edge+.045,y0:.04,y1:height,color:RIB,depth:.025});
  frontPanel(context,{x0:x-.28,x1:x+.28,y0:height-.25,y1:height-.21,color:FRAME,depth:.025});
}

function drawBalcony(context:CasaContext,x:number,y:number):void{
  const width=2.25,front=context.halfDepth+.76;
  box(context.bucket.trim,context.frame,x-width/2,x+width/2,y-.14,y+.03,context.halfDepth,front,SLAB,SILL);
  frontPanel(context,{x0:x-width/2,x1:x+width/2,y0:y+.04,y1:y+.31,color:SLAB,depth:.75});
  frontPanel(context,{x0:x-width/2,x1:x+width/2,y0:y+.98,y1:y+1.04,color:FRAME,depth:.75});
  for(let i=0;i<=5;i++){
    const bar=x-width/2+i*width/5;
    frontPanel(context,{x0:bar-.025,x1:bar+.025,y0:y+.3,y1:y+1.01,color:FRAME,depth:.75});
  }
}

// concrete flight from the sidewalk up to an opening at x (width w); the top tread is the
// threshold, the others step down and out toward the street
const RISE=.18,TREAD=.3;
function drawSteps(context:CasaContext,x:number,w:number):void{
  const {spec,halfDepth:hd}=context,h=spec.step??0;
  if(h<.3)return;                                        // a plain threshold
  const n=Math.ceil(h/RISE),r=h/n,x0=x-w/2-.1,x1=x+w/2+.1,low=spec.base-spec.floor;
  for(let k=0;k<n;k++)box(context.bucket.wall,context.frame,x0,x1,low,-k*r+.02,hd+k*TREAD,hd+(k+1)*TREAD,SILL.clone().multiplyScalar(.92),SLAB);
}

function drawFront(context:CasaContext):void{
  const {spec,halfWidth:hw,wall,random}=context;
  frontPanel(context,{x0:-hw,x1:hw,y0:spec.base-spec.floor,y1:.43,color:wall.clone().multiplyScalar(.68)});
  if(spec.floors>1){
    for(let floor=1;floor<spec.floors;floor++){
      const y=floor*FLOOR_H;
      frontPanel(context,{x0:-hw,x1:hw,y0:y-.095,y1:y+.015,color:wall.clone().multiplyScalar(.83),depth:.01});
    }
  }
  if(spec.shop){
    const width=Math.min(spec.w-1.7,3.75),x=(random(2)-.5)*(spec.w-width-1.3);
    drawGarage(context,{x,width,height:2.56});drawSteps(context,x,width);
    const sign=AWN[(spec.shop-1)%AWN.length];
    frontPanel(context,{x0:-hw+.08,x1:hw-.08,y0:2.74,y1:3.04,color:sign,depth:.02});
    box(context.bucket.trim,context.frame,-hw+.1,hw-.1,2.69,2.76,context.halfDepth,context.halfDepth+.55,sign);
    if(spec.w>7.8){const dx=x>0?-hw+.8:hw-.8;drawDoor(context,dx);drawSteps(context,dx,1.08);}
  }else{
    const doorRight=random(3)>.5,doorX=(doorRight?1:-1)*(hw-.82);
    // (no car climbs a flight of steps: a raised house gets windows instead of a garage)
    const garage=spec.w>7.3&&random(5)<.52&&(spec.step??0)<.45;
    if(garage){
      const width=Math.min(3.25,spec.w*.4),x=(doorRight?-1:1)*(hw-width/2-.28);
      drawGarage(context,{x,width,height:2.48});
    }else{
      const count=spec.w>8.8?2:1;
      for(let i=0;i<count;i++){
        const x=-doorX*(count===1?.62:i===0?.78:.32);
        drawWindow(context,{x,y:.95,width:1.24,height:1.28,style:Math.floor(random(6+i)*3)});
      }
    }
    drawDoor(context,doorX);drawSteps(context,doorX,1.08);
  }
  for(let floor=1;floor<spec.floors;floor++){
    const count=spec.w>8?3:2;
    const balcony=spec.flat&&floor===1&&random(34)<.24;
    for(let i=0;i<count;i++){
      const x=-hw+(i+.5)*spec.w/count;
      const door=balcony&&i===0;
      drawWindow(context,{x,y:floor*FLOOR_H+(door?.12:.92),width:1.22,height:door?2.2:1.33,style:Math.floor(random(20+floor*3+i)*3)});
    }
    if(balcony){
      const x=-hw+spec.w/(count*2);
      drawBalcony(context,x,floor*FLOOR_H);
    }
  }
}

function writeCasa(bk:Bucket,s:CasaSpec):void{
  const f:Frame={x:s.x,y:s.floor,z:s.z,c:Math.cos(s.rot),s:Math.sin(s.rot)};
  const hw=s.w/2,hd=s.d/2,H=s.floors*FLOOR_H,wall=FAC[s.color%FAC.length];
  const rnd=(k:number):number=>{const v=Math.sin(s.seed*12.9898+k*78.233)*43758.5453;return v-Math.floor(v);};
  // masonry box from the ground (base, may be below the floor on the low side) to the eaves/parapet
  box(bk.wall,f,-hw,hw,s.base-s.floor,H+(s.flat?.9:0),-hd,hd,wall,s.flat?SLAB:wall);
  if(s.flat){
    box(bk.wall,f,-hw+.25,hw-.25,H+.05,H+.12,-hd+.25,hd-.25,SLAB);
    box(bk.trim,f,-hw,hw,H+.77,H+.85,hd,hd+.12,SILL);
  }else{
    const[eL,eR]=s.eave??[EAVE,EAVE],off=(eR-eL)/2;
    const rf:Frame={...f,x:f.x+off*f.c,z:f.z+off*f.s};      // the roof's own centre along x
    hipRoof(bk.roof,rf,hw+(eL+eR)/2,hd+EAVE,H,Math.min(s.w,s.d)*.3,TILE[Math.floor(rnd(1)*TILE.length)].clone().lerp(SILL,.27));
    box(bk.trim,f,-hw-eL,hw+eR,H-.13,H+.04,hd+.36,hd+.48,TILE_EDGE);
  }
  drawFront({bucket:bk,frame:f,spec:s,halfWidth:hw,halfDepth:hd,wall,random:rnd});
  quad(bk.trim,f,[[hw+.022,.95,-.66],[hw+.022,.95,.66],[hw+.022,2.2,.66],[hw+.022,2.2,-.66]],[1,0,0],FRAME);
  quad(bk.trim,f,[[hw+.03,1.03,-.58],[hw+.03,1.03,.58],[hw+.03,2.12,.58],[hw+.03,2.12,-.58]],[1,0,0],GLASS_LIGHT);
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
  g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));
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
