import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';
import {settTexture,asfaltoTexture,terraTexture,calcadaRuaTexture,concretoTexture,acostamentoTexture,pinturaTexture,
  SETT_TILE_M,ROAD_TILE_U,ROAD_TILE_V,CONCRETO_TILE_M,GUTTER_LAT,GUTTER_W} from './texturas.ts';
import {drapePolys,type DrapeGrid} from './terreno.ts';

// Divinolândia streets — the real OpenStreetMap street network draped on the terrain, built
// the way the town's streets look in Street View:
//   - asphalt in town (lane-aware wear: oil down each lane, wheel tracks, patches, cracks),
//     granite setts round the old centre, terra-roxa dirt with two ruts and a grassy crown on
//     the unpaved and rural roads;
//   - along the paved town streets, a concrete gutter (sarjeta, painted in the asphalt
//     texture), a kerb (meio-fio) and the raised cement sidewalk behind it (its kerb top
//     painted in the sidewalk texture) — cut back where another street crosses, capped at
//     the ends;
//   - road paint on the main roads: the yellow centre line (double on the highways and
//     avenues, dashed on the collector streets), white edge lines out of town, zebra
//     crossings at the central junctions (the caller decides which: StreetLine);
//   - a dusty verge fading into the grass beside the dirt and rural roads.
// With the terrain grid (`grid`) every flat surface is cut along the terrain's own triangles
// (terreno.ts drapePolys) and lies exactly on the ground; without it (model viewer) each
// vertex just reads the ground height. The bake levelled the terrain across each street bed.
// Where surfaces overlap the order is fixed by lift + polygon offset. One merged mesh per
// material for the whole town.
//
// UVs are in metres: u is the LATERAL offset from the centreline (the road textures paint
// their wear by it — texturas.ts ROAD_TILE_U) and v the distance along the street.
const lift=(c:string):THREE.Color=>new THREE.Color(c).multiplyScalar(1/.85);   // undo a multiply map's ~0.85 mean
const off=(n:number)=>({polygonOffset:true,polygonOffsetFactor:-n,polygonOffsetUnits:-n});
export const asphaltMat=matte({map:asfaltoTexture(DIVINO.asphalt,DIVINO.kerb),...off(4)});
export const dirtRoadMat=matte({map:terraTexture(DIVINO.dirtRoad,DIVINO.pasture),...off(3)});
export const settMat=matte({map:settTexture(),...off(5)});
export const sidewalkMat=matte({map:calcadaRuaTexture(),...off(2)});
const kerbMat=matte({color:0xf2f0ea,map:concretoTexture(),side:THREE.DoubleSide});
const yellowMat=matte({color:lift(DIVINO.paintYellow),map:pinturaTexture(),...off(7)});
const whiteMat=matte({color:lift(DIVINO.paintWhite),map:pinturaTexture(),...off(7)});
// (a cut-out, not a blend: a transparent mesh this size costs a quarter of the frame rate)
const vergeMat=matte({map:acostamentoTexture(DIVINO.dirtRoad),alphaTest:.5,...off(1)});

// How far each surface is drawn above the terrain it is draped on (the world registers the
// same heights as the ground people and wheels rest on — world/surface-lift.ts).
export const STREET_LIFT={paved:.14,dirt:.12,sett:.16,walk:.32};
const WALK_W=2.1,VERGE_W=1.4,VERGE_LIFT=.10;

export type StreetLine={
  pts:[number,number][];hw:number;paved:boolean;sidewalk:boolean;sett?:boolean;
  centre?:'double'|'dashed';   // yellow centre line
  edges?:boolean;              // white edge lines
  zebras?:number[];            // zebra crossings: distance along the line where each starts (3 m long)
  verge?:boolean;              // a dusty verge where there is no sidewalk (default true)
};
export type StreetOpts={
  keepWalk?:(x:number,z:number)=>boolean;                        // may a sidewalk / verge be laid here?
  onWalk?:(poly:[number,number][],lift:number)=>void;            // each sidewalk piece laid (world x,z)
};
type HAt=(x:number,z:number)=>number;
type P2=[number,number];

