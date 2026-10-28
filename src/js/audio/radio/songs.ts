// The radio's music — each station's songs (fictional: titles and artists from Divinolândia and
// its region, the interior paulista of the Serra da Mantiqueira, coffee and the Rio do Peixe)
// and its vinheta. PURE: every song is a function laying one bar's notes (radio/engine.ts
// renders them with radio/dsp.ts). Arrangements follow how each genre is actually played:
//  - MODÃO FM: música caipira — the viola caipira's ponteado in thirds (the duo's "terças"),
//    the violão's levada, the acoustic bass: a pagode de viola, a toada with the sanfona, a
//    rasqueado in 3/4 with the Paraguayan harp (so much of the interior's sertanejo raiz);
//  - ARRASTA-PÉ FM: forró pé-de-serra — sanfona, zabumba with its bacalhau, triângulo: baião,
//    xote, a fast arrasta-pé — and a piseiro on the keyboard;
//  - PAGODÃO: samba and pagode — cavaquinho, banjo, violão de 7 cordas with its baixarias,
//    pandeiro, tantã, surdo, repique, tamborim, agogô: a romantic pagode, a partido-alto,
//    a samba de roda;
//  - BATIDÃO: funk — a tamborzão, a mandelão (the São Paulo funk: 808 glides and the "tuin"),
//    a funk melody.
import {pluck,sanfona,bell,epiano,teclado,pad,stab,tuin,k808,drum,cuica,type Rng,type StringKind,type Drum} from './dsp.ts';
import {MAJOR,MIXO,form,melody,voicing,bass,fifth,tonesIn,terca,chordAt,type Key,type Bar,type MelStyle,type MNote,type Chord} from './theory.ts';

export interface NoteOpts{g?:number;pan?:number;rev?:number;dly?:number;jit?:number;late?:number}
export interface BarCtx{bar:number;bars:number;beats:number;spb:number;r:Rng;note:(x:Float32Array,pos:number,o?:NoteOpts)=>void}
export interface SongDef{
  title:string;artist:string;bpm:number;beats:number;bars:number;swing?:number;
  reverb:{room:number;damp:number;wet:number};delay?:{beats:number;fb:number;wet:number};
  play:(c:BarCtx)=>void;
}
export interface StationMusic{songs:SongDef[];jingle:SongDef}

// ------------------------------------------------------------------ helpers
type S=[string,number,string][];
interface Ctx{c:BarCtx;b:Bar;k:Key;mel:(sec?:string)=>MNote[];last:boolean;first:boolean;end:boolean}
function song(meta:Omit<SongDef,'bars'|'play'>,k:Key,secs:S,mels:Record<string,MelStyle>,seed:number,
  play:(x:Ctx)=>void):SongDef{
  const bars=form(k,secs);
  // one melody per section name (a section comes back with the same tune)
  const cache=new Map<string,MNote[][]>();
  const melOf=(sec:string):MNote[][]=>{
    let m=cache.get(sec);
    if(!m){
      const st=mels[sec];m=[];
      if(st){
        const sb=bars.filter(b=>b.sec===sec),n=sb[0]?.n??0,one=sb.slice(0,n);
        const notes=melody(k,one,meta.beats,st,seed+sec.charCodeAt(0)*31+sec.length);
        for(let i=0;i<n;i++)m.push(notes.filter(q=>q.bar===i));
      }
      cache.set(sec,m);
    }
    return m;
  };
  return{...meta,bars:bars.length,play:c=>{
    const b=bars[c.bar];
    play({c,b,k,mel:(sec=b.sec)=>melOf(sec)[b.i]??[],last:b.i===b.n-1,first:b.i===0,end:c.bar===bars.length-1});
  }};
}
const pl=(c:BarCtx,kind:StringKind,m:number,pos:number,beats:number,o:NoteOpts&{mute?:number}={}):void=>
  c.note(pluck(kind,m,Math.min(4,beats*c.spb+(o.mute?.05:.6)),c.r,o.mute??0),pos,o);
// a strum: strings a few ms apart, low to high (down) or high to low (up)
function strum(c:BarCtx,kind:StringKind,ms:number[],pos:number,beats:number,o:NoteOpts&{mute?:number;up?:boolean;spread?:number}={}):void{
  const seq=o.up?[...ms].reverse():ms,sp=o.spread??.011;
  seq.forEach((m,i)=>pl(c,kind,m,pos,beats,{...o,late:(o.late??0)+i*sp,g:(o.g??1)*(o.up?.75:1)/Math.sqrt(ms.length)*1.6}));
}
const dr=(c:BarCtx,d:Drum,pos:number,o:NoteOpts={}):void=>c.note(drum(d,c.r),pos,{rev:.08,...o});
const steps=(beats:number):number[]=>Array.from({length:beats*4},(_,i)=>i);

