import {rand,SWIM_BOUND} from './constants.js';
import {makeRedneck} from '../assets/models/characters/redneck.js';
import * as Entities from './entities.js';
import {collideStatics} from './physics.js';
import {playerPos} from './player.js';

// Ambient rural NPCs ("rednecks") loitering across the eastern peninsula: a few in
// the village square and some out by the farms. The abandoned fort is intentionally
// left EMPTY (a deserted ruin), so no folk loiter there. They are flavor — they
// stand, sway and look around (no combat AI).
// LOD: far folk are hidden and skipped (same idea as pedestrians.js).
const folk=[];
const CULL2=150*150;

// Fixed loiter spots [x,z] in world coords. The abandoned fort (~606,88) is left
// deserted — NO loiter spots there on purpose. RURAL_GAP shifts the farms to x ~342..480.
const spots=[
  // village square (cx 650)
  [641,5],[660,7],[650,-7],[632,3],
  // farms and fields
  [360,20],[430,26],[470,-30],[352,42],
];

for(const[x,z]of spots){
  const g=makeRedneck();
  g.position.set(x+rand(-1.5,1.5),0,z+rand(-1.5,1.5));
  collideStatics(g.position,.4,SWIM_BOUND);   // never start stuck; SWIM_BOUND keeps the peninsula reachable
  const face=rand(-Math.PI,Math.PI);
  g.rotation.y=face;
  folk.push({g,face,lookT:rand(1,5),bob:rand(0,6)});
}

export function updateRuralFolk(dt){
  const pp=playerPos();
  for(const f of folk){
    const dx=f.g.position.x-pp.x,dz=f.g.position.z-pp.z;
    if(dx*dx+dz*dz>CULL2){f.g.visible=false;continue;}
    f.g.visible=true;
    // every few seconds, pick a new heading and turn to "look around"
    f.lookT-=dt;
    if(f.lookT<=0){f.face=rand(-Math.PI,Math.PI);f.lookT=rand(2.5,6);}
    let d=f.face-f.g.rotation.y;
    while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
    f.g.rotation.y+=d*Math.min(1,2*dt);
    // gentle idle: a small weight-shift sway and a faint breathing bob
    f.bob+=dt*1.6;
    Entities.animatePed?.(f.g,f.bob,.12);
    f.g.position.y=Math.abs(Math.sin(f.bob))*.012;
  }
}
