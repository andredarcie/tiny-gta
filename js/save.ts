import { state, refs } from './state.js';
import type { SaveBlob, LedgerSnapshot } from './types.js';

// SAVE DE PROGRESSO — ponte entre o estado vivo do jogo e o blob que vai/vem do
// backend (js/leaderboard.js). Mantém este módulo "burro": ele só monta/aplica o
// blob lendo getters/setters que cada sistema registra em `refs` (mesmo padrão
// de refs.miniBlips/zoneActions), sem importar weapons/gym/property/... direto —
// assim não cria ciclos e novos slots entram só registrando o seu par em refs.
//
// O DINHEIRO agora é um LEDGER de transações (ver js/economy.js): o saldo é a soma
// das transações. O save carrega o snapshot do ledger (`blob.ledger`) e o restore
// é IDEMPOTENTE — re-aplicar o mesmo snapshot não dobra nem perde dinheiro (dedupe
// por id). `blob.money` continua presente como ESPELHO derivado (HUD/ranking/legado
// e fallback para saves antigos que ainda não têm `ledger`).

// Monta o blob a partir do estado atual. Slots ausentes viram vazio/null.
export function collectSave(): SaveBlob {
  return {
    v: 2,
    money: Math.max(0, Math.floor(state.money) || 0), // espelho derivado do ledger
    ledger: refs.serializeLedger?.() || null,         // {ckpt, seq, txs[]} — fonte da verdade do saldo
    weapons: refs.getWeaponsSave?.() || [],
    arm: refs.getGymSave?.() || null,
    house: refs.getPropertySave?.() || null,
    pkg: refs.getPackagesSave?.() || [],
    stunts: refs.getStuntsSave?.() || [],
    daily: refs.getDailySave?.() || null, // dia in-game + travas "1x por dia" dos mini-games
    farm: refs.getFarmSave?.() || null,   // grow-op: upgrade level + bought seeds/plant-food
  };
}

// Aplica um blob restaurado do backend ao jogo. Pode ser chamado mais de uma vez
// na mesma run (ex.: duplo-toque no LOGIN, reconciliação com o espelho local) —
// todos os caminhos abaixo são IDEMPOTENTES: o dinheiro via ledger (dedupe por id)
// e os itens via restore que checa posse antes de aplicar (weapons/property/...).
export function applySave(blob: unknown): void {
  if (!blob || typeof blob !== 'object') return;
  const b = blob as Partial<SaveBlob>;
  // Dinheiro: usa o snapshot do ledger quando existir; senão sintetiza um a partir
  // do `money` (save antigo, v1) — migração transparente no cliente.
  const ledger = (b.ledger && typeof b.ledger === 'object')
    ? b.ledger
    : (Number.isFinite(b.money) && (b.money as number) >= 0 ? { ckpt: Math.floor(b.money as number), txs: [] } : null);
  if (ledger) refs.importLedger?.(ledger as LedgerSnapshot);
  refs.restoreWeapons?.(b.weapons);
  refs.restoreGym?.(b.arm);
  refs.restoreProperty?.(b.house);
  refs.restorePackages?.(b.pkg);
  refs.restoreStunts?.(b.stunts);
  refs.restoreDaily?.(b.daily);
  refs.restoreFarm?.(b.farm);
}

refs.collectSave = collectSave;
refs.applySave = applySave;
