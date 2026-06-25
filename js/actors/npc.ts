import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {groundHeight,rand,irand} from '@/core/constants.ts';
import {addWanted} from '@/core/physics.ts';
import {spawnDrop} from '@/story/missions.ts';
import {setOpacity,addFemaleLook,vehicleOccupants} from '@/core/entities.ts';
import {scene} from '@/core/engine.ts';
import {NPC_DEFS,type NpcDef} from '@/core/npc-defs.ts';

// ============================================================================
// BASE class for EVERY NPC in the game. It centralises the SHARED behaviour —
// taking bullets / punches / explosions / fire, DYING (ragdoll tumble + blood
// pool + dropped loot + wanted) and FLEEING danger — so any new NPC type is born
// with all of it just by EXTENDING this class, with no need to reimplement
// damage/death in each system.
//
// The key is the global `npcs` REGISTRY: the weapon system (js/combat/weapons.ts)
// scans that array ONCE and hits ANY Npc instance, instead of enumerating each
// type by hand. NPCs with their own targeting (story/army) or that must never be
// shot (patients) pass register:false and stay out of the scan.
//
// Each concrete type (pedestrian, gang, country folk, …) extends Npc and runs its
// OWN AI in update(); the damage/death is inherited from here. See rural-folk.ts.
// ============================================================================

// Name pools — 30 common US English first names per gender. Each NPC is assigned
// a mandatory name at birth, with a 50/50 male/female split (see balancedGenders).
export const MALE_NAMES=['James','John','Robert','Michael','William','David','Richard',
  'Joseph','Thomas','Charles','Christopher','Daniel','Matthew','Anthony','Mark','Donald',
  'Steven','Andrew','Joshua','Kenneth','Kevin','Brian','George','Edward','Ronald',
  'Timothy','Jason','Jeffrey','Ryan','Gary'];
export const FEMALE_NAMES=['Mary','Patricia','Jennifer','Linda','Elizabeth','Barbara',
  'Susan','Jessica','Sarah','Karen','Nancy','Lisa','Betty','Margaret','Sandra','Ashley',
  'Kimberly','Emily','Donna','Michelle','Carol','Amanda','Dorothy','Melissa','Deborah',
  'Stephanie','Rebecca','Laura','Sharon','Cynthia'];

// A minimal RNG shape: anything with a 0..1 random(). The seeded makeRng() streams
// satisfy it, and so does a {random:Math.random} fallback.
export interface RandLike{random():number;}

// Fixed seed so EVERY player gets the IDENTICAL persistent NPC population — same
// names, same genders, same home blocks. Each population builder derives its own
// independent stream from this (e.g. makeRng(NPC_SEED+1)) so module load order
// doesn't shift another builder's results.
export const NPC_SEED=20260624;

export function pickName(gender:'M'|'F',rng?:RandLike):string{
  const pool=gender==='M'?MALE_NAMES:FEMALE_NAMES;
  const r=rng?rng.random():Math.random();
  return pool[Math.floor(r*pool.length)];
}

// Deterministic, exactly-balanced gender list for a fixed population of `n` (half
// 'M', half 'F'; the odd one out is 'F'), then Fisher-Yates shuffled with `rng` so
// the split is even but the arrangement looks natural — identical for all players.
export function balancedGenders(n:number,rng:RandLike):('M'|'F')[]{
  const out:('M'|'F')[]=[];
  for(let i=0;i<n;i++)out.push(i<Math.floor(n/2)?'M':'F');
  for(let i=n-1;i>0;i--){
    const j=Math.floor(rng.random()*(i+1));
    const t=out[i];out[i]=out[j];out[j]=t;
  }
  return out;
}

