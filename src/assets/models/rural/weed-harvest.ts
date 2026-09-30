import * as THREE from 'three';
import {matte} from '../matte.ts';
import {makeWeedPlant} from './weed-farm.ts';

// A whole plant pulled out of its bed: the ripe frosted plant (same model as in the bed,
// strain-tinted) plus the clump of soil and roots it came up with. Held in first person
// dried on the rack and trimmed at the table (fans + buds exposed for the trim). Origin = the base of the stem (top of the root
// ball); userData.grip marks where a hand holds the stem. `cured` dries it (paler,
// thinner) for the drying-rack loop.
const soilM=matte({color:0x3e2a1b});
const rootM=matte({color:0xcdb98f});
const soilGeo=new THREE.IcosahedronGeometry(.13,0);
const rootGeo=new THREE.CylinderGeometry(.008,.002,.16,4);

export function makeHarvestedPlant(leafColor: THREE.ColorRepresentation|null=null,cured=false): THREE.Group{
  const g=new THREE.Group();
  // dried: the green turns a dusty golden-brown so a dry plant is obvious at a glance
  const plant=makeWeedPlant(1,true,cured?new THREE.Color(leafColor??0x4f9a3d).lerp(new THREE.Color(0x9c7a3c),.68):leafColor);
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
  // Trimming handles (js/activities/weed-farm-fp.ts fpSnip): the six fan-leaf groups to cut
  // off, and the buds along the stem (three side buds + the top cola) to snip into the tray.
  g.userData.fans=plant.children.filter((c)=>(c as THREE.Group).isGroup);
  const buds: THREE.Object3D[]=[];
  for(const [y,a] of [[.3,0],[.55,2.1],[.78,4.2]] as [number,number][]){
    const b=makeFlowerBud(cured);
    b.position.set(Math.cos(a)*.06,y,Math.sin(a)*.06);
    b.rotation.set(a,a*1.3,0);
    plant.add(b);buds.push(b);
  }
  const cola=plant.children[plant.children.length-4] as THREE.Object3D; // makeWeedPlant adds the cola last (before our buds)
  buds.push(cola);
  g.userData.buds=buds;
  return g;
}

// A single flower bud (a snipped nugget): frosty green fresh, golden-brown dried.
const budGeo=new THREE.IcosahedronGeometry(.07,0);
const budFreshM=matte({color:0x9fd36a});
const budDryM=matte({color:0xb99a52});
export function makeFlowerBud(dried=true): THREE.Mesh{
  const m=new THREE.Mesh(budGeo,dried?budDryM:budFreshM);
  m.scale.set(1,1.25,1);m.castShadow=true;
  return m;
}

export default {category:'Rural',label:'Harvested weed plant',build:()=>makeHarvestedPlant(),zoom:1.1};

// A clod of soil flung up when a plant is pulled or seeds are patted in (particles).
const clodGeo=new THREE.IcosahedronGeometry(.03,0);
export function makeSoilClod(): THREE.Mesh{
  const m=new THREE.Mesh(clodGeo,soilM);
  m.castShadow=false;
  return m;
}
