import {AC,master} from '@/audio/audio.js';
import {state,refs} from '@/core/state.js';

interface Station { name: string; tag: string; col: string; id: string | null; }
// A scheduled audio node tracked so radioOff can stop it; `end` lets pruneNodes
// drop already-finished nodes.
interface RadioNode { n: AudioScheduledSourceNode; end: number; }
// A station's musical arrangement: a per-step callback driven by the lookahead
// scheduler, plus tempo/length and optional FX-send levels.
interface Song {
  bpm: number;
  bars: number;
  step: (bar: number, step: number, t: number, idx: number) => void;
  delayDiv?: number;
  dfb?: number;
  dwet?: number;
  rwet?: number;
}
// Options bag for the bass voice.
interface BassOpts { cut?: number; q?: number; type?: OscillatorType; spread?: number; sub?: boolean; }

export const STATIONS: Station[]=[
  {name:'BOOMBEAT RADIO 98.3', tag:'FUNK PARTY',        col:'#ff2e88', id:'batidao'},
  {name:'PAGODE RADIO 104.5',  tag:'PAGODE & SAMBA',    col:'#ffd24a', id:'pagode'},
  {name:'GROOVE FM',           tag:'BLACK MUSIC',        col:'#19e3ff', id:'groove'},
  {name:'COUNTRY ROOTS 107.1', tag:'COUNTRY ROOTS',      col:'#9dff2e', id:'sertao'},
  {name:'OFF AIR',             tag:'',                   col:'#666666', id:null},
];
export let stationIdx=0;
let radioActive=false,radioGain: GainNode | null=null,radioNodes: RadioNode[]=[];
let radioHudTimer: ReturnType<typeof setTimeout> | null=null;

// Music bus volume (0..~0.6). Cached so a value set BEFORE the radio bus exists
// (settings applies at boot) is used when radioInit() finally builds radioGain,
// and so setMusicVolume can retune the station volume live from the pause menu.
let musicVol=.26;
export function setMusicVolume(v: number): void {
  musicVol=Math.max(0,Math.min(.6,Number(v)||0));
  if(radioGain)radioGain.gain.value=musicVol;
}

function getAC(): AudioContext | null {return AC;}
function getMaster(): GainNode | null {return master;}
function overkillActive(): boolean {return !!refs.getOverkillState?.()?.active;}
const mtof=(m: number): number=>440*Math.pow(2,(m-69)/12);            // MIDI -> Hz (intervalos certos)

export function radioInit(): void {
  const _AC=getAC(),_master=getMaster();
  if(!_AC||radioGain)return;
  radioGain=_AC.createGain();radioGain.gain.value=musicVol;radioGain.connect(_master!);
}

export function radioOff(): void {
  clearTimeout(schedTimer as ReturnType<typeof setTimeout>);schedTimer=null;
  radioActive=false;curStepFn=null;
  const t=AC?AC.currentTime+.08:0;
  for(const e of radioNodes)try{e.n.stop(t);}catch(_){}
  radioNodes=[];
  _radioHudHide();
}

export function radioOn(): void {
  if(overkillActive()){radioOff();return;}
  radioInit();radioOff();
  const st=STATIONS[stationIdx];
  if(!st.id||!radioGain){_radioHudShow();return;}
  radioActive=true;
  startSong(SONGS[st.id]);
  _radioHudShow();
}

// Entrou no carro: sorteia uma estação de música (nunca a OFF AIR)
export function radioRandom(): void {
  stationIdx=Math.floor(Math.random()*(STATIONS.length-1));
}

// Entrou no carro: sorteia uma estação. NÃO força mais a country ao chegar na
// zona rural — a COUNTRY ROOTS continua na lista pra sintonizar na mão.
export function radioEnter(): void { radioRandom(); }

export function radioSwitch(): void {
  if(overkillActive()){radioOff();return;}
  stationIdx=(stationIdx+1)%STATIONS.length;
  _radioStatic();
  if(state.mode==='car')radioOn();else _radioHudShow();
}

