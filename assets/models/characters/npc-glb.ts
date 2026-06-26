// ===========================================================================
// npc-glb.ts — every NPC is a clone of the ONE shared mixamorig base (mixamo-rig.ts):
// same mesh + clip set as the hero, recoloured per NPC by region. makeCharacter() does
// the SkeletonUtils.clone + tint + mixer; this module just swaps each NPC's placeholder
// to that clone and drives its AnimState via the central updateNpcGlb(dt). NPCs off-screen
// or far away are frozen/throttled. Kill-switch USE_GLB_NPCS reverts to the procedural ped.
// ===========================================================================
import * as THREE from 'three';
import {state} from '@/core/state.ts';
import {AnimationStateMachine,AnimState,MIXAMO_TABLE} from '@/actors/anim-fsm.ts';   // the one animation authority
import {preloadRig,rigReady,makeCharacter,lookFor,MIXAMO_LOCO_NAT,MIXAMO_WALK_NAT,type Look} from './mixamo-rig.ts';

export const USE_GLB_NPCS=true;   // flip to false to put every NPC back on the procedural ped

// A per-NPC Look from the shared base: named roster → deterministic by name; anonymous →
// seeded by spawn, honouring the requested shirt/pants when traffic asks for a colour.
function mixamoLook(g:THREE.Object3D,color?:number,pants?:number):Look{
  const name=(g.userData as Record<string,unknown>).npcName as string|undefined;
  const seed=name??`anon_${color??0}_${pants??0}_${Math.round(g.position.x)}_${Math.round(g.position.z)}`;
  const L=lookFor(seed);
  if(color!=null)L.Shirt=color; if(pants!=null)L.Pants=pants;
  return L;
}

// Per-NPC handle in the central registry; each carries its own AnimationStateMachine.
interface NpcGlbHandle{group:THREE.Group;prev:THREE.Vector3;seated:boolean;accum:number;fsm:AnimationStateMachine;}
const registry:NpcGlbHandle[]=[];
const npcFsm=(g:THREE.Object3D,ch:{mixer:THREE.AnimationMixer;actions:Record<string,THREE.AnimationAction>})=>
  new AnimationStateMachine(g,ch.mixer,ch.actions,{solveLegs:()=>{},locoScale:0.6,walkNat:MIXAMO_WALK_NAT,runNat:MIXAMO_LOCO_NAT},MIXAMO_TABLE);

// Ready once the shared base has loaded (the only thing NPC swaps wait on).
export function npcGlbReady():boolean{return rigReady();}
export function preloadNpcModels():Promise<void>{
  if(!USE_GLB_NPCS)return Promise.resolve();
  return preloadRig().then(()=>{flushSwaps();});   // swap any NPCs queued before the base arrived
}

// build one NPC posed in idle for the model-viewer gallery (deterministic by name)
export async function makeNpcGlbViewer(name:string,_female:boolean):Promise<THREE.Object3D>{
  await preloadRig();
  const ch=makeCharacter(lookFor(name));
  if(!ch)return new THREE.Group();
  npcFsm(ch.root,ch).update(0.6,{});   // settle into the FSM's default Idle
  return ch.root;
}

