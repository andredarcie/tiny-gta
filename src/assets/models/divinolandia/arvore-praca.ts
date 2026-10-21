import * as THREE from 'three';
import {matte} from '../matte.ts';

// Árvores da praça — the big old trees of the Matriz squares, sized from the satellite
// canopies: broad shade trees (sibipirunas / oitis, a trunk forking into limbs under a wide
// flat crown made of several leaf masses), the dark wine-red tree of the Praça Dr. Alcindo,
// the Italian cypresses along the church's west lawn, and young ipês in flower.
// build({kind,r,h,seed}) is pure; r = crown radius, h = crown top; origin at the trunk foot.
export type ArvorePracaKind='copa'|'vinho'|'cipreste'|'ipe';
const barkM=matte({color:0x6a5646}),cypressM=matte({color:0x2f4f2a,flatShading:true});
const leafMs=[0x4f8a3c,0x5c9645,0x467d36,0x6a9a48].map(c=>matte({color:c,flatShading:true}));
const wineM=matte({color:0x6b3138,flatShading:true}),ipeM=matte({color:0xe0b62e,flatShading:true});
const blobG=new THREE.IcosahedronGeometry(1,1);

function rng(seed:number):()=>number{let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function limb(g:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r0:number,r1:number):void{
  const len=a.distanceTo(b),m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,len,6),barkM);
  m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());m.castShadow=true;g.add(m);
}
function build(o:{kind?:ArvorePracaKind;r?:number;h?:number;seed?:number}={}):THREE.Group{
  const g=new THREE.Group(),kind=o.kind||'copa',r=o.r??6,rnd=rng(o.seed??1);
  if(kind==='cipreste'){
    const h=o.h??8;
    limb(g,new THREE.Vector3(0,0,0),new THREE.Vector3(0,1.2,0),.14,.12);
    const c=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),cypressM);c.scale.set(.75,h/2-.4,.75);c.position.y=h/2+.5;c.castShadow=true;g.add(c);
    return g;
  }
  const h=o.h??Math.min(13,4.5+r*.95),base=Math.max(2.6,h-r*.95-1.2);
  const trunkR=.18+r*.035,fork=new THREE.Vector3((rnd()-.5)*.6,base*.7,(rnd()-.5)*.6);
  limb(g,new THREE.Vector3(0,0,0),fork,trunkR*1.25,trunkR);
  const mats=kind==='vinho'?[wineM]:kind==='ipe'?[ipeM,leafMs[1]]:leafMs;
  const n=kind==='ipe'?4:Math.max(4,Math.round(r*.9));
  // central mass + a ring of masses, each fed by a limb from the fork
  const masses:[number,number,number,number][]=[[0,h-r*.42,0,r*.62]];
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2+rnd()*.6,d=r*(.48+rnd()*.2);masses.push([Math.cos(a)*d,h-r*.55+rnd()*r*.18,Math.sin(a)*d,r*(.42+rnd()*.14)]);}
  masses.forEach(([x,y,z,s],i)=>{
    const m=new THREE.Mesh(blobG,mats[i%mats.length]);m.position.set(x,y,z);m.scale.set(s,s*.62,s);m.rotation.y=rnd()*3;m.castShadow=true;g.add(m);
    if(i>0&&i%2===1)limb(g,fork,new THREE.Vector3(x*.7,y-s*.4,z*.7),trunkR*.7,trunkR*.35);
  });
  return g;
}
export default {category:'Divinolândia',label:'Árvore da praça',build,variants:[
  {label:'Copa larga',opts:{kind:'copa',r:7}},{label:'Vinho',opts:{kind:'vinho',r:5}},
  {label:'Cipreste',opts:{kind:'cipreste',h:8}},{label:'Ipê',opts:{kind:'ipe',r:2.5}}]};
