import * as THREE from 'three';
import {matte} from '../matte.ts';

// Ponte sobre o Rio do Peixe — the short concrete bridges where Divinolândia's streets cross
// the river, after the Street View panoramas on each of them (rio-ponte*-*, local): a
// concrete deck slab on two abutments set into the banks, no pier in the water; along each
// edge a low concrete kerb carrying the guard rail — in town, square white posts every ~2 m
// with two steel tubes painted blue; on the highway, a cream concrete balustrade (posts
// with two flat rails). The street's own paving is draped over the deck by the town builder,
// so the model draws only the slab, its edges, the abutments and the rails.
// build({len, road, depth, style}) is pure. Frame: +x along the street (the deck spans
// −len/2..len/2), +z across, y = 0 the deck's surface; `depth` = how far the abutments reach
// down (to the river bed). RAIL_Z(road) is where the rails stand across (both sides).
export type PonteStyle='tubo'|'balaustre';
const concreteM=matte({color:0xc9c5bc}),slabM=matte({color:0xa9a59c}),whiteM=matte({color:0xeeeeea}),
  blueM=matte({color:0x2f62b0}),creamM=matte({color:0xe6dcc6}),stainM=matte({color:0x8f8a7e});
export const RAIL_Z=(road:number):number=>road+2.4;
function box(g:THREE.Group,m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number):void{
  const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m);
  b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);b.castShadow=true;b.receiveShadow=true;g.add(b);
}
function build(o:{len?:number;road?:number;depth?:number;style?:PonteStyle}={}):THREE.Group{
  const g=new THREE.Group(),len=o.len??20,road=o.road??3.6,depth=o.depth??4,style=o.style??'tubo';
  const rz=RAIL_Z(road),half=len/2,w=rz+.35;
  // the slab (its top just under the draped paving) and its dark wet underside
  box(g,slabM,-half,half,-.55,-.02,-w,w);
  box(g,stainM,-half+.3,half-.3,-.62,-.55,-w+.3,w-.3);
  // edge kerbs the rails stand on
  for(const s of[-1,1])box(g,concreteM,-half,half,-.02,.34,s>0?rz-.2:-rz-.15,s>0?rz+.15:-rz+.2);
  // the abutments: walls down into the banks at each end, with short wing walls
  for(const e of[-1,1]){
    box(g,concreteM,e>0?half-.2:-half-.4,e>0?half+.4:-half+.2,-depth,-.02,-w,w);
    for(const s of[-1,1])box(g,concreteM,e>0?half:-half-2.6,e>0?half+2.6:-half,-depth*.7,.3,s>0?w-.35:-w,s>0?w:-w+.35);
  }
  // the rails
  for(const s of[-1,1]){
    const z=s*rz;
    if(style==='tubo'){
      for(let x=-half+.15;x<=half-.1;x+=2)box(g,whiteM,x-.11,x+.11,.34,1.2,z-.11,z+.11);
      for(const y of[.72,1.08]){
        const t=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,len,8),blueM);
        t.rotation.z=Math.PI/2;t.position.set(0,y,z);t.castShadow=true;g.add(t);
      }
    }else{
      for(let x=-half+.15;x<=half-.1;x+=1.4)box(g,creamM,x-.1,x+.1,.34,1.05,z-.12,z+.12);
      box(g,creamM,-half,half,.62,.74,z-.1,z+.1);
      box(g,creamM,-half,half,.98,1.1,z-.13,z+.13);
    }
  }
  return g;
}
export default {category:'Divinolândia',label:'Ponte sobre o rio',build,variants:[
  {label:'Na cidade (tubos azuis)',opts:{style:'tubo'}},{label:'Rodovia (balaústre)',opts:{style:'balaustre',road:4.6,len:22}}]};
