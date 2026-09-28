import * as THREE from 'three';
import {EffectComposer,RenderPass,EffectPass,BloomEffect,ToneMappingEffect,ToneMappingMode,SMAAEffect,SMAAPreset} from 'postprocessing';
import {N8AOPostPass} from 'n8ao';
import {makeSea} from '../../assets/models/environment/sea.ts';
import {makeClouds} from '../../assets/models/environment/clouds.ts';

export const canvas=document.getElementById('game') as HTMLCanvasElement;
export const renderer=new THREE.WebGLRenderer({canvas,antialias:true,
  powerPreference:'high-performance'});
const isMobileLike=()=>matchMedia('(pointer: coarse)').matches||innerWidth<900;
const viewportSize=()=>({
  w:Math.round(window.visualViewport?.width||innerWidth),
  h:Math.round(window.visualViewport?.height||innerHeight)
});
// Teto do pixel ratio. Desktop limitado a 1.5: em telas HiDPI (DPR≥2) renderizar a 2x =
// 4x os pixels, e ao varrer a câmera pela cidade o custo de fill-rate/overdraw estourava
// (medido: pico de 175ms). A 1.5x fica suave e, COM antialias, nítido (sem serrilhado).
// Telas com DPR ≤1.5 (a maioria dos desktops) não mudam — Math.min preserva o DPR real.
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
  const {w,h}=viewportSize();
  composer.setSize(w,h,false); // keep the pipeline buffers at the new internal resolution
  return true;
}
export const getRenderScale=()=>renderScale;

// --- Player-facing graphics toggles (driven by js/core/settings.ts / the pause menu) ---
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
// Soft shadows (PCFSoft) on desktop for smooth penumbras; phones keep plain PCF,
// whose single tap per pixel is much cheaper on mobile GPUs.
renderer.shadowMap.type=isMobileLike()?THREE.PCFShadowMap:THREE.PCFSoftShadowMap;
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
// the first-person weapon viewmodel (js/combat/weapons.ts), which hangs the held gun off
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
// Shadow map resolution: 2048 on desktop (crisp contact shadows under cars, people and
// props), 1024 on phones. The shadow pass is throttled (see main.ts), so the extra
// resolution costs little per frame.
dlight.shadow.mapSize.set(isMobileLike()?1024:2048,isMobileLike()?1024:2048);
// Frustum mais apertado (era ±95→±80→±66): foca a sombra perto do jogador, melhora a
// densidade de texel e reduz a área rasterizada + casters incluídos no shadow pass.
dlight.shadow.camera.left=-66;dlight.shadow.camera.right=66;
dlight.shadow.camera.top=66;dlight.shadow.camera.bottom=-66;
dlight.shadow.camera.far=420;dlight.shadow.bias=-.0004;dlight.shadow.normalBias=.04;
dlight.shadow.radius=3; // PCFSoft kernel spread
scene.add(dlight);scene.add(dlight.target);

// O mar é um disco GIGANTE (raio 1400) centrado na origem — ele se estende por
// baixo da região dos ambientes internos (que vivem ~600m fora do mapa).
// Fica exportado porque js/world/interior.ts esconde as camadas externas enquanto
// qualquer interior está ativo.
export const sea=makeSea();scene.add(sea);

export const clouds:THREE.Sprite[]=[];
{
  clouds.push(...makeClouds(10));
  for(const sp of clouds)scene.add(sp);
}

// ---- Post-processing: the quality render pipeline ----------------------------------
// The scene renders into an HDR (half-float) MSAA buffer, then ONE merged effect chain:
//   N8AO  — screen-space ambient occlusion from the depth buffer (no extra scene render):
//           contact darkening where walls meet the street, under cars, props and people,
//           so the diorama reads as solid objects instead of flat cut-outs.
//   Bloom — only HDR-bright pixels glow (neon, lit windows, lamps, headlights, muzzle
//           flashes, the sun's glint); tuned per time of day by daynight.ts.
//   ACES  — the same filmic tone mapping as before (exposure from
//           renderer.toneMappingExposure, so daynight + the Brightness setting still work).
// Phones get a lighter chain (no AO/MSAA, SMAA edges instead). Settings can switch AO and
// bloom off; with both off the game renders straight to the screen as before.
const mobilePipe=isMobileLike();
export const composer=new EffectComposer(renderer,{
  frameBufferType:THREE.HalfFloatType,
  multisampling:0,
});
composer.addPass(new RenderPass(scene,camera));
export const aoPass=new N8AOPostPass(scene,camera,initialSize.w,initialSize.h);
Object.assign(aoPass.configuration,{
  aoRadius:2.2,          // metres: curbs, doorways, car wheels, people's feet
  distanceFalloff:1.0,
  intensity:2.4,
  aoSamples:8,
  denoiseSamples:4,
  denoiseRadius:8,
  denoiseIterations:1,
  halfRes:true,          // AO at half resolution + depth-aware upsampling: big perf win, same look
  // NOT transparency-aware: in that mode N8AO walks the whole scene graph and re-renders
  // the entire city twice more EVERY frame for the few transparent things (clouds, glass,
  // fading FX) — measured 140 → 50 fps. Without it, AO just comes from the opaque depth.
  transparencyAware:false,
  color:new THREE.Color(0x14101c), // occlusion tinted toward the night-violet, not pure black
});
composer.addPass(aoPass);
export const bloom=new BloomEffect({
  mipmapBlur:true,
  luminanceThreshold:.82,
  luminanceSmoothing:.18,
  intensity:.55,
  radius:.72,
});
const toneMap=new ToneMappingEffect({mode:ToneMappingMode.ACES_FILMIC});
const effects=[bloom,new SMAAEffect({preset:mobilePipe?SMAAPreset.MEDIUM:SMAAPreset.HIGH}),toneMap];
export const effectPass=new EffectPass(camera,...effects);
composer.addPass(effectPass);

let aoOn=!mobilePipe,bloomOn=true;
function pipelineOn(){return aoOn||bloomOn;}
function syncPipeline(){
  aoPass.enabled=aoOn;
  bloom.blendMode.opacity.value=bloomOn?1:0;
}
syncPipeline();
export function setAmbientOcclusion(on:boolean){aoOn=!!on;syncPipeline();}
export function setBloomEnabled(on:boolean){bloomOn=!!on;syncPipeline();}
// Time-of-day bloom strength (daynight.ts): subtle by day, strong for the neon night.
export function setBloomStrength(intensity:number,threshold:number){
  bloom.intensity=intensity;
  bloom.luminanceMaterial.threshold=threshold;
}

// Draw one frame: through the pipeline, or straight to the screen when it's off.
export function renderFrame(dt=0){
  if(pipelineOn())composer.render(dt);
  else renderer.render(scene,camera);
}
// The render target the scene is drawn into. Shader programs differ between drawing to a
// target and to the screen, so the boot warmup (warmup.ts) compiles with this bound —
// otherwise every material would recompile (and hitch) on first sight in game.
export function sceneTarget():THREE.WebGLRenderTarget|null{
  return pipelineOn()?composer.inputBuffer:null;
}
function resizeComposer(){
  const {w,h}=viewportSize();
  composer.setSize(w,h,false);
}
addEventListener('resize',resizeComposer);
addEventListener('orientationchange',resizeComposer);
window.visualViewport?.addEventListener?.('resize',resizeComposer);
resizeComposer();
