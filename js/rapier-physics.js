// ---------------------------------------------------------------------------
// Rapier physics — STEP 2: heightfield terrain + character & vehicle controllers.
//
// Still 100% additive and opt-in via ?phys. The game's own collision
// (js/physics.js) and the real player/cars are UNTOUCHED. To let you feel all
// three Rapier systems without rewiring the shipped controls, the demo spawns
// AUTONOMOUS agents next to you that you can watch (and walk up to with the
// normal player):
//
//   1. Heightfield ground sampled from groundHeight() — the real terrain, so
//      bodies roll/walk over the actual hills (replaces the step-1 flat plane).
//   2. A self-driving car on a DynamicRayCastVehicleController (raycast wheels +
//      suspension) — drives lazy circles, leaning on its springs.
//   3. A strolling capsule on a KinematicCharacterController — walks a slow patrol,
//      snapping to the ground and auto-stepping kerbs/slopes.
//   + the step-1 crates still drop and pile against the street/buildings.
//
// Each subsystem is independently guarded: if the vehicle (the fiddliest API)
// fails, the heightfield, character and crates still run. Rapier loads via a
// dynamic import() so its ~2MB WASM chunk is only fetched under ?phys.
//
// NEXT: once the feel is right, move the SHIPPED player onto the character
// controller and the SHIPPED cars onto the vehicle controller (replacing
// updateFoot/updateCar), and switch to non-compat @dimforge/rapier3d so the
// .wasm ships as a separate cacheable asset.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import {scene} from './engine.js';
import {solids} from './world.js';
import {player} from './player.js';
import {state} from './state.js';
import {groundHeight} from './constants.js';

let RAPIER=null;
let world=null;
let ready=false;
let spawned=false;
let t=0;                                   // demo time accumulator (no Date/random)

const dynamic=[];                          // crates [{body,mesh}]
let vehicle=null, vBody=null, vMesh=null;  // self-driving car
let charBody=null, charCol=null, charCtl=null, charMesh=null, charDir=0;

// ---- Heightfield: sample groundHeight() over the main map -------------------
// Column-major heights[r + c*NR]; rows map to local X, cols to local Z. The city
// is flat (~0) so the demo near spawn is correct regardless; if the rural HILLS
// look transposed/shifted, it's this row/col->axis choice — a one-line swap.
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
  const scale={x:x1-x0,y:1,z:z1-z0};
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(nr,nc,heights,scale)
      .setTranslation((x0+x1)/2,0,(z0+z1)/2));
}

// ---- Static city: one fixed cuboid per solids AABB -------------------------
function buildStatic(){
  try{buildHeightfield();}
  catch(e){ // fall back to a flat slab so the demo still has a floor
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

function spawnCrates(px,pz,gy){
  const geo=new THREE.BoxGeometry(1.2,1.2,1.2);
  for(let i=0;i<9;i++){
    const ox=(i%3-1)*1.35, oz=Math.floor(i/3)*1.35+3;
    const body=world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(px+ox,gy+2+i*1.5,pz+oz));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.6,0.6,0.6).setRestitution(0.15).setFriction(0.9),body);
    const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:0xc8862e}));
    mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
    dynamic.push({body,mesh});
  }
}

// A self-driving raycast vehicle: dynamic chassis + 4 ray wheels.
function spawnVehicle(px,pz,gy){
  vBody=world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(px-6,gy+1.2,pz+4).setLinearDamping(0.15).setAngularDamping(0.3));
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(0.9,0.35,1.8).setDensity(2),vBody);
  vehicle=world.createVehicleController(vBody);
  const down={x:0,y:-1,z:0}, axle={x:1,y:0,z:0}, rest=0.32, radius=0.38;
  for(const[wx,wz]of[[-0.8,1.3],[0.8,1.3],[-0.8,-1.3],[0.8,-1.3]]){
    vehicle.addWheel({x:wx,y:-0.2,z:wz},down,axle,rest,radius);
  }
  for(let i=0;i<4;i++){
    if(vehicle.setWheelSuspensionStiffness)vehicle.setWheelSuspensionStiffness(i,24);
    if(vehicle.setWheelMaxSuspensionTravel)vehicle.setWheelMaxSuspensionTravel(i,0.3);
    if(vehicle.setWheelFrictionSlip)vehicle.setWheelFrictionSlip(i,2.0);
  }
  // simple visual: chassis box + 4 wheel cylinders parented to it
  vMesh=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(1.8,0.7,3.6),
    new THREE.MeshLambertMaterial({color:0x2e6cc8}));
  body.castShadow=true;vMesh.add(body);
  const wGeo=new THREE.CylinderGeometry(0.38,0.38,0.3,12);
  for(const[wx,wz]of[[-0.9,1.3],[0.9,1.3],[-0.9,-1.3],[0.9,-1.3]]){
    const w=new THREE.Mesh(wGeo,new THREE.MeshLambertMaterial({color:0x111111}));
    w.rotation.z=Math.PI/2;w.position.set(wx,-0.35,wz);vMesh.add(w);
  }
  scene.add(vMesh);
}

