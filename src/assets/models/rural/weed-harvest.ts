import * as THREE from 'three';
import {matte} from '../matte.ts';
import {makeWeedPlant} from './weed-farm.ts';

// A whole plant pulled out of its bed: the ripe frosted plant (same model as in the bed,
// strain-tinted) plus the clump of soil and roots it came up with. Held in first person
// and laid in the crate one at a time. Origin = the base of the stem (top of the root
// ball); userData.grip marks where a hand holds the stem. `cured` dries it (paler,
// thinner) for the drying-rack loop.
const soilM=matte({color:0x3e2a1b});
const rootM=matte({color:0xcdb98f});
const soilGeo=new THREE.IcosahedronGeometry(.13,0);
const rootGeo=new THREE.CylinderGeometry(.008,.002,.16,4);

export function makeHarvestedPlant(leafColor: THREE.ColorRepresentation|null=null,cured=false): THREE.Group{
  const g=new THREE.Group();
  const plant=makeWeedPlant(1,true,cured?new THREE.Color(leafColor??0x4f9a3d).lerp(new THREE.Color(0xb8a060),.45):leafColor);
  if(cured)plant.scale.set(.85,.95,.85);
  g.add(plant);
  const ball=new THREE.Mesh(soilGeo,soilM);
  ball.scale.set(1,.7,1);ball.position.y=-.06;ball.castShadow=true;g.add(ball);
  for(let i=0;i<6;i++){
    const r=new THREE.Mesh(rootGeo,rootM);
    const a=i/6*Math.PI*2;
    r.position.set(Math.cos(a)*.07,-.16,Math.sin(a)*.07);
    r.rotation.set(Math.sin(a)*.5,0,Math.cos(a)*.5);
    g.add(r);
  }
  const grip=new THREE.Object3D();grip.position.y=.18;g.add(grip);
  g.userData.grip=grip;
  return g;
}

export default {category:'Rural',label:'Harvested weed plant',build:()=>makeHarvestedPlant(),zoom:1.1};

// A clod of soil flung up when a plant is pulled or seeds are patted in (particles).
const clodGeo=new THREE.IcosahedronGeometry(.03,0);
export function makeSoilClod(): THREE.Mesh{
  const m=new THREE.Mesh(clodGeo,soilM);
  m.castShadow=false;
  return m;
}
