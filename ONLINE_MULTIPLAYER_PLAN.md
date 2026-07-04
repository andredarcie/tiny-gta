# TINY GTA ONLINE — Plano de Arquitetura do Servidor Multiplayer

> **Status:** planejamento (nada implementado). Branch `feat/online-multiplayer-plan`.
> **Data:** 2026-07-04. Limites de free tier conferidos nessa data na documentação da Cloudflare
> (links na seção 4) — revalidar antes de cada fase, planos mudam.
> **Escopo:** servidor multiplayer em tempo real, **100% autoritativo**, custo **zero** (Cloudflare
> Free Tier), preparado para escalar sem reescrita. O modo single-player atual continua existindo
> e intocado; o online nasce atrás de flag.

---

## 1. Resumo executivo (as 10 decisões)

1. **Servidor 100% autoritativo.** O cliente envia *intenções* (inputs); o servidor simula tudo:
   posição, física, colisão, dano, dinheiro, NPCs, veículos, polícia, pickups, missões. O
   protocolo cliente→servidor **não possui campo de posição** — a garantia é estrutural, não
   por validação.
2. **1 Durable Object = 1 sala (shard do mundo), até 16 jogadores.** O DO é single-threaded e
   stateful: a sala inteira vive na memória de um único objeto, sem locks, sem Redis, sem race.
3. **Tick de simulação a 15 Hz, snapshots a 10 Hz**, via `setInterval` dentro do DO enquanto
   houver jogador ativo; hibernação quando vazio/AFK (duração só é cobrada com a sala viva).
4. **WebSockets nativos com Hibernation API** (`state.acceptWebSocket`): mensagens entrantes
   cobradas a 20:1, saída **grátis**, keepalive por auto-resposta sem acordar o DO.
5. **Protocolo binário próprio** (DataView, zero dependências): input batched com número de
   sequência; snapshot delta com baseline + quantização (posição i16, yaw u8).
6. **Cliente responsivo sem autoridade:** client-side prediction + reconciliação para o próprio
   jogador, interpolação (~120 ms) para o resto. Predição é cosmética; o servidor sempre corrige.
7. **Simulação compartilhada:** o núcleo puro já existente (`groundHeight`, física arcade
   hand-rolled, constantes do grid, `world.json` determinístico) é extraído para `shared/` e
   importado pelos dois lados. O servidor **não** importa Three.js.
8. **Interest management = raio do fog.** O jogo já esconde tudo além da névoa; o servidor só
   envia entidades dentro desse raio. NPCs têm LOD de IA e só existem perto de jogadores.
9. **Persistência em D1 com write-behind** (flush a cada 60 s + no disconnect); estado quente da
   sala espelhado no SQLite do próprio DO para sobreviver a restart. KV para config/banlist.
10. **Escala = mais salas.** O sharding por DO é a arquitetura desde o dia 1; crescer não muda
    código. O primeiro (e único) degrau pago é o Workers Paid, US$ 5/mês, e nada precisa ser
    reescrito para usá-lo.

**Capacidade do free tier (resumo da seção 4):** ≈ **55 horas-jogador por dia** (~1.650/mês) com
input a 10 msg/s — p.ex. 30 jogadores diários jogando 1h30 cada. O gargalo é o limite de
requisições (mensagens WS entrantes), não CPU nem banda.

---

## 2. O princípio inegociável: autoridade total do servidor

### 2.1 Divisão de responsabilidades

| | Cliente (browser) | Servidor (Workers + DO) |
|---|---|---|
| Posição/rotação/velocidade | ❌ apenas renderiza | ✅ integra e é a fonte da verdade |
| Física e colisões | ❌ (só predição cosmética local) | ✅ |
| Dano, vida, morte, respawn | ❌ | ✅ |
| Dinheiro, inventário, economia | ❌ | ✅ |
| NPCs, tráfego, polícia, wanted | ❌ | ✅ |
| Veículos (entrar/sair/dirigir) | ❌ envia intenção | ✅ valida e executa |
| Projéteis, explosões, pickups | ❌ | ✅ |
| Missões e regras | ❌ | ✅ |
| Render, câmera, animação, som, UI | ✅ | ❌ |
| Captura de input | ✅ (envia intents) | valida, aplica, descarta o inválido |

### 2.2 O que o cliente pode dizer ao servidor

Somente **intenções**, todas elas discretas e validáveis:

```
mover (eixo X/Y normalizado)      virar câmera/mira (yaw)
correr / frear / acelerar          atirar (bit no input frame)
entrar no veículo / sair           trocar arma (slot)
interagir (E)                      usar item (id do slot)
```

Nunca: posição, velocidade, resultado de colisão, "acertei o tiro", "peguei o pickup",
"ganhei $500". Esses conceitos **não existem** no protocolo C→S (seção 8) — um cliente
modificado não tem sequer como expressá-los.

### 2.3 Predição não é autoridade

O cliente *prediz* o próprio movimento (rodando a mesma função de simulação compartilhada) apenas
para esconder a latência da renderização local. Cada snapshot traz o estado autoritativo + o
número do último input processado; o cliente descarta a predição divergente e re-simula os inputs
pendentes (seção 9). Se um cliente hackeado "se mover" localmente, só a tela dele mente — para o
servidor e para todos os outros jogadores ele está onde o servidor calculou.

---

## 3. Por que Cloudflare Workers + Durable Objects

### 3.1 O fit natural

Um servidor de jogo de sala é um **ator**: estado mutável quente + um loop + mensagens
serializadas. Durable Object é exatamente isso como serviço:

- **Single-threaded por objeto** → zero locks/races; o tick roda com consistência total.
- **Stateful e endereçável globalmente** (`idFromName("room:city-1")`) → a "sala" tem identidade
  estável sem registro externo (o papel que Redis teria num stack tradicional).
- **Termina WebSockets nativamente**, com API de hibernação (cliente fica conectado enquanto o
  objeto dorme — e mensagem entrante cobra 20:1, saída grátis).
- **Nasce perto do primeiro jogador** que o cria → jogador brasileiro cria sala no POP de GRU/GIG;
  latência típica BR↔sala de 15–60 ms sem configurar nada.
- **Zero ops:** sem VM, sem imagem Docker, sem autoscaling para administrar; `wrangler deploy` e
  acabou. `wrangler dev` roda tudo (DO + D1 + KV) localmente e offline.

### 3.2 Limitações honestas (e como o design as absorve)

| Limitação | Impacto | Mitigação de design |
|---|---|---|
| DO é 1 thread (~1 núcleo) | teto de CPU por sala | caps de entidades + IA com LOD + tick 15 Hz (seção 7.3) |
| CPU por invocação no Free: **10 ms** | cada tick tem que caber | orçamento de tick ≤ 2 ms medido; caps dimensionados p/ isso |
| Só TCP (WebSocket); sem UDP/WebTransport em Workers hoje | head-of-line blocking em rede ruim | pacotes pequenos (<1 KB), buffer de interpolação 120 ms, delta-snapshots idempotentes (perder um não corrompe) |
| Sala fixa na região onde nasceu | jogador longe da sala sofre | matchmaking preenche salas por proximidade; `locationHint` disponível se precisar (seção 14) |
| Sem loop "de graça": DO ativo cobra duração | sala vazia não pode ficar ticando | pausa de simulação + hibernação em sala vazia/AFK (seção 6.1) |

### 3.3 Alternativas rejeitadas

