// cleanup.mjs — leaderboard repair tool for Tiny Crime.
//
// The game is client-side, so a determined cheater can still forge a /api/scores
// request (e.g. copy the cURL from devtools and edit `money`). The server-side
// hardening raises the cost of that, but when abuse already landed in Redis the
// owner needs a way to inspect and repair the board. This script is that tool.
//
// It reads the same Upstash creds the API uses (UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN) via Redis.fromEnv(). Run it from the backend/ dir so
// the .env beside it is picked up:
//
//   node --env-file=.env scripts/cleanup.mjs list [N]
//       Print the top N (default 50) leaderboard entries (rank/name/money) and
//       the total player count (ZCARD).
//
//   node --env-file=.env scripts/cleanup.mjs inspect "<NAME>"
//       Dump everything stored for a name: leaderboard money, all save blobs,
//       seed value and per-minigame stats. Read-only.
//
//   node --env-file=.env scripts/cleanup.mjs cap <VALUE> [--apply]
//       Lower every entry whose money > VALUE down to VALUE (squashes inflated
//       scores without deleting players).
//
//   node --env-file=.env scripts/cleanup.mjs remove "<NAME>" [--apply]
//       Remove a name from the global board, delete its save blobs, drop its seed
//       field, and remove it from every minigame board + its minigame hashes.
//
// DRY-RUN BY DEFAULT: without --apply nothing is written; the script only prints
// what WOULD change. Pass --apply to actually mutate Redis.
//
// Examples:
//   node --env-file=.env scripts/cleanup.mjs list 20
//   node --env-file=.env scripts/cleanup.mjs inspect "CHEATER 1"
//   node --env-file=.env scripts/cleanup.mjs cap 10000000            # dry run
//   node --env-file=.env scripts/cleanup.mjs cap 10000000 --apply    # for real
//   node --env-file=.env scripts/cleanup.mjs remove "CHEATER 1" --apply

import { Redis } from '@upstash/redis';

// ----- Redis key schema (mirrors backend/lib/scores.js) ---------------------
const LEADERBOARD_KEY = 'tinygta:leaderboard';
const SAVE_PREFIX = 'tinygta:save:';          // + <pid>|<name>
const SEED_KEY = 'tinygta:seed';              // hash: field=name -> money
const MG_BOARD_PREFIX = 'tinygta:mg:';        // + <game>            -> sorted set
const mgBoardKey = (game) => MG_BOARD_PREFIX + game;
const mgPlayerKey = (game, name) => MG_BOARD_PREFIX + game + ':p:' + name;

// Minigame ids (mirrors MG_GAME_IDS in backend/lib/scores.js).
const MG_GAME_IDS = [
  'taxi', 'race', 'boat-race', 'offroad', 'vigilante', 'paramedic', 'firefighter',
  'rampage', 'rc-toyz', 'car-crusher', 'import-export', 'bomb-shop',
  'hidden-packages', 'stunt-jumps', 'overkill', 'gym', 'dance', 'rocket-rampage',
];

// ----- credentials check ----------------------------------------------------
if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  console.error(
    'Missing Upstash credentials. Set UPSTASH_REDIS_REST_URL and ' +
    'UPSTASH_REDIS_REST_TOKEN (run with: node --env-file=.env scripts/cleanup.mjs ...).'
  );
  process.exit(1);
}

const redis = Redis.fromEnv();

// ----- argv parsing (no extra deps) -----------------------------------------
// Strip the --apply flag out of positional args so commands can read their
// operands by position regardless of where --apply sits.
const rawArgs = process.argv.slice(2);
const APPLY = rawArgs.includes('--apply');
const args = rawArgs.filter((a) => a !== '--apply');
const cmd = args[0];

// Tag every line so the reader always knows whether anything was written.
const tag = APPLY ? '[APPLY]' : '[DRY-RUN]';

// ----- helpers --------------------------------------------------------------

