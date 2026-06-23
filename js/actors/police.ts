import * as THREE from 'three';
import {N,CELL,HALF,clamp,rand,pick,wrapA,nodeX,irand,groundHeight,SWIM_BOUND} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {makeCar,makePed,animatePed,spinWheels,blinkBar,dentCar,seatDriver,
  attachHandGun,poseAiming,disposeGeometries} from '@/core/entities.ts';
import {makeHeli} from '../../assets/models/police/helicopter.ts';
import {makeRocketLauncherModel,makeMissileModel} from '../../assets/models/weapons/rocket-launcher.ts';
import {makeGangTracerLine} from '../../assets/models/effects/gang-tracer.ts';
import {thud,gunshot} from '@/audio/audio.ts';
import {collideStatics} from '@/core/physics.ts';
import {message} from '@/ui/hud.ts';
import {playerPos,cur,getBusted,getWasted,player} from '@/actors/player.ts';
import {radioMessage} from '@/ui/hud.ts';
import {say} from '@/ui/speech.ts';
import {regionAt} from '@/world/regions.ts';
import {Npc} from '@/actors/npc.ts';
import {npcDefsByKind} from '@/core/npc-defs.ts';

// A police cruiser — one of the FIXED pool of named officers. It patrols when the
// player is clean and chases when a star appears (see updateCops).
interface Cop{
  g:THREE.Object3D;
  heading:number;
  speed:number;
  stuckT:number;
  backT:number;
  officers:Officer[]|null;
  driver?:THREE.Object3D;
  dentT?:number;
  name?:string;                 // the named officer driving this cruiser (npcs.json)
  patrolTgt?:THREE.Vector3|null; // current patrol destination (wandered when clean)
  isSheriff?:boolean;           // the one SHERIFF (radio dispatcher, distinct uniform)
  uniform?:number;              // shirt colour (sheriff tan vs. patrol blue)
  dispatchT?:number;            // >0 = radio-dispatched to investigate (chases even at ★0)
  siren?:boolean;               // true while actively chasing (lights+siren on) — drives the audio
  // road-grid route to the player (A*): a list of intersection waypoints to follow.
  path?:GridNode[];
  pathI?:number;                // current waypoint index
  repathT?:number;              // countdown to recompute the route
  goalI?:number;goalJ?:number;  // the player's node the current path targets (recompute when it moves)
}
type GridNode=[number,number];

// A foot officer dropped from a cruiser. Extends Npc so weapons can target them
// via the unified npcs[] registry instead of a separate copOfficers loop.
export class Officer extends Npc{
  car!:Cop;
  bob!:number;
  shootT!:number;
  mode!:string; // 'hunt'|'return'
  rocket!:boolean;
  override aliveState():string{return this.mode==='return'?'Returning to car':'In pursuit';}
}

interface CopMissile{g:THREE.Object3D;dir:THREE.Vector3;left:number;}
interface Tracer{line:THREE.Line;t:number;}

export const cops:Cop[]=[];
export const officers:Officer[]=[];
export let heli:THREE.Group|null=null;

const COP_BLUE=0x2a3f6e;
const SHERIFF_TAN=0x8a7a44;   // the sheriff wears a tan/khaki uniform (distinct from patrol blue)
const SHERIFF_BROWN=0x46381f; // sheriff trousers
const SIX_STAR_HOLD=30;
const ARMY_AT=6;              // the wanted star at which the sheriff calls in the army
const BUST_TIME=5;            // seconds of officer contact before the player is booked
const WANTED_GRACE=24;        // seconds after losing the police before the star starts to cool
const WANTED_COOL=10;         // seconds to shed one star once it finally starts cooling
let lastShout=-99;
let radioCd=0;                // throttle between radio dispatches (one per few seconds)
let carRadioCd=0;             // throttle for generic (non-police) vehicle-explosion calls
let lastRadioStar=0;          // last wanted star the radio escalated at (so each rise speaks once)
// Arrest model: at ★1 the deployed officers give a SURRENDER chance (no shooting) — they
// only open fire if the suspect RESISTS (fires a weapon after they're out) or it's ★2+.
let policeLethal=false;       // recomputed each frame in updateCops
let resisted=false;           // latched true when the suspect fights back at ★1
let lastDeployT=-99;          // when officers last got out of a cruiser
let surrenderBarkT=0;         // throttle for the spoken surrender orders
const SURRENDER_LINES=['Hands up! You\'re under arrest!','Freeze! Get on the ground, now!',
  'Don\'t move! Hands where I can see them!','Drop the weapon and surrender — last warning!'];

// The FIXED police roster from npcs.json (kind:'police'). The pool never grows beyond
// this — the same named officers patrol and respond; a destroyed cruiser is replaced
// by the same roster (a cop "returns from afar"), never an NPC "from beyond".
const POLICE_DEFS=npcDefsByKind('police');
const POOL=POLICE_DEFS.length||5;
let respawnT=0; // throttles how fast a lost cruiser comes back from afar
const _patrol=new THREE.Vector3();

