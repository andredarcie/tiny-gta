import * as THREE from 'three';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {rand,irand,clamp,groundHeight} from '@/core/constants.ts';
import {makePed,attachHandGun,poseAiming} from '@/core/entities.ts';
import * as Entities from '@/core/entities.ts';
import {player,playerPos,getWasted} from '@/actors/player.ts';
import {Npc} from '@/actors/npc.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {say} from '@/ui/speech.ts';
import {blip,gunshot} from '@/audio/audio.ts';
import {economy} from '@/core/economy.ts';
import {PARTIES,type PartyId} from '@/places/party-data.ts';
import {STADIUM,GATE,FIELD_W,FIELD_D,BASE_X} from '../../assets/models/rural/stadium.ts';
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

const FIGHT_R=30;      // fighter gun range
const TOWER_R=26;      // tower gun range
const _dir=new THREE.Vector3();

class ArenaFighter extends Npc{
  team!:PartyId;
  shootT!:number;
  bob!:number;
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

function baseOf(team:PartyId):{x:number;z:number}{
  return{x:STADIUM.x+(team==='red'?-BASE_X:BASE_X),z:STADIUM.z};
}

function spawnFighter(side:SideState){
  const def=PARTIES[side.team];
  const g=makePed(def.color,def.pants);
  g.position.set(side.base.x+rand(-2,2),0,side.base.z+rand(-2,2));
  const f=new ArenaFighter(g,{
    kind:'arena',hp:1,drop:[10,30],wanted:0,punchToDown:3,showLabel:true,
    area:'Party Arena',dialogues:def.lines,
  });
  f.team=side.team;
  f.shootT=rand(.8,1.8);f.bob=0;
  attachHandGun(f.g,Math.random()<.4?'uzi':'pistol');
  if(Math.random()<.3){const l=f.speakLine();if(l)say(f.g,l,{life:4,alive:()=>!f.dead});}
  side.fighters.push(f);
  side.remaining--;
}

function makeTower(team:PartyId,x:number,z:number):ArenaTower{
  const def=PARTIES[team];
  const g=arenaTower.build({color:def.color});
  g.position.set(x,groundHeight(x,z),z);
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
      ?[makeTower('red',STADIUM.x-12,STADIUM.z-8),makeTower('red',STADIUM.x-12,STADIUM.z+8)]
      :[makeTower('blue',STADIUM.x+12,STADIUM.z-8),makeTower('blue',STADIUM.x+12,STADIUM.z+8)],
  });
  match={sides:{red:mk('red'),blue:mk('blue')},me};
  // free-fire zone: enter clean and at full health, like a fresh round
  state.wanted=0;state.health=100;
  const b=baseOf(me);
  player.g.position.set(b.x,groundHeight(b.x,b.z),b.z);
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
  match=null;
}

// won=false + forfeit=false means the player went down: the WASTED flow owns
// the teleport (hospital) — the arena only cleans itself up.
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
    if(state.health<=0){
      state.health=100;
      endMatch(false);   // clean the arena up FIRST, then the normal WASTED flow
      getWasted();
    }
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
function pickTarget(x:number,z:number,team:PartyId,range:number):{kind:'npc'|'player';npc?:Npc;d:number}|null{
  const foe=team==='red'?'blue':'red';
  const s=match!.sides[foe];
  let best:Npc|null=null,bd=range;
  for(const f of s.fighters){
    if(f.dead)continue;
    const d=Math.hypot(f.g.position.x-x,f.g.position.z-z);
    if(d<bd){bd=d;best=f;}
  }
  for(const t of s.towers){
    if(t.dead)continue;
    const d=Math.hypot(t.g.position.x-x,t.g.position.z-z);
    if(d<bd){bd=d;best=t;}
  }
  if(match!.me!==team){
    const pp=playerPos();
    const d=Math.hypot(pp.x-x,pp.z-z);
    if(d<bd)return{kind:'player',d};
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
  if(Math.hypot(pp.x-STADIUM.x,pp.z-STADIUM.z)>90){cleanup();return;}

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
      if(!match)return; // the player went down mid-volley — round torn down
    }
    // fighters push toward the enemy end, engaging whatever they meet
    for(let i=s.fighters.length-1;i>=0;i--){
      const f=s.fighters[i],p=f.g.position;
      if(f.dead){
        if(f.updateRagdoll(dt)){f.despawn();s.fighters.splice(i,1);}
        continue;
      }
      let mv=0;
      const tgt=pickTarget(p.x,p.z,team,999);
      let gx:number,gz:number;
      if(tgt&&tgt.kind==='player'){gx=pp.x;gz=pp.z;}
      else if(tgt){gx=tgt.npc!.g.position.x;gz=tgt.npc!.g.position.z;}
      else{const eb=match.sides[team==='red'?'blue':'red'].base;gx=eb.x;gz=eb.z;}
      const d=Math.hypot(gx-p.x,gz-p.z);
      if(d>.1){
        _dir.set(gx-p.x,0,gz-p.z).normalize();
        f.g.rotation.y=Math.atan2(_dir.x,_dir.z);
        if(d>12){p.addScaledVector(_dir,4.4*dt);mv=.85;f.bob+=dt*10;}
      }
      // keep the brawl on the pitch
      p.x=clamp(p.x,STADIUM.x-FIELD_W/2,STADIUM.x+FIELD_W/2);
      p.z=clamp(p.z,STADIUM.z-FIELD_D/2,STADIUM.z+FIELD_D/2);
      f.shootT-=dt;
      if(tgt&&f.shootT<=0&&tgt.d<FIGHT_R){
        f.shootT=rand(1.0,1.8);
        const from=p.clone();from.y+=1.25;
        if(tgt.kind==='player')shootPlayer(from,pp,tgt.d,4,9,.8);
        else shootNpc(from,tgt.npc!,1);
        if(!match)return; // player death ended the round mid-loop
      }
      p.y=groundHeight(p.x,p.z)+Math.abs(Math.sin(f.bob))*.07;
      Entities.animatePed?.(f.g,f.bob,mv);
      if(tgt&&tgt.d<FIGHT_R)poseAiming(f.g);
    }
  }
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
    if(Math.hypot(pp.x-GATE.x,pp.z-GATE.z)>4.5)return null;
    if(!state.party)
      return{label:'ARENA',prompt:'PARTY ARENA: MEMBERS ONLY - AFFILIATE FIRST',enabled:false,run:()=>{}};
    return{label:'ARENA',prompt:`ENTER THE ARENA - FIGHT FOR THE ${PARTIES[state.party].title}`,
      enabled:true,run:startMatch};
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
  if(!match)return{active:false,gate:GATE};
  const side=(t:PartyId)=>{
    const s=match!.sides[t];
    return{remaining:s.remaining,alive:s.fighters.filter(f=>!f.dead).length,
      towers:s.towers.filter(t2=>!t2.dead).length};
  };
  return{active:true,me:match.me,red:side('red'),blue:side('blue'),gate:GATE};
}
