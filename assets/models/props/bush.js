import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,groundHeight} from '../../../js/constants.js';

// Low shrub / undergrowth clump: a couple of squashed low-poly leaf blobs that
// thicken the forest floor so the wood reads as dense thicket rather than bare
// trunks on grass. Two tones, flat-shaded, merged into the shared forest chunks.
const bushA=matte({color:0x437a32,roughness:1,flatShading:true});
const bushB=matte({color:0x356b2c,roughness:1,flatShading:true});

function build(){
  const g=new THREE.Group();
  const m=Math.random()<.5?bushA:bushB;
  const s=rand(.5,1.05),n=2+(Math.random()*3|0);
  for(let k=0;k<n;k++){
    const r=s*rand(.5,.9);
    const b=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),m);
    b.position.set(rand(-s,s),r*.72,rand(-s,s));
    b.scale.set(1,rand(.6,.85),1);b.castShadow=false;g.add(b);
  }
  return g;
}

export default {category:'Props',label:'Bush',build};

export function addBush(px,pz){
  const g=build();
  g.rotation.y=rand(0,Math.PI*2);
  g.position.set(px,groundHeight(px,pz)-.04,pz);bakeProp(g);
  return g;
}
