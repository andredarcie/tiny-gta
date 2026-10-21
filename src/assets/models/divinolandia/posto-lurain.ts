import * as THREE from 'three';
import {matte} from '../matte.ts';
import type {GroundAt,P2} from './praca-chao.ts';
import {LURAIN,canopy,lurainFascia,plainFascia,truss,column,island,apron,gravelM,flat,walls,face,onFace,opening,glassM,darkM,
  signMat,priceBoard,corrugated} from './posto-kit.ts';
import Bomba from './bomba-combustivel.ts';

// Posto Lurain — Rua Lourival de Medeiros 867, the independent station at the east exit,
// where the street meets the SP-344 (trucks fill up here). Rebuilt from Google Street View
// (panorama 8ww29Zskt52Z6LbxxlkL1Q in front, posto-lurain-w along the street, the -zoom
// close-ups) and the z20 satellite, kept locally in docs/divinolandia/referencias-*:
//  - a STEEL canopy (12.5 × 13 m): matt black fascia with the thin red-orange line and
//    "POSTO LURAIN" with the drop mark on the street front; no ceiling — lattice girders
//    span east–west from the restaurant's wall to two black columns, the corrugated roof
//    seen between the purlins;
//  - two small pale islands with one petrol pump each (west) and two black islands at the
//    columns with the tall diesel dispensers (east), LED price boards on posts;
//  - the canopy leans on the RESTAURANTE DIVINO SABOR: a salmon-pink block with a tall
//    parapet, five dark windows and the door under a long metal awning, the white band with
//    RESTAURANTE and the Divino Sabor logo, floodlights and dishes on top, a small room
//    upstairs at the canopy end, the Sub Zero ice freezer by the door;
//  - concrete forecourt to the kerb, and behind the canopy the gravel yard where the
//    lorries park on the way to the highway.
// build({groundAt}) is pure; TOWN-LOCAL coordinates shifted by ORIGIN, as posto-triangulo.ts.
export const ORIGIN:P2=[1280,-222];
const CANOPY:P2[]=[[1285,-228.5],[1297.5,-228.5],[1297.5,-215.5],[1285,-215.5]];
const COLS:P2[]=[[1293,-219.5],[1293,-226.5]];
export const POSTO_FOOT:[number,number,number,number,number,number][]=[
  [1274.25,-220.75,21.5,16.5,0,6.4],[1281.5,-222.5,7,13,0,8.3],
  ...COLS.map(([x,z])=>[x,z,1.2,4.4,0,2.5] as [number,number,number,number,number,number]),
  [1288.6,-220.5,1,1.6,0,2.3],[1288.9,-225.8,1,1.6,0,2.3],
];

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);
  let hi=-Infinity;for(const p of[...CANOPY,...COLS])hi=Math.max(hi,at(p[0],p[1]));
  const CY=hi+4.8,FH=1.35;

  // ---- ground: concrete forecourt to the kerb, gravel yard behind, the pale strip of the petrol islands
  apron(g,at,[[1263.5,-202.7],[1300,-213],[1300,-228.5],[1285,-228.5],[1285,-212.5],[1263.5,-212.5]]);
  apron(g,at,[[1285,-228.5],[1300,-228.5],[1300,-246],[1285,-246]],[],gravelM);
  apron(g,at,[[1287.3,-228],[1290.3,-228],[1290.3,-217.5],[1287.3,-217.5]],[],flat('#cfcfc8'));

  // ---- the steel canopy
  canopy(g,CANOPY,{y:CY,h:FH,roof:'#5b5d60',edges:[
    plainFascia(LURAIN.black),                         // north (yard side)
    lurainFascia([]),                                  // east
    lurainFascia([6.25]),                              // the street front
    plainFascia(LURAIN.black),
  ],attached:[3]});                                    // the west edge leans on the restaurant
  const steel=flat(LURAIN.steel);
  for(const z of[-219.5,-226.5,-216.2,-227.8])truss(g,[1285,z],[1297.5,z],CY+.15,.95,steel);
  for(let x=1286;x<1297.5;x+=1.5){const p=new THREE.Mesh(new THREE.BoxGeometry(.08,.12,13),steel);p.position.set(x,CY+1.15,-222);g.add(p);}

  // ---- columns, islands, pumps
  for(const[x,z]of COLS){
    const top=island(g,at,x,z,Math.PI/2,4.4,1.2,{base:'#262729'});
    column(g,at,x,z-.4,CY+.15,.35,steel);
    const p=Bomba.build({kind:'diesel'});p.position.set(x,top,z+1.4);p.rotation.y=Math.PI/2;g.add(p);
  }
  for(const[x,z]of[[1288.6,-220.5],[1288.9,-225.8]] as P2[]){
    const top=island(g,at,x,z,Math.PI/2,1.6,1,{base:'#bfbfb8'});
    const p=Bomba.build({kind:'lurain'});p.position.set(x,top,z);p.rotation.y=Math.PI/2;g.add(p);
  }
  priceBoard(g,at,1290.4,-218.3,0,['GASOLINA 5,99','ETANOL 3,89']);
  priceBoard(g,at,1294.7,-217.2,0,['DIESEL-S10 5,98','DIESEL-S500 6,08']);

  restaurant(g,at);
  return root;
}

