import * as THREE from 'three';
import {matte} from '../matte.ts';

// A GRAVE dug by hand (the burial job, js/story/burial.ts). One model that plays the
// whole job through two setters:
//   setDig(k)  0→1 : the pit opens in the grass and the spoil heap beside it grows;
//   setFill(k) 0→1 : the heap is shovelled back — the pit disappears under a mound;
//   setCross(on)   : a little wooden cross at the head of the finished grave.
// Local frame: origin on the ground at the pit centre, the pit's long axis along z,
// the spoil heap on +x. userData.pile is the heap's centre (local) for the dirt throws.

const pitM=matte({color:0x22160c});
const rimM=matte({color:0x6b4a2c});
const soilM=matte({color:0x5a3d24});
const woodM=matte({color:0x8a5e34});

export const GRAVE_W=.95, GRAVE_L=1.95;

function build(): THREE.Group{
  const g=new THREE.Group();
  // the open pit: a dark opening framed by a band of freshly turned soil
  const rim=new THREE.Mesh(new THREE.BoxGeometry(GRAVE_W+.3,.03,GRAVE_L+.3),rimM);
  rim.position.y=.015;g.add(rim);
  const pit=new THREE.Mesh(new THREE.BoxGeometry(GRAVE_W,.03,GRAVE_L),pitM);
  pit.position.y=.03;g.add(pit);
  // spoil heap on the +x side
  const pileAt=new THREE.Vector3(GRAVE_W/2+.75,0,0);
  const pile=new THREE.Mesh(new THREE.IcosahedronGeometry(.5,1),soilM);
  pile.position.copy(pileAt);pile.castShadow=true;g.add(pile);
  // the mound over a filled grave
  const mound=new THREE.Mesh(new THREE.IcosahedronGeometry(.5,1),soilM);
  mound.castShadow=true;g.add(mound);
  // cross at the head (-z end)
  const cross=new THREE.Group();
  const post=new THREE.Mesh(new THREE.BoxGeometry(.06,.62,.05),woodM);post.position.y=.31;
  const arm=new THREE.Mesh(new THREE.BoxGeometry(.34,.06,.05),woodM);arm.position.y=.44;
  post.castShadow=arm.castShadow=true;
  cross.add(post,arm);cross.position.set(0,0,-GRAVE_L/2-.2);cross.visible=false;g.add(cross);

  const setDig=(k: number)=>{
    const s=Math.max(.02,k);
    pit.scale.set(s,1,s);rim.scale.set(Math.max(.02,Math.min(1,k*1.4)),1,Math.max(.02,Math.min(1,k*1.4)));
    pit.visible=rim.visible=k>0;
    pile.visible=k>0;pile.scale.set(1.2*s,.5*s,1.5*s);
  };
  const setFill=(k: number)=>{
    pit.visible=k<.98;
    const p=1-k*.85;
    pile.scale.set(1.2*p,.5*p,1.5*p);
    mound.visible=k>0;
    const m=Math.max(.02,k);
    mound.scale.set(GRAVE_W*1.05,.34*m,GRAVE_L*1.02);mound.position.y=-.05+.05*m;
  };
  const setCross=(on: boolean)=>{cross.visible=on;};
  mound.visible=false;
  setDig(0);
  g.userData={setDig,setFill,setCross,pile:pileAt};
  return g;
}

// Model viewer: show a finished grave (pit filled, mound and cross).
function buildPreview(opts: {stage?: string}={}): THREE.Group{
  const g=build();
  if(opts.stage==='open'){g.userData.setDig(1);}
  else{g.userData.setDig(1);g.userData.setFill(1);g.userData.setCross(true);}
  return g;
}

export {build as buildGrave};
export default {category:'Missions',label:'Grave',build:buildPreview,
  variants:[{label:'Finished',opts:{}},{label:'Open pit',opts:{stage:'open'}}]};
