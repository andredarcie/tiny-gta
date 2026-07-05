import * as THREE from 'three';
import {rand} from '@/core/constants.ts';

export function makeClouds(count=10): THREE.Sprite[]{
  const clouds: THREE.Sprite[]=[];
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const x=c.getContext('2d')!;
  for(let k=0;k<14;k++){
    const r=rand(18,42),px=rand(40,216),py=rand(45,86);
    const g2=x.createRadialGradient(px,py,2,px,py,r);
    g2.addColorStop(0,'rgba(255,255,255,.85)');g2.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g2;x.fillRect(0,0,256,128);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  for(let k=0;k<count;k++){
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,
      opacity:rand(.45,.8),fog:false,depthWrite:false}));
    const s=rand(90,170);sp.scale.set(s,s*.45,1);
    sp.position.set(rand(-500,500),rand(110,175),rand(-500,500));
    sp.userData.v=rand(1.5,3.5);
    clouds.push(sp);
  }
  return clouds;
}

// Padrão de modelo: no jogo as nuvens são espalhadas pelo céu (makeClouds), mas
// no preview agrupamos algumas perto da origem pra enquadrar bem.
function buildPreview(): THREE.Group{
  const g=new THREE.Group();
  const sprs=makeClouds(5);
  sprs.forEach((sp,i)=>{sp.position.set((i-2)*60,rand(-10,10),rand(-30,30));g.add(sp);});
  return g;
}
export default {category:'Environment',label:'Clouds',build:buildPreview};
