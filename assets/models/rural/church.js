import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Igreja de interior: nave de tábuas claras, telhado de duas águas escuro, torre
// (campanário) com pináculo e cruz, porta e vitrais finos. build() é puro (igreja
// na origem, frente p/ +z); addChurch posiciona no mundo, funde nos props e
// devolve a caixa de colisão (mesmo padrão de farm-house/barn).
const wallM=matte({color:0xf2ece0,roughness:.95});   // tábuas claras
const roofM=matte({color:0x6e4632,roughness:.9});     // telha escura
const trimM=matte({color:0x5e3c24,roughness:.85});    // madeira escura
const doorM=matte({color:0x6e4a32,roughness:.9});
const glassM=matte({color:0x8fb6d8,roughness:.4,side:THREE.DoubleSide}); // vitral azulado
const crossM=matte({color:0xe8e2d2,roughness:.7});

function build(){
  const g=new THREE.Group();
  const W=5,D=8,H=4;                       // nave
  const nave=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wallM);
  nave.position.y=H/2;nave.castShadow=true;nave.receiveShadow=true;g.add(nave);
  // telhado de duas águas (cumeeira no eixo z)
  const RISE=1.8,OVER=.4,half=W/2+OVER,slope=Math.hypot(half,RISE),ang=Math.atan2(RISE,half);
  for(const s of[-1,1]){
    const pane=new THREE.Mesh(new THREE.BoxGeometry(slope,.18,D+OVER*2),roofM);
    pane.position.set(s*half/2,H+RISE/2,0);pane.rotation.z=-s*ang;pane.castShadow=true;g.add(pane);
  }
  // frontões triangulares fechando o vão sob o telhado
  const gable=new THREE.Shape();
  gable.moveTo(-W/2,0);gable.lineTo(W/2,0);gable.lineTo(0,RISE);gable.closePath();
  const gableGeo=new THREE.ShapeGeometry(gable);
  for(const[z,ry]of[[-D/2,Math.PI],[D/2,0]]){
    const tri=new THREE.Mesh(gableGeo,wallM);tri.position.set(0,H,z);tri.rotation.y=ry;g.add(tri);
  }
  // torre/campanário na frente (+z)
  const TW=1.8,TH=6.2,tz=D/2-.2;
  const tower=new THREE.Mesh(new THREE.BoxGeometry(TW,TH,TW),wallM);
  tower.position.set(0,TH/2,tz);tower.castShadow=true;g.add(tower);
  // pináculo (pirâmide de 4 lados) + cruz no topo
  const spire=new THREE.Mesh(new THREE.ConeGeometry(TW*.8,2.2,4),roofM);
  spire.position.set(0,TH+1.1,tz);spire.rotation.y=Math.PI/4;spire.castShadow=true;g.add(spire);
  const cv=new THREE.Mesh(new THREE.BoxGeometry(.16,.9,.16),crossM);cv.position.set(0,TH+2.55,tz);g.add(cv);
  const ch=new THREE.Mesh(new THREE.BoxGeometry(.55,.16,.16),crossM);ch.position.set(0,TH+2.7,tz);g.add(ch);
  // abertura do sino (vão escuro nas duas faces da torre)
  for(const sz0 of[-1,1]){
    const bell=new THREE.Mesh(new THREE.BoxGeometry(TW-.6,1,.06),trimM);
    bell.position.set(0,TH-1.2,tz+sz0*(TW/2+.02));g.add(bell);
  }
  // porta dupla na base da torre
  const door=new THREE.Mesh(new THREE.BoxGeometry(1.1,2.2,.1),doorM);
  door.position.set(0,1.1,tz+TW/2+.04);g.add(door);
  // vitrais nas laterais da nave
  for(const sx of[-1,1])for(const dz of[-2,0,2]){
    const win=new THREE.Mesh(new THREE.PlaneGeometry(.6,1.7),glassM);
    win.position.set(sx*(W/2+.03),2.1,dz);win.rotation.y=sx>0?-Math.PI/2:Math.PI/2;g.add(win);
  }
  g.userData.r=Math.max(W,D)/2+.3;g.userData.h=H+RISE+.5;
  return g;
}

export default {category:'Rural',label:'Country church',build};

export function addChurch(cx,cz,ry=0){
  const g=build();g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  // colisão: AABB cobrindo nave + torre (válida p/ ry 0 ou π, usados na vila)
  return{x0:cx-2.8,x1:cx+2.8,z0:cz-4.4,z1:cz+4.4,h:g.userData.h};
}
