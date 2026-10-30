// Avenida Marginal do Rio do Peixe — surveyed lot by lot from Google Street View (2024–2026
// imagery; one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/mrp-N-*/ and mrp-S-*/, kept out of git). 1,710 m
// west→east along the river, from the farm track at the west end to the Lourival Medeiros.
//   s=113/119 R. Treze de Maio   s=198 Cel. José Leopoldino   s=247 Dom Antônio J. de Mello
//   s=307 Luis Bianchetti   s=442 João Cabrera   s=572 Barão do Rio Branco   s=663 Espírito Santo
//   s=717 Orfeu E. Fornari   s=766 Francisco Pereira de Souza   s=869 Joaquim Garcia
//   s=953 Campos Salles   s=1060 Bernadino Franchi   s=1120 Rio de Janeiro   s=1178 Anibal Franchi
//   s=1300 Prof. Silvino Ribeiro   s=1392 Padre João Fonte   s=1492 Joaquim Pereira de Souza
//   s=1548 Tv. Luiz de Marco   s=1710 Lourival Medeiros
// Side 'N' is the RIVER side: no houses, a grass bank with the mango trees the street is known
// for, cars parked in their shade, no sidewalk. Side 'S' is the town. West of the Treze de Maio
// the avenue is still a red-earth farm track (the farmhouse with its veranda, the horta under
// shade cloth, chain-link on concrete posts), then empty grass lots to the Leopoldino, then a
// mix of houses, workshops and sheds. Left alone (their own models): the Posto Taurus and the
// Bilica (s 574–660), the long cream building and the checkered-flag workshop (galpoes.ts,
// s 1368–1458), the yard of the Salão de Eventos Beira Rio with the game's prison (s 1596–1672).
// Opening x is measured from the lot centre as SEEN FROM THE STREET (left negative): on the
// south side (S) left is EAST (higher s). Lot depth (d + setback) ≤ 12 m except the farmhouse,
// which stands alone in its yard. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Avenida Marginal do Rio do Peixe';
export const CROSS=[0,113,118.9,198.1,246.8,306.7,442.1,572,662.7,717.3,766.4,868.6,952.9,1060.2,1120.2,1177.6,1300.2,1392.3,1491.8,1547.6,1709.7];
const SURFACE:Surface[]=[[0,100,'dirt'],[100,1709.7,'asphalt']];
const T='#b0603f',W='#f1efe9',OLD='#8a4a32',FIBRE='#a8a8a4',ZINC='#b8bcc0';

const L=(s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side:'S',s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side:'S',s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});
// chain-link on concrete posts, the fence of the farm stretch and the junk yards
const tela=(s0:number,s1:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side:'S',s0,s1,f:{wallOnly:true,wall:'#cfcac0',d:1,front:{h:.15,c:'#cfcac0',rail:{h:1.6,c:'#c8c8c8',style:'arame'}},...extra}});
// precast concrete slab fence (placas pré-moldadas)
const PRE='#cfcbc2';
const placa=(s0:number,s1:number,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side:'S',s0,s1,f:{wallOnly:true,wall:PRE,d:1,front:{h,c:PRE,style:'panel'},...extra}});

