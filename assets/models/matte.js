import * as THREE from 'three';

// Migração PBR→Lambert do mundo estático. O jogo é todo fosco (roughness alto,
// metal ~0), então troca-se o MeshStandardMaterial pelo MeshLambertMaterial —
// difuso por vértice, sem specular, o material iluminado mais barato — que
// reproduz bem o visual fosco do PBR antigo.
//
// matte(opts) aceita e IGNORA roughness/metalness, pra permitir trocar
// `new THREE.MeshStandardMaterial(opts)` por `matte(opts)` em massa sem ter que
// reescrever cada construtor. Mantém color/map/emissive/emissiveMap/
// emissiveIntensity/transparent/opacity/side/flatShading/vertexColors/fog/etc.
// (Lambert suporta emissiveMap, então janelas/letreiros acesos seguem valendo.)
export function matte(opts={}){
  const{roughness,metalness,...rest}=opts;
  return new THREE.MeshLambertMaterial(rest);
}
