import * as THREE from 'three';
import {clamp,wrapA,rand,irand,SWIM_BOUND,isLand} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {makeBoat,makePed,attachHandGun,blinkBar,disposeGeometries,vehicleOccupants} from '@/core/entities.ts';
import {setNpcGlbSeated} from '../../assets/models/characters/npc-glb.ts';
import {makeGangTracerLine} from '../../assets/models/effects/gang-tracer.ts';
import {thud,gunshot} from '@/audio/audio.ts';
import {message} from '@/ui/hud.ts';
import {playerPos,cur,inWater,getWasted} from '@/actors/player.ts';

// Marine pursuit: flee the police INTO the water (swimming or aboard a boat) while
// still WANTED and a police speedboat puts out from open sea and hunts you down.
// It chases like the cop cars (steers straight at you, eases off when it pulls
// alongside so it doesn't just plow over you), rams your boat, and the officer at
// the helm opens fire from 2 stars up. The boats hug the coastline — they can't
// follow you onto dry land, so reaching the beach shakes them (the regular cops on
// land take over from there). They scale with the wanted level and clear on
// WASTED/BUSTED, the same as the cars (police.js calls clearPoliceBoats via refs).

// A police speedboat hunting the player on the water.
interface PoliceBoat{
  g:THREE.Object3D;
  heading:number;
  speed:number;
  bobT:number;
  shootT:number;
  captain:THREE.Object3D;
  ramT:number;
}
// A bullet-trail line that fades out over a fraction of a second.
interface Tracer{line:THREE.Line;t:number;}

const SEA_Y=-.32;       // superfície do mar (igual sea.js / updateBoat)
const BOAT_FLOAT=.3;    // altura de flutuação acima do mar (igual updateBoat)
const MAX_BOATS=3;      // teto de lanchas perseguindo ao mesmo tempo
const GRACE=6;          // segundos que as lanchas insistem após você pisar em terra

export const policeBoats:PoliceBoat[]=[]; // {g,heading,speed,bobT,shootT,captain,ramT}
const tracers:Tracer[]=[];            // rastros de tiro {line,t}

let offT=99;     // segundos fora d'água (reseta ao molhar; some as lanchas após GRACE)
let spawnCd=0;   // cadência entre nascimentos de lancha
let lastMsg=-99; // anti-spam do aviso "POLICE BOAT ON THE WATER!"

// senta um oficial de uniforme azul ao timão (mesma pose do capitão das corridas),
// com pistola na mão pra disparar do barco
function seatCop(boatG:THREE.Object3D):THREE.Object3D{
  const d=makePed(0x2a3f6e,0x1a2440);
  setNpcGlbSeated(d);   // rigged helmsman pilots seated (the procedural limb pose is a no-op on GLB)
  d.traverse(o=>{if((o as THREE.Mesh).isMesh)o.castShadow=false;});
  const l=d.userData.limbs;
  if(l){
    l.leftLeg.rotation.set(-1.3,0,.12);l.rightLeg.rotation.set(-1.3,0,-.12);
    l.leftCalf?.rotation.set(1.4,0,0);l.rightCalf?.rotation.set(1.4,0,0);
    l.leftArm.rotation.set(-1.15,0,.30);l.rightArm.rotation.set(-1.15,0,-.30);
    l.leftForearm?.rotation.set(-.55,0,0);l.rightForearm?.rotation.set(-.55,0,0);
  }
  d.position.set(0,-.05,-.15);
  attachHandGun(d);
  boatG.add(d);
  vehicleOccupants.push(d); // tagged as a named NPC by the runtime reconcile pass
  return d;
}

// nasce numa zona de água a estibordo, longe o bastante pra "chegar" de mar aberto.
// Varre ângulos crescendo o raio até achar mar livre (não encalha na praia).
function spawnPoliceBoat(){
  const pp=playerPos();
  let a=rand(0,Math.PI*2),x=pp.x,z=pp.z,found=false;
  for(let i=0;i<26;i++){
    a+=0.78;const d=64+i*1.5;
    x=pp.x+Math.sin(a)*d;z=pp.z+Math.cos(a)*d;
    if(!isLand(x,z)&&Math.abs(x)<SWIM_BOUND-10&&Math.abs(z)<SWIM_BOUND-10){found=true;break;}
  }
  if(!found){x=clamp(x,-SWIM_BOUND+10,SWIM_BOUND-10);z=clamp(z,-SWIM_BOUND+10,SWIM_BOUND-10);}
  const first=policeBoats.length===0;
  const g=makeBoat(0xf2f4f8,true); // casco branco + giroflex (livraria de polícia)
  g.position.set(x,SEA_Y+BOAT_FLOAT,z);
  const heading=Math.atan2(pp.x-x,pp.z-z);
  g.rotation.y=heading;
  const captain=seatCop(g);
  policeBoats.push({g,heading,speed:14,bobT:rand(0,6),shootT:rand(.8,1.6),captain,ramT:0});
  if(first&&state.time-lastMsg>8){lastMsg=state.time;message('POLICE BOAT ON THE WATER!','var(--blue)');}
}

function removePoliceBoat(b:PoliceBoat){scene.remove(b.g);}

function addTracer(a:THREE.Vector3,b:THREE.Vector3){const line=makeGangTracerLine(a,b);scene.add(line);tracers.push({line,t:0});}

