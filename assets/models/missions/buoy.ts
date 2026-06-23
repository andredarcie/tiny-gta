import * as THREE from 'three';

// Boia de checkpoint da corrida de lanchas: um flutuador cônico-cilíndrico com
// faixa refletiva branca, mastro e lanterna no topo. É o equivalente aquático do
// anel/marcador de entrega da corrida de rua — o gameplay (boat-race.js) faz a
// boia balançar na água e mostra só a do checkpoint atual. Sem assets binários.
//
// Origem em y=0 = linha d'água: o lastro afunda (−Y) e o corpo/lanterna sobem.
// O sistema posiciona a boia em y≈SEA_Y (superfície do mar) e adiciona o balanço.

function buildBuoy(color=0xff8a1e): THREE.Group{
  const g=new THREE.Group();
  const paint=new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.2});
  const whiteM=new THREE.MeshStandardMaterial({color:0xf4f4f4,roughness:.6});
  const darkM=new THREE.MeshStandardMaterial({color:0x14181e,roughness:.6,metalness:.3});
  // corpo flutuante com lastro cônico submerso (ponta pra baixo)
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.82,.7,1.1,14),paint);
  body.position.y=.15;body.castShadow=true;g.add(body);
  const keel=new THREE.Mesh(new THREE.ConeGeometry(.7,.7,14),paint);
  keel.position.y=-.75;keel.rotation.x=Math.PI;g.add(keel);     // apex apontando pra baixo
  // faixa branca refletiva no meio
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.86,.86,.34,14),whiteM);
  band.position.y=.2;g.add(band);
  // topo cônico
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.66,.6,14),paint);
  cap.position.y=1.0;g.add(cap);
  // mastro + lanterna acesa (cesto de topo de detalhe)
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.3,8),darkM);
  mast.position.y=1.85;g.add(mast);
  const lamp=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),
    new THREE.MeshBasicMaterial({color}));
  lamp.position.y=2.55;g.add(lamp);
  const cage=new THREE.Mesh(new THREE.TorusGeometry(.2,.03,6,12),darkM);
  cage.position.y=2.55;cage.rotation.x=Math.PI/2;g.add(cage);
  return g;
}

// boat-race.js usa makeBuoy(color): só a boia física. O facho de luz alto que
// marca o checkpoint de longe é o Beacon padrão (js/core/beacon.ts), criado
// separadamente pela corrida de lanchas.
export function makeBuoy(color=0xff8a1e): THREE.Group{
  return buildBuoy(color);
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Race buoy',build:(o?:{color?:number})=>buildBuoy(o?.color??0xff8a1e)};
