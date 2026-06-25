import * as THREE from 'three';
import {N,clamp,rand,wrapA,nodeX,irand,groundHeight} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {makePed,animatePed,spinWheels,dentCar,attachHandGun,poseAiming,disposeGeometries} from '@/core/entities.ts';
import {makeArmyTruck} from '../../assets/models/vehicles/army-truck.ts';
import {makeGangTracerLine} from '../../assets/models/effects/gang-tracer.ts';
import {thud,gunshot} from '@/audio/audio.ts';
import {collideStatics,hasLineOfSight} from '@/core/physics.ts';
import {playerPos,cur,getWasted} from '@/actors/player.ts';
import {message} from '@/ui/hud.ts';
import {Npc} from '@/actors/npc.ts';
import {npcDefsByKind} from '@/core/npc-defs.ts';

// ============================================================================
// ARMY — the MAX-STAR (★6) response. When the player hits 6 stars, ONE green
// camo truck (assets/models/vehicles/army-truck.ts) rolls in with 4 SOLDIERS
// standing in the bed, machine guns in hand. The truck CHASES the player; when
// the player STOPS (on foot, or in a near-stopped car) and the truck gets close,
// the 4 soldiers DISMOUNT and open fire. If the player flees they re-board and
// the hunt resumes. Soldiers die to the player's gunfire/explosions (via
// refs.armyTargets / refs.blastArmy); if the whole squad falls, the truck pulls
// back and a fresh wave arrives a few seconds later.
//
// Modeled on js/actors/police.ts (same cruiser + foot-squad AI), but with a BIGGER
// squad, machine guns (high rate of fire) and the army's own vehicle. It leaves
// once the wanted level drops below 6 (refs cleared on WASTED/BUSTED, like cops).
// ============================================================================

// A soldier's weapon spec: how it fires (rhythm) and how much it hurts.
interface SquadWpn{
  model:string;
  fire:[number,number];
  burst:[number,number];
  gap:[number,number];
  range:number;
  spread:number;
  pellets:number;
  dmgFoot:[number,number];
  dmgCar:[number,number];
  vol:number;
}
// A seat in the truck bed (local transform for a riding soldier).
interface Seat{x:number;y:number;z:number;ry:number;}
// The army truck wrapper.
interface Truck{
  g:THREE.Object3D;
  heading:number;
  speed:number;
  stuckT:number;
  backT:number;
  dentT:number;
  deployed:boolean;
  allDeadAt:number;
  bestDist:number;
  noProgressT:number;
}
// A single soldier (in the bed or on foot). Extends Npc so it shares the base
// identity/death machinery, but with register:false — the army has its OWN target
// list (refs.armyTargets), so it must NOT also join the unified weapon scan, which
// would double-hit it and target riders still in the truck bed.
class Soldier extends Npc{
  seat:Seat;
  wpn:SquadWpn;
  flank:number;
  stop:number;
  mode:string; // 'stationed'|'ride'|'hunt'|'return'
  bob:number;
  shootT:number;
  burstLeft:number;
  restT:number;
  respawnT:number; // >0 = counting down to return from afar after being killed
  constructor(g:THREE.Object3D,seat:Seat,wpn:SquadWpn,flank:number,stop:number,name?:string,gender?:'M'|'F'){
    super(g,{kind:'soldier',hp:1,drop:null,wanted:0,register:false,showLabel:true,area:'Army squad',name,gender});
    this.seat=seat;this.wpn=wpn;this.flank=flank;this.stop=stop;
    this.mode='stationed';this.bob=rand(0,6);this.shootT=0;this.burstLeft=0;this.restT=rand(.2,1);this.respawnT=0;
  }
  override aliveState():string{
    return this.mode==='stationed'?'On standby':this.mode==='ride'?'In the truck':
      this.mode==='return'?'Re-boarding':'Open fire';
  }
}
// A bullet-trail line that fades out over a fraction of a second.
interface Tracer{line:THREE.Line;t:number;}

const ARMY_AT=6;          // wanted star that summons the army (the max)
const TRUCK_MAXSPD=25;    // truck top speed during the chase
const SOLDIER_RESPAWN=5;  // seconds a fallen soldier takes to return from afar
// The FIXED military roster from npcs.json (kind:'military'). These named soldiers are
// created ONCE and reused for every ★6 deployment — never spawned "from beyond".
const MILITARY_DEFS=npcDefsByKind('military');
const SQUAD_SIZE=MILITARY_DEFS.length||3;
const BARRACKS={x:nodeX(0)-400,z:nodeX(0)-400}; // off-map spot where stationed soldiers wait, hidden

