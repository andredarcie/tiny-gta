// Avenida Leonor Mendes de Barros — the avenue in front of the Hospital Regional (the old
// Sanatório Adhemar de Barros), surveyed from Google Street View (hl-N-*, hl-S-*, local in
// docs/divinolandia/referencias-streetview/, kept out of git). 172 m north→south to the
// Av. Adhemar de Barros. Side 'S' (west, right of a walker going south) is the hospital:
// the yellow gatehouse at the entrance road, then the long apron of parking bays with the
// chain-link fence and the grass slope behind (drawn by extras-hospital.ts), then the eye
// clinic (already its own public building). Side 'N' (east): the park with picnic tables behind post
// and wire, thick bush, the SABESP water plant's white wall, a bare lot roped off on yellow
// posts and the snack stalls up on their platform at the corner. Pure data.
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';
import {BAYS} from './extras-hospital.ts';

export const RUA='Avenida Leonor Mendes de Barros';
export const CROSS=[0,171.7];
const SURFACE:Surface[]=[[0,171.7,'asphalt']];

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});

export const LOTS:Lot[]=[
  // ================= HOSPITAL SIDE (S, west) =================
  // the yellow gatehouse at the entrance road, its pass-through under a flat slab
  L('S',5,20,{wall:'#d8b048',roof:'flat',parapet:true,band:'#c89a3a',setback:2,d:6,
    open:[{t:'open',x:-2.6,w:3.6,h:2.8,c:'casa'},{t:'door',x:2.4,w:1,c:'#8a6a3a'},{t:'window',x:5,w:1.4,grille:true}],
    sign:{text:'HOSPITAL REGIONAL',bg:'#d8b048',fg:'#3a2a1a',x:-2.6,y:3.1,w:5,h:.6}},'pedra'),
  // (the eye clinic at the far end is its own public building: publicos.ts `oftalmo`)

  // ================= PARK SIDE (N, east) =================
  // the park: grass and picnic tables behind timber posts and wire
  muro('N',4,30,'#c8b490',.15,{front:{h:.15,c:'#a8805a',rail:{h:1.1,c:'#c8b490',style:'lattice'}}}),
  // thick bush along a post-and-wire fence
  muro('N',30,56,'#c8b490',.15,{front:{h:.15,c:'#a8805a',rail:{h:1.1,c:'#c8b490',style:'lattice'}}}),
  // the SABESP plant: a tall white wall with blue piers and a blue mesh gate, low white sheds
  muro('N',56,64,'#ece8e2',2.6,{front:{h:2.6,c:'#ece8e2',gates:[{t:'gate',x:0,w:4.4,c:'#4a8ad0'}]},panels:[{x:-2.4,w:.5,c:'#4a8ad0'},{x:2.4,w:.5,c:'#4a8ad0'}]}),
  muro('N',64,90,'#ece8e2',2.6,{behind:{w:16,d:9,at:3,roof:'flat',roofColor:'#d8d8d4',wall:'#ece8e2'}}),
  // the bare lot roped off on yellow posts
  muro('N',90,148,'#e0b83a',.1,{front:{h:.1,c:'#e0b83a',rail:{h:.8,c:'#e0b83a',style:'lattice'}}}),
  // the snack stalls up on their platform: open counters under red and grey sheet roofs
  L('N',150,166,{wall:'#c8b8a8',roof:'flat',fascia:'#a83a2a',eave:1.2,setback:3,d:6,plinth:{h:.8,c:'#a8805a'},
    open:[{t:'open',x:-3.4,w:6,h:2.4,y:.8,c:'casa'},{t:'open',x:3.4,w:6,h:2.4,y:.8,c:'casa'}],
    sign:{text:'LANCHES',bg:'#1c1c1e',fg:'#ffffff',x:-3.4,y:3.4,w:3,h:.5}}),
];

export const TREES:Tree[]=[
  {side:'N',s:12,kind:'palmeira'},{side:'N',s:20,kind:'ficus'},{side:'N',s:36,kind:'ficus'},{side:'N',s:46,kind:'ficus'},
  {side:'N',s:110,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:4,
  poles:{side:'N',start:10,every:34},
  keepOut:[{side:'S',s0:BAYS[0],s1:BAYS[1],why:'hospital parking apron + fence (extras-hospital.ts)',walk:false}],
};