// A polyline resampled every ≤ `step` m: points, unit left normals, distance along.
type Frames={P:P2[];N:P2[];S:number[]};
function frames(pts:P2[],step:number):Frames{
  const P:P2[]=[];
  for(let k=1;k<pts.length;k++){
    const[ax,az]=pts[k-1],[bx,bz]=pts[k],L=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(L/step));
    for(let q=k===1?0:1;q<=n;q++)P.push([ax+(bx-ax)*q/n,az+(bz-az)*q/n]);
  }
  const N:P2[]=P.map((_,i)=>{
    const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)];
    const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
    return[-dz/l,dx/l];
  });
  const S=[0];for(let i=1;i<P.length;i++)S.push(S[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
  return{P,N,S};
}
const length=(F:Frames):number=>F.S[F.S.length-1]??0;
// point + left normal at distance s
function at(F:Frames,s:number):{x:number;z:number;nx:number;nz:number}{
  let i=1;while(i<F.S.length-1&&F.S[i]<s)i++;
  const s0=F.S[i-1],s1=F.S[i],t=s1>s0?Math.max(0,Math.min(1,(s-s0)/(s1-s0))):0;
  const nx=F.N[i-1][0]+(F.N[i][0]-F.N[i-1][0])*t,nz=F.N[i-1][1]+(F.N[i][1]-F.N[i-1][1])*t,l=Math.hypot(nx,nz)||1;
  return{x:F.P[i-1][0]+(F.P[i][0]-F.P[i-1][0])*t,z:F.P[i-1][1]+(F.P[i][1]-F.P[i-1][1])*t,nx:nx/l,nz:nz/l};
}
// the piece of the polyline between s0 and s1
function sub(F:Frames,s0:number,s1:number):P2[]{
  const a=at(F,s0),b=at(F,s1),out:P2[]=[[a.x,a.z]];
  for(let i=0;i<F.P.length;i++)if(F.S[i]>s0+.01&&F.S[i]<s1-.01)out.push(F.P[i]);
  out.push([b.x,b.z]);return out;
}
// Ribbon between lateral offsets o0 < o1 (u runs u0 → u1 across it; v = (s + v0) / tv), as
// flat convex polygons (x,z,u,v per vertex): one quad per step, two triangles where a tight
// bend folds it.
function band(F:Frames,o0:number,o1:number,u0:number,u1:number,tv:number,v0:number,out:number[][]):void{
  if(F.P.length<2)return;
  const L:number[][]=[],R:number[][]=[];
  for(let i=0;i<F.P.length;i++){
    const[x,z]=F.P[i],[nx,nz]=F.N[i],v=(F.S[i]+v0)/tv;
    L.push([x+nx*o0,z+nz*o0,u0,v]);R.push([x+nx*o1,z+nz*o1,u1,v]);
  }
  const turn=(a:number[],b:number[],c:number[]):number=>(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
  for(let i=1;i<F.P.length;i++){
    const q=[L[i-1],R[i-1],R[i],L[i]];
    const t=q.map((_,k)=>turn(q[k],q[(k+1)%4],q[(k+2)%4]));
    if(t.every(v=>v>1e-9)||t.every(v=>v<-1e-9))out.push(q.flat());
    else{out.push([...q[0],...q[1],...q[2]]);out.push([...q[0],...q[2],...q[3]]);}
  }
}
// a band whose u is simply the lateral offset in tiles of `tu` m
const bandM=(F:Frames,o0:number,o1:number,tu:number,tv:number,v0:number,out:number[][]):void=>band(F,o0,o1,o0/tu,o1/tu,tv,v0,out);
// The intervals of [0, len] where ok(s) holds, sampled every `step` m (an interval runs
// between consecutive passing samples; shorter than `min` m is dropped).
function runs(len:number,ok:(s:number)=>boolean,step=1.5,min=1):[number,number][]{
  const out:[number,number][]=[],n=Math.max(1,Math.ceil(len/step));
  let start=-1;
  for(let i=0;i<=n;i++){
    const s=len*i/n,good=ok(s);
    if(good&&start<0)start=s;
    if((!good||i===n)&&start>=0){const e=good?s:len*(i-1)/n;if(e-start>=min)out.push([start,e]);start=-1;}
  }
  return out;
}
// flat (x,z,u,v) polygons → upward triangles on the ground (positions + uvs)
function lay(polys:number[][],hAt:HAt,lift:number,grid:DrapeGrid|undefined,pos:number[],uv?:number[]):void{
  if(grid){drapePolys(polys,grid,hAt,lift,pos,uv);return;}
  for(const p of polys)for(let k=4;k+4<p.length;k+=4){
    const a=[p[0],p[1],p[2],p[3]],b=p.slice(k,k+4),c=p.slice(k+4,k+8);
    const up=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1])>0;
    for(const v of up?[a,b,c]:[a,c,b]){pos.push(v[0],hAt(v[0],v[1])+lift,v[1]);if(uv)uv.push(v[2],v[3]);}
  }
}
// a vertical wall strip along ground points: bottom/top heights per point (uv in metres)
function wall(pts:P2[],bot:number[],top:number[],pos:number[],uv:number[]):void{
  let s=0;
  for(let i=1;i<pts.length;i++){
    const[ax,az]=pts[i-1],[bx,bz]=pts[i],d=Math.hypot(bx-ax,bz-az),T=CONCRETO_TILE_M;
    const A0=[ax,bot[i-1],az],A1=[ax,top[i-1],az],B0=[bx,bot[i],bz],B1=[bx,top[i],bz];
    pos.push(...A0,...B0,...B1,...A0,...B1,...A1);
    uv.push(s/T,bot[i-1]/T,(s+d)/T,bot[i]/T,(s+d)/T,top[i]/T,s/T,bot[i-1]/T,(s+d)/T,top[i]/T,s/T,top[i-1]/T);
    s+=d;
  }
}

