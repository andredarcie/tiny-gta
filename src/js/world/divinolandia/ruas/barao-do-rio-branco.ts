// Rua Barão do Rio Branco — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/brb-N-*/ and brb-S-*/, kept out of git). The
// street runs ~925 m north→south from the Rio do Peixe, just west of the Matriz squares, up
// the hill, then forks into two short branches. `s` starts at the NORTH end (the street runs
// N–S), so side 'N' is the EAST side (left of a walker going south) and 'S' the WEST side.
//   s=6   Av. Marginal do Rio do Peixe     s=66  Rua Yolanda Zamai Raimundo
//   s=214 Rua Dom Antônio J. de Mello      s=268 Rua Coronel José Leopoldino
//   s=344 Rua Treze de Maio                s=414 Rua Romeu Zanetti
//   s=478 Rua XV de Novembro               s=564 Rua Sete de Setembro
//   s=624 Rua José Augusto Machado         s=703 Rua São Vicente de Paula
//   s=794 Rua Dom Alberto J. Gonçalves     s=871 Rua Mato Grosso
//   s=925 the fork (south end of the straight street)
// Asphalt from the river to the Treze de Maio, granite setts from there up the hill.
// Past s=925 the chained OSM polyline doubles back over the fork (chainPieces chains a Y
// into one line, with two straight jumps that are not real roads): no lots there, and
// closely spaced `cross` stops keep the builder from laying sidewalks or poles along it.
// Left alone (their own models): the Posto Taurus on the Marginal corner, the bus garage
// and the EMEB Prof. Moacyr Lopes de Carvalho behind their walls (galpoes.ts), the gun
// shop's game lot, the Matriz squares, the Delegacia (publicos.ts), the businesses of
// comercio/lojas.ts and the corner lots of the José Augusto Machado (its own spec).
// Opening x is measured from the lot centre as SEEN FROM THE STREET (left negative): on the
// west side (S) looking west, left is SOUTH (+s); on the east side (N) left is NORTH.
// Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Barão do Rio Branco';
export const FORK=925.4;                                       // end of the straight street
const FORK_END=1146;                                          // end of the chained polyline
// the doubled-back stretches past the fork: stops every 7 m (no sidewalk, no pole)
const FORK_STOPS=Array.from({length:Math.ceil((FORK_END-FORK)/7)},(_,i)=>+(FORK+7*(i+1)).toFixed(1));
export const CROSS=[0,6,66.2,214.5,267.9,343.7,413.8,478.5,563.6,624.2,703.4,794.1,870.6,FORK,...FORK_STOPS];
// the two jumps of the chained polyline (973.4→986.2 and 1034.3→1089.4) are not roads
const SURFACE:Surface[]=[[0,343.7,'asphalt'],[343.7,973.4,'sett'],[986.2,1034.3,'sett'],[1089.4,FORK_END,'sett']];

const T='#b0603f',TD='#8e4632',W='#f1efe9';

