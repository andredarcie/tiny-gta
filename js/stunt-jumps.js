import {state,refs} from './state.js';
import {economy} from './economy.js';
import {scene} from './engine.js';
import {cur} from './player.js';
import {message,bigText,hideBig} from './hud.js';
import {blip} from './audio.js';
import {clamp,groundHeight} from './constants.js';
import {makeStuntRamp} from '../assets/models/props/stunt-ramp.js';
import {MiniGame,MiniGameId} from './minigame.js';

// atividade livre (não trava o mundo): registra a identidade no enum/registro de
// mini games. As rampas NÃO aparecem no mapa/radar — o jogador descobre sozinho.
new MiniGame({id:MiniGameId.STUNT_JUMPS,name:'Daredevil Jumps',exclusive:false});

// DAREDEVIL JUMPS — rampas escondidas pela praia e pela zona rural (NUNCA no
// meio da rua). O jogador chega de carro em alta velocidade, decola num arco e
// ganha dinheiro proporcional à velocidade; completar cada rampa pela primeira vez
// dá um bônus ("DAREDEVIL JUMP").
//
// FÍSICA: updateStuntJumps roda no loop DEPOIS do update do carro. Por isso, durante
// um salto, sobrescrevemos cur.g.position.y a cada frame para desenhar o arco — o
// update do carro reseta y para a altura do terreno no frame seguinte, mas como
// reaplicamos todo frame, o arco aparece. O controle do carro NÃO é travado.

const TOTAL=5;
const JUMP_DUR=0.9;     // duração do arco (s)
const TAKEOFF_DIST=4;   // distância (m) para disparar a decolagem
const MIN_SPEED=14;     // velocidade mínima para decolar
const LAND_COOLDOWN=0.6;// trava curta após aterrissar (não redispara na mesma rampa)
const ALIGN_TOL=0.55;   // produto escalar mínimo (~57°): carro indo ao longo da rampa
const REPEAT_PAY_CD=30; // segundos entre pagamentos repetidos NA MESMA rampa (anti-farm)

// Locais escolhidos a dedo, SEMPRE fora das ruas: o anel de areia da praia (corrida
// longa e plana) e o pasto da zona rural (península a leste). Coordenadas de MUNDO.
// heading = rotation.y; a cunha sobe ao longo de +z local, então no mundo a subida
// aponta em (sin h, cos h) — o carro precisa chegar nessa direção pra decolar.
// Praia = anel de areia ~183–218 do centro (lados N/S/O); rural = x>183, |z|<120
// (longe das fazendas/silo, que começam em x≈342). Aterrissagem sempre em terra.
const SPOTS=[
  {x:  90, z: 200, heading:Math.PI/2}, // praia sul — corre rente ao mar (+x)
  {x: -90, z:-200, heading:Math.PI/2}, // praia norte (+x)
  {x:-200, z: -70, heading:Math.PI},   // praia oeste — desce a areia (-z)
  {x: 210, z:  18, heading:Math.PI/2}, // pasto rural, ao lado da estrada de terra (+x)
  {x: 260, z: -45, heading:Math.PI/2}, // pasto rural, mais fundo na península (+x)
];

const ramps=[];
for(const s of SPOTS.slice(0,TOTAL)){
  const g=makeStuntRamp();
  g.position.set(s.x,groundHeight(s.x,s.z),s.z);
  g.rotation.y=s.heading;
  scene.add(g);
  ramps.push({x:s.x,z:s.z,heading:s.heading,g,done:false,paidAt:-Infinity});
}

// Estado do salto em andamento.
let airborne=false;
let jumpT=0;
let jumpDur=JUMP_DUR;
let jumpAlt=4;
let jumpSpeed=0;
let jumpRamp=null;
let cooldown=0;

// Sem blip no radar/mapa de propósito: as rampas são segredos a descobrir dirigindo.

// Debug hook.
refs.getStuntJumpsState=()=>({
  done:ramps.filter(r=>r.done).length,
  total:ramps.length,
  airborne,
});

// ----- SAVE: rampas já completadas (js/save.js) -----
// Guarda os ÍNDICES das rampas concluídas (os locais são fixos). Restaurar só
// marca `done` (impede repagar o bônus de primeira vez); o salto em si continua
// rendendo o pagamento normal por velocidade.
refs.getStuntsSave=()=>{
  const a=[];
  for(let i=0;i<ramps.length;i++)if(ramps[i].done)a.push(i);
  return a;
};
refs.restoreStunts=arr=>{
  if(!Array.isArray(arr))return;
  for(const v of arr)if(Number.isInteger(v)&&v>=0&&v<ramps.length)ramps[v].done=true;
};

// Encerra o salto SEM premiar (jogador largou o carro, morreu, entrou num
// interior, ou o veículo sumiu no meio do arco). Apenas solta o estado e zera a
// pose; nada de dinheiro nem letreiro de "stunt".
function abortJump(){
  airborne=false;
  cooldown=LAND_COOLDOWN;
  jumpRamp=null;
  if(cur)cur.g.rotation.x=0; // desfaz o pitch do arco se o carro ainda existe
}

