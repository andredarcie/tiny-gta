import * as THREE from 'three';
import {matte} from '../matte.ts';
import {drape,strip,settM,type GroundAt,type P2} from './praca-chao.ts';
import {flat,face,opening,glassM,canvasTex,block,hPoly,apron} from './posto-kit.ts';
import {leafMat,leafMass} from './copa.ts';
import {building,rect,type Publico} from './publicos.ts';
import Imperial from './palmeira-imperial.ts';
import ArvoreRua from './arvore-rua.ts';
import ArvorePraca from './arvore-praca.ts';

// The western entrance of the town on the Rua São Paulo, by the junction with the SP-344
// (Street View sitio-a / -a-zoom / -mac / -m / -n, local), and the sítio up the drive that
// starts there (no Street View inside: laid out from the Google z20/z21 satellite,
// sat-sitio*, sat21-sitio-*):
//  - the MASONIC MONUMENT on the grass bank west of the road: a triangular platform (sides
//    ≈ 12 m) on stepped tiers whose risers are black-and-white checkerboard, a pale floor,
//    three fluted white columns at the corners, the square and compasses with the G on a
//    dark pedestal in the middle, a flight of stone slabs down the bank toward the road;
//  - the SÍTIO DRIVE leaving the road westward: granite setts between dark kerbs, clipped
//    golden duranta hedges on both sides, royal palms in two rows, wire fences on concrete
//    posts beyond; the white sloping wing wall on the south side of its mouth;
//  - across the road, the VERGE: a lawn behind a white kerb, a row of royal palms with
//    whitewashed feet, a Bismarck palm, the white-posted chain-link fence and ficus behind,
//    the DEVAGAR sign;
//  - the SEDE do sítio (satellite only — walls, doors and windows inferred): a walled yard
//    with the main house under light hipped roofs (main block, veranda, east wing, a flat
//    annex), the hipped outbuilding/garage on the north wall, the paved yard with a marked
//    court, the shed, the lawn garden with trees and a fire ring on the south-east, the
//    gate with the pink resedá and the palm;
//  - the CASINHA at the end of the dirt track, clay hipped roof, fenced yard.
// Town-local metres shifted by each entry's origin, as publicos.ts. No default export.
const mats=new Map<string,THREE.Material>();
const M=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=mats.get(k);if(!m){m=f();mats.set(k,m);}return m;};
function root(o:P2):{r:THREE.Group;g:THREE.Group}{const r=new THREE.Group(),g=new THREE.Group();g.position.set(-o[0],0,-o[1]);r.add(g);return{r,g};}
const cen=(p:P2[]):P2=>[p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];
const hedgeM=leafMat(0x9cb84a),hedgeDark=leafMat(0x5f8a3a),pinkM=leafMat(0xd77aa8);
// a clipped hedge along a polyline: overlapping leaf masses at 1.1 m
function hedge(g:THREE.Group,at:GroundAt,pts:P2[],h=.8,m:THREE.Material=hedgeM):void{
  for(let i=1;i<pts.length;i++){const[a0,a1]=pts[i-1],[b0,b1]=pts[i],L=Math.hypot(b0-a0,b1-a1),n=Math.ceil(L/1.1);
    for(let k=0;k<n;k++){const t=(k+.5)/n,x=a0+(b0-a0)*t,z=a1+(b1-a1)*t,b=new THREE.Mesh(leafMass(1+k%3,.2,2),m);
      b.scale.set(.75,h*.62,.6);b.rotation.y=-Math.atan2(b1-a1,b0-a0);b.position.set(x,at(x,z)+h*.5,z);b.castShadow=true;g.add(b);}}
}
// a wire fence on concrete posts along a polyline (posts every 2.5 m, 4 strands)
function wireFence(g:THREE.Group,at:GroundAt,pts:P2[],post='#d9d6cf',h=1.5,top=false):void{
  for(let i=1;i<pts.length;i++){const[a0,a1]=pts[i-1],[b0,b1]=pts[i],L=Math.hypot(b0-a0,b1-a1),n=Math.max(1,Math.round(L/2.5));
    for(let k=0;k<=n;k++){const t=k/n,x=a0+(b0-a0)*t,z=a1+(b1-a1)*t,y=at(x,z);block(g,flat(post),x,y-.2,z,.12,h+.2,.12);
      if(top){const c=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.4),flat(post));c.position.set(x,y+h+.05,z+.15);c.rotation.x=.6;g.add(c);}}
    for(let s=1;s<=4;s++){const y0=at(a0,a1),y1=at(b0,b1),yy=s/4*h*.95;
      const w=new THREE.Mesh(new THREE.BoxGeometry(L,.012,.012),flat('#7d8184'));w.position.set((a0+b0)/2,(y0+y1)/2+yy,(a1+b1)/2);
      w.rotation.set(0,-Math.atan2(b1-a1,b0-a0),Math.atan2(y1-y0,L),'YXZ');g.add(w);}}
}
// a chain-link panel between two points, height h
function chainLink(g:THREE.Group,at:GroundAt,a:P2,b:P2,h:number):void{
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),m=M('chain',()=>matte({color:0xb7bcbf,alphaTest:.5,side:THREE.DoubleSide,map:canvasTex(128,64,(c,W,H)=>{c.clearRect(0,0,W,H);c.strokeStyle='#fff';c.lineWidth=1.2;
    for(let x=-H;x<W+H;x+=6){c.beginPath();c.moveTo(x,0);c.lineTo(x+H,H);c.stroke();c.beginPath();c.moveTo(x+H,0);c.lineTo(x,H);c.stroke();}})}));
  const geo=new THREE.PlaneGeometry(L,h),uv=geo.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setX(i,uv.getX(i)*L/2);
  const p=new THREE.Mesh(geo,m),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;p.position.set(mx,at(mx,mz)+h/2+.15,mz);p.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(p);
}
const palm=(g:THREE.Group,at:GroundAt,x:number,z:number,h:number,white=false):void=>{const p=Imperial.build({h,whitewash:white,seed:Math.round(x*3+z)});p.position.set(x,at(x,z)-.1,z);g.add(p);};

