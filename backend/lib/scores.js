// Constantes e validações compartilhadas pelos endpoints.
import { hasProfanity } from './profanity.js';

const num = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);

export const LEADERBOARD_KEY = 'tinygta:leaderboard';
export const SESSION_PREFIX = 'tinygta:sess:';
export const RL_PREFIX = 'tinygta:rl:';

// ----- SAVE / PROGRESSO POR JOGADOR -----------------------------------------
// Sorted set onde guardamos o saldo salvo de cada jogador para restaurar a
// partida seguinte. O membro é a identidade (id estável do cliente + nick), o
// score é o MELHOR dinheiro já salvo (GT, igual ao leaderboard). Chavear por
// (pid, nick) — e não só pelo nick público — impede que alguém digite o apelido
// alheio e herde o dinheiro: o pid é um UUID secreto no localStorage do dono.
export const SAVE_KEY = 'tinygta:save';
export const saveMember = (pid, name) => pid + '|' + name;

// pid do jogador: UUID v4 gerado no cliente. Aceita só o formato canônico para
// não poluir o set com chave forjada/lixo.
export function sanitizePid(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? s : null;
}

// Valor da sessão: instante de início + saldo restaurado (base de plausibilidade
// do /api/scores — um jogador que volta rico pode reenviar o saldo já salvo sem
// estourar o teto por tempo). Aceita o formato antigo (só o timestamp) para não
// quebrar sessões em voo durante o deploy.
export function parseSession(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return { at: Number(raw.at) || 0, base: Math.max(0, Number(raw.base) || 0) };
  const s = String(raw);
  if (s[0] === '{') { try { const o = JSON.parse(s); return { at: Number(o.at) || 0, base: Math.max(0, Number(o.base) || 0) }; } catch {} }
  return { at: Number(s) || 0, base: 0 };
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
