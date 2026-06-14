import * as THREE from 'three';

// Detonador de êmbolo (plunger box): a clássica caixa de madeira com o êmbolo
// em T que se aperta pra detonar a carga plantada. Tem uma luz vermelha de
// "armado" que pisca (userData.lamp). Pequeno objeto de mão.

const woodMat=new THREE.MeshStandardMaterial({color:0x6e4a2a,roughness:.7,metalness:.05});
const metalMat=new THREE.MeshStandardMaterial({color:0x33363d,roughness:.4,metalness:.8});
const handleMat=new THREE.MeshStandardMaterial({color:0xc23b3b,roughness:.5,metalness:.2});
const lampMat=new THREE.MeshBasicMaterial({color:0xff3b3b});
const glowMat=new THREE.MeshBasicMaterial({color:0xff5f2e,transparent:true,opacity:.3});

const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=false;return m;
};
const cyl=(r,len,mat,x,y,z,rx=0)=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=false;return m;
};

export function makeDetonatorModel({pickup=false}={}){
  const g=new THREE.Group();
  // caixa
  g.add(box(.18,.12,.13,woodMat,0,0,0));
  // cantoneiras de metal
  g.add(box(.19,.02,.14,metalMat,0,.06,0));
  g.add(box(.19,.02,.14,metalMat,0,-.06,0));
  // êmbolo (haste + T-handle vermelho)
  g.add(cyl(.012,.14,metalMat,0,.12,0));
  g.add(box(.1,.022,.03,handleMat,0,.19,0));
  g.add(cyl(.018,.04,metalMat,0,.075,0)); // colar guia
  // terminais dos fios na frente
  g.add(cyl(.01,.04,metalMat,-.05,-.02,.07,Math.PI/2));
  g.add(cyl(.01,.04,metalMat,.05,-.02,.07,Math.PI/2));
  // luz de armado
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.014,8,6),lampMat);
  lamp.position.set(.06,.02,.07);g.add(lamp);
  g.userData.lamp=lamp;
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.42,.035,8,24),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.1;g.add(glow);
  }
  return g;
}

export default {category:'Weapons',label:'Detonator',build:()=>makeDetonatorModel()};
