import * as THREE from 'three';
import {groundHeight,rand,irand,clamp,wrapA,SWIM_BOUND} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {PLAYER_DAMAGE_TAKEN,NPC_HP_TOUGH} from '@/core/difficulty.ts';
import {attachHandGun,poseAiming} from '@/core/entities.ts';
import * as Entities from '@/core/entities.ts';
import {collideStatics,hasLineOfSight} from '@/core/physics.ts';
import {gunshot,thud,blip} from '@/audio/audio.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {playerPos,getWasted} from '@/actors/player.ts';
import {Npc} from '@/actors/npc.ts';
import {solids} from '@/world/world.ts';
import {byId} from '@/combat/weapon-catalog.ts';
import {pickupArsenalWeapon} from '@/combat/weapons.ts';
import {makeRedneck} from '../../assets/models/characters/redneck.ts';
import {makeGangTracerLine} from '../../assets/models/effects/gang-tracer.ts';
import campfire from '../../assets/models/rural/campfire.ts';
import tent from '../../assets/models/rural/tent.ts';
import logSeat from '../../assets/models/rural/log-seat.ts';
import woodPile from '../../assets/models/rural/wood-pile.ts';

// ============================================================================
// THE REDNECK CAMP — the target of the story's first job (js/story/story.ts). It only
// EXISTS while the story needs it: a clearing in the woods north-east of the mountain,
// well off the dirt road (~45 m), with a few small tents around a campfire and SIX armed
// rednecks. It is built when the boss hands out the job and torn down once the dead
// are buried (their graves stay — see burial.ts).
//
// The six keep to their posts (four around the fire, two sentries looking out) until the
// camp is ALARMED — one of them spots the player (a view cone + line of sight, or anyone
// too close), a gunshot rings out nearby, or one of them gets hurt. Then every survivor
// turns on the player: they run at them firing, sidestep, and shoot — but they never
// leave their clearing: nobody chases past LEASH, and once the player backs off beyond
// DISENGAGE they all go back to their posts and WAIT there, now on guard (they spot the
// player all around, from further away), until the player comes back.
//
// The dead are NOT faded out: their bodies stay where they fell for the burial job.
// Around the clearing, before the tents, a small stash of weapons helps the assault.
// ============================================================================

export const CAMP={x:588,z:-46};  // north of the Pine Hollow road, between the ranch and the grow-op
const CULL2=140*140;          // beyond this the camp's people are hidden and idle
const VIEW_R=24, VIEW_COS=Math.cos(1.05), HEAR_R=6.5;
const WARY_R=32;              // on guard (after a fight): they see the player all around, this far
const SHOT_HEAR_R=60;         // a gunshot within this of the camp raises the alarm
const LEASH=30;               // no camper ever goes further than this from the camp centre
const DISENGAGE=50;           // the player this far from the camp → everyone back to their posts
const FIGHT_FAR=40;

// Who they are and where they stand (offsets from CAMP; face = yaw they look along).
const ROSTER: {name: string;sex: 'M'|'F';gun: string;x: number;z: number;face?: number;sentry?: boolean}[]=[
  {name:'Cletus',sex:'M',gun:'shotgun',x:3.2,z:1.2},
  {name:'Jolene',sex:'F',gun:'pistol',x:-2.9,z:2.3},
  {name:'Earl',sex:'M',gun:'pistol',x:.6,z:-3.4},
  {name:'Bobby Ray',sex:'M',gun:'uzi',x:-1.2,z:-2.6},
  {name:'Dwayne',sex:'M',gun:'shotgun',x:8,z:9,face:Math.atan2(.3,1),sentry:true},      // watches the road side (south)
  {name:'Hank',sex:'M',gun:'pistol',x:-10,z:6,face:-Math.PI/2,sentry:true},             // watches the west trail
];
export const CAMP_SIZE=ROSTER.length;

// The stash left around the camp for the assault (world offsets from CAMP).
const STASH: {id: string;x: number;z: number}[]=[
  {id:'pistol',x:-9,z:25},                 // on the road side, where the player comes in
  {id:'grenade',x:11,z:26},
  {id:'uzi',x:-27,z:7},
];

export class Camper extends Npc{
  post!: {x: number;z: number};
  face!: number;
  sentry!: boolean;
  mode!: 'idle'|'fight';
  bob!: number;
  shootT!: number;
  strafe!: number;
  strafeT!: number;
  buried=false;
  override aliveState(): string{return this.mode==='fight'?'Attacking':this.sentry?'On watch':'By the fire';}
  override pathTarget(): {x: number;z: number}|null{return this.post;}
}

interface Tracer{line: THREE.Line;t: number;}
interface Stash{id: string;x: number;z: number;baseY: number;g: THREE.Object3D;taken: boolean;}

