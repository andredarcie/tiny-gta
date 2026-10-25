import * as THREE from 'three';
import {matte} from '../matte.ts';
import {type P2} from './praca-chao.ts';
import {flat,brick,corrugated,walls,face,onFace,opening,block,hipRoofQuad,type Face} from './posto-kit.ts';
import type {Publico,Solid} from './publicos.ts';

// The two neighbourhood churches the town lacked, rebuilt from Google Street View
// (captures mk-santaluzia, sl2-*, mk-aparecida, ap2-*) and the gridded satellite
// (sat-santaluzia, sat-aparecida), local:
//   * Igreja de Santa Luzia — on a sloping corner of the west side: a white nave under a
//     low fibre-cement gable, five tall round-headed windows down each side, and at the
//     street end the open porch of three round arches (the middle one wider) with an arch
//     on each flank, the saint's picture in its red frame in the gable and the cross on top;
//   * Paróquia Nossa Senhora Aparecida — at the east entrance, by the coffee silos: exposed
//     brick, the big cross in relief on the flat-topped front, round-arched windows, the
//     small clay-tiled porch on timber posts over the wooden doors, and the square brick
//     tower at the right-hand corner with its clock under the belfry arches and the cross.
// Same contract as publicos.ts (TOWN-LOCAL metres shifted by origin, groundAt relative to
// the ground there, foot = collision boxes). Not a single model: no default export.

const tex=new Map<string,THREE.Material>();
const T=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=tex.get(k);if(!m){m=f();tex.set(k,m);}return m;};
const cen=(p:P2[]):P2=>[p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];
// a w × d rectangle centred at c, its length d along the unit direction u (front at +u)
const box4=(c:P2,u:P2,w:number,d:number):P2[]=>{const n:P2=[-u[1],u[0]];
  return[[1,1],[-1,1],[-1,-1],[1,-1]].map(([a,b])=>[c[0]+u[0]*a*d/2+n[0]*b*w/2,c[1]+u[1]*a*d/2+n[1]*b*w/2] as P2);};
const solid=(c:P2,u:P2,w:number,d:number,h:number):Solid=>[c[0],c[1],d,w,Math.atan2(u[1],u[0]),h];
function root(o:P2):{r:THREE.Group;g:THREE.Group}{const r=new THREE.Group(),g=new THREE.Group();g.position.set(-o[0],0,-o[1]);r.add(g);return{r,g};}
// a round-headed shape (w wide, h to the spring of the arch + a semicircle), base at y=0
function archShape(w:number,h:number,grow=0):THREE.Shape{
  const r=w/2+grow,s=new THREE.Shape();s.moveTo(-r,-grow);s.lineTo(-r,h);s.absarc(0,h,r,Math.PI,0,true);s.lineTo(r,-grow);s.closePath();return s;}
// a window: frame shape behind, glass in front, on face f at arc length s, sill height y
function archWindow(g:THREE.Group,f:Face,s:number,y:number,w:number,h:number,frame:string,glass:THREE.Material):void{
  for(const[shape,m,out]of[[archShape(w,h,.1),flat(frame),.02],[archShape(w,h),glass,.04]] as [THREE.Shape,THREE.Material,number][]){
    const p=new THREE.Mesh(new THREE.ShapeGeometry(shape,8),m);const[x,,z]=f.at(s,0,out);p.position.set(x,y,z);p.rotation.y=f.ry;g.add(p);}
}
// a plain gable roof over a rectangle (length along u), eaves at y, ridge `rise` higher
function gable(g:THREE.Group,c:P2,u:P2,w:number,d:number,y:number,rise:number,m:THREE.Material,ov=.5):void{
  // each slope from the ridge (over the centre line) down to the eave line `ov` past the
  // wall, the whole length + `ov` past each end; vertices placed directly (no rotations)
  const half=w/2+ov,L=d/2+ov,drop=rise*ov/(w/2),len=Math.hypot(half,rise+drop);
  for(const s of[-1,1]){
    const n:P2=[-u[1]*s,u[0]*s],P=(a:number,b:number,h:number):number[]=>[c[0]+u[0]*a+n[0]*b,h,c[1]+u[1]*a+n[1]*b];
    const pos=[...P(-L,0,y+rise),...P(L,0,y+rise),...P(L,half,y-drop),...P(-L,half,y-drop)];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2*L/1.2,0,2*L/1.2,len/1.2,0,len/1.2],2));
    geo.setIndex(s>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]);geo.computeVertexNormals();
    // keep the normal pointing up whatever the winding came out as
    const nrm=geo.getAttribute('normal') as THREE.BufferAttribute;
    if(nrm.getY(0)<0){geo.setIndex(s>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]);geo.computeVertexNormals();}
    const p=new THREE.Mesh(geo,m);p.castShadow=true;p.receiveShadow=true;g.add(p);
  }
}
// the gable triangle over an end wall (face f, at height y, the ridge `rise` over its middle)
function gableTri(g:THREE.Group,f:Face,y:number,rise:number,m:THREE.Material):void{
  const s=new THREE.Shape([new THREE.Vector2(-f.len/2-.05,0),new THREE.Vector2(f.len/2+.05,0),new THREE.Vector2(0,rise)]);
  const p=new THREE.Mesh(new THREE.ExtrudeGeometry(s,{depth:.25,bevelEnabled:false}),m);
  const[x,,z]=f.at(f.len/2,0,-.25);p.position.set(x,y,z);p.rotation.y=f.ry;p.castShadow=true;g.add(p);
}
const cross=(g:THREE.Group,x:number,y:number,z:number,ry:number,h=1.6,c='#f2f2ee'):void=>{
  block(g,flat(c),x,y,z,.14,h,.14,ry);block(g,flat(c),x,y+h*.62,z,h*.6,.13,.14,ry);};

