import {state,refs} from './state.js';
import {economy} from './economy.js';
import {playerPos} from './player.js';
import {message} from './hud.js';
import {animatePed} from './entities.js';
import {blip} from './audio.js';
import {Interior} from './interior.js';
import {generalStoreInterior,genStoreFx,GENSTORE_DOOR,GENSTORE_SPAWN_OUT,
  INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,SEED_COUNTER}
  from '../assets/models/rural/general-store.js';

// GENERAL STORE — the rural village's walk-in shop. Extends the base Interior
// (js/interior.js handles door/teleport/world-limit/camera/emergency-exit); the
// only extra behavior is BUYING SEEDS at the counter. Seeds (state.seeds) are
// what the weed farm needs to plant — see js/weed-farm.js, which now refuses to
// plant on an empty bed unless the player has seeds bought here.
//
// Buying is a single tap of E at the counter (seeds are cheap and bought in bulk,
// so a confirm step would just be friction). The prompt always shows the price
// and how many seeds are already in the bag.

const BUY_RANGE=3.0;              // distance to the seed counter that enables buying
export const SEED_PACK=3;         // seeds per purchase
export const SEED_PRICE=30;       // cost of one pack

class GeneralStoreInterior extends Interior{
  onEnter(){
    message('GENERAL STORE - BUY SEEDS AT THE COUNTER','var(--gold)');
    blip([392,523,659],.08,'sine',.12);
  }
  updateFx(dt){
    const k=genStoreFx.keeper;
    if(k){k.t+=dt;animatePed(k.g,k.t*1.2,.1);}
    const crate=genStoreFx.seedCrate;
    if(crate)crate.rotation.y=Math.sin(state.time*.6)*.12; // seed packets sway gently
  }
}

export const generalStore=new GeneralStoreInterior({
  group:generalStoreInterior,bounds:INT_BOUNDS,center:INT_CENTER,
  door:GENSTORE_DOOR,spawnOut:GENSTORE_SPAWN_OUT,intDoor:INT_DOOR,intSpawn:INT_SPAWN,
  fx:genStoreFx,
  exterior:{x:GENSTORE_DOOR.x,z:GENSTORE_DOOR.z,r:16}, // gang-free apron round the storefront
  mapIcon:{id:'general-store',label:'GENERAL STORE',icon:'store',color:'#f4c542'},
  spawnHeading:Math.PI/2,      // spawn just inside, facing east into the room
  spawnOutHeading:-Math.PI/2,  // exit looking west down the street (camera clears the body)
});

function buySeeds(){
  if(!economy.spend(SEED_PRICE,'seeds')){
    message(`NOT ENOUGH MONEY - NEED $${SEED_PRICE}`,'var(--pink)');return;
  }
  state.seeds=(state.seeds|0)+SEED_PACK;
  message(`BOUGHT ${SEED_PACK} SEEDS - ${state.seeds} IN THE BAG`,'var(--gold)');
  blip([523,659,784],.08,'square',.14);
}

// ONE context-sensitive zone action: only fires inside the store, by the counter.
// Works for both the HUD prompt and the E press through refs.zoneActions, so no
// edits to input.js / hud.js are needed (mode stays 'foot' inside an interior).
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='foot'||!generalStore.active)return null;
  const p=playerPos();
  if(Math.hypot(p.x-SEED_COUNTER.x,p.z-SEED_COUNTER.z)>BUY_RANGE)return null;
  if(state.money<SEED_PRICE)
    return{label:'SEEDS',prompt:`NEED $${SEED_PRICE} FOR ${SEED_PACK} SEEDS`,enabled:true,
      run:()=>message(`NOT ENOUGH MONEY - NEED $${SEED_PRICE}`,'var(--pink)')};
  return{label:'SEEDS',prompt:`BUY ${SEED_PACK} SEEDS $${SEED_PRICE} (HAVE ${state.seeds|0})`,
    enabled:true,run:buySeeds};
});

refs.getGeneralStoreState=()=>({active:generalStore.active,seeds:state.seeds|0});
