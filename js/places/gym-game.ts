import {state,input,keys} from '@/core/state.ts';
import {camera} from '@/core/engine.ts';
import {player,cameraRig} from '@/actors/player.ts';
import {blip} from '@/audio/audio.ts';
import {GYM_TRAIN,gymFx} from '../../assets/models/city/gym.ts';
import {reportMiniGameResult} from '@/activities/minigame-leaderboard.ts';
import {MiniGameId} from '@/activities/minigame.ts';

// ============================================================================
// Mini-game do SUPINO ("BENCH PRESS - IRON RHYTHM"), jogado dentro da academia.
//
// O boneco DEITA no banco (supino), de costas, com a barra já no esquema, e
// LEVANTA de verdade: braços animados sobem/descem a barra a cada repetição.
//
// Fluxo: 2 SÉRIES de 6 repetições. Antes de cada série o jogo pergunta
// "READY TO START?" e só começa com uma interação do jogador (toque/Espaço/E).
// Durante a série é um desafio de TIMING: uma agulha vai e volta numa barra;
// a faixa verde (POWER ZONE) marca o ponto certo. Cada toque tenta uma rep:
//   - dentro da faixa -> REP! (centro exato = PERFECT, bônus) + barra sobe
//   - fora da faixa    -> MISS! (perde muito fôlego + tremida + falha o levante)
// A barra de FÔLEGO (stamina) só drena com o tempo; reps recuperam, descansa
// entre as séries. Fechar as DUAS séries = VENCEU (js/places/gym.ts engrossa o braço,
// 1x por dia). Fôlego zerar = PERDEU (nada acontece, pode tentar de novo).
//
// Mesma carcaça do house-tv.js: trava controles, enquadra a câmera de lado no
// banco e desenha o HUD num <canvas> por cima. js/core/main.ts dá o early-return
// via updateGymGame(dt) (congela o mundo enquanto o set rola). NÃO importa
// gym.js (o prêmio entra pelo callback onWin) pra evitar import circular.
// ============================================================================

const $=(id:string)=>document.getElementById(id);
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;

// ----- estrutura do treino -----
const REPS_PER_SET=6;      // repetições por série
const TOTAL_SETS=2;        // número de séries
const REP_ANIM=0.46;       // duração da animação de uma repetição (descer+subir)

// ----- ajuste fino do timing -----
const START_SPEED=0.78;    // velocidade da agulha (fração da barra por segundo)
const SPEED_PER_REP=0.14;  // a agulha acelera a cada rep
const SET2_SPEEDUP=0.22;   // a 2ª série começa um pouco mais rápida
const START_HALF=0.155;    // meia-largura da POWER ZONE (fração da barra)
const HALF_PER_REP=0.0145; // a zona encolhe a cada rep
const MIN_HALF=0.062;      // piso da zona pra não ficar impossível
const PERFECT_FRAC=0.4;    // fração interna da zona que conta como PERFECT
const STAM_MAX=100;
const STAM_START=84;
const DRAIN=12.5;          // fôlego perdido por segundo
const HIT_GAIN=16;         // fôlego ganho por rep
const PERFECT_GAIN=25;     // fôlego ganho num PERFECT
const MISS_PEN=21;         // fôlego perdido num miss
const FLASH_DUR=0.5;       // duração do texto REP!/PERFECT!/MISS!
const RESULT_DUR=2.2;      // banner de fim (vitória/derrota) antes de fechar

