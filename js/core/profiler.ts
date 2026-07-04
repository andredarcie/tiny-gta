// Profiler de performance embutido no jogo. Mede o custo de CPU de cada sistema
// por frame, FPS (com mínimo na janela), tempo de frame (médio/pico) e os
// contadores do renderer (draw calls, triângulos, geometrias, texturas, shaders).
//
// Liga/desliga com a tecla ` (backquote) ou ?prof na URL. Quando DESLIGADO,
// begin()/end() são quase no-op (um teste booleano e return), então não custa
// nada deixar a instrumentação no loop em produção.
//
// Hooks de debug em window: window.profilerToggle(), window.profilerReport()
// (snapshot JSON — útil pra colar num relatório de performance).
import {renderer,getRenderScale} from '@/core/engine.ts';

let on=new URLSearchParams(location.search).has('prof');

// Acumulador do frame atual (name -> ms) e média exponencial estável (name -> ms)
const acc=new Map<string,number>();
const ema=new Map<string,number>();
const peak=new Map<string,number>(); // pior ms já visto por sistema (não decai — pega o spike único)

// ---- Caça a HITCHES (quedas bruscas de FPS) ----
// Registra todo frame longo com: o sistema mais caro DAQUELE frame e os saltos
// de programs/geo/tex/draws. Salto de `programs` = compile de shader na 1ª vez
// que um efeito/modelo aparece — causa clássica de "FPS cai do nada". Salto de
// geo/tex = upload de geometria/textura. Sem saltos + sistema variado = GC.
const hitches:Array<Record<string,unknown>>=[];
const HITCH_MS=24; // frame acima disso (~<42fps instantâneo) conta como hitch
let _pProg=0,_pGeo=0,_pTex=0,_pCalls=0;
// Contexto opcional (ex.: posição/modo do jogador) anexado a cada hitch — só é
// chamado quando um hitch é registrado, então não custa nada no frame normal.
let ctxFn:(()=>unknown)|null=null;
export function setContext(fn:()=>unknown){ctxFn=fn;}
// Pilha de seções abertas (suporta aninhamento). Sem alocação por frame: reusa.
const _stackName:string[]=[];
const _stackT:number[]=[];

// ---- API de instrumentação (chamada pelo main.js em volta de cada update*) ----
export function begin(name:string){
  if(!on)return;
  _stackName.push(name);
  _stackT.push(performance.now());
}
export function end(){
  if(!on)return;
  const t=performance.now();
  const name=_stackName.pop();
  const t0=_stackT.pop()!;
  if(name===undefined)return;
  acc.set(name,(acc.get(name)||0)+(t-t0));
}
// Açúcar: mede uma chamada sem fn extra no caminho desligado.
export function section<T>(name:string,fn:()=>T):T|undefined{
  if(!on)return fn();
  begin(name);fn();end();
}

// ---- Medição de frame e FPS ----
let frameT0=0,frameMs=0,frameEma=0,framePeak=0;
let fpsCount=0,fpsWindowT=performance.now(),fps=0,fpsMin=999;
let fpsMinReset=performance.now();
let lastUi=0;

// ---- Custo do shadow pass (2º render da cena inteira) ----
// O shadow map só é redesenhado 1 a cada N frames (main.ts liga needsUpdate).
// Nesses frames o custo salta. Separamos a média dos frames COM shadow pass dos
// SEM, pra quantificar quanto a sombra custa (ms e draw calls extras) — dado que
// decide se mexer em tamanho/frequência da sombra vale a pena.
let shadowFrame=false;
let shadowMs=0,colorMs=0,shadowCalls=0,colorCalls=0;
export function markShadow(){shadowFrame=true;}

// ---- Contagem de entidades visíveis por categoria ----
// main.ts injeta uma fn barata que varre as arrays (traffic/peds/gangs/...) e conta
// os `.visible`. Só é chamada no refresh do overlay (~5fps), nunca por frame, então
// não pesa no orçamento. Diz DIRETO onde estão os draw calls (o que cortar).
let countsFn:(()=>Record<string,number|string>)|null=null;
export function setCounts(fn:()=>Record<string,number|string>){countsFn=fn;}

export function frameStart(){
  frameT0=performance.now();
  shadowFrame=false;
  if(on)acc.clear();
}

