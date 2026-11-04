// Rua Goiás — surveyed lot by lot from Google Street View (2024–2026 imagery; one view aimed at
// each ~8 m of lot from the nearest panorama, local in docs/divinolandia/referencias-streetview/
// go-N-*/ and go-S-*/, kept out of git; lot boundaries from the Microsoft building footprints).
// 297 m north→south from the Rua São José down to the Walter Darcie / Manoel Pereira de Souza
// corner. `s` starts at the NORTH end, so side 'N' is the EAST side (left of a walker going
// south) and 'S' the WEST side. The João Cabral de Medeiros (s 66.2) only leaves to the east:
// its mouth is a keepOut on the east side, the west side runs on unbroken.
// Asphalt. Opening x is measured from the lot centre as SEEN FROM THE STREET (left negative): on
// the east side (N) left is NORTH (lower s), on the west side (S) left is SOUTH (higher s).
// Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Goiás';
export const CROSS=[0,297.4];
const SURFACE:Surface[]=[[0,297.4,'asphalt']];
const T='#b0603f',W='#f1efe9',BRICK='#c07a58',BEIGE='#e6d6bc',PRE='#cfcbc2',SPECK='#8e8e8a';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- São José → (João Cabral de Medeiros)
  // the beige lean-to on the corner behind an ochre roughcast wall, a beige louvred gate
  L('N',3.8,8,{wall:BEIGE,roof:'gableSide',roofColor:'#8a5a3a',setback:3,d:7,front:{h:2,c:'#c8a060',gates:[{t:'gate',x:1.4,w:1.6,c:'#e0d4b0'}]}}),
  // the bare-brick bungalow with a deep porch and its balustrade behind white iron railings,
  // brown shutters, a beige louvred garage door
  L('N',8,21,{wall:BRICK,roof:'gable',roofColor:'#8a5a3a',fascia:W,setback:1.7,front:{h:.5,c:W,rail:{h:1.3,c:'#e8e8e6',style:'bars'}},
    open:[{t:'window',x:-4.4,w:1.6,grille:true,frame:W},{t:'open',x:-.8,w:4,h:2.4,c:'casa'},{t:'window',x:-.8,w:1.4,shutters:'#7a4a2a'},{t:'garage',x:4,w:2.8,c:'#e0d4b0'}]}),
  // the long bare-brick wall with concrete posts round a palm grove, a brown wooden gate, the
  // green Agrovarelli board by the little door
  muro('N',21,40,BRICK,2.7,{front:{h:2.7,c:BRICK,style:'panel',gates:[{t:'gate',x:1,w:2.6,c:'#5a3a2a'}]}}),
  muro('N',40,61.4,BRICK,2.7,{front:{h:2.7,c:BRICK,style:'panel',gates:[{t:'gate',x:-9.6,w:1.1,h:2.1,c:'#4a3a2a'}]},
    sign:{text:'AGROVARELLI',bg:'#e8f0e0',fg:'#3a8a3a',x:-8.4,y:1.4,w:1,h:1.3}}),
  // --- (João Cabral de Medeiros) → Walter Darcie
  // the roofless bare-brick ruin with a galvanized sheet gate
  muro('N',70,82,'#a8603e',2.2,{front:{h:2.2,c:'#a8603e',gates:[{t:'gate',x:-3.4,w:3,c:'#b8bcc0'}]}}),
  // the tall white house, a green upper floor behind the beige front wall
  L('N',82,95,{floors:2,wall:'#f0eee8',upper:'#9ad08a',roof:'flat',parapet:true,setback:1,
    front:{h:2.4,c:'#ecdcc0'},open:[{t:'window',x:-2,w:1.4,fl:1,frame:W},{t:'window',x:2.6,w:1.4,fl:1,frame:W}]}),
  // the white house with an olive garage door picked out in white lines
  L('N',95,101,{wall:'#f0eee8',roof:'flat',parapet:true,open:[{t:'garage',x:-.6,w:3,c:'#b0a878'},{t:'door',x:2.2,w:.9,c:W}]}),
  // the beige house with a wide frosted-glass window and a white slatted side door
  L('N',101,108.6,{wall:'#d8c4a4',roof:'flat',parapet:true,open:[{t:'glass',x:-.6,w:3.4,y:.9,h:1.3,frame:W},{t:'door',x:3,w:.9,c:W}]}),
  // the beige two-storey house: white X-lattice garage gate, a lattice balcony, stone-clad pillar
  L('N',108.6,124,{floors:2,wall:'#e8d8c0',upper:'#ece2cc',roof:'hip',roofColor:T,fascia:W,x:['ac','heater'],
    balcony:{x:2,w:8,fl:1,rail:'white',depth:1.2},panels:[{x:-3.6,w:.8,stone:true,y0:0,y1:2.6}],
    open:[{t:'gate',x:-5.6,w:2.6,c:W},{t:'garage',x:.6,w:4.6,c:W},{t:'window',x:-4,w:1.4,fl:1,shutters:W},{t:'open',x:3,w:3,h:2.3,fl:1,c:'casa'}]}),
  // the white bungalow behind a white lattice fence
  L('N',124,128.6,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:2,x:['dish'],front:{h:1.2,c:W,style:'lattice'},
    open:[{t:'open',x:0,w:2.6,h:2.3,c:'casa'}]}),
  // (128.6–131.5: an empty grass lot)
  // the modern white cube: steps up to the door, a white sliding gate
  L('N',131.5,139,{wall:'#f4f4f2',roof:'flat',parapet:true,open:[{t:'door',x:-2.2,w:1,c:W},{t:'garage',x:1.4,w:4,c:'#f2f2f0'}]}),
  // the white house with a clay-tiled carport roof and a white iron gate
  L('N',139,145,{wall:'#f0eee8',roof:'gable',roofColor:T,setback:1,front:{h:.6,c:W,rail:{h:1.4,c:W,style:'bars'}},
    open:[{t:'open',x:0,w:3.4,h:2.3,c:'casa',awning:T}]}),
  // the pink house: pink front wall, two grey iron gates
  L('N',145,152,{wall:'#e0b4b0',roof:'hip',roofColor:T,setback:2.5,front:{h:1.4,c:'#e0b8b4',gates:[{t:'gate',x:-.4,w:2.6,c:'#9aa0a4'},{t:'gate',x:2.4,w:1.6,c:'#9aa0a4'}]}}),
  // nº 118: the beige two-storey house with its upstairs veranda behind a tiled wall, a white gate
  L('N',152,162,{floors:2,wall:'#ecdcbc',roof:'hip',roofColor:T,setback:2,front:{h:2.6,c:'#e4dccc',style:'panel',gates:[{t:'gate',x:-4,w:1.4,c:W}]},
    open:[{t:'open',x:1,w:5,h:2.4,fl:1,c:'casa'}]}),
  // (162–175: a gravel yard and trees)
  // the white house with a stone-clad front, the big grey garage gate under a clay porch roof
  L('N',175,187,{wall:'#f0eee8',roof:'hip',roofColor:T,plinth:{h:1.2,stone:true},x:['dish'],
    open:[{t:'garage',x:.6,w:5.6,h:2.5,c:'#8a9098',awning:T},{t:'window',x:-4.4,w:1.4,frame:W}]}),
  // nº 127: the beige two-storey house behind a tiled wall, brown board gates under tiled hoods
  L('N',187,199,{floors:2,wall:'#ecdcc4',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:'#e4d6c0',style:'panel',
    gates:[{t:'gate',x:-2.6,w:3.4,c:'#a88a6a'},{t:'gate',x:3.6,w:1.2,c:'#7a6248',awning:T}]},open:[{t:'window',x:-1,w:1.2,fl:1,frame:W},{t:'window',x:2,w:1.2,fl:1,frame:W}]}),
  // (199–212: an empty lot, a rail fence)
  // the pale blue house with a big white gate under a clay porch roof
  L('N',212,222,{wall:'#c8dce0',roof:'hip',roofColor:T,setback:2,front:{h:2.2,c:'#c8dce0',gates:[{t:'gate',x:1,w:5,c:W,awning:T},{t:'gate',x:-3.4,w:1.2,c:'#e0d4b0'}]}}),
  // the grey panelled wall with a white door, the clay-roofed house behind it, a palm
  L('N',222,235,{wall:'#ecebe6',roof:'hip',roofColor:T,setback:3,x:['dish'],front:{h:2.3,c:'#d4d2cc',style:'panel',gates:[{t:'gate',x:2.4,w:1.1,c:W,awning:T}]}}),
  // (235–245: a white corner wall and an empty lot)
  // the clay-roofed house with two beige garage doors, a brown slatted gate
  L('N',245.6,252.2,{wall:'#e4dccc',roof:'hip',roofColor:T,open:[{t:'garage',x:-1.6,w:2.2,c:'#c8a878'},{t:'garage',x:1.6,w:2.2,c:'#c8a878'}]}),
  // the grey two-storey house, barred windows under awnings, a white gate and white iron fence
  L('N',252.2,259,{floors:2,wall:'#d8d4cc',roof:'flat',parapet:true,front:{h:.3,c:W,rail:{h:1.5,c:W,style:'bars'}},
    open:[{t:'garage',x:-1.2,w:2.6,c:W},{t:'window',x:-1.4,w:1.6,fl:1,grille:true,awning:'#d8d0c0'},{t:'window',x:1.6,w:1.6,fl:1,grille:true,awning:'#d8d0c0'}]}),
  // the white two-storey house with a white awning over the steps, a white gate
  L('N',259,264.6,{floors:2,wall:'#f0eee8',roof:'flat',parapet:true,open:[{t:'door',x:-1,w:1,c:W,awning:W},{t:'gate',x:1.4,w:1.6,c:W},{t:'window',x:0,w:1.6,fl:1,frame:'#3a3a3a'}]}),
  // nº 177: the brick-tile front with grey-green garage doors under a clay roof
  L('N',264.6,272,{wall:'#a86a50',roof:'gableSide',roofColor:T,open:[{t:'garage',x:-1.4,w:1.4,c:'#a8b8b0'},{t:'garage',x:1.2,w:2.8,c:'#a8b8b0'}]}),
  // nº 207: the wood-look tiled front, a grey door, a white grille gate under a clay roof
  L('N',272,281,{wall:'#9a6a48',roof:'gableSide',roofColor:T,open:[{t:'door',x:-3,w:1,c:'#9aa0a4'},{t:'garage',x:1.6,w:4.2,c:'#e8e8e6',grille:true}]}),
  // the pink house: a white louvred window, a speckled tile base, the white X gate under clay tiles
  L('N',281,288,{floors:2,wall:'#e8b0c8',upper:'#e8b0c8',roof:'flat',parapet:true,plinth:{h:1.4,c:'#c8b498'},
    open:[{t:'gate',x:-1.8,w:2.6,c:W,awning:T},{t:'window',x:1.8,w:1.8,shutters:W},{t:'window',x:1.8,w:1.4,fl:1,frame:W}]}),
  // the new white flat-roofed house on the Walter Darcie corner, grilled door, white windows
  L('N',288,293.6,{wall:'#ecedee',roof:'flat',parapet:true,x:['dish'],open:[{t:'window',x:-1.6,w:1.2,frame:W},{t:'door',x:.4,w:.9,c:'#3a3a3a',grille:true},{t:'window',x:2,w:1.2,frame:W}]}),
  // ================= WEST SIDE (S) =================
  // the beige corner house raised on a grey speckled base, white iron railing
  L('S',4.2,12.5,{wall:'#e8e0d0',roof:'hip',roofColor:T,plinth:{h:1.8,c:SPECK},setback:2.5,front:{h:.4,c:SPECK,rail:{h:1.1,c:W,style:'bars'}},
    open:[{t:'window',x:0,w:2,y:2,shutters:W}]}),
  // the white gable house behind a grey sheet gate and a low wall with white railings
  L('S',12.5,20,{wall:'#ecebe6',roof:'gable',roofColor:T,setback:4,d:7,front:{h:1.4,c:SPECK,gates:[{t:'gate',x:-1.4,w:3.6,h:2,c:'#9aa0a4'},{t:'gate',x:3,w:1.4,h:2,c:'#e0d4b0'}]}}),
  // the precast concrete wall, a garden behind
  muro('S',20,26.6,PRE,2,{front:{h:2,c:PRE,style:'panel'}}),
  // the beige house with a carport: grey wave-topped wall with white bars, a grey iron gate
  L('S',26.6,37.5,{wall:'#ece4d0',roof:'hip',roofColor:T,setback:2,front:{h:.8,c:'#7a7a78',rail:{h:1.3,c:'#8a8c8e',style:'bars'},gates:[{t:'gate',x:2.4,w:3.2,c:'#8a8c8e'}]},
    open:[{t:'open',x:2.4,w:3,h:2.3,c:'casa'},{t:'window',x:-2,w:2,grille:true}]},'mosaico'),
  // the tall beige house behind a beige wall with a big beige sheet gate
  L('S',37.5,46.6,{floors:2,wall:'#d8ccb8',roof:'hip',roofColor:T,setback:3,front:{h:2.3,c:'#c8b8a0',gates:[{t:'gate',x:.6,w:4.4,c:'#e0d0b0'}]},
    open:[{t:'window',x:-1,w:1.4,fl:1,grille:true},{t:'window',x:2,w:1.4,fl:1,grille:true}]},'mosaico'),
  // the beige house with a pillared veranda behind black-framed glass, a yellow roughcast base
  L('S',46.6,56.3,{wall:'#e4d4bc',roof:'hip',roofColor:T,plinth:{h:1.3,c:'#b8945a'},
    open:[{t:'open',x:.4,w:6,h:2.3,y:1.3,c:'casa'},{t:'window',x:-1.6,w:1.4,y:2.2}]},'mosaico'),
  // the white house behind a beige stone-tile wall: brown shutters, a brown sliding gate
  L('S',56.3,70,{wall:'#f0eee8',roof:'hip',roofColor:T,setback:2,front:{h:1.6,c:'#d8c4a0',gates:[{t:'gate',x:5,w:2.6,h:1.9,c:'#7a3a2a'}]},
    open:[{t:'window',x:-1.8,w:1.4,shutters:'#6a3a2a'},{t:'window',x:1.6,w:1.2,shutters:'#7a4a2a'}]}),
  // the grey two-storey house behind a grey wall with a white louvred door
  L('S',70,77.6,{floors:2,wall:'#d8d0c0',roof:'gable',roofColor:T,setback:2,front:{h:2.2,c:'#c8c4bc',gates:[{t:'gate',x:-1.2,w:1,c:W},{t:'gate',x:1.2,w:1,c:'#6a3a2a'}]}}),
  // the beige gable house with a porch behind a grimy white wall, a barred gate
  L('S',77.6,85.7,{wall:'#e8dcc4',roof:'gable',roofColor:'#8a5a3a',setback:3,front:{h:1.5,c:'#e4e2dc',gates:[{t:'gate',x:2.8,w:1.2,c:'#8a8c8e'}]},
    open:[{t:'open',x:.4,w:2.6,h:2.2,c:'casa'},{t:'window',x:-2.4,w:1.6,shutters:'#b8bcc0'}]}),
  // the green house with a little clay-roofed porch behind a green wall
  L('S',85.7,96.3,{wall:'#b0c088',roof:'hip',roofColor:T,setback:2,front:{h:1.3,c:'#b0c088',gates:[{t:'gate',x:.6,w:1.2,c:'#8a8c8e'}]},
    open:[{t:'open',x:.6,w:2.2,h:2.3,c:'casa',awning:T},{t:'window',x:-2.2,w:1.2,shutters:'#5a4a3a'}]}),
  // the grey roughcast gable house with white frames, a carport and a grey iron fence
  L('S',96.3,104,{wall:'#9c9c98',roof:'gable',roofColor:'#8a3a2a',fascia:W,setback:2,front:{h:.6,c:SPECK,rail:{h:1.2,c:'#8a8c8e',style:'bars'}},
    open:[{t:'window',x:1.4,w:1.8,shutters:W,frame:W},{t:'door',x:-1.4,w:.9,c:'#c8c4bc'},{t:'open',x:-3.2,w:1.6,h:2.3,c:'casa'}]}),
  // the old beige house with a porch, set back behind a lawn, a low wall and an iron gate
  L('S',104,112,{wall:'#ece0c8',roof:'gable',roofColor:'#8a5a3a',setback:5,d:7,front:{h:1.4,c:'#a8a294',gates:[{t:'gate',x:1,w:3,c:'#8a8c8e'}]},x:['dish'],
    open:[{t:'open',x:0,w:4,h:2.2,c:'casa'},{t:'door',x:0,w:.9,c:'#8a4a2a'}]}),
  // the old white house with green-framed windows and a porch (for sale)
  L('S',112,119,{wall:'#f0eee8',roof:'gable',roofColor:'#8a5a3a',plinth:{h:.8,c:'#a8a294'},setback:1,
    open:[{t:'window',x:1.8,w:1.2,frame:'#9ac080',shutters:'#c8d0d4'},{t:'open',x:-1.6,w:2.6,h:2.3,c:'casa'},{t:'door',x:-1.6,w:.9,c:'#a84a2a'}]}),
  // (119–133: an overgrown garden, bananas and fruit trees)
  // the white house with a balustraded veranda raised on a grey base
  L('S',133,140,{wall:'#f0eee8',roof:'gableSide',roofColor:'#8a5a3a',plinth:{h:1.6,c:SPECK},setback:1,
    open:[{t:'open',x:0,w:5,h:2.2,y:1.6,c:'casa'}]}),
  // the grey-blue house behind a white iron fence, a garden
  L('S',140,147,{wall:'#a4aeb8',roof:'gable',roofColor:T,fascia:W,setback:3,front:{h:.5,c:W,rail:{h:1.3,c:W,style:'bars'}},
    open:[{t:'window',x:1,w:1.6,shutters:W,frame:W},{t:'open',x:-2,w:2,h:2.3,c:'casa'}]}),
  // the red gable house behind a yellow wall with a barred gate
  L('S',147,155,{wall:'#b8504c',roof:'gable',roofColor:'#4a3a32',setback:3,front:{h:2,c:'#e8d890',gates:[{t:'gate',x:1.4,w:1.6,c:'#8a8c8e'}]},
    open:[{t:'door',x:-.6,w:1.2,c:'#8a4a2a'}]}),
  // the tall tan wall of the next house
  muro('S',155,162,'#c8a888',2.8),
  // the beige house behind a beige wall with white V-shaped bars, a white gate and a brown one
  L('S',162,172,{wall:'#e4d8c0',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#d8c8a8',rail:{h:.6,c:W,style:'bars'},
    gates:[{t:'gate',x:-1,w:2.2,c:W},{t:'gate',x:-4,w:2.6,c:'#c8a070',awning:T},{t:'gate',x:3,w:2.6,c:W,awning:T}]}}),
  // nº 808: the beige gable house with its barred carport gate under a brown roof
  L('S',172,186,{wall:'#ecdcbc',roof:'gable',roofColor:'#5a5a5a',plinth:{h:.5,c:SPECK},setback:1,
    open:[{t:'window',x:-1.6,w:1.4,grille:true},{t:'garage',x:2.6,w:2.6,c:'#3a3a3a',grille:true,awning:'#5a3a2a'}]}),
  // the beige house behind a white bar fence
  L('S',186,195,{wall:'#e8dcc0',roof:'gable',roofColor:T,setback:2,front:{h:.5,c:'#ecebe6',rail:{h:1.3,c:W,style:'bars'}},
    open:[{t:'window',x:-1.6,w:1.4,shutters:'#a89070'},{t:'window',x:1.6,w:1.4,shutters:'#a89070'}]}),
  // the beige house with brown louvred windows behind a white fence
  L('S',195,201,{wall:'#e8dcc4',roof:'gable',roofColor:'#6a6a6a',setback:1.5,front:{h:.4,c:W,rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'window',x:-1.4,w:1.4,shutters:'#a89070',frame:W},{t:'window',x:1.4,w:1.4,shutters:'#a89070',frame:W}]}),
  // the beige gable house with a barred window and a grey louvred one
  L('S',201,208,{wall:'#ecdcc4',roof:'gable',roofColor:'#6a6a6a',plinth:{h:.5,c:SPECK},
    open:[{t:'window',x:1.4,w:1.6,grille:true},{t:'window',x:-1.6,w:1.6,shutters:'#8a8c8e'}]}),
  // the dark grey house behind its iron gate, the big tree in front
  L('S',208,218,{wall:'#6e7274',roof:'gable',roofColor:'#5a4a40',setback:2,front:{h:.4,c:'#6e7274',rail:{h:1.4,c:'#3a3a3a',style:'bars'}}}),
  // the stone-clad house with arched barred windows and brown grilles on its garage
  L('S',218,229,{wall:'#a87a58',roof:'hip',roofColor:'#8a4a32',plinth:{h:1.6,stone:true},
    open:[{t:'arch',x:2.6,w:.8,y:1},{t:'arch',x:1.4,w:.8,y:1},{t:'door',x:4,w:1,c:'#5a2a1a',grille:true},{t:'garage',x:-2.6,w:3,c:'#4a2a1a',grille:true,awning:T}]}),
  // the beige house with brown shutters and a brown board gate
  L('S',229,238.5,{wall:'#e8dcc0',roof:'gable',roofColor:T,plinth:{h:.4,c:'#8a3a2a'},
    open:[{t:'window',x:2.4,w:1.2,shutters:'#6a3a2a'},{t:'gate',x:-1.6,w:2.6,c:'#8a5a40'}]}),
  // the beige house with a porch, a weathered brown board gate
  L('S',238.5,244,{wall:'#ecdcb8',roof:'gableSide',roofColor:T,open:[{t:'open',x:1,w:2,h:2.3,c:'casa'},{t:'gate',x:-1.6,w:2,c:'#8a5a40'}]}),
  // three brown barred garage doors, each under its own clay roof
  L('S',244,250,{wall:'#e8dcc4',roof:'hip',roofColor:T,open:[{t:'garage',x:-1.9,w:1.8,c:'#5a3a2a',grille:true},{t:'garage',x:0,w:1.8,c:'#5a3a2a',grille:true},{t:'garage',x:1.9,w:1.8,c:'#5a3a2a',grille:true}]}),
  // the mint house behind a galvanized sheet gate under a fibre-cement awning
  L('S',250,256,{wall:'#a8dcc8',roof:'gable',roofColor:'#6a6a6a',setback:2,front:{h:1.6,c:'#b8e0d0',gates:[{t:'gate',x:.4,w:3.8,c:'#c8ccd0'}]}}),
  // the bare concrete house: a big grey sheet garage door, a grey door
  L('S',256,266,{wall:'#b8b0a4',roof:'hip',roofColor:T,setback:1,open:[{t:'garage',x:2,w:3.2,c:'#a8acb0'},{t:'door',x:-.6,w:1,c:'#c8ccd0'},{t:'window',x:-2.6,w:1.2,fl:0,frame:'#3a3a3a'}]}),
  // the bare brick wall with a timber gate, the grey sheet garage door of the next house
  L('S',266,275,{wall:'#c0b8ac',roof:'hip',roofColor:T,setback:2,front:{h:2.2,c:'#b86a48',gates:[{t:'gate',x:3,w:2.6,c:'#7a6a5a'},{t:'gate',x:-1.6,w:3,c:'#a8acb0'}]}}),
  // the bare brick wall with a white grille door and a brown one, the grey house behind
  L('S',275,285,{wall:'#d8d4cc',roof:'hip',roofColor:'#6a6a6a',setback:2.5,front:{h:2,c:'#b86a48',gates:[{t:'gate',x:2.2,w:1.2,c:W},{t:'gate',x:.4,w:1.2,c:'#6a2a1a'}]}}),
  // the bare brick wall with a grey iron gate, the corrugated-roof house behind
  L('S',285,290,{wall:'#ecebe6',roof:'gableSide',roofColor:'#9a9a98',setback:3,front:{h:1.8,c:'#b86a48',gates:[{t:'gate',x:.2,w:3,c:'#8a8c8e'}]}}),
  // the white corner house with its dark green garage door
  L('S',290,293.6,{wall:'#f0eee8',roof:'gable',roofColor:T,open:[{t:'garage',x:0,w:3,c:'#3a4a44'}]}),
];

export const TREES:Tree[]=[
  {side:'S',s:211,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:8,every:34},
  keepOut:[
    {side:'N',s0:62.4,s1:70,why:'the mouth of the Rua João Cabral de Medeiros',walk:false},
  ],
};
