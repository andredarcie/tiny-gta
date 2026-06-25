// ===========================================================================
// npc-glb.ts — every NPC as a rigged Quaternius "Animated Men" model (the same
// skeleton/clips as the hero). Loads all 8 outfit variants ONCE, then each NPC is
// a SkeletonUtils.clone (SHARED geometry — one copy in GPU) with its own skeleton,
// AnimationMixer and per-instance tinted materials (random skin/hair/clothes for
// variety). One central updateNpcGlb(dt) drives every NPC's clip (idle/walk/run by
// ground speed) + the knee IK, and FREEZES NPCs that are off-screen (the ped system
// hides them past ~130u) so invisible NPCs cost nothing. Kill-switch USE_GLB_NPCS
// reverts to the procedural ped (makePed falls back).
// ===========================================================================
import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {scene} from '@/core/engine.ts';
import {makeRng} from '@/core/rng.ts';
import {state} from '@/core/state.ts';
import {AIM_POSE} from './player-glb.ts';   // shared gun-hold posture (same HumanArmature rig)
interface GunBone{b:THREE.Bone;r:[number,number,number];}

export const USE_GLB_NPCS=true;   // flip to false to put every NPC back on the procedural ped

// NPCs use the 4 NON-smooth outfits per gender (~5-8k verts each) — far lighter than
// the smooth variants (~21-26k, kept for the hero). Men + women share the SAME rig
// and clip set (just a Man_/Female_ name prefix), so one system drives both. 4 outfits
// × random colours × either gender = lots of variety at a mobile-friendly cost.
const MALE_VARIANTS=['Male_Casual','Male_Shirt','Male_LongSleeve','Male_Suit'];
const FEMALE_VARIANTS=['Female_Casual','Female_Dress','Female_Alternative','Female_TankTop'];
const ALL_VARIANTS=[...MALE_VARIANTS,...FEMALE_VARIANTS];
const TARGET_HEIGHT=1.8;
// clips are 'HumanArmature|Man_Walk' / 'HumanArmature|Female_Walk' / … — map by the
// SUFFIX so both genders resolve to the same gameplay keys.
const SUFFIX:Record<string,string>={Idle:'idle',Walk:'walk',Run:'run',Death:'death',Sitting:'sit',Punch:'punch'};
function clipKey(name:string):string|undefined{return SUFFIX[name.split('_').pop()||''];}
// per-NPC random palettes for variety
const SKIN=[0xeec2a0,0xd9a06b,0xb8754c,0x8f5637,0x6f3e2a,0xf0c8a0];
const HAIR=[0x2e2018,0x14100c,0x4a2b18,0x6b5137,0x0d0d12,0x7a5a3a,0x9a9a9a];
const SHIRT=[0xc23b4e,0x3b7ac2,0xcf9a3a,0x3aa06b,0xd96fae,0xe8e3d2,0x7a4f9e,0x40c8c0,0x2f9fd6,0x444a55];
const PANTS=[0x202435,0x263454,0x2e2a24,0x3d3f46,0x18191f,0xe7dec9,0x4a3b2a];
const SHOES=[0x111117,0x33251e,0x1f2733,0x2b2b2b];
const pick=<T,>(a:T[])=>a[(Math.random()*a.length)|0];
const _bc=new THREE.Color();   // scratch for baking vertex colours at swap time

interface Loaded{root:THREE.Group;animations:THREE.AnimationClip[];}
const loaded:Record<string,Loaded>={};
let pending:Promise<void>|null=null;
let loadDone=false;   // true only once the WHOLE preload resolves (all variants attempted)
// Ready ONLY when the full preload finished — otherwise a female NPC could swap after
// just the male models loaded (parallel load race) and fall back to a male model.
export function npcGlbReady():boolean{return loadDone&&Object.keys(loaded).length>0;}

// ---- per-instance handle + central registry --------------------------------
interface NpcGlbHandle{
  group:THREE.Group;mixer:THREE.AnimationMixer;actions:Record<string,THREE.AnimationAction>;
  clip:string;legs:Leg[];prev:THREE.Vector3;seated:boolean;accum:number;gun:GunBone[];
}
const registry:NpcGlbHandle[]=[];

