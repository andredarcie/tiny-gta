import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Funde as meshes de um modelo de arma RÍGIDA por MATERIAL: assa a matriz de cada
// mesh (inclusive a dos sub-grupos, ex.: cão/punho) na geometria e funde tudo que
// compartilha o mesmo material num mesh só. Pixels IDÊNTICOS (mesma geometria,
// mesmos materiais), mas o modelo passa de ~20-30 draws para ~1 por material (~6).
//
// Por quê: o modelo da arma na mão é desenhado TODO frame (o jogador está sempre na
// tela e quase sempre armado; gangues/polícia idem nas perseguições), então essa é
// a maior economia visual-neutra de draw calls. Usar só em armas SEM parte animada
// (sem userData.lamp/pilot/flame que o weapons.js mexe). muzzlePoint e o brilho de
// pickup são adicionados DEPOIS da fusão pelo chamador, então ficam de fora.
export function mergeWeaponMeshes(src: THREE.Object3D): THREE.Group{
  src.updateMatrixWorld(true);
  const byMat=new Map<THREE.Material|THREE.Material[],THREE.BufferGeometry[]>();
  src.traverse(o=>{
    if(!(o as THREE.Mesh).isMesh)return;
    const mesh=o as THREE.Mesh;
    const geo=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    let a=byMat.get(mesh.material);if(!a){a=[];byMat.set(mesh.material,a);}
    a.push(geo);
  });
  const g=new THREE.Group();
  for(const[mat,geos]of byMat){
    g.add(new THREE.Mesh(geos.length>1?mergeGeometries(geos,false):geos[0],mat));
  }
  return g;
}
