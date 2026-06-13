import * as THREE from 'three';
import {bakeProp} from '../props/prop-merge.js';
import {rand,groundHeight} from '../../../js/constants.js';

const rockM=new THREE.MeshStandardMaterial({color:0x84868f,roughness:.95});

// build() puro: a rocha na origem. addMountainRock posiciona e funde no mundo.
function build({scale=1.4}={}){
  const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(scale,0),rockM);
  rk.rotation.set(rand(0,3),rand(0,3),rand(0,3));
  rk.castShadow=true;
  return rk;
}

export default {category:'Terrain',label:'Mountain rock',build};

export function addMountainRock(x,z,scale){
  const rk=build({scale});
  rk.position.set(x,groundHeight(x,z)+.1,z);bakeProp(rk);
  return rk;
}