| Alternativa | Por que não |
|---|---|
| Node + Socket.IO em VPS/Fly/Railway | viola custo zero (free tiers de VPS hibernam/expiram), adiciona ops, Socket.IO é overhead sobre WS nativo que todo browser moderno já tem |
| Redis para estado de sala | pago/externo; o DO **é** o estado de sala com consistência melhor (mesma thread do loop) |
| P2P / host-cliente | viola o requisito nº 1: o host é um cliente, portanto trapaceável; NAT traversal exige TURN (pago) |
| Cliente com autoridade + validação a posteriori | o atalho indie clássico — e a razão de todo freeroam indie ter teleporte/speedhack; validar movimento depois é refazer a simulação de qualquer jeito, então simule no servidor de uma vez |
| Firebase/Supabase Realtime | são bancos com replicação, não um game loop; sem lugar para rodar simulação autoritativa por tick; free tier estoura com tráfego de tempo real |
| Lockstep determinístico | exigiria determinismo bit-perfeito entre browsers (float/JIT) e trava o jogo no jogador mais lento; snapshot-based é o padrão da indústria para ação |

---

## 4. Orçamento do free tier (números de 2026-07)

Fontes (conferidas em 2026-07-04):
[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) ·
[DO limits](https://developers.cloudflare.com/durable-objects/platform/limits/) ·
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) ·
[Queues no free plan (fev/2026)](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)

### 4.1 O que o plano Free dá

| Serviço | Limite diário/mensal (Free) | Uso no projeto |
|---|---|---|
| Workers | 100k req/dia, **10 ms CPU**/invocação | router de borda: `/api/join`, upgrade WS, health |
| Durable Objects | **100k requests/dia**, **13.000 GB-s/dia**, 5 GB SQLite total (1 GB/objeto), **somente classes SQLite-backed** | salas + lobby |
| — WebSocket | conexão = 1 request; **entrantes 20:1**; **saída e pings grátis** | inputs sobem, snapshots descem de graça |
| D1 | 5M linhas lidas/dia, 100k escritas/dia, 5 GB | contas, inventário, dinheiro (write-behind) |
| KV | 100k leituras/dia, 1k escritas/dia, 1 GB | config, MOTD, banlist |
| R2 | 10 GB, 1M ops A/mês, 10M ops B/mês, egress grátis | opcional (replays/dumps) — fora do MVP |
| Queues | 10k ops/dia, retenção 24 h (free desde fev/2026) | opcional (telemetria assíncrona) — fora do MVP |
| Cron Triggers | grátis (5/conta) | limpeza diária (salas órfãs, sessões velhas) |
| `workers.dev` + `wrangler dev` | grátis | dev local offline + deploy sem domínio próprio |

> ⚠️ No plano Free os Durable Objects **precisam** ser SQLite-backed — a migração no
> `wrangler.toml` deve usar `new_sqlite_classes` (não `new_classes`). Ver seção 15.

### 4.2 A matemática de capacidade

**Requests (o gargalo real).** 100k requests DO/dia com entrantes 20:1 ⇒ **~2.000.000 de
mensagens entrantes/dia**. Cliente envia input em lotes de 10 msg/s (seção 8.3):

```
2.000.000 msgs ÷ 10 msg/s = 200.000 segundos-jogador ≈ 55 horas-jogador/dia (~1.650 h/mês)
```

Exemplos que cabem: 30 jogadores/dia × 1h50; ou pico de 16 simultâneos por ~3h30/dia.
Keepalive não conta (auto-resposta de ping é grátis); snapshots não contam (saída é grátis).

**Duração (segundo gargalo).** 13.000 GB-s/dia ÷ 0,128 GB (DO ativo) ≈ 101.500 s ≈
**28 horas-sala ativas/dia**. Uma sala cheia 24/7 cabe; o desperdício é sala *quase vazia*
ticando (1 jogador sozinho consome sala inteira). Mitigações: matchmaking *fill-first* (lotar
salas antes de abrir novas), pausa de simulação + hibernação com todos AFK, shutdown de sala
vazia. Observação: com salas cheias, requests estrangulam muito antes da duração (16 jogadores
× 28 h = 448 h-jogador ≫ 55 h do teto de requests) — por isso o protocolo economiza *mensagens*
acima de tudo.

**CPU.** Tick a 15 Hz usando ≤ 2 ms ⇒ ~3% de um núcleo. O teto duro é 10 ms por invocação no
Free — os caps de entidade da seção 7.3 existem para nunca chegar perto disso.

**D1.** 55 h-jogador/dia com flush por minuto ≈ 3.300 escritas/dia ≪ 100k. Folga de 30×.

**Banda.** Snapshot típico ~600 B × 10 Hz = 6 KB/s por cliente (down). Saída é grátis; o motivo
de comprimir é latência e celular do jogador, não custo.

### 4.3 Os botões de ajuste quando o limite se aproximar (nesta ordem, todos grátis)

1. **Reduzir lote de input de 10 → 6,7 msg/s** (batch de 150 ms): capacidade vira ~83 h-jogador/dia;
   custo: +50 ms de latência de input (parcialmente escondida pela predição).
2. **Pausa agressiva de AFK** (30 s sem input ⇒ sala hiberna): corta duração.
3. **Fill-first + fechar salas rarefeitas** (migrar 2 jogadores da sala B para a A): corta duração.
4. **Snapshot 10 → 8 Hz** e AOI menor: corta CPU/banda (não afeta requests).
5. Só então: **Workers Paid, US$ 5/mês** — sobe requests para milhões/mês, CPU para 30 s,
   inclui 1M requests DO + 400k GB-s e overage barato (US$ 0,15/M requests, US$ 12,50/M GB-s).
   **Zero mudança de código.** Estimativa: 20 jogadores simultâneos 24/7 ≈ US$ 5–15/mês no total.

---

## 5. Topologia

```
                     ┌──────────────────────────── CLOUDFLARE EDGE ────────────────────────────┐
  CLIENTE (browser)  │                                                                         │
  Three.js + predição│   WORKER (stateless, roteador)                                          │
 ┌─────────────────┐ │  ┌─────────────────────────┐        idFromName("lobby")                 │
 │ js/net/         │ │  │ POST /api/join          │───────────────────────┐                    │
 │  NetClient      │ │  │ GET  /ws/:roomId (WSS)  │                       ▼                    │
 │  prediction     │ │  │ GET  /api/health        │              ┌────────────────┐            │
 │  interpolation  │ │  └───────────┬─────────────┘              │   LobbyDO (1)  │            │
 └────────┬────────┘ │              │ valida token,              │ diretório de   │            │
          │          │              │ encaminha upgrade          │ salas: lotação,│            │
          │ WSS      │              ▼                            │ alocação       │            │
          ├──────────┼──▶ ┌──────────────────┐ ┌──────────────┐  └───────┬────────┘            │
          │ inputs   │    │ GameRoomDO       │ │ GameRoomDO   │          │ join/leave          │
          │ 10 msg/s │    │ "room:1" (≤16 p) │ │ "room:2"     │  ...  ◀──┘ updates             │
          │          │    │──────────────────│ │              │  (1 DO por sala = shard)       │
          │◀─────────┼────│ ESTADO AUTORIT.: │ └──────────────┘                                │
          │ snapshots│    │ players, veículos│                                                 │
          │ 10 Hz    │    │ NPCs, projéteis, │   tick 15 Hz (setInterval enquanto ativo)       │
          │ (grátis) │    │ pickups, wanted  │   snapshot delta 10 Hz → broadcast              │
          │          │    └───┬──────────┬───┘   hiberna vazio/AFK                             │
          │          │        │          │                                                     │
          │          │  write-behind   estado quente                                           │
          │          │  (alarm 60s)    (crash recovery)                                        │
          │          │        ▼          ▼                                                     │
          │          │   ┌────────┐ ┌──────────────┐   ┌────────┐                              │
          │          │   │   D1   │ │ DO SQLite    │   │   KV   │ config/banlist               │
          │          │   │ contas │ │ (da sala)    │   └────────┘                              │
          │          │   └────────┘ └──────────────┘                                           │
          └──────────┴─────────────────────────────────────────────────────────────────────────┘

  Frontend do jogo continua servido pelo itch.io (pipeline atual, intocado).
  O servidor mora em  wss://tiny-gta-mp.<conta>.workers.dev  (grátis, sem domínio próprio).
```

