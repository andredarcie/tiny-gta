// Rua São Vicente de Paula — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/svp-N-*/ and svp-S-*/, kept out of git; lot boundaries
// from the Microsoft building footprints). 381 m west→east from the Manoel Pereira de Souza to
// the Dom Alberto J. Gonçalves. Side 'N' is the north side, 'S' the south.
//   s=116 R. Barão do Rio Branco   s=188 R. Leonor Mendes de Barros   s=288 R. Francisco
//   Pereira de Souza
// Left alone: the E.M.E.B. Euclides da Cunha (south side, s 233–296, escola-euclides.ts) and the
// cell tower yard (north side, s 352–377: the tower itself is a town landmark).
// Granite setts. Opening x is measured from the lot centre as SEEN FROM THE STREET (left
// negative): on the north side (N) left is WEST (lower s), on the south side (S) left is EAST
// (higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua São Vicente de Paula';
export const CROSS=[0,115.9,187.8,288,380.6];
const SURFACE:Surface[]=[[0,380.6,'sett']];
const T='#b0603f',W='#f1efe9',RUST='#8a3a2a';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE (N) =================
  // --- Manoel Pereira de Souza → Barão do Rio Branco
  // the grey roughcast wall with a tile coping and a white sheet gate, the grey house behind
  L('N',20.6,24,{wall:'#d8d8d4',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#a8aca8',gates:[{t:'gate',x:0,w:2.6,c:W}]}}),
  // the high grey roughcast wall with white pilasters
  muro('N',24,33.3,'#a8aca8',3,{panels:[{x:-1.6,w:.3,c:W},{x:2.4,w:.3,c:W}]}),
  // the white house under a clay hip roof behind a white wall, a grey barred gate
  L('N',33.3,41.9,{wall:'#f0eee8',roof:'hip',roofColor:T,setback:3,front:{h:2.1,c:'#ecebe6',gates:[{t:'gate',x:3,w:1.2,c:'#8a8c8e'}]},
    open:[{t:'window',x:-1,w:1,frame:'#8a8c8e'},{t:'window',x:1,w:1.4,grille:true}]}),
  // the grey house with a bright orange sheet gate
  L('N',41.9,47.7,{wall:'#c8c8c4',roof:'gable',roofColor:T,fascia:W,open:[{t:'window',x:-1.6,w:1.2,grille:true},{t:'garage',x:1.4,w:2.8,c:'#e0602a'}]}),
  // nº 51: the grey gable house behind a low stone wall, an orange shutter, a porch
  L('N',47.7,56.2,{wall:'#a8a8a6',roof:'gable',roofColor:'#9a9a98',fascia:W,setback:1.5,front:{h:.9,c:'#c8a878',style:'stone'},
    open:[{t:'window',x:-2.4,w:1.4,shutters:'#d8602a',frame:W},{t:'open',x:1.4,w:3,h:2.3,c:'casa'}]}),
  // nº 63: the beige gable house with an arched porch and a white louvred window
  L('N',57.8,67.2,{wall:'#e8d8c0',roof:'gable',roofColor:'#8a3a2a',
    open:[{t:'garage',x:-3.6,w:1.6,c:W},{t:'window',x:-1,w:1.8,shutters:W,frame:W},{t:'arch',x:2.6,w:2.6,y:.3,h:1.6}]}),
  // the white two-storey house, white louvres
  L('N',67.2,70.5,{floors:2,wall:'#f0eee8',roof:'flat',parapet:true,open:[{t:'window',x:0,w:1,fl:1,shutters:'#8a8c8e'}]}),
  // nº 77: the white house: grey louvres, X-pattern grilles over the window and the garage
  L('N',70.5,80.3,{wall:'#f0eee8',roof:'hip',roofColor:T,x:['dish'],open:[{t:'window',x:-3.4,w:1.6,shutters:'#8a9098',frame:W},{t:'window',x:-.4,w:2.2,grille:true},{t:'garage',x:2.8,w:3,c:'#9aa0a4',grille:true}]}),
  // nº 87: the beige gable house behind a white picket fence on a mauve wall
  L('N',80.3,90,{wall:'#ecd8b8',roof:'gable',roofColor:'#6a4a3a',setback:2,front:{h:.6,c:'#c8a8a0',rail:{h:1.1,c:W,style:'bars'},gates:[{t:'gate',x:2,w:1.4,c:W}]},
    open:[{t:'window',x:-1.6,w:1.6,shutters:'#e0d8c8'},{t:'door',x:1,w:.9,c:'#8a3a2a'}]}),
  // the stone-based wall with a white garage door, the bare-brick two-storey house behind
  L('N',90,98.2,{floors:2,wall:'#b86a48',roof:'flat',setback:2,front:{h:2,c:'#ecebe6',style:'stone',gates:[{t:'gate',x:-2.2,w:2.6,c:W}]},
    open:[{t:'open',x:0,w:4,h:2.2,fl:1,c:'casa'}]}),
  // --- Barão do Rio Branco → Leonor Mendes de Barros
  // the beige house half hidden by a cypress, palms in front
  L('N',133.8,138,{wall:'#ecdcc0',roof:'hip',roofColor:T,setback:3,front:{h:1.2,c:'#ece4d4'},x:['dish'],open:[{t:'door',x:.6,w:.9,c:W}]}),
  // the white roll garage door in a stone-tiled front, a palm
  L('N',138,144,{wall:'#ece4d4',roof:'hip',roofColor:T,plinth:{h:2.6,stone:true},x:['ac'],open:[{t:'garage',x:.6,w:2.8,c:W}]}),
  // the cream house on a brown roughcast base: a barred window, a brown sheet gate
  L('N',144,154,{wall:'#ecdcb8',roof:'gable',roofColor:T,plinth:{h:1.4,c:'#8a4a3a'},setback:1,front:{h:2,c:'#8a4a3a',gates:[{t:'gate',x:-3,w:2.6,c:'#8a4a3a'}]},
    open:[{t:'window',x:1.4,w:1.8,grille:true,frame:W}]}),
  // the white mansion with green columns and pediment behind a green iron fence and lawn
  L('N',154,169.6,{floors:2,wall:'#f2f0ea',upper:'#f2f0ea',roof:'gable',roofColor:'#b8b8b4',setback:4,d:8,
    front:{h:.4,c:'#2a6a3a',rail:{h:1.6,c:'#2a6a3a',style:'bars'},gates:[{t:'gate',x:-2,w:1.4,c:'#2a6a3a'}]},
    panels:[{x:-6,w:.8,c:'#2a7a4a'},{x:-2,w:.8,c:'#2a7a4a'},{x:2,w:.8,c:'#2a7a4a'},{x:6,w:.8,c:'#2a7a4a'}],
    open:[{t:'window',x:-4,w:1.4,fl:1,frame:'#2a6a3a'},{t:'door',x:0,w:1.4,fl:1,c:'#2a6a3a'},{t:'window',x:4,w:1.4,fl:1,frame:'#2a6a3a'},{t:'window',x:-4,w:1.4,frame:'#2a6a3a'},{t:'window',x:4,w:1.4,frame:'#2a6a3a'}]}),
  // --- Leonor Mendes de Barros → Francisco Pereira de Souza
  L('N',206.2,214,{floors:2,wall:'#f0d8c0',upper:'#f0d8c0',roof:'hip',roofColor:T,plinth:{h:2.8,c:'#a8a49a'},open:[{t:'window',x:-1,w:1.6,grille:true},{t:'window',x:1.6,w:1.6,grille:true},{t:'window',x:0,w:1.4,fl:1}]}),
  // a grey sheet gate under fibre-cement, a brown board gate
  L('N',214,220,{wall:'#ecebe6',roof:'gableSide',roofColor:'#9a9a98',open:[{t:'garage',x:-1.4,w:2.6,c:'#a8b0b8'},{t:'gate',x:1.8,w:2,c:'#8a5a3a'}]}),
  // the brown roughcast house with big glass panes, behind a pepper tree
  L('N',220,226,{wall:'#8a4a32',roof:'hip',roofColor:T,open:[{t:'glass',x:-.8,w:2.4,y:.3,h:1.8,frame:'#e8e4dc'},{t:'door',x:1.8,w:1,c:'#8a5a3a'}]}),
  // nº 221: the cream house under a brown roughcast gable, carved brown doors, barred windows
  L('N',226,240,{wall:'#ecdcc0',roof:'gable',roofColor:'#3a2a24',plinth:{h:.4,c:'#5a3a2a'},
    open:[{t:'open',x:-5.6,w:2.2,h:2.3,c:'casa',grille:true},{t:'window',x:-2.6,w:1.6,grille:true},{t:'door',x:-.2,w:1.6,c:'#4a2a1a'},{t:'window',x:2.6,w:1.4,grille:true},{t:'door',x:5,w:1,c:'#4a2a1a'}]}),
  // the white house on a red roughcast base with green curtains, a barred door
  L('N',240,248.9,{wall:'#ece8e0',roof:'gable',roofColor:'#8a4a32',plinth:{h:1.2,c:RUST},x:['dish'],
    open:[{t:'window',x:-2.4,w:2.4,frame:'#8a5a3a'},{t:'door',x:-.4,w:1,c:'#8a5a3a',grille:true},{t:'window',x:2.4,w:1.4,shutters:'#8a5a3a'}]}),
  // the brown slatted garage door in a yellow wall
  L('N',248.9,253,{wall:'#e8c060',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:3,c:'#b08458'}]}),
  // the red roughcast house with yellow-framed windows, a brown louvred one
  L('N',253,260,{wall:'#8a3a2a',roof:'gable',roofColor:'#8a4a32',fascia:'#c89a3a',open:[{t:'window',x:-1.6,w:1.8,shutters:'#a8783a',frame:'#e8c060'},{t:'window',x:1.8,w:1.8,grille:true,frame:'#e8c060'}]}),
  // the red roughcast shop with its board, a black sheet gate, the lane beside it
  L('N',260,266.2,{wall:'#8a3a2a',roof:'gable',roofColor:'#8a4a32',sign:{text:'RECICLAGEM',bg:'#f0f0ee',fg:'#2a3a6a',x:0,y:2.4,w:2.2,h:.6},
    open:[{t:'glass',x:-1.4,w:1.6,y:.1,h:2.2,frame:'#e8c060'},{t:'gate',x:1.6,w:1.6,c:'#2a2a2a'}]}),
  // --- Francisco Pereira de Souza → Dom Alberto J. Gonçalves
  // the long bare concrete-block wall with a chain-link gate, a yard behind
  muro('N',294.8,328,'#a89c88',2.4,{front:{h:2.4,c:'#a89c88',style:'panel',gates:[{t:'gate',x:6,w:3.4,c:'#8a5a40'}]}}),
  // the bare-brick house with arched porches behind brick pillars and an iron fence, palms
  L('N',328,344,{wall:'#b86a48',roof:'hip',roofColor:'#8a3a2a',setback:3,front:{h:.6,c:'#b86a48',rail:{h:1.4,c:'#5a5a5a',style:'bars'},gates:[{t:'gate',x:-5,w:3,c:'#5a5a5a'}]},
    open:[{t:'arch',x:-2,w:2.4,y:0,h:2,c:'casa'},{t:'arch',x:2,w:2.4,y:0,h:2,c:'casa'},{t:'arch',x:5.6,w:2,y:0,h:2,c:'casa'}]}),
  // the stone-clad wall with a red sheet gate between brick pillars
  muro('N',344,352,'#c8b490',2,{front:{h:2,c:'#c8b490',style:'stone',gates:[{t:'gate',x:.4,w:3.4,c:'#a8503a'}]}}),
  // (352–377: the cell tower yard behind chain-link)
  muro('N',352,376.8,'#b8bcc0',2,{front:{h:2,c:'#b8bcc0',style:'lattice'}}),
  // ================= SOUTH SIDE (S) =================
  // --- Manoel Pereira de Souza → Barão do Rio Branco
  // the weathered high wall with a grey door, the clay roofs of the houses behind
  L('S',16.5,26.6,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:3.5,d:7,front:{h:2.4,c:'#b8ae9c',gates:[{t:'gate',x:-4.6,w:1,c:'#c8ccd0'},{t:'gate',x:3,w:1,c:'#c8ccd0'}]}}),
  // the white sheet gate in a grey roughcast wall, the clay roof behind
  L('S',26.6,32,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:3,d:7,front:{h:2.4,c:'#b8b4ac',gates:[{t:'gate',x:1.4,w:2.6,c:W}]}}),
  // the mottled wall with a breeze-block window, a door, cypresses, a white sheet gate
  L('S',32,40,{wall:'#ece4d4',roof:'gableSide',roofColor:T,setback:3,d:7,front:{h:2.6,c:'#b8ae9c',gates:[{t:'gate',x:-2.6,w:2.4,c:W},{t:'gate',x:2.6,w:1,c:'#8a8c8e'}]}}),
  // the old wall with a weathered wooden gate and three breeze-block panels
  L('S',40,48.5,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:3,d:7,front:{h:2.4,c:'#c8c0b0',gates:[{t:'gate',x:2.4,w:3,c:'#6a3a20'}]},
    panels:[{x:-1,w:1.2,c:'#c8603a',y0:1.2,y1:2},{x:-2.8,w:1.2,c:'#c8603a',y0:1.2,y1:2}]}),
  // the beige house with a porch and a brown louvred window, a brown base
  L('S',48.5,56,{wall:'#e0c8a8',roof:'gable',roofColor:'#5a4a40',plinth:{h:.5,c:'#8a5a3a'},open:[{t:'window',x:-1.8,w:1.6,shutters:'#7a4a2a',frame:W},{t:'open',x:1.8,w:3,h:2.3,c:'casa'}]}),
  // a row of brown roughcast gable houses on a maroon base, white-framed windows
  L('S',56,62.3,{wall:'#a89078',roof:'gable',roofColor:'#3a2a24',plinth:{h:.6,c:'#6a2a2a'},open:[{t:'window',x:1.4,w:1.6,grille:true,frame:W},{t:'window',x:-1.4,w:1.2,shutters:'#8a3a2a',frame:W}]}),
  L('S',62.3,69,{wall:'#a89078',roof:'gable',roofColor:'#3a2a24',plinth:{h:.6,c:'#6a2a2a'},open:[{t:'garage',x:1.4,w:2.4,c:W},{t:'window',x:-1.6,w:1.4,grille:true,frame:W}]}),
  L('S',69,79,{wall:'#a89078',roof:'gable',roofColor:'#3a2a24',plinth:{h:.4,c:'#e8e4dc'},open:[{t:'open',x:3,w:2.6,h:2.4,c:'casa',grille:true},{t:'window',x:0,w:1.6,frame:W},{t:'window',x:-2.8,w:1.8,shutters:W,frame:W}]}),
  L('S',79,88.4,{wall:'#b8a890',roof:'gable',roofColor:'#3a2a24',open:[{t:'open',x:3,w:2.6,h:2.4,c:'casa',grille:true},{t:'window',x:0,w:1.6,grille:true,frame:W},{t:'window',x:-2.6,w:1.6,shutters:'#a8acb0',frame:W}]}),
  // the white house with a red louvred window behind a grimy wall, a wooden fence
  L('S',88.4,98.1,{wall:'#f0eee8',roof:'gable',roofColor:'#8a4a32',setback:2,front:{h:1.4,c:'#d8d4cc',gates:[{t:'gate',x:-3.4,w:2,c:'#8a6a4a'}]},open:[{t:'window',x:2,w:1.2,shutters:'#8a2a2a'}]}),
  // --- Barão do Rio Branco → Leonor Mendes de Barros
  // the arched porch on brick-red pillars behind a white wall on a dark base
  L('S',135.6,145.7,{wall:'#f0eee8',roof:'hip',roofColor:T,setback:1,front:{h:1.8,c:'#ecebe6'},plinth:{h:1,c:'#4a2a24'},
    open:[{t:'arch',x:-2.6,w:2,y:0,h:2,c:'casa'},{t:'arch',x:0,w:2,y:0,h:2,c:'casa'},{t:'arch',x:2.6,w:2,y:0,h:2,c:'casa'}],panels:[{x:-3.8,w:.5,c:'#b84a3a'},{x:-1.3,w:.5,c:'#b84a3a'},{x:1.3,w:.5,c:'#b84a3a'},{x:3.8,w:.5,c:'#b84a3a'}]}),
  // the white house with a wooden garage door, the brown sheet gate of the next one
  L('S',145.7,151,{wall:'#ece8e0',roof:'hip',roofColor:T,open:[{t:'garage',x:0,w:2.2,c:'#a8783a'},{t:'window',x:1.8,w:.6,frame:'#3a3a3a'}]}),
  L('S',151,158.7,{wall:'#ece4d4',roof:'hip',roofColor:T,setback:3,front:{h:2,c:'#ece4d4',gates:[{t:'gate',x:.6,w:4,c:'#5a3a2a'}]}}),
  // the stepped entries up to the houses behind, a red sheet garage door
  L('S',158.7,165,{wall:'#ece4d4',roof:'hip',roofColor:T,open:[{t:'garage',x:-1,w:3.2,c:'#a8402a'},{t:'window',x:1.6,w:2,y:2.2,frame:'#3a3a3a'}]}),
  // the pink-beige raised house with a big window, a carport under it, a white iron fence
  L('S',165,176,{floors:2,d:6,wall:'#d8c4c0',upper:'#d8c4c0',roof:'flat',parapet:true,setback:1,front:{h:.4,c:'#c8c0b8',rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'open',x:-1,w:6,h:2.4,c:'casa'},{t:'window',x:-1.6,w:2.6,fl:1,frame:W},{t:'window',x:2,w:1.6,fl:1,shutters:W}]}),
  // --- Leonor Mendes de Barros → Francisco Pereira de Souza
  // the patched brick-red wall round a wooded yard
  muro('S',194.8,216,'#c8b8a0',2.2,{panels:[{x:-6,w:3,c:'#c8603a',y0:.4,y1:1.6},{x:2,w:3,c:'#c8603a',y0:.4,y1:1.6},{x:8,w:3,c:'#c8603a',y0:.4,y1:1.6}]}),
  // the empty lot behind a plastered wall with a dark grey sheet gate, brick stacks behind
  muro('S',216,233,'#c8b8a0',2,{front:{h:2,c:'#c8b8a0',gates:[{t:'gate',x:4,w:5,c:'#4a4e54'}]}}),
  // (233–296: the E.M.E.B. Euclides da Cunha, escola-euclides.ts)
  // --- (Euclides da Cunha) → Dom Alberto J. Gonçalves
  // the cream wall on a dark stone base, the arched veranda and solar panels behind
  L('S',296.7,312,{wall:'#ecdcc0',roof:'hip',roofColor:'#8a4a32',setback:3,x:['heater'],front:{h:2.4,c:'#e4d8c4',style:'panel'},plinth:{h:.4,stone:true},
    open:[{t:'arch',x:-3,w:2.4,y:0,h:2,c:'casa'},{t:'arch',x:1,w:2.4,y:0,h:2,c:'casa'}]}),
  // the cream wall with an arched brown garage door and an arched brown door
  L('S',312,320.4,{wall:'#ecdcc0',roof:'hip',roofColor:'#8a4a32',setback:3,front:{h:2.4,c:'#e4d8c4',gates:[{t:'gate',x:2,w:2.8,c:'#3a2a24'},{t:'gate',x:-1.4,w:1.2,c:'#3a2a24'}]}}),
  // the gated home behind a white iron fence on a low wall: a lawn, lamps, palms, the long
  // clay-roofed buildings at the back
  L('S',320.4,342,{wall:'#ece4d0',roof:'hip',roofColor:T,setback:6,d:6,front:{h:.9,c:'#c8c0b0',rail:{h:1.4,c:W,style:'bars'},gates:[{t:'gate',x:5,w:3.6,c:W}]}}),
  // the white two-storey house over an ochre roughcast ground floor, blue barred windows, a blue door
  L('S',342,356.2,{floors:2,wall:'#c8a868',upper:'#f0eee8',roof:'flat',parapet:true,
    open:[{t:'window',x:2,w:1.8,grille:true,frame:'#2a5aa8'},{t:'window',x:-.4,w:.8,frame:'#2a5aa8'},{t:'door',x:-5,w:1.8,c:'#3a6ab8'},
      {t:'window',x:3,w:1.8,fl:1,grille:true},{t:'window',x:-1,w:1.8,fl:1,grille:true},{t:'window',x:-5,w:1.8,fl:1,grille:true}]}),
  // the dark grey house with a red barred gate
  L('S',356.2,363.9,{wall:'#5a5e66',roof:'hip',roofColor:T,setback:2,front:{h:1.4,c:'#5a5e66',rail:{h:.6,c:W,style:'bars'},gates:[{t:'gate',x:-2,w:1.4,c:'#a8402a'}]}}),
  // the grey corner house with a white balustrade porch, a white sheet gate
  L('S',363.9,376.6,{wall:'#8a8e96',roof:'gable',roofColor:'#4a4a4e',plinth:{h:1.4,c:'#4a4e56'},
    open:[{t:'gate',x:-5,w:2.6,c:W},{t:'open',x:0,w:6,h:2.2,y:.6,c:'casa',awning:T},{t:'window',x:-1,w:1.2,frame:W},{t:'window',x:1.6,w:1.2,frame:W}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:135,kind:'palmeira'},{side:'N',s:140,kind:'palmeira'},
  {side:'N',s:222,kind:'ficus'},
  {side:'S',s:200,kind:'ficus'},{side:'S',s:212,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:16,every:34},
  keepOut:[
    {side:'S',s0:233,s1:296,why:'E.M.E.B. Euclides da Cunha (escola-euclides.ts)'},
  ],
};
