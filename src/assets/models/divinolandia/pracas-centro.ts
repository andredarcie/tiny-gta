import * as THREE from 'three';
import {matte} from '../matte.ts';
import {drape,kerb,circle,strip,lawnM,pathM,pathEdgeM,walkM,walkEdgeM,stoneM,soilM,STREET_TOP,type GroundAt,type P2} from './praca-chao.ts';
import {flat,signMat,block,canvasTex} from './posto-kit.ts';
import {leafMat,leafMass} from './copa.ts';
import ArvoreRua from './arvore-rua.ts';
import ArvorePraca from './arvore-praca.ts';
import Banco from './banco-praca.ts';
import Poste from './poste-colonial.ts';
import Palmeira from './palmeira-fenix.ts';
import type {Publico} from './publicos.ts';

// Four squares of Divinolândia laid out from the gridded satellite and Street View
// (sat-pub-*, pub-* captures, local): Praça Dom Bosco (the paved triangle by the Martins
// building, red-and-grey paver paths, lawn beds, the round fountain, colonial lamps),
// Praça Nossa Senhora do Rosário (the paved square with the round tea-room pavilion under
// its conical clay roof, the Sapecado snack kiosk, the bus shelter, palms and ficus),
// Praça Jorge Galhano (lawn and flower beds under big trees, paver paths, the pink resedá
// row along the street, the blue bench), Praça Pedro Ribeiro de Paiva (the wooded lawn,
// the open earth event ground, the tube fence and the white/pink resedás along the street,
// painted concrete benches; the Igreja de São Sebastião in its corner is publicos.ts).
// Town-local metres shifted by each origin, as publicos.ts. No default export.

// inset a convex polygon by d (each edge moved in, neighbours intersected)
export function inset(p:P2[],d:number):P2[]{
  const n=p.length,c:P2=[p.reduce((s,q)=>s+q[0],0)/n,p.reduce((s,q)=>s+q[1],0)/n];
  const lines=p.map((a,i)=>{const b=p[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1;let nx=-dz/L,nz=dx/L;
    if(((a[0]+b[0])/2-c[0])*nx+((a[1]+b[1])/2-c[1])*nz>0){nx=-nx;nz=-nz;}return{p:[a[0]+nx*d,a[1]+nz*d] as P2,d:[dx,dz] as P2};});
  return p.map((_,i)=>{const L1=lines[(i+n-1)%n],L2=lines[i],den=L1.d[0]*L2.d[1]-L1.d[1]*L2.d[0];
    if(Math.abs(den)<1e-6)return L2.p;
    const t=((L2.p[0]-L1.p[0])*L2.d[1]-(L2.p[1]-L1.p[1])*L2.d[0])/den;return[L1.p[0]+L1.d[0]*t,L1.p[1]+L1.d[1]*t] as P2;});
}
const cen=(p:P2[]):P2=>[p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];
function root(o:P2):{r:THREE.Group;g:THREE.Group}{const r=new THREE.Group(),g=new THREE.Group();g.position.set(-o[0],0,-o[1]);r.add(g);return{r,g};}
const put=(g:THREE.Group,at:GroundAt,o:THREE.Object3D,x:number,z:number,ry=0,lift=STREET_TOP):void=>{o.position.set(x,at(x,z)+lift,z);o.rotation.y=ry;g.add(o);};
const tree=(g:THREE.Group,at:GroundAt,x:number,z:number,k:'ficus'|'reseda'|'resedaBranca'|'palmeira'|'copa'|'ipe'|'cipreste',s=1):void=>{
  const t=k==='copa'||k==='ipe'||k==='cipreste'?ArvorePraca.build({kind:k,r:k==='copa'?4.5*s:2.4*s,h:7*s,seed:Math.round(x*3+z)}):ArvoreRua.build({kind:k});
  if(k!=='copa'&&k!=='ipe'&&k!=='cipreste')t.scale.setScalar(s);put(g,at,t,x,z,x+z,.15);
};
// the concrete bench of the squares, painted (or bare)
function concBench(g:THREE.Group,at:GroundAt,x:number,z:number,ry:number,c='#9a9893',c2=c):void{
  const b=new THREE.Group();
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.8,.12,.5),flat(c2));seat.position.y=.45;b.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(1.8,.45,.12),flat(c2));back.position.set(0,.75,-.22);b.add(back);
  for(const s of[-.75,.75]){const l=new THREE.Mesh(new THREE.BoxGeometry(.18,.45,.45),flat(c));l.position.set(s,.22,0);b.add(l);}
  b.traverse(o=>{o.castShadow=true;});put(g,at,b,x,z,ry);
}
const bedM=leafMat(0x3f6a35),roseM=leafMat(0xc23a45),hydM=leafMat(0x8090c4),yellowM=leafMat(0xd9b42e);
function shrubs(g:THREE.Group,at:GroundAt,pts:P2[],m:THREE.Material[]):void{
  pts.forEach(([x,z],i)=>{const b=new THREE.Mesh(leafMass(1+i%3,.3,2),m[i%m.length]);b.scale.set(.6,.45,.6);put(g,at,b,x,z,0,STREET_TOP+.3);});
}

