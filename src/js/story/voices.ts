import {AC,master} from '@/audio/audio.ts';

// ============================================================================
// DUBBED VOICES — recorded (AI-generated, offline) voice clips for the story's lines.
// The clips are made by `npm run voice` (tools/voice/, the VoiceStudio app running locally) and
// bundled with the game like any asset, so the game stays 100% offline. A clip's file
// name is voiceKey(speaker, text): editing a line changes its key, so the tool knows to
// re-dub it and the game never plays a clip that no longer matches its subtitle.
// ============================================================================

import {voiceKey} from '@/story/voice-key.ts';
export {voiceKey};

// every bundled clip, by key (Vite turns each into a hashed asset URL)
const files=import.meta.glob('../../assets/audio/voice/*.mp3',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const urls=new Map<string,string>();
for(const[p,u]of Object.entries(files))urls.set(p.slice(p.lastIndexOf('/')+1,-4),u);

export const hasVoice=(speaker: string|undefined,text: string)=>!!speaker&&urls.has(voiceKey(speaker,text));

const buffers=new Map<string,Promise<AudioBuffer|null>>();
function load(key: string): Promise<AudioBuffer|null>{
  let p=buffers.get(key);
  if(!p){
    const url=urls.get(key);
    p=!url||!AC?Promise.resolve(null):fetch(url).then(r=>r.arrayBuffer()).then(a=>AC!.decodeAudioData(a)).catch(()=>null);
    buffers.set(key,p);
  }
  return p;
}
/** Start decoding the clips of an upcoming scene so each line starts on time. */
export function preloadVoices(lines: {speaker?: string;text: string}[]): void{
  for(const l of lines)if(l.speaker)void load(voiceKey(l.speaker,l.text));
}

let playing: AudioBufferSourceNode|null=null;
let token=0;
/** Play a line's clip. `phone` squeezes it through a telephone band. Resolves with the
 *  clip's length in seconds once it starts, or null when there is no clip. */
export async function playVoice(speaker: string,text: string,opts: {phone?: boolean}={}): Promise<number|null>{
  stopVoice();
  const my=++token;
  const buf=await load(voiceKey(speaker,text));
  if(!buf||!AC||!master||my!==token)return null;
  const src=AC.createBufferSource();src.buffer=buf;
  const g=AC.createGain();g.gain.value=opts.phone?1.5:1.15;
  if(opts.phone){
    // the voice down a pay-phone line: band-limited 300-3400 Hz and lightly overdriven
    const hp=AC.createBiquadFilter();hp.type='highpass';hp.frequency.value=320;
    const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3300;
    const mid=AC.createBiquadFilter();mid.type='peaking';mid.frequency.value=1500;mid.gain.value=5;mid.Q.value=.8;
    const drive=AC.createWaveShaper();
    const curve=new Float32Array(256);for(let i=0;i<256;i++){const x=i/127.5-1;curve[i]=Math.tanh(1.8*x)/Math.tanh(1.8);}
    drive.curve=curve;
    src.connect(hp).connect(lp).connect(mid).connect(drive).connect(g);
  }else src.connect(g);
  g.connect(master);
  src.start();
  playing=src;
  src.onended=()=>{if(playing===src)playing=null;};
  return buf.duration;
}
export function stopVoice(): void{
  token++;
  if(playing){try{playing.stop();}catch{/* already stopped */}playing=null;}
}
