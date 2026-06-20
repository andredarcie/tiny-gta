import * as THREE from 'three';
import {state,refs} from './state.js';
import {economy} from './economy.js';
import {scene} from './engine.js';
import {playerPos,cur,idleCars} from './player.js';
import {makeCar} from './entities.js';
import {buyWeapon} from './weapons.js';
import {message,bigText,hideBig} from './hud.js';
import {blip,thud,setFireSiren,setHose} from './audio.js';
import {N,nodeX,irand,rand,clamp,groundHeight} from './constants.js';
import {makeDeliveryMarker} from '../assets/models/missions/delivery-marker.js';
import {makeBlazeModel} from '../assets/models/effects/blaze.js';
import {makeFireTruck} from '../assets/models/vehicles/fire-truck.js';
import {MiniGame,MiniGameId} from './minigame.js';
import {reportMiniGameResult} from './minigame-leaderboard.js';
import type {ZoneAction} from './types.js';

// ============================================================================
// MINIGAME FIREFIGHTER (fiel ao open-world, repaginado pra dar gosto de combate)
//  - um caminhão de bombeiros (com canhão d'água giratório + sirene) fica numa
//    esquina; entrar nele começa o plantão;
//  - a cada nível nasce UM VEÍCULO em chamas numa interseção (carro carbonizado
//    engolido pelo fogo), com COLUNA DE FUMAÇA visível de longe e brasas;
//  - igual ao open-world: o TEMPO concedido por incêndio é proporcional à DISTÂNCIA
//    (tem que correr pela cidade) e acumula no relógio — o que sobra vai pro
//    próximo;
//  - chegue de caminhão e BORRIFE: dentro do alcance do canhão sai um JATO D'ÁGUA
//    que mira no fogo e vai apagando — cada incêndio tem "vida" (intensidade) que
//    cai enquanto a água bate e SE RECUPERA um pouco se você se afasta no meio;
//  - apagar paga (bônus por rapidez) e sobe o nível (fogo maior, mais "vida");
//    apagar FLAME_AT incêndios libera o LANÇA-CHAMAS (recompensa do open-world);
//    zerou o cronômetro, o plantão acaba;
//  - sair do caminhão / WASTED / BUSTED encerra; caminhão destruído reaparece.
// ============================================================================

const FF_BUILD=' ◆ FIREFIGHTER';
document.getElementById('buildver')?.insertAdjacentText('beforeend',FF_BUILD);

const ORANGE=0xff7a1e;
// open-world: o tempo de cada incêndio é proporcional à DISTÂNCIA (correr pela
// cidade) + uma base pra apagar, e ACUMULA no relógio (sobra vai pro próximo).
const TIME_PER_M=.12;      // segundos concedidos por metro até o fogo
const FIRE_BASE=8;         // base por incêndio (apagar depois de chegar)
const TIME_MIN=12,TIME_MAX=30; // piso/teto do tempo concedido por incêndio
const START_BUFFER=6;      // folga extra só no 1º incêndio (dar partida)
const LOW_TIME=8;          // abaixo disso o HUD pisca vermelho e bipa
const FLAME_AT=10;         // incêndios apagados que liberam o LANÇA-CHAMAS (open-world)
const SPRAY_RANGE=11;      // alcance do canhão d'água (m): chegou perto, já borrifa
const DOUSE_RATE=0.7;      // "vida" do fogo apagada por segundo de jato
const REGEN_RATE=0.6;      // "vida" recuperada por segundo quando ninguém borrifa
const WRECK_RESPAWN=20;    // caminhão destruído: volta à esquina depois disso (s)

// caminhão estacionado na interseção x=nodeX(3)=-44, z=nodeX(6)=88 (asfalto livre,
// FORA do território dos SKULLS — regra: mini-game nunca nasce em zona de gangue)
const spawn={x:nodeX(3)+4,z:nodeX(6),heading:0};

const truck: any={g:makeFireTruck(),heading:0,speed:0,name:'FIRE TRUCK',firetruck:true};
truck.g.position.set(spawn.x,groundHeight(spawn.x,spawn.z),spawn.z);
truck.g.rotation.y=0;
scene.add(truck.g);
idleCars.push(truck);
const cannon=truck.g.userData.cannon||null;   // pivot do canhão d'água
const nozzle=truck.g.userData.nozzle||null;    // ponta do cano (origem do jato)

