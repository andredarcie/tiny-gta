import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {playerPos} from '@/actors/player.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {groundHeight} from '@/core/constants.ts';
import {roadside} from '@/world/divinolandia/nav.ts';
import {byId} from '@/combat/weapon-catalog.ts';
import {pickupArsenalWeapon} from '@/combat/weapons.ts';
import {MiniGame} from '@/activities/minigame.ts';

// HIDDEN WEAPONS — the 12 possible weapons (the whole ARSENAL, i.e. everything
// but the fist) hidden in out-of-the-way corners of the map for the player to
// find on foot. No map/radar blip on purpose: they are discoveries, open-world-style.
// Touching one grants that weapon (and always refills its ammo, so it doubles as
// an ammo crate); it then respawns after a cooldown so it stays useful.

const PICK_R=2.8;          // pickup radius (on foot)
const RESPAWN_CD=45;       // seconds before a collected pickup reappears
const SCALE=1.3;           // floating model scale (uniform, for visibility)
const ANIM2=72*72;         // beyond this distance: skip spin/bob AND collection

// One spot per weapon, a few metres off a street or dirt road (nav.roadside, town-local
// coordinates): the light ones in and around the town, the heavy hitters out in the
// countryside and up the serra.
const SPOTS:{id:string;x:number;z:number}[]=([
  ['bat',-180,40],['pistol',150,140],['ak47',380,-300],['m16',-420,-120],
  ['uzi',600,250],['shotgun',-40,-330],['detonator',900,80],['grenade',-640,350],
  ['molotov',300,620],['flame',-900,-560],['sniper',716,1900],['rocket',1150,900],
] as [string,number,number][]).map(([id,lx,lz])=>{const r=roadside(lx,lz,4);return{id,x:r.x,z:r.z};});

// A floating hidden-weapon pickup in the world (spin/bob + collection bookkeeping).
interface Pickup{
  id: string;
  name: string;
  x: number;
  z: number;
  baseY: number;
  g: THREE.Object3D;
  active: boolean;
  respawnAt: number;
}

const pickups: Pickup[]=[];
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

export function updateWeaponPickups(dt: number){
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
    // perf: cada pickup de arma é ~16-21 draws (halo+ícone+glow); só desenha dentro
    // de ~95m — some no haze antes disso e o radar já marca a posição.
    const vis=d2<80*80;
    if(p.g.visible!==vis)p.g.visible=vis;
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
        bigText('ARMA NOVA','var(--gold)');
        message('ACHOU '+p.name,'var(--gold)');
        blip([660,990,1320],0.09,'square',.18);
        setTimeout(hideBig,1200);
      }else{
        message(p.name+' - MUNIÇÃO REABASTECIDA','var(--cyan)');
        blip([660,990],0.07,'sine',.16);
      }
    }
  }
}
