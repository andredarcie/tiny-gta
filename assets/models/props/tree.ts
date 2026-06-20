import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from './prop-merge.ts';
import {rand,groundHeight} from '@/core/constants.ts';

// Broadleaf tree: a rounded, leafy crown to break up the conifer pines and give
// the rural wood some variety. Like the pine it is a tiny merged prop (trunk +
// a few low-poly canopy blobs), so mixing these in costs almost nothing — it
// just folds more geometry into the shared forest chunks. Two canopy tones so a
// stand never reads as one flat green; flat shading keeps the leaves faceted.
const leafA=matte({color:0x4f9a3e,roughness:1,flatShading:true});
const leafB=matte({color:0x3c7d36,roughness:1,flatShading:true});
const trunkM=matte({color:0x6b4a32,roughness:1});

function build(): THREE.Group{
  const g=new THREE.Group(),h=rand(3.4,5.4);
  const leafM=Math.random()<.5?leafA:leafB;
  const trunkH=h*.6;
  const tr=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,trunkH,6),trunkM);
  tr.position.y=trunkH/2;tr.castShadow=false;g.add(tr);
  // rounded crown sitting ON TOP of the trunk; blob size scales with height so
  // the canopy never swallows the trunk on a short tree.
  const cr=h*.28,cy=trunkH+cr*.5,blobs=4+(Math.random()<.5?1:0);
  for(let k=0;k<blobs;k++){
    const r=cr*rand(.72,1.05);
    const b=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),leafM);
    const a=Math.random()*Math.PI*2,d=k?rand(.35,.95)*cr:0;
    b.position.set(Math.cos(a)*d,cy+rand(0,cr*.8),Math.sin(a)*d);
    b.scale.y=rand(.85,1.05);b.castShadow=false;g.add(b);
  }
  return g;
}

export default {category:'Props',label:'Broadleaf tree',build};

export function addTree(px: number,pz: number): THREE.Group{
  const g=build();
  g.rotation.y=rand(0,Math.PI*2);
  g.position.set(px,groundHeight(px,pz)-.02,pz);bakeProp(g);
  return g;
}
