import * as THREE from 'three';
import {matte} from '../matte.ts';

// Steel cyclist of the Monumento ao Ciclista (monumento-ciclista.ts), from Street View: a
// life-size mountain biker welded from stainless-steel sheet — faceted body panels, ribbed
// helmet, the bike with thin wheels, knobbly tyres and a straight bar. Low-segment shapes
// with flat shading give the plate facets; the steel is a pale grey that catches the sky.
// build({pedal}) is pure: the bike runs along +x, wheels on y = 0, the rider in the saddle.
// pedal (0..1) sets the crank angle, so the riders of the group don't move in step.
const steel=matte({color:0xc6cacd,emissive:0x1b1d1f,flatShading:true});
const dark=matte({color:0x8e9396,flatShading:true});

// a faceted limb/tube between two points
function bar(g:THREE.Group,a:THREE.Vector3,b:THREE.Vector3,r0:number,r1=r0,m:THREE.Material=steel,seg=6):void{
  const len=a.distanceTo(b),c=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,len,seg),m);
  c.position.copy(a).lerp(b,.5);c.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
  c.castShadow=true;g.add(c);
}
const V=(x:number,y:number,z=0):THREE.Vector3=>new THREE.Vector3(x,y,z);

function build(o:{pedal?:number}={}):THREE.Group{
  const g=new THREE.Group(),R=.36,rear=V(-.53,R),front=V(.55,R);
  // ---- bike: wheels (rim + tyre), spokes, frame, fork, bar, cranks
  for(const c of[rear,front]){
    const tyre=new THREE.Mesh(new THREE.TorusGeometry(R-.03,.035,5,22),steel);tyre.position.copy(c);g.add(tyre);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(R-.09,.012,4,18),dark);rim.position.copy(c);g.add(rim);
    for(let k=0;k<8;k++){const a=k/8*Math.PI*2;bar(g,c,c.clone().add(V(Math.cos(a)*(R-.09),Math.sin(a)*(R-.09))),.006,.006,dark,3);}
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.12,6),steel);hub.rotation.x=Math.PI/2;hub.position.copy(c);g.add(hub);
  }
  const bb=V(-.02,.3),seat=V(-.2,.86),head=V(.4,.86),barC=V(.47,1.02);
  bar(g,rear,bb,.018);bar(g,rear,seat,.016);bar(g,bb,seat,.024);bar(g,bb,head,.03);bar(g,seat,head,.024);bar(g,head,front,.022);bar(g,head,barC,.025);
  bar(g,V(.47,1.02,-.34),V(.47,1.02,.34),.016);
  const saddle=new THREE.Mesh(new THREE.BoxGeometry(.26,.05,.13),steel);saddle.position.set(-.22,.92,0);g.add(saddle);
  const ph=(o.pedal??0)*Math.PI*2,crank=.17;
  const pedals=[V(-.02+Math.cos(ph)*crank,.3+Math.sin(ph)*crank,.12),V(-.02-Math.cos(ph)*crank,.3-Math.sin(ph)*crank,-.12)];
  for(const p of pedals){bar(g,V(bb.x,bb.y,p.z*.7),p,.012);const pd=new THREE.Mesh(new THREE.BoxGeometry(.1,.02,.08),dark);pd.position.copy(p);g.add(pd);}
  // ---- rider: hips on the saddle, back bent forward, arms to the bar, feet on the pedals
  const hip=V(-.2,1.0),shoulder=V(.2,1.42);
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.17,.15,hip.distanceTo(shoulder),6),steel);
  torso.position.copy(hip).lerp(shoulder,.5);torso.quaternion.setFromUnitVectors(V(0,1,0),shoulder.clone().sub(hip).normalize());
  torso.scale.set(1,1,1.35);torso.castShadow=true;g.add(torso);
  const pelvis=new THREE.Mesh(new THREE.SphereGeometry(.17,6,4),steel);pelvis.scale.set(1,.8,1.3);pelvis.position.copy(hip);g.add(pelvis);
  // the head well forward over the bar, the ribbed helmet with its peak
  const hd=V(.36,1.62),helm=new THREE.Mesh(new THREE.SphereGeometry(.15,8,5,0,Math.PI*2,0,Math.PI/2),steel);
  helm.position.copy(hd);helm.scale.set(1.25,.95,1);g.add(helm);
  for(let k=-1;k<=1;k++){const r=new THREE.Mesh(new THREE.BoxGeometry(.3,.02,.025),dark);r.position.set(hd.x,hd.y+.11,k*.06);g.add(r);}
  const face=new THREE.Mesh(new THREE.SphereGeometry(.1,6,5),steel);face.position.set(hd.x+.02,hd.y-.05,0);g.add(face);
  bar(g,V(.26,1.5),V(.32,1.56),.06);                                               // neck
  for(const s of[-1,1]){
    const sh=V(shoulder.x,shoulder.y,s*.2),el=V(.4,1.2,s*.26),hand=V(.47,1.03,s*.3);
    bar(g,sh,el,.055,.048);bar(g,el,hand,.045,.04);
    const k=pedals[s<0?1:0],hp=V(hip.x,hip.y-.04,s*.11);
    // knee: up and forward of the hip/pedal midpoint (thigh .45, shin .45)
    const mid=hp.clone().lerp(k,.5),d=hp.distanceTo(k),out=Math.sqrt(Math.max(0,.45*.45-d*d/4));
    const dir=k.clone().sub(hp).normalize(),perp=V(dir.y,-dir.x).normalize().multiplyScalar(-1);
    const knee=mid.add(perp.multiplyScalar(out));knee.z=s*.13;
    bar(g,hp,knee,.08,.065);bar(g,knee,V(k.x,k.y+.04,s*.12),.06,.045);
    const shoe=new THREE.Mesh(new THREE.BoxGeometry(.22,.07,.09),steel);shoe.position.set(k.x+.03,k.y+.04,s*.12);g.add(shoe);
  }
  g.traverse(c=>{c.castShadow=true;});
  return g;
}

export default {category:'Divinolândia',label:'Ciclista de aço',build,variants:[{label:'Pedal à frente',opts:{pedal:0}},{label:'Pedal embaixo',opts:{pedal:.75}}]};
