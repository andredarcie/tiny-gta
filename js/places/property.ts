import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {playerPos,idleCars} from '@/actors/player.ts';
import {makeCar,makeMotorcycle} from '@/core/entities.ts';
import {setRims,setSpoiler,setHood,setNeon} from '../../assets/models/vehicles/car-customs.ts';
import {message} from '@/ui/hud.ts';
import {blip} from '@/audio/audio.ts';
import {Interior} from '@/world/interior.ts';
import {arrowBob} from '../../assets/models/city/door-arrow.ts';
import {RANCH_CX,RANCH_CZ,RANCH_DOOR,RANCH_SPAWN_OUT,RANCH_SALE,GARAGE_PAD,
  INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,FOOD,HOUSE_PRICE,
  ranchFx,ranchInterior} from '../../assets/models/rural/ranch-house.ts';
import type * as THREE from 'three';

// Casa de campo COMPRÁVEL (safehouse estilo open-world). Estende a classe base de
// interiores (js/world/interior.ts), que já cuida de porta/teleporte/limite do
// mundo/câmera/saída de emergência. O que é só desta casa:
//   - COMPRA: placa FOR SALE na frente; só depois de paga a porta abre;
//   - GELADEIRA: comida que enche a vida (ação EAT lá dentro);
//   - GARAGEM: guarda um carro que volta salvo até depois de fechar o jogo.
// Posse e carro guardado persistem em localStorage (chave tinygta_property).

const PRICE=HOUSE_PRICE; // preço definido no modelo (e mostrado na placa)
const BUY_RANGE=2.6;
const FOOD_RANGE=2.0;
const PARK_RANGE=3.4;

// car: {type:'car'|'bike', color, name} + any MOD-GARAGE customs (cars only). The mods
// are stored so a tuned car keeps its look/engine when respawned from the garage — only
// non-stock values are saved (omitted = stock). Read from car-customs userData.mods.
interface SavedCar{
  type:'car'|'bike';color:number;name:string;
  rims?:number;        // wheel hub colour (setRims), omitted when stock
  spoiler?:string;     // 'lip'|'wing'|'gt', omitted when 'none'
  hood?:string;        // 'scoop'|'vents', omitted when 'stock'
  neon?:number;        // underglow colour, omitted when off
  speedMul?:number;    // engine tuning multiplier, omitted when stock (1.0)
}
interface SavedProperty{owned:boolean;car:SavedCar|null;}

// allow-lists so a tampered/old backend payload can't install a garbage part
const SPOILER_TYPES=['lip','wing','gt'];
const HOOD_TYPES=['scoop','vents'];

// the installed customs read straight off a live car group (car-customs writes them to
// userData.mods; the engine multiplier lives on userData.speedMul). Bikes have none.
function readCarMods(g:any):Partial<SavedCar>{
  const m=g.userData.mods||{},out:Partial<SavedCar>={};
  if(typeof m.rims==='number')out.rims=m.rims;
  if(typeof m.spoiler==='string'&&m.spoiler!=='none')out.spoiler=m.spoiler;
  if(typeof m.hood==='string'&&m.hood!=='stock')out.hood=m.hood;
  if(typeof m.neon==='number')out.neon=m.neon;
  if(typeof g.userData.speedMul==='number'&&g.userData.speedMul!==1)out.speedMul=g.userData.speedMul;
  return out;
}
// reapply the saved customs to a freshly built garage car (paint is already baked in by
// makeCar(color), so the body-coloured spoiler picks up the right hue).
function applyCarMods(g:THREE.Object3D,d:SavedCar):void{
  if(typeof d.rims==='number')setRims(g,d.rims);
  if(d.spoiler&&SPOILER_TYPES.includes(d.spoiler))setSpoiler(g,d.spoiler);
  if(d.hood&&HOOD_TYPES.includes(d.hood))setHood(g,d.hood);
  if(typeof d.neon==='number')setNeon(g,d.neon);
  if(typeof d.speedMul==='number')g.userData.speedMul=d.speedMul;
}

// veículo parado (idleCar) — wrapper recriado pra garagem
interface GarageVehicle{
  g:any;heading:number;speed:number;name:string;police:boolean;bike?:boolean;
}

// ----- persistência -----
const KEY='tinygta_property';
let saved:SavedProperty={owned:false,car:null};
try{const s=JSON.parse(localStorage.getItem(KEY) as string);if(s)saved=s;}catch(e){}
function persist():void{try{localStorage.setItem(KEY,JSON.stringify(saved));}catch(e){}}
let garageVehicle:GarageVehicle|null=null;

