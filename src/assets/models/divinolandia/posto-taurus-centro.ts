import * as THREE from 'three';
import type {GroundAt,P2} from './praca-chao.ts';
import {TAURUS,canopy,taurusFascia,plainFascia,column,island,apron,block,tileWall,flat,walls,face,onFace,opening,
  glassM,darkM,signMat,priceBoard,type Face} from './posto-kit.ts';
import Bomba from './bomba-combustivel.ts';

// Posto Taurus do centro — the second Taurus station, on the south side of the Rua Romeu
// Zanetti at the corner of the Rua Espírito Santo (Street View rz-S-292…316, satellite
// sat-posto-rz / sat21-posto-rz, local). A flat white canopy over the forecourt from the
// sidewalk back to the building, Taurus-blue fascia with the orange line and the italic
// gold word, white columns with blue heads, two pump islands along the street; behind,
// the long white-tiled building under the canopy's back edge: two service bays and a
// roll door at the west end, the glazed convenience shop in the middle, another bay and
// a window at the east end; the price board at the Espírito Santo corner.
// Laid out in the street's frame (u east along the Romeu Zanetti from s = 301.5, n south
// away from its centreline), built in town-local metres like the other posto-*.ts;
// ORIGIN = the middle of the lot on the ground. POSTO_FOOT = collision boxes [x, z, w, d,
// rot, height] (town-local).
const C0:P2=[38.1,-104.3],U:P2=[.986,.164],N:P2=[-.164,.986];
const P=(u:number,n:number):P2=>[C0[0]+U[0]*u+N[0]*n,C0[1]+U[1]*u+N[1]*n];
const ROT=Math.atan2(U[1],U[0]);
export const ORIGIN:P2=P(0,18);
const CANOPY:P2[]=[P(-14,5.6),P(14.5,5.6),P(14.5,16.8),P(-14,16.8)];
const SHOP:P2[]=[P(-15.5,16.8),P(11.7,16.8),P(11.7,32),P(-15.5,32)];
const ISL=[-2,9];
const box=(u:number,n:number,w:number,d:number,h:number):[number,number,number,number,number,number]=>{const[x,z]=P(u,n);return[x,z,w,d,ROT,h];};
export const POSTO_FOOT:[number,number,number,number,number,number][]=[
  box(-1.9,24.4,27.2,15.2,5.4),
  ...ISL.map(u=>box(u,11,4.6,1.3,2.3)),
  ...ISL.map(u=>box(u-2.6,11,.6,.6,4.8)),
];
// s along a face for a point of the street frame
const sOf=(F:Face,p:P2):number=>{const a=F.at(0,0),b=F.at(1,0);return(p[0]-a[0])*(b[0]-a[0])+(p[1]-a[2])*(b[2]-a[2]);};

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);
  let hi=-Infinity;for(const p of CANOPY)hi=Math.max(hi,at(p[0],p[1]));
  const CY=hi+4.8,FH=1.2;

  // ---- forecourt: from the kerb of the Romeu Zanetti to the building, round to the Espírito Santo
  apron(g,at,[P(-15.5,3.8),P(16.4,3.8),P(16.4,16.8),P(-15.5,16.8)]);

  // ---- canopy (its back edge rests on the building's front)
  canopy(g,CANOPY,{y:CY,h:FH,ceiling:'#f0f0ec',roof:'#a3a5a4',lights:3.2,attached:[2],
    edges:[taurusFascia([12],[3,22]),taurusFascia([5.6],[]),plainFascia(TAURUS.blue),plainFascia(TAURUS.blue)]});

  // ---- islands: two along the street, a column at the west end of each
  const white=flat('#f2f2ef'),blue=flat(TAURUS.blue);
  for(const u of ISL){
    const[x,z]=P(u,11);
    const top=island(g,at,x,z,ROT,4.2,1.2,{base:'#d9d9d4',edge:'#3b6fb5'});
    const[cx,cz]=P(u-2.6,11);
    column(g,at,cx,cz,CY-1.3,.55,white);
    block(g,blue,cx,CY-1.25,cz,.57,1.25,.57,-ROT);block(g,flat(TAURUS.orange),cx,CY-1.3,cz,.59,.06,.59,-ROT);
    for(const du of[-1,1]){const[px,pz]=P(u+du*.9,11);const p=Bomba.build({kind:'taurus'});p.position.set(px,top,pz);p.rotation.y=-ROT;g.add(p);}
  }

  // ---- the building: white tiles, bays, the convenience shop
  {
    const ins=P(-1.9,24.4),y0=at(...P(-1.9,16.8))+.1,base=Math.min(...SHOP.map(([x,z])=>at(x,z)))-.5,top=y0+5.4,tw=tileWall();
    walls(g,SHOP,base,top,tw,.6,ins);
    const[rx,rz]=P(-1.9,24.4);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(27.16,.15,15.16),flat('#b9bcbc'));roof.position.set(rx,top-.3,rz);roof.rotation.y=-ROT;g.add(roof);
    const F=face(SHOP[0],SHOP[1],ins),s=(u:number):number=>sOf(F,P(u,16.8));
    onFace(g,F,flat(TAURUS.orange),F.len/2,y0+3.1,F.len,.08,.03);
    opening(g,F,s(-13),y0,3.4,3.4,{fill:darkM(),frame:'#c6c7c3'});                       // service bays
    opening(g,F,s(-8.8),y0,3.4,3.4,{fill:flat('#d9dad6'),frame:'#c6c7c3'});
    onFace(g,F,flat('#cfd1d0'),s(-8.8),y0+1.9,3.3,1.15,.035);                               // the roll door, half up
    opening(g,F,s(-2),y0,6,2.7,{fill:glassM(),frame:'#4a4d50',panes:4});                  // the convenience shop
    onFace(g,F,signMat(['+ Conveniência'],{bg:TAURUS.blue,fg:'#ffffff',w:512,h:80}),s(-2),y0+2.9,3.4,.5,.04,.04);
    opening(g,F,s(4.6),y0,3.4,3.4,{fill:darkM(),frame:'#c6c7c3'});
    opening(g,F,s(9),y0+.9,2.6,1.4,{fill:glassM(),frame:'#4a4d50',panes:2});
    onFace(g,F,signMat(['GGE'],{bg:'#ffffff',fg:'#2b6fb5',w:256,h:96}),s(1.8),y0+2.9,1.4,.55,.05,.04);
    // oil racks by the shop
    for(const u of[2,3]){const[x,z]=P(u,16.2);block(g,flat('#e9e9e4'),x,at(x,z),z,.9,1.1,.5,-ROT);}
  }

  // ---- the price board at the Espírito Santo corner
  {const[x,z]=P(15.6,5);priceBoard(g,at,x,z,-ROT+Math.PI,['GASOLINA 6,09','ETANOL 3,99','S10 6,08','S500 5,99']);}
  return root;
}

export default {category:'Divinolândia',label:'Posto Taurus (centro)',build};
