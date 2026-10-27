// Rua Campos Salles — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/cs-N-*/ and cs-S-*/, kept out of git). The street
// runs 559 m north→south from the Avenida Marginal through the centre to the Sete de Setembro.
//   s=74 service road   s=94 R. Antônio de Moura   s=118 R. Armando Grespan   s=168 R. Antônio de Melo
//   s=251 R. Cel. José Leopoldino   s=339 R. Treze de Maio   s=399 R. Romeu Zanetti
//   s=467 R. XV de Novembro   s=559 R. Sete de Setembro
// Side 'N' is the EAST side (left of a walker going +s, i.e. south). Opening x is measured from
// the lot centre as SEEN FROM THE STREET (left negative). Where the cross street is surveyed
// too (Leopoldino, Treze, Romeu, XV) its own corner lots already stand, so this street keeps
// ~12 m clear of those crossings. The shops already in comercio/lojas.ts (Paratodos, Soraia,
// Casulo, Toque Cell, Zema, Primo's, Zeza) and the Câmara's covered park (the Terminal
// Rodoviário / CAC front) are left where they are. Lot depth (d + setback) ≤ 12 m. Pure data.
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Campos Salles';
export const CROSS=[0,74.1,94.4,118.2,168.2,250.7,339,398.5,467,558.6];
const SURFACE:Surface[]=[[0,250.7,'asphalt'],[250.7,530,'sett'],[530,558.6,'asphalt']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- Marginal → service road
  // grey-beige houses under fibre-cement roofs, nº 1060 with a barred door
  L('N',6,14,{wall:'#c8bca4',roof:'gable',roofColor:'#c8c4bc',fascia:'#5a3a2a',open:[{t:'window',x:0,w:1.2,frame:W}]}),
  L('N',14,22,{wall:'#e6e2dc',roof:'gable',roofColor:'#c8c4bc',fascia:'#5a3a2a',open:[{t:'window',x:-2.4,w:1.8,grille:true,frame:W},{t:'door',x:-.4,w:1,c:W},{t:'window',x:2.4,w:1.8,shutters:W}]}),
  L('N',22,27,{wall:'#ece8e2',roof:'gable',roofColor:'#9a9690',open:[{t:'window',x:-1,w:1.4,grille:true},{t:'door',x:1.4,w:.9,c:'#5a5a58'}]}),
  // the auto service shed: white walls with blue and yellow bands, a steel roof, open to the street
  L('N',27,40,{wall:'#ece8e2',roof:'flat',parapet:true,panels:[{x:-6,w:.8,c:'#2a4ab0'},{x:6,w:.8,c:'#2a4ab0'},{x:0,w:13,c:'#e8c03a',y0:1.2,y1:1.5}],open:[{t:'open',x:0,w:10,h:4,c:'casa'}]}),
  // an empty lot with old cars, a willow and an ixora hedge
  muro('N',40,58,'#b8b4aa',.3),
  // nº 4?2: the beige corner house with a dark slatted gate
  L('N',58,69.6,{wall:'#ddd0bc',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',open:[{t:'gate',x:-3,w:3,c:'#3a4048'},{t:'window',x:1,w:2.6,grille:true,frame:'#3a4048'},{t:'window',x:4.4,w:1.8,shutters:'#3a4048'}]}),
  // --- service road → Antônio de Melo
  // the beige houses with wide louvred windows
  L('N',78,88,{wall:'#ddd4c8',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',open:[{t:'window',x:-1.6,w:4,shutters:'#d8c8a8'},{t:'window',x:3,w:1.6,grille:true}]}),
  L('N',88,96,{wall:'#ddd4c8',roof:'hip',roofColor:T,setback:2,front:{h:1.6,c:'#a8a49c',gates:[{t:'gate',x:2,w:1,c:'#3a3a3a'}]}}),
  // the yellow house with an iron fence on a red base
  L('N',96,104,{wall:'#e6cc88',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#8a3a2a',rail:{h:1,c:'#2a2a2a',style:'bars'}},open:[{t:'window',x:-1.4,w:1.6,frame:W},{t:'door',x:1.4,w:1,c:W}]}),
  // the white houses behind a white wall with a barred gate
  L('N',104,112,{wall:'#e6dcd0',roof:'hip',roofColor:T,setback:3,front:{h:1.6,c:'#ece8e2',gates:[{t:'gate',x:-2,w:2.6,c:W}]}}),
  // the old house behind iron railings, and its blue workshop door
  L('N',112,118,{wall:'#ecd0c8',roof:'hip',roofColor:T,setback:2,front:{h:1.2,c:'#ece8e2',rail:{h:1,c:'#2a2a2a',style:'bars'}}}),
  L('N',118,126,{wall:'#ecd0c8',roof:'gable',roofColor:'#6a6c70',open:[{t:'garage',x:-.6,w:4,c:'#4a8ad0'},{t:'gate',x:3,w:1,c:'#4a8ad0'}]}),
  // an open timber carport, then grey stone garages
  L('N',126,134,{wall:'#c8b49a',roof:'flat',parapet:true,open:[{t:'open',x:-2,w:2.6,h:2.4,c:'casa'},{t:'garage',x:1.8,w:3,c:'#a8b8c8'}]}),
  L('N',134,142,{wall:'#b8a890',roof:'hip',roofColor:T,open:[{t:'garage',x:-2,w:3,c:'#a8b8c8'},{t:'door',x:.6,w:.8,c:'#a8b8c8'},{t:'garage',x:2.8,w:2.4,c:'#a8b8c8'}]}),
  // the pale speckled wall with a tiled-hood garage
  L('N',142,150,{wall:'#c8c4bc',roof:'hip',roofColor:T,setback:3,front:{h:2.2,c:'#c8c4bc',gates:[{t:'garage',x:-1.4,w:3,c:'#a8b8c8',awning:T},{t:'door',x:2.4,w:1,c:'#a8b8c8'}]}}),
  // the long red-speckled wall with white pilasters, the white shed above it, a red garage
  L('N',150,163.4,{wall:'#ece8e2',roof:'flat',fascia:'#c8c8c4',setback:3,front:{h:2.4,c:'#8a2a24',gates:[{t:'garage',x:5,w:3,c:'#8a2a24'}]},open:[{t:'window',x:-3,w:2,y:2.6},{t:'window',x:1,w:2,y:2.6}]}),
  // --- Antônio de Melo → Cel. José Leopoldino
  // old shacks with fibre-cement lean-tos on the corner
  L('N',172,180,{wall:'#d8d4ca',roof:'gable',roofColor:'#9a9690',setback:1,front:{h:1.2,c:'#9a9690'},open:[{t:'open',x:0,w:3,h:2,c:'casa',awning:'#c8c4bc'}]}),
  L('N',180,186,{wall:'#ece8e2',roof:'gable',roofColor:'#9a9690',setback:1,front:{h:1.2,c:'#9a9690',gates:[{t:'gate',x:0,w:1,c:'#3a3a3a'}]}}),
  // the peach sobrado, then the peach cottage with a gabled timber carport
  L('N',186,192,{floors:2,wall:'#e6c4a8',roof:'gable',roofColor:T,open:[{t:'window',x:0,w:1.2,frame:W}]}),
  L('N',192,200,{wall:'#e6c4a8',roof:'gable',roofColor:'#6a3a2a',fascia:'#6a3a2a',open:[{t:'gate',x:1,w:3.6,c:'#3a3a3a',awning:'#6a3a2a'},{t:'window',x:-2.4,w:1.4,frame:W}]}),
  // nº 300: the pink house with two white garage gates
  L('N',200,210,{wall:'#e6b8c0',roof:'hip',roofColor:T,open:[{t:'window',x:-3.6,w:1,grille:true},{t:'door',x:-2.2,w:1,c:W},{t:'gate',x:0,w:3,c:W},{t:'gate',x:3.4,w:3,c:W}]}),
  // the old white house and yard with a sheet gate
  L('N',210,216,{wall:'#ece8e2',roof:'hip',roofColor:'#8a4a32',open:[{t:'open',x:-1.6,w:1.6,h:2.2,c:'casa'},{t:'window',x:1.2,w:1.4,shutters:'#7a7c80'}]}),
  L('N',216,222,{wall:'#ece8e2',roof:'hip',roofColor:'#8a4a32',open:[{t:'window',x:-1.4,w:1.4,shutters:'#7a7c80'},{t:'gate',x:1.4,w:2.6,c:'#8a8a6a'}]}),
  // nº 380: the sage-green wall with a black garage door
  L('N',222,230,{wall:'#a8b8b0',roof:'gable',roofColor:'#5a6068',setback:2,front:{h:2.2,c:'#a8b8b0',gates:[{t:'garage',x:1.4,w:3.4,c:'#2a2a2a'}]}}),
  muro('N',230,236,'#b8b4aa',1.8),
  // --- Cel. José Leopoldino → Treze de Maio (the corner brick house is on the Leopoldino)
  // the brick house with an arcade of arches round its carport, iron fence on a grey base
  L('N',267,277,{wall:'#a8503a',roof:'hip',roofColor:'#8a4a32',setback:2,front:{h:.6,c:'#7a7c80',rail:{h:1.3,c:'#4a4a4a',style:'bars'}},open:[{t:'arch',x:-3,w:3,h:2.4,y:0,frame:W},{t:'arch',x:1.6,w:3.6,h:2.4,y:0,frame:W}]}),
  // the white sobrado with arched white garage gates and a white lattice balcony
  L('N',277,290,{floors:2,wall:'#d8d4ca',roof:'hip',roofColor:T,open:[{t:'garage',x:-3.6,w:3,c:W},{t:'garage',x:-.2,w:3,c:W},{t:'door',x:4,w:1.2,c:W},{t:'arch',x:-2,w:1.6,fl:1},{t:'arch',x:2,w:1.6,fl:1}],balcony:{x:-2,w:5,fl:1,rail:'white'}}),
  // nº 3?7: the beige house with a carport behind green bars
  L('N',290,298,{wall:'#d8bc98',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',open:[{t:'window',x:-2,w:1.6,shutters:W,frame:W},{t:'gate',x:1.8,w:3.4,c:'#3a5a3a'}]}),
  // the blue speckled house with a porch behind iron bars
  L('N',298,306,{wall:'#6a7a98',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',band:'#d8c8a8',plinth:{h:.8,c:'#8a8c8e'},open:[{t:'window',x:-1.8,w:2.2,shutters:'#5a6068',frame:'#d8c8a8'},{t:'gate',x:1.8,w:3,c:'#3a3a3a'}]}),
  // nº 225: the white house with a brown awning and a brown iron gate on a stone base
  L('N',306,314,{wall:'#e6e2dc',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',plinth:{h:.9,c:'#8a8070',stone:true},open:[{t:'window',x:-2,w:2.6,frame:W,awning:'#5a3a2a'},{t:'gate',x:2,w:3,c:'#4a3a32'}]}),
  // a grey speckled wall and sheet gate under a tiled carport
  L('N',314,320,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#7a8488',gates:[{t:'gate',x:.6,w:3,c:'#8a9098'}]}}),
  // the pink-white sobrado with a white garage
  L('N',320,327,{floors:2,wall:'#ece4e0',roof:'hip',roofColor:T,plinth:{h:1,c:'#e6dcc8'},open:[{t:'garage',x:-1,w:3.6,c:W},{t:'door',x:2.6,w:1,c:W},{t:'window',x:-1,w:2,fl:1}]}),
  // --- Treze de Maio → Romeu Zanetti
  // the orange-and-white office house with a stone planter and steps
  L('N',351,358,{wall:'#d8784a',roof:'hip',roofColor:'#6a6c70',plinth:{h:.8,c:'#c8a87a',stone:true},open:[{t:'glass',x:-1.6,w:2,y:.4,h:2.2,frame:W},{t:'window',x:1.6,w:1.4,frame:W}]}),
  // nº 174: the grey house with a white embossed garage gate
  L('N',358,366,{wall:'#a8a8a6',roof:'gable',roofColor:'#9aa0a3',fascia:W,open:[{t:'door',x:-2.6,w:1,c:'#5a5a58'},{t:'garage',x:.8,w:3.4,c:W}]}),
  // the old white shed with a striped sheet door, the sobrado with a red garage and railing
  L('N',366,374,{wall:'#ece8e2',roof:'gable',roofColor:'#8a4a32',open:[{t:'garage',x:0,w:4,c:'#8a7a6a'}]}),
  L('N',374,386,{floors:2,wall:'#e6dcd8',roof:'flat',parapet:true,plinth:{h:1.4,c:'#8a7a6a'},open:[{t:'garage',x:-2,w:3,c:'#8a2a2a'},{t:'window',x:2,w:2,fl:1,shutters:'#8a2a2a',frame:W}],balcony:{x:-2,w:5,fl:1,rail:'iron'}}),
  // --- Romeu Zanetti → XV de Novembro
  // nº 122: the grey sobrado on stone tiles with a wooden door and a glass balcony
  L('N',410.5,420,{floors:2,wall:'#ece8e2',roof:'flat',parapet:true,plinth:{h:1.2,c:'#b8a888',stone:true},open:[{t:'window',x:-2,w:2.6,frame:'#3a3a3a'},{t:'door',x:2.6,w:1.4,c:'#5a3a2a',awning:T}],balcony:{x:-1,w:7,fl:1,rail:'glass'}}),
  // the white sobrado over a little shop under a clay-tile awning, a wooden garage
  L('N',420,428,{floors:2,wall:'#ece8e2',roof:'flat',parapet:true,open:[{t:'open',x:-1,w:3,h:2.4,c:'casa',awning:T},{t:'garage',x:2.6,w:2.4,c:'#a8703a',awning:T},{t:'window',x:0,w:5,fl:1,grille:true}]}),
  // the mansion behind its brown stone wall with beige pilasters
  L('N',428,455,{floors:2,wall:'#c8b49a',roof:'hip',roofColor:'#4a4a4a',setback:4,front:{h:2.4,c:'#7a5a4a',gates:[{t:'door',x:-11,w:1.2,c:'#5a3a2a'}]},
    open:[{t:'window',x:-6,w:2,frame:'#6a2a24',grille:true},{t:'window',x:-1,w:2,frame:'#6a2a24',grille:true},{t:'window',x:4,w:2,frame:'#6a2a24',grille:true},{t:'window',x:-6,w:2,fl:1,frame:'#6a2a24'},{t:'window',x:-1,w:2,fl:1,frame:'#6a2a24'},{t:'window',x:4,w:2,fl:1,frame:'#6a2a24'}]}),
  // --- XV de Novembro → Sete de Setembro
  // nº 86: the cream house on a slate base, a white gate
  L('N',479,486,{wall:'#ece4d6',roof:'hip',roofColor:T,plinth:{h:1,c:'#7a7a78',stone:true},open:[{t:'window',x:-1.4,w:2.2,frame:'#3a3a3a'},{t:'gate',x:2,w:1.6,c:W}]}),
  // the cream house with barred carports on a slate base, a grey speckled wall
  L('N',486,496,{wall:'#ece4d6',roof:'hip',roofColor:T,plinth:{h:.6,c:'#7a7a78'},open:[{t:'gate',x:-3,w:1.4,c:W},{t:'gate',x:0,w:2.8,c:W},{t:'gate',x:3.4,w:2.8,c:W}]}),
  muro('N',496,508,'#8a908e',2.4,{behind:{w:10,d:8,at:3,roofColor:T,wall:'#ece8e2'}}),
  // a grey garage block; the cream sobrado with a barred stair and roughcast base
  L('N',508,514,{wall:'#a8a8a6',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:3,c:'#e6e2dc'}]}),
  L('N',514,520,{floors:2,wall:'#ecd8c4',roof:'flat',parapet:true,plinth:{h:1.6,c:'#c8a87a'},open:[{t:'gate',x:-1,w:1.4,c:W},{t:'open',x:1,w:3,fl:1,h:2.2,c:'casa'}],balcony:{x:1,w:3,fl:1,rail:'white'}}),
  // the cream houses on roughcast bases, a white roll door; the little shop on stone tiles
  L('N',520,528,{wall:'#ecd8c4',roof:'gable',roofColor:T,plinth:{h:1.6,c:'#c8a87a'},open:[{t:'window',x:-2,w:2,frame:W},{t:'window',x:1,w:2.6,shutters:W},{t:'garage',x:3.4,w:1.8,c:W}]}),
  L('N',528,534,{wall:'#ecd8c4',roof:'gable',roofColor:T,plinth:{h:1.6,c:'#6a5a4a',stone:true},open:[{t:'glass',x:.6,w:2.4,y:.4,h:2,frame:W,awning:'#e8e4dc'}]}),
  // the sobrado with a black garage, plants on the terrace; The Learning Center's red sign
  L('N',534,540,{floors:2,wall:'#ecdcc8',roof:'flat',parapet:true,open:[{t:'door',x:-1.6,w:1,c:'#1c1c1e'},{t:'garage',x:1,w:3,c:'#1c1c1e'}]}),
  L('N',540,546.5,{floors:2,wall:'#ecdcc8',roof:'flat',parapet:true,setback:2,front:{h:.4,c:'#ecdcc8',rail:{h:1.6,c:'#1c1c1e',style:'bars'}},open:[{t:'open',x:0,w:3,h:2.4,c:'casa'}],
    sign:{text:'THE LEARNING CENTER',bg:'#d82a2a',fg:'#ffffff',x:0,y:2.4,w:4.4,h:1}}),

  // ================= WEST SIDE (S) =================
  // --- Marginal → service road
  // old white houses with patched walls, an olive house with tall barred windows
  L('S',6,16,{wall:'#ece8e2',roof:'gable',roofColor:'#8a4a32',open:[{t:'window',x:-1,w:1.8,shutters:'#a8a49c'},{t:'window',x:2.4,w:1,frame:'#5a8a6a'}]}),
  L('S',16,22,{wall:'#ece8e2',roof:'gable',roofColor:'#8a4a32',open:[{t:'window',x:0,w:1.8,shutters:'#a8a49c'}]}),
  L('S',22,28,{wall:'#a8a83a',roof:'gable',roofColor:T,open:[{t:'window',x:-1.4,w:.9,h:2,y:.4,grille:true,frame:'#6a6c70'},{t:'window',x:1,w:.9,h:2,y:.4,grille:true,frame:'#6a6c70'}]}),
  // nº 896: the modern grey house with a white garage and door, a glass box above
  L('S',28,34,{floors:2,wall:'#8a8c8e',roof:'flat',parapet:true,open:[{t:'garage',x:-1,w:3,c:'#f2f2f0'},{t:'door',x:1.8,w:1,c:'#f2f2f0'}]}),
  // the mustard speckled house with a tiled carport behind brown wooden pickets
  L('S',34,44,{wall:'#d8b03a',roof:'gable',roofColor:'#6a6c70',fascia:W,setback:2,front:{h:.4,c:'#d8884a',rail:{h:1.2,c:'#5a3a2a',style:'bars'}},open:[{t:'open',x:-1.6,w:4,h:2.3,c:'casa',awning:'#6a6c70'},{t:'window',x:3,w:2,shutters:'#5a3a2a',frame:'#a8a49c'}]}),
  // the grey cottage with green shutters and a green door behind a rough wall, a carport
  L('S',44,54,{wall:'#c8c4bc',roof:'gable',roofColor:'#6a6c70',fascia:W,setback:2,front:{h:1,c:'#9a9690'},open:[{t:'window',x:-2,w:1.6,shutters:'#5aaa7a'},{t:'door',x:0,w:1,c:'#5aaa7a'},{t:'window',x:2,w:1.6,frame:W}]}),
  // the green speckled house behind a raw brick pier
  L('S',54,60,{wall:'#5a8a4a',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:1.4,c:'#b5603f'},open:[{t:'window',x:0,w:1.6,shutters:W}]}),
  // an overgrown lot behind chain-link on concrete posts
  muro('S',60,72,'#b8b4aa',.3,{front:{h:.3,c:'#b8b4aa',rail:{h:1.6,c:'#9aa0a3',style:'lattice'}}}),
  // --- service road → Antônio de Moura
  // the long beige wall of a house with slanted vents and white doors
  L('S',76,91.4,{wall:'#ddd0bc',roof:'hip',roofColor:T,setback:3,front:{h:2.6,c:'#ddd0bc',gates:[{t:'door',x:-5,w:1.2,c:W},{t:'door',x:4.6,w:1.2,c:W}]}}),
  // --- Antônio de Moura → Armando Grespan
  // nº 433: the white corner house; the lime house on a grey base
  L('S',98,106,{wall:'#ece8e2',roof:'gable',roofColor:'#6a3a2a',fascia:'#6a3a2a',open:[{t:'window',x:0,w:1.4,grille:true}]}),
  L('S',106,114,{wall:'#d8dca8',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#c8c8a8'},open:[{t:'window',x:-1.6,w:1.8,frame:'#3a3a3a'},{t:'window',x:1.6,w:1.8,shutters:W},{t:'gate',x:3.4,w:1.2,c:W}]}),
  // --- Armando Grespan → Antônio de Melo
  // the grey corner house behind a grey picket fence
  L('S',122,132,{wall:'#a8b0b8',roof:'gable',roofColor:'#6a6c70',fascia:W,setback:2,front:{h:.8,c:'#7a8488',rail:{h:.8,c:'#3a3a3a',style:'bars'}},open:[{t:'window',x:-2,w:2,frame:W},{t:'window',x:2,w:2,shutters:'#5a6068',frame:W}]}),
  // a grey sheet gate; the grey house behind black pickets
  L('S',132,138,{wall:'#c8c4c8',roof:'gable',roofColor:T,open:[{t:'window',x:-1.4,w:1.4,shutters:'#5a6068',frame:W},{t:'gate',x:1.4,w:3,c:'#5a6068'}]}),
  L('S',138,146,{wall:'#a8b0b8',roof:'gable',roofColor:'#6a6c70',fascia:W,setback:2,front:{h:.8,c:'#7a8488',rail:{h:.8,c:'#2a2a2a',style:'bars'}},open:[{t:'door',x:-2,w:1,c:'#5a6068'},{t:'window',x:1.4,w:2.4,grille:true,frame:W}]}),
  // the stained beige house with a brown lattice window and gate; nº 297 lilac
  L('S',146,152,{wall:'#c8b49a',roof:'gable',roofColor:T,open:[{t:'window',x:-1,w:2.4,grille:true,frame:'#6a4a32'},{t:'gate',x:1.8,w:1.2,c:'#6a4a32'}]}),
  L('S',152,158,{wall:'#d8d0dc',roof:'hip',roofColor:T,plinth:{h:.6,c:'#7a8488'},open:[{t:'window',x:-1.4,w:1.4,grille:true},{t:'door',x:.6,w:1,c:'#8a3a2a'},{t:'window',x:2.4,w:1,shutters:'#3a4a5a'}]}),
  // a precast wall; the beige house with a brown art-deco gate under a tiled hood
  muro('S',158,162,'#b8b4aa',1.8),
  L('S',162,164.4,{wall:'#ece4d6',roof:'hip',roofColor:T,open:[{t:'gate',x:0,w:2.4,c:'#6a5a4a',awning:T}]}),
  // --- Antônio de Melo → Cel. José Leopoldino
  // the grey corner house with a tiled porch behind bars, on a grey base
  L('S',172.4,180,{wall:'#d8d4ca',roof:'hip',roofColor:T,plinth:{h:1,c:'#8a8c8e'},open:[{t:'window',x:-1.6,w:2.6,grille:true,awning:T},{t:'window',x:2.4,w:1,frame:'#3a3a3a'}]}),
  // the white house with a tiled awning over a barred window
  L('S',180,188,{wall:'#ece8e2',roof:'hip',roofColor:T,open:[{t:'window',x:.6,w:3,grille:true,awning:T}]}),
  // the ochre speckled house with an arched louvred window, a brown sheet gate
  L('S',188,196,{wall:'#b8a070',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',open:[{t:'arch',x:-1.4,w:1.8,shutters:W},{t:'gate',x:2,w:2.4,c:'#8a6a4a'}]}),
  // the old yellow cottage behind a precast wall, stained walls and a white door
  L('S',196,204,{wall:'#e6d498',roof:'gable',roofColor:'#6a6c70',setback:3,front:{h:1.4,c:'#a8a49c',gates:[{t:'door',x:2,w:1,c:W}]},open:[{t:'window',x:-1,w:1.6,shutters:W}]}),
  L('S',204,212,{wall:'#e6d498',roof:'gable',roofColor:'#6a6c70',setback:3,front:{h:1.4,c:'#a8a49c'},open:[{t:'window',x:0,w:1.2,frame:W}]}),
  // nº 2?7: the yellow house with a big glazed window, swans in the garden, a low fence
  L('S',212,220,{wall:'#e6cc88',roof:'gable',roofColor:'#6a4a32',fascia:'#6a4a32',setback:2,front:{h:.6,c:'#c8a88a',rail:{h:1,c:'#5a4a40',style:'bars'}},open:[{t:'window',x:-1.6,w:2.6,frame:W},{t:'window',x:2,w:2,shutters:'#8a5a3a',frame:W}]}),
  // the lilac house with a white door, the grey houses with white louvred windows
  L('S',220,226,{wall:'#c8b8bc',roof:'flat',parapet:true,open:[{t:'door',x:-2,w:1,c:W},{t:'window',x:1,w:2,frame:'#5a5a58'}]}),
  L('S',226,232,{wall:'#c8c4bc',roof:'hip',roofColor:T,plinth:{h:.6,c:'#a8a8a6'},open:[{t:'window',x:0,w:2,shutters:W,frame:'#8a8c8e'}]}),
  L('S',232,237,{wall:'#c8c4bc',roof:'hip',roofColor:T,plinth:{h:.6,c:'#a8a8a6'},open:[{t:'window',x:0,w:1.6,shutters:W,frame:'#8a8c8e'}]}),
  // --- Cel. José Leopoldino → Treze de Maio (the corner house is on the Leopoldino)
  // the grey stone-tile house with a grey sheet garage
  L('S',267,276,{wall:'#9a9690',roof:'hip',roofColor:T,open:[{t:'garage',x:1.4,w:3,c:'#a8b0b8'},{t:'window',x:-2.4,w:1.2,frame:'#5a5a58'}]}),
  // the beige sobrado with a glass balcony over white gates
  L('S',276,284,{floors:2,wall:'#ddd0bc',roof:'flat',parapet:true,open:[{t:'gate',x:-1.6,w:3,c:W},{t:'gate',x:1.8,w:3,c:W}],balcony:{x:0,w:7,fl:1,rail:'glass'}}),
  // the beige gable houses with grey louvred windows, a sheet gate between
  L('S',284,292,{wall:'#ddd0bc',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',open:[{t:'window',x:-1,w:2.2,shutters:'#8a9098'},{t:'gate',x:2.6,w:2.6,c:'#a8b0b8'}]}),
  L('S',292,300,{wall:'#ddd0bc',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',open:[{t:'gate',x:-2,w:2.6,c:'#a8b0b8'},{t:'window',x:1.6,w:2,shutters:'#8a9098'}]}),
  // nº 233: the dark wall and the old brown speckled house behind a white wall
  L('S',300,308,{wall:'#7a6a5a',roof:'hip',roofColor:T,setback:2,front:{h:1.6,c:'#ece8e2',gates:[{t:'gate',x:2.6,w:1.4,c:W}]},open:[{t:'window',x:-1,w:1.4,shutters:'#a8603a'}]}),
  // the grey speckled house with red-brown shutters and a garage porch
  L('S',308,316,{wall:'#8a908e',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',band:'#b5603f',open:[{t:'window',x:-2,w:2.6,shutters:'#8a3a2a',frame:W},{t:'open',x:2,w:3,h:2.4,c:'casa'}]}),
  // the old yards behind iron bars with tin lean-tos; the beige house with a brown door
  L('S',316,322,{wall:'#8a908e',roof:'gable',roofColor:T,setback:3,front:{h:.3,c:'#a8a49c',rail:{h:1.3,c:'#3a3a3a',style:'bars'}},open:[{t:'garage',x:0,w:2.4,c:'#a87a4a'}]}),
  L('S',322,327,{wall:'#ddd0bc',roof:'gable',roofColor:T,plinth:{h:.6,c:'#8a6a4a'},open:[{t:'window',x:-1.4,w:1.4,shutters:'#a87a4a'},{t:'door',x:1.2,w:1.2,c:'#a87a4a'}]}),
  // --- Treze de Maio → Romeu Zanetti
  // the stone-clad wall with an arched wooden door; the green sobrado over dark grey tiles
  L('S',351,357,{wall:'#c8b490',roof:'gable',roofColor:T,panels:[{x:0,w:6,stone:true}],open:[{t:'arch',x:-1,w:1.2,h:2.4,y:0,frame:'#6a4a32'},{t:'garage',x:1.8,w:2,c:'#6a4a32'}]}),
  L('S',357,363,{floors:2,wall:'#4a4c50',upper:'#c8d488',roof:'flat',parapet:true,open:[{t:'window',x:0,w:2.4,grille:true}],balcony:{x:0,w:6,fl:1,rail:'iron'}}),
  // the green-and-black chequered tiles, an open garage and a shop window
  L('S',363,372,{floors:2,wall:'#a8d4b0',upper:'#ece8e2',roof:'flat',parapet:true,open:[{t:'window',x:-2.6,w:2,grille:true},{t:'open',x:1.6,w:3.6,h:2.6,c:'casa'}]}),
  // the stone-clad shop under a red awning, a white roll door
  L('S',372,380,{floors:2,wall:'#c8a870',upper:'#ece8e2',roof:'flat',parapet:true,open:[{t:'glass',x:-2,w:3,y:.6,h:1.8,frame:'#8a6a4a',awning:'#c82a2a'},{t:'garage',x:2,w:3,c:'#f2f2f0'},{t:'window',x:0,w:3,fl:1,frame:'#8a3a2a'}]}),
  // --- Romeu Zanetti → XV de Novembro (the bus terminal and the Câmara's covered park)
  // Ponto do Encontro: a restaurant behind wide glass, its photo banner along the fascia
  L('S',432,440,{wall:'#d8c8b0',roof:'flat',parapet:true,open:[{t:'glass',x:-2,w:3,y:0,h:2.6,frame:'#3a3a3a'},{t:'glass',x:2,w:3,y:0,h:2.6,frame:'#3a3a3a'}],
    sign:{text:'PONTO DO ENCONTRO',bg:'#e8784a',fg:'#ffffff',x:0,y:3,w:7,h:.9}}),
  // the black-and-white tiled corner shop under its canvas awning
  L('S',456,463,{wall:'#ece8e2',roof:'hip',roofColor:T,panels:[{x:0,w:7,c:'#3a3a3a',y0:0,y1:2.2}],open:[{t:'open',x:-1.6,w:2,h:2.4,c:'casa',awning:'#5a7a5a'},{t:'window',x:1.6,w:1.6,awning:'#c8c8a8'}]}),
  // --- XV de Novembro → Sete de Setembro (Toque Cell and Zema near the corner)
  // the clinics behind glass
  L('S',492,500,{floors:2,wall:'#ddd0bc',roof:'flat',parapet:true,open:[{t:'glass',x:-1.6,w:3,y:0,h:2.4,frame:'#8a8c8e'},{t:'glass',x:2,w:2.4,y:.4,h:2,frame:'#8a8c8e'}],balcony:{x:0,w:8,fl:1,rail:'glass'}}),
  // the beige sobrado with a white garage and a dental clinic window
  L('S',500,508,{floors:2,wall:'#ddd0bc',roof:'flat',parapet:true,open:[{t:'door',x:-2.6,w:1.2,c:W},{t:'window',x:0,w:1.8,frame:'#3a3a3a'},{t:'garage',x:2.4,w:2.6,c:W}],balcony:{x:0,w:8,fl:1,rail:'glass'}}),
  // the stone-clad garage with a white door and transom
  L('S',508,514,{wall:'#c8b490',roof:'flat',parapet:true,panels:[{x:0,w:6,stone:true}],open:[{t:'garage',x:-.8,w:2.8,c:W},{t:'door',x:2,w:1.2,c:W}]}),
  // the old white house behind a white fence, grey shutters
  L('S',526,536,{wall:'#ece8e2',roof:'hip',roofColor:'#8a4a32',setback:3,front:{h:.6,c:'#ece8e2',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:4,w:1.2,c:'#4a6a8a'}]},open:[{t:'window',x:-1,w:1.6,shutters:'#7a8088'}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:48,kind:'ficus'},{side:'N',s:54,kind:'reseda'},{side:'S',s:66,kind:'ficus'},
  {side:'S',s:240,kind:'ficus'},{side:'N',s:232,kind:'ficus'},{side:'N',s:492,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:10,every:34,transformers:[120,320]},
};
