// In-game PAUSE MENU — a proper game menu (P / Esc on desktop, the II button on
// touch). Top level: RESUME, INFO, SETTINGS, QUIT. INFO groups the read-only panels
// (transactions, updates, the full MAP, and a MINI GAMES reference that
// lists every mini-game's payouts/costs/timers straight from minigame-rewards.json).
// SETTINGS holds graphics/audio plus the fullscreen toggle.
//
// Self-contained: it owns every node under #pauseov and wires its own listeners
// (one delegated set, in setupPauseMenu). It must NOT import input.js (which imports
// this) — resume / fullscreen / the full map go through late-bound refs
// (refs.togglePause / refs.toggleFullscreen / refs.openFullMap) to keep the
// dependency one-directional.
import {refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {saveNow} from '@/core/save.ts';
import {settings,setSetting,resetSettings} from '@/core/settings.ts';
import {getNpcRoster,kindLabel,type NpcRosterEntry} from '@/actors/npc.ts';
import UPDATES from '../../data/updates.json';
import MINIGAME_REWARDS from '../../data/minigame-rewards.json';

// A changelog entry shape (data/updates.json, newest-first).
interface Update { id: string; date: string; title: string; description: string; }
// One settings control descriptor (the SCHEMA below).
interface SettingItem { key: string; type: 'range' | 'toggle'; label: string; min?: number; max?: number; step?: number; suffix?: string; }

const $=(id: string): HTMLElement | null=>document.getElementById(id);
const escapeHtml=(s: unknown): string=>String(s).replace(/[&<>"']/g,
  c=>(({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string, string>)[c]));

const fmtMoney=(n: unknown): string=>'R$'+Math.abs(Math.floor(Number(n)||0)).toLocaleString('pt-BR');
const fmtSigned=(n: unknown): string=>(Number(n)<0?'-':'+')+fmtMoney(n);
const fmtTime=(t: unknown): string=>{try{return new Date(Number(t)).toLocaleString('pt-BR');}catch(e){return '';}};
const fmtDate=(d: string): string=>{try{return new Date(d+'T00:00:00').toLocaleDateString('pt-BR',{year:'numeric',month:'short',day:'numeric'});}catch(e){return String(d);}};

// ---- updates / changelog (driven by data/updates.json, newest-first) ----
// The newest entry's id is what we remember as "seen": when it differs from the
// stored value, the menu shows a NEW badge until the player opens the panel.
const UPDATES_SEEN_KEY='divinocity_updates_seen';
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
  start:'Dinheiro inicial', earn:'Receita', spend:'Compra', penalty:'Multa', fold:'Ajuste',
  taxi:'Corrida de táxi', race:'Racha de rua', 'boat-race':'Corrida de lanchas', offroad:'Corrida off-road',
  dance:'Gorjeta da dança', rampage:'Fúria', 'rocket-rampage':'Fúria de bazuca', overkill:'Overkill',
  paramedic:'Plantão de ambulância', firefighter:'Bombeiro', vigilante:'Justiça nas ruas',
  'car-crusher':'Ferro-velho', 'import-export':'Exportação de carro', 'weed-farm':'Venda de erva', 'weed-deal':'Entrega de erva',
  delivery:'Entrega', 'cash-drop':'Dinheiro achado', loot:'Saque', 'rc-toyz':'Carrinho RC',
  'hidden-package':'Pacote escondido', 'hidden-package-all':'Bônus de todos os pacotes',
  'hidden-package-bonus':'Bônus de pacote', 'stunt-jump':'Salto acrobático',
  'stunt-jump-repeat':'Salto acrobático', story:'Recompensa de missão', rick:'Missão secundária',
  property:'Compra da casa', 'mod-shop':'Tunagem', 'bomb-shop':'Carro-bomba',
  weapon:'Arma', ammo:'Munição', busted:'Preso', wasted:'Conta do hospital',
  seeds:'Sementes',
};
const whyLabel=(w: string): string=>WHY_LABELS[w]||(w?String(w).replace(/[-_]/g,' '):'—');

const bodyEl=(): HTMLElement=>$('pause-body')!;
const setTitle=(t: string): void=>{const e=$('pause-title');if(e)e.textContent=t;};

// View hierarchy. INFO and SETTINGS hang off the main menu; the read-only panels
// (transactions / updates / minigames / npcs) hang off INFO. MAP is NOT a
// view — it leaves the pause menu and opens the existing full-map overlay.
// 'main' | 'info' | 'transactions' | 'updates' | 'minigames' | 'npcs' | 'settings'
let view='main';
// Parent of each sub-view, so BACK / hardware-back walks up exactly one level.
const PARENT: Record<string, string>={
  info:'main', settings:'main',
  transactions:'info', updates:'info', minigames:'info', npcs:'info',
};
function goBack(): void { openView(PARENT[view]||'main'); }
function openView(v: string): void {
  switch(v){
    case'info': goInfo(); break;
    case'transactions': openTransactions(); break;
    case'updates': openUpdates(); break;
    case'minigames': openMiniGames(); break;
    case'npcs': openNpcs(); break;
    case'settings': openSettings(); break;
    default: goMain();
  }
}

// ---- shared chrome ---------------------------------------------------------
const backBtn=(): string=>`<button class="pause-btn pause-back" data-act="back">&#8592; VOLTAR</button>`;
function pager(page: number,pages: number,note: string): string {
  if(pages<=1)return note?`<div class="pause-bar"><span class="pause-note">${note}</span></div>`:'';
  return `<div class="pause-bar">`+
    `<button class="pause-mini" data-act="page" data-dir="-1"${page===0?' disabled':''}>&#8592; ANTERIOR</button>`+
    `<span class="pause-note">Página ${page+1}/${pages}${note?' &middot; '+note:''}</span>`+
    `<button class="pause-mini" data-act="page" data-dir="1"${page>=pages-1?' disabled':''}>PRÓXIMA &#8594;</button>`+
    `</div>`;
}

// ---- main menu -------------------------------------------------------------
function goMain(): void {
  view='main';
  setTitle('PAUSADO');
  bodyEl().innerHTML=
    `<div class="pause-menu">`+
      `<button class="pause-btn pause-btn-go" data-act="resume">CONTINUAR</button>`+
      `<button class="pause-btn" data-act="info">INFO${hasUnseenUpdates()?'<span class="pause-badge">NOVO</span>':''}</button>`+
      `<button class="pause-btn" data-act="settings">CONFIGURAÇÕES</button>`+
      `<button class="pause-btn pause-btn-danger" data-act="quit">SAIR PARA O MENU</button>`+
    `</div>`;
}

// ---- INFO submenu — the read-only panels (wallet / changelog / map / minigames / npcs)
function goInfo(): void {
  view='info';
  setTitle('INFO');
  bodyEl().innerHTML=
    `<div class="pause-menu">`+
      `<button class="pause-btn" data-act="transactions">EXTRATO</button>`+
      `<button class="pause-btn" data-act="updates">NOVIDADES${hasUnseenUpdates()?'<span class="pause-badge">NOVO</span>':''}</button>`+
      `<button class="pause-btn" data-act="map">MAPA</button>`+
      `<button class="pause-btn" data-act="minigames">MINIGAMES</button>`+
      `<button class="pause-btn" data-act="npcs">MORADORES</button>`+
    `</div>`+
    backBtn();
}

// ---- NPCs (full roster of the town's population, paginated + filterable) ----
// Lists EVERY NPC in the game with its identity and live status: name, sex, type,
// the district it lives in and what it's doing right now. Two filter rows narrow the
// list by AREA and by current STATUS (e.g. show only everyone in the "Down" state).
// The world is frozen while the pause menu is open, so the snapshot stays accurate.
const NPC_PER_PAGE=12;
let npcList: NpcRosterEntry[]=[],npcPage=0;
let npcFilterArea='Todos',npcFilterState='Todos',npcFiltersOpen=false;
function openNpcs(): void {
  view='npcs';
  setTitle('MORADORES');
  npcList=getNpcRoster();
  npcFilterArea='Todos';npcFilterState='Todos';npcFiltersOpen=false; // start collapsed: the chip rows are tall
  npcPage=0;
  renderNpcsPage();
}
// Distinct values for a roster field, sorted, with an "All" option at the front.
function npcFilterValues(key:'area'|'state'): string[] {
  const set=new Set<string>();
  for(const n of npcList)set.add(n[key]);
  return ['Todos',...Array.from(set).sort((a,b)=>a.localeCompare(b))];
}
// A row of filter chips for one dimension; the active value is highlighted.
function npcFilterRow(label:string,dim:'area'|'state',active:string): string {
  const chips=npcFilterValues(dim).map(v=>
    `<button class="pause-chip${v===active?' on':''}" data-act="npcfilter" data-dim="${dim}" `+
    `data-val="${escapeHtml(v)}">${escapeHtml(v)}</button>`).join('');
  return `<div class="pause-filter"><span class="pause-filter-label">${label}</span>`+
    `<div class="pause-chips">${chips}</div></div>`;
}
// Collapsible filter panel: a SHOW/HIDE toggle plus (only when open) the two chip rows.
// Collapsed by default so the long lists of areas/statuses don't dominate the modal; when
// collapsed with a filter active, the active values are summarised next to the button so
// the player still sees that the list is being narrowed.
function npcFilterSection(): string {
  const active: string[]=[];
  if(npcFilterArea!=='Todos')active.push(npcFilterArea);
  if(npcFilterState!=='Todos')active.push(npcFilterState);
  const toggle=`<button class="pause-mini npc-filter-toggle${active.length?' on':''}" `+
    `data-act="npcfilttoggle" aria-expanded="${npcFiltersOpen}">`+
    `${npcFiltersOpen?'OCULTAR FILTROS':'MOSTRAR FILTROS'}</button>`;
  const summary=(!npcFiltersOpen&&active.length)
    ? `<span class="npc-filter-active">${active.map(escapeHtml).join(' · ')}</span>` : '';
  const rows=npcFiltersOpen
    ? npcFilterRow('ÁREA','area',npcFilterArea)+npcFilterRow('SITUAÇÃO','state',npcFilterState) : '';
  return `<div class="pause-filter-bar">${toggle}${summary}</div>${rows}`;
}
function renderNpcsPage(): void {
  const filtered=npcList.filter(n=>
    (npcFilterArea==='Todos'||n.area===npcFilterArea)&&
    (npcFilterState==='Todos'||n.state===npcFilterState));
  const pages=Math.max(1,Math.ceil(filtered.length/NPC_PER_PAGE));
  npcPage=Math.min(Math.max(0,npcPage),pages-1);
  const start=npcPage*NPC_PER_PAGE;
  const rows=filtered.slice(start,start+NPC_PER_PAGE).map(n=>
    `<tr>`+
      `<td class="pause-tname">${escapeHtml(n.name)}</td>`+
      `<td class="pause-npc-sex">${n.gender==='F'?'&#9792;':'&#9794;'}</td>`+
      `<td>${escapeHtml(kindLabel(n.kind))}</td>`+
      `<td>${escapeHtml(n.area)}</td>`+
      `<td>${escapeHtml(n.state)}</td>`+
    `</tr>`
  ).join('');
  const table=filtered.length
    ? `<table class="pause-table pause-npc-table"><thead><tr>`+
        `<th>NOME</th><th>SEXO</th><th>TIPO</th><th>ÁREA</th><th>SITUAÇÃO</th>`+
      `</tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="pause-empty">Nenhum morador com esses filtros.</div>`;
  const filters=npcFilterSection();
  const note=`${filtered.length} de ${npcList.length} morador${npcList.length===1?'':'es'}`;
  bodyEl().innerHTML=
    filters+
    `<div class="pause-scroll">${table}</div>`+
    pager(npcPage,pages,note)+
    backBtn();
}

// ---- transactions (player's money ledger, paginated) -----------------------
const TX_PER_PAGE=8;
let txList: { amt: number; why: string; t: number }[]=[],txPage=0;

function openTransactions(): void {
  view='transactions';
  setTitle('EXTRATO');
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
    ? `<table class="pause-table"><thead><tr><th>QUANDO</th><th>ORIGEM</th><th class="num">VALOR</th></tr></thead><tbody>${rows}</tbody></table>`
    : `<div class="pause-empty">Nenhuma movimentação ainda.</div>`;
  bodyEl().innerHTML=
    `<div class="pause-wallet">`+
      `<div class="pw-cell"><span>SALDO</span><b>${fmtMoney(s.balance)}</b></div>`+
      `<div class="pw-cell"><span>GANHO</span><b class="pause-pos">${fmtMoney(s.earned)}</b></div>`+
      `<div class="pw-cell"><span>GASTO</span><b class="pause-neg">${fmtMoney(s.spent)}</b></div>`+
    `</div>`+
    `<div class="pause-scroll">${table}</div>`+
    pager(txPage,pages,'recent activity')+
    backBtn();
}

// ---- updates (player-facing changelog, newest-first) -----------------------
function openUpdates(): void {
  view='updates';
  setTitle('NOVIDADES');
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
    `<div class="pause-scroll pause-updates">${items||'<div class="pause-empty">Nenhuma novidade ainda.</div>'}</div>`+
    backBtn();
}

// ---- mini games (read-only reference of every mini-game's money / cost / timers) --
// Mirrors /src/data/minigame-rewards.json verbatim — the very {field,value,description} triples
// the game tunes from — so the player always has the full payout/cost/timing reference.
interface MgTunable { field: string; value: unknown; description: string }
const MG_DATA=MINIGAME_REWARDS as unknown as Record<string, MgTunable[]>;
// Friendly name + one-line blurb per mini-game (the JSON keys are terse).
const MG_META: Record<string, { name: string; blurb: string }>={
  race:          {name:'Racha de Rua',     blurb:'Termine bem colocado no circuito de rua e leve o prêmio.'},
  boatRace:      {name:'Corrida de Lanchas', blurb:'Desça o Rio do Peixe passando pelas boias — desvie das minas.'},
  offroad:       {name:'Off-Road',        blurb:'Circuito de terra em campo aberto.'},
  taxi:          {name:'Corre de Táxi',   blurb:'Pegue passageiros; quanto mais rápido, maior a gorjeta.'},
  carCrusher:    {name:'Ferro-Velho',     blurb:'Prense um carro como sucata (uma vez por dia do jogo).'},
  vigilante:     {name:'Justiça nas Ruas', blurb:'Bata nos suspeitos e prenda; o pagamento sobe com o nível da patrulha.'},
  paramedic:     {name:'Plantão de Ambulância', blurb:'Leve os pacientes ao hospital antes que o tempo acabe.'},
  firefighter:   {name:'Bombeiros',       blurb:'Apague os incêndios rápido para ganhar bônus.'},
  stuntJump:     {name:'Saltos Radicais', blurb:'Salte as rampas: dinheiro pela velocidade + bônus na primeira vez.'},
  hiddenPackages:{name:'Pacotes Escondidos', blurb:'Ache os pacotes escondidos pelo mapa (uma vez só).'},
  importExport:  {name:'Exportação',      blurb:'Entregue o carro encomendado na exportação (uma vez por dia).'},
  rcToyz:        {name:'Destruição RC',    blurb:'Detone carros com o carrinho RC e faça combos.'},
  weedFarm:      {name:'Plantação',        blurb:'Plante, seque e venda erva para os compradores da cidade.'},
  rampage:       {name:'Fúria',            blurb:'Matança no braço contra o relógio.'},
  rocketRampage: {name:'Fúria de Bazuca',  blurb:'Exploda os carros da meta com a bazuca.'},
  overkill:      {name:'Overkill',         blurb:'Barulho na cidade toda — multiplicador de sequência no que você ganha por abate.'},
  dance:         {name:'Febre da Dança',   blurb:'Acerte as batidas; a galera dá gorjeta conforme sua nota.'},
  bombShop:      {name:'Oficina de Bombas', blurb:'Instale uma bomba no carro (é um custo, não uma renda).'},
  drugBust:      {name:'Batida Policial',  blurb:'O achaque do policial corrupto quando a venda de erva dá errado.'},
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
  setTitle('MINIGAMES');
  renderMiniGames();
}
function renderMiniGames(): void {
  const cards=Object.keys(MG_DATA).map(key=>{
    const meta=MG_META[key]||{name:key,blurb:''};
    const rows=MG_DATA[key].map(t=>
      `<div class="pause-mg-row">`+
        // the description is the label; the JSON field name is a code identifier, not shown
        `<div class="pause-mg-kv"><span class="pause-mg-field">${escapeHtml(t.description)}</span>`+
        `<b class="pause-mg-val">${escapeHtml(fmtMgVal(t.value))}</b></div>`+
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
  {group:'JOGABILIDADE',items:[
    {key:'aimAssist',type:'toggle',label:'Mira assistida'},
  ]},
  {group:'ÁUDIO',items:[
    {key:'master',type:'range',label:'Volume geral',min:0,max:100,step:1,suffix:'%'},
    {key:'music', type:'range',label:'Volume da música', min:0,max:100,step:1,suffix:'%'},
    {key:'muted', type:'toggle',label:'Silenciar tudo'},
  ]},
  {group:'GRÁFICOS',items:[
    {key:'shadows',   type:'toggle',label:'Sombras'},
    {key:'bloom',     type:'toggle',label:'Bloom (brilho)'},
    {key:'brightness',type:'range', label:'Brilho',min:50,max:150,step:5,suffix:'%'},
    {key:'fps',       type:'toggle',label:'Mostrar FPS'},
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
  setTitle('CONFIGURAÇÕES');
  renderSettings();
}
function renderSettings(): void {
  const groups=SCHEMA.map(g=>
    `<div class="pause-set-group"><div class="pause-set-title">${g.group}</div>`+
    g.items.map(settingRow).join('')+`</div>`
  ).join('');
  // Fullscreen is an action (not a persisted setting), so it gets its own DISPLAY row.
  const display=
    `<div class="pause-set-group"><div class="pause-set-title">TELA</div>`+
      `<div class="pause-row"><span>Tela cheia</span>`+
      `<button class="pause-mini" data-act="fullscreen">ALTERNAR</button></div>`+
    `</div>`;
  bodyEl().innerHTML=
    `<div class="pause-scroll pause-settings">${display}${groups}</div>`+
    `<div class="pause-bar"><button class="pause-mini" data-act="reset">RESTAURAR PADRÃO</button></div>`+
    backBtn();
}

// ---- delegated input -------------------------------------------------------
function changePage(dir: number): void {
  if(view==='transactions'){txPage+=dir;renderTransactionsPage();}
  else if(view==='npcs'){npcPage+=dir;renderNpcsPage();}
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
    case'transactions': openTransactions(); break;
    case'updates': openUpdates(); break;
    case'minigames': openMiniGames(); break;
    case'npcs': openNpcs(); break;
    case'npcfilter':{                                 // narrow the roster by area / status
      const dim=el.dataset.dim;
      const val=el.dataset.val||'Todos';
      if(dim==='area')npcFilterArea=val;else if(dim==='state')npcFilterState=val;
      npcPage=0;renderNpcsPage();
      break;
    }
    case'npcfilttoggle': npcFiltersOpen=!npcFiltersOpen; renderNpcsPage(); break; // show/hide the filter chips

    case'map':                                        // leave the pause, open the full-map overlay
      refs.togglePause?.();                           // resume first (clears state.paused + closes this menu)
      refs.openFullMap?.();                           // then open the existing fullscreen map
      break;
    case'settings': openSettings(); break;
    case'fullscreen': refs.toggleFullscreen?.(); break;
    case'quit':
      if(confirm('Sair para o menu inicial? Seu progresso está salvo.')){saveNow();location.reload();}
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