let built=false;
const props: THREE.Object3D[]=[];
const campSolids: {x0: number;x1: number;z0: number;z1: number;h: number}[]=[];
let flames: THREE.Object3D[]=[];
let fireGlow: THREE.Mesh|undefined;
export const campers: Camper[]=[];
const stash: Stash[]=[];
const tracers: Tracer[]=[];
let alarm=false,wary=false;
let onAllDead: (() => void)|null=null;
let onKill: ((left: number) => void)|null=null;

function place(obj: THREE.Object3D,x: number,z: number,ry=0): THREE.Object3D{
  obj.position.set(x,groundHeight(x,z),z);
  if(ry)obj.rotation.y=ry;
  scene.add(obj);props.push(obj);
  return obj;
}

function raiseAlarm(){
  if(alarm)return;
  alarm=true;wary=true;
  for(const c of campers)if(!c.dead){c.mode='fight';c.shootT=rand(.5,1.3);}
  message('O ACAMPAMENTO TE VIU!','#ff3b56');
}
// The player backed off: everyone walks back to the camp and waits there, on guard.
function standDown(){
  alarm=false;
  for(const c of campers)if(!c.dead)c.mode='idle';
  message('OS CAIPIRAS VOLTARAM PRO ACAMPAMENTO','var(--cream)');
}

/** Build the camp. `alive=false` lays the six out as the corpses left by the job
 *  (used when a save is restored after the shoot-out); `bodies` gives where they fell. */
export function buildCamp(opts: {alive: boolean;bodies?: ({x: number;z: number}|null)[];
  onKill?: (left: number) => void;onAllDead?: () => void}): void{
  if(built)removeCamp();
  built=true;alarm=false;wary=false;
  onKill=opts.onKill??null;onAllDead=opts.onAllDead??null;
  const X=CAMP.x,Z=CAMP.z;
  // the camp itself
  const fire=campfire.build();place(fire,X,Z);
  flames=fire.userData.flames||[];fireGlow=fire.userData.glow;
  for(const[dx,dz,ry]of[[-5.5,-4.5,.5],[6.2,3.4,-2.1],[-1.8,7.4,Math.PI+.2]]){
    place(tent.build(),X+dx,Z+dz,ry);
    const b={x0:X+dx-1.2,x1:X+dx+1.2,z0:Z+dz-1.2,z1:Z+dz+1.2,h:1.5};   // tents are solid
    solids.push(b);campSolids.push(b);
  }
  place(woodPile.build(),X+3.4,Z-5.2,.4);
  for(const[dx,dz]of[[2.1,.8],[-1.8,1.6],[.2,-2.2]])place(logSeat.build(),X+dx,Z+dz,Math.atan2(dx,dz)+Math.PI/2);
  // the people
  ROSTER.forEach((r,i)=>{
    const g=makeRedneck();
    const x=X+r.x,z=Z+r.z;
    g.position.set(x,groundHeight(x,z),z);
    const c=new Camper(g,{kind:'camper',hp:NPC_HP_TOUGH,drop:[15,60],wanted:0,crime:'ped_shot',
      punchToDown:4,showLabel:true,name:r.name,gender:r.sex,area:'Redneck camp',personality:'hostile'});
    c.post={x,z};
    c.face=r.face??Math.atan2(X-x,Z-z);             // around the fire: looking at it
    c.sentry=!!r.sentry;c.mode='idle';c.bob=rand(0,6);c.shootT=rand(.8,1.6);c.strafe=0;c.strafeT=0;
    g.rotation.y=c.face;
    attachHandGun(g,r.gun);
    c.onHurt=()=>raiseAlarm();
    c.onDeath=()=>{
      raiseAlarm();
      const left=campers.filter(k=>!k.dead).length;
      onKill?.(left);
      if(left===0){const fn=onAllDead;onAllDead=null;fn?.();}
    };
    campers.push(c);
    if(!opts.alive){
      // already dead: lay the body down where it fell (or at its post)
      const b=opts.bodies?.[i];
      const known=!!b&&Number.isFinite(b.x)&&Number.isFinite(b.z);
      const bx=known?b!.x:x,bz=known?b!.z:z;
      c.dead=true;c.grounded=true;c.bloodDropped=true;
      g.position.set(bx,groundHeight(bx,bz)+.35,bz);
      g.rotation.set(-Math.PI/2,rand(-Math.PI,Math.PI),0);
      if(b===null){c.buried=true;c.despawn();}      // null = already buried
    }
  });
  // the stash (only while the camp still fights)
  if(opts.alive)for(const s of STASH){
    const w=byId[s.id];if(!w?.makeModel)continue;
    const g=w.makeModel({pickup:true});g.scale.setScalar(1.3);
    const x=X+s.x,z=Z+s.z,baseY=groundHeight(x,z)+1;
    g.position.set(x,baseY,z);scene.add(g);
    stash.push({id:s.id,x,z,baseY,g,taken:false});
  }
}

