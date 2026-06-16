import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Farmers' market stall — a wooden counter under a striped canvas awning with a
// few produce crates, to give the village square some life. build() is pure
// (stall on the origin, opening toward +z); addMarketStall positions, bakes into
// the props and returns the collision AABB (the counter).
const woodM=matte({color:0x7a5638,roughness:.95});
const postM=matte({color:0x5e3c24,roughness:.9});
const crateM=matte({color:0x8a6238,roughness:.95});
const stripeA=matte({color:0xd9534f,roughness:.9});    // awning stripe A
const stripeB=matte({color:0xf2ead6,roughness:.9});    // awning stripe B
const appleM=matte({color:0xc5402f,roughness:.85});
const greenM=matte({color:0x5fa84e,roughness:.85});
const orangeM=matte({color:0xe0902f,roughness:.85});

function build(){
  const g=new THREE.Group();
  const W=2.8,D=1.2,CH=1.0;
  // counter top + skirt
  const top=new THREE.Mesh(new THREE.BoxGeometry(W,.12,D),woodM);
  top.position.y=CH;top.castShadow=true;top.receiveShadow=true;g.add(top);
  const skirt=new THREE.Mesh(new THREE.BoxGeometry(W,CH-.1,.1),woodM);
  skirt.position.set(0,(CH-.1)/2,D/2-.06);g.add(skirt);
  // four legs + back posts that rise to carry the awning
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,CH,.1),postM);
    leg.position.set(sx*(W/2-.12),CH/2,sz*(D/2-.1));g.add(leg);
  }
  for(const sx of[-1,1]){
    const back=new THREE.Mesh(new THREE.BoxGeometry(.1,2.1,.1),postM);
    back.position.set(sx*(W/2-.12),1.05,-(D/2-.1));back.castShadow=true;g.add(back);
  }
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(W,.08,.08),postM);
  ridge.position.set(0,2.1,-(D/2-.1));g.add(ridge);
  // striped awning slanting forward (toward +z), made of alternating slats
  const SLATS=7,slatW=W/SLATS;
  for(let i=0;i<SLATS;i++){
    const m=i%2?stripeA:stripeB;
    const slat=new THREE.Mesh(new THREE.BoxGeometry(slatW,.05,1.7),m);
    slat.position.set(-W/2+slatW*(i+.5),2.0,.25);slat.rotation.x=.34;slat.castShadow=true;g.add(slat);
  }
  // scalloped valance hanging off the awning front edge
  for(let i=0;i<SLATS;i++){
    const m=i%2?stripeA:stripeB;
    const v=new THREE.Mesh(new THREE.BoxGeometry(slatW,.22,.04),m);
    v.position.set(-W/2+slatW*(i+.5),1.78,.78);g.add(v);
  }
  // produce crates on the counter, each with a mound of fruit/veg
  const fruits=[appleM,greenM,orangeM];
  for(let c=0;c<3;c++){
    const cx=-W/2+.7+c*.7;
    const crate=new THREE.Mesh(new THREE.BoxGeometry(.5,.28,.5),crateM);
    crate.position.set(cx,CH+.2,.15);g.add(crate);
    const fm=fruits[c%3];
    for(let k=0;k<5;k++){
      const f=new THREE.Mesh(new THREE.SphereGeometry(.08,7,6),fm);
      f.position.set(cx-.16+(k%3)*.16,CH+.38,.0+Math.floor(k/3)*.18);g.add(f);
    }
  }
  g.userData.r=Math.max(W,D)/2+.2;g.userData.h=2.2;
  return g;
}

export default {category:'Rural',label:'Market stall',build};

export function addMarketStall(cx,cz,ry=0){
  const g=build();g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  return{x0:cx-1.5,x1:cx+1.5,z0:cz-.7,z1:cz+.7,h:g.userData.h};
}
