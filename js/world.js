import * as THREE from 'three';
import {N,CELL,ROAD,BLOCK,SIDE,HALF,GROUND,BEACH,nodeX,rand,irand,pick,clamp,
  RURAL_X0,RURAL_GAP,RURAL_X1,RURAL_HALF,MOUNT_X,MOUNT_R,MOUNT_H,MOUNT_SEG,MOUNT_S,
  TOWN_CX,ruralRoadPath,groundHeight,ruralHillH} from './constants.js';
import {scene,renderer} from './engine.js';
import {addPalm} from '../assets/models/props/palm.js';
import {addUmbrella} from '../assets/models/props/umbrella.js';
import {addChair} from '../assets/models/props/chair.js';
import {addLifeguard} from '../assets/models/props/lifeguard.js';
import {addFarmHouse} from '../assets/models/props/farm-house.js';
import {addPine} from '../assets/models/props/pine.js';
import {addTree} from '../assets/models/props/tree.js';
import {addBush} from '../assets/models/props/bush.js';
import {addFern} from '../assets/models/props/fern.js';
import {addMushroom} from '../assets/models/props/mushroom.js';
import {addFallenLog} from '../assets/models/props/fallen-log.js';
import {addStreetLamp,lampGlowMat,lampHaloMat,lampBulbMat} from '../assets/models/props/street-lamp.js';
import {addBuilding,finalizeBuildings,buildingMats} from '../assets/models/city/building.js';
import {finalizeDoorArrows} from '../assets/models/city/door-arrow.js';
import {addAbandonedLot,finalizeAbandonedLots} from '../assets/models/city/abandoned-lot.js';
import {finalizeProps} from '../assets/models/props/prop-merge.js';
import {addNightclub,CLUB_I,CLUB_J} from '../assets/models/city/nightclub.js';
import {addGym,GYM_I,GYM_J} from '../assets/models/city/gym.js';
import {addHospital,HOSP_I,HOSP_J} from '../assets/models/city/hospital.js';
import {addPrison,PRISON_I,PRISON_J} from '../assets/models/city/prison.js';
import {addGunShop,GUNSHOP_I,GUNSHOP_J} from '../assets/models/city/gun-shop.js';
import {addWorkshop,WORKSHOP_I,WORKSHOP_J} from '../assets/models/city/workshop.js';
import {addBarnWithSilo} from '../assets/models/rural/barn-with-silo.js';
import {addAbandonedFort} from '../assets/models/rural/abandoned-fort.js';
import {addRanchHouse,RANCH_CX,RANCH_CZ,GARAGE_PAD} from '../assets/models/rural/ranch-house.js';
import {addWeedFarm,WEED_CX,WEED_CZ} from '../assets/models/rural/weed-farm.js';
import {addHayBales} from '../assets/models/rural/hay-bales.js';
import {addSummitFlag} from '../assets/models/rural/summit-flag.js';
import {addChurch} from '../assets/models/rural/church.js';
import {addGeneralStore} from '../assets/models/rural/general-store.js';
import {addWaterTower} from '../assets/models/rural/water-tower.js';
import {addWindmill} from '../assets/models/rural/windmill.js';
import {addTownSign} from '../assets/models/rural/town-sign.js';
import {addFenceRun} from '../assets/models/rural/fence.js';
import {addWell} from '../assets/models/rural/well.js';
import {addMarketStall} from '../assets/models/rural/market-stall.js';
import {makeTexturedPlane} from '../assets/models/terrain/textured-plane.js';
import {buildIsland,updateCoastFoam} from '../assets/models/terrain/island.js';
import {buildIslandParadise,updateIslandFoam} from '../assets/models/terrain/island-paradise.js';
import {addBeachRock} from '../assets/models/terrain/beach-rock.js';
import {makeMountain} from '../assets/models/terrain/mountain.js';
import {addMountainRock} from '../assets/models/terrain/mountain-rock.js';

