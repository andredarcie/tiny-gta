import * as THREE from 'three';
import {groundHeight,rand,irand,wrapA,SWIM_BOUND,TOWN_CX} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {PLAYER_DAMAGE_TAKEN} from '@/core/difficulty.ts';
import * as Entities from '@/core/entities.ts';
import {collideStatics} from '@/core/physics.ts';
import {thud,zombieGroan} from '@/audio/audio.ts';
import {playerPos,getWasted} from '@/actors/player.ts';
import {Npc} from '@/actors/npc.ts';
import {folk} from '@/world/rural-folk.ts';
import zombieModel from '../../assets/models/characters/zombie.ts';
import {makeFireModel} from '../../assets/models/effects/fire.ts';

// ============================================================================
// THE RISEN — the story's third mission (js/story/story.ts). The six rednecks the
// player buried climbed out of their graves as ZOMBIES and are shambling toward the
// village of Pine Hollow, killing whoever they catch on the way.
//
// A zombie has no gun: it lurches along with both arms stretched out in front, and
// turns on the player once they come close — it follows them and claws at them when
// in reach (only on foot; a car runs them down). They take a lot of lead (a shot to the
// head drops them for good — the gore layer severs it). The dead stay where they fall:
// the bodies are CURSED, and only holy water (the priest's) finishes them — sprinkled
// on a body, it bursts into flames and burns away (burnCorpse).
// ============================================================================

const VILLAGE={x:TOWN_CX,z:10};    // Pine Hollow square: where they head for
const CULL2=150*150;
const CHASE_R=34;                   // they turn on the player inside this
const REACH=1.45;                   // clawing distance
const WALK=1.05, CHASE=2.1;         // m/s: shambling to the village / going for the player
const HP=10;

export class Zombie extends Npc{
  bob!: number;
  lurch!: number;
  attackT!: number;
  groanT!: number;
  goal!: {x: number;z: number};
  goalT!: number;
  burning=0;                         // >0 while the holy fire consumes the body (seconds)
  fire: THREE.Object3D|null=null;
  gone=false;                        // burned away
  override aliveState(): string{return 'Risen';}
  override pathTarget(): {x: number;z: number}|null{return this.goal;}
}

export const zombies: Zombie[]=[];
let onKill: ((left: number) => void)|null=null;
let onAllDead: (() => void)|null=null;
let onAllBurned: (() => void)|null=null;

/** Raise the six (at their graves), or lay their cursed corpses back down (`corpses`:
 *  where each fell, null = already burned) when a save is restored after the fight. */
export function spawnZombies(opts: {at: {x: number;z: number}[];names: string[];corpses?: ({x: number;z: number}|null)[];
  onKill?: (left: number) => void;onAllDead?: () => void}): void{
  clearZombies();
  onKill=opts.onKill??null;onAllDead=opts.onAllDead??null;
  opts.at.forEach((a,i)=>{
    const g=zombieModel.build();
    const x=a.x+rand(-.6,.6),z=a.z+rand(-.6,.6);
    g.position.set(x,groundHeight(x,z),z);scene.add(g);
    const zb=new Zombie(g,{kind:'zombie',hp:HP,drop:null,wanted:0,punchToDown:6,showLabel:true,
      name:opts.names[i]??'Zumbi',gender:'M',femaleLook:false,area:'Pine Hollow woods',personality:'hostile'});
    zb.bob=rand(0,6);zb.lurch=rand(0,6);zb.attackT=0;zb.groanT=rand(1,5);
    zb.goal={x:VILLAGE.x+rand(-8,8),z:VILLAGE.z+rand(-8,8)};zb.goalT=0;
    zb.onDeath=()=>{
      const left=zombies.filter(k=>!k.dead).length;
      onKill?.(left);
      if(left===0){const fn=onAllDead;onAllDead=null;fn?.();}
    };
    zombies.push(zb);
    if(opts.corpses){
      const c=opts.corpses[i];
      const known=!!c&&Number.isFinite(c.x)&&Number.isFinite(c.z);
      const bx=known?c!.x:x,bz=known?c!.z:z;
      zb.dead=true;zb.grounded=true;zb.bloodDropped=true;
      g.position.set(bx,groundHeight(bx,bz)+.35,bz);g.rotation.set(-Math.PI/2,rand(-Math.PI,Math.PI),0);
      if(c===null){zb.gone=true;zb.despawn();}
    }
  });
}

