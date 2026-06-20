import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from './prop-merge.ts';
import {rand,groundHeight} from '@/core/constants.ts';

// Low shrub / undergrowth clump: a couple of squashed low-poly leaf blobs that
// thicken the forest floor so the wood reads as dense thicket rather than bare
// trunks on grass. Two tones, flat-shaded, merged into the shared forest chunks.
const bushA=matte({color:0x437a32,roughness:1,flatShading:true});
const bushB=matte({color:0x356b2c,roughness:1,flatShading:true});

function build(): THREE.Group{
  const g=new THREE.Group();
  const m=Math.random()<.5?bushA:bushB;
  const s=rand(.55,1.1),n=3+(Math.random()*2|0);
  for(let k=0;k<n;k++){
    const r=s*rand(.6,.9);
    const b=new THREE.Mesh(new THREE.IcosahedronGeometry(r,0),m);
    // tight spread so the blobs overlap into one rounded mass, not loose dots
    b.position.set(rand(-s*.5,s*.5),r*.55,rand(-s*.5,s*.5));
    b.scale.set(1,rand(.6,.85),1);b.castShadow=false;g.add(b);
  }
  return g;
}

export default {category:'Props',label:'Bush',build};

export function addBush(px: number,pz: number): THREE.Group{
  const g=build();
  g.rotation.y=rand(0,Math.PI*2);
  g.position.set(px,groundHeight(px,pz)-.04,pz);bakeProp(g);
  return g;
}
