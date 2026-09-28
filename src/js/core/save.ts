import { state, refs } from '@/core/state.ts';
import type { SaveBlob, LedgerSnapshot } from '@/core/types.ts';

// PROGRESS SAVE — the bridge between the live game state and the save blob, which
// is persisted ONLY in this browser's localStorage (the game is fully offline).
// This module stays "dumb": it builds/applies the blob by reading getters/setters
// each system registers in `refs` (same pattern as refs.miniBlips/zoneActions),
// without importing weapons/gym/property/... directly — so it creates no import
// cycles and a new slot only has to register its pair in refs.
//
// MONEY is a transaction LEDGER (see js/core/economy.ts): the balance is the sum of
// the transactions. The save carries the ledger snapshot (`blob.ledger`) and the
// restore is IDEMPOTENT — re-applying the same snapshot never doubles or loses
// money (dedupe by id). `blob.money` stays as a derived MIRROR (HUD / legacy
// fallback for old saves that have no `ledger`).

// Builds the blob from the current state. Missing slots become empty/null.
export function collectSave(): SaveBlob {
  return {
    v: 2,
    money: Math.max(0, Math.floor(state.money) || 0), // derived mirror of the ledger
    ledger: refs.serializeLedger?.() || null,         // {ckpt, seq, txs[]} — source of truth for the balance
    weapons: refs.getWeaponsSave?.() || [],
    arm: refs.getGymSave?.() || null,
    house: refs.getPropertySave?.() || null,
    pkg: refs.getPackagesSave?.() || [],
    stunts: refs.getStuntsSave?.() || [],
    daily: refs.getDailySave?.() || null, // in-game day + the mini-games' "once per day" locks
    farm: refs.getFarmSave?.() || null,   // grow-op: upgrade level + bought seeds/plant-food
    clothing: refs.getClothingSave?.() || null, // player outfit: shirt/pants/shoe colours + accessories
    // Political party membership. 'none' (not null) encodes de-affiliation, so
    // an explicit "left the party" is distinguishable from an old save that
    // predates the field.
    party: state.party ?? 'none',
  };
}

// Applies a restored blob to the game. Safe to call more than once in the same
// run — every path below is IDEMPOTENT: money via the ledger (dedupe by id) and
// items via restores that check ownership before applying (weapons/property/...).
export function applySave(blob: unknown): void {
  if (!blob || typeof blob !== 'object') return;
  const b = blob as Partial<SaveBlob>;
  // Money: use the ledger snapshot when present; otherwise synthesize one from
  // `money` (old v1 save) — a transparent client-side migration.
  const ledger = (b.ledger && typeof b.ledger === 'object')
    ? b.ledger
    : (Number.isFinite(b.money) && (b.money as number) >= 0 ? { ckpt: Math.floor(b.money as number), txs: [] } : null);
  if (ledger) refs.importLedger?.(ledger as LedgerSnapshot);
  refs.restoreWeapons?.(b.weapons);
  refs.restoreGym?.(b.arm);
  refs.restoreProperty?.(b.house);
  refs.restorePackages?.(b.pkg);
  refs.restoreStunts?.(b.stunts);
  refs.restoreDaily?.(b.daily);
  refs.restoreFarm?.(b.farm);
  refs.restoreClothing?.(b.clothing);
  // Party membership: 'none' (or a literal null) means the player de-affiliated
  // and must stay unaffiliated; old saves without the field are left untouched.
  if (b.party === 'red' || b.party === 'blue') state.party = b.party;
  else if (b.party === 'none' || b.party === null) state.party = null;
}

// ---- local persistence (localStorage) ---------------------------------------
// Same key the old online build used for its local mirror, so progress already on
// this device carries over. That mirror was stored as {pid, save}; new writes
// store the blob itself — loadLocalSave() accepts both shapes.
const SAVE_KEY = 'tinygta_save';
// Saving is armed only AFTER the stored save was restored (startLocalSave), so the
// fresh boot state can never overwrite real progress before it is loaded.
let armed = false, lastJson = '';

// Reads the stored save blob, or null when there is none / it is unreadable.
export function loadLocalSave(): Partial<SaveBlob> | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') return null;
    const blob = ('save' in raw && raw.save && typeof raw.save === 'object') ? raw.save : raw;
    return blob as Partial<SaveBlob>;
  } catch { return null; }
}

// Writes the current state to localStorage (skipped when nothing changed).
export function saveNow(): void {
  if (!armed) return;
  try {
    const json = JSON.stringify(collectSave());
    if (json === lastJson) return;
    localStorage.setItem(SAVE_KEY, json);
    lastJson = json;
  } catch { /* storage full / blocked: keep playing, retry on the next tick */ }
}

// Arms persistence for this run: periodic autosave plus a save whenever the tab
// is hidden/closed. Call once, right after the stored save has been applied.
export function startLocalSave(): void {
  if (armed) return;
  armed = true;
  saveNow();
  setInterval(saveNow, 3000);
  addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  addEventListener('pagehide', saveNow);
}

refs.collectSave = collectSave;
refs.applySave = applySave;
// economy.ts calls this on every money change so a payout is persisted right away.
refs.backupSave = saveNow;
