// In-game PAUSE MENU — a proper game menu (P / Esc on desktop, the II button on
// touch). Top level: RESUME, INFO, SETTINGS, QUIT. INFO groups the read-only panels
// (leaderboard, transactions, updates, the full MAP, and a MINI GAMES reference that
// lists every mini-game's payouts/costs/timers straight from minigame-rewards.json).
// SETTINGS holds graphics/audio plus the fullscreen toggle.
//
// Self-contained: it owns every node under #pauseov and wires its own listeners
// (one delegated set, in setupPauseMenu). It must NOT import input.js (which imports
// this) — resume / fullscreen / the full map go through late-bound refs
// (refs.togglePause / refs.toggleFullscreen / refs.openFullMap) to keep the
// dependency one-directional.
import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {API,getNickname,flush} from '@/ui/leaderboard.ts';
import {settings,setSetting,resetSettings} from '@/core/settings.ts';
import UPDATES from '../../updates.json';
import MINIGAME_REWARDS from '../../minigame-rewards.json';

// A changelog entry shape (root updates.json, newest-first).
interface Update { id: string; date: string; title: string; description: string; }
// A leaderboard row from /api/scores.
interface LbEntry { rank: number; name: string; money: number; }
// One settings control descriptor (the SCHEMA below).
interface SettingItem { key: string; type: 'range' | 'toggle'; label: string; min?: number; max?: number; step?: number; suffix?: string; }

const $=(id: string): HTMLElement | null=>document.getElementById(id);
const escapeHtml=(s: unknown): string=>String(s).replace(/[&<>"']/g,
  c=>(({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string, string>)[c]));

const fmtMoney=(n: unknown): string=>'$'+Math.abs(Math.floor(Number(n)||0)).toLocaleString('en-US');
const fmtSigned=(n: unknown): string=>(Number(n)<0?'-':'+')+fmtMoney(n);
const moneyCompact=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
const fmtCompact=(n: unknown): string=>'$'+moneyCompact.format(Math.max(0,Math.floor(Number(n)||0)));
const fmtTime=(t: unknown): string=>{try{return new Date(Number(t)).toLocaleString();}catch(e){return '';}};
const fmtDate=(d: string): string=>{try{return new Date(d+'T00:00:00').toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});}catch(e){return String(d);}};

// ---- updates / changelog (driven by the root updates.json, newest-first) ----
// The newest entry's id is what we remember as "seen": when it differs from the
// stored value, the menu shows a NEW badge until the player opens the panel.
const UPDATES_SEEN_KEY='tinycrime_updates_seen';
const UPDATES_LIST=UPDATES as Update[];
const latestUpdateId=(): string=>(UPDATES_LIST&&UPDATES_LIST[0]&&UPDATES_LIST[0].id)||'';
function hasUnseenUpdates(): boolean {
  if(!latestUpdateId())return false;
  try{return localStorage.getItem(UPDATES_SEEN_KEY)!==latestUpdateId();}catch(e){return false;}
}
function markUpdatesSeen(): void {
  try{localStorage.setItem(UPDATES_SEEN_KEY,latestUpdateId());}catch(e){}
}