// Which roadway covers a point: a hash of every line's segments, to keep each street's
// sidewalks, verges and paint out of the streets crossing it.
function roadIndex(lines:StreetLine[]):(x:number,z:number,self:number,margin:number)=>boolean{
  const C=16,h=new Map<number,{ax:number;az:number;bx:number;bz:number;r:number;k:number}[]>();
  const key=(i:number,j:number):number=>i*73856093^j*19349663;
  lines.forEach((l,k)=>{for(let i=1;i<l.pts.length;i++){
    const[ax,az]=l.pts[i-1],[bx,bz]=l.pts[i],seg={ax,az,bx,bz,r:l.hw,k},m=l.hw+4;
    for(let a=Math.floor((Math.min(ax,bx)-m)/C);a<=Math.floor((Math.max(ax,bx)+m)/C);a++)
      for(let b=Math.floor((Math.min(az,bz)-m)/C);b<=Math.floor((Math.max(az,bz)+m)/C);b++){
        const kk=key(a,b);let arr=h.get(kk);if(!arr){arr=[];h.set(kk,arr);}arr.push(seg);
      }
  }});
  return(x,z,self,margin)=>{
    const arr=h.get(key(Math.floor(x/C),Math.floor(z/C)));if(!arr)return false;
    for(const s of arr){
      if(s.k===self)continue;
      const dx=s.bx-s.ax,dz=s.bz-s.az,l2=dx*dx+dz*dz||1;
      let t=((x-s.ax)*dx+(z-s.az)*dz)/l2;t=t<0?0:t>1?1:t;
      const ex=x-s.ax-dx*t,ez=z-s.az-dz*t,r=s.r+margin;
      if(ex*ex+ez*ez<r*r)return true;
    }
    return false;
  };
}

