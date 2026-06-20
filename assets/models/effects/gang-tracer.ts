import * as THREE from 'three';

const gangTracerMat=new THREE.LineBasicMaterial({color:0xffd9a8,transparent:true,opacity:.9});

export function makeGangTracerLine(a: THREE.Vector3, b: THREE.Vector3): THREE.Line{
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),gangTracerMat.clone());
}
