import * as THREE from 'three';

// M16: fuzil preto de polímero com a alça de transporte (carry handle) e mira
// triangular dianteira icônicas, handguard triangular, pente reto e coronha
// fixa. Cano em +Z; userData.muzzlePoint na boca.

const blkMat=new THREE.MeshStandardMaterial({color:0x14151a,roughness:.55,metalness:.4});
const steelMat=new THREE.MeshStandardMaterial({color:0x33363d,roughness:.4,metalness:.85});
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

const cyl=(r,len,mat,x,y,z,rx=0)=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=false;return m;
};
const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=false;return m;
};

export function makeM16Model({pickup=false}={}){
  const g=new THREE.Group();
  // cano fino e comprido
  g.add(cyl(.013,.56,steelMat,0,.04,.5,Math.PI/2));
  g.add(cyl(.022,.06,blkMat,0,.04,.78,Math.PI/2)); // flash hider
  // handguard triangular (forend)
  g.add(box(.06,.08,.26,blkMat,0,.02,.36));
  // bloco/mira triangular dianteira
  g.add(box(.03,.09,.04,blkMat,0,.08,.5));
  g.add(box(.012,.05,.012,blkMat,0,.13,.5));
  // upper receiver
  g.add(box(.06,.08,.26,blkMat,0,.03,.08));
  // alça de transporte (carry handle) por cima, com vão
  g.add(box(.05,.018,.2,blkMat,0,.11,.05));
  g.add(box(.014,.05,.018,blkMat,-.018,.075,.12));
  g.add(box(.014,.05,.018,blkMat,.018,.075,.12));
  g.add(box(.04,.04,.04,blkMat,0,.1,-.04)); // rear sight tower
  // lower receiver + pente reto
  g.add(box(.055,.06,.1,blkMat,0,-.04,.0));
  g.add(box(.05,.18,.085,steelMat,0,-.16,-.02));
  // punho de pistola
  g.add(box(.05,.12,.07,blkMat,0,-.1,-.12,.28));
  g.add(box(.03,.04,.05,blkMat,0,-.07,-.05)); // gatilho
  // coronha fixa
  g.add(box(.055,.1,.24,blkMat,0,.0,-.26,.04));
  g.add(box(.06,.13,.035,blkMat,0,.0,-.39)); // butt plate
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.6,.04,8,28),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.3;g.add(glow);
  }
  const muzzlePoint=new THREE.Object3D();
  muzzlePoint.position.set(0,.04,.82);
  g.userData.muzzlePoint=muzzlePoint;g.add(muzzlePoint);
  return g;
}

export default {category:'Weapons',label:'M16',build:()=>makeM16Model()};
