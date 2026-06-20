import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from './prop-merge.ts';
import {rand,groundHeight} from '@/core/constants.ts';

// Ground fern: a rosette of arching fronds (thin tapered blades leaning outward
// from a centre). One shared double-sided material keeps the merge bucket tiny.
// Scattered across the shaded floor it sells "living forest" at ankle height.
const fernM=matte({color:0x4f8a36,roughness:1,side:THREE.DoubleSide,flatShading:true});

function build(): THREE.Group{
  const g=new THREE.Group();
  const blades=6+(Math.random()*4|0),len=rand(.5,.95);
  for(let k=0;k<blades;k++){
    const pivot=new THREE.Group();
    pivot.rotation.order='YXZ';
    const blade=new THREE.Mesh(new THREE.ConeGeometry(.14,len,3),fernM);
    blade.position.y=len/2;        // base at the pivot, tip up
    blade.scale.z=.16;             // flatten into a broad flat frond
    blade.castShadow=false;pivot.add(blade);
    pivot.rotation.y=k/blades*Math.PI*2+rand(-.25,.25);
    pivot.rotation.x=rand(.78,1.12); // lean the frond outward
    g.add(pivot);
  }
  return g;
}

export default {category:'Props',label:'Fern',build};

export function addFern(px: number,pz: number): THREE.Group{
  const g=build();
  g.position.set(px,groundHeight(px,pz),pz);bakeProp(g);
  return g;
}