// melody rhythm cells: [onset, duration] in 16ths over two bars
const CELLS={
  pagode:[[[0,2],[2,2],[4,1],[5,1],[6,2],[8,4],[12,2],[14,2]],[[0,3],[3,1],[4,2],[6,2],[8,2],[10,2],[12,4]],[[2,2],[4,2],[6,2],[8,3],[11,1],[12,4]]] as [number,number][][],
  toada:[[[0,6],[6,2],[8,4],[12,4],[16,8],[24,4],[28,4]],[[0,4],[4,4],[8,6],[14,2],[16,12],[28,4]],[[2,2],[4,4],[8,4],[12,4],[16,6],[22,2],[24,8]]] as [number,number][][],
  valsa:[[[0,4],[4,4],[8,4],[12,6],[18,2],[20,4]],[[0,6],[6,2],[8,4],[12,8],[20,4]],[[0,2],[2,2],[4,4],[8,4],[12,4],[16,8]]] as [number,number][][],
  baiao:[[[0,3],[3,3],[6,2],[8,2],[10,2],[12,4],[16,3],[19,3],[22,2],[24,8]],[[2,2],[4,2],[6,2],[8,4],[12,2],[14,2],[16,3],[19,5],[24,8]],[[0,2],[2,1],[3,3],[6,2],[8,6],[16,2],[18,2],[20,4],[24,4],[28,4]]] as [number,number][][],
  xote:[[[0,4],[4,2],[6,2],[8,4],[12,4],[16,6],[22,2],[24,8]],[[2,2],[4,4],[8,2],[10,2],[12,4],[16,8],[24,4],[28,4]]] as [number,number][][],
  corrido:[[[0,1],[1,1],[2,1],[3,1],[4,2],[6,2],[8,1],[9,1],[10,1],[11,1],[12,4]],[[0,2],[2,1],[3,1],[4,1],[5,1],[6,2],[8,2],[10,2],[12,2],[14,2]]] as [number,number][][],
  piseiro:[[[0,2],[2,2],[4,2],[6,4],[10,2],[12,4],[16,2],[18,2],[20,2],[22,2],[24,8]],[[2,2],[4,2],[6,2],[8,4],[14,2],[16,4],[20,4],[24,4],[28,4]]] as [number,number][][],
  samba:[[[0,2],[2,2],[4,3],[7,1],[8,2],[10,2],[12,4],[16,3],[19,1],[20,4],[24,8]],[[2,2],[4,2],[6,2],[8,2],[10,3],[13,3],[16,6],[22,2],[24,8]],[[0,3],[3,3],[6,2],[8,4],[12,4],[16,2],[18,2],[20,2],[22,2],[24,8]]] as [number,number][][],
  funk:[[[0,2],[2,2],[4,4],[8,2],[10,2],[12,4],[16,2],[18,2],[20,4],[24,8]],[[2,2],[4,2],[6,2],[8,6],[16,2],[18,2],[20,2],[22,2],[24,8]]] as [number,number][][],
  plim:[[[0,1],[2,1],[3,1],[6,2],[8,1],[10,1],[12,2],[16,1],[18,1],[19,1],[22,2],[24,4]],[[0,2],[3,1],[6,1],[8,2],[11,1],[14,2],[16,2],[19,1],[22,1],[24,6]]] as [number,number][][],
};
const mstyle=(cells:[number,number][][],lo:number,hi:number,start:number,leap=2):MelStyle=>({cells,lo,hi,start,leap});

// ============================================================ MODÃO FM 107.1 (caipira)
// the violão's pagode levada and the bass, 2/4
function caipiraLevada(c:BarCtx,b:Bar,g=1):void{
  const v=voicing(b.ch,52,4),bs=bass(b.ch,38);
  pl(c,'violao',bs,0,.9,{g:.9*g,pan:-.2});pl(c,'baixo',bs-12,0,.9,{g:.8*g,rev:.04});
  pl(c,'violao',fifth(b.ch,38),1,.9,{g:.8*g,pan:-.2});pl(c,'baixo',fifth(b.ch,38)-12,1,.9,{g:.7*g,rev:.04});
  strum(c,'violao',v,.5,.25,{mute:.7,g:.5*g,pan:-.25});
  strum(c,'violao',v,.75,.25,{mute:.6,g:.45*g,pan:-.25,up:true});
  strum(c,'violao',v,1.5,.4,{mute:.55,g:.5*g,pan:-.25});
}
// the viola's ponteio riff: thirds running down (and back up) the scale over the chord
function ponteio(x:Ctx,up:boolean):void{
  const{c,b,k}=x,top=tonesIn(b.ch,74,86)[0]??78;
  const scale=Array.from({length:30},(_,i)=>k.tonic-24+[0,2,4,5,7,9,11][i%7]+12*Math.floor(i/7)).filter(m=>m>=60&&m<=88);
  let idx=scale.findIndex(m=>m>=top);if(idx<0)idx=scale.length-1;
  for(let s=0;s<7;s++){
    const i=up?idx-6+s:idx-s,hi=scale[Math.max(2,Math.min(scale.length-1,i))],lo=scale[Math.max(0,Math.min(scale.length-3,i-2))];
    const pos=s*.25;
    pl(c,'viola',hi,pos,.4,{g:.55,pan:.3,rev:.2});pl(c,'viola',lo,pos,.4,{g:.42,pan:.3,rev:.2,late:.006});
  }
}
const modao1=song({title:'Pagode do Rio do Peixe',artist:'Zé Divino & Serrano',bpm:118,beats:2,reverb:{room:.7,damp:.45,wet:.9}},
  {tonic:62,scale:MAJOR},
  [['intro',8,'I I V7 V7 V7 V7 I I'],['A',16,'I I V7 V7 V7 V7 I I I I IV IV V7 V7 I I'],['riff',4,'I I V7 I'],
   ['B',16,'IV IV I I V7 V7 I I IV IV I I V7 V7 I I'],['riff',4,'I I V7 I'],['A',16,'I I V7 V7 V7 V7 I I I I IV IV V7 V7 I I'],
   ['B',16,'IV IV I I V7 V7 I I IV IV I I V7 V7 I I'],['outro',6,'I I V7 V7 I I']],
  {A:mstyle(CELLS.pagode,66,83,74),B:mstyle(CELLS.pagode,69,86,78)},107,x=>{
    const{c,b,k}=x;
    caipiraLevada(c,b);
    if(b.sec==='intro'||b.sec==='riff'||b.sec==='outro'){
      if(x.end){strum(c,'viola',voicing(b.ch,62,5),0,3,{g:.9,pan:.3,rev:.3});strum(c,'violao',voicing(b.ch,45,5),0,3,{g:.8,pan:-.2});return;}
      ponteio(x,b.i%2===1);
    }else{
      for(const n of x.mel()){                                 // the duo in thirds, on the viola
        pl(c,'viola',n.midi,n.pos,n.dur+.2,{g:.62,pan:.25,rev:.25});
        pl(c,'viola',terca(k,n),n.pos,n.dur+.2,{g:.48,pan:.38,rev:.25,late:.007});
      }
      if(b.sec==='B')strum(c,'viola',voicing(b.ch,62,4),1.75,.25,{g:.28,pan:.35,mute:.4});
    }
  });
