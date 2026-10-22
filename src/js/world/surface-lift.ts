// Walkable/drivable surfaces drawn ABOVE the terrain — PURE (no THREE), unit-tested in
// test/unit/surface-lift.test.ts.
//
// The town's paving is draped over the terrain a little above it, each layer at its own
// lift (rua.ts STREET_LIFT: asphalt 14 cm, setts 16, dirt 12, the kerbed sidewalks 32 — the
// surveyed streets' too; the Matriz squares and their streets 21 — praca-chao.ts STREET_TOP).
// What rests on the ground (car wheels, people, props) must rest on that DRAWN surface, not
// the bare terrain under it, or it sinks into the street.
//
// The world builder registers every such surface here as it lays it (street strips and
// polygons, in world metres, with the lift above the terrain), and this module plugs
// surfaceLift into groundHeight (core/terrain.ts setGroundOverlay): groundHeight(x,z) is the
// terrain plus the surface covering that point. (The paving itself is draped on the bare
// terrain — data.ts divinoHeight / terrainHeight.)
//
// Where surfaces overlap, a ROADWAY (a strip with hw0 = 0) beats a band (a sidewalk strip
// along a street is not drawn across the street crossing it); polygons (the surveyed raised
// sidewalks, the squares) beat both when higher.
import {setGroundOverlay} from '@/core/terrain.ts';

type Seg={ax: number;az: number;bx: number;bz: number;hw0: number;hw: number;lift: number;line: object};
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
  const line={};                                         // identity shared by the polyline's segments
  for(let i=1;i<pts.length;i++){
    const[ax,az]=pts[i-1],[bx,bz]=pts[i],s: Seg={ax,az,bx,bz,hw0,hw,lift,line};
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
  let road=0,band=0;
  const ss=segs.get(k);
  if(ss)for(const s of ss){
    if(s.lift<=(s.hw0===0?road:band))continue;
    if(dist2(x,z,s)>s.hw*s.hw)continue;
    if(s.hw0===0){road=s.lift;continue;}
    // a band holds only outside the inner width of its whole polyline (on the inside of a
    // bend the neighbouring segment's roadway is still roadway; any segment that close
    // shares this bucket)
    if(ss.every(o=>o.line!==s.line||dist2(x,z,o)>=s.hw0*s.hw0))band=s.lift;
  }
  let best=road>0?road:band;
  const ps=polys.get(k);
  if(ps)for(const p of ps){
    if(p.lift<=best||x<p.x0||x>p.x1||z<p.z0||z>p.z1)continue;
    if(inside(x,z,p.pts))best=p.lift;
  }
  return best;
}

setGroundOverlay(surfaceLift);

// (tests) forget everything registered
export function clearSurfaces(): void{segs.clear();polys.clear();}
