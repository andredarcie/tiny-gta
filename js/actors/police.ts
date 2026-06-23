import * as THREE from 'three';
import {N,clamp,rand,wrapA,nodeX,irand,groundHeight,SWIM_BOUND} from '@/core/constants.ts';
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
import {playerPos,cur,getBusted,getWasted} from '@/actors/player.ts';
import {Npc} from '@/actors/npc.ts';

// A police cruiser chasing the player.
interface Cop{
  g:THREE.Object3D;
  heading:number;
  speed:number;
  stuckT:number;
  backT:number;
  officers:Officer[]|null;
  driver?:THREE.Object3D;
  dentT?:number;
}

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
const SIX_STAR_HOLD=30;
let lastShout=-99;

export function spawnCop(){
  const px=playerPos();
  let nx,nz,tries=0;
  do{nx=nodeX(irand(0,N));nz=nodeX(irand(0,N));tries++;}
  while(Math.hypot(nx-px.x,nz-px.z)<80&&tries<30);
  const c:Cop={g:makeCar(0xe8e8ee,true),heading:rand(0,6.28),speed:0,stuckT:0,backT:0,officers:null};
  c.driver=seatDriver(c.g,0x2a3f6e,0x1a2440);
  c.g.position.set(nx,0,nz);
  cops.push(c);
}

function deployOfficers(c:Cop){
  c.officers=[];
  const h=c.heading;
  for(const side of[1.3,-1.3]){
    const g=makePed(COP_BLUE);
    g.position.set(c.g.position.x+Math.cos(h)*side,0,c.g.position.z-Math.sin(h)*side);
    const o=new Officer(g,{
      kind:'officer',hp:1,drop:null,wanted:1.5,wantedMsg:'OFFICER DOWN!',crime:'cop_killed',
      punchToDown:4,showLabel:false,area:'On patrol',
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

function removeCop(c:Cop){
  scene.remove(c.g);
  if(c.officers)for(const o of c.officers){
    o.despawn(); // removes from npcs[] + scene
    const i=officers.indexOf(o);if(i>=0)officers.splice(i,1);
  }
  c.officers=null;
}

const copMissiles:CopMissile[]=[];
const tracers:Tracer[]=[];

export function clearCops(){
  while(cops.length)removeCop(cops.pop()!);
  for(const o of officers)o.despawn();
  officers.length=0;
  for(const m of copMissiles){disposeGeometries(m.g);scene.remove(m.g);}
  copMissiles.length=0;
  for(const t of tracers){disposeGeometries(t.line);scene.remove(t.line);}
  tracers.length=0;
  refs.clearPoliceBoats?.();
}
refs.clearCops=clearCops;

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

export function updateCops(dt:number){
  const want=Math.floor(state.wanted);
  if(want>=6){
    while(cops.length)removeCop(cops.pop()!);
    for(let i=officers.length-1;i>=0;i--){officers[i].despawn();officers.splice(i,1);}
  }else{
    if(cops.length<want&&cops.length<5&&Math.random()<dt*.8)spawnCop();
    while(cops.length>want)removeCop(cops.pop()!);
  }
  const pp=playerPos();
  let minD=1e9;
  for(const c of cops){
    const p=c.g.position;
    const dx=pp.x-p.x,dz=pp.z-p.z,dist=Math.hypot(dx,dz);
    minD=Math.min(minD,dist);
    blinkBar(c.g);
    if(c.officers){
      c.speed+=(0-c.speed)*6*dt;
      spinWheels(c.g,c.speed,dt,0);
      const fleeing=dist>30||(state.mode==='car'&&Math.abs(cur?.speed||0)>10);
      for(const o of c.officers)o.mode=fleeing?'return':'hunt';
      continue;
    }
    const desired=Math.atan2(dx,dz),diff=wrapA(desired-c.heading);
    if(c.backT>0){
      c.backT-=dt;c.speed+=(-8-c.speed)*3*dt;
      c.heading-=Math.sign(diff)*1.4*dt;
    }else{
      c.heading+=clamp(diff,-1,1)*2.5*dt*clamp(Math.abs(c.speed)/8+.25,0,1);
      const ts=dist>15?27:state.mode==='foot'&&dist<9?2.5:12;
      c.speed+=(ts-c.speed)*(ts<c.speed?3.2:1.3)*dt;
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
    if(collideStatics(p,1.3)){c.speed*=.3;c.stuckT+=dt*3;}
    if(Math.abs(c.speed)<2.5)c.stuckT+=dt;else c.stuckT=Math.max(0,c.stuckT-dt*2);
    if(c.stuckT>1.2){c.backT=.9;c.stuckT=0;}
    c.g.rotation.y=c.heading;
    spinWheels(c.g,c.speed,dt,clamp(diff,-1,1));
    if(pp.y<6&&!c.backT&&
      (state.mode==='foot'?dist<8:dist<13&&Math.abs(cur?.speed||0)<4)){
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
  const cornered=(minD<6||nearOff<3.4)&&pp.y<3;
  if((cops.length||officers.length)&&cornered&&
    (state.mode==='foot'||Math.abs(cur?.speed||0)<3.5)){
    state.bustT+=dt;
    if(state.bustT>.4)message('THE POLICE ARE SURROUNDING YOU!','var(--blue)');
    if(state.bustT>1.8){getBusted();return;}
  }else state.bustT=Math.max(0,state.bustT-dt*2);
  const sixHold=state.wanted>=6&&state.time-state.sixStarT<SIX_STAR_HOLD;
  if(!sixHold&&state.wanted>0&&state.time-state.lastCrime>9&&(minD>70||!cops.length)&&(refs.armyDist?.()??1e9)>70)
    state.wanted=Math.max(0,state.wanted-dt/5);
}
