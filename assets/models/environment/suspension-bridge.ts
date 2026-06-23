import * as THREE from 'three';
import {matte} from '../matte.ts';
import {scene} from '@/core/engine.ts';
import {mergeStatic} from '../props/prop-merge.ts';
import {registerRuralStatic} from '@/world/rural-cull.ts';
import {RIVER_CX,RIVER_HW,BRIDGE_DECK_HW,BRIDGE_H,BRIDGE_X0,BRIDGE_X1,bridgeDeckH}
  from '@/core/constants.ts';

// ===== Ponte suspensa: o cartão-postal entre a cidade e a zona rural ==========
// Estilo Golden Gate: duas torres altas em "laranja internacional", cabos
// principais em catenária com pendurais verticais, e um tabuleiro que LEVA a
// estrada por cima do estreito navegável. A geometria nasce das MESMAS funções da
// física (constants.ts): o tabuleiro segue bridgeDeckH(x) ponto a ponto, então o
// asfalto que se vê é exatamente o chão que o carro pisa; a lancha passa por baixo
// na linha d'água. Tudo é fundido (mergeStatic) em poucos draw calls.

const STEEL=matte({color:0xc0362c,roughness:.6});     // laranja internacional (torres/parapeito)
const CABLE=matte({color:0xa82f23,roughness:.6});     // cabo/pendural (laranja mais escuro)
const ASPHALT=matte({color:0x3a3d42,roughness:.95});  // pista
const WALK=matte({color:0x8d9196,roughness:.95});     // passeio de pedestre (mais claro)
const LINE=matte({color:0xf2c14e,roughness:.9});      // faixa central amarela
const PIER=matte({color:0x9a958c,roughness:.95});     // pilar de concreto na água
const LAMP=matte({color:0x2a2d31,roughness:.7});      // poste
const BULB=matte({color:0xffe6a8,emissive:0xffcf73,emissiveIntensity:.9}); // luminária quente

const WB=RIVER_CX-RIVER_HW;        // margem oeste (cidade) — base da torre
const EB=RIVER_CX+RIVER_HW;        // margem leste (rural) — base da torre
const TOWER_TOP=BRIDGE_H+22;       // topo das torres acima do solo
const LEGZ=BRIDGE_DECK_HW+1.4;     // pernas da torre logo fora da pista
const CABZ=BRIDGE_DECK_HW+0.6;     // plano dos cabos (pouco fora do parapeito)
const SAG_LOW=BRIDGE_H+2.4;        // ponto mais baixo do cabo (sobre o meio do vão)

// Altura do cabo principal em x: catenária (parábola) presa no topo das torres,
// caindo até SAG_LOW no meio do vão. Fora do vão (rampas) segue reta no backstay.
function cableY(x:number):number{
  const t=(x-RIVER_CX)/RIVER_HW;            // -1 na torre oeste, +1 na leste
  return SAG_LOW+(TOWER_TOP-SAG_LOW)*t*t;
}

// Cilindro entre dois pontos (cabo/pendural): comprimento = distância, orientado
// do eixo +Y pra direção p0→p1.
const _up=new THREE.Vector3(0,1,0),_d=new THREE.Vector3(),_q=new THREE.Quaternion();
function cyl(p0:THREE.Vector3,p1:THREE.Vector3,r:number,mat:THREE.Material):THREE.Mesh{
  _d.subVectors(p1,p0);
  const len=_d.length()||1e-4;
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,6),mat);
  m.position.copy(p0).addScaledVector(_d,.5);
  m.quaternion.setFromUnitVectors(_up,_d.normalize());
  return m;
}

function box(w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number,rz=0):THREE.Mesh{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);if(rz)m.rotation.z=rz;
  return m;
}

