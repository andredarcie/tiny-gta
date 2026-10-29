// Rua Joaquim Garcia — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/jg-N-*/ and jg-S-*/, kept out of git). 611 m
// north→south from the Avenida Marginal up to the José Augusto Machado. `s` starts at the
// NORTH end, so side 'N' is the EAST side (left of a walker going south) and 'S' the WEST.
//   s=164 R. Antônio de Melo   s=247 R. Cel. José Leopoldino   s=332 R. Treze de Maio
//   s=394 R. Romeu Zanetti   s=460 R. XV de Novembro   s=550 R. Sete de Setembro
// Asphalt to the Treze de Maio, granite setts from there up. Left alone (their own models):
// the gym's game lot, Supermercado Ramos, Auto Mais, Dondoca and Dassì (comercio/lojas.ts),
// the galpão by the Sete de Setembro and the corner lots of the cross streets' specs. Opening
// x is measured from the lot centre as SEEN FROM THE STREET (left negative): on the east side
// (N) left is NORTH (lower s), on the west side (S) left is SOUTH (higher s).
// Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Joaquim Garcia';
// house nº 667 (west side), whose front garden with the capybara statue extras.ts places
export const CAPIVARA_S0=50,CAPIVARA_S1=58;
export const CROSS=[0,164.3,247.3,331.6,393.6,460.4,550.5,611.3];
const SURFACE:Surface[]=[[0,331.6,'asphalt'],[331.6,611.3,'sett']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- Marginal → Antônio de Melo
  // grey-green roughcast corner house with pink trim and a dark round awning
  L('N',4,14,{wall:'#8fa89a',roof:'gable',roofColor:'#7a5a40',fascia:'#6a5a4a',plinth:{h:.5,c:'#e6c4b8'},
    open:[{t:'window',x:-1,w:2.2,frame:'#e6c4b8',awning:'#3a3a3a'},{t:'door',x:2.4,w:1,c:'#8a5a3a'}]}),
  // a grey sheet gate into a workshop yard
  muro('N',14,20,'#c9c4b8',2.4,{front:{h:2.4,c:'#c9c4b8',gates:[{t:'gate',x:0,w:3.4,c:'#9aa0a3'}]},behind:{w:5,d:8,at:2,roof:'flat',roofColor:'#8f8b84',wall:'#e8e4dc'}}),
  // an unfinished brick house, a precast wall
  L('N',20,27,{wall:'#b5683f',roof:'flat',fascia:'#b5683f',eave:.1,open:[{t:'door',x:1,w:.9,c:'#ece6da'}]}),
  muro('N',27,32,'#e2e0da',2),
  // grey block houses with red-painted gables, a carport under a dark tarp, grey roughcast
  L('N',32,40,{wall:'#8f8c86',roof:'gable',roofColor:T,fascia:'#a8392e',eave:.6,open:[{t:'window',x:0,w:1.8,shutters:'#c9ccce'}]}),
  L('N',40,46,{wall:'#a8a49c',roof:'gable',roofColor:T,open:[{t:'open',x:0,w:4,h:2.3,c:'casa',awning:'#3a3c40'}]}),
  L('N',46,52,{wall:'#8e9494',roof:'gable',roofColor:T,fascia:'#7a7c80',open:[{t:'window',x:0,w:1.2,grille:true}]}),
  // Colégio Objetivo: the cream block gable with the logo, then the blue block wall and gates
  L('N',52,60,{floors:2,wall:'#ecdcb0',roof:'flat',parapet:true,open:[{t:'gate',x:-2.6,w:2.6,c:'#e8d8a8'}],
    sign:{text:'COLÉGIO OBJETIVO',bg:'#ecdcb0',fg:'#2a3f8a',x:1.4,y:2.6,w:4.6,h:1.4}}),
  muro('N',60,68,'#1f3f8a',2.4,{front:{h:2.4,c:'#1f3f8a',gates:[{t:'gate',x:-2.6,w:2.6,c:'#e8d8a8'}]},
    behind:{w:7,d:9,at:3,roofColor:T,wall:'#f2f0ea'}}),
  muro('N',68,76,'#1f3f8a',2.4,{front:{h:2.4,c:'#1f3f8a',gates:[{t:'gate',x:1,w:1.2,c:'#e8d8a8'}]},behind:{w:7,d:9,at:3,roofColor:T,wall:'#f2f0ea'}}),
  muro('N',76,80,'#1f3f8a',2.4),
  // the gas depot: white over a pink base, DISK GÁS painted on the grey shed, cylinders under it
  L('N',80,86,{wall:'#f2f2f0',roof:'flat',parapet:true,plinth:{h:1.2,c:'#e8a49a'},open:[{t:'gate',x:.4,w:1.2,c:W}],
    sign:{text:'DISK GÁS',bg:'#a8b0b6',fg:'#f2f2ee',x:0,y:2.8,w:3.6,h:.8}}),
  L('N',86,92,{wall:'#f2f2f0',roof:'flat',fascia:'#a8b0b6',eave:.6,open:[{t:'open',x:0,w:5,h:3.2,c:'casa'}]}),
  // white wall of a house under a beige gable
  L('N',92,98,{wall:'#efe9dc',roof:'gable',roofColor:T,fascia:'#7a4a2e',setback:2,front:{h:2.4,c:'#efede6'}}),
  // Samuca, the body shop: an open steel shed behind a sheet gate
  L('N',98,112,{wall:'#c9cdd0',roof:'flat',fascia:'#a8aeb2',eave:.6,setback:3,front:{h:.3,c:'#9aa0a3',gates:[{t:'gate',x:3,w:4,c:'#a8aeb2'}]},
    open:[{t:'open',x:-1,w:7,h:3.6,c:'casa'}],sign:{text:'SAMUCA',bg:'#3a7a3a',fg:'#ffffff',x:-1,y:3.8,w:3,h:.7}}),
  // a precast wall round an empty lot, a house far back
  muro('N',112,122,'#b8b4aa',2,{behind:{w:8,d:8,at:3,roofColor:T,wall:'#efe9dc'}}),
  // roughcast cream walls with brown gates, the houses behind
  muro('N',122,131,'#e2d6bc',2.2,{front:{h:2.2,c:'#e2d6bc',gates:[{t:'gate',x:3,w:1.2,c:'#7a4a2e'}]},behind:{w:7,d:8,at:3,roofColor:T,wall:'#ece4d0'}}),
  L('N',131,137,{wall:'#ece4d0',roof:'hip',roofColor:T,setback:2,front:{h:2.4,c:'#e2d6bc',gates:[{t:'garage',x:.6,w:3.2,c:'#7a4a2e'}]}}),
  // blue-grey modern house: arched porch behind white gates
  L('N',137,146,{wall:'#8f9aaa',roof:'gable',roofColor:'#5a5a58',fascia:W,setback:3,front:{h:2,c:'#8f9aaa',gates:[{t:'gate',x:-3,w:2.2,c:W},{t:'gate',x:2.4,w:3.6,c:W}]},
    open:[{t:'arch',x:1,w:2.4,h:2.2,y:0}]}),
  // grey-green house behind its grey-green wall with clay coping, white arched louvred windows, roses
  L('N',146,159.6,{wall:'#9aa898',roof:'hip',roofColor:T,setback:2.5,front:{h:1.5,c:'#9aa898'},
    open:[{t:'arch',x:-3,w:1.8,shutters:W,frame:W},{t:'arch',x:1.6,w:1.8,shutters:W,frame:W}]}),
  // --- Antônio de Melo → Coronel José Leopoldino: Supermercado Ramos and its neighbours (comercio/lojas.ts)
  // --- Coronel José Leopoldino → Treze de Maio (Auto Mais on its stretch)
  // white house with a pillared veranda behind grey bars
  L('N',202,207,{wall:'#ece8e0',roof:'hip',roofColor:T,setback:2,front:{h:.4,c:'#c9c4bc',rail:{h:1.2,c:'#6a6c70',style:'bars'}},open:[{t:'open',x:0,w:3.6,h:2.3,c:'casa'}]}),
  // grey house with a geometric-tiled front, a white louvred window and a white garage
  L('N',207,218,{wall:'#a8acb0',roof:'gable',roofColor:T,fascia:W,panels:[{x:-2,w:5,c:'#c9c4bc'}],
    open:[{t:'window',x:-2,w:2.4,shutters:W,frame:W},{t:'garage',x:3,w:3,c:W}]}),
  // modern white house behind a glass fence and cypresses, a white garage door
  L('N',218,227,{wall:'#ece8e2',roof:'flat',parapet:true,panels:[{x:-1,w:1.2,c:'#b8a8a0'}],open:[{t:'door',x:-1,w:1,c:W},{t:'garage',x:2,w:2.8,c:W}]}),
  // a wooden gate beside a stone-tile pillar under a tree; a white wall over stone tiles with clay coping
  muro('N',227,234,'#e8e6e0',2.2,{front:{h:2.2,c:'#e8e6e0',gates:[{t:'gate',x:.6,w:2.2,c:'#8a7a64'}]},panels:[{x:3,w:1,stone:true}]}),
  muro('N',234,243.1,'#ece8e2',2.2,{behind:{w:8,d:8,at:3,roofColor:T,wall:'#ece4d6'}}),
  // (the corner: Auto Mais, comercio/lojas.ts)
  // white sobrado over a green base with an open junk-shop garage, stone-tile walls
  L('N',266,272,{floors:2,wall:'#f2f0ea',roof:'flat',parapet:true,plinth:{h:1,c:'#8aa04a'},open:[{t:'open',x:-1,w:3,h:2.3,c:'casa',awning:'#8a3a2e'},{t:'window',x:-1.4,w:1.8,fl:1}]}),
  L('N',272,276,{wall:'#d8d0c0',roof:'flat',parapet:true,panels:[{x:0,w:4,stone:true}]}),
  // modern beige house behind a glass fence
  L('N',276,286,{wall:'#e6d6c0',roof:'flat',parapet:true,setback:2,front:{h:1,c:'#e0d0b8',rail:{h:1,c:'#c8d8d8',style:'bars'}},open:[{t:'door',x:-1,w:1,c:W},{t:'glass',x:2.4,w:2.4}]}),
  // offices: white over a brown base, a dark glass front
  L('N',286,298,{wall:'#f2f0ea',roof:'gable',roofColor:T,fascia:'#7a4a2e',plinth:{h:.8,c:'#7a5a40'},
    open:[{t:'garage',x:-2.6,w:2.6,c:W},{t:'glass',x:1.6,w:3.2,y:0,h:2.6,frame:'#1c1c1c'},{t:'window',x:4.6,w:1,grille:true}]}),
  // the blue glass shop: Vidraçaria
  L('N',298,305,{wall:'#7aa0d8',roof:'flat',parapet:true,open:[{t:'open',x:0,w:3.6,h:2.6,c:'casa'}],sign:{text:'VIDRAÇARIA',bg:'#f2f2f0',fg:'#2a4a9a',x:0,y:2.8,w:2.6,h:.5}}),
  muro('N',305,310,'#ece8e0',2.2,{front:{h:2.2,c:'#ece8e0',gates:[{t:'gate',x:0,w:3,c:'#b8945a'}]}}),
  // cream sobrado on a brown band, a wooden door
  L('N',310,317,{floors:2,wall:'#c9a06a',upper:'#efe6d6',roof:'hip',roofColor:T,open:[{t:'door',x:.4,w:1,c:'#b8945a'},{t:'window',x:2.4,w:.8,grille:true},{t:'window',x:0,w:1.6,fl:1,shutters:W}]}),
  // old white corner house on a brown band
  L('N',317,327.4,{wall:'#f2f0ea',roof:'gable',roofColor:T,fascia:W,plinth:{h:1.2,c:'#b8783a'},
    open:[{t:'window',x:-3.4,w:1.2,shutters:W},{t:'window',x:-.6,w:1.6,grille:true},{t:'open',x:3,w:2.4,h:1.6,y:1.2,c:'casa'}]}),
  // --- Treze de Maio → Romeu Zanetti
  // grey sobrado on the corner: a tiled porch over the garden behind a white iron fence
  L('N',335.4,348,{floors:2,wall:'#b9bcc4',roof:'hip',roofColor:T,setback:2,front:{h:.4,c:'#b8a88a',style:'stone',rail:{h:.8,c:W,style:'bars'}},
    open:[{t:'open',x:-1,w:6,h:2.3,c:'casa',awning:T},{t:'arch',x:2,w:1,fl:1},{t:'arch',x:3.6,w:1,fl:1}],balcony:{x:-3,w:3,fl:1,rail:'white'}}),
  // an empty lot behind precast walls
  muro('N',348,362,'#b8b4aa',2,{front:{h:2,c:'#b8b4aa',gates:[{t:'gate',x:2,w:4,c:'#8a5a3a'}]}}),
  // modern beige house: stone-tile walls, white gates
  L('N',362,372,{wall:'#e6dccb',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#d8d0c0',rail:{h:.1,c:W,style:'bars'},gates:[{t:'gate',x:-1,w:3,c:W},{t:'door',x:2.6,w:1,c:W}]},
    panels:[{x:0,w:2,stone:true}]}),
  L('N',372,380,{wall:'#ece4d0',roof:'hip',roofColor:T,panels:[{x:2.6,w:1.2,stone:true}],open:[{t:'garage',x:-.6,w:3.4,c:W}]}),
  L('N',380,388.6,{wall:'#f2f0ea',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#d87a6a'},open:[{t:'window',x:-1,w:1.6,grille:true,frame:'#8a3a2e'}]}),
  // --- Romeu Zanetti → XV de Novembro
  // the old red-earth wall of the wooded yard, a red gate
  muro('N',397.5,407,'#c8805a',2.2),
  muro('N',407,416,'#c8805a',2.2),
  muro('N',416,426,'#c8805a',2.2,{front:{h:2.2,c:'#c8805a',gates:[{t:'gate',x:2,w:2.6,c:'#9a3a2e'}]}}),
  // old pink sobrado: a shop with a red roll door under a tin awning, maroon shutters above
  L('N',426,444,{floors:2,wall:'#c8806a',upper:'#ece4d6',roof:'hip',roofColor:T,
    open:[{t:'gate',x:-6,w:1.2,c:'#9a3a2e'},{t:'garage',x:-2.6,w:3,c:'#b8442e',awning:'#4f6f7f'},{t:'shop',x:1.4,w:2.4,c:'#3a3a3a',awning:'#3a3a3a'},{t:'door',x:5.6,w:1.4,c:'#6a3a2a'},
      {t:'window',x:-5,w:1.4,fl:1,shutters:'#8a2a24'},{t:'window',x:0,w:1.4,fl:1,shutters:'#8a2a24'},{t:'window',x:5,w:1.4,fl:1,shutters:'#8a2a24'}]}),
  // the old pink-and-cream chalet behind its balustrade wall, on the XV corner
  L('N',444,455.7,{wall:'#efe0d4',roof:'gable',roofColor:'#8a5a40',fascia:'#8a4a3a',eave:.8,plinth:{h:1.4,c:'#c8806a'},setback:2,
    front:{h:1,c:'#c8806a',rail:{h:.6,c:'#efe6da',style:'bars'}},open:[{t:'window',x:-2,w:1.2,shutters:'#8a3a2a'},{t:'window',x:1.6,w:1.2,shutters:'#8a3a2a'}]}),
  // --- XV de Novembro → Sete de Setembro (Dondoca and the Microlins corner)
  // Vitally: grey ground floor, yellow-and-white louvred upper floor
  L('N',480,490,{floors:2,wall:'#8a8c90',upper:'#ecd27a',roof:'flat',parapet:true,
    open:[{t:'glass',x:0,w:3.4,y:0,h:2.4,frame:'#3a3a3a'},{t:'window',x:0,w:6,fl:1,shutters:W}],sign:{text:'VITALLY',bg:'#c8d8d0',fg:'#2a5a4a',x:0,y:2.6,w:2.6,h:.5}}),
  // yellow houses with painted bands: a garage, a white door
  L('N',490,500,{wall:'#ecd89a',roof:'gable',roofColor:T,setback:2.5,front:{h:2.2,c:'#ecd89a',gates:[{t:'garage',x:0,w:3.4,c:'#e8e8e6',awning:T},{t:'door',x:3.4,w:1,c:W}]}}),
  L('N',500,506,{wall:'#e6dccb',roof:'gable',roofColor:T,setback:2,front:{h:2.2,c:'#e6dccb',gates:[{t:'garage',x:-1,w:2.6,c:W,awning:T},{t:'door',x:1.6,w:1,c:W}]}}),
  // nº 210: white and red, maroon shutters
  L('N',506,516,{wall:'#f2f0ea',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',eave:.8,panels:[{x:-2,w:3,c:'#a83a2e'}],
    open:[{t:'door',x:-4,w:1,c:'#6a3a2a'},{t:'window',x:-2,w:1.8,shutters:'#7a2a24'},{t:'window',x:2,w:2,shutters:'#7a2a24'}]}),
  // a red-pillared gate and the house behind its railings; the little office under a hip roof
  L('N',516,522,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#e8e4dc',rail:{h:1.2,c:'#3a3a3a',style:'bars'},gates:[{t:'door',x:-2,w:1,c:'#7a2a24'}]}}),
  L('N',522,530,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:2,front:{h:.4,c:'#e8e4dc',rail:{h:1,c:'#3a3a3a',style:'bars'}},
    open:[{t:'window',x:-.6,w:1.6,frame:'#3a3a3a'},{t:'door',x:1.8,w:.9,c:'#3a3a3a'}]}),
  // block walls round an empty lot to the corner
  muro('N',530,538,'#9a958c',2),
  muro('N',538,546.5,'#9a958c',2),
  // --- Sete de Setembro → José Augusto Machado
  // cream corner house with a porch, ochre base wall
  L('N',554.4,564,{wall:'#ece6d0',roof:'hip',roofColor:T,setback:2,plinth:{h:1,c:'#d8b05a'},front:{h:1.2,c:'#d8b05a',gates:[{t:'gate',x:-1,w:1.4,c:'#8a5a3a'}]},
    open:[{t:'open',x:0,w:3,h:2.3,c:'casa'},{t:'window',x:3.4,w:1,shutters:'#8a5a3a'}]}),
  // ================= WEST SIDE (S) =================
  // --- Marginal → Antônio de Melo
  // roughcast beige house at the Marginal corner
  L('S',5,16,{wall:'#b9a890',roof:'hip',roofColor:T,plinth:{h:.6,c:'#8a7a64'},open:[{t:'window',x:0,w:1.2,grille:true,frame:W}]}),
  // little pink gable house, a white barred gate, a roughcast house beside it
  L('S',16,21,{wall:'#e2c2b8',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',open:[{t:'window',x:0,w:1.4,frame:W}]}),
  L('S',21,26,{wall:'#b9a890',roof:'hip',roofColor:T,open:[{t:'gate',x:1,w:2,c:W},{t:'window',x:-1.4,w:1.2,grille:true,frame:W}]}),
  // taupe gable houses behind taupe precast fences with brown gates
  L('S',26,34,{wall:'#cbb4a4',roof:'gable',roofColor:'#6a5a4a',fascia:'#6a5a4a',setback:3,front:{h:1.6,c:'#cbb4a4',gates:[{t:'gate',x:2,w:1.2,c:'#5a3a2a'},{t:'gate',x:-2.6,w:2.4,c:'#7a5a40'}]},
    open:[{t:'window',x:1,w:1.2,frame:W},{t:'window',x:-1.4,w:1.2,frame:W}]}),
  L('S',34,42,{wall:'#cbb4a4',roof:'gable',roofColor:'#6a5a4a',fascia:'#6a5a4a',setback:3,front:{h:1.6,c:'#cbb4a4',gates:[{t:'gate',x:-.6,w:1.2,c:'#5a3a2a'},{t:'gate',x:3,w:2.4,c:W}]},
    open:[{t:'window',x:-1,w:1.2,frame:W},{t:'window',x:1.6,w:1.2,frame:W}]}),
  // roughcast grey-beige gable house with a barred carport
  L('S',42,50,{wall:'#b8b0a2',roof:'gable',roofColor:T,fascia:W,open:[{t:'gate',x:1,w:3,c:'#e8e8e6'},{t:'window',x:-2.4,w:1.6,grille:true,frame:W}]}),
  // nº 667, across from the Objetivo: roughcast beige with a white scalloped fascia, the green
  // recessed porch on the left, the barred window on the right, white bars in front. The
  // capybara statue and the plants on its front are a model of their own (extras.ts)
  L('S',CAPIVARA_S0,CAPIVARA_S1,{wall:'#b8a898',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:.4,c:'#b8a898',rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'open',x:-1.4,w:2.6,h:2.3,c:'casa'},{t:'window',x:1.8,w:1.8,grille:true,frame:W}]}),
  // taupe house behind a taupe wall with a white gate
  L('S',58,66,{wall:'#c9b4a0',roof:'gable',roofColor:'#6a5a4a',setback:3,front:{h:1.6,c:'#c9b4a0',gates:[{t:'gate',x:3,w:2.4,c:W}]}}),
  // lime-green houses: grey garage doors, grilled windows
  L('S',66,80,{wall:'#d8dc9a',roof:'gable',roofColor:'#6a5a4a',fascia:'#6a5a4a',
    open:[{t:'gate',x:5.4,w:2.2,c:'#8f9ca6'},{t:'gate',x:3,w:2.2,c:'#8f9ca6'},{t:'window',x:0,w:1.8,grille:true},{t:'window',x:-4,w:1.4,grille:true}]}),
  L('S',80,88,{wall:'#d8dc9a',roof:'gable',roofColor:'#6a5a4a',fascia:'#6a5a4a',open:[{t:'window',x:-1.6,w:1.8,grille:true}]}),
  // peeling grey houses behind precast and iron fences
  L('S',88,96,{wall:'#a8aca8',roof:'hip',roofColor:T,setback:2,front:{h:1.6,c:'#c9c6be'},open:[{t:'window',x:-1,w:1.4,shutters:'#8a94a0'}]}),
  L('S',96,106,{wall:'#a8b0b4',roof:'gable',roofColor:'#6a6a68',fascia:W,setback:2,front:{h:.4,c:'#8a7a64',style:'stone',rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'open',x:2.6,w:3,h:2.3,c:'casa'},{t:'window',x:-.6,w:1.8,grille:true},{t:'window',x:-3.4,w:1.6,shutters:W}]}),
  // nº 619: terracotta house, arched window, a stone wall with white railings
  L('S',106,115,{wall:'#d9846a',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',setback:2.5,front:{h:.8,c:'#8a7a64',style:'stone',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:-1,w:3,c:W}]},
    open:[{t:'arch',x:2,w:2.4},{t:'open',x:-1.4,w:2.4,h:2.2,c:'casa'}]}),
  // houses going up in bare brick
  L('S',115,123,{wall:'#b5683f',roof:'flat',fascia:'#9a958c',eave:.4,open:[{t:'open',x:1,w:2,h:2.2,c:'casa'},{t:'window',x:-2,w:1.6}]}),
  L('S',123,129,{wall:'#9a958c',roof:'flat',fascia:'#b5683f',eave:.3,open:[{t:'gate',x:0,w:2.4,c:W}]}),
  // nº 599: white house with a stone porch, white picket gates on white pillars
  L('S',129,139,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:3,panels:[{x:1,w:1.6,stone:true}],
    front:{h:.6,c:'#8a7a64',style:'stone',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:3,w:3,c:W}]},
    open:[{t:'door',x:1,w:1,c:'#7a3a2a'},{t:'window',x:-2.6,w:1.8,grille:true}]}),
  // nº 583: cream house, a brown-framed window
  L('S',139,146,{wall:'#ece6d0',roof:'gable',roofColor:T,fascia:W,plinth:{h:.4,c:'#c9a684'},open:[{t:'window',x:0,w:2.2,frame:'#7a4a2e',grille:true}]}),
  // grey corner sobrado on a granite-textured ground floor, white louvred windows
  L('S',146,160,{floors:2,wall:'#8f8c86',upper:'#c9c4bc',roof:'gable',roofColor:T,fascia:W,
    open:[{t:'window',x:-2,w:1.2,frame:W,shutters:W},{t:'window',x:2,w:1.6,fl:1,shutters:W},{t:'window',x:-3,w:1.6,fl:1,shutters:W}]}),
  // --- Antônio de Melo → Coronel José Leopoldino
  // yellow-beige roughcast corner house trimmed in grey
  L('S',169.2,178,{wall:'#d9c79a',roof:'gable',roofColor:'#6a6a68',fascia:'#6a6a68',plinth:{h:.4,c:'#3a3a3c'},band:'#a8acb0',open:[{t:'window',x:0,w:1.6,frame:'#a8acb0'}]}),
  L('S',178,186,{wall:'#d9c79a',roof:'gable',roofColor:'#6a6a68',fascia:'#6a6a68',plinth:{h:.4,c:'#3a3a3c'},band:'#a8acb0',
    open:[{t:'window',x:-1,w:1.6,frame:'#a8acb0'},{t:'open',x:2.6,w:2.4,h:2.3,c:'casa'}]}),
  // grey house with white diamond outlines and white louvred windows
  L('S',186,196,{wall:'#8e928e',roof:'flat',parapet:true,open:[{t:'window',x:-1,w:2.2,shutters:W,frame:W},{t:'window',x:3.4,w:1.4,shutters:W}]}),
  // grey-green house with white diamonds, a white garage under a clay awning
  L('S',194,204,{wall:'#8a9a8a',roof:'gable',roofColor:'#5a5a58',fascia:'#5a5a58',open:[{t:'garage',x:3,w:2.8,c:W,awning:T},{t:'window',x:-1,w:1.6,frame:W},{t:'window',x:-3.6,w:1.4,shutters:W}]}),
  // whitewashed wall with rusty sheet gates, the beige house behind; a striped wooden fence
  muro('S',204,212,'#e8e4dc',2,{front:{h:2,c:'#e8e4dc',gates:[{t:'gate',x:2,w:2.8,c:'#a8743a'}]},behind:{w:7,d:8,at:3,roofColor:'#6a6a68',wall:'#e2d4c4'}}),
  muro('S',212,216,'#9ab88a',2),
  // block wall and the car-care shop: yellow, a blue awning, ESTETICAR
  muro('S',216,224,'#9a958c',2),
  L('S',224,236,{floors:2,wall:'#e8d8d0',roof:'flat',parapet:true,plinth:{h:1,c:'#6a6c70',stone:true},
    open:[{t:'open',x:-3,w:3,h:2.6,c:'casa',awning:'#1f3f8a'},{t:'garage',x:1.4,w:2.6,c:'#7a6a58'},{t:'door',x:3.8,w:1,c:'#7a6a58'},{t:'window',x:2,w:2,fl:1,shutters:W}],
    balcony:{x:0,w:12,fl:1,rail:'iron'},sign:{text:'ESTETICAR',bg:'#1c1c1e',fg:'#f2d21a',x:-3,y:2.8,w:2.6,h:.5}}),
  // grey roughcast corner house behind a grey iron fence
  L('S',236,243.5,{wall:'#8f9496',roof:'gable',roofColor:'#5a5a58',fascia:W,setback:2,front:{h:.6,c:'#e8e8e4',rail:{h:1,c:'#8f9496',style:'bars'}},
    open:[{t:'window',x:0,w:1.8,shutters:'#8f9496',frame:W}]}),
  // --- Coronel José Leopoldino → Treze de Maio
  // brick-tile clad sobrado on the corner, a dark brown garage door
  L('S',252,266,{floors:2,wall:'#c9895a',upper:'#ece4d6',roof:'hip',roofColor:T,
    open:[{t:'window',x:-4,w:1.4,grille:true},{t:'window',x:-1,w:1.4,grille:true},{t:'garage',x:3,w:3,c:'#5a3a2a'},{t:'window',x:-3,w:1.6,fl:1},{t:'window',x:1,w:1.6,fl:1}]}),
  // cream house on a dark red base, brown shutters, a recessed porch
  L('S',266,274,{wall:'#ece4cc',roof:'gable',roofColor:T,plinth:{h:.9,c:'#7a2a24'},open:[{t:'open',x:2.6,w:2.2,h:2.2,c:'casa'},{t:'window',x:0,w:1.4,shutters:'#6a3a2a'},{t:'open',x:-2.6,w:2,h:1.4,y:1,c:'casa'}]}),
  // green house: a stone-clad wall, a grey garage under clay tiles
  L('S',274,284,{wall:'#7a9a6a',roof:'gable',roofColor:T,fascia:W,panels:[{x:-2,w:3,stone:true}],open:[{t:'garage',x:2.4,w:3,c:'#5a6268',awning:T}]}),
  // an empty lot behind green walls, a stone-clad gate pier
  muro('S',284,296,'#7a9a6a',1.8,{front:{h:1.8,c:'#7a9a6a',gates:[{t:'door',x:-4,w:1,c:'#5a6268'}]}}),
  // the old blue building, an empty lot, the blue house with a roll door
  L('S',296,304,{wall:'#4a6ab8',roof:'flat',parapet:true,open:[{t:'window',x:-1,w:.8,y:2,grille:true},{t:'window',x:1,w:.8,y:2,grille:true}]}),
  muro('S',304,307,'#9a958c',1.6),
  L('S',307,316,{wall:'#4a6ab8',roof:'hip',roofColor:T,open:[{t:'garage',x:-1,w:2.4,c:'#8f9aa8'},{t:'window',x:1.4,w:1.6,grille:true},{t:'window',x:3.6,w:1.8,grille:true}]}),
  // cream corner house over a brown speckled band, brown shutters
  L('S',316,327.6,{wall:'#f2ecdc',roof:'hip',roofColor:T,plinth:{h:1.4,c:'#a8784a'},open:[{t:'window',x:-3,w:1.8,shutters:'#b8945a'},{t:'window',x:1,w:1.8,shutters:'#b8945a'},{t:'garage',x:4.6,w:2,c:'#b8945a'}]}),
  // --- Treze de Maio → Romeu Zanetti (the gym's game lot from s 352)
  // white sobrado on a grey granite base, then a brick-faced house behind white railings
  L('S',335.4,340,{floors:2,wall:'#8f9094',upper:'#f2f0ea',roof:'gable',roofColor:T,fascia:W,open:[{t:'garage',x:0,w:2.4,c:W},{t:'window',x:0,w:1,fl:1}]}),
  L('S',340,346,{wall:'#b5603f',roof:'flat',fascia:W,eave:.8,setback:1.5,front:{h:.6,c:'#8a8a86',rail:{h:1.2,c:W,style:'bars'}},panels:[{x:-2,w:2,c:'#f2f0ea'}],open:[{t:'window',x:1.4,w:2.6,frame:W}]}),
  // pink-pillared porch house behind a white picket fence
  L('S',346,352,{wall:'#f2ecdc',roof:'hip',roofColor:T,setback:2,panels:[{x:-.6,w:1.2,c:'#e6a890'}],front:{h:.3,c:W,rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'open',x:-2,w:1.8,h:2.2,c:'casa'},{t:'arch',x:-.6,w:.9,h:1.8,y:0},{t:'window',x:2,w:1.6,frame:W}]}),
  // --- Romeu Zanetti → XV de Novembro (the corner house is the Romeu Zanetti's)
  // the whitewashed wall of an old warehouse with a roll door and a sheet gate
  L('S',410,420,{wall:'#ece4d6',roof:'flat',fascia:'#3a3a3a',eave:.3,open:[{t:'garage',x:3,w:2.4,c:'#d8d8d6'}]}),
  muro('S',420,426,'#ece4d6',2.6,{front:{h:2.6,c:'#ece4d6',gates:[{t:'gate',x:0,w:3.4,c:'#c9ccce'}]}}),
  // Tina's Lanches: black and red under a red awning, barred front, the burger poster
  L('S',426,442,{wall:'#1c1c1e',roof:'hip',roofColor:T,setback:1,front:{h:.6,c:'#1c1c1e',rail:{h:1.4,c:'#2a2a2a',style:'bars'}},
    open:[{t:'open',x:0,w:8,h:2.4,c:'casa',awning:'#c8322c'},{t:'gate',x:-6,w:2.6,c:'#c8ccd0'}],sign:{text:'TINAS LANCHES',bg:'#e8762b',fg:'#1c1c1e',x:4.6,y:1.2,w:1.4,h:1.6}}),
  // --- XV de Novembro → Sete de Setembro
  // nº 325: white with teal trim on a dark tiled base
  L('S',465.4,474,{wall:'#f2f2f0',roof:'hip',roofColor:T,fascia:'#3a8a8a',plinth:{h:1,c:'#3a3a3c'},open:[{t:'window',x:-1,w:2.2,frame:'#3a8a8a'},{t:'door',x:3,w:1,c:'#3a8a8a'}]}),
  // white walls with teal garage doors, clay roofs behind
  L('S',474,482,{wall:'#f2f2f0',roof:'hip',roofColor:T,fascia:'#3a8a8a',open:[{t:'garage',x:-1.6,w:2.8,c:'#3a8a8a'},{t:'window',x:1.6,w:1.4,frame:'#3a8a8a'}]}),
  L('S',482,490,{wall:'#f2f2f0',roof:'hip',roofColor:T,fascia:'#3a8a8a',open:[{t:'garage',x:1.6,w:2.8,c:'#3a8a8a'},{t:'garage',x:-2.6,w:2,c:'#3a8a8a'}]}),
  // olive-beige houses striped in white: nº 221, then the Saúde da Família unit
  L('S',490,498,{wall:'#b9ae8c',roof:'flat',parapet:true,band:'#efe9dc',open:[{t:'window',x:2,w:1.4,grille:true},{t:'gate',x:-1.4,w:2.6,c:'#2a3a4a'}]}),
  L('S',498,509,{wall:'#b9ae8c',roof:'flat',parapet:true,band:'#efe9dc',
    open:[{t:'open',x:3.4,w:2.6,h:2.4,c:'casa'},{t:'door',x:0,w:1,c:'#e8e4dc'},{t:'window',x:-2.4,w:2,grille:true}],
    sign:{text:'SAÚDE DA FAMÍLIA',bg:'#1f4aa0',fg:'#ffffff',x:3.4,y:2.6,w:2.8,h:.5}}),
  // white houses: slit windows, the dentist's wood-clad panel
  L('S',509,522,{wall:'#ece4d8',roof:'hip',roofColor:T,setback:1,panels:[{x:1,w:3,c:'#8a5a3a'}],front:{h:2,c:'#ece4d8'},open:[{t:'window',x:-3,w:.4,h:1.6},{t:'window',x:-2,w:.4,h:1.6},{t:'window',x:4,w:.4,h:1.6}],
    sign:{text:'ODONTOLOGIA',bg:'#8a5a3a',fg:'#f2f0ea',x:1,y:1.4,w:2.6,h:.5}}),
  // grey-mauve sobrado, white garage door with teal bands
  L('S',522,532,{floors:2,wall:'#b8a8a8',roof:'flat',parapet:true,open:[{t:'garage',x:-1,w:3,c:'#e8f2ee'},{t:'door',x:2.6,w:1,c:W},{t:'window',x:0,w:2.4,fl:1}],balcony:{x:0,w:6,fl:1,rail:'glass'}}),
  // modern house among fan palms, grey brick, a white garage
  L('S',532,546,{floors:2,wall:'#e6e2dc',roof:'flat',parapet:true,panels:[{x:-3,w:4,c:'#b8b4ae',y0:2.9,y1:5.8}],open:[{t:'garage',x:-3,w:3,c:'#e8f2ee'},{t:'window',x:2,w:2.4,fl:1}],balcony:{x:2,w:4,fl:1,rail:'glass'}}),
];

export const TREES:Tree[]=[
  {side:'N',s:156,kind:'reseda'},{side:'S',s:180,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  settStreets:['Rua Treze de Maio','Rua Romeu Zanetti','Rua XV de Novembro','Rua Sete de Setembro'],
  poles:{side:'S',start:12,every:34,transformers:[90,260,440]},
  keepOut:[
    {side:'S',s0:352,s1:372,why:'gym game lot (sites-table.ts gym)'},
    {side:'S',s0:550.5,s1:611.3,why:'Centro de Saúde III (publicos.ts)'},
  ],
};
