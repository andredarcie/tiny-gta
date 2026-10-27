// Rua Leonor Mendes de Barros — surveyed lot by lot from Google Street View (2024–2026 imagery;
// one view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/lmb-N-*/ and lmb-S-*/, kept out of git). It leaves
// the Sete de Setembro between the two Matriz squares and runs south up the hill; `s` starts
// at the NORTH end, so side 'N' is the EAST side (left of a walker going south) and 'S' the
// WEST side. Surveyed to s 401 on the west side (the Mato Grosso crosses it twice at s 305–317); beyond it the street winds
// round a wooded block behind precast walls.
//   s=60 R. José Augusto Machado   s=139 R. São Vicente de Paula
//   s=229 R. Dom Alberto J. Gonçalves   s=305 R. Mato Grosso
// Granite setts. Left alone: Chiquinho Tintas on the Dom Alberto corner (comercio/lojas.ts).
// Opening x is measured from the lot centre as SEEN FROM THE STREET (left negative): on the
// east side (N) left is NORTH (lower s), on the west side (S) left is SOUTH (higher s).
// Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Leonor Mendes de Barros';
export const CROSS=[0,60,139.1,229,305.4,317.4,429.7,541.6,555.2,566.7];
const SURFACE:Surface[]=[[0,566.7,'sett']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= EAST SIDE (N) =================
  // --- Sete de Setembro → José Augusto Machado
  // the mossy roughcast wall of an old pink house, a wooden door, a tiled gate porch
  muro('N',5,14,'#8a8a5a',2.4,{front:{h:2.4,c:'#8a8a5a',gates:[{t:'door',x:3.4,w:1.2,c:'#6a3a2a'}]},behind:{w:8,d:9,at:3,roofColor:T,wall:'#e8c4c0'}}),
  muro('N',14,24,'#8a8a5a',2.4,{front:{h:2.4,c:'#8a8a5a',gates:[{t:'door',x:-4,w:1,c:'#3a3a3a',awning:T}]},behind:{w:9,d:9,at:3,roofColor:T,wall:'#e8c4c0'}}),
  // pink wall with a breeze-block panel, white garage gates
  L('N',24,30,{wall:'#e8c4c0',roof:'hip',roofColor:T,setback:2,front:{h:2.4,c:'#e8c4c0',gates:[{t:'garage',x:-1,w:2.6,c:W},{t:'door',x:1.6,w:1,c:W}]}}),
  // a whitewashed arched gateway with a wooden door
  muro('N',30,36,'#ece8e0',2.6,{front:{h:2.6,c:'#ece8e0',gates:[{t:'gate',x:0,w:1.6,c:'#6a4a32'}]},behind:{w:5,d:8,at:2,roofColor:T,wall:'#e8c4c0'}}),
  // pale blue house: grilled windows, a shop under a blue awning behind a folding gate
  L('N',36,44,{wall:'#c8d8e8',roof:'hip',roofColor:T,plinth:{h:.8,c:'#b8a888'},open:[{t:'window',x:-1.6,w:1.8,shutters:'#8a94a0'},{t:'window',x:1.6,w:1.8,grille:true}]}),
  L('N',44,50,{wall:'#c8d8e8',roof:'hip',roofColor:T,open:[{t:'gate',x:0,w:3.6,c:'#2a4a9a',awning:'#2a4ab0'}]}),
  // a wooden fence behind a hedge, palms over it
  muro('N',50,56,'#7a5a40',2.2),
  // --- José Augusto Machado → São Vicente de Paula
  // grey corner house raised on a granite base, a porch at the top of its steps
  L('N',64,76,{wall:'#b9b8b2',roof:'hip',roofColor:T,plinth:{h:1.6,c:'#a8a6a8',stone:true},
    open:[{t:'open',x:-3,w:3.4,h:2.2,y:1.6,c:'casa'},{t:'window',x:1,w:1.4,y:2.4,shutters:'#8a94a0'},{t:'window',x:4,w:1.2,y:2.4,shutters:'#8a94a0'}]}),
  // grey house over a white band, a dark brown gate
  L('N',76,82,{wall:'#b9b8b2',roof:'hip',roofColor:T,plinth:{h:.9,c:'#e8e6e2'},open:[{t:'window',x:-1.6,w:1.4,shutters:'#a8b0b8'},{t:'gate',x:1.6,w:1.8,c:'#5a3a2a'}]}),
  // old beige houses behind a block wall, a porch, a blue gate
  L('N',82,90,{wall:'#e6d0a8',roof:'hip',roofColor:T,setback:2.5,front:{h:1.4,c:'#d8c09a'},open:[{t:'open',x:0,w:2,h:2.2,c:'casa'},{t:'window',x:-2.4,w:1,grille:true}]}),
  L('N',90,98,{wall:'#e6d0a8',roof:'hip',roofColor:T,setback:2,front:{h:.3,c:'#d8c09a',rail:{h:1.4,c:'#2a5ab0',style:'bars'},gates:[{t:'gate',x:0,w:3.4,c:'#2a5ab0'}]},
    open:[{t:'window',x:-2.4,w:1.2,shutters:W}]}),
  muro('N',98,103,'#d8c09a',1.8,{behind:{w:5,d:8,at:3,roofColor:T,wall:'#e6d0a8'}}),
  // modern beige house: white grille garage, a glass porch, cypresses
  L('N',103,117,{wall:'#e6dccb',roof:'gable',roofColor:T,fascia:W,eave:.7,setback:1,
    open:[{t:'garage',x:-3,w:4.4,c:W},{t:'door',x:1,w:1,c:W},{t:'window',x:4,w:1.6,shutters:W}]}),
  // pink house on a granite band, a pillared porch
  L('N',117,125,{wall:'#ecd8dc',roof:'gable',roofColor:T,fascia:W,plinth:{h:1,c:'#a8a6a0',stone:true},open:[{t:'open',x:-1,w:3,h:2.3,c:'casa'},{t:'door',x:2.4,w:.9,c:W}]}),
  // peach corner sobrado, white balcony railings, a white fence round the yard
  L('N',125,135.1,{floors:2,wall:'#ecd4b8',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:'#e8e4dc',rail:{h:1,c:W,style:'bars'}},
    open:[{t:'glass',x:-2,w:2.6,frame:'#3a3a3a'},{t:'window',x:-2,w:1.4,fl:1,grille:true}],balcony:{x:0,w:9,fl:1,rail:'white'}}),
  // --- São Vicente de Paula → Dom Alberto J. Gonçalves
  // the long old roughcast wall of a wooded yard
  muro('N',143,153,'#a8957a',2.4),
  muro('N',153,162,'#a8957a',2.4),
  // cream house over a maroon band behind an iron fence
  L('N',162,176,{wall:'#ecdcaa',roof:'gable',roofColor:'#5a4a40',fascia:'#5a4a40',setback:3,plinth:{h:.5,c:'#7a2a24'},
    front:{h:.8,c:'#7a2a24',rail:{h:1.1,c:'#5a3a2a',style:'bars'}},open:[{t:'window',x:-3,w:1.8,shutters:'#7a2a24'},{t:'open',x:1,w:2,h:2.3,c:'casa'}]}),
  // nº 189: pink and white over a stone-clad base, wide glass windows
  L('N',176,186,{wall:'#ecd8dc',roof:'gable',roofColor:T,fascia:'#7a4a2e',plinth:{h:1,c:'#b8a284',stone:true},
    open:[{t:'glass',x:-2.4,w:2.8,frame:'#8a8a8a'},{t:'glass',x:1.6,w:2.8,frame:'#8a8a8a'},{t:'gate',x:4.4,w:.9,c:W}]}),
  // white house: a white grille garage under clay tiles, a brick porch
  L('N',186,195,{wall:'#f2ece4',roof:'gable',roofColor:T,plinth:{h:.4,stone:true},open:[{t:'gate',x:-2,w:3,c:W,awning:T},{t:'open',x:2.4,w:2.6,h:2.3,c:'casa'}]}),
  // beige house with a pillared carport
  L('N',195,204,{wall:'#ecd8b0',roof:'hip',roofColor:T,setback:3,front:{h:.4,c:'#d8c09a',rail:{h:.8,c:W,style:'bars'}},open:[{t:'open',x:-1,w:4,h:2.3,c:'casa'},{t:'window',x:2.6,w:1.6,shutters:W}]}),
  // modern beige house, a white garage door
  L('N',204,212,{wall:'#ecdcb8',roof:'flat',parapet:true,setback:1,open:[{t:'garage',x:-1,w:3,c:W},{t:'glass',x:2.4,w:1.4}]}),
  // beige house behind a white fence; exposed-brick corner house with white arches
  L('N',212,218,{wall:'#ecd8b0',roof:'gable',roofColor:T,setback:3,front:{h:.4,c:'#e8e4dc',rail:{h:1.1,c:W,style:'bars'}},open:[{t:'window',x:0,w:1.2,grille:true}]}),
  L('N',218,224.6,{wall:'#b5683f',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:.9,c:'#b5683f',rail:{h:.4,c:W,style:'bars'}},
    open:[{t:'arch',x:-1.4,w:2.2,h:2.2,y:0},{t:'arch',x:1.6,w:2.2,h:2.2,y:0}]}),
  // --- Dom Alberto J. Gonçalves → Mato Grosso (Chiquinho Tintas on the corner)
  // white sobrado: arched balcony over the garage, white fence
  L('N',250,258,{floors:2,wall:'#f2f0ea',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:'#e8e4dc',rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'open',x:-1,w:4,h:2.4,c:'casa'},{t:'arch',x:-1.8,w:1.6,fl:1},{t:'arch',x:1.6,w:1.6,fl:1}],balcony:{x:0,w:7,fl:1,rail:'white'}}),
  // nº 255: white arched porch behind a white fence
  L('N',258,268,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:'#e8e4dc',rail:{h:1.2,c:W,style:'bars'}},
    open:[{t:'arch',x:-2.6,w:2.4,h:2.3,y:0},{t:'arch',x:0,w:2.4,h:2.3,y:0},{t:'arch',x:2.6,w:2.4,h:2.3,y:0}]}),
  // nº 275: grey-green garage with brown bars under a tiled roof
  L('N',268,276,{floors:2,wall:'#b8c4b8',roof:'hip',roofColor:T,setback:2,front:{h:2,c:'#c8d0c8',gates:[{t:'gate',x:0,w:5,c:'#5a3a2a'}]},open:[{t:'window',x:0,w:2,fl:1,shutters:'#7a4a2e'}]}),
  // ELO: a modern office behind a white fence, the stone panel with its name
  L('N',276,292,{wall:'#ece8e2',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#e8e4dc',rail:{h:1.2,c:W,style:'bars'}},panels:[{x:4,w:3,stone:true}],
    open:[{t:'glass',x:-2,w:4,y:0,h:2.4,frame:'#3a3a3a'}],sign:{text:'ELO',bg:'#d8c8a8',fg:'#f2f2ee',x:4,y:1.6,w:2.4,h:1.2}}),

  // ================= WEST SIDE (S) =================
  // --- Sete de Setembro → José Augusto Machado
  // a white wall over a grey granite base with stepped piers, a covered court behind it
  muro('S',5,16,'#ece8e0',2.2,{front:{h:2.2,c:'#6a6c70',style:'stone'},behind:{w:9,d:9,at:2,floors:2,roof:'flat',roofColor:'#9a958c',wall:'#ece8e0'}}),
  muro('S',16,28,'#ece8e0',2.2,{front:{h:2.2,c:'#6a6c70',style:'stone',gates:[{t:'gate',x:3,w:1.2,c:'#6a6c70'}]},behind:{w:10,d:9,at:2,roofColor:T,wall:'#d8d6d0'}}),
  muro('S',28,40,'#ece8e0',2.2,{front:{h:2.2,c:'#6a6c70',style:'stone'},behind:{w:10,d:9,at:2,roofColor:T,wall:'#d8d6d0'}}),
  muro('S',40,48,'#ece8e0',2.2,{front:{h:2.2,c:'#6a6c70',style:'stone',gates:[{t:'gate',x:0,w:3.6,c:'#8f9aa4'}]}}),
  muro('S',48,56,'#ece8e0',2.2,{front:{h:2.2,c:'#6a6c70',style:'stone'}}),
  // --- José Augusto Machado → São Vicente de Paula
  // old yellow corner house with green trim on a green base
  L('S',64,72,{wall:'#e8d498',roof:'hip',roofColor:T,plinth:{h:.6,c:'#3a7a5a'},open:[{t:'door',x:-2,w:1.1,c:'#5a3a2a',frame:'#3a7a5a'},{t:'window',x:1.4,w:1.8,grille:true,frame:'#3a7a5a'}]}),
  // pink house behind railings; a yellow house with a carport
  L('S',72,77,{wall:'#ecc8b8',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#c9c4bc',rail:{h:.8,c:'#5a5c60',style:'bars'}},open:[{t:'window',x:0,w:1.6,grille:true}]}),
  L('S',77,84,{wall:'#e8d498',roof:'hip',roofColor:T,open:[{t:'open',x:0,w:4,h:2.3,c:'casa'}]}),
  // peach house: a porch, a brown door, a grilled window, a blue gate
  L('S',84,92,{wall:'#f2c8a8',roof:'gable',roofColor:'#6a4a3a',fascia:'#6a4a3a',setback:2,front:{h:.6,c:'#c97a5a',rail:{h:1,c:'#5a5c60',style:'bars'},gates:[{t:'gate',x:3,w:3,c:'#4a6a8a'}]},
    open:[{t:'door',x:0,w:1,c:'#b8743a'},{t:'window',x:-2.4,w:1.8,grille:true}]}),
  // white house behind a stone wall, a carport
  L('S',92,100,{wall:'#f2f0ea',roof:'flat',fascia:W,eave:.8,setback:2,front:{h:1.2,c:'#b8a284',style:'stone'},open:[{t:'open',x:2,w:3,h:2.3,c:'casa'},{t:'window',x:-1.6,w:2,frame:'#3a3a3a'}]}),
  // the education offices: white two-storey on a blue base, pillared porches, ramps
  L('S',100,116,{floors:2,wall:'#f2f2f0',roof:'flat',parapet:true,plinth:{h:1,c:'#2a4ab0'},setback:1,
    open:[{t:'open',x:-4,w:4,h:2.6,c:'casa'},{t:'glass',x:3,w:2,frame:'#3a3a3a'},{t:'window',x:-4,w:1.6,fl:1,grille:true},{t:'window',x:2,w:1.6,fl:1,grille:true}]}),
  L('S',116,124,{floors:2,wall:'#f2f2f0',roof:'flat',parapet:true,plinth:{h:1,c:'#2a4ab0'},open:[{t:'open',x:0,w:3,h:2.6,c:'casa'},{t:'window',x:0,w:2,fl:1,grille:true}]}),
  L('S',124,135.1,{wall:'#f2f2f0',roof:'hip',roofColor:T,plinth:{h:.8,c:'#2a4ab0'},
    open:[{t:'door',x:2,w:1.4,c:'#3a3a3a'},{t:'window',x:-1,w:1.6,grille:true},{t:'window',x:-4,w:1.4,grille:true}],
    sign:{text:'EDUCAÇÃO',bg:'#f2f2f0',fg:'#2a4ab0',x:2,y:2.5,w:1.6,h:.4}}),
  // --- São Vicente de Paula → Dom Alberto J. Gonçalves
  // a grey sheet gate and a block wall round an empty corner lot
  muro('S',143,152,'#b8b4aa',2,{front:{h:2,c:'#b8b4aa',gates:[{t:'gate',x:2,w:3.6,c:'#9aa8b8'}]}}),
  // white house and a peach wall with a wooden gate
  L('S',152,162,{wall:'#f2f0ea',roof:'gable',roofColor:'#5a5a58',fascia:'#5a5a58',setback:3,front:{h:1.8,c:'#ecc8a8',gates:[{t:'gate',x:2.4,w:1.2,c:'#8a5a3a'}]},
    open:[{t:'open',x:3,w:1.6,h:2.2,c:'casa',awning:'#8a8a86'}]}),
  // stone-clad sobrado up its steps, a white house with a maroon door
  L('S',162,169,{floors:2,wall:'#ecdcc0',roof:'hip',roofColor:T,plinth:{h:2.4,c:'#a88a64',stone:true},open:[{t:'window',x:0,w:1.6,fl:1,shutters:W}],balcony:{x:0,w:5,fl:1,rail:'white'}}),
  L('S',169,177,{wall:'#f2f0ea',roof:'gable',roofColor:T,open:[{t:'door',x:0,w:1,c:'#7a2a24'},{t:'window',x:-2.4,w:1.4,frame:'#3a3a3a',awning:'#8a8a86'}]}),
  // pink houses: white bars, a red-flowered flamboyant, a white geometric garage gate
  L('S',177,187,{wall:'#eab4c0',roof:'gable',roofColor:T,fascia:W,setback:3,front:{h:1,c:'#eab4c0',rail:{h:1,c:W,style:'bars'}},open:[{t:'window',x:0,w:1.8,frame:W}]}),
  L('S',187,196,{wall:'#eab4c0',roof:'hip',roofColor:T,open:[{t:'gate',x:2,w:3.6,c:W},{t:'window',x:-1.6,w:1.2,frame:'#3a3a3a'}]}),
  // modern beige house: black-and-white line gate, stone steps, palms
  L('S',196,212,{wall:'#ecdcc8',roof:'hip',roofColor:T,setback:2,front:{h:2.2,c:'#ecdcc8',gates:[{t:'garage',x:-2,w:3.6,c:W},{t:'door',x:1,w:1,c:W}]}}),
  // old yellow house going through repairs; the yellow corner house with a stone pier
  L('S',212,219,{wall:'#e8c870',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#b8a888'},open:[{t:'window',x:-1,w:1.6,shutters:'#6a4a3a'},{t:'open',x:2,w:1.6,h:2.2,c:'casa'}]}),
  L('S',219,225.4,{wall:'#e8c870',roof:'hip',roofColor:T,panels:[{x:0,w:.8,stone:true}],open:[{t:'window',x:-1.6,w:1.4,shutters:'#6a4a3a'},{t:'arch',x:2,w:1.2,h:2,y:0}]}),
  // --- Dom Alberto J. Gonçalves → Mato Grosso
  // white corner house with a pillared veranda behind a white iron fence
  L('S',233,242,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:'#e6e2da',rail:{h:1.2,c:W,style:'bars'}},open:[{t:'open',x:0,w:6,h:2.3,c:'casa'}]}),
  // white houses behind white pickets, a stone wall
  L('S',242,250,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#e8e4dc',rail:{h:1.2,c:W,style:'bars'}},open:[{t:'open',x:-1,w:3,h:2.3,c:'casa'},{t:'window',x:2,w:1.4,grille:true}]}),
  L('S',250,258,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:3,front:{h:1.4,c:'#8a7a64',style:'stone',rail:{h:.6,c:'#5a5c60',style:'bars'}},open:[{t:'window',x:0,w:2,shutters:W}]}),
  // the Kingdom Hall: red, white windows, behind a white chain-link fence on a lawn
  L('S',258,268,{wall:'#b84a3a',roof:'gable',roofColor:T,fascia:W,setback:5,front:{h:.4,c:'#e8e4dc',rail:{h:1.6,c:W,style:'lattice'},gates:[{t:'gate',x:0,w:3,c:W}]},
    open:[{t:'window',x:-2.4,w:1.2,frame:W},{t:'window',x:0,w:1.2,frame:W},{t:'window',x:2.4,w:1.2,frame:W}],
    sign:{text:'SALÃO DO REINO DAS TESTEMUNHAS DE JEOVÁ',bg:'#b84a3a',fg:'#ffffff',x:0,y:2.7,w:4.4,h:.5}}),
  // white house behind a stone-panelled wall and grey railings
  L('S',268,276,{wall:'#f2f0ea',roof:'gable',roofColor:T,setback:3,front:{h:1,c:'#e8e4dc',rail:{h:1,c:'#8f9094',style:'bars'}},panels:[{x:3,w:2,stone:true}],
    open:[{t:'window',x:-2,w:1.8,shutters:W},{t:'window',x:1,w:1.4,grille:true}]}),
  // nº 276: a white garage gate and a stone-clad wall
  L('S',276,284,{wall:'#f2f0ea',roof:'hip',roofColor:T,front:{h:.2,c:'#f2f0ea'},panels:[{x:-2,w:3,stone:true}],open:[{t:'garage',x:2,w:3,c:W}]}),
  // sobrado with dark glass balconies and brown diagonal garage doors
  L('S',284,296,{floors:2,wall:'#ece8e2',roof:'flat',parapet:true,panels:[{x:3,w:3,stone:true,y0:2.9,y1:5.8}],
    open:[{t:'garage',x:-2.4,w:4,c:'#4a3024'},{t:'garage',x:3,w:3.4,c:'#4a3024'},{t:'window',x:-2,w:4,fl:1,frame:'#3a3a3a'}],balcony:{x:-1,w:8,fl:1,rail:'glass'}}),
  // --- Mato Grosso → the bend (west side; the east side is the wall of the E.E. Dep. Eduardo
  // Vicente Nasser, publicos.ts, then the wooded block behind its precast wall)
  // beige gable cottage with an arched porch, grey shutters, behind an iron fence on a stone base
  L('S',296,304,{wall:'#ecd8bc',roof:'gable',roofColor:T,fascia:W,setback:3,front:{h:.6,c:'#b8a284',style:'stone',rail:{h:1.2,c:'#6a6c70',style:'bars'}},
    open:[{t:'arch',x:1.4,w:1.6,h:2.2,y:0},{t:'window',x:-1.6,w:1.4,shutters:'#7a8a9a'}]}),
  // nº 320: purple-and-grey house, a lime-green garage door
  L('S',321,328,{wall:'#8a94a0',roof:'hip',roofColor:T,panels:[{x:2,w:3.4,c:'#5a3a9a'}],open:[{t:'window',x:-2,w:1.8,grille:true},{t:'garage',x:2,w:2.4,c:'#a8c83a'}]}),
  // cream houses with carports behind low walls and iron gates
  L('S',328,338,{wall:'#ece4d0',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#ece4d0',rail:{h:.6,c:'#3a3a3a',style:'bars'}},open:[{t:'open',x:-1,w:4,h:2.3,c:'casa'},{t:'window',x:3,w:1.2,shutters:'#6a3a2a'}]}),
  L('S',338,346,{wall:'#ece4d0',roof:'hip',roofColor:T,setback:2,front:{h:1,c:'#ece4d0',gates:[{t:'gate',x:1,w:2.6,c:'#3a2a24'}]},open:[{t:'open',x:0,w:4,h:2.3,c:'casa'}]}),
  // grey roughcast house with a grey sheet garage door
  L('S',346,354,{wall:'#9a9c9e',roof:'flat',parapet:true,open:[{t:'garage',x:-1,w:3,c:'#c8cacc'},{t:'window',x:2.6,w:1.2,frame:W}]}),
  // modern grey houses: white roll doors, louvred white gates, slit windows above
  L('S',354,362,{wall:'#9a9c9e',roof:'flat',parapet:true,open:[{t:'garage',x:-2,w:2.6,c:'#f2f2f0'},{t:'door',x:2,w:1,c:W}]}),
  L('S',362,370,{floors:2,wall:'#8e9094',roof:'flat',parapet:true,open:[{t:'garage',x:-1.6,w:3.4,c:'#f2f2f0'},{t:'garage',x:2.4,w:2,c:'#f2f2f0'}]}),
  L('S',370,378,{floors:2,wall:'#8e9094',roof:'flat',parapet:true,open:[{t:'gate',x:0,w:4.4,c:'#f2f2f0'},{t:'window',x:0,w:.3,h:1.6,fl:1},{t:'window',x:1,w:.3,h:1.6,fl:1}]}),
  // a grey house behind a white picket fence, a pindó palm
  L('S',378,386,{wall:'#a8acb0',roof:'hip',roofColor:T,setback:3,front:{h:.3,c:W,rail:{h:1.2,c:W,style:'bars'}},open:[{t:'window',x:-1.6,w:2.2,shutters:W},{t:'window',x:2,w:1.6}]}),
  // the sobrado with pink balusters and a brown sheet garage under a gable
  L('S',386,394,{floors:2,wall:'#ece8e2',roof:'gable',roofColor:T,open:[{t:'garage',x:0,w:4,c:'#4a3024'}],balcony:{x:0,w:6,fl:1,rail:'white'}}),
  L('S',394,401,{floors:2,wall:'#ece8e2',roof:'flat',parapet:true,setback:2,front:{h:1,c:'#c8a49a',rail:{h:.1,c:W,style:'bars'}},
    open:[{t:'door',x:-1,w:1,c:'#4a3024'},{t:'window',x:2,w:2.4,frame:'#2a2a2a'},{t:'window',x:0,w:2.4,fl:1,frame:'#2a2a2a'}],balcony:{x:0,w:10,fl:1,rail:'white'}}),
];

export const TREES:Tree[]=[
  {side:'N',s:56,kind:'palmeira'},{side:'N',s:150,kind:'ficus'},{side:'S',s:180,kind:'reseda'},{side:'S',s:194,kind:'reseda'},
  {side:'S',s:200,kind:'palmeira'},{side:'S',s:208,kind:'palmeira'},{side:'S',s:262,kind:'palmeira'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  settStreets:['Rua José Augusto Machado','Rua São Vicente de Paula','Rua Dom Alberto J. Gonçalves'],
  poles:{side:'S',start:12,every:34,transformers:[100,240]},
  keepOut:[{side:'N',s0:229,s1:250,why:'Chiquinho Tintas (comercio/lojas.ts)'}],
};