// um incêndio: VEÍCULO em chamas + marcador + "vida" (intensidade)
interface Fire{x:number;z:number;gy:number;group:THREE.Object3D;ring:THREE.Mesh;beacon:THREE.Mesh;car:THREE.Object3D;hp:number;maxHp:number;startT:number;}

let phase='off';     // off | duty
let level=1;         // incêndio atual: paga 60*level
let fires=0;         // incêndios apagados neste plantão
let timeLeft=0;      // cronômetro do plantão (acumula entre incêndios)
let timeRef=1;       // tempo "cheio" do incêndio atual (referência da barra do HUD)
let fire: Fire|null=null; // {x,z,gy,group,ring,beacon,car,hp,maxHp,startT}
let spraying=false;  // jato ligado agora? (controla som/transições da mangueira)
let wreckT=0;        // caminhão destruído: cronômetro até reaparecer
let lastBeep=-1;     // último segundo bipado no aviso de tempo baixo

const ffHud=document.getElementById('ffhud');

// scratch reaproveitado por frame (zero alocação no loop)
const _noz=new THREE.Vector3();

// ---------- partículas (pools reaproveitados, padrão do car-crusher) ----------
// fumaça (cada puff tem material próprio: opacidade animada por instância),
// brasas e gotas d'água (somem encolhendo, então compartilham material).
const _smokeGeo=new THREE.SphereGeometry(1,7,6);
const _emberGeo=new THREE.SphereGeometry(.1,6,5);
const _emberMat=new THREE.MeshBasicMaterial({color:0xff9a3a});
const _dropGeo=new THREE.SphereGeometry(.13,6,5);
const _dropMat=new THREE.MeshBasicMaterial({color:0xbfe6ff,transparent:true,opacity:.9,depthWrite:false});
interface Smoke{m:THREE.Mesh;vy:number;grow:number;t:number;life:number;o0:number;}
interface Ember{m:THREE.Mesh;vx:number;vy:number;vz:number;t:number;life:number;s0:number;}
interface Drop{m:THREE.Mesh;vx:number;vy:number;vz:number;t:number;life:number;s0:number;}
const smokePool: THREE.Mesh[]=[],smoke: Smoke[]=[];   // {m,vy,grow,t,life}
const emberPool: THREE.Mesh[]=[],embers: Ember[]=[];  // {m,vx,vy,vz,t,life,s0}
const dropPool: THREE.Mesh[]=[],drops: Drop[]=[];  // {m,vx,vy,vz,t,life,s0}
let smokeAcc=0,emberAcc=0,dropAcc=0;

