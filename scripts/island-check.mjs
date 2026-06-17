// Verificação ASCII da costa da ilha (node puro, sem browser).
// Desenha isLand de cima e confere conteúdo em terra / boias no mar.
import {isLand,ruralHalf,cityCoastCheb,BOAT_SPAWN_X,BOAT_SPAWN_Z,
  WATER,SWIM_BOUND,RURAL_X0,RURAL_X1,RURAL_HALF,MOUNT_X,MOUNT_R,RURAL_TIP,TOWN_CX,
  ISLAND_CX,ISLAND_CZ,ISLAND_MAXR,islandCoastR,islandHeight,groundHeight}
  from '../js/constants.js';

// --- mapa ASCII (vista de cima) -------------------------------------------
const X0=-520,X1=770,Z0=-300,Z1=300;        // X0 estende a oeste pra mostrar a ilha
const COLS=140,ROWS=46;
const onIsland=(x,z)=>{const dx=x-ISLAND_CX,dz=z-ISLAND_CZ;
  return Math.hypot(dx,dz)<islandCoastR(Math.atan2(dz,dx));};
let out='';
for(let r=0;r<ROWS;r++){
  const z=Z0+(r+.5)/ROWS*(Z1-Z0);
  let line='';
  for(let c=0;c<COLS;c++){
    const x=X0+(c+.5)/COLS*(X1-X0);
    line+= onIsland(x,z) ? 'O'
         : isLand(x,z) ? (Math.abs(x)<183&&Math.abs(z)<183?'#':'+') : '.';
  }
  out+=line+'\n';
}
console.log(out);
console.log('# = miolo cidade  + = terra/areia  O = ilha paradisíaca  . = mar\n');

// --- range da costa da cidade (Chebyshev) ---------------------------------
let mn=1e9,mx=-1e9;
for(let i=0;i<360;i++){const v=cityCoastCheb(i*Math.PI/180);mn=Math.min(mn,v);mx=Math.max(mx,v);}
console.log(`cityCoastCheb ∈ [${mn.toFixed(1)}, ${mx.toFixed(1)}]  (precisa: ≥218 e ≤~248<253 boia)`);
// folga da prova: fora do cone das diagonais (slalom ligado, boia até Cheb 233) a
// costa precisa ficar bem abaixo de 233; no cone (slalom off, boia no anel 253) < 253
let offConeMax=0,inConeMax=0;
for(let i=0;i<720;i++){
  const th=i/720*Math.PI*2,deg=((th*180/Math.PI)%90+90)%90,dd=Math.abs(deg-45);
  const v=cityCoastCheb(th);
  if(dd<6.5)inConeMax=Math.max(inConeMax,v); else offConeMax=Math.max(offConeMax,v);
}
console.log(`costa fora-do-cone (slalom) max=${offConeMax.toFixed(1)} (precisa <233; folga ${(233-offConeMax).toFixed(1)})`);
console.log(`costa no-cone (diagonal) max=${inConeMax.toFixed(1)} (precisa <253; folga ${(253-inConeMax).toFixed(1)})`);
let rmn=1e9,rmx=-1e9;
for(let x=RURAL_X0;x<=RURAL_X1;x+=2){const v=ruralHalf(x);rmn=Math.min(rmn,v);rmx=Math.max(rmx,v);}
console.log(`ruralHalf(corpo) ∈ [${rmn.toFixed(1)}, ${rmx.toFixed(1)}]  (precisa: ≥120 e ≤~142 stub)`);
console.log(`RURAL_TIP=${RURAL_TIP}  BOAT_SPAWN=(${BOAT_SPAWN_X}, ${BOAT_SPAWN_Z})  (precisa mar: !isLand)\n`);

// --- containment: conteúdo precisa estar em TERRA -------------------------
const land=[
  ['boat spawn (deve ser MAR)', BOAT_SPAWN_X, BOAT_SPAWN_Z, false],
];
// props de praia: cantos do quadrado (Chebyshev 218)
for(const[px,pz]of[[218,0],[0,218],[-218,0],[0,-218],[216,216],[-216,216],[216,-216],[-216,-216],[183,183],[210,140]])
  land.push([`beach prop (${px},${pz})`,px,pz,true]);
// fazendas
for(const[px,pz]of[[332,-12],[366,10],[388,12],[412,-12],[432,10],[352,74],[440,-58]])
  land.push([`farm (${px},${pz})`,px,pz,true]);
