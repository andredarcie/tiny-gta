import * as THREE from 'three';
import {rand,irand,clamp,nodeX,groundHeight} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {makePed,attachHandGun,poseAiming} from '@/core/entities.ts';
import * as Entities from '@/core/entities.ts';
import {collideStatics,addWanted,hasLineOfSight} from '@/core/physics.ts';
import {blip,thud,gunshot} from '@/audio/audio.ts';
import {message} from '@/ui/hud.ts';
import {playerPos,getWasted} from '@/actors/player.ts';
import {interiors} from '@/world/interior.ts';
import {makeGangTracerLine} from '../../assets/models/effects/gang-tracer.ts';
import {MiniGameId} from '@/activities/minigame.ts';
import {Npc} from '@/actors/npc.ts';
import {say} from '@/ui/speech.ts';
import {PARTIES,partyRelation,type PartyId} from '@/places/party-data.ts';

// A gang faction with a circular territory. The two gangs are the street wings
// of the two POLITICAL PARTIES (see js/places/party-data.ts): the player's
// affiliation (state.party) decides whether a wing is neutral, an ally that
// backs them up, or an enemy that shoots on sight.
interface Gang{
  name:string;
  party:PartyId;
  color:number;
  pants:number;
  css:string;
  cssA:string;
  x:number;z:number;r:number;
  spawnT:number;
  alarmT:number;
  wasInside:boolean;
  remaining:number;
  defeated:boolean;
}

// A single armed gang member on the street. Extends Npc so bullets / punches /
// explosions all go through the unified combat registry (npcs[]).
export class GangMember extends Npc{
  gang!:Gang;
  aiState!:string; // 'walk'|'aggro'|'assist'  (dead/grounded live on the base Npc)
  t!:number;
  bob!:number;
  shootT!:number;
  chatT!:number;   // countdown to the next satirical street line near the player
  tgt!:THREE.Vector3|null;
  tgtT!:number;
  override aliveState():string{
    return this.aiState==='aggro'?'Attacking'
      :this.aiState==='assist'?'Backing you up':'Roaming turf';
  }
  override pathTarget():{x:number;z:number}|null{return this.tgt?{x:this.tgt.x,z:this.tgt.z}:null;}
}

// A bullet-trail line that fades out over a fraction of a second.
interface Tracer{line:THREE.Line;t:number;}

function inSpecialZone(x:number,z:number):boolean{
  for(const it of interiors){const e=it.exterior;
    if(e&&Math.hypot(x-e.x,z-e.z)<e.r)return true;}
  return false;
}
function repelFromZones(p:THREE.Vector3){
  for(const it of interiors){const e=it.exterior;if(!e)continue;
    const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz);
    if(d<e.r){
      if(d<1e-3){p.x=e.x+e.r;}
      else{p.x=e.x+dx/d*e.r;p.z=e.z+dz/d*e.r;}
    }
  }
}

const GANG_MIN_R=12, GANG_R0=44, KILL_SHRINK=5;
const GANG_ROSTER=7;
const GANG_ALIVE=3;
const ASSIST_R=42; // how far a member scans for foot officers / rival members to engage
export const gangs:Gang[]=[
  {name:PARTIES.red.title, party:'red', color:PARTIES.red.color,pants:PARTIES.red.pants,
   css:PARTIES.red.css,cssA:PARTIES.red.cssA,
   x:nodeX(6)+22,z:nodeX(1)+22,r:GANG_R0} as unknown as Gang,
  {name:PARTIES.blue.title, party:'blue', color:PARTIES.blue.color,pants:PARTIES.blue.pants,
   css:PARTIES.blue.css,cssA:PARTIES.blue.cssA,
   x:nodeX(1)+22,z:nodeX(6)+22,r:GANG_R0} as unknown as Gang,
];
for(const g of gangs){g.spawnT=rand(4,10);g.alarmT=0;g.wasInside=false;g.remaining=GANG_ROSTER;g.defeated=false;}

export function inGangTerritory(x:number,z:number,margin=0):boolean{
  for(const g of gangs){
    if(g.defeated)continue;
    if(Math.hypot(x-g.x,z-g.z)<g.r+margin)return true;
  }
  return false;
}