// ---------------------------------------------------------------------------
// ROAD-GRID PATHFINDING — the city is a fully-connected grid of intersections at
// (nodeX(i),nodeX(j)), i,j∈0..N (same graph traffic drives). A* over it gives the
// cruiser a real route ALONG the roads to the player, so it rounds buildings instead
// of grinding into walls. Cheap: ≤81 nodes, recomputed only a few times a second.
// ---------------------------------------------------------------------------
function nearestNode(x:number,z:number):GridNode{
  return[clamp(Math.round((x+HALF)/CELL),0,N),clamp(Math.round((z+HALF)/CELL),0,N)];
}
function gridPath(start:GridNode,goal:GridNode):GridNode[]{
  const W=N+1,key=(i:number,j:number)=>i*W+j;
  const sk=key(start[0],start[1]),gk=key(goal[0],goal[1]);
  if(sk===gk)return[goal];
  const h=(i:number,j:number)=>Math.abs(i-goal[0])+Math.abs(j-goal[1]);
  const came=new Map<number,number>(),g=new Map<number,number>([[sk,0]]);
  const f=new Map<number,number>([[sk,h(start[0],start[1])]]);
  const open:GridNode[]=[start],closed=new Set<number>();
  while(open.length){
    let bi=0;for(let k=1;k<open.length;k++)
      if((f.get(key(open[k][0],open[k][1]))??1e9)<(f.get(key(open[bi][0],open[bi][1]))??1e9))bi=k;
    const cur=open.splice(bi,1)[0],ck=key(cur[0],cur[1]);
    if(ck===gk){
      const path:GridNode[]=[cur];let k2=ck;
      while(came.has(k2)){const pk=came.get(k2)!;path.unshift([Math.floor(pk/W),pk%W]);k2=pk;}
      return path;
    }
    closed.add(ck);
    const[ci,cj]=cur,nbs:GridNode[]=[];
    if(ci>0)nbs.push([ci-1,cj]);if(ci<N)nbs.push([ci+1,cj]);
    if(cj>0)nbs.push([ci,cj-1]);if(cj<N)nbs.push([ci,cj+1]);
    for(const nb of nbs){
      const nk=key(nb[0],nb[1]);if(closed.has(nk))continue;
      const ng=(g.get(ck)??1e9)+1;
      if(ng<(g.get(nk)??1e9)){
        came.set(nk,ck);g.set(nk,ng);f.set(nk,ng+h(nb[0],nb[1]));
        if(!open.some(o=>o[0]===nb[0]&&o[1]===nb[1]))open.push(nb);
      }
    }
  }
  return[goal];
}

// A far road node (≥80m from the player) — where cops spawn/respawn and patrol toward.
function farNode():[number,number]{
  const px=playerPos();
  let nx,nz,tries=0;
  do{nx=nodeX(irand(0,N));nz=nodeX(irand(0,N));tries++;}
  while(Math.hypot(nx-px.x,nz-px.z)<80&&tries<30);
  return[nx,nz];
}

// Create one cruiser unit driven by a named officer (an unused name from the roster),
// parked at a far node and patrolling. The driver is tagged as a 'police' census NPC.
export function spawnCop(){
  const[nx,nz]=farNode();
  // give this unit a roster name not already on the streets; the SHERIFF (flagged in
  // npcs.json) always keeps his identity and wears a distinct tan uniform.
  const def=POLICE_DEFS.find(d=>!cops.some(c2=>c2.name===d.name))||POLICE_DEFS[cops.length%POOL];
  const isSheriff=!!def?.sheriff;
  const uniform=isSheriff?SHERIFF_TAN:COP_BLUE;
  const c:Cop={g:makeCar(0xe8e8ee,true),heading:rand(0,6.28),speed:0,stuckT:0,backT:0,officers:null,patrolTgt:null,
    isSheriff,uniform,name:def?.name};
  c.driver=seatDriver(c.g,uniform,isSheriff?SHERIFF_BROWN:0x1a2440);
  c.g.position.set(nx,0,nz);
  // tag the driver as a named police NPC so it shows in the census (and
  // reconcileVehicleNpcs leaves it be).
  if(c.driver)c.driver.userData.occupantNpc=new Npc(c.driver,{kind:'police',register:false,showLabel:true,
    area:isSheriff?'Sheriff':'Police Patrol',name:def?.name,gender:def?.sex,personality:def?.personality,dialogues:def?.dialogues});
  cops.push(c);
}

