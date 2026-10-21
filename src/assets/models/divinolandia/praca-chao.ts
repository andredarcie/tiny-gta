import * as THREE from 'three';
import {matte} from '../matte.ts';
import {sextavadoTexture,zigzagTexture,gramaTexture,degrausTexture,settTexture,SEXT_W,SEXT_H,ZIGZAG_TILE_M,GRAMA_TILE_M,SETT_TILE_M} from './texturas.ts';

// Ground kit for the Matriz squares (praca-alcindo.ts, praca-ladislau.ts): surfaces laid
// over the real terrain in a square's own frame (u along the street grid, v across it,
// both in metres). Every surface is draped vertex by vertex on groundAt(u,v) + a lift and
// carries a polygon offset, so the layers (lawn < paths < paved squares < sidewalks) never
// fight each other or the terrain. Not a model: no default export.
export type GroundAt=(u:number,v:number)=>number;
export type P2=[number,number];

const off=(n:number):Partial<THREE.MeshLambertMaterialParameters>=>({polygonOffset:true,polygonOffsetFactor:-n,polygonOffsetUnits:-n});
export const lawnM=matte({color:0x6c9a44,map:gramaTexture(),...off(2)});
export const pathM=matte({map:sextavadoTexture('vermelho'),...off(5)});
export const pathEdgeM=matte({map:sextavadoTexture('cinza'),...off(4)});
export const walkM=matte({map:sextavadoTexture('rosa'),...off(6)});
export const walkEdgeM=matte({map:sextavadoTexture('cinza'),...off(7)});
export const stoneM=matte({color:0xd4cfc3,...off(5)});
export const zigzagM=matte({map:zigzagTexture(),...off(6)});
export const curbM=matte({color:0xd9d5cc,side:THREE.DoubleSide});
export const soilM=matte({color:0x6f4a33,...off(3)});
export const stepsM=matte({map:degrausTexture(),...off(6)});
const stripeM=matte({map:sextavadoTexture('vermelho'),...off(9)});
export const settM=matte({map:settTexture(),...off(3)});
const TILE=new Map<THREE.Material,[number,number]>([[lawnM,[GRAMA_TILE_M,GRAMA_TILE_M]],[pathM,[SEXT_W,SEXT_H]],[pathEdgeM,[SEXT_W,SEXT_H]],
  [walkM,[SEXT_W,SEXT_H]],[walkEdgeM,[SEXT_W,SEXT_H]],[zigzagM,[ZIGZAG_TILE_M,ZIGZAG_TILE_M]],[stoneM,[1,1]],[soilM,[1,1]],[stepsM,[1,1]],[settM,[SETT_TILE_M,SETT_TILE_M]],[stripeM,[SEXT_W,SEXT_H]]]);

