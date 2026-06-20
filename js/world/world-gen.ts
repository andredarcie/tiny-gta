// ---------------------------------------------------------------------------
// World generator — the BAKER.
//
// This module is PURE: it imports only constants.js (plain math, no Three.js, no
// DOM) and the seeded RNG, so it runs in Node. tools/bake-world.mjs runs it once
// and writes the result to /world.json. The game (js/world/world.ts) then reads ONLY
// world.json and builds the meshes — it never re-rolls anything, so the map is
// identical every load and a future editor can open world.json and move objects.
//
// What lives here: every placement DECISION that used to be random (city lots &
// their building/abandoned split, city-park vegetation, beach palms/umbrellas/
// chairs/rocks, the whole rural forest, mountain rocks). What stays in world.js:
// the actual mesh building (the add*/finalize* calls) and the deterministic,
// hand-authored landmarks (named buildings, Pine Hollow village, fences, fort,
// street-lamp grid) plus the terrain heightfields (all pure math from constants).
//
// IMPORTANT: the landmark footprints below MIRROR the values exported by the
// model modules (nightclub.js, ranch-house.js, …). They are frozen layout
// constants; the generator only needs them to know which blocks/spots to avoid.
// ---------------------------------------------------------------------------
import {N,ROAD,BLOCK,SIDE,GROUND,BEACH,RURAL_X0,RURAL_X1,RURAL_HALF,RURAL_GAP,
  MOUNT_X,MOUNT_R,TOWN_CX,nodeX,groundHeight,ruralRoadPath} from '@/core/constants.ts';
import {makeRng} from '@/core/rng.ts';

// Reserved city blocks (mirror CLUB/GYM/HOSP/PRISON/GUNSHOP/WORKSHOP _I/_J).
const RESERVED:[number,number][]=[[0,3],[7,1],[6,6],[2,2],[1,5],[5,2]];
// Rural landmark footprints the forest must keep clear of (mirror the modules).
const RANCH_CX=420+RURAL_GAP, RANCH_CZ=-80;
const GARAGE={x:409+RURAL_GAP,z:-80};
const WEED_CX=620, WEED_CZ=-90;
const BARN_CX=250+RURAL_GAP, BARN_CZ=-34;
const FORT_X=606, FORT_Z=88;
const FARMHOUSES:[number,number][]=[[212,-12],[236,10],[258,12],[282,-12],[302,10],[222,74],[310,-58]]
  .map(([x,z]):[number,number]=>[x+RURAL_GAP,z]);
const FIELDS:[number,number,number,number][]=[[202,250,14,62],[200,244,-64,-22],[262,310,30,86],[258,300,-90,-42]]
  .map((f):[number,number,number,number]=>[f[0]+RURAL_GAP,f[1]+RURAL_GAP,f[2],f[3]]);

const isReserved=(i:number,j:number):boolean=>RESERVED.some(([a,b])=>a===i&&b===j);

