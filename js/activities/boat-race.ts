import * as THREE from 'three';
import {clamp,rand,pick,WATER,SWIM_BOUND,RURAL_HALF,BOAT_SPAWN_X,BOAT_SPAWN_Z,rubberSpeed,separateRacers,diminishPrize,smoothPace} from '@/core/constants.ts';
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {scene} from '@/core/engine.ts';
import {makeBoat,makePed,shirtColors,disposeGeometries} from '@/core/entities.ts';
import {cur,playerPos,cameraRig} from '@/actors/player.ts';
import {makeBuoy} from '../../assets/models/missions/buoy.ts';
import {makeSeaMine} from '../../assets/models/missions/sea-mine.ts';
import {makeExplosionModel} from '../../assets/models/effects/explosion.ts';
import {makeBoatRaceGate} from '../../assets/models/missions/boat-race-gate.ts';
import {makeDeliveryMarker} from '../../assets/models/missions/delivery-marker.ts';
import {makeWakePuff} from '../../assets/models/effects/boat-wake.ts';
import {message,bigText,hideBig} from '@/ui/hud.ts';
import {blip,raceSiren} from '@/audio/audio.ts';
import {radioOff} from '@/ui/radio.ts';
import {raceMusicOn,raceMusicOff} from '@/audio/race-music.ts';
import {MiniGame,MiniGameId} from '@/activities/minigame.ts';
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.ts';
import type {Racer,PrizeStreak,Blip} from '@/core/types.ts';

// boia (x,z) na ordem do percurso (a última é a chegada)
interface RoutePoint{x: number; z: number;}
// waypoint dos rivais: boias (cp:true) + desvios laterais das minas (cp:false)
interface BoatWaypoint{x: number; z: number; cp: boolean;}
// posição de uma bomba aquática + o ponto de desvio lateral que os rivais usam
interface MineSpec{leg: number; x: number; z: number; dx: number; dz: number;}
// bomba 3D viva na cena durante a prova
interface Mine{g: THREE.Group; x: number; z: number; bobT: number;}
// explosão ativa de uma mina detonada
interface Blast{g: THREE.Object3D; t: number;}
// marcador 3D de uma boia ou da chegada flutuante
interface CpMarker{buoy?: THREE.Group; beacon?: THREE.Mesh; finish?: THREE.Object3D;}
// puff de espuma recicladle do rastro das rivais
interface RivalWake{g: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; t: number; life: number; s0: number; s1: number;}
// objeto que carrega o estado de "pulo" de mina (lancha do jogador ou rival)
interface HopHolder{mineHopV?: number; mineHopY?: number; [k: string]: any;}

// mini game (sessão): trava o mundo durante a prova de lanchas. A corrida desenha
// suas próprias boias no radar (ver raceOn no hud.js), então não expõe blips de
// alvo aqui — a trava garante o "um por vez" e o mapa sem outras atividades.
const game=new MiniGame({id:MiniGameId.BOAT_RACE,name:'Boat Race'});

// Corrida de LANCHAS no mar: mesmo esquema da corrida de rua (race.js), só que na
// água. Um pórtico flutuante de largada fica numa enseada; chegue de lancha, pare
// embaixo e a prova começa: a lancha teleporta pra linha, sirene + contagem 3-2-1,
// e então um percurso de BOIAS (uma por vez) que você contorna NA ORDEM até a
// chegada flutuante. Três rivais em lanchas percorrem de fato o trajeto em mar
// aberto. As gangues somem durante a prova e voltam no fim. Música/rádio são
// exclusivos da corrida; se todos os rivais chegarem antes, você perde. Cada
// corrida concluída faz a próxima nascer noutro trecho do litoral.
//
// O percurso corre por um ANEL costeiro no mar (raio de Chebyshev COAST_R) que
// contorna a cidade evitando a península rural a leste (terra). Por isso é um
// traçado em "C": cada prova é um pedaço contínuo desse anel, com largada e
// sentido sorteados — os segmentos entre boias nunca cruzam terra.

const RACE_BUILD=' ◆ SEA';
document.getElementById('buildver')?.insertAdjacentText('beforeend',RACE_BUILD);