function _radioHudShow(): void {
  const st=STATIONS[stationIdx];
  const el=document.getElementById('radio-hud')!;
  document.getElementById('radio-name')!.textContent=st.name;
  (document.getElementById('radio-name') as HTMLElement).style.color=st.col;
  document.getElementById('radio-tag')!.textContent=st.tag;
  el.classList.add('show');
  clearTimeout(radioHudTimer as ReturnType<typeof setTimeout>);
  radioHudTimer=setTimeout(()=>el.classList.remove('show'),3200);
}

function _radioHudHide(): void {
  clearTimeout(radioHudTimer as ReturnType<typeof setTimeout>);
  document.getElementById('radio-hud')!.classList.remove('show');
}

function _radioStatic(): void {
  const _AC=getAC(),_master=getMaster();
  if(!_AC)return;
  const len=Math.floor(_AC.sampleRate*.12),buf=_AC.createBuffer(1,len,_AC.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const s=_AC.createBufferSource();s.buffer=buf;
  const f=_AC.createBiquadFilter();f.type='bandpass';f.frequency.value=3200;f.Q.value=.6;
  const g=_AC.createGain();g.gain.value=.22;
  s.connect(f).connect(g).connect(_master!);s.start();
}

// ===================================================================
//  FX BUS — criado UMA vez e reaproveitado entre estações (perf):
//  um delay com realimentação (eco/slap sincronizado ao andamento) e
//  um reverb por convolução (IR procedural). As vozes mandam sinal via
//  uma simples conexão (sem nó por nota) — só os melódicos/acordes/caixa
//  entram no reverb; bumbo/baixo ficam secos pra não embolar o grave.
// ===================================================================
let fxDelay: DelayNode | null=null,fxFeedback: GainNode | null=null,fxDelaySend: GainNode | null=null,fxDelayWet: GainNode | null=null,fxReverbSend: GainNode | null=null,fxReverbWet: GainNode | null=null;

function makeIR(dur: number,decay: number): AudioBuffer {
  const rate=AC!.sampleRate,len=Math.max(1,Math.floor(rate*dur));
  const buf=AC!.createBuffer(2,len,rate);
  for(let ch=0;ch<2;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);
  }
  return buf;
}
function ensureFX(): void {
  if(!AC||fxDelaySend)return;
  // --- delay (eco/slap) ---
  fxDelaySend=AC.createGain();fxDelaySend.gain.value=1;
  fxDelay=AC.createDelay(1.5);fxDelay.delayTime.value=.27;
  const dlp=AC.createBiquadFilter();dlp.type='lowpass';dlp.frequency.value=2400;
  fxFeedback=AC.createGain();fxFeedback.gain.value=.3;
  fxDelayWet=AC.createGain();fxDelayWet.gain.value=.14;
  fxDelaySend.connect(fxDelay);fxDelay.connect(dlp);
  dlp.connect(fxFeedback);fxFeedback.connect(fxDelay);   // realimentação
  dlp.connect(fxDelayWet);fxDelayWet.connect(radioGain!);
  // --- reverb (sala curta) ---
  fxReverbSend=AC.createGain();fxReverbSend.gain.value=1;
  const conv=AC.createConvolver();conv.buffer=makeIR(1.4,2.4);
  fxReverbWet=AC.createGain();fxReverbWet.gain.value=.16;
  fxReverbSend.connect(conv);conv.connect(fxReverbWet);fxReverbWet.connect(radioGain!);
}

// ===================================================================
//  VOZES — todas com envelope sem clique (ataque sobe de .0001, nunca
//  setValueAtTime no volume cheio) e empurradas em radioNodes p/ o
//  radioOff conseguir parar. {n,end} permite podar nós já mortos.
// ===================================================================
function _push(n: AudioScheduledSourceNode,end: number): void {radioNodes.push({n,end});}

