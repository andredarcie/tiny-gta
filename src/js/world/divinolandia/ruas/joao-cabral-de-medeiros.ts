// Rua João Cabral de Medeiros — surveyed lot by lot from Google Street View (2024–2026 imagery; one
// view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/jcm-N-*/ and jcm-S-*/, kept out of git; lot boundaries
// from the Microsoft building footprints). 340 m west→east from the Rua Goiás up to the XV de
// Novembro, past the Praça Dom Bosco. Side 'N' is the north side, 'S' the south.
//   s=143 R. Francisco Domingos Cervelim   s=196 R. Capitão Thomaz de Andrade   s=281 R. João
//   Cabrera
// The west end is a long bare-brick wall round a palm garden, then a wooded slope and allotments
// with no houses. Left alone: the Praça Dom Bosco (north side s 285–330, pracas-centro.ts).
// Asphalt, granite setts by the square. Opening x is measured from the lot centre as SEEN FROM THE
// STREET (left negative): on the north side (N) left is WEST (lower s), on the south side (S) left
// is EAST (higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua João Cabral de Medeiros';
export const CROSS=[0,142.7,195.7,280.9,339.9];
const SURFACE:Surface[]=[[0,280.9,'asphalt'],[280.9,339.9,'sett']];
const T='#b0603f',W='#f1efe9',PRE='#cfcbc2',BRICK='#c0704a',SPECK='#7e807e',BLACK='#2a2e34';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE (N) =================
  // --- Goiás → Francisco Domingos Cervelim
  // the long bare-brick wall on concrete posts round a garden of royal palms, a wooden door
  muro('N',8,40,BRICK,2.8,{front:{h:2.8,c:BRICK,style:'panel',gates:[{t:'gate',x:-.6,w:1,c:'#6a3a20'}]}}),
  muro('N',40,72,BRICK,2.8,{front:{h:2.8,c:BRICK,style:'panel'}}),
  // (72–140: a wooded slope, bananas and fruit trees, no wall)
  // --- Francisco Domingos Cervelim → Capitão Thomaz de Andrade
  // the white two-storey corner house with a balustraded veranda above its white wall
  L('N',146.5,154,{floors:2,wall:'#f0eee8',upper:'#f0eee8',roof:'gable',roofColor:'#8a4a32',setback:2,front:{h:2.4,c:'#ecebe6'},balcony:{x:0,w:7,fl:1,rail:'white',depth:1.2},plinth:{h:1,c:SPECK}}),
  // the beige two-storey house: a brown sheet garage door, balustrades, an arched window
  L('N',154,163,{floors:2,wall:'#e8d8c0',upper:'#e8d8c0',roof:'hip',roofColor:'#8a4a32',balcony:{x:-3,w:3,fl:1,rail:'white',depth:1},
    open:[{t:'garage',x:-1.4,w:2.8,c:'#8a5a30'},{t:'arch',x:2.2,w:2.6,fl:1,y:.6,h:1}]}),
  // nº 128: the beige house behind a grey balustrade on a roughcast base, an arched door hood
  L('N',163,172,{wall:'#e8d8c0',roof:'hip',roofColor:'#8a4a32',setback:1.5,front:{h:1,c:SPECK,rail:{h:.8,c:'#a8b4c0',style:'lattice'},gates:[{t:'gate',x:4,w:2.6,c:'#8a5a30'}]},
    open:[{t:'arch',x:-3,w:2,y:.8,h:1},{t:'arch',x:0,w:2,y:.8,h:1},{t:'door',x:3,w:1,c:'#6a3a20',awning:T}]}),
  // the beige house with a brown board gate in a grey wall
  L('N',172,180,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:3,x:['dish'],front:{h:2,c:'#a8a49c',gates:[{t:'gate',x:-1.6,w:3.6,c:'#8a5a30'}]}}),
  // the old cream houses behind a brown roughcast wall with a tile coping
  L('N',180,188.6,{wall:'#ece4d4',roof:'hip',roofColor:'#8a4a32',setback:3,x:['dish'],front:{h:2,c:'#8a5a4a',gates:[{t:'gate',x:-2,w:1.6,c:'#8a5a4a'},{t:'gate',x:2,w:2.4,c:'#8a5a4a'}]}}),
  // --- Capitão Thomaz de Andrade → João Cabrera
  // the pale green corner house: white louvres, a clay-roofed porch with a barred gate
  L('N',213.1,216.3,{wall:'#c8d8a0',roof:'gable',roofColor:T,plinth:{h:.9,c:'#8aa078'},
    open:[{t:'gate',x:0,w:2.4,c:'#c8ccd0'}]}),
  // the pale blue house with blue-framed windows, a white barred gate
  L('N',216.3,226,{wall:'#c8d8e8',roof:'gable',roofColor:'#9a9a98',plinth:{h:.7,c:'#4a6aa8'},open:[{t:'window',x:-2.6,w:1.4,shutters:W,frame:'#4a6aa8'},{t:'window',x:1.2,w:1.6,shutters:W,frame:'#4a6aa8'}]}),
  // the carport behind a white iron fence under a steel roof, a little sign
  L('N',226,231.4,{wall:'#ece4d4',roof:'gableSide',roofColor:'#5a5a5a',setback:1,front:{h:.4,c:W,rail:{h:1.6,c:W,style:'bars'}}}),
  // the red house with a stone-tile strip, white louvres and a barred window
  L('N',231.4,245,{wall:'#b84a4a',roof:'hip',roofColor:T,plinth:{h:.8,c:'#c8b498'},panels:[{x:0,w:1.6,c:'#c8b498'}],
    open:[{t:'window',x:-3,w:1.8,shutters:W,frame:'#e8dcc0'},{t:'window',x:3,w:1.6,grille:true,frame:'#e8dcc0'}]}),
  // the red-roofed porch and the bare brick house behind a white wall and a lattice gate
  L('N',245,254.5,{wall:'#a85a3a',roof:'hip',roofColor:'#8a4a32',setback:3,front:{h:1.4,c:'#ecd8c8',gates:[{t:'gate',x:-3,w:2.6,c:W}]}}),
  // the pale blue garages with white sheet doors
  L('N',254.5,261.6,{wall:'#a8c0d8',roof:'hip',roofColor:T,open:[{t:'garage',x:-1.8,w:2.6,c:W},{t:'garage',x:1.8,w:2.6,c:W}]}),
  // (285–339.9: the Praça Dom Bosco)
  // ================= SOUTH SIDE (S) =================
  // --- Goiás → Francisco Domingos Cervelim
  // the half-built bare-brick house behind a galvanized fence
  L('S',13.2,16.5,{wall:BRICK,roof:'flat',setback:1,front:{h:2,c:'#c8ccd0',style:'corrugated'}}),
  // the timber stack and galvanized sheets of a building yard
  muro('S',16.5,23.9,'#c8ccd0',2.2,{front:{h:2.2,c:'#c8ccd0',style:'corrugated'}}),
  // the cream lean-to with a brown iron gate on its yard
  L('S',23.9,28,{wall:'#ecdcc0',roof:'gableSide',roofColor:'#5a3a2a',open:[{t:'window',x:0,w:.8,frame:'#3a3a3a'}]}),
  // the bare-brick houses with clay porches behind brown iron gates
  L('S',28,36,{wall:BRICK,roof:'hip',roofColor:T,setback:1,front:{h:.4,c:BRICK,rail:{h:1.6,c:'#8a3a2a',style:'bars'}},open:[{t:'open',x:0,w:5,h:2.3,c:'casa',awning:T}]}),
  L('S',36,43.8,{wall:BRICK,roof:'hip',roofColor:T,setback:1,front:{h:.4,c:BRICK,rail:{h:1.6,c:'#8a3a2a',style:'bars'},gates:[{t:'gate',x:-2.4,w:2,c:'#8a3a2a'}]},open:[{t:'open',x:1,w:4,h:2.3,c:'casa',awning:T}]}),
  // (43.8–53: an empty grassy lot)
  // nº 215: the beige house with a white sheet garage door under a clay porch
  L('S',53,60,{wall:'#d8b898',roof:'hip',roofColor:T,open:[{t:'garage',x:0,w:3,c:W,awning:T}]}),
  // the long beige roughcast wall and house, a white gate, a speckled base
  L('S',60,76.7,{wall:'#d8b898',roof:'hip',roofColor:T,plinth:{h:1,c:'#b8a898'},open:[{t:'gate',x:-6,w:1.4,c:W},{t:'window',x:-2,w:1.6,frame:'#3a3a3a'},{t:'window',x:1,w:.6,frame:'#3a3a3a'},{t:'window',x:4,w:1.2,shutters:W}]}),
  // (76.7–128: the allotments behind a wire fence, bamboo and banana trees)
  // the white two-storey house with a lean-to by its yard
  L('S',128,135,{floors:2,wall:'#f0eee8',upper:'#f0eee8',roof:'gable',roofColor:'#8a4a32',open:[{t:'window',x:0,w:1.2,fl:1,shutters:'#5a5a5a'},{t:'gate',x:-2,w:2,c:'#a8acb0'}]}),
  L('S',135,140,{wall:'#f0eee8',roof:'gableSide',roofColor:'#9a9a98',setback:2,front:{h:1.6,c:PRE,style:'panel'}}),
  // --- Francisco Domingos Cervelim → Capitão Thomaz de Andrade
  // the yellow house with a porch behind a hedge and a red-and-teal gate
  L('S',146.5,152,{wall:'#e8d888',roof:'gable',roofColor:'#5a5a58',setback:2,front:{h:1.6,c:'#e8d888',gates:[{t:'gate',x:0,w:1.4,c:'#a83a2a'}]},open:[{t:'open',x:0,w:2,h:2.3,c:'casa'}]}),
  // the grey-green roughcast cottage with a porch, behind an iron fence on a stone base
  L('S',152,160,{wall:'#b8c4b8',roof:'gable',roofColor:'#5a4a40',setback:2,front:{h:.8,c:'#9a9a98',rail:{h:1,c:'#7a7a78',style:'bars'}},
    open:[{t:'open',x:-1.4,w:2,h:2.3,c:'casa',awning:T},{t:'window',x:1.8,w:1.4,shutters:'#a83a2a'}]}),
  // the modern beige two-storey with a glass balcony and a white slatted garage door
  L('S',160,167.9,{floors:2,wall:'#d8ccc0',upper:'#d8ccc0',roof:'flat',parapet:true,balcony:{x:-1,w:5,fl:1,rail:'glass',depth:1.2},open:[{t:'garage',x:1.6,w:3,c:W},{t:'window',x:2,w:1.4,fl:1,shutters:W}]}),
  // the weathered roughcast wall round a garden
  muro('S',167.9,175,'#a8988a',1.8),
  // the ochre roughcast house behind a high ochre wall
  L('S',175,178.2,{wall:'#c8904a',roof:'gable',roofColor:T,setback:3,front:{h:2.4,c:'#c8a050'},open:[{t:'window',x:0,w:1.2,shutters:W}]}),
  // --- Capitão Thomaz de Andrade → João Cabrera
  // nº 59: the cream two-storey house: scrolled iron transoms over white panel doors
  L('S',212.4,221.3,{floors:2,wall:'#e8e0d0',upper:'#e8e0d0',roof:'flat',parapet:true,plinth:{h:.4,c:'#6a6e72'},balcony:{x:0,w:8,fl:1,rail:'iron',depth:1},
    open:[{t:'door',x:-3,w:1.2,c:W},{t:'garage',x:.6,w:3,c:'#4a4440'}]}),
  L('S',221.3,234,{floors:2,wall:'#e8e0d0',upper:'#e8e0d0',roof:'flat',parapet:true,plinth:{h:.4,c:'#6a6e72'},balcony:{x:0,w:12,fl:1,rail:'iron',depth:1},
    open:[{t:'garage',x:-4,w:3.6,c:W},{t:'garage',x:.6,w:3.6,c:W},{t:'door',x:4.6,w:1,c:W}]}),
  // the old government building: pale green walls under long rows of barred windows
  L('S',234,263.6,{wall:'#c8d0a8',roof:'gableSide',roofColor:'#9a9a98',plinth:{h:1.6,c:'#c8d0b8'},panels:[{x:-9,w:.6,c:W},{x:-3,w:.6,c:W},{x:3,w:.6,c:W},{x:9,w:.6,c:W}],
    open:[{t:'window',x:-12,w:4,y:1.8,h:1.1,grille:true},{t:'window',x:-6,w:4,y:1.8,h:1.1,grille:true},{t:'window',x:0,w:4,y:1.8,h:1.1,grille:true},
      {t:'window',x:6,w:4,y:1.8,h:1.1,grille:true},{t:'window',x:12,w:3,y:1.8,h:1.1,grille:true}]}),
  // --- João Cabrera → XV de Novembro
  // AG Detalhamentos: the black roughcast building with white-framed panels and its sign
  L('S',298.6,303.8,{floors:2,wall:BLACK,upper:'#f0eee8',roof:'flat',parapet:true,balcony:{x:0,w:5,fl:1,rail:'white',depth:1},
    open:[{t:'open',x:-.6,w:2,h:2.4,c:'geral'},{t:'door',x:1.6,w:.9,c:W}]}),
  L('S',303.8,313,{wall:BLACK,roof:'flat',parapet:true,sign:{text:'AG DETALHAMENTO',bg:'#3a3e44',fg:'#ffffff',x:0,y:3,w:6,h:.6},open:[{t:'open',x:2,w:3.6,h:2.6,c:'geral'}]}),
  // the cream building and the lilac restaurant at the back of its forecourt
  L('S',313,326.5,{wall:'#d8ccc0',roof:'flat',parapet:true,setback:4,d:7,sign:{text:'RESTAURANTE',bg:'#c84a2a',fg:'#ffffff',x:2,y:2.4,w:2.4,h:.6},
    open:[{t:'door',x:2,w:1,c:W},{t:'window',x:-2,w:1.6,frame:'#3a3a3a'}]}),
  // the grey two-storey office on a stone base, the clinic's glass doors
  L('S',326.5,336.1,{floors:2,wall:'#d8d4cc',upper:'#d8d4cc',roof:'flat',parapet:true,plinth:{h:.8,stone:true},balcony:{x:0,w:9,fl:1,rail:'white',depth:1.2},
    open:[{t:'glass',x:-2,w:2,y:.1,h:2.3},{t:'glass',x:2,w:2,y:.1,h:2.3}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:12,kind:'palmeira'},{side:'N',s:24,kind:'palmeira'},{side:'N',s:58,kind:'palmeira'},
  {side:'N',s:96,kind:'palmeira'},{side:'N',s:112,kind:'ficus'},{side:'S',s:100,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:12,every:34},
  keepOut:[
    {side:'N',s0:284.5,s1:336.1,why:'the Praça Dom Bosco (pracas-centro.ts)',walk:false},
  ],
};
