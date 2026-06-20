import * as THREE from 'three';
import {matte} from '../matte.js';

// Prensa industrial de sucata (CAR CRUSHER) — estilo "esmagador de carros" do
// open-world. Modelo PURO: monta a estrutura e devolve o grupo. A placa/pistão pesado
// fica exposta em group.userData.press (um THREE.Mesh) para o sistema animar a
// descida sobre o carro. Cores industriais: cinza de aço e amarelo de máquina.
export function makeCarCrusher(): THREE.Group{
  const g=new THREE.Group();

  const steel=matte({color:0x6b7079,metalness:.8,roughness:.4});   // colunas/estrutura
  const dark=matte({color:0x2b2f36,roughness:.85});                // cama/base escura
  const yellow=matte({color:0xf2b71e,roughness:.6,metalness:.2});  // placa "perigo"
  const hazard=new THREE.MeshBasicMaterial({color:0x141414});      // listras escuras

  // ----- base / "cama" retangular onde o carro entra -----
  const bed=new THREE.Mesh(new THREE.BoxGeometry(7,.6,4.6),dark);
  bed.position.y=.3;bed.castShadow=true;bed.receiveShadow=true;g.add(bed);
  // bordas baixas da cama (guias laterais)
  for(const sz of[-1,1]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(7,.5,.4),steel);
    rail.position.set(0,.65,sz*2.1);rail.castShadow=true;g.add(rail);
  }
  // batente do fundo (lado +x), pra dar cara de máquina de uma boca só
  const stop=new THREE.Mesh(new THREE.BoxGeometry(.5,1.4,4.6),steel);
  stop.position.set(3.25,1.0,0);stop.castShadow=true;g.add(stop);

  // ----- duas colunas-guia que sustentam a placa -----
  for(const sz of[-1,1]){
    const col=new THREE.Mesh(new THREE.BoxGeometry(.7,5.4,.7),steel);
    col.position.set(0,3.0,sz*2.55);col.castShadow=true;col.receiveShadow=true;g.add(col);
    // pé/sapata da coluna
    const foot=new THREE.Mesh(new THREE.BoxGeometry(1.1,.4,1.1),dark);
    foot.position.set(0,.2,sz*2.55);g.add(foot);
  }
  // viga superior ligando as colunas (a placa desce a partir dela)
  const beam=new THREE.Mesh(new THREE.BoxGeometry(1.2,.7,6.0),steel);
  beam.position.set(0,5.5,0);beam.castShadow=true;g.add(beam);

  // ----- pistão hidráulico + placa pesada que desce -----
  // a placa fica num subgrupo pra animar só o Y dela; é o userData.press.
  // É um GRUPO (não um único Mesh) pra empilhar a chapa, o bloco esmagador por
  // baixo e a luva do pistão por cima — tudo desce junto. O sistema move só o Y.
  const press=new THREE.Group();
  press.position.y=4.6;        // posição "em cima" (descansando perto da viga)
  press.userData.upY=4.6;      // referência da altura de repouso (pro sistema)
  // chapa principal amarela
  const plate=new THREE.Mesh(new THREE.BoxGeometry(6.4,.9,4.2),yellow);
  plate.castShadow=true;plate.receiveShadow=true;press.add(plate);
  // bloco esmagador mais estreito por baixo (a "face" que toca o carro)
  const ram=new THREE.Mesh(new THREE.BoxGeometry(5.8,.55,3.8),steel);
  ram.position.y=-.66;ram.castShadow=true;press.add(ram);
  // listras de perigo na frente da chapa (puro visual)
  for(let k=-2;k<=2;k++){
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(.5,.92,4.24),hazard);
    stripe.position.set(k*1.1,0,0);press.add(stripe);
  }
  // luva curta do pistão presa no topo da chapa (acompanha a descida)
  const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.7,12),steel);
  sleeve.position.y=.7;press.add(sleeve);
  g.add(press);
  // haste fina do pistão saindo da viga (fixa: a luva da placa desliza por ela)
  const rod=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,1.6,12),steel);
  rod.position.y=5.0;g.add(rod);

  // luz/alerta no topo (apenas decorativo)
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),
    new THREE.MeshBasicMaterial({color:0xff5a2e}));
  lamp.position.set(0,5.95,2.55);g.add(lamp);

  g.userData.press=press;   // exposto pro sistema animar a descida
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Props',label:'Car crusher',build:()=>makeCarCrusher()};