export function updateStuntJumps(dt){
  if(cooldown>0)cooldown=Math.max(0,cooldown-dt);

  // --- salto em andamento: desenha o arco ---
  if(airborne){
    // Saiu do estado de carro a meio do arco (largou o veículo, morreu, BUSTED,
    // entrou num interior) → aborta sem premiar. cur pode já ter virado null.
    if(!cur||state.mode!=='car'||state.interior){abortJump();return;}
    jumpT+=dt;
    const p=cur.g.position;
    const k=clamp(jumpT/jumpDur,0,1);
    const arc=Math.sin(Math.PI*k)*jumpAlt;       // meia-senoide: 0 → topo (k=.5) → 0
    p.y=groundHeight(p.x,p.z)+arc;
    // Pitch acompanha a DERIVADA do arco: cos(πk) vai de +1 (decolagem) a -1
    // (pouso). rotation.x negativo = nariz pra cima (mesma convenção do morro em
    // player.js). Setado DEPOIS do updateCar, então vence a inclinação do terreno.
    cur.g.rotation.x=-clamp(Math.cos(Math.PI*k)*(jumpAlt/14),-.5,.5);

    if(jumpT>=jumpDur){
      // --- aterrissagem limpa (arco completou no ar) ---
      airborne=false;cooldown=LAND_COOLDOWN;
      // toca o chão zerado: y na altura do terreno e nariz nivelado (o updateCar
      // do próximo frame reassume a inclinação do terreno a partir do zero)
      cur.g.position.y=groundHeight(cur.g.position.x,cur.g.position.z);
      cur.g.rotation.x=0;
      state.shake=Math.max(state.shake,.35); // baque do pouso
      // valor pela velocidade do salto, com teto: capado pra um stunt NUNCA pagar
      // mais que vencer uma corrida ($700). O destaque é o bônus de inédito (+400);
      // a repetição (v puro a cada 30s) fica baixa de propósito (anti-farm).
      const v=Math.min(300,Math.max(0,Math.round(jumpSpeed*8)));
      if(jumpRamp&&!jumpRamp.done){
        // primeira vez nesta rampa: bônus de descoberta
        jumpRamp.done=true;jumpRamp.paidAt=state.time;
        const bonus=400;
        economy.earn(v+bonus,'stunt-jump');
        bigText('DAREDEVIL JUMP! +$'+(v+bonus),'var(--gold)');
        message('DAREDEVIL JUMP  +$'+(v+bonus),'var(--gold)');
        blip([523,659,784,1047,1319],0.1,'square',.2);
      }else if(jumpRamp&&state.time-jumpRamp.paidAt>=REPEAT_PAY_CD){
        // repetição após o cooldown: paga de novo (evita farm na mesma rampa)
        jumpRamp.paidAt=state.time;
        economy.earn(v,'stunt-jump-repeat');
        bigText('INSANE STUNT! +$'+v,'var(--gold)');
        message('INSANE STUNT  +$'+v,'var(--gold)');
        blip([659,880,1175],0.09,'square',.18);
      }else{
        // repetição dentro do cooldown: ainda dá o baque/letreiro, mas SEM dinheiro
        bigText('INSANE STUNT!','var(--gold)');
        blip([659,880,1175],0.09,'square',.18);
      }
      setTimeout(hideBig,1100);
      jumpRamp=null;
    }
    return;
  }

  // --- detecção de decolagem ---
  // Durante uma sessão de mini game não dispara salto (sem outras atividades);
  // um salto já no ar termina normalmente pelo bloco acima. Em interior também
  // não decola (fora do mapa, chão seco) nem com o carro afundando/no mar.
  if(cooldown>0||state.mode!=='car'||!cur||MiniGame.busy||state.interior)return;
  if(cur.sinkT||cur.plane||cur.boat)return; // só carro em terra firme decola de rampa
  if(cur.speed<MIN_SPEED)return;            // só pra frente: ré não decola da rampa

  const p=cur.g.position;
  // direção do carro (forward) e sentido do movimento (ré conta como contrário)
  const dir=Math.sign(cur.speed)||1;
  const cfx=Math.sin(cur.heading)*dir, cfz=Math.cos(cur.heading)*dir;

  for(const r of ramps){
    if(Math.hypot(p.x-r.x,p.z-r.z)>=TAKEOFF_DIST)continue;
    // alinhamento: o carro precisa estar indo ao longo da rampa (forward dela)
    const rfx=Math.sin(r.heading), rfz=Math.cos(r.heading);
    if(cfx*rfx+cfz*rfz<ALIGN_TOL)continue; // ~57° de tolerância
    // decola!
    airborne=true;jumpT=0;jumpDur=JUMP_DUR;
    jumpSpeed=Math.abs(cur.speed);
    jumpAlt=clamp(3+jumpSpeed*0.15,3,9); // mais rápido → arco mais alto
    jumpRamp=r;
    state.shake=Math.max(state.shake,.25);
    blip([330,440],0.06,'sawtooth',.15);
    break;
  }
}
