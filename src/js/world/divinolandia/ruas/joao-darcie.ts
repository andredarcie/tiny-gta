// Rua João Darcie — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/jd-N-*/ and jd-S-*/, kept out of git). 388 m
// north→south down the slope west of the centre, from the Rua Severo Maida, with the
// valley and the town below. `s` starts at the NORTH end, so side 'N' is the EAST side (left
// of a walker going south) and 'S' the WEST side.
//   s=76 R. Guiomar Dorcie Fonsato   s=149 R. Constantino da Cunha Sobrinho
//   s=296 R. Walter Darcie   s=352 R. Severino de Souza Carneiro
// Asphalt all along. A residential street of single-storey houses behind walls and gates,
// with empty lots on the slope, a little square with exercise machines at the Constantino
// da Cunha Sobrinho and woods at the south end. Opening x is measured from the lot centre as
// SEEN FROM THE STREET (left negative): on the east side (N) left is NORTH (lower s), on the
// west side (S) left is SOUTH (higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua João Darcie';
export const CROSS=[0,75.8,149.3,295.8,352.4,387.5];
const SURFACE:Surface[]=[[0,387.5,'asphalt']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- Severo Maida → Guiomar Dorcie Fonsato
  // grey corner house behind a curved grey wall, a green-glass window
  L('N',4,14,{wall:'#c9c6c0',roof:'flat',fascia:W,eave:.6,setback:3,front:{h:1.6,c:'#a8a59e'},open:[{t:'window',x:1,w:2,frame:'#3a8a6a',grille:true}]}),
  // a white sheet gate and a red one, a block house going up behind
  muro('N',14,22,'#c9c6c0',2,{front:{h:2,c:'#c9c6c0',gates:[{t:'gate',x:-1.6,w:3,c:W},{t:'gate',x:2.4,w:2.4,c:'#a8443a'}]},
    behind:{w:6,d:7,at:3,roof:'flat',roofColor:'#9a958c',wall:'#9a958c'}}),
  // bare block walls with red doors
  muro('N',22,30,'#9a8a78',2.4,{front:{h:2.4,c:'#9a8a78',gates:[{t:'door',x:2,w:1,c:'#a8443a'}]},behind:{w:7,d:8,at:3,roofColor:T,wall:'#e8e4dc'}}),
  muro('N',30,34,'#9a8a78',2.2,{front:{h:2.2,c:'#9a8a78',gates:[{t:'door',x:0,w:1,c:'#a8443a'}]}}),
  // white house raised on the slope, a long barred veranda under clay tiles
  L('N',34,46,{wall:'#f2f0ea',roof:'gable',roofColor:T,fascia:'#7a4a2e',eave:.8,plinth:{h:1.2,c:'#e8e4dc'},
    open:[{t:'open',x:-1,w:7,h:2.2,y:1.2,c:'casa',awning:T},{t:'gate',x:4.4,w:1.6,c:W}]}),
  // pink-white wall with a white stripe, a white gate
  muro('N',46,52,'#efe0dc',2.2,{front:{h:2.2,c:'#efe0dc',gates:[{t:'gate',x:1.4,w:2.6,c:W}]},behind:{w:5,d:8,at:3,roofColor:T,wall:'#efe0dc'}}),
  // lilac house behind a white iron fence, a pillared porch
  L('N',52,60,{wall:'#e2d6dc',roof:'gable',roofColor:T,fascia:'#7a4a2e',setback:3,front:{h:.5,c:'#b8b4ac',rail:{h:1.4,c:W,style:'bars'},gates:[{t:'gate',x:-1,w:3,c:W}]},
    open:[{t:'open',x:0,w:4,h:2.3,c:'casa',awning:T}]}),
  // white house: a gabled carport porch, a white tower block beside it
  L('N',60,66,{wall:'#f2f0ea',roof:'gable',roofColor:'#6a4a3a',fascia:'#6a4a3a',eave:.8,open:[{t:'open',x:0,w:3.4,h:2.3,c:'casa'}]}),
  L('N',66,72,{floors:2,wall:'#f2f0ea',roof:'flat',parapet:true,open:[{t:'window',x:0,w:1.6,fl:1,grille:true},{t:'window',x:0,w:1,grille:true}]}),
  // --- Guiomar Dorcie Fonsato → Constantino da Cunha Sobrinho
  // the white wall with glass-block cut-outs, white houses behind
  muro('N',81.2,88,'#f2f0ea',2.2,{behind:{w:7,d:8,at:3,roofColor:T,wall:'#f2f0ea'}}),
  // an empty lot on the slope behind a stone retaining wall
  muro('N',88,104,'#8a7a64',.8,{front:{h:.8,c:'#8a7a64',style:'stone'}}),
  // mauve-brown house: white louvred window, a white barred gate
  L('N',104,120,{wall:'#7a6a6c',roof:'hip',roofColor:T,setback:2,front:{h:1.8,c:'#7a6a6c',gates:[{t:'gate',x:2,w:3.4,c:W}]},
    open:[{t:'window',x:-3,w:1.8,shutters:W,frame:W}]}),
  // white houses with stone-clad pillars behind red iron fences, a brown gate
  L('N',120,128,{wall:'#f2f0ea',roof:'gable',roofColor:T,fascia:'#7a4a2e',setback:3,panels:[{x:-2,w:.8,stone:true},{x:1,w:.8,stone:true}],
    front:{h:.5,c:'#c9c4bc',rail:{h:1.2,c:'#8a3a2e',style:'bars'}},open:[{t:'open',x:-.5,w:2.4,h:2.3,c:'casa'}]}),
  L('N',128,140,{wall:'#f2f0ea',roof:'gable',roofColor:T,fascia:'#7a4a2e',setback:2,panels:[{x:-4,w:.8,stone:true}],
    front:{h:2,c:'#efe9dc',gates:[{t:'gate',x:1.6,w:3,c:'#b8945a'}]},open:[{t:'window',x:-1,w:1.6,shutters:'#b8945a'}]}),
  L('N',140,145.5,{wall:'#f2f0ea',roof:'gable',roofColor:T,fascia:'#7a4a2e',setback:2,front:{h:2,c:'#efe9dc',gates:[{t:'gate',x:0,w:1.2,c:'#b8945a'}]},
    open:[{t:'window',x:0,w:1.6,shutters:'#b8945a'}]}),
  // --- Constantino da Cunha Sobrinho → Walter Darcie
  // grey sobrado with a white balcony, white barred garage; a white house behind an old brick wall, a yellow ipê
  L('N',153,160,{floors:2,wall:'#c9c6c0',roof:'flat',parapet:true,open:[{t:'gate',x:0,w:3.2,c:W},{t:'window',x:0,w:1.6,fl:1}],balcony:{x:0,w:5,fl:1,rail:'white'}}),
  L('N',160,170,{wall:'#ece8e0',roof:'hip',roofColor:T,setback:2,front:{h:2,c:'#b5683f',gates:[{t:'gate',x:-2,w:3,c:W},{t:'gate',x:3,w:2,c:'#8a3a2e'}]}}),
  // houses with red iron gates and porches under clay tiles
  L('N',170,178,{wall:'#ece4d6',roof:'gable',roofColor:T,setback:3,front:{h:.4,c:'#c9c4bc',rail:{h:1.6,c:'#8a3a2e',style:'bars'},gates:[{t:'gate',x:-1,w:3,c:'#8a3a2e'}]},
    open:[{t:'open',x:-1,w:3,h:2.3,c:'casa',awning:T}]}),
  L('N',178,186,{wall:'#ece8e2',roof:'hip',roofColor:'#d8d4cc',setback:2,front:{h:1,c:'#c9c4bc',rail:{h:1.2,c:W,style:'bars'}},open:[{t:'window',x:0,w:2.4}]}),
  // a pale blue house behind white bars; red railings on a brick wall
  L('N',186,192,{wall:'#a8c4dc',roof:'gable',roofColor:'#d8d4cc',setback:2,front:{h:1,c:'#e8e8e4',rail:{h:1,c:W,style:'bars'}},open:[{t:'window',x:0,w:1.6}]}),
  L('N',192,200,{wall:'#ece4d6',roof:'gable',roofColor:T,setback:3,front:{h:1.2,c:'#b5683f',rail:{h:1.2,c:'#8a3a2e',style:'bars'},gates:[{t:'gate',x:1,w:3,c:W,awning:T}]}}),
  // modern beige house: a white triangle breeze-block screen, a white garage
  L('N',200,214,{wall:'#d8cdb8',roof:'flat',parapet:true,panels:[{x:-3.6,w:3,c:'#f2f2f0'}],
    open:[{t:'garage',x:1,w:4.4,c:W},{t:'open',x:4.8,w:1.4,h:2.3,c:'casa'}]}),
  // an empty lot behind a low block kerb
  muro('N',214,228,'#b8b4aa',.5),
  // mauve house on a stone-clad wall with brown railings, a brown garage gate under clay tiles
  L('N',228,236,{wall:'#c9a8b4',roof:'gable',roofColor:T,setback:2.5,front:{h:1.4,c:'#c8b8a4',style:'stone',rail:{h:.6,c:'#6a3a2a',style:'bars'}},
    open:[{t:'window',x:0,w:2.4,frame:'#3a3a3a'}]}),
  L('N',236,245,{wall:'#c9a8b4',roof:'hip',roofColor:T,front:{h:.4,c:'#c8b8a4',style:'stone'},open:[{t:'door',x:-3,w:1,c:'#6a3a2a',awning:T},{t:'garage',x:1.4,w:4,c:'#6a3a2a',awning:T}]}),
  // empty lots and a house going up behind white walls
  muro('N',245,260,'#f2f0ea',1.8),
  muro('N',260,284.8,'#b8b4aa',.5),
  // --- Walter Darcie → Severino de Souza Carneiro
  // white houses: a balustrade wall and a wooden gate, a white sheet fence
  L('N',299.6,308,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:3,front:{h:1,c:'#c9c4bc',rail:{h:.6,c:W,style:'bars'},gates:[{t:'gate',x:3,w:2.4,c:'#8a5a3a'}]},
    open:[{t:'open',x:-1,w:4,h:2.3,c:'casa',awning:T}]}),
  L('N',308,316,{wall:'#ece8e0',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#f2f2f0',style:'panel'}}),
  // a blue house behind white precast walls among the trees
  L('N',316,330,{wall:'#9ab4d0',roof:'gable',roofColor:T,fascia:W,setback:4,front:{h:2,c:'#ece8e2'}}),
  muro('N',330,348,'#e8e6e0',1.8),

  // ================= WEST SIDE (S) =================
  // --- Severo Maida → Guiomar Dorcie Fonsato
  // grey sobrados behind brick-tile clad walls with white garage doors
  L('S',26,34,{floors:2,wall:'#b8bab8',roof:'hip',roofColor:'#8a8a86',front:{h:2.4,c:'#b5683f',gates:[{t:'garage',x:0,w:3,c:W}]},
    setback:1,open:[{t:'window',x:-1,w:1.8,fl:1,shutters:W}]}),
  L('S',34,40,{floors:2,wall:'#b8bab8',roof:'hip',roofColor:'#8a8a86',setback:1,front:{h:2.4,c:'#b5683f',gates:[{t:'garage',x:1,w:2.8,c:W}]},
    open:[{t:'window',x:0,w:1.6,fl:1,shutters:W}]}),
  // grey two-storey house with a deep porch, a white gate
  L('S',40,50,{floors:2,wall:'#c4c0b8',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:'#c4c0b8',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:3.4,w:2.6,c:W}]},
    open:[{t:'window',x:-1,w:1.8,grille:true},{t:'door',x:1.4,w:1,c:'#3a3a3a'},{t:'open',x:0,w:6,h:2.2,fl:1,c:'casa'}]}),
  // a white barred garage under a clay awning, then the pink wall with a white gate
  L('S',50,58,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:2,front:{h:2,c:'#ece8e2',gates:[{t:'gate',x:-1,w:3.4,c:W,awning:T}]}}),
  L('S',58,67,{wall:'#ece4d6',roof:'hip',roofColor:T,setback:3,front:{h:1,c:'#efd8d4',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:3,w:1.2,c:W,awning:T}]},
    open:[{t:'open',x:-1,w:4,h:2.3,c:'casa',awning:T}]}),
  L('S',67,72,{wall:'#efd8d4',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#efd8d4',gates:[{t:'gate',x:0,w:2.8,c:'#9aa8b8'}]}}),
  // --- Constantino da Cunha Sobrinho → Walter Darcie
  // white corner house behind its white wall, grey gates
  L('S',160.2,166,{wall:'#f2f2f0',roof:'flat',parapet:true,setback:2,front:{h:2.2,c:'#f2f2f0',gates:[{t:'door',x:0,w:1,c:'#5a5c60'}]}}),
  L('S',166,178,{wall:'#f2f2f0',roof:'hip',roofColor:T,setback:2,front:{h:2.2,c:'#f2f2f0',gates:[{t:'gate',x:4,w:3,c:'#5a5c60'}]}}),
  // beige wall, a white garage under clay tiles
  L('S',178,186,{wall:'#e6d8c0',roof:'hip',roofColor:T,setback:1,front:{h:2.2,c:'#e6d8c0',gates:[{t:'garage',x:-1,w:3,c:'#e8e8e6',awning:T}]}}),
  // yellow house behind a white wall with iron railings
  L('S',186,196,{wall:'#e2d088',roof:'gable',roofColor:'#6a4a3a',fascia:'#6a4a3a',setback:3,front:{h:1.4,c:'#ece8e2',rail:{h:.8,c:'#3a3a3a',style:'bars'},gates:[{t:'gate',x:3,w:2.4,c:W}]},
    open:[{t:'window',x:-1,w:1.4,grille:true}]}),
  L('S',196,204,{wall:'#e2d088',roof:'gable',roofColor:'#6a4a3a',setback:2,front:{h:1.6,c:'#ece8e2',gates:[{t:'gate',x:-1,w:3,c:'#c9ccce'}]}}),
  // nº 214: a grey garage gate under clay tiles; beige walls with houses behind
  L('S',204,212,{wall:'#e6cfb8',roof:'hip',roofColor:T,setback:1,front:{h:2.4,c:'#e6cfb8',gates:[{t:'garage',x:-.4,w:3,c:'#8a96a0',awning:T}]}}),
  L('S',212,220,{wall:'#e6cfb8',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#c8b4a0',gates:[{t:'door',x:2.4,w:1,c:'#5a5c60'}]}}),
  L('S',220,228,{wall:'#e6cfb8',roof:'gable',roofColor:T,setback:1,front:{h:2.2,c:'#e6cfb8',gates:[{t:'gate',x:0,w:3.6,c:'#5a5c60'}]}}),
  // grey house: a stone-clad wall, a brick arch over the window, balustrades
  L('S',228,242,{wall:'#a8aaae',roof:'gable',roofColor:'#5a5a58',fascia:'#5a5a58',setback:2.5,
    front:{h:1.4,c:'#5a5650',style:'stone',rail:{h:.8,c:'#c8c8c4',style:'bars'},gates:[{t:'gate',x:-3,w:3,c:'#5a5c60'},{t:'door',x:1,w:1,c:'#5a5c60'}]},
    open:[{t:'arch',x:2,w:2.4,frame:'#b5683f'}]}),
  // empty lots behind block kerbs, little white houses with grey sheet gates
  muro('S',242,258,'#b8b4aa',.5),
  L('S',258,266,{wall:'#f2f0ea',roof:'gable',roofColor:'#5a4a40',open:[{t:'garage',x:0,w:3,c:'#9aa8b8'}]}),
  muro('S',266,268,'#b8b4aa',.5),
  L('S',268,276,{wall:'#f2f0ea',roof:'gable',roofColor:T,setback:2,front:{h:2,c:'#f2f0ea',gates:[{t:'door',x:-1,w:1,c:'#9aa8b8'}]},open:[{t:'open',x:2,w:2.4,h:2.2,c:'casa',awning:T}]}),
  muro('S',276,284,'#b8b4aa',.5),
  // a mint house behind a brown sheet gate
  L('S',284,291,{wall:'#b8d8b8',roof:'gable',roofColor:T,setback:2,front:{h:2.2,c:'#9ac0a0',gates:[{t:'gate',x:0,w:4,c:'#6a4a3a'}]}}),
  // --- Walter Darcie → Severino de Souza Carneiro
  // a beige house with a brown garage, a little green house with a dark gate
  L('S',299.6,305,{wall:'#e6cfb8',roof:'hip',roofColor:T,open:[{t:'garage',x:0,w:3,c:'#a8743a'}]}),
  // nº 308: a brown garage under clay tiles beside a concrete wall
  L('S',305,312,{wall:'#e6cfb8',roof:'hip',roofColor:T,open:[{t:'garage',x:-.6,w:3,c:'#a8743a'},{t:'window',x:2.4,w:1,grille:true}]}),
  // nº 314: a white gate in a grey wall
  L('S',312,320,{wall:'#ece4d6',roof:'hip',roofColor:T,setback:2,front:{h:2,c:'#b8b4aa',gates:[{t:'gate',x:.6,w:3.4,c:W}]}}),
  // a white wall, a white garage door, a cream sheet gate
  L('S',320,332,{wall:'#ece8e0',roof:'flat',parapet:true,setback:2,front:{h:2.2,c:'#ece8e0',gates:[{t:'garage',x:3,w:3,c:W},{t:'gate',x:-2,w:4,c:'#e8dcc4'}]}}),
  // nº 348: grey sobrado, a glass balcony, white garage door, on the corner
  L('S',332,348.4,{floors:2,wall:'#7a7c80',roof:'flat',parapet:true,setback:1,front:{h:2,c:'#7a7c80',gates:[{t:'door',x:-3,w:1,c:W},{t:'garage',x:1.4,w:3.8,c:W}]},
    open:[{t:'window',x:-3,w:1.4,fl:1},{t:'window',x:2,w:2,fl:1}],balcony:{x:2,w:5,fl:1,rail:'glass'}}),
  // --- Severino de Souza Carneiro → the end
  // white houses behind walls on the corner, a lattice gate, a carport
  L('S',356.4,370,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#c9c4bc'}}),
  L('S',370,378,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#c9c4bc',gates:[{t:'gate',x:0,w:3,c:'#9aa0a3'}]}}),
  L('S',378,386,{wall:'#ece4d6',roof:'gable',roofColor:'#6a4a3a',fascia:'#6a4a3a',setback:2,front:{h:1,c:'#ece4d6',rail:{h:.8,c:'#3a3a3a',style:'bars'}},
    open:[{t:'open',x:-2,w:3,h:2.3,c:'casa',awning:T},{t:'window',x:2,w:1.4,frame:'#3a6a3a',grille:true}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:158,kind:'resedaBranca'},{side:'N',s:322,kind:'ficus'},{side:'N',s:338,kind:'ficus'},{side:'S',s:84,kind:'ficus'},{side:'S',s:96,kind:'ficus'},
  {side:'S',s:112,kind:'ficus'},{side:'S',s:130,kind:'palmeira'},{side:'S',s:340,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:10,every:36},
};
