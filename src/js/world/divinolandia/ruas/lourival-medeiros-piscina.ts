// Rua Lourival Medeiros across from the Piscina Municipal — surveyed lot by lot from Google
// Street View (2024–2026 imagery; one view aimed at each ~8 m of lot from the nearest panorama,
// local in docs/divinolandia/referencias-streetview/lm-N-*/ and lm-S-*/, kept out of git).
// Only the 130 m from the Tv. Luiz de Marco to the Avenida Marginal, where the street crosses the
// Rio do Peixe: the bake cuts that stretch off the OSM way as "Rua Lourival Medeiros#2"
// (SPLIT_WAYS), so the rest of the street keeps its generated houses. West→east, `s` from the
// Travessa: side 'N' is the north side (the butcher's, the houses, the São José supermarket, the
// mechanic's, the green and the mint houses, the peach corner house on the Marginal), 'S' the
// south side (two white houses, the pool's car park under the pepper trees, the pool front and
// the PM post: publicos.ts; past the Pio de Andrade, which only leaves to the south at s 85.3,
// the peach terrace and the garden wall to the Marginal).
// Granite setts. Opening x is measured from the lot centre as SEEN FROM THE STREET (left
// negative): on the north side (N) left is WEST (lower s), on the south side (S) left is EAST
// (higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Lourival Medeiros#2';
// (the Pio de Andrade, s 85.3, is a T on the south side only: no gap on the north sidewalk, its
// mouth is a keepOut on the south side)
export const CROSS=[0,130.2];
const SURFACE:Surface[]=[[0,130.2,'sett']];
const T='#b0603f',W='#f1efe9',CREME='#efe3cc',MARROM='#5a3a2a';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};

