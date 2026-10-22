import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';
import {settTexture,asfaltoTexture,terraTexture,calcadaTexture,SETT_TILE_M} from './texturas.ts';
import {drapePolys,type DrapeGrid} from './terreno.ts';

// Divinolândia streets — the real OpenStreetMap street network as ribbons draped on
// the terrain: asphalt in town, terra-roxa dirt on the unpaved/rural roads, granite setts
// round the old centre, and a light sidewalk band along the paved town streets. With the
// terrain grid (`grid`) every ribbon is cut along the terrain's own triangles
// (terreno.ts drapeTris) and lies exactly on the ground; without it (model viewer) each
// vertex just reads the ground height. The bake already levelled the terrain across each
// street bed (no sideways tilt). Where ribbons overlap (junctions) the order is fixed by
// lift + polygon offset: setts > asphalt > dirt > sidewalk > ground. One merged mesh per
// material for the whole town.
// (asphalt and dirt carry a near-white detail texture averaging ~0.85: their colour is lifted
// to match, so the palette value is what the surface reads as)
const lift=(c:string):THREE.Color=>new THREE.Color(c).multiplyScalar(1/.85);
export const asphaltMat=matte({color:lift(DIVINO.asphalt),map:asfaltoTexture(),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
export const dirtRoadMat=matte({color:lift(DIVINO.dirtRoad),map:terraTexture(),polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
// paralelepípedo (granite setts) of the old centre streets: tiled canvas texture
export const settMat=matte({map:settTexture(),polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5});
// (the cement-slab texture is already the sidewalk's own grey: no tint)
export const sidewalkMat=matte({color:0xf4f1ea,map:calcadaTexture('cimento'),polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});

// How far each ribbon is drawn above the terrain it is draped on (the world registers the
// same heights as walkable surfaces — world/surface-lift.ts — so wheels and feet rest on them).
export const STREET_LIFT={paved:.14,dirt:.12,sett:.16,walk:.1};

export type StreetLine={pts:[number,number][];hw:number;paved:boolean;sidewalk:boolean;sett?:boolean};
type HAt=(x:number,z:number)=>number;

// Ribbon between lateral offsets [o0,o1] (o0<o1, metres from the centreline, can be on
// both sides when o0<0<o1), as flat convex polygons (x,z,u,v per vertex): one quad per
// step, or its two triangles where a tight bend folds it.
function ribbon(pts:[number,number][],o0:number,o1:number,step:number,out:number[][]):void{
  // resample
  const P:[number,number][]=[];
  for(let k=1;k<pts.length;k++){
    const[ax,az]=pts[k-1],[bx,bz]=pts[k],L=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(L/step));
    for(let q=k===1?0:1;q<=n;q++)P.push([ax+(bx-ax)*q/n,az+(bz-az)*q/n]);
  }
  if(P.length<2)return;
  const N:[number,number][]=P.map((_,i)=>{
    const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)];
    const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
    return[-dz/l,dx/l];
  });
  const along:number[]=[0];for(let i=1;i<P.length;i++)along.push(along[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
  const T=SETT_TILE_M,ua=o0/T,ub=o1/T;
  const L:number[][]=[],R:number[][]=[];
  for(let i=0;i<P.length;i++){
    const[x,z]=P[i],[nx,nz]=N[i],v=along[i]/T;
    L.push([x+nx*o0,z+nz*o0,ua,v]);R.push([x+nx*o1,z+nz*o1,ub,v]);
  }
  const turn=(a:number[],b:number[],c:number[]):number=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  for(let i=1;i<P.length;i++){
    const q=[L[i-1],R[i-1],R[i],L[i]];
    const t=q.map((_,k)=>turn(q[k],q[(k+1)%4],q[(k+2)%4]));
    if(t.every(v=>v>1e-9)||t.every(v=>v<-1e-9))out.push(q.flat());
    else{out.push([...q[0],...q[1],...q[2]]);out.push([...q[0],...q[2],...q[3]]);}
  }
}
// flat (x,z,u,v) polygons → upward triangles on the ground (positions + uvs)
function lay(polys:number[][],hAt:HAt,lift:number,grid:DrapeGrid|undefined,pos:number[],uv?:number[]):void{
  if(grid){drapePolys(polys,grid,hAt,lift,pos,uv);return;}
  for(const p of polys)for(let k=4;k+4<p.length;k+=4){
    const a=[p[0],p[1],p[2],p[3]],b=p.slice(k,k+4),c=p.slice(k+4,k+8);
    const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1])>0;
    for(const v of up?[a,b,c]:[a,c,b]){pos.push(v[0],hAt(v[0],v[1])+lift,v[1]);if(uv)uv.push(v[2],v[3]);}
  }
}

const geo=(arr:number[],uv?:number[]):THREE.BufferGeometry=>{
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
  if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
};

export function makeStreets(lines:StreetLine[],hAt:HAt,grid?:DrapeGrid):THREE.Group{
  const asph:number[]=[],dirt:number[]=[],walk:number[]=[],sett:number[]=[],settUv:number[]=[],asphUv:number[]=[],dirtUv:number[]=[],walkUv:number[]=[];
  // draped ribbons follow the ground by themselves: resample only to round the bends
  const step=grid?6:3;
  lines.forEach((s,k)=>{
    const road:number[][]=[];
    ribbon(s.pts,-s.hw,s.hw,step,road);
    // two cobbled streets crossing would lay the same ground twice with their setts at
    // different angles: a few millimetres apart, one always shows over the other
    if(s.sett)lay(road,hAt,STREET_LIFT.sett+.006*(k%3),grid,sett,settUv);
    else lay(road,hAt,s.paved?STREET_LIFT.paved:STREET_LIFT.dirt,grid,s.paved?asph:dirt,s.paved?asphUv:dirtUv);
    if(s.sidewalk){
      const side:number[][]=[];
      ribbon(s.pts,s.hw,s.hw+2.1,step,side);
      ribbon(s.pts,-s.hw-2.1,-s.hw,step,side);
      lay(side,hAt,STREET_LIFT.walk,grid,walk,walkUv);
    }
  });
  const g=new THREE.Group();
  if(sett.length){const m=new THREE.Mesh(geo(sett,settUv),settMat);m.receiveShadow=true;m.matrixAutoUpdate=false;g.add(m);}
  for(const[a,m,uv]of[[asph,asphaltMat,asphUv],[dirt,dirtRoadMat,dirtUv],[walk,sidewalkMat,walkUv]] as [number[],THREE.Material,number[]][]){
    if(!a.length)continue;
    const mesh=new THREE.Mesh(geo(a,uv),m);mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;g.add(mesh);
  }
  return g;
}

// Water ribbons (Rio do Peixe + streams): each point carries its own surface height and
// how far the water reaches to its left (wl) and right (wr) before the bank rises over it
// (world/divinolandia/water.ts finds those shorelines on the terrain).
export const riverMat=matte({color:DIVINO.river,transparent:true,opacity:.88,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
export type WaterRibbon={pts:[number,number,number][];wl:number[];wr:number[]};
export function makeWater(lines:WaterRibbon[]):THREE.Mesh{
  const out:number[]=[];
  for(const w of lines){
    const P=w.pts;if(P.length<2)continue;
    // per-vertex normals (mean of the two segments) so consecutive quads share their edges
    const L:number[][]=[],R:number[][]=[];
    for(let i=0;i<P.length;i++){
      const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
      L.push([P[i][0]+nx*w.wl[i],P[i][2],P[i][1]+nz*w.wl[i]]);R.push([P[i][0]-nx*w.wr[i],P[i][2],P[i][1]-nz*w.wr[i]]);
    }
    for(let i=1;i<P.length;i++){
      if(w.wl[i-1]+w.wr[i-1]+w.wl[i]+w.wr[i]<.01)continue;  // buried under a road here
      const A=L[i-1],B=R[i-1],Cc=L[i],D=R[i];
      out.push(...A,...B,...Cc,...B,...D,...Cc);
    }
  }
  const g=geo(out);
  // face up regardless of travel direction: force +y normals
  const nrm=g.getAttribute('normal') as THREE.BufferAttribute;for(let i=0;i<nrm.count;i++)nrm.setXYZ(i,0,1,0);
  const m=new THREE.Mesh(g,riverMat);m.matrixAutoUpdate=false;m.renderOrder=1;
  return m;
}

// Model-viewer sample: a crossing of a paved street and a dirt road on a slope.
function build():THREE.Group{
  const h=(x:number,z:number):number=>z*.08+Math.sin(x*.05)*.6;
  return makeStreets([
    {pts:[[-40,0],[0,0],[40,6]],hw:3.6,paved:true,sidewalk:true},
    {pts:[[0,-40],[0,0],[-6,40]],hw:3.2,paved:false,sidewalk:false},
    {pts:[[-40,-20],[40,-20]],hw:3.6,paved:true,sidewalk:true,sett:true},
  ],h);
}
export default {category:'Divinolândia',label:'Ruas (asfalto, terra, calçada)',build};
