import {state} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {playerPos} from '@/actors/player.ts';
import {message} from '@/ui/hud.ts';
import {animatePed} from '@/core/entities.ts';
import {blip} from '@/audio/audio.ts';
import {camera} from '@/core/engine.ts';
import {Interior} from '@/world/interior.ts';
import {nameInteriorNpc} from '@/actors/npc.ts';
import {solids} from '@/world/solids.ts';
import {buyWeapon,ownsWeapon,weaponAmmoInfo,refillAmmo,beginTrainingWeapon,
  clearTrainingWeapon,getTrainingWeaponId,isTrainingWeaponActive} from '@/combat/weapons.ts';
import {GUNSHOP_DOOR,GUNSHOP_SPAWN_OUT,GUNSHOP_SITE,addGunShop,INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,
  SHOP_CENTER,RANGE_CENTER,SHOP_BOUNDS,RANGE_BOUNDS,RANGE_ENTRY,RANGE_RETURN,
  RANGE_SPAWN,RANGE_EXIT,GUN_SHOP_ITEMS,GUN_RANGE_ITEMS,GUN_RANGE_TARGETS,
  gunShopFx,gunShopInterior,gunRangeInterior} from '../../assets/models/city/gun-shop.ts';

// Loja de armas "AMMO DEPOT": estende a classe base de interiores
// (js/world/interior.ts), que já cuida de porta/teleporte/limite do mundo/câmera/
// saída de emergência. Particularidade daqui: chegar perto de uma arma no
// balcão e COMPRAR por um preço (catálogo). As armas giram na vitrine e a
// etiqueta do nome fica sempre virada pra câmera.
//
// A compra é por CONFIRMAÇÃO em dois toques de E (igual ao prompt de entrar/sair
// do carro, sem popup): o 1º E pede pra confirmar, o 2º E compra. Sair de perto
// cancela. `pending` guarda o id do item aguardando confirmação.
//
// O PREÇO aparece sempre — na etiqueta da arma na vitrine (mesmo sem grana) e no
// prompt do balcão. Já tem a arma? No MESMO balcão a oferta vira RECARGA de
// MUNIÇÃO (mais barata que a arma), também com confirmação em dois toques.

const BUY_RANGE=2.8; // distância pra liberar a compra de uma arma do balcão
const TRAIN_RANGE=2.25; // distância pra pegar uma arma de treino no chão
let pending:string|null=null;    // item (arma ou munição) aguardando o 2º E (confirmação)
let rangeActive=false;

// Preço da recarga de munição de uma arma já possuída: uma fração do preço da
// arma (recarregar sai bem mais barato que recomprar), com piso pra armas baratas.
function ammoPrice(weaponPrice:number):number{return Math.max(20,Math.round(weaponPrice*0.3));}

class GunShopInterior extends Interior{
  override onEnter():void{
    rangeActive=false;
    Object.assign(this.bounds,SHOP_BOUNDS);
    Object.assign(this.center,SHOP_CENTER);
    gunShopInterior.visible=true;
    gunRangeInterior.visible=false;
    message('LOJA DE ARMAS - COMPRE ARMAS OU USE O ESTANDE DE TIRO','var(--gold)');
    blip([330,440,587],.08,'square',.12);
  }
  override onExit():void{
    pending=null;
    clearTrainingWeapon();
    rangeActive=false;
    gunRangeInterior.visible=false;
    Object.assign(this.bounds,SHOP_BOUNDS);
    Object.assign(this.center,SHOP_CENTER);
  }
  override updateFx(dt:number):void{
    const pp=playerPos();
    if(!rangeActive){
      for(const p of gunShopFx.displays)p.rotation.y+=dt*1.1; // arma girando na vitrine
    }
    if(isTrainingWeaponActive()&&!rangeActive){
      clearTrainingWeapon();
      message('ARMA DO ESTANDE DEVOLVIDA','var(--gold)');
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
      if(!it||it.id!==pending){pending=null;message('COMPRA CANCELADA','var(--pink)');}
    }
  }
}

addGunShop(solids); // the shop on its Rua Barão do Rio Branco lot + the off-map rooms

export const gunShop=new GunShopInterior({
  group:gunShopInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:GUNSHOP_DOOR,spawnOut:GUNSHOP_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:gunShopFx,
  exterior:{...GUNSHOP_SITE.P(-110,66),r:24}, // fachada: gangue não chega perto
  spawnOutHeading:GUNSHOP_SITE.head(-Math.PI/2), // stepping out faces the street
  mapIcon:{id:'gun-shop',label:'LOJA DE ARMAS',icon:'gun',color:'#f5c518'},
});

