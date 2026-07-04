// Server-side movement plausibility — the first authority the server takes
// over movement (full input-driven simulation comes later; see the plan).
// Pure and terrain-aware: it walks the SAME groundHeight the client renders.
//
// Philosophy: the game itself teleports players legitimately (hospital/prison
// admits, race staging, interior doors), so hard rejection would break real
// play. Instead each session has a TELEPORT BUDGET: one arbitrarily large jump
// per TELEPORT_COOLDOWN_MS; anything faster than the mode's speed cap outside
// that budget is an impossible SUSTAINED speed → dropped. A speed-hacker
// degrades into one hop per cooldown; honest players never notice.
import { groundHeight } from './terrain.ts';

/** Horizontal speed caps (m/s) by protocol MoveMode: 0 foot, 1 car/bike/
 * tractor, 2 boat, 3 plane, 4 swim. Generous — downhill, boosts and stunt
 * jumps all fit; only the impossible fails. */
export const SPEED_CAP: readonly number[] = [16, 70, 55, 150, 12];
export const TELEPORT_COOLDOWN_MS = 5000;

export type MoveVerdict = 'ok' | 'teleport' | 'reject';

export function checkMove(
  px: number, pz: number, nx: number, nz: number,
  dtMs: number, mode: number, msSinceTeleport: number,
  prevMode: number = mode,
): MoveVerdict {
  if (dtMs <= 0) return 'ok';                      // same-ms burst: nothing to judge
  const dist = Math.hypot(nx - px, nz - pz);
  // The most permissive of the two modes: bailing out of a fast car (car->foot)
  // or a plane must not read as a foot-speed violation on the transition tick.
  const cap = Math.max(SPEED_CAP[mode] ?? SPEED_CAP[0], SPEED_CAP[prevMode] ?? SPEED_CAP[0]);
  if (dist <= cap * (dtMs / 1000) * 1.4 + 0.6) return 'ok'; // 40% slack + jitter floor
  return msSinceTeleport >= TELEPORT_COOLDOWN_MS ? 'teleport' : 'reject';
}

/** Clamp a reported height into the plausible band for (x,z): never deeper
 * than the local ground/seabed, never higher than the mode allows (rooftops
 * and stunt airtime fit; "under the map" and "orbit" do not). */
export function clampPoseY(x: number, y: number, z: number, mode: number): number {
  const gh = groundHeight(x, z);
  const floor = Math.min(gh, 0) - 3.5;             // seabed/river bed, with slack
  // gh+140 (not 90): the plane's ceiling is y=130 — jumping out of it flips the
  // mode to foot at that altitude, and the fall must not be clamped mid-air.
  const ceil = mode === 3 ? 780 : mode === 2 ? 8 : gh + 140;
  return y < floor ? floor : y > ceil ? ceil : y;
}
