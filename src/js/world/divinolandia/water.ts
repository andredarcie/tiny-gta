// Divinolândia's water — the Rio do Peixe and its streams as gameplay water (boats,
// swimming, the boat race). PURE module (no THREE, no DOM).
//
// The bake (tools/bake-divinolandia.ts) carved each watercourse into the relief as a
// narrow channel whose SURFACE always runs downhill (src/data/divinolandia.json → waters:
// x, z, surface y per vertex). How wide the water is comes from the ground itself: at
// every vertex the surface is followed out to each side until the bank rises above it
// (the shoreline), plus a hand's width tucked under the bank. The ribbon drawn by
// assets/models/divinolandia/rua.ts makeWater uses exactly these widths (waterLines), so
// the water meets its banks instead of hovering over the channel, and a boat floating at
// waterSurface() rides the water that is drawn — sloping gently down the valley, so the
// boat race is a real descent of the Rio do Peixe.
import {divData as D,DIV_OX,DIV_OZ,bedHeight,RIO,RIO_BANK,rioNearest} from './data.ts';

// how far the search looks for a bank, and how far the drawn edge reaches under it
const MAX_W={river:28,stream:16},TUCK=.7,STEP=.4;
// every vertex of every watercourse in a coarse hash: a shoreline search stops where it
// gets closer to another stretch of water (a meander loop, a confluence) standing at least
// as high, which covers the ground from there on; a LOWER one is simply drawn over
const VC=24,vk=(x:number,z:number):number=>Math.floor(x/VC)*92821^Math.floor(z/VC)*68917;
const verts=new Map<number,{x:number;z:number;y:number;line:number;i:number}[]>();
D.waters.forEach((w,line)=>w.pts.forEach((p,i)=>{
  const x=p[0]+DIV_OX,z=p[1]+DIV_OZ,k=vk(x,z);let a=verts.get(k);if(!a){a=[];verts.set(k,a);}a.push({x,z,y:p[2],line,i});
}));
// the roadways (centre line + half width): water is never drawn over one — the bake keeps
// the road beds above the water nearby, and a roadway is a bank to the shoreline search
const RC=24,rk=(x:number,z:number):number=>Math.floor(x/RC)*92821^Math.floor(z/RC)*68917;
const roadSegs=new Map<number,{ax:number;az:number;bx:number;bz:number;hw:number}[]>();
for(const r of D.roads)for(let i=1;i<r.pts.length;i++){
  const g={ax:r.pts[i-1][0]+DIV_OX,az:r.pts[i-1][1]+DIV_OZ,bx:r.pts[i][0]+DIV_OX,bz:r.pts[i][1]+DIV_OZ,hw:r.hw},m=r.hw+1;
  for(let a=Math.floor((Math.min(g.ax,g.bx)-m)/RC);a<=Math.floor((Math.max(g.ax,g.bx)+m)/RC);a++)
    for(let b=Math.floor((Math.min(g.az,g.bz)-m)/RC);b<=Math.floor((Math.max(g.az,g.bz)+m)/RC);b++){
      const k=Math.floor(a)*92821^Math.floor(b)*68917;let arr=roadSegs.get(k);if(!arr){arr=[];roadSegs.set(k,arr);}arr.push(g);
    }
}
type RoadSeg={ax:number;az:number;bx:number;bz:number;hw:number};
const segD=(x:number,z:number,g:RoadSeg):number=>{
  const dx=g.bx-g.ax,dz=g.bz-g.az,l2=dx*dx+dz*dz||1;let t=((x-g.ax)*dx+(z-g.az)*dz)/l2;t=t<0?0:t>1?1:t;
  return Math.hypot(x-g.ax-t*dx,z-g.az-t*dz);
};
function onRoadway(x:number,z:number):boolean{
  for(const g of roadSegs.get(rk(x,z))||[])if(segD(x,z,g)<g.hw+.3)return true;
  return false;
}
// what one cross-section search can meet within reach r of its point: the roadways, and
// the vertices of other water standing at least as high (`y`)
function gather(x:number,z:number,y:number,r:number,line:number,i:number):{roads:RoadSeg[];others:{x:number;z:number}[]}{
  const roads=new Set<RoadSeg>(),others:{x:number;z:number}[]=[];
  for(let a=Math.floor((x-r)/RC);a<=Math.floor((x+r)/RC);a++)for(let b=Math.floor((z-r)/RC);b<=Math.floor((z+r)/RC);b++)
    for(const g of roadSegs.get(a*92821^b*68917)||[])if(!roads.has(g)&&segD(x,z,g)<r+g.hw+.3)roads.add(g);
  for(let a=Math.floor((x-r)/VC);a<=Math.floor((x+r)/VC);a++)for(let b=Math.floor((z-r)/VC);b<=Math.floor((z+r)/VC);b++)
    for(const v of verts.get(a*92821^b*68917)||[])
      if((v.line!==line||Math.abs(v.i-i)>3)&&v.y>=y-.05&&Math.hypot(v.x-x,v.z-z)<2*r)others.push(v);
  return{roads:[...roads],others};
}
// The water across one point of a course: the submerged stretch of ground found along
// the normal, grown from the lowest point near the centre line (the channel node may sit a
// little off it) out to the bank on each side. Returns the signed offsets of its edges
// (left positive), or [0,0] where the ground is above the water — a road crossing it.
function crossSection(x:number,z:number,y:number,nx:number,nz:number,max:number,seedR:number,line:number,i:number):[number,number]{
  const g=(d:number):number=>bedHeight(x+nx*d,z+nz*d);
  const near=gather(x,z,y,max+1,line,i);
  const{roads,others}=near;
  const dry=(d:number):boolean=>{
    if(!roads.length)return false;
    const px=x+nx*d,pz=z+nz*d;
    for(const r of roads)if(segD(px,pz,r)<r.hw+.3)return true;
    return false;
  };
  const closer=(d:number):boolean=>{
    if(!others.length)return false;
    const px=x+nx*d,pz=z+nz*d,own=d*d;
    for(const v of others){const ex=v.x-px,ez=v.z-pz;if(ex*ex+ez*ez<own)return true;}
    return false;
  };
  let seed=0,low=Infinity;
  for(let d=-seedR;d<=seedR;d+=STEP){const h=g(d);if(h<low-1e-6&&h<y&&!dry(d)){low=h;seed=d;}}
  if(low>=y)return[0,0];
  // the main river's water is a bank to a stream's search (the stream ends in it)
  const inRio=(d:number):boolean=>{const q=rioNearest(x+nx*d,z+nz*d);return!!q&&q.d<q.w+RIO_BANK*.5;};
  const edge=(dir:number):number=>{
    for(let d=seed+dir*STEP;Math.abs(d)<=max;d+=dir*STEP){
      if(inRio(d))return d-dir*STEP;
      if(dry(d))return d-dir*STEP;
      if(g(d)>y)return d+dir*TUCK;
      if(Math.abs(d)>STEP&&closer(d))return d;
    }
    return dir*max;
  };
  return[edge(1),edge(-1)];
}
// one watercourse in world coordinates (resampled every ~2 m), with the water's edges at
// every point as signed offsets along the left normal of the downstream direction:
// wl = left edge, -wr = right edge (both on one side where the channel runs off the line)
export interface WaterLine{river:boolean;pts:[number,number,number][];wl:number[];wr:number[]}
// The Rio do Peixe's main course is not searched on the terrain: data.ts carves it as a
// continuous channel along its smoothed centre line (RIO), so its water is that line with
// the channel's own width, drawn RIO_VIS m further into the banks (the terrain rises over
// the water's edge there, so the shoreline is where the banks meet the surface).
const RIO_VIS=1.6;
const MAIN=D.waters.filter(w=>w.name==='Rio do Peixe').sort((a,b)=>b.pts.length-a.pts.length)[0];
export const waterLines:WaterLine[]=D.waters.map((w,line)=>({w,line})).filter(o=>o.w!==MAIN).map(({w,line})=>{
  const river=w.hw>=4,max=river?MAX_W.river:MAX_W.stream,seedR=river?10:9;
  const src=w.pts.map(p=>[p[0]+DIV_OX,p[1]+DIV_OZ,p[2]] as [number,number,number]);
  const pts:[number,number,number][]=[],orig:number[]=[];
  for(let k=0;k<src.length;k++){
    if(!k){pts.push(src[0]);orig.push(0);continue;}
    const a=src[k-1],b=src[k],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    for(let q=1;q<=n;q++){const t=q/n;pts.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]);orig.push(t<.5?k-1:k);}
  }
  const wl:number[]=[],wr:number[]=[];
  pts.forEach((p,i)=>{
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
    const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
    const q=rioNearest(p[0],p[1]);
    if(q&&q.d<q.w+RIO_BANK*.5){wl.push(0);wr.push(0);return;}
    const[l0,r0]=crossSection(p[0],p[1],p[2],-dz/l,dx/l,max,seedR,line,orig[i]);
    wl.push(l0);wr.push(-r0);
  });
  // where the water stops under a road, the quad tapering from the last wet point to the
  // dry one would still lap over the roadway: dry that point too, until none does
  const edgeAt=(i:number,side:number):[number,number]=>{
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,o=side>0?wl[i]:-wr[i];
    return[pts[i][0]-dz/l*o,pts[i][1]+dx/l*o];
  };
  for(let changed=true;changed;){
    changed=false;
    for(let i=0;i<pts.length;i++){
      if(!wl[i]&&!wr[i])continue;
      for(const j of[i-1,i+1]){
        if(j<0||j>=pts.length||wl[j]||wr[j])continue;
        let laps=false;
        const[lx,lz]=edgeAt(i,1),[rx,rz]=edgeAt(i,-1);
        for(let t=0;t<1&&!laps;t+=.1)for(let q=0;q<=1;q+=.25){
          const ex=lx+(rx-lx)*q,ez=lz+(rz-lz)*q;
          if(onRoadway(ex+(pts[j][0]-ex)*t,ez+(pts[j][1]-ez)*t)){laps=true;break;}
        }
        if(laps){wl[i]=0;wr[i]=0;changed=true;break;}
      }
    }
  }
  return{river,pts,wl,wr};
});
if(RIO.x.length>1){
  const pts:[number,number,number][]=[],wl:number[]=[];
  for(let i=0;i<RIO.x.length;i++){pts.push([RIO.x[i],RIO.z[i],RIO.y[i]]);wl.push(RIO.w[i]+RIO_VIS);}
  waterLines.push({river:true,pts,wl,wr:wl.slice()});
}

