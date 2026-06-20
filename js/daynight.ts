import * as THREE from 'three';
import {clamp,RURAL_X0} from './constants.js';
import {scene,renderer,hemi,dlight,sunDir,clouds} from './engine.js';
import {buildingMats,lampGlowMat,lampHaloMat,lampBulbMat} from './world.js';
import {state,refs} from './state.js';
import {beamMat} from './entities.js';
import {makeSkyDome} from '../assets/models/daynight/sky-dome.js';
import {makeSunSprite} from '../assets/models/daynight/sun.js';
import {makeMoonSprite} from '../assets/models/daynight/moon.js';
import {makeHorizonGlow} from '../assets/models/daynight/horizon-glow.js';
import {makeStarField} from '../assets/models/daynight/star-field.js';

// tod (time of day) in [0,1): 0=midnight, .25=sunrise, .5=noon, .75=sunset.
// Full day length in seconds; the cycle advances on its own each frame.
const DAY_LEN=300;
// Day runs 3x slower and night 3x faster than a uniform cycle.
const DAY_MULT=1/3;
const NIGHT_MULT=6.6;
// ?tod=0..1 in the URL pins the STARTING time of day (debug); default is early
// afternoon, so the first sunset arrives in ~1 min. The clock keeps advancing.
const urlTod=parseFloat(new URLSearchParams(location.search).get('tod') as string);
let tod=isNaN(urlTod)?.55:((urlTod%1)+1)%1;
export const getTod=()=>tod;
export const setTod=(v:number)=>{tod=((v%1)+1)%1;};
// Resume the in-game clock from a save (js/minigame.js getDailySave). Without this the
// clock snapped back to afternoon on every reload, so a short session never crossed an
// in-game midnight — `dayCount` stayed frozen and the mini-games' "1x/dia" lock could
// never clear across reloads. A ?tod=… debug pin still wins (don't clobber it).
const todPinned=!isNaN(urlTod);
export const restoreTod=(v:number)=>{ if(!todPinned&&Number.isFinite(v))setTod(v); };
// Day counter: bumps every time the clock wraps past midnight. Used by the gym
// (js/gym.js) to allow training only once per day.
let dayCount=0;
export const getDay=()=>dayCount;
// Restaura o contador de dias do save (NUNCA regride). Sem isto o "dia" voltaria a
// 0 a cada reload e a regra "1x por dia" dos mini-games seria burlável recarregando.
export const setDay=(n:number)=>{ if(Number.isFinite(n)) dayCount=Math.max(dayCount,Math.floor(n)); };

