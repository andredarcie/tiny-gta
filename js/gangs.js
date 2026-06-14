import * as THREE from 'three';
import {rand,irand,clamp,nodeX} from './constants.js';
import {state,refs} from './state.js';
import {scene} from './engine.js';
import {makePed,setOpacity,attachHandGun,poseAiming} from './entities.js';
import * as Entities from './entities.js';
import {collideStatics,addWanted} from './physics.js';
import {blip,thud,gunshot} from './audio.js';
import {message} from './hud.js';
import {playerPos,getWasted} from './player.js';
import {addBloodPuddle} from './pedestrians.js';
import {spawnDrop} from './missions.js';
import {interiors} from './interior.js';
import {makeGangTracerLine} from '../assets/models/effects/gang-tracer.js';

// Prédios especiais (boate/academia/hospital/presídio) registram uma zona de fachada
// em interiors[].exterior; gangue não nasce nem fica dentro dela.
function inSpecialZone(x,z){
  for(const it of interiors){const e=it.exterior;
    if(e&&Math.hypot(x-e.x,z-e.z)<e.r)return true;}
  return false;
}
// empurra um ponto pra fora de qualquer zona de fachada (como um sólido circular)
function repelFromZones(p){
  for(const it of interiors){const e=it.exterior;if(!e)continue;
    const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz);
    if(d<e.r){
      if(d<1e-3){p.x=e.x+e.r;}
      else{p.x=e.x+dx/d*e.r;p.z=e.z+dz/d*e.r;}
    }
  }
}

// DUAS gangues, cada uma com cor própria, território circular (aparece no
// minimapa) e membros uniformizados e armados. O efetivo é FINITO: cada gangue
// só coloca GANG_ROSTER bandidos em campo na vida toda (no máximo GANG_ALIVE
// vivos por vez). Matar membros encolhe o território; quando o efetivo esgota e
// o último cai, a gangue é ELIMINADA — some do mapa de vez (sem mais reforço/blip).
const GANG_MIN_R=12, GANG_R0=44, KILL_SHRINK=5;
const GANG_ROSTER=7;  // total de bandidos que a gangue põe em campo (eliminada ao zerar)
const GANG_ALIVE=3;   // máximo de bandidos vivos ao mesmo tempo (poucos)
export const gangs=[
  {name:'VIPERS', color:0x35d435,pants:0x14401c,css:'#35d435',cssA:'rgba(53,212,53,.22)',
   x:nodeX(6)+22,z:nodeX(1)+22,r:GANG_R0},
  {name:'SKULLS', color:0x9d2eff,pants:0x2a1440,css:'#9d2eff',cssA:'rgba(157,46,255,.22)',
   x:nodeX(1)+22,z:nodeX(6)+22,r:GANG_R0},
];
for(const g of gangs){g.spawnT=rand(4,10);g.alarmT=0;g.wasInside=false;g.remaining=GANG_ROSTER;g.defeated=false;}

export const gangPeds=[];

// Scratch reaproveitado por frame em updateGangs (laço quente). Aggro e wander
// são ramos mutuamente exclusivos → um único _gdir serve aos dois. Não usar em
// m.tgt/m.vel (guardados no membro e lidos em frames posteriores).
const _gdir=new THREE.Vector3();

// Durante a corrida de rua as gangues somem (ficam invisíveis e congeladas) e
// voltam quando a prova termina — ver js/race.js. Não destrói ninguém: só pausa.
let gangsHidden=false;
export function setGangsHidden(h){
  gangsHidden=h;
  for(const m of gangPeds)m.g.visible=!h;
}

