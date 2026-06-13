import * as THREE from 'three';
import {state} from './state.js';

// Galeria de objetos do jogo: um modal com renderer/cena próprios (separados do
// jogo) que instancia cada modelo pela sua fábrica e o exibe centralizado e
// girando. As fábricas que fazem scene.add() no mundo são "reparentadas": ao
// adicionar o objeto ao pivot daqui, o THREE o remove da cena do jogo sozinho.

// Descoberta automática: cada arquivo em assets/models que tiver um default
// export {category,label,build} entra no modal sozinho. Adicionar um modelo novo
// no jogo (seguindo o padrão) faz ele aparecer aqui sem editar este arquivo.
// import.meta.glob é resolvido pelo Vite em build-time; os módulos são lazy
// (só carregam quando o modal é aberto pela 1ª vez).
const MODEL_LOADERS=import.meta.glob('../assets/models/**/*.js');

// Categoria amigável derivada da pasta (fallback quando o descriptor não define).
const TITLE=s=>s.replace(/(^|[-_/])(\w)/g,(_,sep,c)=>(sep==='-'||sep==='_'?' ':'')+c.toUpperCase()).trim();
const folderOf=path=>path.split('/assets/models/')[1].split('/')[0];

let REGISTRY=[];     // preenchido em discover() na 1ª abertura
let CATEGORIES=[];
let discovered=false;

// Normaliza o que build() devolve para um Object3D (algumas fábricas retornam
// um dicionário de partes, ex.: {ring,beacon} ou {arrow}).
function toObject3D(out){
  if(!out)return null;
  if(out.isObject3D)return out;
  const g=new THREE.Group();
  for(const v of Object.values(out))if(v&&v.isObject3D)g.add(v);
  return g.children.length?g:null;
}

async function discover(){
  if(discovered)return;
  const entries=[];
  for(const [path,loader] of Object.entries(MODEL_LOADERS)){
    let mod;
    try{mod=await loader();}catch(e){continue;}
    const d=mod.default;
    if(!d||(typeof d.build!=='function'&&!Array.isArray(d.variants)))continue;
    const cat=d.category||TITLE(folderOf(path));
    // Um arquivo pode expor vários looks via variants:[{label,opts?,build?}]
    const variants=Array.isArray(d.variants)?d.variants:[{label:d.label,build:d.build}];
    for(const v of variants){
      const build=v.build||d.build;
      if(typeof build!=='function')continue;
      entries.push({cat,label:v.label||d.label||TITLE(path.split('/').pop().replace(/\.js$/,'')),
        load:async()=>toObject3D(build(v.opts||{}))});
    }
  }
  // ordena por categoria e depois por label, mantendo estável e previsível
  entries.sort((a,b)=>a.cat.localeCompare(b.cat)||a.label.localeCompare(b.label));
  REGISTRY=entries;
  CATEGORIES=[...new Set(entries.map(m=>m.cat))];
  discovered=true;
}

let renderer,vscene,vcamera,pivot,holder,current,raf,ready=false;
let prevPaused=false;

function el(id){return document.getElementById(id);}

function build(){
  const canvas=el('mv-canvas');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;

  vscene=new THREE.Scene();
  vcamera=new THREE.PerspectiveCamera(45,1,.01,1000);

  vscene.add(new THREE.HemisphereLight(0xbfdfff,0x4a3a55,1.1));
  const key=new THREE.DirectionalLight(0xfff1d6,2.2);
  key.position.set(4,7,5);key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  vscene.add(key);
  const rim=new THREE.DirectionalLight(0xff8fc8,.7);
  rim.position.set(-5,3,-4);vscene.add(rim);

  pivot=new THREE.Group();
  holder=new THREE.Group();
  pivot.add(holder);
  vscene.add(pivot);

  // 1º combobox: categorias (preenchido em fillCategories após discover())
  el('mv-cat').addEventListener('change',e=>fillObjects(e.target.value));

  // 2º combobox: objetos da categoria escolhida
  el('mv-select').addEventListener('change',e=>select(+e.target.value));

  el('mv-close').addEventListener('click',close);
  el('modelviewer').addEventListener('pointerdown',e=>{
    if(e.target===el('modelviewer'))close(); // clique fora da caixa fecha
  });

  // Arrastar pra girar: yaw livre, pitch limitado (não desvira o objeto)
  let dragging=false,lx=0,ly=0;
  const cv=el('mv-canvas');
  cv.style.touchAction='none'; // pointermove sem o navegador rolar/zoom no toque
  cv.addEventListener('pointerdown',e=>{
    dragging=true;lx=e.clientX;ly=e.clientY;
    cv.setPointerCapture?.(e.pointerId);
  });
  cv.addEventListener('pointermove',e=>{
    if(!dragging)return;
    pivot.rotation.y+=(e.clientX-lx)*.01;
    pivot.rotation.x=Math.max(-1.2,Math.min(1.2,pivot.rotation.x+(e.clientY-ly)*.01));
    lx=e.clientX;ly=e.clientY;
  });
  const endDrag=e=>{dragging=false;cv.releasePointerCapture?.(e.pointerId);};
  cv.addEventListener('pointerup',endDrag);
  cv.addEventListener('pointercancel',endDrag);

  ready=true;
}

