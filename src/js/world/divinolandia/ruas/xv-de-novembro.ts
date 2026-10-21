// Rua XV de Novembro — surveyed lot by lot from Google Street View (2024–2026 imagery; one
// view aimed at each lot from the nearest panorama, local in
// docs/divinolandia/referencias-streetview/xv-N-*/ and xv-S-*/, kept out of git). The town's
// main street, 692 m from the west end (s = 0, a corner by the Rua Manoel Pereira de Souza)
// past the Prefeitura, along the north side of both Matriz squares, through the commercial
// centre to the Rua Lourival de Medeiros:
//   s=97 R. João Cabrera   s=166 R. João Cabral de Medeiros   s=218 R. Barão do Rio Branco
//   s=292 R. Espírito Santo / the squares   s=394 R. Francisco Pereira de Souza
//   s=491 R. Joaquim Garcia   s=591 R. Campos Salles
// Paved in granite setts its whole length (every panorama). The businesses on it are the
// surveyed shops (comercio/lojas.ts) and the Prefeitura (sites-table.ts); the squares draw
// their own pavements (keepOut walk:false). Everything else is here: `s` along the OSM
// centreline, side N/S, opening x from the lot centre as SEEN FROM THE STREET (left
// negative). Lot depth (d + setback) ≤ 12 m: the bake keeps cross-street houses out of that
// band only. Pure data (no THREE).
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua XV de Novembro';
export const CROSS=[0,96.9,165.6,217.5,292.1,393.6,490.8,590.9,691.7];
const SURFACE:Surface[]=[[0,700,'sett']];
const T='#b0603f',TD='#8e4632',W='#f2f2ee',GL='#2a2a2c';

// a lot whose front stands back keeps its body within the 12 m band
const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
// an n-storey building's windows: one row per upper floor at the given x
const ups=(n:number,xs:number[],w:number,o:{frame?:string;shutters?:string}={}):NonNullable<Lot['f']['open']>=>
  Array.from({length:n-1},(_,k)=>xs.map(x=>({t:'window' as const,x,w,fl:k+1,...o}))).flat();

