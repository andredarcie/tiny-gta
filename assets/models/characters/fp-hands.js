import * as THREE from 'three';

// First-person viewmodel arms: two short sleeved forearms with simple hands, posed
// to grip a weapon held in front of the camera (see js/weapons.js applyViewModel).
// Pure factory — gameplay code (js/**) must not define geometry, so the meshes
// live here. Local space, as weapons.js orients it: +X right, +Y up, -Z into the
// screen (so the arms hang down toward the bottom corners and reach to the grip).

const foreGeo=new THREE.CapsuleGeometry(.04,.24,6,12); // sleeved forearm (along -Y)
const wristGeo=new THREE.SphereGeometry(.042,12,10);
const handGeo=new THREE.BoxGeometry(.072,.046,.1);     // simple blocky hand
const thumbGeo=new THREE.BoxGeometry(.026,.044,.05);

// One arm: group origin is the wrist (the grip point); the forearm hangs toward the
// elbow and the whole arm is tilted so it comes in from the bottom corner.
function buildArm(skinMat,sleeveMat,side){
  const arm=new THREE.Group();
  const hand=new THREE.Mesh(handGeo,skinMat);
  hand.position.set(0,0,-.035);         // knuckles a touch into the screen
  arm.add(hand);
  const thumb=new THREE.Mesh(thumbGeo,skinMat);
  thumb.position.set(side*.042,.012,-.015);
  arm.add(thumb);
  arm.add(new THREE.Mesh(wristGeo,skinMat));
  const fore=new THREE.Mesh(foreGeo,sleeveMat);
  fore.position.set(0,-.15,.015);       // hangs below the wrist
  fore.castShadow=false;
  arm.add(fore);
  // tilt mostly straight down with a little outward splay (less toward the viewer,
  // so the elbows drop out of frame instead of looming large)
  arm.rotation.set(-.5,0,side*.32);
  return arm;
}

export function makeFpHands({skin=0xd9a06b,sleeve=0x19e3ff}={}){
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

// Model-viewer descriptor (auto-discovered). Shown straight-on for inspection.
export default {category:'Characters',label:'FP Hands',build:()=>makeFpHands()};