// ----- pose deitada + supino (casado com o banco em GYM_TRAIN, ver gym.js) -----
// player.g tem origem nos pés, +y dos pés à cabeça, +z é o rosto. Girando
// rotation.x=-PI/2: +y->-z (cabeça pro rack), +z(rosto)->+y (deitado de barriga
// pra cima). Valores abaixo afundam as costas no estofado (topo do banco y~.75).
const BENCH_X=GYM_TRAIN.x,BENCH_Z=GYM_TRAIN.z;
const BODY_Y=0.90;             // altura da linha central do corpo deitado
const BODY_Z=BENCH_Z+0.77;     // pés ~ +.77; cabeça ~ -.85 (sob o rack)
const BAR_X=BENCH_X,BAR_Z=BENCH_Z-0.45; // barra sobre o peito
const BAR_BOTTOM_Y=1.10,BAR_TOP_Y=1.60; // curso da barra (peito -> lockout)
// rotações dos braços (relativas ao corpo já deitado): topo ~ esticado pra cima
const ARM_TOP=-1.62,ARM_BOTTOM=-1.12;    // úmero: lockout vs cotovelo aberto
const FORE_TOP=0.0,FORE_BOTTOM=-0.95;    // antebraço: reto vs dobrado
const ARM_SPLAY=0.17;                    // abertura das mãos (pegada na barra)
const LEG_X=0.42,CALF_X=0.62;            // joelhos meio dobrados (pés pro chão)

// câmera de PERFIL no banco (lado leste), barra subindo/descendo na vertical
const EYE=[BENCH_X+4.6,1.95,BENCH_Z-0.30];
const LOOK=[BENCH_X-0.20,1.12,BENCH_Z-0.42];

let active=false,onWin:(()=>void)|null=null,runScore=0; // runScore = pontos da sessão (rep/perfect) p/ o ranking
let phase='ready',setNum=1,reps=0,stamina=STAM_START;
let needle=.5,vel=START_SPEED,speed=START_SPEED,zoneCenter=.5,zoneHalf=START_HALF;
let pressPhase=1,repAnimT=0,repFail=false; // animação do levante (1=lockout, 0=peito)
let flashText='',flashColor='#fff',flashT=0,shakeT=0,result:string|null=null,resultT=0;
let prevControlsLocked=false,prevFov=62;
let prevPos={x:0,y:0,z:0},prevRot={x:0,y:0,z:0};

const overlay=$('gym-game');
const canvas=$('gym-game-canvas') as HTMLCanvasElement|null;
const ctx=canvas&&canvas.getContext('2d')!;
let cw=0,ch=0,dpr=1;

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
  canvas!.width=Math.round(w*dpr);
  canvas!.height=Math.round(h*dpr);
  canvas!.style.width=w+'px';canvas!.style.height=h+'px';
}

function moveZone(){
  const m=zoneHalf+.08;
  zoneCenter=m+Math.random()*(1-2*m);
}

export function gymGameActive(){return active;}

export function openGymGame(cfg:{onWin?:(()=>void)|null}={}){
  if(active||!overlay)return true;
  onWin=cfg.onWin||null;
  setNum=1;reps=0;runScore=0;result=null;resultT=0;
  flashText='';flashT=0;shakeT=0;
  active=true;state.gymActive=true;
  prevControlsLocked=state.controlsLocked;prevFov=camera.fov;
  state.controlsLocked=true;
  zeroInput();
  document.exitPointerLock?.();
  document.body.classList.add('gym-game-open');
  overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  poseLying();    // deita o boneco no banco com a barra no esquema
  beginReady();   // espera o "READY TO START?" da 1ª série
  ensureSize();frameCamera();
  blip([294,392,523],.08,'square',.16); // "racking" inicial
  return true;
}

export function closeGymGame(){
  if(!active)return false;
  active=false;state.gymActive=false;
  state.controlsLocked=prevControlsLocked;
  camera.fov=prevFov;camera.updateProjectionMatrix();
  restorePose();
  zeroInput();
  document.body.classList.remove('gym-game-open');
  overlay!.classList.remove('open');overlay!.setAttribute('aria-hidden','true');
  if(gymFx.barbell)gymFx.barbell.position.set(BENCH_X,1.32,BENCH_Z-1.1); // de volta ao rack
  if(state.started&&!state.mobile&&!input.touchActive)
    document.getElementById('game')?.requestPointerLock?.();
  onWin=null;
  return true;
}