### 5.1 Fluxo de entrada (join)

```
Cliente             Worker              LobbyDO            GameRoomDO           D1
   │ POST /api/join    │                   │                    │                │
   │  {nick, playerKey}│                   │                    │                │
   ├──────────────────▶│ alocarSala()      │                    │                │
   │                   ├──────────────────▶│ acha sala c/ vaga  │                │
   │                   │◀──────────────────┤ (ou cria room:N+1) │                │
   │◀──────────────────┤ {roomId, token}   │                    │                │
   │                   │  token = HMAC(playerId, roomId, exp=60s)                │
   │ WSS /ws/room:N?t=token                │                    │                │
   ├──────────────────▶│ verifica token ───┼───────────────────▶│ carrega player │
   │                   │ (borda; barato)   │                    ├───────────────▶│
   │                   │                   │                    │◀───────────────┤
   │◀────────────────────────── S_WELCOME {playerId, serverTick, config} ────────┤
   │◀────────────────────────── S_SNAPSHOT (completo, baseline 0) ───────────────┤
   │  ... entra no loop de gameplay ...    │                    │                │
```

### 5.2 Fluxo de gameplay (regime permanente)

```
Cliente (60 fps render)                       GameRoomDO (15 Hz sim / 10 Hz snap)
   │                                              │
   │ coleta input local a 60 Hz                   │
   │ PREDIZ movimento próprio (shared/sim)        │
   │                                              │
   │ ── C_INPUT {seq:142, frames:[6×]} ─────────▶ │ enfileira por jogador
   │    (1 msg a cada 100 ms)                     │
   │                                              │ tick N: drena inputs → valida →
   │                                              │   simula players → veículos → NPCs
   │                                              │   → projéteis → colisões → eventos
   │                                              │   → grava history (lag comp)
   │                                              │
   │ ◀─── S_SNAPSHOT {tick, lastSeq:142, Δ} ───── │ a cada 1,5 tick (10 Hz), por
   │                                              │ cliente: só entidades no AOI, delta
   │ reconcilia: descarta predição < lastSeq,     │ contra último baseline confirmado
   │ re-simula inputs 143..atual                  │
   │ interpola entidades remotas (t - 120 ms)     │
   │ ◀─── S_EVENT {tiros, explosões, sons} ────── │ transientes, fora do snapshot
```

---

## 6. Durable Objects em detalhe

### 6.1 `GameRoomDO` — a sala (o coração do sistema)

**Estado em memória (fonte da verdade quente):**

```ts
interface RoomState {
  tick: number;                       // relógio da simulação (15 Hz)
  players: Map<PlayerId, PlayerSim>;  // pos, vel, yaw, hp, money, weapon, vehicleId, wanted...
  vehicles: Map<EntId, VehicleSim>;   // pos, vel, yaw, occupants, hp
  npcs: Map<EntId, NpcSim>;           // peds/polícia ativos (LOD, seção 11.3)
  projectiles: ProjectileSim[];       // só os lentos; hitscan resolve no próprio tick
  pickups: Map<EntId, PickupSim>;     // itens no chão, respawn timers
  history: RingBuffer<TickPositions>; // ~280 ms p/ lag compensation (seção 11.2)
  inputQueues: Map<PlayerId, InputFrame[]>;
  lastAcked: Map<PlayerId, SnapshotBaseline>; // p/ delta encoding
}
```

**Ciclo de vida:**

```
criada (1º join) ──▶ ATIVA: setInterval(tick, 66ms)
     ▲                    │
     │ input acorda       ├─ todos AFK > 60s ──▶ PAUSADA: clearInterval + flush
     │ (webSocketMessage) │                       + hiberna (sockets ficam vivos,
     │                    │                         duração PARA de contar)
     └────────────────────┘
                          └─ último socket fecha ──▶ VAZIA: flush D1 + storage,
                               clearInterval, avisa Lobby, alarm(+5min) p/ descarregar
```

- **WebSockets sempre via Hibernation API** (`state.acceptWebSocket(ws, [playerId])`):
  1. garante a tarifa 20:1 nas entrantes;
  2. os sockets sobrevivem a evict/restart do DO (o estado se recupera do SQLite do objeto);
  3. permite a **pausa AFK**: sem interval pendente o objeto hiberna e a duração para de contar,
     mas os jogadores continuam conectados; a primeira mensagem re-acorda (`webSocketMessage`)
     e religa o interval.
- **Keepalive grátis:** `state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("p","o"))`
  responde ping do cliente **sem acordar o DO e sem custo** — essencial para a pausa AFK não
  derrubar conexões atrás de NAT.
- **Tick via `setInterval`, não via alarms:** alarm é 1 request cobrado por disparo — a 15 Hz
  seriam 1,3M requests/dia só de relógio. O interval roda dentro da duração já paga da sala
  ativa e não gera requests. Alarms ficam para o que é raro: flush de persistência (60 s),
  auto-shutdown de sala vazia, self-check.
- **Crash recovery:** a cada 30 s (e em cada transição de estado) a sala serializa o estado
  dinâmico essencial (players, veículos, pickups consumidos) num blob no `ctx.storage` (SQLite
  do próprio DO). No construtor, se existir blob órfão, a sala se restaura — um deploy ou evict
  no meio do jogo custa um soluço de ~1 s, não um wipe.

### 6.2 `LobbyDO` — diretório e matchmaking

Singleton por nome (`idFromName("lobby")`). Mantém `Map<roomId, {count, createdAt, region}>`.

- `POST /alloc {playerId}` → escolhe a sala com vaga **mais cheia** (fill-first, seção 4.3) ou
  cria `room:N+1`; devolve `roomId`.
- Salas reportam `join`/`leave` (1 request interno por evento — barato; sem heartbeat periódico).
- Alarm de 10 min varre entradas órfãs (sala que morreu sem avisar).
- Hiberna entre requests (é quase sempre ocioso — custo ~zero).

### 6.3 Por que **não** um `PlayerDO` por jogador

Padrão comum em exemplos da Cloudflare, errado para este caso: cada input teria um hop extra
(Player → Room), **dobrando os requests cobrados** e somando latência. O estado do jogador em
jogo pertence à sala (é lido/escrito pelo tick a 15 Hz — precisa estar na mesma thread); o
estado durável pertence ao D1. Um DO por jogador só faria sentido para inbox/social assíncrono,
que não é o problema aqui.

---

## 7. Game loop do servidor

### 7.1 Frequências e por quê

| Loop | Freq. | Racional |
|---|---|---|
| Simulação | **15 Hz** (66,6 ms) | suficiente para arcade (o feel fino vem da predição do cliente a 60 fps); metade do custo de CPU/história de 30 Hz; casa com o teto de 10 ms de CPU do Free |
| Snapshot | **10 Hz** (a cada 1,5 tick) | padrão de jogos de mundo aberto (GTA:O usa ~10–20); interpolação de 120 ms cobre o gap; saída é grátis mas CPU de encode não |
| Input do cliente | lotes a **10 msg/s** | 6 frames de input (coletados a 60 Hz) por mensagem; equilíbrio requests×latência (seção 4.2) |
| Flush D1 | 60 s (alarm) | write-behind; perda máx. de 60 s de progresso em desastre |
| Snapshot de crash-recovery | 30 s | blob no SQLite do DO |

