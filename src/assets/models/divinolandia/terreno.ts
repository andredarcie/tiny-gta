import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';
import {soloTexture,GROUND_TILE_M} from './texturas.ts';
import {tileTerrainMesh} from './terrain-tiles.ts';

// Divinolândia terrain — the real relief (SRTM) of the town and the serras around it,
// drawn from a baked height grid. The triangles are EXACTLY the ones the physics
// interpolates (src/js/world/divinolandia/data.ts triH: corners a,b,c,d, diagonal b–c),
// so cars and feet sit on what is drawn. Colour is painted per vertex (olive pasture,
// darker wood in the folds, dry grass and bare terra-roxa on the steep cuts, a trodden
// earth tone inside the town) and the near terrain carries a tiling ground texture (grass
// tufts, bare patches, pebbles) in world metres, so it reads as ground up close.
export type HeightGrid={x0:number;z0:number;cell:number;nx:number;nz:number;h:Float32Array};
const C=(hex:string|number):THREE.Color=>new THREE.Color(hex);
const PAST=C(DIVINO.pasture),DRY=C(DIVINO.pastureDry),WOOD=C(DIVINO.forest),SOIL=C(DIVINO.soil),ROCK=C(DIVINO.rock);
// (the detail texture averages ~0.85: the near terrain's vertex colours are lifted to match)
const DETAIL_GAIN=1/.85;
export const terrainMat=matte({vertexColors:true,map:soloTexture()});
export const farTerrainMat=matte({vertexColors:true});

// Smooth-ish value noise (cheap trig) for the land-cover patches.
const vn=(x:number,z:number):number=>Math.sin(x*.0061+1.3)*Math.cos(z*.0053-.7)+.6*Math.sin(x*.0127-z*.0094+2.1)+.35*Math.sin(z*.021+x*.017);

// a finer relief over some cells (the river corridor, data.ts RIO_FINE): n×n heights per cell
// (row-major, z then x) and a wetness 0..1 that darkens the ground toward wet earth and mud
export type FineCells={n:number;at:(i:number,j:number)=>{h:Float32Array;wet:Float32Array}|null};
type TerrainOpts={town?:(x:number,z:number)=>number;skip?:{x0:number;x1:number;z0:number;z1:number};drop?:number;mat?:THREE.Material;fine?:FineCells};
// the ground's colour at every grid node (land cover, slope, town)
function terrainColors(g:HeightGrid,opts:TerrainOpts):Float32Array{
  const {nx,nz,cell,h}=g,col=new Float32Array(nx*nz*3),tmp=new THREE.Color();
  const gain=(opts.mat||terrainMat)===terrainMat?DETAIL_GAIN:1;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const k=j*nx+i,x=g.x0+i*cell,z=g.z0+j*cell;
    const hl=h[j*nx+Math.max(0,i-1)],hr=h[j*nx+Math.min(nx-1,i+1)],hu=h[Math.max(0,j-1)*nx+i],hd=h[Math.min(nz-1,j+1)*nx+i];
    const slope=Math.hypot(hr-hl,hd-hu)/(2*cell);
    const v=vn(x,z);
    tmp.copy(PAST).lerp(DRY,Math.max(0,Math.min(1,.5+.5*Math.sin(x*.013+z*.009))*.3));
    if(v>.7)tmp.lerp(WOOD,Math.min(1,(v-.7)*2.2));                 // wood patches
    // concave folds (valleys) are wooded in the serra: compare with the neighbours' mean
    const conc=(hl+hr+hu+hd)/4-h[k];
    if(conc>.25)tmp.lerp(WOOD,Math.min(.85,(conc-.25)*.9));
    if(slope>.45)tmp.lerp(SOIL,Math.min(.7,(slope-.45)*2));         // raw cuts on steep banks
    if(slope>.8)tmp.lerp(ROCK,Math.min(.6,(slope-.8)*1.5));
    const t=opts.town?opts.town(x,z):0;
    if(t>0)tmp.lerp(SOIL,t*.35).lerp(DRY,t*.25);                   // trodden ground in town
    const jit=.94+.12*((Math.sin(i*12.9898+j*78.233)*43758.5453)%1+1)%1;
    col[k*3]=tmp.r*jit*gain;col[k*3+1]=tmp.g*jit*gain;col[k*3+2]=tmp.b*jit*gain;
  }
  return col;
}

