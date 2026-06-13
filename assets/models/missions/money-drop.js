import * as THREE from 'three';

const dropG=new THREE.BoxGeometry(.5,.5,.5);
const dropM=new THREE.MeshBasicMaterial({color:0x4dff7a});

export function makeMoneyDrop(){
  return new THREE.Mesh(dropG,dropM);
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Money drop',build:()=>makeMoneyDrop()};
