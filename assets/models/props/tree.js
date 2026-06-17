import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,groundHeight} from '../../../js/constants.js';

// Broadleaf tree: a rounded, leafy crown to break up the conifer pines and give
// the rural wood some variety. Like the pine it is a tiny merged prop (trunk +
// a few low-poly canopy blobs), so mixing these in costs almost nothing — it
// just folds more geometry into the shared forest chunks. Two canopy tones so a
// stand never reads as one flat green; flat shading keeps the leaves faceted.
const leafA=matte({color:0x4f9a3e,roughness:1,flatShading:true});
const leafB=matte({color:0x3c7d36,roughness:1,flatShading:true});
const trunkM=matte({color:0x6b4a32,roughness:1});

function build(){
  const g=new THREE.Group(),h=rand(3.2,5.4);
  const leafM=Math.random()<.5?leafA:leafB;
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(.13,.24,h*.62,6),trunkM);
  tr.position.y=h*.3;tr.castShadow=false;g.add(tr);
  // rounded crown: a clump of overlapping low-poly blobs around the trunk top
  const cy=h*.66,cr=rand(1.3,2.0),blobs=3+(Math.random()<.6?1:0);
  for(let k=0;k<blobs;k++){
    const r=cr*rand(.6,1);
    const b=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),leafM);
    const a=Math.random()*Math.PI*2,d=k?rand(.25,.9)*cr:0;
    b.position.set(Math.cos(a)*d,cy+rand(-.2,.7),Math.sin(a)*d);
    b.scale.y=rand(.85,1.1);b.castShadow=false;g.add(b);
  }
  return g;
}

export default {category:'Props',label:'Broadleaf tree',build};

export function addTree(px,pz){
  const g=build();
  g.rotation.y=rand(0,Math.PI*2);
  g.position.set(px,groundHeight(px,pz)-.02,pz);bakeProp(g);
  return g;
}