### 7.2 Pipeline do tick (ordem fixa)

```ts
function tick(room: RoomState, dtFixed: 1/15) {
  drainInputs(room);        // valida: clamp de eixos, seq monotônico, rate, tamanho
  stepPlayers(room);        // shared/sim: mesma integração do single-player (a pé)
  stepVehicles(room);       // shared/sim: modelo arcade; só veículos ocupados/recém-tocados
  stepNpcs(room);           // IA com LOD (seção 11.3); tier B só a cada 5 ticks
  stepProjectiles(room);    // balas lentas; hitscan já resolveu em drainInputs
  resolveCollisions(room);  // grid da cidade + groundHeight (mesma malha do visual)
  applyGameRules(room);     // dano, morte, respawn, dinheiro, wanted, pickups, missões
  pushHistory(room);        // posições p/ lag compensation (ring de ~280 ms)
  if (room.tick % 3 < 2 === snapshotDue)  // 10 em cada 15 ticks
    broadcastSnapshots(room);             // por cliente: AOI + delta vs baseline ack'ado
  room.tick++;
}
```

### 7.3 Orçamento de CPU e caps de entidade (por sala)

| Entidade | Cap | Custo/tick estimado |
|---|---|---|
| Jogadores | 16 | integração arcade trivial (~µs cada) |
| Veículos ativos | 20 (só ocupados/em movimento; estacionado não custa) | idem |
| NPCs tier A (IA plena, 15 Hz) | 24 | maior custo; IA = state machine barata |
| NPCs tier B (3 Hz) | +24 | 1/5 do custo |
| Projéteis | 64 | raycast no grid, barato |
| **Total alvo** | | **≤ 2 ms/tick** (teto duro 10 ms) |

Instrumentação desde o dia 1: p50/p95 do tempo de tick e do encode de snapshot, expostos em
`/api/health` e logáveis via `wrangler tail` (seção 17). Se o p95 encostar em 5 ms, os caps
descem — nunca o contrário sem medição.

---

## 8. Protocolo WebSocket (binário)

### 8.1 Princípios

- **Binário (`ArrayBuffer` + `DataView`), zero dependências.** 3–5× menor que JSON, zero GC de
  strings no tick. Exceção pragmática: a **Fase 0 usa JSON** para depurar com os olhos; o codec
  binário entra na Fase 1 atrás da mesma interface (`encode/decode`), e um flag `?wire=json`
  permanece para debug.
- **C→S não tem como expressar estado** — só intenções (a garantia estrutural da seção 2).
- Toda mensagem começa com `u8 op`. Inteiros little-endian. Tamanho máximo aceito C→S:
  **256 bytes** (acima disso: kick).

### 8.2 Mensagens

**Cliente → Servidor**

| op | Nome | Payload | Freq. |
|---|---|---|---|
| `0x01` | `C_HELLO` | `u8 protoVer` + token UTF-8 (o resto sobe na URL do upgrade) | 1× |
| `0x02` | `C_INPUT` | `u16 firstSeq`, `u8 count`, depois `count ×` InputFrame (ver 8.3) | 10/s |
| `0x03` | `C_ACTION` | `u8 kind` (enterVehicle=1, exitVehicle=2, interact=3, weaponSlot=4, useItem=5), `u8 arg` | esporádica |
| `0x04` | `C_PING` | `u32 clientTimeMs` | ≤ 0,2/s (fallback; ver 9.4) |

**Servidor → Cliente**

| op | Nome | Payload |
|---|---|---|
| `0x81` | `S_WELCOME` | `u16 playerId`, `u32 serverTick`, `u8 tickHz`, `u8 snapHz`, config compacta |
| `0x82` | `S_SNAPSHOT` | `u32 tick`, `u16 lastInputSeq`, `u8 baselineId`, `u16 count`, `count ×` entidade (delta, ver 8.4) |
| `0x83` | `S_EVENT` | eventos transientes do tick: tiros (origem+dir quantizados), impactos, explosões, buzina — coisas que disparam som/VFX e não precisam de reenvio |
| `0x84` | `S_PONG` | `u32 clientTimeMs` (eco), `u32 serverTimeMs` |
| `0x85` | `S_KICK` | `u8 reason` |

*Spawn/despawn não são mensagens próprias:* entidade que entra no AOI vai no snapshot com flag
`full` (estado completo); a que sai vai numa lista de `removed` no cabeçalho do snapshot.

### 8.3 InputFrame (7 bytes) — coletado a 60 Hz, enviado em lote de 6 a cada 100 ms

```
u16 seq        número de sequência (monotônico; reconciliação e anti-replay)
u16 buttons    bitfield: run, brake, shoot, aim, jump, horn, enter, interact...
i8  moveX      eixo lateral  quantizado [-127..127] → [-1..1]
i8  moveY      eixo frente/trás
u8  yaw        direção da mira/câmera (256 = 360°) — p/ onde o tiro/movimento aponta
```

Lote típico: `1 + 2 + 1 + 6×7 = 46 bytes` → ~460 B/s de upstream por jogador. O servidor aplica
no máximo `N` frames por tick por jogador (N = razão 60/15 = 4 + folga 2 de jitter); excedente é
descartado — impossível "acelerar o tempo" mandando frames a mais.

### 8.4 Snapshot: delta + quantização + AOI

- **Quantização por entidade** (estado *full* ≈ 16 bytes):
  - `u16 id`, `u8 kind` (player/ped/police/car/bike/projectile/pickup)
  - pos: `3 × i16` em **1/16 m** (±2.048 m de alcance, 6,25 cm de resolução — o interp suaviza)
  - yaw: `u8`; vel: `2 × i8` (p/ extrapolação curta no cliente)
  - `u8 flags` (modo, atirando, abaixado…), `u8 anim`, `u8 hp`, `u16 vehicleId?`
- **Delta:** o servidor guarda os últimos 32 snapshots; cada cliente confirma o último recebido
  (`baselineId` piggyback no `C_INPUT`); cada entidade sai como bitmask dos campos que mudaram
  vs. a baseline daquele cliente (2–8 bytes típicos). Cliente muito atrasado ⇒ full snapshot.
  Perder um snapshot nunca corrompe: o delta é sempre contra uma baseline *confirmada*.
- **AOI (interest management):** grid de células de 32 m; cada cliente recebe apenas entidades
  num raio ≈ **distância do fog** (o cliente não renderizaria mesmo — sinergia com o
  `camera.far = fog` que o jogo já tem). Histerese entra 150 m / sai 170 m para não piscar.
- **O que não se sincroniza porque é função do tick:** semáforos (`fase = f(tick, junctionId)`),
  ciclo dia/noite, ambient cosmético determinístico. Relógio sincronizado ⇒ estado de graça.

### 8.5 Exemplo do codec (TS compartilhado, zero dependências)

```ts
// shared/protocol/input.ts
export function encodeInputBatch(firstSeq: number, frames: InputFrame[]): ArrayBuffer {
  const buf = new ArrayBuffer(4 + frames.length * 7);
  const v = new DataView(buf);
  v.setUint8(0, Op.C_INPUT);
  v.setUint16(1, firstSeq, true);
  v.setUint8(3, frames.length);
  let o = 4;
  for (const f of frames) {
    v.setUint16(o, f.seq, true);
    v.setUint16(o + 2, f.buttons, true);
    v.setInt8(o + 4, Math.round(clamp(f.moveX, -1, 1) * 127));
    v.setInt8(o + 5, Math.round(clamp(f.moveY, -1, 1) * 127));
    v.setUint8(o + 6, (f.yaw / (Math.PI * 2)) * 256 & 0xff);
    o += 7;
  }
  return buf;
}

export function decodeInputBatch(v: DataView): InputBatch | null {
  const count = v.getUint8(3);
  if (count > 12 || v.byteLength !== 4 + count * 7) return null; // malformado ⇒ descarta
  // ... espelho do encode, com clamps redundantes no lado do servidor
}
```

