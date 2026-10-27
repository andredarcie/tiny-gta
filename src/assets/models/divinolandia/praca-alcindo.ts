import * as THREE from 'three';
import {SQUARES} from '@/world/divinolandia/sites-table.ts';
import {matte} from '../matte.ts';
import {leafMat,leafMass} from './copa.ts';
import {lawnM,stoneM,zigzagM,soilM,drape,sidewalkRing,circle,path,kerb,put,type GroundAt,type P2} from './praca-chao.ts';
import Banco from './banco-praca.ts';
import Poste from './poste-colonial.ts';
import Chafariz,{CHAFARIZ_R} from './chafariz-matriz.ts';
import Arvore from './arvore-praca.ts';
import Coreto from '../rural/coreto.ts';

// Praça Dr. Alcindo Cardoso de Paiva — the square across the street from the Igreja Matriz,
// laid out 1:1 from the Google z20 satellite (traced in the square's own frame, ±0.5 m) and
// the Street View panoramas round it (pm-front*, pm-e, pm-s1, pm-n2, pm-se):
//   - a block of lawn ringed by a pink paver sidewalk with a grey band at the kerb;
//   - red paver paths with grey borders: four that cut the corners (an octagonal ring), a
//     long diagonal from the north side to the dry square, one from the north-west to the
//     white pavilion, one up from the south side, one to the bandstand, one to the south-west;
//   - the DRY SQUARE west of the middle, light stone with the calçada-portuguesa zigzag band,
//     the FOUNTAIN on its east end, the octagonal CORETO by the east side (steps to the west);
//   - the white PAVILION with the balustraded roof terrace on the north side (turned 32°), the
//     little flat-roofed shelter in the north-west corner, the playground mat in the
//     north-east, the bust with its white half-moon bench, the painted urn by its flower bed,
//     the red "Zetinho Lanches" snack kiosk in the south-west;
//   - the big shade trees where the satellite shows their crowns, benches with red slats and
//     black three-lantern lamp posts along the paths.
// build({groundAt}) is pure. Frame: u = east along the street grid, v = south; the origin is
// the middle of the block (town-local (89.3, 11.5), turned 0.1658 rad). groundAt(u,v) gives
// the ground height relative to the group's origin.
export const ALCINDO=SQUARES.alcindo;
const W0=2.6;                                         // sidewalk width
const whiteM=matte({color:0xf2efe8}),winM=matte({color:0x55636e}),doorM=matte({color:0x6f7c86});
const brickM=matte({color:0x9a5a42}),roofDarkM=matte({color:0x4f5b53}),glassM=matte({color:0x7f949e});
const rubberM=matte({color:0x4f4f86}),steelM=matte({color:0xd1b13a}),redM=matte({color:0xb3262a});
const bustM=matte({color:0x3f3a35}),blueM=matte({color:0x2c4f9a}),flowerM=leafMat(0xe8e6dc);
const shrubM=leafMat(0x3c5a30);