// Monta a ponte inteira em coordenadas de MUNDO (em torno de RIVER_CX), pronta pra
// addSuspensionBridge somar à cena. O visualizador de modelos centra na origem.
function buildBridge():THREE.Group{
  const g=new THREE.Group();
  const DECKW=BRIDGE_DECK_HW*2;            // largura total da pista (z)

  // ---- Tabuleiro: segmentos ao longo de x seguindo bridgeDeckH (rampa+vão) ----
  const SEG=2.8;
  for(let x=BRIDGE_X0;x<BRIDGE_X1;x+=SEG){
    const xc=Math.min(x+SEG/2,BRIDGE_X1-0.01);
    const h=bridgeDeckH(xc,0);
    const slope=Math.atan2(bridgeDeckH(xc+SEG/2,0)-bridgeDeckH(xc-SEG/2,0),SEG);
    const L=SEG*1.06;
    // laje de asfalto (topo na altura h: o carro anda em groundHeight=h)
    const deck=box(L,.5,DECKW,ASPHALT,xc,h-.25,0,slope);
    deck.castShadow=true;deck.receiveShadow=true;g.add(deck);
    // faixa central amarela
    g.add(box(L,.06,.34,LINE,xc,h+.02,0,slope));
    // passeios de pedestre (faixas claras junto às bordas)
    for(const s of[-1,1])g.add(box(L,.1,2.2,WALK,xc,h+.05,s*(BRIDGE_DECK_HW-1.1),slope));
    // parapeito laranja nas duas bordas
    for(const s of[-1,1]){
      const rail=box(L,1.0,.28,STEEL,xc,h+.55,s*BRIDGE_DECK_HW,slope);
      g.add(rail);
    }
    // Muro de arrimo fechando os LADOS da rampa (esquerda e direita) — SÓ nas
    // rampas, não no vão sobre a água. Preenche o vão entre a rampa elevada e o
    // chão, então é impossível passar por baixo da rampa. O vão central segue
    // aberto (a lancha passa por baixo da ponte). Vertical (sem inclinar): vai do
    // chão (-0.5, enterrado) até logo acima do tabuleiro (h+0.1).
    if(xc<WB||xc>EB){
      for(const s of[-1,1]){
        const wall=box(L,h+.6,.6,PIER,xc,(h+.6)/2-.5,s*BRIDGE_DECK_HW);
        wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
      }
    }
  }

  // ---- Pilares de concreto e torres nas duas margens ----
  for(const TX of[WB,EB]){
    // pilar de concreto descendo na água
    g.add(box(6,6,DECKW+3,PIER,TX,-1.5,0));
    for(const LZ of[-LEGZ,LEGZ]){
      // base alargada + perna esguia até o topo
      g.add(box(2.4,2.2,2.4,STEEL,TX,1.1,LZ));
      const leg=box(1.5,TOWER_TOP,1.5,STEEL,TX,TOWER_TOP/2,LZ);
      leg.castShadow=true;g.add(leg);
      // chapéu da perna
      g.add(box(1.9,.7,1.9,STEEL,TX,TOWER_TOP+.2,LZ));
    }
    // travessas (uma acima da pista, uma perto do topo) — visual icônico
    g.add(box(1.2,1.0,DECKW+3,STEEL,TX,BRIDGE_H+3.2,0));
    g.add(box(1.2,1.2,DECKW+3,STEEL,TX,TOWER_TOP-2.2,0));
  }

  // ---- Cabos principais (catenária) + backstays + pendurais ----
  for(const s of[-1,1]){
    const z=s*CABZ;
    // cabo principal: amostrado de torre a torre, ligando segmentos curtos
    let prev=new THREE.Vector3(WB,TOWER_TOP,z);
    const STEPS=22;
    for(let i=1;i<=STEPS;i++){
      const x=WB+(EB-WB)*(i/STEPS);
      const p=new THREE.Vector3(x,cableY(x),z);
      g.add(cyl(prev,p,.18,CABLE));
      prev=p;
    }
    // backstays: do topo de cada torre até a ancoragem no pé da rampa
    g.add(cyl(new THREE.Vector3(WB,TOWER_TOP,z),new THREE.Vector3(BRIDGE_X0,bridgeDeckH(BRIDGE_X0+0.5,0)+.5,z),.16,CABLE));
    g.add(cyl(new THREE.Vector3(EB,TOWER_TOP,z),new THREE.Vector3(BRIDGE_X1,bridgeDeckH(BRIDGE_X1-0.5,0)+.5,z),.16,CABLE));
    // pendurais verticais do cabo até o tabuleiro, ao longo do vão
    for(let x=WB+4;x<EB;x+=4){
      const top=cableY(x),deckH=bridgeDeckH(x,0)+1.0;
      if(top-deckH>.6)g.add(cyl(new THREE.Vector3(x,top,z),new THREE.Vector3(x,deckH,z),.06,CABLE));
    }
  }

  // ---- Postes de luz ao longo do tabuleiro (charme de cartão-postal) ----
  for(let x=WB;x<=EB;x+=13)for(const s of[-1,1]){
    const h=bridgeDeckH(x,0);
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.1,.12,2.6,6),LAMP);
    post.position.set(x,h+1.3,s*(BRIDGE_DECK_HW-.4));g.add(post);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(.22,8,8),BULB);
    bulb.position.set(x,h+2.7,s*(BRIDGE_DECK_HW-.4));g.add(bulb);
  }

  return g;
}

// Modelo pro visualizador (descoberto via import.meta.glob): centra na origem.
export default {
  category:'Environment',
  label:'Suspension Bridge',
  build:():THREE.Group=>{const g=buildBridge();g.position.x=-RIVER_CX;return g;},
};

// Coloca a ponte no mundo, funde em poucos draw calls e devolve a colisão (pernas
// das torres). O tabuleiro/cabos não têm colisão de propósito: sair da pista pela
// borda joga o carro no rio (mergulho divertido); a lancha cruza livre por baixo.
export function addSuspensionBridge(
  solids:{x0:number;x1:number;z0:number;z1:number;h:number}[],
):void{
  const g=buildBridge();
  scene.add(g);
  registerRuralStatic(g,RIVER_CX,0); // congela + corta além da névoa
  mergeStatic(g);                    // ~6 draw calls por assinatura de material
  // colisão: as quatro pernas das torres (carro/pedestre não atravessam o aço)
  for(const TX of[WB,EB])for(const LZ of[-LEGZ,LEGZ])
    solids.push({x0:TX-1,x1:TX+1,z0:LZ-1,z1:LZ+1,h:TOWER_TOP});
  // colisão dos muros das rampas (esquerda/direita de cada rampa): bloqueiam
  // entrar/passar por baixo da rampa pelos lados. O vão central fica sem colisão
  // (lancha por baixo); a pista entre os muros (|z|<DECK_HW) segue livre pro carro.
  for(const[x0,x1]of[[BRIDGE_X0,WB],[EB,BRIDGE_X1]] as [number,number][])
    for(const s of[-1,1])
      solids.push({x0,x1,z0:s*BRIDGE_DECK_HW-.4,z1:s*BRIDGE_DECK_HW+.4,h:BRIDGE_H});
}