export const solids=[];
export const parks=new Set();
while(parks.size<6){
  const i=irand(0,N-1),j=irand(0,N-1);
  if(i===CLUB_I&&j===CLUB_J)continue; // quarteirão reservado pra boate
  if(i===GYM_I&&j===GYM_J)continue;   // quarteirão reservado pra academia
  if(i===HOSP_I&&j===HOSP_J)continue; // quarteirão reservado pro hospital
  if(i===PRISON_I&&j===PRISON_J)continue; // quarteirão reservado pro presídio
  if(i===GUNSHOP_I&&j===GUNSHOP_J)continue; // quarteirão reservado pra loja de armas
  if(i===WORKSHOP_I&&j===WORKSHOP_J)continue; // quarteirão reservado pra oficina de custom
  if(Math.abs(i-4)+Math.abs(j-4)>1)parks.add(i+'_'+j);
}
export const isPark=(i,j)=>parks.has(i+'_'+j);

// Lotes da cidade, sorteados ANTES da textura do chão: ~1/3 não ganha prédio
// e vira lote abandonado (terra batida pintada no canvas + entulho 3D)
const cityLots=[];
for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  if(isPark(i,j))continue;
  if(i===CLUB_I&&j===CLUB_J)continue; // o quarteirão da boate não vira lote
  if(i===GYM_I&&j===GYM_J)continue;   // nem o da academia
  if(i===HOSP_I&&j===HOSP_J)continue; // nem o do hospital
  if(i===PRISON_I&&j===PRISON_J)continue; // nem o do presídio
  if(i===GUNSHOP_I&&j===GUNSHOP_J)continue; // nem o da loja de armas
  if(i===WORKSHOP_I&&j===WORKSHOP_J)continue; // nem o da oficina de custom
  const x0=nodeX(i)+ROAD/2+SIDE,z0=nodeX(j)+ROAD/2+SIDE,inner=BLOCK-2*SIDE;
  const sx=Math.random()<.5?1:2,sz=Math.random()<.5?1:2;
  const bcx=x0+inner/2,bcz=z0+inner/2; // janelas só nas faces viradas pra fora do quarteirão
  for(let a=0;a<sx;a++)for(let b=0;b<sz;b++){
    const cx=x0+(a+.5)*inner/sx,cz=z0+(b+.5)*inner/sz;
    cityLots.push({cx,cz,w:inner/sx-1.6,d:inner/sz-1.6,empty:Math.random()<1/3,
      win:{e:cx>=bcx,w:cx<bcx,s:cz>=bcz,n:cz<bcz}});
  }
}

