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

type Grid={x0:number;z0:number;cell:number;nx:number;nz:number;h:Float32Array};
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
function triH(g:Grid,x:number,z:number):number{
  let fx=(x-g.x0)/g.cell,fz=(z-g.z0)/g.cell;
  if(fx<0)fx=0;else if(fx>g.nx-1.0001)fx=g.nx-1.0001;
  if(fz<0)fz=0;else if(fz>g.nz-1.0001)fz=g.nz-1.0001;
  const i=fx|0,j=fz|0,u=fx-i,v=fz-j,n=g.nx,H=g.h;
  const a=H[j*n+i],b=H[j*n+i+1],c=H[(j+1)*n+i],d=H[(j+1)*n+i+1];
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
const NEAR_X1=nearGrid.x0+(nearGrid.nx-1)*nearGrid.cell, NEAR_Z1=nearGrid.z0+(nearGrid.nz-1)*nearGrid.cell;
export const inNearGrid=(x:number,z:number):boolean=>x>=nearGrid.x0&&x<=NEAR_X1&&z>=nearGrid.z0&&z<=NEAR_Z1;
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
    }
  }
}

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