function box(g:THREE.Object3D,m:THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=true;b.receiveShadow=true;g.add(b);return b;
}
// a white balustrade along x from -L/2..L/2 (in an object's frame), height .95
function rail(g:THREE.Object3D,L:number,x:number,y:number,z:number,ry:number):void{
  const r=new THREE.Group();r.position.set(x,y,z);r.rotation.y=ry;g.add(r);
  box(r,whiteM,L,.12,.2,0,0,0);box(r,whiteM,L+.1,.1,.26,0,.85,0);
  for(let t=-L/2+.2;t<=L/2-.15;t+=.3)box(r,whiteM,.09,.73,.09,t,.12,0);
}
// the white pavilion: a 9.4 m square block (3.2 m) with doors and windows, roof terrace
// behind a balustrade, reached by a straight stair along its south-west side
function pavilion():THREE.Group{
  const g=new THREE.Group(),S=9.4,H=3.2;
  box(g,whiteM,S,H+1.2,S,0,-1.2,0);
  box(g,matte({color:0xcfc9bd}),S-.4,.06,S-.4,0,H,0);
  for(const[fx,fz,ry]of[[0,S/2,0],[S/2,0,Math.PI/2],[0,-S/2,Math.PI],[-S/2,0,-Math.PI/2]] as [number,number,number][]){
    const f=new THREE.Group();f.position.set(fx,0,fz);f.rotation.y=ry;g.add(f);
    box(f,doorM,1.1,2.2,.06,-1.6,0,0);box(f,winM,1.3,.9,.06,1.6,1.3,0);box(f,winM,1.3,.9,.06,3.4,1.3,0);
    rail(f,S,0,H,-.1,0);
  }
  // stair: a white sloping wall with treads, along the -x side going up toward -z
  for(let i=0;i<16;i++)box(g,matte({color:0xd6d0c4}),1.2,.2,.3,-S/2-.7,i*.2,S/2-1-i*.3);
  box(g,whiteM,.15,1.2,5,-S/2-1.35,H-1,S/2-3.2);
  return g;
}
// the little shelter in the north-west corner: brick piers, glass panels, a flat dark roof
function shelter(L:number,D:number):THREE.Group{
  const g=new THREE.Group();
  box(g,matte({color:0xcfc9bd}),L,.15,D,0,0,0);
  for(const x of[-L/2+.3,0,L/2-.3])for(const z of[-D/2+.3,D/2-.3])box(g,brickM,.5,3,.5,x,0,z);
  box(g,glassM,L-1,2.1,.06,0,.5,D/2-.3);box(g,whiteM,L-1,.9,D-1,0,.15,0);
  box(g,roofDarkM,L+.6,.3,D+.6,0,3,0);box(g,whiteM,L+.7,.12,D+.7,0,2.92,0);
  return g;
}
function playground():THREE.Group{
  const g=new THREE.Group();
  box(g,rubberM,7,.06,3.8,0,0,0);
  for(const x of[-2.6,-.4])for(const z of[-1.1,1.1]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.4,6),steelM);p.position.set(x,1.2,z*.9);p.rotation.z=(x<-1?.12:-.12);g.add(p);}
  box(g,steelM,2.6,.08,.08,-1.5,2.35,0);
  for(const x of[-2,-1]){box(g,redM,.5,.05,.2,x,.5,0);}
  box(g,redM,1.4,.08,.6,1.8,1.1,0).rotation.z=-.55;box(g,steelM,.6,1.2,.6,2.6,0,0);
  return g;
}
function bust():THREE.Group{
  const g=new THREE.Group();
  box(g,whiteM,.9,1.25,.9,0,0,0);box(g,whiteM,1.1,.12,1.1,0,1.25,0);
  const h=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),bustM);h.position.y=1.85;g.add(h);
  box(g,bustM,.6,.35,.35,0,1.37,0);
  return g;
}
function halfMoonBench(r:number):THREE.Group{
  const g=new THREE.Group();
  for(let i=0;i<12;i++){
    const a=Math.PI*(i+.5)/12,s=new THREE.Mesh(new THREE.BoxGeometry(r*Math.PI/12+.05,.45,.55),whiteM);
    s.position.set(Math.cos(a)*r,.225,Math.sin(a)*r);s.rotation.y=-a+Math.PI/2;s.castShadow=true;g.add(s);
    const b=new THREE.Mesh(new THREE.BoxGeometry(r*Math.PI/12+.05,.5,.12),whiteM);
    b.position.set(Math.cos(a)*(r+.3),.6,Math.sin(a)*(r+.3));b.rotation.y=-a+Math.PI/2;g.add(b);
  }
  return g;
}
function urn():THREE.Group{
  const g=new THREE.Group();
  box(g,whiteM,.9,.25,.9,0,0,0);box(g,redM,.8,.3,.8,0,.25,0);box(g,blueM,.8,.25,.8,0,.55,0);box(g,whiteM,.9,.12,.9,0,.8,0);
  const v=new THREE.Mesh(new THREE.CylinderGeometry(.42,.18,.6,12),whiteM);v.position.y=1.25;g.add(v);
  const f=new THREE.Mesh(new THREE.CylinderGeometry(.14,.18,.2,10),whiteM);f.position.y=.95;g.add(f);
  return g;
}
function kiosk():THREE.Group{
  const g=new THREE.Group();
  box(g,matte({color:0xb7b2a6}),5.6,.4,2.8,0,0,0);
  box(g,redM,5.4,2.4,2.6,0,.4,0);box(g,matte({color:0xd9d4c8}),5.6,.1,2.8,0,2.8,0);
  const ch=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,1.2,8),matte({color:0x8a8a88}));ch.position.set(-2,3.4,-.6);g.add(ch);
  for(const sd of[1,-1]){const sign=new THREE.Mesh(new THREE.PlaneGeometry(3.6,.7),matte({map:kioskSign(),transparent:true}));sign.position.set(-.6,2.1,1.31*sd);if(sd<0)sign.rotation.y=Math.PI;g.add(sign);}
  return g;
}
let signTex:THREE.Texture|null=null;
function kioskSign():THREE.Texture{
  if(signTex)return signTex;if(typeof document==='undefined')return signTex=new THREE.Texture();
  const c=document.createElement('canvas');c.width=512;c.height=100;const x=c.getContext('2d')!;
  x.fillStyle='#f6c84a';x.font='italic 800 64px sans-serif';x.textBaseline='middle';x.fillText('ZETINHO LANCHES',8,52);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return signTex=t;
}

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at=o.groundAt??((): number=>0),g=new THREE.Group();
  const {u0,u1,v0,v1}=ALCINDO,iu0=u0+W0,iu1=u1-W0,iv0=v0+W0,iv1=v1-W0;
  // ---- the block: lawn inside, the pink sidewalk ring (grey band at the kerb), kerbs ----
  const inner=sidewalkRing(g,at,u0,u1,v0,v1,W0);
  g.add(drape(inner,at,.08,lawnM));
  // ---- paths ----
  const P:[P2,P2,number?][]=[
    [[-14,iv0],[iu0,-11]],[[29,iv0],[iu1,-8]],[[iu1,19],[31,iv1]],[[iu0,13],[-14,iv1]],        // the corner ring
    [[25,iv0],[-6,-6.5]],[[-13,iv0],[2.5,-19.5]],[[2,iv1],[4.5,4.5+CHAFARIZ_R]],              // radials
    [[4.5+CHAFARIZ_R,4.5],[36.5,4.5]],[[-26,3.5],[-22,29]],[[5,-19.5],[4.5,-6.5],2.6],
  ];
  for(const[a,b,w]of P)path(g,at,a,b,w);
  // ---- the dry square: light stone, the zigzag band, the fountain's paved circle ----
  g.add(drape([[iu0,-6.5],[14,-6.5],[14,3.5],[iu0,3.5]],at,.13,stoneM));
  g.add(drape([[-36,-5],[-6,-5],[-6,2],[-36,2]],at,.14,zigzagM));
  kerb(g,at,[[iu0,-6.6],[14,-6.6]],false,.18,.15);kerb(g,at,[[iu0,3.6],[-2,3.6]],false,.18,.15);
  put(g,Chafariz.build(),at,4.5,4.5,0,.12);
  // ---- buildings and monuments ----
  put(g,Coreto.build(),at,40.5,4.5,-Math.PI/2);
  put(g,pavilion(),at,4.6,-26.2,-.56);
  put(g,shelter(10.5,8.5),at,-32.2,-29.8,0,.1);
  put(g,playground(),at,36.5,-32.9,0,.1);
  g.add(drape(circle(41,-25.5,4.6),at,.12,stoneM));
  put(g,halfMoonBench(3.9),at,41,-25.5,0,.1);put(g,bust(),at,41,-27.3,0,.1);
  put(g,urn(),at,-31.5,-19.5,0,.08);
  {const bed=drape(circle(-28.6,-19.2,2.4,18),at,.1,soilM);g.add(bed);
    for(let i=0;i<14;i++){const a=i/14*Math.PI*1.4-.5,r=1.6+(i%3)*.35,f=new THREE.Mesh(leafMass(1+i%3,.3,2),i%2?flowerM:shrubM);f.scale.setScalar(.34);
      const u=-28.6+Math.cos(a)*r,v=-19.2+Math.sin(a)*r;f.position.set(u,at(u,v)+.35,v);g.add(f);}}
  put(g,kiosk(),at,-36.4,35.5,Math.PI/2,.1);
  // ---- trees (crowns from the satellite: u, v, crown radius, kind) ----
  const T:[number,number,number,('copa'|'vinho'|'ipe')?][]=[
    [-35,-6,6.5],[-34,15,8],[-37,37,8.5],[-21,-22,9],[-17,16,8.5],[-6,38,7],[-23,37,6,'vinho'],[20,-19,5.5],
    [22,-6,8],[12,-32,3.5],[-1,-33,3],[33,-29,3,'ipe'],[45,-13,4],[8,-11,3.5],[14,19,8],[27,29,9],[15,38,8],
    [35,42,5],[45,37,4],[42,16,3.5],[-10,28,4,'ipe'],[46,-30,3.5],
  ];
  T.forEach(([u,v,r,k],i)=>put(g,Arvore.build({kind:k||'copa',r,seed:i+11}),at,u,v,i*.7));
  // the bare red earth trodden under the big crowns (pm-front: the lawn gives out in their shade)
  const earthM=matte({color:0x7e5238,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
  T.forEach(([u,v,r],i)=>{if(r<6)return;
    const P:P2[]=[];for(let k=0;k<14;k++){const a=k/14*Math.PI*2,rr=r*(.45+.18*Math.sin(k*2.3+i));P.push([u+Math.cos(a)*rr,v+Math.sin(a)*rr*.8]);}
    g.add(drape(P,at,.09,earthM,[],2));});
  // round shrubs in the lawns
  for(const[u,v]of[[-8,-14],[12,-13],[30,-20],[-28,24],[20,12],[34,15],[-12,9],[28,36],[-31,-12],[16,-28]] as P2[]){
    const s=new THREE.Mesh(leafMass(1+(u&1),.26,2),shrubM);s.scale.setScalar(.95);s.scale.y=.7;s.position.set(u,at(u,v)+.55,v);s.castShadow=true;g.add(s);}
  // ---- benches (u, v, facing angle: the seat looks along +z turned by ry) ----
  const B:[number,number,number][]=[
    [16,-25,-2.4],[8,-17,-2.4],[1,-11.5,-2.4],[20,-30.5,.73],[12,-23,.73],
    [-8,-25,2.35],[-3,-20,2.35],[-24,-16.5,.8],[-31,-8,.8],[36,-19,2.2],[43,-9,2.2],
    [-29,20,-.8],[-21,32,-.8],[42,24,-2.4],[35,34,-2.4],
    [4.5,-5,Math.PI],[-4,4.5,Math.PI/2],[13,4.5,-Math.PI/2],[-20,-7.5,0],[-28,-7.5,0],[-20,5,Math.PI],
    [2,30,Math.PI/2],[7,22,-Math.PI/2],[24,3,0],[30,6,Math.PI],
  ];
  for(const[u,v,ry]of B)put(g,Banco.build(),at,u,v,ry,.1);
  // ---- lamp posts ----
  const L:P2[]=[[18,-27.5],[9.5,-19.5],[-1,-14],[-9,-30],[-27,-17],[-34,-12],[37,-22],[44,-12],[-31,18],[-19,35],
    [43,25],[35,37],[-2,-6.6],[11,-6.6],[-16,3.6],[-30,-6.6],[3,24],[24,4.5],[33,7],[11,11.5]];
  for(const[u,v]of L)put(g,Poste.build(),at,u,v,0,.12);
  return g;
}
export default {category:'Divinolândia',label:'Praça Dr. Alcindo (layout 1:1)',build};
