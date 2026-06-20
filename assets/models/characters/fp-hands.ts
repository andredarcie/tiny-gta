import * as THREE from 'three';

// First-person hands. A single, more detailed hand (palm + curled fingers + thumb)
// used ONLY in first person (the gun viewmodel and the car cockpit grip), so the
// extra polys cost nothing in the third-person world. Built with the wrist at the
// origin, palm facing -Z (toward what it grips) and fingers reaching +Y then curling
// over the front; `side` (+1 right / -1 left) puts the thumb on the inner edge.

const palmGeo  =new THREE.BoxGeometry(.068,.044,.022);
const knuckGeo =new THREE.BoxGeometry(.065,.018,.024);
const fingerGeo=new THREE.BoxGeometry(.013,.05,.019);
const thumbGeo =new THREE.BoxGeometry(.016,.044,.02);

// Small box helper (position + rotation) for the wrap-grip hand below.
function bx(mat: THREE.Material,w: number,h: number,d: number,x: number,y: number,z: number,rx=0,ry=0,rz=0): THREE.Mesh{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=false;
  return m;
}

// A hand WRAPPED around a wheel rim (a real grip). Origin = the rim tube itself, so
// callers just place this at the grip point on the rim. Local axes: +Z toward the
// driver (back of hand + knuckles visible), +Y radially out (toward the rim's outer
// edge), the rim running along X through the origin. The four fingers drape over the
// rim and curl down/behind it in TWO segments each (proximal over the front, distal
// hooking behind), and the thumb opposes on the near side — so the rim is enclosed by
// the grip and partly hidden, exactly like a hand holding a wheel. FP-only, so the
// extra segments are cheap. `side` (+1 right / -1 left) sets the thumb side.
export function buildGripHand(skinMat: THREE.Material,side=1): THREE.Group{
  const h=new THREE.Group();
  // ONE solid fist mass that ENCLOSES the rim tube (rim hidden inside the fist, so it
  // reads as a single clean hand gripping — not a cluttered fan of separate fingers).
  h.add(bx(skinMat,.072,.056,.056, 0,.008,.006));       // fist mass straddling the rim
  h.add(bx(skinMat,.07,.016,.054,  0,.038,.006));       // knuckle ridge across the top
  for(let i=0;i<4;i++)                                   // 4 short fingertips curling under the front
    h.add(bx(skinMat,.013,.016,.022, (-1.5+i)*.0165,-.024,-.026, -.5));
  h.add(bx(skinMat,.018,.044,.022, side*.044,.004,.016, .4,0,side*.7)); // thumb on the near side
  return h;
}

// A bare hand (no sleeve). Reused by the gun viewmodel and the steering grip.
export function buildHand(skinMat: THREE.Material,side=1): THREE.Group{
  const h=new THREE.Group();
  h.add(new THREE.Mesh(palmGeo,skinMat));                 // back of the hand, at the origin
  const k=new THREE.Mesh(knuckGeo,skinMat);
  k.position.set(0,.03,-.012);                            // knuckle ridge
  h.add(k);
  for(let i=0;i<4;i++){                                   // four fingers, curling over the front (-Z)
    const f=new THREE.Mesh(fingerGeo,skinMat);
    f.position.set((-1.5+i)*.017,.038,-.028);
    f.rotation.x=-1.25;
    h.add(f);
  }
  const t=new THREE.Mesh(thumbGeo,skinMat);               // thumb on the inner side
  t.position.set(side*.04,0,-.006);
  t.rotation.set(-.3,0,side*.8);
  h.add(t);
  return h;
}

// A full arm: hand + a sleeved forearm hanging toward the elbow. Used by the gun
// viewmodel (hands come up from the bottom of the screen to grip the weapon).
function buildArm(skinMat: THREE.Material,sleeveMat: THREE.Material,side: number): THREE.Group{
  const arm=new THREE.Group();
  const hand=buildHand(skinMat,side);
  hand.position.set(0,0,-.02);
  arm.add(hand);
  const fore=new THREE.Mesh(new THREE.CapsuleGeometry(.04,.26,6,12),sleeveMat);
  fore.position.set(0,-.17,.02);
  fore.castShadow=false;
  arm.add(fore);
  arm.rotation.set(-.5,0,side*.32);                       // down-back-outward toward the corner
  return arm;
}

export function makeFpHands({skin=0xd9a06b,sleeve=0x19e3ff}: {skin?: number; sleeve?: number}={}): THREE.Group{
  const g=new THREE.Group();
  const skinMat=new THREE.MeshStandardMaterial({color:skin,roughness:.85});
  const sleeveMat=new THREE.MeshStandardMaterial({color:sleeve,roughness:.82});
  // right hand on the grip (toward the viewer); left hand forward, supporting the barrel
  const right=buildArm(skinMat,sleeveMat,1);
  right.position.set(.04,-.05,.06);
  const left=buildArm(skinMat,sleeveMat,-1);
  left.position.set(-.02,-.06,-.16);
  g.add(right,left);
  g.userData.right=right;g.userData.left=left;
  return g;
}

// Model-viewer descriptor (auto-discovered). Shows a hand straight-on for inspection.
export default {category:'Characters',label:'FP Hand',build:()=>{
  const m=new THREE.MeshStandardMaterial({color:0xc8a06a,roughness:.85});
  return buildHand(m,1);
}};
