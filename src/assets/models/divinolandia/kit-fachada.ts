import * as THREE from 'three';
import {matte} from '../matte.ts';
import {stoneTexture,corrugatedTexture,telhaTexture,rebocoTexture,sujeiraTexture,vidroTexture,venezianaTexture,frisoTexture,
  STONE_TILE_M,PLASTER_TILE_M,ROOF_TILE_M} from './texturas.ts';

// Kit de fachada — the detailed building parts shared by every surveyed Divinolândia house
// (fachada.ts, casa-rosa-esquina.ts). Everything is written into per-material ACCUMULATORS
// and merged at the end (a whole house = a handful of meshes), so the detail is cheap:
//  - walls with REAL holes for every opening, with reveals (the wall thickness shows),
//    painted render texture and the dirt band at the foot ("encardido");
//  - openings: aluminium sliding windows (frame, sashes, mullions, sky-reflecting glass,
//    granite sill), wooden/aluminium louvred shutters (venezianas), decorative grilles,
//    panelled doors with a knob, ribbed steel garage doors with a ventilation grille band,
//    gates, shop roll-up doors, arches;
//  - roofs in clay "telha colonial" with ridge and hip caps, fascia boards and soffits, or
//    a flat slab with a deep white "beiral" / a parapet ("platibanda");
//  - railings (diagonal lattice, bars), wall caps, pillars, meter box, house number, water
//    tank, satellite dish, AC unit, solar heater.
export const FH=3.0;             // storey height
export const REVEAL=.16;         // wall thickness seen in the openings

