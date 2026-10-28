// The radio's instruments — PURE sample synthesis (no Web Audio, no DOM), so the music can be
// rendered in a Web Worker (radio/worker.ts) and in Node (the unit tests, the preview tool).
// Every instrument returns a mono Float32Array at the current sample rate (setRate):
//  - plucked strings by Karplus–Strong with a fractional-delay allpass (in tune up high), a
//    pick-position comb on the excitation, a tunable loop filter and a body made of resonant
//    biquads: the viola caipira (steel courses in pairs — octave strings on the low courses,
//    the jangle of the music caipira), the nylon violão, the cavaquinho, the pagode banjo
//    and the acoustic bass;
//  - the sanfona: band-limited (PolyBLEP) sawtooth reeds tuned a little apart ("musette"),
//    the bassoon reed an octave below, through two formant filters, with a bellows envelope;
//  - FM voices: bells/"plim", the electric piano, the funk "tuin" whistle;
//  - drums from membrane and metal models: zabumba and its bacalhau, triângulo, pandeiro,
//    surdo, tantã, repique, tamborim, agogô, ganzá, cuíca, the 808 and the funk percussion.
// Drum hits are cached (a few variations each), the rest is rendered per note.
export type Rng=()=>number;
export function rng(seed:number):Rng{
  let a=seed>>>0;
  return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
let SR=48000;
const cache=new Map<string,Float32Array>();
export function setRate(r:number):void{if(r!==SR){SR=r;cache.clear();}}
export const rate=():number=>SR;
export const mtof=(m:number):number=>440*Math.pow(2,(m-69)/12);
const TAU=Math.PI*2;
const len=(sec:number):number=>Math.max(1,Math.floor(sec*SR));

// ------------------------------------------------------------------ filters (in place)
type BQ='lp'|'hp'|'bp'|'peak'|'lowshelf'|'highshelf';
export function biquad(x:Float32Array,type:BQ,f:number,q=.707,db=0):Float32Array{
  const w=TAU*Math.min(f,SR*.45)/SR,cs=Math.cos(w),sn=Math.sin(w),al=sn/(2*q),A=Math.pow(10,db/40);
  let b0:number,b1:number,b2:number,a0:number,a1:number,a2:number;
  if(type==='lp'){b0=(1-cs)/2;b1=1-cs;b2=b0;a0=1+al;a1=-2*cs;a2=1-al;}
  else if(type==='hp'){b0=(1+cs)/2;b1=-(1+cs);b2=b0;a0=1+al;a1=-2*cs;a2=1-al;}
  else if(type==='bp'){b0=al;b1=0;b2=-al;a0=1+al;a1=-2*cs;a2=1-al;}
  else if(type==='peak'){b0=1+al*A;b1=-2*cs;b2=1-al*A;a0=1+al/A;a1=-2*cs;a2=1-al/A;}
  else{
    const s=2*Math.sqrt(A)*al,sh=type==='highshelf'?-1:1;
    b0=A*((A+1)-sh*(A-1)*cs+s);b1=sh*2*A*((A-1)-sh*(A+1)*cs);b2=A*((A+1)-sh*(A-1)*cs-s);
    a0=(A+1)+sh*(A-1)*cs+s;a1=-sh*2*((A-1)+sh*(A+1)*cs);a2=(A+1)+sh*(A-1)*cs-s;
  }
  b0/=a0;b1/=a0;b2/=a0;a1/=a0;a2/=a0;
  let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){const v=x[i],y=b0*v+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=v;y2=y1;y1=y;x[i]=y;}
  return x;
}
function onePoleLP(x:Float32Array,f:number):Float32Array{
  const a=Math.exp(-TAU*f/SR);let y=0;
  for(let i=0;i<x.length;i++){y=(1-a)*x[i]+a*y;x[i]=y;}
  return x;
}
// attack / release fades so nothing clicks
function fade(x:Float32Array,att:number,rel:number):Float32Array{
  const a=Math.min(x.length,len(att)),r=Math.min(x.length,len(rel));
  for(let i=0;i<a;i++)x[i]*=i/a;
  for(let i=0;i<r;i++)x[x.length-1-i]*=i/r;
  return x;
}
function noise(n:number,r:Rng):Float32Array{const x=new Float32Array(n);for(let i=0;i<n;i++)x[i]=r()*2-1;return x;}

