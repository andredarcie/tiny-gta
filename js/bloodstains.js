// MULTIPLAYER ASSÍNCRONO estilo Demon's Souls / Dark Souls — "bloodstains".
//
// Quando um jogador MORRE (WASTED), deixa uma POÇA no lugar da morte carregando o
// dinheiro que perdeu (a "conta do hospital"). Essa poça é gravada no backend
// (Redis) e fica visível para TODOS os outros jogadores online, com o nome da
// vítima flutuando em cima. O PRIMEIRO outro jogador que passar por cima dela leva
// o dinheiro — a coleta é um GETDEL atômico no servidor, então só um ganha.
//
// Fluxo:
//   - player.js (na morte) chama refs.dropDeathPool(x,z,lost) -> POST create.
//   - updateBloodstains() (loop principal) busca a lista periodicamente, instancia
//     as poças no mundo, anima e detecta a coleta por proximidade.
//   - ao coletar, credita via economy.earn('bloodstain') (idempotente por id) — o
//     flush normal do ledger reflete no backend; o teto 'bloodstain' em MG_MAX_PAYOUT
//     limita uma tx forjada.
//
// Tudo é "best-effort": offline / backend fora do ar simplesmente não mostra poças e
// não quebra o jogo (o jogador continua perdendo/ganhando dinheiro normalmente).
import * as THREE from 'three';
import {state, refs} from './state.js';
import {economy} from './economy.js';
import {scene} from './engine.js';
import {playerPos} from './player.js';
import {message} from './hud.js';
import {blip} from './audio.js';
import {groundHeight} from './constants.js';
import {MiniGame} from './minigame.js';
import {makeDeathPool} from '../assets/models/effects/death-pool.js';
import {makeSpeechBubble} from '../assets/models/characters/speech-bubble.js';
import {API, getNickname, getPlayerId, getSessionToken, signSession} from './leaderboard.js';

const CLAIM_R = 3.6;            // raio de coleta (a pé ou de carro), igual aos coletáveis
const REFRESH_SEC = 25;         // intervalo entre buscas da lista (segundos de jogo)
const LABEL_NEAR = 14, LABEL_FAR = 46; // faixa de fade do rótulo (some quando longe)
const LABEL_MAKE2 = 46 * 46;    // cria o rótulo dentro deste raio (²)
const LABEL_DROP2 = 60 * 60;    // descarta o rótulo além deste raio (² — histerese)

// id -> {id,name,money,x,z,y,g,phase,label,claiming}
const pools = new Map();
let lastFetch = -999, fetching = false;

const fmtMoney = n => '$' + Math.max(0, Math.floor(Number(n) || 0)).toLocaleString('en-US');

// ----- criação/remoção das poças no mundo ----------------------------------
function addPool(id, s) {
  const x = Number(s.x) || 0, z = Number(s.z) || 0;
  const money = Math.max(0, Math.floor(Number(s.money) || 0));
  const name = String(s.name || '').slice(0, 12);
  const y = groundHeight(x, z);
  const g = makeDeathPool();
  g.position.set(x, y + .01, z);
  g.rotation.y = Math.random() * Math.PI * 2;
  scene.add(g);
  pools.set(id, {id, name, money, x, z, y, g, phase: Math.random() * 6.283, label: null, claiming: false});
}

function disposeLabel(p) {
  if (!p.label) return;
  scene.remove(p.label);
  p.label.material.map?.dispose?.();
  p.label.material.dispose();
  p.label = null;
}

function removePool(p) {
  disposeLabel(p);
  scene.remove(p.g);
  // ring/beam usam material clonado por instância (puddle/splatter compartilham o do módulo)
  p.g.userData.ring?.material?.dispose?.();
  p.g.userData.beam?.material?.dispose?.();
  pools.delete(p.id);
}

function ensureLabel(p) {
  if (p.label) return;
  const spr = makeSpeechBubble((p.name || '???') + '  ' + fmtMoney(p.money), {worldWidth: 3.4});
  spr.position.set(p.x, p.y + 2.7, p.z);
  scene.add(spr);
  p.label = spr;
}

// ----- rede: cria a poça da própria morte ----------------------------------
// Chamada por player.js no momento da morte. money = dinheiro perdido (conta do
// hospital). NÃO renderiza localmente: a poça é dos OUTROS jogadores; o servidor
// marca a própria como `own` e a lista a ignora.
refs.dropDeathPool = function (x, z, money) {
  const m = Math.max(0, Math.floor(Number(money) || 0));
  if (m <= 0) return;
  const name = getNickname(), token = getSessionToken(), pid = getPlayerId();
  if (!name || !token || !pid) return; // sem sessão/apelido (offline): não grava poça
  const t = Date.now();
  // assina x.z.money.t (x,z arredondados) — igual ao backend lib/auth.bloodstainSig.
  const sig = signSession(Math.round(x) + '.' + Math.round(z) + '.' + m + '.' + t);
  try {
    fetch(API + '/api/bloodstains', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'create', token, pid, name, x, z, money: m, t, sig}),
      keepalive: true,
    }).catch(() => {});
  } catch (e) {}
  lastFetch = -999; // força um refresh logo, pra a poça aparecer pros que estão perto
};

