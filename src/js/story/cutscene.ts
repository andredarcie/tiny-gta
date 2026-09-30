import * as THREE from 'three';
import {groundHeight} from '@/core/constants.ts';
import {state} from '@/core/state.ts';
import {camera} from '@/core/engine.ts';
import {AC,master,blip} from '@/audio/audio.ts';
import {tr} from '@/core/i18n.ts';
import {player,playerPos} from '@/actors/player.ts';
import {setTod} from '@/world/daynight.ts';

// ============================================================================
// CINEMATIC CUT-SCENES — cinema bars, typed movie subtitles advanced by the player,
// a synth "voice" per speaker and a directed camera with hard cuts between shots.
// Two directors share the same subtitle/voice machine:
//   • DUO   — two characters facing each other (playCutscene: Rick, the crooked cop):
//             wide two-shot, over-the-shoulder close-up and reverse, cut per line.
//   • PHONE — a call at a phone booth (playPhoneCall: the story, js/story/story.ts):
//             the player stands in the booth with the receiver at the ear while the
//             caller is only a voice; the camera cuts between angles around the booth.
// Also home to the MISSION PASSED card and the end-of-story card.
// ============================================================================

export interface Voice { freq: number; type: OscillatorType; phone?: boolean; }
/** One subtitle. `who` is the speaker tag shown above it; `by` says whose mouth moves. */
export interface CineLine { text: string; who?: string; voice?: Voice; by?: 'npc'|'player'; }

// Minimal actor the DUO director needs (the NPC's doll).
interface CineActor { ped: THREE.Object3D; }

// #cine-sub holds a speaker tag (.who) above the typed line (.txt).
const subBox=document.getElementById('cine-sub') as HTMLElement;
const whoEl=subBox.querySelector('.who') as HTMLElement | null;
const subEl=(subBox.querySelector('.txt') as HTMLElement | null)??subBox;
const hintEl=document.getElementById('cine-hint') as HTMLElement | null;

type Mode='duo'|'phone'|'solo';
/** Per-frame hook for the scene's owner: scene time, who is talking now, and the phase —
 *  'intro' (a silent opening before the first line), 'lines', or 'outro' (a closing shot
 *  after the last line) — with the time spent in that phase. */
export type CinePhase='intro'|'lines'|'outro';
type FrameFn=(t: number,talking: 'npc'|'player'|null,phase: CinePhase,phaseT: number)=>void;
const cine: {
  on: boolean; mode: Mode; t: number; lines: CineLine[]; li: number; txt: string;
  shown: number; charT: number; phase: string;
  voice: Voice; onDone: (() => void) | null; onFrame: FrameFn | null;
  introT: number; outroT: number; phaseT: number;
  side: number; actor: CineActor | null; booth: THREE.Object3D | null; focus: THREE.Vector3;
  shot: string; shotT: number; shotN: number; midCut: boolean;
}={on:false,mode:'duo',t:0,lines:[],li:-1,txt:'',shown:0,charT:0,phase:'type',introT:0,outroT:0,phaseT:0,
  voice:{freq:120,type:'square'},onDone:null,onFrame:null,side:1,actor:null,booth:null,focus:new THREE.Vector3(),
  shot:'wide',shotT:0,shotN:0,midCut:false};

export const cineActive=()=>cine.on;

// "Continue" hint: only once the line has finished typing and the game waits for input.
function showHint(){
  if(!hintEl)return;
  hintEl.textContent=state.mobile?'TAP TO CONTINUE ▸':'SPACE / E ▸';
  hintEl.classList.add('show');
}
function hideHint(){hintEl?.classList.remove('show');}

// Synth voice: one short blip per typed letter. A `phone` voice is band-limited like a
// voice coming down a telephone line.
function voiceTick(v: Voice){
  if(!AC||!master)return;
  const o=AC.createOscillator();o.type=v.type||'square';
  o.frequency.value=v.freq*(1+(Math.random()-.5)*.22);
  const g=AC.createGain();
  if(v.phone){
    const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=1100;f.Q.value=1.4;
    o.connect(f);f.connect(g);
  }else o.connect(g);
  g.connect(master);
  const t=AC.currentTime,peak=v.phone?.09:.045;
  g.gain.setValueAtTime(0,t);
  g.gain.linearRampToValueAtTime(peak,t+.006);
  g.gain.exponentialRampToValueAtTime(.001,t+.055);
  o.start(t);o.stop(t+.07);
}

