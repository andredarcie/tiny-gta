import {state,saveBest,refs,INITIAL_MONEY} from './state.js';

// ============================================================================
// ECONOMY — money modeled as an idempotent TRANSACTION LEDGER.
//
// The balance is no longer a free-floating number that systems poke; it is the
// SUM of signed transactions:
//     state.money = max(0, checkpoint + Σ(amount of the txs in the window))
//
// Every money change is a transaction {id, amt, why, t}:
//   - amt > 0  -> credit (mini-game rewards, fares, bonuses, the genesis balance)
//   - amt < 0  -> debit  (shop purchases, bribes, death/arrest penalties)
//   - id       -> unique; applying the same id twice is a NO-OP (idempotent)
//   - why      -> free label (the same source strings used before: 'taxi', ...)
//
// Why a ledger: the old restore summed a "gap over INITIAL_MONEY" and leaned on a
// fragile `moneyRestored` flag to avoid doubling on a double-tap login. With ids,
// re-applying the same ledger is idempotent BY CONSTRUCTION (dups are skipped), so
// restore can run any number of times without ever doubling money. The same ids
// also let a caller dedupe a logical event (pass a stable `id` to earn()).
//
// Public API is unchanged so the ~30 callsites keep working:
//   earn(amount, source, {persist, id})  spend(amount, reason)
//   penalty(keepFraction, reason)        canAfford(amount)   get balance
// ============================================================================

// Coerce any value to a safe, non-negative whole number of dollars.
function clean(amount){
  const n=Math.floor(Number(amount));
  return Number.isFinite(n)&&n>0?n:0;
}

// Allowed transaction id shape. Mirrors the backend's sanitizeTx; '#' is reserved
// for the server hash's bookkeeping fields so it can never appear in a tx id.
const ID_OK=/^[A-Za-z0-9:_-]{1,32}$/;

// In-memory window bounds. Compaction folds older txs into `checkpoint` so the
// array — and the persisted blob — stay small no matter how long the session runs.
const MAX_LEDGER=120, KEEP=60;
// How many recent txs the PERSISTED snapshot carries. Kept under the backend's
// 64-item array cap (sanitizeValue); everything older is folded into `ckpt`.
const SAVE_TXS=40;
// Soft cap on the unsynced queue (pathological offline play). When exceeded, the
// oldest pendings are COLLAPSED into one synthetic tx so their net amount still
// reaches the server (never silently dropped — that would lose money on restore).
const PENDING_CAP=2000, PENDING_FOLD=1000;

// Anti rapid-fire: minimum spacing (ms) between two POSITIVE credits from the SAME
// mini-game source. Makes it IMPOSSIBLE for one mini-game to pay twice in quick
// succession — a double-fire / re-entry / rapid re-completion is rejected. Only
// listed sources are guarded: these are END-OF-RUN / per-objective payouts that, in
// real play, are always seconds apart, so the window only ever catches a duplicate.
// Per-EVENT activities (rc-toyz kills, hidden-package clusters, loot, stunt jumps,
// overkill per-second income) are deliberately OMITTED so legit rapid/simultaneous
// earns are never blocked; those rely on the per-tx id dedupe instead. The server's
// plausibility cap (~$200/s) is the anti-cheat backstop if the client is bypassed.
const SOURCE_COOLDOWN_MS={
  race:3000, 'boat-race':3000, offroad:3000, dance:3000,
  rampage:3000, 'rocket-rampage':3000,
  taxi:2000, 'car-crusher':2000, 'import-export':2000, 'weed-farm':2000,
  paramedic:1000, firefighter:1000, vigilante:1000,
};

class Economy{
  constructor(){
    this.earned=0; this.spent=0;       // running session totals (debug/stats)
    this.ledger=[];                    // recent txs {id,amt,why,t,local}
    this.seen=new Set();               // ids currently in `ledger` (O(1) dedupe)
    this.checkpoint=0;                 // folded sum of compacted/imported txs
    this.sum=0;                        // Σ amt of the txs currently in `ledger`
    this.ckptSeq=0;                    // bumps on each compaction/import
    this.seq=0;                        // monotonic counter for auto tx ids
    this.salt=Math.random().toString(36).slice(2,8); // per-session id salt
    this.pending=[];                   // txs not yet acked by the backend
    this.pfoldSeq=0;                   // sequence for collapsed-pending ids
    this.lastEarnT=Object.create(null);// last credit time per guarded mini-game source
    this.blocked=0;                    // count of rapid-fire credits rejected (debug)
    this.seedGenesis();
  }

  // current balance (always read through state.money so saves/HUD stay in sync)
  get balance(){return state.money;}

  // Recompute the canonical balance from checkpoint + window sum (clamped >= 0).
  // Order-independent: clamping only the final sum keeps replays deterministic.
  _recompute(){ state.money=Math.max(0,this.checkpoint+this.sum); }

