import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../lib/redis.js', () => import('./helpers/fakeRedis.js'));

import { redis, resetRedis } from './helpers/fakeRedis.js';
import handler from '../api/account.js';
import { makeReq, makeRes } from './helpers/http.js';
import * as C from '../lib/scores.js';

const PID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => resetRedis());

async function call(body: unknown) {
  const res = makeRes();
  await handler(makeReq({ method: 'POST', body }), res);
  return res;
}

describe('register', () => {
  it('creates an account adopting the client pid + reverse index', async () => {
    const res = await call({ action: 'register', username: 'JOE', password: '1234', pid: PID });
    expect(res._status).toBe(200);
    expect((res._json as { pid: string }).pid).toBe(PID);
    expect(await redis.get(C.acctKey('JOE'))).toMatchObject({ pid: PID });
    expect(await redis.get(C.pidAcctKey(PID))).toBe('JOE');
  });

  it('mints a new pid when the client pid already belongs to an account', async () => {
    await redis.set(C.pidAcctKey(PID), 'SOMEONE');
    const res = await call({ action: 'register', username: 'JOE', password: '1234', pid: PID });
    expect(res._status).toBe(200);
    expect((res._json as { pid: string }).pid).not.toBe(PID);
  });

  it('409 when the username is taken', async () => {
    await call({ action: 'register', username: 'JOE', password: '1234', pid: PID });
    expect((await call({ action: 'register', username: 'JOE', password: '1234' }))._status).toBe(409);
  });

  it('400 on bad password / name / action', async () => {
    expect((await call({ action: 'register', username: 'JOE', password: '1' }))._status).toBe(400);
    expect((await call({ action: 'register', username: '!!!', password: '1234' }))._status).toBe(400);
    expect((await call({ action: 'frobnicate', username: 'JOE', password: '1234' }))._status).toBe(400);
  });
});

describe('login', () => {
  it('logs in with the right password and returns the pid', async () => {
    await call({ action: 'register', username: 'JOE', password: 'secret', pid: PID });
    const res = await call({ action: 'login', username: 'JOE', password: 'secret' });
    expect(res._status).toBe(200);
    expect((res._json as { pid: string }).pid).toBe(PID);
  });

  it('returns a generic 401 when no account exists (no enumeration)', async () => {
    const res = await call({ action: 'login', username: 'GHOST', password: 'secret' });
    expect(res._status).toBe(401);
    expect((res._json as { error: string }).error).toBe('invalid_credentials');
  });

  it('returns the SAME generic 401 on wrong password (indistinguishable)', async () => {
    await call({ action: 'register', username: 'JOE', password: 'secret', pid: PID });
    const res = await call({ action: 'login', username: 'JOE', password: 'WRONG' });
    expect(res._status).toBe(401);
    expect((res._json as { error: string }).error).toBe('invalid_credentials');
  });

  it('locks a (ip, account) after too many failed logins', async () => {
    await call({ action: 'register', username: 'JOE', password: 'secret', pid: PID });
    // contador de falhas por (ip, conta) no limite — '127.0.0.1' é o ip do makeReq
    await redis.set(C.LOGIN_FAIL_PREFIX + '127.0.0.1|JOE', C.LOGIN_MAX_FAILS);
    // mesmo com a senha CORRETA, está travado
    expect((await call({ action: 'login', username: 'JOE', password: 'secret' }))._status).toBe(429);
  });
});

describe('rate limit', () => {
  it('429 once over RL_MAX requests from the same ip', async () => {
    let last = makeRes();
    for (let i = 0; i < C.RL_MAX + 2; i++) last = await call({ action: 'login', username: 'X', password: '1234' });
    expect(last._status).toBe(429);
  });
});
