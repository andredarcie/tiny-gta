import * as THREE from 'three';
import {state} from '@/core/state.ts';
export {beamMat,makeCar} from '../../assets/models/vehicles/car.ts';
export {makeKombi} from '../../assets/models/vehicles/kombi.ts';
export {makeFiatUno} from '../../assets/models/vehicles/fiat-uno.ts';
export {makeMotorcycle} from '../../assets/models/vehicles/motorcycle.ts';
export {makeBoat} from '../../assets/models/vehicles/boat.ts';
import {makePed,makePlayerPed,shirtColors,addFemaleLook} from '../../assets/models/characters/pedestrian.ts';
import {setNpcGlbSeated,USE_GLB_NPCS} from '../../assets/models/characters/npc-glb.ts';
export {makePed,makePlayerPed,shirtColors,addFemaleLook};
export {makePlane} from '../../assets/models/aircraft/plane.ts';
import {makePistolModel} from '../../assets/models/weapons/pistol.ts';
import {makeUziModel} from '../../assets/models/weapons/uzi.ts';
import {makeShotgunModel} from '../../assets/models/weapons/shotgun.ts';
import {makeAk47Model} from '../../assets/models/weapons/ak47.ts';

// ---- Empunhadura PADRÃO de arma (jogador, gangues e polícia) ----
// Não existe mais um "gang gun" próprio: NPCs seguram os MESMOS modelos do
// arsenal do jogador (pistola/uzi), só que reduzidos e SEM sombra (são muitos
// NPCs — manter o custo de render baixo). `attachHandGun(ped, kind)` pendura a
// arma na mão direita do ped (idempotente). poseAiming põe o boneco na pose de
// mira: braço da arma esticado à frente, braço de apoio dobrado — chamar DEPOIS
// do animatePed do frame. kick = recuo do tiro (0..~.16), usado pelo jogador.
const HAND_WEAPONS:Record<string,{make:()=>THREE.Object3D;scale:number;pos:[number,number,number]}>={
  pistol:{make:makePistolModel,scale:.5,pos:[0,-.55,.08]},
  uzi:{make:makeUziModel,scale:.55,pos:[0,-.56,.05]},
  shotgun:{make:makeShotgunModel,scale:.5,pos:[0,-.52,.12]},
  ak47:{make:makeAk47Model,scale:.5,pos:[0,-.52,.12]}
};
export function attachHandGun(ped:THREE.Object3D,kind='pistol'){
  const arm=ped.userData.limbs?.rightArm;
  if(!arm||arm.userData.gun)return;
  const def=HAND_WEAPONS[kind]||HAND_WEAPONS.pistol;
  const gun=def.make();
  gun.scale.setScalar(def.scale);
  gun.position.set(...def.pos);
  gun.traverse((o:THREE.Object3D)=>{o.castShadow=false;}); // NPC: sem sombra pra não pesar
  arm.add(gun);
  arm.userData.gun=gun;
}

export function poseAiming(ped:THREE.Object3D,kick=0){
  // GLB NPC: it has no procedural limbs — instead stamp the aim time so npc-glb's
  // updateNpcGlb overlays the shared gun-hold posture (AIM_POSE) on its arms this frame.
  if(ped.userData.glbNpc){(ped.userData as Record<string,unknown>).npcAimT=state.time;return;}
  const l=ped.userData.limbs;if(!l)return;
  l.rightArm.rotation.x=-Math.PI/2+kick*1.2;
  l.rightArm.rotation.y=-.04;
  l.rightArm.rotation.z=-.08;
  l.leftArm.rotation.x=-.28;
  l.leftArm.rotation.y=.08;
  l.leftArm.rotation.z=.18;
  l.rightForearm?.rotation.set(0,0,0);
  if(l.leftForearm)l.leftForearm.rotation.x=-.35;
}

// Fade de morte: o ped fundido guarda seus materiais em userData.fadeMats.
// transparent só fica ligado durante o fade — ped opaco sai do pass de
// transparência (sem sorting por frame), que era um dos maiores custos.
export function setOpacity(g:THREE.Object3D,o:number){
  const mats=g.userData.fadeMats;
  if(mats){
    for(const m of mats){m.opacity=o;m.transparent=o<1;}
    return;
  }
  g.traverse((m:any)=>{if(m.material)m.material.opacity=o;});
}

export function animatePed(g:THREE.Object3D,phase=0,amount=0){
  const l=g.userData.limbs;if(!l)return;
  const a=Math.min(1,amount);
  const swing=Math.sin(phase)*.62*a;
  const armSwing=swing*.72;
  l.leftLeg.rotation.x=swing;
  l.rightLeg.rotation.x=-swing;
  if(l.leftCalf){
    l.leftCalf.rotation.x=(1-Math.cos(phase))*.45*a;
    l.rightCalf.rotation.x=(1-Math.cos(phase+Math.PI))*.45*a;
  }
  l.leftArm.rotation.x=-armSwing;
  l.rightArm.rotation.x=armSwing;
  l.leftArm.rotation.z=.12;
  l.rightArm.rotation.z=-.12;
  if(l.leftForearm){
    l.leftForearm.rotation.x=-(.18+Math.max(0,Math.sin(phase))*.5)*a;
    l.rightForearm.rotation.x=-(.18+Math.max(0,-Math.sin(phase))*.5)*a;
  }
}

