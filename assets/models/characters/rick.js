import * as THREE from 'three';
import {matte} from '../matte.js';
import {buildToonPlayer} from './pedestrian.js';

// Rick, the forest hippie hermit (secret mission — see js/rick.js). Reuses the
// rigged skinned doll (buildToonPlayer: has userData.limbs and userData.mouth, so
// the cut-scene camera animates his arms/mouth like other story NPCs) and glues a
// shaggy hippie look on top: long mane, big beard and a headband, all in greens to
// match a life in nature.

const SHIRT=0x3f7d3a, PANTS=0x33502a;   // forest green (shirt + pants)
const HAIR=0x4a2f1a;                     // brown
const BAND=0xc2402e;                     // red headband (hippie touch)

// Hair/beard pinned at the doll's head height (center ~y1.66, crown ~1.80). The
// head bone doesn't rotate while walking, so fixed hair tracks it fine; built once
// per session. Sizes/offsets are fitted to the small egg head of buildToonPlayer.
function addManeAndBeard(g){
  const hairM=matte({color:HAIR,roughness:1});
  const mane=new THREE.Group();
  // skull cap over the crown
  const top=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),hairM);
  top.scale.set(1.06,.95,1.14);top.position.set(0,1.74,-.01);mane.add(top);
  // long mane falling down the back to the shoulders
  const back=new THREE.Mesh(new THREE.BoxGeometry(.28,.5,.12),hairM);
  back.position.set(0,1.42,-.13);back.rotation.x=.14;mane.add(back);
  // side locks
  for(const sx of[-1,1]){
    const lock=new THREE.Mesh(new THREE.BoxGeometry(.08,.4,.12),hairM);
    lock.position.set(sx*.14,1.45,.01);lock.rotation.z=sx*.06;mane.add(lock);
  }
  // full beard from the chin to the chest
  const beard=new THREE.Mesh(new THREE.SphereGeometry(.12,9,7),hairM);
  beard.scale.set(1.02,1.35,.78);beard.position.set(0,1.46,.08);mane.add(beard);
  const beardTip=new THREE.Mesh(new THREE.BoxGeometry(.13,.2,.08),hairM);
  beardTip.position.set(0,1.3,.11);mane.add(beardTip);
  // moustache
  const stache=new THREE.Mesh(new THREE.BoxGeometry(.12,.04,.05),hairM);
  stache.position.set(0,1.61,.12);mane.add(stache);
  // headband around the forehead
  const band=new THREE.Mesh(new THREE.TorusGeometry(.15,.03,8,18),matte({color:BAND}));
  band.rotation.x=Math.PI/2;band.position.set(0,1.71,0);mane.add(band);
  mane.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  g.add(mane);
}

export function buildRick(){
  const g=buildToonPlayer({color:SHIRT,pantsColor:PANTS});
  addManeAndBeard(g);
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Characters',label:'Rick (hippie)',build:buildRick};
