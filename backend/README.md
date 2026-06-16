# Tiny Crime — Leaderboard API

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
| `POST` | `/api/minigame` | `{ game, name, won, score, token }` | `{ ok, game, name, rating, rank, stats }` |
| `GET` | `/api/minigame?game=taxi&limit=5` | — | `{ game, entries: [{ rank, name, rating, plays, wins, earned, best }] }` |

### Ranking por mini game (`/api/minigame`)

Cada mini game (`taxi`, `race`, `boat-race`, `vigilante`, `paramedic`, `firefighter`,
`rampage`, `rc-toyz`, …) tem o **seu próprio** top 5. O front mostra esse ranking num
*briefing* no começo de cada sessão; ao concluir uma sessão envia `{ won, score }`
(score = a métrica natural daquele jogo: dinheiro ganho, kills, resgates…).

Por jogador/jogo guardamos os **acumulados crus** num hash
(`tinygta:mg:<game>:p:<nome>` → `plays, wins, losses, earned, best`) e, a cada envio,
recalculamos um **rating justo** que vai pro sorted set `tinygta:mg:<game>`:

```
rating = ganhoMédio · (0.5 + taxaVitória) · (1 + W·volume)
  ganhoMédio  = earned / plays            # premia habilidade, não grind vazio
  taxaVitória = (wins + N·r) / (plays + N) # Bayes: 1 vitória de sorte não domina
  volume      = log2(1 + plays)            # bônus de dedicação com retorno decrescente
```

Parâmetros (`MG_PRIOR_N`=5, `MG_PRIOR_RATE`=0.35, `MG_VOLUME_W`=0.5, `MG_SCORE_CAP`)
são ajustáveis por env. Reaproveita o **token de sessão** e o **rate-limit por IP**.

### Camadas de segurança
- **Token de sessão** emitido em `/api/session` **amarrado à identidade (pid+nick)**
  que o criou; `/api/scores` e `/api/minigame` **rejeitam** envios cujo nome/pid não
  batam com a sessão → impede usar um token copiado (via cURL/devtools) pra gravar ou
  sobrescrever o nome de outro jogador.
- **Plausibilidade por tempo**: `money` não pode passar de
  `BASE_MONEY + MONEY_PER_SEC * duração` **+ saldo restaurado** no início da run.
- **Teto absoluto** `MONEY_HARD_CAP` (default agora **10.000.000**, ajustável por env)
  → barra de cara valores claramente forjados.
- **Rate-limit por IP** (`RL_MAX` envios por `RL_WINDOW`) usando o IP **confiável da
  Vercel** (`x-real-ip`), e não o `x-forwarded-for` cru (que o cliente consegue forjar).
- **Limite de tamanho do corpo** da requisição, aplicado antes do parse do JSON.
- **Sanitização do nome** (A–Z 0–9, até 12 chars) + **filtro de palavrão**.
- **CORS** restrito a `ALLOWED_ORIGINS` (lembre: CORS só protege o navegador, **não**
  o cURL).

> ⚠️ Jogo é client-side: estas camadas elevam muito o custo da trapaça, mas não são à
> prova de tudo. Para 100% seria preciso revalidar a partida no servidor
> (server-authoritative). Quando algo passar mesmo assim, `scripts/cleanup.mjs` repara
> o ranking depois do abuso (inspecionar / tetar / remover trapaceiros).

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
