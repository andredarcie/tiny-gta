import * as THREE from 'three';

const bulletMat=new THREE.MeshBasicMaterial({color:0xfff4a8});
const bulletCoreMat=new THREE.MeshBasicMaterial({color:0xffffff});

export function makeBulletModel(): THREE.Group{
  const g=new THREE.Group();
  const slug=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.52,8),bulletMat);
  const core=new THREE.Mesh(new THREE.SphereGeometry(.075,8,6),bulletCoreMat);
  slug.rotation.x=Math.PI/2;
  core.position.z=.28;
  g.add(slug,core);
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Effects',label:'Bullet',build:()=>makeBulletModel()};