// a toada: the viola dedilhada, the sanfona singing with the viola a third below
const modao2=song({title:'Toada da Mantiqueira',artist:'Irmãs Cafezal',bpm:74,beats:4,reverb:{room:.8,damp:.4,wet:1.1}},
  {tonic:69,scale:MAJOR},
  [['intro',4,'I IV I V7'],['A',8,'I I IV I I V7 V7 I'],['B',8,'IV IV I vi ii7 V7 I I'],['A',8,'I I IV I I V7 V7 I'],
   ['B',8,'IV IV I vi ii7 V7 I I'],['outro',4,'IV I V7 I']],
  {intro:mstyle(CELLS.toada,72,86,81),A:mstyle(CELLS.toada,69,84,76),B:mstyle(CELLS.toada,72,88,81)},211,x=>{
    const{c,b,k}=x,v=voicing(b.ch,55,4);
    pl(c,'baixo',bass(b.ch,33),0,2,{g:.85,rev:.05});pl(c,'baixo',fifth(b.ch,33),2,2,{g:.7,rev:.05});
    if(x.end){strum(c,'viola',voicing(b.ch,57,5),0,4,{g:.9,pan:.25,rev:.4,spread:.03});pl(c,'baixo',bass(b.ch,33),0,4,{g:.9});return;}
    [0,2,3,1,2,3,1,2].forEach((ix,s)=>pl(c,'viola',v[ix],s*.5,1.6,{g:.38,pan:.25,rev:.3}));
    const sec=b.sec==='outro'?'intro':b.sec;
    for(const n of x.mel(sec)){
      c.note(sanfona(n.midi,n.dur*c.spb,c.r,{reeds:'doce',shake:n.dur>=2?.4:0}),n.pos,{g:.9,pan:.1,rev:.3});
      if(b.sec!=='intro'&&b.sec!=='outro')pl(c,'viola',terca(k,n),n.pos,n.dur,{g:.45,pan:.35,rev:.3});
    }
  });
// a rasqueado in 3/4 (the guarânia's sway): the violão rasqueando, the harp's arpeggios
const modao3=song({title:'Rasqueado da Estação',artist:'Trio Serra Alta',bpm:128,beats:3,reverb:{room:.78,damp:.4,wet:1}},
  {tonic:67,scale:MAJOR},
  [['intro',8,'I I V7 V7 V7 V7 I I'],['A',16,'I I V7 V7 V7 V7 I I I I7 IV IV I V7 I I'],['B',16,'IV IV I I V7 V7 I I IV IV I I V7 V7 I I'],
   ['harpa',8,'I I V7 V7 V7 V7 I I'],['A',16,'I I V7 V7 V7 V7 I I I I7 IV IV I V7 I I'],['B',16,'IV IV I I V7 V7 I I IV IV I I V7 V7 I I'],['outro',4,'I V7 I I']],
  {A:mstyle(CELLS.valsa,71,86,79),B:mstyle(CELLS.valsa,72,88,83)},331,x=>{
    const{c,b,k}=x,v=voicing(b.ch,52,4);
    pl(c,'baixo',bass(b.ch,31),0,1.5,{g:.85,rev:.04});pl(c,'baixo',fifth(b.ch,31),2,1,{g:.6,rev:.04});
    pl(c,'violao',bass(b.ch,43),0,1,{g:.7,pan:-.25});
    strum(c,'violao',v,1,.5,{g:.6,pan:-.25,mute:.35});strum(c,'violao',v,1.5,.5,{g:.45,pan:-.25,mute:.45,up:true});strum(c,'violao',v,2,.9,{g:.55,pan:-.25,mute:.3});
    if(x.end){strum(c,'harpa',voicing(b.ch,55,7),0,3,{g:1,pan:.2,rev:.4,spread:.04});return;}
    if(b.sec==='intro'||b.sec==='harpa'||b.sec==='outro'){
      const t=tonesIn(b.ch,59,91);
      for(let s=0;s<6;s++)pl(c,'harpa',t[(b.i%2?5-s:s)+2]??t[t.length-1],s*.5,1.2,{g:.6,pan:.2,rev:.35});
    }else{
      for(const n of x.mel()){
        c.note(sanfona(n.midi,n.dur*c.spb,c.r,{reeds:'doce'}),n.pos,{g:.85,pan:.12,rev:.28});
        c.note(sanfona(terca(k,n),n.dur*c.spb,c.r,{reeds:'doce'}),n.pos,{g:.5,pan:.3,rev:.28,late:.008});
      }
      if(b.i%4===3)for(const[s,m]of tonesIn(b.ch,67,84).slice(0,3).entries())pl(c,'harpa',m,1+s*.5,1,{g:.35,pan:.2,rev:.35});
    }
  });
const modaoJingle:SongDef={title:'MODÃO FM 107.1',artist:'',bpm:96,beats:4,bars:2,reverb:{room:.82,damp:.35,wet:1.2},play:c=>{
  if(c.bar===0){
    strum(c,'viola',[62,66,69,74,78],0,4,{g:.85,pan:.25,rev:.4,spread:.05});
    [74,78,81,86].forEach((m,i)=>c.note(bell(m,1.6,{ratio:2,index:.6,decay:.6}),1.5+i*.5,{g:.5,pan:-.2+i*.15,rev:.5}));
  }else{strum(c,'viola',[57,61,64,69,73],0,1.5,{g:.7,pan:.25,rev:.4});strum(c,'viola',[62,66,69,74,78],1.5,3,{g:.9,pan:.25,rev:.45,spread:.03});pl(c,'baixo',38,1.5,3,{g:.8});}
}};