// bumbo: queda de pitch + envelope curto (seco, sem reverb)
function _rk(t: number,vol=.9,freq=48): void {
  const o=AC!.createOscillator(),g=AC!.createGain();
  o.frequency.setValueAtTime(freq*4.5,t);o.frequency.exponentialRampToValueAtTime(freq,t+.07);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.33);
  o.connect(g).connect(radioGain!);o.start(t);o.stop(t+.36);_push(o,t+.36);
}
// caixa: corpo de ruído + estalo tonal (dá "crack"), com reverb
function _rs(t: number,vol=.45,bright=1): void {
  const len=Math.floor(AC!.sampleRate*.16),buf=AC!.createBuffer(1,len,AC!.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.3);
  const s=AC!.createBufferSource();s.buffer=buf;
  const f=AC!.createBiquadFilter();f.type='bandpass';f.frequency.value=1700*bright;f.Q.value=.7;
  const g=AC!.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
  s.connect(f).connect(g).connect(radioGain!);if(fxReverbSend)g.connect(fxReverbSend);
  s.start(t);s.stop(t+.18);_push(s,t+.18);
  const o=AC!.createOscillator();o.type='triangle';
  o.frequency.setValueAtTime(330,t);o.frequency.exponentialRampToValueAtTime(180,t+.06);
  const og=AC!.createGain();og.gain.setValueAtTime(vol*.5,t);og.gain.exponentialRampToValueAtTime(.001,t+.09);
  o.connect(og).connect(radioGain!);o.start(t);o.stop(t+.1);_push(o,t+.1);
}
// chimbal fechado
function _rh(t: number,vol=.1,dur=.03): void {
  const len=Math.floor(AC!.sampleRate*dur),buf=AC!.createBuffer(1,len,AC!.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const s=AC!.createBufferSource();s.buffer=buf;
  const f=AC!.createBiquadFilter();f.type='highpass';f.frequency.value=8800;
  const g=AC!.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur+.005);
  s.connect(f).connect(g).connect(radioGain!);s.start(t);s.stop(t+dur+.02);_push(s,t+dur+.02);
}
// chimbal aberto (cauda mais longa)
function _roh(t: number,vol=.1): void {
  const len=Math.floor(AC!.sampleRate*.14),buf=AC!.createBuffer(1,len,AC!.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,.6);
  const s=AC!.createBufferSource();s.buffer=buf;
  const f=AC!.createBiquadFilter();f.type='highpass';f.frequency.value=8000;
  const g=AC!.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.13);
  s.connect(f).connect(g).connect(radioGain!);s.start(t);s.stop(t+.15);_push(s,t+.15);
}
// palma: 4 estalos de ruído em fila (clap clássico), com reverb
function _rclap(t: number,vol=.4): void {
  for(const off of[0,.012,.024,.05]){
    const len=Math.floor(AC!.sampleRate*.09),buf=AC!.createBuffer(1,len,AC!.sampleRate);
    const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.2);
    const s=AC!.createBufferSource();s.buffer=buf;
    const f=AC!.createBiquadFilter();f.type='bandpass';f.frequency.value=1500;f.Q.value=.9;
    const g=AC!.createGain();const v=off>.03?vol:vol*.6;
    g.gain.setValueAtTime(v,t+off);g.gain.exponentialRampToValueAtTime(.001,t+off+.09);
    s.connect(f).connect(g).connect(radioGain!);if(fxReverbSend)g.connect(fxReverbSend);
    s.start(t+off);s.stop(t+off+.1);_push(s,t+off+.1);
  }
}
// baixo: 2 dentes-de-serra desafinadas (corpo gordo) por um passa-baixa com
// envelope de filtro (abre e fecha = "funk") + sub-seno uma oitava abaixo (peso)
function _rbass(t: number,freq: number,dur: number,vol=.4,o: BassOpts={}): void {
  const {cut=420,q=4,type='sawtooth',spread=6,sub=true}=o;
  const f=AC!.createBiquadFilter();f.type='lowpass';f.Q.value=q;
  f.frequency.setValueAtTime(Math.min(cut*2.4,7000),t);
  f.frequency.exponentialRampToValueAtTime(cut,t+dur*.55);
  const g=AC!.createGain();
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  const dts=spread?[-spread,spread]:[0];
  for(const dt of dts){
    const osc=AC!.createOscillator();osc.type=type;osc.frequency.value=freq;osc.detune.value=dt;
    osc.connect(f);osc.start(t);osc.stop(t+dur+.03);_push(osc,t+dur+.03);
  }
  f.connect(g).connect(radioGain!);
  if(sub){
    const so=AC!.createOscillator();so.type='sine';so.frequency.value=freq/2;
    const sg=AC!.createGain();
    sg.gain.setValueAtTime(.0001,t);sg.gain.exponentialRampToValueAtTime(vol*.7,t+.012);
    sg.gain.exponentialRampToValueAtTime(.0001,t+dur);
    so.connect(sg).connect(radioGain!);so.start(t);so.stop(t+dur+.03);_push(so,t+dur+.03);
  }
}
// nota simples com ADSR sem clique (membro de acorde / linha rápida)
function _rnote(t: number,freq: number,dur: number,vol=.08,type: OscillatorType='triangle',rev=0,del=0): void {
  const o=AC!.createOscillator();o.type=type;o.frequency.value=freq;
  const g=AC!.createGain();
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.008);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(radioGain!);
  if(rev&&fxReverbSend)g.connect(fxReverbSend);
  if(del&&fxDelaySend)g.connect(fxDelaySend);
  o.start(t);o.stop(t+dur+.03);_push(o,t+dur+.03);
}
function _rchord(t: number,midis: number[],dur: number,vol: number,type: OscillatorType='triangle',rev=0,del=0): void {
  for(const m of midis)_rnote(t,mtof(m),dur,vol,type,rev,del);
}
// pestana dedilhada: rola as cordas com 9ms entre elas (humaniza o acorde)
function _rstrum(t: number,midis: number[],dur: number,vol: number,type: OscillatorType='triangle',rev=1): void {
  midis.forEach((m,k)=>_rnote(t+k*.009,mtof(m),dur,vol,type,rev,0));
}
// linha melódica "gorda": 2 osc desafinados (chorus) + sends opcionais
function _rlead(t: number,freq: number,dur: number,vol=.1,type: OscillatorType='sawtooth',rev=0,del=0): void {
  const g=AC!.createGain();
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.012);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  for(const dt of[-6,7]){
    const o=AC!.createOscillator();o.type=type;o.frequency.value=freq;o.detune.value=dt;
    o.connect(g);o.start(t);o.stop(t+dur+.03);_push(o,t+dur+.03);
  }
  g.connect(radioGain!);
  if(rev&&fxReverbSend)g.connect(fxReverbSend);
  if(del&&fxDelaySend)g.connect(fxDelaySend);
}
// colchão sustentado (acordes longos): ataque lento + reverb pra encher o fundo
function _rpad(t: number,midis: number[],dur: number,vol=.045,type: OscillatorType='sawtooth'): void {
  for(const m of midis){
    const o=AC!.createOscillator();o.type=type;o.frequency.value=mtof(m);o.detune.value=Math.random()*8-4;
    const g=AC!.createGain();
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+dur*.3);
    g.gain.setValueAtTime(vol,t+dur*.7);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(radioGain!);if(fxReverbSend)g.connect(fxReverbSend);
    o.start(t);o.stop(t+dur+.05);_push(o,t+dur+.05);
  }
}
// viola/sanfona: nota com vibrato (LFO na frequência) — só notas longas (poucas)
function _rfiddle(t: number,freq: number,dur: number,vol=.09): void {
  const g=AC!.createGain();
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+.03);
  g.gain.setValueAtTime(vol,t+dur*.6);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  const o=AC!.createOscillator();o.type='sawtooth';o.frequency.value=freq;
  const lfo=AC!.createOscillator();lfo.type='sine';lfo.frequency.value=5.5;
  const lg=AC!.createGain();lg.gain.value=freq*.012;                 // ~12 cents de vibrato
  lfo.connect(lg).connect(o.frequency);
  o.connect(g).connect(radioGain!);if(fxReverbSend)g.connect(fxReverbSend);
  o.start(t);o.stop(t+dur+.05);lfo.start(t);lfo.stop(t+dur+.05);
  _push(o,t+dur+.05);_push(lfo,t+dur+.05);
}

