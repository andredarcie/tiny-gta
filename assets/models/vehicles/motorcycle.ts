import * as THREE from 'three';
import {scene} from '../../../js/engine.js';
import {beamMat} from './car.js'; // mesma luz de farol do carro (daynight liga à noite)

// Moto estilo Open-world: cruiser/street compacta, ~2.1m de comprimento, rodas Ø.68,
// banco a ~.80 de altura (o piloto fica visível por cima, diferente do carro).
// Convenção igual à do carro: +Z é a FRENTE (farol/garfo na frente), largura em X.
//
// Otimização no mesmo espírito do carro: materiais compartilhados no módulo e
// uma única tinta por cor (paintCache). Partes que GIRAM ficam soltas:
//   userData.wheels = [rodaDianteira, rodaTraseira]  (spinWheels gira rotation.x)
//   userData.front  = [garfo]                         (spinWheels esterça rotation.y)
// Sem userData.dentable (moto não amassa), sem volante e sem portas — o gameplay
// trata a moto pelo flag `bike` (monta/desce direto, igual avião).

const tireM=new THREE.MeshStandardMaterial({color:0x14121a,roughness:.95});
const hubM=new THREE.MeshStandardMaterial({color:0xb9bec9,roughness:.3,metalness:.85});
const matteM=new THREE.MeshStandardMaterial({color:0x191b22,roughness:.7,metalness:.3});
const chromeM=new THREE.MeshStandardMaterial({color:0xd7dbe2,roughness:.18,metalness:.95});
const seatM=new THREE.MeshStandardMaterial({color:0x15151b,roughness:.85});
const hlM=new THREE.MeshBasicMaterial({color:0xfff2c0});
const tlM=new THREE.MeshBasicMaterial({color:0xc41818});

// Geometrias base compartilhadas
const wheelG=new THREE.CylinderGeometry(.34,.34,.14,16);
const discG=new THREE.CylinderGeometry(.17,.17,.155,14);
const forkLegG=new THREE.CylinderGeometry(.035,.035,.46,8);
const yokeG=new THREE.BoxGeometry(.22,.07,.1);   // mesa superior que une as duas pernas
const riserG=new THREE.CylinderGeometry(.03,.03,.46,8); // haste da mesa até o guidão
const stanchG=new THREE.CylinderGeometry(.028,.028,.2,8); // tubo do garfo acima da mesa
const barG=new THREE.BoxGeometry(.58,.05,.05);
const gripG=new THREE.CylinderGeometry(.04,.04,.12,8);
const headG=new THREE.CylinderGeometry(.12,.10,.1,14);
const tankG=new THREE.BoxGeometry(.36,.26,.62);
const engineG=new THREE.BoxGeometry(.36,.32,.5);
const seatGeo=new THREE.BoxGeometry(.3,.12,.64);
const cowlG=new THREE.BoxGeometry(.28,.2,.26);
const fenderRG=new THREE.BoxGeometry(.24,.1,.5);
const fenderFG=new THREE.BoxGeometry(.18,.08,.34);
const swingG=new THREE.BoxGeometry(.1,.08,.7);
const downTubeG=new THREE.CylinderGeometry(.045,.045,.7,8);
const exhaustG=new THREE.CylinderGeometry(.05,.06,.92,10);
const tipG=new THREE.CylinderGeometry(.07,.06,.1,10);
const pegG=new THREE.BoxGeometry(.14,.05,.08);
const mirrorStemG=new THREE.CylinderGeometry(.012,.012,.16,6);
const mirrorG=new THREE.BoxGeometry(.11,.07,.03);
const tlGeo=new THREE.BoxGeometry(.12,.07,.05);
const standG=new THREE.BoxGeometry(.04,.34,.04);
const beamGeo=new THREE.PlaneGeometry(3.2,5.0); // facho do farol (menor que o do carro)

const paintCache=new Map<number,THREE.MeshStandardMaterial>();
function paintFor(color: number): THREE.MeshStandardMaterial{
  if(!paintCache.has(color))
    paintCache.set(color,new THREE.MeshStandardMaterial({color,roughness:.32,metalness:.55}));
  return paintCache.get(color)!;
}

// roda com pneu + disco/cubo cromado, eixo ao longo de X (gira em rotation.x do grupo)
function makeWheel(): THREE.Group{
  const wg=new THREE.Group();
  const tire=new THREE.Mesh(wheelG,[tireM,hubM,hubM]);
  tire.rotation.z=Math.PI/2;tire.castShadow=true;wg.add(tire);
  const disc=new THREE.Mesh(discG,chromeM);
  disc.rotation.z=Math.PI/2;wg.add(disc);
  return wg;
}

