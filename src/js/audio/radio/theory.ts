// Music theory for the radio's songs — PURE: keys and chords (roman numerals), voicings, song
// forms and a motif-based melody writer.
//  - A song's harmony is written per bar as roman numerals in its key ("I V7 vi IV",
//    "I/V7" = two chords in a bar; "bVII", "VI7", "ii7", "iv6", "viio"...).
//  - Melodies are written from a MOTIF: a rhythm cell of two bars and a contour, stated,
//    answered and brought home to the tonic on the phrase's last long note — so a melody
//    comes back the same each time its section does, the way a song's tune does. Strong
//    beats land on chord tones, the rest step through the scale.
//  - The second voice of a música caipira duo sings a third below (`terca`).
import {rng,type Rng} from './dsp.ts';

export const MAJOR=[0,2,4,5,7,9,11],MIXO=[0,2,4,5,7,9,10];
export interface Key{tonic:number;scale:number[]}          // tonic: MIDI note of the tonic (any octave)
export interface Chord{root:number;tones:number[]}         // root pitch class, intervals above it

const DEG:Record<string,number>={I:0,II:1,III:2,IV:3,V:4,VI:5,VII:6};
export function chord(k:Key,sym:string):Chord{
  const m=/^(b|#)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/.exec(sym);
  if(!m)throw new Error('bad chord '+sym);
  const up=m[2]===m[2].toUpperCase(),d=DEG[m[2].toUpperCase()],sfx=m[3];
  const root=((k.tonic+MAJOR[d]+(m[1]==='b'?-1:m[1]==='#'?1:0))%12+12)%12;
  let tones=up?[0,4,7]:[0,3,7];
  if(sfx==='7')tones=up?[0,4,7,10]:[0,3,7,10];
  else if(sfx==='M7')tones=[0,4,7,11];
  else if(sfx==='6')tones=up?[0,4,7,9]:[0,3,7,9];
  else if(sfx==='9')tones=[0,4,7,10,14];
  else if(sfx==='o')tones=[0,3,6,9];
  else if(sfx==='ø')tones=[0,3,6,10];
  return{root,tones};
}
const pcs=(c:Chord):number[]=>c.tones.map(t=>(c.root+t)%12);
// the chord's tones between lo and hi, ascending
export function tonesIn(c:Chord,lo:number,hi:number):number[]{
  const p=pcs(c),out:number[]=[];
  for(let m=lo;m<=hi;m++)if(p.includes(((m%12)+12)%12))out.push(m);
  return out;
}
// n chord tones stacked from the first one at or above lo (close position)
export function voicing(c:Chord,lo:number,n:number):number[]{return tonesIn(c,lo,lo+36).slice(0,n);}
// the root in [lo, lo+11]
export function bass(c:Chord,lo:number):number{let m=lo;while(((m%12)+12)%12!==c.root)m++;return m;}
// the fifth above that root (the alternating bass)
export const fifth=(c:Chord,lo:number):number=>{const b=bass(c,lo);return c.tones.includes(7)?b+7:c.tones.includes(6)?b+6:b+7;};

// ------------------------------------------------------------------ form
export interface Bar{sec:string;i:number;n:number;ch:Chord;ch2:Chord}   // i: bar within its section of n bars
export function form(k:Key,sections:[string,number,string][]):Bar[]{
  const out:Bar[]=[];
  for(const[sec,n,prog]of sections){
    const toks=prog.trim().split(/\s+/);
    for(let i=0;i<n;i++){
      const[a,b]=toks[i%toks.length].split('/');
      out.push({sec,i,n,ch:chord(k,a),ch2:chord(k,b??a)});
    }
  }
  return out;
}
export const chordAt=(b:Bar,pos:number,beats:number):Chord=>pos<beats/2-1e-6?b.ch:b.ch2;

// ------------------------------------------------------------------ melody
export interface MNote{bar:number;pos:number;dur:number;midi:number;deg:number}
export interface MelStyle{
  cells:[number,number][][];  // two-bar rhythm cells: [onset, duration] in 16ths
  lo:number;hi:number;        // range (MIDI)
  start:number;               // the first note's MIDI (snapped to the scale)
  leap?:number;               // largest contour step, in scale degrees (default 2)
}
const degMidi=(k:Key,d:number):number=>{const o=Math.floor(d/7),s=((d%7)+7)%7;return k.tonic+12*o+k.scale[s];};
function nearestDeg(k:Key,midi:number):number{
  let best=0,bd=1e9;
  for(let d=-40;d<40;d++){const e=Math.abs(degMidi(k,d)-midi);if(e<bd){bd=e;best=d;}}
  return best;
}
const inChord=(k:Key,d:number,c:Chord):boolean=>pcs(c).includes(((degMidi(k,d)%12)+12)%12);
// A melody for a section of `bars` bars: phrases of four bars (motif, its answer), the
// section's last note long, on the tonic or the chord's root.
export function melody(k:Key,bars:Bar[],beats:number,st:MelStyle,seed:number):MNote[]{
  const r:Rng=rng(seed),out:MNote[]=[],leap=st.leap??2;
  const cellA=st.cells[Math.floor(r()*st.cells.length)];
  const cellB=st.cells[Math.floor(r()*st.cells.length)];
  const contour=Array.from({length:24},()=>{const v=Math.round((r()*2-1)*leap);return v||(r()<.5?1:-1);});
  const lo=nearestDeg(k,st.lo),hi=nearestDeg(k,st.hi);
  let d=nearestDeg(k,st.start);
  const per=beats*8;                                        // 16ths in two bars
  for(let b0=0;b0<bars.length;b0+=2){
    const answer=(b0/2)%2===1,cell=answer&&r()<.5?cellB:cellA;
    const lastPair=b0+2>=bars.length;
    cell.forEach(([on,du],j)=>{
      if(on>=per)return;
      const bar=b0+Math.floor(on/(beats*4)),pos=(on%(beats*4))/4;
      if(bar>=bars.length)return;
      let step=contour[j%contour.length]*(answer?-1:1);
      if(d+step>hi||d+step<lo)step=-step;
      d+=step;
      const ch=chordAt(bars[bar],pos,beats),strong=Math.abs(pos-Math.round(pos))<1e-6&&Math.round(pos)%2===0;
      if(strong&&!inChord(k,d,ch)){d=inChord(k,d+1,ch)?d+1:inChord(k,d-1,ch)?d-1:d;}
      let dur=du/4;
      const final=lastPair&&j===cell.length-1;
      if(final){
        // home: the nearest tonic (or the root of the last chord), held to the bar's end
        let best=d,bd=1e9;
        for(let e=d-4;e<=d+4;e++){const m=degMidi(k,e);if((m-k.tonic)%12===0||((m%12)+12)%12===bars[bar].ch2.root){const dd=Math.abs(e-d);if(dd<bd){bd=dd;best=e;}}}
        d=Math.max(lo,Math.min(hi,best));
        dur=Math.max(dur,beats-pos);
      }
      out.push({bar,pos,dur,midi:degMidi(k,d),deg:d});
    });
  }
  return out;
}
// the diatonic third below (the caipira duo's second voice)
export const terca=(k:Key,n:MNote):number=>degMidi(k,n.deg-2);
export const sexta=(k:Key,n:MNote):number=>degMidi(k,n.deg-5);
