import * as THREE from 'three';
import {state,refs} from './state.js';
import {economy} from './economy.js';
import {scene} from './engine.js';
import {playerPos,cur,idleCars} from './player.js';
import {message,bigText,hideBig} from './hud.js';
import {blip,thud} from './audio.js';
import {N,nodeX,clamp,groundHeight} from './constants.js';
import {makeCarCrusher} from '../assets/models/props/car-crusher.js';
import {MiniGame,MiniGameId} from './minigame.js';

// atividade livre (não trava o mundo): registra a identidade no enum/registro de
// mini games. A ação CRUSH já fica indisponível durante uma sessão (ver a trava
// nas zoneActions do input/hud).
new MiniGame({id:MiniGameId.CAR_CRUSHER,name:'Scrap Crusher',exclusive:false});

// SCRAP CRUSHER — minigame estilo "sucata/esmagador de carros" do open-world. Uma prensa
// industrial fica fixa numa interseção da cidade. O jogador entra de carro na
// zona de esmagamento (PAD) e PARA; aparece a ação CRUSH (botão E, via
// refs.zoneActions). Ao acionar: o jogador é jogado pra fora, a placa pesada
// desce sobre o carro, ele é achatado, vira sucata e some — pagando dinheiro.
// Rústico e funcional: esmaga o carro comum do jogador (recusa veículos únicos).

// posição da prensa: ferro-velho na ORLA SUL (areia, fora da rua). Antes ficava
// no centro do cruzamento (-88,-88) — em cima da viatura do vigilante e "no meio
// da rua". Agora é um pátio industrial à parte, com folga dos outros mini games.
export const PAD={x:-120,z:198};
const PAD_RANGE=4;        // raio da zona de esmagamento (m)
const STOP_SPEED=3;       // velocidade máxima pra a ação aparecer (carro "parado")

// monta a prensa e adiciona à cena já no carregamento do módulo
const crusher=makeCarCrusher();
const PAD_Y=groundHeight(PAD.x,PAD.z);
crusher.position.set(PAD.x,PAD_Y,PAD.z);
// vira a "boca" da cama (lado -x, sem batente) pra rua de baixo, só por estética
crusher.rotation.y=0;
scene.add(crusher);
const press=crusher.userData.press;            // placa que desce
const PRESS_UP=press.userData.upY;             // altura de repouso da placa
const PRESS_DOWN=1.05;                          // altura ao final do esmagamento

// ----- estado do esmagamento -----
let crushing=false;       // true durante toda a animação (down|up|hold)
let phase='idle';         // idle | down | hold | up
let t=0;                  // cronômetro da fase atual
let car=null;             // carro sendo esmagado (capturado em startCrush)
let scrap=null;           // refer. ao .g do carro achatado durante o "hold"
let reward=0;             // sucata a pagar quando a placa toca o carro
let paid=false;           // já pagou nesta prensagem?
const DOWN_TIME=1.0;      // tempo de descida da placa (~1s)
const HOLD_TIME=.55;      // tempo que o carro achatado fica visível antes de sumir
const UP_TIME=.8;         // tempo de subida da placa

// scratch (sem alocação por frame)
const _car0={y:0,scaleY:1};

// flags de veículo ÚNICO/ESPECIAL que NÃO podem ser destruídos (sumiriam do
// mundo pra sempre: táxi, viatura/vigilante, ambulância, caminhão de bombeiros,
// lancha, moto, avião, carrinho de RC). Espelha os flags setados em cada módulo
// (taxi.js, vigilante.js, paramedic.js, firefighter.js, player.js, rc-toyz.js).
function isSpecialVehicle(c){
  if(!c)return false;
  return !!(c.taxi||c.police||c.vigilante||c.ambulance||c.firetruck
    ||c.boat||c.bike||c.plane)||c.name==='RC RAGER';
}

// ----- partículas de impacto (estilhaços/poeira) num pool reaproveitado -----
// rústico e barato: caixinhas cinza voando + baforada de poeira, sem alocar por
// frame depois do warm-up. Uma luz curta de "faísca" no impacto é só a lâmpada
// do topo piscando (sem custo extra de geometria).
const debris=[];        // ativos: {m,dust,vx,vy,vz,t,life,spin,grow}
const shardPool=[];     // cacos (caixinhas) reaproveitáveis (já na cena)
const dustPool=[];      // baforadas (planos) reaproveitáveis (já na cena)
const _shardGeo=new THREE.BoxGeometry(.3,.2,.3);
const _shardMat=new THREE.MeshLambertMaterial({color:0x8a9099});
const _dustGeo=new THREE.PlaneGeometry(1,1);

