// DOOM (1993) player movement physics, reproduced exactly from id Software's released
// source (github.com/id-Software/DOOM, linuxdoom-1.10). Pure math, no THREE/DOM, so it
// is unit-tested in Node (test/unit/doom-physics.test.ts). Used by player.ts on foot.
//
//   doomdef.h  TICRATE 35 (the simulation runs in 1/35 s tics)
//   g_game.c   forwardmove {0x19,0x32} (walk 25 / run 50), sidemove {0x18,0x28} (24 / 40),
//              angleturn {640,1280,320} with SLOWTURNTICS 6 (keyboard turn accelerates)
//   p_user.c   P_MovePlayer: momentum += cmd*2048 (16.16 fixed) along the view angle,
//              only while on the ground; P_CalcHeight: view bob (MAXBOB 0x100000)
//   p_mobj.c   P_XYMovement: momentum *= FRICTION 0xE800 (0.90625) each tic; with no
//              input and |mom| < STOPSPEED 0x1000 on both axes it snaps to 0
//   p_local.h  MAXMOVE 30 units/tic, VIEWHEIGHT 41 units
//
// Per tic DOOM does: mom += thrust; move by mom; mom *= friction. Top speed is therefore
// thrust/(1-friction): walk 8.33 map units/tic (292 u/s), run 16.67 u/tic (583 u/s),
// strafe 8.0 / 13.33 u/tic, and forward+strafe together (no normalisation, as in DOOM)
// ~21.3 u/tic. It takes ~23 tics (0.66 s) to reach 90% of top speed, and the same glide
// to stop. That recurrence is evaluated in closed form for the (fractional) number of
// tics in each frame, so momentum matches DOOM exactly at every tic boundary, at any
// frame rate.
//
// Scale: id's convention of 8 map units = 1 foot, so 1 unit = 0.0381 m; VIEWHEIGHT is
// 1.56 m and a run is ~22 m/s.

export const DOOM_TICRATE=35;
export const DOOM_UNIT=0.3048/8;                        // metres per map unit
export const DOOM_FRICTION=0xE800/0x10000;              // 0.90625 per tic
export const DOOM_STOPSPEED=0x1000/0x10000;             // units/tic
export const DOOM_MAXMOVE=30;                           // units/tic, per axis
export const DOOM_FORWARDMOVE=[0x19,0x32] as const;     // walk, run
export const DOOM_SIDEMOVE=[0x18,0x28] as const;        // walk, run
export const DOOM_THRUST=2048/0x10000;                  // cmd*2048 (16.16 fixed) -> units/tic
export const DOOM_ANGLETURN=[640,1280,320] as const;    // walk, run, slow (first tics)
export const DOOM_SLOWTURNTICS=6;
export const DOOM_VIEWHEIGHT=41;                        // units
export const DOOM_DEADVIEWHEIGHT=6;                     // units (P_DeathThink)
export const DOOM_MAXBOB=16;                            // units

export interface DoomMomentum { x: number; z: number; }  // units/tic

const clamp=(v: number,a: number,b: number): number=>v<a?a:v>b?b:v;

/**
 * Advances `mom` by `tics` (may be fractional) under a constant per-tic thrust
 * (ax, az in units/tic) and returns the displacement in MAP UNITS. `hasCmd` is
 * whether the player is pressing a movement key (it disables the STOPSPEED snap).
 */
export function doomStep(mom: DoomMomentum,ax: number,az: number,tics: number,hasCmd: boolean): {dx: number; dz: number} {
  const f=DOOM_FRICTION;
  const fn=Math.pow(f,tics),S=(1-fn)/(1-f);
  // displacement over n tics: sum of (v_k + a), with v_k = f^k*v0 + a*f*(1-f^k)/(1-f)
  const g=tics+f/(1-f)*(tics-S);
  const dx=mom.x*S+ax*g,dz=mom.z*S+az*g;
  mom.x=clamp(fn*mom.x+ax*f*S,-DOOM_MAXMOVE,DOOM_MAXMOVE);
  mom.z=clamp(fn*mom.z+az*f*S,-DOOM_MAXMOVE,DOOM_MAXMOVE);
  if(!hasCmd&&Math.abs(mom.x)<DOOM_STOPSPEED&&Math.abs(mom.z)<DOOM_STOPSPEED){mom.x=0;mom.z=0;}
  return {dx,dz};
}

/** Per-tic thrust magnitudes (units/tic) for a forward/side command in [-1,1]. */
export function doomThrust(forward: number,side: number,run: boolean): {fwd: number; side: number} {
  const r=run?1:0;
  return {
    fwd:clamp(forward,-1,1)*DOOM_FORWARDMOVE[r]*DOOM_THRUST,
    side:clamp(side,-1,1)*DOOM_SIDEMOVE[r]*DOOM_THRUST,
  };
}

/** Keyboard turn rate in radians per second, given how many tics the key has been held. */
export function doomTurnRate(heldTics: number,run: boolean): number {
  const t=heldTics<DOOM_SLOWTURNTICS?DOOM_ANGLETURN[2]:DOOM_ANGLETURN[run?1:0];
  return (t/65536)*Math.PI*2*DOOM_TICRATE; // angleturn<<16 of a 2^32 circle, per tic
}

/** P_CalcHeight view-bob offset in MAP UNITS at `levelTime` tics. */
export function doomBob(mom: DoomMomentum,levelTime: number): number {
  const b=Math.min(DOOM_MAXBOB,(mom.x*mom.x+mom.z*mom.z)/4);
  // angle = (FINEANGLES/20*leveltime)&FINEMASK, FINEANGLES = 8192 (integer division → 409)
  return b/2*Math.sin(Math.PI*2*((409*levelTime)%8192)/8192);
}
