import * as THREE from 'three';
import {matte} from '../matte.ts';
import {buildToonPlayer} from './pedestrian.ts';
import {bakeGeometry,bakedMat} from '../bake.ts';

// A ZOMBIE — one of the buried rednecks, risen (the story's third mission,
// js/story/zombies.ts). The same box doll as everyone, with grey-green rotten skin,
// torn filthy flannel, blood soaked over the chest, the face and one forearm, and
// dead red eyes; the body is left a little crooked (one shoulder hanging, the head
// lolling) — the AI poses the outstretched arms every frame.
//
// Kept cheap: the doll is one skinned mesh, and the gore on each bone (head, chest,
// forearm) is baked into ONE small mesh per bone — 4 draw calls per zombie.

const flannel=[0x5a2a26,0x3a4632,0x4f4524,0x2e3a4c];
const denim=[0x2e3a4a,0x3a3f46,0x33302a];
const SKIN=0x7f9a6e;                                    // rotten grey-green
const bloodM=matte({color:0x6a0d0d});
const darkBloodM=matte({color:0x3d0707});
const eyeM=matte({color:0xd11f1f});
const boneM=matte({color:0xe8e3d2});

const pick=(a: number[])=>a[Math.floor(Math.random()*a.length)];

// Bake a few boxes (bone-local) into one vertex-coloured mesh and hang it on `bone`.
function gore(bone: THREE.Object3D,parts: [THREE.Material,[number,number,number],[number,number,number]][]): void{
  const tmp=new THREE.Group();
  for(const[m,size,pos]of parts){
    const b=new THREE.Mesh(new THREE.BoxGeometry(...size),m);b.position.set(...pos);tmp.add(b);
  }
  const geo=bakeGeometry(tmp);if(!geo)return;
  const mesh=new THREE.Mesh(geo,bakedMat);mesh.castShadow=false;
  bone.add(mesh);
}

function build(): THREE.Group{
  const g=buildToonPlayer({color:pick(flannel),pantsColor:pick(denim),skin:SKIN});
  const l=g.userData.limbs;
  const spine=l.head.parent as THREE.Object3D;
  // chest: a soaked patch, a torn hole with a rib showing, drips down the belly
  gore(spine,[
    [bloodM,[.24,.2,.02],[.03,.02,.112]],
    [darkBloodM,[.09,.09,.022],[-.07,.08,.114]],
    [boneM,[.08,.018,.024],[-.07,.09,.116]],
    [bloodM,[.05,.16,.02],[.08,-.12,.112]],
  ]);
  // head: red eyes, a bloody mouth, a gash on the scalp
  gore(l.head,[
    [eyeM,[.05,.05,.02],[-.06,.18,.138]],
    [eyeM,[.05,.05,.02],[.06,.18,.138]],
    [bloodM,[.12,.07,.02],[0,.07,.137]],
    [darkBloodM,[.12,.04,.2],[.04,.3,0]],
  ]);
  // one forearm chewed up
  gore(l.rightForearm,[
    [bloodM,[.1,.14,.1],[.03,-.1,0]],
    [boneM,[.03,.08,.03],[.03,-.2,.03]],
  ]);
  g.userData.zombie=true;
  return g;
}

export default {category:'Characters',label:'Zombie',build};
