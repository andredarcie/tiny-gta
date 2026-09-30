import * as THREE from 'three';
import {matte} from '../matte.ts';

// Digging SHOVEL (the burial job in js/story/burial.ts). Box-built like everything else:
// a wooden shaft along local +Y with a D-grip on top and a steel blade at the bottom,
// slightly dished and tilted forward (+z) the way a real spade's blade is set.
//
// Local frame: origin at the BLADE TIP. userData gives the points the hands/code use:
//   gripTop — the D-grip (right hand), gripMid — halfway down the shaft (left hand),
//   scoop   — the middle of the blade face (where a clump of dirt sits),
//   dirt    — the clump of soil riding on the blade (hidden until a scoop).

const woodM=matte({color:0x9a6a3c});
const steelM=matte({color:0x7d848e});
const gripM=matte({color:0x2b2f38});
const soilM=matte({color:0x5a3d24});

export const SHOVEL_LEN=1.3;

function build(): THREE.Group{
  const g=new THREE.Group();
  const add=(geo: THREE.BufferGeometry,m: THREE.Material,x: number,y: number,z: number,rx=0)=>{
    const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.rotation.x=rx;o.castShadow=true;g.add(o);return o;
  };
  // blade: a wide plate plus two raised side lips (the dish), leaning 0.18 rad forward
  add(new THREE.BoxGeometry(.24,.3,.018),steelM,0,.15,0,.18);
  for(const sx of[-1,1])add(new THREE.BoxGeometry(.02,.28,.05),steelM,sx*.115,.16,.012,.18);
  add(new THREE.BoxGeometry(.07,.08,.06),steelM,0,.33,-.02);             // socket
  // shaft
  add(new THREE.BoxGeometry(.04,SHOVEL_LEN-.42,.04),woodM,0,.36+(SHOVEL_LEN-.42)/2,-.02);
  // D-grip
  const top=SHOVEL_LEN-.04;
  add(new THREE.BoxGeometry(.16,.035,.04),gripM,0,top,-.02);
  for(const sx of[-1,1])add(new THREE.BoxGeometry(.03,.12,.04),gripM,sx*.065,top-.06,-.02);
  // clump of soil carried on the blade (toggled by the dig/fill clips)
  const dirt=new THREE.Mesh(new THREE.IcosahedronGeometry(.1,0),soilM);
  dirt.scale.set(1.2,.6,1);dirt.position.set(0,.17,.06);dirt.visible=false;g.add(dirt);
  g.userData={
    gripTop:new THREE.Vector3(0,top-.02,-.02),
    gripMid:new THREE.Vector3(0,SHOVEL_LEN*.55,-.02),
    scoop:new THREE.Vector3(0,.16,.05),
    dirt,
  };
  return g;
}

export default {category:'Props',label:'Shovel',build};
