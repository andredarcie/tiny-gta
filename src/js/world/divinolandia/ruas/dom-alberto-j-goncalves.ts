// Rua Dom Alberto J. Gonçalves — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/dag-N-*/ and dag-S-*/, kept out of git; lot boundaries
// from the Microsoft building footprints). 472 m west→east from the Rua Guanabura to the Joaquim
// Garcia / José Augusto Machado corner. Side 'N' is the north side, 'S' the south.
//   s=61 R. Barão do Rio Branco   s=132 R. Leonor Mendes de Barros   s=262 a dirt road down to
//   the south only   s=397 R. São Vicente de Paula (north only)
// The middle is walls: the school with its covered court (galpoes.ts) and the plant nursery's
// greenhouses on the north side, a sports ground on the south; the telephone tower yard on the
// north at the east end. Left alone: Chiquinho Tintas (comercio/lojas.ts).
// Granite setts west of the Leonor, asphalt beyond. Opening x is measured from the lot centre as
// SEEN FROM THE STREET (left negative): on the north side (N) left is WEST (lower s), on the south
// side (S) left is EAST (higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Dom Alberto J. Gonçalves';
export const CROSS=[0,60.8,131.9,472.1];
const SURFACE:Surface[]=[[0,138,'sett'],[138,472.1,'asphalt']];
const T='#b0603f',W='#f1efe9',PRE='#cfcbc2',WEATHER='#c8c0ae',TAN='#b89a70';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE (N) =================
  // --- Guanabura → Barão do Rio Branco
  // the high wall grown over with creeper on the corner, cypresses behind
  muro('N',3.8,23,'#6a8a5a',2.6,{front:{h:2.6,c:'#5a7a4a',style:'hedge'}}),
  // the creeper wall with a beige door and a beige sheet gate, the white gabled house behind
  L('N',23,30,{wall:'#f0eee8',roof:'gable',roofColor:'#5a4a40',setback:4,d:8,front:{h:2.6,c:'#5a7a4a',gates:[{t:'gate',x:-2,w:1.2,c:'#e0d4b8'},{t:'gate',x:1.6,w:3,c:'#e0d4b8'}]}}),
  // the white wall on a wood-tile base with a black gate
  L('N',30,37.9,{wall:'#f0eee8',roof:'gable',roofColor:T,setback:4,d:8,front:{h:2,c:W,gates:[{t:'gate',x:3,w:1.4,c:'#3a3a3a'}]},plinth:{h:.9,c:'#8a6a4a'}}),
  // nº 27: the white house under grey tiles: black barred windows, a wood-tile wing and base
  L('N',37.9,43,{wall:'#f0eee8',roof:'hip',roofColor:'#8a9098',plinth:{h:.8,c:'#8a6a4a'},
    open:[{t:'window',x:0,w:2.6,grille:true,frame:'#2a2a2a'}]}),
  // --- Barão do Rio Branco → Leonor Mendes de Barros
  // the peach house with a brown door, two tilted windows and an ochre base
  L('N',78.6,84.5,{wall:'#ecd4c0',roof:'gable',roofColor:'#5a3a2a',plinth:{h:.9,c:'#c88a3a'},
    open:[{t:'door',x:-1.8,w:.9,c:'#c8a060'},{t:'window',x:0,w:.8,frame:'#3a3a3a'},{t:'window',x:1.8,w:1.2,shutters:'#e0d8c8'}]}),
  // the cream old house with a grey louvred window and a white sheet gate
  L('N',84.5,93.1,{wall:'#ece4d0',roof:'hip',roofColor:'#8a4a32',plinth:{h:.5,c:'#7a7a78'},open:[{t:'window',x:-1.4,w:1.4,shutters:'#a8acb0'},{t:'gate',x:1,w:1,c:W},{t:'garage',x:3.2,w:1.8,c:W}]}),
  // the cream old house with a grey louvred window and a white garage door
  L('N',93.1,100,{wall:'#ece4d0',roof:'hip',roofColor:'#8a4a32',open:[{t:'window',x:-1.8,w:1.6,shutters:'#a8acb0'},{t:'garage',x:1.6,w:2.6,c:W}]}),
  // the old ochre house: a glass-block window, a barred glass door
  L('N',100,108,{wall:'#e0c890',roof:'gableSide',roofColor:'#9a9a98',plinth:{h:.6,c:'#6a5a4a'},open:[{t:'window',x:-1.6,w:2,frame:'#e8e0d0'},{t:'door',x:1.4,w:1.6,c:'#c8d0d4',grille:true}]}),
  // the old yellow house with white-framed louvred windows, a galvanized sheet fence
  L('N',108,113.8,{wall:'#e8d088',roof:'hip',roofColor:'#8a4a32',plinth:{h:.6,c:'#6a5a4a'},
    open:[{t:'window',x:-1.4,w:1.2,shutters:'#a8acb0',frame:W},{t:'window',x:1.4,w:1.2,shutters:'#b8bcc0',frame:W}]}),
  // --- Leonor Mendes de Barros → (São Vicente de Paula)
  // the bare-brick house with oval windows and a porch behind a wavy white-trimmed wall
  L('N',150.5,160,{wall:'#c0704a',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#c0704a',rail:{h:.4,c:W,style:'bars'}},
    open:[{t:'window',x:-3,w:.6,h:1},{t:'window',x:-2,w:.6,h:1},{t:'window',x:-1,w:.6,h:1},{t:'window',x:1.2,w:1.2,h:.6,y:1.6},{t:'window',x:3,w:.6,h:1}]}),
  // the bare-brick wall with two wooden board gates
  L('N',160,168,{wall:'#c0704a',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:'#c0704a',gates:[{t:'gate',x:-1.8,w:3,c:'#b08458'},{t:'gate',x:1.8,w:3,c:'#b08458'}]}}),
  // the grey house with an arched porch behind a black iron fence
  L('N',168,180,{wall:'#d4d4d2',roof:'gable',roofColor:'#5a5a58',fascia:W,setback:1.5,front:{h:.4,c:'#a8a8a4',rail:{h:1.3,c:'#3a3a3a',style:'bars'}},
    open:[{t:'arch',x:-4,w:2.4,y:0,h:2.2,c:'casa'},{t:'arch',x:-1.2,w:2.4,y:0,h:2.2,c:'casa'},{t:'arch',x:1.6,w:2.4,y:0,h:2.2,c:'casa'},{t:'arch',x:4.4,w:2.4,y:0,h:2.2,c:'casa'}]}),
  L('N',180,187,{wall:'#d4d4d2',roof:'gable',roofColor:'#5a5a58',setback:1.5,front:{h:.8,c:'#a8a8a4',rail:{h:.8,c:'#3a3a3a',style:'bars'}},open:[{t:'window',x:0,w:1.6,grille:true}]}),
  // the school's weathered wall, the covered court and the classrooms behind, a white gate
  muro('N',187,262,WEATHER,2.2,{front:{h:2.2,c:WEATHER,gates:[{t:'gate',x:14,w:3.4,c:'#e8e8e6'},{t:'gate',x:23,w:3,c:'#a8acb0'}]}}),
  // the plant nursery's long white wall, a painted shed front, the greenhouses over it
  muro('N',264.2,360,'#e4e2dc',2.6,{sign:{text:'VENDE-SE VERDURAS',bg:'#7aa8d8',fg:'#ffffff',x:-15,y:1.4,w:6,h:1.2}}),
  // the grey sheet gates with a lattice top, the grey house behind
  L('N',360,368,{wall:'#9a9c9e',roof:'gable',roofColor:'#8a8c8e',setback:3,front:{h:2.4,c:'#e4e2dc',gates:[{t:'gate',x:1,w:3,c:'#8a9098'}]}}),
  L('N',368,378,{wall:'#9a9c9e',roof:'gable',roofColor:'#8a8c8e',setback:2,front:{h:2.4,c:'#8a9098',gates:[{t:'gate',x:-1,w:5,c:'#8a9098'},{t:'gate',x:2.6,w:1,c:'#8a9098'}]}}),
  // the telephone tower yard behind chain-link on concrete posts, its brick hut
  muro('N',403.6,468.1,'#b8bcc0',2,{front:{h:2,c:'#b8bcc0',style:'lattice'}}),
  // ================= SOUTH SIDE (S) =================
  // --- Guanabura → Barão do Rio Branco
  // the white corner house with two white garage doors with scrolled ironwork
  L('S',3.8,18.7,{wall:'#ecebe6',roof:'hip',roofColor:'#8a4a32',open:[{t:'garage',x:-1.6,w:3,c:W},{t:'door',x:2.6,w:1,c:W},{t:'garage',x:5.6,w:2.4,c:W}]}),
  // the modern beige house with a big wood-panel garage door
  L('S',18.7,25,{wall:'#ece4d4',roof:'flat',parapet:true,open:[{t:'garage',x:.4,w:4,c:'#5a3a2a'},{t:'door',x:-2.4,w:.8,c:W}]}),
  // the modern white house behind a white slatted gate, a glass-railed balcony above
  L('S',25,29.6,{floors:2,wall:'#ecedee',upper:'#ecedee',roof:'flat',parapet:true,balcony:{x:0,w:4,fl:1,rail:'glass',depth:1},open:[{t:'garage',x:0,w:3.6,c:W}]}),
  // the two-storey house on a stone-clad ground floor: white garage doors, barred windows
  L('S',29.6,43,{floors:2,wall:'#a89070',upper:'#ecebe8',roof:'flat',parapet:true,plinth:{h:3,stone:true},
    open:[{t:'garage',x:3.6,w:3.4,c:W},{t:'window',x:-.4,w:2.4,grille:true},{t:'garage',x:-4,w:2.6,c:W},{t:'window',x:2,w:2.4,fl:1,frame:'#3a3a3a'},{t:'window',x:-4,w:2,fl:1,shutters:W}]}),
  // --- Barão do Rio Branco → Leonor Mendes de Barros
  // the old white wall, the little houses and the shed behind it
  L('S',78.6,82,{wall:'#ece8e0',roof:'gable',roofColor:'#8a4a32',setback:3,d:7,front:{h:2,c:'#e4e0d8'}}),
  // the cream two-storey house on a dark stone base: brown louvres, a grey garage door
  L('S',82,90.4,{floors:2,wall:'#ece4dc',upper:'#ece4dc',roof:'hip',roofColor:T,plinth:{h:1.6,c:'#4a4844'},
    open:[{t:'garage',x:0,w:2.6,c:'#c8ccd0'},{t:'window',x:-2.4,w:1,fl:1,shutters:'#4a2a1a'},{t:'window',x:0,w:1,fl:1,shutters:'#4a2a1a'},{t:'window',x:2.4,w:1.4,fl:1,shutters:'#4a2a1a'}]}),
  // the grey wall with a white sheet gate, the peach house on a stone base
  L('S',90.4,100.3,{wall:'#ecdcd0',roof:'gable',roofColor:T,plinth:{h:1.4,c:'#4a4844'},open:[{t:'window',x:-2,w:1.6,shutters:'#4a2a1a'},{t:'gate',x:2.6,w:2.6,c:'#c8ccd0'}]}),
  // the concrete-block wall of a timber yard
  muro('S',100.3,106,'#a8a49c',2.4),
  // the grey-green house high on a beige tile base: white louvres, a porch, a white garage door
  L('S',106,113.6,{wall:'#a8a890',roof:'hip',roofColor:'#9a9a98',plinth:{h:2.2,c:'#e4dccc'},
    open:[{t:'window',x:2,w:2,y:2.6,shutters:W},{t:'garage',x:-2,w:2.4,c:W},{t:'open',x:-2,w:2.4,h:1.6,y:2.4,c:'casa'}]}),
  // --- Leonor Mendes de Barros → (dirt road)
  // (135.7–165: Chiquinho Tintas, comercio/lojas.ts)
  // the pale green building with brown wooden doors and an arched window
  L('S',165,171,{wall:'#a8b890',roof:'flat',parapet:true,open:[{t:'garage',x:1,w:2.6,c:'#4a3a32'},{t:'window',x:-2,w:1.6,frame:'#3a3a3a'}]}),
  // the cream garage with its old blue truck
  L('S',171,179,{wall:'#ecdcb8',roof:'flat',parapet:true,open:[{t:'open',x:.6,w:4.6,h:2.8,c:'geral'},{t:'door',x:-3,w:.9,c:'#6a5a4a'}]}),
  // the two-storey house with a bare-brick arched porch over a pale green ground floor
  L('S',179,188.5,{floors:2,wall:'#d8dcc0',upper:'#b8704a',roof:'gable',roofColor:T,
    open:[{t:'window',x:2,w:1.2,grille:true},{t:'gate',x:-1,w:1.4,c:'#5a3a2a'},{t:'arch',x:2,w:3,y:.1,h:1.8,fl:1,c:'casa'},{t:'arch',x:-2,w:3,y:.1,h:1.8,fl:1,c:'casa'}]}),
  // nº 140/142: the pink two-storey house with iron-railed balconies, a brown garage door
  L('S',188.5,209.5,{floors:2,wall:'#e8ccd0',upper:'#e8ccd0',roof:'flat',parapet:true,plinth:{h:.9,c:'#5a5a58'},balcony:{x:0,w:20,fl:1,rail:'iron',depth:1.2},
    open:[{t:'garage',x:-6,w:3.4,c:'#4a4440'},{t:'door',x:-1,w:1.6,c:'#4a3a32'},{t:'window',x:3,w:1.6,shutters:'#4a4a48'},{t:'window',x:7,w:1.6,shutters:'#4a4a48'}]}),
  // the weathered tan wall of the sports ground with chain-link above
  muro('S',209.5,258.7,TAN,2.6,{front:{h:2.6,c:TAN,rail:{h:1.6,c:'#a8acb0',style:'arame'}}}),
  // (258.7–266.3: the dirt road down to the south)
  // the little old white house with blue windows in the earth yard
  L('S',280,290,{wall:'#f0eee8',roof:'hip',roofColor:'#8a4a32',setback:2,open:[{t:'window',x:-2,w:1,shutters:'#2a5aa8'},{t:'door',x:2,w:.9,c:'#2a5aa8'}]}),
  // the precast wall with a blue gate
  muro('S',290,298.8,PRE,1.8,{front:{h:1.8,c:PRE,style:'panel',gates:[{t:'gate',x:1.6,w:1.2,c:'#2a5aa8'}]}}),
  // the grey house with white louvres behind a precast wall and a white gate
  L('S',298.8,307,{wall:'#a8a8a6',roof:'hip',roofColor:'#8a4a32',x:['heater'],setback:2,front:{h:1.6,c:PRE,style:'panel',gates:[{t:'gate',x:2.4,w:1.6,c:W}]},open:[{t:'window',x:0,w:2,shutters:W}]}),
  // the grey house with a carport behind a white iron fence
  L('S',307,318,{wall:'#a8aaac',roof:'gable',roofColor:'#8a4a32',x:['heater'],setback:1,front:{h:.4,c:W,rail:{h:1.4,c:W,style:'bars'}},
    open:[{t:'open',x:0,w:3.6,h:2.4,c:'casa'},{t:'window',x:-3.6,w:1.6,frame:W}]}),
  // the blue-grey house with grey grilles over its windows
  L('S',318,326,{wall:'#8a98a8',roof:'gable',roofColor:'#8a4a32',open:[{t:'window',x:-1,w:1.8,grille:true},{t:'window',x:2,w:1.2,grille:true}]}),
  // the pale green house and the grey-white two-storey with white fences and gates
  L('S',326,333,{wall:'#c8dcb8',roof:'gable',roofColor:T,setback:1.5,front:{h:.4,c:W,rail:{h:1.2,c:W,style:'bars'}},open:[{t:'garage',x:-1,w:3,c:'#8a8c8e',grille:true}]}),
  L('S',333,340.7,{floors:2,wall:'#d8d8d4',roof:'hip',roofColor:T,setback:1.5,front:{h:.4,c:W,rail:{h:1.2,c:W,style:'bars'}},open:[{t:'garage',x:0,w:3,c:W,grille:true}]}),
  // the pale green house behind a white fence, a grey sheet gate in a white wall
  L('S',340.7,351,{wall:'#c8dcb8',roof:'gable',roofColor:'#8a4a32',setback:2,front:{h:1.6,c:'#ecebe6',gates:[{t:'gate',x:-2.6,w:3,c:'#a8b0b8'}]}}),
  // the white house with a carport behind grey iron railings
  L('S',351,361.4,{wall:'#f0eee8',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:'#a8a8a4',rail:{h:1.4,c:'#8a8c8e',style:'bars'}},
    open:[{t:'window',x:3,w:2,grille:true,awning:'#a8a8a4'},{t:'open',x:-1,w:4,h:2.4,c:'casa'}]}),
  // the white house with a canvas awning and white barred gates
  L('S',361.4,370,{wall:'#f0eee8',roof:'hip',roofColor:T,open:[{t:'gate',x:2.6,w:2.4,c:W},{t:'open',x:-1.2,w:3.6,h:2.4,c:'casa',grille:true,awning:'#a8a8a4'}]}),
  // the pale green gable house behind a white fence
  L('S',370,376,{wall:'#c8d8a8',roof:'gable',roofColor:'#8a3a2a',setback:1.5,front:{h:.4,c:W,rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'window',x:1.4,w:1.6,grille:true,frame:W},{t:'window',x:-1.4,w:1.6,shutters:'#a8acb0',frame:W}]}),
  // the stone-clad and pink house behind grey gates
  L('S',376,381.7,{wall:'#e8ccc8',roof:'flat',parapet:true,plinth:{h:2,stone:true},open:[{t:'gate',x:0,w:3.6,c:'#b8bcc0'}]}),
  // the stone pillar and the grey gate of the pink house set back
  L('S',381.7,390,{wall:'#e8ccc8',roof:'flat',parapet:true,setback:2,front:{h:2.2,c:'#c8b490',style:'stone',gates:[{t:'gate',x:.6,w:4,c:'#b8bcc0'}]}}),
  // the empty lot, banana trees and cactus behind a bare-brick wall
  muro('S',400,422.7,'#c0805a',1.8,{front:{h:1.8,c:'#c0805a',style:'panel'}}),
  // the old white house with brown louvred windows
  L('S',422.7,437.9,{wall:'#f0eee8',roof:'hip',roofColor:'#8a4a32',plinth:{h:.4,c:'#a84a3a'},
    open:[{t:'door',x:4.6,w:.9,c:'#5a8a8a'},{t:'window',x:0,w:1.4,shutters:'#a8603a'},{t:'window',x:-3,w:1.4,shutters:'#a8603a'}]}),
  // the old white corner house of the Rua Guanabura... a weathered gate and a brick pier
  L('S',437.9,444,{wall:'#f0eee8',roof:'gable',roofColor:'#8a4a32',open:[{t:'door',x:-1,w:1,c:'#5a4a3a'},{t:'gate',x:1.6,w:1.6,c:'#a8acb0'}]}),
  // the long white wall, the two-storey house with a deep veranda behind it
  L('S',444,468.3,{floors:2,wall:'#ecebe6',upper:'#ecebe6',roof:'hip',roofColor:T,setback:4,d:8,front:{h:2.2,c:'#ecebe6',gates:[{t:'gate',x:10,w:1.6,c:'#7a5a40',awning:T}]},
    balcony:{x:0,w:20,fl:1,rail:'iron',depth:1.4}}),
];

export const TREES:Tree[]=[
  {side:'N',s:196,kind:'ficus'},{side:'N',s:206,kind:'ficus'},{side:'N',s:254,kind:'ficus'},{side:'N',s:270,kind:'ficus'},{side:'N',s:280,kind:'ficus'},
  {side:'N',s:302,kind:'ficus'},{side:'N',s:342,kind:'ficus'},{side:'N',s:352,kind:'ficus'},{side:'N',s:362,kind:'ficus'},
  {side:'S',s:226,kind:'ficus'},{side:'S',s:384,kind:'palmeira'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:14,every:34},
  keepOut:[
    {side:'S',s0:135.7,s1:165,why:'Chiquinho Tintas (comercio/lojas.ts)'},
    {side:'S',s0:258.7,s1:266.3,why:'the mouth of the dirt road south',walk:false},
    {side:'N',s0:393.2,s1:400.8,why:'the mouth of the Rua São Vicente de Paula',walk:false},
  ],
};