// ----- rede: busca a lista e reconcilia o mundo ----------------------------
async function refreshBloodstains() {
  if (fetching) return;
  fetching = true;
  const pid = getPlayerId();
  try {
    const r = await fetch(API + '/api/bloodstains?limit=120' + (pid ? '&pid=' + encodeURIComponent(pid) : ''));
    const data = await r.json();
    const list = Array.isArray(data.stains) ? data.stains : [];
    const incoming = new Set();
    for (const s of list) {
      if (!s || typeof s !== 'object') continue;
      const id = String(s.id || '');
      if (!id || s.own) continue;     // pula a própria poça (não dá pra coletar a sua)
      incoming.add(id);
      if (!pools.has(id)) addPool(id, s);
    }
    // remove as que sumiram do servidor (coletadas por outro / expiradas), exceto
    // uma com coleta em voo (deixa o claim resolver).
    for (const [, p] of pools) if (!incoming.has(p.id) && !p.claiming) removePool(p);
  } catch (e) {}
  fetching = false;
}

// ----- rede: coleta (o primeiro a passar leva) ------------------------------
async function tryClaim(p) {
  p.claiming = true;
  const token = getSessionToken(), pid = getPlayerId();
  if (!token || !pid) { p.claiming = false; return; }
  try {
    const r = await fetch(API + '/api/bloodstains', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action: 'claim', token, pid, id: p.id}),
    });
    const data = await r.json().catch(() => ({}));
    if (data && data.claimed) {
      const money = Math.max(0, Math.floor(Number(data.money) || 0));
      // id estável (curto) -> crédito idempotente; 'bloodstain' bate com o teto do backend.
      if (money > 0) economy.earn(money, 'bloodstain', {id: ('bs:' + p.id).slice(0, 32)});
      const who = String(data.name || p.name || '').trim();
      message('PICKED UP ' + (who ? who + "'S " : '') + 'BLOOD MONEY  +' + fmtMoney(money), 'var(--gold)');
      blip([880, 1320, 1760], .09, 'triangle', .2);
    }
    // claimed:false -> alguém pegou antes / expirou: só some do mundo.
    removePool(p);
  } catch (e) {
    p.claiming = false; // soluço de rede: tenta de novo na próxima passagem
  }
}

// ----- loop -----------------------------------------------------------------
export function updateBloodstains(dt) {
  if (!state.started) return;
  const online = !!getNickname() && !!getSessionToken();
  if (online && state.time - lastFetch > REFRESH_SEC) { lastFetch = state.time; refreshBloodstains(); }
  if (!pools.size) return;

  const pp = playerPos();
  const inInterior = !!state.interior;
  // coleta só no mundo aberto, fora de cut-scene/mini-game exclusivo e com controle livre
  const canClaim = online && !inInterior && !MiniGame.busy &&
    state.mode !== 'cut' && !state.cine && !state.controlsLocked;
  const cr2 = CLAIM_R * CLAIM_R;

  for (const [, p] of pools) {
    const dx = pp.x - p.x, dz = pp.z - p.z, d2 = dx * dx + dz * dz;
    // animação (barata): gira o grupo e pulsa anel + facho (cada poça com sua fase)
    const g = p.g;
    g.visible = !inInterior;
    g.rotation.y += dt * .6;
    const pulse = (Math.sin(state.time * 3 + p.phase) + 1) * .5;
    const ring = g.userData.ring, beam = g.userData.beam;
    if (ring) { ring.material.opacity = .3 + pulse * .4; const rs = 1.5 * (1 + pulse * .12); ring.scale.set(rs, rs, 1); }
    if (beam) beam.material.opacity = .08 + pulse * .14;

    // rótulo flutuante: cria perto, descarta longe; fade por distância
    if (!inInterior && d2 < LABEL_MAKE2) {
      ensureLabel(p);
      const dist = Math.sqrt(d2);
      const near = Math.max(0, Math.min(1, (LABEL_FAR - dist) / (LABEL_FAR - LABEL_NEAR)));
      p.label.visible = true;
      p.label.material.opacity = near;
    } else if (p.label && (d2 > LABEL_DROP2 || inInterior)) {
      if (inInterior) p.label.visible = false; else disposeLabel(p);
    }

    // coleta ao passar por cima: o primeiro a chegar leva (resto: poça some na resposta)
    if (canClaim && !p.claiming && d2 < cr2) tryClaim(p);
  }
}

// debug/snapshot (render_game_to_text)
refs.getBloodstainsState = () => ({active: pools.size});
