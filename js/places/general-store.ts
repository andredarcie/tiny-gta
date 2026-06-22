import {state,refs} from '@/core/state.ts';
import {economy} from '@/core/economy.ts';
import {playerPos} from '@/actors/player.ts';
import {message} from '@/ui/hud.ts';
import {animatePed} from '@/core/entities.ts';
import {blip} from '@/audio/audio.ts';
import {Interior} from '@/world/interior.ts';
import {STRAINS,STRAIN_BY_ID,FERTILIZER} from '@/activities/strains.ts';
import type {Strain} from '@/activities/strains.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {generalStoreInterior,genStoreFx,GENSTORE_DOOR,GENSTORE_SPAWN_OUT,
  INT_CENTER,INT_DOOR,INT_SPAWN,INT_BOUNDS,SEED_DISPLAYS,FERT_DISPLAY}
  from '../../assets/models/rural/general-store.ts';

// GENERAL STORE — the rural village's walk-in shop. Extends the base Interior
// (js/world/interior.ts handles door/teleport/world-limit/camera/emergency-exit); the
// extra behavior is BUYING SEEDS at the counter.
//
// Like the gun-shop, the counter has SEVERAL displays — one per cannabis strain
// (js/activities/strains.ts). Walk up to a display and the prompt offers THAT strain; press E
// to buy a pack. Seeds go into state.seeds[strain] and that strain becomes the one
// the weed farm plants next (state.seedSel). Each strain has its own price and its
// own grow-op mechanics (see js/activities/weed-farm.ts).
//
// Single-tap buy (seeds are cheap consumables bought in bulk, so a confirm step
// would just be friction). The prompt shows the strain, its traits, the price and
// how many of that strain are already in the bag.

const BUY_RANGE=1.4; // distance to a seed display that selects/enables it

class GeneralStoreInterior extends Interior{
  override onEnter(){
    message('GENERAL STORE - PICK A STRAIN AT THE SEED COUNTER','var(--gold)');
    blip([392,523,659],.08,'sine',.12);
  }
  override updateFx(dt:number){
    const k=genStoreFx.keeper;
    if(k){k.t+=dt;animatePed(k.g,k.t*1.2,.1);}
    for(const crate of genStoreFx.seedCrates||[]) // the seed crates sway gently
      crate.rotation.y=Math.sin(state.time*.6+crate.position.z)*.12;
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

// the strain whose display the player is standing at (nearest within BUY_RANGE), or null
function nearStrain():Strain|null{
  if(!generalStore.active)return null;
  const p=playerPos();
  let best:{id:string;x:number;z:number}|null=null,bd=BUY_RANGE;
  for(const d of SEED_DISPLAYS){
    const dd=Math.hypot(p.x-d.x,p.z-d.z);
    if(dd<bd){bd=dd;best=d;}
  }
  return best?STRAIN_BY_ID[best.id]:null;
}

function buySeeds(s:Strain){
  const price=REWARDS.weedFarm.seedPrices[s.id];
  if(!economy.spend(price,'seeds')){
    message(`NOT ENOUGH MONEY - NEED $${price}`,'var(--pink)');return;
  }
  state.seeds[s.id]=(state.seeds[s.id]|0)+s.pack;
  state.seedSel=s.id; // this strain is now the one the farm plants
  message(`BOUGHT ${s.pack} ${s.name} SEEDS - ${state.seeds[s.id]} IN THE BAG`,'var(--gold)');
  blip([523,659,784],.08,'square',.14);
}

// plant food at the corner feed-sacks
const nearFert=()=>{
  if(!generalStore.active)return false;
  const p=playerPos();
  return Math.hypot(p.x-FERT_DISPLAY.x,p.z-FERT_DISPLAY.z)<2.0;
};
function buyFert(){
  const price=REWARDS.weedFarm.fertilizerPrice;
  if(!economy.spend(price,'seeds')){
    message(`NOT ENOUGH MONEY - NEED $${price}`,'var(--pink)');return;
  }
  state.fertilizer=(state.fertilizer|0)+FERTILIZER.pack;
  message(`BOUGHT ${FERTILIZER.pack} PLANT FOOD - ${state.fertilizer} IN THE BAG`,'var(--gold)');
  blip([523,659,784],.08,'square',.14);
}

// ONE context-sensitive zone action: only fires inside the store, at a seed display.
// Works for both the HUD prompt and the E press through refs.zoneActions, so no edits
// to input.js / hud.js are needed (mode stays 'foot' inside an interior).
(refs.zoneActions||(refs.zoneActions=[])).push(()=>{
  if(state.mode!=='foot'||!generalStore.active)return null;
  const s=nearStrain();
  if(s){
    const have=state.seeds[s.id]|0;
    const price=REWARDS.weedFarm.seedPrices[s.id];
    if(state.money<price)
      return{label:'SEEDS',prompt:`NEED $${price} FOR ${s.name} SEEDS`,enabled:true,
        run:()=>message(`NOT ENOUGH MONEY - NEED $${price}`,'var(--pink)')};
    return{label:'SEEDS',prompt:`BUY ${s.pack} ${s.name} $${price} · ${s.blurb} (HAVE ${have})`,
      enabled:true,run:()=>buySeeds(s)};
  }
  if(nearFert()){
    const have=state.fertilizer|0;
    const price=REWARDS.weedFarm.fertilizerPrice;
    if(state.money<price)
      return{label:'FOOD',prompt:`NEED $${price} FOR PLANT FOOD`,enabled:true,
        run:()=>message(`NOT ENOUGH MONEY - NEED $${price}`,'var(--pink)')};
    return{label:'FOOD',prompt:`BUY ${FERTILIZER.pack} PLANT FOOD $${price} · ${FERTILIZER.blurb} (HAVE ${have})`,
      enabled:true,run:buyFert};
  }
  return null;
});

refs.getGeneralStoreState=()=>({active:generalStore.active,seeds:{...state.seeds},
  seedSel:state.seedSel,fertilizer:state.fertilizer|0});
