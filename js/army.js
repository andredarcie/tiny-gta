import * as THREE from 'three';
import {N,clamp,rand,wrapA,nodeX,irand,groundHeight} from './constants.js';
import {state,refs} from './state.js';
import {scene} from './engine.js';
import {makePed,animatePed,spinWheels,dentCar,attachHandGun,poseAiming,disposeGeometries} from './entities.js';
import {makeArmyTruck} from '../assets/models/vehicles/army-truck.js';
import {makeGangTracerLine} from '../assets/models/effects/gang-tracer.js';
import {thud,gunshot} from './audio.js';
import {collideStatics} from './physics.js';
import {playerPos,cur,getWasted} from './player.js';
import {message} from './hud.js';

// ============================================================================
// EXÉRCITO — a resposta da ESTRELA MÁXIMA (★6). Quando o jogador chega às 6
// estrelas, UM caminhão verde camuflado (assets/models/vehicles/army-truck.js)
// entra em cena com 4 SOLDADOS de pé na caçamba, metralhadoras em punho. O
// caminhão PERSEGUE o jogador; quando o jogador PARA (a pé ou de carro quase
// parado) e o caminhão chega perto, os 4 soldados DESCEM e metralham. Se o
// jogador foge, eles reembarcam e a caça recomeça. Soldados morrem por tiro/
// explosão do jogador (via refs.armyTargets / refs.blastArmy); se a tropa toda
// cai, o caminhão recua e uma nova leva chega depois de uns segundos.
//
// Modelado no js/police.js (mesma IA de viatura + dupla a pé), mas com tropa
// MAIOR, metralhadora (cadência alta) e o veículo próprio do exército. Some
// quando o procurado cai de 6 (refs limpos no WASTED/BUSTED, como a polícia).
// ============================================================================

const ARMY_AT=6;          // estrela que chama o exército (a máxima)
const TRUCK_MAXSPD=25;    // teto de velocidade do caminhão na perseguição
const RESPAWN_GAP=4;      // segundos até uma nova leva quando a tropa toda cai

// Cada soldado leva uma arma DIFERENTE (variedade). Tiro em RITMO: dispara
// `burst` tiros espaçados por `fire`s e então faz uma PAUSA de `gap`s (por isso
// não atira 100% do tempo). `range`=alcance, `pellets`=projéteis por tiro
// (espingarda espalha), `dmgFoot/Car`=dano a pé / protegido pela lataria.
const SQUAD=[
  {model:'ak47',   fire:[.12,.20],burst:[3,5], gap:[1.0,2.0],range:34,spread:1.4,pellets:1,dmgFoot:[4,8],dmgCar:[2,4],vol:.32},
  {model:'uzi',    fire:[.06,.11],burst:[6,10],gap:[1.3,2.4],range:24,spread:2.2,pellets:1,dmgFoot:[2,5],dmgCar:[1,2],vol:.24},
  {model:'shotgun',fire:[.70,1.0],burst:[1,1], gap:[.8,1.6], range:15,spread:3.2,pellets:4,dmgFoot:[4,7],dmgCar:[2,4],vol:.5},
  {model:'pistol', fire:[.30,.50],burst:[1,2], gap:[1.1,2.0],range:28,spread:1.2,pellets:1,dmgFoot:[5,9],dmgCar:[2,4],vol:.3},
];

let truck=null;           // {g,heading,speed,stuckT,backT,dentT,deployed,allDeadAt}
let soldiers=[];          // {g,seat,wpn,flank,stop,mode,bob,shootT,burstLeft,restT,dead,deadT}
let respawnAt=-1;         // momento (state.time) em que pode nascer a próxima leva
let lastMsg=-99;
const tracers=[];

const OLIVE=0x4a5320,OLIVE_PANTS=0x2f3318;
const _wp=new THREE.Vector3(),_push=new THREE.Vector3(),_mid=new THREE.Vector3();

// pose de pé segurando a metralhadora (uzi) — usada na caçamba e ao desembarcar
function holdPose(o){poseAiming(o.g);}

// embarca/posiciona o soldado na caçamba do caminhão (parenteado ao grupo)
function seatInBed(o){
  truck.g.add(o.g);
  o.g.position.set(o.seat.x,o.seat.y,o.seat.z);
  o.g.rotation.set(0,o.seat.ry,0);
  holdPose(o);
  o.mode='ride';
}

