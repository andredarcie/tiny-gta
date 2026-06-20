import * as THREE from 'three';

// Taco de beisebol de madeira: barril cônico (grosso na ponta, fino no punho),
// knob no fim do cabo e enrolado de fita no grip. Orientado ao longo de +Z
// (ponta do barril em +Z, punho em -Z) como as armas de fogo, pra encaixar na
// mão do jogador com o mesmo offset do catálogo.

const woodMat=new THREE.MeshStandardMaterial({color:0xb07b3e,roughness:.72,metalness:.05});
const gripMat=new THREE.MeshStandardMaterial({color:0x2a1d12,roughness:.95,metalness:0});
const knobMat=new THREE.MeshStandardMaterial({color:0x8a5a2c,roughness:.7,metalness:.05});
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

export function makeBaseballBatModel({pickup=false}:{pickup?:boolean}={}): THREE.Group{
  const g=new THREE.Group();
  const len=.92;
  // barril cônico: topo (+Y -> +Z após girar) grosso, base (-Z) fino
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.052,.026,len,12),woodMat);
  barrel.rotation.x=Math.PI/2;barrel.castShadow=false;g.add(barrel);
  // ponta arredondada do barril
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.052,12,8),woodMat);
  cap.position.z=len/2;cap.scale.z=.7;g.add(cap);
  // knob no fim do cabo
  const knob=new THREE.Mesh(new THREE.CylinderGeometry(.03,.034,.04,12),knobMat);
  knob.rotation.x=Math.PI/2;knob.position.z=-len/2-.01;g.add(knob);
  // fita enrolada no grip (anéis pretos perto do punho)
  for(let i=0;i<6;i++){
    const ring=new THREE.Mesh(new THREE.CylinderGeometry(.028,.026,.03,10),gripMat);
    ring.rotation.x=Math.PI/2;ring.position.z=-len/2+.05+i*.045;g.add(ring);
  }
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.55,.04,8,28),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.18;g.add(glow);
  }
  return g;
}

export default {category:'Weapons',label:'Baseball Bat',build:()=>makeBaseballBatModel()};
