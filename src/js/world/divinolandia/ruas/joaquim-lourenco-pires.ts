// Rua Joaquim Lourenço Pires — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/jlp-N-*/ and jlp-S-*/, kept out of git). A short
// residential street, 86 m north→south from the Rua Pio de Andrade, ending at the trees by the
// river. `s` starts at the NORTH end, so side 'N' is the EAST side (left of a walker going
// south) and 'S' the WEST. Asphalt. Opening x is measured from the lot centre as SEEN FROM THE
// STREET (left negative): on the east side (N) left is NORTH (lower s), on the west side (S)
// left is SOUTH (higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Joaquim Lourenço Pires';
export const CROSS=[0,86.4];
const SURFACE:Surface[]=[[0,86.4,'asphalt']];
const T='#b0603f',W='#f1efe9',FIBRE='#8a8c8e',PRE='#cfcbc2';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // the high pink-beige wall on the corner
  muro('N',5.4,10,'#e6c8b4',2.4),
  // the pale blue-grey house right on the sidewalk, white-framed windows, a barred louvred one
  L('N',10,22,{wall:'#a8b4c4',roof:'gableSide',roofColor:T,fascia:W,open:[{t:'window',x:-3,w:1.6,frame:'#e8e8e6'},{t:'window',x:2.4,w:2.4,shutters:'#a8acb0',grille:true,frame:'#e8e8e6'}],x:['dish']}),
  // its grey side wall
  muro('N',22,28,'#c8ccd4',2.4),
  // nº 23: the cream house with a carport, a red sheet gate in a bare brick wall
  L('N',28,40,{wall:'#ecdcc0',roof:'gable',roofColor:FIBRE,fascia:W,setback:3,front:{h:1.6,c:'#a8603a',gates:[{t:'gate',x:-3,w:3.4,c:'#a8392e'}]},
    open:[{t:'open',x:-3,w:3.6,h:2.3,c:'casa',awning:FIBRE},{t:'window',x:2.4,w:2.4,shutters:'#6a7a8a'}]}),
  // the cream house with a barred window behind a brick wall and a white gate
  L('N',40,47,{wall:'#ecdcc0',roof:'gable',roofColor:FIBRE,fascia:W,setback:3,front:{h:1.6,c:'#a8603a',gates:[{t:'gate',x:-1.6,w:1.4,c:W}]},open:[{t:'window',x:.6,w:1.8,grille:true}]}),
  // the unfinished brick and block house: a galvanized gate by a brick pillar
  L('N',47,54,{wall:'#a8a49a',roof:'hip',roofColor:T,setback:3,front:{h:2.2,c:'#b8b4aa',gates:[{t:'gate',x:-.6,w:4,c:'#c8ccd0'}]}}),
  // the precast wall with a brown louvred gate and a white one, a red-roofed house behind
  L('N',54,64,{wall:'#e4dcd0',roof:'hip',roofColor:T,setback:3,front:{h:2,c:PRE,style:'panel',gates:[{t:'gate',x:-2,w:2,c:'#7a3a2a'},{t:'gate',x:4,w:1.4,c:W}]},x:['dish']}),
  // the taupe gable house with dark brown eaves behind a taupe wall with a tile coping
  L('N',64,72,{wall:'#c8b8a4',roof:'gable',roofColor:'#5a4a40',fascia:'#5a3a2a',setback:2,front:{h:1.8,c:'#c8b8a4'},open:[{t:'window',x:-1.6,w:2,frame:'#2a2a2a'},{t:'window',x:1.8,w:1.6,shutters:W}]}),
  // the cream gable house behind its cream wall, a galvanized gate beside it
  L('N',72,80,{wall:'#ece4d4',roof:'gable',roofColor:'#6a5a4a',setback:2,front:{h:1.8,c:'#e6dcc4',gates:[{t:'gate',x:-3,w:1.6,c:'#c8ccd0'}]},open:[{t:'window',x:-.4,w:1.4,shutters:'#a8b0b8'},{t:'window',x:2.2,w:1.6,frame:'#3a3a3a'}]}),
  // nº 71: the cream house with a grey iron gate and carport, a sago palm and an orange tree
  L('N',80,85,{wall:'#ece8e0',roof:'hip',roofColor:T,setback:2,front:{h:1.4,c:'#ece8e0',gates:[{t:'gate',x:-1,w:2.6,c:'#8a8c8e'}]},open:[{t:'window',x:1.4,w:1.4,shutters:'#8a8c8e'}]}),
  // ================= WEST SIDE (S) =================
  // the white corner wall with its wavy top, the grey-white house behind
  L('S',4,12,{wall:'#ecebe6',roof:'gable',roofColor:T,setback:3,front:{h:1.8,c:'#ecebe6'},open:[{t:'window',x:-1.6,w:1.2,shutters:'#3a3a3a'},{t:'window',x:1.6,w:1.2,shutters:'#3a3a3a'}]}),
  // the carport under fibre-cement by the bare brick sobrado wall
  L('S',12,17,{floors:2,wall:'#b86a4a',roof:'flat',setback:2,front:{h:.3,c:'#b8a898',rail:{h:1.4,c:'#2a2a2a',style:'bars'}},open:[{t:'open',x:0,w:4,h:2.3,c:'casa',awning:FIBRE}]}),
  // the cream gable house behind a black iron fence, grey louvres
  L('S',17,28,{wall:'#ecdcc4',roof:'gable',roofColor:'#5a5a58',fascia:W,setback:2,front:{h:.3,c:'#b8a898',rail:{h:1.4,c:'#2a2a2a',style:'bars'},gates:[{t:'gate',x:3,w:3,c:'#2a2a2a'}]},
    open:[{t:'window',x:-2.4,w:1.8,shutters:'#8a94a0'},{t:'window',x:.6,w:1.8,shutters:'#8a94a0'}],x:['dish']}),
  // the peach wall along a long driveway to the back
  muro('S',28,30,'#e6c4a8',2),
  // the red gable house behind a grey speckled wall with peach trim, a galvanized gate
  L('S',30,39,{wall:'#a8403a',roof:'gable',roofColor:'#5a4a40',setback:2,front:{h:2,c:'#8a8c8e',gates:[{t:'gate',x:-.6,w:3,c:'#a8b0b8'}]},open:[{t:'window',x:-.6,w:1,y:2.2,h:.5,frame:'#a8403a'}]}),
  // the cream house with a white iron gate across its carport
  L('S',39.6,46,{wall:'#ecdcc4',roof:'gable',roofColor:T,setback:2,front:{h:.3,c:'#ecdcc4',rail:{h:1.3,c:W,style:'bars'}},open:[{t:'open',x:0,w:3.4,h:2.4,c:'casa'},{t:'window',x:2.4,w:.8,grille:true}]}),
  // nº 46: the cream house with arched windows and door, a white iron gate on the carport
  L('S',46,53,{wall:'#ece4d0',roof:'gable',roofColor:'#6a5a4a',setback:2,front:{h:.3,c:'#ece4d0',rail:{h:1.3,c:W,style:'bars'},gates:[{t:'gate',x:-1.6,w:2.6,c:W}]},
    open:[{t:'open',x:-1.6,w:3,h:2.4,c:'casa'},{t:'arch',x:1.4,w:.8,y:1},{t:'arch',x:2.6,w:.8,y:1}]}),
  // nº 54: the white house with brown shutters behind a white wall and a galvanized gate
  L('S',55,64,{wall:'#ecebe6',roof:'gable',roofColor:'#5a5a58',fascia:W,setback:3,front:{h:1.6,c:'#ecebe6',gates:[{t:'gate',x:2.6,w:3.6,c:'#a8b0b8'}]},
    open:[{t:'door',x:-2.4,w:.9,c:'#7a4a2a'},{t:'window',x:-.6,w:1.4,grille:true},{t:'window',x:1.8,w:1.4,shutters:'#8a3a2a'}]}),
  // nº 58: the mint house with a tiled veranda on square pillars, full of potted plants
  L('S',64.7,72,{wall:'#c8e4d8',roof:'gable',roofColor:'#6a5a4a',setback:3,front:{h:.3,c:'#c8e4d8'},open:[{t:'open',x:0,w:5,h:2.4,c:'casa',awning:T},{t:'window',x:-1,w:1.2,shutters:'#8a6a3a'}]}),
  // the yellow-green house behind a block wall with a tile coping and an iron gate
  L('S',72,78,{wall:'#dcdca8',roof:'gable',roofColor:FIBRE,setback:2,front:{h:1.4,c:'#a89a88',gates:[{t:'gate',x:0,w:2.6,c:'#a8acb0'}]},open:[{t:'window',x:2,w:1.4,shutters:'#a8acb0'}]}),
  // the yellow-green gable house behind a bare block wall, grey louvres
  L('S',78,85,{wall:'#dcdca8',roof:'gable',roofColor:FIBRE,setback:2,front:{h:1.4,c:'#a89a88'},open:[{t:'window',x:0,w:1.6,shutters:'#a8acb0'}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:84,kind:'palmeira'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:6,every:34},
};
