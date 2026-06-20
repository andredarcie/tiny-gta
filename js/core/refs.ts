// ============================================================================
// REFS — the late-binding cross-module wiring contract, in ONE place.
//
// `refs` (defined in state.ts, re-exported here) is how systems call across
// modules without circular imports: a producer does `refs.foo = fn` at boot and
// any consumer does `refs.foo?.()`. The weakness of that pattern is that a broken
// wire — a renamed function, a typo'd key, a producer module that failed to load
// — turns into a SILENT no-op (the `?.` swallows it), so a feature just quietly
// dies somewhere deep in the game with no error. Because this game is verified by
// PLAYING it (there are no automated gameplay tests in the loop), such a
// regression can ship completely unseen.
//
// This module turns that whole class of bug from a silent runtime no-op into a
// LOUD failure at boot:
//   - validateRefs(): asserts every LOAD-BEARING ref is actually wired once the
//     boot wiring has finished (main.ts calls it at the end). A missing one logs
//     an error and, in a dev build, paints a red banner on the title screen.
//   - KNOWN + auditRefs(): the full catalog of every ref the codebase wires, so
//     there is a single documented source of truth for the contract. The dev
//     audit warns when a ref is wired but NOT catalogued here (a producer-side
//     typo, or a new ref someone forgot to declare), keeping the list honest.
//
// `refs` itself stays a PLAIN object (no Proxy on purpose): it is read on hot
// paths (refs.playerPos() etc. every frame) and must keep native property-access
// speed. All checking happens once, at boot — never per frame.
// ============================================================================
import { refs } from '@/core/state.js';

// Developer build? (mirrors main.ts DEBUG_HOOKS.) Controls whether a broken wire
// also paints an on-screen banner / runs the audit, vs logging to the console only.
const DEV: boolean = (() => { try { return !!import.meta.env?.DEV || /[?&]debug\b/.test(location.search); } catch (e) { return false; } })();

// LOAD-BEARING refs: the game is fundamentally broken if any of these is missing
// after boot (movement, money, saves, weapons, death/arrest, the mini-game lock).
// Kept deliberately CONSERVATIVE — every entry is wired unconditionally at boot,
// so a missing one is always a real regression, never a false alarm.
export const REQUIRED: string[] = [
  // player / camera (read every frame)
  'playerPos','getCur','getPlayerHeading','getRadarHeading','nearestCar',
  // money + progress persistence
  'serializeLedger','importLedger','collectSave','applySave',
  // weapons + the HUD message bus
  'canPickWeapon','isWeaponHeld','canAttack','getWeaponHud','message',
  // death / arrest flow
  'getBusted','getWasted',
  // mini-game daily lock + its save slot
  'mgPlayedToday','mgMarkPlayed','getDailySave','restoreDaily',
];

