// Rua Sete de Setembro — surveyed lot by lot from Google Street View (2024–2026 imagery; one
// view aimed at each ~8 m of lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/7s-N-*/ and 7s-S-*/, kept out of git). 596 m from
// the west end (s = 0, the corner of Rua João Cabrera / Manoel Pereira de Souza) along the
// south side of both Matriz squares to the Rua Bernadino Franchi:
//   s=72 R. Barão do Rio Branco   s=146 R. Leonor Mendes de Barros / the squares
//   s=246 R. Francisco Pereira de Souza   s=342 R. Joaquim Garcia   s=448 R. Campos Salles
// Asphalt on the first block, granite setts from the Barão do Rio Branco to the Campos
// Salles, asphalt again down the hill to the end. Left alone (their own models): the squares
// (praca-ladislau.ts, praca-alcindo.ts), the Zeza Magazine on the Campos Salles corner
// (comercio/lojas.ts), the Centro Pastoral João Paulo II (galpoes.ts) and the Centro de Saúde
// III (publicos.ts). Past the Campos Salles the street drops along an empty red-earth bank
// (north) and a pasture (south), each behind a low concrete wall.
// `s` along the OSM centreline, side N/S, opening x from the lot centre as SEEN FROM THE
// STREET (left negative). Lot depth (d + setback) ≤ 12 m. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Sete de Setembro';
export const CROSS=[0,72.2,145.9,245.6,341.6,447.6,596.4];
const SURFACE:Surface[]=[[0,72.2,'asphalt'],[72.2,448,'sett'],[448,600,'asphalt']];
const T='#b0603f',TD='#8e4632',W='#f2f2ee',VINHO='#7a2f2a';

// a lot whose front stands back keeps its body within the 12 m band
const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
// a low concrete wall along the sidewalk with nothing behind it (banks, pasture)
const mureta=(side:'N'|'S',s0:number,s1:number,h=.8):Lot=>({side,s0,s1,f:{wallOnly:true,wall:'#8e8a82',d:1,front:{h,c:'#8e8a82'}}});