/** Tear the camp down (tents, fire, stash, any remaining people). */
export function removeCamp(): void{
  for(const o of props)scene.remove(o);
  props.length=0;flames=[];fireGlow=undefined;
  for(const b of campSolids){const i=solids.indexOf(b);if(i>=0)solids.splice(i,1);}
  campSolids.length=0;
  for(const c of campers)if(!c.buried)c.despawn();
  campers.length=0;
  for(const s of stash)scene.remove(s.g);
  stash.length=0;
  for(const t of tracers){Entities.disposeGeometries(t.line);scene.remove(t.line);}
  tracers.length=0;
  built=false;alarm=false;wary=false;onAllDead=null;onKill=null;
}

export const campBuilt=()=>built;
export const campAlive=()=>campers.filter(c=>!c.dead).length;
export const campAlarmed=()=>alarm;

function shoot(c: Camper,pp: THREE.Vector3,dist: number){
  c.shootT=rand(1.1,2.1);
  const from=c.g.position.clone();from.y+=1.25;
  const hit=Math.random()<clamp(.72-dist*.018,.15,.72);
  const to=new THREE.Vector3(pp.x,pp.y+1.1,pp.z);
  if(!hit){const a=rand(0,Math.PI*2);to.x+=Math.cos(a)*rand(.8,2.2);to.z+=Math.sin(a)*rand(.8,2.2);}
  const line=makeGangTracerLine(from,to);scene.add(line);tracers.push({line,t:0});
  gunshot(.35);
  if(hit){
    state.health-=(state.mode==='car'?irand(2,5):irand(4,9))*PLAYER_DAMAGE_TAKEN;
    state.shake=Math.max(state.shake,.14);
    refs.spawnBlood?.(pp.x,pp.y+1.1,pp.z,new THREE.Vector3(to.x-from.x,to.y-from.y,to.z-from.z).normalize(),7);
    if(state.health<=0){state.health=100;getWasted();}
  }
}

// Can this camper notice the player right now (view cone + line of sight, or too close)?
function spots(c: Camper,pp: THREE.Vector3,dist: number): boolean{
  if(dist<HEAR_R)return true;
  if(wary)return dist<WARY_R&&hasLineOfSight(c.g.position.x,c.g.position.z,pp.x,pp.z);
  if(dist>VIEW_R)return false;
  const fx=Math.sin(c.g.rotation.y),fz=Math.cos(c.g.rotation.y);
  const dx=(pp.x-c.g.position.x)/dist,dz=(pp.z-c.g.position.z)/dist;
  if(fx*dx+fz*dz<VIEW_COS)return false;
  return hasLineOfSight(c.g.position.x,c.g.position.z,pp.x,pp.z);
}