// ---------------- materials (cached) ----------------
const cache=new Map<string,THREE.Material>();
const get=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=cache.get(k);if(!m){m=f();cache.set(k,m);}return m;};
export const plain=(c:string):THREE.Material=>get('p'+c,()=>matte({color:c,side:THREE.DoubleSide}));
export const plaster=(c:string):THREE.Material=>get('r'+c,()=>matte({color:c,map:rebocoTexture(),side:THREE.DoubleSide}));
export const tile=(c:string):THREE.Material=>get('t'+c,()=>matte({color:c,map:telhaTexture(),side:THREE.DoubleSide}));
export const louvre=(c:string):THREE.Material=>get('v'+c,()=>matte({color:c,map:venezianaTexture()}));
export const ribbed=(c:string):THREE.Material=>get('f'+c,()=>matte({color:c,map:frisoTexture(),side:THREE.DoubleSide}));
export const stoneM=():THREE.Material=>get('stone',()=>matte({map:stoneTexture(),side:THREE.DoubleSide}));
export const corrM=():THREE.Material=>get('corr',()=>matte({map:corrugatedTexture(),side:THREE.DoubleSide}));
export const glassM=():THREE.Material=>get('glass',()=>matte({map:vidroTexture()}));
export const dirtM=():THREE.Material=>get('dirt',()=>new THREE.MeshLambertMaterial({map:sujeiraTexture(),transparent:true,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
const TILE_FOR=new Map<THREE.Material,number>();
const tileOf=(m:THREE.Material):number=>TILE_FOR.get(m)??1;

// ---------------- accumulator ----------------
type V=[number,number,number];
type Acc={pos:number[];uv:number[]};
export class Kit{
  readonly g=new THREE.Group();
  private accs=new Map<THREE.Material,Acc>();
  private acc(m:THREE.Material):Acc{let a=this.accs.get(m);if(!a){a={pos:[],uv:[]};this.accs.set(m,a);}return a;}
  // triangle with explicit uvs
  tri(m:THREE.Material,a:V,b:V,c:V,ua:[number,number],ub:[number,number],uc:[number,number]):void{
    const A=this.acc(m);A.pos.push(...a,...b,...c);A.uv.push(...ua,...ub,...uc);
  }
  // planar-mapped quad (uv from the dominant plane, in metres / tile) — a,b,c,d in order
  quad(m:THREE.Material,a:V,b:V,c:V,d:V,tileM=tileOf(m)):void{
    const n=new THREE.Vector3().subVectors(new THREE.Vector3(...b),new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...d),new THREE.Vector3(...a)));
    const ax=Math.abs(n.x),ay=Math.abs(n.y),az=Math.abs(n.z);
    const uv=(p:V):[number,number]=>ay>=ax&&ay>=az?[p[0]/tileM,p[2]/tileM]:ax>=az?[p[2]/tileM,p[1]/tileM]:[p[0]/tileM,p[1]/tileM];
    this.tri(m,a,b,c,uv(a),uv(b),uv(c));this.tri(m,a,c,d,uv(a),uv(c),uv(d));
  }
  // quad with its own 0..w/tile, 0..h/tile uvs (doors, shutters, glass)
  quadUV(m:THREE.Material,a:V,b:V,c:V,d:V,su:number,sv:number):void{
    this.tri(m,a,b,c,[0,0],[su,0],[su,sv]);this.tri(m,a,c,d,[0,0],[su,sv],[0,sv]);
  }
  // axis-aligned box (all 6 faces)
  box(m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number):void{
    this.quad(m,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);this.quad(m,[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]);
    this.quad(m,[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]);this.quad(m,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]);
    this.quad(m,[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]);this.quad(m,[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]);
  }
  // a separate mesh (non-merged: curved things)
  add(o:THREE.Object3D):void{this.g.add(o);}
  finish(cast=true):THREE.Group{
    for(const[m,a]of this.accs){
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute(a.pos,3));
      geo.setAttribute('uv',new THREE.Float32BufferAttribute(a.uv,2));
      geo.computeVertexNormals();
      const mesh=new THREE.Mesh(geo,m);mesh.castShadow=cast&&!(m as THREE.MeshLambertMaterial).transparent;mesh.receiveShadow=true;
      this.g.add(mesh);
    }
    this.accs.clear();
    return this.g;
  }
}
// register texture tile sizes for the planar mapping
const reg=(m:THREE.Material,t:number):THREE.Material=>{TILE_FOR.set(m,t);return m;};
export const P=(c:string):THREE.Material=>reg(plaster(c),PLASTER_TILE_M);
export const STONE=():THREE.Material=>reg(stoneM(),STONE_TILE_M);
export const CORR=():THREE.Material=>reg(corrM(),1);
export const TILEM=(c:string):THREE.Material=>reg(tile(c),ROOF_TILE_M);

