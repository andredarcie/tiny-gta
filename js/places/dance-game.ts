import {state,input,keys} from '@/core/state.ts';
import {camera} from '@/core/engine.ts';
import {player,cameraRig} from '@/actors/player.ts';
import {blip} from '@/audio/audio.ts';
import {animatePed} from '@/core/entities.ts';
import {clubFx} from '../../assets/models/city/nightclub.ts';
import {clubMusicOn,clubMusicInfo,BAR,BEAT,STEP} from '@/audio/club-music.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';

// ============================================================================
// Mini-game de RITMO da boate ("DANCE FEVER"), estilo Guitar Hero/DDR de dança.
//
// O boneco vai pro MEIO da pista e DANÇA de verdade: setas descem em 4 pistas
// (←↓↑→) até a linha de acerto. O jogador aperta a seta certa NO TEMPO da
// música própria da boate (js/audio/club-music.ts) — PC usa as setas do teclado,
// celular usa 4 botões grandes embaixo. Cada acerto vira uma pose de dança.
//
// Julgamento por timing: PERFECT / GREAT / GOOD / MISS, com combo, multiplicador
// e uma barra de HYPE (galera). Sobreviver até o fim = nota S/A/B/C/D + gorjeta;
// o HYPE zerar = vaiado pra fora. Recorde local pra fisgar ("viciante").
//
// Mesma carcaça do gym-game.js: trava controles, enquadra a câmera na pista e
// desenha o HUD num <canvas> por cima. js/core/main.ts dá o early-return via
// updateDanceGame(dt) (congela o mundo). As setas vêm da grade de batidas da
// música (clubMusicInfo), então áudio e visual ficam travados juntos.
// ============================================================================

const $=(id:string)=>document.getElementById(id);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));

// ----- timing/jogo -----
const APPROACH=1.85;     // tempo (s) que a seta leva do topo até a linha de acerto (devagar = dá pra ler)
const PERFECT=0.055,GREAT=0.11,GOOD=0.17; // janelas de acerto (s) — folgadas pra ficar acessível
const LEAD_BEATS=8;      // contagem antes da 1ª seta (2 compassos)
const END_PAD=1.6;       // folga após a última seta antes do resultado
const MOVE_DUR=0.34;     // duração da pose de dança disparada por acerto
const RESULT_DUR=3.2;    // banner de fim antes de liberar
const HYPE_START=55,HYPE_MAX=100;
const HYPE_PERFECT=4,HYPE_GREAT=2.5,HYPE_GOOD=1,HYPE_MISS=10,HYPE_STRAY=2;

// pista no centro da boate (ver nightclub.js: ladrilhos ~ -800.98,-22.03)
const DANCE_X=-800.98,DANCE_Z=-22.03;
const EYE=[DANCE_X,2.18,-16.6],LOOK=[DANCE_X,1.32,DANCE_Z]; // câmera de frente pro boneco

const LANE_COL=['#ff2e88','#19e3ff','#ffd24a','#9dff2e']; // pink/cyan/gold/green
const LANE_KEY:Record<string,number>={ArrowLeft:0,ArrowDown:1,ArrowUp:2,ArrowRight:3};

// uma seta da coreografia
interface Note{t:number;lane:number;judged:boolean;hit:boolean;}

let active=false,onFinish:((info:DanceInfo)=>void)|null=null;
let phase='count';        // 'count' -> 'play' -> 'result'
let notes:Note[]=[],lastNoteT=0,songTime=0,chartStart=0;
let score=0,combo=0,maxCombo=0,hype=HYPE_START;
let counts:Record<'PERFECT'|'GREAT'|'GOOD'|'MISS',number>={PERFECT:0,GREAT:0,GOOD:0,MISS:0};
let flashText='',flashColor='#fff',flashT=0;
let moveLane=-1,moveT=0,moveStray=false,missT=0;
let result:string|null=null,resultT=0,grade='',reward=0,newBest=false;
let laneFlash=[0,0,0,0],beatStep=-1;
let prevControlsLocked=false,prevFov=62;
let prevPos={x:0,y:0,z:0},prevRot={x:0,y:0,z:0};

// info entregue ao callback onFinish (ver js/places/club.ts onDanceFinish)
interface DanceInfo{won:boolean;grade:string;score:number;maxCombo:number;reward:number;accuracy:number;newBest:boolean;}

