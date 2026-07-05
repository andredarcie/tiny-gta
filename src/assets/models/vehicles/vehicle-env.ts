import * as THREE from 'three';
import {makeRng} from '@/core/rng.ts';

// Acabamento de superfície dos veículos — tira a pintura do "chapado" SEM brilhar.
//
// Tentativa anterior usava um env map (reflexo do céu via IBL). Problema: o IBL soma
// luz AMBIENTE que não obedece ao ciclo dia/noite — o carro "brilhava no escuro" e o
// excesso lavava a superfície (parecia ainda mais chapada). Reflexo é difícil de
// calibrar e foi removido.
//
// Aqui o "não-chapado" vem de TEXTURA DE COR de verdade (não de luz): um mapa de flake
// metálico (map) com microvariação clara/escura, multiplicado pela cor da lataria. Ele
// é DIFUSO — iluminado pelos mesmos lights da cena —, então escurece de noite junto com
// tudo e nunca brilha sozinho. Um roughnessMap sutil ainda quebra o brilho do sol pra
// dar uma cintilada metálica. Aplicado a todo material pintado/cromado de cada veículo.
//
// Escopo PROPOSITAL nos veículos; só pelos wrappers makeX() (gameplay).

// Flake metálico como MAPA DE COR (albedo). Base quase branca (a cor da lataria segue
// viva) com flecos esparsos claros e escuros — lê como verniz metalizado de perto, não
// um bloco de cor liso. Multiplica a .color do material.
let paintMap: THREE.Texture | null = null;
function buildPaintMap(): THREE.Texture {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  const { random: rnd, irand } = makeRng(0x3c0a7e);
  x.fillStyle = '#e4e4e4'; x.fillRect(0, 0, S, S);     // base ~0.89
  // Nuvens metálicas suaves (variação de MÉDIA escala dentro do painel) — tira o
  // "bloco de cor" mesmo de média distância.
  for (let k = 0; k < 16; k++) {
    const r = irand(38, 92), cx = rnd() * S, cy = rnd() * S, light = rnd() < 0.5;
    const a = (0.12 + rnd() * 0.14).toFixed(2);
    const g = x.createRadialGradient(cx, cy, 2, cx, cy, r);
    g.addColorStop(0, light ? `rgba(255,255,255,${a})` : `rgba(96,96,104,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
  }
  // Flake metálico FINO e nítido (sparkle de perto) — claro e escuro com bom contraste.
  for (let k = 0; k < 7000; k++) {
    const bright = rnd() < 0.5;
    x.fillStyle = bright
      ? `rgba(255,255,255,${(0.45 + rnd() * 0.55).toFixed(2)})`
      : `rgba(78,78,86,${(0.40 + rnd() * 0.5).toFixed(2)})`;
    x.fillRect(rnd() * S, rnd() * S, irand(1, 2), irand(1, 2));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;                  // map = cor (sRGB)
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// Microrrelevo de rugosidade: o brilho do sol "cintila" pela lataria em vez de um
// ponto liso (flake catando luz). Sutil — só varia o specular direto.
let flakeTex: THREE.Texture | null = null;
function buildFlake(): THREE.Texture {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d')!;
  const img = x.createImageData(S, S), d = img.data;
  const { irand } = makeRng(0x71a4e);
  for (let i = 0; i < d.length; i += 4) {
    const v = irand(150, 245);
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);                 // dado linear (sem sRGB)
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

// Aplica o acabamento (map + roughnessMap) aos materiais PBR pintados/cromados/plástico
// do veículo. Idempotente. Pula vidro (transparente), pneu/tecido (foscos) e o que já
// tem textura própria (ex.: camuflagem do army-truck). NÃO mexe em iluminação/emissive.
export function applyVehicleEnv(root: THREE.Object3D): void {
  if (!paintMap) paintMap = buildPaintMap();
  if (!flakeTex) flakeTex = buildFlake();
  root.traverse(o => {
    const mm = (o as THREE.Mesh).material;
    if (!mm) return;
    for (const m of Array.isArray(mm) ? mm : [mm]) {
      const sm = m as THREE.MeshStandardMaterial;
      if (!sm.isMeshStandardMaterial || sm.userData.vFinish) continue;
      if (!sm.transparent && sm.roughness < 0.7) {
        if (!sm.map) sm.map = paintMap;
        if (!sm.roughnessMap) sm.roughnessMap = flakeTex;
        sm.needsUpdate = true;
      }
      sm.userData.vFinish = true;
    }
  });
}
