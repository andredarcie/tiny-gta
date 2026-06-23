import {state,input,refs} from '@/core/state.ts';

export let AC:AudioContext|null=null,audioEngine:{o:OscillatorNode;g:GainNode}|null=null,
  siren:{lfo:OscillatorNode;g:GainNode;rate:number}|null=null,
  hornG:GainNode|null=null,master:GainNode|null=null,screechG:GainNode|null=null,heliG:GainNode|null=null;
let fireSirenG:GainNode|null=null,hoseG:GainNode|null=null; // sirene do caminhão de bombeiros + chiado da mangueira

// Master volume (0..1). Cached at module scope so the value set BEFORE initAudio
// (the settings module applies at boot, before the first user gesture) survives:
// initAudio seeds the master gain from it, and setMasterVolume retunes it live.
let masterVol=.5;
export function setMasterVolume(v:number){
  masterVol=Math.max(0,Math.min(1,Number(v)||0));
  if(master)master.gain.value=masterVol;
}

export function initAudio(){
  if(AC)return;
  const ac=AC=new ((window as any).AudioContext||(window as any).webkitAudioContext)() as AudioContext;
  master=ac.createGain();master.gain.value=masterVol;master.connect(ac.destination);
  // Engine — the original simple drone: a single sawtooth through a low-pass, gain
  // and pitch driven by speed in updateAudio.
  const o=ac.createOscillator();o.type='sawtooth';
  const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=620;
  const g=ac.createGain();g.gain.value=0;
  o.connect(f);f.connect(g);g.connect(master);o.start();audioEngine={o,g};
  // Police siren — a realistic electronic patrol-car siren. A sawtooth "horn"
  // carrier is swept smoothly up and down by an audio-rate LFO (sample-accurate,
  // so the wail stays clean no matter the frame rate) instead of the old hard
  // two-tone snap, then shaped by a resonant bandpass that mimics the piercing
  // speaker formant of a real siren (and makes it swell brighter near the top of
  // the sweep, like the real thing). The sweep rate alternates between a slow
  // "wail" and a fast "yelp" in updateAudio, the way an officer cycles the siren
  // during a pursuit. Only the gain gates it on/off.
  const sCar=ac.createOscillator();sCar.type='sawtooth';sCar.frequency.value=1000; // sweep center (Hz)
  const sLfo=ac.createOscillator();sLfo.type='triangle';sLfo.frequency.value=.5;    // sweep rate (wail)
  const sDepth=ac.createGain();sDepth.gain.value=440;                               // ±Hz the pitch sweeps
  sLfo.connect(sDepth);sDepth.connect(sCar.frequency);
  const sForm=ac.createBiquadFilter();sForm.type='bandpass';sForm.frequency.value=1250;sForm.Q.value=.9; // horn formant
  const sg=ac.createGain();sg.gain.value=0;
  sCar.connect(sForm);sForm.connect(sg);sg.connect(master);
  sCar.start();sLfo.start();siren={lfo:sLfo,g:sg,rate:0};
  // Car horn — a brassy electric dual-tone instead of two clean square beeps.
  // Two reedy sawtooth voices a major third apart (~400/500 Hz, like a real
  // two-trumpet horn), each split into a slightly detuned pair so they beat and
  // buzz like vibrating metal, then shaped by a band-pass that gives the piercing
  // "honk" formant and tames the harshest fizz. hornG gates it in updateAudio.
  hornG=ac.createGain();hornG.gain.value=0;hornG.connect(master);
  const hornBP=ac.createBiquadFilter();hornBP.type='bandpass';hornBP.frequency.value=1600;hornBP.Q.value=.7;
  hornBP.connect(hornG);
  for(const fr of[400,500]){
    for(const det of[-6,6]){
      const h=ac.createOscillator();h.type='sawtooth';h.frequency.value=fr;h.detune.value=det;
      const hg=ac.createGain();hg.gain.value=.3;h.connect(hg);hg.connect(hornBP);h.start();
    }
  }
  const nb=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);
  const nd=nb.getChannelData(0);
  for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=ac.createBufferSource();ns.buffer=nb;ns.loop=true;
  // Tyre screech — a resonant rubber squeal over a broadband skid roar, not just
  // a soft "shhh". A high-Q band-pass rings out the tonal squeal and a slow LFO
  // makes it waver, like a tyre chattering on tarmac; a low broad band-pass adds
  // the friction roar underneath. screechG gates it when braking hard.
  screechG=ac.createGain();screechG.gain.value=0;screechG.connect(master);
  const skSqueal=ac.createBiquadFilter();skSqueal.type='bandpass';skSqueal.frequency.value=1350;skSqueal.Q.value=7;
  const skLfo=ac.createOscillator();skLfo.type='sine';skLfo.frequency.value=7;   // squeal waver
  const skLfoG=ac.createGain();skLfoG.gain.value=140;                            // ±Hz of the waver
  skLfo.connect(skLfoG);skLfoG.connect(skSqueal.frequency);skLfo.start();
  const skSquealG=ac.createGain();skSquealG.gain.value=.7;
  const skRoar=ac.createBiquadFilter();skRoar.type='bandpass';skRoar.frequency.value=680;skRoar.Q.value=.8;
  const skRoarG=ac.createGain();skRoarG.gain.value=.5;
  ns.connect(skSqueal);skSqueal.connect(skSquealG);skSquealG.connect(screechG);
  ns.connect(skRoar);skRoar.connect(skRoarG);skRoarG.connect(screechG);
  // Helicopter — layered like a real one: a deep rotor "wash" of low-passed noise
  // chopped by a smooth sine LFO at the blade-pass rate (the classic whump-whump,
  // no clicky on/off toggle), plus a steady turbine whine on top. heliG gates the
  // whole rig; the chop comes from the LFO so it stays smooth at any frame rate.
  heliG=ac.createGain();heliG.gain.value=0;heliG.connect(master);
  const heliWash=ac.createBiquadFilter();heliWash.type='lowpass';heliWash.frequency.value=190;
  const heliChop=ac.createGain();heliChop.gain.value=.55;          // baseline; LFO swings it for the chop
  const heliChopLfo=ac.createOscillator();heliChopLfo.type='sine';heliChopLfo.frequency.value=11; // blade-pass Hz
  const heliChopDepth=ac.createGain();heliChopDepth.gain.value=.5;
  heliChopLfo.connect(heliChopDepth);heliChopDepth.connect(heliChop.gain);heliChopLfo.start();
  ns.connect(heliWash);heliWash.connect(heliChop);heliChop.connect(heliG);
  const heliTurb=ac.createOscillator();heliTurb.type='triangle';heliTurb.frequency.value=540; // turbine whine
  const heliTurbBP=ac.createBiquadFilter();heliTurbBP.type='bandpass';heliTurbBP.frequency.value=560;heliTurbBP.Q.value=3;
  const heliTurbG=ac.createGain();heliTurbG.gain.value=.07;
  heliTurb.connect(heliTurbBP);heliTurbBP.connect(heliTurbG);heliTurbG.connect(heliG);heliTurb.start();
  // chiado da mangueira: ruído da mesma fonte, passado por um band-pass agudo (a
  // água "assobia" ao sair). Gate por hoseG (ligado/desligado pelo firefighter).
  const hoseBP=ac.createBiquadFilter();hoseBP.type='bandpass';hoseBP.frequency.value=3000;hoseBP.Q.value=.5;
  const hoseHP=ac.createBiquadFilter();hoseHP.type='highpass';hoseHP.frequency.value=1400;
  hoseG=ac.createGain();hoseG.gain.value=0;
  ns.connect(hoseBP);hoseBP.connect(hoseHP);hoseHP.connect(hoseG);hoseG.connect(master);
  ns.start();
  // sirene do caminhão de bombeiros: oscilador "uivando" sozinho via um LFO lento
  // que modula a frequência (sobe-desce). Só o ganho liga/desliga (setFireSiren).
  const fo=ac.createOscillator();fo.type='sawtooth';fo.frequency.value=720;
  const flfo=ac.createOscillator();flfo.type='sine';flfo.frequency.value=.32; // uivo lento
  const flfoG=ac.createGain();flfoG.gain.value=300;                            // profundidade do uivo
  flfo.connect(flfoG);flfoG.connect(fo.frequency);
  const fbp=ac.createBiquadFilter();fbp.type='bandpass';fbp.frequency.value=950;fbp.Q.value=2.2;
  fireSirenG=ac.createGain();fireSirenG.gain.value=0;
  fo.connect(fbp);fbp.connect(fireSirenG);fireSirenG.connect(master);
  fo.start();flfo.start();
}

