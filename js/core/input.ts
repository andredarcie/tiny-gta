import {state,keys,input,refs} from '@/core/state.ts';
import {initAudio,AC} from '@/audio/audio.ts';
import {radioSwitch} from '@/ui/radio.ts';
import {enterCar,exitCar,cur,player,cameraRig,toggleFirstPerson,applyMouseLook} from '@/actors/player.ts';
import {storyInteract,advanceCine} from '@/story/story.ts';
import {gymTrain} from '@/places/gym.ts';
import {gymGameActive,gymGamePress,closeGymGame} from '@/places/gym-game.ts';
import {clubDance} from '@/places/club.ts';
import {danceGameActive,closeDanceGame,pressLane,danceGameConfirm} from '@/places/dance-game.ts';
import {modShopActive,closeModShop} from '@/places/mod-shop.ts';
import {houseBuy,houseEat,houseGaragePark} from '@/places/property.ts';
import {houseTvInteract,closeHouseTv} from '@/places/house-tv.ts';
import {startOverkill} from '@/combat/overkill.ts';
import {setMissionHUD} from '@/story/missions.ts';
import {message,drawFullMap,toggleMapNpcs} from '@/ui/hud.ts';
import {canPickWeapon,pickupWeapon,shootWeapon,switchWeapon,selectWeaponSlot} from '@/combat/weapons.ts';
import {openWheel,closeWheel,wheelScroll,wheelPointerDelta} from '@/combat/weapon-wheel.ts';
import {toggleModelViewer,closeModelViewer} from '@/ui/model-viewer.ts';
import {toggleAdmin,closeAdmin,isAdmin} from '@/ui/admin.ts';
import {getNickname,setNickname,startSession,refreshTopPlayers,accountRequest,checkNameRegistered} from '@/ui/leaderboard.ts';
import {applySave} from '@/core/save.ts';
import {hasProfanity} from '@/core/profanity.ts';
import {MiniGame} from '@/activities/minigame.ts';
import {openPauseMenu,closePauseMenu,pauseBack} from '@/ui/pause-menu.ts';
import {applySettings} from '@/core/settings.ts';

const gameCanvas=(): HTMLElement | null=>document.getElementById('game');
const isBlocked=(): boolean=>state.paused||state.mapOpen||state.wheelOpen||state.mode==='cut'||state.orientationBlocked||state.controlsLocked;

function lockPointer(): void {
  if(state.mobile||input.touchActive)return;
  gameCanvas()?.requestPointerLock?.();
}

export function resetInput(keepTouch=false): void {
  input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;
  input.run=false;input.brake=false;input.horn=false;input.shootHeld=false;
  input.moveActive=false;input.lookActive=false;input.brakeActive=false;input.hornActive=false;
  if(!keepTouch)input.touchActive=false;
}

