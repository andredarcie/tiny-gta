import * as THREE from 'three';

export function makeStoryGem(color: number): THREE.Mesh{
  return new THREE.Mesh(new THREE.OctahedronGeometry(.44,1),
    new THREE.MeshBasicMaterial({color}));
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Story gem',build:(o:{color?:number})=>makeStoryGem(o.color??0x19e3ff)};
