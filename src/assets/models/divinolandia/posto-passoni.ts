import * as THREE from 'three';
import {matte} from '../matte.ts';
import type {GroundAt,P2} from './praca-chao.ts';
import {BR,canopy,brFascia,column,island,apron,floorLine,block,tileWall,flat,walls,face,onFace,opening,glassM,darkM,
  gableRoof,signMat,canvasTex,brLogo,board,type Face} from './posto-kit.ts';
import Bomba from './bomba-combustivel.ts';
import Palmeira from './palmeira-fenix.ts';

// Posto Petrobras — Auto Posto Passoni, Rua Lourival de Medeiros 738, at the corner of the
// Rua Augusto Sorci (the east entrance of the town, OSM node/13690275377). Rebuilt from
// Google Street View (panorama 0mZIWvZBaB57nvBePSarvA in front, posto-petrobras-e/-w on the
// street to either side, the -zoom close-ups) and the z20 satellite, kept locally in
// docs/divinolandia/referencias-*:
//  - the big rectangular CANOPY (25.4 × 18.6 m, two rows of solar panels on top): along the
//    street the white BR panel at the west end, the stripes, yellow, then green to the
//    corner; green down the side street; white ceiling with the lights;
//  - three short islands across it, numbered 1 2 / 3 4 / 5 6 from the corner: a white column
//    with the green number boxes and the fuel letters (G E, and D DIESEL on the 5 6), one
//    Petrobras pump in front, a potted plant behind; yellow bays painted on the floor;
//  - at the back, under the canopy, the flat-roofed row: the open TROCA DE ÓLEO bay, the
//    ESCRITÓRIO door, a white-tiled pier and the glazed MERCEARIA, green signs over them,
//    the tall white tank at the west corner;
//  - west of the driveway the Passoni building: the arcade porch (four arches) under a clay
//    shed roof, the end wall painted green "AUTO POSTO PASSONI MERCEARIA (19)3663-1396", the
//    pink gable with the round window behind; the old beige bar ("Beira Rio") next door;
//  - the green shade tent and the chain-link gate at the end of the driveway;
//  - at the street corner São Cristóvão carrying the Child on his shoulder (patron of
//    drivers) on a stone plinth with a phoenix palm, and the white price totem.
// build({groundAt}) is pure; TOWN-LOCAL coordinates shifted by ORIGIN, as posto-triangulo.ts.
export const ORIGIN:P2=[1145,-145];
const CANOPY:P2[]=[[1136.2,-155.1],[1161.4,-155.1],[1161.4,-136.5],[1136.2,-136.5]];
const ISLANDS:{x:number;n:[string,string];fuel:string}[]=[{x:1158.3,n:['1','2'],fuel:'G E'},{x:1151,n:['3','4'],fuel:'G E'},{x:1143.6,n:['5','6'],fuel:'D'}];
const IZ=-148;
export const POSTO_FOOT:[number,number,number,number,number,number][]=[
  ...ISLANDS.map(i=>[i.x,IZ,1.2,4.2,0,2.3] as [number,number,number,number,number,number]),
  [1147.25,-135,21.5,10,0,4],[1137.4,-138.4,1.6,1.6,0,5],
  [1127,-143.8,12,11.6,0,6],[1117.5,-143,7,14,0,5.5],
  [1160.6,-154.4,1.5,1.2,0,3.2],[1157.6,-155.4,.7,.35,0,2.8],
];

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);
  let hi=-Infinity;for(const[x,z]of[...CANOPY,[1149,-146]] as P2[])hi=Math.max(hi,at(x,z));
  const CY=hi+4.9,FH=1.25;

  // ---- forecourt: from the kerb to the back row, the driveway down the west side and the
  // strip in front of the Passoni
  apron(g,at,[[1114,-152.1],[1161.8,-164.5],[1161.8,-130],[1158,-130],[1158,-140],[1136.5,-140],[1136.5,-130],[1133.2,-130],[1133.2,-149.6],[1114,-149.6]]);
  for(const x of[1140,1147.4,1154.8])for(const dx of[0,2.6]){                   // the yellow bays before the back row
    floorLine(g,at,[x+dx,-145],[x+dx,-140.3],BR.yellow);}
  floorLine(g,at,[1139,-145],[1158,-145],BR.yellow);
  // hatched no-parking box in front of the Passoni's green wall
  for(let k=0;k<4;k++)floorLine(g,at,[1126.6+k*1.3,-151.4],[1127.6+k*1.3,-150],BR.yellow,.1);

  // ---- canopy
  canopy(g,CANOPY,{y:CY,h:FH,ceiling:'#efefeb',roof:'#b0b1ad',lights:3.4,
    solar:[{x0:1145,x1:1150.5,z0:-151,z1:-140.5},{x0:1151.5,x1:1157,z0:-151,z1:-140.5}],
    edges:[
      brFascia([['green',6.9],['g2y',2],['yellow',7],['y2w',2],['logo',7.5]]),   // the street front (seen from it: left = east)
      brFascia([['green',18.6]]),                                               // the side street
      brFascia([['yellow',7.4],['y2g',2],['green',16]]),                        // back (left = west)
      brFascia([['logo',8],['white',10.6]]),                                    // the driveway side (left = north)
    ]});

  // ---- islands
  const colM=flat('#f1f1ed');
  for(const i of ISLANDS){
    const top=island(g,at,i.x,IZ,Math.PI/2,4.2,1.2,{base:'#4a4c4f',edge:'#2f3133'});
    column(g,at,i.x,IZ+.6,CY,.6,colM);
    // the green number boxes either side of the column, the fuel letters down its faces
    for(const s of[-1,1]){
      const nb=new THREE.Mesh(new THREE.BoxGeometry(.06,.55,.5),[signMat([i.n[s<0?0:1]],{bg:BR.green,fg:'#ffffff',w:96,h:96}),flat(BR.green),flat(BR.green),flat(BR.green),flat(BR.green),flat(BR.green)]);
      nb.position.set(i.x+s*.36,CY-1.2,IZ+.6);nb.rotation.y=s<0?Math.PI:0;g.add(nb);
      const f=face([i.x+s*.3,IZ+1],[i.x+s*.3,IZ+.2],[i.x,IZ+.6]);
      onFace(g,f,fuelMat(i.fuel),.4,top+1.2,.32,1.6,.005);
    }
    const p=Bomba.build({kind:'petrobras'});p.position.set(i.x,top,IZ-1.2);p.rotation.y=Math.PI/2;g.add(p);
    // the potted plant at the back end of the island (a clay pot and a sprig of leaves)
    const pot=new THREE.Mesh(new THREE.CylinderGeometry(.3,.22,.45,10),flat('#9b5b3b'));pot.position.set(i.x,top+.22,IZ+1.65);g.add(pot);
    const pl=Palmeira.build({h:.25,seed:Math.round(i.x)});pl.scale.setScalar(.45);pl.position.set(i.x,top+.4,IZ+1.65);g.add(pl);
  }

  backRow(g,at);
  passoni(g,at);

  // ---- the corner: São Cristóvão on his stone plinth, the palm, the price totem
  {
    const x=1160.6,z=-154.4,y=at(x,z);
    const plinth=new THREE.Mesh(new THREE.DodecahedronGeometry(.8,0),matte({color:0x9a8a74,flatShading:true}));
    plinth.scale.set(1,1.1,.85);plinth.position.set(x,y+.75,z);plinth.castShadow=true;g.add(plinth);
    block(g,flat(BR.green),x,y,z,1.7,.12,1.4);
    saint(g,x,y+1.55,z);
    const palm=Palmeira.build({h:3,seed:3});palm.position.set(x-.9,y,z+.6);g.add(palm);
    const tx=1157.6,tz=-155.4,ty=at(tx,tz);
    const tm=matte({map:canvasTex(128,512,(c,w,h)=>{
      c.fillStyle='#f4f4f0';c.fillRect(0,0,w,h);brLogo(c,w/2,60,70);
      const rows=['GASOLINA','ETANOL','DIESEL S10','DIESEL'];
      rows.forEach((r,k)=>{c.fillStyle=BR.green;c.font='700 13px Arial';c.textAlign='center';c.fillText(r,w/2,140+k*90);
        c.fillStyle='#202020';c.fillRect(14,150+k*90,w-28,40);c.fillStyle='#ff5a2a';c.font='700 28px monospace';c.fillText(['6,19','4,29','6,09','5,99'][k],w/2,182+k*90);});
    })});
    const t=new THREE.Mesh(new THREE.BoxGeometry(.7,2.7,.3),[colM,colM,colM,colM,tm,tm]);t.position.set(tx,ty+1.35,tz);t.castShadow=true;g.add(t);
  }
  return root;
}

