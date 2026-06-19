// ---------------------------------------------------------------------------
// Rapier physics — drivable wooden crate stack (opt-in via ?phys).
//
// Still 100% additive: the game's own collision (js/physics.js) and the shipped
// player/cars are UNTOUCHED. Next to the player's spawn it drops a stack of
// wooden crates (dynamic rigid bodies). A KINEMATIC proxy mirrors whatever the
// player is controlling each frame — the car when driving, the body on foot — so
// ramming the stack with a car (or walking into it) sends the crates flying,
// without rewiring the real car/foot controls.
//
// The static world is mirrored in too: a heightfield from groundHeight() plus one
// fixed collider per `solids` AABB, so the scattered crates settle on the real
// street and pile against buildings. Rapier loads via dynamic import() so its
// ~2MB WASM chunk is only fetched under ?phys; the normal bundle is unaffected.
//
// (The autonomous self-driving car / strolling capsule from the previous step are
// gone — they would have ploughed this stack themselves. They live on in git;
// the heightfield + character/vehicle controllers can come back alongside.)
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {scene} from './engine.js';
import {solids} from './world.js';
import {player,cur} from './player.js';
import {state} from './state.js';
import {groundHeight} from './constants.js';

let RAPIER=null;
let world=null;
let ready=false;
let spawned=false;

const crates=[];                  // [{body,mesh}] wooden crates, synced each frame
let carProxy=null, footProxy=null; // kinematic stand-ins for the player's car / body

// ---- Heightfield ground sampled from groundHeight() over the main map -------
// Column-major heights[r + c*NR]; rows->local X, cols->local Z. The flat city is
// correct regardless; rural hills may need a one-line row/col swap.
const HF={x0:-420,x1:770,z0:-300,z1:300,nr:200,nc:100};
function buildHeightfield(){
  const {x0,x1,z0,z1,nr,nc}=HF;
  const heights=new Float32Array(nr*nc);
  for(let c=0;c<nc;c++){
    const z=z0+(c/(nc-1))*(z1-z0);
    for(let r=0;r<nr;r++){
      const x=x0+(r/(nr-1))*(x1-x0);
      heights[r+c*nr]=groundHeight(x,z);
    }
  }
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(nr,nc,heights,{x:x1-x0,y:1,z:z1-z0})
      .setTranslation((x0+x1)/2,0,(z0+z1)/2));
}

function buildStatic(){
  try{buildHeightfield();}
  catch(e){
    console.warn('[rapier] heightfield failed, using flat ground:',e);
    world.createCollider(RAPIER.ColliderDesc.cuboid(2000,0.5,2000).setTranslation(0,-0.5,0));
  }
  for(const b of solids){
    if(b.x0===undefined)continue;
    const hx=Math.max(0.05,(b.x1-b.x0)/2), hz=Math.max(0.05,(b.z1-b.z0)/2);
    const h=b.h!==undefined?b.h:30, cx=(b.x0+b.x1)/2, cz=(b.z0+b.z1)/2;
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx,h/2,hz).setTranslation(cx,h/2,cz));
  }
}

// A pyramid of wooden crates (3x3 base -> 2x2 -> 1 = 14 crates), light enough to
// scatter satisfyingly when a car drives through.
function spawnCrateStack(cx,cz,gy){
  const S=1.1;
  const woodMat=new THREE.MeshLambertMaterial({color:0x8a5a2b});
  const geo=new THREE.BoxGeometry(S,S,S);
  const edges=new THREE.EdgesGeometry(geo);
  const edgeMat=new THREE.LineBasicMaterial({color:0x3a2410}); // plank/frame lines
  const layers=[3,2,1];
  for(let L=0;L<layers.length;L++){
    const n=layers[L], y=gy+S/2+L*S;
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){
      const x=cx+(i-(n-1)/2)*S*1.02, z=cz+(j-(n-1)/2)*S*1.02;
      const body=world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z));
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(S/2*0.97,S/2*0.97,S/2*0.97).setFriction(0.7).setDensity(0.35),body);
      const mesh=new THREE.Mesh(geo,woodMat);
      mesh.castShadow=mesh.receiveShadow=true;
      mesh.add(new THREE.LineSegments(edges,edgeMat));
      scene.add(mesh);
      crates.push({body,mesh});
    }
  }
}

function makeProxy(hx,hy,hz){
  const b=world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0,-1000,0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(hx,hy,hz),b);
  return b;
}
function driveProxy(b,obj,yOff){
  const p=obj.position, q=obj.quaternion;
  b.setNextKinematicTranslation({x:p.x,y:p.y+yOff,z:p.z});
  b.setNextKinematicRotation({x:q.x,y:q.y,z:q.z,w:q.w});
}
const parkProxy=b=>b.setNextKinematicTranslation({x:0,y:-1000,z:0});

function spawnDemo(){
  const p=player.g.position, gy=groundHeight(p.x,p.z);
  spawnCrateStack(p.x+6,p.z,gy);     // beside the spawn point
  carProxy=makeProxy(0.95,0.6,2.0);  // ~a car
  footProxy=makeProxy(0.45,0.9,0.45);// ~a person
}

export async function initRapier(){
  try{
    RAPIER=await import('@dimforge/rapier3d-compat'); // separate async chunk
    await RAPIER.init();
    world=new RAPIER.World({x:0,y:-22,z:0});
    buildStatic();
    ready=true;
    console.log('[rapier] ready — heightfield + '+solids.length+' static colliders; crate stack spawns in-game (?phys).');
  }catch(e){
    console.warn('[rapier] init failed, game continues without physics:',e);
    ready=false;
  }
}

export function stepRapier(dt){
  if(!ready||!world)return;
  if(!spawned&&state.started){spawnDemo();spawned=true;}
  if(spawned){
    // the kinematic proxy follows whatever the player controls, so driving (or
    // walking) into the stack pushes the dynamic crates.
    if(cur){driveProxy(carProxy,cur.g,0.6);parkProxy(footProxy);}
    else{driveProxy(footProxy,player.g,1.0);parkProxy(carProxy);}
  }
  world.timestep=Math.min(dt,1/30);
  world.step();
  for(const d of crates){
    const tr=d.body.translation(), q=d.body.rotation();
    d.mesh.position.set(tr.x,tr.y,tr.z);
    d.mesh.quaternion.set(q.x,q.y,q.z,q.w);
  }
}
