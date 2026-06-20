import * as THREE from 'three';
import {mergeWeaponMeshes} from './weapon-merge.ts';

// AK-47: receiver de aço, furniture de madeira (forend + coronha), pente
// banana curvo característico, tubo de gás acima do cano e cano com bloco de
// mira. Cano em +Z; userData.muzzlePoint na boca.

const steelMat=new THREE.MeshStandardMaterial({color:0x20232a,roughness:.45,metalness:.75});
const woodMat=new THREE.MeshStandardMaterial({color:0x7a4a26,roughness:.65,metalness:.05});
const magMat=new THREE.MeshStandardMaterial({color:0x3a2412,roughness:.6,metalness:.1});
const glowMat=new THREE.MeshBasicMaterial({color:0xffd24a,transparent:true,opacity:.25});

const cyl=(r:number,len:number,mat:THREE.Material,x:number,y:number,z:number,rx=0): THREE.Mesh=>{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),mat);
  m.position.set(x,y,z);m.rotation.x=rx;m.castShadow=false;return m;
};
const box=(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,rx=0,ry=0,rz=0): THREE.Mesh=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=false;return m;
};

export function makeAk47Model({pickup=false}:{pickup?:boolean}={}): THREE.Group{
  const g=new THREE.Group();
  // cano
  g.add(cyl(.016,.5,steelMat,0,.04,.45,Math.PI/2));
  // tubo de gás acima do cano
  g.add(cyl(.014,.3,steelMat,0,.085,.34,Math.PI/2));
  // forend de madeira
  g.add(box(.06,.08,.22,woodMat,0,.02,.28));
  // bloco de mira na boca + front sight post
  g.add(box(.04,.06,.05,steelMat,0,.05,.66));
  g.add(box(.01,.04,.01,steelMat,0,.1,.66));
  // receiver
  g.add(box(.07,.11,.26,steelMat,0,0,.06));
  // tampa superior + rear sight
  g.add(box(.05,.03,.2,steelMat,0,.07,.04));
  // pente banana curvo (3 segmentos inclinando pra frente)
  g.add(box(.05,.1,.09,magMat,0,-.13,.04,-.18));
  g.add(box(.05,.1,.09,magMat,0,-.22,-.01,-.45));
  g.add(box(.05,.07,.08,magMat,0,-.29,-.08,-.7));
  // punho de pistola
  g.add(box(.05,.13,.08,steelMat,0,-.1,-.12,.3));
  // gatilho
  g.add(box(.03,.04,.05,steelMat,0,-.08,-.05));
  // garganta + coronha de madeira
  g.add(box(.06,.1,.1,woodMat,0,-.04,-.2,.2));
  g.add(box(.055,.12,.26,woodMat,0,.01,-.36,.05));
  const merged=mergeWeaponMeshes(g); // funde peças rígidas por material (visual-idêntico)
  if(pickup){
    const glow=new THREE.Mesh(new THREE.TorusGeometry(.6,.04,8,28),glowMat);
    glow.rotation.x=Math.PI/2;glow.position.y=-.34;merged.add(glow);
  }
  const muzzlePoint=new THREE.Object3D();
  muzzlePoint.position.set(0,.04,.7);
  merged.userData.muzzlePoint=muzzlePoint;merged.add(muzzlePoint);
  return merged;
}

export default {category:'Weapons',label:'AK47',build:()=>makeAk47Model()};