  // Unique-ish id for a tx with no caller-supplied stable id. `seq` guarantees
  // uniqueness within a session; `salt` avoids collisions across sessions/devices.
  _autoId(){ return (this.seq++).toString(36)+'-'+this.salt+'-'+Math.random().toString(36).slice(2,6); }

  // Append a tx idempotently. Returns true if applied, false if the id was a dup.
  // `track` flags a real session tx: it must survive a restore-rebase and be sent
  // to the backend. Imported/base txs (server snapshot, genesis) pass track=false.
  _apply(tx,{track=true}={}){
    if(!tx||this.seen.has(tx.id))return false;
    this.seen.add(tx.id);
    tx.local=track;
    this.ledger.push(tx);
    this.sum+=tx.amt;
    if(track)this._queue(tx);
    this._recompute();
    if(this.ledger.length>MAX_LEDGER)this._compact();
    return true;
  }

  // Queue a tx for the next backend flush, collapsing the oldest if the queue
  // grows pathologically large (keeps the net amount; nothing is ever dropped).
  _queue(tx){
    this.pending.push({id:tx.id,amt:tx.amt,why:tx.why,t:tx.t});
    if(this.pending.length>PENDING_CAP){
      const old=this.pending.splice(0,PENDING_FOLD);
      let net=0; for(const t of old)net+=t.amt;
      this.pending.unshift({id:'pfold:'+(this.pfoldSeq++)+'-'+this.salt,amt:net,why:'fold',t:Date.now()});
    }
  }

  // Seed the starting balance as a tx with a STABLE id ('genesis') so the client
  // seed and the server's migration seed dedupe to a single entry per ledger.
  seedGenesis(){ this._apply({id:'genesis',amt:INITIAL_MONEY,why:'start',t:Date.now()}); }

  // Credit money. Sanitizes the amount (no NaN/negative/Infinity ever lands) and
  // records a transaction. Returns the amount credited (0 if invalid OR if `id`
  // was already applied — a deduped event credits nothing). persist=false skips
  // saveBest for high-frequency payouts (e.g. overkill per-second income).
  earn(amount,source='',{persist=true,id}={}){
    const amt=clean(amount);
    if(amt<=0)return 0;
    const now=Date.now();
    // anti rapid-fire: the same mini-game can't pay again within its cooldown.
    const cd=SOURCE_COOLDOWN_MS[source];
    if(cd&&now-(this.lastEarnT[source]||0)<cd){ this.blocked++; return 0; }
    const txId=(typeof id==='string'&&ID_OK.test(id))?id:this._autoId();
    if(!this._apply({id:txId,amt,why:source||'earn',t:now}))return 0; // dup id: no double credit
    if(cd)this.lastEarnT[source]=now; // only stamp once the credit really landed
    this.earned+=amt;
    if(persist)saveBest();
    refs.backupSave?.();
    return amt;
  }

  // Can the player afford this? (read-only)
  canAfford(amount){return state.money>=clean(amount);}

  // Debit money for a purchase. Only deducts when affordable; returns true if paid,
  // false if it could not (balance untouched). Records a negative transaction.
  spend(amount,reason=''){
    const amt=clean(amount);
    if(amt<=0)return true;            // nothing to charge
    if(state.money<amt)return false;  // can't afford: leave balance alone
    this._apply({id:this._autoId(),amt:-amt,why:reason||'spend',t:Date.now()});
    this.spent+=amt;
    saveBest();
    refs.backupSave?.();
    return true;
  }

  // Proportional loss on death/arrest: keep `keepFraction` of the balance (e.g.
  // 0.8 = lose 20%). Records the loss as a negative tx. Returns the amount lost.
  penalty(keepFraction,reason=''){
    const before=state.money;
    const target=Math.max(0,Math.floor(before*keepFraction));
    const lost=before-target;
    if(lost>0){
      this._apply({id:this._autoId(),amt:-lost,why:reason||'penalty',t:Date.now()});
      this.spent+=lost;
      saveBest();
      refs.backupSave?.();
    }
    return lost;
  }

  // Fold the oldest window txs into the checkpoint, keeping the last KEEP. Balance
  // is invariant (we just move amount from `sum` into `checkpoint`). Folded ids
  // leave `seen`: they are minutes/hours old, so a stale duplicate is implausible,
  // and a full-snapshot re-import dedupes via the checkpoint, not per-tx ids.
  _compact(){
    const fold=this.ledger.length-KEEP;
    if(fold<=0)return;
    const removed=this.ledger.splice(0,fold);
    let moved=0;
    for(const tx of removed){ moved+=tx.amt; this.seen.delete(tx.id); }
    this.checkpoint+=moved;
    this.sum-=moved;
    this.ckptSeq++;
  }

