// Constantes e validações compartilhadas pelos endpoints.
import { hasProfanity } from './profanity.js';

const num = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);

export const LEADERBOARD_KEY = 'tinygta:leaderboard';
export const SESSION_PREFIX = 'tinygta:sess:';
export const RL_PREFIX = 'tinygta:rl:';
// Rate-limit próprio da CRIAÇÃO de sessão (mintar token): limita o grind
// automatizado do teto por tempo e o abuso de custo/escrita no Redis.
export const SESS_RL_PREFIX = 'tinygta:srl:';

// ----- SAVE / PROGRESSO POR JOGADOR -----------------------------------------
// Cada jogador tem um BLOB JSON de progresso (dinheiro atual + armas + músculo +
// casa + coletáveis) numa chave string `tinygta:save:<pid>|<nick>`, restaurado na
// partida seguinte. Chavear por (pid, nick) — e não só pelo nick público —
// impede que alguém digite o apelido alheio e herde o progresso: o pid é um UUID
// secreto no localStorage do dono.
export const SAVE_PREFIX = 'tinygta:save:';
// Sorted set ANTIGO (save só-dinheiro). Mantido só para migração: se ainda não
// existir o blob novo, o /api/session lê o saldo daqui.
export const SAVE_LEGACY_KEY = 'tinygta:save';
export const saveMember = (pid, name) => pid + '|' + name;

// SEED de migração (hash nome -> dinheiro): jogadores que JÁ estavam no ranking
// antes do sistema de save (logo, sem save) herdam aqui o valor do ranking como
// saldo inicial NA PRIMEIRA vez que jogam (pico -> atual). É consumido quando o
// save é gravado de fato, então cada nome é semeado uma vez só; nomes novos no
// ranking nunca entram neste hash. Fora desta migração, ninguém herda dinheiro
// de outro só digitando o apelido público.
export const SEED_KEY = 'tinygta:seed';

// Higieniza o blob de progresso vindo do cliente antes de gravar: limita
// profundidade/tamanho (evita guardar lixo gigante) e crava o dinheiro no teto
// de plausibilidade. Genérico de propósito — o backend não precisa conhecer o
// formato de cada "slot" (armas/casa/...); só impõe limites de segurança.
function sanitizeValue(v, depth) {
  if (depth > 4 || v == null) return null;
  const t = typeof v;
  if (t === 'number') return Number.isFinite(v) ? v : 0;
  if (t === 'boolean') return v;
  if (t === 'string') return v.slice(0, 32);
  if (Array.isArray(v)) {
    const a = [];
    for (let i = 0; i < v.length && a.length < 64; i++) {
      const s = sanitizeValue(v[i], depth + 1);
      if (s !== null) a.push(s);
    }
    return a;
  }
  if (t === 'object') {
    const o = {}; let n = 0;
    for (const k of Object.keys(v)) {
      if (n++ >= 32) break;
      if (k.length > 24) continue;
      const s = sanitizeValue(v[k], depth + 1);
      if (s !== null) o[k] = s;
    }
    return o;
  }
  return null;
}
export function sanitizeSave(raw, maxMoney) {
  const out = sanitizeValue(raw, 0);
  if (!out || typeof out !== 'object' || Array.isArray(out)) return null;
  const money = Math.floor(Number(out.money));
  out.money = Number.isFinite(money) ? Math.min(Math.max(money, 0), Math.max(0, maxMoney)) : 0;
  // teto de tamanho total: um save legítimo tem <1KB (poucas armas + 24 pacotes
  // + 5 rampas + casa). Acima de 8KB é forja/bug — não guarda, pra um cliente
  // adulterado não encher o Redis com blobs gigantes (o limite por nó acima já
  // barra o pior caso; este fecha a soma).
  if (JSON.stringify(out).length > 8192) return null;
  return out;
}

// pid do jogador: UUID v4 gerado no cliente. Aceita só o formato canônico para
// não poluir o set com chave forjada/lixo.
export function sanitizePid(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? s : null;
}

// Valor da sessão: instante de início + saldo restaurado (base de plausibilidade
// do /api/scores — um jogador que volta rico pode reenviar o saldo já salvo sem
// estourar o teto por tempo) + a IDENTIDADE (pid+nick) que criou o token. Os
// endpoints exigem que o envio bata com essa identidade, então um token copiado
// (devtools/cURL) não grava o nome de outro jogador. Aceita o formato antigo
// (só o timestamp / sem identidade) para não quebrar sessões em voo no deploy:
// quando pid/name vêm null, o binding simplesmente não é exigido.
export function parseSession(raw) {
  if (raw == null) return null;
  const norm = o => ({
    at: Number(o.at) || 0,
    base: Math.max(0, Number(o.base) || 0),
    pid: typeof o.pid === 'string' ? o.pid : null,
    name: typeof o.name === 'string' ? o.name : null,
  });
  if (typeof raw === 'object') return norm(raw);
  const s = String(raw);
  if (s[0] === '{') { try { return norm(JSON.parse(s)); } catch {} }
  return { at: Number(s) || 0, base: 0, pid: null, name: null };
}