// Each soldier carries a DIFFERENT weapon (variety). Fire happens in RHYTHM:
// it fires `burst` shots spaced by `fire` seconds, then PAUSES for `gap` seconds
// (so they don't shoot 100% of the time). `range`=reach, `pellets`=projectiles
// per shot (shotgun spreads), `dmgFoot/Car`=damage on foot / shielded by the car.
const SQUAD:SquadWpn[]=[
  {model:'ak47',   fire:[.12,.20],burst:[3,5], gap:[1.0,2.0],range:34,spread:1.4,pellets:1,dmgFoot:[4,8],dmgCar:[2,4],vol:.32},
  {model:'uzi',    fire:[.06,.11],burst:[6,10],gap:[1.3,2.4],range:24,spread:2.2,pellets:1,dmgFoot:[2,5],dmgCar:[1,2],vol:.24},
  {model:'shotgun',fire:[.70,1.0],burst:[1,1], gap:[.8,1.6], range:15,spread:3.2,pellets:4,dmgFoot:[4,7],dmgCar:[2,4],vol:.5},
  {model:'pistol', fire:[.30,.50],burst:[1,2], gap:[1.1,2.0],range:28,spread:1.2,pellets:1,dmgFoot:[5,9],dmgCar:[2,4],vol:.3},
];

let truck:Truck|null=null;           // the deploy vehicle (created on ★6, removed below)
const soldiers:Soldier[]=[];        // the FIXED named squad (created once by initArmy, reused)
let lastMsg=-99;
const tracers:Tracer[]=[];

const OLIVE=0x4a5320,OLIVE_PANTS=0x2f3318;
const _wp=new THREE.Vector3(),_push=new THREE.Vector3(),_mid=new THREE.Vector3();

// standing pose holding the gun — used both in the bed and when dismounted
function holdPose(o:Soldier){poseAiming(o.g);}

// board/place the soldier in the truck bed (parented to the truck group)
function seatInBed(o:Soldier){
  truck!.g.add(o.g);
  o.g.position.set(o.seat.x,o.seat.y,o.seat.z);
  o.g.rotation.set(0,o.seat.ry,0);
  holdPose(o);
  o.mode='ride';
}

// Park a soldier off-map, hidden, 'stationed' — where the FIXED squad waits between
// ★6 deployments (it is never destroyed, so it always returns the same individuals).
function stationSoldier(o:Soldier){
  if(o.g.parent!==scene)scene.add(o.g);
  o.mode='stationed';o.dead=false;o.deadT=0;o.respawnT=0;o.grounded=false;
  o.g.position.set(BARRACKS.x,0,BARRACKS.z);o.g.rotation.set(0,0,0);
  o.g.visible=false;
}

// A killed soldier RETURNS FROM AFAR: revived on foot at a far intersection, running
// in to rejoin the fight — so the squad is never permanently thinned during a ★6.
function reviveSoldierFar(o:Soldier){
  const px=playerPos();
  let nx=px.x,nz=px.z,best=1e9;
  for(let t=0;t<40;t++){
    const x=nodeX(irand(0,N)),z=nodeX(irand(0,N)),d=Math.hypot(x-px.x,z-px.z);
    if(d>=40&&d<=70){nx=x;nz=z;break;}
    if(Math.abs(d-55)<best){best=Math.abs(d-55);nx=x;nz=z;}
  }
  if(o.g.parent!==scene)scene.add(o.g);
  o.dead=false;o.deadT=0;o.respawnT=0;o.grounded=false;
  o.g.position.set(nx,groundHeight(nx,nz),nz);o.g.rotation.set(0,0,0);o.g.visible=true;
  o.mode='hunt';o.bob=rand(0,6);o.shootT=0;o.burstLeft=0;o.restT=rand(.3,1.2);
}