// Options accepted by the Npc constructor (all optional).
interface NpcOpts{
  kind?:string;
  hp?:number;
  drop?:[number,number]|null;
  wanted?:number;
  wantedMsg?:string;
  crime?:string;
  name?:string;
  gender?:'M'|'F';
  punchToDown?:number;
  showLabel?:boolean;
  // District / region the NPC belongs to (shown in the pause-menu roster).
  area?:string;
  // Join the global combat registry (`npcs`)? Default true. Specialised NPCs that
  // have their OWN targeting (story actors via storyTargets, army soldiers via
  // armyTargets) or that must NEVER be shot (paramedic patients) pass register:false
  // — they still INHERIT this base class (so 100% of NPCs share it), but the unified
  // weapon scan skips them so existing mini-game logic is untouched.
  register?:boolean;
  // Apply the female appearance (long hair + bust + lips) when gender is 'F'.
  // Default true; non-humanoid NPCs (e.g. forest sickos) pass false.
  femaleLook?:boolean;
  // Likes/tastes from npcs.json (e.g. ["smoke_weed"]) — drives behaviour like the
  // weed flag-down and shows in the census.
  likes?:string[];
  // Lives inside an interior (club, jail, hospital, …)? Recorded for the census.
  indoor?:boolean;
  // Personality archetype from npcs.json (brave|nervous|friendly|greedy|hostile|chill)
  // — shapes how the NPC reacts (e.g. flee distance). Defaults to 'chill'.
  personality?:string;
  // Speech-bubble lines from npcs.json (contextual to this NPC). May be empty → silent.
  dialogues?:string[];
}

// Global registry of all NPCs (the combat scan iterates this). Holds the unified
// NPCs — pedestrians, gang members, foot officers and country folk. NPCs with
// their own targeting (story/army) or untouchable ones (patients) pass
// register:false and stay out.
export const npcs:Npc[]=[];

// Census of EVERY Npc ever created (registered or not) — used by the pause-menu
// roster so even own-targeted/untouchable NPCs appear in "all NPCs of the game".
export const allNpcs:Npc[]=[];

// Lazy-resolved container for name labels. Re-queries until found — never caches a
// null (so labels still work if the first NPC is built before #npc-labels exists).
let _labelRoot:HTMLElement|null=null;
function getLabelRoot():HTMLElement|null{
  if(_labelRoot)return _labelRoot;
  _labelRoot=document.getElementById('npc-labels');
  return _labelRoot;
}

export class Npc{
  g:THREE.Object3D;
  kind:string;
  hp:number;
  maxHp:number;
  dead:boolean;
  deadT:number;
  grounded:boolean;
  vel:THREE.Vector3;
  bloodDropped:boolean;
  punchHits:number;
  lastPunchT:number;
  drop:[number,number]|null;
  wanted:number;
  wantedMsg:string;
  crime:string;
  // Persistent identity
  name:string;
  gender:'M'|'F';
  homeX:number;
  homeZ:number;
  // Hospital respawn: >0 = recovering (not in world), counts down in seconds
  hospitalT:number;
  // How many fist hits to down this NPC (3 for civilians, 4 for tough NPCs)
  punchToDown:number;
  // Floating name label in the HTML overlay
  label:HTMLElement|null;
  // District / region (pause-menu roster). Subclasses set the concrete name.
  area:string;
  // Likes/tastes from npcs.json (e.g. ["smoke_weed"]).
  likes:string[];
  // Lives inside an interior (club/jail/hospital/…)?
  indoor:boolean;
  // Personality archetype (brave|nervous|friendly|greedy|hostile|chill).
  personality:string;
  // Speech-bubble lines (from npcs.json). Empty = this NPC never chatters.
  dialogues:string[];
  // Whether this NPC joined the combat registry (npcs[]).
  registered:boolean;
  // Optional hooks a sub-class may define to react to hurt/death (see RuralFolk).
  onHurt?:(dir?:THREE.Vector3)=>void;
  onDeath?:(dir?:THREE.Vector3)=>void;

