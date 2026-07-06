import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {rand,irand,clamp,groundHeight} from '@/core/constants.ts';
import {makePed,attachHandGun,poseAiming} from '@/core/entities.ts';
import * as Entities from '@/core/entities.ts';
import {player,playerPos} from '@/actors/player.ts';
import {Npc} from '@/actors/npc.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {say} from '@/ui/speech.ts';
import {blip,gunshot} from '@/audio/audio.ts';
import {economy} from '@/core/economy.ts';
import {PARTIES,type PartyId} from '@/places/party-data.ts';
import {ARENA_STAGE,ARENA_W,ARENA_D,ARENA_PAD,GATE,FIELD_W,FIELD_D,BASE_X,ARENA_BARRIERS,arenaGroundY,buildArenaStage} from '../../assets/models/rural/stadium.ts';
import arenaTower from '../../assets/models/missions/arena-tower.ts';
import {makeGangTracerLine} from '../../assets/models/effects/gang-tracer.ts';

// ============================================================================
// PARTY ARENA — the MOBA-style battle round on the stadium pitch (see
// assets/models/rural/stadium.ts for the building). Party members only: E at
// the sealed gate teleports you onto your party's base pad. Both parties keep
// spawning fighters from their end; each side fields two guard towers. Free-
// fire zone: every arena kill carries ZERO wanted heat, so the police never
// come. Win by wiping the enemy side — every fighter (roster + alive) AND both
// towers — and you reappear outside the gate with the round win (+ prize).
// Losing your life ends the round (normal WASTED flow) — the arena cleans up.
//
// ONLINE: the arena is a real place in the single shared world, so other
// players who enter are visible and PvP works exactly like anywhere else —
// friends can fight for the same party or against each other. (Fighters and
// towers are simulated per-client, like all NPCs in this game.)
// ============================================================================

const ROSTER=8;        // fighters per party per round (spawned in waves)
const ALIVE_CAP=3;     // max simultaneous fighters per side
const SPAWN_T=3.5;     // seconds between wave spawns
const TOWER_HP=14;     // weapon hits to destroy a guard tower
const PRIZE=200;       // round win prize

const FIGHT_R=42;      // fighter gun range on the larger real-scale pitch
const TOWER_R=36;      // tower gun range
const MOVE_SPEED=5.4;  // arena fighters move briskly enough to route around cover
const HOLD_R=18;       // preferred firing distance before holding/strafe behavior
const NAV_PAD=2.8;     // clearance used around paintball barriers for path points
const NAV_REPATH=.55;  // seconds to keep a chosen cover waypoint
const STUCK_REPATH=.35;// seconds with almost no movement before forcing a sidestep
const SEP_R=1.1;       // lightweight crowd separation so waves do not jam each other
const _dir=new THREE.Vector3();
const arenaStage=buildArenaStage();
scene.add(arenaStage);

class ArenaFighter extends Npc{
  team!:PartyId;
  shootT!:number;
  bob!:number;
  navX=0;navZ=0;navT=0;
  stuckT=0;lastX=0;lastZ=0;
  strafe=1;
  override aliveState():string{return 'Fighting in the arena';}
}

class ArenaTower extends Npc{
  team!:PartyId;
  shootT!:number;
  // towers do not bleed or ragdoll — death is handled by the arena loop (boom)
  override takeDamage(dir?:THREE.Vector3,dmg=1){
    if(this.dead)return;
    this.hp-=dmg;
    if(this.hp<=0)this.kill(dir);
  }
  override kill(dir?:THREE.Vector3){
    if(this.dead)return;
    this.dead=true;
    this.onDeath?.(dir);
  }
  override aliveState():string{return 'Guarding';}
}

interface Tracer{line:THREE.Line;t:number;}
const tracers:Tracer[]=[];
function addTracer(a:THREE.Vector3,b:THREE.Vector3){
  const line=makeGangTracerLine(a,b);
  scene.add(line);tracers.push({line,t:0});
}

interface SideState{
  team:PartyId;
  base:{x:number;z:number};
  remaining:number;      // roster still to spawn
  spawnT:number;
  fighters:ArenaFighter[];
  towers:ArenaTower[];
}
let match:{sides:Record<PartyId,SideState>;me:PartyId}|null=null;
let entering=false;
let fadeOverlay:HTMLDivElement|null=null;

