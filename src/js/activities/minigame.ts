import {state,refs} from '@/core/state.ts';
import {getDay,setDay,getTod,restoreTod} from '@/world/daynight.ts';
import {openMiniGameIntro} from '@/activities/minigame-leaderboard.ts';
import type {Blip} from '@/core/types.ts';

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

// ---- "ONCE PER DAY" LOCK ----------------------------------------------------
// Each money mini-game can be COMPLETED once, then it locks. The lock clears two ways:
//   1) the in-game day rolls past midnight (the original rule — keeps you driving
//      between attempts in a single sitting), OR
//   2) at least MG_REAL_RESET_MS of REAL time has passed since you finished it.
// Path (2) fixes the cross-session frustration: the in-game clock is FROZEN while the
// game is shut, so a returning player kept the exact same in-game day and was told
// "come back tomorrow" forever. ~30 min away already feels like a new day, so we let
// real elapsed time release the lock. state.mgDays holds {id: in-game day completed};
// state.mgReal holds {id: Date.now() of completion}; both are persisted (getDailySave),
// alongside the day (getDay) and time of day (getTod) so the clock doesn't snap back to
// afternoon on reload (which would otherwise refreeze the in-game day across reloads).
export const MG_REAL_RESET_MS=30*60*1000; // 30 real minutes
// playedDay = getDay() at completion; playedAt = Date.now() at completion (both from the
// save). Returns true when the lock should be OPEN (the mini-game is available again).
export function dailyLockCleared(playedDay: number|undefined, playedAt: number|undefined){
  if(playedDay===undefined||playedDay!==getDay())return true; // never completed, or in-game day advanced
  if(playedAt!==undefined&&Date.now()-playedAt>=MG_REAL_RESET_MS)return true; // enough real time elapsed
  return false;
}
export function mgPlayedToday(id: string){ return !dailyLockCleared(state.mgDays?.[id],state.mgReal?.[id]); }
export function mgMarkPlayed(id: string){ (state.mgDays??(state.mgDays={}))[id]=getDay(); (state.mgReal??(state.mgReal={}))[id]=Date.now(); }
refs.mgPlayedToday=mgPlayedToday;
refs.mgMarkPlayed=mgMarkPlayed;
// save slot: current day + time of day + per-mini-game in-game day & real timestamp (restored together).
refs.getDailySave=()=>({day:getDay(),tod:getTod(),mg:{...(state.mgDays||{})},mgr:{...(state.mgReal||{})}});
refs.restoreDaily=(v: unknown)=>{ const d=v as {day?: number; tod?: number; mg?: Record<string, number>; mgr?: Record<string, number>}|null; if(d&&typeof d==='object'){ setDay(d.day!); restoreTod(d.tod!); if(d.mg&&typeof d.mg==='object') state.mgDays={...d.mg}; if(d.mgr&&typeof d.mgr==='object') state.mgReal={...d.mgr}; } };

// registro global: uma instância por id (preenchido nos construtores dos módulos)
const registry=new Map<string, MiniGame>();

// opts do construtor de MiniGame (ver doc abaixo).
export interface MiniGameOpts{
  id: string;
  name?: string;
  exclusive?: boolean;
  blips?: (()=>Blip[])|null;
}

export class MiniGame{
  id: string;
  name: string;
  exclusive: boolean;
  _blips: (()=>Blip[])|null;
  _active: boolean;

  // opts:
  //   id        — um valor de MiniGameId
  //   name      — rótulo legível (HUD/debug); cai no id se omitido
  //   exclusive — sessão que trava o mundo? (default true)
  //   blips     — ()=>[{x,z,icon,color,label,current,reveal}] alvos do mini game
  //               ATIVO (o radar/mapa mostra SÓ estes enquanto a sessão roda)
  constructor({id,name,exclusive=true,blips=null}: MiniGameOpts={} as MiniGameOpts){
    if(!(Object.values(MiniGameId) as string[]).includes(id))
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
  static isActive(id: string){return state.activeMiniGame===id;}
  static canStartId(id: string){const a=state.activeMiniGame;return a===null||a===id;}
  static get(id: string){return registry.get(id)||null;}
  static active(){return state.activeMiniGame?registry.get(state.activeMiniGame)||null:null;}
  // blips do mini game em curso, pro HUD desenhar SÓ eles (mapa limpo)
  static activeBlips(){const g=MiniGame.active();return g?g.targets():[];}
}
