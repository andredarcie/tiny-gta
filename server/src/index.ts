// Edge router for the Tiny GTA multiplayer server. Stateless: upgrades /ws to
// the single shared-world Durable Object and proxies /health. Everything else
// (roster, validation, broadcast) lives in WorldDO (world.ts).
import { WorldDO, type Env } from './world.ts';

export { WorldDO };

// The world's HOME decides everyone's ping: a DO is placed once, on first
// access, and stays there forever. WORLD_NAME rotates to a fresh object (live
// poses rebuild in under a second — nothing durable is lost) and locationHint
// asks for a region. Reality check (2026-07): DOs do not run in South America,
// so 'sam' lands in ENAM (~180ms RTT from BR — today's floor). The hint is
// kept for the day Cloudflare opens SAM; /health's worldColo tells the truth.
const world = (env: Env) => env.WORLD.get(
  env.WORLD.idFromName(env.WORLD_NAME ?? 'world'),
  { locationHint: (env.WORLD_HINT ?? 'sam') as DurableObjectLocationHint },
);

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket upgrade', { status: 426 });
      }
      return world(env).fetch(req);
    }
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      const r = await world(env).fetch(new Request(new URL('/health', req.url)));
      const j = await r.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
      j.edgeColo = (req.cf as { colo?: string } | undefined)?.colo ?? '?';
      return Response.json(j, {
        status: r.status,
        headers: { 'access-control-allow-origin': '*' },
      });
    }
    return new Response('tiny-gta multiplayer server', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
