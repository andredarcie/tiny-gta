import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Caminhão de bombeiros: cabine baixa na frente + módulo/baú traseiro MAIS ALTO
// (silhueta clássica de fire engine), two-tone vermelho/branco, painel da bomba
// cromado entre cabine e baú, compartimentos de equipamento nas laterais, escada
// e canhão d'água (monitor) no teto do baú, carretel de mangueira no portão
// traseiro e 6 rodas. Construção 100% procedural (sem assets binários), padrão de
// UM modelo por arquivo. build() é PURO (devolve um Object3D novo, nunca dá
// scene.add). O firefighter.js usa makeFireTruck() pro veículo de plantão; o
// motor de direção do jogo dirige o grupo como um carro normal.
//
// PERF: tudo que não se move é FUNDIDO por material (mergeGeometries) — corpo
// vermelho (1), branco (1), detalhes escuros (1), cromado+escada (1), vidros (1),
// faróis (1), lanternas (1). Antes a escada sozinha eram 9 meshes soltos.
//
// Contratos de userData lidos pelo jogo (NÃO renomear):
//  dentable[] (dentCar), bar[] (blinkBar), wheels[]/front[] (spinWheels),
//  cannon (firefighter gira em Y pra mirar), nozzle (origem do jato d'água),
//  tailM (updateCar acende a lanterna no freio/ré).
//
// Eixos (igual aos outros veículos): +z = frente, x = largura, y = altura do chão.

// ---------- materiais (compartilhados; cor NÃO é mutada em runtime) ----------
const redM=new THREE.MeshStandardMaterial({color:0xd11e1e,roughness:.5,metalness:.15});   // carroceria
const darkM=new THREE.MeshStandardMaterial({color:0x1a1d24,roughness:.6,metalness:.25});  // detalhes escuros
const glassM=new THREE.MeshStandardMaterial({color:0x8fc3e0,roughness:.08,metalness:.6,
  transparent:true,opacity:.42,depthWrite:false});                                         // vidros
const tireM=new THREE.MeshStandardMaterial({color:0x14121a,roughness:.95});                // pneus
const hubM=new THREE.MeshStandardMaterial({color:0xb9bec9,roughness:.3,metalness:.85});    // cubos
const chromeM=new THREE.MeshStandardMaterial({color:0xc9ccd4,roughness:.35,metalness:.8}); // cromado/escada
const whiteM=new THREE.MeshStandardMaterial({color:0xf4f5f7,roughness:.6});                 // two-tone branco
const lightM=new THREE.MeshBasicMaterial({color:0xfff2c0});                                 // faróis
const hoseM=new THREE.MeshStandardMaterial({color:0xf4c542,roughness:.7});                  // mangueira amarela
// giroflex e lanternas usam material POR-INSTÂNCIA (blinkBar/updateCar mexem na cor).

// clona uma geometria já posicionada em coordenadas do veículo
function placed(geo,x,y,z,rx=0,rz=0){
  const g=geo.clone();
  if(rx)g.rotateX(rx);
  if(rz)g.rotateZ(rz);
  g.translate(x,y,z);
  return g;
}

// ---------- corpo vermelho (fundido) ----------
const bodyGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(2.0,.6,4.9),0,.6,0),         // chassi/saia comprido
  placed(new THREE.BoxGeometry(2.0,1.0,1.75),0,1.4,1.5),    // cabine (frente, baixa)
  placed(new THREE.BoxGeometry(2.08,1.45,2.7),0,1.625,-.9), // baú/módulo traseiro (mais alto)
  placed(new THREE.BoxGeometry(2.18,.5,1.1),0,.55,1.55),    // para-lama dianteiro (flare)
  placed(new THREE.BoxGeometry(2.18,.5,2.0),0,.55,-1.4),    // para-lama traseiro (eixo duplo)
],false);

// ---------- two-tone branco (teto da cabine + faixas laterais) ----------
const whiteGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(2.02,.1,1.79),0,1.92,1.5),   // teto branco da cabine
  placed(new THREE.BoxGeometry(.04,.26,1.7),1.01,.92,1.5),  // faixa cabine dir
  placed(new THREE.BoxGeometry(.04,.26,1.7),-1.01,.92,1.5), // faixa cabine esq
  placed(new THREE.BoxGeometry(.04,.26,2.7),1.06,.92,-.9),  // faixa módulo dir
  placed(new THREE.BoxGeometry(.04,.26,2.7),-1.06,.92,-.9), // faixa módulo esq
],false);

