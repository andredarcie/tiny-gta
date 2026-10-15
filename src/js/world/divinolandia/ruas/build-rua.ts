// Builds a SURVEYED street of Divinolândia: every lot of the street spec (e.g.
// ruas/jose-augusto-machado.ts) placed along the real OSM centreline, at the real terrain
// height, facing the street, with its collision, plus the street trees and — for José
// Augusto Machado — the dedicated model of the pink corner house. The bake leaves the
// street free of generated houses (tools/bake-divinolandia.ts SURVEYED), so only the
// surveyed lots stand there.
import * as THREE from 'three';
import {buildFachada,FLOOR_H} from '../../../../assets/models/divinolandia/fachada.ts';
import Arvore from '../../../../assets/models/divinolandia/arvore-rua.ts';
import CasaRosa,{ROSA_SOLIDS} from '../../../../assets/models/divinolandia/casa-rosa-esquina.ts';
import {addObb} from '../collide.ts';
import {LOTS,TREES,ROSA_AT} from './jose-augusto-machado.ts';

export const SIDEWALK=2.2;                  // kerb → façade line

type Frame={x:number;z:number;ux:number;uz:number};
// point + unit tangent at distance s along a polyline (world coords)
export function alongPolyline(pts:[number,number][],s:number):Frame{
  let acc=0;
  for(let i=1;i<pts.length;i++){
    const[ax,az]=pts[i-1],[bx,bz]=pts[i],L=Math.hypot(bx-ax,bz-az);
    if(s<=acc+L||i===pts.length-1){const t=Math.max(0,Math.min(1,(s-acc)/(L||1)));return{x:ax+(bx-ax)*t,z:az+(bz-az)*t,ux:(bx-ax)/(L||1),uz:(bz-az)/(L||1)};}
    acc+=L;
  }
  return{x:pts[0][0],z:pts[0][1],ux:1,uz:0};
}
// unit normal pointing AWAY from the street toward the lots of that side (north = -z)
const sideNormal=(f:Frame,side:'N'|'S'):[number,number]=>side==='N'?[f.uz,-f.ux]:[-f.uz,f.ux];

export function buildJoseAugustoMachado(pts:[number,number][],hw:number,crossHw:number,H:(x:number,z:number)=>number,
  place:(o:THREE.Object3D)=>void):number{
  let n=0;
  for(const lot of LOTS){
    const w=lot.s1-lot.s0-.1,f=alongPolyline(pts,(lot.s0+lot.s1)/2),[nx,nz]=sideNormal(f,lot.side);
    const off=hw+SIDEWALK,px=f.x+nx*off,pz=f.z+nz*off,y=H(px,pz);
    const d=lot.f.d??12,set=lot.f.setback??0;
    // walls reach down to the lowest ground under the lot (sloping streets)
    let lo=y;
    for(const a of[-.5,.5])for(const b of[0,.5,1]){const x=px+f.ux*a*w+nx*b*(d+set),z=pz+f.uz*a*w+nz*b*(d+set);lo=Math.min(lo,H(x,z));}
    const g=buildFachada({...lot.f,w,base:Math.min(lot.f.base??-1.2,lo-y-.6)});
    const th=Math.atan2(-nx,-nz);                                // local +z (façade) faces the street
    g.position.set(px,y,pz);g.rotation.y=th;place(g);
    // collision: the house body, and the front wall when there is one
    const rot=-th,top=y+(lot.f.floors??1)*FLOOR_H+1.5;
    if(!lot.f.wallOnly){const c=set+d/2;addObb(px+nx*c,pz+nz*c,w,d,rot,top);}
    if(lot.f.front||lot.f.wallOnly){addObb(px+nx*.1,pz+nz*.1,w,.4,rot,y+(lot.f.front?.h??2.2));}
    if(lot.f.behind){const b=lot.f.behind,c=(b.at??6)+(b.d??10)/2;addObb(px+nx*c,pz+nz*c,b.w??w*.8,b.d??10,rot,top);}
    n++;
  }
  for(const t of TREES){
    const f=alongPolyline(pts,t.s),[nx,nz]=sideNormal(f,t.side),off=hw+1.1,x=f.x+nx*off,z=f.z+nz*off;
    const tr=Arvore.build({kind:t.kind});tr.position.set(x,H(x,z),z);tr.rotation.y=t.s;place(tr);
    addObb(x,z,.5,.5,0,H(x,z)+3);
  }
  // the pink corner house: SW corner of Francisco Pereira de Souza (west of it, south of JAM)
  {
    const f=alongPolyline(pts,ROSA_AT-1),[nx,nz]=sideNormal(f,'S');
    const cx=f.x+nx*(hw+SIDEWALK)-f.ux*(crossHw+SIDEWALK),cz=f.z+nz*(hw+SIDEWALK)-f.uz*(crossHw+SIDEWALK);
    const th=Math.atan2(-f.uz,f.ux),y=H(cx,cz);                     // model +x = east along the street, +z = south
    const g=CasaRosa.build();g.position.set(cx,y,cz);g.rotation.y=th;place(g);
    const c=Math.cos(th),s=Math.sin(th);
    for(const[x0,x1,z0,z1,top]of ROSA_SOLIDS){
      const mx=(x0+x1)/2,mz=(z0+z1)/2;
      addObb(cx+mx*c+mz*s,cz-mx*s+mz*c,x1-x0,z1-z0,-th,y+top);
    }
    n++;
  }
  return n;
}
