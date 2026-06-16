// Fakes de VercelRequest/VercelResponse para testar os handlers sem servidor.
// O res captura status + corpo JSON e marca headersSent (pra exercitar o safe()).
import type { VercelRequest, VercelResponse } from '@vercel/node';

export type FakeRes = VercelResponse & {
  _status: number;
  _json: unknown;
  _ended: boolean;
};

export function makeRes(): FakeRes {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {
    _status: 0,
    _json: undefined,
    _ended: false,
    headersSent: false,
    statusCode: 0,
    status(code: number) { this._status = code; this.statusCode = code; return this; },
    json(payload: unknown) { this._json = payload; this.headersSent = true; this._ended = true; return this; },
    end() { this._ended = true; this.headersSent = true; return this; },
    setHeader() { return this; },
  };
  return res as FakeRes;
}

export function makeReq(opts: {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): VercelRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req: any = {
    method: opts.method ?? 'POST',
    body: opts.body,
    query: opts.query ?? {},
    headers: opts.headers ?? {},
    socket: { remoteAddress: '127.0.0.1' },
  };
  return req as VercelRequest;
}