// ============================== Igreja de Santa Luzia ==============================
const SL_U:P2=[.8,.6];                                     // along the nave, toward the back (south-east)
const SL_NAVE_C:P2=[-497.4,106.7],SL_W=9.5,SL_D=20;
const SL_PORCH_C:P2=[SL_NAVE_C[0]-SL_U[0]*(SL_D/2+2.1),SL_NAVE_C[1]-SL_U[1]*(SL_D/2+2.1)];
const SL_NAVE=box4(SL_NAVE_C,SL_U,SL_W,SL_D),SL_ALL_C:P2=[SL_NAVE_C[0]-SL_U[0]*2.1,SL_NAVE_C[1]-SL_U[1]*2.1];
const santaLuzia:Publico={id:'santaluzia',nome:'Igreja de Santa Luzia',origin:SL_NAVE_C,
  foot:[solid(SL_NAVE_C,SL_U,SL_W,SL_D,7.5),solid(SL_PORCH_C,SL_U,SL_W,1,6)],build(at){
  const{r,g}=root(SL_NAVE_C),ins=cen(SL_NAVE);
  const lo=Math.min(...SL_NAVE.map(p=>at(...p)),at(...SL_PORCH_C)),y0=Math.max(...SL_NAVE.map(p=>at(...p)))+.3,eave=y0+4.6;
  const white=flat('#f4f3ef'),plinth=flat('#c9c6bd');
  walls(g,SL_NAVE,lo-.6,eave,white,1,ins);
  const F=SL_NAVE.map((a,i)=>face(a,SL_NAVE[(i+1)%4],ins));      // F[1] = the front (street, NW), F[3] = the back, F[0]/F[2] = the sides
  for(const f of F)onFace(g,f,plinth,f.len/2,lo-.6,f.len+.02,y0-lo+.95,.012);
  const glass=T('slGlass',()=>matte({color:'#3b3f45',emissive:0x0b0d10}));
  for(const f of[F[0],F[2]])for(let k=0;k<5;k++)archWindow(g,f,2.6+k*(f.len-5.2)/4,y0+1.2,.75,2.1,'#ffffff',glass);
  // the front of the nave inside the porch: the wooden door
  opening(g,F[1],F[1].len/2,y0,1.8,3,{fill:T('slDoor',()=>matte({color:'#7a4a2c'})),frame:'#ffffff',panes:2});
  // the porch: a white arcade in front (3 arches, the middle one wider) and an arch on each flank
  const P=box4(SL_PORCH_C,SL_U,SL_W,4.2),FP=P.map((a,i)=>face(a,P[(i+1)%4],cen(P)));
  const arcade=(f:Face,spans:{s:number;w:number;h:number}[]):void=>{
    const sh=new THREE.Shape();sh.moveTo(-f.len/2,lo-.6-y0);sh.lineTo(f.len/2,lo-.6-y0);sh.lineTo(f.len/2,4.6);sh.lineTo(-f.len/2,4.6);sh.closePath();
    for(const a of spans){const hole=new THREE.Path();const r=a.w/2,x=a.s-f.len/2;hole.moveTo(x-r,0);hole.lineTo(x+r,0);hole.lineTo(x+r,a.h);hole.absarc(x,a.h,r,0,Math.PI,false);hole.lineTo(x-r,0);sh.holes.push(hole);}
    const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.35,bevelEnabled:false,curveSegments:10}),white);
    const[x,,z]=f.at(f.len/2,0,-.35);m.position.set(x,y0,z);m.rotation.y=f.ry;m.castShadow=true;m.receiveShadow=true;g.add(m);
  };
  arcade(FP[1],[{s:FP[1].len/2-3.2,w:2.1,h:1.9},{s:FP[1].len/2,w:2.8,h:2.2},{s:FP[1].len/2+3.2,w:2.1,h:1.9}]);
  for(const f of[FP[0],FP[2]])arcade(f,[{s:f.len/2,w:2,h:1.8}]);
  // porch floor and the steps down to the street
  const pf=new THREE.Mesh(new THREE.BoxGeometry(SL_W,.3,4.2),T('slFloor',()=>matte({color:'#c9b8a2'})));
  pf.position.set(SL_PORCH_C[0],y0-.15,SL_PORCH_C[1]);pf.rotation.y=-Math.atan2(SL_U[1],SL_U[0])+Math.PI/2;g.add(pf);
  for(let k=1;k<=Math.min(6,Math.ceil((y0-at(...FP[1].at(FP[1].len/2,0,1.2).filter((_,i)=>i!==1) as unknown as P2))/.18));k++){
    const[x,,z]=FP[1].at(FP[1].len/2,0,.3*k);block(g,flat('#d6d2c8'),x,y0-.18*k-.15,z,3,.18,.32,FP[1].ry);}
  // the gable over everything (porch + nave), the triangle over the porch front with the
  // saint's picture in its red frame, the cross on the apex
  const allC=SL_ALL_C,rise=1.6;
  gable(g,allC,SL_U,SL_W,SL_D+4.2,eave,rise,corrugated('#a3a49f'),.45);
  gableTri(g,FP[1],eave,rise,white);gableTri(g,F[3],eave,rise,white);
  {const[x,,z]=FP[1].at(FP[1].len/2,0,.05);
    block(g,flat('#c0392b'),x,eave-.15,z,.95,1.25,.06,FP[1].ry);
    const pic=new THREE.Mesh(new THREE.PlaneGeometry(.7,1),T('slPic',()=>matte({color:'#e9d7b8',emissive:0x1a1408})));const[px,,pz]=FP[1].at(FP[1].len/2,0,.09);
    pic.position.set(px,eave+.47,pz);pic.rotation.y=FP[1].ry;g.add(pic);
    const[cx,,cz]=FP[1].at(FP[1].len/2,0,-.1);cross(g,cx,eave+rise-.1,cz,FP[1].ry);}
  // the red sheet-metal gate of the side yard
  {const f=F[2],[x,,z]=f.at(1.5,0,-2.2);block(g,flat('#c0412f'),x,at(x,z)-.2,z,3.2,2.2,.08,f.ry+Math.PI/2);}
  return r;}};

