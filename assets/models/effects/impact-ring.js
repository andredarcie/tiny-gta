import * as THREE from 'three';

export function makeImpactRing(radius,color){
  const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,6,18),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false}));
  ring.rotation.x=Math.PI/2;
  return ring;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Effects',label:'Impact ring',build:o=>makeImpactRing(o.radius??1,o.color??0x19e3ff)};
