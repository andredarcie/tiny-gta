import {state,keys,input,refs,saveBest} from './state.js';
import {initAudio,AC} from './audio.js';
import {radioSwitch} from './radio.js';
import {enterCar,exitCar,cur,player,cameraRig} from './player.js';
import {storyInteract,advanceCine} from './story.js';
import {gymTrain} from './gym.js';
import {gymGameActive,gymGamePress,closeGymGame} from './gym-game.js';
import {clubDance} from './club.js';
import {danceGameActive,closeDanceGame,pressLane,danceGameConfirm} from './dance-game.js';
import {modShopActive,closeModShop} from './mod-shop.js';
import {houseBuy,houseEat,houseGaragePark} from './property.js';
import {houseTvInteract,closeHouseTv} from './house-tv.js';
import {startOverkill} from './overkill.js';
import {setMissionHUD} from './missions.js';
import {message,drawFullMap} from './hud.js';
import {canPickWeapon,pickupWeapon,shootWeapon,switchWeapon,selectWeaponSlot} from './weapons.js';
import {openWheel,closeWheel,wheelScroll,wheelPointerDelta} from './weapon-wheel.js';
import {toggleModelViewer,closeModelViewer} from './model-viewer.js';
import {getNickname,setNickname,startSession,refreshTopPlayers} from './leaderboard.js';
import {hasProfanity} from './profanity.js';
import {MiniGame} from './minigame.js';

const gameCanvas=()=>document.getElementById('game');
const isBlocked=()=>state.paused||state.mapOpen||state.wheelOpen||state.mode==='cut'||state.orientationBlocked||state.controlsLocked;

function lockPointer(){
  if(state.mobile||input.touchActive)return;
  gameCanvas()?.requestPointerLock?.();
}

function showPause(){
  document.getElementById('pauseov').style.display=state.paused?'flex':'none';
  // esconde os controles de toque (que ficam acima do overlay) p/ não cobrir o ranking
  document.body.classList.toggle('paused',state.paused);
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
  if(state.paused){resetInput(true);refreshTopPlayers();} // ranking igual ao da tela inicial
  showPause();
}

// Mapa completo (tecla M / toque no radar): congela o mundo e mostra a visão
// geral com todos os POIs. Ver state.mapOpen e o early-return em main.js.
const fullmapEl=()=>document.getElementById('fullmap');
export function openFullMap(){
  if(state.mapOpen)return;
  if(!state.started||state.mode==='cut'||state.dlgActive||state.cine
    ||state.viewerOpen||state.tvActive||state.paused)return;
  state.mapOpen=true;
  resetInput(true); // não deixa input preso enquanto o mapa está aberto
  fullmapEl()?.classList.add('open');
  document.body.classList.add('map-open'); // esconde os controles de toque
  drawFullMap();
}
export function closeFullMap(){
  if(!state.mapOpen)return;
  state.mapOpen=false;
  fullmapEl()?.classList.remove('open');
  document.body.classList.remove('map-open');
}
export function toggleFullMap(){ state.mapOpen?closeFullMap():openFullMap(); }

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
  if(gymGameActive()){gymGamePress();return;} // mini-game do supino: E/botão = repetição
  if(danceGameActive()){danceGameConfirm();return;} // mini-game da dança: E só avança o resultado
  if(houseTvInteract())return; // ativo: E fecha; perto da TV: E abre
  if(state.dlgActive)return; // cut-scene: legendas correm sozinhas
  if(isBlocked())return;
  if(state.mode==='foot'){
    if(canPickWeapon()){pickupWeapon();return;}
    if(houseEat())return;  // comer da geladeira dentro de casa (cura)
    if(houseBuy())return;  // comprar a casa de campo (perto da placa FOR SALE)
    // supino e dança também são mini-games: bloqueados durante uma sessão (um por vez)
    if(!MiniGame.busy&&gymTrain())return; // treino na academia (perto do supino)
    if(!MiniGame.busy&&clubDance())return; // dança na pista da boate (perto do centro da pista)
    if(refs.gunShopBuy?.())return; // comprar arma no balcão da loja de armas
    // num mini game não dá pra começar outro (um por vez): overkill e zonas travados
    if(!MiniGame.busy&&startOverkill())return; // liga o modo overkill (perto do totem)
    if(refs.rickInteract?.())return; // missão secreta do Rick no acampamento rural
    if(storyInteract())return;
    if(!MiniGame.busy)for(const f of refs.zoneActions||[]){const a=f();if(a&&a.run){a.run();return;}} // minigames de zona (chão)
    enterCar();
  }else if(state.mode==='car'){
    // largar corrida só fora de outra sessão (um por vez)
    if(!MiniGame.busy&&refs.startRaceInteract?.())return; // pórtico de rua
    if(!MiniGame.busy&&refs.startBoatRaceInteract?.())return; // pórtico flutuante de lanchas
    if(!MiniGame.busy&&refs.startOffroadInteract?.())return; // pórtico off-road na pradaria
    if(refs.modShopInteract?.())return; // abrir o menu da oficina de custom na plataforma
    if(houseGaragePark())return; // guardar o carro na garagem da casa comprada
    if(!MiniGame.busy)for(const f of refs.zoneActions||[]){const a=f();if(a&&a.run){a.run();return;}} // minigames de zona (no carro)
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
  // abre a sessão do ranking (não bloqueia o start) e RESTAURA o dinheiro salvo
  // desse jogador (mesmo id + nick), continuando de onde parou.
  startSession().then(saved=>{
    if(saved>0&&state.money<saved){
      state.money=saved;saveBest();
      message('WELCOME BACK - $'+saved.toLocaleString('en-US'),'var(--gold)');
    }
  });
}

