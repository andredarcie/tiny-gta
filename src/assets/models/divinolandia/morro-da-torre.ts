import * as THREE from 'three';
import {matte} from '../matte.ts';
import {drape,type GroundAt,type P2} from './praca-chao.ts';
import {flat,block,hipRoof,gravelM,canvasTex} from './posto-kit.ts';
import Torre from './torre-mirante.ts';
import ArvorePraca from './arvore-praca.ts';

// Morro da Torre — the 1,380 m hilltop south-east of town, the official mirante of the
// Município de Interesse Turístico (state tourism page: from here you see Divinolândia, São
// Sebastião da Grama, Vargem Grande do Sul, São José do Rio Pardo, Tapiratiba and Caconde).
// No Street View reaches it: laid out from the gridded Google satellite (sat-torre, z20, and
// sat21-torre, z21, local; town-local metres):
//  - the telecom COMPOUND, a rectangle about 42 × 38 m turned ~27° on the bare summit: precast
//    concrete walls on its north-east and south-west sides (the dark lines in the picture),
//    chain-link on the other two with the gate at the west corner where the track arrives;
//    a gravel yard inside;
//  - the tall LATTICE TOWER near the north-east wall (its long lean and its shadow both
//    start there), aviation red and white, with a second, shorter galvanised mast by it;
//  - the equipment cluster south-west of the masts: a shelter hut, cabinets, a white fuel
//    tank, the generator box near the west corner;
//  - the outbuildings strung along the track north-west of the compound (a long shed, two
//    small houses, a hut), the trees along the south-west wall;
//  - the MIRANTE on the north brow, looking down at the town: a timber deck with a rail,
//    benches and a coin viewer. (Its exact place is not visible from above; put where the
//    hill drops toward the town.)
// Built in town-local metres, ground relative to ORIGIN (like posto-*.ts). No default
// export besides the model descriptor; MORRO_FOOT = collision boxes [x, z, w, d, rot, height].
export const ORIGIN:P2=[718,1979];
const C:P2[]=[[708,1952],[745,1971],[727,2005],[690,1986]];            // the compound, north / east / south / west corners
const U:P2=[(C[1][0]-C[0][0])/41.6,(C[1][1]-C[0][1])/41.6];            // along the north-east wall
const ROT=Math.atan2(U[1],U[0]);
const TOWER:P2=[736,1975],MAST:P2=[727,1981];
export const MIRANTE:P2=[722,1944],MIRANTE_YAW=Math.PI;                 // the deck's +z looks north, at the town
const box=(x:number,z:number,w:number,d:number,rot:number,h:number):[number,number,number,number,number,number]=>[x,z,w,d,rot,h];
export const MORRO_FOOT:[number,number,number,number,number,number][]=[
  box(TOWER[0],TOWER[1],5.4,5.4,ROT,70),box(MAST[0],MAST[1],3.2,3.2,ROT,40),
  box(720,1987,4.6,3.6,ROT,3),
  box((C[0][0]+C[1][0])/2,(C[0][1]+C[1][1])/2,41.6,.3,ROT,2.2),box((C[2][0]+C[3][0])/2,(C[2][1]+C[3][1])/2,41.6,.3,ROT,2.2),
  box(700,1934,11,6,-.45,4),box(692,1946,4.4,4.4,-.45,3),box(701,1953,5,4,-.45,3),
];

