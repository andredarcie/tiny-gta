// Rua Coronel José Leopoldino — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/cjl-N-*/ and cjl-S-*/, kept out of git). The long
// street north of the centre, 1,100 m west→east from the Avenida Marginal to the Lourival
// Medeiros; surveyed so far from the Marginal to s 385 (past the Espírito Santo).
//   s=108 R. João Cabrera   s=230 R. Barão do Rio Branco   s=309 R. Espírito Santo
//   s=415 R. Francisco Pereira de Souza   s=515 R. Joaquim Garcia   s=607 R. Campos Salles
// Asphalt (setts from the Barão eastward). Side 'N' is the north side. Opening x is measured
// from the lot centre as SEEN FROM THE STREET (left negative: on the N side left is west =
// lower s, on the S side left is east = higher s). Lot depth (d + setback) ≤ 12 m. Pure data.
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Coronel José Leopoldino';
export const CROSS=[0,108.1,230.3,308.8,414.7,515,607.3,709.8,820.3,920.3,988.1,1100.3];
const SURFACE:Surface[]=[[0,230.3,'asphalt'],[230.3,1100.3,'sett']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE =================
  // --- Marginal → João Cabrera
  // pink corner house behind its pink wall, a grey sheet gate, a carport under clay tiles
  L('N',13,20,{wall:'#e6c8c0',roof:'gable',roofColor:T,setback:3,front:{h:2,c:'#e6c8c0',gates:[{t:'gate',x:.6,w:3,c:'#9aa8b0'}]},open:[{t:'open',x:-1.6,w:2,h:2.3,c:'casa',awning:T}]}),
  L('N',20,28,{wall:'#e6c8c0',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:'#e6c8c0',rail:{h:1.3,c:'#9aa8b0',style:'bars'},gates:[{t:'gate',x:-2,w:3,c:'#9aa8b0'}]},open:[{t:'window',x:1.4,w:1.6,grille:true}]}),
  // Mengali auto center: dark grey with the tyre board, a big roll door
  L('N',28,44,{floors:2,wall:'#6a6c70',roof:'flat',parapet:true,open:[{t:'garage',x:-3,w:3.4,h:3.6,c:'#c8cacc'},{t:'garage',x:3,w:4.4,h:3.6,c:'#b8bcc0'}],
    sign:{text:'MENGALI AUTO CENTER · ALINHAMENTO · PNEUS',bg:'#1c1c22',fg:'#ffffff',x:0,y:4,w:13,h:1.2}}),
  // pink cottage with a porch and roses behind a low fence
  L('N',44,52,{wall:'#ecd2c4',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',setback:2,front:{h:.6,c:'#ecd2c4',rail:{h:1,c:'#9a7a5a',style:'bars'}},
    open:[{t:'window',x:-1.4,w:1.4,shutters:'#8a5a3a'},{t:'open',x:2,w:2,h:2.2,c:'casa'}]}),
  // the red house behind white iron railings, stone-tile gate pier
  L('N',52,60,{wall:'#b8443a',roof:'gable',roofColor:'#5a4a40',fascia:'#3a3a3a',setback:2,panels:[{x:-3.2,w:1,stone:true}],
    front:{h:.4,c:'#e8e4dc',rail:{h:1.6,c:W,style:'bars'},gates:[{t:'gate',x:1,w:3,c:W}]},open:[{t:'window',x:-1,w:1.6,shutters:W},{t:'open',x:2,w:1.2,h:2.2,c:'casa'}]}),
  // beige house with arched barred windows, white garage doors
  L('N',60,74,{wall:'#ecd8a8',roof:'gable',roofColor:T,fascia:'#ece6d6',
    open:[{t:'garage',x:-5,w:2.6,c:'#f2f2f0'},{t:'arch',x:-1,w:2.2,grille:true},{t:'arch',x:2.6,w:2.2,grille:true}]}),
  // a modern white wall, a white garage gate
  L('N',74,82,{wall:'#ece8e2',roof:'flat',parapet:true,setback:2,front:{h:2.4,c:'#ece8e2',gates:[{t:'garage',x:-1,w:3.6,c:'#f2f2f0'},{t:'door',x:2.6,w:1,c:'#f2f2f0'}]}}),
  // an empty lot with a block house going up behind a precast wall
  muro('N',82,94,'#b8b4aa',1.6,{behind:{w:6,d:8,at:4,floors:2,roof:'flat',roofColor:'#9a958c',wall:'#ece4e0'}}),
  // a timber yard: galvanised shed, open lean-to, stacked planks
  L('N',94,103.6,{wall:'#c9cdd0',roof:'flat',fascia:'#a8aeb2',eave:.6,setback:1,front:{h:1.4,c:'#a8a49c'},open:[{t:'open',x:0,w:6,h:3,c:'casa'}]}),
  // --- João Cabrera → Barão do Rio Branco
  // brick corner houses behind balustrade walls
  L('N',112,126,{wall:'#b5603f',roof:'hip',roofColor:T,fascia:W,setback:2,panels:[{x:3,w:1.2,c:'#6a6a6a'}],front:{h:1,c:'#ece4d0',rail:{h:.1,c:W,style:'bars'}},
    open:[{t:'window',x:-3,w:2.2,frame:W,grille:true},{t:'door',x:0,w:1,c:'#7a4a2e'},{t:'window',x:3,w:1.8,shutters:W}]}),
  L('N',126,134,{wall:'#b5603f',roof:'hip',roofColor:T,fascia:W,setback:2,front:{h:1,c:'#ece4d0',gates:[{t:'gate',x:-2,w:1.2,c:W}]},open:[{t:'window',x:1,w:1.8,shutters:W}]}),
  // nº 144: cream garage block, white garage, stone-clad wall with bars
  L('N',134,142,{wall:'#ece4c8',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:3,c:'#f2f2f0'}]}),
  L('N',142,152,{wall:'#ece4d6',roof:'hip',roofColor:'#d8c8a8',setback:3,front:{h:.8,c:'#c8a97c',style:'stone',rail:{h:1.2,c:'#3a3a3a',style:'bars'}},open:[{t:'open',x:0,w:6,h:2.3,c:'casa'}]}),
  // the big stone wall, a white gate; the house behind it
  muro('N',152,162,'#c8a97c',2.4,{front:{h:2.4,c:'#c8a97c',style:'stone',gates:[{t:'gate',x:3,w:3,c:W}]},behind:{w:9,d:9,at:3,roofColor:T,wall:'#ecd8b8'}}),
  // nº 169: lime house, grey shutters, tiled carport behind grey bars
  L('N',162,170,{wall:'#c8d48a',roof:'hip',roofColor:T,open:[{t:'window',x:-1.6,w:2.4,shutters:'#6a7078'},{t:'gate',x:2.2,w:2.6,c:'#7a8088',awning:T}]}),
  // pink house behind a pink wall, grey sheet gate
  L('N',170,180,{wall:'#ecd2cc',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#ecd2cc',gates:[{t:'gate',x:1.6,w:3.2,c:'#a8b0b6'}]},open:[{t:'window',x:-2,w:1.6,shutters:'#5a5c60'}]}),
  // beige house, orange tile base, a barred carport
  L('N',180,190,{wall:'#ecdcc0',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.2,c:'#d0783a'},open:[{t:'gate',x:-2,w:3,c:'#9aa0a3'},{t:'window',x:2.4,w:1,frame:W}]}),
  // stone-pillared fences with grey bars round tiled porches
  L('N',190,198,{wall:'#ece6da',roof:'hip',roofColor:T,setback:3,front:{h:.8,c:'#b8a284',style:'stone',rail:{h:1.2,c:'#9aa0a3',style:'bars'},gates:[{t:'gate',x:-1,w:3,c:'#9aa8b8'}]},
    open:[{t:'open',x:1,w:4,h:2.3,c:'casa'}]}),
  L('N',198,206,{wall:'#ece6da',roof:'hip',roofColor:T,setback:3,front:{h:.8,c:'#b8a284',style:'stone',rail:{h:1.2,c:'#9aa0a3',style:'bars'},gates:[{t:'gate',x:1,w:1.2,c:'#9aa8b8'}]},
    open:[{t:'open',x:-1,w:4,h:2.3,c:'casa'}]}),
  // nº 213: old cream house, brown shutters, a corner porch
  L('N',206,214,{wall:'#ecdcc8',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',open:[{t:'window',x:-1.4,w:1.8,shutters:'#8a5a3a'},{t:'open',x:2,w:2,h:2.2,c:'casa'}]}),
  // a brown sheet gate in a block wall; the old whitewashed corner house
  muro('N',214,220,'#a8a49c',2.2,{front:{h:2.2,c:'#a8a49c',gates:[{t:'gate',x:0,w:3,c:'#8a6a4a'}]}}),
  L('N',220,226.4,{wall:'#e6ecea',roof:'hip',roofColor:'#8e4632',open:[{t:'window',x:0,w:1.2,shutters:'#6a8aaa'}]}),
  // --- Barão do Rio Branco → Espírito Santo
  // the beige corner house with an arched veranda and red brick panels behind white railings
  L('N',234.4,252,{wall:'#ecd8b0',roof:'hip',roofColor:T,setback:2,panels:[{x:-4,w:2,c:'#b5603f'},{x:2,w:2,c:'#b5603f'}],front:{h:.4,c:'#e8e4dc',rail:{h:1.3,c:W,style:'bars'}},
    open:[{t:'arch',x:-5,w:3,h:2.4,y:0},{t:'arch',x:-1,w:3,h:2.4,y:0},{t:'arch',x:4,w:4,h:2.4,y:0}]}),
  // a beige wall, a white sheet gate
  muro('N',252,258,'#c8a888',2.2,{front:{h:2.2,c:'#c8a888',gates:[{t:'gate',x:0,w:3,c:W}]}}),
  // nº 251: green house with a carport behind a low wall
  L('N',258,266,{wall:'#c8d8b0',roof:'gable',roofColor:'#8a8a86',fascia:W,setback:2,front:{h:1.2,c:'#c8d8b0'},open:[{t:'open',x:-1.4,w:3,h:2.3,c:'casa'},{t:'window',x:2.4,w:1.4,frame:W}]}),
  // nº 257: beige house, a carport behind white bars
  L('N',266,274,{wall:'#ece0c8',roof:'gable',roofColor:'#6a6a68',fascia:'#6a6a68',setback:2,front:{h:1.4,c:'#ece0c8',gates:[{t:'gate',x:1,w:3,c:W}]},open:[{t:'window',x:-2,w:1.6,shutters:'#6a7078'}]}),
  // the red-brick house behind a block wall and grey sheet gate, a sobrado going up beside it
  L('N',274,282,{wall:'#b84a3a',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#a8a49c',gates:[{t:'gate',x:1,w:3.4,c:'#a8b0b6'}]}}),
  L('N',282,290,{floors:2,wall:'#9a958c',roof:'flat',fascia:'#9a958c',eave:.2,panels:[{x:-2,w:2,c:'#b5603f',y0:0,y1:5.8}],open:[{t:'open',x:1,w:3,h:2.6,c:'casa'}]}),
  // nº 293: brick-tile house, glass-block windows, beige garage door
  L('N',290,298,{wall:'#c9895a',roof:'hip',roofColor:T,open:[{t:'window',x:-2.4,w:2,frame:W},{t:'door',x:.4,w:1,c:'#d8c8a8'},{t:'garage',x:2.6,w:2.6,c:'#d8c8a8'}]}),
  // a small beige cottage behind black bars, the white side wall to the corner
  L('N',298,305,{wall:'#ece4d0',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',setback:3,front:{h:.3,c:'#ece4d0',rail:{h:1.4,c:'#2a2a2a',style:'bars'}},
    open:[{t:'window',x:-1.4,w:1.6,shutters:'#7a4a2e'},{t:'glass',x:1.6,w:1.8,y:0,h:2.2,frame:'#2a2a2a'}]}),
  // --- Espírito Santo → Francisco Pereira de Souza
  // a long cream wall on the corner
  muro('N',313,324,'#ece6d6',2.4,{behind:{w:9,d:9,at:3,floors:2,roof:'flat',roofColor:'#9a958c',wall:'#e8e4dc'}}),
  // Assembleia de Deus: grey roughcast wall, red iron gates, the name over it
  L('N',324,340,{floors:2,wall:'#8f8c86',upper:'#ece4d6',roof:'flat',parapet:true,setback:2,front:{h:2.6,c:'#8f8c86',gates:[{t:'gate',x:2,w:5,c:'#8a3a2a'},{t:'door',x:-4,w:1,c:'#c89a6a'}]},
    sign:{text:'ASSEMBLEIA DE DEUS',bg:'#ece4d6',fg:'#3a3a3a',x:0,y:4.4,w:8,h:.8}}),
  // grey roughcast house, dark gable, white doors A and B, a stone bench
  L('N',340,356,{wall:'#9a9c9e',roof:'gable',roofColor:'#5a4a40',fascia:'#3a3a3a',setback:2,front:{h:2.4,c:'#9a9c9e',gates:[{t:'garage',x:-4,w:3,c:W,awning:T},{t:'door',x:0,w:1,c:W,awning:T},{t:'door',x:4,w:1,c:W,awning:T}]}}),
  // brick house with arched porches behind white ornamental railings
  L('N',356,364,{wall:'#b5603f',roof:'hip',roofColor:T,setback:2.5,front:{h:.4,c:'#e8e4dc',rail:{h:1.6,c:W,style:'bars'}},open:[{t:'arch',x:-1,w:3,h:2.3,y:0},{t:'arch',x:2.4,w:2,h:2.3,y:0}]}),
  // Fit Paula Ness: dark grey brick-tile front, an awning over the door
  L('N',364,374,{wall:'#4a4c50',roof:'flat',parapet:true,open:[{t:'door',x:0,w:1.4,c:'#2a2a2a',awning:'#c8c0b0'},{t:'glass',x:-3,w:2,y:0,h:2.4,frame:'#2a2a2a'}],
    sign:{text:'FIT PAULA NESS',bg:'#1c1c1e',fg:'#f2d21a',x:0,y:2.9,w:3,h:.7}}),
  // nº 385: lime house, grey louvred windows, a barred carport
  L('N',374,386,{wall:'#dcdc9a',roof:'hip',roofColor:T,open:[{t:'window',x:-4,w:2,shutters:'#7a8088'},{t:'window',x:-1,w:2,grille:true},{t:'gate',x:3.4,w:3.2,c:'#9aa0a3'}]}),

  // ================= SOUTH SIDE =================
  // --- Marginal → João Cabrera: empty lots behind precast walls, a red sheet gate
  muro('S',8,22,'#b8b4aa',1.6),
  muro('S',22,30,'#b8b4aa',1.6,{front:{h:1.6,c:'#b8b4aa',gates:[{t:'gate',x:0,w:3,c:'#9a3a2e'}]}}),
  // the Mengali car park block: white, roll doors, a white door
  L('S',30,40,{floors:2,wall:'#ece6de',roof:'flat',parapet:true,open:[{t:'garage',x:-2,w:3.6,h:3,c:'#c8cacc'},{t:'door',x:2.6,w:1,c:W}]}),
  L('S',40,52,{floors:2,wall:'#ece6de',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:6,h:3.2,c:'#c8cacc'},{t:'door',x:-4.4,w:1,c:W}],
    sign:{text:'MENGALI',bg:'#1c1c1e',fg:'#ffffff',x:-3,y:2.6,w:1.6,h:.8}}),
  // modern beige house, white gates
  L('S',52,60,{wall:'#ece4d6',roof:'hip',roofColor:T,setback:1,open:[{t:'gate',x:-2,w:3,c:W},{t:'garage',x:2,w:2.8,c:W}]}),
  // a roughcast wall with clay coping round the houses behind, a grey gate
  muro('S',60,68,'#9a958c',2,{behind:{w:7,d:8,at:3,roofColor:T,wall:'#ece6da'}}),
  muro('S',68,76,'#9a958c',2,{front:{h:2,c:'#9a958c',gates:[{t:'gate',x:-1,w:3,c:'#9aa8b8'}]}}),
  // a vegetable plot and empty lots behind black screen fences
  muro('S',76,90,'#b8b4aa',.4,{front:{h:.4,c:'#b8b4aa',rail:{h:1.6,c:'#2a2a2c',style:'lattice'}}}),
  muro('S',90,104,'#b8b4aa',.4,{front:{h:.4,c:'#b8b4aa',rail:{h:1.6,c:'#2a2a2c',style:'lattice'}}}),
  // --- João Cabrera → Barão do Rio Branco
  // old block workshops behind precast walls
  muro('S',112,124,'#b8b4aa',1.8,{behind:{w:9,d:8,at:3,roof:'flat',roofColor:'#9a958c',wall:'#c8b49a'}}),
  muro('S',124,140,'#b8b4aa',1.8,{front:{h:1.8,c:'#b8b4aa',gates:[{t:'gate',x:2,w:3,c:'#c8cacc'}]},behind:{w:10,d:8,at:3,roof:'flat',roofColor:'#9a958c',wall:'#c8b49a'}}),
  // pink-beige houses on stone-tile bases, grey shutters
  L('S',140,148,{wall:'#e2d4cc',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.2,c:'#c8a888',stone:true},open:[{t:'window',x:0,w:2,shutters:'#6a7078'}]}),
  L('S',148,156,{wall:'#e2d4cc',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.4,c:'#c8a888',stone:true},open:[{t:'open',x:-1,w:2,h:2,y:1.4,c:'casa'},{t:'window',x:2,w:1.8,y:2,shutters:'#6a7078'}]}),
  // a courtyard of little houses behind a dark gate
  L('S',156,166,{wall:'#e6dcd8',roof:'hip',roofColor:T,setback:6,d:5,front:{h:2.2,c:'#e8e4dc',gates:[{t:'gate',x:-3,w:3,c:'#2a2a2a'}]}}),
  // the grey sobrado with two black garages and a balcony
  L('S',166,176,{floors:2,wall:'#cfcfcb',roof:'flat',parapet:true,open:[{t:'garage',x:-2.6,w:3,c:'#1c1c1c'},{t:'gate',x:2.6,w:3,c:'#2a2a2a'},{t:'window',x:0,w:1.6,fl:1}],balcony:{x:0,w:9,fl:1,rail:'iron'}}),
  // grey houses raised over a rough whitewashed retaining wall
  L('S',176,184,{wall:'#a8acb0',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.8,c:'#d8d4ca'},open:[{t:'window',x:0,w:1.4,y:2,shutters:'#6a7078'}]}),
  L('S',184,190,{floors:2,wall:'#c8c8c4',roof:'flat',parapet:true,open:[{t:'gate',x:-1,w:2,c:'#2a2a2a'},{t:'window',x:1,w:1.2,fl:1}],balcony:{x:0,w:4,fl:1,rail:'iron'}}),
  L('S',190,198,{wall:'#a8b0b8',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.6,c:'#d8d4ca'},open:[{t:'door',x:-1.4,w:1,y:1.6,c:'#8a3a2a'},{t:'window',x:1.4,w:1.6,y:2,frame:W}]}),
  // nº 204: pale blue house on its terrace, the yellow sobrado to the corner
  L('S',198,206,{wall:'#c4d0dc',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.6,c:'#d8d4ca'},open:[{t:'window',x:-1.4,w:1.6,y:2,shutters:'#7a8088'},{t:'door',x:1.6,w:1,y:1.6,c:'#8a3a2a'}]}),
  L('S',206,218,{floors:2,wall:'#d8b048',roof:'flat',parapet:true,band:'#c89a3a',open:[{t:'garage',x:3,w:2.8,c:'#7a4a2e'},{t:'window',x:-2,w:2.4,fl:1,frame:'#8a5a3a'},{t:'window',x:2,w:2.4,fl:1,frame:'#8a5a3a'}]}),
  L('S',218,226.4,{floors:2,wall:'#c8b8a4',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:4.4,c:'#f2f2f0'},{t:'glass',x:0,w:5,fl:1}],balcony:{x:0,w:7,fl:1,rail:'glass'}}),
  // --- Barão do Rio Branco → Espírito Santo
  // the old cream corner house, salmon sills, a tall roughcast base
  L('S',234.4,250,{wall:'#ece4d0',roof:'hip',roofColor:T,plinth:{h:1.8,c:'#c8b8a0'},open:[{t:'window',x:-4,w:1.8,y:2.2,grille:true,frame:'#d8906a'},{t:'window',x:0,w:1.6,y:2.2,shutters:W,frame:'#d8906a'},{t:'open',x:4.4,w:2.4,h:2.2,y:1.8,c:'casa'}]}),
  // an old wall with a wooden gate, a brick plinth
  muro('S',250,262,'#a8a49c',2.4,{front:{h:2.4,c:'#a8a49c',gates:[{t:'gate',x:-4,w:1,c:'#6a4a32'}]},behind:{w:8,d:8,at:3,roofColor:T,wall:'#d8c8a8'}}),
  // a white wall with a white sheet gate under a tin roof
  muro('S',262,272,'#ece4d6',2.2,{front:{h:2.2,c:'#ece4d6',gates:[{t:'gate',x:-2.6,w:3,c:'#e8e8e6'}]}}),
  // a beige wall with white gates, a beige sobrado behind; brown base
  muro('S',272,280,'#ddd2c0',2.4,{front:{h:2.4,c:'#ddd2c0',gates:[{t:'gate',x:-2.6,w:1.2,c:W}]},behind:{w:6,d:8,at:3,floors:2,roofColor:T,wall:'#ddd2c0'}}),
  L('S',280,290,{floors:2,wall:'#ddd2c0',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1,c:'#6a3a2a'},setback:3,front:{h:1,c:'#6a3a2a',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:1,w:3.6,c:W}]}}),
  // the long white wall with a blue band to the corner
  muro('S',290,304,'#ece8e2',1.8,{panels:[{x:0,w:14,c:'#3a6ab0',y0:0,y1:.25}],behind:{w:10,d:8,at:3,roofColor:T,wall:'#ece8e2'}}),
  // --- Espírito Santo → Francisco Pereira de Souza
  // grey-speckled corner house, green-framed window, a barred gate
  L('S',313,322,{wall:'#8a9294',roof:'gable',roofColor:T,fascia:W,open:[{t:'window',x:-2.6,w:1.2,frame:'#5aa86a'},{t:'open',x:0,w:2,h:2.3,c:'casa'},{t:'gate',x:3,w:2.6,c:W}]}),
  // nº 198: cream house, dark gable, grey shutters
  L('S',322,330,{wall:'#ece4d0',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',open:[{t:'open',x:2,w:2,h:2.2,c:'casa'},{t:'window',x:-.4,w:1.6,shutters:'#5a5c60'},{t:'window',x:-2.8,w:1.2,shutters:'#5a5c60'}]}),
  // old cream houses on dark grey bases
  L('S',330,342,{wall:'#ece4d0',roof:'hip',roofColor:T,plinth:{h:.6,c:'#7a7a78'},open:[{t:'window',x:-4,w:1.2,grille:true},{t:'window',x:-1,w:1.6,shutters:'#8a5a3a'},{t:'window',x:2,w:1.6,grille:true},{t:'open',x:4.6,w:1.8,h:2.2,c:'casa'}]}),
  L('S',342,350,{wall:'#ece4d0',roof:'hip',roofColor:T,plinth:{h:.6,c:'#7a7a78'},open:[{t:'window',x:-1.4,w:1.6,shutters:'#a8acb0'},{t:'window',x:1.4,w:1.6,grille:true}]}),
  // a precast wall round a green yard; white garages under clay roofs
  muro('S',350,358,'#e8e4dc',2),
  L('S',358,366,{wall:'#ece8e2',roof:'gable',roofColor:T,open:[{t:'garage',x:0,w:3.6,c:'#a8b4c0'}]}),
  L('S',366,374,{wall:'#ece8e2',roof:'gable',roofColor:T,open:[{t:'garage',x:1,w:3.6,c:'#a8b4c0'}]}),
  // a rough white wall, a beige house with a brick-pillared veranda behind red bars
  muro('S',374,382,'#ece8e2',2,{front:{h:2,c:'#ece8e2',gates:[{t:'gate',x:3,w:1.2,c:'#a8b4c0'}]}}),
];

export const TREES:Tree[]=[
  {side:'N',s:8,kind:'palmeira'},{side:'S',s:228,kind:'ficus'},{side:'S',s:296,kind:'ficus'},{side:'S',s:304,kind:'ficus'},
  {side:'N',s:236,kind:'reseda'},{side:'N',s:248,kind:'reseda'},{side:'N',s:360,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:12,every:34,transformers:[120,300]},
};

