import * as THREE from 'three';
import {matte} from '../matte.ts';
import {buildToonPlayer} from './pedestrian.ts';

// Rick, the forest hippie hermit (secret mission — see js/story/rick.ts). The same box
// doll as everyone (userData.limbs + userData.mouth, so the cut-scene animates his arms
// and mouth) with a shaggy hippie look glued on: long box mane, box beard and a red
// headband, in greens to match a life in nature.

const SHIRT=0x3f7d3a, PANTS=0x33502a;   // forest green (shirt + pants)
const HAIR=0x4a2f1a;                     // brown
const BAND=0xc2402e;                     // red headband (hippie touch)

// Boxes around the doll's box head (centre y1.66, crown 1.80, face at z .13).
function addManeAndBeard(g: THREE.Group): void{
  const hairM=matte({color:HAIR,roughness:1});
  const mane=new THREE.Group();
  const bx=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=hairM)=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);mane.add(b);
  };
  bx(.3,.08,.3, 0,1.82,0);                 // shaggy top
  bx(.3,.5,.1, 0,1.46,-.15);               // long mane down the back
  for(const sx of[-1,1])bx(.06,.4,.14, sx*.16,1.5,0); // side locks
  bx(.22,.22,.08, 0,1.5,.14);              // beard
  bx(.14,.16,.07, 0,1.34,.14);             // beard tip
  bx(.14,.03,.03, 0,1.6,.145);             // moustache
  bx(.29,.04,.29, 0,1.74,0, matte({color:BAND})); // headband
  mane.traverse(o=>{if((o as THREE.Mesh).isMesh)o.castShadow=true;});
  g.add(mane);
}

export function buildRick(): THREE.Group{
  const g=buildToonPlayer({color:SHIRT,pantsColor:PANTS});
  addManeAndBeard(g);
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Characters',label:'Rick (hippie)',build:buildRick};
