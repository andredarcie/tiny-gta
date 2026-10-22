// Narration for a short video: voice the lines of test/video/scenes/<scene>.vo.json
// through VoiceStudio (see studio.mjs) into output/voice/<scene>/<id>.mp3, in one voice of
// voices.json (designed once into refs/<voice>.wav, like the story's cast). The video
// director (test/video/director.ts) plays a clip's line under it and the editor
// (test/video/make-video.mjs) mixes it over the game's sound.
//
//   node tools/voice/narrate.mjs <scene> [--redo]
// Lines already voiced with the same text are kept (manifest.json), unless --redo.
import fs from 'node:fs';
import path from 'node:path';
import { loadVoices, health, design, refOf, voiceAll, report } from './studio.mjs';

const scene = process.argv[2];
if (!scene) { console.error('usage: node tools/voice/narrate.mjs <scene> [--redo]'); process.exit(1); }
const redo = process.argv.includes('--redo');
const vo = JSON.parse(fs.readFileSync(path.join('test/video/scenes', `${scene}.vo.json`), 'utf8'));
const voices = loadVoices();
const voice = voices[vo.voice];
if (!voice) throw new Error(`voice '${vo.voice}' is not in voices.json`);
const tempo = vo.tempo ?? 1;
const OUT = path.join('output/voice', scene);
const MANIFEST = path.join(OUT, 'manifest.json');
const done = !redo && fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
const sig = (text) => `${vo.voice}|${tempo}|${text}`;

const items = Object.entries(vo.lines)
  .filter(([id, text]) => done[id] !== sig(text) || !fs.existsSync(path.join(OUT, `${id}.mp3`)))
  .map(([id, text]) => ({ id, speaker: vo.voice, text, dest: path.join(OUT, `${id}.mp3`) }));
if (!items.length) { console.log(`[voice] ${scene}: every narration line is voiced`); process.exit(0); }

await health();
await design(vo.voice, voice);
const t0 = Date.now();
const best = await voiceAll(items, () => refOf(vo.voice, voice), tempo);
const weak = report(items, best);
for (const it of items) done[it.id] = sig(it.text);
fs.writeFileSync(MANIFEST, JSON.stringify(done, null, 1));
console.log(`[voice] ${scene}: ${items.length} line(s) in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${OUT}${weak ? ` — ${weak} below 85% word match (listen to those)` : ''}`);