type Box2={x0:number;x1:number;z0:number;z1:number};

function ensureFadeOverlay():HTMLDivElement{
  if(fadeOverlay)return fadeOverlay;
  const el=document.createElement('div');
  el.id='arena-fade';
  el.style.cssText='position:fixed;inset:0;background:#000;z-index:5000;display:none;'
    +'opacity:0;transition:opacity .18s linear;pointer-events:none;';
  document.body.appendChild(el);
  fadeOverlay=el;
  return el;
}

function enterArenaWithFade(){
  if(entering||match||!state.party)return;
  entering=true;
  state.controlsLocked=true;
  const el=ensureFadeOverlay();
  el.style.display='block';
  requestAnimationFrame(()=>{el.style.opacity='1';});
  window.setTimeout(()=>{
    startMatch();
    window.setTimeout(()=>{
      el.style.opacity='0';
      window.setTimeout(()=>{el.style.display='none';state.controlsLocked=false;entering=false;},220);
    },260);
  },240);
}

function baseOf(team:PartyId):{x:number;z:number}{
  return{x:ARENA_STAGE.x+(team==='red'?-BASE_X:BASE_X),z:ARENA_STAGE.z};
}

function barrierBox(b:(typeof ARENA_BARRIERS)[number]):Box2{
  const cx=ARENA_STAGE.x+b.x,cz=ARENA_STAGE.z+b.z;
  return{x0:cx-b.w/2,x1:cx+b.w/2,z0:cz-b.d/2,z1:cz+b.d/2};
}

function pushOutArenaBarriers(p:{x:number;z:number},r:number){
  for(const b of ARENA_BARRIERS){
    const q=barrierBox(b);
    const cx=clamp(p.x,q.x0,q.x1),cz=clamp(p.z,q.z0,q.z1);
    const dx=p.x-cx,dz=p.z-cz,d2=dx*dx+dz*dz;
    if(d2>=r*r)continue;
    if(d2<1e-6){
      const pl=p.x-q.x0,pr=q.x1-p.x,pt=p.z-q.z0,pb=q.z1-p.z,m=Math.min(pl,pr,pt,pb);
      if(m===pl)p.x=q.x0-r;else if(m===pr)p.x=q.x1+r;
      else if(m===pt)p.z=q.z0-r;else p.z=q.z1+r;
    }else{
      const d=Math.sqrt(d2);p.x=cx+dx/d*r;p.z=cz+dz/d*r;
    }
  }
}

function segHitsBox(ax:number,az:number,bx:number,bz:number,b:Box2):boolean{
  const dx=bx-ax,dz=bz-az;
  let t0=0,t1=1;
  if(Math.abs(dx)<1e-9){if(ax<b.x0||ax>b.x1)return false;}
  else{let ta=(b.x0-ax)/dx,tb=(b.x1-ax)/dx;if(ta>tb){const t=ta;ta=tb;tb=t;}t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1)return false;}
  if(Math.abs(dz)<1e-9){if(az<b.z0||az>b.z1)return false;}
  else{let ta=(b.z0-az)/dz,tb=(b.z1-az)/dz;if(ta>tb){const t=ta;ta=tb;tb=t;}t0=Math.max(t0,ta);t1=Math.min(t1,tb);if(t0>t1)return false;}
  return t1>=t0;
}

function arenaLineBlocked(ax:number,az:number,bx:number,bz:number):boolean{
  for(const b of ARENA_BARRIERS){
    const q=barrierBox(b),pad=.18;
    if(segHitsBox(ax,az,bx,bz,{x0:q.x0-pad,x1:q.x1+pad,z0:q.z0-pad,z1:q.z1+pad}))return true;
  }
  return false;
}

