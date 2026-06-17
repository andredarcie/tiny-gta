import {state,input,refs} from './state.js';

export let AC=null,audioEngine=null,siren=null,hornG=null,master=null,screechG=null,heliG=null;
let fireSirenG=null,hoseG=null; // sirene do caminhão de bombeiros + chiado da mangueira

export function initAudio(){
  if(AC)return;
  AC=new (window.AudioContext||window.webkitAudioContext)();
  master=AC.createGain();master.gain.value=.5;master.connect(AC.destination);
  // Engine — layered like a real one instead of a single buzzing drone: a sawtooth
  // "growl" with a slightly detuned second saw for the rough, uneven edge of
  // combustion, plus a sine sub-octave for the block rumble you feel more than
  // hear. A resonant low-pass acts as the engine "throat" and opens up (brighter,
  // more aggressive) as the revs climb. updateAudio drives pitch + cutoff.
  const eo=AC.createOscillator();eo.type='sawtooth';
  const eo2=AC.createOscillator();eo2.type='sawtooth';eo2.detune.value=-9; // beat/roughness vs eo
  const esub=AC.createOscillator();esub.type='sine';                       // sub-octave block rumble
  const ef=AC.createBiquadFilter();ef.type='lowpass';ef.frequency.value=620;ef.Q.value=3.2; // throaty resonance
  const esubG=AC.createGain();esubG.gain.value=.4;                         // keep the sub from booming
  const g=AC.createGain();g.gain.value=0;
  eo.connect(ef);eo2.connect(ef);ef.connect(g);
  esub.connect(esubG);esubG.connect(g);
  g.connect(master);eo.start();eo2.start();esub.start();
  audioEngine={o:eo,o2:eo2,sub:esub,f:ef,g};
  // Police siren — a realistic electronic patrol-car siren. A sawtooth "horn"
  // carrier is swept smoothly up and down by an audio-rate LFO (sample-accurate,
  // so the wail stays clean no matter the frame rate) instead of the old hard
  // two-tone snap, then shaped by a resonant bandpass that mimics the piercing
  // speaker formant of a real siren (and makes it swell brighter near the top of
  // the sweep, like the real thing). The sweep rate alternates between a slow
  // "wail" and a fast "yelp" in updateAudio, the way an officer cycles the siren
  // during a pursuit. Only the gain gates it on/off.
  const sCar=AC.createOscillator();sCar.type='sawtooth';sCar.frequency.value=1000; // sweep center (Hz)
  const sLfo=AC.createOscillator();sLfo.type='triangle';sLfo.frequency.value=.5;    // sweep rate (wail)
  const sDepth=AC.createGain();sDepth.gain.value=440;                               // ±Hz the pitch sweeps
  sLfo.connect(sDepth);sDepth.connect(sCar.frequency);
  const sForm=AC.createBiquadFilter();sForm.type='bandpass';sForm.frequency.value=1250;sForm.Q.value=.9; // horn formant
  const sg=AC.createGain();sg.gain.value=0;
  sCar.connect(sForm);sForm.connect(sg);sg.connect(master);
  sCar.start();sLfo.start();siren={lfo:sLfo,g:sg,rate:0};
  // Car horn — a brassy electric dual-tone instead of two clean square beeps.
  // Two reedy sawtooth voices a major third apart (~400/500 Hz, like a real
  // two-trumpet horn), each split into a slightly detuned pair so they beat and
  // buzz like vibrating metal, then shaped by a band-pass that gives the piercing
  // "honk" formant and tames the harshest fizz. hornG gates it in updateAudio.
  hornG=AC.createGain();hornG.gain.value=0;hornG.connect(master);
  const hornBP=AC.createBiquadFilter();hornBP.type='bandpass';hornBP.frequency.value=1600;hornBP.Q.value=.7;
  hornBP.connect(hornG);
  for(const fr of[400,500]){
    for(const det of[-6,6]){
      const h=AC.createOscillator();h.type='sawtooth';h.frequency.value=fr;h.detune.value=det;
      const hg=AC.createGain();hg.gain.value=.3;h.connect(hg);hg.connect(hornBP);h.start();
    }
  }
  const nb=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);
  const nd=nb.getChannelData(0);
  for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const ns=AC.createBufferSource();ns.buffer=nb;ns.loop=true;
  // Tyre screech — a resonant rubber squeal over a broadband skid roar, not just
  // a soft "shhh". A high-Q band-pass rings out the tonal squeal and a slow LFO
  // makes it waver, like a tyre chattering on tarmac; a low broad band-pass adds
  // the friction roar underneath. screechG gates it when braking hard.
  screechG=AC.createGain();screechG.gain.value=0;screechG.connect(master);
  const skSqueal=AC.createBiquadFilter();skSqueal.type='bandpass';skSqueal.frequency.value=1350;skSqueal.Q.value=7;
  const skLfo=AC.createOscillator();skLfo.type='sine';skLfo.frequency.value=7;   // squeal waver
  const skLfoG=AC.createGain();skLfoG.gain.value=140;                            // ±Hz of the waver
  skLfo.connect(skLfoG);skLfoG.connect(skSqueal.frequency);skLfo.start();
  const skSquealG=AC.createGain();skSquealG.gain.value=.7;
  const skRoar=AC.createBiquadFilter();skRoar.type='bandpass';skRoar.frequency.value=680;skRoar.Q.value=.8;
  const skRoarG=AC.createGain();skRoarG.gain.value=.5;
  ns.connect(skSqueal);skSqueal.connect(skSquealG);skSquealG.connect(screechG);
  ns.connect(skRoar);skRoar.connect(skRoarG);skRoarG.connect(screechG);
  // Helicopter — layered like a real one: a deep rotor "wash" of low-passed noise
  // chopped by a smooth sine LFO at the blade-pass rate (the classic whump-whump,
  // no clicky on/off toggle), plus a steady turbine whine on top. heliG gates the
  // whole rig; the chop comes from the LFO so it stays smooth at any frame rate.
  heliG=AC.createGain();heliG.gain.value=0;heliG.connect(master);
  const heliWash=AC.createBiquadFilter();heliWash.type='lowpass';heliWash.frequency.value=190;
  const heliChop=AC.createGain();heliChop.gain.value=.55;          // baseline; LFO swings it for the chop
  const heliChopLfo=AC.createOscillator();heliChopLfo.type='sine';heliChopLfo.frequency.value=11; // blade-pass Hz
  const heliChopDepth=AC.createGain();heliChopDepth.gain.value=.5;
  heliChopLfo.connect(heliChopDepth);heliChopDepth.connect(heliChop.gain);heliChopLfo.start();
  ns.connect(heliWash);heliWash.connect(heliChop);heliChop.connect(heliG);
  const heliTurb=AC.createOscillator();heliTurb.type='triangle';heliTurb.frequency.value=540; // turbine whine
  const heliTurbBP=AC.createBiquadFilter();heliTurbBP.type='bandpass';heliTurbBP.frequency.value=560;heliTurbBP.Q.value=3;
  const heliTurbG=AC.createGain();heliTurbG.gain.value=.07;
  heliTurb.connect(heliTurbBP);heliTurbBP.connect(heliTurbG);heliTurbG.connect(heliG);heliTurb.start();
  // chiado da mangueira: ruído da mesma fonte, passado por um band-pass agudo (a
  // água "assobia" ao sair). Gate por hoseG (ligado/desligado pelo firefighter).
  const hoseBP=AC.createBiquadFilter();hoseBP.type='bandpass';hoseBP.frequency.value=3000;hoseBP.Q.value=.5;
  const hoseHP=AC.createBiquadFilter();hoseHP.type='highpass';hoseHP.frequency.value=1400;
  hoseG=AC.createGain();hoseG.gain.value=0;
  ns.connect(hoseBP);hoseBP.connect(hoseHP);hoseHP.connect(hoseG);hoseG.connect(master);
  ns.start();
  // sirene do caminhão de bombeiros: oscilador "uivando" sozinho via um LFO lento
  // que modula a frequência (sobe-desce). Só o ganho liga/desliga (setFireSiren).
  const fo=AC.createOscillator();fo.type='sawtooth';fo.frequency.value=720;
  const flfo=AC.createOscillator();flfo.type='sine';flfo.frequency.value=.32; // uivo lento
  const flfoG=AC.createGain();flfoG.gain.value=300;                            // profundidade do uivo
  flfo.connect(flfoG);flfoG.connect(fo.frequency);
  const fbp=AC.createBiquadFilter();fbp.type='bandpass';fbp.frequency.value=950;fbp.Q.value=2.2;
  fireSirenG=AC.createGain();fireSirenG.gain.value=0;
  fo.connect(fbp);fbp.connect(fireSirenG);fireSirenG.connect(master);
  fo.start();flfo.start();
}

