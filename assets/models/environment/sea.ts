import * as THREE from 'three';

export function makeSea(): THREE.Mesh{
  const sea=new THREE.Mesh(new THREE.CircleGeometry(1400,40),
    new THREE.MeshStandardMaterial({color:0x2e9ec4,roughness:.3,metalness:.2}));
  sea.rotation.x=-Math.PI/2;
  sea.position.y=-.32;
  return sea;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Environment',label:'Sea',build:()=>makeSea()};