function finish(){
  const cb=onWin,won=result==='win';
  reportMiniGameResult(MiniGameId.GYM,{won,score:runScore}); // ranking do supino (top 5)
  closeGymGame();
  if(won)cb?.();
}

function flash(t:string,c:string){flashText=t;flashColor=c;flashT=FLASH_DUR;}

// prepara o "READY TO START?" da série atual (barra travada no lockout)
function beginReady(){
  phase='ready';reps=0;repAnimT=0;repFail=false;pressPhase=1;
  speed=START_SPEED+(setNum-1)*SET2_SPEEDUP;vel=speed;
  zoneHalf=START_HALF;moveZone();needle=Math.random();
}

// começa a série de verdade (descansou: fôlego cheio)
function startSet(){
  phase='active';stamina=STAM_START;
  flash(`SET ${setNum} — GO!`,'#ffd24a');
  blip([392,523,659],.07,'square',.16);
}

// uma tentativa de repetição / confirmar o "READY" / fechar o banner de fim
export function gymGamePress(){
  if(!active)return false;
  if(phase==='result'){finish();return true;}
  if(phase==='ready'){startSet();return true;}
  // série ativa: tentativa de rep no timing
  const d=Math.abs(needle-zoneCenter);
  if(d<=zoneHalf){
    reps++;
    const perfect=d<=zoneHalf*PERFECT_FRAC;
    runScore+=perfect?150:100; // pontos da sessão (PERFECT vale mais) p/ o ranking
    stamina=Math.min(STAM_MAX,stamina+(perfect?PERFECT_GAIN:HIT_GAIN));
    flash(perfect?'PERFECT!':'REP!',perfect?'#ffd24a':'#ffe9c9');
    repAnimT=REP_ANIM;repFail=false; // dispara o levante completo
    speed+=SPEED_PER_REP;
    zoneHalf=Math.max(MIN_HALF,zoneHalf-HALF_PER_REP);
    moveZone();
    if(perfect)blip([659,880,1175],.06,'square',.2);
    else blip([523,659,784],.06,'square',.16);
    if(reps>=REPS_PER_SET){       // série fechada
      if(setNum>=TOTAL_SETS)win();
      else{setNum++;beginReady();blip([523,392,523],.1,'square',.16);}
    }
  }else{
    stamina-=MISS_PEN;
    flash('MISS!','#ff2e88');
    shakeT=.32;repAnimT=REP_ANIM*0.7;repFail=true; // levante que não trava
    blip([180,130],.13,'sawtooth',.2);
    if(stamina<=0){stamina=0;lose();}
  }
  return true;
}

function win(){result='win';resultT=RESULT_DUR;blip([523,659,784,1047],.1,'square',.2);}
function lose(){result='lose';resultT=RESULT_DUR;blip([262,196,131],.16,'sawtooth',.2);}

// ----------------------------------------------------- pose 3D do boneco
function poseLying(){
  const g=player.g;
  prevPos={x:g.position.x,y:g.position.y,z:g.position.z};
  prevRot={x:g.rotation.x,y:g.rotation.y,z:g.rotation.z};
  g.visible=true;
  g.position.set(BENCH_X,BODY_Y,BODY_Z);
  g.rotation.set(-Math.PI/2,0,0);
  const l=g.userData.limbs;
  if(l){l.leftLeg.visible=l.rightLeg.visible=true;}
  applyBenchPose(1);
}

function restorePose(){
  const g=player.g;
  g.position.set(prevPos.x,prevPos.y,prevPos.z);
  g.rotation.set(prevRot.x,prevRot.y,prevRot.z);
  const l=g.userData.limbs;
  if(l)for(const k of['leftArm','rightArm','leftForearm','rightForearm',
    'leftLeg','rightLeg','leftCalf','rightCalf'])l[k]?.rotation.set(0,0,0);
}