export const LOTS:Lot[]=[
  // ================= NORTH SIDE =================
  // --- Manoel P. de Souza → Barão do Rio Branco: the CRAS, then a long white wall
  L('N',4.5,34,{wall:'#e29aae',roof:'hip',roofColor:T,setback:5,
    front:{h:1.3,c:'#e3a6b5',rail:{h:1.1,c:W,style:'bars'},gates:[{t:'gate',x:-11,w:3,c:'#e9ecee'}]},
    open:[{t:'window',x:-6,w:1.6,grille:true},{t:'door',x:-1,w:1.2,c:'#4f6db0'},{t:'window',x:4,w:1.6,grille:true},{t:'window',x:9,w:1.6,grille:true}],
    sign:{text:'CRAS · CASA DAS FAMÍLIAS',bg:'#f2f2ee',fg:'#2a3c7a',x:-11,y:3.2,w:4.4,h:1.1}},'pedra'),
  // (the long white wall is the back of the Delegacia's yard: its building stands 6.6 m in, publicos.ts)
  L('N',34,52,{wallOnly:true,wall:'#e9e6df',d:4,front:{h:2.5,c:'#e3e0d8'}},'cimento'),
  L('N',52,68,{wallOnly:true,wall:'#e9e6df',d:4,front:{h:2.4,c:'#e6e3dc'}},'cimento'),
  // --- the squares (s 72–246) draw their own pavements
  // --- Francisco Pereira de Souza → Joaquim Garcia
  L('N',249.6,262,{wall:'#efe6d3',roof:'gable',roofColor:T,fascia:'#f4efe4',eave:.7,setback:3,plinth:{h:.5,c:VINHO},
    front:{h:.8,c:VINHO,rail:{h:1,c:VINHO,style:'bars'},gates:[{t:'gate',x:4.8,w:1.4,c:VINHO}]},
    open:[{t:'door',x:-1.8,w:1.1,c:'#6a4630'},{t:'window',x:1.2,w:1.4},{t:'window',x:-4.6,w:1.3}]}),
  L('N',262,270.5,{wall:'#f0e9dc',roof:'hip',roofColor:T,setback:2.5,plinth:{h:.6,c:VINHO},
    front:{h:.9,c:VINHO,rail:{h:1,c:VINHO,style:'bars'}},open:[{t:'window',x:-1.5,w:1.4},{t:'door',x:2,w:1,c:'#6a4630'}]}),
  L('N',270.5,279,{wall:'#f3ede1',roof:'hip',roofColor:T,plinth:{h:1.1,c:VINHO},
    open:[{t:'window',x:-1.8,w:1.5,shutters:'#6a4630'},{t:'window',x:1.9,w:1.4,grille:true}]}),
  L('N',279,286,{wall:'#f3ede1',roof:'hip',roofColor:T,plinth:{h:1.1,c:VINHO},
    open:[{t:'garage',x:-.6,w:2.8,c:'#8e3b2c'},{t:'window',x:2.4,w:1,grille:true}]}),
  L('N',286,298,{wall:'#1f4a3a',roof:'gable',roofColor:TD,fascia:'#e8d9c0',eave:.8,setback:1.5,plinth:{h:.3,c:'#1a3a2e'},
    front:{h:1.8,c:'#1f4a3a',gates:[{t:'gate',x:3,w:3,c:'#1f4a3a'}]},
    open:[{t:'window',x:-3.4,w:1.4,frame:'#e8d9c0'},{t:'window',x:-.6,w:1.8,frame:'#e8d9c0'}]}),
  L('N',298,306,{wall:'#d8d8d6',roof:'flat',parapet:true,panels:[{x:-3,w:1.4,c:'#2a2a2a',y0:0,y1:3},{x:1.2,w:1,c:'#2a2a2a',y0:0,y1:3},{x:3.4,w:1.2,c:'#e8e8e6',y0:0,y1:3}],
    open:[{t:'shop',x:-1.2,w:2.6,c:'#8e9193',awning:'#4f6b4a'},{t:'shop',x:2.2,w:2,c:'#4a3a32',awning:'#4f6b4a'}],
    sign:{text:'PERSONA SCREEN · UNIFORMES',bg:'#1a1a1a',fg:'#ffffff',x:-.6,y:3.1,w:6,h:1}}),
  L('N',306,314,{wall:'#2b2f3a',roof:'gable',roofColor:'#9a9a94',fascia:'#f2f2ee',eave:.8,
    open:[{t:'shop',x:1.6,w:2.2,c:'#3a3028',awning:'#d8d8d6'},{t:'window',x:-2.2,w:1.2,grille:true}],
    sign:{text:'MEGA LANCHES',bg:'#c8322c',fg:'#ffe24a',x:-1.6,y:2.6,w:2.6,h:.8}}),
  L('N',314,323,{wall:'#f2f0ea',roof:'hip',roofColor:T,
    open:[{t:'door',x:-2.8,w:1.2,c:'#1d1d1d'},{t:'door',x:.2,w:1.6,c:'#5b3a24'},{t:'door',x:2.6,w:1,c:'#ffffff'}],
    sign:{text:'MARMITARIA & RESTAURANTE',bg:'#f4f3ee',fg:'#3a3a3a',x:-1,y:2.8,w:6.6,h:.9}}),
  L('N',323,333.5,{wall:'#b8b2aa',roof:'hip',roofColor:'#8c8a86',setback:2,panels:[{x:-3.5,w:2.4,c:'#e8e4dc',stone:true}],
    front:{h:2.1,c:'#bdb7ae',gates:[{t:'gate',x:3.4,w:1.2,c:'#ffffff'}]},open:[{t:'window',x:0,w:2.4,frame:'#ffffff'}]}),
  L('N',333.5,337.6,{wall:'#d9d4cc',roof:'hip',roofColor:'#8c8a86',setback:2.5,
    front:{h:1.8,c:'#c9c4bc',gates:[{t:'gate',x:0,w:2,c:'#5f8f7a'}]},open:[{t:'glass',x:0,w:2.6}]}),
  // --- Joaquim Garcia → Campos Salles
  L('N',345.6,362,{wall:'#f2f0ea',roof:'flat',parapet:true,plinth:{h:1.2,c:'#1c1c1c'},
    panels:[{x:-4,w:7,c:'#e8833a',y0:.5,y1:2.4}],open:[{t:'gate',x:4.8,w:3,c:'#1c1c1c'}],
    sign:{text:'BAR RECOMEÇO · PORÇÕES · LANCHES',bg:'#e8833a',fg:'#1c1c1c',x:-4,y:1.4,w:7,h:1}}),
  L('N',362,371,{wall:'#f0eee8',roof:'flat',parapet:true,plinth:{h:1.1,c:'#1c1c1c'},band:'#e8a07a',
    open:[{t:'window',x:-2,w:1.6},{t:'door',x:2.6,w:1,c:'#9a9c9e'}]}),
  L('N',371,378,{wall:'#e9dcc2',roof:'hip',roofColor:T,open:[{t:'door',x:-1,w:1,c:'#8e9193'},{t:'window',x:1.8,w:1.2,grille:true}]}),
  L('N',378,387,{wall:'#e8dcc0',roof:'hip',roofColor:T,plinth:{h:.3,c:'#b8a888'},
    open:[{t:'gate',x:-2.6,w:2.4,c:'#3a3a3a'},{t:'glass',x:1.6,w:3.2,y:0,h:2.4,frame:'#1d1d1d',awning:'#2a2a2a'}]}),
  L('N',387,394,{wall:'#b0603f',roof:'hip',roofColor:T,setback:1,front:{h:.4,c:'#b0603f',rail:{h:1.4,c:'#4a4a4a',style:'bars'}},
    open:[{t:'open',x:0,w:4,c:'casa'}]}),
  L('N',394,401,{wall:'#e2cfa8',roof:'hip',roofColor:T,open:[{t:'garage',x:-.8,w:2.8,c:'#f2f2ee'},{t:'window',x:2.2,w:1.2,grille:true}]}),
  L('N',401,410,{wall:'#d9c29a',roof:'gable',roofColor:T,fascia:'#ffffff',eave:.6,
    open:[{t:'door',x:-3.4,w:1,c:'#ffffff'},{t:'window',x:-.8,w:2.4,grille:true,frame:'#ffffff'},{t:'door',x:1.5,w:.9,c:'#ffffff'}],
    sign:{text:'TechMize',bg:'#1a2a3a',fg:'#7fe0a0',x:3.2,y:1.1,w:1.6,h:1.1}}),
  L('N',410,416,{wall:'#4f74b8',roof:'hip',roofColor:T,setback:1.5,front:{h:2,c:'#c9b79a',style:'stone',gates:[{t:'gate',x:-1.2,w:2,c:'#e8e6e0'}]}}),
  L('N',416,421,{wall:'#f2f2ee',roof:'flat',parapet:true,plinth:{h:.5,c:'#1d1d1d'},open:[{t:'open',x:0,w:3,c:'geral'}],
    sign:{text:'PREV FÁCIL · CONSULTORIA',bg:'#2a4f9a',fg:'#ffffff',x:0,y:2.7,w:4.4,h:.9}}),
  L('N',421,428,{wall:'#f2f2ee',roof:'hip',roofColor:T,setback:3,front:{h:.4,c:'#e8e6e0',rail:{h:1.3,c:W,style:'bars'}},open:[{t:'window',x:-1,w:1.4,grille:true}]}),
  // --- Campos Salles → the end: the white corner house, the precast wall, then the bank
  L('N',451.6,462,{wall:'#f0eee8',roof:'hip',roofColor:TD,plinth:{h:1,c:'#8fa0b0'},
    open:[{t:'window',x:-2.4,w:1.6,shutters:'#7d8a96'},{t:'window',x:2.6,w:1.5,shutters:'#7d8a96'}]}),
  L('N',462,482,{wallOnly:true,wall:'#a9a7a0',front:{h:2.2,c:'#a9a7a0',style:'panel',gates:[{t:'gate',x:-6,w:3,c:'#e8e8e4'}]},
    behind:{floors:3,wall:'#e5d9bf',roofColor:'#9a9a94',roof:'flat',at:7,d:10}}),
  mureta('N',484,580,.7),

  // ================= SOUTH SIDE =================
  // --- Manoel P. de Souza → Barão do Rio Branco
  L('S',4.5,11,{wall:'#e3b5a3',roof:'hip',roofColor:T,setback:2.5,front:{h:2,c:'#c9a59a',gates:[{t:'gate',x:-3.2,w:1.2,c:'#f2f2ee'}]},
    open:[{t:'window',x:-1,w:1.4,grille:true},{t:'window',x:2.4,w:1.2,shutters:W}]}),
  L('S',11,22,{floors:2,wall:'#e2dfd8',upper:'#ece6dc',roof:'gable',roofColor:T,fascia:'#ffffff',setback:2,
    front:{h:.6,c:'#e2dfd8',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:-4,w:1.2,c:W}]},
    balcony:{x:0,w:9,fl:1,rail:'white'},
    open:[{t:'arch',x:-3,w:1.6,fl:1},{t:'arch',x:0,w:1.6,fl:1},{t:'arch',x:3,w:1.6,fl:1},{t:'glass',x:2,w:3,frame:W,grille:true},{t:'window',x:-2.6,w:1.4}]}),
  L('S',22,31,{wall:'#c99a9a',roof:'gable',roofColor:T,fascia:'#ffffff',setback:2,
    front:{h:1.6,c:'#c99a9a',style:'panel',rail:{h:.9,c:W,style:'bars'}},open:[{t:'window',x:-1.6,w:2,frame:W},{t:'window',x:1.8,w:1.3,shutters:'#d8c9a8'}]}),
  L('S',31,37,{floors:2,wall:'#a8743f',upper:'#d9a8a8',roof:'gable',roofColor:T,fascia:'#ffffff',band:'#f2f2ee',
    balcony:{x:0,w:3,fl:1,rail:'white'},open:[{t:'garage',x:0,w:2.6,c:'#f2f2ee'},{t:'window',x:0,w:1.6,fl:1}]}),
  L('S',37,46,{wall:'#b07a3e',roof:'hip',roofColor:T,band:'#f2f2ee',open:[{t:'window',x:1.6,w:1.4,shutters:'#6a4630'},{t:'gate',x:-2.6,w:2.6,c:'#5a5048'}]}),
  L('S',46,58,{floors:2,wall:'#c9cbcc',roof:'flat',parapet:true,plinth:{h:.4,c:'#a9abac'},open:[{t:'door',x:-1.4,w:1,c:'#e6dcc6'},{t:'window',x:-1,w:2.2,fl:1,shutters:'#d8d6d0'}]}),
  L('S',58,68,{floors:2,wall:'#8a7a68',upper:'#8a7a68',roof:'flat',parapet:true,panels:[{x:0,w:11,stone:true}],
    balcony:{x:-1.5,w:6,fl:1,rail:'white'},open:[{t:'glass',x:-2,w:3.4,frame:W,grille:true},{t:'garage',x:3.4,w:2.4,c:'#e9e6df'},{t:'window',x:3.4,w:1.4,fl:1}]}),
  // --- Barão do Rio Branco → Leonor Mendes de Barros
  L('S',76.5,90,{floors:2,wall:'#e2d6c0',upper:'#e2d6c0',roof:'flat',parapet:true,balcony:{x:-3.4,w:4,fl:1,rail:'iron'},
    open:[{t:'door',x:-5,w:1,c:'#6a2a2e'},{t:'glass',x:1.4,w:2.6,frame:W,grille:true},{t:'window',x:-3.4,w:1.4,fl:1,shutters:'#6a3a2e'}]}),
  L('S',90,104,{floors:2,wall:'#e3d3b6',upper:'#e3d3b6',roof:'hip',roofColor:T,panels:[{x:-6.2,w:1.2,stone:true}],
    balcony:{x:1,w:11,fl:1,rail:'iron'},
    open:[{t:'garage',x:-1.8,w:3,c:'#6a3a24'},{t:'garage',x:3.2,w:2.8,c:'#6a3a24'},{t:'window',x:-4.4,w:1.2,grille:true},{t:'arch',x:-2,w:2.6,fl:1},{t:'arch',x:2.8,w:2.6,fl:1}]}),
  L('S',104,125,{wallOnly:true,wall:'#ddd7cb',front:{h:2.4,c:'#ddd7cb',style:'panel'}},'cimento'),
  L('S',125,141.9,{wallOnly:true,wall:'#ddd7cb',front:{h:1.4,c:'#4a465c',rail:{h:1.1,c:W,style:'bars'},gates:[{t:'gate',x:-3,w:1.4,c:'#4a4a4c'}]},
    behind:{floors:2,wall:'#eeeeea',roofColor:'#9a9a94',at:6,d:12,w:16}},'cimento'),
  // --- Leonor Mendes de Barros → Francisco Pereira de Souza (Centro Pastoral at 171–197)
  L('S',149.9,156,{floors:2,wall:'#f0eee8',upper:'#f0eee8',roof:'hip',roofColor:T,plinth:{h:1.5,c:'#6d6f72'},open:[{t:'window',x:-1.2,w:1.2},{t:'window',x:1.6,w:1.2,fl:1}]}),
  L('S',156,170,{wallOnly:true,wall:'#7a7a6a',front:{h:2.1,c:'#7d7d6a',style:'stone',gates:[{t:'gate',x:5,w:2.4,c:'#a8473a'}]},
    behind:{roofColor:T,wall:'#e9d6b8',at:5,d:9,w:10}}),
  L('S',197,211,{floors:2,wall:'#ece4d2',upper:'#ece4d2',roof:'flat',parapet:true,setback:1.5,
    front:{h:.8,c:'#6f7a64',rail:{h:1.2,c:W,style:'bars'},gates:[{t:'gate',x:-4,w:2.8,c:W}]},
    balcony:{x:0,w:13,fl:1,rail:'white'},open:[{t:'open',x:-4,w:3,c:'casa'},{t:'door',x:1,w:1,c:'#d8d2c2'},{t:'window',x:-3,w:1.6,fl:1},{t:'window',x:3,w:1.6,fl:1}]}),
  L('S',211,217,{floors:2,wall:'#a95a44',upper:'#ece4d2',roof:'flat',parapet:true,open:[{t:'door',x:1,w:1.4,c:'#1d1d1d'},{t:'window',x:0,w:2,fl:1,grille:true}]}),
  L('S',217,227,{floors:2,wall:'#a95a44',upper:'#ece4d2',roof:'flat',parapet:true,panels:[{x:-3.2,w:.7,c:'#2a2a2c'}],
    balcony:{x:-2,w:4,fl:1,rail:'iron'},open:[{t:'glass',x:-1.4,w:2.6,y:0,h:2.4,frame:'#1d1d1d'},{t:'shop',x:2.6,w:2.4,c:'#e9e6df'},{t:'window',x:2.6,w:1.6,fl:1,grille:true}],
    sign:{text:'CONDUTRAN · AUTOESCOLA',bg:'#ffffff',fg:'#e07a1a',x:-1.4,y:2.6,w:3.4,h:.6}}),
  L('S',227,236,{floors:2,wall:'#e9e6df',upper:'#e9e6df',roof:'flat',parapet:true,panels:[{x:-3.8,w:.5,c:'#8e9296'},{x:-2.4,w:.5,c:'#8e9296'}],
    open:[{t:'garage',x:1.6,w:2.8,c:'#6a3020'},{t:'window',x:0,w:2,fl:1,shutters:'#5a3a32'}]}),
  L('S',236,241.6,{floors:2,wall:'#9fa3a8',upper:'#c9cbcd',roof:'flat',parapet:true,
    open:[{t:'window',x:-1.2,w:1.6,shutters:W},{t:'door',x:2.4,w:1,c:'#3a3a3a'},{t:'window',x:0,w:2.2,fl:1,shutters:W}],
    sign:{text:'RN RENOVE',bg:'#f2f2ee',fg:'#2a2a2a',x:-3,y:1.2,w:1.4,h:1.2}}),
  // --- Francisco Pereira de Souza → Joaquim Garcia (Centro de Saúde III at 298–337)
  L('S',249.6,262,{wall:'#b9c3cc',roof:'hip',roofColor:T,plinth:{h:.9,c:'#8f969c'},
    open:[{t:'door',x:-3,w:1,c:'#3a3a3a',awning:'#c8322c'},{t:'window',x:-.8,w:1.4,grille:true},{t:'window',x:3.6,w:1.4,grille:true}],
    sign:{text:'EL BARBERO',bg:'#f2f2ee',fg:'#c8322c',x:1.4,y:1.2,w:1.8,h:.8}}),
  L('S',262,272,{wall:'#d9783a',roof:'hip',roofColor:T,setback:2.5,front:{h:.8,c:'#d98e6a',rail:{h:.9,c:W,style:'bars'},gates:[{t:'gate',x:1.8,w:1.2,c:'#d9783a'}]},
    open:[{t:'door',x:-1,w:1,c:'#7a4a2c'},{t:'window',x:2,w:1.2,grille:true}]}),
  L('S',272,282,{floors:2,wall:'#efe0c4',upper:'#efe0c4',roof:'hip',roofColor:T,plinth:{h:.9,c:'#d08a70'},
    open:[{t:'garage',x:-1.2,w:3.2,c:'#f2f2ee'},{t:'window',x:0,w:2.4,fl:1,frame:'#3a3a3a'}]}),
  L('S',282,289,{wall:'#a6aaad',roof:'flat',parapet:true,open:[{t:'shop',x:0,w:3.6,c:'#e8e8e6'}]}),
  L('S',289,296,{floors:2,wall:'#1d1d1d',upper:'#efe0c4',roof:'hip',roofColor:T,
    open:[{t:'glass',x:-.8,w:2.6,y:0,h:2.4,frame:W,grille:true},{t:'garage',x:3,w:2.4,c:'#f2f2ee'},{t:'window',x:-1.6,w:1.4,fl:1,shutters:W},{t:'window',x:1.6,w:1.4,fl:1,shutters:W}],
    sign:{text:'SISTEMAS E INFORMÁTICA',bg:'#1d1d1d',fg:'#ffffff',x:-1,y:2.6,w:4,h:.7}}),
  // --- Joaquim Garcia → Campos Salles
  L('S',345.6,361,{wall:'#efe3c4',roof:'hip',roofColor:T,plinth:{h:1.6,c:'#c9a548'},setback:1,
    front:{h:1.2,c:'#c9a548'},open:[{t:'open',x:-4,w:2.6,c:'casa'},{t:'window',x:2.4,w:1.2,shutters:'#8a6a44'}]}),
  L('S',361,370,{floors:2,wall:'#efe3c4',upper:'#efe3c4',roof:'flat',parapet:true,plinth:{h:.7,c:'#6a4630'},
    open:[{t:'garage',x:.6,w:3.6,c:'#e8e8e6',awning:'#9a9a94'},{t:'glass',x:0,w:4.6,fl:1,y:.3,h:1.8,frame:'#3a3a3a'}]}),
  L('S',370,378,{wallOnly:true,wall:'#c9a548',front:{h:2.1,c:'#c9a548'},behind:{roofColor:T,wall:'#efe3c4',at:4,d:8,w:7}}),
  L('S',378,388,{floors:2,wall:'#efe3c4',upper:'#efe3c4',roof:'flat',parapet:true,plinth:{h:1,c:'#7a4a2c'},
    open:[{t:'shop',x:-1.8,w:2.4,c:'#e6d8d8'},{t:'vitrine',x:2.2,w:2.6,c:'roupa'},{t:'glass',x:0,w:8,fl:1,y:.2,h:2.2,frame:'#1d1d1d'}],
    sign:{text:'MORENA FLOR · MODA ÍNTIMA',bg:'#8a5a44',fg:'#ffffff',x:.4,y:2.7,w:3,h:.6}}),
  L('S',388,394,{wall:'#d9cbb3',roof:'hip',roofColor:T,setback:3,front:{h:1.8,c:'#b9a48a',gates:[{t:'gate',x:1.4,w:2,c:'#5a5048'}]}}),
  L('S',394,404,{wall:'#d9cbb3',roof:'flat',parapet:true,setback:4,front:{h:1.7,c:'#b9a48a'},open:[{t:'open',x:0,w:6,c:'casa'}]}),
  L('S',404,410,{wallOnly:true,wall:'#c9c4bc',front:{h:2,c:'#c9c4bc',gates:[{t:'gate',x:1.2,w:2.2,c:'#4f5f78'}]},behind:{roofColor:T,wall:'#f0ebe0',floors:2,at:5,d:7,w:5}}),
  L('S',410,420,{wall:'#f2f0ea',roof:'hip',roofColor:TD,setback:5,front:{h:1.3,style:'hedge'},open:[{t:'window',x:-1,w:2.4},{t:'door',x:2.6,w:1,c:'#7a4a2c'}]}),
  L('S',420,432,{wallOnly:true,wall:'#9fa29c',front:{h:2.2,c:'#9fa29c',gates:[{t:'gate',x:-1,w:3.6,c:'#a97f86'}]},behind:{roofColor:T,wall:'#e9e4da',at:6,d:8}}),
  L('S',432,443.6,{wall:'#b9b8b2',roof:'flat',parapet:true,setback:1,front:{h:.3,c:'#9a9894',rail:{h:1.8,c:'#8e9296',style:'bars'},gates:[{t:'gate',x:-4.6,w:2,c:'#8e9296'}]},
    open:[{t:'gate',x:3.4,w:3,c:'#8a5a3a'}]}),
  // --- Campos Salles → the end: the pasture behind its low wall
  mureta('S',458,590,.9),
];

