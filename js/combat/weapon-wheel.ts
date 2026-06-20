// ----- RODA DE SELEÇÃO DE ARMAS (roda de armas radial) -----
//
// PC: segura Tab (ou Q, ou o botão do meio do mouse) → a roda abre e o tempo entra
// em câmera lenta (ver WHEEL_TIMESCALE em main.js). O movimento do mouse (pointer
// lock) aponta para um setor e a roda do mouse rotaciona a seleção; SOLTAR a
// tecla equipa a arma destacada. Esc cancela.
//
// Mobile: tocar no botão WPN abre a roda (que congela em câmera lenta); aí é só
// TOCAR no setor da arma pra equipar, ou tocar no centro/fora pra cancelar.
//
// A roda desenha num <canvas> próprio em tela cheia, redesenhado a cada frame só
// enquanto aberta (custo nulo fora disso). Reaproveita o glifo de cada arma do
// js/weapon-icon.js (o mesmo do painel do HUD).

import {state} from '@/core/state.js';
import {blip} from '@/audio/audio.js';
import {getInventory,equipWeaponById} from '@/combat/weapons.js';
import type {InventoryItem} from '@/combat/weapons.js';
import {paintWeaponGlyph} from '@/combat/weapon-icon.js';

const $=(id: string)=>document.getElementById(id);
let root: HTMLElement|null=null,canvas: HTMLCanvasElement|null=null,ctx: CanvasRenderingContext2D|null=null;
let items: InventoryItem[]=[];            // snapshot do inventário no momento da abertura
let sel=0;               // índice do setor destacado
let openT=0;             // progresso da animação de abertura (0→1)
let dpr=1,cssW=0,cssH=0;
const aim={x:0,y:0};     // vetor de mira acumulado (PC, pointer lock)
let ptrA=-Math.PI/2;     // ângulo suavizado do ponteiro de seleção (desliza até o setor)
let touchInDead=false;   // mobile: dedo está na zona morta central (= cancelar)
const AIM_SENS=.006,AIM_DEAD=.34; // sensibilidade do mouse e zona morta da mira

export function isWheelOpen(){return state.wheelOpen;}

function canOpen(){
  return state.started&&state.mode==='foot'&&!state.swimming&&
    !state.paused&&!state.dlgActive&&!state.cine&&!state.mapOpen&&
    !state.orientationBlocked&&!state.controlsLocked;
}

export function openWheel(){
  if(state.wheelOpen||!canOpen())return false;
  items=getInventory();
  if(items.length<2)return false; // só o punho: nada a escolher
  sel=Math.max(0,items.findIndex(it=>it.current));
  aim.x=0;aim.y=0;touchInDead=false;openT=0;
  ptrA=segAngle(sel); // ponteiro já nasce alinhado à arma atual
  state.wheelOpen=true;
  document.body.classList.add('wheel-open');
  root?.classList.add('open');
  resize();
  blip([430,600],.05,'sine',.12);
  return true;
}

// equip=true: equipa o setor destacado ao fechar (release/tap). false: cancela.
export function closeWheel(equip=true){
  if(!state.wheelOpen)return;
  state.wheelOpen=false;
  document.body.classList.remove('wheel-open');
  root?.classList.remove('open');
  if(equip&&items[sel])equipWeaponById(items[sel].id); // no-op se já é a atual
  else if(!equip)blip([300,230],.05,'square',.08);
  items=[];
}

const segAngle=(i: number)=>-Math.PI/2+i*2*Math.PI/items.length; // setor 0 no topo, horário
function angDiff(a: number,b: number){let d=(a-b)%(2*Math.PI);if(d>Math.PI)d-=2*Math.PI;if(d<-Math.PI)d+=2*Math.PI;return d;}
function selFromAngle(theta: number){
  let best=0,bd=1e9;
  for(let i=0;i<items.length;i++){
    const d=Math.abs(angDiff(theta,segAngle(i)));
    if(d<bd){bd=d;best=i;}
  }
  sel=best;
}
function pointAimAt(i: number){const a=segAngle(i);aim.x=Math.cos(a);aim.y=Math.sin(a);}

// PC: delta do mouse (pointer lock) gira a mira da roda.
export function wheelPointerDelta(dx: number,dy: number){
  if(!state.wheelOpen)return;
  aim.x+=dx*AIM_SENS;aim.y+=dy*AIM_SENS;
  const len=Math.hypot(aim.x,aim.y);
  if(len>1){aim.x/=len;aim.y/=len;}
  if(len>AIM_DEAD)selFromAngle(Math.atan2(aim.y,aim.x));
}
// PC: roda do mouse gira a seleção de 1 em 1.
export function wheelScroll(dir: number){
  if(!state.wheelOpen||!items.length)return;
  sel=(sel+dir+items.length)%items.length;
  pointAimAt(sel);
  blip([560,680],.03,'square',.07);
}