// ============================================================ ARRASTA-PÉ FM 92.7 (forró)
function triangulo(c:BarCtx,beats:number,g=1):void{
  for(const s of steps(beats))dr(c,s%4===2?'triAberto':'triFechado',s/4,{g:(s%4===3?.9:s%4===2?.75:.55)*g,pan:.45,rev:.12});
}
function zabumbaBaiao(c:BarCtx,beats:number,g=1):void{
  for(let h=0;h<beats;h+=2){
    dr(c,'zabumbaAberta',h,{g:1*g,rev:.05});dr(c,'zabumba',h+.75,{g:.85*g,rev:.05});
    dr(c,'bacalhau',h+1,{g:.55*g,pan:-.1});dr(c,'bacalhau',h+1.5,{g:.45*g,pan:-.1});
  }
}
const sanfonaChord=(c:BarCtx,ch:Chord,pos:number,beats:number,g=1):void=>{for(const m of voicing(ch,54,3))c.note(sanfona(m,beats*c.spb,c.r,{reeds:'baixo'}),pos,{g:.5*g,pan:-.1,rev:.12});};
const forro1=song({title:'Baião do Cafezal',artist:'Trio Pé de Serra Divino',bpm:112,beats:4,reverb:{room:.62,damp:.5,wet:.7}},
  {tonic:67,scale:MIXO},
  [['intro',4,'I I bVII I'],['A',8,'I I bVII I I I IV V7'],['B',8,'IV IV I I V7 V7 I I'],['solo',8,'I I bVII I I I IV V7'],
   ['A',8,'I I bVII I I I IV V7'],['B',8,'IV IV I I V7 V7 I I'],['outro',2,'IV I']],
  {intro:mstyle(CELLS.baiao,74,88,79),A:mstyle(CELLS.baiao,71,86,79),B:mstyle(CELLS.baiao,74,90,83),solo:mstyle(CELLS.baiao,76,93,86,3)},412,x=>{
    const{c,b}=x;
    if(x.end){dr(c,'zabumbaAberta',0,{g:1.1});dr(c,'triAberto',0,{g:.8,pan:.45});for(const m of voicing(b.ch,67,4))c.note(sanfona(m,2.5*c.spb,c.r,{shake:.5}),0,{g:.7,pan:.15,rev:.25});pl(c,'baixo',bass(b.ch,31),0,2.5,{g:.9});return;}
    triangulo(c,4,b.sec==='intro'?.6:1);
    if(b.sec!=='intro')zabumbaBaiao(c,4);
    for(let h=0;h<4;h+=2){
      const ch=chordAt(b,h,4),bs=bass(ch,31);
      pl(c,'baixo',bs,h,.7,{g:.9,rev:.03});pl(c,'baixo',fifth(ch,31),h+.75,.5,{g:.75,rev:.03});pl(c,'baixo',bs+12,h+1.5,.4,{g:.6,rev:.03});
      if(b.sec!=='intro'){sanfonaChord(c,ch,h+.5,.3);sanfonaChord(c,ch,h+1.5,.3,.8);}
    }
    for(const n of x.mel())c.note(sanfona(n.midi,n.dur*c.spb,c.r,{shake:b.sec==='solo'&&n.dur>=1?.7:0}),n.pos,{g:.95,pan:.15,rev:.22});
  });
const forro2=song({title:'Xote da Praça da Matriz',artist:'Zé Sanfona',bpm:96,beats:4,swing:.45,reverb:{room:.66,damp:.5,wet:.8}},
  {tonic:74,scale:MAJOR},
  [['intro',4,'I vi ii7 V7'],['A',8,'I vi ii7 V7 I vi ii7 V7'],['B',8,'IV IV I I ii7 V7 I I7'],['A',8,'I vi ii7 V7 I vi ii7 V7'],
   ['B',8,'IV IV I I ii7 V7 I I7'],['outro',2,'V7 I']],
  {intro:mstyle(CELLS.xote,74,88,81),A:mstyle(CELLS.xote,69,86,78),B:mstyle(CELLS.xote,72,88,81)},523,x=>{
    const{c,b}=x,sh=(p:number):number=>Math.abs(p-Math.floor(p)-.5)<1e-6?p+.16:p;    // shuffled 8ths
    if(x.end){dr(c,'zabumbaAberta',0);for(const m of voicing(b.ch,66,4))c.note(sanfona(m,2.5*c.spb,c.r,{shake:.6,reeds:'doce'}),0,{g:.7,pan:.15,rev:.3});pl(c,'baixo',bass(b.ch,33),0,2.5,{g:.9});return;}
    for(let e=0;e<8;e++)dr(c,e%2?'triAberto':'triFechado',sh(e*.5),{g:e%2?.7:.55,pan:.45});
    if(b.sec!=='intro'){dr(c,'zabumbaAberta',0,{g:.95});dr(c,'zabumba',sh(1.5),{g:.7});dr(c,'zabumba',2,{g:.85});dr(c,'bacalhau',1,{g:.5});dr(c,'bacalhau',3,{g:.5});dr(c,'bacalhau',sh(3.5),{g:.35});}
    pl(c,'baixo',bass(b.ch,33),0,1.5,{g:.9});pl(c,'baixo',fifth(b.ch,33),2,1.5,{g:.75});
    if(b.sec!=='intro'){sanfonaChord(c,b.ch,1,.35);sanfonaChord(c,chordAt(b,3,4),3,.35);}
    for(const n of x.mel())c.note(sanfona(n.midi,n.dur*c.spb,c.r,{reeds:n.dur>=2?'doce':'musette',shake:n.dur>=2?.35:0}),sh(n.pos),{g:.9,pan:.15,rev:.26});
  });
