import * as THREE from 'three';
import {matte} from '../matte.ts';
import {buildToonPlayer} from './pedestrian.ts';
import {scene} from '@/core/engine.ts';

// Rural NPC ("redneck"): the same BOX doll as the player / street peds, only varying
// the clothes — flannel shirt + denim pants — topped with a box trucker cap or a box
// straw hat (or bareheaded). build() is pure (doll on the origin, facing +z);
// makeRedneck() adds one to the scene. Hats sit on the box head (centre 1.66, crown 1.80).
const flannelColors=[0x8a3030,0x3f5a3a,0x6b5526,0x394f6e,0x6a2f2f,0x55402a,0x7a4a24];
const denimColors=[0x39507a,0x2e3a4a,0x46566a,0x3a3f46,0x4a4a52];
const capColors=[0x6a2f2f,0x394f3a,0x2e3a4a,0x4a4636,0x5a5247,0x7a3320];
const strawM=matte({color:0xc8a85a,roughness:.95});
const hatBandM=matte({color:0x3a2a1a,roughness:.9});

const pick=(a: number[])=>a[Math.floor(Math.random()*a.length)];

// trucker/baseball cap: a box crown with a forward brim
function addCap(g: THREE.Group,color: number): void{
  const m=matte({color,roughness:.9});
  const crown=new THREE.Mesh(new THREE.BoxGeometry(.29,.09,.29),m);
  crown.position.set(0,1.83,0);crown.castShadow=true;g.add(crown);
  const brim=new THREE.Mesh(new THREE.BoxGeometry(.27,.03,.14),m);
  brim.position.set(0,1.8,.2);g.add(brim);
}

// wide-brim straw hat with a dark band, all boxes
function addStrawHat(g: THREE.Group): void{
  const brim=new THREE.Mesh(new THREE.BoxGeometry(.56,.035,.56),strawM);
  brim.position.set(0,1.81,0);brim.castShadow=true;g.add(brim);
  const crown=new THREE.Mesh(new THREE.BoxGeometry(.26,.16,.26),strawM);
  crown.position.set(0,1.9,0);crown.castShadow=true;g.add(crown);
  const band=new THREE.Mesh(new THREE.BoxGeometry(.27,.05,.27),hatBandM);
  band.position.set(0,1.84,0);g.add(band);
}

export function buildRedneck(opts: {color?: number; pants?: number}={}): THREE.Group{
  const color=opts.color??pick(flannelColors);
  const pants=opts.pants??pick(denimColors);
  const g=buildToonPlayer({color,pantsColor:pants});
  const r=Math.random();
  if(r<.5)addCap(g,pick(capColors));
  else if(r<.78)addStrawHat(g);
  // else: bareheaded (the doll already has hair)
  return g;
}

export default {category:'Characters',label:'Redneck',build:buildRedneck};

export function makeRedneck(opts?: {color?: number; pants?: number}): THREE.Group{
  const g=buildRedneck(opts);scene.add(g);return g;
}
