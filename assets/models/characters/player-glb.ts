// ===========================================================================
// Player avatar — loaded rigged humanoid (Quaternius "Animated Men", CC0).
//
// This is the ONE place in the project that loads a binary 3D asset at runtime
// (every other model is procedural — see assets/models/README.md). The hero
// character gets a real rigged humanoid with baked animation clips.
//
// LOADER CHOICE — we use three's FBXLoader on the source FBX, NOT a converted
// GLB. We tried converting to glTF (FBX2glTF) and loading with GLTFLoader: the
// model loads but the skinned mesh double-applies any ancestor transform (the
// bind is captured with the gltf scene at identity), so scaling it to size — or
// even moving it with the player — collapses/teleports it (invisible). FBXLoader
// binds so that ancestor transforms (our scale + the player container) apply
// once, which is what we need. We also call normalizeSkinWeights() — FBXLoader
// caps >4 weights per vertex by deleting extras, and renormalizing avoids the
// skinning artifacts that causes.
//
// The clips are named "HumanArmature|Man_*"; we map the ones the game uses to
// clean keys: idle · walk · run · jump · punch · death · sit.
//
// This module stays PURE: it loads + normalizes the model and hands back the
// scene, the mixer and the clip actions. The state->clip logic lives in the
// gameplay layer (js/actors/player.ts).
// ===========================================================================
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';

export interface PlayerGlbHandle{
  root:THREE.Group;                                  // normalized, ready to add as child of player.g
  mixer:THREE.AnimationMixer;
  actions:Record<string,THREE.AnimationAction>;
}

// Crown height to match the procedural ped (~1.80) so camera framing / aiming /
// seat offsets keep feeling the same after the swap.
const TARGET_HEIGHT=1.8;
const ONE_SHOT=new Set(['jump','punch','death']);    // play once, hold last frame

// Source clip name -> clean key used by the gameplay layer.
const CLIP_KEYS:Record<string,string>={
  'HumanArmature|Man_Idle':'idle',
  'HumanArmature|Man_Walk':'walk',
  'HumanArmature|Man_Run':'run',
  'HumanArmature|Man_Jump':'jump',
  'HumanArmature|Man_Punch':'punch',
  'HumanArmature|Man_Death':'death',
  'HumanArmature|Man_Sitting':'sit',
};

// FIXED player look — "Miami / Vice City": fair skin + a blue shirt, beach tones.
// Keyed by the model's material names. Fixes the hero's appearance regardless of
// the model's baked colours; unmapped parts keep their own colour.
const PALETTE:Record<string,number>={
  Skin:0xeec2a0,   // fair / light skin
  Hair:0x2e2018,   // dark brown
  Eyes:0x141414,   // near-black
  Shirt:0x2f9fd6,  // Vice City blue
  Pants:0xe7dec9,  // cream beach shorts
  Socks:0xf0f0f0,  // white
  Shoes:0x2b2b2b,  // dark shoes
};

// Public asset path. base is './' (see vite.config.ts), so BASE_URL keeps this
// correct on the dev server and under the itch.io sub-path.
const URL=import.meta.env.BASE_URL+'models/player.fbx';

// Rebuild an FBX (Phong) material as a flat, matte MeshStandardMaterial (no
// specular shine, to match the procedural peds), applying the fixed Miami colour.
function toMatte(src:THREE.Material):THREE.MeshStandardMaterial{
  const s=src as THREE.MeshPhongMaterial;
  const fixed=PALETTE[s.name];
  const m=new THREE.MeshStandardMaterial({
    color:fixed!==undefined?new THREE.Color(fixed):(s.color?s.color.clone():new THREE.Color(0xffffff)),
    roughness:1,
    metalness:0,
  });
  m.name=s.name;
  return m;
}