// Friendly names for the ledger `why` source strings (see economy.js callsites).
// Unknown sources fall back to a humanized version of the raw string.
const WHY_LABELS: Record<string, string>={
  start:'Starting cash', earn:'Income', spend:'Purchase', penalty:'Penalty', fold:'Adjustment',
  taxi:'Taxi fare', race:'Street race', 'boat-race':'Boat race', offroad:'Off-road race',
  dance:'Dance tips', rampage:'Rampage', 'rocket-rampage':'Rocket rampage', overkill:'Overkill',
  paramedic:'Ambulance shift', firefighter:'Firefighter', vigilante:'Street justice',
  'car-crusher':'Car crusher', 'import-export':'Car export', 'weed-farm':'Weed sale', 'weed-deal':'Weed delivery',
  delivery:'Delivery', 'cash-drop':'Cash drop', loot:'Loot', 'rc-toyz':'RC Toyz',
  'hidden-package':'Hidden package', 'hidden-package-all':'All packages bonus',
  'hidden-package-bonus':'Package bonus', 'stunt-jump':'Stunt jump',
  'stunt-jump-repeat':'Stunt jump', story:'Mission reward', rick:'Side mission',
  property:'Bought house', 'mod-shop':'Car mods', 'bomb-shop':'Car bomb',
  weapon:'Weapon', ammo:'Ammo', busted:'Arrested', wasted:'Hospital bill',
  seeds:'Seeds',
};
const whyLabel=(w: string): string=>WHY_LABELS[w]||(w?String(w).replace(/[-_]/g,' '):'—');

const bodyEl=(): HTMLElement=>$('pause-body')!;
const setTitle=(t: string): void=>{const e=$('pause-title');if(e)e.textContent=t;};

// View hierarchy. INFO and SETTINGS hang off the main menu; the read-only panels
// (leaderboard / transactions / updates / minigames) hang off INFO. MAP is NOT a
// view — it leaves the pause menu and opens the existing full-map overlay.
// 'main' | 'info' | 'leaderboard' | 'transactions' | 'updates' | 'minigames' | 'settings'
let view='main';
// Parent of each sub-view, so BACK / hardware-back walks up exactly one level.
const PARENT: Record<string, string>={
  info:'main', settings:'main',
  leaderboard:'info', transactions:'info', updates:'info', minigames:'info',
};
function goBack(): void { openView(PARENT[view]||'main'); }
function openView(v: string): void {
  switch(v){
    case'info': goInfo(); break;
    case'leaderboard': openLeaderboard(); break;
    case'transactions': openTransactions(); break;
    case'updates': openUpdates(); break;
    case'minigames': openMiniGames(); break;
    case'settings': openSettings(); break;
    default: goMain();
  }
}

// ---- shared chrome ---------------------------------------------------------
const backBtn=(): string=>`<button class="pause-btn pause-back" data-act="back">&#8592; BACK</button>`;
function pager(page: number,pages: number,note: string): string {
  if(pages<=1)return note?`<div class="pause-bar"><span class="pause-note">${note}</span></div>`:'';
  return `<div class="pause-bar">`+
    `<button class="pause-mini" data-act="page" data-dir="-1"${page===0?' disabled':''}>&#8592; PREV</button>`+
    `<span class="pause-note">Page ${page+1}/${pages}${note?' &middot; '+note:''}</span>`+
    `<button class="pause-mini" data-act="page" data-dir="1"${page>=pages-1?' disabled':''}>NEXT &#8594;</button>`+
    `</div>`;
}

// ---- main menu -------------------------------------------------------------
function goMain(): void {
  view='main';
  setTitle('PAUSED');
  bodyEl().innerHTML=
    `<div class="pause-menu">`+
      `<button class="pause-btn pause-btn-go" data-act="resume">RESUME</button>`+
      `<button class="pause-btn" data-act="info">INFO${hasUnseenUpdates()?'<span class="pause-badge">NEW</span>':''}</button>`+
      `<button class="pause-btn" data-act="settings">SETTINGS</button>`+
      `<button class="pause-btn pause-btn-danger" data-act="quit">QUIT TO TITLE</button>`+
    `</div>`;
}

// ---- INFO submenu — the read-only panels (board / wallet / changelog / map / minigames)
function goInfo(): void {
  view='info';
  setTitle('INFO');
  bodyEl().innerHTML=
    `<div class="pause-menu">`+
      `<button class="pause-btn" data-act="leaderboard">LEADERBOARD</button>`+
      `<button class="pause-btn" data-act="transactions">TRANSACTIONS</button>`+
      `<button class="pause-btn" data-act="updates">UPDATES${hasUnseenUpdates()?'<span class="pause-badge">NEW</span>':''}</button>`+
      `<button class="pause-btn" data-act="map">MAP</button>`+
      `<button class="pause-btn" data-act="minigames">MINI GAMES</button>`+
    `</div>`+
    backBtn();
}