// ---------------- walls ----------------
export type Hole={x0:number;x1:number;y0:number;y1:number;arch?:boolean};
// Façade skin on the plane z (faces +z), x0..x1 × y0..y1, with rectangular holes and their
// reveals going back `depth`. The cells between the holes' edges are emitted as quads.
export function holedWall(k:Kit,m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z:number,holes:Hole[],depth=REVEAL):void{
  const hs=holes.map(h=>({...h,x0:Math.max(x0,h.x0),x1:Math.min(x1,h.x1),y0:Math.max(y0,h.y0),y1:Math.min(y1,h.y1)})).filter(h=>h.x1>h.x0&&h.y1>h.y0);
  const xs=[...new Set([x0,x1,...hs.flatMap(h=>[h.x0,h.x1])])].sort((a,b)=>a-b);
  const ys=[...new Set([y0,y1,...hs.flatMap(h=>[h.y0,h.y1])])].sort((a,b)=>a-b);
  for(let j=0;j<ys.length-1;j++){
    let run=-1;
    for(let i=0;i<=xs.length-1;i++){
      const cx=i<xs.length-1?(xs[i]+xs[i+1])/2:NaN,cy=(ys[j]+ys[j+1])/2;
      const solid=i<xs.length-1&&!hs.some(h=>cx>h.x0&&cx<h.x1&&cy>h.y0&&cy<h.y1);
      if(solid&&run<0)run=i;
      if(!solid&&run>=0){k.quad(m,[xs[run],ys[j],z],[xs[i],ys[j],z],[xs[i],ys[j+1],z],[xs[run],ys[j+1],z]);run=-1;}
    }
  }
  for(const h of hs){
    const zb=z-depth;
    k.quad(m,[h.x0,h.y0,z],[h.x1,h.y0,z],[h.x1,h.y0,zb],[h.x0,h.y0,zb]);          // sill face
    k.quad(m,[h.x0,h.y1,zb],[h.x1,h.y1,zb],[h.x1,h.y1,z],[h.x0,h.y1,z]);          // head
    k.quad(m,[h.x0,h.y0,zb],[h.x0,h.y1,zb],[h.x0,h.y1,z],[h.x0,h.y0,z]);          // jambs
    k.quad(m,[h.x1,h.y0,z],[h.x1,h.y1,z],[h.x1,h.y1,zb],[h.x1,h.y0,zb]);
  }
}
// plain wall quad facing a direction, for side/back walls (planar uv)
export function wallX(k:Kit,m:THREE.Material,x:number,z0:number,z1:number,y0:number,y1:number):void{k.quad(m,[x,y0,z0],[x,y0,z1],[x,y1,z1],[x,y1,z0]);}
export function wallZ(k:Kit,m:THREE.Material,z:number,x0:number,x1:number,y0:number,y1:number):void{k.quad(m,[x0,y0,z],[x1,y0,z],[x1,y1,z],[x0,y1,z]);}
// dirt band at the foot of a wall plane z (faces +z)
export function dirt(k:Kit,x0:number,x1:number,y0:number,h:number,z:number):void{
  k.quadUV(dirtM(),[x0,y0,z+.004],[x1,y0,z+.004],[x1,y0+h,z+.004],[x0,y0+h,z+.004],1,1);
}

// ---------------- openings ----------------
export type OpenKind='door'|'window'|'garage'|'gate'|'glass'|'arch'|'shop'|'open';
export type Op={t:OpenKind;x:number;w:number;h?:number;y?:number;fl?:number;c?:string;grille?:boolean;shutters?:string;frame?:string;awning?:string;st?:'sliding'|'basculante'|'fixed';leaves?:boolean};
export function opDims(o:Op):{x0:number;x1:number;y0:number;y1:number}{
  const h=o.h??(o.t==='garage'||o.t==='gate'?2.4:o.t==='door'?2.15:o.t==='shop'?2.7:o.t==='glass'?1.9:o.t==='arch'?1.6:1.2);
  const fy=(o.fl||0)*FH,y0=fy+(o.y??(o.t==='window'?1.0:o.t==='glass'?.5:o.t==='arch'?.3:0));
  return{x0:o.x-o.w/2,x1:o.x+o.w/2,y0,y1:y0+h};
}
export const holeOf=(o:Op):Hole=>{const d=opDims(o);return{...d,y1:d.y1+(o.t==='arch'?o.w/2:0),arch:o.t==='arch'};};

