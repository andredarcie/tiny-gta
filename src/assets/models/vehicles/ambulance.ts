import carModel from './car.ts';
import * as THREE from 'three';
import {applyVehicleEnv} from './vehicle-env.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';

// Ambulância: parte do carro branco JÁ EQUIPADO (rodas, portas, volante, dentable,
// faróis, lanternas, sombra) e REMODELA a silhueta pra uma van de resgate de
// verdade — capô comprido na frente, cabine no meio e um MÓDULO traseiro alto e
// retangular (o compartimento do paciente, mais alto e um tico mais largo que a
// cabine, como nas ambulâncias tipo I). Toda a mecânica de direção/entrar/sair é
// herdada do carro: trocamos só a geometria do corpo (continua em userData.dentable,
// então ainda amassa) e vestimos os detalhes (para-brisa, giroflex, faixa, cruz,
// e o letreiro "AMBULANCE" + Estrela da Vida, espelhado na frente como nas reais).
//
// Coordenadas do carro: +z = frente, x = largura, y = altura a partir do chão
// (rodas tocam o chão em y0). Eixos em z=+1.45 (dianteiro) e z=-1.08 (traseiro).

// ---------- materiais ----------
const paintM=new THREE.MeshStandardMaterial({color:0xf4f5f7,roughness:.5,metalness:.1}); // branco da carroceria
const glassM=new THREE.MeshStandardMaterial({color:0x8fc3e0,roughness:.08,metalness:.6,
  transparent:true,opacity:.42,depthWrite:false}); // mesmo vidro do carro
const redM=new THREE.MeshStandardMaterial({color:0xd81f1f,roughness:.5}); // cruz + faixa
const barBaseM=new THREE.MeshStandardMaterial({color:0x14161a,roughness:.7});
const barRM=new THREE.MeshBasicMaterial({color:0xff2222}); // giroflex pisca via blinkBar
const barBM=new THREE.MeshBasicMaterial({color:0x2266ff});

// clona uma geometria já posicionada (igual ao car.js)
function placed(geo: THREE.BufferGeometry,x: number,y: number,z: number,rx=0,rz=0): THREE.BufferGeometry{
  const g=geo.clone();
  if(rx)g.rotateX(rx);
  if(rz)g.rotateZ(rz);
  g.translate(x,y,z);
  return g;
}

// ---------- carroceria van (fundida num só mesh, no lugar do corpo do sedã) ----------
// saia/chassi (comprimento todo) + capô + cabine + módulo traseiro alto
const vanBodyGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.62,.54,4.12),0,.52,0),      // chassi/saia
  placed(new THREE.BoxGeometry(1.48,.30,1.25),0,.84,1.55),   // capô (motor)
  placed(new THREE.BoxGeometry(1.58,.80,1.32),0,1.13,.30),   // cabine
  placed(new THREE.BoxGeometry(1.72,1.20,1.78),0,1.33,-1.17),// módulo do paciente (alto/largo)
],false);

// ---------- detalhes vermelhos (cruz traseira + faixa lateral) num só mesh ----------
const redGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(.54,.16,.05),0,1.28,-2.07),   // cruz traseira: braço h
  placed(new THREE.BoxGeometry(.16,.54,.05),0,1.28,-2.07),   // cruz traseira: braço v
  placed(new THREE.BoxGeometry(.04,.15,4.02),.815,.92,0),    // faixa lateral direita
  placed(new THREE.BoxGeometry(.04,.15,4.02),-.815,.92,0),   // faixa lateral esquerda
],false);

// ---------- geometrias soltas ----------
const windshieldG=new THREE.BoxGeometry(1.42,.52,.05);   // para-brisa inclinado
const doorPanelG=new THREE.BoxGeometry(.06,.62,1.0);     // porta da cabine (mais alta que a do sedã)
const doorWinG=new THREE.BoxGeometry(.05,.34,.78);       // janela da porta (vidro, abre junto)
const barBaseG=new THREE.BoxGeometry(.92,.08,.44);
const barLightG=new THREE.BoxGeometry(.32,.16,.36);

