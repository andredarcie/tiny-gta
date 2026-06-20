// ---------------------------------------------------------------------------
// Drug bust — the crooked-cop shakedown.
//
// Getting busted (js/actors/player.ts getBusted) normally books the player into the
// county jail. But if they're caught wearing the weed DELIVERY BACKPACK, jail is
// the wrong outcome: a bent cop hauls them out to the middle of the rural woods,
// runs a full story-style cut-scene (cinema bars, scripted camera, typed
// dialogue — see js/story/story.ts playCutscene), and lets them walk for a bribe. The
// stash is seized either way. No booking happens, so weapons are NOT confiscated.
//
// Wired in via refs (refs.isCarryingDrugs / refs.startDrugBust) so player.js
// stays decoupled from the weed-farm + cut-scene machinery.
// ---------------------------------------------------------------------------
import type * as THREE from 'three';
import {scene} from '@/core/engine.ts';
import {state,refs} from '@/core/state.ts';
import {player} from '@/actors/player.ts';
import {playCutscene} from '@/story/story.ts';
import {makePed} from '@/core/entities.ts';
import {economy} from '@/core/economy.ts';
import {message} from '@/ui/hud.ts';
import {groundHeight,RURAL_X0} from '@/core/constants.ts';

// A forest clearing deep in the western countryside — off the road, clear of the
// mountain (x~509), the village (x=650) and the ploughed fields (x>332).
const WOODS={x:RURAL_X0+95,z:86};
// Gruff, low cop voice for the typed-dialogue beeps.
const COP_VOICE:{freq:number;type:OscillatorType}={freq:96,type:'sawtooth'};

let copPed: THREE.Object3D | null = null;

// Is the player right now carrying the drug delivery backpack? (weed-farm.js)
export function isCarryingDrugs(){
  const ws=refs.getWeedFarmState?.();
  return !!(ws&&ws.pack&&ws.pack.active);
}

// The shakedown fee: scales with the haul, with a floor, capped at what the
// player can actually pay (a broke player just loses the stash).
function bribeFor(val: number){
  const want=Math.max(300,Math.round((val||0)*.8));
  return Math.min(want,Math.max(0,Math.floor(state.money)));
}

// Sarcastic back-and-forth. Lines are speaker-prefixed (the cut-scene engine
// shows one line at a time with no name tag, so the prefix makes who's talking
// obvious). The cop's demand carries the real bribe number.
function buildLines(bribe: number){
  const lines=[
    "OFFICER: Evening. Funny spot for a stroll — middle of nowhere, great big backpack.",
    "YOU: Birdwatching. Real rare birds out this way, officer.",
    "OFFICER: Birds. Sure. So you won't mind me peeking inside the little pharmacy you're wearing?",
    "YOU: Okay, okay. It's not what it looks like. It's exactly what it looks like.",
    "OFFICER: Caught you red-handed, kid — pack stuffed to the zipper. That's a long, long vacation.",
    "YOU: Or... I make a generous, fully tax-deductible donation to the policeman's wallet fund?",
  ];
  if(bribe>0){
    lines.push(`OFFICER: Now you're speaking my language. $${bribe}, and this little forest never happened.`);
    lines.push("YOU: Pleasure doing business. You never saw me, I never saw your second income.");
  }else{
    lines.push("OFFICER: Broke too? Tragic. Fine — I'll keep the merchandise and we'll call it even.");
    lines.push("YOU: A robbery AND a lecture. Best night ever.");
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
  // each other and frames the shot).
  copPed=makePed(0x21407e,0x141d35); // dark-blue uniform reads as police
  const cx=WOODS.x+2.6,cz=WOODS.z+.5;
  copPed.position.set(cx,groundHeight(cx,cz),cz);
  scene.add(copPed);

  playCutscene(copPed,COP_VOICE,buildLines(bribe),()=>finishDrugBust(bribe));
}

function finishDrugBust(bribe: number){
  if(copPed){copPed.parent?.remove(copPed);copPed=null;}
  if(bribe>0)economy.spend(bribe,'bribe');
  refs.seizeDrugBackpack?.(); // the cop pockets the stash; ends the delivery run
  state.mode='foot';
  message(bribe>0
    ?`YOU PAID THE COP $${bribe}. STASH SEIZED — NOW WALK HOME.`
    :'THE COP TOOK YOUR STASH AND LEFT YOU IN THE WOODS.','var(--blue)');
}

refs.isCarryingDrugs=isCarryingDrugs;
refs.startDrugBust=startDrugBust;