const _navGoal={x:0,z:0};
function arenaMinX(pad=0){return ARENA_STAGE.x-FIELD_W/2+pad;}
function arenaMaxX(pad=0){return ARENA_STAGE.x+FIELD_W/2-pad;}
function arenaMinZ(pad=0){return ARENA_STAGE.z-FIELD_D/2+pad;}
function arenaMaxZ(pad=0){return ARENA_STAGE.z+FIELD_D/2-pad;}
function pointInArena(x:number,z:number,pad=0):boolean{
  return x>=arenaMinX(pad)&&x<=arenaMaxX(pad)&&z>=arenaMinZ(pad)&&z<=arenaMaxZ(pad);
}
function pointBlockedByBarrier(x:number,z:number,r=.55):boolean{
  for(const b of ARENA_BARRIERS){
    const q=barrierBox(b);
    if(x>q.x0-r&&x<q.x1+r&&z>q.z0-r&&z<q.z1+r)return true;
  }
  return false;
}
function setNavGoal(f:ArenaFighter,x:number,z:number,t=NAV_REPATH):boolean{
  x=clamp(x,arenaMinX(NAV_PAD*.5),arenaMaxX(NAV_PAD*.5));
  z=clamp(z,arenaMinZ(NAV_PAD*.5),arenaMaxZ(NAV_PAD*.5));
  if(pointBlockedByBarrier(x,z,.65))return false;
  f.navX=x;f.navZ=z;f.navT=t;
  return true;
}
function scoreNavCandidate(f:ArenaFighter,px:number,pz:number,tx:number,tz:number,x:number,z:number):number{
  if(!pointInArena(x,z,1)||pointBlockedByBarrier(x,z,.65))return Infinity;
  const fromBlocked=arenaLineBlocked(px,pz,x,z),toBlocked=arenaLineBlocked(x,z,tx,tz);
  let turn=Math.atan2(x-px,z-pz)-f.g.rotation.y;
  turn=Math.atan2(Math.sin(turn),Math.cos(turn));
  return Math.hypot(x-px,z-pz)+Math.hypot(tx-x,tz-z)+(fromBlocked?35:0)+(toBlocked?18:0)+Math.abs(turn)*.75;
}
function chooseMoveGoal(f:ArenaFighter,p:THREE.Vector3,tx:number,tz:number):{x:number;z:number}{
  if(!arenaLineBlocked(p.x,p.z,tx,tz)){f.navT=0;_navGoal.x=tx;_navGoal.z=tz;return _navGoal;}
  if(f.navT>0&&!pointBlockedByBarrier(f.navX,f.navZ,.65)&&!arenaLineBlocked(p.x,p.z,f.navX,f.navZ)){
    _navGoal.x=f.navX;_navGoal.z=f.navZ;return _navGoal;
  }
  let bx=tx,bz=tz,bs=Infinity;
  for(const b of ARENA_BARRIERS){
    const q=barrierBox(b),pad=NAV_PAD;
    const pts:[number,number][]=[
      [q.x0-pad,q.z0-pad],[q.x0-pad,q.z1+pad],[q.x1+pad,q.z0-pad],[q.x1+pad,q.z1+pad],
      [(q.x0+q.x1)/2,q.z0-pad],[(q.x0+q.x1)/2,q.z1+pad],[q.x0-pad,(q.z0+q.z1)/2],[q.x1+pad,(q.z0+q.z1)/2],
    ];
    for(const [x,z] of pts){
      const sc=scoreNavCandidate(f,p.x,p.z,tx,tz,x,z);
      if(sc<bs){bs=sc;bx=x;bz=z;}
    }
  }
  if(bs<Infinity&&setNavGoal(f,bx,bz)){
    _navGoal.x=f.navX;_navGoal.z=f.navZ;return _navGoal;
  }
  const dx=tx-p.x,dz=tz-p.z,len=Math.hypot(dx,dz)||1;
  setNavGoal(f,p.x-dz/len*f.strafe*7+dx/len*1.5,p.z+dx/len*f.strafe*7+dz/len*1.5,.4);
  _navGoal.x=f.navX;_navGoal.z=f.navZ;return _navGoal;
}
function updateFighterStuck(f:ArenaFighter,p:THREE.Vector3,tx:number,tz:number,dt:number){
  const moved=Math.hypot(p.x-f.lastX,p.z-f.lastZ);
  const wantsMove=Math.hypot(tx-p.x,tz-p.z)>4;
  f.stuckT=wantsMove&&moved<.025?f.stuckT+dt:Math.max(0,f.stuckT-dt*2);
  f.lastX=p.x;f.lastZ=p.z;
  if(f.stuckT<STUCK_REPATH)return;
  const dx=tx-p.x,dz=tz-p.z,len=Math.hypot(dx,dz)||1;
  f.strafe*=-1;
  setNavGoal(f,p.x-dz/len*f.strafe*8,p.z+dx/len*f.strafe*8,.65);
  f.stuckT=0;
}
function clampArenaFighter(f:ArenaFighter){
  const p=f.g.position;
  p.x=clamp(p.x,arenaMinX(),arenaMaxX());p.z=clamp(p.z,arenaMinZ(),arenaMaxZ());
  pushOutArenaBarriers(p,.48);
  p.y=arenaGroundY(p.x,p.z)+Math.abs(Math.sin(f.bob))*.07;
}
function separateArenaFighters(){
  if(!match)return;
  const fighters:ArenaFighter[]=[];
  for(const team of['red','blue'] as const)for(const f of match.sides[team].fighters)if(!f.dead)fighters.push(f);
  for(let i=0;i<fighters.length;i++)for(let j=i+1;j<fighters.length;j++){
    const a=fighters[i].g.position,b=fighters[j].g.position;
    let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
    if(d>=SEP_R)continue;
    if(d<1e-4){dx=1;dz=0;d=1;}
    const push=(SEP_R-d)*.5,nx=dx/d,nz=dz/d;
    a.x-=nx*push;a.z-=nz*push;b.x+=nx*push;b.z+=nz*push;
  }
  for(const f of fighters)clampArenaFighter(f);
}

