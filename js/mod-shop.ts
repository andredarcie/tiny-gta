import {state,input,keys,refs} from './state.js';
import {economy} from './economy.js';
import {camera} from './engine.js';
import {playerPos,resetCarDamage} from './player.js';
import {blip} from './audio.js';
import {message} from './hud.js';
import {WORKSHOP_PAD,workshopFx} from '../assets/models/city/workshop.js';
import {applyPaint,setRims,setSpoiler,setHood,setNeon,repairCar} from
  '../assets/models/vehicles/car-customs.js';
import type * as THREE from 'three';

// Oficina de custom "MOD GARAGE": menu DOM aberto ao parar o carro na plataforma
// do galpão (assets/models/city/workshop.js). Estilo open-world/tuning: categorias
// de mods, cada opção aplicada AO VIVO no carro só como PRÉVIA (não cobra). As
// escolhas novas entram num CARRINHO com o total; só FINALIZE & BUY (em dois
// toques, p/ confirmar) cobra de verdade e instala. O que já está pago aparece
// como OWNED e nunca é cobrado de novo. Sair sem finalizar descarta as prévias.
// O carro gira numa "turntable" e o mundo congela enquanto o menu está aberto
// (js/main.js dá o early-return via updateModShop).

const $=(id:string):HTMLElement|null=>document.getElementById(id);
const PAD_RANGE=4.6;

// uma opção de mod no catálogo (os campos variam por categoria; todos opcionais
// fora de id/label/price, que toda opção tem)
interface ModOption{
  id:number|string;
  label:string;
  price:number;
  sw?:string;       // amostra de cor pro botão
  hub?:number;      // cor do cubo da roda (rims)
  color?:number|null; // cor do neon
  mul?:number;      // multiplicador de velocidade do motor (engine)
}
// uma categoria de mods
interface ModCategory{
  id:string;
  label:string;
  note?:string;
  cur:(g:THREE.Object3D)=>number|string;
  options:ModOption[];
  preview:(g:THREE.Object3D,o:ModOption)=>void;
  commit?:(g:THREE.Object3D,o:ModOption)=>void;
}
// seleção corrente por categoria, guardada no userData do carro
interface ModSelection{
  paint:number;rims:string;spoiler:string;neon:string;hood:string;engine:string;
}
// snapshot do que está instalado/pago agora (indexável por cat.id)
type ModBaseline={paint:number}&Record<string,number|string>;

// seleção atual por categoria, guardada no grupo do carro (persiste na sessão)
function sel(carG:THREE.Object3D):ModSelection{return carG.userData.modsel||(carG.userData.modsel={
  paint:carG.userData.color??0xff2e88,rims:'stock',spoiler:'none',neon:'off',
  hood:'stock',engine:'stock'});}

