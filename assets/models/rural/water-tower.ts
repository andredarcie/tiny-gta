import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Caixa d'água: marco visível da vila. Tanque cilíndrico com tampa cônica sobre
// quatro pernas inclinadas travadas por cintas. build() é puro (na origem);
// addWaterTower posiciona, funde nos props e devolve a colisão (base das pernas).
const tankM=matte({color:0x8a9aa0,roughness:.7});    // metal claro
const roofM=matte({color:0x556069,roughness:.7});
const legM=matte({color:0x6e6258,roughness:.85});    // aço/madeira escuro

function build(): THREE.Group {
  const g=new THREE.Group();
  const LEGH=6,R=2.2,TANKH=3,spread=2.0;
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
  // quatro pernas inclinadas (topo junto, base aberta)
  for(const[sx,sz]of corners){
    const leg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,LEGH,6),legM);
    leg.position.set(sx*spread*.6,LEGH/2,sz*spread*.6);
    leg.rotation.x=sz*.12;leg.rotation.z=-sx*.12;leg.castShadow=true;g.add(leg);
  }
  // cinta de travamento a meia altura
  for(let i=0;i<4;i++){
    const a=corners[i],b=corners[(i+1)%4];
    const x0=a[0]*spread*.6,z0=a[1]*spread*.6,x1=b[0]*spread*.6,z1=b[1]*spread*.6;
    const len=Math.hypot(x1-x0,z1-z0);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(len,.1,.1),legM);
    bar.position.set((x0+x1)/2,LEGH*.5,(z0+z1)/2);bar.rotation.y=Math.atan2(z1-z0,x1-x0);g.add(bar);
  }
  // tanque + bandas + tampa cônica
  const tank=new THREE.Mesh(new THREE.CylinderGeometry(R,R,TANKH,14),tankM);
  tank.position.y=LEGH+TANKH/2;tank.castShadow=true;g.add(tank);
  for(const y of[LEGH+.5,LEGH+TANKH-.5]){
    const band=new THREE.Mesh(new THREE.TorusGeometry(R+.02,.06,6,16),roofM);
    band.rotation.x=Math.PI/2;band.position.y=y;g.add(band);
  }
  const cap=new THREE.Mesh(new THREE.ConeGeometry(R+.15,1.1,14),roofM);
  cap.position.y=LEGH+TANKH+.55;cap.castShadow=true;g.add(cap);
  g.userData.r=spread*.6+.4;g.userData.h=LEGH+TANKH+1.2;
  return g;
}

export default {category:'Rural',label:'Water tower',build};

export function addWaterTower(cx: number,cz: number): {x0:number;x1:number;z0:number;z1:number;h:number} {
  const g=build();g.position.set(cx,-.02,cz);bakeProp(g);
  const r=g.userData.r;
  return{x0:cx-r,x1:cx+r,z0:cz-r,z1:cz+r,h:g.userData.h};
}
