import * as THREE from 'three';
import {clamp} from '@/core/constants.ts';
import {scene,renderer,hemi,dlight,sunDir,clouds,camera,setBloomStrength,setNightBloom} from '@/core/engine.ts';
import {lampGlowMat,lampHaloMat,lampBulbMat} from '../../assets/models/props/street-lamp.ts';
import {state,refs} from '@/core/state.ts';
import {beamMat} from '@/core/entities.ts';
import {makeSkyDome} from '../../assets/models/daynight/sky-dome.ts';
import {makeSunSprite} from '../../assets/models/daynight/sun.ts';
import {makeMoonSprite} from '../../assets/models/daynight/moon.ts';
import {makeHorizonGlow} from '../../assets/models/daynight/horizon-glow.ts';
import {makeStarField} from '../../assets/models/daynight/star-field.ts';

// tod (time of day) in [0,1): 0=midnight, .25=sunrise, .5=noon, .75=sunset.
// Full day length in seconds; the cycle advances on its own each frame.
const DAY_LEN=300;
// Day runs 3x slower and night 3x faster than a uniform cycle.
const DAY_MULT=1/3;
const NIGHT_MULT=6.6;
// ?tod=0..1 in the URL pins the STARTING time of day (debug); default is early
// afternoon, so the first sunset arrives in ~1 min. The clock keeps advancing.
const urlTod=parseFloat(new URLSearchParams(location.search).get('tod') as string);
// Dev (localhost): o jogo SEMPRE começa ao meio-dia (.5), pra avaliar o visual com luz
// alta. O relógio segue andando depois; um ?tod=… explícito ainda vence.
const isLocalhost=location.hostname==='localhost'||location.hostname==='127.0.0.1';
let tod=isNaN(urlTod)?(isLocalhost?.5:.55):((urlTod%1)+1)%1;
export const getTod=()=>tod;
export const setTod=(v:number)=>{tod=((v%1)+1)%1;};
// Resume the in-game clock from a save (js/activities/minigame.ts getDailySave). Without this the
// clock snapped back to afternoon on every reload, so a short session never crossed an
// in-game midnight — `dayCount` stayed frozen and the mini-games' "1x/dia" lock could
// never clear across reloads. A ?tod=… debug pin still wins (don't clobber it).
// No localhost o save NÃO restaura a hora (pra sempre COMEÇAR ao meio-dia).
const todPinned=!isNaN(urlTod)||isLocalhost;
export const restoreTod=(v:number)=>{ if(!todPinned&&Number.isFinite(v))setTod(v); };
// Day counter: bumps every time the clock wraps past midnight. Used by the gym
// (js/places/gym.ts) to allow training only once per day.
let dayCount=0;
export const getDay=()=>dayCount;
// Restaura o contador de dias do save (NUNCA regride). Sem isto o "dia" voltaria a
// 0 a cada reload e a regra "1x por dia" dos mini-games seria burlável recarregando.
export const setDay=(n:number)=>{ if(Number.isFinite(n)) dayCount=Math.max(dayCount,Math.floor(n)); };

