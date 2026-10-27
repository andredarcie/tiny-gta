// Rua Francisco Pereira de Souza — surveyed lot by lot from Google Street View (2024–2026
// imagery; one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/fps-N-*/ and fps-S-*/, kept out of git). 682 m
// north→south from the Avenida Marginal, past the east side of the Matriz squares, to the São
// Vicente de Paula. `s` starts at the NORTH end, so side 'N' is the EAST side (left of a
// walker going south) and 'S' the WEST side.
//   s=52 R. Walter Tavares   s=103 R. Plínio de Carvalho   s=163 R. Antônio de Melo
//   s=192 R. Dom Antônio J. de Mello   s=245 R. Cel. José Leopoldino   s=324 R. Treze de Maio
//   s=390 R. Romeu Zanetti   s=456 R. XV de Novembro   s=544 R. Sete de Setembro / the squares
//   s=606 R. José Augusto Machado
// Asphalt to the Treze de Maio, granite setts from there up. Left alone (their own models):
// the warehouse of the Bita diesel workshop (galpoes.ts), the Lunayma corner and the shops of
// comercio/lojas.ts, the Matriz squares, the corner lots that face the cross streets' specs.
// Opening x is measured from the lot centre as SEEN FROM THE STREET (left negative): on the
// east side (N) left is NORTH (lower s), on the west side (S) left is SOUTH (higher s).
// Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Francisco Pereira de Souza';
export const CROSS=[0,52.2,102.8,163.4,191.5,245.3,324.4,389.8,455.9,543.6,606.1,682.1];
const SURFACE:Surface[]=[[0,324.4,'asphalt'],[324.4,682.1,'sett']];
const T='#b0603f',TD='#8e4632',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- Marginal → Walter Tavares
  // Mercearia do Pinguim: the mint-green grocery on the corner
  L('N',5,15,{wall:'#cfe3cc',roof:'flat',parapet:true,open:[{t:'open',x:-2,w:2,h:2.4,c:'casa'},{t:'window',x:2,w:1,grille:true}],
    sign:{text:'MERCEARIA DO PINGUIM',bg:'#f2f2ee',fg:'#2a2a2a',x:-1,y:2.5,w:5,h:.7}}),
  // a galvanised sheet shed with two big doors
  L('N',15,28,{wall:'#8a96a0',roof:'flat',fascia:'#7a848c',eave:.3,front:{h:.2,c:'#8a96a0'},
    open:[{t:'garage',x:-3,w:4,h:3.4,c:'#8f9ca6'},{t:'garage',x:3,w:4,h:3.4,c:'#8f9ca6'}]}),
  // brick pillars and grey railings round a tiled porch, a grey gate
  L('N',28,36,{wall:'#e6dcc8',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#b8b4ac',rail:{h:1.2,c:'#5a5c60',style:'bars'},gates:[{t:'gate',x:-3,w:1.2,c:'#5a5c60'}]},
    panels:[{x:-1,w:.5,c:'#a8503a'},{x:2,w:.5,c:'#a8503a'}],open:[{t:'open',x:.5,w:3,h:2.3,c:'casa'}]}),
  // a rough block house under a fibre-cement roof
  L('N',36,48,{wall:'#9a958c',roof:'flat',fascia:'#b8b4ac',eave:.3,open:[{t:'window',x:-2,w:.9,grille:true},{t:'window',x:2.4,w:.9,grille:true}]}),
  // --- Walter Tavares → Plínio de Carvalho
  // grey speckled house trimmed with white wavy bands, louvred windows, a garage
  L('N',56.8,75,{wall:'#a9a9a3',roof:'hip',roofColor:T,plinth:{h:.8,c:'#8f8f8a'},
    open:[{t:'window',x:-7,w:1.6,shutters:'#c9c9c4',frame:W},{t:'window',x:-4,w:.9,grille:true,frame:W},{t:'window',x:-2.4,w:.9,grille:true,frame:W},
      {t:'window',x:0,w:1.6,shutters:'#c9c9c4',frame:W},{t:'window',x:3.2,w:2.2,grille:true,frame:W},{t:'garage',x:7,w:2.8,c:'#e8e8e6'}]}),
  // peach house: orange trim, arched windows, a brown picket fence
  L('N',75,85,{wall:'#ecc9a8',roof:'gable',roofColor:T,fascia:'#d07040',eave:.8,setback:2.5,
    front:{h:.4,c:'#c9a684',rail:{h:1.1,c:'#7a4a2e',style:'bars'}},
    open:[{t:'arch',x:-3,w:1.6,h:2.2,y:0},{t:'arch',x:0,w:1.6,frame:'#d07040'},{t:'arch',x:2.6,w:1.4,h:.8,y:1.4,frame:'#d07040'}]}),
  // beige house behind a plain wall, its porch under clay tiles
  L('N',85,96,{wall:'#e6cfb0',roof:'gable',roofColor:T,fascia:'#8a5a3a',setback:3,front:{h:1.4,c:'#e0cdb2',gates:[{t:'gate',x:-3.6,w:1.2,c:'#e0cdb2'}]},
    open:[{t:'window',x:0,w:1.8,grille:true},{t:'window',x:3,w:1.6,shutters:'#e6dcc0'}]}),
  // --- Plínio de Carvalho → Antônio de Melo
  // lilac-grey house with a long veranda behind a balustrade, pink pillars
  L('N',107,124,{wall:'#b9b4b8',roof:'hip',roofColor:T,setback:3,panels:[{x:-6,w:.6,c:'#e8c8c8'},{x:-1,w:.6,c:'#e8c8c8'},{x:4,w:.6,c:'#e8c8c8'}],
    front:{h:1,c:'#ece6e2',rail:{h:.4,c:W,style:'bars'}},open:[{t:'window',x:-3.4,w:1.4,shutters:'#e6e2dc'},{t:'door',x:2,w:1,c:'#7a4a2e'}]}),
  // pink-and-white house with a balustrade porch, grey sheet gate
  L('N',124,132,{wall:'#ece4e2',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#e8d6d4',rail:{h:.4,c:W,style:'bars'},gates:[{t:'gate',x:2,w:3,c:'#c9ccce'}]},
    open:[{t:'door',x:-2.2,w:1,c:'#7a4a2e'}]}),
  // orange-brick house under a dark gable, brown garage gates
  L('N',132,140,{wall:'#d08a4a',roof:'gable',roofColor:'#6a3a2a',fascia:'#6a3a2a',eave:.9,
    open:[{t:'gate',x:-2.6,w:2.6,c:'#8a5a3a'},{t:'window',x:.6,w:1.4,shutters:'#6a3a2a',frame:W},{t:'garage',x:3,w:2,c:'#3a2a24',awning:'#e6dcc8'}]}),
  // grey wall and white gate before the corner house
  muro('N',140,147,'#b8b4ac',2.2,{front:{h:2.2,c:'#b8b4ac',gates:[{t:'gate',x:0,w:3.6,c:'#f2f2f0'}]},behind:{w:5,d:8,at:3,roofColor:T,wall:'#ece6da'}}),
  // taupe corner house, white louvred windows
  L('N',147,158.7,{wall:'#8e8378',roof:'hip',roofColor:T,
    open:[{t:'window',x:-4,w:1.8,shutters:W,frame:W},{t:'window',x:-1.4,w:1.2,frame:W},{t:'window',x:2.6,w:3,shutters:W,frame:W}]}),
  // --- Antônio de Melo → Dom Antônio J. de Mello
  // a brick base with half-moon cut-outs, a double clay roof, white garage door
  L('N',167,178,{wall:'#c9b49a',roof:'hip',roofColor:T,plinth:{h:1.6,c:'#c97a4a'},open:[{t:'window',x:-2,w:3,h:.6,y:2.2,frame:'#7a2a24'},{t:'garage',x:3,w:2.6,c:W}]}),
  // blue-grey roughcast house under a grey gable, a white garage and a carport
  L('N',178,188,{wall:'#9ea8bc',roof:'gable',roofColor:'#6a6a68',fascia:'#6a6a68',eave:.8,
    open:[{t:'garage',x:-3.4,w:2.6,c:W},{t:'window',x:-.4,w:1.8,shutters:'#a8b4bc',frame:W},{t:'window',x:2.6,w:1.8,grille:true,frame:W}]}),
  // --- Dom Antônio J. de Mello → Coronel José Leopoldino
  // grey house behind a white barred fence, a flowering tree
  L('N',195,203,{wall:'#a8a49c',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#c9c4bc',rail:{h:1.1,c:W,style:'bars'}},
    open:[{t:'window',x:-1,w:1.6,grille:true},{t:'door',x:2,w:1,c:'#6a6a6a'}]}),
  L('N',203,210,{wall:'#a8a49c',roof:'gable',roofColor:T,fascia:W,setback:3,front:{h:.6,c:'#c9c4bc',rail:{h:1.1,c:W,style:'bars'},gates:[{t:'gate',x:-1,w:1.2,c:W}]},
    open:[{t:'open',x:-1.4,w:2,h:2.2,c:'casa'},{t:'window',x:1.6,w:1.2,shutters:W,frame:W}]}),
  // brick-faced sobrado on a dark stone base, yellow awnings, a barred garage gate
  L('N',210,220,{floors:2,wall:'#c9783a',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',plinth:{h:.8,c:'#4a4a4c',stone:true},
    open:[{t:'gate',x:-1.6,w:3,c:'#3a3a3c'},{t:'window',x:2.6,w:1.4,awning:'#d8b45a',shutters:'#5a3a2a'},{t:'arch',x:-1.6,w:1,h:1.8,y:0,fl:1}],
    balcony:{x:-1.6,w:3.6,fl:1,rail:'iron'}}),
  // pink sobrado on the slope: a red-pink ground floor with a brown garage, brown shutters above
  L('N',220,231,{floors:2,wall:'#c8706a',upper:'#efc8c8',roof:'hip',roofColor:T,
    open:[{t:'garage',x:-2.8,w:3,c:'#5a4a3a'},{t:'window',x:2,w:1.6,frame:W},{t:'window',x:-2.4,w:1.6,fl:1,shutters:'#7a4a2e'},{t:'window',x:2.4,w:1.2,fl:1,shutters:'#7a4a2e'}]}),
  // its corner porch under a tiled roof
  L('N',231,240.7,{wall:'#efc8c8',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#c8706a'},
    open:[{t:'window',x:-3.6,w:1,shutters:'#7a4a2e'},{t:'open',x:.6,w:4.6,h:2.4,y:1.2,c:'casa'}]}),
  // --- Coronel José Leopoldino → Treze de Maio
  // corner sobrado: taupe walls, a white glass-railed balcony above
  L('N',250,266,{floors:2,wall:'#c4bba8',upper:'#efefed',roof:'hip',roofColor:T,
    open:[{t:'window',x:-3,w:2,grille:true},{t:'window',x:3,w:2,grille:true},{t:'window',x:-3,w:2,fl:1},{t:'window',x:3,w:2,fl:1}],balcony:{x:0,w:14,fl:1,rail:'white'}}),
  // white front wall, a wooden gate under clay tiles, the house behind
  muro('N',266,274,'#efede6',2.2,{front:{h:2.2,c:'#efede6',gates:[{t:'gate',x:-1.6,w:1.2,c:'#5a3a24',awning:T},{t:'open',x:2,w:3.4,c:'casa'}]},
    behind:{w:7,d:8,at:3,roofColor:T,wall:'#ece6da'}}),
  // nº 402: old brick-and-clay house behind a curved white wall, white barred gate under an awning
  L('N',274,284,{wall:'#b5683f',roof:'hip',roofColor:T,setback:3.5,front:{h:1.4,c:'#ece8e2',gates:[{t:'gate',x:2,w:3.4,c:W,awning:'#c9c4b0'}]},
    open:[{t:'window',x:-2,w:1.4}]}),
  // white sobrado with diagonal-barred garage gates
  L('N',284,294,{floors:2,wall:'#ece8e2',roof:'flat',parapet:true,plinth:{h:.4,stone:true},
    open:[{t:'garage',x:-2.6,w:2.6,c:W},{t:'gate',x:1.8,w:3.4,c:W},{t:'window',x:-1,w:3,fl:1}],balcony:{x:0,w:9,fl:1,rail:'white'}}),
  // a precast wall and steps, a white house behind
  muro('N',294,300,'#b8b4aa',1.8,{behind:{w:5,d:8,at:3,roofColor:T,wall:'#ece8e2'}}),
  // the grey annex with a lattice door, then the cream wall on a brown band of the corner pet shop
  L('N',300,306,{wall:'#9a9894',roof:'flat',parapet:true,open:[{t:'window',x:-.6,w:1.6,grille:true},{t:'door',x:1.6,w:.9,c:W}]}),
  L('N',306,318,{wall:'#ece0bc',roof:'hip',roofColor:T,plinth:{h:1.5,c:'#7a3a24'},
    open:[{t:'window',x:-3.6,w:1.8,y:2,shutters:'#3a3a3a'},{t:'window',x:0,w:1.8,y:2,shutters:'#3a3a3a'},{t:'window',x:3.6,w:1.8,y:2,shutters:'#3a3a3a'}]}),
  // --- Treze de Maio → Romeu Zanetti
  // grey-and-white house behind a white barred fence
  L('N',328.9,342,{wall:'#d8d6d0',roof:'gable',roofColor:'#b9b6b0',fascia:W,setback:3,front:{h:.6,c:'#c9c6be',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:2,w:3,c:W}]},
    panels:[{x:-3,w:2.4,c:'#c9c6be'}],open:[{t:'window',x:0,w:2,grille:true}]}),
  // stone-clad sobrado: black glass door, white garage, balustered planters, balconies above
  L('N',342,354.5,{floors:2,wall:'#f2f2f0',roof:'flat',parapet:true,panels:[{x:0,w:12.5,stone:true,y0:0,y1:2.9}],
    open:[{t:'glass',x:-3.4,w:2.4,y:0,h:2.4,frame:'#1c1c1c'},{t:'garage',x:.6,w:3,c:W},{t:'window',x:3.8,w:1.2,grille:true},{t:'window',x:0,w:6,fl:1}],
    balcony:{x:0,w:12,fl:1,rail:'white'}}),
  // old salmon house under a clay gable, white railing
  L('N',354.5,362,{wall:'#d27a64',roof:'gable',roofColor:T,fascia:'#5a3a2a',setback:2,front:{h:.6,c:'#c9b8a0',rail:{h:1,c:W,style:'bars'}},
    open:[{t:'window',x:0,w:1.8,grille:true,awning:'#c9c4b0'}]}),

  // --- Romeu Zanetti → XV de Novembro
  // white house on a stone-textured base, a glazed corner porch
  L('N',394,404,{wall:'#ecebe7',roof:'flat',fascia:'#ecebe7',eave:.6,setback:2,plinth:{h:1.4,c:'#b8b2a8',stone:true},
    open:[{t:'glass',x:0,w:6,h:1.8,y:1.4,frame:W}]}),
  // modern grey house: a glass veranda, white garage gate
  L('N',404,412,{wall:'#c9c6c0',roof:'hip',roofColor:T,setback:3,front:{h:1,c:'#b8b2a8',style:'stone'},
    open:[{t:'glass',x:-1.6,w:3,frame:W},{t:'garage',x:2.4,w:2.6,c:W}]}),
  // grey sobrado with white sheet gates
  L('N',412,420,{floors:2,wall:'#8f9094',upper:'#ece9e2',roof:'flat',parapet:true,
    open:[{t:'gate',x:-2,w:1.2,c:W},{t:'gate',x:1.6,w:3.4,c:W},{t:'window',x:0,w:4,fl:1}],balcony:{x:0,w:7,fl:1,rail:'white'}}),
  // (s 420–452: Banco do Brasil on the XV corner, comercio/lojas.ts)
  // --- XV de Novembro → Sete de Setembro (Farma Popular on the corner)
  // CASTSEG under a steel canopy
  L('N',477,484,{wall:'#1f3f8a',roof:'flat',fascia:'#a8aeb2',eave:1.2,open:[{t:'glass',x:0,w:3,y:0,h:2.4,frame:'#a8aeb2'}],
    sign:{text:'CASTSEG',bg:'#1f4aa0',fg:'#ffffff',x:0,y:2.6,w:2.4,h:.6}}),
  // green houses: a roll door, a dark window under a green awning, VENDE behind black railings
  L('N',484,490,{wall:'#a8b87a',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:2.6,c:'#2a2a2a'},{t:'window',x:0,w:3.4,y:2.6,h:.8,frame:W,awning:'#3fa88a'}]}),
  L('N',490,499,{wall:'#a8b87a',roof:'flat',fascia:W,eave:.6,setback:2,front:{h:.6,c:'#8a9a6a',rail:{h:1.2,c:'#1c1c1c',style:'bars'},gates:[{t:'gate',x:3,w:2.4,c:'#1c1c1c'}]},
    open:[{t:'window',x:-2.4,w:1.8,frame:W,awning:'#3fa88a'},{t:'open',x:.6,w:2.6,h:2.3,c:'casa'}]}),
  // taupe houses, white louvred windows in white frames, a garage
  L('N',499,510,{wall:'#c4b8a6',roof:'hip',roofColor:T,plinth:{h:.6,c:'#b8ac98'},
    open:[{t:'window',x:-3.6,w:1.8,shutters:W,frame:W},{t:'window',x:-.4,w:1.8,shutters:W,frame:W},{t:'window',x:3,w:1.4,shutters:W,frame:W}]}),
  L('N',510,518,{wall:'#c4b8a6',roof:'hip',roofColor:T,open:[{t:'garage',x:-.6,w:2.6,c:'#c4bcb0'},{t:'window',x:2.6,w:1.2,shutters:W}]}),
  // the painted wall of the estate agent's yard
  muro('N',518,529,'#efede6',2.2,{behind:{w:6,d:8,at:4,roofColor:T,wall:'#ece4d6'}}),
  // nº 101: cream sobrado on a dark red base, its veranda behind maroon railings
  L('N',529,540,{wall:'#f2ecd8',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',eave:.9,plinth:{h:2,c:'#9a3a2e'},
    open:[{t:'garage',x:-3.6,w:2.6,c:'#9a3a2e'},{t:'open',x:1,w:5,h:2.2,y:2,c:'casa'}]}),
  // --- Sete de Setembro → José Augusto Machado
  // grey-blue corner house with a striped awning and a painted mural
  L('N',547.9,560,{wall:'#9aa8b8',roof:'hip',roofColor:T,plinth:{h:1,c:'#8a929a'},
    open:[{t:'window',x:-4,w:1.4,grille:true},{t:'door',x:-1.6,w:1,c:'#2a2a2a',awning:'#c8322c'},{t:'window',x:1.6,w:1.4,grille:true},{t:'window',x:4.4,w:1.4,grille:true}]}),
  muro('N',560,568,'#9a958c',2,{front:{h:2,c:'#9a958c',gates:[{t:'gate',x:-1,w:2.6,c:'#a87a5a'}]},behind:{w:6,d:8,at:3,roofColor:T,wall:'#ece4d0'}}),
  // blue-and-black two-storey diner under a corrugated awning
  L('N',568,580,{floors:2,wall:'#1c1c1e',upper:'#2f5fa8',roof:'hip',roofColor:T,open:[{t:'garage',x:0,w:8,h:2.6,c:'#1c1c1e',awning:'#c9cdd0'}],
    sign:{text:'TEXAS BURG',bg:'#1c1c1e',fg:'#e8322c',x:0,y:2.9,w:3,h:.4}}),
  muro('N',580,586,'#9a958c',2),
  // pink-and-cream sobrado: dark brown garage gate, balconies with black railings
  L('N',586,600,{floors:2,wall:'#ece4d0',upper:'#c8706a',roof:'flat',parapet:true,plinth:{h:.4,stone:true},
    open:[{t:'gate',x:-1,w:4.4,c:'#3a2a24'},{t:'window',x:4,w:1.4,frame:W},{t:'window',x:-2,w:2,fl:1,awning:W},{t:'window',x:3,w:2,fl:1,awning:W}],
    balcony:{x:-2,w:5,fl:1,rail:'iron'}}),
  // --- José Augusto Machado → São Vicente de Paula
  // old whitewashed houses with roll doors
  L('N',612,622,{wall:'#ece8e0',roof:'hip',roofColor:T,plinth:{h:.6,c:'#c9b49a'},open:[{t:'garage',x:2,w:2.6,c:'#c8c8c4'},{t:'window',x:-2,w:1,grille:true}]}),
  L('N',622,630,{wall:'#ece4cc',roof:'hip',roofColor:T,plinth:{h:.5,c:'#c98a5a'},open:[{t:'garage',x:0,w:2.6,c:'#c8c8c4'}]}),
  // lime houses on a dark green base, dark green gates; the auto mechanic's
  L('N',630,638,{wall:'#d8dc9a',roof:'hip',roofColor:T,plinth:{h:1,c:'#2a5a3a'},open:[{t:'window',x:-2,w:1.6,shutters:'#3a3a3a'},{t:'gate',x:1.6,w:3.4,c:'#2a5a5a'}]}),
  L('N',638,646,{wall:'#d8dc9a',roof:'hip',roofColor:T,plinth:{h:1,c:'#2a5a3a'},open:[{t:'window',x:-2.4,w:1.6,shutters:'#3a3a3a'},{t:'gate',x:1.2,w:3.4,c:'#2a5a5a'}]}),
  L('N',646,653,{wall:'#ecc8b0',roof:'hip',roofColor:T,open:[{t:'open',x:.6,w:3,h:2.6,c:'casa',awning:'#c9cdd0'},{t:'window',x:-2.4,w:1.2,grille:true}],
    sign:{text:'AUTO MECÂNICA',bg:'#f2f2f0',fg:'#2a3a8a',x:-1,y:2.8,w:2.4,h:.5}}),
  // lime house with green frames behind a fence, a white garage beside it
  L('N',653,664,{wall:'#d8dc9a',roof:'hip',roofColor:T,fascia:W,setback:2,front:{h:.6,c:'#d8dc9a',rail:{h:1,c:'#5a5c40',style:'bars'}},
    panels:[{x:-4,w:3,c:W}],open:[{t:'garage',x:-4,w:2.6,c:W},{t:'door',x:0,w:1,c:W},{t:'window',x:2.6,w:1.4,frame:'#3a6a3a',shutters:W}]}),
  muro('N',664,676,'#9a958c',2.2),
  // ================= WEST SIDE (S) =================
  // --- Marginal → Walter Tavares
  // the tyre shop's yard: precast wall with blue sheet gates, the shed behind
  muro('S',4,14,'#b8b4aa',2,{front:{h:2,c:'#b8b4aa',gates:[{t:'gate',x:0,w:4.4,c:'#3a6ab0'}]},behind:{w:8,d:8,at:2,roof:'flat',roofColor:'#8f8b84',wall:'#d8d6d0'}}),
  muro('S',14,23,'#b8b4aa',2,{front:{h:2,c:'#b8b4aa',gates:[{t:'gate',x:-1,w:4.4,c:'#3a6ab0'}]}}),
  // --- Walter Tavares → Plínio de Carvalho (the warehouse of the diesel workshop takes s 23–58)
  // beige house: brown corrugated garage gate, dark windows
  L('S',58.5,67.8,{wall:'#e6dcd0',roof:'gable',roofColor:'#8a8a86',fascia:'#6a5a4a',
    open:[{t:'window',x:2.8,w:1.4,grille:true},{t:'garage',x:-.6,w:3,c:'#4a3a2e'},{t:'window',x:-3.6,w:1,grille:true}]}),
  // nº 597: orange house on stone, stone pilasters, green glass, white diagonal gate
  L('S',67.8,80,{wall:'#e8902e',roof:'gable',roofColor:'#6a3a2a',fascia:'#6a3a2a',eave:.9,plinth:{h:1.4,c:'#8a7a64',stone:true},
    panels:[{x:-3,w:.6,stone:true},{x:1,w:.6,stone:true}],
    open:[{t:'window',x:3.8,w:1.2,shutters:W},{t:'glass',x:-.8,w:2.4,frame:'#3a8a6a'},{t:'gate',x:-4.6,w:3,c:W}]}),
  // a house behind a stone wall with white diagonal railings and a big white gate
  L('S',80,96.5,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:4,front:{h:1.4,c:'#5a5650',style:'stone',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:4,w:4,c:W}]},
    open:[{t:'open',x:-1,w:5,h:2.2,c:'casa'}]}),
  // --- Plínio de Carvalho → Antônio de Melo
  // the taupe wall with white diamond grilles of a light-roofed house
  L('S',106.8,122,{wall:'#e6d6c0',roof:'hip',roofColor:'#d8c8b0',setback:4,front:{h:2.2,c:'#bba59a',gates:[{t:'gate',x:-1,w:3,c:W},{t:'door',x:4,w:1,c:'#e6dcd0'}]},
    open:[{t:'window',x:0,w:2.4}]}),
  muro('S',122,129,'#c9c6be',2.6),
  muro('S',129,136,'#d8d6d0',2.6,{front:{h:2.6,c:'#d8d6d0',gates:[{t:'gate',x:1.6,w:3.6,c:'#1c1c1e'}]}}),
  // old beige house under a tiled porch, roses behind iron railings
  L('S',136,146,{wall:'#e6dcc4',roof:'gable',roofColor:'#8a8a86',setback:3,front:{h:.3,c:'#c9c4bc',rail:{h:1.2,c:'#6a6c70',style:'bars'}},
    open:[{t:'open',x:.6,w:5,h:2.2,c:'casa',awning:T}]}),
  // nº 237: taupe-pink gable houses, grey louvred windows, a white sheet gate
  L('S',146,154,{wall:'#c9b4aa',roof:'gable',roofColor:'#6a4a3a',fascia:'#6a4a3a',open:[{t:'window',x:1.6,w:1.8,shutters:'#7a7570'},{t:'window',x:-2,w:1.6,shutters:'#7a7570'}]}),
  L('S',154,160,{wall:'#c9b4aa',roof:'gable',roofColor:'#6a4a3a',fascia:'#6a4a3a',open:[{t:'gate',x:1.8,w:1.8,c:W},{t:'gate',x:-1,w:2.4,c:'#9a8a6a'}]}),
  // taupe house striped in white, its gable to the street
  L('S',160,166,{wall:'#8e7e70',roof:'gable',roofColor:T,fascia:W,band:W,open:[{t:'window',x:0,w:1,h:.4,y:1.6}]}),
  // --- Antônio de Melo → Dom Antônio J. de Mello
  // yellow house: a tiled porch over a carport behind red iron railings
  L('S',167.5,178,{wall:'#e8c87a',roof:'hip',roofColor:T,setback:2,front:{h:.2,c:'#c9a66a',rail:{h:1.6,c:'#8a2a24',style:'bars'}},
    open:[{t:'open',x:-1.6,w:4,h:2.3,c:'casa',awning:T},{t:'door',x:2.6,w:1,c:'#8a2a24'}]}),
  // old cream houses under fibre roofs, grilled windows, iron railings; one on the corner
  L('S',178,184,{wall:'#ece4cc',roof:'flat',fascia:'#d8d2c0',setback:1.5,front:{h:.4,c:'#c9c4bc',rail:{h:.9,c:'#8a4a2e',style:'bars'}},
    open:[{t:'window',x:2,w:1.2,grille:true},{t:'open',x:-1.4,w:2.6,h:2.3,c:'casa'}]}),
  L('S',184,187.6,{wall:'#ece4cc',roof:'hip',roofColor:T,setback:1.5,front:{h:.4,c:'#c9c4bc',rail:{h:.9,c:'#8a4a2e',style:'bars'}},
    open:[{t:'window',x:0,w:1.2,grille:true}]}),
  // --- Dom Antônio J. de Mello → Coronel José Leopoldino
  // beige corner house, brown shutters, over a terracotta band
  L('S',195.8,200,{wall:'#ece4cc',roof:'hip',roofColor:T,plinth:{h:1,c:'#b8704a'},open:[{t:'window',x:0,w:1.4,shutters:'#8a5a3a'}]}),
  // a brown sheet gate in a concrete wall, the grey house behind it
  L('S',200,208,{wall:'#c9c2b6',roof:'gable',roofColor:'#6a6a68',fascia:'#6a6a68',setback:3,front:{h:1.8,c:'#a8a49c',gates:[{t:'gate',x:2,w:2.8,c:'#a87a5a'}]},
    open:[{t:'window',x:-1,w:1.6,frame:'#1c1c1c'},{t:'window',x:-3,w:1.4,shutters:'#a87a5a'}]}),
  // tiled houses with brick-pillared porches, roses behind white and iron railings
  L('S',208,217,{wall:'#ece8e0',roof:'hip',roofColor:T,setback:3,front:{h:.8,c:'#7a7268',style:'stone',rail:{h:1.1,c:W,style:'bars'}},
    panels:[{x:-2.8,w:.6,c:'#a8503a'},{x:2.6,w:.6,c:'#a8503a'}],open:[{t:'open',x:0,w:4,h:2.3,c:'casa'}]}),
  L('S',217,226,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:3,front:{h:.4,c:'#c9c4bc',rail:{h:1.1,c:'#6a6c70',style:'bars'},gates:[{t:'gate',x:3,w:2.6,c:'#6a6c70'}]},
    panels:[{x:-3,w:.6,c:'#a8503a'}],open:[{t:'window',x:-1,w:1.6},{t:'door',x:1.2,w:1,c:'#7a4a2e'}]}),
  // nº 429: grey sheet gate and an iron gate
  muro('S',226,232,'#d8d0c0',2,{front:{h:2,c:'#d8d0c0',gates:[{t:'gate',x:1,w:2.6,c:'#a8b0b6'},{t:'gate',x:-2,w:1.8,c:'#6a6c70'}]},behind:{w:5,d:8,at:3,roofColor:T,wall:'#c4bba8'}}),
  // blue-grey roughcast house behind a rough wall
  L('S',232,241.6,{wall:'#7a8494',roof:'gable',roofColor:'#6a6a68',fascia:'#c9c4b0',setback:3,front:{h:1.6,c:'#c9b49a',gates:[{t:'gate',x:-.4,w:1,c:'#a8b0b6'}]},
    open:[{t:'window',x:2,w:1.2,grille:true},{t:'door',x:-.4,w:.9,c:'#a8b0b6'}]}),
  // --- Coronel José Leopoldino → Treze de Maio
  // corner sobrado: a brick porch, white pickets on a granite-textured wall
  L('S',249.9,258,{floors:2,wall:'#efe8e4',roof:'hip',roofColor:T,setback:2,front:{h:1.8,c:'#b8ac9c',rail:{h:.9,c:W,style:'bars'}},
    open:[{t:'window',x:-1,w:1.2,fl:1},{t:'window',x:2,w:1.2,fl:1}],panels:[{x:-2.6,w:.6,c:'#a8503a'}]}),
  // brick-faced porch house behind grey railings, a white gate
  L('S',258,266,{wall:'#c0683f',roof:'hip',roofColor:T,plinth:{h:.9,c:'#a8a294',stone:true},
    open:[{t:'gate',x:3,w:2,c:W},{t:'window',x:-.4,w:1.6,grille:true},{t:'window',x:-3,w:1.4,shutters:'#6a6a6a'}]}),
  // block wall with a grey gate, a white sheet fence
  muro('S',266,274,'#b8b4aa',2.2,{front:{h:2.2,c:'#e6e6e2',gates:[{t:'gate',x:2.6,w:1.4,c:'#a8b0b6'}]},behind:{w:6,d:8,at:3,roofColor:T,wall:'#ece8e2'}}),
  // nº 401: white house, grey diagonal-barred gate, grilled windows
  L('S',274,283,{wall:'#ece8e2',roof:'hip',roofColor:T,open:[{t:'gate',x:2.4,w:2.8,c:'#7a7c80'},{t:'window',x:-1,w:2,grille:true},{t:'window',x:-3.4,w:1.4,grille:true}]}),
  // white-and-grey house: a white barred carport, green-glass windows
  L('S',283,291.5,{wall:'#ece8e2',roof:'gable',roofColor:T,fascia:'#8a3a2a',eave:.8,
    open:[{t:'gate',x:1.6,w:4,c:W},{t:'glass',x:-2.6,w:2,frame:'#3a8a6a'}]}),
  // the yellow wall with clay coping round yellow houses, a black barred gate
  muro('S',291.5,300,'#e2c06a',2,{behind:{w:7,d:8,at:3,roofColor:T,wall:'#e2c06a'}}),
  muro('S',300,308,'#e2c06a',2,{front:{h:2,c:'#e2c06a',gates:[{t:'gate',x:-.6,w:1,c:'#1c1c1e'}]},behind:{w:7,d:8,at:3,roofColor:T,wall:'#e8c87a'}}),
  // --- Treze de Maio → Romeu Zanetti
  // Adubos Real: white on a green base
  L('S',328.5,344,{wall:'#f2f2f0',roof:'flat',parapet:true,plinth:{h:1.2,c:'#2a9a4a'},
    open:[{t:'window',x:4,w:1.6,grille:true},{t:'garage',x:-.6,w:3.6,c:W,awning:'#2a9a4a'},{t:'window',x:-4,w:1.4,grille:true}],
    sign:{text:'ADUBOS REAL',bg:'#f2f2f0',fg:'#2a8a4a',x:0,y:3,w:5,h:.8}}),
  // dark grey roughcast house, grey corrugated gates
  L('S',344,360,{wall:'#6a6e6a',roof:'hip',roofColor:T,plinth:{h:.5,c:'#5a5c5a'},
    open:[{t:'garage',x:5.4,w:3.4,c:'#8f9aa4'},{t:'window',x:1.6,w:1.4,frame:W},{t:'window',x:-1.4,w:1.4,frame:W},{t:'garage',x:-5,w:3.4,c:'#8f9aa4'}]}),
  // a white building with a roll door
  L('S',360,366.5,{wall:'#ece9e2',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:3,c:'#d8d8d6'}]}),
  // --- Romeu Zanetti → XV de Novembro
  // pink-tiled corner sobrado with doctors' offices
  L('S',394.4,410,{floors:2,wall:'#e8b4a8',roof:'flat',parapet:true,
    open:[{t:'door',x:4,w:1.1,c:'#e8b4a8'},{t:'door',x:2,w:1.2,c:'#3a3a3a'},{t:'window',x:-1.6,w:2.6},{t:'window',x:-1,w:3,fl:1},{t:'window',x:4,w:1.4,fl:1}],
    balcony:{x:0,w:15,fl:1,rail:'white'}}),
  // grey houses on granite bases: white shutters, garages, a clay-tiled lattice gable
  L('S',410,418,{wall:'#c9cac8',roof:'gable',roofColor:T,plinth:{h:1.4,c:'#7a7a78',stone:true},
    open:[{t:'window',x:2,w:1.8,shutters:W,frame:W},{t:'garage',x:-1.6,w:2.4,c:'#e8e8e6',awning:W}]}),
  L('S',418,425,{wall:'#c9cac8',roof:'hip',roofColor:T,plinth:{h:1.4,c:'#7a7a78',stone:true},
    open:[{t:'gate',x:2,w:2,c:W},{t:'window',x:-.6,w:1,grille:true},{t:'window',x:-2.4,w:1.4,shutters:W}]}),
  // the car park's grey sheet gate
  muro('S',425,432,'#8f9094',2.4,{front:{h:2.4,c:'#8f9094',gates:[{t:'gate',x:0,w:5,c:'#a8aeb2'}]}}),
  // --- Sete de Setembro → José Augusto Machado
  // the grey sobrado of the Renove clinic: white louvres, black railings, cypresses
  L('S',547.5,570,{floors:2,wall:'#a8aaae',roof:'flat',parapet:true,setback:2,front:{h:.6,c:'#c8c6c0',rail:{h:1,c:'#2a2a2a',style:'bars'}},
    open:[{t:'window',x:-6,w:2.2,shutters:W},{t:'window',x:-2,w:2.2,shutters:W},{t:'garage',x:2.6,w:2.4,c:W},{t:'window',x:7,w:2.2,shutters:W},
      {t:'window',x:-4,w:2.4,fl:1,shutters:W},{t:'window',x:4,w:2.4,fl:1,shutters:W}],balcony:{x:0,w:20,fl:1,rail:'iron'},
    sign:{text:'RENOVE',bg:'#2a2a2c',fg:'#ffffff',x:-6,y:3.4,w:1.6,h:.6}}),
  // grey wall with a grey sheet gate and a white garage door
  L('S',570,580,{wall:'#a8aaae',roof:'flat',parapet:true,open:[{t:'gate',x:3,w:2.6,c:'#8f9aa4'},{t:'garage',x:-1.4,w:2.8,c:W}]}),
  // whitewashed wall of an empty lot; old white houses with porches behind iron railings
  muro('S',580,586,'#ece8e0',2),
  L('S',586,596,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:'#e6e2da',rail:{h:1.2,c:'#6a6c70',style:'bars'}},
    open:[{t:'open',x:0,w:3.6,h:2.3,c:'casa'},{t:'window',x:-3.4,w:1.2,shutters:'#a8aeb2'}]}),
  L('S',596,602,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:'#c97a5a',rail:{h:1.2,c:'#8f9094',style:'bars'}},
    open:[{t:'window',x:0,w:1.8,shutters:'#7a8a9a'}]}),
  // --- José Augusto Machado → São Vicente de Paula (the pink corner house: jose-augusto-machado.ts)
  // beige house behind a stone-clad wall with a lattice fence
  L('S',622,630,{wall:'#d8c4b0',roof:'flat',fascia:W,eave:.6,setback:2.5,front:{h:1.2,c:'#b8a284',style:'stone',rail:{h:.8,c:'#e8e4dc',style:'lattice'}},
    panels:[{x:-3.4,w:1.2,stone:true}],open:[{t:'window',x:-.6,w:1.6,shutters:'#ece6d6',frame:W},{t:'window',x:2.4,w:1.4,frame:W}]}),
  L('S',630,636,{wall:'#d8c4b0',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:2.8,c:'#ece6d6'}]}),
  // a wall clad in brick tiles with a dark brown gate, beige houses behind
  muro('S',636,644,'#c9895a',2.4,{front:{h:2.4,c:'#c9895a',gates:[{t:'gate',x:1,w:3,c:'#3a2a24'}]},behind:{w:6,d:8,at:3,roofColor:T,wall:'#d8c4b0'}}),
  L('S',644,651,{wall:'#d8d0c4',roof:'gable',roofColor:T,setback:2,front:{h:2,c:'#c9b8a4',gates:[{t:'door',x:0,w:1,c:'#3a2a24'}]},
    open:[{t:'window',x:-1.6,w:1.4,shutters:'#3a3a3a'}]}),
  // a ruined old house
  muro('S',651,659,'#c9b48a',2.6,{behind:{w:6,d:7,at:2,roof:'flat',roofColor:'#8a5a46',wall:'#d8c49a'}}),
  // a blue mosaic sobrado on a stone base, the cream sobrado on a red base to the corner
  L('S',659,665,{floors:2,wall:'#3f6ab0',upper:'#b9d8a8',roof:'flat',parapet:true,plinth:{h:.9,stone:true},
    open:[{t:'window',x:-1,w:1,frame:W},{t:'window',x:1,w:1,frame:W},{t:'window',x:0,w:2,fl:1,shutters:'#2f5fa8'}]}),
  L('S',665,678,{floors:2,wall:'#ece4d6',roof:'flat',parapet:true,plinth:{h:1,c:'#9a3a2e'},
    open:[{t:'window',x:-2,w:1.6,grille:true},{t:'window',x:2,w:1.6,grille:true},{t:'window',x:0,w:2,fl:1,grille:true}],balcony:{x:0,w:3,fl:1,rail:'white'}}),
];

export const TREES:Tree[]=[
  {side:'N',s:196,kind:'resedaBranca'},{side:'N',s:276,kind:'ficus'},{side:'S',s:218,kind:'reseda'},{side:'S',s:384,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  settStreets:['Rua Treze de Maio','Rua Romeu Zanetti','Rua XV de Novembro','Rua Sete de Setembro','Rua José Augusto Machado'],
  poles:{side:'N',start:14,every:34,transformers:[120,300]},
  keepOut:[
    {side:'S',s0:23,s1:58.5,why:'the warehouse of the diesel workshop (galpoes.ts)'},
    {side:'S',s0:455.9,s1:543.6,why:'the Matriz squares (praca-ladislau.ts, praca-alcindo.ts)',walk:false},
    {side:'S',s0:606.1,s1:622,why:'the pink corner house (casa-rosa-esquina.ts, ruas/extras.ts)'},
  ],
};
