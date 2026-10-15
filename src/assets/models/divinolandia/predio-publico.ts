import * as THREE from 'three';
import {matte} from '../matte.ts';

// Prédio público — the plain institutional building of a small town (Prefeitura, health
// centre, schools, police): a rendered box on a raised base, a band of windows per floor,
// a flat slab behind a parapet and, on the Prefeitura, a flag pole. Size and floors come
// from the OSM footprint. build() is pure; the main façade faces +z.
const baseM=matte({color:0xb9b2a4}),glassM=matte({color:0x37434d}),slabM=matte({color:0x8f8b84}),poleM=matte({color:0xd8d8d8});
const flagM=matte({color:0x2d7a3e,side:THREE.DoubleSide});
const wallMs=new Map<number,THREE.MeshLambertMaterial>();
const wallM=(c:number):THREE.MeshLambertMaterial=>{let m=wallMs.get(c);if(!m){m=matte({color:c});wallMs.set(c,m);}return m;};
export type PredioOpts={w?:number;d?:number;floors?:number;color?:number;flag?:boolean;base?:number};
function build(o:PredioOpts={}):THREE.Group{
  const w=o.w||18,d=o.d||12,fl=o.floors||2,H=fl*3.4,base=o.base??1.5;
  const g=new THREE.Group(),wm=wallM(o.color??0xe9e2cf);
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,H+.9+base,d),wm);b.position.y=(H+.9-base)/2;b.castShadow=true;b.receiveShadow=true;g.add(b);
  const pl=new THREE.Mesh(new THREE.BoxGeometry(w+.3,base+.4,d+.3),baseM);pl.position.y=-base/2+.1;g.add(pl);
  const sl=new THREE.Mesh(new THREE.BoxGeometry(w-.6,.1,d-.6),slabM);sl.position.y=H+.5;g.add(sl);
  for(let f=0;f<fl;f++)for(const s of[1,-1]){
    const win=new THREE.Mesh(new THREE.PlaneGeometry(w-2,1.4),glassM);
    win.position.set(0,f*3.4+1.9,s*(d/2+.02));if(s<0)win.rotation.y=Math.PI;g.add(win);
  }
  if(o.flag){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,9,6),poleM);p.position.set(w/2+2,4.5,d/2+2);g.add(p);
    const f=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.2),flagM);f.position.set(w/2+2.95,8.2,d/2+2);g.add(f);
  }
  g.userData.h=H+.9;
  return g;
}
export default {category:'Divinolândia',label:'Prédio público (Prefeitura)',build,variants:[{label:'Prefeitura',opts:{flag:true}},{label:'Escola',opts:{w:30,d:12,floors:1,color:0xd8e2c8}}]};