---

## 9. Sincronização e sensação de resposta

### 9.1 Jogador local: prediction + reconciliation

```
1. A 60 Hz o cliente coleta o InputFrame, guarda numa lista `pending`, e PREDIZ:
   aplica shared/sim.stepPlayer(estadoLocal, frame) imediatamente → render sem latência.
2. A 10 Hz envia os frames acumulados (C_INPUT).
3. Cada S_SNAPSHOT traz `lastInputSeq` = último input que o servidor aplicou:
   a. descarta de `pending` tudo ≤ lastInputSeq;
   b. reseta o estado local para o autoritativo do snapshot;
   c. re-simula os frames restantes de `pending` por cima (replay, mesmo código de sim);
   d. se a diferença visual for pequena (< 40 cm), suaviza em ~100 ms; se for grande
      (teleporte punitivo do servidor), snap seco.
```

Com RTT de 60–100 ms e o mesmo `shared/sim` nos dois lados, a correção típica é sub-centímetro
— invisível. A predição cobre **apenas o próprio corpo/veículo**; nada mais é predito.

### 9.2 Entidades remotas: interpolação

Cliente renderiza o mundo remoto **120 ms no passado**: guarda os 2+ últimos snapshots e
interpola posição/yaw entre eles no tempo `serverNow − 120 ms`. Buraco de snapshot ⇒ extrapola
no máximo 100 ms pela velocidade e congela (nunca "chuta" longe). 120 ms = 1 snapshot de folga
contra jitter/HoL de TCP.

### 9.3 Regra de ouro anti-desync

O cliente **nunca** decide consequência: colisão predita não dá dano, pickup "tocado" não some
localmente (só brilha), morte só existe quando o snapshot disser `hp=0`. Toda divergência se
resolve sozinha no próximo snapshot porque o cliente é descartável.

### 9.4 Relógio

`S_SNAPSHOT.tick` já sincroniza o grosso (offset = EWMA de `tick×66,6ms − clientNow + RTT/2`).
O `C_PING`/`S_PONG` existe só como bootstrap (medir RTT antes do primeiro snapshot) e fallback
em pausa AFK. RTT também alimenta a lag compensation (seção 11.2).

---

## 10. Física e simulação compartilhada (`shared/`)

O maior pré-requisito de engenharia — e o mais barato, porque **o jogo já foi construído do
jeito certo por acaso**:

| Já existe (single-player) | Vira |
|---|---|
| `js/core/constants.ts` — grid da cidade (`N`, `CELL`, `ROAD`, `HALF`) e `groundHeight(x,z)` puro | `shared/sim/terrain.ts` |
| `js/core/physics.ts` — colisão hand-rolled (Rapier foi removido de propósito) | `shared/sim/collide.ts` (parte pura) |
| Integração do player a pé e modelo arcade do carro (dentro de `player.ts`/veículos) | `shared/sim/step-player.ts`, `step-vehicle.ts` — **extração**, ver abaixo |
| `world.json` — mapa **determinístico bakeado** (posições de prédios, estradas) | carregado pelos 2 lados; o servidor monta o grid de colisão dele |
| `js/core/rng.ts` — RNG determinístico com seed | `shared/sim/rng.ts` |

**Plano de extração (Fase 1, mecânico):** mover a matemática pura para `shared/sim/` e deixar
re-exports nos arquivos originais (`export {groundHeight} from '@shared/sim/terrain.ts'`) — o
single-player não percebe. A parte de `player.ts` que mistura input+câmera+Three fica; só a
função `integrate(state, input, dt)` sai. Critério objetivo: **nenhum arquivo de `shared/`
importa `three`** (lint rule `no-restricted-imports` garante).

**Determinismo bit-perfeito NÃO é requisito.** Isso não é lockstep: o servidor é a verdade e o
cliente re-converge a cada snapshot. Pequenas divergências float client×server viram correções
milimétricas na reconciliação. (É por isso que dá para compartilhar float math entre V8 do
browser e V8 do Workers sem medo.)

---

## 11. Sistemas de jogo no servidor

### 11.1 Veículos

- Sala mantém a frota (spawns iniciais vêm do `world.json` + regras de tráfego).
- **Entrar:** `C_ACTION{enterVehicle}` ⇒ servidor valida: jogador a pé, veículo a < 3 m, assento
  livre, veículo não trancado por missão. Sucesso ⇒ `player.vehicleId = v.id`, flag no snapshot;
  o cliente só então troca câmera/modo. **Sair:** idem, com checagem de posição válida de desembarque.
- Física do veículo roda **no servidor** (modelo arcade extraído). O motorista prediz o próprio
  veículo (mesma função); passageiros e todos os outros interpolam.
- Custo: veículo **estacionado não custa tick** (dorme até ser tocado); só ocupados/em movimento
  entram no cap de 20 ativos.
- Dano/explosão de veículo: contadores no servidor; explosão gera evento (`S_EVENT`) + dano em
  área calculado no servidor.

### 11.2 Combate

- **Hitscan no tick:** o bit `shoot` chega num InputFrame com `yaw`; o servidor resolve o raio
  contra o **history buffer** (lag compensation): rebobina as posições dos alvos para
  `serverTime − RTT/2 − 120ms` (o que o atirador via) antes do teste. Ring de 280 ms cobre
  RTT ≤ ~300 ms; acima disso o rewind satura (jogador de ping altíssimo erra — trade-off aceito
  e padrão da indústria).
- Cadência/munição/recarga: contadores por arma **no servidor**; `shoot` além da cadência é
  ignorado silenciosamente (não é kick — pode ser jitter legítimo).
- Projéteis lentos (se houver: RPG etc.) são entidades simuladas por tick.
- Dano → `hp` no servidor; morte → drop de dinheiro (pickup server-side), respawn com timer,
  wanted do agressor sobe conforme as regras atuais do jogo.

### 11.3 NPCs, tráfego e polícia — IA com LOD (a resposta ao teto de CPU)

O single-player já **spawna pedestres/tráfego ao redor do jogador** — o servidor generaliza
para "ao redor de *todos* os jogadores":

| Tier | Condição | Simulação |
|---|---|---|
| **A** | ≤ 80 m de algum jogador | IA plena a 15 Hz (andar, fugir, atropelamento, tiroteio) |
| **B** | 80–160 m | 3 Hz (1 a cada 5 ticks): waypoint following grosso |
| **C** | > 160 m de todos | **não existe** — despawn; o mundo distante fica frio |

- Spawn/despawn dirigido por densidade-alvo em volta de cada jogador, com caps globais da sala
  (seção 7.3). NPC "importante" (alvo de missão) é exceção pinada.
- **Polícia/wanted:** nível por jogador no servidor (a fonte do heat: tiros, atropelos — tudo já
  é evento server-side). Unidades policiais são NPCs tier A pinados ao alvo.
- **Semáforos:** função pura do tick — custo de sync zero (seção 8.4).
- **Ambient 100% cosmético** (pássaros, folhas): client-side determinístico por seed. Não é
  exceção à autoridade: não tem efeito de gameplay por definição, e a régua é essa — *se passar
  a ter, migra para o servidor.*

### 11.4 Pickups, explosões, destruíveis

Estado por sala: pickup consumido some para todos no mesmo tick (quem chegou primeiro é decidido
pela ordem determinística do tick, não por corrida de rede); timers de respawn no servidor;
destruíveis têm `hp` server-side e o estado "destruído" entra no snapshot (flag), com VFX via
`S_EVENT`.

