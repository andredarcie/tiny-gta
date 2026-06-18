// Hash de senha das contas (login usuário+senha). Usa só node:crypto — sem
// dependência nova (escolha "sem infra nova"). scrypt é deliberadamente caro pra
// frear brute-force offline caso o Redis vaze; o salt aleatório por conta impede
// rainbow tables; a comparação é timing-safe.
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const KEYLEN = 32; // bytes do hash derivado

// Deriva {salt, hash} (ambos hex) de uma senha em texto plano.
export function hashPassword(pw: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pw), salt, KEYLEN).toString('hex');
  return { salt, hash };
}

// Confere a senha contra o {salt, hash} guardado. Timing-safe; false em qualquer
// formato inesperado (salt/hash ausente ou corrompido).
export function verifyPassword(pw: unknown, salt: unknown, hash: unknown): boolean {
  if (typeof pw !== 'string' || typeof salt !== 'string' || typeof hash !== 'string') return false;
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== KEYLEN) return false;
  const actual = scryptSync(pw, salt, KEYLEN);
  return timingSafeEqual(expected, actual);
}

// Assinatura anti-adulteração do envio de score: HMAC-SHA256 em hex da mensagem
//   sem txs: `${money}.${t}`            (compat com clientes antigos)
//   com txs: `${money}.${t}|${txDigest}`  (txDigest = id:amt,... — ver scores.txDigest)
// Igual ao cliente síncrono em js/leaderboard.js — assim o servidor rejeita um
// payload (money OU valor de tx) editado na aba Network sem re-assinar.
export function scoreSig(secret: string, money: number, t: number, txDigest = ''): string {
  const msg = txDigest ? `${money}.${t}|${txDigest}` : `${money}.${t}`;
  return createHmac('sha256', secret).update(msg).digest('hex');
}

// Assinatura do resultado de mini game: HMAC-SHA256(secret, `${game}.${score}.${won}.${t}`).
// Igual ao cliente em js/minigame-leaderboard.js (won = 0/1).
export function mgSig(secret: string, game: string, score: number, won: number, t: number): string {
  return createHmac('sha256', secret).update(`${game}.${score}.${won}.${t}`).digest('hex');
}

// Assinatura do CRIA-POÇA (bloodstain create): HMAC-SHA256(secret, `${x}.${z}.${money}.${t}`)
// com x/z inteiros (Math.round nos dois lados). Igual ao cliente em js/bloodstains.js —
// o servidor rejeita uma poça com valor/posição editados na aba Network sem re-assinar.
export function bloodstainSig(secret: string, x: number, z: number, money: number, t: number): string {
  return createHmac('sha256', secret).update(`${Math.round(x)}.${Math.round(z)}.${money}.${t}`).digest('hex');
}

// Compara dois hex de forma timing-safe; false em formato/tamanho inesperado.
export function safeEqualHex(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) return false;
  try { return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); } catch { return false; }
}