// ---- leaderboard (global ranking, paginated) -------------------------------
const LB_PER_PAGE=10;
let lbEntries: LbEntry[]=[],lbTotal=0,lbPage=0,lbReqId=0;

async function openLeaderboard(): Promise<void> {
  view='leaderboard';
  setTitle('LEADERBOARD');
  lbPage=0;
  bodyEl().innerHTML=`<div class="pause-loading">Loading the board&hellip;</div>`+backBtn();
  const req=++lbReqId;
  try{
    const r=await fetch(API+'/api/scores?limit=100');
    const data=(await r.json()) as {entries?: LbEntry[]; total?: number};
    if(req!==lbReqId||view!=='leaderboard')return; // superseded or user left
    lbEntries=data.entries||[];
    lbTotal=Number(data.total)||lbEntries.length;
  }catch(e){
    if(req!==lbReqId||view!=='leaderboard')return;
    lbEntries=[];lbTotal=0;
  }
  renderLeaderboardPage();
}
function renderLeaderboardPage(): void {
  const pages=Math.max(1,Math.ceil(lbEntries.length/LB_PER_PAGE));
  lbPage=Math.min(Math.max(0,lbPage),pages-1);
  const start=lbPage*LB_PER_PAGE;
  const me=getNickname();
  const rows=lbEntries.slice(start,start+LB_PER_PAGE).map(e=>
    `<tr${e.name===me?' class="pause-me"':''}>`+
    `<td class="pause-pos">${e.rank}</td>`+
    `<td class="pause-tname">${escapeHtml(e.name)}</td>`+
    `<td class="num">${fmtCompact(e.money)}</td></tr>`
  ).join('');
  const table=lbEntries.length
    ? `<table class="pause-table"><thead><tr><th>#</th><th>PLAYER</th><th class="num">MONEY</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="pause-empty">Be the first on the board!</div>`;
  const note=lbTotal>0?`${lbTotal.toLocaleString('en-US')} player${lbTotal===1?'':'s'} competing`:'';
  bodyEl().innerHTML=
    `<div class="pause-scroll">${table}</div>`+
    pager(lbPage,pages,note)+
    backBtn();
}

// ---- transactions (player's money ledger, paginated) -----------------------
const TX_PER_PAGE=8;
let txList: { amt: number; why: string; t: number }[]=[],txPage=0;

function openTransactions(): void {
  view='transactions';
  setTitle('TRANSACTIONS');
  txList=economy.history();
  txPage=0;
  renderTransactionsPage();
}
function renderTransactionsPage(): void {
  const s=economy.stats();
  const pages=Math.max(1,Math.ceil(txList.length/TX_PER_PAGE));
  txPage=Math.min(Math.max(0,txPage),pages-1);
  const start=txPage*TX_PER_PAGE;
  const rows=txList.slice(start,start+TX_PER_PAGE).map(tx=>
    `<tr><td class="pause-when">${fmtTime(tx.t)}</td>`+
    `<td class="pause-why">${escapeHtml(whyLabel(tx.why))}</td>`+
    `<td class="num ${tx.amt<0?'pause-neg':'pause-pos'}">${fmtSigned(tx.amt)}</td></tr>`
  ).join('');
  const table=txList.length
    ? `<table class="pause-table"><thead><tr><th>WHEN</th><th>SOURCE</th><th class="num">AMOUNT</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="pause-empty">No transactions yet.</div>`;
  bodyEl().innerHTML=
    `<div class="pause-wallet">`+
      `<div class="pw-cell"><span>BALANCE</span><b>${fmtMoney(s.balance)}</b></div>`+
      `<div class="pw-cell"><span>EARNED</span><b class="pause-pos">${fmtMoney(s.earned)}</b></div>`+
      `<div class="pw-cell"><span>SPENT</span><b class="pause-neg">${fmtMoney(s.spent)}</b></div>`+
    `</div>`+
    `<div class="pause-scroll">${table}</div>`+
    pager(txPage,pages,'recent activity')+
    backBtn();
}

