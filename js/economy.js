import {state,saveBest} from './state.js';

// ============================================================================
// ECONOMY — the single gateway for EVERY change to the player's money.
//
// Before this, each system poked `state.money` directly (`state.money+=reward`,
// `state.money-=price`, `state.money=Math.floor(state.money*.8)`), with the
// `saveBest()` call sometimes there and sometimes forgotten. A reward computed
// as NaN/negative/Infinity (a bad formula, a missing field) could silently
// corrupt the balance and the backend score.
//
// Now all money in/out flows through this one class:
//   - earn(amount, source)   — credit (mini-game rewards, fares, bonuses, ...)
//   - spend(amount, reason)  — debit with an affordability check (shops, bribes)
//   - canAfford(amount)      — read-only check
//   - penalty(keepFraction)  — proportional loss (death/arrest fees)
//
// `state.money` stays the canonical balance (HUD, save, render_game_to_text and
// the shops' own "NOT ENOUGH" checks all read it directly); this class is the
// only thing that should WRITE to it. earn() sanitizes the amount so a broken
// reward can never credit NaN/negative — "garantia máxima" that paying out a
// mini-game always lands a clean, positive sum.
// ============================================================================

// Coerce any value to a safe, non-negative whole number of dollars.
function clean(amount){
  const n=Math.floor(Number(amount));
  return Number.isFinite(n)&&n>0?n:0;
}

class Economy{
  constructor(){
    // running session totals, handy for debug / stats screens
    this.earned=0;
    this.spent=0;
  }

  // current balance (always read through state.money so saves/HUD stay in sync)
  get balance(){return state.money;}

  // Credit money. Sanitizes the amount (no NaN/negative/Infinity ever reaches
  // the balance) and persists the best score. Returns the amount actually
  // credited (0 if the input was invalid). `source` is a free label for debug.
  //   persist=false skips saveBest for high-frequency payouts (e.g. the overkill
  //   per-second income) so we don't hammer localStorage every frame.
  earn(amount,source='',{persist=true}={}){
    const amt=clean(amount);
    if(amt<=0)return 0;
    state.money+=amt;
    this.earned+=amt;
    if(persist)saveBest();
    return amt;
  }

  // Can the player afford this? (read-only)
  canAfford(amount){return state.money>=clean(amount);}

  // Debit money for a purchase. Only deducts when the player can afford it;
  // returns true if paid, false if it could not (balance untouched). Callers
  // that want their own "NOT ENOUGH" message should still check canAfford first
  // for the prompt — this is the final guard that the money really leaves.
  spend(amount,reason=''){
    const amt=clean(amount);
    if(amt<=0)return true;          // nothing to charge
    if(state.money<amt)return false; // can't afford: leave balance alone
    state.money-=amt;
    this.spent+=amt;
    saveBest();
    return true;
  }

  // Proportional loss on death/arrest: keep `keepFraction` of the balance
  // (e.g. 0.8 = lose 20%). Returns the amount lost.
  penalty(keepFraction,reason=''){
    const before=state.money;
    state.money=Math.max(0,Math.floor(before*keepFraction));
    const lost=before-state.money;
    this.spent+=lost;
    saveBest();
    return lost;
  }
}

// One shared ledger for the whole game.
export const economy=new Economy();
