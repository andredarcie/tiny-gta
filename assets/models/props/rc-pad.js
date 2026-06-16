import * as THREE from 'three';

// Plataforma/marca no chão indicando o ponto do RC SMASH: um disco escuro com
// uma borda em zebra (faixas amarelas/pretas) e quatro setas apontando pro
// centro, dando o ar de "pista de largada de brinquedo". build() é PURO.

const baseM=new THREE.MeshStandardMaterial({color:0x1a1d24,roughness:.9});
const ringM=new THREE.MeshBasicMaterial({color:0xff7a18}); // anel laranja vivo
const stripeM=new THREE.MeshBasicMaterial({color:0xffd23a});
const arrowM=new THREE.MeshBasicMaterial({color:0xff7a18});
const dotM=new THREE.MeshBasicMaterial({color:0x5eff8a}); // ponto-alvo verde no centro

function buildRcPad(){
  const g=new THREE.Group();

  // disco base, bem rente ao chão
  const base=new THREE.Mesh(new THREE.CylinderGeometry(2.0,2.0,.06,28),baseM);
  base.position.y=.03;g.add(base);

  // anel laranja fino marcando a borda interna (dá o ar de "pista de largada")
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1.35,.06,6,28),ringM);
  ring.rotation.x=Math.PI/2;ring.position.y=.065;g.add(ring);

  // ponto-alvo no centro: o lugar exato onde o carrinho descansa
  const dot=new THREE.Mesh(new THREE.CylinderGeometry(.28,.28,.04,16),dotM);
  dot.position.y=.065;g.add(dot);

  // borda em zebra: blocos amarelos espaçados ao redor do anel externo
  const blockG=new THREE.BoxGeometry(.34,.05,.5);
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    const b=new THREE.Mesh(blockG,stripeM);
    b.position.set(Math.cos(a)*1.7,.07,Math.sin(a)*1.7);
    b.rotation.y=-a;g.add(b);
  }

  // quatro setas (chevrons) apontando pro centro, em N/S/L/O
  const armG=new THREE.BoxGeometry(.5,.04,.13);
  for(let q=0;q<4;q++){
    const arrow=new THREE.Group();
    const a1=new THREE.Mesh(armG,arrowM);a1.position.set(-.13,0,.13);a1.rotation.y=.78;
    const a2=new THREE.Mesh(armG,arrowM);a2.position.set(-.13,0,-.13);a2.rotation.y=-.78;
    arrow.add(a1,a2);
    arrow.position.set(0,.075,0);
    arrow.rotation.y=q*Math.PI/2;
    arrow.translateZ(.95); // empurra a seta pra fora, ainda apontando pro centro
    g.add(arrow);
  }

  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Props',label:'RC pad',build:buildRcPad};

// Compat: factory direta.
export function makeRcPad(){return buildRcPad();}
