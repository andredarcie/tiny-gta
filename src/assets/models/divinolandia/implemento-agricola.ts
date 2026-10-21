import * as THREE from 'three';
import {matte} from '../matte.ts';
import {canvasTex} from './posto-kit.ts';

// Farm implements on display in the Mahindra yard at the east entrance (Street View
// entorno-s2 / -mah): the orange trailed SPRAYER (tank on a two-wheel chassis, folded
// booms), the blue mounted sprayer, the green box SPREADER, the black-and-red "THOR 5000"
// trailer and the black hydraulic LOADER arm. build({kind}) is pure; +x = drawbar end,
// wheels / feet on y = 0.
export type ImplKind='pulverizador'|'pulverizadorAzul'|'distribuidor'|'carreta'|'carregador';
const mats=new Map<string,THREE.Material>();
const M=(c:string):THREE.Material=>{let m=mats.get(c);if(!m){m=matte({color:c});mats.set(c,m);}return m;};
const tyre=matte({color:0x161616});

function build(o:{kind?:ImplKind}={}):THREE.Group{
  const g=new THREE.Group(),k=o.kind??'pulverizador';
  const box=(c:string|THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number,ry=0):THREE.Mesh=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),typeof c==='string'?M(c):c);b.position.set(x,y+h/2,z);b.rotation.y=ry;b.castShadow=true;g.add(b);return b;};
  const wheel=(x:number,z:number,r:number,w:number):void=>{const t=new THREE.Mesh(new THREE.CylinderGeometry(r,r,w,14),tyre);t.rotation.x=Math.PI/2;t.position.set(x,r,z);g.add(t);
    const h=new THREE.Mesh(new THREE.CylinderGeometry(r*.5,r*.5,w+.02,10),M('#c9c9c4'));h.rotation.x=Math.PI/2;h.position.set(x,r,z);g.add(h);};
  const bar=(c:string,a:THREE.Vector3,b:THREE.Vector3,r:number):void=>{const l=a.distanceTo(b),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,l,6),M(c));
    m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());g.add(m);};
  if(k==='pulverizador'||k==='pulverizadorAzul'){
    const c=k==='pulverizador'?'#e0731f':'#2457a8';
    for(const s of[-1,1])wheel(-.4,s*.95,.55,.3);
    box('#2a2a2a',3.4,.18,.9,.2,.55,0);bar('#2a2a2a',new THREE.Vector3(1.8,.64,0),new THREE.Vector3(3,.5,0),.05);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.75,.75,2.4,16),M(c));t.rotation.z=Math.PI/2;t.position.set(.1,1.5,0);t.castShadow=true;g.add(t);
    box(c,.5,.25,.5,.1,2.2,0);                                          // filler lid
    // the folded booms standing at the back
    for(const s of[-1,1]){box('#3a3a3a',.08,2.2,.08,-1.25,.7,s*.7);bar('#3a3a3a',new THREE.Vector3(-1.25,2.9,s*.7),new THREE.Vector3(-1.3,.8,s*.2),.03);}
    box('#3a3a3a',.08,.08,1.6,-1.25,2.85,0);
  }else if(k==='distribuidor'){
    for(const s of[-1,1])wheel(-.3,s*.85,.45,.25);
    const hop=new THREE.Mesh(new THREE.CylinderGeometry(1,.45,1.2,4,1),M('#2f7a3a'));hop.rotation.y=Math.PI/4;hop.position.set(-.2,1.6,0);hop.castShadow=true;g.add(hop);
    box('#2a2a2a',2.4,.15,.6,.3,.6,0);box('#c9c9c4',.5,.3,.5,-.2,.85,0);
  }else if(k==='carreta'){
    for(const s of[-1,1])for(const x of[-.6,.3])wheel(x,s*.95,.42,.28);
    const t=matte({map:canvasTex(256,64,(c,w,h)=>{c.fillStyle='#1d1d1f';c.fillRect(0,0,w,h);c.fillStyle='#d0262a';c.fillRect(0,h*.7,w,h*.12);
      c.fillStyle='#e9e9e7';c.font='900 30px Arial';c.textAlign='center';c.fillText('THOR 5000',w/2,h*.55);})});
    const side=new THREE.Mesh(new THREE.BoxGeometry(3.4,1.1,1.9),[M('#1d1d1f'),M('#1d1d1f'),M('#1d1d1f'),M('#1d1d1f'),t,t]);side.position.set(-.1,1.45,0);side.castShadow=true;g.add(side);
    box('#c0262a',3.5,.12,2,-.1,.85,0);bar('#c0262a',new THREE.Vector3(1.6,.95,0),new THREE.Vector3(2.8,.55,0),.06);
  }else{                                                                // carregador: frame + boom + bucket
    box('#1d1d1f',1.4,.2,1.4,0,0,0);box('#1d1d1f',.3,1.5,.3,0,.2,0);
    bar('#1d1d1f',new THREE.Vector3(0,1.6,0),new THREE.Vector3(1.6,3.1,0),.12);bar('#1d1d1f',new THREE.Vector3(1.6,3.1,0),new THREE.Vector3(2.3,1.6,0),.1);
    bar('#c9c9c4',new THREE.Vector3(.3,1.1,0),new THREE.Vector3(1.4,2.7,0),.05);
    box('#1d1d1f',.6,.5,.9,2.4,1.1,0);
  }
  return g;
}

export default {category:'Divinolândia',label:'Implemento agrícola',build,variants:[
  {label:'Pulverizador laranja',opts:{kind:'pulverizador'}},{label:'Pulverizador azul',opts:{kind:'pulverizadorAzul'}},
  {label:'Distribuidor',opts:{kind:'distribuidor'}},{label:'Carreta THOR 5000',opts:{kind:'carreta'}},{label:'Carregador',opts:{kind:'carregador'}}]};