// ============================== the masonic monument ==============================
// triangle from the satellite (apex north), the steps toward the road (east-south-east)
const TRI:P2[]=[[-1322,-604],[-1316,-591.5],[-1328,-592.5]];
const checkerM=():THREE.Material=>M('checker',()=>matte({map:canvasTex(256,32,(c,W,H)=>{for(let i=0;i<16;i++){c.fillStyle=i%2?'#1c1c1e':'#f2f1ec';c.fillRect(i*W/16,0,W/16,H);}})}));
const maconaria:Publico={id:'maconaria',nome:'Monumento maçônico',origin:cen(TRI),foot:[],build(at){
  const c=cen(TRI),{r,g}=root(c);
  const hi=Math.max(...TRI.map(p=>at(...p))),lo=Math.min(...TRI.map(p=>at(...p)));
  // three stepped tiers, each a triangle grown outward; risers checkered, treads pale
  const tiers=[{d:1.2,y:lo-.4},{d:.6,y:hi+.05},{d:0,y:hi+.35}];
  const grow=(d:number):P2[]=>TRI.map(([x,z])=>{const dx=x-c[0],dz=z-c[1],l=Math.hypot(dx,dz);return[x+dx/l*d*1.8,z+dz/l*d*1.8] as P2;});
  let prevTop=lo-.6;
  for(const[k,t]of tiers.entries()){
    const P=grow(t.d),top=k===0?hi-.25:t.y;
    // riser: a prism; its outer faces carry the checkerboard
    for(let i=0;i<3;i++){const a=P[i],b=P[(i+1)%3],L=Math.hypot(b[0]-a[0],b[1]-a[1]),f=face(a,b,c);
      const geo=new THREE.PlaneGeometry(L,top-prevTop),uv=geo.getAttribute('uv') as THREE.BufferAttribute;for(let j=0;j<uv.count;j++)uv.setX(j,uv.getX(j)*L/(16*.5));
      const m=new THREE.Mesh(geo,k===0?flat('#d9d6cf'):checkerM());const[x,,z]=f.at(L/2,0,0);m.position.set(x,(top+prevTop)/2,z);m.rotation.y=f.ry;g.add(m);}
    g.add(hPoly(P,top,flat(k===2?'#ece6d6':'#d9d6cf')));
    prevTop=top;
  }
  const floor=prevTop;
  // the three fluted columns, inset at the corners
  for(const p of grow(-1.1)){
    const col=new THREE.Group();col.position.set(p[0],floor,p[1]);g.add(col);
    const base=new THREE.Mesh(new THREE.BoxGeometry(.85,.3,.85),flat('#f2f1ec'));base.position.y=.15;col.add(base);
    const tor=new THREE.Mesh(new THREE.CylinderGeometry(.38,.42,.18,16),flat('#f2f1ec'));tor.position.y=.39;col.add(tor);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.26,.3,5.4,20),M('flute',()=>matte({color:0xf2f1ec,map:canvasTex(128,16,(x,W,H)=>{
      x.fillStyle='#ffffff';x.fillRect(0,0,W,H);for(let i=0;i<20;i++){x.fillStyle='rgba(120,120,115,.35)';x.fillRect(i*W/20,0,2,H);}})})));
    shaft.position.y=.48+2.7;shaft.castShadow=true;col.add(shaft);
    const ech=new THREE.Mesh(new THREE.CylinderGeometry(.42,.28,.3,16),flat('#f2f1ec'));ech.position.y=6.03;col.add(ech);
    const ab=new THREE.Mesh(new THREE.BoxGeometry(.95,.24,.95),flat('#ece9e0'));ab.position.y=6.3;ab.castShadow=true;col.add(ab);
  }
  // the square and compasses with the G, on its dark pedestal, facing the road
  {const ped=new THREE.Mesh(new THREE.BoxGeometry(.9,.75,.6),flat('#3a3c3e'));ped.position.set(c[0],floor+.37,c[1]);g.add(ped);
    const em=new THREE.Group();em.position.set(c[0],floor+.75,c[1]);em.rotation.y=Math.PI/2+.35;g.add(em);
    const steel=flat('#a9adb0'),bar=(len:number,x:number,y:number,rz:number,w=.14):void=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,len,.1),steel);b.position.set(x,y,0);b.rotation.z=rz;b.castShadow=true;em.add(b);};
    bar(1.75,-.38,.8,-.42);bar(1.75,.38,.8,.42);                       // compasses
    const hinge=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.12,12),steel);hinge.rotation.x=Math.PI/2;hinge.position.set(0,1.6,0);em.add(hinge);
    bar(1.4,-.35,.45,Math.PI/4,.16);bar(1.4,.35,.45,-Math.PI/4,.16);   // square (an inverted V)
    const gl=new THREE.Mesh(new THREE.PlaneGeometry(.45,.5),M('gG',()=>matte({transparent:true,map:canvasTex(64,64,(x,W,H)=>{x.clearRect(0,0,W,H);x.fillStyle='#9a9ea2';x.font='900 52px Georgia';x.textAlign='center';x.textBaseline='middle';x.fillText('G',W/2,H/2+3);})})));
    gl.position.set(0,.85,.06);em.add(gl);const gl2=gl.clone();gl2.rotation.y=Math.PI;gl2.position.z=-.06;em.add(gl2);}
  // the slab steps down the bank toward the road (east-south-east)
  {const a=TRI[1],b=TRI[0],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,f=face(b,a,c),[ox,oz]=f.n;
    for(let k=0;k<9;k++){const x=mx+ox*(2.2+k*.75),z=mz+oz*(2.2+k*.75);
      const s=new THREE.Mesh(new THREE.BoxGeometry(1.2+(k%2)*.2,.12,.55),M('slab',()=>matte({color:0x8f8a80,flatShading:true})));s.position.set(x,at(x,z)+.04,z);s.rotation.y=f.ry+(k%3-1)*.08;g.add(s);}}
  return r;}};