function spawnArmy(){
  const px=playerPos();
  // nasce numa interseção a 50–85m: perto o bastante pra CHEGAR rápido (não ficar
  // preso a meio mapa), longe o bastante pra não nascer no colo. Sem achar na
  // faixa em 40 tentativas, usa a interseção mais próxima de 65m.
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
  truck={g,heading:g.rotation.y,speed:0,stuckT:0,backT:0,dentT:0,deployed:false,allDeadAt:0};
  soldiers=[];
  const seats=g.userData.seats||[];
  for(let i=0;i<4;i++){
    const wpn=SQUAD[i%SQUAD.length]; // cada um com uma arma diferente
    const o={g:makePed(OLIVE,OLIVE_PANTS),seat:seats[i]||{x:0,y:1.0,z:0,ry:0},
      wpn,flank:(i-1.5)*0.5,   // leque ao redor do jogador (−0.75..+0.75 rad)
      stop:9+(i%2)*3,          // anéis a 9m e 12m (dá profundidade ao leque)
      mode:'ride',bob:rand(0,6),shootT:0,burstLeft:0,restT:rand(.2,1),dead:false,deadT:0};
    o.g.traverse(m=>{if(m.isMesh)m.castShadow=false;}); // tropa sem sombra (custo)
    attachHandGun(o.g,wpn.model); // arma própria na mão direita
    seatInBed(o);
    soldiers.push(o);
  }
  if(state.time-lastMsg>4){lastMsg=state.time;
    message('★6 — THE ARMY IS HERE! RUN!','var(--pink)');}
}

// desembarca toda a tropa viva (caminhão parou perto do alvo parado)
function deploy(){
  truck.deployed=true;
  for(const o of soldiers){
    if(o.dead||o.mode!=='ride')continue;
    o.g.getWorldPosition(_wp);     // posição atual na caçamba -> chão ao lado
    scene.add(o.g);                // reparenteia (THREE mantém o LOCAL, então reescrevo)
    o.g.position.set(_wp.x,0,_wp.z);
    o.g.rotation.set(0,0,0);
    o.mode='hunt';o.bob=rand(0,6);o.shootT=0;o.burstLeft=0;o.restT=rand(.3,1.2);
  }
  if(state.time-lastMsg>4){lastMsg=state.time;
    message('SOLDIERS ON FOOT — OPEN FIRE!','var(--pink)');}
}

function addTracer(a,b){const line=makeGangTracerLine(a,b);scene.add(line);tracers.push({line,t:0});}

// um TIRO da arma do soldado (1 projétil, ou várias bolinhas na espingarda). O
// ritmo (rajada/pausa) é decidido em updateSoldier; aqui só resolve o disparo.
function fireRound(o,pp,dist){
  const w=o.wpn;
  const from=o.g.position.clone();from.y+=1.3;
  for(let k=0;k<(w.pellets||1);k++){
    const hit=Math.random()<clamp(.62-dist*.012,.14,.62);
    const to=new THREE.Vector3(pp.x,pp.y+1.1,pp.z);
    if(!hit){const a=rand(0,Math.PI*2),r=rand(.6,w.spread);to.x+=Math.cos(a)*r;to.z+=Math.sin(a)*r;}
    addTracer(from,to);
    if(hit){
      const dmg=state.mode==='car'?w.dmgCar:w.dmgFoot; // lataria protege
      state.health-=irand(dmg[0],dmg[1]);
      state.shake=Math.max(state.shake,.1);
      if(state.health<=0){state.health=100;getWasted();break;}
    }
  }
  gunshot(w.vol||.3);
}

function killSoldier(o){
  if(o.dead)return;
  o.dead=true;o.deadT=0;state.kills++;
  o.g.rotation.set(-Math.PI/2,o.g.rotation.y,0); // tomba de costas como os outros
  o.g.position.y=.35;
  refs.addBloodPuddle?.(o.g.position.x,o.g.position.z);
  state.lastCrime=state.time; // matar soldado mantém o calor no máximo
}

function removeArmy(){
  if(truck){scene.remove(truck.g);truck=null;}
  for(const o of soldiers)scene.remove(o.g);
  soldiers=[];
}

// WASTED/BUSTED limpa tudo (player.js chama via refs, como clearCops)
export function clearArmy(){
  removeArmy();
  for(const t of tracers){disposeGeometries(t.line);scene.remove(t.line);}
  tracers.length=0;
  respawnAt=-1;
}
refs.clearArmy=clearArmy;

