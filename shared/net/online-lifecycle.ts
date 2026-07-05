import { PVP_HP_MAX } from './protocol.ts';

export const HEALTH_SYNC_EPS = 0.5;

export const deadPoseFlag = (health: number, wasted: boolean): 0 | 1 =>
  health <= 0 || wasted ? 1 : 0;

export const shouldTriggerLocalWasted = (hp: number, alreadyWasted: boolean): boolean =>
  hp <= 0 && !alreadyWasted;

export const clampHealth = (hp: number): number =>
  hp < 0 ? 0 : hp > PVP_HP_MAX ? PVP_HP_MAX : hp;

export function shouldSyncLocalHeal(current: number, lastSeen: number): boolean {
  return current > lastSeen + HEALTH_SYNC_EPS;
}