function takeSmoke(){
  const m=smokePool.pop()||new THREE.Mesh(_smokeGeo,
    new THREE.MeshBasicMaterial({color:0x2a2630,transparent:true,opacity:.5,depthWrite:false}));
  if(!m.parent)scene.add(m);m.visible=true;return m;
}
// dark=true: fumaça preta da fogueira; dark=false: vapor branco onde a água bate
function spawnSmoke(x: number,y: number,z: number,dark: boolean){
  if(smoke.length>18)return;
  const m=takeSmoke();
  (m.material as THREE.MeshBasicMaterial).color.setHex(dark?0x26222c:0xd7e2ea);
  m.position.set(x+rand(-.5,.5),y,z+rand(-.5,.5));
  const s0=dark?(.6+rand(0,.45)):(.45+rand(0,.35));
  m.scale.setScalar(s0);
  (m.material as THREE.MeshBasicMaterial).opacity=dark?.5:.62;
  smoke.push({m,vy:dark?1.6+rand(0,.7):2.4+rand(0,1),grow:dark?1.2:1.7,
    t:0,life:dark?1.9:.85,o0:(m.material as THREE.MeshBasicMaterial).opacity});
}
function spawnEmber(x: number,y: number,z: number){
  if(embers.length>22)return;
  const m=emberPool.pop()||new THREE.Mesh(_emberGeo,_emberMat);
  if(!m.parent)scene.add(m);m.visible=true;
  const ang=rand(0,Math.PI*2),sp=1+rand(0,2.2);
  const s0=.6+rand(0,.8);m.scale.setScalar(s0);
  m.position.set(x,y,z);
  embers.push({m,vx:Math.cos(ang)*sp,vy:3+rand(0,3.5),vz:Math.sin(ang)*sp,t:0,life:.6+rand(0,.5),s0});
}
function spawnDrop(ox: number,oy: number,oz: number,tx: number,ty: number,tz: number){
  if(drops.length>64)return;
  const m=dropPool.pop()||new THREE.Mesh(_dropGeo,_dropMat);
  if(!m.parent)scene.add(m);m.visible=true;
  m.position.set(ox,oy,oz);
  const dx=tx-ox,dy=ty-oy,dz=tz-oz,d=Math.hypot(dx,dz)||1;
  const life=.5;
  // velocidade pra chegar ~no alvo no fim da vida + um empurrão pra cima (arco) e
  // um espalhamento, pra virar um leque de água em vez de uma linha reta.
  const sp=d/life;
  const s0=.7+rand(0,.7);m.scale.setScalar(s0);
  drops.push({m,
    vx:dx/d*sp+rand(-1.6,1.6),vy:dy/life+5+rand(0,3),vz:dz/d*sp+rand(-1.6,1.6),
    t:0,life:life+rand(0,.12),s0});
}

function updateParticles(dt: number){
  for(let i=smoke.length-1;i>=0;i--){
    const p=smoke[i];p.t+=dt;const k=p.t/p.life;
    if(k>=1){p.m.visible=false;smokePool.push(p.m);smoke.splice(i,1);continue;}
    p.m.position.y+=p.vy*dt;
    const s=p.m.scale.x+(p.grow)*dt;p.m.scale.setScalar(s);
    (p.m.material as THREE.MeshBasicMaterial).opacity=p.o0*(1-k);
  }
  for(let i=embers.length-1;i>=0;i--){
    const p=embers[i];p.t+=dt;const k=p.t/p.life;
    if(k>=1){p.m.visible=false;emberPool.push(p.m);embers.splice(i,1);continue;}
    p.vy-=14*dt;
    p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;
    p.m.scale.setScalar(p.s0*(1-k)); // some encolhendo (material compartilhado)
  }
  for(let i=drops.length-1;i>=0;i--){
    const p=drops[i];p.t+=dt;const k=p.t/p.life;
    if(k>=1){p.m.visible=false;dropPool.push(p.m);drops.splice(i,1);continue;}
    p.vy-=20*dt;
    p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;
    p.m.scale.setScalar(p.s0*(1-k*.6));
  }
}

function clearParticles(){
  for(const p of smoke){p.m.visible=false;smokePool.push(p.m);}smoke.length=0;
  for(const p of embers){p.m.visible=false;emberPool.push(p.m);}embers.length=0;
  for(const p of drops){p.m.visible=false;dropPool.push(p.m);}drops.length=0;
}

// mini game (sessão): trava o mundo enquanto o plantão roda; o alvo é o incêndio
const game=new MiniGame({id:MiniGameId.FIREFIGHTER,name:'Fire Brigade',
  blips:()=>fire?[{x:fire.x,z:fire.z,icon:'fire',color:'#ff7a1e',label:'FIRE',current:true,reveal:false}]:[]});

// ---------- registries (auto-registro no topo do módulo) ----------
(refs.carEnterLabels||(refs.carEnterLabels=[])).push((c: any)=>
  c===truck?{label:'FIRE',prompt:'START FIRE BRIGADE',enabled:true} as ZoneAction:null);

(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  phase==='duty'&&fire
    ?[{x:fire.x,z:fire.z,icon:'fire',color:'#ff7a1e',label:'FIRE',current:true,reveal:false}]
    :[{x:truck.g.position.x,z:truck.g.position.z,icon:'fire',color:'#ff7a1e',label:'FIRE BRIGADE'}]);

refs.getFirefighterState=()=>({onDuty:phase==='duty',level,fires,timeLeft,
  blaze:fire?+(fire.hp/fire.maxHp).toFixed(2):0});