// Drive a patrolling cruiser around the streets (no lights, calm speed). It now FOLLOWS
// THE ROAD GRID (same A* as the chase) toward a far node, so a free-roaming patrol car
// rounds corners on the streets instead of grinding into buildings.
function patrolCop(c:Cop,dt:number){
  const p=c.g.position;
  if(!c.patrolTgt||!c.path||_patrol.copy(c.patrolTgt).sub(p).setY(0).length()<8||c.stuckT>1.6){
    const[tx,tz]=farNode();
    c.patrolTgt=new THREE.Vector3(tx,0,tz);
    c.path=gridPath(nearestNode(p.x,p.z),nearestNode(tx,tz));
    c.pathI=Math.min(1,c.path.length-1);
    c.stuckT=0;
  }
  while((c.pathI??0)<c.path.length-1){
    const w=c.path[c.pathI!];
    if(Math.hypot(p.x-nodeX(w[0]),p.z-nodeX(w[1]))<8)c.pathI!++;else break;
  }
  const w=c.path[Math.min(c.pathI??0,c.path.length-1)];
  const desired=Math.atan2(nodeX(w[0])-p.x,nodeX(w[1])-p.z),diff=wrapA(desired-c.heading);
  c.heading+=clamp(diff,-1,1)*1.8*dt;
  c.speed+=(11-c.speed)*1.2*dt;
  p.x+=Math.sin(c.heading)*c.speed*dt;
  p.z+=Math.cos(c.heading)*c.speed*dt;
  if(collideStatics(p,1.3)){c.speed*=.4;c.stuckT+=dt*3;}else c.stuckT=Math.max(0,c.stuckT-dt);
  c.g.rotation.y=c.heading;
  spinWheels(c.g,c.speed,dt,clamp(diff,-1,1));
}

// Boot: stand up the fixed patrol pool once (after the world exists). The cops are
// always on the map from the start.
export function initPolice(){
  if(cops.length)return;
  for(let i=0;i<POOL;i++)spawnCop();
}

// ---------------------------------------------------------------------------
// POLICE RADIO — realistic dispatch chatter. The sheriff is the dispatcher; the
// nearest patrol units are sent (always by name) to a shots-fired call. Wording uses
// real US police-radio convention (shots fired, Code 3, 10-76 en route, 10-32 armed
// suspect, "be advised"), describing the suspect by the player's ACTUAL shirt colour
// and the real region name — nothing random or invented.
// ---------------------------------------------------------------------------

// Player's actual shirt colour → a plain colour word, for the suspect description.
const COLOR_NAMES:[number,string][]=[
  [0xc23b4e,'red'],[0x19e3ff,'cyan'],[0x3b7ac2,'blue'],[0x2a3f6e,'navy'],[0xcf9a3a,'yellow'],
  [0x3aa06b,'green'],[0xd96fae,'pink'],[0xe8e3d2,'white'],[0x222831,'black'],[0x7a4f9e,'purple'],
  [0x8a7a44,'tan'],[0xff8a3a,'orange'],[0x8a8f99,'grey'],
];
function colorName(hex:number):string{
  const r=(hex>>16)&255,g=(hex>>8)&255,b=hex&255;
  let best='dark',bd=1e9;
  for(const[h,n] of COLOR_NAMES){
    const dr=((h>>16)&255)-r,dg=((h>>8)&255)-g,db=(h&255)-b,d=dr*dr+dg*dg+db*db;
    if(d<bd){bd=d;best=n;}
  }
  return best;
}
function suspectDesc():string{
  const shirt=(player.g.userData.clothing?.shirt as number)??0x19e3ff;
  return `wearing a ${colorName(shirt)} shirt`;
}
function regionName(x:number,z:number):string{return regionAt(x,z)||'the area';}
// "Ronald", "Ronald and Stephanie", "Ronald, Stephanie and Timothy"
function nameList(names:string[]):string{
  const a=names.filter(Boolean);
  if(a.length<=1)return a[0]||'';
  if(a.length===2)return `${a[0]} and ${a[1]}`;
  return `${a.slice(0,-1).join(', ')} and ${a[a.length-1]}`;
}
const sheriffCop=()=>cops.find(c=>c.isSheriff);
const distTo=(c:Cop,x:number,z:number)=>Math.hypot(c.g.position.x-x,c.g.position.z-z);

// A shot was fired at (x,z): the sheriff dispatches the nearest patrol over the radio,
// by name, and those units start responding (drive to investigate) even before a star.
function radioDispatch(x:number,z:number){
  if(radioCd>0||!cops.length)return;
  radioCd=6;
  const sheriff=sheriffCop();
  const sName=sheriff?.name||'Dispatch';
  const region=regionName(x,z);
  const desc=suspectDesc();
  const sorted=[...cops].sort((a,b)=>distTo(a,x,z)-distTo(b,x,z));
  const nearest=sorted[0],partner=sorted[1];
  if(nearest)nearest.dispatchT=15; // respond/investigate for a while
  if(partner)partner.dispatchT=15;
  let line:string;
  if(nearest?.isSheriff){
    // the sheriff himself is closest
    const second=partner?.name;
    line=`<b>Sheriff ${sName}</b>: "Dispatch, shots fired in <b>${region}</b> — suspect ${desc}. `+
      (second?`I'm 10-76, <b>${second}</b> and I responding Code 3."`:`I'm 10-76, responding Code 3."`);
  }else{
    const who=nameList([nearest?.name,partner?.name].filter(Boolean) as string[]);
    line=`<b>Sheriff ${sName}</b>: "Shots fired in <b>${region}</b>, suspect ${desc}. <b>${who}</b>, respond Code 3."`;
  }
  radioMessage(line);
}

