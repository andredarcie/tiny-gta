// Rua Espírito Santo — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/es-N-*/ and es-S-*/, kept out of git). The street
// runs 461 m north→south from the Avenida Marginal to the XV de Novembro at the Praça
// Ladislau.
//   s=49 R. Yolanda Zamai Raimundo   s=105 R. Plínio de Carvalho   s=196 R. Dom Antônio J. de Mello
//   s=252 R. Cel. José Leopoldino   s=328 R. Treze de Maio   s=397 R. Romeu Zanetti   s=461 R. XV
// Setts and asphalt alternate block by block. Side 'N' is the EAST side (left of a walker going
// +s, i.e. south). Opening x is measured from the lot centre as SEEN FROM THE STREET (left
// negative). The Posto Taurus at the Romeu corner, Tradição Tecidos and the Martinelli shed are
// placed elsewhere and left alone. Lot depth (d + setback) ≤ 12 m. Pure data.
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Espírito Santo';
export const CROSS=[0,48.9,105.3,196.1,251.6,327.9,396.9,461.3];
const SURFACE:Surface[]=[[0,48.9,'asphalt'],[48.9,196.1,'sett'],[196.1,327.9,'asphalt'],[327.9,461.3,'sett']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- Marginal → Yolanda Zamai Raimundo
  // the salmon house behind its salmon wall, a black sheet gate on the corner
  L('N',6,22,{wall:'#e6b8a0',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',setback:3,front:{h:2,c:'#e6b8a0',gates:[{t:'gate',x:-4,w:3.6,c:'#1c1c1e'},{t:'gate',x:3,w:1,c:'#1c1c1e'}]}}),
  // the white and grey shed with olive double doors
  L('N',22,32,{wall:'#e6e2dc',roof:'flat',parapet:true,plinth:{h:1.6,c:'#a8a8a6'},open:[{t:'garage',x:-1.6,w:3,h:3.4,c:'#8a8a5a'},{t:'window',x:2.6,w:2.4,y:2.2,frame:'#a8a8a6'}]}),
  // the Unimed office: a white sobrado with balconies behind white bars, on the corner
  L('N',32,45,{floors:2,wall:'#ece8e2',roof:'flat',parapet:true,setback:2,front:{h:.4,c:W,rail:{h:1.6,c:W,style:'bars'},gates:[{t:'gate',x:2,w:4,c:W}]},
    open:[{t:'glass',x:0,w:6,y:0,h:2.6,frame:'#3a3a3a'},{t:'window',x:-3,w:1.6,fl:1,shutters:W},{t:'window',x:2,w:2.4,fl:1}],balcony:{x:0,w:10,fl:1,rail:'white'},
    sign:{text:'UNIMED',bg:'#2a8a5a',fg:'#ffffff',x:-4.6,y:1.6,w:1.6,h:.7}}),
  // --- Yolanda Zamai Raimundo → Plínio de Carvalho
  // Elétrica Paulista: a raw-brick shed on a grey base, big blue sheet doors
  L('N',53,66,{wall:'#b5603f',roof:'gable',roofColor:'#5a6068',plinth:{h:1.6,c:'#8a8c8e'},open:[{t:'gate',x:-5,w:1.4,c:'#2a5ab0'},{t:'garage',x:-1,w:5,h:3.2,c:'#2a5ab0'},{t:'window',x:4,w:2,grille:true,frame:'#2a5ab0'}],
    sign:{text:'ELÉTRICA PAULISTA',bg:'#8a8c8e',fg:'#ffffff',x:-3.6,y:1.4,w:.5,h:2.6}}),
  // the modern beige sobrado with a big white garage and stone-tile walls
  L('N',66,76,{floors:2,wall:'#ddd0bc',roof:'flat',parapet:true,setback:2,front:{h:2.4,c:'#a8a49c',gates:[{t:'door',x:-2.6,w:1,c:W},{t:'garage',x:1.6,w:5,c:'#f2f2f0'}]}}),
  // a white sheet gate; the beige gable house behind its clay-coped wall
  L('N',76,84,{wall:'#ecdcc0',roof:'gable',roofColor:'#e8e4dc',fascia:W,setback:3,front:{h:2.2,c:'#ecdcc0',gates:[{t:'gate',x:-2.4,w:3,c:'#f2f2f0'}]},open:[{t:'window',x:1.4,w:1,frame:'#3a6a8a'},{t:'window',x:3,w:1,frame:'#3a6a8a'}]}),
  // old cream houses with pale yellow doors, a grey wall
  L('N',84,92,{wall:'#e6d4a8',roof:'flat',parapet:true,open:[{t:'garage',x:-1,w:2,c:'#e6dcb0'},{t:'door',x:2,w:1.2,c:'#e6dcb0'}]}),
  L('N',92,101.4,{wall:'#ecdcc0',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#8a8c8e'},open:[{t:'window',x:-1,w:2,shutters:'#e6c870'}]}),
  // --- Plínio de Carvalho → Dom Antônio J. de Mello
  // nº 354: the pale blue corner house, barred windows, a porch
  L('N',109.2,122,{wall:'#a8c4dc',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',open:[{t:'open',x:-4,w:1.8,h:2.2,c:'casa'},{t:'window',x:-1,w:2,grille:true,frame:W},{t:'window',x:3,w:2.8,grille:true,frame:W}]}),
  L('N',122,130,{wall:'#a8c4dc',roof:'hip',roofColor:T,open:[{t:'window',x:-2,w:1.6,grille:true,frame:W},{t:'door',x:1.6,w:1,c:W}]}),
  // nº 352: the beige house with a carport under a green awning, mesh fence on a stone wall
  L('N',130,138,{wall:'#e6dcc0',roof:'hip',roofColor:T,setback:3,front:{h:1,c:'#ece4d0',rail:{h:.8,c:'#9aa0a3',style:'lattice'},gates:[{t:'gate',x:2,w:3.4,c:'#9aa0a3'}]},open:[{t:'open',x:1,w:4,h:2.3,c:'casa',awning:'#3a6a4a'}]}),
  // the stone-tile house with brown garage and door
  L('N',138,146,{wall:'#ddd0b4',roof:'hip',roofColor:T,panels:[{x:0,w:8,stone:true}],open:[{t:'door',x:-2,w:1,c:'#4a3a32'},{t:'garage',x:2,w:3,c:'#4a3a32'}]}),
  // nº 322: a brick-red wall with a grey sheet gate, the brick house behind
  L('N',146,154,{wall:'#a8603a',roof:'gable',roofColor:T,setback:4,front:{h:2,c:'#9a5a3a',gates:[{t:'gate',x:-.6,w:1.4,c:'#c8c8c4'}]}}),
  // the white gable house with a louvred door
  L('N',154,164,{wall:'#ece8e4',roof:'gable',roofColor:'#9aa0a3',fascia:W,open:[{t:'window',x:-3,w:2,frame:W},{t:'door',x:0,w:1,c:'#c8c8c4'},{t:'window',x:2.8,w:2,shutters:W}]}),
  // the beige house with a barred veranda behind a beige wall
  L('N',164,172,{wall:'#ddc8a8',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#ddc8a8'},open:[{t:'open',x:0,w:6,h:2.3,c:'casa'}]}),
  // nº 2?? — beige veranda houses with brown bars and a brown gate
  L('N',172,180,{wall:'#e6d4b4',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#e6d4b4',gates:[{t:'gate',x:2.6,w:2.6,c:'#4a3a32'}]},open:[{t:'window',x:-2,w:2.2,grille:true}]}),
  // the stained beige houses to the corner
  L('N',180,188,{wall:'#e6d4b4',roof:'hip',roofColor:T,open:[{t:'window',x:0,w:2.4,shutters:'#8a9098',frame:W}]}),
  L('N',188,191.8,{wall:'#e6d4b4',roof:'hip',roofColor:T,open:[{t:'window',x:0,w:1.2,frame:W}]}),
  // --- Dom Antônio J. de Mello → Cel. José Leopoldino
  // the pale blue corner house behind a white fence on a speckled base
  L('N',200,212,{wall:'#a8b8c8',roof:'hip',roofColor:'#5a6068',setback:2,front:{h:.8,c:'#8a8c8e',rail:{h:1.1,c:W,style:'bars'}},open:[{t:'window',x:-1,w:2.2,shutters:W},{t:'arch',x:3,w:2.4,grille:true}]}),
  // the house with a curved polycarbonate awning, a carport behind a white fence
  L('N',212,218,{wall:'#a8b8c8',roof:'gable',roofColor:T,setback:2,front:{h:.4,c:W,rail:{h:1.1,c:W,style:'bars'}},open:[{t:'window',x:0,w:3,grille:true,awning:'#8a8c8e'}]}),
  // the beige sobrado with a timber balcony and planters, a white garage
  L('N',218,226,{floors:2,wall:'#ddc8a8',roof:'gable',roofColor:T,open:[{t:'garage',x:-1.4,w:2.6,c:W},{t:'door',x:2,w:1,c:W}],balcony:{x:0,w:7,fl:1,rail:'iron'}}),
  // the green sobrado with arched windows behind a green wall, a grey sheet gate under a hood
  L('N',226,236,{floors:2,wall:'#a8d4a8',roof:'gable',roofColor:'#8a4a32',setback:3,front:{h:2.4,c:'#a8d4a8',gates:[{t:'gate',x:2.6,w:3.4,c:'#8a9a7a',awning:T}]},open:[{t:'arch',x:-3,w:1.2,fl:1},{t:'arch',x:0,w:1.2,fl:1}]}),
  muro('N',236,247.4,'#e6dcc8',2.6,{behind:{w:11,d:9,at:3,floors:2,roofColor:'#8a4a32',wall:'#a8d4a8'}}),
  // --- Cel. José Leopoldino → Treze de Maio
  // nº 198: the old cream corner house, a porch, grey shutters
  L('N',255.6,266,{wall:'#ece0c8',roof:'gable',roofColor:'#6a4a32',fascia:'#6a4a32',open:[{t:'open',x:-3,w:2,h:2.2,c:'casa'},{t:'window',x:.6,w:2,shutters:'#6a6c70'},{t:'window',x:3.6,w:1.6,shutters:'#6a6c70'}]}),
  // the old house behind a red sheet gate
  L('N',266,272,{wall:'#ece4d6',roof:'gable',roofColor:'#8a4a32',setback:3,front:{h:2,c:'#ece4d6',gates:[{t:'gate',x:0,w:3.6,c:'#8a3a2a'}]}}),
  // nº 186: the grey sobrado with white louvred gates
  L('N',272,280,{floors:2,wall:'#b8b4ac',roof:'flat',parapet:true,open:[{t:'gate',x:1,w:3.6,c:W}]}),
  // the mauve house, a white slatted gate and a sheet garage on a stone base
  L('N',280,288,{wall:'#a88a8a',roof:'gable',roofColor:T,fascia:W,plinth:{h:1,c:'#c8b49a',stone:true},open:[{t:'gate',x:-2.4,w:2.6,c:W},{t:'garage',x:1.6,w:2.6,c:'#c8c8c4'}]}),
  // the white house with a brick-red speckled wing, a white door
  L('N',288,294,{wall:'#ece8e2',roof:'gable',roofColor:'#6a4a32',fascia:'#6a4a32',panels:[{x:2,w:2,c:'#8a3a2a'}],open:[{t:'door',x:-1,w:1,c:W}]}),
  // the brick-red speckled gable with brown shutters, a red sheet gate
  L('N',294,304,{wall:'#8a3a30',roof:'gable',roofColor:'#4a3a32',fascia:W,open:[{t:'window',x:-3,w:1.4,shutters:'#6a3a2a',frame:W},{t:'glass',x:0,w:2.4,y:.4,h:2,frame:W},{t:'gate',x:3.4,w:3,c:'#8a3a2a'}]}),
  // the stone-tile house with a salmon front and a white garage
  L('N',304,312,{wall:'#e6b8a0',roof:'gable',roofColor:T,panels:[{x:0,w:8,c:'#d8c8a8',y0:0,y1:2.8}],open:[{t:'garage',x:-1.6,w:2.6,c:W},{t:'window',x:1.6,w:1.4,shutters:W},{t:'window',x:3.4,w:1.2,grille:true}]}),
  // the brick sobrado with arched windows over a white ground floor, a red awning, iron fence
  L('N',312,324.4,{floors:2,wall:'#ece8e2',upper:'#b5603f',roof:'hip',roofColor:T,setback:1,front:{h:.6,c:'#5a4a40',style:'stone',rail:{h:1.3,c:'#3a3a3a',style:'bars'}},
    open:[{t:'glass',x:-3,w:2.4,y:0,h:2.4,frame:'#3a3a3a',awning:'#9a2a2a'},{t:'window',x:1,w:1.4,grille:true},{t:'arch',x:-3,w:1.8,fl:1},{t:'arch',x:1,w:1.8,fl:1},{t:'arch',x:4,w:1.8,fl:1}]}),
  // --- Treze de Maio → Romeu Zanetti
  // the pink sobrado with canvas awnings, an iron balcony, dark garages
  L('N',332,344,{floors:2,wall:'#e6c8c8',roof:'flat',parapet:true,open:[{t:'garage',x:-2,w:3,c:'#2a1e1a'},{t:'door',x:1.6,w:1,c:'#3a2a24'},{t:'window',x:-2,w:2.4,fl:1,awning:'#e8dcc8'},{t:'window',x:2.6,w:2,fl:1,awning:'#e8dcc8'}],
    balcony:{x:0,w:7,fl:1,rail:'iron'}}),
  // an old crumbling wall with a grey sheet garage
  muro('N',344,352,'#d8c8a8',2.4,{front:{h:2.4,c:'#d8c8a8',gates:[{t:'garage',x:0,w:3.4,c:'#a8b0b8'}]}}),
  // the old salmon house with a wide window over a grey tiled base
  L('N',352,364,{wall:'#ecc8a8',roof:'gable',roofColor:'#5a5a58',fascia:'#c88a6a',plinth:{h:1,c:'#8a8c8e'},open:[{t:'window',x:-3.4,w:2,grille:true,frame:W},{t:'window',x:1.4,w:5,frame:W}]}),
  // the modern beige houses with grey gates
  L('N',364,372,{wall:'#ddd0bc',roof:'flat',parapet:true,panels:[{x:-3,w:2,c:'#c8c4bc'}],open:[{t:'gate',x:0,w:2,c:'#5a6068'},{t:'gate',x:2.6,w:2.8,c:'#5a6068'}]}),
  L('N',372,380,{wall:'#ddd0bc',roof:'flat',parapet:true,plinth:{h:1,c:'#a8968a'},open:[{t:'garage',x:-2.4,w:2.6,c:'#c8c8c4'},{t:'garage',x:.6,w:2.6,c:'#c8c8c4'},{t:'window',x:3.2,w:1.4,shutters:W}]}),
  // the pink cottage with a barred porch, a white sheet gate
  L('N',380,387,{wall:'#ece0e0',roof:'gable',roofColor:T,plinth:{h:.6,c:'#a8968a'},open:[{t:'window',x:-2,w:1.6,shutters:W},{t:'gate',x:1,w:2.4,c:W}]}),
  // the pink corner office with a grey awning (a clinic plate by the window)
  L('N',387,393,{wall:'#e6d4d0',roof:'hip',roofColor:T,band:'#a8968a',open:[{t:'window',x:-1,w:1.6,frame:W},{t:'window',x:1.4,w:1.6,awning:'#8a8c8e'}]}),
  // --- Romeu Zanetti → XV de Novembro
  // the brick corner sobrado on a grey stone base, a white balcony
  L('N',401,414,{floors:2,wall:'#8a8c8e',upper:'#b5603f',roof:'gable',roofColor:T,open:[{t:'open',x:-4,w:2.6,h:2.4,c:'casa'},{t:'window',x:0,w:2,frame:W},{t:'window',x:3,w:2,shutters:W,fl:1},{t:'window',x:-1,w:1.6,fl:1,frame:W}],
    balcony:{x:-4,w:4,fl:1,rail:'white'}}),
  L('N',414,420,{wall:'#b5603f',roof:'gable',roofColor:T,plinth:{h:1.2,c:'#8a8c8e'},open:[{t:'gate',x:0,w:2.6,c:W}]}),
  // a tall white wall with a black door
  muro('N',420,428,'#ece8e2',2.8,{front:{h:2.8,c:'#ece8e2',gates:[{t:'door',x:-1,w:1.2,c:'#2a3a4a'}]}}),
  // the ochre sobrado with brown roll garages and an iron balcony
  L('N',428,440,{floors:2,wall:'#d8c070',roof:'flat',parapet:true,open:[{t:'garage',x:-2.6,w:4,c:'#8a3a2a'},{t:'garage',x:3,w:2.6,c:'#8a3a2a'},{t:'window',x:2.4,w:1.4,fl:1,shutters:'#7a4a32'}],balcony:{x:-3,w:4,fl:1,rail:'iron'}}),
  // (Tradição Tecidos fills the corner)

  // ================= WEST SIDE (S) =================
  // --- Marginal → Yolanda Zamai Raimundo
  // the Marmoraria: a cream two-storey block with the name down its corner
  L('S',8,22,{floors:2,wall:'#ece4cc',roof:'flat',parapet:true,open:[{t:'glass',x:-4,w:2,y:0,h:2.4,frame:'#8a8a86'},{t:'window',x:0,w:2,shutters:W},{t:'window',x:3.6,w:2,shutters:W},{t:'window',x:-3,w:1.4,fl:1},{t:'window',x:1,w:2,fl:1}],
    sign:{text:'MARMORARIA',bg:'#e6e2dc',fg:'#5a5a5a',x:-6.4,y:2.6,w:.8,h:3.2}}),
  muro('S',22,28,'#ece4cc',2.6,{front:{h:2.6,c:'#ece4cc',gates:[{t:'door',x:2,w:1.2,c:'#8a3a2a'}]},behind:{w:6,d:8,at:3,roof:'flat',roofColor:'#9aa0a3',wall:'#d8d0c0'}}),
  // the white house behind a tall white wall, a white sheet gate
  L('S',28,40,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:'#ece8e2',gates:[{t:'gate',x:2,w:3.4,c:W},{t:'door',x:-1,w:1,c:W}]}}),
  // the blue-grey corner shed
  L('S',40,45,{wall:'#a8b4c8',roof:'gable',roofColor:'#9aa0a3',open:[]}),
  // --- Yolanda Zamai Raimundo → Dom Antônio J. de Mello
  // the long beige house behind white railings on a beige wall
  L('S',53,60,{wall:'#ddd0bc',roof:'hip',roofColor:T,setback:2,front:{h:1.2,c:'#ddd0bc',rail:{h:.6,c:W,style:'bars'}},open:[{t:'window',x:0,w:2,shutters:W}]}),
  // nº 419 and 409: modern beige houses with white slatted gates
  L('S',60,68,{wall:'#a8968a',roof:'flat',parapet:true,setback:2,front:{h:1.4,c:'#a8968a',rail:{h:.8,c:W,style:'bars'},gates:[{t:'gate',x:-2,w:3,c:W},{t:'gate',x:2.6,w:1.2,c:W}]}}),
  L('S',68,76,{wall:'#ddd0bc',roof:'gable',roofColor:T,setback:2,front:{h:2.2,c:'#ddd0bc',gates:[{t:'gate',x:-.6,w:3.6,c:W},{t:'door',x:2.4,w:1,c:W}]}}),
  // the galvanised shed with green trim
  L('S',76,82,{wall:'#a8a8a6',roof:'gable',roofColor:'#9aa0a3',fascia:'#5ab05a',open:[{t:'garage',x:0,w:4,h:3.4,c:'#8a8c8a'}]}),
  // Martinelli Comunicação Visual and the AMB Art joinery: green-trimmed black front, galvanised doors
  L('S',82,96,{wall:'#1c1c1e',roof:'gable',roofColor:'#9aa0a3',fascia:'#5ab05a',panels:[{x:-6.6,w:.4,c:'#5ab05a'},{x:6.6,w:.4,c:'#5ab05a'}],open:[{t:'door',x:-3,w:2,c:'#2a2a2a'},{t:'garage',x:3,w:5,h:3.4,c:'#8a8c8a'}],
    sign:{text:'MARTINELLI · COMUNICAÇÃO VISUAL',bg:'#1c1c1e',fg:'#5ab05a',x:-3,y:2.8,w:5,h:1}}),
  // the grey house with a sheet gate, crape myrtles in front
  L('S',96,104,{wall:'#a8a49c',roof:'gable',roofColor:'#5a5a58',open:[{t:'gate',x:1.6,w:3.6,c:'#c8c4bc'}]}),
  // the beige house behind a beige wall and grey sheet gate; the grey house with a white garage
  L('S',104,112,{wall:'#e6c8b0',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#ddd0bc',gates:[{t:'gate',x:1.4,w:3.4,c:'#c8c8c4'}]}}),
  L('S',112,120,{wall:'#ddd0bc',roof:'hip',roofColor:T,setback:2,front:{h:2.4,c:'#8a8680',gates:[{t:'garage',x:0,w:3.6,c:'#f2f2f0'}]}}),
  // the green sheet garage, the stained cream wall
  L('S',120,124,{wall:'#5a8a4a',roof:'gable',roofColor:T,open:[{t:'garage',x:0,w:3,c:'#a8b8c8'}]}),
  muro('S',124,132,'#e6d4c0',1.8,{behind:{w:7,d:8,at:3,roofColor:T,wall:'#e6d4c0'}}),
  // the grey house to let (aluga), the blue wall with grey sheet gates, nº 247A
  L('S',132,138,{wall:'#a8a49c',roof:'hip',roofColor:T,open:[{t:'window',x:0,w:2,grille:true,frame:W}]}),
  L('S',138,144,{wall:'#5a7ab0',roof:'gable',roofColor:T,open:[{t:'gate',x:.4,w:3.6,c:'#a8b0b8'}]}),
  // the grey house with a glass double door, a white diagonal gate
  L('S',144,152,{wall:'#a8a49c',roof:'hip',roofColor:T,open:[{t:'gate',x:-3,w:1.2,c:W},{t:'glass',x:0,w:2,y:0,h:2.3,frame:'#3a3a3a'},{t:'window',x:2.6,w:1.6,grille:true}]}),
  // nº 225: the beige house with a grey garage behind a zig-zag wall
  L('S',152,160,{wall:'#e6dcb4',roof:'hip',roofColor:T,setback:1,open:[{t:'garage',x:-1.6,w:3,c:'#a8b0b8'},{t:'door',x:1.4,w:1,c:'#a8b0b8'}]}),
  // the Serralheria Rodrigo: sheet hoarding with its banner, the workshop behind
  muro('S',160,172,'#a8b0b8',2.2,{sign:{text:'SERRALHERIA RODRIGO · REFORMAS · ESTRUTURAS METÁLICAS',bg:'#ffffff',fg:'#2a2a2a',x:0,y:1.6,w:10,h:.8},
    behind:{w:9,d:8,at:3,roof:'flat',roofColor:'#9aa0a3',wall:'#ece4d6'}}),
  // the brick house behind white ornamental fences, a grey brick pier
  L('S',172,180,{wall:'#a85a3a',roof:'hip',roofColor:T,setback:3,front:{h:.4,c:'#a8a49c',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:-2,w:3,c:W}]},open:[{t:'open',x:0,w:4,h:2.3,c:'casa'}]}),
  // the old cream gable with a grey door and a boarded window
  L('S',180,188,{wall:'#ece4c4',roof:'gable',roofColor:'#6a6a68',open:[{t:'door',x:-1.6,w:1,c:'#a8b0b8'},{t:'window',x:1.6,w:1.6,shutters:'#a87a5a'}]}),
  // the precast wall round the corner yard
  muro('S',188,192.4,'#b8b4aa',1.8),
  // --- Dom Antônio J. de Mello → Cel. José Leopoldino
  // the white corner house on a pale green base
  L('S',200.6,212,{wall:'#ece8e2',roof:'hip',roofColor:T,plinth:{h:1,c:'#b8d0a8'},open:[{t:'window',x:-3,w:1.6,shutters:W,grille:true},{t:'window',x:1,w:1.2,frame:W},{t:'window',x:3.6,w:1.6,awning:'#c8c8c4'}]}),
  muro('S',212,218,'#b8b4aa',1.8),
  // nº 246: the white house with a white diagonal gate
  L('S',218,224,{wall:'#ece8e2',roof:'hip',roofColor:T,plinth:{h:.6,c:'#b8d0a8'},open:[{t:'gate',x:-.4,w:3.6,c:W},{t:'window',x:2.4,w:1,shutters:W}]}),
  // the stone-grey sobrado with a glass balcony, a white garage
  L('S',224,236,{floors:2,wall:'#a8a090',roof:'flat',parapet:true,open:[{t:'window',x:-4,w:1,frame:W},{t:'garage',x:-1,w:2.4,c:W},{t:'window',x:2.4,w:1,frame:W},{t:'window',x:4,w:1,frame:W}],balcony:{x:0,w:10,fl:1,rail:'glass'}}),
  // the beige house on a green base
  L('S',236,248,{wall:'#e6d8c0',roof:'hip',roofColor:T,plinth:{h:.6,c:'#7aa86a'},open:[{t:'window',x:-3,w:2,grille:true,frame:W},{t:'window',x:0,w:2,grille:true,frame:W},{t:'window',x:3,w:1.4,frame:W}]}),
  // --- Cel. José Leopoldino → Treze de Maio
  // the beige corner house behind a barred wall with pines
  L('S',255.6,262,{wall:'#e6d8c0',roof:'gable',roofColor:T,setback:2,front:{h:1.2,c:'#e6d8c0',rail:{h:.8,c:'#3a3a3a',style:'bars'}},open:[{t:'window',x:0,w:2,grille:true}]}),
  // nº 197: the grey speckled house with a white porch and white geometric gates
  L('S',262,270,{wall:'#7a8488',roof:'gable',roofColor:T,fascia:W,open:[{t:'window',x:-3,w:1.2,frame:'#6aaa6a'},{t:'open',x:-.6,w:2.6,h:2.3,c:'casa'},{t:'gate',x:2.6,w:3,c:W}]}),
  // the ochre speckled house; the grey-blue speckled house with a green window
  L('S',270,276,{wall:'#d8bc80',roof:'gable',roofColor:T,fascia:W,open:[{t:'window',x:-1,w:1.4,shutters:'#7a8088',frame:W},{t:'gate',x:1.6,w:1.4,c:W}]}),
  L('S',276,282,{wall:'#6a7a8a',roof:'gable',roofColor:T,fascia:W,open:[{t:'window',x:-1,w:1.6,shutters:'#6ab06a',frame:W},{t:'door',x:1.6,w:1,c:W}]}),
  // the old brick wall; nº 181 the ochre house with a white trim
  muro('S',282,286,'#ece4d6',2),
  L('S',286,294,{wall:'#d8bc80',roof:'gable',roofColor:'#9aa0a3',fascia:W,open:[{t:'window',x:-2.4,w:1.6,grille:true,frame:W},{t:'door',x:0,w:1,c:'#a8b0b8'},{t:'window',x:2.4,w:1.4,shutters:'#a8b0b8',frame:W}]}),
  // nº 171: the grey house and its sheet gate
  L('S',294,300,{wall:'#c8c4bc',roof:'gable',roofColor:'#9aa0a3',fascia:W,open:[{t:'window',x:-1,w:1.4,shutters:'#a8b0b8'},{t:'gate',x:1.6,w:2,c:'#a8b0b8'}]}),
  // the pink houses on dark grey block bases, pale blue shutters and garages
  L('S',300,306,{wall:'#ecc8b8',roof:'gable',roofColor:'#9aa0a3',fascia:W,plinth:{h:1,c:'#4a4c50'},open:[{t:'window',x:-1.4,w:1.6,shutters:'#a8b8c8'},{t:'garage',x:1.6,w:2.2,c:'#a8b8c8'}]}),
  L('S',306,312,{wall:'#ecc8b8',roof:'gable',roofColor:'#9aa0a3',fascia:W,plinth:{h:1,c:'#4a4c50'},open:[{t:'door',x:-1.6,w:1,c:'#a8b0b8'},{t:'window',x:1,w:1.6,shutters:'#a8b8c8'}]}),
  // the stone-clad sobrado with red-brown iron balconies over a red garage
  L('S',312,318,{floors:2,wall:'#d8d0c0',roof:'flat',parapet:true,panels:[{x:0,w:6,stone:true,y0:0,y1:2.8}],open:[{t:'garage',x:0,w:4,c:'#8a3a2a'},{t:'door',x:-1.4,w:1,fl:1,c:'#7a3a2a'},{t:'door',x:1.4,w:1,fl:1,c:'#7a3a2a'}],
    balcony:{x:0,w:6,fl:1,rail:'iron'}}),
  // the granite-clad veranda house on the corner, iron fences
  L('S',318,323.6,{wall:'#c8bca8',roof:'gable',roofColor:'#6a3a2a',fascia:'#6a3a2a',setback:2,front:{h:.4,c:'#c8bca8',rail:{h:1.2,c:'#6a3a2a',style:'bars'}},open:[{t:'open',x:0,w:4,h:2.3,c:'casa'}]}),
  // --- Treze de Maio → Romeu Zanetti
  // the corner sobrado on a brick-tile base, a veranda upstairs
  L('S',331.6,340,{floors:2,wall:'#ece4d6',roof:'hip',roofColor:'#9aa0a3',plinth:{h:2.8,c:'#c9895a'},open:[{t:'window',x:-1,w:1.4,frame:W},{t:'garage',x:2.4,w:2,c:'#a8b0b8'}],balcony:{x:-1,w:5,fl:1,rail:'white'}}),
  // nº 125: the veranda house on a brick-tile wall, white railings, a round window
  L('S',340,348,{wall:'#d8c8a8',roof:'flat',fascia:'#ece8e2',eave:1,setback:2,front:{h:1.2,c:'#c9895a',rail:{h:.8,c:W,style:'bars'}},open:[{t:'arch',x:-2,w:1.8},{t:'door',x:.6,w:1.6,c:W},{t:'window',x:3,w:.8,frame:W}]}),
  // nº 150: the salmon house with red garages and red shutters
  L('S',348,356,{wall:'#ecc0a8',roof:'hip',roofColor:T,open:[{t:'garage',x:-3,w:2.4,c:'#a8443a',awning:'#e8dcc8'},{t:'door',x:-.2,w:1,c:'#8a3a2a'},{t:'window',x:2.4,w:2,shutters:'#a8443a'}]}),
  // the pink shops under canvas awnings with dark glass fronts
  L('S',356,364,{wall:'#ecdcdc',roof:'gable',roofColor:'#9aa0a3',fascia:W,open:[{t:'glass',x:-1.6,w:3,y:0,h:2.4,frame:'#1c1c1e',awning:'#d8d0b8'},{t:'window',x:2.2,w:2,awning:'#d8d0b8'}]}),
  L('S',364,370,{wall:'#ecdcdc',roof:'gable',roofColor:'#9aa0a3',fascia:W,open:[{t:'glass',x:.6,w:3,y:0,h:2.4,frame:'#1c1c1e',awning:'#d8d0b8'}]}),
  // the cream wall with a beige garage door and gate
  muro('S',370,380,'#ece4cc',2.2,{front:{h:2.2,c:'#ece4cc',gates:[{t:'gate',x:-2,w:3,c:'#d8c8a8'},{t:'garage',x:2.4,w:3,c:'#d8c8a8'}]},behind:{w:8,d:8,at:3,floors:2,roofColor:'#9aa0a3',wall:'#ece4cc'}}),
  // Medicina e Segurança: the cream corner building, white shutters, a tin hood over the door
  L('S',380,392,{wall:'#ece4cc',roof:'hip',roofColor:'#8a4a32',plinth:{h:1.6,c:'#d8c8a8'},open:[{t:'window',x:-3,w:1.8,shutters:W},{t:'window',x:1.6,w:1.8,shutters:W},{t:'door',x:4,w:1,c:'#3a3a3a',awning:'#c8a870'}],
    sign:{text:'MEDICINA E SEGURANÇA DO TRABALHO',bg:'#ffffff',fg:'#2a3a8a',x:-.6,y:1.8,w:2.4,h:1}}),
  // --- Romeu Zanetti → XV de Novembro (the Posto Taurus on the corner)
  // the black pizzeria: a black brick ground floor, a glass room on top
  L('S',432,444,{floors:2,wall:'#1c1c1e',roof:'flat',parapet:true,open:[{t:'window',x:-3,w:2.4,grille:true,frame:W},{t:'window',x:1.4,w:3,grille:true,frame:W},{t:'glass',x:0,w:10,fl:1,frame:'#1c1c1e'}]}),
  // the black wall with red coping round its car park
  muro('S',444,456,'#1c1c1e',1.8,{panels:[{x:0,w:12,c:'#c83a2a',y0:1.7,y1:1.9}],front:{h:1.8,c:'#1c1c1e',gates:[{t:'gate',x:-2,w:5,c:'#1c1c1e'}]}}),
];

export const TREES:Tree[]=[
  {side:'S',s:98,kind:'reseda'},{side:'S',s:102,kind:'resedaBranca'},{side:'N',s:212,kind:'ficus'},{side:'S',s:266,kind:'ficus'},
  {side:'S',s:298,kind:'ficus'},{side:'N',s:340,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:8,every:34,transformers:[100,300]},
};