const CP_COUNT=7;       // boias do percurso (a última é a chegada)
const CP_SPACING=88;    // espaçamento (arco) entre boias — span>1 lado p/ contornar quina
const LEAD=46;          // da linha de largada até a 1ª boia
const CP_AHEAD=0;       // boias visíveis além da atual (0 = SÓ a próxima boia que o jogador tem que pegar)
const CP_RADIUS=12;     // raio pra contar a passagem na boia (lancha é rápida/larga)
const NPC_COUNT=3;      // adversários
const NPC_REACH=8;      // rivais precisam chegar PERTO da boia pra avançar
const RIVAL_PACES=[0.82,0.90,0.96]; // per-rival pace, all <1 so a CLEAN run wins; the catch-up surge keeps trailing rivals dangerous if you slack (a sloppy run can still drop to 2nd/3rd).
const SEP=6;            // distância mínima entre duas lanchas: separa quem encosta
const MINE_MAX=3;       // só ALGUMAS bombas aquáticas por prova
const MINE_HIT=3.4;     // raio de colisão da mina (lancha é larga): encostou, levou
const MINE_DODGE=12;    // desvio lateral que os rivais fazem pra contornar a mina
const HOP_V=7.5;        // impulso vertical do "pulo" ao bater numa mina
const HOP_G=22;         // gravidade que traz a lancha de volta à água depois do pulo
// Raio (Chebyshev) da pista, no meio do mar. FIXO em 253: antes era
// round((WATER+SWIM_BOUND)/2) com SWIM_BOUND=288; SWIM_BOUND cresceu pra alcançar a
// ilha a oeste, mas o anel da prova deve ficar EXATAMENTE onde estava.
const COAST_R=253;
const COAST_ZGAP=RURAL_HALF+22; // folga da península a leste: água só além disso
const LAT_AMP=20;       // amplitude do slalom: desloca a boia p/ dentro/fora da faixa de água
const CORNER_MARGIN=52; // perto de uma quina a boia fica no anel (sem slalom) p/ curva limpa
const SEA_Y=-.32;       // superfície do mar (igual sea.js / updateBoat)
const BOAT_FLOAT=.3;    // altura de flutuação da lancha acima do mar (igual updateBoat)
const ORANGE=0xff8a1e;
const boatColors=[0x1fc4c4,0xffd24a,0xff2e88]; // rivais (a do jogador é coral)

// ---- litoral navegável: traçado em "C" no mar contornando a península ----
// Âncoras do anel (X,Z) em sentido único, do toco SE, descendo pelo sul, oeste,
// norte, até o toco NE. O vão a leste (península) NÃO entra na lista, então
// nenhum trecho do percurso atravessa terra.
const coast: [number, number][]=[
  [ COAST_R,-COAST_ZGAP],
  [ COAST_R,-COAST_R   ],
  [-COAST_R,-COAST_R   ],
  [-COAST_R, COAST_R   ],
  [ COAST_R, COAST_R   ],
  [ COAST_R, COAST_ZGAP],
];
const coastSeg: number[]=[];let coastLen=0;
for(let i=0;i<coast.length-1;i++){
  const d=Math.hypot(coast[i+1][0]-coast[i][0],coast[i+1][1]-coast[i][1]);
  coastSeg.push(d);coastLen+=d;
}
// ponto do litoral a uma distância de arco s do início (s em [0,coastLen])
function coastAt(s: number): {x: number; z: number}{
  s=clamp(s,0,coastLen);
  let acc=0;
  for(let i=0;i<coastSeg.length;i++){
    const d=coastSeg[i];
    if(s<=acc+d||i===coastSeg.length-1){
      const t=d>1e-6?(s-acc)/d:0;
      const a=coast[i],b=coast[i+1];
      return{x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t};
    }
    acc+=d;
  }
  return{x:coast[0][0],z:coast[0][1]};
}

// posições (arco) das quinas do "C" (juntas entre os lados): perto delas o slalom
// é desligado pra a curva sair limpa e os trechos não rasparem a praia.
const coastCorners: number[]=[];
{let acc=0;for(let i=0;i<coastSeg.length-1;i++){acc+=coastSeg[i];coastCorners.push(acc);}}
const nearCorner=(s: number)=>coastCorners.some(c=>Math.abs(s-c)<CORNER_MARGIN);

// normal unitária do litoral em s, apontando pra FORA (longe da origem/cidade) —
// usada pra deslocar as boias pro lado (slalom) sem sair da faixa de água.
function coastNormal(s: number): {x: number; z: number}{
  const a=coastAt(s-3),b=coastAt(s+3);
  let tx=b.x-a.x,tz=b.z-a.z;const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
  let nx=tz,nz=-tx;                       // perpendicular à tangente
  const p=coastAt(s);
  if(nx*p.x+nz*p.z<0){nx=-nx;nz=-nz;}     // garante sentido pro mar aberto
  return{x:nx,z:nz};
}

// lancha ancorada (ver spawnBoat em player.js): a 1ª largada nasce colada nela.
// Mesmo ponto de água garantido (logo além da costa irregular) das constants.
const BOAT_SPAWN={x:BOAT_SPAWN_X,z:BOAT_SPAWN_Z};
// largada (enseada inicial ao sul, perto de onde a lancha nasce ancorada)
const start={x:0,z:0};
const gate=makeBoatRaceGate({color:ORANGE}); // make* NÃO adiciona à cena
scene.add(gate);

// marcador da largada: anel pulsante na superfície da água + facho (igual à
// corrida de rua; a lancha estaciona dentro dele, sob o pórtico)
const startMk=makeDeliveryMarker(ORANGE);
startMk.ring.rotation.x=Math.PI/2;(startMk.ring.material as THREE.Material).transparent=true;
scene.add(startMk.ring,startMk.beacon);