// An officer was just killed — the radio calls it in by name (gravely wounded, officer
// needs assistance), so every cop reads as a named person, not a faceless unit.
function radioOfficerDown(name?:string){
  const sName=sheriffCop()?.name||'Dispatch';
  const who=name?`<b>Officer ${name}</b>`:'an officer';
  radioMessage(`<b>Sheriff ${sName}</b>: "10-99 — ${who} has been gravely wounded! Officer needs assistance, all units respond!"`);
}

// A lost unit has come back from afar — the radio puts them back in service by name.
function radioReturn(name?:string){
  const sName=sheriffCop()?.name||'Dispatch';
  const who=name?`<b>Unit ${name}</b>`:'a unit';
  radioMessage(`<b>Sheriff ${sName}</b>: "Be advised, ${who} is 10-8, back in service and resuming patrol."`);
}

// A vehicle just exploded. Police cruisers are named (the officer inside is hurt);
// other vehicles are reported as a generic explosion at the location.
function radioCarExplosion(x:number,z:number,copName?:string){
  const sName=sheriffCop()?.name||'Dispatch';
  const region=regionName(x,z);
  if(copName){
    radioMessage(`<b>Sheriff ${sName}</b>: "10-52! Officer <b>${copName}</b>'s unit just went up in <b>${region}</b> — he's hurt, get me fire and rescue!"`,7500);
  }else{
    if(carRadioCd>0)return; // don't spam on a rampage of civilian cars
    carRadioCd=8;
    radioMessage(`<b>Sheriff ${sName}</b>: "Dispatch, vehicle explosion reported in <b>${region}</b>. Rolling fire and rescue."`);
  }
}

// Each rise in the wanted level speaks once on the radio (more units, then the army at
// the top), always naming the officers/soldiers involved.
function radioEscalate(star:number){
  const sName=sheriffCop()?.name||'Dispatch';
  if(star>=ARMY_AT){
    const army=(refs.armyNames?.()||[]) as string[];
    const who=army.length?nameList(army):'all available units';
    radioMessage(`<b>Sheriff ${sName}</b>: "All units, suspect is 10-32 and out of control — requesting military support. <b>${who}</b>, you are cleared to engage."`,6500);
    return;
  }
  // name the cruisers now responding (the first `star` units)
  const who=nameList(cops.slice(0,Math.min(POOL,star)).map(c=>c.name||'').filter(Boolean));
  radioMessage(`<b>Sheriff ${sName}</b>: "Be advised, suspect is 10-32, armed and dangerous in <b>${regionName(playerPos().x,playerPos().z)}</b>. <b>${who}</b>, converge and engage Code 3."`,5600);
}

function deployOfficers(c:Cop){
  c.officers=[];
  lastDeployT=state.time; // a shot AFTER this counts as resisting arrest (→ lethal at ★1)
  const h=c.heading;
  // ONE officer per cruiser — matches the single driver who got out (1 in, 1 out). More
  // cruisers respond as the wanted level rises, so the squad still grows with the stars.
  for(const side of[1.1]){
    const g=makePed(c.uniform||COP_BLUE); // the sheriff's officers wear his tan uniform
    g.position.set(c.g.position.x+Math.cos(h)*side,0,c.g.position.z-Math.sin(h)*side);
    const o=new Officer(g,{
      kind:'officer',hp:1,drop:null,wanted:1.5,wantedMsg:'OFFICER DOWN!',crime:'cop_killed',
      punchToDown:4,showLabel:true,area:c.isSheriff?'Sheriff':'On patrol',name:c.name, // the cruiser's named cop, on foot
    });
    o.car=c;o.bob=rand(0,6);o.shootT=rand(.5,1.1);o.mode='hunt';
    o.rocket=Math.floor(state.wanted)>=5;
    // Officers fall flat on their back instantly — no ragdoll tumble.
    o.onDeath=()=>{
      o.grounded=true;o.vel.set(0,0,0);
      o.g.rotation.x=-Math.PI/2;o.g.position.y=.35;
      if(o.car?.officers){
        const idx=o.car.officers.indexOf(o);if(idx>=0)o.car.officers.splice(idx,1);
        if(!o.car.officers.length)o.car.officers=null;
      }
      radioOfficerDown(o.name); // the radio names the downed officer — cops are real people
    };
    if(o.rocket){
      const bz=makeRocketLauncherModel();
      bz.scale.set(.85,.85,.85);bz.position.set(.32,1.42,.12);
      o.g.add(bz);
    }else attachHandGun(o.g);
    scene.add(o.g);
    officers.push(o);c.officers.push(o);
  }
}

const copMissiles:CopMissile[]=[];
const tracers:Tracer[]=[];