// disparo do oficial a bordo: mira onde o jogador está; erra mais de longe. O
// rastro sai do barco (não da arma) — simples e legível na água.
function boatShoot(b:PoliceBoat,pp:THREE.Vector3,dist:number){
  b.shootT=rand(1.3,2.3);
  const from=b.g.position.clone();from.y+=1.4;
  const hit=Math.random()<clamp(.55-dist*.013,.1,.55);
  const to=new THREE.Vector3(pp.x,pp.y+1.1,pp.z);
  if(!hit){const ang=rand(0,Math.PI*2);to.x+=Math.cos(ang)*rand(1,3);to.z+=Math.sin(ang)*rand(1,3);}
  addTracer(from,to);
  gunshot(.32);
  if(hit){
    state.health-=state.mode==='car'?irand(2,4):irand(3,7); // de lancha a lataria protege um pouco
    state.shake=Math.max(state.shake,.1);
    refs.spawnBlood?.(pp.x,pp.y+1.1,pp.z,new THREE.Vector3(to.x-from.x,to.y-from.y,to.z-from.z).normalize(),7);
    if(state.health<=0){state.health=100;getWasted();}
  }
}

export function updatePoliceBoats(dt:number){
  const pp=playerPos();
  const onWater=!state.interior&&inWater(pp)&&(state.swimming||!!cur?.boat);
  const want=Math.floor(state.wanted);
  if(onWater)offT=0;else offT+=dt;
  // engajadas enquanto você está na água E procurado, com uma folga após pisar em
  // terra (um pulo rápido no píer não some com elas)
  const active=state.wanted>=1&&(onWater||offT<GRACE);
  const desired=active?clamp(Math.ceil(want/2),1,MAX_BOATS):0;
  spawnCd-=dt;
  if(onWater&&policeBoats.length<desired&&spawnCd<=0){spawnPoliceBoat();spawnCd=rand(2.4,4.2);}
  while(policeBoats.length>desired)removePoliceBoat(policeBoats.pop()!);

  for(const b of policeBoats){
    const p=b.g.position;
    const dx=pp.x-p.x,dz=pp.z-p.z,dist=Math.hypot(dx,dz);
    const desiredH=Math.atan2(dx,dz),diff=wrapA(desiredH-b.heading);
    b.heading+=clamp(diff,-1,1)*2.3*dt;
    // alcança rápido de longe; alivia ao colar pra não atropelar o jogador
    const ts=dist>26?38:dist>12?20:7;
    b.speed+=(ts-b.speed)*1.6*dt;
    b.speed=clamp(b.speed,0,40);
    // avança mantendo-se na água: se a reta encalharia, abre um leque de rumos e
    // pega o mais próximo do desejado que siga sobre o mar (contorna a costa)
    const stepLen=b.speed*dt;
    let moved=false;
    for(const off of[0,.5,-.5,1,-1,1.7,-1.7]){
      const h=b.heading+off;
      const nx=p.x+Math.sin(h)*stepLen,nz=p.z+Math.cos(h)*stepLen;
      if((stepLen<1e-4||!isLand(nx,nz))&&Math.abs(nx)<SWIM_BOUND&&Math.abs(nz)<SWIM_BOUND){
        p.x=nx;p.z=nz;b.heading=h;moved=true;break;
      }
    }
    if(!moved)b.speed*=.4; // encurralada contra a praia: quase para
    // lanchas não se atravessam: empurra uma pra fora da outra
    for(const o of policeBoats){
      if(o===b)continue;
      const sx=p.x-o.g.position.x,sz=p.z-o.g.position.z,sd=Math.hypot(sx,sz);
      if(sd<5.5&&sd>.001){const push=(5.5-sd)*.5/sd;p.x+=sx*push;p.z+=sz*push;o.g.position.x-=sx*push;o.g.position.z-=sz*push;}
    }
    // encosto na lancha do jogador: empurra, derruba a velocidade e sacode a tela
    if(state.mode==='car'&&cur?.boat){
      const ex=cur.g.position.x-p.x,ez=cur.g.position.z-p.z,ed=Math.hypot(ex,ez);
      if(ed<3.4&&ed>.001){
        const k=(3.4-ed)/ed;
        cur.g.position.x+=ex*k*.6;cur.g.position.z+=ez*k*.6;
        cur.speed*=.82;b.speed*=.5;
        if(state.time-b.ramT>.5){b.ramT=state.time;thud(7);state.shake=Math.max(state.shake,.32);}
      }
    }
    // oficial a bordo abre fogo a partir de 2 estrelas (alvo na superfície/água)
    b.shootT-=dt;
    if(want>=2&&dist<34&&pp.y<4&&b.shootT<=0)boatShoot(b,pp,dist);
    // flutuação + proa levantada planando + leme + giroflex piscando (blinkBar)
    b.bobT+=dt;
    const plane=clamp(b.speed/40,0,1);
    p.y=SEA_Y+BOAT_FLOAT+Math.sin(b.bobT*2.2)*.05*(1-plane*.7);
    b.g.rotation.y=b.heading;
    b.g.rotation.x=THREE.MathUtils.lerp(b.g.rotation.x,-plane*.12,Math.min(1,4*dt));
    const steer=b.g.userData.steer;
    if(steer)steer.rotation.z=THREE.MathUtils.lerp(steer.rotation.z,-clamp(diff,-1,1)*1.1,Math.min(1,8*dt));
    blinkBar(b.g);
  }

  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.t+=dt;
    if(t.t>.15){disposeGeometries(t.line);scene.remove(t.line);tracers.splice(i,1);}
  }
}

// WASTED/BUSTED limpam tudo de uma vez (police.js chama via refs, junto dos cops)
export function clearPoliceBoats(){
  while(policeBoats.length)removePoliceBoat(policeBoats.pop()!);
  for(const t of tracers){disposeGeometries(t.line);scene.remove(t.line);}
  tracers.length=0;
  offT=99;spawnCd=0;
}
refs.clearPoliceBoats=clearPoliceBoats;
refs.policeBoats=policeBoats; // HUD desenha os blips no radar (igual às viaturas)