function begin(mode: Mode,lines: CineLine[],voice: Voice,onDone?: () => void,introT=0,outroT=0){
  cine.on=true;cine.mode=mode;cine.t=0;cine.lines=lines;cine.li=-1;cine.shotN=0;
  cine.voice=voice;cine.onDone=onDone??null;cine.introT=introT;cine.outroT=outroT;cine.phaseT=0;
  state.cine=true;state.dlgActive=true;
  document.body.classList.add('cine');
  subEl.textContent='';if(whoEl)whoEl.textContent='';hideHint();
  if(introT>0){cine.phase='intro';cine.shot='close';cine.shotT=0;}
  else nextLine();
}

// DUO cut-scene with an NPC standing in the world (Rick, the crooked cop...). `ped`
// needs the doll rig (userData.limbs / mouth). The scene is always played at noon.
export function playCutscene(ped: THREE.Object3D,voice: Voice,lines: string[],onDone?: () => void){
  setTod(.5);
  playDialogue(ped,lines.map(text=>({text,by:'npc' as const})),voice,onDone);
}
// DUO with speaker-tagged lines (the NPC's and the player's), at the current time of day.
export function playDialogue(ped: THREE.Object3D,lines: CineLine[],voice: Voice,onDone?: () => void,onFrame?: FrameFn){
  cine.actor={ped};cine.booth=null;cine.onFrame=onFrame??null;
  // the two face each other
  const pp=playerPos();
  const dx=ped.position.x-pp.x,dz=ped.position.z-pp.z;
  player.heading=Math.atan2(dx,dz);player.g.rotation.y=player.heading;
  ped.rotation.y=Math.atan2(-dx,-dz);
  // keep the camera on the side it already is, so it never crosses the line
  const midx=(pp.x+ped.position.x)/2,midz=(pp.z+ped.position.z)/2;
  cine.side=((camera.position.x-midx)*dz+(camera.position.z-midz)*-dx)>=0?1:-1;
  begin('duo',lines,voice,onDone);
}

// PHONE call at a booth: the player is already standing in it (see story.ts). The
// caller is only a voice; `onFrame` lets the story pose the player (receiver at the
// ear, free hand gesturing) every frame, told who is talking.
export function playPhoneCall(opts: {booth: THREE.Object3D; lines: CineLine[]; voice: Voice;
  onFrame?: FrameFn; onDone?: () => void}){
  cine.actor=null;cine.booth=opts.booth;cine.onFrame=opts.onFrame??null;
  begin('phone',opts.lines,opts.voice,opts.onDone);
}

// SOLO: the player alone, thinking out loud while looking toward `focus` (after the
// burial: sitting on the summit, smoking). The player is turned to face it. `introT`
// seconds of silent opening and `outroT` of closing shot bracket the lines; `onFrame`
// poses the player through all of it.
export function playMonologue(opts: {focus: THREE.Vector3; lines: CineLine[]; voice: Voice; onDone?: () => void;
  onFrame?: FrameFn; introT?: number; outroT?: number}){
  cine.actor=null;cine.booth=null;cine.onFrame=opts.onFrame??null;cine.focus.copy(opts.focus);
  const p=player.g.position;
  player.heading=Math.atan2(opts.focus.x-p.x,opts.focus.z-p.z);player.g.rotation.set(0,player.heading,0);
  begin('solo',opts.lines,opts.voice,opts.onDone,opts.introT??0,opts.outroT??0);
}

