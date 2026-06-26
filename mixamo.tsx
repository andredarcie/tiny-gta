// ===========================================================================
// /mixamo — dev viewer proving the SHARED Mixamo base: the hero + several named
// NPCs are all SkeletonUtils.clones of ONE mesh + ONE clip set (mixamo-rig.ts),
// each recoloured by region. Click an animation → every character plays it from
// the same shared clip. One source, no per-character assets. Dev-only page.
// ===========================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { preloadRig, makeCharacter, PLAYER_LOOK, lookFor, type MixamoChar } from './assets/models/characters/mixamo-rig.ts';

// the hero + a fixed cast of named NPCs (each look is deterministic from its name)
const CROWD: { name: string; player?: boolean }[] = [
  { name: 'Hero', player: true }, { name: 'Mary' }, { name: 'James' }, { name: 'Linda' },
  { name: 'David' }, { name: 'Susan' }, { name: 'Robert' },
];
const CLIPS: [string, string][] = [
  ['Idle', 'idle'], ['Run', 'run'], ['Jump', 'jump'], ['Punch', 'punch'], ['Death', 'death'],
  ['Sit', 'sit'], ['Aim', 'aim'], ['Dance', 'dance'], ['Wave', 'wave'], ['Talk', 'talk'],
  ['Lie', 'lie'], ['Work', 'work'], ['Drive', 'drive'], ['Falling', 'fall'], ['Swim', 'swim'],
];

const status = (m: string) => { const e = document.getElementById('status'); if (e) e.textContent = m; };
const showErr = (m: string) => { status('ERRO (ver console)'); console.error(m); };
window.addEventListener('error', e => showErr((e.error && e.error.stack) || e.message));
window.addEventListener('unhandledrejection', e => showErr((e.reason && e.reason.stack) || String(e.reason)));

async function main(): Promise<void> {
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf3f4f7);
  const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc0c6cf, 1.15));
  const k = new THREE.DirectionalLight(0xffffff, 1.4); k.position.set(3, 6, 4); scene.add(k);
  const f = new THREE.DirectionalLight(0xffffff, 0.5); f.position.set(-4, 2, -3); scene.add(f);
  const orbit = new OrbitControls(cam, canvas); orbit.target.set(0, 0.95, 0); cam.position.set(0, 1.4, 7.2); orbit.update();
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h || 1; cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(canvas); resize();

  status('carregando base compartilhada…');
  if (!await preloadRig()) { status('FALHOU ao carregar a base'); return; }

  const chars: MixamoChar[] = [];
  const cur = new Map<MixamoChar, THREE.AnimationAction>();
  const n = CROWD.length;
  CROWD.forEach((c, i) => {
    const ch = makeCharacter(c.player ? PLAYER_LOOK : lookFor(c.name));
    if (!ch) return;
    ch.root.position.x = (i - (n - 1) / 2) * 1.15;   // line them up
    scene.add(ch.root); chars.push(ch);
  });
  status(`pronto · ${chars.length} personagens da MESMA base · arraste p/ girar`);

  const bdiv = document.getElementById('buttons')!; let curBtn: HTMLButtonElement | null = null;
  const play = (key: string, btn: HTMLButtonElement) => {
    for (const ch of chars) {
      const next = ch.actions[key]; if (!next) continue;
      const prev = cur.get(ch);
      next.reset().setEffectiveWeight(1).fadeIn(0.2).play(); if (prev && prev !== next) prev.fadeOut(0.2); cur.set(ch, next);
    }
    document.getElementById('now')!.textContent = '▶ ' + btn.textContent + '  (todos)';
    if (curBtn) curBtn.classList.remove('active'); btn.classList.add('active'); curBtn = btn;
  };
  for (const [label, key] of CLIPS) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => play(key, b); bdiv.appendChild(b);
  }
  (document.querySelector('#buttons button') as HTMLButtonElement | null)?.click();   // autostart idle

  const clock = new THREE.Clock();
  const loop = () => { requestAnimationFrame(loop); const dt = clock.getDelta(); for (const ch of chars) ch.mixer.update(dt); orbit.update(); renderer.render(scene, cam); };
  loop();
}
main().catch(e => showErr((e as Error).stack || String(e)));
