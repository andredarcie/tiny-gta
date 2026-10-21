// Neighbourhoods of Divinolândia for the persistent NPC roster (src/data/npcs.json).
// Each town ped belongs to one neighbourhood and never leaves it: it walks the
// sidewalks of that area's streets and comes back there after the hospital.
//
// Areas are boxes in town-LOCAL metres (centred on the Igreja Matriz, x = east,
// z = south), drawn around the real parts of town on the map:
//   Centro    — the commercial blocks around the Matriz and the Prefeitura
//   Beira-Rio — the northern streets along the Rio do Peixe
//   Rosário   — east of the centre, round the Praça Nossa Senhora do Rosário
//   Galhano   — the south-eastern neighbourhood round the Praça Jorge Galhano
import {edges,type NavEdge} from '@/world/divinolandia/nav.ts';
import {DIV_OX,DIV_OZ} from '@/world/divinolandia/data.ts';

export interface Neighborhood{
  name:string;
  x0:number;x1:number;z0:number;z1:number; // town-local box
}

export const CITY_NEIGHBORHOODS:Neighborhood[]=[
  {name:'Centro',    x0:-260,x1:300, z0:-250,z1:220},
  {name:'Beira-Rio', x0:-260,x1:900, z0:-470,z1:-250},
  {name:'Rosário',   x0:300, x1:1000,z0:-250,z1:150},
  {name:'Galhano',   x0:300, x1:900, z0:150, z1:560},
];

// is a WORLD point inside the neighbourhood?
export function inNeighborhood(nh:Neighborhood,x:number,z:number):boolean{
  const lx=x-DIV_OX,lz=z-DIV_OZ;
  return lx>=nh.x0&&lx<=nh.x1&&lz>=nh.z0&&lz<=nh.z1;
}
// streets a resident walks: paved ones whose middle lies in the neighbourhood
const cache=new Map<Neighborhood,(e:NavEdge)=>boolean>();
export function neighborhoodStreets(nh:Neighborhood):(e:NavEdge)=>boolean{
  let f=cache.get(nh);
  if(!f){
    const ok=new Set<NavEdge>();
    for(const e of edges){
      if(!e.paved)continue;
      const k=(e.pts.length>>1)>>1,x=e.pts[2*k],z=e.pts[2*k+1];
      if(inNeighborhood(nh,x,z))ok.add(e);
    }
    f=(e:NavEdge)=>ok.has(e);
    cache.set(nh,f);
  }
  return f;
}