// Keyframes do ciclo. sky = 5 paradas do gradiente (zênite -> horizonte).
// sun = cor da luz direcional (vira luar à noite), win = brilho das janelas dos prédios.
const KF=[
 {t:.00,sky:['#141e38','#1b2848','#26365c','#32466e','#405a7e'],fog:'#243652',
  sun:'#c6d8ff',sunI:.72,hs:'#44587e',hg:'#242c3e',hI:.66,win:2.0,star:1,exp:1.14,cloud:'#5a688a'},
 {t:.17,sky:['#141e38','#1b2848','#26365c','#32466e','#405a7e'],fog:'#243652',
  sun:'#c6d8ff',sunI:.72,hs:'#44587e',hg:'#242c3e',hI:.66,win:2.0,star:1,exp:1.14,cloud:'#5a688a'},
 {t:.215,sky:['#0b1430','#1c2048','#3c2a56','#7a3e4e','#c06a4a'],fog:'#503a44',
  sun:'#ff9a5e',sunI:.5,hs:'#3a3658',hg:'#1e161e',hI:.4,win:1.7,star:.6,exp:1.0,cloud:'#8a5e66'},
 {t:.26,sky:['#1a3a6c','#3a5c92','#9a6e8a','#ff9a56','#ffd28e'],fog:'#c08a62',
  sun:'#ffae5e',sunI:1.3,hs:'#7a7494',hg:'#36282a',hI:.62,win:.8,star:.05,exp:1.08,cloud:'#ffb892'},
 {t:.34,sky:['#2a6ec6','#4f9ade','#9ccfeb','#ffe2b8','#fff0d4'],fog:'#c6dcea',
  sun:'#ffe0ae',sunI:2.0,hs:'#aed1f4',hg:'#8a8078',hI:.98,win:.35,star:0,exp:1.2,cloud:'#fff6ea'},
 {t:.50,sky:['#2e7fd9','#5aa7e8','#a8d8f0','#d2eaf8','#eaf5fc'],fog:'#cfe2ee',
  sun:'#fff2da',sunI:2.4,hs:'#bfdfff',hg:'#8a8078',hI:1.05,win:.3,star:0,exp:1.25,cloud:'#ffffff'},
 {t:.66,sky:['#2e7fd9','#5aa7e8','#a8d8f0','#ffe7c4','#fff4dd'],fog:'#cfe2ee',
  sun:'#fff1d6',sunI:2.2,hs:'#bfdfff',hg:'#8a8078',hI:1.05,win:.3,star:0,exp:1.25,cloud:'#fff2e0'},
 {t:.735,sky:['#28509e','#5a5a96','#b06a78','#ff9450','#ffc878'],fog:'#d49a6a',
  sun:'#ffa050',sunI:1.6,hs:'#8a7a8e',hg:'#4a342e',hI:.8,win:.6,star:0,exp:1.18,cloud:'#ffc09a'},
 {t:.77,sky:['#1c2a5e','#46336e','#9c4460','#ff6e3a','#ffb060'],fog:'#b06a4a',
  sun:'#ff6a32',sunI:1.0,hs:'#5c4a6e',hg:'#2c2026',hI:.55,win:1.1,star:.12,exp:1.1,cloud:'#ff8e6a'},
 {t:.81,sky:['#121a3e','#1c244e','#342c5e','#6a3856','#9a524e'],fog:'#3e3050',
  sun:'#9aa8e0',sunI:.56,hs:'#3e4668',hg:'#202236',hI:.56,win:1.8,star:.65,exp:1.08,cloud:'#504a6a'},
 {t:.87,sky:['#141e38','#1b2848','#26365c','#32466e','#405a7e'],fog:'#243652',
  sun:'#c6d8ff',sunI:.72,hs:'#44587e',hg:'#242c3e',hI:.66,win:2.0,star:1,exp:1.14,cloud:'#5a688a'}
];
// Pré-converte cores para THREE.Color (sem alocação por frame)
const P=KF.map(k=>({t:k.t,sky:k.sky.map(c=>new THREE.Color(c)),fog:new THREE.Color(k.fog),
  sun:new THREE.Color(k.sun),hs:new THREE.Color(k.hs),hg:new THREE.Color(k.hg),
  cloud:new THREE.Color(k.cloud),sunI:k.sunI,hI:k.hI,win:k.win,star:k.star,exp:k.exp}));

const cur={sky:[0,0,0,0,0].map(()=>new THREE.Color()),fog:new THREE.Color(),
  sun:new THREE.Color(),hs:new THREE.Color(),hg:new THREE.Color(),cloud:new THREE.Color(),
  sunI:0,hI:0,win:0,star:0,exp:1};

function sampleKeyframes(){
  let a=P[P.length-1],b=P[0],span=1-a.t+b.t,u=(tod>=a.t?tod-a.t:tod+1-a.t)/span;
  for(let i=0;i<P.length-1;i++)if(tod>=P[i].t&&tod<P[i+1].t){
    a=P[i];b=P[i+1];u=(tod-a.t)/(b.t-a.t);break;
  }
  u=u*u*(3-2*u);
  for(let i=0;i<5;i++)cur.sky[i].lerpColors(a.sky[i],b.sky[i],u);
  cur.fog.lerpColors(a.fog,b.fog,u);cur.sun.lerpColors(a.sun,b.sun,u);
  cur.hs.lerpColors(a.hs,b.hs,u);cur.hg.lerpColors(a.hg,b.hg,u);
  cur.cloud.lerpColors(a.cloud,b.cloud,u);
  cur.sunI=a.sunI+(b.sunI-a.sunI)*u;cur.hI=a.hI+(b.hI-a.hI)*u;
  cur.win=a.win+(b.win-a.win)*u;cur.star=a.star+(b.star-a.star)*u;
  cur.exp=a.exp+(b.exp-a.exp)*u;
}