// ============================== Praça Dom Bosco ==============================
const DB:P2[]=[[-136.1,-62.1],[-95.7,-54.9],[-127.5,-40]];
const domBosco:Publico={id:'dombosco',nome:'Praça Dom Bosco',origin:cen(DB),foot:[[-128.5,-55,1,1,0,1.1]],build(at){
  const{r,g}=root(cen(DB));
  const ring=inset(DB,2.2),bed=inset(DB,4.6);
  g.add(drape(DB,at,STREET_TOP,walkM,[ring]));                     // pink pavers round the edge
  g.add(drape(ring,at,STREET_TOP+.005,pathM,[inset(DB,2.8)]));      // the red paver stripe
  g.add(drape(inset(DB,2.8),at,STREET_TOP,walkEdgeM,[bed]));        // the grey patterned walk
  g.add(drape(bed,at,STREET_TOP+.02,lawnM));
  kerb(g,at,[...DB,DB[0]],false,STREET_TOP,.16);kerb(g,at,[...bed,bed[0]],false,STREET_TOP+.12,.12);
  // the round fountain at the west tip: a low white basin and its central bowl
  {const x=-128.8,z=-55.2,y=at(x,z)+STREET_TOP;g.add(drape(circle(x,z,2.3,24),at,STREET_TOP+.01,stoneM));
    const b=new THREE.Mesh(new THREE.CylinderGeometry(2,2.1,.55,28,1,true),matte({color:0xeeece6,side:THREE.DoubleSide}));b.position.set(x,y+.27,z);g.add(b);
    const w=new THREE.Mesh(new THREE.CircleGeometry(1.95,28),matte({color:0x6aa6c0,emissive:0x0a2030}));w.rotation.x=-Math.PI/2;w.position.set(x,y+.42,z);g.add(w);
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.25,.4,.9,12),flat('#eeece6'));p.position.set(x,y+.45,z);g.add(p);
    const bowl=new THREE.Mesh(new THREE.CylinderGeometry(.9,.3,.3,16),flat('#eeece6'));bowl.position.set(x,y+1,z);g.add(bowl);}
  // lamps, benches, young trees and shrubs
  for(const[x,z]of[[-120,-52.5],[-108,-54.5],[-125,-46],[-131,-57.5]] as P2[])put(g,at,Poste.build(),x,z);
  for(const[x,z,ry]of[[-116,-49.2,2.7],[-112,-55.6,0],[-122,-57.8,0]] as [number,number,number][])concBench(g,at,x,z,ry,'#a8a49c');
  for(const[x,z,k]of[[-118,-55,'ipe'],[-110,-51,'reseda'],[-124,-50,'palmeira'],[-103,-55,'reseda']] as [number,number,'ipe'|'reseda'|'palmeira'][])tree(g,at,x,z,k,.8);
  shrubs(g,at,[[-121,-50],[-114,-52],[-106,-54],[-126,-53]],[yellowM,bedM,roseM]);
  return r;}};

