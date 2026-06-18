import { describe, it, expect, beforeEach } from 'vitest';

import { vi } from 'vitest';
vi.mock('../lib/redis.js', () => import('./helpers/fakeRedis.js'));

import { redis, resetRedis } from './helpers/fakeRedis.js';
import handler from '../api/bloodstains.js';
import { makeReq, makeRes } from './helpers/http.js';
import { bloodstainSig } from '../lib/auth.js';
import * as C from '../lib/scores.js';

// Multiplayer assíncrono (poças de morte). Cobre: criar -> listar (own flag, pid
// nunca vaza) -> coletar (GETDEL: só o primeiro leva) -> recusas (assinatura, valor,
// sessão). Usa o fakeRedis (getdel/mget/zadd/zrange) e os fakes de req/res.

const PID_A = '11111111-1111-4111-8111-111111111111'; // vítima (JOE)
const PID_B = '22222222-2222-4222-8222-222222222222'; // quem coleta (MAX)
const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(32);
const TOKEN_A = 'tok-a';
const TOKEN_B = 'tok-b';

beforeEach(async () => {
  resetRedis();
  await redis.set(C.SESSION_PREFIX + TOKEN_A, { at: Date.now(), base: 0, pid: PID_A, name: 'JOE', secret: SECRET_A });
  await redis.set(C.SESSION_PREFIX + TOKEN_B, { at: Date.now(), base: 0, pid: PID_B, name: 'MAX', secret: SECRET_B });
});

// cria a poça da vítima (JOE) e devolve o id gerado pelo servidor.
async function create(money: number, x = 100, z = -40, token = TOKEN_A, pid = PID_A, name = 'JOE', secret = SECRET_A) {
  const t = Date.now();
  const sig = bloodstainSig(secret, x, z, money, t);
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body: { action: 'create', token, pid, name, x, z, money, t, sig } }), res);
  return res;
}

async function list(pid?: string) {
  const res = makeRes();
  await handler(makeReq({ method: 'GET', query: pid ? { pid } : {} }), res);
  return res;
}

async function claim(id: string, token = TOKEN_B, pid = PID_B) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body: { action: 'claim', token, pid, id } }), res);
  return res;
}

describe('bloodstains — async multiplayer death pools', () => {
  it('creates a pool and lists it (own flag per requester; pid never leaks)', async () => {
    const cr = await create(5000);
    expect(cr._status).toBe(200);
    const id = (cr._json as { id: string }).id;
    expect(id).toMatch(/^[a-z0-9]+$/);

    // listada para outro jogador: own=false, sem pid no payload
    const seenByB = await list(PID_B);
    const stainsB = (seenByB._json as { stains: Array<Record<string, unknown>> }).stains;
    expect(stainsB).toHaveLength(1);
    expect(stainsB[0]).toMatchObject({ id, name: 'JOE', x: 100, z: -40, money: 5000, own: false });
    expect(stainsB[0]).not.toHaveProperty('pid');

    // o dono vê own=true (o cliente esconde a própria)
    const seenByA = await list(PID_A);
    expect((seenByA._json as { stains: Array<{ own: boolean }> }).stains[0]?.own).toBe(true);
  });

  it('first claimer wins the money; a second claim gets nothing (atomic GETDEL)', async () => {
    const id = (((await create(8000))._json) as { id: string }).id;

    const first = await claim(id, TOKEN_B, PID_B);
    expect(first._status).toBe(200);
    expect(first._json).toMatchObject({ claimed: true, money: 8000, name: 'JOE' });

    // a poça sumiu do índice e da listagem
    expect((((await list())._json) as { stains: unknown[] }).stains).toHaveLength(0);

    // um segundo coletor não ganha nada
    const second = await claim(id, TOKEN_B, PID_B);
    expect(second._json).toMatchObject({ claimed: false });
  });

  it('the owner cannot claim their own pool', async () => {
    const id = (((await create(3000))._json) as { id: string }).id;
    const self = await claim(id, TOKEN_A, PID_A); // JOE tenta pegar a própria
    expect(self._json).toMatchObject({ claimed: false });
  });

  it('clamps the pool money to BLOODSTAIN_MAX', async () => {
    const cr = await create(C.BLOODSTAIN_MAX + 999999);
    const id = (cr._json as { id: string }).id;
    const got = await claim(id);
    expect((got._json as { money: number }).money).toBe(C.BLOODSTAIN_MAX);
  });

  it('rejects a tampered (bad signature) create', async () => {
    const t = Date.now();
    const sig = bloodstainSig(SECRET_A, 100, -40, 5000, t); // assina 5000...
    const res = makeRes();
    // ...mas envia 999999 (valor editado na aba Network)
    await handler(makeReq({ method: 'POST', body: { action: 'create', token: TOKEN_A, pid: PID_A, name: 'JOE', x: 100, z: -40, money: 999999, t, sig } }), res);
    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toBe('bad_signature');
  });

  it('rejects non-positive money and an unknown session', async () => {
    expect((await create(0))._status).toBe(400);

    const t = Date.now();
    const res = makeRes();
    const sig = bloodstainSig(SECRET_A, 100, -40, 5000, t);
    await handler(makeReq({ method: 'POST', body: { action: 'create', token: 'nope', pid: PID_A, name: 'JOE', x: 100, z: -40, money: 5000, t, sig } }), res);
    expect(res._status).toBe(403);
    expect((res._json as { error: string }).error).toBe('invalid_session');
  });
});
