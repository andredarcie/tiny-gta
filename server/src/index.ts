// Edge router for the Tiny GTA multiplayer server. Stateless: upgrades /ws to
// the single shared-world Durable Object and proxies /health. Everything else
// (roster, validation, broadcast) lives in WorldDO (world.ts).
import { WorldDO, type Env } from './world.ts';

export { WorldDO };

const world = (env: Env) => env.WORLD.get(env.WORLD.idFromName('world'));

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
      return new Response(await r.text(), {
        status: r.status,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      });
    }
    return new Response('tiny-gta multiplayer server', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