function spawnFighter(side:SideState){
  const def=PARTIES[side.team];
  const g=makePed(def.color,def.pants);
  g.position.set(side.base.x+rand(-3,3),arenaGroundY(side.base.x,side.base.z),side.base.z+rand(-3,3));
  const f=new ArenaFighter(g,{
    kind:'arena',hp:1,drop:null,wanted:0,punchToDown:3,showLabel:true,
    area:'Party Arena',dialogues:def.lines,
  });
  f.team=side.team;
  f.shootT=rand(.8,1.8);f.bob=0;
  f.lastX=f.g.position.x;f.lastZ=f.g.position.z;f.strafe=Math.random()<.5?-1:1;
  attachHandGun(f.g,Math.random()<.4?'uzi':'pistol');
  if(Math.random()<.3){const l=f.speakLine();if(l)say(f.g,l,{life:4,alive:()=>!f.dead});}
  side.fighters.push(f);
  side.remaining--;
}

function makeTower(team:PartyId,x:number,z:number):ArenaTower{
  const def=PARTIES[team];
  const g=arenaTower.build({color:def.color});
  g.position.set(x,arenaGroundY(x,z),z);
  scene.add(g);
  const t=new ArenaTower(g,{
    kind:'arena',hp:TOWER_HP,wanted:0,punchToDown:99,showLabel:true,
    name:def.title+' TOWER',gender:'M',femaleLook:false,area:'Party Arena',
  });
  t.team=team;t.shootT=rand(.5,1.5);
  t.onDeath=()=>{
    const p=t.g.position;
    refs.explodeAt?.(new THREE.Vector3(p.x,p.y+1.5,p.z),{noSelf:true});
  };
  return t;
}

function startMatch(){
  if(match||!state.party)return;
  const me=state.party;
  const mk=(team:PartyId):SideState=>({
    team,base:baseOf(team),remaining:ROSTER,spawnT:1,fighters:[],
    towers:team==='red'
      ?[makeTower('red',ARENA_STAGE.x-FIELD_W/2+12,ARENA_STAGE.z-FIELD_D*.28),makeTower('red',ARENA_STAGE.x-FIELD_W/2+12,ARENA_STAGE.z+FIELD_D*.28)]
      :[makeTower('blue',ARENA_STAGE.x+FIELD_W/2-12,ARENA_STAGE.z-FIELD_D*.28),makeTower('blue',ARENA_STAGE.x+FIELD_W/2-12,ARENA_STAGE.z+FIELD_D*.28)],
  });
  match={sides:{red:mk('red'),blue:mk('blue')},me};
  arenaStage.visible=true;
  // free-fire zone: enter clean and at full health, like a fresh round
  state.wanted=0;state.health=100;state.swimming=false;state.swimAir=1;
  const b=baseOf(me);
  player.g.position.set(b.x,arenaGroundY(b.x,b.z),b.z);
  player.heading=me==='red'?Math.PI/2:-Math.PI/2; // face the enemy end
  player.g.rotation.y=player.heading;
  const enemy=PARTIES[me==='red'?'blue':'red'];
  bigText('ROUND START','var(--gold)');setTimeout(hideBig,1500);
  message(`WIPE OUT THE ${enemy.title} - EVERY FIGHTER AND BOTH TOWERS!`,enemy.css);
  blip([392,523,659],.09,'square',.18);
}

