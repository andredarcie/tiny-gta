// CORS + helpers de request, agora tipados. ALLOWED_ORIGINS é uma lista separada
// por vírgula. Cada entrada é normalizada para a ORIGEM (esquema://host) — CORS não
// casa por path, então um path na lista é ignorado (e o navegador nunca manda path
// no Origin).
import type { VercelRequest, VercelResponse } from '@vercel/node';

const originOf = (u: string): string => { try { return new URL(u).origin; } catch { return u; } };
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean).map(originOf);

// Aplica os headers de CORS e trata o preflight OPTIONS.
// Retorna true se a resposta já foi encerrada (preflight) — o handler deve sair.
export function cors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
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
export function clientIp(req: VercelRequest): string {
  const h = req.headers || {};
  const real = String(h['x-real-ip'] || '').trim();
  if (real) return real;
  const xff = String(h['x-forwarded-for'] || '').split(',').map(s => s.trim()).filter(Boolean);
  if (xff.length) return xff[xff.length - 1] as string;
  return req.socket?.remoteAddress || 'unknown';
}

// Limite de corpo antes do parse: um save legítimo tem <1KB; 16KB sobra de folga.
// Barra um cliente adulterado mandando um JSON gigante só pra gastar CPU no parse.
const MAX_BODY = 16 * 1024;

// Body pode vir já parseado (Vercel) ou como string — normaliza para objeto.
// Tipado como Record<string, unknown>: força VALIDAR cada campo antes de usar.
export function jsonBody(req: VercelRequest): Record<string, unknown> {
  let b: unknown = req.body;
  if (typeof b === 'string') {
    if (b.length > MAX_BODY) return {};
    try { b = JSON.parse(b); } catch { b = {}; }
  }
  return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
}

// Envelope de erro padrão do backend: { error: <code> }.
export function sendError(res: VercelResponse, status: number, code: string): void {
  res.status(status).json({ error: code });
}

export type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

// Wrapper de robustez: QUALQUER exceção não tratada vira um 500 limpo
// ({error:'server_error'}) em vez de derrubar a function. Loga o erro real no
// servidor. Preserva o retorno/early-returns do handler interno.
export function safe(handler: Handler): Handler {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (e) {
      console.error('[handler error]', e);
      if (!res.headersSent) res.status(500).json({ error: 'server_error' });
    }
  };
}