  constructor(g:THREE.Object3D,{
    kind='npc',hp=1,drop=null,wanted=0,wantedMsg='SHOT FIRED!',crime='npc_shot',
    name,gender,punchToDown=3,showLabel=false,area='City',register=true,femaleLook=true,likes,indoor=false,personality='chill',dialogues,
  }:NpcOpts={}){
    this.g=g;
    this.kind=kind;
    this.hp=hp;this.maxHp=hp;
    this.dead=false;
    this.deadT=0;
    this.grounded=false;
    this.vel=new THREE.Vector3();
    this.bloodDropped=false;
    this.punchHits=0;this.lastPunchT=-99;
    this.drop=drop;
    this.wanted=wanted;
    this.wantedMsg=wantedMsg;this.crime=crime;
    const g2:'M'|'F'=gender??(Math.random()<.5?'M':'F');
    this.gender=g2;
    if(g2==='F'&&femaleLook)addFemaleLook(g); // women get the female appearance
    this.name=name??pickName(g2);
    g.userData.npcName=this.name; // seeds the GLB look so it's the same every play (npc-glb)
    this.homeX=g.position.x;
    this.homeZ=g.position.z;
    this.hospitalT=0;
    this.likes=likes??[];
    this.indoor=indoor;
    this.personality=personality;
    this.dialogues=dialogues??[];
    this.punchToDown=punchToDown;
    this.area=area;
    if(showLabel){
      const root=getLabelRoot();
      if(root){
        const el=document.createElement('span');
        el.className='npc-label';
        el.textContent=this.name;
        root.appendChild(el);
        this.label=el;
      }else this.label=null;
    }else this.label=null;
    this.registered=register;
    if(register)npcs.push(this);
    allNpcs.push(this);
  }
  get position(){return this.g.position;}

  // Human-readable status for the pause-menu roster. Base covers down/hospital;
  // subclasses override aliveState() to report their routine (walking, patrol, …).
  stateName():string{
    if(this.hospitalT>0)return 'In hospital';
    if(this.dead)return 'Down';
    return this.aliveState();
  }
  aliveState():string{return 'Active';}

  // Where this NPC is currently headed, in WORLD x/z (for the full-map path trail).
  // Base returns null (no known path); wandering subclasses override it.
  pathTarget():{x:number;z:number}|null{return null;}

  // A random speech-bubble line for this NPC (from its npcs.json dialogues), or null
  // if it has none. ALL chatter bubbles come from here, so they're always contextual.
  speakLine():string|null{
    return this.dialogues.length?this.dialogues[Math.floor(Math.random()*this.dialogues.length)]:null;
  }

  takeDamage(dir?:THREE.Vector3,dmg=1,at?:THREE.Vector3){
    if(this.dead)return;
    this.hp-=dmg;
    // Blood on EVERY hit, at the impact point when known (gunfire passes it) or the chest.
    const bx=at?at.x:this.g.position.x,by=at?at.y:this.g.position.y+1.2,bz=at?at.z:this.g.position.z;
    refs.spawnBlood?.(bx,by,bz,dir,10);
    if(this.hp<=0)this.kill(dir);
    else this.onHurt?.(dir);
  }

  kill(dir?:THREE.Vector3){
    if(this.dead)return;
    this.dead=true;this.deadT=0;this.grounded=false;
    state.kills++;
    const d=dir||new THREE.Vector3();
    this.vel.set(d.x,0,d.z).multiplyScalar(9).add(new THREE.Vector3(rand(-1.5,1.5),rand(5,7),rand(-1.5,1.5)));
    if(!this.bloodDropped){this.bloodDropped=true;refs.addBloodPuddle?.(this.g.position.x,this.g.position.z);}
    refs.spawnBlood?.(this.g.position.x,this.g.position.y+1.1,this.g.position.z,d,16); // death burst
    if(this.drop)spawnDrop(this.g.position.x,this.g.position.z,irand(this.drop[0],this.drop[1]));
    if(this.wanted)addWanted(this.wanted,this.wantedMsg,this.crime);
    this.onDeath?.(dir);
  }