const overlay=$('dance-game');
const canvas=$('dance-game-canvas') as HTMLCanvasElement|null;
const ctx=canvas&&canvas.getContext('2d')!;
let cw=0,ch=0,dpr=1;

let best=0;
try{best=+JSON.parse(localStorage.getItem('tinygta_dance')||'{}').best||0;}catch(e){}

function zeroInput(){
  input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;
  input.run=false;input.brake=false;input.horn=false;input.shootHeld=false;
  input.moveActive=false;input.lookActive=false;input.brakeActive=false;input.hornActive=false;
  for(const k of Object.keys(keys))keys[k]=false;
}

function ensureSize(){
  const w=window.innerWidth,h=window.innerHeight;
  dpr=Math.min(window.devicePixelRatio||1,2);
  if(cw===w&&ch===h&&canvas!.width===Math.round(w*dpr))return;
  cw=w;ch=h;
  canvas!.width=Math.round(w*dpr);canvas!.height=Math.round(h*dpr);
  canvas!.style.width=w+'px';canvas!.style.height=h+'px';
}

export function danceGameActive(){return active;}

export function openDanceGame(cfg:{onFinish?:((info:DanceInfo)=>void)|null}={}){
  if(active||!overlay)return true;
  onFinish=cfg.onFinish||null;
  if(!clubMusicInfo())clubMusicOn();   // garante a música tocando pra alinhar a grade
  active=true;state.danceActive=true;
  prevControlsLocked=state.controlsLocked;prevFov=camera.fov;
  state.controlsLocked=true;
  zeroInput();
  document.exitPointerLock?.();
  document.body.classList.add('dance-game-open');
  overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  poseStart();
  buildChart();
  score=0;combo=0;maxCombo=0;hype=HYPE_START;result=null;resultT=0;newBest=false;
  grade='';reward=0;
  counts={PERFECT:0,GREAT:0,GOOD:0,MISS:0};
  flashText='';flashT=0;moveLane=-1;moveT=0;missT=0;beatStep=-1;
  laneFlash=[0,0,0,0];phase='count';
  ensureSize();frameCamera();
  blip([523,659,784,1047],.08,'square',.16);
  return true;
}

export function closeDanceGame(){
  if(!active)return false;
  active=false;state.danceActive=false;
  state.controlsLocked=prevControlsLocked;
  camera.fov=prevFov;camera.updateProjectionMatrix();
  restorePose();
  zeroInput();
  document.body.classList.remove('dance-game-open');
  overlay!.classList.remove('open');overlay!.setAttribute('aria-hidden','true');
  if(state.started&&!state.mobile&&!input.touchActive)
    document.getElementById('game')?.requestPointerLock?.();
  onFinish=null;
  return true;
}

function finish(){
  const cb=onFinish,info:DanceInfo={won:result==='win',grade,score,maxCombo,reward,
    accuracy:accuracy(),newBest};
  closeDanceGame();
  cb?.(info);
}

// ------------------------------------------------------- geração da coreografia
// 16 compassos (cada um = 16 semicolcheias). 1 = tem seta. REGRA: as setas usam
// SÓ passos PARES, então NUNCA caem duas grudadas — o intervalo mínimo entre
// duas setas é uma colcheia (0.25s). Nunca há duas ao mesmo tempo (uma pista por
// passo). RAMPA bem gradual: mínimas (~1s), semínimas (na batida ~0.5s) e, no
// máximo, colcheias firmes e bem espaçadas no clímax.
const MASKS=[
  // -- intro lenta: 2 setas por compasso (a cada ~1s) --
  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
  // -- semínimas: na batida (a cada ~0.5s) --
  [1,0,0,0, 1,0,0,0, 1,0,0,0, 0,0,0,0],
  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  // -- primeiras colcheias, bem espaçadas --
  [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,0,0],
  [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,1,0],
  [1,0,1,0, 1,0,0,0, 1,0,1,0, 1,0,0,0],
  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,0,0],
  // -- colcheias firmes (sempre 1 passo de folga entre as setas) --
  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  [1,0,1,0, 1,0,0,0, 1,0,1,0, 1,0,1,0],
  // -- clímax (colcheias, ainda espaçadas; nada colado) --
  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  [1,0,1,0, 1,0,1,0, 1,0,0,0, 1,0,1,0],
  [1,0,0,0, 1,0,1,0, 1,0,0,0, 1,0,0,0],
];

