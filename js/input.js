import {state,keys,input,refs} from './state.js';
import {initAudio,AC} from './audio.js';
import {radioSwitch} from './radio.js';
import {enterCar,exitCar,cur,player,cameraRig} from './player.js';
import {storyInteract,advanceCine} from './story.js';
import {gymTrain} from './gym.js';
import {houseBuy,houseEat,houseGaragePark} from './property.js';
import {houseTvInteract} from './house-tv.js';
import {startOverkill} from './overkill.js';
import {setMissionHUD} from './missions.js';
import {message} from './hud.js';
import {canPickWeapon,pickupWeapon,shootWeapon,switchWeapon,selectWeaponSlot} from './weapons.js';
import {toggleModelViewer,closeModelViewer} from './model-viewer.js';
import {getNickname,setNickname,startSession,refreshTopPlayers} from './leaderboard.js';
import {hasProfanity} from './profanity.js';

const gameCanvas=()=>document.getElementById('game');
const isBlocked=()=>state.paused||state.mode==='cut'||state.orientationBlocked||state.controlsLocked;

function lockPointer(){
  if(state.mobile||input.touchActive)return;
  gameCanvas()?.requestPointerLock?.();
}

function showPause(){
  document.getElementById('pauseov').style.display=state.paused?'flex':'none';
}

export function resetInput(keepTouch=false){
  input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;
  input.run=false;input.brake=false;input.horn=false;input.shootHeld=false;
  input.moveActive=false;input.lookActive=false;input.brakeActive=false;input.hornActive=false;
  if(!keepTouch)input.touchActive=false;
}

export function updateKeyboardInput(){
  if(state.tvActive){
    input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;
    input.run=false;input.brake=false;input.horn=false;input.shootHeld=false;
    return;
  }
  const f=(keys['KeyW']||keys['ArrowUp']?1:0)-(keys['KeyS']||keys['ArrowDown']?1:0);
  const side=(keys['KeyA']||keys['ArrowLeft']?1:0)-(keys['KeyD']||keys['ArrowRight']?1:0);
  const keyboardMoving=!!(f||side||keys['ShiftLeft']||keys['ShiftRight']);
  if(!input.moveActive||keyboardMoving){
    input.moveY=f;
    input.moveX=side;
    input.run=!!(keys['ShiftLeft']||keys['ShiftRight']);
    if(keyboardMoving)input.lastInput='keyboard';
  }
  if(!input.lookActive){
    input.lookX=0;
    input.lookY=0;
  }
  if(!input.brakeActive)input.brake=!!keys['Space'];
  if(!input.hornActive)input.horn=!!keys['KeyH'];
}

export function performShoot(){
  if(isBlocked()||state.dlgActive)return;
  shootWeapon();
}

export function performRadioSwitch(){
  if(isBlocked()||state.dlgActive)return;
  radioSwitch();
}

export function performPauseToggle(){
  if(!state.started||state.mode==='cut')return;
  state.paused=!state.paused;
  if(state.paused)resetInput(true);
  showPause();
}

export function performFullscreenToggle(){
  if(document.fullscreenElement){
    document.exitFullscreen?.();
    return;
  }
  const fs=document.documentElement.requestFullscreen?.();
  fs?.catch?.(()=>{});
}

export function performInteract(){
  if(!state.started)return;
  if(houseTvInteract())return; // ativo: E fecha; perto da TV: E abre
  if(state.dlgActive)return; // cut-scene: legendas correm sozinhas
  if(isBlocked())return;
  if(state.mode==='foot'){
    if(canPickWeapon()){pickupWeapon();return;}
    if(houseEat())return;  // comer da geladeira dentro de casa (cura)
    if(houseBuy())return;  // comprar a casa de campo (perto da placa FOR SALE)
    if(gymTrain())return; // treino na academia (perto do supino)
    if(refs.gunShopBuy?.())return; // comprar arma no balcão da loja de armas
    if(startOverkill())return; // liga o modo overkill (perto do totem)
    if(storyInteract())return;
    enterCar();
  }else if(state.mode==='car'){
    if(refs.startRaceInteract?.())return; // largar corrida no pórtico tem prioridade
    if(houseGaragePark())return; // guardar o carro na garagem da casa comprada
    if(Math.abs(cur?.speed||0)<6)exitCar();
  }
}

export function startGameFromUserGesture(opts={}){
  if(state.started)return;
  const mobile=!!opts.mobile;
  if(mobile){
    state.mobile=true;
    input.touchActive=true;
    input.lastInput='touch';
    document.body.classList.add('is-mobile');
  }
  initAudio();AC?.resume?.();
  document.getElementById('title').style.display='none';
  document.getElementById('hud').style.display='block';
  state.started=true;
  cameraRig.yaw=player.heading;
  if(mobile){
    const fs=document.documentElement.requestFullscreen?.();
    fs?.catch?.(()=>{});
    const orient=screen.orientation?.lock?.('landscape');
    orient?.catch?.(()=>{});
  }else lockPointer();
  setMissionHUD();
  message(mobile?'TAKE THE PINK CAR':'TAKE THE PINK CAR - PRESS E','var(--gold)');
}

const isMobileEnv=()=>state.mobile||matchMedia('(pointer: coarse)').matches;

// Abre o modal de nickname (passo antes de iniciar a partida).
function openNickModal(){
  if(state.started)return;
  const inp=document.getElementById('nick-input');
  if(inp)inp.value=getNickname();
  document.getElementById('nickmodal')?.classList.add('open');
  setTimeout(()=>inp?.focus(),60);
}