function cleanup(){
  if(!match)return;
  for(const team of['red','blue'] as const){
    const s=match.sides[team];
    for(const f of s.fighters)f.despawn();
    for(const t of s.towers)t.despawn();
  }
  for(const t of tracers){Entities.disposeGeometries(t.line);scene.remove(t.line);}
  tracers.length=0;
  arenaStage.visible=false;
  match=null;
}


function respawnAtBase(){
  if(!match)return;
  const me=match.me,def=PARTIES[me],b=baseOf(me);
  state.health=100;state.wanted=0;state.bustT=0;
  state.swimming=false;state.swimAir=1;state.controlsLocked=false;
  player.g.visible=true;
  player.g.position.set(b.x,arenaGroundY(b.x,b.z),b.z);
  player.heading=me==='red'?Math.PI/2:-Math.PI/2;
  player.g.rotation.set(0,player.heading,0);
  message('DOWNED - BACK TO YOUR BASE',def.css);
  blip([220,330,523],.08,'triangle',.16);
}

refs.isPartyArenaActive=()=>!!match;
refs.partyArenaGroundHeight=(x:number,z:number)=>{
  if(!match)return undefined;
  return Math.abs(x-ARENA_STAGE.x)<=ARENA_W/2+ARENA_PAD
    &&Math.abs(z-ARENA_STAGE.z)<=ARENA_D/2+ARENA_PAD
    ?ARENA_STAGE.y:undefined;
};
refs.handlePartyArenaDeath=()=>{
  if(!match)return false;
  respawnAtBase();
  return true;
};
refs.isFriendlyWeaponTarget=(target:any)=>!!match&&target?.kind==='arena'&&target?.team===match.me;
// Win/forfeit return the player to the exterior gate. Being downed inside the
// arena is handled by respawnAtBase(): no hospital, no death pool, no round cleanup.
function endMatch(won:boolean,forfeit=false){
  if(!match)return;
  const me=match.me,def=PARTIES[me];
  cleanup();
  if(won||forfeit){
    player.g.position.set(GATE.x-4,groundHeight(GATE.x-4,GATE.z),GATE.z);
    player.heading=-Math.PI/2;player.g.rotation.y=player.heading;
  }
  if(won){
    economy.earn(PRIZE,'arena');
    bigText('VICTORY!',def.css);setTimeout(hideBig,2000);
    message(`YOU WON THIS ROUND FOR THE ${def.title}! +$${PRIZE}`,def.css);
    blip([523,659,784,1047],.1,'square',.2);
  }else if(forfeit){
    message('ROUND FORFEITED - COME BACK STRONGER','var(--pink)');
  }else{
    message('YOU WENT DOWN - THE ROUND IS LOST','var(--pink)');
  }
}

// A fighter/tower firing at the local player (same hitscan feel as gang fire).
function shootPlayer(from:THREE.Vector3,pp:THREE.Vector3,dist:number,dmgLo:number,dmgHi:number,hitBase:number){
  const hit=Math.random()<clamp(hitBase-dist*.015,.2,.85);
  const to=new THREE.Vector3(pp.x,pp.y+1.1,pp.z);
  if(!hit){const a=rand(0,Math.PI*2);to.x+=Math.cos(a)*rand(.8,2.2);to.z+=Math.sin(a)*rand(.8,2.2);}
  addTracer(from,to);
  gunshot(.3);
  if(hit){
    state.health-=irand(dmgLo,dmgHi);
    state.shake=Math.max(state.shake,.14);
    refs.spawnBlood?.(pp.x,pp.y+1.1,pp.z,_dir.subVectors(to,from).normalize(),7);
    if(state.health<=0)respawnAtBase();
  }
}

// A fighter/tower firing at an enemy NPC. Arena units carry wanted:0, so these
// kills never give the local player heat — the police have no reason to come.
function shootNpc(from:THREE.Vector3,t:Npc,dmg:number){
  const tp=t.g.position;
  const to=new THREE.Vector3(tp.x,tp.y+1.1,tp.z);
  addTracer(from,to);
  gunshot(.25);
  t.takeDamage(_dir.set(tp.x-from.x,0,tp.z-from.z).normalize(),dmg,to);
}