// ---- updates (player-facing changelog, newest-first) -----------------------
function openUpdates(): void {
  view='updates';
  setTitle('UPDATES');
  markUpdatesSeen(); // viewing the panel clears the NEW badge
  renderUpdates();
}
function renderUpdates(): void {
  const items=(UPDATES_LIST||[]).map(u=>
    `<div class="pause-up">`+
      `<div class="pause-up-head">`+
        `<span class="pause-up-date">${escapeHtml(fmtDate(u.date))}</span>`+
        `<span class="pause-up-title">${escapeHtml(u.title)}</span>`+
      `</div>`+
      `<p class="pause-up-desc">${escapeHtml(u.description)}</p>`+
    `</div>`
  ).join('');
  bodyEl().innerHTML=
    `<div class="pause-scroll pause-updates">${items||'<div class="pause-empty">No updates yet.</div>'}</div>`+
    backBtn();
}

// ---- mini games (read-only reference of every mini-game's money / cost / timers) --
// Mirrors /minigame-rewards.json verbatim — the very {field,value,description} triples
// the game tunes from — so the player always has the full payout/cost/timing reference.
interface MgTunable { field: string; value: unknown; description: string }
const MG_DATA=MINIGAME_REWARDS as unknown as Record<string, MgTunable[]>;
// Friendly name + one-line blurb per mini-game (the JSON keys are terse).
const MG_META: Record<string, { name: string; blurb: string }>={
  race:          {name:'Street Race',     blurb:'Place in the street circuit for the purse.'},
  boatRace:      {name:'Boat Race',       blurb:'Race the buoys at sea — dodge the mines.'},
  offroad:       {name:'Off-Road',        blurb:'Dirt-track circuit out on open terrain.'},
  taxi:          {name:'Cab Hustle',      blurb:'Pick up fares; speed earns a bigger tip.'},
  carCrusher:    {name:'Scrap Crusher',   blurb:'Crush a car for scrap (once per in-game day).'},
  vigilante:     {name:'Street Justice',  blurb:'Ram & bust suspects; pay scales with patrol level.'},
  paramedic:     {name:'Ambulance Rush',  blurb:'Rush patients to the hospital before time runs out.'},
  firefighter:   {name:'Fire Brigade',    blurb:'Put out fires fast for a quick-extinguish bonus.'},
  stuntJump:     {name:'Daredevil Jumps', blurb:'Clear ramps for speed cash + first-time bonuses.'},
  hiddenPackages:{name:'Hidden Stashes',  blurb:'Find packages hidden across the map (one-time).'},
  importExport:  {name:'Dock Exports',    blurb:'Deliver a wanted car to the docks (once per day).'},
  rcToyz:        {name:'RC Smash',         blurb:'Wreck cars with the RC for combo multipliers.'},
  weedFarm:      {name:'Green Acres',      blurb:'Grow, cure and deal weed to buyers across the map.'},
  rampage:       {name:'Frenzy',           blurb:'Melee kill-spree against the clock.'},
  rocketRampage: {name:'Rocket Frenzy',    blurb:'Blow up the goal cars with the rocket launcher.'},
  overkill:      {name:'Overkill',         blurb:'Go loud city-wide — a streak multiplier on kill income.'},
  dance:         {name:'Dance Fever',      blurb:'Hit the beats; the crowd tips by your grade.'},
  bombShop:      {name:'Demo Garage',      blurb:'Arm a car bomb (a cost, not income).'},
  drugBust:      {name:'Drug Bust',        blurb:'The crooked-cop shakedown if a weed deal goes wrong.'},
};
// Render any tunable value (number / array / map / array-of-maps) as compact text.
function fmtMgVal(v: unknown): string {
  if(Array.isArray(v))return '['+v.map(fmtMgVal).join(', ')+']';
  if(v&&typeof v==='object')
    return Object.entries(v as Record<string, unknown>).map(([k,val])=>`${k}: ${fmtMgVal(val)}`).join(', ');
  return String(v);
}
function openMiniGames(): void {
  view='minigames';
  setTitle('MINI GAMES');
  renderMiniGames();
}
function renderMiniGames(): void {
  const cards=Object.keys(MG_DATA).map(key=>{
    const meta=MG_META[key]||{name:key,blurb:''};
    const rows=MG_DATA[key].map(t=>
      `<div class="pause-mg-row">`+
        `<div class="pause-mg-kv"><span class="pause-mg-field">${escapeHtml(t.field)}</span>`+
        `<b class="pause-mg-val">${escapeHtml(fmtMgVal(t.value))}</b></div>`+
        `<div class="pause-mg-desc">${escapeHtml(t.description)}</div>`+
      `</div>`
    ).join('');
    return `<div class="pause-mg-card">`+
      `<div class="pause-mg-name">${escapeHtml(meta.name)}</div>`+
      (meta.blurb?`<p class="pause-mg-blurb">${escapeHtml(meta.blurb)}</p>`:'')+
      rows+
    `</div>`;
  }).join('');
  bodyEl().innerHTML=
    `<div class="pause-scroll pause-mg-scroll"><div class="pause-mg-grid">${cards}</div></div>`+
    backBtn();
}

