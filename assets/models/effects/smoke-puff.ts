import * as THREE from 'three';

// Baforada de fumaça do motor batido: esfera escura translúcida que nasce
// pequena, cresce e sobe. O emissor (player.js) mantém um POOL destas e anima
// escala/opacidade por instância — por isso cada baforada tem material próprio
// (criado uma vez na vida do pool). Esfera de baixo polígono: barata e igual de
// qualquer ângulo (não precisa virar pra câmera).
export function makeSmokePuff(color: THREE.ColorRepresentation=0x2c2a28): THREE.Mesh{
  return new THREE.Mesh(
    new THREE.SphereGeometry(.5,8,6),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:.5,
      depthWrite:false,fog:true}));
}

export default {category:'Effects',label:'Smoke puff',build:()=>makeSmokePuff()};
