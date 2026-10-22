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

export type Grid={x0:number;z0:number;cell:number;nx:number;nz:number;h:Float32Array};
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
      if(d<=pad+g.cell)ROADWAY.delete(k0);                  // the lot's flat floor (and the triangles reaching it) stays flat
    }
  }
}

// the streets win over the place pads (a pad's blend reaching into the road would dent it)
for(const[k,h]of ROADWAY)nearGrid.h[k]=h;

// Playable box: the near grid minus a margin (the far serras are scenery only). The east
// side keeps only 6 m: the town's east entrance (the Monumento ao Ciclista, x ≈ 1468..1492
// town-local) stands right by the edge of the baked grid.
export const PLAY={x0:nearGrid.x0+40,x1:NEAR_X1-6,z0:nearGrid.z0+40,z1:NEAR_Z1-40};

// Ground height in WORLD coordinates. Registered into groundHeight right here, as soon as
// the town data is decoded, so anything placed while the modules load (shop facades,
// palms, garages) already stands on the real relief.
export function divinoHeight(x:number,z:number):number{
  return inNearGrid(x,z)?triH(nearGrid,x,z):triH(farGrid,x,z);
}
setDivinoTerrain(divinoHeight);
export const farHeight=(x:number,z:number):number=>triH(farGrid,x,z);

// local (baked) → world
export const W=(lx:number,lz:number):[number,number]=>[lx+DIV_OX,lz+DIV_OZ];
// real altitude (m above sea level) at a world point — for the HUD/signs
export const altitudeAt=(x:number,z:number):number=>divinoHeight(x,z)+data.ref;
