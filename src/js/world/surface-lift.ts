// Walkable/drivable surfaces drawn ABOVE the terrain — PURE (no THREE), unit-tested in
// test/unit/surface-lift.test.ts.
//
// The town's paving is draped over the terrain a little above it, each layer at its own
// lift (rua.ts: asphalt 14 cm, setts 16, dirt 12, plain sidewalks 10; the surveyed streets'
// raised sidewalks 32; the Matriz squares and their streets 21 — praca-chao.ts STREET_TOP).
// What rests on the ground (car wheels, and anything else that asks walkHeight) must rest on
// that DRAWN surface, not the bare terrain under it, or it sinks into the street.
//
// The world builder registers every such surface here as it lays it (street strips and
// polygons, in world metres, with the lift above groundHeight). walkHeight(x,z) is the
// terrain plus the highest surface covering that point. groundHeight itself stays the bare
// terrain: the surfaces are draped ON it (reading it), so it must not include them.
import {groundHeight} from '@/core/constants.ts';

type Seg={ax: number;az: number;bx: number;bz: number;hw0: number;hw: number;lift: number;line: Seg[]};
type Poly={pts: [number,number][];lift: number;x0: number;x1: number;z0: number;z1: number};
const CELL=16;
const segs=new Map<number,Seg[]>(),polys=new Map<number,Poly[]>();
const key=(i: number,j: number): number=>i*73856093^j*19349663;
function bucket<T>(m: Map<number,T[]>,x0: number,x1: number,z0: number,z1: number,v: T): void{
  for(let i=Math.floor(x0/CELL);i<=Math.floor(x1/CELL);i++)for(let j=Math.floor(z0/CELL);j<=Math.floor(z1/CELL);j++){
    const k=key(i,j);let a=m.get(k);if(!a){a=[];m.set(k,a);}a.push(v);
  }
}

// A strip of surface along a polyline: everything between `hw0` and `hw` from it (a band on
// both sides, e.g. raised sidewalks; hw0 = 0 for the whole roadway), `lift` above the terrain.
export function addSurfaceStrip(pts: [number,number][],hw: number,lift: number,hw0=0): void{
  const line: Seg[]=[];
  for(let i=1;i<pts.length;i++){
    const[ax,az]=pts[i-1],[bx,bz]=pts[i],s: Seg={ax,az,bx,bz,hw0,hw,lift,line};line.push(s);
    bucket(segs,Math.min(ax,bx)-hw,Math.max(ax,bx)+hw,Math.min(az,bz)-hw,Math.max(az,bz)+hw,s);
  }
}
// A surface over a polygon (world x,z), `lift` above the terrain.
export function addSurfacePolygon(pts: [number,number][],lift: number): void{
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const[x,z]of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);}
  bucket(polys,x0,x1,z0,z1,{pts,lift,x0,x1,z0,z1});
}

function inside(px: number,pz: number,pts: [number,number][]): boolean{
  let c=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const[xi,zi]=pts[i],[xj,zj]=pts[j];
    if((zi>pz)!==(zj>pz)&&px<(xj-xi)*(pz-zi)/(zj-zi)+xi)c=!c;
  }
  return c;
}

function dist2(x: number,z: number,s: Seg): number{
  const dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz||1;
  let t=((x-s.ax)*dx+(z-s.az)*dz)/l2;t=t<0?0:t>1?1:t;
  const ex=x-s.ax-dx*t,ez=z-s.az-dz*t;
  return ex*ex+ez*ez;
}

// The highest registered surface over (x,z), as a lift above the terrain (0 = bare ground).
export function surfaceLift(x: number,z: number): number{
  const k=key(Math.floor(x/CELL),Math.floor(z/CELL));
  let best=0;
  const ss=segs.get(k);
  if(ss)for(const s of ss){
    if(s.lift<=best)continue;
    const d2=dist2(x,z,s);
    // a band (hw0 > 0) holds only outside the inner width of its WHOLE polyline (on the
    // inside of a bend the neighbouring segment's roadway is still roadway)
    if(d2<=s.hw*s.hw&&(s.hw0===0||s.line.every(o=>dist2(x,z,o)>=s.hw0*s.hw0)))best=s.lift;
  }
  const ps=polys.get(k);
  if(ps)for(const p of ps){
    if(p.lift<=best||x<p.x0||x>p.x1||z<p.z0||z>p.z1)continue;
    if(inside(x,z,p.pts))best=p.lift;
  }
  return best;
}

// Where wheels and feet rest: the terrain plus the paving drawn over it.
export const walkHeight=(x: number,z: number): number=>groundHeight(x,z)+surfaceLift(x,z);

// (tests) forget everything registered
export function clearSurfaces(): void{segs.clear();polys.clear();}
