import * as THREE from 'three';
import {matte} from '../matte.ts';

// A single cannabis seed: a small speckled-brown ovoid. The sowing hand pinches a few
// (makeSeedPinch) and flicks them into the soil; the plant-food pinch is the same
// shape in pale granules.
const seedGeo=new THREE.SphereGeometry(.018,7,5);
seedGeo.scale(1,.72,1.25);
const seedM=matte({color:0x6b4a2a});
const foodM=matte({color:0xe8e2c8});

export function makeSeed(food=false): THREE.Mesh{
  const m=new THREE.Mesh(seedGeo,food?foodM:seedM);
  m.castShadow=false;
  return m;
}

// A pinch of seeds held between fingertips (three seeds clustered on the origin).
export function makeSeedPinch(food=false,n=3): THREE.Group{
  const g=new THREE.Group();
  for(let i=0;i<n;i++){
    const s=makeSeed(food);
    s.position.set((i-1)*.02,(i%2)*.012,(i%2?-.01:.008));
    s.rotation.set(i*.9,i*1.7,i*.4);
    g.add(s);
  }
  return g;
}

export default {category:'Rural',label:'Weed seeds',build:()=>makeSeedPinch(false,3),zoom:6};
