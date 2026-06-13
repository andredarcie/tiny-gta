import * as THREE from 'three';
import {scene} from '../../../js/engine.js';

// build() puro: mastro + bandeira num grupo na origem. addSummitFlag posiciona.
function build(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.06,.09,4.6,6),
    new THREE.MeshStandardMaterial({color:0xd8dde6,roughness:.5}));
  pole.position.y=2.3;pole.castShadow=true;g.add(pole);
  const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1),
    new THREE.MeshBasicMaterial({color:0xff2e88,side:THREE.DoubleSide}));
  flag.position.set(.9,1.8,0);g.add(flag);
  return g;
}

export default {category:'Rural',label:'Summit flag',build};

export function addSummitFlag(x,y,z){
  const g=build();g.position.set(x,y,z);scene.add(g);
  return{pole:g.children[0],flag:g.children[1]};
}
