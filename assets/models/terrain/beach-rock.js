import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';
import {rand} from '../../../js/constants.js';

const rockM=matte({color:0x8d8f99,roughness:.95});

// build() puro: a rocha na origem. addBeachRock posiciona e funde no mundo.
function build({scale=1.4}={}){
  const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(scale,0),rockM);
  rk.rotation.set(rand(0,3),rand(0,3),rand(0,3));
  rk.castShadow=false;
  return rk;
}

export default {category:'Terrain',label:'Beach rock',build};

export function addBeachRock(x,z,scale){
  const rk=build({scale});
  rk.position.set(x,-.12,z);bakeProp(rk);
  return rk;
}
