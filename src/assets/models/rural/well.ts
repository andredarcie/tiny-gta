import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';

// Stone well — a small landmark for the village square: round stone curb, two
// posts holding a little gabled shingle roof, a winding crank and a bucket on a
// rope. build() is pure (well on the origin); addWell positions, bakes into the
// props and returns the collision AABB (the stone curb).
const stoneM=matte({color:0x9a948c,roughness:1});
const darkM=matte({color:0x2b2620,roughness:1});       // water / shadowed shaft
const woodM=matte({color:0x6e4a32,roughness:.9});
const roofM=matte({color:0x6e4632,roughness:.9});
const metalM=matte({color:0x8a8f96,roughness:.5,metalness:.5});
const ropeM=matte({color:0xcdb98c,roughness:1});

function build(): THREE.Group {
  const g=new THREE.Group();
  const R=.95,CURB=.7;
  // stone curb (ring approximated by a short fat cylinder + a darker inner shaft)
  const curb=new THREE.Mesh(new THREE.CylinderGeometry(R,R+.08,CURB,14),stoneM);
  curb.position.y=CURB/2;curb.castShadow=true;curb.receiveShadow=true;g.add(curb);
  const cap=new THREE.Mesh(new THREE.TorusGeometry(R-.06,.1,8,16),stoneM);
  cap.rotation.x=Math.PI/2;cap.position.y=CURB;g.add(cap);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(R-.16,R-.16,.1,14),darkM);
  shaft.position.y=CURB-.04;g.add(shaft);
  // two posts + cross-beam carrying the roof
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.07,.08,2,8),woodM);
    post.position.set(sx*(R-.05),CURB+1,0);post.castShadow=true;g.add(post);
  }
  const beam=new THREE.Mesh(new THREE.BoxGeometry(2*R+.2,.12,.12),woodM);
  beam.position.y=CURB+1.95;g.add(beam);
  // little gabled shingle roof
  const RW=2*R+.5,RISE=.5,half=RW/2,slope=Math.hypot(half,RISE),ang=Math.atan2(RISE,half);
  for(const s of[-1,1]){
    const pane=new THREE.Mesh(new THREE.BoxGeometry(slope,.1,1.4),roofM);
    pane.position.set(s*half/2,CURB+2.2+RISE/2,0);pane.rotation.z=-s*ang;pane.castShadow=true;g.add(pane);
  }
  // winding crank: a horizontal drum on the beam, a handle, rope and bucket
  const drum=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1.4,8),woodM);
  drum.rotation.z=Math.PI/2;drum.position.set(0,CURB+1.7,0);g.add(drum);
  const handle=new THREE.Mesh(new THREE.BoxGeometry(.05,.3,.05),metalM);
  handle.position.set(R-.05,CURB+1.55,0);g.add(handle);
  const rope=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,1.0,5),ropeM);
  rope.position.set(.25,CURB+1.2,0);g.add(rope);
  const bucket=new THREE.Mesh(new THREE.CylinderGeometry(.16,.13,.28,10),woodM);
  bucket.position.set(.25,CURB+.62,0);bucket.castShadow=true;g.add(bucket);
  const band=new THREE.Mesh(new THREE.TorusGeometry(.16,.02,6,12),metalM);
  band.rotation.x=Math.PI/2;band.position.set(.25,CURB+.74,0);g.add(band);
  g.userData.r=R+.12;g.userData.h=CURB+2.7;
  return g;
}

export default {category:'Rural',label:'Stone well',build};

export function addWell(cx: number,cz: number,ry=0): {x0:number;x1:number;z0:number;z1:number;h:number} {
  const g=build();g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  const r=g.userData.r;
  return{x0:cx-r,x1:cx+r,z0:cz-r,z1:cz+r,h:g.userData.h};
}
