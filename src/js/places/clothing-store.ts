import {state,input,keys,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {camera} from '@/core/engine.ts';
import {player,playerPos,applyPlayerClothing,previewPlayerClothing} from '@/actors/player.ts';
import {blip} from '@/audio/audio.ts';
import {message} from '@/ui/hud.ts';
import {Interior} from '@/world/interior.ts';
import {CLOTHES_DOOR,CLOTHES_SPAWN_OUT,CLOTHES_SITE,INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,
  CLOTHES_STATION,clothesFx,clothesInterior,addClothingStore} from '../../assets/models/city/clothing-store.ts';
import {solids} from '@/world/solids.ts';

// Clothing store "THREADS": an enterable interior (extends the base Interior, which owns
// the door/teleport/world-bounds/camera/emergency-exit) with a custom-cars-style outfit
// menu. The player walks to the CHANGING STATION (mirror + podium) and presses E to open a
// DOM overlay (mirrors js/places/mod-shop.ts): pick shirt/pants/shoe colours and a hat/
// glasses, each applied LIVE as a preview on the player while they turn on the podium. New
// picks go in a CART; FINALIZE & BUY (two taps to confirm) charges once and commits the
// outfit to state.clothing (saved with the game). Leaving without buying reverts the
// preview. The world freezes while the menu is open (main.ts updateClothesShop early-return).

type Slot='shirt'|'pants'|'shoe'|'hat'|'glasses';
interface ClothOption{id:number;label:string;price:number;sw?:string;}
interface ClothCat{id:Slot;label:string;note?:string;options:ClothOption[];}
type Outfit={shirt:number;pants:number;shoe:number;hat:number;glasses:number};

const $=(id:string):HTMLElement|null=>document.getElementById(id);
const STATION_RANGE=2.6;

// ----- outfit catalogue (colour ids are hex numbers; hat/glasses ids are variants) -----
const CATS:ClothCat[]=[
  {id:'shirt',label:'CAMISETA',options:[
    {id:0x19e3ff,label:'Ciano',price:60,sw:'#19e3ff'},
    {id:0xc23b4e,label:'Vermelha',price:60,sw:'#c23b4e'},
    {id:0x3b7ac2,label:'Azul',price:60,sw:'#3b7ac2'},
    {id:0xcf9a3a,label:'Mostarda',price:60,sw:'#cf9a3a'},
    {id:0x3aa06b,label:'Verde',price:60,sw:'#3aa06b'},
    {id:0xd96fae,label:'Rosa',price:70,sw:'#d96fae'},
    {id:0x7a4f9e,label:'Roxa',price:70,sw:'#7a4f9e'},
    {id:0xe8e3d2,label:'Branca',price:80,sw:'#e8e3d2'},
    {id:0x15171c,label:'Preta',price:80,sw:'#15171c'},
  ]},
  {id:'pants',label:'CALÇA',options:[
    {id:0x202435,label:'Azul-marinho',price:50,sw:'#202435'},
    {id:0x2e2a24,label:'Cáqui',price:50,sw:'#4a4030'},
    {id:0x3d3f46,label:'Cinza',price:50,sw:'#3d3f46'},
    {id:0x18191f,label:'Preta',price:50,sw:'#18191f'},
    {id:0x5a3a26,label:'Marrom',price:50,sw:'#5a3a26'},
    {id:0x355a8a,label:'Jeans',price:60,sw:'#355a8a'},
  ]},
  {id:'shoe',label:'TÊNIS',options:[
    {id:0x111117,label:'Preto',price:40,sw:'#111117'},
    {id:0xe8e3d2,label:'Branco',price:50,sw:'#e8e3d2'},
    {id:0x33251e,label:'Marrom',price:40,sw:'#33251e'},
    {id:0xc23b4e,label:'Vermelho',price:50,sw:'#c23b4e'},
    {id:0x1f2733,label:'Grafite',price:40,sw:'#1f2733'},
  ]},
  {id:'hat',label:'CHAPÉU',note:'O chapéu fica por cima do cabelo',options:[
    {id:0,label:'Nenhum',price:0},
    {id:1,label:'Boné',price:120,sw:'#1b1d24'},
    {id:2,label:'Gorro',price:100,sw:'#c23b4e'},
  ]},
  {id:'glasses',label:'ÓCULOS',options:[
    {id:0,label:'Nenhum',price:0},
    {id:1,label:'Escuros',price:90,sw:'#0a0a0e'},
    {id:2,label:'Azuis',price:90,sw:'#123a6b'},
  ]},
];

let active=false,activeCat=0,spin=0,t=0,toastT=0;
let prevControlsLocked=false,prevFov=62,prevHeading=0;
const prevPos={x:0,z:0};
let preview:Outfit={shirt:0x19e3ff,pants:0x202435,shoe:0x111117,hat:0,glasses:0};
let baseline:Outfit={...preview};   // outfit already owned when the menu opened (never re-charged)
let confirmBuy=false;

const overlay=$('clothesshop'),catsEl=$('clothesshop-cats'),optsEl=$('clothesshop-opts'),
  moneyEl=$('clothesshop-money'),toastEl=$('clothesshop-toast'),
  totalEl=$('clothesshop-total'),buyEl=$('clothesshop-buy') as HTMLButtonElement|null;

// ----- interior -----
class ClothingStoreInterior extends Interior{
  override onEnter():void{
    message('LOJA DE ROUPAS - SUBA NO PROVADOR PARA TROCAR O VISUAL','var(--gold)');
    blip([392,523,659],.08,'square',.12);
  }
  override onExit():void{ if(active)closeClothesShop(); }
  override updateFx(dt:number):void{
    for(const mq of clothesFx.mannequins)mq.rotation.y+=dt*.4;
    if(clothesFx.stationArrow)clothesFx.stationArrow.position.y=1.9+Math.sin(state.time*3.4)*.16;
    if(clothesFx.exitArrow)clothesFx.exitArrow.position.y=1.7+Math.sin(state.time*3)*.18;
  }
}
addClothingStore(solids); // the storefront on its Rua Treze de Maio lot + the off-map room

export const clothingStore=new ClothingStoreInterior({
  group:clothesInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:CLOTHES_DOOR,spawnOut:CLOTHES_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:clothesFx,
  exterior:{...CLOTHES_SITE.P(-22,110),r:22},
  spawnOutHeading:CLOTHES_SITE.head(-Math.PI/2), // stepping out faces the street
  mapIcon:{id:'clothing-store',label:'LOJA DE ROUPAS',icon:'shirt',color:'#ff6fae'},
});

function nearStation():boolean{
  if(!clothingStore.active)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-CLOTHES_STATION.x,pp.z-CLOTHES_STATION.z)<STATION_RANGE;
}

