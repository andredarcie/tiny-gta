# Art Direction — "Divinolândia de Verdade" (photoreal)

> Changed 2026-10-21 at the owner's request ("tire esse visual cartoon… direção de arte foto
> realista fiel à realidade"), replacing "Vice em Miniatura" (2026-07-03). Every visual
> change — models, palettes, lighting, effects — must fit this direction. The colour
> vocabulary lives in **`src/js/core/palette.ts`**; take colours from there.

## The thesis

The game should look like the real Divinolândia/SP on a camera: the colours, light and
materials of the town's own photos. Recent photos are the reference, not taste — Google
Street View (nov/2024) frames and the Google Maps satellite, kept locally under
`docs/divinolandia/referencias-streetview/` and `referencias-satelite/` (fetched by
`tools/capture-streetview.ts` and `docs/divinolandia/scripts/fetch-satelite.py`).

## The pillars

1. **Measured colour.** A palette entry is the material's albedo as the photos show it:
   limewashed white and cream walls, aged dark clay tiles, sun-bleached grey asphalt, pale
   rosy terra-roxa dirt, olive pasture, dark broadleaf canopies. New colours are sampled
   from the reference photos (median of a patch), never invented. Saturation appears only
   where the real thing is saturated (a sign, a car's paint, a flowering ipê or resedá).
2. **Real light.** `src/js/world/daynight.ts`: a strong white sun against a weak sky fill
   (crisp shadows, solid form), a clear sky that pales to a hazy blue-grey horizon, the same
   haze as the fog so distant serras go blue-grey, soft low-saturation dawn and dusk, a
   moonlit blue night. AgX tone mapping (`engine.ts`) — the photographic curve.
3. **Material detail.** Surfaces carry their material's texture: ground (grass tufts, bare
   patches, pebbles), asphalt (aggregate, repairs, cracks), dirt (dust, stones), plaster,
   aged roof tiles with lichen, setts, sidewalk slabs, leaf clusters. They are painted in
   code (`src/assets/models/divinolandia/texturas.ts`) — the game still ships no image or
   model files. Near-white "multiply" maps keep the palette in charge of the colour.
4. **Organic shapes where nature is organic.** Tree crowns, hedges and coffee rows are
   lumpy leaf masses with smooth shading and the leaf texture (`copa.ts`), never faceted
   low-poly balls (`flatShading` is for genuinely flat things only).
5. **Clean, honest image.** No film grain, scanlines, vignette or stylised grading; bloom
   only for real light sources at night. The global grade (`REAL_DESAT`/`REAL_EXP`) stays
   a light touch over keyframes that are already measured.

## Working rules

**Do**
- Sample colours from the reference photos; add them to `palette.ts` with the measured value
  in a comment when useful.
- Check every change under the three skies — noon, sunset, night (`?tod=0.5 / 0.75 / 0`):
  `SHOTS_LABEL=<name> npx playwright test test/visual-shots.spec.ts` (headed).
- Give a surface its material texture (procedural, in code) instead of a flat fill.

**Don't**
- No candy colours: saturated greens, orange dirt, pool cyan, pastel sky gradients.
- No faceted low-poly vegetation, no big flat sun discs or cartoon sprites.
- No image/model files loaded at runtime (the zero-binary-assets rule of CLAUDE.md stands).
- No per-feature grades or style forks.

## Known gaps (next steps)

Characters are still the box dolls and vehicles the simple models — their shapes, not the
colours, are what still reads as stylised.

## HUD, menus and type — "interior de SP" (2026-10-21)

The interface speaks the signage of a small paulista town, not neon:
- **Blue enamel street plate** (`--azul`, white inner border, rounded): the status stack
  (clock, money, health), the location label over the radar (it shows street names), the
  pause title, the "CITY" plate of the title logo; the radar rim is the same blue.
- **Green road sign** (`--verde`): the speedometer.
- **Hand-painted shop lettering**: Alfa Slab One in limewash white with a terra-roxa drop
  shadow for messages, big texts, buttons and "DIVINO" on the title; buttons are lottery-shop
  yellow (`--amarelo`) or cal white plates.
- **Road-sign lettering**: Barlow Condensed for every reading and label (tabular figures).
  Yellowtail stays for painted script (the car's name).
- No glows: hard painted shadows only. Colours live in `src/css/style.css` `:root` (the old
  names `--pink/--cyan/--gold/--cream` now hold terra / plate blue / yellow / cal).
- Title screen: "Divino City" over an inline-SVG view of the town under the serra
  (index.html — still no image files).
