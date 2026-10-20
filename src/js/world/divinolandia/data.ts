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
import {SITE_TABLE,SITE_PAD,SITE_BLEND,type SiteId} from './sites-table.ts';

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
{
  const g=nearGrid;
  for(const id of Object.keys(SITE_TABLE) as SiteId[]){
    const s=SITE_TABLE[id],x=s.x+DIV_OX,z=s.z+DIV_OZ;
    const fx=Math.sin(s.face),fz=Math.cos(s.face);         // toward the street (depth axis)
    const ux=fz,uz=-fx;                                     // along the facade
    let sum=0,n=0;
    for(let a=-1;a<=1;a+=.25)for(let b=-1;b<=1;b+=.25){sum+=triH(g,x+ux*a*s.w/2+fx*b*s.d/2,z+uz*a*s.w/2+fz*b*s.d/2);n++;}
    const floor=sum/n;SITE_FLOOR[id]=floor;
    const R=Math.hypot(s.w,s.d)/2+SITE_PAD+SITE_BLEND;
    const i0=Math.max(0,Math.floor((x-R-g.x0)/g.cell)),i1=Math.min(g.nx-1,Math.ceil((x+R-g.x0)/g.cell));
    const j0=Math.max(0,Math.floor((z-R-g.z0)/g.cell)),j1=Math.min(g.nz-1,Math.ceil((z+R-g.z0)/g.cell));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
      const dx=g.x0+i*g.cell-x,dz=g.z0+j*g.cell-z;
      const u=Math.abs(dx*ux+dz*uz)-s.w/2,v=Math.abs(dx*fx+dz*fz)-s.d/2;
      const d=Math.hypot(Math.max(u,0),Math.max(v,0));
      if(d>=SITE_PAD+SITE_BLEND)continue;
      const t=d<=SITE_PAD?0:(d-SITE_PAD)/SITE_BLEND,k=t*t*(3-2*t);
      const k0=j*g.nx+i;g.h[k0]=floor+(g.h[k0]-floor)*k;
    }
  }
}

// Playable box: the near grid minus a margin (the far serras are scenery only).
export const PLAY={x0:nearGrid.x0+40,x1:NEAR_X1-40,z0:nearGrid.z0+40,z1:NEAR_Z1-40};

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
