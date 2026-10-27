// Rua Walter Darcie — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/wd-N-*/ and wd-S-*/, kept out of git). 219 m
// west→east across the slope from the Rua João Darcie to the Goiás / Manoel Pereira de Souza,
// the green hills behind. `s` runs from the west end; side 'N' is the north side.
//   s=155 R. Mario Mandoni
// Asphalt. Houses along the south side, empty lots along most of the north side, the Sabesp
// booster pump of the Jardim Bela Vista, a big flamboyant over the pavement. Opening x is
// measured from the lot centre as SEEN FROM THE STREET (left negative: on the N side left is
// west = lower s, on the S side left is east = higher s). Lot depth (d + setback) ≤ 12 m.
// Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Walter Darcie';
export const CROSS=[0,155.4,218.6];
const SURFACE:Surface[]=[[0,218.6,'asphalt']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE =================
  // empty lots along the slope, white walls of the next street's houses beyond
  muro('N',11.2,30,'#b8b4aa',.4),
  muro('N',30,46,'#b8b4aa',.4),
  // a white wall and a bare block wall round an empty lot
  muro('N',46,58,'#f2f0ea',2.2,{panels:[{x:3,w:5,c:'#9a958c'}]}),
  // the Sabesp booster pump of the Jardim Bela Vista: white with the blue-and-green stripe, a blue door
  L('N',58,64,{wall:'#f2f2f0',roof:'flat',parapet:true,panels:[{x:-1.4,w:1.4,c:'#2a8ad0'},{x:-.5,w:.3,c:'#3aa85a'}],
    open:[{t:'door',x:1.6,w:1.2,c:'#3a8ad0'}],sign:{text:'SABESP',bg:'#2a8ad0',fg:'#ffffff',x:-1.4,y:2.2,w:1.4,h:.5}}),
  // white house with brown shutters behind its barred fence
  L('N',64,70,{wall:'#f2ece0',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:'#e8e4dc',rail:{h:1.2,c:'#3a3a3a',style:'bars'}},open:[{t:'window',x:0,w:1.4,shutters:'#7a3a2a'}]}),
  // cream walls with clay coping and black gates, the houses behind
  muro('N',70,84,'#ece0c4',2.2,{front:{h:2.2,c:'#ece0c4',gates:[{t:'gate',x:-1,w:1.2,c:'#2a2a2a'}]},behind:{w:10,d:8,at:3,roofColor:T,wall:'#f2ece0'}}),
  muro('N',84,96,'#ece0c4',2.2,{front:{h:2.2,c:'#ece0c4',gates:[{t:'gate',x:-1,w:3,c:'#2a2a2a'}]},behind:{w:8,d:8,at:3,roofColor:T,wall:'#f2f0ea'}}),
  // beige house behind a wall under the big flamboyant
  muro('N',96,108,'#e6d8bc',2,{behind:{w:8,d:8,at:3,roofColor:T,wall:'#e6d8bc'}}),
  // the turquoise house behind its turquoise wall, a white barred gate
  muro('N',182,192,'#4ab0b8',2.4,{front:{h:2.4,c:'#4ab0b8',gates:[{t:'gate',x:-3,w:1.4,c:'#5a5c60'}]},behind:{w:9,d:8,at:3,roofColor:'#8a8a86',wall:'#4ab0b8'}}),
  L('N',192,206,{wall:'#4ab0b8',roof:'flat',fascia:'#8a8a86',eave:.4,setback:2,front:{h:2.4,c:'#4ab0b8',gates:[{t:'gate',x:-1,w:4,c:W}]},open:[{t:'window',x:-1,w:1,grille:true}]}),

  // ================= SOUTH SIDE =================
  // white house with a porch behind an ornate white railing, a brown gate
  L('S',3,12,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:2,front:{h:.8,c:'#e8e4dc',rail:{h:.6,c:W,style:'bars'},gates:[{t:'gate',x:-2.6,w:2.6,c:'#7a5a3a'}]},
    open:[{t:'open',x:1,w:4,h:2.3,c:'casa',awning:T}]}),
  // sobrado behind an ornamental railing, a dark red diagonal garage gate in a beige wall
  L('S',12,24,{floors:2,wall:'#ece4d6',roof:'hip',roofColor:T,setback:2,front:{h:2,c:'#d8d0c4',gates:[{t:'gate',x:1,w:3,c:'#8a2a24'},{t:'gate',x:-3.4,w:2,c:'#7a5a3a'}]},
    open:[{t:'window',x:0,w:4,fl:1}],balcony:{x:0,w:8,fl:1,rail:'white'}}),
  // yellow houses with blue shutters behind white-and-blue fences
  L('S',24,34,{wall:'#ecd48a',roof:'gable',roofColor:T,fascia:'#4a7ab0',setback:2.5,front:{h:.6,c:'#e8e4dc',rail:{h:1.1,c:'#9ac0d8',style:'bars'}},
    open:[{t:'window',x:-2,w:1.4,shutters:'#4a7ab0'},{t:'window',x:1,w:1.4,frame:'#4a7ab0'},{t:'door',x:3,w:.9,c:'#2a4a7a'}]}),
  L('S',34,45,{wall:'#ecd48a',roof:'gable',roofColor:T,fascia:W,setback:3,front:{h:.4,c:'#e8e4dc',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:2,w:3,c:'#9ac0d8'}]},
    open:[{t:'window',x:-2,w:1.4,shutters:'#4a7ab0'},{t:'window',x:1,w:1.6,frame:W}]}),
  // a tiled house behind white pickets on a white wall
  L('S',45,54,{wall:'#ece8e0',roof:'hip',roofColor:T,setback:3,front:{h:.8,c:'#ece8e0',rail:{h:1,c:W,style:'bars'}},open:[{t:'open',x:0,w:4,h:2.3,c:'casa',awning:T}]}),
  // a block wall and a gravel yard with a truck shed; a porch house behind white pickets
  muro('S',54,59,'#8f8c86',2),
  L('S',59,66,{wall:'#ece6da',roof:'gable',roofColor:T,fascia:'#5a4a40',setback:3,front:{h:.4,c:'#ece6da',rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'open',x:-1,w:3,h:2.3,c:'casa',awning:T}]}),
  // a grey sheet gate under clay tiles, the house behind its pickets
  L('S',66,76,{wall:'#ece6da',roof:'gable',roofColor:T,setback:2,front:{h:1.2,c:'#ece6da',rail:{h:.8,c:W,style:'bars'},gates:[{t:'garage',x:2.4,w:3.4,c:'#a8b4bc',awning:T}]}}),
  // a blank taupe wall
  muro('S',76,84,'#c9b4a0',2.6),
  // beige house, white garage door; mauve houses with porches and white garage gates
  L('S',84,91,{wall:'#e6d6c0',roof:'hip',roofColor:T,setback:1,open:[{t:'garage',x:0,w:3,c:W}]}),
  L('S',91,100,{wall:'#b88a8a',roof:'gable',roofColor:T,setback:2,front:{h:.4,c:'#b88a8a',rail:{h:1.2,c:'#2a2a2a',style:'bars'}},
    open:[{t:'open',x:-1.4,w:3,h:2.3,c:'casa'},{t:'gate',x:3,w:2.4,c:W}]}),
  L('S',100,110.5,{wall:'#b88a8a',roof:'gable',roofColor:'#6a4a3a',fascia:'#6a4a3a',setback:2,front:{h:.6,c:'#b88a8a',rail:{h:1.2,c:'#2a2a2a',style:'bars'},gates:[{t:'gate',x:2,w:1.2,c:'#2a2a2a'}]},
    open:[{t:'open',x:-1,w:3,h:2.3,c:'casa'}]}),
  // a tiled porch house on the bend
  L('S',110.5,118,{wall:'#ece6da',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#c9c4bc',rail:{h:1.2,c:'#2a2a2a',style:'bars'}},open:[{t:'open',x:0,w:4,h:2.3,c:'casa'}]}),
  // green-grey house raised behind railings on a stone base
  L('S',118,124,{wall:'#a8b4a0',roof:'gable',roofColor:T,fascia:'#7a4a2e',plinth:{h:1,c:'#6a7a6a',stone:true},setback:2,front:{h:1,c:'#6a7a6a',style:'stone',rail:{h:1,c:'#3a3a3a',style:'bars'}},
    open:[{t:'window',x:0,w:1.6,frame:'#3a3a3a'}]}),
  // nº 15: white house behind brick-tile pillars and a black iron fence
  L('S',124,134,{wall:'#ece6da',roof:'gable',roofColor:T,setback:3,front:{h:.4,c:'#b5683f',rail:{h:1.4,c:'#2a2a2a',style:'bars'},gates:[{t:'gate',x:-1,w:3,c:'#2a2a2a'}]},
    panels:[{x:-3,w:.8,c:'#b5683f'}],open:[{t:'window',x:-2,w:1.4,shutters:'#7a8a9a'},{t:'window',x:1.4,w:1.6,grille:true}]}),
  muro('S',134,139,'#b5683f',2),
  // the corner house behind a granite-textured wall with white diagonal stripes
  L('S',139,151.6,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:3.5,front:{h:1.6,c:'#c9c6be'},open:[{t:'window',x:-1,w:1.8,frame:W}]}),
  // --- Mario Mandoni → the end
  // porch houses with stone walls and brick-pillared fences
  L('S',159.4,168,{wall:'#e6d8c4',roof:'gable',roofColor:T,setback:3,front:{h:.8,c:'#8a7a64',style:'stone',rail:{h:1,c:'#3a3a3a',style:'bars'}},open:[{t:'window',x:0,w:1.6,frame:'#3a3a3a'}]}),
  L('S',168,178,{wall:'#ece6da',roof:'gable',roofColor:T,fascia:'#7a4a2e',setback:3,front:{h:.4,c:'#b5683f',rail:{h:1.4,c:'#2a2a2a',style:'bars'}},
    open:[{t:'open',x:1,w:5,h:2.3,c:'casa'}]}),
  // a brick-tile wall and a white gate; a grey wall under a tree
  muro('S',178,190,'#b5683f',2.2,{front:{h:2.2,c:'#b5683f',gates:[{t:'gate',x:4,w:1.2,c:W}]},behind:{w:8,d:8,at:3,roofColor:T,wall:'#ece4d6'}}),
  muro('S',190,200,'#a8a49c',2,{behind:{w:7,d:8,at:3,roofColor:T,wall:'#ece4d6'}}),
];

export const TREES:Tree[]=[
  {side:'N',s:104,kind:'ficus'},{side:'N',s:116,kind:'ficus'},{side:'S',s:192,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:10,every:36},
};