// Mobile: posição absoluta do toque define o destaque (ou a zona morta central).
function handleTouch(clientX: number,clientY: number){
  const dx=clientX-cssW/2,dy=clientY-cssH/2;
  const len=Math.hypot(dx,dy);
  touchInDead=len<holeRadius();
  if(!touchInDead)selFromAngle(Math.atan2(dy,dx));
}

// ----- geometria do desenho/hit-test -----
function dims(){
  const base=Math.min(cssW,cssH);
  const R=Math.max(140,Math.min(300,base*.34)); // raio externo do anel
  return{R,r:R*.52,cx:cssW/2,cy:cssH/2};         // r = raio interno (buraco)
}
function holeRadius(){return dims().r;}

function resize(){
  if(!canvas)return;
  dpr=Math.min(2,window.devicePixelRatio||1);
  cssW=innerWidth;cssH=innerHeight;
  canvas.width=Math.round(cssW*dpr);
  canvas.height=Math.round(cssH*dpr);
}

export function updateWeaponWheel(dt: number){
  if(!state.wheelOpen){if(openT)openT=0;return;}
  if(!canOpen()){closeWheel(false);return;} // mudou de estado com a roda aberta
  openT=Math.min(1,openT+dt/.12);
  ptrA+=angDiff(segAngle(sel),ptrA)*Math.min(1,dt*16); // ponteiro desliza até o setor
  draw();
}

function draw(){
  if(!ctx)return;
  if(cssW!==innerWidth||cssH!==innerHeight)resize();
  const n=items.length;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cssW,cssH);
  const{R,r,cx,cy}=dims();
  const ease=openT*openT*(3-2*openT);

  // Vinheta de foco: escurece as bordas e acompanha a abertura (fade suave).
  const vg=ctx.createRadialGradient(cx,cy,Math.min(cssW,cssH)*.12,cx,cy,Math.max(cssW,cssH)*.6);
  vg.addColorStop(0,'rgba(4,1,10,0)');
  vg.addColorStop(1,'rgba(4,1,10,'+(.5*ease).toFixed(3)+')');
  ctx.fillStyle=vg;
  ctx.fillRect(0,0,cssW,cssH);

  ctx.save();
  ctx.translate(cx,cy);
  const sc=.7+.3*ease;
  ctx.scale(sc,sc);
  ctx.globalAlpha=ease;

  // Halo rosado atrás do anel, dá profundidade.
  const halo=ctx.createRadialGradient(0,0,r*.6,0,0,R*1.28);
  halo.addColorStop(0,'rgba(255,46,136,.20)');
  halo.addColorStop(.6,'rgba(70,14,60,.10)');
  halo.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=halo;
  ctx.beginPath();ctx.arc(0,0,R*1.28,0,Math.PI*2);ctx.fill();

  const seg=2*Math.PI/n,gap=Math.min(.05,seg*.12);
  for(let i=0;i<n;i++){
    const a=segAngle(i),on=i===sel,it=items[i];
    const oR=R+(on?12:0);                  // o setor escolhido "salta" pra fora
    const empty=!it.infinite&&it.ammo<=0;
    // Setor anelar com preenchimento em gradiente radial.
    ctx.beginPath();
    ctx.arc(0,0,oR,a-seg/2+gap,a+seg/2-gap);
    ctx.arc(0,0,r,a+seg/2-gap,a-seg/2+gap,true);
    ctx.closePath();
    const g=ctx.createRadialGradient(0,0,r,0,0,oR);
    if(on){g.addColorStop(0,'rgba(255,96,172,.40)');g.addColorStop(1,'rgba(255,46,136,.62)');}
    else  {g.addColorStop(0,'rgba(28,13,44,.42)'); g.addColorStop(1,'rgba(11,4,22,.66)');}
    ctx.fillStyle=g;
    if(on){ctx.shadowColor='rgba(255,60,150,.85)';ctx.shadowBlur=28;}
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.lineWidth=on?2.6:1.1;
    ctx.strokeStyle=on?'rgba(255,176,214,.95)':'rgba(255,233,201,.14)';
    ctx.stroke();
    // Glifo da arma no meio do setor (sombra leve no destacado p/ contraste).
    const gm=(oR+r)/2;
    ctx.save();
    ctx.translate(Math.cos(a)*gm,Math.sin(a)*gm);
    const gs=(R-r)/64*(on?1.05:.8);
    ctx.scale(gs,gs);
    ctx.globalAlpha=empty?ease*.34:ease;
    if(on){ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=6;}
    paintWeaponGlyph(ctx,it.id!);
    ctx.restore();
    // Munição na borda externa (∞ omitido).
    if(!it.infinite){
      ctx.save();
      ctx.translate(Math.cos(a)*(oR-13),Math.sin(a)*(oR-13));
      ctx.fillStyle=empty?'#ff6a9a':'#ffe9b0';
      ctx.font='700 11px "IBM Plex Mono",monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(String(it.ammo),0,0);
      ctx.restore();
    }
  }
  drawPointer(r,ptrA);   // ponteiro que desliza até o setor selecionado
  drawHub(r,items[sel]);
  ctx.restore();
  // Dica de uso (fora do anel, embaixo) — não escala com a abertura.
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.globalAlpha=ease;
  ctx.fillStyle='rgba(255,233,201,.72)';
  ctx.font='700 12px "IBM Plex Mono",monospace';
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(state.mobile?'TAP A WEAPON  •  TAP CENTER TO CLOSE'
                          :'AIM TO SELECT  •  RELEASE TO EQUIP',cx,cy+R+30);
  ctx.globalAlpha=1;
}