const fm=new Map<string,THREE.Material>();
function fuelMat(f:string):THREE.Material{
  let m=fm.get(f);
  if(!m){m=matte({map:canvasTex(64,320,(c,w,h)=>{
    c.fillStyle='#f1f1ed';c.fillRect(0,0,w,h);
    if(f==='D'){c.fillStyle='#e8762b';c.font='900 44px Arial';c.textAlign='center';c.fillText('D',w/2,60);c.fillText('D',w/2,130);
      c.font='700 11px Arial';c.fillText('DIESEL',w/2,78);c.fillText('S10',w/2,148);}
    else{c.fillStyle=BR.green;c.font='900 46px Arial';c.textAlign='center';c.fillText('G',w/2,60);c.fillText('E',w/2,130);}
    brLogo(c,w/2,h-40,40);
  })});fm.set(f,m);}
  return m;
}

// São Cristóvão: the bearded giant in a brown robe, staff in hand, the Child in blue on his
// left shoulder
function saint(g:THREE.Group,x:number,y:number,z:number):void{
  const s=new THREE.Group();s.position.set(x,y,z);s.rotation.y=-.6;g.add(s);
  const robe=flat('#7a5236'),skin=flat('#d9a27d'),blue=flat('#3f6fb6');
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.24,.38,1.3,10),robe);body.position.y=.65;s.add(body);
  const chest=new THREE.Mesh(new THREE.SphereGeometry(.3,10,8),robe);chest.scale.set(1,1.1,.8);chest.position.y=1.35;s.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.15,10,8),skin);head.position.y=1.75;s.add(head);
  const beard=new THREE.Mesh(new THREE.ConeGeometry(.12,.25,8),flat('#3a2a1e'));beard.rotation.x=Math.PI;beard.position.set(0,1.62,.08);s.add(beard);
  const staff=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,2.1,6),flat('#5a4028'));staff.position.set(.38,1.0,.12);s.add(staff);
  const kid=new THREE.Mesh(new THREE.CylinderGeometry(.09,.13,.38,8),blue);kid.position.set(-.22,1.78,0);s.add(kid);
  const kh=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),skin);kh.position.set(-.22,2.04,0);s.add(kh);
  s.traverse(o=>{o.castShadow=true;});
}

