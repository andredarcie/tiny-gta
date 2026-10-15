import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';

// Divinolândia terrain — the real relief (SRTM) of the town and the serras around it,
// drawn from a baked height grid. The triangles are EXACTLY the ones the physics
// interpolates (src/js/world/divinolandia/data.ts triH: corners a,b,c,d, diagonal b–c),
// so cars and feet sit on what is drawn. Colour is painted per vertex: green pasture,
// darker wood in the folds, dry grass and bare terra-roxa on the steep cuts, and a
// trodden earth tone inside the town.
export type HeightGrid={x0:number;z0:number;cell:number;nx:number;nz:number;h:Float32Array};
const C=(hex:string|number):THREE.Color=>new THREE.Color(hex);
const PAST=C(DIVINO.pasture),DRY=C(DIVINO.pastureDry),WOOD=C(DIVINO.forest),SOIL=C(DIVINO.soil),ROCK=C(DIVINO.rock);
export const terrainMat=matte({vertexColors:true});
export const farTerrainMat=matte({vertexColors:true});

// Smooth-ish value noise (cheap trig) for the land-cover patches.
const vn=(x:number,z:number):number=>Math.sin(x*.0061+1.3)*Math.cos(z*.0053-.7)+.6*Math.sin(x*.0127-z*.0094+2.1)+.35*Math.sin(z*.021+x*.017);

export function makeTerrainMesh(g:HeightGrid,opts:{town?:(x:number,z:number)=>number;skip?:{x0:number;x1:number;z0:number;z1:number};drop?:number;mat?:THREE.Material}={}):THREE.Mesh{
  const {nx,nz,cell,h}=g,n=nx*nz;
  const pos=new Float32Array(n*3),col=new Float32Array(n*3),tmp=new THREE.Color();
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const k=j*nx+i,x=g.x0+i*cell,z=g.z0+j*cell,y=h[k]-(opts.drop||0);
    pos[k*3]=x;pos[k*3+1]=y;pos[k*3+2]=z;
    const hl=h[j*nx+Math.max(0,i-1)],hr=h[j*nx+Math.min(nx-1,i+1)],hu=h[Math.max(0,j-1)*nx+i],hd=h[Math.min(nz-1,j+1)*nx+i];
    const slope=Math.hypot(hr-hl,hd-hu)/(2*cell);
    const v=vn(x,z);
    tmp.copy(PAST).lerp(DRY,Math.max(0,Math.min(1,.5+.5*Math.sin(x*.013+z*.009))*.45));
    if(v>.7)tmp.lerp(WOOD,Math.min(1,(v-.7)*2.2));                 // wood patches
    // concave folds (valleys) are wooded in the serra: compare with the neighbours' mean
    const conc=(hl+hr+hu+hd)/4-h[k];
    if(conc>.25)tmp.lerp(WOOD,Math.min(.85,(conc-.25)*.9));
    if(slope>.45)tmp.lerp(SOIL,Math.min(.7,(slope-.45)*2));         // raw cuts on steep banks
    if(slope>.8)tmp.lerp(ROCK,Math.min(.6,(slope-.8)*1.5));
    const t=opts.town?opts.town(x,z):0;
    if(t>0)tmp.lerp(SOIL,t*.35).lerp(DRY,t*.25);                   // trodden ground in town
    const jit=.94+.12*((Math.sin(i*12.9898+j*78.233)*43758.5453)%1+1)%1;
    col[k*3]=tmp.r*jit;col[k*3+1]=tmp.g*jit;col[k*3+2]=tmp.b*jit;
  }
  const idx:number[]=[];
  const sk=opts.skip;
  for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){
    if(sk){const x=g.x0+(i+.5)*cell,z=g.z0+(j+.5)*cell;if(x>sk.x0&&x<sk.x1&&z>sk.z0&&z<sk.z1)continue;}
    const a=j*nx+i,b=a+1,c=a+nx,d=c+1;
    idx.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.setIndex(n>65535?new THREE.Uint32BufferAttribute(idx,1):new THREE.Uint16BufferAttribute(idx,1));
  geo.computeVertexNormals();geo.computeBoundingSphere();
  const m=new THREE.Mesh(geo,opts.mat||terrainMat);
  m.receiveShadow=true;m.matrixAutoUpdate=false;
  return m;
}

// Lay a flat polygon (a plaza, a pitch, a cemetery yard) ON the terrain: triangulate,
// subdivide every triangle until its edges are short, and lift each vertex to the
// ground height + `lift`. Returns the geometry (caller picks the material).
export function drapePolygon(pts:[number,number][],hAt:(x:number,z:number)=>number,lift=.08,maxEdge=3):THREE.BufferGeometry{
  const contour=pts.map(p=>new THREE.Vector2(p[0],p[1]));
  if(THREE.ShapeUtils.isClockWise(contour))contour.reverse();
  const tris=THREE.ShapeUtils.triangulateShape(contour,[]);
  const out:number[]=[];
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