// DUO: wide two-shot on the first/last line, otherwise alternate close / reverse.
function pickDuoShot(li: number,total: number): string{
  if(li===0||li===total-1)return 'wide';
  return li%3===0?'reverse':'close';
}
// PHONE: a fixed cycle of angles around the booth, one per line.
const PHONE_CYCLE=['wide','close','side','over','low','close','high','side','close','wide'];
// SOLO: over the player onto what they look at, their face, then across it back at them.
const SOLO_CYCLE=['wide','close','across','close'];
function cycleShot(): string{
  if(cine.mode==='phone')return PHONE_CYCLE[cine.shotN++%PHONE_CYCLE.length];
  if(cine.mode==='solo')return SOLO_CYCLE[cine.shotN++%SOLO_CYCLE.length];
  return pickDuoShot(cine.li,cine.lines.length);
}

function nextLine(){
  cine.li++;
  if(cine.li>=cine.lines.length){
    if(cine.outroT>0&&cine.phase!=='outro'){            // the closing shot, no subtitle
      cine.phase='outro';cine.phaseT=0;cine.shot='wide';cine.shotT=0;
      subEl.textContent='';if(whoEl)whoEl.textContent='';hideHint();
      return;
    }
    return endCutscene();
  }
  const line=cine.lines[cine.li];
  cine.txt=tr(line.text);cine.shown=0;cine.charT=0;cine.phase='type';
  cine.shot=cycleShot();
  cine.shotT=0;cine.midCut=false;
  subEl.textContent='';
  if(whoEl)whoEl.textContent=line.who?tr(line.who):'';
  hideHint();
}

// Advances ONLY on player input (it never runs by itself): the first press reveals a
// line still typing; once complete, the next press moves on (or ends the scene).
// Wired to keyboard/click (input.ts) and to a tap on mobile.
export function advanceCine(){
  if(!cine.on)return false;
  if(cine.phase==='intro'){nextLine();return true;}     // skip the silent opening
  if(cine.phase==='outro'){endCutscene();return true;}
  if(cine.phase==='type'&&cine.shown<cine.txt.length){
    cine.shown=cine.txt.length;
    subEl.textContent=cine.txt;
    cine.phase='hold';
    showHint();
    return true;
  }
  nextLine();
  return true;
}

function restLimbs(g: THREE.Object3D | undefined){
  const l=g?.userData.limbs;
  if(l){
    l.rightArm.rotation.set(0,0,-.12);l.leftArm.rotation.set(0,0,.12);
    l.rightForearm?.rotation.set(0,0,0);l.leftForearm?.rotation.set(0,0,0);
  }
  const mouth=g?.userData.mouth;
  if(mouth){mouth.scale.y=1;mouth.visible=false;}
}
function endCutscene(){
  cine.on=false;state.cine=false;state.dlgActive=false;
  document.body.classList.remove('cine');
  subEl.textContent='';
  if(whoEl)whoEl.textContent='';
  hideHint();
  if(cine.mode==='duo')restLimbs(cine.actor?.ped);
  const mouth=player.g.userData.mouth;
  if(mouth){mouth.scale.y=1;mouth.visible=false;}
  const fn=cine.onDone;cine.onDone=null;cine.onFrame=null;fn&&fn();
}

// Mouth flapping + hands gesturing while a doll talks.
export function setTalkPose(ped: THREE.Object3D | null | undefined,t: number,talking: boolean,arms=true){
  if(!ped)return;
  const l=ped.userData.limbs;
  if(l&&arms){
    if(talking){
      l.rightArm.rotation.x=-.55+Math.sin(t*2.6)*.4;
      l.leftArm.rotation.x=-.3+Math.sin(t*1.9+1.4)*.32;
      l.rightArm.rotation.z=-.28-Math.max(0,Math.sin(t*1.3))*.2;
      l.leftArm.rotation.z=.18;
      if(l.rightForearm)l.rightForearm.rotation.x=-.5-Math.max(0,Math.sin(t*2.2))*.4;
      if(l.leftForearm)l.leftForearm.rotation.x=-.3-Math.max(0,Math.sin(t*1.6+.7))*.3;
    }else{
      l.rightArm.rotation.x*=.85;l.leftArm.rotation.x*=.85;
      l.rightArm.rotation.z=-.12;l.leftArm.rotation.z=.12;
      if(l.rightForearm)l.rightForearm.rotation.x*=.85;
      if(l.leftForearm)l.leftForearm.rotation.x*=.85;
    }
  }
  const mouth=ped.userData.mouth;
  if(mouth){mouth.visible=talking;mouth.scale.y=talking?1+Math.abs(Math.sin(t*16))*5:1;}
}

