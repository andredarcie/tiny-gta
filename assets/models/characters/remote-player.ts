import * as THREE from 'three';
import { buildToonPlayer, makePed, shirtColors } from './pedestrian.ts';

// Remote player avatar (online mode): the SAME rigged pipeline as every NPC —
// makePed() returns a group that npc-glb.ts swaps to a tinted Mixamo clone, and
// updateNpcGlb() (already in the main loop) derives idle/walk/run from how far
// the group moved each frame. So the network layer only has to MOVE the group.
//
// The floating name tag is a separate sprite, NOT a child of the avatar group:
// the GLB swap (npc-glb.ts swapToGlb) clears all children of the group, so a
// child tag would be destroyed. js/net/remote-players.ts keeps it in sync.

export function makeRemoteAvatar(colorSeed: number): THREE.Group {
  const color = shirtColors[Math.abs(colorSeed | 0) % shirtColors.length];
  return makePed(color); // adds itself to the scene; GLB swap lands next frame
}

/** Floating nickname tag (canvas texture — no binary assets, as everywhere). */
export function makeNameTag(nick: string): THREE.Sprite {
  const c = document.createElement('canvas');
  const font = '700 34px "IBM Plex Mono", ui-monospace, monospace';
  let ctx = c.getContext('2d')!;
  ctx.font = font;
  const w = Math.min(512, Math.ceil(ctx.measureText(nick).width) + 30);
  const hpx = 52;
  c.width = w; c.height = hpx;
  ctx = c.getContext('2d')!; // resizing the canvas reset the context state
  ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(r, 1); ctx.arcTo(w - 1, 1, w - 1, hpx - 1, r); ctx.arcTo(w - 1, hpx - 1, 1, hpx - 1, r);
  ctx.arcTo(1, hpx - 1, 1, 1, r); ctx.arcTo(1, 1, w - 1, 1, r); ctx.closePath();
  ctx.fillStyle = 'rgba(10,16,20,0.55)'; ctx.fill();
  ctx.fillStyle = '#eafcff';
  ctx.fillText(nick, w / 2, hpx / 2 + 1);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  const SCALE = 0.011;
  s.scale.set(w * SCALE, hpx * SCALE, 1);
  s.renderOrder = 9;
  return s;
}

export default {
  category: 'Characters',
  label: 'Remote Player',
  build(): THREE.Object3D {
    // Gallery preview: static toon doll + tag (the real thing swaps to the GLB rig)
    const g = new THREE.Group();
    g.add(buildToonPlayer({ color: 0x19e3ff }));
    const tag = makeNameTag('PLAYER');
    tag.position.y = 2.55;
    g.add(tag);
    return g;
  },
};
