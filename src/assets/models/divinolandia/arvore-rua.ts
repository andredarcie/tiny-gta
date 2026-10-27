import * as THREE from 'three';
import Palmeira from './palmeira-imperial.ts';
import {matte} from '../matte.ts';
import {leafMat,leafMass} from './copa.ts';

// Street trees of Divinolândia's centre, as they stand on the sidewalks in Street View:
//  - resedá (crape myrtle): small, multi-stemmed, a cloud of PINK (or white) blossom —
//    the signature colour of the town's streets in spring/summer;
//  - fícus / oiti: a dense dark-green rounded crown on a short thick trunk;
//  - palmeira: the jerivá of the gardens and squares (palmeira-imperial.ts, jeriva).
const trunk=matte({color:0x6e5a48});
const leaf=leafMat(0x46603a),ficus=leafMat(0x2f4428);
const pink=leafMat(0xc87a9c),white=leafMat(0xe8e4e6);
export type ArvoreKind='reseda'|'resedaBranca'|'ficus'|'palmeira';

let made=0;
function build(o:{kind?:ArvoreKind;h?:number;seed?:number}={}):THREE.Group{
  const g=new THREE.Group(),k=o.kind||'reseda';
  if(k==='palmeira')return Palmeira.build({jeriva:true,h:o.h??8.5,seed:o.seed});   // the jerivá (palmeira-imperial.ts)
  if(k==='ficus'){
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.25,.4,2.6,7),trunk);t.position.y=1.3;g.add(t);
    for(const[x,y,z,r]of[[0,4.2,0,2.6],[1.4,3.8,.4,1.9],[-1.3,3.9,-.3,2],[.2,5.2,-.8,1.7]]){
      const c=new THREE.Mesh(leafMass(1+(x>0?1:0),.24,2),ficus);c.scale.setScalar(r);c.position.set(x,y,z);c.castShadow=true;g.add(c);}
    return g;
  }
  // resedá (Lagerstroemia): in the Street View frames of the squares and streets (pub-galhano,
  // pub-pedroribeiro, the surveyed streets) a young street tree ~3.5 m tall, a single slender
  // grey stem forking at ~1.5 m into a few thin branches, an airy crown of small green leaf
  // clumps with the flower panicles sprinkled over its top and edges, sky showing through
  const bloom=k==='resedaBranca'?white:pink,sd=o.seed??++made;   // (no seed: each new tree differs, in build order)
  const rnd=((a:number)=>()=>{a=(a*16807)%2147483647;return a/2147483647;})(sd*9301+49297);
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.05,.08,1.6,6),trunk);stem.position.y=.8;g.add(stem);
  for(let i=0;i<4;i++){const a=i*1.6+rnd(),l=1.2+rnd()*.5,tilt=.35+rnd()*.25;
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.025,.045,l,5),trunk);
    b.position.set(Math.cos(a)*Math.sin(tilt)*l/2,1.6+Math.cos(tilt)*l/2,Math.sin(a)*Math.sin(tilt)*l/2);b.rotation.set(Math.sin(a)*tilt,0,-Math.cos(a)*tilt);g.add(b);}
  for(let i=0;i<11;i++){
    const a=rnd()*Math.PI*2,d=.35+rnd()*.85,y=2.3+rnd()*1.3,top=y>2.9||d>.85;
    const c=new THREE.Mesh(leafMass(1+i%3,.32,2),top&&rnd()<.75?bloom:leaf);c.scale.setScalar(.38+rnd()*.28);c.scale.y*=.8;
    c.position.set(Math.cos(a)*d,y,Math.sin(a)*d);c.castShadow=true;g.add(c);}
  return g;
}
export default {category:'Divinolândia',label:'Árvore de rua',build,variants:[
  {label:'Resedá (rosa)',opts:{kind:'reseda'}},{label:'Resedá (branca)',opts:{kind:'resedaBranca'}},
  {label:'Fícus',opts:{kind:'ficus'}},{label:'Palmeira',opts:{kind:'palmeira'}}]};
