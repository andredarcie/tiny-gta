// Rua Manoel Pereira de Souza — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/mps-N-*/ and mps-S-*/, kept out of git; lot boundaries
// from the Microsoft building footprints). 693 m west→east from the Walter Darcie / Goiás corner
// to the Sete de Setembro / João Cabrera corner. Side 'N' is the north side, 'S' the south.
// The first 300 m are a red-earth country road between pastures, scrub and a woodlot (no
// houses); then the houses begin, the white retaining wall of the Cemitério Municipal runs along
// the south side (s 326–499, publicos.ts) and the Velório Municipal stands at its east end.
//   s=339 lane north   s=546 R. São Vicente de Paula   s=593 R. Capitão Thomaz de Andrade (north
//   only)   s=626 R. José Augusto Machado
// Opening x is measured from the lot centre as SEEN FROM THE STREET (left negative): on the north
// side (N) left is WEST (lower s), on the south side (S) left is EAST (higher s).
// Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Manoel Pereira de Souza';
export const CROSS=[0,31.5,81.6,133,182.2,339.1,469.9,545.5,626.5,693];
const SURFACE:Surface[]=[[0,320,'dirt'],[320,693,'asphalt']];
const T='#b0603f',W='#f1efe9',PRE='#cfcbc2',SPECK='#8e8e8a';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE (N) =================
  // the old cream house under red tiles, behind a hedge
  L('N',304.5,317.3,{wall:'#e8dcb0',roof:'hip',roofColor:'#9a4a32',setback:4,d:8,front:{h:1.4,c:'#5a7a3a',style:'hedge'},open:[{t:'window',x:0,w:1.4,shutters:'#a8acb0'}]}),
  // the yellow-cream gable house behind a low concrete wall with a chain-link gate
  L('N',317.3,325,{wall:'#e8dca0',roof:'gable',roofColor:T,setback:3,front:{h:1.1,c:'#c8c4bc',gates:[{t:'gate',x:1.6,w:3,h:1.6,c:'#b8bcc0'}]},open:[{t:'window',x:-1.4,w:1.2,shutters:'#7a5a3a'}]}),
  // (the dirt lane north)
  // the white house with a grey stone-clad pillar, white slatted gates
  L('N',342.7,351,{wall:'#ecebe6',roof:'gable',roofColor:'#9a9a98',panels:[{x:-1.4,w:1.2,stone:true}],setback:2,front:{h:1.4,c:'#ecebe6',gates:[{t:'gate',x:-.4,w:1,c:W},{t:'gate',x:2.4,w:3,c:W}]},
    open:[{t:'window',x:-2.8,w:1.4,shutters:W}]}),
  // the bare-brick gable house with a clay carport roof over its dark iron gates
  L('N',351,362,{wall:'#a85a3a',roof:'gable',roofColor:'#5a3a2a',x:['dish'],open:[{t:'garage',x:-1.2,w:7,h:2.4,c:'#4a4a4a',grille:true,awning:T},{t:'door',x:3.8,w:1,c:'#4a4a4a',grille:true}]}),
  // nº 304: the cream gable house with a porch behind a white iron fence
  L('N',362,371.5,{wall:'#ecdcc0',roof:'gable',roofColor:T,setback:1.5,front:{h:.3,c:W,rail:{h:1.1,c:W,style:'bars'}},
    open:[{t:'open',x:-1,w:4,h:2.3,c:'casa'},{t:'door',x:-1.6,w:.9,c:'#6a3a2a'},{t:'window',x:3,w:1,shutters:W}]}),
  // the beige roughcast gable house with a pillared carport, a barred door
  L('N',371.5,378,{wall:'#d8c8a8',roof:'gable',roofColor:'#8a8a86',open:[{t:'open',x:-1,w:4,h:2.4,c:'casa'},{t:'door',x:-1.6,w:.9,c:'#3a3a3a',grille:true}]}),
  // the cream house half hidden by a cypress hedge
  L('N',378,384,{wall:'#ece4d0',roof:'hip',roofColor:T,setback:2,front:{h:2,c:'#4a6a3a',style:'hedge'}}),
  // nº 310: the white house: a grey louvred window, a barred one, a white garage door
  L('N',384,394.4,{wall:'#ecebe6',roof:'gable',roofColor:'#9a9a98',plinth:{h:.5,c:'#b8b0a0'},x:['dish'],
    open:[{t:'window',x:-3.2,w:1.4,grille:true},{t:'window',x:-.6,w:1.6,shutters:'#8a8c8e'},{t:'door',x:1.4,w:.9,c:'#5a6a7a'},{t:'garage',x:3.6,w:2.6,c:W}]}),
  // the white house with a stone-tile front, brown shutters, a white garage door
  L('N',394.4,400,{wall:'#ecebe6',roof:'gable',roofColor:'#9a9a98',plinth:{h:1.2,stone:true},open:[{t:'window',x:-.8,w:1.8,shutters:'#4a2a1a'},{t:'door',x:1.8,w:.9,c:W}]}),
  L('N',400,405.6,{wall:'#6e7272',roof:'hip',roofColor:T,open:[{t:'garage',x:0,w:3,c:W}]}),
  // the dark grey house: a white gate with glass, white louvres, a stone-tile pillar
  L('N',405.6,415.6,{wall:'#6e7272',roof:'hip',roofColor:T,panels:[{x:-1.4,w:1,stone:true}],
    open:[{t:'gate',x:-3.4,w:2.4,c:W},{t:'window',x:.6,w:1.6,shutters:W},{t:'gate',x:3.6,w:1.2,c:W}]}),
  // nº 282... the pinkish-grey roughcast house: two grey sheet gates in arches, a climbing rose
  L('N',415.6,428.1,{wall:'#c8b8b4',roof:'gable',roofColor:'#5a5a58',fascia:W,open:[{t:'garage',x:-3,w:2.8,c:'#a8acb0'},{t:'garage',x:.4,w:2.8,c:'#a8acb0'},{t:'window',x:3.6,w:1.4,grille:true}]}),
  // nº 260: the white house on a dark red base: a carport behind an iron gate, three tall
  // windows, brown louvres
  L('N',428.1,440.4,{wall:'#f0eee8',roof:'gable',roofColor:'#5a3a2a',plinth:{h:1.2,c:'#9a4a4a'},
    open:[{t:'open',x:-4,w:3,h:2.4,c:'casa',grille:true},{t:'window',x:-1,w:.7,h:1.4,frame:'#5a3a2a'},{t:'window',x:0,w:.7,h:1.4,frame:'#5a3a2a'},{t:'window',x:1,w:.7,h:1.4,frame:'#5a3a2a'},{t:'window',x:4,w:1.8,shutters:'#7a3a2a'}]}),
  // (440–451: an earth yard)
  // nº 246: the old cream house: brown louvres, a carport under fibre-cement with an iron gate
  L('N',451.1,461,{wall:'#ecdcb8',roof:'gable',roofColor:'#9a4a32',open:[{t:'gate',x:-2.6,w:2.6,c:'#5a5a5a',awning:'#8a8a86'},{t:'window',x:1.6,w:1.4,shutters:'#a8783a'}]}),
  // the carport with an iron gate under a corrugated roof
  L('N',461,466,{wall:'#ecdcb8',roof:'gableSide',roofColor:'#8a8a86',open:[{t:'gate',x:0,w:3.6,c:'#4a4a4a',grille:true}]}),
  // the white house with blue shutters and a blue door, a grey sheet gate
  L('N',466,473.4,{wall:'#f0eee8',roof:'gable',roofColor:'#9a4a32',open:[{t:'window',x:-2,w:1.2,shutters:'#2a5aa8'},{t:'door',x:.4,w:.9,c:'#2a5aa8'},{t:'gate',x:2.6,w:1.8,c:'#5a5a5a'}]}),
  // the old house with an awning over its yard gate, a blue door
  L('N',473.4,479,{wall:'#ece4d4',roof:'gable',roofColor:'#9a4a32',open:[{t:'door',x:-1.8,w:1,c:'#2a5aa8'},{t:'gate',x:1,w:3,c:'#5a5a5a',awning:'#c8c4b8'}]}),
  // the old cream house with a red louvred window and a white picket gate
  L('N',479,485,{wall:'#ecdcc0',roof:'gable',roofColor:'#9a4a32',plinth:{h:.4,c:'#9a3a2a'},open:[{t:'window',x:-1,w:1.2,shutters:'#a8402a',frame:W},{t:'gate',x:2,w:1,c:W}]}),
  // nº 206: the white house with a brown slatted garage door
  L('N',485,491.5,{wall:'#f0eee8',roof:'flat',parapet:true,open:[{t:'garage',x:.4,w:3,c:'#8a5a30'}]}),
  // the white wall with a brown slatted door
  L('N',491.5,497.9,{wall:'#f0eee8',roof:'flat',parapet:true,open:[{t:'garage',x:-1.6,w:2.2,c:'#8a5a30'},{t:'door',x:1.6,w:.9,c:'#8a5a30'}]}),
  // the lilac house on a stone base: a white louvred window, a white barred one, a white X gate
  L('N',497.9,508,{wall:'#e4dcec',roof:'gable',roofColor:T,plinth:{h:1,stone:true},
    open:[{t:'window',x:-2.6,w:1.6,shutters:W},{t:'window',x:.6,w:1.8,grille:true,frame:W},{t:'gate',x:3.6,w:1.6,c:W}]}),
  // the yellow-green house with a little porch, a white louvred window
  L('N',508,515.6,{wall:'#d8d888',roof:'gable',roofColor:'#8a3a2a',open:[{t:'window',x:-1.4,w:1.4,shutters:W},{t:'open',x:1.8,w:2,h:2.3,c:'casa'},{t:'door',x:1.8,w:.9,c:'#2a2a2a'}]}),
  // the stone-tile wall with a black door behind a hedge, the clay-roofed house behind
  L('N',515.6,528,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:2.5,x:['dish'],front:{h:2.3,c:'#c8b8a0',style:'stone',gates:[{t:'gate',x:-2,w:1.2,c:'#2a2a2a'},{t:'gate',x:4.6,w:2.4,c:'#2a2a2a'}]}}),
  // the grey roughcast gable house: white barred windows, a white garage door
  L('N',528,541.7,{wall:'#9a9e98',roof:'gable',roofColor:'#6a6a68',plinth:{h:1.1,c:'#b8b0a4'},
    open:[{t:'window',x:-4,w:1.6,grille:true,frame:W},{t:'window',x:-.8,w:1.6,grille:true,frame:W},{t:'garage',x:2.8,w:2.4,c:W},{t:'door',x:1,w:.9,c:'#2a2a2a'}]}),
  // --- São Vicente de Paula → (Capitão Thomaz de Andrade)
  // the green roughcast house with brown shutters and a glass door
  L('N',549.3,566,{wall:'#a8c098',roof:'gable',roofColor:'#8a3a2a',
    open:[{t:'window',x:-3,w:2,shutters:'#6a2a1a',frame:W},{t:'glass',x:2.4,w:1.8,y:.1,h:2.3,frame:W},{t:'window',x:5.6,w:1.2,frame:'#5a3a2a'}]}),
  // the mauve-grey roughcast house with a glass shop door under its sign board
  L('N',566,577,{wall:'#b8a8a8',roof:'hip',roofColor:'#8a3a2a',
    open:[{t:'window',x:-3,w:1.8,shutters:W,frame:W},{t:'glass',x:.4,w:2,y:.1,h:2.3},{t:'window',x:3.8,w:1.4,shutters:W,frame:W}]}),
  // nº 100: the grey roughcast house: glass blocks, a white louvred window, a carport behind
  // white iron railings
  L('N',577,589.6,{wall:'#a8a8a6',roof:'gable',roofColor:'#3a2a24',
    open:[{t:'glass',x:-4,w:2.8,y:.6,h:1.4,frame:W},{t:'window',x:-.4,w:1.4,shutters:W},{t:'open',x:3.6,w:3.6,h:2.4,c:'casa',grille:true}]}),
  // --- (Capitão Thomaz de Andrade) → José Augusto Machado
  // the grey speckled wall with a white door
  muro('N',615,622.7,SPECK,2,{front:{h:2,c:SPECK,gates:[{t:'gate',x:2,w:1,c:W}]}}),
  // --- José Augusto Machado → Sete de Setembro
  // (597–615: the cream corner house behind its zigzag balustrade fronts the Capitão Thomaz)
  // grey roughcast walls with a white door and a white sheet gate, the old green house behind
  L('N',630.3,640,{wall:'#c8d898',roof:'hip',roofColor:'#8a4a32',setback:3,d:8,front:{h:2,c:SPECK,gates:[{t:'gate',x:-2.6,w:1,c:W},{t:'gate',x:2.4,w:3,c:'#c8ccd0'}]}}),
  // the carport behind an iron gate under fibre-cement, an iron fence
  L('N',640,647,{wall:'#c8d898',roof:'gableSide',roofColor:'#9a9a98',setback:1,front:{h:.4,c:'#e0e0dc',rail:{h:1.4,c:'#e8e8e6',style:'bars'}}}),
  // the salmon roughcast gable house with an open porch, a white louvred window
  L('N',647,655,{wall:'#c8786a',roof:'gable',roofColor:'#8a3a2a',open:[{t:'window',x:-1.8,w:1.4,shutters:W,frame:'#e8dcb0'},{t:'open',x:1.6,w:3,h:2.3,c:'casa'}]}),
  // the bare-brick gable house on a stone base, white-framed window behind an iron fence, the
  // salmon garage pillar
  L('N',655,664,{wall:'#9a4a32',roof:'gable',roofColor:'#8a3a2a',plinth:{h:.6,stone:true},setback:1,front:{h:.4,c:'#c8b8a0',rail:{h:1,c:W,style:'bars'}},
    open:[{t:'garage',x:-3,w:2.4,c:'#e0d8c0'},{t:'window',x:1.4,w:3,frame:'#e8dcb0'}]}),
  // the cream gable house with a grey stone strip, white-framed windows, a white garage door
  L('N',664,675,{wall:'#ece2d0',roof:'gable',roofColor:'#6a4a3a',panels:[{x:-2.6,w:1,stone:true}],
    open:[{t:'window',x:-4.2,w:1.4,shutters:W,frame:'#c8a878'},{t:'window',x:-.6,w:2.4,frame:'#c8a878'},{t:'garage',x:3.4,w:2.6,c:W}]}),
  // the cream house with brown shutters behind a low pink wall full of roses
  L('N',675,684,{wall:'#ecd8c0',roof:'hip',roofColor:'#8a4a32',setback:1.5,front:{h:.8,c:'#e0a898',rail:{h:.5,c:'#5a3a2a',style:'bars'}},
    open:[{t:'window',x:-3,w:1.6,frame:'#3a2a24'},{t:'door',x:-1,w:.9,c:'#3a2a24',grille:true},{t:'window',x:1.4,w:1.8,shutters:'#8a3a2a'},{t:'window',x:3.6,w:1.6,shutters:'#8a3a2a'}]}),
  // the brown board gate by the corner
  L('N',684,689.2,{wall:'#ecd8c0',roof:'hip',roofColor:'#8a4a32',setback:3,d:8,front:{h:2.3,c:'#ecd8c0',gates:[{t:'gate',x:-.6,w:2.6,c:'#8a3a2a'}]}}),
  // ================= SOUTH SIDE (S) =================
  // nº 207: the old white house on a stone base, barred windows, behind a wire fence
  L('S',295.5,316.7,{wall:'#ece4d4',roof:'gable',roofColor:'#6a4a3a',plinth:{h:.8,stone:true},setback:4,d:8,front:{h:1.1,c:'#7a6a5a',style:'lattice'},
    open:[{t:'window',x:5,w:1.6,grille:true,frame:'#c8906a'},{t:'window',x:1,w:1.4,grille:true,frame:'#c8906a'},{t:'window',x:-4,w:1.6,grille:true,frame:'#c8906a'}]}),
  // the precast wall, a white house behind it
  muro('S',316.7,326,PRE,1.8,{front:{h:1.8,c:PRE,style:'panel'},behind:{w:7,d:8,at:3,roofColor:'#6a4a3a',wall:'#ecebe6'}}),
  // (326–499: the Cemitério Municipal's white retaining wall, publicos.ts)
  // (499–512: the Velório's paved forecourt under the trees)
  // the Velório Municipal Roque José Canolato: white tiles with a red and blue stripe
  L('S',512,531,{wall:'#f2f2f0',roof:'gable',roofColor:'#b8b8b4',plinth:{h:.9,c:'#d8d4cc'},
    sign:{text:'VELÓRIO MUNICIPAL ROQUE JOSÉ CANOLATO',bg:'#f2f2f0',fg:'#8a8c90',x:0,y:3.2,w:16,h:.7},
    panels:[{x:0,w:19,c:'#2a4aa8',y0:1.25,y1:1.35},{x:0,w:19,c:'#c8302a',y0:1.35,y1:1.45}],
    open:[{t:'window',x:7,w:1.6,frame:W},{t:'window',x:3.4,w:.7,h:1.4},{t:'window',x:2.2,w:.7,h:1.4},{t:'window',x:-1,w:2,frame:W},{t:'window',x:-6,w:2,frame:W}]}),
  // nº 155: the bar and grocery under a corrugated awning, the orange base
  L('S',531.2,541.7,{wall:'#e8dcc8',roof:'hip',roofColor:T,plinth:{h:.8,c:'#d89848'},sign:{text:'BAR · MERCEARIA',bg:'#e8dcc8',fg:'#2a2a2a',x:-1.6,y:2,w:1.6,h:.5},
    open:[{t:'open',x:1.6,w:4,h:2.4,c:'geral',awning:'#a8a8a4'},{t:'gate',x:-3.4,w:1.4,c:W}]}),
  // --- São Vicente de Paula → José Augusto Machado
  // the white-and-blue house behind a white balustrade on a grey base, a palm
  L('S',551.9,566,{wall:'#e8ecf0',roof:'hip',roofColor:T,plinth:{h:1.1,c:'#a8b4c0'},setback:2,front:{h:.8,c:'#a8b4c0',rail:{h:.8,c:W,style:'lattice'}},
    open:[{t:'window',x:-4,w:1.8,shutters:W},{t:'window',x:3.4,w:1.8,shutters:W}]}),
  // the house on a red base with a balustraded porch and a red gate
  L('S',566,576.3,{wall:'#e8d8c0',roof:'gable',roofColor:'#8a3a2a',plinth:{h:1,c:'#a84a40'},setback:1,front:{h:.6,c:'#a84a40',rail:{h:.8,c:W,style:'lattice'},gates:[{t:'gate',x:2,w:2.2,c:'#b86a60'}]},
    open:[{t:'open',x:-1.6,w:4,h:2.3,c:'casa'},{t:'window',x:2.2,w:1.4,grille:true}]}),
  // the white gable house with a barred window, crape myrtles in front, an iron gate
  L('S',576.3,586.2,{wall:'#f0eee8',roof:'gable',roofColor:'#6a4a3a',setback:2.5,front:{h:.6,c:'#8a8a86',rail:{h:1.2,c:'#9aa0a4',style:'bars'},gates:[{t:'gate',x:3,w:2.6,c:'#9aa0a4'}]},
    open:[{t:'window',x:-.6,w:2,grille:true}]}),
  // the pale green two-storey house behind a grey speckled wall, a white gate
  L('S',586.2,597,{floors:2,wall:'#d8e8d8',upper:'#d8e8d8',roof:'gable',roofColor:'#5a4a40',setback:3,front:{h:1.6,c:SPECK,rail:{h:.8,c:W,style:'bars'},gates:[{t:'gate',x:4,w:1.2,c:W},{t:'gate',x:-3.6,w:2.4,c:'#c8ccd0'}]},
    open:[{t:'window',x:-1.6,w:1.6,fl:1,shutters:W},{t:'window',x:1.6,w:.8,fl:1,grille:true}]}),
  // the white two-storey house on a stone base: a balustraded balcony over the carport
  L('S',597,610,{floors:2,wall:'#f0eee8',upper:'#f0eee8',roof:'gable',roofColor:T,plinth:{h:1.6,stone:true},
    balcony:{x:-1,w:7,fl:1,rail:'white',depth:1.4},
    open:[{t:'open',x:-1,w:4.6,h:2.5,c:'casa',grille:true},{t:'window',x:4,w:2.4,y:1.4,h:.4},{t:'window',x:-1,w:1.6,fl:1,shutters:'#a8783a'}]}),
  // --- José Augusto Machado → Sete de Setembro
  // nº 27: the clothes shop under a curved awning, a balustraded balcony above
  L('S',648,662,{floors:2,d:4.5,wall:'#ecdcd8',upper:'#ecdcd8',roof:'flat',parapet:true,balcony:{x:2,w:5,fl:1,rail:'white',depth:1.2},
    open:[{t:'open',x:3.4,w:5.2,h:2.6,c:'roupa',awning:'#a8a8a4'},{t:'door',x:-1,w:.9,c:'#d8e0e0',grille:true},{t:'door',x:-2.6,w:.9,c:'#d8e0e0',grille:true},{t:'garage',x:-5,w:2.4,c:W}]}),
  // the pink-beige wall with a white gate, the house behind under a clay hood
  L('S',662,672,{wall:'#ecdcd8',roof:'hip',roofColor:T,setback:3,front:{h:2.2,c:'#d8ccc8',gates:[{t:'gate',x:2.6,w:2.6,c:W,awning:T}]}}),
];

export const TREES:Tree[]=[
  {side:'S',s:412,kind:'ficus'},{side:'S',s:420,kind:'ficus'},{side:'S',s:428,kind:'ficus'},{side:'S',s:436,kind:'ficus'},
  {side:'S',s:452,kind:'ficus'},{side:'S',s:492,kind:'ficus'},{side:'S',s:503,kind:'ficus'},{side:'S',s:508,kind:'ficus'},
  {side:'S',s:556,kind:'palmeira'},{side:'S',s:578,kind:'reseda'},{side:'S',s:584,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:300,every:34},
  keepOut:[
    {side:'N',s0:0,s1:300,why:'the country road: pasture, scrub and a woodlot, no sidewalk',walk:false},
    {side:'S',s0:0,s1:292,why:'the country road: pasture and a stable, no sidewalk',walk:false},
    {side:'S',s0:326,s1:499,why:'the Cemitério Municipal (publicos.ts)'},
    {side:'N',s0:589.6,s1:597.2,why:'the mouth of the Rua Capitão Thomaz de Andrade',walk:false},
  ],
};