function takeShard(){
  const m=shardPool.pop()||new THREE.Mesh(_shardGeo,_shardMat);
  if(!m.parent)scene.add(m);
  m.visible=true;
  return m;
}
function takeDust(){
  // cada baforada tem material próprio (opacidade animada por instância)
  const m=dustPool.pop()||new THREE.Mesh(_dustGeo,
    new THREE.MeshBasicMaterial({color:0xb9bdc4,transparent:true,
      opacity:.7,depthWrite:false,side:THREE.DoubleSide}));
  if(!m.parent)scene.add(m);
  m.visible=true;
  return m;
}

// estoura cacos + poeira no ponto de impacto (centro do carro achatado)
function spawnImpactFX(x,y,z){
  for(let i=0;i<14;i++){
    const m=takeShard();
    m.position.set(x+(Math.random()-.5)*2,y+.2,z+(Math.random()-.5)*1.4);
    m.rotation.set(Math.random()*6,Math.random()*6,Math.random()*6);
    m.scale.setScalar(.5+Math.random()*.8);
    const ang=Math.random()*Math.PI*2,sp=2+Math.random()*4;
    debris.push({m,dust:false,
      vx:Math.cos(ang)*sp,vy:3+Math.random()*4,vz:Math.sin(ang)*sp,
      t:0,life:.5+Math.random()*.5,spin:(Math.random()-.5)*14});
  }
  for(let i=0;i<5;i++){
    const m=takeDust();
    m.rotation.set(-Math.PI/2,0,0); // baforada deitada no chão
    m.position.set(x+(Math.random()-.5)*3,y+.1,z+(Math.random()-.5)*2);
    const s0=1.2+Math.random()*1.2;
    m.scale.setScalar(s0);
    m.material.opacity=.7;
    const ang=Math.random()*Math.PI*2,sp=1+Math.random()*2;
    debris.push({m,dust:true,grow:s0+1.8,
      vx:Math.cos(ang)*sp,vy:.4,vz:Math.sin(ang)*sp,
      t:0,life:.7+Math.random()*.4,spin:0});
  }
}

function updateDebris(dt){
  for(let i=debris.length-1;i>=0;i--){
    const d=debris[i];d.t+=dt;const k=d.t/d.life;
    if(k>=1){
      d.m.visible=false;
      if(d.dust){d.m.material.opacity=.7;dustPool.push(d.m);}
      else shardPool.push(d.m);
      debris.splice(i,1);
      continue;
    }
    if(d.dust){
      // poeira: espalha, sobe um nada e desbota
      d.m.position.x+=d.vx*dt;d.m.position.z+=d.vz*dt;
      d.m.position.y+=d.vy*dt;d.vx*=Math.exp(-3*dt);d.vz*=Math.exp(-3*dt);
      d.m.scale.setScalar(d.m.scale.x+(d.grow-d.m.scale.x)*Math.min(1,3*dt));
      d.m.material.opacity=.7*(1-k);
    }else{
      // cacos: gravidade + giro, quicam no chão
      d.vy-=22*dt;
      d.m.position.x+=d.vx*dt;d.m.position.y+=d.vy*dt;d.m.position.z+=d.vz*dt;
      d.m.rotation.x+=d.spin*dt;d.m.rotation.z+=d.spin*.7*dt;
      const gy=PAD_Y+.1;
      if(d.m.position.y<gy){d.m.position.y=gy;d.vy*=-.4;d.vx*=.6;d.vz*=.6;}
    }
  }
}

// remove o carro do mundo e de TODAS as listas em que ele possa estar (carro
// dirigido vai pra idleCars na saída; defensivo p/ tráfego e polícia também).
function removeCar(c){
  if(!c)return;
  scene.remove(c.g);
  dropFromLists(c);
}

// take the car out of the "enterable" lists (idleCars) and traffic/cops WITHOUT
// removing it from the scene. Used every frame while crushing so the player
// can't re-enter the car being flattened: completeExit re-adds the exited car to
// idleCars ~0.4s after CRUSH, and re-entering it means being parented to a group
// that removeCar() later strips from the scene → player stuck/invisible.
function dropFromLists(c){
  if(!c)return;
  for(const arr of[idleCars,refs.traffic,refs.cops]){
    if(!Array.isArray(arr))continue;
    const i=arr.indexOf(c);
    if(i>=0)arr.splice(i,1);
  }
}

