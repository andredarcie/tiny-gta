import * as THREE from 'three';
import {rand} from '@/core/constants.js';

// DEATH POOL ("bloodstain") do multiplayer assíncrono — estilo Demon's/Dark Souls.
// É a poça que um jogador MORTO deixa no mundo, visível pra todos os outros online.
// Diferente da poça de sangue comum de NPC (effects/blood-puddle.js): além da mancha
// escura no chão, tem um FACHO vertical translúcido (beacon) que brilha de longe pra
// chamar atenção e um ANEL pulsante — a leitura é "tem alguém/algo aqui pra pegar".
// Fiel ao estilo do projeto: sem asset binário, só primitivas + materiais.
//
// updateBloodstains (js/bloodstains.js) gira o grupo, pulsa o anel/facho e gerencia
// o rótulo flutuante com o nome da vítima + o dinheiro. Pega o anel/facho por
// userData.ring / userData.beam (clonados por instância, então podem animar opacidade
// independente e ser dados como dispose ao coletar a poça).
const STAIN = 0x6e001c;   // mancha escura no chão (vinho)
const GLOW = 0xff2e5a;    // brilho do anel/facho (rosa-sangue, casa com a paleta neon do jogo)

// puddle/splatter compartilham o material (não animam opacidade individual).
const puddleMat = new THREE.MeshBasicMaterial({color: STAIN, transparent: true, opacity: .82, depthWrite: false});
const puddleGeo = new THREE.CircleGeometry(1, 22);
const ringGeo = new THREE.RingGeometry(.86, 1.04, 30);
const beamGeo = new THREE.CylinderGeometry(.42, .66, 6, 16, 1, true); // tubo aberto (open-ended)

export function makeDeathPool(): THREE.Group {
  const g = new THREE.Group();

  // mancha principal + alguns respingos menores em volta (variação por instância)
  const puddle = new THREE.Mesh(puddleGeo, puddleMat);
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = .02;
  puddle.scale.set(1.35, 1.05, 1);
  g.add(puddle);
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Mesh(puddleGeo, puddleMat);
    s.rotation.x = -Math.PI / 2;
    s.scale.set(rand(.18, .42), rand(.14, .32), 1);
    s.position.set(rand(-1, 1), .022, rand(-.8, .8));
    g.add(s);
  }

  // anel pulsante no chão (clonado: anima opacidade/escala por instância)
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: GLOW, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide,
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .05;
  ring.scale.set(1.5, 1.5, 1);
  g.add(ring);

  // facho vertical translúcido (beacon) — additive, sem depthWrite pra não furar a
  // transparência. Visível de longe sem ofuscar de perto.
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: GLOW, transparent: true, opacity: .16, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  beam.position.y = 3;
  g.add(beam);

  g.userData.ring = ring;
  g.userData.beam = beam;
  g.renderOrder = 8; // depois do chão; antes dos sprites de rótulo (renderOrder 20)
  return g;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category: 'Effects', label: 'Death pool (bloodstain)', build: () => makeDeathPool()};
