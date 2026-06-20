import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,groundHeight} from '../../../js/constants.js';

// A fallen, mossy log lying on the forest floor: dark bark cylinder, pale cut
// rings at the ends, and a few moss blobs along the top. Decay/age detail that
// makes the wood feel old and lived-in. Merged into the shared forest chunks.
const barkM=matte({color:0x553722,roughness:1});
const mossM=matte({color:0x4a6b32,roughness:1,flatShading:true});
const ringM=matte({color:0xb9966a,roughness:1});

function build(): THREE.Group{
  const g=new THREE.Group();
  const len=rand(2.2,4.2),r=rand(.22,.34);
  const log=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,8),barkM);
  log.rotation.z=Math.PI/2;log.position.y=r;log.castShadow=false;g.add(log);
  for(let k=0;k<3;k++){
    const mb=new THREE.Mesh(new THREE.IcosahedronGeometry(r*rand(.4,.7),0),mossM);
    // nestle on the UPPER surface (log spans y 0..2r) so moss reads on top
    mb.position.set(rand(-len*.42,len*.42),r*rand(1.7,1.95),rand(-r*.35,r*.35));
    mb.scale.y=.7;mb.castShadow=false;g.add(mb);
  }
  for(const s of[-1,1]){
    const end=new THREE.Mesh(new THREE.CircleGeometry(r,10),ringM);
    end.position.set(s*len/2,r,0);end.rotation.y=s*Math.PI/2;g.add(end);
  }
  return g;
}

export default {category:'Props',label:'Fallen log',build};

export function addFallenLog(px: number,pz: number): THREE.Group{
  const g=build();
  g.rotation.y=rand(0,Math.PI*2);
  g.position.set(px,groundHeight(px,pz),pz);bakeProp(g);
  return g;
}