// Give the gun-shop clerk a name (women get the female look).
if(gunShopFx.keeper)nameInteriorNpc(gunShopFx.keeper.g,'clerk','Loja de Armas');

// arma do balcão mais perto do jogador (só dentro da loja)
function nearItem():any{
  if(!gunShop.active||rangeActive)return null;
  const pp=playerPos();
  let best:any=null,bd=BUY_RANGE;
  for(const it of GUN_SHOP_ITEMS){
    const d=Math.hypot(pp.x-it.x,pp.z-it.z);
    if(d<bd){bd=d;best=it;}
  }
  return best;
}
function nearTrainingWeapon():any{
  if(!gunShop.active||!rangeActive)return null;
  const pp=playerPos();
  let best:any=null,bd=TRAIN_RANGE;
  for(const it of GUN_RANGE_ITEMS){
    const d=Math.hypot(pp.x-it.x,pp.z-it.z);
    if(d<bd){bd=d;best=it;}
  }
  return best;
}
function nearRangeEntry():boolean{
  if(!gunShop.active||rangeActive)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-RANGE_ENTRY.x,pp.z-RANGE_ENTRY.z)<2.45;
}
function nearRangeExit():boolean{
  if(!gunShop.active||!rangeActive)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-RANGE_EXIT.x,pp.z-RANGE_EXIT.z)<2.5;
}
function setShopRoom():void{
  Object.assign(gunShop.bounds,SHOP_BOUNDS);
  Object.assign(gunShop.center,SHOP_CENTER);
}
function setRangeRoom():void{
  Object.assign(gunShop.bounds,RANGE_BOUNDS);
  Object.assign(gunShop.center,RANGE_CENTER);
}
function enterRangeRoom():boolean{
  if(!gunShop.active||rangeActive)return false;
  pending=null;
  rangeActive=true;
  setRangeRoom();
  gunShopInterior.visible=false;
  gunRangeInterior.visible=true;
  gunShop.teleport(RANGE_SPAWN.x,RANGE_SPAWN.z,Math.PI/2);
  message('ESTANDE DE TIRO - ESCOLHA UMA ARMA DE TREINO','var(--gold)');
  blip([330,440,587],.07,'square',.13);
  return true;
}
function exitRangeRoom():boolean{
  if(!gunShop.active||!rangeActive)return false;
  pending=null;
  const returned=clearTrainingWeapon();
  rangeActive=false;
  setShopRoom();
  gunRangeInterior.visible=false;
  gunShopInterior.visible=true;
  gunShop.teleport(RANGE_RETURN.x,RANGE_RETURN.z,-Math.PI/2);
  message(returned?'ARMA DO ESTANDE DEVOLVIDA':'DE VOLTA À LOJA DE ARMAS','var(--gold)');
  blip([300,240],.05,'square',.1);
  return true;
}
export function inGunShopRange():boolean{
  return gunShop.active&&rangeActive;
}
export const gunShopTargets=()=>inGunShopRange()?GUN_RANGE_TARGETS:[];

