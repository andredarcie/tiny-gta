// Constantes e validações compartilhadas pelos endpoints.
const num = (v, def) => (Number.isFinite(Number(v)) ? Number(v) : def);

export const LEADERBOARD_KEY = 'tinygta:leaderboard';
export const SESSION_PREFIX = 'tinygta:sess:';
export const RL_PREFIX = 'tinygta:rl:';

export const BASE_MONEY = num(process.env.BASE_MONEY, 250);
export const MONEY_PER_SEC = num(process.env.MONEY_PER_SEC, 200);
export const MONEY_HARD_CAP = num(process.env.MONEY_HARD_CAP, 10_000_000);
export const SESSION_TTL = num(process.env.SESSION_TTL, 4 * 60 * 60);
export const MIN_RUN_SECONDS = num(process.env.MIN_RUN_SECONDS, 20);
export const RL_MAX = num(process.env.RL_MAX, 30);
export const RL_WINDOW = num(process.env.RL_WINDOW, 600);

// Apelido: maiúsculas, A–Z 0–9 espaço _ -, até 12 chars. Retorna null se vazio.
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.toUpperCase().replace(/[^A-Z0-9 _-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  return s.length ? s : null;
}

// Teto plausível de dinheiro para uma partida que durou `seconds`.
export function maxPlausibleMoney(seconds) {
  return BASE_MONEY + MONEY_PER_SEC * seconds;
}
