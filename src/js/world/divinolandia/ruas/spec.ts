// The shape of a SURVEYED street of Divinolândia (lot by lot from Google Street View).
// Each street is one pure-data file in this folder (e.g. jose-augusto-machado.ts) that
// exports a StreetSpec, listed in ./index.ts; build-rua.ts turns it into houses,
// sidewalks, trees and poles, and tools/bake-divinolandia.ts keeps the generated houses
// off it and paves it as surveyed. Pure data, no THREE (unit-tested and baked in Node).
//
// Arc length `s` runs along the street's OSM centreline, all its pieces chained into one
// polyline (chainPieces) starting at the WEST end — or at the NORTH end when the street
// runs more north–south than east–west. Side 'N' is the LEFT of a walker going toward +s
// (north on a west→east street, east on a north→south one), 'S' the right.
import type {FachadaOpts} from '../../../../assets/models/divinolandia/fachada.ts';
import type {ArvoreKind} from '../../../../assets/models/divinolandia/arvore-rua.ts';
import type {Paving} from '../../../../assets/models/divinolandia/calcada.ts';

export type Side='N'|'S';
export type Lot={side:Side;s0:number;s1:number;f:Omit<FachadaOpts,'w'>;walk?:Paving};
export type Tree={side:Side;s:number;kind:ArvoreKind};
export type Surface=[number,number,'asphalt'|'sett'];

export interface StreetSpec{
  rua:string;                 // OSM name, exactly as in the baked roads
  cross:number[];             // cross-street centrelines (arc length), both ends included
  surface:Surface[];          // paving along it, in order, covering the whole length
  settStreets?:string[];      // cross streets seen cobbled at its corners
  lots:Lot[];
  trees:Tree[];
  crossHw?:number;            // half width of the cross streets (sidewalk gaps), default 3.6
  // concrete power poles along one kerb, every `every` m from `start` (skipping crossings)
  poles?:{side:Side;start:number;every:number;transformers?:number[]};
  // paving of the sidewalk stretches no lot covers (default cement), per side + block index
  gapWalk?:{side:Side;block:number;k:Paving}[];
  // stretches [s0,s1] of a side left alone: game sites / landmark models stand there
  // (walk:false = no sidewalk drawn there either: a square or a landmark paves its own front)
  keepOut?:{side:Side;s0:number;s1:number;why:string;walk?:boolean}[];
}

// chain the OSM pieces of one street into a single polyline, oriented as documented above
export function chainPieces(pieces:[number,number][][]):[number,number][]{
  const left=pieces.filter(p=>p.length>1).map(p=>p.slice());
  if(!left.length)return[];
  const d=(a:[number,number],b:[number,number]):number=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  let out=left.shift()!;
  while(left.length){
    let best=0,how=0,bd=Infinity;
    left.forEach((p,i)=>{
      const c=[d(out[out.length-1],p[0]),d(out[out.length-1],p[p.length-1]),d(out[0],p[p.length-1]),d(out[0],p[0])];
      c.forEach((v,k)=>{if(v<bd){bd=v;best=i;how=k;}});
    });
    const p=left.splice(best,1)[0];
    if(how===0)out=out.concat(p);else if(how===1)out=out.concat(p.reverse());
    else if(how===2)out=p.concat(out);else out=p.reverse().concat(out);
  }
  const a=out[0],b=out[out.length-1],ew=Math.abs(b[0]-a[0])>=Math.abs(b[1]-a[1]);
  if(ew?a[0]>b[0]:a[1]>b[1])out.reverse();
  // drop repeated joints
  return out.filter((p,i)=>!i||d(p,out[i-1])>.5);
}
