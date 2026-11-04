// Rua Capitão Thomaz de Andrade — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/cta-N-*/ and cta-S-*/, kept out of git; lot boundaries
// from the Microsoft building footprints). 269 m north→south from the Rua São José down across
// the XV de Novembro / São Paulo and the João Cabral de Medeiros to the Manoel Pereira de Souza.
// `s` starts at the NORTH end, so side 'N' is the EAST side (left of a walker going south) and 'S'
// the WEST side.
// Granite setts north of the XV, asphalt beyond. Opening x is measured from the lot centre as SEEN
// FROM THE STREET (left negative): on the east side (N) left is NORTH (lower s), on the west side
// (S) left is SOUTH (higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Capitão Thomaz de Andrade';
export const CROSS=[0,64.4,141.8,268.7];
const SURFACE:Surface[]=[[0,64.4,'sett'],[64.4,268.7,'asphalt']];
const T='#b0603f',W='#f1efe9',TAUPE='#8a7a6e',GREY='#a8acb4';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- São José → XV de Novembro
  // the white garage door under the balcony, the massage studio's white doors
  L('N',20.6,24,{floors:2,wall:'#d8d4cc',upper:'#d8d4cc',roof:'flat',parapet:true,balcony:{x:0,w:3.4,fl:1,rail:'glass',depth:1.2},
    open:[{t:'garage',x:0,w:2.6,c:W}]}),
  L('N',24,30,{floors:2,wall:TAUPE,upper:'#d8d4cc',roof:'flat',parapet:true,balcony:{x:0,w:6,fl:1,rail:'glass',depth:1.2},
    sign:{text:'ESSÊNCIA · MASSAGEM',bg:'#ffffff',fg:'#6a4a8a',x:-1.6,y:1.2,w:1.4,h:1.6},open:[{t:'door',x:-1.6,w:1.4,c:W},{t:'garage',x:1.4,w:2.6,c:W}]}),
  // the taupe wall with a glass parapet and two white slatted garage doors
  L('N',30,40.2,{floors:2,wall:TAUPE,roof:'flat',parapet:true,open:[{t:'garage',x:-3,w:2.8,c:W},{t:'garage',x:1,w:2.8,c:W}]}),
  // the taupe wall and a white door, the garden of the corner house behind it, palms
  L('N',40.2,49,{floors:2,wall:'#d8d0c8',roof:'flat',parapet:true,setback:4,d:8,front:{h:2,c:TAUPE,gates:[{t:'gate',x:2,w:1,c:W}]}}),
  // the modern beige two-storey corner house behind glass panels set in taupe pillars
  L('N',49,52.4,{floors:2,wall:'#d8d0c8',upper:'#d8d0c8',roof:'flat',parapet:true,setback:3,front:{h:.8,c:TAUPE,rail:{h:1,c:'#8ac0b0',style:'bars'}},
    open:[{t:'window',x:0,w:1.6,frame:'#3a3a3a'}]}),
  // --- XV de Novembro → João Cabral de Medeiros
  // the cream house with a fibre-cement awning, the white two-storey nº 103
  L('N',95.1,101.8,{wall:'#ece8dc',roof:'hip',roofColor:'#8a4a32',open:[{t:'window',x:-1,w:1.4,shutters:'#d8d0c0'},{t:'window',x:1.6,w:.8,frame:'#3a3a3a'}]}),
  L('N',101.8,110.8,{floors:2,wall:'#ecebe6',roof:'flat',parapet:true,plinth:{h:.6,c:'#c8c0b4'},x:['ac'],open:[{t:'window',x:-2.6,w:1.6,shutters:W},{t:'door',x:1.4,w:1.4,c:W},{t:'window',x:1.6,w:1.4,fl:1,shutters:W}]}),
  // the grey house with white louvres, a white diagonal-bar garage gate, a terrace above
  L('N',110.8,117,{wall:'#c8ccd4',roof:'gable',roofColor:T,open:[{t:'window',x:-2,w:1.2,shutters:W},{t:'garage',x:1,w:3,c:W,grille:true}]}),
  // nº 119: the red roughcast gable house with a porch and barred windows
  L('N',117,127.2,{wall:'#8a3a2a',roof:'gable',roofColor:'#3a3a3a',fascia:W,
    open:[{t:'garage',x:-3.6,w:2,c:'#c8b098'},{t:'open',x:-.2,w:3,h:2.3,c:'casa'},{t:'window',x:3.4,w:1.6,grille:true}]}),
  // the green wall with a white sheet garage door, the green house behind
  L('N',127.2,138.6,{wall:'#a8c098',roof:'gable',roofColor:'#5a4a40',setback:2,front:{h:2,c:'#a8c098',gates:[{t:'gate',x:-3.6,w:3,c:W}]},open:[{t:'window',x:2,w:1.2,grille:true}]}),
  // --- João Cabral de Medeiros → Manoel Pereira de Souza
  // the beige and taupe corner house, white louvres
  L('N',147.6,165.5,{d:8.5,wall:'#e4dcd0',roof:'hip',roofColor:T,plinth:{h:1.6,c:'#8a8278'},
    open:[{t:'window',x:-6,w:1.8,shutters:W},{t:'window',x:-1,w:1.4,shutters:W},{t:'window',x:2,w:1.6,shutters:W},{t:'window',x:6,w:1,frame:W}]}),
  // the beige house with a white door and a white garage door, a little clay hood
  L('N',165.5,170.6,{wall:'#e4dcd0',roof:'flat',parapet:true,plinth:{h:1.6,c:'#8a8278'},open:[{t:'door',x:-1.4,w:.9,c:W,awning:T},{t:'garage',x:1,w:2.6,c:W}]}),
  // the arched wall panels clad in stone with glass between, a white garage door
  L('N',170.6,189.2,{wall:'#e8dcc8',roof:'hip',roofColor:'#5a3a2a',setback:3,front:{h:2.4,c:'#d8d0c4',style:'stone',gates:[{t:'gate',x:-7,w:3,c:W},{t:'gate',x:7.6,w:1.4,c:W}]},
    open:[{t:'arch',x:-3,w:2.4,y:0,h:2.2,c:'casa'},{t:'arch',x:0,w:2.4,y:0,h:2.2,c:'casa'},{t:'arch',x:3,w:2.4,y:0,h:2.2,c:'casa'}]}),
  // the white house with a little clay porch and a glass gate, a palm
  L('N',189.2,196,{wall:'#ecebe6',roof:'gable',roofColor:'#5a3a2a',setback:1,front:{h:.6,c:'#ecebe6',rail:{h:1.2,c:'#a8c8c0',style:'bars'}},open:[{t:'door',x:0,w:.9,c:W,awning:T},{t:'garage',x:-2,w:1.6,c:W}]}),
  // the speckled panel wall and a galvanized sheet gate, the open shed behind
  muro('N',196,206.6,'#c8c4bc',2.4,{front:{h:2.4,c:'#c8c4bc',style:'panel',gates:[{t:'gate',x:3,w:4,c:'#c8ccd0'}]}}),
  // the old beige house raised on a whitewashed rubble base, a brown louvred window
  L('N',206.6,214.2,{wall:'#ecd8a8',roof:'hip',roofColor:'#8a4a32',plinth:{h:1.6,c:'#ecebe6'},open:[{t:'window',x:-1.6,w:1.2,y:2,shutters:'#8a3a2a'},{t:'open',x:1.4,w:2.4,h:1.6,y:1.6,c:'casa'}]}),
  // nº 171: the grey house with white louvres under fibre-cement awnings
  L('N',214.2,222,{wall:'#c8c8c4',roof:'gable',roofColor:'#9a9a98',fascia:W,open:[{t:'window',x:-1.6,w:1.8,shutters:W,awning:'#a8a8a4'},{t:'window',x:1.8,w:1.4,frame:W,awning:'#a8a8a4'}]}),
  // the grey gable house with a white garage under an awning
  L('N',222,228,{wall:'#c8c8c4',roof:'gable',roofColor:'#5a3a2a',open:[{t:'window',x:-1.6,w:1.4,shutters:W},{t:'garage',x:1.4,w:2.6,c:W,awning:'#a8a8a4'}]}),
  // the stone-clad two-storey house with white diagonal garage gates
  L('N',228,247.6,{d:9,floors:2,wall:'#c8a878',upper:'#ecebe6',roof:'flat',parapet:true,plinth:{h:2.8,stone:true},
    open:[{t:'garage',x:-6,w:3.4,c:W},{t:'garage',x:2,w:3.4,c:W},{t:'window',x:-2,w:1.6,fl:1,shutters:W},{t:'window',x:5,w:1.6,fl:1,shutters:W}]}),
  // ================= WEST SIDE (S) =================
  // --- São José → XV de Novembro
  // the white picket fence round the corner house's lawn (the house fronts the São José)
  muro('S',9.4,23.6,W,1.4,{front:{h:.4,c:W,rail:{h:1,c:W,style:'bars'}}}),
  // the grey plastered house end-on to the street, a grilled window
  L('S',23.6,32,{wall:GREY,roof:'flat',parapet:true,open:[{t:'window',x:0,w:2,grille:true}]}),
  // the grey walls stepping down the hill round an empty grassy lot
  muro('S',32,55.8,GREY,2.4),
  // --- XV de Novembro → João Cabral de Medeiros
  // the cream corner house with a barred glass front, a stone base
  L('S',68.2,76.1,{wall:'#ece4d0',roof:'hip',roofColor:'#8a4a32',plinth:{h:.9,c:'#a8a49c'},open:[{t:'window',x:-.6,w:2.6,grille:true},{t:'door',x:2.6,w:.9,c:W}]}),
  // the old weathered wall with grey sheet gates on red-brown frames
  L('S',76.1,90.2,{wall:'#d8d0c4',roof:'hip',roofColor:'#8a4a32',setback:3,front:{h:2.4,c:'#b8ac9c',gates:[{t:'gate',x:-4,w:2.6,c:'#a8acb0'},{t:'gate',x:4.4,w:2.6,c:'#a8acb0'}]}}),
  // the weathered wall with a grey sheet gate
  muro('S',90.2,100.4,'#c8bca8',2.4,{front:{h:2.4,c:'#c8bca8',gates:[{t:'gate',x:-3,w:3,c:'#a8acb0'}]}}),
  // the old cream workshop: FREIOS · SUSPENSÃO painted on its wall, a black roll door
  L('S',100.4,110.6,{wall:'#ece8dc',roof:'hip',roofColor:'#8a4a32',sign:{text:'FREIOS · SUSPENSÃO',bg:'#ece8dc',fg:'#5a5a6a',x:2.6,y:1.6,w:3.6,h:.9},
    open:[{t:'garage',x:-1.6,w:3.4,c:'#3a3a3a',awning:'#9a9a98'}]}),
  // the old ochre walls round the yards, clay roofs and a water tank behind
  muro('S',110.6,138,'#d8c890',2.2),
  // --- João Cabral de Medeiros → Manoel Pereira de Souza
  // the salmon corner house with a white railing round its porch
  L('S',145.2,156,{wall:'#e0a088',roof:'gable',roofColor:'#5a3a2a',fascia:W,setback:2,front:{h:.6,c:'#ecd8c8',rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'window',x:0,w:1.6,frame:W}]}),
  // the salmon house with a clay porch and a white gate
  L('S',156,166,{wall:'#e0a088',roof:'gable',roofColor:'#5a3a2a',fascia:W,setback:2,front:{h:.6,c:'#ecd8c8',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:-3.6,w:2.6,c:W}]},
    open:[{t:'open',x:1.6,w:2.6,h:2.3,c:'casa',awning:T},{t:'window',x:-1,w:1.2,grille:true}]}),
  // the grey wall of arched panels, a white sheet gate, the grey house with round windows behind
  L('S',166,180.6,{wall:'#d8d8d4',roof:'hip',roofColor:'#5a5a58',setback:3,front:{h:2.4,c:'#8a9098',gates:[{t:'gate',x:5,w:3,c:W}]},
    open:[{t:'arch',x:-2,w:2,y:.3,h:1.6},{t:'arch',x:1.6,w:1.4,y:1,h:.8}]}),
  L('S',180.6,193.9,{wall:'#d8d8d4',roof:'gable',roofColor:'#5a5a58',plinth:{h:1.2,c:'#b84a3a'},setback:3,front:{h:2.4,c:'#8a9098',gates:[{t:'gate',x:-4,w:1.2,c:W}]},
    open:[{t:'arch',x:-1,w:2,y:0,h:2.2,c:'casa'},{t:'arch',x:2,w:2,y:0,h:2.2,c:'casa'}]}),
  // nº 152: the grey house on a dark base, a white garage door, a tree in front
  L('S',193.9,206.5,{wall:'#a8acb4',roof:'gable',roofColor:'#5a5a58',plinth:{h:1,c:'#4a5058'},
    open:[{t:'garage',x:-2,w:3.4,c:W},{t:'window',x:1.4,w:1,frame:'#3a3a3a'},{t:'door',x:3.6,w:1,c:W}]}),
  // the empty lot behind a plain grey wall with a grey sheet gate
  muro('S',206.5,220.7,'#a8acb4',2.2,{front:{h:2.2,c:'#a8acb4',gates:[{t:'gate',x:-1,w:3.6,c:'#a8acb4'}]}}),
  // the grey house with white panel lines and black windows, a white door in a white portico
  L('S',220.7,236,{wall:'#b8bec8',roof:'gable',roofColor:'#5a5a58',panels:[{x:0,w:15,c:W,y0:1.2,y1:1.3}],
    open:[{t:'door',x:6,w:1,c:W},{t:'window',x:2,w:2,frame:W},{t:'window',x:-2,w:2,frame:W},{t:'garage',x:-5.6,w:2.6,c:W}]}),
  // the pink house behind a pink wall with a stepped top
  L('S',236,245.7,{wall:'#e4d0d0',roof:'gable',roofColor:'#8a4a32',setback:2.5,front:{h:1.2,c:'#e0c8c8'},open:[{t:'window',x:-1.4,w:1.6,frame:'#2a2a2a'},{t:'window',x:1.6,w:1.6,frame:'#2a2a2a'}]}),
  // the stone-clad house with a white door, a cypress in front
  L('S',245.7,255.3,{wall:'#c8a878',roof:'gable',roofColor:'#5a5a58',plinth:{h:2,stone:true},open:[{t:'door',x:1.6,w:1,c:W}]}),
  // the grey corner house: a barred carport, its clay-roofed neighbour on the corner
  L('S',255.3,259.1,{wall:'#a8aaac',roof:'gable',roofColor:T,setback:1,
    open:[{t:'open',x:0,w:2.6,h:2.3,c:'casa',grille:true}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:56,kind:'palmeira'},{side:'S',s:198,kind:'ficus'},{side:'S',s:250,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'S',start:12,every:34},
};
