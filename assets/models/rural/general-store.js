import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Mercadinho/empório de interior: corpo de tábuas, FALSA FACHADA alta (parapeito
// reto típico do velho oeste) com letreiro, alpendre coberto sobre dois postes,
// porta e vitrines. build() é puro (loja na origem, frente p/ +z); addGeneralStore
// posiciona, funde nos props e devolve a colisão.
const wallM=matte({color:0xcf8f5a,roughness:.95});   // tábuas cor de mel
const frontM=matte({color:0xb87a48,roughness:.95});  // falsa fachada (tom mais escuro)
const roofM=matte({color:0x5b5048,roughness:.9});
const trimM=matte({color:0x5e3c24,roughness:.85});
const winM=matte({color:0x9ecbe0,roughness:.4});
const doorM=matte({color:0x6e4a32,roughness:.9});

let signTex=null;
function signTexture(){
  if(signTex)return signTex;
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const x=c.getContext('2d');
  x.fillStyle='#3a2415';x.fillRect(0,0,256,64);
  x.fillStyle='#f2e3c0';x.font='900 30px monospace';x.textAlign='center';x.textBaseline='middle';
  x.fillText('GENERAL STORE',128,36);
  signTex=new THREE.CanvasTexture(c);signTex.colorSpace=THREE.SRGBColorSpace;return signTex;
}

function build(){
  const g=new THREE.Group();
  const W=6,D=5,H=3.2,fz=D/2;
  const body=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wallM);
  body.position.y=H/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(W,.2,D),roofM);
  roof.position.y=H+.1;g.add(roof);
  // falsa fachada (parapeito reto na frente, mais alto que o telhado)
  const front=new THREE.Mesh(new THREE.BoxGeometry(W+.2,H+1.2,.3),frontM);
  front.position.set(0,(H+1.2)/2,fz+.15);front.castShadow=true;g.add(front);
  // letreiro na falsa fachada
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(W-.6,1.1),
    new THREE.MeshBasicMaterial({map:signTexture()}));
  sign.position.set(0,H+.25,fz+.32);g.add(sign);
  // alpendre coberto sobre a vitrine
  const awning=new THREE.Mesh(new THREE.BoxGeometry(W+.4,.16,1.8),roofM);
  awning.position.set(0,H-.3,fz+.9);awning.castShadow=true;g.add(awning);
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.1,H-.4,8),trimM);
    post.position.set(sx*(W/2-.2),(H-.4)/2,fz+1.7);g.add(post);
  }
  // porta central + duas vitrines
  const door=new THREE.Mesh(new THREE.BoxGeometry(1,2,.1),doorM);
  door.position.set(0,1,fz+.06);g.add(door);
  for(const sx of[-1,1]){
    const win=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.3,.08),winM);
    win.position.set(sx*1.7,1.5,fz+.06);g.add(win);
  }
  g.userData.r=Math.max(W,D)/2+.3;g.userData.h=H+1.2;
  return g;
}

export default {category:'Rural',label:'General store',build};

export function addGeneralStore(cx,cz,ry=0){
  const g=build();g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  // colisão só do corpo (dá p/ passar sob o alpendre)
  return{x0:cx-3.2,x1:cx+3.2,z0:cz-2.8,z1:cz+2.8,h:g.userData.h};
}
