import * as THREE from 'three';
import {mergeWeaponMeshes} from './weapon-merge.js';

// Espingarda pump-action: cano longo com tubo-magazine por baixo, bomba
// (forend) deslizante de madeira, receiver de aço e coronha de madeira.
// Cano em +Z; userData.muzzlePoint na boca.

const steelMat=new THREE.MeshStandardMaterial({color:0x2c2f35,roughness:.4,metalness:.85});
const blueMat=new THREE.MeshStandardMaterial({color:0x16181c,roughness:.45,metalness:.7});
const woodMat=new THREE.MeshStandardMaterial({color:0x6e3f22,roughness:.7,metalness:.05});
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

const cyl=(r,len,mat,x,y,z,rx=0)=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=false;return m;
};
const box=(w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=false;return m;
};

export function makeShotgunModel({pickup=false}={}){
  const g=new THREE.Group();
  // cano longo
  g.add(cyl(.026,.78,steelMat,0,.02,.42,Math.PI/2));
  // tubo-magazine por baixo do cano
  g.add(cyl(.022,.62,blueMat,0,-.03,.32,Math.PI/2));
  // boca/choke
  g.add(cyl(.03,.05,steelMat,0,.02,.8,Math.PI/2));
  // receiver
  g.add(box(.07,.1,.26,blueMat,0,0,.0));
  // forend de madeira (bomba) sob o cano
  g.add(box(.07,.07,.22,woodMat,0,-.04,.26));
  for(let i=0;i<3;i++)g.add(box(.075,.012,.012,steelMat,0,-.075,.18+i*.06));
  // gatilho + guarda-mato
  g.add(box(.05,.05,.07,blueMat,0,-.07,-.06));
  // grip/garganta da coronha
  g.add(box(.06,.13,.1,woodMat,0,-.09,-.18,.32));
  // coronha de madeira
  g.add(box(.06,.14,.28,woodMat,0,-.02,-.34,.06));
  g.add(box(.062,.16,.04,blueMat,0,-.02,-.48)); // cano da coronha (butt plate)
  // mira de esfera na boca
  g.add(box(.012,.025,.012,steelMat,0,.05,.74));
  const merged=mergeWeaponMeshes(g); // funde peças rígidas por material (visual-idêntico)
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.6,.04,8,28),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.2;merged.add(glow);
  }
  const muzzlePoint=new THREE.Object3D();
  muzzlePoint.position.set(0,.02,.82);
  merged.userData.muzzlePoint=muzzlePoint;merged.add(muzzlePoint);
  return merged;
}

export default {category:'Weapons',label:'Shotgun',build:()=>makeShotgunModel()};
