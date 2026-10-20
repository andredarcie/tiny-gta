import type {CineLine} from '@/story/cutscene.ts';

// ============================================================================
// THE STORY'S DIALOGUE — every line spoken in the story's cut-scenes, as plain data
// (no THREE, no DOM), so the dubbing tool can read it (tools/voice/export-lines.ts →
// `npm run voice`). Each line carries a `speaker` id; its recorded voice clip, when one
// has been generated, lives in src/assets/audio/voice/ (see js/story/voices.ts) and the
// cut-scene plays it instead of the synth blips (`voice` stays as the fallback).
// Brazilian Portuguese on purpose (user request) — the rest of the game is English.
//
// The main story is being rewritten from scratch for Divinolândia (the old pay-phone
// chain was set on the retired grid map), so there are no scenes yet.
// ============================================================================

export const SCENES: Record<string,CineLine[]>={};
/** Every dubbed line of the story, for the dubbing tool. */
export const ALL_LINES: CineLine[]=Object.values(SCENES).flat();