const forro3=song({title:'Arrasta-pé na Quermesse',artist:'Os Sanfoneiros da Serra',bpm:150,beats:2,reverb:{room:.6,damp:.5,wet:.65}},
  {tonic:72,scale:MAJOR},
  [['intro',4,'I V7 V7 I'],['A',16,'I I V7 V7 V7 V7 I I I I V7 V7 V7 V7 I I'],['B',16,'IV IV I I V7 V7 I I IV IV I I V7 V7 I I'],
   ['A',16,'I I V7 V7 V7 V7 I I I I V7 V7 V7 V7 I I'],['B',16,'IV IV I I V7 V7 I I IV IV I I V7 V7 I I'],['outro',4,'V7 V7 I I']],
  {intro:mstyle(CELLS.corrido,72,88,79,1),A:mstyle(CELLS.corrido,72,91,84,1),B:mstyle(CELLS.corrido,74,93,86,1),outro:mstyle(CELLS.corrido,72,88,84,1)},631,x=>{
    const{c,b}=x;
    if(x.end){dr(c,'zabumbaAberta',0,{g:1.1});dr(c,'triAberto',0,{g:.8,pan:.45});for(const m of voicing(b.ch,67,4))c.note(sanfona(m,1.6*c.spb,c.r),0,{g:.75,pan:.15,rev:.22});pl(c,'baixo',bass(b.ch,36),0,2,{g:.9});return;}
    triangulo(c,2);
    dr(c,'zabumba',0,{g:.95});dr(c,'zabumba',1,{g:.8});dr(c,'bacalhau',.5,{g:.4});dr(c,'bacalhau',1.5,{g:.5});
    pl(c,'baixo',bass(b.ch,36),0,.45,{g:.9});pl(c,'baixo',fifth(b.ch,36),1,.45,{g:.8});
    sanfonaChord(c,b.ch,.5,.22);sanfonaChord(c,b.ch,1.5,.22);
    for(const n of x.mel())c.note(sanfona(n.midi,n.dur*c.spb,c.r),n.pos,{g:.85,pan:.15,rev:.18});
  });
const forro4=song({title:'Pisada do Morro da Torre',artist:'Banda Forró Divino',bpm:155,beats:4,reverb:{room:.55,damp:.45,wet:.55},delay:{beats:.75,fb:.3,wet:.18}},
  {tonic:72,scale:MAJOR},
  [['intro',4,'vi IV I V'],['A',8,'vi IV I V vi IV I V'],['B',8,'vi IV I V vi IV I V'],['A',8,'vi IV I V vi IV I V'],
   ['B',8,'vi IV I V vi IV I V'],['B',8,'vi IV I V vi IV I V'],['outro',2,'vi vi']],
  {intro:mstyle(CELLS.piseiro,76,91,84),A:mstyle(CELLS.piseiro,72,86,79),B:mstyle(CELLS.piseiro,76,91,84)},743,x=>{
    const{c,b}=x;
    if(x.end){dr(c,'kick',0,{g:1});c.note(k808(bass(b.ch,33),1.2),0,{g:.8});for(const m of voicing(b.ch,64,4))c.note(teclado(m,1.4,c.r,false),0,{g:.6,pan:.1,rev:.3,dly:.2});return;}
    const drums=b.sec!=='intro'||b.i>=2;
    if(drums){
      for(let q=0;q<4;q++)dr(c,'kick',q,{g:1,rev:0});
      dr(c,'clap',1,{g:.7});dr(c,'clap',3,{g:.7});
      for(let e=0;e<8;e++)if(e%2)dr(c,'chimbal',e*.5,{g:.8,pan:.3});
      for(const s of steps(4))dr(c,'shaker',s/4,{g:s%2?.5:.3,pan:-.35});
    }
    for(let e=0;e<8;e++){const bs=bass(chordAt(b,e*.5,4),33);c.note(k808(e%2?bs+12:bs,.24,{punch:.3}),e*.5,{g:drums?.55:.35,rev:0});}
    if(b.sec==='B')for(let e=1;e<8;e+=2)for(const m of voicing(chordAt(b,e*.5,4),60,3))c.note(teclado(m,.14,c.r,false),e*.5,{g:.22,pan:-.2,rev:.15});
    for(const n of x.mel())c.note(teclado(n.midi,n.dur*c.spb,c.r,n.dur<1),n.pos,{g:.85,pan:.1,rev:.18,dly:.25});
  });
const forroJingle:SongDef={title:'ARRASTA-PÉ FM 92.7',artist:'',bpm:120,beats:4,bars:2,reverb:{room:.65,damp:.5,wet:.8},play:c=>{
  if(c.bar===0){
    [67,69,71,72,74,76,77,79,81,83,84,86].forEach((m,i)=>c.note(sanfona(m,.16,c.r),i*.25,{g:.75,pan:.15,rev:.2}));
    dr(c,'triAberto',3,{g:.8,pan:.45});dr(c,'triAberto',3.5,{g:.8,pan:.45});
  }else{
    dr(c,'zabumbaAberta',0,{g:1.1});dr(c,'triAberto',0,{g:.9,pan:.45});
    for(const m of[67,71,74,79])c.note(sanfona(m,1.6,c.r,{shake:.6}),0,{g:.7,pan:.15,rev:.3});
    pl(c,'baixo',43,0,3,{g:.9});
  }
}};