// ----- catálogo de mods -----
const CATS:ModCategory[]=[
  {id:'paint',label:'PAINT',note:'Respray repairs damage & loses the cops',
   cur:g=>g.userData.color,
   options:[
     {id:0xff2e88,label:'Hot Pink',price:120,sw:'#ff2e88'},
     {id:0xc2293f,label:'Race Red',price:120,sw:'#c2293f'},
     {id:0xff7a1e,label:'Sunset',price:120,sw:'#ff7a1e'},
     {id:0xffd24a,label:'Gold',price:160,sw:'#ffd24a'},
     {id:0x6ddf3a,label:'Lime',price:120,sw:'#6ddf3a'},
     {id:0x19c3b0,label:'Teal',price:120,sw:'#19c3b0'},
     {id:0x2a6cff,label:'Electric',price:120,sw:'#2a6cff'},
     {id:0x8a3ff0,label:'Purple',price:120,sw:'#8a3ff0'},
     {id:0xeef1f5,label:'Pearl',price:140,sw:'#eef1f5'},
     {id:0xb9bec9,label:'Silver',price:120,sw:'#b9bec9'},
     {id:0x15171c,label:'Midnight',price:140,sw:'#15171c'},
     {id:0x3f6b3a,label:'Army',price:120,sw:'#3f6b3a'},
   ],
   preview(g,o){applyPaint(g,o.id as number);},
   commit(g,o){repairCar(g);state.wanted=0;state.lastCrime=-99;}}, // reparo/perder a polícia só ao PAGAR

  {id:'rims',label:'RIMS',
   cur:g=>sel(g).rims,
   options:[
     {id:'stock',label:'Stock',price:0,hub:0xb9bec9,sw:'#9aa0aa'},
     {id:'chrome',label:'Chrome',price:160,hub:0xe8eef5,sw:'#e8eef5'},
     {id:'gold',label:'Gold',price:240,hub:0xffd24a,sw:'#ffd24a'},
     {id:'black',label:'Murdered',price:150,hub:0x15171c,sw:'#15171c'},
     {id:'red',label:'Red',price:180,hub:0xc2293f,sw:'#c2293f'},
     {id:'blue',label:'Blue',price:180,hub:0x2a6cff,sw:'#2a6cff'},
   ],
   preview(g,o){setRims(g,o.hub as number);sel(g).rims=o.id as string;}},

  {id:'spoiler',label:'SPOILER',
   cur:g=>sel(g).spoiler,
   options:[
     {id:'none',label:'None',price:0},
     {id:'lip',label:'Lip',price:180},
     {id:'wing',label:'Sport Wing',price:280},
     {id:'gt',label:'GT Wing',price:380},
   ],
   preview(g,o){setSpoiler(g,o.id as string);sel(g).spoiler=o.id as string;}},

  {id:'neon',label:'NEON',note:'Underglow that lights up the night',
   cur:g=>sel(g).neon,
   options:[
     {id:'off',label:'Off',price:0,color:null},
     {id:'pink',label:'Pink',price:220,color:0xff2e88,sw:'#ff2e88'},
     {id:'cyan',label:'Cyan',price:220,color:0x19e3ff,sw:'#19e3ff'},
     {id:'green',label:'Green',price:220,color:0x6ddf3a,sw:'#6ddf3a'},
     {id:'gold',label:'Gold',price:240,color:0xffd24a,sw:'#ffd24a'},
     {id:'purple',label:'Purple',price:220,color:0x8a3ff0,sw:'#8a3ff0'},
     {id:'red',label:'Red',price:220,color:0xff3b3b,sw:'#ff3b3b'},
   ],
   preview(g,o){setNeon(g,o.color as number|null);sel(g).neon=o.id as string;}},

  {id:'hood',label:'HOOD',
   cur:g=>sel(g).hood,
   options:[
     {id:'stock',label:'Stock',price:0},
     {id:'scoop',label:'Scoop',price:170},
     {id:'vents',label:'Vents',price:210},
   ],
   preview(g,o){setHood(g,o.id as string);sel(g).hood=o.id as string;}},

  {id:'engine',label:'ENGINE',note:'More top speed & quicker pickup',
   cur:g=>sel(g).engine,
   options:[
     {id:'stock',label:'Stock',price:0,mul:1.0},
     {id:'street',label:'Street',price:450,mul:1.12},
     {id:'sport',label:'Sport',price:950,mul:1.26},
     {id:'race',label:'Race',price:1700,mul:1.42},
   ],
   preview(g,o){sel(g).engine=o.id as string;}, // motor não muda o visual; só marca a escolha
   commit(g,o){g.userData.speedMul=o.mul;}}, // o ganho de velocidade só vale ao PAGAR
];

let active=false,activeCat=0,spin=0,t=0;
let prevControlsLocked=false,prevFov=62,prevHeading=0,toastT=0;
let baseline:ModBaseline|null=null;    // config JÁ PAGA quando a oficina abriu {paint,rims,spoiler,neon,hood,engine}
let confirmBuy=false; // 2º toque do FINALIZE confirma a compra

const overlay=$('modshop'),catsEl=$('modshop-cats'),optsEl=$('modshop-opts'),
  moneyEl=$('modshop-money'),toastEl=$('modshop-toast'),
  totalEl=$('modshop-total'),buyEl=$('modshop-buy') as HTMLButtonElement|null;

// snapshot da seleção atual do carro (o que está visível/instalado agora)
function snapshot(g:THREE.Object3D):ModBaseline{const s=sel(g);
  return{paint:g.userData.color,rims:s.rims,spoiler:s.spoiler,neon:s.neon,hood:s.hood,engine:s.engine};}
// itens do CARRINHO: categorias cuja escolha atual difere do que já está pago (e custa >0)
function cartItems():{cat:ModCategory;opt:ModOption}[]{
  const g=refs.getCur?.()?.g;if(!g||!baseline)return[];
  const out:{cat:ModCategory;opt:ModOption}[]=[];
  for(const cat of CATS){
    const curId=cat.cur(g);
    if(curId!==baseline[cat.id]){
      const opt=cat.options.find(o=>o.id===curId);
      if(opt&&opt.price>0)out.push({cat,opt});
    }
  }
  return out;
}
function cartTotal():number{return cartItems().reduce((s,it)=>s+it.opt.price,0);}
// desfaz as prévias não pagas: volta cada categoria pro que estava pago
function revertToBaseline():void{
  const g=refs.getCur?.()?.g;if(!g||!baseline)return;
  for(const cat of CATS){
    if(cat.cur(g)===baseline[cat.id])continue;
    const opt=cat.options.find(o=>o.id===baseline![cat.id]);
    if(opt)cat.preview(g,opt);
    else if(cat.id==='paint')applyPaint(g,baseline.paint); // cor fora do catálogo: restaura direto
  }
}