// Usado pelo touch-controls: tocar pra jogar abre o modal de nickname.
export function requestStart(){ openNickModal(); }

export function setupInput(){
  const canvas=gameCanvas();
  addEventListener('mousemove',e=>{
    if(document.pointerLockElement!==canvas||!state.started)return;
    // Roda de armas aberta: o mouse mira o setor, não move a câmera.
    if(state.wheelOpen){wheelPointerDelta(e.movementX,e.movementY);return;}
    if(state.paused||state.mapOpen||state.dlgActive)return;
    cameraRig.yaw-=e.movementX*cameraRig.sensitivity;
    cameraRig.pitch+=(cameraRig.invertY?-1:1)*e.movementY*cameraRig.sensitivity;
    cameraRig.pitch=Math.max(.18,Math.min(.82,cameraRig.pitch));
    cameraRig.touchLookIdle=0; // mexeu o mouse: adia o auto-follow atrás do carro
  });
  // Desktop: o 1º clique trava o ponteiro; com o ponteiro travado, segurar o
  // botão esquerdo dispara (e mantém o fogo automático via input.shootHeld).
  // O botão do meio (1) abre/segura a roda de armas (alternativa ao Tab/Q).
  canvas?.addEventListener('mousedown',e=>{
    if(state.mobile||input.touchActive)return;
    if(!state.started||state.dlgActive)return;
    if(document.pointerLockElement!==canvas){lockPointer();return;}
    if(e.button===1){e.preventDefault();openWheel();return;}
    if(e.button!==0||state.wheelOpen)return; // roda aberta: clique não atira
    input.shootHeld=true;
    performShoot();
  });
  addEventListener('mouseup',e=>{
    if(e.button===0)input.shootHeld=false;
    else if(e.button===1&&state.wheelOpen)closeWheel(true); // solta a roda = equipa
  });
  // Roda do mouse: com a roda aberta gira a seleção; a pé (fechada) troca de arma.
  canvas?.addEventListener('wheel',e=>{
    if(!state.started||state.mode!=='foot')return;
    if(state.wheelOpen){e.preventDefault();wheelScroll(e.deltaY>0?1:-1);return;}
    if(isBlocked()||state.dlgActive)return;
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
    if(gymGameActive()){ // mini-game do supino: Espaço/Enter/E/F = repetição, Esc desiste
      if(e.code==='Escape'){closeGymGame();return;}
      // !e.repeat: segurar a tecla NÃO spamma reps (uma rep por toque), igual à dança abaixo
      if(['Space','Enter','KeyE','KeyF'].includes(e.code)){e.preventDefault();if(!e.repeat)gymGamePress();}
      return;
    }
    if(danceGameActive()){ // mini-game da dança: setas tocam as pistas, Esc desiste
      // on the result screen Esc confirms (pays the tip via onFinish); only
      // discards/abandons mid-song. danceGameConfirm() no-ops when no result yet.
      if(e.code==='Escape'){if(!danceGameConfirm())closeDanceGame();return;}
      const lane={ArrowLeft:0,ArrowDown:1,ArrowUp:2,ArrowRight:3}[e.code];
      if(lane!==undefined){if(!e.repeat){e.preventDefault();pressLane(lane);}return;}
      if(['Space','Enter','KeyE','KeyF'].includes(e.code)){e.preventDefault();danceGameConfirm();}
      return;
    }
    if(modShopActive()){ // menu da oficina: Esc/E/F fecham; o resto é clique no menu
      if(['Escape','KeyE','KeyF'].includes(e.code))closeModShop();
      return;
    }
    if(state.tvActive){
      // Moto-TV: ESC é o ÚNICO atalho que sai (este handler só roda enquanto o
      // PAI tem foco — antes de clicar no iframe; com o iframe focado as teclas
      // vão pro andre-os e a saída por ESC vem do fullscreenchange em house-tv).
      if(e.code==='Escape'){e.preventDefault();closeHouseTv();}
      return; // demais teclas: ignoradas no jogo (são "da TV")
    }
    if(e.code==='KeyI'){toggleModelViewer();return;}
    if(e.code==='Escape'&&state.viewerOpen){closeModelViewer();return;}
    if(!state.started)return;
    if(state.dlgActive)return; // cut-scene: nada de pular falas
    // Roda de armas aberta: Esc cancela; demais atalhos ficam congelados (mas as
    // teclas de movimento já entraram em keys[] acima, então andar continua).
    if(state.wheelOpen){if(e.code==='Escape')closeWheel(false);return;}
    // Mapa completo aberto: só M/Esc o fecham; o resto dos atalhos fica congelado
    if(state.mapOpen){if(e.code==='KeyM'||e.code==='Escape')closeFullMap();return;}
    if(e.code==='KeyM'){toggleFullMap();return;}
    if(e.code==='KeyP'){performPauseToggle();return;}
    if(e.code==='KeyF'&&e.shiftKey){performFullscreenToggle();return;}
    if(e.code==='KeyR'){performRadioSwitch();return;} // rádio saiu do Tab (agora da roda de armas)
    if(/^Digit[0-9]$/.test(e.code)){selectWeaponSlot(e.code==='Digit0'?10:+e.code.slice(5));return;}
    // Roda de armas: TAB é o padrão de mercado (GTA V); Q segue valendo de alternativa.
    if(e.code==='Tab'||e.code==='KeyQ'){if(!e.repeat)openWheel();return;} // segurar abre a roda; soltar equipa (keyup)
    // !e.repeat: segurar E/F NÃO repete a interação. Sem isso, manter a tecla
    // pressionada dispararia os DOIS toques da confirmação da loja de armas em
    // sequência (1º pede CONFIRM, o auto-repeat já compra) — a compra passaria
    // sem a confirmação. Uma interação por toque, igual ao supino/dança/roda.
    if(e.code==='KeyE'||e.code==='KeyF'){if(!e.repeat)performInteract();return;}
  });

  addEventListener('keyup',e=>{
    keys[e.code]=false;
    if((e.code==='Tab'||e.code==='KeyQ')&&state.wheelOpen)closeWheel(true); // soltou Tab/Q: equipa a arma destacada
  });

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
  // Mapa completo: X fecha; tocar/clicar no radar abre (acesso no celular, sem tecla M)
  document.getElementById('fm-close')?.addEventListener('click',e=>{e.stopPropagation();closeFullMap();});
  document.getElementById('mapwrap')?.addEventListener('pointerdown',e=>{
    if(!state.started)return;
    e.preventDefault();e.stopPropagation();
    toggleFullMap();
  });
}
