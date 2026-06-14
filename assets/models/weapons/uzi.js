import * as THREE from 'three';

// Uzi (SMG compacta): corpo retangular curto, cano fininho na frente, pente
// reto descendo do meio (também serve de pega), coronha de arame dobrável e
// punho de pistola. Cano em +Z; userData.muzzlePoint na boca.

const bodyMat=new THREE.MeshStandardMaterial({color:0x16181c,roughness:.5,metalness:.6});
const steelMat=new THREE.MeshStandardMaterial({color:0x4a4d54,roughness:.35,metalness:1});
const gripMat=new THREE.MeshStandardMaterial({color:0x101013,roughness:.9,metalness:.05});
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=false;return m;
};
const cyl=(r,len,mat,x,y,z,rx=0)=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=false;return m;
};

export function makeUziModel({pickup=false}={}){
  const g=new THREE.Group();
  // receiver (corpo estampado)
  g.add(box(.1,.13,.34,bodyMat,0,0,.02));
  // tampa superior com nervuras
  g.add(box(.085,.04,.3,steelMat,0,.085,.02));
  // cano curto saindo na frente
  g.add(cyl(.018,.2,steelMat,0,-.01,.3,Math.PI/2));
  g.add(cyl(.03,.05,bodyMat,0,-.01,.2,Math.PI/2)); // base do cano
  // pente reto descendo do meio
  g.add(box(.06,.22,.07,bodyMat,0,-.18,.01));
  g.add(box(.062,.04,.072,steelMat,0,-.3,.01)); // base do pente
  // punho de pistola atrás do pente, levemente inclinado
  g.add(box(.06,.16,.08,gripMat,0,-.12,-.13,.18));
  // guarda-mato + gatilho
  g.add(box(.04,.05,.07,bodyMat,0,-.09,-.05));
  // coronha de arame dobrável (dois tubos + apoio)
  g.add(cyl(.01,.26,steelMat,-.05,-.02,-.17,Math.PI/2));
  g.add(cyl(.01,.26,steelMat,.05,-.02,-.17,Math.PI/2));
  g.add(box(.13,.05,.02,steelMat,0,-.02,-.3));
  // mira simples
  g.add(box(.012,.03,.012,steelMat,0,.11,.14));
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.5,.04,8,28),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.34;g.add(glow);
  }
  const muzzlePoint=new THREE.Object3D();
  muzzlePoint.position.set(0,-.01,.4);
  g.userData.muzzlePoint=muzzlePoint;g.add(muzzlePoint);
  return g;
}

export default {category:'Weapons',label:'Uzi',build:()=>makeUziModel()};