  // Bounded snapshot for persistence: fold everything except the last SAVE_TXS
  // into `ckpt` (without mutating memory) so ckpt + Σtxs == current balance and
  // the blob stays small. importLedger() is the exact inverse.
  serialize(){
    const keep=this.ledger.slice(-SAVE_TXS);
    let keptSum=0; for(const t of keep)keptSum+=t.amt;
    return {
      ckpt:this.checkpoint+(this.sum-keptSum),
      seq:this.ckptSeq,
      txs:keep.map(t=>({id:t.id,amt:t.amt,why:t.why,t:t.t})),
    };
  }

  // REBASE the ledger onto a restored snapshot, idempotently. Drops the provisional
  // base (genesis), adopts `saved` as the new base, then re-applies the session txs
  // earned before the restore arrived (deduped by id). Calling it twice with the
  // same snapshot yields the same balance — no guard flag needed.
  //   saved = {ckpt, seq, txs:[{id,amt,why,t}]}  (txs optional; ckpt alone suffices)
  importLedger(saved){
    if(saved==null)return;
    const ckpt=Math.floor(Number(saved.ckpt)||0);
    const txs=Array.isArray(saved.txs)?saved.txs:[];
    // session txs to carry over (everything local EXCEPT genesis — the base owns it)
    const carry=this.ledger.filter(tx=>tx.local&&tx.id!=='genesis');
    // reset onto the restored base
    this.ledger=[]; this.seen=new Set(); this.sum=0;
    this.checkpoint=ckpt;
    this.ckptSeq=Math.floor(Number(saved.seq)||0);
    this.seen.add('genesis');          // base already accounts for the starting balance
    this.pending=[];                   // rebuilt from carry below (server dedupes resends)
    for(const t of txs){               // saved recent txs become base (not re-sent)
      const tx=this._sanitize(t);
      if(tx)this._apply(tx,{track:false});
    }
    for(const tx of carry)this._apply(tx,{track:true}); // session txs on top, deduped by id
    this._recompute();
  }

  // Coerce one restored tx record into a clean tx, or null if unusable.
  _sanitize(raw){
    if(!raw||typeof raw!=='object')return null;
    const id=typeof raw.id==='string'&&ID_OK.test(raw.id)?raw.id:null;
    const amt=Math.floor(Number(raw.amt));
    if(!id||!Number.isFinite(amt))return null;
    return {id,amt,why:String(raw.why||'').slice(0,32),t:Math.floor(Number(raw.t))||Date.now()};
  }

  // Unsynced txs to send on the next flush (copies; safe to resend on failure).
  // Capped per flush so the request body stays well under the backend's 16KB
  // limit; the queue drains over successive flushes (oldest first).
  takeUnsynced(limit=60){ return this.pending.slice(0,limit).map(t=>({id:t.id,amt:t.amt,why:t.why,t:t.t})); }
  // Drop txs the backend confirmed it stored.
  ackSynced(ids){
    if(!ids||!ids.length)return;
    const ack=new Set(ids);
    this.pending=this.pending.filter(t=>!ack.has(t.id));
  }

  // Recent transactions for the pause-menu wallet, NEWEST FIRST. This is the live
  // in-memory window (genesis + the last ~MAX_LEDGER moves); older txs were folded
  // into the checkpoint by compaction, so it is "recent activity", not all-time.
  // Lightweight copies so the UI can't mutate the ledger.
  history(){
    const out=[];
    for(let i=this.ledger.length-1;i>=0;i--){
      const t=this.ledger[i];
      out.push({amt:t.amt,why:t.why,t:t.t});
    }
    return out;
  }

  // Wallet headline for the transactions panel: current balance + session totals.
  stats(){
    return {balance:state.money,earned:this.earned,spent:this.spent,count:this.ledger.length};
  }

  // Compact summary for render_game_to_text (debug/tests).
  debugLedger(){
    return {
      balance:state.money,
      checkpoint:this.checkpoint,
      window:this.ledger.length,
      pending:this.pending.length,
      blocked:this.blocked, // rapid-fire mini-game credits rejected this session
      last:this.ledger.slice(-5).map(t=>({why:t.why,amt:t.amt})),
    };
  }
}

// One shared ledger for the whole game.
export const economy=new Economy();

// Expose the persistence hooks through refs (same late-binding pattern as
// refs.collectSave) so save.js / leaderboard.js reach the live singleton.
refs.serializeLedger=()=>economy.serialize();
refs.importLedger=s=>economy.importLedger(s);
refs.takeUnsyncedTxs=()=>economy.takeUnsynced();
refs.ackSyncedTxs=ids=>economy.ackSynced(ids);
refs.debugLedger=()=>economy.debugLedger();