// Preenche o 1º combobox com as categorias descobertas
function fillCategories(){
  const catSel=el('mv-cat');
  catSel.innerHTML='';
  CATEGORIES.forEach(c=>{
    const o=document.createElement('option');
    o.value=c;o.textContent=c;catSel.appendChild(o);
  });
}

// Preenche o combobox de objetos com os itens da categoria e seleciona o 1º
function fillObjects(cat){
  const sel=el('mv-select');
  sel.innerHTML='';
  REGISTRY.forEach((m,i)=>{
    if(m.cat!==cat)return;
    const o=document.createElement('option');
    o.value=String(i);o.textContent=m.label;sel.appendChild(o);
  });
  if(sel.options.length)select(+sel.options[0].value);
}

function resize(){
  const wrap=el('mv-stage');
  const w=wrap.clientWidth,h=wrap.clientHeight;
  if(!w||!h)return;
  renderer.setSize(w,h,false);
  vcamera.aspect=w/h;vcamera.updateProjectionMatrix();
}

async function select(i){
  const entry=REGISTRY[i];
  if(!entry)return;
  if(current){holder.remove(current);current=null;}
  let obj;
  try{obj=await entry.load();}catch(err){console.error('model-viewer:',err);return;}
  if(!obj)return;
  if(!state.viewerOpen){ // fechou enquanto carregava
    return;
  }
  obj.position.set(0,0,0);
  obj.rotation.set(0,0,0);
  holder.position.set(0,0,0); // zera ANTES de medir, senão herda o offset do modelo anterior
  holder.add(obj);
  current=obj;

  // Alguns modelos (sprites do ciclo dia/noite) nascem com opacity 0 e fazem
  // fade no jogo — no preview, revela o que está totalmente invisível.
  obj.traverse(o=>{
    const mats=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];
    for(const m of mats)if(m&&m.transparent&&m.opacity===0){m.opacity=1;m.needsUpdate=true;}
  });

  // centraliza e enquadra pela esfera envolvente
  holder.updateWorldMatrix(true,true);
  const box=measureBox(holder);
  if(box.isEmpty())return; // nada mensurável (não deveria acontecer)
  const center=box.getCenter(new THREE.Vector3());
  holder.position.set(-center.x,-center.y,-center.z);
  const sphere=box.getBoundingSphere(new THREE.Sphere());
  const r=Math.max(sphere.radius,.2);
  const dist=r/Math.sin((vcamera.fov*Math.PI/180)/2)*1.25;
  vcamera.position.set(dist*.45,dist*.32,dist);
  vcamera.near=Math.max(dist/100,.01);vcamera.far=dist*10;
  vcamera.lookAt(0,0,0);
  vcamera.updateProjectionMatrix();
  pivot.rotation.set(0,0,0); // novo modelo começa de frente; drag gira a partir daqui
}

// Box3.setFromObject ignora Sprites (não têm geometria), então um modelo só de
// sprite (sol, lua, glow) daria box vazia e enquadramento NaN. Aqui medimos
// meshes/points normalmente e expandimos a box pelos sprites (posição ± escala).
function measureBox(root){
  const box=new THREE.Box3().setFromObject(root);
  const p=new THREE.Vector3(),s=new THREE.Vector3();
  root.traverse(o=>{
    if(!o.isSprite)return;
    o.updateWorldMatrix(true,false);
    p.setFromMatrixPosition(o.matrixWorld);
    s.setFromMatrixScale(o.matrixWorld);
    box.expandByPoint(p.clone().add(new THREE.Vector3(s.x/2,s.y/2,0)));
    box.expandByPoint(p.clone().add(new THREE.Vector3(-s.x/2,-s.y/2,0)));
  });
  return box;
}

function loop(){
  raf=requestAnimationFrame(loop);
  renderer.render(vscene,vcamera);
}

export async function openModelViewer(){
  if(state.viewerOpen)return;
  if(!ready)build();
  await discover();          // descobre os modelos na 1ª abertura (lazy)
  if(state.viewerOpen)return; // reentrância: abriu/fechou enquanto descobria
  fillCategories();
  state.viewerOpen=true;
  prevPaused=state.paused;
  state.paused=true; // congela o jogo por baixo sem mostrar o overlay PAUSED
  document.exitPointerLock?.();
  el('modelviewer').classList.add('open');
  el('modelviewer').setAttribute('aria-hidden','false');
  resize();
  el('mv-cat').value=CATEGORIES[0];
  fillObjects(CATEGORIES[0]);
  loop();
  addEventListener('resize',resize);
}

export function closeModelViewer(){
  if(!state.viewerOpen)return;
  state.viewerOpen=false;
  cancelAnimationFrame(raf);
  removeEventListener('resize',resize);
  el('modelviewer').classList.remove('open');
  el('modelviewer').setAttribute('aria-hidden','true');
  if(current){holder.remove(current);current=null;}
  state.paused=prevPaused;
}

function close(){closeModelViewer();}

export function toggleModelViewer(){
  if(state.viewerOpen)closeModelViewer();else openModelViewer();
}
