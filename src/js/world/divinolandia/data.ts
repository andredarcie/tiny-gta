// Divinolândia (SP) — the real town, baked from OpenStreetMap + SRTM by
// tools/bake-divinolandia.ts into src/data/divinolandia.json (sources and method in
// docs/divinolandia/README.md).
//
// PURE module (no THREE, no DOM): decodes the baked heightfields and answers "how high
// is the ground here" for both the physics and the terrain mesh, so what you drive on
// is exactly what is drawn — same triangles, same diagonal (see triH below).
//
// Coordinates: the bake works in LOCAL metres centred on the Igreja Matriz (x = east,
// z = south, 1:1 real scale). In the game world the whole town is shifted by
// (DIV_OX, DIV_OZ) so it lives far away from the old map (whose content, interiors
// included, stays within |x| < 1000). y = real altitude − data.ref.
import data from '../../../data/divinolandia.json';
import {DIVINO_X_MIN,setDivinoTerrain} from '@/core/terrain.ts';
import {SITE_TABLE,SITE_PAD,SITE_BLEND,SQUARES,SQUARE_BLEND,type SiteId,type SiteSpec} from './sites-table.ts';

export const DIV_OX=5000, DIV_OZ=5000;
// Anything east of DIVINO_X_MIN (terrain.ts) is Divinolândia (the old map never reaches it).
export const DIV_X_MIN=DIVINO_X_MIN;
export const divData=data;

export type Grid={x0:number;z0:number;cell:number;nx:number;nz:number;h:Float32Array;fine?:{n:number;at:(i:number,j:number)=>boolean}};
function decode(g:{x0:number;z0:number;cell:number;nx:number;nz:number;h:string}):Grid{
  const bin=atobCompat(g.h);
  const u=new Uint16Array(bin.length/2);
  for(let i=0;i<u.length;i++)u[i]=bin.charCodeAt(2*i)|(bin.charCodeAt(2*i+1)<<8);
  const h=new Float32Array(u.length);
  for(let i=0;i<u.length;i++)h[i]=u[i]/20;
  return{x0:g.x0+DIV_OX,z0:g.z0+DIV_OZ,cell:g.cell,nx:g.nx,nz:g.nz,h};
}
// atob exists in browsers and Node ≥16; fall back to Buffer for older tooling.
function atobCompat(s:string):string{
  if(typeof atob==='function')return atob(s);
  return (globalThis as unknown as {Buffer:{from(a:string,b:string):{toString(e:string):string}}}).Buffer.from(s,'base64').toString('latin1');
}
export const nearGrid=decode(data.near);
export const farGrid=decode(data.far);

