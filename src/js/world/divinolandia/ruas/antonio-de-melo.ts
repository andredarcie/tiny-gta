// Rua Antônio de Melo — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/adm-N-*/ and adm-S-*/, kept out of git; lot boundaries
// from the Microsoft building footprints). 294 m west→east from the Francisco Pereira de Souza to
// the Bernadino Franchi. Side 'N' is the north side, 'S' the south.
//   s=101 R. Joaquim Garcia   s=190 R. Campos Salles
// Asphalt. Opening x is measured from the lot centre as SEEN FROM THE STREET (left negative): on
// the north side (N) left is WEST (lower s), on the south side (S) left is EAST (higher s).
// Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Antônio de Melo';
export const CROSS=[0,100.7,190.3,293.7];
const SURFACE:Surface[]=[[0,293.7,'asphalt']];
const T='#b0603f',W='#f1efe9',PRE='#cfcbc2',SPECK='#7e807e',ROUGH='#8a6a52',MAROON='#8a3030';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE (N) =================
  // --- Francisco Pereira de Souza → Joaquim Garcia
  // the brown roughcast gable house with a porch, a brown louvred window
  L('N',19,29.3,{wall:ROUGH,roof:'gable',roofColor:'#5a3a2a',fascia:'#e8dcc0',setback:1,front:{h:.6,c:'#c86a4a',rail:{h:.6,c:'#8a4a3a',style:'bars'}},
    open:[{t:'window',x:-2.6,w:1.8,grille:true,frame:'#e8dcc0'},{t:'door',x:0,w:.9,c:'#5a3a2a',grille:true},{t:'window',x:3,w:2,shutters:'#a8783a',frame:'#e8dcc0'}]}),
  // nº 337: the white house with a grey barred window, a carport behind a grey iron fence
  L('N',29.3,36.4,{wall:'#f0eee8',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:W,rail:{h:1.4,c:'#a8acb0',style:'bars'}},
    open:[{t:'window',x:-1,w:2.4,grille:true,frame:'#6a6e72'},{t:'open',x:2.4,w:2,h:2.3,c:'casa'}]}),
  // the grey two-storey building with glass balconies: the WS electrician's shop, a white garage
  L('N',36.4,48.9,{floors:2,wall:'#8a8a88',upper:'#8a8a88',roof:'flat',parapet:true,balcony:{x:0,w:12,fl:1,rail:'glass',depth:1.2},
    sign:{text:'WS INSTALAÇÕES ELÉTRICAS',bg:'#ffffff',fg:'#1a3a8a',x:-3,y:1.4,w:4.6,h:1.2},
    open:[{t:'glass',x:-3,w:5,y:.1,h:2.5},{t:'garage',x:2.4,w:3.6,c:W},{t:'door',x:5,w:.9,c:W}]}),
  // the bare concrete-block shed with a grey double door, set back
  L('N',48.9,59.5,{wall:'#a8a49a',roof:'gable',roofColor:'#9a9a98',setback:5,d:7,open:[{t:'garage',x:0,w:3,c:'#b8bcc0'}]}),
  // the pink-beige wall with a galvanized sheet gate
  muro('N',59.5,64.8,'#e4cdc0',1.8,{front:{h:1.8,c:'#e4cdc0',gates:[{t:'gate',x:0,w:3.6,c:'#b8bcc0'}]}}),
  // the new pink-beige house: white doors, a white garage door, palms
  L('N',64.8,78.3,{wall:'#e8d0c4',roof:'hip',roofColor:'#d8c8b4',parapet:true,
    open:[{t:'door',x:-5,w:.9,c:W},{t:'door',x:-.6,w:1,c:W},{t:'garage',x:2.6,w:4,c:W}]}),
  // the grey roughcast house with a white louvred window behind a low wall and white railing
  L('N',78.3,83.2,{wall:'#a8a49e',roof:'hip',roofColor:T,setback:1.5,front:{h:.6,c:SPECK,rail:{h:.8,c:W,style:'bars'}},
    open:[{t:'window',x:-.6,w:2,shutters:W,frame:W},{t:'window',x:1.6,w:1,grille:true,frame:W}]}),
  // --- Joaquim Garcia → Campos Salles
  // nº 589: the stone-clad house with arched porches behind white railings
  L('N',119.5,124,{wall:'#a87a58',roof:'hip',roofColor:T,plinth:{h:2.8,stone:true},setback:1,front:{h:.3,c:'#e0e0dc',rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'arch',x:0,w:3,y:0,h:2.2,c:'casa'}]}),
  // nº 431: the grey house with a white stripe, a grey grille garage gate
  L('N',124,136.1,{wall:'#b8b8b4',roof:'hip',roofColor:T,open:[{t:'garage',x:-.4,w:3.4,h:2.6,c:'#7a7e82',grille:true},{t:'door',x:-3.2,w:.9,c:'#6a6e72',grille:true}]}),
  // the red house: a grey sheet garage door, a glass window, a grey louvred one
  L('N',136.1,144.8,{wall:'#8a2a2a',roof:'gable',roofColor:'#5a3a2a',fascia:W,open:[{t:'garage',x:-2.8,w:2.4,c:'#a8acb0'},{t:'window',x:0,w:2,frame:W},{t:'window',x:2.8,w:1.4,shutters:'#a8acb0',frame:W}]}),
  // the beige house with a brown garage door, a barred window, a brown louvred one
  L('N',144.8,155,{wall:'#e8d8c0',roof:'gable',roofColor:'#8a4a32',plinth:{h:.4,c:'#a84a3a'},
    open:[{t:'garage',x:-2.8,w:2.6,c:'#7a3a2a'},{t:'window',x:.4,w:1.6,grille:true},{t:'window',x:3.2,w:1.4,shutters:'#8a4a2a'}]}),
  // the beige house with a brown louvred window and a brown door
  L('N',155,159,{wall:'#e8d4b0',roof:'gable',roofColor:'#8a4a32',open:[{t:'window',x:-.6,w:1.6,shutters:'#7a3a2a'},{t:'door',x:1.4,w:.8,c:'#8a3a2a'}]}),
  // the beige house with a white sheet garage door behind a white picket fence
  L('N',159,166,{wall:'#ecdcc4',roof:'hip',roofColor:T,open:[{t:'garage',x:-.6,w:3.2,c:'#f0eee8'},{t:'gate',x:2.4,w:1.2,c:W}]}),
  // the house hidden behind a white picket fence and a garden
  L('N',166,172,{wall:'#ecdcc4',roof:'hip',roofColor:T,setback:3,front:{h:.3,c:'#a84a3a',rail:{h:1.2,c:W,style:'bars'}}}),
  // --- Campos Salles → Bernadino Franchi
  L('N',208.8,216,{wall:'#ece4d0',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:MAROON,gates:[{t:'gate',x:.6,w:1.2,c:MAROON,awning:T},{t:'gate',x:2.4,w:1.4,c:MAROON}]}}),
  // the pink-red house on a grey stone-tile base, brown slatted grilles on its gate and window
  L('N',216,229.2,{wall:'#b86868',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#a8a8a4'},
    open:[{t:'garage',x:-3.6,w:3.4,c:'#a8704a',grille:true},{t:'window',x:1.6,w:3.4,y:.9,h:1.4,grille:true,frame:'#a8704a'},{t:'gate',x:5.2,w:1.4,c:'#a8704a'}]}),
  // the weathered wall with a grey sheet gate, a yard
  muro('N',229.2,243.5,'#c8b8a0',2,{front:{h:2,c:'#c8b8a0',gates:[{t:'gate',x:4,w:3.2,c:'#b8bcc0'}]}}),
  // nº 247: the low pink-beige house behind a weathered wall
  L('N',243.5,256,{wall:'#e4c8b8',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#d8c8b8'},open:[{t:'window',x:-1,w:1.6,frame:W},{t:'open',x:2.4,w:2,h:2.3,c:'casa'}]}),
  // the pink two-storey house: green grilles, a glass-railed balcony, a cream garage door (for sale)
  L('N',256,268,{floors:2,wall:'#e0a890',upper:'#e0a890',roof:'flat',parapet:true,plinth:{h:1.2,stone:true},balcony:{x:0,w:12,fl:1,rail:'glass',depth:1.4},
    open:[{t:'garage',x:-3.6,w:2.6,c:'#e8dcb8'},{t:'open',x:1.6,w:6,h:2.5,c:'casa',grille:true},{t:'window',x:-3,w:1.6,fl:1,shutters:'#3a8a3a'},{t:'window',x:2,w:3,fl:1,frame:'#3a8a3a'}]}),
  // the pale grey hall with round-headed barred windows and arched blue doors, crape myrtles
  L('N',268,276.3,{wall:'#d8dcd4',roof:'hip',roofColor:T,plinth:{h:.4,c:'#b8b4a8'},
    open:[{t:'arch',x:-2.8,w:1,y:1.2,h:1.2,grille:true},{t:'arch',x:0,w:1.8,y:0,h:2.4,c:'#8aa0b8'},{t:'arch',x:2.8,w:1,y:1.2,h:1.2,grille:true}]}),
  // ================= SOUTH SIDE (S) =================
  // --- Francisco Pereira de Souza → Joaquim Garcia
  // the beige house behind a scalloped beige wall: arched windows under canvas awnings
  L('S',17.6,25.7,{wall:'#e0d0b8',roof:'hip',roofColor:'#6a3a2a',setback:2,front:{h:1.6,c:'#d8c8b0'},
    open:[{t:'window',x:2,w:2.4,y:1.2,awning:'#c8b490'},{t:'arch',x:-1.6,w:1.4,y:1.2,h:.8}]}),
  // the brown roughcast house with a brown slatted garage door
  L('S',25.7,37.2,{wall:ROUGH,roof:'hip',roofColor:T,open:[{t:'garage',x:-2.6,w:3,c:'#8a5a40'},{t:'window',x:2,w:.8,frame:W}]}),
  // nº 335: the beige gable house with an arched carport behind a white fence
  L('S',37.2,46.4,{wall:'#e8dcc8',roof:'gable',roofColor:'#3a2a24',setback:1,front:{h:.4,c:W,rail:{h:1.4,c:W,style:'bars'}},
    open:[{t:'arch',x:-1.6,w:3,y:0,h:2.2,c:'casa'},{t:'arch',x:1.8,w:2.4,y:0,h:2.2,c:'casa'}]}),
  // the grey house: a white gate with wavy bars, a white louvred window, a stone-tile base
  L('S',46.4,57,{wall:'#a8aaa8',roof:'flat',parapet:true,plinth:{h:.8,c:'#c8a880'},open:[{t:'window',x:-1.6,w:2,shutters:W},{t:'garage',x:2.8,w:3.6,c:W}]}),
  // the brown roughcast gable house with a carport behind an iron fence
  L('S',57,65,{wall:'#6a4a3a',roof:'gable',roofColor:'#3a2a24',fascia:'#e8dcc0',setback:1,front:{h:.3,c:SPECK,rail:{h:1.3,c:'#4a4a4a',style:'bars'}},
    open:[{t:'open',x:-1.6,w:2.6,h:2.3,c:'casa'},{t:'window',x:1.8,w:1.8,shutters:'#5a3a2a',frame:'#e8dcc0'}]}),
  // the pink house with a clay porch roof behind a white breeze-block balustrade wall
  L('S',65,74.1,{wall:'#d8807a',roof:'gable',roofColor:'#8a3a2a',setback:1.5,front:{h:1.4,c:'#d8ccc0',style:'lattice'},
    open:[{t:'open',x:0,w:6,h:2.3,c:'casa',awning:T},{t:'window',x:-1.6,w:1.8,grille:true}]}),
  // the pink porch behind a red iron fence, then the grey house with a green fascia
  L('S',74.1,82,{wall:'#d8807a',roof:'hip',roofColor:'#8a3a2a',setback:1,front:{h:.4,c:'#ece4d8',rail:{h:1.2,c:'#a83a2a',style:'bars'}},
    open:[{t:'open',x:1.6,w:3,h:2.3,c:'casa'},{t:'window',x:-1.6,w:1.8,grille:true}]}),
  // --- Joaquim Garcia → Campos Salles
  // the rusty sheet gate under a lean-to roof
  muro('S',116,120,'#c8c0b0',2.2,{front:{h:2.2,c:'#c8c0b0',gates:[{t:'gate',x:0,w:3,c:'#a8705a'}]}}),
  // the empty lot behind a precast wall, a timber shed
  muro('S',120,127.9,PRE,1.8,{front:{h:1.8,c:PRE,style:'panel'}}),
  // the brown roughcast gable house with an open carport and a white-framed window
  L('S',127.9,138.7,{wall:'#a8846a',roof:'gable',roofColor:'#5a3a2a',fascia:W,open:[{t:'open',x:1.6,w:3.6,h:2.4,c:'casa',grille:true},{t:'window',x:-2.6,w:2,frame:W}]}),
  // nº 440: the cream house with a carport behind a red picket fence
  L('S',138.7,148.7,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:1.5,front:{h:.3,c:'#ece4d4',rail:{h:1.4,c:'#c8302a',style:'bars'}},
    open:[{t:'open',x:2.6,w:3,h:2.4,c:'casa'},{t:'window',x:-1.4,w:1.6,shutters:'#8a2a2a'}]}),
  // the green roughcast gable house with a porch behind a white fence
  L('S',148.7,160.2,{wall:'#a8c0a0',roof:'gable',roofColor:'#5a5a58',fascia:W,setback:1.5,front:{h:.3,c:'#e8e4dc',rail:{h:1.3,c:W,style:'bars'}},
    open:[{t:'open',x:1.8,w:3.4,h:2.3,c:'casa'},{t:'window',x:-2.4,w:3,frame:W}]}),
  // the warehouse with a wide open door, a pink band across its white front
  L('S',160.2,170.1,{wall:'#ecebe8',roof:'gableSide',roofColor:'#9a9a98',panels:[{x:0,w:9.8,c:'#d89898',y0:1.2,y1:2.2}],
    open:[{t:'open',x:0,w:4.2,h:3,c:'geral'},{t:'window',x:-3.6,w:1.4,y:2.4,frame:'#6a6a6a'},{t:'window',x:3.6,w:1.4,y:2.4,frame:'#6a6a6a'}]}),
  // --- Campos Salles → Bernadino Franchi
  // the little old white house (for sale) and the white modern gate beside it
  L('S',207.9,212,{wall:'#ece8e0',roof:'gable',roofColor:'#8a4a32',x:['dish'],open:[{t:'window',x:-1,w:1.2,grille:true},{t:'gate',x:1,w:1.6,c:W}]}),
  // the new beige house behind tall white gates between square pillars, a cypress
  L('S',212,230,{wall:'#d8d0c8',roof:'flat',parapet:true,setback:3,front:{h:1.2,c:'#c8c0b8',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:-5,w:3,h:2.4,c:W},{t:'gate',x:3,w:3,h:2.4,c:W}]},
    open:[{t:'open',x:4,w:3,h:2.6,c:'casa'},{t:'window',x:-2,w:2,grille:true}]}),
  // the two-storey house with a white slatted garage gate, a drive to the back
  L('S',230,238.3,{floors:2,wall:'#d8ccc0',roof:'flat',parapet:true,open:[{t:'garage',x:1,w:3.4,c:W},{t:'gate',x:-3,w:2,c:W}]}),
  // the beige two-storey house with two white slatted garage gates
  L('S',238.3,250,{floors:2,wall:'#e8d8c8',roof:'gableSide',roofColor:T,plinth:{h:1,c:'#d8c4a4'},
    open:[{t:'garage',x:-2,w:3.4,c:W},{t:'garage',x:1.6,w:3.4,c:W},{t:'window',x:-1,w:1,fl:1,frame:W},{t:'window',x:2,w:1.6,fl:1,frame:W}]}),
  // the pink house with a porch behind a beige block-tile wall and a beige sheet gate
  L('S',250,258,{wall:'#d88078',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#d8ccb8',gates:[{t:'gate',x:-1.4,w:3.6,c:'#d8ccb0'}]}}),
  // the mint house with a carport behind a grey iron fence
  L('S',258,266,{wall:'#c8e0d0',roof:'gable',roofColor:T,setback:1,front:{h:.6,c:'#c8e0d0',rail:{h:1.4,c:'#8a8c8e',style:'bars'}},
    open:[{t:'window',x:2,w:1.6,shutters:'#3a3a3a'},{t:'open',x:-2.2,w:2.6,h:2.3,c:'casa'}]}),
  // the white corner house on a dark speckled base, white louvres
  L('S',266,274.9,{wall:'#f0eee8',roof:'hip',roofColor:T,plinth:{h:1.4,c:SPECK},
    open:[{t:'window',x:2.4,w:1.8,shutters:W},{t:'window',x:-1.6,w:1.8,frame:'#5a3a2a'}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:66,kind:'palmeira'},
  {side:'N',s:272,kind:'resedaBranca'},{side:'N',s:286,kind:'resedaBranca'},
  {side:'S',s:88,kind:'ficus'},{side:'S',s:220,kind:'palmeira'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:12,every:34},
};