let phase='idle';   // idle | countdown | racing
let dir=1;          // sentido do percurso ao longo do litoral
let startS=0;       // posição (arco) da largada no litoral
let route: RoutePoint[]=[];       // [{x,z}] boias na ordem (a última é a chegada)
let cpMarkers: CpMarker[]=[];   // marcadores 3D de cada boia
let npcPath: BoatWaypoint[]=[];     // waypoints que os rivais seguem (boias + desvios das minas)
let mineSpecs: MineSpec[]=[];   // posições das bombas aquáticas do percurso (sorteadas por prova)
let mines: Mine[]=[];       // bombas 3D na cena durante a prova {g,x,z,bobT}
const blasts: Blast[]=[];    // explosões ativas das minas detonadas {g,t}
let playerCp=0;     // próxima boia do jogador
let raceT=0;        // cronômetro
let cdT=0;          // contagem regressiva
let lastCdShown=-1; // último número da contagem exibido/apitado
let freezePos: THREE.Vector3|null=null; // posição travada da lancha durante a contagem
let freezeHeading=0;// direção travada durante a contagem
const racers: Racer[]=[];    // adversários {g,cp,wpi,speed,finished,bobT}
let finishedNpcs=0; // quantos rivais já cruzaram a chegada
const prizeState: PrizeStreak={streak:0,last:-Infinity}; // anti-farm: prêmio decresce em vitórias seguidas
let paceRef=0;      // ritmo de referência suavizado do jogador (rubber banding sutil; ver smoothPace)

// alvos da corrida pro radar: largada quando ocioso, boia atual em prova
refs.boatRaceBlips=(): Blip[]=>{
  if(phase==='idle')return[{x:start.x,z:start.z,current:true}];
  const out: Blip[]=[];
  for(let i=playerCp;i<Math.min(route.length,playerCp+1+CP_AHEAD);i++)
    out.push({x:route[i].x,z:route[i].z,current:i===playerCp});
  return out;
};
refs.getBoatRaceState=()=>({
  phase,
  cp:playerCp,
  total:route.length,
  time:phase==='racing'?raceT:0,
  pos:phase==='racing'?playerPlace():0,
  racers:racers.length+1,
});
// Largada SÓ por interação (tecla E / botão): de lancha, parada embaixo do pórtico
refs.boatRaceNear=()=>{
  if(phase!=='idle'||state.mode!=='car'||!cur||!cur.boat)return false;
  const p=playerPos();
  return Math.hypot(p.x-start.x,p.z-start.z)<7&&Math.abs(cur.speed)<4;
};
refs.startBoatRaceInteract=()=>{
  if(!refs.boatRaceNear())return false;
  startRace();return true;
};

// monta start/route/npcPath a partir de uma posição (arco) e sentido no litoral.
// As boias seguem o anel mas com um SLALOM lateral (zigue-zague pra dentro/fora da
// faixa de água), então as retas viram curvas. A 1ª e a última ficam no anel
// (entrada/chegada limpas) e as quinas não recebem slalom (curva limpa, ver
// nearCorner). Os trechos entre boias continuam todos sobre a água.
function buildRoute(s0: number,d: number){
  dir=d;startS=s0;
  const p0=coastAt(startS);start.x=p0.x;start.z=p0.z;
  const flip=Math.random()<.5?1:-1; // pra que lado o 1º zigue-zague abre
  route=[];
  for(let k=0;k<CP_COUNT;k++){
    const s=startS+dir*(LEAD+k*CP_SPACING);
    const base=coastAt(s);
    let off=0;
    if(k>0&&k<CP_COUNT-1&&!nearCorner(s)) // miolo, longe das quinas: desloca
      off=flip*((k%2)?1:-1)*LAT_AMP*(.55+Math.random()*.45);
    if(off){const n=coastNormal(s);route.push({x:base.x+n.x*off,z:base.z+n.z*off});}
    else route.push({x:base.x,z:base.z});
  }
  buildMineSpecs();
  // waypoints dos rivais: as boias (cp:true) com um DESVIO lateral (cp:false)
  // inserido antes de cada boia cuja perna tem uma mina — assim os rivais também
  // contornam a bomba em vez de varar por cima dela (todo mundo desvia).
  npcPath=[];
  for(let k=0;k<route.length;k++){
    const m=mineSpecs.find(s=>s.leg===k);
    if(m)npcPath.push({x:m.dx,z:m.dz,cp:false}); // ponto de desvio ao lado da mina
    npcPath.push({x:route[k].x,z:route[k].z,cp:true});
  }
}