// The flat-roofed back row under the canopy, x 1136.5..1158, front on z = -140.
function backRow(g:THREE.Group,at:GroundAt):void{
  const P:P2[]=[[1136.5,-140],[1158,-140],[1158,-130],[1136.5,-130]],inside:P2=[1147,-135];
  const y0=at(1147,-140)+.05,base=Math.min(...P.map(([x,z])=>at(x,z)))-.5,top=y0+3.7;
  walls(g,P,base,top,flat('#ecebe6'),1,inside);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(21.7,.2,10.2),flat('#bdbcb6'));roof.position.set(1147.25,top,-135);g.add(roof);
  const F=face(P[0],P[1],inside);                    // seen from the forecourt: left = east, s = 1158 − x
  const S=(x:number):number=>1158-x;
  // TROCA DE ÓLEO: wide open bay with the shelves of oil inside
  opening(g,F,S(1140.8),y0,7.4,3.05,{fill:darkM(),frame:'#e2e2dd'});
  for(const x of[1138.6,1141.6]){const[px,,pz]=F.at(S(x),0,-6);block(g,flat('#5f6a70'),px,y0,pz,2,2.2,.5);}
  {const[px,,pz]=F.at(S(1143),0,-2.5);block(g,flat('#d9b22c'),px,y0,pz,1.2,.06,2.5);}         // lift ramp plates
  onFace(g,F,signMat(['6   TROCA DE ÓLEO'],{bg:BR.green,fg:'#ffffff',w:768,h:80}),S(1140.4),y0+3.1,7.8,.55,.03,.05);
  // ESCRITÓRIO: door and its green sign
  opening(g,F,S(1146.3),y0,1.1,2.25,{fill:glassM(),frame:'#2d6a43'});
  onFace(g,F,signMat(['ESCRITÓRIO'],{bg:BR.green,fg:'#ffffff',w:384,h:80}),S(1146.6),y0+2.55,2.6,.5,.03,.05);
  // white-tiled pier with the posters
  onFace(g,F,tileWall(),S(1149),y0,2,3.05,.02);
  onFace(g,F,flat('#efe9d7'),S(1149),y0+.9,1.2,.9,.03);
  // MERCEARIA: glass shopfront, its white board and the strip of photo posters above
  opening(g,F,S(1153),y0,5.6,2.6,{fill:glassM(),frame:'#2d6a43',panes:4});
  onFace(g,F,signMat(['MERCEARIA'],{bg:'#f1efe6',fg:BR.green,w:512,h:96}),S(1153),y0+2.7,3.4,.5,.03,.05);
  onFace(g,F,posterMat(),S(1153),y0+3.2,5.6,.45,.03);
  for(const x of[1150.6,1155.6]){const[px,,pz]=F.at(S(x),0,-1.2);block(g,flat('#7d878c'),px,y0,pz,.4,1.9,2.4);}
  // the green-framed door at the east end and the tall white tank at the west corner
  opening(g,F,S(1157),y0,1.2,2.3,{fill:darkM(),frame:'#2d6a43'});
  const t=new THREE.Mesh(new THREE.CylinderGeometry(.78,.78,5.2,16),flat('#e9eae6'));t.position.set(1137.4,at(1137.4,-138.4)+2.6,-138.4);t.castShadow=true;g.add(t);
  const cap=new THREE.Mesh(new THREE.SphereGeometry(.78,16,6,0,Math.PI*2,0,Math.PI/2),flat('#e9eae6'));cap.position.set(1137.4,t.position.y+2.6,-138.4);g.add(cap);
  // the green shade tent at the end of the driveway and the chain-link gate
  const tentY=at(1132,-134);
  for(const[x,z]of[[1128.4,-137],[1135.6,-137],[1128.4,-131],[1135.6,-131]] as P2[])block(g,flat('#d7d8d5'),x,at(x,z)-.1,z,.07,2.7+tentY-at(x,z)+.1,.07);
  const tent=new THREE.Mesh(new THREE.ConeGeometry(5.3,1.1,4,1,true),matte({color:0x2f7a55,side:THREE.DoubleSide}));
  tent.rotation.y=Math.PI/4;tent.scale.set(1,1,.82);tent.position.set(1132,tentY+3.15,-134);g.add(tent);
  const skirt=new THREE.Mesh(new THREE.BoxGeometry(7.4,.35,6.2),matte({color:0x2a704d}));skirt.position.set(1132,tentY+2.55,-134);g.add(skirt);
  const gy=at(1131,-130.2);
  const mesh=matte({color:0x9aa0a2,transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide});
  board(g,mesh,7,2,1131.5,gy+1,-130.2);
  for(const x of[1128,1131.5,1135])block(g,flat('#8d9396'),x,gy,-130.2,.08,2.1,.08);
  block(g,flat('#8d9396'),1131.5,gy+2,-130.2,7,.06,.06);
}
let pmat:THREE.Material|null=null;
function posterMat():THREE.Material{
  if(!pmat)pmat=matte({map:canvasTex(512,48,(c,w,h)=>{
    const cs=['#7a5a3a','#3d6a8a','#c8a050','#5d7a3a','#9a3a2a','#2a4a6a'];
    for(let i=0;i<6;i++){c.fillStyle=cs[i];c.fillRect(i*w/6+2,2,w/6-4,h-4);c.fillStyle='rgba(255,255,255,.4)';c.fillRect(i*w/6+10,10,w/6-40,10);}
  })});
  return pmat;
}