// zrange withScores returns a flat [member, score, member, score, ...] array —
// fold it into {name, score} objects (mirrors backend/api/scores.js getBoard).
function foldWithScores(raw) {
  const out = [];
  for (let i = 0; i < raw.length; i += 2) {
    out.push({ name: String(raw[i]), score: Number(raw[i + 1]) });
  }
  return out;
}

// SCAN (never KEYS) for save blobs belonging to a name. Keys look like
//   tinygta:save:<pid>|<name>
// and the name is the part AFTER THE LAST '|'. Names can contain spaces, so we
// match by the exact `|<NAME>` suffix rather than by pattern wildcards alone.
async function findSaveKeysForName(name) {
  const wantSuffix = '|' + name;
  const matchGlob = SAVE_PREFIX + '*|' + name; // server-side narrowing; client-side exact-checked below
  const found = [];
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, { match: matchGlob, count: 100 });
    cursor = String(next);
    for (const key of keys) {
      // Exact suffix check: the name is everything after the last '|'. The MATCH
      // glob can over-match (e.g. a name with a '|' inside another name's slice),
      // so confirm the real suffix here before touching anything.
      const rest = key.slice(SAVE_PREFIX.length); // "<pid>|<name>"
      const lastPipe = rest.lastIndexOf('|');
      if (lastPipe >= 0 && rest.slice(lastPipe) === wantSuffix) found.push(key);
    }
  } while (cursor !== '0');
  return found;
}

function fmtMoney(n) {
  return Number(n).toLocaleString('en-US');
}

// ----- commands -------------------------------------------------------------

async function cmdList() {
  let n = parseInt(args[1], 10);
  if (!Number.isFinite(n)) n = 50;
  n = Math.max(1, n);

  const raw = await redis.zrange(LEADERBOARD_KEY, 0, n - 1, { rev: true, withScores: true });
  const entries = foldWithScores(raw);
  const total = Number(await redis.zcard(LEADERBOARD_KEY)) || 0;

  console.log(`Leaderboard ${LEADERBOARD_KEY} — total players: ${total}`);
  console.log(`Top ${entries.length}:`);
  entries.forEach((e, i) => {
    console.log(`  ${String(i + 1).padStart(4)}.  ${fmtMoney(e.score).padStart(20)}  ${e.name}`);
  });
}

async function cmdInspect() {
  const name = args[1];
  if (!name) {
    console.error('Usage: inspect "<NAME>"');
    process.exit(1);
  }
  console.log(`Inspecting "${name}"`);

  // 1) global leaderboard money
  const score = await redis.zscore(LEADERBOARD_KEY, name);
  console.log(`  leaderboard money: ${score == null ? '(not on board)' : fmtMoney(score)}`);

  // 2) all save blobs (scan by exact name suffix)
  const saveKeys = await findSaveKeysForName(name);
  if (!saveKeys.length) {
    console.log('  save blobs: (none)');
  } else {
    for (const key of saveKeys) {
      const blob = await redis.get(key); // @upstash/redis parses JSON values
      console.log(`  save blob ${key}:`);
      console.log('    ' + JSON.stringify(blob));
    }
  }

  // 3) migration seed value
  const seed = await redis.hget(SEED_KEY, name);
  console.log(`  seed value: ${seed == null ? '(none)' : fmtMoney(seed)}`);

  // 4) per-minigame stats
  console.log('  minigame stats:');
  let anyMg = false;
  for (const game of MG_GAME_IDS) {
    const rating = await redis.zscore(mgBoardKey(game), name);
    const stats = await redis.hgetall(mgPlayerKey(game, name));
    if (rating == null && (!stats || !Object.keys(stats).length)) continue;
    anyMg = true;
    const s = stats || {};
    console.log(
      `    ${game.padEnd(16)} rating=${rating == null ? '-' : rating}` +
      ` plays=${s.plays || 0} wins=${s.wins || 0} losses=${s.losses || 0}` +
      ` earned=${s.earned || 0} best=${s.best || 0}`
    );
  }
  if (!anyMg) console.log('    (none)');
}