// charred: carro do incêndio sempre carbonizado (cor só do paint, cacheada; os
// outros materiais são compartilhados, então NÃO se mexe neles)
const CHARRED=0x140f0c;

// nasce um incêndio (um VEÍCULO em chamas) numa interseção a 50–110m do jogador.
// Em 40 tentativas sem achar na faixa, usa a MELHOR (nunca em cima do jogador nem
// fora do mapa). O tempo concedido é proporcional à distância e acumula no relógio.
function spawnFire(initial?: boolean){
  const pp=playerPos();
  let x=spawn.x,z=spawn.z,best=Infinity,bx=spawn.x,bz=spawn.z;
  for(let tries=0;tries<40;tries++){
    x=nodeX(irand(1,N-1));z=nodeX(irand(1,N-1));
    const d=Math.hypot(x-pp.x,z-pp.z);
    if(d>=50&&d<=110){bx=x;bz=z;break;}
    const miss=d<50?50-d:d-110;
    if(miss<best){best=miss;bx=x;bz=z;}
  }
  x=bx;z=bz;
  const gy=groundHeight(x,z);
  // VEÍCULO em chamas (alvo do incêndio, estilo open-world). Wreck estático: sem
  // sombra (custo) e fora de idleCars (não vira carro dirigível/colidível).
  const car=(makeCar as any)(CHARRED);
  car.position.set(x,gy,z);
  car.rotation.y=rand(0,Math.PI*2);
  car.traverse((o: any)=>{if(o.isMesh)o.castShadow=false;});
  // chamas por cima do carro
  const group=makeBlazeModel();
  group.position.set(x,gy,z);
  group.scale.setScalar(blazeScale(1));      // começa "raging" (hp=maxHp)
  // marcador no chão (anel laranja + facho), reusa o modelo de entrega
  const{ring,beacon}=makeDeliveryMarker(ORANGE);
  ring.position.set(x,gy+.4,z);
  beacon.position.set(x,gy+30,z);
  scene.add(group,ring,beacon);
  const maxHp=2.4+level*0.5;
  fire={x,z,gy,group,ring,beacon,car,hp:maxHp,maxHp,startT:state.time};
  // tempo ~ distância (open-world) + base; acumula no relógio (sobra carrega)
  const dist=Math.hypot(x-pp.x,z-pp.z);
  let grant=clamp(Math.round(dist*TIME_PER_M+FIRE_BASE),TIME_MIN,TIME_MAX);
  if(initial)grant+=START_BUFFER;
  timeLeft+=grant;timeRef=timeLeft;
  message(`FIRE ${Math.round(dist)}m AWAY · +${grant}s`,'var(--gold)');
}

// escala visual do fogo conforme a fração de vida (0.45 quase apagado → 1 raging),
// com um degrau por nível pra incêndios maiores lá na frente
function blazeScale(frac: number){
  return (.55+.45*clamp(frac,0,1))*(.85+Math.min(level,7)*.07);
}

function removeFire(){
  if(!fire)return;
  // NÃO dar dispose na geometria do carro: makeCar usa geometrias fundidas
  // COMPARTILHADAS entre todos os carros — só tira o veículo da cena.
  scene.remove(fire.group,fire.ring,fire.beacon,fire.car);
  fire=null;
}

// recoloca o caminhão na esquina e zera batidas/afundamento
function resetTruck(){
  truck.speed=0;truck.heading=spawn.heading;truck.sinkT=0;
  truck.g.userData.bulletHits=0;
  truck.g.position.set(spawn.x,groundHeight(spawn.x,spawn.z),spawn.z);
  truck.g.rotation.set(0,spawn.heading,0);
  if(cannon)cannon.rotation.y=0;
}

function setSpraying(on: boolean){
  if(on===spraying)return;
  spraying=on;
  setHose(on);
}

function startDuty(){
  if(!game.begin())return; // outra sessão de mini game rolando: não começa
  phase='duty';level=1;fires=0;timeLeft=0;lastBeep=-1;
  setFireSiren(true);
  bigText('FIRE BRIGADE','var(--gold)');setTimeout(hideBig,1100);
  blip([523,659,784],.09,'square',.18);
  spawnFire(true); // 1º incêndio: concede o tempo (distância) + folga de partida
  updateFfHud();
}