// ============================================================ PAGODÃO 104.5 (samba, pagode)
function pandeiro(c:BarCtx,g=1):void{
  for(const s of steps(4)){
    const q=s%4,beat=s>>2;
    dr(c,q===0?(beat%2?'pandeiroTapa':'pandeiroGrave'):'pandeiroPlat',s/4,{g:(q===0?.9:q===3?.75:.5)*g,pan:-.4});
  }
}
function surdos(c:BarCtx,g=1):void{
  dr(c,'surdoAbafado',0,{g:.55*g});dr(c,'surdo',1,{g:1*g});dr(c,'surdoAbafado',2,{g:.55*g});dr(c,'surdo',3,{g:1*g});
}
// the cavaquinho's centro: sixteenths, accents on the samba's syncopation
const CENTRO=[1,0,1,1,0,1,0,1,1,0,1,1,0,1,0,1],PARTIDO=[1,0,1,0,0,1,0,1,1,0,1,0,0,1,0,0];
function cavaco(c:BarCtx,b:Bar,pat:number[],g=1):void{
  pat.forEach((a,s)=>{
    const ch=chordAt(b,s/4,4),v=voicing(ch,62,4);
    strum(c,'cavaco',v,s/4,.3,{g:(a?.55:.28)*g,mute:a?.4:.75,up:s%2===1,pan:.35,spread:.006});
  });
}
// the violão de 7 cordas: the bass on the beat and its baixaria walking to the next chord
function seteCordas(c:BarCtx,b:Bar,k:Key,next:Chord|null,walk:boolean):void{
  pl(c,'violao',bass(b.ch,36),0,1.2,{g:.85,pan:-.15});pl(c,'violao',fifth(chordAt(b,2,4),36),2,1,{g:.7,pan:-.15});
  pl(c,'baixo',bass(b.ch,28),0,1.5,{g:.55});pl(c,'baixo',bass(chordAt(b,2,4),28),2,1.5,{g:.5});
  if(walk&&next){
    const to=bass(next,36)+12,sc=k.scale.map(d=>(k.tonic+d)%12);
    let m=to+7;const run:number[]=[];
    while(run.length<6&&m>to){m--;if(sc.includes(((m%12)+12)%12))run.push(m);}
    run.slice(0,6).forEach((n,i)=>pl(c,'violao',n-12,2.5+i*.25,.3,{g:.6,pan:-.15}));
  }
}
const pagode1=song({title:'Saudade na Praça',artist:'Grupo Raiz da Serra',bpm:86,beats:4,swing:.3,reverb:{room:.7,damp:.42,wet:.9}},
  {tonic:64,scale:MAJOR},
  [['intro',4,'ii7 V7 I I'],['A',8,'I VI7 ii7 V7 I VI7 ii7 V7'],['B',8,'IV iv6 I VI7 ii7 V7 I I7'],['A',8,'I VI7 ii7 V7 I VI7 ii7 V7'],
   ['B',8,'IV iv6 I VI7 ii7 V7 I I7'],['outro',4,'ii7 V7 I I']],
  {intro:mstyle(CELLS.samba,71,86,79),A:mstyle(CELLS.samba,67,83,76),B:mstyle(CELLS.samba,71,88,80)},853,x=>{
    const{c,b,k}=x;
    if(x.end){dr(c,'surdo',0,{g:1});strum(c,'cavaco',voicing(b.ch,62,4),0,3,{g:.8,pan:.35});c.note(epiano(voicing(b.ch,55,4)[0],3),0,{g:.5});for(const m of voicing(b.ch,57,4))c.note(epiano(m,3,.7),0,{g:.45,pan:-.2,rev:.3});pl(c,'violao',bass(b.ch,36),0,3,{g:.9});return;}
    pandeiro(c);surdos(c,b.sec==='intro'?.6:1);
    dr(c,'tanta',0,{g:.7,pan:.2});dr(c,'tantaTapa',1.5,{g:.55,pan:.2});dr(c,'tanta',2.5,{g:.6,pan:.2});dr(c,'tantaTapa',3.5,{g:.5,pan:.2});
    if(x.last&&b.sec!=='intro')for(const s of steps(4))if(s>=8)dr(c,'repique',s/4,{g:.4+(s-8)*.05,pan:.3});
    cavaco(c,b,CENTRO,.9);
    seteCordas(c,b,k,null,false);
    for(const m of voicing(b.ch,57,4))c.note(epiano(m,3.6*c.spb,.6),0,{g:.32,pan:-.25,rev:.3});
    for(const n of x.mel()){
      if(b.sec==='A')c.note(epiano(n.midi,n.dur*c.spb,1),n.pos,{g:.75,pan:.05,rev:.3});
      else{                                             // the banjo's melody, tremolo on the long notes
        const reps=n.dur>=1?Math.floor(n.dur*4):1;
        for(let q=0;q<reps;q++)pl(c,'banjo',n.midi,n.pos+q*.25,.35,{g:q?.42:.65,pan:-.3,rev:.2});
      }
    }
  });
const pagode2=song({title:'Partido do Rio do Peixe',artist:'Samba da Vila Divina',bpm:98,beats:4,swing:.25,reverb:{room:.68,damp:.45,wet:.8}},
  {tonic:72,scale:MAJOR},
  [['intro',4,'vi ii7 III7 vi'],['A',8,'vi ii7 III7 vi vi ii7 III7 vi'],['B',8,'IV V7 I VI7 ii7 III7 vi vi'],['A',8,'vi ii7 III7 vi vi ii7 III7 vi'],
   ['B',8,'IV V7 I VI7 ii7 III7 vi vi'],['outro',2,'III7 vi']],
  {intro:mstyle(CELLS.samba,69,84,76),A:mstyle(CELLS.samba,69,84,76),B:mstyle(CELLS.samba,72,88,81)},967,x=>{
    const{c,b,k}=x;
    if(x.end){dr(c,'surdo',0);strum(c,'cavaco',voicing(b.ch,62,4),0,3,{g:.8,pan:.35});pl(c,'violao',bass(b.ch,36),0,3,{g:.9});return;}
    pandeiro(c);surdos(c);
    PARTIDO.forEach((a,s)=>{if(a)dr(c,'tamborim',s/4,{g:.6,pan:.4});});
    dr(c,'agogoAlto',0,{g:.6,pan:-.45});dr(c,'agogoBaixo',.5,{g:.5,pan:-.45});dr(c,'agogoAlto',1.25,{g:.5,pan:-.45});dr(c,'agogoBaixo',2,{g:.6,pan:-.45});dr(c,'agogoAlto',2.75,{g:.5,pan:-.45});
    cavaco(c,b,PARTIDO);
    seteCordas(c,b,k,null,b.i%2===1);
    for(const n of x.mel()){
      const reps=n.dur>=1?Math.floor(n.dur*4):1;
      for(let q=0;q<reps;q++)pl(c,'banjo',n.midi,n.pos+q*.25,.35,{g:q?.4:.62,pan:-.3,rev:.2});
    }
  });
