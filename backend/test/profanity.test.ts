import { describe, it, expect } from 'vitest';
import { hasProfanity } from '../lib/profanity.js';

describe('hasProfanity', () => {
  it('flags clear profanity, including leet/evasion', () => {
    expect(hasProfanity('FUCK')).toBe(true);
    expect(hasProfanity('xxfuckxx')).toBe(true);
    expect(hasProfanity('HLTLER')).toBe(true);   // hitler with L instead of I
    expect(hasProfanity('caralho')).toBe(true);
  });
  it('flags short/ambiguous terms only as a whole word', () => {
    expect(hasProfanity('CU')).toBe(true);
    expect(hasProfanity('CU ROXO')).toBe(true);
  });
  it('does NOT flag clean names that merely contain a fragment', () => {
    expect(hasProfanity('CURITIBA')).toBe(false);
    expect(hasProfanity('PAULO')).toBe(false);
    expect(hasProfanity('')).toBe(false);
  });
});