// ---- camera directors ------------------------------------------------------
const _c=new THREE.Vector3(),_l=new THREE.Vector3();
// The shot FOVs are vertical and tuned for a landscape screen; on a portrait screen (a
// 9:16 video, a tall window) keep ~2/3 of the landscape horizontal view instead, like
// the gameplay camera does (player.ts portraitFov), so the shots don't become a tunnel.
function shotFov(v: number): number{
  const a=camera.aspect;
  if(a>=1)return v;
  const h=2*Math.atan(Math.tan(v*Math.PI/360)*16/9)*.66;
  return Math.min(100,2*Math.atan(Math.tan(h/2)/a)*180/Math.PI);
}
function aimCamera(fov: number){
  camera.position.copy(_c);
  camera.fov=shotFov(fov);
  camera.updateProjectionMatrix();
  camera.lookAt(_l);
}

function directDuo(){
  const pp=playerPos(),np=cine.actor!.ped.position;
  let dx=np.x-pp.x,dz=np.z-pp.z;
  const gap=Math.max(2,Math.hypot(dx,dz));dx/=gap;dz/=gap;
  const px=dz*cine.side,pz=-dx*cine.side;
  const push=Math.min(.5,cine.shotT*.05); // slow push-in within a shot
  let fov;
  if(cine.shot==='close'){           // over the player's shoulder, tight on the NPC
    _c.set(pp.x-dx*(1.15-push*.6)+px*.8,0,pp.z-dz*(1.15-push*.6)+pz*.8);
    _c.y=groundHeight(_c.x,_c.z)+1.62;
    _l.set(np.x,np.y+1.5,np.z);fov=34;
  }else if(cine.shot==='reverse'){   // reverse angle: the player's reaction
    _c.set(np.x+dx*(1.15-push*.6)+px*.8,0,np.z+dz*(1.15-push*.6)+pz*.8);
    _c.y=groundHeight(_c.x,_c.z)+1.62;
    _l.set(pp.x,pp.y+1.5,pp.z);fov=34;
  }else{                             // wide side two-shot
    const midx=(pp.x+np.x)/2,midz=(pp.z+np.z)/2;
    const dist=Math.max(5.2,gap*1.7)-push*1.6;
    const drift=Math.sin(cine.t*.25)*1.1;
    _c.set(midx+px*dist+dx*drift,0,midz+pz*dist+dz*drift);
    _c.y=Math.max(groundHeight(midx,midz),groundHeight(_c.x,_c.z))+1.7;
    _l.set(midx,groundHeight(midx,midz)+1.25,midz);fov=44;
  }
  aimCamera(fov);
}

// Booth-local camera set-ups (the booth opens toward +z; the caller stands at z≈.12
// facing the phone on the back wall). `drift` is how far the camera dollies over a shot.
const PHONE_SHOTS: Record<string,{cam: [number,number,number]; look: [number,number,number]; fov: number; drift: [number,number,number]}>={
  wide:{cam:[2.5,1.75,4.8],look:[0,1.35,0],fov:40,drift:[-.6,0,-.7]},           // from the street
  close:{cam:[.55,1.68,-.42],look:[0,1.6,.06],fov:44,drift:[-.06,0,.04]},        // on the face (the receiver is on the -x side)
  side:{cam:[1.8,1.55,.3],look:[0,1.58,.1],fov:40,drift:[-.25,0,.1]},           // profile through the glass, receiver side away
  over:{cam:[.38,1.78,1.05],look:[-.08,1.45,-.5],fov:40,drift:[0,0,-.15]},       // over the shoulder onto the phone
  low:{cam:[-1.4,.3,2.7],look:[0,2.15,0],fov:52,drift:[.35,0,0]},               // low angle up at the booth + sign
  high:{cam:[1.6,4.4,2.3],look:[0,1.1,0],fov:48,drift:[0,-.35,0]},              // looking down from above
};
function directPhone(){
  const b=cine.booth!;
  const s=PHONE_SHOTS[cine.shot]||PHONE_SHOTS.wide;
  const k=Math.min(1,cine.shotT/6);
  const e=k*k*(3-2*k);
  _c.set(s.cam[0]+s.drift[0]*e,s.cam[1]+s.drift[1]*e,s.cam[2]+s.drift[2]*e);
  _l.set(s.look[0],s.look[1],s.look[2]);
  b.updateMatrixWorld();
  b.localToWorld(_c);b.localToWorld(_l);
  _c.y=Math.max(_c.y,groundHeight(_c.x,_c.z)+.2);
  aimCamera(s.fov);
}

