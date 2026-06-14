import {state} from './state.js';
import {playerPos} from './player.js';
import {message} from './hud.js';
import {animatePed} from './entities.js';
import {blip} from './audio.js';
import {camera} from './engine.js';
import {Interior} from './interior.js';
import {buyWeapon,ownsWeapon,beginTrainingWeapon,clearTrainingWeapon,
  getTrainingWeaponId,isTrainingWeaponActive} from './weapons.js';
import {GUNSHOP_DOOR,GUNSHOP_SPAWN_OUT,INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,
  SHOP_CENTER,RANGE_CENTER,SHOP_BOUNDS,RANGE_BOUNDS,RANGE_ENTRY,RANGE_RETURN,
  RANGE_SPAWN,RANGE_EXIT,GUN_SHOP_ITEMS,GUN_RANGE_ITEMS,GUN_RANGE_TARGETS,
  gunShopFx,gunShopInterior,gunRangeInterior} from '../assets/models/city/gun-shop.js';

// Loja de armas "AMMO DEPOT": estende a classe base de interiores
// (js/interior.js), que já cuida de porta/teleporte/limite do mundo/câmera/
// saída de emergência. Particularidade daqui: chegar perto de uma arma no
// balcão e COMPRAR por um preço (catálogo). As armas giram na vitrine e a
// etiqueta do nome fica sempre virada pra câmera.
//
// A compra é por CONFIRMAÇÃO em dois toques de E (igual ao prompt de entrar/sair
// do carro, sem popup): o 1º E pede pra confirmar aquela arma, o 2º E compra.
// Sair de perto cancela. `pending` guarda o id da arma aguardando confirmação.

const BUY_RANGE=2.8; // distância pra liberar a compra de uma arma do balcão
const TRAIN_RANGE=2.25; // distância pra pegar uma arma de treino no chão
let pending=null;    // arma aguardando o 2º E (confirmação)
let rangeActive=false;

class GunShopInterior extends Interior{
  onEnter(){
    rangeActive=false;
    Object.assign(this.bounds,SHOP_BOUNDS);
    Object.assign(this.center,SHOP_CENTER);
    gunShopInterior.visible=true;
    gunRangeInterior.visible=false;
    message('AMMO DEPOT - BUY WEAPONS OR USE THE RANGE ROOM','var(--gold)');
    blip([330,440,587],.08,'square',.12);
  }
  onExit(){
    pending=null;
    clearTrainingWeapon();
    rangeActive=false;
    gunRangeInterior.visible=false;
    Object.assign(this.bounds,SHOP_BOUNDS);
    Object.assign(this.center,SHOP_CENTER);
  }
  updateFx(dt){
    const pp=playerPos();
    if(!rangeActive){
      for(const p of gunShopFx.displays)p.rotation.y+=dt*1.1; // arma girando na vitrine
    }
    if(isTrainingWeaponActive()&&!rangeActive){
      clearTrainingWeapon();
      message('RANGE WEAPON RETURNED','var(--gold)');
    }
    const activeTrain=getTrainingWeaponId();
    for(const p of gunShopFx.rangePickups||[]){
      const held=activeTrain===p.id;
      p.pivot.visible=!held;
      p.marker.visible=!held;
      if(!held){
        p.pivot.position.y=.07+Math.sin(state.time*3+p.id.length)*.025;
        p.marker.material.opacity=.35+.18*Math.sin(state.time*4+p.id.length);
      }
    }
    const door=gunShopFx.rangeDoor;
    if(door){
      const d=Math.hypot(pp.x-RANGE_ENTRY.x,pp.z-RANGE_ENTRY.z);
      const target=(!rangeActive&&d<3.2)?1:0;
      door.open+=(target-door.open)*Math.min(1,dt*7);
      door.pivot.rotation.y=-door.open*1.35;
    }
    if(!rangeActive&&gunShopFx.rangeEntryArrow)
      gunShopFx.rangeEntryArrow.position.y=1.7+Math.sin(state.time*3.4)*.16;
    if(rangeActive&&gunShopFx.rangeExitArrow)
      gunShopFx.rangeExitArrow.position.y=1.7+Math.sin(state.time*3)*.18;
    for(const t of gunShopFx.rangeTargets||[]){
      if(t.hitT>0){
        t.hitT=Math.max(0,t.hitT-dt);
        if(t.hitT<=0)t.g.material.color.setHex(0xffffff);
      }
    }
    if(!rangeActive){
      // etiquetas sempre de frente pra câmera (billboard só no eixo Y)
      for(const lb of gunShopFx.labels)
        lb.rotation.y=Math.atan2(camera.position.x-lb.position.x,camera.position.z-lb.position.z);
      const k=gunShopFx.keeper;
      if(k){k.t+=dt;animatePed(k.g,k.t*1.4,.12);}
    }
    // afastou da arma (ou foi pra outra) com uma confirmação pendente: cancela
    if(pending&&!rangeActive){
      const it=nearItem();
      if(!it||it.id!==pending){pending=null;message('PURCHASE CANCELLED','var(--pink)');}
    }
  }
}

export const gunShop=new GunShopInterior({
  group:gunShopInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:GUNSHOP_DOOR,spawnOut:GUNSHOP_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:gunShopFx,
  exterior:{x:-110,z:66,r:24}, // fachada: gangue não chega perto
  mapIcon:{id:'gun-shop',label:'AMMO DEPOT',icon:'gun',color:'#f5c518'},
});

