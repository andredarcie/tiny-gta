// Dedicated models that stand on a surveyed street outside the generic lot façades
// (corner houses, churches, shops with a model of their own…). One entry per street,
// keyed by its OSM name; each builder places its models (in a keepOut stretch of the
// street spec) and returns how many lots it built.
import * as THREE from 'three';
import CasaRosa,{ROSA_SOLIDS} from '../../../../assets/models/divinolandia/casa-rosa-esquina.ts';
import {addObb} from '../collide.ts';
import {RUA as JAM,ROSA_AT} from './jose-augusto-machado.ts';
import JardimCapivara,{CAPIVARA_SOLIDS} from '../../../../assets/models/divinolandia/jardim-capivara.ts';
import {RUA as JG,CAPIVARA_S0,CAPIVARA_S1} from './joaquim-garcia.ts';
import {hospitalLeonor,hospitalAdhemar} from './extras-hospital.ts';
import {hospitalFrente} from './frente-hospital.ts';
import type {StreetSpec} from './spec.ts';

export type Frame={x:number;z:number;ux:number;uz:number};
export interface ExtrasCtx{
  spec:StreetSpec;
  pts:[number,number][];     // world-space centreline, s=0 at its start
  hw:number;crossHw:number;
  lift:number;               // house floor above the road = top of the raised sidewalk
  sidewalk:number;           // kerb → façade line
  H:(x:number,z:number)=>number;
  place:(o:THREE.Object3D)=>void;
  along:(s:number)=>Frame;
  normal:(f:Frame,side:'N'|'S')=>[number,number];
}
// place a model whose local +x runs along the street at (cx,cz), with its solids
// [x0,x1,z0,z1,top] (local, metres) as collision boxes
export function placeModel(ctx:ExtrasCtx,g:THREE.Object3D,cx:number,cz:number,th:number,
  solids:[number,number,number,number,number][]=[]):void{
  const y=ctx.H(cx,cz)+ctx.lift;
  g.position.set(cx,y,cz);g.rotation.y=th;ctx.place(g);
  const c=Math.cos(th),s=Math.sin(th);
  for(const[x0,x1,z0,z1,top]of solids){
    const mx=(x0+x1)/2,mz=(z0+z1)/2;
    addObb(cx+mx*c+mz*s,cz-mx*s+mz*c,x1-x0,z1-z0,-th,y+top);
  }
}

export const EXTRAS:Record<string,(ctx:ExtrasCtx)=>number>={
  // the pink corner house: SW corner of Francisco Pereira de Souza (west of it, south of JAM)
  [JAM]:ctx=>{
    const f=ctx.along(ROSA_AT-1),[nx,nz]=ctx.normal(f,'S'),{hw,crossHw,sidewalk}=ctx;
    const cx=f.x+nx*(hw+sidewalk)-f.ux*(crossHw+sidewalk),cz=f.z+nz*(hw+sidewalk)-f.uz*(crossHw+sidewalk);
    placeModel(ctx,CasaRosa.build(),cx,cz,Math.atan2(-f.uz,f.ux),ROSA_SOLIDS);   // model +x = east, +z = south
    return 1;
  },
  // nº 667: the capybara statue and the plants in front of the house, in the lot's own
  // façade frame (same origin and heading build-rua.ts gives the lot)
  [JG]:ctx=>{
    const f=ctx.along((CAPIVARA_S0+CAPIVARA_S1)/2),[nx,nz]=ctx.normal(f,'S'),off=ctx.hw+ctx.sidewalk;
    placeModel(ctx,JardimCapivara.build(),f.x+nx*off,f.z+nz*off,Math.atan2(-nx,-nz),CAPIVARA_SOLIDS);
    return 0;
  },
  // the Hospital Regional's parking apron, fence and grounds, the park and the SABESP tanks;
  // and its front: the drives' square, the car park, the rock (frente-hospital.ts)
  'Avenida Leonor Mendes de Barros':ctx=>hospitalLeonor(ctx)+hospitalFrente(ctx),
  // its fence, palms, water tanks and tower along the Adhemar de Barros
  'Avenida Adhemar de Barros':hospitalAdhemar,
};