// Height inside one grid cell, on the SAME two triangles the mesh draws:
// corners a=(i,j) b=(i+1,j) c=(i,j+1) d=(i+1,j+1), diagonal b–c.
export function triH(g:Grid,x:number,z:number):number{
  let fx=(x-g.x0)/g.cell,fz=(z-g.z0)/g.cell;
  if(fx<0)fx=0;else if(fx>g.nx-1.0001)fx=g.nx-1.0001;
  if(fz<0)fz=0;else if(fz>g.nz-1.0001)fz=g.nz-1.0001;
  const i=fx|0,j=fz|0,u=fx-i,v=fz-j,n=g.nx,H=g.h;
  const a=H[j*n+i],b=H[j*n+i+1],c=H[(j+1)*n+i],d=H[(j+1)*n+i+1];
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
const NEAR_X1=nearGrid.x0+(nearGrid.nx-1)*nearGrid.cell, NEAR_Z1=nearGrid.z0+(nearGrid.nz-1)*nearGrid.cell;
export const inNearGrid=(x:number,z:number):boolean=>x>=nearGrid.x0&&x<=NEAR_X1&&z>=nearGrid.z0&&z<=NEAR_Z1;
// ---- street grading (cut and fill) ----
// The raw relief (SRTM resampled to 8 m) is noisy at street scale: draped on it, a street
// tilts sideways across hillsides and kinks at every facet, so cars lurch and sink into it.
// Real streets are GRADED: a smooth profile along the centreline and a level cross-section,
// with the slope cut or filled back into the hillside on both sides (the road-generation
// literature carves the terrain along the path the same way — Galin et al., "Procedural
// Generation of Roads", Computer Graphics Forum 2010; city builders and road tools level
// their roads across the same way). Done right in the heightfield, before anything reads
// it, so the drawn terrain, the draped streets, the physics and every placement agree.
//   1. each street is resampled every ≤4 m and its centreline heights smoothed along the
//      way (Gaussian, σ = 10 m: removes the facet noise, keeps the real hills);
//   2. at every junction the streets that meet share ONE height (the mean of their
//      smoothed heights there), each profile bent to pass through it;
//   3. every grid node near a street takes the street's height at its projection — fully
//      across the roadway and sidewalks (level cross-section), easing back to the natural
//      ground over ROAD_BLEND m (the cut/fill banks). Nodes reached by several streets
//      blend their heights continuously (no seams at junctions or between close streets).
export const ROAD_BLEND=8;
// grid nodes under a roadway (and its sidewalks) → their graded height; re-asserted after
// the place pads below, so a levelled lot never dents the street in front of it
const ROADWAY=new Map<number,number>();

const SHOULDER_PAVED=2.4,SHOULDER_DIRT=.8,GRADE_STEP=4,GRADE_SIGMA=10;
{
  const g=nearGrid,src=new Float32Array(g.h);
  const srcH=(px:number,pz:number):number=>triH({...g,h:src},px,pz);
  const jkey=(x:number,z:number):string=>Math.round(x*10)+','+Math.round(z*10);
  const uses=new Map<string,number>();
  for(const r of data.roads)for(const p of r.pts){const k=jkey(p[0],p[1]);uses.set(k,(uses.get(k)||0)+1);}
  interface Prof{x:Float64Array;z:Float64Array;s:Float64Array;h:Float64Array;junction:(string|null)[];core:number}
  const profs:Prof[]=[];
  for(const r of data.roads){
    if(r.pts.length<2)continue;
    const xs:number[]=[],zs:number[]=[],ss:number[]=[],js:(string|null)[]=[];
    let s=0;
    for(let i=0;i<r.pts.length;i++){
      const x=r.pts[i][0]+DIV_OX,z=r.pts[i][1]+DIV_OZ;
      if(i>0){
        const px=xs[xs.length-1],pz=zs[zs.length-1],len=Math.hypot(x-px,z-pz);
        if(len<.05)continue;
        const n=Math.ceil(len/GRADE_STEP);
        for(let k=1;k<n;k++){xs.push(px+(x-px)*k/n);zs.push(pz+(z-pz)*k/n);ss.push(s+len*k/n);js.push(null);}
        s+=len;
      }
      xs.push(x);zs.push(z);ss.push(s);
      const k=jkey(r.pts[i][0],r.pts[i][1]);js.push((uses.get(k)||0)>=2?k:null);
    }
    if(xs.length<2)continue;
    const raw=xs.map((x,i)=>srcH(x,zs[i]));
    // Gaussian smoothing along the arc length
    const h=new Float64Array(raw.length);
    for(let i=0;i<raw.length;i++){
      let sw=0,sh=0;
      for(let k=i;k>=0&&ss[i]-ss[k]<3*GRADE_SIGMA;k--){const w=Math.exp(-((ss[i]-ss[k])**2)/(2*GRADE_SIGMA**2));sw+=w;sh+=w*raw[k];}
      for(let k=i+1;k<raw.length&&ss[k]-ss[i]<3*GRADE_SIGMA;k++){const w=Math.exp(-((ss[k]-ss[i])**2)/(2*GRADE_SIGMA**2));sw+=w;sh+=w*raw[k];}
      h[i]=sh/sw;
    }
    profs.push({x:new Float64Array(xs),z:new Float64Array(zs),s:new Float64Array(ss),h,junction:js,core:r.hw+(r.p?SHOULDER_PAVED:SHOULDER_DIRT)});
  }
  // one height per junction, and every profile bent (piecewise linearly) to pass through it
  const jsum=new Map<string,{s:number;n:number}>();
  for(const p of profs)p.junction.forEach((k,i)=>{if(!k)return;const a=jsum.get(k)||{s:0,n:0};a.s+=p.h[i];a.n++;jsum.set(k,a);});
  for(const p of profs){
    const idx:number[]=[],dv:number[]=[];
    p.junction.forEach((k,i)=>{if(k){const a=jsum.get(k)!;idx.push(i);dv.push(a.s/a.n-p.h[i]);}});
    if(!idx.length)continue;
    for(let i=0;i<p.h.length;i++){
      let d:number;
      if(i<=idx[0])d=dv[0];else if(i>=idx[idx.length-1])d=dv[dv.length-1];
      else{let m=0;while(idx[m+1]<i)m++;const t=(p.s[i]-p.s[idx[m]])/(p.s[idx[m+1]]-p.s[idx[m]]);d=dv[m]+(dv[m+1]-dv[m])*t;}
      p.h[i]+=d;
    }
  }
  // stamp into the grid: weight 1 at the road's edge rising inside it (so its own street
  // dominates), falling smoothly to 0 across the bank; heights blended by weight
  const N=g.nx*g.nz,sumW=new Float32Array(N),sumWH=new Float32Array(N);
  // the river and streams keep their natural channel and banks (a street running beside
  // the water must not fill it in): nodes within a water's half-width + 1.5 m are left alone
  const wet=new Uint8Array(N);
  for(const wt of data.waters){
    const reachW=((wt as {hw?:number}).hw??3)+1.5;
    for(let i=1;i<wt.pts.length;i++){
      const ax=wt.pts[i-1][0]+DIV_OX,az=wt.pts[i-1][1]+DIV_OZ,bx=wt.pts[i][0]+DIV_OX,bz=wt.pts[i][1]+DIV_OZ;
      const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;
      const i0=Math.max(0,Math.floor((Math.min(ax,bx)-reachW-g.x0)/g.cell)),i1=Math.min(g.nx-1,Math.ceil((Math.max(ax,bx)+reachW-g.x0)/g.cell));
      const j0=Math.max(0,Math.floor((Math.min(az,bz)-reachW-g.z0)/g.cell)),j1=Math.min(g.nz-1,Math.ceil((Math.max(az,bz)+reachW-g.z0)/g.cell));
      for(let j=j0;j<=j1;j++)for(let ii=i0;ii<=i1;ii++){
        const nx=g.x0+ii*g.cell,nz=g.z0+j*g.cell;
        let t=((nx-ax)*dx+(nz-az)*dz)/l2;t=t<0?0:t>1?1:t;
        if(Math.hypot(nx-ax-dx*t,nz-az-dz*t)<reachW)wet[j*g.nx+ii]=1;
      }
    }
  }
  const R=ROAD_BLEND;
  for(const p of profs){
    const core=p.core;
    for(let i=1;i<p.x.length;i++){
      const ax=p.x[i-1],az=p.z[i-1],bx=p.x[i],bz=p.z[i],ha=p.h[i-1],hb=p.h[i];
      const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz;if(l2<1e-6)continue;
      const reach=core+R;
      const i0=Math.max(0,Math.floor((Math.min(ax,bx)-reach-g.x0)/g.cell)),i1=Math.min(g.nx-1,Math.ceil((Math.max(ax,bx)+reach-g.x0)/g.cell));
      const j0=Math.max(0,Math.floor((Math.min(az,bz)-reach-g.z0)/g.cell)),j1=Math.min(g.nz-1,Math.ceil((Math.max(az,bz)+reach-g.z0)/g.cell));
      for(let j=j0;j<=j1;j++)for(let ii=i0;ii<=i1;ii++){
        const nx=g.x0+ii*g.cell,nz=g.z0+j*g.cell;
        let t=((nx-ax)*dx+(nz-az)*dz)/l2;
        t=t<0?0:t>1?1:t;                                     // (a node by a bend counts for both segments: same height there)
        const d=Math.hypot(nx-ax-dx*t,nz-az-dz*t);
        if(d>=reach)continue;
        let w:number;
        if(d<=core)w=1+8*(1-d/core);
        else{const q=(d-core)/R,k=q*q*(3-2*q);w=1-k;}
        const k0=j*g.nx+ii;sumW[k0]+=w;sumWH[k0]+=w*(ha+(hb-ha)*t);
      }
    }
  }
  for(let k=0;k<N;k++){
    const w=sumW[k];if(w<=0||(wet[k]&&w<1))continue;        // the roadway itself is graded even over a stream
    const target=sumWH[k]/w;
    g.h[k]=w>=1?target:g.h[k]+(target-g.h[k])*w;
    if(w>=1)ROADWAY.set(k,g.h[k]);
  }
}

// ---- level pads under the game's places (sites-table.ts) ----
// Each site's footprint is flattened to its mean ground height and blended back into
// the natural slope, straight in the heightfield — so the terrain mesh, the physics and
// every groundHeight() read agree on the pad. SITE_FLOOR is that height (world y).
export const SITE_FLOOR={} as Record<SiteId,number>;
// grid nodes a place pad or a square shaped (the river channel below leaves them alone)
const PAD_NODES=new Set<number>();
// ---- the Matriz squares (sites-table.ts SQUARES): each block's ground becomes the surface
// spanned by the street beds round it (a Coons patch over the heights sampled along the four
// streets just outside its edges), blended back over SQUARE_BLEND m — so the sidewalks meet
// the streets all the way round. Before the site pads: the church terrace levels on top ----
{
  const g=nearGrid,src=new Float32Array(g.h),N=24,OUT=4.5;
  const srcH=(px:number,pz:number):number=>triH({...g,h:src},px,pz);
  for(const sq of Object.values(SQUARES)){
    const x=sq.x+DIV_OX,z=sq.z+DIV_OZ,c=Math.cos(sq.rot),s=Math.sin(sq.rot);
    const wp=(u:number,v:number):[number,number]=>[x+u*c-v*s,z+u*s+v*c];
    // street heights along each edge (t = 0..1), lightly smoothed
    const edge=(f:(t:number)=>[number,number]):number[]=>{
      const raw=Array.from({length:N+1},(_,k)=>{const[u,v]=f(k/N);return srcH(...wp(u,v));});
      return raw.map((_,k)=>(raw[Math.max(0,k-1)]+2*raw[k]+raw[Math.min(N,k+1)])/4);
    };
    const nE=edge(t=>[sq.u0+t*(sq.u1-sq.u0),sq.v0-OUT]),sE=edge(t=>[sq.u0+t*(sq.u1-sq.u0),sq.v1+OUT]);
    const wE=edge(t=>[sq.u0-OUT,sq.v0+t*(sq.v1-sq.v0)]),eE=edge(t=>[sq.u1+OUT,sq.v0+t*(sq.v1-sq.v0)]);
    const at=(arr:number[],t:number):number=>{const f=Math.min(N,Math.max(0,t*N)),k=Math.min(N-1,Math.floor(f));return arr[k]+(arr[k+1]-arr[k])*(f-k);};
    const c00=(nE[0]+wE[0])/2,c10=(nE[N]+eE[0])/2,c01=(sE[0]+wE[N])/2,c11=(sE[N]+eE[N])/2;
    const patch=(u:number,v:number):number=>{
      const a=Math.min(1,Math.max(0,(u-sq.u0)/(sq.u1-sq.u0))),b=Math.min(1,Math.max(0,(v-sq.v0)/(sq.v1-sq.v0)));
      return(1-b)*at(nE,a)+b*at(sE,a)+(1-a)*at(wE,b)+a*at(eE,b)
        -(c00*(1-a)*(1-b)+c10*a*(1-b)+c01*(1-a)*b+c11*a*b);
    };
    const R=Math.hypot(sq.u1-sq.u0,sq.v1-sq.v0)/2+SQUARE_BLEND+8,[ccx,ccz]=wp((sq.u0+sq.u1)/2,(sq.v0+sq.v1)/2);
    const i0=Math.max(0,Math.floor((ccx-R-g.x0)/g.cell)),i1=Math.min(g.nx-1,Math.ceil((ccx+R-g.x0)/g.cell));
    const j0=Math.max(0,Math.floor((ccz-R-g.z0)/g.cell)),j1=Math.min(g.nz-1,Math.ceil((ccz+R-g.z0)/g.cell));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const dx=g.x0+i*g.cell-x,dz=g.z0+j*g.cell-z,u=dx*c+dz*s,v=-dx*s+dz*c;
      const d=Math.hypot(Math.max(sq.u0-u,0,u-sq.u1),Math.max(sq.v0-v,0,v-sq.v1));
      if(d>=SQUARE_BLEND)continue;
      const t=d/SQUARE_BLEND,k=t*t*(3-2*t),k0=j*g.nx+i,p=patch(u,v);g.h[k0]=p+(g.h[k0]-p)*k;
      PAD_NODES.add(k0);
      ROADWAY.delete(k0);
    }
  }
}
{
  const g=nearGrid;
  for(const id of Object.keys(SITE_TABLE) as SiteId[]){
    const s:SiteSpec=SITE_TABLE[id],x=s.x+DIV_OX,z=s.z+DIV_OZ,blend=s.blend??SITE_BLEND,pad=s.pad??SITE_PAD;
    const fx=Math.sin(s.face),fz=Math.cos(s.face);         // toward the street (depth axis)
    const ux=fz,uz=-fx;                                     // along the facade
    let sum=0,n=0;
    for(let a=-1;a<=1;a+=.25)for(let b=-1;b<=1;b+=.25){sum+=triH(g,x+ux*a*s.w/2+fx*b*s.d/2,z+uz*a*s.w/2+fz*b*s.d/2);n++;}
    const floor=sum/n;SITE_FLOOR[id]=floor;
    const R=Math.hypot(s.w,s.d)/2+pad+blend;
    const i0=Math.max(0,Math.floor((x-R-g.x0)/g.cell)),i1=Math.min(g.nx-1,Math.ceil((x+R-g.x0)/g.cell));
    const j0=Math.max(0,Math.floor((z-R-g.z0)/g.cell)),j1=Math.min(g.nz-1,Math.ceil((z+R-g.z0)/g.cell));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const dx=g.x0+i*g.cell-x,dz=g.z0+j*g.cell-z;
      const u=Math.abs(dx*ux+dz*uz)-s.w/2,v=Math.abs(dx*fx+dz*fz)-s.d/2;
      const d=Math.hypot(Math.max(u,0),Math.max(v,0));
      if(d>=pad+blend)continue;
      const t=d<=pad?0:(d-pad)/blend,k=t*t*(3-2*t);
      const k0=j*g.nx+i;g.h[k0]=floor+(g.h[k0]-floor)*k;
      if(d<=pad+g.cell){ROADWAY.delete(k0);PAD_NODES.add(k0);}   // the lot's flat floor (and the triangles reaching it) stays flat
    }
  }
}