interface Seg{ax:number;az:number;ay:number;bx:number;bz:number;by:number;la:number;lb:number;ra:number;rb:number;river:boolean}
const segs:Seg[]=[];
for(const w of waterLines){
  for(let i=1;i<w.pts.length;i++){
    const a=w.pts[i-1],b=w.pts[i];
    segs.push({ax:a[0],az:a[1],ay:a[2],bx:b[0],bz:b[1],by:b[2],la:w.wl[i-1],lb:w.wl[i],ra:w.wr[i-1],rb:w.wr[i],river:w.river});
  }
}
const HC=32;
const hk=(i:number,j:number):number=>i*92821^j*68917;
const hash=new Map<number,number[]>();
segs.forEach((s,k)=>{
  const m=Math.max(Math.abs(s.la),Math.abs(s.lb),Math.abs(s.ra),Math.abs(s.rb))+1;
  for(let i=Math.floor((Math.min(s.ax,s.bx)-m)/HC);i<=Math.floor((Math.max(s.ax,s.bx)+m)/HC);i++)
    for(let j=Math.floor((Math.min(s.az,s.bz)-m)/HC);j<=Math.floor((Math.max(s.az,s.bz)+m)/HC);j++){
      const key=hk(i,j);let a=hash.get(key);if(!a){a=[];hash.set(key,a);}a.push(k);
    }
});

