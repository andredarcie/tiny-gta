// Film + edit one short video:  npm run video -- <scene>
//   1) runs test/video/scenes/<scene>.video.ts in a headed portrait browser (records clips)
//   2) assembles output/video/<scene>/<scene>.mp4 (9:16, 30 fps) + cover.jpg
// `npm run video -- <scene> --edit-only` re-edits the last capture without refilming.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const scene = process.argv[2];
const editOnly = process.argv.includes('--edit-only');
if (!scene) {
  const list = fs.readdirSync('test/video/scenes').filter((f) => f.endsWith('.video.ts')).map((f) => f.replace('.video.ts', ''));
  console.error(`usage: npm run video -- <scene> [--edit-only]\nscenes: ${list.join(', ')}`);
  process.exit(1);
}
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (!editOnly) run('npx', ['playwright', 'test', '-c', 'playwright.video.config.ts', `test/video/scenes/${scene}.video.ts`]);
run('node', ['test/video/make-video.mjs', scene]);