export function clearCops(){
  // WASTED / BUSTED: the fixed cruiser pool is NOT destroyed — everyone is recalled to
  // a far patrol (deployed foot officers are removed; they re-deploy on the next chase).
  for(const o of officers)o.despawn();
  officers.length=0;
  for(const c of cops){
    c.officers=null;
    const[nx,nz]=farNode();
    c.g.position.set(nx,0,nz);
    c.speed=0;c.backT=0;c.stuckT=0;c.patrolTgt=null;
    c.siren=false;c.dispatchT=0; // kill the siren immediately (e.g. when the player dies / is busted)
  }
  lastRadioStar=0; // re-arm the radio escalation for the next time
  for(const m of copMissiles){disposeGeometries(m.g);scene.remove(m.g);}
  copMissiles.length=0;
  for(const t of tracers){disposeGeometries(t.line);scene.remove(t.line);}
  tracers.length=0;
  refs.clearPoliceBoats?.();
}
refs.clearCops=clearCops;
refs.policeOnShot=radioDispatch; // weapons.ts calls this when the player fires
refs.radioCarExplosion=radioCarExplosion; // weapons.ts calls this when any vehicle explodes

// Siren loudness 0..1 from the NEAREST actively-chasing cruiser: it swells in as a unit
// closes on you and fades to nothing when no one is chasing (so it goes quiet the moment
// you're caught/killed and while cops merely patrol). audio.ts maps this to the gain.
const SIREN_NEAR=7,SIREN_FAR=95; // metres: full volume ≤7m, silent ≥95m, gradual between
refs.sirenLevel=()=>{
  // Silent during any cutscene (WASTED/BUSTED/story): clearCops only fires at the END of
  // the death cut, so without this the siren would linger while you ride to the hospital.
  if(state.mode==='cut'||state.cine)return 0;
  const pp=playerPos();let best=1e9;
  for(const c of cops)if(c.siren){
    const d=Math.hypot(c.g.position.x-pp.x,c.g.position.z-pp.z);
    if(d<best)best=d;
  }
  if(best>=SIREN_FAR)return 0;
  return clamp(1-(best-SIREN_NEAR)/(SIREN_FAR-SIREN_NEAR),0,1);
};

function addTracer(a:THREE.Vector3,b:THREE.Vector3){
  const line=makeGangTracerLine(a,b);
  scene.add(line);tracers.push({line,t:0});
}

function officerShoot(o:Officer,pp:THREE.Vector3,dist:number){
  o.shootT=rand(.9,1.6);
  const from=o.g.position.clone();from.y+=1.25;
  const hit=Math.random()<clamp(.75-dist*.02,.15,.75);
  const to=new THREE.Vector3(pp.x,pp.y+1.1,pp.z);
  if(!hit){
    const a=rand(0,Math.PI*2);
    to.x+=Math.cos(a)*rand(.8,2.2);to.z+=Math.sin(a)*rand(.8,2.2);
  }
  addTracer(from,to);
  gunshot(.35);
  if(hit){
    state.health-=state.mode==='car'?irand(2,4):irand(4,9);
    state.shake=Math.max(state.shake,.12);
    if(state.health<=0){state.health=100;getWasted();}
  }
}

function officerRocket(o:Officer,pp:THREE.Vector3){
  o.shootT=rand(2.6,3.8);
  const from=o.g.position.clone();from.y+=1.45;
  const to=new THREE.Vector3(pp.x+rand(-2.5,2.5),0,pp.z+rand(-2.5,2.5));
  const dir=new THREE.Vector3(to.x-from.x,0,to.z-from.z);
  const dist=Math.max(dir.length(),.001);
  dir.normalize();
  const g=makeMissileModel();
  g.position.copy(from);
  g.rotation.y=Math.atan2(dir.x,dir.z);
  scene.add(g);
  copMissiles.push({g,dir,left:Math.min(dist,46)});
  thud(6);
}

