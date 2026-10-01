import { describe, it, expect } from 'vitest';
import { voiceKey } from '@/story/voice-key.ts';
import { ALL_LINES } from '@/story/dialogue.ts';

// The dubbed clips are named voiceKey(speaker, text) — the game looks them up by it and
// the dubbing tool (tools/voice) writes them under it. It must be stable and collision-free.

describe('voiceKey', () => {
  it('is FNV-1a over the UTF-8 bytes of "speaker|text" (8 hex chars, stable)', () => {
    expect(voiceKey('boss', 'Bem-vindo à Cidade do Pecado, meu amigo.')).toBe('df9e4995');
    expect(voiceKey('', '')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('changes with the speaker or any character of the text (accents included)', () => {
    const k = voiceKey('you', 'Quem tá falando?');
    expect(voiceKey('boss', 'Quem tá falando?')).not.toBe(k);
    expect(voiceKey('you', 'Quem ta falando?')).not.toBe(k);
  });

  it('gives every dubbed story line its own clip', () => {
    const keys = new Map<string, string>();
    for (const l of ALL_LINES) {
      if (!l.speaker) continue;
      const k = voiceKey(l.speaker, l.text), id = l.speaker + '|' + l.text;
      if (keys.has(k)) expect(keys.get(k)).toBe(id);
      keys.set(k, id);
    }
    expect(keys.size).toBeGreaterThan(40);
  });
});