// Weld the ankle seam to kill the linear-blend-skinning "candy-wrapper". The
// Quaternius rig has ONE bone per foot (no toe joint) and a broad weight blend:
// ~1300 verts around the ankle carry MIXED Foot + LowerLeg weight, so at toe-off
// (foot rotated hard vs the shin) they get torn between the two bone transforms and
// stretch up to ~5x the foot length — the visible smear. Snapping every such vertex
// onto its dominant side (drop the smaller cross-joint partner, renormalize) makes
// the foot move rigidly with its own bone, which is what a foot does. Offline-
// measured: max foot deviation over the walk drops 1.24u -> 0.02u. Trade-off: a
// crisper ankle bend instead of a smeared one — invisible on this low-poly toon
// (the old procedural ped used a fully rigid separate foot mesh anyway).
function weldFootSeam(sm:THREE.SkinnedMesh):number{
  const bones=sm.skeleton.bones;
  const isFoot=(i:number)=>/^Foot[LR]$/.test(bones[i]?.name??'');
  const isShin=(i:number)=>/^LowerLeg[LR]$/.test(bones[i]?.name??'');
  const si=sm.geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
  const sw=sm.geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
  let welded=0;
  for(let v=0;v<si.count;v++){
    let fw=0,lw=0;
    for(let k=0;k<4;k++){const w=sw.getComponent(v,k);if(w<=1e-5)continue;const ix=si.getComponent(v,k);if(isFoot(ix))fw+=w;else if(isShin(ix))lw+=w;}
    if(fw<=0.02||lw<=0.02)continue;                 // vertex doesn't bridge the ankle joint
    const dropFoot=fw<lw;                            // remove the smaller cross-joint side
    const I=[0,0,0,0],W=[0,0,0,0];let n=0,sum=0;
    for(let k=0;k<4;k++){const w=sw.getComponent(v,k);if(w<=1e-5)continue;const ix=si.getComponent(v,k);
      if((dropFoot&&isFoot(ix))||(!dropFoot&&isShin(ix)))continue;
      I[n]=ix;W[n]=w;sum+=w;n++;}
    if(n===0||sum<=1e-6)continue;
    for(let k=0;k<4;k++)W[k]/=sum;                   // renormalize the kept side to 1
    si.setXYZW(v,I[0],I[1],I[2],I[3]);sw.setXYZW(v,W[0],W[1],W[2],W[3]);
    welded++;
  }
  si.needsUpdate=true;sw.needsUpdate=true;
  return welded;
}

// ===========================================================================
// RUNTIME KNEE FIX — the fix for the foot "stretching", minimal-touch version.
// The Quaternius rig is an IK rig; its FBX baked the THIGH (UpperLeg) and FOOT
// correctly but left the KNEE (LowerLeg) rotation unbaked (~locked). three.js
// doesn't run IK, so the straight shin can't reach the keyed foot (which lives on a
// SEPARATE root-parented chain) and the ankle/calf mesh stretches up to ~0.5m to
// bridge the gap. Because the thigh is already correct, it places the knee exactly
// one shin-length from the foot (verified |knee→foot| ≈ shin length over the walk),
// so we ONLY swing the shin to point its end at the foot. Crucially we do NOT touch
// the thigh and we apply a MINIMAL SWING delta (not an absolute re-aim), preserving
// the thigh's natural keyed animation AND the shin's roll — so nothing looks robotic
// or twisted. Offline: shin-end→foot gap 49.9cm → 0.5cm with the thigh untouched.
// ===========================================================================
interface LegIK{knee:THREE.Bone;foot:THREE.Bone;}
let legIKs:LegIK[]=[];
let gunHandBone:THREE.Bone|null=null;   // right-hand bone — a held weapon hangs off it
export function glbGunHand():THREE.Bone|null{return gunHandBone;}
let gymArmBones:THREE.Bone[]=[];        // upper-arm bones — gym muscle growth thickens them
// Thicken the upper arms (x/z only, not length) by the gym's armScale. MUST be called
// every frame AFTER mixer.update(): the clips carry .scale tracks that reset bone scale
// to ~1 each frame, so the muscle growth has to be re-applied on top.
export function applyGymArms(s:number):void{for(const b of gymArmBones)b.scale.x=b.scale.z=s;}
const _kY=new THREE.Vector3(0,1,0),_kCur=new THREE.Vector3(),_kTgt=new THREE.Vector3(),
  _kKp=new THREE.Vector3(),_kFp=new THREE.Vector3(),
  _kDelta=new THREE.Quaternion(),_kCW=new THREE.Quaternion(),_kPW=new THREE.Quaternion();

