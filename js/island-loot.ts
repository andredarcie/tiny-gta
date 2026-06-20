import * as THREE from 'three';
import {state} from './state.js';
import {scene} from './engine.js';
import {playerPos} from './player.js';
import {economy} from './economy.js';
import {message,bigText,hideBig} from './hud.js';
import {blip} from './audio.js';
import {groundHeight,ISLAND_CX,ISLAND_CZ} from './constants.js';
import {byId} from './weapon-catalog.js';
import {pickupArsenalWeapon} from './weapons.js';
import {makeMoneyDrop} from '../assets/models/missions/money-drop.js';
import {MiniGame} from './minigame.js';

// HIDDEN ISLAND LOOT — a secret cache of heavy weapons and fat cash stashes salted
// across the paradise island far to the west (ISLAND_CX/CZ). No map/radar blip: you
// only find it by sailing/flying out there and exploring on foot. Bigger payouts
// than the rural stashes (js/rural-loot.js) because reaching the island is the cost.
// Same spin/bob/cull/respawn idea as rural-loot.js / weapon-pickups.js.

const PICK_R=2.8;          // collection radius (on foot)
const RESPAWN_CD=90;       // seconds before a collected stash reappears (longer: it's a trek)
const GUN_SCALE=1.3;
const ANIM2=80*80;         // beyond this distance: no spin/bob and no collection

// a collectible salted on the island: either a weapon cache or a cash stash
interface LootItem{
  kind: 'gun'|'cash';
  id?: string;
  name?: string;
  val?: number;
  x: number;
  z: number;
  baseY: number;
  g: THREE.Object3D;
  active: boolean;
  respawnAt: number;
}

// All spots sit well inside the island coast (radius ~70 from the centre) so the
// model always lands on island ground, not in the surf.
// heavy-weapon caches (reuse arsenal ids — independent of the global hidden weapons)
const GUNS=[
  {id:'rocket', x:ISLAND_CX-32, z:ISLAND_CZ+14},  // west shore stash
  {id:'flame',  x:ISLAND_CX+30, z:ISLAND_CZ-26},  // south-east cove
  {id:'sniper', x:ISLAND_CX+4,  z:ISLAND_CZ+48},  // north ridge (long sightline)
  {id:'m16',    x:ISLAND_CX-34, z:ISLAND_CZ-44},  // south-west thicket
];
// cash stashes {x,z,val} — the centrepiece is a fortune on the very peak
const CASH=[
  {x:ISLAND_CX,    z:ISLAND_CZ,    val:500}, // buried treasure on top of the island hill
  {x:ISLAND_CX+18, z:ISLAND_CZ+24, val:240}, // north-east slope
  {x:ISLAND_CX-22, z:ISLAND_CZ,    val:280}, // west side
  {x:ISLAND_CX+8,  z:ISLAND_CZ-30, val:300}, // south beach
];

const items: LootItem[]=[];
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

export function updateIslandLoot(dt: number): void{
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
        economy.earn(p.val!,'loot');
        message('ISLAND TREASURE +$'+p.val,'var(--gold)');
        blip([660,880,1175],0.08,'square',.16);
      }
      p.active=false;
      p.respawnAt=state.time+RESPAWN_CD;
      if(p.g.parent)scene.remove(p.g);
    }
  }
}