function directSolo(){
  const p=player.g.position,f=cine.focus;
  let dx=f.x-p.x,dz=f.z-p.z;const d=Math.max(.5,Math.hypot(dx,dz));dx/=d;dz/=d;
  const sx=dz,sz=-dx;                                   // sideways
  const k=Math.min(1,cine.shotT/6),e=k*k*(3-2*k);
  let fov;
  if(cine.shot==='close'){                               // the face, from slightly off-axis
    _c.set(p.x+dx*(1.3-e*.15)+sx*.45,p.y+1.62,p.z+dz*(1.3-e*.15)+sz*.45);
    _l.set(p.x,p.y+1.58,p.z);fov=38;
  }else if(cine.shot==='across'){                        // low, from beyond the graves back at the player
    _c.set(f.x+dx*2.2+sx*(2.4-e*.6),0,f.z+dz*2.2+sz*(2.4-e*.6));
    _c.y=groundHeight(_c.x,_c.z)+.75;
    _l.set(p.x,p.y+1.1,p.z);fov=46;
  }else{                                                 // over the shoulder, onto the graves
    _c.set(p.x-dx*(3.4-e*.6)+sx*1.5,0,p.z-dz*(3.4-e*.6)+sz*1.5);
    _c.y=groundHeight(_c.x,_c.z)+2.5;
    _l.set((p.x+f.x)/2,groundHeight(f.x,f.z)+.5,(p.z+f.z)/2);fov=48;
  }
  aimCamera(fov);
}

// Fade the screen to black with a caption ("HOURS LATER..."), run `onBlack` while it is
// dark (set the scene up behind the curtain), then fade back in and call `onDone`.
export function fadeThrough(caption: string,onBlack: () => void,onDone?: () => void){
  const el=document.getElementById('story-fade') as HTMLElement|null;
  const txt=el?.querySelector('.txt') as HTMLElement|null;
  if(!el){onBlack();onDone?.();return;}
  if(txt)txt.textContent=tr(caption);
  el.classList.add('on');
  setTimeout(()=>{
    onBlack();
    setTimeout(()=>{el.classList.remove('on');setTimeout(()=>onDone?.(),900);},1700);
  },1000);
}

// Run by the story update, AFTER the regular camera update (the cut-scene owns it).
export function updateCutscene(dt: number){
  if(!cine.on)return;
  cine.t+=dt;
  if(cine.phase==='type'){
    const STEP=.034;
    cine.charT+=dt;
    const line=cine.lines[cine.li];
    const v=line?.voice??cine.voice;
    while(cine.charT>=STEP&&cine.shown<cine.txt.length){
      cine.charT-=STEP;cine.shown++;
      const ch=cine.txt[cine.shown-1];
      if(/[\p{L}\p{N}]/u.test(ch))voiceTick(v);
    }
    subEl.textContent=cine.txt.slice(0,cine.shown);
    if(cine.shown>=cine.txt.length){
      cine.phase='hold'; // fully typed: wait for the player (never auto-advances)
      showHint();
    }
  }
  // the silent opening and the closing shot run on their own clocks
  if(cine.phase==='intro'){
    cine.phaseT+=dt;
    const want=cine.phaseT<cine.introT*.55?'close':'wide';
    if(want!==cine.shot){cine.shot=want;cine.shotT=0;}
    if(cine.phaseT>=cine.introT)nextLine();
  }else if(cine.phase==='outro'){
    cine.phaseT+=dt;
    if(cine.phaseT>=cine.outroT){endCutscene();return;}
  }
  const typing=cine.phase==='type';
  const by=cine.lines[cine.li]?.by??'npc';
  const talking=typing?by:null;
  if(cine.mode==='duo')setTalkPose(cine.actor?.ped,cine.t,talking==='npc');
  if(cine.mode!=='phone')setTalkPose(player.g,cine.t,talking==='player');
  const phase: CinePhase=cine.phase==='intro'?'intro':cine.phase==='outro'?'outro':'lines';
  cine.onFrame?.(cine.t,talking,phase,phase==='lines'?cine.t:cine.phaseT);

  // a long line gets an extra cut halfway through, like a film edit
  if(typing&&!cine.midCut&&cine.txt.length>110&&cine.shown>=cine.txt.length*.55){
    cine.midCut=true;cine.shotT=0;
    cine.shot=cine.mode==='duo'?(cine.shot==='close'?'reverse':'close'):cycleShot();
  }
  cine.shotT+=dt;
  if(cine.mode==='phone')directPhone();else if(cine.mode==='solo')directSolo();else directDuo();
}