export const houseOwned=():boolean=>saved.owned;

class HouseInterior extends Interior{
  // a porta só "existe" depois de comprada
  override near():'enter'|'exit'|null{if(!saved.owned)return null;return super.near();}
  override onEnter():void{
    message(state.health<100?'HOME SWEET HOME - GRAB A BITE FROM THE FRIDGE'
                            :'HOME SWEET HOME','var(--gold)');
  }
  // roda SEMPRE (mesmo fora da sala): liga/desliga placas e seta da fachada
  override update(dt:number):void{
    if(ranchFx.saleSign)ranchFx.saleSign.visible=!saved.owned;
    if(ranchFx.soldSign)ranchFx.soldSign.visible=false;
    if(ranchFx.facadeArrow){
      ranchFx.facadeArrow.visible=saved.owned;
      if(saved.owned)ranchFx.facadeArrow.position.y=1.7+arrowBob(state.time);
    }
    super.update(dt);
  }
  override updateFx(dt:number):void{
    if(ranchFx.food){ // comida girando/flutuando, igual ao kit do hospital
      ranchFx.food.rotation.y+=dt*1.6;
      ranchFx.food.position.y=1.2+Math.sin(state.time*3)*.1;
    }
    if(ranchFx.tv){
      const tvMat=ranchFx.tv.material as THREE.MeshBasicMaterial;
      if(tvMat.map)tvMat.color.set(0xffffff);
      else{
        const hue=.58+.05*Math.sin(state.time*2.7);
        tvMat.color.setHSL(hue,.7,.42+.08*Math.sin(state.time*8));
      }
    }
  }
}

export const house=new HouseInterior({
  group:ranchInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:RANCH_DOOR,spawnOut:RANCH_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:ranchFx,exterior:{x:RANCH_CX,z:RANCH_CZ,r:16}, // gangue não chega perto da casa
  mapIcon:{id:'house',label:'SAFE HOUSE',icon:'house',color:'#9dff2e'},
  spawnOutHeading:Math.PI, // sai pela porta norte olhando pra frente do alpendre
});

// ===================== COMPRA =====================
function buyNear():boolean{
  if(state.mode!=='foot'||saved.owned)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-RANCH_SALE.x,pp.z-RANCH_SALE.z)<BUY_RANGE;
}
// rótulo do HUD perto da placa FOR SALE
export function houseBuyState(){
  if(!buyNear())return null;
  return state.money<PRICE
    ?{label:'BUY',prompt:`NEED $${PRICE} TO BUY THIS HOUSE`,enabled:false}
    :{label:'BUY',prompt:`BUY HOUSE $${PRICE}`,enabled:true};
}
// ação de compra (chamada pelo performInteract a pé). true = consumiu a interação.
export function houseBuy():boolean{
  if(!buyNear())return false;
  if(state.money<PRICE){message(`NOT ENOUGH MONEY - NEED $${PRICE}`,'var(--pink)');return true;}
  economy.spend(PRICE,'property');
  saved.owned=true;persist();
  message('PROPERTY PURCHASED! THE HOUSE IS YOURS','var(--gold)');
  blip([392,523,659,784],.1,'square',.18);
  return true;
}

// ===================== GELADEIRA (cura) =====================
function foodNear():boolean{
  if(!house.active||state.mode!=='foot')return false;
  const pp=playerPos();
  return Math.hypot(pp.x-FOOD.x,pp.z-FOOD.z)<FOOD_RANGE;
}
export function houseEatState(){
  if(!foodNear())return null;
  return state.health>=100
    ?{label:'EAT',prompt:'ALREADY FULL HEALTH',enabled:false}
    :{label:'EAT',prompt:'EAT FROM THE FRIDGE',enabled:true};
}
export function houseEat():boolean{
  if(!foodNear())return false;
  if(state.health>=100){message('YOU ARE ALREADY FULL','var(--cyan)');return true;}
  state.health=100;
  message('NICE MEAL - FULLY HEALED','var(--cyan)');
  blip([523,659,784,1047],.09,'sine',.18);
  return true;
}