// Fill an opening that sits in a wall plane z (the hole and reveals are made by holedWall).
export function fillOpening(k:Kit,o:Op,z:number,wallMat:THREE.Material):void{
  const{x0,x1,y0,y1}=opDims(o),w=x1-x0,h=y1-y0,zi=z-REVEAL+.02;
  const frameC=o.frame||'#f2f0ea',fr=plain(frameC),t=.05;
  const ring=(zz:number,c:THREE.Material,tt=t,dz=.05):void=>{
    k.box(c,x0,x1,y1-tt,y1,zz,zz+dz);k.box(c,x0,x1,y0,y0+tt,zz,zz+dz);
    k.box(c,x0,x0+tt,y0,y1,zz,zz+dz);k.box(c,x1-tt,x1,y0,y1,zz,zz+dz);
  };
  switch(o.t){
    case'window':case'glass':{
      // granite sill sticking out under the window
      if(o.t==='window')k.box(plain('#e3dfd6'),x0-.06,x1+.06,y0-.05,y0,z-REVEAL,z+.06);
      if(o.shutters&&o.leaves){                         // shutters swung OPEN against the wall
        const lm=louvre(o.shutters),lw=w/2;
        for(const[a,b]of[[x0-lw-.04,x0-.04],[x1+.04,x1+lw+.04]] as [number,number][])
          {k.quadUV(lm,[a,y0,z+.03],[b,y0,z+.03],[b,y1,z+.03],[a,y1,z+.03],lw/.5,h/.5);k.box(plain(shade(o.shutters,.8)),a,b,y0,y1,z,z+.025);}
      }
      if(o.shutters&&!o.leaves){                        // closed louvred shutters in the frame
        k.quadUV(louvre(o.shutters),[x0,y0,zi+.02],[x1,y0,zi+.02],[x1,y1,zi+.02],[x0,y1,zi+.02],w/.5,h/.5);
        k.box(plain(o.shutters),(x0+x1)/2-.02,(x0+x1)/2+.02,y0,y1,zi+.02,zi+.06);
      }else{
        k.quadUV(glassM(),[x0,y0,zi],[x1,y0,zi],[x1,y1,zi],[x0,y1,zi],1,1);
        const panes=o.st==='fixed'?1:o.t==='glass'?Math.max(2,Math.round(w/1.1)):w>1.3?4:2;
        for(let p=1;p<panes;p++){const x=x0+p*w/panes;k.box(fr,x-.025,x+.025,y0,y1,zi,zi+.05);}
        if(o.t==='glass'&&h>1.6)k.box(fr,x0,x1,y0+h*.62-.025,y0+h*.62+.025,zi,zi+.05);
        if(o.st==='basculante')for(let r=1;r<3;r++){const y=y0+r*h/3;k.box(fr,x0,x1,y-.02,y+.02,zi,zi+.04);}
      }
      ring(zi,fr);
      if(o.grille){const gm=plain(o.frame||'#efece4');
        for(let x=x0+.14;x<x1-.06;x+=.16)k.box(gm,x-.012,x+.012,y0,y1,z-.05,z-.03);
        for(const yy of[y0+h*.33,y0+h*.66])k.box(gm,x0,x1,yy-.012,yy+.012,z-.05,z-.03);}
      break;
    }
    case'door':{
      const dm=plain(o.c||'#6a4630');
      k.quadUV(dm,[x0,y0,zi],[x1,y0,zi],[x1,y1,zi],[x0,y1,zi],1,1);
      for(const[px,py]of[[.25,.2],[.75,.2],[.25,.62],[.75,.62]]){
        const cx=x0+w*px,cy=y0+h*py;k.box(plain(shade(o.c||'#6a4630',.85)),cx-w*.17,cx+w*.17,cy-h*.17,cy+h*.17,zi,zi+.03);}
      k.box(plain('#c9b88a'),x1-.16,x1-.1,y0+1,y0+1.08,zi,zi+.07);
      ring(zi,plain(shade(o.c||'#6a4630',.7)),.07);
      break;
    }
    case'garage':case'shop':{
      const c=o.c||(o.t==='shop'?'#b8bbbe':'#ecebe6');
      const grill=o.grille?.38:0;
      k.quadUV(ribbed(c),[x0,y0,zi],[x1,y0,zi],[x1,y1-grill,zi],[x0,y1-grill,zi],w/.5,(h-grill)/.5);
      if(grill){k.quadUV(plain('#262422'),[x0,y1-grill,zi-.02],[x1,y1-grill,zi-.02],[x1,y1,zi-.02],[x0,y1,zi-.02],1,1);
        for(let x=x0+.1;x<x1-.05;x+=.14)k.box(plain(c),x-.02,x+.02,y1-grill,y1,zi,zi+.04);
        k.box(plain(c),x0,x1,y1-grill-.04,y1-grill,zi,zi+.05);}
      k.box(plain('#8d8f91'),(x0+x1)/2-.12,(x0+x1)/2+.12,y0+.9,y0+.95,zi,zi+.06);   // handle
      ring(zi,plain(shade(c,.8)),.06);
      break;
    }
    case'gate':{
      const c=o.c||'#e9e7e1',gm=plain(c);
      const dark=new THREE.Color(c).getHSL({h:0,s:0,l:0}).l<.45;
      if(dark){k.quadUV(gm,[x0,y0,zi],[x1,y0,zi],[x1,y1,zi],[x0,y1,zi],1,1);
        for(let x=x0+.12;x<x1;x+=.12)k.box(plain(shade(c,.75)),x-.012,x+.012,y0,y1,zi,zi+.03);}
      else{k.quadUV(ribbed(c),[x0,y0,zi],[x1,y0,zi],[x1,y1,zi],[x0,y1,zi],w/.5,h/.5);}
      ring(zi,plain(shade(c,.85)),.06);
      break;
    }
    case'open':{
      // a shop's open doorway: the dark interior, a floor, and shelves of goods along the back
      const zb=z-REVEAL-2.6,dark=plain('#2b2724');
      k.quadUV(dark,[x0,y0,zb],[x1,y0,zb],[x1,y1,zb],[x0,y1,zb],1,1);
      k.quad(plain('#8d8a84'),[x0,y0+.01,zb],[x1,y0+.01,zb],[x1,y0+.01,z-REVEAL],[x0,y0+.01,z-REVEAL]);
      for(const xx of[x0,x1])k.quad(dark,[xx,y0,zb],[xx,y0,z-REVEAL],[xx,y1,z-REVEAL],[xx,y1,zb]);
      k.quad(dark,[x0,y1,zb],[x1,y1,zb],[x1,y1,z-REVEAL],[x0,y1,z-REVEAL]);
      const goods=['#b8433a','#d7b04a','#4d7fb5','#e6e2d8','#5f8d4e','#c97a3a'];
      for(let r=0;r<4;r++){const yy=y0+.35+r*.45;
        k.box(plain('#6e6a64'),x0+.1,x1-.1,yy-.03,yy,zb+.02,zb+.4);
        for(let i=0,xx=x0+.15;xx<x1-.25;i++,xx+=.32)k.box(plain(goods[(i+r*2)%goods.length]),xx,xx+.24,yy,yy+.26,zb+.05,zb+.3);}
      break;
    }
    case'arch':{
      // the round head over the rectangular part: a wall-coloured spandrel with a half-disc cut out
      const r=w/2,cx=(x0+x1)/2,sh=new THREE.Shape();
      sh.moveTo(x0,y1);sh.lineTo(x0,y1+r);sh.lineTo(x1,y1+r);sh.lineTo(x1,y1);sh.absarc(cx,y1,r,0,Math.PI,false);
      const sp=new THREE.Mesh(new THREE.ShapeGeometry(sh,10),wallMat);sp.position.z=z+.001;k.add(sp);
      k.quadUV(plain('#3a3632'),[x0,y0,z-REVEAL*2],[x1,y0,z-REVEAL*2],[x1,y1+r,z-REVEAL*2],[x0,y1+r,z-REVEAL*2],1,1);
      break;
    }
  }
  if(o.awning){                                         // metal awning (toldo) over the opening
    const am=plain(o.awning),ya=y1+.2;
    k.quad(am,[x0-.2,ya+.35,z],[x1+.2,ya+.35,z],[x1+.2,ya,z+.85],[x0-.2,ya,z+.85]);
    k.box(am,x0-.2,x1+.2,ya-.12,ya,z+.82,z+.86);
  }
}
export const shade=(c:string,f:number):string=>'#'+new THREE.Color(c).multiplyScalar(f).getHexString();

