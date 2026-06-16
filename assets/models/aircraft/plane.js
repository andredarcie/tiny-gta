import * as THREE from 'three';
import {scene} from '../../../js/engine.js';

// Model convention: default-export {category,label,build}. build(opts) is PURE — it
// creates and returns a fresh Object3D and never calls scene.add. The model viewer
// discovers every model via import.meta.glob and renders this descriptor.
//
// "SKY DUSTER" — a single-engine biplane crop-duster (red Stearman-style stunt plane).
// Gameplay contract (player.js): forward is +Z (the propeller is at the nose); the
// spinning prop is exposed as g.userData.prop and rotated about its local Z; the wheels
// touch the ground at y=0 and the fuselage centreline sits at y≈1.05, matching the
// seated-pilot offset (0,-0.45,0.5).

// --- small geometry helpers --------------------------------------------------

// Cambered airfoil cross-section: chord along local +X (0..chord), thickness along Y.
function airfoil(chord, thick){
  const c = chord, t = thick;
  const s = new THREE.Shape();
  s.moveTo(0, 0);                                          // leading edge
  s.bezierCurveTo(c * 0.06, t, c * 0.45, t * 0.95, c, t * 0.10);  // upper surface
  s.bezierCurveTo(c * 0.45, -t * 0.30, c * 0.06, -t * 0.34, 0, 0); // lower surface
  return s;
}

// A wing / tailplane: span along X, chord along Z (leading edge toward +Z), centred at
// the origin, lift side up. Rounded tip fairings give a clean silhouette.
function makeWing(span, chord, thick, mat){
  const geo = new THREE.ExtrudeGeometry(airfoil(chord, thick),
    {depth: span, steps: 1, bevelEnabled: false, curveSegments: 10});
  geo.translate(-chord / 2, 0, -span / 2);
  geo.rotateY(Math.PI / 2);            // chord X→Z (leading edge +Z), span Z→X
  const wing = new THREE.Group();
  const panel = new THREE.Mesh(geo, mat); panel.castShadow = true; wing.add(panel);
  for (const sx of [-1, 1]){
    const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat);
    tip.scale.set(0.26, thick * 1.05, chord * 0.5);
    tip.position.x = sx * span / 2; wing.add(tip);
  }
  return wing;
}

// A tube between two points (struts, gear legs, flying wires).
function strut(a, b, r, mat, shadow = true){
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = shadow;
  return m;
}

// A main wheel: dark tyre + bright hub, axle along X (rolls forward).
function makeWheel(radius, tube, hubM, tyreM){
  const w = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 16), tyreM);
  tyre.rotation.y = Math.PI / 2; tyre.castShadow = true; w.add(tyre);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, tube * 1.6, 10), hubM);
  hub.rotation.z = Math.PI / 2; w.add(hub);
  return w;
}