function setupLegIK(root:THREE.Object3D):void{
  legIKs=[];
  const get=(n:string):THREE.Bone|null=>{let b:THREE.Bone|null=null;root.traverse(o=>{if(!b&&(o as THREE.Bone).isBone&&o.name===n)b=o as THREE.Bone;});return b;};
  for(const s of ['L','R'] as const){
    const knee=get('LowerLeg'+s),foot=get('Foot'+s);
    if(knee&&foot)legIKs.push({knee,foot});
  }
  gunHandBone=get('MiddleHandR')||get('PalmR');   // anchor for the held weapon (3rd person)
  gymArmBones=[get('UpperArmL'),get('UpperArmR')].filter(Boolean) as THREE.Bone[]; // gym gains
  console.log('[glb-ik] knee fix set up for '+legIKs.length+' legs');
}

export function solveLegIK():void{
  for(const leg of legIKs){
    _kKp.setFromMatrixPosition(leg.knee.matrixWorld);
    _kFp.setFromMatrixPosition(leg.foot.matrixWorld);
    _kTgt.subVectors(_kFp,_kKp);if(_kTgt.lengthSq()<1e-8)continue;_kTgt.normalize(); // knee→foot dir
    leg.knee.getWorldQuaternion(_kCW);
    _kCur.copy(_kY).applyQuaternion(_kCW).normalize();          // current shin direction
    _kDelta.setFromUnitVectors(_kCur,_kTgt);                    // minimal swing onto the foot
    _kCW.premultiply(_kDelta);                                  // newWorld = delta * current (roll preserved)
    if(leg.knee.parent){(leg.knee.parent as THREE.Object3D).getWorldQuaternion(_kPW);_kCW.premultiply(_kPW.invert());}
    leg.knee.quaternion.copy(_kCW);
    leg.knee.updateMatrixWorld(true);
  }
}

