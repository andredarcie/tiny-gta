import * as THREE from 'three';

// Lança-chamas: a parte empunhada é a vareta (wand) com um tanquinho de
// combustível por baixo, mangueira, bocal e uma chama-piloto sempre acesa na
// boca. Bocal em +Z; userData.muzzlePoint na ponta. A versão pickup recebe
// também o tanque maior (mochila) só pra leitura no chão.

const metalMat=new THREE.MeshStandardMaterial({color:0x35383f,roughness:.5,metalness:.7});
const tankMat=new THREE.MeshStandardMaterial({color:0xb0432a,roughness:.6,metalness:.3});
const gripMat=new THREE.MeshStandardMaterial({color:0x101013,roughness:.9,metalness:.05});
const hoseMat=new THREE.MeshStandardMaterial({color:0x18181b,roughness:.85,metalness:.1});
const pilotMat=new THREE.MeshBasicMaterial({color:0xffb347,transparent:true,opacity:.9});
const glowMat=new THREE.MeshBasicMaterial({color:0xff5f2e,transparent:true,opacity:.3});

const cyl=(r,len,mat,x,y,z,rx=0)=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=false;return m;
};
const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=false;return m;
};

export function makeFlamethrowerModel({pickup=false}={}){
  const g=new THREE.Group();
  // vareta principal
  g.add(cyl(.026,.6,metalMat,0,.02,.28,Math.PI/2));
  // bocal (boca larga)
  g.add(cyl(.045,.08,metalMat,0,.02,.56,Math.PI/2));
  g.add(cyl(.05,.02,metalMat,0,.02,.6,Math.PI/2));
  // chama-piloto na boca
  const pilot=new THREE.Mesh(new THREE.ConeGeometry(.03,.1,8),pilotMat);
  pilot.rotation.x=Math.PI/2;pilot.position.set(0,.06,.62);g.add(pilot);
  g.userData.pilot=pilot;
  // tanquinho de combustível sob a vareta
  const tank=cyl(.05,.26,tankMat,0,-.08,.14,Math.PI/2);g.add(tank);
  g.add(cyl(.052,.02,metalMat,0,-.08,.0,Math.PI/2));
  // mangueira ligando o tanque à vareta
  g.add(cyl(.012,.12,hoseMat,0,-.03,.0,.6));
  // punho + gatilho
  g.add(box(.05,.14,.08,gripMat,0,-.1,-.04,.16));
  g.add(box(.03,.04,.05,metalMat,0,-.06,.03));
  // segundo punho na frente
  g.add(box(.04,.1,.06,gripMat,0,-.06,.28,-.2));
  if(pickup){
    // mochila/tanque grande só na versão de chão
    const big=cyl(.11,.34,tankMat,0,-.02,-.34,Math.PI/2);g.add(big);
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.6,.05,8,28),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.2;g.add(glow);
  }
  const muzzlePoint=new THREE.Object3D();
  muzzlePoint.position.set(0,.04,.64);
  g.userData.muzzlePoint=muzzlePoint;g.add(muzzlePoint);
  return g;
}

export default {category:'Weapons',label:'Flamethrower',build:()=>makeFlamethrowerModel()};
