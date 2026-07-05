# Histórico de comparações — Player (estilo Schedule I)

Cada arquivo `NN_AAAA-MM-DD_HH-MM-SS.png` é uma print **lado a lado** gerada numa
evolução do visual do player:

- **Coluna esquerda** = Schedule I (referência real, screenshots da Steam)
- **Coluna direita** = player do Tiny Crime (estilo novo)
- Linha de cima = rosto · Linha de baixo = corpo

Os números crescem a cada nova versão (nunca sobrescreve), então dá para abrir e
ver a progressão. A versão mais recente também fica em
`../comparacao-player-vs-scheduleI.png` (raiz do projeto).

## Como gerar uma nova comparação

```bash
# precisa do nosso dev server numa porta dedicada (5173 às vezes é ocupada por outro projeto)
npm run dev -- --port 5273 --strictPort   # em outro terminal
HEADLESS=1 npx playwright test test/portrait.spec.js
```

O spec (`test/portrait.spec.js`) renderiza o player e arquiva a print aqui
automaticamente.