// ===========================================================================
// CUSTOM SEATED POSES — per-vehicle full-body poses for the GLB, hand-tuned in
// /studio's pose editor and pasted here as bone-local Euler rotations. Applied
// each frame (overriding the clip) when the GLB rides that vehicle. The feet live
// on a SEPARATE root-parented chain, so after setting the leg rotations we snap
// each Foot bone onto its shin's end to reconnect it (what the editor did) —
// reproducing the pose from rotations alone.
// ===========================================================================
// Roll-preserving rotations (re-derived from the posed foot/hand POSITIONS so the
// limb bases don't wring like twisted cloth — the raw editor aim carried bad twist).
const MOTO_POSE: Record<string, [number, number, number]> = {
  Body: [-0.001, 0.005, 0.000],
  UpperLegL: [-3.135, 0.015, -0.416], LowerLegL: [0.181, -0.000, 0.002], FootL: [-1.540, 0.011, -2.791],
  UpperLegR: [-3.065, 0.004, 0.290], LowerLegR: [0.033, 0.000, -0.001], FootR: [-1.539, -0.005, 2.984],
  UpperArmL: [-1.618, 0.331, -2.479], LowerArmL: [0.130, -0.051, -0.609],
  UpperArmR: [-1.698, -0.384, 2.333], LowerArmR: [0.137, 0.001, 0.780],
  Neck: [0.153, 0.000, 0.000], Head: [-0.231, -0.001, 0.006],
};
// Driver pose for the car (feet on the footwell floor, hands toward the wheel,
// hips in the driver seat). Derived by IK from those target positions in /studio.
const CAR_POSE: Record<string, [number, number, number]> = {
  Body: [-0.012, 0.035, 0.000],
  UpperLegL: [1.195, 0.058, -0.415], LowerLegL: [1.670, 0.493, 0.879], FootL: [-1.540, 0.011, -2.791],
  UpperLegR: [1.158, -0.051, 0.317], LowerLegR: [1.475, -0.267, -0.601], FootR: [-1.539, -0.005, 2.984],
  UpperArmL: [-1.302, 0.675, -2.807], LowerArmL: [0.161, -0.101, -0.911],
  UpperArmR: [-1.398, -0.752, 2.678], LowerArmR: [0.204, 0.039, 0.995],
  Neck: [0.235, -0.011, -0.010], Head: [-0.231, -0.001, 0.006],
};
const VEHICLE_POSES: Record<string, Record<string, [number, number, number]>> = { bike: MOTO_POSE, car: CAR_POSE };
// GUN-HOLD posture — a two-handed ready stance: both hands meet in front of the chest
// (right on the grip, left cupping), elbows down-and-out. Derived by 2-bone IK from those
// hand targets (same solver as /studio), so the hands actually meet. UPPER-BODY ONLY:
// only the arm bones (+ a slight head tilt down the sights) are set; the legs/hips keep
// the locomotion clip, so the hero can stand, walk or run while keeping the gun up.
// Exported so the GLB NPCs (same HumanArmature rig) reuse the exact same posture.
export const AIM_POSE: Record<string, [number, number, number]> = {
  UpperArmL: [-1.489, 0.413, -2.429], LowerArmL: [-0.320, 0.339, -1.504],
  UpperArmR: [-1.571, -0.531, 2.404], LowerArmR: [-0.440, -0.362, 1.209],
  Neck: [0.120, 0.000, 0.000], Head: [-0.090, 0.000, 0.000],
};
let _poseBones: Map<string, THREE.Bone> | null = null;
let _poseBonesRoot: THREE.Object3D | null = null;
const _pf = new THREE.Vector3();
function poseBoneMap(root: THREE.Object3D): Map<string, THREE.Bone> {
  if (_poseBonesRoot === root && _poseBones) return _poseBones;
  const m = new Map<string, THREE.Bone>();
  root.traverse(o => { if ((o as THREE.Bone).isBone) m.set(o.name, o as THREE.Bone); });
  _poseBones = m; _poseBonesRoot = root; return m;
}
// Drive the GLB into a fixed seated pose for `kind` (∈ VEHICLE_POSES). Call AFTER
// mixer.update(); returns false if there's no pose for that vehicle (use IK instead).
export function applyVehiclePose(root: THREE.Object3D, kind: string): boolean {
  const pose = VEHICLE_POSES[kind];
  if (!pose) return false;
  const bones = poseBoneMap(root);
  for (const name in pose) { const b = bones.get(name); if (b) { const r = pose[name]; b.rotation.set(r[0], r[1], r[2]); } }
  root.updateMatrixWorld(true);
  for (const s of ['L', 'R'] as const) {
    const end = bones.get('LowerLeg' + s + '_end'), foot = bones.get('Foot' + s);
    if (end && foot && foot.parent) { _pf.setFromMatrixPosition(end.matrixWorld); foot.parent.worldToLocal(_pf); foot.position.copy(_pf); foot.updateMatrixWorld(true); }
  }
  return true;
}
// Drive the GLB into the GUN-HOLD posture (AIM_POSE) — upper body only, so the legs/hips
// keep whatever locomotion clip is playing. Call AFTER mixer.update() + solveLegIK().
export function applyGunPose(root: THREE.Object3D): void {
  const bones = poseBoneMap(root);
  for (const name in AIM_POSE) { const b = bones.get(name); if (b) { const r = AIM_POSE[name]; b.rotation.set(r[0], r[1], r[2]); } }
  root.updateMatrixWorld(true);
}