export function generateWorldSpec(seed=1337){
  const {random,rand,irand}=makeRng(seed);

  // ---------- parks: pick exactly 6 random park blocks (mirror world.js) ----------
  // Keep re-rolling (i,j) until 6 non-reserved blocks far enough from the central
  // plaza block (4,4) have been chosen; every other block becomes buildings.
  const parks=new Set<string>();
  while(parks.size<6){
    const i=irand(0,N-1),j=irand(0,N-1);
    if(isReserved(i,j))continue;
    if(Math.abs(i-4)+Math.abs(j-4)>1)parks.add(i+'_'+j);
  }
  const isPark=(i:number,j:number):boolean=>parks.has(i+'_'+j);

  // ---------- city lots (1×1 or 2×2 split; ~1/3 left as abandoned lots) ----------
  const cityLots:{cx:number;cz:number;w:number;d:number;empty:boolean;
    win:{e:boolean;w:boolean;s:boolean;n:boolean}}[]=[];
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    if(isPark(i,j)||isReserved(i,j))continue;
    const x0=nodeX(i)+ROAD/2+SIDE,z0=nodeX(j)+ROAD/2+SIDE,inner=BLOCK-2*SIDE;
    const sx=random()<.5?1:2,sz=random()<.5?1:2;
    const bcx=x0+inner/2,bcz=z0+inner/2;
    for(let a=0;a<sx;a++)for(let b=0;b<sz;b++){
      const cx=x0+(a+.5)*inner/sx,cz=z0+(b+.5)*inner/sz;
      cityLots.push({cx,cz,w:inner/sx-1.6,d:inner/sz-1.6,empty:random()<1/3,
        win:{e:cx>=bcx,w:cx<bcx,s:cz>=bcz,n:cz<bcz}});
    }
  }

  // ---------- city park vegetation (one tree/palm + bushes per quadrant) ----------
  const cityParkVeg:{t:string;x:number;z:number}[]=[];
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    if(!isPark(i,j))continue;
    const x0=nodeX(i)+ROAD/2+SIDE,z0=nodeX(j)+ROAD/2+SIDE,inner=BLOCK-2*SIDE;
    const cx=x0+inner/2,cz=z0+inner/2;
    for(const sx of[-1,1])for(const sz of[-1,1]){
      cityParkVeg.push({t:random()<.7?'tree':'palm',x:cx+sx*rand(6,8.2),z:cz+sz*rand(6,8.2)});
      const n=irand(2,3);
      for(let k=0;k<n;k++){
        const r=random();
        cityParkVeg.push({t:r<.5?'bush':r<.8?'fern':'mushroom',
          x:cx+sx*rand(2.4,9),z:cz+sz*rand(2.4,9)});
      }
    }
  }

  // ---------- beach props (rejection-sampled around the coast, off the rural strip) ----------
  const beachSpot=(margin=4):[number,number]=>{
    const inner=GROUND/2+3,outer=GROUND/2+BEACH-margin;
    for(;;){
      const side=irand(0,3),along=rand(-outer,outer),depth=rand(inner,outer);
      const[x,z]:[number,number]=side===0?[along,-depth]:side===1?[along,depth]:side===2?[-depth,along]:[depth,along];
      if(!(x>RURAL_X0-2&&Math.abs(z)<RURAL_HALF+2))return[x,z];
    }
  };
  const beachPalms:{x:number;z:number}[]=[],beachUmbrellas:{x:number;z:number}[]=[],
    beachChairs:{x:number;z:number}[]=[],beachRocks:{x:number;z:number;s:number}[]=[];
  for(let k=0;k<46;k++){const[x,z]=beachSpot(5);beachPalms.push({x,z});}
  for(let k=0;k<16;k++){const[x,z]=beachSpot(7);beachUmbrellas.push({x,z});}
  for(let k=0;k<14;k++){const[x,z]=beachSpot(8);beachChairs.push({x,z});}
  for(let k=0;k<10;k++){
    const[bx,bz]=beachSpot(3);
    for(let r=0;r<irand(2,4);r++)
      beachRocks.push({x:bx+rand(-1.6,1.6),z:bz+rand(-1.6,1.6),s:rand(.3,.9)});
  }

  // ---------- rural forest ----------
  const road=ruralRoadPath();
  const nearRoad=(px:number,pz:number):boolean=>{
    for(let i=1;i<road.length;i++){
      const ax=road[i-1][0],az=road[i-1][1],dx=road[i][0]-ax,dz=road[i][1]-az;
      let t=((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz||1);t=t<0?0:t>1?1:t;
      const ex=px-(ax+t*dx),ez=pz-(az+t*dz);
      if(ex*ex+ez*ez<49)return true;                          // within 7m of the road
    }
    return false;
  };
  const okForest=(px:number,pz:number):boolean=>{
    if(px<RURAL_X0+6||px>RURAL_X1-8||Math.abs(pz)>RURAL_HALF-6)return false;
    if(nearRoad(px,pz))return false;
    if(groundHeight(px,pz)>18)return false;                   // high slope is rock
    if(Math.hypot(px-RANCH_CX,pz-RANCH_CZ)<18)return false;
    if(Math.hypot(px-GARAGE.x,pz-GARAGE.z)<12)return false;
    if(Math.hypot(px-WEED_CX,pz-WEED_CZ)<18)return false;
    if(Math.hypot(px-TOWN_CX,pz)<78)return false;
    if(Math.hypot(px-FORT_X,pz-FORT_Z)<33)return false;
    if(Math.hypot(px-BARN_CX,pz-BARN_CZ)<13)return false;
    if(FARMHOUSES.some(([fx,fz])=>Math.hypot(px-fx,pz-fz)<9))return false;
    if(FIELDS.some(([a,b,d,e])=>px>a-2&&px<b+2&&pz>d-2&&pz<e+2))return false;
    return true;
  };
  const trees:{t:string;x:number;z:number}[]=[];             // {t:'pine'|'tree',x,z}
  const plantTree=(px:number,pz:number):boolean=>{
    if(!okForest(px,pz))return false;
    trees.push({t:random()<.72?'pine':'tree',x:px,z:pz});return true;
  };
  const G=RURAL_GAP;
  const groves:[number,number,number,number,number][]=[
    [228+G,90,30,34,40],[268+G,96,28,30,38],[306+G,92,26,28,34],
    [224+G,-92,30,34,40],[266+G,-98,28,30,38],[302+G,-96,26,28,34],
    [MOUNT_X-MOUNT_R-12,64,32,30,40],[MOUNT_X-MOUNT_R-12,-64,32,30,40],
    [350+G,74,26,28,34],[350+G,-74,26,28,34],
    [245+G,108,24,9,18],[285+G,-110,24,9,16],
    [560,70,26,30,34],[560,-70,26,30,34],
  ];
  let placed=0;
  for(const[gx,gz,rx,rz,count]of groves){
    let n=0,g2=0;
    while(n<count&&g2++<count*6){
      const ox=(random()+random()-1)*rx,oz=(random()+random()-1)*rz;
      if(plantTree(gx+ox,gz+oz)){n++;placed++;}
    }
  }
  let guard=0;
  while(placed<470&&guard++<4000){
    if(plantTree(rand(RURAL_X0+6,RURAL_X1-8),rand(-RURAL_HALF+6,RURAL_HALF-6)))placed++;
  }
  for(let px=RURAL_X0+24;px<MOUNT_X-MOUNT_R-6;px+=rand(7,11)){ // pines lining the dirt road
    for(const sz of[-1,1]){
      const pz=sz*rand(9,13);
      if(okForest(px,pz))trees.push({t:'pine',x:px,z:pz});
    }
  }
  const bushes:{x:number;z:number}[]=[];
  let nb=0,bg=0;
  while(nb<320&&bg++<5200){
    let px,pz;
    if(random()<.7){
      const[gx,gz,rx,rz]=groves[irand(0,groves.length-1)];
      px=gx+(random()+random()-1)*(rx+8);pz=gz+(random()+random()-1)*(rz+8);
    }else{
      px=rand(RURAL_X0+6,RURAL_X1-8);pz=rand(-RURAL_HALF+6,RURAL_HALF-6);
    }
    if(okForest(px,pz)){bushes.push({x:px,z:pz});nb++;}
  }
  const ferns:{x:number;z:number}[]=[];
  let nf=0,fg=0;
  while(nf<240&&fg++<4200){
    const px=rand(RURAL_X0+6,RURAL_X1-8),pz=rand(-RURAL_HALF+6,RURAL_HALF-6);
    if(okForest(px,pz)){ferns.push({x:px,z:pz});nf++;}
  }
  const details:{t:string;x:number;z:number}[]=[];           // {t:'mushroom'|'log',x,z}
  let nd=0,dg=0;
  while(nd<80&&dg++<1600){
    const[gx,gz,rx,rz]=groves[irand(0,groves.length-1)];
    const px=gx+(random()+random()-1)*(rx+6),pz=gz+(random()+random()-1)*(rz+6);
    if(!okForest(px,pz))continue;
    details.push({t:random()<.62?'mushroom':'log',x:px,z:pz});nd++;
  }

  // ---------- mountain rocks (scattered on the slopes) ----------
  const mountainRocks:{x:number;z:number;s:number}[]=[];
  for(let k=0;k<14;k++){
    const a=rand(0,Math.PI*2),d=rand(MOUNT_R*.3,MOUNT_R*.9);
    mountainRocks.push({x:MOUNT_X+Math.cos(a)*d,z:Math.sin(a)*d,s:rand(.5,1.3)});
  }

  return {
    version:1,seed,
    parks:[...parks],
    cityLots,cityParkVeg,
    beachPalms,beachUmbrellas,beachChairs,beachRocks,
    forest:{trees,bushes,ferns,details},
    mountainRocks,
  };
}
