import * as THREE from 'three';
import {N,CELL,nodeX,pick,rand,irand,wrapA,clamp} from '@/core/constants.ts';
import {state,carNames,carColors} from '@/core/state.ts';
import {makeCar,makeKombi,makeFiatUno,spinWheels,dentCar,seatDriver,shirtColors} from '@/core/entities.ts';
import {collideStatics,addWanted} from '@/core/physics.ts';
import {thud} from '@/audio/audio.ts';
import {playerPos,cur,player,getWasted} from '@/actors/player.ts';

// A grid node coordinate pair [i,j].
type Node=[number,number];
// A road-lane sample (position + travel direction in the XZ plane).
interface LanePoint{x:number;z:number;dx:number;dz:number;}
// A city-traffic car wrapper.
interface TrafficCar{
  g:THREE.Object3D;
  A:Node;B:Node;C:Node|null;P:Node|null;
  t:number;
  speed:number;
  brakeT:number;
  name:string;
  heading:number;
  driver?:THREE.Object3D;
  stuckT?:number;
  hitT?:number;
}

export const traffic:TrafficCar[]=[];
const CAR_CULL2=170*170; // LOD: carro de trânsito além disso não é desenhado
// Vector3 de rascunho reaproveitados na colisão carro-vs-carro do jogador.
const _push=new THREE.Vector3();
const _mid=new THREE.Vector3();

export function neighborNodes(i:number,j:number):Node[]{
  const r:Node[]=[];
  if(i>0)r.push([i-1,j]);if(i<N)r.push([i+1,j]);
  if(j>0)r.push([i,j-1]);if(j<N)r.push([i,j+1]);
  return r;
}

// Próximo nó do percurso: qualquer vizinho menos o de onde veio (beco = retorno)
function pickNext(from:Node,prev:Node):Node{
  const opts=neighborNodes(from[0],from[1]).filter(n=>!(n[0]===prev[0]&&n[1]===prev[1]));
  return opts.length?pick(opts):prev;
}

// Body variety: mostly the regular sedan, plus the two Brazilian classics — a white
// VW Kombi van and a boxy Fiat Uno (random colour). All three ride the SAME car rig,
// so they drive, brake, dent, get stolen and seat a driver exactly the same way.
function pickTrafficBody():{g:THREE.Object3D;name:string}{
  const r=Math.random();
  if(r<.12)return{g:makeKombi(),name:'BREAD LOAF VAN'};
  if(r<.26){const ci=irand(0,carColors.length-1);return{g:makeFiatUno(carColors[ci]),name:'SQUARE FIRE'};}
  const ci=irand(0,carColors.length-1);
  return{g:makeCar(carColors[ci],false),name:carNames[ci]};
}

export function spawnTraffic(){
  const A:Node=[irand(0,N),irand(0,N)],B=pick(neighborNodes(A[0],A[1]));
  const body=pickTrafficBody();
  const t:TrafficCar={g:body.g,A,B,C:pickNext(B,A),P:null,t:Math.random(),
    speed:8.5,brakeT:0,name:body.name,heading:0};
  t.driver=seatDriver(t.g,pick(shirtColors));
  traffic.push(t);
}

const TURN=7; // metros antes/depois do nó em que a esquina vira curva
const TURN_S=TURN/CELL;

// Objetos de rascunho reaproveitados pra evitar alocações por frame.
// _lp: saída padrão de lanePoint (faixa direta); _e/_x: as DUAS chamadas
// internas de cornerPos (precisam ser distintas, ver aliasing); _cp: saída
// de cornerPos. Reuso é seguro porque nenhum chamador mantém dois resultados
// vivos ao mesmo tempo (ver updateTraffic e player.js completeEnter).
const _lp:LanePoint={x:0,z:0,dx:0,dz:0};
const _e:LanePoint={x:0,z:0,dx:0,dz:0};
const _x:LanePoint={x:0,z:0,dx:0,dz:0};
const _cp:LanePoint={x:0,z:0,dx:0,dz:0};

function lanePoint(A:Node,B:Node,t:number,out:LanePoint=_lp):LanePoint{
  const ax=nodeX(A[0]),az=nodeX(A[1]),bx=nodeX(B[0]),bz=nodeX(B[1]);
  const dx=(bx-ax)/CELL,dz=(bz-az)/CELL;
  out.x=ax+(bx-ax)*t-dz*3.5;out.z=az+(bz-az)*t+dx*3.5;out.dx=dx;out.dz=dz;
  return out;
}

// Curva suave na esquina: Bezier quadrática do fim da faixa atual (E) ao
// começo da próxima (X), com controle no cruzamento das duas faixas
function cornerPos(A:Node,B:Node,C:Node,u:number):LanePoint{
  const E=lanePoint(A,B,1-TURN_S,_e),X=lanePoint(B,C,TURN_S,_x);
  let mx,mz;
  if(Math.abs(E.dx)>.5&&Math.abs(X.dz)>.5){mx=X.x;mz=E.z;}
  else if(Math.abs(E.dz)>.5&&Math.abs(X.dx)>.5){mx=E.x;mz=X.z;}
  else{mx=(E.x+X.x)/2;mz=(E.z+X.z)/2;} // reto ou retorno: sem cruzamento único
  const v=1-u;
  const x=v*v*E.x+2*v*u*mx+u*u*X.x;
  const z=v*v*E.z+2*v*u*mz+u*u*X.z;
  let tx=v*(mx-E.x)+u*(X.x-mx),tz=v*(mz-E.z)+u*(X.z-mz);
  const len=Math.hypot(tx,tz)||1;
  _cp.x=x;_cp.z=z;_cp.dx=tx/len;_cp.dz=tz/len;
  return _cp;
}