function zeroInput():void{
  input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;
  input.run=false;input.brake=false;input.horn=false;input.shootHeld=false;
  input.moveActive=false;input.lookActive=false;input.brakeActive=false;input.hornActive=false;
  for(const k of Object.keys(keys))keys[k]=false;
}

function padNear():boolean{
  if(state.mode!=='car')return false;
  const c=refs.getCur?.();
  if(!c||c.bike||c.boat||c.plane)return false; // só carro de verdade
  if(Math.abs(c.speed||0)>6)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-WORKSHOP_PAD.x,pp.z-WORKSHOP_PAD.z)<PAD_RANGE;
}

export function modShopActive():boolean{return active;}

export function modShopState(){
  if(active||!padNear())return null;
  return{label:'MOD',prompt:'CUSTOMIZE CAR',enabled:true};
}

// blip do radar (não é Interior, então o hud desenha à parte)
export function workshopBlip(){
  return{x:WORKSHOP_PAD.x,z:WORKSHOP_PAD.z,icon:'wrench',color:'#19e3ff',label:'MOD GARAGE'};
}

function toast(msg:string,bad?:boolean):void{
  if(!toastEl)return;
  toastEl.textContent=msg;
  toastEl.style.color=bad?'#ff2e88':'#9dff2e';
  toastEl.classList.add('show');toastT=1.4;
}

function renderMoney():void{if(moneyEl)moneyEl.textContent='$'+Math.max(0,Math.round(state.money));}

function renderOptions():void{
  if(!optsEl)return;
  const cat=CATS[activeCat],carG=refs.getCur?.()?.g;
  optsEl.innerHTML='';
  if(cat.note){
    const n=document.createElement('div');n.className='ms-note';n.textContent=cat.note;
    optsEl.appendChild(n);
  }
  const grid=document.createElement('div');grid.className='ms-grid';
  for(const opt of cat.options){
    const isCur=carG&&cat.cur(carG)===opt.id;             // prévia visível agora
    const isOwned=carG&&baseline&&baseline[cat.id]===opt.id; // já pago
    const btn=document.createElement('button');
    btn.className='ms-opt'+(isCur?' on':'');
    if(opt.sw){const sw=document.createElement('span');sw.className='ms-sw';sw.style.background=opt.sw;btn.appendChild(sw);}
    const lab=document.createElement('span');lab.className='ms-lab';lab.textContent=opt.label;btn.appendChild(lab);
    const pr=document.createElement('span');pr.className='ms-price';
    if(isOwned){pr.textContent='OWNED';pr.classList.add('owned');}
    else if(isCur){pr.textContent=opt.price>0?'IN CART':'SELECTED';pr.classList.add('incart');}
    else pr.textContent=opt.price>0?'$'+opt.price:'FREE';
    btn.appendChild(pr);
    btn.addEventListener('pointerdown',(e:PointerEvent)=>{e.preventDefault();e.stopPropagation();choose(opt.id);});
    grid.appendChild(btn);
  }
  optsEl.appendChild(grid);
}

// barra do carrinho: total + botão FINALIZE (com confirmação no 2º toque)
function renderCart():void{
  const total=cartTotal();
  if(totalEl)totalEl.textContent=total>0?`CART  $${total}`:'CART EMPTY';
  if(buyEl){
    buyEl.disabled=total<=0;
    buyEl.textContent=confirmBuy&&total>0?`CONFIRM  $${total}`:'FINALIZE & BUY';
    buyEl.classList.toggle('confirm',confirmBuy&&total>0);
  }
}

function finalizeBuy():void{
  const c=refs.getCur?.();if(!c)return;
  const items=cartItems();
  const total=items.reduce((s,it)=>s+it.opt.price,0);
  if(total<=0){toast('NOTHING TO BUY',true);confirmBuy=false;renderCart();return;}
  if(state.money<total){
    toast(`NEED $${total}`,true);blip([180,130],.12,'sawtooth',.18);confirmBuy=false;renderCart();return;
  }
  if(!confirmBuy){ // 1º toque: pede confirmação
    confirmBuy=true;renderCart();
    toast('PRESS BUY AGAIN TO CONFIRM');blip([440,560],.06,'square',.12);return;
  }
  // 2º toque: cobra o carrinho de uma vez e instala de vez (vira "owned")
  economy.spend(total,'mod-shop');
  for(const {cat,opt} of items)cat.commit?.(c.g,opt);
  baseline=snapshot(c.g);
  confirmBuy=false;
  toast(`PURCHASED  -$${total}`);
  blip([523,659,784,1047],.08,'square',.18);
  renderMoney();renderOptions();renderCart();
}