// dispara o esmagamento: captura o carro ANTES de mexer no estado, expulsa o
// jogador (vira 'foot') e começa a descida da placa.
function startCrush(){
  if(crushing)return;
  car=cur;                 // captura o carro atual ANTES de qualquer coisa
  if(!car)return;
  // RECUSA veículos únicos/especiais: destruí-los os removeria do mundo pra
  // sempre (o táxi/viatura/etc. nunca voltariam direito). Mostra aviso e aborta.
  if(isSpecialVehicle(car)){
    car=null;
    message("CAN'T CRUSH THIS VEHICLE",'var(--pink)');
    blip([196,147],.12,'square',.16);
    return;
  }
  refs.exitCar?.();        // joga o jogador pra fora; passa pro modo 'foot'
  crushing=true;phase='down';t=0;paid=false;scrap=null;
  // guarda o estado original do carro pra interpolar o achatamento
  _car0.y=car.g.position.y;
  _car0.scaleY=car.g.scale.y;
  // sucata: 80 + até 220 aleatório
  reward=80+Math.floor(Math.random()*221);
  press.position.y=PRESS_UP;
  message('SCRAP CRUSHER - SCRAPPING...','var(--cyan)');
  blip([330,247,196],.1,'sawtooth',.18);
}

// paga a sucata e marca o carro como sucata achatada (chamado no impacto da
// placa). Não remove o carro na hora: ele fica visível esmagado durante o
// "hold" e some quando a placa sobe — evita o "fantasma" meio-achatado.
function payAndScrap(){
  if(paid)return;
  paid=true;
  scrap=car;                       // guarda pra remover no fim do hold
  economy.earn(reward,'car-crusher');
  // impacto pesado: trovão grave + tremor forte + faíscas/poeira
  thud(16);
  state.shake=Math.max(state.shake,.55);
  if(scrap){
    const p=scrap.g.position;
    spawnImpactFX(p.x,PAD_Y,p.z);
  }
  bigText('SCRAPPED +$'+reward,'var(--gold)');
  setTimeout(hideBig,1100);
  blip([523,659,784,1047],.09,'square',.2);
}

// avança a animação da placa, do achatamento do carro e das partículas
export function updateCarCrusher(dt){
  if(debris.length)updateDebris(dt); // cacos/poeira somem mesmo após o ciclo
  if(!crushing)return;
  t+=dt;
  // keep the car being crushed out of idleCars/traffic so the on-foot player
  // can't re-enter it mid-animation (completeExit may have re-added it).
  dropFromLists(car||scrap);

  if(phase==='down'){
    const k=clamp(t/DOWN_TIME,0,1);
    const e=k*k;                       // descida acelerando (pesada)
    press.position.y=PRESS_UP+(PRESS_DOWN-PRESS_UP)*e;
    if(car){
      // achata o carro: scale.y 1 → ~0.14 e abaixa pra encostar no chão
      const sy=_car0.scaleY+(0.14-_car0.scaleY)*e;
      car.g.scale.y=sy;
      car.g.position.y=_car0.y*sy;     // mantém a base no chão enquanto achata
    }
    if(k>=1){
      payAndScrap();                   // impacto: paga e marca como sucata
      phase='hold';t=0;car=null;       // car já foi achatado por completo
    }
    return;
  }

  if(phase==='hold'){
    // carro totalmente achatado fica visível um instante embaixo da placa
    if(t>=HOLD_TIME){
      removeCar(scrap);                // some a sucata de vez (sem fantasma)
      scrap=null;
      phase='up';t=0;
    }
    return;
  }

  if(phase==='up'){
    const k=clamp(t/UP_TIME,0,1);
    press.position.y=PRESS_DOWN+(PRESS_UP-PRESS_DOWN)*k;
    if(k>=1){
      press.position.y=PRESS_UP;
      crushing=false;phase='idle';
      message('SCRAP CRUSHER READY','var(--cyan)');
    }
  }
}

// ----- registries (fiação no loop é feita pelo main.js) -----

// ação do botão E: só no carro, parado, dentro da zona e sem estar esmagando.
// Veículos únicos/especiais não mostram a ação como esmagável: o prompt avisa e
// o run() recusa (guarda dupla com startCrush).
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='car'||!cur||crushing)return null;
  const p=cur.g.position;
  if(Math.hypot(p.x-PAD.x,p.z-PAD.z)>PAD_RANGE||Math.abs(cur.speed)>STOP_SPEED)return null;
  if(isSpecialVehicle(cur))
    return{label:'CRUSH',prompt:"CAN'T CRUSH THIS VEHICLE",enabled:false,run(){}};
  return{label:'CRUSH',prompt:'CRUSH THIS CAR',enabled:true,run(){startCrush();}};
});

// blip fixo no radar/mapa (ícone 'crusher': desconhecido desenha genérico, ok)
(refs.miniBlips||(refs.miniBlips=[])).push(()=>
  [{x:PAD.x,z:PAD.z,icon:'crusher',color:'#9aa3ad',label:'SCRAP CRUSHER'}]);

// debug
refs.getCarCrusherState=()=>({crushing,phase});
