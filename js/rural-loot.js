import {state} from './state.js';
import {scene} from './engine.js';
import {playerPos} from './player.js';
import {economy} from './economy.js';
import {message,bigText,hideBig} from './hud.js';
import {blip} from './audio.js';
import {groundHeight} from './constants.js';
import {byId} from './weapon-catalog.js';
import {pickupArsenalWeapon} from './weapons.js';
import {makeMoneyDrop} from '../assets/models/missions/money-drop.js';
import {MiniGame} from './minigame.js';

// HIDDEN RURAL LOOT — weapon caches and cash stashes tucked AROUND the rural city
// (Pine Hollow) and along the peninsula approach: behind trees, by the derelict
// houses, on the village outskirts. No map/radar blip (discoveries, open-world
// style). Touch on foot to collect; each respawns after a cooldown so the area
// stays worth re-exploring. Same spin/bob/cull idea as js/weapon-pickups.js.

const PICK_R=2.8;          // collection radius (on foot)
const RESPAWN_CD=60;       // seconds before a collected stash reappears
const GUN_SCALE=1.3;
const ANIM2=80*80;         // beyond this distance: no spin/bob and no collection

// weapon caches (reuse arsenal ids — independent of the global hidden weapons)
const GUNS=[
  {id:'shotgun', x:584, z: 72},  // north-west of the village
  {id:'uzi',     x:716, z: 48},  // north-east outskirts
  {id:'sniper',  x:470, z: 60},  // west approach (long sightline)
  {id:'grenade', x:700, z: 86},  // north outskirts
  {id:'pistol',  x:430, z: 40},  // west pasture, on the way in
];
// cash stashes {x,z,val}
const CASH=[
  {x:590, z:-44, val:140},  // south of the village
  {x:716, z: 36, val:180},  // north-east
  {x:646, z: 98, val:120},  // north field
  {x:732, z:-22, val:200},  // peninsula tip approach
  {x:476, z:-66, val:160},  // by the abandoned hamlet
  {x:540, z:-72, val:130},  // edge of the derelict houses
];

const items=[];
for(const s of GUNS){
  const w=byId[s.id];
  if(!w||!w.makeModel)continue;
  const g=w.makeModel({pickup:true});
  g.scale.setScalar(GUN_SCALE);
  const baseY=groundHeight(s.x,s.z)+1.0;
  g.position.set(s.x,baseY,s.z);
  scene.add(g);
  items.push({kind:'gun',id:s.id,name:w.name,x:s.x,z:s.z,baseY,g,active:true,respawnAt:0});
}
for(const s of CASH){
  const g=makeMoneyDrop();
  const baseY=groundHeight(s.x,s.z)+0.6;
  g.position.set(s.x,baseY,s.z);
  scene.add(g);
  items.push({kind:'cash',val:s.val,x:s.x,z:s.z,baseY,g,active:true,respawnAt:0});
}

export function updateRuralLoot(dt){
  const pp=playerPos();
  const onFoot=state.mode==='foot'&&!state.swimming;
  const r2=PICK_R*PICK_R;
  for(let k=0;k<items.length;k++){
    const p=items[k];
    if(!p.active){
      if(state.time>=p.respawnAt){p.active=true;if(!p.g.parent)scene.add(p.g);}
      continue;
    }
    const dx=pp.x-p.x,dz=pp.z-p.z,d2=dx*dx+dz*dz;
    if(d2>ANIM2)continue;          // too far: no animation, no collection
    p.g.rotation.y+=1.8*dt;
    p.g.position.y=p.baseY+Math.sin(state.time*2.6+k)*0.16;
    if(onFoot&&!MiniGame.busy&&d2<r2){
      if(p.kind==='gun'){
        const isNew=pickupArsenalWeapon(p.id);
        if(isNew){
          bigText('NEW WEAPON','var(--gold)');
          message('FOUND '+p.name,'var(--gold)');
          blip([660,990,1320],0.09,'square',.18);
          setTimeout(hideBig,1200);
        }else{
          message(p.name+' - AMMO REFILLED','var(--cyan)');
          blip([660,990],0.07,'sine',.16);
        }
      }else{
        economy.earn(p.val,'loot');
        message('HIDDEN CASH +$'+p.val,'var(--gold)');
        blip([660,880,1175],0.08,'square',.16);
      }
      p.active=false;
      p.respawnAt=state.time+RESPAWN_CD;
      if(p.g.parent)scene.remove(p.g);
    }
  }
}
