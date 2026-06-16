import * as THREE from 'three';
import {state} from './state.js';
import {camera,scene} from './engine.js';
import {player,playerPos,cameraRig} from './player.js';
import {message} from './hud.js';
import {blip} from './audio.js';
import {groundHeight} from './constants.js';
import {Interior} from './interior.js';
import {solids} from './world.js';
import {prison} from './prison.js';
import {TUNNEL_HOLE} from '../assets/models/city/prison.js';
import {tunnelGroup,TUNNEL_CENTER,TUNNEL_START,TUNNEL_GATE,TUNNEL_BOUNDS,
  FORT_BUTTON,FORT_EXIT,TUNNEL_SOLIDS,tunnelFx} from '../assets/models/city/escape-tunnel.js';
import {buildFlashlight} from '../assets/models/props/flashlight.js';

// ============================================================================
// JAILBREAK escape route:
//   prison open cell  -- hole -->  dirt tunnel  -- metal gate -->  fort
//   fort floor button -------------------------->  dirt tunnel  (and back)
// The tunnel is an off-map Interior (reusing the room toggle / camera-bounds / sky
// hiding); the transitions are custom STEP-ON proximity triggers (not the door
// system), so we pass dummy door coords to keep Interior.near() inert.
// ============================================================================

for(const s of TUNNEL_SOLIDS)solids.push(s);  // tunnel walls -> player collision

const tunnel=new Interior({
  group:tunnelGroup,bounds:TUNNEL_BOUNDS,center:TUNNEL_CENTER,
  door:{x:9999,z:9999},spawnOut:FORT_EXIT,intDoor:{x:9998,z:9998},intSpawn:TUNNEL_START,
  enterMsg:'',enterColor:'var(--cyan)',
});

// Spawn points sit a few units INTO the corridor (not right against the end wall) so
// the 3rd-person camera, which trails 6m behind, lands clear of the wall/ladder/gate
// instead of jammed inside them — and away from the return trigger so it won't re-fire.
const DROP_FROM_HOLE={x:TUNNEL_START.x+6,z:TUNNEL_CENTER.z};  // a few m east of the ladder
const DROP_FROM_FORT={x:TUNNEL_GATE.x-6,z:TUNNEL_CENTER.z};   // a few m west of the gate
const CLIMB_TO_CELL ={x:TUNNEL_HOLE.x,z:TUNNEL_HOLE.z-3};     // back in the cell, off the hole

let cd=0; // brief cooldown after any transition
const near=(p,t,r)=>Math.hypot(p.x-t.x,p.z-t.z)<r;

// Auto-equipped tunnel flashlight (lazily created, parked off until you're inside).
let flash=null; const _hand=new THREE.Vector3(),_dir=new THREE.Vector3();
function updateFlashlight(){
  if(!flash){flash=buildFlashlight();flash.visible=false;scene.add(flash);}
  const on=state.interior===tunnel;
  flash.visible=on;
  flash.userData.light.intensity=on?40:0;          // off everywhere but the tunnel
  if(!on)return;
  // Hold it at the right hand (chest height, a touch forward) and aim it where you look,
  // so the beam lights the corridor in both first- and third-person.
  const p=player.g.position,h=player.heading;
  _hand.set(p.x+Math.cos(h)*.26+Math.sin(h)*.22, p.y+1.18, p.z-Math.sin(h)*.26+Math.cos(h)*.22);
  flash.position.copy(_hand);
  camera.getWorldDirection(_dir);
  flash.lookAt(_hand.x+_dir.x,_hand.y+_dir.y,_hand.z+_dir.z);
}

export function updateJailBreak(dt){
  if(cd>0)cd-=dt;
  // glow pulses (cheap, always)
  const t=state.time;
  if(tunnelFx.buttonGlow)tunnelFx.buttonGlow.material.opacity=.6+.3*Math.sin(t*3);
  if(tunnelFx.gateGlow)tunnelFx.gateGlow.material.opacity=.6+.3*Math.sin(t*4);
  if(tunnelFx.bulbs)for(const b of tunnelFx.bulbs)            // gentle bulb/lantern flicker
    b.m.material.opacity=b.base-.18*Math.abs(Math.sin(t*b.sp+b.ph)*Math.sin(t*b.sp*.37));
  updateFlashlight();                                          // follows hand / aims at view
  if(state.mode!=='foot'||cd>0)return;
  const pp=playerPos();

  // 1) prison open-cell hole -> drop into the tunnel
  if(state.interior===prison&&near(pp,TUNNEL_HOLE,1.5)){
    arrive(()=>tunnel.enterAt(DROP_FROM_HOLE,Math.PI/2),
      'YOU SLIP INTO A DUG TUNNEL',[180,140,110]);
    return;
  }
  if(state.interior===tunnel){
    // 2) reach the WEST end (ladder) -> climb up into the cell. Plane across the whole
    // corridor width so you can't squeeze past it.
    if(pp.x<TUNNEL_START.x+1.7){
      arrive(()=>prison.enterAt(CLIMB_TO_CELL,-Math.PI/2),
        'YOU CLIMB BACK INTO THE CELL',[110,140,180]);
      return;
    }
    // 3) reach the EAST end (metal gate) -> surface at the fort
    if(pp.x>TUNNEL_GATE.x-1.7){
      arrive(()=>{tunnel.leave();teleportWorld(FORT_EXIT.x,FORT_EXIT.z,0);},
        'THE GATE OPENS — YOU SURFACE AT THE FORT','var(--gold)',[330,440,587]);
      return;
    }
  }
  // 4) fort floor button -> drop into the tunnel (at the gate end)
  if(!state.interior&&near(pp,FORT_BUTTON,1.7)){
    arrive(()=>tunnel.enterAt(DROP_FROM_FORT,-Math.PI/2),
      'A HATCH OPENS — DOWN INTO THE TUNNEL',[180,140,110]);
  }
}

function arrive(fn,msg,colorOrBlip,maybeBlip){
  const color=typeof colorOrBlip==='string'?colorOrBlip:'var(--cyan)';
  const tones=maybeBlip||(Array.isArray(colorOrBlip)?colorOrBlip:[180,140,110]);
  cd=1.2;
  fn();
  message(msg,color);
  blip(tones,.1,'square',.15);
}

// Teleport to a WORLD (exterior) spot, snapping the camera so it doesn't lerp across
// the whole map (same idea as Interior.teleport, but to an arbitrary outdoor point).
function teleportWorld(x,z,h){
  player.g.position.set(x,groundHeight(x,z),z);
  player.heading=h;player.g.rotation.y=h;cameraRig.yaw=h;
  camera.position.set(x-Math.sin(h)*6,3,z-Math.cos(h)*6);
}