// p: 1=lockout (barra em cima), 0=barra no peito. Move braços + a barra.
function applyBenchPose(p:number){
  const l=player.g.userData.limbs;if(!l)return;
  const armX=lerp(ARM_BOTTOM,ARM_TOP,p),foreX=lerp(FORE_BOTTOM,FORE_TOP,p);
  l.leftArm.rotation.set(armX,0,ARM_SPLAY);
  l.rightArm.rotation.set(armX,0,-ARM_SPLAY);
  l.leftForearm?.rotation.set(foreX,0,0);
  l.rightForearm?.rotation.set(foreX,0,0);
  l.leftLeg.rotation.set(LEG_X,0,.12);
  l.rightLeg.rotation.set(LEG_X,0,-.12);
  l.leftCalf?.rotation.set(CALF_X,0,0);
  l.rightCalf?.rotation.set(CALF_X,0,0);
  if(gymFx.barbell)gymFx.barbell.position.set(BAR_X,lerp(BAR_BOTTOM_Y,BAR_TOP_Y,p),BAR_Z);
}

function frameCamera(){
  camera.position.set(EYE[0],EYE[1],EYE[2]);
  camera.lookAt(LOOK[0],LOOK[1],LOOK[2]);
  camera.fov+=(48-camera.fov)*.7;
  camera.updateProjectionMatrix();
  cameraRig.yaw=Math.atan2(LOOK[0]-EYE[0],LOOK[2]-EYE[2]);
}

export function updateGymGame(dt:number){
  if(!active)return false;
  ensureSize();frameCamera();
  if(flashT>0)flashT=Math.max(0,flashT-dt);
  if(shakeT>0)shakeT=Math.max(0,shakeT-dt);

  if(phase==='active'&&!result){
    stamina-=DRAIN*dt;
    if(stamina<=0){stamina=0;lose();}
    needle+=vel*dt;
    if(needle>=1){needle=1-(needle-1);vel=-speed;}
    else if(needle<=0){needle=-needle;vel=speed;}
    else vel=Math.sign(vel)*speed;
  }

  // animação do levante: ao marcar/errar uma rep, a barra desce e sobe
  if(repAnimT>0)repAnimT=Math.max(0,repAnimT-dt);
  if(repAnimT>0){
    const u=1-repAnimT/(repFail?REP_ANIM*0.7:REP_ANIM);
    const dip=repFail?0.6:1.0; // miss não chega a encostar no peito
    pressPhase=1-dip*Math.sin(u*Math.PI);
  }else pressPhase=1; // descansa no lockout entre as reps
  applyBenchPose(pressPhase);

  if(result){resultT-=dt;if(resultT<=0){finish();return true;}}
  draw();
  return true;
}

// ---------------------------------------------------------------- desenho 2D
function rr(x:number,y:number,w:number,h:number,r:number){
  ctx!.beginPath();
  if(ctx!.roundRect as unknown)ctx!.roundRect(x,y,w,h,r);
  else{
    ctx!.moveTo(x+r,y);ctx!.arcTo(x+w,y,x+w,y+h,r);ctx!.arcTo(x+w,y+h,x,y+h,r);
    ctx!.arcTo(x,y+h,x,y,r);ctx!.arcTo(x,y,x+w,y,r);ctx!.closePath();
  }
}