// Bombas aquáticas: poucas, no MEIO de pernas interiores e EM CIMA da linha reta
// que as lanchas fazem entre duas boias — todo mundo é obrigado a desviar. Guarda
// também o ponto de desvio lateral (pro mar aberto) que os rivais usam.
function buildMineSpecs(){
  mineSpecs=[];
  const legs: number[]=[];
  for(let k=2;k<CP_COUNT-1;k++)legs.push(k); // pernas interiores (route[k-1]→route[k])
  for(let i=legs.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[legs[i],legs[j]]=[legs[j],legs[i]];}
  for(const k of legs.slice(0,Math.min(MINE_MAX,legs.length))){
    const a=route[k-1],b=route[k];
    const t=.42+Math.random()*.16;                 // ~meio da perna
    const mx=a.x+(b.x-a.x)*t,mz=a.z+(b.z-a.z)*t;
    let tx=b.x-a.x,tz=b.z-a.z;const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
    let nx=tz,nz=-tx;if(nx*mx+nz*mz<0){nx=-nx;nz=-nz;} // perpendicular, pro mar aberto
    mineSpecs.push({leg:k,x:mx,z:mz,dx:mx+nx*MINE_DODGE,dz:mz+nz*MINE_DODGE});
  }
}

// arco do litoral mais próximo de um ponto do mundo (amostragem grossa)
function nearestArc(x: number,z: number){
  let bestS=0,bestD=Infinity;
  for(let s=0;s<=coastLen;s+=6){
    const p=coastAt(s),d=Math.hypot(p.x-x,p.z-z);
    if(d<bestD){bestD=d;bestS=s;}
  }
  return bestS;
}

// folga garantida pras 6 boias caberem sem estourar as pontas do "C" (logo
// nenhum segmento cruza a península)
function fitS(s0: number,d: number){
  const span=LEAD+(CP_COUNT-1)*CP_SPACING;
  return d>0?clamp(s0,24,coastLen-span-30):clamp(s0,span+30,coastLen-24);
}

// PRIMEIRA corrida: largada coladinha na lancha ancorada (BOAT_SPAWN), com o
// percurso correndo pro lado de mar aberto — assim o ícone de início nasce junto
// da lancha e é fácil de achar.
function prepareInitial(){
  const s0=nearestArc(BOAT_SPAWN.x,BOAT_SPAWN.z);
  const d=s0>coastLen/2?-1:1; // segue pro trecho mais longo do "C" (mais água)
  buildRoute(fitS(s0,d),d);
}

// Sorteia largada (posição+sentido) num trecho contínuo do litoral, longe do
// jogador, e monta as boias do percurso.
function pickCourse(){
  const pp=playerPos();
  let s0=0,d=1,tries=0;
  do{
    d=Math.random()<.5?1:-1;
    s0=fitS(rand(0,coastLen),d);
    tries++;
    const p0=coastAt(s0);
    if(Math.hypot(p0.x-pp.x,p0.z-pp.z)>=110)break;
  }while(tries<50);
  buildRoute(s0,d);
}

// Pré-monta a corrida atual e VIRA o pórtico de frente pra 1ª boia (a lancha
// nasce dentro do vão já apontada pra ela). `initial`: largada junto da lancha.
function prepareRace(initial?: boolean){
  if(initial)prepareInitial();else pickCourse();
  const h=route.length?Math.atan2(route[0].x-start.x,route[0].z-start.z):0;
  gate.position.set(start.x,SEA_Y,start.z);gate.rotation.y=h;
  startMk.ring.position.set(start.x,SEA_Y+.05,start.z);
  startMk.beacon.position.set(start.x,30,start.z);
}

function buildCpMarkers(){
  for(let i=0;i<route.length;i++){
    const p=route[i];
    if(i===route.length-1){
      // última boia: pórtico de chegada flutuante, virado pra quem chega
      const finish=makeBoatRaceGate({color:ORANGE,finish:true});
      const prev=route[i-1]||start;
      finish.position.set(p.x,SEA_Y,p.z);
      finish.rotation.y=Math.atan2(p.x-prev.x,p.z-prev.z);
      scene.add(finish);
      const m=makeDeliveryMarker(ORANGE); // só o facho de luz da chegada
      m.beacon.position.set(p.x,30,p.z);
      scene.add(m.beacon);
      cpMarkers.push({beacon:m.beacon,finish});
    }else{
      const m=makeBuoy(ORANGE);
      m.buoy.position.set(p.x,SEA_Y,p.z);
      m.beacon.position.set(p.x,30,p.z);
      scene.add(m.buoy,m.beacon);
      cpMarkers.push({buoy:m.buoy,beacon:m.beacon});
    }
  }
}

function clearCpMarkers(){
  for(const m of cpMarkers){
    if(m.buoy)scene.remove(m.buoy);
    if(m.beacon)scene.remove(m.beacon);
    if(m.finish)scene.remove(m.finish);
  }
  cpMarkers=[];
}

// instancia as bombas aquáticas do percurso atual (só existem durante a prova)
function buildMines(){
  for(const s of mineSpecs){
    const g=(makeSeaMine as ()=>THREE.Group)();
    g.position.set(s.x,SEA_Y,s.z);
    g.rotation.y=Math.random()*Math.PI*2;
    scene.add(g);
    mines.push({g,x:s.x,z:s.z,bobT:Math.random()*6});
  }
}
function clearMines(){
  for(const m of mines){scene.remove(m.g);disposeGeometries(m.g);}
  mines.length=0;
}