// Ponteiro triangular logo dentro do anel, apontando o setor destacado.
function drawPointer(r: number,ang: number){
  if(!ctx)return;
  ctx.save();
  ctx.rotate(ang);
  ctx.translate(r-3,0);
  ctx.beginPath();
  ctx.moveTo(11,0);ctx.lineTo(-3,-8);ctx.lineTo(-3,8);ctx.closePath();
  ctx.fillStyle='rgba(255,180,216,.96)';
  ctx.shadowColor='rgba(255,46,136,.9)';ctx.shadowBlur=12;
  ctx.fill();
  ctx.restore();
}

function drawHub(r: number,it: InventoryItem|undefined){
  if(!ctx||!it)return;
  // Disco central com gradiente + brilho rosado na borda.
  const hub=ctx.createRadialGradient(0,-r*.35,r*.15,0,0,r);
  hub.addColorStop(0,'rgba(30,13,44,.96)');
  hub.addColorStop(1,'rgba(8,3,16,.96)');
  ctx.beginPath();ctx.arc(0,0,r-5,0,Math.PI*2);
  ctx.fillStyle=hub;ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='rgba(255,122,184,.6)';
  ctx.shadowColor='rgba(255,46,136,.5)';ctx.shadowBlur=14;
  ctx.stroke();ctx.shadowBlur=0;
  ctx.textAlign='center';ctx.textBaseline='middle';
  // Nome (auto-ajusta o tamanho pra caber no hub).
  const maxW=(r-8)*1.7;
  let fs=Math.round(r*.2);
  ctx.font='700 '+fs+'px "IBM Plex Mono",monospace';
  while(fs>8&&ctx.measureText(it.name).width>maxW){fs--;ctx.font='700 '+fs+'px "IBM Plex Mono",monospace';}
  ctx.fillStyle='#fff';
  ctx.fillText(it.name,0,-fs*.55);
  // Munição.
  const ammo=it.infinite?'∞':(it.ammo+' / '+it.max);
  ctx.fillStyle=it.infinite?'#9bdcf0':(it.ammo<=0?'#ff6a9a':'#ffe9b0');
  ctx.font='700 '+Math.round(r*.17)+'px "IBM Plex Mono",monospace';
  ctx.fillText(ammo,0,fs*.85);
}

export function setupWheel(){
  root=$('weapon-wheel');canvas=$('ww-canvas') as HTMLCanvasElement|null;
  ctx=canvas?canvas.getContext('2d'):null;
  if(!root)return;
  // Mobile: a roda captura os toques (pointer-events:auto via CSS quando aberta).
  // No PC o ponteiro fica travado no #game, então estes handlers não disparam.
  // `touching` garante que só fechamos no pointerup de um toque que COMEÇOU na
  // roda (o tap que ABRE a roda é capturado pelo botão WPN, não vaza pra cá).
  let touching=false;
  const onDown=(e: PointerEvent)=>{if(!state.wheelOpen)return;e.preventDefault();touching=true;handleTouch(e.clientX,e.clientY);};
  const onMove=(e: PointerEvent)=>{if(!state.wheelOpen||!touching)return;handleTouch(e.clientX,e.clientY);};
  const onUp=(e: PointerEvent)=>{if(!state.wheelOpen||!touching)return;e.preventDefault();touching=false;closeWheel(!touchInDead);};
  root.addEventListener('pointerdown',onDown);
  root.addEventListener('pointermove',onMove);
  root.addEventListener('pointerup',onUp);
  root.addEventListener('pointercancel',()=>{touching=false;if(state.wheelOpen)closeWheel(false);});
  addEventListener('resize',()=>{if(state.wheelOpen)resize();});
}