// ============================== Praça Nossa Senhora do Rosário ==============================
const RO:P2[]=[[573.5,-67],[610,-61.7],[612.2,-59.9],[612,-57.8],[610.5,-55.8],[566.6,-38.3]];
const PAV:P2=[580.5,-54.5];
const rosario:Publico={id:'rosario',nome:'Praça Nossa Senhora do Rosário',origin:cen(RO),foot:[[PAV[0],PAV[1],12,12,0,4],[593.5,-58,4,3,0,3],[606.5,-58.5,4,4,0,1]],build(at){
  const{r,g}=root(cen(RO));
  g.add(drape(RO,at,STREET_TOP,stoneM));                            // the cement paving of the square
  g.add(drape(inset(RO,1.2),at,STREET_TOP+.005,walkEdgeM));
  kerb(g,at,[...RO,RO[0]],false,STREET_TOP,.16);
  // the round pavilion (tea room): mint-green parapet wall, posts, conical clay roof
  {const[x,z]=PAV,y=at(x,z)+STREET_TOP,R=6.2;
    g.add(drape(circle(x,z,R+.4,32),at,STREET_TOP+.02,stoneM));
    const wall=new THREE.Mesh(new THREE.CylinderGeometry(R,R,1.15,40,1,true,.5,Math.PI*2-1),matte({color:0x9ed6c4,side:THREE.DoubleSide}));wall.position.set(x,y+.58,z);g.add(wall);
    const base=new THREE.Mesh(new THREE.CylinderGeometry(R+.08,R+.08,.35,40,1,true),matte({color:0x6f6a60,side:THREE.DoubleSide}));base.position.set(x,y+.17,z);g.add(base);
    for(let k=0;k<12;k++){const a=k/12*Math.PI*2;block(g,flat('#f2f2ee'),x+Math.cos(a)*R,y,z+Math.sin(a)*R,.18,2.9,.18);}
    const rail=new THREE.Mesh(new THREE.TorusGeometry(R,.03,4,48),flat('#d8d8d4'));rail.rotation.x=Math.PI/2;rail.position.set(x,y+1.8,z);g.add(rail);
    const band=new THREE.Mesh(new THREE.CylinderGeometry(R+.15,R+.15,.45,40,1,true),matte({color:0xf2f2ee,side:THREE.DoubleSide}));band.position.set(x,y+3.1,z);g.add(band);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(R+1.1,2.6,32,1,true),matte({color:0x8e5a44,side:THREE.DoubleSide,map:canvasTex(64,64,(c,W,H)=>{
      c.fillStyle='#ffffff';c.fillRect(0,0,W,H);for(let i=0;i<8;i++){c.fillStyle='rgba(60,30,20,.35)';c.fillRect(0,i*8+6,W,2);}for(let i=0;i<16;i++){c.fillStyle='rgba(60,30,20,.2)';c.fillRect(i*4,0,1,H);}})}));
    roof.position.set(x,y+4.6,z);roof.castShadow=true;g.add(roof);
    for(let k=0;k<5;k++){const a=k/5*Math.PI*2+.3;const t=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.05,12),flat('#e8e2d2'));t.position.set(x+Math.cos(a)*3.4,y+.75,z+Math.sin(a)*3.4);g.add(t);
      const leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.75,6),flat('#5a5a5a'));leg.position.set(x+Math.cos(a)*3.4,y+.37,z+Math.sin(a)*3.4);g.add(leg);}
    // the mint annex (kitchen, toilets) behind it, stone plinth, clay roof
    block(g,flat('#a6dccb'),x+1,y-.3,z+8.4,6,3.1,3.6,.2);block(g,flat('#7a6a58'),x+1,y-.3,z+8.4,6.05,.6,3.65,.2);
    const ar=new THREE.Mesh(new THREE.BoxGeometry(6.6,.12,4.2),flat('#b0603f'));ar.position.set(x+1,y+2.9,z+8.4);ar.rotation.set(.12,.2,0,'YXZ');g.add(ar);}
  // the Sapecado snack kiosk: a wooden box with its awning and posters
  {const x=593.5,z=-58,y=at(x,z)+STREET_TOP;
    const k=new THREE.Mesh(new THREE.BoxGeometry(4,2.4,3),[flat('#8a5a3a'),flat('#8a5a3a'),flat('#4a3a2e'),flat('#4a3a2e'),
      signMat(['Sapecado','LANCHES · AÇAÍ'],{bg:'#7a4a2a',fg:'#f2c56a',w:256,h:160,font:'Georgia, serif'}),flat('#8a5a3a')]);k.position.set(x,y+1.2,z);k.rotation.y=-.18;k.castShadow=true;g.add(k);
    const aw=new THREE.Mesh(new THREE.BoxGeometry(4.6,.1,3.6),flat('#3a2e26'));aw.position.set(x,y+2.5,z);aw.rotation.y=-.18;g.add(aw);
    const sg=signMat(['Sapecado'],{bg:'#2b2b2b',fg:'#e8603a',w:256,h:64,font:'Georgia, serif'});const s2=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.6),sg);s2.position.set(x,y+3,z+1.55);s2.rotation.y=-.18;g.add(s2);}
  // the blue bus shelter on the north side, the raised palm bed at the east tip, the big trees
  {const x=588,z=-63.4,y=at(x,z)+STREET_TOP,sh=new THREE.Group();sh.position.set(x,y,z);sh.rotation.y=-.14;g.add(sh);
    for(const s of[-1.7,1.7]){const p=new THREE.Mesh(new THREE.BoxGeometry(.1,2.4,.1),flat('#2f5fa8'));p.position.set(s,1.2,.4);sh.add(p);}
    const rf=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,3.8,12,1,true,0,Math.PI),matte({color:0x4f8fbf,transparent:true,opacity:.7,side:THREE.DoubleSide}));
    rf.rotation.z=Math.PI/2;rf.scale.set(.4,1,1);rf.position.set(0,2.4,0);sh.add(rf);
    const bk=new THREE.Mesh(new THREE.PlaneGeometry(3.4,1.6),signMat(['DIVINOLÂNDIA','mapa turístico'],{bg:'#e8eef2',fg:'#2f5fa8',w:256,h:128}));bk.position.set(0,1.4,-.4);sh.add(bk);
    const seat=new THREE.Mesh(new THREE.BoxGeometry(3,.08,.4),flat('#b5532c'));seat.position.set(0,.5,-.1);sh.add(seat);}
  {const x=606.5,z=-58.5,y=at(x,z)+STREET_TOP;const pl=new THREE.Mesh(new THREE.CylinderGeometry(2,2.1,.5,24),flat('#7a6a58'));pl.position.set(x,y+.25,z);g.add(pl);
    for(const[dx,dz,h]of[[-.6,0,4.5],[.8,.4,5.5]] as [number,number,number][]){const p=Palmeira.build({h,seed:Math.round(dx*10)});p.position.set(x+dx,y+.5,z+dz);g.add(p);}}
  for(const[x,z]of[[571,-50],[574,-61],[600,-52]] as P2[])tree(g,at,x,z,'copa',.9);
  for(const[x,z]of[[586,-45],[598,-50.5]] as P2[])tree(g,at,x,z,'palmeira',1);
  for(const[x,z,ry]of[[592,-51.5,2.9],[600,-60,0]] as [number,number,number][])concBench(g,at,x,z,ry,'#9a9893');
  {const x=583,z=-64,y=at(x,z)+STREET_TOP;const b=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.7,10,1,true),matte({color:0x3a9a4a,wireframe:true}));b.position.set(x,y+.8,z);g.add(b);}
  return r;}};

