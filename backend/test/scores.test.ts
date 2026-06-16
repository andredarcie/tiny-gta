import { describe, it, expect } from 'vitest';
import * as C from '../lib/scores.js';

describe('sanitizeName', () => {
  it('uppercases, strips invalid chars, collapses spaces, trims, slices to 12', () => {
    expect(C.sanitizeName('  john   doe!! ')).toBe('JOHN DOE');
    expect(C.sanitizeName('abcdefghijklmnop')).toBe('ABCDEFGHIJKL');
  });
  it('rejects empty, junk-only and profanity', () => {
    expect(C.sanitizeName('')).toBeNull();
    expect(C.sanitizeName('!!!')).toBeNull();
    expect(C.sanitizeName('FUCK')).toBeNull();
  });
  it('rejects non-strings', () => {
    expect(C.sanitizeName(123)).toBeNull();
    expect(C.sanitizeName(null)).toBeNull();
  });
});

describe('sanitizePassword', () => {
  it('accepts 4..64 chars', () => {
    expect(C.sanitizePassword('1234')).toBe('1234');
    expect(C.sanitizePassword('a'.repeat(64))).toHaveLength(64);
  });
  it('rejects too short / too long / non-string', () => {
    expect(C.sanitizePassword('123')).toBeNull();
    expect(C.sanitizePassword('a'.repeat(65))).toBeNull();
    expect(C.sanitizePassword(1234)).toBeNull();
  });
});

describe('sanitizePid', () => {
  it('accepts a canonical uuid (lowercased)', () => {
    expect(C.sanitizePid('11111111-1111-4111-8111-111111111111')).toBe('11111111-1111-4111-8111-111111111111');
    expect(C.sanitizePid('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA')).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
  it('rejects junk', () => {
    expect(C.sanitizePid('not-a-uuid')).toBeNull();
    expect(C.sanitizePid('')).toBeNull();
    expect(C.sanitizePid(42)).toBeNull();
  });
});

describe('sanitizeGame', () => {
  it('accepts known ids (case-insensitive), rejects the rest', () => {
    expect(C.sanitizeGame('taxi')).toBe('taxi');
    expect(C.sanitizeGame('TAXI')).toBe('taxi');
    expect(C.sanitizeGame('nope')).toBeNull();
    expect(C.sanitizeGame(5)).toBeNull();
  });
});

describe('sanitizeSave', () => {
  it('clamps money into [0, maxMoney]', () => {
    expect(C.sanitizeSave({ money: 999999 }, 1000)?.money).toBe(1000);
    expect(C.sanitizeSave({ money: -5 }, 1000)?.money).toBe(0);
    expect(C.sanitizeSave({ money: 'x' }, 1000)?.money).toBe(0);
  });
  it('preserves t, name and known slots', () => {
    expect(C.sanitizeSave({ money: 50, t: 123, name: 'JOE', weapons: [1, 2] }, 1000))
      .toMatchObject({ money: 50, t: 123, name: 'JOE', weapons: [1, 2] });
  });
  it('rejects non-objects', () => {
    expect(C.sanitizeSave(null, 1000)).toBeNull();
    expect(C.sanitizeSave([1, 2], 1000)).toBeNull();
    expect(C.sanitizeSave('x', 1000)).toBeNull();
  });
  it('rejects blobs that serialize over 8KB', () => {
    const many: Record<string, unknown> = { money: 1 };
    for (let i = 0; i < 32; i++) {
      const sub: Record<string, string> = {};
      for (let j = 0; j < 32; j++) sub['f' + j] = 'y'.repeat(32);
      many['k' + i] = sub;
    }
    expect(C.sanitizeSave(many, 1000)).toBeNull();
  });
});

describe('parseSession', () => {
  it('parses object form', () => {
    expect(C.parseSession({ at: 5, base: 10, pid: 'p', name: 'N' })).toEqual({ at: 5, base: 10, pid: 'p', name: 'N', secret: null });
  });
  it('parses legacy numeric string (timestamp only)', () => {
    expect(C.parseSession('123')).toEqual({ at: 123, base: 0, pid: null, name: null, secret: null });
  });
  it('parses JSON string form', () => {
    expect(C.parseSession('{"at":7,"base":3}')).toEqual({ at: 7, base: 3, pid: null, name: null, secret: null });
  });
  it('parses the secret when present', () => {
    expect(C.parseSession({ at: 1, base: 0, secret: 'abc' })?.secret).toBe('abc');
  });
  it('returns null for null and clamps base to >= 0', () => {
    expect(C.parseSession(null)).toBeNull();
    expect(C.parseSession({ at: 1, base: -9 })?.base).toBe(0);
  });
});

describe('maxPlausibleMoney', () => {
  it('is base + per-second * seconds', () => {
    expect(C.maxPlausibleMoney(0)).toBe(C.BASE_MONEY);
    expect(C.maxPlausibleMoney(10)).toBe(C.BASE_MONEY + C.MONEY_PER_SEC * 10);
  });
});

describe('miniGameRating', () => {
  it('is 0 with no plays', () => {
    expect(C.miniGameRating({ plays: 0 })).toBe(0);
    expect(C.miniGameRating()).toBe(0);
  });
  it('rewards a higher win rate', () => {
    expect(C.miniGameRating({ plays: 10, wins: 9, earned: 1000 }))
      .toBeGreaterThan(C.miniGameRating({ plays: 10, wins: 1, earned: 1000 }));
  });
  it('rewards a higher average earn', () => {
    expect(C.miniGameRating({ plays: 10, wins: 5, earned: 5000 }))
      .toBeGreaterThan(C.miniGameRating({ plays: 10, wins: 5, earned: 1000 }));
  });
});

describe('key builders', () => {
  it('build the expected redis keys', () => {
    expect(C.saveKey('PID')).toBe('tinygta:save:PID');
    expect(C.saveMember('PID', 'NAME')).toBe('PID|NAME');
    expect(C.acctKey('JOE')).toBe('tinygta:acct:JOE');
    expect(C.pidAcctKey('PID')).toBe('tinygta:pidacct:PID');
    expect(C.mgBoardKey('taxi')).toBe('tinygta:mg:taxi');
    expect(C.mgPlayerKey('taxi', 'JOE')).toBe('tinygta:mg:taxi:p:JOE');
  });
});