// Liga/desliga (com fade suave) a sirene do caminhão de bombeiros — chamada no
// começo/fim do plantão pelo js/firefighter.js.
export function setFireSiren(on){
  if(!AC||!fireSirenG)return;
  fireSirenG.gain.setTargetAtTime(on?.045:0,AC.currentTime,.15);
}
// Liga/desliga (fade rápido) o chiado da mangueira enquanto o jato d'água sai.
export function setHose(on){
  if(!AC||!hoseG)return;
  hoseG.gain.setTargetAtTime(on?.06:0,AC.currentTime,.05);
}

// Impact / collision. Layered like a real crash instead of one dull noise pop:
// a low filtered-noise body (the mass), a deep sine "boom" punching down in
// pitch (the weight behind the hit), and — on harder hits — a metallic crunch
// transient (the contact crack / debris). `v` is the impact force (~6..20).
export function thud(v){
  if(!AC)return;
  const t0=AC.currentTime;
  const clampVal=(x,a,b)=>Math.max(a,Math.min(b,x));
  const hard=clampVal(v/20,0,1); // 0..1, how heavy the hit is
  // Low body: filtered noise burst, the dull thump of the mass
  const len=Math.floor(AC.sampleRate*(.12+hard*.12));
  const b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
  const src=AC.createBufferSource();src.buffer=b;
  const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=240+v*26;
  const g=AC.createGain();g.gain.value=clampVal(.15+v*.04,.15,.8);
  src.connect(f).connect(g).connect(master);src.start(t0);
  // Deep boom: a sine dropping in pitch — the weight/inertia behind the hit
  const o=AC.createOscillator();o.type='sine';
  o.frequency.setValueAtTime(150+v*4,t0);
  o.frequency.exponentialRampToValueAtTime(48,t0+.18);
  const og=AC.createGain();
  og.gain.setValueAtTime(clampVal(.2+hard*.5,.2,.7),t0);
  og.gain.exponentialRampToValueAtTime(.001,t0+.2+hard*.12);
  o.connect(og).connect(master);o.start(t0);o.stop(t0+.4);
  // Metallic crunch on harder hits — the bright contact crack / debris
  if(v>6){
    const cl=Math.floor(AC.sampleRate*.05);
    const cb=AC.createBuffer(1,cl,AC.sampleRate),cd=cb.getChannelData(0);
    for(let i=0;i<cl;i++)cd[i]=(Math.random()*2-1)*Math.pow(1-i/cl,1.2);
    const cs=AC.createBufferSource();cs.buffer=cb;
    const cf=AC.createBiquadFilter();cf.type='bandpass';cf.frequency.value=2600;cf.Q.value=.8;
    const cg=AC.createGain();cg.gain.value=clampVal(hard*.4,.05,.4);
    cs.connect(cf).connect(cg).connect(master);cs.start(t0);
  }
}

