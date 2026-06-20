import {AC,master} from '@/audio/audio.js';

// Trilha FRENÉTICA do modo overkill (Web Audio puro, sem asset). Independente do
// rádio do carro: liga só enquanto o modo está ativo. Loop rápido (~176 BPM) com
// bumbo na cara, hi-hats em 16 avos, baixo serrilhado e um arpejo menor tenso.

let gain: GainNode|null=null,sched: ReturnType<typeof setTimeout>|null=null,on=false,noiseBuf: AudioBuffer|null=null;

function ensureGain(): void{
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

function kick(t: number,v=1): void{
  const o=AC!.createOscillator(),g=AC!.createGain();
  o.frequency.setValueAtTime(165,t);o.frequency.exponentialRampToValueAtTime(45,t+.11);
  g.gain.setValueAtTime(.95*v,t);g.gain.exponentialRampToValueAtTime(.001,t+.15);
  o.connect(g).connect(gain!);o.start(t);o.stop(t+.17);
}
function hat(t: number,v=1): void{
  const s=AC!.createBufferSource();s.buffer=noise();
  const hp=AC!.createBiquadFilter();hp.type='highpass';hp.frequency.value=7200;
  const g=AC!.createGain();g.gain.setValueAtTime(.16*v,t);g.gain.exponentialRampToValueAtTime(.001,t+.045);
  s.connect(hp).connect(g).connect(gain!);s.start(t);s.stop(t+.06);
}
function snare(t: number,v=1): void{
  const s=AC!.createBufferSource();s.buffer=noise();
  const bp=AC!.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1900;bp.Q.value=.8;
  const g=AC!.createGain();g.gain.setValueAtTime(.3*v,t);g.gain.exponentialRampToValueAtTime(.001,t+.13);
  s.connect(bp).connect(g).connect(gain!);s.start(t);s.stop(t+.15);
}
function bass(t: number,freq: number,dur: number,v=1): void{
  const o=AC!.createOscillator();o.type='sawtooth';o.frequency.value=freq;
  const f=AC!.createBiquadFilter();f.type='lowpass';f.frequency.value=440;
  const g=AC!.createGain();g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.42*v,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(f).connect(g).connect(gain!);o.start(t);o.stop(t+dur+.02);
}
function lead(t: number,freq: number,dur: number,v=1): void{
  const o=AC!.createOscillator();o.type='square';o.frequency.value=freq;
  const g=AC!.createGain();g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(.1*v,t+.004);g.gain.exponentialRampToValueAtTime(.001,t+dur);
  o.connect(g).connect(gain!);o.start(t);o.stop(t+dur+.02);
}

// Lá menor tenso: raízes por compasso e o arpejo (raiz, 3ªm, 5ª, 8ª)
const ROOTS=[110,98,116.54,87.31];                 // A, G, A#, F
const ARP=[1,1.1892,1.5,2];                         // intervalos menores

function loop(): void{
  if(!on||!AC)return;
  const bpm=176,q=60/bpm,s=q/4,now=AC.currentTime+.06,BARS=4,S=BARS*16;
  for(let i=0;i<S;i++){
    const bar=i>>4,step=i&15,t=now+i*s,root=ROOTS[bar];
    // bumbo: 4 na pista + síncope
    if(step%4===0||step===6||step===14)kick(t,step===0?1:.85);
    // caixa nos contratempos
    if(step===4||step===12)snare(t);
    // hats em todos os 16 avos, acento no offbeat
    hat(t,step%2?1:.6);
    // baixo correndo em 16 avos (pula alguns pra respirar)
    if(step%2===0||step===7||step===11)bass(t,root,s*1.4);
    // arpejo agudo e nervoso
    const a=ARP[step%4]*(bar%2?2:1);
    if(step%2===0)lead(t,root*2*a,s*.7,.9);
    // virada no fim do ciclo
    if(bar===BARS-1&&step>=12)snare(t+s*.5,.5);
  }
  sched=setTimeout(loop,(S*s-.18)*1000);
}

export function overkillMusicOn(): void{
  if(on||!AC)return;
  ensureGain();
  on=true;
  gain!.gain.cancelScheduledValues(AC.currentTime);
  gain!.gain.setTargetAtTime(.3,AC.currentTime,.08); // fade in rápido
  loop();
}
export function overkillMusicOff(): void{
  if(!on)return;
  on=false;clearTimeout(sched!);sched=null;
  if(gain){
    // os osciladores já agendados (até ~5.5s à frente) continuam ligados ao gain ANTIGO;
    // soltamos esse gain (silencia + desconecta depois da fila) e a próxima ativação cria
    // um gain NOVO em loop() -> reativar rápido não empilha/dobra a trilha.
    const g=gain;gain=null;
    g.gain.cancelScheduledValues(AC!.currentTime);
    g.gain.setTargetAtTime(0,AC!.currentTime,.05); // fade out rápido do que já foi agendado
    setTimeout(()=>{try{g.disconnect();}catch(e){}},6000); // limpa após o fim da fila
  }
}