// ===================== GARAGEM =====================
// Recria o veículo salvo como carro parado normal (idleCar): dá pra entrar nele
// como em qualquer carro. Chamado no boot por initProperty.
function spawnGarageCar():void{
  const d=saved.car;if(!d)return;
  if(garageVehicle)return;
  const type=d.type==='bike'?'bike':'car';
  const color=Number.isFinite(d.color)?d.color:(type==='bike'?0xd11f3a:0xff2e88);
  const name=d.name||(type==='bike'?'GARAGE BIKE':'GARAGE CAR');
  const g=type==='bike'?makeMotorcycle(color):makeCar(color,false);
  if(type==='car')applyCarMods(g,d); // re-install the saved spoiler/rims/neon/hood/engine
  const heading=Math.PI; // nariz (+z) virado pro norte: pronto pra sair da garagem
  g.position.set(GARAGE_PAD.x,0,GARAGE_PAD.z);g.rotation.y=heading;
  const v:GarageVehicle={g,heading,speed:0,name,police:false};
  if(type==='bike')v.bike=true;
  garageVehicle=v;
  idleCars.push(v);
}

function replaceGarageVehicle(except:any=null):void{
  if(!garageVehicle||garageVehicle===except)return;
  const i=idleCars.indexOf(garageVehicle);
  if(i>=0)idleCars.splice(i,1);
  garageVehicle.g.parent?.remove(garageVehicle.g);
  garageVehicle=null;
}

function parkNear():boolean{
  if(state.mode!=='car'||!saved.owned)return false;
  const c=refs.getCur?.();
  if(!c||c.plane)return false;
  if(Math.abs(c.speed||0)>6)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-GARAGE_PAD.x,pp.z-GARAGE_PAD.z)<PARK_RANGE;
}
// rótulo do HUD quando o carro está parado dentro da garagem
export function houseGarageState(){
  if(!parkNear())return null;
  return{label:'PARK',prompt:'STORE CAR IN GARAGE',enabled:true};
}
// guarda o carro atual: salva a identidade e sai a pé (o carro vira idleCar aqui).
export function houseGaragePark():boolean{
  if(!parkNear())return false;
  const c=refs.getCur?.();
  if(!c)return false;
  replaceGarageVehicle(c);
  const type:'car'|'bike'=c.bike?'bike':'car';
  saved.car={type,color:c.g.userData.color??(type==='bike'?0xd11f3a:0xff2e88),
    name:c.name||(type==='bike'?'GARAGE BIKE':'GARAGE CAR'),
    ...(type==='car'?readCarMods(c.g):{})}; // keep its installed customs
  persist();
  message('CAR SAVED TO YOUR GARAGE','var(--gold)');
  blip([330,440,587],.08,'triangle',.14);
  garageVehicle=c as unknown as GarageVehicle;
  refs.exitCar?.();
  return true;
}

// chamado pelo main.js depois que os refs estão prontos
export function initProperty():void{
  if(saved.owned&&saved.car)spawnGarageCar();
}

// snapshot pro render_game_to_text
export function getHouseState(){
  return{owned:saved.owned,active:house.active,car:saved.car};
}

// ----- SAVE: posse da casa + carro da garagem (js/core/save.ts) -----
// A posse e o carro guardado já viviam em localStorage; aqui espelhamos no save
// do backend pra sobreviver à limpeza de dados / troca de dispositivo. O restore
// só ACRESCENTA (nunca tira a casa de quem já tem) e cria o carro da garagem se
// vier um e ainda não existir.
function sanitizeCar(c:any):SavedCar|null{
  if(!c||typeof c!=='object')return null;
  const type=c.type==='bike'?'bike':'car';
  const color=Number.isFinite(c.color)?c.color:(type==='bike'?0xd11f3a:0xff2e88);
  const name=(typeof c.name==='string'&&c.name)?c.name.slice(0,20):(type==='bike'?'GARAGE BIKE':'GARAGE CAR');
  const out:SavedCar={type,color,name};
  if(type==='car'){ // carry the customs through, validated so junk can't install a part
    if(Number.isFinite(c.rims))out.rims=c.rims;
    if(typeof c.spoiler==='string'&&SPOILER_TYPES.includes(c.spoiler))out.spoiler=c.spoiler;
    if(typeof c.hood==='string'&&HOOD_TYPES.includes(c.hood))out.hood=c.hood;
    if(Number.isFinite(c.neon))out.neon=c.neon;
    if(Number.isFinite(c.speedMul))out.speedMul=c.speedMul;
  }
  return out;
}
refs.getPropertySave=()=>({owned:!!saved.owned,car:saved.car||null});
refs.restoreProperty=(s:any)=>{
  if(!s||typeof s!=='object')return;
  let changed=false;
  if(s.owned&&!saved.owned){saved.owned=true;changed=true;}
  if(s.car&&!saved.car){const c=sanitizeCar(s.car);if(c){saved.car=c;changed=true;}}
  if(changed){persist();if(saved.owned&&saved.car)spawnGarageCar();}
};