function updateOfficer(o:Officer,dt:number,pp:THREE.Vector3){
  if(o.dead){
    o.deadT+=dt;
    if(o.deadT>8){
      o.despawn();
      const i=officers.indexOf(o);if(i>=0)officers.splice(i,1);
    }
    return;
  }
  const p=o.g.position;
  if(o.mode==='return'){
    const c=o.car;
    if(!c){o.mode='hunt';return;}
    const dx=c.g.position.x-p.x,dz=c.g.position.z-p.z,d=Math.hypot(dx,dz);
    if(d<1.7){
      o.despawn();
      const oi=officers.indexOf(o);if(oi>=0)officers.splice(oi,1);
      const ci=c.officers?c.officers.indexOf(o):-1;if(ci>=0)c.officers!.splice(ci,1);
      if(c.officers&&!c.officers.length)c.officers=null;
      return;
    }
    p.x+=dx/d*7*dt;p.z+=dz/d*7*dt;
    o.g.rotation.y=Math.atan2(dx,dz);
    o.bob+=dt*12;animatePed(o.g,o.bob,1);
    collideStatics(p,.5);
    return;
  }
  const dx=pp.x-p.x,dz=pp.z-p.z,distP=Math.hypot(dx,dz);
  if(!policeLethal){
    // ★1 SURRENDER: close right in to make the arrest, gun drawn but NEVER fired, and
    // bark a surrender order. They only turn lethal if the suspect resists (see updateCops).
    const stop=1.4;
    if(distP>stop){
      p.x+=dx/distP*6.4*dt;p.z+=dz/distP*6.4*dt;
      o.bob+=dt*11;animatePed(o.g,o.bob,1);
    }else animatePed(o.g,o.bob,0);
    poseAiming(o.g);
    o.g.rotation.y=Math.atan2(dx,dz);
    collideStatics(p,.5);
    if(surrenderBarkT<=0&&distP<18){surrenderBarkT=3.4;say(o.g,pick(SURRENDER_LINES),{life:3.2,yOff:2.4});}
    return;
  }
  // ★2+ (or the suspect resisted): approach to firing range and open fire.
  const stop=o.rocket?16:9;
  if(distP>stop){
    p.x+=dx/distP*6.4*dt;p.z+=dz/distP*6.4*dt;
    o.bob+=dt*11;animatePed(o.g,o.bob,1);
  }else animatePed(o.g,o.bob,0);
  poseAiming(o.g);
  o.g.rotation.y=Math.atan2(dx,dz);
  collideStatics(p,.5);
  o.shootT-=dt;
  if(o.shootT<=0&&pp.y-p.y<3&&distP<(o.rocket?44:26)){
    if(o.rocket)officerRocket(o,pp);
    else officerShoot(o,pp,distP);
  }
}

export function updateHeli(dt:number){
  const need=Math.floor(state.wanted)>=4;
  if(need&&!heli){
    heli=makeHeli();
    heli.position.copy(playerPos()).add(new THREE.Vector3(60,45,60));
    message('POLICE HELICOPTER IN THE AREA!','var(--pink)');
  }
  if(!need&&heli){scene.remove(heli,heli.userData.spot.target);heli=null;return;}
  if(!heli)return;
  const pp=playerPos();
  const tgt=_heliTgt.set(pp.x+Math.sin(state.time*.4)*14,
    Math.max(0,pp.y)+26+Math.sin(state.time*1.3)*1.5,pp.z+Math.cos(state.time*.4)*14);
  heli.position.lerp(tgt,1-Math.exp(-1.2*dt));
  heli.lookAt(pp.x,heli.position.y-4,pp.z);
  heli.userData.rotor.rotation.y+=28*dt;
  heli.userData.spot.target.position.set(pp.x,0,pp.z);
}

const _missileProbe=new THREE.Vector3();
const _heliTgt=new THREE.Vector3();
const _push=new THREE.Vector3();
const _mid=new THREE.Vector3();

// Are the police currently ON you? True if an officer is on foot, or any actively-chasing
// cruiser is within sight range. DISTANCE-based on purpose (no building occlusion): in a
// dense city a wall between you and a cop two metres away must NOT count as "lost them" —
// if a unit is near and chasing, it can see you, so the star must hold.
const SEEN_RANGE=115; // metres
function policeOnYou(pp:THREE.Vector3):boolean{
  if(officers.length>0)return true;
  for(const c of cops)if(c.siren&&
    Math.hypot(c.g.position.x-pp.x,c.g.position.z-pp.z)<SEEN_RANGE)return true;
  return false;
}