// the streets win over the place pads (a pad's blend reaching into the road would dent it)
for(const[k,h]of ROADWAY)nearGrid.h[k]=h;

// ---- the Rio do Peixe: one continuous, navigable river, bridged where streets cross ----
// The bake carves each watercourse as a narrow channel in the 8 m heightfield, which leaves
// the river a string of puddles: a 12 m river spans barely more than one cell, so its bed
// ends up too shallow or off its centre line, and every street crosses it on a solid
// embankment. Here the main course becomes a real river:
//   - its centre line (RIO) smoothed (σ 6 m) and pushed clear of the streets that run beside
//     it, its surface running steadily downhill, 8.5–12 m of water up to 2 m deep;
//   - the ground of every grid cell along it (the CORRIDOR, out to RIO_EDGE beyond the water)
//     is a finer 2 m relief (RIO_FINE, 5×5 nodes per 8 m cell) shaped by the river's own
//     profile: a U-shaped bed, a muddy bank, then the bank rising to meet the natural ground
//     (exactly the grid's own at the corridor's edge, so the cells around it join seamlessly;
//     streets and the places' pads near it keep their ground). The physics reads the same
//     2 m triangles the terrain mesh draws (fineH);
//   - where a street crosses it, a BRIDGE (RIO_BRIDGES): a deck at the street's height, at
//     least RIO_CLEAR above the water (the low crossings get ramps), the river open beneath.
//     The deck is part of divinoHeight (cars and feet rest on it, streets drape over it) but
//     not of bedHeight, which the water reads (water.ts), so boats pass under.
export interface RioLine{x:Float64Array;z:Float64Array;y:Float64Array;s:Float64Array;w:Float64Array;len:number}
export interface RioBridge{cx:number;cz:number;ux:number;uz:number;L:number;hw:number;y0:number;y1:number;name:string;s:number;road:number;far:[number,number];core:number}
export const RIO_DEPTH=1.95,RIO_CLEAR=3.3,RIO_BANK=2,RIO_EDGE=14;
const RIO_SIGMA=6,RIO_RAMP=24,RIO_VC=10,FN=5;                          // FN: fine nodes per cell side (2 m)
// half width of the water at arc s (8.5–12 m wide, varying along the course: the river is
// narrow, deep in its bed, in every panorama from its bridges)
export const rioHalfWidth=(s:number):number=>Math.max(4.25,Math.min(6,5.1+.6*Math.sin(s/83)+.35*Math.sin(s/37+1.3)));
const smoothArc=(v:ArrayLike<number>,S:ArrayLike<number>,sig:number):Float64Array=>{
  const n=v.length,o=new Float64Array(n);
  for(let i=0;i<n;i++){
    let sw=0,sv=0;
    for(let k=i;k>=0&&S[i]-S[k]<3*sig;k--){const w=Math.exp(-((S[i]-S[k])**2)/(2*sig*sig));sw+=w;sv+=w*v[k];}
    for(let k=i+1;k<n&&S[k]-S[i]<3*sig;k++){const w=Math.exp(-((S[k]-S[i])**2)/(2*sig*sig));sw+=w;sv+=w*v[k];}
    o[i]=sv/sw;
  }
  return o;
};
// the roadways (with their shoulders) as segments in a coarse hash
type RSeg={ax:number;az:number;bx:number;bz:number;r:number;road:number};
const RIO_RSEGS:RSeg[]=[];
data.roads.forEach((rd,ri)=>{for(let i=1;i<rd.pts.length;i++)RIO_RSEGS.push({ax:rd.pts[i-1][0]+DIV_OX,az:rd.pts[i-1][1]+DIV_OZ,bx:rd.pts[i][0]+DIV_OX,bz:rd.pts[i][1]+DIV_OZ,r:rd.hw+(rd.p?SHOULDER_PAVED:SHOULDER_DIRT),road:ri});});
const RC2=32,rhk=(a:number,b:number):number=>a*92821^b*68917,RHASH=new Map<number,RSeg[]>();
for(const g of RIO_RSEGS){const m=g.r+30;
  for(let a=Math.floor((Math.min(g.ax,g.bx)-m)/RC2);a<=Math.floor((Math.max(g.ax,g.bx)+m)/RC2);a++)
    for(let b=Math.floor((Math.min(g.az,g.bz)-m)/RC2);b<=Math.floor((Math.max(g.az,g.bz)+m)/RC2);b++){const k=rhk(a,b);let arr=RHASH.get(k);if(!arr){arr=[];RHASH.set(k,arr);}arr.push(g);}}