const _dir=new THREE.Vector3();
export function updateCamp(dt: number): void{
  if(!built)return;
  const pp=playerPos();
  const dxC=pp.x-CAMP.x,dzC=pp.z-CAMP.z,d2C=dxC*dxC+dzC*dzC;
  const near=d2C<CULL2;
  // campfire flicker
  for(const o of props)if(o.userData.flames)o.visible=near;
  if(near){
    for(const f of flames){const k=.7+Math.random()*.6;f.scale.set(k,.8+Math.random()*.5,k);}
    if(fireGlow)(fireGlow.material as THREE.Material).opacity=.14+Math.random()*.12;
  }
  // stash pickups: spin/bob, collect on foot
  for(const s of stash){
    if(s.taken)continue;
    s.g.visible=near;
    if(!near)continue;
    s.g.rotation.y+=1.8*dt;s.g.position.y=s.baseY+Math.sin(state.time*2.6+s.x)*.16;
    if(state.mode==='foot'&&!state.swimming&&Math.hypot(pp.x-s.x,pp.z-s.z)<2.6){
      const isNew=pickupArsenalWeapon(s.id);
      s.taken=true;scene.remove(s.g);
      const name=byId[s.id]?.name||s.id;
      if(isNew){bigText('NEW WEAPON','var(--gold)');setTimeout(hideBig,1200);}
      message((isNew?'FOUND ':'')+name+(isNew?'':' - AMMO REFILLED'),'var(--gold)');
      blip([660,990,1320],.09,'square',.18);
    }
  }
  // a gunshot nearby (the player's, broadcast by weapons.ts) gives the game away
  if(!alarm&&state.time-(state.shotT??-99)<.6){
    const sx=(state.shotX??1e9)-CAMP.x,sz=(state.shotZ??1e9)-CAMP.z;
    if(sx*sx+sz*sz<SHOT_HEAR_R*SHOT_HEAR_R)raiseAlarm();
  }
  // the player backed off far enough: they give up the chase and go home to wait
  if(alarm&&d2C>DISENGAGE*DISENGAGE)standDown();
  const car=refs.getCur?.();
  const danger=state.mode==='car'&&car&&Math.abs(car.speed)>6;
  const canShoot=state.started&&state.mode!=='cut'&&!state.cine&&!state.mapOpen&&!state.interior;
  for(const c of campers){
    if(c.buried)continue;
    const p=c.g.position;
    if(c.dead){c.g.visible=near;c.updateRagdoll(dt,false);continue;}   // corpses stay for the burial
    c.g.visible=near;
    if(!near)continue;
    // run over by a fast car
    if(danger&&p.distanceTo(car!.g.position)<2.3){
      const hd=new THREE.Vector3(Math.sin(car!.heading),0,Math.cos(car!.heading));
      c.kill(hd.clone().multiplyScalar(car!.speed*.4));
      if(Math.abs(car!.speed)>24)refs.gibNpc?.(c,hd,1.3);else refs.maimRandom?.(c,hd);
      thud(Math.abs(car!.speed));state.shake=.35;
      continue;
    }
    const dist=Math.hypot(pp.x-p.x,pp.z-p.z);
    let mv: number;
    if(c.mode==='idle'){
      if(canShoot&&spots(c,pp,dist))raiseAlarm();
      // back to the post (running if far) and look where they were looking
      const bx=c.post.x-p.x,bz=c.post.z-p.z,bd=Math.hypot(bx,bz);
      if(bd>.4){
        const sp=bd>3?3.6:1.4;
        p.x+=bx/bd*sp*dt;p.z+=bz/bd*sp*dt;c.g.rotation.y=Math.atan2(bx,bz);mv=sp>2?.8:.3;c.bob+=dt*(sp>2?8:3);
      }
      else{
        const look=c.face+(c.sentry?Math.sin(state.time*.35+c.bob)*.7:Math.sin(state.time*.2+c.bob)*.15);
        c.g.rotation.y+=wrapA(look-c.g.rotation.y)*Math.min(1,dt*2);c.bob+=dt*1.2;mv=.08;
      }
    }else{
      // fight: face the player, hold a firing distance, sidestep, shoot
      _dir.set(pp.x-p.x,0,pp.z-p.z).normalize();
      c.g.rotation.y=Math.atan2(_dir.x,_dir.z);
      c.strafeT-=dt;
      if(c.strafeT<=0){c.strafeT=rand(1,2.4);c.strafe=Math.random()<.35?0:(Math.random()<.5?-1:1);}
      let vx=0,vz=0;
      if(dist>14&&dist<FIGHT_FAR+30){vx+=_dir.x*3.8;vz+=_dir.z*3.8;}
      else if(dist<6){vx-=_dir.x*2.2;vz-=_dir.z*2.2;}
      vx+=_dir.z*c.strafe*1.6;vz-=_dir.x*c.strafe*1.6;
      p.x+=vx*dt;p.z+=vz*dt;
      // ...but never leave the clearing
      const lx=p.x-CAMP.x,lz=p.z-CAMP.z,ld=Math.hypot(lx,lz);
      if(ld>LEASH){p.x=CAMP.x+lx/ld*LEASH;p.z=CAMP.z+lz/ld*LEASH;}
      const sp=Math.hypot(vx,vz);mv=Math.min(.9,sp/4);c.bob+=dt*(2+sp*2);
      c.shootT-=dt;
      if(canShoot&&c.shootT<=0&&dist<FIGHT_FAR&&pp.y-p.y<3&&hasLineOfSight(p.x,p.z,pp.x,pp.z))shoot(c,pp,dist);
    }
    collideStatics(p,.4,SWIM_BOUND);
    p.y=groundHeight(p.x,p.z)+Math.abs(Math.sin(c.bob))*.05*Math.min(1,mv*3);
    Entities.animatePed?.(c.g,c.bob,mv);
    if(c.mode==='fight')poseAiming(c.g);
  }
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.t+=dt;
    (t.line.material as THREE.Material).opacity=Math.max(0,.9-t.t*7);
    if(t.t>.15){Entities.disposeGeometries(t.line);scene.remove(t.line);tracers.splice(i,1);}
  }
}

/** Debug/test: kill every living camper (as if shot). */
export function killAllCampers(): number{
  let n=0;
  for(const c of campers)if(!c.dead){c.kill(new THREE.Vector3(rand(-1,1),0,rand(-1,1)));n++;}
  return n;
}