// ----- Leaderboards POR MINI GAME -------------------------------------------
// Cada mini game tem o seu próprio ranking. Por jogo guardamos:
//   - um SORTED SET  tinygta:mg:<game>      member=nome  score=RATING calculado
//   - um HASH por jogador tinygta:mg:<game>:p:<nome> com os acumulados crus
//     (plays, wins, losses, earned, best) — a base do rating, recomputado a cada
//     envio. Separar os crus do rating deixa a fórmula evoluir sem perder dados.
export const MG_BOARD_PREFIX = 'tinygta:mg:';       // + game            -> sorted set
export const MG_PLAYER_PREFIX = 'tinygta:mg:';      // + game + ':p:' + nome -> hash
export const MG_RL_PREFIX = 'tinygta:mgrl:';        // rate-limit próprio dos mini games
export const MG_SCORE_CAP = num(process.env.MG_SCORE_CAP, 1_000_000); // teto por sessão

export const mgBoardKey = game => MG_BOARD_PREFIX + game;
export const mgPlayerKey = (game, name) => MG_BOARD_PREFIX + game + ':p:' + name;

// Ids de mini game aceitos (espelha o enum MiniGameId em js/minigame.js). Validar
// no servidor evita criar rankings de lixo a partir de um id forjado.
export const MG_GAME_IDS = new Set([
  'taxi', 'race', 'boat-race', 'offroad', 'vigilante', 'paramedic', 'firefighter',
  'rampage', 'rc-toyz', 'car-crusher', 'import-export', 'bomb-shop',
  'hidden-packages', 'stunt-jumps', 'overkill',
  'gym', 'dance', 'rocket-rampage',
]);

export function sanitizeGame(raw) {
  if (typeof raw !== 'string') return null;
  const g = raw.trim().toLowerCase();
  return MG_GAME_IDS.has(g) ? g : null;
}

// Parâmetros do rating (ajustáveis por env). Ver miniGameRating().
const MG_PRIOR_N = num(process.env.MG_PRIOR_N, 5);        // partidas "fantasma" do Bayes
const MG_PRIOR_RATE = num(process.env.MG_PRIOR_RATE, 0.35); // taxa de vitória a priori
const MG_VOLUME_W = num(process.env.MG_VOLUME_W, 0.5);    // peso do bônus de volume (log2)

// Rating JUSTO por jogador num mini game, a partir dos acumulados:
//   plays  — sessões jogadas
//   wins   — sessões vencidas (objetivo cumprido / 1º lugar)
//   earned — soma do score da sessão (dinheiro, kills, resgates... conforme o jogo)
//
// rating = ganhoMédio * (0.5 + taxaVitória) * (1 + W*volume)
//   - ganhoMédio = earned/plays  -> recompensa HABILIDADE, não o grind vazio
//     (jogar muito e ganhar pouco derruba a média).
//   - taxaVitória suavizada por Bayes -> 1 vitória de sorte não domina quem tem
//     amostra grande; iniciante começa puxado pra baixo (prior 0.35).
//   - volume = log2(1+plays), retorno DECRESCENTE -> reconhece dedicação sem deixar
//     o volume puro passar por cima de quem joga melhor.
export function miniGameRating({ plays = 0, wins = 0, earned = 0 } = {}) {
  plays = Math.max(0, Number(plays) || 0);
  if (plays <= 0) return 0;
  wins = Math.max(0, Number(wins) || 0);
  earned = Math.max(0, Number(earned) || 0);
  const avgEarn = earned / plays;
  const winRate = (wins + MG_PRIOR_N * MG_PRIOR_RATE) / (plays + MG_PRIOR_N);
  const volume = Math.log2(1 + plays);
  return Math.round(avgEarn * (0.5 + winRate) * (1 + MG_VOLUME_W * volume));
}

export const BASE_MONEY = num(process.env.BASE_MONEY, 250);
export const MONEY_PER_SEC = num(process.env.MONEY_PER_SEC, 200);
// Teto absoluto de sanidade (rejeita valores claramente forjados). Quem limita o
// crescimento normal é a plausibilidade por tempo (maxPlausibleMoney); este é o
// freio de emergência caso a plausibilidade deixe passar. O default é 10M
// (igual ao .env.example) DE PROPÓSITO: se a env var não estiver setada em prod,
// o teto NÃO pode virar 1e12 — era isso que deixava um valor absurdo passar.
// Suba por env (MONEY_HARD_CAP) se a economia do jogo exigir. O ranking abrevia
// com letras (K/M/B/T) pra não estourar o layout.
export const MONEY_HARD_CAP = num(process.env.MONEY_HARD_CAP, 10_000_000);
export const SESSION_TTL = num(process.env.SESSION_TTL, 4 * 60 * 60);
export const MIN_RUN_SECONDS = num(process.env.MIN_RUN_SECONDS, 20);
export const RL_MAX = num(process.env.RL_MAX, 30);
export const RL_WINDOW = num(process.env.RL_WINDOW, 600);

// Apelido: maiúsculas, A–Z 0–9 espaço _ -, até 12 chars. Retorna null se vazio
// ou se contém palavrão (pt-BR/inglês) — validação autoritativa do servidor.
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  if (!s.length) return null;
  if (hasProfanity(s)) return null;
  return s;
}

// Teto plausível de dinheiro para uma partida que durou `seconds`.
export function maxPlausibleMoney(seconds) {
  return BASE_MONEY + MONEY_PER_SEC * seconds;
}
