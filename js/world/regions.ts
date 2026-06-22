// Named regions of the world — city bairros (neighborhoods) + rural areas + the
// island. Single source of truth for BOTH the "you are here" location banner
// (regionAt) and the labels drawn on the full map (mapRegionLabels). The map has
// always been split into a squared city, an eastern rural peninsula and a far
// island; this module just gives each part a name.
import {
  HALF, RURAL_TIP, MOUNT_X, MOUNT_R, TOWN_CX, HILL_X1, RURAL_HALF,
  ISLAND_CX, ISLAND_CZ, ISLAND_MAXR, isLand, clamp,
} from '@/core/constants.ts';

// A region name anchored on the full map. `kind` only drives the label styling
// (warm cream for the built-up city, cool blue for the open countryside).
export interface RegionLabel { name: string; cx: number; cz: number; kind: 'city' | 'rural'; }

// City bairros: a 3×3 grid over the 8×8 block city. Row 0 = north (−z, top of the
// north-up map), col 0 = west (−x). Laid out by compass so the names read right
// against the radar/map orientation.
const CITY_NAMES: readonly string[][] = [
  ['Rivergate', 'Harborview', 'The Foundry'], // north
  ['Westside',  'Downtown',   'Eastside'],     // mid
  ['Oakridge',  'Southbay',   'Sunset Bluffs'],// south
];
const CITY_DIV = 2 * HALF / 3; // width/height of one third of the city (~117m)

// Returns the name of the region containing world (x,z), or null over open sea.
// Cheap enough to call once per frame for the location HUD (a couple of compares
// plus one isLand for the city, which is itself a handful of trig ops).
export function regionAt(x: number, z: number): string | null {
  // Island first (far west, isolated in open sea).
  if (x < -300) {
    const dx = x - ISLAND_CX, dz = z - ISLAND_CZ;
    if (dx * dx + dz * dz < ISLAND_MAXR * ISLAND_MAXR) return 'Paradise Isle';
  }
  // Rural peninsula (east of the city junction). Small radial zones — the
  // mountain overlook and the village — win over the broad x-bands they sit in.
  if (x >= HALF && x <= RURAL_TIP + 24 && Math.abs(z) <= RURAL_HALF + 30) {
    if (Math.hypot(x - MOUNT_X, z) < MOUNT_R) return 'Mount Vesper';
    if (Math.abs(x - TOWN_CX) < 60 && Math.abs(z) < 60) return 'Pine Hollow';
    if (x < HILL_X1 + 20) return 'Meadowbrook';        // pastoral corridor + rolling hills
    if (x < MOUNT_X - MOUNT_R) return 'Drycreek Farms'; // farmland before the mountain
    if (x < TOWN_CX - 50) return 'Whispering Pines';    // woods around/after the mountain
    return 'Pine Hollow';
  }
  // City + its beaches: any land west of the junction that isn't the island. The
  // 3×3 grid is clamped, so the sand ring around the blocks inherits the nearest
  // bairro's name instead of reading as unnamed sea.
  if (x < HALF + 4 && isLand(x, z)) {
    const col = clamp(Math.floor((x + HALF) / CITY_DIV), 0, 2);
    const row = clamp(Math.floor((z + HALF) / CITY_DIV), 0, 2);
    return CITY_NAMES[row][col];
  }
  return null; // open sea
}

// Label anchors drawn on the full map (M). The city names sit at the centre of
// each grid third; the rural names are hand-placed clear of the central road,
// the mountain ellipse and the village buildings.
export const mapRegionLabels: RegionLabel[] = [];
for (let row = 0; row < 3; row++)
  for (let col = 0; col < 3; col++)
    mapRegionLabels.push({
      name: CITY_NAMES[row][col],
      cx: -HALF + (col + 0.5) * CITY_DIV,
      cz: -HALF + (row + 0.5) * CITY_DIV,
      kind: 'city',
    });
mapRegionLabels.push(
  { name: 'Meadowbrook',      cx: 262,     cz: -58, kind: 'rural' },
  { name: 'Drycreek Farms',   cx: 400,     cz:  62, kind: 'rural' },
  { name: 'Mount Vesper',     cx: MOUNT_X, cz:   0, kind: 'rural' },
  { name: 'Whispering Pines', cx: 586,     cz: -80, kind: 'rural' },
  { name: 'Pine Hollow',      cx: TOWN_CX, cz: -56, kind: 'rural' },
);