// ===================================================================
//  LOOKAHEAD SCHEDULER (padrão Chris Wilson "A Tale of Two Clocks").
//  Em vez de agendar o loop inteiro de uma vez (rajada de centenas de
//  nós num frame), acorda a cada ~90ms e agenda só os passos dentro de
//  uma janela de 0.7s. Espalha a criação de nós -> sem hitch. Roda só
//  com o rádio ligado; tudo o resto é no audio thread (não toca o FPS).
// ===================================================================
let curStepFn: Song['step'] | null=null,curStepDur=.1,curStepCount=256,nextStepIdx=0,nextNoteTime=0,schedTimer: ReturnType<typeof setTimeout> | null=null;
const LOOKAHEAD=.7,SCHED_TICK=90;

function pruneNodes(now: number): void {            // compacta no lugar (sem alocar) nós já mortos
  let w=0;
  for(let r=0;r<radioNodes.length;r++){const e=radioNodes[r];if(e.end>now-.1)radioNodes[w++]=e;}
  radioNodes.length=w;
}
function scheduler(): void {
  if(!radioActive||!AC||!curStepFn)return;
  if(radioNodes.length>320)pruneNodes(AC.currentTime);
  const ahead=AC.currentTime+LOOKAHEAD;
  while(nextNoteTime<ahead){
    const idx=nextStepIdx%curStepCount;
    curStepFn(idx>>4,idx&15,nextNoteTime,idx);
    nextStepIdx++;nextNoteTime+=curStepDur;
  }
  schedTimer=setTimeout(scheduler,SCHED_TICK);
}
function startSong(song: Song): void {
  ensureFX();
  curStepFn=song.step;curStepDur=(60/song.bpm)/4;curStepCount=song.bars*16;
  nextStepIdx=0;nextNoteTime=AC!.currentTime+.14;
  const now=AC!.currentTime;
  fxDelay!.delayTime.setValueAtTime(curStepDur*(song.delayDiv||3),now); // delay no tempo
  fxFeedback!.gain.setValueAtTime(song.dfb??.3,now);
  fxDelayWet!.gain.setValueAtTime(song.dwet??.14,now);
  fxReverbWet!.gain.setValueAtTime(song.rwet??.16,now);
  scheduler();
}