function buildChart(){
  const info=clubMusicInfo();
  const now=info?info.now:0; // segundos atuais dentro da música
  // começa numa BORDA DE COMPASSO depois da contagem, pra 1ª seta entrar limpa
  chartStart=Math.ceil((now+LEAD_BEATS*BEAT)/BAR)*BAR;
  notes=[];
  const MIN_GAP=2; // trava: nunca duas setas a menos de 1 colcheia (2 passos) de distância
  let prevStep=-99,lane=2,dir=1;
  for(let bar=0;bar<MASKS.length;bar++){
    const mask=MASKS[bar];
    for(let s=0;s<16;s++){
      if(!mask[s])continue;
      const g=bar*16+s; // passo global
      if(g-prevStep<MIN_GAP)continue; // perto demais da anterior: descarta (segurança)
      if(g-prevStep<=2){ // escada nas colcheias seguidas (lanes vizinhas)
        lane=clamp(lane+dir,0,3);
        if(lane===0||lane===3)dir=-dir;
      }else{ // nota isolada: pista aleatória sem repetir
        let nl;do{nl=Math.floor(Math.random()*4);}while(nl===lane);
        lane=nl;
      }
      notes.push({t:chartStart+g*STEP,lane,judged:false,hit:false});
      prevStep=g;
    }
  }
  lastNoteT=notes.length?notes[notes.length-1].t:chartStart;
}

function accuracy(){
  const n=notes.length||1;
  return (counts.PERFECT+counts.GREAT*.7+counts.GOOD*.35)/n;
}
function comboMult(){return combo>=32?4:combo>=16?3:combo>=8?2:1;}
function flash(t:string,c:string){flashText=t;flashColor=c;flashT=.42;}

// ---------------------------------------------------------------- input do jogo
export function danceGameKey(code:string){
  if(!active)return false;
  if(code==='Escape'){result?finish():closeDanceGame();return true;}
  const lane=LANE_KEY[code];
  if(lane===undefined)return false;
  pressLane(lane);
  return true;
}

// Space/Enter/E no banner de fim avança e fecha (PC).
export function danceGameConfirm(){if(active&&result){finish();return true;}return false;}

export function pressLane(lane:number){
  if(!active)return;
  if(result){finish();return;}
  if(phase!=='play'){laneFlash[lane]=.12;return;}
  laneFlash[lane]=.16;
  let best:Note|null=null,bestAbs=1e9;
  for(const n of notes){
    if(n.judged||n.lane!==lane)continue;
    const d=Math.abs(n.t-songTime);
    if(d<bestAbs){bestAbs=d;best=n;}
  }
  if(best&&bestAbs<=GOOD)judge(best,bestAbs);
  else{ // apertou no vazio: pequena perda de hype, mantém o boneco no embalo
    hype=Math.max(0,hype-HYPE_STRAY);
    triggerMove(lane,true);
    if(hype<=0)lose();
  }
}

function judge(n:Note,d:number){
  n.judged=true;n.hit=true;
  let kind:'PERFECT'|'GREAT'|'GOOD',pts,gv,col;
  if(d<=PERFECT){kind='PERFECT';pts=100;gv=HYPE_PERFECT;col='#9dff2e';}
  else if(d<=GREAT){kind='GREAT';pts=70;gv=HYPE_GREAT;col='#19e3ff';}
  else{kind='GOOD';pts=40;gv=HYPE_GOOD;col='#ffd24a';}
  combo++;maxCombo=Math.max(maxCombo,combo);
  score+=pts*comboMult();
  counts[kind]++;
  hype=Math.min(HYPE_MAX,hype+gv);
  flash(kind,col);
  triggerMove(n.lane,false);
  if(kind==='PERFECT')blip([880,1320],.05,'square',.13);
  else if(kind==='GREAT')blip([660,990],.05,'square',.1);
  else blip([523],.05,'square',.08);
}

function noteMiss(n:Note){
  n.judged=true;n.hit=false;
  combo=0;counts.MISS++;
  hype=Math.max(0,hype-HYPE_MISS);
  flash('MISS','#ff2e88');missT=.3;
  blip([170,120],.12,'sawtooth',.14);
  if(hype<=0)lose();
}