// Everything the enemy side still has on the pitch (fighters + towers + the
// player when they fight for the other party).
function pickTarget(x:number,z:number,team:PartyId,range:number,requireSight=true):{kind:'npc'|'player';npc?:Npc;d:number}|null{
  const foe=team==='red'?'blue':'red';
  const s=match!.sides[foe];
  let best:Npc|null=null,bd=range;
  for(const f of s.fighters){
    if(f.dead)continue;
    const d=Math.hypot(f.g.position.x-x,f.g.position.z-z);
    if(d<bd&&(!requireSight||!arenaLineBlocked(x,z,f.g.position.x,f.g.position.z))){bd=d;best=f;}
  }
  for(const t of s.towers){
    if(t.dead)continue;
    const d=Math.hypot(t.g.position.x-x,t.g.position.z-z);
    if(d<bd&&(!requireSight||!arenaLineBlocked(x,z,t.g.position.x,t.g.position.z))){bd=d;best=t;}
  }
  if(match!.me!==team){
    const pp=playerPos();
    const d=Math.hypot(pp.x-x,pp.z-z);
    if(d<bd&&(!requireSight||!arenaLineBlocked(x,z,pp.x,pp.z)))return{kind:'player',d};
  }
  return best?{kind:'npc',npc:best,d:bd}:null;
}

export function updatePartyArena(dt:number){
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.t+=dt;
    (t.line.material as THREE.Material).opacity=Math.max(0,.9-t.t*7);
    if(t.t>.15){Entities.disposeGeometries(t.line);scene.remove(t.line);tracers.splice(i,1);}
  }
  if(!match)return;
  const pp=playerPos();
  // safety: the player left the pitch through some other flow (busted, hospital,
  // remote-PvP death, ...) — tear the round down silently
  if(Math.hypot(pp.x-ARENA_STAGE.x,pp.z-ARENA_STAGE.z)>ARENA_W){cleanup();return;}
  pp.x=clamp(pp.x,ARENA_STAGE.x-FIELD_W/2-ARENA_PAD,ARENA_STAGE.x+FIELD_W/2+ARENA_PAD);
  pp.z=clamp(pp.z,ARENA_STAGE.z-FIELD_D/2-ARENA_PAD,ARENA_STAGE.z+FIELD_D/2+ARENA_PAD);
  pushOutArenaBarriers(pp,.62);
  pp.y=arenaGroundY(pp.x,pp.z);

  for(const team of['red','blue'] as const){
    const s=match.sides[team];
    // waves keep coming from this side's end while the roster lasts
    s.spawnT-=dt;
    const alive=s.fighters.reduce((n,f)=>n+(f.dead?0:1),0);
    if(s.spawnT<=0){
      if(s.remaining>0&&alive<ALIVE_CAP)spawnFighter(s);
      s.spawnT=SPAWN_T;
    }
    // towers hold their ground and shell anything hostile in range
    for(let i=s.towers.length-1;i>=0;i--){
      const t=s.towers[i];
      if(t.dead){t.despawn();s.towers.splice(i,1);continue;}
      t.shootT-=dt;
      if(t.shootT>0)continue;
      const tgt=pickTarget(t.g.position.x,t.g.position.z,team,TOWER_R);
      if(!tgt)continue;
      t.shootT=1.2;
      const from=t.g.position.clone();from.y+=(t.g.userData.muzzleY as number)||4.2;
      if(tgt.kind==='player')shootPlayer(from,pp,tgt.d,6,11,.9);
      else shootNpc(from,tgt.npc!,2);
      if(!match)return; // round ended during this volley
    }
    // fighters push toward the enemy end, engaging whatever they meet
    for(let i=s.fighters.length-1;i>=0;i--){
      const f=s.fighters[i],p=f.g.position;
      if(f.dead){
        if(f.updateRagdoll(dt)){f.despawn();s.fighters.splice(i,1);}
        continue;
      }
      let mv=0;
      f.navT=Math.max(0,f.navT-dt);
      const tgt=pickTarget(p.x,p.z,team,999,false);
      let gx:number,gz:number;
      if(tgt&&tgt.kind==='player'){gx=pp.x;gz=pp.z;}
      else if(tgt){gx=tgt.npc!.g.position.x;gz=tgt.npc!.g.position.z;}
      else{const eb=match.sides[team==='red'?'blue':'red'].base;gx=eb.x;gz=eb.z;}
      const rawD=Math.hypot(gx-p.x,gz-p.z),blocked=arenaLineBlocked(p.x,p.z,gx,gz);
      updateFighterStuck(f,p,gx,gz,dt);
      const goal=chooseMoveGoal(f,p,gx,gz);
      const md=Math.hypot(goal.x-p.x,goal.z-p.z);
      if(md>.25&&(blocked||rawD>HOLD_R||!tgt)){
        _dir.set(goal.x-p.x,0,goal.z-p.z).normalize();
        f.g.rotation.y=Math.atan2(_dir.x,_dir.z);
        p.addScaledVector(_dir,(blocked?MOVE_SPEED:4.7)*dt);mv=.9;f.bob+=dt*10;
      }else if(tgt&&!blocked&&rawD<FIGHT_R&&rawD>5){
        const dx=gx-p.x,dz=gz-p.z,len=Math.hypot(dx,dz)||1;
        const sx=-dz/len*f.strafe,sz=dx/len*f.strafe;
        if(!pointBlockedByBarrier(p.x+sx*.8,p.z+sz*.8,.5)){
          p.x+=sx*2.1*dt;p.z+=sz*2.1*dt;mv=.38;f.bob+=dt*6;
        }
        f.g.rotation.y=Math.atan2(dx,dz);
      }
      clampArenaFighter(f);
      f.shootT-=dt;
      const shotD=Math.hypot(gx-p.x,gz-p.z),clearShot=!!tgt&&shotD<FIGHT_R&&!arenaLineBlocked(p.x,p.z,gx,gz);
      if(clearShot&&f.shootT<=0){
        f.shootT=rand(1.0,1.8);
        const from=p.clone();from.y+=1.25;
        if(tgt!.kind==='player')shootPlayer(from,pp,shotD,4,9,.8);
        else shootNpc(from,tgt!.npc!,1);
        if(!match)return; // round ended during this loop
      }
      Entities.animatePed?.(f.g,f.bob,mv);
      if(clearShot)poseAiming(f.g);
    }
  }
  separateArenaFighters();
  // round win: the ENEMY side has nothing left — roster spent, pitch clear,
  // towers rubble ("push to their end and kill them all")
  if(match){
    const foe=match.sides[match.me==='red'?'blue':'red'];
    const foeAlive=foe.fighters.some(f=>!f.dead)||foe.remaining>0||foe.towers.some(t=>!t.dead);
    if(!foeAlive)endMatch(true);
  }
}

