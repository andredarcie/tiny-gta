// Fake em memória do subconjunto do @upstash/redis usado pelos handlers e pelo
// cleanup. É injetado no lugar de ../lib/redis via vi.mock nos testes de handler.
// Modela 3 espaços: kv (get/set/incr), sorted sets (zadd/zrange/...) e hashes.

type Json = unknown;

const kv = new Map<string, Json>();
const zsets = new Map<string, Map<string, number>>();
const hashes = new Map<string, Map<string, Json>>();

// clona no set/get pra imitar a (de)serialização JSON do cliente real — testes
// não compartilham referências com o "banco".
const clone = <T>(v: T): T => (v === undefined ? (null as unknown as T) : JSON.parse(JSON.stringify(v)));

const globToRe = (g: string): RegExp =>
  new RegExp('^' + g.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

// ordem decrescente (score desc, e member desc no empate) — usada por zrevrank
function sortedDesc(z: Map<string, number>): string[] {
  const arr = [...z.entries()].sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return arr.map((e) => e[0]).reverse();
}

export const redis = {
  async get<T = unknown>(key: string): Promise<T | null> {
    return kv.has(key) ? (clone(kv.get(key)) as T) : null;
  },
  async set(key: string, value: Json, _opts?: unknown): Promise<'OK'> {
    kv.set(key, clone(value));
    return 'OK';
  },
  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) { if (kv.delete(k)) n++; if (zsets.delete(k)) n++; if (hashes.delete(k)) n++; }
    return n;
  },
  async incr(key: string): Promise<number> {
    const next = (Number(kv.get(key)) || 0) + 1;
    kv.set(key, next);
    return next;
  },
  async expire(_key: string, _sec: number): Promise<number> { return 1; },
  async zadd(key: string, ...members: Array<{ score: number; member: string }>): Promise<number> {
    const z = zsets.get(key) ?? new Map<string, number>();
    zsets.set(key, z);
    let added = 0;
    for (const m of members) { if (!z.has(m.member)) added++; z.set(m.member, m.score); }
    return added;
  },
  async zrange<T = (string | number)[]>(
    key: string, start: number, stop: number,
    opts?: { rev?: boolean; withScores?: boolean },
  ): Promise<T> {
    const z = zsets.get(key) ?? new Map<string, number>();
    let members = [...z.entries()].sort((a, b) => (a[1] - b[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    if (opts?.rev) members = members.reverse();
    const end = stop === -1 ? members.length : stop + 1;
    const out: (string | number)[] = [];
    for (const [member, score] of members.slice(start, end)) {
      out.push(member);
      if (opts?.withScores) out.push(score);
    }
    return out as T;
  },
  async zcard(key: string): Promise<number> { return zsets.get(key)?.size ?? 0; },
  async zscore(key: string, member: string): Promise<number | null> {
    const v = zsets.get(key)?.get(member);
    return v == null ? null : v;
  },
  async zrevrank(key: string, member: string): Promise<number | null> {
    const i = sortedDesc(zsets.get(key) ?? new Map<string, number>()).indexOf(member);
    return i < 0 ? null : i;
  },
  async zrem(key: string, member: string): Promise<number> {
    return zsets.get(key)?.delete(member) ? 1 : 0;
  },
  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const h = hashes.get(key);
    return h && h.has(field) ? (clone(h.get(field)) as T) : null;
  },
  async hset(key: string, obj: Record<string, Json>): Promise<number> {
    const h = hashes.get(key) ?? new Map<string, Json>();
    hashes.set(key, h);
    let n = 0;
    for (const [k, v] of Object.entries(obj)) { if (!h.has(k)) n++; h.set(k, v); }
    return n;
  },
  async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
    const h = hashes.get(key);
    if (!h || h.size === 0) return null;
    return Object.fromEntries(h.entries()) as T;
  },
  async hincrby(key: string, field: string, n: number): Promise<number> {
    const h = hashes.get(key) ?? new Map<string, Json>();
    hashes.set(key, h);
    const next = (Number(h.get(field)) || 0) + n;
    h.set(field, next);
    return next;
  },
  async hdel(key: string, field: string): Promise<number> {
    return hashes.get(key)?.delete(field) ? 1 : 0;
  },
  async scan(_cursor: string | number, opts?: { match?: string; count?: number }): Promise<[string, string[]]> {
    const re = opts?.match ? globToRe(opts.match) : null;
    const all = new Set<string>([...kv.keys(), ...zsets.keys(), ...hashes.keys()]);
    return ['0', [...all].filter((k) => !re || re.test(k))];
  },
};

// limpa o "banco" entre testes
export function resetRedis(): void {
  kv.clear();
  zsets.clear();
  hashes.clear();
}
