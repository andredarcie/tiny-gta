import { describe, expect, it } from 'vitest';
import {
  BLAST_RANGE_MAX, FLAME_RANGE_MAX, PVP_HP_MAX, SHOT_RANGE_MAX, parseClientMsg,
} from '../../shared/net/protocol.ts';

describe('online attack protocol extensions', () => {
  it('parses and clamps heal messages', () => {
    const full = parseClientMsg(JSON.stringify({ t: 'heal', hp: 999 }));
    if (full?.t !== 'heal') throw new Error('expected heal');
    expect(full.hp).toBe(PVP_HP_MAX);

    const empty = parseClientMsg(JSON.stringify({ t: 'heal', hp: -20 }));
    if (empty?.t !== 'heal') throw new Error('expected heal');
    expect(empty.hp).toBe(0);

    expect(parseClientMsg(JSON.stringify({ t: 'heal', hp: null }))).toBeNull();
    expect(parseClientMsg('{"t":"heal","hp":1e999}')).toBeNull();
  });

  it('parses blast/flame attacks and clamps their ranges independently', () => {
    const shot = (over: Record<string, unknown> = {}) =>
      parseClientMsg(JSON.stringify({ t: 'shot', o: [1, 2, 3], d: [0, 0, 2], dm: 2, rg: 52, ...over }));

    const blast = shot({ k: 2, rg: 999 });
    if (blast?.t !== 'shot') throw new Error('expected shot');
    expect(blast.k).toBe(2);
    expect(blast.rg).toBe(BLAST_RANGE_MAX);

    const flame = shot({ k: 3, rg: 999 });
    if (flame?.t !== 'shot') throw new Error('expected shot');
    expect(flame.k).toBe(3);
    expect(flame.rg).toBe(FLAME_RANGE_MAX);

    const unknown = shot({ k: 99, rg: 999 });
    if (unknown?.t !== 'shot') throw new Error('expected shot');
    expect(unknown.k).toBe(0);
    expect(unknown.rg).toBe(SHOT_RANGE_MAX);
  });
});
