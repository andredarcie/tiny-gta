import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene,renderer} from '@/core/engine.ts';
import {N,CELL,ROAD,BLOCK,SIDE,nodeX,CURB_H} from '@/core/constants.ts';
import {makeRng} from '@/core/rng.ts';

// Calçadas elevadas (meio-fio). Antes a calçada era só uma faixa pintada no chão;
// agora é uma laje de verdade, levemente erguida sobre a rua. Cada quarteirão da
// cidade é emoldurado por um anel de largura SIDE elevado em CURB_H — EXATAMENTE o
// mesmo anel que a física sobe (cityCurbH em constants.ts → groundHeight), então o
// que se pisa/dirige bate com o que se vê (sem afundar o pé na calçada).
//
// Geometria: quatro tiras-caixa por quarteirão formam uma moldura oca (o miolo —
// prédio/lote/praça — segue no nível do chão); tudo é fundido num único mesh
// estático, então a cidade inteira ganha calçada por UMA draw call a mais.

// Mundo (em unidades) coberto por um tile da textura de concreto. A grade de
// juntas divide o tile em 2×2 placas, então cada placa fica ~CONCRETE_TILE/2 ≈ 1,3 u
// (tamanho realista de placa de calçada). A UV é PLANAR (projeção de cima), então a
// grade de placas é contínua e consistente por toda a cidade.
const CONCRETE_TILE=2.6;

// Textura de concreto ladrilhável: base clara com variação tonal, agregado fino e
// uma GRADE DE JUNTAS (sulco escuro + realce) — é o que dá a leitura de "placas de
// calçada" em vez de uma cor chapada. Determinística (repaint estável).
function makeConcreteTexture():THREE.CanvasTexture{
  const S=256,c=document.createElement('canvas');c.width=c.height=S;
  const x=c.getContext('2d')!;
  const {random:rnd,irand}=makeRng(0x5ca1ed);
  x.fillStyle='#bcb6a8';x.fillRect(0,0,S,S);                 // base de concreto
  // manchas tonais largas (desbotado/sujo irregular)
  for(let k=0;k<70;k++){
    const r=irand(10,46);
    x.fillStyle=rnd()<.5?`rgba(168,162,150,${(.05+rnd()*.07).toFixed(3)})`
                        :`rgba(120,114,102,${(.05+rnd()*.07).toFixed(3)})`;
    x.beginPath();x.ellipse(rnd()*S,rnd()*S,r,r*(.6+rnd()*.6),rnd()*Math.PI,0,7);x.fill();
  }
  // agregado: pontinhos claros e escuros (pedrisco do concreto)
  for(let k=0;k<2600;k++){
    const d=rnd()<.5;
    x.fillStyle=d?`rgba(150,144,132,${(.1+rnd()*.18).toFixed(3)})`
                 :`rgba(225,220,208,${(.08+rnd()*.16).toFixed(3)})`;
    x.fillRect(rnd()*S,rnd()*S,irand(1,2),irand(1,2));
  }
  // juntas das placas: sulco escuro com realce claro ao lado (bisel) — desenhadas
  // nas BORDAS (seam) e no MEIO, então a grade casa perfeitamente ao ladrilhar.
  const vGroove=(gx:number):void=>{
    x.fillStyle='rgba(86,81,72,.6)';x.fillRect(gx,0,2,S);    // sulco
    x.fillStyle='rgba(214,209,197,.35)';x.fillRect(gx+2,0,1,S); // realce na quina
  };
  const hGroove=(gy:number):void=>{
    x.fillStyle='rgba(86,81,72,.6)';x.fillRect(0,gy,S,2);
    x.fillStyle='rgba(214,209,197,.35)';x.fillRect(0,gy+2,S,1);
  };
  vGroove(0);vGroove(S/2);vGroove(S-2);
  hGroove(0);hGroove(S/2);hGroove(S-2);
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=renderer.capabilities.getMaxAnisotropy();
  return t;
}

const strips:THREE.BufferGeometry[]=[];
function strip(x0:number,x1:number,z0:number,z1:number):void{
  const g=new THREE.BoxGeometry(x1-x0,CURB_H,z1-z0);
  g.translate((x0+x1)/2,CURB_H/2,(z0+z1)/2); // base no chão (y=0), topo em CURB_H
  // UV planar (projeção de cima) em coords de MUNDO: a grade de placas fica
  // contínua entre as tiras e por toda a cidade. Nas faces verticais do meio-fio
  // (0,18 de altura) isso vira um borrão fino — irrelevante, lê como concreto.
  const pos=g.attributes.position as THREE.BufferAttribute;
  const uv=g.attributes.uv as THREE.BufferAttribute;
  for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/CONCRETE_TILE,pos.getZ(i)/CONCRETE_TILE);
  strips.push(g);
}

// Emoldura o quarteirão [bx,bx+BLOCK]×[bz,bz+BLOCK] com um anel oco de largura SIDE.
function addBlockSidewalk(bx:number,bz:number):void{
  const x1=bx+BLOCK,z1=bz+BLOCK;
  strip(bx,x1,bz,bz+SIDE);             // borda norte (largura cheia)
  strip(bx,x1,z1-SIDE,z1);             // borda sul (largura cheia)
  strip(bx,bx+SIDE,bz+SIDE,z1-SIDE);   // borda oeste (entre as duas)
  strip(x1-SIDE,x1,bz+SIDE,z1-SIDE);   // borda leste
}

// Monta o anel de calçada de todos os quarteirões da cidade. Chamado UMA vez no
// build do mundo (js/world/world.ts). Os cantos de quarteirão coincidem 1:1 com a
// faixa que a textura do chão já pintava (nodeX(i)+ROAD/2 … +BLOCK).
export function buildSidewalks():void{
  for(let i=0;i<N;i++)for(let j=0;j<N;j++)
    addBlockSidewalk(nodeX(i)+ROAD/2,nodeX(j)+ROAD/2);
  if(!strips.length)return;
  const mat=new THREE.MeshLambertMaterial({map:makeConcreteTexture()});
  const mesh=new THREE.Mesh(mergeGeometries(strips),mat);
  mesh.receiveShadow=true;                          // sombra dos prédios cai na calçada
  mesh.matrixAutoUpdate=false;mesh.updateMatrix();  // estático: congela a matriz local
  scene.add(mesh);
  strips.length=0;
}
