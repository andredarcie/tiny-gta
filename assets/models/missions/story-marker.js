import * as THREE from 'three';

export function makeStoryMarker(color){
  const mat=new THREE.MeshBasicMaterial({color});
  const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.52,0),mat);
  return{marker,mat};
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Story marker',build:o=>makeStoryMarker(o.color??0xffd24a)};
