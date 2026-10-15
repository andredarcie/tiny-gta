import * as THREE from 'three';
import {matte} from '../matte.ts';
import placa from './placa.ts';

// Hospital Regional de Divinolândia — the big regional hospital up on the hill south-west
// of the centre (born from the old tuberculosis sanatorium chosen for the town's mild
// mountain climate; today run by the CONDERG consortium, 100% SUS). Modelled as a long
// three-storey pavilion with ribbon windows, a perpendicular ward wing, a covered drop-off
// canopy at the entrance and the name on a sign by the road. build() is pure; the main
// façade faces +z. Footprint ~64×46 m (see HOSP_FOOT for collision).
const wallM=matte({color:0xeeeae0}),bandM=matte({color:0x2f6fa0}),glassM=matte({color:0x334450});
const roofM=matte({color:0x8f8b84}),baseM=matte({color:0xb7b0a2}),crossM=new THREE.MeshBasicMaterial({color:0xd8282a});
// collision boxes in the model frame: [cx, cz, w, d, height]
export const HOSP_FOOT:[number,number,number,number,number][]=[[0,0,60,16,11],[-22,-19,16,26,8],[0,10.5,14,5,4]];

function block(g:THREE.Group,cx:number,cz:number,w:number,d:number,floors:number):void{
  const H=floors*3.4;
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,H+4,d),wallM);b.position.set(cx,H/2-2,cz);b.castShadow=true;b.receiveShadow=true;g.add(b);
  const base=new THREE.Mesh(new THREE.BoxGeometry(w+.2,4.2,d+.2),baseM);base.position.set(cx,-.1-2+.1,cz);g.add(base);
  const r=new THREE.Mesh(new THREE.BoxGeometry(w+.6,.4,d+.6),roofM);r.position.set(cx,H+.2,cz);g.add(r);
  for(let f=0;f<floors;f++){
    const y=f*3.4+1.7;
    for(const s of[1,-1]){
      const win=new THREE.Mesh(new THREE.PlaneGeometry(w-1.4,1.3),glassM);
      win.position.set(cx,y+.2,cz+s*(d/2+.02));if(s<0)win.rotation.y=Math.PI;g.add(win);
      const band=new THREE.Mesh(new THREE.PlaneGeometry(w,.35),bandM);
      band.position.set(cx,y-.75,cz+s*(d/2+.03));if(s<0)band.rotation.y=Math.PI;g.add(band);
    }
    for(const s of[1,-1]){
      const win=new THREE.Mesh(new THREE.PlaneGeometry(d-1.4,1.3),glassM);
      win.position.set(cx+s*(w/2+.02),y+.2,cz);win.rotation.y=s*Math.PI/2;g.add(win);
    }
  }
}
function build():THREE.Group{
  const g=new THREE.Group();
  block(g,0,0,60,16,3);
  block(g,-22,-19,16,26,2);
  // entrance canopy (marquise) on pillars
  const can=new THREE.Mesh(new THREE.BoxGeometry(14,.35,5),wallM);can.position.set(0,3.6,10.5);can.castShadow=true;g.add(can);
  for(const px of[-6.5,6.5]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,3.6,8),baseM);p.position.set(px,1.8,12.6);g.add(p);}
  const door=new THREE.Mesh(new THREE.PlaneGeometry(4,2.6),glassM);door.position.set(0,1.3,8.03);g.add(door);
  // red cross panels on the façade and the roof edge
  for(const[x,y]of[[22,8.4],[-22,8.4]]){
    const v=new THREE.Mesh(new THREE.PlaneGeometry(.9,2.6),crossM),h=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.9),crossM);
    v.position.set(x,y,8.05);h.position.set(x,y,8.06);g.add(v,h);
  }
  const sign=placa.build({lines:['HOSPITAL REGIONAL','DE DIVINOLÂNDIA'],w:6,h:1.6,bg:'#f2f2ee',fg:'#1f5f96',postH:1.4});
  sign.position.set(14,0,16);g.add(sign);
  g.userData.h=12;
  return g;
}
export default {category:'Divinolândia',label:'Hospital Regional',build};
