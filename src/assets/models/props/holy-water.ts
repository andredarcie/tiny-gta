import * as THREE from 'three';
import {matte} from '../matte.ts';

// A flask of HOLY WATER — given by the priest in the story (js/story/priest.ts) and
// sprinkled over the cursed bodies in first person (js/story/story-fp.ts). A small
// glass bottle with the water visible inside, a cork, and a little gold cross.
// Upright along local +Y, origin at the base.
//   userData.spout — the mouth of the neck (local), where the water comes out

const glassM=new THREE.MeshLambertMaterial({color:0xd8eef4,transparent:true,opacity:.35,depthWrite:false});
const waterM=new THREE.MeshLambertMaterial({color:0x7fc8e8,transparent:true,opacity:.8});
const corkM=matte({color:0x9a6a3c});
const goldM=matte({color:0xd7af4f});

function build(): THREE.Group{
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.034,.038,.1,12),glassM);body.position.y=.05;g.add(body);
  const water=new THREE.Mesh(new THREE.CylinderGeometry(.03,.034,.07,12),waterM);water.position.y=.037;g.add(water);
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.012,.02,.04,10),glassM);neck.position.y=.12;g.add(neck);
  const cork=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,.016,8),corkM);cork.position.y=.144;g.add(cork);
  // little cross on the front
  const v=new THREE.Mesh(new THREE.BoxGeometry(.008,.036,.004),goldM);v.position.set(0,.055,.037);g.add(v);
  const h=new THREE.Mesh(new THREE.BoxGeometry(.022,.008,.004),goldM);h.position.set(0,.062,.037);g.add(h);
  g.userData={spout:new THREE.Vector3(0,.15,0)};
  return g;
}

export default {category:'Props',label:'Holy water',build};