// arma do balcão mais perto do jogador (só dentro da loja)
function nearItem(){
  if(!gunShop.active||rangeActive)return null;
  const pp=playerPos();
  let best=null,bd=BUY_RANGE;
  for(const it of GUN_SHOP_ITEMS){
    const d=Math.hypot(pp.x-it.x,pp.z-it.z);
    if(d<bd){bd=d;best=it;}
  }
  return best;
}
function nearTrainingWeapon(){
  if(!gunShop.active||!rangeActive)return null;
  const pp=playerPos();
  let best=null,bd=TRAIN_RANGE;
  for(const it of GUN_RANGE_ITEMS){
    const d=Math.hypot(pp.x-it.x,pp.z-it.z);
    if(d<bd){bd=d;best=it;}
  }
  return best;
}
function nearRangeEntry(){
  if(!gunShop.active||rangeActive)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-RANGE_ENTRY.x,pp.z-RANGE_ENTRY.z)<2.45;
}
function nearRangeExit(){
  if(!gunShop.active||!rangeActive)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-RANGE_EXIT.x,pp.z-RANGE_EXIT.z)<2.5;
}
function setShopRoom(){
  Object.assign(gunShop.bounds,SHOP_BOUNDS);
  Object.assign(gunShop.center,SHOP_CENTER);
}
function setRangeRoom(){
  Object.assign(gunShop.bounds,RANGE_BOUNDS);
  Object.assign(gunShop.center,RANGE_CENTER);
}
function enterRangeRoom(){
  if(!gunShop.active||rangeActive)return false;
  pending=null;
  rangeActive=true;
  setRangeRoom();
  gunShopInterior.visible=false;
  gunRangeInterior.visible=true;
  gunShop.teleport(RANGE_SPAWN.x,RANGE_SPAWN.z,Math.PI/2);
  message('SHOOTING RANGE - PICK ONE TRAINING WEAPON','var(--gold)');
  blip([330,440,587],.07,'square',.13);
  return true;
}
function exitRangeRoom(){
  if(!gunShop.active||!rangeActive)return false;
  pending=null;
  const returned=clearTrainingWeapon();
  rangeActive=false;
  setShopRoom();
  gunRangeInterior.visible=false;
  gunShopInterior.visible=true;
  gunShop.teleport(RANGE_RETURN.x,RANGE_RETURN.z,-Math.PI/2);
  message(returned?'RANGE WEAPON RETURNED':'RETURNED TO AMMO DEPOT','var(--gold)');
  blip([300,240],.05,'square',.1);
  return true;
}
export function inGunShopRange(){
  return gunShop.active&&rangeActive;
}
export const gunShopTargets=()=>inGunShopRange()?GUN_RANGE_TARGETS:[];

// Rótulo do HUD (prompt na base, igual ao de entrar/sair do carro). Mostra
// BUY $X normalmente, vira CONFIRM quando aquela arma está aguardando o 2º E,
// ou OWNED/NEED $X conforme o caso. Null quando não há arma por perto.
export function gunShopState(){
  if(nearRangeExit())
    return{label:'EXIT',prompt:'RETURN TO AMMO DEPOT',enabled:true};
  if(nearRangeEntry())
    return{label:'RANGE',prompt:'ENTER SHOOTING RANGE',enabled:true};
  const tr=nearTrainingWeapon();
  if(tr){
    const active=getTrainingWeaponId();
    if(active===tr.id)return{label:'RANGE',prompt:`USING ${tr.name} - LEAVE RANGE TO RETURN`,enabled:false};
    return{label:active?'SWAP':'PICK',prompt:`${active?'SWAP TO':'PICK UP'} ${tr.name}`,enabled:true};
  }
  const it=nearItem();
  if(!it)return null;
  if(ownsWeapon(it.id))return{label:'OWNED',prompt:`${it.name} - ALREADY OWNED`,enabled:false};
  if(state.money<it.price)return{label:'BUY',prompt:`NEED $${it.price} - ${it.name}`,enabled:false};
  if(pending===it.id)
    return{label:'CONFIRM',prompt:`CONFIRM: BUY ${it.name} $${it.price}`,enabled:true};
  return{label:'BUY',prompt:`BUY ${it.name} $${it.price}`,enabled:true};
}

// Interação com a arma (chamada pelo performInteract). 1º E pede confirmação;
// 2º E (na mesma arma) compra de fato. Devolve true se consumiu a interação.
export function gunShopBuy(){
  if(nearRangeExit())return exitRangeRoom();
  if(nearRangeEntry())return enterRangeRoom();
  const tr=nearTrainingWeapon();
  if(tr){
    beginTrainingWeapon(tr.id);
    pending=null;
    message(`TRAINING WITH ${tr.name} - LEAVE RANGE TO RETURN IT`,'var(--gold)');
    return true;
  }
  const it=nearItem();
  if(!it){pending=null;return false;}
  if(ownsWeapon(it.id)){message(`YOU ALREADY OWN THE ${it.name}`,'var(--pink)');pending=null;return true;}
  if(state.money<it.price){message(`NOT ENOUGH MONEY - NEED $${it.price}`,'var(--pink)');pending=null;return true;}
  if(pending!==it.id){ // 1º toque: pede confirmação
    pending=it.id;
    message(`BUY ${it.name} FOR $${it.price}? PRESS E TO CONFIRM, WALK AWAY TO CANCEL`,'var(--gold)');
    blip([440,560],.06,'square',.12);
    return true;
  }
  // 2º toque na mesma arma: confirma a compra
  pending=null;
  state.money-=it.price;
  buyWeapon(it.id);
  message(`BOUGHT ${it.name}`,'var(--gold)');
  blip([330,440,587,660],.09,'square',.16);
  return true;
}
