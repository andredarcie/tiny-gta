import * as THREE from 'three';
import {matte} from '../matte.js';
import {scene} from '../../../js/engine.js';
import {rand} from '../../../js/constants.js';
import {makePed} from '../characters/pedestrian.js';
import {makeDoorArrow} from './door-arrow.js';

// Hospital "SANTA CASA", no mesmo molde da boate/academia: prédio num quarteirão
// reservado pelo world.js, interior separado a ~600m do mapa num Group
// visible=false. É pra onde o jogador é levado quando morre (js/player.js), e
// tem um kit de cura no centro pra quando ele entrar ferido. Ver js/hospital.js.

export const HOSP_I=6,HOSP_J=6; // quarteirão reservado (sudeste da cidade)

// porta externa (fachada oeste, de frente pra rua) e spawn de saída
export const HOSP_DOOR={x:101.4,z:110};
export const HOSP_SPAWN_OUT={x:99.4,z:110};
// interior: centro da sala, porta de saída e spawn (leito) de entrada/acordar.
// z=180 (não -380): mantém a sala BEM dentro do domo do céu (esfera raio 900
// na origem). Em z=-380 a parede oeste ficava em raio ~897 e o céu (azul,
// fog:false) atravessava a porta de saída. As outras salas ficam em z=-22/-200.
export const INT_CENTER={x:-800,z:180};
export const INT_DOOR={x:-812.2,z:180};
export const INT_SPAWN={x:-810.4,z:180};  // entrada normal: ao lado da porta, olhando pra dentro
export const HOSP_BED={x:-800,z:180};     // morte: acorda no meio da sala (ver js/hospital.js)
export const INT_BOUNDS={x0:-812.3,x1:-787.7,z0:172.7,z1:187.3,y1:4.9};
// kit de cura no meio da sala (cruz verde): cura quem entra ferido
export const HOSP_HEAL={x:-801,z:176};

const whiteM=matte({color:0xeef2f4,roughness:.92});
const greenM=new THREE.MeshBasicMaterial({color:0x35d47a});      // cruz/sinal
const tealM=matte({color:0x2aa6a0,roughness:.6});
const darkM=matte({color:0x1a2226,roughness:.85});

function signTexture(){
  const c=document.createElement('canvas');c.width=512;c.height=128;
  const x=c.getContext('2d');
  x.textAlign='center';x.textBaseline='middle';
  x.font='900 50px monospace';
  x.shadowColor='#35d47a';x.shadowBlur=22;
  x.fillStyle='#dffbe9';
  for(let k=0;k<3;k++)x.fillText('HOSPITAL',256,64); // passadas extras = glow
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

// Cruz médica (dois braços), reutilizada na fachada e como kit de cura
function makeCross(s=1,mat=greenM){
  const g=new THREE.Group();
  const a=new THREE.Mesh(new THREE.BoxGeometry(.9*s,.3*s,.12*s),mat);
  const b=new THREE.Mesh(new THREE.BoxGeometry(.3*s,.9*s,.12*s),mat);
  g.add(a,b);
  return g;
}

export const hospFx={sign:null,exitArrow:null,heal:null,peds:[],sickPatient:null,
  facade:null,facadeArrow:null,footprint:null};

const metalM=matte({color:0xb8c0c6,metalness:.6,roughness:.4});
const bedM=matte({color:0xf4f6f7,roughness:.7});
const screenM=new THREE.MeshBasicMaterial({color:0x35d47a});

// Suporte de soro (haste + bolsa) ao lado do leito
function makeIvStand(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,2,6),metalM);
  pole.position.y=1;g.add(pole);
  const foot=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.05,8),metalM);
  foot.position.y=.03;g.add(foot);
  const bag=new THREE.Mesh(new THREE.BoxGeometry(.16,.32,.06),
    matte({color:0xe8f4d8,transparent:true,opacity:.85,roughness:.5}));
  bag.position.set(.12,1.7,0);g.add(bag);
  return g;
}
// Monitor cardíaco numa base com rodinhas
function makeMonitor(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.1,6),metalM);
  pole.position.y=.55;g.add(pole);
  const box=new THREE.Mesh(new THREE.BoxGeometry(.5,.4,.3),
    matte({color:0x2a3338,roughness:.6}));
  box.position.y=1.25;g.add(box);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(.36,.26),screenM);
  screen.position.set(0,1.25,.151);g.add(screen);
  return g;
}
// Cadeira simples da sala de espera
function makeChair(){
  const g=new THREE.Group();
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.5,.1,.5),tealM);
  seat.position.y=.45;g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(.5,.55,.1),tealM);
  back.position.set(0,.72,-.2);g.add(back);
  for(const[sx,sz]of[[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.45,.06),metalM);
    leg.position.set(sx,.22,sz);g.add(leg);
  }
  return g;
}
export const hospInterior=new THREE.Group();
hospInterior.visible=false;

