// ===========================================================================
// anim-fsm.ts — the SINGLE animation authority for every rigged GLB character
// (the player hero and every NPC share the same HumanArmature rig + clip set).
//
// Rule of the house: NOTHING else plays a clip or applies a pose directly. Every
// animation a character can show is a value of `AnimState`; a per-character
// `AnimationStateMachine` owns that character's mixer + actions and is the only
// thing that crossfades clips, runs the knee IK and lays the bone-poses on top.
// Callers never call mixer.update / applyGunPose / applySwim / … themselves — they
// `request(state)` and `update(dt, ctx)`, and the machine renders it.
//
// One flat enum (per the design): some states are whole-body clips (Idle/Walk/Run/
// Sit/Death), some are full-body bone POSES that override the clip (Swim, Bench,
// Dance, Ragdoll, RcOperate, DriveCar/DriveBike), and some are UPPER-BODY OVERLAYS
// laid over the locomotion clip (Aim, Wave, Talk, WeedPour, WeedDeal) — the machine
// knows which is which from STATE_TABLE and drives the legs (clip + knee IK) or the
// pose accordingly. Overlay states read their leg locomotion from ctx.loco.
// ===========================================================================
import * as THREE from 'three';
import {applyMixamoAim} from '../../assets/models/characters/mixamo-rig.ts';

// Every animation/posture a rigged character (player or ANY NPC) can be in. This enum is
// exhaustive: nothing animates a character outside one of these states.
export enum AnimState {
  Idle, Walk, Run,        // locomotion clips (Run also covers panic/flee)
  Jump, Punch, Death,     // one-shot clips (play once, hold last frame)
  Sit,                    // seated clip (vehicle passenger / cut-scene seat)
  DriveCar, DriveBike,    // seated DRIVER poses (boat/plane/tractor reuse DriveCar)
  Aim,                    // upper-body gun-hold overlay on locomotion
  Swim, Ragdoll, RcOperate, // full-body poses (Ragdoll = the airborne death tumble)
  Bench, Dance,           // player mini-games (frozen world)
  Wave, Talk,             // gesture overlays: taxi hail / rural greet, cut-scene talk
  WeedPour, WeedDeal,     // weed-farm hand-work overlays on locomotion
  // ----- NPC routine postures -----
  Work,                   // rural folk farming (hoe/chop)
  Beckon,                 // weed buyer "come here" flag-down
  ClubDance,              // nightclub crowd dancing
  Lie,                    // hospital patient on a bed / settled corpse on the ground
}

// Per-frame parameters the active state may need (all optional).
export interface AnimCtx {
  speed?: number;      // ground speed (u/s) → walk/run clip timescale
  loco?: AnimState;    // base locomotion (Idle|Walk|Run) under an overlay state
  ik?: boolean;        // run the knee IK this frame (false to skip for far NPCs)
  t?: number;          // time / stroke phase for ragdoll/wave/talk/swim oscillation
  benchP?: number;     // bench press: 1 lockout … 0 chest
  danceLane?: number; danceAmt?: number;
  swimMoving?: number; swimPhase?: number;
  talking?: boolean;
  aimPitch?: number;   // camera/reticle vertical pitch → tilts the gun-hold up/down to the aim
}

// What a state renders: which clip the mixer plays, whether it's a one-shot, whether
// the legs still need knee IK (clip-driven legs), and an optional bone-pose laid on top.
type Clip = 'idle' | 'walk' | 'run' | 'sit' | 'death' | 'punch' | 'jump' | 'loco'
  | 'aim' | 'dance' | 'swim' | 'drive' | 'fall' | 'lie' | 'work' | 'wave' | 'talk';   // Mixamo clip keys
interface StateDef { clip: Clip; oneShot?: boolean; legIK?: boolean; pose?: (root: THREE.Object3D, ctx: AnimCtx) => void; }


// MIXAMO rig table — the SAME states, but every one is a real downloaded clip (no
// HumanArmature poses, no knee IK, no foot weld: the mixamorig is properly baked). The
// few without a dedicated clip approximate (Aim=rifle idle, Ragdoll=falling, Bench/RcOperate
// =idle, Beckon/WeedDeal=wave, WeedPour=work). Pass this to AnimationStateMachine when the
// character is built from mixamo-rig.ts. Single source of truth for the new rig.
export const MIXAMO_TABLE: Record<AnimState, StateDef> = {
  [AnimState.Idle]:  { clip: 'idle' },
  [AnimState.Walk]:  { clip: 'walk' },
  [AnimState.Run]:   { clip: 'run' },
  [AnimState.Jump]:  { clip: 'jump', oneShot: true },
  [AnimState.Punch]: { clip: 'punch', oneShot: true },
  [AnimState.Death]: { clip: 'death', oneShot: true },
  [AnimState.Sit]:   { clip: 'sit' },
  [AnimState.DriveCar]:  { clip: 'drive' },
  [AnimState.DriveBike]: { clip: 'drive' },
  // Aim = upper-body overlay (arms hold the rifle) over the locomotion legs, so the hero can
  // walk/run while aiming — NOT the full-body standing aim clip (which froze the legs). The
  // chest pitches by ctx.aimPitch so the gun points up/down at the reticle.
  [AnimState.Aim]:   { clip: 'loco', pose: (r, c) => applyMixamoAim(r, c.aimPitch ?? 0) },
  [AnimState.Swim]:  { clip: 'swim' },
  [AnimState.Ragdoll]: { clip: 'fall' },
  [AnimState.RcOperate]: { clip: 'idle' },
  [AnimState.Bench]: { clip: 'idle' },
  [AnimState.Dance]: { clip: 'dance' },
  [AnimState.Wave]:  { clip: 'wave' },
  [AnimState.Talk]:  { clip: 'talk' },
  [AnimState.WeedPour]: { clip: 'work' },
  [AnimState.WeedDeal]: { clip: 'wave' },
  [AnimState.Work]:  { clip: 'work' },
  [AnimState.Beckon]: { clip: 'wave' },
  [AnimState.ClubDance]: { clip: 'dance' },
  [AnimState.Lie]:   { clip: 'lie' },
};

