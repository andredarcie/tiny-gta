import * as THREE from 'three';
import {matte} from '../matte.ts';
import {leafMat,leafMass} from './copa.ts';

// Árvores da praça — the big old trees of the Matriz squares, sized from the satellite
// canopies: broad shade trees (sibipirunas / oitis, a trunk forking into limbs under a wide
// flat crown made of several leaf masses), the dark wine-red tree of the Praça Dr. Alcindo,
// the Italian cypresses along the church's west lawn, and young ipês in flower.
// build({kind,r,h,seed}) is pure; r = crown radius, h = crown top; origin at the trunk foot.
export type ArvorePracaKind='copa'|'vinho'|'cipreste'|'ipe';
// colours measured on the square's Street View frames (sunlit canopy ~#5f7342, shade #2e3d30)
const barkM=matte({color:0x5a4a3e}),cypressM=leafMat(0x3d5634);
const leafMs=[0x4a6236,0x55703e,0x3f5730,0x5c7442].map(c=>leafMat(c));
const wineM=leafMat(0x55302f),ipeM=leafMat(0xd2a93a);
const blobGs=[1,2,3].map(k=>leafMass(k,.26,2));

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
    const c=new THREE.Mesh(leafMass(4,.16,2,5),cypressM);c.scale.set(.75,h/2-.4,.75);c.position.y=h/2+.5;c.castShadow=true;g.add(c);
    return g;
  }
  // The Street View frames of the squares show old shade trees with a short trunk (crown from
  // ~2.5 m on young trees to ~4.5 m on the old giants), a deep rounded crown about as tall as it is wide, lumpy, its lower masses
  // hanging out past the limbs: the leaf masses fill an ellipsoid, not a flat ring on top.
  const base=Math.max(2.2,Math.min(5,1.8+r*.28)),h=o.h??Math.min(15,base+r*1.2);
  const trunkR=.18+r*.035,fork=new THREE.Vector3((rnd()-.5)*.6,base*.85,(rnd()-.5)*.6);
  limb(g,new THREE.Vector3(0,0,0),fork,trunkR*1.25,trunkR);
  const mats=kind==='vinho'?[wineM]:kind==='ipe'?[ipeM,leafMs[1]]:leafMs;
  const cy=(base+h)/2+.2,ry=(h-base)/2;                          // the crown ellipsoid: centre height, half height
  const masses:[number,number,number,number][]=[[0,cy+ry*.25,0,r*.66]];
  const n=kind==='ipe'?5:Math.max(6,Math.round(r*1.4));
  for(let i=0;i<n;i++){
    // spread over the ellipsoid: azimuth round the crown, elevation from just under the
    // equator (the hanging lower masses) up to the shoulders
    const a=i/n*Math.PI*2+rnd()*.8,e=-.35+rnd()*1.05,d=r*(.62+rnd()*.18)*Math.cos(e);
    masses.push([Math.cos(a)*d,cy+Math.sin(e)*ry*.85,Math.sin(a)*d,r*(.36+rnd()*.16)]);
  }
  for(let i=0;i<Math.round(n/4);i++){const a=rnd()*Math.PI*2,d=r*.25*rnd();masses.push([Math.cos(a)*d,cy+ry*(.45+rnd()*.3),Math.sin(a)*d,r*(.4+rnd()*.12)]);}   // the top
  masses.forEach(([x,y,z,s],i)=>{
    const m=new THREE.Mesh(blobGs[i%blobGs.length],mats[i%mats.length]);m.position.set(x,y,z);m.scale.set(s,s*(.78+rnd()*.14),s);m.rotation.y=rnd()*3;m.castShadow=true;g.add(m);
    if(i>0&&i<=n&&i%3===1)limb(g,fork,new THREE.Vector3(x*.6,Math.max(fork.y+.6,y-s*.5),z*.6),trunkR*.7,trunkR*.35);
  });
  return g;
}
export default {category:'Divinolândia',label:'Árvore da praça',build,variants:[
  {label:'Copa larga',opts:{kind:'copa',r:7}},{label:'Vinho',opts:{kind:'vinho',r:5}},
  {label:'Cipreste',opts:{kind:'cipreste',h:8}},{label:'Ipê',opts:{kind:'ipe',r:2.5}}]};
