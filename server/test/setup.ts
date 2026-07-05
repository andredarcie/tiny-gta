// Minimal Cloudflare Workers-runtime shims so WorldDO / the router can be
// instantiated and driven under plain Node + Vitest. Only what the code touches.
const g = globalThis as unknown as Record<string, unknown>;

// The DO constructor does `new WebSocketRequestResponsePair(PING, PONG)` and
// hands it to ctx.setWebSocketAutoResponse (both faked in the tests).
if (!g.WebSocketRequestResponsePair) {
  g.WebSocketRequestResponsePair = class {
    constructor(public request: string, public response: string) {}
  };
}

// `Response.json(...)` is standard in the Workers runtime but only lands in
// newer Node; polyfill it so the /health handlers work under any Node here.
const R = Response as unknown as { json?: (data: unknown, init?: ResponseInit) => Response };
if (typeof R.json !== 'function') {
  R.json = (data: unknown, init?: ResponseInit): Response =>
    new Response(JSON.stringify(data), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers as Record<string, string>) },
    });
}
