// Rua João Cabrera — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/jcb-N-*/ and jcb-S-*/, kept out of git; lot boundaries
// from the Microsoft building footprints). 525 m north→south from the Avenida Marginal by the
// river up to the Sete de Setembro, past the Praça Dom Bosco. `s` starts at the NORTH end, so
// side 'N' is the EAST side (left of a walker going south) and 'S' the WEST side.
//   s=119 R. Luis Bianchetti   s=172 R. Dom Antônio J. de Mello   s=218 R. Cel. José Leopoldino
//   s=290 R. Treze de Maio   s=365 R. Romeu Zanetti   s=429 R. XV de Novembro
//   s=465 R. João Cabral de Medeiros
// Left alone: the Casa dos Vidros (galpoes.ts, east side s 237–266) and the Praça Dom Bosco
// (east side s 433–462, pracas-centro.ts).
// Granite setts, asphalt in the middle stretch. Opening x is measured from the lot centre as SEEN
// FROM THE STREET (left negative): on the east side (N) left is NORTH (lower s), on the west side
// (S) left is SOUTH (higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua João Cabrera';
export const CROSS=[0,119.4,171.8,218.2,289.8,364.5,429.4,465.4,524.5];
const SURFACE:Surface[]=[[0,160,'sett'],[160,300,'asphalt'],[300,524.5,'sett']];
const T='#b0603f',W='#f1efe9',PRE='#cfcbc2',SPECK='#8e8e8a',ROUGH='#a8906e';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- Marginal → Luis Bianchetti
  // the white house: a white V-bar garage gate and a black door
  L('N',13.4,19.1,{wall:'#ecedee',roof:'flat',parapet:true,x:['dish'],open:[{t:'door',x:-1.8,w:.9,c:'#2a2a2a'},{t:'garage',x:1,w:3.4,c:W,grille:true}]}),
  // nº 404: the beige house with a porch, behind brick pillars and a white iron gate
  L('N',19.1,26.3,{wall:'#ddd0b8',roof:'hip',roofColor:'#8a4a32',setback:1.5,front:{h:.4,c:'#b86a48',rail:{h:1.4,c:W,style:'bars'}},
    open:[{t:'open',x:-1.4,w:2.4,h:2.3,c:'casa'},{t:'window',x:1.8,w:1.6,shutters:'#e8e0d0'}]}),
  // the brown roughcast gable house, its carport under a black shade net and an awning
  L('N',26.3,36.5,{wall:ROUGH,roof:'gable',roofColor:'#6a4a3a',fascia:W,
    open:[{t:'open',x:-1.4,w:4,h:2.4,c:'casa',awning:'#2a2a2a'},{t:'window',x:2.8,w:1.4,frame:W,awning:'#5a5a5a'}]}),
  // the salmon gable house with a carport behind a grey iron fence
  L('N',36.5,46.8,{wall:'#d06a68',roof:'gable',roofColor:'#8a8a86',fascia:W,setback:1,front:{h:.6,c:'#d06a68',rail:{h:1.2,c:'#a8acb0',style:'bars'}},
    open:[{t:'open',x:-2,w:3.4,h:2.3,c:'casa'},{t:'window',x:2,w:2,grille:true}]}),
  // the pink-beige house behind white railings set in arched wall panels
  L('N',46.8,56.2,{wall:'#ecd0b8',roof:'hip',roofColor:T,setback:2,front:{h:1.4,c:'#ecc8b0',rail:{h:.6,c:W,style:'bars'},gates:[{t:'gate',x:-2,w:2.6,c:W}]}}),
  // the stone-gabled house with two deep arched porches behind iron railings
  L('N',56.2,70,{wall:'#ece4d4',roof:'gable',roofColor:T,fascia:W,plinth:{h:.9,stone:true},setback:1,front:{h:.6,c:'#c8b498',style:'stone',rail:{h:1,c:'#7a7068',style:'bars'}},
    panels:[{x:0,w:13,stone:true,y0:2.6,y1:3.4}],open:[{t:'arch',x:-3,w:4.6,y:0,h:2.2,c:'casa'},{t:'arch',x:2.8,w:4.4,y:0,h:2.2,c:'casa'}]}),
  // the beige house with a clay porch roof behind a black iron fence
  L('N',70,76.1,{wall:'#e8d4bc',roof:'hip',roofColor:T,setback:1.5,front:{h:.6,c:'#c8b8a0',rail:{h:1,c:'#3a3a3a',style:'bars'}},open:[{t:'open',x:0,w:3,h:2.3,c:'casa',awning:T}]}),
  // the carport behind a dark green fence, a stone-tile pillar
  L('N',76.1,82,{wall:'#ece8e0',roof:'gableSide',roofColor:'#9a9a98',setback:1,front:{h:.4,c:'#5a7a6a',rail:{h:1.6,c:'#3a5a4a',style:'bars'}}}),
  // the bare-brick gable house with green arched doors behind the same green fence
  L('N',82,90,{wall:'#b8704a',roof:'gable',roofColor:'#3a2a24',fascia:W,setback:1,front:{h:.4,c:'#5a7a6a',rail:{h:1.6,c:'#3a5a4a',style:'bars'}},
    open:[{t:'arch',x:-1.6,w:2,y:0,h:2.2,c:'casa'},{t:'arch',x:1.6,w:2,y:0,h:2.2,c:'casa'}],panels:[{x:-1.6,w:1.8,c:'#3a8a5a',y0:0,y1:2.2},{x:1.6,w:1.8,c:'#3a8a5a',y0:0,y1:2.2}]}),
  // the house clad in diamond-patterned tiles, an open carport and barred windows
  L('N',90,97.5,{wall:'#a89684',roof:'hip',roofColor:T,open:[{t:'open',x:-2,w:2.4,h:2.3,c:'casa',grille:true},{t:'window',x:1.4,w:1.6,grille:true}]}),
  // the pale grey house with a porch behind a grey sheet fence and white pillars
  L('N',97.5,108,{wall:'#e4e2de',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:W,rail:{h:1,c:'#a8b0b8',style:'bars'},gates:[{t:'gate',x:-3.4,w:2.6,c:'#a8b0b8'}]},
    open:[{t:'open',x:.6,w:6,h:2.3,c:'casa'},{t:'window',x:-.6,w:1.4,shutters:'#8a9098'}]}),
  // the pink-beige gable house with a clay porch roof behind a red-brown iron fence
  L('N',108,115.6,{wall:'#d8c0bc',roof:'gable',roofColor:'#8a4a32',setback:1.5,front:{h:.4,c:'#d8c0bc',rail:{h:1.3,c:'#8a3a2a',style:'bars'}},
    open:[{t:'open',x:0,w:5,h:2.3,c:'casa',awning:T},{t:'window',x:-1.2,w:1.2,frame:'#5a2a2a'}]}),
  // --- Luis Bianchetti → Dom Antônio J. de Mello
  // the grey wall with a white gate, the clay roof behind
  L('N',123.2,130,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#a8acb0',gates:[{t:'gate',x:1.4,w:2.6,c:W}]}}),
  // the beige house behind a brown ornamental iron fence and two cypresses
  L('N',130,136.6,{floors:2,wall:'#e8d4c0',roof:'hip',roofColor:T,setback:2,front:{h:.8,c:'#e8d4c0',rail:{h:.8,c:'#7a3a2a',style:'lattice'}},open:[{t:'arch',x:0,w:1.2,y:1.2,h:1}]}),
  // the beige house with a wide grey garage door
  L('N',136.6,141.6,{wall:'#e8d4b0',roof:'hip',roofColor:T,open:[{t:'garage',x:0,w:4,c:'#a8acb0'}]}),
  // the brown board garage door under a fibre-cement roof
  L('N',141.6,146,{wall:'#ecd8b8',roof:'gableSide',roofColor:'#9a9a98',open:[{t:'garage',x:0,w:3.6,c:'#8a5a3a'}]}),
  // nº 364: the yellow house with a porch behind an iron gate
  L('N',146,151.8,{wall:'#e8c870',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:'#e8c870',rail:{h:1.3,c:'#8a6a4a',style:'bars'}},open:[{t:'open',x:0,w:3.6,h:2.3,c:'casa'},{t:'window',x:-1.8,w:1,grille:true}]}),
  // --- Dom Antônio J. de Mello → Cel. José Leopoldino
  // nº 340: the old beige house behind a brown fence
  L('N',189.4,193,{wall:'#ece4d0',roof:'gable',roofColor:'#9a9a98',setback:1,front:{h:.6,c:'#a86a5a',rail:{h:1,c:'#7a3a2a',style:'bars'}},open:[{t:'window',x:0,w:1.2,shutters:'#8a8c8e'}]}),
  // the pale blue gable house behind a grey wall and a rusty gate
  L('N',193,200.6,{wall:'#b8c8d8',roof:'gable',roofColor:'#8a4a32',fascia:W,setback:2,front:{h:1.2,c:'#a8a49c',gates:[{t:'gate',x:2,w:2.6,h:1.8,c:'#a8705a'}]},
    open:[{t:'window',x:-1.4,w:1.4,grille:true}]}),
  // --- Cel. José Leopoldino → Treze de Maio
  // the precast wall round an empty lot
  muro('N',225,236.7,PRE,2,{front:{h:2,c:PRE,style:'panel'}}),
  // --- Treze de Maio → Romeu Zanetti
  // nº 200: the green office with a stone-tile strip and a black name plaque
  L('N',311.4,322.5,{wall:'#6a8a5a',roof:'gable',roofColor:'#4a3a32',panels:[{x:-3.6,w:1.8,stone:true}],sign:{text:'',bg:'#1a1a1a',fg:'#e8e8e6',x:2.4,y:1.9,w:1.4,h:.8},
    open:[{t:'door',x:-4.6,w:1,c:'#3a5a3a'},{t:'gate',x:4.4,w:1.4,c:'#3a5a3a'}]}),
  // the beige house with brown louvres behind a beige wall and a brown sheet gate
  L('N',322.5,332,{wall:'#ecdcc4',roof:'gable',roofColor:'#5a4a40',setback:3,front:{h:2,c:'#ecdcc4',gates:[{t:'gate',x:-1.6,w:2.8,c:'#5a3a2a'}]}}),
  // the beige gable house in its flower garden, a white garage door
  L('N',332,343.4,{wall:'#ecdcc8',roof:'gable',roofColor:'#5a4a40',setback:2,front:{h:1,c:'#e8dccc',rail:{h:.6,c:'#7a3a2a',style:'bars'},gates:[{t:'gate',x:4,w:2.4,c:W}]},
    open:[{t:'window',x:-1.4,w:1.4,shutters:'#7a3a2a'}]}),
  // the grey two-storey house with a zigzag-railed balcony, white garage doors under clay hoods
  L('N',343.4,346.6,{floors:2,wall:'#9a9c9e',upper:'#e8e4dc',roof:'flat',parapet:true,
    open:[{t:'garage',x:0,w:2.4,c:W,awning:T},{t:'window',x:0,w:1.6,fl:1,shutters:'#8a8c8e'}]}),
  // --- Romeu Zanetti → XV de Novembro
  // the white house on a stone base with its glass-railed veranda round the corner
  L('N',383.1,390,{wall:'#f0eee8',roof:'hip',roofColor:T,plinth:{h:1.6,stone:true},
    open:[{t:'open',x:-1.2,w:3.6,h:2.4,y:1.6,c:'casa'},{t:'garage',x:2,w:2.4,c:'#2a2a2a',grille:true}]}),
  // the dark barred garage door by a stone pillar, a white wall and a tree
  L('N',390,397.4,{wall:'#f0eee8',roof:'gable',roofColor:T,open:[{t:'garage',x:-1.6,w:2.8,c:'#3a2a24',grille:true}]}),
  // the empty lot behind a weathered blue wall and a galvanized gate, a hibiscus over it
  muro('N',397.4,410,'#6a7a8a',2,{front:{h:2,c:'#6a7a8a',gates:[{t:'gate',x:-3,w:2.6,c:'#c8ccd0'}]}}),
  // (433–462: the Praça Dom Bosco)
  // --- João Cabral de Medeiros → Sete de Setembro
  // the white and olive two-storey corner building with a travel agency's sign
  L('N',469.2,476,{floors:2,wall:'#d8d8d4',upper:'#f0eee8',roof:'gable',roofColor:'#8a4a32',sign:{text:'VIAGENS',bg:'#ffffff',fg:'#8a2a5a',x:0,y:2.6,w:2.4,h:.6},
    open:[{t:'glass',x:-.4,w:2.4,y:.1,h:2.3,awning:'#c8c4bc'},{t:'window',x:0,w:1.2,fl:1,frame:'#5a3a2a'}]}),
  // the cream wall on an olive base with a window
  L('N',476,482.5,{wall:'#ece8c8',roof:'gable',roofColor:'#8a4a32',plinth:{h:1.6,c:'#7a8a4a'},open:[{t:'window',x:0,w:1.2,y:2,frame:'#5a3a2a'}]}),
  // the white house on a green base with steps up behind an iron gate
  L('N',482.5,488.9,{wall:'#f0eee8',roof:'hip',roofColor:T,plinth:{h:1,c:'#8aa878'},setback:1,front:{h:.4,c:W,rail:{h:1.2,c:W,style:'bars'}},open:[{t:'open',x:0,w:2.4,h:2.3,c:'casa'}]}),
  // nº 32: the beige house with a deep porch behind white railings, a white gate
  L('N',488.9,503,{wall:'#ece4d0',roof:'hip',roofColor:'#8a4a32',setback:2,front:{h:.6,c:'#ece4d0',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:3.6,w:3,c:W},{t:'gate',x:-5.4,w:1.2,c:W}]},
    open:[{t:'open',x:-1,w:7,h:2.3,c:'casa'}]}),
  // the CRAS — Casa da Família: the pink building with its sign board
  L('N',503,512,{d:7,wall:'#e8a8b0',roof:'gable',roofColor:'#8a4a32',sign:{text:'CRAS · CASA DA FAMÍLIA',bg:'#ffffff',fg:'#2a2a2a',x:-2,y:2.4,w:2.6,h:1.4},
    open:[{t:'gate',x:1.6,w:1,c:W},{t:'window',x:3.4,w:1.2,frame:W}]}),
  // the CRAS playground behind chain-link on a pink wall
  muro('N',512,520.7,'#e8a8b0',2,{front:{h:2,c:'#e8a8b0',style:'lattice'}}),
  // ================= WEST SIDE (S) =================
  // --- Marginal → Luis Bianchetti (3.8–14.8: the river bank trees)
  // the white roughcast wall topped with a fence, palms
  muro('S',22.5,27.9,'#e8e4dc',2.4,{front:{h:1.6,c:'#e8e4dc',rail:{h:.8,c:'#a8a8a4',style:'bars'}}}),
  // nº 465: the blue house with a sunburst iron gate and fence
  L('S',45.4,55,{wall:'#a8c0d8',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:'#a8c0d8',rail:{h:1.6,c:'#a8acb0',style:'bars'}},
    open:[{t:'open',x:1.6,w:4,h:2.3,c:'casa'},{t:'window',x:-2.6,w:2,grille:true}]}),
  // the beige house with a porch behind an iron fence on a red-brown base
  L('S',55,65.8,{wall:'#e8dcc8',roof:'hip',roofColor:T,setback:1,front:{h:.8,c:'#8a5a4a',rail:{h:1,c:'#7a5a4a',style:'bars'}},
    open:[{t:'open',x:3,w:3,h:2.3,c:'casa'},{t:'window',x:0,w:1.2,grille:true},{t:'window',x:-2.6,w:1.4,shutters:'#7a3a2a'}]}),
  // the small pink-beige two-storey with a white gate, the carport house beside it
  L('S',65.8,70,{floors:2,wall:'#e4d4c8',roof:'flat',parapet:true,open:[{t:'gate',x:0,w:1.2,c:W},{t:'window',x:0,w:1,fl:1,frame:'#3a3a3a'}]}),
  L('S',70,74.9,{wall:'#e8dcc8',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:'#e8dcc8',rail:{h:1.2,c:'#7a5a4a',style:'bars'}},open:[{t:'open',x:0,w:3,h:2.3,c:'casa'}]}),
  // the clay-roofed houses behind brown railings, a white slatted garage door
  L('S',74.9,85,{wall:'#e8dcc8',roof:'hip',roofColor:T,open:[{t:'garage',x:-2.4,w:3.4,c:W},{t:'open',x:2.6,w:3,h:2.3,c:'casa',grille:true}]}),
  // the grey block-tile wall with a brown sheet gate, the house behind
  L('S',85,93,{wall:'#ece4d4',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#9a9894',gates:[{t:'gate',x:.4,w:3,c:'#8a7a5a'}]}}),
  // nº 401: black sheet gates in a grey block-tile wall
  L('S',93,99,{wall:'#ece4d4',roof:'gable',roofColor:T,setback:3,front:{h:2.2,c:'#9a9894',gates:[{t:'gate',x:1.2,w:2.6,c:'#1a1a1a'},{t:'gate',x:-1.6,w:1.2,c:'#1a1a1a'}]}}),
  // the blue-grey corner house behind a white fence on a speckled wall, a clay porch hood
  L('S',99,115.6,{wall:'#b8bcc8',roof:'hip',roofColor:T,setback:1.5,front:{h:.9,c:SPECK,rail:{h:1,c:W,style:'bars'}},
    open:[{t:'window',x:5,w:1.8,shutters:W},{t:'window',x:1.4,w:1.4,frame:W},{t:'open',x:-3,w:2.2,h:2.3,c:'casa',awning:T},{t:'window',x:-6,w:1.6,shutters:W}]}),
  // --- Luis Bianchetti → Dom Antônio J. de Mello
  // the white roughcast house with a square-grid garage door and glass-block windows
  L('S',126,137.7,{wall:'#ecebe6',roof:'gable',roofColor:'#5a4a40',plinth:{h:1,c:'#b8b4ac'},
    open:[{t:'garage',x:3,w:3.6,c:W,grille:true},{t:'window',x:-.4,w:1.6,grille:true},{t:'door',x:-2,w:.8,c:W},{t:'window',x:-4.6,w:1.4,grille:true}]}),
  // the white-tiled two-storey house, a grey-railed balcony, a square-grid garage door
  L('S',137.7,143,{floors:2,wall:'#ece4d8',roof:'gable',roofColor:'#8a4a32',open:[{t:'garage',x:-1,w:2.6,c:W,grille:true},{t:'open',x:0,w:4,h:2,fl:1,c:'casa'}]}),
  // nº 375: the grey gate with a bar pattern
  L('S',143,148,{wall:'#ece4d8',roof:'hip',roofColor:T,open:[{t:'garage',x:0,w:4,c:'#9aa0a4',grille:true}]}),
  // the bare concrete and brick frame going up behind galvanized sheets
  L('S',148,154.2,{floors:2,wall:'#a8a49c',roof:'flat',setback:1,front:{h:2,c:'#b8bcc0',style:'corrugated'}}),
  // --- Dom Antônio J. de Mello → Cel. José Leopoldino
  // the empty lot behind a precast wall
  muro('S',178.6,188,PRE,1.6,{front:{h:1.6,c:PRE,style:'panel'}}),
  // nº 321: the pink house behind a pink wall with tall slit windows, a white gate
  L('S',188,200,{wall:'#ecc8c0',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:2,c:'#ecc8c0',gates:[{t:'gate',x:-2.4,w:2.6,c:W}]}}),
  // --- Cel. José Leopoldino → Treze de Maio
  // the empty lot behind chain-link with a black shade net
  muro('S',225,238,'#5a5a5a',2.2,{front:{h:2.2,c:'#3a3a3a',style:'lattice'}}),
  // the stone-clad house with white wavy-bar gates and white railings
  L('S',238,251.9,{wall:'#ecebe6',roof:'hip',roofColor:T,panels:[{x:0,w:14,stone:true,y0:0,y1:2.8}],
    open:[{t:'garage',x:4,w:3.6,c:W},{t:'open',x:-2,w:6,h:2.4,c:'casa',grille:true}]}),
  // LH Energy: the dark grey workshop with a red roll door and its signboard
  L('S',251.9,262.8,{wall:'#6a6e72',roof:'hip',roofColor:T,sign:{text:'LH ENERGY',bg:'#f0f0ee',fg:'#2a6aa8',x:-3,y:1.8,w:2,h:1.6},
    open:[{t:'garage',x:1,w:3.6,h:2.8,c:'#d82a2a'}]}),
  // the old yellow wall with OFICINA MECÂNICA · AUTO PEÇAS painted on it
  muro('S',262.8,274,'#e8d488',2.4,{sign:{text:'OFICINA MECÂNICA · AUTO PEÇAS',bg:'#e8d488',fg:'#2a2a2a',x:0,y:1.6,w:10,h:.8}}),
  // the crumbling plastered brick wall round a wooded yard
  muro('S',274,282.8,'#c8b8a0',2),
  // --- Treze de Maio → Romeu Zanetti
  // the speckled two-storey house: a white garage door, a barred door, the railed balcony above
  L('S',307.5,318.3,{floors:2,wall:'#c8bca8',upper:'#d8d4cc',roof:'flat',parapet:true,balcony:{x:0,w:10,fl:1,rail:'white',depth:1.2},
    open:[{t:'garage',x:-2.6,w:2.6,c:W},{t:'window',x:.6,w:1.6,grille:true},{t:'door',x:3,w:1.6,c:W,grille:true}]}),
  // Distribuidora Zamai under its round SKOL sign, a balcony with railings above
  L('S',318.3,329,{floors:2,wall:'#c8b8a0',upper:'#e8e0d8',roof:'flat',parapet:true,balcony:{x:0,w:10,fl:1,rail:'white',depth:1.4},
    sign:{text:'DISTRIBUIDORA ZAMAI',bg:'#f0e8d8',fg:'#2a2a2a',x:1,y:2.6,w:3.4,h:.5},
    open:[{t:'garage',x:1,w:2.4,c:'#c8ccd0'},{t:'window',x:-1.8,w:1.4,grille:true},{t:'door',x:-3.6,w:1,c:W}]}),
  // R&C: the grey building with grey louvred windows
  L('S',329,338.6,{wall:'#c8ccd4',roof:'hip',roofColor:T,plinth:{h:1,c:'#8a8e96'},sign:{text:'R&C',bg:'#d8e8f8',fg:'#2a5aa8',x:3.4,y:1.8,w:1.2,h:.6},
    open:[{t:'window',x:1.6,w:1.4,shutters:'#a8acb0'},{t:'window',x:-1.4,w:1.4,shutters:'#a8acb0'},{t:'open',x:-4,w:1.6,h:2.6,c:'geral'}]}),
  // nº 189: the body shop's open bay
  L('S',338.6,346.7,{wall:'#ecebe6',roof:'flat',parapet:true,plinth:{h:1.2,c:'#a8acb4'},open:[{t:'open',x:.6,w:3.6,h:2.8,c:'geral'},{t:'open',x:-2.9,w:1.4,h:2.6,c:'geral'}]}),
  // --- Romeu Zanetti → XV de Novembro
  // the beige house with a porch behind a white railing
  L('S',382,390.2,{wall:'#e8dcc8',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:'#8a5a4a',rail:{h:.8,c:W,style:'bars'}},open:[{t:'open',x:0,w:4,h:2.3,c:'casa'},{t:'window',x:-1,w:1.6,grille:true}]}),
  // nº 123 and nº 118: beige and grey roughcast houses with white barred garage gates
  L('S',390.2,398,{wall:'#ece4d0',roof:'gable',roofColor:'#3a3a3a',open:[{t:'open',x:2,w:2.6,h:2.4,c:'casa',grille:true},{t:'window',x:-1,w:1.6,grille:true},{t:'open',x:-3,w:1.2,h:2.4,c:'casa',grille:true}]}),
  L('S',398,408.8,{wall:'#9a9e9a',roof:'gable',roofColor:'#3a3a3a',plinth:{h:1.8,c:'#ecebe6'},
    open:[{t:'open',x:3,w:2.6,h:2.4,c:'casa',grille:true},{t:'open',x:0,w:2.4,h:2.4,c:'casa',grille:true},{t:'window',x:-3,w:1.6,grille:true}]}),
  // --- XV de Novembro → João Cabral de Medeiros
  // the pharmacy in red and white, Farmácia Popular
  L('S',442.2,447,{floors:2,wall:'#ffffff',upper:'#ffffff',roof:'flat',parapet:true,plinth:{h:.9,c:'#d82a3a'},sign:{text:'DROGARIA',bg:'#d82a3a',fg:'#ffffff',x:0,y:3.2,w:4.6,h:.6},
    open:[{t:'glass',x:0,w:2.4,y:.1,h:2.4,frame:'#d82a3a'}]}),
  // the grey-green house behind a white wall
  L('S',447,452,{wall:'#a8b098',roof:'gable',roofColor:'#5a5a58',setback:2,front:{h:1.4,c:W},open:[{t:'window',x:0,w:1.2,shutters:W}]}),
  // Multifarma: the red wall and the white shop under its red sign
  L('S',452,460.2,{wall:'#ffffff',roof:'flat',parapet:true,plinth:{h:1.2,c:'#d82a3a'},sign:{text:'MULTIFARMA',bg:'#d82a3a',fg:'#ffffff',x:1,y:3,w:5,h:.8},
    open:[{t:'glass',x:2,w:2.4,y:.1,h:2.4,frame:'#d82a3a'},{t:'door',x:-2,w:1,c:'#d82a3a'}]}),
  // --- João Cabral de Medeiros → Sete de Setembro
  // the long pale green building with rows of barred windows
  L('S',469.2,480,{wall:'#d0dcb8',roof:'gable',roofColor:'#5a5a58',plinth:{h:1,c:'#a8b4c0'},
    open:[{t:'window',x:-3,w:1.4,grille:true},{t:'window',x:0,w:1.4,grille:true},{t:'window',x:3,w:1.4,grille:true}]}),
  // the Fundo Social de Solidariedade: its white building and the sign on two posts
  L('S',480,490,{wall:'#ecebe6',roof:'gable',roofColor:'#9a9a98',setback:2,front:{h:1.6,c:'#ecebe6'},sign:{text:'FUNDO SOCIAL DE SOLIDARIEDADE',bg:'#ffffff',fg:'#2a5aa8',x:0,y:1,w:4,h:.8}}),
  // the long white wall, the vans' yard behind
  muro('S',490,512,'#ecebe6',2.6),
  muro('S',512,520.7,'#ecebe6',1.8,{front:{h:1.8,c:'#ecebe6',gates:[{t:'gate',x:-1,w:3.6,h:1.6,c:'#c8ccd0'}]}}),
];

export const TREES:Tree[]=[
  {side:'S',s:6,kind:'ficus'},{side:'S',s:26,kind:'palmeira'},{side:'S',s:34,kind:'palmeira'},
  {side:'N',s:132,kind:'ficus'},{side:'S',s:180,kind:'ficus'},{side:'N',s:404,kind:'ficus'},
  {side:'S',s:438,kind:'palmeira'},{side:'N',s:516,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:10,every:34},
  keepOut:[
    {side:'N',s0:236.7,s1:266,why:'the Casa dos Vidros (galpoes.ts)'},
    {side:'N',s0:266,s1:286,why:'the clothes shop (game site, sites-table.ts)'},
    {side:'N',s0:433,s1:461.6,why:'the Praça Dom Bosco (pracas-centro.ts)',walk:false},
    {side:'S',s0:3.8,s1:14.8,why:'the river bank trees'},
  ],
};