export function makeStreets(lines:StreetLine[],hAt:HAt,grid?:DrapeGrid,opts:StreetOpts={}):THREE.Group{
  const keep=opts.keepWalk??((): boolean=>true);
  const inOther=roadIndex(lines);
  type Buf={p:number[];uv:number[]};
  const buf=():Buf=>({p:[],uv:[]});
  const B={asph:buf(),dirt:buf(),sett:buf(),walk:buf(),kerb:buf(),yellow:buf(),white:buf(),verge:buf()};
  // draped ribbons follow the ground by themselves: resample only to round the bends
  const step=grid?6:3;
  const LW=STREET_LIFT.walk;
  lines.forEach((s,k)=>{
    const F=frames(s.pts,step),len=length(F),v0=k*7.31;   // (each street starts its texture elsewhere)
    // ---- the roadway. Two streets crossing lay the same ground twice: a few millimetres
    // apart, one always shows over the other
    const road:number[][]=[],dz=.002*(k%4);
    if(s.sett){bandM(F,-s.hw,s.hw,SETT_TILE_M,SETT_TILE_M,v0,road);lay(road,hAt,STREET_LIFT.sett+.006*(k%3),grid,B.sett.p,B.sett.uv);}
    else if(s.paved){
      // the texture's lateral layout: a kerbed street's edge lands on the painted gutter, any
      // other road stops short of it (a few per cent of stretch across is invisible)
      const e=s.sidewalk?GUTTER_LAT:Math.min(s.hw,GUTTER_LAT-GUTTER_W-.2);
      band(F,-s.hw,s.hw,-e/ROAD_TILE_U,e/ROAD_TILE_U,ROAD_TILE_V,v0,road);lay(road,hAt,STREET_LIFT.paved+dz,grid,B.asph.p,B.asph.uv);
    }
    else{bandM(F,-s.hw,s.hw,ROAD_TILE_U,ROAD_TILE_V,v0,road);lay(road,hAt,STREET_LIFT.dirt+dz,grid,B.dirt.p,B.dirt.uv);}
    const roadTop=s.sett?STREET_LIFT.sett:s.paved?STREET_LIFT.paved:STREET_LIFT.dirt;
    const Orig=frames(s.pts,Infinity);                  // the street's own vertices (pieces are cut from it)
    const pt=(q:number,o:number):P2=>{const a=at(Orig,q);return[a.x+a.nx*o,a.z+a.nz*o];};
    const clear=(q:number,o:number,m:number):boolean=>{const[x,z]=pt(q,o);return!inOther(x,z,k,m);};
    for(const sg of[1,-1]){
      const o=(a:number):number=>sg*a;
      const lo=(a:number,b:number):[number,number]=>sg>0?[a,b]:[-b,-a];
      // ---- gutter + kerb + raised sidewalk, wherever no other street crosses
      if(s.sidewalk){
        const ok=(q:number):boolean=>clear(q,o(s.hw),.2)&&clear(q,o(s.hw+WALK_W),.2)&&clear(q,o(s.hw+WALK_W/2),.2)&&keep(...pt(q,o(s.hw+WALK_W/2)));
        for(const[a,b]of runs(len,ok)){
          const R=frames(sub(Orig,a,b),step),walk:number[][]=[];
          if(sg>0)band(R,s.hw,s.hw+WALK_W,0,1,2,a,walk);else band(R,-s.hw-WALK_W,-s.hw,1,0,2,a,walk);   // u: kerb → outer edge
          lay(walk,hAt,LW,grid,B.walk.p,B.walk.uv);
          const E=frames(sub(Orig,a,b),4);
          if(opts.onWalk)for(let i=1;i<R.P.length;i++){
            const q=[i-1,i].flatMap(j=>[R.P[j][0]+R.N[j][0]*o(s.hw),R.P[j][1]+R.N[j][1]*o(s.hw),R.P[j][0]+R.N[j][0]*o(s.hw+WALK_W),R.P[j][1]+R.N[j][1]*o(s.hw+WALK_W)]);
            opts.onWalk([[q[0],q[1]],[q[2],q[3]],[q[6],q[7]],[q[4],q[5]]],LW);
          }
          // the kerb's face to the road, the slab's outer edge down to the ground, the two ends
          const edge=(off:number):P2[]=>E.P.map((p,i)=>[p[0]+E.N[i][0]*off,p[1]+E.N[i][1]*off]);
          const kp=edge(o(s.hw)),op=edge(o(s.hw+WALK_W));
          wall(kp,kp.map(([x,z])=>hAt(x,z)+roadTop-.05),kp.map(([x,z])=>hAt(x,z)+LW+.01),B.kerb.p,B.kerb.uv);
          wall(op,op.map(([x,z])=>hAt(x,z)-.15),op.map(([x,z])=>hAt(x,z)+LW+.01),B.kerb.p,B.kerb.uv);
          for(const q of[a,b]){
            const ends=[pt(q,o(s.hw)),pt(q,o(s.hw+WALK_W))];
            wall(ends,ends.map(([x,z])=>hAt(x,z)-.15),ends.map(([x,z])=>hAt(x,z)+LW+.01),B.kerb.p,B.kerb.uv);
          }
        }
      }
      // ---- the dusty verge of a road without sidewalks (not over another street)
      else if(!s.sett&&s.verge!==false){
        const ok=(q:number):boolean=>clear(q,o(s.hw+VERGE_W*.5),.3)&&clear(q,o(s.hw+.1),.3)&&keep(...pt(q,o(s.hw+VERGE_W*.5)));
        for(const[a,b]of runs(len,ok,3,2)){
          const R=frames(sub(Orig,a,b),step),vg:number[][]=[];
          if(sg>0)band(R,s.hw,s.hw+VERGE_W,0,1,8,a,vg);else band(R,-s.hw-VERGE_W,-s.hw,1,0,8,a,vg);
          lay(vg,hAt,VERGE_LIFT,grid,B.verge.p,B.verge.uv);
        }
      }
      // ---- white edge line
      if(s.edges&&s.paved&&!s.sett){
        const ok=(q:number):boolean=>clear(q,o(s.hw-.35),.6);
        for(const[a,b]of runs(len,ok,1.5,2)){
          const R=frames(sub(Orig,a+.5,b-.5),step),ln:number[][]=[],[e0,e1]=lo(s.hw-.42,s.hw-.3);
          band(R,e0,e1,0,.24,4,a,ln);lay(ln,hAt,roadTop+.006,grid,B.white.p,B.white.uv);
        }
      }
    }
    // ---- yellow centre line: stops short of the streets crossing it
    if(s.centre&&s.paved&&!s.sett){
      const ln:number[][]=[];
      for(const[a,b]of runs(len,q=>clear(q,0,1),1.5,2)){
        if(s.centre==='double'){
          const R=frames(sub(Orig,a+.5,b-.5),step);
          band(R,-.19,-.07,0,.24,4,a,ln);band(R,.07,.19,0,.24,4,a,ln);
        }else for(let d=Math.ceil(a/9)*9;d<b-.5;d+=9){       // 3 m dash, 6 m gap
          const e=Math.min(b-.5,d+3);if(e-d<1)continue;
          band(frames(sub(Orig,d,e),step),-.06,.06,0,.24,4,d,ln);
        }
      }
      lay(ln,hAt,roadTop+.006,grid,B.yellow.p,B.yellow.uv);
    }
    // ---- zebra crossings: 45 cm bars across the street, parallel to the traffic
    if(s.zebras&&s.paved)for(const z0 of s.zebras){
      if(z0<0||z0+3>len||!clear(z0+1.5,0,.5))continue;
      const R=frames(sub(Orig,z0,z0+3),step),zb:number[][]=[];
      for(let q=-s.hw+.5;q+.45<=s.hw-.5;q+=.9)band(R,q,q+.45,0,.9,4,z0,zb);
      lay(zb,hAt,roadTop+.007,grid,B.white.p,B.white.uv);
    }
  });
  const g=new THREE.Group();
  const add=(b:Buf,m:THREE.Material,order=0):void=>{
    if(!b.p.length)return;
    const mesh=new THREE.Mesh(geo(b.p,b.uv),m);mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;mesh.renderOrder=order;g.add(mesh);
  };
  add(B.sett,settMat);add(B.asph,asphaltMat);add(B.dirt,dirtRoadMat);add(B.walk,sidewalkMat);add(B.kerb,kerbMat);
  add(B.yellow,yellowMat);add(B.white,whiteMat);add(B.verge,vergeMat);
  return g;
}

