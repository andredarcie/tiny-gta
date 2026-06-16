import {randomUUID} from 'node:crypto';
import {redis} from '../lib/redis.js';
import {cors, jsonBody} from '../lib/http.js';
import * as C from '../lib/scores.js';

// POST /api/session  (body opcional {pid, name})
// O jogo chama isto ao INICIAR uma partida. Devolve um token de sessão único e
// de vida curta (exigido no envio do score, dificulta replay/spam e dá ao
// servidor a duração real da partida para a checagem de plausibilidade) e —
// quando o cliente manda sua identidade (id estável + nick) — o SAVE do jogador
// (dinheiro atual + armas + músculo + casa + coletáveis), para continuar de onde
// parou. O dinheiro salvo vira a "base" da sessão, que o /api/scores soma ao
// teto de plausibilidade.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') { res.status(405).json({error: 'method_not_allowed'}); return; }

  // identidade opcional: restaura o progresso só quando id + nick batem
  const body = jsonBody(req);
  const pid = C.sanitizePid(body.pid);
  const name = C.sanitizeName(body.name);
  let save = null;
  if (pid && name) {
    const member = C.saveMember(pid, name);
    const blob = await redis.get(C.SAVE_PREFIX + member);
    if (blob && typeof blob === 'object') save = blob;
    else {
      // migração: jogadores que só têm o save antigo (sorted set só-dinheiro)
      const legacy = await redis.zscore(C.SAVE_LEGACY_KEY, member);
      if (legacy != null) save = {money: Math.max(0, Math.floor(Number(legacy) || 0))};
      else {
        // jogador antigo SEM save: herda UMA vez o valor do ranking (pico->atual)
        // como saldo inicial. NÃO consome aqui (pra sobreviver a uma sessão que
        // não chega a salvar) — o /api/scores apaga o seed ao gravar o save.
        const seed = await redis.hget(C.SEED_KEY, name);
        if (seed != null) save = {money: Math.max(0, Math.floor(Number(seed) || 0))};
      }
    }
  }
  const money = save && Number.isFinite(save.money) ? Math.max(0, Math.floor(save.money)) : 0;

  const token = randomUUID();
  const startedAt = Date.now();
  await redis.set(C.SESSION_PREFIX + token, {at: startedAt, base: money}, {ex: C.SESSION_TTL});
  res.status(200).json({token, startedAt, money, save});
}
