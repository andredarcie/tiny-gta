import * as THREE from 'three';

// Carrinho de controle remoto MINÚSCULO estilo brinquedo (~1.2m):
// chassi baixo e largo, 4 rodas grandes "de off-road" e uma anteninha fina
// com bolinha na ponta. Cor viva (laranja) com uma faixa amarela em cima.
// build() é PURO (devolve um Object3D novo, sem mexer na cena), seguindo o
// padrão de modelo do projeto. Geometria por primitivas, sem assets externos.

const bodyM=new THREE.MeshStandardMaterial({color:0xff7a18,roughness:.35,metalness:.3});
const stripeM=new THREE.MeshStandardMaterial({color:0xffd23a,roughness:.4,metalness:.2});
const tireM=new THREE.MeshStandardMaterial({color:0x14121a,roughness:.95});
const hubM=new THREE.MeshStandardMaterial({color:0xc9ced9,roughness:.3,metalness:.85});
const antM=new THREE.MeshStandardMaterial({color:0x222228,roughness:.6});
const tipM=new THREE.MeshBasicMaterial({color:0xff3b56});
const winM=new THREE.MeshStandardMaterial({color:0x121820,roughness:.2,metalness:.6}); // "vidro" da cabine
const lightM=new THREE.MeshBasicMaterial({color:0xfff2c0}); // faróis (brilho)

function buildRcBandit(){
  const g=new THREE.Group();

  // chassi baixo (a "carroceria" do brinquedo)
  const chassis=new THREE.Mesh(new THREE.BoxGeometry(.6,.18,1.05),bodyM);
  chassis.position.y=.26;chassis.castShadow=true;g.add(chassis);

  // capota/cabine arredondada, levemente afunilada em cima
  const cab=new THREE.Mesh(new THREE.BoxGeometry(.46,.2,.5),bodyM);
  cab.position.set(0,.42,-.02);cab.castShadow=true;g.add(cab);

  // para-brisa escuro na frente da cabine (dá leitura de "carro de verdade")
  const win=new THREE.Mesh(new THREE.BoxGeometry(.4,.15,.04),winM);
  win.position.set(0,.43,.22);win.rotation.x=-.3;g.add(win);

  // faixa amarela de corrida no topo
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.16,.04,1.0),stripeM);
  stripe.position.set(0,.36,0);g.add(stripe);

  // dois farolzinhos na dianteira (pontos de brilho)
  const lightG=new THREE.BoxGeometry(.09,.07,.04);
  for(const sx of[-1,1]){
    const l=new THREE.Mesh(lightG,lightM);
    l.position.set(sx*.18,.27,.53);g.add(l);
  }

  // aerofólio traseiro baixinho (toque de brinquedo de corrida)
  const wing=new THREE.Mesh(new THREE.BoxGeometry(.5,.03,.1),stripeM);
  wing.position.set(0,.42,-.5);g.add(wing);
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.04,.12,.04),bodyM);
    post.position.set(sx*.18,.36,-.5);g.add(post);
  }

  // 4 rodas GRANDES (proporção exagerada de brinquedo)
  const wheelG=new THREE.CylinderGeometry(.22,.22,.16,12);
  g.userData.wheels=[];g.userData.front=[];
  for(const[sx,sz]of[[1,.36],[-1,.36],[1,-.36],[-1,-.36]]){
    const wg=new THREE.Group();wg.position.set(sx*.36,.22,sz);wg.rotation.order='YXZ';
    const w=new THREE.Mesh(wheelG,[tireM,hubM,hubM]);
    w.rotation.z=Math.PI/2;wg.add(w);
    g.add(wg);g.userData.wheels.push(wg);
    if(sz>0)g.userData.front.push(wg);
  }

  // anteninha: haste fina + bolinha vermelha na ponta
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.5,6),antM);
  ant.position.set(-.2,.66,-.34);ant.rotation.z=-.12;g.add(ant);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.05,8,8),tipM);
  tip.position.set(-.23,.91,-.34);g.add(tip);

  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Vehicles',label:'RC bandit',build:buildRcBandit};

// Compat com o padrão dos outros veículos: factory direta.
export function makeRcBandit(){return buildRcBandit();}
