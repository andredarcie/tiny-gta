// The car radio's music (src/js/audio/radio): every station plays an endless programme of
// its songs and vinheta, rendered as clean audio (finite, never clipping, never silent), its
// instruments in tune, its songs announced as they begin.
import { describe, it, expect } from 'vitest';
import { RadioStream, stationSongs } from '../../src/js/audio/radio/engine.ts';
import { pluck, sanfona, setRate, rng, mtof, type StringKind } from '../../src/js/audio/radio/dsp.ts';

const SR = 22050;
function f0(x: Float32Array, lo: number, hi: number): number {
  const a = Math.floor(SR * .05), n = 2048, seg = x.subarray(a, a + n);
  const c = (l: number) => { let s = 0; for (let i = 0; i < n - l; i++) s += seg[i] * seg[i + l]; return s; };
  let best = -Infinity, bl = 0;
  for (let lag = Math.floor(SR / hi); lag <= Math.ceil(SR / lo); lag++) { const s = c(lag); if (s > best) { best = s; bl = lag; } }
  const y0 = c(bl - 1), y1 = c(bl), y2 = c(bl + 1);
  return SR / (bl + (y0 - y2) / (2 * (y0 - 2 * y1 + y2)));
}

describe('the radio stations', () => {
  for (const st of ['sertao', 'forro', 'pagode', 'batidao']) {
    it(`${st}: plays clean audio, song after song, with its vinheta between them`, () => {
      const songs = stationSongs(st);
      expect(songs.length).toBeGreaterThanOrEqual(3);
      const s = new RadioStream(st, SR, 3, { song: 0 });
      const titles: string[] = [];
      let n = 0, peak = 0, sq = 0, bad = 0;
      // the whole first song, the vinheta and the start of the next one
      const first = songs[0], len = first.bars * first.beats * 60 / first.bpm + 12;
      while (n < len * SR) {
        const c = s.next(2);
        for (const e of c.events) titles.push(e.jingle ? 'JINGLE' : e.title);
        for (let i = 0; i < c.l.length; i++) { const v = c.l[i], w = c.r[i]; if (!Number.isFinite(v) || !Number.isFinite(w)) bad++; peak = Math.max(peak, Math.abs(v), Math.abs(w)); sq += v * v; }
        n += c.l.length;
      }
      expect(bad).toBe(0);
      expect(peak).toBeLessThan(1);
      expect(Math.sqrt(sq / n)).toBeGreaterThan(.05);
      expect(titles[0]).toBe(first.title);
      expect(titles[1]).toBe('JINGLE');
      expect(titles.length).toBeGreaterThanOrEqual(3);
      expect(titles[2]).not.toBe(first.title);
    });
  }
});

describe('the instruments', () => {
  it('are in tune (plucked strings and the sanfona within 5 cents)', () => {
    setRate(SR);
    const off: string[] = [];
    for (const k of ['violao', 'viola', 'cavaco', 'banjo', 'harpa'] as StringKind[]) for (const m of [55, 64, 72, 81]) {
      const t = mtof(m), c = 1200 * Math.log2(f0(pluck(k, m, .3, rng(1)), t * .7, t * 1.4) / t);
      if (Math.abs(c) > 5) off.push(`${k} ${m} ${c.toFixed(1)}`);
    }
    for (const m of [60, 72]) {
      const t = mtof(m), c = 1200 * Math.log2(f0(sanfona(m, .3, rng(1), { reeds: 'doce' }), t * .7, t * 1.4) / t);
      if (Math.abs(c) > 5) off.push(`sanfona ${m} ${c.toFixed(1)}`);
    }
    expect(off).toEqual([]);
  });
});
