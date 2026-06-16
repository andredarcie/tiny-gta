import * as THREE from 'three';
import {matte} from '../matte.js';
import {scene} from '../../../js/engine.js';
import {rand,pick} from '../../../js/constants.js';
import {makePed,shirtColors} from '../characters/pedestrian.js';
import {makeDoorArrow} from './door-arrow.js';

// Academia "IRON TEMPLE", no mesmo molde da boate (nightclub.js): prédio num
// quarteirão reservado pelo world.js, com letreiro e entrada coberta. O interior
// é um cenário separado a ~600m do mapa, dentro de um Group com visible=false,
// renderizado só enquanto o jogador está lá (js/gym.js liga/desliga no teleporte).

export const GYM_I=7,GYM_J=1; // quarteirão reservado (nordeste da cidade)

// porta externa (fachada oeste, de frente pra rua) e spawn de saída
export const GYM_DOOR={x:145.4,z:-110};
export const GYM_SPAWN_OUT={x:143.4,z:-110};
// interior: centro da sala, porta de saída e spawn de entrada
export const INT_CENTER={x:-800,z:-200};
export const INT_DOOR={x:-812.2,z:-200};
export const INT_SPAWN={x:-810.4,z:-200};
// área onde a câmera pode ficar lá dentro (sala menos uma margem da parede)
export const INT_BOUNDS={x0:-812.3,x1:-787.7,z0:-207.3,z1:-192.7,y1:4.9};
// "estação de treino" (supino no centro): perto dela o HUD mostra TRAIN $X
export const GYM_TRAIN={x:-800,z:-200};

const accentM=new THREE.MeshBasicMaterial({color:0xff5a1e});   // laranja "neon"
const steelM=matte({color:0x6b7079,metalness:.85,roughness:.35});
const darkM=matte({color:0x16181d,roughness:.85});
const plateM=matte({color:0x202227,roughness:.7});

function signTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const x=c.getContext('2d');
  x.textAlign='center';x.textBaseline='middle';
  x.font='900 50px monospace';
  x.shadowColor='#ff5a1e';x.shadowBlur=22;
  x.fillStyle='#ffe2cf';
  for(let k=0;k<3;k++)x.fillText('IRON TEMPLE',256,64); // passadas extras = glow
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// Halter (barra + dois discos), reutilizado na fachada e dentro como peso solto
function makeDumbbell(len=1.2,r=.34,mat=steelM){
  const g=new THREE.Group();
  const bar=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,len,8),mat);
  bar.rotation.z=Math.PI/2;g.add(bar);
  for(const s of[-1,1]){
    const plate=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.22,12),darkM);
    plate.rotation.z=Math.PI/2;plate.position.x=s*len*.45;g.add(plate);
  }
  return g;
}

export const gymFx={lifters:[],sign:null,exitArrow:null,barbell:null,
  facade:null,facadeArrow:null,footprint:null};
export const gymInterior=new THREE.Group();
gymInterior.visible=false;

