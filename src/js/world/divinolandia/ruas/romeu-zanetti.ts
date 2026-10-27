// Rua Romeu Zanetti — surveyed lot by lot from Google Street View (2024–2026 imagery; one view
// aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/rz-N-*/ and rz-S-*/, kept out of git). The
// shopping street one block north of the XV: 819 m west→east from the Rua São José to the
// Lourival Medeiros, granite setts all along.
//   s=122 R. João Cabrera   s=245 R. Barão do Rio Branco   s=322 R. Espírito Santo
//   s=424 R. Francisco Pereira de Souza   s=522 R. Joaquim Garcia   s=621 R. Campos Salles
//   s=721 R. Bernadino Franchi
// Left alone (their own models): the 20 businesses of comercio/lojas.ts on it (Ideal and
// São José supermarkets, Peg Pag, Formiga, Bradesco, Sicoob, Lunayma, Opção, Crystal…), the
// second Posto Taurus (posto-taurus-centro.ts), the Auto Posto Triângulo at the east end,
// the Câmara Municipal's covered car park (galpoes.ts). Opening x is measured from the lot
// centre as SEEN FROM THE STREET (left negative: on the N side left is west = lower s, on
// the S side left is east = higher s). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Romeu Zanetti';
export const CROSS=[0,122.5,245,321.8,424.1,522.2,620.9,721.4,818.7];
const SURFACE:Surface[]=[[0,818.7,'sett']];
const T='#b0603f',TD='#8e4632',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE =================
  // --- São José → João Cabrera
  // tan wall with clay coping, a red sheet gate, the house behind (a frangipani over it)
  muro('N',8,20,'#d9b98e',2,{front:{h:2,c:'#d9b98e',gates:[{t:'gate',x:3.4,w:2.6,c:'#a8443a'}]},behind:{w:9,d:8,at:3,roofColor:T,wall:'#e8d6bc'}}),
  // white barred garage gate, the stone-clad stair wall
  muro('N',20,30.5,'#e8e4dc',2.2,{front:{h:2.2,c:'#e8e4dc',gates:[{t:'gate',x:-2,w:3.6,c:'#e8e8e6'},{t:'gate',x:1.6,w:1.2,c:'#e8e8e6'}]},
    panels:[{x:3.6,w:2.4,stone:true}],behind:{w:7,d:8,at:3,floors:2,roof:'flat',roofColor:'#9a958c',wall:'#cdb9a0'}}),
  // old pink house on a green base ("VENDE"), a recessed doorway
  L('N',30.5,42.3,{wall:'#efd2d0',roof:'hip',roofColor:T,plinth:{h:.5,c:'#3f7a4a'},
    open:[{t:'window',x:-3.6,w:1.6,grille:true,frame:'#7a8a8e'},{t:'open',x:0,w:2,h:2.2,c:'casa'},{t:'window',x:3.8,w:1.4,grille:true,frame:'#7a8a8e'}]}),
  L('N',42.3,47,{wall:'#efcfcc',roof:'hip',roofColor:T,open:[{t:'window',x:-1,w:1.4,grille:true},{t:'gate',x:1.4,w:1.2,c:'#a8443a'}]}),
  // lilac house under a white gable, white barred door and sheet gate
  L('N',47,56,{wall:'#e9dbe4',roof:'gable',roofColor:T,fascia:W,eave:.7,
    open:[{t:'door',x:-3.2,w:1,c:'#f2f2f0'},{t:'window',x:-.6,w:1.6,grille:true,frame:'#e2c9a0'},{t:'gate',x:2.8,w:2.6,c:'#f2f2f0'}]}),
  // light grey house with a box eave: grilled windows, a barred garage, a white sheet gate
  L('N',56,70,{wall:'#d6dadb',roof:'flat',fascia:'#e2e4e4',eave:.6,
    open:[{t:'window',x:-5,w:1.2,grille:true},{t:'window',x:-2.6,w:1.8,grille:true},{t:'gate',x:1.4,w:3.8,c:'#e8e8e6'},{t:'gate',x:5.2,w:2.2,c:'#f2f2f0'}]}),
  // precast concrete wall, an old pink house behind it
  muro('N',70,84,'#b8b4aa',2,{behind:{w:8,d:8,at:3,roofColor:T,wall:'#efd6cf'}}),
  // pink house with two white barred gates
  L('N',84,92,{wall:'#efd6cf',roof:'hip',roofColor:T,plinth:{h:.6,c:'#c9b8b0'},
    open:[{t:'window',x:-2.6,w:2,grille:true},{t:'gate',x:.4,w:2,c:'#f2f2f0'},{t:'gate',x:2.8,w:2,c:'#f2f2f0'}]}),
  // brick house with a dark gable behind a stone wall with white railings and arched gates
  L('N',92,101,{wall:'#b5603f',roof:'gable',roofColor:'#5a3a2a',fascia:'#5a3a2a',eave:.9,setback:2.5,
    front:{h:1.6,c:'#9c8a70',style:'stone',rail:{h:.8,c:W,style:'bars'},gates:[{t:'gate',x:0,w:1.2,c:W}]},open:[{t:'window',x:-2.4,w:1.8}]}),
  // the long mint wall with clay coping, the mint house at its end
  muro('N',101,109,'#cfe5da',2.2,{behind:{w:7,d:8,at:3,roofColor:T,wall:'#cbe3d6'}}),
  muro('N',109,114,'#cfe5da',2.2),
  L('N',114,118.6,{wall:'#cbe3d6',roof:'hip',roofColor:T,open:[{t:'window',x:-.9,w:1.4,grille:true},{t:'window',x:1.4,w:1.2,grille:true}]}),
  // --- João Cabrera → Barão do Rio Branco
  // the pink corner café: teal frames, glass front, white balcony bars above
  L('N',127,144,{floors:2,wall:'#f0b9c4',roof:'flat',parapet:true,
    open:[{t:'glass',x:-5,w:2.8,y:0,h:2.5,frame:'#3aa89a'},{t:'glass',x:-1.4,w:2.6,y:0,h:2.5,frame:'#3aa89a'},{t:'window',x:2.6,w:1.6,frame:'#3aa89a'},
      {t:'door',x:6.4,w:1,c:W},{t:'window',x:-3,w:2,fl:1},{t:'window',x:3,w:2,fl:1}],balcony:{x:0,w:16,fl:1,rail:'white'}}),
  // peach house: brown metal gate, brown shutters
  L('N',144,158,{wall:'#f2c9a8',roof:'gable',roofColor:T,fascia:W,eave:.7,
    open:[{t:'gate',x:-4.2,w:3,c:'#8a5a3a'},{t:'window',x:0,w:1.4,frame:W},{t:'window',x:4,w:1.8,shutters:'#8a5a3a',frame:W}]}),
  // ELITE Centro Automotivo: the open workshop bay on a grey tiled base
  L('N',158,172,{wall:'#efefeb',roof:'flat',parapet:true,plinth:{h:1.2,c:'#6a6c70'},
    open:[{t:'open',x:.6,w:5.2,h:3.2,c:'casa',awning:'#9a9a98'}],
    sign:{text:'ELITE CENTRO AUTOMOTIVO',bg:'#f2f2f0',fg:'#c8322c',x:4.9,y:2.4,w:3.4,h:.8}}),
  // yellow house behind its yellow barred wall
  L('N',172,177,{wall:'#e9c44a',roof:'hip',roofColor:T,setback:4,front:{h:1,c:'#e9c44a',rail:{h:1,c:'#e9c44a',style:'bars'}}}),
  // peach shop on an orange base band
  L('N',177,189,{wall:'#f3c9aa',roof:'hip',roofColor:T,plinth:{h:.9,c:'#e07040'},
    open:[{t:'window',x:-3.6,w:1.6,frame:W},{t:'door',x:2.4,w:1.1,c:'#5a4030'},{t:'window',x:4.4,w:.9,grille:true}]}),
  // navy gable house with a white carport behind black railings
  L('N',189,197,{wall:'#e9e4dc',roof:'gable',roofColor:'#5a5a58',fascia:W,eave:.8,setback:2,panels:[{x:0,w:7,c:'#3a4250',y0:2.4,y1:3.4}],
    front:{h:.4,c:'#3a3a3a',rail:{h:1.4,c:'#2a2a2a',style:'bars'}},open:[{t:'open',x:-1,w:4,h:2.4,c:'casa'},{t:'window',x:2.6,w:1.4,grille:true}]}),
  // grey house with three arches, stone wall with a white picket fence
  L('N',197,206,{wall:'#b9bcbf',roof:'hip',roofColor:T,setback:3,
    front:{h:.9,c:'#a8957a',style:'stone',rail:{h:.9,c:W,style:'bars'},gates:[{t:'gate',x:-3.4,w:2.4,c:'#e8e8e6'}]},
    open:[{t:'arch',x:-2.6,w:2.2,h:2.2,y:0},{t:'arch',x:0,w:2.2,h:2.2,y:0},{t:'arch',x:2.6,w:2.2,h:2.2,y:0}]}),
  // --- Barão do Rio Branco → Espírito Santo
  // white house behind black railings
  L('N',251.6,258,{wall:'#efefed',roof:'hip',roofColor:T,setback:2,front:{h:.6,c:'#d8d8d4',rail:{h:1,c:'#3a3a3a',style:'bars'}},
    open:[{t:'glass',x:-1,w:2.4,frame:'#5a5a5a'},{t:'glass',x:2,w:1.6,frame:'#5a5a5a'}]}),
  // grey clothes shop under a round green awning
  L('N',258,266,{wall:'#cfcfcc',roof:'hip',roofColor:T,
    open:[{t:'vitrine',x:-2.4,w:2,c:'roupa'},{t:'door',x:.2,w:1.2,c:'#3a3a3a',awning:'#6aa08a'},{t:'vitrine',x:2.8,w:2,c:'roupa'}]}),
  // the long grey building with brown-framed windows
  L('N',266,276,{wall:'#d2d2cf',roof:'hip',roofColor:T,
    open:[{t:'window',x:-2.2,w:1.8,frame:'#6a4a3a',grille:true},{t:'window',x:1.4,w:1.8,frame:'#6a4a3a',grille:true},{t:'glass',x:4,w:1.2,frame:'#6a4a3a'}]}),
  // a building site behind galvanised hoarding
  muro('N',276,286,'#b9bdc0',2.2,{behind:{w:9,d:9,at:2,floors:2,roof:'flat',roofColor:'#9a958c',wall:'#a9a6a0'}}),
  muro('N',286,297,'#b9bdc0',2.2,{behind:{w:6,d:8,at:2,roof:'flat',roofColor:'#9a958c',wall:'#a9a6a0'}}),
  // a doctor's surgery in an old beige house, a little pillared porch
  L('N',297,306.5,{wall:'#e2cfb0',roof:'gable',roofColor:T,fascia:W,eave:.7,
    open:[{t:'open',x:-2,w:2.2,h:2.3,c:'casa'},{t:'window',x:2,w:1.6,grille:true,frame:'#d8bfa0'}]}),
  // De Genova, the clinical laboratory
  L('N',306.5,318,{wall:'#e6d4b8',roof:'hip',roofColor:T,
    open:[{t:'window',x:-3.2,w:2,grille:true,frame:W},{t:'open',x:.8,w:1.6,h:2.3,c:'casa'},{t:'window',x:3.8,w:1.4,frame:W}],
    sign:{text:'DE GENOVA',bg:'#f2f2f0',fg:'#2c6a4a',x:.8,y:2.6,w:2.4,h:.5}}),
  // --- Espírito Santo → Francisco Pereira de Souza
  // pink corner shop on a dark stone base
  L('N',326,337,{wall:'#efd8da',roof:'hip',roofColor:T,plinth:{h:.6,c:'#5a3a30',stone:true},
    open:[{t:'glass',x:-1.4,w:1.4,y:0,h:2.3,frame:'#3a3a3a'},{t:'window',x:2.4,w:1.8,grille:true}]}),
  // nº 327: pink house, grilled windows and door on a brown stone base
  L('N',337,345,{wall:'#efdcdc',roof:'hip',roofColor:T,plinth:{h:.9,c:'#5a3a30',stone:true},
    open:[{t:'window',x:-2.6,w:1.4,grille:true},{t:'window',x:0,w:1.6,grille:true},{t:'door',x:2.4,w:.9,c:W}]}),
  // a timber-clad annex under a pale tiled porch
  L('N',345,352,{wall:'#9c7048',roof:'hip',roofColor:'#c9a878',open:[{t:'door',x:0,w:1.4,c:'#3a2a20',awning:'#c9a878'}]}),
  // Casa da Agricultura (CATI): beige and brick behind black railings on a blue kerb
  L('N',368,390,{wall:'#b5603f',roof:'hip',roofColor:T,setback:2.7,panels:[{x:-8,w:4.6,c:'#ece4d0'}],
    front:{h:.5,c:'#2f4f9a',rail:{h:1.5,c:'#2a2a2a',style:'bars'}},
    open:[{t:'gate',x:-5,w:2.6,c:'#2a2a2a'},{t:'window',x:1,w:4,frame:'#2f4f9a'},{t:'window',x:6.4,w:3,frame:'#2f4f9a'}],
    sign:{text:'CASA DA AGRICULTURA',bg:'#ece4d0',fg:'#2a2a2a',x:-8,y:2.5,w:3.8,h:.5}}),
  // --- Francisco Pereira de Souza → Joaquim Garcia (Lunayma takes its first 45 m)
  // white house on a brown base, white louvred garage doors
  L('N',474,486,{wall:'#f2f2f0',roof:'hip',roofColor:T,plinth:{h:1,c:'#5a3a2a'},
    open:[{t:'window',x:-3.6,w:1.4,grille:true},{t:'window',x:-1,w:1.4,grille:true},{t:'garage',x:3.2,w:3.4,c:'#f4f4f2'}]}),
  // a doctor's surgery behind black railings
  L('N',486,492,{wall:'#e6d9bc',roof:'flat',parapet:true,setback:3,front:{h:.4,c:'#3a3a3a',rail:{h:1.6,c:'#2a2a2a',style:'bars'}},
    open:[{t:'door',x:0,w:1.1,c:'#3a3a3a'}],sign:{text:'CLÍNICA MÉDICA',bg:'#e6d9bc',fg:'#3a3a3a',x:0,y:2.7,w:2.6,h:.5}}),
  // Agropecuária Agro Bell: the open shop front under its painted board
  L('N',492,506,{wall:'#f2f2f0',roof:'flat',parapet:true,
    open:[{t:'open',x:-2,w:6,h:2.8,c:'casa'},{t:'window',x:4.4,w:2,grille:true}],
    sign:{text:'AGROPECUÁRIA AGRO BELL',bg:'#f4f4f2',fg:'#2a5aa8',x:-1.4,y:3.1,w:8,h:1}}),
  // --- Joaquim Garcia → Campos Salles
  // Bar do Wandinho: blue, white trim, clay roof on the corner
  L('N',527.2,537,{wall:'#2f4f7a',roof:'hip',roofColor:T,
    open:[{t:'open',x:-2,w:1.6,h:2.4,c:'casa'},{t:'window',x:2.2,w:1.8,frame:W}],
    sign:{text:'BAR DO WANDINHO',bg:'#1c1c1e',fg:'#f2d21a',x:-2.6,y:2.5,w:3,h:.6}}),
  // nº 541 in the same blue, then Diego Hortifruti (green, orange awning)
  L('N',537,541,{wall:'#2f4f7a',roof:'hip',roofColor:T,open:[{t:'door',x:0,w:1.2,c:W}]}),
  L('N',541,546,{wall:'#5fb04a',roof:'hip',roofColor:T,open:[{t:'door',x:0,w:2.4,c:'#e8e4dc',awning:'#f07a2a'}],
    sign:{text:'DIEGO HORTIFRUTI',bg:'#f2f2f0',fg:'#c8322c',x:0,y:2.6,w:3,h:.6}}),
  L('N',546,553,{wall:'#e6d4b6',roof:'hip',roofColor:T,open:[{t:'door',x:-1,w:2,c:W,awning:'#f2f0ea'},{t:'window',x:2.2,w:1.2}]}),
  // white house on a stone base, grey window
  L('N',553,559,{wall:'#f2f2f0',roof:'hip',roofColor:T,plinth:{h:1,c:'#a8957a',stone:true},open:[{t:'window',x:0,w:2,grille:true}]}),
  // João da Loja – Variedades: shop under a red board, balconies above
  L('N',559,568,{floors:2,wall:'#f2f0ea',upper:'#efe6d6',roof:'flat',parapet:true,
    open:[{t:'vitrine',x:-1.4,w:4,c:'roupa'},{t:'gate',x:3,w:2.2,c:'#9aa0a3'},{t:'window',x:0,w:3,fl:1}],balcony:{x:0,w:8,fl:1,rail:'white'},
    sign:{text:'JOÃO DA LOJA - VARIEDADES',bg:'#c8322c',fg:'#ffffff',x:-.6,y:2.8,w:6,h:.6}}),
  // --- Campos Salles → Bernadino Franchi
  // white house set back behind a red iron railing, a deep porch
  L('N',625.5,634,{wall:'#f2f2f0',roof:'flat',fascia:W,eave:.8,setback:2,front:{h:.6,c:'#e8e8e4',rail:{h:1,c:'#8a2a2a',style:'bars'}},
    open:[{t:'open',x:0,w:4,h:2.4,c:'casa'}]}),
  // white house, maroon shutters and door
  L('N',634,643,{wall:'#ecebe7',roof:'flat',fascia:W,eave:.6,
    open:[{t:'window',x:-2.6,w:1.8,shutters:'#7a2a2a',frame:W},{t:'window',x:.6,w:1.8,shutters:'#7a2a2a',frame:W},{t:'door',x:3.4,w:1,c:'#8a2a2a'}]}),
  // Distribuidora de Bebidas Serv-Festas: white tiles over a red base
  L('N',643,657,{wall:'#f4f4f2',roof:'hip',roofColor:T,plinth:{h:.8,c:'#d8322c'},
    open:[{t:'door',x:-5,w:1.4,c:'#c8322c'},{t:'shop',x:-1.6,w:2.6,c:'#3a3a3a'},{t:'shop',x:2.8,w:3.2,c:'#3a3a3a'},{t:'gate',x:5.8,w:1.2,c:'#c8322c'}],
    sign:{text:'DISTRIBUIDORA DE BEBIDAS SERV-FESTAS',bg:'#f2f2f0',fg:'#3a3a3a',x:0,y:3,w:11,h:.7}}),
  // --- Bernadino Franchi → Lourival Medeiros
  // beige house with stone dots: an arched carport, balustrade fence
  L('N',725,738,{wall:'#ecdcc0',roof:'gable',roofColor:T,fascia:'#8a5a3a',eave:.8,setback:2,
    front:{h:1,c:'#ece6d6',rail:{h:.3,c:W,style:'bars'}},
    open:[{t:'arch',x:-3,w:3,h:2.4,y:0},{t:'door',x:1.6,w:1,c:'#8a4a2a'},{t:'window',x:3.6,w:1,frame:W}]}),
  // grey houses on a dark base, white frames
  L('N',756,764,{wall:'#d0d0ce',roof:'hip',roofColor:T,plinth:{h:.9,c:'#5a6670'},
    open:[{t:'window',x:-2.4,w:1.6,shutters:W},{t:'open',x:0,w:1.6,h:2.2,y:.6,c:'casa'},{t:'window',x:2.4,w:1.4,shutters:W}]}),
  // MasterSom: terracotta sobrado, the open car-audio bay
  L('N',764,772,{floors:2,wall:'#c96a4a',roof:'flat',parapet:true,open:[{t:'open',x:-1,w:4,h:2.8,c:'casa'},{t:'door',x:2.8,w:1,c:'#5a3a2a'},{t:'window',x:0,w:2.4,fl:1}],
    sign:{text:'MASTERSOM',bg:'#1c1c1e',fg:'#e8322c',x:-1,y:3,w:3.4,h:.7}}),
  // stone-clad sobrado: dark garage, brown door, balconies
  L('N',772,782,{floors:2,wall:'#f2ece0',roof:'flat',parapet:true,panels:[{x:0,w:10,stone:true,y0:0,y1:2.9}],
    open:[{t:'garage',x:-2.4,w:3,c:'#2a2a2c'},{t:'door',x:2.2,w:1.6,c:'#6a4030'},{t:'window',x:0,w:3,fl:1}],balcony:{x:0,w:9,fl:1,rail:'iron'}}),

  // ================= SOUTH SIDE =================
  // --- São José → João Cabrera
  // the black agro-pet shop with orange stripes on the corner, white flat above
  L('S',10,24,{floors:2,wall:'#1f1f22',upper:'#ecebe7',roof:'flat',parapet:true,band:'#e0782a',
    open:[{t:'open',x:0,w:3,h:2.5,c:'casa'},{t:'window',x:-4,w:1,frame:'#e0782a'},{t:'window',x:-3,w:1.6,fl:1}],balcony:{x:-3,w:6,fl:1,rail:'white'}}),
  muro('S',24,28,'#c9bfae',2.2,{front:{h:2.2,c:'#c9bfae',gates:[{t:'gate',x:0,w:1.2,c:'#a8b4bc',awning:T}]}}),
  // beige gable houses up balustraded steps, white bars on a whitewashed wall
  L('S',28,38.5,{wall:'#e3d3bd',roof:'gable',roofColor:T,fascia:'#6a4a3a',eave:.8,setback:3,
    front:{h:1,c:'#e6e2da',rail:{h:1,c:W,style:'bars'},gates:[{t:'gate',x:-2,w:1.2,c:W}]},
    open:[{t:'window',x:-2.4,w:1.4,grille:true},{t:'glass',x:1,w:2.4}]}),
  L('S',38.5,44,{wall:'#e6d6be',roof:'gable',roofColor:T,fascia:'#6a4a3a',setback:3,front:{h:1,c:'#e0dcd2',rail:{h:.9,c:W,style:'bars'}},
    open:[{t:'window',x:-1.4,w:1.6,grille:true},{t:'glass',x:1.6,w:1.8}]}),
  // modern house: mauve front wall with mosaic panels, lime-green walls behind
  L('S',44,51.5,{wall:'#c9d27a',roof:'flat',parapet:true,setback:3,front:{h:2.2,c:'#c8a3a0',gates:[{t:'door',x:-2.8,w:1,c:W}]},open:[{t:'glass',x:1,w:3}]}),
  // the pilates studio and a white garage door
  L('S',51.5,58,{wall:'#c8a3a0',roof:'flat',parapet:true,open:[{t:'glass',x:1.8,w:2.6,y:0,h:2.4,frame:'#5a5a5a'},{t:'garage',x:-1.6,w:2.8,c:W}],
    sign:{text:'MARI · PILATES',bg:'#f2f2f0',fg:'#3a6ab0',x:1.8,y:2.6,w:2.6,h:.5}}),
  // grey mosaic-tiled sobrado, diagonal-barred garage gates
  L('S',58,70,{floors:2,wall:'#8f9396',roof:'flat',parapet:true,
    open:[{t:'gate',x:-4,w:3.6,c:'#c8d2d4'},{t:'glass',x:-.2,w:2.2,y:0,h:2.4},{t:'gate',x:3.8,w:3.6,c:'#c8d2d4'},{t:'window',x:0,w:3,fl:1}],balcony:{x:0,w:10,fl:1,rail:'iron'}}),
  // taupe sobrado: a clothes shop window, white garage, framed balcony
  L('S',70,80,{floors:2,wall:'#8e8a86',upper:'#cfc8be',roof:'flat',parapet:true,
    open:[{t:'vitrine',x:-2,w:3.2,c:'roupa'},{t:'garage',x:3,w:2.8,c:W},{t:'window',x:-1,w:2.4,fl:1}],balcony:{x:-1,w:6,fl:1,rail:'white'}}),
  // cream wall over a grey lower half, yards behind; grey wall with a brown sheet gate
  muro('S',80,90,'#e6dfd2',2.2,{behind:{w:8,d:8,at:3,roofColor:T,wall:'#ece6da'}}),
  muro('S',90,96,'#b8b4ac',2.2,{front:{h:2.2,c:'#b8b4ac',gates:[{t:'gate',x:.6,w:2.6,c:'#7a4a2e'}]}}),
  // cream house raised over a granite base: red steps up to the porch, brown shutters
  L('S',96,104,{wall:'#efe6d6',roof:'hip',roofColor:T,plinth:{h:1.2,c:'#8f8f8a',stone:true},
    open:[{t:'open',x:.6,w:3,h:2.2,y:1.2,c:'casa'},{t:'window',x:-2.6,w:1.2,y:2.2,shutters:'#8a4a2a'}]}),
  // white-tiled sobrado with rounded balconies, grey roll doors
  L('S',104,110,{floors:2,wall:'#ecebe7',roof:'flat',parapet:true,
    open:[{t:'garage',x:-1.2,w:2.4,c:'#e6eaec'},{t:'garage',x:1.6,w:2.2,c:'#e6eaec'},{t:'window',x:0,w:2.4,fl:1}],balcony:{x:0,w:5,fl:1,rail:'glass'}}),
  // Banho Divino Pet
  L('S',110,119,{floors:2,wall:'#ecebe7',roof:'flat',parapet:true,
    open:[{t:'glass',x:-2.6,w:2.2,y:0,h:2.4,frame:'#2a3a8a'},{t:'glass',x:1.6,w:2,y:0,h:2.4,frame:'#2a3a8a'},{t:'window',x:0,w:3,fl:1}],
    balcony:{x:0,w:8,fl:1,rail:'white'},sign:{text:'BANHO DIVINO PET',bg:'#2a3a8a',fg:'#f2f2ee',x:-.4,y:2.7,w:4,h:.5}}),
  // --- João Cabrera → Barão do Rio Branco
  // the white corner sobrado: stone-clad ground floor under green awnings, dark glass balcony
  L('S',127.3,146,{floors:2,wall:'#ecebe7',roof:'hip',roofColor:T,panels:[{x:0,w:19.5,stone:true,y0:0,y1:2.7}],
    open:[{t:'window',x:-6,w:2.6,frame:'#2a2a2a',awning:'#5f8a7a'},{t:'window',x:-1.6,w:2.6,frame:'#2a2a2a',awning:'#5f8a7a'},{t:'door',x:2.4,w:1,c:'#7a3a2a'},
      {t:'window',x:6.4,w:2.6,frame:'#2a2a2a',awning:'#5f8a7a'},{t:'window',x:-5,w:1.2,fl:1,shutters:'#6a3a2a'},{t:'window',x:2,w:1.2,fl:1,shutters:'#6a3a2a'}],
    balcony:{x:0,w:18,fl:1,rail:'glass'}}),
  // Laboratório São Judas Tadeu: white with pink fascia bands, stone low wall
  L('S',146,158.5,{wall:'#f2f2f0',roof:'flat',fascia:'#c96a6a',eave:.6,setback:1,panels:[{x:5,w:2.4,stone:true,y0:0,y1:1.2}],
    open:[{t:'window',x:-3.4,w:2.2,grille:true},{t:'window',x:.6,w:2.2,grille:true},{t:'gate',x:4.6,w:1.4,c:W}],
    sign:{text:'LABORATÓRIO SÃO JUDAS TADEU',bg:'#f2f2f0',fg:'#4a4a4a',x:-1.4,y:2.5,w:6.6,h:.5}}),
  // cream sobrado with a round stair tower, white lattice fence, glass balconies
  L('S',158.5,170.5,{floors:2,wall:'#e6d6bc',roof:'flat',parapet:true,setback:3,front:{h:.4,c:'#e6d6bc',rail:{h:1.4,c:W,style:'lattice'}},
    open:[{t:'open',x:-3,w:3,h:2.4,c:'casa'},{t:'door',x:2,w:1,c:'#7a3a2a'},{t:'window',x:-1,w:1,fl:1}],balcony:{x:0,w:11,fl:1,rail:'glass'}}),
  // peach sobrados: maroon iron gates, balustrade walls, a red breeze-block band
  L('S',170.5,180.5,{floors:2,wall:'#efd6c4',roof:'hip',roofColor:TD,
    open:[{t:'gate',x:-3,w:2.6,c:'#7a2a24'},{t:'door',x:0,w:1,c:'#7a2a24'},{t:'gate',x:3.4,w:2.2,c:W},{t:'window',x:-2,w:1.2,fl:1,shutters:'#7a2a24'}]}),
  L('S',180.5,188,{floors:2,wall:'#efd6c4',roof:'hip',roofColor:TD,band:'#a8463c',
    open:[{t:'garage',x:1.4,w:2.8,c:'#7a2a24'},{t:'door',x:-2,w:1,c:'#7a2a24'},{t:'window',x:1,w:1.2,fl:1,shutters:'#7a2a24'}]}),
  // lilac-blue sobrado over an unfinished block ground floor
  L('S',188,193,{floors:2,wall:'#9a9590',upper:'#b9c6e2',roof:'gable',roofColor:T,
    open:[{t:'window',x:-1,w:1,grille:true},{t:'door',x:1.2,w:.9,c:'#4a4a4a'},{t:'window',x:0,w:1.4,fl:1,shutters:W}]}),
  // a glazed porch under a balcony
  L('S',193,198.6,{floors:2,wall:'#e2cfb8',roof:'flat',parapet:true,open:[{t:'glass',x:0,w:3.4,y:0,h:2.2,frame:W}],balcony:{x:0,w:4,fl:1,rail:'white'}}),
  // blue-lilac sobrado, its outside stair
  L('S',198.6,205,{floors:2,wall:'#9a9590',upper:'#b9c6e2',roof:'hip',roofColor:T,
    open:[{t:'gate',x:1,w:2.6,c:'#d8d8d6'},{t:'window',x:-1,w:2.2,fl:1}]}),
  // yellow house over a textured ochre band, green shutters
  L('S',205,211,{wall:'#ecd9a6',roof:'hip',roofColor:T,plinth:{h:1.8,c:'#c9a66a'},
    open:[{t:'window',x:-1,w:1.4,y:2,shutters:'#3f6a5a'},{t:'door',x:2,w:.9,c:'#6a6a6a'}]}),
  // the long whitewashed wall with a stepped red stripe and blue coping; the blue building behind
  muro('S',211,221,'#e8e6e2',2.2,{behind:{w:9,d:8,at:3,floors:2,roof:'flat',roofColor:'#9a9a94',wall:'#3f64a8'}}),
  muro('S',221,231,'#e8e6e2',2.2,{behind:{w:9,d:8,at:3,floors:2,roof:'flat',roofColor:'#9a9a94',wall:'#3f64a8'}}),
  muro('S',231,241,'#e8e6e2',2.2,{behind:{w:9,d:8,at:3,floors:2,roof:'flat',roofColor:'#9a9a94',wall:'#3f64a8'}}),
  // --- Barão do Rio Branco → Espírito Santo (Woodstock on the corner; the Posto Taurus from s 288)
  // an old cream wall, a billboard behind
  muro('S',268,276,'#e2d6b8',1.8),
  // grey-and-white house: brick gable panel with a round window, arched windows, balustrade wall
  L('S',276,284.5,{wall:'#e6e6e4',roof:'gable',roofColor:'#7a4a35',fascia:'#5a3a2a',eave:.9,setback:3,panels:[{x:-.4,w:3,c:'#a8503a'}],
    front:{h:.9,c:'#d8d8d6',rail:{h:.8,c:W,style:'bars'},gates:[{t:'gate',x:4,w:1.2,c:'#2a2a2a'}]},
    open:[{t:'arch',x:-4,w:1.2,shutters:'#5a3a2a'},{t:'arch',x:-2.4,w:1.2,shutters:'#5a3a2a'},{t:'window',x:-.4,w:.9,h:.9,y:1.8},{t:'open',x:3.6,w:3,h:2.4,c:'casa'}]}),
  // --- Espírito Santo → Francisco Pereira de Souza
  // the brick corner sobrado on a grey stone ground floor: white garage, a little shop, balusters above
  L('S',325.8,336,{floors:2,wall:'#b5603f',roof:'hip',roofColor:T,plinth:{h:2.8,c:'#7a7a78',stone:true},
    open:[{t:'garage',x:-2.4,w:2.6,c:W},{t:'open',x:1.8,w:3.2,h:2.4,c:'casa'},{t:'window',x:-2,w:1.4,fl:1,shutters:W},{t:'window',x:2,w:1.4,fl:1,shutters:W}],
    balcony:{x:0,w:8,fl:1,rail:'white'}}),
  muro('S',336,347,'#c98a5a',2.4,{front:{h:2.4,c:'#c98a5a',gates:[{t:'door',x:-1,w:1,c:'#b5503a'}]}}),
  // KX Multimarcas: cars behind a chain-link fence under the yellow board, the office at the back
  L('S',375,388,{wall:'#f2f2f0',roof:'flat',setback:6,d:5,front:{h:.5,c:'#3a3a3a',rail:{h:1.6,c:'#d8d8d8',style:'lattice'}},
    open:[{t:'door',x:2,w:1.6,c:W}],sign:{text:'KX MULTIMARCAS',bg:'#f2d21a',fg:'#1c1c1c',x:-1,y:2.4,w:5,h:1}}),
  // Imperial: white with the red frame
  L('S',388,398.5,{wall:'#f2f2f0',roof:'flat',parapet:true,setback:1.5,panels:[{x:0,w:9,c:'#d8322c',y0:3,y1:3.4}],
    open:[{t:'door',x:2.6,w:1.1,c:'#3a3a3a'},{t:'glass',x:-2,w:2.4,frame:'#9a9a9a'}],sign:{text:'IMPERIAL',bg:'#f2f2f0',fg:'#c8322c',x:-.4,y:2.2,w:2.6,h:.6}}),
  // pink-tiled sobrado over a row of garages
  L('S',398.5,419,{floors:2,wall:'#e8b4a8',roof:'flat',parapet:true,
    open:[{t:'garage',x:-7.6,w:3.6,c:'#e9b8b0'},{t:'garage',x:-3.4,w:3.6,c:'#d8a49a'},{t:'garage',x:1,w:3.6,c:'#d8a49a'},{t:'garage',x:5.6,w:3.6,c:'#e9b8b0'},
      {t:'window',x:-7.6,w:2.2,fl:1},{t:'window',x:-3,w:2.4,fl:1},{t:'window',x:1.6,w:1.4,fl:1},{t:'window',x:6,w:2.4,fl:1}]}),
  // --- Francisco Pereira de Souza → Joaquim Garcia
  // granite-textured house on the corner, white louvred windows
  L('S',428.4,443,{wall:'#b9b6b0',roof:'hip',roofColor:T,plinth:{h:1,c:'#a8a59e',stone:true},
    open:[{t:'window',x:-3,w:2,shutters:W},{t:'window',x:2.4,w:2,shutters:W}]}),
  // a blue shopfront and the variety store's poster window
  L('S',443,449,{floors:2,wall:'#ecebe7',roof:'flat',parapet:true,open:[{t:'glass',x:0,w:2.6,y:0,h:2.4,frame:'#2a4a9a',awning:'#2a4a9a'}]}),
  L('S',449,460,{floors:2,wall:'#ecebe7',roof:'flat',parapet:true,open:[{t:'glass',x:-1,w:5,y:0,h:2.6,frame:'#3a3a3a'},{t:'window',x:-1,w:1.6,fl:1,shutters:W}],
    sign:{text:'VARIEDADES E UTILIDADES DOMÉSTICAS',bg:'#2a2a8a',fg:'#f2d21a',x:-1,y:2.75,w:6,h:.5}}),
  // brick-faced house raised behind iron railings, arched windows
  L('S',476,484,{wall:'#b5683f',roof:'gable',roofColor:T,fascia:W,setback:2,front:{h:1.2,c:'#b5683f',rail:{h:.8,c:'#c8c8c4',style:'bars'}},
    open:[{t:'arch',x:-2,w:1.2,y:1.6},{t:'arch',x:0,w:1.2,y:1.6},{t:'arch',x:2,w:1.2,y:1.6}]}),
  // textured beige house with an arched porch over a stone-patterned base
  L('S',484,490,{wall:'#d8b88a',roof:'gable',roofColor:T,fascia:W,plinth:{h:1.6,c:'#cfae80'},
    open:[{t:'window',x:-1.6,w:1,y:2},{t:'open',x:1,w:2.4,h:1.8,y:1.6,c:'casa'}]}),
  // empty lots behind precast walls
  muro('S',490,500,'#b8b4aa',1.8,{front:{h:1.8,c:'#b8b4aa',gates:[{t:'gate',x:3,w:3,c:'#c8c8c4'}]}}),
  // white corner house on a dark red base, red shutters
  L('S',500.6,517.9,{wall:'#f2f2f0',roof:'hip',roofColor:T,plinth:{h:1.6,c:'#8a2a2a'},
    open:[{t:'window',x:-5,w:2.4,shutters:'#a83a2e'},{t:'window',x:-.6,w:2.4,shutters:'#a83a2e'},{t:'window',x:3.6,w:1.4,grille:true}]}),
  // --- Joaquim Garcia → Campos Salles
  // the old red-earth plastered wall of a big wooded yard
  muro('S',526,537,'#c8805a',2.2),
  muro('S',537,547,'#c8805a',2.2),
  // Drogaria Martinelli
  L('S',547,560,{floors:2,wall:'#e8e6e2',upper:'#d6d2cc',roof:'flat',parapet:true,
    open:[{t:'glass',x:-3,w:4,y:0,h:2.6,frame:'#9a9a9a'},{t:'glass',x:2.4,w:4,y:0,h:2.6,frame:'#9a9a9a'}],
    sign:{text:'DROGARIA MARTINELLI',bg:'#f2f2f0',fg:'#c8322c',x:0,y:3,w:7,h:.8}}),
  // pink sobrado with brown stone pillars (Farmácia Popular), the green house next door
  L('S',560,566,{floors:2,wall:'#efd6cc',roof:'flat',parapet:true,panels:[{x:-2.4,w:.8,c:'#8a5a3a'}],
    open:[{t:'door',x:-1.4,w:1,c:'#e8e4dc'},{t:'garage',x:1.2,w:2.6,c:'#d8d8d6'},{t:'window',x:0,w:3,fl:1}]}),
  L('S',566,575,{wall:'#b9d8a8',roof:'hip',roofColor:T,plinth:{h:1.3,c:'#8a8a86',stone:true},
    open:[{t:'gate',x:-2.6,w:2.6,c:'#7a8288'},{t:'gate',x:2.6,w:1.2,c:'#7a8288'}]}),
  // the Câmara Municipal: white over a blue base, the glazed entrance up a flight of steps
  L('S',575,589,{floors:2,wall:'#f2f2f0',roof:'flat',parapet:true,plinth:{h:1.6,c:'#1f4aa0'},
    open:[{t:'glass',x:0,w:3.4,y:.6,h:2.6,frame:'#9a9a9a'},{t:'window',x:-4.6,w:2.4,fl:1},{t:'window',x:0,w:3,fl:1},{t:'window',x:4.6,w:2.4,fl:1}],
    sign:{text:'CÂMARA MUNICIPAL',bg:'#1f4aa0',fg:'#ffffff',x:0,y:3.4,w:4.4,h:.7}}),
  // --- Campos Salles → Bernadino Franchi
  // Big Bar Restaurante: stone-tiled ground floor under awnings, glass balcony
  L('S',625,640,{floors:2,wall:'#f2f2f0',roof:'flat',parapet:true,panels:[{x:0,w:15,stone:true,y0:0,y1:2.6}],
    open:[{t:'open',x:4.4,w:3,h:2.6,c:'casa',awning:'#d8d8d6'},{t:'window',x:-1,w:1,awning:'#d8d8d6'},{t:'window',x:-3,w:1,awning:'#d8d8d6'},{t:'window',x:-5,w:1}],
    balcony:{x:0,w:14,fl:1,rail:'glass'},sign:{text:'BIG BAR RESTAURANTE',bg:'#1f3f8a',fg:'#ffffff',x:4.4,y:3,w:3.6,h:.8}}),
  // dental surgery: white, louvred door, awnings
  L('S',640,652,{floors:2,wall:'#f2f2f0',roof:'flat',parapet:true,panels:[{x:-4,w:4,stone:true,y0:0,y1:2.6}],
    open:[{t:'garage',x:4.2,w:2.6,c:'#f2f2f0'},{t:'door',x:0,w:1.2,c:'#3a3a3a'},{t:'window',x:-4,w:2.4,awning:'#d8d8d6'}],
    sign:{text:'ODONTOLOGIA',bg:'#f2f2f0',fg:'#2a6ab0',x:2,y:2.4,w:2.4,h:.5}}),
  // Imobiliária Oliveira: parking behind a chain-link fence, the office at the back
  L('S',652,668,{wall:'#ece6d6',roof:'hip',roofColor:T,setback:7,d:5,front:{h:.6,c:'#e2dccd',rail:{h:1.6,c:'#c8c8c4',style:'lattice'},gates:[{t:'gate',x:0,w:4,c:'#c8c8c4'}]},
    open:[{t:'door',x:0,w:1,c:'#7a4a2a'},{t:'window',x:-3,w:1.6}],sign:{text:'IMOBILIÁRIA OLIVEIRA',bg:'#f2f2f0',fg:'#c8322c',x:3,y:2.4,w:4,h:.8}}),
  // --- Bernadino Franchi → Lourival Medeiros (the Posto Triângulo from s 770)
  // long beige house behind a stone wall with green railings, tiled gate porches
  L('S',725.6,736,{wall:'#e6d6b8',roof:'hip',roofColor:T,setback:4,
    front:{h:1.2,c:'#8a7a64',style:'stone',rail:{h:1.1,c:'#8a9a7a',style:'bars'},gates:[{t:'gate',x:2.6,w:3,c:'#9aa0a3',awning:T}]},
    open:[{t:'window',x:-2,w:1.6,shutters:'#7a8a9a'},{t:'window',x:1,w:1.4}]}),
  L('S',736,748,{wall:'#e6d6b8',roof:'hip',roofColor:T,setback:4,front:{h:1.2,c:'#8a7a64',style:'stone',rail:{h:1.1,c:'#8a9a7a',style:'bars'}},
    open:[{t:'window',x:-3,w:1.6,shutters:'#7a8a9a'},{t:'window',x:0,w:2.4},{t:'window',x:3,w:1.6,shutters:'#7a8a9a'}]}),
  L('S',748,758,{wall:'#e6d6b8',roof:'hip',roofColor:T,setback:4,front:{h:1.2,c:'#8a7a64',style:'stone',gates:[{t:'gate',x:3,w:3.6,c:'#9aa8b8',awning:T}]},
    open:[{t:'window',x:-2,w:1.6,shutters:'#7a8a9a'}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:14,kind:'resedaBranca'},{side:'N',s:104,kind:'ficus'},{side:'N',s:176,kind:'reseda'},{side:'N',s:192,kind:'ficus'},
  {side:'S',s:94,kind:'ficus'},{side:'S',s:150,kind:'ficus'},{side:'S',s:214,kind:'reseda'},{side:'S',s:236,kind:'reseda'},
  {side:'S',s:430,kind:'reseda'},{side:'S',s:440,kind:'reseda'},{side:'S',s:530,kind:'ficus'},{side:'S',s:542,kind:'ficus'},{side:'S',s:571,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  settStreets:['Rua João Cabrera','Rua Barão do Rio Branco','Rua Espírito Santo','Rua Francisco Pereira de Souza','Rua Joaquim Garcia','Rua Campos Salles'],
  poles:{side:'N',start:16,every:34,transformers:[150,400,640]},
  keepOut:[
    {side:'S',s0:286,s1:321,why:'the second Posto Taurus (posto-taurus-centro.ts)',walk:false},
    {side:'S',s0:589,s1:620,why:'the Câmara Municipal covered car park (galpoes.ts)'},
    {side:'S',s0:770,s1:818.7,why:'Auto Posto Triângulo (posto-triangulo.ts)',walk:false},
  ],
};
