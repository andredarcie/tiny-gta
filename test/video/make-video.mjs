// Build a VERTICAL short video (TikTok / Reels / WhatsApp) from a scene capture:
//   node test/video/make-video.mjs <scene>
// Input : output/video/<scene>/capture.json + frames/ (written by test/video/director.ts)
// Output: output/video/<scene>/<scene>.mp4  — 720x1280 (9:16), 30 fps, H.264 + AAC with
//         the game's own sound (SFX + music, loudness-normalised for social apps),
//         ~1-4 MB for 15-30 s (small enough for WhatsApp, sharp on a phone)
//         output/video/<scene>/cover.jpg   — the cover (also the video's first frame)
// Structure: COVER (1.2 s: a punchy frame + big title, no fade — so thumbnails are never
// black) → the kept clips with hard cuts, each with a bold caption → END card (1.3 s).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const scene = process.argv[2];
if (!scene) { console.error('usage: node test/video/make-video.mjs <scene>'); process.exit(1); }
const DIR = path.join('output/video', scene);
const cap = JSON.parse(fs.readFileSync(path.join(DIR, 'capture.json'), 'utf8'));
const W = 720, H = 1280, FPS = 30;
const FONT = fs.existsSync('C:/Windows/Fonts/impact.ttf') ? 'C\\:/Windows/Fonts/impact.ttf'
  : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-profile:v', 'high', '-level', '4.0',
  '-maxrate', '2500k', '-bufsize', '5000k', '-pix_fmt', 'yuv420p', '-r', String(FPS)];
const TMP = path.join(DIR, 'tmp'); fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP);
const AAC = ['-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2'];

