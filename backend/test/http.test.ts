import { describe, it, expect } from 'vitest';
import { clientIp, jsonBody, cors } from '../lib/http.js';
import { makeReq, makeRes } from './helpers/http.js';

describe('clientIp', () => {
  it('prefers x-real-ip (unforgeable)', () => {
    expect(clientIp(makeReq({ headers: { 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }))).toBe('9.9.9.9');
  });
  it('falls back to the LAST hop of x-forwarded-for', () => {
    expect(clientIp(makeReq({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }))).toBe('2.2.2.2');
  });
  it('falls back to the socket address', () => {
    expect(clientIp(makeReq({}))).toBe('127.0.0.1');
  });
});

describe('jsonBody', () => {
  it('returns an object body as-is', () => {
    expect(jsonBody(makeReq({ body: { a: 1 } }))).toEqual({ a: 1 });
  });
  it('parses a string body', () => {
    expect(jsonBody(makeReq({ body: '{"a":1}' }))).toEqual({ a: 1 });
  });
  it('returns {} for invalid / oversized / array bodies', () => {
    expect(jsonBody(makeReq({ body: 'not json' }))).toEqual({});
    expect(jsonBody(makeReq({ body: '[1,2]' }))).toEqual({});
    expect(jsonBody(makeReq({ body: '{"a":1}'.padEnd(20000, ' ') }))).toEqual({});
  });
});

describe('cors', () => {
  it('ends a preflight OPTIONS with 204', () => {
    const res = makeRes();
    expect(cors(makeReq({ method: 'OPTIONS' }), res)).toBe(true);
    expect(res._status).toBe(204);
  });
  it('returns false for normal requests', () => {
    expect(cors(makeReq({ method: 'POST' }), makeRes())).toBe(false);
  });
});
