import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';
import {rand,RURAL_GAP} from '@/core/constants.ts';

const hayM=matte({color:0xd9b25e,roughness:1});
const hayG=new THREE.CylinderGeometry(.55,.55,.9,9);

// build() puro: um fardo de feno na origem. addHayBales espalha varios no mundo.
function build(): THREE.Mesh {
  const hay=new THREE.Mesh(hayG,hayM);
  hay.rotation.z=Math.PI/2;hay.rotation.y=rand(0,3);
  hay.castShadow=false;
  return hay;
}

export default {category:'Rural',label:'Hay bale',build};

export function addHayBales(): void {
  const spots=[[214,30],[238,48],[228,-40],[212,-52],[278,52],[296,70],[272,-62],[288,-78]]
    .map(([x,z])=>[x+RURAL_GAP,z]);
  for(const[hx,hz]of spots){
    const hay=build();
    hay.position.set(hx,.55,hz);bakeProp(hay);
  }
}
