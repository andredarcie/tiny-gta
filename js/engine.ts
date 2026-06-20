import * as THREE from 'three';
import {makeSea} from '../assets/models/environment/sea.js';
import {makeClouds} from '../assets/models/environment/clouds.js';

export const canvas=document.getElementById('game') as HTMLCanvasElement;
export const renderer=new THREE.WebGLRenderer({canvas,antialias:true,
  powerPreference:'high-performance'});
const isMobileLike=()=>matchMedia('(pointer: coarse)').matches||innerWidth<900;
const viewportSize=()=>({
  w:Math.round(window.visualViewport?.width||innerWidth),
  h:Math.round(window.visualViewport?.height||innerHeight)
});
// Teto do pixel ratio. Desktop também limitado a 1.5 (era 2): em telas HiDPI
// (DPR≥2) renderizar a 2x = 4x os pixels, e ao varrer a câmera pela cidade o
// custo de fill-rate/overdraw estourava (medido: pico de 175ms, ~70fps girando).
// A 1.5x fica suave (pico ~29ms) e, com antialias, ainda nítido. Telas com DPR
// ≤1.5 (a maioria dos desktops) não mudam nada — Math.min preserva o DPR real.
function pixelRatioLimit(){return 1.5;}
const initialSize=viewportSize();
// Resolução adaptativa: basePR é o teto pelo DPR do aparelho; renderScale
// (0.72..1) é ajustado em runtime por adaptResolution() (main.js) pra segurar a
// taxa de atualização sob carga. Com folga de GPU fica em 1.0 — ou seja, ZERO
// mudança visual quando a máquina dá conta; só reduz a resolução interna quando
// os frames passam a cair, e mesmo assim com piso alto (antialias mantém nítido).
let basePR=Math.min(devicePixelRatio,pixelRatioLimit());
let renderScale=1;
renderer.setPixelRatio(basePR*renderScale);
renderer.setSize(initialSize.w,initialSize.h);
export function setRenderScale(s:number){
  s=Math.max(.72,Math.min(1,s));
  if(Math.abs(s-renderScale)<.015)return false;
  renderScale=s;
  renderer.setPixelRatio(basePR*renderScale);
  return true;
}
export const getRenderScale=()=>renderScale;

// --- Player-facing graphics toggles (driven by js/settings.js / the pause menu) ---
// Shadows: the shadow map is throttled (autoUpdate=false; main.js flags needsUpdate
// every ~12 frames). Flipping `enabled` off stops the shadow pass entirely; flipping
// it back on, plus a one-shot needsUpdate, repaints the depth map on the next frame.
export function setShadowsEnabled(on:boolean){
  renderer.shadowMap.enabled=!!on;
  renderer.shadowMap.needsUpdate=true;
}
// Brightness maps to the ACES tone-mapping exposure (default 1.25; see below).
export function setBrightness(exposure:number){
  renderer.toneMappingExposure=Math.max(.1,Number(exposure)||1.25);
}

renderer.shadowMap.enabled=true;
// PCF simples: o PCFSoft fazia várias leituras extras da shadow map por pixel
renderer.shadowMap.type=THREE.PCFShadowMap;
// Sombra throttlada: a luz direcional é fixa (só a POSIÇÃO segue o jogador),
// então o depth map não precisa ser redesenhado todo frame. main.js liga
// needsUpdate 1 frame sim / 1 não (~30fps de sombra), cortando ~metade do
// shadow pass — que é um 2º render da cena inteira por frame.
renderer.shadowMap.autoUpdate=false;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;

export const scene=new THREE.Scene();
scene.fog=new THREE.Fog(0xcfe2ee,120,430);
export const camera=new THREE.PerspectiveCamera(62,initialSize.w/initialSize.h,.1,2000);
camera.position.set(0,60,120);
// The camera is part of the scene graph so objects parented to it render — used by
// the first-person weapon viewmodel (js/weapons.js), which hangs the held gun off
// the camera. A camera with no children just traverses as an empty node otherwise.
scene.add(camera);

export function resizeRenderer(){
  const {w,h}=viewportSize();
  basePR=Math.min(devicePixelRatio,pixelRatioLimit());
  renderer.setPixelRatio(basePR*renderScale); // preserva o renderScale atual
  camera.aspect=w/h;camera.updateProjectionMatrix();
  renderer.setSize(w,h);
}

addEventListener('resize',resizeRenderer);
addEventListener('orientationchange',resizeRenderer);
window.visualViewport?.addEventListener?.('resize',resizeRenderer);

// Céu, sol, lua e estrelas vivem em daynight.js (ciclo de dia e noite)

export const hemi=new THREE.HemisphereLight(0xbfdfff,0x8a8078,1.05);scene.add(hemi);
export const sunDir=new THREE.Vector3(-.45,.9,-.55).normalize();
export const dlight=new THREE.DirectionalLight(0xfff1d6,2.2);
dlight.castShadow=true;
// Resolução reduzida do shadow map (era 1024/2048): sombra mais "blocky", mais barata.
dlight.shadow.mapSize.set(isMobileLike()?512:1024,isMobileLike()?512:1024);
// Frustum mais apertado (era ±95): foca a sombra perto do jogador, melhora a
// densidade de texel e reduz a área rasterizada no shadow pass.
dlight.shadow.camera.left=-80;dlight.shadow.camera.right=80;
dlight.shadow.camera.top=80;dlight.shadow.camera.bottom=-80;
dlight.shadow.camera.far=420;dlight.shadow.bias=-.0015;
scene.add(dlight);scene.add(dlight.target);

// O mar é um disco GIGANTE (raio 1400) centrado na origem — ele se estende por
// baixo da região dos ambientes internos (que vivem ~600m fora do mapa).
// Fica exportado porque js/interior.js esconde as camadas externas enquanto
// qualquer interior está ativo.
export const sea=makeSea();scene.add(sea);

export const clouds:THREE.Sprite[]=[];
{
  clouds.push(...makeClouds(10));
  for(const sp of clouds)scene.add(sp);
}
