import * as THREE from 'three';
import type {FpArmPose,FpHandsPose} from '@/combat/weapon-types.ts';

// First-person hands — BOX style, like every NPC doll (assets/models/characters/
// pedestrian.ts): the hand is one cube fist and the forearm one square sleeve. Used by
// the gun viewmodel and the car cockpit grip. Built with the wrist at the origin, the
// fist facing -Z (toward what it grips); `side` (+1 right / -1 left) is kept for the
// callers' mirroring.

const FIST=new THREE.BoxGeometry(.075,.075,.065);   // cube hand (the doll's hand is a .09 cube)

// A hand gripping a wheel rim: one cube fist centred on the rim tube (the rim runs along
// X through the origin), so the rim disappears into the fist.
export function buildGripHand(skinMat: THREE.Material,_side=1): THREE.Group{
  const h=new THREE.Group();
  const f=new THREE.Mesh(FIST,skinMat);f.position.set(0,.008,.006);f.castShadow=false;
  h.add(f);
  return h;
}

// A bare hand (no sleeve): one cube fist. Reused by the gun viewmodel.
export function buildHand(skinMat: THREE.Material,_side=1): THREE.Group{
  const h=new THREE.Group();
  const f=new THREE.Mesh(FIST,skinMat);f.position.set(0,.015,-.01);f.castShadow=false;
  h.add(f);
  return h;
}

// A full arm: hand + a sleeved forearm hanging toward the elbow. Used by the gun
// viewmodel (hands come up from the bottom of the screen to grip the weapon).
function buildArm(skinMat: THREE.Material,sleeveMat: THREE.Material,side: number): THREE.Group{
  const arm=new THREE.Group();
  const hand=buildHand(skinMat,side);
  hand.position.set(0,0,-.02);
  arm.add(hand);
  const fore=new THREE.Mesh(new THREE.BoxGeometry(.085,.3,.085),sleeveMat); // square sleeve
  fore.position.set(0,-.19,.02);
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

export function poseFpHands(hands: THREE.Group,pose: FpHandsPose):void{
  const right=hands.userData.right as THREE.Group;
  const left=hands.userData.left as THREE.Group;
  applyArmPose(right,pose.right);
  applyArmPose(left,pose.left);
}

function applyArmPose(arm: THREE.Group,pose: FpArmPose):void{
  arm.position.set(...pose.position);
  arm.rotation.set(...pose.rotation);
  arm.visible=pose.visible!==false;
}

// Model-viewer descriptor (auto-discovered). Shows a hand straight-on for inspection.
export default {category:'Characters',label:'FP Hand',build:()=>{
  const m=new THREE.MeshStandardMaterial({color:0xc8a06a,roughness:.85});
  return buildHand(m,1);
}};
