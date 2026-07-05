import * as THREE from 'three';
import {matte} from '../matte.ts';

// Farol da ilha: torre afunilada com faixas vermelhas/brancas, varanda (gallery),
// sala da lanterna com vidro e um lâmpada quente que brilha (glow aditivo, sem
// luz real — barato), e uma cúpula no topo. É o marco visível da ilha de longe.
// build() é puro (grupo na origem, base em y=0); addLighthouse posiciona e adiciona.

const whiteM=matte({color:0xf2efe8,roughness:1});
const redM  =matte({color:0xd23b32,roughness:1});
const railM =matte({color:0x37485a,roughness:1});  // varanda/grade metálica escura
const capM  =matte({color:0x2a3340,roughness:1});  // cúpula
const baseM =matte({color:0xcabfa6,roughness:1});  // pedestal de pedra/concreto
const glassM=new THREE.MeshLambertMaterial({color:0x9fe7ff,transparent:true,opacity:.32,
  depthWrite:false,side:THREE.DoubleSide});
const lampM =new THREE.MeshBasicMaterial({color:0xfff0b0}); // lâmpada (sempre acesa)

// textura de glow radial (sprite aditivo) pro facho da lanterna
function glowTexture(): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=c.height=64;
  const x=c.getContext('2d')!;
  const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,244,200,.95)');
  g.addColorStop(.4,'rgba(255,226,150,.5)');
  g.addColorStop(1,'rgba(255,210,120,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);
  return new THREE.CanvasTexture(c);
}
const glowTex=glowTexture();

function build(): THREE.Group{
  const g=new THREE.Group();
  // pedestal de pedra
  const base=new THREE.Mesh(new THREE.CylinderGeometry(2.6,3.1,1.6,16),baseM);
  base.position.y=.8;base.castShadow=true;base.receiveShadow=true;g.add(base);
  // corpo afunilado em faixas vermelhas/brancas (segmentos empilhados — sem textura)
  const bands=7,bandH=1.7,r0=2.2,r1=1.25,y0=1.6;
  for(let i=0;i<bands;i++){
    const rb=r0+(r1-r0)*(i/bands), rt=r0+(r1-r0)*((i+1)/bands);
    const seg=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,bandH,16),i%2?redM:whiteM);
    seg.position.y=y0+bandH/2+i*bandH;seg.castShadow=true;seg.receiveShadow=true;g.add(seg);
  }
  const topY=y0+bands*bandH; // topo do corpo
  // varanda (gallery): disco + guarda-corpo
  const deck=new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.0,.3,16),railM);
  deck.position.y=topY+.15;deck.castShadow=true;g.add(deck);
  const rail=new THREE.Mesh(new THREE.CylinderGeometry(1.95,1.95,.7,16,1,true),railM);
  rail.position.y=topY+.6;g.add(rail);
  // sala da lanterna: vidro + lâmpada quente + glow
  const lanternY=topY+1.3;
  const glass=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.4,1.5,14,1,true),glassM);
  glass.position.y=lanternY;g.add(glass);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.7,12,10),lampM);
  lamp.position.y=lanternY;g.add(lamp);
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:0xffe6a0,
    transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));
  glow.scale.set(7,7,1);glow.position.y=lanternY;g.add(glow);
  // cúpula + ponteira
  const dome=new THREE.Mesh(new THREE.ConeGeometry(1.55,1.5,14),capM);
  dome.position.y=lanternY+1.5;dome.castShadow=true;g.add(dome);
  const finial=new THREE.Mesh(new THREE.SphereGeometry(.22,8,6),railM);
  finial.position.y=lanternY+2.4;g.add(finial);
  g.userData.glow=glow;g.userData.lamp=lamp; // p/ piscar/pulsar se quiser
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Props',label:'Lighthouse',build};

// Posiciona um farol no mundo (y = chão da ilha) e adiciona à cena.
export function addLighthouse(x: number,y: number,z: number): THREE.Group{
  const g=build();
  g.position.set(x,y,z);
  return g;
}