const concrete=flat('#a9a6a0'),post=flat('#9a978f');
// a precast concrete wall (posts every 2 m, slabs between) along a → b, top h over the ground
function precast(g:THREE.Group,at:GroundAt,a:P2,b:P2,h=2.2):void{
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/2)),ry=-Math.atan2(b[1]-a[1],b[0]-a[0]);
  for(let k=0;k<n;k++){
    const t=(k+.5)/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,y=at(x,z);
    block(g,concrete,x,y-.4,z,L/n-.02,h+.4,.1,ry);
  }
  for(let k=0;k<=n;k++){const t=k/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;block(g,post,x,at(x,z)-.4,z,.18,h+.5,.18,ry);}
}
// chain-link on galvanised posts along a → b, leaving out [g0,g1] (fractions) for a gate
function chainLink(g:THREE.Group,at:GroundAt,a:P2,b:P2,h=2.2,gate:[number,number]|null=null):void{
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/2.5)),ry=-Math.atan2(b[1]-a[1],b[0]-a[0]);
  const net=matte({color:0x8e9396,transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide});
  for(let k=0;k<n;k++){
    const t0=k/n,t1=(k+1)/n;if(gate&&t1>gate[0]&&t0<gate[1])continue;
    const t=(t0+t1)/2,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t,y=at(x,z);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(L/n,h),net);p.position.set(x,y+h/2,z);p.rotation.y=ry;g.add(p);
  }
  for(let k=0;k<=n;k++){const t=k/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;block(g,flat('#b9bdc0'),x,at(x,z)-.3,z,.07,h+.4,.07,ry);}
}
// a small building with a hipped roof, its long side along `rot`
function hut(g:THREE.Group,at:GroundAt,x:number,z:number,w:number,d:number,h:number,rot:number,wall:string,roof:string):void{
  let lo=Infinity;for(const[u,v]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const c=Math.cos(rot),s=Math.sin(rot);lo=Math.min(lo,at(x+u*w/2*c-v*d/2*s,z+u*w/2*s+v*d/2*c));}
  const r=new THREE.Group();r.position.set(x,lo,z);r.rotation.y=-rot;g.add(r);
  block(r,flat(wall),0,-.6,0,w,h+.6,d);
  hipRoof(r,-w/2,w/2,-d/2,d/2,h,Math.min(w,d)*.28,roof,.4);
  block(r,flat('#6a5040'),w/2-1.2,0,d/2+.01,.9,2,.04);                     // the door on the long side
}

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);

  // ---- the gravel yard and the compound's fence
  g.add(drape(C,at,.08,gravelM,[],2.5));
  precast(g,at,C[0],C[1]);precast(g,at,C[2],C[3]);
  chainLink(g,at,C[1],C[2]);chainLink(g,at,C[3],C[0],2.2,[.62,.88]);
  // the gate at the west corner: two galvanised leaves, one ajar
  {const t=.75,x=C[3][0]+(C[0][0]-C[3][0])*t,z=C[3][1]+(C[0][1]-C[3][1])*t,ry=-Math.atan2(C[0][1]-C[3][1],C[0][0]-C[3][0]);
    for(const s of[-1,1]){const l=new THREE.Group();l.position.set(x+Math.cos(-ry)*s*2.3,at(x,z),z+Math.sin(-ry)*s*2.3);l.rotation.y=ry+(s>0?.5:0);g.add(l);
      block(l,flat('#b9bdc0'),-s*1.1,0,0,2.2,2,.06);}}

  // ---- the masts
  {const t=Torre.build({h:62,mirante:false});t.position.set(TOWER[0],at(...TOWER),TOWER[1]);t.rotation.y=-ROT;g.add(t);}
  {const t=Torre.build({h:34,painted:false,mirante:false});t.position.set(MAST[0],at(...MAST),MAST[1]);t.rotation.y=-ROT+.4;g.add(t);}
  // cable trays from the masts to the shelter
  for(const[a,b]of[[TOWER,[722,1985]],[MAST,[721,1985]]] as [P2,P2][]){
    const L=Math.hypot(b[0]-a[0],b[1]-a[1]),y=Math.max(at(...a),at(...b))+2.6;
    const tr=new THREE.Mesh(new THREE.BoxGeometry(L,.08,.5),flat('#9aa0a4'));tr.position.set((a[0]+b[0])/2,y,(a[1]+b[1])/2);tr.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(tr);
    for(let k=1;k<L;k+=3){const x=a[0]+(b[0]-a[0])*k/L,z=a[1]+(b[1]-a[1])*k/L;block(g,flat('#9aa0a4'),x,at(x,z),z,.08,y-at(x,z),.08);}
  }

  // ---- the equipment: shelter, cabinets, fuel tank, generator
  hut(g,at,720,1987,4.4,3.4,2.8,ROT,'#e2ddd0','#9a9690');
  for(let k=0;k<3;k++){const x=724.5+k*1.1*Math.cos(ROT),z=1991+k*1.1*Math.sin(ROT);block(g,flat('#d6d8d6'),x,at(x,z),z,.9,1.7,.7,-ROT);}
  {const x=731,z=1983,tank=new THREE.Mesh(new THREE.CylinderGeometry(.9,.9,2.6,16),flat('#f2f2ee'));tank.rotation.z=Math.PI/2;tank.rotation.y=-ROT;
    tank.position.set(x,at(x,z)+1.25,z);g.add(tank);for(const s of[-.8,.8])block(g,flat('#7a7c7e'),x+Math.cos(ROT)*s,at(x,z),z+Math.sin(ROT)*s,.2,.4,1.4,-ROT);}
  block(g,flat('#d8d4c8'),700,at(700,1972),1972,3,1.8,2,-ROT);
  block(g,flat('#3a3c3e'),701.6,at(700,1972)+1.8,1972.8,.3,1,.3,0);              // its exhaust

  // ---- the outbuildings along the track north-west of the compound
  hut(g,at,700,1934,11,6,3.2,-.45,'#ece6d6','#8f8f8a');
  hut(g,at,692,1946,4,4,2.6,-.45,'#ece6d6','#b0603f');
  hut(g,at,701,1953,5,4,2.6,-.45,'#e8e2d2','#c9c4b8');
  // a dirt track from the outbuildings down to the gate
  const dirt=matte({color:0xa47e5e});
  for(const[a,b]of[[[692,1925],[697,1960]],[[697,1960],[696,1978]]] as [P2,P2][]){
    const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L*1.8,nz=dx/L*1.8;
    g.add(drape([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],at,.05,dirt,[],2));
  }

  // ---- trees along the south-west wall and below the west corner
  for(const[x,z,r]of[[684,1972,3.4],[688,1980,3],[701,2004,3.2],[713,2008,3.6],[735,2010,2.8],[690,1999,2.6]] as [number,number,number][]){
    const t=ArvorePraca.build({kind:'copa',r,seed:Math.round(x*7+z)});t.position.set(x,at(x,z),z);g.add(t);}

  // ---- the mirante on the north brow, facing the town
  {
    let y=-Infinity;for(const[u,v]of[[-4.5,-2.1],[4.5,-2.1],[4.5,2.1],[-4.5,2.1]])y=Math.max(y,at(MIRANTE[0]-u,MIRANTE[1]-v)-.3);   // (the deck stays above its highest corner)
    const m=new THREE.Group();m.position.set(MIRANTE[0],y,MIRANTE[1]);m.rotation.y=MIRANTE_YAW;g.add(m);
    const wood=flat('#8a6040'),dark=flat('#5e4028');
    block(m,wood,0,.35,0,9,.22,4.2);                                             // the deck
    for(const[px,pz]of[[-4.3,-1.9],[4.3,-1.9],[-4.3,1.9],[4.3,1.9],[0,1.9],[0,-1.9]])block(m,dark,px,-2,pz,.22,2.35,.22);   // (legs reach down the slope)
    block(m,wood,0,1.45,2.05,9,.1,.12);block(m,wood,0,.95,2.05,9,.08,.08);    // the rail on the view side
    for(let k=0;k<7;k++)block(m,dark,-4.4+k*1.47,.55,2.05,.12,1,.12);
    for(const s of[-1,1]){block(m,wood,s*4.45,1.45,0,.12,.1,4.1);block(m,dark,s*4.4,.55,1,.1,1,.1);}
    for(const x of[-2.4,2.4]){block(m,wood,x,.85,-.6,2.4,.1,.5);block(m,dark,x-1,.57,-.6,.12,.3,.4);block(m,dark,x+1,.57,-.6,.12,.3,.4);}
    // the coin viewer at the rail
    block(m,flat('#3a5a7a'),0,.57,1.4,.18,1,.18);
    const v=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.5,10),flat('#3a5a7a'));v.rotation.x=Math.PI/2;v.position.set(0,1.7,1.4);m.add(v);
    // the board
    const tex=canvasTex(512,192,(x,W,H)=>{x.fillStyle='#6b4a2a';x.fillRect(0,0,W,H);x.strokeStyle='#e9dcc2';x.lineWidth=6;x.strokeRect(8,8,W-16,H-16);
      x.fillStyle='#f4ead6';x.textAlign='center';x.font='700 64px Arial';x.fillText('MIRANTE',W/2,84);x.font='500 34px Arial';x.fillText('MORRO DA TORRE · 1.380 m',W/2,146);});
    const b=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1),matte({map:tex}));b.position.set(-3.2,2.3,-2.3);b.rotation.y=Math.PI;m.add(b);
    const bb=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1),matte({color:0x6b4a2a}));bb.position.set(-3.2,2.3,-2.28);m.add(bb);
    for(const s of[-1.2,1.2])block(m,dark,-3.2+s,.35,-2.29,.12,2.5,.12);
  }
  return root;
}

export default {category:'Divinolândia',label:'Morro da Torre (mirante)',build};
