import * as THREE from 'three';
import {state,input,keys} from './state.js';
import {camera} from './engine.js';
import {player,playerPos,cameraRig} from './player.js';
import {TV,ranchInterior} from '../assets/models/rural/ranch-house.js';

const URL='https://andredarcie.github.io/andre-os/';
const TV_ORIGIN=(()=>{try{return new window.URL(URL).origin;}catch(_){return '';}})();
const RANGE=2.4;
let active=false,prevControlsLocked=false,prevFov=62,prevPlayerVisible=true,loaded=false,fsOwned=false;

const $=id=>document.getElementById(id);

function zeroInput(){
  input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;
  input.run=false;input.brake=false;input.horn=false;input.shootHeld=false;
  input.moveActive=false;input.lookActive=false;input.brakeActive=false;input.hornActive=false;
  for(const k of Object.keys(keys))keys[k]=false;
}

function nearTv(){
  if(active)return true;
  if(state.mode!=='foot'||state.interior?.group!==ranchInterior)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-TV.x,pp.z-TV.z)<RANGE;
}

function frameCamera(){
  // Primeira pessoa sentada no sofá, olhando para a tela da TV.
  player.g.visible=false;
  const eye=new THREE.Vector3(TV.x,1.55,TV.z+2.35);
  const target=new THREE.Vector3(TV.x,TV.y,TV.z+.05);
  camera.position.copy(eye);
  camera.lookAt(target);
  camera.fov+=(42-camera.fov)*.8;
  camera.updateProjectionMatrix();
  cameraRig.yaw=Math.PI;
}

// ---- Fullscreen helpers ----------------------------------------------------
// A TV é um iframe CROSS-ORIGIN (em produção: itch.io = sandbox; no GitHub Pages
// é mesma origem). Para o iframe receber TODO o teclado de verdade ele precisa
// ter o FOCO nativo do browser — e aí o pai fica cego para as teclas, inclusive
// o ESC. A saída robusta para o "ESC sai da moto-TV" mesmo cross-origin é abrir
// em fullscreen: o ESC sai do fullscreen e dispara fullscreenchange no PAI
// (evento de nível de browser, não depende do foco), e nós fechamos a TV.
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
function reqFs(){
  if(fsEl())return; // já em fullscreen (ex.: celular) — não mexe, não é "nosso"
  const el=document.documentElement;
  const fn=el.requestFullscreen||el.webkitRequestFullscreen;
  if(!fn)return;
  fsOwned=true; // marca a INTENÇÃO; quem limpa é onFsChange/closeHouseTv
  try{const r=fn.call(el);r&&r.catch&&r.catch(()=>{fsOwned=false;});}catch(_){fsOwned=false;}
}
function exitFs(){
  const fn=document.exitFullscreen||document.webkitExitFullscreen;
  try{fn&&fn.call(document);}catch(_){}
}

// Joga o foco do teclado pra dentro do iframe (é assim — e só assim, cross-origin
// — que o andre-os passa a receber todas as teclas que o usuário digitar).
function focusFrame(){
  if(!active)return;
  const frame=$('house-tv-frame');
  if(!frame)return;
  try{frame.focus({preventScroll:true});}catch(_){}
  try{frame.contentWindow?.focus();}catch(_){}
}

// Bônus SAME-ORIGIN (GitHub Pages): se conseguirmos acessar o documento do
// iframe, capturamos o ESC de dentro dele direto. Em cross-origin (itch/local)
// o acesso lança SecurityError e é ignorado — o fullscreen cobre esse caso.
function onFrameLoad(){
  focusFrame();
  try{
    const w=$('house-tv-frame').contentWindow;
    if(w&&!w.__tvEscBound){
      w.__tvEscBound=true;
      w.addEventListener('keydown',e=>{
        if(active&&(e.code==='Escape'||e.key==='Escape')){
          e.preventDefault();e.stopPropagation();closeHouseTv();
        }
      },true);
    }
  }catch(_){/* iframe cross-origin: sem acesso, segue o fullscreen */}
}