// ------------------------------------------------------------------ plucked strings
export interface StringOpts{
  decay:number;     // seconds to −60 dB (at 110 Hz; higher notes ring shorter)
  bright:number;    // 0..1 excitation brightness (pick/nail vs flesh)
  loop:number;      // 0..0.5 loop-filter tap (0.5 = dark, smaller = brighter, steel)
  pick:number;      // pick position along the string (0..0.5): comb on the excitation
}
// one string, Karplus–Strong with a fractional allpass so it is in tune at any pitch
function ks(f:number,dur:number,o:StringOpts,r:Rng):Float32Array{
  const n=len(dur),out=new Float32Array(n),s=o.loop;
  const period=SR/f-s;
  let N=Math.floor(period-.1);if(N<2)N=2;
  const frac=period-N,C=(1-frac)/(1+frac);
  const T=o.decay*Math.pow(110/f,.45),g=Math.pow(.001,1/(f*T));
  const ring=new Float32Array(N);
  // excitation: a noise burst lowpassed by brightness, combed at the pick position
  const ex=noise(N,r);onePoleLP(ex,600+o.bright*9000);
  const pk=Math.max(1,Math.round(o.pick*N));
  for(let i=N-1;i>=pk;i--)ex[i]-=ex[i-pk];
  let m=0;for(let i=0;i<N;i++)m+=ex[i];m/=N;
  for(let i=0;i<N;i++)ring[i]=ex[i]-m;
  let p=0,prev=0,apx=0,apy=0;
  for(let i=0;i<n;i++){
    const cur=ring[p];
    const fl=g*((1-s)*cur+s*prev);prev=cur;
    const ap=C*fl+apx-C*apy;apx=fl;apy=ap;
    ring[p]=ap;out[i]=cur;
    if(++p>=N)p=0;
  }
  return out;
}
export type StringKind='viola'|'violao'|'cavaco'|'banjo'|'baixo'|'harpa';
const STR:Record<StringKind,StringOpts&{body:[number,number,number][];pair:number;pairGain:number;gain:number;hp:number}>={
  // viola caipira: steel, bright, long ring; low courses doubled an octave up (pair 2), the
  // others in unison a few cents apart — the jangle; a small bright body
  viola:{decay:3.6,bright:.9,loop:.22,pick:.13,body:[[210,2.2,5],[460,2,4],[2600,1.2,3]],pair:0,pairGain:.75,gain:.9,hp:90},
  violao:{decay:2.6,bright:.42,loop:.42,pick:.18,body:[[98,2,7],[205,2.2,5],[400,1.8,3]],pair:1.0012,pairGain:0,gain:1,hp:60},
  cavaco:{decay:1.5,bright:.85,loop:.25,pick:.2,body:[[520,2.2,5],[1200,2,4],[3000,1,2]],pair:1.0018,pairGain:.5,gain:.85,hp:180},
  banjo:{decay:.75,bright:1,loop:.18,pick:.1,body:[[850,3,8],[2200,2,6]],pair:1.0022,pairGain:.4,gain:.8,hp:250},
  baixo:{decay:2.2,bright:.25,loop:.46,pick:.22,body:[[70,1.5,4],[140,1.5,2]],pair:0,pairGain:0,gain:1.25,hp:35},
  harpa:{decay:3,bright:.55,loop:.36,pick:.25,body:[[300,1.5,3]],pair:0,pairGain:0,gain:.8,hp:80},
};
// a note on a plucked instrument; `mute` (0..1) palms it short (the violão's chop, the
// cavaquinho's "tchiki")
export function pluck(kind:StringKind,midi:number,dur:number,r:Rng,mute=0):Float32Array{
  const k=STR[kind],f=mtof(midi);
  const o={...k,decay:k.decay*(1-mute*.93),bright:k.bright*(1-mute*.35)};
  const x=ks(f,dur,o,r);
  if(kind==='viola'||k.pairGain){
    // the course's second string: an octave up on the viola's low courses, else unison
    const f2=kind==='viola'?(midi<62?f*2:f*1.0015):f*k.pair;
    const y=ks(f2,dur,{...o,decay:o.decay*.85},r);
    const pg=kind==='viola'?(midi<62?.55:.8):k.pairGain;
    for(let i=0;i<x.length;i++)x[i]+=y[i]*pg;
  }
  for(const[bf,bq,bdb]of k.body)biquad(x,'peak',bf,bq,bdb);
  biquad(x,'hp',k.hp,.7);
  for(let i=0;i<x.length;i++)x[i]*=k.gain*.55;
  return fade(x,.0015,Math.min(.05,dur*.2));
}