// Boot: create the FIXED squad ONCE (named from npcs.json kind:'military'), stationed
// off-map. They are reused for every ★6 deployment — no soldier is ever spawned "from
// beyond". The census shows them on standby.
export function initArmy(){
  if(soldiers.length)return;
  for(let i=0;i<SQUAD_SIZE;i++){
    const def=MILITARY_DEFS[i];
    const wpn=SQUAD[i%SQUAD.length];
    const g=makePed(OLIVE,OLIVE_PANTS);
    g.traverse(m=>{if((m as THREE.Mesh).isMesh)m.castShadow=false;});
    attachHandGun(g,wpn.model);
    const o=new Soldier(g,{x:0,y:1.0,z:0,ry:0},wpn,(i-(SQUAD_SIZE-1)/2)*0.5,9+(i%2)*3,def?.name,def?.sex);
    stationSoldier(o);
    soldiers.push(o);
  }
}

function spawnArmy(){
  const px=playerPos();
  // spawn at an intersection 50–85m away: close enough to ARRIVE quickly (not get
  // stuck across the map), far enough not to appear in your lap. If no spot in
  // range after 40 tries, use the intersection nearest to 65m.
  let nx=px.x,nz=px.z,best=1e9;
  for(let tries=0;tries<40;tries++){
    const x=nodeX(irand(0,N)),z=nodeX(irand(0,N));
    const d=Math.hypot(x-px.x,z-px.z);
    if(d>=50&&d<=85){nx=x;nz=z;break;}
    if(Math.abs(d-65)<best){best=Math.abs(d-65);nx=x;nz=z;}
  }
  const g=makeArmyTruck();
  g.position.set(nx,groundHeight(nx,nz),nz);
  g.rotation.y=rand(0,Math.PI*2);
  scene.add(g);
  truck={g,heading:g.rotation.y,speed:0,stuckT:0,backT:0,dentT:0,deployed:false,allDeadAt:0,
    bestDist:1e9,noProgressT:0};
  if(!soldiers.length)initArmy(); // safety: ensure the fixed pool exists
  // re-board the FIXED named squad (revive any that were down) into the new truck —
  // the same individuals every time, never freshly spawned.
  const seats:Seat[]=g.userData.seats||[];
  soldiers.forEach((o,i)=>{
    o.seat=seats[i]||{x:0,y:1.0,z:0,ry:0};
    o.dead=false;o.deadT=0;o.respawnT=0;o.grounded=false;o.g.visible=true;
    o.g.rotation.set(0,0,0);
    seatInBed(o);
  });
  if(state.time-lastMsg>4){lastMsg=state.time;
    message('★6 — THE ARMY IS HERE! RUN!','var(--pink)');}
}

// dismount the whole living squad (truck stopped near the stationary target)
function deploy(){
  truck!.deployed=true;truck!.backT=0;truck!.stuckT=0; // stop maneuvering while dropping troops
  for(const o of soldiers){
    if(o.dead||o.mode!=='ride')continue;
    o.g.getWorldPosition(_wp);     // current spot in the bed -> ground beside it
    scene.add(o.g);                // reparent (THREE keeps the LOCAL transform, so rewrite it)
    o.g.position.set(_wp.x,0,_wp.z);
    o.g.rotation.set(0,0,0);
    o.mode='hunt';o.bob=rand(0,6);o.shootT=0;o.burstLeft=0;o.restT=rand(.3,1.2);
  }
  if(state.time-lastMsg>4){lastMsg=state.time;
    message('SOLDIERS ON FOOT — OPEN FIRE!','var(--pink)');}
}

// no pathfinding: when the truck gets STUCK far away (behind a building, making no
// progress), it reappears at a fresh intersection 30–55m from the player, already
// aimed at them — as if coming down another street. The squad rides along (children).
function repositionTruck(){
  if(!truck)return;
  const px=playerPos();
  let nx=px.x,nz=px.z,best=1e9;
  for(let t=0;t<40;t++){
    const x=nodeX(irand(0,N)),z=nodeX(irand(0,N));
    const d=Math.hypot(x-px.x,z-px.z);
    if(d>=30&&d<=55){nx=x;nz=z;break;}
    if(Math.abs(d-42)<best){best=Math.abs(d-42);nx=x;nz=z;}
  }
  truck.g.position.set(nx,groundHeight(nx,nz),nz);
  truck.heading=Math.atan2(px.x-nx,px.z-nz);
  truck.g.rotation.y=truck.heading;
  truck.speed=0;truck.stuckT=0;truck.backT=0;truck.noProgressT=0;truck.bestDist=1e9;
}

function addTracer(a:THREE.Vector3,b:THREE.Vector3){const line=makeGangTracerLine(a,b);scene.add(line);tracers.push({line,t:0});}