export const TREES:Tree[]=[
  {side:'N',s:56,kind:'ficus'},
  {side:'N',s:258,kind:'reseda'},{side:'N',s:266,kind:'reseda'},{side:'N',s:274,kind:'resedaBranca'},{side:'N',s:290,kind:'reseda'},
  {side:'N',s:385,kind:'reseda'},{side:'N',s:423,kind:'reseda'},
  {side:'S',s:113,kind:'resedaBranca'},{side:'S',s:130,kind:'resedaBranca'},{side:'S',s:138,kind:'reseda'},
  {side:'S',s:203,kind:'reseda'},{side:'S',s:265,kind:'reseda'},{side:'S',s:278,kind:'reseda'},
  {side:'S',s:414,kind:'ficus'},{side:'S',s:425,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  settStreets:['Rua Barão do Rio Branco','Rua Leonor Mendes de Barros','Rua Francisco Pereira de Souza','Rua Joaquim Garcia'],
  poles:{side:'S',start:18,every:35,transformers:[123,368]},
  keepOut:[
    {side:'N',s0:72.2,s1:245.6,why:'the Matriz squares (praca-ladislau.ts, praca-alcindo.ts)',walk:false},
    {side:'N',s0:428,s1:447.6,why:'Zeza Magazine on the Campos Salles corner (comercio/lojas.ts; its lot covers the red garage block too)'},
    {side:'S',s0:170.5,s1:197,why:'Centro Pastoral João Paulo II (galpoes.ts)'},
    {side:'S',s0:296,s1:341.6,why:'Centro de Saúde III (publicos.ts)'},
  ],
};