// rancho / pinheiros extremos / montanha
land.push(['ranch (550,-80)',550,-80,true]);
land.push(['ranch sale (550,-88)',550,-88,true]);
land.push(['pine extremo (565,114)',565,114,true]);
land.push(['pine extremo (565,-114)',565,-114,true]);
land.push(['mountain E edge (570,0)',570,0,true]);
land.push(['mountain side (550,46)',550,46,true]);
land.push(['summit (509,0)',MOUNT_X,0,true]);
// vila rural "Pine Hollow" (depois da montanha): tudo em terra
for(const[px,pz]of[[TOWN_CX,0],[TOWN_CX,38],[TOWN_CX-30,22],[TOWN_CX+52,22],[TOWN_CX+50,-34],[TOWN_CX-54,9]])
  land.push([`town (${px},${pz})`,px,pz,true]);
// boias da prova (anel Chebyshev 253) — devem ser MAR. CR é FIXO (= COAST_R de
// boat-race.js); SWIM_BOUND cresceu pra ilha, mas o anel da prova ficou no lugar.
const CR=253;
// (eixo leste z≈0 é a península — ali NÃO há boia; boias do leste ficam a |z|≥142)
for(const[px,pz]of[[0,CR],[-CR,0],[0,-CR],[CR,CR],[-CR,CR],[CR,-CR],[-CR,-CR],[CR,142],[CR,-142],[0,233],[-233,0]])
  land.push([`boia/anel (${px},${pz}) deve ser MAR`,px,pz,false]);
// ILHA paradisíaca: centro e pontos bem dentro da costa = TERRA; logo fora = MAR;
// e a reta oeste da prova (x=-273) deve cair no MAR (a ilha não engole a pista).
land.push(['ilha centro',ISLAND_CX,ISLAND_CZ,true]);
for(let k=0;k<8;k++){
  const th=k/8*Math.PI*2,r=islandCoastR(th);
  const ix=ISLAND_CX+Math.cos(th)*(r-6),iz=ISLAND_CZ+Math.sin(th)*(r-6); // dentro
  const ox=ISLAND_CX+Math.cos(th)*(r+6),oz=ISLAND_CZ+Math.sin(th)*(r+6); // fora
  land.push([`ilha dentro @${(th*180/Math.PI)|0}°`,ix,iz,true]);
  land.push([`ilha fora @${(th*180/Math.PI)|0}°`,ox,oz,false]);
}
land.push(['prova reta-oeste (-273,0) deve ser MAR',-273,0,false]);
land.push(['prova reta-oeste (-273,-120) deve ser MAR',-273,-120,false]);

let fails=0;
for(const[name,x,z,want]of land){
  const got=isLand(x,z);
  if(got!==want){console.log(`  ✗ ${name}: isLand=${got}, esperado ${want}`);fails++;}
}
console.log(fails?`\n${fails} FALHA(S) de containment`:'\nOK: todo conteúdo em terra, todas as boias no mar');

// --- ilha: relevo + alcance de barco --------------------------------------
let peak=0;
for(let a=0;a<24;a++)for(let r=0;r<ISLAND_MAXR;r+=3){
  const th=a/24*Math.PI*2,x=ISLAND_CX+Math.cos(th)*r,z=ISLAND_CZ+Math.sin(th)*r;
  peak=Math.max(peak,groundHeight(x,z));
}
// borda mais distante da ilha (oeste) precisa caber dentro da parede do mar
let farEdge=0;
for(let a=0;a<360;a++){const th=a*Math.PI/180;farEdge=Math.max(farEdge,
  Math.abs(ISLAND_CX+Math.cos(th)*islandCoastR(th)),
  Math.abs(ISLAND_CZ+Math.sin(th)*islandCoastR(th)));}
console.log(`\nilha: pico groundHeight=${peak.toFixed(1)} (precisa >10)`);
console.log(`ilha: borda mais distante=${farEdge.toFixed(1)}  SWIM_BOUND=${SWIM_BOUND}  ` +
  `(precisa borda+margem < SWIM_BOUND p/ circundar de barco; folga ${(SWIM_BOUND-farEdge).toFixed(1)})`);
console.log(peak>10&&farEdge<SWIM_BOUND-12?'OK: ilha com morro e alcançável de barco'
  :'✗ ilha: relevo baixo ou fora do alcance do barco');