// ============================== Praça Jorge Galhano ==============================
const JG:P2[]=[[495.1,134.3],[571,95.7],[564.8,133.8],[513.6,162.2]];
const jorgeGalhano:Publico={id:'jorgegalhano',nome:'Praça Jorge Galhano',origin:cen(JG),foot:[[552,128.5,2.2,.8,-.48,1]],build(at){
  const{r,g}=root(cen(JG));
  const lawn=inset(JG,2.2);
  g.add(drape(JG,at,STREET_TOP,walkEdgeM,[lawn]));                  // grey paver sidewalk all round
  g.add(drape(lawn,at,STREET_TOP+.02,lawnM));
  kerb(g,at,[...JG,JG[0]],false,STREET_TOP,.16);kerb(g,at,[...lawn,lawn[0]],false,STREET_TOP+.1,.12);
  // paver paths across the lawn
  const path=(a:P2,b:P2,w=2.4):void=>{g.add(drape(strip(a,b,w+.4),at,STREET_TOP+.04,pathEdgeM,[],2,Math.atan2(b[1]-a[1],b[0]-a[0])));
    g.add(drape(strip(a,b,w),at,STREET_TOP+.045,stoneM,[],2,Math.atan2(b[1]-a[1],b[0]-a[0])));};
  path([500,134],[540,125]);path([516,133],[519,158]);path([540,125],[562,108]);path([540,125],[548,140]);
  g.add(drape(circle(540,125,3.2,20),at,STREET_TOP+.05,stoneM));
  // the big trees of the east half, smaller ones west, the pink resedá row on the street side
  for(const[x,z,s]of[[548,113,1.2],[558,108,1],[530,117,1.1],[552,127,1.2],[560,122,.9],[536,135,1],[527,145,.8],[545,145,.9]] as [number,number,number][])tree(g,at,x,z,'copa',s);
  tree(g,at,509,147,'palmeira',1);tree(g,at,522,140,'ipe',1);
  for(let t=.08;t<.95;t+=.11){const x=JG[3][0]+(JG[0][0]-JG[3][0])*t+1.6,z=JG[3][1]+(JG[0][1]-JG[3][1])*t-.6;tree(g,at,x,z,'reseda',.85);}
  // flower beds (roses, hydrangeas) and the blue bench
  for(const[x,z]of[[528,128],[533,152],[545,134],[524,124]] as P2[]){g.add(drape(circle(x,z,1.6,14),at,STREET_TOP+.04,soilM));shrubs(g,at,[[x-.6,z],[x+.6,z+.3],[x,z-.6]],[roseM,hydM,bedM]);}
  {const x=552,z=128.5,y=at(x,z)+STREET_TOP;const b=new THREE.Mesh(new THREE.BoxGeometry(2.2,.6,.8),[flat('#2f5fb8'),flat('#2f5fb8'),flat('#2f5fb8'),flat('#2f5fb8'),
    signMat(['PRAÇA','JORGE GALHANO'],{bg:'#f2f2ee',fg:'#2f5fb8',w:256,h:96}),flat('#2f5fb8')]);b.position.set(x,y+.3,z);b.rotation.y=-.48;g.add(b);}
  for(const[x,z]of[[506,132.5],[534,124],[519,150],[556,116]] as P2[])put(g,at,Poste.build(),x,z);
  for(const[x,z,ry]of[[512,131,.2],[521,145,1.6],[544,121,.6]] as [number,number,number][])put(g,at,Banco.build(),x,z,ry,STREET_TOP+.04);
  return r;}};

