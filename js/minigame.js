import {state,refs} from './state.js';
import {getDay,setDay} from './daynight.js';
import {openMiniGameIntro} from './minigame-leaderboard.js';

// ============================================================================
// BASE DE MINI GAME — o que é comum a TODOS os mini games do mundo aberto.
//
// Cada mini game (táxi, corrida, vigilante, rampage, bombeiro, ...) cria UMA
// instância de MiniGame descrevendo a si mesmo (id do enum + nome + provedor de
// blips). A base centraliza o que antes ficava repetido módulo a módulo:
//   - identidade (id do enum + nome legível) e um registro global;
//   - a TRAVA de "um por vez": estando num mini game não dá pra entrar noutro
//     (state.activeMiniGame guarda quem está em curso);
//   - os alvos do mini game ativo pro radar/mapa, pra que o HUD desenhe SÓ eles
//     enquanto uma sessão roda (mapa "limpo", sem POIs nem outras atividades).
//
// Mini games de SESSÃO (exclusive:true) — táxi/corrida/plantões/rampage — pegam a
// trava em begin() e soltam em end(). Os de "encostar e pronto"/coletáveis
// (car-crusher, pacotes, saltos, overkill, ...) usam exclusive:false: continuam
// sendo mini games registrados (herdam a base), mas não bloqueiam o mundo.
// ============================================================================

// Enum com TODOS os mini games disponíveis. Centraliza os identificadores pra não
// espalhar strings soltas pelos módulos; o valor casa com o nome do módulo
// (legível em debug / render_game_to_text).
export const MiniGameId=Object.freeze({
  // sessões (travam o mundo: um por vez, mapa limpo enquanto rolam)
  TAXI:'taxi',
  RACE:'race',
  BOAT_RACE:'boat-race',
  OFFROAD:'offroad',
  VIGILANTE:'vigilante',
  PARAMEDIC:'paramedic',
  FIREFIGHTER:'firefighter',
  RAMPAGE:'rampage',
  RC_TOYZ:'rc-toyz',
  // atividades livres / coletáveis (não bloqueiam o mundo)
  CAR_CRUSHER:'car-crusher',
  IMPORT_EXPORT:'import-export',
  BOMB_SHOP:'bomb-shop',
  HIDDEN_PACKAGES:'hidden-packages',
  STUNT_JUMPS:'stunt-jumps',
  OVERKILL:'overkill',
  // mini-games próprios (overlay de interior / pickup): NÃO são instâncias de
  // MiniGame nem entram na trava de sessão, mas têm o MESMO briefing de ranking
  // (top 5) e enviam resultado ao backend. Ids só pro intro + envio.
  GYM:'gym',
  DANCE:'dance',
  ROCKET_RAMPAGE:'rocket-rampage',
  WEED_FARM:'weed-farm',
});

// ---- REGRA "1x POR DIA" (tempo do jogo) ------------------------------------
// Cada mini-game de dinheiro só pode ser CONCLUÍDO uma vez por dia in-game; depois
// o jogador espera virar o próximo dia (obriga a rodar entre mini-games em vez de
// farmar um só). state.mgDays guarda {id: último dia concluído}; o dia (getDay) é
// persistido no save (ver refs.getDailySave) pra não ser burlável recarregando.
export function mgPlayedToday(id){ return state.mgDays?.[id]===getDay(); }
export function mgMarkPlayed(id){ (state.mgDays??(state.mgDays={}))[id]=getDay(); }
refs.mgPlayedToday=mgPlayedToday;
refs.mgMarkPlayed=mgMarkPlayed;
// slot do save: dia atual + mapa por mini-game (restaurados juntos, consistentes).
refs.getDailySave=()=>({day:getDay(),mg:{...(state.mgDays||{})}});
refs.restoreDaily=d=>{ if(d&&typeof d==='object'){ setDay(d.day); if(d.mg&&typeof d.mg==='object') state.mgDays={...d.mg}; } };

// registro global: uma instância por id (preenchido nos construtores dos módulos)
const registry=new Map();

export class MiniGame{
  // opts:
  //   id        — um valor de MiniGameId
  //   name      — rótulo legível (HUD/debug); cai no id se omitido
  //   exclusive — sessão que trava o mundo? (default true)
  //   blips     — ()=>[{x,z,icon,color,label,current,reveal}] alvos do mini game
  //               ATIVO (o radar/mapa mostra SÓ estes enquanto a sessão roda)
  constructor({id,name,exclusive=true,blips=null}={}){
    if(!Object.values(MiniGameId).includes(id))
      console.warn('[minigame] id fora do enum:',id);
    this.id=id;
    this.name=name||id;
    this.exclusive=exclusive;
    this._blips=blips;
    this._active=false;
    registry.set(id,this);
  }

  // esta sessão está em curso?
  get active(){return this._active;}

  // dá pra começar? só se nenhum OUTRO mini game exclusivo estiver rolando.
  canStart(){return !this.exclusive||MiniGame.canStartId(this.id);}

  // entra no mini game: pega a trava do mundo (um por vez). Devolve false se já
  // tem outra sessão rolando — o chamador deve abortar o início nesse caso.
  begin(){
    if(this._active)return true;
    if(!this.canStart())return false;
    // regra 1x/dia: já concluiu este mini-game hoje? bloqueia e avisa.
    if(mgPlayedToday(this.id)){
      refs.message?.(`${this.name.toUpperCase()} - ALREADY DONE TODAY, COME BACK TOMORROW`,'var(--pink)');
      return false;
    }
    this._active=true;
    if(this.exclusive){
      state.activeMiniGame=this.id;
      // briefing: mostra o ranking do mini game e congela até o jogador "passar"
      openMiniGameIntro(this.id,this.name);
    }
    return true;
  }

  // sai do mini game: solta a trava se era o dono dela.
  end(){
    if(!this._active)return;
    this._active=false;
    if(this.exclusive&&state.activeMiniGame===this.id)state.activeMiniGame=null;
  }

  // alvos deste mini game (só fazem sentido enquanto ele está ativo)
  targets(){return this._active&&this._blips?(this._blips()||[]):[];}

  // ---- gerência estática do "um por vez" ----------------------------------
  static get activeId(){return state.activeMiniGame||null;}     // id em curso (ou null)
  static get busy(){return !!state.activeMiniGame;}             // alguma sessão rolando?
  static isActive(id){return state.activeMiniGame===id;}
  static canStartId(id){const a=state.activeMiniGame;return a===null||a===id;}
  static get(id){return registry.get(id)||null;}
  static active(){return state.activeMiniGame?registry.get(state.activeMiniGame)||null:null;}
  // blips do mini game em curso, pro HUD desenhar SÓ eles (mapa limpo)
  static activeBlips(){const g=MiniGame.active();return g?g.targets():[];}
}
