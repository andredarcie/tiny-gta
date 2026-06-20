import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,groundHeight} from '../../../js/constants.js';

// Two foliage tones so a stand of pines doesn't read as one flat green wall —
// build() picks one per tree. Only 2 leaf materials are shared across the whole
// forest, so the merge buckets (and draw-call count) stay small.
const pineLeafM=matte({color:0x2e7a44,roughness:1});
const pineLeafM2=matte({color:0x246638,roughness:1});
const pineTrunkM=matte({color:0x7a5a3e,roughness:1});

// build() puro: o pinheiro na origem. addPine posiciona e funde no mundo.
// Three stacked cone tiers (was two) give a fuller, more conifer-like silhouette
// without adding draw calls — geometry merges into the shared prop chunks.
function build(): THREE.Group{
  const g=new THREE.Group(),h=rand(2.4,4.4);
  const leafM=Math.random()<.5?pineLeafM:pineLeafM2;
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(.1,.18,h*.45,5),pineTrunkM);
  tr.position.y=h*.22;tr.castShadow=false;g.add(tr);
  const TIERS=3,r0=rand(.85,1.15);
  for(let k=0;k<TIERS;k++){
    const cone=new THREE.Mesh(new THREE.ConeGeometry(r0-k*r0*.27,h*.5,7),leafM);
    cone.position.y=h*.36+k*h*.26;cone.castShadow=false;g.add(cone);
  }
  return g;
}

export default {category:'Props',label:'Pine tree',build};

export function addPine(px: number,pz: number): THREE.Group{
  const g=build();
  g.position.set(px,groundHeight(px,pz)-.02,pz);bakeProp(g);
  return g;
}