const pagode3=song({title:'Roda na Rua XV',artist:'Grupo Mantiqueira',bpm:104,beats:4,swing:.28,reverb:{room:.66,damp:.45,wet:.8}},
  {tonic:74,scale:MAJOR},
  [['intro',4,'I I7 IV iv6'],['A',8,'I I7 IV iv6 I VI7 ii7 V7'],['B',8,'ii7 V7 I VI7 ii7 V7 I I'],['A',8,'I I7 IV iv6 I VI7 ii7 V7'],
   ['B',8,'ii7 V7 I VI7 ii7 V7 I I'],['outro',4,'ii7 V7 I I']],
  {intro:mstyle(CELLS.samba,74,88,81),A:mstyle(CELLS.samba,69,86,78),B:mstyle(CELLS.samba,72,88,81)},1049,x=>{
    const{c,b,k}=x;
    if(x.end){dr(c,'surdo',0);strum(c,'cavaco',voicing(b.ch,62,4),0,3,{g:.8,pan:.35});pl(c,'violao',bass(b.ch,36),0,3,{g:.9});return;}
    pandeiro(c);surdos(c);
    for(const s of[0,2,4,7,9,11,13])dr(c,'tamborim',s/4,{g:.6,pan:.4});        // the teleco-teco
    dr(c,'agogoAlto',0,{g:.5,pan:-.45});dr(c,'agogoBaixo',1,{g:.5,pan:-.45});dr(c,'agogoAlto',2,{g:.5,pan:-.45});dr(c,'agogoAlto',2.5,{g:.4,pan:-.45});dr(c,'agogoBaixo',3,{g:.5,pan:-.45});
    cavaco(c,b,CENTRO);
    seteCordas(c,b,k,null,x.last||b.i%4===3);
    for(const n of x.mel()){
      if(b.sec==='B'){const reps=n.dur>=1?Math.floor(n.dur*4):1;for(let q=0;q<reps;q++)pl(c,'banjo',n.midi,n.pos+q*.25,.35,{g:q?.4:.62,pan:-.3,rev:.2});}
      else pl(c,'cavaco',n.midi,n.pos,n.dur+.2,{g:.8,pan:.15,rev:.22});
    }
  });
const pagodeJingle:SongDef={title:'PAGODÃO 104.5',artist:'',bpm:100,beats:4,bars:2,reverb:{room:.7,damp:.45,wet:.9},play:c=>{
  if(c.bar===0){
    c.note(cuica(70,82,.5,c.r),0,{g:.9,pan:.2,rev:.2});c.note(cuica(72,86,.6,c.r),1,{g:.9,pan:.2,rev:.2});
    for(const s of steps(4))if(s>=8)dr(c,'repique',s/4,{g:.4+(s-8)*.06,pan:.3});
    for(const s of steps(4))dr(c,'pandeiroPlat',s/4,{g:.5,pan:-.4});
  }else{
    dr(c,'surdo',0,{g:1.1});strum(c,'cavaco',[62,66,69,74],0,2.5,{g:.9,pan:.35});pl(c,'violao',38,0,2.5,{g:.9});
    pl(c,'banjo',81,0,.4,{g:.6});pl(c,'banjo',78,.25,.4,{g:.6});pl(c,'banjo',86,.5,1.2,{g:.7});
  }
}};

// ============================================================ BATIDÃO FM 98.3 (funk)
const funk1=song({title:'Tamborzão da Marginal',artist:'MC Divino Serrano',bpm:130,beats:4,reverb:{room:.55,damp:.4,wet:.55},delay:{beats:.75,fb:.35,wet:.22}},
  {tonic:72,scale:MAJOR},
  [['intro',4,'vi IV I V'],['A',8,'vi IV I V vi IV I V'],['B',8,'vi IV I V vi IV I V'],['A',8,'vi IV I V vi IV I V'],['B',8,'vi IV I V vi IV I V'],['outro',2,'vi vi']],
  {intro:mstyle(CELLS.plim,79,93,84),B:mstyle(CELLS.plim,79,96,88)},1201,x=>{
    const{c,b}=x,full=b.sec!=='intro'||b.i>=2;
    if(x.end){c.note(k808(bass(b.ch,33),1.6),0,{g:.9});dr(c,'clap',0,{g:.8});c.note(stab(voicing(b.ch,60,3)[0],.6,c.r),0,{g:.7,dly:.3});return;}
    for(const s of steps(4))dr(c,'chimbal',s/4,{g:s%2?.35:.55,pan:.3,rev:0});
    if(full){
      for(const s of[0,6,10])c.note(k808(bass(chordAt(b,s/4,4),33),.4,{punch:1.2}),s/4,{g:.85,rev:0});
      dr(c,'clap',1,{g:.8});dr(c,'clap',3,{g:.8});
      for(const s of[3,11])dr(c,'congaGrave',s/4,{g:.8,pan:-.2});
      for(const s of[7,9,14])dr(c,'congaAgudo',s/4,{g:.7,pan:.25});
      for(const s of[2,13])dr(c,'congaTapa',s/4,{g:.6,pan:.1});
    }
    if(b.i%2===0&&b.sec!=='A')for(const m of voicing(b.ch,60,3))c.note(stab(m,.35,c.r),0,{g:.5,pan:-.1,dly:.2});
    const mel=b.sec==='A'?(b.i%2?x.mel('B').slice(0,3):[]):x.mel();
    for(const n of mel)c.note(bell(n.midi,Math.max(.3,n.dur*c.spb),{decay:.35}),n.pos,{g:.65,pan:.2,rev:.25,dly:.3});
  });
