// Seating buildings on Divinolândia's relief — PURE (no THREE, no DOM), unit-tested in
// test/unit/ground-fit.test.ts.
//
// The rule every building follows (the way real houses are built on a hillside town):
// the FLOOR is level, at the height of the street in front of the door (never buried more
// than `maxBuried` at the back), and a masonry BASE/plinth runs from the floor down to the
// lowest ground anywhere under the footprint, so no edge ever floats over a dip and the
// uphill side is simply cut into the slope. The terrain itself is never edited per
// building (the streets are graded and the game's places sit on levelled pads — data.ts).
//
// groundRange() is EXACT: the ground is piecewise planar (the heightfield's triangles, the
// same ones drawn and driven on), so over a polygon its lowest and highest points lie on the
// polygon's corners, on grid nodes inside it, or where its edges cross the grid lines and
// the cells' diagonals — all of which are enumerated. (Sampling a few points along the
// walls, as before, missed the dips between them: those were the floating edges.)
import {nearGrid,farGrid,inNearGrid,divinoHeight,RIO_FINE_AT,RIO_FN,type Grid} from './data.ts';

export type P2=[number,number];

const gridOf=(x: number,z: number): Grid=>inNearGrid(x,z)?nearGrid:farGrid;

function inside(px: number,pz: number,poly: P2[]): boolean{
  let c=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const[xi,zi]=poly[i],[xj,zj]=poly[j];
    if((zi>pz)!==(zj>pz)&&px<(xj-xi)*(pz-zi)/(zj-zi)+xi)c=!c;
  }
  return c;
}

// does the box touch a cell of the river corridor's finer relief (data.ts RIO_FINE)?
function touchesFine(x0: number,x1: number,z0: number,z1: number): boolean{
  const g=nearGrid;
  for(let j=Math.max(0,Math.floor((z0-g.z0)/g.cell));j<=Math.min(g.nz-2,Math.floor((z1-g.z0)/g.cell));j++)
    for(let i=Math.max(0,Math.floor((x0-g.x0)/g.cell));i<=Math.min(g.nx-2,Math.floor((x1-g.x0)/g.cell));i++)
      if(RIO_FINE_AT[j*(g.nx-1)+i]>=0)return true;
  return false;
}

// Lowest and highest ground over a polygon (world coordinates).
export function groundRange(poly: P2[]): {min: number;max: number}{
  let min=1e9,max=-1e9;
  const take=(x: number,z: number)=>{const h=divinoHeight(x,z);if(h<min)min=h;if(h>max)max=h;};
  let gx0=1e9,gx1=-1e9,gz0=1e9,gz1=-1e9;
  for(const[x,z]of poly){take(x,z);gx0=Math.min(gx0,x);gx1=Math.max(gx1,x);gz0=Math.min(gz0,z);gz1=Math.max(gz1,z);}
  const g0=gridOf((gx0+gx1)/2,(gz0+gz1)/2);
  // along the river the ground is the corridor's 2 m triangles: enumerate on that lattice
  const g=g0===nearGrid&&touchesFine(gx0,gx1,gz0,gz1)?{...g0,cell:g0.cell/(RIO_FN-1)}:g0;
  const u=(x: number)=>(x-g.x0)/g.cell,v=(z: number)=>(z-g.z0)/g.cell;
  // grid nodes inside
  for(let i=Math.ceil(u(gx0));i<=Math.floor(u(gx1));i++)for(let j=Math.ceil(v(gz0));j<=Math.floor(v(gz1));j++){
    const x=g.x0+i*g.cell,z=g.z0+j*g.cell;
    if(inside(x,z,poly))take(x,z);
  }
  // edges × grid lines (u = i, v = j) and × the cell diagonals (u + v = k)
  for(let e=0;e<poly.length;e++){
    const[ax,az]=poly[e],[bx,bz]=poly[(e+1)%poly.length];
    const au=u(ax),av=v(az),bu=u(bx),bv=v(bz);
    const cross=(fa: number,fb: number)=>{
      if(fa===fb)return;
      for(let k=Math.ceil(Math.min(fa,fb));k<=Math.floor(Math.max(fa,fb));k++){
        const t=(k-fa)/(fb-fa);take(ax+(bx-ax)*t,az+(bz-az)*t);
      }
    };
    cross(au,bu);cross(av,bv);cross(au+av,bu+bv);
  }
  return{min,max};
}

// The corners of a w × d rectangle centred at (x,z), its local +x axis turned `rot` toward +z.
export function rect(x: number,z: number,w: number,d: number,rot: number): P2[]{
  const c=Math.cos(rot),s=Math.sin(rot);
  return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[x+a*w/2*c-b*d/2*s,z+a*w/2*s+b*d/2*c] as P2);
}

export interface Fit{floor: number;base: number;low: number;high: number;buried: number}
// Where a building's floor goes and how deep its base must reach (base is world y).
//   front     — the doorstep point (street side); the floor sits `lift` above the ground there
//   maxBuried — at most this much of the uphill wall below ground (the floor rises if needed)
export function fitBuilding(poly: P2[],front: P2,{lift=.15,maxBuried=2.4,footing=.5}: {lift?: number;maxBuried?: number;footing?: number}={}): Fit{
  const{min,max}=groundRange(poly);
  const doorstep=divinoHeight(front[0],front[1]);
  const floor=Math.max(doorstep,max-maxBuried)+lift;
  return{floor,base:min-footing,low:min,high:max,buried:Math.max(0,max-floor)};
}
