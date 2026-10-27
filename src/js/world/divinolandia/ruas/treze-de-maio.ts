// Rua Treze de Maio — surveyed lot by lot from Google Street View (2024 imagery; survey of
// 2026-10-20, its reference frames rua-treze-* are no longer on disk; merged 2026-10-27,
// trimmed where comercio/lojas.ts now models Adriana Modas and Megabyte). The street runs ~942 m west→east along the north edge of the centre, two blocks
// north of the Matriz:
//   s=0   Av. Marginal do Rio do Peixe     s=15  (unnamed lane)
//   s=77  Rua São José                     s=165 Rua João Cabrera
//   s=288 Rua Barão do Rio Branco          s=365 Rua Espírito Santo
//   s=468 Rua Francisco Pereira de Souza   s=569 Rua Joaquim Garcia
//   s=664 Rua Campos Salles                s=766 Rua Bernadino Franchi
//   s=874 Rua Anibal Franchi / Praça N. S. do Rosário   s=942 Lourival Medeiros
//
// `s` = metres along the OSM centreline from the west end; side N/S. Each lot is one
// FachadaOpts (src/assets/models/divinolandia/fachada.ts), width = s1-s0. Opening x is
// measured from the lot centre as SEEN FROM THE STREET (left negative: on the N side left
// is west = lower s, on the S side left is east = higher s). Colours are picked from the
// photos. Corner lots whose front door faces the cross street belong to that street.
// Pure data (no THREE) so it can be unit-tested.
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const CROSS=[0,14.6,77,164.9,287.6,365.2,468.1,568.5,663.7,765.7,873.7,942.3];
export const RUA='Rua Treze de Maio';
export const SURFACE:Surface[]=[[0,164.9,'asphalt'],[164.9,942.3,'sett']];