// one SHOT from a soldier's weapon (1 projectile, or several pellets for the
// shotgun). The rhythm (burst/pause) is decided in updateSoldier; this just
// resolves the shot itself.
function fireRound(o:Soldier,pp:THREE.Vector3,dist:number){
  const w=o.wpn;
  const from=o.g.position.clone();from.y+=1.3;
  for(let k=0;k<(w.pellets||1);k++){
    const hit=Math.random()<clamp(.62-dist*.012,.14,.62);
    const to=new THREE.Vector3(pp.x,pp.y+1.1,pp.z);
    if(!hit){const a=rand(0,Math.PI*2),r=rand(.6,w.spread);to.x+=Math.cos(a)*r;to.z+=Math.sin(a)*r;}
    addTracer(from,to);
    if(hit){
      const dmg=state.mode==='car'?w.dmgCar:w.dmgFoot; // the car shields the player
      state.health-=irand(dmg[0],dmg[1]);
      state.shake=Math.max(state.shake,.1);
      refs.spawnBlood?.(pp.x,pp.y+1.1,pp.z,new THREE.Vector3(to.x-from.x,to.y-from.y,to.z-from.z).normalize(),7);
      if(state.health<=0){state.health=100;getWasted();break;}
    }
  }
  gunshot(w.vol||.3);
}

function killSoldier(o:Soldier){
  if(o.dead)return;
  o.dead=true;o.deadT=0;o.respawnT=SOLDIER_RESPAWN;state.kills++;
  o.g.rotation.set(-Math.PI/2,o.g.rotation.y,0); // falls onto its back like the others
  o.g.position.y=.35;
  refs.addBloodPuddle?.(o.g.position.x,o.g.position.z);
  state.lastCrime=state.time; // killing a soldier keeps the heat maxed
}

function removeArmy(){
  if(truck){scene.remove(truck.g);truck=null;}
  // station (hide) the FIXED pool — never despawn it, so the same named soldiers
  // come back for the next ★6.
  for(const o of soldiers)stationSoldier(o);
}

// WASTED/BUSTED clears everything (player.js calls this via refs, like clearCops)
export function clearArmy(){
  removeArmy();
  for(const t of tracers){disposeGeometries(t.line);scene.remove(t.line);}
  tracers.length=0;
}
refs.clearArmy=clearArmy;

// targets the player's arsenal can hit: ONLY the dismounted squad (riders are part
// of the truck). Same pattern as refs.gunShopTargets/storyTargets.
refs.armyTargets=()=>soldiers.filter(o=>!o.dead&&(o.mode==='hunt'||o.mode==='return'))
  .map(o=>({g:o.g,r:1.05,hit:()=>killSoldier(o)}));

// shockwave (player explosion/molotov) kills the dismounted squad within the radius
refs.blastArmy=(pos:THREE.Vector3)=>{
  for(const o of soldiers){
    if(o.dead||o.mode==='ride')continue;
    if(Math.hypot(o.g.position.x-pos.x,o.g.position.z-pos.z)<5)killSoldier(o);
  }
};

// the named soldiers, for the sheriff's radio call when the army is summoned at ★6.
refs.armyNames=()=>soldiers.map(o=>o.name).filter((n):n is string=>!!n);

// distance from the truck to the player. police.js uses it to NOT cool the wanted
// level while the army is on top of you (the army keeps the heat in place of the
// police, which withdrew at 6 stars).
refs.armyDist=()=>{if(!truck)return 1e9;const p=playerPos();
  return Math.hypot(truck.g.position.x-p.x,truck.g.position.z-p.z);};

// red blip on the radar/map: shows where the army truck is coming from (without it
// the player couldn't see the squad approaching and thought "nothing showed up").
(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  truck?[{x:truck.g.position.x,z:truck.g.position.z,icon:'skull',color:'#ff3b3b',
    label:'ARMY',current:true,reveal:false}]:[]);

// debug
refs.getArmyState=()=>({active:!!truck,deployed:!!truck?.deployed,
  soldiers:soldiers.filter(o=>!o.dead).length});

