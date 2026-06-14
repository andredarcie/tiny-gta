import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,groundHeight} from '../../../js/constants.js';

const pineLeafM=matte({color:0x2e7a44,roughness:1});
const pineTrunkM=matte({color:0x7a5a3e,roughness:1});

// build() puro: o pinheiro na origem. addPine posiciona e funde no mundo.
function build(){
  const g=new THREE.Group(),h=rand(2.2,3.6);
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,h*.5,5),pineTrunkM);
  tr.position.y=h*.25;tr.castShadow=false;g.add(tr);
  for(let k=0;k<2;k++){
    const cone=new THREE.Mesh(new THREE.ConeGeometry(.9-k*.3,h*.6,7),pineLeafM);
    cone.position.y=h*.45+k*h*.32;cone.castShadow=false;g.add(cone);
  }
  return g;
}

export default {category:'Props',label:'Pine tree',build};

export function addPine(px,pz){
  const g=build();
  g.position.set(px,groundHeight(px,pz)-.02,pz);bakeProp(g);
  return g;
}
