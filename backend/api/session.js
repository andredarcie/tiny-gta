import {randomUUID} from 'node:crypto';
import {redis} from '../lib/redis.js';
import {cors, jsonBody} from '../lib/http.js';
import * as C from '../lib/scores.js';

// POST /api/session  (body opcional {pid, name})
// O jogo chama isto ao INICIAR uma partida. Devolve um token de sessão único e
// de vida curta (exigido no envio do score, dificulta replay/spam e dá ao
// servidor a duração real da partida para a checagem de plausibilidade) e —
// quando o cliente manda sua identidade (id estável + nick) — o SALDO SALVO,
// para o jogador continuar de onde parou. Esse saldo vira a "base" da sessão,
// que o /api/scores soma ao teto de plausibilidade.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({error: 'method_not_allowed'}); return; }

  // identidade opcional: restaura o progresso só quando id + nick batem
  const body = jsonBody(req);
  const pid = C.sanitizePid(body.pid);
  const name = C.sanitizeName(body.name);
  let money = 0;
  if (pid && name) {
    const saved = await redis.zscore(C.SAVE_KEY, C.saveMember(pid, name));
    money = Math.max(0, Math.floor(Number(saved) || 0));
  }

  const token = randomUUID();
  const startedAt = Date.now();
  await redis.set(C.SESSION_PREFIX + token, {at: startedAt, base: money}, {ex: C.SESSION_TTL});
  res.status(200).json({token, startedAt, money});
}
