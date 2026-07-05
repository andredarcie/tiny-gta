import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PVP_HP_MAX } from '../../shared/net/protocol.ts';
import {
  clampHealth, deadPoseFlag, shouldSyncLocalHeal, shouldTriggerLocalWasted,
} from '../../shared/net/online-lifecycle.ts';

describe('online lifecycle helpers', () => {
  it('derives the dead pose flag without side effects', () => {
    expect(deadPoseFlag(100, false)).toBe(0);
    expect(deadPoseFlag(0, false)).toBe(1);
    expect(deadPoseFlag(40, true)).toBe(1);
  });

  it('only triggers local wasted when server hp reaches zero and the flow is not active', () => {
    expect(shouldTriggerLocalWasted(1, false)).toBe(false);
    expect(shouldTriggerLocalWasted(0, false)).toBe(true);
    expect(shouldTriggerLocalWasted(0, true)).toBe(false);
  });

  it('clamps and syncs local healing with a small jitter tolerance', () => {
    expect(clampHealth(-10)).toBe(0);
    expect(clampHealth(PVP_HP_MAX + 10)).toBe(PVP_HP_MAX);
    expect(shouldSyncLocalHeal(50.4, 50)).toBe(false);
    expect(shouldSyncLocalHeal(50.6, 50)).toBe(true);
  });

  it('keeps pose sampling away from destructive death actions', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/js/net/online.ts'), 'utf8');
    const start = src.indexOf('function samplePose');
    const end = src.indexOf('function poseChanged');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const samplePose = src.slice(start, end);
    expect(samplePose).toContain('refs.isWasted?.()');
    expect(samplePose).not.toContain('getWasted?.()');
  });
});