export const gangPeds:GangMember[]=[];

const _gdir=new THREE.Vector3();
const GANG_CULL2=105*105; // perf: 130→105 (consistente com peds; membros distantes são SkinnedMesh de ~7930 tris)

let gangsHidden=false;
let gangsPaused=false;
export function setGangsHidden(h:boolean){
  gangsHidden=h;
  applyGangsVisibility();
}
function applyGangsVisibility(){
  const sessionPausesGangs=!!state.activeMiniGame&&state.activeMiniGame!==MiniGameId.RAMPAGE;
  const paused=gangsHidden||sessionPausesGangs;
  if(paused===gangsPaused)return;
  gangsPaused=paused;
  for(const m of gangPeds)m.g.visible=!paused;
}

function gangCasualty(m:GangMember){
  // Blood and drop are handled by the base Npc.kill(); only territory effects here.
  m.gang.r=Math.max(GANG_MIN_R,m.gang.r-KILL_SHRINK);
  m.gang.alarmT=9;
}

function spawnMember(gang:Gang){
  if(gang.remaining<=0)return;
  const pp=playerPos();
  let x=gang.x,z=gang.z;
  for(let k=0;k<24;k++){
    const a=rand(0,Math.PI*2),d=Math.sqrt(Math.random())*gang.r*.9;
    x=gang.x+Math.cos(a)*d;z=gang.z+Math.sin(a)*d;
    if(Math.hypot(x-pp.x,z-pp.z)>26&&!inSpecialZone(x,z))break;
  }
  const g=makePed(gang.color,gang.pants);
  g.position.set(x,0,z);
  collideStatics(g.position,.4);
  repelFromZones(g.position);
  const m=new GangMember(g,{
    kind:'gang',hp:1,drop:[25,90],wanted:0.4,wantedMsg:'',crime:'ped_shot',
    punchToDown:4,showLabel:true,area:gang.name+' turf',
    dialogues:PARTIES[gang.party].lines, // satirical party chatter (speakLine)
  });
  m.gang=gang;
  m.aiState='walk';
  m.t=0;m.bob=0;m.chatT=rand(3,10);
  m.shootT=rand(.6,1.6);m.tgt=null;m.tgtT=0;
  m.onDeath=()=>gangCasualty(m);
  attachHandGun(m.g,Math.random()<.45?'uzi':'pistol');
  gangPeds.push(m);
  gang.remaining--;
}

export function spawnInitialGangs(){
  for(const g of gangs)for(let k=0;k<GANG_ALIVE;k++)spawnMember(g);
}

const tracers:Tracer[]=[];
function addTracer(a:THREE.Vector3,b:THREE.Vector3){
  const line=makeGangTracerLine(a,b);
  scene.add(line);tracers.push({line,t:0});
}

// NPC-vs-NPC gunfire: a member shooting a foot officer (backing the player up)
// or a rival party's member. Same hitscan/tracer feel as memberShoot, but the
// kill is the GANG's doing, not the player's — so the target's wanted bounty is
// suppressed around the hit (same idiom as the hit-and-run path below).
function memberShootNpc(m:GangMember,t:Npc,dist:number){
  m.shootT=rand(1.1,1.9);
  const from=m.g.position.clone();from.y+=1.25;
  const tp=t.g.position;
  const hit=Math.random()<clamp(.8-dist*.018,.18,.8);
  const to=new THREE.Vector3(tp.x,tp.y+1.1,tp.z);
  if(!hit){
    const a=rand(0,Math.PI*2);
    to.x+=Math.cos(a)*rand(.8,2.2);to.z+=Math.sin(a)*rand(.8,2.2);
  }
  addTracer(from,to);
  gunshot(.3);
  if(hit){
    // this kill belongs to the GANG, not the player: no wanted bounty and no
    // bump to state.kills (rampage progress / session stat)
    const w=t.wanted,k=state.kills;
    t.takeDamage(new THREE.Vector3(tp.x-from.x,0,tp.z-from.z).normalize(),1,to);
    t.wanted=w;
    if(t.dead&&state.kills>k)state.kills=k;
  }
}

