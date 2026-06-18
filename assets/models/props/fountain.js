import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';

// City-square centerpiece: a small two-tier stone fountain with still water discs.
// Muted warm stone + a desaturated water blue (no cartoon cyan), to match the
// realistic palette of the rest of the world. build() is pure (fountain at the
// origin, basin resting on the ground); addFountain positions it, bakes it into
// the shared prop chunks and returns the collision AABB. Used to furnish the city
// pracinhas (js/world.js).
const stoneM=matte({color:0xb9b2a4,roughness:1});
const stoneDarkM=matte({color:0x968f82,roughness:1});
const waterM=matte({color:0x5f86a0,roughness:1});

function build(){
  const g=new THREE.Group();
  // Lower basin: a short stone drum with a darker rim and a still water disc.
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(1.8,1.95,.5,20),stoneM);
  basin.position.y=.25;basin.castShadow=true;basin.receiveShadow=true;g.add(basin);
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(1.86,1.86,.14,20),stoneDarkM);
  rim.position.y=.52;rim.castShadow=true;g.add(rim);
  const water0=new THREE.Mesh(new THREE.CylinderGeometry(1.6,1.6,.06,20),waterM);
  water0.position.y=.46;water0.receiveShadow=true;g.add(water0);
  // Central pedestal carrying the upper bowl.
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(.32,.46,1.05,12),stoneM);
  ped.position.y=1.02;ped.castShadow=true;g.add(ped);
  // Upper bowl + its water + a small finial.
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.78,.5,.26,16),stoneM);
  bowl.position.y=1.5;bowl.castShadow=true;g.add(bowl);
  const water1=new THREE.Mesh(new THREE.CylinderGeometry(.66,.66,.05,16),waterM);
  water1.position.y=1.62;g.add(water1);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),stoneDarkM);
  tip.position.y=1.74;g.add(tip);
  g.userData.r=1.9;g.userData.h=1.8;
  return g;
}

export default {category:'Props',label:'Fountain',build};

export function addFountain(x,z){
  const g=build();g.position.set(x,0,z);bakeProp(g);
  // Square AABB approximating the round basin — a touch inside the radius so the
  // corners don't stop the player too early.
  const e=1.55;
  return{x0:x-e,x1:x+e,z0:z-e,z1:z+e,h:1.0};
}
