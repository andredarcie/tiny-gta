// ===========================================================================
// /studio — Mixamo animation studio. The shared mixamorig character (mixamo-rig.ts)
// driven through the EXACT state machine the game uses (AnimationStateMachine +
// MIXAMO_TABLE), with a button per AnimState. So every animation here renders
// identically to in-game. In the Aim state it also draws a REFERENCE gun in the
// hands + a red aim ray (barrel direction) so you can see where the gun points.
// ?state=Aim&pitch=0.4 jumps straight to a state. Dev-only.
// ===========================================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { preloadRig, makeCharacter, PLAYER_LOOK, MIXAMO_LOCO_NAT, MIXAMO_WALK_NAT } from './assets/models/characters/mixamo-rig.ts';
import { AnimationStateMachine, AnimState, MIXAMO_TABLE, type AnimCtx } from './js/actors/anim-fsm.ts';

const STATES = Object.entries(AnimState).filter(([, v]) => typeof v === 'number') as [string, number][];
const ONE_SHOT = new Set<number>([AnimState.Jump, AnimState.Punch, AnimState.Death]);
const _z = new THREE.Vector3(0, 0, 1);

const $ = (id: string) => document.getElementById(id)!;
const status = (m: string) => { $('status').textContent = m; };
const showErr = (m: string) => { status('ERRO (ver console)'); console.error(m); };
window.addEventListener('error', e => showErr((e.error && e.error.stack) || e.message));
window.addEventListener('unhandledrejection', e => showErr((e.reason && e.reason.stack) || String(e.reason)));

function findBone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let b: THREE.Bone | null = null; root.traverse(o => { if (!b && (o as THREE.Bone).isBone && o.name === name) b = o as THREE.Bone; }); return b;
}
// a simple recognizable pistol proxy (body + barrel along +Z + grip) for the aim reference.
function makeGunProxy(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x202428, roughness: 0.6, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.2), mat); body.position.z = 0.02; g.add(body);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.32, 10), mat); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.025, 0.2); g.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.06), mat); grip.position.set(0, -0.1, -0.05); grip.rotation.x = 0.32; g.add(grip);
  return g;   // barrel points +Z
}