// ===================================================================
//  MÚSICAS — cada estação é um arranjo de 16 compassos com intro /
//  verso / refrão (seção = bar<2 intro, <10 verso, senão refrão).
//  Padrões e vozes ficam em const de módulo (sem alocar por passo).
// ===================================================================

// ---- BOOMBEAT 98.3 — funk brasileiro, 130 BPM, vi–IV–I–V (Am F C G) ----
const BAT_ROOTS=[110,87.3,130.8,98];                 // A F C G (Hz, ciclo de 4 compassos)
const BAT_CH=[                                        // vozes (MIDI) — encadeamento suave
  [57,60,64,67],                                      // Am7
  [53,57,60,64],                                      // Fmaj7
  [60,64,67,71],                                      // Cmaj7
  [55,59,62,65],                                      // G7
];
const BAT_KICK=[1,0,0,0,0,0,1,0,1,0,0,1,0,1,0,0];     // bumbo sincopado (tamborzão)
const BAT_RIFF=[76,0,79,76,0,72,74,0, 72,0,69,0,72,74,76,0]; // riff pentatônica de Lá m
function batidaoStep(bar: number,step: number,t: number): void {
  const cyc=bar&3,root=BAT_ROOTS[cyc],ch=BAT_CH[cyc];
  const sec=bar<2?0:bar<8?1:2,last=bar===15;
  _rh(t,step%2?.12:.07,step%4===2?.055:.03);          // chimbal 16 avos, acento no contratempo
  if(step===14)_roh(t,.10);
  if(BAT_KICK[step])_rk(t,step===0?1:.86);
  if(sec>0&&(step===4||step===12))_rclap(t,.5);
  if(sec>0&&step===7&&(bar&1))_rs(t,.16,1.4);         // caixa fantasma
  if(BAT_KICK[step]||step===4||step===12){
    const f=(step===11||step===13)?root*1.5:root;
    _rbass(t,f,step%4===3?.18:.30,.42,{cut:380,q:5});
  }
  if(sec>0&&(step===2||step===6||step===10||step===14))
    _rchord(t,ch,.22,.05,'sawtooth',1,0);             // naipe de stabs no contratempo
  if(sec===2&&BAT_RIFF[step])
    _rlead(t,mtof(BAT_RIFF[step]),step%2?.16:.26,.10,'square',1,1);
  if(last&&step>=8&&step%2===0)_rs(t,.28+(step-8)*.02,1); // virada no fim
}

