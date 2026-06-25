/* @jsxRuntime classic */
/* @jsx React.createElement */
/* @jsxFrag React.Fragment */
// ===========================================================================
// /studio — a React dev tool to inspect the game, starting with ANIMATIONS.
// Shows the hero doll on a white background and a button per available clip so
// you can watch each one. React comes from a CDN (esm.sh) on purpose: the project
// has no React toolchain and its node_modules is a shared symlink, so we avoid
// touching deps. Three.js + the player model are the real game modules.
// This is a dev-only page (not part of the shipped game). Extend it freely.
// ===========================================================================
import * as THREE from 'three';
import { loadPlayerGlb, solveLegIK, applyVehiclePose, applyGunPose, applyGymArms } from './assets/models/characters/player-glb.ts';
// Vehicle models — pure .build() from each descriptor's default export. Importing
// them pulls in the game engine (they `import {scene}`), which needs a #game canvas;
// studio.html provides a hidden one. We only call build() (no scene.add).
import carModel from './assets/models/vehicles/car.ts';
import motoModel from './assets/models/vehicles/motorcycle.ts';
import boatModel from './assets/models/vehicles/boat.ts';
import { createPoseRig } from './studio-pose.ts';

type VehKind = 'none' | 'car' | 'motorcycle' | 'boat';
const VEH_MODELS: Record<string, { build: (o?: unknown) => THREE.Object3D }> = {
  car: carModel as never, motorcycle: motoModel as never, boat: boatModel as never,
};
// Starting offsets (feet origin in the vehicle's local space) — rough; the user nudges
// them. Derived from the procedural-ped SEAT_OFFSET / each vehicle's seat height.
const SEAT_DEFAULTS: Record<string, { x: number; y: number; z: number; ry: number }> = {
  none: { x: 0, y: 0, z: 0, ry: 0 },
  car: { x: -0.380, y: -0.157, z: -0.031, ry: 0 },  // driver seat (tuned)
  motorcycle: { x: 0.001, y: 0.333, z: 0.031, ry: 0 },  // tuned in pose editor (body position)
  boat: { x: 0, y: 0.22, z: -0.12, ry: 0 },
};

// React/ReactDOM come from the locally-served UMD bundles loaded in studio.html
// (window globals) — no CDN, no npm install (the worktree node_modules is a shared
// symlink). `React` must be in scope for the classic-JSX transform above.
const React = (window as unknown as { React: typeof import('react') }).React;
const { useEffect, useRef, useState } = React;
const { createRoot } = (window as unknown as { ReactDOM: { createRoot: (el: Element) => { render: (n: unknown) => void } } }).ReactDOM;

// On-screen error surface (lives OUTSIDE React so it survives an unmount/crash). Any
// error — React render, WebGL, the RAF loop, a rejected promise — gets shown here so
// the page never just goes blank silently.
function showError(msg: string): void {
  let el = document.getElementById('err-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'err-overlay';
    el.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:60%;overflow:auto;z-index:99999;'
      + 'background:#2a0000;color:#ffd9d9;font:12px/1.4 ui-monospace,Consolas,monospace;padding:12px;white-space:pre-wrap;border-top:3px solid #ff5252';
    document.body.appendChild(el);
  }
  el.textContent += msg + '\n\n';
}
window.addEventListener('error', (e) => showError('window error: ' + ((e.error && e.error.stack) || e.message)));
window.addEventListener('unhandledrejection', (e) => showError('unhandled rejection: ' + ((e.reason && e.reason.stack) || e.reason)));

interface Clip { key: string; label: string; dur: number; }

