import * as THREE from 'three';
import {matte} from '../matte.ts';

// Poste de rede — the concrete power pole that lines every street of the town in Street
// View, and the tangle of wires it carries (the wiring is half of what a Brazilian street
// looks like): a tapered round concrete pole, the crossarm with three primary insulators
// on top, the low-voltage rack with its four spools, telecom cable boxes, a street
// luminaire on a curved arm, and on some poles a transformer. makeWires() strings the
// primary, secondary and telecom cables between consecutive poles with a catenary sag
// and drops service cables to the houses.
const concrete=matte({color:'#b9b5ab'}),arm=matte({color:'#8e8a82'}),porcelain=matte({color:'#e9e6df'});
const black=matte({color:'#2a2a2c'}),tf=matte({color:'#8f969b'});
export const lampHead=new THREE.MeshBasicMaterial({color:0xffe2b0});
export const POLE_H=10.5;
export const wireMat=new THREE.LineBasicMaterial({color:0x1d1d1f});

function build(o:{transformer?:boolean}={}):THREE.Group{
  const g=new THREE.Group(),H=POLE_H;
  const p=new THREE.Mesh(new THREE.CylinderGeometry(.11,.19,H,8),concrete);p.position.y=H/2;p.castShadow=true;g.add(p);
  // crossarm + 3 pin insulators (primary)
  const c=new THREE.Mesh(new THREE.BoxGeometry(2.2,.1,.1),arm);c.position.y=H-.35;g.add(c);
  for(const x of[-1,0,1]){const ins=new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,.2,6),porcelain);ins.position.set(x*.95,H-.2,0);g.add(ins);}
  // low-voltage rack (4 spools) and telecom box
  const rack=new THREE.Mesh(new THREE.BoxGeometry(.06,.9,.06),arm);rack.position.set(0,H-2.2,.16);g.add(rack);
  for(let i=0;i<4;i++){const s=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.08,6),porcelain);s.position.set(0,H-2.55+i*.24,.24);s.rotation.x=Math.PI/2;g.add(s);}
  const tb=new THREE.Mesh(new THREE.BoxGeometry(.25,.35,.15),black);tb.position.set(0,H-4,.2);g.add(tb);
  const tb2=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.5,8),black);tb2.position.set(.18,H-4.5,.12);g.add(tb2);
  // luminaire on a curved arm toward the street (+z)
  const a1=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,2.2,6),arm);a1.position.set(0,H-3.1,1.0);a1.rotation.x=Math.PI/2-.25;g.add(a1);
  const head=new THREE.Mesh(new THREE.BoxGeometry(.3,.12,.65),arm);head.position.set(0,H-2.85,2.1);g.add(head);
  const lens=new THREE.Mesh(new THREE.BoxGeometry(.24,.02,.5),lampHead);lens.position.set(0,H-2.92,2.12);g.add(lens);
  if(o.transformer){
    const t=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,1.1,12),tf);t.position.set(0,H-1.5,-.5);t.castShadow=true;g.add(t);
    for(let i=0;i<6;i++){const f=new THREE.Mesh(new THREE.BoxGeometry(.04,.9,.25),tf);const a=i/6*Math.PI*2;f.position.set(Math.cos(a)*.42,H-1.5,-.5+Math.sin(a)*.42);f.rotation.y=-a;g.add(f);}
    const br=new THREE.Mesh(new THREE.BoxGeometry(.5,.08,.5),arm);br.position.set(0,H-2.1,-.35);g.add(br);
  }
  return g;
}
// wire attach heights on the pole: 3 primary, 2 secondary, 2 telecom (y offsets from the base)
const ATTACH:[number,number][]=[[-.95,POLE_H-.12],[0,POLE_H-.12],[.95,POLE_H-.12],[0,POLE_H-2.3],[0,POLE_H-2.8],[0,POLE_H-4],[.18,POLE_H-4.5]];
// poles: {x,y,z,ry}; drops: house attach points [x,y,z] each wired to the nearest pole
export function makeWires(poles:{x:number;y:number;z:number;ry:number}[],drops:[number,number,number][]=[]):THREE.LineSegments{
  const v:number[]=[];
  const at=(p:{x:number;y:number;z:number;ry:number},i:number):THREE.Vector3=>{
    const[ox,oy]=ATTACH[i],c=Math.cos(p.ry),s=Math.sin(p.ry);
    return new THREE.Vector3(p.x+ox*c,p.y+oy,p.z-ox*s);
  };
  const span=(a:THREE.Vector3,b:THREE.Vector3,sag:number):void=>{
    const n=10;let prev=a;
    for(let i=1;i<=n;i++){const t=i/n,q=a.clone().lerp(b,t);q.y-=sag*4*t*(1-t);v.push(prev.x,prev.y,prev.z,q.x,q.y,q.z);prev=q;}
  };
  for(let i=1;i<poles.length;i++)for(let k=0;k<ATTACH.length;k++){
    const a=at(poles[i-1],k),b=at(poles[i],k);span(a,b,.25+a.distanceTo(b)*.012+(k>4?.25:0));
  }
  for(const d of drops){
    let best=poles[0],bd=1e9;for(const p of poles){const dd=Math.hypot(p.x-d[0],p.z-d[2]);if(dd<bd){bd=dd;best=p;}}
    if(bd<45)span(at(best,3),new THREE.Vector3(...d),.35);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  return new THREE.LineSegments(geo,wireMat);
}
export default {category:'Divinolândia',label:'Poste de rede (fiação)',build,variants:[{label:'Poste',opts:{}},{label:'Com transformador',opts:{transformer:true}}]};
