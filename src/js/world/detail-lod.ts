import * as THREE from 'three';

// Distance LOD for the fine detail of the merged town batches. Two thirds of a surveyed
// street's triangles are smaller than a 15 cm square — window frames, grille bars,
// louvre slats, ridge tiles, sills — and past ~160 m such a triangle is under a pixel.
// After a group is merged (mergeStatic, world-space meshes), splitDetail() splits each
// merged mesh by triangle: the big ones stay in the mesh, the small ones go to "detail"
// meshes, one per 100 m cell, that are only drawn when the camera is near their cell.
// The pieces SHARE the original vertex attributes (only the index differs), so this
// costs no extra vertex memory.
const DETAIL_AREA=.02;    // m²: a triangle smaller than this is detail
const CELL=100;           // m: detail is cut into cells of this size
export const DETAIL_DIST=160; // m: a cell's detail shows within this distance of the camera
const MIN_CELL_TRIS=600;  // a cell with less detail than this keeps it in the main mesh (not worth a draw)

interface Cell{mesh:THREE.Mesh;x:number;y:number;z:number;r:number}
const cells:Cell[]=[];

const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_c=new THREE.Vector3(),_t=new THREE.Triangle();
// a geometry drawing `index` of `src`'s vertices (the same attribute objects), bounded by them
function subset(src:THREE.BufferGeometry,index:number[]):THREE.BufferGeometry{
  const g=new THREE.BufferGeometry();
  for(const[k,a]of Object.entries(src.attributes))g.setAttribute(k,a);
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(index),1));
  const pos=src.getAttribute('position') as THREE.BufferAttribute,box=new THREE.Box3(),v=new THREE.Vector3();
  for(const i of index)box.expandByPoint(v.fromBufferAttribute(pos,i));
  g.boundingBox=box;g.boundingSphere=box.getBoundingSphere(new THREE.Sphere());
  return g;
}

export function splitDetail(root:THREE.Group):void{
  for(const o of[...root.children]){
    const m=o as THREE.Mesh;
    if(!m.isMesh||Array.isArray(m.material))continue;
    const g=m.geometry as THREE.BufferGeometry,pos=g.getAttribute('position') as THREE.BufferAttribute;
    if(!pos)continue;
    const idx=g.index,n=idx?idx.count:pos.count;
    if(n<3*64)continue;                                     // too small to be worth it
    const big:number[]=[],detail=new Map<string,number[]>();
    for(let i=0;i+2<n;i+=3){
      const i0=idx?idx.getX(i):i,i1=idx?idx.getX(i+1):i+1,i2=idx?idx.getX(i+2):i+2;
      _a.fromBufferAttribute(pos,i0);_b.fromBufferAttribute(pos,i1);_c.fromBufferAttribute(pos,i2);
      if(_t.set(_a,_b,_c).getArea()>=DETAIL_AREA){big.push(i0,i1,i2);continue;}
      const k=Math.floor((_a.x+_b.x+_c.x)/3/CELL)+'_'+Math.floor((_a.z+_b.z+_c.z)/3/CELL);
      let l=detail.get(k);if(!l){l=[];detail.set(k,l);}l.push(i0,i1,i2);
    }
    for(const[k,l]of detail)if(l.length<3*MIN_CELL_TRIS){for(const i of l)big.push(i);detail.delete(k);}
    if(!detail.size||big.length===0&&detail.size===1)continue;
    m.geometry=subset(g,big);m.visible=big.length>0;
    for(const l of detail.values()){
      const dg=subset(g,l),dm=new THREE.Mesh(dg,m.material);
      dm.castShadow=m.castShadow;dm.receiveShadow=m.receiveShadow;dm.renderOrder=m.renderOrder;
      dm.layers.mask=m.layers.mask;dm.matrixAutoUpdate=false;dm.matrix.copy(m.matrix);dm.matrixWorld.copy(m.matrixWorld);
      root.add(dm);
      const s=dg.boundingSphere!;cells.push({mesh:dm,x:s.center.x,y:s.center.y,z:s.center.z,r:s.radius});
    }
  }
}

// per frame: show a cell's detail only near the camera (3D: from high up it is too small too)
export function updateDetailLod(cam:THREE.Vector3):void{
  for(const c of cells){
    const d=DETAIL_DIST+c.r,dx=c.x-cam.x,dy=c.y-cam.y,dz=c.z-cam.z;
    c.mesh.visible=dx*dx+dy*dy+dz*dz<d*d;
  }
}