// ---- sound: the whole shoot's master mix, sliced per segment by wall-clock time ----
const hasAudio = cap.audioStart != null && fs.existsSync(path.join(DIR, 'audio.webm'));
const WAV = path.join(TMP, 'audio.wav');
if (hasAudio) ff(['-i', path.join(DIR, 'audio.webm'), '-ar', '48000', '-ac', '2', WAV]);
// Audio input args for a segment starting at wall time `t` (s) lasting `len` s, with short
// fades so hard cuts never click; silence where the recording has nothing.
function audioIn(t, len, fadeIn = .03, fadeOut = .03) {
  if (!hasAudio) return { args: ['-f', 'lavfi', '-t', len.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'], filter: 'anull' };
  const off = t - cap.audioStart;
  const pre = Math.max(0, -off);                                  // before the recording began
  return {
    args: ['-ss', Math.max(0, off).toFixed(3), '-t', (len - pre).toFixed(3), '-i', WAV],
    filter: `adelay=${Math.round(pre * 1000)}|${Math.round(pre * 1000)},apad,atrim=0:${len.toFixed(3)},`
      + `afade=t=in:st=0:d=${fadeIn},afade=t=out:st=${Math.max(0, len - fadeOut).toFixed(3)}:d=${fadeOut}`,
  };
}

function ff(args) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' '));
}
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\u2019").replace(/:/g, '\\:').replace(/,/g, '\\,').replace(/%/g, '\\%');
// word-wrap a caption to ~16 chars per line (big text on a narrow screen)
function wrap(s, max = 16) {
  const out = []; let line = '';
  for (const w of String(s).split(/\s+/)) {
    if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}
// centred multi-line bold text with a thick outline (TikTok style)
function textLines(lines, y0, size, color, extra = '') {
  return lines.map((l, i) => `drawtext=fontfile='${FONT}':text='${esc(l)}':x=(w-text_w)/2:y=${Math.round(y0 + i * size * 1.12)}:`
    + `fontsize=${size}:fontcolor=${color}:borderw=${Math.round(size / 11)}:bordercolor=0x000000${extra}`);
}
const scaleCrop = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;

// ---- 1) each kept clip -> its own segment (real frame timing, caption burned in) ----
const segs = [];
cap.clips.forEach((c, i) => {
  const fr = cap.frames.filter((f) => f.t >= c.start - .02 && f.t <= c.end + .02);
  if (fr.length < 2) return;
  let list = '', len = 0;
  fr.forEach((f, k) => {
    const d = k + 1 < fr.length ? Math.min(.2, Math.max(.005, fr[k + 1].t - f.t)) : 1 / FPS;
    list += `file '../frames/${f.file}'\nduration ${d.toFixed(4)}\n`;
    len += d;
  });
  list += `file '../frames/${fr[fr.length - 1].file}'\n`;
  const listFile = path.join(TMP, `c${i}.txt`); fs.writeFileSync(listFile, list);
  const vf = [scaleCrop, `fps=${FPS}`];
  if (c.caption) {
    const lines = wrap(c.caption.toUpperCase());
    // pops in over the first 0.15 s, stays up for the whole clip
    vf.push(...textLines(lines, H * .13, 66, '0xFFFFFF', `:alpha='min(1\\,t/0.15)'`));
  }
  vf.push('format=yuv420p');
  const filt = path.join(TMP, `c${i}.filter`); fs.writeFileSync(filt, vf.join(',\n'));
  const out = path.join(TMP, `c${i}.mp4`);
  const a = audioIn(fr[0].t, len);
  ff(['-f', 'concat', '-safe', '0', '-i', listFile, ...a.args, '-filter_script:v', filt, '-af', a.filter,
    '-map', '0:v', '-map', '1:a', ...X264, ...AAC, '-t', len.toFixed(3), out]);
  segs.push(out);
});
if (!segs.length) throw new Error('no clips with frames — nothing to edit');

// ---- 2) the COVER: a strong frame + big title, first frame of the video (never black) ----
const coverT = cap.coverAt ?? cap.clips[0].start + .5;
const coverFrame = cap.frames.reduce((b, f) => Math.abs(f.t - coverT) < Math.abs(b.t - coverT) ? f : b, cap.frames[0]);
const titleLines = wrap(cap.title.toUpperCase(), 11);
const coverVf = [scaleCrop, 'eq=saturation=1.25:contrast=1.08',
  // dark bands top and bottom so the text pops on any frame
  `drawbox=x=0:y=0:w=iw:h=ih*0.34:color=0x000000@0.45:t=fill`,
  `drawbox=x=0:y=ih*0.8:w=iw:h=ih*0.2:color=0x000000@0.45:t=fill`,
  ...textLines(['TINY CRIME'], H * .06, 58, '0xFF3D9A'),
  ...textLines(titleLines, H * .13, 108, '0xFFD24A'),
  ...(cap.subtitle ? textLines(wrap(cap.subtitle.toUpperCase(), 22), H * .84, 50, '0xFFFFFF') : []),
];
fs.writeFileSync(path.join(TMP, 'cover.filter'), [...coverVf, 'format=yuvj420p'].join(',\n'));
ff(['-i', path.join(DIR, 'frames', coverFrame.file), '-filter_script:v', path.join(TMP, 'cover.filter'),
  '-frames:v', '1', '-q:v', '3', path.join(DIR, 'cover.jpg')]);
fs.writeFileSync(path.join(TMP, 'coverclip.filter'),
  [`scale=${W}:${H}`, `zoompan=z='min(1+0.0022*on\\,1.06)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`,
    'format=yuv420p'].join(',\n'));
{
  const a = audioIn(cap.clips[0].start - 1.2, 1.2, .25, .03);
  ff(['-loop', '1', '-t', '1.2', '-i', path.join(DIR, 'cover.jpg'), ...a.args, '-filter_script:v', path.join(TMP, 'coverclip.filter'),
    '-af', a.filter, '-map', '0:v', '-map', '1:a', ...X264, ...AAC, '-t', '1.2', path.join(TMP, 'cover.mp4')]);
}

// ---- 3) END card over the last frame, blurred ----
const last = cap.frames[cap.frames.length - 1];
const endVf = [scaleCrop, 'boxblur=14:2', 'eq=brightness=-0.2',
  ...textLines(wrap((cap.outro || 'TINY CRIME').toUpperCase(), 14), H * .36, 92, '0xFF3D9A'),
  ...(cap.outroSub ? textLines(wrap(cap.outroSub.toUpperCase(), 22), H * .56, 46, '0xFFD24A') : []),
  `fade=t=out:st=1.3:d=0.3`, 'format=yuv420p'];
fs.writeFileSync(path.join(TMP, 'end.filter'), endVf.join(',\n'));
{
  const a = audioIn(cap.clips[cap.clips.length - 1].end, 1.6, .03, .6);
  ff(['-loop', '1', '-t', '1.6', '-i', path.join(DIR, 'frames', last.file), ...a.args, '-filter_script:v', path.join(TMP, 'end.filter'),
    '-af', a.filter, '-map', '0:v', '-map', '1:a', ...X264, ...AAC, '-t', '1.6', path.join(TMP, 'end.mp4')]);
}

// ---- 4) stitch: cover + clips (hard cuts) + end, sound normalised to social-app loudness ----
const parts = [path.join(TMP, 'cover.mp4'), ...segs, path.join(TMP, 'end.mp4')];
const inputs = parts.flatMap((p) => ['-i', p]);
const fc = parts.map((_, i) => `[${i}:v][${i}:a]`).join('') + `concat=n=${parts.length}:v=1:a=1[v][a0];`
  + `[a0]loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
const OUT = path.join(DIR, `${scene}.mp4`);
ff([...inputs, '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
  ...X264, ...AAC, '-movflags', '+faststart', OUT]);

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT]);
const dur = parseFloat(String(probe.stdout)), mb = fs.statSync(OUT).size / 1e6;
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`[video] ${OUT}  ${W}x${H} ${FPS}fps  ${dur.toFixed(1)} s  ${mb.toFixed(1)} MB`);
console.log(`[video] cover: ${path.join(DIR, 'cover.jpg')}`);
if (dur > 34) console.warn('[video] WARNING: longer than ~30 s — cut the clips tighter');
if (mb > 8) console.warn('[video] WARNING: over 8 MB — shorten or raise the CRF');