function memberShoot(m:GangMember,pp:THREE.Vector3,dist:number){
  m.shootT=rand(1.1,1.9);
  const from=m.g.position.clone();from.y+=1.25;
  const hit=Math.random()<clamp(.8-dist*.018,.18,.8);
  const to=new THREE.Vector3(pp.x,pp.y+1.1,pp.z);
  if(!hit){
    const a=rand(0,Math.PI*2);
    to.x+=Math.cos(a)*rand(.8,2.2);to.z+=Math.sin(a)*rand(.8,2.2);
  }
  addTracer(from,to);
  gunshot(.35);
  if(hit){
    state.health-=state.mode==='car'?irand(2,5):irand(5,10);
    state.shake=Math.max(state.shake,.14);
    refs.spawnBlood?.(pp.x,pp.y+1.1,pp.z,new THREE.Vector3(to.x-from.x,to.y-from.y,to.z-from.z).normalize(),7);
    if(state.health<=0){state.health=100;getWasted();}
  }
}

export function updateGangs(dt:number){
  applyGangsVisibility();
  if(gangsPaused)return;
  const pp=playerPos();
  const c=refs.getCur?.();
  const danger=state.mode==='car'&&c&&Math.abs(c.speed)>6;
  const playerSafe=inSpecialZone(pp.x,pp.z);
  for(const g of gangs){
    if(g.defeated)continue;
    g.alarmT=Math.max(0,g.alarmT-dt);
    const inside=Math.hypot(pp.x-g.x,pp.z-g.z)<g.r&&!playerSafe;
    if(inside&&!g.wasInside&&state.started&&state.mode!=='cut'){
      const rel=partyRelation(state.party,g.party);
      message(rel==='ally'?g.name+' TURF - YOU ARE AMONG FRIENDS'
        :rel==='enemy'?g.name+' TERRITORY - THEY WANT YOU DEAD!'
        :g.name+' TERRITORY',g.css);
    }
    g.wasInside=inside;
    let live=0;for(const m of gangPeds)if(m.gang===g&&!m.dead)live++;
    g.spawnT-=dt;
    if(g.spawnT<=0){
      if(g.remaining>0&&live<GANG_ALIVE)spawnMember(g);
      g.spawnT=clamp(46-g.r*.55,12,40)*rand(.85,1.25);
    }
    if(g.remaining<=0&&live===0){
      g.defeated=true;g.r=0;g.wasInside=false;
      if(state.started)message(g.name+' WIPED OUT!',g.css);
      blip([523,659,784,1047],.1,'square',.2);
    }
  }
  for(let i=gangPeds.length-1;i>=0;i--){
    const m=gangPeds[i],p=m.g.position;
    if(m.dead){
      // Use the base ragdoll; despawn once the body has faded.
      if(m.updateRagdoll(dt)){
        m.despawn(); // removes from npcs[] + scene
        gangPeds.splice(i,1);
      }
      continue;
    }
    // Hit by a fast car: manually trigger death (different wanted path handled here).
    if(danger&&p.distanceTo(c!.g.position)<2.3){
      const mw=m.wanted;m.wanted=0; // hit-and-run heat is the single +1 below, not the base kill()'s 0.4
      m.kill(new THREE.Vector3(Math.sin(c!.heading),0,Math.cos(c!.heading)).multiplyScalar(c!.speed*.4));
      m.wanted=mw;
      addWanted(1,'HIT AND RUN!','hit_run');
      thud(Math.abs(c!.speed));state.shake=.35;
      continue;
    }
    const g=m.gang;
    const distP=Math.hypot(pp.x-p.x,pp.z-p.z);
    if(distP*distP>=GANG_CULL2){m.g.visible=false;continue;} // GANG_CULL2 is squared (130m)
    if(!gangsPaused)m.g.visible=true;
    if(!m.g.visible)continue;
    // Party relations decide who this wing shoots at (see js/places/party-data.ts):
    //  - enemy party  -> the player, on sight near the turf;
    //  - no party     -> the player only in self-defence (alarm after a casualty);
    //  - ally party   -> never the player; instead they BACK THE PLAYER UP,
    //    shooting nearby foot officers while the player is wanted.
    //  - the rival wing's members are enemies of this wing regardless.
    const rel=partyRelation(state.party,g.party);
    const hostile=rel==='enemy'||(rel==='neutral'&&g.alarmT>0);
    const aggro=state.started&&state.mode!=='cut'&&!playerSafe
      &&hostile&&distP<g.r+30;
    let mvAmount=0;
    let fighting=aggro;
    if(aggro){
      m.aiState='aggro'; // mirror state for the roster
      const dir=_gdir.set(pp.x-p.x,0,pp.z-p.z).normalize();
      m.g.rotation.y=Math.atan2(dir.x,dir.z);
      if(distP>13){p.addScaledVector(dir,4.6*dt);mvAmount=.85;m.bob+=dt*10;}
      m.shootT-=dt;
      // only fire at a target roughly at street level — never up at the police helicopter
      // (or anything else high overhead). Also not at the map-locked player.
      if(m.shootT<=0&&distP<34&&pp.y-p.y<3&&!state.mapOpen&&hasLineOfSight(p.x,p.z,pp.x,pp.z))memberShoot(m,pp,distP);
    }else{
      // Pick an NPC target: the nearest hunting officer (allies only, while the
      // player is wanted) or the nearest rival-party member (always).
      let tgt:Npc|null=null,tgtD=ASSIST_R;
      if(rel==='ally'&&state.wanted>0&&state.started){
        const offs=(refs.getFootOfficers?.()||[]) as Npc[];
        for(const o of offs){
          if(o.dead)continue;
          const d=Math.hypot(o.g.position.x-p.x,o.g.position.z-p.z);
          if(d<tgtD){tgtD=d;tgt=o;}
        }
      }
      for(const r of gangPeds){
        if(r.gang===g||r.dead)continue;
        const d=Math.hypot(r.g.position.x-p.x,r.g.position.z-p.z);
        if(d<tgtD){tgtD=d;tgt=r;}
      }
      if(tgt){
        m.aiState='assist';fighting=true;
        const tp=tgt.g.position;
        const dir=_gdir.set(tp.x-p.x,0,tp.z-p.z).normalize();
        m.g.rotation.y=Math.atan2(dir.x,dir.z);
        if(tgtD>12){p.addScaledVector(dir,4.6*dt);mvAmount=.85;m.bob+=dt*10;}
        m.shootT-=dt;
        if(m.shootT<=0&&tgtD<34&&!state.mapOpen&&hasLineOfSight(p.x,p.z,tp.x,tp.z))memberShootNpc(m,tgt,tgtD);
      }else{
        m.aiState='walk';
        m.tgtT-=dt;
        if(!m.tgt||m.tgtT<=0||p.distanceTo(m.tgt)<1.2){
          const a=rand(0,Math.PI*2),d=Math.sqrt(Math.random())*g.r*.85;
          m.tgt=new THREE.Vector3(g.x+Math.cos(a)*d,0,g.z+Math.sin(a)*d);
          m.tgtT=rand(5,9);
        }
        const dir=_gdir.subVectors(m.tgt,p);dir.y=0;
        if(dir.length()>.1){
          dir.normalize();p.addScaledVector(dir,1.3*dt);
          m.g.rotation.y=Math.atan2(dir.x,dir.z);mvAmount=.3;m.bob+=dt*2.9;
        }
        // Satirical party chatter for anyone close enough to read it (enemies
        // are too busy shooting; the wing only banters while at ease).
        if(distP<16&&state.started){
          m.chatT-=dt;
          if(m.chatT<=0){
            m.chatT=rand(12,26);
            const line=m.speakLine();
            if(line)say(m.g,line,{life:5,alive:()=>!m.dead});
          }
        }
      }
    }
    collideStatics(p,.4);
    repelFromZones(p);
    p.y=groundHeight(p.x,p.z)+Math.abs(Math.sin(m.bob))*.07;
    Entities.animatePed?.(m.g,m.bob,mvAmount);
    if(fighting)poseAiming(m.g);
  }
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.t+=dt;
    (t.line.material as THREE.Material).opacity=Math.max(0,.9-t.t*7);
    if(t.t>.15){Entities.disposeGeometries(t.line);scene.remove(t.line);tracers.splice(i,1);}
  }
}
