import {state} from './state.js';
import {player,playerPos} from './player.js';
import {message} from './hud.js';
import {animatePed} from './entities.js';
import {blip} from './audio.js';
import {getDay} from './daynight.js';
import {Interior} from './interior.js';
import {openGymGame,gymGameActive} from './gym-game.js';
import {openMiniGameIntro} from './minigame-leaderboard.js';
import {MiniGameId} from './minigame.js';
import {GYM_DOOR,GYM_SPAWN_OUT,INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,GYM_TRAIN,
  gymFx,gymInterior} from '../assets/models/city/gym.js';

// Academia "IRON TEMPLE": estende a classe base de interiores (js/interior.js),
// que já cuida de porta/teleporte/limite do mundo/câmera/saída de emergência.
// Particularidades daqui: encostar no supino abre o MINI-GAME do supino
// (js/gym-game.js). VENCER o set engrossa o braço — uma vez por dia de jogo,
// até um teto pra não vazar o carro. PERDER não dá nada (pode tentar de novo).

const ARM_MAX=1.5;        // engrossamento máximo do braço (x/z)
const ARM_STEP=0.1;       // ganho por set vencido
const TRAIN_RANGE=2.2;    // distância pra liberar a ação TRAIN

class GymInterior extends Interior{
  onEnter(){
    const left=getDay()!==state.gymDay&&state.armScale<ARM_MAX-1e-3;
    message(left?'WELCOME TO IRON TEMPLE - HIT THE BENCH TO TRAIN'
                :'WELCOME TO IRON TEMPLE','var(--gold)');
  }
  // o "pump" do braço roda SEMPRE (mesmo fora da academia), por isso vai aqui
  // antes do update base — updateInteriors chama update() de todo interior/frame
  update(dt){
    if(Math.abs(state.armScale-state.armTarget)>1e-4)
      state.armScale+=(state.armTarget-state.armScale)*Math.min(1,6*dt);
    else state.armScale=state.armTarget;
    applyArmScale();
    super.update(dt);
  }
  updateFx(dt){
    if(gymFx.barbell)gymFx.barbell.position.y=1.32+Math.sin(state.time*2.4)*.12; // barra sobe/desce
    for(const m of gymFx.lifters){
      m.t+=dt*m.sp;
      animatePed(m.g,m.t,.5);
      m.g.position.y=Math.abs(Math.sin(m.t))*.05; // pequeno agachamento
    }
  }
}

export const gym=new GymInterior({
  group:gymInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:GYM_DOOR,spawnOut:GYM_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:gymFx,
  exterior:{x:154,z:-110,r:24}, // fachada: gangue não chega perto
  mapIcon:{id:'gym',label:'IRON TEMPLE',icon:'gym',color:'#ff8a1e'},
});

// jogador perto do supino, dentro da academia (HUD/interact usam isto)
function gymTrainNear(){
  if(!gym.active)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-GYM_TRAIN.x,pp.z-GYM_TRAIN.z)<TRAIN_RANGE;
}

// Estado do supino pra montar o rótulo do HUD ('BENCH PRESS' / 'MAX' / 'TOMORROW')
export function gymTrainState(){
  if(!gymTrainNear()||gymGameActive())return null;
  if(state.armScale>=ARM_MAX-1e-3)return{label:'MAX',prompt:'ARMS MAXED OUT',enabled:false};
  if(getDay()===state.gymDay)return{label:'GYM',prompt:'ALREADY TRAINED - COME BACK TOMORROW',enabled:false};
  return{label:'BENCH',prompt:'HIT THE BENCH PRESS',enabled:true};
}

// Ação no supino (chamada pelo performInteract): abre o mini-game do supino.
// Vencer o set chama onWin -> engrossa um degrau o braço (com teto) e trava o
// dia. Perder não faz nada. Devolve true se consumiu a interação.
export function gymTrain(){
  if(!gymTrainNear())return false;
  if(state.armScale>=ARM_MAX-1e-3){message('YOUR ARMS ARE MAXED OUT','var(--pink)');return true;}
  if(getDay()===state.gymDay){message('ALREADY TRAINED TODAY - COME BACK TOMORROW','var(--pink)');return true;}
  // briefing com o top 5 antes de treinar; o supino abre quando o jogador "passa"
  openMiniGameIntro(MiniGameId.GYM,'Bench Press',()=>openGymGame({onWin:onSetComplete}));
  return true;
}

// chamado pelo mini-game quando o jogador FECHA o set (vitória)
function onSetComplete(){
  state.gymDay=getDay();
  state.armTarget=Math.min(ARM_MAX,state.armScale+ARM_STEP);
  message('PUMPED UP! YOUR ARMS GREW','var(--gold)');
  blip([330,440,587,660],.09,'square',.16);
}

// Aplica o tamanho atual do braço ao boneco (engrossa só x/z, sem alongar).
function applyArmScale(){
  const l=player.g.userData.limbs;if(!l)return;
  const s=state.armScale;
  l.leftArm.scale.x=l.leftArm.scale.z=s;
  l.rightArm.scale.x=l.rightArm.scale.z=s;
}