  // Animate the death tumble. With fade=true (default) the body fades out after a
  // few seconds (the old behaviour: rural folk revive, gang bodies vanish). With
  // fade=false the body stays put as a CORPSE — used by city peds, whose bodies the
  // ambulance service later collects (see js/world/body-recovery.ts). Returns true once
  // the body has come to rest.
  updateRagdoll(dt:number,fade=true){
    this.deadT+=dt;
    const gy=groundHeight(this.g.position.x,this.g.position.z);
    if(!this.grounded){
      this.g.position.addScaledVector(this.vel,dt);
      this.vel.y-=22*dt;this.g.rotation.x+=9*dt;
      if(this.g.position.y<gy+.35&&this.vel.y<0){
        this.g.position.y=gy+.35;this.grounded=true;
        this.g.rotation.set(-Math.PI/2,this.g.rotation.y,0);
      }
    }else if(fade&&this.deadT>5){
      setOpacity(this.g,Math.max(0,1-(this.deadT-5)/1));
    }
    return this.deadT>6;
  }

  // Revive this NPC at the given position (hospital discharge or revival).
  revive(x:number,z:number){
    this.dead=false;this.grounded=false;this.deadT=0;
    this.bloodDropped=false;this.hp=this.maxHp;this.hospitalT=0;
    this.punchHits=0;this.lastPunchT=-99;
    this.g.position.set(x,groundHeight(x,z),z);
    this.g.rotation.set(0,rand(-Math.PI,Math.PI),0);
    setOpacity(this.g,1);
    this.restoreLimbs(); // re-grow any head/arm torn off by the gore layer
  }

  // Undo dismemberment (js/combat/gore.ts) so a revived NPC isn't permanently maimed:
  // restore the collapsed bones to full scale and re-show the head extras.
  restoreLimbs(){
    const ud=this.g.userData,limbs=ud.limbs;
    if(ud.headless){
      limbs?.head?.scale.setScalar(1);
      if(ud.mouth)(ud.mouth as {visible:boolean}).visible=true;
      if(ud.femaleHairMesh)(ud.femaleHairMesh as {visible:boolean}).visible=true;
      ud.headless=false;
    }
    if(ud.lostArm){
      if(ud.lostArm.L){limbs?.leftArm?.scale.setScalar(1);limbs?.leftForearm?.scale.setScalar(1);}
      if(ud.lostArm.R){limbs?.rightArm?.scale.setScalar(1);limbs?.rightForearm?.scale.setScalar(1);}
      ud.lostArm={};
    }
  }

  despawn(){
    const i=npcs.indexOf(this);if(i>=0)npcs.splice(i,1);
    const j=allNpcs.indexOf(this);if(j>=0)allNpcs.splice(j,1);
    this.g.parent?.remove(this.g);
    if(this.label){this.label.remove();this.label=null;}
  }

  fleeFrom(px:number,pz:number,spd:number,dt:number):[number,number]{
    let ax=this.g.position.x-px,az=this.g.position.z-pz;
    const m=Math.hypot(ax,az)||1;ax/=m;az/=m;
    this.g.position.x+=ax*spd*dt;this.g.position.z+=az*spd*dt;
    this.g.rotation.y=Math.atan2(ax,az);
    return[ax,az];
  }
}

// ---------------------------------------------------------------------------
// Floating name labels — call once per frame from the main loop. Shows a name tag
// for any labelled NPC that is within LABEL_DIST, in front of the camera AND not
// hidden behind a building. Iterates allNpcs so interior NPCs (register:false) are
// covered too; uses WORLD position so nested (interior) dolls project correctly.
// ---------------------------------------------------------------------------
const LABEL_DIST=20;
const _wp=new THREE.Vector3();
// An occluder solid: only walls/buildings (tall boxes) should hide a label, not low
// props/curbs — so we ignore anything shorter than a person+label.
interface OccluderBox{x0:number;x1:number;z0:number;z1:number;h:number;}
const OCCLUDE_MIN_H=2;

