import * as THREE from 'three';
import {matte} from '../matte.ts';
import {canvasTex} from './posto-kit.ts';

// Mahindra tractor on display in the dealer's yard at the east entrance (Street View
// entorno-s2, monumento-ciclista-s): the red bonnet with the black grille and the silver
// MAHINDRA band, red fenders over the big rear wheels, the black ROPS frame (or a canopy),
// grey engine block, the seat and wheel. Static (the drivable tractor is vehicles/tractor.ts).
// build({canopy}) is pure; +x forward, wheels on y = 0.
const red=matte({color:0xc0262a}),black=matte({color:0x1b1b1d}),grey=matte({color:0x6f7376}),tyre=matte({color:0x161616,flatShading:true});
const rimM=matte({color:0xd8c9a0});
let badge:THREE.Material|null=null;
const badgeM=():THREE.Material=>badge??=matte({map:canvasTex(256,48,(c,w,h)=>{c.fillStyle='#c0262a';c.fillRect(0,0,w,h);
  c.fillStyle='#e8e8e6';c.fillRect(0,h*.3,w,h*.4);c.fillStyle='#c0262a';c.font='900 18px Arial';c.textAlign='center';c.fillText('MAHINDRA',w/2,h*.62);})});

function wheel(g:THREE.Group,x:number,z:number,r:number,w:number):void{
  const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r,w,18),tyre);t.rotation.x=Math.PI/2;t.position.set(x,r,z);t.castShadow=true;g.add(t);
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(r*.6,r*.6,w+.02,12),rimM);rim.rotation.x=Math.PI/2;rim.position.set(x,r,z);g.add(rim);
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2,l=new THREE.Mesh(new THREE.BoxGeometry(.08,.06,w+.03),tyre);
    l.position.set(x+Math.cos(a)*r,r+Math.sin(a)*r,z);l.rotation.z=a;g.add(l);}
}
function build(o:{canopy?:boolean}={}):THREE.Group{
  const g=new THREE.Group();
  const box=(m:THREE.Material|THREE.Material[],w:number,h:number,d:number,x:number,y:number,z:number):THREE.Mesh=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=true;g.add(b);return b;};
  for(const s of[-1,1]){wheel(g,-.75,s*.78,.75,.42);wheel(g,1.05,s*.62,.42,.25);}
  box(grey,1.6,.55,.65,.35,.5,0);                                   // engine block
  box([red,red,red,black,badgeM(),badgeM()],1.55,.62,.72,.55,1.0,0);  // bonnet (badge on its sides)
  box(black,.06,.55,.6,1.34,1.02,0);                                // grille
  box(red,.9,.1,.85,1.0,1.62,0);                                    // bonnet top
  for(const s of[-1,1]){
    // the fender: the upper half of an open cylinder round the wheel's axis (z)
    const f=new THREE.Mesh(new THREE.CylinderGeometry(.85,.85,.48,14,1,true,-Math.PI/2,Math.PI),matte({color:0xc0262a,side:THREE.DoubleSide}));
    f.rotation.x=-Math.PI/2;f.position.set(-.75,.75,s*.78);g.add(f);
  }
  box(grey,.9,.25,1.2,-.6,.95,0);                                   // platform
  box(black,.45,.12,.45,-.75,1.45,0);box(black,.08,.5,.45,-.98,1.5,0);   // seat
  const col=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.7,6),black);col.position.set(-.2,1.5,0);col.rotation.z=.5;g.add(col);
  const sw=new THREE.Mesh(new THREE.TorusGeometry(.2,.025,5,14),black);sw.position.set(-.35,1.8,0);sw.rotation.set(Math.PI/2,0,-.5);g.add(sw);
  const ex=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.9,6),black);ex.position.set(.95,2.05,.25);g.add(ex);
  // ROPS frame, or a flat canopy on four posts
  for(const s of[-1,1])box(black,.08,1.6,.08,-1.1,1.0,s*.6);
  box(black,.1,.08,1.3,-1.1,2.6,0);
  if(o.canopy){for(const s of[-1,1])box(black,.06,1.5,.06,-.1,1.1,s*.6);box(red,1.4,.06,1.5,-.6,2.62,0);}
  return g;
}

export default {category:'Divinolândia',label:'Trator Mahindra',build,variants:[{label:'Arco (ROPS)',opts:{}},{label:'Com toldo',opts:{canopy:true}}]};
