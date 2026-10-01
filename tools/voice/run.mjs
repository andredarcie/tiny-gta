// `npm run voice [-- args]`: export the story's lines, then dub the missing ones through
// the VoiceStudio app's local API (tools/voice/dub.mjs). See tools/voice/README.md.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const run = (args) => {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run([path.join('node_modules', 'tsx', 'dist', 'cli.mjs'), path.join('tools', 'voice', 'export-lines.ts')]);
run([path.join('tools', 'voice', 'dub.mjs'), ...process.argv.slice(2)]);
