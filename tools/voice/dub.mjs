// Dubbing, step 2: voice every story line through VoiceStudio's local API
// (https://github.com/debpalash/VoiceStudio — must be running; engine: VoxCPM2,
// Apache-2.0). Nothing here runs a model itself: it only calls the app.
//
//   1. DESIGN each voice of voices.json once, from its description → refs/<id>.wav
//      (kept in git: it IS the character's voice).
//   2. CLONE that reference for each line in lines.json → the same voice in every line.
//   3. CHECK each clip by transcribing it (VoiceStudio ASR) against the script; a clip that
//      doesn't say the line is re-generated with another seed.
//   4. Write src/assets/audio/voice/<key>.mp3 (mono, loudness-normalised, via ffmpeg).
//
// Options: --redo <speaker>   re-dub that speaker's lines
//          --recast <speaker> re-design that voice, then re-dub its lines
//          --only <speaker>   dub only that speaker
//          --demo             one sample per voice in tools/voice/demo/, then stop
import fs from 'node:fs';
import path from 'node:path';
import { TOOL, loadVoices, speakable, health, design, refOf, voiceAll, report } from './studio.mjs';

const DEMO = path.join(TOOL, 'demo');
const OUT = path.join('src', 'assets', 'audio', 'voice');
const DEMO_TEXT = {
  woman: 'Oi! Tudo bem? Você é novo por aqui, né? Cuidado com o chefão, ele não brinca em serviço.',
  child: 'Moço, moço! Eu vi tudo! Os caipiras saíram do chão, igual zumbi de filme!',
};

const args = process.argv.slice(2);
const opt = (name) => args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
const redo = new Set([...opt('--redo'), ...opt('--recast')]);
const recast = new Set(opt('--recast'));
const only = new Set(opt('--only'));
const demo = args.includes('--demo');

const voices = loadVoices();
const lines = JSON.parse(fs.readFileSync(path.join(TOOL, 'lines.json'), 'utf8'));
for (const l of lines) if (!voices[l.speaker]) throw new Error(`speaker '${l.speaker}' is not in voices.json`);
await health();

// stale clips (their line changed or is gone)
const keys = new Set(lines.filter((l) => speakable(l.text)).map((l) => l.key));
if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) if (f.endsWith('.mp3') && !keys.has(f.slice(0, -4))) {
  console.log(`[voice] removing stale clip ${f}`); fs.rmSync(path.join(OUT, f));
}
const scenes = new Set(opt('--scene'));
const todo = lines.filter((l) => speakable(l.text) && (!only.size || only.has(l.speaker)) && (!scenes.size || scenes.has(l.scene))
  && (redo.has(l.speaker) || !fs.existsSync(path.join(OUT, `${l.key}.mp3`))));

// 1) design the voices that have no reference yet (or are being recast)
const needed = demo ? Object.keys(voices) : [...new Set(todo.map((l) => l.speaker))];
for (const id of needed) await design(id, voices[id], recast.has(id));

const ref = (id) => refOf(id, voices[id]);
if (demo) fs.mkdirSync(DEMO, { recursive: true });

// 2) the demo, or the lines
const items = demo
  ? Object.keys(voices).map((id) => ({ speaker: id, dest: path.join(DEMO, `${id}.mp3`),
    text: DEMO_TEXT[id] ?? lines.find((l) => l.speaker === id && speakable(l.text))?.text ?? voices[id].ref_text }))
  : todo.map((l) => ({ speaker: l.speaker, text: l.text, dest: path.join(OUT, `${l.key}.mp3`) }));
if (!items.length) { console.log('[voice] every line already has a clip'); process.exit(0); }
const t0 = Date.now();
const best = await voiceAll(items, ref);
const weak = report(items, best);
console.log(`[voice] done: ${items.length} clip(s) in ${((Date.now() - t0) / 60000).toFixed(1)} min${weak ? ` — ${weak} below 85% word match (listen to those)` : ''}`);