// ---------------- railings ----------------
// along x from a to b on the plane z, bottom y0, height h
export function railing(k:Kit,a:number,b:number,y0:number,h:number,z:number,c:string,style:'lattice'|'bars'):void{
  const m=plain(c);
  k.box(m,a,b,y0+h-.05,y0+h,z-.03,z+.03);k.box(m,a,b,y0+.02,y0+.07,z-.025,z+.025);
  for(let x=a;x<=b+1e-3;x+=Math.max(.6,(b-a)/Math.ceil((b-a)/1.8)))k.box(m,x-.035,x+.035,y0,y0+h,z-.035,z+.035); // posts
  if(style==='bars'){for(let x=a+.06;x<b;x+=.12)k.box(m,x-.012,x+.012,y0+.07,y0+h-.05,z-.012,z+.012);return;}
  const step=.42,hh=h-.12;
  for(let x=a;x<b-.01;x+=step){
    const xa=x,xb=Math.min(b,x+step);
    for(const[sx,ex]of[[xa,xb],[xb,xa]]){                // two diagonals per bay
      const p0=new THREE.Vector3(sx,y0+.07,z),p1=new THREE.Vector3(ex,y0+.07+hh,z);
      const len=p0.distanceTo(p1),bar=new THREE.Mesh(new THREE.BoxGeometry(.03,len,.03),m);
      bar.position.copy(p0).add(p1).multiplyScalar(.5);bar.rotation.z=-Math.atan2(ex-sx,hh);
      bar.updateMatrix();
      // bake into the accumulator via a tiny box transform (keeps the house to few meshes)
      const pos=bar.geometry.getAttribute('position'),v=new THREE.Vector3();
      const idx=bar.geometry.getIndex()!;
      for(let i=0;i<idx.count;i+=3){
        const tri:V[]=[];for(let q=0;q<3;q++){v.fromBufferAttribute(pos,idx.getX(i+q)).applyMatrix4(bar.matrix);tri.push([v.x,v.y,v.z]);}
        k.tri(m,tri[0],tri[1],tri[2],[0,0],[1,0],[0,1]);
      }
    }
  }
}

