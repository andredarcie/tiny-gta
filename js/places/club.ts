import {animatePed} from '@/core/entities.js';
import {Interior} from '@/world/interior.js';
import {playerPos} from '@/actors/player.js';
import {state,refs} from '@/core/state.js';
import {economy} from '@/core/economy.js';
import {message} from '@/ui/hud.js';
import {clubMusicOn,clubMusicOff} from '@/audio/club-music.js';
import {openDanceGame,danceGameActive} from '@/places/dance-game.js';
import {openMiniGameIntro,reportMiniGameResult} from '@/activities/minigame-leaderboard.js';
import {MiniGameId} from '@/activities/minigame.js';
import {CLUB_DOOR,CLUB_SPAWN_OUT,INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,clubFx,clubInterior}
  from '../../assets/models/city/nightclub.js';

// Boate "THE FLAMINGO": estende a classe base de interiores (js/interior.js),
// que já cuida de porta/teleporte/limite do mundo/câmera/saída de emergência.
// Particularidades daqui: a MÚSICA PRÓPRIA da casa (js/club-music.js) ao
// entrar/sair, a animação da pista (globo, ladrilhos, dançarinos) e o MINI-GAME
// de ritmo (js/dance-game.js) que abre ao pisar no meio da pista.
const PAL=[0xff2e88,0x19e3ff,0xffd24a,0x9dff2e];

// centro da pista de dança (ladrilhos do nightclub.js) e raio de ação
const DANCE_X=-800.98,DANCE_Z=-22.03,DANCE_RANGE=4.2;

class ClubInterior extends Interior{
  fxT?:number;
  step?:number;
  override onEnter(){
    super.onEnter();      // aviso de boas-vindas padrão
    clubMusicOn();        // trilha house própria da boate
  }
  override onExit(){clubMusicOff();}
  override updateFx(dt:number){
    clubFx.ball!.rotation.y+=dt*1.4;
    this.fxT=(this.fxT||0)+dt;
    if(this.fxT>=.24){ // pista pisca trocando as cores dos 4 materiais compartilhados
      this.fxT=0;this.step=(this.step||0)+1;
      clubFx.tileMats.forEach((m,i)=>m.color.setHex(PAL[(i+this.step!)%PAL.length]));
    }
    for(const d of clubFx.dancers){
      d.t+=dt*d.sp;
      animatePed(d.g,d.t,.9);
      d.g.position.y=Math.abs(Math.sin(d.t))*.09;
      d.g.rotation.y=d.face+Math.sin(d.t*.45)*.6;
    }
  }
}

export const club=new ClubInterior({
  group:clubInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:CLUB_DOOR,spawnOut:CLUB_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:clubFx,enterMsg:'WELCOME TO THE FLAMINGO',enterColor:'var(--pink)',
  exterior:{x:-154,z:-22,r:24}, // fachada: gangue não chega perto
  mapIcon:{id:'club',label:'THE FLAMINGO',icon:'club',color:'#ff2e88'},
});

// jogador no meio da pista, dentro da boate (HUD/interact usam isto)
function clubDanceNear(){
  if(!club.active)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-DANCE_X,pp.z-DANCE_Z)<DANCE_RANGE;
}

// Rótulo do HUD pra ação DANCE (só na pista, com o mini-game fechado).
export function clubDanceState(){
  if(!clubDanceNear()||danceGameActive())return null;
  return{label:'DANCE',prompt:'HIT THE DANCE FLOOR',enabled:true};
}

// Ação na pista (chamada pelo performInteract): abre o mini-game de ritmo.
export function clubDance(){
  if(!clubDanceNear())return false;
  // regra 1x/dia: já dançou hoje? avisa e não abre a pista.
  if(refs.mgPlayedToday?.(MiniGameId.DANCE)){message('ALREADY DANCED TODAY - COME BACK TOMORROW','var(--pink)');return true;}
  // briefing com o top 5 antes de dançar; a pista abre quando o jogador "passa"
  openMiniGameIntro(MiniGameId.DANCE,'Dance Fever',()=>openDanceGame({onFinish:onDanceFinish}));
  return true;
}

// chamado pelo mini-game ao terminar: gorjeta da casa conforme a nota
function onDanceFinish(info:{won:boolean;grade:string;score:number;maxCombo:number;reward:number;accuracy:number;newBest:boolean}){
  if(info.reward>0){
    economy.earn(info.reward,'dance');
    message(`GRADE ${info.grade}! THE CROWD TIPS YOU $${info.reward}`,'var(--gold)');
  }else if(info.won){
    message(`GRADE ${info.grade} - KEEP PRACTICING FOR A TIP`,'var(--cream)');
  }else{
    message('THE CROWD BOOED YOU OFF THE FLOOR','var(--pink)');
  }
  reportMiniGameResult(MiniGameId.DANCE,{won:info.won,score:info.score}); // ranking da dança (top 5)
}