### 11.5 Missões (fase tardia)

Instanciadas **por jogador dentro da sala** (estado da missão = máquina de estados no servidor;
objetivos checados por proximidade/eventos do tick). Recompensa credita `money` no servidor.
Missões cooperativas = mesma máquina com N participantes. Fora do MVP; a arquitetura já comporta.

---

## 12. Segurança e anticheat

Camadas, de fora para dentro:

1. **Borda (Worker):** verificação de `Origin` (só o domínio do itch.io + localhost dev), token
   obrigatório no upgrade, banlist (KV) por playerId/IP consultada no `/api/join`.
2. **Sessão:** `/api/join` emite token HMAC-SHA256 (`crypto.subtle`, segredo via
   `wrangler secret put SESSION_SECRET`) com `{playerId, roomId, exp: 60s}`. O DO revalida.
   Mesmo *padrão* já usado no backend Vercel do jogo — segredo separado. Reconexão: token de
   resume `{exp: 5min}` entregue no `S_WELCOME`; cair e voltar em < 30 s reocupa o mesmo avatar
   (grace period em que ele fica parado no mundo).
3. **Protocolo:** mensagens > 256 B ⇒ kick; op desconhecido ⇒ kick; malformada ⇒ descarte;
   > 25 msg/s sustentado ⇒ kick; `seq` não-monotônico ⇒ descarte (anti-replay).
4. **Semântica (a camada que importa):** eixos clampados, máximo de frames aplicados por tick
   (anti-speedhack por inundação, seção 8.3), toda interação revalidada por proximidade no
   servidor, cadência de arma imposta pelo servidor. **Posição/dano/dinheiro não são
   expressáveis** no protocolo C→S — a classe inteira de cheat "escrever estado" morre no design.
5. **O que resta (e é aceito):** aimbot/wallhack de leitura são impossíveis de eliminar em
   qualquer arquitetura (o cliente precisa ver para renderizar). Mitigação parcial do wallhack:
   o AOI já não envia quem está longe; refinamento por oclusão fica para depois. Report/ban
   manual via banlist KV fecha o ciclo.

Privacidade: nickname sanitizado (comprimento/charset), sem PII no servidor além do par
`playerKey→nick` (o `playerKey` é um random de 128 bits gerado no primeiro boot e guardado em
`localStorage` — identidade anônima, sem OAuth no MVP).

---

## 13. Persistência

### 13.1 D1 — o durável (contas e progresso)

```sql
-- server/migrations/0001_init.sql
CREATE TABLE players (
  id         TEXT PRIMARY KEY,     -- hash(playerKey)
  nick       TEXT NOT NULL,
  money      INTEGER NOT NULL DEFAULT 0,
  x REAL, y REAL, z REAL, yaw REAL,
  health     INTEGER NOT NULL DEFAULT 100,
  inventory  TEXT NOT NULL DEFAULT '{}',   -- JSON (armas/munição/itens)
  wanted     INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE bans (
  player_id  TEXT PRIMARY KEY,
  reason     TEXT,
  until      INTEGER               -- NULL = permanente
);
```

- **Leitura:** 1 `SELECT` no join (via sala). **Escrita:** write-behind — a sala marca jogadores
  sujos e um alarm de 60 s faz `UPSERT` em lote (`db.batch`); flush imediato no disconnect e no
  esvaziamento da sala. Orçamento: ~3,3k escritas/dia no cenário de referência ≪ 100k (seção 4.2).
- Perda máxima teórica: 60 s de progresso se o DO evaporar entre flushes — mitigada pelo blob de
  crash-recovery (seção 6.1) que é restaurado se a sala voltar.

### 13.2 SQLite do DO — o quente (crash recovery da sala)

Blob único por sala (estado dinâmico: veículos movidos, pickups consumidos, timers), a cada
30 s. Não é fonte de verdade de progresso do jogador (isso é D1) — é para a *sala* retomar de
onde parou após evict/deploy.

### 13.3 KV — config e moderação

`config:motd`, `config:caps` (ajustar caps sem redeploy), `ban:<playerId>`. Leitura no join
(cacheada no DO); escrita só manual/admin — dentro do limite de 1k writes/dia com folga.

### 13.4 Relação com o backend Vercel atual

O backend existente (ranking/save/ledger do single-player) **continua como está** — o
single-player não muda. O multiplayer usa D1, isolado. Unificação (ex.: dinheiro compartilhado
entre modos) é decisão de jogo para depois; tecnicamente é uma migração de linhas Vercel→D1
atrás do mesmo `playerKey`. Não misturar no MVP: economias separadas evitam que exploit no
online contamine o save offline.

---

## 14. Matchmaking, salas e regiões

- **Fluxo:** seção 5.1. Cap por sala: **16** (constante em KV — ajustável sem deploy).
- **Fill-first:** o Lobby sempre lota a sala mais cheia com vaga (maximiza encontros E economiza
  duração — sala rarefeita é o pior custo, seção 4.2).
- **Regiões:** o DO nasce perto de quem o cria ⇒ a primeira sala de um horário brasileiro nasce
  em GRU. Enquanto a base de jogadores for regional (é), isso basta. Se/quando houver mistura de
  continentes: o Lobby ganha buckets por região (`room:sa-1`, `room:eu-1`) criados com
  `locationHint`, e o `/api/join` usa `request.cf.continent` para escolher o bucket. Mudança
  contida no Lobby — zero impacto no resto.
- **Sala cheia?** Lobby cria `room:N+1`. **Mundo compartilhado persistente** (todos na "mesma"
  cidade) não é objetivo do MVP — cada sala é uma instância da cidade, como GTA:O faz com
  sessões de ~30. Cross-room (chat global, economia global) viria via D1/Queues depois.

---

## 15. Organização de pastas e configuração

```
tiny-gta/
├─ server/                        # NOVO — o servidor multiplayer (deploy separado do jogo)
│  ├─ wrangler.toml
│  ├─ tsconfig.json               # extende o raiz; types @cloudflare/workers-types
│  ├─ migrations/                 # SQL do D1
│  └─ src/
│     ├─ index.ts                 # Worker: /api/join, /ws/:room, /api/health
│     ├─ auth.ts                  # HMAC de sessão (crypto.subtle)
│     ├─ do/
│     │  ├─ game-room.ts          # GameRoomDO (tick, sockets, snapshots, flush)
│     │  └─ lobby.ts              # LobbyDO (diretório, alocação fill-first)
│     ├─ sim/                     # server-only: spawn director, IA LOD, lag comp, history
│     └─ persist/                 # write-behind D1, blob de crash recovery
├─ shared/                        # NOVO — TS puro, importado por cliente E servidor
│  ├─ protocol/                   # ops, codec binário, quantização (unit-testado)
│  ├─ sim/                        # terrain, collide, step-player, step-vehicle, rng
│  └─ net-types.ts
├─ js/
│  └─ net/                        # NOVO — cliente: NetClient, prediction, interp, remote views
│     ├─ net-client.ts            # socket, reconexão, clock sync
│     ├─ prediction.ts            # pending inputs + replay
│     ├─ interpolation.ts         # buffer de snapshots, render 120 ms atrás
│     └─ remote-entities.ts       # espelha snapshot → Object3D (reusa Npc/mixamo rig)
└─ (todo o resto do jogo, intocado)
```

- **Aliases:** `@shared/* → shared/*` adicionado em `tsconfig.json`, `vite.config.ts`,
  `vitest.config.ts` e no `server/tsconfig.json`. Regra de lint: `shared/` não importa `three`
  nem `@/`.