export function updateKeyboardInput(): void {
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

export function performShoot(): void {
  if(isBlocked()||state.dlgActive)return;
  shootWeapon();
}

export function performRadioSwitch(): void {
  if(isBlocked()||state.dlgActive)return;
  radioSwitch();
}

export function performPauseToggle(): void {
  if(!state.started||state.mode==='cut')return;
  state.paused=!state.paused;
  if(state.paused){resetInput(true);openPauseMenu();} // builds the menu (own leaderboard fetch)
  else closePauseMenu();
}

// Android hardware "back" button. Mirrors the keydown Escape precedence so back
// closes whatever overlay is open (mini-game, map, weapon wheel, TV, …) before
// falling back to pause. Returns 'exit' only at the very top (title/nick screen)
// so the native shell can leave the app; otherwise 'consumed'. See js/core/native.ts.
export function performBack(): 'exit' | 'consumed' {
  if(state.cine)return 'consumed';                                        // cut-scene: ignore back
  if(gymGameActive()){closeGymGame();return 'consumed';}
  if(danceGameActive()){if(!danceGameConfirm())closeDanceGame();return 'consumed';}
  if(modShopActive()){closeModShop();return 'consumed';}
  if(state.tvActive){closeHouseTv();return 'consumed';}
  if(state.viewerOpen){closeModelViewer();return 'consumed';}
  const nick=document.getElementById('nickmodal');
  if(nick?.classList.contains('open')){nick.classList.remove('open');return 'consumed';}
  if(!state.started)return 'exit';                                        // title screen: allow exit
  if(state.dlgActive)return 'consumed';                                   // cut-scene dialogue
  if(state.wheelOpen){closeWheel(false);return 'consumed';}
  if(state.mapOpen){closeFullMap();return 'consumed';}
  if(state.adminOpen){closeAdmin();return 'consumed';}                    // admin dashboard (Y)
  if(state.paused&&pauseBack())return 'consumed';                        // pause sub-panel -> main menu
  performPauseToggle();                                                   // gameplay: pause / unpause
  return 'consumed';
}

// Mapa completo (tecla M / toque no radar): congela o mundo e mostra a visão
// geral com todos os POIs. Ver state.mapOpen e o early-return em main.js.
const fullmapEl=(): HTMLElement | null=>document.getElementById('fullmap');
export function openFullMap(): void {
  if(state.mapOpen)return;
  if(!state.started||state.mode==='cut'||state.dlgActive||state.cine
    ||state.viewerOpen||state.tvActive||state.paused)return;
  state.mapOpen=true;
  resetInput(true); // não deixa input preso enquanto o mapa está aberto
  fullmapEl()?.classList.add('open');
  document.body.classList.add('map-open'); // esconde os controles de toque
  drawFullMap();
}
export function closeFullMap(): void {
  if(!state.mapOpen)return;
  state.mapOpen=false;
  fullmapEl()?.classList.remove('open');
  document.body.classList.remove('map-open');
}
export function toggleFullMap(): void { state.mapOpen?closeFullMap():openFullMap(); }

export function performFullscreenToggle(): void {
  if(document.fullscreenElement){
    document.exitFullscreen?.();
    return;
  }
  const fs=document.documentElement.requestFullscreen?.();
  fs?.catch?.(()=>{});
}

export function performInteract(): void {
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
    if(refs.clothesShopInteract?.())return; // abrir o provador (menu de roupas) na loja de roupas
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

// Development is PAUSED: the public build shows a "DEVELOPMENT PAUSED" title and cannot be
// played — every path into gameplay is blocked here. The localhost dev shortcut still starts
// (so the Playwright harness + local testing keep working). Flip DEV_PAUSED to false to resume.
const ON_LOCALHOST=typeof location!=='undefined'&&['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname);
const DEV_PAUSED=true;
export function startGameFromUserGesture(opts: {mobile?: boolean}={}): void {
  if(DEV_PAUSED&&!ON_LOCALHOST)return;   // public build is paused — no path enters the game
  if(state.started)return;
  const mobile=!!opts.mobile;
  if(mobile){
    state.mobile=true;
    input.touchActive=true;
    input.lastInput='touch';
    document.body.classList.add('is-mobile');
  }
  initAudio();AC?.resume?.();
  applySettings(); // now that the audio graph exists, push the saved master/music volumes into it
  document.getElementById('title')!.style.display='none';
  document.getElementById('hud')!.style.display='block';
  document.body.classList.add('playing'); // reveals the in-game pause button (hidden on title)
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

const isMobileEnv=(): boolean=>state.mobile||matchMedia('(pointer: coarse)').matches;

// Abre o modal de nickname/login (passo antes de iniciar a partida).
function openNickModal(): void {
  if(state.started)return;
  const inp=document.getElementById('nick-input') as HTMLInputElement | null;
  if(inp)inp.value=getNickname();
  setNickStatus('');
  document.getElementById('nickmodal')?.classList.add('open');
  setTimeout(()=>inp?.focus(),60);
}

// Lê o apelido do campo já saneado (mesma regra do servidor).
function readNick(): string {
  const inp=document.getElementById('nick-input') as HTMLInputElement | null;
  return (inp?.value||'').toUpperCase().replace(/[^A-Z0-9 _-]/g,'').replace(/\s+/g,' ').trim().slice(0,12);
}
// Linha de status do modal (erro em vermelho, ok em ciano).
function setNickStatus(msg: string,ok?: boolean): void {
  const el=document.getElementById('nick-status');
  if(el){el.textContent=msg||'';el.classList.toggle('ok',!!ok);}
}
function nickShake(): void {
  const inp=document.getElementById('nick-input');
  inp?.classList.add('err');setTimeout(()=>inp?.classList.remove('err'),350);
}

// Fecha o modal e ENTRA na partida. Este caminho roda dentro do clique/tap do
// usuário (gesto), então vale pra áudio/fullscreen/pointer-lock. Abre a sessão do
// ranking (não bloqueia o start) e RESTAURA o save: dinheiro, armas, casa, etc.
//
// IDEMPOTENTE (guarda por state.started): os botões LOG IN / CREATE ACCOUNT /
// convidado + Enter ficam todos ativos durante o accountRequest assíncrono, então
// um duplo-toque (comum no celular) chamava beginRun 2x → 2x startSession/applySave.
// O 2º applySave reaplicava o "gap" sobre o saldo já restaurado e DOBRAVA o dinheiro.
function beginRun(): void {
  if(state.started)return; // já entrou na partida: 2º toque não reabre sessão nem re-restaura
  document.getElementById('nickmodal')?.classList.remove('open');
  startGameFromUserGesture({mobile:isMobileEnv()});
  startSession().then(save=>{
    if(!save)return;
    applySave(save);
    if((save.money as number)>0)message('WELCOME BACK - $'+Math.floor(save.money as number).toLocaleString('en-US'),'var(--gold)');
  });
}

// Jogar como CONVIDADO: fluxo anônimo (pid no localStorage, sem conta). Antes de
// entrar, confere no backend se o apelido já é de uma CONTA cadastrada — um
// convidado NÃO pode usar o apelido de outra pessoa (senão herdaria o dinheiro/save
// dela). Se estiver cadastrado, manda fazer LOG IN com senha ou escolher outro nome.
async function playAsGuest(): Promise<void> {
  const name=readNick();
  if(!name||hasProfanity(name)){nickShake();setNickStatus('Pick a valid nickname.');return;}
  setNickStatus('Checking nickname…',true);
  if(await checkNameRegistered(name)){
    nickShake();
    setNickStatus('That nickname belongs to an account. LOG IN with your password, or pick another name.');
    return;
  }
  setNickname(name);
  beginRun();
}

// Mensagens amigáveis pros códigos de erro do /api/account.
const ACCT_ERR: Record<string, string>={
  taken:'Nickname already registered — use LOG IN.',
  invalid_credentials:'Wrong nickname or password.', // genérico (não revela se o nick existe)
  rate_limited:'Too many tries — wait a moment.',
  invalid_password:'Password must be 4+ characters.',
  invalid_name:'Pick a valid nickname.',
  network:'Network error — try again.',
  name_registered:'That nickname belongs to an account. LOG IN with your password.',
};

// CRIAR CONTA ou ENTRAR: valida local, resolve a conta no backend (adota pid+nick)
// e só então entra na partida. Erros aparecem no status, sem iniciar o jogo.
async function doAccount(action: string): Promise<void> {
  const name=readNick();
  const pass=(document.getElementById('nick-pass') as HTMLInputElement | null)?.value||'';
  if(!name||hasProfanity(name)){nickShake();setNickStatus('Pick a valid nickname.');return;}
  if(pass.length<4){setNickStatus('Password must be 4+ characters.');return;}
  setNickStatus(action==='register'?'Creating account…':'Logging in…',true);
  const res=await accountRequest(action,name,pass);
  if(!res.ok){setNickStatus(ACCT_ERR[res.error]||ACCT_ERR.network);return;}
  beginRun();
}

// Usado pelo touch-controls: tocar pra jogar abre o modal de nickname.
export function requestStart(): void { openNickModal(); }

export function setupInput(): void {
  const canvas=gameCanvas();
  addEventListener('mousemove',(e: MouseEvent)=>{
    if(document.pointerLockElement!==canvas||!state.started)return;
    // Roda de armas aberta: o mouse mira o setor, não move a câmera.
    if(state.wheelOpen){wheelPointerDelta(e.movementX,e.movementY);return;}
    if(state.paused||state.mapOpen||state.dlgActive)return;
    // Routed through player.js so the delta drives the correct pitch (wide FP look
    // when first-person is active, the third-person orbit pitch otherwise).
    applyMouseLook(e.movementX,e.movementY);
  });
  // Desktop: o 1º clique trava o ponteiro; com o ponteiro travado, segurar o
  // botão esquerdo dispara (e mantém o fogo automático via input.shootHeld).
  // O botão do meio (1) abre/segura a roda de armas (alternativa ao Tab/Q).
  canvas?.addEventListener('mousedown',(e: MouseEvent)=>{
    if(state.mobile||input.touchActive)return;
    if(!state.started||state.dlgActive)return;
    if(document.pointerLockElement!==canvas){lockPointer();return;}
    if(e.button===1){e.preventDefault();openWheel();return;}
    if(e.button===2){e.preventDefault();refs.toggleAim?.();return;} // right mouse toggles aim mode
    if(e.button!==0||state.wheelOpen)return; // roda aberta: clique não atira
    input.shootHeld=true;
    performShoot();
  });
  addEventListener('mouseup',(e: MouseEvent)=>{
    if(e.button===0)input.shootHeld=false;
    else if(e.button===1&&state.wheelOpen)closeWheel(true); // solta a roda = equipa
  });
  canvas?.addEventListener('contextmenu',e=>e.preventDefault()); // right mouse is "aim", not the browser menu
  // Roda do mouse: com a roda aberta gira a seleção; a pé (fechada) troca de arma.
  canvas?.addEventListener('wheel',(e: WheelEvent)=>{
    if(!state.started||state.mode!=='foot')return;
    if(state.wheelOpen){e.preventDefault();wheelScroll(e.deltaY>0?1:-1);return;}
    if(isBlocked()||state.dlgActive)return;
    e.preventDefault();
    switchWeapon(e.deltaY>0?1:-1);
  },{passive:false});

  // Cut-scene: clique (PC) ou toque na tela (celular) também avança o diálogo.
  // O botão que ABRE a cena dá stopPropagation, então não vaza pra cá e não
  // pula a primeira fala. Só roda durante a cena.
  addEventListener('pointerdown',(e: PointerEvent)=>{
    if(state.cine){e.preventDefault();advanceCine();}
  });

  addEventListener('keydown',(e: KeyboardEvent)=>{
    // Digitando num campo (ex.: modal de nickname): não captura atalhos globais.
    const t=e.target as (HTMLElement | null);
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
      const lane=({ArrowLeft:0,ArrowDown:1,ArrowUp:2,ArrowRight:3} as Record<string, number>)[e.code];
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
    // Dashboard de admin aberto: só Y/Esc fecham; o resto congela (cliques no modal).
    if(state.adminOpen){if(e.code==='KeyY'||e.code==='Escape')closeAdmin();return;}
    // Pause menu open: Esc backs out of a sub-panel (or unpauses at the main menu),
    // P toggles pause, and every other shortcut is swallowed so gameplay keys are
    // inert while the menu is up.
    if(state.paused){
      if(e.code==='Escape'){if(!pauseBack())performPauseToggle();return;}
      if(e.code==='KeyP'){performPauseToggle();return;}
      return;
    }
    if(e.code==='KeyM'){toggleFullMap();return;}
    if(e.code==='KeyY'&&isAdmin()){toggleAdmin();return;} // painel do dono (só 'REI')
    if(e.code==='KeyP'){performPauseToggle();return;}
    if(e.code==='KeyF'&&e.shiftKey){performFullscreenToggle();return;}
    if(e.code==='KeyR'){performRadioSwitch();return;} // rádio saiu do Tab (agora da roda de armas)
    if(e.code==='KeyC'){toggleFirstPerson();return;}  // alterna câmera em primeira pessoa
    if(/^Digit[0-9]$/.test(e.code)){selectWeaponSlot(e.code==='Digit0'?10:+e.code.slice(5));return;}
    // Roda de armas: TAB é o padrão de mercado (open-world); Q segue valendo de alternativa.
    if(e.code==='Tab'||e.code==='KeyQ'){if(!e.repeat)openWheel();return;} // segurar abre a roda; soltar equipa (keyup)
    // !e.repeat: segurar E/F NÃO repete a interação. Sem isso, manter a tecla
    // pressionada dispararia os DOIS toques da confirmação da loja de armas em
    // sequência (1º pede CONFIRM, o auto-repeat já compra) — a compra passaria
    // sem a confirmação. Uma interação por toque, igual ao supino/dança/roda.
    if(e.code==='KeyE'||e.code==='KeyF'){if(!e.repeat)performInteract();return;}
  });

  addEventListener('keyup',(e: KeyboardEvent)=>{
    keys[e.code]=false;
    if((e.code==='Tab'||e.code==='KeyQ')&&state.wheelOpen)closeWheel(true); // soltou Tab/Q: equipa a arma destacada
  });

  addEventListener('blur',()=>resetInput(true));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)resetInput(true);
  });

  // Iniciar passa pelo modal de nickname (o nick vai pro ranking global).
  refreshTopPlayers();
  document.getElementById('play')?.addEventListener('click',(e: MouseEvent)=>{e.stopPropagation();openNickModal();});
  document.getElementById('nick-register')?.addEventListener('click',()=>doAccount('register'));
  document.getElementById('nick-login')?.addEventListener('click',()=>doAccount('login'));
  document.getElementById('nick-guest')?.addEventListener('click',playAsGuest);
  // Enter em qualquer campo: faz LOGIN (caminho mais comum de quem volta).
  const nickEnter=(e: KeyboardEvent): void=>{ if(e.key==='Enter'){e.preventDefault();doAccount('login');} };
  document.getElementById('nick-input')?.addEventListener('keydown',nickEnter);
  document.getElementById('nick-pass')?.addEventListener('keydown',nickEnter);

  // Dev shortcut: on localhost, skip the whole title/login screen and jump
  // straight into the game with a fixed nickname. Deferred to a macrotask so the
  // rest of boot (pause menu, touch, wheel, settings) finishes first — then we
  // start exactly as a "Play as guest" click would. Pointer-lock/audio simply
  // engage on the first click, same as any auto-started page. LAN access (phone
  // testing via the host IP) is NOT localhost, so it keeps the normal login.
  const onLocalhost=['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname);
  if(onLocalhost){
    setTimeout(()=>{ if(!state.started){ setNickname('localhost'); beginRun(); } },0);
  }
  // Top-center button: opens/closes the in-game pause menu (only shown while playing).
  document.getElementById('btn-fullscreen')?.addEventListener('pointerdown',(e: PointerEvent)=>{
    e.preventDefault();
    e.stopPropagation();
    performPauseToggle();
  });
  // Resume / fullscreen are driven from inside the pause menu (js/ui/pause-menu.ts) via
  // late-bound refs, so it never has to import this module (which imports it).
  refs.togglePause=performPauseToggle;
  refs.toggleFullscreen=performFullscreenToggle;
  refs.openFullMap=openFullMap; // pause menu → INFO → MAP opens the full-map overlay

  // Mapa completo: X fecha; tocar/clicar no radar abre (acesso no celular, sem tecla M)
  document.getElementById('fm-close')?.addEventListener('click',(e: MouseEvent)=>{e.stopPropagation();closeFullMap();});
  // "Show NPCs" toggle: live dots + path trails for every outdoor NPC (the world
  // keeps simulating while it is on — see main.js — so the dots move in real time).
  document.getElementById('fm-npcs')?.addEventListener('click',(e: MouseEvent)=>{
    e.stopPropagation();
    const on=toggleMapNpcs();
    const btn=e.currentTarget as HTMLButtonElement;
    btn.classList.toggle('on',on);
    btn.setAttribute('aria-pressed',String(on));
    btn.textContent=on?'HIDE NPCS':'SHOW NPCS';
    drawFullMap();
  });
  document.getElementById('mapwrap')?.addEventListener('pointerdown',(e: PointerEvent)=>{
    if(!state.started)return;
    e.preventDefault();e.stopPropagation();
    toggleFullMap();
  });
}