// alvos que o arsenal do jogador pode acertar: SÓ a tropa desembarcada (a que está
// na caçamba é parte do caminhão). Mesmo padrão de refs.gunShopTargets/storyTargets.
refs.armyTargets=()=>soldiers.filter(o=>!o.dead&&(o.mode==='hunt'||o.mode==='return'))
  .map(o=>({g:o.g,r:1.05,hit:()=>killSoldier(o)}));

// onda de choque (explosão/molotov do jogador) mata a tropa desembarcada no raio
refs.blastArmy=(pos)=>{
  for(const o of soldiers){
    if(o.dead||o.mode==='ride')continue;
    if(Math.hypot(o.g.position.x-pos.x,o.g.position.z-pos.z)<5)killSoldier(o);
  }
};

// distância do caminhão ao jogador. police.js usa pra NÃO esfriar o procurado
// enquanto o exército está em cima (o exército mantém o calor no lugar da polícia,
// que se retirou nas 6 estrelas).
refs.armyDist=()=>{if(!truck)return 1e9;const p=playerPos();
  return Math.hypot(truck.g.position.x-p.x,truck.g.position.z-p.z);};

// blip vermelho no radar/mapa: mostra de onde o caminhão do exército vem
// (sem isso o jogador não enxergava a tropa chegando e achava que "nada apareceu").
(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  truck?[{x:truck.g.position.x,z:truck.g.position.z,icon:'skull',color:'#ff3b3b',
    label:'ARMY',current:true,reveal:false}]:[]);

// debug
refs.getArmyState=()=>({active:!!truck,deployed:!!truck?.deployed,
  soldiers:soldiers.filter(o=>!o.dead).length});

function updateSoldier(o,dt,pp){
  if(o.dead){
    o.deadT+=dt;
    if(o.deadT>8&&o.g.parent){scene.remove(o.g);}
    return;
  }
  if(o.mode==='ride')return; // posição/pose vêm do caminhão (parenteado)
  const p=o.g.position;
  if(o.mode==='return'){
    const tp=truck?truck.g.position:p;
    const dx=tp.x-p.x,dz=tp.z-p.z,d=Math.hypot(dx,dz)||1;
    if(!truck){o.mode='hunt';return;}
    if(d<2.4){seatInBed(o);return;} // reembarcou
    p.x+=dx/d*7*dt;p.z+=dz/d*7*dt;p.y=groundHeight(p.x,p.z);
    o.g.rotation.y=Math.atan2(dx,dz);
    o.bob+=dt*12;animatePed(o.g,o.bob,1);
    collideStatics(p,.5);
    return;
  }
  // caçando: cada soldado ocupa um lugar PRÓPRIO no leque ao redor do jogador
  // (ângulo flank + distância stop), saindo do lado em que o caminhão está — assim
  // não se amontoam num ponto só. Chegou no lugar, atira em RITMO de rajadas.
  const baseAng=truck?Math.atan2(truck.g.position.x-pp.x,truck.g.position.z-pp.z)
                     :Math.atan2(p.x-pp.x,p.z-pp.z);
  const ang=baseAng+o.flank;
  const tx=pp.x+Math.sin(ang)*o.stop,tz=pp.z+Math.cos(ang)*o.stop;
  const mx=tx-p.x,mz=tz-p.z,md=Math.hypot(mx,mz)||1;
  if(md>.9){
    const sp=Math.min(6,md*3); // anda até o lugar e desacelera (não ultrapassa)
    p.x+=mx/md*sp*dt;p.z+=mz/md*sp*dt;
    o.bob+=dt*11;animatePed(o.g,o.bob,1);
  }else animatePed(o.g,o.bob,0);
  p.y=groundHeight(p.x,p.z);
  holdPose(o);
  o.g.rotation.y=Math.atan2(pp.x-p.x,pp.z-p.z); // encara o jogador
  collideStatics(p,.5);
  const distP=Math.hypot(pp.x-p.x,pp.z-p.z);
  // tiro em RITMO: rajada curta e depois PAUSA (gap) — nunca 100% do tempo
  o.shootT-=dt;o.restT-=dt;
  if(pp.y-p.y<3&&distP<o.wpn.range&&o.restT<=0){
    if(o.burstLeft<=0)o.burstLeft=irand(o.wpn.burst[0],o.wpn.burst[1]);
    if(o.shootT<=0){
      fireRound(o,pp,distP);
      o.shootT=rand(o.wpn.fire[0],o.wpn.fire[1]);
      if(--o.burstLeft<=0)o.restT=rand(o.wpn.gap[0],o.wpn.gap[1]); // pausa entre rajadas
    }
  }
}

