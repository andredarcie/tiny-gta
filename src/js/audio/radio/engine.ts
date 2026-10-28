// The radio's streaming renderer — PURE (no Web Audio, no DOM): turns a station's songs
// (radio/songs.ts) into stereo audio, a bar at a time. Each bar's notes are synthesised
// (radio/dsp.ts) and mixed into sample blocks at their absolute positions (pan, a reverb send
// and a delay send per note); once every note that can start before a point has been laid,
// the audio up to it is final and goes through the station's effects — a Freeverb room and a
// ping-pong delay — and the master bus (low cut, a gentle compressor, a soft clipper and the
// FM-broadcast top end), then out. A station is an endless programme: its vinheta, a song
// (never the same twice running), a short gap, the vinheta again... Runs in the radio's Web
// Worker in the game (radio/worker.ts) and in Node in the tests and the preview tool.
import {setRate,rng,type Rng} from './dsp.ts';
import {STATIONS_MUSIC,type SongDef,type BarCtx,type NoteOpts} from './songs.ts';

const BLOCK=8192;
interface Block{l:Float32Array;r:Float32Array;rv:Float32Array;dl:Float32Array}

class Mixer{
  private blocks=new Map<number,Block>();
  private block(k:number):Block{
    let b=this.blocks.get(k);
    if(!b){b={l:new Float32Array(BLOCK),r:new Float32Array(BLOCK),rv:new Float32Array(BLOCK),dl:new Float32Array(BLOCK)};this.blocks.set(k,b);}
    return b;
  }
  add(x:Float32Array,at:number,g:number,pan:number,rev:number,dly:number):void{
    const a=(pan+1)*Math.PI/4,gl=Math.cos(a)*g*1.414,gr=Math.sin(a)*g*1.414;
    let i=0;
    while(i<x.length){
      const p=at+i,k=Math.floor(p/BLOCK),o=p-k*BLOCK,b=this.block(k),m=Math.min(BLOCK-o,x.length-i);
      for(let j=0;j<m;j++){const v=x[i+j];b.l[o+j]+=v*gl;b.r[o+j]+=v*gr;if(rev)b.rv[o+j]+=v*g*rev;if(dly)b.dl[o+j]+=v*g*dly;}
      i+=m;
    }
  }
  // the samples [from, to) — final — leaving the blocks before `to` behind
  take(from:number,to:number):Block{
    const n=to-from,out:Block={l:new Float32Array(n),r:new Float32Array(n),rv:new Float32Array(n),dl:new Float32Array(n)};
    for(let p=from;p<to;){
      const k=Math.floor(p/BLOCK),o=p-k*BLOCK,m=Math.min(BLOCK-o,to-p),b=this.blocks.get(k);
      if(b){out.l.set(b.l.subarray(o,o+m),p-from);out.r.set(b.r.subarray(o,o+m),p-from);out.rv.set(b.rv.subarray(o,o+m),p-from);out.dl.set(b.dl.subarray(o,o+m),p-from);}
      p+=m;
    }
    for(const k of[...this.blocks.keys()])if((k+1)*BLOCK<=to)this.blocks.delete(k);
    return out;
  }
}

