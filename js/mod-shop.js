import {state,input,keys,refs} from './state.js';
import {camera} from './engine.js';
import {playerPos} from './player.js';
import {blip} from './audio.js';
import {WORKSHOP_PAD,workshopFx} from '../assets/models/city/workshop.js';
import {applyPaint,setRims,setSpoiler,setHood,setNeon,repairCar} from
  '../assets/models/vehicles/car-customs.js';

// Oficina de custom "MOD GARAGE": menu DOM aberto ao parar o carro na plataforma
// do galpão (assets/models/city/workshop.js). Estilo GTA/TransFender: categorias
// de mods, cada opção com preço, aplicada AO VIVO no carro do jogador; paga na
// hora (sem reembolso). O carro gira numa "turntable" e o mundo congela enquanto
// o menu está aberto (js/main.js dá o early-return via updateModShop).

const $=id=>document.getElementById(id);
const PAD_RANGE=4.6;

// seleção atual por categoria, guardada no grupo do carro (persiste na sessão)
function sel(carG){return carG.userData.modsel||(carG.userData.modsel={
  paint:carG.userData.color??0xff2e88,rims:'stock',spoiler:'none',neon:'off',
  hood:'stock',engine:'stock'});}

// ----- catálogo de mods -----
const CATS=[
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
   apply(g,o){applyPaint(g,o.id);repairCar(g);state.wanted=0;state.lastCrime=-99;}},

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
   apply(g,o){setRims(g,o.hub);sel(g).rims=o.id;}},

  {id:'spoiler',label:'SPOILER',
   cur:g=>sel(g).spoiler,
   options:[
     {id:'none',label:'None',price:0},
     {id:'lip',label:'Lip',price:180},
     {id:'wing',label:'Sport Wing',price:280},
     {id:'gt',label:'GT Wing',price:380},
   ],
   apply(g,o){setSpoiler(g,o.id);sel(g).spoiler=o.id;}},

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
   apply(g,o){setNeon(g,o.color);sel(g).neon=o.id;}},

  {id:'hood',label:'HOOD',
   cur:g=>sel(g).hood,
   options:[
     {id:'stock',label:'Stock',price:0},
     {id:'scoop',label:'Scoop',price:170},
     {id:'vents',label:'Vents',price:210},
   ],
   apply(g,o){setHood(g,o.id);sel(g).hood=o.id;}},

  {id:'engine',label:'ENGINE',note:'More top speed & quicker pickup',
   cur:g=>sel(g).engine,
   options:[
     {id:'stock',label:'Stock',price:0,mul:1.0},
     {id:'street',label:'Street',price:450,mul:1.12},
     {id:'sport',label:'Sport',price:950,mul:1.26},
     {id:'race',label:'Race',price:1700,mul:1.42},
   ],
   apply(g,o){g.userData.speedMul=o.mul;sel(g).engine=o.id;}},
];

let active=false,activeCat=0,spin=0,t=0;
let prevControlsLocked=false,prevFov=62,prevHeading=0,toastT=0;

const overlay=$('modshop'),catsEl=$('modshop-cats'),optsEl=$('modshop-opts'),
  moneyEl=$('modshop-money'),toastEl=$('modshop-toast');

function zeroInput(){
  input.moveX=0;input.moveY=0;input.lookX=0;input.lookY=0;
  input.run=false;input.brake=false;input.horn=false;input.shootHeld=false;
  input.moveActive=false;input.lookActive=false;input.brakeActive=false;input.hornActive=false;
  for(const k of Object.keys(keys))keys[k]=false;
}

function padNear(){
  if(state.mode!=='car')return false;
  const c=refs.getCur?.();
  if(!c||c.bike||c.boat||c.plane)return false; // só carro de verdade
  if(Math.abs(c.speed||0)>6)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-WORKSHOP_PAD.x,pp.z-WORKSHOP_PAD.z)<PAD_RANGE;
}

export function modShopActive(){return active;}

export function modShopState(){
  if(active||!padNear())return null;
  return{label:'MOD',prompt:'CUSTOMIZE CAR',enabled:true};
}

// blip do radar (não é Interior, então o hud desenha à parte)
export function workshopBlip(){
  return{x:WORKSHOP_PAD.x,z:WORKSHOP_PAD.z,icon:'wrench',color:'#19e3ff',label:'MOD GARAGE'};
}