export function updateArmy(dt){
  const need=Math.floor(state.wanted)>=ARMY_AT;

  if(!need){ if(truck)clearArmy(); return; } // baixou de 6: exército vai embora

  if(!truck){
    if(respawnAt>0&&state.time<respawnAt)return; // respiro entre levas
    spawnArmy();
    return;
  }

  const pp=playerPos();
  const tp=truck.g.position;
  const dx=pp.x-tp.x,dz=pp.z-tp.z,dist=Math.hypot(dx,dz)||1;

  // tropa toda caída: caminhão recua e some; nova leva chega depois de RESPAWN_GAP
  if(soldiers.length&&soldiers.every(o=>o.dead)){
    if(!truck.allDeadAt)truck.allDeadAt=state.time;
    if(state.time-truck.allDeadAt>RESPAWN_GAP){
      clearArmy();respawnAt=state.time+1.2;return;
    }
  }else truck.allDeadAt=0;

  if(truck.deployed){
    // tropa desembarcada: caminhão espera parado. Jogador abriu distância (ou
    // arrancou de carro)? A tropa volta e reembarca; com todos a bordo, retoma a caça.
    truck.speed+=(0-truck.speed)*6*dt;spinWheels(truck.g,truck.speed,dt,0);
    const fleeing=dist>34||(state.mode==='car'&&Math.abs(cur?.speed||0)>10);
    for(const o of soldiers)if(!o.dead&&o.mode!=='ride')o.mode=fleeing?'return':'hunt';
    if(soldiers.every(o=>o.dead||o.mode==='ride'))truck.deployed=false;
  }else{
    // perseguição: dirige até o jogador, freia perto, recua se entala
    const desired=Math.atan2(dx,dz),diff=wrapA(desired-truck.heading);
    if(truck.backT>0){
      truck.backT-=dt;truck.speed+=(-7-truck.speed)*3*dt;
      truck.heading-=Math.sign(diff)*1.2*dt;
    }else{
      truck.heading+=clamp(diff,-1,1)*2.0*dt*clamp(Math.abs(truck.speed)/8+.25,0,1);
      // a pé: freia CEDO e para LONGE (o caminhão é só transporte de tropa, nunca
      // atropela). De carro pode encostar pra a tropa descer ao lado.
      const ts=dist>18?TRUCK_MAXSPD:(state.mode==='foot'?(dist<12?0:5):(dist<6?0:12));
      truck.speed+=(ts-truck.speed)*(ts<truck.speed?4:1.2)*dt;
    }
    tp.x+=Math.sin(truck.heading)*truck.speed*dt;
    tp.z+=Math.cos(truck.heading)*truck.speed*dt;
    if(collideStatics(tp,1.7)){truck.speed*=.3;truck.stuckT+=dt*3;}
    // trava anti-atropelamento: a pé, o caminhão NUNCA chega a menos de 7m do jogador
    if(state.mode==='foot'){
      const ax=tp.x-pp.x,az=tp.z-pp.z,ad=Math.hypot(ax,az)||1;
      if(ad<7){tp.x=pp.x+ax/ad*7;tp.z=pp.z+az/ad*7;truck.speed*=.3;}
    }
    if(Math.abs(truck.speed)<2.5)truck.stuckT+=dt;else truck.stuckT=Math.max(0,truck.stuckT-dt*2);
    if(truck.stuckT>1.3){truck.backT=.9;truck.stuckT=0;}
    tp.y=groundHeight(tp.x,tp.z);
    truck.g.rotation.y=truck.heading;
    spinWheels(truck.g,truck.speed,dt,clamp(diff,-1,1));

    // chegou perto do alvo parado e ainda tem tropa a bordo: desembarca
    const hasRiders=soldiers.some(o=>!o.dead&&o.mode==='ride');
    if(hasRiders&&pp.y<6&&!truck.backT&&
       (state.mode==='foot'?dist<12:dist<15&&Math.abs(cur?.speed||0)<4))deploy();

    // carro do jogador esbarra no caminhão: empurra e amassa (como as viaturas)
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

  // separação: soldados desembarcados NUNCA se empilham (empurra os que colam)
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