export function frameEnd(){
  fpsCount++;
  const now=performance.now();
  // FPS numa janela de 500ms (mesma cadência do medidor antigo do HUD)
  if(now-fpsWindowT>=500){
    fps=Math.round(fpsCount*1000/(now-fpsWindowT));
    fpsCount=0;fpsWindowT=now;
    if(fps<fpsMin)fpsMin=fps;
    if(now-fpsMinReset>=4000){fpsMin=fps;fpsMinReset=now;} // mínimo numa janela móvel de ~4s
  }
  if(!on)return;
  frameMs=now-frameT0;
  frameEma=frameEma?frameEma*.9+frameMs*.1:frameMs;
  framePeak=Math.max(framePeak*.95,frameMs); // pico decai devagar pra "segurar" o pior frame
  // pior sistema deste frame + atualiza picos por sistema (não decaem)
  let worstName='-',worstMs=0;
  for(const[k,v]of acc){
    if(v>worstMs){worstMs=v;worstName=k;}
    if(v>(peak.get(k)||0))peak.set(k,v);
    ema.set(k,(ema.get(k)||0)*.85+v*.15);
  }
  // hitch: frame longo → guarda com os deltas de recurso de GPU pra classificar
  const ri=renderer.info.render,mi=renderer.info.memory;
  const prog=renderer.info.programs?renderer.info.programs.length:0;
  if(frameMs>=HITCH_MS){
    let ctx;try{ctx=ctxFn&&ctxFn();}catch(e){}
    hitches.push({tMs:Math.round(now),frameMs:+frameMs.toFixed(1),
      worst:worstName,worstMs:+worstMs.toFixed(1),
      dProg:prog-_pProg,dGeo:mi.geometries-_pGeo,dTex:mi.textures-_pTex,
      dCalls:ri.calls-_pCalls,calls:ri.calls,ctx});
    if(hitches.length>300)hitches.shift();
  }
  // separa a média dos frames COM shadow pass dos SEM (ver acima)
  if(shadowFrame){shadowMs=shadowMs?shadowMs*.8+frameMs*.2:frameMs;shadowCalls=ri.calls;}
  else{colorMs=colorMs?colorMs*.8+frameMs*.2:frameMs;colorCalls=ri.calls;}
  _pProg=prog;_pGeo=mi.geometries;_pTex=mi.textures;_pCalls=ri.calls;
  if(now-lastUi>=200){renderOverlay();lastUi=now;}
}

// ---- Overlay DOM (criado preguiçosamente; pointer-events:none) ----
let el:HTMLDivElement|null=null;
function ensureEl(){
  if(el)return el;
  el=document.createElement('div');
  el.id='profiler';
  el.style.cssText=[
    'position:fixed','top:8px','right:8px','z-index:99999','pointer-events:none',
    'font:600 11px/1.45 "IBM Plex Mono",monospace','color:#d8f8e2',
    'background:rgba(8,6,14,.82)','padding:8px 10px','border-radius:8px',
    'border:1px solid rgba(120,255,180,.25)','white-space:pre','min-width:228px',
    'text-shadow:0 1px 0 #000','box-shadow:0 4px 18px rgba(0,0,0,.5)'
  ].join(';');
  document.body.appendChild(el);
  return el;
}

function color(v:number,good:number,bad:number){ // verde→amarelo→vermelho por limiar
  return v<=good?'#46e07a':v<=bad?'#ffd24a':'#ff4d7d';
}

