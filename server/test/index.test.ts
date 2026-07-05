// Unit tests for the edge router (server/src/index.ts): it is stateless and
// only routes /ws upgrades + /health to the single world Durable Object, so a
// fake Env whose WORLD.get() returns a stub DO is enough to cover every branch.
import { describe, expect, it } from 'vitest';
import worker from '../src/index.ts';

function fakeEnv(doFetch: (req: Request) => Promise<Response>, extra: Record<string, unknown> = {}) {
  const stub = { fetch: doFetch };
  return {
    WORLD: {
      idFromName: (name: string) => ({ name }),
      get: () => stub,
    },
    ...extra,
  } as any;
}

describe('edge router', () => {
  it('routes a /ws websocket upgrade to the world DO', async () => {
    let seen: Request | null = null;
    const env = fakeEnv(async (req) => { seen = req; return new Response('ok'); });
    const res = await worker.fetch(new Request('https://x/ws', { headers: { Upgrade: 'websocket' } }), env, {} as any);
    expect(await res.text()).toBe('ok');
    expect(seen).not.toBeNull();
  });

  it('returns 426 for /ws without an Upgrade header', async () => {
    const env = fakeEnv(async () => new Response('unused'));
    const res = await worker.fetch(new Request('https://x/ws'), env, {} as any);
    expect(res.status).toBe(426);
  });

  it('proxies /health from the DO and stamps the edge colo', async () => {
    const env = fakeEnv(async () => Response.json({ players: 3, max: 32, worldColo: 'IAD' }));
    const req = new Request('https://x/health');
    (req as any).cf = { colo: 'GRU' };
    const res = await worker.fetch(req, env, {} as any);
    const body = await res.json() as any;
    expect(body.players).toBe(3);
    expect(body.worldColo).toBe('IAD');
    expect(body.edgeColo).toBe('GRU'); // added by the router from req.cf
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('honors /api/health as an alias', async () => {
    const env = fakeEnv(async () => Response.json({ players: 0, max: 32, worldColo: '?' }));
    const res = await worker.fetch(new Request('https://x/api/health'), env, {} as any);
    expect((await res.json() as any).edgeColo).toBe('?'); // no req.cf → '?'
  });

  it('404s an unknown path', async () => {
    const env = fakeEnv(async () => new Response('unused'));
    const res = await worker.fetch(new Request('https://x/nope'), env, {} as any);
    expect(res.status).toBe(404);
  });
});
