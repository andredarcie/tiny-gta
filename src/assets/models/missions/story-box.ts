import * as THREE from 'three';

export function makeStoryBox(color: number): THREE.Mesh{
  return new THREE.Mesh(new THREE.BoxGeometry(.62,.42,.42),
    new THREE.MeshBasicMaterial({color}));
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Story box',build:(o:{color?:number})=>makeStoryBox(o.color??0xffd24a)};