// ------------------------------------------------------------------ PolyBLEP oscillators
function blep(t:number,dt:number):number{
  if(t<dt){t/=dt;return t+t-t*t-1;}
  if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1;}
  return 0;
}
function saw(n:number,f:(i:number)=>number,ph0=0):Float32Array{
  const x=new Float32Array(n);let ph=ph0;
  for(let i=0;i<n;i++){const dt=f(i)/SR;x[i]=2*ph-1-blep(ph,dt);ph+=dt;if(ph>=1)ph-=1;}
  return x;
}
function square(n:number,f:(i:number)=>number,pw=.5):Float32Array{
  const x=new Float32Array(n);let ph=0;
  for(let i=0;i<n;i++){
    const dt=f(i)/SR;let v=ph<pw?1:-1;
    v+=blep(ph,dt);let t2=ph-pw;if(t2<0)t2+=1;v-=blep(t2,dt);
    x[i]=v;ph+=dt;if(ph>=1)ph-=1;
  }
  return x;
}

// ------------------------------------------------------------------ sanfona (accordion)
// `reeds`: 'musette' (three reeds, the forró sound), 'doce' (two, the sertanejo sound),
// 'baixo' (the left hand: bass + chord buttons, short); `shake`: the bellows tremolo
export function sanfona(midi:number,dur:number,r:Rng,o:{reeds?:'musette'|'doce'|'baixo';shake?:number;vib?:number}={}):Float32Array{
  const f=mtof(midi),n=len(dur+.08),reeds=o.reeds??'musette';
  const det=reeds==='musette'?[0,.0045,-.0042]:reeds==='doce'?[0,.0018]:[0];
  const x=new Float32Array(n),vib=o.vib??0;
  for(let k=0;k<det.length;k++){
    const ph0=r(),d=det[k];
    const y=saw(n,i=>f*(1+d)*(1+vib*.006*Math.sin(TAU*5.2*i/SR)),ph0);
    for(let i=0;i<n;i++)x[i]+=y[i]*(k?.7:1);
  }
  if(reeds!=='baixo'){const y=saw(n,()=>f/2,r());for(let i=0;i<n;i++)x[i]+=y[i]*.35;}   // the bassoon reed
  // the reed chamber: two formants, the treble tamed
  const a=x.slice();biquad(a,'bp',700,1.1);const b=x.slice();biquad(b,'bp',1700,1.4);
  for(let i=0;i<n;i++)x[i]=x[i]*.18+a[i]*.9+b[i]*.55;
  biquad(x,'lp',reeds==='baixo'?1800:4200,.7);biquad(x,'hp',reeds==='baixo'?50:120,.7);
  // bellows: a soft attack, a slight swell, the tremolo of a shaken bellows
  const att=reeds==='baixo'?.006:.025,shake=o.shake??0;
  for(let i=0;i<n;i++){
    const t=i/SR,env=Math.min(1,t/att)*(1+.08*Math.min(1,t/.4))*(1-shake*.35*(.5+.5*Math.sin(TAU*7*t)));
    x[i]*=env*.16;
  }
  return fade(x,.002,reeds==='baixo'?.03:.07);
}

