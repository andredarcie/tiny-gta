// Divinolândia's water — the Rio do Peixe and its streams as gameplay water (boats,
// swimming, the boat race). PURE module (no THREE, no DOM).
//
// The bake (tools/bake-divinolandia.ts) carved each watercourse into the relief as a
// channel whose SURFACE always runs downhill (src/data/divinolandia.json → waters: x, z,
// surface y per vertex; rivers 6 m half-width, streams 1.6 m). The river ribbon drawn
// by assets/models/divinolandia/rua.ts makeWater sits at exactly these heights, so a
// boat floating at waterSurface() rides the water that is drawn — and the water slopes
// gently down the valley, so the boat race is a real descent of the Rio do Peixe.
import {divData as D,DIV_OX,DIV_OZ,divinoHeight} from './data.ts';

interface Seg{ax:number;az:number;ay:number;bx:number;bz:number;by:number;hw:number;river:boolean}
const segs:Seg[]=[];
for(const w of D.waters){
  const river=w.hw>=4;
  for(let i=1;i<w.pts.length;i++){
    const a=w.pts[i-1],b=w.pts[i];
    segs.push({ax:a[0]+DIV_OX,az:a[1]+DIV_OZ,ay:a[2],bx:b[0]+DIV_OX,bz:b[1]+DIV_OZ,by:b[2],hw:w.hw,river});
  }
}
const HC=32;
const hk=(i:number,j:number):number=>i*92821^j*68917;
const hash=new Map<number,number[]>();
segs.forEach((s,k)=>{
  const m=s.hw+1;
  for(let i=Math.floor((Math.min(s.ax,s.bx)-m)/HC);i<=Math.floor((Math.max(s.ax,s.bx)+m)/HC);i++)
    for(let j=Math.floor((Math.min(s.az,s.bz)-m)/HC);j<=Math.floor((Math.max(s.az,s.bz)+m)/HC);j++){
      const key=hk(i,j);let a=hash.get(key);if(!a){a=[];hash.set(key,a);}a.push(k);
    }
});

// nearest watercourse at (x,z): distance to its centre line, surface y there, half-width
export interface WaterHit{d:number;y:number;hw:number;river:boolean}
export function waterNear(x:number,z:number):WaterHit|null{
  const a=hash.get(hk(Math.floor(x/HC),Math.floor(z/HC)));
  if(!a)return null;
  let best:WaterHit|null=null;
  for(const k of a){
    const s=segs[k],dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz||1;
    let t=((x-s.ax)*dx+(z-s.az)*dz)/l2;t=t<0?0:t>1?1:t;
    const d=Math.hypot(x-s.ax-dx*t,z-s.az-dz*t);
    if(!best||d-s.hw<best.d-best.hw)best={d,y:s.ay+(s.by-s.ay)*t,hw:s.hw,river:s.river};
  }
  return best;
}
// water surface height at (x,z), or null on dry land
export function waterSurface(x:number,z:number):number|null{
  const w=waterNear(x,z);
  return w&&w.d<=w.hw?w.y:null;
}
// deep enough to swim (and for a boat to float): the river, not the ankle-deep streams
export function deepWater(x:number,z:number):boolean{
  const w=waterNear(x,z);
  return!!w&&w.river&&w.d<=w.hw-.6&&w.y-divinoHeight(x,z)>.5;
}

// ---------------------------------------------------------------- the Rio do Peixe
// its main course as one polyline, from upstream (south-east, past the town) to
// downstream (north-west), with the arc length at each vertex — the boat race runs
// along it and the moored boat waits on it
const rio=D.waters.filter(w=>w.name==='Rio do Peixe').sort((a,b)=>b.pts.length-a.pts.length)[0]?.pts||[];
const RX=rio.map(p=>p[0]+DIV_OX),RZ=rio.map(p=>p[1]+DIV_OZ),RY=rio.map(p=>p[2]);
const RS:number[]=[0];
for(let i=1;i<rio.length;i++)RS.push(RS[i-1]+Math.hypot(RX[i]-RX[i-1],RZ[i]-RZ[i-1]));
export const RIVER_LEN=RS[RS.length-1]||0;
export const RIVER_HW=6;

export interface RiverPt{x:number;z:number;y:number;dx:number;dz:number}
// the river centre line at arc length s (direction = downstream)
export function riverAt(s:number):RiverPt{
  s=s<0?0:s>RIVER_LEN?RIVER_LEN:s;
  let lo=0,hi=RS.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(RS[m]<=s)lo=m;else hi=m;}
  const l=RS[hi]-RS[lo]||1,t=(s-RS[lo])/l;
  const dx=(RX[hi]-RX[lo])/l,dz=(RZ[hi]-RZ[lo])/l;
  return{x:RX[lo]+(RX[hi]-RX[lo])*t,z:RZ[lo]+(RZ[hi]-RZ[lo])*t,y:RY[lo]+(RY[hi]-RY[lo])*t,dx,dz};
}
// arc length of the river point nearest to (x,z), and the distance to it
export function riverArcAt(x:number,z:number):{s:number;d:number}{
  let best={s:0,d:Infinity};
  for(let i=1;i<RX.length;i++){
    const ax=RX[i-1],az=RZ[i-1],dx=RX[i]-ax,dz=RZ[i]-az,l2=dx*dx+dz*dz||1;
    let t=((x-ax)*dx+(z-az)*dz)/l2;t=t<0?0:t>1?1:t;
    const d=Math.hypot(x-ax-dx*t,z-az-dz*t);
    if(d<best.d)best={s:RS[i-1]+t*Math.sqrt(l2),d};
  }
  return best;
}

// the boat moored on the Rio do Peixe just north of the centre, by the Avenida Marginal
// (arc ~2.9 km from the upstream end); the first boat race starts right there
export const BOAT_MOOR_S=2900;
