// Renders the radio's songs offline (radio/engine.ts, in Node) to WAV + MP3 to listen to them
// outside the game, and prints levels and the render speed. Not part of the game.
//   npx tsx tools/radio-preview.ts <station|all> [seconds=45] [out dir=output/radio]
import {writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {RadioStream,stationSongs} from '../src/js/audio/radio/engine.ts';

const[st='all',secS='45',out='output/radio']=process.argv.slice(2);
const SR=44100,sec=+secS;
mkdirSync(out,{recursive:true});
function wav(path:string,l:Float32Array,r:Float32Array):void{
  const n=l.length,b=Buffer.alloc(44+n*4);
  b.write('RIFF',0);b.writeUInt32LE(36+n*4,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);
  b.writeUInt32LE(SR,24);b.writeUInt32LE(SR*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);
  for(let i=0;i<n;i++){b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,l[i]))*32767),44+i*4);b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,r[i]))*32767),46+i*4);}
  writeFileSync(path,b);
}
for(const station of st==='all'?['sertao','forro','pagode','batidao']:[st]){
  stationSongs(station).forEach((song,k)=>{
    const s=new RadioStream(station,SR,7,{song:k}),L:Float32Array[]=[],R:Float32Array[]=[];
    const t0=performance.now();let got=0;
    while(got<sec*SR){const c=s.next(1);L.push(c.l);R.push(c.r);got+=c.l.length;}
    const ms=performance.now()-t0;
    const l=new Float32Array(got),r=new Float32Array(got);let o=0;
    L.forEach((a,i)=>{l.set(a,o);r.set(R[i],o);o+=a.length;});
    let pk=0,sq=0,nan=0;for(let i=0;i<got;i++){const v=l[i];if(!Number.isFinite(v))nan++;pk=Math.max(pk,Math.abs(v),Math.abs(r[i]));sq+=v*v;}
    const rms=Math.sqrt(sq/got),name=`${station}-${k+1}`;
    console.log(`${name.padEnd(10)} ${song.title.padEnd(28)} peak ${pk.toFixed(2)} rms ${(20*Math.log10(rms)).toFixed(1)} dB  render ${(ms/1000).toFixed(1)} s for ${sec} s (${(ms/10/sec).toFixed(1)} %)${nan?' NaN '+nan:''}`);
    wav(`${out}/${name}.wav`,l,r);
    try{execFileSync('ffmpeg',['-loglevel','error','-y','-i',`${out}/${name}.wav`,'-b:a','160k',`${out}/${name}.mp3`]);}catch{/* no ffmpeg: the WAV stays */}
  });
}