// Collapse a multi-material skinned mesh (flat colours, NO textures) into ONE
// vertex-coloured matte material → a single draw call instead of one-per-group. The
// hero mesh ships as 7 materials spread over 151 geometry groups = 151 draw calls;
// this bakes each group's colour into the vertices and renders it in 1 draw,
// pixel-identical (verified hasMap=false). Same trick the GLB NPCs already use.
const _bcp=new THREE.Color();
function bakeVertexColors(sm:THREE.SkinnedMesh):void{
  const mats=(Array.isArray(sm.material)?sm.material:[sm.material]) as THREE.MeshStandardMaterial[];
  const geo=sm.geometry;
  if(mats.length<=1&&!geo.groups.length)return;   // already a single draw
  const pos=geo.getAttribute('position') as THREE.BufferAttribute;
  const col=new Float32Array(pos.count*3);
  const groups=geo.groups.length?geo.groups:[{start:0,count:(geo.index?geo.index.count:pos.count),materialIndex:0}];
  for(const g of groups){
    const mat=mats[g.materialIndex||0];
    if(mat&&mat.color)_bcp.copy(mat.color);else _bcp.setHex(0xcccccc);
    if(geo.index){const idx=geo.index;for(let i=g.start;i<g.start+g.count;i++){const v=idx.getX(i);col[v*3]=_bcp.r;col[v*3+1]=_bcp.g;col[v*3+2]=_bcp.b;}}
    else for(let v=g.start;v<g.start+g.count;v++){col[v*3]=_bcp.r;col[v*3+1]=_bcp.g;col[v*3+2]=_bcp.b;}
  }
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  geo.clearGroups();
  sm.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0});
}

let pending:Promise<PlayerGlbHandle|null>|null=null;

// Load + normalize once (idempotent). Resolves to null if the asset fails to load
// so the caller can silently keep the procedural fallback.
export function loadPlayerGlb():Promise<PlayerGlbHandle|null>{
  if(pending)return pending;
  pending=new FBXLoader().loadAsync(URL).then(root=>{
    // FBXLoader imports this asset Y-up at ~482 units tall. Normalize to
    // TARGET_HEIGHT, feet to local y=0, centered on x/z.
    root.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(root);
    const size=new THREE.Vector3();box.getSize(size);
    let scl=TARGET_HEIGHT/(size.y||1);
    if(!Number.isFinite(scl)||scl<=0||size.y<1e-4)scl=0.0037;
    root.scale.setScalar(scl);
    root.updateWorldMatrix(true,true);
    const box2=new THREE.Box3().setFromObject(root);
    const c=new THREE.Vector3();box2.getCenter(c);
    root.position.x-=c.x;
    root.position.z-=c.z;
    root.position.y-=box2.min.y;

    // Matte materials, no shadow (matches noShadow() in player.ts), no culling of
    // skinned limbs, and renormalize skin weights (FBXLoader's >4-weight cap fix).
    let weldedTotal=0;
    root.traverse(o=>{
      const m=o as THREE.Mesh;
      if((m as THREE.SkinnedMesh).isSkinnedMesh){
        const sm=m as THREE.SkinnedMesh;
        sm.normalizeSkinWeights();
        weldedTotal+=weldFootSeam(sm);                       // fix the ankle candy-wrapper
        bakeVertexColors(sm);                                // 151 draws → 1 (vertex colours)
      }
      if(!m.isMesh)return;
      m.castShadow=false;m.receiveShadow=false;m.frustumCulled=false;
      // skinned hero already got its single vertex-colour material above; matte the rest
      if(!(m as THREE.SkinnedMesh).isSkinnedMesh)
        m.material=Array.isArray(m.material)?m.material.map(toMatte):toMatte(m.material);
    });

    const mixer=new THREE.AnimationMixer(root);
    const actions:Record<string,THREE.AnimationAction>={};
    for(const clip of (root.animations||[])){
      const key=CLIP_KEYS[clip.name];
      if(!key)continue;
      const a=mixer.clipAction(clip);
      if(ONE_SHOT.has(key)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}
      actions[key]=a;
    }
    console.log('[player-glb] loaded (FBX): rawH='+size.y.toFixed(1)+' scale='+scl.toFixed(4)+' clips='+(root.animations?.length||0)+' ankleWeld='+weldedTotal+' verts');
    setupLegIK(root);   // the FIX: runtime knee IK so the shin reaches the keyed foot
    return {root,mixer,actions};
  }).catch(err=>{
    console.warn('[player-glb] failed to load',URL,err);
    return null;
  });
  return pending;
}
