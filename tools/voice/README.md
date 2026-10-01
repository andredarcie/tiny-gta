# Dubbing — the story's voices (pt-BR)

The story's cut-scene lines are dubbed with voices made in **VoiceStudio**
(https://github.com/debpalash/VoiceStudio — a local, offline "ElevenLabs alternative"
desktop app built to be driven by Claude Code: local HTTP API + MCP server). Claude Code
only calls its API; the app runs the speech model on this machine's GPU.

Engine: **VoxCPM2** (OpenBMB, Apache-2.0 — commercial use OK, speaks Portuguese, designs
a voice from a text description). NOT VoiceStudio's default engine OmniVoice: its weights
are CC-BY-NC (non-commercial) and the game is sold on itch.io.

## How it works
1. `tools/voice/export-lines.ts` reads every line of `src/js/story/dialogue.ts` (each has a
   `speaker` id and a scene) → `tools/voice/lines.json`, keyed by
   `voiceKey(speaker, text)` (`src/js/story/voice-key.ts`).
2. `tools/voice/dub.mjs` (Node, talks to VoiceStudio at http://localhost:3900):
   - **designs** each voice of `voices.json` once from its description →
     `tools/voice/refs/<speaker>.wav` (committed: it *is* the character's voice);
   - **clones** that reference for each line, so a character sounds the same everywhere;
   - generates all pending lines first, THEN transcribes them with VoiceStudio's ASR and
     re-takes (another seed, up to 3 rounds) the clips whose words don't match the script
     — never both at once: on a 6 GB GPU loading the recogniser evicts the TTS engine;
   - writes `src/assets/audio/voice/<key>.mp3` (mono, loudness-normalised, ffmpeg).
3. In game, `src/js/story/voices.ts` plays the clip when its line comes up (the boss
   through a telephone filter) and the subtitle types along with it. Lines without a clip
   keep the synth blips.

## Use
Start the VoiceStudio app first (installed per-user:
`%LOCALAPPDATA%\Programs\VoiceStudio\VoiceStudio.exe`; the VoxCPM2 engine is installed in
it). Then:
```bash
npm run voice -- --scene call1 --scene call2   # dub one or more scenes (see SCENES in dialogue.ts)
npm run voice                                  # dub every line that has no clip yet
npm run voice -- --redo boss                   # re-dub a speaker's lines
npm run voice -- --recast boss                 # re-design that voice, then re-dub
npm run voice -- --demo                        # one sample per voice in tools/voice/demo/
```
Speed on an RTX 3060 6 GB: ~10–55 s per line (VoxCPM2 wants ~8 GB); the 18 lines of
mission 1 took 12 min. The word-match % printed at the end is from a small recogniser
(whisper-base): short, colloquial lines ("Quem tá falando?") often score low even when fine
— listen to the flagged ones before re-taking.

To add a character: describe it in `voices.json` (English description asking for
Brazilian Portuguese works best), use its id as `speaker` in `dialogue.ts`, run
`npm run voice`.