function buildMotorcycle({color=0xd11f3a}: {color?: number}={}): THREE.Group{
  const g=new THREE.Group();
  const paint=paintFor(color);
  g.userData.color=color; // a garagem rural lê isto pra recriar a moto salva

  // ---- roda traseira + balança + escapamentos ----
  const rw=makeWheel();
  rw.position.set(0,.34,-.95);g.add(rw);
  const swing=new THREE.Mesh(swingG,matteM);
  swing.position.set(0,.36,-.5);g.add(swing);
  const fenderR=new THREE.Mesh(fenderRG,paint);
  fenderR.position.set(0,.66,-.95);g.add(fenderR);

  // ---- motor + quadro + tanque + banco ----
  const engine=new THREE.Mesh(engineG,matteM);
  engine.position.set(0,.46,-.04);engine.castShadow=true;g.add(engine);
  const downTube=new THREE.Mesh(downTubeG,chromeM);
  downTube.position.set(0,.5,.34);downTube.rotation.x=.7;g.add(downTube);
  const tank=new THREE.Mesh(tankG,paint);
  tank.position.set(0,.74,.14);tank.castShadow=true;g.add(tank);
  const seat=new THREE.Mesh(seatGeo,seatM);
  seat.position.set(0,.79,-.34);g.add(seat);
  const cowl=new THREE.Mesh(cowlG,paint);
  cowl.position.set(0,.82,-.66);g.add(cowl);
  // pedaleiras e escapamentos cromados saindo pra trás
  for(const sx of[-1,1]){
    const peg=new THREE.Mesh(pegG,matteM);
    peg.position.set(sx*.24,.34,-.02);g.add(peg);
    const ex=new THREE.Mesh(exhaustG,chromeM);
    ex.rotation.x=Math.PI/2;ex.position.set(sx*.17,.32,-.42);g.add(ex);
    const tip=new THREE.Mesh(tipG,matteM);
    tip.rotation.x=Math.PI/2;tip.position.set(sx*.17,.32,-.9);g.add(tip);
  }
  // descanso lateral (kickstand)
  const stand=new THREE.Mesh(standG,matteM);
  stand.position.set(-.3,.18,-.05);stand.rotation.z=.5;g.add(stand);
  // lanterna traseira
  const tail=new THREE.Mesh(tlGeo,tlM);
  tail.position.set(0,.74,-.98);g.add(tail);

  // ---- garfo dianteiro (esterça): roda, garfo, guidão, farol ----
  const fork=new THREE.Group();
  fork.position.set(0,.6,.56); // cabeça de direção
  const fw=makeWheel();
  fw.position.set(0,-.26,.36); // → mundo (0,.34,.92): eixo dianteiro
  fork.add(fw);
  for(const sx of[-1,1]){ // duas pernas do garfo descendo até a roda
    const leg=new THREE.Mesh(forkLegG,chromeM);
    leg.position.set(sx*.09,-.13,.18);leg.rotation.x=-.945;fork.add(leg);
    // tubo curto do garfo subindo acima da mesa (continuidade visual)
    const stanch=new THREE.Mesh(stanchG,chromeM);
    stanch.position.set(sx*.09,.12,.04);fork.add(stanch);
  }
  const fenderF=new THREE.Mesh(fenderFG,paint);
  fenderF.position.set(0,-.05,.3);fenderF.rotation.x=-.4;fork.add(fenderF);
  // mesa superior + haste ligam o garfo ao guidão erguido (sem isso ele flutua)
  const yoke=new THREE.Mesh(yokeG,matteM);
  yoke.position.set(0,.05,.05);fork.add(yoke);
  const riser=new THREE.Mesh(riserG,matteM);
  riser.position.set(0,.3,-.065);riser.rotation.x=-.3;fork.add(riser);
  // guidão erguido e recuado (cruiser): encontra as mãos do piloto montado.
  // Mundo ≈ (±.27, 1.15, .42), no alcance da palma a partir do ombro (~.62)
  const bar=new THREE.Mesh(barG,matteM);
  bar.position.set(0,.55,-.14);fork.add(bar);
  for(const sx of[-1,1]){
    const grip=new THREE.Mesh(gripG,seatM);
    grip.rotation.z=Math.PI/2;grip.position.set(sx*.27,.55,-.14);fork.add(grip);
    // espelhos retrovisores
    const stem=new THREE.Mesh(mirrorStemG,matteM);
    stem.position.set(sx*.24,.65,-.14);fork.add(stem);
    const mir=new THREE.Mesh(mirrorG,matteM);
    mir.position.set(sx*.26,.73,-.14);fork.add(mir);
  }
  const head=new THREE.Mesh(headG,hlM);
  head.rotation.x=Math.PI/2;head.position.set(0,.18,.16);fork.add(head);
  g.add(fork);

  // facho do farol no chão à frente (só visível à noite, controlado por daynight)
  const beam=new THREE.Mesh(beamGeo,beamMat);
  beam.rotation.x=-Math.PI/2;beam.position.set(0,.12,3.4);beam.renderOrder=2;g.add(beam);

  g.userData.wheels=[fw,rw];
  g.userData.front=[fork];
  return g;
}

// Padrão de modelo: build() puro; descriptor com variações pro model-viewer.
export default {category:'Vehicles',label:'Motorcycle',build:buildMotorcycle,
  variants:[{label:'Motorcycle — red',opts:{color:0xd11f3a}},
            {label:'Motorcycle — teal',opts:{color:0x18b0a6}},
            {label:'Motorcycle — gold',opts:{color:0xe0a52a}}]};

// Compat: gameplay usa makeMotorcycle(color) e espera a moto já na cena.
export function makeMotorcycle(color: number): THREE.Group{const g=buildMotorcycle({color});scene.add(g);return g;}