// 2D segment (a→b) vs an axis-aligned rectangle, slab method. Used to tell whether a
// building stands between the camera and an NPC (so its name tag must be hidden).
function segHitsBox(ax:number,az:number,bx:number,bz:number,b:OccluderBox):boolean{
  const dx=bx-ax,dz=bz-az;
  let t0=0,t1=1;
  // X slab
  if(Math.abs(dx)<1e-9){if(ax<b.x0||ax>b.x1)return false;}
  else{
    let ta=(b.x0-ax)/dx,tb=(b.x1-ax)/dx;if(ta>tb){const t=ta;ta=tb;tb=t;}
    t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1)return false;
  }
  // Z slab
  if(Math.abs(dz)<1e-9){if(az<b.z0||az>b.z1)return false;}
  else{
    let ta=(b.z0-az)/dz,tb=(b.z1-az)/dz;if(ta>tb){const t=ta;ta=tb;tb=t;}
    t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1)return false;
  }
  return t1>=t0;
}

export function updateNpcLabels(camera:THREE.Camera,playerPos:THREE.Vector3){
  // Building occlusion only applies OUTDOORS — inside an interior the solids list
  // holds the room's own walls/bars (e.g. jail cell bars), which must NOT hide the
  // tags of the people in that room. So skip occlusion while in an interior.
  const solids=state.interior?undefined:(refs.citySolids as OccluderBox[]|undefined);
  const camX=camera.position.x,camZ=camera.position.z;
  for(const n of allNpcs){
    const el=n.label;
    if(!el)continue;
    if(n.dead||n.hospitalT>0||!n.g.visible){el.style.display='none';continue;}
    n.g.getWorldPosition(_wp);
    const dx=_wp.x-playerPos.x,dz=_wp.z-playerPos.z;
    if(dx*dx+dz*dz>LABEL_DIST*LABEL_DIST){el.style.display='none';continue;}
    // occlusion: a building between the camera and the NPC hides the tag (outdoors only)
    if(solids){
      let blocked=false;
      for(const b of solids){
        if(b.h<OCCLUDE_MIN_H)continue;
        if(segHitsBox(camX,camZ,_wp.x,_wp.z,b)){blocked=true;break;}
      }
      if(blocked){el.style.display='none';continue;}
    }
    _wp.y+=2.2; // float above the head
    _wp.project(camera as THREE.PerspectiveCamera);
    if(_wp.z>=1){el.style.display='none';continue;} // behind the camera
    el.style.display='block';
    el.style.left=(_wp.x*.5+.5)*100+'%';
    el.style.top=(.5-_wp.y*.5)*100+'%';
  }
}

// ---------------------------------------------------------------------------
// Roster / census — feeds the pause-menu NPCs panel. One entry per living NPC
// in the world (registered combat NPCs + own-targeted ones), sorted by kind then
// name so the list reads as a stable directory of the town's population.
// ---------------------------------------------------------------------------
export interface NpcRosterEntry{
  name:string;
  gender:'M'|'F';
  kind:string;
  area:string;
  state:string;
  personality:string;
  likes:string[];
  x:number;
  z:number;
}

// Friendly label per NPC kind (player-facing in the roster).
const KIND_LABELS:Record<string,string>={
  ped:'Civilian',gang:'Gang',officer:'Police',police:'Police',rural:'Country folk',
  soldier:'Army',criminal:'Criminal',patient:'Injured',story:'Story',
  sicko:'Sicko',npc:'NPC',
  // interior NPCs
  dancer:'Clubber',gymgoer:'Gym-goer',guard:'Guard',inmate:'Inmate',
  clerk:'Clerk',medic:'Hospital',fare:'Passenger',buyer:'Buyer',
  driver:'Driver',rick:'Hermit',
};
export function kindLabel(kind:string):string{return KIND_LABELS[kind]||kind;}