const LOCO_CLIP: Partial<Record<AnimState, Clip>> = {
  [AnimState.Walk]: 'walk', [AnimState.Run]: 'run', [AnimState.Idle]: 'idle',
};

// In-place clip natural foot speeds (measured from the FBX) — clip timescale =
// groundSpeed/natural so planted feet don't skate. locoScale damps it a touch.
const WALK_NAT = 1.38, RUN_NAT = 2.45;
const clampN = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;

export interface RigHooks {
  solveLegs(): void;          // this rig's knee IK (player solveLegIK / per-NPC solveLegs)
  postMixer?(): void;         // extra per-frame after mixer.update (player gym-arm scale)
  locoScale?: number;         // clip-timescale damping (player 0.72, NPC 1)
  walkNat?: number;           // walk clip's natural foot speed (overrides WALK_NAT; Mixamo run clip ≈ 4.4)
  runNat?: number;            // run clip's natural foot speed (overrides RUN_NAT)
}

export class AnimationStateMachine {
  private state = AnimState.Idle;
  private clipKey = '';
  private readonly locoScale: number;
  private readonly walkNat: number;
  private readonly runNat: number;
  constructor(
    private readonly root: THREE.Object3D,
    private readonly mixer: THREE.AnimationMixer,
    private readonly actions: Record<string, THREE.AnimationAction>,
    private readonly hooks: RigHooks,
    private readonly table: Record<AnimState, StateDef> = MIXAMO_TABLE,   // the mixamorig clip table (the only rig now)
  ) { this.locoScale = hooks.locoScale ?? 1; this.walkNat = hooks.walkNat ?? WALK_NAT; this.runNat = hooks.runNat ?? RUN_NAT; }

  get current(): AnimState { return this.state; }
  // Declare the state to render this frame (cheap; the actual work happens in update()).
  request(s: AnimState): void { this.state = s; }

  // Force-replay a one-shot clip RIGHT NOW (rapid melee swings restart the punch). Stays
  // in that state until the caller requests something else. timeScale stretches the clip.
  trigger(s: AnimState, timeScale = 1): void {
    const def = this.table[s];
    const a = this.actions[def.clip as string]; if (!a) return;
    a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true;
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setEffectiveTimeScale(timeScale); a.play();
    const prev = this.actions[this.clipKey]; if (prev && prev !== a) prev.fadeOut(0.08);
    this.clipKey = def.clip as string; this.state = s;
  }

  // Fade out the currently-playing clip and forget it, so the NEXT request re-plays from
  // scratch. Used when handing the mixer back to another driver (e.g. /studio's raw-clip mode).
  stop(dur = 0.2): void {
    const a = this.actions[this.clipKey]; if (a) a.fadeOut(dur);
    this.clipKey = '';
  }

  private crossfade(clip: string, oneShot?: boolean, dur = 0.18): void {
    if (clip === this.clipKey) return;                 // already on this clip (loop continues / one-shot holds)
    const next = this.actions[clip]; if (!next) return;
    const prev = this.actions[this.clipKey];
    // Two state-keys can resolve to the SAME action (walk≡run while they share the Standard
    // Running clip). Re-fading then would reset that one action's weight to 0 for a frame =
    // a bind-pose (T-pose) flash. So just relabel and keep it playing (update() re-times it).
    if (next === prev) { this.clipKey = clip; return; }
    if (oneShot) { next.setLoop(THREE.LoopOnce, 1); next.clampWhenFinished = true; next.setEffectiveTimeScale(1); }
    else next.setLoop(THREE.LoopRepeat, Infinity);
    next.reset(); next.enabled = true; next.setEffectiveWeight(1); next.fadeIn(oneShot ? 0.08 : dur); next.play();
    if (prev && prev !== next) prev.fadeOut(oneShot ? 0.08 : dur);
    this.clipKey = clip;
  }

  // Render the current state: crossfade its clip, advance the mixer, then lay the knee IK
  // and/or the bone-pose on top. THE one place clips play and poses apply.
  update(dt: number, ctx: AnimCtx = {}): void {
    const def = this.table[this.state];
    const clip = def.clip === 'loco' ? (LOCO_CLIP[ctx.loco ?? AnimState.Idle] ?? 'idle') : def.clip;
    this.crossfade(clip, def.oneShot);
    const a = this.actions[clip];
    if (a) {
      if (clip === 'walk') a.setEffectiveTimeScale(clampN((ctx.speed ?? 0) / this.walkNat * this.locoScale, 0.4, 4.5));
      else if (clip === 'run') a.setEffectiveTimeScale(clampN((ctx.speed ?? 0) / this.runNat * this.locoScale, 0.4, 4.5));
    }
    this.mixer.update(dt);
    this.hooks.postMixer?.();
    this.root.updateMatrixWorld(true);
    if (def.legIK && ctx.ik !== false) this.hooks.solveLegs();
    def.pose?.(this.root, ctx);
  }
}
