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
import { spawnSync } from 'node:child_process';

const API = process.env.VOICESTUDIO_URL || 'http://localhost:3900';
const ENGINE = 'voxcpm2';
const LANG = 'pt';
const SEED = 20260930;
const TOOL = path.join('tools', 'voice');
const REFS = path.join(TOOL, 'refs');
const TMP = path.join(TOOL, 'tmp');
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

const voices = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(TOOL, 'voices.json'), 'utf8'))).filter(([k]) => !k.startsWith('_')));
const lines = JSON.parse(fs.readFileSync(path.join(TOOL, 'lines.json'), 'utf8'));
for (const l of lines) if (!voices[l.speaker]) throw new Error(`speaker '${l.speaker}' is not in voices.json`);
const speakable = (t) => /[\p{L}\p{N}]/u.test(t);

// ---- VoiceStudio API ----
async function health() {
  try {
    const r = await fetch(`${API}/health`);
    const h = await r.json();
    if (h.status !== 'ok') throw new Error(JSON.stringify(h));
    console.log(`[voice] VoiceStudio ${h.version} on ${h.device}`);
  } catch (e) {
    console.error(`[voice] VoiceStudio is not answering at ${API} — start the app first (tools/voice/README.md). ${e.message ?? ''}`);
    process.exit(1);
  }
}
/** POST /generate → WAV bytes. `ref` = {wav, text} clones a voice; `instruct` designs one. */
async function generate({ text, instruct, ref, seed = SEED }) {
  const f = new FormData();
  f.set('engine', ENGINE); f.set('language', LANG); f.set('seed', String(seed)); f.set('text', text);
  if (instruct) f.set('instruct', instruct);
  if (ref) { f.set('ref_audio', new Blob([fs.readFileSync(ref.wav)], { type: 'audio/wav' }), path.basename(ref.wav)); f.set('ref_text', ref.text); }
  const r = await fetch(`${API}/generate`, { method: 'POST', body: f });
  if (!r.ok) throw new Error(`generate ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}
async function transcribe(wav) {
  const f = new FormData();
  f.set('file', new Blob([wav], { type: 'audio/wav' }), 'clip.wav'); f.set('language', LANG);
  const r = await fetch(`${API}/v1/audio/transcriptions`, { method: 'POST', body: f });
  return r.ok ? (await r.json()).text ?? '' : '';
}

// word-level similarity (0..1) between what was written and what was heard
const words = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
function match(want, heard) {
  const a = words(want), b = words(heard);
  if (!a.length) return 1;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return (2 * dp[a.length][b.length]) / (a.length + b.length);
}

function toMp3(wav, dest) {
  fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(path.dirname(dest), { recursive: true });
  const raw = path.join(TMP, path.basename(dest, '.mp3') + '.wav');
  fs.writeFileSync(raw, wav);
  const af = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,'
    + 'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,'
    + 'loudnorm=I=-16:TP=-1.5:LRA=11';
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-af', af, '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '64k', dest]);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
  fs.rmSync(raw);
}

// Voice a batch of lines in ROUNDS: generate every pending clip first, THEN transcribe
// them all (loading the speech recogniser next to the TTS engine on a small GPU makes
// VoiceStudio evict the engine mid-generation), and give the clips that don't say their
// line another seed in the next round. Keeps the best take of each line.
async function voiceAll(items) {           // items: {text, speaker, dest}
  const best = new Map();
  let pending = items;
  for (let round = 0; round < 3 && pending.length; round++) {
    const takes = [];
    for (const it of pending) {
      const t0 = Date.now();
      const wav = await generate({ text: it.text, ref: ref(it.speaker), seed: SEED + round * 7919 });
      takes.push({ it, wav });
      console.log(`[voice] r${round + 1} generated ${takes.length}/${pending.length} ${it.speaker.padEnd(7)} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${it.text.slice(0, 50)}`);
    }
    for (const { it, wav } of takes) {
      const heard = await transcribe(wav);
      const m = match(it.text, heard);
      const prev = best.get(it);
      if (!prev || m > prev.m) best.set(it, { wav, m, heard });
    }
    pending = pending.filter((it) => best.get(it).m < .85);
    if (pending.length) console.log(`[voice] ${pending.length} clip(s) below 85% word match — another take`);
  }
  for (const it of items) toMp3(best.get(it).wav, it.dest);
  return best;
}

await health();
fs.mkdirSync(REFS, { recursive: true });

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
for (const id of needed) {
  const file = path.join(REFS, `${id}.wav`);
  if (fs.existsSync(file) && !recast.has(id)) continue;
  const t0 = Date.now();
  fs.writeFileSync(file, await generate({ text: voices[id].ref_text, instruct: voices[id].design }));
  console.log(`[voice] designed ${id} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

const ref = (id) => ({ wav: path.join(REFS, `${id}.wav`), text: voices[id].ref_text });
if (demo) fs.mkdirSync(DEMO, { recursive: true });

// 2) the demo, or the lines
const items = demo
  ? Object.keys(voices).map((id) => ({ speaker: id, dest: path.join(DEMO, `${id}.mp3`),
    text: DEMO_TEXT[id] ?? lines.find((l) => l.speaker === id && speakable(l.text))?.text ?? voices[id].ref_text }))
  : todo.map((l) => ({ speaker: l.speaker, text: l.text, dest: path.join(OUT, `${l.key}.mp3`) }));
if (!items.length) { console.log('[voice] every line already has a clip'); process.exit(0); }
const t0 = Date.now();
const best = await voiceAll(items);
let weak = 0;
for (const it of items) {
  const b = best.get(it);
  if (b.m < .85) weak++;
  console.log(`[voice] ${it.speaker.padEnd(7)} ${(b.m * 100).toFixed(0).padStart(3)}% ${it.text.slice(0, 60)}${b.m < .85 ? `\n        heard: ${b.heard}` : ''}`);
}
console.log(`[voice] done: ${items.length} clip(s) in ${((Date.now() - t0) / 60000).toFixed(1)} min${weak ? ` — ${weak} below 85% word match (listen to those)` : ''}`);
