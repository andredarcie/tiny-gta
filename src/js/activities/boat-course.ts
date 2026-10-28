// The boat race's COURSE on the Rio do Peixe — PURE (no THREE, no DOM), unit-tested in
// test/unit/rio-peixe.test.ts. A course is a descent of a stretch of the river (water.ts:
// the surface always runs downhill): the start line, CP_COUNT buoys to round in order (the
// last one is the floating finish), a few water mines in the middle of the legs, and the
// waypoints the rival boats follow. Everything sits inside the channel's DEEP water, scaled
// to the river's own width there (data.ts rioHalfWidth: 8.5–12 m of water), and nothing is
// placed under or right by a bridge (data.ts RIO_BRIDGES) — a buoy's beacon or the gate's
// masts would run through the deck.
import {riverAt,RIVER_LEN} from '@/world/divinolandia/water.ts';
import {rioHalfWidth,RIO_BRIDGES,PLAY} from '@/world/divinolandia/data.ts';

export const CP_COUNT=7;       // buoys (the last is the finish)
export const CP_SPACING=190;   // river arc between buoys (m)
export const LEAD=70;          // from the start line to the first buoy
export const MINE_MAX=3;       // only a FEW water mines per race
export const SPAN=LEAD+(CP_COUNT-1)*CP_SPACING;
const BRIDGE_CLEAR=22;         // nothing of the course within this much river arc of a bridge
const SLALOM=.42,MINE_OFF=.32,DODGE=.5;   // fractions of the channel's half width

export interface Pt{x:number;z:number}
export interface MineSpec{leg:number;s:number;x:number;z:number;dx:number;dz:number}
export interface Waypoint{x:number;z:number;cp:boolean}
export interface Course{s0:number;start:Pt;route:Pt[];arcs:number[];mines:MineSpec[];npcPath:Waypoint[];gateWidth:number}

// the river's centre point at arc s, `off` metres to the right of the flow
export function riverPt(s:number,off=0):Pt{
  const r=riverAt(s);
  return{x:r.x-r.dz*off,z:r.z+r.dx*off};
}
// the arc moved off any bridge (downstream past it, or upstream if that runs off the course)
const nearBridge=(s:number):number|null=>{for(const b of RIO_BRIDGES)if(Math.abs(b.s-s)<BRIDGE_CLEAR)return b.s;return null;};
function clearOfBridges(s:number,dir=1):number{
  for(let k=0;k<4;k++){const b=nearBridge(s);if(b===null)return s;s=b+dir*(BRIDGE_CLEAR+1);}
  return s;
}
// the stretch of river inside the play area, with a margin (the race never runs out of it)
const inPlay=(s:number,m:number):boolean=>{const r=riverAt(s);return r.x>PLAY.x0+m&&r.x<PLAY.x1-m&&r.z>PLAY.z0+m&&r.z<PLAY.z1-m;};
const PLAY_S=((): [number,number]=>{let a=0,b=RIVER_LEN;while(a<b&&!inPlay(a,60))a+=5;while(b>a&&!inPlay(b,60))b-=5;return[a,b];})();
// keep the whole course on that stretch (and its start off a bridge)
export const fitS=(s0:number):number=>clearOfBridges(Math.max(PLAY_S[0]+20,Math.min(PLAY_S[1]-SPAN-30,s0)),-1);

// Lays out the course downstream of arc s0. rnd: the race's random source (Math.random in
// the game, a seeded one in the tests).
export function buildCourse(s0:number,rnd:()=>number=Math.random):Course{
  const startS=fitS(s0),start=riverPt(startS);
  const flip=rnd()<.5?1:-1,arcs:number[]=[],route:Pt[]=[];
  for(let k=0;k<CP_COUNT;k++){
    const s=clearOfBridges(startS+LEAD+k*CP_SPACING);arcs.push(s);
    // the buoys slalom across the channel (the first and the finish sit mid-river)
    const off=k>0&&k<CP_COUNT-1?flip*((k%2)?1:-1)*rioHalfWidth(s)*SLALOM*(.7+rnd()*.3):0;
    route.push(riverPt(s,off));
  }
  // water mines in the middle of a few interior legs, with the sidestep the rivals take
  const legs:number[]=[];
  for(let k=2;k<CP_COUNT-1;k++)legs.push(k);
  for(let i=legs.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[legs[i],legs[j]]=[legs[j],legs[i]];}
  const mines:MineSpec[]=[];
  for(const k of legs.slice(0,Math.min(MINE_MAX,legs.length))){
    const s=clearOfBridges(arcs[k-1]+(arcs[k]-arcs[k-1])*(.42+rnd()*.16)),side=rnd()<.5?1:-1,w=rioHalfWidth(s);
    const m=riverPt(s,side*w*MINE_OFF),d=riverPt(s,-side*w*DODGE);
    mines.push({leg:k,s,x:m.x,z:m.z,dx:d.x,dz:d.z});
  }
  // the rivals follow the river line every ~12 m (so they take its bends instead of cutting
  // over the banks), the buoys (cp:true) and, at each mine, the sidestep past it — all in the
  // order they come down the river; a river point too close to a buoy or a sidestep is
  // dropped (no zig-zag through it)
  const marks:{s:number;p:Waypoint}[]=[
    ...arcs.map((a,i)=>({s:a,p:{x:route[i].x,z:route[i].z,cp:true}})),
    ...mines.map(m=>({s:m.s,p:{x:m.dx,z:m.dz,cp:false}})),
  ];
  const end=arcs[arcs.length-1];
  for(let a=startS+12;a<end;a+=12)if(!marks.some(m=>Math.abs(m.s-a)<6))marks.push({s:a,p:{...riverPt(a),cp:false}});
  marks.sort((p,q)=>p.s-q.s);
  const npcPath:Waypoint[]=marks.map(m=>m.p);
  // the floating gates span the water there (pontoons just inside the banks)
  const gateWidth=Math.max(8,2*rioHalfWidth(startS)+1);
  return{s0:startS,start,route,arcs,mines,npcPath,gateWidth};
}