// nearest watercourse at (x,z): distance to the middle of its water there, the surface y
// and the water's half-width (inside the water when d ≤ hw)
export interface WaterHit{d:number;y:number;hw:number;river:boolean}
export function waterNear(x:number,z:number):WaterHit|null{
  const a=hash.get(hk(Math.floor(x/HC),Math.floor(z/HC)));
  if(!a)return null;
  let best:WaterHit|null=null,bestRank=Infinity;
  for(const k of a){
    const s=segs[k],dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz||1;
    let t=((x-s.ax)*dx+(z-s.az)*dz)/l2;t=t<0?0:t>1?1:t;
    // signed offset across the centre line (left = the (-dz,dx) side) vs the water's edges
    // there; past the segment's ends the point belongs to the next segment, not to this one
    // (the drawn water has no round caps)
    const L=Math.sqrt(l2),o=(dx*(z-s.az)-dz*(x-s.ax))/L,u=((x-s.ax)*dx+(z-s.az)*dz)/L,over=u<0?-u:u>L?u-L:0;
    // (the river's segments get round ends: on the outside of a bend the drawn water — mitred at
    // each vertex — covers a wedge that neither segment's straight band reaches; the river only
    // ends at the map's edges, so no cap ever runs out over a road)
    const wl=s.la+(s.lb-s.la)*t,wr=s.ra+(s.rb-s.ra)*t,hw=(wl+wr)/2,lat=Math.abs(o-(wl-wr)/2);
    const d=over>1e-6?(s.river?Math.hypot(over,lat):hw+over):lat;
    // inside the river's water the river wins (a stream ending in it does not)
    const rank=d-hw-(s.river&&d<=hw?1e3:0);
    if(!best||rank<bestRank){best={d,y:s.ay+(s.by-s.ay)*t,hw,river:s.river};bestRank=rank;}
  }
  return best;
}
// water surface height at (x,z), or null on dry land
export function waterSurface(x:number,z:number):number|null{
  const w=waterNear(x,z);
  return w&&w.d<=w.hw&&bedHeight(x,z)<w.y?w.y:null;
}
// deep enough to swim (and for a boat to float): the river, not the ankle-deep streams
export function deepWater(x:number,z:number):boolean{
  const w=waterNear(x,z);
  return!!w&&w.river&&w.d<=w.hw-.6&&w.y-bedHeight(x,z)>.5;
}

// ---------------------------------------------------------------- the Rio do Peixe
// its main course as one polyline (data.ts RIO, smoothed), from upstream (south-east, past
// the town) to downstream (north-west), with the arc length at each vertex — the boat race
// runs along it and the moored boat waits on it
const RX=RIO.x,RZ=RIO.z,RY=RIO.y,RS=RIO.s;
export const RIVER_LEN=RIO.len;
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