// "pulo" ao bater numa mina: integra um salto vertical com gravidade. Devolve o
// deslocamento atual em y (0 quando a lancha já voltou à água). Compartilhado
// pelo jogador e pelos rivais (cada um carrega seu próprio mineHopV/mineHopY).
function hopOffset(o: HopHolder,dt: number){
  if(!o.mineHopV&&!o.mineHopY)return 0;
  o.mineHopY=(o.mineHopY||0)+o.mineHopV!*dt;
  o.mineHopV!-=HOP_G*dt;
  if(o.mineHopY<=0){o.mineHopY=0;o.mineHopV=0;}
  return o.mineHopY;
}

// detona a mina: explode (modelo de explosão reaproveitado), SOME da cena e do
// percurso e levanta uma coluna de água. Quem bateu já recebeu o pulo/freada em
// updateMines/updateRacers. Uma mina só explode uma vez (é removida na hora).
function detonateMine(m: Mine){
  spawnMineBlast(m.x,m.z);
  scene.remove(m.g);disposeGeometries(m.g);
  const i=mines.indexOf(m);if(i>=0)mines.splice(i,1);
}
function spawnMineBlast(x: number,z: number){
  const g=makeExplosionModel();
  g.position.set(x,SEA_Y+1,z);
  scene.add(g);
  blasts.push({g,t:0});
  for(let i=0;i<8;i++) // borrifo/espuma do estouro
    spawnRivalPuff(x+(Math.random()-.5)*2.5,z+(Math.random()-.5)*2.5,1.4,4,.9);
  blip([150,90,55],.2,'sawtooth',.3); // estouro grave
}
function updateBlasts(dt: number){
  for(let i=blasts.length-1;i>=0;i--){
    const b=blasts[i];b.t+=dt;const s=1+b.t*4;
    b.g.scale.set(s,s,s);
    b.g.traverse((o: any)=>{if(o.material)o.material.opacity=Math.max(0,o.material.opacity-dt*1.6);});
    if(b.t>.75){scene.remove(b.g);disposeGeometries(b.g);blasts.splice(i,1);}
  }
}

// senta um "capitão" no banco do console da lancha rival (offset/pose casados com
// completeEnter/boat.js pra não ficar com a lancha vazia)
function seatCaptain(boatG: THREE.Object3D,shirt: number){
  const d=makePed(shirt);
  d.traverse((o: any)=>{if(o.isMesh)o.castShadow=false;});
  const l=d.userData.limbs;
  if(l){
    l.leftLeg.rotation.set(-1.3,0,.12);l.rightLeg.rotation.set(-1.3,0,-.12);
    l.leftCalf?.rotation.set(1.4,0,0);l.rightCalf?.rotation.set(1.4,0,0);
    l.leftArm.rotation.set(-1.15,0,.30);l.rightArm.rotation.set(-1.15,0,-.30);
    l.leftForearm?.rotation.set(-.55,0,0);l.rightForearm?.rotation.set(-.55,0,0);
  }
  d.position.set(0,-.05,-.15);
  boatG.add(d);
  return d;
}

function spawnRacers(h0: number){
  const rx=Math.cos(h0),rz=-Math.sin(h0);   // vetor "direita" da linha
  const bx=-Math.sin(h0),bz=-Math.cos(h0);  // vetor "atrás" da linha
  for(let i=0;i<NPC_COUNT;i++){
    const g=(makeBoat as (color: number)=>THREE.Group)(boatColors[i%boatColors.length]); // makeBoat já adiciona à cena
    seatCaptain(g,pick(shirtColors));
    const lane=(i-1)*4.5;
    g.position.set(start.x+rx*lane+bx*(6+i*3),SEA_Y+BOAT_FLOAT,start.z+rz*lane+bz*(6+i*3));
    g.rotation.y=h0;
    // mais lentos pra dar chance ao jogador; largam escalonados
    racers.push({g,cp:0,wpi:0,speed:16+i*1.8,pace:RIVAL_PACES[i%RIVAL_PACES.length],finished:false,bobT:Math.random()*6});
  }
}

function clearRacers(){
  for(const r of racers)scene.remove(r.g);
  racers.length=0;
  finishedNpcs=0;
}

function playerPlace(){
  // métrica de progresso: boias passadas menos distância à próxima
  const pp=playerPos();
  const next=route[playerCp];
  const pd=next?Math.hypot(pp.x-next.x,pp.z-next.z):0;
  const pscore=playerCp*1e4-pd;
  let place=1;
  for(const r of racers){
    const rn=route[r.cp];
    const rd=rn?Math.hypot(r.g.position.x-rn.x,r.g.position.z-rn.z):0;
    const rscore=(r.finished?route.length:r.cp)*1e4-rd;
    if(rscore>pscore)place++;
  }
  return place;
}

