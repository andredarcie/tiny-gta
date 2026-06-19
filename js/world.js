import * as THREE from 'three';
import {N,CELL,ROAD,BLOCK,SIDE,HALF,GROUND,BEACH,nodeX,rand,irand,pick,clamp,
  RURAL_X0,RURAL_GAP,RURAL_X1,RURAL_HALF,MOUNT_X,MOUNT_R,MOUNT_H,MOUNT_SEG,MOUNT_S,
  TOWN_CX,ruralRoadPath,groundHeight,ruralHillH} from './constants.js';
import {scene,renderer} from './engine.js';
// Fixed, baked world layout. Every procedurally-placed object (city lots, park
// vegetation, beach props, the whole forest, mountain rocks) is read from this
// file instead of being re-rolled at boot, so the map is identical every load and
// can be hand-edited / opened by a future map editor. Regenerate from the seed
// with `npm run bake` (js/world-gen.js). Terrain heightfields and the hand-authored
// landmarks (named buildings, village, fences, fort) still come from the code below.
import worldData from '../world.json';
import {makeRng} from './rng.js';
import {addPalm} from '../assets/models/props/palm.js';
import {addUmbrella} from '../assets/models/props/umbrella.js';
import {addChair} from '../assets/models/props/chair.js';
import {addLifeguard} from '../assets/models/props/lifeguard.js';
import {addFarmHouse} from '../assets/models/props/farm-house.js';
import {addPine} from '../assets/models/props/pine.js';
import {addTree} from '../assets/models/props/tree.js';
import {addParkBench} from '../assets/models/props/park-bench.js';
import {addFountain} from '../assets/models/props/fountain.js';
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
import {addIgrejaDivino} from '../assets/models/rural/igreja-divino.js';
import {addCoreto} from '../assets/models/rural/coreto.js';
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
// Park blocks are baked into world.json (js/world-gen.js picks the 6 of them).
export const parks=new Set(worldData.parks);
export const isPark=(i,j)=>parks.has(i+'_'+j);

// City lots — which blocks get a building vs an abandoned lot, their 1×1/2×2 split
// and window orientation — are baked into world.json (js/world-gen.js). The ground
// texture below paints the abandoned lots, so the data must be ready before it.
const cityLots=worldData.cityLots;

// Static ground textures are drawn into a <canvas> ONCE. On mobile, sending the
// tab to the background can drop the WebGL context and/or purge a large 2D canvas
// backing store; on return the ground texture is re-uploaded from a now-blank
// canvas and renders solid black. Each ground registers a repaint closure here so
// it can be redrawn on context-restore / foreground (see refreshGroundTextures).
const groundTexRedraws=[];

// Ground texture (asphalt, sidewalks, crosswalks)
const groundCv=document.createElement('canvas');groundCv.width=2048;groundCv.height=2048;
function paintCityGround(){
  const x=groundCv.getContext('2d'),s=2048/GROUND,M=v=>(v+GROUND/2)*s;
  // Re-seeded each call so the speckle/debris noise is deterministic AND identical
  // on every repaint (the mobile context-restore redraw, see groundTexRedraws).
  const {random:rnd,irand}=makeRng(0x6017c1);
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
      x.fillStyle=rnd()<.3
        ?`rgba(${irand(80,110)},${irand(120,150)},${irand(60,85)},.5)`
        :`rgba(${irand(125,165)},${irand(108,140)},${irand(82,112)},.5)`;
      x.fillRect(lx+rnd()*lw,lz+rnd()*ld,irand(2,6),irand(2,6));
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
    x.fillRect(rnd()*2048,rnd()*2048,irand(2,7),irand(2,7));
  }
}
{
  paintCityGround();
  const gt=new THREE.CanvasTexture(groundCv);gt.colorSpace=THREE.SRGBColorSpace;
  gt.anisotropy=renderer.capabilities.getMaxAnisotropy();
  const ground=makeTexturedPlane(GROUND,GROUND,gt);
  scene.add(ground);
  groundTexRedraws.push(()=>{paintCityGround();gt.needsUpdate=true;});
}

export {buildingMats}; // daynight.js controla emissiveIntensity (janelas acesas à noite)

