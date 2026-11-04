// Rua Dom Antônio J. de Mello — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/dam-N-*/ and dam-S-*/, kept out of git; lot boundaries
// from the Microsoft building footprints). 395 m west→east from the Avenida Marginal by the
// river up to the Francisco Pereira de Souza. Side 'N' is the north side, 'S' the south.
//   s=84 R. João Cabrera   s=208 R. Barão do Rio Branco   s=288 R. Espírito Santo
// The corners on the Barão, the Espírito Santo, the Francisco Pereira de Souza and the Marginal
// are left to those streets' own corner lots (already surveyed): their houses' sides face here.
// Granite setts west of the João Cabrera, asphalt beyond. Opening x is measured from the lot
// centre as SEEN FROM THE STREET (left negative): on the north side (N) left is WEST (lower s),
// on the south side (S) left is EAST (higher s). Lot depth (d + setback) ≤ 12 m.
// Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Dom Antônio J. de Mello';
export const CROSS=[0,84.2,208.2,288.5,394.8];
const SURFACE:Surface[]=[[0,84.2,'sett'],[84.2,394.8,'asphalt']];
const T='#b0603f',W='#f1efe9',PRE='#cfcbc2',SPECK='#8e8e8a',BLOCK='#a8a090',TILE='#e4dccc';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE (N) =================
  // --- Marginal → João Cabrera (3.8–15.6: the grassy bank with mango trees and a coconut palm)
  // the bare concrete-block wall on the corner
  muro('N',15.6,24,BLOCK,2.6,{front:{h:2.6,c:BLOCK,style:'panel'}}),
  // nº 5: the beige tile-clad house, white bar grilles over the garage and the door
  L('N',24,36.5,{wall:TILE,d:11.5,roof:'hip',roofColor:T,x:['dish'],open:[{t:'garage',x:-1.6,w:5.4,h:2.3,c:W,grille:true},{t:'door',x:3.6,w:1.2,c:W,grille:true}]}),
  // the pink-beige flat-roofed house with a white roll garage door
  L('N',36.5,41,{wall:'#e8cdb8',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:2.6,c:W}]}),
  // the beige house with a white roll garage door
  L('N',41,45,{wall:'#d8b898',roof:'gable',roofColor:'#c8a07a',open:[{t:'garage',x:0,w:2.6,c:W}]}),
  // two white gates with X bars under a pale clay roof
  L('N',45,52,{wall:'#e4d2bc',roof:'hip',roofColor:'#c8a07a',open:[{t:'gate',x:-1.8,w:2.6,c:W,grille:true},{t:'gate',x:1.6,w:2.6,c:W,grille:true}]}),
  // the carport behind white bars between tile-clad pillars
  L('N',52,58,{wall:'#e4d2bc',roof:'hip',roofColor:'#c8a07a',setback:4,d:8,front:{h:.4,c:TILE,rail:{h:1.8,c:W,style:'bars'}}}),
  // nº 5A: the brown tile-clad wall with a white garage door, the pink house behind
  L('N',58,66,{wall:'#e8c4b0',roof:'gable',roofColor:T,setback:3,front:{h:2.6,c:'#8a4a32',gates:[{t:'gate',x:-.6,w:3,c:W},{t:'gate',x:-3.4,w:1.6,c:W}]}}),
  L('N',66,70,{wall:'#e8c4b0',roof:'gable',roofColor:T,setback:3,front:{h:2.4,c:'#8a4a32',gates:[{t:'gate',x:0,w:1,c:W}]}}),
  // the bare concrete and brick frame going up behind a galvanized sheet fence
  L('N',70,80.4,{floors:2,wall:'#a8a49c',roof:'flat',setback:2,front:{h:2.2,c:'#b8bcc0',style:'corrugated'}}),
  // --- João Cabrera → Barão do Rio Branco
  // the yellow corner house, a barred door and a grey louvred window
  L('N',88.6,98,{wall:'#e8d070',roof:'hip',roofColor:T,open:[{t:'door',x:-1.6,w:1,c:'#3a4a44',grille:true},{t:'window',x:2,w:1.4,shutters:'#7a8088'}]}),
  // nº 78: the brick-faced house with brown shutters behind a white railing of circles
  L('N',98,110,{wall:'#b8704a',roof:'hip',roofColor:T,setback:2,fascia:W,front:{h:.3,c:W,rail:{h:1.4,c:'#e8e0d8',style:'bars'}},
    open:[{t:'window',x:-3,w:2,shutters:'#6a3a2a'},{t:'door',x:.4,w:1,c:'#7a4a2a'},{t:'window',x:3.2,w:2.2,shutters:'#6a3a2a'}]}),
  // nº 55: the yellow gable house with its porch behind a brown iron fence
  L('N',110,119,{wall:'#e8d078',roof:'gable',roofColor:'#8a5a3a',setback:2,front:{h:.3,c:'#e8d078',rail:{h:1.4,c:'#8a6a4a',style:'bars'}},
    open:[{t:'open',x:-1.4,w:3.6,h:2.4,c:'casa'},{t:'window',x:2.4,w:1.8,grille:true}]}),
  // the pale grey house behind a grey wall, a white gate under a clay hood
  L('N',119,129,{wall:'#c8c8c4',roof:'gable',roofColor:'#8a5a3a',setback:3,front:{h:2.2,c:'#b8b8b4',gates:[{t:'gate',x:-1.6,w:2.6,c:W,awning:T}]}}),
  // nº 65: the beige tile-clad wall, a grey barred door under a clay hood
  L('N',129,140,{wall:'#ecebe6',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:TILE,style:'panel',gates:[{t:'gate',x:-.4,w:1.2,c:'#8a9098',awning:T}]}}),
  // a wooden garage gate in a tile-clad wall, the white house behind
  L('N',140,147,{wall:'#f0eee8',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:TILE,gates:[{t:'gate',x:-.6,w:2.8,c:'#8a5a30'}]}}),
  L('N',147,151,{wall:'#f0eee8',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:TILE,gates:[{t:'gate',x:-.6,w:1.4,c:'#6a6e72'},{t:'gate',x:1,w:1.2,c:'#8a5a30'}]}}),
  // nº 47: the white house with grey louvres behind a beige block-tile wall, a grey door
  L('N',151,162,{wall:'#f0eee8',roof:'gable',roofColor:T,setback:2,front:{h:1.6,c:'#e0d4bc',gates:[{t:'gate',x:2.4,w:1.2,c:'#9aa8b0'},{t:'gate',x:4.4,w:2.6,c:'#9aa8b0'}]},
    open:[{t:'window',x:-1.6,w:2,shutters:'#9aa8b0'},{t:'window',x:1,w:1.2,grille:true}]}),
  // the grey-beige gable house: a wooden gate, a barred window full of potted plants
  L('N',162,172,{wall:'#bab2a4',roof:'gable',roofColor:'#8a8a86',fascia:W,setback:1,front:{h:.6,c:'#bab2a4',rail:{h:1.2,c:'#9a9a98',style:'bars'},gates:[{t:'gate',x:-3,w:2.6,c:'#a8784a'}]},
    open:[{t:'window',x:1,w:2,grille:true},{t:'window',x:4,w:1,shutters:'#a8784a'}]}),
  // the lilac house with pink-striped pillars, big glass panes, a pale clay roof
  L('N',172,184,{wall:'#ece6ec',roof:'hip',roofColor:'#d8c8b4',panels:[{x:-4.6,w:.8,c:'#c8a8c0'},{x:-1.4,w:.8,c:'#c8a8c0'},{x:2,w:.8,c:'#c8a8c0'}],
    open:[{t:'glass',x:-3,w:1.6,y:.3,h:2},{t:'glass',x:.3,w:2.2,y:.3,h:2},{t:'door',x:3.4,w:1,c:W}]}),
  // the white house behind a white precast wall, a white slatted gate
  L('N',184,190.2,{wall:'#f0eee8',roof:'flat',parapet:true,setback:3,front:{h:2,c:'#ecebe6',style:'panel',gates:[{t:'gate',x:-4,w:2.6,c:W}]}}),
  // --- Barão do Rio Branco → Espírito Santo
  L('N',226.2,232,{wall:'#e8dcc4',roof:'hip',roofColor:T,open:[{t:'window',x:-1.4,w:1.4,grille:true,frame:W},{t:'window',x:1.6,w:1.4,grille:true,frame:W}]}),
  // the concrete-block wall with a grey sheet gate, the yellow house behind
  L('N',232,247,{wall:'#e4c88a',roof:'gable',roofColor:T,setback:4,d:8,front:{h:2,c:'#c8c0b0',gates:[{t:'gate',x:4,w:3,c:'#b8bcc0'}]}}),
  // the pink house: white louvred and barred windows, a low pink wall, a white sheet gate
  L('N',247,262,{wall:'#e0a098',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#e0a098',gates:[{t:'gate',x:3.4,w:2.6,c:W}]},
    open:[{t:'window',x:-3,w:2,shutters:W},{t:'window',x:.4,w:2,grille:true},{t:'open',x:3.6,w:2.4,h:2.3,c:'casa'}]}),
  // the yellow gable house with a porch behind a white iron fence
  L('N',262,270,{wall:'#e0c890',roof:'gable',roofColor:T,setback:2,front:{h:.3,c:'#c8a878',rail:{h:1.3,c:W,style:'bars'}},
    open:[{t:'window',x:-2,w:1.4,shutters:'#8a8c8e'},{t:'open',x:1.6,w:3,h:2.3,c:'casa'}]}),
  // --- Espírito Santo → Francisco Pereira de Souza
  // the pink house behind a barred gate, then a high grey block wall
  L('N',306.5,310,{wall:'#e8c8b8',roof:'hip',roofColor:T,setback:2,d:4,front:{h:.6,c:'#c8c0b0',rail:{h:1.4,c:'#8a8c8e',style:'bars'}}}),
  muro('N',310,316,'#8a8c8a',2.2),
  // the grey double gate under a clay hood
  L('N',316,320.5,{wall:'#ecebe6',roof:'hip',roofColor:T,setback:3,d:8,front:{h:2.4,c:'#8a8c8a',gates:[{t:'gate',x:0,w:2.8,c:'#a8b4c0',awning:T}]}}),
  // nº 255: the bare-brick gable house behind white X-bar gates in a lilac wall
  L('N',320.5,333,{wall:'#a85a3a',roof:'gable',roofColor:'#3a2a24',setback:2,front:{h:2.4,c:'#c8b0b0',gates:[{t:'gate',x:-4,w:1.4,c:W},{t:'gate',x:0,w:5.6,c:W},{t:'gate',x:4.6,w:1.6,c:'#8a6a4a'}]}}),
  // the wooden garage gate and a grey door in a beige wall
  L('N',333,340,{wall:'#e4d0b8',roof:'hip',roofColor:T,open:[{t:'garage',x:-1.2,w:3,c:'#8a5a30'},{t:'door',x:1.4,w:.9,c:'#9aa0a4'},{t:'window',x:3,w:1.4,grille:true}]}),
  // the zigzag stone-clad wall with a dark grille door, a big tree in front
  L('N',340,347,{wall:'#ecebe6',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:'#c8c4bc',style:'stone',gates:[{t:'gate',x:1.6,w:1.4,c:'#2a2a2a'}]}}),
  // the beige gable house with its porch behind a red-brown lattice fence
  L('N',347,360,{wall:'#e4d4bc',roof:'gable',roofColor:'#8a3a2a',setback:2,front:{h:.9,c:'#e4d4bc',rail:{h:1,c:'#a8503a',style:'lattice'},gates:[{t:'gate',x:-2,w:1.4,c:'#a8503a'}]},
    open:[{t:'open',x:-2,w:3,h:2.3,c:'casa'},{t:'window',x:2,w:1.6,shutters:'#a8402a',frame:W}]}),
  // the grey house behind white X-bar gates under clay hoods
  L('N',360,371,{wall:'#9a9898',roof:'gable',roofColor:T,setback:3,front:{h:2.4,c:'#9a9898',gates:[{t:'gate',x:-3.4,w:3,c:W,awning:T},{t:'gate',x:3,w:3,c:W,awning:T}]}}),
  // the cream wall topped with razor wire
  muro('N',371,376.8,'#e8dcc0',2.6),
  // ================= SOUTH SIDE (S) =================
  // --- Marginal → João Cabrera
  // the gas depot's blue chain-link gate
  muro('S',9,14,'#b8bcc0',2.2,{front:{h:2.2,c:'#8090b0',style:'corrugated'}}),
  // Ideal Gás: the terracotta building on a blue base, NACIONAL GÁS
  L('S',14,20.2,{wall:'#c86a3a',roof:'gableSide',roofColor:'#2a4a8a',plinth:{h:1.1,c:'#2a5aa8'},
    sign:{text:'IDEAL GÁS  3663-1531',bg:'#c86a3a',fg:'#ffffff',x:0,y:2,w:5.4,h:.7},open:[{t:'window',x:1.6,w:1.2,frame:'#2a2a2a'}]}),
  // the green house with octagonal white grilles and a white bar garage under a clay roof
  L('S',20.2,31,{wall:'#a8c078',roof:'hip',roofColor:T,x:['heater'],
    open:[{t:'door',x:3.6,w:.9,c:W},{t:'window',x:.6,w:2.6,grille:true,frame:W},{t:'garage',x:-3,w:3.4,c:W,grille:true,awning:T}]}),
  // the green roughcast gable house behind a tiled low wall and a railing
  L('S',31,42,{wall:'#a8c8a8',roof:'gable',roofColor:'#5a4a40',setback:2,front:{h:.8,c:'#d8ccb4',rail:{h:.8,c:'#5a5a58',style:'bars'}},
    open:[{t:'window',x:1.6,w:1.4,shutters:'#8a5a30',frame:'#e8dcc0'},{t:'window',x:-1.4,w:1.4,frame:'#e8dcc0'}]}),
  // the green house with a carport behind an iron gate
  L('S',42,48,{wall:'#a8c8a8',roof:'gable',roofColor:'#5a4a40',open:[{t:'open',x:0,w:3.2,h:2.4,c:'casa',grille:true}]}),
  // the white gate with a round motif under a clay hood in a stone-tile wall
  L('S',48,55,{wall:'#c8c8c4',roof:'gable',roofColor:'#d8c8b4',setback:3,front:{h:2.4,c:'#d8c4a4',gates:[{t:'gate',x:.6,w:3.4,c:W,awning:T}]}}),
  // the pink house behind a stone-tile wall topped with white railings
  L('S',55,65,{wall:'#e8c4b0',roof:'hip',roofColor:T,setback:2,front:{h:1.8,c:'#d8c4a4',rail:{h:1,c:W,style:'bars'}},
    open:[{t:'window',x:-1.4,w:1.6,shutters:W}]}),
  // the overgrown lot behind a precast wall and a rusty gate
  muro('S',66,80.4,PRE,1.8,{front:{h:1.8,c:PRE,style:'panel',gates:[{t:'gate',x:5,w:2.6,c:'#a86a4a'}]}}),
  // --- João Cabrera → Barão do Rio Branco
  // the precast wall, the old houses behind it
  muro('S',88,100,PRE,2,{front:{h:2,c:PRE,style:'panel'}}),
  // the old white house with a little porch behind a low wall and a rusty sheet gate
  L('S',100,110,{wall:'#ece8e0',roof:'hip',roofColor:'#8a4a32',setback:4,d:8,front:{h:1.2,c:'#b8b4ac',gates:[{t:'gate',x:2,w:2,h:2,c:'#c8a088'}]}}),
  // the grey-white house: barred windows, a carport behind an iron gate under clay tiles
  L('S',110,120,{wall:'#d8d4c8',roof:'hip',roofColor:T,setback:1,
    open:[{t:'window',x:2,w:1.8,grille:true},{t:'open',x:-2.2,w:3.4,h:2.4,c:'casa',awning:T}]}),
  // the mauve gable house with a carport, a brown louvred window, an iron fence
  L('S',120,128,{wall:'#b8a0a0',roof:'gable',roofColor:'#5a4a40',setback:1,front:{h:.5,c:'#c8b0b0',rail:{h:1.2,c:'#8a8c8e',style:'bars'}},
    open:[{t:'open',x:1.6,w:2.8,h:2.4,c:'casa'},{t:'window',x:-1.6,w:1.4,shutters:'#7a5a3a',frame:W}]}),
  // the cream house with a porch, a wooden door, a white sheet garage door
  L('S',128,140,{wall:'#ecdcbc',roof:'hip',roofColor:'#8a8a86',
    open:[{t:'open',x:2.4,w:3.4,h:2.3,c:'casa'},{t:'door',x:-.2,w:1,c:'#8a4a2a'},{t:'garage',x:-3.4,w:2.6,c:W}]}),
  // the grey-beige gable house: a white barred window, a white gate under a carport roof
  L('S',140,148,{wall:'#cac2b2',roof:'gable',roofColor:'#5a4a40',fascia:W,
    open:[{t:'window',x:1.8,w:2,grille:true,frame:W},{t:'gate',x:-2.2,w:3,c:W,awning:'#8a8a86'}]}),
  // nº 58: the grey-beige house, a white louvred window and a barred one
  L('S',148,155,{wall:'#cac2b2',roof:'hip',roofColor:T,plinth:{h:.5,c:'#b8a070'},
    open:[{t:'window',x:1.4,w:1.4,shutters:W,frame:W},{t:'window',x:-1.4,w:1.8,grille:true,frame:W}]}),
  // the cream house with arches on a brick base, behind a brown iron fence
  L('S',155,163,{wall:'#ecdcc8',roof:'hip',roofColor:T,setback:2,plinth:{h:.9,c:'#b8603e'},front:{h:.4,c:'#b8603e',rail:{h:1.4,c:'#8a6a4a',style:'bars'}},
    open:[{t:'arch',x:1.6,w:1.6,y:.9,h:1.2,c:'#7a4a2a'},{t:'open',x:-2,w:3,h:2.2,c:'casa'}]}),
  // the blue house, a grey sheet gate under a corrugated awning
  L('S',163,171,{wall:'#58b8d8',roof:'hip',roofColor:T,open:[{t:'window',x:2.6,w:2,frame:'#2a4a8a'},{t:'garage',x:-1.4,w:4.6,c:'#a8b0b8',awning:'#9a9a98'}]}),
  // the turquoise house on a white tile base, grey louvres and a barred window
  L('S',171,180,{wall:'#60c8d8',roof:'hip',roofColor:T,plinth:{h:1.1,c:'#e8e8e6'},
    open:[{t:'window',x:1.6,w:2,shutters:'#9aa0a4'},{t:'window',x:-1.4,w:2,grille:true,awning:'#8a8c8e'}]}),
  // nº 76: the beige house on a dark red base: big black windows under awnings, a brown gate
  L('S',180,189,{wall:'#d8c4a8',roof:'hip',roofColor:T,plinth:{h:.8,c:'#7a3a2a'},
    open:[{t:'window',x:1.4,w:2.6,frame:W},{t:'window',x:-1.4,w:1.8,frame:W,awning:'#5a5a5a'},{t:'gate',x:-3.4,w:2,c:'#5a3a2a'}]}),
  // --- Barão do Rio Branco → Espírito Santo
  // the pale green house on a stone base: arched louvred windows, a brown garage, red railings
  L('S',226.2,234,{wall:'#dcd8b8',roof:'hip',roofColor:T,plinth:{h:1.6,stone:true},
    open:[{t:'arch',x:1.8,w:2.4,y:2.1,c:'#a8907a'},{t:'garage',x:-1.8,w:3.4,c:'#5a4a3a'}]}),
  // Funerária Rosa Mística: the big brown sheet gate and the name window
  L('S',234,247,{wall:'#e4e2de',roof:'gableSide',roofColor:'#b8b8b4',
    sign:{text:'FUNERÁRIA ROSA MÍSTICA',bg:'#3a2a2a',fg:'#e8c8d8',x:4.2,y:1.8,w:2.4,h:.8},
    open:[{t:'garage',x:-1.6,w:7,h:3.2,c:'#6a5a4a'}]}),
  // nº 156: the white house with a dark barred garage door
  L('S',247,254,{wall:'#e4e2de',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:3,c:'#4a3a2a',grille:true}]}),
  // the empty lot behind a precast wall
  muro('S',254,270.5,PRE,1.6,{front:{h:1.6,c:PRE,style:'panel'}}),
  // --- Espírito Santo → Francisco Pereira de Souza
  // the beige house behind a grey sheet gate (the green Assembleia de Deus behind)
  L('S',306.5,314,{wall:'#e8d8b8',roof:'hip',roofColor:T,setback:2.5,x:['ac'],front:{h:2,c:'#ecebe6',gates:[{t:'gate',x:1.4,w:3,c:'#a8b4c0'}]}}),
  // the white wall with a grey sheet gate
  muro('S',314,319,'#ecebe6',2,{front:{h:2,c:'#ecebe6',gates:[{t:'gate',x:-1.4,w:1.4,c:'#a8b4c0'}]}}),
  // the lilac house behind black X-bar gates
  L('S',319,326,{wall:'#e4dce0',roof:'hip',roofColor:T,setback:3,front:{h:2.2,c:'#c8b0b0',gates:[{t:'gate',x:0,w:5,c:'#2a2a2a'}]}}),
  // the brick-tiled house behind black X-bar gates, a lilac pillar wall
  L('S',326,333,{wall:'#c86a48',roof:'hip',roofColor:T,setback:3,front:{h:2.2,c:'#c8b0b0',gates:[{t:'gate',x:1,w:4,c:'#2a2a2a'}]}}),
  // the brick-tiled gable house with a porch, grey louvred windows
  L('S',333,341,{wall:'#c86a48',roof:'gable',roofColor:'#3a2a24',open:[{t:'window',x:-1,w:1.4,shutters:'#a8acb0',frame:W},{t:'window',x:2,w:1.4,shutters:'#a8acb0',frame:W},{t:'open',x:-3.2,w:1.6,h:2.3,c:'casa'}]}),
  // the grey house with green glass doors on a mosaic base, a white gate
  L('S',341,349,{wall:'#d8d6d2',roof:'gable',roofColor:'#3a2a24',plinth:{h:.9,c:'#c8c0b8'},
    open:[{t:'window',x:2.4,w:1.6,shutters:W},{t:'glass',x:-.6,w:2.4,y:.6,h:1.6},{t:'door',x:-2.4,w:.9,c:'#3a6a5a'}]},'mosaico'),
  // the peach house with a porch, a brown louvred window, a white garage door
  L('S',349,357,{wall:'#ecc8b0',roof:'gable',roofColor:'#5a4a40',open:[{t:'window',x:3,w:1.4,shutters:'#8a5a30'},{t:'open',x:.4,w:2.6,h:2.3,c:'casa'},{t:'garage',x:-2.8,w:2.4,c:W}]},'mosaico'),
  L('S',357,364,{wall:'#ecc8b0',roof:'gable',roofColor:'#5a4a40',open:[{t:'window',x:1,w:1.4,shutters:'#8a5a30'},{t:'gate',x:-2.2,w:2,c:'#8a6a4a'}]}),
  // the white roughcast house with a porch behind an iron fence
  L('S',364,372,{wall:'#e8e8e4',roof:'gable',roofColor:'#5a4a40',setback:2,front:{h:.3,c:SPECK,rail:{h:1.3,c:'#3a3a3a',style:'bars'}},
    open:[{t:'window',x:-1.6,w:1.6,shutters:'#8a94a0'},{t:'open',x:1.4,w:2.4,h:2.3,c:'casa'}]}),
  // the green roughcast gable house with a wooden gable and a carport
  L('S',372,376.8,{wall:'#88a878',roof:'gable',roofColor:'#5a3a2a',d:9,open:[{t:'window',x:1,w:1.6,shutters:'#b8c0c8',frame:W},{t:'open',x:-1.4,w:1.4,h:2.3,c:'casa'}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:6,kind:'palmeira'},{side:'N',s:11,kind:'ficus'},
  {side:'N',s:342,kind:'ficus'},
  {side:'S',s:72,kind:'ficus'},{side:'S',s:80,kind:'ficus'},
  {side:'S',s:198,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:20,every:34},
};
