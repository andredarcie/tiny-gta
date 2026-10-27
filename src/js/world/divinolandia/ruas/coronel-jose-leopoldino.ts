// Rua Coronel José Leopoldino — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/cjl-N-*/ and cjl-S-*/, kept out of git). The long
// street north of the centre, 1,100 m west→east from the Avenida Marginal to the Lourival
// Medeiros; surveyed its whole length.
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

  // nº 413: long white house raised over a low wall, barred windows; its neighbour behind a rough wall
  L('N',386,400,{wall:'#ece8e2',roof:'hip',roofColor:T,plinth:{h:.9,c:'#d8d4ca'},open:[{t:'window',x:-3.6,w:2.2,y:1.2,grille:true},{t:'window',x:1,w:2.2,y:1.2,grille:true},{t:'window',x:4.6,w:1.4,y:1.2,shutters:'#8a8a5a'}]}),
  L('N',400,410.6,{wall:'#e6d8bc',roof:'hip',roofColor:T,setback:2,front:{h:1.2,c:'#d8c8a8'},open:[{t:'window',x:-2,w:1.6,shutters:'#7a8088'},{t:'window',x:2,w:1.6,grille:true}]}),
  // --- Francisco Pereira de Souza → Joaquim Garcia
  // the arched pink-and-brown corner house, a flowering ixora behind its iron fence
  L('N',419,432,{wall:'#e6c8bc',roof:'hip',roofColor:T,setback:2,panels:[{x:-3,w:1.2,c:'#6a3a2a'}],front:{h:.4,c:'#c8a888',rail:{h:1.5,c:'#3a2a24',style:'bars'}},
    open:[{t:'arch',x:-1,w:3,h:2.3,y:0},{t:'arch',x:3,w:3,h:2.3,y:0}]}),
  // the pink house and a rough old wall round the telecom tower's yard
  L('N',432,438,{wall:'#ecc8c8',roof:'hip',roofColor:T,open:[{t:'window',x:0,w:1.4,grille:true}]}),
  muro('N',438,446,'#8a7a64',2.2,{front:{h:2.2,c:'#8a7a64',gates:[{t:'gate',x:2,w:3,c:'#a8acb0'}]}}),
  // Hidro Fit (natação, hidroginástica): the blue sheet gates in a grey wall, the pool hall behind
  L('N',446,462,{wall:'#ece8e2',roof:'flat',parapet:true,setback:6,d:6,front:{h:2.4,c:'#d8d4ca',gates:[{t:'gate',x:-3,w:4,c:'#2a4ab0'},{t:'gate',x:2,w:3,c:'#2a4ab0'}]},
    open:[{t:'window',x:-2,w:2,frame:'#2a4ab0'},{t:'window',x:2,w:2,frame:'#2a4ab0'}],sign:{text:'HIDRO FIT · NATAÇÃO',bg:'#ece8e2',fg:'#2a4ab0',x:5,y:1.6,w:2.4,h:.8}}),
  // light-blue house with an arched porch behind grey bars
  L('N',462,474,{wall:'#a8b8d0',roof:'gable',roofColor:'#8a8a86',fascia:W,setback:2,front:{h:.6,c:'#a8b8d0',rail:{h:1.1,c:'#9aa0a3',style:'bars'}},
    open:[{t:'arch',x:-2,w:2.4,h:2.2,y:0},{t:'window',x:2,w:1.8,shutters:W}]}),
  // a grey wall, a breeze-block screen and crotons, the modern grey house behind
  L('N',474,486,{wall:'#a8a49c',roof:'hip',roofColor:'#c8b8a0',setback:3,front:{h:2.4,c:'#a8a49c',gates:[{t:'gate',x:-4,w:3,c:'#e8e4dc'}]},panels:[{x:2,w:3,c:'#e8e4dc'}]}),
  L('N',486,496,{wall:'#a8a49c',roof:'flat',parapet:true,setback:1,open:[{t:'door',x:-1,w:1.2,c:'#e8e4dc'},{t:'window',x:2,w:1.4,grille:true}]}),
  // the grey speckled corner house, a barred carport
  L('N',496,510,{wall:'#8f9496',roof:'hip',roofColor:T,setback:1,open:[{t:'window',x:-3,w:1.8,frame:W},{t:'open',x:2.6,w:3.6,h:2.3,c:'casa'}]}),
  // --- Joaquim Garcia → Campos Salles
  // grey-speckled house with white walls and gates on the corner
  L('N',520.4,530,{wall:'#9aa0a4',roof:'hip',roofColor:T,setback:3,front:{h:1.2,c:'#ece8e2',rail:{h:.8,c:W,style:'bars'},gates:[{t:'gate',x:3,w:3,c:W}]},open:[{t:'window',x:-2,w:1.6,frame:W}]}),
  // beige house, a dark window and a white barred door
  L('N',530,538,{wall:'#ece4d6',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',open:[{t:'door',x:-2.6,w:1,c:W},{t:'window',x:1,w:2,frame:'#3a3a3a'}]}),
  L('N',538,546,{wall:'#ece4d6',roof:'hip',roofColor:T,plinth:{h:.8,c:'#7a7a78'},open:[{t:'window',x:-2,w:1.4,shutters:W},{t:'door',x:.6,w:1,c:'#6a6a6a'},{t:'window',x:2.6,w:1.6,shutters:'#7a8088'}]}),
  // a carport behind grey bars, a grey sheet gate
  L('N',546,554,{wall:'#ece0c8',roof:'hip',roofColor:T,setback:2,front:{h:.4,c:'#ece0c8',rail:{h:1.6,c:'#9aa0a3',style:'bars'},gates:[{t:'gate',x:1.6,w:3,c:'#9aa0a3'}]},open:[{t:'open',x:0,w:4,h:2.3,c:'casa'}]}),
  // the old carpenter's workshop: a flat-roofed shop with a fading mural, then a yard of
  // timber in front of a gable shed with a blue door
  L('N',554,564,{wall:'#d8c8a0',roof:'flat',fascia:'#8a7a64',eave:.3,open:[{t:'open',x:-2,w:3.6,h:2.6,c:'casa'},{t:'window',x:2.6,w:2.2,shutters:'#8a6a4a'}]}),
  L('N',564,578,{wall:'#d8c8a0',roof:'gable',roofColor:T,setback:7,d:5,front:{h:.2,c:'#8a7a64'},open:[{t:'garage',x:0,w:3,c:'#2a6ab0'}]}),
  // nº 621: an old cream front, two brown roll doors and a red ornamental gate
  L('N',578,588,{wall:'#e6e2c8',roof:'gable',roofColor:'#8a4a32',open:[{t:'garage',x:-3,w:2.6,c:'#8a4030'},{t:'garage',x:.4,w:2.6,c:'#8a4030'},{t:'gate',x:3.6,w:2.4,c:'#6a2a24'}]}),
  // the grey speckled sobrado with green trim, a roll door, a balcony above
  L('N',588,600,{floors:2,wall:'#a8a49a',roof:'flat',parapet:true,band:'#7ab098',open:[{t:'garage',x:-3,w:3,c:'#c8c0a8'},{t:'window',x:1.4,w:2.4,frame:'#7ab098',grille:true},{t:'door',x:4.6,w:.9,c:'#c8c8c4'}],
    balcony:{x:0,w:12,fl:1,rail:'iron'}}),
  // --- Campos Salles → Bernadino Franchi
  // the old cream corner house behind its rough stone wall, a brown gate
  L('N',611,626,{wall:'#ece8e0',roof:'hip',roofColor:'#8a4a32',setback:3,front:{h:1.6,c:'#6a5a4a',style:'stone',gates:[{t:'gate',x:3,w:1.4,c:'#8a3a2a'}]},
    open:[{t:'door',x:-2,w:1,c:'#8a5a3a'},{t:'window',x:2,w:2.2,grille:true}]}),
  // the pink sobrado over its open garage, green sheet door, an iron balcony with plants
  L('N',626,636,{floors:2,wall:'#d8a898',upper:'#ece4d6',roof:'flat',parapet:true,open:[{t:'open',x:-1,w:5,h:2.6,c:'casa'},{t:'garage',x:3.2,w:2.4,c:'#3a7a4a'}],balcony:{x:0,w:9,fl:1,rail:'iron'}}),
  // the brown-stone cottage with arched windows behind a cream wall
  L('N',636,646,{wall:'#7a6a5a',roof:'gable',roofColor:'#8a4a32',fascia:W,setback:2,front:{h:1.6,c:'#ece0c8',gates:[{t:'gate',x:-1,w:1,c:W}]},open:[{t:'arch',x:-2.6,w:2.6,grille:true},{t:'arch',x:2.4,w:2.6,grille:true}]}),
  // modern white wall with a black garage gate; nº 689 in beige
  L('N',646,652,{wall:'#ece8e2',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:4,c:'#2a2a2c'}]}),
  L('N',652,658,{wall:'#c8a870',roof:'flat',parapet:true,setback:1,panels:[{x:-2,w:.4,c:'#ece8e2'}],open:[{t:'gate',x:1,w:3,c:'#2a2a2c'}]}),
  // a green-speckled ground floor with a brick upper storey, a grey garage under a tin awning
  L('N',658,668,{floors:2,wall:'#5a9a5a',upper:'#b5603f',roof:'flat',parapet:true,open:[{t:'window',x:-2.6,w:2.4,frame:W,grille:true},{t:'garage',x:1.6,w:3,c:'#c8cacc',awning:'#9aa0a3'},{t:'door',x:4,w:.9,c:W}]}),
  // the bakery: orange awning and orange gates, a slatted roof terrace
  L('N',668,680,{wall:'#9a8a7a',roof:'flat',parapet:true,open:[{t:'gate',x:-3,w:3.4,c:'#d8682a'},{t:'open',x:2.4,w:5,h:2.5,c:'casa',awning:'#d8682a'}],
    sign:{text:'PADARIA',bg:'#d8682a',fg:'#ffffff',x:2.4,y:2.7,w:3,h:.5}}),
  // the stone-clad house with green windows and a green roll door
  L('N',680,688,{wall:'#b8aa94',roof:'gable',roofColor:'#8a4a32',panels:[{x:0,w:8,stone:true}],open:[{t:'window',x:-1.8,w:2,frame:'#7ab098'},{t:'garage',x:1.8,w:3,c:'#9ad0b8'}]}),
  // --- Bernadino Franchi → Anibal Franchi (Mãe Rainha on the corner before)
  // beige corner house behind its wall
  L('N',714,724,{wall:'#e6d8c0',roof:'hip',roofColor:'#8a4a32',setback:3,front:{h:2,c:'#e6d8c0'}}),
  // a beige wall, a white sheet gate, the house behind
  muro('N',724,732,'#d8c8a8',2,{front:{h:2,c:'#d8c8a8',gates:[{t:'gate',x:.6,w:3.6,c:'#e8e8e6'}]},behind:{w:7,d:8,at:3,roofColor:'#8a4a32',wall:'#e6d8c0'}}),
  // nº 811: beige house, glass-block corners, a tiled carport with a cream gate
  L('N',732,746,{wall:'#ddc8a8',roof:'hip',roofColor:T,open:[{t:'gate',x:-3.6,w:3.6,c:'#e6dcc8',awning:T},{t:'window',x:1,w:1,frame:W},{t:'window',x:4,w:2.2,shutters:'#e8e4dc'}]}),
  // white walls and white sheet gates, the new houses with light roofs behind
  muro('N',746,754,'#ece8e2',2.4,{front:{h:2.4,c:'#ece8e2',gates:[{t:'gate',x:-1,w:3,c:'#e8e8e6'}]},behind:{w:7,d:8,at:3,roofColor:'#d8c8a8',wall:'#ece8e2'}}),
  muro('N',754,762,'#ece8e2',2.4,{front:{h:2.4,c:'#ece8e2',gates:[{t:'gate',x:-1,w:3.4,c:'#e8e8e6'}]},behind:{w:7,d:8,at:3,roofColor:'#d8c8a8',wall:'#ece8e2'}}),
  // grey-trimmed white houses, a barred carport
  L('N',762,770,{wall:'#ece8e2',roof:'hip',roofColor:T,band:'#8a8c8e',open:[{t:'window',x:-2.6,w:1.4,shutters:W,frame:'#7a7c80'},{t:'window',x:0,w:1.8,grille:true,frame:'#7a7c80'},{t:'gate',x:2.8,w:2.6,c:W}]}),
  L('N',770,776,{wall:'#ece8e2',roof:'hip',roofColor:T,open:[{t:'gate',x:0,w:3,c:W}]}),
  // the grey stone-tile house with a pale blue band, white French windows behind white railings
  L('N',776,788,{wall:'#8a8c8e',roof:'hip',roofColor:T,plinth:{h:.6,c:'#7ab0b8'},setback:2,front:{h:.6,c:'#7ab0b8',rail:{h:.9,c:W,style:'bars'}},
    open:[{t:'glass',x:-3,w:2.6,y:0,h:2.4,frame:W},{t:'door',x:0,w:1,c:W},{t:'glass',x:3,w:2.6,y:0,h:2.4,frame:W}]}),
  // the Amigos e Caprichos petshop in the same stone with a blue frame, a white door
  L('N',788,794,{wall:'#8a8c8e',roof:'hip',roofColor:T,panels:[{x:2.4,w:1.2,c:'#7ab0b8'}],open:[{t:'window',x:-1,w:2,frame:W,grille:true},{t:'door',x:2.4,w:1,c:W}],
    sign:{text:'AMIGOS E CAPRICHOS',bg:'#ffffff',fg:'#3a6a3a',x:-2.2,y:1.2,w:1.4,h:1}}),
  // a red gate in a cream wall
  muro('N',794,798,'#ecdcc0',2.2,{front:{h:2.2,c:'#ecdcc0',gates:[{t:'gate',x:0,w:2.6,c:'#9a3a2e'}]}}),
  // nº 871: the cream house with red-brown louvred shutters over a pink base, a side porch
  L('N',798,810,{wall:'#ece4c8',roof:'hip',roofColor:T,plinth:{h:.4,c:'#c88a80'},open:[{t:'window',x:-3.4,w:2.2,shutters:'#8a3a30'},{t:'window',x:.6,w:3,shutters:'#8a3a30'},{t:'open',x:4.4,w:2,h:2.2,c:'casa'}]}),
  // a brick-tile wall with a white gate; the house on the corner on a stone base, white railings
  muro('N',810,814,'#c9a07a',2.2,{front:{h:2.2,c:'#c9a07a',gates:[{t:'gate',x:0,w:2.6,c:W}]}}),
  L('N',814,816.4,{wall:'#ece4d6',roof:'hip',roofColor:T}),
  // --- Anibal Franchi → Prof. Silvino Ribeiro
  // IAAFA: the sky-blue corner building, a black window and the glass door
  L('N',824.4,836,{wall:'#6a9ad8',roof:'hip',roofColor:T,open:[{t:'window',x:-3,w:2.4,frame:'#2a2a2a'},{t:'glass',x:1.6,w:1.8,y:0,h:2.4,frame:'#2a2a2a'},{t:'window',x:4,w:1.4,frame:'#2a2a2a'}],
    sign:{text:'IAAFA',bg:'#ffffff',fg:'#3a6a3a',x:-5,y:1.6,w:.8,h:.8}}),
  // nº 989: the lilac house with an arcaded veranda, brown shutters, roses behind an iron fence
  L('N',836,852,{wall:'#d8c8d0',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#a898a8',rail:{h:1,c:'#3a2a2a',style:'bars'},gates:[{t:'gate',x:-6,w:1.4,c:'#3a2a2a'}]},
    open:[{t:'arch',x:-5,w:2.6,h:2.4,y:0},{t:'arch',x:-1.6,w:2.6,h:2.4,y:0},{t:'arch',x:1.8,w:2.6,h:2.4,y:0},{t:'arch',x:5.2,w:2.6,h:2.4,y:0}]}),
  // a brown sheet gate, a white house behind
  muro('N',852,858,'#ece4d6',2.2,{front:{h:2.2,c:'#ece4d6',gates:[{t:'gate',x:0,w:4,c:'#6a4a32'}]},behind:{w:6,d:8,at:3,roofColor:T,wall:'#ece8e2'}}),
  // a grey house with brick panels (for sale), white garage gates
  L('N',858,866,{wall:'#d8d8d4',roof:'gable',roofColor:T,panels:[{x:-3,w:.6,c:'#b5603f'},{x:-1.6,w:.6,c:'#b5603f'}],open:[{t:'window',x:0,w:1.8,shutters:W},{t:'gate',x:2.8,w:2.4,c:W}]}),
  // the beige house on a tiled base, a big glass window, a barred gate
  L('N',866,874,{wall:'#d8bf98',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1,c:'#c8a070'},open:[{t:'gate',x:-3,w:2,c:W},{t:'glass',x:0,w:2.4,frame:W},{t:'window',x:3,w:2,shutters:W}]}),
  // nº 963: dark grey speckled gable with cream trim, a barred carport
  L('N',874,886,{wall:'#3a3c40',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',band:'#d8c8a8',open:[{t:'gate',x:-3.4,w:3.6,c:'#3a3a3a'},{t:'window',x:2.4,w:3,frame:'#d8c8a8'}]}),
  // the modern beige sobrado, glass balcony, white slatted garage gates and a glass front
  L('N',886,898,{floors:2,wall:'#a89078',roof:'flat',parapet:true,open:[{t:'gate',x:-3,w:4,c:W},{t:'glass',x:2.4,w:3.4,y:.3,h:2,frame:'#4a3a2a'}],balcony:{x:-3,w:4,fl:1,rail:'glass'}}),
  // another dark grey speckled house under a tin awning
  L('N',898,906,{wall:'#3a3c40',roof:'gable',roofColor:'#4a4a4a',fascia:'#4a4a4a',band:'#d8c8a8',open:[{t:'window',x:-1.8,w:2,frame:'#d8c8a8'},{t:'window',x:1.8,w:2,shutters:'#5a5c60',frame:'#d8c8a8'}]}),
  // the beige sobrado behind white slatted railings to the corner
  L('N',906,916,{floors:2,wall:'#b8a088',roof:'flat',parapet:true,setback:2,front:{h:1,c:'#b8a088',rail:{h:1.2,c:W,style:'bars'}},open:[{t:'door',x:-3,w:1,c:'#8a3a2a'}]}),
  // --- Prof. Silvino Ribeiro → Padre João Fonte
  // the grey mosaic-tiled corner sobrado, a beige awning over the glass lobby
  L('N',924.4,938,{floors:2,wall:'#9a9aa0',roof:'flat',parapet:true,open:[{t:'glass',x:-2.4,w:5,y:0,h:2.6,frame:'#2a2a2a',awning:'#d8c8b0'},{t:'glass',x:3.6,w:3,y:.6,h:1.8,frame:'#2a2a2a',awning:'#d8c8b0'}],
    balcony:{x:0,w:12,fl:1,rail:'white'}}),
  // a beige sobrado with a carport behind a grey sheet gate
  L('N',938,946,{floors:2,wall:'#ddcfb8',roof:'flat',parapet:true,open:[{t:'gate',x:-1.6,w:2,c:W},{t:'gate',x:1.8,w:3,c:'#a8acb0',awning:'#c8c0b0'}]}),
  // the grey speckled gable house with white trim, its neighbour behind a grey gate
  L('N',946,956,{wall:'#8a908e',roof:'gable',roofColor:'#6a6c70',fascia:W,band:W,open:[{t:'open',x:-3,w:2,h:2.2,c:'casa'},{t:'window',x:0,w:2,grille:true,frame:W},{t:'window',x:3.2,w:2,shutters:'#a8acb0',frame:W}]}),
  L('N',956,964,{wall:'#8a908e',roof:'gable',roofColor:'#6a6c70',fascia:W,open:[{t:'window',x:-1,w:2,shutters:'#a8acb0',frame:W},{t:'gate',x:2.6,w:2,c:'#a8acb0'}]}),
  // nº 1093: the red-speckled gable house, brown shutters
  L('N',964,972,{wall:'#c0503a',roof:'gable',roofColor:'#e8e4dc',fascia:W,band:W,open:[{t:'window',x:-1.8,w:2,shutters:'#a87a4a',frame:W},{t:'window',x:1.8,w:1.6,shutters:'#a87a4a',frame:W}]}),
  // nº 1105: grey speckled gable, a barred carport
  L('N',972,978,{wall:'#7a8a88',roof:'gable',roofColor:'#e8e4dc',fascia:W,band:W,open:[{t:'window',x:-1.4,w:2,grille:true,frame:W},{t:'gate',x:1.6,w:2.6,c:W}]}),
  // the green corner house, brown shutters
  L('N',978,984,{wall:'#8aaa78',roof:'gable',roofColor:'#5a3a2a',fascia:'#c8783a',open:[{t:'window',x:-1,w:1.4,frame:'#8a5a3a'},{t:'window',x:1.6,w:1.4,shutters:'#a8603a'}]}),
  // --- Padre João Fonte → Lourival Medeiros
  // grey houses behind a stone wall and grey bars, palms
  L('N',994.4,1004,{wall:'#a8aaa8',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#6a6c70',rail:{h:1.3,c:'#7a7c80',style:'bars'}},open:[{t:'window',x:-2,w:2,frame:W},{t:'open',x:3,w:3,h:2.3,c:'casa'}]}),
  L('N',1004,1012,{wall:'#a8aaa8',roof:'gable',roofColor:'#5a6068',fascia:W,setback:3,front:{h:.4,c:'#6a6c70',rail:{h:1.4,c:'#7a7c80',style:'bars'}},open:[{t:'window',x:-1.4,w:2,frame:W},{t:'open',x:2,w:2.4,h:2.3,c:'casa'}]}),
  L('N',1012,1020,{wall:'#8a9098',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',open:[{t:'gate',x:-1.6,w:3.4,c:'#e6dcc8'},{t:'window',x:2.4,w:1.8,shutters:'#e6dcc8'}]}),
  // nº 1165 and the beige house on a tiled base with a brown art-deco gate
  L('N',1020,1028,{wall:'#a8a8a6',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',open:[{t:'window',x:-1.4,w:2.2,frame:'#e6dcc8'},{t:'gate',x:2,w:1.6,c:W}]}),
  L('N',1028,1036,{wall:'#d8c8a8',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',plinth:{h:1.2,c:'#a8a49c'},open:[{t:'window',x:-2,w:1.6,grille:true},{t:'gate',x:1.6,w:3,c:'#5a4a3a'}]}),
  // an empty lot with grass
  muro('N',1036,1048,'#b8b4aa',.3),
  // the grey speckled warehouse with two big grey sheet doors
  L('N',1048,1066,{wall:'#8a8c8a',roof:'flat',parapet:true,open:[{t:'garage',x:-5,w:3.4,h:3.2,c:'#9aa8b8'},{t:'garage',x:2,w:6,h:3.4,c:'#9aa8b8'}]}),
  // a house going up behind sheet hoarding, raw brick and stacked blocks
  muro('N',1066,1078,'#c8cacc',2,{behind:{w:8,d:8,at:3,roof:'flat',roofColor:'#9a958c',wall:'#b5603f'}}),
  L('N',1078,1084,{wall:'#a8a8a6',roof:'flat',fascia:'#b5603f',open:[{t:'window',x:-1,w:1.6,grille:true},{t:'open',x:1.6,w:1.8,h:2.2,c:'casa'}]}),
  // the blue-grey bungalow behind its stone wall, grey railings
  L('N',1084,1096,{wall:'#7a8898',roof:'gable',roofColor:'#5a4a40',fascia:W,setback:3,front:{h:1.2,c:'#8a8a86',style:'stone',rail:{h:.8,c:'#b8bcc0',style:'bars'},gates:[{t:'gate',x:4,w:1.4,c:'#8a8a86'}]},
    open:[{t:'window',x:-2,w:2.4,frame:W},{t:'window',x:2,w:2.4,frame:W}]}),
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
  // a long whitewashed wall over a speckled base with white railings, the white house above
  L('S',396,409.6,{wall:'#ece4e0',roof:'hip',roofColor:T,setback:3,front:{h:1.6,c:'#c8c0b4',rail:{h:1.1,c:W,style:'bars'}},
    open:[{t:'window',x:-4,w:1.4,y:1.6,grille:true},{t:'window',x:-1,w:2.2,y:1.6,shutters:W},{t:'window',x:3,w:1.4,y:1.6,grille:true}]}),
  // --- Francisco Pereira de Souza → Joaquim Garcia
  // the corner house with a brick-pillared veranda over a speckled base, white railings
  L('S',419,428,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:2,front:{h:1.6,c:'#c8c0b4',rail:{h:1,c:W,style:'bars'}},panels:[{x:-2,w:.6,c:'#b5603f'},{x:2,w:.6,c:'#b5603f'}],
    open:[{t:'open',x:0,w:6,h:2.2,y:1.6,c:'casa'}]}),
  // the stone-clad sobrado behind a wavy white wall, round topiary, ornamental balcony railings
  L('S',428,444,{floors:2,wall:'#ece8e2',roof:'hip',roofColor:T,plinth:{h:2.8,c:'#c8b49a',stone:true},setback:2,front:{h:1.2,c:'#ece8e2'},
    open:[{t:'window',x:-4,w:1.6,frame:'#3a2a24'},{t:'window',x:-1,w:1.6,frame:'#3a2a24'},{t:'glass',x:3.4,w:3,y:0,h:2.4,frame:'#2a2a2a'},{t:'window',x:-3,w:2.4,fl:1},{t:'window',x:3,w:2.4,fl:1}],
    balcony:{x:0,w:14,fl:1,rail:'white'}}),
  // sobrados over dark brown sheet gates, iron balconies
  L('S',444,452,{floors:2,wall:'#e6e2dc',roof:'gable',roofColor:T,open:[{t:'gate',x:0,w:5,c:'#3a2a24'},{t:'window',x:-1.6,w:1.6,fl:1,frame:'#2a2a2a'},{t:'door',x:1.4,w:1,fl:1,c:'#3a2a24'}],balcony:{x:0,w:7,fl:1,rail:'iron'}}),
  L('S',452,460,{floors:2,wall:'#d8c8a8',roof:'flat',parapet:true,open:[{t:'garage',x:-2,w:2.6,c:W},{t:'door',x:1.6,w:1,c:W}],balcony:{x:0,w:7,fl:1,rail:'white'}}),
  // a green-speckled house under a tin awning, white garages
  L('S',460,468,{floors:2,wall:'#8aa47a',upper:'#ece4d6',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:4,c:W,awning:'#9aa0a3'}],balcony:{x:0,w:7,fl:1,rail:'white'}}),
  // a cream sobrado over a dark red base: a barred garage with a Beetle, a stair up
  L('S',468,478,{floors:2,wall:'#ece4d0',roof:'flat',parapet:true,plinth:{h:1.2,c:'#7a3a2a'},open:[{t:'gate',x:1,w:3,c:'#2a2a2a',awning:'#9aa0a3'},{t:'window',x:-1,w:1.6,fl:1,grille:true},{t:'window',x:2,w:1.6,fl:1,grille:true}]}),
  L('S',478,486,{floors:2,wall:'#d8d0b0',roof:'hip',roofColor:T,plinth:{h:1.6,c:'#8a3a2a'},open:[{t:'garage',x:-1.6,w:2.6,c:'#a8443a'},{t:'open',x:1.6,w:3,h:2.2,y:1.6,fl:1,c:'casa'}]}),
  // stone-clad sobrado with a dark glass balcony, a grey roll door
  L('S',486,498,{floors:2,wall:'#ece8e2',roof:'flat',parapet:true,panels:[{x:0,w:12,stone:true,y0:0,y1:2.9}],open:[{t:'garage',x:0,w:5,c:'#a8a8a6'}],balcony:{x:0,w:10,fl:1,rail:'glass'}}),
  // the brick-tile corner shop under its awning
  L('S',498,510,{floors:2,wall:'#c9895a',roof:'flat',parapet:true,open:[{t:'open',x:-3,w:2.4,h:2.4,c:'casa',awning:'#9aa0a3'},{t:'window',x:1,w:1.6,grille:true},{t:'window',x:-1,w:2.4,fl:1},{t:'window',x:3,w:2.4,fl:1}],
    balcony:{x:0,w:10,fl:1,rail:'iron'}}),
  // --- Joaquim Garcia → Campos Salles (Auto Mais on its stretch)
  // a brick-red wall in front of a small house, the green corner sobrado's yard wall
  muro('S',540,548,'#a8503a',2.2,{behind:{w:6,d:7,at:4,roofColor:T,wall:'#e6d4b6'}}),
  // a furniture workshop: grey ground floor, open bay, white above
  L('S',548,556,{floors:2,wall:'#a8a8a6',upper:'#ece8e2',roof:'flat',parapet:true,open:[{t:'open',x:-1,w:4,h:3,c:'casa'},{t:'window',x:0,w:3,fl:1,grille:true}]}),
  // lilac houses on purple-speckled bases, white louvred doors, white bars
  L('S',556,562,{wall:'#e2d4e0',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:.9,c:'#8a6a8a'},open:[{t:'window',x:-1.4,w:1.6,grille:true},{t:'door',x:1.4,w:1,c:W}]}),
  L('S',562,572,{wall:'#e2d4e0',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:.9,c:'#8a6a8a'},open:[{t:'window',x:-3,w:1.2,grille:true},{t:'window',x:0,w:2,grille:true},{t:'door',x:3.4,w:1,c:W}]}),
  L('S',572,582,{wall:'#e2d4e0',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:.9,c:'#8a6a8a'},open:[{t:'gate',x:-2,w:2.6,c:W},{t:'gate',x:1.6,w:2.4,c:'#2a2a2a'},{t:'window',x:4,w:1.2,grille:true}]}),
  // the brick house with green-trimmed arches behind a green glass fence
  L('S',582,590,{wall:'#a8603a',roof:'hip',roofColor:T,setback:2,front:{h:.3,c:'#a8a49c',rail:{h:1.4,c:'#a8d8c0',style:'bars'}},open:[{t:'arch',x:-2,w:2.6,grille:true,frame:'#7ab098'},{t:'arch',x:2,w:2.2,shutters:'#7a4a2e',frame:'#7ab098'}]}),
  // a cream wall on a grey speckled base, a pale gate, a grey-based corner house
  muro('S',590,596,'#ecd8c8',2,{plinth:{h:1,c:'#8a9494'},front:{h:2,c:'#ecd8c8',gates:[{t:'gate',x:.6,w:3,c:'#c8d0d6'}]}}),
  L('S',596,602.8,{wall:'#ecd8c8',roof:'hip',roofColor:T,plinth:{h:1,c:'#8a9494'},open:[{t:'window',x:-1.6,w:1.4,shutters:'#a8b0b8'},{t:'window',x:1.6,w:1.8,shutters:'#a8b0b8'}]}),
  // --- Campos Salles → Bernadino Franchi
  // the long brick house with white-framed arches round its veranda, iron fence on a grey base
  L('S',611.2,630,{wall:'#a8503a',roof:'hip',roofColor:'#5a3a2a',fascia:'#5a3a2a',setback:3,front:{h:1,c:'#8a9494',rail:{h:1.2,c:'#4a4a4a',style:'bars'}},
    open:[{t:'arch',x:-6,w:2.4,grille:true,frame:W},{t:'arch',x:-2.4,w:2.4,shutters:'#7a8088',frame:W},{t:'arch',x:2,w:3,h:2.4,y:0,frame:W},{t:'arch',x:6,w:3,h:2.4,y:0,frame:W}]}),
  // The Doctor: a blue mechanic's front, the open workshop under a brown awning
  L('S',630,642,{floors:2,wall:'#3a6ab0',upper:'#ecd8c8',roof:'flat',parapet:true,open:[{t:'open',x:2,w:6,h:2.8,c:'casa',awning:'#6a3a2a'},{t:'door',x:-4,w:1,c:'#ecd8c8'}],
    sign:{text:'THE DOCTOR · MECÂNICA',bg:'#3a6ab0',fg:'#ffffff',x:-2,y:2,w:3,h:.7}}),
  // the beige house raised over its white garage
  L('S',642,650,{floors:2,wall:'#ddc8a8',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',open:[{t:'garage',x:0,w:3.6,c:'#f2f2f0'},{t:'window',x:-2,w:1.6,fl:1,frame:W},{t:'door',x:.4,w:1,fl:1,c:W},{t:'window',x:2.4,w:1.6,fl:1,shutters:W}]}),
  // a pale blue wall on a grey base with a rusty sheet gate; empty lots behind precast walls
  muro('S',650,660,'#a8b8d0',2.2,{plinth:{h:1,c:'#8a9494'},front:{h:2.2,c:'#a8b8d0',gates:[{t:'gate',x:-1,w:5,c:'#8a9aa8'}]}}),
  muro('S',660,684,'#b8b4aa',1.6,{front:{h:1.6,c:'#b8b4aa',gates:[{t:'gate',x:-10,w:3.6,c:'#8a9aa8'}]}}),
  // the old cream warehouse with pink pilasters and a pink base, on the corner
  L('S',684,705.4,{wall:'#ece0b0',roof:'hip',roofColor:'#8a4a32',plinth:{h:1.4,c:'#c88a80'},panels:[{x:-6,w:.5,c:'#d8a098'},{x:0,w:.5,c:'#d8a098'},{x:6,w:.5,c:'#d8a098'}],
    open:[{t:'window',x:-3,w:1.4,shutters:'#8a8a86'},{t:'window',x:3,w:1.4,shutters:'#8a8a86'},{t:'garage',x:8,w:2.4,c:'#a87a4a'}]}),
  // --- Bernadino Franchi → Anibal Franchi
  // the brick corner house over a black granite wall
  L('S',714.2,722,{wall:'#a8503a',roof:'hip',roofColor:'#8a4a32',setback:2,front:{h:2,c:'#2a2a2c'}}),
  // grey sobrados with dark wooden garage doors and an iron terrace; the cream art-deco gates
  L('S',722,732,{floors:2,wall:'#a8b0b8',roof:'hip',roofColor:T,setback:0,open:[{t:'garage',x:-1.4,w:3.6,c:'#2a1e1a'},{t:'door',x:1.6,w:1,c:'#2a1e1a'}],balcony:{x:0,w:6,fl:1,rail:'iron'}}),
  L('S',732,740,{wall:'#a8b0b8',roof:'hip',roofColor:T,open:[{t:'gate',x:-1,w:4,c:'#e6dcc8'},{t:'gate',x:2.8,w:1,c:'#e6dcc8'}]}),
  L('S',740,748,{wall:'#a8b0b8',roof:'hip',roofColor:T,plinth:{h:1,c:'#8a9098'},open:[{t:'window',x:-1,w:1.6,grille:true}]}),
  // the olive-green speckled house over a brown base, glass doors
  L('S',748,756,{wall:'#7a8a3a',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:.9,c:'#7a4a3a'},open:[{t:'door',x:-2.6,w:2,c:'#4a3a32'},{t:'window',x:-2.4,w:1.8,y:1.6,frame:W},{t:'window',x:1.4,w:3,frame:W}]}),
  // nº 830: the cream house with red-brown shutters over a red base, a red gate; grey neighbours
  L('S',756,764,{wall:'#ece4d6',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',plinth:{h:1,c:'#a8503a'},open:[{t:'window',x:-2.4,w:1.8,shutters:'#a8503a'},{t:'window',x:.6,w:1.8,shutters:'#a8503a'},{t:'gate',x:3,w:1.6,c:'#a8503a'}]}),
  L('S',764,772,{wall:'#d8d8d4',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.2,c:'#a8a8a6'},open:[{t:'window',x:-2,w:2,frame:'#4a4a4a'},{t:'window',x:1,w:1.4,shutters:'#7a8088'},{t:'door',x:3,w:.9,c:'#7a8088'}]}),
  L('S',772,780,{wall:'#d8d8d4',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.2,c:'#a8a8a6'},open:[{t:'gate',x:-2,w:2.6,c:'#7a8088',awning:T},{t:'window',x:1.8,w:1.8,frame:'#4a4a4a'}]}),
  // an empty lot behind a low wall
  muro('S',780,788,'#b8b4aa',.6),
  // the old cream house with grey glazed doors, a fícus in front
  L('S',788,798,{wall:'#ece4c8',roof:'hip',roofColor:T,open:[{t:'door',x:-3.4,w:1,c:'#8a9098'},{t:'glass',x:-.6,w:2.4,y:0,h:2.3,frame:'#8a9098'},{t:'glass',x:2.6,w:2.4,y:0,h:2.3,frame:'#8a9098'}]}),
  // the cream gable house on an orange tile base, a wooden gate under a tiled hood
  L('S',798,808,{wall:'#ecdcb0',roof:'gable',roofColor:T,plinth:{h:1,c:'#d8784a'},open:[{t:'window',x:-3,w:1,shutters:W},{t:'gate',x:0,w:2.6,c:'#5a4030',awning:T},{t:'window',x:3,w:1,shutters:W}]}),
  // the cream corner house, its veranda with twisted columns on an orange tile base
  L('S',808,816,{wall:'#ecdcb0',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#d8784a'},open:[{t:'open',x:-1.4,w:3.4,h:2.2,y:1.2,c:'casa'},{t:'window',x:2.4,w:1.4,y:1.4,shutters:W}]}),
  // --- Anibal Franchi → Prof. Silvino Ribeiro
  // the yellow corner house over a grey stone base, a veranda
  L('S',825,834,{d:11,wall:'#ece4a0',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#8a9494',stone:true},open:[{t:'window',x:-2.6,w:2.4,frame:W},{t:'open',x:1.6,w:3.4,h:2.2,c:'casa'}]}),
  L('S',834,842,{wall:'#ece4a0',roof:'hip',roofColor:T,plinth:{h:1.6,c:'#8a9494',stone:true},open:[{t:'garage',x:-2.6,w:2,c:'#3a3a3a'},{t:'window',x:0,w:1.8,y:1.8,shutters:'#a8b0b8'},{t:'window',x:2.8,w:1.8,y:1.8,frame:W}]}),
  // the yellow garages with grey sheet doors
  L('S',842,856,{wall:'#ece4a0',roof:'flat',parapet:true,plinth:{h:1.4,c:'#8a9494',stone:true},open:[{t:'garage',x:-4.6,w:2.6,c:'#a8b0b8'},{t:'garage',x:-1,w:2.6,c:'#3a3a3a'},{t:'garage',x:4.4,w:3,c:'#a8b0b8'}]}),
  // a dirt drive, a grey sheet gate between block walls
  muro('S',856,862,'#7a5a4a',1.6,{front:{h:1.6,c:'#7a5a4a',gates:[{t:'gate',x:0,w:3,c:'#c8d0d6'}]}}),
  // the grey veranda house behind white railings on a rough stone wall
  L('S',862,870,{wall:'#a8b0bc',roof:'hip',roofColor:'#6a6c70',setback:2,front:{h:1.2,c:'#7a5a4a',style:'stone',rail:{h:.6,c:W,style:'bars'}},open:[{t:'open',x:0,w:5,h:2.3,c:'casa'}]}),
  // the blue sobrado over two grey garages on a tiled base
  L('S',870,878,{floors:2,wall:'#8aa8d0',roof:'flat',parapet:true,plinth:{h:2.8,c:'#e6dcc0'},open:[{t:'garage',x:-1.8,w:2.8,c:'#a8b0b8'},{t:'garage',x:1.8,w:2.8,c:'#a8b0b8'},{t:'window',x:-1.6,w:2,fl:1,grille:true},{t:'door',x:1.4,w:1,fl:1,c:'#7a8088'}],
    balcony:{x:0,w:7,fl:1,rail:'iron'}}),
  // the dark red cottages raised on a whitewashed retaining wall, steps up
  L('S',878,886,{wall:'#7a2a24',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',band:W,plinth:{h:1.6,c:'#ece8e2'},open:[{t:'window',x:-2,w:1.4,y:1.8,frame:W,grille:true},{t:'window',x:1.4,w:2,y:1.8,frame:W}]}),
  L('S',886,892,{wall:'#7a2a24',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',band:W,plinth:{h:1.6,c:'#ece8e2'},open:[{t:'door',x:-1,w:1,y:1.6,c:'#3a3a3a'},{t:'window',x:1.4,w:1.6,y:1.8,frame:W}]}),
  // the white sobrado over a brown speckled ground floor and brown garage
  L('S',892,900,{floors:2,wall:'#7a5a44',upper:'#ece8e2',roof:'flat',parapet:true,open:[{t:'garage',x:.6,w:3,c:'#7a5a44'},{t:'window',x:-2,w:2,fl:1,grille:true},{t:'window',x:2,w:2,fl:1,grille:true}]}),
  // the granite-clad bar with yellow-framed shopfronts, a terrace above, to the corner
  L('S',900,916,{floors:2,wall:'#c8b4a0',upper:'#ece8e2',roof:'flat',parapet:true,open:[{t:'glass',x:-6,w:2.4,y:0,h:2.6,frame:'#d8b048'},{t:'garage',x:-2,w:3.4,c:'#c8784a'},{t:'glass',x:2,w:2.4,y:0,h:2.4,frame:'#c8784a'},{t:'glass',x:5.6,w:3.2,y:0,h:2.6,frame:'#d8b048'}],
    balcony:{x:0,w:16,fl:1,rail:'iron'}}),
  // --- Prof. Silvino Ribeiro → Padre João Fonte
  // the stone-clad corner shop with its black and red fascia, grey sobrado above
  L('S',924,936,{floors:2,wall:'#5a5a4a',upper:'#c8c8c4',roof:'flat',parapet:true,panels:[{x:0,w:12,stone:true,y0:0,y1:2.9}],open:[{t:'open',x:2,w:3,h:2.6,c:'casa'},{t:'glass',x:-2.6,w:2.4,y:0,h:2.6,frame:'#2a2a2a'}],
    sign:{text:'HD',bg:'#1c1c1e',fg:'#d82a2a',x:0,y:2.7,w:10,h:.6},balcony:{x:-3,w:5,fl:1,rail:'glass'}}),
  // nº 1028: grey-based beige house behind a white sheet gate
  L('S',936,942,{wall:'#ddd0b8',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.2,c:'#8a8c8e'},open:[{t:'window',x:-1.4,w:1.6,frame:'#2a2a2a'},{t:'gate',x:1.4,w:2.6,c:'#e8e8e6'}]}),
  // the stone-clad shop with a glass door under a dark glass balcony
  L('S',942,950,{floors:2,wall:'#c8c0b4',roof:'flat',parapet:true,panels:[{x:0,w:8,stone:true,y0:0,y1:2.9}],open:[{t:'glass',x:-.6,w:2.6,y:0,h:2.6,frame:'#2a2a2a'},{t:'gate',x:2.8,w:1.6,c:'#c8a87a'}],balcony:{x:0,w:7,fl:1,rail:'glass'}}),
  // the grey-based house behind a white sheet gate; the pale blue cottage
  L('S',950,958,{wall:'#ddd8cc',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',plinth:{h:1.2,c:'#8a8c8e'},open:[{t:'gate',x:-2.6,w:2.6,c:'#e8e8e6'},{t:'door',x:0,w:.9,c:W},{t:'window',x:2.4,w:1.6,shutters:W}]}),
  L('S',958,966,{wall:'#a8c4dc',roof:'gable',roofColor:'#4a4a4a',fascia:'#4a4a4a',plinth:{h:.8,c:'#6a6c6a',stone:true},open:[{t:'open',x:-1.4,w:1.8,h:2.2,c:'casa'},{t:'window',x:.8,w:1.2,shutters:'#5a5c60'},{t:'gate',x:3,w:2.4,c:'#e8e8e6'}]}),
  // the brick-block garage with a grey sheet door, blue pilasters
  L('S',966,976,{wall:'#a8503a',roof:'flat',fascia:'#6a8ab0',eave:.3,panels:[{x:-4.6,w:.5,c:'#6a8ab0'},{x:-.8,w:.5,c:'#6a8ab0'}],open:[{t:'garage',x:-2.6,w:3,c:'#c8cacc'},{t:'gate',x:2,w:1.2,c:'#3a3a3a'}]}),
  // the old white corner house over a rough base, a stair up the wall
  L('S',976,984,{wall:'#ece8e2',roof:'hip',roofColor:'#8a4a32',plinth:{h:1.4,c:'#c8c0b4'},open:[{t:'window',x:-1,w:1.6,y:1.6,frame:'#3a3a3a'},{t:'window',x:2,w:1,y:1.8,shutters:'#7a7c80'}]}),
  // --- Padre João Fonte → Lourival Medeiros
  // the peach sobrado over two grey garages
  L('S',991.6,1004,{floors:2,wall:'#ecc8b0',roof:'flat',parapet:true,open:[{t:'garage',x:-3.4,w:3,c:'#a8b0b8'},{t:'door',x:-.2,w:1,c:'#a8b0b8'},{t:'garage',x:3.2,w:3,c:'#a8b0b8'},{t:'window',x:-2,w:2.4,fl:1,shutters:'#8a9098'},{t:'window',x:2.6,w:2.4,fl:1,grille:true}]}),
  // a long whitewashed wall
  muro('S',1004,1012,'#ece8e2',2.6),
  // a grey shop under a pink upper storey (a dark sign over the door), then grey workshops
  L('S',1012,1022,{floors:2,wall:'#9a9c9e',upper:'#d8b8b4',roof:'flat',parapet:true,open:[{t:'window',x:-4,w:1.4,grille:true},{t:'window',x:-1.6,w:1.4,grille:true},{t:'open',x:2.6,w:1.8,h:2.4,c:'casa'},{t:'window',x:0,w:1.8,fl:1,shutters:W}],
    balcony:{x:-3,w:4,fl:1,rail:'white'}}),
  L('S',1022,1030,{wall:'#9a9c9e',roof:'flat',parapet:true,open:[{t:'door',x:-2.4,w:1.6,c:'#6a6c70'},{t:'window',x:0,w:1.4,grille:true},{t:'glass',x:2.4,w:1.4,y:.3,h:2,frame:'#6a6c70'}],balcony:{x:0,w:8,fl:1,rail:'white'}}),
  // a rough pink wall in front of the little houses
  muro('S',1030,1044,'#c88a80',2.2,{behind:{w:8,d:8,at:3,roofColor:'#6a6c70',wall:'#e6d4d0'}}),
  // the green sobrado with the black-and-white striped gate and a diamond on its front
  L('S',1044,1049.4,{floors:2,wall:'#a8d08a',roof:'flat',parapet:true,open:[{t:'window',x:-1.4,w:1.6,frame:'#2a2a2a'},{t:'gate',x:1.2,w:2.4,c:W}],balcony:{x:0,w:5,fl:1,rail:'glass'}}),
  // the dark green speckled cottage, a white door under a little canopy
  L('S',1049.4,1056,{d:7,wall:'#3a7a3a',roof:'flat',parapet:true,open:[{t:'window',x:-1,w:1.6,grille:true,awning:W},{t:'door',x:1.6,w:.9,c:W,awning:W}]}),
  // the navy-blue convenience store to the corner, white roll doors
  L('S',1056,1063,{d:6,floors:2,wall:'#2a3a6a',roof:'flat',parapet:true,open:[{t:'garage',x:-.6,w:3,c:'#f2f2f0'},{t:'window',x:1.6,w:1.2,fl:1,frame:W}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:8,kind:'palmeira'},{side:'S',s:228,kind:'ficus'},{side:'S',s:296,kind:'ficus'},{side:'S',s:304,kind:'ficus'},
  {side:'N',s:236,kind:'reseda'},{side:'N',s:248,kind:'reseda'},{side:'N',s:360,kind:'reseda'},
  {side:'N',s:756,kind:'ficus'},{side:'N',s:778,kind:'ficus'},{side:'S',s:792,kind:'ficus'},{side:'S',s:802,kind:'ficus'},{side:'N',s:996,kind:'palmeira'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:12,every:34,transformers:[120,300]},
  keepOut:[
    {side:'S',s0:380,s1:396,why:'Charme Elegância (comercio/lojas.ts)'},
    {side:'S',s0:519,s1:540,why:'Auto Mais Peças (comercio/lojas.ts)'},
    {side:'N',s0:687,s1:706,why:'Supermercado Mãe Rainha (comercio/lojas.ts)'},
  ],
};

