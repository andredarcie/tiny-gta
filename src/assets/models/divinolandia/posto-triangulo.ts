import * as THREE from 'three';
import {matte} from '../matte.ts';
import type {GroundAt,P2} from './praca-chao.ts';
import {BR,canopy,brFascia,plainFascia,column,island,apron,floorLine,block,tiledBlock,tileWall,brick,flat,walls,face,onFace,opening,
  glassM,darkM,hipRoofQuad,latticeRail,signMat,canvasTex,brLogo,board,type Face} from './posto-kit.ts';
import Bomba from './bomba-combustivel.ts';

// Auto Posto Triângulo (Petrobras) — Rua Lourival de Medeiros 81, on the TRIANGULAR block
// where the Rua Romeu Zanetti meets the Lourival de Medeiros, east of the Praça do Rosário.
// Rebuilt from Google Street View (panoramas 7hPO_Aj5TnbKlarneM-Ing at the tip of the
// block, posto-triangulo-n / -s on the two streets, captured with tools/capture-streetview.ts)
// and the z21 satellite (tools/capture-satellite.ts), kept locally in
// docs/divinolandia/referencias-*:
//  - the white CANOPY fills the triangle (the satellite's white roof): a wedge 23 m long
//    whose fascia runs green → yellow → the white BR panel along the Romeu Zanetti and
//    white BR panel → stripes → yellow → green along the Lourival, white ceiling with the
//    recessed lights;
//  - two pump islands under it, parallel to the Lourival ("1 2" toward the building, "3 4"
//    toward the tip), each a white column with the price strip and the green LUBRAX boxes,
//    the hanging sign box with the pump numbers, two Petrobras pumps, the DIESEL post;
//  - against the canopy's west side the two-storey building: under the canopy the shop
//    (open front, drinks and boxes), a white-tiled pier and the glazed ESCRITÓRIO with its
//    green band; at the north end the open bay with the "Ar" calibrator and the compressor;
//    at the south end the ice depot with the two "Gelo São José" chests; upstairs exposed
//    brick with green-shuttered windows and lattice balconies at both ends, clay hipped roof;
//  - the railed lube pit by the building on the Romeu Zanetti side.
// build({groundAt}) is pure. Coordinates are TOWN-LOCAL metres (x east, z south) shifted by
// ORIGIN; groundAt(x,z) takes town-local metres and returns the ground relative to the
// ground at ORIGIN. POSTO_FOOT = collision boxes [x, z, w, d, rot, height] (town-local).
export const ORIGIN:P2=[514,-15];
const CANOPY:P2[]=[[504,-25.2],[526.4,-21],[527,-17.8],[504,-4.4]];
// the building: its north and south faces run along the two streets
const BLD:P2[]=[[495,-27.2],[504,-25.5],[504,-4.9],[495,-.75]];
const ISLANDS:{x:number;z:number;n:string}[]=[{x:513,z:-14.4,n:'1  2'},{x:521.6,z:-17.6,n:'3  4'}];
const ROT=Math.atan2(-11,23);                       // along the Lourival de Medeiros (the canopy's SE edge)
export const POSTO_FOOT:[number,number,number,number,number,number][]=[
  [499.5,-14.9,9,17.6,0,9],[498.79,-4.37,9.9,3.4,-.43,9],[499.26,-25.07,9.15,2.6,.19,9],   // the building (its ends follow the streets)
  ...ISLANDS.map(i=>[i.x,i.z,5,1.3,ROT,2.3] as [number,number,number,number,number,number]),
  [507.8,-23.1,5.6,.2,.19,1.2],
];

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);
  // the canopy is level: it meets the building at its first-floor slab (the brick storey
  // rises over it, as in the panoramas) and clears the highest ground under it by 3.6 m
  let hi=-Infinity;for(const[x,z]of[...CANOPY,[512,-15],[518,-17]] as P2[])hi=Math.max(hi,at(x,z));
  const FH=.9,CY=Math.max(hi+3.6,at(504,-15)+3.7);

  // ---- forecourt: poured concrete from the building to both kerbs
  apron(g,at,[[504.05,-25.55],[536.5,-19.3],[504.05,-4.45]]);
  for(const i of ISLANDS){                           // painted lane edges either side of the islands
    for(const s of[-1,1]){const c=Math.cos(ROT),sn=Math.sin(ROT),nx=-sn*s*2.9,nz=c*s*2.9;
      floorLine(g,at,[i.x-c*3+nx,i.z-sn*3+nz],[i.x+c*3+nx,i.z+sn*3+nz],BR.yellow,.1);}
  }

  // ---- the canopy
  canopy(g,CANOPY,{y:CY,h:FH,ceiling:'#eeeeea',roof:'#b5b6b1',lights:3.2,edges:[
    brFascia([['logo',4],['w2y',1.5],['yellow',5],['y2g',2],['green',13]]),              // Romeu Zanetti side (seen from it: left = the tip)
    brFascia([['yellow',1],['y2g',1],['green',1.6]]),                                   // the cut tip
    brFascia([['logo',8.5],['w2y',2.2],['yellow',8],['y2g',2],['green',5]]),            // Lourival side (left = the building)
    plainFascia('#ecebe6'),
  ],attached:[3]});                                                                    // the west edge is the building's wall

  // ---- islands: white column, two pumps, the sign box with the numbers
  const colM=flat('#f1f1ed');
  for(const[k,i]of ISLANDS.entries()){
    const top=island(g,at,i.x,i.z,ROT,5,1.3,{base:'#55585b',edge:BR.yellow});
    column(g,at,i.x,i.z,CY,.55,colM);
    const f=face([i.x-Math.cos(ROT),i.z-Math.sin(ROT)],[i.x+Math.cos(ROT),i.z+Math.sin(ROT)],[i.x-Math.sin(ROT),i.z+Math.cos(ROT)]);
    const back=face([i.x+Math.cos(ROT),i.z+Math.sin(ROT)],[i.x-Math.cos(ROT),i.z-Math.sin(ROT)],[i.x+Math.sin(ROT),i.z-Math.cos(ROT)]);
    for(const ff of[f,back]){
      onFace(g,ff,priceStrip(),0,top+.4,.2,2.2,.285);                                   // vertical price strip
      onFace(g,ff,signMat(['LUBRAX'],{bg:BR.green,fg:'#ffffff',w:256,h:96}),0,CY-1.6,.95,.55,.29,.04);
    }
    // the hanging box over the column: BR panel + stripes + green box with the pump numbers
    const sb=new THREE.Group();sb.position.set(i.x,CY-.62,i.z);sb.rotation.y=-ROT;g.add(sb);
    const sm=matte({map:canvasTex(512,96,(x,w,h)=>{
      x.fillStyle=BR.white;x.fillRect(0,0,w,h);brLogo(x,40,h/2,h*.6);
      x.fillStyle=BR.green;x.font='800 26px Arial';x.textAlign='left';x.textBaseline='middle';x.fillText('PETROBRAS',72,h/2);
      for(let s=0;s<9;s++){x.fillStyle=BR.yellow;x.fillRect(220+s*14,0,6+s,h);}x.fillStyle=BR.yellow;x.fillRect(346,0,40,h);
      x.fillStyle=BR.green;x.fillRect(386,0,126,h);x.fillStyle='#fff';x.font='800 40px Arial';x.textAlign='center';x.fillText(i.n,449,h/2+2);
    })});
    sb.add(new THREE.Mesh(new THREE.BoxGeometry(2.9,.55,.3),[colM,colM,colM,colM,sm,sm]));
    // pumps at the two ends of the island (faces toward the lanes)
    for(const s of[-1,1]){const p=Bomba.build({kind:'petrobras'});p.position.set(i.x+Math.cos(ROT)*s*1.6,top,i.z+Math.sin(ROT)*s*1.6);p.rotation.y=-ROT;g.add(p);}
    // extinguisher + the blue oil bin by the column
    block(g,flat('#c4262b'),i.x+Math.cos(ROT)*.6+Math.sin(ROT)*.5,top,i.z+Math.sin(ROT)*.6-Math.cos(ROT)*.5,.16,.55,.16);
    block(g,flat('#1f4fa3'),i.x-Math.cos(ROT)*.7+Math.sin(ROT)*.4,top,i.z-Math.sin(ROT)*.7-Math.cos(ROT)*.4,.6,.35,.4,-ROT);
    if(k===1){                                           // the DIESEL post at the tip end of the "3 4" island
      const x=i.x+Math.cos(ROT)*2.3,z=i.z+Math.sin(ROT)*2.3;
      const post=new THREE.Mesh(new THREE.BoxGeometry(.75,1.9,.35),[colM,colM,colM,colM,dieselMat(),dieselMat()]);
      post.position.set(x,top+.95,z);post.rotation.y=-ROT;g.add(post);
    }
  }

  // ---- the building
  building(g,at,CY+FH+.05);

  // ---- the lube pit by the building, railed on three sides
  {
    const y=at(507.8,-23);
    const pit=new THREE.Mesh(new THREE.PlaneGeometry(5.2,2.2),flat('#3d3c3a'));pit.rotation.set(-Math.PI/2,0,-.19);pit.position.set(507.9,y+.14,-22.9);g.add(pit);
    const rail=flat('#c9ccce');
    const posts:P2[]=[[505.2,-22],[505.4,-24],[510.6,-23],[510.4,-21]];
    for(let k=0;k<3;k++){
      const a=posts[k],b=posts[k+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),ry=-Math.atan2(b[1]-a[1],b[0]-a[0]);
      for(const h of[.5,1.05]){const r=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,L,6),rail);r.rotation.set(0,ry,Math.PI/2,'YXZ');
        r.position.set((a[0]+b[0])/2,y+h,(a[1]+b[1])/2);g.add(r);}
      // the round-bar hoops of the real rail
      for(let t=.25;t<1;t+=.5){const c=new THREE.Mesh(new THREE.TorusGeometry(.22,.015,4,12),rail);c.position.set(a[0]+(b[0]-a[0])*t,y+.55,a[1]+(b[1]-a[1])*t);c.rotation.y=ry;g.add(c);}
    }
    for(const p of posts){const c=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.1,6),rail);c.position.set(p[0],y+.55,p[1]);g.add(c);}
  }
  return root;
}

