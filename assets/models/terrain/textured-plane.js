import * as THREE from 'three';

export function makeTexturedPlane(sizeOrW,sizeOrD,texture,y=0){
  const w=sizeOrW,d=sizeOrD??sizeOrW;
  // Lambert (difuso por vértice, sem specular): o chão é matte e cobre a maior
  // parte da tela — é o maior consumidor de fill-rate. Lambert é o material
  // iluminado mais barato e bate com o visual fosco do PBR antigo (roughness 1).
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),
    new THREE.MeshLambertMaterial({map:texture}));
  mesh.rotation.x=-Math.PI/2;
  mesh.position.y=y;
  mesh.receiveShadow=true;
  return mesh;
}