// Freeverb (Jezar): 8 lowpass-feedback combs and 4 allpasses per channel, the right one
// spread a few samples
class Freeverb{
  private combs:{buf:Float32Array;i:number;st:number}[][]=[[],[]];
  private aps:{buf:Float32Array;i:number}[][]=[[],[]];
  constructor(sr:number,public room=.78,public damp=.35){
    const k=sr/44100;
    [0,23].forEach((sp,ch)=>{
      for(const c of[1116,1188,1277,1356,1422,1491,1557,1617])this.combs[ch].push({buf:new Float32Array(Math.round((c+sp)*k)),i:0,st:0});
      for(const a of[556,441,341,225])this.aps[ch].push({buf:new Float32Array(Math.round((a+sp)*k)),i:0});
    });
  }
  process(inp:Float32Array,outL:Float32Array,outR:Float32Array,wet:number):void{
    const fb=this.room,d=this.damp;
    for(let ch=0;ch<2;ch++){
      const out=ch?outR:outL,cs=this.combs[ch],as=this.aps[ch];
      for(let n=0;n<inp.length;n++){
        const x=inp[n]*.015;let y=0;
        for(const c of cs){const v=c.buf[c.i];c.st=v*(1-d)+c.st*d;c.buf[c.i]=x+c.st*fb;if(++c.i>=c.buf.length)c.i=0;y+=v;}
        for(const a of as){const v=a.buf[a.i];const o=-y+v;a.buf[a.i]=y+v*.5;if(++a.i>=a.buf.length)a.i=0;y=o;}
        out[n]+=y*wet;
      }
    }
  }
}
// ping-pong delay with a darkened feedback
class PingPong{
  private bl:Float32Array;private br:Float32Array;private i=0;private lpL=0;private lpR=0;
  constructor(sr:number){this.bl=new Float32Array(Math.ceil(sr*1.5));this.br=new Float32Array(Math.ceil(sr*1.5));}
  process(inp:Float32Array,outL:Float32Array,outR:Float32Array,samples:number,fb:number,wet:number):void{
    const N=this.bl.length,dly=Math.max(1,Math.min(N-1,Math.round(samples)));
    for(let n=0;n<inp.length;n++){
      const j=(this.i-dly+N)%N,dl=this.bl[j],dr=this.br[j];
      this.lpL+=(dl-this.lpL)*.35;this.lpR+=(dr-this.lpR)*.35;
      this.bl[this.i]=inp[n]+this.lpR*fb;this.br[this.i]=this.lpL*fb;
      outL[n]+=dl*wet;outR[n]+=dr*wet;
      if(++this.i>=N)this.i=0;
    }
  }
}
// streaming biquad (the master's filters keep their state across chunks)
class SBQ{
  private x1=0;private x2=0;private y1=0;private y2=0;private c:number[];
  constructor(sr:number,type:'hp'|'lp',f:number,q=.707){
    const w=2*Math.PI*Math.min(f,sr*.45)/sr,cs=Math.cos(w),al=Math.sin(w)/(2*q);   // (never past Nyquist)
    const b=type==='lp'?[(1-cs)/2,1-cs,(1-cs)/2]:[(1+cs)/2,-(1+cs),(1+cs)/2],a0=1+al;
    this.c=[b[0]/a0,b[1]/a0,b[2]/a0,-2*cs/a0,(1-al)/a0];
  }
  run(x:Float32Array):void{
    const[b0,b1,b2,a1,a2]=this.c;
    for(let i=0;i<x.length;i++){const v=x[i],y=b0*v+b1*this.x1+b2*this.x2-a1*this.y1-a2*this.y2;this.x2=this.x1;this.x1=v;this.y2=this.y1;this.y1=y;x[i]=y;}
  }
}

export const stationSongs=(station:string):SongDef[]=>STATIONS_MUSIC[station]?.songs??[];
export interface Chunk{l:Float32Array;r:Float32Array;events:{at:number;title:string;artist:string;jingle:boolean}[]}
interface Item{song:SongDef;jingle:boolean}

