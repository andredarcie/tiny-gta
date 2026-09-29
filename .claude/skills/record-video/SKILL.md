---
name: record-video
description: Film a short VERTICAL promo video of Tiny Crime gameplay (TikTok / Instagram Reels / WhatsApp) — 9:16, 30 fps, small file, eye-catching cover, captions, hard cuts. Use whenever the user asks to record/make/film a video ("grave um vídeo", "faz um vídeo mostrando…", "video of the new feature", "vídeo pra divulgar"), for any feature or scene of the game.
---

# Recording a short promo video

Every video is filmed from the **real game** (headed Chromium driven by Playwright) and
edited automatically. The structure already exists — reuse it, don't reinvent:

| Piece | What it does |
|---|---|
| `test/video/director.ts` | Filming API: boots the game for video (portrait 900×1600, no FPS counter, police radio subtitle hidden), records **only inside `clip()` blocks** (so walking/setup between clips is cut automatically), camera/walk/weapon/farm helpers, `cover()` marks the cover frame. |
| `test/video/scenes/<name>.video.ts` | One scene script per video (examples: `gore.video.ts`, `weed-farm.video.ts`). |
| `test/video/make-video.mjs` | The editor: clips (hard cuts) + bold captions → cover (first frame) → end card → 720×1280, 30 fps, H.264 CRF 24 + silent AAC, `+faststart`. Also writes `cover.jpg`. |
| `playwright.video.config.ts` | Separate config so videos never run in `npm test`. |
| `npm run video -- <scene>` | Films + edits. `--edit-only` re-edits the last capture (e.g. after changing captions/cover in `capture.json`). |

Output: `output/video/<scene>/<scene>.mp4` + `output/video/<scene>/cover.jpg` (git-ignored).

## The spec every video must meet
- **Vertical 9:16, 720×1280, 30 fps** — watched on a phone held upright.
- **Short: 12–30 s total** (TikTok/Reels sweet spot ~15–25 s). Only the key actions; **cut** all walking/setup (just don't wrap it in `clip()`).
- **Light: ~1–3 MB** (WhatsApp-friendly), still sharp (CRF 24 — don't go above ~27 or it gets mushy).
- **Cover = first frame, never black**: the most dramatic moment of the video + big title. Mark it with `d.cover()` inside the clip where it happens (the blast, the ripe plant, the car mid-air…). No fade-in at the start.
- **One short caption per clip** (2–6 words, English like the game's text, it's word-wrapped big and centred). Tell the story: *what you do → what happens*.
- Hard cuts between clips. The assembler warns if > ~30 s or > 8 MB.

## Workflow
1. **Plan the beats** (4–9 clips, 1.2–3 s each): hook first, payoff last. Pick the cover moment.
2. **Write `test/video/scenes/<name>.video.ts`** (copy an existing scene):
   ```ts
   const d = await Director.start(page, '<name>', { title: '2-4 WORDS', subtitle: 'one line', outro: 'TINY CRIME', tod: .42 });
   // setup between clips is NOT filmed: teleport, give items, walk…
   await d.clip('beat', 'Short caption', async () => { /* the action */ });
   d.cover();            // inside the clip that holds the best frame
   await d.finish();
   ```
   Helpers: `teleport(p, lookAt)`, `turnTo(p, ms)` (smooth pan), `walkTo(p)` (real input, DOOM speed), `hold(code, ms)`, `interact()` (E), `attack()`, `giveGun()`, `equip(id)`, `aimAtNpc(dist, 'head'|'body'|'legs')`, `farm(cmd)` / `farmAct()`, `snap()`, `wait(ms)`. Anything else the scene needs goes through `window.__test` (add a dev-only hook in `src/js/core/main.ts` if missing — never a game-side cheat).
   Film **close** to the subject (the phone screen is small): ~3 m for people, frame the action in the centre.
3. **Run `npm run video -- <name>`** (headed; the dev server is reused or started).
4. **Review before sending**: open `cover.jpg`, and pull a contact strip of frames
   (`ffmpeg -ss <t> -i <mp4> -frames:v 1 …` at 6–9 times, `hstack`) — check the subject is visible and big, captions readable, nothing broken. Re-film or fix the scene if not (move `d.cover()`, get closer, tighten clips). To change only the cover/captions, edit `capture.json` and run with `--edit-only`.
5. **Send it** with `SendUserFile` (the MP4, and the cover if useful), and report length/size in one line. Commit the scene script (not the output).

## Gotchas
- The window must be ≥ 900 px wide or the game switches to its mobile layout (touch buttons + "rotate your phone" block) — keep the video config at 900×1600.
- The first-person FOV widens automatically in portrait (`portraitFov` in `src/js/actors/player.ts`), so the view doesn't become a tunnel.
- DOOM movement is fast: `walkTo` releases W early and snaps onto the mark — keep walks between clips.
- Firing a gun raises the wanted level; police can arrive in later clips. Film calm beats first or keep violent scenes short.
- Captions use `C:/Windows/Fonts/impact.ttf` (falls back to DejaVu Bold elsewhere). ffmpeg must be on the PATH.
- The screencast has no audio: videos carry a silent track (the user adds music on the platform).
