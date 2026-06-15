// Verificação ASCII da costa da ilha (node puro, sem browser).
// Desenha isLand de cima e confere conteúdo em terra / boias no mar.
import {isLand,ruralHalf,cityCoastCheb,BOAT_SPAWN_X,BOAT_SPAWN_Z,
  WATER,SWIM_BOUND,RURAL_X0,RURAL_X1,RURAL_HALF,MOUNT_X,MOUNT_R,RURAL_TIP}
  from '../js/constants.js';

// --- mapa ASCII (vista de cima) -------------------------------------------
const X0=-300,X1=640,Z0=-300,Z1=300;
const COLS=120,ROWS=46;
let out='';
for(let r=0;r<ROWS;r++){
  const z=Z0+(r+.5)/ROWS*(Z1-Z0);
  let line='';
  for(let c=0;c<COLS;c++){
    const x=X0+(c+.5)/COLS*(X1-X0);
    line+= isLand(x,z) ? (Math.abs(x)<183&&Math.abs(z)<183?'#':'+') : '.';
  }
  out+=line+'\n';
}
console.log(out);
console.log('# = miolo cidade  + = terra/areia nova  . = mar\n');

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
// boias da prova (anel Chebyshev 253) — devem ser MAR
const CR=Math.round((WATER+SWIM_BOUND)/2);
// (eixo leste z≈0 é a península — ali NÃO há boia; boias do leste ficam a |z|≥142)
for(const[px,pz]of[[0,CR],[-CR,0],[0,-CR],[CR,CR],[-CR,CR],[CR,-CR],[-CR,-CR],[CR,142],[CR,-142],[0,233],[-233,0]])
  land.push([`boia/anel (${px},${pz}) deve ser MAR`,px,pz,false]);

let fails=0;
for(const[name,x,z,want]of land){
  const got=isLand(x,z);
  if(got!==want){console.log(`  ✗ ${name}: isLand=${got}, esperado ${want}`);fails++;}
}
console.log(fails?`\n${fails} FALHA(S) de containment`:'\nOK: todo conteúdo em terra, todas as boias no mar');