// ---- swap an existing NPC group's visual to a base clone -------------------
// NPCs are built synchronously at world-load (before the async base is ready), so makePed
// gives them the procedural ped as an instant placeholder, then requestNpcGlb swaps it.
const pendingSwaps:{g:THREE.Group;color?:number;pants?:number}[]=[];
// Always DEFER the swap: makePed runs before the NPC's gender is known (addFemaleLook sets
// userData.npcFemale right after), so we queue and swap on the next frame (or once the base
// loads), by which point the flags are set.
export function requestNpcGlb(g:THREE.Group,color?:number,pantsColor?:number):void{
  if(!USE_GLB_NPCS)return;
  pendingSwaps.push({g,color,pants:pantsColor});
}
function flushSwaps():void{
  if(!rigReady())return;                 // wait on the shared base before swapping
  for(const s of pendingSwaps)swapToGlb(s.g,s.color,s.pants);
  if(pendingSwaps.length)console.log(`[npc-glb] swapped ${pendingSwaps.length} NPCs to the Mixamo base`);
  pendingSwaps.length=0;
}
function swapToGlb(g:THREE.Group,color?:number,pantsColor?:number):void{
  // drop the placeholder visual (procedural doll mesh + mouth + any female hair)
  for(const c of g.children.slice()){g.remove(c);(c as THREE.Mesh).geometry?.dispose?.();}
  g.userData.limbs=undefined;g.userData.mouth=undefined;g.userData.femaleHairMesh=undefined;

  const ch=makeCharacter(mixamoLook(g,color,pantsColor));
  if(!ch)return;                         // rig not ready (flushSwaps gates on rigReady, so rare)
  g.add(ch.root);
  const seated=!!g.userData.npcSeated;   // vehicle occupants ride in the 'sit' clip
  const fsm=npcFsm(g,ch);
  fsm.request(seated?AnimState.Sit:AnimState.Idle);
  fsm.update(0,{});                      // start the clip now (no T-pose before the first updateNpcGlb)
  const handle:NpcGlbHandle={group:g,prev:g.position.clone(),seated,accum:0,fsm};
  g.userData.glbNpc=handle;
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
const _np=new THREE.Vector3();
const _frustum=new THREE.Frustum(),_projScreen=new THREE.Matrix4(),_sphere=new THREE.Sphere(),_camPos=new THREE.Vector3();
// Culling of WORK, not just pixels:
//  • off-cull (group.visible=false, set by the ped/traffic systems past 130/170u): frozen.
//  • OFF-SCREEN (outside the camera frustum — player isn't looking at it): the renderer
//    already skips its draw, so we skip its mixer too. Don't animate what's unseen.
//  • visible but DISTANT (>36u): mixer at ~12fps.
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
    const ud=h.group.userData;
    // ----- decide this NPC's AnimState (the FSM renders it) -----
    let speed=0,loco=AnimState.Idle,st:AnimState;
    if(h.seated)st=AnimState.Sit;                                   // vehicle occupant rides seated
    else if(ud.npcDead)st=ud.npcGrounded?AnimState.Lie:AnimState.Ragdoll; // dead: tumble in air, settle on the ground
    else if(ud.npcLying)st=AnimState.Lie;                           // hospital patient on a bed
    else{
      _np.copy(h.group.position);
      speed=dt>1e-4?_np.distanceTo(h.prev)/dt:0;h.prev.copy(_np);   // ground speed → walk/run by speed
      loco=speed>4.5?AnimState.Run:speed>0.25?AnimState.Walk:AnimState.Idle;
      // a scripted gesture or an active aim overlays the locomotion (set via setNpcGlbGesture)
      const gest=ud.glbGesture as string|undefined;
      if(gest==='wave')st=AnimState.Wave;                           // taxi hail / rural greeting
      else if(gest==='talk')st=AnimState.Talk;                      // cutscene gesticulation
      else if(gest==='beckon')st=AnimState.Beckon;                  // weed buyer come-here
      else if(gest==='work')st=AnimState.Work;                      // rural farm work
      else if(gest==='clubdance')st=AnimState.ClubDance;            // nightclub dancing
      else if(state.time-((ud.npcAimT as number)??-9)<0.25)st=AnimState.Aim; // poseAiming stamped npcAimT
      else st=loco;
    }
    h.fsm.request(st);
    // distant: throttle the whole FSM tick to ~12fps; near: full quality.
    if(far){
      h.accum+=dt;
      if(h.accum>=FAR_DT){h.fsm.update(h.accum,{speed,loco,t:state.time,talking:!!ud.glbTalking});h.accum=0;}
    }else h.fsm.update(dt,{speed,loco,t:state.time,talking:!!ud.glbTalking});
  }
}

// Overlay a scripted gesture/routine on a GLB NPC's locomotion clip — 'wave' (taxi hail /
// rural greet), 'talk' (cutscene gesticulation; pass `talking` to animate vs settle),
// 'beckon' (weed buyer come-here), 'work' (rural farm chop), 'clubdance' (nightclub) — or
// null to clear. No-op visual for procedural NPCs (only updateNpcGlb reads these flags).
export type NpcGesture='wave'|'talk'|'beckon'|'work'|'clubdance';
export function setNpcGlbGesture(g:THREE.Object3D,gesture:NpcGesture|null,talking=false):void{
  g.userData.glbGesture=gesture??undefined;
  g.userData.glbTalking=talking;
}
// Mark/unmark a GLB NPC as lying down (hospital patient on a bed → the Lie posture).
export function setNpcGlbLying(g:THREE.Object3D,lying:boolean):void{g.userData.npcLying=lying||undefined;}
