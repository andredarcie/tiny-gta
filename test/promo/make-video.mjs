// Assemble the weed-farm promo video from a capture made by test/promo-weed-farm.spec.ts:
//   node test/promo/make-video.mjs
// Reads output/promo/frames/*.jpg + output/promo/timeline.json and writes
// output/promo/tiny-crime-weed-farm.mp4 (1280x720, 60 fps, H.264) with a title card,
// one caption per step and an end card. Needs ffmpeg on the PATH.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DIR = 'output/promo';
const OUT = path.join(DIR, 'tiny-crime-weed-farm.mp4');
const FONT = 'C\\:/Windows/Fonts/impact.ttf';
const { frames, marks } = JSON.parse(fs.readFileSync(path.join(DIR, 'timeline.json'), 'utf8'));

const CAPTIONS = {
  intro: 'GREEN ACRES - A HIDDEN GROW-OP',
  bucket: 'GRAB THE BUCKET',
  fill: 'FILL IT AT THE TAP',
  sow: 'SOW THE SEEDS BY HAND',
  water: 'WATER THE BED',
  grow: 'WATCH IT GROW',
  harvest: 'PULL IT OUT - ROOTS AND ALL',
  stash: 'ONE PLANT AT A TIME, INTO THE CRATE',
  deliver: 'THEN HIT THE STREETS',
};

function ff(args) {
  const r = spawnSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + args.join(' '));
}
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/,/g, '\\,');

// 1) the gameplay body: frames at their real timing -> constant 60 fps
const t0 = frames[0].t;
let list = '';
frames.forEach((f, i) => {
  const next = frames[i + 1];
  const d = next ? Math.min(.25, Math.max(.004, next.t - f.t)) : .5;
  list += `file 'frames/${f.file}'\nduration ${d.toFixed(4)}\n`;
});
list += `file 'frames/${frames[frames.length - 1].file}'\n`;
fs.writeFileSync(path.join(DIR, 'frames.txt'), list);
const bodyLen = frames[frames.length - 1].t - t0 + .5;

// captions: top-left lower-thirds-style, fading in/out, one per step
const cap = [];
for (let i = 0; i < marks.length - 1; i++) {
  const m = marks[i], label = CAPTIONS[m.label];
  if (!label) continue;
  const a = Math.max(0, m.at + .15), b = Math.max(a + 1.6, marks[i + 1].at - .1);
  const alpha = `if(lt(t\\,${a + .25})\\,(t-${a})/.25\\,if(gt(t\\,${b - .25})\\,(${b}-t)/.25\\,1))`;
  cap.push(`drawtext=fontfile='${FONT}':text='${esc(label)}':x=44:y=40:fontsize=46:fontcolor=0xFFD24A:`
    + `box=1:boxcolor=0x0b0714@0.72:boxborderw=16:enable='between(t\\,${a}\\,${b})':alpha='${alpha}'`);
}
fs.writeFileSync(path.join(DIR, 'body.filter'), ['fps=60', 'format=yuv420p', ...cap].join(',\n'));
ff(['-f', 'concat', '-safe', '0', '-i', path.join(DIR, 'frames.txt'),
  '-filter_script:v', path.join(DIR, 'body.filter'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', '60', path.join(DIR, 'body.mp4')]);

// 2) title + end cards over a blurred, darkened frame of the scene
function card(img, file, len, lines) {
  const draw = lines.map((l) => `drawtext=fontfile='${FONT}':text='${esc(l.text)}':x=(w-text_w)/2:y=${l.y}:`
    + `fontsize=${l.size}:fontcolor=${l.color}:shadowcolor=0x000000@0.8:shadowx=4:shadowy=4`);
  const vf = [`scale=1280:720`, `boxblur=12:2`, `eq=brightness=-0.18:saturation=1.15`, ...draw,
    `fade=t=in:st=0:d=0.35`, `fade=t=out:st=${(len - .35).toFixed(2)}:d=0.35`, 'format=yuv420p'].join(',');
  fs.writeFileSync(path.join(DIR, file + '.filter'), vf);
  ff(['-loop', '1', '-t', String(len), '-i', img, '-filter_script:v', path.join(DIR, file + '.filter'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-r', '60', path.join(DIR, file + '.mp4')]);
}
const first = path.join(DIR, 'frames', frames[Math.min(frames.length - 1, 30)].file);
const last = path.join(DIR, 'frames', frames[frames.length - 1].file);
card(first, 'title', 2.4, [
  { text: 'TINY CRIME', y: 250, size: 104, color: '0xFF3D9A' },
  { text: 'NEW: THE WEED FARM - NOW HANDS-ON', y: 380, size: 46, color: '0xFFD24A' },
]);
card(last, 'end', 2.6, [
  { text: 'GROW IT. HARVEST IT. SELL IT.', y: 270, size: 64, color: '0xFFD24A' },
  { text: 'TINY CRIME', y: 370, size: 92, color: '0xFF3D9A' },
]);

// 3) title + body + end
ff(['-i', path.join(DIR, 'title.mp4'), '-i', path.join(DIR, 'body.mp4'), '-i', path.join(DIR, 'end.mp4'),
  '-filter_complex', '[0:v][1:v][2:v]concat=n=3:v=1:a=0,format=yuv420p[v]', '-map', '[v]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-movflags', '+faststart', '-r', '60', OUT]);
console.log(`[promo] wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ~${(bodyLen + 5).toFixed(1)} s)`);