export const LOTS:Lot[]=[
  // ================= the farm track (s 0–113, red earth, no sidewalk) =================
  // the little white pump house behind the chain-link, the fence on to the farmhouse
  {side:'S',s0:4,s1:10,f:{wall:'#e8e6e0',roof:'flat',d:2.6,setback:5,front:{h:.15,c:'#cfcac0',rail:{h:1.6,c:'#c8c8c8',style:'arame'}},open:[{t:'window',x:1.4,w:.8,y:1.6,h:.4}]}},
  tela(10,32),
  // the farmhouse well back in its yard: yellow, a hip roof of old tiles over a veranda on
  // white posts all along the front, a brown door, a hammock; a black tarp drying in the yard
  {side:'S',s0:32,s1:57,f:{wall:'#e2c878',roof:'hip',roofColor:OLD,d:11,setback:13,plinth:{h:.4,c:'#b89a5a'},
    front:{h:.15,c:'#cfcac0',rail:{h:1.6,c:'#c8c8c8',style:'arame'},gates:[{t:'gate',x:8,w:3.4,c:W}]},
    open:[{t:'open',x:-4,w:14,h:2.4,c:'casa',awning:OLD},{t:'door',x:-1,w:1,c:'#7a4a2a'},{t:'window',x:-6,w:1.2,shutters:'#7a4a2a'},{t:'window',x:4,w:1.2,shutters:'#7a4a2a'}]}},
  tela(57,66),
  // the plank shed by the gate, a fibre-cement roof
  {side:'S',s0:66,s1:72,f:{wall:'#8a6a4a',roof:'flat',d:3,setback:.6,open:[{t:'door',x:1.6,w:1,c:'#6a4a32'}]}},
  // the horta: rows of greens under black shade cloth on wooden posts, behind the fence
  tela(72,100,{behind:{w:24,d:9,at:2,roof:'flat',roofColor:'#2a2c2a',wall:'#3a3c3a'}}),
  // ================= Treze de Maio → Cel. José Leopoldino: empty grass lots =================
  // the precast fence along the last lot, a red sheet gate in it
  placa(182,194,1.8,{front:{h:1.8,c:PRE,style:'panel',gates:[{t:'gate',x:3,w:2.4,c:'#a8392e'}]}}),
  // ================= Cel. José Leopoldino → Dom Antônio J. de Mello =================
  // the pale corner wall, then the pink house behind its high pink wall with a tiled coping
  muro(205.6,210,'#ecdcd4',2.4),
  L(210.8,228,{wall:'#e8d4cc',roof:'hip',roofColor:T,setback:3,d:7,front:{h:2.2,c:'#e4cfc6'},open:[{t:'window',x:-3,w:1.6,frame:W},{t:'open',x:4,w:5,h:2.3,c:'casa',awning:T}]}),
  // the long beige wall on a green base, a white sobrado over it
  muro(228,237,'#ecd6b8',2.6,{plinth:{h:.3,c:'#3a6a58'},behind:{w:7,d:8,at:3,floors:2,roof:'flat',roofColor:FIBRE,wall:'#ece8e2'}}),
  // nº 02: the brown plank double gate under a tiled hood, a rooftop terrace with a brown rail
  L(237,243,{wall:'#ecd4bc',roof:'flat',parapet:true,plinth:{h:.4,c:'#3a5aa0'},open:[{t:'gate',x:1.2,w:2.8,c:'#7a4a2a',awning:T}]}),
  // ================= Dom Antônio J. de Mello → Luis Bianchetti =================
  // the bare concrete-block wall under a tin lean-to, then the yellow shed on a blue base
  muro(254.6,276,'#a49e94',2.8,{behind:{w:22,d:9,at:1.5,roof:'flat',roofColor:ZINC,wall:'#a49e94'}}),
  L(276,290,{wall:'#e2b440',roof:'gableSide',roofColor:ZINC,plinth:{h:.5,c:'#4a68a8'},open:[{t:'window',x:0,w:2,y:1.8,h:.8,st:'basculante'}]}),
  L(290,303,{wall:'#e2b440',roof:'gableSide',roofColor:ZINC,plinth:{h:.5,c:'#4a68a8'},open:[{t:'garage',x:1,w:4,h:3,c:'#1c2a6a'},{t:'window',x:-4,w:1.2,y:1.4,st:'basculante'}]}),
  // ================= Luis Bianchetti → João Cabrera =================
  // the new white concrete shed: a grey roll door, white louvres high up
  L(319,331,{wall:'#dcdcd8',roof:'flat',parapet:true,open:[{t:'garage',x:3,w:4,h:3.6,c:'#7a7c7e'},{t:'window',x:-3,w:2.2,y:2.6,h:1,st:'basculante',frame:'#e8e8e6'}]}),
  // (s 331–337: a lot under construction, timber scaffolding)
  // the textured white house with an open garage still being finished
  L(337,346,{wall:'#e4e0d8',roof:'gableSide',roofColor:FIBRE,open:[{t:'open',x:-.6,w:5.4,h:2.6,c:'casa'}]}),
  // the beige house, a grey gate under a tiled hood in a textured white wall
  L(346,354,{wall:'#ecdcc4',roof:'hip',roofColor:T,setback:2,front:{h:2.2,c:'#e4e0d8',gates:[{t:'gate',x:1.6,w:3,c:'#a8b0b8',awning:T}]},open:[{t:'window',x:-2,w:1.2,grille:true}]}),
  // the cream house over a high cream wall
  L(354,362,{wall:'#ecdcc4',roof:'hip',roofColor:T,setback:2,front:{h:2.4,c:'#e6d4bc'},open:[{t:'window',x:-2,w:1,frame:'#3a3a3a'},{t:'window',x:0,w:1,frame:'#3a3a3a'},{t:'window',x:2.4,w:1.6,shutters:W}]}),
  // nº 840: the pale pink house, white slatted gate and rail
  L(362,372,{wall:'#ecd8d4',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#e8d4d0',rail:{h:.9,c:W,style:'bars'},gates:[{t:'gate',x:-2.6,w:3.4,c:W}]},open:[{t:'window',x:2,w:1.8,frame:W}]}),
  // the beige wall with a brown garage under a tiled hood and a white gate
  L(372,382,{wall:'#ecdcc4',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#e2d4c0',gates:[{t:'gate',x:0,w:3,c:'#8a3a2a',awning:T},{t:'gate',x:-3.4,w:1.2,c:W}]}}),
  // the stained cream wall on a grey base, a sky-blue house behind it
  L(382,392,{wall:'#8ab4d8',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#ddd4c0'},plinth:{h:.4,c:'#8a8c8e'},open:[{t:'window',x:-1,w:1.6,shutters:'#5a7aa0'}]}),
  // the grey house right on the sidewalk, windows with brown grilles
  L(392,404,{wall:'#a8aaa8',roof:'gableSide',roofColor:T,plinth:{h:.5,c:'#8a8a86'},open:[{t:'window',x:0,w:2.4,grille:true,frame:W},{t:'window',x:-4,w:1.2,grille:true,frame:W}]}),
  // the long grey textured wall, the brick houses behind it (they face the João Cabrera,
  // which runs close behind this stretch)
  L(404,415.6,{wall:'#a8583a',roof:'hip',roofColor:T,setback:4,d:7.5,front:{h:2.2,c:'#b8b8b4'},plinth:{h:.4,c:'#8a8a86'}}),
  muro(416,428,'#b8b8b4',2.2,{plinth:{h:.4,c:'#8a8a86'}}),
  // the tall galvanized sheet gate on the corner
  muro(428,431,'#b8b8b4',2.6,{front:{h:2.6,c:'#b8b8b4',gates:[{t:'gate',x:0,w:2.4,h:2.6,c:'#c8ccd0'}]}}),
  // ================= João Cabrera → Barão do Rio Branco =================
  // the white corner house, a white gate with a big V in its bars
  L(446,452,{wall:'#e8e8ea',roof:'flat',parapet:true,open:[{t:'garage',x:.8,w:3.4,c:W}]}),
  // the beige house with a white wave painted across it, a grilled window, a grey gate
  L(452,460,{floors:2,wall:'#b89a80',roof:'gableSide',roofColor:T,band:W,open:[{t:'window',x:-1.4,w:2.4,grille:true},{t:'garage',x:2.4,w:2.4,c:'#a8b0b8',awning:T}]}),
  // the block wall with a fibre-cement shed behind and a chain-link carport gate
  muro(460,468,'#a49e94',2.4,{front:{h:2.4,c:'#a49e94',gates:[{t:'gate',x:-1.4,w:3.6,c:'#9aa0a0'}]},behind:{w:7,d:6,at:1,roof:'flat',roofColor:FIBRE,wall:'#a49e94'}}),
  // exposed brick and block, a chain-link gate, the unfinished sobrado behind
  L(468,476,{wall:'#ece8e2',roof:'gable',roofColor:T,floors:2,setback:5,front:{h:2.4,c:'#b86a4a',gates:[{t:'gate',x:0,w:3.6,c:'#9aa0a0'}]}}),
  L(476,484,{wall:'#b86a4a',roof:'flat',floors:2,open:[{t:'garage',x:.4,w:3,c:'#b8bcc0'}]}),
  // the long cream speckled wall of a shed (a grey gate at its west end), trees in front
  muro(484,508,'#e2d8c0',2.6,{plinth:{h:.4,c:'#6a645a'},front:{h:2.6,c:'#e2d8c0',gates:[{t:'gate',x:9,w:2.4,c:'#a8b0b8'}]},behind:{w:20,d:10,at:1,roof:'flat',roofColor:FIBRE,wall:'#e2d8c0'}}),
  // the grey gate with an excavator painted on it, a rough concrete wall
  muro(508,516,'#b8b4aa',2.2,{front:{h:2.2,c:'#b8b4aa',gates:[{t:'gate',x:2.4,w:2.4,c:'#5a5c5e'}]}}),
  // MARF: the grey block shed with its banner behind a white block wall, open at the gate
  L(522,548,{wall:'#a8acb0',roof:'gableSide',roofColor:FIBRE,setback:4,front:{h:1.8,c:'#ece8e2',gates:[{t:'gate',x:-5,w:4,c:'#4a4c4e'}]},
    open:[{t:'open',x:-5,w:5,h:3,c:'geral',awning:FIBRE},{t:'open',x:8,w:4,h:3,c:'geral'}],sign:{text:'MARF',bg:'#2a8a3a',fg:W,x:-5,y:3.4,w:4,h:.9}}),
  // the brown sobrado and its garden behind a precast wall
  L(548,556,{floors:2,wall:'#a87a5a',roof:'gable',roofColor:T,setback:4,front:{h:1.6,c:PRE,style:'panel'}}),
  // the old peach house on the corner, a tile roof gone dark, brown shutters
  L(556,566,{wall:'#e0b490',roof:'hip',roofColor:OLD,plinth:{h:.5,c:'#c89070'},open:[{t:'window',x:3,w:1.4,frame:'#2a3a2a'},{t:'window',x:-2,w:1.6,shutters:'#5a3a2a'}]}),
  // ================= Espírito Santo → Orfeu Ermogenes Fornari =================
  // the long peach wall, its plaster peeling, a low planter at its foot; the pink house behind
  L(667.2,679,{wall:'#e8b8a8',roof:'hip',roofColor:T,setback:3,d:7,front:{h:2,c:'#e6cbb8'},open:[{t:'window',x:-2,w:2.4,frame:W},{t:'window',x:3,w:1.2,frame:W}]}),
  L(679,690,{wall:'#e8b8a8',roof:'hip',roofColor:T,setback:3,d:8,front:{h:2,c:'#e6cbb8'},open:[{t:'window',x:0,w:2.4,frame:W,awning:'#3a3c40'}]}),
  // the blue building: a blue storey of windows, then exposed brick framed in blue with blue
  // doors and a blue roll door on the corner
  L(690,700,{floors:2,wall:'#3a78c8',roof:'flat',parapet:true,open:[{t:'window',x:-2,w:1.6,frame:W},{t:'window',x:1,w:1.6,frame:W},{t:'door',x:3,w:1,c:'#2a5aa8'}]}),
  L(700,713,{floors:2,wall:'#c0603a',roof:'flat',parapet:true,plinth:{h:.4,c:'#3a78c8'},panels:[{x:-6.2,w:.5,c:'#3a78c8'},{x:0,w:.5,c:'#3a78c8'},{x:6.2,w:.5,c:'#3a78c8'}],
    open:[{t:'door',x:3.4,w:1,c:'#2a5aa8'},{t:'garage',x:-3,w:3.6,h:3,c:'#2a5aa8'},{t:'window',x:5.2,w:1.6,frame:W}]}),
  // ================= Orfeu Ermogenes Fornari → Francisco Pereira de Souza =================
  // the cream block warehouse, its end wall tarred dark brown
  L(721.8,745,{wall:'#ece0c4',roof:'gableSide',roofColor:ZINC,plinth:{h:.4,c:'#2a2420'}}),
  // the precast wall, a long cream shed with barred windows behind it (the borracharia)
  placa(745,762,2,{behind:{w:15,d:8,at:3,roof:'gableSide',roofColor:FIBRE,wall:'#ece4d0'}}),
  // ================= Francisco Pereira de Souza → Joaquim Garcia =================
  // Mercearia do Pinguim: the mint-green shed with its name painted big in black
  L(771,794,{wall:'#bcd8b0',roof:'gableSide',roofColor:FIBRE,plinth:{h:.3,c:'#8aa080'},open:[{t:'window',x:-2,w:1.2,grille:true},{t:'window',x:4,w:1.2,grille:true}],
    sign:{text:'MERCEARIA DO PINGUIM',bg:'#bcd8b0',fg:'#1c1c1c',x:0,y:1.2,w:14,h:1.1}}),
  // nº 878: the brick-tile clad sobrado, black doors, the upper floor still open
  L(794,803,{floors:2,wall:'#b8603a',upper:'#c8c4bc',roof:'flat',open:[{t:'door',x:2.4,w:2,c:'#1c1c1c'},{t:'door',x:.4,w:.9,c:'#1c1c1c'},{t:'window',x:-2.4,w:1.4,frame:'#2a2a2a'}],balcony:{x:0,w:9,fl:1,rail:'iron'}}),
  // a grey plank gate between brick pillars, the unfinished brick sobrado with a grey garage
  L(803,814,{floors:2,wall:'#b8603a',roof:'flat',setback:1,front:{h:2,c:'#d8ccb4',gates:[{t:'gate',x:3.6,w:2.6,c:'#8a8c8e'}]},open:[{t:'garage',x:-2.4,w:3,c:'#a8b4c0'}]}),
  // nº 956A: the precast fence and its wire gate, a low house back in a yard
  placa(814,822,1.6,{front:{h:1.6,c:PRE,style:'panel',gates:[{t:'gate',x:-1,w:2,c:'#c8c8c8'}]},behind:{w:7,d:7,at:5,roof:'gableSide',roofColor:T,wall:'#c8d4e0'}}),
  // Funilaria e Pintura Rossi (nº 950): the blue wall with the stencilled name, the pink
  // gabled workshop behind
  muro(822,834,'#3a6ab8',2,{sign:{text:'FUNILARIA E PINTURA ROSSI',bg:'#3a6ab8',fg:W,x:0,y:.7,w:10,h:.8},behind:{w:10,d:9,at:3,roof:'gable',roofColor:'#c8a0a0',wall:'#c8d4e0'}}),
  // the white gable house with a brown shutter behind a precast wall
  L(834,844,{wall:'#ece8e2',roof:'gable',roofColor:FIBRE,setback:2,front:{h:1.8,c:PRE,style:'panel'},open:[{t:'window',x:1.6,w:2,grille:true},{t:'window',x:-2.6,w:2,shutters:'#7a3a2a'}]}),
  // two gates under tiled hoods, a cream plank one and a brown sheet one
  L(844,852,{wall:'#ece8e2',roof:'gableSide',roofColor:T,setback:3,front:{h:2,c:'#e6dcbc',gates:[{t:'gate',x:1.6,w:3.4,c:'#e8dcc0',awning:T},{t:'gate',x:-2.4,w:2,c:'#7a3a2a',awning:T}]}}),
  // the yellow-green gable house behind its wall, a cream gate under a tiled hood
  L(852,860,{wall:'#d8dca0',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:1.8,c:'#d8dca0',gates:[{t:'gate',x:-2.6,w:2.4,c:'#e8dcc0',awning:T}]},open:[{t:'window',x:-.8,w:1.4,shutters:'#e8dcc0'},{t:'window',x:1.6,w:1.4,grille:true}]}),
  // the grey gable house with white louvres behind a black iron railing, pots on the ledge
  L(860,863.8,{wall:'#d8d4cc',roof:'gable',roofColor:FIBRE,fascia:W,setback:2,front:{h:.6,c:'#c8a890',rail:{h:1.2,c:'#2a2a2a',style:'bars'}},open:[{t:'window',x:0,w:1.4,shutters:W}]}),
  // ================= Joaquim Garcia → Campos Salles: a row of small houses =================
  // the green speckled corner house, a grey awning over its door
  L(873,882,{wall:'#6a8a7a',roof:'gableSide',roofColor:OLD,plinth:{h:.4,c:'#e4c4b4'},open:[{t:'door',x:0,w:1,c:'#8a5a3a',awning:'#b8b8b8'},{t:'window',x:-3,w:.8,frame:'#e4c4b4'},{t:'window',x:2.6,w:.8,frame:'#e4c4b4'}]}),
  // the green roughcast house under a fibre-cement lean-to
  L(882,888,{wall:'#5a7a6a',roof:'gableSide',roofColor:FIBRE,open:[{t:'window',x:1,w:1.2,frame:'#e4c4b4'}]}),
  // nº 972: the pink house, an iron side gate and a white sheet door
  L(888,897,{wall:'#e4c4b4',roof:'gableSide',roofColor:T,open:[{t:'gate',x:2.6,w:1.4,c:'#3a3a3a'},{t:'door',x:-.2,w:1.4,c:W},{t:'window',x:-3,w:1.6,frame:W}]}),
  // nº 978: the pink house with grey louvres and a grilled door
  L(897,906,{wall:'#e8c8b8',roof:'gableSide',roofColor:T,open:[{t:'window',x:-2.6,w:1.2,shutters:'#8a94a0'},{t:'door',x:0,w:.9,c:'#a8b0b8',grille:true},{t:'window',x:2.4,w:1,frame:W}]}),
  // a brick-clad wall with a white gate, the pink house behind
  L(906,912,{wall:'#e8c8b8',roof:'gableSide',roofColor:T,setback:2,front:{h:2.2,c:'#9a4a32',gates:[{t:'gate',x:-.8,w:2.6,c:W}]}}),
  // the cream house with a white louvred window
  L(912,920,{wall:'#e4d8b8',roof:'gableSide',roofColor:OLD,open:[{t:'window',x:0,w:1.8,shutters:W}]}),
  // the cream house in a tangle of bougainvillea, a grey annex with a wooden gate
  L(920,930,{wall:'#ece8dc',roof:'gableSide',roofColor:OLD,setback:1.5,front:{h:.6,c:'#c8c4bc',gates:[{t:'gate',x:-3,w:1,c:'#a8703a'}]},open:[{t:'window',x:1.4,w:1.4,shutters:'#5a5a5a'}]}),
  // the aqua house with a grilled window
  L(930,940,{wall:'#9ad4cc',roof:'gableSide',roofColor:OLD,open:[{t:'window',x:0,w:1.8,grille:true},{t:'gate',x:3.6,w:2,c:'#8a8c8e'}]}),
  // the blue and turquoise houses, plants in pots by the doors
  L(940,946,{wall:'#7ab0d8',roof:'gableSide',roofColor:FIBRE,open:[{t:'door',x:0,w:1,c:'#8a8c8e'}]}),
  // nº 1012: the pale blue-grey corner house with a barred window
  L(946,947.8,{wall:'#c8d4dc',roof:'gableSide',roofColor:OLD,open:[{t:'window',x:0,w:1,grille:true}]}),
  // ================= Campos Salles → Bernadino Franchi =================
  // the grey house under fibre-cement with grilled windows
  L(957,962,{wall:'#c8c8c4',roof:'gableSide',roofColor:FIBRE,open:[{t:'window',x:0,w:1,grille:true}]}),
  // the grey and beige house with a tile-set panel, a white sheet gate
  L(962,971,{wall:'#c8c4bc',roof:'gable',roofColor:OLD,panels:[{x:-1,w:4,c:'#c8b490',y0:.6,y1:2.6}],open:[{t:'gate',x:3,w:2.6,c:W},{t:'window',x:-3,w:.8,grille:true}]}),
  // nº 1014: the grey house with a white band and white louvres
  L(971,980,{wall:'#8a8c8a',roof:'gableSide',roofColor:T,band:W,open:[{t:'window',x:0,w:1.8,shutters:W},{t:'gate',x:3.4,w:1.6,c:W}]}),
  // the white house behind two blue gates
  L(980,988,{wall:'#e4e2dc',roof:'gableSide',roofColor:T,setback:2,front:{h:1.8,c:'#e4e2dc',gates:[{t:'gate',x:-1,w:1.6,c:'#3a8ac8'},{t:'gate',x:1,w:1.6,c:'#3a8ac8'}]}}),
  // nº 1022: the white house with a grey glazed door, blue gates beside it
  L(988,996,{wall:'#e8e4da',roof:'gableSide',roofColor:T,open:[{t:'window',x:2.4,w:1.2,shutters:'#8a8c8e'},{t:'door',x:.2,w:1,c:'#5a6a7a',grille:true},{t:'window',x:-1.8,w:1.2,grille:true}]}),
  // the block hut under a tin shed, a plank gate, a papaya by it
  L(996,1004,{wall:'#8a8070',roof:'gableSide',roofColor:ZINC,open:[{t:'window',x:-.4,w:1,grille:true},{t:'gate',x:-3,w:1.6,c:'#6a5a4a'}]}),
  // the tin shed with a block front and a galvanized double gate
  L(1004,1022,{wall:'#8a8478',roof:'gableSide',roofColor:ZINC,open:[{t:'garage',x:-3.6,w:6,h:3.2,c:'#c8ccd0'}]}),
  // the junk yard: old trucks under a post-and-tin shed behind chain-link
  tela(1022,1028,{behind:{w:6,d:6,at:2,roof:'flat',roofColor:FIBRE,wall:'#8a6a4a'}}),
  // the pink house with a brown gate under a tiled carport
  L(1028,1034,{wall:'#e0c0c0',roof:'gableSide',roofColor:T,setback:1,front:{h:1,c:'#e0c0c0'},open:[{t:'garage',x:0,w:2.6,c:'#7a3a2a',awning:T}]}),
  // the yellow house, brown shutters, a barred door up three steps
  L(1034,1042,{wall:'#e8d080',roof:'gableSide',roofColor:T,plinth:{h:.6,c:'#c89a5a'},open:[{t:'window',x:-2.4,w:1.6,shutters:'#7a4a2a'},{t:'window',x:1,w:1.6,grille:true},{t:'door',x:3.2,w:.9,c:'#7a4a2a',grille:true}]}),
  // ================= Bernadino Franchi → Rio de Janeiro =================
  // the brown speckled house: brown louvred shutters (its corner is Bernadino Franchi's)
  L(1078,1086,{wall:'#8a7058',roof:'gableSide',roofColor:'#6a5a4a',plinth:{h:.5,c:'#6a5040'},open:[{t:'window',x:-1,w:2,shutters:'#7a4a2a'},{t:'window',x:2.6,w:1.2,grille:true}]}),
  // the brown speckled house behind a precast wall and a rust-red sheet gate
  L(1086,1094,{wall:'#8a7058',roof:'gableSide',roofColor:'#6a5a4a',setback:2,front:{h:2,c:PRE,style:'panel',gates:[{t:'gate',x:3,w:2,c:'#8a3a2a'}]},open:[{t:'window',x:-1,w:1.2,shutters:'#8aa0a8'}]}),
  L(1094,1099,{wall:'#ece8e2',roof:'flat',setback:4,front:{h:2.4,c:PRE,style:'panel',gates:[{t:'gate',x:0,w:3.6,c:'#8a3a2a'}]}}),
  // CHF: the grey two-storey with a band, a roll door and white gates; mosaic sidewalk
  L(1099,1113,{floors:2,wall:'#8f8f8c',roof:'flat',parapet:true,band:'#c8c6c0',open:[{t:'garage',x:-1,w:4.4,h:3,c:'#d8d8d6'},{t:'door',x:3,w:1,c:W},{t:'gate',x:5.4,w:2.2,c:W},{t:'window',x:-4,w:2.6,fl:1,frame:'#2a2a2a'}],
    sign:{text:'CHF',bg:'#ffffff',fg:'#3a8a3a',x:-5.6,y:1.4,w:1.4,h:.8}},'mosaico'),
  // the modern grey corner sobrado: glass balcony, a white garage, a black door
  L(1113,1117,{floors:2,wall:'#8f8f8c',roof:'flat',parapet:true,band:'#c8c6c0',open:[{t:'garage',x:0,w:2.6,c:W}],balcony:{x:0,w:3.6,fl:1,rail:'glass'}},'mosaico'),
  // ================= Rio de Janeiro → Anibal Franchi =================
  // the grey corner house, a white garage in its high curved wall
  L(1126.6,1134,{wall:'#a8aeb0',roof:'gable',roofColor:T,setback:2,front:{h:2.4,c:'#a8aeb0',gates:[{t:'gate',x:1,w:3,c:W}]}}),
  // the dark grey house: a white garage and door under a tiled hood, white louvres
  L(1134,1144,{wall:'#6a6e72',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',open:[{t:'garage',x:0,w:2.8,c:W,awning:T},{t:'door',x:-2.2,w:.9,c:W},{t:'window',x:3.4,w:1.6,shutters:W}]}),
  // the grey house behind a white plank fence
  L(1144,1158,{wall:'#8a9094',roof:'gable',roofColor:'#6a5a4a',setback:2,front:{h:1.8,c:'#ecebe6',style:'panel',gates:[{t:'gate',x:-5,w:2.4,c:W}]},open:[{t:'window',x:-1,w:1.6,frame:W},{t:'window',x:3,w:1.2,shutters:W}]}),
  // the gas depot's grey block wall with its blue-and-teal board, the depot on the corner
  muro(1158,1174,'#c8c8c4',2.6,{sign:{text:'DEPÓSITO DE GÁS',bg:'#2aa89a',fg:W,x:-3,y:1.6,w:6,h:.9},behind:{w:8,d:7,at:3,floors:2,roof:'flat',roofColor:FIBRE,wall:'#d8d0c0'}}),
  // ================= Anibal Franchi → Prof. Silvino Ribeiro =================
  // the corner sobrado clad in wood-look tile, a dark red balcony rail, brown awnings
  L(1187,1200,{floors:2,wall:'#b0806a',upper:'#d8c8b8',roof:'flat',parapet:true,open:[{t:'garage',x:4.6,w:3,c:'#2a2a2a',awning:'#9a6a4a'},{t:'window',x:-1,w:2.2,frame:'#2a2a2a'},{t:'window',x:2.6,w:2.2,grille:true},{t:'door',x:-5,w:1.4,c:'#2a2a2a',awning:'#9a6a4a'}],
    balcony:{x:0,w:18,fl:1,rail:'iron'}}),
  // the hot-pink sobrado over wood-look tile, a brown gate, an iron balcony
  L(1200,1210,{floors:2,wall:'#b08060',upper:'#e86a8a',roof:'flat',parapet:true,open:[{t:'garage',x:1.6,w:3,c:'#9a7a5a'},{t:'door',x:-1,w:.9,c:'#3a2a20'},{t:'window',x:-3,w:1.2,frame:'#2a2a2a'}],balcony:{x:0,w:9,fl:1,rail:'iron'}}),
  // Rudisom, car audio and electrics: the white gabled shed, its black board, grey gates
  L(1210,1222,{wall:'#ecebe8',roof:'gable',roofColor:FIBRE,plinth:{h:.8,c:'#5a3a32'},open:[{t:'open',x:0,w:5,h:2.8,c:'geral'},{t:'gate',x:-3.8,w:2.2,c:'#a8acb0'},{t:'gate',x:3.8,w:2.2,c:'#a8acb0'}],
    sign:{text:'RUDISOM',bg:'#1c1c1c',fg:W,x:0,y:3,w:6.4,h:1}}),
  // a precast wall with a black sliding gate, the little house in the garden behind
  L(1222,1230,{wall:'#ece4d6',roof:'gable',roofColor:T,setback:5,d:6,front:{h:1.8,c:PRE,style:'panel',gates:[{t:'gate',x:1,w:4,c:'#2a2c2e'}]}}),
  // brown pillars and a black iron fence, a garden, the pepper tree
  L(1230,1240,{wall:'#ece4d6',roof:'gableSide',roofColor:T,setback:6,d:6,front:{h:.4,c:'#a87a5a',rail:{h:1.5,c:'#2a2a2a',style:'bars'}}}),
  // the grey sheet gate in a brown plastered wall, a block house behind
  L(1240,1248,{wall:'#a49e94',roof:'gable',roofColor:FIBRE,setback:4,d:6,front:{h:1.6,c:'#a87a5a',gates:[{t:'gate',x:1.6,w:3.2,c:'#b8bcc0'}]}}),
  // the black sheet gate by a brick pillar with a lamp, a grey gate beyond
  L(1248,1256,{wall:'#ece8e2',roof:'gable',roofColor:T,setback:5,d:6,front:{h:2,c:'#b86a4a',gates:[{t:'gate',x:1.4,w:4,c:'#1c1c1e'},{t:'gate',x:-2.8,w:1.4,c:'#b8bcc0'}]}}),
  // the brick-clad wall with lamps and a black gate, the house with a wooden pergola
  L(1256,1266,{wall:'#a87050',roof:'gable',roofColor:'#c8b090',setback:4,d:7,front:{h:2,c:'#a85a3a',gates:[{t:'gate',x:-1,w:4.6,c:'#1c1c1e'}]}}),
  // the house with a tiled porch, brick pillars and black iron gates, solar panels
  L(1266,1274,{wall:'#ecdcc4',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#a85a3a',rail:{h:1.4,c:'#1c1c1e',style:'bars'},gates:[{t:'gate',x:1.6,w:3,c:'#e8e4dc'}]},open:[{t:'open',x:1.6,w:3,h:2.4,c:'casa',awning:T}],x:['heater','dish']}),
  // the beige house: white gates with a round port, a stone base, a pink resedá in front
  L(1274,1282,{wall:'#ecdcc4',roof:'hip',roofColor:T,setback:3,front:{h:.8,c:'#c8a878',style:'stone',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:2,w:3.2,c:W}]},open:[{t:'window',x:-1.4,w:1.4,shutters:'#a8803a'}],x:['ac']}),
  // the grey wall with white decorated gates
  L(1282,1288,{wall:'#a8aeb0',roof:'hip',roofColor:T,setback:2,front:{h:2,c:'#a8aeb0',gates:[{t:'gate',x:-1.4,w:1.4,c:W},{t:'gate',x:1.4,w:2,c:W}]}}),
  // nº 1456: the sky-blue and white house with a red door, a salmon sobrado behind
  L(1288,1296,{wall:'#8ab4e0',roof:'gableSide',roofColor:T,fascia:W,open:[{t:'door',x:-2.4,w:.9,c:'#8a2a2a'},{t:'window',x:1,w:1.4,shutters:'#2a6a4a'}],behind:{w:7,d:6,at:5,floors:2,roof:'flat',roofColor:FIBRE,wall:'#e0a088'}}),
  // ================= Prof. Silvino Ribeiro → Padre João Fonte =================
  // the white corner house behind a low curved wall
  L(1308.4,1314,{wall:'#ecebe6',roof:'gable',roofColor:T,setback:1,front:{h:1,c:'#ecebe6'},open:[{t:'window',x:-2,w:1,shutters:W},{t:'window',x:1,w:1,shutters:W}]}),
  // the white house with a white sheet gate
  L(1314,1324,{wall:'#e6e2da',roof:'gable',roofColor:T,fascia:W,open:[{t:'gate',x:3,w:2.6,c:'#e8e8e6',awning:FIBRE}]}),
  // the workshop: a grey sheet gate in a speckled wall, a sheet gate beside it
  L(1324,1330,{wall:'#d8d0c0',roof:'gableSide',roofColor:ZINC,open:[{t:'garage',x:0,w:3,h:3,c:'#b8bcc0'}]}),
  // the auto workshop: a big speckled shed, open across the front, galvanized leaves
  L(1330,1340,{wall:'#d8d0c0',roof:'gableSide',roofColor:ZINC,open:[{t:'open',x:-.6,w:6,h:3.4,c:'geral'},{t:'gate',x:4,w:1.6,h:3,c:'#c8ccd0'}]}),
  // the dark grey wall, a white door under a tiled hood, the grey house behind
  L(1340,1346,{wall:'#8a9094',roof:'hip',roofColor:T,setback:2,front:{h:2,c:'#5a5e64',gates:[{t:'gate',x:0,w:1,c:W,awning:T}]}}),
  // the grey wall with a white garage door, the green house's carport beside it
  L(1346,1352,{wall:'#8a9094',roof:'gable',roofColor:T,setback:1,front:{h:2,c:'#8a9094',gates:[{t:'gate',x:-.6,w:3,c:W}]}}),
  // the bright green house with grey louvres
  L(1352,1364,{wall:'#5ab43a',roof:'gableSide',roofColor:T,fascia:W,plinth:{h:.5,c:'#d8d4cc'},open:[{t:'window',x:2.4,w:1.6,shutters:'#a8b0b8',frame:W},{t:'window',x:-1.6,w:1.6,grille:true,frame:W}]}),
  // a bare block wall, red at one end
  muro(1364,1368,'#a49e94',2,{panels:[{x:1,w:2,c:'#b83a2a'}]}),
  // ================= Joaquim Pereira de Souza side of the workshops =================
  // the beige wall with a grey sheet gate under a tile coping
  L(1458,1466,{wall:'#ecdcc4',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#e6d8bc',gates:[{t:'gate',x:1,w:3.4,c:'#a8b0b8'}]}}),
  // the beige wall, the grey-blue speckled gable house behind it, a grey gate
  L(1466,1476,{wall:'#9aa4a8',roof:'gable',roofColor:T,fascia:W,setback:3,front:{h:2,c:'#e6d8bc',gates:[{t:'gate',x:-3,w:2.2,c:'#a8b0b8'}]}}),
  // the long yellow-green wall with the green houses behind it, on to the corner
  L(1476,1484,{wall:'#d8dca0',roof:'gable',roofColor:T,setback:3,front:{h:2,c:'#dcdca8'}}),
  L(1484,1488,{wall:'#d8dca0',roof:'gableSide',roofColor:T,setback:3,front:{h:2,c:'#dcdca8',gates:[{t:'gate',x:0,w:1.4,c:'#8a5a3a'}]}}),
  // ================= Joaquim Pereira de Souza → Tv. Luiz de Marco =================
  // the white corner wall with a white gate, the house behind
  L(1497.2,1506,{wall:'#ecebe6',roof:'gable',roofColor:T,setback:3,front:{h:2,c:'#ecebe6',gates:[{t:'gate',x:-3,w:2.4,c:W}]},open:[{t:'window',x:1,w:1.2,shutters:W}]}),
  // the long white house right on the sidewalk, an AC box, white louvres; a pink-striped
  // pillar and a brown gate at its west end
  L(1506,1518,{wall:'#ece8e0',roof:'gableSide',roofColor:T,open:[{t:'window',x:-3.6,w:1.4,shutters:W},{t:'window',x:-1,w:1,frame:W},{t:'window',x:2,w:1.6,frame:W},{t:'gate',x:5,w:1.6,c:'#4a3a2a'}],x:['ac']}),
  // the pink houses behind a pink wall with white stripes, a brown gate
  L(1518,1530,{wall:'#e4c8c8',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#e0c4c4',gates:[{t:'gate',x:1.6,w:3,c:'#4a3a2a'}]},open:[{t:'window',x:-3,w:1.4,grille:true},{t:'window',x:-.4,w:1.4,grille:true}]}),
  L(1530,1540,{wall:'#e4c8c8',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#e0c4c4'},open:[{t:'window',x:-3,w:1.6,grille:true},{t:'window',x:0,w:1.6,grille:true},{t:'window',x:3,w:1.6,grille:true}]}),
  // the high white wall on the corner, a wooden gate, the tiled house behind
  L(1540,1544,{wall:'#ecebe6',roof:'gableSide',roofColor:T,setback:3,front:{h:2.2,c:'#ecebe6',gates:[{t:'gate',x:0,w:1.6,c:'#a8703a'}]}}),
  // ================= Tv. Luiz de Marco → Lourival Medeiros =================
  // the cream corner house, blue louvres and a white iron gate
  L(1554.8,1566,{wall:'#ecdcc4',roof:'gable',roofColor:T,fascia:W,setback:1,front:{h:1.6,c:'#ecebe6',gates:[{t:'gate',x:4,w:2.6,c:W}]},open:[{t:'window',x:-2,w:1.6,shutters:'#5a9ac8'},{t:'window',x:1.6,w:1.6,grille:true}]}),
  // Auto Mecânica Dinâmica: the white wall with the name in red, then the red truck painted
  // on the wall of the yard
  muro(1568,1582,'#ecebe6',2.6,{sign:{text:'AUTO MECÂNICA DINÂMICA',bg:'#ecebe6',fg:'#c8302a',x:0,y:1.4,w:11,h:.8},behind:{w:12,d:8,at:3,roof:'gableSide',roofColor:ZINC,wall:'#c8c4bc'}}),
  muro(1582,1594,'#ecebe6',2.6,{panels:[{x:0,w:5,c:'#c8302a',y0:.6,y1:2.2}]}),
  // the speckled wall with an ochre sheet gate in a teal frame
  L(1674,1682,{wall:'#ecdcc4',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#9a948a',gates:[{t:'gate',x:-.6,w:3.4,c:'#a8883a',awning:'#4a9a8a'}]}}),
  // ochre and grey gates between speckled pillars, the house behind
  L(1682,1690,{wall:'#ecdcc4',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#ece4d6',gates:[{t:'gate',x:2.4,w:2,c:'#a8883a'},{t:'gate',x:-.4,w:1.2,c:'#b8bcc0'},{t:'gate',x:-2.6,w:2.4,c:'#b8bcc0'}]}}),
  // the peach corner house behind a peach wall with a tile coping, brown shutters, a brown gate
  L(1690,1705,{wall:'#ecc0a4',roof:'hip',roofColor:T,setback:2,front:{h:1.6,c:'#ecc4a8',gates:[{t:'gate',x:-5.4,w:2.4,c:'#a8883a'}]},open:[{t:'window',x:-1.6,w:1.6,shutters:'#8a6a3a'},{t:'window',x:2.6,w:1.6,shutters:'#8a6a3a'}]}),
];

// the mango trees (fícus model) all along the river bank, thicker in the middle stretch;
// a few big trees on the bank at the west end; palms and street trees on the town side
const BANK=[6,24,44,232,244,256,268,278,288,300,312,324,336,348,360,372,388,398,410,420,432,446,458,470,484,
  498,512,526,540,552,566,580,596,612,628,644,660,676,686,698,710,722,736,750,764,780,796,812,828,842,856,870,
  884,898,912,926,940,956,970,984,998,1010,1024,1040,1056,1072,1090,1112,1140,1262,1556,1582];
export const TREES:Tree[]=[
  ...BANK.map(s=>({side:'N' as const,s,kind:'ficus' as const})),
  {side:'N',s:250,kind:'palmeira'},
  {side:'S',s:102,kind:'ficus'},{side:'S',s:106,kind:'palmeira'},{side:'S',s:110,kind:'palmeira'},
  {side:'S',s:390,kind:'palmeira'},{side:'S',s:402,kind:'palmeira'},{side:'S',s:414,kind:'palmeira'},
  {side:'S',s:486,kind:'ficus'},{side:'S',s:498,kind:'ficus'},{side:'S',s:506,kind:'ficus'},
  {side:'S',s:512,kind:'palmeira'},{side:'S',s:518,kind:'ficus'},
  {side:'S',s:1234,kind:'ficus'},{side:'S',s:1278,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:20,every:36,transformers:[200,560,920,1280]},
  keepOut:[
    {side:'N',s0:0,s1:1709.7,why:'the river bank: grass and mango trees, no sidewalk',walk:false},
    {side:'S',s0:0,s1:113,why:'the farm track: no sidewalk',walk:false},
    {side:'S',s0:574,s1:660,why:'Posto Taurus and Bilica Pneus (their own models)'},
    {side:'S',s0:1368,s1:1458,why:'the long cream building and the checkered-flag workshop (galpoes.ts)'},
    {side:'S',s0:1596,s1:1672,why:'the yard of the Salão de Eventos Beira Rio and the prison (game site)'},
  ],
};