// ---- geometry fixups (shared per variant, done once at load) ----------------
function weldFeet(sm:THREE.SkinnedMesh):void{
  const bones=sm.skeleton.bones;
  const isFoot=(i:number)=>/^Foot[LR]$/.test(bones[i]?.name??'');
  const isShin=(i:number)=>/^LowerLeg[LR]$/.test(bones[i]?.name??'');
  const si=sm.geometry.getAttribute('skinIndex') as THREE.BufferAttribute;
  const sw=sm.geometry.getAttribute('skinWeight') as THREE.BufferAttribute;
  for(let v=0;v<si.count;v++){
    let fw=0,lw=0;for(let k=0;k<4;k++){const w=sw.getComponent(v,k);if(w<=1e-5)continue;const ix=si.getComponent(v,k);if(isFoot(ix))fw+=w;else if(isShin(ix))lw+=w;}
    if(fw<=0.02||lw<=0.02)continue;
    const dropFoot=fw<lw;const I=[0,0,0,0],W=[0,0,0,0];let n=0,sum=0;
    for(let k=0;k<4;k++){const w=sw.getComponent(v,k);if(w<=1e-5)continue;const ix=si.getComponent(v,k);if((dropFoot&&isFoot(ix))||(!dropFoot&&isShin(ix)))continue;I[n]=ix;W[n]=w;sum+=w;n++;}
    if(n===0||sum<=1e-6)continue;for(let k=0;k<4;k++)W[k]/=sum;si.setXYZW(v,I[0],I[1],I[2],I[3]);sw.setXYZW(v,W[0],W[1],W[2],W[3]);
  }
  si.needsUpdate=true;sw.needsUpdate=true;
}
function normalize(root:THREE.Group):void{
  root.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(root);const size=new THREE.Vector3();box.getSize(size);
  let scl=TARGET_HEIGHT/(size.y||1);if(!Number.isFinite(scl)||scl<=0)scl=0.0037;
  root.scale.setScalar(scl);root.updateWorldMatrix(true,true);
  const box2=new THREE.Box3().setFromObject(root);const c=new THREE.Vector3();box2.getCenter(c);
  root.position.x-=c.x;root.position.z-=c.z;root.position.y-=box2.min.y;
  root.traverse(o=>{
    const sm=o as THREE.SkinnedMesh;
    if(sm.isSkinnedMesh){
      sm.normalizeSkinWeights();weldFeet(sm);
      // frustum-cull NPCs that are off-screen (huge draw-call/skinning win for crowds —
      // NPCs behind/beside the camera aren't drawn). Inflate the (bind-pose) bounding
      // sphere so an animating limb never pokes past it → no edge popping.
      sm.frustumCulled=true;
      sm.geometry.computeBoundingSphere();
      if(sm.geometry.boundingSphere)sm.geometry.boundingSphere.radius*=1.5;
    }
    const m=o as THREE.Mesh;if(m.isMesh){m.castShadow=false;m.receiveShadow=false;}
  });
}

export function preloadNpcModels():Promise<void>{
  if(!USE_GLB_NPCS)return Promise.resolve();
  if(pending)return pending;
  const loader=new FBXLoader();
  const base=import.meta.env.BASE_URL;
  pending=Promise.all(ALL_VARIANTS.map(name=>
    loader.loadAsync(base+'models/npc/'+name+'.fbx').then(root=>{
      normalize(root);loaded[name]={root,animations:root.animations||[]};
    }).catch(e=>console.warn('[npc-glb] failed to load',name,e))
  )).then(()=>{
    loadDone=true;   // gate the swap until EVERY variant (both genders) has loaded
    console.log('[npc-glb] loaded '+Object.keys(loaded).length+'/'+ALL_VARIANTS.length+' NPC variants ('
      +MALE_VARIANTS.filter(v=>loaded[v]).length+'♂ '+FEMALE_VARIANTS.filter(v=>loaded[v]).length+'♀); swapping '+pendingSwaps.length+' queued NPCs');
    flushSwaps();
  });
  return pending;
}

// ---- per-instance leg IK (knee-only swing, preserves roll) ------------------
interface Leg{knee:THREE.Bone;foot:THREE.Bone;}
const _y=new THREE.Vector3(0,1,0),_kp=new THREE.Vector3(),_fp=new THREE.Vector3(),_tgt=new THREE.Vector3(),
  _cur=new THREE.Vector3(),_delta=new THREE.Quaternion(),_cw=new THREE.Quaternion(),_pw=new THREE.Quaternion();