// ============================== the drive, the verge across the road ==============================
// the drive: from the Rua São Paulo kerb (x -1314) up west along the OSM track to x -1400
// (7.2 m between the kerbs: the width the town draws the OSM track with)
const DRIVE:P2[]=[[-1322.2,-560.6],[-1336,-559],[-1370,-556],[-1400,-552]];
const along=(t:number):{p:P2;n:P2}=>{const Ls=DRIVE.slice(1).map((q,i)=>Math.hypot(q[0]-DRIVE[i][0],q[1]-DRIVE[i][1])),tot=Ls.reduce((a,b)=>a+b,0);let d=t*tot;
  for(let i=0;i<Ls.length;i++){if(d<=Ls[i]||i===Ls.length-1){const a=DRIVE[i],b=DRIVE[i+1],u=Math.min(1,d/Ls[i]),dx=(b[0]-a[0])/Ls[i],dz=(b[1]-a[1])/Ls[i];return{p:[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u],n:[-dz,dx]};}d-=Ls[i];}
  return{p:DRIVE[0],n:[0,1]};};
const entrada:Publico={id:'sitio-entrada',nome:'Entrada do sítio (palmeiras, Rua São Paulo)',origin:[-1340,-560],foot:[],build(at){
  const{r,g}=root([-1340,-560]);
  // setts between dark kerbs (5 m), drawn over the town's dirt track
  for(let i=1;i<DRIVE.length;i++){const a=DRIVE[i-1],b=DRIVE[i];g.add(drape(strip(a,b,7.4),at,.2,settM,[],2,Math.atan2(b[1]-a[1],b[0]-a[0])));}
  for(const s of[-1,1]){const ed:P2[]=[];for(let t=0;t<=1.0001;t+=.02){const{p,n}=along(t);ed.push([p[0]+n[0]*3.8*s,p[1]+n[1]*3.8*s]);}
    for(let i=1;i<ed.length;i++){const[a0,a1]=ed[i-1],[b0,b1]=ed[i],L=Math.hypot(b0-a0,b1-a1),k=new THREE.Mesh(new THREE.BoxGeometry(L,.3,.22),flat('#55524c'));
      k.position.set((a0+b0)/2,at((a0+b0)/2,(a1+b1)/2)+.12,(a1+b1)/2);k.rotation.y=-Math.atan2(b1-a1,b0-a0);g.add(k);}
    // (on the south side the hedge starts past the white wing wall)
    const hd:P2[]=[];for(let t=s>0?.13:0;t<=1.0001;t+=.05){const{p,n}=along(t);hd.push([p[0]+n[0]*4.5*s,p[1]+n[1]*4.5*s]);}
    hedge(g,at,hd,.85);
    // royal palms every ~9 m behind the hedge, the wire fence beyond them
    for(let t=.04;t<.98;t+=.105){const{p,n}=along(t+(s>0?.05:0));palm(g,at,p[0]+n[0]*6.2*s,p[1]+n[1]*6.2*s,11+((t*31)%3));}
    const fn:P2[]=[];for(let t=.06;t<=1.0001;t+=.1){const{p,n}=along(t);fn.push([p[0]+n[0]*9*s,p[1]+n[1]*9*s]);}
    wireFence(g,at,fn,'#d9d6cf',1.4);
  }
  // the white sloping wing wall on the south side of the drive's mouth
  {const a:P2=[-1323,-556.1],b:P2=[-1333.5,-554.4],L=Math.hypot(b[0]-a[0],b[1]-a[1]),sh=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(L,0),new THREE.Vector2(L,.05),new THREE.Vector2(0,1.6)]);
    const m=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.3,bevelEnabled:false}),flat('#f2f1ec'));m.position.set(a[0],at(...a)-.1,a[1]);m.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);m.castShadow=true;g.add(m);}
  // a few big trees and ipês of the bank north of the drive
  for(const[x,z,k]of[[-1350,-572,'copa'],[-1336,-576,'ipe'],[-1365,-568,'copa']] as [number,number,'copa'|'ipe'][]){
    const t=ArvorePraca.build({kind:k,r:k==='copa'?4:2.4,seed:Math.round(x)});t.position.set(x,at(x,z),z);g.add(t);}
  // ---- the verge across the road (east of the Rua São Paulo)
  const V0:P2=[-1304.4,-590],V1:P2=[-1315.6,-545];               // the road's east kerb (OSM centre + 4 m), from the south end northward
  const vx=(t:number):P2=>[V0[0]+(V1[0]-V0[0])*t,V0[1]+(V1[1]-V0[1])*t];
  const L=Math.hypot(V1[0]-V0[0],V1[1]-V0[1]),ux=(V1[0]-V0[0])/L,uz=(V1[1]-V0[1])/L,ex=uz,ez=-ux;   // (ex,ez) points east, away from the road
  const off=(t:number,o:number):P2=>{const[p0,p1]=vx(t);return[p0+ex*o,p1+ez*o];};
  // white kerb, lawn, palms with whitewashed feet, Bismarck palms, chain-link + white posts, ficus
  for(let t=0;t<1;t+=.05){const a=off(t,.2),b=off(t+.05,.2),l=Math.hypot(b[0]-a[0],b[1]-a[1]);const k=new THREE.Mesh(new THREE.BoxGeometry(l,.35,.25),flat('#f4f3ee'));
    k.position.set((a[0]+b[0])/2,at((a[0]+b[0])/2,(a[1]+b[1])/2)+.1,(a[1]+b[1])/2);k.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(k);}
  g.add(drape([off(0,.3),off(1,.3),off(1,11),off(0,11)],at,.1,M('lawnV',()=>matte({color:0x6f9a48,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}))));
  for(let t=.05;t<.96;t+=.12){const[x,z]=off(t,9.5);palm(g,at,x,z,12+((t*17)%2),true);}
  for(const t of[.3,.62]){const[x,z]=off(t,4.5),b=new THREE.Group();for(let k=0;k<14;k++){const fan=new THREE.Mesh(new THREE.CircleGeometry(1.1,10,0,Math.PI),M('bism',()=>matte({color:0xb8c6c0,side:THREE.DoubleSide})));
      fan.position.set(Math.cos(k*.45)*.6,2.4+(k%3)*.25,Math.sin(k*.45)*.6);fan.rotation.set(-.6,k*.45,0,'YXZ');b.add(fan);}
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(.28,.34,2.2,8),flat('#6a5a46'));tr.position.y=1.1;b.add(tr);b.position.set(x,at(x,z),z);g.add(b);}
  {const p0=off(0,11),p1=off(1,11);for(let t=0;t<=1.0001;t+=.1){const[x,z]=[p0[0]+(p1[0]-p0[0])*t,p0[1]+(p1[1]-p0[1])*t];block(g,flat('#f4f3ee'),x,at(x,z)-.2,z,.14,2.1,.14);}
    chainLink(g,at,p0,p1,1.8);}
  for(let t=.08;t<1;t+=.14){const[x,z]=off(t,15);const f=ArvoreRua.build({kind:'ficus'});f.scale.setScalar(1.1);f.position.set(x,at(x,z),z);g.add(f);}
  {const[x,z]=off(.48,1.6);block(g,flat('#5a5a58'),x,at(x,z),z,.06,1.9,.06);
    const s=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),M('devagar',()=>matte({side:THREE.DoubleSide,map:canvasTex(128,128,(c,W,H)=>{c.fillStyle='#f2c418';c.fillRect(0,0,W,H);c.strokeStyle='#111';c.lineWidth=6;c.strokeRect(5,5,W-10,H-10);
      c.fillStyle='#111';c.font='900 26px Arial';c.textAlign='center';c.textBaseline='middle';c.fillText('DEVAGAR',W/2,H/2);})})));
    s.position.set(x,at(x,z)+1.9,z);s.rotation.set(0,-Math.atan2(uz,ux)-Math.PI/2,Math.PI/4,'YXZ');g.add(s);}
  return r;}};

