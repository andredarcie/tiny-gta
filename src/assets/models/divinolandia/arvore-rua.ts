import * as THREE from 'three';
import {matte} from '../matte.ts';

// Street trees of Divinolândia's centre, as they stand on the sidewalks in Street View:
//  - resedá (crape myrtle): small, multi-stemmed, a cloud of PINK (or white) blossom —
//    the signature colour of the town's streets in spring/summer;
//  - fícus / oiti: a dense dark-green rounded crown on a short thick trunk;
//  - palmeira: the tall clumped palms in corner gardens.
const trunk=matte({color:0x6e5a48}),palmTrunk=matte({color:0x8d8170});
const leaf=matte({color:0x3f6e33,flatShading:true}),ficus=matte({color:0x2f5a2c,flatShading:true});
const pink=matte({color:0xd76a9c,flatShading:true}),white=matte({color:0xf1eef2,flatShading:true}),frond=matte({color:0x4f7d3a,side:THREE.DoubleSide});
export type ArvoreKind='reseda'|'resedaBranca'|'ficus'|'palmeira';

function build(o:{kind?:ArvoreKind}={}):THREE.Group{
  const g=new THREE.Group(),k=o.kind||'reseda';
  if(k==='palmeira'){
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.16,.24,9,7),palmTrunk);t.position.y=4.5;g.add(t);
    for(let i=0;i<9;i++){
      const f=new THREE.Mesh(new THREE.PlaneGeometry(.7,3.6),frond);
      f.position.set(0,9,0);f.rotation.set(-1.0,i/9*Math.PI*2,0,'YXZ');f.translateY(1.6);g.add(f);
    }
    return g;
  }
  if(k==='ficus'){
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.25,.4,2.6,7),trunk);t.position.y=1.3;g.add(t);
    for(const[x,y,z,r]of[[0,4.2,0,2.6],[1.4,3.8,.4,1.9],[-1.3,3.9,-.3,2],[.2,5.2,-.8,1.7]]){
      const c=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),ficus);c.position.set(x,y,z);c.castShadow=true;g.add(c);}
    return g;
  }
  // resedá: 3 slender stems fanning out + blossom clusters
  const bloom=k==='resedaBranca'?white:pink;
  for(const a of[0,2.1,4.2]){
    const s=new THREE.Mesh(new THREE.CylinderGeometry(.06,.1,2.6,5),trunk);
    s.position.set(Math.cos(a)*.25,1.3,Math.sin(a)*.25);s.rotation.set(Math.sin(a)*.2,0,Math.cos(a)*.2);g.add(s);
  }
  for(const[x,y,z,r]of[[0,3.2,0,1.3],[.9,2.8,.3,.9],[-.8,2.9,-.4,1],[.2,3.7,.6,.8],[-.3,2.5,.9,.7]]){
    const c=new THREE.Mesh(new THREE.IcosahedronGeometry(r,1),y>3?bloom:(x>0?bloom:leaf));c.position.set(x,y,z);c.castShadow=true;g.add(c);}
  return g;
}
export default {category:'Divinolândia',label:'Árvore de rua',build,variants:[
  {label:'Resedá (rosa)',opts:{kind:'reseda'}},{label:'Resedá (branca)',opts:{kind:'resedaBranca'}},
  {label:'Fícus',opts:{kind:'ficus'}},{label:'Palmeira',opts:{kind:'palmeira'}}]};