function spawnMember(gang){
  if(gang.remaining<=0)return; // efetivo esgotado: não nasce mais ninguém
  const pp=playerPos();
  let x=gang.x,z=gang.z;
  for(let k=0;k<24;k++){
    const a=rand(0,Math.PI*2),d=Math.sqrt(Math.random())*gang.r*.9;
    x=gang.x+Math.cos(a)*d;z=gang.z+Math.sin(a)*d;
    // não nasce na cara do jogador nem na fachada de um prédio especial
    if(Math.hypot(x-pp.x,z-pp.z)>26&&!inSpecialZone(x,z))break;
  }
  const m={g:makePed(gang.color,gang.pants),gang,state:'walk',vel:new THREE.Vector3(),
    t:0,bob:0,shootT:rand(.6,1.6),tgt:null,tgtT:0};
  m.g.position.set(x,0,z);
  collideStatics(m.g.position,.4);
  repelFromZones(m.g.position);
  attachHandGun(m.g,Math.random()<.45?'uzi':'pistol'); // arma real do arsenal na mão
  gangPeds.push(m);
  gang.remaining--; // consumiu um do efetivo da gangue
}
// Spawn inicial: chamado por js/main.js DEPOIS dos prédios especiais entrarem
// em interiors[], pra que a zona de fachada já valha (senão membros nasceriam
// colados na academia, que fica dentro do território dos VIPERS).
export function spawnInitialGangs(){
  for(const g of gangs)for(let k=0;k<GANG_ALIVE;k++)spawnMember(g);
}

function gangCasualty(m){
  addBloodPuddle(m.g.position.x,m.g.position.z);
  spawnDrop(m.g.position.x,m.g.position.z,irand(25,90));
  m.gang.r=Math.max(GANG_MIN_R,m.gang.r-KILL_SHRINK);
  m.gang.alarmT=9; // a gangue toda revida por um tempo
}

// chamado por weapons.js quando uma bala acerta um membro
export function killGangPed(m,dir){
  if(m.state==='dead'||m.state==='fly')return;
  m.state='fly';
  m.vel.copy(dir).multiplyScalar(9).add(new THREE.Vector3(rand(-1.5,1.5),rand(5,7),rand(-1.5,1.5)));
  gangCasualty(m);
  addWanted(.4,null,'ped_shot');
}

const tracers=[];
function addTracer(a,b){
  const line=makeGangTracerLine(a,b);
  scene.add(line);tracers.push({line,t:0});
}

function memberShoot(m,pp,dist){
  m.shootT=rand(1.1,1.9);
  const from=m.g.position.clone();from.y+=1.25;
  const hit=Math.random()<clamp(.8-dist*.018,.18,.8);
  const to=new THREE.Vector3(pp.x,pp.y+1.1,pp.z);
  if(!hit){
    const a=rand(0,Math.PI*2);
    to.x+=Math.cos(a)*rand(.8,2.2);to.z+=Math.sin(a)*rand(.8,2.2);
  }
  addTracer(from,to);
  gunshot(.35); // tiro de gangue: mais distante/abafado que o do jogador
  if(hit){
    state.health-=state.mode==='car'?irand(2,5):irand(5,10); // lataria protege um pouco
    state.shake=Math.max(state.shake,.14);
    if(state.health<=0){state.health=100;getWasted();}
  }
}