function triggerMove(lane:number,stray:boolean){moveLane=lane;moveT=MOVE_DUR;moveStray=stray;}
function win(){
  result='win';resultT=RESULT_DUR;grade=gradeFor();payout();
  // fanfarra escalada pela nota (S = mais notas)
  const hi=grade==='S'?[523,659,784,1047,1319]
    :(grade==='A'||grade==='B')?[523,659,784,1047]:[523,659,784];
  blip(hi,.1,'square',.2);
}
function lose(){
  if(result)return;
  result='lose';resultT=RESULT_DUR;grade='F';reward=0;
  blip([392,294,196,131],.16,'sawtooth',.2);
}

function gradeFor(){
  const a=accuracy();
  return a>=.95?'S':a>=.85?'A':a>=.7?'B':a>=.5?'C':a>=.3?'D':'F';
}
function payout(){
  reward=REWARDS.dance.gradePayouts[grade]||0;
  if(score>best){best=score;newBest=true;
    try{localStorage.setItem('tinygta_dance',JSON.stringify({best}));}catch(e){}}
}

// --------------------------------------------------------------- pose 3D do boneco
function poseStart(){
  const g=player.g;
  prevPos={x:g.position.x,y:g.position.y,z:g.position.z};
  prevRot={x:g.rotation.x,y:g.rotation.y,z:g.rotation.z};
  g.visible=true;
  g.position.set(DANCE_X,0,DANCE_Z);
  g.rotation.set(0,0,0); // +z é o rosto: encara a câmera (ao sul)
  const l=g.userData.limbs;
  if(l){l.leftLeg.visible=l.rightLeg.visible=true;}
}

function restorePose(){
  const g=player.g;
  g.position.set(prevPos.x,prevPos.y,prevPos.z);
  g.rotation.set(prevRot.x,prevRot.y,prevRot.z);
  const l=g.userData.limbs;
  if(l)for(const k of['leftArm','rightArm','leftForearm','rightForearm',
    'leftLeg','rightLeg','leftCalf','rightCalf'])l[k]?.rotation.set(0,0,0);
}

// poses-alvo por pista (braços/pernas/inclinação). Misturadas com o embalo base.
function poseFor(lane:number){
  if(lane===2)return{la:[-2.6,0,-.25],ra:[-2.6,0,.25],legL:0,legR:0,calf:0,dipY:.14,tilt:0};   // UP: braços pro alto + pulinho
  if(lane===1)return{la:[-.2,0,-.55],ra:[-.2,0,.55],legL:-.5,legR:-.5,calf:1.0,dipY:-.2,tilt:0}; // DOWN: agacha
  if(lane===0)return{la:[-1.7,0,-1.05],ra:[.25,0,.2],legL:0,legR:0,calf:0,dipY:.02,tilt:.16};    // LEFT: aponta pra esquerda
  return{la:[.25,0,-.2],ra:[-1.7,0,1.05],legL:0,legR:0,calf:0,dipY:.02,tilt:-.16};               // RIGHT: aponta pra direita
}

function applyDancePose(){
  const l=player.g.userData.limbs;if(!l)return;
  const g=player.g;
  // embalo base no ritmo da música (sway de quadril + braços + bob)
  const ph=songTime/BEAT*Math.PI; // avança PI por tempo
  const sway=Math.sin(ph*.5);
  const bob=Math.abs(Math.sin(ph));
  let laX=-.25+Math.sin(ph)*.35, raX=-.25-Math.sin(ph)*.35;
  let laZ=-.18, raZ=.18, llX=0, rlX=0, calf=.05, dipY=bob*.05, tilt=sway*.07;
  // overlay da pose disparada por acerto (pulso rápido sobe-e-desce)
  if(moveT>0){
    const a=Math.sin((1-moveT/MOVE_DUR)*Math.PI)*(moveStray?.5:1);
    const p=poseFor(moveLane);
    laX=lerp(laX,p.la[0],a);laZ=lerp(laZ,p.la[2],a);
    raX=lerp(raX,p.ra[0],a);raZ=lerp(raZ,p.ra[2],a);
    llX=lerp(llX,p.legL,a);rlX=lerp(rlX,p.legR,a);
    calf=lerp(calf,p.calf,a);dipY=lerp(dipY,p.dipY,a);tilt=lerp(tilt,p.tilt,a);
  }
  // tropeço no MISS
  if(missT>0){const m=missT/.3;tilt+=Math.sin(songTime*45)*.18*m;laX+=.3*m;raX+=.3*m;}
  l.leftArm.rotation.set(laX,0,laZ);
  l.rightArm.rotation.set(raX,0,raZ);
  l.leftForearm?.rotation.set(-.25,0,0);
  l.rightForearm?.rotation.set(-.25,0,0);
  l.leftLeg.rotation.set(llX,0,.06);
  l.rightLeg.rotation.set(rlX,0,-.06);
  l.leftCalf?.rotation.set(calf,0,0);
  l.rightCalf?.rotation.set(calf,0,0);
  g.position.y=Math.max(0,dipY);
  g.rotation.z=tilt;
}