export function openHouseTv(){
  if(active||!nearTv())return false;
  active=true;state.tvActive=true;
  prevControlsLocked=state.controlsLocked;
  prevFov=camera.fov;
  prevPlayerVisible=player.g.visible;
  state.controlsLocked=true;
  player.g.visible=false;
  zeroInput();
  document.exitPointerLock?.();
  document.body.classList.add('house-tv-open');
  const overlay=$('house-tv');
  const frame=$('house-tv-frame');
  if(frame&&!loaded){
    frame.src=URL;
    loaded=true;
    frame.addEventListener('load',onFrameLoad);
  }
  overlay?.classList.add('open');
  overlay?.setAttribute('aria-hidden','false');
  frameCamera();
  // Fullscreen é o gatilho cross-origin do ESC (ver bloco de helpers acima). A
  // chamada vem de um gesto do usuário (tecla E / toque), então é permitida.
  reqFs();
  // Foco no iframe pra ele receber o teclado. Refaz num tick (a transição de
  // fullscreen pode tirar o foco) — e o onFsChange refoca ao entrar em FS.
  focusFrame();
  setTimeout(focusFrame,60);
  return true;
}

export function closeHouseTv(){
  if(!active)return false;
  active=false;state.tvActive=false;
  state.controlsLocked=prevControlsLocked;
  player.g.visible=prevPlayerVisible;
  zeroInput();
  document.body.classList.remove('house-tv-open');
  $('house-tv')?.classList.remove('open');
  $('house-tv')?.setAttribute('aria-hidden','true');
  camera.fov=prevFov;camera.updateProjectionMatrix();
  // Só desfaz o fullscreen que NÓS abrimos (não o do celular). Se o pedido ainda
  // não engatou (em voo), mantém fsOwned: o onFsChange desfaz quando engatar.
  if(fsOwned&&fsEl())exitFs();
  if(state.started&&!state.mobile&&!input.touchActive)document.getElementById('game')?.requestPointerLock?.();
  return true;
}

export function houseTvInteract(){
  if(active)return closeHouseTv();
  return openHouseTv();
}

export function houseTvState(){
  if(active)return{label:'EXIT',prompt:'EXIT TV',enabled:true};
  if(!nearTv())return null;
  return{label:'TV',prompt:'USE TV',enabled:true};
}

export function updateHouseTv(){
  if(!active)return false;
  zeroInput();
  frameCamera();
  return true;
}

export function getHouseTvState(){
  return{active,url:URL,near:nearTv()};
}

$('house-tv-exit')?.addEventListener('pointerdown',e=>{
  e.preventDefault();
  e.stopPropagation();
  closeHouseTv();
});

// ESC sai do fullscreen -> este evento é a saída da moto-TV mesmo com o iframe
// cross-origin segurando o foco do teclado.
function onFsChange(){
  if(fsEl()){              // ENTROU em fullscreen
    if(active)focusFrame();// a transição rouba o foco; devolve pro iframe
    else if(fsOwned)exitFs(); // a TV fechou antes do FS engatar: desfaz o órfão
    return;
  }
  fsOwned=false;          // SAIU do fullscreen
  if(active)closeHouseTv(); // ESC = sair da moto-TV
}
addEventListener('fullscreenchange',onFsChange);
addEventListener('webkitfullscreenchange',onFsChange);

// Gancho opcional: o próprio andre-os pode pedir pra sair da TV mandando
// postMessage('tv-exit') (ou {type:'tv-exit'}). Aceita só da origem da TV.
addEventListener('message',e=>{
  if(!active||(TV_ORIGIN&&e.origin!==TV_ORIGIN))return;
  const d=e.data;
  if(d==='tv-exit'||d?.type==='tv-exit')closeHouseTv();
});