export function updateGangs(dt){
  if(gangsHidden)return; // corrida de rua em andamento: gangues pausadas/escondidas
  const pp=playerPos();
  const c=refs.getCur?.();
  const danger=state.mode==='car'&&c&&Math.abs(c.speed)>6;
  // na fachada de um prédio especial o jogador está a salvo: nada de aviso de
  // território nem de gangue mirando/atirando nele (mesmo se o prédio cair
  // dentro de um território, caso da academia nos VIPERS)
  const playerSafe=inSpecialZone(pp.x,pp.z);
  for(const g of gangs){
    if(g.defeated)continue; // gangue eliminada: não age mais (sem reforço/aviso/blip)
    g.alarmT=Math.max(0,g.alarmT-dt);
    const inside=Math.hypot(pp.x-g.x,pp.z-g.z)<g.r&&!playerSafe;
    if(inside&&!g.wasInside&&state.started&&state.mode!=='cut')
      message(g.name+' TERRITORY - WATCH YOUR BACK!',g.css);
    g.wasInside=inside;
    // efetivo vivo (em pé) desta gangue agora
    let live=0;for(const m of gangPeds)if(m.gang===g&&m.state!=='dead'&&m.state!=='fly')live++;
    // reforço: só enquanto SOBRAR efetivo (g.remaining) e abaixo do limite de vivos
    g.spawnT-=dt;
    if(g.spawnT<=0){
      if(g.remaining>0&&live<GANG_ALIVE)spawnMember(g);
      g.spawnT=clamp(46-g.r*.55,12,40)*rand(.85,1.25);
    }
    // ELIMINADA: efetivo esgotado e ninguém mais vivo → some do mapa de vez
    if(g.remaining<=0&&live===0){
      g.defeated=true;g.r=0;g.wasInside=false;
      if(state.started)message(g.name+' WIPED OUT!',g.css);
      blip([523,659,784,1047],.1,'square',.2);
    }
  }
  for(let i=gangPeds.length-1;i>=0;i--){
    const m=gangPeds[i],p=m.g.position;
    if(m.state==='fly'){
      p.addScaledVector(m.vel,dt);
      m.vel.y-=22*dt;m.g.rotation.x+=9*dt;
      if(p.y<.35&&m.vel.y<0){
        p.y=.35;m.state='dead';m.t=0;
        m.g.rotation.set(-Math.PI/2,m.g.rotation.y,0);
      }
      continue;
    }
    if(m.state==='dead'){
      m.t+=dt;
      if(m.t>3)setOpacity(m.g,Math.max(0,1-(m.t-3)/.8));
      if(m.t>3.8){scene.remove(m.g);gangPeds.splice(i,1);}
      continue;
    }
    // atropelamento também conta como baixa (e encolhe o território)
    if(danger&&p.distanceTo(c.g.position)<2.3){
      m.state='fly';
      m.vel.set(Math.sin(c.heading),0,Math.cos(c.heading)).multiplyScalar(c.speed*.4)
        .add(new THREE.Vector3(rand(-2,2),rand(5,8),rand(-2,2)));
      gangCasualty(m);
      addWanted(1,'HIT AND RUN!','hit_run');
      thud(Math.abs(c.speed));state.shake=.35;
      continue;
    }
    const g=m.gang;
    const distP=Math.hypot(pp.x-p.x,pp.z-p.z);
    const playerInside=Math.hypot(pp.x-g.x,pp.z-g.z)<g.r;
    const aggro=state.started&&state.mode!=='cut'&&!playerSafe
      &&(playerInside||g.alarmT>0)&&distP<g.r+30;
    let mvAmount=0;
    if(aggro){
      const dir=_gdir.set(pp.x-p.x,0,pp.z-p.z).normalize();
      m.g.rotation.y=Math.atan2(dir.x,dir.z);
      if(distP>13){p.addScaledVector(dir,4.6*dt);mvAmount=.85;m.bob+=dt*10;}
      m.shootT-=dt;
      if(m.shootT<=0&&distP<34)memberShoot(m,pp,distP);
    }else{
      m.tgtT-=dt;
      if(!m.tgt||m.tgtT<=0||p.distanceTo(m.tgt)<1.2){
        const a=rand(0,Math.PI*2),d=Math.sqrt(Math.random())*g.r*.85;
        m.tgt=new THREE.Vector3(g.x+Math.cos(a)*d,0,g.z+Math.sin(a)*d);
        m.tgtT=rand(5,9); // troca de alvo mesmo se travar num prédio
      }
      const dir=_gdir.subVectors(m.tgt,p);dir.y=0;
      if(dir.length()>.1){
        dir.normalize();p.addScaledVector(dir,1.3*dt);
        m.g.rotation.y=Math.atan2(dir.x,dir.z);mvAmount=.3;m.bob+=dt*2.9;
      }
    }
    collideStatics(p,.4);
    repelFromZones(p); // não pisa na fachada dos prédios especiais
    p.y=Math.abs(Math.sin(m.bob))*.07;
    Entities.animatePed?.(m.g,m.bob,mvAmount);
    if(aggro)poseAiming(m.g); // pose padrão de mira, por cima da animação de andar
  }
  for(let i=tracers.length-1;i>=0;i--){
    const t=tracers[i];t.t+=dt;
    t.line.material.opacity=Math.max(0,.9-t.t*7);
    if(t.t>.15){scene.remove(t.line);tracers.splice(i,1);}
  }
}