// Drape a polygon (with optional holes) on the ground. maxEdge subdivides the triangles so
// the surface follows the slope; `rot` turns the texture (radians) for paths at an angle.
export function drape(pts:P2[],at:GroundAt,lift:number,m:THREE.Material,holes:P2[][]=[],maxEdge=2,rot=0):THREE.Mesh{
  const v2=(p:P2):THREE.Vector2=>new THREE.Vector2(p[0],p[1]);
  let contour=pts.map(v2);if(THREE.ShapeUtils.isClockWise(contour))contour=contour.reverse();
  const hs=holes.map(h=>{let c=h.map(v2);if(!THREE.ShapeUtils.isClockWise(c))c=c.reverse();return c;});
  const all=[...contour,...hs.flat()];
  const tris=THREE.ShapeUtils.triangulateShape(contour,hs);
  const [tw,th]=TILE.get(m)??[1,1],c=Math.cos(rot),s=Math.sin(rot);
  const pos:number[]=[],uv:number[]=[];
  const vert=(p:THREE.Vector2):void=>{pos.push(p.x,at(p.x,p.y)+lift,p.y);uv.push((p.x*c+p.y*s)/tw,(-p.x*s+p.y*c)/th);};
  const split=(a:THREE.Vector2,b:THREE.Vector2,d:THREE.Vector2,depth:number):void=>{
    const ab=a.distanceTo(b),bd=b.distanceTo(d),da=d.distanceTo(a),e=Math.max(ab,bd,da);
    if(e<=maxEdge||depth>8){vert(a);vert(d);vert(b);return;}               // CCW in u-v = facing up after y
    if(e===ab){const m2=a.clone().lerp(b,.5);split(a,m2,d,depth+1);split(m2,b,d,depth+1);}
    else if(e===bd){const m2=b.clone().lerp(d,.5);split(a,b,m2,depth+1);split(a,m2,d,depth+1);}
    else{const m2=d.clone().lerp(a,.5);split(a,b,m2,depth+1);split(m2,b,d,depth+1);}
  };
  for(const[i,j,k]of tris)split(all[i],all[j],all[k],0);
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,m);mesh.receiveShadow=true;return mesh;
}
// rectangle with rounded corners (r) as a polygon, CCW in u-v
export function roundRect(u0:number,u1:number,v0:number,v1:number,r:number,seg=4):P2[]{
  const out:P2[]=[];
  const corner=(cu:number,cv:number,a0:number):void=>{for(let i=0;i<=seg;i++){const a=a0+i/seg*Math.PI/2;out.push([cu+Math.cos(a)*r,cv+Math.sin(a)*r]);}};
  corner(u1-r,v1-r,0);corner(u0+r,v1-r,Math.PI/2);corner(u0+r,v0+r,Math.PI);corner(u1-r,v0+r,Math.PI*1.5);
  return out;
}
// a straight strip (path) of width w from a to b, as a polygon
export function strip(a:P2,b:P2,w:number):P2[]{
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L*w/2,nz=dx/L*w/2;
  return[[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]];
}
export function circle(cu:number,cv:number,r:number,n=28):P2[]{
  const out:P2[]=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;out.push([cu+Math.cos(a)*r,cv+Math.sin(a)*r]);}return out;
}
// a red paver path with its grey paver borders (two layers), from a to b
export function path(g:THREE.Group,at:GroundAt,a:P2,b:P2,w=3):void{
  const rot=Math.atan2(b[1]-a[1],b[0]-a[0]);
  g.add(drape(strip(a,b,w+.5),at,.1,pathEdgeM,[],2,rot));
  g.add(drape(strip(a,b,w),at,.11,pathM,[],2,rot));
}
// a kerb/edging along a closed or open polyline: a continuous band that follows the ground
// (top at ground + h, faces down to ground - drop), sampled every metre
export function kerb(g:THREE.Group,at:GroundAt,pts:P2[],closed:boolean,h:number,w:number,m:THREE.Material=curbM,drop=.25):void{
  const n=closed?pts.length:pts.length-1,pos:number[]=[];
  const quad=(a:number[],b:number[],c:number[],d:number[]):void=>{pos.push(...a,...b,...c,...a,...c,...d);};
  for(let i=0;i<n;i++){
    const[au,av]=pts[i],[bu,bv]=pts[(i+1)%pts.length],L=Math.hypot(bu-au,bv-av);if(L<.05)continue;
    const k=Math.ceil(L),nu=-(bv-av)/L*w/2,nv=(bu-au)/L*w/2;
    for(let j=0;j<k;j++){
      const p=(t:number):[number,number]=>[au+(bu-au)*t,av+(bv-av)*t],[u0,v0]=p(j/k),[u1,v1]=p((j+1)/k);
      const y0=at(u0,v0),y1=at(u1,v1);
      const A=[u0+nu,y0+h,v0+nv],B=[u1+nu,y1+h,v1+nv],C=[u1-nu,y1+h,v1-nv],D=[u0-nu,y0+h,v0-nv];
      const A2=[u0+nu,y0-drop,v0+nv],B2=[u1+nu,y1-drop,v1+nv],C2=[u1-nu,y1-drop,v1-nv],D2=[u0-nu,y0-drop,v0-nv];
      quad(A,D,C,B);quad(A2,A,B,B2);quad(D2,C2,C,D);
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,m);mesh.receiveShadow=true;mesh.castShadow=false;g.add(mesh);
}
// the streets round a block, paved with granite setts (overlaying the town's street mesh):
// a strip outside each edge (widths per side, 0 = leave that street alone), the north and
// south strips running on over the crossings
export function streetsAround(g:THREE.Group,at:GroundAt,u0:number,u1:number,v0:number,v1:number,w:{n:number;s:number;e:number;w:number},m:THREE.Material=settM):void{
  const a=u0-w.w,b=u1+w.e;
  if(w.n)g.add(drape([[a,v0-w.n],[b,v0-w.n],[b,v0],[a,v0]],at,.16,m));
  if(w.s)g.add(drape([[a,v1],[b,v1],[b,v1+w.s],[a,v1+w.s]],at,.16,m));
  if(w.w)g.add(drape([[a,v0],[u0,v0],[u0,v1],[a,v1]],at,.16,m));
  if(w.e)g.add(drape([[u1,v0],[b,v0],[b,v1],[u1,v1]],at,.16,m));
}
// the block's sidewalk: grey hexagonal pavers with a red paver stripe, a granite kerb at the
// street and a low white edging along the lawn; returns the lawn outline
export function sidewalkRing(g:THREE.Group,at:GroundAt,u0:number,u1:number,v0:number,v1:number,w:number):P2[]{
  const outer=roundRect(u0,u1,v0,v1,2.5),inner=roundRect(u0+w,u1-w,v0+w,v1-w,1.2);
  const s0=roundRect(u0+.7,u1-.7,v0+.7,v1-.7,1.8),s1=roundRect(u0+1.15,u1-1.15,v0+1.15,v1-1.15,1.5);
  g.add(drape(outer,at,.17,walkEdgeM,[inner]));
  g.add(drape(s0,at,.175,stripeM,[s1]));
  kerb(g,at,outer,true,.17,.18);kerb(g,at,inner,true,.2,.12);
  return inner;
}
// place an object on the ground of the square at (u,v), turned by ry
export function put(g:THREE.Group,o:THREE.Object3D,at:GroundAt,u:number,v:number,ry=0,lift=0):THREE.Object3D{
  o.position.set(u,at(u,v)+lift,v);o.rotation.y=ry;g.add(o);return o;
}
