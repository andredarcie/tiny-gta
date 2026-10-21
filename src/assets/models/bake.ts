import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Bake a multi-part model into ONE vertex-coloured geometry, in the space of `root`.
// Every visible Mesh under `root` contributes its triangles, coloured with its material's
// flat colour (per material group for multi-material meshes), so a model made of a dozen
// meshes/materials draws in a single call with one shared material. Flat colours are the
// whole art direction, so nothing is lost but per-part shininess.
//
// Skipped: hidden meshes (or hidden ancestors), invisible materials, textured materials
// (light beams / decals), additive effects, skinned meshes, and anything flagged
// userData.lodKeep (parts that must stay live, e.g. a police light bar that blinks).

const _m=new THREE.Matrix4(),_inv=new THREE.Matrix4(),_c=new THREE.Color();

function isVisibleUnder(o: THREE.Object3D,root: THREE.Object3D): boolean{
  for(let p: THREE.Object3D|null=o;p&&p!==root;p=p.parent)if(!p.visible)return false;
  return true;
}
function bakeable(mat: THREE.Material|undefined): mat is THREE.Material&{color?: THREE.Color}{
  if(!mat||mat.visible===false)return false;
  const m=mat as THREE.MeshStandardMaterial;
  if(m.map||m.blending===THREE.AdditiveBlending)return false;
  return true;
}

// One piece (a whole mesh, or one material group of it) as a non-indexed geometry with
// only position/normal/color, transformed into root space.
function piece(src: THREE.BufferGeometry,xf: THREE.Matrix4,color: THREE.Color,start=0,count=Infinity): THREE.BufferGeometry{
  const flat=src.index?src.toNonIndexed():src;
  const pos=flat.getAttribute('position') as THREE.BufferAttribute;
  const end=Math.min(pos.count,start+count);
  const n=Math.max(0,end-start);
  const p=new Float32Array(n*3),col=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    p[i*3]=pos.getX(start+i);p[i*3+1]=pos.getY(start+i);p[i*3+2]=pos.getZ(start+i);
    col[i*3]=color.r;col[i*3+1]=color.g;col[i*3+2]=color.b;
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(p,3));
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  g.applyMatrix4(xf);
  g.computeVertexNormals();
  return g;
}

/** Merge every bakeable mesh under `root` into one vertex-coloured geometry (root space). */
export function bakeGeometry(root: THREE.Object3D): THREE.BufferGeometry|null{
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const parts: THREE.BufferGeometry[]=[];
  root.traverse(o=>{
    const mesh=o as THREE.Mesh;
    if(!mesh.isMesh||(mesh as unknown as THREE.SkinnedMesh).isSkinnedMesh)return;
    if(o.userData.lodKeep||!isVisibleUnder(o,root))return;
    for(let a: THREE.Object3D|null=o.parent;a&&a!==root;a=a.parent)if(a.userData.lodKeep)return;
    _m.multiplyMatrices(_inv,mesh.matrixWorld);
    const geo=mesh.geometry as THREE.BufferGeometry;
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    if(Array.isArray(mesh.material)&&geo.groups.length){
      const flat=geo.index?geo.toNonIndexed():geo; // group ranges index the flattened vertices
      for(const gr of geo.groups){
        const mat=mats[gr.materialIndex??0];
        if(!bakeable(mat))continue;
        _c.copy(mat.color??_c.set(0xffffff));
        parts.push(piece(flat,_m,_c,gr.start,gr.count));
      }
    }else{
      const mat=mats[0];
      if(!bakeable(mat))return;
      _c.copy(mat.color??_c.set(0xffffff));
      parts.push(piece(geo,_m,_c));
    }
  });
  if(!parts.length)return null;
  const out=mergeGeometries(parts,false);
  for(const p of parts)p.dispose();
  return out;
}

// Shared material for every baked mesh: flat vertex colours, lit like the rest of the world.
export const bakedMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,metalness:.15});