// Tag an already-built interior doll (club dancer, jail guard, shop clerk, …) as a
// named NPC. Identity (name/sex/likes) is pulled from the matching indoor entries in
// npcs.json for this area, in order — so the people inside the club/jail/etc. are the
// fixed, documented cast. register:false (never shot); marked indoor for the census.
// If the data defines fewer than the scene builds, extras get an auto name.
const _interiorCursor:Record<string,number>={};
export function nameInteriorNpc(g:THREE.Object3D,kind:string,area:string):Npc{
  const defs=NPC_DEFS.filter(d=>d.neighborhood===area);
  const i=_interiorCursor[area]||0;_interiorCursor[area]=i+1;
  const def:NpcDef|undefined=defs[i];
  return new Npc(g,{kind,register:false,showLabel:true,area,indoor:true,
    name:def?.name,gender:def?.sex,likes:def?.likes,personality:def?.personality,dialogues:def?.dialogues});
}

// Is an object still part of the live scene graph (vs. removed with its vehicle)?
function attachedToScene(o:THREE.Object3D):boolean{
  let p:THREE.Object3D|null=o.parent;
  while(p){if(p===scene)return true;p=p.parent;}
  return false;
}

// Runtime reconcile of seated vehicle occupants (car drivers, boat crew). Every
// driver doll registered by seatDriver becomes a named Npc so it shows in the roster;
// when its vehicle is removed from the scene the Npc is reaped, keeping the census
// leak-free without coupling the vehicle systems to the NPC class. Called each frame
// from the main loop. register:false (drivers aren't shot) and no floating tag (a
// name over every passing car would be noise — they appear in the modal instead).
export function reconcileVehicleNpcs():void{
  for(let i=vehicleOccupants.length-1;i>=0;i--){
    const d=vehicleOccupants[i];
    const live=attachedToScene(d);
    const npc=d.userData.occupantNpc as Npc|undefined;
    if(live&&!npc){
      d.userData.occupantNpc=new Npc(d,{kind:'driver',register:false,showLabel:true,area:'On the road'});
    }else if(!live){
      // vehicle gone from the scene (destroyed, or the player stole the car and the
      // seated driver was removed): reap the NPC if it was tagged, and ALWAYS drop the
      // doll from the list — including the detached-before-tagged case (no census leak).
      if(npc)npc.despawn();
      d.userData.occupantNpc=undefined;
      vehicleOccupants.splice(i,1);
    }
  }
}

export function getNpcRoster():NpcRosterEntry[]{
  const out=allNpcs.map(n=>({
    name:n.name,gender:n.gender,kind:n.kind,area:n.area,state:n.stateName(),
    personality:n.personality,likes:n.likes,
    x:Math.round(n.g.position.x),z:Math.round(n.g.position.z),
  }));
  out.sort((a,b)=>a.kind===b.kind?a.name.localeCompare(b.name):a.kind.localeCompare(b.kind));
  return out;
}

// ---------------------------------------------------------------------------
// Live map blips — feeds the full-map "Show NPCs" overlay. One entry per LIVING
// NPC in WORLD coordinates, with its current path target (for the trail). Skips
// the dead/hospitalised. Uses world position so nested (interior) NPCs report true
// coords (interiors are off-map, so the map naturally clips them out).
// ---------------------------------------------------------------------------
export interface NpcMapBlip{x:number;z:number;kind:string;tx:number|null;tz:number|null;}
const _mwp=new THREE.Vector3();
export function getNpcMapBlips():NpcMapBlip[]{
  const out:NpcMapBlip[]=[];
  for(const n of allNpcs){
    if(n.dead||n.hospitalT>0)continue;
    n.g.getWorldPosition(_mwp);
    const t=n.pathTarget();
    out.push({x:_mwp.x,z:_mwp.z,kind:n.kind,tx:t?t.x:null,tz:t?t.z:null});
  }
  return out;
}
