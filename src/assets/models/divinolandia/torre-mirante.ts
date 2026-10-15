import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';

// Torre do Morro da Torre — the tall telecom lattice tower on the 1380 m hilltop south
// of town, the famous mirante: from up there you see Divinolândia and São Sebastião da
// Grama by day and the lights of the neighbouring towns by night. A tapering 4-leg
// steel lattice painted in aviation red/white bands, antennas and dishes on top, a red
// obstruction beacon (glows at night), a fenced equipment yard, and beside it the
// mirante: a small timber deck with a rail and a bench looking over the town.
// build() is pure; +z of the deck faces the view (the town).
const red=matte({color:0xc23a2e}),white=matte({color:0xece9e1}),steel=matte({color:0x9da3a8});
const fenceM=matte({color:0x7d8287}),deckM=matte({color:0x8a6040}),hutM=matte({color:0xd9d4c6}),roofM=matte({color:DIVINO.slab});
export const beaconMat=new THREE.MeshBasicMaterial({color:0xff3322});
export const TORRE_H=72;

function lattice(g:THREE.Group,H:number):void{
  const base=5.2,top=1.1,bands=12;
  const half=(y:number):number=>base/2+(top/2-base/2)*(y/H);
  const legs:[number,number][]=[[1,1],[1,-1],[-1,1],[-1,-1]];
  for(let b=0;b<bands;b++){
    const y0=b*H/bands,y1=(b+1)*H/bands,m=b%2?white:red;
    const h0=half(y0),h1=half(y1),len=Math.hypot(y1-y0,h0-h1);
    for(const[sx,sz]of legs){                                        // leg segment
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.1,.13,len,5),m);
      leg.position.set(sx*(h0+h1)/2,(y0+y1)/2,sz*(h0+h1)/2);
      leg.lookAt(sx*h1,y1,sz*h1);leg.rotateX(Math.PI/2);    // align the cylinder with the leg
      g.add(leg);
    }
    // X bracing on the 4 faces
    for(let f=0;f<4;f++){
      const ax=f<2?1:0,s=f%2?1:-1;
      for(const dir of[1,-1]){
        const p0=new THREE.Vector3(),p1=new THREE.Vector3();
        if(ax){p0.set(s*h0,y0,-dir*h0);p1.set(s*h1,y1,dir*h1);}else{p0.set(-dir*h0,y0,s*h0);p1.set(dir*h1,y1,s*h1);}
        const br=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,p0.distanceTo(p1),4),steel);
        br.position.copy(p0).add(p1).multiplyScalar(.5);br.lookAt(p1);br.rotateX(Math.PI/2);g.add(br);
      }
    }
    const ring=new THREE.Mesh(new THREE.BoxGeometry(h1*2+.2,.12,h1*2+.2),steel);ring.position.y=y1;g.add(ring);
  }
}

function build():THREE.Group{
  const g=new THREE.Group(),H=TORRE_H;
  lattice(g,H);
  // antennas, panels and dishes up top
  const mast=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,8,6),white);mast.position.y=H+4;g.add(mast);
  for(let k=0;k<4;k++){
    const a=k*Math.PI/2+.4;
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.4,2.2,.12),white);
    panel.position.set(Math.cos(a)*.9,H-1.6,Math.sin(a)*.9);panel.rotation.y=-a;g.add(panel);
    const dish=new THREE.Mesh(new THREE.CylinderGeometry(.7,.35,.25,12),white);
    dish.position.set(Math.cos(a+.8)*1.3,H-8-k*3,Math.sin(a+.8)*1.3);dish.rotation.set(Math.PI/2,0,-a-.8);g.add(dish);
  }
  const beacon=new THREE.Mesh(new THREE.SphereGeometry(.35,10,8),beaconMat);beacon.position.y=H+8.3;g.add(beacon);
  const mid=new THREE.Mesh(new THREE.SphereGeometry(.25,8,6),beaconMat);mid.position.set(1.9,H*.5,1.9);g.add(mid);
  // equipment yard: hut + chain-link fence
  const hut=new THREE.Mesh(new THREE.BoxGeometry(4,2.8,3),hutM);hut.position.set(-6.5,1.4,-5);hut.castShadow=true;g.add(hut);
  const hr=new THREE.Mesh(new THREE.BoxGeometry(4.4,.2,3.4),roofM);hr.position.set(-6.5,2.9,-5);g.add(hr);
  const F=10;
  for(const[x0,z0,x1,z1]of[[-F,-F,F,-F],[F,-F,F,F],[-F,F,-F,-F]] as [number,number,number,number][]){
    const L=Math.hypot(x1-x0,z1-z0);
    const net=new THREE.Mesh(new THREE.BoxGeometry(L,2.2,.04),fenceM);
    net.position.set((x0+x1)/2,1.1,(z0+z1)/2);net.rotation.y=-Math.atan2(z1-z0,x1-x0);g.add(net);
  }
  const front=new THREE.Mesh(new THREE.BoxGeometry(F*2-5,2.2,.04),fenceM);front.position.set(-2.5,1.1,F);g.add(front); // gate gap on the deck side
  // mirante deck in front of the yard, facing +z (the town)
  const deck=new THREE.Mesh(new THREE.BoxGeometry(8,.25,4),deckM);deck.position.set(4,.6,F+5);deck.castShadow=true;g.add(deck);
  for(const[px,pz]of[[0.3,F+3.2],[7.7,F+3.2],[0.3,F+6.8],[7.7,F+6.8]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.2,.8,.2),deckM);leg.position.set(px,.2,pz);g.add(leg);
  }
  const rail=new THREE.Mesh(new THREE.BoxGeometry(8,.1,.1),deckM);rail.position.set(4,1.7,F+7);g.add(rail);
  for(let k=0;k<5;k++){const p=new THREE.Mesh(new THREE.BoxGeometry(.1,1.1,.1),deckM);p.position.set(.1+k*1.95,1.2,F+7);g.add(p);}
  const bench=new THREE.Mesh(new THREE.BoxGeometry(3,.12,.5),deckM);bench.position.set(4,1.2,F+4);g.add(bench);
  g.userData.h=H+9;
  return g;
}
export default {category:'Divinolândia',label:'Torre do Mirante (Morro da Torre)',build};