export function updateCops(dt:number){
  const want=Math.floor(state.wanted);
  if(radioCd>0)radioCd-=dt;
  if(carRadioCd>0)carRadioCd-=dt;
  if(surrenderBarkT>0)surrenderBarkT-=dt;
  // Arrest model: ★1 = surrender chance (officers hold fire); ★2+ = lethal. At ★1 the
  // suspect resisting (firing a weapon AFTER officers got out) latches them lethal.
  if(want===0)resisted=false;
  if(!resisted&&officers.length>0&&(state.shotT??-99)>lastDeployT+.4)resisted=true;
  policeLethal=want>=2||resisted;
  // RADIO escalation: each new star, the sheriff speaks once (more units, then the
  // army at the top). Resets as the wanted level falls so it speaks again next time.
  if(want>lastRadioStar){lastRadioStar=want;radioEscalate(want);}
  else if(want<lastRadioStar)lastRadioStar=want;
  // FIXED pool: keep POOL cruisers alive at all times (they patrol when the player is
  // clean). A destroyed cruiser is replaced from afar quickly, so the streets never run
  // out of police — nobody spawns "from beyond", it's always the same roster.
  respawnT-=dt;
  if(cops.length<POOL&&respawnT<=0){spawnCop();respawnT=.8;radioReturn(cops[cops.length-1]?.name);}
  // How many cruisers actively CHASE scales with the stars: none when clean, none at
  // ★6 (the army takes over). The rest keep patrolling the streets.
  const chasers=(want>0&&want<6)?Math.min(POOL,want):0;
  const pp=playerPos();
  let ci=0;
  for(const c of cops){
    const p=c.g.position;
    const dx=pp.x-p.x,dz=pp.z-p.z,dist=Math.hypot(dx,dz);
    // The seated driver is hidden while his officers are out, so a deployed cruiser
    // looks genuinely EMPTY (no fake third cop still sitting inside); shown again on re-board.
    if(c.driver)c.driver.visible=!(c.officers&&c.officers.length);
    if(c.dispatchT&&c.dispatchT>0)c.dispatchT-=dt;
    // chases if its slot is responding to the star, OR it was radio-dispatched, OR it
    // already has officers out (a cruiser COMMITS to its arrest — it is never yanked back
    // to patrol while its men are on foot next to you, which used to abort the bust).
    const hasMen=!!(c.officers&&c.officers.length);
    if(ci++>=chasers&&!(c.dispatchT&&c.dispatchT>0)&&!hasMen){ // not responding → patrol
      if(c.siren){c.patrolTgt=null;c.path=undefined;} // just stopped chasing → re-plan a patrol route
      c.siren=false; // patrolling: lights & siren off
      patrolCop(c,dt);
      continue;
    }
    c.siren=true;  // chasing: lights & siren on (the audio fades in by distance)
    blinkBar(c.g);
    if(c.officers){
      c.speed+=(0-c.speed)*6*dt;
      spinWheels(c.g,c.speed,dt,0);
      const fleeing=dist>30||(state.mode==='car'&&Math.abs(cur?.speed||0)>10);
      for(const o of c.officers)o.mode=fleeing?'return':'hunt';
      continue;
    }
    // ROUTE along the road grid: steer toward the next intersection waypoint rather than
    // straight at the player through buildings. Recompute when the player changes block or
    // the route times out. Close in (last leg / within ~one block), drive straight at them.
    const goal=nearestNode(pp.x,pp.z);
    c.repathT=(c.repathT??0)-dt;
    if(!c.path||c.repathT<=0||c.goalI!==goal[0]||c.goalJ!==goal[1]){
      c.path=gridPath(nearestNode(p.x,p.z),goal);
      c.pathI=Math.min(1,c.path.length-1); // skip the start node, head to the next one
      c.repathT=.6;c.goalI=goal[0];c.goalJ=goal[1];
    }
    let tx=pp.x,tz=pp.z; // default: aim straight at the player
    const lastLeg=(c.pathI??0)>=c.path.length-1;
    if(!lastLeg&&dist>=CELL*0.8){
      // advance past any waypoints already reached, then aim at the current one
      while((c.pathI??0)<c.path.length-1){
        const w=c.path[c.pathI!];
        if(Math.hypot(p.x-nodeX(w[0]),p.z-nodeX(w[1]))<8)c.pathI!++;else break;
      }
      const w=c.path[Math.min(c.pathI??0,c.path.length-1)];
      tx=nodeX(w[0]);tz=nodeX(w[1]);
    }
    const desired=Math.atan2(tx-p.x,tz-p.z),diff=wrapA(desired-c.heading);
    if(c.backT>0){
      c.backT-=dt;c.speed+=(-8-c.speed)*3*dt;
      c.heading-=Math.sign(diff)*1.4*dt;
    }else{
      c.heading+=clamp(diff,-1,1)*2.5*dt*clamp(Math.abs(c.speed)/8+.25,0,1);
      // On foot the cruiser brakes to a full STOP as it reaches the suspect (~13m) and
      // deploys, instead of driving into them; in a car chase it keeps the pressure on.
      const ts=state.mode==='foot'?(dist>20?24:dist>13?10:0):(dist>15?27:12);
      c.speed+=(ts-c.speed)*(ts<c.speed?3.4:1.3)*dt;
    }
    p.x+=Math.sin(c.heading)*c.speed*dt;
    p.z+=Math.cos(c.heading)*c.speed*dt;
    for(const o of cops){
      if(o===c)continue;
      const sx=p.x-o.g.position.x,sz=p.z-o.g.position.z,sd=Math.hypot(sx,sz);
      if(sd<2.9&&sd>.001){
        const push=(2.9-sd)*.5/sd;
        p.x+=sx*push;p.z+=sz*push;
        o.g.position.x-=sx*push;o.g.position.z-=sz*push;
      }
    }
    // Anti-runover: never drive into a player on foot — keep the cruiser ≥6m off them.
    if(state.mode==='foot'){
      const ax=p.x-pp.x,az=p.z-pp.z,ad=Math.hypot(ax,az)||1;
      if(ad<6){p.x=pp.x+ax/ad*6;p.z=pp.z+az/ad*6;c.speed*=.3;}
    }
    if(collideStatics(p,1.3)){c.speed*=.3;c.stuckT+=dt*3;}
    // "stuck" only counts while still FAR and meant to be driving. Near the suspect,
    // stopping is ON PURPOSE (about to deploy) — without this the braked cruiser reads as
    // jammed, reverses, and never gets out (the same fix the army truck carries).
    if(dist>14){
      if(Math.abs(c.speed)<2.5)c.stuckT+=dt;else c.stuckT=Math.max(0,c.stuckT-dt*2);
      if(c.stuckT>1.2){c.backT=.9;c.stuckT=0;}
    }else c.stuckT=0;
    c.g.rotation.y=c.heading;
    spinWheels(c.g,c.speed,dt,clamp(diff,-1,1));
    // If the player is ON FOOT, stop and get out as soon as the cruiser is near (~13m),
    // rather than nosing right up to them. In a car chase, pull alongside first.
    if(pp.y<6&&!c.backT&&
      (state.mode==='foot'?dist<13:dist<13&&Math.abs(cur?.speed||0)<4)){
      deployOfficers(c);
      if(state.time-lastShout>6){lastShout=state.time;message('POLICE! FREEZE!','var(--blue)');}
      continue;
    }
    const activeCur=cur;
    if(state.mode==='car'&&activeCur){
      const d=p.distanceTo(activeCur.g.position);
      if(d<2.9){
        const push=_push.subVectors(activeCur.g.position,p).setY(0).normalize();
        activeCur.g.position.addScaledVector(push,(2.9-d)*.7);
        activeCur.speed*=.75;c.speed*=.6;thud(8);state.shake=.35;
        if(!c.dentT||state.time-c.dentT>.5){
          c.dentT=state.time;
          const mid=_mid.addVectors(p,activeCur.g.position)
            .multiplyScalar(.5).setY(.7);
          dentCar(activeCur.g,mid,push,.16);
          dentCar(c.g,mid,push.clone().negate(),.16);
        }
      }
    }
  }

  for(let i=officers.length-1;i>=0;i--)updateOfficer(officers[i],dt,pp);

  // Separation: deployed officers never pile into one another (push apart any that touch),
  // so two cops from different cruisers don't end up standing inside the same body.
  for(let i=0;i<officers.length;i++){
    const a=officers[i];if(a.dead)continue;
    for(let j=i+1;j<officers.length;j++){
      const b=officers[j];if(b.dead)continue;
      const sx=a.g.position.x-b.g.position.x,sz=a.g.position.z-b.g.position.z,sd=Math.hypot(sx,sz);
      if(sd<1.4&&sd>.001){
        const push=(1.4-sd)*.5/sd;
        a.g.position.x+=sx*push;a.g.position.z+=sz*push;
        b.g.position.x-=sx*push;b.g.position.z-=sz*push;
      }
    }
  }

  for(let i=copMissiles.length-1;i>=0;i--){
    const m=copMissiles[i];
    const step=26*dt;
    m.g.position.addScaledVector(m.dir,step);
    m.left-=step;
    m.g.userData.flame.scale.setScalar(.7+Math.random()*.6);
    _missileProbe.copy(m.g.position);
    if(m.left<=0||collideStatics(_missileProbe,.3,SWIM_BOUND)||
      m.g.position.y<=groundHeight(m.g.position.x,m.g.position.z)){
      refs.explodeAt?.(m.g.position.clone());
      disposeGeometries(m.g);scene.remove(m.g);copMissiles.splice(i,1);
    }
  }
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.t+=dt;
    if(t.t>.15){disposeGeometries(t.line);scene.remove(t.line);tracers.splice(i,1);}
  }

  let nearOff=1e9;
  for(const o of officers)if(!o.dead)
    nearOff=Math.min(nearOff,Math.hypot(pp.x-o.g.position.x,pp.z-o.g.position.z));
  // Arrest REQUIRES an officer ON FOOT in contact — the cruiser alone can't bust you, so
  // the police must always get out of the car. Once an officer is on you (in contact for
  // ~5s), you're booked. The radius is generous so the contact is steady, and it drains
  // slowly so a brief step away doesn't reset the whole countdown.
  const inContact=nearOff<5.5&&pp.y<3&&
    (state.mode==='foot'||Math.abs(cur?.speed||0)<3.5);
  if(state.wanted>0&&inContact){
    state.bustT+=dt;
    if(state.bustT>.4)message('THE POLICE HAVE YOU SURROUNDED!','var(--blue)');
    if(state.bustT>=BUST_TIME){getBusted();return;}
  }else state.bustT=Math.max(0,state.bustT-dt*1.2);
  // The star NEVER cools while the police are on you (an officer on foot, or a chasing
  // cruiser within range): being seen keeps the heat maxed every frame. Only once you've
  // truly broken contact does a LONG grace start, after which it cools slowly. Because the
  // HUD shows floor(wanted), the visible star lasts essentially as long as this grace, so
  // it is generous on purpose — even ★1 lingers a good while after you lose them.
  const seen=policeOnYou(pp);
  if(seen&&state.wanted>0)state.lastCrime=state.time; // on you → heat stays maxed
  const sixHold=state.wanted>=6&&state.time-state.sixStarT<SIX_STAR_HOLD;
  if(!sixHold&&state.wanted>0&&!seen&&state.time-state.lastCrime>WANTED_GRACE&&(refs.armyDist?.()??1e9)>90)
    state.wanted=Math.max(0,state.wanted-dt/WANTED_COOL);
}