export const LOTS:Lot[]=[
  // ================= NORTH SIDE (N) =================
  // the Casa de Carnes Diniz by the Travessa corner (OSM runs the Travessa slanting over the
  // first metres, so the lot starts 10 m in): two storeys in terracotta, stone-clad pillars and
  // a stone canopy, the open shop under a white roll-up door, the orange name board
  L('N',9.8,16.5,{floors:2,wall:'#c8784a',upper:'#c8784a',roof:'flat',parapet:true,band:'#a89070',d:10,
    panels:[{x:-3,w:.6,stone:true,y0:0,y1:2.9},{x:2.2,w:.6,stone:true,y0:0,y1:2.9}],
    sign:{text:'CASA DE CARNES DINIZ',bg:'#d08458',fg:'#3a2418',x:-.4,y:3.48,w:5,h:.8},
    open:[{t:'open',x:-.4,w:3.6,h:2.5,c:'geral'},{t:'window',x:-1.8,w:1.2,fl:1,shutters:W},{t:'window',x:1.4,w:1.2,fl:1,shutters:W}]}),
  // the same building's next bay: the dark brown wooden garage door by a stone pillar
  L('N',16.5,19.8,{floors:2,wall:'#c8784a',upper:'#c8784a',roof:'flat',parapet:true,band:'#a89070',d:10,
    panels:[{x:1.3,w:.5,stone:true,y0:0,y1:2.9}],
    sign:{text:'SEANTO',bg:'#e8dcc8',fg:'#2a4a8a',x:-.2,y:3.4,w:2,h:.45},
    open:[{t:'garage',x:-.2,w:2.2,h:2.6,c:'#4a3226'},{t:'window',x:0,w:1.2,fl:1,shutters:W}]}),
  // nº 559–563: the salmon two-storey block with a long balcony, two white leaf doors and a
  // white grilled door
  L('N',19.8,27,{floors:2,wall:'#c86a5e',upper:'#c86a5e',roof:'gableSide',roofColor:T,d:10,
    balcony:{x:0,w:7.2,fl:1,rail:'white',depth:1.2},
    open:[{t:'garage',x:-2.3,w:2,c:W},{t:'garage',x:.3,w:2,c:W},{t:'door',x:2.5,w:.9,c:W,grille:true},
      {t:'window',x:-2.2,w:1.2,fl:1,shutters:W},{t:'window',x:1.4,w:1.2,fl:1,shutters:W}]}),
  // nº 575: the long cream house on a dark brown band, clay hip roof: a wooden garage door, a
  // brown louvred window, the little porch with a breeze-block parapet
  L('N',27,41,{wall:CREME,roof:'hip',roofColor:T,plinth:{h:.9,c:MARROM},d:11,
    open:[{t:'garage',x:-4,w:2.6,c:'#b08458'},{t:'window',x:-.4,w:1.8,shutters:'#a8744a'},
      {t:'open',x:4,w:3,h:2.4,c:'casa'},{t:'door',x:4.6,w:.9,c:'#6a4a3a'}]}),
  // nº 579: its neighbour, the same cream and brown, a small shop open under a corrugated awning
  L('N',41,49.5,{wall:CREME,roof:'hip',roofColor:T,plinth:{h:.9,c:MARROM},d:11,
    open:[{t:'window',x:-2.6,w:1.4,shutters:'#a8744a'},{t:'open',x:1.4,w:3.4,h:2.4,c:'geral',awning:'#a8acb0'}]}),
  // (49.5–65: the São José Supermercado, comercio/lojas.ts)
  // Wanderlei, the mechanic's: white over a blue base, the grey roll door,
  // the blue name board
  L('N',65.5,72.5,{wall:'#f0f0ec',roof:'hip',roofColor:T,plinth:{h:1.3,c:'#2a4aa8'},d:11,
    sign:{text:'WANDERLEI',bg:'#2a4aa8',fg:'#ffffff',x:-2.2,y:2.3,w:1.4,h:.9},
    open:[{t:'garage',x:.4,w:2.8,h:2.7,c:'#9aa0a4'}]}),
  // the pale yellow house with its gable to the street: a grey louvred window, a barred one
  L('N',72.5,79.5,{wall:'#ecdca8',roof:'gable',roofColor:T,fascia:W,d:11,
    open:[{t:'window',x:-1.7,w:1.4,shutters:'#8a8c8e'},{t:'window',x:1.5,w:1.8,grille:true}]}),
  // the brown wooden door and gate under a little tiled porch roof, the drive to the back
  L('N',79.5,83.5,{wall:'#ecdca8',roof:'hip',roofColor:T,setback:3,d:8,
    front:{h:2.1,c:'#ecdca8',gates:[{t:'gate',x:-.8,w:1.9,h:2.1,c:'#7a4a2a',awning:T}]}}),
  // --- past the Pio de Andrade (on the other side) to the Marginal
  // the grey stuccoed wall with a modern grey sliding gate, the clay roof of the house behind
  L('N',83.5,88.5,{wall:'#d8d2c6',roof:'hip',roofColor:T,setback:4,d:8,
    front:{h:2.3,c:'#b8b2a8',gates:[{t:'gate',x:-.2,w:4,h:2.2,c:'#7a8088'}]}}),
  // the pale grey front with a white louvred window, a grey roughcast base
  L('N',88.5,93.5,{wall:'#d8d4cc',roof:'hip',roofColor:T,plinth:{h:1.1,c:'#9a968e'},d:11,
    open:[{t:'window',x:.8,w:1.6,shutters:W}]}),
  // the olive-green house under a long clay hip roof: a white louvred window, a white barred
  // window, the white door and the white leaf garage under a corrugated awning, a small window
  L('N',93.5,109.5,{wall:'#8c977a',roof:'hip',roofColor:T,d:11,
    open:[{t:'window',x:-5.6,w:1.6,shutters:W,frame:W},{t:'window',x:-2,w:1.8,grille:true,frame:W},
      {t:'door',x:.6,w:.9,c:W,awning:'#a8acb0'},{t:'garage',x:3.4,w:2.2,c:W,awning:'#a8acb0'},{t:'window',x:6.4,w:.8,h:.6,y:1.5,frame:W}]}),
  // the mint house with its gable to the street: a brown door, the glass shop front under a
  // beige awning, a grey speckled base
  L('N',109.5,117.5,{wall:'#a8dcc8',roof:'gable',roofColor:T,fascia:W,plinth:{h:.7,c:'#8a8a86'},d:11,
    open:[{t:'door',x:-2.6,w:.9,c:'#6a3a22'},{t:'glass',x:.4,w:3,y:.1,h:2.4,frame:'#3a3a3a',awning:'#c8bfa8'},{t:'window',x:3.1,w:.8,frame:W}]}),
  // the narrow peach recess with a brown wooden gate
  {side:'N',s0:117.5,s1:119.3,f:{wallOnly:true,wall:'#e8c0a0',d:1,front:{h:2.2,c:'#e8c0a0',gates:[{t:'gate',x:0,w:1.2,h:2,c:'#7a5030'}]}}},
  // nº 657, the peach corner house on the Marginal (its side wall runs along the Marginal, where
  // that street's spec leaves it to this lot): the porch with a door and a window, a brown
  // louvred window in a white raised frame
  L('N',119.3,124,{wall:'#ecc4a8',roof:'hip',roofColor:T,d:11,
    open:[{t:'open',x:-1,w:2,h:2.4,c:'casa',awning:T},{t:'window',x:1.4,w:1.2,shutters:'#7a4a2a',frame:W}]}),
  // ================= SOUTH SIDE (S) =================
  // the white house with two white leaf garage doors, a white louvred window
  L('S',3.8,10,{wall:'#ecebe6',roof:'gable',roofColor:T,d:11,x:['dish'],
    open:[{t:'garage',x:-1.6,w:2.2,c:W},{t:'garage',x:1.4,w:2.2,c:W}]}),
  // the white house beside it: a louvred window and a white garage door, the dish on the roof
  L('S',10,16.5,{wall:'#ecebe6',roof:'hip',roofColor:T,d:11,x:['dish'],
    open:[{t:'garage',x:-1.5,w:2.4,c:W},{t:'window',x:1.6,w:1.4,shutters:W}]}),
  // --- past the Pio de Andrade: the long peach roughcast terrace under one clay roof, white
  // gutters, the windows in raised white frames, on a black-and-white wave-pattern sidewalk
  L('S',91.3,102,{wall:'#e8c8a0',roof:'hip',roofColor:T,fascia:W,d:11,x:['dish'],
    open:[{t:'window',x:4.2,w:1.2,frame:W,shutters:'#e8e4d8'},{t:'garage',x:-1.2,w:2.2,c:'#e8e4d8'},{t:'door',x:-4.4,w:.9,c:W}]},'mosaico'),
  L('S',102,114.5,{wall:'#e8c8a0',roof:'hip',roofColor:T,fascia:W,d:11,x:['dish'],
    open:[{t:'window',x:4,w:1.8,grille:true,frame:W},{t:'window',x:-1.2,w:1.6,shutters:'#d8d0b8',frame:W},{t:'garage',x:-4.6,w:2.4,c:W}]},'mosaico'),
  // the white leaf gate under a little tiled porch roof in the high peach wall
  L('S',114.5,119.5,{wall:'#e8c8a0',roof:'hip',roofColor:T,setback:3,d:8,
    front:{h:2.6,c:'#e8c8a0',gates:[{t:'gate',x:.2,w:3.6,h:2.3,c:'#ecebe6',awning:T}]}},'mosaico'),
  // the high peach garden wall to the Marginal corner, bougainvillea and palms over it
  {side:'S',s0:119.5,s1:126.4,f:{wallOnly:true,wall:'#e8c8a0',d:1,front:{h:2.2,c:'#e8c8a0'}},walk:'mosaico'},
];

// the pepper trees over the pool's car park, on its kerb
export const TREES:Tree[]=[
  {side:'S',s:21,kind:'ficus'},{side:'S',s:31,kind:'ficus'},{side:'S',s:41,kind:'ficus'},{side:'S',s:51,kind:'ficus'},
  // the palms of the garden behind the corner wall
  {side:'S',s:123,kind:'palmeira'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:17,every:34},
  keepOut:[
    {side:'N',s0:49.5,s1:65.5,why:'São José Supermercado — Loja 02 (comercio/lojas.ts)'},
    {side:'S',s0:16.5,s1:81.5,why:'Piscina Municipal (car park, front, pool) and the PM post (publicos.ts)'},
    {side:'S',s0:81.5,s1:89.3,why:'the mouth of the Rua Pio de Andrade',walk:false},
  ],
};
