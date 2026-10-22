// ---------------------------------------------------------------------------
// Drug bust — the crooked-cop shakedown.
//
// Getting busted (js/actors/player.ts getBusted) normally books the player into the
// county jail. But if they're caught wearing the weed DELIVERY BACKPACK, jail is
// the wrong outcome: a bent cop hauls them out to the middle of the rural woods,
// runs a full story-style cut-scene (cinema bars, scripted camera, typed
// dialogue — see js/story/cutscene.ts playCutscene), and lets them walk for a bribe. The
// stash is seized either way. No booking happens, so weapons are NOT confiscated.
//
// Wired in via refs (refs.isCarryingDrugs / refs.startDrugBust) so player.js
// stays decoupled from the weed-farm + cut-scene machinery.
// ---------------------------------------------------------------------------
import {state,refs} from '@/core/state.ts';
import {NPC_HP_TOUGH} from '@/core/difficulty.ts';
import {player} from '@/actors/player.ts';
import {playCutscene} from '@/story/cutscene.ts';
import {makePed} from '@/core/entities.ts';
import {Npc} from '@/actors/npc.ts';
import {economy} from '@/core/economy.ts';
import {message} from '@/ui/hud.ts';
import {groundHeight} from '@/core/constants.ts';
import {REWARDS} from '@/core/minigame-rewards.ts';
import {roadside} from '@/world/divinolandia/nav.ts';

// A clearing in the eucalyptus woods west of the town, a little way off a dirt road.
const WOODS=roadside(-980,250,14);
// Gruff, low cop voice for the typed-dialogue beeps.
const COP_VOICE:{freq:number;type:OscillatorType}={freq:96,type:'sawtooth'};

// The bent cop is a one-scene actor, but still an Npc (so 100% of NPCs share the
// base class). register:false — it is a cut-scene puppet, never a weapon target.
let copNpc: Npc | null = null;

// Is the player right now carrying the drug delivery backpack? (weed-farm.js)
export function isCarryingDrugs(){
  const ws=refs.getWeedFarmState?.();
  return !!(ws&&ws.pack&&ws.pack.active);
}

// The shakedown fee: scales with the haul, with a floor, capped at what the
// player can actually pay (a broke player just loses the stash).
function bribeFor(val: number){
  const want=Math.max(REWARDS.drugBust.bribeMin,Math.round((val||0)*REWARDS.drugBust.bribeStashFraction));
  return Math.min(want,Math.max(0,Math.floor(state.money)));
}

// Sarcastic back-and-forth. Lines are speaker-prefixed (the cut-scene engine
// shows one line at a time with no name tag, so the prefix makes who's talking
// obvious). The cop's demand carries the real bribe number.
function buildLines(bribe: number){
  const lines=[
    "POLICIAL: Boa noite. Lugar engraçado pra passear — no meio do nada, com essa mochilona.",
    "VOCÊ: Observando passarinho. Tem uns bem raros por aqui, seu guarda.",
    "POLICIAL: Passarinho. Sei. Então não se importa se eu der uma olhada nessa farmacinha nas suas costas?",
    "VOCÊ: Tá bom, tá bom. Não é o que parece. É exatamente o que parece.",
    "POLICIAL: Te peguei no flagra, moleque — mochila cheia até o zíper. Isso dá umas férias bem longas.",
    "VOCÊ: Ou... eu faço uma doação generosa, dedutível do imposto, pro fundo da carteira do policial?",
  ];
  if(bribe>0){
    lines.push(`POLICIAL: Agora você tá falando a minha língua. R$${bribe}, e esse matinho aqui nunca existiu.`);
    lines.push("VOCÊ: Foi um prazer negociar. Você nunca me viu, eu nunca vi o seu bico.");
  }else{
    lines.push("POLICIAL: Duro também? Que tragédia. Beleza — eu fico com a mercadoria e a gente fica quite.");
    lines.push("VOCÊ: Um assalto E um sermão. Melhor noite da minha vida.");
  }
  return lines;
}

// Start the shakedown. Called from getBusted's branch once the player is on foot,
// the cops are cleared and wanted is zeroed (see js/actors/player.ts).
export function startDrugBust(){
  const ws=refs.getWeedFarmState?.();
  const val=Math.round((ws&&ws.pack&&ws.pack.val)||0);
  const bribe=bribeFor(val);

  // Dump the player in the woods clearing.
  const py=groundHeight(WOODS.x,WOODS.z);
  player.g.position.set(WOODS.x,py,WOODS.z);
  player.g.visible=true;

  // Spawn the bent cop right in front of them (startCutscene turns both to face
  // each other and frames the shot). makePed already adds it to the scene.
  const cop=makePed(0x21407e,0x141d35); // dark-blue uniform reads as police
  const cx=WOODS.x+2.6,cz=WOODS.z+.5;
  cop.position.set(cx,groundHeight(cx,cz),cz);
  copNpc=new Npc(cop,{kind:'officer',hp:NPC_HP_TOUGH,register:false,area:'Batida na estrada'});

  playCutscene(cop,COP_VOICE,buildLines(bribe),()=>finishDrugBust(bribe));
}

function finishDrugBust(bribe: number){
  if(copNpc){copNpc.despawn();copNpc=null;} // clears the scene + the NPC census
  if(bribe>0)economy.spend(bribe,'bribe');
  refs.seizeDrugBackpack?.(); // the cop pockets the stash; ends the delivery run
  state.mode='foot';
  message(bribe>0
    ?`VOCÊ PAGOU R$${bribe} PRO POLICIAL. A ERVA FOI APREENDIDA — AGORA VOLTA A PÉ.`
    :'O POLICIAL LEVOU SUA ERVA E TE LARGOU NO MATO.','var(--blue)');
}

refs.isCarryingDrugs=isCarryingDrugs;
refs.startDrugBust=startDrugBust;