// Liga/desliga (com fade suave) a sirene do caminhão de bombeiros — chamada no
// começo/fim do plantão pelo js/activities/firefighter.ts.
export function setFireSiren(on:boolean){
  if(!AC||!fireSirenG)return;
  fireSirenG.gain.setTargetAtTime(on?.045:0,AC.currentTime,.15);
}
// Liga/desliga (fade rápido) o chiado da mangueira enquanto o jato d'água sai.
export function setHose(on:boolean){
  if(!AC||!hoseG)return;
  hoseG.gain.setTargetAtTime(on?.06:0,AC.currentTime,.05);
}

// Impact / collision. Layered like a real crash instead of one dull noise pop:
// a low filtered-noise body (the mass), a deep sine "boom" punching down in
// pitch (the weight behind the hit), and — on harder hits — a metallic crunch
// transient (the contact crack / debris). `v` is the impact force (~6..20).
export function thud(v:number){
  if(!AC)return;
  const t0=AC.currentTime;
  const clampVal=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
  const hard=clampVal(v/20,0,1); // 0..1, how heavy the hit is
  // Low body: filtered noise burst, the dull thump of the mass
  const len=Math.floor(AC.sampleRate*(.12+hard*.12));
  const b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
  const src=AC.createBufferSource();src.buffer=b;
  const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=240+v*26;
  const g=AC.createGain();g.gain.value=clampVal(.15+v*.04,.15,.8);
  src.connect(f).connect(g).connect(master!);src.start(t0);
  // Deep boom: a sine dropping in pitch — the weight/inertia behind the hit
  const o=AC.createOscillator();o.type='sine';
  o.frequency.setValueAtTime(150+v*4,t0);
  o.frequency.exponentialRampToValueAtTime(48,t0+.18);
  const og=AC.createGain();
  og.gain.setValueAtTime(clampVal(.2+hard*.5,.2,.7),t0);
  og.gain.exponentialRampToValueAtTime(.001,t0+.2+hard*.12);
  o.connect(og).connect(master!);o.start(t0);o.stop(t0+.4);
  // Metallic crunch on harder hits — the bright contact crack / debris
  if(v>6){
    const cl=Math.floor(AC.sampleRate*.05);
    const cb=AC.createBuffer(1,cl,AC.sampleRate),cd=cb.getChannelData(0);
    for(let i=0;i<cl;i++)cd[i]=(Math.random()*2-1)*Math.pow(1-i/cl,1.2);
    const cs=AC.createBufferSource();cs.buffer=cb;
    const cf=AC.createBiquadFilter();cf.type='bandpass';cf.frequency.value=2600;cf.Q.value=.8;
    const cg=AC.createGain();cg.gain.value=clampVal(hard*.4,.05,.4);
    cs.connect(cf).connect(cg).connect(master!);cs.start(t0);
  }
}

