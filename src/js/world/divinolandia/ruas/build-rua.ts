// Builds a SURVEYED street of Divinolândia from its StreetSpec (ruas/spec.ts, one file per
// street listed in ruas/index.ts): every lot placed along the real OSM centreline, at the
// real terrain height, facing the street, with its collision; the raised sidewalks in each
// owner's paving behind a kerb; the concrete power poles with their wiring and service
// drops; the street trees; and the street's dedicated models (ruas/extras.ts). The bake
// leaves surveyed streets free of generated houses (tools/bake-divinolandia.ts), so only
// the surveyed lots stand there.
import * as THREE from 'three';
import {buildFachada,FLOOR_H} from '../../../../assets/models/divinolandia/fachada.ts';
import Arvore from '../../../../assets/models/divinolandia/arvore-rua.ts';
import {makeSidewalks,KERB_H,type Paving} from '../../../../assets/models/divinolandia/calcada.ts';
import Poste,{makeWires} from '../../../../assets/models/divinolandia/poste-rede.ts';
import {addObb} from '../collide.ts';
import type {StreetSpec} from './spec.ts';
import {EXTRAS} from './extras.ts';

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
export const sideNormal=(f:Frame,side:'N'|'S'):[number,number]=>side==='N'?[f.uz,-f.ux]:[-f.uz,f.ux];

export function buildSurveyedStreet(spec:StreetSpec,pts:[number,number][],hw:number,H:(x:number,z:number)=>number,
  place:(o:THREE.Object3D)=>void):{lots:number;wires:THREE.Object3D;footprints:{x:number;z:number;width:number;depth:number;rotation:number}[]}{
  const{lots:LOTS,trees:TREES,cross:CROSS}=spec,crossHw=spec.crossHw??3.6;
  let n=0;
  const lift=KERB_H+.15;                                       // house floor = top of the raised sidewalk
  const drops:[number,number,number][]=[];
  const footprints:{x:number;z:number;width:number;depth:number;rotation:number}[]=[];   // the lot bodies, for the town's pole planner
  for(const lot of LOTS){
    const w=lot.s1-lot.s0-.1,f=alongPolyline(pts,(lot.s0+lot.s1)/2),[nx,nz]=sideNormal(f,lot.side);
    const off=hw+SIDEWALK,px=f.x+nx*off,pz=f.z+nz*off,y=H(px,pz)+lift;
    const d=lot.f.d??12,set=lot.f.setback??0;
    // walls reach down to the lowest ground under the lot (sloping streets)
    let lo=y;
    for(const a of[-.5,.5])for(const b of[0,.5,1]){const x=px+f.ux*a*w+nx*b*(d+set),z=pz+f.uz*a*w+nz*b*(d+set);lo=Math.min(lo,H(x,z));}
    const g=buildFachada({...lot.f,w,base:Math.min(lot.f.base??-1.2,lo-y-.6),seed:Math.round(lot.s0*13+(lot.side==='N'?1:2))});
    const th=Math.atan2(-nx,-nz);                                // local +z (façade) faces the street
    g.position.set(px,y,pz);g.rotation.y=th;place(g);
    // collision: the house body, and the front wall when there is one
    const rot=-th,top=y+(lot.f.floors??1)*FLOOR_H+1.5;
    if(!lot.f.wallOnly){const c=set+d/2;addObb(px+nx*c,pz+nz*c,w,d,rot,top);footprints.push({x:px+nx*c,z:pz+nz*c,width:w,depth:d,rotation:rot});
      drops.push([px+nx*(set+.1),y+(lot.f.floors??1)*FLOOR_H-.4,pz+nz*(set+.1)]);}
    if(lot.f.front||lot.f.wallOnly){addObb(px+nx*.1,pz+nz*.1,w,.4,rot,y+(lot.f.front?.h??2.2));}
    if(lot.f.behind){const b=lot.f.behind,c=(b.at??6)+(b.d??10)/2;addObb(px+nx*c,pz+nz*c,b.w??w*.8,b.d??10,rot,top);}
    n++;
  }
  // raised sidewalks: per block side, each lot's stretch in its paving, gaps in cement
  const strips:{pts:[number,number][];nx:number[];nz:number[];w:number;k:Paving}[]=[];
  const strip=(side:'N'|'S',a:number,b:number,k:Paving):void=>{
    if(b-a<.5)return;
    const P:[number,number][]=[],NX:number[]=[],NZ:number[]=[];
    for(let s=a;;s=Math.min(b,s+2)){const f=alongPolyline(pts,s),[nx,nz]=sideNormal(f,side);P.push([f.x+nx*hw,f.z+nz*hw]);NX.push(nx);NZ.push(nz);if(s>=b)break;}
    strips.push({pts:P,nx:NX,nz:NZ,w:SIDEWALK,k});
  };
  for(const side of['N','S'] as const)for(let i=0;i<CROSS.length-1;i++){
    const a=CROSS[i]+crossHw+.2,b=CROSS[i+1]-crossHw-.2;
    let cur=a;
    for(const l of LOTS.filter(l=>l.side===side&&l.s1>a&&l.s0<b).sort((p,q)=>p.s0-q.s0)){
      if(l.s0>cur)strip(side,cur,l.s0,'cimento');
      strip(side,Math.max(cur,l.s0),Math.min(b,l.s1),l.walk||'ceramica');cur=Math.min(b,l.s1);
    }
    strip(side,cur,b,spec.gapWalk?.find(g=>g.side===side&&g.block===i)?.k??'cimento');
  }
  place(makeSidewalks(strips,H));
  // street trees on the sidewalk
  for(const t of TREES){
    const f=alongPolyline(pts,t.s),[nx,nz]=sideNormal(f,t.side),off=hw+.9,x=f.x+nx*off,z=f.z+nz*off;
    const tr=Arvore.build({kind:t.kind});tr.position.set(x,H(x,z)+lift-.05,z);tr.rotation.y=t.s;place(tr);
    addObb(x,z,.5,.5,0,H(x,z)+3);
  }
  // power poles along one kerb (skipping the crossings), with the wiring between them
  const poles:{x:number;y:number;z:number;ry:number}[]=[];
  const P=spec.poles??{side:'S',start:16,every:34};
  for(let s=P.start;s<pts.reduce((a,_,i)=>i?a+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]):0,0)-4;s+=P.every){
    if(CROSS.some(c=>Math.abs(c-s)<9))continue;
    const f=alongPolyline(pts,s),[nx,nz]=sideNormal(f,P.side),x=f.x+nx*(hw+.35),z=f.z+nz*(hw+.35),ry=Math.atan2(-nx,-nz);
    const y=H(x,z)+lift-.05,pole=Poste.build({transformer:!!P.transformers?.includes(s)});
    pole.position.set(x,y,z);pole.rotation.y=ry;place(pole);
    poles.push({x,y,z,ry});addObb(x,z,.4,.4,0,y+11);
  }
  const wires=makeWires(poles,drops);
  // the street's dedicated models (corner houses, churches…)
  const extra=EXTRAS[spec.rua];
  if(extra)n+=extra({spec,pts,hw,crossHw,lift,sidewalk:SIDEWALK,H,place,along:s=>alongPolyline(pts,s),normal:sideNormal});
  return{lots:n,wires,footprints};
}
