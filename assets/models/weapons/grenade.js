import * as THREE from 'three';

// Granada de mão tipo "abacaxi": corpo ovóide ranhurado em ferro fundido,
// espoleta com alavanca de segurança (spoon) e anel do pino no topo. Pequena.
// Serve de modelo empunhado, de pickup e de projétil arremessado.

const ironMat=new THREE.MeshStandardMaterial({color:0x3a4a32,roughness:.65,metalness:.4});
const steelMat=new THREE.MeshStandardMaterial({color:0x6a6d72,roughness:.4,metalness:.9});
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

export function makeGrenadeModel({pickup=false}={}){
  const g=new THREE.Group();
  // corpo ovóide
  const body=new THREE.Mesh(new THREE.SphereGeometry(.07,12,10),ironMat);
  body.scale.set(1,1.25,1);body.castShadow=false;g.add(body);
  // ranhuras (anéis horizontais)
  for(let i=-1;i<=1;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.066,.006,6,16),ironMat);
    ring.rotation.x=Math.PI/2;ring.position.y=i*.035;g.add(ring);
  }
  // espoleta no topo
  const fuze=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.04,10),steelMat);
  fuze.position.y=.095;g.add(fuze);
  // alavanca de segurança (spoon) descendo pela lateral
  const spoon=new THREE.Mesh(new THREE.BoxGeometry(.012,.13,.03),steelMat);
  spoon.position.set(.04,.04,0);spoon.rotation.z=.12;g.add(spoon);
  // anel do pino
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.022,.005,6,14),steelMat);
  ring.position.set(-.03,.11,0);ring.rotation.y=Math.PI/2;g.add(ring);
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.36,.03,8,24),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.12;g.add(glow);
  }
  return g;
}

export default {category:'Weapons',label:'Grenade',build:()=>makeGrenadeModel()};