export const LOTS:Lot[]=[
  // ================= NORTH SIDE =================
  // --- west end → R. João Cabrera
  L('N',4,11.8,{wall:'#cfc8bb',roof:'flat',fascia:'#e8e4dc',eave:.6,d:10,
    panels:[{x:1.4,w:1.6,c:'#9a9893',y0:0,y1:3}],open:[{t:'glass',x:-2.4,w:3.8,y:.4,h:1.7,frame:W},{t:'window',x:3.6,w:1.8,shutters:'#e8e4dc'}],x:['tank']},'pedra'),
  L('N',11.8,22.1,{wall:'#cfc8bb',roof:'flat',fascia:'#e8e4dc',eave:.6,setback:3,
    front:{h:1.2,c:'#d6d0c4',gates:[{t:'gate',x:1.6,w:3,c:W,h:2}]},open:[{t:'glass',x:-2,w:2.4,y:.6,h:1.6}]},'pedra'),
  L('N',22.1,25.1,{wall:'#dcd6cc',roof:'flat',parapet:true,plinth:{h:.5,c:'#a8a49c'},open:[{t:'door',x:0,w:1.4,c:'#3a3c3e'}],
    sign:{text:'JF7',bg:'#1f3a7a',fg:'#ffffff',x:0,y:2.5,w:2.4,h:.6}},'pedra'),
  L('N',25.1,34.6,{wall:'#e8e4dc',roof:'hip',roofColor:'#b9a58a',setback:4,front:{h:1.2,c:'#efede8',gates:[{t:'garage',x:-2.4,w:3.2,c:W,h:2.2}]},
    open:[{t:'window',x:1,w:1.6},{t:'door',x:3.4,w:1}]},'pedra'),
  L('N',34.6,43.5,{wall:'#e6dcc8',roof:'hip',roofColor:'#c9b59a',setback:4,front:{h:1.1,c:'#f0eee8',rail:{h:.8,c:W,style:'bars'},gates:[{t:'gate',x:2.8,w:2.6,c:'#8e959a'}]},
    open:[{t:'window',x:-2,w:1.6},{t:'door',x:.6,w:1,c:'#7a5634'}]},'ceramica'),
  L('N',43.5,56,{wall:'#efede7',roof:'hip',roofColor:T,setback:3.5,plinth:{h:1.3,c:'#b5643f'},
    front:{h:.8,c:'#c9c3b6',rail:{h:.6,c:'#efede7',style:'lattice'},gates:[{t:'gate',x:3.4,w:1.2,c:'#efede7'}]},
    open:[{t:'window',x:-1,w:2.4,grille:true},{t:'door',x:2.2,w:1.1,c:'#efede7'},{t:'window',x:4.3,w:1.4,grille:true}]}),
  L('N',56,63.4,{wall:'#f2f0ea',roof:'hip',roofColor:T,setback:3,front:{h:.6,c:'#b5643f',rail:{h:.6,c:'#c9a090',style:'lattice'}},
    open:[{t:'door',x:-2.6,w:1,c:'#6a4630'},{t:'window',x:.6,w:2,grille:true}],x:['tank']}),
  L('N',63.4,72.1,{wall:'#b9b7b2',roof:'flat',parapet:true,open:[{t:'garage',x:-1.2,w:3.2,c:W}]}),
  L('N',72.1,77.5,{floors:2,wall:'#c4605a',upper:'#c4605a',roof:'flat',parapet:true,
    open:[{t:'shop',x:-.4,w:2.6,c:'#8a5a34',awning:'#a8a090'},{t:'window',x:-.5,w:2.4,fl:1,shutters:'#9aa0a4'}]}),
  L('N',77.5,90.9,{wall:'#efe4cf',roof:'hip',roofColor:'#9b5a44',plinth:{h:1.2,c:'#7a5a44'},
    open:[{t:'window',x:-5,w:.8,y:1.3,h:.9},{t:'glass',x:-1.6,w:2,y:.3,h:2.4,grille:true,frame:'#6a4a34'},{t:'glass',x:1.6,w:2.2,y:.3,h:2.4,grille:true,frame:'#6a4a34'},{t:'door',x:5.2,w:1.1,c:'#6a4a34'}],
    sign:{text:'UNIVERSAL',bg:'#f6f6f4',fg:'#c42b2b',x:5,y:2.9,w:1.6,h:.6}}),
  // --- R. João Cabrera → R. João Cabral de Medeiros (Martins at 116–136)
  L('N',102.9,116,{wall:'#f2f2ef',roof:'flat',parapet:true,panels:[{x:-5.6,w:1,c:'#3a3a3c'},{x:-1.8,w:1,c:'#3a3a3c'},{x:2.4,w:1,c:'#3a3a3c'}],
    open:[{t:'shop',x:-3.7,w:2.4,c:'#c9cbcc'},{t:'glass',x:.3,w:2.8,y:0,h:2.5},{t:'glass',x:4.6,w:2,y:0,h:2.5}],
    sign:{text:'LUCRARE contabilidade',bg:'#1d1d1d',fg:'#d6b45a',x:-1.5,y:3,w:9,h:.9}}),
  L('N',136.4,140.5,{wall:'#2c2e31',roof:'flat',fascia:'#efede8',eave:.4,open:[{t:'garage',x:0,w:3,c:'#a9b0b3'}]}),
  L('N',140.5,147.2,{floors:2,wall:'#a9b3bd',upper:'#a9b3bd',roof:'flat',parapet:true,
    open:[{t:'glass',x:-.6,w:3.4,y:0,h:2.5,frame:GL,awning:'#c9c6bd'},{t:'window',x:0,w:2,fl:1}],sign:{text:'CERVELIN seguros',bg:'#f2f2ee',fg:'#2f5fa8',x:0,y:3.5,w:2.6,h:.9}}),
  L('N',147.2,150.9,{wall:'#efebe0',roof:'flat',parapet:true,open:[{t:'glass',x:0,w:2.4,y:0,h:2.5,grille:true,frame:W,awning:'#8e8c86'}]}),
  L('N',150.9,159.6,{floors:4,wall:'#efebe0',upper:'#c9cbc8',roof:'flat',parapet:true,
    open:[{t:'glass',x:-2.4,w:2.4,y:0,h:2.5,grille:true,frame:W,awning:'#8e8c86'},{t:'garage',x:2.2,w:3,c:W},...ups(4,[-2,2],2)],
    sign:{text:'Correios',bg:'#f6c524',fg:'#1f3a7a',x:-2.4,y:3.6,w:3,h:.5}}),
  // --- R. Barão do Rio Branco → the squares (Grupo Paris at 222–234)
  L('N',234.5,248.7,{floors:2,wall:'#e08a5e',upper:'#e08a5e',roof:'flat',parapet:true,
    open:[{t:'shop',x:-3.6,w:4,c:'#2a2a2a'},{t:'window',x:-.6,w:1,y:.8},{t:'gate',x:5.2,w:2.6,c:'#2f5fb0'},...ups(2,[-4,-1.6,1],1.2)],
    sign:{text:'LUNAYMA OUTLET',bg:'#c42b2b',fg:'#ffffff',x:-3.6,y:2.75,w:4,h:.55}}),
  L('N',248.7,257.5,{wall:'#f2f2ef',roof:'gable',roofColor:'#2f5fa8',fascia:'#2f5fa8',
    open:[{t:'glass',x:-2.6,w:1.6,y:0,h:2.4,frame:'#2f5fa8'},{t:'door',x:-.4,w:1.2,c:W},{t:'arch',x:2.8,w:2.2,h:1.4,y:.4}],
    sign:{text:'mm',bg:'#f2f2ef',fg:'#c42b2b',x:-1.4,y:2.8,w:1.8,h:.6}}),
  L('N',257.5,260.6,{wall:'#efede8',wallOnly:true,front:{h:1.9,c:'#efede8',style:'bars',rail:{h:1.6,c:W,style:'bars'}}}),
  L('N',260.6,269,{wall:'#f0eee8',roof:'gable',roofColor:'#9b5a44',fascia:'#7a4a34',eave:.6,plinth:{h:.3,c:'#a8553e'},
    open:[{t:'glass',x:.2,w:3,y:.2,h:2.6,frame:'#6a4630'}]}),
  L('N',269,272.3,{wall:'#a8553e',wallOnly:true,front:{h:1.6,c:'#a8553e',style:'bars',rail:{h:1.4,c:'#8a4a34',style:'bars'}}}),
  L('N',272.3,286.1,{wall:'#3d3f42',wallOnly:true,front:{h:1.6,c:'#3d3f42',gates:[{t:'gate',x:-4,w:4,c:'#3d3f42'}]}}),
  // --- the squares → R. Francisco Pereira de Souza (Tradição, Óptica, Açaí, VIP, Demarco)
  L('N',326.3,332.3,{floors:5,wall:'#6fb3a6',upper:'#e8dcc2',roof:'flat',parapet:true,
    open:[{t:'glass',x:0,w:4.4,y:.5,h:1.6,frame:'#1d1d1d'},...ups(5,[0],2.4)],sign:{text:'Edifício Almeida',bg:'#6fb3a6',fg:'#ffffff',x:0,y:2.5,w:4.6,h:.45}}),
  L('N',332.3,342.1,{floors:5,wall:'#6fb3a6',upper:'#e8dcc2',roof:'flat',parapet:true,
    open:[{t:'glass',x:-2.4,w:2.8,y:0,h:2.6,frame:GL,awning:'#e8e8e6'},{t:'window',x:1.6,w:1.2},{t:'garage',x:3.8,w:2,c:W},...ups(5,[-2.6,1.6],1.6)]}),
  L('N',342.1,350,{floors:5,wall:'#e8dcc2',upper:'#e8dcc2',roof:'flat',parapet:true,plinth:{h:.6,c:'#6fb3a6'},
    open:[{t:'door',x:2.6,w:1,c:W},...ups(5,[-2,1.6],1.6)]}),
  L('N',350,357.9,{floors:2,wall:'#e8b7aa',upper:'#e8b7aa',roof:'flat',parapet:true,panels:[{x:1.4,w:4.2,c:'#1d1d1d',y0:0,y1:2.9}],
    open:[{t:'arch',x:-2.4,w:1.8,h:1.6,y:0},{t:'glass',x:1.4,w:3.6,y:0,h:2.5,frame:'#1d1d1d'},{t:'door',x:-2.4,w:1.6,fl:1,c:'#7a3a2a'}],balcony:{x:-1,w:5.6,fl:1,rail:'iron'}}),
  // --- R. Francisco Pereira de Souza → R. Joaquim Garcia (BB, Original Class, Magalu)
  L('N',399.6,410.5,{wall:'#5b5e61',wallOnly:true,front:{h:.9,c:'#5b5e61',rail:{h:1.1,c:W,style:'bars'}}}),
  L('N',440.8,449.5,{floors:2,wall:'#f2f1ec',upper:'#ddd7ca',roof:'flat',panels:[{x:-2,w:4.6,stone:true,y0:0,y1:3}],
    open:[{t:'garage',x:-2,w:2.8,c:'#5a3a2a'},{t:'gate',x:2.6,w:1.4,c:'#2a2a2a'},{t:'window',x:2,w:1.6,fl:1}]}),
  L('N',462.9,466.7,{wall:'#3a8fd8',roof:'flat',parapet:true,open:[{t:'door',x:.4,w:1,c:'#7a8a96'}]}),
  L('N',466.7,474.2,{wall:'#e2d8c4',roof:'flat',parapet:true,panels:[{x:-1.4,w:4.4,stone:true}],
    open:[{t:'garage',x:-1.8,w:2.4,c:'#a8463a'},{t:'door',x:.7,w:1,c:'#2a2a2a'},{t:'glass',x:2.6,w:1.8,y:.2,h:2.2}]}),
  L('N',474.2,482,{wall:'#e8302c',roof:'flat',parapet:true,plinth:{h:1.2,c:'#1d1d1d'},
    open:[{t:'window',x:-2.6,w:1.2,y:1.4,h:.8},{t:'shop',x:.2,w:2.2,c:'#2a2a2a'},{t:'glass',x:2.6,w:1.4,y:0,h:2.4}],
    sign:{text:'Senhora Coxinha',bg:'#2a2a2a',fg:'#f2c56a',x:.8,y:2.6,w:4.6,h:.5}}),
  L('N',482,484.8,{wall:'#f2f1ec',roof:'flat',parapet:true,open:[{t:'door',x:0,w:1.4,c:'#2a2a2a',awning:'#3a9a4a'}]}),
  // --- R. Joaquim Garcia → R. Campos Salles (Santa25)
  L('N',496.8,512.7,{floors:2,wall:'#efd9c0',upper:'#efd9c0',roof:'gable',roofColor:'#a9573c',fascia:'#efe6d8',eave:.8,setback:4,
    front:{h:1,c:'#efe6d8',rail:{h:.7,c:'#efe6d8',style:'lattice'},gates:[{t:'gate',x:1,w:2.6,c:'#7a5634'}]},
    open:[{t:'door',x:-1,w:1.2,c:'#7a3a2a'},{t:'window',x:-4,w:1.6,frame:'#7a3a2a'},{t:'window',x:3,w:1.6,frame:'#7a3a2a'},{t:'window',x:0,w:1.4,fl:1,frame:'#7a3a2a'}]}),
  L('N',512.7,523.1,{floors:2,wall:'#8f9497',upper:'#8f9497',roof:'flat',parapet:true,
    open:[{t:'gate',x:-3.4,w:1.4,c:W},{t:'window',x:1,w:2,fl:1}],sign:{text:'Odontologia',bg:'#e8f0e8',fg:'#2a6a3a',x:2,y:3.6,w:2.6,h:.8}}),
  L('N',523.1,527,{wall:'#e58a86',roof:'flat',parapet:true,open:[{t:'shop',x:0,w:2.4,c:'#2a2a2a',awning:'#d9d9d4'}]}),
  L('N',527,534.4,{wall:'#9a9b9a',roof:'flat',parapet:true,open:[{t:'shop',x:-1.6,w:2.2,c:'#2a2a2a'},{t:'window',x:1.8,w:1.8,grille:true}],
    sign:{text:'PASTEL FRITO · CALDO DE CANA',bg:'#7a3a2a',fg:'#f2e05a',x:0,y:2.9,w:6.4,h:.7}}),
  L('N',553.8,566.8,{wall:'#f2f1ec',roof:'flat',parapet:true,plinth:{h:.9,c:'#8a2a4a'},
    open:[{t:'gate',x:-5.2,w:2.2,c:'#b9bcbd'},{t:'shop',x:-1.6,w:3,c:'#2a2a2a'},{t:'shop',x:3.2,w:3.4,c:'#2a2a2a'}],
    sign:{text:'Abreu HORTIFRUTI',bg:'#ffffff',fg:'#2a8a3a',x:1,y:2.9,w:10,h:1}}),
  L('N',566.8,570.7,{wall:'#f2f1ec',roof:'flat',parapet:true,plinth:{h:.9,c:'#8a2a4a'},open:[{t:'shop',x:0,w:2.6,c:'#2a2a2a'}]}),
  L('N',570.7,584.9,{d:8,wall:'#a9cf8a',roof:'gableSide',   // (shallow: the Casulo's building on the Campos Salles is behind it)
   roofColor:'#9b5a44',panels:[{x:4,w:5.6,c:'#cfd2d4',y0:0,y1:3}],
    open:[{t:'shop',x:-3.4,w:2.6,c:'#2a2a2a',awning:'#2f8a4e'},{t:'window',x:-.6,w:1,grille:true},{t:'shop',x:4,w:3.4,c:'#2a2a2a',awning:'#4a4c4e'}]}),
  // --- R. Campos Salles → R. Lourival de Medeiros (Reluz, Kenny, Credisan)
  L('N',596.9,611.1,{wall:'#a8705a',wallOnly:true,front:{h:2.2,c:'#a8705a',style:'panel',gates:[{t:'door',x:-1,w:1.4,c:'#5a3a2a'}]},
    behind:{w:11,d:7,at:4,roofColor:'#5d5f60',wall:'#ead9c0'}}),
  L('N',611.1,619.4,{wall:'#a8705a',wallOnly:true,front:{h:2.2,c:'#a8705a',style:'panel',gates:[{t:'garage',x:1,w:4.6,c:'#5a4030'}]},
    behind:{w:7,d:7,at:4,roofColor:'#5d5f60',wall:'#ead9c0'}}),
  L('N',619.4,630.6,{wall:'#efede8',roof:'flat',fascia:'#efede8',eave:.8,panels:[{x:0,w:11,stone:true,y0:0,y1:2.9}],
    open:[{t:'glass',x:-1.4,w:3.6,y:0,h:2.6},{t:'window',x:2.4,w:1.2},{t:'window',x:4.2,w:1.4}],sign:{text:'Feliz Natal',bg:'#b02a2a',fg:'#f2e6c8',x:0,y:2.95,w:10,h:.7}}),
  L('N',630.6,638.4,{wall:'#efede8',roof:'flat',fascia:'#efede8',eave:.8,panels:[{x:-2.8,w:2.2,stone:true}],
    open:[{t:'door',x:-2.8,w:1,c:'#7a3a2a'},{t:'garage',x:1.2,w:3,c:'#c9cbcc'}]}),
  L('N',648.8,656.9,{wall:'#f1cfcf',roof:'flat',parapet:true,open:[{t:'window',x:-1,w:1,y:1.6,h:.6}]}),
  L('N',678.4,685.7,{wall:'#c9cbcc',roof:'flat',parapet:true,plinth:{h:.4,c:'#c4423a'},open:[{t:'door',x:-1.6,w:1,c:'#8a5a34'},{t:'window',x:1.4,w:1}]}),
  L('N',685.7,688,{d:6,wall:'#2a5fd0',roof:'flat',parapet:true,plinth:{h:.9,c:'#d9433a'},open:[{t:'glass',x:0,w:1.6,y:.9,h:1.7,frame:'#2a5fd0'}],
    sign:{text:'SB Celulares',bg:'#1f3a8a',fg:'#ffffff',x:0,y:2.95,w:2.1,h:.6}}),

  // ================= SOUTH SIDE =================
  // --- west end → R. João Cabrera
  // (the west corner: the Capitão Thomaz de Andrade comes in at an angle, the house stands back from it)
  L('S',14,18.1,{wall:'#d8cfc0',roof:'hip',roofColor:TD,setback:2,d:5,front:{h:.8,c:'#b9a58e',rail:{h:.8,c:'#7a7d80',style:'bars'}},
    open:[{t:'door',x:1,w:1,c:'#8a5a34'},{t:'window',x:-1,w:1.2}]}),
  L('S',18.1,34.3,{floors:2,wall:'#d9a39a',upper:'#d9a39a',roof:'flat',parapet:true,
    open:[{t:'glass',x:-4.4,w:1.6,y:0,h:2.4},{t:'window',x:-1.8,w:1.6,y:1.4,h:.8},{t:'gate',x:5,w:2.4,c:'#8a6a4a'},
      {t:'window',x:-3,w:1.6,fl:1,shutters:'#7a3a2a'},{t:'window',x:-6.4,w:1.4,fl:1,shutters:'#7a3a2a'}],balcony:{x:-6.4,w:2.6,fl:1,rail:'iron'}},'mosaico'),
  L('S',34.3,42.7,{floors:2,wall:'#d9a39a',upper:'#d9a39a',roof:'flat',parapet:true,panels:[{x:-.4,w:1.4,stone:true,y0:0,y1:2.6}],
    open:[{t:'garage',x:-2.6,w:3,c:'#8e959a',awning:T},{t:'window',x:2.6,w:1.4,fl:1,shutters:'#7a3a2a'}]},'mosaico'),
  L('S',42.7,54,{wall:'#efede8',roof:'hip',roofColor:T,setback:3,front:{h:2.4,c:'#efede8',style:'lattice',gates:[{t:'gate',x:-1,w:2.4,c:W}]},
    open:[{t:'window',x:-1,w:1.4}]}),
  L('S',54,64.3,{floors:2,wall:'#e8e0cf',upper:'#e8e0cf',roof:'flat',parapet:true,
    open:[{t:'door',x:2.6,w:1,c:W},{t:'garage',x:-2.4,w:3.6,c:W,grille:true},{t:'window',x:2.6,w:1.4,fl:1}]}),
  L('S',64.3,72.1,{floors:2,wall:'#e8e0cf',upper:'#e8e0cf',roof:'flat',
    open:[{t:'glass',x:-.4,w:2.6,y:0,h:2.6,grille:true},{t:'door',x:3,w:1,c:W},{t:'window',x:0,w:2,fl:1}],balcony:{x:0,w:7.6,fl:1,rail:'white'},
    sign:{text:'Conselho Tutelar',bg:'#ffffff',fg:'#2a4fa0',x:-2.8,y:1.2,w:1.2,h:1}}),
  L('S',72.1,79.6,{wall:'#d8cdb4',wallOnly:true,front:{h:2.4,c:'#d8cdb4',style:'stone',gates:[{t:'gate',x:-2.8,w:1.4,c:W}]},
    behind:{w:6,d:7,at:4,roofColor:T,wall:'#e8e0cf',floors:2}}),
  L('S',79.6,90.9,{wall:'#e2d8c6',wallOnly:true,front:{h:1.2,c:'#d8cdb4',style:'stone',rail:{h:.7,c:W,style:'lattice'}},
    behind:{w:9,d:7,at:4,roofColor:T,wall:'#e2d8c6'}}),
  // --- R. João Cabrera → (Praça Dom Bosco 107–148) → R. João Cabral de Medeiros
  // (148–166 is the tip of the wedge between XV and the João Cabral de Medeiros: no room for a lot)
  // --- facing the Prefeitura → R. Barão do Rio Branco
  L('S',171.6,175.3,{wall:'#efede8',roof:'flat',parapet:true,open:[{t:'garage',x:0,w:3,c:W,grille:true}]}),
  L('S',175.3,184.3,{floors:2,wall:'#efede8',upper:'#efede8',roof:'flat',parapet:true,setback:2,
    front:{h:.4,c:'#efede8',rail:{h:1.4,c:W,style:'bars'},gates:[{t:'gate',x:1,w:1.4,c:W}]},panels:[{x:3.4,w:1.6,stone:true,y0:0,y1:2.6}],
    open:[{t:'glass',x:.6,w:2,y:0,h:2.4,grille:true},{t:'window',x:0,w:2.8,fl:1}]}),
  L('S',184.3,192.9,{floors:2,wall:'#efede8',upper:'#efede8',roof:'flat',parapet:true,plinth:{h:.9,c:'#2c2e30'},panels:[{x:-2.6,w:3,stone:true,y0:.9,y1:2.6}],
    open:[{t:'door',x:2,w:1.1,c:'#2a2a2a'},{t:'window',x:-.2,w:.8,y:1.6,h:.5},{t:'window',x:-2.6,w:1.8,grille:true},{t:'window',x:-2,w:2,fl:1}]}),
  L('S',192.9,202.9,{wall:'#f2f1ec',roof:'flat',d:4,open:[{t:'gate',x:3.6,w:2,c:'#8e959a'}],
    sign:{text:'MERCEARIA BELISCÃO · ESTACIONAMENTO',bg:'#f2f1ec',fg:'#2a4fa0',x:-1.4,y:.7,w:6.4,h:1.5}}),
  L('S',202.9,211.5,{wall:'#f2f1ec',wallOnly:true,front:{h:2.2,c:'#f2f1ec',gates:[{t:'gate',x:-1.4,w:4.4,c:'#2a2a2a'}]}}),
  // --- (squares 224–393) → R. Francisco Pereira de Souza → R. Joaquim Garcia (Farma Popular, Carol, Lotérica, Haddad)
  L('S',408.5,414.1,{floors:2,wall:'#e08a70',upper:'#e8a78e',roof:'flat',parapet:true,
    open:[{t:'glass',x:.4,w:2,y:.6,h:1.4,grille:true,awning:'#9a958c'},{t:'door',x:-2.1,w:1,c:'#2a2a2a'},{t:'window',x:0,w:2,fl:1,shutters:'#e8e2d6'}],
    sign:{text:'Floricultura',bg:'#efe6dc',fg:'#6a4a3a',x:.4,y:2.2,w:2,h:.35}}),
  L('S',414.1,424.1,{floors:2,wall:'#e8a78e',upper:'#e8a78e',roof:'flat',parapet:true,plinth:{h:1.3,c:'#d9c8ae'},
    open:[{t:'door',x:3,w:1,c:'#2a2a2a'},{t:'window',x:0,w:1.6,grille:true,shutters:'#8a6a5a'},{t:'window',x:-3,w:1.6,grille:true},
      {t:'window',x:-2,w:1.4,fl:1,shutters:'#f2f0ea'},{t:'window',x:2,w:1.4,fl:1,shutters:'#f2f0ea'}],balcony:{x:0,w:9.6,fl:1,rail:'white',depth:.8}}),
  L('S',424.1,431.6,{floors:2,wall:'#e8a78e',upper:'#e8a78e',roof:'flat',parapet:true,plinth:{h:1.3,c:'#d9c8ae'},
    open:[{t:'window',x:2,w:2,grille:true},{t:'glass',x:-1.4,w:1.8,y:0,h:2.4,grille:true,frame:'#9a9c9e'},{t:'window',x:-3,w:1,grille:true},{t:'window',x:0,w:2,fl:1,shutters:'#f2f0ea'}],
    sign:{text:'DESPACHANTE DIVINOLANDENSE',bg:'#ffffff',fg:'#1d1d1d',x:-1.4,y:2.55,w:2.2,h:.9}}),
  L('S',431.6,435,{floors:2,wall:'#e8a78e',upper:'#e8a78e',roof:'flat',parapet:true,plinth:{h:1.3,c:'#d9c8ae'},open:[{t:'window',x:0,w:2,grille:true}]}),
  L('S',460.7,469.5,{wall:'#5fb8b0',roof:'flat',parapet:true,plinth:{h:.5,c:'#d9c8ae'},
    open:[{t:'glass',x:2.4,w:2.2,y:0,h:2.5,grille:true,awning:'#7a5a4a'},{t:'glass',x:-1.8,w:3,y:.6,h:1.8,awning:'#7a5a4a'}],
    sign:{text:'Cacau Show',bg:'#5a2a2a',fg:'#f2e6c8',x:3.9,y:.6,w:.5,h:1.5}}),
  L('S',469.5,484.8,{wall:'#f2f1ec',roof:'hip',roofColor:'#9b5a44',plinth:{h:.9,c:'#5a4e44'},
    open:[{t:'window',x:-2,w:2.4,shutters:'#3f8a7a'},{t:'door',x:1.6,w:.9,c:'#3f8a7a'},{t:'window',x:3.6,w:1.2,frame:'#3f8a7a'},{t:'window',x:5.2,w:1.2,frame:'#3f8a7a'},{t:'gate',x:-6,w:2.6,c:'#5fa89a'}]}),
  // --- R. Joaquim Garcia → R. Campos Salles (Dondoca, Alebru, Zema, Toque Cell)
  L('S',496.8,502.6,{wall:'#f2f1ec',roof:'flat',parapet:true,plinth:{h:1.2,c:'#8fc07a'},open:[{t:'shop',x:1.4,w:2,c:W},{t:'door',x:-1.4,w:1.2,c:W}],
    sign:{text:'BRUT produtos de limpeza',bg:'#6fc0d8',fg:'#1d3a6a',x:0,y:2.7,w:4,h:.6}}),
  L('S',522.4,534,{wall:'#a8a9a6',roof:'flat',fascia:'#e8e8e4',eave:.6,open:[{t:'window',x:1.2,w:3,y:.9,h:1.4,frame:W},{t:'gate',x:-3.8,w:1.6,c:W}],
    sign:{text:'PORTAL café',bg:'#1d1d1d',fg:'#ffffff',x:-2,y:2.4,w:.9,h:.4}}),
  L('S',534,544.8,{wall:'#c9c9c4',wallOnly:true,front:{h:2.4,style:'corrugated'},behind:{w:9,d:7,at:4,roof:'flat',roofColor:'#8f8b84',wall:'#b9b5ab',floors:2}}),
  L('S',544.8,557.4,{wall:'#e8e6e0',roof:'gableSide',roofColor:TD,setback:2,front:{h:.7,c:'#a8553e'},
    open:[{t:'arch',x:1,w:2.4,h:1.2,y:.9},{t:'window',x:4,w:1.2,grille:true}]}),
  L('S',557.4,562.6,{floors:2,wall:'#efefeb',upper:'#c9d2dc',roof:'flat',parapet:true,
    open:[{t:'gate',x:.4,w:1.6,c:'#9a9c9e'},{t:'glass',x:-1.6,w:1.6,y:0,h:2.4},{t:'window',x:0,w:1.6,fl:1}],
    sign:{text:'SALÃO DO CARLOS ROQUE',bg:'#ffffff',fg:'#2a4fa0',x:-1.6,y:2.6,w:1.8,h:.6}}),
  // --- R. Campos Salles → R. Lourival de Medeiros (Paraíso do Jeans, Toda Chic)
  L('S',596.9,612.5,{wall:'#ece7d6',roof:'hip',roofColor:'#a9573c',plinth:{h:1.1,c:'#6a6e6c'},
    open:[{t:'shop',x:4.6,w:3.4,c:'#a9b0b3'},{t:'glass',x:-2.4,w:2.2,y:0,h:2.5,grille:true,awning:'#6a4a3a'},{t:'window',x:-5.6,w:1.2}]}),
  L('S',612.5,619.9,{wall:'#ece4cc',roof:'hip',roofColor:T,setback:5,front:{h:.6,c:'#cfc8b8',rail:{h:1,c:'#5a4a3a',style:'bars'},gates:[{t:'gate',x:2.6,w:1.2,c:'#5a4a3a'}]},
    open:[{t:'window',x:-1,w:2.2},{t:'glass',x:2.4,w:1.6,y:.4,h:1.6}]}),
  L('S',619.9,625.5,{wall:'#ece4cc',roof:'hip',roofColor:T,setback:5,front:{h:.6,c:'#cfc8b8',rail:{h:1,c:'#5a4a3a',style:'bars'}},open:[{t:'window',x:.6,w:1.6}]}),
  L('S',625.5,629.8,{wall:'#6a4a5a',roof:'flat',parapet:true,open:[{t:'open',x:0,w:3,h:2.4}],
    sign:{text:'DE BOA · Tobacco · Beer · Coffee',bg:'#2a2a2c',fg:'#e8b8c8',x:0,y:2.6,w:3.8,h:.6}}),
  L('S',629.8,638.2,{wall:'#ddc9a6',roof:'hip',roofColor:T,setback:2,front:{h:.9,c:'#d8c3a0',rail:{h:.7,c:'#efede6',style:'lattice'},gates:[{t:'gate',x:-3,w:1.2,c:'#efede6'}]},
    open:[{t:'window',x:1.8,w:1.4,shutters:'#f2f0ea'},{t:'door',x:-.6,w:1,c:W},{t:'window',x:-2.6,w:1.4,shutters:'#f2f0ea'}]}),
  L('S',638.2,641.3,{wall:'#efede6',wallOnly:true,front:{h:2.4,c:'#efede6',gates:[{t:'garage',x:0,w:2.6,c:'#b9bcbd'}]}}),
  L('S',651.7,658.6,{wall:'#e8c4c0',roof:'hip',roofColor:T,open:[{t:'door',x:1.2,w:1,c:'#b9c4c8'},{t:'gate',x:-1.8,w:3,c:'#b9bcbd'}]}),
  L('S',658.6,667.8,{wall:'#d9d6cf',wallOnly:true,front:{h:.4,c:'#d9d6cf',rail:{h:1.6,c:'#9a9c9e',style:'bars'}},
    behind:{w:8,d:6,at:4,roof:'flat',roofColor:'#8f8b84',wall:'#d9d6cf'}}),
  L('S',667.8,671.7,{wall:'#d9d6cf',wallOnly:true,front:{h:.4,c:'#d9d6cf',rail:{h:1.6,c:'#9a9c9e',style:'bars'}}}),
];

export const TREES:Tree[]=[
  {side:'N',s:402,kind:'palmeira'},{side:'N',s:408,kind:'palmeira'},{side:'N',s:500,kind:'palmeira'},{side:'N',s:509,kind:'palmeira'},
  {side:'N',s:684,kind:'reseda'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:20,every:36,transformers:[164,416]},
  keepOut:[
    {side:'S',s0:106.9,s1:148.1,why:'Praça Dom Bosco (pracas-centro.ts)',walk:false},
    {side:'N',s0:175.4,s1:209.4,why:'Prefeitura (its forecourt paves to the kerb)',walk:false},
    {side:'S',s0:224,s1:393.3,why:'the Matriz squares (praca-ladislau.ts, praca-alcindo.ts)',walk:false},
  ],
};
