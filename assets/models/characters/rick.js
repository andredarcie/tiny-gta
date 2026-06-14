import * as THREE from 'three';
import {matte} from '../matte.js';
import {buildPed} from './pedestrian.js';

// Rick, o eremita hippie da floresta (missão secreta — ver js/rick.js).
// Reaproveita o pedestre RIGGED (buildPed: tem userData.limbs e userData.mouth,
// então a câmera de cut-scene anima braços/boca dele igual aos NPCs da história)
// e cola por cima um visual de hippie cabeludo: cabelão, barbão e bandana,
// tudo roupa verde combinando com a vida na natureza.

const SHIRT=0x3f7d3a, PANTS=0x33502a;   // verde-mato (camisa + calça)
const HAIR=0x4a2f1a;                     // castanho
const BAND=0xc2402e;                     // bandana vermelha (toque hippie)

// Cabeleira/barba presas na altura da cabeça do ped (centro ~y1.62). A cabeça do
// ped não gira, então o cabelo fixo acompanha bem; é gerado uma vez por sessão.
function addManeAndBeard(g){
  const hairM=matte({color:HAIR,roughness:1});
  const mane=new THREE.Group();
  // calota por cima do crânio
  const top=new THREE.Mesh(new THREE.SphereGeometry(.30,10,8),hairM);
  top.scale.set(1.06,.92,1.12);top.position.set(0,1.71,-.02);mane.add(top);
  // cabelão caindo pelas costas até os ombros
  const back=new THREE.Mesh(new THREE.BoxGeometry(.42,.58,.16),hairM);
  back.position.set(0,1.34,-.17);back.rotation.x=.14;mane.add(back);
  // mechas laterais
  for(const sx of[-1,1]){
    const lock=new THREE.Mesh(new THREE.BoxGeometry(.13,.5,.17),hairM);
    lock.position.set(sx*.23,1.36,.02);lock.rotation.z=sx*.06;mane.add(lock);
  }
  // barbão farto do queixo ao peito
  const beard=new THREE.Mesh(new THREE.SphereGeometry(.2,9,7),hairM);
  beard.scale.set(1.02,1.3,.72);beard.position.set(0,1.4,.12);mane.add(beard);
  const beardTip=new THREE.Mesh(new THREE.BoxGeometry(.22,.3,.14),hairM);
  beardTip.position.set(0,1.16,.16);mane.add(beardTip);
  // bigode
  const stache=new THREE.Mesh(new THREE.BoxGeometry(.2,.06,.08),hairM);
  stache.position.set(0,1.52,.2);mane.add(stache);
  // bandana em volta da testa
  const band=new THREE.Mesh(new THREE.TorusGeometry(.245,.038,8,18),matte({color:BAND}));
  band.rotation.x=Math.PI/2;band.position.set(0,1.66,0);mane.add(band);
  mane.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  g.add(mane);
}

export function buildRick(){
  const g=buildPed({color:SHIRT,pantsColor:PANTS});
  addManeAndBeard(g);
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Characters',label:'Rick (hippie)',build:buildRick};
