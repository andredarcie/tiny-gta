import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Placa de boas-vindas da vila: dois postes e uma tábua com texto pintado num
// canvas (legível dos dois lados). build() é puro (na origem, tábua p/ ±z);
// addTownSign posiciona, funde nos props e devolve a colisão dos postes.
const postM=matte({color:0x6e4a32,roughness:.9});
const railM=matte({color:0x5e3c24,roughness:.85});

let tex: THREE.CanvasTexture|null=null;
function signTexture(): THREE.CanvasTexture {
  if(tex)return tex;
  const c=document.createElement('canvas');c.width=320;c.height=128;
  const x=c.getContext('2d')!;
  x.fillStyle='#3a2818';x.fillRect(0,0,320,128);
  x.fillStyle='#e8d9b6';x.fillRect(8,8,304,112);
  x.fillStyle='#3a2818';x.textAlign='center';x.textBaseline='middle';
  x.font='900 26px monospace';x.fillText('WELCOME TO',160,40);
  x.font='900 40px monospace';x.fillText('PINE HOLLOW',160,84);
  tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}

function build(): THREE.Group {
  const g=new THREE.Group();
  for(const sx of[-1.7,1.7]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.18,3,.18),postM);
    post.position.set(sx,1.5,0);post.castShadow=true;g.add(post);
  }
  const rail=new THREE.Mesh(new THREE.BoxGeometry(3.6,.16,.16),railM);
  rail.position.set(0,2.95,0);g.add(rail);
  // tábua: uma só material (DoubleSide) p/ os dois lados fundirem num mesh
  const boardM=new THREE.MeshBasicMaterial({map:signTexture(),side:THREE.DoubleSide});
  for(const[z,ry]of[[.07,0],[-.07,Math.PI]]){
    const board=new THREE.Mesh(new THREE.PlaneGeometry(4,1.5),boardM);
    board.position.set(0,2.05,z);board.rotation.y=ry;g.add(board);
  }
  g.userData.h=3;
  return g;
}

export default {category:'Rural',label:'Town sign',build};

export function addTownSign(cx: number,cz: number,ry=0): {x0:number;x1:number;z0:number;z1:number;h:number} {
  const g=build();g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  return{x0:cx-.5,x1:cx+.5,z0:cz-.5,z1:cz+.5,h:g.userData.h};
}