function solveLegs(legs:Leg[]):void{
  for(const leg of legs){
    _kp.setFromMatrixPosition(leg.knee.matrixWorld);_fp.setFromMatrixPosition(leg.foot.matrixWorld);
    _tgt.subVectors(_fp,_kp);if(_tgt.lengthSq()<1e-8)continue;_tgt.normalize();
    leg.knee.getWorldQuaternion(_cw);_cur.copy(_y).applyQuaternion(_cw).normalize();
    _delta.setFromUnitVectors(_cur,_tgt);_cw.premultiply(_delta);
    if(leg.knee.parent){(leg.knee.parent as THREE.Object3D).getWorldQuaternion(_pw);_cw.premultiply(_pw.invert());}
    leg.knee.quaternion.copy(_cw);leg.knee.updateMatrixWorld(true);
  }
}

// ---- per-NPC visual (DETERMINISTIC by name) --------------------------------
// The NPC roster is seeded/fixed, so each named NPC must always look the same — for
// everyone, every play. Seed the outfit variant + skin/hair/clothes colours off the
// name so the look is reproducible (and the model-viewer can preview it by name).
interface Vis{variant:string;skin:number;hair:number;shirt:number;pants:number;shoe:number;}
function nameSeed(s:string):number{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0)||1;}
export function npcVisual(name:string,female:boolean):Vis{
  const r=makeRng(nameSeed(name)+(female?7:3));
  const vars=female?FEMALE_VARIANTS:MALE_VARIANTS;
  return {variant:r.pick(vars),skin:r.pick(SKIN),hair:r.pick(HAIR),shirt:r.pick(SHIRT),pants:r.pick(PANTS),shoe:r.pick(SHOES)};
}
function randomVisual(female:boolean,color?:number,pantsColor?:number):Vis{
  const vars=female?FEMALE_VARIANTS:MALE_VARIANTS;
  return {variant:pick(vars),skin:pick(SKIN),hair:pick(HAIR),shirt:color??pick(SHIRT),pants:pantsColor??pick(PANTS),shoe:pick(SHOES)};
}
// clone a variant (shared geometry) + tinted materials + mixer/actions/leg bones
function buildNpcModel(vis:Vis):{root:THREE.Group;fadeMats:THREE.Material[];mixer:THREE.AnimationMixer;actions:Record<string,THREE.AnimationAction>;legs:Leg[];gun:GunBone[]}{
  const vname=loaded[vis.variant]?vis.variant:pick(Object.keys(loaded));
  const src=loaded[vname];
  const root=cloneSkinned(src.root) as THREE.Group;
  const palette:Record<string,number>={Skin:vis.skin,Hair:vis.hair,HairBase:vis.hair,Eyebrows:vis.hair,Eyes:0x141414,
    Shirt:vis.shirt,Dress:vis.shirt,Jacket:vis.shirt,LightJacket:vis.shirt,Pants:vis.pants,Details:vis.pants,
    Socks:0xf0f0f0,Shoes:vis.shoe,Tie:0x202028,TieTexture:0x202028};
  const fadeMats:THREE.Material[]=[];
  root.traverse(o=>{
    const sm=o as THREE.SkinnedMesh;if(!sm.isSkinnedMesh)return;
    // MATERIAL MERGE: bake the per-part palette into a per-VERTEX colour and collapse
    // the 7 sub-materials into ONE → 1 draw call per NPC instead of 7 (big GPU win for
    // crowds, pixel-identical). The geometry is cloned per instance to carry its colours.
    const srcMats=(Array.isArray(sm.material)?sm.material:[sm.material]) as THREE.Material[];
    const geo=sm.geometry.clone();
    const pos=geo.getAttribute('position') as THREE.BufferAttribute;
    const col=new Float32Array(pos.count*3);
    const groups=geo.groups.length?geo.groups:[{start:0,count:(geo.index?geo.index.count:pos.count),materialIndex:0}];
    for(const grp of groups){
      const fx=palette[srcMats[grp.materialIndex??0]?.name??''];_bc.set(fx!==undefined?fx:0xc0c0c0);
      if(geo.index){const idx=geo.index;for(let i=grp.start;i<grp.start+grp.count;i++){const v=idx.getX(i);col[v*3]=_bc.r;col[v*3+1]=_bc.g;col[v*3+2]=_bc.b;}}
      else for(let v=grp.start;v<grp.start+grp.count;v++){col[v*3]=_bc.r;col[v*3+1]=_bc.g;col[v*3+2]=_bc.b;}
    }
    geo.setAttribute('color',new THREE.BufferAttribute(col,3));
    geo.clearGroups();
    sm.geometry=geo;
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0});
    sm.material=mat;fadeMats.push(mat);
  });
  const mixer=new THREE.AnimationMixer(root);
  const actions:Record<string,THREE.AnimationAction>={};
  for(const clip of src.animations){const key=clipKey(clip.name);if(key)actions[key]=mixer.clipAction(clip);}
  const bone=(n:string):THREE.Bone|undefined=>{let b:THREE.Bone|undefined;root.traverse(o=>{if(!b&&(o as THREE.Bone).isBone&&o.name===n)b=o as THREE.Bone;});return b;};
  const legs:Leg[]=[];
  for(const s of['L','R'] as const){const knee=bone('LowerLeg'+s),foot=bone('Foot'+s);if(knee&&foot)legs.push({knee,foot});}
  const gun:GunBone[]=[];   // arm/neck/head bones for the gun-hold posture (when armed & aiming)
  for(const name in AIM_POSE){const b=bone(name);if(b)gun.push({b,r:AIM_POSE[name]});}
  return {root,fadeMats,mixer,actions,legs,gun};
}
// build one NPC posed in idle for the model-viewer gallery (deterministic by name)
export async function makeNpcGlbViewer(name:string,female:boolean):Promise<THREE.Object3D>{
  await preloadNpcModels();
  if(!npcGlbReady())return new THREE.Group();
  const {root,mixer,actions,legs}=buildNpcModel(npcVisual(name,female));
  const idle=actions.idle||Object.values(actions)[0];
  if(idle){idle.play();mixer.update(0.6);root.updateMatrixWorld(true);solveLegs(legs);}
  return root;
}