// Splash de água: jato de ruído filtrado caindo de agudo pra médio (a água
// "espirra" e logo abafa) com um soco grave por baixo na entrada na água. vol
// controla a força; big engrossa pro mergulho/entrada (mais grave e demorado).
// Usado pelo nado (js/actors/player.ts): braçadas, batida de perna e entrada na água.
export function splash(vol=1,big=false){
  if(!AC)return;
  const t0=AC.currentTime;
  const dur=big?.5:.26;
  const len=Math.floor(AC.sampleRate*dur);
  const b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,big?1.4:2.4);
  const src=AC.createBufferSource();src.buffer=b;
  const f=AC.createBiquadFilter();f.type='bandpass';f.Q.value=.7;
  f.frequency.setValueAtTime(big?2400:3400,t0);
  f.frequency.exponentialRampToValueAtTime(big?420:760,t0+dur);
  const g=AC.createGain();
  const v=Math.max(.03,Math.min(.5,vol*(big?.4:.16)));
  g.gain.setValueAtTime(v,t0);
  g.gain.exponentialRampToValueAtTime(.0006,t0+dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t0);src.stop(t0+dur);
  if(big){ // "ploc" grave do corpo entrando na água
    const o=AC.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(190,t0);
    o.frequency.exponentialRampToValueAtTime(58,t0+.2);
    const og=AC.createGain();
    og.gain.setValueAtTime(.5*Math.min(1,vol),t0);
    og.gain.exponentialRampToValueAtTime(.001,t0+.22);
    o.connect(og).connect(master!);o.start(t0);o.stop(t0+.24);
  }
}

