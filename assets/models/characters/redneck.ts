import * as THREE from 'three';
import {matte} from '../matte.js';
import {buildToonPlayer} from './pedestrian.js';
import {scene} from '@/core/engine.js';

// Rural NPC ("redneck"): the SAME smooth skinned doll as the player / street peds
// (buildToonPlayer — the current visual standard), only varying the clothes —
// flannel shirt + denim pants — and topped with a trucker cap or a straw hat (or
// left bareheaded). build() is pure (doll on the origin, facing +z); makeRedneck()
// adds one to the scene. The hat is a few extra meshes parented to the doll group;
// it's fitted to buildToonPlayer's small egg head (center ~1.66, crown ~1.80).
const flannelColors=[0x8a3030,0x3f5a3a,0x6b5526,0x394f6e,0x6a2f2f,0x55402a,0x7a4a24];
const denimColors=[0x39507a,0x2e3a4a,0x46566a,0x3a3f46,0x4a4a52];
const capColors=[0x6a2f2f,0x394f3a,0x2e3a4a,0x4a4636,0x5a5247,0x7a3320];
const strawM=matte({color:0xc8a85a,roughness:.95});
const hatBandM=matte({color:0x3a2a1a,roughness:.9});

const pick=(a: number[])=>a[Math.floor(Math.random()*a.length)];

// trucker/baseball cap: a small domed crown over the skull with a forward brim
function addCap(g: THREE.Group,color: number): void{
  const m=matte({color,roughness:.9});
  const crown=new THREE.Mesh(new THREE.SphereGeometry(.15,12,8,0,Math.PI*2,0,Math.PI/2),m);
  crown.position.set(0,1.69,-.01);crown.scale.set(1.05,.92,1.1);crown.castShadow=true;g.add(crown);
  const brim=new THREE.Mesh(new THREE.BoxGeometry(.28,.035,.18),m);
  brim.position.set(0,1.70,.165);brim.rotation.x=.12;g.add(brim);
}

// wide-brim straw hat with a dark band
function addStrawHat(g: THREE.Group): void{
  const brim=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.04,16),strawM);
  brim.position.set(0,1.71,0);brim.castShadow=true;g.add(brim);
  const crown=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,.22,14),strawM);
  crown.position.set(0,1.83,0);crown.castShadow=true;g.add(crown);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.165,.165,.07,14),hatBandM);
  band.position.set(0,1.75,0);g.add(band);
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

export function makeRedneck(opts?: {color?: number; pants?: number}): THREE.Group{const g=buildRedneck(opts);scene.add(g);return g;}