// ---------------------------------------------------------------------------
// Two-bone reach: puts a doll's hand on a world point by rotating the upper arm and
// forearm bones (a few CCD passes from a seeded bend, so the elbow folds naturally).
// Used to hold a phone receiver at the ear in third person.
// ---------------------------------------------------------------------------
const HAND_OFF=new THREE.Vector3(.03,-.34,0);  // hand centre in forearm-bone space (pedestrian.ts)
const _bp=new THREE.Vector3(),_ep=new THREE.Vector3(),_a=new THREE.Vector3(),_b=new THREE.Vector3();
const _q=new THREE.Quaternion(),_pq=new THREE.Quaternion(),_pqi=new THREE.Quaternion();
export function reachHand(ped: THREE.Object3D,side: 'right'|'left',target: THREE.Vector3){
  const l=ped.userData.limbs;if(!l)return;
  const upper: THREE.Object3D=side==='right'?l.rightArm:l.leftArm;
  const fore: THREE.Object3D=side==='right'?l.rightForearm:l.leftForearm;
  if(!upper||!fore)return;
  const s=side==='right'?1:-1;
  upper.rotation.set(-.6,0,.5*s);fore.rotation.set(-1.9,0,0);   // seed: elbow out and down
  ped.updateMatrixWorld(true);
  for(let it=0;it<6;it++){
    for(const bone of[fore,upper]){
      bone.getWorldPosition(_bp);
      _ep.copy(HAND_OFF).applyMatrix4(fore.matrixWorld);
      _a.subVectors(_ep,_bp);_b.subVectors(target,_bp);
      if(_a.lengthSq()<1e-8||_b.lengthSq()<1e-8)continue;
      _q.setFromUnitVectors(_a.normalize(),_b.normalize());
      bone.parent!.getWorldQuaternion(_pq);_pqi.copy(_pq).invert();
      // world-space rotation q applied to the bone: local' = parentInv * q * parent * local
      bone.quaternion.premultiply(_pq).premultiply(_q).premultiply(_pqi);
      bone.updateMatrixWorld(true);
    }
  }
}

// ---------------------------------------------------------------------------
// MISSION PASSED card and the end-of-story card
// ---------------------------------------------------------------------------
export function showMissionPass(title: string,sub: string,after?: () => void){
  const el=document.getElementById('missionpass') as HTMLElement;
  (document.getElementById('mp-mission') as HTMLElement).textContent=tr(title);
  (document.getElementById('mp-respect') as HTMLElement).textContent=tr(sub);
  el.style.display='flex';
  setTimeout(()=>(document.getElementById('mp-bar-fill') as HTMLElement).style.width='78%',60);
  blip([392,523,659,784,1047,1319],.10,'sine',.20);
  setTimeout(()=>{
    el.style.display='none';
    (document.getElementById('mp-bar-fill') as HTMLElement).style.width='0';
    after&&after();
  },5600);
}

export function showStoryEnd(){
  const el=document.getElementById('prologue-end') as HTMLElement;
  el.classList.add('show');
  blip([523,659,784,1047,1319,1568],.12,'sine',.2);
  setTimeout(()=>el.classList.remove('show'),9000);
}