const segDist=(x:number,z:number,g:RSeg):[number,number,number]=>{
  const dx=g.bx-g.ax,dz=g.bz-g.az,l2=dx*dx+dz*dz||1;let t=((x-g.ax)*dx+(z-g.az)*dz)/l2;t=t<0?0:t>1?1:t;
  const ex=x-g.ax-dx*t,ez=z-g.az-dz*t;return[Math.hypot(ex,ez),ex,ez];
};
// indices k (segments k-1..k) of a polyline near a box, from a coarse hash
function polyHash(x:ArrayLike<number>,z:ArrayLike<number>,C=32):(x0:number,x1:number,z0:number,z1:number)=>Set<number>{
  const H=new Map<number,number[]>();
  for(let k=1;k<x.length;k++)
    for(let a=Math.floor(Math.min(x[k-1],x[k])/C);a<=Math.floor(Math.max(x[k-1],x[k])/C);a++)
      for(let b=Math.floor(Math.min(z[k-1],z[k])/C);b<=Math.floor(Math.max(z[k-1],z[k])/C);b++){const q=rhk(a,b);let arr=H.get(q);if(!arr){arr=[];H.set(q,arr);}arr.push(k);}
  return(x0,x1,z0,z1)=>{
    const out=new Set<number>();
    for(let a=Math.floor(x0/C);a<=Math.floor(x1/C);a++)for(let b=Math.floor(z0/C);b<=Math.floor(z1/C);b++)for(const k of H.get(rhk(a,b))||[])out.add(k);
    return out;
  };
}
export const RIO:RioLine=(()=>{
  const src=data.waters.filter(w=>w.name==='Rio do Peixe').sort((a,b)=>b.pts.length-a.pts.length)[0]?.pts??[];
  const X:number[]=[],Z:number[]=[],Y:number[]=[];
  for(let k=0;k<src.length;k++){
    const b=[src[k][0]+DIV_OX,src[k][1]+DIV_OZ,src[k][2]];
    if(!k){X.push(b[0]);Z.push(b[1]);Y.push(b[2]);continue;}
    const a=[X[X.length-1],Z[Z.length-1],Y[Y.length-1]],n=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    for(let q=1;q<=n;q++){const t=q/n;X.push(a[0]+(b[0]-a[0])*t);Z.push(a[1]+(b[1]-a[1])*t);Y.push(a[2]+(b[2]-a[2])*t);}
  }
  const n=X.length,S0=new Float64Array(n);
  for(let i=1;i<n;i++)S0[i]=S0[i-1]+Math.hypot(X[i]-X[i-1],Z[i]-Z[i-1]);
  let x=smoothArc(X,S0,RIO_SIGMA),z=smoothArc(Z,S0,RIO_SIGMA);const y=smoothArc(Y,S0,20);
  // push the line off the streets running beside it (not those crossing it, near the crossing)
  const crossings:{x:number;z:number;road:number}[]=[],near0=polyHash(x,z);
  for(const g of RIO_RSEGS)for(const k of near0(Math.min(g.ax,g.bx),Math.max(g.ax,g.bx),Math.min(g.az,g.bz),Math.max(g.az,g.bz))){
    const rx=g.bx-g.ax,rz=g.bz-g.az,qx=x[k]-x[k-1],qz=z[k]-z[k-1],den=rx*qz-rz*qx;if(Math.abs(den)<1e-9)continue;
    const t=((x[k-1]-g.ax)*qz-(z[k-1]-g.az)*qx)/den,u=((x[k-1]-g.ax)*rz-(z[k-1]-g.az)*rx)/den;
    if(t>=0&&t<=1&&u>=0&&u<=1)crossings.push({x:g.ax+rx*t,z:g.az+rz*t,road:g.road});
  }
  for(let it=0;it<5;it++){
    const px=new Float64Array(n),pz=new Float64Array(n);let s0=0;
    for(let i=0;i<n;i++){
      if(i)s0+=Math.hypot(x[i]-x[i-1],z[i]-z[i-1]);
      const need=rioHalfWidth(s0)+RIO_BANK+3;
      let mx=0,mz=0;
      for(const g of RHASH.get(rhk(Math.floor(x[i]/RC2),Math.floor(z[i]/RC2)))||[]){
        if(crossings.some(c=>c.road===g.road&&Math.hypot(c.x-x[i],c.z-z[i])<45))continue;
        const[d,ex,ez]=segDist(x[i],z[i],g),gap=need+g.r-d;
        if(gap>0&&d>1e-6){mx+=ex/d*gap;mz+=ez/d*gap;}
      }
      // ... and off the places' levelled lots (their floor is kept too)
      for(const st of Object.values(SITE_TABLE) as SiteSpec[]){
        const sx=st.x+DIV_OX,sz=st.z+DIV_OZ,ex=x[i]-sx,ez=z[i]-sz;
        if(Math.abs(ex)>200||Math.abs(ez)>200)continue;
        const fx=Math.sin(st.face),fz=Math.cos(st.face),ux=fz,uz=-fx,pad=(st.pad??SITE_PAD)+8;
        const u=ex*ux+ez*uz,v=ex*fx+ez*fz,cu=Math.max(-st.w/2-pad,Math.min(st.w/2+pad,u)),cv=Math.max(-st.d/2-pad,Math.min(st.d/2+pad,v));
        const du=u-cu,dv=v-cv,d=Math.hypot(du,dv),gap=need-d;
        if(gap>0&&d>1e-6){const wx=(du*ux+dv*fx)/d,wz=(du*uz+dv*fz)/d;mx+=wx*gap;mz+=wz*gap;}
      }
      px[i]=mx;pz[i]=mz;
    }
    const sx=smoothArc(px,S0,RIO_SIGMA*2),sz=smoothArc(pz,S0,RIO_SIGMA*2);
    for(let i=0;i<n;i++){x[i]+=sx[i]*.8;z[i]+=sz[i]*.8;}
    x=smoothArc(x,S0,RIO_SIGMA/2);z=smoothArc(z,S0,RIO_SIGMA/2);
  }
  for(let i=1;i<n;i++)if(y[i]>y[i-1])y[i]=y[i-1];                // always downhill (index 0 = upstream)
  const s=new Float64Array(n),w=new Float64Array(n);
  for(let i=1;i<n;i++)s[i]=s[i-1]+Math.hypot(x[i]-x[i-1],z[i]-z[i-1]);
  for(let i=0;i<n;i++)w[i]=rioHalfWidth(s[i]);
  return{x,z,y,s,w,len:n?s[n-1]:0};
})();
// nearest point of the river centre line: distance, surface y, half width, arc
const RIO_HC=24,RIO_HASH=new Map<number,number[]>();
{
  const R=RIO,m=7.1+RIO_BANK+RIO_EDGE+8;
  for(let i=1;i<R.x.length;i++)
    for(let a=Math.floor((Math.min(R.x[i-1],R.x[i])-m)/RIO_HC);a<=Math.floor((Math.max(R.x[i-1],R.x[i])+m)/RIO_HC);a++)
      for(let b=Math.floor((Math.min(R.z[i-1],R.z[i])-m)/RIO_HC);b<=Math.floor((Math.max(R.z[i-1],R.z[i])+m)/RIO_HC);b++){
        const k=rhk(a,b);let arr=RIO_HASH.get(k);if(!arr){arr=[];RIO_HASH.set(k,arr);}arr.push(i);
      }
}
export function rioNearest(x:number,z:number):{d:number;y:number;w:number;s:number}|null{
  const a=RIO_HASH.get(rhk(Math.floor(x/RIO_HC),Math.floor(z/RIO_HC)));if(!a)return null;
  const R=RIO;let bd=1e9,bi=-1,bt=0;
  for(const i of a){
    const ax=R.x[i-1],az=R.z[i-1],dx=R.x[i]-ax,dz=R.z[i]-az,l2=dx*dx+dz*dz||1;
    let t=((x-ax)*dx+(z-az)*dz)/l2;t=t<0?0:t>1?1:t;
    const d=Math.hypot(x-ax-dx*t,z-az-dz*t);if(d<bd){bd=d;bi=i;bt=t;}
  }
  if(bi<0)return null;
  return{d:bd,y:R.y[bi-1]+(R.y[bi]-R.y[bi-1])*bt,w:R.w[bi-1]+(R.w[bi]-R.w[bi-1])*bt,s:R.s[bi-1]+(R.s[bi]-R.s[bi-1])*bt};
}
export const RIO_BRIDGES:RioBridge[]=[];
{
  const g=nearGrid,R=RIO,n=R.x.length;
  const at=(s:number):{dx:number;dz:number;y:number;w:number}=>{
    let lo=0,hi=n-1;while(hi-lo>1){const m=(lo+hi)>>1;if(R.s[m]<=s)lo=m;else hi=m;}
    const l=R.s[hi]-R.s[lo]||1,t=(s-R.s[lo])/l;
    return{dx:(R.x[hi]-R.x[lo])/l,dz:(R.z[hi]-R.z[lo])/l,y:R.y[lo]+(R.y[hi]-R.y[lo])*t,w:R.w[lo]+(R.w[hi]-R.w[lo])*t};
  };
  const nearR=polyHash(R.x,R.z);
  (n>1?data.roads:[]).forEach((rd,ri)=>{
    const P=rd.pts.map(p=>[p[0]+DIV_OX,p[1]+DIV_OZ]);
    for(let i=1;i<P.length;i++){
      const a=P[i-1],b=P[i],rx=b[0]-a[0],rz=b[1]-a[1];
      for(const k of nearR(Math.min(a[0],b[0]),Math.max(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[1],b[1]))){
        const qx=R.x[k]-R.x[k-1],qz=R.z[k]-R.z[k-1],den=rx*qz-rz*qx;if(Math.abs(den)<1e-9)continue;
        const t=((R.x[k-1]-a[0])*qz-(R.z[k-1]-a[1])*qx)/den,u=((R.x[k-1]-a[0])*rz-(R.z[k-1]-a[1])*rx)/den;
        if(t<0||t>1||u<0||u>1)continue;
        const cx=a[0]+rx*t,cz=a[1]+rz*t,len=Math.hypot(rx,rz)||1,ux=rx/len,uz=rz/len;
        const sAt=R.s[k-1]+u*Math.hypot(qx,qz),rv=at(sAt),sinA=Math.max(.5,Math.abs(ux*rv.dz-uz*rv.dx));
        const L=(rv.w+RIO_BANK+3)/sinA,hw=rd.hw+3.4;            // (the deck carries the sidewalks and verges too)
        const hA=triH(g,cx-ux*(L+3),cz-uz*(L+3)),hB=triH(g,cx+ux*(L+3),cz+uz*(L+3));
        const y0=Math.max(hA,rv.y+RIO_CLEAR),y1=Math.max(hB,rv.y+RIO_CLEAR);
        // ramps: a low street rises to the deck over RIO_RAMP m on each side — along the
        // bridge's axis (the street often goes on as another OSM way past the bridge)
        const core=rd.hw+(rd.p?SHOULDER_PAVED:SHOULDER_DIRT),reach=core+ROAD_BLEND,ext=L+RIO_RAMP+reach;
        const i0=Math.max(0,Math.floor((cx-ext-g.x0)/g.cell)),i1=Math.min(g.nx-1,Math.ceil((cx+ext-g.x0)/g.cell));
        const j0=Math.max(0,Math.floor((cz-ext-g.z0)/g.cell)),j1=Math.min(g.nz-1,Math.ceil((cz+ext-g.z0)/g.cell));
        // (the street from the deck's end runs smoothly to its own height RIO_RAMP m further)
        const far:[number,number]=[triH(g,cx-ux*(L+RIO_RAMP),cz-uz*(L+RIO_RAMP)),triH(g,cx+ux*(L+RIO_RAMP),cz+uz*(L+RIO_RAMP))];
        RIO_BRIDGES.push({cx,cz,ux,uz,L,hw,y0,y1,name:rd.n||'',s:sAt,road:ri,far,core});
        const edits:[number,number][]=[];
        for(let j=j0;j<=j1;j++)for(let ii=i0;ii<=i1;ii++){
          const ex=g.x0+ii*g.cell-cx,ez=g.z0+j*g.cell-cz,along=ex*ux+ez*uz,d=Math.abs(-ex*uz+ez*ux),arc=Math.abs(along);
          if(d>=reach||arc<L-4||arc>L+RIO_RAMP)continue;
          const target=rioRamp(arc-L,along<0?y0:y1,far[along<0?0:1]),lat=d<=core?1:1-((d-core)/ROAD_BLEND)**2,k0=j*g.nx+ii;
          edits.push([k0,g.h[k0]+(target-g.h[k0])*lat]);
        }
        for(const[k0,h]of edits){g.h[k0]=h;if(ROADWAY.has(k0))ROADWAY.set(k0,h);}
      }
    }
  });
}
// The corridor's fine relief. RIO_FINE_AT[cell] = index into RIO_FINE (−1 off the corridor);
// each entry holds FN×FN heights (row-major, z then x) and a wetness 0..1 for the colour.
export const RIO_FN=FN;
export const RIO_FINE_AT=new Int32Array((nearGrid.nx-1)*(nearGrid.nz-1)).fill(-1);
export const RIO_FINE:{h:Float32Array;wet:Float32Array}[]=[];
{
  const g=nearGrid,src=new Float32Array(g.h),srcG={...g,h:src},srcH=(px:number,pz:number):number=>triH(srcG,px,pz);
  const half=g.cell*Math.SQRT1_2,sub=g.cell/(FN-1);
  // per cell, the candidates its 25 sub-nodes need: river segments and streets near it
  let candR:number[]=[],candS:RSeg[]=[];
  const nearestR=(x:number,z:number):{d:number;y:number;w:number}|null=>{
    const R=RIO;let bd=1e9,bi=-1,bt=0;
    for(const i of candR){
      const ax=R.x[i-1],az=R.z[i-1],dx=R.x[i]-ax,dz=R.z[i]-az,l2=dx*dx+dz*dz||1;
      let t=((x-ax)*dx+(z-az)*dz)/l2;t=t<0?0:t>1?1:t;
      const d=Math.hypot(x-ax-dx*t,z-az-dz*t);if(d<bd){bd=d;bi=i;bt=t;}
    }
    return bi<0?null:{d:bd,y:R.y[bi-1]+(R.y[bi]-R.y[bi-1])*bt,w:R.w[bi-1]+(R.w[bi]-R.w[bi-1])*bt};
  };
  // how far a point lies from a street (its ground is kept)
  const keepW=(x:number,z:number):number=>{
    let w=0;
    // (around a bridge the river runs free: the bridged street and the pieces of street that
    // meet it at the deck are carried by the deck)
    for(const b of RIO_BRIDGES){const ex=x-b.cx,ez=z-b.cz;if(Math.abs(ex*b.ux+ez*b.uz)<b.L-3.5&&Math.abs(-ex*b.uz+ez*b.ux)<b.hw+10)return 0;}
    for(const s of candS){
      const dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz||1;let t=((x-s.ax)*dx+(z-s.az)*dz)/l2;t=t<0?0:t>1?1:t;
      const d=Math.hypot(x-s.ax-dx*t,z-s.az-dz*t)-s.r;if(d<6)w=Math.max(w,d<=0?1:1-d/6);
    }
    return w;
  };
  for(let j=0;j<g.nz-1;j++)for(let i=0;i<g.nx-1;i++){
    const cx=g.x0+(i+.5)*g.cell,cz=g.z0+(j+.5)*g.cell,r=rioNearest(cx,cz);
    if(!r||r.d-half>=r.w+RIO_BANK+RIO_EDGE)continue;
    // a place pad in the cell: leave the cell as it is
    if(PAD_NODES.has(j*g.nx+i)||PAD_NODES.has(j*g.nx+i+1)||PAD_NODES.has((j+1)*g.nx+i)||PAD_NODES.has((j+1)*g.nx+i+1))continue;
    {
      const R=RIO,lim=r.d+2*half+.5;
      candR=(RIO_HASH.get(rhk(Math.floor(cx/RIO_HC),Math.floor(cz/RIO_HC)))||[]).filter(i=>{
        const ax=R.x[i-1],az=R.z[i-1],dx=R.x[i]-ax,dz=R.z[i]-az,l2=dx*dx+dz*dz||1;
        let t=((cx-ax)*dx+(cz-az)*dz)/l2;t=t<0?0:t>1?1:t;return Math.hypot(cx-ax-dx*t,cz-az-dz*t)<=lim;
      });
      candS=(RHASH.get(rhk(Math.floor(cx/RC2),Math.floor(cz/RC2)))||[]).filter(sg=>segDist(cx,cz,sg)[0]-sg.r<6+half);
    }
    const h=new Float32Array(FN*FN),wet=new Float32Array(FN*FN);
    for(let b=0;b<FN;b++)for(let a=0;a<FN;a++){
      const x=g.x0+i*g.cell+a*sub,z=g.z0+j*g.cell+b*sub,q=nearestR(x,z),T=srcH(x,z);
      let y=T,wv=0;
      if(q&&q.d<q.w+RIO_BANK+RIO_EDGE){
        const W=q.w,d=q.d,top=q.y+1.3;                            // a steep muddy bank, ~1.3 m above the water
        let p:number;
        if(d<=W){const f=1-(d/W)**4;p=q.y-.25-(RIO_DEPTH-.25)*Math.sqrt(f);}   // a wide flat bed, steep at the sides
        else if(d<=W+RIO_BANK)p=q.y-.25+(top-q.y+.25)*(d-W)/RIO_BANK;
        else{const k=(d-W-RIO_BANK)/RIO_EDGE,e=k*k*(3-2*k);p=(top+(d-W-RIO_BANK)*.55)*(1-e)+T*e;}
        const keep=keepW(x,z);
        y=p+(T-p)*keep;
        // a bridge's approach: the street runs from the deck's end to its own height
        for(const br of RIO_BRIDGES){
          const ex=x-br.cx,ez=z-br.cz,along=ex*br.ux+ez*br.uz,arc=Math.abs(along),lat=Math.abs(-ex*br.uz+ez*br.ux);
          // (only across the street itself; past it the grid's ramped nodes rule, linear in each
          // grid triangle, so the streets meeting the ramp drape exactly on it)
          if(arc<br.L-3.5||arc>br.L+RIO_RAMP||lat>br.core+1.5)continue;   // (from 3.5 m under the deck: its abutment)
          y=rioRamp(arc-br.L,along<0?br.y0:br.y1,br.far[along<0?0:1]);
        }
        wv=Math.max(0,1-Math.max(0,d-W)/(RIO_BANK+2.5))*(1-keep);
      }
      h[b*FN+a]=y;wet[b*FN+a]=wv;
    }
    RIO_FINE_AT[j*(g.nx-1)+i]=RIO_FINE.length;RIO_FINE.push({h,wet});
  }
  // Seams: where a corridor cell meets an ordinary one (the corridor's edge, a place pad),
  // the ordinary cell's side is a straight line between two grid nodes — so the fine cell's
  // sub-nodes along that side follow the same line, and a node touching any ordinary cell
  // keeps its grid height. Only nodes surrounded by corridor cells take the fine relief.
  const CN=g.nx-1,isFine=(i:number,j:number):boolean=>i>=0&&j>=0&&i<CN&&j<g.nz-1&&RIO_FINE_AT[j*CN+i]>=0;
  const nodeFine=(i:number,j:number):boolean=>isFine(i-1,j-1)&&isFine(i,j-1)&&isFine(i-1,j)&&isFine(i,j);
  RIO_FINE_AT.forEach((f,c)=>{
    if(f<0)return;
    const i=c%CN,j=(c/CN)|0,H=RIO_FINE[f].h,W=RIO_FINE[f].wet;
    const n00=src[j*g.nx+i],n10=src[j*g.nx+i+1],n01=src[(j+1)*g.nx+i],n11=src[(j+1)*g.nx+i+1];
    const side=(k0:number,step:number,a:number,b:number):void=>{for(let t=0;t<FN;t++){H[k0+t*step]=a+(b-a)*t/(FN-1);W[k0+t*step]=0;}};
    if(!isFine(i,j-1))side(0,1,n00,n10);                         // north side (z = j)
    if(!isFine(i,j+1))side((FN-1)*FN,1,n01,n11);                // south side
    if(!isFine(i-1,j))side(0,FN,n00,n01);                        // west side (x = i)
    if(!isFine(i+1,j))side(FN-1,FN,n10,n11);                     // east side
    if(!nodeFine(i,j))H[0]=n00;
    if(!nodeFine(i+1,j))H[FN-1]=n10;
    if(!nodeFine(i,j+1))H[(FN-1)*FN]=n01;
    if(!nodeFine(i+1,j+1))H[FN*FN-1]=n11;
  });
  // the coarse nodes inside the corridor take the fine relief there too
  RIO_FINE_AT.forEach((f,c)=>{
    if(f<0)return;
    const i=c%CN,j=(c/CN)|0;
    if(nodeFine(i,j))g.h[j*g.nx+i]=RIO_FINE[f].h[0];
  });
  // what lies draped on the ground (streets, sidewalks, plazas) follows the fine relief there
  g.fine={n:FN,at:isFine};
}
// the corridor's cells for the terrain mesh (terreno.ts makeTerrainFine)
export const RIO_FINE_CELLS={n:FN,at:(i:number,j:number):{h:Float32Array;wet:Float32Array}|null=>{
  const f=i<0||j<0||i>=nearGrid.nx-1||j>=nearGrid.nz-1?-1:RIO_FINE_AT[j*(nearGrid.nx-1)+i];return f>=0?RIO_FINE[f]:null;
}};
// height on the fine relief of a corridor cell (2 m triangles, the same b–c diagonal), or
// null off the corridor
function fineH(x:number,z:number):number|null{
  const g=nearGrid,fx=(x-g.x0)/g.cell,fz=(z-g.z0)/g.cell;
  if(fx<0||fz<0||fx>=g.nx-1||fz>=g.nz-1)return null;
  const i=fx|0,j=fz|0,f=RIO_FINE_AT[j*(g.nx-1)+i];
  if(f<0)return null;
  const H=RIO_FINE[f].h,gx=(fx-i)*(FN-1),gz=(fz-j)*(FN-1);
  const a=Math.min(FN-2,gx|0),b=Math.min(FN-2,gz|0),u=gx-a,v=gz-b;
  const p=H[b*FN+a],q=H[b*FN+a+1],r=H[(b+1)*FN+a],s=H[(b+1)*FN+a+1];
  return u+v<=1?p+(q-p)*u+(r-p)*v:s+(r-s)*(1-u)+(q-s)*(1-v);
}
// The approach's height `u` m past the deck's end, from the deck's height `end` to the
// street's own `hf` at RIO_RAMP: a vertical curve (a parabola, RIO_VC m) out of the level
// deck into a constant grade — no crest for a car to jump and none for a draped street to
// sag under.
export function rioRamp(u:number,end:number,hf:number):number{
  const g=(hf-end)/(RIO_RAMP-RIO_VC/2);
  return u<=0?end:u<=RIO_VC?end+g*u*u/(2*RIO_VC):end+g*(RIO_VC/2+u-RIO_VC);
}
// the deck height over a bridge, or null off them
export function rioDeckAt(x:number,z:number):number|null{
  for(const b of RIO_BRIDGES){
    const ex=x-b.cx,ez=z-b.cz,a=ex*b.ux+ez*b.uz;
    if(a<-b.L||a>b.L)continue;                                // (the approach ramp takes over at its end)
    if(Math.abs(-ex*b.uz+ez*b.ux)>b.hw)continue;
    const t=Math.max(0,Math.min(1,(a+b.L)/(2*b.L)));
    return b.y0+(b.y1-b.y0)*t;
  }
  return null;
}

