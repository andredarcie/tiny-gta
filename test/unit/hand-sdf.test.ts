// The first-person hand surface (src/assets/models/characters/hand-sdf.ts): a closed,
// reasonably dense mesh of human-hand size, mirrored for the left hand, with one nail per
// finger and the thumb.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildHandGeometry, type HandCurl } from '../../src/assets/models/characters/hand-sdf.ts';

const GRIP: HandCurl = {
  fingers: [[1.0, 1.45, .75], [1.08, 1.5, .75], [1.15, 1.52, .75], [1.22, 1.48, .7]],
  thumb: [[.45, .75, -.45], [.05, .65, -.75], [-.45, .35, -.8]],
};
const tone = new THREE.Color(0xd9a06b);
const box = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };

describe('hand surface', () => {
  const right = buildHandGeometry(1, GRIP, tone, 48);
  const left = buildHandGeometry(-1, GRIP, tone, 48);

  it('is a dense, painted triangle mesh', () => {
    const n = right.skin.attributes.position.count;
    expect(n % 3).toBe(0);
    expect(n / 3).toBeGreaterThan(3000);
    expect(right.skin.attributes.color.count).toBe(n);
  });

  it('is human-hand sized (wrist to the curled fingers ~10–18 cm)', () => {
    const s = box(right.skin).getSize(new THREE.Vector3());
    expect(s.y).toBeGreaterThan(.1);
    expect(s.y).toBeLessThan(.18);
    expect(s.x).toBeGreaterThan(.07);
    expect(s.x).toBeLessThan(.13);
  });

  it('mirrors for the left hand (thumb on the other edge)', () => {
    const r = box(right.skin), l = box(left.skin);
    expect(l.min.x).toBeCloseTo(-r.max.x, 2);
    expect(l.max.x).toBeCloseTo(-r.min.x, 2);
  });

  it('has a nail on each of the five fingertips', () => {
    // each nail is the same shallow cap: the nail mesh holds five of them
    const per = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * .5).toNonIndexed().attributes.position.count;
    expect(right.nails.attributes.position.count).toBe(per * 5);
  });
});