function buildMenu():void{
  if(!catsEl)return;
  catsEl.innerHTML='';
  CATS.forEach((cat,i)=>{
    const b=document.createElement('button');
    b.className='ms-cat'+(i===activeCat?' on':'');
    b.textContent=cat.label;
    b.addEventListener('pointerdown',(e:PointerEvent)=>{e.preventDefault();e.stopPropagation();activeCat=i;buildMenu();});
    catsEl.appendChild(b);
  });
  renderOptions();renderCart();
}

// clicar numa opção só APLICA A PRÉVIA (visual) e mexe no carrinho — não cobra.
function choose(optId:number|string):void{
  const cat=CATS[activeCat],c=refs.getCur?.();
  if(!c)return;
  const opt=cat.options.find(o=>o.id===optId);if(!opt)return;
  if(cat.cur(c.g)===opt.id)return; // já é o que está no carro: nada a fazer
  confirmBuy=false;                // mexeu na seleção: cancela a confirmação pendente
  cat.preview(c.g,opt);            // aplica SÓ o visual; o preço entra no carrinho
  blip([523,659,880],.06,'square',.16);
  renderOptions();renderCart();
}

export function openModShop():boolean{
  if(active||!overlay)return true;
  const c=refs.getCur?.();if(!c)return false;
  active=true;state.modShopActive=true;
  prevControlsLocked=state.controlsLocked;prevFov=camera.fov;prevHeading=c.g.rotation.y;
  state.controlsLocked=true;c.speed=0;spin=0;t=0;activeCat=0;
  sel(c.g); // garante a seleção inicial
  baseline=snapshot(c.g); // o que JÁ está pago/instalado: nunca cobra de novo
  confirmBuy=false;
  zeroInput();
  document.exitPointerLock?.();
  document.body.classList.add('mod-shop-open');
  overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  buildMenu();renderMoney();renderCart();
  blip([294,392,523],.08,'square',.16);
  return true;
}

export function closeModShop():boolean{
  if(!active)return false;
  const hadCart=cartTotal()>0;
  revertToBaseline(); // sair sem finalizar descarta as prévias: nada é comprado
  confirmBuy=false;
  active=false;state.modShopActive=false;
  state.controlsLocked=prevControlsLocked;
  camera.fov=prevFov;camera.updateProjectionMatrix();
  const c=refs.getCur?.();if(c)c.g.rotation.y=prevHeading;
  if(workshopFx.ring)(workshopFx.ring.material as THREE.Material).opacity=.9;
  zeroInput();
  document.body.classList.remove('mod-shop-open');
  overlay!.classList.remove('open');overlay!.setAttribute('aria-hidden','true');
  if(state.started&&!state.mobile&&!input.touchActive)
    document.getElementById('game')?.requestPointerLock?.();
  if(hadCart)message('LEFT THE GARAGE - UNPAID CHANGES DISCARDED','var(--pink)');
  return true;
}

// chamada pelo performInteract no modo carro
export function modShopInteract():boolean{
  if(active){closeModShop();return true;}
  if(!padNear())return false;
  return openModShop();
}

export function updateModShop(dt:number):boolean{
  if(!active)return false;
  const c=refs.getCur?.();
  if(!c){closeModShop();return false;}
  t+=dt;spin+=dt*.55;
  c.g.rotation.y=spin;          // turntable do showroom
  c.g.rotation.z=0;c.g.rotation.x=0;
  const px=c.g.position.x,pz=c.g.position.z;
  camera.position.set(px+4.4,2.8,pz-6.2);
  camera.lookAt(px,.85,pz);
  camera.fov+=(50-camera.fov)*.6;camera.updateProjectionMatrix();
  if(workshopFx.ring)(workshopFx.ring.material as THREE.Material).opacity=.55+.4*Math.abs(Math.sin(t*3));
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl?.classList.remove('show');}
  return true;
}

// botão DONE / sair
$('modshop-exit')?.addEventListener('pointerdown',(e:Event)=>{
  e.preventDefault();e.stopPropagation();closeModShop();
});
// botão FINALIZE & BUY (2 toques: confirma e cobra o carrinho)
$('modshop-buy')?.addEventListener('pointerdown',(e:Event)=>{
  e.preventDefault();e.stopPropagation();finalizeBuy();
});