// ============================== Praça Pedro Ribeiro de Paiva ==============================
// (the OSM outline's east tip reaches over the Rua Zaki Haddad's kerb: pulled back 2.5 m)
const PR:P2[]=[[572.9,317.2],[613.3,272.2],[622.2,270.4],[652.6,297.2],[652.3,301.9],[593.4,332.5],[583.9,335.5],[573.6,328.5]];
const pedroRibeiro:Publico={id:'pedroribeiro',nome:'Praça Pedro Ribeiro de Paiva',origin:cen(PR),foot:[],build(at){
  const{r,g}=root(cen(PR));
  const inner=inset(PR,2.3);
  g.add(drape(PR,at,STREET_TOP,walkM,[inner]));                     // the sidewalk round it
  kerb(g,at,[...PR,PR[0]],false,STREET_TOP,.16);kerb(g,at,[...inner,inner[0]],false,STREET_TOP+.1,.12);
  // lawn to the north, the open earth ground in the middle (the church corner is publicos.ts)
  const earth:P2[]=[[590,318],[612,296],[642,300],[640,312],[600,326]];
  g.add(drape(inner,at,STREET_TOP+.02,lawnM,[earth]));
  g.add(drape(earth,at,STREET_TOP+.03,matte({color:0xb08a6a,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3})));
  for(const[x,z,s]of[[612,283,1.1],[622,280,1],[630,288,1.2],[640,292,.9],[600,296,1],[606,287,.9],[618,292,.8],[646,298,.8],[594,305,.8]] as [number,number,number][])tree(g,at,x,z,'copa',s);
  tree(g,at,648,301,'palmeira',1.1);tree(g,at,635,281,'ficus',1);
  // white and pink resedás along the south sidewalk, the tube fence behind them
  const a=PR[4],b=PR[5];
  for(let t=.06;t<.97;t+=.1){const x=a[0]+(b[0]-a[0])*t-.9,z=a[1]+(b[1]-a[1])*t-1.2;tree(g,at,x,z,Math.round(t*10)%2?'resedaBranca':'reseda',.8);}
  {const L=Math.hypot(b[0]-a[0],b[1]-a[1]),ry=-Math.atan2(b[1]-a[1],b[0]-a[0]),pm=flat('#c9ccce');
    for(let k=0;k<=Math.ceil(L/2.5);k++){const t=k/Math.ceil(L/2.5),x=a[0]+(b[0]-a[0])*t-1.9,z=a[1]+(b[1]-a[1])*t-2.6;block(g,pm,x,at(x,z)+STREET_TOP,z,.06,1.1,.06);}
    for(const h of[.55,1.05]){const rl=new THREE.Mesh(new THREE.BoxGeometry(L,.05,.05),pm);rl.position.set((a[0]+b[0])/2-1.9,at((a[0]+b[0])/2,(a[1]+b[1])/2)+STREET_TOP+h,(a[1]+b[1])/2-2.6);rl.rotation.y=ry;g.add(rl);}}
  // painted concrete benches (red/blue) along the paths
  for(const[x,z,ry]of[[628,277,.75],[640,286,.8],[650,296,.85],[612,287,-.8]] as [number,number,number][])concBench(g,at,x,z,ry,'#c84a4a','#5f8fc8');
  for(const[x,z]of[[620,300],[606,312],[634,306]] as P2[])put(g,at,Poste.build(),x,z);
  return r;}};

export const PRACAS:(Publico&{osm:string})[]=[
  {...domBosco,osm:'Praça Dom Bosco'},{...rosario,osm:'Praça Nossa Senhora do Rosário'},
  {...jorgeGalhano,osm:'Praça Jorge Galhano'},{...pedroRibeiro,osm:'Praça Pedro Ribeiro de Paiva'},
];