function endDuty(text='FIRE BRIGADE OVER',col='var(--cyan)'){
  removeFire();
  clearParticles();
  setSpraying(false);
  setFireSiren(false);
  if(cannon)cannon.rotation.y=0;
  const summary=fires>0?` - ${fires} FIRES / LVL ${level}`:'';
  // ranking: o plantão inteiro é UMA sessão; score = incêndios apagados
  reportMiniGameResult(game.id,{won:fires>0,score:fires});
  phase='off';
  game.end(); // libera a trava do mundo
  hideFfHud();
  message(text+summary,col);
}

function extinguishFire(){
  // bônus por rapidez: apagar rápido paga mais (some por volta de ~12s no fogo)
  const elapsed=state.time-fire!.startT;
  const speedBonus=Math.max(0,Math.round(90-elapsed*7));
  const reward=60*level+speedBonus;
  economy.earn(reward,'firefighter');
  fires++;
  // baita baforada de vapor onde o fogo estava + baque + jingle de vitória
  for(let i=0;i<10;i++)spawnSmoke(fire!.x,fire!.gy+.5+rand(0,1.4),fire!.z,false);
  thud(6);
  state.shake=Math.max(state.shake,.12);
  message(speedBonus>0?`FIRE OUT +$${reward} (QUICK! +$${speedBonus})`:`FIRE OUT +$${reward}`,'var(--gold)');
  bigText('FIRE OUT','var(--gold)');setTimeout(hideBig,1100);
  blip([523,659,784,1047],.1,'square',.2);
  removeFire();
  setSpraying(false);
  // recompensa do open-world: apagar FLAME_AT incêndios libera o lança-chamas
  if(fires===FLAME_AT&&buyWeapon('flame')){
    message('FLAMETHROWER UNLOCKED!','var(--pink)');
    bigText('FLAMETHROWER','var(--pink)');setTimeout(hideBig,1400);
    blip([440,660,880,1320],.12,'square',.2);
  }
  level++;
  spawnFire(); // próximo incêndio concede o tempo (distância); a sobra carrega
}

// tremor das chamas (escala/opacidade/balanço) — igual ao molotov, agora no blaze
function flickerBlaze(dt: number){
  for(const fl of fire!.group.userData.flames||[]){
    const w=.78+Math.sin(state.time*11+fl.position.x*3+fl.position.z*2)*.22;
    fl.scale.y=w;
    fl.rotation.z=Math.sin(state.time*7+fl.position.z*4)*.12;
    if(fl.material)fl.material.opacity=clamp(.6+w*.3,0,1);
  }
  // marcador pulsando
  fire!.ring.rotation.z+=2*dt;
  const sc=1+Math.sin(state.time*4)*.12;fire!.ring.scale.set(sc,sc,1);
}

