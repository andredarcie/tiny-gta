import * as THREE from 'three';

// Ground RING of an objective marker: the flat pulsing torus that lies on the
// ground at an objective (delivery, race checkpoint, taxi fare, target, ...).
// The rising glowing column that pairs with it is the standard Beacon
// (js/core/beacon.ts) — kept as a separate piece so every objective shares the
// one beacon definition while the ring stays optional/independent.
export function makeMarkerRing(color=0x19e3ff): THREE.Mesh{
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.2,.25,8,28),
    new THREE.MeshBasicMaterial({color}));
  ring.rotation.x=Math.PI/2;
  return ring;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Marker ring',build:(o:{color?:number})=>makeMarkerRing(o.color??0x19e3ff)};