const geo=(arr:number[],uv?:number[]):THREE.BufferGeometry=>{
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
  if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();g.computeBoundingSphere();return g;
};


// Water ribbons (Rio do Peixe + streams): each point carries its own surface height and
// how far the water reaches to its left (wl) and right (wr) before the bank rises over it
// (world/divinolandia/water.ts finds those shorelines on the terrain).
export const riverMat=matte({color:DIVINO.river,transparent:true,opacity:.88,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
export type WaterRibbon={pts:[number,number,number][];wl:number[];wr:number[]};
export function makeWater(lines:WaterRibbon[]):THREE.Mesh{
  const out:number[]=[];
  for(const w of lines){
    const P=w.pts;if(P.length<2)continue;
    // per-vertex normals (mean of the two segments) so consecutive quads share their edges
    const L:number[][]=[],R:number[][]=[];
    for(let i=0;i<P.length;i++){
      const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1,nx=-dz/l,nz=dx/l;
      L.push([P[i][0]+nx*w.wl[i],P[i][2],P[i][1]+nz*w.wl[i]]);R.push([P[i][0]-nx*w.wr[i],P[i][2],P[i][1]-nz*w.wr[i]]);
    }
    for(let i=1;i<P.length;i++){
      if(w.wl[i-1]+w.wr[i-1]+w.wl[i]+w.wr[i]<.01)continue;  // buried under a road here
      const A=L[i-1],B=R[i-1],Cc=L[i],D=R[i];
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