// Confirma o nick e inicia o jogo (este clique/tap é o gesto do usuário, então
// vale pra áudio/fullscreen/pointer-lock dentro de startGameFromUserGesture).
function confirmNick(){
  const inp=document.getElementById('nick-input');
  const name=(inp?.value||'').toUpperCase().replace(/[^A-Z0-9 _-]/g,'').replace(/\s+/g,' ').trim().slice(0,12);
  // vazio ou palavrão: rejeita com o shake (mesma validação do servidor).
  if(!name||hasProfanity(name)){inp?.classList.add('err');setTimeout(()=>inp?.classList.remove('err'),350);return;}
  setNickname(name);
  document.getElementById('nickmodal')?.classList.remove('open');
  startGameFromUserGesture({mobile:isMobileEnv()});
  startSession(); // abre a sessão do ranking pra esta run (não bloqueia o start)
}

// Usado pelo touch-controls: tocar pra jogar abre o modal de nickname.
export function requestStart(){ openNickModal(); }

export function setupInput(){
  const canvas=gameCanvas();
  addEventListener('mousemove',e=>{
    if(document.pointerLockElement!==canvas||!state.started||state.paused||state.dlgActive)return;
    cameraRig.yaw-=e.movementX*cameraRig.sensitivity;
    cameraRig.pitch+=(cameraRig.invertY?-1:1)*e.movementY*cameraRig.sensitivity;
    cameraRig.pitch=Math.max(.18,Math.min(.82,cameraRig.pitch));
    cameraRig.touchLookIdle=0; // mexeu o mouse: adia o auto-follow atrás do carro
  });
  // Desktop: o 1º clique trava o ponteiro; com o ponteiro travado, segurar o
  // botão esquerdo dispara (e mantém o fogo automático via input.shootHeld).
  canvas?.addEventListener('mousedown',e=>{
    if(state.mobile||input.touchActive)return;
    if(!state.started||state.dlgActive)return;
    if(document.pointerLockElement!==canvas){lockPointer();return;}
    if(e.button!==0)return;
    input.shootHeld=true;
    performShoot();
  });
  addEventListener('mouseup',e=>{if(e.button===0)input.shootHeld=false;});
  // Roda do mouse troca de arma (a pé).
  canvas?.addEventListener('wheel',e=>{
    if(!state.started||isBlocked()||state.dlgActive||state.mode!=='foot')return;
    e.preventDefault();
    switchWeapon(e.deltaY>0?1:-1);
  },{passive:false});

  // Cut-scene: clique (PC) ou toque na tela (celular) também avança o diálogo.
  // O botão que ABRE a cena dá stopPropagation, então não vaza pra cá e não
  // pula a primeira fala. Só roda durante a cena.
  addEventListener('pointerdown',e=>{
    if(state.cine){e.preventDefault();advanceCine();}
  });

  addEventListener('keydown',e=>{
    // Digitando num campo (ex.: modal de nickname): não captura atalhos globais.
    const t=e.target;
    if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))
      e.preventDefault();
    keys[e.code]=true;
    input.lastInput='keyboard';
    // Cut-scene: o diálogo só passa por interação. Avança com Space/Enter/E/F
    // e nenhum outro atalho funciona enquanto a cena roda.
    if(state.cine){
      if(['Space','Enter','KeyE','KeyF'].includes(e.code)){e.preventDefault();advanceCine();}
      return;
    }
    if(state.tvActive){
      if(e.code==='KeyE'||e.code==='KeyF')performInteract();
      return;
    }
    if(e.code==='KeyI'){toggleModelViewer();return;}
    if(e.code==='Escape'&&state.viewerOpen){closeModelViewer();return;}
    if(!state.started)return;
    if(state.dlgActive)return; // cut-scene: nada de pular falas
    if(e.code==='KeyP'){performPauseToggle();return;}
    if(e.code==='KeyF'&&e.shiftKey){performFullscreenToggle();return;}
    if(e.code==='Tab'){performRadioSwitch();return;}
    if(/^Digit[0-9]$/.test(e.code)){selectWeaponSlot(e.code==='Digit0'?10:+e.code.slice(5));return;}
    if(e.code==='KeyQ'){switchWeapon(1);return;}
    if(e.code==='KeyE'||e.code==='KeyF'){performInteract();return;}
  });

  addEventListener('keyup',e=>{keys[e.code]=false;});

  addEventListener('blur',()=>resetInput(true));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)resetInput(true);
  });

  const savedBest=JSON.parse(localStorage.getItem('tinygta_best')||'{"money":0,"deliveries":0}');
  if(savedBest.money>0||savedBest.deliveries>0)
    document.getElementById('best').textContent=
      `BEST: $${savedBest.money} ◆ ${savedBest.deliveries} DELIVERIES`;

  // Iniciar passa pelo modal de nickname (o nick vai pro ranking global).
  refreshTopPlayers();
  document.getElementById('play')?.addEventListener('click',e=>{e.stopPropagation();openNickModal();});
  document.getElementById('nick-play')?.addEventListener('click',confirmNick);
  document.getElementById('nick-input')?.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();confirmNick();}
  });
  document.getElementById('btn-fullscreen')?.addEventListener('pointerdown',e=>{
    e.preventDefault();
    e.stopPropagation();
    performFullscreenToggle();
  });
}