// Restaurante Divino Sabor: x 1263.5..1285, front on z = -212.5, the canopy against its east wall.
function restaurant(g:THREE.Group,at:GroundAt):void{
  const P:P2[]=[[1263.5,-212.5],[1285,-212.5],[1285,-229],[1263.5,-229]],ins:P2=[1274,-221];
  const y0=at(1274,-212.5)+.12,base=Math.min(...P.map(([x,z])=>at(x,z)))-.6,top=y0+6.2;
  const pink=flat('#c06a64'),pinkLow=flat('#a95b56');
  walls(g,P,base,y0+.9,pinkLow,1,ins);
  walls(g,P,y0+.9,top,pink,1,ins);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(21.3,.15,16.3),flat('#a4a39f'));roof.position.set(1274.25,top-.9,-220.75);g.add(roof);
  // the room upstairs at the canopy end
  const UP:P2[]=[[1278.5,-214],[1285,-214],[1285,-229],[1278.5,-229]];
  walls(g,UP,top-.9,top+2,pink,1,[1281.7,-221]);
  const r2=new THREE.Mesh(new THREE.BoxGeometry(6.7,.15,15.2),flat('#b9b7b1'));r2.position.set(1281.75,top+2,-221.5);g.add(r2);
  const F=face(P[0],P[1],ins);                        // the street front, left = west, s = x − 1263.5
  const S=(x:number):number=>x-1263.5;
  for(let k=0;k<5;k++)opening(g,F,S(1268.6+k*2.35),y0+.9,2.05,1.85,{fill:glassM(),frame:'#2b2b2d',panes:2});
  opening(g,F,S(1281.4),y0,1.6,2.65,{fill:darkM(),frame:'#2b2b2d'});
  // the Divino Sabor banner by the door and the Sub Zero ice freezer
  onFace(g,F,signMat(['Divino Sabor','REFEIÇÕES POR QUILO','SELF SERVICE','MARMITEX · PRATO FEITO'],{bg:'#f2efe6',fg:'#6b4a2e',w:256,h:384}),S(1283.4),y0+.1,1.1,1.95,.05,.03);
  {const[x,,z]=F.at(S(1284.6),0,.5);const fr=new THREE.Mesh(new THREE.BoxGeometry(.8,1.75,.7),[flat('#f1f1ef'),flat('#f1f1ef'),flat('#f1f1ef'),flat('#f1f1ef'),
    signMat(['SUB','ZERO','GELO'],{bg:'#2f7fc4',fg:'#ffffff',w:128,h:256}),flat('#f1f1ef')]);fr.position.set(x,at(x,z)+.88,z);g.add(fr);}
  // the long metal awning over the windows and the door
  {
    const aw=new THREE.Mesh(new THREE.PlaneGeometry(20.5,1.75),corrugated('#b3aca1'));
    const[x,,z]=F.at(10.75,0,.8);aw.position.set(x,y0+3.15,z);aw.rotation.set(-Math.PI/2+.3,0,0);aw.castShadow=true;g.add(aw);
    onFace(g,F,flat('#a39d92'),10.75,y0+2.86,20.5,.1,1.62,.05);
  }
  // the white band with RESTAURANTE and the Divino Sabor logo
  onFace(g,F,flat('#f1efe8'),S(1276),y0+4.55,19,.55,.03);
  onFace(g,F,signMat(['RESTAURANTE'],{bg:'#f1efe8',fg:'#7a3b30',w:512,h:96}),S(1268.2),y0+4.55,3.6,.55,.04);
  onFace(g,F,signMat(['Divino Sabor'],{bg:'#f6f3ea',fg:'#6b4a2e',w:384,h:160,font:'Georgia, serif',weight:700}),S(1272.4),y0+4.3,3.2,1.05,.06,.05);
  // window upstairs at the canopy end, floodlights on arms and two dishes on the parapet
  opening(g,face(UP[0],UP[1],[1281.7,-221]),2.6,top+.1,1.3,1.1,{fill:glassM(),frame:'#f0efe9',panes:2});
  for(const s of[2,6.5,10.5,14.5]){
    const[x,,z]=F.at(s,0,.3),arm=new THREE.Mesh(new THREE.BoxGeometry(.05,.05,1.1),flat('#9a9a96'));arm.position.set(x,top+.25,z+.25);g.add(arm);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(.35,.12,.25),matte({color:0xd9d9d4,emissive:0x6a675e}));lamp.position.set(x,top+.25,z+.85);g.add(lamp);
  }
  for(const x of[1271,1276.5]){
    const d=new THREE.Mesh(new THREE.SphereGeometry(.45,12,6,0,Math.PI*2,0,.55),flat('#d2d4d5'));d.position.set(x,top+.3,-214.5);d.rotation.set(-1.1,0,0);g.add(d);
  }
  // east wall under the canopy: plain light render, the drainpipe and the steel ladder to the roof
  const E=face(P[1],P[2],ins);
  onFace(g,E,flat('#d9d6cf'),E.len/2,y0+.9,E.len-.2,top-y0-1.5,.02);
  onFace(g,E,flat('#9c9e9f'),E.len-1,y0,.12,top-y0,.08,.12);
  for(let y=y0+1.8;y<top-.4;y+=.35)onFace(g,E,flat('#5d6062'),7.5,y,.6,.04,.25,.04);
  for(const s of[7.2,7.8])onFace(g,E,flat('#5d6062'),s,y0+1.8,.05,top-y0-2.2,.25,.05);
}

export default {category:'Divinolândia',label:'Posto Lurain',build};
