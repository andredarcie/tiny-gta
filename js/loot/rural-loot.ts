import * as THREE from 'three';
import {state} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {playerPos} from '@/actors/player.ts';
import {economy} from '@/core/economy.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {groundHeight} from '@/core/constants.ts';
import {byId} from '@/combat/weapon-catalog.ts';
import {pickupArsenalWeapon} from '@/combat/weapons.ts';
import {makeMoneyDrop} from '../../assets/models/missions/money-drop.ts';
import {MiniGame} from '@/activities/minigame.ts';

// HIDDEN RURAL LOOT — weapon caches and cash stashes tucked AROUND the rural city
// (Pine Hollow) and along the peninsula approach: behind trees, by the derelict
// houses, on the village outskirts. No map/radar blip (discoveries, open-world
// style). Touch on foot to collect; each respawns after a cooldown so the area
// stays worth re-exploring. Same spin/bob/cull idea as js/combat/weapon-pickups.ts.

const PICK_R=2.8;          // collection radius (on foot)
const RESPAWN_CD=60;       // seconds before a collected weapon cache reappears
const CASH_RESPAWN_CD=120; // cash stashes take twice as long to reappear (anti-farm)
const LOOT_DECAY=0.5;      // each rapid re-collection of a cash stash pays HALF the last
const LOOT_MIN_MUL=0.1;    // ...down to a 10% floor, so a circular farm dwindles to scraps
const LOOT_RECOVER=240;    // seconds away from a stash before it pays full value again
const GUN_SCALE=1.3;
const ANIM2=80*80;         // beyond this distance: no spin/bob and no collection

// a collectible salted in the world: either a weapon cache or a cash stash
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
  takes: number;    // how many times collected without a long break (cash diminishing)
  decayT: number;   // state.time of the last collection (recovers after LOOT_RECOVER)
}

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

const items: LootItem[]=[];
for(const s of GUNS){
  const w=byId[s.id];
  if(!w||!w.makeModel)continue;
  const g=w.makeModel({pickup:true});
  g.scale.setScalar(GUN_SCALE);
  const baseY=groundHeight(s.x,s.z)+1.0;
  g.position.set(s.x,baseY,s.z);
  scene.add(g);
  items.push({kind:'gun',id:s.id,name:w.name,x:s.x,z:s.z,baseY,g,active:true,respawnAt:0,takes:0,decayT:0});
}
for(const s of CASH){
  const g=makeMoneyDrop();
  const baseY=groundHeight(s.x,s.z)+0.6;
  g.position.set(s.x,baseY,s.z);
  scene.add(g);
  items.push({kind:'cash',val:s.val,x:s.x,z:s.z,baseY,g,active:true,respawnAt:0,takes:0,decayT:0});
}

export function updateRuralLoot(dt: number): void{
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
        // Diminishing returns: looting the SAME stash again and again (the "walk in a
        // circle" money farm) pays half each time down to a floor; the value only
        // recovers to full after staying away LOOT_RECOVER seconds. A genuine re-explore
        // (long gap) still pays out properly.
        if(state.time-p.decayT>LOOT_RECOVER)p.takes=0; // long gap → fresh again
        const mul=Math.max(LOOT_MIN_MUL,Math.pow(LOOT_DECAY,p.takes));
        const cash=Math.max(1,Math.round(p.val!*mul));
        p.takes++;p.decayT=state.time;
        economy.earn(cash,'loot');
        message(mul<1?'PICKED-OVER STASH +$'+cash:'HIDDEN CASH +$'+cash,mul<1?'var(--cream)':'var(--gold)');
        blip([660,880,1175],0.08,'square',.16);
      }
      p.active=false;
      p.respawnAt=state.time+(p.kind==='cash'?CASH_RESPAWN_CD:RESPAWN_CD);
      if(p.g.parent)scene.remove(p.g);
    }
  }
}