// A strolling kinematic capsule on a character controller.
function spawnCharacter(px,pz,gy){
  charBody=world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(px+5,gy+1.2,pz+4));
  charCol=world.createCollider(RAPIER.ColliderDesc.capsule(0.6,0.4),charBody);
  charCtl=world.createCharacterController(0.05);
  charCtl.setUp({x:0,y:1,z:0});
  charCtl.enableAutostep(0.5,0.3,true);
  charCtl.enableSnapToGround(0.5);
  charCtl.setMaxSlopeClimbAngle(50*Math.PI/180);
  charMesh=new THREE.Mesh(new THREE.CapsuleGeometry(0.4,1.2,6,12),
    new THREE.MeshLambertMaterial({color:0x19e3ff}));
  charMesh.castShadow=true;scene.add(charMesh);
}

function spawnDemo(){
  const p=player.g.position, gy=groundHeight(p.x,p.z);
  try{spawnCrates(p.x,p.z,gy);}catch(e){console.warn('[rapier] crates failed:',e);}
  try{spawnVehicle(p.x,p.z,gy);}catch(e){console.warn('[rapier] vehicle failed:',e);vehicle=null;}
  try{spawnCharacter(p.x,p.z,gy);}catch(e){console.warn('[rapier] character failed:',e);charCtl=null;}
}

export async function initRapier(){
  try{
    RAPIER=await import('@dimforge/rapier3d-compat'); // separate async chunk
    await RAPIER.init();
    world=new RAPIER.World({x:0,y:-22,z:0});
    buildStatic();
    ready=true;
    console.log('[rapier] ready — heightfield + '+solids.length+' static colliders. Demo spawns in-game (?phys).');
  }catch(e){
    console.warn('[rapier] init failed, game continues without physics:',e);
    ready=false;
  }
}

export function stepRapier(dt){
  if(!ready||!world)return;
  if(!spawned&&state.started){spawnDemo();spawned=true;}
  t+=dt;

  // drive the autonomous car: constant throttle on the rear wheels, weaving steer
  if(vehicle){
    try{
      const steer=Math.sin(t*0.5)*0.35;
      vehicle.setWheelSteering(0,steer);vehicle.setWheelSteering(1,steer);
      vehicle.setWheelEngineForce(2,900);vehicle.setWheelEngineForce(3,900);
      vehicle.updateVehicle(dt);
    }catch(e){console.warn('[rapier] vehicle step failed:',e);vehicle=null;}
  }

  // stroll the capsule: slowly turning walk, gravity pulls it onto the ground
  if(charCtl&&charBody){
    try{
      charDir+=dt*0.5;
      const sp=2.4;
      const desired={x:Math.cos(charDir)*sp*dt,y:-9.81*dt,z:Math.sin(charDir)*sp*dt};
      charCtl.computeColliderMovement(charCol,desired);
      const m=charCtl.computedMovement(), pos=charBody.translation();
      charBody.setNextKinematicTranslation({x:pos.x+m.x,y:pos.y+m.y,z:pos.z+m.z});
    }catch(e){console.warn('[rapier] character step failed:',e);charCtl=null;}
  }

  world.timestep=Math.min(dt,1/30);
  world.step();

  for(const d of dynamic){
    const tr=d.body.translation(), q=d.body.rotation();
    d.mesh.position.set(tr.x,tr.y,tr.z);d.mesh.quaternion.set(q.x,q.y,q.z,q.w);
  }
  if(vBody&&vMesh){
    const tr=vBody.translation(), q=vBody.rotation();
    vMesh.position.set(tr.x,tr.y,tr.z);vMesh.quaternion.set(q.x,q.y,q.z,q.w);
  }
  if(charBody&&charMesh){
    const tr=charBody.translation();
    charMesh.position.set(tr.x,tr.y,tr.z);
  }
}