function Studio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const rootRef = useRef<THREE.Object3D | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const curActionRef = useRef<THREE.AnimationAction | null>(null);
  // live control values read inside the render loop (refs avoid stale closures)
  const speedRef = useRef(1);
  const playingRef = useRef(true);
  const ikRef = useRef(true);
  const orbitRef = useRef(true);
  const angleRef = useRef(0);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const vehObjRef = useRef<THREE.Object3D | null>(null);
  const rigRef = useRef<ReturnType<typeof createPoseRig> | null>(null);
  const vehKindRef = useRef<VehKind>('none');
  const gunRef = useRef(false);
  const armRef = useRef(1);

  const [vehicle, setVehicle] = useState<VehKind>('none');
  const [seat, setSeat] = useState(SEAT_DEFAULTS.none);
  const [poseMode, setPoseMode] = useState(false);
  const [poseOut, setPoseOut] = useState('');
  const [clips, setClips] = useState<Clip[]>([]);
  const [current, setCurrent] = useState<string>('');
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [ik, setIk] = useState(true);
  const [gun, setGun] = useState(false);   // overlay the gun-hold posture on the clip
  const [arm, setArm] = useState(1);       // gym muscle: upper-arm thickness (1..1.5)
  const [loopOn, setLoopOn] = useState(true);
  const [orbit, setOrbit] = useState(true);
  const [status, setStatus] = useState('loading model…');
  const [clipTime, setClipTime] = useState(0);

  useEffect(() => { speedRef.current = speed; const m = mixerRef.current; if (m) m.timeScale = speed; }, [speed]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { ikRef.current = ik; }, [ik]);
  useEffect(() => { gunRef.current = gun; }, [gun]);
  useEffect(() => { armRef.current = arm; }, [arm]);
  useEffect(() => { orbitRef.current = orbit; }, [orbit]);
  useEffect(() => { vehKindRef.current = vehicle; }, [vehicle]);

  // play a clip (crossfade from the current one)
  function play(key: string) {
    const next = actionsRef.current[key];
    if (!next) return;
    const prev = curActionRef.current;
    next.reset();
    next.enabled = true;
    next.setLoop(loopOn ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !loopOn;
    next.setEffectiveWeight(1);
    next.fadeIn(0.2);
    next.play();
    if (prev && prev !== next) prev.fadeOut(0.2);
    curActionRef.current = next;
    setCurrent(key);
    setPlaying(true);
  }

  // re-apply loop mode to the running clip when the toggle changes
  useEffect(() => {
    const a = curActionRef.current;
    if (a) { a.setLoop(loopOn ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loopOn; }
  }, [loopOn]);

  // pick a vehicle: load its default seat offset and snap the character into the
  // Sitting clip so you immediately see how it sits.
  function selectVehicle(v: VehKind) {
    setVehicle(v);
    setSeat(SEAT_DEFAULTS[v]);
    if (v !== 'none') { const sk = clips.find((c) => /sitting/i.test(c.label))?.key; if (sk) play(sk); }
  }

  // build / remove the vehicle model when the selection changes
  useEffect(() => {
    const scene = sceneRef.current; if (!scene) return;
    if (vehObjRef.current) { scene.remove(vehObjRef.current); vehObjRef.current = null; }
    if (vehicle !== 'none') {
      try { const obj = VEH_MODELS[vehicle].build(); scene.add(obj); vehObjRef.current = obj; }
      catch (e) { showError('vehicle build failed: ' + ((e as Error).stack || e)); }
    }
  }, [vehicle]);

  // place the character on the seat (feet origin offset) — or reset to origin
  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    if (poseMode) return;                              // pose mode owns the transforms
    if (vehicle !== 'none') {
      root.position.set(seat.x, seat.y, seat.z);
      root.rotation.y = (seat.ry * Math.PI) / 180;
    } else {
      root.position.set(0, 0, 0);
      root.rotation.y = 0;
    }
  }, [seat, vehicle, poseMode]);

  // enter / leave the IK pose editor
  useEffect(() => {
    const rig = rigRef.current; if (!rig) return;
    if (poseMode) {
      const root = rootRef.current;
      if (!root) { setStatus('load the model first'); setPoseMode(false); return; }
      setPlaying(false);   // freeze the clip so the pose is editable
      setOrbit(false);     // OrbitControls takes over the camera
      rig.enter(root);
    } else {
      rig.exit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseMode]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (e) {
      showError('WebGL init failed: ' + ((e as Error).stack || e));
      setStatus('WebGL init failed (see overlay)');
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const scene = new THREE.Scene();
    sceneRef.current = scene;   // expose for the vehicle build/remove effect
    scene.background = new THREE.Color(0xffffff);
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xc0c6cf, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 6, 4); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-4, 2, -3); scene.add(fill);
    const center = new THREE.Vector3(0, 0.9, 0);
    const rig = createPoseRig(scene, cam, canvas, new THREE.Vector3(0, 0.7, 0));
    rigRef.current = rig;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false); cam.aspect = w / h || 1; cam.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

    let raf = 0; const clock = new THREE.Clock(); let acc = 0;
    loadPlayerGlb().then((h) => {
      if (!h) { setStatus('FAILED to load model'); return; }
      mixerRef.current = h.mixer; rootRef.current = h.root;
      scene.add(h.root);
      const box = new THREE.Box3().setFromObject(h.root); box.getCenter(center);
      // build an action for EVERY clip in the FBX (incl. ones the game doesn't map)
      const list: Clip[] = [];
      for (const clip of (h.root.animations || [])) {
        const k = clip.name;
        actionsRef.current[k] = h.mixer.clipAction(clip);
        list.push({ key: k, label: clip.name.replace(/^.*\|/, '').replace(/^Man_/, ''), dur: clip.duration });
      }
      setClips(list);
      setStatus(`loaded · ${list.length} clips · ${(h.root as THREE.Object3D).children.length} parts`);
      // autostart on Walk if present, else the first clip
      const startK = list.find((c) => /walk/i.test(c.label))?.key || list[0]?.key;
      if (startK) play(startK);
    });

    const loop = () => {
      raf = requestAnimationFrame(loop);
      try {
        const dt = Math.min(0.05, clock.getDelta());
        const mixer = mixerRef.current, root = rootRef.current;
        if (mixer && root) {
          if (playingRef.current) mixer.update(dt);
          applyGymArms(armRef.current);                       // gym muscle slider (re-applied each frame)
          root.updateMatrixWorld(true);
          if (!rig.active()) {                                // pose mode drives its own IK
            // moto/car show their custom seated pose; otherwise the knee IK fix
            if (vehKindRef.current === 'motorcycle') applyVehiclePose(root, 'bike');
            else if (vehKindRef.current === 'car') applyVehiclePose(root, 'car');
            else { if (ikRef.current) solveLegIK(); if (gunRef.current) applyGunPose(root); } // gun = upper-body overlay
          }
        }
        if (rig.active()) {
          rig.update();                                       // OrbitControls + handle tracking
        } else {
          if (orbitRef.current) angleRef.current += dt * 0.5;
          const a = angleRef.current;
          // frame wider and on the vehicle origin when one is shown
          const veh = vehObjRef.current;
          const cx = veh ? 0 : center.x, cy = veh ? 0.6 : center.y, cz = veh ? 0 : center.z;
          const dist = veh ? 5.4 : 3.6;
          cam.position.set(cx + Math.sin(a) * dist, cy + 0.6, cz + Math.cos(a) * dist);
          cam.lookAt(cx, cy, cz);
        }
        renderer.render(scene, cam);
        // throttle the clip-time readout (~6/s)
        acc += dt;
        if (acc > 0.16) { acc = 0; const ca = curActionRef.current; if (ca) setClipTime(ca.time); }
      } catch (e) {
        cancelAnimationFrame(raf);                  // stop the loop so it doesn't spam
        showError('render loop crashed: ' + ((e as Error).stack || e));
      }
    };
    loop();
    return () => { rig.exit(); cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const curClip = clips.find((c) => c.key === current);
  const seatOut = vehicle !== 'none'
    ? `${vehicle}: offset [${seat.x.toFixed(3)}, ${seat.y.toFixed(3)}, ${seat.z.toFixed(3)}], rotationY ${seat.ry}deg`
    : '';

  return (
    <div className="studio">
      <div className="viewport"><canvas ref={canvasRef} /></div>
      <div className="panel">
        <h1>🎬 Animation Studio</h1>
        <div className="status">{status}</div>

        <div className="sec">Animations</div>
        <div className="clips">
          {clips.map((c) => (
            <button key={c.key} className={'clipbtn' + (c.key === current ? ' active' : '')}
              onClick={() => play(c.key)} title={`${c.dur.toFixed(2)}s`}>{c.label}</button>
          ))}
          <button className={'clipbtn' + (gun ? ' active' : '')} onClick={() => setGun((g) => !g)}
            title="postura: segurar arma, sobreposta ao clip atual (in-game só com arma em punho)">🔫 Segurar arma</button>
        </div>
        {curClip && (
          <div className="now">▶ <b>{curClip.label}</b> — {clipTime.toFixed(2)}s / {curClip.dur.toFixed(2)}s</div>
        )}

        <div className="hr" />
        <div className="sec">Seat / Vehicle (sitting pose)</div>
        <div className="clips">
          {(['none', 'motorcycle', 'car', 'boat'] as VehKind[]).map((v) => (
            <button key={v} className={'clipbtn' + (v === vehicle ? ' active' : '')} onClick={() => selectVehicle(v)}>
              {v === 'none' ? 'None' : v === 'motorcycle' ? 'Moto' : v === 'car' ? 'Carro' : 'Barco'}
            </button>
          ))}
        </div>
        {vehicle !== 'none' && (
          <>
            <SeatSlider label="X" val={seat.x} min={-1.2} max={1.2} step={0.005} on={(v) => setSeat((s) => ({ ...s, x: v }))} />
            <SeatSlider label="Y" val={seat.y} min={-0.5} max={1.6} step={0.005} on={(v) => setSeat((s) => ({ ...s, y: v }))} />
            <SeatSlider label="Z" val={seat.z} min={-1.2} max={1.2} step={0.005} on={(v) => setSeat((s) => ({ ...s, z: v }))} />
            <SeatSlider label="Rot Y°" val={seat.ry} min={-180} max={180} step={1} on={(v) => setSeat((s) => ({ ...s, ry: v }))} />
            <button className="btn" onClick={() => setSeat(SEAT_DEFAULTS[vehicle])}>↺ Reset offset</button>

            <div className="sec">Coordenadas — copie e cole pra IA ajustar</div>
            <textarea className="out" readOnly value={seatOut} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            <button className="btn" onClick={() => navigator.clipboard && navigator.clipboard.writeText(seatOut)}>📋 Copiar coordenadas</button>
          </>
        )}

        <div className="hr" />
        <div className="sec">Pose editor (IK)</div>
        <button className="btn" onClick={() => setPoseMode((p) => !p)}>
          {poseMode ? '✓ Sair do modo pose' : '✎ Entrar no modo pose'}
        </button>
        {poseMode && (
          <>
            <div style={{ fontSize: 12, color: '#666' }}>
              Clique numa bolinha e arraste as setas. O membro segue com IK (pé→perna, mão→braço).<br />
              <span style={{ color: '#2f9fd6' }}>● pés</span> · <span style={{ color: '#2fd68a' }}>● mãos</span> · <span style={{ color: '#e2a33a' }}>● quadril</span> · <span style={{ color: '#c46fe2' }}>● cabeça</span>. Girar câmera = arraste o vazio.
            </div>
            <button className="btn" onClick={() => setPoseOut(rigRef.current ? rigRef.current.dumpPose() : '')}>⤓ Ler pose atual</button>
            <textarea className="out" readOnly value={poseOut} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            <button className="btn" onClick={() => navigator.clipboard && navigator.clipboard.writeText(poseOut)}>📋 Copiar pose</button>
          </>
        )}

        <div className="hr" />
        <div className="sec">Playback</div>
        <label className="row" style={{ justifyContent: 'space-between' }}>Speed <b>{speed.toFixed(2)}×</b></label>
        <input type="range" min={0} max={3} step={0.05} value={speed}
          onChange={(e) => setSpeed(parseFloat((e.target as HTMLInputElement).value))} />
        <button className="btn" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>
        <label className="row"><input type="checkbox" checked={loopOn} onChange={(e) => setLoopOn((e.target as HTMLInputElement).checked)} /> Loop</label>
        <label className="row"><input type="checkbox" checked={orbit} onChange={(e) => setOrbit((e.target as HTMLInputElement).checked)} /> Auto-orbit camera</label>

        <div className="hr" />
        <div className="sec">Físico (academia)</div>
        <label className="row" style={{ justifyContent: 'space-between' }}>💪 Músculo dos braços <b>{arm.toFixed(2)}×</b></label>
        <input type="range" min={1} max={1.5} step={0.05} value={arm}
          onChange={(e) => setArm(parseFloat((e.target as HTMLInputElement).value))} />
        <div style={{ color: '#888', fontSize: 11 }}>1.00× = normal · 1.50× = braços no máximo (academia)</div>

        <div className="hr" />
        <div className="sec">Debug</div>
        <label className="row">
          <input type="checkbox" checked={ik} onChange={(e) => setIk((e.target as HTMLInputElement).checked)} />
          Knee IK fix <span style={{ color: '#888', fontSize: 11 }}>(off = raw FBX)</span>
        </label>

        <div style={{ marginTop: 'auto', fontSize: 11, color: '#999' }}>Tiny Crime · dev studio · React + Three.js</div>
      </div>
    </div>
  );
}