// ------------------------------------------------------------------ keyboards and synths
// FM bell / "plim" (the funk's high synth): ratio 3.5, the index decaying fast
export function bell(midi:number,dur:number,o:{ratio?:number;index?:number;decay?:number}={}):Float32Array{
  const f=mtof(midi),n=len(dur),ratio=o.ratio??3.5,I=o.index??3,dec=o.decay??.5;
  const x=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR,e=Math.exp(-t/dec),mi=I*Math.exp(-t/(dec*.35));
    x[i]=Math.sin(TAU*f*t+mi*Math.sin(TAU*f*ratio*t))*e*.32;
  }
  return fade(x,.001,.02);
}
// electric piano (the romantic pagode's and the funk melody's keys): FM tine + body
export function epiano(midi:number,dur:number,vel=1):Float32Array{
  const f=mtof(midi),n=len(dur+.3),x=new Float32Array(n);
  for(let i=0;i<n;i++){
    const t=i/SR,e=Math.exp(-t/(1.6*Math.pow(220/f,.3)))*(i<len(dur)?1:Math.exp(-(t-dur)/.08));
    const tine=Math.sin(TAU*f*t+1.6*vel*Math.exp(-t/.25)*Math.sin(TAU*f*t));
    const bark=Math.sin(TAU*f*14*t)*Math.exp(-t/.012)*.2*vel;
    x[i]=(tine+bark)*e*.26*(.6+.4*vel);
  }
  return fade(x,.001,.03);
}
// the piseiro's keyboard ("teclado"): a bright square lead, chorused, with vibrato after the
// attack and a grace-note scoop into each note
export function teclado(midi:number,dur:number,r:Rng,scoop=true):Float32Array{
  const f=mtof(midi),n=len(dur+.05),x=new Float32Array(n);
  for(const d of[-.004,.004]){
    const y=square(n,i=>{const t=i/SR;const s=scoop?Math.pow(2,-1/12*Math.max(0,1-t/.045)):1;return f*(1+d)*s*(1+.007*Math.min(1,t/.18)*Math.sin(TAU*5.6*t));},.42+r()*.04);
    for(let i=0;i<n;i++)x[i]+=y[i];
  }
  biquad(x,'lp',3800,.9);biquad(x,'peak',1500,1,3);
  for(let i=0;i<n;i++)x[i]*=.07*Math.min(1,i/len(.008));
  return fade(x,.002,.04);
}
// pad (the funk melody's strings): three detuned saws, a slow swell, lowpassed
export function pad(midi:number,dur:number,r:Rng):Float32Array{
  const f=mtof(midi),n=len(dur+.4),x=new Float32Array(n);
  for(const d of[-.006,0,.0065]){const y=saw(n,()=>f*(1+d),r());for(let i=0;i<n;i++)x[i]+=y[i];}
  biquad(x,'lp',1600,.6);
  const a=len(Math.min(.35,dur*.4)),rl=len(.4);
  for(let i=0;i<n;i++){const e=Math.min(1,i/a)*(i<n-rl?1:(n-i)/rl);x[i]*=e*.045;}
  return x;
}
// synth stab (the tamborzão's brass hit)
export function stab(midi:number,dur:number,r:Rng):Float32Array{
  const f=mtof(midi),n=len(dur),x=new Float32Array(n);
  for(const d of[-.005,.005]){const y=saw(n,()=>f*(1+d),r());for(let i=0;i<n;i++)x[i]+=y[i];}
  const y=new Float32Array(n);let lp=0;
  for(let i=0;i<n;i++){const t=i/SR,fc=600+5000*Math.exp(-t/.06),a=Math.exp(-TAU*fc/SR);lp=(1-a)*x[i]+a*lp;y[i]=lp*Math.exp(-t/.25)*.09;}
  return fade(y,.001,.02);
}
// the funk paulista "tuin": a whistle-like sine that slides and wobbles
export function tuin(midi0:number,midi1:number,dur:number):Float32Array{
  const n=len(dur),x=new Float32Array(n);let ph=0;
  for(let i=0;i<n;i++){
    const t=i/SR,k=Math.min(1,t/(dur*.7)),m=midi0+(midi1-midi0)*(1-Math.pow(1-k,3));
    const f=mtof(m)*(1+.012*Math.sin(TAU*6.5*t)*Math.min(1,t/.15));
    ph+=f/SR;x[i]=(Math.sin(TAU*ph)+.12*Math.sin(TAU*ph*2))*.2*Math.min(1,t/.02)*Math.min(1,(dur-t)/.08);
  }
  return x;
}
// 808: a sine with a pitch drop and a long tail, a touch of saturation; `glide` slides the
// note to another pitch (the mandelão's bass)
export function k808(midi:number,dur:number,o:{glideTo?:number;punch?:number}={}):Float32Array{
  const n=len(dur),x=new Float32Array(n),f0=mtof(midi),f1=o.glideTo!==undefined?mtof(o.glideTo):f0,punch=o.punch??1;
  let ph=0;
  for(let i=0;i<n;i++){
    const t=i/SR,gl=o.glideTo!==undefined?Math.min(1,Math.max(0,(t-dur*.35)/(dur*.4))):0;
    const f=(f0+(f1-f0)*gl)*(1+2.5*punch*Math.exp(-t/.018));
    ph+=f/SR;const v=Math.sin(TAU*ph)*Math.exp(-t/(dur*.55));
    x[i]=Math.tanh(v*1.8)*.42;
  }
  return fade(x,.0008,.03);
}