// ============================== Paróquia Nossa Senhora Aparecida ==============================
const AP_U:P2=[.45,-.893];                                 // along the nave, toward the back (north-north-east)
const AP_NAVE_C:P2=[1176,-198],AP_W=11,AP_D=24;
const AP_FRONT:P2=[AP_NAVE_C[0]-AP_U[0]*AP_D/2,AP_NAVE_C[1]-AP_U[1]*AP_D/2];
const AP_RIGHT:P2=[-AP_U[1],AP_U[0]];                       // the right hand of someone facing the front
const AP_TOWER_C:P2=[AP_FRONT[0]+AP_RIGHT[0]*(AP_W/2+1.9)+AP_U[0]*1.9,AP_FRONT[1]+AP_RIGHT[1]*(AP_W/2+1.9)+AP_U[1]*1.9];
const AP_NAVE=box4(AP_NAVE_C,AP_U,AP_W,AP_D);
const aparecida:Publico={id:'aparecida',nome:'Paróquia Nossa Senhora Aparecida',origin:AP_NAVE_C,
  foot:[solid(AP_NAVE_C,AP_U,AP_W,AP_D,9),solid(AP_TOWER_C,AP_U,3.8,3.8,18)],build(at){
  const{r,g}=root(AP_NAVE_C),ins=cen(AP_NAVE);
  const lo=Math.min(...AP_NAVE.map(p=>at(...p))),y0=at(...AP_FRONT)+.25,eave=y0+7;
  const br=brick();
  walls(g,AP_NAVE,lo-.6,eave,br,1,ins);
  const F=AP_NAVE.map((a,i)=>face(a,AP_NAVE[(i+1)%4],ins));      // F[1] = the front (south-south-west), F[3] = the back
  const front=F[1];
  // the flat-topped front, a little higher than the eaves, and the cross in relief
  {const[x,,z]=front.at(front.len/2,0,-.1);block(g,br,x,eave,z,AP_W,1.6,.4,front.ry);}
  onFace(g,front,flat('#d9c6a6'),front.len/2,y0+4.2,.42,4.6,.08,.08);
  onFace(g,front,flat('#d9c6a6'),front.len/2,y0+7.1,2.6,.42,.08,.08);
  const glass=T('apGlass',()=>matte({color:'#2c3036',emissive:0x0a0b0d}));
  for(const s of[front.len/2-3.4,front.len/2+3.4])archWindow(g,front,s,y0+.9,.9,2.2,'#7a4a2c',glass);
  for(const f of[F[0],F[2]])for(let k=0;k<6;k++)archWindow(g,f,2.4+k*(f.len-4.8)/5,y0+1.8,.8,2.6,'#7a4a2c',glass);
  // the porch: clay-tiled hip roof on timber posts over the wooden doors
  opening(g,front,front.len/2,y0,2.4,3.1,{fill:T('apDoor',()=>matte({color:'#8a5a32'})),frame:'#5e3b22',panes:2});
  const pc:P2=[AP_FRONT[0]-AP_U[0]*1.4,AP_FRONT[1]-AP_U[1]*1.4],PQ=box4(pc,AP_U,4.4,2.8);
  hipRoofQuad(g,[PQ[1],PQ[2],PQ[3],PQ[0]],y0+3.4,1,'#b0603f',.35);
  for(const k of[-1,1]){const[x,z]=[pc[0]-AP_U[0]*1.2+AP_RIGHT[0]*k*1.9,pc[1]-AP_U[1]*1.2+AP_RIGHT[1]*k*1.9];block(g,flat('#6e4428'),x,at(x,z),z,.22,y0+3.4-at(x,z),.22);}
  // the nave roof hidden behind the brick: a low fibre-cement gable
  gable(g,AP_NAVE_C,AP_U,AP_W,AP_D,eave,1.4,corrugated('#9b9c97'),.2);
  gableTri(g,F[3],eave,1.4,br);
  // the bell tower: brick shaft, the clock, the belfry arches, a pyramid cap, the cross
  {const[tx,tz]=AP_TOWER_C,H=17,ry=-Math.atan2(AP_U[1],AP_U[0])+Math.PI/2,bot=Math.min(lo,at(tx,tz))-.6,topY=y0+H;
    const t=new THREE.Mesh(new THREE.BoxGeometry(3.8,topY-bot,3.8),br);t.position.set(tx,(bot+topY)/2,tz);t.rotation.y=ry;t.castShadow=true;g.add(t);
    const TQ=box4(AP_TOWER_C,AP_U,3.8,3.8),TF=TQ.map((a,i)=>face(a,TQ[(i+1)%4],AP_TOWER_C));
    for(const f of TF){
      const clock=new THREE.Mesh(new THREE.CircleGeometry(.7,24),T('apClock',()=>matte({color:'#f2f0ea'})));const[x,,z]=f.at(f.len/2,0,.03);clock.position.set(x,y0+H-4.8,z);clock.rotation.y=f.ry;g.add(clock);
      for(const a of[0,2.2])onFace(g,f,flat('#1d1d1d'),f.len/2,y0+H-4.8+(a?0:-.05),.05,.55,.05,.02);
      for(const s of[f.len/2-.7,f.len/2+.7])archWindow(g,f,s,y0+H-3.2,.55,1.4,'#8b5a3a',T('apBelfry',()=>matte({color:'#1c1b1a'})));
    }
    block(g,flat('#c3b29a'),tx,y0+H,tz,4.1,.25,4.1,ry);
    cross(g,tx,y0+H+.25,tz,ry,1.8,'#d9d4c8');}
  return r;}};

export const IGREJAS:Publico[]=[santaLuzia,aparecida];
