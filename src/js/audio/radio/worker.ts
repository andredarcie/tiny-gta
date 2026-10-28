// The radio's Web Worker: renders the tuned station (radio/engine.ts) off the game's main
// thread and posts the audio back in chunks (ui/radio.ts plays them).
//   in:  {type:'start',gen,station,rate,seed} | {type:'more',gen,sec} | {type:'stop'}
//   out: {type:'chunk',gen,l,r,events}   (l, r transferred)
import {RadioStream} from './engine.ts';

let stream:RadioStream|null=null,gen=0;
const post=(self as unknown as {postMessage:(m:unknown,t?:Transferable[])=>void}).postMessage.bind(self);
self.onmessage=(e:MessageEvent):void=>{
  const m=e.data as {type:string;gen?:number;station?:string;rate?:number;seed?:number;sec?:number};
  if(m.type==='start'){gen=m.gen!;stream=new RadioStream(m.station!,m.rate!,m.seed);}
  else if(m.type==='more'&&stream&&m.gen===gen){
    const c=stream.next(m.sec??2);
    post({type:'chunk',gen,l:c.l,r:c.r,events:c.events},[c.l.buffer,c.r.buffer]);
  }else if(m.type==='stop')stream=null;
};