// FULL catalog of every ref the codebase wires (the producers). Single source of
// truth for the contract; auditRefs() warns on anything wired but missing here.
// Generic registries (arrays the modules push into) are included.
export const KNOWN = new Set<string>([
  // generic registries
  'miniBlips','zoneActions','carEnterLabels',
  // main.ts core late-binding
  'playerPos','getCur','getPlayerHeading','getRadarHeading','traffic','cops',
  'trafficPos','spawnTraffic','ejectDriver','addBloodPuddle','gangs','setGangsHidden',
  'interiorBlips','getDelivery','storyNear','storyBlips','storyTargets','rickNear',
  'rickInteract','getRickState','getBusted','getWasted','getHeli','nearestCar',
  'canPickWeapon','isWeaponHeld','canAttack','switchWeapon','selectWeaponSlot',
  'getWeaponHud','confiscateWeapon','gymTrainState','clubDanceState','modShopState',
  'modShopInteract','workshopBlip','hospitalAdmit','prisonAdmit','gunShopState',
  'gunShopBuy','gunShopTargets','inGunShopRange','overkillNear','endOverkill',
  'getOverkillState','exitCar','houseBuyState','houseEatState','houseGarageState',
  'getHouseState','houseTvState','getHouseTvState',
  // economy.ts / save.ts / leaderboard.ts
  'serializeLedger','importLedger','takeUnsyncedTxs','ackSyncedTxs','debugLedger',
  'collectSave','applySave','backupSave',
  // hud.ts / input.ts
  'message','togglePause','toggleFullscreen',
  // minigame.ts
  'mgPlayedToday','mgMarkPlayed','getDailySave','restoreDaily',
  // per-system state getters / save slots / blips / interactions
  'getBombShopState','getCarCrusherState','boatRaceBlips','getBoatRaceState',
  'boatRaceNear','startBoatRaceInteract','clearArmy','armyTargets','blastArmy',
  'armyDist','getArmyState','dropDeathPool','getBloodstainsState','clearCops',
  'getOffroadState','offroadNear','startOffroadInteract','getGeneralStoreState',
  'getFirefighterState','clearPoliceBoats','policeBoats','getHiddenPackagesState',
  'getPackagesSave','restorePackages','isCarryingDrugs','startDrugBust',
  'getGymSave','restoreGym','isAmbulanceCar','paramedicBlips','paramedicStart',
  'getParamedicState','getImportExportState','overkillBlip','getRampageState',
  'getPropertySave','restoreProperty','getRcToyzState','raceBlips','getRaceState',
  'raceNear','startRaceInteract','getStuntJumpsState','getStuntsSave','restoreStunts',
  'getWeaponsSave','restoreWeapons','explodeAt','vigilanteBlips','vigilanteStart',
  'isVigilanteCar','getVigilanteState','getWeaponPickupsState','taxiTarget','isTaxiCar',
  'getTaxiState','seizeDrugBackpack','getFarmSave','restoreFarm','getWeedFarmState',
]);

// Paint (or update) a single fixed red banner at the top of the screen. Dev-only;
// used so a broken wire is impossible to miss when the game is verified by playing.
function paintBanner(text: string): void {
  try{
    let el=document.getElementById('refs-error');
    if(!el){
      el=document.createElement('div');
      el.id='refs-error';
      el.style.cssText='position:fixed;left:0;right:0;top:0;z-index:99999;'
        +'background:#c0142e;color:#fff;font:600 13px/1.4 ui-monospace,monospace;'
        +'padding:8px 12px;white-space:pre-wrap;box-shadow:0 2px 10px rgba(0,0,0,.55)';
      document.body.appendChild(el);
    }
    el.textContent=text;
  }catch(e){}
}

// Assert every load-bearing ref is wired. Call ONCE, after main.ts has finished
// the boot wiring. Loud (console.error always; red banner in dev) but NON-FATAL —
// the game still attempts to run so a single missing wire never black-screens a
// real player. Returns the list of missing keys (empty when all good).
export function validateRefs(): string[] {
  const missing=REQUIRED.filter(k=>typeof (refs as Record<string, unknown>)[k]!=='function');
  if(missing.length){
    const msg='[refs] load-bearing refs NOT wired after boot: '+missing.join(', ')
      +'\n  -> a producer module failed to load, or a ref key was renamed/typo\'d.';
    console.error(msg);
    if(DEV)paintBanner('REFS NOT WIRED -> '+missing.join(', '));
  }
  return missing;
}

// Dev-only contract audit: flag refs that were wired but are NOT catalogued in
// KNOWN (a producer-side typo, or a new ref nobody declared). Keeps KNOWN honest
// so it stays the real single source of truth for the wiring contract.
export function auditRefs(): string[] {
  if(!DEV)return [];
  const undeclared=Object.keys(refs).filter(k=>!KNOWN.has(k));
  if(undeclared.length)
    console.warn('[refs] wired but not declared in KNOWN (add them to js/refs.ts):',
      undeclared.join(', '));
  return undeclared;
}
