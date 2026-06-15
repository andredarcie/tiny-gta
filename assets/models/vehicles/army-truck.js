import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Caminhão do EXÉRCITO (estilo "Barracks" do GTA): cabine baixa na frente +
// caçamba aberta atrás com baús laterais e arcos de lona, pintura VERDE
// CAMUFLADA (textura procedural num <canvas>), 6 rodas. Aparece nas 6 estrelas
// (estrela máxima) — ver js/army.js — carregando 4 soldados de pé na caçamba
// que descem e metralham o jogador. build() é PURO (devolve Object3D, sem
// scene.add); o motor de direção do jogo dirige o grupo como um carro normal.
//
// Contratos de userData lidos pelo jogo (NÃO renomear):
//  dentable[] (dentCar), wheels[]/front[] (spinWheels), tailM (lanterna de freio),
//  seats[] {x,y,z,ry} posições LOCAIS dos 4 soldados na caçamba (army.js embarca/
//  desembarca neles).
//
// Eixos (igual aos outros veículos): +z = frente, x = largura, y = altura do chão.

// ---------- textura de camuflagem (canvas -> map) ----------
// Manchas militares (oliva/verde-escuro/caqui/preto). Determinística (sem rand
// salvo nas manchas, que é cosmético) e barata: um canvas pequeno repetido.
function camoTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;
  const x=c.getContext('2d');
  x.fillStyle='#4b5320';x.fillRect(0,0,128,128);            // oliva base
  const blobs=[['#3a4017',46],['#5e6b2f',40],['#2b2f14',30],['#7a7142',24]];
  for(const[col,n]of blobs){
    x.fillStyle=col;
    for(let i=0;i<n;i++){
      const bx=Math.random()*128,by=Math.random()*128,r=6+Math.random()*16;
      x.beginPath();
      for(let a=0;a<7;a++){ // polígono irregular = mancha
        const th=a/7*Math.PI*2,rr=r*(.6+Math.random()*.6);
        const px=bx+Math.cos(th)*rr,py=by+Math.sin(th)*rr;
        a?x.lineTo(px,py):x.moveTo(px,py);
      }
      x.closePath();x.fill();
    }
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);
  t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// ---------- materiais (compartilhados; cor NÃO é mutada em runtime) ----------
const camoMap=camoTexture();
const camoM=new THREE.MeshStandardMaterial({map:camoMap,roughness:.85,metalness:.1}); // carroceria camuflada
const canvasM=new THREE.MeshStandardMaterial({color:0x3e4626,roughness:.95});          // lona/arcos oliva escuro
const darkM=new THREE.MeshStandardMaterial({color:0x14140f,roughness:.7,metalness:.2}); // detalhes/grade/baús
const glassM=new THREE.MeshStandardMaterial({color:0x14201a,roughness:.55,metalness:.15,
  transparent:true,opacity:.78,depthWrite:false});                                      // vidros militares escuros (blackout) — não estouram em branco sob luz forte
const tireM=new THREE.MeshStandardMaterial({color:0x12110d,roughness:.95});
const hubM=new THREE.MeshStandardMaterial({color:0x3a3a2e,roughness:.5,metalness:.6});
const lightM=new THREE.MeshBasicMaterial({color:0xfff2c0});

function placed(geo,x,y,z,rx=0,rz=0){
  const g=geo.clone();
  if(rx)g.rotateX(rx);
  if(rz)g.rotateZ(rz);
  g.translate(x,y,z);
  return g;
}

// ---------- corpo camuflado (fundido): chassi + cabine + caçamba aberta -------
const bodyGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(2.0,.55,5.0),0,.62,0),        // chassi comprido
  placed(new THREE.BoxGeometry(1.96,1.15,1.5),0,1.5,1.55),   // cabine (frente)
  placed(new THREE.BoxGeometry(2.04,.12,3.1),0,.95,-.85),    // piso da caçamba
  placed(new THREE.BoxGeometry(.12,.62,3.1),.98,1.32,-.85),  // mureta direita
  placed(new THREE.BoxGeometry(.12,.62,3.1),-.98,1.32,-.85), // mureta esquerda
  placed(new THREE.BoxGeometry(2.04,.62,.12),0,1.32,.62),    // mureta da frente da caçamba
  placed(new THREE.BoxGeometry(2.04,.5,.12),0,1.26,-2.4),    // tampa traseira (mais baixa)
  placed(new THREE.BoxGeometry(2.16,.42,1.1),0,.5,1.55),     // para-lama dianteiro
  placed(new THREE.BoxGeometry(2.16,.42,2.0),0,.5,-1.3),     // para-lama traseiro (eixo duplo)
],false);