// ---- swap an existing NPC group's visual to a GLB clone --------------------
// NPCs are built synchronously at world-load (before the async FBX is ready), so
// makePed gives them the procedural ped as an instant placeholder/fallback, then
// requestNpcGlb swaps the visual to a tinted GLB clone once the models load.
const pendingSwaps:{g:THREE.Group;color?:number;pants?:number}[]=[];
// Always DEFER the swap: makePed runs before the NPC's gender is known (addFemaleLook
// sets userData.npcFemale right after), so we queue and swap on the next frame (or
// when the models finish loading), by which point the gender flag is set.
export function requestNpcGlb(g:THREE.Group,color?:number,pantsColor?:number):void{
  if(!USE_GLB_NPCS)return;
  pendingSwaps.push({g,color,pants:pantsColor});
}
function flushSwaps():void{
  if(!npcGlbReady())return;
  let m=0,f=0;
  for(const s of pendingSwaps){if(s.g.userData.npcFemale)f++;else m++;swapToGlb(s.g,s.color,s.pants);}
  if(pendingSwaps.length)console.log(`[npc-glb] swapped ${m}♂ ${f}♀ NPCs to GLB`);
  pendingSwaps.length=0;
}
function swapToGlb(g:THREE.Group,color?:number,pantsColor?:number):void{
  // drop the placeholder visual (procedural doll mesh + mouth + any female hair)
  for(const c of g.children.slice()){g.remove(c);(c as THREE.Mesh).geometry?.dispose?.();}
  g.userData.limbs=undefined;g.userData.mouth=undefined;g.userData.femaleHairMesh=undefined;

  const female=!!g.userData.npcFemale;
  // named NPCs (the seeded roster) get a DETERMINISTIC look by name; anonymous ones
  // (traffic drivers, …) get a random one tinted by the requested shirt/pants.
  const vis=g.userData.npcName?npcVisual(g.userData.npcName as string,female):randomVisual(female,color,pantsColor);
  const {root,fadeMats,mixer,actions,legs,gun}=buildNpcModel(vis);
  g.add(root);

  const seated=!!g.userData.npcSeated;   // vehicle occupants ride in the 'sit' clip
  const handle:NpcGlbHandle={group:g,mixer,actions,clip:'',legs,prev:g.position.clone(),seated,accum:0,gun};
  g.userData.glbNpc=handle;g.userData.fadeMats=fadeMats;
  const first=(seated&&actions.sit)||actions.idle||Object.values(actions)[0];
  if(first){first.play();handle.clip=seated?'sit':'idle';}
  registry.push(handle);
}

