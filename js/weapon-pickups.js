import {state,refs} from './state.js';
import {scene} from './engine.js';
import {playerPos} from './player.js';
import {message,bigText,hideBig} from './hud.js';
import {blip} from './audio.js';
import {groundHeight} from './constants.js';
import {byId} from './weapon-catalog.js';
import {pickupArsenalWeapon} from './weapons.js';
import {MiniGame} from './minigame.js';

// HIDDEN WEAPONS — the 12 possible weapons (the whole ARSENAL, i.e. everything
// but the fist) hidden in out-of-the-way corners of the map for the player to
// find on foot. No map/radar blip on purpose: they are discoveries, GTA-style.
// Touching one grants that weapon (and always refills its ammo, so it doubles as
// an ammo crate); it then respawns after a cooldown so it stays useful.

const PICK_R=2.8;          // pickup radius (on foot)
const RESPAWN_CD=45;       // seconds before a collected pickup reappears
const SCALE=1.3;           // floating model scale (uniform, for visibility)
const ANIM2=72*72;         // beyond this distance: skip spin/bob AND collection

// One spot per weapon, tucked on the coastline ring (beach sand) and out in the
// rural peninsula — open terrain (no buildings to clip into). Lighter weapons sit
// closer to the city; the heavy hitters are far out east. Avoids the spots used
// by the stunt ramps, car crusher, bomb shop and the rocket-rampage pickup.
const SPOTS=[
  {id:'bat',       x:-45,  z: 200},  // south beach
  {id:'pistol',    x: 20,  z: 201},  // south beach
  {id:'ak47',      x: 15,  z:-201},  // north beach
  {id:'m16',       x: 135, z:-199},  // north beach (east)
  {id:'uzi',       x:-201, z:-130},  // west beach
  {id:'shotgun',   x:-201, z: 150},  // west beach
  {id:'detonator', x: 200, z: 105},  // rural, near the city mouth
  {id:'grenade',   x: 215, z: -95},  // rural south
  {id:'molotov',   x: 255, z:  90},  // rural north
  {id:'flame',     x: 300, z:-100},  // rural deep east
  {id:'sniper',    x: 330, z:  65},  // rural far east (long-range, fitting)
  {id:'rocket',    x: 360, z: -60},  // rural far east
];

const pickups=[];
for(const s of SPOTS){
  const w=byId[s.id];
  if(!w||!w.makeModel)continue;
  const g=w.makeModel({pickup:true});
  g.scale.setScalar(SCALE);
  const baseY=groundHeight(s.x,s.z)+1.0;
  g.position.set(s.x,baseY,s.z);
  scene.add(g);
  pickups.push({id:s.id,name:w.name,x:s.x,z:s.z,baseY,g,active:true,respawnAt:0});
}

// debug snapshot
refs.getWeaponPickupsState=()=>({
  total:pickups.length,
  available:pickups.filter(p=>p.active).length,
});

export function updateWeaponPickups(dt){
  const pp=playerPos();
  const onFoot=state.mode==='foot'&&!state.swimming;
  const r2=PICK_R*PICK_R;
  for(let k=0;k<pickups.length;k++){
    const p=pickups[k];
    if(!p.active){
      // collected: wait out the cooldown, then put it back in the world
      if(state.time>=p.respawnAt){
        p.active=true;
        if(!p.g.parent)scene.add(p.g);
      }
      continue;
    }
    const dx=pp.x-p.x,dz=pp.z-p.z,d2=dx*dx+dz*dz;
    if(d2>ANIM2)continue;          // too far: no animation, no collection
    // spin + bob to make it readable once you are close
    p.g.rotation.y+=1.8*dt;
    p.g.position.y=p.baseY+Math.sin(state.time*2.6+k)*0.16;
    // collect on foot only (you can't hold a weapon while driving/swimming).
    // Suppressed during an exclusive mini-game session, like hidden packages.
    if(onFoot&&!MiniGame.busy&&d2<r2){
      const isNew=pickupArsenalWeapon(p.id);
      p.active=false;
      p.respawnAt=state.time+RESPAWN_CD;
      if(p.g.parent)scene.remove(p.g);
      if(isNew){
        bigText('NEW WEAPON','var(--gold)');
        message('FOUND '+p.name,'var(--gold)');
        blip([660,990,1320],0.09,'square',.18);
        setTimeout(hideBig,1200);
      }else{
        message(p.name+' - AMMO REFILLED','var(--cyan)');
        blip([660,990],0.07,'sine',.16);
      }
    }
  }
}