function frameCamera(){
  camera.position.set(EYE[0],EYE[1],EYE[2]);
  camera.lookAt(LOOK[0],LOOK[1],LOOK[2]);
  camera.fov+=(52-camera.fov)*.7;
  camera.updateProjectionMatrix();
  cameraRig.yaw=Math.atan2(LOOK[0]-EYE[0],LOOK[2]-EYE[2]);
}

// pista/globo/galera dançam mesmo com o mundo congelado (club.js não roda aqui)
function animateClub(dt:number){
  if(clubFx.ball)clubFx.ball.rotation.y+=dt*1.6;
  const step=Math.floor(songTime/BEAT);
  if(step!==beatStep){ // troca as cores dos ladrilhos a cada tempo
    beatStep=step;
    const PAL=[0xff2e88,0x19e3ff,0xffd24a,0x9dff2e];
    clubFx.tileMats?.forEach((m,i)=>m.color.setHex(PAL[(i+step)%PAL.length]));
  }
  for(const d of clubFx.dancers||[]){
    d.t+=dt*d.sp;animatePed(d.g,d.t,.9);
    d.g.position.y=Math.abs(Math.sin(d.t))*.09;
    d.g.rotation.y=d.face+Math.sin(d.t*.45)*.6;
  }
}

export function updateDanceGame(dt:number){
  if(!active)return false;
  ensureSize();frameCamera();
  const info=clubMusicInfo();
  songTime=info?info.now:songTime+dt; // relógio da música (à prova de frame)
  if(flashT>0)flashT=Math.max(0,flashT-dt);
  if(moveT>0)moveT=Math.max(0,moveT-dt);
  if(missT>0)missT=Math.max(0,missT-dt);
  for(let i=0;i<4;i++)if(laneFlash[i]>0)laneFlash[i]=Math.max(0,laneFlash[i]-dt);

  if(phase==='count'&&songTime>=chartStart-GOOD)phase='play'; // libera o acerto da 1ª seta

  if(phase==='play'&&!result){
    // setas que passaram da janela sem acerto viram MISS
    for(const n of notes)if(!n.judged&&songTime-n.t>GOOD)noteMiss(n);
    if(!result&&songTime>lastNoteT+END_PAD)win();
  }

  animateClub(dt);
  applyDancePose();

  if(result){resultT-=dt;if(resultT<=0){finish();return true;}}
  draw();
  return true;
}

// ------------------------------------------------------------------ desenho 2D
function rr(x:number,y:number,w:number,h:number,r:number){
  ctx!.beginPath();
  if(ctx!.roundRect as unknown)ctx!.roundRect(x,y,w,h,r);
  else{ctx!.moveTo(x+r,y);ctx!.arcTo(x+w,y,x+w,y+h,r);ctx!.arcTo(x+w,y+h,x,y+h,r);
    ctx!.arcTo(x,y+h,x,y,r);ctx!.arcTo(x,y,x+w,y,r);ctx!.closePath();}
}

// seta direcional por pista (0=esq,1=baixo,2=cima,3=dir)
function arrow(cx:number,cy:number,s:number,lane:number){
  ctx!.save();ctx!.translate(cx,cy);
  // base aponta pra cima; gira p/ cada pista. No canvas o Y cresce pra BAIXO, então
  // +θ é horário: lane0 (←) precisa de -π/2 e lane3 (→) de +π/2 (estavam trocados).
  ctx!.rotate([-Math.PI/2,Math.PI,0,Math.PI/2][lane]);
  ctx!.beginPath();
  ctx!.moveTo(0,-s);ctx!.lineTo(s*.8,s*.2);ctx!.lineTo(s*.34,s*.2);
  ctx!.lineTo(s*.34,s);ctx!.lineTo(-s*.34,s);ctx!.lineTo(-s*.34,s*.2);
  ctx!.lineTo(-s*.8,s*.2);ctx!.closePath();
  ctx!.restore();
}

