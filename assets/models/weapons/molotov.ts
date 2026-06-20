import * as THREE from 'three';

// Coquetel molotov: garrafa de vidro com gasolina dentro, gargalo e um trapo
// em chamas na boca. Pequeno; fica em pé (eixo Y). Serve de modelo empunhado,
// de pickup e também de projétil arremessado (js/combat/weapons.ts).

const glassMat=new THREE.MeshStandardMaterial({color:0x4a6a55,roughness:.1,metalness:.2,
  transparent:true,opacity:.55});
const fuelMat=new THREE.MeshStandardMaterial({color:0xc9a23a,roughness:.3,metalness:.1,
  transparent:true,opacity:.8});
const ragMat=new THREE.MeshStandardMaterial({color:0xd8d2c0,roughness:.9});
const flameMat=new THREE.MeshBasicMaterial({color:0xffb347,transparent:true,opacity:.92});
const glowMat=new THREE.MeshBasicMaterial({color:0xff5f2e,transparent:true,opacity:.3});

export function makeMolotovModel({pickup=false}:{pickup?:boolean}={}): THREE.Group{
  const g=new THREE.Group();
  // corpo da garrafa
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.07,.06,.22,12),glassMat);
  body.position.y=0;body.castShadow=false;g.add(body);
  // gasolina dentro (menor que o corpo)
  const fuel=new THREE.Mesh(new THREE.CylinderGeometry(.055,.05,.14,12),fuelMat);
  fuel.position.y=-.03;g.add(fuel);
  // ombro + gargalo
  const shoulder=new THREE.Mesh(new THREE.CylinderGeometry(.03,.07,.05,12),glassMat);
  shoulder.position.y=.135;g.add(shoulder);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.06,10),glassMat);
  neck.position.y=.19;g.add(neck);
  // trapo enfiado no gargalo
  const rag=new THREE.Mesh(new THREE.CylinderGeometry(.018,.022,.08,8),ragMat);
  rag.position.y=.24;g.add(rag);
  // chama do trapo (treme via userData.flame)
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.035,.12,8),flameMat);
  flame.position.y=.32;g.add(flame);
  g.userData.flame=flame;
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.4,.035,8,24),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.16;g.add(glow);
  }
  return g;
}

export default {category:'Weapons',label:'Molotov Cocktail',build:()=>makeMolotovModel()};
