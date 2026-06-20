import * as THREE from 'three';
import {matte} from '../matte.ts';

// Handheld FLASHLIGHT the player auto-equips inside the dark escape tunnel
// (js/activities/jail-break.ts positions it at the hand and aims it where you look, and
// toggles the beam on only while you're in the tunnel). The whole thing points
// down the group's local -Z so a single Object3D.lookAt() aims body + beam.

const bodyM=matte({color:0x232a31,metalness:.55,roughness:.45});
const headM=matte({color:0x9aa3ad,metalness:.7,roughness:.3});
const lensM =new THREE.MeshBasicMaterial({color:0xfff3c8}); // glowing lens face

export function buildFlashlight(): THREE.Group{
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.034,.03,.2,12),bodyM);
  body.rotation.x=Math.PI/2;body.position.z=.04;g.add(body);                // grip
  const head=new THREE.Mesh(new THREE.CylinderGeometry(.058,.038,.09,16),headM);
  head.rotation.x=Math.PI/2;head.position.z=-.1;g.add(head);                // reflector bell
  const lens=new THREE.Mesh(new THREE.CircleGeometry(.05,16),lensM);
  lens.position.z=-.146;g.add(lens);                                        // lit lens face
  // Cone beam aimed along -Z (toward the target a few metres ahead).
  const light=new THREE.SpotLight(0xfff1d2,0,24,Math.PI/4.4,.55,1.1);
  light.position.set(0,0,-.14);g.add(light);
  const target=new THREE.Object3D();target.position.set(0,0,-5);g.add(target);
  light.target=target;
  g.userData.light=light;g.userData.lens=lens;
  return g;
}

export default {category:'Props',label:'Flashlight',build:buildFlashlight};