function startRace(){
  if(!game.begin())return; // outra sessão de mini game rolando: não larga
  if(!route.length)prepareRace();
  buildCpMarkers();
  buildMines(); // bombas aquáticas no meio do percurso
  cur!.mineHopV=cur!.mineHopY=0; // zera estado de "pulo" de mina
  playerCp=0;raceT=0;cdT=3;lastCdShown=-1;paceRef=0;
  startMk.ring.visible=startMk.beacon.visible=false; // some a largada durante a prova
  gate.visible=false;                                // tira o pórtico depois de largar
  // teleporta a lancha do jogador pra linha, virada pra 1ª boia
  const h0=Math.atan2(route[0].x-start.x,route[0].z-start.z);
  cur!.g.position.set(start.x,SEA_Y+BOAT_FLOAT,start.z);
  cur!.heading=h0;cur!.g.rotation.set(0,h0,0);cur!.speed=0;cur!.bobT=cur!.bobT||0;
  cameraRig.yaw=h0;
  freezePos=cur!.g.position.clone();freezeHeading=h0;
  spawnRacers(h0);
  phase='countdown';
  state.controlsLocked=true; // sem pilotar/sair/atirar durante a contagem
  refs.setGangsHidden?.(true);
  radioOff();
  raceSiren();
  updateRaceHud();
}

function finishRace(){
  clearRacers();clearCpMarkers();clearMines();
  prepareRace(); // próxima corrida nasce noutro trecho do litoral (ciclo infinito)
  startMk.ring.visible=startMk.beacon.visible=true;
  gate.visible=true;
  phase='idle';freezePos=null;
  state.controlsLocked=false;
  game.end(); // libera a trava do mundo
  refs.setGangsHidden?.(false);
  raceMusicOff();
  hideRaceHud();
}

function abortRace(text='RACE ABANDONED',col='var(--pink)'){
  finishRace();
  // morte/prisão no meio da prova: o cut de WASTED/BUSTED já assumiu o banner;
  // não apaga nem sobrescreve com "RACE ABANDONED".
  if(state.mode==='cut')return;
  hideBig();
  message(text,col);
}

function loseRace(){
  reportMiniGameResult(game.id,{won:false,score:0}); // ranking: corrida perdida
  finishRace();
  bigText('YOU LOST','var(--pink)');
  setTimeout(hideBig,2200);
  message('THE RIVALS FINISHED FIRST - NO PRIZE','var(--pink)');
  blip([330,247,196],.12,'sawtooth',.18);
}

function completeRace(){
  const place=1+finishedNpcs;
  const total=racers.length+1;
  const prize=[700,350,150,0][place-1]??0;
  // bônus de tempo: corrida rápida paga mais
  const bonus=place===1?Math.max(0,Math.round(220-raceT*1.4)):0;
  // anti-farm: refazer a prova em loop paga cada vez menos (recupera com o tempo)
  const paid=diminishPrize(prizeState,prize+bonus,state.time);
  economy.earn(paid,'boat-race');
  // ranking: vitória = 1º lugar; score = prêmio ganho (justo entre as posições)
  reportMiniGameResult(game.id,{won:place===1,score:paid});
  const ord=['1ST','2ND','3RD','4TH','5TH'][place-1]||place+'TH';
  finishRace();
  bigText(place===1?'YOU WIN!':`${ord} PLACE`,place===1?'var(--gold)':'var(--cyan)');
  setTimeout(hideBig,2200);
  message(paid>0?`${ord} OF ${total} - +$${paid}${bonus>0?' SPEED BONUS!':''}`
    :`${ord} OF ${total} - NO PRIZE`,paid>0?'var(--gold)':'var(--pink)');
  blip(place===1?[523,659,784,1047]:[440,330],.09,'sine',.18);
}

const raceHud=document.getElementById('racehud');
function hideRaceHud(){raceHud?.classList.remove('show');}

function updateRaceHud(){
  if(!raceHud)return;
  if(phase==='idle'){hideRaceHud();return;}
  raceHud.classList.add('show');
  if(phase==='countdown'){
    raceHud.innerHTML=`
      <div class="race-label">BOAT RACE</div>
      <div class="race-main"><span>GET READY</span><b>${Math.max(1,Math.ceil(cdT))}</b></div>`;
    return;
  }
  const t=raceT,mm=Math.floor(t/60),ss=Math.floor(t%60);
  const clock=`${mm}:${String(ss).padStart(2,'0')}`;
  raceHud.innerHTML=`
    <div class="race-label">BOAT RACE</div>
    <div class="race-main"><span>POS</span><b>${playerPlace()}/${racers.length+1}</b></div>
    <div class="race-row"><span>BUOY</span><b>${Math.min(playerCp+1,route.length)}/${route.length}</b></div>
    <div class="race-row"><span>TIME</span><b>${clock}</b></div>`;
}

