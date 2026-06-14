// Harness de medição de performance — TEMPLATE.
// Abre o jogo no Chrome REAL com vsync/limite de FPS DESLIGADOS (pra medir
// throughput acima de 60), joga no mundo aberto e coleta window.profilerReport()
// (precisa do profiler.js embutido + ?prof na URL).
//
// Uso:  node measure.mjs <port> [dpr] [vsync]
//   port  : porta do `npm run dev` (ex.: 5173)
//   dpr   : deviceScaleFactor (1 padrão; teste 2 pra simular HiDPI/4K)
//   vsync : passe a string 'vsync' pra simular o usuário real (vsync ON, cap no refresh)
//
// IMPORTANTE: só rode isto quando o usuário PEDIR explicitamente pra rodar o jogo
// (instrução padrão do repo: nada de automação de browser sem pedido explícito).
// Requer Playwright instalado (global ou local) e Chrome no sistema.
import {createRequire} from 'module';
const require=createRequire(import.meta.url);
let chromium;
for(const p of [
  'playwright','playwright-core',
  'C:/Users/'+(process.env.USERNAME||'')+'/AppData/Roaming/npm/node_modules/playwright',
  'C:/Users/'+(process.env.USERNAME||'')+'/AppData/Roaming/npm/node_modules/playwright-core']){
  try{chromium=require(p).chromium;break;}catch(e){}
}
if(!chromium){console.error('playwright não encontrado (instale com: npm i -D playwright)');process.exit(2);}

const PORT=process.argv[2]||'5173';
const DPR=parseFloat(process.argv[3]||'1');
const NOVSYNC=process.argv[4]!=='vsync';
const URL=`http://localhost:${PORT}/?prof`;
const args=['--disable-background-timer-throttling','--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows','--ignore-gpu-blocklist'];
if(NOVSYNC)args.unshift('--disable-gpu-vsync','--disable-frame-rate-limit');
console.log('### vsync',NOVSYNC?'OFF (throughput)':'ON (usuário real)','| dpr',DPR);

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errors=[];let browser;
try{
  browser=await chromium.launch({channel:'chrome',headless:false,args});
  const ctx=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:DPR});
  const page=await ctx.newPage();
  page.on('console',m=>{const t=m.type();if(t==='error'||t==='warning')errors.push(`[${t}] ${m.text()}`);});
  page.on('pageerror',e=>errors.push(`[pageerror] ${e.message}`));

  await page.goto(URL,{waitUntil:'load',timeout:20000});
  // --- AJUSTE pro seu jogo: como sair da tela de título e começar a jogar ---
  // (este projeto: botão #play → modal de nick → #nick-play). O botão pulsa, então
  // clico via evaluate (Playwright vê o elemento animado como "instável").
  await page.waitForSelector('#play',{timeout:15000});
  await sleep(1300); // deixa o título rodar (controlador de resolução mede aqui)
  await page.evaluate(()=>document.getElementById('play').click());
  await page.waitForSelector('#nick-input',{state:'visible',timeout:8000});
  await page.evaluate(()=>{document.getElementById('nick-input').value='PERF';});
  await page.evaluate(()=>document.getElementById('nick-play').click());
  await page.waitForFunction(
    ()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).started===true,
    {timeout:12000});

  await sleep(2500); // warm-up parado (médias estáveis)
  const samples=[];
  const grab=async tag=>{const r=await page.evaluate(()=>window.profilerReport?.());
    if(r){const o=JSON.parse(r);o._tag=tag;samples.push(o);}};
  await grab('idle');

  // corre pela cidade (Shift+W) com curvas, amostrando
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyW');
  const turns=['KeyA',null,'KeyD',null,'KeyA',null];
  for(let i=0;i<turns.length;i++){
    const k=turns[i];
    if(k)await page.keyboard.down(k);
    await sleep(1100);
    if(k)await page.keyboard.up(k);
    await grab('run'+i);
  }
  await page.keyboard.up('KeyW');await page.keyboard.up('ShiftLeft');

  console.log('=== PROFILER SAMPLES ===');
  console.log(JSON.stringify(samples,null,1));
  console.log('=== CONSOLE ERRORS/WARNINGS ===');
  console.log(errors.slice(0,40).join('\n')||'(none)');
}catch(e){
  console.error('RUN ERROR:',e.message);
  console.error('console:',errors.slice(0,20).join('\n'));
  process.exitCode=1;
}finally{ if(browser)await browser.close(); }