// ---- settings (graphics + audio) -------------------------------------------
const SCHEMA: { group: string; items: SettingItem[] }[]=[
  {group:'GAMEPLAY',items:[
    {key:'aimAssist',type:'toggle',label:'Aim assist'},
  ]},
  {group:'AUDIO',items:[
    {key:'master',type:'range',label:'Master volume',min:0,max:100,step:1,suffix:'%'},
    {key:'music', type:'range',label:'Music volume', min:0,max:100,step:1,suffix:'%'},
    {key:'muted', type:'toggle',label:'Mute all'},
  ]},
  {group:'GRAPHICS',items:[
    {key:'shadows',   type:'toggle',label:'Shadows'},
    {key:'brightness',type:'range', label:'Brightness',min:50,max:150,step:5,suffix:'%'},
    {key:'fps',       type:'toggle',label:'Show FPS'},
    {key:'filmGrain', type:'toggle',label:'Film grain'},
  ]},
];
const findItem=(key: string): SettingItem | null=>{for(const g of SCHEMA)for(const it of g.items)if(it.key===key)return it;return null;};

function settingRow(it: SettingItem): string {
  const v=(settings as unknown as Record<string, number | boolean>)[it.key];
  if(it.type==='toggle')
    return `<div class="pause-row"><span>${it.label}</span>`+
      `<button class="pause-switch${v?' on':''}" data-set="${it.key}" data-type="toggle" `+
      `role="switch" aria-checked="${!!v}"><span class="ps-knob"></span></button></div>`;
  return `<div class="pause-row"><span>${it.label}</span>`+
    `<span class="pause-range-wrap">`+
      `<input class="pause-range" type="range" min="${it.min}" max="${it.max}" step="${it.step}" `+
      `value="${v}" data-set="${it.key}" data-type="range" aria-label="${it.label}">`+
      `<b class="pause-range-val" data-val="${it.key}">${v}${it.suffix||''}</b>`+
    `</span></div>`;
}
function openSettings(): void {
  view='settings';
  setTitle('SETTINGS');
  renderSettings();
}
function renderSettings(): void {
  const groups=SCHEMA.map(g=>
    `<div class="pause-set-group"><div class="pause-set-title">${g.group}</div>`+
    g.items.map(settingRow).join('')+`</div>`
  ).join('');
  // Fullscreen is an action (not a persisted setting), so it gets its own DISPLAY row.
  const display=
    `<div class="pause-set-group"><div class="pause-set-title">DISPLAY</div>`+
      `<div class="pause-row"><span>Fullscreen</span>`+
      `<button class="pause-mini" data-act="fullscreen">TOGGLE</button></div>`+
    `</div>`;
  bodyEl().innerHTML=
    `<div class="pause-scroll pause-settings">${display}${groups}</div>`+
    `<div class="pause-bar"><button class="pause-mini" data-act="reset">RESET DEFAULTS</button></div>`+
    backBtn();
}