// a lot whose front stands back keeps its body within the 12 m band
const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
// a yard wall along the sidewalk with nothing (or a house far back) behind it
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ======== Yolanda Zamai Raimundo (66.2) → Dom Antônio J. de Mello (214.5) ========
  // east side (N), north → south (the Posto Taurus and its oil-change bays take s 0–66)
  // grey concrete house behind a dark wooden gate and black bars, flat slab eave, speckled base
  L('N',72,84.5,{wall:'#d6d3cc',roof:'flat',fascia:'#c9c5bd',setback:3,plinth:{h:.6,c:'#8a7a68',stone:true},
    front:{h:.6,c:'#c9c4b8',rail:{h:1.4,c:'#2a2a2a',style:'bars'},gates:[{t:'gate',x:-4,w:3.2,c:'#5a4030'}]},
    open:[{t:'door',x:-1,w:1.1,c:'#4a3a30'},{t:'window',x:2,w:2.4,grille:true,frame:'#2a2a2a'}]}),
  // pale lilac cottage behind a white picket fence
  L('N',84.5,93.5,{wall:'#e8dfe3',roof:'gable',roofColor:T,fascia:W,eave:.6,setback:4,
    front:{h:.6,c:'#f2f0ee',rail:{h:1,c:'#f6f6f4',style:'bars'},gates:[{t:'gate',x:2.5,w:1.2,c:'#f6f6f4'}]},
    open:[{t:'window',x:-.8,w:1.6,grille:true,frame:W},{t:'door',x:2.2,w:1,c:'#8a5a3a'}]}),
  L('N',93.5,101,{wall:'#ebe3e3',roof:'hip',roofColor:T,setback:3.8,
    front:{h:.6,c:'#f2f0ee',rail:{h:1.1,c:'#f6f6f4',style:'bars'},gates:[{t:'gate',x:-2.6,w:1.2,c:'#f6f6f4'}]},
    open:[{t:'window',x:-.6,w:2.6,grille:true,frame:W},{t:'door',x:2.6,w:1,c:'#8a4a2e'}]}),
  // modern taupe house: stone-clad front wall, white sliding gate
  L('N',101,108,{wall:'#cfc4b8',roof:'gable',roofColor:TD,fascia:'#7a4030',eave:.8,setback:2.5,
    front:{h:2,c:'#ddd2c0',style:'stone',gates:[{t:'garage',x:1.4,w:3.4,c:'#e9eaea'},{t:'door',x:-2.4,w:1,c:'#f2f2f0'}]}}),
  // two-storey grey workshop with its big door open, white balcony bars above
  L('N',108,116.6,{floors:2,wall:'#cfccc6',upper:'#d6d3cd',roof:'flat',parapet:true,
    open:[{t:'open',x:-.6,w:3.4,h:2.8,c:'casa'},{t:'window',x:2.8,w:.8,h:1.5,y:.9,st:'basculante'},{t:'window',x:-.6,w:2.4,fl:1}],
    balcony:{x:0,w:8,fl:1,rail:'white'}}),
  // two-storey light grey: white door and garage, white balcony
  L('N',116.6,124.6,{floors:2,wall:'#d4d2ce',roof:'flat',parapet:true,
    open:[{t:'door',x:-2.4,w:1,c:'#f2f2f0'},{t:'garage',x:1,w:2.4,h:2.5,c:'#f4f4f2'},{t:'window',x:-.6,w:1.6,fl:1}],
    balcony:{x:-.6,w:4,fl:1,rail:'white'}}),
  // old lilac-grey house, blue-grey shutters, a little porch under clay tiles
  L('N',124.6,130,{wall:'#c9c6d2',roof:'hip',roofColor:TD,plinth:{h:.5,c:'#9a96a0'},
    open:[{t:'window',x:-1,w:1.4,shutters:'#5a6a8a',frame:W},{t:'open',x:1.6,w:1.6,h:2.2,c:'casa',awning:T}]}),
  // beige house, gable with stone-clad pillars, dark grey braced garage gate
  L('N',130,138,{wall:'#e2d6c2',roof:'gable',roofColor:TD,fascia:'#5a3a2a',eave:.8,
    panels:[{x:-3.4,w:1,stone:true},{x:.6,w:1.2,stone:true}],
    open:[{t:'garage',x:-1.4,w:2.8,c:'#4a4c50'},{t:'glass',x:2.6,w:2.2,frame:'#2a2a2a'}]}),
  // taupe front wall with a white sectional garage door, the house behind
  L('N',138,146,{wall:'#e6dcc8',roof:'hip',roofColor:T,setback:3,
    front:{h:2,c:'#9c8a76',gates:[{t:'garage',x:1.8,w:3,c:'#f2f2f0'}]},open:[{t:'window',x:-1.6,w:1.6}]}),
  // modern grey house behind a grey slatted wall, white gates
  L('N',146,155,{wall:'#8e8e8c',roof:'gable',roofColor:T,fascia:W,eave:.7,setback:3,
    front:{h:2.2,c:'#9a9a98',style:'panel',gates:[{t:'garage',x:1.2,w:3.6,c:'#f0f0ee'},{t:'door',x:4,w:1,c:'#f0f0ee'}]}}),
  // old beige house, blue window, behind a low wall with black bars
  L('N',155,163.3,{wall:'#e6d4b6',roof:'hip',roofColor:T,setback:5,
    front:{h:.8,c:'#d9c7a8',rail:{h:1,c:'#3a3a3a',style:'bars'},gates:[{t:'gate',x:2.6,w:1.2,c:'#3a3a3a'}]},
    open:[{t:'window',x:-1.2,w:1.4,shutters:'#3a7ab8'},{t:'door',x:1.8,w:1,c:'#3a7ab8'}]}),
  // the carport under an old clay roof, then the beige house with a brown door
  L('N',163.3,170,{wall:'#e2d2b8',roof:'hip',roofColor:TD,open:[{t:'open',x:-.4,w:3.6,h:2.3,c:'casa'}]}),
  L('N',170,176.3,{wall:'#e8d9bf',roof:'hip',roofColor:T,open:[{t:'window',x:-1.4,w:1.2},{t:'door',x:1.4,w:1.1,c:'#7a4a30'}]}),
  // beige gable house, wrought-iron garage gate in a white frame
  L('N',176.3,184.5,{wall:'#e3cfae',roof:'gable',roofColor:T,fascia:'#6a4a30',eave:.7,
    open:[{t:'window',x:-2.5,w:1.2},{t:'gate',x:1.4,w:3,c:'#3a2e28',frame:W}]}),
  // terracotta-plastered house with a brown shuttered window
  L('N',184.5,190.5,{wall:'#b5544a',roof:'gable',roofColor:T,fascia:W,eave:.6,
    open:[{t:'window',x:-.4,w:1.5,shutters:'#7a4a2a',frame:'#e6dccb'},{t:'window',x:2,w:.8,frame:'#e6dccb'}]}),
  // its wooden gate and white garage gate under a clay awning
  L('N',190.5,195,{wall:'#b04f45',roof:'hip',roofColor:T,open:[{t:'gate',x:-1.4,w:1.2,c:'#9a6a40'},{t:'garage',x:1,w:2.4,c:'#f2f2f0',awning:T}]}),
  // lilac house behind a white barred gate
  L('N',195,199,{wall:'#cdbccd',roof:'hip',roofColor:T,setback:2,front:{h:.4,c:'#cdbccd',rail:{h:1.6,c:'#f2f2f0',style:'bars'}},
    open:[{t:'window',x:0,w:1.6,frame:W}]}),
  // cream sobrado on a brown base, corrugated beige gate
  L('N',199,204.5,{floors:2,wall:'#ead9b4',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#a8673f'},
    open:[{t:'garage',x:-.4,w:3,c:'#e6d8b8'},{t:'window',x:.4,w:1.4,fl:1,shutters:'#c9b48a',frame:W}]}),
  // cream corner house, hip roof, white-framed windows over a brown base
  L('N',204.5,210.5,{wall:'#e9dcc0',roof:'hip',roofColor:T,plinth:{h:.8,c:'#a8673f'},
    open:[{t:'window',x:-1.4,w:1.6,frame:W,shutters:'#e6dcc8'},{t:'window',x:1.4,w:2.2,frame:W}]}),
  // west side (S), north → south: the tan wall on the Marginal corner, an old gable house behind
  muro('S',11,18.5,'#d6a874',2.3,{behind:{w:8,d:8,at:2,roof:'gable',roofColor:'#7a5a40',wall:'#d6a874'}}),
  // dark wooden gate in the same wall
  muro('S',18.5,22.4,'#d6a874',2.3,{front:{h:2.3,c:'#d6a874',gates:[{t:'gate',x:0,w:2.6,c:'#5a4030'}]}}),
  // bright green house: green front wall with dark green panels, green garage under a clay awning
  L('S',22.4,32,{wall:'#86c47c',roof:'gable',roofColor:T,fascia:W,eave:.6,setback:3,
    front:{h:2.3,c:'#86c47c',style:'panel',gates:[{t:'garage',x:2.4,w:3.2,c:'#1f5a3c',awning:T}]}}),
  // striped beige wall with a black gate, a brick house going up behind
  muro('S',32,40,'#e2d1b4',2.4,{front:{h:2.4,c:'#e2d1b4',gates:[{t:'garage',x:0,w:2.8,c:'#1c1c1e'}]},
    behind:{w:8,d:7,at:3,roof:'flat',roofColor:'#8f8b84',wall:'#a8583c'}}),
  // old white warehouse front: blue sheet door under a corrugated awning
  L('S',40,48,{wall:'#ece9e2',roof:'flat',parapet:true,open:[{t:'garage',x:-1.4,w:2.8,h:3,c:'#2f5fa0',awning:'#9a9a98'},{t:'window',x:2.4,w:1.2,grille:true}]}),
  muro('S',48,56,'#e2d1b4',2.2),
  // a workshop's open bay on a brown base
  L('S',56,62.5,{wall:'#ece2cf',roof:'gable',roofColor:T,plinth:{h:1.2,c:'#5a3a2a'},open:[{t:'open',x:0,w:4.2,h:2.8,c:'casa',awning:'#6a4a32'}]}),
  // the bus garage's long low red wall with wooden gates (the garage itself: galpoes.ts g18)
  muro('S',74,86,'#c4524f',1.2,{front:{h:1.2,c:'#c4524f',rail:{h:1,c:'#8a6a4a',style:'bars'},gates:[{t:'gate',x:-4.5,w:2.8,c:'#c99a6a'}]}}),
  muro('S',86,98,'#c4524f',1.2,{front:{h:1.2,c:'#c4524f',rail:{h:1,c:'#8a6a4a',style:'bars'},gates:[{t:'gate',x:1,w:3.4,c:'#c99a6a'}]}}),
  muro('S',98,106,'#a9a59c',2.4),
  // the creche: a blue building behind a lawn, blue fence on a pale-blue low wall
  muro('S',112,124,'#bfe0f0',.6,{front:{h:.6,c:'#bfe0f0',rail:{h:1.4,c:'#2f5fa8',style:'bars'},gates:[{t:'gate',x:-3,w:3,c:'#2f5fa8'}]}}),
  L('S',124,140,{wall:'#3f86d0',roof:'gable',roofColor:'#9a9a94',fascia:W,setback:6,
    front:{h:.6,c:'#bfe0f0',rail:{h:1.4,c:'#2f5fa8',style:'bars'}},
    open:[{t:'door',x:0,w:1.6,c:'#2a4a8a'},{t:'window',x:-4.5,w:2.2},{t:'window',x:4.5,w:2.2}],
    sign:{text:'CRECHE ESCOLA',bg:'#3f86d0',fg:'#f2f2ee',x:0,y:3,w:5,h:.6}}),
  muro('S',140,148,'#bfe0f0',.6,{front:{h:.6,c:'#bfe0f0',rail:{h:1.4,c:'#2f5fa8',style:'bars'}}}),
  // the EMEB's blue wall with white notches, concrete benches at its foot (school: galpoes.ts g31)
  muro('S',158,166,'#2f5ea8',2.2,{front:{h:2.2,c:'#2f5ea8',gates:[{t:'gate',x:-1.6,w:3,c:'#e8e8e4'}]}}),
  muro('S',166,174,'#2f5ea8',2.2),
  muro('S',174,182,'#2f5ea8',2.2),
  muro('S',182,188,'#2f5ea8',2.2,{front:{h:2.2,c:'#2f5ea8',gates:[{t:'gate',x:.4,w:3.6,c:'#e8e8e4'}]}}),
  // pale house behind white bars
  L('S',188,197.5,{wall:'#e6e0d8',roof:'gable',roofColor:T,fascia:W,eave:.6,setback:2.5,
    front:{h:.5,c:'#d8d2c8',rail:{h:1.4,c:'#f2f2f0',style:'bars'},gates:[{t:'gate',x:-2,w:2.8,c:'#f2f2f0'}]},
    open:[{t:'window',x:1.6,w:1.6,grille:true}]}),
  // textured beige sobrado on dark stone, maroon garage door
  L('S',197.5,203,{floors:2,wall:'#d9c7a4',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#3a3a3c',stone:true},
    open:[{t:'garage',x:.6,w:2.8,c:'#7a1f24'},{t:'window',x:0,w:2.2,fl:1,frame:'#8a4a2a'}]}),
  // the corner house: textured beige on a dark stone base, a wide wood-framed window
  L('S',203,210.5,{wall:'#d6c5a2',roof:'hip',roofColor:T,plinth:{h:1.1,c:'#3a3a3c',stone:true},
    open:[{t:'window',x:0,w:2.6,h:1.4,frame:'#8a4a2a'}]}),

  // ======== Dom Antônio J. de Mello (214.5) → Treze de Maio (343.7) ========
  // east side (N), north → south: big cream house, arched windows, slate base, red picket fence
  L('N',218.6,231,{wall:'#ece0c0',roof:'gable',roofColor:TD,fascia:'#5a3a2a',eave:.8,setback:2,plinth:{h:.9,c:'#4f4c48',stone:true},
    front:{h:1,c:'#4f4c48',style:'stone',rail:{h:1,c:'#8a3a2a',style:'bars'}},
    open:[{t:'arch',x:-4,w:1.2},{t:'window',x:-1.6,w:2.2,shutters:'#8a5a3a'},{t:'arch',x:1.4,w:1.1,h:2,y:0},{t:'arch',x:3.2,w:1.1,h:2,y:0},{t:'arch',x:5,w:1.1}]}),
  // beige house with a pillared porch, stone pillars, dark grey gate
  L('N',231,243,{wall:'#e6d4b8',roof:'hip',roofColor:T,setback:3,panels:[{x:-2.2,w:1,stone:true}],
    front:{h:.6,c:'#c8b090',style:'stone',rail:{h:1.2,c:'#4a4a4c',style:'bars'},gates:[{t:'gate',x:-4,w:3,c:'#5a5a5e'}]},
    open:[{t:'window',x:0,w:1.6,shutters:'#3a3a3a'},{t:'window',x:3.4,w:1.6,shutters:'#3a3a3a'}]}),
  // beige sobrado, white barred garage gate
  L('N',243,248.5,{floors:2,wall:'#d9bf9e',roof:'hip',roofColor:T,
    open:[{t:'gate',x:0,w:3.2,c:'#f2f2f0'},{t:'window',x:-.8,w:1.4,fl:1,shutters:W,frame:W},{t:'window',x:1.6,w:.9,fl:1}]}),
  // a long tan wall with clay coping to the corner, the cream house behind it
  muro('N',248.5,256,'#c9a587',2.3,{behind:{w:7,d:9,at:4,roofColor:T,wall:'#ead8bc'}}),
  muro('N',256,264,'#c9a587',2.3,{front:{h:2.3,c:'#c9a587',gates:[{t:'gate',x:2.6,w:2.2,c:'#f2f2f0'}]},behind:{w:7,d:9,at:4,roofColor:T,wall:'#ead8bc'}}),
  // old cream house raised at the corner, porch on twisted columns, brown shutters
  L('N',272.5,284,{wall:'#efe6d6',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#b9b2a6'},
    open:[{t:'open',x:-2.4,w:3.2,h:2.2,y:1.1,c:'casa'},{t:'window',x:2.6,w:2,y:1.9,shutters:'#8a4a2a'}]}),
  // old cream house, two brown-shuttered windows; a grey sheet gate
  L('N',284,290.5,{wall:'#ede4d2',roof:'hip',roofColor:T,plinth:{h:.8,c:'#c9c0b0'},
    open:[{t:'window',x:-1.6,w:1.4,shutters:'#8a5232'},{t:'window',x:1.4,w:1.4,shutters:'#8a5232'}]}),
  muro('N',290.5,294,'#c9c4b8',2,{front:{h:2,c:'#c9c4b8',gates:[{t:'gate',x:0,w:3,c:'#9ea3a8'}]}}),
  // mauve house, dark gable boards, black iron railing, carport with a tiled edge
  L('N',294,305,{wall:'#cdb5b0',roof:'gable',roofColor:TD,fascia:'#5a3020',eave:.9,setback:2.5,
    front:{h:.5,c:'#b9a49e',rail:{h:1,c:'#2a2a2a',style:'bars'}},
    open:[{t:'window',x:-3,w:1.8,shutters:'#5a3a2a',frame:W},{t:'window',x:.2,w:2,frame:W},{t:'open',x:3.6,w:2.6,h:2.3,c:'casa',awning:T}]}),
  // carport and the old beige house behind black bars
  L('N',305,314,{wall:'#e3cfa8',roof:'hip',roofColor:T,setback:2,
    front:{h:.7,c:'#9e9a92',rail:{h:1.1,c:'#3a3a3a',style:'bars'}},
    open:[{t:'open',x:-2.6,w:2.6,h:2.3,c:'casa',awning:T},{t:'window',x:1.6,w:1.4,shutters:'#8a6a4a'}]}),
  L('N',314,321,{wall:'#e2cfa6',roof:'hip',roofColor:T,setback:3,
    front:{h:.6,c:'#9e9a92',rail:{h:1.1,c:'#3a3a3a',style:'bars'},gates:[{t:'gate',x:2.4,w:1.6,c:'#7a3a2a'}]},
    open:[{t:'window',x:-1.6,w:1.2},{t:'open',x:1,w:2,h:2.2,c:'casa',awning:T}]}),
  // mint garage block with a white door, the grey stone-look house beside it
  L('N',321,324.5,{wall:'#cfe3d8',roof:'hip',roofColor:T,open:[{t:'garage',x:0,w:2.6,c:'#f2f0ea'}]}),
  L('N',324.5,331,{wall:'#b9b4aa',roof:'hip',roofColor:T,plinth:{h:.5,c:'#8fb8a8'},
    open:[{t:'glass',x:-1.4,w:2.4,frame:'#2a2a2a'},{t:'garage',x:1.8,w:2.4,c:'#f2f0ea'}]}),
  // pink house to the corner: clay porch over the carport, white barred fence
  L('N',331,339.5,{wall:'#d8b7b9',roof:'gable',roofColor:T,fascia:'#6a3a30',eave:.8,setback:2.5,
    front:{h:.4,c:'#c9a6a8',rail:{h:1.6,c:'#f2f2f0',style:'bars'}},
    open:[{t:'open',x:-2,w:3.4,h:2.3,c:'casa',awning:T},{t:'window',x:2.2,w:1.4,frame:W}]}),
  // west side (S), north → south: whitewashed wall with a white gate, an old house behind
  muro('S',219,223.5,'#e8e2d6',2,{front:{h:2,c:'#e8e2d6',gates:[{t:'gate',x:0,w:2.4,c:'#f2f2f0'}]},behind:{w:5,d:8,at:3,roofColor:TD,wall:'#ece6d6'}}),
  // old cream house, grey louvred window over a grey base
  L('S',223.5,232,{wall:'#ede6cf',roof:'hip',roofColor:T,plinth:{h:.6,c:'#8a8a84'},open:[{t:'window',x:0,w:1.6,shutters:'#9a9c9a'}]}),
  // salmon house: red gate, barred porch, brown door and shutters; a tiled annex
  L('S',232,244,{wall:'#e6b4a3',roof:'hip',roofColor:T,
    open:[{t:'gate',x:-4.6,w:1.4,c:'#b03a2e'},{t:'open',x:-2,w:2.6,h:2.2,c:'casa'},{t:'door',x:.8,w:1,c:'#8a4a2a'},{t:'window',x:3.2,w:1.6,shutters:'#8a4a2a'}]}),
  // small pink house with a red sheet gate
  L('S',244,250,{wall:'#e2a48a',roof:'hip',roofColor:T,open:[{t:'gate',x:-.8,w:3,c:'#b0503a'},{t:'door',x:2,w:.9,c:'#7a4a2a'}]}),
  // old exposed-brick wall, a white house with a blue base behind it
  muro('S',250,257,'#c98a6a',1.4,{front:{h:1.4,c:'#c98a6a',gates:[{t:'gate',x:2,w:3,c:'#8a9aa8'}]},behind:{w:10,d:9,at:3,roofColor:T,wall:'#ece8e0'}}),
  muro('S',257,264,'#c98a6a',1.4,{behind:{w:6,d:7,at:3,roofColor:T,wall:'#ece8e0'}}),
  // modern taupe corner block: roll-door shop, glass balconies
  L('S',271.6,284,{floors:2,wall:'#cdbca8',roof:'flat',parapet:true,
    open:[{t:'garage',x:-2,w:4.4,h:2.8,c:'#f2f2f0'},{t:'window',x:3,w:1.4},{t:'glass',x:-1,w:3,fl:1},{t:'window',x:3,w:1,fl:1}],
    balcony:{x:0,w:10,fl:1,rail:'glass'}}),
  // its tall blank wall, then a white door into the yard
  muro('S',284,292.5,'#c3ad97',3,{behind:{w:7,d:8,at:3,floors:2,roof:'flat',roofColor:'#8f8b84',wall:'#c9b39b'}}),
  muro('S',292.5,300,'#c6b29c',2.6,{front:{h:2.6,c:'#c6b29c',gates:[{t:'door',x:-1,w:1,c:'#f2f2f0'}]},behind:{w:6,d:8,at:3,floors:2,roofColor:T,wall:'#c9b39b'}}),
  // taupe sobrado: carport under a white pergola, white balcony bars
  L('S',300,308,{floors:2,wall:'#c9b39b',roof:'gable',roofColor:T,fascia:W,panels:[{x:-3.4,w:1,stone:true,y0:0,y1:1.2}],
    open:[{t:'open',x:-.6,w:4.2,h:2.4,c:'casa'},{t:'door',x:3,w:1,c:'#f2f2f0'},{t:'window',x:-1.6,w:1.6,fl:1,shutters:W},{t:'window',x:2,w:1.6,fl:1,shutters:W}],
    balcony:{x:0,w:7,fl:1,rail:'white'}}),
  // grey-and-white house with an arched porch: stone arch, white barred fence, pergola carport
  L('S',308,316,{wall:'#dedcd8',roof:'hip',roofColor:T,setback:1.5,panels:[{x:2.4,w:1.2,stone:true}],
    front:{h:.6,c:'#c8a97c',style:'stone',rail:{h:1.4,c:'#f2f2f0',style:'bars'}},
    open:[{t:'open',x:-2.4,w:3.2,h:2.4,c:'casa'},{t:'arch',x:1,w:2.2,h:1.6,y:0},{t:'window',x:1,w:1.4}]}),
  // old cream house, grey-blue door and shutters
  L('S',316,321.6,{wall:'#ede6d6',roof:'hip',roofColor:T,plinth:{h:.5,c:'#9a9a94'},
    open:[{t:'door',x:-1.2,w:1,c:'#9ab0b8'},{t:'window',x:1.4,w:1.2,grille:true}]}),
  L('S',321.6,325.5,{wall:'#f0eeea',roof:'hip',roofColor:T,open:[{t:'window',x:-.4,w:1,shutters:'#a8b0b4'},{t:'door',x:1.2,w:.9,c:'#a8b0b4'}]}),
  // the yellow house: salmon base, cream-framed windows with brown shutters, a gabled dormer
  L('S',325.5,338.8,{wall:'#e9c86e',roof:'hip',roofColor:T,plinth:{h:1.1,c:'#d99a7c'},
    open:[{t:'window',x:-4.6,w:1.4,shutters:'#9a5a3a',frame:'#f2ead8'},{t:'window',x:-1.4,w:1.4,grille:true,frame:'#f2ead8'},
      {t:'window',x:1.8,w:1.6,grille:true,frame:'#f2ead8'},{t:'window',x:5,w:1.2,shutters:'#9a5a3a',frame:'#f2ead8'}]}),

  // ======== Treze de Maio (343.7) → Romeu Zanetti (413.8) ========
  // east side (N), north → south (the gun shop's game lot takes s≈375–394, sites-table.ts):
  // Dona Onça, a clothing shop for women: white over a charcoal plinth, display window and
  // glass door under a dark awning, the leopard-print board
  L('N',348,361,{wall:'#efece6',roof:'hip',roofColor:T,eave:.6,plinth:{h:1.2,c:'#3a3a40'},
    open:[{t:'shop',x:2.6,w:2.6,h:2.3,c:'#3a3a40',awning:'#3e4146'},{t:'glass',x:5.1,w:1.5,y:0,h:2.4,awning:'#3e4146'}],
    sign:{text:'Dona Onça',bg:'#c9a24a',fg:'#1a1a1a',x:-3,y:2.3,w:2.4,h:1.5}},'pedra'),
  // brown wooden gate in a white wall
  L('N',361,365,{wall:'#f1efea',wallOnly:true,front:{h:2.6,c:'#f1efea',gates:[{t:'gate',x:.3,w:2.6,c:'#9a6a43'}]},
    behind:{w:4,d:8,at:4,roofColor:T,wall:'#dfe8da'}},'pedra'),
  // pale green house, gable to the street, little porch under a clay awning
  L('N',365,371.5,{wall:'#dfe8da',roof:'gable',roofColor:T,fascia:W,eave:.7,plinth:{h:.5,c:'#d8d2a0'},
    open:[{t:'window',x:-1.6,w:1,frame:'#d8c88a',shutters:W},{t:'door',x:1.6,w:1,c:'#7a6a58',awning:'#b4633f'}]},'cimento'),
  // grey house raised on a brick-red base: shuttered windows, wide curtained windows
  L('N',396,409.8,{wall:'#cdc6c0',roof:'hip',roofColor:T,fascia:W,eave:.7,plinth:{h:1.6,c:'#c27a62'},
    open:[{t:'window',x:-4.4,w:1,y:1.8,shutters:'#7a4a2e'},{t:'window',x:-2.8,w:1,y:1.8,shutters:'#7a4a2e'},
      {t:'window',x:.4,w:2.6,y:1.7,frame:'#e8e4dc',grille:true},{t:'window',x:4.2,w:2.2,y:1.7,frame:'#e8e4dc'}]},'cimento'),
  // west side (S), north → south: pink-and-white house behind white bars on a pink wall
  L('S',348,355.5,{wall:'#f3ece8',roof:'hip',roofColor:T,setback:2,
    front:{h:.6,c:'#e8c3c0',rail:{h:1.4,style:'bars',c:'#f6f4f2'}},open:[{t:'glass',x:.5,w:3.4,h:1.6,y:.7},{t:'door',x:-2.6,w:1,c:'#e8c3c0'}]},'cimento'),
  // beige sobrado: white garage, balcony with white bars
  L('S',369.5,377,{floors:2,wall:'#e7d2bf',roof:'flat',fascia:'#e7d2bf',eave:.4,
    open:[{t:'garage',x:.4,w:2.8,c:'#f4f3f0'},{t:'gate',x:-2.6,w:1,c:'#f4f3f0'},{t:'window',x:.2,w:1.4,fl:1,shutters:W}],
    balcony:{x:.3,w:3.8,fl:1,rail:'white'}},'cimento'),
  // tall wooden gate
  L('S',377,381,{wall:'#e7d2bf',wallOnly:true,front:{h:2.4,c:'#e7d2bf',gates:[{t:'gate',x:0,w:3.4,c:'#c9a07e'}]}},'cimento'),
  // little beige house with a porch and a white louvred window
  L('S',381,389,{wall:'#ecd7c3',roof:'hip',roofColor:T,plinth:{h:.6,c:'#c99a84'},
    open:[{t:'door',x:1.8,w:1,c:'#e8e4dc'},{t:'window',x:-1.4,w:1.6,frame:W,shutters:W}]},'cimento'),
  // (s 389–414: the Ideal Supermercados and Nega Pelega on the Romeu Zanetti corner, comercio/lojas.ts)

  // ======== Romeu Zanetti (413.8) → XV de Novembro (478.5) ========
  // east side (N), north → south: white chalet, steep dark gable with red bargeboards, set
  // back behind a white railing
  L('N',432,447,{wall:'#ece6d6',roof:'gable',roofColor:'#6b3a2c',fascia:'#8a2f2a',eave:1,setback:5,
    front:{h:.8,c:'#e4ddcc',rail:{h:1.1,style:'bars',c:'#f2f2ee'},gates:[{t:'gate',x:3,w:2.8,c:'#f2f2ee'}]},
    open:[{t:'window',x:-3.5,w:1.4,frame:W},{t:'window',x:-.8,w:2.2,frame:'#8a2f2a'},{t:'door',x:2.5,w:1,c:'#7a4a2a'}]},'cimento'),
  // a blank flat-roofed cream block with an ochre-brown base
  L('N',447,455,{wall:'#efe2b8',roof:'flat',fascia:'#efe2b8',eave:.1,plinth:{h:.9,c:'#8a4f2e'},d:10}),
  // grey sheet-metal gate in the wall
  L('N',455,459,{wall:'#efe2b8',wallOnly:true,front:{h:2.7,c:'#efe2b8',gates:[{t:'garage',x:-.2,w:3.2,h:2.5,c:'#b9bdc0'}]}}),
  // west side (S), north → south: the municipal dental centre — blue yard wall, then the blue
  // two-storey building with a red panel behind a low wall, white gate
  L('S',418,428,{wall:'#7aa0d6',wallOnly:true,front:{h:2.3,c:'#7aa0d6',gates:[{t:'gate',x:-3.2,w:2.8,c:'#8b8c88'}]},
    behind:{w:7,d:9,at:3,roof:'flat',roofColor:'#8f8b84',wall:'#7aa0d6',floors:2}},'cimento'),
  L('S',428,439,{floors:2,wall:'#7aa0d6',roof:'flat',fascia:'#e8e8e4',eave:.4,setback:2.5,
    front:{h:1.2,c:'#7aa0d6',rail:{h:1,style:'bars',c:'#f2f2ee'},gates:[{t:'gate',x:-1.5,w:3,h:2.2,c:'#f0efea'}]},
    panels:[{x:1.6,w:2.2,c:'#b9605a'}],
    open:[{t:'window',x:-3.4,w:1.4,awning:'#2f5aa0'},{t:'window',x:-1,w:1.4,awning:'#2f5aa0'},{t:'window',x:-2,w:1.6,fl:1},{t:'window',x:4,w:1.2,fl:1}]},'cimento'),

  // ======== XV de Novembro (478.5) → Sete de Setembro (563.6) — beside the Matriz ========
  // east side (N): the Matriz squares. West side (S), north → south: the long plaster wall of
  // a yard, houses seen over it down the slope (stretches so its top steps with the street)
  L('S',483,487.5,{wall:'#d8d1c4',wallOnly:true,front:{h:2.1,c:'#d6cfc1'}},'ceramica'),
  L('S',487.5,492,{wall:'#d8d1c4',wallOnly:true,front:{h:2.1,c:'#d6cfc1'}},'ceramica'),
  L('S',492,496.5,{wall:'#d8d1c4',wallOnly:true,front:{h:2.1,c:'#d6cfc1'},behind:{w:6,d:7,at:4,roofColor:'#8a5a46',wall:'#ece4d6'}},'ceramica'),
  L('S',496.5,501,{wall:'#d8d1c4',wallOnly:true,front:{h:2.1,c:'#d6cfc1'}},'ceramica'),
  L('S',501,505.5,{wall:'#d8d1c4',wallOnly:true,front:{h:2.1,c:'#d6cfc1'},behind:{w:6,d:7,at:4,roofColor:T,wall:'#e9e3d8'}},'ceramica'),
  // brick house behind a stone-clad front wall, teal garage gate under a green awning
  L('S',505.5,513.5,{wall:'#b8673f',roof:'gable',roofColor:'#7a4a35',fascia:'#6b4630',eave:1,setback:4,
    front:{h:2.6,c:'#c9b79a',style:'stone',gates:[{t:'garage',x:-1.4,w:3.4,h:2.4,c:'#2f6b62',awning:'#5f8a7a'},{t:'door',x:2.6,w:1,c:'#2f6b62'}]},
    open:[{t:'window',x:-1.4,w:1.4,grille:true,frame:'#2f6b62'},{t:'window',x:2,w:1.2,frame:W}]},'ceramica'),
  // white shop with a glass front and a tiled porch roof
  L('S',521,528,{wall:'#f2f1ec',roof:'hip',roofColor:T,eave:.9,setback:1.2,d:10,
    open:[{t:'glass',x:-.6,w:4.4,y:0,h:2.6,frame:'#e8e8e4'},{t:'door',x:2.4,w:1,c:'#2e3a33'}],
    sign:{text:'clínica são lucas',bg:'#2d5a3e',fg:'#f1efea',x:0,y:2.9,w:4.2,h:.55}},'cimento'),

  // ======== Sete de Setembro (563.6) → José Augusto Machado (624.2) ========
  // (the corner lots at JAM face JAM: they are in jose-augusto-machado.ts, s ≥ 606)
  // east side (N), north → south: the beige corner house with dark stone plinth, a stone
  // panel and two windows with brown wooden shutters
  L('N',568,581.5,{wall:'#dbcfb3',roof:'hip',roofColor:TD,fascia:'#a19b8f',eave:.7,plinth:{h:1.2,stone:true},
    panels:[{x:-4.4,w:2.6,stone:true,y0:1.2,y1:2.9}],
    open:[{t:'window',x:-.4,w:2.3,h:1.1,y:1.4,shutters:'#5a2e22',frame:'#4a2a20'},{t:'window',x:3.6,w:2.9,h:1.1,y:1.4,shutters:'#5a2e22',frame:'#4a2a20'}]},'pedra'),
  // its flat-roofed annex: a white door in the wall, stone panel
  L('N',581.5,585.5,{wall:'#dbcfb3',roof:'flat',fascia:'#dbcfb3',eave:.2,plinth:{h:1,stone:true},
    panels:[{x:1,w:1.8,stone:true,y0:1.4,y1:2.6}],open:[{t:'door',x:-1,w:1,c:'#e9e4d6'}]},'pedra'),
  // yellow house with a brown plinth and a shuttered window
  L('N',585.5,596,{wall:'#e6d39c',roof:'hip',roofColor:TD,plinth:{h:.9,c:'#4e2a24'},
    open:[{t:'window',x:-1.5,w:1.5,shutters:'#6a3a28',frame:W},{t:'gate',x:3,w:2.6,c:'#3a2a22'}]},'cimento'),
  // nº 270: yellow, maroon plinth, white trim; window, iron-gated door and garage
  L('N',596,606,{wall:'#f0d47e',roof:'hip',roofColor:'#8e4a34',fascia:W,eave:.6,plinth:{h:.6,c:'#5a2626'},
    open:[{t:'window',x:-2.6,w:1.7,frame:W,grille:true},{t:'gate',x:.2,w:1.3,h:2.3,c:'#3a2620',frame:W},
      {t:'gate',x:3,w:2.8,h:2.3,c:'#3a2620',frame:W}]},'ceramica'),
  // west side (S), north → south: the grey corner house, flat roof with a deep grey eave,
  // brown stone plinth with cellar grilles
  L('S',568,587,{wall:'#c4c7ca',roof:'flat',fascia:'#a6aaae',eave:1,plinth:{h:1.3,stone:true},
    open:[{t:'window',x:-4.6,w:1.9,h:1.2,y:1.6,frame:W},{t:'window',x:.4,w:1.9,h:1.2,y:1.6,frame:W},
      {t:'window',x:.4,w:2,h:.55,y:.4,frame:W,grille:true},{t:'door',x:7.6,w:1,c:'#8f9ea2'}]},'pedra'),
  // white house with two blue-grey garage doors under a clay hip roof
  L('S',587,595,{wall:'#e6e6e3',roof:'hip',roofColor:'#b4633f',plinth:{h:.4,stone:true},
    open:[{t:'garage',x:-2.3,w:2.4,h:2.3,c:'#a7b7bb'},{t:'garage',x:.6,w:2.4,h:2.3,c:'#a7b7bb'},{t:'window',x:3,w:1.1,frame:W,shutters:'#a7b7bb'}]},'cimento'),
  // small porch house: clay porch roof, wooden door behind a low railing
  L('S',595,599,{wall:'#e9e3d4',roof:'hip',roofColor:'#b4633f',setback:1.5,eave:.8,
    front:{h:.9,c:'#d9cfb3',rail:{h:.9,style:'bars',c:'#e8e8e4'}},open:[{t:'door',x:-.3,w:1,c:'#7a3f26'}]},'cimento'),
  // beige house, gable to the street with white bargeboards, closed louvred window; gates
  L('S',599,606,{wall:'#cbbfa4',roof:'gable',roofColor:'#b4633f',fascia:W,eave:.9,
    open:[{t:'window',x:1,w:1.8,frame:W,shutters:'#efe9da'},{t:'gate',x:-2.4,w:1.6,c:'#efe9da'}]},'cimento'),

  // ======== José Augusto Machado (624.2) → São Vicente de Paula (703.4) ========
  // (the corner lots at JAM face JAM: jose-augusto-machado.ts, s ≤ 644)
  // east side (N), north → south: the rest of the red corner house's flank
  L('N',644.5,654,{wall:'#a8443a',roof:'hip',roofColor:T,fascia:'#ece6da',eave:.6,plinth:{h:.5,c:'#e3dccd'},
    open:[{t:'window',x:-1.4,w:2,frame:'#c9c4b8',shutters:'#a9b4bb'},{t:'garage',x:2.6,w:2.8,c:'#a9b4bb'}]},'cimento'),
  // white house, glass-block window and a plain door
  L('N',654,662,{wall:'#ecebe7',roof:'hip',roofColor:T,
    open:[{t:'window',x:-2,w:1.2,frame:'#d8d6d0',grille:true},{t:'window',x:.6,w:1.3,shutters:W},{t:'door',x:2.6,w:.9,c:'#e8e6e0'}]},'cimento'),
  // grey-blue house with a gated carport, dish and water tank on top
  L('N',662,671,{wall:'#9ca3a8',roof:'hip',roofColor:TD,x:['dish','tank'],
    open:[{t:'window',x:-2.2,w:1.8,frame:W},{t:'open',x:2,w:3,h:2.3,c:'casa'}]},'cimento'),
  // beige two-storey with two white barred garages, steps up to a white door
  L('N',671,681,{floors:2,wall:'#e3d0b4',roof:'flat',fascia:'#e3d0b4',eave:.4,
    open:[{t:'garage',x:-2.4,w:2.6,c:'#f2f0ea'},{t:'garage',x:1,w:2.6,c:'#f2f0ea'},{t:'door',x:3.8,w:.9,c:'#f2f0ea'},{t:'window',x:-1,w:3,fl:1}],
    balcony:{x:-.6,w:8,fl:1,rail:'white'}},'cimento'),
  // beige two-storey, white gate
  L('N',681,688,{floors:2,wall:'#e8dcc4',roof:'flat',fascia:'#e8dcc4',eave:.4,
    open:[{t:'garage',x:-.5,w:2.6,c:'#f2f0ea'},{t:'window',x:-1,w:1.2,fl:1},{t:'window',x:1.6,w:1.2,fl:1}]},'cimento'),
  // the São Vicente de Paula corner: beige over an olive-green base, white garage, two big
  // white louvred windows
  L('N',688,699.4,{wall:'#e6dccb',roof:'hip',roofColor:T,fascia:W,eave:.7,plinth:{h:1.6,c:'#c8c39a'},
    open:[{t:'garage',x:-3.4,w:2.8,c:'#f2f1ec'},{t:'window',x:-.4,w:1.6,y:1.9,shutters:W},{t:'window',x:2.6,w:2.2,y:1.9,shutters:W}]},'cimento'),
  // west side (S), north → south: white porch house behind a grey railing
  L('S',644.5,652.5,{wall:'#efede6',roof:'hip',roofColor:T,setback:2,eave:.6,
    front:{h:.5,c:'#dedad0',rail:{h:1.3,style:'bars',c:'#8f9395'}},
    open:[{t:'glass',x:-.6,w:3.4,y:.3,h:2.1,frame:'#6b4a2e'},{t:'window',x:2.6,w:1.2,frame:W,grille:true}]},'cimento'),
  // the water reservoir's yard: blue wall under white balusters, blue gate
  L('S',652.5,667.5,{wall:'#3f86c8',wallOnly:true,front:{h:1.4,c:'#3f86c8',rail:{h:1,style:'bars',c:'#f1efe9'},
    gates:[{t:'gate',x:5.6,w:1.4,c:'#3f86c8'}]}},'cimento'),
  // beige sobrado: arched porch and balcony with balusters, white picket gates
  L('S',667.5,678,{floors:2,wall:'#ebe2d4',roof:'hip',roofColor:T,eave:.6,setback:2,
    front:{h:.6,c:'#c9b79a',rail:{h:1.1,style:'bars',c:'#f4f2ec'}},
    open:[{t:'arch',x:-1.8,w:2.4,h:1.8,y:0},{t:'arch',x:1.4,w:2.4,h:1.8,y:0},{t:'garage',x:-4,w:2.2,c:'#a9b4bb'},
      {t:'arch',x:1,w:2.6,h:1.3,y:.6,fl:1},{t:'window',x:-2.6,w:1.2,fl:1,frame:'#6b4a2e'}],balcony:{x:1,w:4,fl:1,rail:'white'}},'pedra'),
  // beige sobrado over a pink-granite ground floor with blue-grey garages
  L('S',678,688,{floors:2,wall:'#b9a39a',upper:'#efe3c7',roof:'flat',fascia:'#efe3c7',eave:.4,plinth:{h:.6,stone:true},
    open:[{t:'garage',x:-2.4,w:2.6,c:'#a9b4bb'},{t:'garage',x:1,w:2.6,c:'#a9b4bb'},{t:'window',x:-1,w:1.6,fl:1},{t:'window',x:2.4,w:1.2,fl:1}],
    balcony:{x:0,w:8,fl:1,rail:'iron'}},'cimento'),
  // exposed-brick house at the São Vicente de Paula corner: arched porch, grey picket fence
  // on a stone base
  L('S',688,699.4,{wall:'#c0683f',roof:'hip',roofColor:T,fascia:W,eave:.7,setback:2.5,
    front:{h:.7,c:'#b9a88c',style:'stone',rail:{h:1.3,style:'bars',c:'#a9b2b6'}},
    open:[{t:'arch',x:-2.6,w:3,h:2,y:0},{t:'arch',x:1.4,w:3,h:2,y:0},{t:'door',x:-2.6,w:1.1,c:'#5a3020'},{t:'window',x:1.4,w:1.4,shutters:'#a9b2b6'}]},'pedra'),

  // ======== São Vicente de Paula (703.4) → Dom Alberto J. Gonçalves (794.1) ========
  // east side (N), north → south: cream corner house over a tan band, brown frames
  L('N',707.6,716,{wall:'#efe2c4',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#dcc5a0'},
    open:[{t:'window',x:-2,w:1.2,frame:'#8a5a3a'},{t:'door',x:1.2,w:1,c:'#8a5a3a'},{t:'window',x:3.2,w:1.2,frame:'#8a5a3a'}]}),
  // cream house, brown-shuttered window, double wooden gate under a clay porch
  L('N',716,724,{wall:'#ecdcc0',roof:'hip',roofColor:T,
    open:[{t:'window',x:-2.4,w:1.6,shutters:'#a87a4e'},{t:'gate',x:1.6,w:3,c:'#a57a4e',awning:T}]}),
  // grey sheet gate in a white wall
  muro('N',724,728.7,'#e8e4dc',2.2,{front:{h:2.2,c:'#e8e4dc',gates:[{t:'gate',x:0,w:3,c:'#9aa8b8'}]}}),
  // small grey roughcast house, gable to the street
  L('N',728.7,734,{wall:'#9ea09c',roof:'gable',roofColor:T,fascia:'#8a8a86',eave:.6,
    open:[{t:'window',x:0,w:1.2,frame:'#e8dcc0',shutters:'#c9c9c4'}]}),
  // ochre roughcast house, white-framed windows, wooden shutters
  L('N',734,742,{wall:'#b7773f',roof:'gable',roofColor:'#7a4a35',fascia:'#5a5a58',eave:.8,
    open:[{t:'window',x:-2,w:1.4,shutters:'#c9a06a',frame:W},{t:'window',x:1.8,w:1.6,grille:true,frame:W}]}),
  // tall wooden fence
  muro('N',742,745,'#a8794c',2),
  // whitewashed house: grey shutters, an open porch, rough white base
  L('N',745,754,{wall:'#f0efe9',roof:'gable',roofColor:T,fascia:'#8a8a86',eave:.8,plinth:{h:.8,c:'#e4e2da'},
    open:[{t:'window',x:-1.6,w:1.2,shutters:'#9aa8b8'},{t:'open',x:1.8,w:2.2,h:2.2,c:'casa'}]}),
  // stone-clad sobrado: cream garage gates with pale blue stripes, glass balcony above
  L('N',754,767,{floors:2,wall:'#f2f2f0',roof:'flat',parapet:true,panels:[{x:0,w:13,stone:true,y0:0,y1:3}],
    open:[{t:'garage',x:-3.6,w:3,c:'#efe6cf'},{t:'door',x:-.6,w:1.1,c:'#efe6cf'},{t:'garage',x:3.4,w:3.6,c:'#efe6cf'},
      {t:'window',x:-3,w:1.6,fl:1},{t:'window',x:2.6,w:2.4,fl:1}],balcony:{x:0,w:12,fl:1,rail:'glass'}}),
  // blue-grey gate in a brown stone wall
  muro('N',767,773.8,'#8a7a64',2.4,{front:{h:2.4,c:'#8a7a64',style:'stone',gates:[{t:'gate',x:0,w:3,c:'#9aa8b8'}]}}),
  // the corner: two storeys of red brick on a dark stone ground floor, blue-grey garage
  // doors, a terrace with a railing
  L('N',773.8,789.8,{floors:2,wall:'#b5603f',upper:'#b5603f',roof:'hip',roofColor:T,plinth:{h:2.8,c:'#4a4a4c',stone:true},
    open:[{t:'garage',x:-5,w:3,c:'#a8b4c0'},{t:'garage',x:2.6,w:2.8,c:'#a8b4c0'},
      {t:'window',x:-4,w:1.6,fl:1,shutters:'#8a94a0',frame:W},{t:'window',x:0,w:1.4,fl:1,frame:W},{t:'window',x:4,w:1.6,fl:1,shutters:'#8a94a0',frame:W}],
    balcony:{x:-6,w:3,fl:1,rail:'iron'}}),
  // west side (S), north → south: white corner house, a recessed porch
  L('S',707.6,716,{wall:'#f0f0ee',roof:'hip',roofColor:T,plinth:{h:.8,c:'#9a9a94'},
    open:[{t:'open',x:-2,w:2.4,h:2.3,c:'casa'},{t:'window',x:1.4,w:1,grille:true,frame:'#3a3a3a'},{t:'window',x:3,w:1,grille:true}]}),
  // white house, grilled windows
  L('S',716,722.5,{wall:'#f2f2f0',roof:'hip',roofColor:T,open:[{t:'window',x:-1.4,w:1.4,grille:true,frame:'#3a5a8a'},{t:'window',x:1.6,w:1.8,grille:true}]}),
  // modern grey house, sliding glass window, white garage gate
  L('S',722.5,733.6,{wall:'#8f8f8d',roof:'hip',roofColor:T,fascia:W,
    open:[{t:'window',x:-2.6,w:2.6,frame:W},{t:'garage',x:2.6,w:3,c:'#f2f2f0'}]}),
  // an empty lot behind a low white railing
  muro('S',733.6,736.5,'#cfcac0',.3,{front:{h:.3,c:'#cfcac0',rail:{h:1,c:'#f2f2f0',style:'bars'}}}),
  // old white house with a recessed porch
  L('S',736.5,745.5,{wall:'#f0efea',roof:'hip',roofColor:T,
    open:[{t:'open',x:-1.4,w:3.4,h:2.2,c:'casa'},{t:'window',x:2.4,w:1,grille:true},{t:'gate',x:3.8,w:.9,c:'#f2f2f0'}]}),
  // yellow house, brown door
  L('S',745.5,750.5,{wall:'#e5b937',roof:'hip',roofColor:T,open:[{t:'door',x:-.6,w:1,c:'#7a3a24'},{t:'window',x:1.4,w:1,shutters:'#7a4a2a'}]}),
  muro('S',750.5,753.5,'#c47a5a',1.6,{front:{h:1.6,c:'#c47a5a',rail:{h:.8,c:W,style:'bars'}}}),
  // cream house, white door
  L('S',753.5,759,{wall:'#ece6d6',roof:'gable',roofColor:T,fascia:W,open:[{t:'door',x:-1,w:1.1,c:'#f2f2f0'},{t:'window',x:1.4,w:.9,shutters:W}]}),
  // nº 121: cream under a dark red bargeboard, white barred garage gate
  L('S',759,767,{wall:'#ece4d0',roof:'gable',roofColor:T,fascia:'#8a2f2a',eave:.8,
    open:[{t:'gate',x:-1.4,w:3.4,c:'#f2f2f0'},{t:'window',x:2.4,w:1.6,grille:true,frame:W}]}),
  // mint green house: stone panel, wide black-and-grey sliding gate
  L('S',767,773.5,{wall:'#c8dcc0',roof:'hip',roofColor:TD,panels:[{x:-2.6,w:1,stone:true}],
    open:[{t:'gate',x:.6,w:4.4,c:'#3a3c40'}]}),
  // mint house: dark grey garage, stone pilaster, black-grilled window
  L('S',773.5,781.6,{wall:'#c5dcc0',roof:'gable',roofColor:TD,fascia:'#4a4a48',panels:[{x:.8,w:1,stone:true}],
    open:[{t:'garage',x:-2,w:2.6,c:'#6a6c70'},{t:'window',x:2.8,w:1.6,grille:true,frame:'#1c1c1c'}]}),
  // nº 105: modern beige, a wood-clad panel, open carport behind black railings
  L('S',781.6,790.5,{wall:'#d6d2ca',roof:'gable',roofColor:'#5a5a58',fascia:W,eave:.8,setback:1.5,panels:[{x:2.4,w:3,c:'#b98a5c'}],
    front:{h:.4,c:'#3a3a3a',rail:{h:1.4,c:'#2a2a2a',style:'bars'}},
    open:[{t:'open',x:-1.4,w:4,h:2.4,c:'casa'},{t:'window',x:2.8,w:2.2,frame:'#3a3a3a'}]}),

  // ======== Dom Alberto J. Gonçalves (794.1) → Mato Grosso (870.6) ========
  // east side (N), north → south: old white corner house, red-brown shutters
  L('N',798.5,809.5,{wall:'#f2f0ea',roof:'hip',roofColor:T,plinth:{h:1,c:'#e8e2d6'},
    open:[{t:'window',x:-2,w:1.4,grille:true,frame:'#3a3a3a'},{t:'window',x:2.6,w:1.6,shutters:'#a8402e'}]}),
  // little yellow house behind a yellow wall, arched tiled hood over the door
  L('N',809.5,817,{wall:'#e2c25a',roof:'hip',roofColor:T,setback:3,
    front:{h:1.2,c:'#e2c25a',rail:{h:.8,c:'#3a3a3a',style:'bars'},gates:[{t:'gate',x:2.6,w:1.2,c:'#3a3a3a'}]},
    open:[{t:'door',x:.4,w:1,c:'#b0402e',awning:T},{t:'window',x:-1.8,w:1}]}),
  // yellow wall with clay coping, an old yellow house behind
  muro('N',817,826,'#e3c870',1.8,{behind:{w:7,d:8,at:4,roofColor:T,wall:'#e3c870'}}),
  muro('N',826,830,'#ece9e2',2.4,{behind:{w:4,d:8,at:3,roofColor:T,wall:'#efd9bf'}}),
  // cream house: brown corrugated garage gate under a tiled porch
  L('N',830,836.4,{wall:'#efd9bf',roof:'hip',roofColor:T,open:[{t:'gate',x:-1.8,w:1,c:'#7a6a58'},{t:'garage',x:1.2,w:3,c:'#9c8566',awning:T}]}),
  // old cream gable house: blue window frames, red door
  L('N',836.4,843,{wall:'#eadcc7',roof:'gable',roofColor:T,fascia:W,eave:.6,
    open:[{t:'window',x:-1.8,w:1.4,grille:true,frame:'#4f7ea8'},{t:'window',x:.8,w:1.6,frame:'#4f7ea8'},{t:'door',x:2.6,w:.9,c:'#b0402e'}]}),
  // white house on a green tiled base, mint garage gate
  L('N',843,848,{wall:'#f2f2f0',roof:'flat',parapet:true,plinth:{h:1,c:'#6fa07a'}}),
  L('N',848,854,{wall:'#f0f0ec',roof:'gable',roofColor:T,fascia:W,plinth:{h:.8,c:'#6fa07a'},open:[{t:'garage',x:0,w:3.4,c:'#a8d8bc',awning:T}]}),
  // beige house, white louvred window, white gates
  L('N',854,861,{wall:'#e6d2b4',roof:'hip',roofColor:T,
    open:[{t:'gate',x:-2.6,w:1.2,c:'#f2f2f0'},{t:'window',x:0,w:1.6,shutters:W,frame:W},{t:'glass',x:2.4,w:1.6,frame:W}]}),
  // small beige house, white diagonal-barred garage gate
  L('N',861,866.5,{wall:'#e3cfb2',roof:'hip',roofColor:T,open:[{t:'window',x:-1.6,w:1.2,frame:'#2a2a2a'},{t:'gate',x:1.2,w:3,c:'#f2f2f0'}]}),
  // west side (S), north → south: nº 85, white and terracotta, flat roofs, cypresses
  L('S',798.4,806,{wall:'#f2f2f0',roof:'flat',parapet:true,plinth:{h:.5,c:'#1c1c1c'},panels:[{x:1.6,w:1.8,c:'#a8463c'}],
    open:[{t:'garage',x:-2,w:3,c:'#f4f4f2'},{t:'door',x:1.6,w:1.1,c:'#f4f4f2'}]}),
  L('S',806,815,{wall:'#f2f2f0',roof:'flat',parapet:true,plinth:{h:.5,c:'#1c1c1c'},panels:[{x:-1.6,w:3,c:'#a8463c'}],
    open:[{t:'open',x:1.6,w:3,h:2.4,c:'casa'},{t:'glass',x:-1.6,w:1.6,frame:'#3a3a3a'}]}),
  // old white house under a brown gable, barred fence
  L('S',815,821,{wall:'#f0ede6',roof:'gable',roofColor:'#7a4a35',fascia:'#6a3a24',eave:.8,setback:2,
    front:{h:.4,c:'#cfcac0',rail:{h:1.2,c:'#3a3a3a',style:'bars'}},
    open:[{t:'window',x:-1.6,w:1.6,frame:'#4a3a30'},{t:'door',x:.6,w:1,c:'#4a2a20'},{t:'window',x:2.2,w:1.2,shutters:'#7a7c7e'}]}),
  // stone-clad garage with a white roll door
  L('S',821,825,{wall:'#c9a77a',roof:'flat',panels:[{x:0,w:4,stone:true,y0:0,y1:3}],open:[{t:'garage',x:0,w:2.8,c:'#f2f2f0'}]}),
  // green house: arched veranda, white barred fence on a stone base
  L('S',825,836,{wall:'#a9bfa0',roof:'hip',roofColor:'#c45a3e',setback:2.5,plinth:{h:.6,stone:true},
    front:{h:.9,c:'#c8a97c',style:'stone',rail:{h:1.2,c:'#f2f2f0',style:'bars'}},
    open:[{t:'arch',x:-3,w:3,h:2.2,y:0},{t:'window',x:-3,w:1.4,grille:true,frame:W},{t:'arch',x:2,w:3,h:2.2,y:0},{t:'window',x:2,w:1.4,shutters:W}]}),
  // precast concrete walls with wooden gates, back yards behind
  muro('S',836,850,'#a8a49c',2,{front:{h:2,c:'#a8a49c',gates:[{t:'gate',x:4,w:1.2,c:'#6a5a48'}]}}),
  muro('S',850,862,'#a8a49c',2,{front:{h:2,c:'#a8a49c',gates:[{t:'gate',x:3.6,w:1.4,c:'#6a5a48'}]}}),
  muro('S',862,867,'#9e9a92',2,{front:{h:2,c:'#9e9a92',gates:[{t:'gate',x:-.6,w:2.6,c:'#2a2c30'}]}}),

  // ======== Mato Grosso (870.6) → the fork (925.4) ========
  // east side (N), north → south: pale green house on a dark red podium, red iron railings
  L('N',874.5,885.5,{wall:'#c5d8a6',roof:'flat',fascia:'#c5d8a6',eave:.6,setback:1,plinth:{h:1.6,c:'#9c3a32'},
    front:{h:1.6,c:'#9c3a32',rail:{h:1,c:'#8a3a2e',style:'bars'}},
    open:[{t:'open',x:-1,w:5,h:2.2,y:1.6,c:'casa'},{t:'window',x:3.6,w:1.6,y:2.4,frame:'#3a3a3a'}]}),
  L('N',885.5,892,{wall:'#c5d8a6',roof:'hip',roofColor:'#9a9a94',setback:2,
    front:{h:.4,c:'#9c3a32',rail:{h:1.4,c:'#8a3a2e',style:'bars'}},open:[{t:'open',x:0,w:4,h:2.3,c:'casa'}]}),
  muro('N',892,896,'#efedea',2.6,{front:{h:2.6,c:'#efedea',gates:[{t:'garage',x:0,w:3,c:'#8a5a3a'}]}}),
  // nº 36: cream, brown bargeboards and plinth, brown shutters and a glazed wooden door
  L('N',896,903.3,{wall:'#ece0cc',roof:'gable',roofColor:T,fascia:'#6a3a2a',eave:.8,plinth:{h:.6,c:'#7a3a2a'},
    open:[{t:'window',x:-1.6,w:1.4,shutters:'#6a3a24',frame:W},{t:'glass',x:1.6,w:1.6,y:0,h:2.2,frame:'#6a3a24'}]}),
  // exposed-brick block beside a white house
  L('N',903.3,912,{wall:'#efefeb',roof:'gable',roofColor:T,panels:[{x:-2,w:4,c:'#b55e3a'}],open:[{t:'window',x:2.2,w:2.2,frame:'#3a3a3a'}]}),
  // cream house with a red gable and a red stone base, three arched windows behind red bars
  L('N',912,922,{wall:'#e9dcc2',roof:'gable',roofColor:T,fascia:'#a0392f',eave:.7,plinth:{h:1.2,c:'#9c3a32'},setback:1.5,
    front:{h:.8,c:'#9c3a32',rail:{h:1,c:'#8a3a2e',style:'bars'}},
    open:[{t:'door',x:-3,w:1.4,c:'#a0392f',awning:'#8a8a86'},{t:'arch',x:.4,w:.7,h:1.6},{t:'arch',x:1.8,w:.7,h:1.6},{t:'arch',x:3.2,w:.7,h:1.6}]}),
  // west side (S), north → south: the big white house behind a long granite-textured wall,
  // a brown wooden gate under a tiled entrance roof at the corner
  muro('S',874.5,884,'#c9c6be',2.4,{front:{h:2.4,c:'#c9c6be',gates:[{t:'gate',x:0,w:4.4,c:'#7a4a2e',awning:T}]},
    behind:{w:9,d:9,at:3,floors:2,roofColor:'#5a4a40',wall:'#f2f0ec'}}),
  muro('S',884,894,'#c4c1b8',1.8,{behind:{w:10,d:9,at:3,floors:2,roofColor:'#5a4a40',wall:'#f2f0ec'}}),
  muro('S',894,904,'#c4c1b8',1.8,{behind:{w:10,d:9,at:3,floors:2,roofColor:'#5a4a40',wall:'#f2f0ec'}}),
  muro('S',904,914,'#c4c1b8',1.8,{front:{h:1.8,c:'#c4c1b8',gates:[{t:'door',x:-3,w:1.2,c:'#6a4a32'}]},behind:{w:8,d:8,at:3,roofColor:'#5a4a40',wall:'#f2f0ec'}}),
  muro('S',914,921.5,'#c4c1b8',1.8),
];

