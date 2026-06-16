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

// IP do cliente para o rate-limit. A Vercel injeta `x-real-ip` com o IP REAL da
// conexão — o cliente NÃO consegue sobrescrevê-lo. Já o `x-forwarded-for` cru é
// forjável: o cliente pode mandar o próprio header e a Vercel apenas ANEXA o IP
// real no fim, então o primeiro item da lista é controlado pelo atacante. Por
// isso preferimos x-real-ip; no fallback usamos o ÚLTIMO salto do XFF (o que o
// proxy confiável anexou), nunca o primeiro. (Pegar o primeiro = rate-limit
// burlável mandando um XFF aleatório a cada request.)
export function clientIp(req) {
  const h = req.headers || {};
  const real = String(h['x-real-ip'] || '').trim();
  if (real) return real;
  const xff = String(h['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  if (xff.length) return xff[xff.length - 1];
  return req.socket?.remoteAddress || 'unknown';
}

// Limite de corpo antes do parse: um save legítimo tem <1KB; 16KB sobra de folga.
// Barra um cliente adulterado mandando um JSON gigante só pra gastar CPU no parse.
const MAX_BODY = 16 * 1024;

// Body pode vir já parseado (Vercel) ou como string — normaliza para objeto.
export function jsonBody(req) {
  let b = req.body;
  if (typeof b === 'string') {
    if (b.length > MAX_BODY) return {};
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  return b && typeof b === 'object' ? b : {};
}