function priceStrip():THREE.Material{
  return matte({map:canvasTex(48,512,(x,w,h)=>{
    x.fillStyle='#f6f6f2';x.fillRect(0,0,w,h);
    const c=[BR.yellow,'#c9342c','#c9342c',BR.green,'#c9342c','#c9342c','#c9342c',BR.yellow];
    c.forEach((cc,i)=>{x.fillStyle=cc;x.fillRect(6,12+i*60,w-12,48);});
  })});
}
let dm:THREE.Material|null=null;
function dieselMat():THREE.Material{
  if(!dm)dm=matte({map:canvasTex(128,320,(x,w,h)=>{
    x.fillStyle='#ffffff';x.fillRect(0,0,w,h);x.fillStyle=BR.green;x.fillRect(0,h*.62,w,h*.38);
    x.fillStyle='#e8762b';x.font='900 30px Arial';x.textAlign='left';x.fillText('D',10,56);x.fillText('D',10,108);
    x.font='700 14px Arial';x.fillText('DIESEL',38,50);x.fillText('DIESEL S10',38,102);
  })});
  return dm;
}

// The station's two-storey building (town-local footprint BLD); F1 = the first floor, just over
// the canopy's top.
function building(g:THREE.Group,at:GroundAt,F1:number):void{
  const inside:P2=[499.5,-14];
  const y0=at(504,-15)-.05;                         // the shop floor, level with the forecourt at the canopy
  const base=Math.min(...BLD.map(([x,z])=>at(x,z)))-.6;
  const TOP=F1+3,plaster=flat('#ecebe5'),slab=flat('#d9d8d2');
  walls(g,BLD,base,y0+.2,flat('#bdb8ae'),1,inside);                                 // plinth on the slope
  walls(g,BLD,y0+.2,F1-.25,plaster,1,inside);
  // the slab between the floors, sticking out as the balconies' floor at both ends
  {const sh=new THREE.Shape(BLD.map(([x,z])=>new THREE.Vector2(x,-z)));
    const ex=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.25,bevelEnabled:false}),slab);ex.rotation.x=-Math.PI/2;ex.position.y=F1-.25;ex.castShadow=true;g.add(ex);}
  for(const[a,b,dz]of[[[495,-27.2],[504,-25.5],-1.1],[[495,-.75],[504,-4.9],1.1]] as [P2,P2,number][]){
    const pts:P2[]=[a,b,[b[0],b[1]+dz],[a[0],a[1]+dz]];
    const sh=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
    const ex=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.2,bevelEnabled:false}),slab);ex.rotation.x=-Math.PI/2;ex.position.y=F1-.22;ex.castShadow=true;g.add(ex);
  }
  // the upper floor in exposed brick, set back from the ends where the balconies are
  const UP:P2[]=[[495,-26.6],[504,-24.9],[504,-5.6],[495,-1.5]];
  walls(g,UP,F1,TOP,brick(),1,inside);
  hipRoofQuad(g,UP,TOP,2.4,'#9a5a43',.6);                                          // follows the wedge

  // ---- east face, under the canopy (seen from the forecourt: left = south)
  const E=face([504,-25.5],[504,-4.9],inside);      // len 20.6; s = 0 at the south end
  const tiles=tileWall();
  // north bay: open garage with the compressor and the tiled piers
  opening(g,E,17.5,y0+.05,5.4,3.3,{fill:darkM(),frame:'#e4e4df'});
  for(const s of[14.6,20.4]){const[x,,z]=E.at(s,0,.18);tiledBlock(g,tiles,x,y0,z,.42,3.55,.42,.6);}
  {const[x,,z]=E.at(18,0,-1.6);block(g,flat('#3c6fa8'),x,y0,z,.7,.8,1.4);block(g,flat('#9ea2a4'),x,y0+.8,z,.5,.5,.5);}   // compressor
  // the glazed ESCRITÓRIO with its green band
  opening(g,E,12,y0+.05,4.4,2.7,{fill:glassM(),frame:'#2e3133',panes:3});
  onFace(g,E,signMat(['ESCRITÓRIO'],{bg:BR.green,fg:'#ffffff',w:512,h:80}),12,y0+2.9,4.8,.55,.03,.06);
  // white-tiled pier between them
  onFace(g,E,tiles,9,y0+.05,1.6,3.3,.02);
  // the shop: wide open front with the shelves, boxes and the Coca-Cola cooler inside
  opening(g,E,5,y0+.05,6,3.1,{fill:darkM(),frame:'#d9d9d4'});
  {const[x,,z]=E.at(7.2,0,-.7);block(g,flat('#c8302c'),x,y0,z,.8,1.9,.7);}
  for(const s of[2.6,4,6]){const[x,,z]=E.at(s,0,-.8);block(g,flat('#a07a52'),x,y0,z,1.1,.5+((s*7)%3)*.3,.6);}
  {const[x,,z]=E.at(3.6,0,-1.5);block(g,flat('#7e8a8f'),x,y0,z,2.2,1.9,.4);}               // shelf
  // the "Gelo São José" chest at the corner
  {const[x,,z]=E.at(.7,0,.6);iceChest(g,x,at(x,z),z,E.ry);}
  dirtBand(g,E,y0);

  // ---- south face (along the Lourival): the ice depot with the second chest + balcony upstairs
  const S=face([504,-4.9],[495,-.75],inside);
  opening(g,S,5.4,y0+.05,3.4,2.8,{fill:darkM(),frame:'#b9bcbf'});
  onFace(g,S,signMat(['GELO SÃO JOSÉ','depósito'],{bg:'#f4f4f1',fg:'#1f4fa3',w:512,h:160}),5.4,y0+2.95,2.6,.7,.03,.05);
  // (the second ice chest of the photos stands on this side's pavement; in the town data the
  // wall is right at the Lourival's roadway, so it is left out rather than put in the street)
  latticeRail(g,S,.3,S.len-.3,F1,1,1.0,'#7f8589');
  windows(g,S,F1,[3,6.4]);

  // ---- north face (along the Romeu Zanetti): open bay through to the forecourt, the Ar pillar
  const N=face([495,-27.2],[504,-25.5],inside);    // s = 0 at the east end (seen from the street)
  opening(g,N,3.2,y0+.05,5.6,3.3,{fill:darkM(),frame:'#e4e4df'});
  {const[x,,z]=N.at(.1,0,.2);tiledBlock(g,tiles,x,y0,z,.42,3.55,.42,.6);}
  // grey gate + fence with the yellow banners to the west
  onFace(g,N,flat('#9a9ea1'),7.3,y0+.05,2.6,2.4,.03);
  {const[x,,z]=E.at(20.1,0,.35);arPillar(g,x,at(x,z),z,E.ry);}                       // at the corner, under the canopy
  latticeRail(g,N,.3,N.len-.3,F1,1,1.0,'#7f8589');
  windows(g,N,F1,[2.8,6.2]);

  // ---- west face: blank against the neighbour
  // ---- east face upstairs (over the canopy): three windows with green shutters
  windows(g,E,F1,[4,10.3,16.6]);
}
// an upstairs window: dark glass, white frame, the dark green louvred shutters closed half
function windows(g:THREE.Group,f:Face,F1:number,at:number[]):void{
  for(const s of at){
    opening(g,f,s,F1+.9,1.2,1.3,{fill:glassM(),frame:'#f0efe9',panes:2});
    onFace(g,f,flat('#2f5a3e'),s-.95,F1+.9,.6,1.3,.04);onFace(g,f,flat('#2f5a3e'),s+.95,F1+.9,.6,1.3,.04);
    onFace(g,f,flat('#d8d6cf'),s,F1+.82,1.5,.08,0,.1);
  }
}
function dirtBand(g:THREE.Group,f:Face,y0:number):void{
  onFace(g,f,matte({color:0x8a8070,transparent:true,opacity:.18,depthWrite:false}),f.len/2,y0,f.len,.35,.01);
}
// the white "Gelo São José" ice chest (freezer) at the shop corners
function iceChest(g:THREE.Group,x:number,y:number,z:number,ry:number):void{
  const t=matte({map:canvasTex(128,160,(c,w,h)=>{
    c.fillStyle='#f6f6f4';c.fillRect(0,0,w,h);c.fillStyle='#1f4fa3';c.font='900 30px Arial';c.textAlign='center';
    c.fillText('GELO',w/2,60);c.font='700 18px Arial';c.fillText('SÃO JOSÉ',w/2,140);
    c.fillStyle='#1d1d1d';c.beginPath();c.ellipse(w/2,95,10,16,0,0,Math.PI*2);c.fill();
  })});
  const w=flat('#f2f2ef'),b=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.85,.75),[w,w,w,w,t,w]);
  b.position.set(x,y+.93,z);b.rotation.y=ry;b.castShadow=true;g.add(b);
}
// the grey tyre-air calibrator on its pillar ("Ar")
function arPillar(g:THREE.Group,x:number,y:number,z:number,ry:number):void{
  const p=new THREE.Group();p.position.set(x,y,z);p.rotation.y=ry;g.add(p);
  const body=new THREE.Mesh(new THREE.BoxGeometry(.42,1.9,.32),flat('#a9b0b3'));body.position.y=.95;p.add(body);
  board(p,signMat(['Ar'],{bg:BR.green,fg:'#ffffff',w:128,h:64}),.38,.18,0,1.75,.17);
  board(p,flat('#2e3133'),.22,.18,0,1.3,.17);
  const hose=new THREE.Mesh(new THREE.TorusGeometry(.18,.015,4,14),flat('#151515'));hose.position.set(0,.9,.18);p.add(hose);
}

export default {category:'Divinolândia',label:'Posto Triângulo (Petrobras)',build};