// ---- GROOVE FM — funk/soul, 105 BPM, ii–V–I em Dó (com 9ªs/13ª) ----
const GRV_ROOT=[130.8,110,146.8,98, 130.8,110,146.8,98]; // C A D G (Hz)
const GRV_CH=[
  [60,64,67,71,74],   // Cmaj9
  [57,60,64,67,71],   // Am9
  [62,65,69,72,76],   // Dm9
  [55,59,65,69,74],   // G13
  [60,64,67,71,74],
  [57,60,64,67,71],
  [62,65,69,72,76],
  [55,59,65,69,74],
];
const GRV_BASS=[1,0,0,1,0,1,1,0, 1,0,1,1,0,0,1,0];     // slap em 16 avos
const GRV_LICK=[72,0,0,76,0,79,0,76, 0,74,72,0,69,0,72,0]; // lick pentatônico de Dó
function grooveStep(bar: number,step: number,t: number): void {
  const cyc=bar&7,root=GRV_ROOT[cyc],ch=GRV_CH[cyc];
  const sec=bar<2?0:bar<10?1:2,last=bar===15;
  _rh(t+(step%2?.012:0),step%2?.11:.06,step%4===2?.05:.03); // chimbal com swing
  if(step===14)_roh(t,.09);
  if(step===0||step===8||(step===6&&(bar&1)))_rk(t,step===0?.95:.8);
  if(sec>0&&(step===4||step===12))_rclap(t,.5);        // palmas no 2 e 4
  if(GRV_BASS[step]){
    const oct=(step===3||step===10||step===14)?2:1;
    _rbass(t,root*oct,step%4===2?.16:.24,.42,{cut:300,q:7,spread:7}); // baixo slapado
  }
  if(sec>0&&(step===2||step===7||step===11))_rchord(t,ch,.3,.05,'triangle',1,0); // Rhodes em stabs
  if(sec>0&&step===0&&(bar&1)===0)_rpad(t,ch,curStepDur*14,.028,'sawtooth');      // colchão leve
  if(sec===2&&GRV_LICK[step])_rlead(t,mtof(GRV_LICK[step]),step%2?.14:.22,.085,'sawtooth',0,1); // wah lead
  if(last&&step>=10&&step%2===0)_rclap(t,.4);
}