// Tiro realista em camadas: estalo agudo do disparo, corpo do estouro,
// soco grave com queda de pitch e cauda de reverberação da rua, tudo passando
// por uma saturação (tanh) — arma de verdade "clipa" o ar, não soa limpa
let shotBus:GainNode|null=null;
export function gunshot(vol=1){
  if(!AC)return;
  if(!shotBus){
    shotBus=AC.createGain();shotBus.gain.value=.7;
    const shaper=AC.createWaveShaper();
    const curve=new Float32Array(256);
    for(let i=0;i<256;i++){const x=i/127.5-1;curve[i]=Math.tanh(2.4*x);}
    shaper.curve=curve;
    shotBus.connect(shaper);shaper.connect(master!);
    // eco curto rebatendo nos prédios
    const dl=AC.createDelay(.3);dl.delayTime.value=.09;
    const dlp=AC.createBiquadFilter();dlp.type='lowpass';dlp.frequency.value=1100;
    const fb=AC.createGain();fb.gain.value=.32;
    shaper.connect(dl);dl.connect(dlp);dlp.connect(fb);fb.connect(dl);
    const wet=AC.createGain();wet.gain.value=.22;
    fb.connect(wet);wet.connect(master!);
  }
  const t0=AC.currentTime;
  const noise=(dur:number,type:BiquadFilterType,freq:number,Q:number,v:number,decay:number)=>{
    const len=Math.floor(AC!.sampleRate*dur);
    const b=AC!.createBuffer(1,len,AC!.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    const src=AC!.createBufferSource();src.buffer=b;
    const f=AC!.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=Q;
    const g=AC!.createGain();
    g.gain.setValueAtTime(v*vol,t0);
    g.gain.exponentialRampToValueAtTime(.0008,t0+decay);
    src.connect(f).connect(g).connect(shotBus!);
    src.start(t0);src.stop(t0+dur);
  };
  noise(.07,'highpass',2400+Math.random()*700,.7,1.0,.05); // estalo
  noise(.16,'bandpass',520+Math.random()*140,.8,.9,.13);   // estouro
  noise(.5,'lowpass',900,.5,.26,.42);                      // cauda
  const o=AC.createOscillator();o.type='sine';             // soco grave
  o.frequency.setValueAtTime(150+Math.random()*25,t0);
  o.frequency.exponentialRampToValueAtTime(45,t0+.16);
  const og=AC.createGain();
  og.gain.setValueAtTime(.9*vol,t0);
  og.gain.exponentialRampToValueAtTime(.001,t0+.18);
  o.connect(og).connect(shotBus);o.start(t0);o.stop(t0+.2);
}

// Sirene de largada da corrida: três "whoops" subindo, estilo buzina de
// largada de prova. Tocada na contagem regressiva (ver js/activities/race.ts).
export function raceSiren(){
  if(!AC)return;
  const t0=AC.currentTime;
  const o=AC.createOscillator();o.type='sawtooth';
  const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=1200;f.Q.value=3;
  const g=AC.createGain();g.gain.value=0;
  o.connect(f).connect(g).connect(master!);
  let t=t0;
  for(let i=0;i<3;i++){
    o.frequency.setValueAtTime(520,t);
    o.frequency.linearRampToValueAtTime(1040,t+.34);
    g.gain.setValueAtTime(.0001,t);
    g.gain.linearRampToValueAtTime(.2,t+.05);
    g.gain.exponentialRampToValueAtTime(.001,t+.4);
    t+=.45;
  }
  o.start(t0);o.stop(t+.1);
}

export function blip(freqs:number[],dur=.09,type:OscillatorType='sine',vol=.18){
  if(!AC)return;
  freqs.forEach((fr,k)=>{
    const o=AC!.createOscillator();o.type=type;o.frequency.value=fr;
    const g=AC!.createGain();g.gain.value=0;
    o.connect(g).connect(master!);
    const t0=AC!.currentTime+k*dur;
    g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.015);
    g.gain.exponentialRampToValueAtTime(.001,t0+dur);
    o.start(t0);o.stop(t0+dur+.02);
  });
}

export function updateAudio(){
  if(!AC)return;
  const cur=refs.getCur?.();
  if(audioEngine){
    const sp=state.mode==='car'?Math.abs(cur?.speed||0):0;
    // moto ronca mais agudo que o carro
    audioEngine.o.frequency.value=(cur?.bike?92:52)+sp*(cur?.bike?9:6.5);
    audioEngine.g.gain.value=state.mode==='car'?.028+sp/32*.035:0;
  }
  if(siren){
    // Volume comes from the NEAREST chasing cruiser's distance (police.ts): it swells in
    // as a unit closes on you and fades out when nobody is chasing — so a distant patrol
    // car is faint, one on your bumper is loud, and it goes silent the instant you're
    // caught or killed. Gradual and positional, "from the car itself".
    const lvl=refs.sirenLevel?.()??0;
    const tgt=lvl*.06; // peak gain right next to a cruiser
    siren.g.gain.value+=(tgt-siren.g.gain.value)*.08;
    // Alternate slow "wail" / fast "yelp" every ~4s while audible, ramping the LFO rate
    // so the rate change itself never clicks.
    if(lvl>.02){
      const rate=Math.floor(state.time/4)%2?3.6:.5;
      if(siren.rate!==rate){siren.rate=rate;siren.lfo.frequency.setTargetAtTime(rate,AC.currentTime,.06);}
    }
  }
  if(hornG)hornG.gain.value=(state.mode==='car'&&input.horn)?.07:0;
  if(screechG)screechG.gain.value=
    (state.mode==='car'&&input.brake&&Math.abs(cur?.speed||0)>7)?.12:0;
  if(heliG){
    // Chop is handled by the LFO in initAudio now, so this just fades the whole
    // rig in/out smoothly when the chopper comes and goes.
    const heli=refs.getHeli?.();
    heliG.gain.value+=((heli?.06:0)-heliG.gain.value)*.1;
  }
}