export function makeTerrainMesh(g:HeightGrid,opts:TerrainOpts={}):THREE.Mesh{
  const {nx,nz,cell,h}=g,n=nx*nz;
  const pos=new Float32Array(n*3),uv=new Float32Array(n*2),col=terrainColors(g,opts);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const k=j*nx+i,x=g.x0+i*cell,z=g.z0+j*cell,y=h[k]-(opts.drop||0);
    pos[k*3]=x;pos[k*3+1]=y;pos[k*3+2]=z;uv[k*2]=x/GROUND_TILE_M;uv[k*2+1]=z/GROUND_TILE_M;
  }
  const idx:number[]=[];
  const sk=opts.skip;
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){
    if(sk){const x=g.x0+(i+.5)*cell,z=g.z0+(j+.5)*cell;if(x>sk.x0&&x<sk.x1&&z>sk.z0&&z<sk.z1)continue;}
    if(opts.fine?.at(i,j))continue;                                 // drawn by makeTerrainFine
    const a=j*nx+i,b=a+1,c=a+nx,d=c+1;
    idx.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geo.setIndex(n>65535?new THREE.Uint32BufferAttribute(idx,1):new THREE.Uint16BufferAttribute(idx,1));
  geo.computeVertexNormals();geo.computeBoundingSphere();
  const m=new THREE.Mesh(geo,opts.mat||terrainMat);
  m.receiveShadow=true;m.matrixAutoUpdate=false;
  return m;
}

// The finer relief's cells (the river's bed and banks), one mesh per tile of `tileSize` m:
// their colour is the coarse grid's, interpolated from the cell's four corners (so they meet
// the cells around them without a seam), darkened toward wet earth and mud by the wetness.
const MUD=C('#3f3326'),WET=C('#5b4a35');
export function makeTerrainFine(g:HeightGrid,fine:FineCells,opts:TerrainOpts={},tileSize=384):THREE.Group{
  const cols=terrainColors(g,opts);
  const n=fine.n,m=n-1,sub=g.cell/m,gain=DETAIL_GAIN,tiles=Math.max(1,Math.round(tileSize/g.cell));
  type B={pos:number[];col:number[];uv:number[];idx:number[];map:Map<number,number>};
  const buckets=new Map<number,B>(),tmp=new THREE.Color(),c00=new THREE.Color(),c10=new THREE.Color(),c01=new THREE.Color(),c11=new THREE.Color();
  const mud=MUD.clone().multiplyScalar(gain),wet=WET.clone().multiplyScalar(gain);
  const nodeCol=(c:THREE.Color,k:number):THREE.Color=>c.setRGB(cols[k*3],cols[k*3+1],cols[k*3+2]);
  for(let j=0;j<g.nz-1;j++)for(let i=0;i<g.nx-1;i++){
    const f=fine.at(i,j);if(!f)continue;
    const key=Math.floor(j/tiles)*1e5+Math.floor(i/tiles);
    let b=buckets.get(key);if(!b){b={pos:[],col:[],uv:[],idx:[],map:new Map()};buckets.set(key,b);}
    nodeCol(c00,j*g.nx+i);nodeCol(c10,j*g.nx+i+1);nodeCol(c01,(j+1)*g.nx+i);nodeCol(c11,(j+1)*g.nx+i+1);
    const vid=(a:number,c:number):number=>{
      const gk=(j*m+c)*(g.nx*m+1)+(i*m+a);                          // one vertex per fine lattice point
      let v=b!.map.get(gk);if(v!==undefined)return v;
      const x=g.x0+i*g.cell+a*sub,z=g.z0+j*g.cell+c*sub,u=a/m,w=c/m,y=f.h[c*n+a]-(opts.drop||0);
      tmp.setRGB(
        (c00.r*(1-u)+c10.r*u)*(1-w)+(c01.r*(1-u)+c11.r*u)*w,
        (c00.g*(1-u)+c10.g*u)*(1-w)+(c01.g*(1-u)+c11.g*u)*w,
        (c00.b*(1-u)+c10.b*u)*(1-w)+(c01.b*(1-u)+c11.b*u)*w);
      const wt=f.wet[c*n+a];
      if(wt>0)tmp.lerp(wet,Math.min(1,wt*1.6)).lerp(mud,Math.max(0,wt-.55)*2.2);
      v=b!.pos.length/3;b!.map.set(gk,v);
      b!.pos.push(x,y,z);b!.col.push(tmp.r,tmp.g,tmp.b);b!.uv.push(x/GROUND_TILE_M,z/GROUND_TILE_M);
      return v;
    };
    for(let c=0;c<m;c++)for(let a=0;a<m;a++){
      const p=vid(a,c),q=vid(a+1,c),r=vid(a,c+1),t=vid(a+1,c+1);
      b.idx.push(p,r,q,q,r,t);                                       // the same b–c diagonals as the grid
    }
  }
  const group=new THREE.Group();group.name='terrain-fine';
  for(const b of buckets.values()){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(b.pos,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(b.col,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));
    geo.setIndex(b.idx);geo.computeVertexNormals();geo.computeBoundingSphere();
    const mesh=new THREE.Mesh(geo,opts.mat||terrainMat);mesh.receiveShadow=true;mesh.matrixAutoUpdate=false;group.add(mesh);
  }
  return group;
}

