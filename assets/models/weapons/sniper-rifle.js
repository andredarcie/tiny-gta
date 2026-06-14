import * as THREE from 'three';

// Rifle de precisão: cano longo e fino, luneta (scope) grande em cima com
// lentes, ferrolho (bolt) lateral, bipé recolhido e coronha de madeira com
// apoio de bochecha. Cano em +Z; userData.muzzlePoint na boca.

const blkMat=new THREE.MeshStandardMaterial({color:0x14161b,roughness:.5,metalness:.55});
const steelMat=new THREE.MeshStandardMaterial({color:0x3a3d44,roughness:.35,metalness:1});
const woodMat=new THREE.MeshStandardMaterial({color:0x5d3a20,roughness:.7,metalness:.05});
const lensMat=new THREE.MeshStandardMaterial({color:0x2a6ec2,roughness:.15,metalness:.3,
  emissive:0x16324f,emissiveIntensity:.5});
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

const cyl=(r,len,mat,x,y,z,rx=0)=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=true;return m;
};
const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;return m;
};

export function makeSniperRifleModel({pickup=false}={}){
  const g=new THREE.Group();
  // cano comprido + supressor de boca
  g.add(cyl(.014,.74,steelMat,0,.03,.5,Math.PI/2));
  g.add(cyl(.024,.1,blkMat,0,.03,.82,Math.PI/2));
  // forend de madeira
  g.add(box(.05,.07,.3,woodMat,0,-.01,.3));
  // receiver
  g.add(box(.06,.09,.24,blkMat,0,0,.04));
  // ferrolho (bolt handle) saindo do lado
  g.add(cyl(.012,.1,steelMat,.07,.02,-.04,0));
  const boltKnob=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),steelMat);
  boltKnob.position.set(.12,.02,-.04);g.add(boltKnob);
  // luneta: corpo + duas tampas de lente
  const scope=cyl(.03,.34,blkMat,0,.12,.06,Math.PI/2);g.add(scope);
  g.add(cyl(.038,.03,blkMat,0,.12,.23,Math.PI/2)); // sino frontal
  g.add(cyl(.034,.012,lensMat,0,.12,.245,Math.PI/2)); // lente frontal
  g.add(cyl(.03,.012,lensMat,0,.12,-.11,Math.PI/2));  // lente ocular
  // montagem da luneta (dois anéis)
  g.add(box(.02,.05,.02,blkMat,0,.07,.16));
  g.add(box(.02,.05,.02,blkMat,0,.07,-.04));
  // punho de pistola
  g.add(box(.05,.12,.07,blkMat,0,-.1,-.12,.26));
  g.add(box(.03,.04,.05,blkMat,0,-.07,-.05)); // gatilho
  // coronha de madeira com cheek riser
  g.add(box(.055,.13,.28,woodMat,0,-.02,-.32,.05));
  g.add(box(.05,.04,.16,woodMat,0,.06,-.28)); // apoio de bochecha
  // bipé recolhido sob o cano
  g.add(cyl(.008,.16,steelMat,-.03,-.06,.58,.5));
  g.add(cyl(.008,.16,steelMat,.03,-.06,.58,.5));
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.62,.04,8,28),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.22;g.add(glow);
  }
  const muzzlePoint=new THREE.Object3D();
  muzzlePoint.position.set(0,.03,.88);
  g.userData.muzzlePoint=muzzlePoint;g.add(muzzlePoint);
  return g;
}

export default {category:'Weapons',label:'Sniper Rifle',build:()=>makeSniperRifleModel()};