function draw(){
  if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,cw,ch);
  ctx.save();
  if(shakeT>0){
    const s=shakeT/.32*7;
    ctx.translate((Math.random()-.5)*s,(Math.random()-.5)*s);
  }
  ctx.textAlign='center';ctx.textBaseline='middle';
  const panelW=Math.min(cw*0.88,600),panelX=(cw-panelW)/2;

  // título + indicador de série
  ctx.fillStyle='#ff8a1e';
  ctx.font="700 14px 'IBM Plex Mono',monospace";
  ctx.fillText('IRON TEMPLE',cw/2,ch*0.075);
  ctx.fillStyle='#ffe9c9';
  ctx.font="800 30px 'Bowlby One SC','IBM Plex Mono',monospace";
  ctx.fillText('BENCH PRESS',cw/2,ch*0.125);
  ctx.fillStyle='#ff8a1e';
  ctx.font="700 13px 'IBM Plex Mono',monospace";
  ctx.fillText(`SET ${setNum} OF ${TOTAL_SETS}`,cw/2,ch*0.165);

  // bolinhas de repetição da série atual
  const dotY=ch*0.215,gap=Math.min(34,(panelW-40)/REPS_PER_SET),dotR=7;
  const dotsW=(REPS_PER_SET-1)*gap,dx0=cw/2-dotsW/2;
  for(let i=0;i<REPS_PER_SET;i++){
    const dx=dx0+i*gap,on=i<reps;
    ctx.beginPath();ctx.arc(dx,dotY,dotR,0,Math.PI*2);
    if(on){ctx.fillStyle='#ffd24a';ctx.shadowColor='#ffd24a';ctx.shadowBlur=14;ctx.fill();ctx.shadowBlur=0;}
    else{ctx.fillStyle='rgba(255,233,201,.12)';ctx.fill();
      ctx.lineWidth=2;ctx.strokeStyle='rgba(255,233,201,.4)';ctx.stroke();}
  }

  if(phase==='ready'&&!result){
    // tela de "pronto pra iniciar?"
    ctx.fillStyle='#ffe9c9';ctx.shadowColor='#ffd24a';ctx.shadowBlur=24;
    ctx.font="800 44px 'Bowlby One SC','IBM Plex Mono',monospace";
    ctx.fillText('READY TO START?',cw/2,ch*0.45);
    ctx.shadowBlur=0;
    ctx.fillStyle='#ff8a1e';
    ctx.font="700 16px 'IBM Plex Mono',monospace";
    ctx.fillText(setNum===1?'SERIES 1 OF 2 — GET SET ON THE BENCH'
                           :'NICE SET! CATCH YOUR BREATH — SERIES 2 OF 2',cw/2,ch*0.52);
    ctx.fillStyle='rgba(255,233,201,.85)';
    ctx.font="700 14px 'IBM Plex Mono',monospace";
    ctx.fillText(state.mobile?'TAP TO START THE SET'
                             :'SPACE / CLICK TO START THE SET',cw/2,ch*0.86);
  }else if(phase==='active'){
    drawActive(panelX,panelW);
  }

  // texto flutuante REP!/PERFECT!/MISS!
  if(flashT>0&&!result&&phase==='active'){
    const k=flashT/FLASH_DUR;
    ctx.save();
    ctx.globalAlpha=Math.min(1,k*1.6);
    ctx.translate(cw/2,ch*0.40);
    ctx.scale(1+(1-k)*0.5,1+(1-k)*0.5);
    ctx.fillStyle=flashColor;ctx.shadowColor=flashColor;ctx.shadowBlur=24;
    ctx.font="800 48px 'Bowlby One SC','IBM Plex Mono',monospace";
    ctx.fillText(flashText,0,0);
    ctx.restore();
  }

  // banner de fim
  if(result){
    ctx.fillStyle='rgba(2,0,8,.62)';ctx.fillRect(0,0,cw,ch);
    const won=result==='win',c=won?'#ffd24a':'#ff2e88';
    ctx.fillStyle=c;ctx.shadowColor=c;ctx.shadowBlur=30;
    ctx.font="800 46px 'Bowlby One SC','IBM Plex Mono',monospace";
    ctx.fillText(won?'WORKOUT COMPLETE!':'FORM BROKE!',cw/2,ch*0.44);
    ctx.shadowBlur=0;
    ctx.fillStyle='#ffe9c9';
    ctx.font="700 18px 'IBM Plex Mono',monospace";
    ctx.fillText(won?'TWO SOLID SETS — YOUR ARMS GREW':'NO GAINS THIS TIME',cw/2,ch*0.52);
  }
  ctx.restore();
}