// Gate interaction: enter (members only) / forfeit from your base pad.
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='foot'||state.cine||state.dlgActive)return null;
  const pp=playerPos();
  if(!match){
    if(entering)return null;
    if(Math.hypot(pp.x-GATE.x,pp.z-GATE.z)>4.5)return null;
    if(!state.party)
      return{label:'ARENA',prompt:'PARTY ARENA: MEMBERS ONLY - AFFILIATE FIRST',enabled:false,run:()=>{}};
    return{label:'ARENA',prompt:'APERTE INTERAGIR PARA ENTRAR NA ARENA',
      enabled:true,run:enterArenaWithFade};
  }
  const b=baseOf(match.me);
  if(Math.hypot(pp.x-b.x,pp.z-b.z)<3.5)
    return{label:'LEAVE',prompt:'LEAVE THE ARENA (FORFEIT THE ROUND)',enabled:true,
      run:()=>endMatch(false,true)};
  return null;
});

// Radar/full-map marker at the stadium gate (hidden while a round is running —
// the player is already inside).
(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  match?[]:[{x:GATE.x,z:GATE.z,color:'#ffd24a',label:'ARENA'}]);

// Debug/test snapshot (render_game_to_text)
export function getPartyArenaState(){
  if(!match)return{active:false,gate:GATE,stage:ARENA_STAGE,field:{w:FIELD_W,d:FIELD_D}};
  const side=(t:PartyId)=>{
    const s=match!.sides[t];
    return{remaining:s.remaining,alive:s.fighters.filter(f=>!f.dead).length,
      towers:s.towers.filter(t2=>!t2.dead).length};
  };
  return{active:true,me:match.me,red:side('red'),blue:side('blue'),gate:GATE,stage:ARENA_STAGE,field:{w:FIELD_W,d:FIELD_D}};
}