// combate ao fogo: mira o canhão, borrifa, abate a "vida"; longe, o fogo recupera
function updateFire(dt: number){
  flickerBlaze(dt);

  const f=fire!;
  const tp=truck.g.position;
  const dist=Math.hypot(tp.x-f.x,tp.z-f.z);
  const inRange=dist<SPRAY_RANGE;

  // mira do canhão: aponta pro fogo quando perto, volta pra frente quando longe
  if(cannon){
    const want=inRange?Math.atan2(f.x-tp.x,f.z-tp.z)-truck.g.rotation.y:0;
    let diff=THREE.MathUtils.euclideanModulo(want-cannon.rotation.y+Math.PI,Math.PI*2)-Math.PI;
    cannon.rotation.y+=diff*Math.min(1,10*dt);
  }

  // coluna de fumaça preta + brasas saindo do fogo (taxa pela intensidade)
  const frac=f.hp/f.maxHp;
  const top=f.gy+2.2*blazeScale(frac);
  smokeAcc+=dt;
  const smokeEvery=1/(3+frac*5);        // fogo forte fumega mais
  while(smokeAcc>=smokeEvery){smokeAcc-=smokeEvery;spawnSmoke(f.x,top,f.z,true);}
  emberAcc+=dt;
  const emberEvery=1/(5+frac*7);
  while(emberAcc>=emberEvery){emberAcc-=emberEvery;
    spawnEmber(f.x+rand(-.8,.8),f.gy+.6+rand(0,1),f.z+rand(-.8,.8));}

  if(inRange){
    setSpraying(true);
    f.hp-=DOUSE_RATE*dt;
    // jato d'água saindo da ponta do canhão em direção ao fogo (leque de gotas)
    if(nozzle){
      nozzle.getWorldPosition(_noz);
      dropAcc+=dt;
      const dropEvery=1/30;
      while(dropAcc>=dropEvery){dropAcc-=dropEvery;
        spawnDrop(_noz.x,_noz.y,_noz.z,f.x,f.gy+1,f.z);}
    }
    // vapor branco subindo de onde a água bate (o fogo "geme")
    if(Math.random()<dt*16)spawnSmoke(f.x,f.gy+.7,f.z,false);
    if(f.hp<=0){extinguishFire();return;}
  }else{
    setSpraying(false);
    if(f.hp<f.maxHp)f.hp=Math.min(f.maxHp,f.hp+REGEN_RATE*dt);
  }
  // encolhe/cresce o fogo conforme a vida
  f.group.scale.setScalar(blazeScale(f.hp/f.maxHp));
}

// ---------- HUD dedicado (#ffhud) ----------
function hideFfHud(){ffHud?.classList.remove('show');}
function updateFfHud(){
  if(!ffHud)return;
  if(phase!=='duty'){hideFfHud();return;}
  ffHud.classList.add('show');
  // barra de tempo relativa ao "cheio" do incêndio atual (timeRef)
  const timePct=Math.round(clamp(timeLeft/Math.max(timeRef,1),0,1)*100);
  const blazePct=fire?Math.round(clamp(fire.hp/fire.maxHp,0,1)*100):0;
  const low=timeLeft<LOW_TIME?' ff-low':''; // tempo acabando: vermelho piscando
  ffHud.innerHTML=`
    <div class="ff-label">FIRE BRIGADE</div>
    <div class="ff-main"><span>LEVEL</span><b>${level}</b></div>
    <div class="ff-row"><span>FIRES</span><b>${fires}</b></div>
    <div class="ff-row${low}"><span>TIME</span><b>${Math.ceil(timeLeft)}s</b></div>
    <div class="ff-meter${low}"><i style="width:${timePct}%"></i></div>
    <div class="ff-row"><span>BLAZE</span><b>${blazePct}%</b></div>
    <div class="ff-meter ff-blaze"><i style="width:${blazePct}%"></i></div>`;
}

export function updateFirefighter(dt: number){
  // caminhão destruído: sai da cena e do idleCars; reaparece na esquina (igual
  // à viatura do vigilante). Se foi destruído em serviço, encerra o plantão.
  if(!truck.g.parent&&cur!==truck){
    if(phase==='duty')endDuty('FIRE TRUCK DESTROYED','var(--pink)');
    wreckT+=dt;
    if(wreckT>=WRECK_RESPAWN){
      wreckT=0;resetTruck();
      scene.add(truck.g);
      if(!idleCars.includes(truck))idleCars.push(truck);
      message('A NEW FIRE TRUCK IS WAITING AT THE STATION','var(--cyan)');
    }
    return;
  }
  wreckT=0;

  const driving=state.mode==='car'&&cur===truck;
  if(phase==='off'){
    if(driving)startDuty(); // entrou no caminhão: começa o plantão
    return;
  }
  if(!driving){endDuty();return;} // saiu do caminhão (ou WASTED/BUSTED): encerra

  timeLeft-=dt;
  if(timeLeft<=0){endDuty('FIRE BRIGADE OVER','var(--pink)');return;}
  // tempo acabando: bipa uma vez por segundo (aviso de pressão, estilo open-world)
  if(timeLeft<LOW_TIME){
    const s=Math.ceil(timeLeft);
    if(s!==lastBeep){lastBeep=s;blip([880],.07,'square',.16);}
  }else lastBeep=-1;
  if(fire)updateFire(dt);
  updateParticles(dt);
  updateFfHud();
}
