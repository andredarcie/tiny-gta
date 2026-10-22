// VoiceStudio's local API (https://github.com/debpalash/VoiceStudio — must be running;
// engine: VoxCPM2, Apache-2.0), shared by the story dubbing (dub.mjs) and the video
// narration (narrate.mjs). Nothing here runs a model itself: it only calls the app.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const API = process.env.VOICESTUDIO_URL || 'http://localhost:3900';
const ENGINE = 'voxcpm2';
const LANG = 'pt';
export const SEED = 20260930;
export const TOOL = path.join('tools', 'voice');
export const REFS = path.join(TOOL, 'refs');
const TMP = path.join(TOOL, 'tmp');

/** The cast of voices.json (without the _comment keys). */
export const loadVoices = () => Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(TOOL, 'voices.json'), 'utf8')))
  .filter(([k]) => !k.startsWith('_')));
export const speakable = (t) => /[\p{L}\p{N}]/u.test(t);

export async function health() {
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
export async function generate({ text, instruct, ref, seed = SEED }) {
  const f = new FormData();
  f.set('engine', ENGINE); f.set('language', LANG); f.set('seed', String(seed)); f.set('text', text);
  if (instruct) f.set('instruct', instruct);
  if (ref) { f.set('ref_audio', new Blob([fs.readFileSync(ref.wav)], { type: 'audio/wav' }), path.basename(ref.wav)); f.set('ref_text', ref.text); }
  const r = await fetch(`${API}/generate`, { method: 'POST', body: f });
  if (!r.ok) throw new Error(`generate ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}
export async function transcribe(wav) {
  const f = new FormData();
  f.set('file', new Blob([wav], { type: 'audio/wav' }), 'clip.wav'); f.set('language', LANG);
  const r = await fetch(`${API}/v1/audio/transcriptions`, { method: 'POST', body: f });
  return r.ok ? (await r.json()).text ?? '' : '';
}

// word-level similarity (0..1) between what was written and what was heard
const words = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
export function match(want, heard) {
  const a = words(want), b = words(heard);
  if (!a.length) return 1;
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return (2 * dp[a.length][b.length]) / (a.length + b.length);
}

/** WAV → trimmed, loudness-normalised mono MP3. `tempo` speeds it up (atempo). */
export function toMp3(wav, dest, tempo = 1) {
  fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(path.dirname(dest), { recursive: true });
  const raw = path.join(TMP, path.basename(dest, '.mp3') + '.wav');
  fs.writeFileSync(raw, wav);
  const af = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,'
    + 'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse,'
    + (tempo !== 1 ? `atempo=${tempo},` : '') + 'loudnorm=I=-16:TP=-1.5:LRA=11';
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-af', af, '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '64k', dest]);
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
  fs.rmSync(raw);
}

/** Design a voice from its voices.json description into refs/<id>.wav (once, unless `force`). */
export async function design(id, voice, force = false) {
  fs.mkdirSync(REFS, { recursive: true });
  const file = path.join(REFS, `${id}.wav`);
  if (fs.existsSync(file) && !force) return;
  const t0 = Date.now();
  fs.writeFileSync(file, await generate({ text: voice.ref_text, instruct: voice.design }));
  console.log(`[voice] designed ${id} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
export const refOf = (id, voice) => ({ wav: path.join(REFS, `${id}.wav`), text: voice.ref_text });

// Voice a batch of lines in ROUNDS: generate every pending clip first, THEN transcribe
// them all (loading the speech recogniser next to the TTS engine on a small GPU makes
// VoiceStudio evict the engine mid-generation), and give the clips that don't say their
// line another seed in the next round. Keeps the best take of each line.
// items: {text, speaker, dest}; ref(speaker) → {wav, text}.
export async function voiceAll(items, ref, tempo = 1) {
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
  for (const it of items) toMp3(best.get(it).wav, it.dest, tempo);
  return best;
}
/** Print each line's word match; returns how many are below 85%. */
export function report(items, best) {
  let weak = 0;
  for (const it of items) {
    const b = best.get(it);
    if (b.m < .85) weak++;
    console.log(`[voice] ${it.speaker.padEnd(7)} ${(b.m * 100).toFixed(0).padStart(3)}% ${it.text.slice(0, 60)}${b.m < .85 ? `\n        heard: ${b.heard}` : ''}`);
  }
  return weak;
}
