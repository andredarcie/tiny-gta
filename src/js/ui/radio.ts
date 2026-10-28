import {AC,master} from '@/audio/audio.ts';
import {state,refs} from '@/core/state.ts';

// The car radio. Each station is an endless programme of its own songs and vinheta, composed
// for Divinolândia and its region (audio/radio/songs.ts) and synthesised sample by sample —
// physically modelled strings, reeds and drums (audio/radio/dsp.ts) — in a Web Worker
// (audio/radio/worker.ts), so the game's frame never pays for it. This module only queues
// the rendered chunks on the Web Audio clock, a few seconds ahead, and shows the station and
// the song on the radio HUD.
interface Station { name: string; tag: string; col: string; id: string | null; }
interface RadioNode { n: AudioScheduledSourceNode; end: number; }
interface ChunkMsg { type: 'chunk'; gen: number; l: Float32Array; r: Float32Array; events: {at: number; title: string; artist: string; jingle: boolean}[]; }

export const STATIONS: Station[]=[
  {name:'BATIDÃO FM 98.3',     tag:'FUNK DO INTERIOR',              col:'#ff2e88', id:'batidao'},
  {name:'PAGODÃO 104.5',       tag:'PAGODE E SAMBA DE RODA',        col:'#ffd24a', id:'pagode'},
  {name:'ARRASTA-PÉ FM 92.7',  tag:'FORRÓ PÉ-DE-SERRA E PISEIRO',   col:'#19e3ff', id:'forro'},
  {name:'MODÃO FM 107.1',      tag:'MODA DE VIOLA E SERTANEJO RAIZ',col:'#9dff2e', id:'sertao'},
  {name:'RÁDIO DESLIGADO',     tag:'',                              col:'#666666', id:null},
];
export let stationIdx=0;
let radioActive=false,radioGain: GainNode | null=null,radioNodes: RadioNode[]=[];
let radioHudTimer: ReturnType<typeof setTimeout> | null=null;
const hudTimers: ReturnType<typeof setTimeout>[]=[];

// Music bus volume (0..~0.6). Cached so a value set BEFORE the radio bus exists
// (settings applies at boot) is used when radioInit() finally builds radioGain,
// and so setMusicVolume can retune the station volume live from the pause menu.
let musicVol=.26;
// the rendered music is mastered near full scale: the bus brings it to the old level
const LEVEL=1.6;
export function setMusicVolume(v: number): void {
  musicVol=Math.max(0,Math.min(.6,Number(v)||0));
  if(radioGain)radioGain.gain.value=musicVol*LEVEL;
}

function overkillActive(): boolean {return !!refs.getOverkillState?.()?.active;}

export function radioInit(): void {
  if(!AC||radioGain)return;
  radioGain=AC.createGain();radioGain.gain.value=musicVol*LEVEL;radioGain.connect(master!);
}

// ------------------------------------------------------------------ the renderer
// gen: bumped on every tune/stop, so a chunk rendered for a station no longer playing is dropped
let worker: Worker | null=null,workerFailed=false,gen=0,nextTime=0,pending=false;
type Local={next:(sec:number)=>{l:Float32Array;r:Float32Array;events:ChunkMsg['events']}};
let local: Local | null=null;            // fallback without workers: render on the main thread
const AHEAD=4,CHUNK=1.5;

