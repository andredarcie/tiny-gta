import { describe, it, expect } from 'vitest';
import { regionAt, mapRegionLabels } from '@/world/regions.ts';
import { MOUNT_X, TOWN_CX, ISLAND_CX, ISLAND_CZ } from '@/core/constants.ts';

describe('regionAt — named world regions', () => {
  it('names the city centre and the four corner bairros', () => {
    expect(regionAt(0, 0)).toBe('Downtown');
    expect(regionAt(-130, -130)).toBe('Rivergate');     // NW
    expect(regionAt(130, -130)).toBe('The Foundry');    // NE
    expect(regionAt(-130, 130)).toBe('Oakridge');       // SW
    expect(regionAt(130, 130)).toBe('Sunset Bluffs');   // SE
  });

  it('names the rural landmarks and the island', () => {
    expect(regionAt(200, 0)).toBe('Meadowbrook');       // pastoral corridor by the city
    expect(regionAt(MOUNT_X, 0)).toBe('Mount Vesper');  // mountain overlook
    expect(regionAt(TOWN_CX, 0)).toBe('Pine Hollow');   // village
    expect(regionAt(ISLAND_CX, ISLAND_CZ)).toBe('Paradise Isle');
  });

  it('returns null over open sea', () => {
    expect(regionAt(1000, 1000)).toBeNull();
    expect(regionAt(0, 1000)).toBeNull();
  });

  it('every map label sits inside the region it names (round-trip)', () => {
    for (const r of mapRegionLabels) expect(regionAt(r.cx, r.cz)).toBe(r.name);
  });

  it('covers the whole city block grid with a bairro name', () => {
    for (let x = -170; x <= 170; x += 20)
      for (let z = -170; z <= 170; z += 20)
        expect(typeof regionAt(x, z)).toBe('string');
  });
});