export function addHospital(solids){
  const cx=110,cz=110; // centro do prédio no quarteirão (6,6)

  // ----- exterior: bloco branco com faixa teal, marquise e cruz verde -----
  const bld=new THREE.Mesh(new THREE.BoxGeometry(16,7,16),whiteM);
  bld.position.set(cx,3.5,cz);bld.castShadow=true;bld.receiveShadow=true;scene.add(bld);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(16.2,.25,16.2),darkM);
  roof.position.set(cx,7.1,cz);scene.add(roof);
  const band=new THREE.Mesh(new THREE.BoxGeometry(16.3,.5,16.3),tealM);
  band.position.set(cx,5.4,cz);scene.add(band);

  // Objetos da PORTA num grupo 'facade' que js/interior.js esconde quando a
  // câmera entra na pegada do prédio (senão flutuam ao sair). O corpo (caixa)
  // some sozinho por culling. Ver hospFx.facade/footprint/facadeArrow.
  const facade=new THREE.Group();
  // porta dupla na fachada oeste (x menor)
  const door=new THREE.Mesh(new THREE.BoxGeometry(.18,3.2,2.6),
    matte({color:0x2a3338,roughness:.7}));
  door.position.set(cx-8.02,1.6,cz);facade.add(door);
  // marquise sobre a entrada com colunas
  const canopy=new THREE.Mesh(new THREE.BoxGeometry(2.6,.18,4.4),tealM);
  canopy.position.set(cx-9.3,3.3,cz);canopy.castShadow=true;facade.add(canopy);
  for(const dz of[-1.9,1.9]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,3.2,6),whiteM);
    pole.position.set(cx-10.4,1.6,cz+dz);facade.add(pole);
  }
  // cruz verde grande de fachada acima da porta
  const logo=makeCross(3.2,greenM);
  logo.position.set(cx-8.12,4.5,cz);logo.rotation.y=-Math.PI/2;facade.add(logo);
  // letreiro virado pra rua
  hospFx.sign=new THREE.Mesh(new THREE.PlaneGeometry(9,2.3),
    new THREE.MeshBasicMaterial({map:signTexture(),transparent:true}));
  hospFx.sign.position.set(cx-8.13,6,cz);hospFx.sign.rotation.y=-Math.PI/2;facade.add(hospFx.sign);
  // seta quicando na entrada (mesh próprio, no grupo; animada por js/interior.js)
  hospFx.facadeArrow=makeDoorArrow();
  hospFx.facadeArrow.position.set(cx-9.3,1.7,cz);facade.add(hospFx.facadeArrow);
  scene.add(facade);
  hospFx.facade=facade;
  hospFx.footprint={x0:cx-8.2,x1:cx+8.2,z0:cz-8.2,z1:cz+8.2};
  solids.push({x0:cx-8.2,x1:cx+8.2,z0:cz-8.2,z1:cz+8.2,h:7.2});

  // ----- interior: sala 26x16 a ~600m do mapa, num grupo liga/desliga -----
  const shell=new THREE.Mesh(new THREE.BoxGeometry(26,5.5,16),
    matte({color:0xdfe7ea,roughness:1,side:THREE.BackSide}));
  shell.position.set(-800,2.75,180);hospInterior.add(shell);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(25.4,15.4),
    matte({color:0xc6d2d6,roughness:.85}));
  floor.rotation.x=-Math.PI/2;floor.position.set(-800,.02,180);hospInterior.add(floor);
  // backstop: se a câmera escapar da casca por um frame, vê escuridão
  const outer=new THREE.Mesh(new THREE.BoxGeometry(30,9,20),
    new THREE.MeshBasicMaterial({color:0x05060a,side:THREE.BackSide}));
  outer.position.set(-800,3.5,180);hospInterior.add(outer);

  // faixa teal nas paredes
  for(const z of[172.1,187.9]){
    const s=new THREE.Mesh(new THREE.BoxGeometry(25.6,.12,.06),tealM);
    s.position.set(-800,2.2,z);hospInterior.add(s);
  }

  // três leitos perpendiculares à parede sul (cabeceira na parede), com colchão,
  // travesseiro e cortina divisória; alguns com soro e monitor ao lado
  const bedX=[-806,-801,-796];
  for(let k=0;k<3;k++){
    const x=bedX[k];
    const frame=new THREE.Mesh(new THREE.BoxGeometry(1.2,.5,2.4),metalM);
    frame.position.set(x,.5,185.6);hospInterior.add(frame);
    const mat=new THREE.Mesh(new THREE.BoxGeometry(1.1,.18,2.2),bedM);
    mat.position.set(x,.78,185.6);hospInterior.add(mat);
    const pillow=new THREE.Mesh(new THREE.BoxGeometry(.9,.18,.5),tealM);
    pillow.position.set(x,.95,186.5);hospInterior.add(pillow); // cabeceira (parede)
    // cortina divisória entre os leitos (trilho + pano)
    if(k<2){
      const curtain=new THREE.Mesh(new THREE.BoxGeometry(.05,2,2.2),
        matte({color:0x9fd0cf,transparent:true,opacity:.55,roughness:.9}));
      curtain.position.set(x+2,2,185.6);hospInterior.add(curtain);
    }
    if(k!==1){ // leitos das pontas: soro + monitor
      const iv=makeIvStand();iv.position.set(x-.7,0,184.4);hospInterior.add(iv);
      const mon=makeMonitor();mon.position.set(x+.7,0,184.4);hospInterior.add(mon);
    }
  }

  // recepção na parede norte: balcão + plaquinha
  const desk=new THREE.Mesh(new THREE.BoxGeometry(6,1.1,1.2),tealM);
  desk.position.set(-800,.55,174.6);hospInterior.add(desk);
  const deskTop=new THREE.Mesh(new THREE.BoxGeometry(6.2,.1,1.4),bedM);
  deskTop.position.set(-800,1.12,174.6);hospInterior.add(deskTop);
  const deskCross=makeCross(.8,greenM);
  deskCross.position.set(-800,2.2,172.3);hospInterior.add(deskCross);

  // armário de remédios na parede leste
  const cabinet=new THREE.Mesh(new THREE.BoxGeometry(.5,2.2,2.6),
    matte({color:0xeef2f4,roughness:.6}));
  cabinet.position.set(-787.6,1.1,182);hospInterior.add(cabinet);
  const cabCross=makeCross(.5,greenM);
  cabCross.position.set(-787.3,1.6,182);cabCross.rotation.y=Math.PI/2;hospInterior.add(cabCross);

  // sala de espera perto da entrada (oeste): fileira de cadeiras
  for(let k=0;k<3;k++){
    const ch=makeChair();ch.position.set(-809.5,0,177+k*1.4);ch.rotation.y=Math.PI/2;hospInterior.add(ch);
  }

  // ---- NPCs: equipe e pacientes (animados por js/hospital.js) ----
  const DOCTOR=0xf4f6f7,DOCPANTS=0x33424a,NURSE=0x2aa6a0,NPANTS=0x1f7a76,GOWN=0xbcd6dc;
  // adiciona um ped ao interior e registra pra animação
  const addPed=(shirt,pants,x,z,faceYaw,kind,extra={})=>{
    const g=makePed(shirt,pants);
    g.position.set(x,0,z);g.rotation.y=faceYaw;
    hospInterior.add(g);
    hospFx.peds.push({g,t:rand(0,6),sp:rand(.8,1.3),kind,face:faceYaw,...extra});
  };
  // paciente deitado no leito (pose de costas, rosto pra cima), centrado no colchão
  const addLying=(x)=>{
    const g=makePed(GOWN,GOWN);
    g.position.set(x,.98,186.4);g.rotation.set(-Math.PI/2,0,0);
    hospInterior.add(g);
    hospFx.peds.push({g,kind:'lie'});
    return g;
  };
  hospFx.sickPatient=addLying(-806); // este fala quando o jogador chega perto (js/hospital.js)
  addLying(-796);                    // segundo paciente internado
  addPed(NURSE,NPANTS,-800,173.4,0,'idle');    // enfermeira na recepção (olha pra sala)
  addPed(DOCTOR,DOCPANTS,-797.5,181,-Math.PI/2,'idle'); // médico examinando o leito da ponta
  addPed(DOCTOR,DOCPANTS,-804,181,Math.PI/2,'idle');    // outro médico
  addPed(NURSE,NPANTS,-803,179,0,'walk',{x0:-808,x1:-794,z:179}); // enfermeira de ronda
  addPed(GOWN,GOWN,-808,182.5,Math.PI/2,'idle'); // paciente em pé perto da espera

  // kit de cura: cruz verde flutuando no centro (animada por js/hospital.js)
  hospFx.heal=makeCross(2,greenM);
  hospFx.heal.position.set(HOSP_HEAL.x,1.3,HOSP_HEAL.z);hospInterior.add(hospFx.heal);

  // luz fria da sala (só existe com o hospital visível)
  const light=new THREE.PointLight(0xdff0ff,70,46,1.6);
  light.position.set(-800,4.6,180);hospInterior.add(light);

  // porta de saída (parede oeste) com cruz verde em cima
  const exitDoor=new THREE.Mesh(new THREE.BoxGeometry(.16,3,2.4),
    matte({color:0x2a3338,roughness:.7}));
  exitDoor.position.set(-812.85,1.5,180);hospInterior.add(exitDoor);
  const exitCross=makeCross(.9,greenM);
  exitCross.position.set(-812.78,3.2,180);exitCross.rotation.y=Math.PI/2;hospInterior.add(exitCross);
  hospFx.exitArrow=makeDoorArrow();
  hospFx.exitArrow.position.set(-811.9,1.7,180);
  hospInterior.add(hospFx.exitArrow);

  scene.add(hospInterior);

  // paredes são sólidas (o jogador não atravessa nem sai da sala)
  solids.push(
    {x0:-814,x1:-812.9,z0:171.5,z1:188.5,h:6},   // parede oeste
    {x0:-787.1,x1:-786,z0:171.5,z1:188.5,h:6},   // parede leste
    {x0:-813.5,x1:-786.5,z0:171.4,z1:172.1,h:6}, // parede norte
    {x0:-813.5,x1:-786.5,z0:187.9,z1:188.6,h:6}, // parede sul
  );
}