// ---------- letreiro: "AMBULANCE" + Estrela da Vida (textura de canvas) ----------
function makeMarkTex(mirror: boolean,w: number,h: number): THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d')!;
  if(mirror){x.translate(w,0);x.scale(-1,1);} // frente: espelhado pra ler no retrovisor
  const cy=h/2;
  // Estrela da Vida (6 pontas = 3 barras a 60°), só no letreiro lateral
  if(!mirror){
    const sx=h*.5,r=h*.34;
    x.save();x.translate(sx,cy);x.lineCap='round';
    x.strokeStyle='#ffffff';x.lineWidth=r*.62;
    for(let k=0;k<3;k++){x.beginPath();x.moveTo(-r,0);x.lineTo(r,0);x.stroke();x.rotate(Math.PI/3);}
    x.strokeStyle='#1565d8';x.lineWidth=r*.42;
    for(let k=0;k<3;k++){x.beginPath();x.moveTo(-r,0);x.lineTo(r,0);x.stroke();x.rotate(Math.PI/3);}
    x.restore();
  }
  // "AMBULANCE" vermelho
  x.fillStyle='#d81f1f';x.textBaseline='middle';
  x.font=`900 ${Math.round(h*.46)}px 'IBM Plex Mono', monospace`;
  x.textAlign=mirror?'center':'left';
  x.fillText('AMBULANCE',mirror?w/2:h*.96,cy+2);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  t.anisotropy=4;
  return t;
}
const markSideTex=makeMarkTex(false,640,150);
const markFrontTex=makeMarkTex(true,360,96);
const markSideMat=new THREE.MeshBasicMaterial({map:markSideTex,transparent:true,depthWrite:false});
const markFrontMat=new THREE.MeshBasicMaterial({map:markFrontTex,transparent:true,depthWrite:false});
const markSideG=new THREE.PlaneGeometry(1.52,.46);
const markFrontG=new THREE.PlaneGeometry(1.0,.24);

function buildAmbulance(): THREE.Group{
  const g=carModel.build({color:0xf4f5f7}); // rig completo do carro (NÃO entra na cena)

  // 1) troca a carroceria do sedã pela silhueta de van (continua dentable → amassa)
  const body=g.userData.dentable[0];
  body.geometry=vanBodyGeo;
  body.material=paintM;
  body.castShadow=true;

  // 2) some o vidro-estufa do sedã (único mesh com renderOrder 3)
  g.traverse((o: any)=>{if(o.isMesh&&o.renderOrder===3)o.visible=false;});

  // 3) lanternas pro fundo do módulo (mantém userData.tailM = luz de freio)
  g.traverse((o: any)=>{if(o.isMesh&&o.material===g.userData.tailM)o.position.set(0,.34,.15);});

  // 4) portas da cabine: painel mais alto + janela de vidro que abre junto
  for(const pivot of g.userData.doors){
    const panel=pivot.children[0];
    panel.geometry=doorPanelG;
    panel.material=paintM;
    const win=new THREE.Mesh(doorWinG,glassM);
    win.position.set(0,.46,-.56);win.renderOrder=3; // acima do painel, na lateral da cabine
    pivot.add(win);
  }

  // 5) para-brisa inclinado na frente da cabine
  const ws=new THREE.Mesh(windshieldG,glassM);
  ws.position.set(0,1.26,.94);ws.rotation.x=-.34;ws.renderOrder=3;g.add(ws);

  // 6) detalhes vermelhos (cruz traseira + faixa) e cruz dianteira pequena
  g.add(new THREE.Mesh(redGeo,redM));

  // 7) giroflex vermelho+azul na frente do teto da cabine (pisca via blinkBar)
  const barBase=new THREE.Mesh(barBaseG,barBaseM);barBase.position.set(0,1.55,.45);g.add(barBase);
  const r=new THREE.Mesh(barLightG,barRM);r.position.set(-.26,1.63,.45);
  const b=new THREE.Mesh(barLightG,barBM);b.position.set(.26,1.63,.45);
  g.add(r,b);
  g.userData.bar=[r,b]; // car.js só define bar em viatura; aqui ativa o giroflex

  // 8) letreiro nas laterais do módulo (lê pra frente dos dois lados) + frente espelhado
  for(const sx of[-1,1]){
    const m=new THREE.Mesh(markSideG,markSideMat);
    m.position.set(sx*.865,1.12,-1.15);
    m.rotation.y=sx>0?Math.PI/2:-Math.PI/2;
    g.add(m);
  }
  const mf=new THREE.Mesh(markFrontG,markFrontMat);
  mf.position.set(0,.88,2.19);g.add(mf); // capô, espelhado (retrovisor dos carros à frente)

  return g;
}

// Compat: gameplay usa makeAmbulance() e espera o veículo já na cena.
export function makeAmbulance(): THREE.Group{const g=buildAmbulance();applyVehicleEnv(g);scene.add(g);return g;}

// Padrão de modelo: build() puro; descriptor pro model-viewer (descoberta
// automática). zoom<1 aproxima a câmera (a van é grande, então enquadra melhor);
// yaw mostra um 3/4 traseiro com a cruz + o letreiro lateral logo de cara.
export default {category:'Vehicles',label:'Ambulance',build:buildAmbulance,zoom:.62,yaw:-.5};
