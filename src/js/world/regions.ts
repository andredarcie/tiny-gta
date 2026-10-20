// Named regions of Divinolândia — the town's neighbourhoods (world/neighborhoods.ts), the
// landmarks out of town and the countryside around it. Single source of truth for the
// police radio ("suspect seen in …"), the countryside gunfire rule (isRuralAt) and the
// region labels drawn on the full map. The street-level "you are here" banner comes from
// the town build (refs.divinoPlace: the street name under the player).
import {divData as D,DIV_OX,DIV_OZ} from '@/world/divinolandia/data.ts';
import {CITY_NEIGHBORHOODS,inNeighborhood} from '@/world/neighborhoods.ts';

// A region name anchored on the full map. `kind` only drives the label styling
// (warm cream for the built-up town, cool blue for the open countryside).
export interface RegionLabel { name: string; cx: number; cz: number; kind: 'city' | 'rural'; }

// "Built-up" mask: 40 m cells holding at least a few houses (from the bake's houses).
const TC=40;
const cells=new Map<number,number>();
const ck=(i:number,j:number):number=>i*73856093^j*19349663;
for(const h of D.houses){const k=ck(Math.floor(h[0]/TC),Math.floor(h[1]/TC));cells.set(k,(cells.get(k)||0)+1);}
function builtUp(lx:number,lz:number):boolean{
  const i=Math.floor(lx/TC),j=Math.floor(lz/TC);
  let n=0;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)n+=cells.get(ck(i+a,j+b))||0;
  return n>=4;
}

// True out in the countryside (farms, woods, the serras, the river banks out of town) —
// firing a gun out here bothers no one: see the gunshot handler in js/combat/weapons.ts.
export function isRuralAt(x:number,z:number):boolean{
  return !builtUp(x-DIV_OX,z-DIV_OZ);
}

const L=D.landmarks;
const near=(lx:number,lz:number,p:number[],r:number):boolean=>Math.hypot(lx-p[0],lz-p[1])<r;

// The name of the region containing world (x,z).
export function regionAt(x:number,z:number):string|null{
  const lx=x-DIV_OX,lz=z-DIV_OZ;
  if(near(lx,lz,L.torre,220))return 'Morro da Torre';
  if(near(lx,lz,L.hospital,140))return 'Hospital Regional';
  for(const nh of CITY_NEIGHBORHOODS)if(inNeighborhood(nh,x,z))return nh.name;
  if(builtUp(lx,lz))return 'Divinolândia';
  return 'Zona Rural';
}

// Label anchors drawn on the full map (M): each neighbourhood at its middle, plus the
// countryside landmarks.
export const mapRegionLabels:RegionLabel[]=[
  ...CITY_NEIGHBORHOODS.map(nh=>({name:nh.name.toUpperCase(),cx:DIV_OX+(nh.x0+nh.x1)/2,cz:DIV_OZ+(nh.z0+nh.z1)/2,kind:'city' as const})),
  {name:'ZONA RURAL',cx:DIV_OX-900,cz:DIV_OZ+700,kind:'rural'},
  {name:'ZONA RURAL',cx:DIV_OX+1050,cz:DIV_OZ+1150,kind:'rural'},
  {name:'SERRA',cx:DIV_OX+200,cz:DIV_OZ+1750,kind:'rural'},
];