// marcadores: mostra SÓ a boia atual (a próxima que o jogador tem que pegar);
// ela balança na água. A chegada tem bandeira tremulando.
function updateCpMarkers(dt: number){
  for(let i=0;i<cpMarkers.length;i++){
    const m=cpMarkers[i];
    const show=i>=playerCp&&i<=playerCp+CP_AHEAD;
    const current=i===playerCp;
    if(m.beacon){m.beacon.visible=show;if(show)(m.beacon.material as THREE.Material).opacity=current?.18:.08;}
    if(m.finish){
      m.finish.visible=show;
      if(show){
        m.finish.position.y=SEA_Y+Math.sin(state.time*1.6+i)*.08; // balança na água
        if(m.finish.userData.flag)m.finish.userData.flag.rotation.y=Math.sin(state.time*6)*.5;
      }
      continue;
    }
    if(m.buoy){
      m.buoy.visible=show;
      if(show){
        m.buoy.position.y=SEA_Y+Math.sin(state.time*1.8+i*1.3)*.12;
        m.buoy.rotation.y+=.6*dt;
      }
    }
  }
}

// esteira das rivais: rastro de espuma na popa (pool reciclado compartilhado pelas
// 3 lanchas, igual ao do jogador mas só o rastro traseiro pra não pesar).
const rwake: RivalWake[]=[],rwakePool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]=[];
function spawnRivalPuff(x: number,z: number,s0: number,s1: number,life: number){
  const g=rwakePool.pop()||makeWakePuff();
  if(!g.parent)scene.add(g);
  g.position.set(x,SEA_Y+.02,z);
  g.rotation.y=Math.random()*Math.PI;
  g.scale.setScalar(s0);
  g.material.opacity=0;g.visible=true;
  rwake.push({g,t:0,life,s0,s1});
}
function updateRivalWake(dt: number){
  for(let i=rwake.length-1;i>=0;i--){
    const w=rwake[i];w.t+=dt;const k=w.t/w.life;
    w.g.scale.setScalar(w.s0+(w.s1-w.s0)*k);
    w.g.material.opacity=Math.min(1,k*7)*(1-k)*.7;
    if(k>=1){w.g.visible=false;rwakePool.push(w.g);rwake.splice(i,1);}
  }
}

// progresso ao longo do percurso em "unidades de boia": boias já passadas +
// fração da perna atual (0..1). Compara jogador e rival de forma contínua pra
// alimentar o rubber banding.
function legProgress(cp: number,x: number,z: number){
  const to=route[cp];
  if(!to)return route.length;            // já cruzou a chegada
  const from=cp>0?route[cp-1]:start;
  const legLen=Math.hypot(to.x-from.x,to.z-from.z)||1;
  const distToNext=Math.hypot(to.x-x,to.z-z);
  return cp+THREE.MathUtils.clamp(1-distToNext/legLen,0,1);
}

function updateRacers(dt: number){
  const pp=playerPos();
  const playerProg=legProgress(playerCp,pp.x,pp.z);
  paceRef=smoothPace(paceRef,Math.abs(cur?.speed||0),dt); // sobe rápido, cai devagar
  for(const r of racers){
    if(r.finished)continue;
    const wp=npcPath[r.wpi];
    if(!wp){r.finished=true;finishedNpcs++;continue;}
    // mira na boia (mar aberto: vai direto). A direção visual gira mais devagar.
    const dx=wp.x-r.g.position.x,dz=wp.z-r.g.position.z;
    const d=Math.hypot(dx,dz);
    const h=Math.atan2(dx,dz);
    const c0=r.g.rotation.y;
    let diff=THREE.MathUtils.euclideanModulo(h-c0+Math.PI,Math.PI*2)-Math.PI;
    r.g.rotation.y=c0+diff*Math.min(1,4*dt);
    // rubber banding (helper): velocidade ancorada no ritmo de REFERÊNCIA suavizado
    // do jogador (paceRef) — rival ATRÁS surta pra colar, rival à frente alivia pra
    // ser pego. Frear NÃO faz o rival frear junto (paceRef cai devagar): quem para
    // de verdade é ultrapassado depois de ~1-2s, não no mesmo frame.
    const gap=playerProg-legProgress(r.cp,r.g.position.x,r.g.position.z);
    const spd=rubberSpeed(r.speed,gap,paceRef,r.pace);
    let step=Math.min(d,spd*dt);
    if(r.mineStun>0){step*=.2;r.mineStun-=dt;} // batido numa mina: quase parado
    r.g.position.x+=Math.sin(h)*step;
    r.g.position.z+=Math.cos(h)*step;
    // bateu numa mina (raro: eles desviam pelos waypoints) → pulo + perda de ritmo;
    // a mina explode e some na hora
    for(const m of mines){
      if(Math.hypot(r.g.position.x-m.x,r.g.position.z-m.z)<MINE_HIT){
        r.mineHopV=HOP_V;r.mineStun=.9;detonateMine(m);break;
      }
    }
    // flutuação + proa levantada planando + inclinação pra dentro da curva + pulo de mina
    r.bobT=(r.bobT||0)+dt;
    r.g.position.y=SEA_Y+BOAT_FLOAT+Math.sin(r.bobT*2.2)*.05+hopOffset(r,dt);
    r.g.rotation.x=THREE.MathUtils.lerp(r.g.rotation.x,-.1,Math.min(1,3*dt));
    r.g.rotation.z=THREE.MathUtils.lerp(r.g.rotation.z,-diff*.4,Math.min(1,4*dt));
    // rastro de espuma jogado atrás da popa
    r.wakeT=(r.wakeT||0)+dt;
    const interval=Math.max(.05,.16-spd*.003);
    const fx=Math.sin(r.g.rotation.y),fz=Math.cos(r.g.rotation.y);
    while(r.wakeT>=interval){
      r.wakeT-=interval;
      spawnRivalPuff(r.g.position.x-fx*2+(Math.random()-.5)*.6,
        r.g.position.z-fz*2+(Math.random()-.5)*.6,.7,2.6,.85);
    }
    // só avança quando REALMENTE chegou na boia (sem cortar caminho)
    if(d<NPC_REACH){
      if(wp.cp){
        r.cp++;
        if(r.cp>=route.length){r.finished=true;finishedNpcs++;continue;}
      }
      r.wpi++;
    }
  }
  separateRacers(racers,SEP,cur); // ninguém anda por dentro de ninguém (inclui a lancha do jogador)
}