function updateSoldier(o:Soldier,dt:number,pp:THREE.Vector3){
  if(o.dead){
    o.deadT+=dt;
    o.respawnT-=dt;
    // RETURN FROM AFAR: while the army is still deployed, a fallen soldier comes back
    // on foot at a far intersection and runs in to rejoin.
    if(o.respawnT<=0&&truck){reviveSoldierFar(o);return;}
    if(o.deadT>8&&o.g.parent)scene.remove(o.g); // hide the body if it lingers
    return;
  }
  if(o.mode==='ride')return; // position/pose come from the truck (parented)
  const p=o.g.position;
  if(o.mode==='return'){
    const tp=truck?truck.g.position:p;
    const dx=tp.x-p.x,dz=tp.z-p.z,d=Math.hypot(dx,dz)||1;
    if(!truck){o.mode='hunt';return;}
    if(d<2.4){seatInBed(o);return;} // re-boarded
    p.x+=dx/d*7*dt;p.z+=dz/d*7*dt;p.y=groundHeight(p.x,p.z);
    o.g.rotation.y=Math.atan2(dx,dz);
    o.bob+=dt*12;animatePed(o.g,o.bob,1);
    collideStatics(p,.5);
    return;
  }
  // hunting: each soldier takes its OWN spot in the fan around the player (flank
  // angle + stop distance), spreading out from the truck's side so they don't pile
  // up on one point. Once in place, it fires in bursts.
  const baseAng=truck?Math.atan2(truck.g.position.x-pp.x,truck.g.position.z-pp.z)
                     :Math.atan2(p.x-pp.x,p.z-pp.z);
  const ang=baseAng+o.flank;
  const tx=pp.x+Math.sin(ang)*o.stop,tz=pp.z+Math.cos(ang)*o.stop;
  const mx=tx-p.x,mz=tz-p.z,md=Math.hypot(mx,mz)||1;
  if(md>.9){
    const sp=Math.min(6,md*3); // walks to the spot and eases in (no overshoot)
    p.x+=mx/md*sp*dt;p.z+=mz/md*sp*dt;
    o.bob+=dt*11;animatePed(o.g,o.bob,1);
  }else animatePed(o.g,o.bob,0);
  p.y=groundHeight(p.x,p.z);
  holdPose(o);
  o.g.rotation.y=Math.atan2(pp.x-p.x,pp.z-p.z); // faces the player
  collideStatics(p,.5);
  const distP=Math.hypot(pp.x-p.x,pp.z-p.z);
  // RHYTHM fire: a short burst then a PAUSE (gap) — never 100% of the time
  o.shootT-=dt;o.restT-=dt;
  if(pp.y-p.y<3&&distP<o.wpn.range&&o.restT<=0&&hasLineOfSight(p.x,p.z,pp.x,pp.z)){
    if(o.burstLeft<=0)o.burstLeft=irand(o.wpn.burst[0],o.wpn.burst[1]);
    if(o.shootT<=0){
      fireRound(o,pp,distP);
      o.shootT=rand(o.wpn.fire[0],o.wpn.fire[1]);
      if(--o.burstLeft<=0)o.restT=rand(o.wpn.gap[0],o.wpn.gap[1]); // pause between bursts
    }
  }
}

