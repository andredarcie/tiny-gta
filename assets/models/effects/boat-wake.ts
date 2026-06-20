import * as THREE from 'three';

// Espuma da esteira da lancha: um retalho plano de espuma deitado na água. O
// gameplay (player.js updateBoat) cospe vários desses pelos lados da proa e atrás
// da popa enquanto a lancha anda, fazendo-os crescer e sumir — dá a sensação de
// água sendo jogada pros lados e do rastro deixado na superfície.

// Textura de espuma desenhada no canvas: miolo branco com borbulhas, alpha radial
const foamCanvas=document.createElement('canvas');
foamCanvas.width=foamCanvas.height=64;
{
  const x=foamCanvas.getContext('2d')!;
  const grad=x.createRadialGradient(32,32,2,32,32,31);
  grad.addColorStop(0,'rgba(255,255,255,.95)');
  grad.addColorStop(.55,'rgba(232,247,252,.5)');
  grad.addColorStop(1,'rgba(214,238,250,0)');
  x.fillStyle=grad;x.fillRect(0,0,64,64);
  // borbulhas só dentro do disco (source-atop respeita o alpha já pintado)
  x.globalCompositeOperation='source-atop';
  for(let i=0;i<46;i++){
    const r=1+Math.random()*2.6;
    x.fillStyle=`rgba(255,255,255,${.3+Math.random()*.55})`;
    x.beginPath();x.arc(Math.random()*64,Math.random()*64,r,0,7);x.fill();
  }
}
const foamTex=new THREE.CanvasTexture(foamCanvas);
foamTex.colorSpace=THREE.SRGBColorSpace;

// geometria já deitada (plano no XZ): o gameplay só gira em rotation.y pra variar
const foamGeo=new THREE.PlaneGeometry(1,1);
foamGeo.rotateX(-Math.PI/2);

export function makeWakePuff(): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>{
  const m=new THREE.MeshBasicMaterial({map:foamTex,transparent:true,opacity:.0,
    depthWrite:false});
  return new THREE.Mesh(foamGeo,m);
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Effects',label:'Boat wake',build:()=>{
  const m=makeWakePuff();m.material.opacity=.85;m.scale.setScalar(2);return m;
}};
