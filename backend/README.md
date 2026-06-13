# Tiny GTA — Leaderboard API

API serverless (Vercel) + Upstash Redis para o ranking global de dinheiro.

O front (jogo Vite estático) continua hospedado à parte; ele só faz `fetch` para
estes endpoints. O Redis nunca é escrito pelo cliente — toda escrita passa pela
validação do endpoint.

## Endpoints

| Método | Rota | Corpo / query | Resposta |
|---|---|---|---|
| `POST` | `/api/session` | — | `{ token, startedAt }` |
| `POST` | `/api/scores` | `{ name, money, token }` | `{ ok, name, money, rank }` |
| `GET` | `/api/scores?limit=100` | — | `{ entries: [{ rank, name, money }] }` |

### Camadas de segurança
- **Token de sessão** emitido em `/api/session` no início da partida, exigido e
  **consumido** (single-use) no envio → dificulta replay/spam.
- **Plausibilidade**: `money` não pode passar de `BASE_MONEY + MONEY_PER_SEC * duração`.
- **Rate-limit por IP** (`RL_MAX` envios por `RL_WINDOW`).
- **Sanitização do nome** (A–Z 0–9, até 12 chars).
- **CORS** restrito a `ALLOWED_ORIGINS`.
- Guarda só o **melhor score por nome** (`ZADD … GT`).

> ⚠️ Jogo é client-side: isto eleva muito o custo da trapaça, mas não é à prova de
> tudo. Para 100% seria preciso revalidar a partida no servidor (server-authoritative).

## Setup

1. Crie um banco grátis no [Upstash](https://upstash.com) → aba **REST API** →
   copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
2. `cp .env.example .env` e preencha (inclusive `ALLOWED_ORIGINS` com a URL do jogo).
3. `npm install`

### Rodar local
```bash
npm i -g vercel
vercel dev        # sobe em http://localhost:3000 (lê o .env)
```

### Deploy
```bash
vercel login
vercel link       # cria/associa o projeto (rode dentro de backend/)
# suba as variáveis de ambiente do .env para o projeto:
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add ALLOWED_ORIGINS
vercel deploy --prod
```
Na Vercel, configure o **Root Directory** do projeto como `backend/` (ou rode os
comandos acima de dentro desta pasta).

## Como o jogo chama (exemplo)

```js
const API = 'https://SEU-PROJETO.vercel.app';

// no início da partida:
const { token } = await fetch(`${API}/api/session`, { method: 'POST' }).then(r => r.json());

// ao terminar (game over / wasted):
await fetch(`${API}/api/scores`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'ANDRE', money: state.money, token }),
});

// para exibir o ranking:
const { entries } = await fetch(`${API}/api/scores?limit=20`).then(r => r.json());
```
