import * as THREE from 'three';

function spriteTex(draw: (x: CanvasRenderingContext2D, w: number, h: number) => void, w=128, h=128): THREE.CanvasTexture {
  const c=document.createElement('canvas');c.width=w;c.height=h;
  draw(c.getContext('2d')!,w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

// The sun as a camera sees it: a small blown-out disc inside a soft glare that fades fast
// (not a big flat disc).
export function makeSunSprite(): {sprite: THREE.Sprite; material: THREE.SpriteMaterial} {
  const mat=new THREE.SpriteMaterial({map:spriteTex(x=>{
    const g=x.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.07,'rgba(255,255,255,1)');
    g.addColorStop(.1,'rgba(255,250,238,.55)');g.addColorStop(.25,'rgba(255,244,226,.18)');
    g.addColorStop(.55,'rgba(255,240,220,.05)');g.addColorStop(1,'rgba(255,236,214,0)');
    x.fillStyle=g;x.fillRect(0,0,256,256);
  },256,256),fog:false,depthWrite:false,transparent:true});
  return{sprite:new THREE.Sprite(mat),material:mat};
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Daynight',label:'Sun',build:()=>makeSunSprite()};