export function clothesShopActive():boolean{return active;}
export function clothesShopState(){
  if(active||!nearStation())return null;
  return{label:'VESTIR',prompt:'TROCAR O VISUAL',enabled:true};
}

// ----- cart / pricing (mirrors the mod shop) -----
function cartItems():{cat:ClothCat;opt:ClothOption}[]{
  const out:{cat:ClothCat;opt:ClothOption}[]=[];
  for(const cat of CATS){
    const cur=preview[cat.id];
    if(cur!==baseline[cat.id]){
      const opt=cat.options.find(o=>o.id===cur);
      if(opt&&opt.price>0)out.push({cat,opt});
    }
  }
  return out;
}
function cartTotal():number{return cartItems().reduce((s,it)=>s+it.opt.price,0);}

function zeroInput():void{
  input.moveX=0;input.moveY=0;input.turnX=0;input.lookX=0;input.lookY=0;
  input.run=false;input.brake=false;input.shootHeld=false;
  input.moveActive=false;input.lookActive=false;input.brakeActive=false;
  for(const k of Object.keys(keys))keys[k]=false;
}
function toast(msg:string,bad?:boolean):void{
  if(!toastEl)return;
  toastEl.textContent=msg;toastEl.style.color=bad?'#ff2e88':'#9dff2e';
  toastEl.classList.add('show');toastT=1.4;
}
function renderMoney():void{if(moneyEl)moneyEl.textContent='R$'+Math.max(0,Math.round(state.money));}

