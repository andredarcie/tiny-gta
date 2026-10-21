import * as THREE from 'three';
import {matte} from '../matte.ts';

// Chafariz — the fountain in the middle of the Praça Dr. Alcindo Cardoso de Paiva, from
// the satellite (a 13.6 m paved circle, the basin ring) and Street View: a wide round
// basin behind a low white rim, pale turquoise water, a raised white bowl on a fluted
// pedestal in the middle with a smaller bowl and the jet on top, low clipped hedges in
// planters round the rim. build() is pure; origin at the centre on the ground (the base
// sinks .6 m so the basin sits flush on a slope).
const rimM=matte({color:0xeeebe4,side:THREE.DoubleSide}),stoneM=matte({color:0xd8d3c8}),waterM=matte({color:0x7fb7b4,emissive:0x0b1a1a});
const hedgeM=matte({color:0x3f6b32,flatShading:true}),jetM=new THREE.MeshLambertMaterial({color:0xe9f4f6,transparent:true,opacity:.6});
export const CHAFARIZ_R=6.8;
function build():THREE.Group{
  const g=new THREE.Group(),R=5.4;
  const pave=new THREE.Mesh(new THREE.CylinderGeometry(CHAFARIZ_R,CHAFARIZ_R,.7,40),stoneM);pave.position.y=-.32;pave.receiveShadow=true;g.add(pave);
  // basin rim: a ring wall .55 m high, wider coping on top
  const rim=new THREE.Mesh(new THREE.CylinderGeometry(R,R,1.15,48,1,true),rimM);rim.position.y=-.03;g.add(rim);
  const rimIn=new THREE.Mesh(new THREE.CylinderGeometry(R-.3,R-.3,1.15,48,1,true),rimM);rimIn.position.y=-.03;g.add(rimIn);
  const cope=new THREE.Mesh(new THREE.RingGeometry(R-.38,R+.08,48),rimM);cope.rotation.x=-Math.PI/2;cope.position.y=.55;g.add(cope);
  const water=new THREE.Mesh(new THREE.CircleGeometry(R-.3,48),waterM);water.rotation.x=-Math.PI/2;water.position.y=.32;g.add(water);
  // central pedestal + big bowl + small bowl + jet
  const ped=new THREE.Mesh(new THREE.CylinderGeometry(.45,.7,1.5,12),rimM);ped.position.y=.9;g.add(ped);
  const bowl=new THREE.Mesh(new THREE.CylinderGeometry(1.9,.9,.6,24),rimM);bowl.position.y=1.85;bowl.castShadow=true;g.add(bowl);
  const bw=new THREE.Mesh(new THREE.CircleGeometry(1.75,24),waterM);bw.rotation.x=-Math.PI/2;bw.position.y=2.1;g.add(bw);
  const ped2=new THREE.Mesh(new THREE.CylinderGeometry(.22,.32,.7,10),rimM);ped2.position.y=2.45;g.add(ped2);
  const bowl2=new THREE.Mesh(new THREE.CylinderGeometry(.8,.35,.3,16),rimM);bowl2.position.y=2.9;g.add(bowl2);
  const jet=new THREE.Mesh(new THREE.ConeGeometry(.12,1.3,8),jetM);jet.position.y=3.65;g.add(jet);
  // the falling sheet off the big bowl
  const sheet=new THREE.Mesh(new THREE.CylinderGeometry(1.95,2.1,1.5,24,1,true),jetM);sheet.position.y=1.05;g.add(sheet);
  // clipped hedges in low planters round the rim, broken by four openings
  for(let i=0;i<4;i++){
    const a0=i*Math.PI/2+.32,len=Math.PI/2-.64;
    const h=new THREE.Mesh(new THREE.TorusGeometry(R+.75,.38,5,14,len),hedgeM);h.rotation.x=-Math.PI/2;h.rotation.z=a0;h.position.y=.2;h.scale.z=.9;g.add(h);
  }
  return g;
}
export default {category:'Divinolândia',label:'Chafariz da praça',build};
