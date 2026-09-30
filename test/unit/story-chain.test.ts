import { describe, it, expect } from 'vitest';
import { STAGES, sanitizeStorySave } from '@/story/chain.ts';

// The story's save slot (js/story/chain.ts): a restored blob must never put the mission
// chain into an impossible state — unknown stages start fresh, bodies/graves are only
// kept for the stages that use them, and garbage entries are dropped or neutralised.

describe('story chain — stages', () => {
  it('runs call1 → camp → call2 → burial → done', () => {
    expect([...STAGES]).toEqual(['call1','camp','call2','burial','done']);
  });
});

describe('story chain — sanitizeStorySave', () => {
  it('returns null for nothing / junk / an unknown stage', () => {
    expect(sanitizeStorySave(null,6)).toBeNull();
    expect(sanitizeStorySave('call2',6)).toBeNull();
    expect(sanitizeStorySave({stage:'prologue'},6)).toBeNull();
  });

  it('keeps a bare stage with empty bodies/graves', () => {
    expect(sanitizeStorySave({stage:'camp'},6)).toEqual({stage:'camp',bodies:[],graves:[]});
  });

  it('keeps body positions only while they lie at the camp (call2 / burial)', () => {
    const bodies=[{x:1,z:2},{x:3,z:4}];
    expect(sanitizeStorySave({stage:'call2',bodies},6)!.bodies).toEqual(bodies);
    expect(sanitizeStorySave({stage:'camp',bodies},6)!.bodies).toEqual([]);
    expect(sanitizeStorySave({stage:'done',bodies},6)!.bodies).toEqual([]);
  });

  it('null marks a buried body — only meaningful during the burial', () => {
    expect(sanitizeStorySave({stage:'burial',bodies:[null,{x:1,z:1}]},6)!.bodies).toEqual([null,{x:1,z:1}]);
    const c2=sanitizeStorySave({stage:'call2',bodies:[null]},6)!.bodies[0]!;
    expect(Number.isNaN(c2.x)).toBe(true);                 // unknown → back to its post
  });

  it('neutralises broken body entries and caps them at the camp size', () => {
    const s=sanitizeStorySave({stage:'burial',bodies:[{x:'a',z:1},7,{x:1,z:2},{x:3,z:3}]},3)!;
    expect(s.bodies.length).toBe(3);
    expect(Number.isNaN(s.bodies[0]!.x)).toBe(true);
    expect(Number.isNaN(s.bodies[1]!.x)).toBe(true);
    expect(s.bodies[2]).toEqual({x:1,z:2});
  });

  it('keeps valid graves for burial/done, defaulting the yaw', () => {
    const graves=[{x:1,z:2,ry:.5},{x:3,z:4},{x:'bad',z:0},null];
    expect(sanitizeStorySave({stage:'done',graves},6)!.graves).toEqual([{x:1,z:2,ry:.5},{x:3,z:4,ry:0}]);
    expect(sanitizeStorySave({stage:'call2',graves},6)!.graves).toEqual([]);
  });
});
