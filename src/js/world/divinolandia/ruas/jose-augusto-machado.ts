// Rua José Augusto Machado — surveyed lot by lot from Google Street View (nov/2024 imagery;
// local reference frames in docs/divinolandia/referencias-streetview/rua-jose-augusto-machado/,
// kept out of git). The street runs ~367 m west→east through the centre, one block south of
// the Matriz:
//   s=0   Rua Manoel Pereira de Souza      s=100 Rua Barão do Rio Branco
//   s=172 Rua Leonor Mendes de Barros      s=272 Rua Francisco Pereira de Souza (the pink corner house)
//   s=367 Rua Joaquim Garcia / Dom Alberto J. Gonçalves / Celso B. de Souza
// Paving: asphalt on the western block, PARALELEPÍPEDO (granite setts) from Barão do Rio Branco
// to Francisco Pereira de Souza, asphalt again on the eastern block.
//
// `s` = metres along the OSM centreline from the west end; side N/S. Each lot is one
// FachadaOpts (src/assets/models/divinolandia/fachada.ts), width = s1-s0. Opening x is
// measured from the lot centre as SEEN FROM THE STREET (left negative). Colours are picked
// from the photos. Pure data (no THREE) so it can be unit-tested.
import type {FachadaOpts} from '../../../../assets/models/divinolandia/fachada.ts';
import type {ArvoreKind} from '../../../../assets/models/divinolandia/arvore-rua.ts';

export type Lot={side:'N'|'S';s0:number;s1:number;f:Omit<FachadaOpts,'w'>};
export const RUA='Rua José Augusto Machado';
export const SURFACE:[number,number,'asphalt'|'sett'][]=[[0,100,'asphalt'],[100,272,'sett'],[272,400,'asphalt']];
// cross streets that are cobbled too (seen at the corners)
export const SETT_STREETS=['Rua Francisco Pereira de Souza','Rua Barão do Rio Branco','Rua Leonor Mendes de Barros'];
// the pink corner house (dedicated model) stands on the SW corner of s=272
export const ROSA_AT=272;