async function cmdCap() {
  const value = Number(args[1]);
  if (!Number.isFinite(value) || value < 0) {
    console.error('Usage: cap <VALUE> [--apply]   (VALUE must be a non-negative number)');
    process.exit(1);
  }

  // Pull the whole board (member + score) and find offenders above the cap.
  const raw = await redis.zrange(LEADERBOARD_KEY, 0, -1, { rev: true, withScores: true });
  const all = foldWithScores(raw);
  const offenders = all.filter((e) => e.score > value);

  console.log(`${tag} cap leaderboard money at ${fmtMoney(value)}`);
  if (!offenders.length) {
    console.log('  no entries above the cap — nothing to do.');
    return;
  }
  console.log(`  ${offenders.length} entr${offenders.length === 1 ? 'y' : 'ies'} above the cap:`);
  for (const e of offenders) {
    console.log(`    ${e.name}: ${fmtMoney(e.score)} -> ${fmtMoney(value)}`);
  }

  if (!APPLY) {
    console.log('  (dry run — pass --apply to write these changes)');
    return;
  }
  for (const e of offenders) {
    await redis.zadd(LEADERBOARD_KEY, { score: value, member: e.name });
    console.log(`  capped ${e.name} -> ${fmtMoney(value)}`);
  }
}

async function cmdRemove() {
  const name = args[1];
  if (!name) {
    console.error('Usage: remove "<NAME>" [--apply]');
    process.exit(1);
  }
  console.log(`${tag} remove "${name}"`);

  // Gather every key/field this removal touches BEFORE mutating, so the dry run
  // prints exactly what --apply would do.
  const onBoard = (await redis.zscore(LEADERBOARD_KEY, name)) != null;
  const saveKeys = await findSaveKeysForName(name);
  const hasSeed = (await redis.hget(SEED_KEY, name)) != null;

  const mgHits = []; // { game, onBoard, playerKey, hasHash }
  for (const game of MG_GAME_IDS) {
    const mgScore = await redis.zscore(mgBoardKey(game), name);
    const pKey = mgPlayerKey(game, name);
    const hash = await redis.hgetall(pKey);
    const hasHash = !!(hash && Object.keys(hash).length);
    if (mgScore != null || hasHash) {
      mgHits.push({ game, onBoard: mgScore != null, playerKey: pKey, hasHash });
    }
  }

  // Report (and, when --apply, perform) each touch.
  if (onBoard) {
    console.log(`  ZREM ${LEADERBOARD_KEY} "${name}"`);
    if (APPLY) await redis.zrem(LEADERBOARD_KEY, name);
  } else {
    console.log(`  (not on ${LEADERBOARD_KEY})`);
  }

  for (const key of saveKeys) {
    console.log(`  DEL ${key}`);
    if (APPLY) await redis.del(key);
  }
  if (!saveKeys.length) console.log('  (no save blobs)');

  if (hasSeed) {
    console.log(`  HDEL ${SEED_KEY} "${name}"`);
    if (APPLY) await redis.hdel(SEED_KEY, name);
  } else {
    console.log(`  (no seed field)`);
  }

  for (const m of mgHits) {
    if (m.onBoard) {
      console.log(`  ZREM ${mgBoardKey(m.game)} "${name}"`);
      if (APPLY) await redis.zrem(mgBoardKey(m.game), name);
    }
    if (m.hasHash) {
      console.log(`  DEL ${m.playerKey}`);
      if (APPLY) await redis.del(m.playerKey);
    }
  }
  if (!mgHits.length) console.log('  (no minigame data)');

  if (!APPLY) console.log('  (dry run — pass --apply to write these changes)');
}

// ----- dispatch -------------------------------------------------------------
async function main() {
  switch (cmd) {
    case 'list': return cmdList();
    case 'inspect': return cmdInspect();
    case 'cap': return cmdCap();
    case 'remove': return cmdRemove();
    default:
      console.error('Unknown or missing command. Available: list | inspect | cap | remove');
      console.error('Run with no --apply for a dry run. See the header comment for examples.');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('cleanup failed:', err);
  process.exit(1);
});
