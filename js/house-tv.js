import * as THREE from 'three';
import {state,input,keys} from './state.js';
import {camera} from './engine.js';
import {player,playerPos,cameraRig} from './player.js';
import {TV,ranchInterior} from '../assets/models/rural/ranch-house.js';

const URL='https://andredarcie.github.io/andre-os/';
const RANGE=2.4;
let active=false,prevControlsLocked=false,prevFov=62,prevPlayerVisible=true,loaded=false;

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
  if(frame&&!loaded){frame.src=URL;loaded=true;}
  overlay?.classList.add('open');
  overlay?.setAttribute('aria-hidden','false');
  frameCamera();
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

addEventListener('blur',()=>{
  // O iframe cross-origin pode tomar foco de teclado ao receber clique. Mantém
  // o foco no jogo para o comando E/F continuar disponível; mouse/toque seguem
  // funcionando dentro do iframe.
  if(active)setTimeout(()=>window.focus(),0);
});