const TILE='#a9573c',TILE_DARK='#8e4632',WHITE='#f1efe9';
export const LOTS:Lot[]=[
  // ---------------- block A (Manoel P. de Souza → Barão do Rio Branco), north side ----------------
  {side:'N',s0:6,s1:18,f:{floors:2,wall:'#dcc7be',roof:'flat',d:11,
    open:[{t:'window',x:-2,w:1.3,fl:1,shutters:WHITE},{t:'window',x:2.6,w:.9,fl:1},{t:'door',x:3.6,w:1},{t:'window',x:-1.5,w:1.4,grille:true}]}},
  {side:'N',s0:18,s1:31,f:{wall:'#dcc9ae',roof:'hip',roofColor:TILE,plinth:{h:.4,c:'#b8a78c'},
    open:[{t:'garage',x:-3.4,w:3.2,c:'#9da0a3'},{t:'window',x:1.2,w:1.4,shutters:WHITE},{t:'window',x:4.2,w:1.2,grille:true}]}},
  {side:'N',s0:31,s1:43,f:{wall:'#4f6c50',roof:'gable',roofColor:TILE_DARK,fascia:'#7a5232',eave:.8,plinth:{h:.35,c:'#5f5e5a'},
    open:[{t:'window',x:-2.6,w:1.3,frame:WHITE,shutters:'#ecebe5'},{t:'window',x:1.6,w:1.7,grille:true,frame:'#9a9a96'}],
    panels:[{x:1.6,w:3,c:'#8d8c87',y0:.5,y1:2.6}]}},
  {side:'N',s0:43,s1:54,f:{wall:'#ead9bf',roof:'hip',roofColor:TILE,setback:3,
    front:{h:2,c:'#e2d3bb',gates:[{t:'gate',x:-1,w:1.2,c:'#ffffff'},{t:'gate',x:2.4,w:2.6,c:'#f4f2ee'}]},
    open:[{t:'window',x:-2,w:1.4,grille:true},{t:'window',x:2.5,w:1,frame:WHITE}]}},
  {side:'N',s0:54,s1:64,f:{floors:2,wall:'#f3f1ec',roof:'flat',fascia:'#f3f1ec',setback:4,
    front:{h:2.2,c:'#e9dcc6',gates:[{t:'door',x:-.5,w:1.1,c:'#f2f2ee'}]},
    panels:[{x:-3,w:2.2,c:'#8b5a3a',y0:0,y1:2.6}],open:[{t:'glass',x:1.5,w:2.6,fl:1}]}},
  {side:'N',s0:64,s1:80,f:{wall:'#e4dccd',roof:'gable',roofColor:'#9b4a35',fascia:'#7a3a2a',eave:.9,
    front:{h:1.4,c:'#e4dccd',gates:[]},open:[{t:'garage',x:2,w:4.8,h:3,c:'#a7a9a7'},{t:'window',x:-4.5,w:.8,y:1.6,h:.8}]}},
  {side:'N',s0:80,s1:94,f:{wall:'#d79b88',roof:'hip',roofColor:TILE,plinth:{h:1.1,stone:true},
    open:[{t:'window',x:-4,w:2.2,h:1.5,grille:true},{t:'window',x:-.5,w:2.2,h:1.5,grille:true},{t:'window',x:3,w:1.4,h:1.5,grille:true},{t:'door',x:5.6,w:1}]}},
  // ---------------- block A, south side ----------------
  {side:'S',s0:6,s1:11,f:{wall:'#ece5d8',roof:'flat',d:10,open:[{t:'garage',x:0,w:2.8,h:2.6,c:'#9b2d2a'}]}},
  {side:'S',s0:11,s1:21,f:{wall:'#8e2f31',roof:'hip',roofColor:TILE,plinth:{h:.5,c:'#7a2a2b'},
    open:[{t:'window',x:-2,w:1.6,awning:'#c9c6bd',frame:'#ece7dc'},{t:'window',x:1.6,w:1.6,awning:'#c9c6bd',frame:'#ece7dc'},{t:'door',x:4.3,w:.9,c:'#9b2d2a'}]}},
  {side:'S',s0:21,s1:31,f:{wall:'#efede7',roof:'hip',roofColor:TILE,setback:2,
    front:{h:1,c:'#efede7',rail:{h:.9,style:'bars',c:'#9da0a2'},gates:[{t:'garage',x:-2.6,w:3,c:'#9fa2a4'}]},open:[{t:'window',x:2,w:1.2}]}},
  {side:'S',s0:31,s1:43,f:{wall:'#f2f0ec',roof:'hip',roofColor:TILE,
    panels:[{x:3.4,w:2.6,c:'#b65a50'}],open:[{t:'garage',x:-.3,w:4.4,c:'#f4f2ef',grille:true},{t:'door',x:-4,w:1},{t:'window',x:3.4,w:1.5,y:1.6,h:.6}]}},
  {side:'S',s0:43,s1:50,f:{wall:'#efebe3',roof:'hip',roofColor:TILE,open:[{t:'garage',x:-1,w:3.6,c:'#a8463a'},{t:'gate',x:2.4,w:1,c:'#a8463a'}]}},
  {side:'S',s0:50,s1:63,f:{floors:2,wall:'#dcd39f',upper:'#e2da9f',roof:'hip',roofColor:TILE,
    panels:[{x:-5.6,w:.6,c:'#efe9c4'},{x:-1,w:.6,c:'#efe9c4'},{x:3.6,w:.6,c:'#efe9c4'}],
    open:[{t:'garage',x:-3.3,w:3,c:'#f4f2ee',grille:true},{t:'garage',x:1.3,w:3,c:'#f4f2ee',grille:true},{t:'door',x:5.2,w:.9,c:'#f4f2ee'},
      {t:'window',x:-3.3,w:1.6,fl:1,frame:'#3a3532'},{t:'window',x:1.3,w:1.6,fl:1,frame:'#3a3532'}]}},
  {side:'S',s0:63,s1:75,f:{wall:'#e3a796',roof:'gable',roofColor:'#7d6a5d',fascia:'#6e6862',eave:.7,plinth:{h:1.6,c:'#7c8b92'},
    open:[{t:'window',x:1.4,w:1.4,y:1.9,frame:WHITE,shutters:'#7a5232'},{t:'arch',x:-3,w:1.9,h:1.1,y:2}]}},
  {side:'S',s0:75,s1:94,f:{floors:2,wall:'#e6e6e3',upper:'#d6d6d3',roof:'flat',fascia:'#f2f2f0',eave:.6,setback:2,
    front:{h:1.2,c:'#e9e9e6',gates:[{t:'garage',x:-6,w:4.5,h:2.4,c:'#2c2f33'}]},
    balcony:{x:2,w:8,fl:1,rail:'glass'},open:[{t:'glass',x:2,w:6,fl:1}]}},
  // ---------------- block B (Barão → Leonor Mendes de Barros), north side ----------------
  {side:'N',s0:106,s1:116,f:{wall:'#e9e7e3',roof:'hip',roofColor:TILE,plinth:{h:1,c:'#8d8f92'},
    open:[{t:'window',x:-1.5,w:1.5,grille:true},{t:'door',x:2.8,w:1,c:'#f0efeb'}]}},
  {side:'N',s0:116,s1:126,f:{wall:'#2f4f97',roof:'hip',roofColor:TILE,
    open:[{t:'window',x:-3,w:1.6,grille:true,frame:WHITE},{t:'window',x:.3,w:1.6,grille:true,frame:WHITE},{t:'door',x:3.2,w:.9,c:'#b9bbbd'}]}},
  {side:'N',s0:126,s1:166,f:{wall:'#e8e6e1',wallOnly:true,front:{h:2.6,c:'#e8e6e1',style:'panel'},plinth:{h:.8,c:'#4d4e52'},
    behind:{w:30,d:14,at:8,roofColor:TILE,wall:'#e8e2d4'}}},
  // ---------------- block B, south side ----------------
  {side:'S',s0:106,s1:124,f:{wall:'#8e3836',roof:'hip',roofColor:TILE,plinth:{h:.9,c:'#d9cdb8'},
    open:[{t:'window',x:-6.5,w:1.6,frame:WHITE},{t:'window',x:-3.6,w:1.6,frame:WHITE,awning:'#d8d4ca'},{t:'door',x:-1.2,w:1.1,c:'#ece7dc',awning:'#d8d4ca'},
      {t:'window',x:1.6,w:1.8,grille:true,frame:WHITE},{t:'window',x:5,w:1.6,frame:WHITE}]}},
  {side:'S',s0:124,s1:140,f:{floors:2,wall:'#9b8875',roof:'hip',roofColor:'#7e6650',
    panels:[{x:0,w:16,stone:true,y0:0,y1:6}],
    open:[{t:'garage',x:-1.2,w:3.2,c:'#7d3b2a'},{t:'garage',x:2.4,w:3.2,c:'#7d3b2a'},{t:'door',x:5.4,w:1,c:'#6b3424'},{t:'door',x:-4.6,w:.9,c:'#6b3424'},
      {t:'window',x:-6.4,w:1.1,frame:'#6b3424'},
      {t:'window',x:-4.5,w:1.2,fl:1,shutters:'#7d3b2a'},{t:'window',x:0,w:1.2,fl:1,shutters:'#7d3b2a'},{t:'window',x:3.2,w:1.2,fl:1,shutters:'#7d3b2a'}]}},
  {side:'S',s0:140,s1:152,f:{wall:'#dccb8e',wallOnly:true,front:{h:2.3,c:'#d7c78c'},behind:{w:9,d:8,at:5,roofColor:TILE_DARK,wall:'#e2dccd'}}},
  {side:'S',s0:152,s1:166,f:{wall:'#e4d395',roof:'hip',roofColor:TILE_DARK,plinth:{h:.8,c:'#9a9890'},
    open:[{t:'window',x:-4.2,w:1.2,frame:WHITE,c:'#6b5a48'},{t:'window',x:-1.2,w:1.2,frame:WHITE},{t:'window',x:2.6,w:1.8,frame:'#7a7a74',grille:true}]}},
  // ---------------- block C (Leonor → Francisco Pereira de Souza), north side ----------------
  {side:'N',s0:178,s1:200,f:{wall:'#cfdcea',wallOnly:true,front:{h:2.4,style:'hedge'},behind:{w:10,d:9,at:8,roof:'gable',roofColor:'#7f8f9f',wall:'#d7e2ee'}}},
  {side:'N',s0:200,s1:214,f:{wall:'#bdb7ad',wallOnly:true,front:{h:2.2,c:'#b9b3a9'}}},
  {side:'N',s0:214,s1:232,f:{floors:2,wall:'#f4f3ef',roof:'flat',fascia:'#f4f3ef',eave:.5,setback:6,
    front:{h:2.4,c:'#e5dac6',gates:[{t:'gate',x:-1.5,w:4.2,h:2.3,c:'#9a6a43'}]},
    balcony:{x:2.5,w:6,fl:1,rail:'glass'},open:[{t:'glass',x:2.5,w:5,fl:1}]}},
  {side:'N',s0:232,s1:244,f:{wall:'#e2d2b6',wallOnly:true,front:{h:2.3,c:'#e2d2b6',gates:[{t:'gate',x:1.6,w:3.4,h:2.2,c:'#9a6a43'},{t:'door',x:-1.4,w:1,c:'#8a5d3c'}]},
    behind:{w:8,d:8,at:6,roofColor:TILE,wall:'#ece6da'}}},
  {side:'N',s0:244,s1:258,f:{wall:'#e9e7e1',wallOnly:true,front:{h:2.3,c:'#e7e4dc'},behind:{w:12,d:10,at:7,roofColor:TILE,wall:'#f0ede6'}}},
  {side:'N',s0:258,s1:266,f:{wall:'#f2f1ed',roof:'hip',roofColor:TILE,setback:3.5,
    front:{h:.7,c:'#b45a3e',rail:{h:1,style:'bars',c:'#a3a6a8'}},open:[{t:'window',x:-1,w:1.3,shutters:'#f2f1ed'},{t:'window',x:2.2,w:1,grille:true}]}},
  // ---------------- block C, south side (the pink corner house takes ~249–266, see ROSA_AT) ----------------
  {side:'S',s0:178,s1:190,f:{wall:'#9fa0a2',roof:'hip',roofColor:'#8f8b84',base:-1.8,plinth:{h:1.5,stone:true},
    open:[{t:'window',x:-2.6,w:1,y:1.7,shutters:'#7f8a94',frame:WHITE},{t:'door',x:1.6,w:.9,y:1.5,c:'#5a4a3a'}],balcony:{x:1.8,w:4.8,fl:0,rail:'white',depth:1.6}}},
  {side:'S',s0:190,s1:202,f:{wall:'#f1efea',roof:'hip',roofColor:TILE,open:[{t:'window',x:-2,w:1.4,frame:WHITE},{t:'window',x:2,w:1.4,grille:true}]}},
  {side:'S',s0:202,s1:226,f:{wall:'#cbb8a8',wallOnly:true,front:{h:2.4,c:'#c9b7a7',style:'plain'}}},
  {side:'S',s0:226,s1:234,f:{wall:'#efe7d8',roof:'hip',roofColor:TILE,setback:1.5,front:{h:2.2,c:'#ece4d5',gates:[{t:'gate',x:-.5,w:3.4,c:'#2d2622'}]}}},
  {side:'S',s0:234,s1:249,f:{wall:'#e6ddc9',wallOnly:true,front:{h:2.4,style:'corrugated'},behind:{w:10,d:9,at:5,roofColor:TILE_DARK,wall:'#d9d1c1',floors:2}}},
  // ---------------- block D (Francisco P. de Souza → Joaquim Garcia), north side ----------------
  {side:'N',s0:278,s1:292,f:{floors:3,wall:'#e8dcc0',upper:'#ead9b8',roof:'gable',roofColor:'#4b3a33',fascia:'#3b2c26',eave:1,
    open:[{t:'shop',x:0,w:5,c:'#2d3944'},{t:'window',x:-3.5,w:1,fl:1},{t:'window',x:3.2,w:1,fl:1},{t:'window',x:1,w:.9,fl:2}],
    sign:{text:'Letícia Brandi',bg:'#ece8e2',fg:'#4b3b4e',x:0,y:3.6,w:3,h:1.4},balcony:{x:-5.2,w:2.4,fl:1,rail:'iron'}}},
  {side:'N',s0:292,s1:310,f:{wall:'#c25a5d',roof:'gable',roofColor:TILE,fascia:WHITE,eave:.9,
    open:[{t:'garage',x:-6.3,w:4,c:'#8b6a4a'},{t:'window',x:-.8,w:2.2,frame:WHITE,c:'#5a4030'},{t:'window',x:3.6,w:2.4,grille:true,frame:WHITE}],
    sign:{text:'FACULDADE UNINA',bg:'#f4f4f4',fg:'#1f4f9a',x:-.8,y:1.6,w:2.4,h:1.0}}},
  {side:'N',s0:310,s1:330,f:{wall:'#f0efea',roof:'hip',roofColor:TILE,setback:3,
    front:{h:1,c:'#f0efea',rail:{h:1.2,style:'bars',c:'#f4f4f0'},gates:[{t:'gate',x:-4,w:3,c:'#f4f4f0'}]},
    open:[{t:'arch',x:-5,w:2,h:1.6,y:.4},{t:'arch',x:-1.6,w:2,h:1.6,y:.4},{t:'arch',x:1.8,w:2,h:1.6,y:.4},{t:'arch',x:5.2,w:2,h:1.6,y:.4}]}},
  {side:'N',s0:330,s1:346,f:{wall:'#a9aaac',roof:'flat',fascia:'#3a3b3e',eave:.2,d:14,
    panels:[{x:-6.4,w:1.6,c:'#7e7f82'}],
    open:[{t:'glass',x:-3.6,w:2.6,y:0,h:2.6},{t:'shop',x:3.4,w:5,c:'#222326'}],sign:{text:'AT',bg:'#7e7f82',fg:'#1c1c1e',x:-6.4,y:3.4,w:1.4,h:1}}},
  {side:'N',s0:346,s1:361,f:{wall:'#f2f1ee',roof:'hip',roofColor:TILE,setback:1.5,front:{h:1.4,c:'#f2f1ee',gates:[{t:'gate',x:3,w:2.6,c:'#e8e8e4'}]},
    open:[{t:'window',x:-2,w:1.6,grille:true}]}},
  // ---------------- block D, south side ----------------
  {side:'S',s0:278,s1:292,f:{wall:'#e8e3d6',roof:'hip',roofColor:TILE_DARK,floors:1,plinth:{h:1.2,c:'#b9b3a6'},setback:4,
    front:{h:2,c:'#dcd5c6'},balcony:{x:0,w:9,fl:1,rail:'iron',depth:1.4},open:[{t:'window',x:-3,w:1,frame:'#6b5a48'},{t:'window',x:2.5,w:1,frame:'#6b5a48'}]}},
  {side:'S',s0:292,s1:300,f:{wall:'#dedbd2',wallOnly:true,front:{h:1.6,c:'#dedbd2',style:'panel'}}},
  {side:'S',s0:300,s1:312,f:{floors:2,wall:'#f1efea',upper:'#9c4a33',roof:'gable',roofColor:'#6e4a3a',fascia:'#5a3a2c',eave:.9,
    open:[{t:'window',x:-2.6,w:2.4,h:1.4,grille:true},{t:'window',x:1.4,w:2.4,h:1.4,grille:true},{t:'gate',x:-5,w:1.8,c:'#f4f2ee'},
      {t:'window',x:-3,w:1.8,fl:1,frame:WHITE},{t:'window',x:.2,w:1.8,fl:1,frame:WHITE},{t:'window',x:3.4,w:1.8,fl:1,frame:WHITE}]}},
  {side:'S',s0:312,s1:322,f:{wall:'#f1f0ec',roof:'hip',roofColor:TILE,open:[{t:'garage',x:-1,w:3.6,c:'#f6f5f2'},{t:'window',x:3,w:1,y:1.4,h:.8}]}},
  {side:'S',s0:322,s1:338,f:{floors:2,wall:'#8f8a80',upper:'#f0ece4',roof:'hip',roofColor:TILE,plinth:{h:3,stone:true},
    open:[{t:'garage',x:4,w:4,c:'#f4f3f0'}],balcony:{x:-2.5,w:9,fl:1,rail:'iron',depth:1.4}}},
  {side:'S',s0:338,s1:356,f:{wall:'#b9b7b2',wallOnly:true,front:{h:1.6,c:'#c9c6c0',rail:{h:1.2,style:'bars',c:'#8c9093'},gates:[{t:'gate',x:-1.2,w:4,c:'#3d6fb0'}]},
    behind:{w:5,d:4,at:12,roof:'flat',roofColor:'#8f8b84',wall:'#a8553e'}}},
];
export const TREES:{side:'N'|'S';s:number;kind:ArvoreKind}[]=[
  {side:'N',s:132,kind:'ficus'},{side:'N',s:158,kind:'ficus'},
  {side:'N',s:182,kind:'palmeira'},{side:'N',s:189,kind:'palmeira'},{side:'N',s:195,kind:'palmeira'},
  {side:'N',s:207,kind:'reseda'},{side:'N',s:281,kind:'reseda'},{side:'N',s:288,kind:'reseda'},
  {side:'N',s:300,kind:'reseda'},{side:'N',s:352,kind:'resedaBranca'},{side:'S',s:128,kind:'ficus'},
];
