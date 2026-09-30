import * as THREE from 'three';
import {matte} from '../matte.ts';
import {buildToonPlayer} from './pedestrian.ts';
import {bakeGeometry,bakedMat} from '../bake.ts';

// The village PRIEST of Pine Hollow (the story's third mission, js/story/priest.ts): the
// box doll in a black cassock (black shirt and trousers), a white clerical collar, a
// gold cross on the chest and grey hair. The extras are baked into one mesh on the
// spine/head bones.

const collarM=matte({color:0xf4f1e8});
const goldM=matte({color:0xd7af4f});
const greyM=matte({color:0x9a9a9a});

function build(): THREE.Group{
  const g=buildToonPlayer({color:0x17151c,pantsColor:0x17151c,skin:0xe0b48c});
  const l=g.userData.limbs;
  const spine=l.head.parent as THREE.Object3D;
  const bake=(bone: THREE.Object3D,parts: [THREE.Material,[number,number,number],[number,number,number]][])=>{
    const tmp=new THREE.Group();
    for(const[m,size,pos]of parts){const b=new THREE.Mesh(new THREE.BoxGeometry(...size),m);b.position.set(...pos);tmp.add(b);}
    const geo=bakeGeometry(tmp);if(geo)bone.add(new THREE.Mesh(geo,bakedMat));
  };
  // collar at the neck, the cross hanging on the chest
  bake(spine,[
    [collarM,[.14,.035,.12],[0,.27,.02]],
    [goldM,[.022,.1,.016],[0,.08,.118]],
    [goldM,[.07,.02,.016],[0,.1,.118]],
  ]);
  // grey hair over the doll's own (top + back)
  bake(l.head,[
    [greyM,[.29,.075,.29],[0,.305,-.005]],
    [greyM,[.29,.2,.06],[0,.19,-.125]],
  ]);
  return g;
}

export default {category:'Characters',label:'Priest',build};