// Splash de água: jato de ruído filtrado caindo de agudo pra médio (a água
// "espirra" e logo abafa) com um soco grave por baixo na entrada na água. vol
// controla a força; big engrossa pro mergulho/entrada (mais grave e demorado).
// Usado pelo nado (js/player.js): braçadas, batida de perna e entrada na água.
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
  src.connect(f).connect(g).connect(master);
  src.start(t0);src.stop(t0+dur);
  if(big){ // "ploc" grave do corpo entrando na água
    const o=AC.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(190,t0);
    o.frequency.exponentialRampToValueAtTime(58,t0+.2);
    const og=AC.createGain();
    og.gain.setValueAtTime(.5*Math.min(1,vol),t0);
    og.gain.exponentialRampToValueAtTime(.001,t0+.22);
    o.connect(og).connect(master);o.start(t0);o.stop(t0+.24);
  }
}

// Tiro realista em camadas: estalo agudo do disparo, corpo do estouro,
// soco grave com queda de pitch e cauda de reverberação da rua, tudo passando
// por uma saturação (tanh) — arma de verdade "clipa" o ar, não soa limpa
let shotBus=null;
export function gunshot(vol=1){
  if(!AC)return;
  if(!shotBus){
    shotBus=AC.createGain();shotBus.gain.value=.7;
    const shaper=AC.createWaveShaper();
    const curve=new Float32Array(256);
    for(let i=0;i<256;i++){const x=i/127.5-1;curve[i]=Math.tanh(2.4*x);}
    shaper.curve=curve;
    shotBus.connect(shaper);shaper.connect(master);
    // eco curto rebatendo nos prédios
    const dl=AC.createDelay(.3);dl.delayTime.value=.09;
    const dlp=AC.createBiquadFilter();dlp.type='lowpass';dlp.frequency.value=1100;
    const fb=AC.createGain();fb.gain.value=.32;
    shaper.connect(dl);dl.connect(dlp);dlp.connect(fb);fb.connect(dl);
    const wet=AC.createGain();wet.gain.value=.22;
    fb.connect(wet);wet.connect(master);
  }
  const t0=AC.currentTime;
  const noise=(dur,type,freq,Q,v,decay)=>{
    const len=Math.floor(AC.sampleRate*dur);
    const b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
    const src=AC.createBufferSource();src.buffer=b;
    const f=AC.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=Q;
    const g=AC.createGain();
    g.gain.setValueAtTime(v*vol,t0);
    g.gain.exponentialRampToValueAtTime(.0008,t0+decay);
    src.connect(f).connect(g).connect(shotBus);
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
// largada de prova. Tocada na contagem regressiva (ver js/race.js).
export function raceSiren(){
  if(!AC)return;
  const t0=AC.currentTime;
  const o=AC.createOscillator();o.type='sawtooth';
  const f=AC.createBiquadFilter();f.type='bandpass';f.frequency.value=1200;f.Q.value=3;
  const g=AC.createGain();g.gain.value=0;
  o.connect(f).connect(g).connect(master);
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

export function blip(freqs,dur=.09,type='sine',vol=.18){
  if(!AC)return;
  freqs.forEach((fr,k)=>{
    const o=AC.createOscillator();o.type=type;o.frequency.value=fr;
    const g=AC.createGain();g.gain.value=0;
    o.connect(g).connect(master);
    const t0=AC.currentTime+k*dur;
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
    const f0=(cur?.bike?92:52)+sp*(cur?.bike?9:6.5);
    audioEngine.o.frequency.value=f0;
    audioEngine.o2.frequency.value=f0;            // detune supplies the offset
    audioEngine.sub.frequency.value=f0*.5;        // sub-octave block rumble
    audioEngine.f.frequency.value=420+f0*4+sp*22; // throat opens as revs climb
    audioEngine.g.gain.value=state.mode==='car'?.028+sp/32*.035:0;
  }
  if(siren){
    const cops=refs.cops||[];
    const on=cops.length>0;
    const tgt=on?.05:0;
    siren.g.gain.value+=(tgt-siren.g.gain.value)*.08;
    // Alternate slow "wail" / fast "yelp" every ~4s while cops are present,
    // ramping the LFO rate so the rate change itself never clicks.
    if(on){
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
