# Plano — Costa irregular (ilha de verdade)

> Objetivo: hoje o mapa é "dois quadrados" (cidade quadrada + península rural retangular)
> cercados por um disco de mar. Transformar a **borda** numa **costa irregular e realista**
> (capes, enseadas, pontas de areia, ilhotas), **mantendo todo o conteúdo atual nas posições
> atuais**. Nada disso foi implementado ainda — só levantamento/projeto. O jogo está intacto.

## Princípio central: aditivo + fonte única de verdade
- A costa é **ADITIVA**: só acrescenta terra **por fora** do que já existe. Assim **todo** o
  conteúdo (prédios, ruas, props de praia, fazendas, montanha, pinheiros) continua em terra firme.
- Uma única função `isLand(x,z)` (em `js/constants.js`) decide terra vs. mar e é usada por:
  1. o **visual** (malha de areia/espuma/shallows que segue o contorno), e
  2. o **gameplay** (`inWater` em `js/player.js`).
  Se as duas não usarem a mesma função, o jogador "nada em cima da areia" (ou anda na água).

## Estado atual (peças que formam o "quadrado")
- **Mar**: `assets/models/environment/sea.js` — disco `CircleGeometry(1400)` em y=-0.32.
- **Praia da cidade**: `js/world.js` (~linha 148) — plano quadrado `W=GROUND+BEACH*2=442`
  (±221), areia + **espuma pintada nas 4 bordas**, em y=-0.06.
- **Shallows/ondas**: `assets/models/terrain/shallows-waves.js` — **anéis QUADRADOS**
  (`squareRing`) turquesa em ~219..253, + 3 anéis de espuma animados (escalados por `updateBeach`).
- **Rural**: `js/world.js` (~linha 217) — `PlaneGeometry(RW×RD)` retangular com colinas, bordas de
  areia pintadas no canvas, em y=-0.02.
- `js/world.js` `updateBeach(time)` anima os anéis de onda (chamado no `main.js` step).

