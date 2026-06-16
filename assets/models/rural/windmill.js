import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Moinho de vento de fazenda: torre treliçada afunilada, roda de pás múltiplas
// (virada p/ +z) e leme (cauda) atrás. Estático (assa nos props). build() é puro;
// addWindmill posiciona, funde nos props e devolve a colisão (base da torre).
const towerM=matte({color:0x6e6258,roughness:.85});
const bladeM=matte({color:0xd8d2c4,roughness:.7});
const hubM=matte({color:0x5b5048,roughness:.8});

function build(){
  const g=new THREE.Group();
  const TH=7,base=1.4,top=.5;
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  // quatro montantes afunilados (treliça aproximada)
  for(const[sx,sz]of corners){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.07,.1,TH,5),towerM);
    leg.position.set(sx*base*.5,TH/2,sz*base*.5);
    leg.rotation.x=sz*.085;leg.rotation.z=-sx*.085;g.add(leg);
  }
  // cintas horizontais em dois níveis (largura afunila com a altura)
  for(const y of[TH*.33,TH*.66]){
    const f=base*(1-y/TH)+top*(y/TH);
    for(let i=0;i<4;i++){
      const a=corners[i],b=corners[(i+1)%4];
      const x0=a[0]*f*.5,z0=a[1]*f*.5,x1=b[0]*f*.5,z1=b[1]*f*.5;
      const len=Math.hypot(x1-x0,z1-z0);
      const bar=new THREE.Mesh(new THREE.BoxGeometry(len,.05,.05),towerM);
      bar.position.set((x0+x1)/2,y,(z0+z1)/2);bar.rotation.y=Math.atan2(z1-z0,x1-x0);g.add(bar);
    }
  }
  // cabeça + roda de pás na frente (+z)
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.4,10),hubM);
  hub.rotation.x=Math.PI/2;hub.position.set(0,TH,.4);g.add(hub);
  const NB=14,L=1.5;
  for(let i=0;i<NB;i++){
    const a=i/NB*Math.PI*2;
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.14,L,.04),bladeM);
    blade.position.set(-Math.sin(a)*L/2,TH+Math.cos(a)*L/2,.5);
    blade.rotation.z=a;g.add(blade);
  }
  // leme/cauda atrás (-z)
  const vane=new THREE.Mesh(new THREE.BoxGeometry(.05,.9,1.4),bladeM);
  vane.position.set(0,TH,-1.1);g.add(vane);
  g.userData.r=base*.5+.3;g.userData.h=TH+1.8;
  return g;
}

export default {category:'Rural',label:'Windmill',build};

export function addWindmill(cx,cz,ry=0){
  const g=build();g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  const r=g.userData.r;
  return{x0:cx-r,x1:cx+r,z0:cz-r,z1:cz+r,h:g.userData.h};
}