export function updateArmy(dt:number){
  const need=Math.floor(state.wanted)>=ARMY_AT;

  if(!need){ if(truck)clearArmy(); return; } // dropped below 6: the army stands down

  if(!truck){spawnArmy();return;} // ★6: deploy the fixed squad (no breather, no new wave)

  const pp=playerPos();
  const tp=truck.g.position;
  const dx=pp.x-tp.x,dz=pp.z-tp.z,dist=Math.hypot(dx,dz)||1;
  // (No whole-squad-wipe handling: fallen soldiers return from afar individually, so
  // the squad self-heals while the army is up.)

  if(truck.deployed){
    // squad dismounted: truck waits in place. Player opened distance (or sped off
    // in a car)? The squad runs back and re-boards; with everyone aboard, resume the hunt.
    truck.speed+=(0-truck.speed)*6*dt;spinWheels(truck.g,truck.speed,dt,0);
    const fleeing=dist>34||(state.mode==='car'&&Math.abs(cur?.speed||0)>10);
    for(const o of soldiers)if(!o.dead&&o.mode!=='ride')o.mode=fleeing?'return':'hunt';
    if(soldiers.every(o=>o.dead||o.mode==='ride'))truck.deployed=false;
  }else{
    // can't get ANY CLOSER for a while (stuck behind a building, maneuvering far
    // away)? Reappear on a fresh street near the player — a new approach from
    // another side, so the squad always arrives instead of maneuvering forever.
    if(dist>16){
      if(dist<truck.bestDist-1){truck.bestDist=dist;truck.noProgressT=0;}
      else if((truck.noProgressT+=dt)>3.5){repositionTruck();return;}
    }else{truck.bestDist=dist;truck.noProgressT=0;}
    // chase: drives toward the player, brakes when close, reverses if jammed
    const desired=Math.atan2(dx,dz),diff=wrapA(desired-truck.heading);
    if(truck.backT>0){
      truck.backT-=dt;truck.speed+=(-7-truck.speed)*3*dt;
      truck.heading-=Math.sign(diff)*1.2*dt;
    }else{
      truck.heading+=clamp(diff,-1,1)*2.0*dt*clamp(Math.abs(truck.speed)/8+.25,0,1);
      // on foot: brakes EARLY and stops FAR away (the truck is just troop transport,
      // it never runs you over). In a car it can pull up so the squad drops alongside.
      const ts=dist>18?TRUCK_MAXSPD:(state.mode==='foot'?(dist<12?0:5):(dist<6?0:12));
      truck.speed+=(ts-truck.speed)*(ts<truck.speed?4:1.2)*dt;
    }
    tp.x+=Math.sin(truck.heading)*truck.speed*dt;
    tp.z+=Math.cos(truck.heading)*truck.speed*dt;
    if(collideStatics(tp,1.7)){truck.speed*=.3;truck.stuckT+=dt*3;}
    // anti-runover guard: on foot the truck NEVER gets within 7m of the player
    if(state.mode==='foot'){
      const ax=tp.x-pp.x,az=tp.z-pp.z,ad=Math.hypot(ax,az)||1;
      if(ad<7){tp.x=pp.x+ax/ad*7;tp.z=pp.z+az/ad*7;truck.speed*=.3;}
    }
    // "stuck" only counts while still FAR and supposed to be driving. Near the
    // target, stopping is ON PURPOSE (about to dismount), not being jammed. Without
    // this the truck parked nearby, got flagged "stuck", reversed and maneuvered
    // forever without ever dropping the troops (the reported bug).
    if(dist>14){
      if(Math.abs(truck.speed)<2.5)truck.stuckT+=dt;else truck.stuckT=Math.max(0,truck.stuckT-dt*2);
      if(truck.stuckT>1.3){truck.backT=.9;truck.stuckT=0;}
    }else truck.stuckT=0;
    tp.y=groundHeight(tp.x,tp.z);
    truck.g.rotation.y=truck.heading;
    spinWheels(truck.g,truck.speed,dt,clamp(diff,-1,1));

    // reached the stationary target with troops still aboard: dismount
    const hasRiders=soldiers.some(o=>!o.dead&&o.mode==='ride');
    if(hasRiders&&pp.y<6&&
       (state.mode==='foot'?dist<13:dist<15&&Math.abs(cur?.speed||0)<4))deploy();

    // player's car bumps the truck: push apart and dent it (like the cop cruisers)
    if(state.mode==='car'&&cur){
      const d=tp.distanceTo(cur.g.position);
      if(d<3.1){
        const push=_push.subVectors(cur.g.position,tp).setY(0).normalize();
        cur.g.position.addScaledVector(push,(3.1-d)*.7);
        cur.speed*=.7;truck.speed*=.6;thud(8);state.shake=.4;
        if(!truck.dentT||state.time-truck.dentT>.5){
          truck.dentT=state.time;
          const mid=_mid.addVectors(tp,cur.g.position).multiplyScalar(.5).setY(.7);
          dentCar(cur.g,mid,push,.16);
        }
      }
    }
  }

  for(const o of soldiers)updateSoldier(o,dt,pp);

  // separation: dismounted soldiers NEVER pile up (push apart any that touch)
  for(let i=0;i<soldiers.length;i++){
    const a=soldiers[i];if(a.dead||a.mode==='ride')continue;
    for(let j=i+1;j<soldiers.length;j++){
      const b=soldiers[j];if(b.dead||b.mode==='ride')continue;
      const sx=a.g.position.x-b.g.position.x,sz=a.g.position.z-b.g.position.z,sd=Math.hypot(sx,sz);
      if(sd<1.6&&sd>.001){
        const push=(1.6-sd)*.5/sd;
        a.g.position.x+=sx*push;a.g.position.z+=sz*push;
        b.g.position.x-=sx*push;b.g.position.z-=sz*push;
      }
    }
  }

  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.t+=dt;
    if(t.t>.13){disposeGeometries(t.line);scene.remove(t.line);tracers.splice(i,1);}
  }
}