export class RadioStream{
  private mix=new Mixer();
  private rev:Freeverb;private dly:PingPong;
  private hp:SBQ[];private lp:SBQ[];
  private env=0;private r:Rng;
  private item!:Item;private bar=0;private barAt=0;   // current item, its next bar, where that bar starts (samples)
  private emitted=0;private last=-1;private events:Chunk['events']=[];
  private fadeIn:number;
  private songs:SongDef[];private jingle:SongDef;
  // opts.song: start at the top of that song (the preview tool, the tests); else tune in mid-song
  constructor(station:string,private sr:number,seed=Date.now(),opts:{song?:number}={}){
    setRate(sr);
    this.r=rng(seed);
    const st=STATIONS_MUSIC[station];
    if(!st)throw new Error('unknown station '+station);
    this.songs=st.songs;this.jingle=st.jingle;
    this.rev=new Freeverb(sr);this.dly=new PingPong(sr);
    this.hp=[new SBQ(sr,'hp',32),new SBQ(sr,'hp',32)];this.lp=[new SBQ(sr,'lp',15000,.6),new SBQ(sr,'lp',15000,.6)];
    // tune in somewhere inside a song, at a phrase (as a real radio)
    const k=opts.song??Math.floor(this.r()*this.songs.length);this.last=k;
    this.start({song:this.songs[k],jingle:false},opts.song!==undefined?0:4*Math.floor(this.r()*Math.max(1,(this.songs[k].bars-8)/4)));
    this.fadeIn=opts.song!==undefined?0:Math.round(sr*.6);
  }
  private start(it:Item,bar=0):void{
    this.item=it;this.bar=bar;
    this.rev.room=it.song.reverb.room;this.rev.damp=it.song.reverb.damp;
    this.events.push({at:this.barAt,title:it.song.title,artist:it.song.artist,jingle:it.jingle});
  }
  private nextItem():void{
    const gap=Math.round(this.sr*(this.item.jingle?.15:.9));
    this.barAt+=gap;
    if(!this.item.jingle){this.start({song:this.jingle,jingle:true});return;}
    let k=Math.floor(this.r()*this.songs.length);
    if(this.songs.length>1&&k===this.last)k=(k+1)%this.songs.length;
    this.last=k;this.start({song:this.songs[k],jingle:false});
  }
  // lay one bar's notes
  private renderBar():void{
    const s=this.item.song,spb=60/s.bpm,barLen=Math.round(s.beats*spb*this.sr);
    const barAt=this.barAt,sr=this.sr,r=this.r,mix=this.mix,emitted=this.emitted;
    const swing=s.swing??0;
    const ctx:BarCtx={
      bar:this.bar,bars:s.bars,beats:s.beats,spb,r,
      note:(x:Float32Array,pos:number,o:NoteOpts={})=>{
        // swing: the off 16ths (odd steps) a little late; a little human timing
        const q=pos*4,odd=Math.abs(q-Math.round(q))<1e-6&&Math.round(q)%2===1;
        const jit=(o.jit??.004)*(r()*2-1);
        let at=barAt+Math.round(((pos+(odd?swing*.25:0))*spb+jit+(o.late??0))*sr);
        if(at<emitted)at=emitted;
        mix.add(x,at,o.g??1,o.pan??0,o.rev??.15,o.dly??0);
      },
    };
    s.play(ctx);
    this.barAt+=barLen;this.bar++;
    if(this.bar>=s.bars)this.nextItem();
  }
  // render until at least `sec` seconds of new audio are final; returns it
  next(sec:number):Chunk{
    const want=this.emitted+Math.round(sec*this.sr);
    let to=this.emitted;
    while(to<want){this.renderBar();to=Math.max(this.emitted,this.barAt-Math.round(this.sr*.02));}
    const from=this.emitted,b=this.mix.take(from,to),s=this.item.song;
    const L=b.l,R=b.r;
    this.rev.process(b.rv,L,R,s.reverb.wet);
    if(s.delay)this.dly.process(b.dl,L,R,s.delay.beats*60/s.bpm*this.sr,s.delay.fb,s.delay.wet);
    this.hp[0].run(L);this.hp[1].run(R);this.lp[0].run(L);this.lp[1].run(R);
    // master: a stereo-linked compressor (fast attack, slow release), then a soft clip
    const att=Math.exp(-1/(.004*this.sr)),rel=Math.exp(-1/(.18*this.sr)),thr=.32;
    for(let i=0;i<L.length;i++){
      const pk=Math.max(Math.abs(L[i]),Math.abs(R[i]));
      this.env=pk>this.env?att*this.env+(1-att)*pk:rel*this.env+(1-rel)*pk;
      const gr=this.env>thr?Math.pow(thr/this.env,.6):1,g=gr*1.35;
      let f=1;if(this.fadeIn>0){f=1-this.fadeIn/(this.sr*.6);this.fadeIn--;}
      L[i]=Math.tanh(L[i]*g)*.92*f;R[i]=Math.tanh(R[i]*g)*.92*f;
    }
    const events=this.events.filter(e=>e.at<to).map(e=>({...e,at:Math.max(0,e.at-from)}));
    this.events=this.events.filter(e=>e.at>=to);
    this.emitted=to;
    return{l:L,r:R,events};
  }
}
