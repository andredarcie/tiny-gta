// ============================================================================
// Shared TypeScript types for the game (front-end). Cross-module shapes live
// here so systems agree on the same contracts. Module-local shapes stay in their
// own files. This file has NO runtime code — types only.
// ============================================================================
import type * as THREE from 'three';

// ---- core ------------------------------------------------------------------

export type Mode = 'foot' | 'car' | 'cut';

/** The shared mutable gameplay state (js/core/state.ts `state`). */
export interface GameState {
  started: boolean;
  paused: boolean;
  mode: Mode;
  money: number;
  wanted: number;
  health: number;
  lastCrime: number;
  sixStarT: number;
  deliveries: number;
  taxiFares: number;
  taxiEarnings: number;
  bustT: number;
  cutT: number;
  cutFn: (() => void) | null;
  shake: number;
  time: number;
  comboN: number;
  lastHit: number;
  dlgActive: boolean;
  cine: boolean;
  kills: number;
  hasGun: boolean;
  weaponHeld: boolean;
  ammo: number;
  maxAmmo: number;
  // Weapon HUD mirror + last-shot bookkeeping — set at runtime by weapons.js/actors/player.ts,
  // absent on a fresh state, so optional (faithful to the original dynamic fields).
  weaponName?: string;
  weaponCategory?: string;
  weaponInfinite?: boolean;
  shotT?: number;
  shotX?: number;
  shotZ?: number;
  crosshairKick: number;
  crosshairTarget: boolean;
  mobile: boolean;
  orientationBlocked: boolean;
  controlsLocked: boolean;
  swimming: boolean;
  swimAir: number;
  seeds: Record<string, number>;
  seedSel: string;
  fertilizer: number;
  // Active interior / current rooftop door — class instances defined in their own
  // modules; refined to precise types as those modules are migrated.
  interior: any;
  armScale: number;
  armTarget: number;
  gymDay: number;
  viewerOpen: boolean;
  tvActive: boolean;
  gymActive: boolean;
  danceActive: boolean;
  modShopActive: boolean;
  mapOpen: boolean;
  adminOpen: boolean;
  firstPerson: boolean;
  aiming: boolean; // GTA-style aim mode (RMB toggle / mobile AIM): closer cam + reticle + tight spread
  wheelOpen: boolean;
  activeMiniGame: string | null;
  mgIntro: string | null;
  onRoof: any;
  mgDays: Record<string, number>;
}

/** Normalized input written by input.js / touch-controls.js (js/core/state.ts `input`). */
export interface InputState {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  run: boolean;
  brake: boolean;
  horn: boolean;
  shootHeld: boolean;
  touchActive: boolean;
  moveActive: boolean;
  lookActive: boolean;
  brakeActive: boolean;
  hornActive: boolean;
  lastInput: 'keyboard' | 'touch';
}

export interface BestScore {
  money: number;
  deliveries: number;
}

// ---- economy / persistence -------------------------------------------------

export interface LedgerTx {
  id: string;
  amt: number;
  why: string;
  t: number;
  local?: boolean;
}

export interface LedgerSnapshot {
  ckpt: number;
  seq: number;
  txs: { id: string; amt: number; why: string; t: number }[];
}

export interface EconomyDebug {
  balance: number;
  checkpoint: number;
  window: number;
  pending: number;
  blocked: number;
  last: { why: string; amt: number }[];
}

/** Progress blob persisted to / restored from the backend (js/core/save.ts). */
export interface SaveBlob {
  v: number;
  money: number;
  ledger: LedgerSnapshot | null;
  weapons: unknown;
  arm: unknown;
  house: unknown;
  pkg: unknown;
  stunts: unknown;
  daily: unknown;
  farm: unknown;
}

// ---- HUD / world registries ------------------------------------------------

/** A radar/map marker produced by a system (refs.miniBlips, race blips, ...). */
export interface Blip {
  x: number;
  z: number;
  icon?: string;
  color?: string;
  label?: string;
  current?: boolean;
  reveal?: boolean;
}

/** A contextual ground/zone action (the E button). */
export interface ZoneAction {
  label: string;
  prompt?: string;
  enabled?: boolean;
  run: () => void;
}

// ---- models ----------------------------------------------------------------

/** The default export of every assets/models/** file. */
export interface ModelDescriptor {
  category?: string;
  label: string;
  build: (opts?: any) => THREE.Object3D | Record<string, unknown>;
  variants?: { label: string; opts?: any }[];
}

// ---- vehicles / racers -----------------------------------------------------

/** A driveable/parked vehicle wrapper (player.js `cur`, idleCars, traffic). */
export interface Vehicle {
  g: THREE.Object3D;
  name: string;
  heading: number;
  speed: number;
  plane?: boolean;
  taxi?: boolean;
  [k: string]: any;
}

/** Minimal racer shape used by the shared rubber-banding helpers (constants). */
export interface Racer {
  g: THREE.Object3D;
  finished?: boolean;
  [k: string]: any;
}

/** Anti-farm streak state passed to diminishPrize (constants). */
export interface PrizeStreak {
  streak: number;
  last: number;
}

// ---- late-binding refs -----------------------------------------------------
//
// The cross-module wiring object (js/core/state.ts `refs`). Every member is OPTIONAL
// because it is wired late (after boot); consumers read with `?.`. The contract
// catalog + a boot-time check live in js/refs.ts. Members are added here as the
// producing module is migrated; precise return types are tightened alongside.
export interface Refs {
  // generic registries
  miniBlips?: Array<() => Blip[]>;
  zoneActions?: Array<() => ZoneAction | null>;
  carEnterLabels?: Array<(c: Vehicle) => ZoneAction | null>;

  // player / camera
  playerPos?: () => THREE.Vector3;
  getCur?: () => Vehicle | null;
  getPlayerHeading?: () => number | undefined;
  getRadarHeading?: () => number;
  nearestCar?: (maxDist: number) => { c: Vehicle; kind: string } | null;

  // economy / save / leaderboard
  serializeLedger?: () => LedgerSnapshot;
  importLedger?: (s: LedgerSnapshot | null) => void;
  takeUnsyncedTxs?: () => LedgerTx[];
  ackSyncedTxs?: (ids: string[]) => void;
  debugLedger?: () => EconomyDebug;
  collectSave?: () => SaveBlob;
  applySave?: (blob: unknown) => void;
  backupSave?: () => void;
  getWeaponsSave?: () => unknown;
  restoreWeapons?: (v: unknown) => void;
  getGymSave?: () => unknown;
  restoreGym?: (v: unknown) => void;
  getPropertySave?: () => unknown;
  restoreProperty?: (v: unknown) => void;
  getPackagesSave?: () => unknown;
  restorePackages?: (v: unknown) => void;
  getStuntsSave?: () => unknown;
  restoreStunts?: (v: unknown) => void;
  getDailySave?: () => unknown;
  restoreDaily?: (v: unknown) => void;
  getFarmSave?: () => unknown;
  restoreFarm?: (v: unknown) => void;

  // HUD message bus
  message?: (t: string, col?: string) => void;
  toggleAim?: () => void;

  // Open to extension: members are declared above as modules migrate. Until a
  // module is migrated, its refs are reached only from untyped .js callers.
  [k: string]: any;
}
