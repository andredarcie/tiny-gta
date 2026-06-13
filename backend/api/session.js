import {randomUUID} from 'node:crypto';
import {redis} from '../lib/redis.js';
import {cors} from '../lib/http.js';
import {SESSION_PREFIX, SESSION_TTL} from '../lib/scores.js';

// POST /api/session
// O jogo chama isto ao INICIAR uma partida. Devolve um token de sessão único e
// de vida curta; ele é exigido (e consumido) no envio do score, o que dificulta
// replay/spam e dá ao servidor a duração real da partida para a checagem de
// plausibilidade.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({error: 'method_not_allowed'}); return; }

  const token = randomUUID();
  const startedAt = Date.now();
  await redis.set(SESSION_PREFIX + token, String(startedAt), {ex: SESSION_TTL});
  res.status(200).json({token, startedAt});
}
