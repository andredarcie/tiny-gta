import * as THREE from 'three';
import {state} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {playerPos} from '@/actors/player.ts';
import {economy} from '@/core/economy.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {groundHeight} from '@/core/constants.ts';
import {divData,DIV_OX,DIV_OZ} from '@/world/divinolandia/data.ts';
import {byId} from '@/combat/weapon-catalog.ts';
import {pickupArsenalWeapon} from '@/combat/weapons.ts';
import {makeMoneyDrop} from '../../assets/models/missions/money-drop.ts';
import {MiniGame} from '@/activities/minigame.ts';

// HIDDEN SERRA LOOT — a secret cache of heavy weapons and fat cash stashes salted round
// the top of the Morro da Torre, the 1380 m hill two kilometres south of Divinolândia.
// No map/radar blip: you only find it by climbing (or flying) up there and exploring on
// foot. Fat payouts, since the climb is the cost. Same spin/bob/cull/respawn idea as
// weapon-pickups.ts.
const SX=divData.landmarks.torre[0]+DIV_OX,SZ=divData.landmarks.torre[1]+DIV_OZ;

const PICK_R=2.8;          // collection radius (on foot)
const RESPAWN_CD=90;       // seconds before a collected stash reappears (longer: it's a trek)
const GUN_SCALE=1.3;
const ANIM2=80*80;         // beyond this distance: no spin/bob and no collection

// a collectible salted on the hilltop: either a weapon cache or a cash stash
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

// All spots are on the hilltop and its upper slopes, clear of the tower and its deck.
// heavy-weapon caches (reuse arsenal ids — independent of the global hidden weapons)
const GUNS=[
  {id:'rocket', x:SX-32, z:SZ+14},  // west slope
  {id:'flame',  x:SX+30, z:SZ-26},  // south-east hollow
  {id:'sniper', x:SX+4,  z:SZ+48},  // north ridge, looking down on the town
  {id:'m16',    x:SX-34, z:SZ-44},  // south-west scrub
];
// cash stashes {x,z,val} — the centrepiece is a fortune right by the summit
const CASH=[
  {x:SX+12, z:SZ+12, val:500}, // by the tower on the summit
  {x:SX+18, z:SZ+34, val:240}, // north-east slope
  {x:SX-22, z:SZ,    val:280}, // west side
  {x:SX+8,  z:SZ-30, val:300}, // south shoulder
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
        message('SERRA TREASURE +$'+p.val,'var(--gold)');
        blip([660,880,1175],0.08,'square',.16);
      }
      p.active=false;
      p.respawnAt=state.time+RESPAWN_CD;
      if(p.g.parent)scene.remove(p.g);
    }
  }
}
