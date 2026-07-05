import * as THREE from 'three';
import {matte} from '../matte.ts';
import {scene} from '@/core/engine.ts';

// build() puro: mastro + bandeira num grupo na origem. addSummitFlag posiciona.
function build(): THREE.Group {
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,4.6,6),
    matte({color:0xd8dde6,roughness:.5}));
  pole.position.y=2.3;pole.castShadow=false;g.add(pole);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1),
    new THREE.MeshBasicMaterial({color:0xff2e88,side:THREE.DoubleSide}));
  flag.position.set(.9,1.8,0);g.add(flag);
  return g;
}

export default {category:'Rural',label:'Summit flag',build};

export function addSummitFlag(x: number,y: number,z: number): {pole: THREE.Object3D; flag: THREE.Object3D} {
  const g=build();g.position.set(x,y,z);scene.add(g);
  return{pole:g.children[0],flag:g.children[1]};
}
