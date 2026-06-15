import * as THREE from 'three';

// HIDDEN PACKAGE: embrulho ciano brilhante (caixa + fita cruzada + laço + halo)
// fácil de avistar de longe. A caixa usa material "standard" emissivo pra brilhar
// mesmo à noite; a fita/laço/halo usam "basic" (cor sólida, independem de luz).
// Materiais e geometrias são singletons de módulo: todas as instâncias os
// compartilham (economia de memória; o batch real é por draw call na cena).
const boxG=new THREE.BoxGeometry(.5,.5,.5);
const boxM=new THREE.MeshStandardMaterial({
  color:0x12c6e0,emissive:0x14b6da,emissiveIntensity:1.1,
  roughness:.3,metalness:.2
});
// Fita: duas tiras finas cruzando a caixa, num ciano bem claro.
const ribbonM=new THREE.MeshBasicMaterial({color:0xcaf8ff});
const ribbonAG=new THREE.BoxGeometry(.56,.56,.12);
const ribbonBG=new THREE.BoxGeometry(.12,.56,.56);
// Laço: duas esferinhas no topo, quase brancas.
const bowM=new THREE.MeshBasicMaterial({color:0xeafdff});
const bowG=new THREE.SphereGeometry(.11,10,8);
// Halo: octaedro translúcido envolvendo a caixa — dá um "glow" lido de longe sem
// custar luz nem sombra. additive pra somar com o fundo (parece luminoso).
const haloM=new THREE.MeshBasicMaterial({
  color:0x9bf0ff,transparent:true,opacity:.22,
  blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide
});
const haloG=new THREE.OctahedronGeometry(.62,0);

export function makeHiddenPackage(){
  const g=new THREE.Group();
  const box=new THREE.Mesh(boxG,boxM);box.castShadow=false;g.add(box);
  const ra=new THREE.Mesh(ribbonAG,ribbonM);ra.castShadow=false;g.add(ra);
  const rb=new THREE.Mesh(ribbonBG,ribbonM);rb.castShadow=false;g.add(rb);
  for(const s of[-1,1]){
    const bow=new THREE.Mesh(bowG,bowM);
    bow.position.set(s*.12,.31,0);bow.castShadow=false;g.add(bow);
  }
  const halo=new THREE.Mesh(haloG,haloM);halo.castShadow=false;
  // marcado pra que o gameplay possa pulsar o halo sem mexer nos outros meshes.
  halo.name='halo';g.add(halo);
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Props',label:'Hidden package',build:()=>makeHiddenPackage()};