// bombas aquáticas: balançam/giram na água e colidem com a lancha do JOGADOR —
// encostou, ela pula pra cima e perde quase toda a velocidade (os rivais levam o
// mesmo tranco em updateRacers). Cooldown por lancha evita retrigger ao sobrepor.
function updateMines(dt: number){
  for(const m of mines){
    m.bobT+=dt;
    m.g.position.y=SEA_Y+Math.sin(m.bobT*1.6)*.1; // bóia balançando
    m.g.rotation.y+=.4*dt;
  }
  if(!cur)return;
  const p=cur.g.position;
  for(const m of mines){
    if(Math.hypot(p.x-m.x,p.z-m.z)<MINE_HIT){
      cur.mineHopV=HOP_V;   // a lancha pula pra cima
      cur.speed*=.22;       // e perde quase toda a velocidade
      detonateMine(m);      // a mina explode e some
      break;
    }
  }
  const off=hopOffset(cur,dt);
  if(off){p.y+=off;cur.g.rotation.x-=off*.12;} // sobe e empina a proa enquanto no ar
}

export function updateBoatRace(dt: number){
  if(rwake.length)updateRivalWake(dt); // espuma das rivais some mesmo após a prova
  if(blasts.length)updateBlasts(dt);   // explosões das minas terminam mesmo após a prova
  // anel da largada pulsando quando ocioso
  if(phase==='idle'){
    if(startMk.ring.visible){
      startMk.ring.rotation.z+=2*dt;
      const sc=1+Math.sin(state.time*4)*.12;startMk.ring.scale.set(sc,sc,1);
    }
    return; // largada é por interação (ver refs.startBoatRaceInteract)
  }

  // saiu da lancha / WASTED / BUSTED no meio da prova: abandona
  if(state.mode!=='car'||!cur||!cur.boat){abortRace();return;}

  if(phase==='countdown'){
    if(freezePos){cur.g.position.copy(freezePos);cur.speed=0;} // congela na linha
    cur.heading=freezeHeading;cur.g.rotation.set(0,freezeHeading,0);
    cameraRig.yaw=freezeHeading;
    cdT-=dt;
    const n=Math.ceil(cdT);
    if(n>0){
      bigText(String(n),'#ff8a1e');
      if(n!==lastCdShown){lastCdShown=n;blip([523],.12,'square',.18);}
    }else{
      phase='racing';freezePos=null;state.controlsLocked=false;
      bigText('GO!','var(--gold)');setTimeout(hideBig,700);
      blip([784,1047],.14,'square',.22);
      raceMusicOn();
    }
    updateCpMarkers(dt);
    updateRaceHud();
    return;
  }

  // racing
  raceT+=dt;
  updateRacers(dt);
  updateCpMarkers(dt);
  updateMines(dt); // bombas aquáticas balançam + colisão da lancha do jogador
  // todos os rivais cruzaram a chegada antes de você: derrota
  if(finishedNpcs>=NPC_COUNT){loseRace();return;}
  const pp=cur.g.position;
  const tgt=route[playerCp];
  if(tgt&&Math.hypot(pp.x-tgt.x,pp.z-tgt.z)<CP_RADIUS){
    playerCp++;
    if(playerCp>=route.length){completeRace();return;}
    blip([660,880],.07,'sine',.15);
  }
  updateRaceHud();
}

prepareRace(true); // 1º percurso com a largada colada na lancha ancorada