// Pracinhas da cidade: o chão já tem o gramado verde + os caminhos em cruz
// (textura acima). Aqui mobiliamos cada uma como uma praça de verdade — fonte
// central, bancos virados pra ela, postes nos cantos e árvores/arbustos nos
// quadrantes — em vez das 7 palmeiras soltas de antes. Os 4 braços do caminho
// (eixos x=cx e z=cz) ficam livres: tudo é colocado nos quadrantes (diagonais).
function addCityPark(x0,z0,inner){
  const cx=x0+inner/2,cz=z0+inner/2; // centro = cruzamento dos caminhos
  // Fonte no centro (sólida: não dá pra atravessar a bacia).
  solids.push(addFountain(cx,cz));
  // Postes nos quatro cantos: dão estrutura à praça e a iluminam à noite.
  for(const sx of[-1,1])for(const sz of[-1,1])addStreetLamp(cx+sx*9.5,cz+sz*9.5);
  // Um banco em cada quadrante, encarando a fonte (mantém os caminhos livres).
  for(const sx of[-1,1])for(const sz of[-1,1])
    solids.push(addParkBench(cx+sx*3.6,cz+sz*3.6,Math.atan2(-sx,-sz)));
  // Park vegetation (trees/palms/bushes/ferns/mushrooms per quadrant) is baked
  // into world.json and built by plantSmall in the loop below.
}
// Build a small decorative prop by type. Shared by the park vegetation and the
// rural forest — both come from world.json now. These all merge into the batched
// prop meshes at finalizeProps (the last line of the world build).
function plantSmall(t,x,z){
  if(t==='pine')addPine(x,z);
  else if(t==='palm')addPalm(x,z);
  else if(t==='bush')addBush(x,z);
  else if(t==='fern')addFern(x,z);
  else if(t==='mushroom')addMushroom(x,z);
  else if(t==='log')addFallenLog(x,z);
  else addTree(x,z); // 'tree'
}
for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  if(!isPark(i,j))continue;
  addCityPark(nodeX(i)+ROAD/2+SIDE,nodeX(j)+ROAD/2+SIDE,BLOCK-2*SIDE);
}
for(const v of worldData.cityParkVeg)plantSmall(v.t,v.x,v.z);
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

// Beach props (palms, umbrellas, chairs, half-buried rock clusters) are baked into
// world.json — see js/world-gen.js (rejection-sampled around the coast).
for(const p of worldData.beachPalms)addPalm(p.x,p.z);
for(const p of worldData.beachUmbrellas)addUmbrella(p.x,p.z);
for(const p of worldData.beachChairs)addChair(p.x,p.z);
{
  for(const r of worldData.beachRocks)addBeachRock(r.x,r.z,r.s);
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
  // Painted into a function so it can be re-run after a context loss (see groundTexRedraws).
  const paintRural=()=>{
  const {random:rnd,rand,irand}=makeRng(0x73a17e); // deterministic, repaint-stable noise
  x.fillStyle='#69a85e';x.fillRect(0,0,1024,512);
  for(let k=0;k<2600;k++){
    x.fillStyle=`rgba(${irand(70,115)},${irand(130,175)},${irand(60,95)},.22)`;
    x.fillRect(rnd()*1024,rnd()*512,irand(2,7),irand(2,7));
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
  // PRAÇA DA MATRIZ (proporções da matriz de Divinolândia): retângulo de grama com
  // passeios de piso intertravado claro — passeio central (rumo à igreja), anel em
  // volta do coreto e caminhos radiais. Ao NORTE da estrada (z>0): igreja na cabeceira
  // (z≈40), coreto a ~64% rumo ao sul (z≈14). Ver reference/divinolandia-praca/.
  {
    const PX0=TOWN_CX-12,PX1=TOWN_CX+12,PZ0=2,PZ1=44,czCor=14,s=(sx0+sz0)/2;
    x.fillStyle='#5f9e57';                                   // grama da praça
    x.fillRect(u(PX0),w(PZ0),u(PX1)-u(PX0),w(PZ1)-w(PZ0));
    x.fillStyle='#bdb6a6';                                   // piso: passeio central
    x.fillRect(u(TOWN_CX-1.6),w(PZ0+1),u(TOWN_CX+1.6)-u(TOWN_CX-1.6),w(PZ1-4)-w(PZ0+1));
    x.strokeStyle='#bdb6a6';x.lineCap='butt';
    x.lineWidth=2.4*s;                                       // passeio de perímetro
    x.strokeRect(u(PX0+1.5),w(PZ0+1.5),u(PX1-1.5)-u(PX0+1.5),w(PZ1-1.5)-w(PZ0+1.5));
    x.lineWidth=1.7*s;                                       // caminhos radiais do coreto
    for(let k=0;k<8;k++){const a=k*Math.PI/4;
      x.beginPath();x.moveTo(u(TOWN_CX),w(czCor));
      x.lineTo(u(TOWN_CX+Math.cos(a)*11),w(czCor+Math.sin(a)*11));x.stroke();}
    x.lineWidth=2.6*s;                                       // anel em volta do coreto
    x.beginPath();x.ellipse(u(TOWN_CX),w(czCor),6*sx0,6*sz0,0,0,Math.PI*2);x.stroke();
  }
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
    if(e===0)x.fillRect(rnd()*1024,rnd()*16,irand(3,8),irand(2,5));
    else if(e===1)x.fillRect(rnd()*1024,512-16+rnd()*16,irand(3,8),irand(2,5));
    else x.fillRect(1024-16+rnd()*16,rnd()*512,irand(2,5),irand(3,8));
  }
  };
  paintRural();
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
  groundTexRedraws.push(()=>{paintRural();t.needsUpdate=true;});
}

