// One-time move of the player's saved data from the game's former localStorage keys to
// the Divino City ones (divinocity_*), so a rename never costs anyone their progress.
// Imported first thing by boot.ts, before any module reads its key. Runs in a few µs:
// it only scans localStorage and moves what is still under an old key.
const LEGACY_PREFIX = 'tinygta_';
const LEGACY_EXACT: Record<string, string> = { tinycrime_updates_seen: 'divinocity_updates_seen' };

try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const old = localStorage.key(i);
    if (!old) continue;
    const key = old.startsWith(LEGACY_PREFIX) ? 'divinocity_' + old.slice(LEGACY_PREFIX.length) : LEGACY_EXACT[old];
    if (!key) continue;
    const v = localStorage.getItem(old);
    if (v != null && localStorage.getItem(key) == null) localStorage.setItem(key, v);
    localStorage.removeItem(old);
  }
} catch { /* storage blocked (private mode): nothing to move */ }