function renderOptions():void{
  if(!optsEl)return;
  const cat=CATS[activeCat];
  optsEl.innerHTML='';
  if(cat.note){const n=document.createElement('div');n.className='ms-note';n.textContent=cat.note;optsEl.appendChild(n);}
  const grid=document.createElement('div');grid.className='ms-grid';
  for(const opt of cat.options){
    const isCur=preview[cat.id]===opt.id;
    const isOwned=baseline[cat.id]===opt.id;
    const btn=document.createElement('button');
    btn.className='ms-opt'+(isCur?' on':'');
    if(opt.sw){const sw=document.createElement('span');sw.className='ms-sw';sw.style.background=opt.sw;btn.appendChild(sw);}
    const lab=document.createElement('span');lab.className='ms-lab';lab.textContent=opt.label;btn.appendChild(lab);
    const pr=document.createElement('span');pr.className='ms-price';
    if(isOwned){pr.textContent='VESTINDO';pr.classList.add('owned');}
    else if(isCur){pr.textContent=opt.price>0?'NO CARRINHO':'ESCOLHIDO';pr.classList.add('incart');}
    else pr.textContent=opt.price>0?'R$'+opt.price:'GRÁTIS';
    btn.appendChild(pr);
    btn.addEventListener('pointerdown',(e:PointerEvent)=>{e.preventDefault();e.stopPropagation();choose(cat,opt.id);});
    grid.appendChild(btn);
  }
  optsEl.appendChild(grid);
}
function renderCart():void{
  const total=cartTotal();
  if(totalEl)totalEl.textContent=total>0?`CARRINHO  R$${total}`:'CARRINHO VAZIO';
  if(buyEl){
    buyEl.disabled=total<=0;
    buyEl.textContent=confirmBuy&&total>0?`CONFIRMAR  R$${total}`:'FECHAR COMPRA';
    buyEl.classList.toggle('confirm',confirmBuy&&total>0);
  }
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
// clicking an option only PREVIEWS it on the player + updates the cart — no charge.
function choose(cat:ClothCat,optId:number):void{
  if(preview[cat.id]===optId)return;
  confirmBuy=false;
  preview={...preview,[cat.id]:optId};
  previewPlayerClothing(preview);
  blip([523,659,880],.06,'square',.16);
  renderOptions();renderCart();
}
function finalizeBuy():void{
  const items=cartItems();
  const total=items.reduce((s,it)=>s+it.opt.price,0);
  if(total<=0){toast('NADA PARA COMPRAR',true);confirmBuy=false;renderCart();return;}
  if(state.money<total){toast(`PRECISA DE R$${total}`,true);blip([180,130],.12,'sawtooth',.18);confirmBuy=false;renderCart();return;}
  if(!confirmBuy){confirmBuy=true;renderCart();toast('APERTE COMPRAR DE NOVO PARA CONFIRMAR');blip([440,560],.06,'square',.12);return;}
  economy.spend(total,'clothing-store');
  state.clothing.shirt=preview.shirt;state.clothing.pants=preview.pants;state.clothing.shoe=preview.shoe;
  state.clothing.hat=preview.hat;state.clothing.glasses=preview.glasses;
  applyPlayerClothing();
  baseline={...preview};
  confirmBuy=false;
  toast(`VISUAL NOVO  -R$${total}`);
  blip([523,659,784,1047],.08,'square',.18);
  renderMoney();renderOptions();renderCart();
}

export function openClothesShop():boolean{
  if(active||!overlay)return true;
  active=true;
  prevControlsLocked=state.controlsLocked;prevFov=camera.fov;
  prevHeading=player.g.rotation.y;prevPos.x=player.g.position.x;prevPos.z=player.g.position.z;
  state.controlsLocked=true;spin=player.g.rotation.y;t=0;activeCat=0;confirmBuy=false;
  player.g.position.set(CLOTHES_STATION.x,player.g.position.y,CLOTHES_STATION.z); // centre on the podium
  preview={shirt:state.clothing.shirt,pants:state.clothing.pants,shoe:state.clothing.shoe,hat:state.clothing.hat,glasses:state.clothing.glasses};
  baseline={...preview};
  zeroInput();
  document.exitPointerLock?.();
  document.body.classList.add('mod-shop-open');
  overlay.classList.add('open');overlay.setAttribute('aria-hidden','false');
  buildMenu();renderMoney();renderCart();
  blip([294,392,523],.08,'square',.16);
  return true;
}
export function closeClothesShop():boolean{
  if(!active)return false;
  const hadCart=cartTotal()>0;
  active=false;confirmBuy=false;
  state.controlsLocked=prevControlsLocked;
  camera.fov=prevFov;camera.updateProjectionMatrix();
  player.g.position.set(prevPos.x,player.g.position.y,prevPos.z);
  player.g.rotation.y=prevHeading;
  applyPlayerClothing();         // revert any unbought preview to the worn (committed) outfit
  zeroInput();
  document.body.classList.remove('mod-shop-open');
  overlay!.classList.remove('open');overlay!.setAttribute('aria-hidden','true');
  if(state.started&&!state.mobile&&!input.touchActive)document.getElementById('game')?.requestPointerLock?.();
  if(hadCart)message('SAIU DO PROVADOR - O QUE NÃO FOI PAGO FOI DESCARTADO','var(--pink)');
  return true;
}
// performInteract hook (on foot, inside the store, near the podium)
export function clothesShopInteract():boolean{
  if(active){closeClothesShop();return true;}
  if(!nearStation())return false;
  return openClothesShop();
}

export function updateClothesShop(dt:number):boolean{
  if(!active)return false;
  t+=dt;spin+=dt*.5;
  player.g.rotation.y=spin;                 // turntable: the player slowly turns on the podium
  const p=CLOTHES_STATION;
  camera.position.set(p.x+3.4,2.3,p.z+5.0); // in front of the tri-fold mirror, looking at the player
  camera.lookAt(p.x,1.05,p.z);
  camera.fov+=(48-camera.fov)*.6;camera.updateProjectionMatrix();
  if(toastT>0){toastT-=dt;if(toastT<=0)toastEl?.classList.remove('show');}
  return true;
}

$('clothesshop-exit')?.addEventListener('pointerdown',(e:Event)=>{e.preventDefault();e.stopPropagation();closeClothesShop();});
$('clothesshop-buy')?.addEventListener('pointerdown',(e:Event)=>{e.preventDefault();e.stopPropagation();finalizeBuy();});
