import {state, refs, saveBest} from './state.js';

// SAVE DE PROGRESSO — ponte entre o estado vivo do jogo e o blob que vai/vem do
// backend (js/leaderboard.js). Mantém este módulo "burro": ele só monta/aplica o
// blob lendo getters/setters que cada sistema registra em `refs` (mesmo padrão
// de refs.miniBlips/zoneActions), sem importar weapons/gym/property/... direto —
// assim não cria ciclos e novos slots entram só registrando o seu par em refs.
//
// O dinheiro salvo é o SALDO ATUAL (não o pico): como armas/itens compráveis
// agora persistem, gastar precisa "grudar" — senão recarregar devolveria o
// dinheiro e manteria o item (item de graça). O leaderboard continua guardando o
// pico, por um caminho separado (ver js/leaderboard.js flush()).

// Monta o blob a partir do estado atual. Slots ausentes viram vazio/null.
export function collectSave() {
  return {
    v: 1,
    money: Math.max(0, Math.floor(state.money) || 0),
    weapons: refs.getWeaponsSave?.() || [],
    arm: refs.getGymSave?.() || null,
    house: refs.getPropertySave?.() || null,
    pkg: refs.getPackagesSave?.() || [],
    stunts: refs.getStuntsSave?.() || [],
  };
}

// Aplica um blob restaurado do backend ao jogo (chamado uma vez ao abrir a run).
export function applySave(blob) {
  if (!blob || typeof blob !== 'object') return;
  if (Number.isFinite(blob.money) && blob.money > 0) { state.money = Math.floor(blob.money); saveBest(); }
  refs.restoreWeapons?.(blob.weapons);
  refs.restoreGym?.(blob.arm);
  refs.restoreProperty?.(blob.house);
  refs.restorePackages?.(blob.pkg);
  refs.restoreStunts?.(blob.stunts);
}

refs.collectSave = collectSave;
refs.applySave = applySave;
