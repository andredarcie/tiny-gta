import * as THREE from 'three';
import {matte} from '../matte.ts';

// A CIGARETTE (the story's summit scene, js/story/summit.ts). Along local +Y: the
// orange filter at the origin (the end that goes in the mouth), the white paper up to
// the TIP, where an ember glows once it is lit.
//   userData.tip       — the burning end (local point), where the smoke rises from
//   userData.setLit(k) — 0 = unlit; >0 = ember showing, brighter as k grows (a drag)

const paperM=matte({color:0xf2efe6});
const filterM=matte({color:0xd98a3a});
export const CIG_LEN=.085;

function build(): THREE.Group{
  const g=new THREE.Group();
  const filter=new THREE.Mesh(new THREE.CylinderGeometry(.0065,.0065,.024,8),filterM);
  filter.position.y=.012;g.add(filter);
  const paper=new THREE.Mesh(new THREE.CylinderGeometry(.0062,.0062,CIG_LEN-.024,8),paperM);
  paper.position.y=.024+(CIG_LEN-.024)/2;g.add(paper);
  const emberMat=new THREE.MeshBasicMaterial({color:0x3a3a3a});
  const ember=new THREE.Mesh(new THREE.CylinderGeometry(.0064,.0064,.006,8),emberMat);
  ember.position.y=CIG_LEN;g.add(ember);
  const glowMat=new THREE.MeshBasicMaterial({color:0xff5a1e,transparent:true,opacity:0,depthWrite:false});
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.012,8,6),glowMat);
  glow.position.y=CIG_LEN+.002;g.add(glow);
  const setLit=(k: number)=>{
    if(k<=0){emberMat.color.set(0x3a3a3a);glowMat.opacity=0;return;}
    emberMat.color.setRGB(1,.25+.35*Math.min(1,k),.05);
    glowMat.opacity=.25+.55*Math.min(1,k);
  };
  g.userData={tip:new THREE.Vector3(0,CIG_LEN+.004,0),setLit};
  return g;
}

export default {category:'Props',label:'Cigarette',build};