// One labelled slider for an X/Y/Z/rotation seat field.
function SeatSlider({ label, val, min, max, step, on }:
  { label: string; val: number; min: number; max: number; step: number; on: (v: number) => void }) {
  return (
    <label className="row" style={{ flexWrap: 'wrap' }}>
      <span style={{ width: 46 }}>{label}</span>
      <b style={{ width: 56, textAlign: 'right' }}>{val.toFixed(label.startsWith('Rot') ? 0 : 3)}</b>
      <input type="range" min={min} max={max} step={step} value={val} style={{ flex: 1, minWidth: 130 }}
        onChange={(e) => on(parseFloat((e.target as HTMLInputElement).value))} />
    </label>
  );
}

// Catch render-time errors so a crash shows the message instead of a blank page.
class ErrorBoundary extends React.Component<{ children: unknown }, { err: unknown }> {
  constructor(p: { children: unknown }) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err: unknown) { return { err }; }
  componentDidCatch(err: unknown) { showError('React render error: ' + ((err as Error)?.stack || err)); }
  render() {
    if (this.state.err) {
      return <div style={{ padding: 24, color: '#a00', font: '14px ui-monospace,monospace', whiteSpace: 'pre-wrap' }}>
        Studio crashed:{'\n'}{(this.state.err as Error)?.stack || String(this.state.err)}
      </div>;
    }
    return this.props.children as React.ReactElement;
  }
}

createRoot(document.getElementById('root')!).render(<ErrorBoundary><Studio /></ErrorBoundary>);