// ---- PAGODE 104.5 — samba/pagode, 95 BPM, roda de acordes em Sol ----
const PAG_ROOT=[98,123.5,82.4,110, 110,146.8,98,146.8]; // G B E A / A D G D (Hz)
const PAG_CH=[
  [67,71,74,78],   // Gmaj7
  [69,71,74,78],   // Bm7
  [64,67,71,74],   // Em7
  [67,69,73,76],   // A7
  [67,69,72,76],   // Am7
  [62,66,69,72],   // D7
  [67,71,74,78],   // Gmaj7
  [62,66,69,72],   // D7
];
const PAG_MEL=[79,0,78,0,76,0,74,0, 71,0,74,76,78,0,79,0]; // frase de cavaco/flauta em Sol
function pagodeStep(bar: number,step: number,t: number): void {
  const cyc=bar&7,root=PAG_ROOT[cyc],ch=PAG_CH[cyc];
  const sec=bar<2?0:bar<10?1:2;
  const acc=step%4===0?.12:(step%4===2?.085:.05);     // pandeiro: levada de 16 avos acentuada
  _rh(t,acc,step%2?.03:.045);
  if(step===6||step===14)_roh(t,.06);
  if(step===0)_rk(t,.5,46);                            // surdo
  if(step===8)_rk(t,.82,42);                           // surdo forte no "2"
  if(bar===15&&step===12)_rk(t,.7,44);
  if(sec>0&&(step===4||step===12))_rs(t,.2,1.5);       // tamborim/caixa seca
  if(step===0||step===8)_rbass(t,root,.5,.34,{type:'triangle',cut:600,q:1.4,spread:0}); // baixo acústico
  if(step===6||step===14)_rbass(t,root*1.5,.28,.24,{type:'triangle',cut:600,q:1.4,spread:0});
  if(step===11&&(bar&1))_rbass(t,root*1.335,.2,.2,{type:'triangle',cut:600,q:1.4,spread:0});
  if(step===2||step===10)_rstrum(t,ch,.26,.05,'sawtooth',1);   // cavaquinho (batida do samba)
  if(step===6||step===14)_rstrum(t,ch,.2,.045,'sawtooth',1);
  if(step===3||step===7||step===11||step===15)_rchord(t,ch,.12,.03,'sawtooth',1,0);
  if(sec===2&&PAG_MEL[step])_rlead(t,mtof(PAG_MEL[step]),step%2?.2:.34,.075,'triangle',1,1);
}

// ---- COUNTRY ROOTS 107.1 — country/sertanejo, 100 BPM, em Sol maior ----
const SER_ROOT=[98,130.8,98,146.8, 98,82.4,130.8,146.8]; // G C G D / G E C D (Hz)
const SER_CH=[
  [55,59,62,67],   // G
  [60,64,67,72],   // C
  [55,59,62,67],   // G
  [62,66,69,74],   // D
  [55,59,62,67],   // G
  [64,67,71,76],   // Em
  [60,64,67,72],   // C
  [62,66,69,74],   // D
];
const SER_MEL=[                                        // frase de viola/sanfona (Sol maior)
  [79,0,0,76,74,0,72,0, 74,0,76,0,79,0,76,74],
  [83,0,81,0,79,0,76,0, 74,76,79,0,81,0,79,0],
];
function sertaoStep(bar: number,step: number,t: number): void {
  const cyc=bar&7,root=SER_ROOT[cyc],ch=SER_CH[cyc];
  const sec=bar<2?0:bar<10?1:2;
  if(step%2===0)_rh(t,step%4===0?.09:.05,.04);         // chimbal escovado
  if(step===14)_roh(t,.05);
  if(sec>0&&(step===4||step===12))_rs(t,.22,.8);        // caixa com vassourinha no contratempo
  if(step===0||step===8)_rbass(t,root,.42,.34,{type:'triangle',cut:520,q:1.4,spread:0});   // "boom"
  if(step===4||step===12)_rbass(t,root*1.5,.3,.26,{type:'triangle',cut:520,q:1.4,spread:0}); // "chick" (quinta)
  if(step===2||step===6||step===10||step===14)_rstrum(t,ch,.34,.05,'triangle',1);          // violão dedilhado
  if((step===3||step===11)&&(bar&1))_rchord(t,ch,.16,.03,'triangle',1,0);
  if(sec===2){const mel=SER_MEL[bar&1][step];if(mel)_rfiddle(t,mtof(mel),step%2?.22:.4,.09);} // viola c/ vibrato
  if(bar===15&&step>=12&&step%2===0)_rs(t,.2,.9);       // viradinha
}

const SONGS: Record<string, Song>={
  batidao:{bpm:130,bars:16,delayDiv:3,dfb:.30,dwet:.12,rwet:.12,step:batidaoStep},
  pagode :{bpm:95, bars:16,delayDiv:2,dfb:.20,dwet:.08,rwet:.20,step:pagodeStep},
  groove :{bpm:105,bars:16,delayDiv:3,dfb:.32,dwet:.14,rwet:.16,step:grooveStep},
  sertao :{bpm:100,bars:16,delayDiv:3,dfb:.24,dwet:.10,rwet:.18,step:sertaoStep},
};