function renderOverlay(){
  const r=renderer.info.render,m=renderer.info.memory;
  const programs=renderer.info.programs?renderer.info.programs.length:0;
  // top sistemas por custo (média estável)
  const rows=[...ema.entries()].filter(([,v])=>v>=.01).sort((a,b)=>b[1]-a[1]);
  const totalMeasured=rows.reduce((s,[,v])=>s+v,0);
  const fpsCol=color(120-fps,40,80); // fps alto = bom (invertido)
  let html='';
  html+=`<span style="color:${fps>=95?'#46e07a':fps>=60?'#ffd24a':'#ff4d7d'}">FPS ${fps}`
       +`  min ${fpsMin}</span>\n`;
  html+=`<span style="color:${color(frameEma,10,16)}">frame ${frameEma.toFixed(2)}ms`
       +`  peak ${framePeak.toFixed(1)}</span>\n`;
  html+=`<span style="color:${color(r.calls,400,900)}">draws ${r.calls}</span>`
       +`  tris ${(r.triangles/1000).toFixed(0)}k\n`;
  html+=`geo ${m.geometries}  tex ${m.textures}  prog ${programs}\n`;
  // custo do shadow pass: quanto os frames com sombra passam dos sem (ms e draws)
  const dShadowMs=shadowMs&&colorMs?shadowMs-colorMs:0;
  const dShadowCalls=shadowCalls&&colorCalls?Math.max(0,shadowCalls-colorCalls):0;
  html+=`<span style="color:${color(dShadowMs,2,5)}">shadow +${dShadowMs.toFixed(1)}ms`
       +`  +${dShadowCalls} draws</span>\n`;
  // contagem de entidades visíveis por categoria (o que está desenhando)
  if(countsFn){
    let cnt:Record<string,number|string>|null=null;
    try{cnt=countsFn();}catch(e){}
    if(cnt){
      const parts=Object.entries(cnt).map(([k,v])=>`${k} ${v}`).join('  ');
      html+=`<span style="color:#9fe0ff;opacity:.85">${parts}</span>\n`;
    }
  }
  html+=`<span style="opacity:.7">renderScale ${getRenderScale().toFixed(2)}</span>\n`;
  html+=`<span style="opacity:.55">── CPU ms / system ──</span>\n`;
  for(const[k,v]of rows.slice(0,16)){
    const bar='█'.repeat(Math.min(10,Math.round(v/1.2)));
    html+=`<span style="color:${color(v,1.5,4)}">${v.toFixed(2).padStart(5)}</span> `
         +`<span style="opacity:.45">${bar.padEnd(10)}</span> ${k}\n`;
  }
  html+=`<span style="opacity:.55">measured ${totalMeasured.toFixed(2)}ms</span>`;
  ensureEl().innerHTML=html;
  el!.style.display='block';
}

export function setEnabled(v:boolean){
  on=v;
  if(!on){if(el)el.style.display='none';}
  else ensureEl();
}
export function toggle(){setEnabled(!on);}
export const isOn=()=>on;

if(on)ensureEl();

// Atalho de teclado próprio (não passa pelo input.js): funciona em qualquer tela.
addEventListener('keydown',(e:KeyboardEvent)=>{
  if(e.code==='Backquote'){
    const t=e.target as HTMLElement|null;
    if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    e.preventDefault();toggle();
  }
});

// ---- Snapshot pra relatório/debug ----
(window as any).profilerToggle=toggle;
// Caça-hitches: log dos frames longos, picos por sistema e limpeza pra medir trechos.
(window as any).profilerHitches=()=>JSON.stringify(hitches);
(window as any).profilerPeaks=()=>JSON.stringify(Object.fromEntries(
  [...peak.entries()].map(([k,v]):[string,number]=>[k,+v.toFixed(2)]).sort((a,b)=>b[1]-a[1])));
(window as any).profilerClear=()=>{hitches.length=0;peak.clear();framePeak=0;};
(window as any).profilerReport=()=>{
  const r=renderer.info.render,m=renderer.info.memory;
  let counts:Record<string,number|string>|null=null;
  try{counts=countsFn?countsFn():null;}catch(e){}
  return JSON.stringify({
    fps,fpsMin,frameMs:+frameEma.toFixed(2),framePeakMs:+framePeak.toFixed(2),
    drawCalls:r.calls,triangles:r.triangles,
    geometries:m.geometries,textures:m.textures,
    programs:renderer.info.programs?renderer.info.programs.length:0,
    renderScale:+getRenderScale().toFixed(2),
    // custo do shadow pass isolado: frames com sombra vs sem (ms + draws extras)
    shadow:{withMs:+shadowMs.toFixed(2),withoutMs:+colorMs.toFixed(2),
      deltaMs:+(shadowMs-colorMs).toFixed(2),deltaDraws:Math.max(0,shadowCalls-colorCalls)},
    counts,
    systemsMs:Object.fromEntries([...ema.entries()].map(([k,v]):[string,number]=>[k,+v.toFixed(3)])
      .sort((a,b)=>b[1]-a[1]))
  },null,2);
};