function toast(msg,bad){
  if(!toastEl)return;
  toastEl.textContent=msg;
  toastEl.style.color=bad?'#ff2e88':'#9dff2e';
  toastEl.classList.add('show');toastT=1.4;
}

function renderMoney(){if(moneyEl)moneyEl.textContent='$'+Math.max(0,Math.round(state.money));}

function renderOptions(){
  if(!optsEl)return;
  const cat=CATS[activeCat],carG=refs.getCur?.()?.g;
  optsEl.innerHTML='';
  if(cat.note){
    const n=document.createElement('div');n.className='ms-note';n.textContent=cat.note;
    optsEl.appendChild(n);
  }
  const grid=document.createElement('div');grid.className='ms-grid';
  for(const opt of cat.options){
    const isCur=carG&&cat.cur(carG)===opt.id;
    const btn=document.createElement('button');
    btn.className='ms-opt'+(isCur?' on':'');
    if(opt.sw){const sw=document.createElement('span');sw.className='ms-sw';sw.style.background=opt.sw;btn.appendChild(sw);}
    const lab=document.createElement('span');lab.className='ms-lab';lab.textContent=opt.label;btn.appendChild(lab);
    const pr=document.createElement('span');pr.className='ms-price';
    pr.textContent=isCur?'ACTIVE':(opt.price>0?'$'+opt.price:'FREE');btn.appendChild(pr);
    btn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();choose(opt.id);});
    grid.appendChild(btn);
  }
  optsEl.appendChild(grid);
}

function buildMenu(){
  if(!catsEl)return;
  catsEl.innerHTML='';
  CATS.forEach((cat,i)=>{
    const b=document.createElement('button');
    b.className='ms-cat'+(i===activeCat?' on':'');
    b.textContent=cat.label;
    b.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();activeCat=i;buildMenu();});
    catsEl.appendChild(b);
  });
  renderOptions();
}

function choose(optId){
  const cat=CATS[activeCat],c=refs.getCur?.();
  if(!c)return;
  const opt=cat.options.find(o=>o.id===optId);if(!opt)return;
  if(cat.cur(c.g)===opt.id){toast('ALREADY INSTALLED',true);return;}
  if(opt.price>0&&state.money<opt.price){
    toast(`NEED $${opt.price}`,true);blip([180,130],.12,'sawtooth',.18);return;
  }
  if(opt.price>0)state.money-=opt.price;
  cat.apply(c.g,opt);
  toast(opt.price>0?`INSTALLED  -$${opt.price}`:'INSTALLED');
  blip([523,659,880],.07,'square',.16);
  renderMoney();renderOptions();
}

export function openModShop(){
  if(active||!overlay)return true;
  const c=refs.getCur?.();if(!c)return false;
  active=true;state.modShopActive=true;
  prevControlsLocked=state.controlsLocked;prevFov=camera.fov;prevHeading=c.g.rotation.y;
  state.controlsLocked=true;c.speed=0;spin=0;t=0;activeCat=0;
  sel(c.g); // garante a seleção inicial
  zeroInput();
  document.exitPointerLock?.();
  document.body.classList.add('mod-shop-open');
  overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  buildMenu();renderMoney();
  blip([294,392,523],.08,'square',.16);
  return true;
}

export function closeModShop(){
  if(!active)return false;
  active=false;state.modShopActive=false;
  state.controlsLocked=prevControlsLocked;
  camera.fov=prevFov;camera.updateProjectionMatrix();
  const c=refs.getCur?.();if(c)c.g.rotation.y=prevHeading;
  if(workshopFx.ring)workshopFx.ring.material.opacity=.9;
  zeroInput();
  document.body.classList.remove('mod-shop-open');
  overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');
  if(state.started&&!state.mobile&&!input.touchActive)
    document.getElementById('game')?.requestPointerLock?.();
  return true;
}

// chamada pelo performInteract no modo carro
export function modShopInteract(){
  if(active){closeModShop();return true;}
  if(!padNear())return false;
  return openModShop();
}

export function updateModShop(dt){
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
  if(workshopFx.ring)workshopFx.ring.material.opacity=.55+.4*Math.abs(Math.sin(t*3));
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl?.classList.remove('show');}
  return true;
}

// botão DONE / sair
$('modshop-exit')?.addEventListener('pointerdown',e=>{
  e.preventDefault();e.stopPropagation();closeModShop();
});
