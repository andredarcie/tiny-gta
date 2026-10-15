import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';
import {settTexture,SETT_TILE_M} from './texturas.ts';

// Divinolândia streets — the real OpenStreetMap street network as ribbons draped on
// the terrain: asphalt in town, terra-roxa dirt on the unpaved/rural roads, and a
// light sidewalk band along the paved town streets. Each ribbon is re-sampled every
// few metres and every vertex reads the ground height, so it hugs the hills; the bake
// already levelled the terrain across each street bed (no sideways tilt). Polygon
// offset keeps road > sidewalk > ground without z-fighting. One merged mesh per
// material for the whole town.
export const asphaltMat=matte({color:DIVINO.asphalt,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
export const dirtRoadMat=matte({color:DIVINO.dirtRoad,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
// paralelepípedo (granite setts) of the old centre streets: tiled canvas texture
export const settMat=matte({map:settTexture(),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
export const sidewalkMat=matte({color:DIVINO.sidewalk,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});

export type StreetLine={pts:[number,number][];hw:number;paved:boolean;sidewalk:boolean;sett?:boolean};
type HAt=(x:number,z:number)=>number;

// Ribbon between lateral offsets [o0,o1] (o0<o1, metres from the centreline, can be on
// both sides when o0<0<o1). Returns non-indexed triangle positions.
function ribbon(pts:[number,number][],o0:number,o1:number,hAt:HAt,lift:number,step:number,out:number[],uv?:number[]):void{
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
  const L:number[][]=[],R:number[][]=[];
  for(let i=0;i<P.length;i++){
    const[x,z]=P[i],[nx,nz]=N[i];
    const lx=x+nx*o0,lz=z+nz*o0,rx=x+nx*o1,rz=z+nz*o1;
    L.push([lx,hAt(lx,lz)+lift,lz]);R.push([rx,hAt(rx,rz)+lift,rz]);
  }
  const along:number[]=[0];for(let i=1;i<P.length;i++)along.push(along[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
  const T=SETT_TILE_M,ua=o0/T,ub=o1/T;
  for(let i=1;i<P.length;i++){
    const a=L[i-1],b=R[i-1],c=L[i],d=R[i];
    const va=along[i-1]/T,vc=along[i]/T;
    // winding chosen per segment so the face points up whatever the travel direction
    const ux=c[0]-a[0],uz=c[2]-a[2],vx=b[0]-a[0],vz=b[2]-a[2];
    const up=(uz*vx-ux*vz)>0;
    if(up)out.push(...a,...c,...b,...b,...c,...d);
    else out.push(...a,...b,...c,...b,...d,...c);
    if(uv){if(up)uv.push(ua,va,ua,vc,ub,va,ub,va,ua,vc,ub,vc);else uv.push(ua,va,ub,va,ua,vc,ub,va,ub,vc,ua,vc);}
  }
}

const geo=(arr:number[],uv?:number[]):THREE.BufferGeometry=>{
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
  if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
};

export function makeStreets(lines:StreetLine[],hAt:HAt):THREE.Group{
  const asph:number[]=[],dirt:number[]=[],walk:number[]=[],sett:number[]=[],settUv:number[]=[];
  for(const s of lines){
    if(s.sett)ribbon(s.pts,-s.hw,s.hw,hAt,.15,3,sett,settUv);
    else ribbon(s.pts,-s.hw,s.hw,hAt,.14,3,s.paved?asph:dirt);
    if(s.sidewalk){
      ribbon(s.pts,s.hw,s.hw+2.1,hAt,.1,3,walk);
      ribbon(s.pts,-s.hw-2.1,-s.hw,hAt,.1,3,walk);
    }
  }
  const g=new THREE.Group();
  if(sett.length){const m=new THREE.Mesh(geo(sett,settUv),settMat);m.receiveShadow=true;m.matrixAutoUpdate=false;g.add(m);}
  for(const[a,m]of[[asph,asphaltMat],[dirt,dirtRoadMat],[walk,sidewalkMat]] as [number[],THREE.Material][]){
    if(!a.length)continue;
    const mesh=new THREE.Mesh(geo(a),m);mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;g.add(mesh);
  }
  return g;
}

// Water ribbons (Rio do Peixe + streams): each point carries its own surface height.
export const riverMat=matte({color:DIVINO.river,transparent:true,opacity:.88,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
export function makeWater(lines:{hw:number;pts:[number,number,number][]}[]):THREE.Mesh{
  const out:number[]=[];
  for(const w of lines){
    const P=w.pts;if(P.length<2)continue;
    for(let i=1;i<P.length;i++){
      const a=P[i-1],b=P[i],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l*w.hw,nz=dx/l*w.hw;
      // slight overlap past each end so consecutive segments leave no gaps at bends
      const ex=dx/l*.8,ez=dz/l*.8;
      const A=[a[0]-nx-ex,a[2],a[1]-nz-ez],B=[a[0]+nx-ex,a[2],a[1]+nz-ez],Cc=[b[0]-nx+ex,b[2],b[1]-nz+ez],D=[b[0]+nx+ex,b[2],b[1]+nz+ez];
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