// Keyframes of the cycle, measured on the town's own photos (Street View, nov/2024): a
// clear interior-paulista sky that pales to a hazy blue-grey at the horizon, the same haze
// as the fog (distant serras turn blue-grey), a strong white sun against a weak sky fill
// (real light: crisp shadows and solid form), and soft, low-saturation dawn and dusk.
// sky = 5 gradient stops (zenith -> horizon); sun = the directional light's colour (the
// moonlight at night); win = how bright the lit windows are.
const KF=[
 {t:.00,sky:['#070b16','#0b1120','#111a2e','#18233a','#202d46'],fog:'#18202e',
  sun:'#a8b8dc',sunI:.6,hs:'#3e4c6c',hg:'#22242c',hI:.85,win:2.0,star:1,exp:1.5,cloud:'#262d3c'},
 {t:.17,sky:['#070b16','#0b1120','#111a2e','#18233a','#202d46'],fog:'#18202e',
  sun:'#a8b8dc',sunI:.6,hs:'#3e4c6c',hg:'#22242c',hI:.85,win:2.0,star:1,exp:1.5,cloud:'#262d3c'},
 {t:.215,sky:['#0c1428','#18233e','#2e3654','#5a5466','#8a7470'],fog:'#3a4050',
  sun:'#c8a8a0',sunI:.6,hs:'#4a5070',hg:'#2c2a30',hI:.8,win:1.7,star:.6,exp:1.2,cloud:'#6a5a62'},
 {t:.26,sky:['#2e4e80','#4e6e9e','#8c9cb6','#d8b49a','#ead2b8'],fog:'#a8acb4',
  sun:'#ffc898',sunI:1.6,hs:'#8c9cb8',hg:'#4a4038',hI:.75,win:.8,star:.05,exp:1.15,cloud:'#f2c8a8'},
 {t:.34,sky:['#3a6eb2','#5a8cc8','#8db0d8','#bfd0e0','#d8e0e6'],fog:'#bccad6',
  sun:'#ffeacc',sunI:2.8,hs:'#a6c0dc',hg:'#6b6152',hI:.8,win:.35,star:0,exp:1.1,cloud:'#f4f4f2'},
 {t:.50,sky:['#3f74b8','#5b8fcf','#8fb4dc','#bcd0e2','#d7e0e7'],fog:'#b9c7d3',
  sun:'#fff4e4',sunI:3.2,hs:'#a9c4e0',hg:'#6b6152',hI:.8,win:.3,star:0,exp:1.05,cloud:'#ffffff'},
 {t:.66,sky:['#3f74b8','#5b8fcf','#93b4d8','#c4d2de','#dcdcd8'],fog:'#bec6cc',
  sun:'#fff0da',sunI:3.0,hs:'#a9c4e0',hg:'#6b6152',hI:.8,win:.3,star:0,exp:1.05,cloud:'#fbf8f2'},
 {t:.735,sky:['#3a5f98','#5c7bab','#9fa8bc','#e8bc90','#f4d6ac'],fog:'#c8b8a6',
  sun:'#ffbf80',sunI:2.2,hs:'#9aa6bc',hg:'#5a4a3c',hI:.75,win:.6,star:0,exp:1.15,cloud:'#f4d2b4'},
 {t:.77,sky:['#283c6a','#4c5682','#9a7a88','#e8946a','#f2b884'],fog:'#a08c84',
  sun:'#ff8a50',sunI:1.2,hs:'#6a6a8a',hg:'#3a3030',hI:.75,win:1.1,star:.12,exp:1.25,cloud:'#e0987c'},
 {t:.81,sky:['#0e1630','#18213e','#2c2c4a','#56404e','#7a5450'],fog:'#2e2c3a',
  sun:'#9aaad8',sunI:.6,hs:'#3e4868',hg:'#24242c',hI:.8,win:1.8,star:.65,exp:1.4,cloud:'#3a3a4e'},
 {t:.87,sky:['#070b16','#0b1120','#111a2e','#18233a','#202d46'],fog:'#18202e',
  sun:'#a8b8dc',sunI:.6,hs:'#3e4c6c',hg:'#22242c',hI:.85,win:2.0,star:1,exp:1.5,cloud:'#262d3c'}
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
let bloomNight=false; // is the night bloom pipeline on (see updateDayNight)
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

// Perf (REGRA MESTRA: só desenha o que o jogador VÊ). O céu é a única coisa "no
// infinito" que o jogador enxerga, então ele vira um BACKDROP pequeno que segue a
// câmera e é encolhido uniformemente (dome 900→~144, sol/lua/estrelas junto). Escala
// uniforme + câmera no centro = transformação de similaridade → a imagem projetada é
// IDÊNTICA (mesmos ângulos; sizeAttenuation mantém o tamanho aparente dos sprites; as
// estrelas são pixels de tela fixos). Assim tudo do céu cabe dentro de um camera.far
// APERTADO (ver updateDayNight), e o frustum culling NATIVO do Three passa a cortar de
// graça todo objeto 100% imerso na névoa — que, por definição, o jogador NÃO vê.
for(const c of clouds)skyLayer.add(c); // nuvens entram no backdrop (seguem+escalam junto)
const SKY_SCALE=0.16;
skyLayer.scale.setScalar(SKY_SCALE);

for(const c of clouds)c.userData.op0=(c.material as THREE.SpriteMaterial).opacity;

const SUNSET_TINT=new THREE.Color(0xff5a28);
// Bulbo do poste: apagado (cinza) de dia, quente e brilhante à noite
const BULB_DAY=new THREE.Color(0x9a948e),BULB_NIGHT=new THREE.Color(0xffd9a0);

// Global grade: the keyframes above are already measured from photos, so this only takes
// a last touch of saturation off the sampled palette (cameras and eyes see the sky and the
// haze a little greyer than the measured swatches) and sets the overall exposure. One lever
// for the whole game; applied in updateDayNight after sampleKeyframes().
const REAL_DESAT=0.08;   // 0 = keep the keyframes as they are, 1 = greyscale
const REAL_EXP=1.0;      // exposure multiplier
function desat(c:THREE.Color,k:number):void{
  const l=c.r*0.299+c.g*0.587+c.b*0.114;
  c.r+=(l-c.r)*k;c.g+=(l-c.g)*k;c.b+=(l-c.b)*k;
}

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
  // realism grade (REAL_DESAT/REAL_EXP): ease the saturation of the sampled palette before
  // it drives the sky dome, fog and lights below. Exposure is eased at the apply site.
  for(const c of cur.sky)desat(c,REAL_DESAT);
  desat(cur.fog,REAL_DESAT);desat(cur.hs,REAL_DESAT);desat(cur.hg,REAL_DESAT*0.6);
  desat(cur.sun,REAL_DESAT*0.5);desat(cur.cloud,REAL_DESAT*0.7);
  skyAccum+=dt;
  if(skyAccum>=.08){skyAccum=0;drawSky();} // redesenho/upload do céu throttlado (~12fps)

  scene.fog!.color.copy(cur.fog);
  // Fog: out in Divinolândia a long, light haze so the green serras around the town read
  // on the horizon (the town is drawn in a few big batches, the far serra is one coarse
  // mesh). Inside the off-map rooms a short one (they are small and enclosed).
  const inside=!!state.interior;
  (scene.fog as THREE.Fog).near=inside?100:140;
  const fogFar=inside?200:2600;
  (scene.fog as THREE.Fog).far=fogFar;
  // REGRA MESTRA (só desenha o que o jogador VÊ): o plano FAR da câmera acompanha a
  // névoa. Tudo além de `fogFar` já é 100% opaco de neblina — invisível —, então deixar
  // o frustum culling NATIVO do Three descartar esses objetos é visual-neutro E de graça:
  // corta os draws de marcos/veículos/efeitos distantes que antes eram submetidos mesmo
  // somados ao haze (camera.far era 2000). O céu é a exceção que o jogador VÊ — vira um
  // backdrop encolhido (≤ ~156u) que segue a câmera, então cabe folgado sob o piso de 175.
  // No mirante a névoa abre com a altitude e o far cresce junto, preservando o horizonte.
  const camFar=Math.max(fogFar+18,175);
  if(Math.abs(camera.far-camFar)>4){camera.far=camFar;camera.updateProjectionMatrix();}
  // backdrop do céu centrado na câmera (segue só a POSIÇÃO — sem rotação, pra o gradiente
  // vertical + sol/lua manterem a direção de mundo certa conforme a hora do dia)
  skyLayer.position.copy(camera.position);
  renderer.toneMappingExposure=cur.exp*REAL_EXP;
  // Bloom is a NIGHT-only effect (the neon glow — lit windows, signs, lamps, headlights,
  // flashes): the post-processing pipeline switches on after dusk and off after dawn, with
  // hysteresis so it never flickers, and its strength ramps up from ~0 at the switch so
  // there is no visible pop. By day the game renders straight to the screen (cheaper).
  {const nightF=clamp(1-(cur.sunI-.5)/1.3,0,1);
   const on=nightF>(bloomNight?.45:.5);
   if(on!==bloomNight){bloomNight=on;setNightBloom(on);}
   const ramp=clamp((nightF-.45)/.2,0,1);
   setBloomStrength((.3+nightF*1.1)*ramp,.92-nightF*.32);}
  hemi.color.copy(cur.hs);hemi.groundColor.copy(cur.hg);hemi.intensity=cur.hI;
  dlight.color.copy(cur.sun);dlight.intensity=cur.sunI;
  for(const c of clouds){
    (c.material as THREE.SpriteMaterial).color.copy(cur.cloud);
    (c.material as THREE.SpriteMaterial).opacity=c.userData.op0*(.55+.45*clamp(cur.sunI/2.2,0,1));
  }
  starMat.opacity=cur.star*(.82+.18*Math.sin(twinkleT*2.3));

  // Posição do sol/lua: nasce no leste (+x), se põe no oeste (-x)
  const th=(tod-.25)*Math.PI*2,sx=Math.cos(th),sy=Math.sin(th);
  const horiz=clamp(1-Math.abs(sy)/.3,0,1); // proximidade do horizonte

  sunSpr.position.set(sx*720,sy*500+18,-430);
  const s=420+horiz*80;   // the glare (the disc is ~7 % of it); a little wider near the horizon
  sunSpr.scale.set(s,s,1);
  sunMat.color.copy(cur.sun).lerp(SUNSET_TINT,horiz*.35);
  sunMat.opacity=clamp((sy+.07)/.11,0,1);

  moonSpr.position.set(-sx*720,-sy*470+24,-430);
  moonMat.opacity=clamp((-sy+.07)/.13,0,1)*.95;

  glowSpr.position.set(sx*700,42,-426);
  glowMat.opacity=Math.pow(horiz,1.5)*.45;      // a soft band of warm light at the horizon, not a blaze

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
    const cy=c.g.position.y; // headlights ride with the car (the town is hundreds of metres up)
    headSpot.position.set(c.g.position.x+_fwd.x*2.2,cy+1.1,c.g.position.z+_fwd.z*2.2);
    headSpot.target.position.set(c.g.position.x+_fwd.x*16,cy+.4,c.g.position.z+_fwd.z*16);
    headSpot.intensity=nightF*140;
  }else headSpot.intensity=0;
}