// ---------------- roofs ----------------
// Roof slope face (triangle) with uv along the eave (u) and up the slope (v).
function slopeTri(k:Kit,m:THREE.Material,a:V,b:V,c:V,eaveA:V,eaveB:V):void{
  const e=new THREE.Vector3(eaveB[0]-eaveA[0],eaveB[1]-eaveA[1],eaveB[2]-eaveA[2]).normalize();
  const n=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).cross(new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2])).normalize();
  const up=new THREE.Vector3().crossVectors(n,e).normalize();
  const o=new THREE.Vector3(...eaveA);
  const uv=(p:V):[number,number]=>{const d=new THREE.Vector3(...p).sub(o);return[d.dot(e)/ROOF_TILE_M,Math.abs(d.dot(up))/ROOF_TILE_M];};
  k.tri(m,a,b,c,uv(a),uv(b),uv(c));
}
// ridge / hip cap: a row of half-round tiles along a segment
function cap(k:Kit,m:THREE.Material,a:V,b:V):void{
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),len=A.distanceTo(B);
  if(len<.05)return;
  const cyl=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,len,7),m);
  cyl.position.copy(A).add(B).multiplyScalar(.5);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());
  cyl.castShadow=true;k.add(cyl);
}
// fascia board + soffit along an eave edge from a to b (outer edge), wall line inset
function eave(k:Kit,a:V,b:V,inward:V,fasciaC:string,soffitC:string,depth:number):void{
  const fm=plain(fasciaC),sm=plain(soffitC);
  const d:V=[a[0],a[1]-.2,a[2]],e:V=[b[0],b[1]-.2,b[2]];
  k.quad(fm,d,e,b,a);
  const ai:V=[d[0]+inward[0]*depth,d[1],d[2]+inward[2]*depth],bi:V=[e[0]+inward[0]*depth,e[1],e[2]+inward[2]*depth];
  k.quad(sm,ai,bi,e,d);
}
export type RoofKind='hip'|'gable'|'gableSide'|'flat';
// Roof over the rectangle x∈[-w/2,w/2], z∈[z0-d,z0] at height y (eave line), overhang ov.
export function roof(k:Kit,kind:RoofKind,w:number,d:number,y:number,z0:number,o:{tile?:string;fascia?:string;soffit?:string;ov?:number;wall:string;rise?:number;parapet?:boolean}):number{
  const ov=o.ov??.55,hw=w/2+ov,front=z0+ov,back=z0-d-ov,tm=TILEM(o.tile||'#b0603f');
  const fas=o.fascia||'#f1efe9',sof=o.soffit||'#ece9e2';
  if(kind==='flat'){
    if(o.parapet){                                      // platibanda: parapet hiding a low roof
      const pm=P(o.wall);holedWall(k,pm,-w/2,w/2,y,y+.9,z0,[]);k.box(plain('#d9d6cf'),-w/2-.05,w/2+.05,y+.9,y+.97,z0-.25,z0+.05);
      k.box(plain('#8f8b84'),-w/2,w/2,y+.4,y+.45,z0-d,z0-.2);
      return y+.97;
    }
    k.box(plain(fas),-hw,hw,y,y+.32,back,front);        // deep white beiral (box eave)
    return y+.32;
  }
  const rise=o.rise??(kind==='gableSide'?Math.min(d,10)*.32:kind==='gable'?Math.min(w,12)*.3:Math.min(w,d)*.3);
  const c0:V=[-hw,y,back],c1:V=[hw,y,back],c2:V=[hw,y,front],c3:V=[-hw,y,front];
  if(kind==='gable'){                                   // gable END faces the street
    const r0:V=[0,y+rise,front],r1:V=[0,y+rise,back];
    slopeTri(k,tm,c3,r0,c0,c3,c0);slopeTri(k,tm,c0,r0,r1,c3,c0);
    slopeTri(k,tm,c2,c1,r0,c2,c1);slopeTri(k,tm,c1,r1,r0,c2,c1);
    cap(k,tm,r0,r1);
    // gable wall triangle + barge boards
    const pm=P(o.wall),apex=y+rise*(w/2)/hw;
    k.tri(pm,[-w/2,y,z0],[w/2,y,z0],[0,apex,z0],[-w/2/3,y/3],[w/2/3,y/3],[0,apex/3]);
    for(const s of[-1,1]){const fm=plain(fas),L=Math.hypot(hw,rise),bb=new THREE.Mesh(new THREE.BoxGeometry(L,.24,.07),fm);
      bb.position.set(s*hw/2,y+rise/2-.1,front+.04);bb.rotation.z=-s*Math.atan2(rise,hw);bb.castShadow=true;k.add(bb);}
    eave(k,c0,c3,[1,0,0],fas,sof,ov);eave(k,c2,c1,[-1,0,0],fas,sof,ov);
  }else if(kind==='gableSide'){                         // ridge along the street
    const zr=(front+back)/2,r0:V=[-hw,y+rise,zr],r1:V=[hw,y+rise,zr];
    slopeTri(k,tm,c3,c2,r1,c3,c2);slopeTri(k,tm,c3,r1,r0,c3,c2);
    slopeTri(k,tm,c1,c0,r0,c1,c0);slopeTri(k,tm,c1,r0,r1,c1,c0);
    cap(k,tm,r0,r1);
    const pm=P(o.wall);
    for(const s of[-1,1])k.tri(pm,[s*w/2,y,z0],[s*w/2,y,z0-d],[s*w/2,y+rise*.93,(z0+z0-d)/2],[0,0],[1,0],[.5,1]);
    eave(k,c3,c2,[0,0,-1],fas,sof,ov);eave(k,c1,c0,[0,0,1],fas,sof,ov);
  }else{                                                 // hip
    const hd=(front-back)/2,zc=(front+back)/2,along=hw>=hd,rr=Math.abs(hw-hd);
    const r0:V=along?[-rr,y+rise,zc]:[0,y+rise,zc-rr],r1:V=along?[rr,y+rise,zc]:[0,y+rise,zc+rr];
    if(along){slopeTri(k,tm,c3,c2,r1,c3,c2);slopeTri(k,tm,c3,r1,r0,c3,c2);slopeTri(k,tm,c1,c0,r0,c1,c0);slopeTri(k,tm,c1,r0,r1,c1,c0);
      slopeTri(k,tm,c0,c3,r0,c0,c3);slopeTri(k,tm,c2,c1,r1,c2,c1);}
    else{slopeTri(k,tm,c0,c3,r0,c0,c3);slopeTri(k,tm,c3,r1,r0,c0,c3);slopeTri(k,tm,c2,c1,r1,c2,c1);slopeTri(k,tm,c1,r0,r1,c2,c1);
      slopeTri(k,tm,c3,c2,r1,c3,c2);slopeTri(k,tm,c1,c0,r0,c1,c0);}
    cap(k,tm,r0,r1);for(const[c,r]of[[c0,r0],[c3,along?r0:r1],[c1,along?r1:r0],[c2,r1]] as [V,V][])cap(k,tm,c,r);
    eave(k,c3,c2,[0,0,-1],fas,sof,ov);eave(k,c1,c0,[0,0,1],fas,sof,ov);
    eave(k,c0,c3,[1,0,0],fas,sof,ov);eave(k,c2,c1,[-1,0,0],fas,sof,ov);
  }
  return y+rise;
}