// ------------------------------------------------------------------ drums
// membrane: a sine falling in pitch + a noise skin, decaying
function membrane(f0:number,f1:number,drop:number,dec:number,noiseAmt:number,nf:number,r:Rng,dur=dec*4):Float32Array{
  const n=len(dur),x=new Float32Array(n),nz=noise(n,r);biquad(nz,'bp',nf,1.2);
  let ph=0;
  for(let i=0;i<n;i++){
    const t=i/SR,f=f1+(f0-f1)*Math.exp(-t/drop);ph+=f/SR;
    x[i]=Math.sin(TAU*ph)*Math.exp(-t/dec)+nz[i]*noiseAmt*Math.exp(-t/(dec*.25));
  }
  return fade(x,.0005,.01);
}
// metal: inharmonic partials (a triangle, an agogô bell, a pandeiro's jingles)
function metal(f:number,ratios:number[],dec:number,r:Rng,dur=dec*4,amps?:number[]):Float32Array{
  const n=len(dur),x=new Float32Array(n);
  ratios.forEach((q,k)=>{
    const ff=f*q,ph=r()*TAU,d=dec*Math.pow(.8,k),a=amps?amps[k]:1/(1+k*.6);
    for(let i=0;i<n;i++){const t=i/SR;x[i]+=Math.sin(TAU*ff*t+ph)*Math.exp(-t/d)*a;}
  });
  return fade(x,.0003,.01);
}
function hit(key:string,variants:number,make:(r:Rng)=>Float32Array,r:Rng):Float32Array{
  const k=key+':'+Math.floor(r()*variants);
  let x=cache.get(k);
  if(!x){x=make(rng(k.length*7919+k.charCodeAt(k.length-1)*131+k.charCodeAt(0)));cache.set(k,x);}
  return x;
}
export type Drum='zabumba'|'zabumbaAberta'|'bacalhau'|'triFechado'|'triAberto'|'pandeiroGrave'|'pandeiroTapa'|'pandeiroPlat'|
  'surdo'|'surdoAbafado'|'tanta'|'tantaTapa'|'repique'|'tamborim'|'agogoAlto'|'agogoBaixo'|'ganza'|'kick'|'caixa'|'palma'|
  'chimbal'|'chimbalAberto'|'congaGrave'|'congaAgudo'|'congaTapa'|'cowbell'|'shaker'|'aro'|'clap';