const funk2=song({title:'Tuin do Interior',artist:'DJ Cafezal',bpm:130,beats:4,reverb:{room:.6,damp:.35,wet:.5},delay:{beats:.5,fb:.4,wet:.25}},
  {tonic:69,scale:MAJOR},
  [['intro',4,'vi vi IV V'],['A',16,'vi vi IV V vi vi IV V vi vi IV V vi vi IV V'],['B',16,'vi vi IV V vi vi IV V vi vi IV V vi vi IV V'],
   ['A',8,'vi vi IV V vi vi IV V'],['outro',2,'vi vi']],
  {B:mstyle(CELLS.plim,81,93,85)},1307,x=>{
    const{c,b}=x,full=b.sec!=='intro';
    if(x.end){c.note(k808(bass(b.ch,30),2,{glideTo:bass(b.ch,30)-5}),0,{g:.9});c.note(tuin(88,76,1.4),0,{g:.6,rev:.3,dly:.3});return;}
    for(const s of steps(4))dr(c,'chimbal',s/4,{g:s%4===2?.5:.25,pan:.25,rev:0});
    if(x.last)for(let q=0;q<8;q++)dr(c,'chimbal',3+q/8,{g:.35,pan:.25,rev:0});
    if(b.i%2===0)c.note(tuin(84+(b.i%4?3:0),91+(b.i%4?-2:0),1.6*c.spb),0,{g:.55,pan:-.15,rev:.3,dly:.35});
    if(full){
      const bs=bass(b.ch,30);
      c.note(k808(bs,1.5*c.spb,{punch:1.1}),0,{g:.95,rev:0});
      c.note(k808(bs,1.4*c.spb,{glideTo:bs+(b.i%2?7:12),punch:.6}),2.5,{g:.85,rev:0});
      c.note(k808(bs,.4*c.spb,{punch:1}),1.75,{g:.7,rev:0});
      for(const s of[0,3,6,8,11,14])dr(c,'cowbell',s/4,{g:s%8===0?.6:.45,pan:.35,rev:.05});
      dr(c,'aro',1,{g:.8});dr(c,'aro',3,{g:.8});dr(c,'clap',3,{g:.4});
    }
    if(b.sec==='B')for(const n of x.mel())c.note(bell(n.midi,.35,{ratio:2.01,index:2.2,decay:.22}),n.pos,{g:.5,pan:.25,rev:.2,dly:.3});
  });
const funk3=song({title:'Amor de Interior',artist:'MC Lua Serrana',bpm:128,beats:4,reverb:{room:.72,damp:.35,wet:.8},delay:{beats:.75,fb:.35,wet:.2}},
  {tonic:72,scale:MAJOR},
  [['intro',4,'I V vi IV'],['A',8,'I V vi IV I V vi IV'],['B',8,'IV V iii vi IV V I I'],['A',8,'I V vi IV I V vi IV'],
   ['B',8,'IV V iii vi IV V I I'],['outro',4,'IV V I I']],
  {intro:mstyle(CELLS.funk,72,86,79),A:mstyle(CELLS.funk,67,84,76),B:mstyle(CELLS.funk,72,88,81)},1409,x=>{
    const{c,b}=x,full=b.sec!=='intro';
    if(x.end){for(const m of voicing(b.ch,60,4))c.note(pad(m,3*c.spb,c.r),0,{g:.9,pan:0,rev:.4});c.note(k808(bass(b.ch,33),2),0,{g:.8});c.note(epiano(bass(b.ch,60)+12,3,.8),0,{g:.6,rev:.4});return;}
    for(const m of voicing(b.ch,60,4))c.note(pad(m,4*c.spb,c.r),0,{g:.8,pan:0,rev:.35});
    const v=voicing(b.ch,55,4);
    for(let e=0;e<8;e++)c.note(epiano(v[[0,2,1,3,2,1,3,2][e]],.6,.4),e*.5,{g:.3,pan:-.3,rev:.3});
    if(full){
      for(const s of[0,6,10])c.note(k808(bass(chordAt(b,s/4,4),33),.45,{punch:1}),s/4,{g:.8,rev:0});
      dr(c,'clap',1,{g:.65});dr(c,'clap',3,{g:.65});
      for(const s of steps(4))if(s%2)dr(c,'chimbal',s/4,{g:.4,pan:.3,rev:0});
      for(const s of[3,11])dr(c,'congaGrave',s/4,{g:.5,pan:-.2});for(const s of[7,14])dr(c,'congaAgudo',s/4,{g:.45,pan:.25});
    }
    for(const n of x.mel()){
      if(b.sec==='B')c.note(bell(n.midi,Math.max(.4,n.dur*c.spb),{ratio:1,index:1.2,decay:.6}),n.pos,{g:.55,pan:.15,rev:.35,dly:.25});
      c.note(epiano(n.midi,n.dur*c.spb,1),n.pos,{g:.7,pan:.1,rev:.32,dly:.15});
    }
  });
const funkJingle:SongDef={title:'BATIDÃO FM 98.3',artist:'',bpm:130,beats:4,bars:2,reverb:{room:.6,damp:.35,wet:.6},delay:{beats:.5,fb:.4,wet:.3},play:c=>{
  if(c.bar===0){
    c.note(tuin(79,91,1.2),0,{g:.6,rev:.3,dly:.4});
    for(let q=0;q<6;q++)dr(c,'clap',2+q/3,{g:.35+q*.08});
  }else{
    c.note(k808(33,1.6,{punch:1.4}),0,{g:1});dr(c,'clap',0,{g:.9});
    for(const m of[69,72,76])c.note(stab(m,.4,c.r),0,{g:.6,dly:.3});
    c.note(bell(93,.8,{decay:.4}),.5,{g:.5,dly:.4,rev:.3});
  }
}};

export const STATIONS_MUSIC:Record<string,StationMusic>={
  sertao:{songs:[modao1,modao2,modao3],jingle:modaoJingle},
  forro:{songs:[forro1,forro2,forro3,forro4],jingle:forroJingle},
  pagode:{songs:[pagode1,pagode2,pagode3],jingle:pagodeJingle},
  batidao:{songs:[funk1,funk2,funk3],jingle:funkJingle},
};