export function clearZombies(): void{
  for(const z of zombies){if(z.fire)scene.remove(z.fire);if(!z.gone)z.despawn();}
  zombies.length=0;onKill=onAllDead=onAllBurned=null;
}

export const zombiesAlive=()=>zombies.filter(z=>!z.dead).length;
export const cursedCorpses=()=>zombies.filter(z=>z.dead&&!z.gone&&!z.burning);
/** For the save: where each corpse lies (null = burned). */
export const corpseRecords=()=>zombies.map(z=>z.gone||z.burning?null:{x:+z.g.position.x.toFixed(2),z:+z.g.position.z.toFixed(2)});
export function onCorpsesBurned(fn: (() => void)|null){onAllBurned=fn;}

/** Holy water hit this body: it bursts into flames and burns away. */
export function burnCorpse(z: Zombie): void{
  if(!z.dead||z.gone||z.burning)return;
  z.burning=.001;
  const f=makeFireModel();f.position.copy(z.g.position);f.position.y=groundHeight(z.g.position.x,z.g.position.z);
  f.scale.setScalar(1.3);scene.add(f);z.fire=f;
  thud(4);
}

// Nearest cursed corpse within `r` of the player (the holy water's target).
export function nearestCorpse(r: number): Zombie|null{
  const pp=playerPos();let best: Zombie|null=null,bd=r;
  for(const z of cursedCorpses()){const d=Math.hypot(z.g.position.x-pp.x,z.g.position.z-pp.z);if(d<bd){bd=d;best=z;}}
  return best;
}

// Arms stretched out in front, a limp, the head lolling to one side.
function poseZombie(z: Zombie): void{
  const l=z.g.userData.limbs;if(!l)return;
  const sway=Math.sin(z.lurch*.9)*.12;
  l.rightArm.rotation.set(-1.45+sway,0,-.12);l.leftArm.rotation.set(-1.35-sway,0,.18);
  l.rightForearm?.rotation.set(-.15,0,0);l.leftForearm?.rotation.set(-.3,0,0);
  l.head.rotation.set(.25,0,.35+Math.sin(z.lurch*.5)*.12);
}