// Ground texture (asphalt, sidewalks, crosswalks)
const groundCv=document.createElement('canvas');groundCv.width=2048;groundCv.height=2048;
{
  const x=groundCv.getContext('2d'),s=2048/GROUND,M=v=>(v+GROUND/2)*s;
  x.fillStyle='#46464a';x.fillRect(0,0,2048,2048);                // asfalto neutro
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){
    const x0=nodeX(i)+ROAD/2,z0=nodeX(j)+ROAD/2;
    x.fillStyle='#bcb6a8';x.fillRect(M(x0),M(z0),BLOCK*s,BLOCK*s); // calçadão claro
    x.fillStyle=isPark(i,j)?'#5fae62':'#9c968a';
    x.fillRect(M(x0+SIDE),M(z0+SIDE),(BLOCK-2*SIDE)*s,(BLOCK-2*SIDE)*s);
    if(isPark(i,j)){
      x.strokeStyle='#d8c79a';x.lineWidth=1.4*s;
      x.beginPath();x.moveTo(M(x0+SIDE),M(z0+BLOCK/2));x.lineTo(M(x0+BLOCK-SIDE),M(z0+BLOCK/2));
      x.moveTo(M(x0+BLOCK/2),M(z0+SIDE));x.lineTo(M(x0+BLOCK/2),M(z0+BLOCK-SIDE));x.stroke();
    }
  }
  // lotes abandonados: terra batida com manchas de entulho e mato ralo
  for(const lot of cityLots){
    if(!lot.empty)continue;
    const lx=M(lot.cx-lot.w/2),lz=M(lot.cz-lot.d/2),lw=lot.w*s,ld=lot.d*s;
    x.fillStyle='#8a7a62';x.fillRect(lx,lz,lw,ld);
    for(let k=0;k<46;k++){
      x.fillStyle=Math.random()<.3
        ?`rgba(${irand(80,110)},${irand(120,150)},${irand(60,85)},.5)`
        :`rgba(${irand(125,165)},${irand(108,140)},${irand(82,112)},.5)`;
      x.fillRect(lx+Math.random()*lw,lz+Math.random()*ld,irand(2,6),irand(2,6));
    }
  }
  for(let i=0;i<=N;i++){
    const r=nodeX(i);
    for(let j=0;j<N;j++){
      const a=nodeX(j)+ROAD/2+2.5,b=nodeX(j+1)-ROAD/2-2.5;
      x.fillStyle='#f0bd2e';
      x.fillRect(M(r-.55),M(a),.32*s,(b-a)*s);x.fillRect(M(r+.23),M(a),.32*s,(b-a)*s);
      x.fillRect(M(a),M(r-.55),(b-a)*s,.32*s);x.fillRect(M(a),M(r+.23),(b-a)*s,.32*s);
      x.fillStyle='rgba(240,240,245,.7)';
      x.fillRect(M(r-ROAD/2+.5),M(a),.22*s,(b-a)*s);x.fillRect(M(r+ROAD/2-.72),M(a),.22*s,(b-a)*s);
      x.fillRect(M(a),M(r-ROAD/2+.5),(b-a)*s,.22*s);x.fillRect(M(a),M(r+ROAD/2-.72),(b-a)*s,.22*s);
    }
  }
  x.fillStyle='rgba(235,235,240,.75)';
  for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){
    const cx=nodeX(i),cz=nodeX(j);
    for(let k=-2;k<=2;k++){
      x.fillRect(M(cx+k*2.4-.7),M(cz-ROAD/2-2.2),1.4*s,1.6*s);
      x.fillRect(M(cx+k*2.4-.7),M(cz+ROAD/2+.6),1.4*s,1.6*s);
      x.fillRect(M(cx-ROAD/2-2.2),M(cz+k*2.4-.7),1.6*s,1.4*s);
      x.fillRect(M(cx+ROAD/2+.6),M(cz+k*2.4-.7),1.6*s,1.4*s);
    }
  }
  for(let k=0;k<5000;k++){
    x.fillStyle=`rgba(${irand(120,200)},${irand(120,190)},${irand(130,200)},.1)`;
    x.fillRect(Math.random()*2048,Math.random()*2048,irand(2,7),irand(2,7));
  }
  const gt=new THREE.CanvasTexture(groundCv);gt.colorSpace=THREE.SRGBColorSpace;
  gt.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const ground=makeTexturedPlane(GROUND,GROUND,gt);
  scene.add(ground);
}

export {buildingMats}; // daynight.js controla emissiveIntensity (janelas acesas à noite)

for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  if(!isPark(i,j))continue;
  const x0=nodeX(i)+ROAD/2+SIDE,z0=nodeX(j)+ROAD/2+SIDE,inner=BLOCK-2*SIDE;
  for(let k=0;k<7;k++)addPalm(x0+rand(1,inner-1),z0+rand(1,inner-1));
}
for(const lot of cityLots){
  if(lot.empty)addAbandonedLot(lot.cx,lot.cz,lot.w,lot.d,solids);
  else addBuilding(lot.cx,lot.cz,lot.w,lot.d,solids,lot.win);
}
addNightclub(solids); // boate de frente pro mar no quarteirão reservado
addGym(solids);       // academia no quarteirão reservado (nordeste)
addHospital(solids);  // hospital no quarteirão reservado (sudeste)
addPrison(solids);    // presídio no quarteirão reservado (busted)
addGunShop(solids);   // loja de armas (AMMU-NATION) no quarteirão reservado
addWorkshop(solids);  // oficina de custom (MOD GARAGE) no quarteirão reservado
finalizeBuildings();     // funde a cidade inteira em ~18 meshes (draw calls)
finalizeAbandonedLots(); // e todos os lotes abandonados em ~5
finalizeDoorArrows();    // todas as setinhas de porta num único mesh

// Ilha de verdade: a areia, o raso turquesa e a espuma seguem UMA costa irregular
// contínua (cidade + península), no lugar da antiga praia quadrada / anéis
// quadrados / bordas retangulares. Mesmo contorno do gameplay (isLand). A espuma
// pulsa via updateBeach. Ver assets/models/terrain/island.js.
const coastFoam=buildIsland();

