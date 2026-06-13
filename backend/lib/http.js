// CORS + helpers de request. ALLOWED_ORIGINS é uma lista separada por vírgula.
// Cada entrada é normalizada para a ORIGEM (esquema://host) — CORS não casa por
// path, então um path na lista é ignorado (e o navegador nunca manda path no Origin).
const originOf = u => { try { return new URL(u).origin; } catch { return u; } };
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean).map(originOf);

// Aplica os headers de CORS e trata o preflight OPTIONS.
// Retorna true se a resposta já foi encerrada (preflight) — o handler deve sair.
export function cors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && ALLOWED.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

// IP do cliente atrás do proxy da Vercel (x-forwarded-for) para o rate-limit.
export function clientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || 'unknown';
}

// Body pode vir já parseado (Vercel) ou como string — normaliza para objeto.
export function jsonBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}
