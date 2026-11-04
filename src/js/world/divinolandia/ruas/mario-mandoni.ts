// Rua Mario Mandoni — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/mm-N-*/ and mm-S-*/, kept out of git; lot boundaries from
// the Microsoft building footprints). 197 m north→south from the Amazonas / Campo Grande corner
// down to the Walter Darcie. `s` starts at the NORTH end, so side 'N' is the EAST side (left of a
// walker going south) and 'S' the WEST side.
//   s=85 R. Guiomar Dorcie Fonsato (west only)
// Asphalt. Opening x is measured from the lot centre as SEEN FROM THE STREET (left negative): on
// the east side (N) left is NORTH (lower s), on the west side (S) left is SOUTH (higher s).
// Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Mario Mandoni';
export const CROSS=[0,197.1];
const SURFACE:Surface[]=[[0,197.1,'asphalt']];
const T='#b0603f',W='#f1efe9',WOOD='#9a6a4a';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // the bare concrete-block wall on the corner, a galvanized gate, the yard's trees
  muro('N',4,12.9,'#a8a094',2.2,{front:{h:2.2,c:'#a8a094',gates:[{t:'gate',x:3,w:1.2,c:'#b8c0c8'}]}}),
  // the white house down the slope behind a white iron gate
  L('N',12.9,21.4,{wall:'#f0eee8',roof:'gable',roofColor:T,setback:2,front:{h:.6,c:'#a8a094',rail:{h:1.4,c:W,style:'bars'}},open:[{t:'open',x:1,w:3,h:2.3,c:'casa'}]}),
  // the beauty clinic: wood-look tiles with white stripes, a white door and its lotus sign
  L('N',21.4,25.5,{wall:WOOD,roof:'flat',parapet:true,panels:[{x:0,w:4,c:W,y0:2.2,y1:2.3}],sign:{text:'CLÍNICA',bg:'#ffffff',fg:'#c83a5a',x:-.6,y:1.6,w:1.2,h:1},open:[{t:'door',x:1,w:1,c:W}]}),
  // nº 2xx: the same wood-look house with a white garage door, a brown one beside it
  L('N',25.5,32,{wall:WOOD,roof:'flat',parapet:true,panels:[{x:0,w:6.4,c:W,y0:2.2,y1:2.3}],open:[{t:'door',x:-2.2,w:.9,c:W},{t:'garage',x:1,w:3,c:W}]}),
  L('N',32,35.5,{wall:'#ecebe6',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:2.6,c:'#7a5a40'}]}),
  // nº 229: the white tiled house with two brown wooden garage doors
  L('N',35.5,41,{wall:'#f0f0ec',roof:'hip',roofColor:T,open:[{t:'garage',x:-1.4,w:2.2,c:'#6a4030'},{t:'door',x:1.4,w:1.2,c:'#6a4030'}]}),
  // nº 243: the stone-tile front with a white sliding garage door and a white door
  L('N',41,48.3,{wall:'#d8ccb8',roof:'hip',roofColor:T,open:[{t:'garage',x:-.8,w:3.6,c:W},{t:'door',x:2.4,w:1,c:W}]}),
  // the white sheet gate in a wall of grey stone tiles
  L('N',48.3,56,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:3,front:{h:2.2,c:'#a8a49c',gates:[{t:'gate',x:-2.6,w:2.4,c:W}]}}),
  // the little blue grocery under its white awning
  L('N',56,64.2,{wall:'#7aa8d8',roof:'gable',roofColor:'#9a9a98',sign:{text:'MERCEARIA',bg:'#ffffff',fg:'#2a5aa8',x:0,y:2.8,w:5,h:.6},
    open:[{t:'open',x:0,w:3.4,h:2.6,c:'geral',awning:W},{t:'gate',x:3,w:1.2,c:W}]}),
  // the blue house with a grey door, the bare-brick lean-to with a grey sheet gate
  L('N',64.2,70,{wall:'#a8c0d8',roof:'gableSide',roofColor:T,open:[{t:'door',x:-1,w:1,c:'#a8acb0'},{t:'gate',x:1.6,w:1.2,c:'#a8acb0'}]}),
  L('N',70,76.9,{wall:'#b8704a',roof:'gableSide',roofColor:T,open:[{t:'window',x:0,w:1.2,frame:'#3a3a3a'}]}),
  // the bare-brick wall round a sloping yard, a pickup parked inside
  muro('N',76.9,84,'#b8704a',1.8),
  // the white chapel: three round arches over its porch, a red gate and a cross on the gable
  L('N',84,100,{wall:'#f4f4f2',roof:'gable',roofColor:'#e8e8e6',plinth:{h:.6,c:'#c8c4bc'},sign:{text:'✝',bg:'#f4f4f2',fg:'#8a5a3a',x:0,y:4.4,w:.8,h:1.2},
    open:[{t:'arch',x:-3,w:2.4,y:0,h:2.4,c:'casa'},{t:'arch',x:0,w:2.4,y:0,h:2.4,c:'casa'},{t:'arch',x:3,w:2.4,y:0,h:2.4,c:'casa'},{t:'gate',x:6.4,w:2.6,c:'#c84a3a'}]}),
  // the empty lot behind a low stone wall
  muro('N',100,110.5,'#b8a888',.9,{front:{h:.9,c:'#b8a888',style:'stone'}}),
  // nº 317: the new beige two-storey house with a white garage door and a stone-tile column
  L('N',110.5,117.9,{floors:2,wall:'#d8ccc0',upper:'#d8ccc0',roof:'flat',parapet:true,panels:[{x:-2,w:1.4,c:'#a8907a'}],open:[{t:'garage',x:1.2,w:3.6,c:W},{t:'door',x:-2,w:.9,c:'#8a7a6a'}]}),
  // the house behind a stone wall with a white scalloped railing
  L('N',117.9,126,{wall:'#e4d8c8',roof:'hip',roofColor:T,setback:2,front:{h:1.4,c:'#a8a090',style:'stone',rail:{h:.6,c:W,style:'bars'}}}),
  // the clay-roofed house with a carport behind a lattice wall on a stone base
  L('N',126,135.3,{wall:'#e8d4c0',roof:'hip',roofColor:T,setback:1.5,front:{h:.8,c:'#a8a090',style:'stone',rail:{h:1,c:'#b8704a',style:'lattice'}},
    open:[{t:'open',x:-1,w:4,h:2.4,c:'casa',grille:true}]}),
  // the salmon gable house with a long porch behind a salmon iron fence
  L('N',135.3,145.7,{wall:'#d89878',roof:'gable',roofColor:T,setback:1,front:{h:.4,c:'#d89878',rail:{h:1.6,c:'#c8805a',style:'bars'}},
    open:[{t:'open',x:0,w:9,h:2.3,c:'casa',awning:T}]}),
  // the pale green house with white-framed windows and a clay porch behind a white fence
  L('N',145.7,151,{wall:'#a8c890',roof:'gable',roofColor:'#e8e8e6',setback:1,front:{h:.4,c:'#a8c890',rail:{h:1.6,c:W,style:'bars'}},
    open:[{t:'window',x:-1,w:.8,h:1.4,frame:W},{t:'window',x:1,w:.8,h:1.4,frame:W}]}),
  // the beige sheet gate between grey pillars, a white house behind
  L('N',151,157.8,{wall:'#f0eee8',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#ece4d8',gates:[{t:'gate',x:0,w:2.6,c:'#d8c8b8'}]}}),
  // the white wall with a brown door and a white grille gate, the clay roofs behind
  L('N',157.8,167.5,{wall:'#f0eee8',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#ecebe6',gates:[{t:'gate',x:-3,w:1,c:'#7a3a2a'},{t:'gate',x:2,w:3,c:W}]}}),
  // nº 287: the white roughcast wall with a white gate under a clay roof
  L('N',167.5,172,{wall:'#ecebe6',roof:'hip',roofColor:T,setback:3,front:{h:2.2,c:'#ecebe6',gates:[{t:'gate',x:-1,w:1.2,c:W}]}}),
  // nº 281: the modern grey two-storey house: white garage doors, a glass-railed balcony
  L('N',172,179,{floors:2,wall:'#9aa4b4',upper:'#9aa4b4',roof:'flat',parapet:true,balcony:{x:0,w:7,fl:1,rail:'glass',depth:1.2},
    open:[{t:'garage',x:-1.8,w:2.4,c:W},{t:'garage',x:1.6,w:2.8,c:W}]}),
  // ================= WEST SIDE (S) =================
  // the old house with a carport behind a white gate, the lane beside it
  L('S',5.5,12,{wall:'#d8d0c0',roof:'gableSide',roofColor:'#8a8a86',setback:1,front:{h:.4,c:'#8a8a86',rail:{h:1.4,c:W,style:'bars'}}}),
  // the cream gable house, its side to the street, a black gate on the lane
  L('S',12,20.2,{wall:'#ecdcc0',roof:'gable',roofColor:T,open:[{t:'gate',x:3,w:1.4,c:'#2a2a2a'}]}),
  // the cream house with a white louvred window, the white house with dark shutters behind
  L('S',20.2,30,{wall:'#ecdcb8',roof:'gableSide',roofColor:T,plinth:{h:.9,c:'#8a7a6a'},open:[{t:'window',x:-2.6,w:1.6,shutters:W}]}),
  L('S',30,37,{wall:'#ecdcb8',roof:'hip',roofColor:T,plinth:{h:.9,c:'#8a7a6a'},open:[{t:'window',x:-1,w:1.4,grille:true},{t:'window',x:1.6,w:1.4,shutters:W},{t:'gate',x:-3,w:1.6,c:W}]}),
  // the pink house behind a pink wall with stepped white railings, a white grille gate
  L('S',37,44.9,{wall:'#e8ccd4',roof:'gable',roofColor:T,setback:2,front:{h:1.3,c:'#a8a8a4',rail:{h:.8,c:W,style:'bars'},gates:[{t:'gate',x:-2.4,w:1.6,c:W}]}}),
  L('S',44.9,52,{wall:'#e8ccd4',roof:'gable',roofColor:'#5a4a40',setback:1,front:{h:.4,c:'#e8ccd4',rail:{h:1.6,c:W,style:'bars'}},open:[{t:'open',x:-.6,w:3.4,h:2.4,c:'casa',grille:true}]}),
  // nº 25x: the red roughcast house with big open windows
  L('S',52,60.6,{wall:'#b8503a',roof:'gable',roofColor:T,open:[{t:'window',x:-1.4,w:2.2,h:1.3,frame:'#c8c4bc'},{t:'window',x:1.8,w:1.4,frame:'#c8c4bc'}]}),
  // the weathered plaster house with a carport behind white railings, a red louvred window
  L('S',60.6,68.2,{wall:'#d8ccb8',roof:'gableSide',roofColor:T,open:[{t:'open',x:-1,w:3.4,h:2.3,c:'casa',grille:true},{t:'window',x:2.4,w:1.2,shutters:'#a83a2a'}]}),
  // the cream two-storey house: brown louvres, a brown garage door
  L('S',68.2,77.2,{floors:2,wall:'#e4d8c4',upper:'#e4d8c4',roof:'hip',roofColor:T,plinth:{h:1.4,c:'#a8a494'},
    open:[{t:'garage',x:-.6,w:3.6,c:'#7a5a40'},{t:'window',x:-2,w:1.6,fl:1,shutters:'#a8783a'},{t:'window',x:1.6,w:1.6,fl:1,shutters:'#a8783a'}]}),
  // (77.2–92: the Guiomar Dorcie Fonsato)
  // the cream house behind a creeper-covered wall on the corner, a palm
  L('S',92.4,103.8,{wall:'#e8dcc4',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:'#5a7a4a',style:'hedge'},open:[{t:'window',x:0,w:1.4,frame:W}]}),
  // the creeper wall with a galvanized gate, the cream two-storey behind
  L('S',103.8,113.3,{floors:2,wall:'#e8dcc4',roof:'gable',roofColor:T,setback:3,front:{h:2.4,c:'#5a7a4a',style:'hedge',gates:[{t:'gate',x:-2,w:3,c:'#c8ccd0'}]}}),
  // the white garage door with a round motif, the white woven garage door next door
  L('S',113.3,121.4,{wall:'#ecebe6',roof:'hip',roofColor:T,open:[{t:'garage',x:-1.6,w:3.4,c:W},{t:'garage',x:2.4,w:3,c:W}]}),
  // the beige house with a glass-walled porch, the white lattice garage beside it
  L('S',121.4,131.2,{wall:'#d8d0c4',roof:'gable',roofColor:'#9a9a98',open:[{t:'open',x:1.6,w:3.6,h:2,y:.6,c:'casa'},{t:'garage',x:-2.6,w:3,c:W}]}),
  // the beige two-storey with a glass-railed balcony, a beige garage door
  L('S',131.2,137,{floors:2,wall:'#e8dcc8',upper:'#e8dcc8',roof:'flat',parapet:true,balcony:{x:0,w:5,fl:1,rail:'glass',depth:1},open:[{t:'garage',x:0,w:3,c:'#e0d8c8'}]}),
  // the cream house with a diagonal-bar white garage gate
  L('S',137,143,{wall:'#ecdcc0',roof:'hip',roofColor:T,open:[{t:'garage',x:-.4,w:3.4,c:W,grille:true},{t:'gate',x:2.2,w:1,c:W}]}),
  // the bare-brick wall, a white garage gate
  L('S',143,151,{wall:'#e8dcc8',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#b8704a',gates:[{t:'gate',x:-3,w:2.6,c:W}]}}),
  // the cream house with a white sliding garage door behind a tile pillar
  L('S',151,163.8,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:1,front:{h:2,c:'#ece4d4',gates:[{t:'gate',x:-1,w:4.4,c:'#e8e0d0'}]}}),
  // the weathered wall with a red sheet gate, the white gate of nº 348
  L('S',163.8,172,{wall:'#d8d0c4',roof:'gable',roofColor:'#8a4a32',setback:3,front:{h:2,c:'#a8a49c',gates:[{t:'gate',x:-.6,w:3,c:'#b83a2a'},{t:'gate',x:3,w:1.2,c:W}]}}),
  // the cream house behind white railings, a little lane with a blue door
  L('S',172,181.9,{wall:'#ecdcc0',roof:'gable',roofColor:T,setback:1.5,front:{h:.6,c:'#ece4d4',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:3,w:1.2,c:'#4a5a6a'}]}}),
  // the cream house with a deep arched porch, white sheet gates on both sides
  L('S',181.9,193.3,{wall:'#ecdcc0',roof:'gable',roofColor:T,setback:2,front:{h:.6,c:'#e4d8c4',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:3.6,w:3,c:W},{t:'gate',x:-3.6,w:3,c:W}]},
    open:[{t:'arch',x:0,w:2.4,y:0,h:2.2,c:'casa'}]}),
];

export const TREES:Tree[]=[
  {side:'S',s:96,kind:'palmeira'},{side:'N',s:6,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:10,every:34},
  keepOut:[
    {side:'S',s0:77.2,s1:92.4,why:'the mouth of the Rua Guiomar Dorcie Fonsato',walk:false},
  ],
};