export const TREES:Tree[]=[
  {side:'N',s:92,kind:'ficus'},{side:'N',s:160,kind:'reseda'},{side:'N',s:181,kind:'ficus'},{side:'N',s:226,kind:'ficus'},
  {side:'N',s:252,kind:'reseda'},{side:'N',s:259,kind:'reseda'},{side:'N',s:309,kind:'reseda'},
  {side:'N',s:676,kind:'reseda'},{side:'N',s:711,kind:'ficus'},{side:'N',s:719,kind:'reseda'},{side:'N',s:823,kind:'reseda'},
  {side:'S',s:77,kind:'ficus'},{side:'S',s:86,kind:'ficus'},{side:'S',s:97,kind:'ficus'},{side:'S',s:104,kind:'ficus'},
  {side:'S',s:118,kind:'ficus'},{side:'S',s:128,kind:'ficus'},{side:'S',s:136,kind:'ficus'},{side:'S',s:144,kind:'ficus'},
  {side:'S',s:168,kind:'ficus'},{side:'S',s:200,kind:'ficus'},{side:'S',s:226,kind:'ficus'},{side:'S',s:254,kind:'reseda'},
  {side:'S',s:318,kind:'reseda'},{side:'S',s:330,kind:'reseda'},{side:'S',s:372,kind:'reseda'},
  {side:'S',s:581,kind:'ficus'},{side:'S',s:611,kind:'ficus'},{side:'S',s:686,kind:'ficus'},{side:'S',s:719,kind:'reseda'},
  {side:'S',s:888,kind:'reseda'},{side:'S',s:900,kind:'reseda'},{side:'S',s:910,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  settStreets:['Rua Treze de Maio','Rua XV de Novembro','Rua Sete de Setembro','Rua José Augusto Machado','Rua São Vicente de Paula',
    'Rua Dom Alberto J. Gonçalves','Rua Yolanda Zamai Raimundo'],
  poles:{side:'N',start:20,every:34,transformers:[204,598,760]},
  keepOut:[
    {side:'N',s0:0,s1:66.2,why:'Posto Taurus and its oil-change bays (posto-taurus.ts)'},
    {side:'N',s0:371.5,s1:396,why:'gun shop game lot (sites-table.ts gunShop)'},
    {side:'N',s0:478.5,s1:563.6,why:'the Matriz squares (praca-ladislau.ts, praca-alcindo.ts)',walk:false},
  ],
};