const _d=new THREE.Vector3();
export function updateZombies(dt: number): void{
  if(!zombies.length)return;
  const pp=playerPos();
  const car=refs.getCur?.();
  const inCar=state.mode==='car';
  const danger=inCar&&car&&Math.abs(car.speed)>6;
  const canHurt=state.started&&state.mode==='foot'&&!state.cine&&!state.mapOpen&&!state.interior;
  let burning=false;
  for(const z of zombies){
    if(z.gone)continue;
    const p=z.g.position;
    const dx=pp.x-p.x,dz=pp.z-p.z,d2=dx*dx+dz*dz;
    const near=d2<CULL2;
    if(z.dead){
      z.g.visible=near||z.burning>0;
      z.updateRagdoll(dt,false);                          // the cursed corpse stays
      if(z.burning>0){
        burning=true;
        z.burning+=dt;
        const k=Math.min(1,z.burning/2.6);
        z.g.scale.setScalar(Math.max(.02,1-k*k));         // the body shrivels in the flames
        if(z.fire){
          const fl=z.fire.userData.flames as THREE.Object3D[];
          for(const f of fl){const s=.7+Math.random()*.6;f.scale.set(s,.8+Math.random()*.6,s);}
          z.fire.scale.setScalar(1.3*(k<.8?1:Math.max(.05,(1-k)*5)));
        }
        if(k>=1){
          z.gone=true;z.despawn();
          if(z.fire){scene.remove(z.fire);z.fire=null;}
        }
      }
      continue;
    }
    z.g.visible=near;
    if(!near)continue;
    // run down by a fast car
    if(danger&&p.distanceTo(car!.g.position)<2.3){
      const hd=new THREE.Vector3(Math.sin(car!.heading),0,Math.cos(car!.heading));
      z.kill(hd.clone().multiplyScalar(car!.speed*.4));
      if(Math.abs(car!.speed)>24)refs.gibNpc?.(z,hd,1.3);else refs.maimRandom?.(z,hd);
      thud(Math.abs(car!.speed));state.shake=.35;
      continue;
    }
    const dist=Math.sqrt(d2);
    // groans, louder close by
    z.groanT-=dt;
    if(z.groanT<=0){z.groanT=rand(2.5,6);if(dist<40)zombieGroan(Math.pow(1-dist/40,1.5));}
    let tx: number,tz: number,spd: number;
    if(dist<CHASE_R&&!state.cine){tx=pp.x;tz=pp.z;spd=CHASE;}
    else{
      // shamble toward the village, milling around the square once there
      z.goalT-=dt;
      if(Math.hypot(z.goal.x-p.x,z.goal.z-p.z)<2||z.goalT<=0){
        z.goalT=rand(6,12);
        if(Math.hypot(VILLAGE.x-p.x,VILLAGE.z-p.z)<20)z.goal={x:VILLAGE.x+rand(-12,12),z:VILLAGE.z+rand(-12,12)};
      }
      tx=z.goal.x;tz=z.goal.z;spd=WALK;
      // anyone of the village caught in reach is torn apart
      for(const f of folk){
        if(f.dead)continue;
        const fx=f.g.position.x-p.x,fz=f.g.position.z-p.z;
        if(fx*fx+fz*fz<1.3*1.3){
          // a zombie's kill is not the player's crime: no wanted star for it
          const dir=_d.set(fx,0,fz).normalize().clone(),w=f.wanted;
          f.wanted=0;f.kill(dir);f.wanted=w;refs.maimRandom?.(f,dir);
          break;
        }
      }
    }
    _d.set(tx-p.x,0,tz-p.z);
    const dd=_d.length();
    if(dd>(spd===CHASE?REACH*.8:.5)){
      _d.divideScalar(dd);
      // the lurch: a heavy step, then a dragged one
      const step=.55+.45*Math.abs(Math.sin(z.lurch));
      p.x+=_d.x*spd*step*dt;p.z+=_d.z*spd*step*dt;
    }
    const face=Math.atan2(tx-p.x,tz-p.z);
    z.g.rotation.y+=wrapA(face-z.g.rotation.y)*Math.min(1,dt*4);
    z.lurch+=dt*spd*3.2;z.bob+=dt*spd*2.6;
    collideStatics(p,.4,SWIM_BOUND);
    p.y=groundHeight(p.x,p.z)+Math.abs(Math.sin(z.lurch))*.05;
    Entities.animatePed?.(z.g,z.bob,Math.min(1,spd/2.4));
    poseZombie(z);
    // clawing at the player
    z.attackT-=dt;
    if(canHurt&&dist<REACH&&z.attackT<=0){
      z.attackT=rand(1,1.4);
      state.health-=irand(6,11)*PLAYER_DAMAGE_TAKEN;
      state.shake=Math.max(state.shake,.22);
      refs.spawnBlood?.(pp.x,pp.y+1.2,pp.z,_d.set(dx,0,dz).normalize().negate(),9);
      zombieGroan(.8);
      if(state.health<=0){state.health=100;getWasted();}
    }
  }
  if(!burning&&onAllBurned&&zombies.length&&zombies.every(z=>z.gone)){const fn=onAllBurned;onAllBurned=null;fn();}
}

/** Debug/test: drop every living zombie. */
export function killAllZombies(): number{
  let n=0;
  for(const z of zombies)if(!z.dead){z.kill(new THREE.Vector3(rand(-1,1),0,rand(-1,1)));n++;}
  return n;
}