// ---- delegated input -------------------------------------------------------
function changePage(dir: number): void {
  if(view==='leaderboard'){lbPage+=dir;renderLeaderboardPage();}
  else if(view==='transactions'){txPage+=dir;renderTransactionsPage();}
}
function onBodyClick(e: MouseEvent): void {
  // settings toggle (a <button> switch)
  const sw=(e.target as Element).closest('[data-set][data-type="toggle"]') as HTMLElement | null;
  if(sw){
    e.stopPropagation();
    const key=sw.dataset.set!,nv=!(settings as unknown as Record<string, number | boolean>)[key];
    setSetting(key,nv);
    sw.classList.toggle('on',nv);
    sw.setAttribute('aria-checked',String(nv));
    return;
  }
  const el=(e.target as Element).closest('[data-act]') as HTMLElement | null;
  if(!el)return;
  e.stopPropagation();
  switch(el.dataset.act){
    case'resume': refs.togglePause?.(); break;       // input.js owns the pause state
    case'info': goInfo(); break;
    case'leaderboard': openLeaderboard(); break;
    case'transactions': openTransactions(); break;
    case'updates': openUpdates(); break;
    case'minigames': openMiniGames(); break;
    case'map':                                        // leave the pause, open the full-map overlay
      refs.togglePause?.();                           // resume first (clears state.paused + closes this menu)
      refs.openFullMap?.();                           // then open the existing fullscreen map
      break;
    case'settings': openSettings(); break;
    case'fullscreen': refs.toggleFullscreen?.(); break;
    case'quit':
      if(confirm('Quit to the title screen? Your progress is saved.')){try{flush();}catch(_){}location.reload();}
      break;
    case'back': goBack(); break;
    case'page': changePage(parseInt(el.dataset.dir!,10)||0); break;
    case'reset': resetSettings(); renderSettings(); break;
  }
}
// Live slider drag: apply immediately and update the readout.
function onBodyInput(e: Event): void {
  const r=(e.target as Element).closest('[data-set][data-type="range"]') as HTMLInputElement | null;
  if(!r)return;
  const key=r.dataset.set!,val=parseInt(r.value,10);
  setSetting(key,val);
  const out=bodyEl().querySelector(`[data-val="${key}"]`);
  if(out){const it=findItem(key);out.textContent=val+(it&&it.suffix||'');}
}

// ---- public API ------------------------------------------------------------
export function setupPauseMenu(): void {
  const body=bodyEl();
  if(!body)return;
  body.addEventListener('click',onBodyClick);
  body.addEventListener('input',onBodyInput);
}
export function openPauseMenu(): void {
  document.exitPointerLock?.(); // desktop: free the cursor so the menu is clickable
  goMain();
  const ov=$('pauseov');if(ov)ov.style.display='flex';
  document.body.classList.add('paused');
}
export function closePauseMenu(): void {
  const ov=$('pauseov');if(ov)ov.style.display='none';
  document.body.classList.remove('paused');
  view='main';
}
// Mobile/hardware back: from a sub-panel, return to the main menu (handled=true);
// at the main menu, report not-handled so the caller unpauses instead.
export function pauseBack(): boolean {
  if(view!=='main'){goBack();return true;}
  return false;
}
