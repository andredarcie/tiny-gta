import {state,input,refs} from '@/core/state.ts';
import {
  startGameFromUserGesture,requestStart,performInteract,performPauseToggle,
  performRadioSwitch,performShoot,resetInput
} from '@/core/input.ts';
import {getInteractAction} from '@/ui/hud.ts';
import {openWheel,closeWheel} from '@/combat/weapon-wheel.ts';

const DEAD=.12,CURVE=1.35,YAW_SPEED=2.4,PITCH_SPEED=1.35;

const $=(id: string): HTMLElement | null=>document.getElementById(id);

function isMobileLike(): boolean {
  return matchMedia('(pointer: coarse)').matches||innerWidth<900;
}

function isPortrait(): boolean {
  return innerHeight>innerWidth;
}

function stop(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

// Normalized analog-stick reading.
interface StickValue { x: number; y: number; active: boolean; }

function norm(dx: number,dy: number,radius: number): StickValue {
  const x=Math.max(-1,Math.min(1,dx/radius));
  const y=Math.max(-1,Math.min(1,dy/radius));
  const len=Math.hypot(x,y);
  if(len<DEAD)return{x:0,y:0,active:false};
  const amt=Math.min(1,(len-DEAD)/(1-DEAD));
  const curved=Math.pow(amt,CURVE);
  return{x:x/len*curved,y:y/len*curved,active:true};
}

function bindStick(el: HTMLElement | null,onMove: (v: StickValue)=>void,onEnd: ()=>void): void {
  const knob=el?.querySelector('.stick-knob') as HTMLElement | null;
  let pointer: number | null=null,rect: DOMRect | null=null,radius=58;
  const move=(e: PointerEvent): void=>{
    if(e.pointerId!==pointer)return;
    stop(e);
    const cx=rect!.left+rect!.width/2,cy=rect!.top+rect!.height/2;
    const dx=e.clientX-cx,dy=e.clientY-cy;
    radius=rect!.width*.5;
    const dist=Math.hypot(dx,dy);
    const k=dist>radius?radius/dist:1;
    knob!.style.transform=`translate(-50%,-50%) translate(${dx*k}px,${dy*k}px)`;
    onMove(norm(dx,dy,radius));
  };
  el?.addEventListener('pointerdown',e=>{
    stop(e);
    pointer=e.pointerId;
    rect=el.getBoundingClientRect();
    el.setPointerCapture?.(pointer);
    el.classList.add('active');
    move(e);
  });
  const end=(e: PointerEvent): void=>{
    if(pointer===null||e.pointerId!==pointer)return;
    stop(e);
    const id=pointer;
    el!.releasePointerCapture?.(id);
    pointer=null;
    knob!.style.transform='';
    el!.classList.remove('active');
    onEnd();
  };
  el?.addEventListener('pointermove',move);
  el?.addEventListener('pointerup',end);
  el?.addEventListener('pointercancel',end);
}

function bindButton(el: HTMLElement | null,onDown?: ()=>void,onUp?: ()=>void): void {
  let pointer: number | null=null;
  el?.addEventListener('pointerdown',e=>{
    stop(e);
    pointer=e.pointerId;
    el.setPointerCapture?.(pointer);
    el.classList.add('active');
    onDown?.();
  });
  const end=(e: PointerEvent): void=>{
    if(pointer===null||e.pointerId!==pointer)return;
    stop(e);
    const id=pointer;
    el!.releasePointerCapture?.(id);
    pointer=null;
    el!.classList.remove('active');
    onUp?.();
  };
  el?.addEventListener('pointerup',end);
  el?.addEventListener('pointercancel',end);
}

function updateOrientationState(): void {
  state.orientationBlocked=state.mobile&&isPortrait();
  document.body.classList.toggle('is-portrait-blocked',state.orientationBlocked);
  if(state.orientationBlocked)resetInput(true);
}

export function updateTouchControls(): void {
  if(!state.mobile)return;
  updateOrientationState();
  const root=$('touch-controls');
  if(root)root.setAttribute('aria-hidden',state.started?'false':'true');
  const action=getInteractAction();
  const interact=$('btn-interact') as HTMLButtonElement | null;
  if(interact){
    interact.textContent=action.label;
    interact.disabled=!action.enabled;
    interact.classList.toggle('disabled',!action.enabled);
  }
  const tv=!!refs.getHouseTvState?.()?.active;
  // a pé sempre dá pra atacar (nem que seja com o punho) -> botão FIRE aparece
  const onFoot=state.started&&state.mode==='foot'&&!state.dlgActive&&!state.paused&&!state.orientationBlocked&&!tv;
  const armed=onFoot&&!!refs.canAttack?.();
  const driving=state.started&&state.mode==='car'&&!state.dlgActive&&!state.paused&&!tv;
  const radioAllowed=driving&&!refs.getOverkillState?.()?.active;
  $('btn-shoot')?.classList.toggle('show',armed);
  $('btn-wpn')?.classList.toggle('show',onFoot&&state.hasGun&&!state.swimming); // troca de arma (só com arsenal; nadando guarda)
  $('btn-brake')?.classList.toggle('show',driving);
  $('btn-radio')?.classList.toggle('show',radioAllowed);
  $('touch-controls')?.classList.toggle('in-dialog',state.dlgActive||tv);
}

export function setupTouchControls(): void {
  state.mobile=isMobileLike();
  document.body.classList.toggle('is-mobile',state.mobile);
  if(!state.mobile)return;
  input.touchActive=true;
  input.lastInput='touch';
  const play=$('play');
  if(play)play.textContent='TAP TO PLAY';
  updateOrientationState();

  bindStick($('stick-move'),v=>{
    if(state.orientationBlocked||state.paused||state.dlgActive||state.mode==='cut')return;
    input.moveActive=v.active;
    input.moveX=-v.x;
    input.moveY=-v.y;
    input.run=Math.hypot(v.x,v.y)>.88;
    input.lastInput='touch';
  },()=>{
    input.moveActive=false;
    input.moveX=0;input.moveY=0;input.run=false;
  });

  bindStick($('stick-look'),v=>{
    if(state.orientationBlocked||state.paused||state.dlgActive||state.mode==='cut')return;
    input.lookActive=v.active;
    // Positive X means "turn camera right"; updateCamera applies this directly.
    input.lookX=v.x*YAW_SPEED;
    input.lookY=v.y*PITCH_SPEED;
    input.lastInput='touch';
  },()=>{
    input.lookActive=false;
    input.lookX=0;input.lookY=0;
  });

  bindButton($('btn-interact'),()=>performInteract());
  bindButton($('btn-shoot'),()=>{
    input.shootHeld=true;
    performShoot();
  },()=>{input.shootHeld=false;});
  // WPN abre a roda de seleção; a própria roda (overlay) trata o toque no setor.
  bindButton($('btn-wpn'),()=>{state.wheelOpen?closeWheel(false):openWheel();});
  bindButton($('btn-brake'),()=>{
    input.brake=true;
    input.brakeActive=true;
  },()=>{
    input.brake=false;
    input.brakeActive=false;
  });
  bindButton($('btn-radio'),()=>performRadioSwitch());
  bindButton($('btn-pause'),()=>performPauseToggle());

  addEventListener('resize',updateOrientationState);
  addEventListener('orientationchange',updateOrientationState);
  window.visualViewport?.addEventListener?.('resize',updateOrientationState);
  addEventListener('blur',()=>resetInput(true));
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)resetInput(true);
  });

  // tocar pra jogar abre o modal de nickname (start acontece ao confirmar)
  $('title')?.addEventListener('pointerdown',e=>{
    if(state.started)return;
    if((e.target as Element).closest('#play'))return; // o botão PLAY já trata o clique
    requestStart();
  },{capture:true});
}
