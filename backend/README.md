# Tiny Crime — Leaderboard & Save API

API serverless (**Vercel + TypeScript**) + Upstash Redis para o ranking global, o
**save de progresso** (dinheiro + itens) e as **contas** (login usuário+senha) do jogo.

O front (jogo Vite estático) é hospedado à parte; ele só faz `fetch` para estes
endpoints. O Redis nunca é escrito pelo cliente — toda escrita passa pela validação do
endpoint.

> Stack: TypeScript (strict, NodeNext) compilado pela runtime Node da Vercel.
> Sem dependência de runtime nova (só `@upstash/redis`); `node:crypto` para hash de
> senha e assinatura. Testes em Vitest.

## Endpoints

| Método | Rota | Corpo / query | Resposta |
|---|---|---|---|
| `POST` | `/api/session` | `{ pid?, name? }` | `{ token, startedAt, money, save, secret }` |
| `POST` | `/api/account` | `{ action:'register'/'login', username, password, pid? }` | `{ ok, pid, username }` |
| `POST` | `/api/scores` | `{ name, money, token, pid, save, t, sig }` | `{ ok, name, money, rank }` |
| `GET` | `/api/scores?limit=100` | — | `{ entries: [{ rank, name, money }], total }` |
| `POST` | `/api/minigame` | `{ game, name, won, score, token, t, sig }` | `{ ok, game, name, rating, rank, stats }` |
| `GET` | `/api/minigame?game=taxi&limit=5` | — | `{ game, entries: [{ rank, name, rating, plays, wins, earned, best }] }` |

### Contas e save (`/api/account` + `/api/session`)

O progresso é gravado por **`pid`** (UUID secreto no `localStorage` do dono) na chave
`tinygta:save:<pid>` — não pelo nick público, então ninguém herda o save alheio digitando
o apelido, e trocar de apelido não perde o save. `/api/session` restaura esse save no
início da run.

Como `localStorage` some (limpar dados, outro aparelho, eviction do iOS), `/api/account`
dá uma **conta usuário+senha** que **recupera o `pid`** (e portanto o save) em qualquer
lugar. Registrar **adota o `pid` anônimo atual** (carrega o progresso já feito). É
aditivo: quem joga como convidado nunca passa por aqui.

### Ranking por mini game (`/api/minigame`)

Cada mini game (`taxi`, `race`, `boat-race`, `vigilante`, `paramedic`, `firefighter`,
`rampage`, `rc-toyz`, …) tem o **seu próprio** top 5. Ao concluir uma sessão o front envia
`{ won, score }` (score = a métrica natural daquele jogo: dinheiro, kills, resgates…).

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
ajustáveis por env.

## Camadas de segurança

- **Token de sessão** emitido em `/api/session` **amarrado à identidade (pid+nick)**;
  `/api/scores` e `/api/minigame` **rejeitam** envios cujo nome/pid não batam → impede
  usar um token copiado (cURL/devtools) pra gravar/sobrescrever o nome de outro jogador.
- **Assinatura HMAC por sessão** (`secret` emitido no `/api/session`): cada envio de
  score/minigame vem assinado (`scoreSig` = `HMAC(secret, "money.t")`; `mgSig` =
  `HMAC(secret, "game.score.won.t")`). Um payload editado na aba Network sem re-assinar
  é rejeitado (`bad_signature`). Ligado por `REQUIRE_SIG` (**default on** — ver deploy).
- **Plausibilidade por tempo**: `money` não passa de
  `BASE_MONEY + MONEY_PER_SEC · duração` **+ saldo restaurado** no início da run.
  O **save é gravado ANTES** desse gate (clampado, não pode inflar) → progresso curto/
  acima do teto não se perde; só o **valor do ranking** é barrado/cravado.
- **Teto absoluto** `MONEY_HARD_CAP` (default **10.000.000**, env): o ranking é **cravado**
  nesse teto em vez de a requisição ser rejeitada (quem passa do teto continua salvando).
- **Contas**: senha com **scrypt + salt por conta** (timing-safe); login com **throttle
  dedicado por IP** + **lockout por (IP, conta)**; erro de login **genérico**
  (`invalid_credentials`) pra não revelar se o apelido existe (anti-enumeração).
- **Rate-limit por IP** usando o IP **confiável da Vercel** (`x-real-ip`), não o
  `x-forwarded-for` cru (forjável pelo cliente).
- **Limite de tamanho do corpo** antes do parse; **sanitização do nome** (A–Z 0–9, 12
  chars) + **filtro de palavrão**; **CORS** restrito a `ALLOWED_ORIGINS`.

> ⚠️ Jogo é client-side: estas camadas elevam muito o custo da trapaça, mas não são à
> prova de tudo (o servidor é a fonte da verdade; o objetivo é tornar a trapaça
> **implausível e contida**). Quando algo passar, `npm run cleanup` repara o ranking.

## Desenvolvimento

```bash
npm install        # deps + devDeps (typescript, @vercel/node, vitest, tsx)
npm run typecheck  # tsc --noEmit (checagem de tipos, inclui os testes)
npm test           # vitest run — suíte unitária (lógica pura + handlers com Redis fake)
npm run test:watch # vitest em watch
```

### Rodar local
```bash
npm i -g vercel
vercel dev        # sobe em http://localhost:3000 (lê o .env)
```

### Ferramenta de reparo do ranking
`scripts/cleanup.ts` (rodado via `tsx`) inspeciona/repara o ranking. **Dry-run por
padrão**; passe `--apply` pra escrever de verdade:
```bash
npm run cleanup -- list [N]                 # top N do ranking + total
npm run cleanup -- inspect "NOME"           # tudo guardado de um nome (save, seed, mg)
npm run cleanup -- cap 10000000 [--apply]   # baixa quem está acima do teto
npm run cleanup -- remove "NOME" [--apply]  # remove do ranking + save + minigames
```
(Precisa do `.env` com as credenciais Upstash carregado; `tsx` lê via `Redis.fromEnv()`.)

## Deploy

### Variáveis de ambiente (uma vez)
```bash
vercel login
vercel link       # rode dentro de backend/ (ou configure Root Directory = backend/)
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add ALLOWED_ORIGINS
# opcional: REQUIRE_SIG (default 1). Use 0 só durante a transição (ver abaixo).
```

### Ordem de deploy (IMPORTANTE: frontend primeiro)
A assinatura HMAC exige que **o frontend novo (que assina) esteja no ar ANTES** do backend
passar a exigir a assinatura — senão clientes com JS em cache tomam `403 bad_signature`
(o progresso fica no backup local até recarregarem, mas evite o transtorno).

1. **Frontend primeiro**: publique o jogo novo (no repo, push na `main` → GitHub Actions).
   Confirme no ar com hard-refresh.
2. **Backend depois**: `vercel --prod` (de dentro de `backend/`).

Frontend-novo + backend-velho é seguro (o cliente não recebe `secret`, não assina, e o
backend velho não exige). Se você **não** conseguir sequenciar (ex.: deploy automático que
sobe os dois juntos), rode o backend com `REQUIRE_SIG=0`, publique, confirme o frontend no
ar e então mude `REQUIRE_SIG=1` (default) e redeploy.
