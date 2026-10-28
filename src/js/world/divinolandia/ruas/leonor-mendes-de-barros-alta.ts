// Rua Leonor Mendes de Barros, the upper stretch: from the E.E. Vicente Nasser up to the
// Hospital Regional's avenue — surveyed from Google Street View (lh-N-*, lh-S-*, local in
// docs/divinolandia/referencias-streetview/, kept out of git). OSM leaves this stretch unnamed
// (Google names it Rua Leonor Mendes de Barros): the bake names its ways "…#2" (NAMED_WAYS),
// so it is a street of its own here and the frame of the street below is untouched. 340 m.
//   s=0 the school's corner (the street below)   s=12 R. Mato Grosso   s=149 the corner square
//   s=206 R. Barão do Rio Branco ends beside it   s=340 Av. Leonor Mendes de Barros (the gate)
// Paving: granite setts, then hexagonal concrete pavers past the corner square. For its first
// 140 m it is one carriageway of a dual road: the other one (side 'S') is the street below,
// whose houses are its lots (leonor-mendes-de-barros.ts); then the Barão runs alongside on
// that side to s ≈ 195. Side 'N' is the left of a walker going up (+s) toward the hospital:
// the school's wall, the precast wall of the eucalyptus wood, the yellow corner wall with
// its fig tree, then post-and-wire fences round the hospital's grounds and its car-park gate.
// Side 'S' past the Barão: the yellow precast wall over the town below, the open gravel
// park, the Restaurante Salônica and the gatehouse block. Opening x is measured from the lot
// centre as SEEN FROM THE STREET (left negative). Pure data.
import type {Lot,Tree,Surface,StreetSpec} from './spec.ts';

export const RUA='Rua Leonor Mendes de Barros#2';
export const CROSS=[0,11.5,25.9,148.9,151.5,206.1,242.3,340.2];
const SURFACE:Surface[]=[[0,340.2,'sett']];
const T='#b0603f',W='#f1efe9';

// (the sidewalks here are cement and hexagonal concrete pavers, not the town's ceramic tiles)
const L=(side:'N'|'S',s0:number,s1:number,f:Lot['f'],walk:Lot['walk']='cimento'):Lot=>{
  const set=f.setback??0,d=Math.min(f.d??12,12-set);
  return{side,s0,s1,f:{...f,d},walk};
};
const muro=(side:'N'|'S',s0:number,s1:number,c:string,h:number,extra:Partial<Lot['f']>={}):Lot=>
  ({side,s0,s1,f:{wallOnly:true,wall:c,d:1,front:{h,c},...extra},walk:'cimento'});
// mourões (square concrete posts painted ochre) and barbed wire on the grass bank
const arame=(side:'N'|'S',s0:number,s1:number):Lot=>muro(side,s0,s1,'#c9a860',.1,{front:{h:.1,c:'#c9a860',rail:{h:1.3,c:'#c9a860',style:'arame'}}});

export const LOTS:Lot[]=[
  // ================= SCHOOL AND HOSPITAL SIDE (N) =================
  // (s 0–20: the school's wall with its blue planters and name — publicos.ts `vicentenasser`)
  // the long whitewashed precast wall in front of the eucalyptus wood
  muro('N',33.5,69.5,'#e6e4dc',2.2),
  muro('N',69.5,103.5,'#e6e4dc',2.2),
  muro('N',103.5,135.5,'#e6e4dc',2.2),
  // the ochre corner wall with its brick coping, the school bus's stop under the fig tree
  muro('N',135.5,146.5,'#d8c060',2.2,{front:{h:2.2,c:'#d8c060'},panels:[{x:0,w:11,c:'#b5603f',y0:2.05,y1:2.25}]}),
  // a low brick wall by the stop sign, then the fenced grass bank round the hospital's grounds
  muro('N',155.5,169.5,'#b5603f',1),
  arame('N',169.5,211.5),arame('N',211.5,261.5),arame('N',261.5,309.5),
  // the car park's gate: white bars between whitewashed pillars, the ESTACIONAMENTO sign
  muro('N',309.5,323.5,'#ece8e2',2,{front:{h:.6,c:'#ece8e2',rail:{h:1.6,c:W,style:'bars'},gates:[{t:'gate',x:0,w:5,c:W}]},
    sign:{text:'ESTACIONAMENTO →',bg:'#ffffff',fg:'#c82a2a',x:5,y:1.2,w:1.2,h:.6}}),
  arame('N',323.5,335.5),

  // ================= TOWN SIDE (S) =================
  // the ochre precast wall over the town below (the view down to the valley)
  muro('S',209.5,233.5,'#d8b878',2.4),
  muro('S',233.5,250.5,'#d8b878',2.4),
  // the Restaurante Salônica: ochre walls on a grey base, a clay roof, the name on its gable
  L('S',301.5,317.5,{d:6.5,wall:'#e6c070',roof:'gable',roofColor:T,fascia:'#4a3a32',plinth:{h:.8,c:'#8a8c8e'},
    open:[{t:'window',x:-4,w:1.6,grille:true},{t:'window',x:2,w:1.6,grille:true},{t:'window',x:5.4,w:.8,frame:W}],
    sign:{text:'RESTAURANTE SALÔNICA',bg:'#e6c070',fg:'#3a4a6a',x:-1,y:2.4,w:7,h:.7}}),
  // the ochre block with its red doors and a round window
  L('S',318.1,329.5,{d:11,wall:'#e6c070',roof:'gable',roofColor:T,fascia:'#3a4a6a',plinth:{h:.5,c:'#8a8c8e'},
    open:[{t:'door',x:-3.6,w:1.2,c:'#a83a2a'},{t:'window',x:-.6,w:1.6,grille:true},{t:'window',x:2.4,w:.8,frame:W},{t:'door',x:4.4,w:1.2,c:'#a83a2a'}]}),
];

export const TREES:Tree[]=[
  {side:'N',s:39.5,kind:'ficus'},{side:'N',s:77.5,kind:'ficus'},{side:'N',s:115.5,kind:'ficus'},{side:'N',s:141.5,kind:'ficus'},
  {side:'N',s:201.5,kind:'ficus'},{side:'N',s:243.5,kind:'ficus'},{side:'N',s:287.5,kind:'ficus'},
  {side:'S',s:217.5,kind:'ficus'},{side:'S',s:251.5,kind:'ficus'},{side:'S',s:281.5,kind:'palmeira'},{side:'S',s:295.5,kind:'palmeira'},
];

export const SPEC:StreetSpec={
  rua:RUA,cross:CROSS,surface:SURFACE,lots:LOTS,trees:TREES,crossHw:3.6,
  poles:{side:'N',start:42,every:34},
  keepOut:[
    {side:'N',s0:0,s1:33.5,why:'E.E. Dep. Vicente Nasser (publicos.ts)'},
    {side:'S',s0:0,s1:207.5,why:'the dual carriageway below, then the Barão alongside (no sidewalk between them)',walk:false},
  ],
};