// mark an NPC group as a seated vehicle occupant (plays the 'sit' clip). Works
// before OR after the GLB swap (stored on userData, read by swapToGlb).
export function setNpcGlbSeated(g:THREE.Object3D):void{
  g.userData.npcSeated=true;
  const h=g.userData.glbNpc as NpcGlbHandle|undefined;if(h)h.seated=true;
}

export function isNpcGlb(g:THREE.Object3D):boolean{return !!(g.userData as Record<string,unknown>)?.glbNpc;}

// detach an NPC from the central animation registry (call before discarding it)
export function disposeNpcGlb(g:THREE.Object3D):void{
  const h=(g.userData as Record<string,unknown>)?.glbNpc as NpcGlbHandle|undefined;
  if(!h)return;const i=registry.indexOf(h);if(i>=0)registry.splice(i,1);
}

// ---- central per-frame driver (call once from main.ts) ----------------------
function fade(h:NpcGlbHandle,key:string):void{
  if(key===h.clip)return;const next=h.actions[key];if(!next)return;
  const prev=h.actions[h.clip];next.reset().setEffectiveWeight(1).fadeIn(0.2).play();
  if(prev&&prev!==next)prev.fadeOut(0.2);h.clip=key;
}
const _np=new THREE.Vector3();
const _frustum=new THREE.Frustum(),_projScreen=new THREE.Matrix4(),_sphere=new THREE.Sphere(),_camPos=new THREE.Vector3();
// Culling of WORK, not just pixels:
//  • off-cull (group.visible=false, set by the ped/traffic systems past 130/170u): frozen.
//  • OFF-SCREEN (outside the camera frustum — player isn't looking at it): the renderer
//    already skips its draw, so we skip its mixer + IK too. Don't animate what's unseen.
//  • visible but DISTANT (>36u): mixer at ~12fps, no knee IK / extra matrix pass.
//  • near & on-screen: full quality.
const FAR2=36*36, FAR_DT=1/12;
export function updateNpcGlb(dt:number,camera?:THREE.PerspectiveCamera):void{
  if(pendingSwaps.length)flushSwaps();   // swap NPCs spawned this frame (gender now known)
  if(!registry.length)return;
  let cam=false;
  if(camera){
    camera.updateMatrixWorld();
    _projScreen.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreen);
    _camPos.setFromMatrixPosition(camera.matrixWorld);
    cam=true;
  }
  for(const h of registry){
    if(!h.group.visible){h.prev.copy(h.group.position);continue;}   // off-cull: freeze (cost 0)
    // off-screen (not in the camera frustum): skip ALL its work — not drawn, not animated.
    // Seated occupants keep updating (few, and they ride near you).
    if(cam&&!h.seated&&!_frustum.intersectsSphere(_sphere.set(h.group.position,1.6))){h.prev.copy(h.group.position);continue;}
    const far=cam?h.group.position.distanceToSquared(_camPos)>FAR2:false;
    if(!h.seated){                                                   // walkers pick a clip by ground speed
      _np.copy(h.group.position);
      const sp=dt>1e-4?_np.distanceTo(h.prev)/dt:0;h.prev.copy(_np);
      fade(h, sp>4.5?'run':sp>0.25?'walk':'idle');
      const a=h.actions[h.clip];
      if(h.clip==='walk')a?.setEffectiveTimeScale(Math.min(2.6,Math.max(0.6,sp/1.38)));
      else if(h.clip==='run')a?.setEffectiveTimeScale(Math.min(3,Math.max(1,sp/2.45)));
    }else fade(h,'sit');
    if(far){                                                         // distant: throttled mixer, no IK / extra matrix pass
      h.accum+=dt;
      if(h.accum>=FAR_DT){h.mixer.update(h.accum);h.accum=0;}
    }else{                                                           // near & on-screen: full quality
      h.mixer.update(dt);
      h.group.updateMatrixWorld(true);
      solveLegs(h.legs);
    }
    // armed NPC aiming this moment (poseAiming stamped npcAimT): overlay the gun-hold
    // posture on the arms/head, overriding the clip — same AIM_POSE as the hero.
    if(h.gun.length&&state.time-((h.group.userData.npcAimT as number)??-9)<0.25)
      for(const gb of h.gun)gb.b.rotation.set(gb.r[0],gb.r[1],gb.r[2]);
  }
}
