import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,groundHeight} from '../../../js/constants.js';

// A little cluster of toadstools (red dome cap on a pale stem) tucked among the
// tree roots — small splashes of colour that make the forest floor feel alive.
const capM=matte({color:0xb43a2c,roughness:1});
const stemM=matte({color:0xe9e1cf,roughness:1});

function build(): THREE.Group{
  const g=new THREE.Group();
  const n=2+(Math.random()*3|0);
  for(let k=0;k<n;k++){
    const s=rand(.12,.28),ox=rand(-.28,.28),oz=rand(-.28,.28);
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(s*.18,s*.24,s,5),stemM);
    stem.position.set(ox,s*.5,oz);stem.castShadow=false;g.add(stem);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(s*.55,7,4,0,Math.PI*2,0,Math.PI*.55),capM);
    cap.position.set(ox,s,oz);cap.castShadow=false;g.add(cap);
  }
  return g;
}

export default {category:'Props',label:'Mushrooms',build};

export function addMushroom(px: number,pz: number): THREE.Group{
  const g=build();
  g.rotation.y=rand(0,Math.PI*2);
  g.position.set(px,groundHeight(px,pz),pz);bakeProp(g);
  return g;
}