function hwGeom(){
  const HW=Math.min(cw*.86,460),x0=(cw-HW)/2,laneW=HW/4;
  const topY=ch*.1,recY=ch*.8;
  return{HW,x0,laneW,topY,recY};
}
function hexA(h:string,a:number){const n=parseInt(h.slice(1),16);return`rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}

function draw(){
  if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  ctx.textAlign='center';ctx.textBaseline='middle';
  const {x0,laneW,topY,recY}=hwGeom();

  // ---- cabeçalho ----
  ctx.fillStyle='#ff2e88';ctx.font="700 13px 'IBM Plex Mono',monospace";
  ctx.fillText('THE FLAMINGO',cw/2,ch*.05);
  ctx.fillStyle='#ffe6f4';ctx.font="800 26px 'Bowlby One SC','IBM Plex Mono',monospace";
  ctx.fillText('DANCE FEVER',cw/2,ch*.092);

  const travel=recY-topY;
  const goodPx=GOOD/APPROACH*travel,perfectPx=PERFECT/APPROACH*travel;
  // pulso da batida (receptores "respiram" no tempo, ajuda a sentir o ritmo)
  const bf=((songTime/BEAT)%1+1)%1,beatPulse=Math.max(0,1-bf*3.2);
  // distância da seta mais próxima de cada pista -> brilho "AGORA" no receptor
  const near=[9,9,9,9];
  for(const n of notes){if(n.judged)continue;
    const d=Math.abs(n.t-songTime);if(d<near[n.lane])near[n.lane]=d;}

  // ---- pistas + FAIXA DE ACERTO (mostra a janela: aperte quando a seta entrar) ----
  for(let i=0;i<4;i++){
    const lx=x0+i*laneW;
    ctx.fillStyle=i%2?'rgba(255,255,255,.04)':'rgba(255,255,255,.07)';
    ctx.fillRect(lx,topY,laneW,travel+40);
    ctx.fillStyle='rgba(255,255,255,.10)';                 // janela GOOD
    ctx.fillRect(lx+3,recY-goodPx,laneW-6,goodPx*2);
    ctx.fillStyle=hexA(LANE_COL[i],.22);                   // miolo PERFECT
    ctx.fillRect(lx+3,recY-perfectPx,laneW-6,perfectPx*2);
  }
  ctx.strokeStyle='rgba(255,255,255,.55)';ctx.lineWidth=2; // linha central do acerto
  ctx.beginPath();ctx.moveTo(x0,recY);ctx.lineTo(x0+laneW*4,recY);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1; // bordas da janela
  for(const yy of[recY-goodPx,recY+goodPx]){ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(x0+laneW*4,yy);ctx.stroke();}

  // ---- receptores (alvos): pulsam na batida e ACENDEM quando dá pra acertar ----
  for(let i=0;i<4;i++){
    const cx=x0+(i+.5)*laneW,fl=laneFlash[i];
    const hit=near[i]<=GOOD?1-near[i]/GOOD:0;   // 1 = bem no centro da janela
    const sc=20*(1+beatPulse*.12+hit*.45);
    if(hit>0){ // halo "AGORA"
      ctx.globalAlpha=.5*hit;ctx.fillStyle=LANE_COL[i];
      ctx.beginPath();ctx.arc(cx,recY,sc*1.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }
    if(fl>0||hit>0){ // preenche o alvo no acerto / quando hittável
      ctx.fillStyle=LANE_COL[i];ctx.shadowColor=LANE_COL[i];
      ctx.shadowBlur=20*Math.max(fl/.16,hit);
      ctx.globalAlpha=Math.max(fl>0?1:0,hit*.85);
      arrow(cx,recY,sc,i);ctx.fill();ctx.globalAlpha=1;ctx.shadowBlur=0;
    }
    ctx.lineWidth=3;ctx.strokeStyle=LANE_COL[i];ctx.globalAlpha=.92; // contorno: onde mirar
    arrow(cx,recY,sc,i);ctx.stroke();ctx.globalAlpha=1;
  }

  // ---- setas descendo (crescem e brilham conforme chegam no alvo) ----
  for(const n of notes){
    if(n.judged)continue;
    const left=n.t-songTime;
    if(left>APPROACH||left<-GOOD)continue;
    const p=1-left/APPROACH; // 0 topo -> 1 receptor
    const cx=x0+(n.lane+.5)*laneW,cy=topY+p*travel,sz=13+9*p;
    ctx.fillStyle=LANE_COL[n.lane];ctx.shadowColor=LANE_COL[n.lane];ctx.shadowBlur=10+16*p;
    arrow(cx,cy,sz,n.lane);ctx.fill();ctx.shadowBlur=0;
  }

  drawHud();

  // ---- contagem inicial ----
  if(phase==='count'&&!result){
    const left=chartStart-songTime,n=Math.ceil(left/BEAT);
    ctx.fillStyle='#ffe6f4';ctx.shadowColor='#ff2e88';ctx.shadowBlur=26;
    if(n<=3&&n>0){ctx.font="800 88px 'Bowlby One SC','IBM Plex Mono',monospace";
      ctx.fillText(String(n),cw/2,ch*.46);}
    else{ctx.font="800 40px 'Bowlby One SC','IBM Plex Mono',monospace";
      ctx.fillText('GET READY!',cw/2,ch*.46);}
    ctx.shadowBlur=0;ctx.fillStyle='rgba(255,230,244,.85)';
    ctx.font="700 15px 'IBM Plex Mono',monospace";
    ctx.fillText('PRESS WHEN THE ARROW REACHES THE LINE',cw/2,ch*.54);
    ctx.fillStyle='rgba(255,230,244,.6)';ctx.font="700 13px 'IBM Plex Mono',monospace";
    ctx.fillText(state.mobile?'USE THE 4 BUTTONS BELOW'
      :'USE THE ARROW KEYS  ←  ↓  ↑  →',cw/2,ch*.585);
  }

  // ---- texto flutuante do julgamento ----
  if(flashT>0&&!result){
    const k=flashT/.42;
    ctx.save();ctx.globalAlpha=Math.min(1,k*1.8);
    ctx.translate(cw/2,ch*.66);ctx.scale(1+(1-k)*.4,1+(1-k)*.4);
    ctx.fillStyle=flashColor;ctx.shadowColor=flashColor;ctx.shadowBlur=22;
    ctx.font="800 38px 'Bowlby One SC','IBM Plex Mono',monospace";
    ctx.fillText(flashText,0,0);
    if(combo>=4&&flashText!=='MISS'){ctx.shadowBlur=0;ctx.globalAlpha=k;
      ctx.fillStyle='#fff';ctx.font="800 20px 'Bowlby One SC','IBM Plex Mono',monospace";
      ctx.fillText(combo+' COMBO',0,34);}
    ctx.restore();
  }

  if(result)drawResult();
}

function drawHud(){
  // barra de HYPE no topo
  const bw=Math.min(cw*.8,440),bx=(cw-bw)/2,by=ch*.135,bh=14,p=hype/HYPE_MAX;
  ctx!.fillStyle='rgba(8,4,16,.7)';rr(bx,by,bw,bh,7);ctx!.fill();
  const col=p>.5?'#9dff2e':p>.25?'#ffd24a':'#ff2e88';
  if(p>0){ctx!.fillStyle=col;ctx!.shadowColor=col;ctx!.shadowBlur=12;rr(bx,by,bw*p,bh,7);ctx!.fill();ctx!.shadowBlur=0;}
  ctx!.lineWidth=2;ctx!.strokeStyle='rgba(255,230,244,.5)';rr(bx,by,bw,bh,7);ctx!.stroke();
  ctx!.fillStyle='#ffe6f4';ctx!.font="700 10px 'IBM Plex Mono',monospace";
  ctx!.fillText('CROWD HYPE',cw/2,by+bh/2+.5);

  // placar + multiplicador
  ctx!.textAlign='left';ctx!.fillStyle='#ffe6f4';
  ctx!.font="800 22px 'Bowlby One SC','IBM Plex Mono',monospace";
  ctx!.fillText(String(score).padStart(5,'0'),bx,by-16);
  ctx!.textAlign='right';
  const mult=comboMult();
  ctx!.fillStyle=mult>1?'#ffd24a':'rgba(255,230,244,.6)';
  ctx!.font="800 22px 'Bowlby One SC','IBM Plex Mono',monospace";
  ctx!.fillText('x'+mult,bx+bw,by-16);
  ctx!.textAlign='center';
}

function drawResult(){
  ctx!.fillStyle='rgba(2,0,8,.7)';ctx!.fillRect(0,0,cw,ch);
  // tamanhos responsivos à ALTURA (mobile em paisagem tem ch baixo)
  const big=Math.min(108,ch*.26),mid=Math.min(28,ch*.072),
    lin=Math.min(16,ch*.042),tip=Math.min(22,ch*.056);
  const won=result==='win';
  let y=ch*.30;
  if(won){
    const c=({S:'#9dff2e',A:'#19e3ff',B:'#ffd24a',C:'#ffd24a',D:'#ff8a1e',F:'#ff8a1e'} as Record<string,string>)[grade]||'#fff';
    ctx!.fillStyle=c;ctx!.shadowColor=c;ctx!.shadowBlur=34;
    ctx!.font=`800 ${big}px 'Bowlby One SC','IBM Plex Mono',monospace`;
    ctx!.fillText(grade,cw/2,y);y+=big*.62;
    ctx!.shadowBlur=0;ctx!.fillStyle='#ffe6f4';
    ctx!.font=`800 ${mid}px 'Bowlby One SC','IBM Plex Mono',monospace`;
    const msg=({S:'SUPERSTAR!',A:'AMAZING!',B:'GREAT MOVES!',C:'NICE MOVES!',
      D:'YOU SURVIVED!',F:'YOU SURVIVED!'} as Record<string,string>)[grade]||'NICE!';
    ctx!.fillText(msg,cw/2,y);y+=mid*1.3;
  }else{
    ctx!.fillStyle='#ff2e88';ctx!.shadowColor='#ff2e88';ctx!.shadowBlur=30;
    ctx!.font=`800 ${mid*1.5}px 'Bowlby One SC','IBM Plex Mono',monospace`;
    ctx!.fillText('BOOED OFF!',cw/2,y+big*.2);ctx!.shadowBlur=0;y+=big*.45+mid;
  }
  y=Math.max(y,ch*.56);
  ctx!.fillStyle='#ffe6f4';ctx!.font=`700 ${lin}px 'IBM Plex Mono',monospace`;
  ctx!.fillText(`SCORE ${score}   MAX COMBO ${maxCombo}`,cw/2,y);y+=lin*1.6;
  ctx!.fillText(`PERFECT ${counts.PERFECT}  GREAT ${counts.GREAT}  GOOD ${counts.GOOD}  MISS ${counts.MISS}`,cw/2,y);y+=lin*1.9;
  if(reward>0){ctx!.fillStyle='#ffd24a';ctx!.font=`800 ${tip}px 'Bowlby One SC','IBM Plex Mono',monospace`;
    ctx!.fillText(`TIP  +$${reward}`,cw/2,y);y+=tip*1.4;}
  if(newBest){ctx!.fillStyle='#9dff2e';ctx!.font=`800 ${lin*1.15}px 'Bowlby One SC','IBM Plex Mono',monospace`;
    ctx!.fillText('★ NEW HIGH SCORE ★',cw/2,y);y+=lin*1.6;}
  else{ctx!.fillStyle='rgba(255,230,244,.7)';ctx!.font=`700 ${lin*.85}px 'IBM Plex Mono',monospace`;
    ctx!.fillText('BEST '+best,cw/2,y);y+=lin*1.6;}
  ctx!.fillStyle='rgba(255,230,244,.7)';ctx!.font="700 13px 'IBM Plex Mono',monospace";
  ctx!.fillText(state.mobile?'TAP TO CONTINUE':'SPACE / CLICK TO CONTINUE',cw/2,ch*.9);
}

// ----- botões de pista (toque/clique) + QUIT -----
overlay&&[0,1,2,3].forEach(i=>{
  $('dance-lane-'+i)?.addEventListener('pointerdown',(e:Event)=>{
    e.preventDefault();e.stopPropagation();pressLane(i);
  });
});
$('dance-game-exit')?.addEventListener('pointerdown',(e:Event)=>{
  e.preventDefault();e.stopPropagation();result?finish():closeDanceGame();
});
// no banner de fim, tocar/clicar em QUALQUER lugar continua (os botões de pista
// e o QUIT dão stopPropagation, então não disparam isto duas vezes)
addEventListener('pointerdown',(e:Event)=>{if(active&&result){e.preventDefault();finish();}});