function build(opts = {}){
  const g = new THREE.Group();
  const bodyM  = new THREE.MeshStandardMaterial({color: opts.color ?? 0xcf3b34, roughness: 0.5, metalness: 0.15});
  const trimM  = new THREE.MeshStandardMaterial({color: 0xf3ecd8, roughness: 0.55});
  const darkM  = new THREE.MeshStandardMaterial({color: 0x1c1c24, roughness: 0.45, metalness: 0.55});
  const metalM = new THREE.MeshStandardMaterial({color: 0x767c85, roughness: 0.32, metalness: 0.85});
  const hubM   = new THREE.MeshStandardMaterial({color: 0xb9bdc4, roughness: 0.3, metalness: 0.75});
  const tyreM  = new THREE.MeshStandardMaterial({color: 0x141419, roughness: 0.92});
  const glassM = new THREE.MeshStandardMaterial({color: 0x16252e, roughness: 0.12, metalness: 0.25,
    transparent: true, opacity: 0.55});

  const CY = 1.05; // fuselage centreline height

  // --- fuselage: a smooth body of revolution, tapering nose to tail ---
  // Lathe profile points are (radius, axial); the mesh is rotated so the axial axis
  // runs along Z, nose (+axial) forward.
  const prof = [
    [0.05, -2.55], [0.13, -2.40], [0.24, -2.00], [0.38, -1.30], [0.47, -0.60],
    [0.52, 0.20], [0.51, 0.90], [0.49, 1.40], [0.47, 1.90], [0.45, 2.05],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const fus = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), bodyM);
  fus.rotation.x = Math.PI / 2; fus.position.set(0, CY, 0); fus.castShadow = true;
  g.add(fus);

  // cream trim band just behind the cowl
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.14, 18), trimM);
  band.rotation.x = Math.PI / 2; band.position.set(0, CY, 1.7); g.add(band);

  // --- engine cowling + radial-engine face ---
  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.5, 0.55, 18), metalM);
  cowl.rotation.x = Math.PI / 2; cowl.position.set(0, CY, 2.05); cowl.castShadow = true; g.add(cowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 10, 22), darkM);
  rim.position.set(0, CY, 2.32); g.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.46, 18), darkM);
  face.position.set(0, CY, 2.31); g.add(face);
  // exhaust stubs along the lower cowl sides
  for (const sx of [-1, 1]){
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8), metalM);
    ex.rotation.x = Math.PI / 2; ex.position.set(sx * 0.43, CY - 0.26, 1.6); g.add(ex);
  }

  // --- propeller (spins about its local Z, exposed as userData.prop) ---
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 16), metalM);
  spinner.rotation.x = Math.PI / 2; spinner.position.z = 0.2; spinner.castShadow = true; prop.add(spinner);
  const backplate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), metalM);
  backplate.rotation.x = Math.PI / 2; prop.add(backplate);
  const bsh = new THREE.Shape();
  bsh.moveTo(-0.085, 0); bsh.lineTo(0.085, 0);
  bsh.lineTo(0.055, 1.5); bsh.quadraticCurveTo(0, 1.66, -0.055, 1.5); bsh.lineTo(-0.085, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(bsh, {depth: 0.05, steps: 1, bevelEnabled: false, curveSegments: 4});
  bladeGeo.translate(0, 0, -0.025);
  for (let i = 0; i < 3; i++){
    const holder = new THREE.Group();
    const blade = new THREE.Mesh(bladeGeo, darkM);
    blade.position.y = 0.1; blade.rotation.y = 0.4; blade.castShadow = true; // radial + pitch twist
    holder.add(blade); holder.rotation.z = i * Math.PI * 2 / 3; prop.add(holder);
  }
  prop.position.set(0, CY, 2.6); g.add(prop); g.userData.prop = prop;

  // --- wings (biplane): cream, slightly staggered, upper wing larger ---
  const lower = makeWing(6.8, 1.2, 0.18, trimM);
  lower.position.set(0, 0.72, 0.35); g.add(lower);
  const upper = makeWing(7.4, 1.32, 0.2, trimM);
  upper.position.set(0, 2.02, 0.15); g.add(upper);

  // cabane struts: hold the upper wing centre-section over the cockpit
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const sx of [-1, 1]){
    g.add(strut(V(sx * 0.45, 1.48, 0.55), V(sx * 0.5, 1.93, 0.4), 0.04, darkM));
    g.add(strut(V(sx * 0.45, 1.48, -0.15), V(sx * 0.5, 1.93, -0.05), 0.04, darkM));
  }
  // interplane struts + flying wires near the wingtips
  for (const sx of [-1, 1]){
    const lf = V(sx * 2.25, 0.82, 0.45), lr = V(sx * 2.25, 0.82, -0.4);   // lower wing top
    const uf = V(sx * 2.2, 1.92, 0.35), ur = V(sx * 2.2, 1.92, -0.5);     // upper wing underside
    g.add(strut(lf, uf, 0.045, darkM));
    g.add(strut(lr, ur, 0.045, darkM));
    g.add(strut(lf, ur, 0.012, metalM, false)); // crossed bracing wires
    g.add(strut(lr, uf, 0.012, metalM, false));
  }

  // --- empennage: vertical fin + cream tailplane ---
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(1.05, 0);
  finShape.lineTo(0.62, 1.18); finShape.quadraticCurveTo(0.34, 1.3, 0.05, 0.95);
  finShape.quadraticCurveTo(-0.02, 0.5, 0.0, 0.0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, {depth: 0.08, steps: 1, bevelEnabled: false, curveSegments: 8});
  finGeo.translate(0, 0, -0.04); finGeo.rotateY(Math.PI / 2); // upright, thin across X
  const fin = new THREE.Mesh(finGeo, bodyM);
  fin.position.set(0, CY + 0.08, -1.6); fin.castShadow = true; g.add(fin);
  const tail = makeWing(2.7, 0.72, 0.12, trimM);
  tail.position.set(0, CY + 0.12, -2.25); g.add(tail);

  // --- open cockpit: leather coaming, raked windscreen, headrest fairing ---
  const coam = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 20), darkM);
  coam.rotation.x = Math.PI / 2; coam.scale.set(1, 1, 1.4); coam.position.set(0, 1.48, 0.2); g.add(coam);
  const pit = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), darkM); // recessed open cockpit
  pit.rotation.x = -Math.PI / 2; pit.scale.set(1, 1.4, 1); pit.position.set(0, 1.44, 0.2); g.add(pit);
  const ws = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.36, 0.3, 16, 1, true, Math.PI * 0.22, Math.PI * 0.56), glassM);
  ws.rotation.x = -0.22; ws.position.set(0, 1.6, 0.64); g.add(ws);
  const wsFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.022, 6, 18, Math.PI * 0.56), darkM);
  wsFrame.rotation.set(Math.PI / 2 - 0.22, 0, Math.PI * 0.72); wsFrame.position.set(0, 1.74, 0.64); g.add(wsFrame);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), bodyM);
  head.scale.set(0.9, 0.8, 1.5); head.position.set(0, 1.42, -0.35); g.add(head);

  // --- landing gear: faired main legs + tail wheel ---
  // main wheels: axle sits at the wheel's outer radius so the tyre rests on y=0
  const MR = 0.32, MT = 0.12, MOUT = MR + MT;
  for (const sx of [-1, 1]){
    const axle = V(sx * 1.0, MOUT, 0.55);
    g.add(strut(V(sx * 0.24, 0.66, 0.55), axle, 0.07, darkM));        // main leg
    g.add(strut(V(sx * 0.22, 0.66, -0.1), axle, 0.055, darkM));       // drag brace
    const fairing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 0.18), darkM);
    fairing.position.set(sx * 0.62, 0.55, 0.55); fairing.rotation.z = sx * 0.52; g.add(fairing);
    const wheel = makeWheel(MR, MT, hubM, tyreM);
    wheel.position.copy(axle); g.add(wheel);
  }
  // tail wheel
  const TOUT = 0.15 + 0.07;
  g.add(strut(V(0, 0.85, -2.4), V(0, TOUT + 0.06, -2.5), 0.05, darkM));
  const tw = makeWheel(0.15, 0.07, hubM, tyreM);
  tw.position.set(0, TOUT, -2.5); g.add(tw);

  return g;
}

export default {category: 'Aircraft', label: 'Plane', build};

// Back-compat: gameplay still calls makePlane() (adds to the scene as before).
export const makePlane = () => { const g = build(); scene.add(g); return g; };