const DRUMS:Record<Drum,[number,(r:Rng)=>Float32Array]>={
  zabumba:[3,r=>{const x=membrane(118,68,.03,.16,.25,180,r);biquad(x,'lowshelf',90,.7,4);return scale(x,1.1);}],
  zabumbaAberta:[3,r=>scale(membrane(110,64,.04,.3,.2,160,r),1.1)],
  bacalhau:[4,r=>{const n=noise(len(.06),r);biquad(n,'bp',2600,1.6);const t=membrane(520,420,.01,.02,0,1,r,.06);
    for(let i=0;i<n.length;i++)n[i]=n[i]*Math.exp(-i/SR/.012)*.9+t[i]*.5;return scale(n,.7);}],
  triFechado:[4,r=>{const x=metal(1150,[1,2.76,5.4,8.93],.035,r,.12);biquad(x,'hp',900,.7);return scale(x,.22);}],
  triAberto:[3,r=>{const x=metal(1150,[1,2.76,5.4,8.93],.6,r,1.6);biquad(x,'hp',900,.7);return scale(x,.2);}],
  pandeiroGrave:[3,r=>{const m=membrane(170,120,.02,.09,.15,300,r,.35);const j=jingles(r,.12);for(let i=0;i<j.length&&i<m.length;i++)m[i]+=j[i]*.35;return scale(m,.8);}],
  pandeiroTapa:[3,r=>{const n=noise(len(.08),r);biquad(n,'bp',1400,1.3);for(let i=0;i<n.length;i++)n[i]*=Math.exp(-i/SR/.018);
    const j=jingles(r,.14);for(let i=0;i<j.length&&i<n.length;i++)n[i]+=j[i]*.5;return scale(n,.75);}],
  pandeiroPlat:[5,r=>scale(jingles(r,.09),.55)],
  surdo:[3,r=>{const x=membrane(64,52,.06,.42,.12,120,r);biquad(x,'lowshelf',80,.7,3);return scale(x,1.15);}],
  surdoAbafado:[3,r=>scale(membrane(64,54,.04,.08,.1,120,r,.3),1)],
  tanta:[3,r=>scale(membrane(96,78,.03,.22,.2,220,r),.95)],
  tantaTapa:[3,r=>{const x=membrane(150,120,.01,.04,.7,900,r,.2);return scale(x,.7);}],
  repique:[3,r=>{const x=membrane(290,240,.01,.09,.5,1600,r,.4);return scale(x,.55);}],
  tamborim:[4,r=>{const x=membrane(620,560,.004,.035,.6,2400,r,.15);biquad(x,'hp',400,.7);return scale(x,.5);}],
  agogoAlto:[2,r=>scale(metal(1260,[1,2.1,3.95],.18,r,.6,[1,.4,.25]),.28)],
  agogoBaixo:[2,r=>scale(metal(940,[1,2.1,3.95],.2,r,.6,[1,.4,.25]),.3)],
  ganza:[4,r=>{const n=noise(len(.09),r);biquad(n,'hp',4500,.7);biquad(n,'bp',7000,.8);
    for(let i=0;i<n.length;i++){const t=i/SR;n[i]*=Math.min(1,t/.012)*Math.exp(-t/.03);}return scale(n,.35);}],
  kick:[2,r=>{const x=membrane(160,48,.025,.14,.05,100,r,.5);for(let i=0;i<x.length;i++)x[i]=Math.tanh(x[i]*1.6);return scale(x,.9);}],
  caixa:[3,r=>{const m=membrane(210,180,.01,.06,0,1,r,.25),n=noise(m.length,r);biquad(n,'bp',3800,.6);
    for(let i=0;i<n.length;i++)m[i]=m[i]*.6+n[i]*Math.exp(-i/SR/.09)*.9;return scale(m,.6);}],
  palma:[3,r=>clapLike(r,.42)],
  clap:[3,r=>clapLike(r,.5)],
  chimbal:[4,r=>{const n=noise(len(.05),r);biquad(n,'hp',7500,.7);for(let i=0;i<n.length;i++)n[i]*=Math.exp(-i/SR/.012);return scale(n,.28);}],
  chimbalAberto:[3,r=>{const n=noise(len(.32),r);biquad(n,'hp',7000,.7);for(let i=0;i<n.length;i++)n[i]*=Math.exp(-i/SR/.1);return scale(n,.22);}],
  congaGrave:[3,r=>scale(membrane(190,165,.01,.16,.15,500,r,.5),.65)],
  congaAgudo:[3,r=>scale(membrane(290,260,.008,.12,.15,700,r,.4),.55)],
  congaTapa:[3,r=>{const x=membrane(330,300,.005,.03,.8,1800,r,.15);return scale(x,.55);}],
  cowbell:[2,r=>{const x=metal(540,[1,1.48,2.9],.09,r,.35,[1,.8,.3]);biquad(x,'bp',800,1.2);return scale(x,.5);}],
  shaker:[4,r=>{const n=noise(len(.07),r);biquad(n,'bp',6000,.9);for(let i=0;i<n.length;i++){const t=i/SR;n[i]*=Math.min(1,t/.01)*Math.exp(-t/.025);}return scale(n,.3);}],
  aro:[3,r=>{const x=membrane(900,820,.004,.015,.5,3200,r,.08);return scale(x,.4);}],
};
function scale(x:Float32Array,g:number):Float32Array{for(let i=0;i<x.length;i++)x[i]*=g;return x;}
function jingles(r:Rng,dur:number):Float32Array{
  const n=len(dur),x=new Float32Array(n);
  for(let k=0;k<6;k++){
    const f=5200+r()*3800,d=.02+r()*.05,off=Math.floor(r()*len(.012)),ph=r()*TAU;
    for(let i=off;i<n;i++){const t=(i-off)/SR;x[i]+=Math.sin(TAU*f*t+ph)*Math.exp(-t/d)*.4;}
  }
  const nz=noise(n,r);biquad(nz,'hp',6000,.7);
  for(let i=0;i<n;i++)x[i]+=nz[i]*Math.exp(-i/SR/.03)*.5;
  return x;
}
function clapLike(r:Rng,g:number):Float32Array{
  const n=len(.3),x=new Float32Array(n);
  for(const off of[0,.011,.021,.034]){
    const o=len(off),nz=noise(n-o,r);biquad(nz,'bp',1300,1);
    const d=off<.03?.006:.06;
    for(let i=0;i<nz.length;i++)x[i+o]+=nz[i]*Math.exp(-i/SR/d)*(off<.03?.7:1);
  }
  return scale(x,g);
}
export function drum(d:Drum,r:Rng):Float32Array{const[v,make]=DRUMS[d];return hit(d,v,make,r);}
// the cuíca: a friction drum, its pitch riding the stick (the pagode jingle's "uii")
export function cuica(midi0:number,midi1:number,dur:number,r:Rng):Float32Array{
  const n=len(dur),x=new Float32Array(n),nz=noise(n,r);let ph=0;
  for(let i=0;i<n;i++){
    const t=i/SR,k=t/dur,m=midi0+(midi1-midi0)*Math.sin(Math.min(1,k*1.4)*Math.PI/2);
    ph+=mtof(m)/SR;const rough=1+.25*nz[i];
    x[i]=Math.sin(TAU*ph+.6*Math.sin(TAU*ph*2))*rough*Math.min(1,t/.02)*Math.min(1,(dur-t)/.06)*.22;
  }
  biquad(x,'bp',mtof((midi0+midi1)/2)*1.5,.9);
  return scale(x,2.2);
}
