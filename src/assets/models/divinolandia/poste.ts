import * as THREE from 'three';
import {matte} from '../matte.ts';

// Poste de rua — the concrete utility pole of the town streets with a curved arm and a
// sodium lamp. Instanced (one InstancedMesh per part for the whole town); the lamp is
// unlit-white by day and reads as a warm glow at night through the bloom pass.
const concreteM=matte({color:0xb8b4ab}),armM=matte({color:0x8d9196});
export const posteLampMat=new THREE.MeshBasicMaterial({color:0xffd9a0});
const poleG=new THREE.CylinderGeometry(.11,.17,8.5,6);poleG.translate(0,4.25,0);
const armG=new THREE.BoxGeometry(.08,.08,2.2);armG.translate(0,8.1,1.1);
const lampG=new THREE.BoxGeometry(.36,.16,.6);lampG.translate(0,7.98,2.1);
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(1,1,1),_p=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0);
// list: {x,y,z,r} — r = yaw so the arm (local +z) reaches over the street
export function makePostes(list:{x:number;y:number;z:number;r:number}[]):THREE.Group{
  const g=new THREE.Group();
  for(const[geo,mat]of[[poleG,concreteM],[armG,armM],[lampG,posteLampMat]] as [THREE.BufferGeometry,THREE.Material][]){
    const im=new THREE.InstancedMesh(geo,mat,list.length);
    list.forEach((t,i)=>{_q.setFromAxisAngle(_up,t.r);_p.set(t.x,t.y,t.z);im.setMatrixAt(i,_m.compose(_p,_q,_s));});
    im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();im.matrixAutoUpdate=false;
    g.add(im);
  }
  return g;
}
function build():THREE.Group{
  const g=makePostes([{x:0,y:0,z:0,r:0}]);g.traverse(o=>{o.matrixAutoUpdate=true;});return g;
}
export default {category:'Divinolândia',label:'Poste de rua',build};