const TILE='#a9573c',TILE_DARK='#8e4632',WHITE='#f1efe9',WOOD='#7a4a2e';
export const LOTS:Lot[]=[
  // ---------------- block D (João Cabrera → Barão do Rio Branco), north side ----------------
  // corner house: stone-clad wing + white wing behind a curved low wall (the game's clothes
  // shop takes the rest of its lot and the blue house next door, s 180–200)
  {side:'N',s0:170.5,s1:180,f:{wall:'#e9e7e1',roof:'hip',roofColor:TILE,setback:2,d:10,
    panels:[{x:-2.6,w:4.2,c:'#8a5a3a',y0:0,y1:3}],
    front:{h:.9,c:'#e4e2dc',rail:{h:1,style:'bars',c:'#ecebe7'}},
    open:[{t:'window',x:2.4,w:2.6,h:1.2,grille:true,frame:WHITE}],x:['ac','dish']},walk:'cimento'},
  {side:'N',s0:200,s1:210.5,f:{wall:'#cdbb9b',roof:'hip',roofColor:'#d2b08a',fascia:'#c9b796',setback:3,
    front:{h:.4,c:'#b9a888',rail:{h:1.4,style:'bars',c:'#fbfbfa'},gates:[{t:'gate',x:-1,w:1.2,c:'#f4f4f2'}]},
    open:[{t:'garage',x:-3,w:3.4,c:'#5b5148'},{t:'door',x:.6,w:1,c:'#f4f4f2'},{t:'window',x:3.2,w:1.6,frame:'#e9e2d4'}]},walk:'pedra'},
  {side:'N',s0:210.5,s1:216.5,f:{wall:'#8f8a80',wallOnly:true,front:{h:2.6,c:'#8f8a80',gates:[{t:'gate',x:.4,w:4.6,h:2.5,c:'#f4f4f2'}]},
    behind:{w:5,d:8,at:4,roof:'flat',roofColor:'#9a958c',wall:'#d9d6cf'}}},
  {side:'N',s0:216.5,s1:222,f:{wall:'#efe9df',roof:'gable',roofColor:TILE_DARK,fascia:WOOD,eave:.9,setback:4,
    front:{h:1.8,c:'#ece6da'},open:[{t:'window',x:0,w:1.4,frame:WHITE}]}},
  {side:'N',s0:222,s1:228.5,f:{wall:'#8b4a3a',roof:'hip',roofColor:TILE_DARK,setback:2,
    front:{h:1.2,c:'#e7e4de',rail:{h:.6,style:'bars',c:'#f2f2ee'}},
    open:[{t:'arch',x:-1.6,w:1.2,h:1.1,y:.9,frame:WHITE},{t:'arch',x:.4,w:1.2,h:1.1,y:.9,frame:WHITE},{t:'door',x:2.3,w:1,c:'#e9e6e0'}]}},
  {side:'N',s0:228.5,s1:237.5,f:{wall:'#ecd9b8',roof:'hip',roofColor:TILE_DARK,setback:3.5,
    front:{h:.5,c:'#ede8de',rail:{h:1,style:'bars',c:'#f6f6f4'},gates:[{t:'gate',x:-3.4,w:1.2,c:'#f6f6f4'}]},
    open:[{t:'door',x:-1.8,w:1.2,c:'#f6f6f4',grille:true},{t:'window',x:1.4,w:2.2,shutters:'#f6f6f4',frame:WHITE}]}},
  {side:'N',s0:237.5,s1:240.5,f:{wall:'#8e9a86',wallOnly:true,front:{h:2.4,c:'#8e9a86'}}},
  {side:'N',s0:240.5,s1:245,f:{wall:'#9a9d96',wallOnly:true,front:{h:2.4,c:'#9a9d96',gates:[{t:'gate',x:0,w:3.6,h:2.3,c:'#3f6fb2'}]},
    behind:{w:4,d:9,at:4,roof:'gable',roofColor:TILE_DARK,wall:'#5c8fd6'}}},
  {side:'N',s0:245,s1:253,f:{wall:'#8d9196',roof:'gable',roofColor:TILE_DARK,fascia:WOOD,eave:.9,plinth:{h:.4,c:'#e9e9e6'},
    open:[{t:'window',x:-2.4,w:1.2,shutters:'#e9e9e6',frame:WHITE},{t:'window',x:1.2,w:3,h:1.4,frame:WHITE}]}},
  {side:'N',s0:253,s1:255.5,f:{wall:'#5b8fd8',roof:'hip',roofColor:TILE,setback:1.2,d:9,
    open:[{t:'door',x:-.3,w:1,c:'#e9e9e6',grille:true}]}},
  {side:'N',s0:255.5,s1:257.5,f:{wall:'#8d9196',wallOnly:true,front:{h:2,c:'#8d9196',gates:[{t:'gate',x:0,w:1.4,h:2,c:'#2a2a2c'}]}}},
  {side:'N',s0:257.5,s1:267,f:{wall:'#babdc0',roof:'gable',roofColor:'#55585d',fascia:'#3a3c40',eave:.8,plinth:{h:.5,c:'#e9e9e6'},
    open:[{t:'window',x:-1.2,w:2.2,h:1.3,shutters:'#3a2c24',frame:WHITE},{t:'window',x:2.8,w:1.4,grille:true,frame:WHITE}]}},
  {side:'N',s0:267,s1:271,f:{wall:'#e9e6df',wallOnly:true,front:{h:2.2,c:'#e3e0d8'},behind:{w:4,d:8,at:3,roofColor:TILE,wall:'#e9e6df'}}},
  {side:'N',s0:271,s1:274.5,f:{wall:'#d8b25e',wallOnly:true,front:{h:2.2,c:'#d8b25e',gates:[{t:'gate',x:0,w:3,h:2.1,c:'#c48a80'}]}}},
  // the yellow house 277: hydrangeas behind a low wall of pillars
  {side:'N',s0:274.5,s1:281.8,f:{wall:'#e9c56a',roof:'gable',roofColor:TILE,fascia:WHITE,setback:2,plinth:{h:.6,c:'#c98a7a'},
    front:{h:.9,c:'#d8b25e',rail:{h:.5,style:'bars',c:'#7a5a3a'}},
    open:[{t:'window',x:-1.8,w:1.2,shutters:'#c89a92',frame:'#f1e9d8'},{t:'window',x:1.6,w:2.2,h:1.3,grille:true,frame:'#f1e9d8'}]},walk:'cimento'},
  // ---------------- block D, south side ----------------
  {side:'S',s0:170.7,s1:188,f:{floors:2,wall:'#9a9fa3',upper:'#e9e9e6',roof:'flat',fascia:'#e9e9e6',setback:3,
    front:{h:.5,c:'#c9cbcc',rail:{h:1.5,style:'bars',c:'#eef0f1'}},
    open:[{t:'glass',x:2,w:3,frame:'#2a2c2e'},{t:'window',x:-3,w:1.6,fl:1,frame:'#2a2c2e'},{t:'window',x:3,w:2.4,fl:1,frame:'#2a2c2e'}]},walk:'cimento'},
  {side:'S',s0:188,s1:199,f:{floors:2,wall:'#eeeeec',roof:'flat',fascia:'#eeeeec',eave:.6,
    open:[{t:'garage',x:3,w:3.4,c:'#f4f4f2'},{t:'door',x:-.4,w:1,c:'#d9d9d6'},{t:'glass',x:-1,w:4,fl:1,frame:'#3a3c3e'}],
    balcony:{x:-1.2,w:6,fl:1,rail:'glass'}},walk:'ceramica'},
  {side:'S',s0:199,s1:212.4,f:{wall:'#c9cdd0',wallOnly:true,front:{h:2.7,c:'#c9cdd0',style:'panel',gates:[{t:'gate',x:-.6,w:3,h:2.6,c:'#e9ebec'}]}},walk:'cimento'},
  {side:'S',s0:212.4,s1:222,f:{floors:2,wall:'#ece6dc',roof:'hip',roofColor:'#9a6a4e',setback:1,
    panels:[{x:0,w:9.6,stone:true,y0:0,y1:2.9}],balcony:{x:-2,w:5,fl:1,rail:'glass'},
    open:[{t:'garage',x:.5,w:2.8,c:'#1e1e20'},{t:'glass',x:-2,w:3,fl:1,frame:'#3a3532'},{t:'window',x:2.8,w:1,fl:1,frame:'#3a3532'}]}},
  {side:'S',s0:222,s1:229,f:{wall:'#efede8',roof:'hip',roofColor:TILE,setback:2,
    front:{h:1,c:'#e7e4dd',rail:{h:.8,style:'bars',c:'#f2f2ee'}},open:[{t:'window',x:-1.4,w:1.4,frame:WHITE},{t:'door',x:1.8,w:1,c:'#3a3532'}]}},
  {side:'S',s0:229,s1:234.5,f:{floors:2,wall:'#e9d6b9',roof:'hip',roofColor:TILE,setback:2,
    front:{h:2.2,c:'#e7d4b6',gates:[{t:'garage',x:-.6,w:2.8,h:2.1,c:'#8a5a32'}]},
    open:[{t:'window',x:-.4,w:2.6,fl:1,frame:'#3a3532'}]}},
  {side:'S',s0:234.5,s1:245,f:{wall:'#e9d9bf',roof:'hip',roofColor:TILE,setback:5,
    front:{h:.9,c:'#8d8a82',rail:{h:1.1,style:'bars',c:'#f0f0ee'}},
    open:[{t:'glass',x:-1.5,w:3.6,h:1.6,frame:'#7a5a3a'},{t:'door',x:2.6,w:1,c:'#7a5a3a'}]}},
  {side:'S',s0:245,s1:252.7,f:{wall:'#efe7da',roof:'hip',roofColor:TILE,setback:4.5,
    front:{h:.6,c:'#9a978f',rail:{h:1.2,style:'bars',c:'#f2f2ee'},gates:[{t:'gate',x:-1.5,w:3.4,c:'#f2f2ee'}]},
    open:[{t:'window',x:2,w:1.4,frame:WHITE}]}},
  {side:'S',s0:252.7,s1:261.5,f:{floors:2,wall:'#7a3a2c',roof:'hip',roofColor:TILE_DARK,fascia:WHITE,
    balcony:{x:0,w:8.4,fl:1,rail:'iron',depth:1.4},
    open:[{t:'door',x:3.4,w:.9,c:'#5a2a1e'},{t:'arch',x:-2.6,w:1.8,h:1.4,y:.6,fl:1,frame:WHITE},{t:'arch',x:.2,w:1.8,h:1.4,y:.6,fl:1,frame:WHITE},{t:'arch',x:3,w:1.8,h:1.4,y:.6,fl:1,frame:WHITE}]}},
  // (the Barão corner: Megabyte Informática, comercio/lojas.ts)
  // ---------------- block E (Barão do Rio Branco → Espírito Santo), north side ----------------
  // the pink corner house: a little tiled porch on the corner, the long side behind a fence
  {side:'N',s0:293.5,s1:297.5,f:{wall:'#d6bcc0',roof:'gable',roofColor:TILE,fascia:'#8a5a3e',d:4,
    open:[{t:'door',x:0,w:1.3,h:2.1,c:'#e9e9e9',grille:true}]},walk:'ladrilho'},
  {side:'N',s0:297.5,s1:310,f:{wall:'#dcc6c8',roof:'hip',roofColor:TILE,setback:2.4,d:10,
    front:{h:.7,c:'#cfb3b7',rail:{h:1.3,style:'bars',c:'#ececea'}},
    open:[{t:'window',x:.3,w:1.4,shutters:'#9aa3a8',frame:WHITE},{t:'window',x:3.1,w:1.1,frame:WHITE},{t:'window',x:5.3,w:1.3,frame:WHITE}]},walk:'ladrilho'},
  {side:'N',s0:310,s1:316,f:{wall:'#c9aeb1',roof:'hip',roofColor:TILE,setback:3,
    front:{h:1.1,c:'#e3d6c4',gates:[{t:'gate',x:-1.6,w:1.8,c:WOOD}]},
    open:[{t:'door',x:1.4,w:1.2,c:WOOD}]}},
  {side:'N',s0:316,s1:325,f:{wall:'#f3f1ec',roof:'gable',roofColor:TILE_DARK,fascia:WOOD,eave:.9,setback:3.5,
    front:{h:1.2,c:'#e3d5bc',rail:{h:.5,style:'bars',c:WOOD},gates:[{t:'gate',x:-3.6,w:1.1,c:WOOD}]},
    open:[{t:'window',x:1,w:2.4,h:1.2,frame:'#9a3f2c'}]}},
  {side:'N',s0:325,s1:339,f:{wall:'#efe3c8',roof:'gable',roofColor:'#8c5a3e',fascia:'#7a4a2e',eave:1,setback:3,
    front:{h:1,c:'#cdbb9c',rail:{h:1.1,style:'bars',c:'#b1584a'},gates:[{t:'gate',x:5,w:2.6,h:2.2,c:'#c97a6a'}]},
    open:[{t:'window',x:-4,w:1.8,h:1.4,shutters:'#9a3f2c'},{t:'arch',x:-.6,w:1.2,h:1.3,y:.8},{t:'arch',x:1.6,w:1.2,h:1.3,y:.8}]}},
  {side:'N',s0:339,s1:345,f:{wall:'#efede8',roof:'gable',roofColor:TILE_DARK,plinth:{h:1.2,c:'#55555a'},
    open:[{t:'window',x:-.6,w:.9,shutters:'#9a3f2c'},{t:'gate',x:2.2,w:.8,c:'#cfd2d3'}]}},
  {side:'N',s0:345,s1:359.4,f:{wall:'#cfcbc4',roof:'hip',roofColor:TILE,panels:[{x:0,w:14.2,c:'#d6d2cc',y0:0,y1:3}],
    open:[{t:'window',x:-6,w:1.6,h:1.3,grille:true,frame:'#6b3a2a'},{t:'window',x:-3,w:1.6,h:1.3,grille:true,frame:'#6b3a2a'},
      {t:'window',x:1.2,w:2.6,h:1.3,grille:true,frame:'#6b3a2a'},{t:'gate',x:5.4,w:2,h:1.8,c:'#5a3a2a',grille:true}]},walk:'cimento'},
  // ---------------- block E, south side ----------------
  // the corner shop: white with a dark roughcast plinth, an awning over its shop window
  {side:'S',s0:293.5,s1:313,f:{wall:'#f2f0eb',roof:'hip',roofColor:TILE,plinth:{h:1.1,c:'#4a4b4e'},
    open:[{t:'glass',x:5.6,w:2.2,h:2.2,y:.9,awning:'#3c3d3b'},{t:'window',x:1.6,w:1.3,shutters:'#b07a4a'},{t:'window',x:-1.6,w:1.3,shutters:'#b07a4a'},
      {t:'window',x:-5.4,w:1.3,shutters:'#b07a4a'}]},walk:'ceramica'},
  {side:'S',s0:313,s1:326.5,f:{wall:'#efeeea',wallOnly:true,front:{h:2.6,c:'#ecebe6'},plinth:{h:1.2,c:'#8e8c86'},
    behind:{w:10,d:8,at:6,roof:'gable',roofColor:TILE,wall:'#f1f0ec'}},walk:'ceramica'},
  {side:'S',s0:326.5,s1:337,f:{floors:2,wall:'#e8d8bf',upper:'#ecdcc3',roof:'gable',roofColor:'#8c4a36',fascia:'#7a4a2e',eave:1,setback:2.5,
    front:{h:2.6,c:'#d8bf98',style:'panel',gates:[{t:'garage',x:-2.8,w:2.6,c:'#7d7f80'},{t:'door',x:4.2,w:1.2,c:'#3e342e'}]},
    open:[{t:'door',x:.8,w:1.4,fl:1,c:'#5a3a2a'},{t:'window',x:-3,w:1.2,fl:1,frame:'#5a3a2a'}]},walk:'ceramica'},
  {side:'S',s0:337,s1:345,f:{wall:'#e6d9a8',roof:'hip',roofColor:TILE,setback:3,
    front:{h:.6,c:'#e9e7e1',rail:{h:1.3,style:'bars',c:'#efefed'}},open:[{t:'window',x:0,w:1.4,frame:WHITE}]}},
  {side:'S',s0:345,s1:359.4,f:{floors:2,wall:'#d9c7b0',upper:'#e7ddcf',roof:'flat',fascia:'#efeae2',eave:.8,
    panels:[{x:0,w:14.2,c:'#c9ab92',y0:0,y1:3}],balcony:{x:-5.6,w:3,fl:1,rail:'white'},
    open:[{t:'garage',x:5.2,w:2.8,c:'#c9cbcc'},{t:'window',x:1.4,w:.9,h:.9,y:1.2,frame:WHITE},
      {t:'window',x:-2,w:2.4,fl:1,shutters:'#d4d4d0',frame:WHITE},{t:'window',x:1.8,w:1.4,fl:1,grille:true,frame:WHITE},{t:'window',x:5.2,w:1.6,fl:1,shutters:'#d4d4d0',frame:WHITE}]},walk:'cimento'},
  // ---------------- block B (the lane at s=15 → São José), north side ----------------
  // (the lane and São José only run south: the north side goes on unbroken past s=77)
  {side:'N',s0:29,s1:38.4,f:{wall:'#efede8',wallOnly:true,front:{h:1.8,c:'#efede8',gates:[{t:'gate',x:1.6,w:3.4,h:1.6,c:'#f4f4f2',grille:true}]},
    behind:{w:4,d:6,at:2,roof:'flat',roofColor:'#8f8b84',wall:'#b9cc9a'}}},
  // the long pale-green house, blind along the street, door at its east end
  {side:'N',s0:38.4,s1:49,f:{wall:'#b9cc9a',roof:'hip',roofColor:TILE,fascia:WHITE,eave:.7,plinth:{h:.3,c:'#a9bc8a'},
    open:[{t:'door',x:4.3,w:.9,c:'#f2f2ee',grille:true}]}},
  {side:'N',s0:49,s1:56,f:{wall:'#c9c4b8',wallOnly:true,front:{h:1.8,c:'#c9c4b8'},behind:{w:6,d:8,at:4,roof:'gable',roofColor:TILE,wall:'#f1efea'}}},
  {side:'N',s0:56,s1:61.4,f:{wall:'#a8a296',wallOnly:true,front:{h:.4,c:'#a8a296',rail:{h:.9,style:'bars',c:'#7a7a74'}}}},
  {side:'N',s0:61.4,s1:66,f:{wall:'#f1efea',roof:'gable',roofColor:TILE,setback:3,
    front:{h:1.4,c:'#9a6a52'},open:[{t:'window',x:-.8,w:.7,frame:WHITE},{t:'window',x:.6,w:.7,frame:WHITE}]}},
  // beige house, carport and porch under a front gable, behind a white fence
  {side:'N',s0:66,s1:76.1,f:{wall:'#e4d2b4',roof:'gable',roofColor:TILE,fascia:'#8a5a3e',eave:.9,setback:3,
    front:{h:.4,c:'#d9c7a8',rail:{h:1.3,style:'bars',c:'#f2f2ee'},gates:[{t:'gate',x:-2.6,w:3,c:'#f2f2ee'}]},
    open:[{t:'garage',x:-2.6,w:3,c:'#4a3a30'},{t:'door',x:1,w:1,c:'#7a4a2e'},{t:'window',x:3.2,w:1.4,frame:'#7a4a2e'}]}},
  // ---------------- block C (São José → João Cabrera), north side ----------------
  {side:'N',s0:76.1,s1:90,f:{wall:'#b49a94',roof:'hip',roofColor:TILE,setback:2.5,
    front:{h:.5,c:'#9a8a84',rail:{h:1,style:'bars',c:'#3a3230'}},
    open:[{t:'garage',x:-4,w:3,c:'#5a4a44'},{t:'door',x:-.4,w:.9,c:'#6b4a3a'},{t:'window',x:2,w:1.6,grille:true,frame:'#6b4a3a'},{t:'window',x:4.8,w:1.6,grille:true,frame:'#6b4a3a'}]},walk:'cimento'},
  {side:'N',s0:90,s1:91.5,f:{wall:'#c9c4b8',wallOnly:true,front:{h:2,c:'#c9c4b8',gates:[{t:'gate',x:0,w:1.2,h:1.8,c:'#7a4a2e'}]}}},
  // Igreja Santos Reis: cream chapel, portico of three arches, cross on the gable
  {side:'N',s0:91.5,s1:105,f:{sign:{text:'Igreja Santos Reis',bg:'#f4f2ec',fg:'#2c3e66',x:2,y:3.7,w:2.6,h:.8},wall:'#ecd29e',roof:'gable',roofColor:'#d9c08e',fascia:'#ecd29e',eave:.2,setback:3,d:20,
    open:[{t:'arch',x:-3.6,w:2.2,h:2,y:0,c:'#6b3a2a'},{t:'arch',x:-.6,w:2.2,h:2,y:0,c:'#6b3a2a'},{t:'arch',x:2.4,w:2.2,h:2,y:0,c:'#6b3a2a'},
      {t:'window',x:5.2,w:.6,h:1.6,y:1.2}]},walk:'cimento'},
  // plant shop behind a mesh gate, black shade cloth over it
  {side:'N',s0:106.5,s1:110.5,f:{sign:{text:'TERRA AFORA',bg:'#efefea',fg:'#4a5a3a',x:0,y:2.5,w:3.4,h:.7},wall:'#c9c98a',roof:'flat',fascia:'#2a2a2c',eave:.4,d:8,
    open:[{t:'gate',x:0,w:3,h:2.2,c:'#4a6a4a',grille:true}]}},
  {side:'N',s0:110.5,s1:117.5,f:{wall:'#c9c98a',wallOnly:true,front:{h:3,c:'#c9c98a'},plinth:{h:.3,c:'#3a4f7a'}}},
  {side:'N',s0:117.5,s1:130.3,f:{wall:'#c9c4b8',wallOnly:true,front:{h:.5,c:'#c9c4b8',rail:{h:1.2,style:'bars',c:'#4a4a4a'}},
    behind:{w:10,d:10,at:3,roof:'flat',roofColor:'#2a2a2c',wall:'#3a3a3c'}}},
  {side:'N',s0:130.3,s1:132.2,f:{wall:'#e9e8e4',wallOnly:true,front:{h:2,c:'#e9e8e4',gates:[{t:'gate',x:0,w:1.4,h:1.9,c:'#e9e8e4',grille:true}]}}},
  {side:'N',s0:132.2,s1:141.3,f:{wall:'#8a7468',roof:'gable',roofColor:'#b9bcbe',fascia:'#e9e8e4',eave:.8,plinth:{h:.15,c:'#e9e8e4'},
    open:[{t:'window',x:-2.4,w:1.6,shutters:'#f2f2ee',frame:WHITE},{t:'window',x:2.2,w:1.8,grille:true,frame:WHITE}]}},
  {side:'N',s0:141.3,s1:143.5,f:{wall:'#c9b8a8',wallOnly:true,front:{h:2.2,c:'#c9b8a8',gates:[{t:'gate',x:0,w:1.2,h:2,c:'#e9e8e4',grille:true}]}}},
  // the ruined wall of the corner: exposed brick between plaster pillars, trees over it
  {side:'N',s0:143.5,s1:159.1,f:{wall:'#c98a68',wallOnly:true,front:{h:2.2,c:'#c98a68',style:'panel'},plinth:{h:.3,c:'#8a7a6a'}}},
  // ---------------- block C, south side ----------------
  {side:'S',s0:82.8,s1:91.3,f:{floors:2,wall:'#b8673f',roof:'hip',roofColor:TILE,balcony:{x:0,w:8,fl:1,rail:'white',depth:1.4},
    open:[{t:'arch',x:-1.8,w:2.6,h:2,y:0,c:'#2a2a2c'},{t:'arch',x:1.4,w:2.6,h:2,y:0,c:'#2a2a2c'},
      {t:'arch',x:-2,w:1.2,h:1.2,y:.8,fl:1,frame:WHITE},{t:'arch',x:1.6,w:1.2,h:1.2,y:.8,fl:1,frame:WHITE}]},walk:'ceramica'},
  // (s 91–108: the Adriana Modas building, comercio/lojas.ts)
  {side:'S',s0:108.2,s1:117.5,f:{wall:'#9a8f80',wallOnly:true,front:{h:2.2,c:'#9a8f80',gates:[{t:'gate',x:-1,w:2.6,c:'#9aa0a3'}]},
    behind:{w:7,d:9,at:4,floors:2,roofColor:TILE,wall:'#d9b3a8'}}},
  {side:'S',s0:117.5,s1:132.9,f:{floors:2,wall:'#f1efea',roof:'hip',roofColor:TILE,setback:3,
    panels:[{x:-2,w:7,c:'#b8673f',y0:0,y1:6}],balcony:{x:-2,w:6,fl:1,rail:'white'},
    front:{h:1.8,c:'#c07048',gates:[{t:'gate',x:-4,w:1.6,c:'#f2f2ee',grille:true}]},
    open:[{t:'arch',x:3.4,w:.8,h:1.2,y:.6,fl:1,frame:WHITE},{t:'door',x:-2,w:1.6,fl:1,c:'#6b3a2a'}]}},
  // empty lot: dirt and grass behind a low block wall
  {side:'S',s0:132.9,s1:140.6,f:{wall:'#9a948a',wallOnly:true,front:{h:.8,c:'#8f8a80'}},walk:'cimento'},
  {side:'S',s0:140.6,s1:151,f:{wall:'#d7c3c6',wallOnly:true,front:{h:2.2,c:'#d7c3c6',gates:[{t:'door',x:2.6,w:.9,c:'#c9b3b6'}]},
    behind:{w:8,d:9,at:3,roofColor:TILE,wall:'#e9dfe0'}}},
  {side:'S',s0:151,s1:159.1,f:{floors:2,wall:'#b88f8a',upper:'#ddd0d4',roof:'hip',roofColor:TILE,
    open:[{t:'window',x:-2.8,w:1.4,grille:true,frame:'#ece6e6'},{t:'door',x:-.4,w:1.1,c:'#9aa0a3'},{t:'window',x:2.6,w:1.6,grille:true,frame:'#ece6e6'},
      {t:'window',x:-1.6,w:2.2,fl:1,shutters:'#4a5560'},{t:'window',x:2.4,w:1.8,fl:1,shutters:'#4a5560'}]},walk:'ceramica'},
  // ---------------- block F (Espírito Santo → Francisco Pereira de Souza), north side ----------------
  // exposed-brick corner house with a porch of arches behind an iron fence
  {side:'N',s0:371,s1:388,f:{wall:'#b8673f',roof:'gable',roofColor:'#6e4a3a',fascia:'#4a3226',eave:1.1,setback:2.5,plinth:{h:.4,c:'#ece9e2'},
    front:{h:.6,c:'#e9e6df',rail:{h:1.2,style:'bars',c:'#3a3c3e'}},
    open:[{t:'window',x:-5.5,w:1.8,h:1.4,shutters:'#4a5560',frame:WHITE},{t:'arch',x:-1,w:1.3,h:1.6,y:.6,c:'#7a3a2a',frame:WHITE},
      {t:'door',x:1,w:1,c:'#7a3a2a'},{t:'arch',x:3,w:1.3,h:1.6,y:.6,c:'#7a3a2a',frame:WHITE},{t:'arch',x:5.2,w:1.3,h:1.6,y:.6,frame:WHITE}]},walk:'mosaico'},
  {side:'N',s0:388,s1:392,f:{wall:'#e9e8e4',wallOnly:true,front:{h:2.6,c:'#e9e8e4',style:'stone',gates:[{t:'garage',x:.3,w:2.8,c:'#f4f4f2'}]}}},
  {side:'N',s0:392,s1:398.4,f:{wall:'#ecebe7',wallOnly:true,front:{h:2.6,c:'#ecebe7'},behind:{w:6,d:9,at:3,roofColor:TILE,wall:'#b8673f'}}},
  // empty lot behind an old whitewashed wall, sheds over it
  {side:'N',s0:398.4,s1:413,f:{wall:'#e6e1d3',wallOnly:true,front:{h:1.5,c:'#e4e0d4',gates:[{t:'gate',x:-1.8,w:5.4,h:1.5,c:'#c9cdcf'}]},
    behind:{w:9,d:6,at:5,roof:'flat',roofColor:'#8f8b84',wall:'#a8a39a'}}},
  {side:'N',s0:413,s1:416,f:{wall:'#a99a94',wallOnly:true,front:{h:2.2,c:'#a99a94',style:'stone',gates:[{t:'gate',x:0,w:1.2,c:'#7a4a2e'}]}}},
  {side:'N',s0:416,s1:423.5,f:{wall:'#a99a94',roof:'hip',roofColor:TILE,fascia:'#a99a94',
    open:[{t:'gate',x:.4,w:5,h:2.4,c:'#7a6a62',grille:true}]},walk:'cimento'},
  {side:'N',s0:423.5,s1:428,f:{wall:'#6f6a62',wallOnly:true,front:{h:2.4,c:'#8a857c',gates:[{t:'gate',x:0,w:3,h:2,c:'#c9cdcf',grille:true}]}}},
  {side:'N',s0:428,s1:441,f:{wall:'#ecd2bf',roof:'gable',roofColor:TILE,setback:1.5,
    front:{h:.8,c:'#e3c7b4',rail:{h:1,style:'bars',c:'#c98a7a'}},
    open:[{t:'garage',x:-3,w:2.8,c:'#c97a5e'},{t:'arch',x:2,w:2,h:1.6,y:.3},{t:'window',x:4.6,w:1.2,frame:WHITE}]}},
  // modern house: dark grey with a tall panel of stone mosaic, white door and garage
  {side:'N',s0:441,s1:455.3,f:{wall:'#5f6266',roof:'gable',roofColor:'#d5d6d4',fascia:'#f2f2f0',
    panels:[{x:-.2,w:3.4,c:'#8a6a40',y0:0,y1:4.6},{x:-2.3,w:.6,c:'#8d9094',y0:0,y1:2.6}],
    open:[{t:'door',x:-3.6,w:1.1,c:'#f4f4f2'},{t:'garage',x:3.8,w:3.4,h:2.2,c:'#f4f4f2'}]},walk:'cimento'},
  // the painted wall of the corner (office sign)
  {side:'N',s0:455.3,s1:462.3,f:{wall:'#f4f3ef',wallOnly:true,front:{h:2.2,c:'#f4f3ef'}}},
  // ---------------- block F, south side ----------------
  {side:'S',s0:371,s1:385,f:{floors:2,wall:'#d8c4c4',roof:'flat',fascia:'#e6d8d6',eave:.7,balcony:{x:0,w:13,fl:1,rail:'iron',depth:1.2},
    open:[{t:'shop',x:2.6,w:3,c:'#1c1c1e'},{t:'garage',x:-2.6,w:3.4,c:'#232325'},{t:'door',x:-5.4,w:.9,c:'#2a2a2c'},
      {t:'door',x:2.6,w:1.8,fl:1,c:'#4a3226'},{t:'door',x:-2.6,w:1.8,fl:1,c:'#4a3226'}]},walk:'cimento'},
  {side:'S',s0:386,s1:402,f:{floors:2,wall:'#efede8',roof:'hip',roofColor:TILE,setback:5,
    front:{h:.5,c:'#e9e6df',rail:{h:1.6,style:'bars',c:'#f8f8f6'},gates:[{t:'door',x:-5,w:1.1,c:'#f4f4f2'}]},
    balcony:{x:2,w:6,fl:1,rail:'white'},open:[{t:'window',x:2,w:2.4,fl:1,frame:WHITE},{t:'glass',x:-2,w:3,frame:WHITE}]},walk:'ceramica'},
  {side:'S',s0:402,s1:417.8,f:{floors:2,wall:'#e8d9c0',upper:'#d9c9c4',roof:'hip',roofColor:TILE,
    balcony:{x:-3.5,w:7,fl:1,rail:'white',depth:1.4},
    open:[{t:'garage',x:-4.5,w:3.2,c:'#efe3c8'},{t:'garage',x:-.6,w:3.2,c:'#efe3c8'},{t:'door',x:2.4,w:1,c:'#efe3c8'},
      {t:'window',x:5,w:1.4,h:1.6,y:.8,frame:WHITE},{t:'door',x:-3.5,w:1.8,fl:1,c:'#7a4a2e'},{t:'window',x:3,w:1.6,fl:1,frame:WHITE}]},walk:'ladrilho'},
  {side:'S',s0:417.8,s1:427,f:{floors:2,wall:'#b9b2ac',roof:'hip',roofColor:TILE,setback:2,
    front:{h:.3,c:'#e9e6df',rail:{h:1.6,style:'bars',c:'#f8f8f6'},gates:[{t:'gate',x:1.6,w:1.2,c:'#f8f8f6'}]},
    balcony:{x:1.8,w:5.4,fl:1,rail:'white'},
    open:[{t:'arch',x:-2.4,w:1,h:1.4,y:.8,c:'#5a3a2a',frame:WHITE},{t:'arch',x:-.8,w:1,h:1.4,y:.8,c:'#5a3a2a',frame:WHITE},
      {t:'arch',x:1.6,w:1.4,h:2,y:0},{t:'arch',x:3.4,w:1.4,h:2,y:0},{t:'window',x:-1.6,w:1.4,fl:1,shutters:'#5a3a2a',frame:WHITE},{t:'door',x:2,w:1.4,fl:1,c:'#5a3a2a'}]},walk:'ceramica'},
  // the white warehouse with the green dado, along the whole rest of the block
  {side:'S',s0:427,s1:462.3,f:{wall:'#f1f0ec',roof:'flat',parapet:true,plinth:{h:1.1,c:'#2a9a52'},d:16,
    open:[{t:'window',x:-14,w:1.6,h:1.4,y:1.8,grille:true},{t:'door',x:-11,w:1.4,h:2.6,c:'#e6e6e2',awning:'#2a9a52'},{t:'window',x:-8,w:1.6,h:1.4,y:1.8,grille:true},
      {t:'window',x:-3,w:1.6,h:1.4,y:1.8,grille:true},{t:'door',x:1,w:1.4,h:2.6,c:'#e6e6e2',awning:'#2a9a52'},{t:'window',x:5,w:1.6,h:1.4,y:1.8,grille:true},
      {t:'window',x:9,w:1.4,h:1.4,y:1.8,grille:true},{t:'door',x:12,w:1.4,h:2.6,c:'#e6e6e2',awning:'#2a9a52'},{t:'window',x:15.4,w:1.4,h:1.4,y:1.8,grille:true}]}},
  // ---------------- block B, south side ----------------
  {side:'S',s0:20.5,s1:34,f:{wall:'#8f9396',roof:'hip',roofColor:TILE,fascia:WHITE,setback:4,
    front:{h:1.4,c:'#a8906e'},open:[{t:'window',x:-3,w:1.6,shutters:'#f2f2ee'},{t:'window',x:0,w:1.6,shutters:'#f2f2ee'},{t:'window',x:3.2,w:1.2,frame:WHITE}]}},
  {side:'S',s0:34,s1:38,f:{wall:'#a8906e',wallOnly:true,front:{h:1.4,c:'#a8906e'}}},
  // nº 43: beige wall with brown gates, the house behind under a tiled canopy
  {side:'S',s0:38,s1:45.5,f:{wall:'#ddd0bd',wallOnly:true,front:{h:2.4,c:'#ddd0bd',gates:[{t:'door',x:2.4,w:1.1,h:2.2,c:'#5a3e2e'},{t:'gate',x:-1.4,w:4,h:2.3,c:'#5a3e2e'}]},
    behind:{w:6,d:9,at:3,roof:'flat',roofColor:'#8f8b84',wall:'#e6dccb'}}},
  {side:'S',s0:45.5,s1:49,f:{wall:'#a8573c',wallOnly:true,front:{h:2.2,c:'#a8573c'}}},
  // a bank of candelabra cactus over the embankment
  {side:'S',s0:49,s1:61.5,f:{wall:'#a8906e',wallOnly:true,front:{h:3.4,style:'hedge'}}},
  // pink corner house on São José: porch of pillars on the corner, brown gate
  {side:'S',s0:61.5,s1:66,f:{wall:'#de9a8c',roof:'hip',roofColor:TILE,setback:1.2,front:{h:.9,c:'#d98f80'},
    open:[{t:'arch',x:-.7,w:2.2,h:2.3,y:0},{t:'window',x:1.5,w:1,frame:'#7a4a2e'}]},walk:'cimento'},
  // ---------------- block G (Francisco Pereira de Souza → Joaquim Garcia), north side ----------------
  // pet shop on the corner: cream with brown pillars, a long white sign band, shop windows
  {side:'N',s0:474,s1:490.2,f:{sign:{text:'IMPÉRIO DOS ANIMAIS',bg:'#f4f4f2',fg:'#5a3a2a',x:0,y:3.4,w:6,h:.8},wall:'#efe3c6',roof:'flat',parapet:true,band:'#f4f4f2',
    panels:[{x:-7.6,w:.8,c:'#6b3f2a'},{x:-3.4,w:.8,c:'#6b3f2a'},{x:3,w:.8,c:'#6b3f2a'},{x:7.6,w:.8,c:'#6b3f2a'}],
    open:[{t:'shop',x:-5.5,w:2.6,c:'#2a2c2e'},{t:'shop',x:-.2,w:3.6,c:'#2a2c2e'},{t:'shop',x:5.3,w:3,c:'#2a2c2e'}]},walk:'ceramica'},
  {side:'N',s0:490.2,s1:497.6,f:{wall:'#b8a39c',roof:'hip',roofColor:TILE,setback:1.5,
    front:{h:1.2,style:'stone',c:'#b8a39c',gates:[{t:'gate',x:-2,w:2.6,h:1.8,c:'#f2f2ee',grille:true}]},
    open:[{t:'window',x:1.4,w:1.2,shutters:'#e9e6df',frame:WHITE}]}},
  {side:'N',s0:497.6,s1:500.5,f:{wall:'#c9c4b8',wallOnly:true,front:{h:.4,c:'#c9c4b8',rail:{h:1.3,style:'bars',c:'#6a6c6e'}}}},
  {side:'N',s0:500.5,s1:504.4,f:{wall:'#f2f1ee',roof:'flat',fascia:'#f2f1ee',setback:3,
    front:{h:1.6,c:'#f2f1ee',gates:[{t:'garage',x:.3,w:2.6,h:2.3,c:'#f6f6f4'}]},open:[{t:'window',x:0,w:1.4,frame:WHITE}]},walk:'mosaico'},
  {side:'N',s0:504.4,s1:513,f:{wall:'#e9d9b9',roof:'hip',roofColor:TILE,setback:2,
    front:{h:.6,c:'#e9d9b9',rail:{h:1,style:'bars',c:'#9a8a7a'}},open:[{t:'window',x:-2,w:1.4,frame:WHITE},{t:'door',x:1.4,w:1,c:'#7a4a2e'}]}},
  {side:'N',s0:513,s1:518.8,f:{wall:'#e9d9b9',roof:'hip',roofColor:TILE,open:[{t:'door',x:0,w:1,c:'#7a4a2e'}]}},
  {side:'N',s0:518.8,s1:527.3,f:{wall:'#efe0bf',roof:'hip',roofColor:TILE,setback:1,panels:[{x:-3,w:2.2,stone:true,y0:0,y1:2.6}],
    open:[{t:'garage',x:1,w:4.6,h:2.4,c:'#8a5a3e'},{t:'door',x:-3.4,w:.9,c:'#7a4a2e'}]}},
  // white house with an arched porch and a stone chimney, behind a fence of white pillars
  {side:'N',s0:527.3,s1:543,f:{wall:'#f2f0eb',roof:'gable',roofColor:TILE,fascia:'#8a4a32',eave:.9,setback:4,
    front:{h:.6,c:'#e9e3d6',rail:{h:1.1,style:'bars',c:'#8a7a6a'}},
    panels:[{x:5.6,w:1.4,stone:true,y0:0,y1:4.4}],
    open:[{t:'arch',x:-3.4,w:2.8,h:2,y:0},{t:'arch',x:0,w:2.8,h:2,y:0},{t:'arch',x:3.4,w:1,h:1.2,y:.9,frame:'#8a4a32'}]}},
  {side:'N',s0:543,s1:546.5,f:{wall:'#c9a080',wallOnly:true,front:{h:2.4,c:'#c9a080',gates:[{t:'gate',x:.6,w:1.8,h:2.2,c:'#6b4a32'}]}}},
  // the long corner house: cream over a brown roughcast dado, door on the cut corner
  {side:'N',s0:546.5,s1:562.7,f:{wall:'#efe6d2',roof:'hip',roofColor:TILE,fascia:WHITE,eave:.8,plinth:{h:1.5,c:'#b87a4a'},
    open:[{t:'window',x:-5.4,w:1.6,grille:true,frame:'#7a4a2e'},{t:'window',x:-3,w:1.6,grille:true,frame:'#7a4a2e'},{t:'door',x:-.4,w:.9,c:'#7a4a2e'},
      {t:'window',x:1.8,w:1.2,shutters:'#8a5a3a'},{t:'window',x:4,w:1.2,shutters:'#8a5a3a'},{t:'window',x:5.8,w:.8},{t:'door',x:7.3,w:.9,c:'#5a3a2a'}]},walk:'ceramica'},
  // ---------------- block G, south side ----------------
  {side:'S',s0:473.9,s1:495,f:{wall:'#dcd8d1',roof:'hip',roofColor:TILE_DARK,fascia:WHITE,plinth:{h:1.1,c:'#c9c4bb'},
    open:[{t:'window',x:-6,w:1.6,shutters:'#eceae6',frame:WHITE},{t:'window',x:-2.6,w:1.6,shutters:'#eceae6',frame:WHITE},
      {t:'window',x:.6,w:.8,frame:WHITE},{t:'window',x:2,w:.8,frame:WHITE},{t:'window',x:4.6,w:1.4,shutters:'#eceae6',frame:WHITE},
      {t:'gate',x:8.6,w:2.6,h:2.2,c:'#f6f6f4',grille:true}]},walk:'mosaico'},
  {side:'S',s0:495,s1:506,f:{wall:'#cfd0d0',wallOnly:true,front:{h:2.6,c:'#cfd0d0',style:'panel'}}},
  {side:'S',s0:506,s1:511,f:{wall:'#dcd8d1',roof:'flat',fascia:'#efede8',setback:1,open:[{t:'gate',x:.4,w:2.2,h:2.3,c:'#4a3a30'}]}},
  {side:'S',s0:511,s1:526.3,f:{floors:2,wall:'#f0eee9',roof:'gable',roofColor:TILE,setback:4,
    panels:[{x:1,w:4,c:'#c0603e',y0:3,y1:6}],balcony:{x:1,w:4,fl:1,rail:'iron'},
    front:{h:.6,c:'#c0603e',rail:{h:1.4,style:'bars',c:'#3a3230'},gates:[{t:'gate',x:-4,w:3.4,c:'#3a3230'}]},
    open:[{t:'glass',x:1,w:3,frame:'#3a3230'},{t:'window',x:1,w:1.6,fl:1,frame:'#3a3230'}]}},
  {side:'S',s0:526.3,s1:534.5,f:{wall:'#e4e2de',roof:'hip',roofColor:TILE,plinth:{h:1.3,c:'#bcb9b2'},
    open:[{t:'window',x:-2.4,w:2,grille:true,frame:WHITE},{t:'window',x:1.2,w:2,shutters:'#5a4a3e',frame:WHITE}]}},
  {side:'S',s0:534.5,s1:539.8,f:{wall:'#c9c6c0',roof:'hip',roofColor:TILE,setback:1.5,open:[{t:'garage',x:.3,w:2.6,c:'#6b4a32'},{t:'door',x:-1.9,w:.8,c:'#6b4a32'}]}},
  {side:'S',s0:539.8,s1:546.3,f:{wall:'#9e9a92',wallOnly:true,front:{h:2.4,c:'#9e9a92',style:'panel'}}},
  // two storeys: dark granite-clad street floor, cream above, brick panel on the corner
  {side:'S',s0:546.3,s1:562.7,f:{floors:2,wall:'#6c6a66',upper:'#ecdcc0',roof:'gable',roofColor:TILE,
    panels:[{x:-7.4,w:1.4,c:'#b8673f',y0:3,y1:6}],
    open:[{t:'window',x:-5.6,w:.9,h:.6,y:1.6,frame:'#f2f2ee'},{t:'window',x:-4,w:1.2,h:.6,y:1.6,frame:'#f2f2ee'},{t:'garage',x:-1,w:2.6,c:'#efe6d2'},
      {t:'door',x:1.6,w:.9,c:'#efe6d2'},{t:'window',x:3.6,w:1.4,h:.7,y:1.4,frame:'#efe6d2'},{t:'window',x:6,w:1.4,h:.7,y:1.4,frame:'#efe6d2'},
      {t:'window',x:-3,w:1.4,fl:1,shutters:'#efe6d2',frame:WHITE},{t:'window',x:-.6,w:.7,fl:1},{t:'window',x:1,w:.7,fl:1},{t:'window',x:4.6,w:1.4,fl:1,shutters:'#efe6d2'}]},walk:'cimento'},
];
export const TREES:Tree[]=[
  {side:'S',s:178,kind:'ficus'},{side:'S',s:256,kind:'ficus'},
  {side:'S',s:342,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:12,every:33},
  keepOut:[{side:'N',s0:180,s1:200,why:'clothes shop (sites-table.ts clothes)'}],
};
