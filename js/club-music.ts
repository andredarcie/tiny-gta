import {AC,master} from './audio.js';

// ============================================================================
// MÚSICA PRÓPRIA DA BOATE "THE FLAMINGO" — trilha house/electro original,
// sintetizada na hora (sem assets), tocada enquanto o jogador está dentro do
// clube (ver js/club.js liga/desliga no teleporte da porta).
//
// É um loop de 8 compassos (16s a 120 BPM) com kick four-on-the-floor, clap nos
// tempos 2 e 4, hats, baixo house de contratempo e um arpejo de lead numa
// progressão em lá menor (Am-F-C-G...). TUDO é agendado ANTES no relógio do
// AudioContext, ancorado num t0 fixo — então o mini-game da dança
// (js/dance-game.js) lê clubMusicInfo() e encaixa as setas EXATAMENTE na grade
// de batidas desta música, sem depender de frames (à prova de travadas).
// ============================================================================

const BPM=120;
export const BEAT=60/BPM;        // 0.5s por tempo
export const STEP=BEAT/4;        // 0.125s por semicolcheia (16 por compasso)
export const BAR=BEAT*4;         // 2s por compasso
export const BARS=8;             // compassos no loop
export const LOOP=BAR*BARS;      // 16s por loop

// progressão de acordes (lá menor): raiz do baixo por compasso
const ROOTS=[110.00,87.31,130.81,98.00, 110.00,87.31,98.00,82.41]; // A F C G A F G E
// tríades (oitava média) por compasso, pro stab/arpejo
const CHORDS=[
  [220.00,261.63,329.63], // Am  A C E
  [174.61,220.00,261.63], // F   F A C
  [261.63,329.63,392.00], // C   C E G
  [196.00,246.94,293.66], // G   G B D
  [220.00,261.63,329.63], // Am
  [174.61,220.00,261.63], // F
  [196.00,246.94,293.66], // G
  [164.81,207.65,246.94], // E   E G# B
];

let gain:GainNode|null=null,on=false,t0=0,nextLoop=0,timer:ReturnType<typeof setTimeout>|null=null;
const nodes:AudioScheduledSourceNode[]=[];

function ensureGain(){
  if(gain||!AC)return;
  gain=AC.createGain();gain.gain.value=.34;gain.connect(master!);
}

// ----- sintetizadores (cada um agenda no tempo absoluto t do AudioContext) -----
function kick(t:number,vol:number){
  const o=AC!.createOscillator(),g=AC!.createGain();
  o.frequency.setValueAtTime(150,t);
  o.frequency.exponentialRampToValueAtTime(48,t+.09);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);
  o.connect(g).connect(gain!);o.start(t);o.stop(t+.34);nodes.push(o);
}
function clap(t:number,vol:number){
  const len=Math.floor(AC!.sampleRate*.13),b=AC!.createBuffer(1,len,AC!.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,1.4);
  const s=AC!.createBufferSource();s.buffer=b;
  const f=AC!.createBiquadFilter();f.type='bandpass';f.frequency.value=1700;f.Q.value=.8;
  const g=AC!.createGain();g.gain.value=vol;
  s.connect(f).connect(g).connect(gain!);s.start(t);nodes.push(s);
}
function hat(t:number,vol:number,open:boolean){
  const dur=open?.09:.035,len=Math.floor(AC!.sampleRate*dur),b=AC!.createBuffer(1,len,AC!.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const s=AC!.createBufferSource();s.buffer=b;
  const f=AC!.createBiquadFilter();f.type='highpass';f.frequency.value=8200;
  const g=AC!.createGain();g.gain.value=vol;
  s.connect(f).connect(g).connect(gain!);s.start(t);nodes.push(s);
}
function bass(t:number,freq:number,dur:number,vol:number){
  const o=AC!.createOscillator();o.type='sawtooth';o.frequency.value=freq;
  const f=AC!.createBiquadFilter();f.type='lowpass';f.frequency.value=360;f.Q.value=1.1;
  const g=AC!.createGain();
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(f).connect(g).connect(gain!);o.start(t);o.stop(t+dur+.02);nodes.push(o);
}
function lead(t:number,freq:number,dur:number,vol:number,type:OscillatorType='square'){
  const o=AC!.createOscillator();o.type=type;o.frequency.value=freq;
  const g=AC!.createGain();
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.01);
  g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g).connect(gain!);o.start(t);o.stop(t+dur+.02);nodes.push(o);
}

// agenda um loop inteiro (8 compassos) a partir do tempo absoluto 'start'
function scheduleLoop(start:number){
  for(let bar=0;bar<BARS;bar++){
    const barT=start+bar*BAR,root=ROOTS[bar],ch=CHORDS[bar],isB=bar>=4,last=bar===BARS-1;
    // arpejo do compasso: sobe e desce a tríade (oitava acima), gancho da música
    const arp=[ch[0]*2,ch[1]*2,ch[2]*2,ch[1]*2, ch[2]*2,ch[1]*2,ch[0]*2,ch[1]*2];
    for(let s=0;s<16;s++){
      const t=barT+s*STEP;
      if(s%4===0)kick(t,s===0?1.0:.9);              // four-on-the-floor
      if(s===4||s===12)clap(t,.5);                  // clap nos tempos 2 e 4
      if(s%2===0)hat(t,.10,false);                  // hat fechado nas colcheias
      if(s===2||s===6||s===10||s===14)hat(t,.17,true); // hat aberto no contratempo
      if(s===0)bass(t,root/2,STEP*1.7,.5);          // sub grave no tempo forte
      if(s%4===2)bass(t,root,STEP*1.5,.42);         // baixo house de contratempo
      if(s===7||s===15)bass(t,root*1.5,STEP*.7,.28);
      if(s===0||s===8)lead(t,ch[0],STEP*1.4,.08,'sawtooth'); // stab do acorde
      if(s%2===0)lead(t,arp[s>>1],STEP*.9,isB?.075:.05);     // lead arpejo
      if(last&&s>=12)clap(t,.22);                   // fill no fim do loop
    }
  }
}

function pump(){
  if(!on||!AC)return;
  scheduleLoop(t0+nextLoop*LOOP);
  nextLoop++;
  // re-agenda ~0.5s antes do próximo loop começar (ancorado em t0, sem drift)
  const delay=Math.max(20,(t0+nextLoop*LOOP-.5-AC.currentTime)*1000);
  timer=setTimeout(pump,delay);
}

export function clubMusicOn(){
  if(!AC||on)return;
  ensureGain();
  on=true;nextLoop=0;t0=AC.currentTime+.14;
  if(gain){gain.gain.cancelScheduledValues(AC.currentTime);gain.gain.value=.34;}
  pump();
}

export function clubMusicOff(){
  on=false;clearTimeout(timer as ReturnType<typeof setTimeout>);
  if(!AC)return;
  const t=AC.currentTime;
  if(gain){gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(gain.gain.value,t);
    gain.gain.linearRampToValueAtTime(0,t+.12);}
  for(const n of nodes)try{n.stop(t+.13);}catch(e){}
  nodes.length=0;
}

export function clubMusicActive(){return on;}

// O mini-game da dança usa isto pra alinhar as setas à grade da música.
// Devolve null se a música não estiver tocando.
export function clubMusicInfo(){
  if(!on||!AC)return null;
  return {t0,bpm:BPM,BEAT,STEP,BAR,BARS,LOOP,now:AC.currentTime-t0};
}