function drawActive(panelX:number,panelW:number){
  // POWER BAR (timing)
  const barH=44,barY=ch*0.62,barX=panelX,barW=panelW;
  ctx!.fillStyle='rgba(8,4,16,.78)';
  rr(barX-4,barY-4,barW+8,barH+8,14);ctx!.fill();
  ctx!.lineWidth=2;ctx!.strokeStyle='rgba(255,138,30,.85)';
  rr(barX-4,barY-4,barW+8,barH+8,14);ctx!.stroke();
  ctx!.fillStyle='#16121c';rr(barX,barY,barW,barH,10);ctx!.fill();
  // POWER ZONE
  const zx=barX+(zoneCenter-zoneHalf)*barW,zw=2*zoneHalf*barW;
  const grd=ctx!.createLinearGradient(zx,0,zx+zw,0);
  grd.addColorStop(0,'rgba(65,206,98,.35)');
  grd.addColorStop(.5,'rgba(65,206,98,.9)');
  grd.addColorStop(1,'rgba(65,206,98,.35)');
  ctx!.fillStyle=grd;ctx!.shadowColor='#41ce62';ctx!.shadowBlur=18;
  rr(zx,barY+2,zw,barH-4,7);ctx!.fill();ctx!.shadowBlur=0;
  const pw=zw*PERFECT_FRAC;
  ctx!.fillStyle='rgba(220,255,200,.9)';
  rr(barX+zoneCenter*barW-pw/2,barY+2,pw,barH-4,5);ctx!.fill();
  // agulha
  const nx=barX+needle*barW;
  ctx!.strokeStyle='#fff';ctx!.lineWidth=4;ctx!.shadowColor='#fff';ctx!.shadowBlur=16;
  ctx!.beginPath();ctx!.moveTo(nx,barY-6);ctx!.lineTo(nx,barY+barH+6);ctx!.stroke();
  ctx!.shadowBlur=0;
  ctx!.fillStyle='#fff';
  ctx!.beginPath();ctx!.moveTo(nx,barY-8);ctx!.lineTo(nx-7,barY-16);ctx!.lineTo(nx+7,barY-16);
  ctx!.closePath();ctx!.fill();

  // barra de FÔLEGO
  const stH=18,stY=ch*0.74,stX=panelX,stW=panelW,p=stamina/STAM_MAX;
  ctx!.fillStyle='rgba(8,4,16,.7)';rr(stX,stY,stW,stH,9);ctx!.fill();
  const col=p>.5?'#41ce62':p>.25?'#ffd24a':'#ff2e88';
  ctx!.fillStyle=col;ctx!.shadowColor=col;ctx!.shadowBlur=12;
  if(p>0){rr(stX,stY,stW*p,stH,9);ctx!.fill();}
  ctx!.shadowBlur=0;
  ctx!.lineWidth=2;ctx!.strokeStyle='rgba(255,233,201,.5)';rr(stX,stY,stW,stH,9);ctx!.stroke();
  ctx!.fillStyle='#ffe9c9';
  ctx!.font="700 11px 'IBM Plex Mono',monospace";
  ctx!.fillText('STAMINA',cw/2,stY+stH/2);

  ctx!.fillStyle='rgba(255,233,201,.8)';
  ctx!.font="700 13px 'IBM Plex Mono',monospace";
  ctx!.fillText(state.mobile?'TAP IN THE GREEN TO PRESS'
                           :'SPACE / CLICK IN THE GREEN TO PRESS',cw/2,ch*0.84);
}

// botão QUIT (desistir do treino)
$('gym-game-exit')?.addEventListener('pointerdown',(e:Event)=>{
  e.preventDefault();e.stopPropagation();closeGymGame();
});
// tocar/clicar em qualquer ponto = confirmar READY / fazer uma repetição
overlay?.addEventListener('pointerdown',(e:Event)=>{
  e.preventDefault();gymGamePress();
});