// ---------- detalhes escuros (fundidos) ----------
const darkGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.3,.34,.08),0,1.25,2.40),   // grade frontal
  placed(new THREE.BoxGeometry(1.7,1.1,.06),0,1.5,-2.24),   // portão traseiro (roller)
  // compartimentos de equipamento (lockers) nas laterais do baú: 2 por lado
  placed(new THREE.BoxGeometry(.05,.82,.9),1.07,1.32,-.3),
  placed(new THREE.BoxGeometry(.05,.82,.9),1.07,1.32,-1.55),
  placed(new THREE.BoxGeometry(.05,.82,.9),-1.07,1.32,-.3),
  placed(new THREE.BoxGeometry(.05,.82,.9),-1.07,1.32,-1.55),
  // retrovisores: braço + cabeça, nos dois lados da cabine
  placed(new THREE.BoxGeometry(.22,.05,.05),1.10,1.58,2.10),
  placed(new THREE.BoxGeometry(.05,.32,.16),1.22,1.52,2.12),
  placed(new THREE.BoxGeometry(.22,.05,.05),-1.10,1.58,2.10),
  placed(new THREE.BoxGeometry(.05,.32,.16),-1.22,1.52,2.12),
  // base do giroflex no teto da cabine
  placed(new THREE.BoxGeometry(1.0,.12,.46),0,1.99,1.4),
],false);

// ---------- cromado: para-choques + painel da bomba + escada (fundidos) -------
const chromeParts=[
  placed(new THREE.BoxGeometry(2.14,.26,.34),0,.45,2.46),   // para-choque dianteiro
  placed(new THREE.BoxGeometry(2.14,.24,.30),0,.45,-2.32),  // para-choque traseiro
  placed(new THREE.BoxGeometry(.05,.7,.66),1.03,1.15,.55),  // painel da bomba dir
  placed(new THREE.BoxGeometry(.05,.7,.66),-1.03,1.15,.55), // painel da bomba esq
  placed(new THREE.BoxGeometry(.06,.06,2.5),.34,2.42,-.95), // longarina escada dir
  placed(new THREE.BoxGeometry(.06,.06,2.5),-.34,2.42,-.95),// longarina escada esq
];
for(let i=0;i<7;i++) // degraus da escada (fundidos com as longarinas)
  chromeParts.push(placed(new THREE.BoxGeometry(.62,.05,.05),0,2.42,-2.05+i*.37));
const chromeGeo=mergeGeometries(chromeParts,false);

// ---------- vidros (fundidos) ----------
const glassGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.82,.5,.05),0,1.62,2.40,-.32), // para-brisa inclinado
  placed(new THREE.BoxGeometry(.05,.46,1.2),1.01,1.5,1.5),     // janela lateral dir
  placed(new THREE.BoxGeometry(.05,.46,1.2),-1.01,1.5,1.5),    // janela lateral esq
],false);

// ---------- faróis (fundidos) ----------
const headlightG=new THREE.CylinderGeometry(.13,.13,.08,12);
const headlightsGeo=mergeGeometries([
  placed(headlightG,.72,1.25,2.43,Math.PI/2),
  placed(headlightG,-.72,1.25,2.43,Math.PI/2),
],false);

// ---------- lanternas traseiras (geometria fundida; material por-instância) ----
const taillightsGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(.22,.34,.06),.82,1.1,-2.27),
  placed(new THREE.BoxGeometry(.22,.34,.06),-.82,1.1,-2.27),
],false);

// ---------- geometrias soltas ----------
const wheelG=new THREE.CylinderGeometry(.40,.40,.34,12);
const barLightG=new THREE.BoxGeometry(.42,.16,.42);
const hoseReelG=new THREE.CylinderGeometry(.34,.34,.5,14);
const cannonBaseG=new THREE.CylinderGeometry(.2,.26,.22,12);
const cannonBarrelG=new THREE.CylinderGeometry(.08,.11,.9,12);
const cannonNozzleG=new THREE.CylinderGeometry(.13,.08,.18,12);

