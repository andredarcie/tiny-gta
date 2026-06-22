import rawData from '../../minigame-rewards.json';

// ============================================================================
// MINI-GAME CONFIG — single source of truth for how much money each mini-game
// PAYS, what its activities COST, and its key TIMERS / CAPS. Tuned in
// /minigame-rewards.json (root), where every tunable is a self-documenting
// { field, value, description } triple grouped by mini-game.
//
// This module flattens those triples into REWARDS.<minigame>.<field> so game
// code reads a plain number (or an array/map for the few collection fields)
// without caring about the triple wrapper. Edit the JSON → the dev server
// hot-reloads → `npm run build` bakes the new values in.
//
// RULE (mirrored from the JSON): any mini-game whose payout is SCALED by a
// multiplier (level, combo, distance, strain/market) carries an explicit max
// cap field (maxReward / maxFare / maxCashPerKill / maxPayPerDeal). Mini-games
// that already capped their multiplier keep theirs (overkill.maxPerSecond,
// stuntJump.maxValue, rampage.rewardCap).
// ============================================================================

// One tunable as authored in the JSON.
interface Tunable { field: string; value: unknown; description: string }

// Flatten a mini-game's list of triples into { [field]: value }.
function flatten(list: Tunable[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const t of list) o[t.field] = t.value;
  return o;
}

const RAW = rawData as unknown as Record<string, Tunable[]>;
const FLAT: Record<string, Record<string, unknown>> = {};
for (const mg of Object.keys(RAW)) FLAT[mg] = flatten(RAW[mg]);

/** A race-style payout: prize by finishing place + a fast-clean-win bonus + anti-farm. */
export interface RaceReward {
  /** Prize by finishing place; index 0 = 1st (0 = no payout). */
  placePrizes: number[];
  /** 1st-place bonus = max(0, fastWinBonusMax - raceSeconds * fastWinBonusDecayPerSec). */
  fastWinBonusMax: number;
  fastWinBonusDecayPerSec: number;
  /** Each consecutive win on the SAME race pays repeatWinDecay^streak of the prize. */
  repeatWinDecay: number;
  repeatWinRecoverSec: number;
  /** Start countdown before the race begins. */
  countdownSec: number;
}

export interface MinigameRewardConfig {
  race: RaceReward;
  boatRace: RaceReward;
  offroad: RaceReward;
  taxi: {
    baseFare: number; farePerMeter: number; baseTip: number; tipPerMeter: number;
    maxFare: number;
    deadlineBaseSec: number; deadlinePerMeterDiv: number; deadlineMinSec: number; deadlineMaxSec: number;
    wreckRespawnSec: number;
  };
  carCrusher: { minScrap: number; maxScrap: number };
  vigilante: {
    perBust: number; maxReward: number;
    dutyTimeSec: number; bustBonusSec: number; ramCooldownSec: number; wreckRespawnSec: number;
  };
  paramedic: {
    perPatient: number; perLevel: number; maxReward: number;
    levelTimeBaseSec: number; levelTimePerLevelSec: number; wreckRespawnSec: number;
  };
  firefighter: {
    perLevel: number; speedBonusMax: number; speedBonusDecayPerSec: number; maxReward: number;
    fireBaseSec: number; timePerMeterSec: number; timeMinSec: number; timeMaxSec: number;
    startBufferSec: number; lowTimeSec: number; wreckRespawnSec: number;
  };
  stuntJump: {
    speedMultiplier: number; maxValue: number; firstTimeBonus: number;
    jumpDurSec: number; landCooldownSec: number; repeatPayCooldownSec: number;
  };
  hiddenPackages: { perPackage: number; bonusPer10: number; bonusAll: number };
  importExport: { baseMin: number; baseRandomSpan: number; matchBonus: number };
  rcToyz: {
    perKill: number; goldCarMultiplier: number;
    comboTiers: { minCombo: number; mult: number }[];
    maxCashPerKill: number;
    roundTimeSec: number; timeCapSec: number; timePerKillSec: number; goldTimeSec: number;
    comboWindowSec: number; crateRespawnSec: number; crateTimeSec: number;
    nitroTimeSec: number; megaTimeSec: number; panicTimeSec: number;
  };
  weedFarm: {
    pricePerBud: number; strainValues: Record<string, number>;
    cityPriceMultiplier: number; marketFactorMin: number; marketFactorSpan: number; cureBonus: number;
    maxPayPerDeal: number;
    seedPrices: Record<string, number>; fertilizerPrice: number; upgradePrices: number[];
    growTimeSec: number; cureTimeSec: number; dryDeathSec: number; pourTimeSec: number;
    hydrationDrainPerSec: number;
  };
  rampage: { rewardBase: number; rewardPerGoalKill: number; rewardCap: number; durationSec: number; cooldownSec: number };
  rocketRampage: { reward: number; timeSec: number };
  overkill: { maxPerSecond: number; rateFactor: number; maxMultiplier: number; climbPerSec: number; decayPerSec: number };
  dance: { gradePayouts: Record<string, number> };
  bombShop: { armPrice: number };
  /** Crooked-cop shakedown when busted carrying the weed-deal backpack. */
  drugBust: { bribeMin: number; bribeStashFraction: number };
}

/** Typed view of /minigame-rewards.json (flattened from its {field,value,description}
 *  triples). Import this anywhere a mini-game needs its money / cost / timer values. */
export const REWARDS = FLAT as unknown as MinigameRewardConfig;