// Rótulo do HUD (prompt na base, igual ao de entrar/sair do carro). Mostra
// BUY $X normalmente, vira CONFIRM aguardando o 2º E, e o preço aparece MESMO
// sem grana (NEED $X). Já possui a arma? Vira BUY AMMO $X (ou FULL/OWNED).
// Null quando não há arma por perto.
export function gunShopState(){
  if(nearRangeExit())
    return{label:'SAIR',prompt:'VOLTAR À LOJA DE ARMAS',enabled:true};
  if(nearRangeEntry())
    return{label:'ESTANDE',prompt:'ENTRAR NO ESTANDE DE TIRO',enabled:true};
  const tr=nearTrainingWeapon();
  if(tr){
    const active=getTrainingWeaponId();
    if(active===tr.id)return{label:'ESTANDE',prompt:`USANDO ${tr.name} - SAIA DO ESTANDE PARA DEVOLVER`,enabled:false};
    return{label:active?'TROCAR':'PEGAR',prompt:`${active?'TROCAR POR':'PEGAR'} ${tr.name}`,enabled:true};
  }
  const it=nearItem();
  if(!it)return null;
  // já possui: no MESMO balcão a oferta vira RECARGA de munição (não recompra)
  if(ownsWeapon(it.id)){
    const info=weaponAmmoInfo(it.id);
    if(!info||info.infinite)return{label:'JÁ TEM',prompt:`${it.name} - VOCÊ JÁ TEM`,enabled:false};
    if(info.full)return{label:'CHEIA',prompt:`${it.name} - MUNIÇÃO CHEIA`,enabled:false};
    const ap=ammoPrice(it.price);
    // preço sempre visível, mesmo sem grana (prompt fica ativo só pra informar)
    if(state.money<ap)return{label:'MUNIÇÃO',prompt:`PRECISA DE R$${ap} PARA MUNIÇÃO DE ${it.name}`,enabled:true};
    if(pending===it.id)return{label:'CONFIRMAR',prompt:`CONFIRMAR: MUNIÇÃO DE ${it.name} R$${ap}`,enabled:true};
    return{label:'MUNIÇÃO',prompt:`COMPRAR MUNIÇÃO DE ${it.name} R$${ap}`,enabled:true};
  }
  // não possui: compra a arma — preço SEMPRE visível, mesmo sem grana pra comprar
  if(state.money<it.price)return{label:'COMPRAR',prompt:`PRECISA DE R$${it.price} PARA ${it.name}`,enabled:true};
  if(pending===it.id)
    return{label:'CONFIRMAR',prompt:`CONFIRMAR: COMPRAR ${it.name} R$${it.price}`,enabled:true};
  return{label:'COMPRAR',prompt:`COMPRAR ${it.name} R$${it.price}`,enabled:true};
}

// Interação com a arma (chamada pelo performInteract). 1º E pede confirmação;
// 2º E (no mesmo item) compra de fato. Já possui a arma? Compra MUNIÇÃO em vez
// de recomprar — mesma confirmação em dois toques. Devolve true se consumiu E.
export function gunShopBuy():boolean{
  if(nearRangeExit())return exitRangeRoom();
  if(nearRangeEntry())return enterRangeRoom();
  const tr=nearTrainingWeapon();
  if(tr){
    beginTrainingWeapon(tr.id);
    pending=null;
    message(`TREINANDO COM ${tr.name} - SAIA DO ESTANDE PARA DEVOLVER`,'var(--gold)');
    return true;
  }
  const it=nearItem();
  if(!it){pending=null;return false;}
  // já possui: compra MUNIÇÃO (recarga) com a mesma confirmação em dois toques
  if(ownsWeapon(it.id)){
    const info=weaponAmmoInfo(it.id);
    if(!info||info.infinite){message(`VOCÊ JÁ TEM ${it.name}`,'var(--pink)');pending=null;return true;}
    if(info.full){message(`A MUNIÇÃO DE ${it.name} JÁ ESTÁ CHEIA`,'var(--pink)');pending=null;return true;}
    const ap=ammoPrice(it.price);
    if(state.money<ap){message(`DINHEIRO INSUFICIENTE - PRECISA DE R$${ap}`,'var(--pink)');pending=null;return true;}
    if(pending!==it.id){ // 1º toque: pede confirmação
      pending=it.id;
      message(`COMPRAR MUNIÇÃO DE ${it.name} POR R$${ap}? APERTE E PARA CONFIRMAR, AFASTE-SE PARA CANCELAR`,'var(--gold)');
      blip([440,560],.06,'square',.12);
      return true;
    }
    // 2º toque no mesmo balcão: confirma a recarga
    pending=null;
    economy.spend(ap,'ammo');
    refillAmmo(it.id);
    message(`MUNIÇÃO DE ${it.name} REABASTECIDA`,'var(--gold)');
    blip([330,440,587,660],.09,'square',.16);
    return true;
  }
  // não possui: compra a arma (confirmação em dois toques)
  if(state.money<it.price){message(`DINHEIRO INSUFICIENTE - PRECISA DE R$${it.price}`,'var(--pink)');pending=null;return true;}
  if(pending!==it.id){ // 1º toque: pede confirmação
    pending=it.id;
    message(`COMPRAR ${it.name} POR R$${it.price}? APERTE E PARA CONFIRMAR, AFASTE-SE PARA CANCELAR`,'var(--gold)');
    blip([440,560],.06,'square',.12);
    return true;
  }
  // 2º toque na mesma arma: confirma a compra
  pending=null;
  economy.spend(it.price,'weapon');
  buyWeapon(it.id);
  message(`COMPROU ${it.name}`,'var(--gold)');
  blip([330,440,587,660],.09,'square',.16);
  return true;
}
