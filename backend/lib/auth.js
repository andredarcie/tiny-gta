// Hash de senha das contas (login usuário+senha). Usa só node:crypto — sem
// dependência nova (escolha "sem infra nova"). scrypt é deliberadamente caro pra
// frear brute-force offline caso o Redis vaze; o salt aleatório por conta impede
// rainbow tables; a comparação é timing-safe.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const KEYLEN = 32; // bytes do hash derivado

// Deriva {salt, hash} (ambos hex) de uma senha em texto plano.
export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(String(pw), salt, KEYLEN).toString('hex');
  return { salt, hash };
}

// Confere a senha contra o {salt, hash} guardado. Timing-safe; false em qualquer
// formato inesperado (salt/hash ausente ou corrompido).
export function verifyPassword(pw, salt, hash) {
  if (typeof pw !== 'string' || typeof salt !== 'string' || typeof hash !== 'string') return false;
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== KEYLEN) return false;
  const actual = scryptSync(pw, salt, KEYLEN);
  return timingSafeEqual(expected, actual);
}