// ---------- lona oliva: arcos sobre a caçamba (esqueleto, sem teto = soldados à vista) ----------
const ribG=new THREE.TorusGeometry(.98,.05,6,12,Math.PI); // meio-arco
const canvasGeo=mergeGeometries([
  placed(ribG,0,1.63,.2,0,0),
  placed(ribG,0,1.63,-.9,0,0),
  placed(ribG,0,1.63,-2.0,0,0),
  placed(new THREE.BoxGeometry(.05,.05,2.5),.92,2.6,-.85),  // longarina superior dir
  placed(new THREE.BoxGeometry(.05,.05,2.5),-.92,2.6,-.85), // longarina superior esq
],false);

// ---------- detalhes escuros (grade, baús laterais, retrovisores, para-choques) ----------
const darkGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.4,.5,.08),0,1.2,2.32),     // grade frontal
  placed(new THREE.BoxGeometry(2.2,.24,.34),0,.5,2.36),     // para-choque dianteiro
  placed(new THREE.BoxGeometry(2.16,.22,.3),0,.5,-2.5),     // para-choque traseiro
  placed(new THREE.BoxGeometry(.06,.4,1.0),1.05,.85,-.85),  // baú lateral dir
  placed(new THREE.BoxGeometry(.06,.4,1.0),-1.05,.85,-.85), // baú lateral esq
  placed(new THREE.BoxGeometry(.2,.05,.05),1.06,1.62,2.05), // retrovisor dir braço
  placed(new THREE.BoxGeometry(.05,.3,.14),1.18,1.56,2.07), // retrovisor dir cabeça
  placed(new THREE.BoxGeometry(.2,.05,.05),-1.06,1.62,2.05),
  placed(new THREE.BoxGeometry(.05,.3,.14),-1.18,1.56,2.07),
],false);

// ---------- vidros (fundidos) ----------
const glassGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.8,.52,.05),0,1.74,2.32,-.28), // para-brisa
  placed(new THREE.BoxGeometry(.05,.46,1.1),.99,1.66,1.55),    // janela dir
  placed(new THREE.BoxGeometry(.05,.46,1.1),-.99,1.66,1.55),   // janela esq
],false);

const headlightG=new THREE.CylinderGeometry(.12,.12,.08,10);
const headlightsGeo=mergeGeometries([
  placed(headlightG,.74,1.2,2.35,Math.PI/2),
  placed(headlightG,-.74,1.2,2.35,Math.PI/2),
],false);
const taillightsGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(.2,.3,.06),.84,1.0,-2.46),
  placed(new THREE.BoxGeometry(.2,.3,.06),-.84,1.0,-2.46),
],false);

const wheelG=new THREE.CylinderGeometry(.44,.44,.36,12);

// posições LOCAIS dos 4 soldados de pé na caçamba (pés no piso ~y=1.01), olhando
// um pouco pra fora — army.js usa pra embarcar/desembarcar.
const SEATS=[
  {x:-.5,y:1.01,z:.0,ry:-.5},
  {x:.5,y:1.01,z:.0,ry:.5},
  {x:-.5,y:1.01,z:-1.5,ry:-.5},
  {x:.5,y:1.01,z:-1.5,ry:.5},
];

function buildArmyTruck(){
  const g=new THREE.Group();

  const body=new THREE.Mesh(bodyGeo,camoM);
  body.castShadow=true;g.add(body);
  g.userData.dentable=[body];

  g.add(new THREE.Mesh(canvasGeo,canvasM)); // arcos da lona
  g.add(new THREE.Mesh(darkGeo,darkM));     // grade/baús/retrovisores/para-choques
  const glass=new THREE.Mesh(glassGeo,glassM);glass.renderOrder=3;g.add(glass);
  g.add(new THREE.Mesh(headlightsGeo,lightM));

  const tlMat=new THREE.MeshBasicMaterial({color:0x6a1212}); // lanterna (acende no freio/ré)
  g.add(new THREE.Mesh(taillightsGeo,tlMat));
  g.userData.tailM=tlMat;

  // 6 rodas (eixo dianteiro + traseiro duplo). spinWheels gira userData.wheels e
  // esterça userData.front.
  g.userData.wheels=[];g.userData.front=[];
  for(const[sx,sz]of[[1,1.6],[-1,1.6],[1,-1.0],[-1,-1.0],[1,-1.9],[-1,-1.9]]){
    const wg=new THREE.Group();wg.position.set(sx*.95,.44,sz);wg.rotation.order='YXZ';
    const w=new THREE.Mesh(wheelG,[tireM,hubM,hubM]);
    w.rotation.z=Math.PI/2;wg.add(w);
    g.add(wg);g.userData.wheels.push(wg);
    if(sz>0)g.userData.front.push(wg);
  }

  g.userData.seats=SEATS.map(s=>({...s})); // cópia (cada caminhão tem a sua)
  return g;
}

export function makeArmyTruck(){return buildArmyTruck();}

export default {category:'Vehicles',label:'Army truck',build:buildArmyTruck,zoom:.55,yaw:-.6};