function onChunk(m: ChunkMsg): void {
  pending=false;
  if(m.gen!==gen||!radioActive||!AC||!radioGain)return;
  const n=m.l.length;
  if(n){
    const buf=AC.createBuffer(2,n,AC.sampleRate);
    buf.copyToChannel(m.l as Float32Array<ArrayBuffer>,0);buf.copyToChannel(m.r as Float32Array<ArrayBuffer>,1);
    if(nextTime<AC.currentTime+.03)nextTime=AC.currentTime+.06;     // (an underrun: start again just ahead)
    const s=AC.createBufferSource();s.buffer=buf;s.connect(radioGain);s.start(nextTime);
    const end=nextTime+buf.duration;radioNodes.push({n:s,end});
    // the HUD names each song as it begins
    for(const e of m.events){
      const at=nextTime+e.at/AC.sampleRate,ms=Math.max(0,(at-AC.currentTime)*1000);
      hudTimers.push(setTimeout(()=>{if(radioActive&&m.gen===gen)_radioHudShow(e.jingle?undefined:`♪ ${e.title} — ${e.artist}`);},ms));
    }
    nextTime=end;
    const now=AC.currentTime;radioNodes=radioNodes.filter(x=>x.end>now-.1);
  }
  pump();
}
function request(sec: number): void {
  pending=true;
  if(worker){worker.postMessage({type:'more',gen,sec});return;}
  const g=gen;
  setTimeout(()=>{if(g!==gen||!local){pending=false;return;}const c=local.next(sec);onChunk({type:'chunk',gen:g,...c});},0);
}
// keep AHEAD seconds queued
function pump(): void {
  if(!radioActive||!AC||pending)return;
  if(nextTime-AC.currentTime<AHEAD)request(CHUNK);
  else setTimeout(pump,500);
}
function startStream(station: string): void {
  const seed=(Math.random()*2**31)|0;
  if(!worker&&!workerFailed&&typeof Worker!=='undefined'){
    try{
      worker=new Worker(new URL('../audio/radio/worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(e: MessageEvent)=>onChunk(e.data as ChunkMsg);
      worker.onerror=()=>{workerFailed=true;worker?.terminate();worker=null;if(radioActive)radioOn();};
    }catch{workerFailed=true;worker=null;}
  }
  nextTime=AC!.currentTime+.12;pending=false;
  if(worker){worker.postMessage({type:'start',gen,station,rate:AC!.sampleRate,seed});pump();return;}
  const g=gen;
  void import('@/audio/radio/engine.ts').then(({RadioStream})=>{
    if(g!==gen||!radioActive)return;
    local=new RadioStream(station,AC!.sampleRate,seed);pump();
  });
}

export function radioOff(): void {
  gen++;radioActive=false;pending=false;local=null;
  worker?.postMessage({type:'stop'});
  const t=AC?AC.currentTime+.05:0;
  for(const e of radioNodes)try{e.n.stop(t);}catch{/* already stopped */}
  radioNodes=[];
  while(hudTimers.length)clearTimeout(hudTimers.pop());
  _radioHudHide();
}

export function radioOn(): void {
  if(overkillActive()){radioOff();return;}
  radioInit();radioOff();
  const st=STATIONS[stationIdx];
  if(!st.id||!radioGain||!AC){_radioHudShow();return;}
  radioActive=true;
  startStream(st.id);
  _radioHudShow();
}

// Tune to station `i` and play it now (also works on foot — used by the video director
// to lay the game's own music under a scene).
export function radioPlay(i: number): void {
  stationIdx=((i%STATIONS.length)+STATIONS.length)%STATIONS.length;
  radioOn();
}

// Got in a car: pick a random music station (never the switched-off one)
export function radioRandom(): void {
  stationIdx=Math.floor(Math.random()*(STATIONS.length-1));
}

// Got in a car: pick a random station (the countryside no longer forces the
// sertanejo one — MODÃO FM stays on the dial to tune by hand).
export function radioEnter(): void { radioRandom(); }

export function radioSwitch(): void {
  if(overkillActive()){radioOff();return;}
  stationIdx=(stationIdx+1)%STATIONS.length;
  _radioStatic();
  if(state.mode==='car')radioOn();else _radioHudShow();
}

function _radioHudShow(song?: string): void {
  const st=STATIONS[stationIdx];
  const el=document.getElementById('radio-hud')!;
  document.getElementById('radio-name')!.textContent=st.name;
  (document.getElementById('radio-name') as HTMLElement).style.color=st.col;
  document.getElementById('radio-tag')!.textContent=song??st.tag;
  el.classList.add('show');
  clearTimeout(radioHudTimer as ReturnType<typeof setTimeout>);
  radioHudTimer=setTimeout(()=>el.classList.remove('show'),song?4500:3200);
}

function _radioHudHide(): void {
  clearTimeout(radioHudTimer as ReturnType<typeof setTimeout>);
  document.getElementById('radio-hud')!.classList.remove('show');
}

// the hiss of turning the dial
function _radioStatic(): void {
  if(!AC||!master)return;
  const len=Math.floor(AC.sampleRate*.12),buf=AC.createBuffer(1,len,AC.sampleRate);
  const d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const s=AC.createBufferSource();s.buffer=buf;
  const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=3200;f.Q.value=.6;
  const g=AC.createGain();g.gain.value=.22;
  s.connect(f).connect(g).connect(master);s.start();
}