// Libera as geometrias de um efeito transitório (bala, tracer, explosão, fogo…)
// ao tirá-lo da cena. SÓ geometria: ela é sempre por-instância e é o que de fato
// vaza no GPU sem dispose. Materiais NÃO — vários são compartilhados em nível de
// módulo (dar dispose quebraria os próximos spawns) e o que é por-instância é
// minúsculo (o programa fica em cache; o GC do JS recolhe o objeto).
export function disposeGeometries(o:THREE.Object3D){
  o.traverse((c:any)=>{if(c.geometry)c.geometry.dispose();});
}

const _dp=new THREE.Vector3(),_dd=new THREE.Vector3(),_dq=new THREE.Quaternion();
// opts opcional pra batidas mais destrutivas (carro do jogador): radius alarga a
// zona amassada e max sobe o teto de deslocamento por vértice (afunda mais fundo).
export function dentCar(g:THREE.Object3D,worldPoint:THREE.Vector3,worldDir:THREE.Vector3,strength=.1,opts?:{radius?:number;max?:number}){
  const parts=g.userData.dentable;if(!parts)return;
  g.updateMatrixWorld();
  _dp.copy(worldPoint);g.worldToLocal(_dp);
  _dd.copy(worldDir);_dd.y*=.3;
  if(_dd.lengthSq()<1e-6)return;
  _dd.normalize().applyQuaternion(_dq.copy(g.quaternion).invert());
  const R=opts?.radius??1.4,MAX=opts?.max??.42;
  for(const m of parts){
    const lx=_dp.x-m.position.x,ly=_dp.y-m.position.y,lz=_dp.z-m.position.z;
    if(Math.hypot(lx,ly,lz)>R+2.9)continue;
    if(!m.userData.dented){
      m.geometry=m.geometry.clone();
      m.geometry.userData.orig=m.geometry.attributes.position.array.slice();
      m.userData.dented=true;
    }
    const p=m.geometry.attributes.position,orig=m.geometry.userData.orig;
    let touched=false;
    for(let i=0;i<p.count;i++){
      const d=Math.hypot(p.getX(i)-lx,p.getY(i)-ly,p.getZ(i)-lz);
      if(d>R)continue;
      const f=strength*(1-d/R);
      let nx=p.getX(i)+_dd.x*f+(Math.random()-.5)*f*.4;
      let ny=p.getY(i)+_dd.y*f-f*.15;
      let nz=p.getZ(i)+_dd.z*f+(Math.random()-.5)*f*.4;
      const ox=orig[i*3],oy=orig[i*3+1],oz=orig[i*3+2];
      const off=Math.hypot(nx-ox,ny-oy,nz-oz);
      if(off>MAX){const s=MAX/off;nx=ox+(nx-ox)*s;ny=oy+(ny-oy)*s;nz=oz+(nz-oz)*s;}
      p.setXYZ(i,nx,ny,nz);touched=true;
    }
    if(touched){p.needsUpdate=true;m.geometry.computeVertexNormals();}
  }
}

export function spinWheels(g:THREE.Object3D,speed:number,dt:number,steer=0){
  const u=g.userData;if(!u.wheels)return;
  for(const w of u.wheels)w.rotation.x+=speed*dt/.30;
  for(const w of u.front)w.rotation.y=steer*.38;
  // volante gira e os braços do motorista (jogador ou NPC) acompanham a curva
  const k=Math.min(1,12*dt);
  if(u.steer)u.steer.rotation.z+=(-steer*1.8-u.steer.rotation.z)*k;
  const l=u.driver?.userData.limbs;
  if(l){
    l.leftArm.rotation.z+=(.42-steer*.25-l.leftArm.rotation.z)*k;
    l.rightArm.rotation.z+=(-.42-steer*.25-l.rightArm.rotation.z)*k;
  }
}

// Registry of seated vehicle occupants (car drivers, boat crew). The NPC layer
// reconciles this list at runtime — tagging each one as a named Npc (so they appear
// in the roster) and dropping any whose vehicle has been removed — without entities.ts
// needing to import the Npc class (which would be a circular import). Callers that
// seat a figure outside seatDriver (boat captains) push here too.
export const vehicleOccupants:THREE.Object3D[]=[];

// Cria um NPC já sentado no banco do motorista do carro, mãos no volante,
// coxas pra frente e pés no piso (mesma pose do jogador dirigindo)
export function seatDriver(carG:THREE.Object3D,color?:number,pants?:number){
  const d=makePed(color!,pants);
  setNpcGlbSeated(d); // if it becomes a GLB NPC, ride in the 'sit' clip (not idle/run)
  vehicleOccupants.push(d); // tagged as a named NPC by the runtime reconcile pass
  d.traverse((o:any)=>{if(o.isMesh)o.castShadow=false;});
  const l=d.userData.limbs;
  if(l){
    l.leftLeg.rotation.set(-2.0,0,0);
    l.rightLeg.rotation.set(-2.0,0,0);
    l.leftCalf?.rotation.set(.5,0,0);
    l.rightCalf?.rotation.set(.5,0,0);
    l.leftArm.rotation.set(-1.3,0,.42);
    l.rightArm.rotation.set(-1.3,0,-.42);
    l.leftForearm?.rotation.set(-.78,0,0);
    l.rightForearm?.rotation.set(-.78,0,0);
  }
  d.position.set(-.38,USE_GLB_NPCS?-.157:-.52,USE_GLB_NPCS?-.031:-.15); // GLB sits higher
  carG.add(d);
  carG.userData.driver=d; // spinWheels anima os braços de quem está aqui
  return d;
}

export function blinkBar(g:THREE.Object3D){
  if(!g.userData.bar)return;
  const on=Math.floor(state.time*5)%2;
  g.userData.bar[0].material.color.setHex(on?0xff2222:0x551111);
  g.userData.bar[1].material.color.setHex(on?0x2255ff:0x111155);
}