async function main(): Promise<void> {
  const canvas = $('c') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xffffff);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc0c6cf, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 6, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-4, 2, -3); scene.add(fill);
  scene.add(new THREE.GridHelper(6, 12, 0xdadde2, 0xeceef1));
  const orbit = new OrbitControls(cam, canvas); orbit.target.set(0, 0.9, 0); cam.position.set(0, 1.1, 3.5); orbit.update();
  orbit.autoRotate = true; orbit.autoRotateSpeed = 1.2;
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h || 1; cam.updateProjectionMatrix(); };
  new ResizeObserver(resize).observe(canvas); resize();

  status('carregando base Mixamo…');
  if (!await preloadRig()) { status('FALHOU ao carregar a base'); return; }
  const ch = makeCharacter(PLAYER_LOOK); if (!ch) { status('FALHOU makeCharacter'); return; }
  ch.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.frustumCulled = false; });
  scene.add(ch.root);
  // SAME FSM + table + tuning the game uses, so every state renders identically.
  const fsm = new AnimationStateMachine(ch.root, ch.mixer, ch.actions,
    { solveLegs: () => { }, locoScale: 0.6, walkNat: MIXAMO_WALK_NAT, runNat: MIXAMO_LOCO_NAT }, MIXAMO_TABLE);

  // --- aim reference: gun in the hands + red aim ray (barrel direction) ---
  const lh = findBone(ch.root, 'mixamorigLeftHand'), rh = findBone(ch.root, 'mixamorigRightHand');
  const gun = makeGunProxy(); scene.add(gun);
  const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), _z.clone()]), new THREE.LineBasicMaterial({ color: 0xff3b3b }));
  scene.add(ray);
  const reticle = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 14), new THREE.MeshBasicMaterial({ color: 0xff3b3b })); scene.add(reticle);

  let curState = AnimState.Idle, speed = 0, aimPitch = 0, curBtn: HTMLButtonElement | null = null;
  const speedEl = $('speed') as HTMLInputElement, aimEl = $('aim') as HTMLInputElement;
  const setSpeed = (v: number) => { speed = v; speedEl.value = String(v); $('speedV').textContent = v.toFixed(1); };
  const select = (s: number, name: string, btn: HTMLButtonElement) => {
    curState = s;
    if (ONE_SHOT.has(s)) fsm.trigger(s, 1); else fsm.request(s);
    if (s === AnimState.Run) setSpeed(9); else if (s === AnimState.Walk) setSpeed(5.2); else if (s === AnimState.Idle) setSpeed(0);
    $('now').textContent = '▶ ' + name;
    if (curBtn) curBtn.classList.remove('active'); btn.classList.add('active'); curBtn = btn;
  };
  const sdiv = $('states');
  for (const [name, val] of STATES) {
    const b = document.createElement('button'); b.className = 'clipbtn'; b.textContent = name;
    b.onclick = () => select(val, name, b); sdiv.appendChild(b);
  }
  speedEl.oninput = () => { speed = parseFloat(speedEl.value); $('speedV').textContent = speed.toFixed(1); };
  aimEl.oninput = () => { aimPitch = parseFloat(aimEl.value); $('aimV').textContent = aimPitch.toFixed(2); };
  const orbitCb = $('orbit') as HTMLInputElement; orbitCb.onchange = () => { orbit.autoRotate = orbitCb.checked; };

  // optional ?state=Aim&pitch=0.4 — jump straight to a state (for screenshots)
  const params = new URLSearchParams(location.search);
  const wantPitch = params.get('pitch');
  if (wantPitch !== null) { aimPitch = parseFloat(wantPitch); aimEl.value = wantPitch; $('aimV').textContent = aimPitch.toFixed(2); }
  const want = params.get('state');
  const startBtn = (want && [...sdiv.children].find(b => b.textContent === want)) || sdiv.querySelector('button')!;
  (startBtn as HTMLButtonElement).click();
  if (params.has('norotate')) { orbit.autoRotate = false; orbitCb.checked = false; }
  if (params.get('view') === 'side') { cam.position.set(3.4, 1.05, 0.3); orbit.update(); }
  status(`pronto · ${STATES.length} estados`);

  // overlay states (Aim/Wave/Talk/Work/…) read their leg clip from ctx.loco
  const clock = new THREE.Clock();
  const ctx = (): AnimCtx => ({
    speed, aimPitch, t: clock.elapsedTime,
    loco: speed < 0.5 ? AnimState.Idle : speed < 6 ? AnimState.Walk : AnimState.Run,
  });
  const _rh = new THREE.Vector3(), _lh = new THREE.Vector3(), _dir = new THREE.Vector3();
  const updateGun = () => {
    const aiming = curState === AnimState.Aim && !!lh && !!rh;
    gun.visible = ray.visible = reticle.visible = aiming;
    if (!aiming) return;
    _rh.setFromMatrixPosition(rh!.matrixWorld); _lh.setFromMatrixPosition(lh!.matrixWorld);
    _dir.copy(_lh).sub(_rh).normalize();              // barrel: rear(right) hand → front(left) hand
    gun.position.copy(_rh); gun.quaternion.setFromUnitVectors(_z, _dir);
    ray.position.copy(_rh); ray.quaternion.setFromUnitVectors(_z, _dir); ray.scale.set(1, 1, 6);
    reticle.position.copy(_rh).addScaledVector(_dir, 6);
  };
  const loop = () => { requestAnimationFrame(loop); fsm.update(clock.getDelta(), ctx()); updateGun(); orbit.update(); renderer.render(scene, cam); };
  loop();
}
main().catch(e => showErr((e as Error).stack || String(e)));
