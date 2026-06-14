// Profiler de performance embutido no jogo — TEMPLATE reutilizável.
// Mede o custo de CPU de cada sistema por frame, FPS (com mínimo na janela),
// tempo de frame (médio/pico) e os contadores do renderer (draw calls,
// triângulos, geometrias, texturas, shaders). Liga/desliga com a tecla `
// (backquote) ou ?prof na URL. Quando DESLIGADO, begin()/end() são quase no-op.
//
// Como usar: importe { begin, end, frameStart, frameEnd } no loop principal:
//   import * as P from './profiler.js';
//   function frame(){ requestAnimationFrame(frame); P.frameStart();
//     step(dt); P.frameEnd(); }
//   // dentro do step(): P.begin('traffic'); updateTraffic(dt); P.end(); ...
//   //                   P.begin('render'); renderer.render(scene,camera); P.end();
//
// Ajuste APENAS este import pro seu projeto (de onde sai o WebGLRenderer):
import {renderer} from './engine.js';
// renderScale é lido sem acoplar ao engine: main.js pode expor
// window.__renderScale=getRenderScale (resolução adaptativa). Senão, fica 1.
const getRenderScale=()=>window.__renderScale?.()??1;

let on=new URLSearchParams(location.search).has('prof');

const acc=new Map();   // ms por seção no frame atual
const ema=new Map();   // média exponencial estável por seção
const _stackName=[],_stackT=[]; // pilha de seções (sem alocar por frame)

export function begin(name){ if(!on)return; _stackName.push(name);_stackT.push(performance.now()); }
export function end(){
  if(!on)return;
  const t=performance.now(),name=_stackName.pop(),t0=_stackT.pop();
  if(name===undefined)return;
  acc.set(name,(acc.get(name)||0)+(t-t0));
}
export function section(name,fn){ if(!on)return fn(); begin(name);fn();end(); }

let frameT0=0,frameMs=0,frameEma=0,framePeak=0;
let fpsCount=0,fpsWindowT=performance.now(),fps=0,fpsMin=999,fpsMinReset=performance.now();
let lastUi=0;

export function frameStart(){ frameT0=performance.now(); if(on)acc.clear(); }
export function frameEnd(){
  fpsCount++;
  const now=performance.now();
  if(now-fpsWindowT>=500){
    fps=Math.round(fpsCount*1000/(now-fpsWindowT));
    fpsCount=0;fpsWindowT=now;
    if(fps<fpsMin)fpsMin=fps;
    if(now-fpsMinReset>=4000){fpsMin=fps;fpsMinReset=now;}
  }
  if(!on)return;
  frameMs=now-frameT0;
  frameEma=frameEma?frameEma*.9+frameMs*.1:frameMs;
  framePeak=Math.max(framePeak*.95,frameMs);
  for(const[k,v]of acc)ema.set(k,(ema.get(k)||0)*.85+v*.15);
  if(now-lastUi>=200){renderOverlay();lastUi=now;}
}

let el=null;
function ensureEl(){
  if(el)return el;
  el=document.createElement('div');el.id='profiler';
  el.style.cssText=['position:fixed','top:8px','right:8px','z-index:99999','pointer-events:none',
    'font:600 11px/1.45 "IBM Plex Mono",monospace','color:#d8f8e2','background:rgba(8,6,14,.82)',
    'padding:8px 10px','border-radius:8px','border:1px solid rgba(120,255,180,.25)',
    'white-space:pre','min-width:228px','text-shadow:0 1px 0 #000','box-shadow:0 4px 18px rgba(0,0,0,.5)'].join(';');
  document.body.appendChild(el);return el;
}
const color=(v,good,bad)=>v<=good?'#46e07a':v<=bad?'#ffd24a':'#ff4d7d';
function renderOverlay(){
  const r=renderer.info.render,m=renderer.info.memory;
  const programs=renderer.info.programs?renderer.info.programs.length:0;
  const rows=[...ema.entries()].filter(([,v])=>v>=.01).sort((a,b)=>b[1]-a[1]);
  const total=rows.reduce((s,[,v])=>s+v,0);
  let h='';
  h+=`<span style="color:${fps>=95?'#46e07a':fps>=60?'#ffd24a':'#ff4d7d'}">FPS ${fps}  min ${fpsMin}</span>\n`;
  h+=`<span style="color:${color(frameEma,10,16)}">frame ${frameEma.toFixed(2)}ms  peak ${framePeak.toFixed(1)}</span>\n`;
  h+=`<span style="color:${color(r.calls,400,900)}">draws ${r.calls}</span>  tris ${(r.triangles/1000).toFixed(0)}k\n`;
  h+=`geo ${m.geometries}  tex ${m.textures}  prog ${programs}\n`;
  h+=`<span style="opacity:.7">renderScale ${getRenderScale().toFixed(2)}</span>\n`;
  h+=`<span style="opacity:.55">── CPU ms / system ──</span>\n`;
  for(const[k,v]of rows.slice(0,16)){
    const bar='█'.repeat(Math.min(10,Math.round(v/1.2)));
    h+=`<span style="color:${color(v,1.5,4)}">${v.toFixed(2).padStart(5)}</span> <span style="opacity:.45">${bar.padEnd(10)}</span> ${k}\n`;
  }
  h+=`<span style="opacity:.55">measured ${total.toFixed(2)}ms</span>`;
  ensureEl().innerHTML=h;el.style.display='block';
}

export function setEnabled(v){ on=v; if(!on){if(el)el.style.display='none';}else ensureEl(); }
export function toggle(){ setEnabled(!on); }
export const isOn=()=>on;
if(on)ensureEl();

addEventListener('keydown',e=>{
  if(e.code==='Backquote'){
    const t=e.target;
    if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;
    e.preventDefault();toggle();
  }
});

window.profilerToggle=toggle;
window.profilerReport=()=>{
  const r=renderer.info.render,m=renderer.info.memory;
  return JSON.stringify({
    fps,fpsMin,frameMs:+frameEma.toFixed(2),framePeakMs:+framePeak.toFixed(2),
    drawCalls:r.calls,triangles:r.triangles,geometries:m.geometries,textures:m.textures,
    programs:renderer.info.programs?renderer.info.programs.length:0,
    renderScale:+getRenderScale().toFixed(2),
    systemsMs:Object.fromEntries([...ema.entries()].map(([k,v])=>[k,+v.toFixed(3)]).sort((a,b)=>b[1]-a[1]))
  },null,2);
};
