// Divinolândia navigation graph (src/js/world/divinolandia/nav.ts): the street network
// every moving thing in the town rides on.
import { describe, it, expect } from 'vitest';
import {
  nodes, edges, mainComp, nearestNode, nearestRoad, pointAt, lanePoint, findPath, pathPoints,
  randomRoadPoint, randomEdge, LaneRunner, laneOff, pavedRoad, dirtRoad, edgeBetween,
} from '@/world/divinolandia/nav.ts';
import { divData, DIV_OX, DIV_OZ } from '@/world/divinolandia/data.ts';
import { makeRng } from '@/core/rng.ts';

const L = divData.landmarks;
const W = (p: number[]): [number, number] => [p[0] + DIV_OX, p[1] + DIV_OZ];

describe('road graph', () => {
  it('splits the baked streets into a connected town network', () => {
    expect(edges.length).toBeGreaterThan(divData.roads.length);
    const inMain = nodes.filter(n => n.comp === mainComp).length;
    expect(inMain / nodes.length).toBeGreaterThan(0.8);
    for (const e of edges) {
      expect(e.len).toBeGreaterThan(0);
      const n = e.pts.length / 2;
      expect(Math.hypot(e.pts[0] - nodes[e.a].x, e.pts[1] - nodes[e.a].z)).toBeLessThan(0.2);
      expect(Math.hypot(e.pts[2 * n - 2] - nodes[e.b].x, e.pts[2 * n - 1] - nodes[e.b].z)).toBeLessThan(0.2);
    }
  });
  it('has both paved streets and dirt roads', () => {
    expect(edges.some(pavedRoad)).toBe(true);
    expect(edges.some(dirtRoad)).toBe(true);
  });
});

describe('snapping and positions', () => {
  it('finds the streets around the Matriz', () => {
    const [x, z] = W([L.matriz.cx, L.matriz.cz]);
    const n = nearestNode(x, z);
    expect(Math.hypot(nodes[n].x - x, nodes[n].z - z)).toBeLessThan(120);
    const r = nearestRoad(x, z, 80);
    expect(r).not.toBeNull();
    expect(r!.d).toBeLessThan(60);
  });
  it('pointAt walks the edge in both directions with unit headings', () => {
    const e = randomEdge(pavedRoad, makeRng(3).random);
    const E = edges[e];
    const a = pointAt(e, 0, 1), b = pointAt(e, 0, -1);
    expect(Math.hypot(a.x - nodes[E.a].x, a.z - nodes[E.a].z)).toBeLessThan(0.01);
    expect(Math.hypot(b.x - nodes[E.b].x, b.z - nodes[E.b].z)).toBeLessThan(0.01);
    expect(Math.hypot(a.dx, a.dz)).toBeCloseTo(1, 5);
  });
  it('the lane sits to the right of travel, opposite lanes on opposite sides', () => {
    const e = randomEdge(pavedRoad, makeRng(5).random), s = edges[e].len / 2;
    const c = pointAt(e, s, 1), r1 = lanePoint(e, s, 1, laneOff(e)), r2 = lanePoint(e, edges[e].len - s, -1, laneOff(e));
    const side = (p: { x: number; z: number }) => (p.x - c.x) * -c.dz + (p.z - c.z) * c.dx;
    expect(side(r1)).toBeGreaterThan(0);
    expect(side(r2)).toBeLessThan(0);
  });
});

describe('routing', () => {
  it('A* links the Matriz to the hospital on the hill along the streets', () => {
    const a = nearestNode(...W([L.matriz.cx, L.matriz.cz]));
    const b = nearestNode(...W(L.hospital));
    const p = findPath(a, b);
    expect(p.length).toBeGreaterThan(2);
    expect(p[0]).toBe(a);
    expect(p[p.length - 1]).toBe(b);
    for (let i = 0; i < p.length - 1; i++) expect(edgeBetween(p[i], p[i + 1])).toBeGreaterThanOrEqual(0);
    const pts = pathPoints(p);
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const straight = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z);
    expect(len).toBeGreaterThanOrEqual(straight * 0.99);
    expect(len).toBeLessThan(straight * 4);
  });
  it('random road points honour the distance band', () => {
    const rnd = makeRng(9).random, near = { x: DIV_OX, z: DIV_OZ };
    for (let i = 0; i < 20; i++) {
      const p = randomRoadPoint({ near, min: 150, max: 600, rnd });
      const d = Math.hypot(p.x - near.x, p.z - near.z);
      expect(d).toBeGreaterThanOrEqual(150);
      expect(d).toBeLessThanOrEqual(600);
    }
  });
});

describe('LaneRunner', () => {
  it('drives on and on through junctions without jumps', () => {
    const rnd = makeRng(11).random;
    const sp = randomRoadPoint({ f: pavedRoad, rnd });
    const r = new LaneRunner(sp.e, 1, sp.s, { off: laneOff, f: pavedRoad, rnd });
    let prev = r.at();
    let travelled = 0;
    for (let i = 0; i < 4000; i++) {
      r.advance(0.5);
      const p = r.at();
      const step = Math.hypot(p.x - prev.x, p.z - prev.z);
      expect(step).toBeLessThan(2.5);           // continuous: no teleports at junctions
      travelled += step;
      prev = { ...p };
    }
    expect(travelled).toBeGreaterThan(1500);
    expect(r.buf.length).toBeLessThan(2000);   // the consumed prefix is dropped
  });
});
