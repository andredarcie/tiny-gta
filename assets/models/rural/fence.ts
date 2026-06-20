import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Wooden post-and-rail fence — the staple that turns open pasture into farmland.
// build() returns a single straight SECTION (one post + two rails) on the origin
// running along +x; addFenceRun() lays sections end-to-end between two points and
// bakes them into the shared prop chunks (no extra draw calls per fence).
const postM=matte({color:0x6e4a32,roughness:.95});
const railM=matte({color:0x7a5638,roughness:.95});

const SECTION=2.2;        // length of one rail span (post spacing)
const RAIL_R=.05, POST=.14, H=1.05;

// One fence section: a post at the near end and two horizontal rails reaching to
// the next post. Built along +x so a run just translates/rotates copies of it.
function build(): THREE.Group {
  const g=new THREE.Group();
  const post=new THREE.Mesh(new THREE.BoxGeometry(POST,H,POST),postM);
  post.position.set(0,H/2,0);post.castShadow=true;g.add(post);
  for(const y of[H*.72,H*.36]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(SECTION,RAIL_R*2,RAIL_R*2.4),railM);
    rail.position.set(SECTION/2,y,0);g.add(rail);
  }
  return g;
}

// Preview: a short straight run for the model viewer.
function buildPreview(): THREE.Group {
  const g=new THREE.Group();
  for(let i=0;i<4;i++){const s=build();s.position.x=i*SECTION;g.add(s);}
  const cap=new THREE.Mesh(new THREE.BoxGeometry(POST,H,POST),postM);
  cap.position.set(4*SECTION,H/2,0);g.add(cap);
  return g;
}

export default {category:'Rural',label:'Rail fence',build:buildPreview};

// Lay a fence run from (x0,z0) to (x1,z1), baking each section into the props.
// Returns nothing (decorative; no collision — players/cars hop the low rails).
export function addFenceRun(x0: number,z0: number,x1: number,z1: number): void {
  const dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz);
  const n=Math.max(1,Math.round(len/SECTION));
  const ang=Math.atan2(dx,dz);            // heading that points (x0,z0)->(x1,z1)
  // model runs along +x, so rotate by (ang - 90deg) to align +x with the segment
  const ry=ang-Math.PI/2;
  for(let i=0;i<n;i++){
    const t=i/n;
    const g=build();
    g.position.set(x0+dx*t,-.02,z0+dz*t);g.rotation.y=ry;bakeProp(g);
  }
  // closing post at the far end so the run doesn't end on a gap
  const cap=new THREE.Group();
  const post=new THREE.Mesh(new THREE.BoxGeometry(POST,H,POST),postM);
  post.position.set(0,H/2,0);post.castShadow=true;cap.add(post);
  cap.position.set(x1,-.02,z1);bakeProp(cap);
}