// The Passoni building (x 1121..1133) and the old beige bar beside it (x 1114..1121).
function passoni(g:THREE.Group,at:GroundAt):void{
  const y0=at(1127,-149.6)+.1,base=Math.min(at(1121,-138),at(1133,-138),at(1121,-149.6),at(1133,-149.6))-.6;
  const blueGrey=flat('#a7b1bd'),pink=flat('#cf8f86');
  // main body: pink gable to the street, grey-blue walls
  const BODY:P2[]=[[1121,-146.6],[1133,-146.6],[1133,-138],[1121,-138]],ins:P2=[1127,-142];
  walls(g,BODY,base,y0+3.6,blueGrey,1,ins);
  {
    const s=new THREE.Shape([new THREE.Vector2(-6,0),new THREE.Vector2(6,0),new THREE.Vector2(0,2.6)]);
    for(const z of[-146.6,-138]){const gm=new THREE.Mesh(new THREE.ShapeGeometry(s),pink);gm.position.set(1127,y0+3.6,z);if(z<-140)gm.rotation.y=Math.PI;g.add(gm);}
    const oc=new THREE.Mesh(new THREE.CircleGeometry(.38,16),flat('#2a2522'));oc.position.set(1127,y0+4.75,-146.62);oc.rotation.y=Math.PI;g.add(oc);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.42,.06,6,16),flat('#efe9e2'));ring.position.set(1127,y0+4.75,-146.63);g.add(ring);
  }
  gableRoof(g,1120.4,1133.6,-147.2,-137.4,y0+3.6,2.75,'#9b5a44');
  // the porch: arcade wall on the street, clay shed roof, the green end wall
  const PORCH:P2[]=[[1121,-149.6],[1133,-149.6],[1133,-146.6],[1121,-146.6]];
  const F=face(PORCH[0],PORCH[1],ins);              // seen from the street: left = west
  arcade(g,F,y0,base,blueGrey);
  {
    const sh=new THREE.Mesh(new THREE.PlaneGeometry(13,3.9),matte({color:0x9b5a44,side:THREE.DoubleSide}));
    sh.rotation.x=-Math.PI/2-.32;sh.position.set(1127,y0+3.3,-148.25);sh.castShadow=true;g.add(sh);
  }
  const E=face(PORCH[1],PORCH[2],ins);
  const gw=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(3,0),new THREE.Vector2(3,2.7),new THREE.Vector2(0,3.9)]);
  const green=new THREE.Mesh(new THREE.ShapeGeometry(gw),matte({map:passoniWall(),color:0xffffff}));
  {const[x,,z]=E.at(0,0,.01);green.position.set(x,y0,z);green.rotation.y=E.ry;
    const uv=green.geometry.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3,uv.getY(i)/3.9);g.add(green);}
  {const[x,,z]=E.at(1.5,0,-.15);block(g,blueGrey,x,base,z,3,y0-base+.02,.3,E.ry);}
  // the beige bar next door: gable to the street, an open porch on posts
  const BAR:P2[]=[[1114,-149],[1121,-149],[1121,-136],[1114,-136]];
  walls(g,BAR,base,y0+3.2,flat('#cdb89a'),1,[1117.5,-142.5]);
  const B=face(BAR[0],BAR[1],[1117.5,-142.5]);
  opening(g,B,3.6,y0,5.4,2.6,{fill:darkM(),frame:'#a59478'});
  onFace(g,B,signMat(['BEIRA RIO'],{bg:'#f2efe6',fg:'#2a5a8a',w:256,h:96}),5.6,y0+2.75,1.5,.55,.25,.06);
  gableRoof(g,1113.5,1121.5,-149.6,-135.5,y0+3.2,2.4,'#8f5642');
}
// the arcade on the porch front: a wide square opening then three round-headed arches
function arcade(g:THREE.Group,F:Face,y0:number,base:number,m:THREE.Material):void{
  const W=F.len,H=3.3,s=new THREE.Shape([new THREE.Vector2(0,0),new THREE.Vector2(W,0),new THREE.Vector2(W,H),new THREE.Vector2(0,H)]);
  const holes:[number,number,boolean][]=[[1.6,2.2,false],[4.4,2.1,true],[7.0,2.1,true],[9.6,2.1,true]];
  for(const[c,w,arch]of holes){
    const p=new THREE.Path(),r=w/2,h=2.75;p.moveTo(c-r,.15);p.lineTo(c+r,.15);
    if(arch){p.lineTo(c+r,h-r);p.absarc(c,h-r,r,0,Math.PI,false);}else{p.lineTo(c+r,h);p.lineTo(c-r,h);}
    p.closePath();s.holes.push(p);
  }
  const geo=new THREE.ExtrudeGeometry(s,{depth:.3,bevelEnabled:false,curveSegments:10});
  const mesh=new THREE.Mesh(geo,m),[x,,z]=F.at(0,0,0);mesh.position.set(x,y0,z);mesh.rotation.y=F.ry;mesh.translateZ(-.3);mesh.castShadow=true;g.add(mesh);
  {const[px,,pz]=F.at(W/2,0,-.15);block(g,m,px,base,pz,W,y0-base+.02,.3,F.ry);}
  // the dark porch behind, the "LM depósito de bebidas" board over the first arch
  onFace(g,F,darkM(),W/2,y0,W-.2,3,-2.6);
  onFace(g,F,signMat(['LM','Depósito de Bebidas'],{bg:'#8a2a22',fg:'#f3d36b',w:256,h:160}),4.4,y0+2.95,1.6,.85,.05,.04);
}
function passoniWall():THREE.Texture{
  return canvasTex(300,360,(c,w,h)=>{
    c.fillStyle='#2f8a4e';c.fillRect(0,0,w,h);c.fillStyle='#ffffff';c.textAlign='center';
    c.font='900 40px Arial';c.fillText('AUTO POSTO',w/2,150);c.fillText('PASSONI',w/2,198);
    c.font='900 38px Arial';c.fillText('MERCEARIA',w/2,256);c.font='700 26px Arial';c.fillText('(19) 3663-1396',w/2,300);
  });
}
export default {category:'Divinolândia',label:'Posto Petrobras (Auto Posto Passoni)',build};
