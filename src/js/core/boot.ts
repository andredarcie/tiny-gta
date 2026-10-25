// Bootstrap / loader. The title/menu is static HTML/CSS in index.html, on screen the instant
// the page is parsed, with a loading card under the PLAY button that says what is happening
// and how far it got (the player asked for it: pressing PLAY while the game was still
// loading did nothing visible). Three phases:
//   1. download (0–70 %): the game's script files, fetched here with their bytes counted
//      (the production build lists them with their sizes in window.__GAME_FILES — see the
//      gameFiles plugin in vite.config.ts); the import below then finds them in the cache;
//   2. the town build (70–92 %): importing js/core/main.ts builds the whole world in one go
//      and holds the main thread for a few seconds — the bar's shine is a CSS transform
//      animation, so it keeps moving the whole time;
//   3. the graphics (92–100 %): the GPU warmup (js/core/warmup.ts) compiles the shaders in
//      the background and fires 'tg:graphics-ready' when the game can draw.
// Then 'tg:ready': PLAY pressed before it was remembered (the button says so) and input.ts
// starts the run now.

// Saved data under the game's former storage keys moves to the current ones before any
// module reads its key (storage-migrate.ts).
import '@/core/storage-migrate.ts';

// UI fonts, bundled with the game (no font CDN — the game must run fully offline).
// Only the latin subsets/weights the CSS actually uses.
// The interior-paulista look: Alfa Slab One = the hand-painted shop lettering (letreiro);
// Barlow Condensed = the road and street signs (placas); Yellowtail = painted script.
import '@fontsource/alfa-slab-one/latin-400.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/yellowtail/latin-400.css';

type BootWindow={__playQueued?: boolean;__tgReady?: boolean;__tgGraphicsReady?: boolean;__GAME_FILES?: [string,number][]};
const W=window as unknown as BootWindow;
const $=(id: string): HTMLElement|null=>document.getElementById(id);
const play=$('play'),box=$('loading');
const label=box?.querySelector<HTMLElement>('.ld-label'),pct=box?.querySelector<HTMLElement>('.ld-pct'),hint=box?.querySelector<HTMLElement>('.ld-hint');

let shown=0,failed=false;
function progress(p: number,text?: string): void{
  shown=Math.max(shown,Math.min(100,p));
  const v=Math.round(shown);
  box?.style.setProperty('--p',String(shown/100));
  box?.setAttribute('aria-valuenow',String(v));
  if(pct)pct.textContent=`${v}%`;
  if(text&&label)label.textContent=text;
  if(play?.classList.contains('is-loading'))play.textContent=`CARREGANDO ${v}%`;
}

// PLAY (or, on a phone, a tap anywhere on the title) before the game is ready: remember it
// and say so — input.ts starts the run on 'tg:ready'
function queuePlay(): void{
  if(W.__tgReady||failed)return;
  W.__playQueued=true;
  play?.classList.add('is-queued');
  if(hint)hint.textContent='Pode soltar: o jogo começa sozinho assim que terminar de carregar.';
}
play?.addEventListener('click',()=>{ if(failed)location.reload();else queuePlay(); });
$('title')?.addEventListener('pointerdown',e=>{ if(!(e.target as Element).closest('#play')&&matchMedia('(pointer: coarse)').matches)queuePlay(); });

// 1. download the game's files counting their bytes (they land in the HTTP cache)
async function download(files: [string,number][]): Promise<void>{
  const total=files.reduce((s,[,n])=>s+n,0)||1;
  let got=0;
  const tick=(): void=>progress(got/total*70,'Baixando o jogo…');
  tick();
  await Promise.all(files.map(async([url])=>{
    const r=await fetch(new URL(url,document.baseURI).href);
    if(!r.ok)throw new Error(`${url}: HTTP ${r.status}`);
    if(!r.body){got+=(await r.arrayBuffer()).byteLength;tick();return;}
    const reader=r.body.getReader();
    for(;;){const{done,value}=await reader.read();if(done)break;got+=value.byteLength;tick();}
  }));
}

const frames=(n: number): Promise<void>=>new Promise(res=>{const f=(): void=>{if(--n<=0)res();else requestAnimationFrame(f);};requestAnimationFrame(f);});

function ready(): void{
  progress(100,'Pronto!');
  if(play){play.classList.remove('is-loading','is-queued');play.textContent=play.dataset.readyText||'JOGAR';}
  if(hint)hint.textContent='';
  setTimeout(()=>box?.classList.add('done'),700);
  W.__tgReady=true;
  dispatchEvent(new Event('tg:ready'));
}

function fail(err: unknown): void{
  failed=true;
  console.error('[boot] the game failed to load',err);
  box?.classList.add('error');
  if(label)label.textContent='Não foi possível carregar o jogo.';
  if(hint)hint.textContent='Confira a internet e toque no botão para tentar de novo.';
  if(play){play.classList.remove('is-queued');play.textContent='TENTAR DE NOVO';}
}

async function boot(): Promise<void>{
  // two frames: the title (and the card at 0 %) is painted before any work starts
  await frames(2);
  const files=W.__GAME_FILES;
  if(files?.length)await download(files);
  // 2. the town build: say it, let it paint, then import (main.ts builds the world)
  progress(70,files?.length?'Construindo a cidade…':'Carregando e construindo a cidade…');
  await frames(2);
  const graphicsReady=new Promise<void>(res=>{
    if(W.__tgGraphicsReady)res();
    else addEventListener('tg:graphics-ready',()=>res(),{once:true});
  });
  performance.mark('tg:import-start');
  await import('./main.ts');
  // 3. the graphics: the bar creeps on meanwhile so it never looks stuck
  progress(92,'Preparando os gráficos…');
  const creep=setInterval(()=>progress(Math.min(99,shown+1)),250);
  await graphicsReady;
  clearInterval(creep);
  ready();
}
boot().catch(fail);
