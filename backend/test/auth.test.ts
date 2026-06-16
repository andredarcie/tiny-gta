import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, scoreSig, safeEqualHex } from '../lib/auth.js';

describe('password hashing', () => {
  it('round-trips a correct password', () => {
    const { salt, hash } = hashPassword('hunter2');
    expect(verifyPassword('hunter2', salt, hash)).toBe(true);
  });
  it('rejects a wrong password', () => {
    const { salt, hash } = hashPassword('hunter2');
    expect(verifyPassword('nope', salt, hash)).toBe(false);
  });
  it('uses a random salt (same password -> different hash)', () => {
    expect(hashPassword('x').hash).not.toBe(hashPassword('x').hash);
  });
  it('rejects a tampered/invalid stored hash and non-string inputs', () => {
    const { salt } = hashPassword('x');
    expect(verifyPassword('x', salt, 'deadbeef')).toBe(false); // wrong length
    expect(verifyPassword('x', salt, '')).toBe(false);
    expect(verifyPassword(5, salt, 'aa')).toBe(false);
    expect(verifyPassword('x', null, 'aa')).toBe(false);
  });
});

describe('scoreSig', () => {
  it('is deterministic and depends on secret, money and t', () => {
    expect(scoreSig('s', 100, 5)).toBe(scoreSig('s', 100, 5));
    expect(scoreSig('s', 100, 5)).not.toBe(scoreSig('s', 101, 5));
    expect(scoreSig('s', 100, 5)).not.toBe(scoreSig('s', 100, 6));
    expect(scoreSig('s', 100, 5)).not.toBe(scoreSig('other', 100, 5));
  });
});

describe('safeEqualHex', () => {
  it('is true only for identical, equal-length, non-empty hex', () => {
    expect(safeEqualHex('aabb', 'aabb')).toBe(true);
    expect(safeEqualHex('aabb', 'aacc')).toBe(false);
    expect(safeEqualHex('aa', 'aabb')).toBe(false);
    expect(safeEqualHex('', '')).toBe(false);
    expect(safeEqualHex(null, 'aa')).toBe(false);
  });
});
