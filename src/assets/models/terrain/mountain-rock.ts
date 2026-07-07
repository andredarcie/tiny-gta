import * as THREE from 'three';
import {matte} from '../matte.ts';
import {placeNature} from '../nature/batch.ts';
import {rand,groundHeight} from '@/core/constants.ts';

const rockM=matte({color:0x84868f,roughness:.95});

// build() puro: a rocha na origem. addMountainRock posiciona e funde no mundo.
function build({scale=1.4}={}): THREE.Mesh{
  const rk=new THREE.Mesh(new THREE.DodecahedronGeometry(scale,0),rockM);
  rk.rotation.set(rand(0,3),rand(0,3),rand(0,3));
  rk.castShadow=false;
  return rk;
}

export default {category:'Terrain',label:'Mountain rock',build};

// Mountain rock → a random MegaKit Rock_Medium boulder, sized from the old scale.
export function addMountainRock(x: number,z: number,scale: number): void{
  placeNature('rock',x,groundHeight(x,z)-.1,z,scale*rand(1.3,1.8));
}