// Playable box: the near grid minus a margin (the far serras are scenery only). The east
// side keeps only 6 m: the town's east entrance (the Monumento ao Ciclista, x ≈ 1468..1492
// town-local) stands right by the edge of the baked grid.
export const PLAY={x0:nearGrid.x0+40,x1:NEAR_X1-6,z0:nearGrid.z0+40,z1:NEAR_Z1-40};

// Ground height in WORLD coordinates. Registered into groundHeight right here, as soon as
// the town data is decoded, so anything placed while the modules load (shop facades,
// palms, garages) already stands on the real relief.
export function divinoHeight(x:number,z:number):number{
  const h=bedHeight(x,z);
  if(!RIO_BRIDGES.length)return h;
  const deck=rioDeckAt(x,z);
  return deck!==null&&deck>h?deck:h;
}
// the drawn terrain alone (the river bed under a bridge, not its deck): what the water reads
export function bedHeight(x:number,z:number):number{
  if(!inNearGrid(x,z))return triH(farGrid,x,z);
  return fineH(x,z)??triH(nearGrid,x,z);
}
setDivinoTerrain(divinoHeight);
export const farHeight=(x:number,z:number):number=>triH(farGrid,x,z);

// local (baked) → world
export const W=(lx:number,lz:number):[number,number]=>[lx+DIV_OX,lz+DIV_OZ];
// real altitude (m above sea level) at a world point — for the HUD/signs
export const altitudeAt=(x:number,z:number):number=>divinoHeight(x,z)+data.ref;
