import * as THREE from 'three';
import {groundHeight,rand,wrapA,TOWN_CX} from '@/core/constants.ts';
import {state} from '@/core/state.ts';
import {scene} from '@/core/engine.ts';
import {makePed} from '@/core/entities.ts';
import {playerPos} from '@/actors/player.ts';
import {Npc} from '@/actors/npc.ts';
import {say} from '@/ui/speech.ts';
import {SHIRT_COLORS,PANTS_COLORS} from '@/core/palette.ts';
import priestModel from '../../assets/models/characters/priest.ts';

// ============================================================================
// PINE HOLLOW'S PRIEST and the grateful village — the story's third mission
// (js/story/story.ts). The priest waits at the door of the church at the head of the
// square; he tells the player how to lift the curse and hands over the holy water.
// When the player comes back with the job done, the villagers are KNEELING in a ring
// in front of the church, praying and hailing the player as their saviour.
// ============================================================================

// The church (Igreja do Divino, world.ts) stands at (TOWN_CX, 40) facing south; its
// front steps end at z≈33.8. The priest stands on them, looking out over the square.
export const PRIEST={x:TOWN_CX,z:32.2};
export const MEET={x:TOWN_CX,z:29.6};              // where the player stands to talk to him
const TALK_R=2.8;

let priest: Npc|null=null;
const crowd: Npc[]=[];
let cheerT=0;

export function spawnPriest(): void{
  if(priest)return;
  const g=priestModel.build();
  g.position.set(PRIEST.x,groundHeight(PRIEST.x,PRIEST.z),PRIEST.z);g.rotation.y=Math.PI;
  scene.add(g);
  priest=new Npc(g,{kind:'priest',register:false,showLabel:true,name:'Padre Anselmo',gender:'M',femaleLook:false,
    area:'Pine Hollow',personality:'friendly'});
}
export function removePriest(): void{priest?.despawn();priest=null;}
export const priestPed=(): THREE.Object3D|null=>priest?.g??null;
export function priestNear(): boolean{
  if(!priest)return false;
  const pp=playerPos();
  return Math.hypot(pp.x-PRIEST.x,pp.z-PRIEST.z)<TALK_R;
}

// Kneeling in prayer: thighs straight down, shins flat behind, hands together in front
// of the chest, head bowed. `raise` lifts both arms to the sky instead.
function kneel(g: THREE.Object3D,raise: number,bow: number): void{
  const l=g.userData.limbs;if(!l)return;
  l.leftLeg.rotation.set(-.08,0,0);l.rightLeg.rotation.set(-.08,0,0);
  l.leftCalf?.rotation.set(1.55,0,0);l.rightCalf?.rotation.set(1.55,0,0);
  const ax=-.55+(-2.35)*raise;
  l.rightArm.rotation.set(ax,0,-.35*(1-raise)-.2*raise);l.leftArm.rotation.set(ax,0,.35*(1-raise)+.2*raise);
  l.rightForearm?.rotation.set(-1.35*(1-raise),0,0);l.leftForearm?.rotation.set(-1.35*(1-raise),0,0);
  l.head.rotation.set(bow,0,0);
}

/** The villagers gather and kneel in a ring around the meeting spot. */
export function spawnCrowd(): void{
  clearCrowd();
  const N=9;
  for(let i=0;i<N;i++){
    // an arc around MEET, open toward the priest so he stays in sight
    const a=Math.PI*.5+(i/(N-1)-.5)*Math.PI*1.45;
    const r=3.1+rand(-.3,.4);
    const x=MEET.x+Math.cos(a)*r,z=MEET.z-Math.sin(a)*r;
    const g=makePed(SHIRT_COLORS[i%SHIRT_COLORS.length],PANTS_COLORS[(i*3)%PANTS_COLORS.length]);
    g.position.set(x,groundHeight(x,z)-.45,z);
    g.rotation.y=Math.atan2(MEET.x-x,MEET.z-z);
    const n=new Npc(g,{kind:'villager',register:false,area:'Pine Hollow',personality:'friendly'});
    (n as Npc&{phase: number}).phase=rand(0,6);
    kneel(g,0,.3);
    crowd.push(n);
  }
}
export function clearCrowd(): void{
  for(const n of crowd)n.despawn();
  crowd.length=0;
}
export const crowdOut=()=>crowd.length>0;

const CHEERS=['SALVADOR!','É ELE!','ABENÇOADO SEJA!','NOSSO HERÓI!','ELE NOS LIVROU DO MAL!','AMÉM!','OBRIGADO, SENHOR!'];
/** Crowd shouts, for the final scene (every kneeler hails the player at once). */
export function crowdCheer(): void{
  for(const n of crowd)say(n.g,CHEERS[Math.floor(Math.random()*CHEERS.length)],{life:3.2,yOff:2.1});
}

export function updatePriest(dt: number): void{
  if(!priest&&!crowd.length)return;
  const pp=playerPos();
  // the priest turns to whoever comes up the steps
  if(priest){
    const g=priest.g,d=Math.hypot(pp.x-g.position.x,pp.z-g.position.z);
    const want=d<12&&!state.cine?Math.atan2(pp.x-g.position.x,pp.z-g.position.z):Math.PI;
    if(!state.cine)g.rotation.y+=wrapA(want-g.rotation.y)*Math.min(1,dt*3);
  }
  // the kneeling villagers pray (a slow bow, now and then arms raised to the sky) and
  // hail the player whenever they are close
  if(crowd.length){
    for(const n of crowd){
      const ph=((n as Npc&{phase: number}).phase+=dt);
      const raise=Math.max(0,Math.sin(ph*.7))**6;
      kneel(n.g,raise,.3+Math.sin(ph*1.3)*.12*(1-raise));
    }
    cheerT-=dt;
    const d=Math.hypot(pp.x-MEET.x,pp.z-MEET.z);
    if(cheerT<=0&&d<16){
      cheerT=rand(.8,1.6);
      const n=crowd[Math.floor(Math.random()*crowd.length)];
      say(n.g,CHEERS[Math.floor(Math.random()*CHEERS.length)],{life:2.6,yOff:2.1});
    }
  }
}
