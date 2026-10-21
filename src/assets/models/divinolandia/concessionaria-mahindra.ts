import * as THREE from 'three';
import {matte} from '../matte.ts';
import type {GroundAt,P2} from './praca-chao.ts';
import {flat,walls,face,onFace,opening,glassM,signMat,canvasTex,block,apron} from './posto-kit.ts';

// Mahindra Tratores / STIHL — the tractor dealer on the corner of the Avenida A and the Rua
// 10, up the slope from the Monumento ao Ciclista (Street View entorno-av, entorno-mah,
// monumento-ciclista-s/-w; footprint from the z20 satellite). A modern two-storey block:
//  - the SHOWROOM on the corner: light-grey render, the long red "mahindra TRATORES" board
//    and the orange STIHL board across the upper floor of the Rua 10 side (what you see
//    from the highway) with the glazed balcony at its far corner, white roll-up doors under
//    them, a glazed upper storey with a glass balcony on the avenue, the red totem VENDAS ·
//    SERVIÇOS · PEÇAS at the corner, the outside stair and the small white annex up the hill;
//  - behind it down the Rua 10 the beige WORKSHOP block with two rows of strip windows and
//    the service roll-up door, a light flat roof.
// build({groundAt}) is pure; TOWN-LOCAL coordinates shifted by ORIGIN, as the fuel stations.
export const ORIGIN:P2=[1530,-152];
// (the avenue front follows the Rua 1 as it climbs east; the side follows the Rua 10's bend)
const SHOW:P2[]=[[1515.5,-172.9],[1538,-168.3],[1538,-150],[1517.5,-150]];
const SHOP:P2[]=[[1517.5,-150],[1548,-150],[1548,-128],[1524,-128],[1521,-138]];
const ANNEX:P2[]=[[1539.5,-168],[1550,-165.8],[1550,-158],[1539.5,-158]];
export const MAHINDRA_FOOT:[number,number,number,number,number,number][]=[
  [1528,-159.25,20,17.5,0,9.5],[1534.25,-144.5,27.5,11,0,7.5],[1536,-133.5,24,11,0,7.5],[1544.75,-161.9,10.5,7.8,0,4],[1514,-168.5,1,.4,0,4.6],
];

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);
  const lo=(p:P2[]):number=>Math.min(...p.map(([x,z])=>at(x,z)))-.6;

  // ---- forecourt pavement on the corner and along the Rua 10
  apron(g,at,[[1513.4,-173.4],[1515.5,-172.9],[1517.5,-150],[1521,-138],[1523.4,-130],[1521.5,-129.5],[1516.9,-150]]);

  // ---- showroom: ground floor at the corner, upper storey, parapet
  const y0=at(1516,-170)+.15,F1=y0+4.3,TOP=F1+4.2,grey=flat('#e2e2de'),beige=flat('#d9cfbf');
  walls(g,SHOW,lo(SHOW),F1,grey,1,[1527,-160]);
  walls(g,SHOW,F1,TOP,grey,1,[1527,-160]);
  roof(g,SHOW,TOP);
  const N=face(SHOW[0],SHOW[1],[1527,-160]);         // the avenue front (seen from it: left = east)
  const W=face(SHOW[3],SHOW[0],[1527,-160]);         // the Rua 10 side (left = north)
  // the red board and the STIHL board across the upper floor of the Rua 10 side (seen from
  // the west, as from the highway: the red board, then STIHL, then the glazed corner balcony)
  onFace(g,W,signMat(['mahindra TRATORES'],{bg:'#d0242b',fg:'#ffffff',w:1024,h:160,font:'Arial',weight:800}),7,F1+1.5,12,2,.05,.08);
  onFace(g,W,signMat(['STIHL'],{bg:'#f26b1d',fg:'#ffffff',w:256,h:96}),14.6,F1+2.1,3,1,.05,.08);
  onFace(g,W,glassM(),18.5,F1+.2,3.6,2.6,.02);
  onFace(g,W,matte({color:0x9fb8c0,transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide}),18.5,F1,3.6,1.05,1.2);
  {const b=new THREE.Mesh(new THREE.BoxGeometry(3.8,.22,1.3),flat('#efefeb'));const[x,,z]=W.at(18.5,0,.6);b.position.set(x,F1-.11,z);b.rotation.y=W.ry;g.add(b);}
  // glazed upper storey: the glass band behind the balcony, the balcony slab and its glass rail
  onFace(g,N,glassM(),11,F1+.2,18,1.4,.02);
  const bal=new THREE.Mesh(new THREE.BoxGeometry(18,.22,1.6),flat('#efefeb'));{const[x,,z]=N.at(11,0,.8);bal.position.set(x,F1-.11,z);g.add(bal);}
  onFace(g,N,matte({color:0x9fb8c0,transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide}),11,F1,18,1.05,1.58);
  onFace(g,N,flat('#c9ccce'),11,F1+1.02,18,.05,1.58,.05);
  // ground floor of the avenue: a glass shopfront and a roll-up door
  opening(g,N,6.5,y0,6,3.2,{fill:glassM(),frame:'#4a4d50',panes:4});
  opening(g,N,15.5,y0,4.2,3.6,{fill:rollUp(),frame:'#cfd0cc'});
  // Rua 10 side: two big roll-up doors, the upper glazing and its red flag
  opening(g,W,5.5,y0,4.2,3.8,{fill:rollUp(),frame:'#cfd0cc'});
  opening(g,W,10.5,y0,4.2,3.8,{fill:rollUp(),frame:'#cfd0cc'});
  for(const s of[1.8,14.4,17.8])opening(g,W,s,y0+1.4,2.2,.9,{fill:glassM(),frame:'#3a3d40'});
  // the red totem at the corner
  {
    const tm=matte({map:canvasTex(128,512,(c,w,h)=>{c.fillStyle='#d0242b';c.fillRect(0,0,w,h);
      c.fillStyle='#ffffff';c.beginPath();c.ellipse(w/2,70,34,22,0,0,Math.PI*2);c.fill();c.fillStyle='#d0242b';c.font='900 24px Arial';c.textAlign='center';c.fillText('M',w/2,79);
      c.fillStyle='#fff';c.font='700 16px Arial';c.fillText('mahindra',w/2,130);c.font='700 15px Arial';['VENDAS','SERVIÇOS','PEÇAS'].forEach((t,i)=>c.fillText(t,w/2,260+i*34));})});
    const red=flat('#d0242b'),t=new THREE.Mesh(new THREE.BoxGeometry(1,4.4,.4),[red,red,red,red,tm,tm]);
    t.position.set(1514,at(1514,-168.5)+2.2,-168.5);t.rotation.y=-Math.PI/2+.1;t.castShadow=true;g.add(t);
  }
  // ---- the white annex up the avenue and the outside stair to the upper floor
  {
    const ay=at(1545,-171)+.1;
    walls(g,ANNEX,lo(ANNEX),ay+3.4,flat('#f0f0ec'),1,[1544.75,-165.5]);roof(g,ANNEX,ay+3.4);
    const A=face(ANNEX[0],ANNEX[1],[1544.75,-165.5]);
    for(const s of[2.5,7.5])opening(g,A,s,ay+.9,2,1.2,{fill:glassM(),frame:'#cfd0cc'});
    const sy=at(1538.8,-168.6),steps=Math.max(6,Math.round((F1-sy)/.18));
    for(let i=0;i<steps;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(1.1,.18,.3),flat('#d8d8d3'));
      b.position.set(1538.8,sy+(i+1)*(F1-sy)/steps-.09,-168.3+i*(9/steps));g.add(b);}
    for(const x of[1538.25,1539.35]){const r=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,Math.hypot(9,F1-sy)),flat('#cfd2d4'));
      r.position.set(x,(sy+F1)/2+1,-163.8);r.rotation.x=-Math.atan2(F1-sy,9);g.add(r);}
  }

  // ---- the workshop block down the Rua 10
  {
    const wy=at(1519,-140)+.1,WT=wy+7,ins:P2=[1533,-139];
    walls(g,SHOP,lo(SHOP),WT,beige,1,ins);roof(g,SHOP,WT);
    const S1=face(SHOP[4],SHOP[0],ins),S2=face(SHOP[3],SHOP[4],ins);
    for(const s of[2.5,7])for(const y of[1.6,4.6])opening(g,S1,s,wy+y,3,.8,{fill:glassM(),frame:'#4a4d50'});
    opening(g,S2,4.5,wy,4,4,{fill:rollUp(),frame:'#cfd0cc'});
    onFace(g,S2,flat('#cdc3b2'),2,wy,8,.4,.03);
    block(g,flat('#d9cfbf'),1520,wy-.2,-151.5,2.5,.2,3);              // the ramp to the side door
  }
  return root;
}
// a flat roof over any footprint, a parapet cap round it
function roof(g:THREE.Group,pts:P2[],y:number):void{
  const sh=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,-z)));
  const m=new THREE.Mesh(new THREE.ShapeGeometry(sh),flat('#bdbcb7'));m.geometry.rotateX(-Math.PI/2);m.position.y=y-.5;g.add(m);
  walls(g,pts,y,y+.12,flat('#d9d9d4'),1);
}
let rm:THREE.Material|null=null;
function rollUp():THREE.Material{
  if(!rm)rm=matte({map:canvasTex(64,128,(c,w,h)=>{c.fillStyle='#ecedea';c.fillRect(0,0,w,h);c.fillStyle='#c9cbc8';for(let y=0;y<h;y+=6)c.fillRect(0,y,w,1.5);})});
  return rm;
}

export default {category:'Divinolândia',label:'Concessionária Mahindra',build};
