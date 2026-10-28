// Avenida Adhemar de Barros — the avenue along the Hospital Regional's south edge, surveyed
// from Google Street View (ha-N-*, ha-S-*, local in docs/divinolandia/referencias-streetview/,
// kept out of git). 333 m west→east to the Av. Leonor Mendes de Barros. Side 'N' (north) is
// the hospital: an overgrown slope, the annex's west arm at the road (its own model), then the chain-link fence on bent
// concrete posts with palms behind it, the water tanks and tower, the brown vehicle gate
// and the car park of the eye clinic (fences and tanks in extras-hospital.ts). Side 'S':
// cattle pasture, a new property behind grey block walls with its tiled pavilion, a big
// agricultural warehouse of white blocks with a blue-posted veranda and a lorry yard, the
// red optician's shop, a field and a blue-and-white bar shed. Pure data.
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Avenida Adhemar de Barros';
export const CROSS=[0,239.1,332.7];
const SURFACE:Surface[]=[[0,332.7,'asphalt']];
const T='#b0603f',W='#f1efe9';

const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk?:Lot['walk']):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},...(walk?{walk}:{})};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra}});
// timber posts and wire round a pasture or an overgrown plot
const arame=(side:'N'|'S',s0:number,s1:number):Lot=>muro(side,s0,s1,'#8a6a4a',.1,{front:{h:.1,c:'#8a6a4a',rail:{h:1.2,c:'#8a6a4a',style:'arame'}}});

export const LOTS:Lot[]=[
  // ================= HOSPITAL SIDE (N) =================
  arame('N',4,48),
  // chain-link with a mesh gate before the service yard (the annex's west arm stands at the
  // road from s ≈ 48 to 96: hospital-anexo.ts)
  muro('N',56,66,'#c8c4bc',.3,{front:{h:.3,c:'#c8c4bc',rail:{h:1.8,c:'#9aa0a3',style:'lattice'},gates:[{t:'gate',x:2,w:3,c:'#c8d0d8'}]}}),
  // the brown ornamental vehicle gate on concrete piers (the road in is at s ≈ 244–252)
  muro('N',236,244,'#c8c4bc',.4,{front:{h:.4,c:'#c8c4bc',gates:[{t:'gate',x:0,w:7,c:'#5a4030'}]}}),

  // ================= FIELD SIDE (S) =================
  arame('S',4,66),
  // concrete posts and chain-link, then the grey block walls and the white sheet gate
  muro('S',66,76,'#c8c4bc',.3,{front:{h:.3,c:'#c8c4bc',rail:{h:1.8,c:'#9aa0a3',style:'lattice'}}}),
  muro('S',76,94,'#a8a49c',2.4,{front:{h:2.4,c:'#a8a49c',gates:[{t:'gate',x:-1.6,w:5,c:'#ece8e2'}]}}),
  // the new property's tiled pavilion behind chain-link on bare red earth
  muro('S',94,150,'#c8c4bc',.3,{front:{h:.3,c:'#c8c4bc',rail:{h:1.8,c:'#9aa0a3',style:'lattice'}},
    behind:{w:20,d:12,at:14,roof:'hip',roofColor:T,wall:'#c8a888'}}),
  // the agricultural warehouse: white block walls, a fibre-cement veranda on blue posts, sacks
  L('S',162,184,{wall:'#e6e2dc',roof:'flat',fascia:'#4a6ab0',eave:3,setback:2,d:10,
    open:[{t:'open',x:-5,w:4,h:3,c:'casa'},{t:'door',x:2,w:1.4,c:'#3a3a3a'},{t:'open',x:7,w:3,h:3,c:'casa'}]}),
  L('S',184,206,{wall:'#e6e2dc',roof:'flat',fascia:'#4a6ab0',eave:3,setback:2,d:10,
    open:[{t:'open',x:-6,w:3,h:3,c:'casa'},{t:'door',x:0,w:1.4,c:'#3a3a3a'},{t:'open',x:6,w:4,h:3,c:'casa'}]}),
  L('S',206,232,{wall:'#e6e2dc',roof:'flat',fascia:'#4a6ab0',eave:3,setback:2,d:10,
    open:[{t:'open',x:-8,w:5,h:3.4,c:'casa'},{t:'door',x:0,w:1.4,c:'#3a3a3a'},{t:'window',x:8,w:2,grille:true}]}),
  // --- past the dirt road: Ótica D'Lucca, red with a white panel fascia and roll doors
  L('S',244,256,{wall:'#c84a4a',roof:'flat',parapet:true,setback:1,
    open:[{t:'garage',x:-3.4,w:3.4,c:'#c8cacc'},{t:'window',x:.6,w:1,grille:true},{t:'window',x:2,w:1,grille:true},{t:'door',x:3.6,w:1,c:'#8a5a3a'}],
    sign:{text:"ÓTICA D'LUCCA",bg:'#e8e8e6',fg:'#c82a2a',x:0,y:3.2,w:10,h:1.4}},'mosaico'),
  // gravel behind chain-link, then the field with the white house at the back
  muro('S',256,266,'#c8c4bc',.3,{front:{h:.3,c:'#c8c4bc',rail:{h:1.8,c:'#9aa0a3',style:'lattice'}}}),
  arame('S',266,290),
  // the blue-and-white bar shed under fibre-cement, open on the road side
  L('S',290,306,{wall:'#ece8e2',roof:'flat',fascia:'#c8c4bc',eave:1.6,plinth:{h:1,c:'#3a7ad0'},setback:1,d:7,
    open:[{t:'open',x:-3,w:6,h:2,y:1,c:'casa'},{t:'window',x:4.6,w:2,shutters:W}]}),
  arame('S',306,318),
];

export const TREES:Tree[]=[
  {side:'N',s:30,kind:'ficus'},{side:'N',s:58,kind:'palmeira'},{side:'S',s:40,kind:'ficus'},
  {side:'S',s:236,kind:'ficus'},{side:'S',s:284,kind:'ficus'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:4,
  poles:{side:'S',start:12,every:34,transformers:[148]},
};