- **Scripts npm novos:** `dev:server` (`wrangler dev` — DO+D1+KV locais via miniflare, offline),
  `deploy:server` (`wrangler deploy`), `db:migrate` (`wrangler d1 migrations apply`).
- **Deploys independentes:** o jogo continua indo para o itch.io pelo pipeline atual; o servidor
  vai para `workers.dev` via wrangler. Regra de ordem herdada do projeto: **servidor primeiro**
  quando o protocolo mudar (mesma lição do backend Vercel — o servidor novo aceita cliente velho
  via `protoVer`, nunca o contrário).

```toml
# server/wrangler.toml
name = "tiny-gta-mp"
main = "src/index.ts"
compatibility_date = "2026-07-01"

[[durable_objects.bindings]]
name = "ROOMS"
class_name = "GameRoomDO"

[[durable_objects.bindings]]
name = "LOBBY"
class_name = "LobbyDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["GameRoomDO", "LobbyDO"]  # OBRIGATÓRIO no Free plan (SQLite-backed)

[[d1_databases]]
binding = "DB"
database_name = "tiny-gta-mp"

[vars]
PROTOCOL_VERSION = "1"
# SESSION_SECRET: via `wrangler secret put SESSION_SECRET` (nunca no toml)
```

---

## 16. Integração com o jogo atual

- **Flag de entrada:** `?online=1` (depois, botão ONLINE na title screen). Sem a flag, nada do
  código novo executa — single-player byte-idêntico.
- **No modo online**, os sistemas locais mudam de papel:

| Sistema atual | Papel no modo online |
|---|---|
| `player.ts` (movimento) | vira *predição* (usa `shared/sim`); autoridade no servidor |
| `traffic.ts`, `peds`, `police` | **desligados**; substituídos por `remote-entities` renderizando o snapshot |
| `physics.ts` | cliente só usa para predição do próprio corpo |
| economia/dinheiro/HUD | HUD lê valores vindos do snapshot; nunca calcula |
| `daynight.ts`, semáforos | derivam do tick sincronizado (mesma função, input = relógio do servidor) |
| modelos/animação/mixamo rig | intocados — jogadores remotos são `Npc`-like alimentados por interp, com billboard de nickname |
| `save.ts`/backend Vercel | não roda no online (progresso online mora no D1) |

- O loop de `main.ts` ganha um braço: no modo online, `step(dt)` chama
  `net.update(dt)` (drena snapshots, reconcilia, interpola) em vez dos updates de simulação
  local — a lista exata de quais `update*` rodam é o grosso do trabalho de integração da Fase 1.

---

## 17. Observabilidade e testes

- **Métricas:** contadores por sala (players, tick p50/p95 ms, bytes de snapshot, msgs/s,
  kicks) expostos em `GET /api/health` (JSON) e impressos 1×/min no log (`wrangler tail`).
  Dashboard da Cloudflare (grátis) cobre requests/duração/erros por script.
- **Alarme de orçamento:** o health inclui `budget: {reqUsedPct, durationUsedPct}` estimado
  pelo próprio servidor (contadores diários em KV) — dá para ver o free tier chegando no fim
  antes de a Cloudflare cortar.
- **Unit (Vitest, suite existente `test/unit/`):** codec (roundtrip encode/decode, fuzz de
  mensagens malformadas), quantização, delta vs baseline, `shared/sim` (step determinístico:
  mesmo input ⇒ mesmo resultado client/server), lag comp (rewind acha o alvo).
- **Integração de servidor:** `@cloudflare/vitest-pool-workers` roda o DO de verdade em
  miniflare — testa join/tick/snapshot sem browser.
- **E2E (harness Playwright existente, HEADED, executado pelo usuário — regra do repo):** spec
  `test/online.spec.ts` sobe `wrangler dev` + `vite dev`, abre **2 páginas** no mesmo browser,
  cada uma com um jogador; asserta que A vê B se mover, que a posição vem do servidor
  (snapshot), que matar A credita B. O agente prepara o spec; **quem roda e julga é o usuário**,
  como sempre.

---

## 18. Roadmap por fases

Cada fase termina com: `npm run typecheck` + `npm run lint` + `npm run test:unit` + build verdes,
spec E2E preparada para o usuário rodar, e medição de orçamento (seção 17) dentro do esperado.

| Fase | Entrega | Critérios de aceite | Risco free-tier |
|---|---|---|---|
| **F0 — Spike** (dias) | `server/` de pé; protocolo JSON; join/leave; movimento a pé server-side; 2 clientes se veem como cápsulas | 2 browsers, movimento espelhado < 200 ms; grep no protocolo C→S não encontra campo de posição | zero (dev local) |
| **F1 — Fundação** | extração `shared/sim`; codec binário; prediction+reconciliation; interpolação; AOI; clock; reconexão; render remoto com rig real | andar online tem o mesmo feel do single com 100 ms de RTT artificial; correções invisíveis com 5% de perda; single-player byte-idêntico (flag off) | zero |
| **F2 — Veículos** | entrar/sair validado, dirigir com predição, assentos, colisões básicas | 2 jogadores no mesmo carro; roubo de carro em movimento impossível de forjar pelo cliente | baixo |
| **F3 — Combate** | hitscan + lag comp, hp/morte/respawn, drop de dinheiro, pickups | acerto justo a 150 ms de ping (teste com throttle); dano só existe no servidor | baixo |
| **F4 — Mundo vivo** | NPCs/tráfego/polícia com LOD, wanted, semáforos por tick | cidade "viva" ao redor de 2 jogadores distantes entre si; tick p95 < 5 ms com sala cheia sintética | médio (CPU) — medir antes de subir caps |
| **F5 — Persistência & lobby** | D1 write-behind, identidade playerKey, fill-first multi-salas, banlist, health/budget | progresso sobrevive a deploy do servidor; 17º jogador cai na sala 2 | médio (requests) — 1º ponto onde jogadores reais somam horas |
| **F6 — Jogo** | missões co-op, economia online, polish mobile (touch já existe), botão ONLINE na title | — | avaliar upgrade US$ 5 conforme adoção |

**Fora de escopo do MVP (explícito):** voz/chat de texto (moderação é outro projeto), mundo
único persistente cross-sala, oclusão anti-wallhack, WebTransport (quando Workers suportar,
reavaliar — o protocolo já é datagram-friendly).

---

## 19. Trade-offs consolidados

| Decisão | Alternativa rejeitada | Por quê |
|---|---|---|
| DO por sala, 16 jogadores | 1 processo/mundo único grande | DO é 1 thread; sharding por sala é o único caminho horizontal — e é o modelo de sessão do próprio GTA:O |
| Tick 15 Hz + predição | 30–60 Hz server | dobraria CPU/duração/história por nada: o feel vem da predição local a 60 fps |
| `setInterval` no DO ativo | alarms a 15 Hz | alarm = request cobrado por disparo (1,3M/dia); interval roda dentro da duração já paga |
| Binário DataView | JSON / protobuf / flatbuffers | JSON: 3–5× maior + GC; protobuf/flatbuffers: dependência e codegen para meia dúzia de mensagens fixas |
| Snapshot delta + AOI | estado completo p/ todos | CPU de encode e banda de celular; e AOI é meia mitigação de wallhack de graça |
| Hitscan com lag comp | "favor the shooter" client-side (dizer "acertei") | violaria a autoridade; lag comp dá a mesma justiça sem confiar no cliente |
| Write-behind 60 s → D1 | escrita síncrona por transação | 100k writes/dia estourariam; e escrita no hot path do tick é latência |
| Identidade anônima (playerKey) | OAuth/contas | MVP sem fricção e sem PII; upgrade path claro depois |
| Economias single/online separadas | carteira única | exploit online não pode contaminar o save offline; fusão é decisão de jogo posterior |
| Fase 0 em JSON | binário desde o dia 1 | depurar protocolo novo às cegas é caro; a interface do codec isola a troca |