function buildFireTruck(){
  const g=new THREE.Group();

  // corpo vermelho (amassável: registrado em dentable como os outros carros)
  const body=new THREE.Mesh(bodyGeo,redM);
  body.castShadow=true;g.add(body);
  g.userData.dentable=[body];

  g.add(new THREE.Mesh(whiteGeo,whiteM));     // two-tone branco
  g.add(new THREE.Mesh(darkGeo,darkM));       // grade/lockers/retrovisores/base giroflex
  g.add(new THREE.Mesh(chromeGeo,chromeM));   // para-choques/painel da bomba/escada
  const glass=new THREE.Mesh(glassGeo,glassM);glass.renderOrder=3;g.add(glass);
  g.add(new THREE.Mesh(headlightsGeo,lightM));

  // lanternas traseiras: material por-instância pra acender no freio/ré (updateCar)
  const tlMat=new THREE.MeshBasicMaterial({color:0xa01515});
  g.add(new THREE.Mesh(taillightsGeo,tlMat));
  g.userData.tailM=tlMat;

  // carretel de mangueira amarela no portão traseiro (deitado, face pra trás)
  const hose=new THREE.Mesh(hoseReelG,hoseM);
  hose.rotation.x=Math.PI/2;hose.position.set(0,1.35,-2.36);g.add(hose);

  // giroflex: VERMELHO (esq) + AZUL (dir), piscando via blinkBar. Materiais
  // SEPARADOS por instância — blinkBar muta material.color de cada um, então
  // compartilhar fazia o segundo sobrescrever o primeiro (bug: os dois azuis).
  const barLmat=new THREE.MeshBasicMaterial({color:0xff2222});
  const barRmat=new THREE.MeshBasicMaterial({color:0x2255ff});
  const bl=new THREE.Mesh(barLightG,barLmat);bl.position.set(-.3,2.10,1.4);
  const br=new THREE.Mesh(barLightG,barRmat);br.position.set(.3,2.10,1.4);
  g.add(bl,br);g.userData.bar=[bl,br];

  // canhão d'água (monitor) giratório na frente do deck do baú: o firefighter.js
  // gira o pivot em Y pra mirar e borrifa um jato a partir da ponta (userData.nozzle).
  // Em repouso o cano aponta pra frente (+z), levemente pra cima.
  const cannon=new THREE.Group();
  cannon.add(new THREE.Mesh(cannonBaseG,darkM));
  const barrel=new THREE.Mesh(cannonBarrelG,chromeM);
  barrel.rotation.x=Math.PI/2-.2;barrel.position.set(0,.18,.5); // elevação leve
  cannon.add(barrel);
  const nozzle=new THREE.Mesh(cannonNozzleG,darkM);
  nozzle.rotation.x=Math.PI/2;nozzle.position.set(0,.26,.92);
  cannon.add(nozzle);
  cannon.position.set(0,2.55,.15);
  g.add(cannon);
  g.userData.cannon=cannon;   // pivot que o firefighter gira pra mirar
  g.userData.nozzle=nozzle;   // ponta do cano (origem do jato, via getWorldPosition)

  // 6 rodas (3 de cada lado): 1 eixo dianteiro + eixo traseiro duplo (cara de
  // caminhão). spinWheels gira via userData.wheels e esterça as de userData.front.
  g.userData.wheels=[];g.userData.front=[];
  for(const[sx,sz]of[[1,1.55],[-1,1.55],[1,-1.0],[-1,-1.0],[1,-1.85],[-1,-1.85]]){
    const wg=new THREE.Group();wg.position.set(sx*.92,.40,sz);wg.rotation.order='YXZ';
    const w=new THREE.Mesh(wheelG,[tireM,hubM,hubM]);
    w.rotation.z=Math.PI/2;wg.add(w);
    g.add(wg);g.userData.wheels.push(wg);
    if(sz>0)g.userData.front.push(wg);
  }

  return g;
}

// Compat: gameplay usa makeFireTruck() e espera o veículo já como Object3D pronto.
// (Não dá scene.add aqui; quem usa decide quando inserir na cena.)
export function makeFireTruck(){return buildFireTruck();}

// Padrão de modelo: build() puro; descriptor pro model-viewer (descoberta automática).
export default {category:'Vehicles',label:'Fire truck',build:buildFireTruck,zoom:.55,yaw:-.6};