// Céu completo. O grupo fica exportado por causa dos interiores off-map:
// o domo tem raio 900 e pode atravessar salas como a loja de armas.
const skyLayer=new THREE.Group();scene.add(skyLayer);
export function setSkyHidden(hidden:boolean){skyLayer.visible=!hidden;}

// --- Cúpula do céu (gradiente redesenhado conforme a hora) ---
const skyCanvas=document.createElement('canvas');skyCanvas.width=16;skyCanvas.height=512;
const skyCtx=skyCanvas.getContext('2d')!;
const skyTex=new THREE.CanvasTexture(skyCanvas);skyTex.colorSpace=THREE.SRGBColorSpace;
skyLayer.add(makeSkyDome(skyTex));
const STOPS=[0,.45,.7,.86,1];
function drawSky(){
  const g=skyCtx.createLinearGradient(0,0,0,512);
  for(let i=0;i<5;i++)g.addColorStop(STOPS[i],'#'+cur.sky[i].getHexString());
  skyCtx.fillStyle=g;skyCtx.fillRect(0,0,16,512);
  skyTex.needsUpdate=true;
}

// --- Sol (textura neutra; a cor vem do tint do material) ---
const {sprite:sunSpr,material:sunMat}=makeSunSprite();skyLayer.add(sunSpr);

// --- Lua ---
const {sprite:moonSpr,material:moonMat}=makeMoonSprite();skyLayer.add(moonSpr);

// --- Brilho do horizonte no nascer/pôr do sol ---
const {sprite:glowSpr,material:glowMat}=makeHorizonGlow();skyLayer.add(glowSpr);

// --- Estrelas (hemisfério de pontos com brilho variado) ---
const {points:starPoints,material:starMat}=makeStarField();skyLayer.add(starPoints);

for(const c of clouds)c.userData.op0=(c.material as THREE.SpriteMaterial).opacity;

const SUNSET_TINT=new THREE.Color(0xff5a28);
// Luminous haze tint for the dense rural fog on a SUNNY day, so the countryside
// reads as bright sunlit bruma (não um cinza de tempo fechado). Ver updateDayNight.
const RURAL_HAZE=new THREE.Color(0xeef1e9);
// Bulbo do poste: apagado (cinza) de dia, quente e brilhante à noite
const BULB_DAY=new THREE.Color(0x9a948e),BULB_NIGHT=new THREE.Color(0xffd9a0);

// Farol do carro do jogador: um único SpotLight real que ilumina a rua à frente
const headSpot=new THREE.SpotLight(0xffe9b8,0,38,.6,.55,1.4);
headSpot.castShadow=false;
scene.add(headSpot);scene.add(headSpot.target);
const _fwd=new THREE.Vector3();