---

## 20. Riscos e questões em aberto

1. **TCP head-of-line** em celular ruim: um pacote perdido atrasa os seguintes. Mitigado por
   pacotes pequenos + interp de 120 ms; irredutível até WebTransport chegar em Workers. *Aceito.*
2. **CPU do free (10 ms/invocação) vs. mundo vivo:** o cap de NPCs da F4 é uma hipótese; se a
   medição mostrar tick p95 > 5 ms, os caps descem ou tier B vai a 2 Hz. *Medir antes de crescer.*
3. **Limites mudam:** os números da seção 4 são de 2026-07; a Cloudflare tem histórico de
   *melhorar* o free tier (Queues acabou de entrar), mas revalidar a cada fase.
4. **Sala nasce na região do 1º jogador:** um BR entrando numa sala criada por um europeu joga
   com 200 ms. Enquanto o jogo for pequeno/regional, irrelevante; o plano de buckets por região
   (seção 14) resolve quando doer.
5. **Dois mundos de save** (Vercel single × D1 online) pode confundir jogador ("cadê meu
   dinheiro?"). Decisão de produto pendente; tecnicamente unificável depois.
6. **Abuso do free tier por terceiros** (bots inflando requests): Origin check + token no join +
   rate limit derrubam o barato; se persistir, Turnstile (grátis) no join. *Só se acontecer.*

---

## Apêndice A — Esqueletos de código

### A.1 Worker (roteador de borda) — `server/src/index.ts`

```ts
import { GameRoomDO } from './do/game-room.ts';
import { LobbyDO } from './do/lobby.ts';
import { signSession, verifyOrigin } from './auth.ts';

export { GameRoomDO, LobbyDO };

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!verifyOrigin(req, env)) return new Response('forbidden', { status: 403 });

    if (url.pathname === '/api/join' && req.method === 'POST') {
      const { nick, playerKey } = await req.json<JoinBody>();
      const playerId = await hashKey(playerKey);            // identidade anônima estável
      if (await env.KV.get(`ban:${playerId}`)) return json({ error: 'banned' }, 403);
      const lobby = env.LOBBY.get(env.LOBBY.idFromName('lobby'));
      const { roomId } = await lobby.fetch('http://lobby/alloc', {
        method: 'POST', body: JSON.stringify({ playerId }),
      }).then(r => r.json<AllocResult>());
      const token = await signSession(env.SESSION_SECRET, { playerId, roomId, nick, exp: 60 });
      return json({ roomId, token, ws: `/ws/${roomId}` });
    }

    const m = url.pathname.match(/^\/ws\/(room:\d+)$/);
    if (m && req.headers.get('Upgrade') === 'websocket') {
      // token viaja na query; o DO revalida (a borda só faz triagem barata)
      const room = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      return room.fetch(req);
    }

    if (url.pathname === '/api/health') { /* métricas agregadas via Lobby */ }
    return new Response('not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
```

### A.2 `GameRoomDO` (núcleo) — `server/src/do/game-room.ts`

```ts
export class GameRoomDO extends DurableObject<Env> {
  private room!: RoomState;
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastInputAt = 0;                    // p/ pausa AFK

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.room = restoreRoom(await ctx.storage.get('room-blob')); // crash recovery
      // keepalive gratuito: responde "p"→"o" sem acordar o objeto
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('p', 'o'));
    });
  }

  async fetch(req: Request): Promise<Response> {           // upgrade do WebSocket
    const session = await verifySession(this.env.SESSION_SECRET, req); // exp, roomId, playerId
    if (!session) return new Response('bad token', { status: 403 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [session.playerId]);  // Hibernation API (20:1, sobrevive evict)
    await this.spawnPlayer(session);                       // lê D1, coloca no mundo
    this.ensureTicking();
    server.send(encodeWelcome(session.playerId, this.room));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, msg: ArrayBuffer | string) {
    if (typeof msg === 'string' || msg.byteLength > 256) return this.kick(ws, Kick.Protocol);
    const playerId = this.ctx.getTags(ws)[0] as PlayerId;
    const decoded = decode(new DataView(msg));             // valida estrutura + clamps
    if (!decoded) return;                                  // malformada: descarta silencioso
    if (!rateOk(this.room, playerId)) return this.kick(ws, Kick.Flood);
    routeMessage(this.room, playerId, decoded);            // enfileira input / ação / ping
    this.lastInputAt = this.room.tick;
    this.ensureTicking();                                  // acorda da pausa AFK
  }

  webSocketClose(ws: WebSocket) {
    const playerId = this.ctx.getTags(ws)[0] as PlayerId;
    scheduleDespawn(this.room, playerId, /*graceMs*/ 30_000); // reconexão reocupa o avatar
    this.flushSoon();
    if (this.connectedCount() === 0) this.shutdownRoom();
  }

  private ensureTicking() {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), 1000 / 15);
  }

  private tick() {
    const t0 = performance.now();
    stepSimulation(this.room, 1 / 15);                     // pipeline da seção 7.2
    if (this.room.tick % 3 !== 2) broadcastSnapshots(this.room, this.ctx.getWebSockets());
    this.room.tick++;
    trackTickTime(this.room.metrics, performance.now() - t0);
    // pausa AFK: sem input de ninguém há 60 s ⇒ para o interval e deixa hibernar
    if (this.room.tick - this.lastInputAt > 15 * 60) this.pause();
  }

  private pause() {
    clearInterval(this.interval!); this.interval = null;
    void this.persistHot();                                // blob p/ crash recovery
    // sem interval pendente + sockets hibernáveis ⇒ o runtime hiberna o objeto:
    // duração PARA de ser cobrada; próximo webSocketMessage religa tudo.
  }

  async alarm() {                                          // agendado a cada 60 s quando ativo
    await flushDirtyPlayersToD1(this.room, this.env.DB);   // write-behind em lote
    if (this.interval) await this.ctx.storage.setAlarm(Date.now() + 60_000);
  }
}
```

### A.3 Cliente — reconciliação (o coração do feel) — `js/net/prediction.ts`

```ts
export function onSnapshot(snap: Snapshot, local: LocalPlayer, pending: InputFrame[]) {
  // 1. tudo que o servidor já aplicou sai da lista
  while (pending.length && pending[0].seq <= snap.lastInputSeq) pending.shift();
  // 2. estado autoritativo substitui a predição antiga
  const authoritative = snap.entities.get(local.id)!;
  const before = local.sim.pos.clone();
  local.sim.setFrom(authoritative);
  // 3. replay dos inputs que o servidor ainda não viu (mesmo código de sim dos 2 lados)
  for (const f of pending) stepPlayer(local.sim, f, 1 / 60);
  // 4. corrigir sem denunciar: erro pequeno é suavizado, teleporte do servidor é seco
  const err = before.distanceTo(local.sim.pos);
  local.renderOffset = err < 0.4 ? before.sub(local.sim.pos) : ZERO; // decai ~100 ms no render
}
```

### A.4 Checklist de autoridade (gate de code review de toda fase)

```
[ ] Nenhum op C→S carrega posição/velocidade/resultado (grep no protocol/)
[ ] Toda interação tem validação de proximidade/estado no servidor
[ ] Nenhum valor de HUD (dinheiro/vida/wanted) é calculado no cliente
[ ] shared/ não importa three nem @/ (lint passa)
[ ] Caps de entidade respeitados; tick p95 registrado e < 5 ms
[ ] Mensagem malformada/flood testada (fuzz no unit) ⇒ descarte/kick, nunca crash
```