export function addGym(solids){
  const cx=154,cz=-110; // centro do prédio no quarteirão (7,1)

  // ----- exterior: galpão cinza com faixa laranja, marquise e letreiro -----
  // O corpo (caixa) some sozinho por culling quando a câmera entra; os objetos
  // da PORTA vão num grupo 'facade' que js/interior.js esconde junto (senão
  // ficariam flutuando ao sair). Ver gymFx.facade/footprint/facadeArrow.
  const wallM=matte({color:0x2c3038,roughness:.96});
  const bld=new THREE.Mesh(new THREE.BoxGeometry(16,7,16),wallM);
  bld.position.set(cx,3.5,cz);bld.castShadow=true;bld.receiveShadow=true;scene.add(bld);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(16.2,.25,16.2),darkM);
  roof.position.set(cx,7.1,cz);scene.add(roof);
  // faixa laranja em volta do prédio
  const band=new THREE.Mesh(new THREE.BoxGeometry(16.3,.5,16.3),accentM);
  band.position.set(cx,5.4,cz);scene.add(band);

  const facade=new THREE.Group();
  // porta dupla escura na fachada oeste (x menor)
  const door=new THREE.Mesh(new THREE.BoxGeometry(.18,3.2,2.6),darkM);
  door.position.set(cx-8.02,1.6,cz);facade.add(door);
  // barras de aço ladeando a porta
  for(const dz of[-2.2,2.2]){
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.14,4.4,.14),steelM);
    bar.position.set(cx-8.05,2.4,cz+dz);facade.add(bar);
  }
  // marquise sobre a entrada com colunas
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,4.4),
    matte({color:0x3a3f48,roughness:.8}));
  canopy.position.set(cx-9.3,3.3,cz);canopy.castShadow=true;facade.add(canopy);
  for(const dz of[-1.9,1.9]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3.2,6),steelM);
    pole.position.set(cx-10.4,1.6,cz+dz);facade.add(pole);
  }
  // halter gigante de fachada acima da porta
  const logo=makeDumbbell(3.4,.8,steelM);
  logo.position.set(cx-8.1,4.4,cz);logo.scale.set(.6,.6,.6);facade.add(logo);
  // letreiro (canvas) virado pra rua
  gymFx.sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.3),
    new THREE.MeshBasicMaterial({map:signTexture(),transparent:true}));
  gymFx.sign.position.set(cx-8.12,6,cz);gymFx.sign.rotation.y=-Math.PI/2;facade.add(gymFx.sign);
  // seta estilo mundo aberto quicando rente ao chão na entrada (mesh próprio, no
  // grupo, pra sumir junto; animada por js/interior.js)
  gymFx.facadeArrow=makeDoorArrow();
  gymFx.facadeArrow.position.set(cx-9.3,1.7,cz);facade.add(gymFx.facadeArrow);
  scene.add(facade);
  gymFx.facade=facade;
  gymFx.footprint={x0:cx-8.2,x1:cx+8.2,z0:cz-8.2,z1:cz+8.2};
  solids.push({x0:cx-8.2,x1:cx+8.2,z0:cz-8.2,z1:cz+8.2,h:7.2});

  // ----- interior: sala 26x16 a ~600m do mapa, num grupo liga/desliga -----
  // casca BackSide: de dentro é parede/teto/chão; de fora invisível, então a
  // câmera atrás do jogador enxerga a sala mesmo "atravessando" a parede
  const shell=new THREE.Mesh(new THREE.BoxGeometry(26,5.5,16),
    matte({color:0x23262d,roughness:1,side:THREE.BackSide}));
  shell.position.set(-800,2.75,-200);gymInterior.add(shell);
  // piso de borracha escuro por cima da casca
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(25.4,15.4),
    matte({color:0x14161b,roughness:.95}));
  floor.rotation.x=-Math.PI/2;floor.position.set(-800,.02,-200);gymInterior.add(floor);
  // backstop: se a câmera escapar da casca por um frame, vê escuridão
  const outer=new THREE.Mesh(new THREE.BoxGeometry(30,9,20),
    new THREE.MeshBasicMaterial({color:0x05060a,side:THREE.BackSide}));
  outer.position.set(-800,3.5,-200);gymInterior.add(outer);

  // faixas laranja nas paredes (duas alturas) pra dar o clima da fachada
  for(const y of[3.4,1.1]){
    for(const z of[-207.9,-192.1]){
      const s=new THREE.Mesh(new THREE.BoxGeometry(25.6,.09,.09),accentM);
      s.position.set(-800,y,z);gymInterior.add(s);
    }
    for(const x of[-812.9,-787.1]){
      const s=new THREE.Mesh(new THREE.BoxGeometry(.09,.09,15.6),accentM);
      s.position.set(x,y,-200);gymInterior.add(s);
    }
  }

  // parede de espelhos na face norte
  const mirror=new THREE.Mesh(new THREE.PlaneGeometry(15,3.2),
    matte({color:0x9fb0c4,metalness:.9,roughness:.15}));
  mirror.position.set(-800,1.9,-207.85);gymInterior.add(mirror);

  // rack de halteres na parede leste
  const rack=new THREE.Mesh(new THREE.BoxGeometry(.6,1.1,6),steelM);
  rack.position.set(-789,.55,-200);gymInterior.add(rack);
  for(let k=0;k<6;k++){
    const db=makeDumbbell(.9,.22+k*.02,steelM);
    db.position.set(-789,.95,-202.5+k*1);db.rotation.y=Math.PI/2;gymInterior.add(db);
  }

  // estação de supino no centro (a "estação de treino"): banco + barra + discos
  const bench=new THREE.Mesh(new THREE.BoxGeometry(.9,.5,2.6),
    matte({color:0x8a1f12,roughness:.7}));
  bench.position.set(-800,.5,-200);gymInterior.add(bench);
  const benchLeg=new THREE.Mesh(new THREE.BoxGeometry(.7,.5,.18),darkM);
  benchLeg.position.set(-800,.25,-200);gymInterior.add(benchLeg);
  for(const s of[-1,1]){ // suportes da barra
    const post=new THREE.Mesh(new THREE.BoxGeometry(.12,1.3,.12),steelM);
    post.position.set(-800+s*.55,.65,-201.1);gymInterior.add(post);
  }
  gymFx.barbell=makeDumbbell(2.8,.5,steelM);
  gymFx.barbell.position.set(-800,1.32,-201.1);gymInterior.add(gymFx.barbell);

  // pilha de discos solta num canto + kettlebell improvisado
  for(let k=0;k<4;k++){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.55-k*.05,.55-k*.05,.16,16),plateM);
    p.position.set(-810,.1+k*.17,-205.5);gymInterior.add(p);
  }

  // luz quente da sala: vive dentro do grupo (só existe com a academia visível)
  const light=new THREE.PointLight(0xffd9a8,70,44,1.7);
  light.position.set(-800,4.6,-200);gymInterior.add(light);

  // porta de saída (parede oeste) com faixa laranja em cima
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,3,2.4),darkM);
  exitDoor.position.set(-812.85,1.5,-200);gymInterior.add(exitDoor);
  const exitNeon=new THREE.Mesh(new THREE.BoxGeometry(.1,.3,1.6),accentM);
  exitNeon.position.set(-812.8,3.3,-200);gymInterior.add(exitNeon);
  // seta de saída quicando na frente da porta (animada pelo js/gym.js, porque o
  // mesh fundido das setas externas não alcança o interior)
  gymFx.exitArrow=makeDoorArrow();
  gymFx.exitArrow.position.set(-811.9,1.7,-200);
  gymInterior.add(gymFx.exitArrow);

  // dois "marombas" treinando: peds reaproveitados, animados pelo js/gym.js
  const spots=[[-804,-196.5,1],[-796.5,-203.5,-1]];
  for(const[dx,dz,dir]of spots){
    const g=makePed(pick(shirtColors));
    g.position.set(dx,0,dz);g.rotation.y=dir*Math.PI/2;
    // braços já grandões pra dar a ideia do lugar
    const l=g.userData.limbs;
    if(l){l.leftArm.scale.set(1.5,1,1.5);l.rightArm.scale.set(1.5,1,1.5);}
    gymInterior.add(g);
    gymFx.lifters.push({g,t:rand(0,6),sp:rand(3,4.5)});
  }

  scene.add(gymInterior);

  // paredes e equipamentos são sólidos (o jogador não atravessa nem sai da sala)
  solids.push(
    {x0:-814,x1:-812.9,z0:-208.5,z1:-191.5,h:6},   // parede oeste
    {x0:-787.1,x1:-786,z0:-208.5,z1:-191.5,h:6},   // parede leste
    {x0:-813.5,x1:-786.5,z0:-208.6,z1:-207.9,h:6}, // parede norte
    {x0:-813.5,x1:-786.5,z0:-192.1,z1:-191.4,h:6}, // parede sul
    {x0:-789.4,x1:-788.6,z0:-203.2,z1:-196.8,h:1.3},// rack leste
    {x0:-800.5,x1:-799.5,z0:-201.4,z1:-198.6,h:.9}, // banco do supino
  );
}
