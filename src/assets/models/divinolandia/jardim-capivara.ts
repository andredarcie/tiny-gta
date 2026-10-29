import * as THREE from 'three';
import {matte} from '../matte.ts';
import {leafMat,leafMass} from './copa.ts';

// Jardim da capivara — the front of house nº 667 on the Rua Joaquim Garcia, across from the
// Colégio Objetivo. The Street View frame (jg-S-052) shows the roughcast beige house with the
// green recessed porch and the barred arched window; the owner has since put a CAPYBARA statue
// in the little forecourt and dressed the façade with plants (told by the user, 2026-10-29):
// a painted-cement capybara on a low round base, pots on the window sill, a planter bed along
// the wall under the window, a fern hanging in the porch and a potted dracena by the path.
// build() is pure. Frame = the street lot's façade frame (fachada.ts): z=0 is the front fence
// at the sidewalk, +z the street, the house wall stands at z=-2 (setback 2), x left→right as
// seen from the street (the porch at x≈-1.4, the window at x≈+1.8), y=0 the sidewalk top.
const fur=matte({color:0x8a6648}),furDark=matte({color:0x6e5038}),nose=matte({color:0x3a2c22});
const eye=matte({color:0x141210}),base=matte({color:0xb8b4ac});
const clay=matte({color:0xb0603f}),clayDark=matte({color:0x8a4630}),soil=matte({color:0x4a3a2c});
const green=leafMat(0x4f7a3a),deep=leafMat(0x2f5228),fern=leafMat(0x5f8a3e),dracena=leafMat(0x6a3a4a);
const red=leafMat(0xc23a3a),pink=leafMat(0xd06a9a),yellow=leafMat(0xe0c040);
const chain=matte({color:0x5a5a5a});

const add=(g:THREE.Group,m:THREE.Mesh,x:number,y:number,z:number):THREE.Mesh=>{m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
const ell=(rx:number,ry:number,rz:number,mat:THREE.Material):THREE.Mesh=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,14,10),mat);m.scale.set(rx,ry,rz);return m;};

// the capybara: barrel body, blunt square head with the snout low, small round ears, short legs
// (life-size-ish garden statue, ~0.8 m long), on a round cement base; looks along local +x
function capivara():THREE.Group{
  const g=new THREE.Group();
  add(g,new THREE.Mesh(new THREE.CylinderGeometry(.34,.38,.16,18),base),0,.08,0);
  const y0=.16;
  add(g,ell(.36,.22,.21,fur),-.02,y0+.34,0);                        // body
  add(g,ell(.2,.2,.19,fur),-.26,y0+.33,0);                          // rump
  for(const[x,z]of[[.2,.11],[.2,-.11],[-.24,.12],[-.24,-.12]])
    add(g,new THREE.Mesh(new THREE.CylinderGeometry(.05,.045,.2,8),furDark),x,y0+.1,z);
  const head=new THREE.Group();head.position.set(.36,y0+.44,0);head.rotation.z=-.18;g.add(head);
  add(head,ell(.16,.12,.11,fur),.04,0,0);
  add(head,new THREE.Mesh(new THREE.BoxGeometry(.16,.15,.17),fur),.16,-.03,0);   // the blunt muzzle
  add(head,ell(.03,.035,.06,nose),.245,-.01,0);
  for(const z of[.075,-.075]){
    add(head,ell(.022,.022,.022,eye),.1,.05,z);
    add(head,ell(.03,.035,.018,furDark),-.04,.11,z*1.05);            // ears
  }
  return g;
}
// a terracotta pot with a leafy plant (flowers optional)
function vaso(r:number,h:number,leaf:THREE.Material,size:number,bloom?:THREE.Material):THREE.Group{
  const g=new THREE.Group();
  add(g,new THREE.Mesh(new THREE.CylinderGeometry(r,r*.75,h,12),clay),0,h/2,0);
  add(g,new THREE.Mesh(new THREE.CylinderGeometry(r*1.06,r*1.06,.03,12),clayDark),0,h,0);
  add(g,new THREE.Mesh(leafMass(3,.3,2),leaf),0,h+size*.55,0).scale.setScalar(size);
  if(bloom)for(let i=0;i<4;i++){const a=i*1.7;add(g,new THREE.Mesh(leafMass(5,.2,1),bloom),Math.cos(a)*size*.6,h+size*.8,Math.sin(a)*size*.6).scale.setScalar(size*.28);}
  return g;
}
function build():THREE.Group{
  const g=new THREE.Group();
  // the capybara in the forecourt, between the path to the porch and the window, half turned
  // toward the street so it is seen through the fence bars
  const c=capivara();c.position.set(.7,0,-.95);c.rotation.y=-.6;g.add(c);
  // the planter bed along the wall under the window: a low brick kerb, soil, a row of plants
  add(g,new THREE.Mesh(new THREE.BoxGeometry(2.6,.25,.45),clayDark),1.8,.125,-1.75);
  add(g,new THREE.Mesh(new THREE.BoxGeometry(2.5,.04,.38),soil),1.8,.25,-1.75);
  const bed:[number,THREE.Material,THREE.Material|undefined][]=[[.75,green,red],[1.35,deep,undefined],[1.95,green,pink],[2.55,deep,yellow],[3.0,green,red]];
  for(const[x,m,b]of bed){
    add(g,new THREE.Mesh(leafMass(Math.round(x*10),.28,2),m),x,.5,-1.75).scale.set(.32,.28,.22);
    if(b)for(let i=0;i<3;i++)add(g,new THREE.Mesh(leafMass(7,.2,1),b),x+(i-1)*.12,.7+(i%2)*.06,-1.62).scale.setScalar(.07);
  }
  // pots on the window sill (sill at y=1.0 on the wall z=-2)
  for(const[x,bl]of[[1.2,red],[1.8,undefined],[2.4,pink]]as[number,THREE.Material|undefined][]){
    const v=vaso(.1,.16,green,.16,bl);v.position.set(x,1.0,-1.92);g.add(v);}
  // the fern hanging in the porch, from the lintel
  const f=new THREE.Group();f.position.set(-1.4,2.0,-1.75);g.add(f);
  add(f,new THREE.Mesh(new THREE.CylinderGeometry(.005,.005,.3,4),chain),0,.15,0);
  add(f,new THREE.Mesh(new THREE.CylinderGeometry(.14,.1,.16,12),clay),0,-.08,0);
  add(f,new THREE.Mesh(leafMass(11,.4,2),fern),0,-.22,0).scale.set(.32,.26,.32);
  // potted plants by the path: a dracena (purple leaves) and a fern on a stand
  const d=vaso(.17,.32,dracena,.3);d.position.set(-.1,0,-.5);g.add(d);
  const p=vaso(.16,.3,fern,.3);p.position.set(-3.1,0,-1.6);g.add(p);
  return g;
}
// the capybara statue's footprint in this frame [x0,x1,z0,z1,top], for collision
export const CAPIVARA_SOLIDS:[number,number,number,number,number][]=[[.3,1.1,-1.3,-.6,.7]];
export default {category:'Divinolândia',label:'Jardim da capivara (casa 667)',build};