// ---------------- small things that make a Brazilian street ----------------
export function meterBox(k:Kit,x:number,y:number,z:number):void{          // "padrão" de energia
  k.box(plain('#9fa3a6'),x-.22,x+.22,y,y+.55,z,z+.18);
  k.box(plain('#1f2a33'),x-.12,x+.12,y+.28,y+.42,z+.18,z+.19);
  k.box(plain('#6e7275'),x-.03,x+.03,y+.55,y+1.6,z+.05,z+.11);              // conduit up
}
export function houseNumber(k:Kit,x:number,y:number,z:number):void{
  k.box(plain('#2c3e66'),x-.15,x+.15,y,y+.18,z,z+.02);k.box(plain('#f2f2f2'),x-.1,x+.1,y+.05,y+.13,z+.02,z+.025);
}
export function waterTank(k:Kit,x:number,y:number,z:number):void{          // blue fibreglass caixa d'água
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.62,.55,.85,14),plain('#3d73b5'));t.position.set(x,y+.43,z);t.castShadow=true;k.add(t);
  const l=new THREE.Mesh(new THREE.CylinderGeometry(.66,.66,.08,14),plain('#3566a3'));l.position.set(x,y+.89,z);k.add(l);
}
export function dish(k:Kit,x:number,y:number,z:number,ry:number):void{       // satellite dish on a bracket
  const d=new THREE.Mesh(new THREE.SphereGeometry(.45,12,6,0,Math.PI*2,0,.55),plain('#cfd2d4'));
  d.position.set(x,y+.6,z);d.rotation.set(-1.1,ry,0);k.add(d);
  k.box(plain('#6e7275'),x-.03,x+.03,y,y+.6,z-.03,z+.03);
}
export function acUnit(k:Kit,x:number,y:number,z:number):void{
  k.box(plain('#e9e9e6'),x-.4,x+.4,y,y+.55,z,z+.3);
  const f=new THREE.Mesh(new THREE.CircleGeometry(.18,12),plain('#5a5d60'));f.position.set(x+.12,y+.27,z+.305);k.add(f);
}
export function solarHeater(k:Kit,x:number,y:number,z:number,tilt=.5):void{
  const p=new THREE.Mesh(new THREE.BoxGeometry(1.8,.06,1),plain('#24324a'));p.position.set(x,y+.35,z);p.rotation.x=-tilt;k.add(p);
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,1.8,10),plain('#d9d9d6'));b.rotation.z=Math.PI/2;b.position.set(x,y+.75,z-.5);k.add(b);
}