export function makeTerrainTiles(g:HeightGrid,opts:TerrainOpts={},tileSize=384):THREE.Group{
  const source=makeTerrainMesh(g,opts),tiles=tileTerrainMesh(source,g,tileSize);
  source.geometry.dispose();
  return tiles;
}

// ---- draping flat shapes EXACTLY on the terrain ----
// The relief is a grid of planar triangles (cells of `cell` m, split on the b–c diagonal).
// Cutting a shape along every grid line and diagonal leaves pieces that each lie inside ONE
// terrain triangle, so lifting their corners to the ground gives a surface parallel to the
// ground everywhere — no hill crest poking through a street, no gap under it. With the
// grid's size (nx,nz nodes) the pieces past its edge are dropped: out there the ground is
// the coarse far relief, drawn lower, and a draped strip would hang above it.
// `fine`: cells whose ground is a finer relief (the river corridor, data.ts RIO_FINE: n×n
// nodes per cell, the same b–c diagonals) — pieces there are cut along that lattice too
export type DrapeGrid={x0:number;z0:number;cell:number;nx?:number;nz?:number;fine?:{n:number;at:(i:number,j:number)=>boolean}};
type DV=[number,number,number,number];                     // x, z, u, v (u,v: texture coords)
function split(poly:DV[],f:(p:DV)=>number,k:number,lo:DV[][],hi:DV[]):void{
  const below:DV[]=[];
  hi.length=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],da=f(a)-k,db=f(b)-k;
    if(da<=0)below.push(a);
    if(da>=0)hi.push(a);
    if(da*db<0){
      const t=da/(da-db),p:DV=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t,a[3]+(b[3]-a[3])*t];
      below.push(p);hi.push(p);
    }
  }
  if(below.length>2)lo.push(below);
}
function cutBy(polys:DV[][],f:(p:DV)=>number):DV[][]{
  const out:DV[][]=[];
  for(const poly of polys){
    let mn=Infinity,mx=-Infinity;for(const p of poly){const v=f(p);if(v<mn)mn=v;if(v>mx)mx=v;}
    let rest=poly;
    for(let k=Math.floor(mn)+1;k<mx;k++){const hi:DV[]=[];split(rest,f,k,out,hi);rest=hi;if(rest.length<3)break;}
    if(rest.length>2)out.push(rest);
  }
  return out;
}
// Cut a convex polygon (2D points) along every integer level of each linear function in
// `fns` — e.g. a terrain grid's lines in another frame. Returns the convex pieces.
export function cutAlong(poly:[number,number][],fns:((x:number,z:number)=>number)[]):[number,number][][]{
  let polys:DV[][]=[poly.map(([x,z])=>[x,z,0,0] as DV)];
  for(const f of fns)polys=cutBy(polys,p=>f(p[0],p[1]));
  return polys.map(q=>q.map(p=>[p[0],p[1]] as [number,number]));
}
// Drape CONVEX polygons given flat as (x,z,u,v) per vertex (any winding). Appends world
// positions (and uvs when `uv` is passed) to the output arrays; every triangle faces up.
export function drapePolys(polys:number[][],grid:DrapeGrid,hAt:(x:number,z:number)=>number,lift:number,pos:number[],uv?:number[]):void{
  const fx=(p:DV):number=>(p[0]-grid.x0)/grid.cell,fz=(p:DV):number=>(p[1]-grid.z0)/grid.cell,fd=(p:DV):number=>fx(p)+fz(p);
  for(const flat of polys){
    const shape:DV[]=[];for(let k=0;k<flat.length;k+=4)shape.push([flat[k],flat[k+1],flat[k+2],flat[k+3]]);
    let pieces=cutBy(cutBy(cutBy([shape],fx),fz),fd);
    const F=grid.fine;
    if(F){
      const m=F.n-1,gx=(p:DV):number=>fx(p)*m,gz=(p:DV):number=>fz(p)*m,gd=(p:DV):number=>gx(p)+gz(p);
      pieces=pieces.flatMap(poly=>{
        let cx=0,cz=0;for(const p of poly){cx+=fx(p);cz+=fz(p);}cx/=poly.length;cz/=poly.length;
        return F.at(Math.floor(cx),Math.floor(cz))?cutBy(cutBy(cutBy([poly],gx),gz),gd):[poly];
      });
    }
    for(const poly of pieces){
      if(grid.nx!==undefined&&grid.nz!==undefined){
        let cx=0,cz=0;for(const p of poly){cx+=fx(p);cz+=fz(p);}cx/=poly.length;cz/=poly.length;
        if(cx<0||cz<0||cx>grid.nx-1||cz>grid.nz-1)continue;
      }
      const h=poly.map(p=>hAt(p[0],p[1])+lift);
      for(let k=1;k<poly.length-1;k++){
        const a=poly[0],b=poly[k],c=poly[k+1];
        const area=(b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1]);  // > 0: +y normal for (a,b,c)
        if(Math.abs(area)<1e-7)continue;
        const order=area>0?[0,k,k+1]:[0,k+1,k];
        for(const q of order){pos.push(poly[q][0],h[q],poly[q][1]);if(uv)uv.push(poly[q][2],poly[q][3]);}
      }
    }
  }
}

