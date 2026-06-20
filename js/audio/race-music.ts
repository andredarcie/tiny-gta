import {AC,master} from '@/audio/audio.js';

// Trilha EXCLUSIVA da corrida de rua (Web Audio puro, sem asset). Independente
// do rádio do carro: liga só no GO e desliga no fim/abandono. Synthwave veloz
// (~150 BPM): bumbo em 4 na pista, baixo serrilhado correndo, arpejo maior
// brilhante e lead nervoso — clima de perseguição/corrida noturna.

let gain: GainNode|null=null,sched: ReturnType<typeof setTimeout>|null=null,on=false,noiseBuf: AudioBuffer|null=null;

function ensureGain(){
  if(!AC||gain)return;
  gain=AC.createGain();gain.gain.value=0;gain.connect(master!);
}
function noise(): AudioBuffer{
  if(noiseBuf)return noiseBuf;
  const b=AC!.createBuffer(1,Math.floor(AC!.sampleRate*.5),AC!.sampleRate);
  const d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  return noiseBuf=b;
}
function kick(t: number,v=1){
  const o=AC!.createOscillator(),g=AC!.createGain();
  o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(48,t+.1);
  g.gain.setValueAtTime(.95*v,t);g.gain.exponentialRampToValueAtTime(.001,t+.16);
  o.connect(g).connect(gain!);o.start(t);o.stop(t+.18);
}
function hat(t: number,v=1){
  const s=AC!.createBufferSource();s.buffer=noise();
  const hp=AC!.createBiquadFilter();hp.type='highpass';hp.frequency.value=7600;
  const g=AC!.createGain();g.gain.setValueAtTime(.14*v,t);g.gain.exponentialRampToValueAtTime(.001,t+.04);
  s.connect(hp).connect(g).connect(gain!);s.start(t);s.stop(t+.06);
}
function snare(t: number,v=1){
  const s=AC!.createBufferSource();s.buffer=noise();
  const bp=AC!.createBiquadFilter();bp.type='bandpass';bp.frequency.value=2000;bp.Q.value=.8;
  const g=AC!.createGain();g.gain.setValueAtTime(.3*v,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);
  s.connect(bp).connect(g).connect(gain!);s.start(t);s.stop(t+.14);
}
function bass(t: number,freq: number,dur: number,v=1){
  const o=AC!.createOscillator();o.type='sawtooth';o.frequency.value=freq;
  const f=AC!.createBiquadFilter();f.type='lowpass';f.frequency.value=520;
  const g=AC!.createGain();g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.4*v,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(f).connect(g).connect(gain!);o.start(t);o.stop(t+dur+.02);
}
function lead(t: number,freq: number,dur: number,v=1){
  const o=AC!.createOscillator();o.type='sawtooth';o.frequency.value=freq;
  const g=AC!.createGain();g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.085*v,t+.004);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g).connect(gain!);o.start(t);o.stop(t+dur+.02);
}

// Progressão maior animada (vi–IV–I–V em Dó): raízes por compasso e arpejo maior
const ROOTS=[110,87.31,130.81,98];       // A, F, C, G
const ARP=[1,1.25,1.5,2];                // tríade maior + oitava

function loop(){
  if(!on||!AC)return;
  const bpm=150,q=60/bpm,s=q/4,now=AC.currentTime+.06,BARS=4,S=BARS*16;
  for(let i=0;i<S;i++){
    const bar=i>>4,step=i&15,t=now+i*s,root=ROOTS[bar];
    if(step%4===0)kick(t,step===0?1:.9);          // bumbo 4 na pista
    if(step===4||step===12)snare(t);              // caixa no contratempo
    hat(t,step%2?1:.55);                          // hats em 16 avos
    if(step%2===0||step===7)bass(t,root,s*1.5);   // baixo correndo
    const a=ARP[step%4]*(bar%2?2:1);              // arpejo brilhante
    if(step%2===0)lead(t,root*2*a,s*.65,.95);
    if(bar===BARS-1&&step>=12)snare(t+s*.5,.5);   // virada no fim do ciclo
  }
  sched=setTimeout(loop,(S*s-.18)*1000);
}

export function raceMusicOn(){
  if(on||!AC)return;
  ensureGain();
  on=true;
  gain!.gain.cancelScheduledValues(AC.currentTime);
  gain!.gain.setTargetAtTime(.28,AC.currentTime,.08); // fade in rápido
  loop();
}
export function raceMusicOff(){
  if(!on)return;
  on=false;clearTimeout(sched!);sched=null;
  if(gain)gain.gain.setTargetAtTime(0,AC!.currentTime,.12); // fade out
}
