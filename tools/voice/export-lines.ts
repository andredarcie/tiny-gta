// Dubbing, step 1: export every story line (scene + speaker + text + clip key) to
// tools/voice/lines.json for tools/voice/dub.mjs. Run through `npm run voice`.
import fs from 'node:fs';
import path from 'node:path';
import {SCENES} from '../../src/js/story/dialogue.ts';
import {voiceKey} from '../../src/js/story/voice-key.ts';

const seen=new Set<string>();
const lines=[];
for(const[scene,list]of Object.entries(SCENES))for(const l of list){
  if(!l.speaker)continue;
  const key=voiceKey(l.speaker,l.text);
  if(seen.has(key))continue;
  seen.add(key);
  lines.push({key,scene,speaker:l.speaker,text:l.text,phone:!!l.voice?.phone});
}
const out=path.join('tools','voice','lines.json');
fs.writeFileSync(out,JSON.stringify(lines,null,1));
console.log(`[voice] ${lines.length} lines -> ${out}`);
