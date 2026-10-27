// Rua Bernadino Franchi — surveyed lot by lot from Google Street View (2024–2026 imagery; one
// view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/bf-N-*/ and bf-S-*/, kept out of git). The street
// runs 637 m north→south from the Avenida Marginal, up through the centre, past the XV, down to
// the lake square at the Décio Queiróz Telles.
//   s=126 R. Padre Vicente Major   s=167 R. Antônio de Melo   s=233 R. do Acre
//   s=256 R. Cel. José Leopoldino   s=346 R. Treze de Maio   s=403 R. Romeu Zanetti
//   s=471 R. XV de Novembro / Lourival Medeiros   s=536 R. Eunice Machado Franchi
//   s=579 R. Sete de Setembro   s=587 Av. Dep. Décio Queiróz Telles
// Asphalt at both ends, setts through the centre. Side 'N' is the EAST side (left of a walker
// going +s, i.e. south). Opening x is measured from the lot centre as SEEN FROM THE STREET
// (left negative). The corner businesses already in comercio/lojas.ts (Mãe Rainha, Bradesco,
// MyComp, MultiDrogas, Toda Chic, SB Celulares…) are left where they are. Lot depth
// (d + setback) ≤ 12 m. Pure data.
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Bernadino Franchi';
export const CROSS=[0,126.4,167,233.4,256.2,346.1,402.9,471.2,536.3,579.1,586.6,636.8];
const SURFACE:Surface[]=[[0,233.4,'asphalt'],[233.4,536.3,'sett'],[536.3,636.8,'asphalt']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- Marginal → Padre Vicente Major
  // nº 914: the brown speckled corner house behind a red iron fence, a brown tarp over the carport
  L('N',6,18,{wall:'#8a7058',roof:'gable',roofColor:'#6a5a4a',fascia:'#5a4a40',setback:2,front:{h:.4,c:'#8a5a4a',rail:{h:1.4,c:'#7a3a2a',style:'bars'}},
    open:[{t:'window',x:-2.4,w:2.6,grille:true},{t:'open',x:2.6,w:4,h:2.2,c:'casa',awning:'#8a4a32'}]}),
  // the stone-clad house with a white garage and a tiled door hood
  L('N',18,28,{wall:'#a8805a',roof:'gable',roofColor:'#6a6c70',fascia:W,panels:[{x:0,w:10,stone:true}],open:[{t:'door',x:-3.6,w:1,c:W,awning:T},{t:'window',x:-.6,w:2,shutters:W},{t:'garage',x:2.8,w:3.2,c:W}]}),
  // a cream cottage with a barred door; a cream house with brown shutters
  L('N',28,36,{wall:'#e6d8c4',roof:'gable',roofColor:T,setback:1,front:{h:1.2,c:'#e6d8c4',gates:[{t:'gate',x:-2.6,w:2,c:W}]},open:[{t:'open',x:0,w:1.8,h:2.2,c:'casa'},{t:'window',x:2.4,w:1.2,shutters:'#8a5a3a'}]}),
  L('N',36,42,{wall:'#ecdcc8',roof:'gable',roofColor:T,open:[{t:'window',x:0,w:1.6,shutters:'#8a5a3a'}]}),
  // the green speckled house behind a grey fence, a barred carport, a grey sheet garage
  L('N',42,50,{wall:'#7a9a6a',roof:'gable',roofColor:'#6a6c70',fascia:W,setback:2,front:{h:.4,c:'#8a8c8e',rail:{h:1.2,c:'#5a5c60',style:'bars'}},open:[{t:'window',x:-2,w:1.6,shutters:'#5a8a5a',frame:W},{t:'window',x:1.6,w:1,frame:W}]}),
  L('N',50,56,{wall:'#7a9a6a',roof:'gable',roofColor:'#6a6c70',fascia:W,open:[{t:'gate',x:-1,w:2.4,c:W},{t:'garage',x:1.8,w:2.4,c:'#9aa8b8'}]}),
  // a grey house with a barred window, a big grey sheet gate under a stepped block wall
  L('N',56,62,{wall:'#9a9c9a',roof:'gable',roofColor:T,open:[{t:'window',x:-.8,w:1.6,shutters:'#a8acb0'},{t:'door',x:1.8,w:.9,c:'#8a7a6a'}]}),
  L('N',62,70,{wall:'#8a8a86',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:5,c:'#c8c8c4'}]}),
  // the vegetable plot behind precast walls and black shade cloth (vende-se verduras)
  muro('N',70,84,'#b8b4aa',1.6,{sign:{text:'VENDE-SE VERDURAS',bg:'#ffffff',fg:'#2a2a2a',x:-3,y:1.8,w:1.6,h:.5}}),
  // the grey speckled gable with a blue garage door
  L('N',84,92,{wall:'#8a8c8e',roof:'gable',roofColor:'#9aa0a3',fascia:W,open:[{t:'garage',x:-1,w:3,c:'#8aa0b8'},{t:'window',x:2.4,w:1.2,shutters:'#8aa0b8'}]}),
  // the brown house behind a cream precast wall and gate
  L('N',92,100,{wall:'#7a4a32',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:1.8,c:'#e6dcc8',gates:[{t:'gate',x:-2.4,w:1.4,c:'#a8b4c0'}]},open:[{t:'window',x:1,w:1.8,grille:true,frame:W}]}),
  L('N',100,106,{wall:'#7a4a32',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:1.8,c:'#e6dcc8',gates:[{t:'gate',x:1,w:1.4,c:'#a8b4c0'}]},open:[{t:'window',x:-1,w:1.2,frame:W}]}),
  // the white house behind white walls and a white sheet gate
  L('N',106,116,{wall:'#ece8e2',roof:'gable',roofColor:'#5a6068',fascia:'#5a6068',setback:3,front:{h:2,c:'#ece8e2',gates:[{t:'gate',x:-2.6,w:3.4,c:'#ece8e2'}]},open:[{t:'window',x:1,w:2,frame:'#3a3a3a'}]}),
  // the beige house on a brown base, a tiled carport, white barred gates
  L('N',116,122.6,{wall:'#ecdcc0',roof:'hip',roofColor:T,plinth:{h:1,c:'#7a5a3a'},open:[{t:'gate',x:-1.4,w:3,c:'#ece4d6',awning:T},{t:'window',x:2,w:1.6,grille:true}]}),
  // --- Padre Vicente Major → Antônio de Melo
  // the lime-green corner house with arches and a white balustrade over a brick base
  L('N',130.2,140,{wall:'#dce4a8',roof:'hip',roofColor:T,plinth:{h:.9,c:'#a85a3a'},setback:2,front:{h:.9,c:'#a85a3a',rail:{h:.8,c:W,style:'bars'}},
    open:[{t:'arch',x:-2.4,w:2.6,h:2.4,y:0},{t:'arch',x:1.6,w:2.6,h:2.4,y:0}]}),
  L('N',140,148,{wall:'#dce4a8',roof:'hip',roofColor:T,setback:2,front:{h:.9,c:'#a85a3a',rail:{h:.8,c:W,style:'bars'},gates:[{t:'gate',x:2,w:3,c:W}]},open:[{t:'arch',x:-1.6,w:2.4,h:2.4,y:0}]}),
  // a beige wall with a grey sheet gate under a tiled hood, a white house behind
  L('N',148,156,{wall:'#ecdcc8',roof:'gable',roofColor:T,setback:2,front:{h:2.2,c:'#d8c4a8',gates:[{t:'gate',x:1,w:3,c:'#a8b0b8',awning:T}]},open:[{t:'window',x:-2,w:1.6,frame:'#2a2a2a'}]}),
  // the little white gable house behind a brown speckled wall
  L('N',156,162,{wall:'#ece8e2',roof:'gable',roofColor:T,setback:3,front:{h:1.4,c:'#8a5a3a'},open:[{t:'window',x:-1,w:1.4,frame:'#3a3a3a'},{t:'open',x:1.6,w:1.4,h:2.2,c:'casa'}]}),
  // the pink sobrado over its grey garage, an iron balcony
  L('N',162,170,{floors:2,wall:'#ecc8b8',roof:'flat',parapet:true,open:[{t:'window',x:-2,w:2.4,grille:true},{t:'garage',x:1.6,w:3,c:'#c8d0d8'},{t:'window',x:0,w:3,fl:1}],balcony:{x:0,w:8,fl:1,rail:'iron'}}),
  // the tractor workshop: a beige wall with a blue sheet gate, the open gable shed beside it
  muro('N',170,180,'#ddd0b8',2.4,{front:{h:2.4,c:'#ddd0b8',gates:[{t:'gate',x:2,w:3.6,c:'#2a4a9a'}]},behind:{w:10,d:9,at:2,roof:'gable',roofColor:'#9aa0a3',wall:'#ddd0b8'}}),
  L('N',180,190,{wall:'#ece4d6',roof:'gable',roofColor:'#9aa0a3',fascia:'#6a6c70',open:[{t:'open',x:0,w:7,h:3.4,c:'casa'}]}),
  // the yellow house with a diamond-patterned porch rail, a tiled carport
  L('N',190,200,{wall:'#ecdcb0',roof:'hip',roofColor:T,setback:1,front:{h:.8,c:'#d8806a',rail:{h:.6,c:'#3a3a3a',style:'bars'}},open:[{t:'window',x:-3,w:2.2,frame:'#5a3a2a'},{t:'open',x:1.6,w:4,h:2.3,c:'casa'}]}),
  // a cream gable house where the Acre comes in
  L('N',200,206,{d:9,wall:'#ecdcc4',roof:'gable',roofColor:T,open:[{t:'window',x:0,w:1.4,shutters:'#8a5a3a'}]}),
  // --- Acre → Cel. José Leopoldino
  // the grey speckled house with sky-blue shutters and a blue awning, a blue gate
  L('N',237.6,246,{wall:'#8f9496',roof:'gable',roofColor:T,fascia:'#4a7ab0',open:[{t:'window',x:-2,w:1.6,shutters:'#6a9ad0',frame:W},{t:'door',x:1.2,w:1,c:'#6a9ad0',awning:'#4a7ab0'},{t:'gate',x:3,w:1.2,c:'#6a9ad0'}]}),
  // the old cream corner house on a red base
  L('N',246,252.4,{wall:'#ecdcc4',roof:'hip',roofColor:'#8a4a32',plinth:{h:.5,c:'#b8604a'},open:[{t:'window',x:-1.4,w:1.2,frame:W},{t:'open',x:1.4,w:1.8,h:2.2,c:'casa'}]}),
  // --- Cel. José Leopoldino → Treze de Maio
  // the cream corner house over a black base, a brick pergola
  L('N',260.4,274,{wall:'#ecd8c0',roof:'hip',roofColor:'#8a4a32',plinth:{h:1.4,c:'#1c1c1e'},open:[{t:'window',x:-1,w:2.4,grille:true,frame:W},{t:'window',x:4,w:1.4,frame:W}]}),
  L('N',274,280,{wall:'#ecd8c0',roof:'hip',roofColor:'#8a4a32',plinth:{h:.6,c:'#1c1c1e'},open:[{t:'window',x:-1.4,w:1.4,grille:true},{t:'window',x:1.4,w:1.4,frame:W}]}),
  // the green house with a pale louvred window and a cream door
  L('N',280,290,{wall:'#a8c48a',roof:'gable',roofColor:T,fascia:'#a8603a',open:[{t:'door',x:-3,w:1,c:'#e6dcb0'},{t:'window',x:0,w:2,shutters:'#e6dcb0'},{t:'open',x:3,w:2.2,h:2.2,c:'casa'}]}),
  // nº 296: the big grey sobrado with cream tiles, an arched window, a carport and black gates
  L('N',290,306,{floors:2,wall:'#a8a8a6',roof:'hip',roofColor:'#d8c8a0',plinth:{h:.4,c:'#8a8a86'},open:[{t:'open',x:-5,w:4,h:2.4,c:'casa',awning:'#d8c8a0'},{t:'door',x:-1.6,w:1,c:'#2a2a2a'},{t:'garage',x:3.4,w:5,h:2.6,c:'#1c1c1c'},{t:'arch',x:-2,w:2,fl:1}],
    balcony:{x:0,w:12,fl:1,rail:'iron'}}),
  // the modern grey house: brick panel, glass railing, a white garage
  L('N',306,316,{wall:'#a8a8a6',roof:'flat',parapet:true,panels:[{x:2,w:4,c:'#8a6a4a'}],open:[{t:'garage',x:-2.4,w:3,c:'#f2f2f0'},{t:'glass',x:2,w:4,y:.6,h:1.6,frame:'#a8a8a6'}]}),
  // the grey gable house, white shutters and a white barred carport
  L('N',316,328,{wall:'#8f9496',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',open:[{t:'window',x:-3.4,w:2.2,shutters:W,frame:W},{t:'gate',x:.6,w:3.4,c:W},{t:'door',x:4.4,w:1,c:W}]}),
  // the pink sobrado with a brown roll door, a striped awning and a brown shutter above
  L('N',328,336,{floors:2,wall:'#ecc8c8',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:2.8,c:'#7a2a24',awning:'#5a8a5a'},{t:'door',x:1.4,w:1,fl:1,c:'#7a3a2a'}],balcony:{x:0,w:7,fl:1,rail:'iron'}}),
  // the pink corner house over a dark red base
  L('N',336,342,{wall:'#ecc8c8',roof:'hip',roofColor:'#8a4a32',plinth:{h:1,c:'#7a2a24'},open:[{t:'window',x:-1,w:1.4,grille:true},{t:'window',x:1.6,w:1,shutters:'#7a2a24'}]}),
  // --- Treze de Maio → Romeu Zanetti
  // white walls round a carport (an orange Beetle), a weeping tree in front
  L('N',362,372,{d:3,wall:'#ece8e2',roof:'hip',roofColor:T,setback:1,front:{h:1.4,c:'#ece8e2'},open:[{t:'open',x:0,w:6,h:2.3,c:'casa'}]}),
  // the grey sobrado: brown garage, arched windows, iron balconies with louvred doors
  L('N',372,380,{floors:2,wall:'#a8a8a6',roof:'flat',parapet:true,open:[{t:'garage',x:-1.6,w:3,c:'#8a7a5a'},{t:'door',x:1.2,w:1,c:'#7a3a2a'},{t:'arch',x:2.8,w:1,fl:0,y:1.2}],balcony:{x:-1.6,w:3.4,fl:1,rail:'iron'}}),
  // the cream sobrado with a tin-roofed carport and shutters
  L('N',380,388,{floors:2,wall:'#ece4d6',roof:'gable',roofColor:T,open:[{t:'garage',x:0,w:3,c:'#3a3a3a',awning:'#9a8a7a'},{t:'window',x:2.4,w:1.4,fl:1,shutters:'#8a7a6a'}]}),
  // the beige corner house with brown shutters, an arched porch behind a balustrade
  L('N',388,399,{wall:'#e6d4b8',roof:'hip',roofColor:T,plinth:{h:.9,c:'#a87a5a'},open:[{t:'window',x:-3.4,w:1.4,shutters:'#7a4a32'},{t:'window',x:-.6,w:1.4,shutters:'#7a4a32'},{t:'arch',x:3,w:2.6,h:2.4,y:0}]}),
  // --- Romeu Zanetti → XV de Novembro
  // the brick house behind a grey speckled wall with lime pilasters and a clay coping
  L('N',407,417,{wall:'#a8503a',roof:'gable',roofColor:'#8a4a32',setback:4,front:{h:2.2,c:'#8a8c8e'},panels:[{x:-4,w:.4,c:'#c8d4a0'}]}),
  L('N',417,427,{wall:'#a8503a',roof:'gable',roofColor:'#8a4a32',setback:4,front:{h:2.2,c:'#8a8c8e'}}),
  // the green sobrado with a balustrade, a grey sheet garage; Inova Contabilidade under its awning
  L('N',427,433,{floors:2,wall:'#9ad0a8',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:3.6,c:'#6a7a8a'}],balcony:{x:0,w:6,fl:1,rail:'white'}}),
  L('N',433,439,{d:6,floors:2,wall:'#9ad0a8',roof:'flat',parapet:true,open:[{t:'glass',x:0,w:3,y:0,h:2.6,frame:'#2a2a2a',awning:'#2a2a2a'}],balcony:{x:0,w:6,fl:1,rail:'white'},
    sign:{text:'INOVA CONTABILIDADE',bg:'#ffffff',fg:'#3a3a3a',x:0,y:3,w:4.4,h:.8}}),
  // the cream wall on a stone base (Bella Chica's house behind it)
  muro('N',439,445,'#ecd8a8',2.6,{plinth:{h:.9,c:'#8a6a4a'}}),
  // --- XV de Novembro → Eunice Machado Franchi (MultiDrogas on the corner)
  // the dark green speckled wall with white pilasters, the green sobrado above it
  L('N',492,506,{floors:2,wall:'#a8c48a',roof:'hip',roofColor:T,setback:4,front:{h:2.4,c:'#2a5a3a',gates:[{t:'gate',x:6,w:2.4,c:W}]},balcony:{x:-1,w:8,fl:1,rail:'white'}}),
  L('N',506,514,{wall:'#2a5a3a',roof:'hip',roofColor:T,open:[{t:'door',x:-3,w:1,c:W}]}),
  // the mint-green house with white stripes, a white barred gate and a white railing
  L('N',514,520,{wall:'#4ac0a0',roof:'flat',parapet:true,band:W,open:[{t:'gate',x:0,w:3,c:W}]}),
  L('N',520,531.8,{wall:'#4ac0a0',roof:'hip',roofColor:'#6a3a2a',fascia:W,band:W,setback:1,front:{h:.4,c:'#4ac0a0',rail:{h:1.1,c:W,style:'bars'}},open:[{t:'door',x:-.6,w:1,c:W},{t:'window',x:2.4,w:2,grille:true,frame:W}]}),
  // --- Eunice Machado Franchi → Sete de Setembro
  // the brick sobrado with arcaded verandas and balustrades over a salmon base, red garages
  L('N',540.4,556,{floors:2,wall:'#d8a888',upper:'#a8503a',roof:'hip',roofColor:T,plinth:{h:.6,c:'#c89878'},
    open:[{t:'window',x:-4,w:1.4,frame:'#6a3a2a'},{t:'window',x:-1.6,w:1.4,frame:'#6a3a2a'},{t:'door',x:1.6,w:1,c:'#6a3a2a'},{t:'garage',x:5,w:2.4,c:'#8a3a2a'}],balcony:{x:0,w:15,fl:1,rail:'white'}}),
  L('N',556,564,{wall:'#d8a888',roof:'flat',parapet:true,open:[{t:'door',x:-3,w:1,c:'#6a3a2a'},{t:'garage',x:-.4,w:2.8,c:'#8a3a2a'},{t:'garage',x:2.8,w:2.8,c:'#8a3a2a'}]}),
  // a raw concrete shell going up on the corner, brick on top
  L('N',564,575,{floors:2,wall:'#a8a8a4',upper:'#b5603f',roof:'flat',parapet:true,open:[{t:'open',x:-2.6,w:2.6,h:1.4,y:1.2,c:'casa'},{t:'open',x:2,w:2.4,h:1.4,y:1.2,c:'casa'}]}),

  // ================= WEST SIDE (S) =================
  // --- Marginal → Padre Vicente Major
  // the long white house over a grey speckled base, white shutters
  L('S',6,20,{wall:'#ece8e2',roof:'hip',roofColor:'#8a4a32',plinth:{h:1,c:'#8a8c8e'},open:[{t:'window',x:-4,w:2.2,shutters:W},{t:'window',x:0,w:2,shutters:W},{t:'window',x:3.6,w:1.4,grille:true}]}),
  // nº 431: the grey speckled gable with a white window frame; a grey sheet gate
  L('S',20,28,{wall:'#a8a49a',roof:'gable',roofColor:'#6a5a4a',fascia:W,open:[{t:'window',x:1.6,w:2,shutters:W,frame:W},{t:'gate',x:-2.6,w:2.4,c:'#a8b0b8'}]}),
  // the grey speckled house with a red barred carport and grey shutters
  L('S',28,36,{wall:'#a8a49a',roof:'gable',roofColor:'#6a5a4a',fascia:W,open:[{t:'gate',x:-1.6,w:2.6,c:'#8a3a2a'},{t:'window',x:1.8,w:2,shutters:'#5a6878',frame:W}]}),
  // the pale grey house, a sheet gate and a little iron gate
  L('S',36,44,{wall:'#c8ccd0',roof:'gable',roofColor:'#e8e4dc',open:[{t:'gate',x:-2,w:3,c:'#c8ccd0'},{t:'gate',x:1.6,w:1,c:'#3a3a3a'}]}),
  // the mint cottage, a grey wall
  L('S',44,52,{wall:'#a8dcd0',roof:'gable',roofColor:T,setback:2,front:{h:1.4,c:'#a8b4c0'},open:[{t:'window',x:0,w:1.6,grille:true}]}),
  L('S',52,60,{wall:'#a8dcd0',roof:'gable',roofColor:T,setback:3,front:{h:1.6,c:'#b8b4aa'},open:[{t:'window',x:1,w:1.6,grille:true}]}),
  // a house being pulled down, its old walls standing in the rubble
  muro('S',60,76,'#e6dcc8',2.4,{front:{h:2.4,c:'#e6dcc8'}}),
  // the grey cottage with grey shutters; nº 437 cream with red-brown shutters
  L('S',76,84,{wall:'#c8c4bc',roof:'gable',roofColor:'#8a4a32',plinth:{h:1,c:'#a8a49c'},open:[{t:'window',x:-1.6,w:1.4,shutters:'#8a9098'},{t:'window',x:1.6,w:1.4,shutters:'#8a9098'}]}),
  L('S',84,92,{wall:'#ece4c8',roof:'gable',roofColor:'#9aa0a3',fascia:W,plinth:{h:.6,c:'#a8a8a6'},open:[{t:'window',x:-1,w:1.4,shutters:'#8a3a30'}]}),
  // nº 455: the green house, grey shutters, a white barred door
  L('S',92,100,{wall:'#5aaa6a',roof:'gable',roofColor:'#9aa0a3',fascia:W,open:[{t:'window',x:-1.6,w:2,shutters:'#a8b0b8',frame:W},{t:'gate',x:1.6,w:2.2,c:W}]}),
  // the green house under a tin veranda behind a white fence
  L('S',100,108,{wall:'#5aaa6a',roof:'hip',roofColor:T,setback:2.4,front:{h:.4,c:W,rail:{h:1,c:W,style:'bars'}},open:[{t:'open',x:0,w:6,h:2.2,c:'casa',awning:'#c8cacc'}]}),
  // the red house with a black art-deco gate; its neighbour with a stone-framed window
  L('S',108,116,{wall:'#d8605a',roof:'flat',parapet:true,open:[{t:'window',x:-2.4,w:1.2,shutters:'#3a2a24'},{t:'gate',x:1,w:3,c:'#2a2a2a'}]}),
  L('S',116,122.6,{wall:'#d8605a',roof:'gable',roofColor:'#6a6c70',open:[{t:'gate',x:-1.4,w:2.6,c:'#2a2a2a'},{t:'window',x:1.6,w:2,frame:'#8a6a4a'}]}),
  // --- Padre Vicente Major → Antônio de Melo
  // the lilac house with two brown sheet gates; an empty lot between white walls
  L('S',130,136,{wall:'#d8c8d0',roof:'gable',roofColor:T,band:W,open:[{t:'garage',x:0,w:2.4,c:'#8a3a2a'}]}),
  muro('S',136,146,'#b8b4aa',1.2),
  // nº 391: the yellow cottage with a porch and sky-blue shutters
  L('S',146,152,{wall:'#ece0a8',roof:'gable',roofColor:'#9aa0a3',open:[{t:'open',x:-1,w:2.4,h:2.2,c:'casa'},{t:'window',x:1.8,w:1.2,shutters:'#4a8ad0'}]}),
  // the old chapel hall: grey walls under ivy, arched windows, a grey panelled door
  L('S',152,162.8,{wall:'#a8b0a4',roof:'gable',roofColor:T,open:[{t:'arch',x:-2,w:2.6,h:2.6,y:0},{t:'arch',x:2.6,w:1,y:1}]}),
  // --- Antônio de Melo → Cel. José Leopoldino
  // the white corner house behind grey bars on a stone base
  L('S',171.8,182,{wall:'#ece8e2',roof:'gable',roofColor:'#5a6068',setback:2,front:{h:.6,c:'#6a6c70',style:'stone',rail:{h:1.4,c:'#8a8c8e',style:'bars'}},open:[{t:'window',x:-2,w:2,shutters:W},{t:'open',x:2.6,w:3,h:2.3,c:'casa'}]}),
  // the modern grey house, a breeze-block screen and agaves, a white garage
  L('S',182,192,{wall:'#a8a49c',roof:'gable',roofColor:'#8a8a86',fascia:W,setback:1,front:{h:.8,c:'#a8a49c'},panels:[{x:1.4,w:3,c:'#d8d0c0'}],open:[{t:'garage',x:-2.6,w:3.6,c:'#f2f2f0'}]}),
  // nº 309 and 323: green speckled houses with arched carports behind grey bars, white doors
  L('S',192,200,{wall:'#9ab48a',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:.4,c:'#8a9a7a',rail:{h:1.3,c:'#9aa0a3',style:'bars'}},open:[{t:'arch',x:-2,w:3,h:2.4,y:0},{t:'window',x:2,w:1.6,shutters:W}]}),
  L('S',200,206,{wall:'#e6dcd0',roof:'gable',roofColor:T,open:[{t:'door',x:-1,w:1,c:W},{t:'garage',x:1.4,w:2.4,c:W}]}),
  // the Agrocampo / Adubos store: grey speckled, the name painted down the door piers, its yard
  L('S',206,218,{wall:'#8f9496',roof:'gable',roofColor:T,fascia:'#ece4d6',open:[{t:'open',x:-1,w:3.6,h:2.8,c:'casa'},{t:'window',x:3,w:1.4,shutters:'#a87a4a'}],
    sign:{text:'AGROCAMPO ADUBOS',bg:'#8f9496',fg:'#ffffff',x:-1,y:3,w:5,h:.6}}),
  muro('S',218,234,'#ece8e2',1.8,{sign:{text:'ADUBOS · AGROCAMPO',bg:'#ece8e2',fg:'#1c1c1e',x:0,y:.9,w:8,h:.8},behind:{w:10,d:9,at:3,roof:'flat',roofColor:'#c8cacc',wall:'#d8c8a8'}}),
  // --- Cel. José Leopoldino → Treze de Maio (Mãe Rainha on the corner)
  // the old cream warehouse with pink pilasters, a brown roll door
  L('S',260,274,{wall:'#ece0b0',roof:'hip',roofColor:'#8a4a32',plinth:{h:1.2,c:'#c88a80'},panels:[{x:-3,w:.5,c:'#d8a098'}],open:[{t:'garage',x:-5,w:3,c:'#a87a4a'},{t:'window',x:1,w:1.4,grille:true}]}),
  // the old ruin of a house behind its crumbling wall, a wooden door
  L('S',274,284,{wall:'#ecd8a8',roof:'gable',roofColor:'#8a4a32',open:[{t:'door',x:-1,w:1.2,c:'#6a4a32'},{t:'window',x:2,w:1.4,frame:'#6a6a5a'}]}),
  muro('S',284,292,'#d8c8a0',2.4),
  // the grey house with a stepped wall, a white garage
  L('S',292,300,{wall:'#9a9690',roof:'gable',roofColor:'#4a4a4a',open:[{t:'door',x:-2.6,w:1,c:W},{t:'garage',x:1.6,w:3,c:'#f2f2f0'}]}),
  // nº 309: beige house, olive shutters and an olive art-deco gate
  L('S',300,308,{wall:'#ddc8a8',roof:'flat',parapet:true,setback:1,front:{h:1.2,c:'#ddc8a8'},open:[{t:'window',x:-2,w:1.6,shutters:'#8a9a3a'},{t:'gate',x:1.8,w:3.4,c:'#8a9a3a'}]}),
  // a dark green tiled wall and a rough wall, the white house behind
  L('S',308,316,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#2a4a4a',gates:[{t:'gate',x:3,w:1,c:'#2a4a4a'}]},open:[{t:'window',x:0,w:1.6,shutters:'#5a6878'}]}),
  // the cream houses with yellow gables over grey block bases, brown windows
  L('S',316,324,{wall:'#ece4d6',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',plinth:{h:1.4,c:'#8a8c8e'},open:[{t:'window',x:-1.6,w:2.6,frame:'#6a3a2a'},{t:'window',x:2,w:2,shutters:'#6a3a2a'}]}),
  L('S',324,332,{wall:'#ece4d6',roof:'gable',roofColor:'#4a3a32',fascia:'#4a3a32',plinth:{h:1.4,c:'#8a8c8e'},open:[{t:'gate',x:-2.4,w:2.6,c:'#6a4a32'},{t:'window',x:1.6,w:2.4,frame:'#6a3a2a'}]}),
  // the modern grey house with a stone planter window, on the corner
  L('S',332,342,{wall:'#a8a8a6',roof:'gable',roofColor:'#4a4a4a',fascia:'#4a4a4a',open:[{t:'door',x:-2.6,w:1,c:W},{t:'glass',x:.6,w:3,y:.6,h:1.6,frame:'#a8a8a6'}]}),
  // --- Treze de Maio → Romeu Zanetti
  // the machinery yard behind a stone wall and a rusty rail, boats and a tractor
  muro('S',350,366,'#7a7a72',1,{front:{h:1,c:'#7a7a72',style:'stone',rail:{h:1,c:'#a87a5a',style:'bars'}},behind:{w:10,d:8,at:3,roof:'flat',roofColor:'#c8cacc',wall:'#c8c8c4'}}),
  // the padaria under its long canvas awning, a granite-clad front
  L('S',366,374,{floors:2,wall:'#c8b4a0',upper:'#ece8e2',roof:'flat',parapet:true,open:[{t:'open',x:0,w:4,h:2.6,c:'casa',awning:'#c8a088'}],sign:{text:'PADARIA',bg:'#c8a088',fg:'#6a3a2a',x:0,y:2.7,w:4,h:.4}}),
  // Brant's mini mercado: granite cladding, a striped awning, wide windows above
  L('S',374,382,{d:5,floors:2,wall:'#c8b4a0',roof:'flat',parapet:true,open:[{t:'open',x:-2,w:4,h:2.6,c:'casa',awning:'#c8a088'},{t:'glass',x:3,w:4,y:.6,h:1.8,frame:'#8a6a5a'},{t:'window',x:-3,w:4,fl:1,frame:W},{t:'window',x:3,w:4,fl:1,frame:W}],
    sign:{text:"BRANT'S MINI MERCADO",bg:'#c8a088',fg:'#5a3a2a',x:0,y:2.7,w:9,h:.5}}),
  // --- Romeu Zanetti → XV de Novembro (Bradesco and MyComp at the corners)
  // the cream house on a stone base with grey shutters, a grey garage and door
  L('S',418,428,{floors:2,wall:'#ece4d0',roof:'gable',roofColor:T,plinth:{h:1.2,c:'#a8805a',stone:true},open:[{t:'garage',x:-3.4,w:2.6,c:'#a8b0b8'},{t:'door',x:-.4,w:1,c:'#5a6068'},{t:'window',x:2.6,w:3,grille:true}]}),
  // nº 20: cream house with a brown door and barred windows, grey garage below
  L('S',428,436,{wall:'#ece4d0',roof:'gable',roofColor:'#4a4a4a',plinth:{h:1.6,c:'#8a8c8e'},open:[{t:'door',x:-1.4,w:1,c:'#8a3a2a'},{t:'window',x:1.6,w:1.8,shutters:'#a8b0b8'},{t:'garage',x:3,w:2,c:'#a8b0b8'}]}),
  // the beige sobrado with an open passage and the Clima Terra shop
  L('S',436,444,{floors:2,wall:'#d8c4a8',roof:'flat',parapet:true,open:[{t:'open',x:-2.6,w:2.6,h:2.4,c:'casa',awning:'#9a8a7a'},{t:'glass',x:1.4,w:2.4,y:0,h:2.4,frame:'#1c1c1e'},{t:'window',x:-1,w:2,fl:1},{t:'window',x:2.6,w:2,fl:1}],
    sign:{text:'CLIMA TERRA',bg:'#1c1c1e',fg:'#5ab05a',x:1.4,y:1.2,w:1.4,h:.5}}),
  // Drogaria Poupe Já: the red fascia, an open shop front and a white gate
  L('S',444,452,{floors:2,wall:'#ece8e2',roof:'flat',parapet:true,panels:[{x:0,w:8,c:'#d82a2a',y0:2.6,y1:3.6}],open:[{t:'open',x:-1.6,w:3,h:2.4,c:'casa'},{t:'gate',x:2.4,w:2.4,c:W}],
    sign:{text:'DROGARIA POUPE JÁ · 3663-3333',bg:'#d82a2a',fg:'#ffffff',x:0,y:3.1,w:7.4,h:.8}}),
  // a beige sobrado with an open passage to the back
  L('S',452,458,{d:5,floors:2,wall:'#d8c4a8',roof:'flat',parapet:true,open:[{t:'open',x:-.6,w:2,h:2.4,c:'casa'},{t:'window',x:1.6,w:1.2,grille:true},{t:'window',x:0,w:2,fl:1}]}),
  // --- XV de Novembro → Eunice Machado Franchi
  // nº 17: the law office behind a tall beige wall, palms and flowers, a white garage
  L('S',494,504,{floors:2,wall:'#ece4d0',roof:'hip',roofColor:T,setback:3,front:{h:2.2,c:'#c8b490',gates:[{t:'garage',x:-3,w:3,c:'#ece4d6'},{t:'door',x:.6,w:1,c:W}]},
    sign:{text:'ESCRITÓRIO DE ADVOCACIA',bg:'#1c1c1e',fg:'#e8e4dc',x:3.4,y:1.2,w:1.6,h:.8}}),
  muro('S',504,512,'#c8b490',2.8),
  // then the bare slope down to the Décio Queiróz Telles and the lake square
];

export const TREES:Tree[]=[
  {side:'S',s:168,kind:'reseda'},{side:'N',s:364,kind:'ficus'},{side:'S',s:236,kind:'ficus'},
  {side:'S',s:516,kind:'ficus'},{side:'S',s:548,kind:'palmeira'},{side:'S',s:566,kind:'palmeira'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:10,every:34,transformers:[110,400]},
};
