// Police vision cones (Metal Gear Solid-style). SINGLE source of truth shared by the
// detection logic (js/actors/police.ts) and the minimap painter (js/ui/hud.ts), so the
// wedge you SEE on the radar is exactly the wedge that can actually spot you.
//
// Heading convention matches the rest of the engine: a unit facing `h` looks down the
// world vector (sin h, cos h) — the same `h` used for car `heading` and ped `rotation.y`.

// Cruiser: a long, fairly wide forward cone (two officers scanning through the windshield).
export const COP_VIEW_RANGE = 85;            // metres the cone reaches ahead
export const COP_VIEW_HALF  = Math.PI * 0.24; // half-angle ≈ 43° → ~86° total field of view
export const COP_NEAR       = 12;            // point-blank: noticed from ANY angle this close

// Foot officer: a shorter cone, but they pivot to face the suspect while hunting.
export const OFF_VIEW_RANGE = 34;
export const OFF_VIEW_HALF  = Math.PI * 0.28; // ≈ 50°
export const OFF_NEAR       = 6;

// Precomputed cosines of the half-angles (the cone test compares against these).
export const COP_VIEW_COS = Math.cos(COP_VIEW_HALF);
export const OFF_VIEW_COS = Math.cos(OFF_VIEW_HALF);

// Is the target (tx,tz) inside the viewer's vision cone?
//   (vx,vz)  viewer position        facing   viewer heading (forward = sin,cos)
//   range    cone reach (m)         cosHalf  cos of the cone's half-angle
//   near     point-blank radius noticed from any direction
// Pure and allocation-free — safe to call per unit per frame. The caller still does the
// (more expensive) line-of-sight test only when this returns true.
export function inCone(
  vx: number, vz: number, facing: number,
  tx: number, tz: number,
  range: number, cosHalf: number, near: number,
): boolean {
  const dx = tx - vx, dz = tz - vz;
  const d2 = dx * dx + dz * dz;
  if (d2 > range * range) return false;       // out of reach
  if (d2 <= near * near) return true;          // right on top of them → seen regardless of facing
  const d = Math.sqrt(d2);
  // dot(forward, toTarget/|toTarget|): forward is already unit length, so divide by d once.
  const dot = (Math.sin(facing) * dx + Math.cos(facing) * dz) / d;
  return dot >= cosHalf;                        // within the angular spread of the cone
}