export function trafficPos(t:TrafficCar):LanePoint{
  if(t.C&&t.t>1-TURN_S)return cornerPos(t.A,t.B,t.C,(t.t-(1-TURN_S))/(2*TURN_S));
  if(t.P&&t.t<TURN_S)return cornerPos(t.P,t.A,t.B,.5+t.t/(2*TURN_S));
  return lanePoint(t.A,t.B,t.t);
}

for(let k=0;k<14;k++)spawnTraffic();

export function updateTraffic(dt:number){
  const pp=playerPos();
  for(const t of traffic){
    const pos=trafficPos(t);
    if(t.hitT&&t.hitT>0)t.hitT-=dt; // cooldown between car-vs-pedestrian hits
    // Freia pelo jogador/carro do jogador logo à frente (ponto 5m adiante).
    const ax=pos.x+pos.dx*5,az=pos.z+pos.dz*5;
    let blocked=Math.hypot(ax-pp.x,az-pp.z)<3.8;
    // Freia por outro carro SÓ quando ele está à frente e na MINHA faixa (cone
    // estreito via produto escalar/lateral, sem sqrt). A checagem omnidirecional
    // antiga (raio em volta de um ponto à frente) travava cruzamentos 4-way em
    // deadlock permanente — cada carro via o transversal e ninguém andava.
    if(!blocked)for(const o of traffic){
      if(o===t)continue;
      const rx=o.g.position.x-pos.x,rz=o.g.position.z-pos.z;
      const fwd=rx*pos.dx+rz*pos.dz;            // distância à frente (direção de marcha)
      if(fwd<=.5||fwd>6.5)continue;             // atrás/sobreposto ou longe: ignora
      if(Math.abs(rx*pos.dz-rz*pos.dx)<2){blocked=true;break;} // afastamento lateral
    }
    if(t.brakeT>0){t.brakeT-=dt;blocked=true;}
    // Anti-travamento: parado tempo demais (deadlock de cruzamento) → ignora o
    // bloqueio por ~0.5s pra desfazer o nó e seguir. Em fila normal o stuckT
    // zera sozinho (o da frente anda e o cone libera), então só age em impasses.
    if(blocked){
      t.stuckT=(t.stuckT||0)+dt;
      if(t.stuckT>2.5)t.stuckT=0;               // fim da janela: reavalia do zero
      else if(t.stuckT>2)blocked=false;         // janela de ~0.5s atravessando
    }else t.stuckT=0;
    // reduz a marcha na esquina pra curva sair suave
    const inCorner=(t.C&&t.t>1-TURN_S)||(t.P&&t.t<TURN_S);
    const target=blocked?0:inCorner?5.5:8.5;
    t.speed+=(target-t.speed)*4*dt;
    t.t+=t.speed*dt/CELL;
    if(t.t>=1){
      t.P=t.A;t.A=t.B;
      t.B=t.C||pickNext(t.A,t.P);
      t.C=pickNext(t.B,t.A);
      t.t-=1;
    }
    const np=trafficPos(t);
    t.g.position.set(np.x,0,np.z);
    const want=Math.atan2(np.dx,np.dz);
    const dh=wrapA(want-t.heading);
    t.heading+=dh*Math.min(1,10*dt);
    t.g.rotation.y=t.heading;
    // LOD: carro longe não é desenhado nem anima rodas/motorista; a posição
    // segue atualizando (acima) pra o trânsito fluir quando reaparece.
    const cdx=np.x-pp.x,cdz=np.z-pp.z;
    if(cdx*cdx+cdz*cdz>=CAR_CULL2){t.g.visible=false;continue;}
    t.g.visible=true;
    spinWheels(t.g,t.speed,dt,clamp(dh*2,-1,1)); // steer anima volante e braços
    const activeCur=cur;
    if(state.mode==='car'&&activeCur){
      const d=t.g.position.distanceTo(activeCur.g.position);
      if(d<2.9){
        const push=_push.subVectors(t.g.position,activeCur.g.position).setY(0).normalize();
        activeCur.g.position.addScaledVector(push,-(2.9-d)*.6);
        if(Math.abs(activeCur.speed)>8){
          addWanted(.25,null as unknown as string,'pursuit');thud(Math.abs(activeCur.speed));state.shake=.3;
          // amassa os dois carros no ponto de contato
          const mid=_mid.addVectors(t.g.position,activeCur.g.position)
            .multiplyScalar(.5).setY(.7);
          dentCar(activeCur.g,mid,push.clone().negate(),.2);
          dentCar(t.g,mid,push,.2);
        }
        activeCur.speed*=.6;t.brakeT=2;
      }
    }else if(state.mode==='foot'&&t.speed>4&&!(t.hitT&&t.hitT>0)){
      // Hit a pedestrian: speed-scaled damage (not an instant kill), a brief cooldown so
      // one bump doesn't drain health every frame, only WASTED once health hits 0.
      if(t.g.position.distanceTo(player.g.position)<1.5){
        t.hitT=.8;
        state.health-=irand(10,18)+Math.round(Math.abs(t.speed)*1.5);
        state.shake=Math.max(state.shake,.35);thud(Math.abs(t.speed));
        if(state.health<=0){state.health=100;getWasted();}
      }
    }
  }
}