// Ilha paradisíaca a oeste, em mar aberto: alcançável de barco e explorável a pé.
// Mesmo islandHeight/islandCoastR de constants.js que o gameplay usa (groundHeight/
// isLand). Props (palmeiras/pedras/arbustos) são assados e fundidos no finalizeProps
// abaixo; terreno/raso/espuma/farol/cabana/píer vão direto pra cena. Ver
// assets/models/terrain/island-paradise.js.
const islandFoam=buildIslandParadise(solids);

function beachSpot(margin=4){
  const inner=GROUND/2+3,outer=GROUND/2+BEACH-margin;
  for(;;){
    const side=irand(0,3),along=rand(-outer,outer),depth=rand(inner,outer);
    const[x,z]=side===0?[along,-depth]:side===1?[along,depth]:side===2?[-depth,along]:[depth,along];
    // a faixa leste virou zona rural — nada de guarda-sol no pasto
    if(!(x>RURAL_X0-2&&Math.abs(z)<RURAL_HALF+2))return[x,z];
  }
}
for(let k=0;k<46;k++){const[bx,bz]=beachSpot(5);addPalm(bx,bz);}

for(let k=0;k<16;k++){const[bx,bz]=beachSpot(7);addUmbrella(bx,bz);}

for(let k=0;k<14;k++){const[bx,bz]=beachSpot(8);addChair(bx,bz);}

// half-buried rock clusters near the water
{
  for(let k=0;k<10;k++){
    const[bx,bz]=beachSpot(3);
    for(let r=0;r<irand(2,4);r++){
      addBeachRock(bx+rand(-1.6,1.6),bz+rand(-1.6,1.6),rand(.3,.9));
    }
  }
}

// lifeguard towers, one per side facing the sea
{
  const LG=GROUND/2+BEACH/2;
  addLifeguard(0,-LG,0);addLifeguard(0,LG,Math.PI);
  addLifeguard(-LG,0,Math.PI/2); // o posto leste saiu: lá agora é zona rural
}

