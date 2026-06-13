import * as THREE from 'three';

export function makeStoryBottle(color){
  const mat=new THREE.MeshBasicMaterial({color});
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.16,.18,.55,8),mat);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.25,8),mat);
  neck.position.y=.38;g.add(body,neck);
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Story bottle',build:o=>makeStoryBottle(o.color??0x19e3ff)};