// Lay a flat polygon (a plaza, a pitch, a cemetery yard) ON the terrain: triangulate, then
// either drape it exactly on the terrain grid (`grid`) or, without one (model viewer),
// subdivide every triangle until its edges are short and lift each vertex to the ground
// height + `lift`. Returns the geometry (caller picks the material).
export function drapePolygon(pts:[number,number][],hAt:(x:number,z:number)=>number,lift=.08,maxEdge=3,grid?:DrapeGrid):THREE.BufferGeometry{
  const contour=pts.map(p=>new THREE.Vector2(p[0],p[1]));
  if(THREE.ShapeUtils.isClockWise(contour))contour.reverse();
  const tris=THREE.ShapeUtils.triangulateShape(contour,[]);
  const out:number[]=[];
  if(grid){
    drapePolys(tris.map(t=>t.flatMap(i=>[contour[i].x,contour[i].y,0,0])),grid,hAt,lift,out);
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
    geo.computeVertexNormals();
    return geo;
  }
  const push=(a:number[],b:number[],c:number[],depth:number):void=>{
    const e=Math.max(Math.hypot(a[0]-b[0],a[1]-b[1]),Math.hypot(b[0]-c[0],b[1]-c[1]),Math.hypot(c[0]-a[0],c[1]-a[1]));
    if(e>maxEdge&&depth<9){
      const ab=[(a[0]+b[0])/2,(a[1]+b[1])/2],bc=[(b[0]+c[0])/2,(b[1]+c[1])/2],ca=[(c[0]+a[0])/2,(c[1]+a[1])/2];
      push(a,ab,ca,depth+1);push(ab,b,bc,depth+1);push(ca,bc,c,depth+1);push(ab,bc,ca,depth+1);return;
    }
    for(const p of[a,c,b])out.push(p[0],hAt(p[0],p[1])+lift,p[1]);   // a,c,b: CCW from above (+y normal)
  };
  for(const[i,j,k]of tris){const A=contour[i],B=contour[j],Cc=contour[k];push([A.x,A.y],[B.x,B.y],[Cc.x,Cc.y],0);}
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(out,3));
  geo.computeVertexNormals();
  // a polygon given counter-clockwise in (x,z) can still come out facing down: flip if so
  const ny=geo.getAttribute('normal');let s=0;for(let i=0;i<ny.count;i++)s+=ny.getY(i);
  if(s<0){const p=geo.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<p.count;i+=3){for(let a=0;a<3;a++){const t=p.getComponent(i+1,a);p.setComponent(i+1,a,p.getComponent(i+2,a));p.setComponent(i+2,a,t);}}
    geo.computeVertexNormals();}
  return geo;
}

// Model-viewer sample: a small hill patch.
function build():THREE.Mesh{
  const nx=40,nz=40,h=new Float32Array(nx*nz);
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)h[j*nx+i]=8+6*Math.sin(i*.2)*Math.cos(j*.17)+j*.3;
  const m=makeTerrainMesh({x0:-80,z0:-80,cell:4,nx,nz,h});
  m.matrixAutoUpdate=true;return m;
}
export default {category:'Divinolândia',label:'Terreno (relevo real)',build};