let twinkleT=0;
// The sky changes slowly over minutes (DAY_LEN), so redrawing the gradient canvas
// and re-uploading the texture to the GPU every frame was wasteful; at ~12fps the
// transition still looks smooth. Lights/fog follow per frame (cheap and need to
// stay smooth). skyAccum starts high to force the first draw.
let skyAccum=1;
export function updateDayNight(dt:number){
  // Time advances on its own; it only stops during a cut-scene (story.js pins it
  // to noon when entering the scene).
  if(!state.cine){
    const before=tod;
    tod=(tod+dt*(tod<.24||tod>.76?NIGHT_MULT:DAY_MULT)/DAY_LEN)%1;
    if(tod<before)dayCount++; // wrapped past midnight: new day
  }
  twinkleT+=dt;
  sampleKeyframes();
  skyAccum+=dt;
  if(skyAccum>=.08){skyAccum=0;drawSky();} // redesenho/upload do céu throttlado (~12fps)

  scene.fog!.color.copy(cur.fog);
  // Fog por zona: na cidade o alcance é amplo (vê a cidade inteira); ao entrar na
  // zona rural ele fica bem mais denso (ver distâncias abaixo), escondendo a cidade
  // distante na névoa — e, da cidade, a zona rural distante. Transição suave no
  // corredor de pasto. Mirante: do alto da montanha o horizonte reabre.
  const ppos=refs.playerPos?.();
  const ruralF=clamp(((ppos?ppos.x:0)-RURAL_X0)/120,0,1);
  // De dia com sol, a névoa rural densa deve parecer uma BRUMA luminosa (não um
  // cinza de tempo fechado): clareia a cor da névoa em direção ao haze, na medida
  // de quão rural se está E de quão forte está o sol (sunI ~2.4 ao meio-dia, ~.5 à
  // noite) — então amanhecer/entardecer/noite mantêm a própria névoa. Não mexe no
  // sol nem nas distâncias; só na cor.
  const dayF=clamp((cur.sunI-1.2)/1.0,0,1);
  (scene.fog as THREE.Fog).color.lerp(RURAL_HAZE,ruralF*dayF*.55);
  // Fog por zona. Na zona rural ele fica BEM mais denso (perto e longe puxados pra
  // dentro): props (pinheiros, postes, igreja e o forte, todos assados) somem no
  // culling a ~160m, então a névoa precisa fechar ANTES disso pra esconder o
  // "pop-in" do carregamento. far rural ~155 (< culling) + near antecipado deixam
  // o objeto totalmente no haze quando é cortado. Cap em 430 e o termo de altitude
  // mantêm o mirante: do alto da montanha o horizonte reabre.
  (scene.fog as THREE.Fog).near=120-ruralF*48;
  (scene.fog as THREE.Fog).far=Math.min(300-ruralF*145+(ppos?Math.max(0,ppos.y)*14:0),430);
  renderer.toneMappingExposure=cur.exp;
  hemi.color.copy(cur.hs);hemi.groundColor.copy(cur.hg);hemi.intensity=cur.hI;
  dlight.color.copy(cur.sun);dlight.intensity=cur.sunI;
  for(const m of buildingMats)m.emissiveIntensity=cur.win;
  for(const c of clouds){
    (c.material as THREE.SpriteMaterial).color.copy(cur.cloud);
    (c.material as THREE.SpriteMaterial).opacity=c.userData.op0*(.55+.45*clamp(cur.sunI/2.2,0,1));
  }
  starMat.opacity=cur.star*(.82+.18*Math.sin(twinkleT*2.3));

  // Posição do sol/lua: nasce no leste (+x), se põe no oeste (-x)
  const th=(tod-.25)*Math.PI*2,sx=Math.cos(th),sy=Math.sin(th);
  const horiz=clamp(1-Math.abs(sy)/.3,0,1); // proximidade do horizonte

  sunSpr.position.set(sx*720,sy*500+18,-430);
  const s=300+horiz*170; // sol maior perto do horizonte
  sunSpr.scale.set(s,s,1);
  sunMat.color.copy(cur.sun).lerp(SUNSET_TINT,horiz*.55);
  sunMat.opacity=clamp((sy+.07)/.11,0,1);

  moonSpr.position.set(-sx*720,-sy*470+24,-430);
  moonMat.opacity=clamp((-sy+.07)/.13,0,1)*.95;

  glowSpr.position.set(sx*700,42,-426);
  glowMat.opacity=Math.pow(horiz,1.5)*.8;

  // Direção da luz: sol de dia, lua à noite (troca no escuro, intensidade baixa)
  if(sy>=0)sunDir.set(sx*.85,Math.max(sy,.16),-.5).normalize();
  else sunDir.set(-sx*.85,Math.max(-sy,.16),-.5).normalize();

  // Faróis: acendem gradualmente quando o sol se aproxima do horizonte
  const nightF=clamp((.06-sy)/.14,0,1);
  beamMat.visible=nightF>0;
  beamMat.opacity=nightF*.5;

  // Postes: mesma curva dos faróis — poça de luz no chão, halo e bulbo aceso
  lampGlowMat.visible=lampHaloMat.visible=nightF>0;
  lampGlowMat.opacity=nightF*.55;
  lampHaloMat.opacity=nightF*.85;
  lampBulbMat.color.lerpColors(BULB_DAY,BULB_NIGHT,nightF);
  const c=refs.getCur?.();
  if(nightF>0&&state.mode==='car'&&c&&!c.plane){
    _fwd.set(0,0,1).applyQuaternion(c.g.quaternion);
    headSpot.position.set(c.g.position.x+_fwd.x*2.2,1.1,c.g.position.z+_fwd.z*2.2);
    headSpot.target.position.set(c.g.position.x+_fwd.x*16,.4,c.g.position.z+_fwd.z*16);
    headSpot.intensity=nightF*140;
  }else headSpot.intensity=0;
}