// ============================== the sede do sítio ==============================
const RA=-.17;                                                   // the buildings' grid (satellite)
const MAIN=rect(-1503,-619,24,12,RA),VER=rect(-1504.5,-610.8,17,3.6,RA),EAST=rect(-1490.5,-621.5,13,7,RA);
const ANNEX=rect(-1483.6,-623.6,5,6,RA),GARAGE=rect(-1481,-634.6,13,9,-.12),SHED=rect(-1514,-630,3.2,2.2,-.2);
const YARD:P2[]=[[-1527,-626.5],[-1517,-631.5],[-1488.5,-637],[-1484,-616],[-1484,-608],[-1491,-603.5],[-1497.5,-598],[-1498,-594],[-1527,-595.5]];
const GARDEN:P2[]=[[-1488.5,-637],[-1474.5,-639.5],[-1476,-582.5],[-1497,-591.5],[-1497.5,-598],[-1491,-603.5],[-1484,-608],[-1484,-616]];
const BOUNDS:P2[]=[[-1527,-595.5],[-1527,-626.5],[-1517,-631.5],[-1488.5,-637],[-1474.5,-639.5],[-1476,-582.5],[-1497,-591.5]];
const sede:Publico={id:'sitio-sede',nome:'Sede do sítio (pelo satélite)',origin:[-1503,-612],
  foot:[[-1503,-619,24,12,RA,7],[-1490.5,-621.5,13,7,RA,5],[-1481,-634.6,13,9,-.12,5.5],[-1514,-630,3.2,2.2,-.2,2.5]],build(at){
  const{r,g}=root([-1503,-612]);
  // ground: the paved yard (with the drive to the gate) and the lawn garden
  apron(g,at,YARD);
  g.add(drape(GARDEN,at,.1,M('lawnS',()=>matte({color:0x6a8f45,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}))));
  // the marked court on the yard (white lines)
  {const C=rect(-1519.5,-611,10.5,19,RA),line=M('lineS',()=>matte({color:0xf2f2ee,polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}));
    const ln=(a:P2,b:P2):void=>{g.add(drape(strip(a,b,.12),at,.14,line,[],1.5));};
    for(let i=0;i<4;i++)ln(C[i],C[(i+1)%4]);
    for(const t of[.25,.5,.75])ln([C[0][0]+(C[3][0]-C[0][0])*t,C[0][1]+(C[3][1]-C[0][1])*t],[C[1][0]+(C[2][0]-C[1][0])*t,C[1][1]+(C[2][1]-C[1][1])*t]);}
  // the main house: white walls, light beige hipped roofs, a veranda on round posts
  const T='#d8c39a',W='#f1efe9';
  {const{y0,eave,F}=building(g,at,MAIN,{h:3.1,wall:W,plinth:'#b9b3a6',plinthH:.45,roof:'hip',tile:T,rise:2.4,fascia:'#f6f5f1'});
    const S=F[2];                                                 // the south front (seen from the yard)
    for(const s of[3,8.5,15.5,21])opening(g,S,s,y0+.95,1.6,1.25,{fill:glassM(),frame:'#6a4a34',panes:2});
    opening(g,S,12,y0,1.5,2.3,{fill:M('doorS',()=>matte({color:0x6a4a34})),frame:'#4a3424',panes:2});
    for(const f of[F[0],F[1],F[3]])for(let s=2.5;s<f.len-1.5;s+=4.2)opening(g,f,s,y0+1,1.3,1.1,{fill:glassM(),frame:'#6a4a34',panes:2});
    // veranda: floor, round white posts, a lean-to roof in the same tile
    const vy=y0;g.add(hPoly(VER,vy+.02,M('verFloor',()=>matte({color:0xb06a4a}))));
    const[v0,v1,v2,v3]=VER;for(let k=0;k<=4;k++){const t=k/4,x=v3[0]+(v2[0]-v3[0])*t,z=v3[1]+(v2[1]-v3[1])*t;const p=new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,2.8,10),flat(W));p.position.set(x,vy+1.4,z);p.castShadow=true;g.add(p);}
    const lean=[v0,v1,v2,v3].map(([x,z],i)=>[x,(i<2?eave-.1:vy+2.8),z]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([...lean[0],...lean[3],...lean[2],...lean[0],...lean[2],...lean[1]],3));geo.computeVertexNormals();
    const rf=new THREE.Mesh(geo,M('verRoof',()=>matte({color:T,side:THREE.DoubleSide})));rf.castShadow=true;g.add(rf);}
  {const{y0,F}=building(g,at,EAST,{h:2.9,wall:W,plinth:'#b9b3a6',plinthH:.45,roof:'hip',tile:T,rise:1.8,fascia:'#f6f5f1'});
    for(const s of[2.5,7,11])opening(g,F[2],s,y0+1,1.4,1.1,{fill:glassM(),frame:'#6a4a34',panes:2});}
  {const lo=Math.min(...ANNEX.map(p=>at(...p))),y=Math.max(...ANNEX.map(p=>at(...p)))+.15;
    g.add(hPoly(ANNEX,y+2.7,M('polyc',()=>matte({color:0xe6e8e8,transparent:true,opacity:.85,side:THREE.DoubleSide}))));
    for(const p of ANNEX)block(g,flat(W),p[0],lo,p[1],.14,y+2.7-lo,.14);}
  // the outbuilding / garage on the north wall: two roll-up doors to the yard
  {const{y0,F}=building(g,at,GARAGE,{h:3.2,wall:W,plinth:'#b9b3a6',plinthH:.4,roof:'hip',tile:T,rise:2,fascia:'#f6f5f1'});
    const S=F[2];for(const s of[3.2,8.2])opening(g,S,s,y0,3.2,2.6,{fill:M('roll',()=>matte({map:canvasTex(32,64,(c,W2,H)=>{c.fillStyle='#d6d6d2';c.fillRect(0,0,W2,H);c.fillStyle='#a9a9a4';for(let y=0;y<H;y+=4)c.fillRect(0,y,W2,1);})})),frame:'#b9b3a6'});
    opening(g,S,11.8,y0+1,.9,1,{fill:glassM(),frame:'#6a4a34'});}
  building(g,at,SHED,{h:2,wall:'#d9d6cf',roof:'hip',tile:'#9b5a44',rise:.6});
  // boundary: a white wall on the north, white posts with wire elsewhere; the gate at the south
  {const wallM=flat('#efede6');
    const north:[P2,P2][]=[[BOUNDS[1],BOUNDS[2]],[BOUNDS[2],BOUNDS[3]],[BOUNDS[3],BOUNDS[4]]];
    for(const[a,b]of north){const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(L/4);for(let k=0;k<n;k++){const t0=k/n,t1=(k+1)/n,x=a[0]+(b[0]-a[0])*(t0+t1)/2,z=a[1]+(b[1]-a[1])*(t0+t1)/2;
      const w=new THREE.Mesh(new THREE.BoxGeometry(L/n+.02,2.4,.2),wallM);w.position.set(x,at(x,z)+.9,z);w.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(w);}}
    wireFence(g,at,[BOUNDS[4],BOUNDS[5],BOUNDS[6]],'#f2f1ec',1.5,true);
    wireFence(g,at,[[-1514,-595.2],BOUNDS[0],BOUNDS[1]],'#f2f1ec',1.5,true);
    // gate leaves (open) between the two pillars
    for(const[x,z]of[[-1514.5,-595],[-1497.5,-592]] as P2[])block(g,flat('#efede6'),x,at(x,z)-.2,z,.5,2.4,.5);}
  // the garden: trees and shrubs from the satellite, the fire ring, the paths
  for(const[x,z,k,s]of[[-1490,-598,'copa',.6],[-1483,-596,'copa',.55],[-1478,-601,'ficus',.8],[-1493,-589,'copa',.5],[-1486,-590,'copa',.6],[-1480,-588,'ficus',.7],
    [-1479,-612,'copa',.55],[-1478,-622,'ficus',.7],[-1480,-630,'copa',.5],[-1489,-606,'reseda',.8]] as [number,number,'copa'|'ficus'|'reseda',number][]){
    const t=k==='copa'?ArvorePraca.build({kind:'copa',r:5*s,seed:Math.round(x+z)}):ArvoreRua.build({kind:k});if(k!=='copa')t.scale.setScalar(s+.2);t.position.set(x,at(x,z),z);g.add(t);}
  for(let i=0;i<14;i++){const x=-1495+((i*7)%19),z=-604+((i*11)%22);if(z<-610&&x<-1484)continue;const b=new THREE.Mesh(leafMass(1+i%3,.3,2),i%4?hedgeDark:pinkM);b.scale.setScalar(.6);b.position.set(x,at(x,z)+.45,z);g.add(b);}
  {const x=-1484,z=-617,y=at(x,z);const ring=new THREE.Mesh(new THREE.TorusGeometry(1.4,.25,6,18),M('stoneRing',()=>matte({color:0x9a958a,flatShading:true})));ring.rotation.x=Math.PI/2;ring.position.set(x,y+.15,z);g.add(ring);}
  g.add(drape(strip([-1486,-607],[-1472,-604],1.4),at,.13,M('pathS',()=>matte({color:0xc9c3b6,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}))));
  // the pink resedá at the gate, the big palm and the round planter outside the west corner
  // (the OSM track runs ~4 m north of the real one here: these keep north of it)
  {const t=ArvoreRua.build({kind:'reseda'});t.scale.setScalar(1.2);t.position.set(-1495.5,at(-1495.5,-595.5),-595.5);g.add(t);}
  palm(g,at,-1537,-594.5,10);
  {const x=-1531,z=-596;const p=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,.5,18,1,true),M('planter',()=>matte({color:0xefede6,side:THREE.DoubleSide})));p.position.set(x,at(x,z)+.25,z);g.add(p);
    const b=new THREE.Mesh(leafMass(2,.3,2),hedgeDark);b.scale.set(1,.6,1);b.position.set(x,at(x,z)+.6,z);g.add(b);}
  return r;}};