// ----- Zona rural: península a leste, da saída da cidade até a montanha-mirante -----
{
  const RW=RURAL_X1-RURAL_X0,RD=RURAL_HALF*2;
  // chão de grama com estrada de terra (continuação da rua central) e roças pintadas
  const c=document.createElement('canvas');c.width=1024;c.height=512;
  const x=c.getContext('2d');
  const u=v=>(v-RURAL_X0)/RW*1024,w=v=>(v+RURAL_HALF)/RD*512;
  x.fillStyle='#69a85e';x.fillRect(0,0,1024,512);
  for(let k=0;k<2600;k++){
    x.fillStyle=`rgba(${irand(70,115)},${irand(130,175)},${irand(60,95)},.22)`;
    x.fillRect(Math.random()*1024,Math.random()*512,irand(2,7),irand(2,7));
  }
  // roças: terra arada com linhas de plantação
  const fields=[[202,250,14,62],[200,244,-64,-22],[262,310,30,86],[258,300,-90,-42]]
    .map(f=>[f[0]+RURAL_GAP,f[1]+RURAL_GAP,f[2],f[3]]);
  for(const[fx0,fx1,fz0,fz1]of fields){
    x.fillStyle='#8a6a3e';x.fillRect(u(fx0),w(fz0),u(fx1)-u(fx0),w(fz1)-w(fz0));
    x.strokeStyle='rgba(120,185,90,.9)';x.lineWidth=3;
    for(let r=w(fz0)+5;r<w(fz1)-2;r+=7){
      x.beginPath();x.moveTo(u(fx0)+3,r);x.lineTo(u(fx1)-3,r);x.stroke();
    }
  }
  // estrada de terra: sai da cidade, contorna a montanha pelo NORTE e atravessa a
  // vila rural (mesmo traçado do radar — ver ruralRoadPath em constants.js)
  const sx0=1024/RW,sz0=512/RD,roadW=7*(sx0+sz0)/2;
  x.strokeStyle='#b08a5e';x.lineCap='round';x.lineJoin='round';x.lineWidth=roadW;
  const rp=ruralRoadPath();
  x.beginPath();rp.forEach(([px,pz],i)=>i?x.lineTo(u(px),w(pz)):x.moveTo(u(px),w(pz)));x.stroke();
  // rua transversal N-S da vila (termina no pé da praça/igreja)
  x.beginPath();x.moveTo(u(TOWN_CX),w(-46));x.lineTo(u(TOWN_CX),w(34));x.stroke();
  // praça central: clareira de terra batida mais clara
  x.fillStyle='#c2a275';
  x.beginPath();x.ellipse(u(TOWN_CX),w(0),16*sx0,16*sz0,0,0,Math.PI*2);x.fill();
  // poeira ao longo da estrada
  for(let k=0;k<420;k++){
    const seg=rp[irand(0,rp.length-1)];
    x.fillStyle=`rgba(${irand(140,180)},${irand(105,135)},${irand(70,95)},.45)`;
    x.fillRect(u(seg[0])+rand(-roadW/2,roadW/2),w(seg[1])+rand(-roadW/2,roadW/2),irand(2,6),irand(1,3));
  }
  // A orla irregular (areia/raso/espuma) agora vem da ilha (island.js); o pasto
  // só leva uma transição suave de grama mais clara/seca na linha de vegetação,
  // pra casar com a faixa de praia que assoma além da borda do gramado.
  for(let k=0;k<900;k++){
    x.fillStyle=`rgba(${irand(150,195)},${irand(168,205)},${irand(110,150)},.5)`;
    const e=irand(0,2);
    if(e===0)x.fillRect(Math.random()*1024,Math.random()*16,irand(3,8),irand(2,5));
    else if(e===1)x.fillRect(Math.random()*1024,512-16+Math.random()*16,irand(3,8),irand(2,5));
    else x.fillRect(1024-16+Math.random()*16,Math.random()*512,irand(2,5),irand(3,8));
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  // Chão rural com colinas suaves no corredor. Mesma orientação do
  // makeTexturedPlane (plano XY girado -90° no X): o relevo vai no Z local, que
  // após o giro vira altura (+Y mundo). Amostro ruralHillH em coords de mundo.
  const rcx=RURAL_X0+RW/2;
  const rgeo=new THREE.PlaneGeometry(RW,RD,Math.round(RW/5),Math.round(RD/5));
  const rpos=rgeo.attributes.position;
  for(let k=0;k<rpos.count;k++)
    rpos.setZ(k,ruralHillH(rpos.getX(k)+rcx,-rpos.getY(k)));
  rgeo.computeVertexNormals();
  const ground=new THREE.Mesh(rgeo,new THREE.MeshLambertMaterial({map:t}));
  ground.rotation.x=-Math.PI/2;ground.position.set(rcx,-.02,0);
  ground.receiveShadow=true;
  scene.add(ground);
}

// Farmhouse positions, kept as data so the forest pass below can leave a clearing
// around each one (the houses sit in the gap between the road and the fields,
// which the field/road exclusions don't cover).
const FARMHOUSES=[[212,-12,0],[236,10,-.4],[258,12,.3],[282,-12,.2],[302,10,-.25],
  [222,74,2.8],[310,-58,1.3]].map(([x,z,r])=>[x+RURAL_GAP,z,r]);
for(const[x,z,r]of FARMHOUSES)solids.push(addFarmHouse(x,z,r));
// Barn + silo footprint centre (see addBarnWithSilo: placed at 250+gap,-34).
const BARN_CX=250+RURAL_GAP,BARN_CZ=-34;

// celeiro vermelho com silo
addBarnWithSilo(solids);

// casa de campo comprável (safehouse): fachada + garagem aqui, interior a ~600m
addRanchHouse(solids);

// clandestine weed grow-op tucked into the south shore (mini-game: js/weed-farm.js)
addWeedFarm(solids);

// Dense living forest across the rural peninsula and the lower mountain slopes.
// Every forest prop (pine, broadleaf tree, bush, fern, mushroom, fallen log) is a
// tiny MERGED prop folded into the shared chunk meshes, so a thick wood costs
// almost nothing extra in draw calls — it just merges into more geometry per
// chunk (and distant chunks are culled). We seed CLUSTER centres (groves), drop
// most trees near them with a falloff so the wood reads as clumped stands, fill
// the gaps with a denser scatter, then carpet the floor with undergrowth (bushes
// and ferns) and decay detail (mushroom clusters and fallen logs) to make it
// feel alive rather than an even grid of dots.
{
  const fields=[[202,250,14,62],[200,244,-64,-22],[262,310,30,86],[258,300,-90,-42]]
    .map(f=>[f[0]+RURAL_GAP,f[1]+RURAL_GAP,f[2],f[3]]);
  // Keep a clear strip along the actual dirt road (the SAME polyline that draws
  // it): straight out of town, the arc looping NORTH around the mountain, then
  // straight through the village. Point-to-segment distance so the arc gaps and
  // the eastern leg are covered too — not just the western straight.
  const road=ruralRoadPath();
  const nearRoad=(px,pz)=>{
    for(let i=1;i<road.length;i++){
      const ax=road[i-1][0],az=road[i-1][1],dx=road[i][0]-ax,dz=road[i][1]-az;
      let t=((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz||1);t=t<0?0:t>1?1:t;
      const ex=px-(ax+t*dx),ez=pz-(az+t*dz);
      if(ex*ex+ez*ez<49)return true;   // within 7m of the road centreline
    }
    return false;
  };
  // A forest spot is valid only off the road, off rock, and clear of the ranch,
  // ploughed fields, weed plot, the village square and the ruined fort (trees
  // sprouting inside a building or a field would look wrong).
  const okForest=(px,pz)=>{
    if(px<RURAL_X0+6||px>RURAL_X1-8||Math.abs(pz)>RURAL_HALF-6)return false;
    if(nearRoad(px,pz))return false;                        // dirt road (incl. mountain bypass)
    if(groundHeight(px,pz)>18)return false;                 // high slope is rock
    if(Math.hypot(px-RANCH_CX,pz-RANCH_CZ)<18)return false;  // ranch yard/porch/sign
    if(Math.hypot(px-GARAGE_PAD.x,pz-GARAGE_PAD.z)<12)return false; // garage approach
    if(Math.hypot(px-WEED_CX,pz-WEED_CZ)<18)return false;   // weed farm clearing
    if(Math.hypot(px-TOWN_CX,pz)<78)return false;           // Pine Hollow village clearing
    if(Math.hypot(px-606,pz-88)<33)return false;            // abandoned fort compound (44m wide)
    if(Math.hypot(px-BARN_CX,pz-BARN_CZ)<13)return false;   // barn + silo
    if(FARMHOUSES.some(([fx,fz])=>Math.hypot(px-fx,pz-fz)<9))return false; // farmhouse yards
    if(fields.some(([a,b,d,e])=>px>a-2&&px<b+2&&pz>d-2&&pz<e+2))return false;
    return true;
  };
  // Plant a tree at a valid spot: mostly conifers, with broadleaf trees mixed in
  // for variety. Returns whether it took.
  const plantTree=(px,pz)=>{
    if(!okForest(px,pz))return false;
    (Math.random()<.72?addPine:addTree)(px,pz);return true;
  };
  // Grove centres [x, z, radiusX, radiusZ, count]: thick stands on the north and
  // south flanks, bands creeping up the wooded foot of the mountain, and stands
  // wrapping the far peninsula and the woods between the mountain and the village.
  const G=RURAL_GAP;
  const groves=[
    [228+G, 90, 30, 34, 40],[268+G, 96, 28, 30, 38],[306+G, 92, 26, 28, 34],
    [224+G,-92, 30, 34, 40],[266+G,-98, 28, 30, 38],[302+G,-96, 26, 28, 34],
    [MOUNT_X-MOUNT_R-12, 64, 32, 30, 40],[MOUNT_X-MOUNT_R-12,-64, 32, 30, 40],
    [350+G, 74, 26, 28, 34],[350+G,-74, 26, 28, 34],
    [245+G,108, 24, 9, 18],[285+G,-110, 24, 9, 16],
    [560, 70, 26, 30, 34],[560,-70, 26, 30, 34],
  ];
  let placed=0;
  for(const[gx,gz,rx,rz,count]of groves){
    let n=0,g2=0;
    while(n<count&&g2++<count*6){
      // gaussian-ish clump: sum of two uniforms biases toward the centre
      const ox=(Math.random()+Math.random()-1)*rx, oz=(Math.random()+Math.random()-1)*rz;
      if(plantTree(gx+ox,gz+oz)){n++;placed++;}
    }
  }
  // denser scatter between the groves so the whole peninsula reads as woodland
  let guard=0;
  while(placed<470&&guard++<4000){
    if(plantTree(rand(RURAL_X0+6,RURAL_X1-8),rand(-RURAL_HALF+6,RURAL_HALF-6)))placed++;
  }
  // a double row of pines lining each side of the dirt road on the way out of town
  for(let px=RURAL_X0+24;px<MOUNT_X-MOUNT_R-6;px+=rand(7,11)){
    for(const sz of[-1,1]){
      const pz=sz*rand(9,13);
      if(okForest(px,pz))addPine(px,pz);
    }
  }
  // ---- Undergrowth & forest floor ----
  // Bushes thicken the ground layer; bias most toward the groves so the stands
  // read as dense thicket, with the rest scattered through the open wood.
  let bushes=0,bg=0;
  while(bushes<320&&bg++<5200){
    let px,pz;
    if(Math.random()<.7){
      const[gx,gz,rx,rz]=groves[irand(0,groves.length-1)];
      px=gx+(Math.random()+Math.random()-1)*(rx+8);
      pz=gz+(Math.random()+Math.random()-1)*(rz+8);
    }else{
      px=rand(RURAL_X0+6,RURAL_X1-8);pz=rand(-RURAL_HALF+6,RURAL_HALF-6);
    }
    if(okForest(px,pz)){addBush(px,pz);bushes++;}
  }
  // Ferns dotted across the shaded floor.
  let ferns=0,fg=0;
  while(ferns<240&&fg++<4200){
    const px=rand(RURAL_X0+6,RURAL_X1-8),pz=rand(-RURAL_HALF+6,RURAL_HALF-6);
    if(okForest(px,pz)){addFern(px,pz);ferns++;}
  }
  // Mushroom clusters & mossy fallen logs as life/decay detail, near the stands.
  let detail=0,dg=0;
  while(detail<80&&dg++<1600){
    const[gx,gz,rx,rz]=groves[irand(0,groves.length-1)];
    const px=gx+(Math.random()+Math.random()-1)*(rx+6),pz=gz+(Math.random()+Math.random()-1)*(rz+6);
    if(!okForest(px,pz))continue;
    if(Math.random()<.62)addMushroom(px,pz);else addFallenLog(px,pz);
    detail++;
  }
}

// fardos de feno nas roças
addHayBales();

// ----- Farming hamlet detailing: post-and-rail fences round the field plots and
// the ranch, plus a little green (well + market stall + extra produce) to make
// the cluster of farmhouses read as a lived-in country village, not loose boxes.
{
  const G=RURAL_GAP;
  // enclose each ploughed field with a rail fence (decorative; low rails)
  const fences=[[202,250,14,62],[200,244,-64,-22],[262,310,30,86],[258,300,-90,-42]]
    .map(f=>[f[0]+G,f[1]+G,f[2],f[3]]);
  for(const[a,b,d,e]of fences){
    addFenceRun(a,d,b,d);addFenceRun(b,d,b,e);addFenceRun(b,e,a,e);addFenceRun(a,e,a,d);
  }
  // paddock fence around the ranch yard (leave the garage approach open)
  addFenceRun(RANCH_CX-16,RANCH_CZ-16,RANCH_CX+16,RANCH_CZ-16);
  addFenceRun(RANCH_CX+16,RANCH_CZ-16,RANCH_CX+16,RANCH_CZ+16);
  addFenceRun(RANCH_CX+16,RANCH_CZ+16,RANCH_CX-2,RANCH_CZ+16);
  // village green between the front-row farmhouses (~x 236-258+G, z ~10): a well
  // as the centrepiece and a market stall facing the road, with a couple of hay
  // bales/wood already covered by addHayBales nearby.
  solids.push(addWell(246+G,2));
  solids.push(addMarketStall(232+G,2,Math.PI));   // counter opens south toward the road
  solids.push(addMarketStall(262+G,2,Math.PI));
}

// montanha low poly: a malha usa a MESMA grade/triangulação da groundHeight
// da física (vértices = nós da grade), então colisão e visual batem 1:1
{
  const m=makeMountain(MOUNT_S,MOUNT_SEG);
  m.position.set(MOUNT_X,.02,0);scene.add(m);
  // pedras espalhadas nas encostas
  for(let k=0;k<14;k++){
    const a=rand(0,Math.PI*2),d=rand(MOUNT_R*.3,MOUNT_R*.9);
    const rx=MOUNT_X+Math.cos(a)*d,rz=Math.sin(a)*d;
    addMountainRock(rx,rz,rand(.5,1.3));
  }
  // mirante no pico: mastro com bandeira (e a vista da cidade)
  addSummitFlag(MOUNT_X,MOUNT_H,0);
}

// ----- Vila rural "Pine Hollow": DEPOIS da montanha, no fim da península -----
// Pequena cidadezinha de interior em volta de uma praça: igreja no topo, mercado
// e casas na rua principal, moinho e caixa d'água ao sul. Terreno plano aqui.
{
  const cx=TOWN_CX;
  // placa de boas-vindas na entrada (oeste), de frente pra quem chega pela estrada
  solids.push(addTownSign(cx-54,9,-Math.PI/2));
  // igreja no topo da praça (norte), torre/campanário voltados pra praça (sul)
  solids.push(addChurch(cx,38,Math.PI));
  // mercadinho + casas no lado norte da rua principal, de frente pro sul
  solids.push(addGeneralStore(cx-30,22,Math.PI));
  solids.push(addFarmHouse(cx+34,22,Math.PI));
  solids.push(addFarmHouse(cx+52,22,Math.PI));
  // moinho, casas e caixa d'água no lado sul, de frente pro norte
  solids.push(addWindmill(cx-36,-28));
  solids.push(addFarmHouse(cx-14,-24,0));
  solids.push(addFarmHouse(cx+22,-24,0));
  solids.push(addWaterTower(cx+50,-34));
  // bandeira no centro da praça
  addSummitFlag(cx,0,0);
  // postes de luz ao longo da rua principal
  for(const lx of[cx-44,cx-18,cx+18,cx+44])addStreetLamp(lx,7);
  // pinheiros cercando a vila
  for(const[px,pz]of[[cx-58,-44],[cx-40,-50],[cx-10,-52],[cx+24,-52],[cx+54,-46],
    [cx-58,44],[cx-30,52],[cx+8,54],[cx+44,50],[cx+60,40],[cx+62,-30]])
    addPine(px,pz);
}

// ----- Abandoned military base: a walled, ruined fort on the open ground north
// of the mountain, between it and the village. Drive in through the front gate or
// slip in through the crumbled breach in the back wall. -----
addAbandonedFort(solids,606,88);
// a few pines screening the fort from the road
for(const[px,pz]of[[574,70],[580,108],[636,112],[630,66]])addPine(px,pz);

// espuma da costa (anéis polares da cidade + tiras da península) + espuma da ilha
// a oeste — ver island.js / island-paradise.js
export function updateBeach(time){updateCoastFoam(coastFoam,time);updateIslandFoam(islandFoam,time);}

// Street poles
// Luz dos postes: mesmo truque dos faróis dos carros — texturas aditivas em
// materiais compartilhados; daynight.js controla visible/opacity pelo nightF.
export {lampGlowMat,lampHaloMat,lampBulbMat};
{
  for(let i=0;i<=N;i++)for(let j=0;j<=N;j++){
    if((i+j)%2)continue;
    const px=nodeX(i)+8.2*((i+j)%4<2?1:-1),pz=nodeX(j)+8.2;
    addStreetLamp(px,pz);
  }
}

// Fusão dos props estáticos: TEM que ser a última linha do mundo — qualquer
// addPalm/addPine/addStreetLamp depois daqui não apareceria na cena
finalizeProps();
