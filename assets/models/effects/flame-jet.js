import * as THREE from 'three';

// Jato do lança-chamas: um cone de fogo que sai do bocal, com núcleo claro e
// pontas de chama. Orientado ao longo de +Z (a base na origem, a ponta em +Z).
// Tem vida curta — o weapons.js solta um a cada disparo e o anima/encolhe.

export function makeFlameJetModel(){
  const g=new THREE.Group();
  // corpo do jato (cone deitado apontando +Z)
  const outer=new THREE.Mesh(new THREE.ConeGeometry(.9,3.2,10,1,true),
    new THREE.MeshBasicMaterial({color:0xff6a1e,transparent:true,opacity:.55,
      side:THREE.DoubleSide}));
  outer.rotation.x=Math.PI/2;outer.position.z=1.6;g.add(outer);
  const inner=new THREE.Mesh(new THREE.ConeGeometry(.5,2.6,10,1,true),
    new THREE.MeshBasicMaterial({color:0xffb347,transparent:true,opacity:.75,
      side:THREE.DoubleSide}));
  inner.rotation.x=Math.PI/2;inner.position.z=1.2;g.add(inner);
  const core=new THREE.Mesh(new THREE.ConeGeometry(.22,1.4,8,1,true),
    new THREE.MeshBasicMaterial({color:0xfff0c0,transparent:true,opacity:.9,
      side:THREE.DoubleSide}));
  core.rotation.x=Math.PI/2;core.position.z=.7;g.add(core);
  return g;
}

export default {category:'Effects',label:'Flame Jet',build:()=>makeFlameJetModel()};
