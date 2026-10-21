import * as THREE from 'three';
import {matte} from '../matte.ts';

// Poste colonial — the black cast-iron lamp posts of the Praça Dr. Alcindo, from Street
// View: a moulded base, a slim fluted shaft, two curled arms carrying lanterns and a third
// lantern on top (white glass in a black frame under a little pointed cap). ~4 m tall.
// build() is pure; origin on the ground. The glass glows faintly so it reads at dusk.
const ironM=matte({color:0x1d1f22}),glassM=matte({color:0xf2efe2,emissive:0x6a5a34});
const lanternG=((): THREE.BufferGeometry[]=>{
  const body=new THREE.CylinderGeometry(.13,.09,.34,6,1,true);body.translate(0,.17,0);
  const cap=new THREE.ConeGeometry(.17,.16,6);cap.translate(0,.42,0);
  const tip=new THREE.SphereGeometry(.035,6,4);tip.translate(0,.52,0);
  const ring=new THREE.CylinderGeometry(.1,.11,.05,6);ring.translate(0,.01,0);
  return[body,cap,tip,ring];
})();
function lantern(g:THREE.Group,x:number,y:number):void{
  const [body,cap,tip,ring]=lanternG;
  const b=new THREE.Mesh(body,glassM);b.position.set(x,y,0);g.add(b);
  for(const geo of[cap,tip,ring]){const m=new THREE.Mesh(geo,ironM);m.position.set(x,y,0);g.add(m);}
}
function build():THREE.Group{
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.2,.26,.55,8),ironM);base.position.y=.275;g.add(base);
  const collar=new THREE.Mesh(new THREE.CylinderGeometry(.13,.18,.2,8),ironM);collar.position.y=.65;g.add(collar);
  const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.055,.085,2.9,8),ironM);shaft.position.y=.75+1.45;shaft.castShadow=true;g.add(shaft);
  for(const s of[-1,1]){                                   // the two curled arms
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.5,.04,.04),ironM);arm.position.set(s*.25,3.02,0);arm.rotation.z=s*.12;g.add(arm);
    const curl=new THREE.Mesh(new THREE.TorusGeometry(.09,.016,4,10),ironM);curl.position.set(s*.2,2.9,0);g.add(curl);
    lantern(g,s*.48,3.06);
  }
  lantern(g,0,3.65);
  return g;
}
export default {category:'Divinolândia',label:'Poste colonial (praça)',build};
