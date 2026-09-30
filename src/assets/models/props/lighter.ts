import * as THREE from 'three';
import {matte} from '../matte.ts';

// A cheap plastic LIGHTER (the story's summit scene). Upright along local +Y, with a
// small flame on top that the scene switches on/off.
//   userData.flame   — the flame mesh (hidden by default)
//   userData.nozzle  — the local point the flame comes out of

const bodyM=matte({color:0xc23b4e});
const capM=matte({color:0x9aa3ad});

function build(): THREE.Group{
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(.024,.05,.012),bodyM);body.position.y=.025;g.add(body);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(.024,.012,.013),capM);cap.position.y=.056;g.add(cap);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.007,.028,8),
    new THREE.MeshBasicMaterial({color:0xffb347,transparent:true,opacity:.9,depthWrite:false}));
  flame.position.y=.076;flame.visible=false;g.add(flame);
  g.userData={flame,nozzle:new THREE.Vector3(0,.064,0)};
  return g;
}

export default {category:'Props',label:'Lighter',build};
