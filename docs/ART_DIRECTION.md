# Art Direction — "Vice em Miniatura"

> Approved 2026-07-03. Every visual change — new models, palettes, lighting,
> UI, effects — must fit this direction. The color vocabulary is codified in
> **`js/core/palette.ts`**; take colors from there instead of inventing hex
> literals per file.

## The thesis

Tiny Theft Auto is a **living diorama** of a coastal city: sun-faded stucco by
day, Vice-City neon by night, seen through a retro film "camera" (grain,
scanlines, vignette, letterbox). The miniature look is the aesthetic, not a
technical limitation — the name says *Tiny*. Saturated color is reserved for
things that carry gameplay meaning.

## The six pillars

1. **Miniature, owned.** The world is a maquette: clean primitive geometry,
   chunky proportions, flat matte color per face (`matte.ts` Lambert). Detail
   comes from **silhouette and color, never from photo textures**. The
   "no binary image/model assets" rule in CLAUDE.md is also an *art* rule.
2. **Faded Miami by day, Vice at night.** Environment base is always muted
   (sun-faded `FACADES`, neutral `GROUND`). The day/night keyframe system
   (`js/world/daynight.ts`) carries the visual drama; at night the game turns
   Vice: lit windows, neon signs, warm lamps, headlights.
3. **Saturation = meaning.** Vivid color only on what matters: the hero car,
   mission markers, FX, storefront awnings. Rule of thumb 60-30-10 — muted
   base (60), medium-saturation fleet/wardrobe (30), rare neon accents (10).
4. **One palette from HUD to asphalt.** The UI's neon family (`--pink #ff2e88`,
   `--cyan`, `--gold`, `--cream` in `css/style.css`) is the same `NEON` family
   used in the world. `js/core/palette.ts` is the single source; the informal
   arrays (`facadePalette`, `carColors`, `shirtColors`, Mixamo look pools) now
   live there.
5. **Characters are figurines.** Flat per-region vertex colors on the shared
   Mixamo rig — no skin/cloth textures. NPC shirts deliberately share the
   vehicle paint family so people and traffic read as one world.
6. **Retro film on top.** The CSS overlay stack (grain, scanlines, vignette,
   cutscene letterbox) plus the global filmic grade (`REAL_DESAT`/`REAL_EXP`
   in `daynight.ts`) is what makes the game "gritty" — the world itself never
   chases realism.

## Working rules

**Do**
- Take every color from `js/core/palette.ts` (or add it there, in the right family).
- Detail buildings/props by silhouette: awnings, parapets, antennas, signs.
- Give night-time commerce emissive neon signage in the `NEON` family.
- Test new colors under the three skies — noon, sunset, night (`?tod=0.5 / 0.75 / 0`).
- Keep the filmic grade global and singular; don't add per-feature grades.

**Don't**
- No photo textures on any surface (facades included) — it breaks the maquette
  and the zero-binary-assets pillar. **Exception (owner-approved 2026-07-07):** all
  natural vegetation and rocks now come from the Quaternius *Stylized Nature MegaKit*
  (CC0) with its hand-painted stylized textures (loaded via glTF — see
  `assets/models/nature/kit.ts`). These are painterly, not photographic, so they read
  as diorama foliage; the rest of the world (buildings, vehicles, props) stays
  primitive + palette-flat. Don't extend the texture exception beyond nature.
- No saturated cartoon pastels in the environment (pool-cyan, lime green) —
  those are leftovers from the old look; pull them toward the muted base when touched.
- No saturated color without gameplay meaning.
- No per-feature style forks: interiors, rural zone and city share one base.
- No creeping realism (glossy PBR on statics, photo detail) without an explicit
  direction change agreed with the owner.

## Reference

- Palette: `js/core/palette.ts` (world) + `css/style.css` `:root` vars (UI).
- Lighting/mood: `js/world/daynight.ts` keyframes — the most sophisticated color
  system in the game; treat it as the protagonist.
- Full visual guide (swatches, ramps, rationale): the "Vice em Miniatura"
  artifact from the 2026-07-03 art-direction review.