// ============================== the casinha at the end of the track ==============================
const CAS=rect(-1569,-561,18.5,11,-.46);
// (its north side between the house and the track)
const CAS_YARD:P2[]=[[-1591,-570],[-1589,-552],[-1572,-546.5],[-1553,-552],[-1553,-569],[-1563,-572.6],[-1576,-571.5]];
const casinha:Publico={id:'sitio-casinha',nome:'Casinha do sítio (pelo satélite)',origin:[-1569,-561],foot:[[-1569,-561,18.5,11,-.46,6]],build(at){
  const{r,g}=root([-1569,-561]);
  const{y0,F}=building(g,at,CAS,{h:3,wall:'#ece4d2',plinth:'#a8553e',plinthH:.5,roof:'hip',tile:'#b0603f',rise:2.6,fascia:'#efe9dc'});
  const S=F[2];                                                   // the south-east front (the dark band in the satellite: its veranda)
  for(const s of[3,7.5,12,16])opening(g,S,s,y0+.95,1.4,1.2,{fill:glassM(),frame:'#6a4630',panes:2});
  opening(g,S,9.7,y0,1,2.2,{fill:M('doorC',()=>matte({color:0x6a4630})),frame:'#4a3020'});
  for(const f of[F[0],F[1],F[3]])opening(g,f,f.len/2,y0+1,1.2,1.1,{fill:glassM(),frame:'#6a4630',panes:2});
  wireFence(g,at,[...CAS_YARD,CAS_YARD[0]],'#e9e6de',1.3);
  for(const[x,z]of[[-1588,-566],[-1587,-560],[-1586,-555]] as P2[]){const t=ArvorePraca.build({kind:'copa',r:2.6,seed:Math.round(x+z)});t.position.set(x,at(x,z),z);g.add(t);}
  return r;}};

export const SITIO:Publico[]=[maconaria,entrada,sede,casinha];
