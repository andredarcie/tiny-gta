import * as THREE from 'three';
import {matte} from '../matte.ts';
import {placeNature} from '../nature/batch.ts';
import {rand} from '@/core/constants.ts';
import type {ModelDescriptor} from '@/core/types.ts';

const palmLeafMat=matte({color:0x3aa856,roughness:1});
const palmTrunkMat=matte({color:0x96704e,roughness:1});

// build() puro: a palmeira na origem. addPalm posiciona e funde no mundo.
function build(): THREE.Group {
  const g=new THREE.Group(),h=rand(4,6);
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(.16,.26,h,5),palmTrunkMat);
  tr.position.y=h/2;tr.castShadow=false;g.add(tr);
  for(let k=0;k<6;k++){
    const leaf=new THREE.Mesh(new THREE.BoxGeometry(2.4,.08,.55),palmLeafMat);
    leaf.position.y=h;leaf.rotation.y=k*Math.PI/3;leaf.rotation.z=-.42;
    leaf.geometry.translate?.(0,0,0);leaf.translateX(1.0);leaf.castShadow=false;g.add(leaf);
  }
  return g;
}

const model: ModelDescriptor = {category:'Props',label:'Palm tree',build};
export default model;

// The MegaKit (free tier) has no palm, so beach/park "palms" become tall leafy
// CommonTrees from the kit — a lush coastal tree line. Baked at beach level (y=0).
export function addPalm(x: number, z: number): void {
  placeNature('tree',x,0,z,rand(5,7.2));
}
