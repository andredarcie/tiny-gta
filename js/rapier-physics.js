// ---------------------------------------------------------------------------
// Rapier physics — integration FOUNDATION (step 1, additive & opt-in).
//
// The game's own collision lives in js/physics.js (collideStatics, AABB solids)
// and is untouched. This module brings in the Rapier engine
// (@dimforge/rapier3d-compat, Rust→WASM) and wires it into the frame loop WITHOUT
// taking over the player or the cars yet, so nothing existing can break:
//
//   • a real physics World steps every frame,
//   • the static city is mirrored into it as fixed colliders (reusing the SAME
//     `solids` AABBs the game already collides against — buildings, benches,
//     fountains, the fort, …), so dynamic bodies bump into the real city,
//   • a small stack of demo crates is dropped next to the player so you can SEE
//     Rapier working (they fall, tumble and pile up against the street/buildings).
//
// It only runs when the URL contains `?phys` (see main.js), so normal play and
// the shipped build are completely unaffected. WASM init is async and fully
// guarded: if Rapier fails to load, the game just runs as before.
//
// NEXT STEPS (once you've confirmed this works): replace the flat ground with a
// heightfield built from groundHeight(), then move the on-foot player onto a
// KinematicCharacterController and the cars onto DynamicRayCastVehicleController.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {scene} from './engine.js';
import {solids} from './world.js';
import {player} from './player.js';
import {state} from './state.js';

// Rapier is loaded with a DYNAMIC import (inside initRapier) so Vite code-splits
// it into its own chunk — the ~2MB WASM is only fetched when ?phys is set, never
// in normal play. (When physics becomes always-on, switch to the non-compat
// @dimforge/rapier3d so the .wasm ships as a separate cacheable asset.)
let RAPIER=null;
let world=null;
let ready=false;
let cratesSpawned=false;
const dynamic=[];                  // [{body, mesh}] kept in sync each frame

// Big flat ground at y=0 + one fixed cuboid per `solids` AABB (the static city).
function buildStatic(){
  // Ground slab: top face at y=0 (the city street level). A heightfield that
  // follows groundHeight() is the next step; flat is correct for the city.
  world.createCollider(RAPIER.ColliderDesc.cuboid(2000,0.5,2000).setTranslation(0,-0.5,0));
  // Mirror the game's static collision volumes. solids are AABBs {x0,x1,z0,z1,h?};
  // h is the wall height (undefined = treat as a tall wall).
  for(const b of solids){
    if(b.x0===undefined)continue;            // skip anything that isn't an AABB
    const hx=Math.max(0.05,(b.x1-b.x0)/2);
    const hz=Math.max(0.05,(b.z1-b.z0)/2);
    const h=b.h!==undefined?b.h:30;          // finite stand-in for "infinitely tall"
    const cx=(b.x0+b.x1)/2, cz=(b.z0+b.z1)/2;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx,h/2,hz).setTranslation(cx,h/2,cz));
  }
}

// Drop a 3×3 stack of crates a few metres in front of the player, once, the first
// time physics runs while in-game — so they always land somewhere you can see.
function spawnCrates(){
  const p=player.g.position;
  const geo=new THREE.BoxGeometry(1.2,1.2,1.2);
  for(let i=0;i<9;i++){
    const ox=(i%3-1)*1.35, oz=Math.floor(i/3)*1.35+3;
    const x=p.x+ox, y=2+i*1.5, z=p.z+oz;
    const body=world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.6,0.6,0.6).setRestitution(0.15).setFriction(0.9),body);
    const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0xc8862e}));
    mesh.castShadow=true;mesh.receiveShadow=true;
    scene.add(mesh);
    dynamic.push({body,mesh});
  }
}

export async function initRapier(){
  try{
    RAPIER=await import('@dimforge/rapier3d-compat'); // separate async chunk
    await RAPIER.init();
    world=new RAPIER.World({x:0,y:-22,z:0});  // y-down gravity, game-scale (1u≈1m)
    buildStatic();
    ready=true;
    console.log('[rapier] ready — '+solids.length+' static colliders. Drop crates incoming (?phys).');
  }catch(e){
    console.warn('[rapier] init failed, game continues without physics:',e);
    ready=false;
  }
}

export function stepRapier(dt){
  if(!ready||!world)return;
  if(!cratesSpawned&&state.started){spawnCrates();cratesSpawned=true;}
  world.timestep=Math.min(dt,1/30);           // clamp like the rest of the loop
  world.step();
  for(const d of dynamic){
    const t=d.body.translation(), q=d.body.rotation();
    d.mesh.position.set(t.x,t.y,t.z);
    d.mesh.quaternion.set(q.x,q.y,q.z,q.w);
  }
}