// Repaint the static ground textures + flag a GPU re-upload whenever the WebGL
// context is restored or the page returns to the foreground. On mobile, both can
// invalidate the original canvas upload and leave the ground rendering black.
function refreshGroundTextures(){for(const redraw of groundTexRedraws)redraw();}
renderer.domElement.addEventListener('webglcontextrestored',refreshGroundTextures,false);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGroundTextures();});

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
  // The whole rural forest (clustered trees, the pines lining the dirt road, the
  // undergrowth and the mushroom/log decay detail) is baked into world.json — see
  // js/world-gen.js for the clustering/exclusion rules. Every prop merges into the
  // batched chunk meshes at finalizeProps, so a thick wood is nearly free.
  const f=worldData.forest;
  for(const o of f.trees)plantSmall(o.t,o.x,o.z);    // 'pine' | 'tree'
  for(const o of f.bushes)addBush(o.x,o.z);
  for(const o of f.ferns)addFern(o.x,o.z);
  for(const o of f.details)plantSmall(o.t,o.x,o.z);  // 'mushroom' | 'log'
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
  // Rocks scattered on the slopes are baked into world.json (js/world-gen.js).
  for(const r of worldData.mountainRocks)addMountainRock(r.x,r.z,r.s);
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
  // Igreja do Divino Espírito Santo na CABECEIRA (norte) da praça, fachada + torre
  // voltadas pro sul (pra dentro da praça) — réplica da matriz de Divinolândia.
  solids.push(addIgrejaDivino(cx,40,Math.PI));
  // mercadinho + casas no lado norte da rua principal, de frente pro sul
  addGeneralStore(solids); // walk-in shop (exterior + off-map interior); pushes its own solids
  solids.push(addFarmHouse(cx+34,22,Math.PI));
  solids.push(addFarmHouse(cx+52,22,Math.PI));
  // moinho, casas e caixa d'água no lado sul, de frente pro norte
  solids.push(addWindmill(cx-36,-28));
  solids.push(addFarmHouse(cx-14,-24,0));
  solids.push(addFarmHouse(cx+22,-24,0));
  solids.push(addWaterTower(cx+50,-34));
  // ----- PRAÇA DA MATRIZ: coreto + jardim (proporções de Divinolândia) -----
  // retângulo ~24 (L-O) x 42 (N-S) ao norte da estrada; coreto a ~64% rumo ao sul,
  // árvores nos quadrantes do jardim, bancos virados pro passeio central.
  solids.push(addCoreto(cx,14));
  for(const[tx,tz]of[[cx-8.5,30],[cx+8.5,30],[cx-8.5,20],[cx+8.5,20],
    [cx-8.5,8],[cx+8.5,8],[cx-9,14],[cx+9,14]])addTree(tx,tz);
  for(const[bx,bz,br]of[[cx-4.4,24,Math.PI/2],[cx+4.4,24,-Math.PI/2],
    [cx-4.4,5,Math.PI/2],[cx+4.4,5,-Math.PI/2]])solids.push(addParkBench(bx,bz,br));
  // postes de luz nos cantos da praça + ao longo da rua principal
  for(const[lx,lz]of[[cx-11,41],[cx+11,41],[cx-11,4],[cx+11,4]])addStreetLamp(lx,lz);
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

// ----- Abandoned hamlet on the rural-city outskirts: a derelict row of farm
// houses reclaimed by the woods, south-west of Pine Hollow (off the mountain and
// the dirt road). The dense tree cover sells the "abandoned" feel. -----
for(const[hx,hz,hr]of[[440,-50,.25],[462,-64,-.35],[430,-38,.15],[566,-66,-.45],[598,-58,.3]])
  solids.push(addFarmHouse(hx,hz,hr));
// broadleaf trees crowding the derelict houses
for(const[tx,tz]of[[428,-46],[444,-62],[452,-36],[470,-54],[480,-70],[492,-44],
  [556,-58],[574,-72],[588,-50],[604,-66],[538,-74],[516,-56]])addTree(tx,tz);
// pines mixed in + a second grove on the north-east village outskirts
for(const[px,pz]of[[436,-70],[460,-44],[500,-72],[560,-80],[596,-72],[522,-66],
  [680,60],[712,72],[660,90]])addPine(px,pz);
for(const[tx,tz]of[[664,72],[690,64],[706,84],[672,96],[700,104]])addTree(tx,tz);

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