## Números do mapa (de `js/constants.js`)
- `N=8, CELL=44, ROAD=14, HALF=N*CELL/2=176, GROUND=N*CELL+ROAD=366`.
- `BEACH=38`. Borda do chão da cidade = `GROUND/2 = 183`.
- `WATER=HALF+ROAD/2+BEACH-3 = 218` (linha d'água atual; `inWater` usa quadrado de 218).
- `BOUND=216` (NPCs param aqui — quadrado).
- `SWIM_BOUND=WATER+70 = 288` (parede invisível no mar; usada em `collideStatics`).
- Rural: `RURAL_X0=183, RURAL_X1=573, RURAL_HALF=120`. Montanha: `MOUNT_X=509, MOUNT_R=62`.
- **Conteúdo rural vai até |z|≈114** (pinheiros: `rand(-RURAL_HALF+6, RURAL_HALF-6)`), |z|<74 (roças),
  |z|<62 na montanha. → a largura rural **não pode afunilar no corpo**, só na ponta leste.
- **Props de praia** (palmeiras/guarda-sóis/cadeiras via `beachSpot`) ficam em ~186..217 nos 4 lados
  (inclusive perto dos cantos). → a ilha **precisa conter o quadrado de 218 inteiro** (cantos inclusos).

## Modelo matemático proposto (`isLand`)

### Cidade (polar, centrada na origem)
```
edge(θ)      = WATER / max(|cosθ|, |sinθ|)        // distância do centro à borda do quadrado 218
margin(θ)    = clamp(28 + 22·sin(3θ+0.7) + 14·sin(5θ+2.3) + 9·sin(8θ+4.1) + 6·sin(13θ+1.1), 8, 60)
cityCoastR(θ)= edge(θ) + margin(θ)               // SEMPRE ≥ borda do quadrado → aditivo
isCityLand   = hypot(x,z) ≤ cityCoastR(atan2(z,x))
```
- `margin ≥ 8 > 0` garante que o quadrado de 218 (e os props até 217) fiquem dentro → nada se perde.
- Cantos ficam pontudos (edge≈308 em 45°) → vão virar "headlands" grandes. Isso pode parecer
  "quadrado com pontas". **Para suavizar:** aumentar `margin` nas direções dos eixos (empurrar as
  bordas pra fora, ~+50) deixando os cantos quase iguais → fica mais redondo. Mas cuidado: empurrar
  demais aproxima de `SWIM_BOUND=288` (sobra pouco mar). Se for o caso, **aumentar `SWIM_BOUND`**
  (ex.: `WATER+115`) pra dar mar em volta. Validar visualmente e iterar (ver "Verificação").
- Alternativa pra des-quadrar sem mexer no resto: **adicionar ilhotas/recifes offshore** nos 4
  cantos (areia pequena + `beach-rock`) pra quebrar a silhueta.

### Rural (península, bordas onduladas só pra fora; afunila só na ponta leste)
```
tipStart = RURAL_X1 - 70                          // ~503; antes disso largura cheia
base(x)  = (x ≤ tipStart) ? RURAL_HALF
                          : RURAL_HALF·(1 - t²)·0.9 + 8,  t = clamp((x-tipStart)/((RURAL_X1+28)-tipStart),0,1)
wig(x)   = max(0, 8 + 7·sin(0.045x+1.1) + 5·sin(0.10x+3.3))   // só ADICIONA largura
ruralHalf(x) = base(x) + wig(x)                   // ≥ RURAL_HALF no corpo → contém conteúdo (114)
isRuralLand  = (RURAL_X0-2 ≤ x ≤ RURAL_X1+28) && |z| ≤ ruralHalf(x)
```
- Afunila **só** depois de `tipStart` (passada a montanha), nunca no corpo → pinheiros (|z|≈114) ficam em terra.
- Conecta na cidade: em x≈183 a `cityCoastR` já cobre o leste; rural sobrepõe → **união sem buraco**.

### União
```
isLand(x,z) = isCityLand(x,z) || isRuralLand(x,z)
inWater(p)  = !state.interior && !isLand(p.x, p.z)   // (em js/player.js)
```

## Implementação visual (novo módulo `assets/models/terrain/island.js`)
Construir, e **substituir** as peças quadradas:
1. **Areia da ilha (cidade)**: `THREE.Shape` amostrando `cityCoastR(θ)` em ~160 pontos → disco
   irregular preenchido, material de areia (reusar/adaptar o canvas de areia da praia atual, **sem**
   a espuma quadrada). y=-0.06. O chão da cidade (366²) fica por cima e cobre o miolo; a areia só
   aparece no anel 183..costa. **Remover** o plano quadrado de praia do `world.js`.
2. **Espuma**: banda fina (`ShapeGeometry` com furo) entre `cityCoastR(θ)-5` e `cityCoastR(θ)`,
   branca translúcida, `depthWrite:false`, y≈-0.045. Pode pulsar opacidade em `updateBeach`/`updateCoast`.
3. **Shallows**: 1–2 bandas turquesa seguindo a costa (`cityCoastR..+22` e `+22..+45`), y=-0.305.
   **Substitui** `addShallowsAndWaves` (anéis quadrados).
4. **Fringe rural**: shape preenchido percorrendo a borda norte (`z=+ruralHalf(x)`), a ponta, e a
   borda sul (`z=-ruralHalf(x)`); areia; por baixo do gramado rural (que cobre |z|≤120). Mostra só a
   franja 120..ruralHalf + a ponta afunilada. + espuma + shallows iguais aos da cidade.
5. **Ilhotas/rochas offshore** (polish): 3–6 pontos de areia pequenos + clusters de `beach-rock`
   pra quebrar a silhueta.
6. Exportar `updateCoastFoam(time)` (animação de espuma) e ligar no `main.js` no lugar de/junto com
   `updateBeach`.

## Integração de gameplay (consistência)
- **`js/player.js` `inWater`**: trocar o teste quadrado por `!isLand(p.x,p.z)` (importar de constants).
  - Locais que chamam `inWater` (todos só-player, por-frame, custo ok): updateFoot(swim), updatePlane,
    updateCar(afundar), updateBoat(onWater). ~4 chamadas/frame → `isLand` (atan2+hypot+sin) é barato.
- **Lancha (PROBLEMA conhecido)**: nasce em `(24, WATER+12=230)` (`js/player.js` `spawnBoat` e
  `js/boat-race.js` `BOAT_SPAWN`). Uma ponta nova pode tornar isso TERRA → lancha encalhada.
  **Solução:** computar um ponto de água garantido em `constants.js` e usar nos dois:
  ```
  export const BOAT_SPAWN_X = 24;
  let _bz = WATER+12; while(isLand(BOAT_SPAWN_X,_bz) && _bz < SWIM_BOUND-24) _bz += 5;
  export const BOAT_SPAWN_Z = _bz + 8;
  ```
  (definir DEPOIS de `isLand` no arquivo). `player.js`/`boat-race.js` passam a usar essas constantes.
- **Avião**: nasce em `(-202,0,40)` = oeste, |x|=202<218 → continua em terra (ok, sem mudança).
- **NPCs** (`BOUND=216`, quadrado): ficam no miolo, não usam as pontas novas → sem regressão.
- **`beachSpot`** (props de praia, 186..217): tudo dentro de 218 → continua em terra (aditivo garante).
  (Opcional: filtrar por `isLand` se quiser props nas pontas novas.)
- **`js/physics.js` `collideStatics`**: parede do jogador é `SWIM_BOUND` (quadrado ±288) + extensão
  rural (`maxX = RURAL_X1+ext` quando `|z|<RURAL_HALF+ext`). As pontas da cidade ficam dentro de ±288
  → o jogador anda nelas sem ser empurrado (✔). **Ponta rural** vai até `RURAL_X1+28=601`, mas a
  física hoje limita a `RURAL_X1=573` e `|z|<RURAL_HALF+ext`. Se quiser pisar na ponta nova, ajustar
  o clamp rural (ex.: `RURAL_X1 + 28` e largura `ruralHalf(x)`); senão, deixar a ponta como decorativa
  (jogador não chega lá de qualquer jeito).
- **Boat-race buoys** (`js/boat-race.js`): conferir se algum gate/boia cai em terra com a ilha maior
  (ficam bem ao largo, provavelmente ok — validar).

## Fases sugeridas (iterar visualmente entre cada uma)
1. **Cidade**: `isLand` (cidade) + `island.js` (areia+espuma+shallows da cidade) + remover praia/shallows
   quadrados + `inWater` + `BOAT_SPAWN`. **Tirar screenshot de cima e ajustar `margin`** até parecer ilha.
2. **Rural**: `isLand` (rural) + franja rural irregular + ponta afunilada.
3. **Polish**: ilhotas/recifes offshore, rochas, talvez variar largura da praia (areia mais larga em
   algumas baías).

## Verificação (já temos a ferramenta)
- Harness Playwright (Chrome real) está documentado em `.claude/skills/perf-optimize/` (profiler/medição).
  Para a ilha, o melhor é uma **visão de cima**: abrir o jogo, e ou (a) olhar o **minimapa/mapa completo**
  (mas eles desenham o quadrado — vão precisar refletir a costa nova também), ou (b) posicionar a câmera
  do model-viewer / uma câmera ortográfica de debug sobre a cena. Tirar screenshot e iterar os `margin`.
- **Atenção ao mapa/minimapa** (`js/hud.js`): hoje desenha a cidade como quadrado (`mmStatic`) e a rural
  como retângulo (`mmRural`). Para coerência, o minimapa/mapa deveriam refletir a costa irregular também
  (redesenhar `mmStatic`/`mmRural` com o contorno de `isLand`, ou pintar a ilha amostrando `isLand`).
- Validação padrão do repo: `node --check <arquivo>` + `npm run build` (sem framework de teste).

## Riscos / cuidados
- **Performance**: `isLand` em `inWater` é só-player (~4×/frame) → ok. NÃO chamar `isLand` por-NPC.
  A malha de areia irregular é estática (1–2 draw calls) → ok; aplicar `matrixAutoUpdate=false` (padrão
  do repo p/ malhas estáticas).
- **Z-fighting**: manter as alturas separadas (sea -0.32, shallows -0.305, areia -0.06, espuma -0.045,
  chão cidade ~0, gramado rural -0.02). Não sobrepor planos na mesma y.
- **Edição paralela**: tem trabalho de **natação/fôlego** (`state.swimming`, `#breath`) e um **mapa
  completo** novo no `hud.js` rolando em paralelo — fazer edições por-string pra não pisar neles, e
  reconferir `inWater`/`SWIM_BOUND` que a natação também usa.

## Arquivos que serão tocados
- `js/constants.js` — `isLand`/`cityCoastR`/`ruralHalf` + `BOAT_SPAWN_X/Z` (+ talvez `SWIM_BOUND`).
- `assets/models/terrain/island.js` — **novo** (areia+espuma+shallows irregulares, `updateCoastFoam`).
- `js/world.js` — remover praia quadrada + `addShallowsAndWaves`; chamar o novo builder; franja rural.
- `js/player.js` — `inWater` via `isLand`; `spawnBoat` usa `BOAT_SPAWN_*`.
- `js/boat-race.js` — `BOAT_SPAWN` usa `BOAT_SPAWN_*`.
- `js/main.js` — `updateBeach` → `updateCoastFoam` (ou manter ambos).
- `js/hud.js` — (coerência) minimapa/mapa refletindo a costa irregular.
- `js/physics.js` — (opcional) clamp rural até a ponta nova.
- `assets/models/terrain/shallows-waves.js` — aposentar/adaptar (anéis quadrados).
