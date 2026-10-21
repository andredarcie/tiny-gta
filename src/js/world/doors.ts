import {state} from '@/core/state.ts';
import {playerPos} from '@/actors/player.ts';
import {nearestDoor} from '@/world/interior.ts';
import {groundHeight} from '@/core/constants.ts';

// Open-world doors: no button — touch the door and you are through. Each place's
// street door takes you into its room, the door inside takes you back out (see
// js/world/interior.ts). The latch stops the ping-pong: after crossing, the player
// lands inside the trigger on the other side and it only fires again once they have
// stepped out of every trigger.
let latch=true;

export function updateDoors():void{
  if(state.mode!=='foot'||state.controlsLocked||state.dlgActive||state.cine){latch=true;return;}
  const pp=playerPos();
  // falling/flying past a door doesn't count as touching it
  const it=pp.y-groundHeight(pp.x,pp.z)>1.5?null:nearestDoor();
  if(!it){latch=false;return;}
  if(latch)return;
  latch=true;
  it.doorInteract();
}
