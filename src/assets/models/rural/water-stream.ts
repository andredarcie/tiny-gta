import * as THREE from 'three';

// A falling ribbon of water (a bucket pour, the standpipe running into the bucket).
// Unit length along -Y from the origin, slightly flared toward the bottom; the system
// stretches it between the two world points each frame (userData.span(a,b,width)).
const geo=new THREE.CylinderGeometry(1,1.35,1,10,1,true);
geo.translate(0,-.5,0);
const mat=new THREE.MeshBasicMaterial({color:0x7cc4ff,transparent:true,opacity:.62,
  depthWrite:false,side:THREE.DoubleSide});

const _d=new THREE.Vector3(),_down=new THREE.Vector3(0,-1,0);

export function makeWaterStream(): THREE.Mesh{
  const m=new THREE.Mesh(geo,mat);
  m.frustumCulled=false;          // stretched every frame; bounds of the unit mesh would lie
  m.renderOrder=4;
  // Stretch from world point a (top) to b (bottom), `w` metres thick at the top.
  m.userData.span=(a: THREE.Vector3,b: THREE.Vector3,w: number)=>{
    _d.subVectors(b,a);
    const len=_d.length()||1e-4;
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(_down,_d.normalize());
    m.scale.set(w,len,w);
  };
  return m;
}

export default {category:'Rural',label:'Water stream',build:()=>{
  const m=makeWaterStream();m.scale.set(.05,.6,.05);return m;},zoom:3};
