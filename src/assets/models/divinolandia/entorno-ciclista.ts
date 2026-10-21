import * as THREE from 'three';
import {matte} from '../matte.ts';
import {drape,type GroundAt,type P2} from './praca-chao.ts';
import {flat,walls,face,onFace,opening,glassM,canvasTex,tileWall,block,gravelM,hPoly,signMat,type Face} from './posto-kit.ts';
import {buildFachada} from './fachada.ts';
import Trator from './trator-mahindra.ts';
import Implemento,{type ImplKind} from './implemento-agricola.ts';
import ArvoreRua from './arvore-rua.ts';
import Poste from './poste-rede.ts';

// The surroundings of the Monumento ao Ciclista (the town's east entrance, where the town
// road, the Avenida A and the SP-344 meet), lot by lot from Google Street View (entorno-*,
// monumento-ciclista-*: 11 panoramas, local in docs/divinolandia/referencias-streetview/)
// and the gridded z20 satellite (sat-entorno-ciclista.png). The bake has no house here (it
// lies outside OSM's urban area), so everything is this file:
//  WEST of the town road, one row of lots parallel to it (the satellite's 48 m long roof):
//   - the steel PAVILION: open to the road, portal frames, a light metal roof, the back wall
//     in white tiles, old lorries parked inside (a red tow truck, a beige pick-up);
//   - the two-storey cement-block WAREHOUSE with the red steel door and the high windows,
//     the roll-up door in its gable end, fibre-cement roof;
//   - the fence on the road: chain-link on a low wall, the dark corrugated hoarding, the two
//     granite-clad gate pillars, then the rough block wall with pilasters and a clay coping;
//   - the SCRAP SHED in the red-earth yard: a fibre-cement lean-to over an old car and
//     junk, the concrete mixer, the blue drum, a traffic cone, stacked blocks;
//   - behind the wall the beige house with its clay roof; up the row the clay-roofed houses
//     round the junction (the beige one behind its wall and gate, the one with the red
//     garage) and the white house; the big light-roofed shed further back;
//  EAST, across the town road from the yard:
//   - the Mahindra machinery yard on its terrace: the white block retaining wall, the
//     chain-link on concrete posts, red Mahindra tractors, the orange and the blue sprayers,
//     the green spreader, the black loader, the "THOR 5000" trailers;
//   - the beige house below the dealer (the dealer itself is concessionaria-mahindra.ts);
//  along the streets the young trees of the verges and islands, the concrete poles with
//  their lamps, the PARE sign and the yellow pedestrian warning.
// build({groundAt}) is pure; TOWN-LOCAL coordinates shifted by ORIGIN (as the fuel stations).
export const ORIGIN:P2=[1465,-160];
// the row of lots west of the town road: s along it (from its north end, SSE), e across
// it (toward the road, ENE). TH turns a +z-facing model to face the road.
const A:P2=[1427.8,-177.3],U:P2=[.534,.845],E:P2=[.845,-.534],TH=Math.atan2(E[0],E[1]);
const R=(s:number,e:number):P2=>[A[0]+U[0]*s+E[0]*e,A[1]+U[1]*s+E[1]*e];
const FENCE=11.6;                                      // the frontage line on the road (e)…
// …which closes in on the road south of the gate, where the road bends toward the row
const fe=(s:number):number=>s<36.8?FENCE:FENCE-(s-36.8)*.09;
const segBox=(a:P2,b:P2,d:number,h:number):[number,number,number,number,number,number]=>
  [(a[0]+b[0])/2,(a[1]+b[1])/2,Math.hypot(b[0]-a[0],b[1]-a[1]),d,Math.atan2(b[1]-a[1],b[0]-a[0]),h];
const COMPOUND:P2[]=[[1470,-149],[1506,-149],[1506,-122],[1484.5,-122]];
export const TREES:P2[]=[[1458,-183.1],[1466,-181.4],[1494,-175.8],[1500,-174.6],[1460,-194.6],[1470,-192.6],[1480,-190.6],
  [1490,-188.5],[1500,-186.5],[1452.5,-184],[1456.5,-179.5]];
export const POLES:P2[]=[[1455,-195.3],[1486,-188.9],[1462,-177.5],[1489.5,-176.8]];
// collision boxes [x, z, w, d, rot, height] (town-local); rot turns w onto the row
const ROT=Math.atan2(U[1],U[0]);
const rowBox=(s0:number,s1:number,e0:number,e1:number,h:number):[number,number,number,number,number,number]=>{
  const[x,z]=R((s0+s1)/2,(e0+e1)/2);return[x,z,s1-s0,e1-e0,ROT,h];};
export const ENTORNO_FOOT:[number,number,number,number,number,number][]=[
  rowBox(0,24,-4.3,-3.8,5),rowBox(0,.4,-4,4,3),                     // pavilion: back wall, north end
  ...[0,6,12,18,24].flatMap(s=>[rowBox(s-.15,s+.15,-4,-3.7,5),rowBox(s-.15,s+.15,3.7,4,5)]),   // its columns
  rowBox(25,34,-3.75,3.75,7),rowBox(37,47,-2,4,3.5),                // warehouse, scrap shed
  rowBox(22,38.5,FENCE-.15,FENCE+.15,2.4),segBox(R(44.2,fe(44.2)),R(62,fe(62)),.3,2.4),   // the frontage (the gate stays open)
  rowBox(53,63,-5,4,6),rowBox(-11.7,.3,-19.6,-10.6,7),rowBox(-11.5,-4.5,-4,2,5),rowBox(-3,8,-36,-28,7),rowBox(14,46,-36,-20,8),
  [1488,-149.2,36,.5,0,4.5],[1477.25,-135.5,30.6,.5,Math.atan2(27,14.5),4.5],          // the yard's retaining walls
  [1501,-157,7,8,0,6],
  ...TREES.map(([x,z])=>[x,z,.35,.35,0,4] as [number,number,number,number,number,number]),
  ...POLES.map(([x,z])=>[x,z,.4,.4,0,9] as [number,number,number,number,number,number]),
];

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);
  const lo=(p:P2[]):number=>Math.min(...p.map(([x,z])=>at(x,z)));
  const hi=(p:P2[]):number=>Math.max(...p.map(([x,z])=>at(x,z)));
  const rect=(s0:number,s1:number,e0:number,e1:number):P2[]=>[R(s0,e0),R(s1,e0),R(s1,e1),R(s0,e1)];
  // a sub-frame on the row: local x along -U... we use local z = E (toward the road), x = -U
  const frame=(s:number,e:number,y:number):THREE.Group=>{const f=new THREE.Group();const[x,z]=R(s,e);f.position.set(x,y,z);f.rotation.y=TH;g.add(f);return f;};

  // ---------------- ground: the dirt strip and yard in front of the row ----------------
  g.add(drape([R(0,4),R(34,4),R(34,FENCE),R(-2,FENCE)],at,.09,gravelM,[],2));
  g.add(drape([R(34,-3.8),R(48,-3.8),R(48,fe(48)),R(34,FENCE)],at,.1,terraM(),[],2));

  // ---------------- the steel pavilion (s 0..24) ----------------
  {
    const P=rect(0,24,-4,4),y0=hi(P)+.1,EAVE=y0+5,RIDGE=y0+6.2,base=lo(P)-.5;
    // back wall: white tiles below, cement block above; the closed north end
    const back=rect(0,24,-4.2,-4);
    walls(g,back,base,y0+3,tileWall(),.6);walls(g,back,y0+3,EAVE,blockM(),1);
    walls(g,rect(0,.2,-4,4),base,y0+3,tileWall(),.6);
    g.add(drape(rect(0,24,-4,4),at,.12,flat('#8f8b84')));
    // portal frames every 6 m: two columns and the rafters to the ridge; purlins along
    const steel=flat('#3a3c3e');
    for(let s=0;s<=24;s+=6){
      const f=frame(s,0,0);
      for(const z of[-3.85,3.85]){const c=new THREE.Mesh(new THREE.BoxGeometry(.22,EAVE-base,.28),steel);c.position.set(0,(EAVE+base)/2,z);f.add(c);}
      for(const sd of[-1,1]){const L=Math.hypot(4,RIDGE-EAVE),r=new THREE.Mesh(new THREE.BoxGeometry(.18,.32,L),steel);
        r.position.set(0,(EAVE+RIDGE)/2,sd*2);r.rotation.x=sd*Math.atan2(RIDGE-EAVE,4);f.add(r);}
    }
    sheetRoof(g,R(12,0),24.6,4.4,EAVE,RIDGE-EAVE,corrM('#a7abad'));
    // the old lorries under it
    oldTruck(g,at,R(8,0),'#b7322a',true);oldTruck(g,at,R(16,.5),'#d8cfb2',false);
  }

  // ---------------- the cement-block warehouse (s 25..34) ----------------
  {
    const P=rect(25,34,-3.75,3.75),y0=at(...R(29.5,3.75))+.1,EAVE=y0+5.6,base=lo(P)-.5,ins=R(29.5,0);
    walls(g,P,base,EAVE,blockM(),1,ins);
    const F=face(P[2],P[3],ins);                       // the road side (left = south)
    // rendered concrete frame (pillars + beam) over the blocks, the red door, the windows
    for(const s of[.15,4.5,8.85])onFace(g,F,flat('#bcae97'),s,base,.3,EAVE-base,.03);
    onFace(g,F,flat('#bcae97'),4.5,y0+2.9,9,.25,.03);
    opening(g,F,2.4,y0,2.1,2.7,{fill:flat('#c2463b'),frame:'#7d2a24'});
    for(const s of[2.6,6.6])opening(g,F,s,y0+3.5,.9,.8,{fill:glassM(),frame:'#6f7174'});
    const S=face(P[1],P[2],ins);                       // the gable end on the yard: roll-up door
    opening(g,S,3.75,y0,3,3.4,{fill:rollM(),frame:'#bcae97'});
    gableEnd(g,R(34,0),7.5,EAVE,1.3,blockM());gableEnd(g,R(25,0),7.5,EAVE,1.3,blockM());
    sheetRoof(g,R(29.5,0),9.6,4.1,EAVE,1.3,corrM('#6d6f6f'));
  }

  // ---------------- the frontage on the road ----------------
  {
    const line=(s0:number,s1:number):Face=>face(R(s0,FENCE),R(s1,FENCE),R((s0+s1)/2,0));
    // chain-link on a low block wall, concrete posts with curved heads
    const c=line(22,30),y=at(...R(26,FENCE));
    onFace(g,c,blockM(),c.len/2,y-.4,c.len,.9,0,.2);
    onFace(g,c,chainM(),c.len/2,y+.5,c.len,1.6,0);
    for(let s=0;s<=c.len+.01;s+=2.6){const[x,,z]=c.at(s,0,0);const p=new THREE.Mesh(new THREE.BoxGeometry(.12,2.3,.12),flat('#c9c7c0'));p.position.set(x,at(x,z)+1.1,z);g.add(p);}
    // dark corrugated hoarding
    const h=line(30,38.5);onFace(g,h,corrM('#4c5256'),h.len/2,at(...R(34,FENCE))-.2,h.len,2.6,0);
    // granite-clad gate pillars
    for(const s of[39.2,43.9]){const[x,z]=R(s,FENCE),py=at(x,z);
      const p=new THREE.Mesh(new THREE.BoxGeometry(.55,2.9,.55),graniteM());p.position.set(x,py+1.45,z);p.rotation.y=TH;p.castShadow=true;g.add(p);
      for(let k=0;k<3;k++){const c2=new THREE.Mesh(new THREE.BoxGeometry(.45-k*.12,.12,.45-k*.12),flat('#9a978f'));c2.position.set(x,py+2.95+k*.12,z);c2.rotation.y=TH;g.add(c2);}}
    // rough block wall with pilasters and the clay-tile coping, along the road to the south
    const w=face(R(44.2,fe(44.2)),R(62,fe(62)),R(53,0));
    for(let s=0;s<w.len;s+=3.2){
      const[x,,z]=w.at(s+1.6,0,0),y0=at(x,z)-.4;
      onFace(g,w,roughM(),s+1.6,y0,3.2,2.6,0,.2);
      const[px,,pz]=w.at(s,0,0);block(g,flat('#a59f92'),px,at(px,pz)-.4,pz,.3,2.75,.3,TH);
      onFace(g,w,flat('#b0603f'),s+1.6,y0+2.6,3.3,.1,0,.42);
    }
  }

  // ---------------- the scrap shed and its yard (s 37..47) ----------------
  {
    const P=rect(37,47,-2,4),y0=at(...R(42,4))+.05,base=lo(P)-.4;
    walls(g,rect(37,47,-2.2,-2),base,y0+3.5,roughM());walls(g,rect(37,37.2,-2,4),base,y0+3,roughM());
    walls(g,rect(46.8,47,-2,4),base,y0+3,roughM());
    const f=frame(42,1,0);
    const roofM=corrM('#5f6262'),L=Math.hypot(6.6,.9),r=new THREE.Mesh(new THREE.PlaneGeometry(10.6,L),roofM);
    r.rotation.x=-Math.PI/2+Math.atan2(.9,6.6);r.position.set(0,y0+3.05,0);r.castShadow=true;f.add(r);
    for(const x of[-5,-1.7,1.7,5]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,2.7,6),flat('#3a3c3e'));p.position.set(x,y0+1.3,3);f.add(p);}
    // the old car inside and the junk
    const car=new THREE.Group();f.add(car);car.position.set(-2.4,y0,.6);
    const cb=new THREE.Mesh(new THREE.BoxGeometry(4,.7,1.7),flat('#3f4448'));cb.position.y=.55;car.add(cb);
    const ct=new THREE.Mesh(new THREE.BoxGeometry(2,.55,1.5),flat('#3a3e42'));ct.position.set(-.2,1.17,0);car.add(ct);
    for(const[x,z]of[[1.4,.85],[-1.3,.85],[1.4,-.85],[-1.3,-.85]] as P2[]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.2,10),flat('#1a1a1a'));w.rotation.x=Math.PI/2;w.position.set(x,.3,z);car.add(w);}
    for(let k=0;k<5;k++){const b=new THREE.Mesh(new THREE.BoxGeometry(.6+(k%2)*.3,.4,.5),flat(['#6a5a48','#7a7d80','#5b3e2c','#8a8f92','#4a4a4a'][k]));b.position.set(1+k*.7,y0+.2+(k%3)*.25,-.8+(k%2)*.4);f.add(b);}
    // the stacked blocks, the cone, the blue drum, the concrete mixer in the yard
    const yy=(s:number,e:number):number=>at(...R(s,e));
    for(let k=0;k<6;k++){const[x,z]=R(38.5+(k%3)*.42,5.4+Math.floor(k/3)*.22);block(g,flat('#9a9790'),x,yy(38.5,5.4)+Math.floor(k/3)*.2,z,.39,.19,.19,TH);}
    {const[x,z]=R(39.5,6.4);const c=new THREE.Mesh(new THREE.ConeGeometry(.17,.7,10),flat('#e8602c'));c.position.set(x,yy(39.5,6.4)+.35,z);g.add(c);
      const st=new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.08,10),flat('#f1f1ee'));st.position.set(x,yy(39.5,6.4)+.42,z);g.add(st);}
    {const[x,z]=R(45,6.5);const d=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.9,12),flat('#2b63b0'));d.position.set(x,yy(45,6.5)+.45,z);g.add(d);}
    {const[x,z]=R(45.5,5.2),my=yy(45.5,5.2);
      const drum=new THREE.Mesh(new THREE.CylinderGeometry(.45,.6,.9,12),flat('#d0743a'));drum.position.set(x,my+.9,z);drum.rotation.z=.6;g.add(drum);
      for(const d of[-.4,.4])block(g,flat('#3a3c3e'),x+d,my,z,.06,.8,.06);}
  }

  // ---------------- houses and sheds of the row ----------------
  house(g,at,R(58,4),TH,{w:10,d:9,wall:'#d8c9ad',roof:'gableSide',roofColor:'#b0603f',seed:31,
    open:[{t:'window',x:-2.5,w:1.3,grille:true},{t:'door',x:1,w:1},{t:'window',x:3.3,w:1.2,grille:true}],x:['dish']});
  house(g,at,R(-5.7,-10.6),TH,{w:12,d:9,wall:'#e2d2b4',roof:'hip',roofColor:'#b0603f',seed:32,setback:4,
    front:{h:2,c:'#e2d3bb',gates:[{t:'gate',x:-3.8,w:3,c:'#8e9194'}]},open:[{t:'window',x:-1,w:1.4,grille:true},{t:'window',x:3,w:1.4,grille:true}]});
  house(g,at,R(-8,2),TH,{w:7,d:6,wall:'#ddd3c2',roof:'gable',roofColor:'#a9573c',seed:33,
    open:[{t:'garage',x:-.8,w:2.8,c:'#b5413a'},{t:'window',x:2.3,w:1,grille:true}]});
  house(g,at,R(2.5,-28),TH,{w:11,d:8,wall:'#efede6',roof:'hip',roofColor:'#9b5a44',seed:34,
    open:[{t:'window',x:-3,w:1.4,shutters:'#f2f0ea'},{t:'door',x:0,w:1},{t:'window',x:3,w:1.4,shutters:'#f2f0ea'}]});
  {
    // the big light-roofed shed behind the row
    const P=rect(14,46,-36,-20),y0=at(...R(30,-20))+.1,ins=R(30,-28);
    walls(g,P,lo(P)-.5,y0+6,flat('#e3dccd'),1,ins);
    const F=face(P[2],P[3],ins);
    opening(g,F,10,y0,4.5,4.5,{fill:rollM(),frame:'#cfc8b8'});opening(g,F,22,y0,4.5,4.5,{fill:rollM(),frame:'#cfc8b8'});
    gableEnd(g,R(14,-28),16,y0+6,1.6,flat('#e3dccd'));gableEnd(g,R(46,-28),16,y0+6,1.6,flat('#e3dccd'));
    sheetRoof(g,R(30,-28),32.6,8.4,y0+6,1.6,corrM('#dcdedd'));
  }

  // ---------------- the Mahindra machinery yard (east of the road) ----------------
  {
    let pad=-Infinity;for(const p of COMPOUND)pad=Math.max(pad,at(...p));
    for(let x=1472;x<1506;x+=4)for(let z=-148;z<-122;z+=4)pad=Math.max(pad,at(x,z));
    pad+=.25;
    g.add(hPoly(COMPOUND,pad,gravelM));
    const ins:P2=[1492,-136];
    // the white block retaining wall on the road and the plaza sides, plain walls behind
    const wm=whiteBlockM();
    const N=face(COMPOUND[0],COMPOUND[1],ins),W=face(COMPOUND[3],COMPOUND[0],ins);
    for(const f of[N,W])onFace(g,f,wm,f.len/2,lo(COMPOUND)-.8,f.len,pad-lo(COMPOUND)+.95,0,.25);
    for(const f of[face(COMPOUND[1],COMPOUND[2],ins),face(COMPOUND[2],COMPOUND[3],ins)])onFace(g,f,flat('#cfcac0'),f.len/2,lo(COMPOUND)-.8,f.len,pad-lo(COMPOUND)+.95,0,.2);
    // chain-link on concrete posts round the top (a diagonal brace at the corners)
    for(const f of[N,W]){
      onFace(g,f,chainM(),f.len/2,pad+.15,f.len,1.9,-.1);
      for(let s=0;s<=f.len+.01;s+=2.5){const[x,,z]=f.at(s,0,-.1);const p=new THREE.Mesh(new THREE.BoxGeometry(.12,2.3,.12),flat('#d9d8d2'));p.position.set(x,pad+1.15,z);g.add(p);}
      const[bx,,bz]=f.at(1.2,0,-.25);const br=new THREE.Mesh(new THREE.BoxGeometry(.1,2.6,.1),flat('#d9d8d2'));br.position.set(bx,pad+1.1,bz);br.rotation.set(0,f.ry,.5,'YXZ');g.add(br);
    }
    // the machines on display, noses toward the road
    const put=(m:THREE.Object3D,x:number,z:number,ry:number):void=>{m.position.set(x,pad,z);m.rotation.y=ry;g.add(m);};
    put(Trator.build(),1476.5,-145,Math.PI*.95);put(Trator.build({canopy:true}),1482.5,-145.5,Math.PI*.9);
    put(Implemento.build({kind:'distribuidor'}),1488.5,-145.8,Math.PI);
    put(Implemento.build({kind:'carregador'}),1493,-146.5,Math.PI*1.05);
    for(const[k,x,z,ry]of[['pulverizador',1499.5,-145.2,Math.PI],['pulverizadorAzul',1497,-139,Math.PI],['carreta',1484.5,-133,Math.PI/2],['carreta',1492,-130.5,Math.PI/2]] as [ImplKind,number,number,number][])
      put(Implemento.build({kind:k}),x,z,ry);
    // the beige house between the yard and the dealer
    house(g,at,[1497.5,-157],-Math.PI/2,{w:8,d:7,wall:'#e2d6bf',roof:'hip',roofColor:'#a9573c',seed:35,
      open:[{t:'window',x:-1.8,w:1.3,grille:true},{t:'door',x:1.4,w:1}],x:['tank']});
  }

  // ---------------- street trees, poles, signs ----------------
  for(const[i,[x,z]]of TREES.entries()){
    const t=ArvoreRua.build({kind:i%4===3?'reseda':'ficus'});t.scale.setScalar(.55+(i%3)*.08);t.position.set(x,at(x,z)-.05,z);t.rotation.y=i*1.7;g.add(t);
  }
  for(const[i,[x,z]]of POLES.entries()){const p=Poste.build({transformer:i===1});p.position.set(x,at(x,z),z);p.rotation.y=i<2?.2:1.0;g.add(p);}
  {
    const[x,z]=[1457.5,-183.5],y=at(x,z);block(g,flat('#9c9fa1'),x,y,z,.06,2.3,.06);
    const oct=new THREE.Mesh(new THREE.CircleGeometry(.38,8),signMat(['PARE'],{bg:'#c8202a',fg:'#ffffff',w:128,h:128}));
    oct.position.set(x,y+2.25,z+.04);oct.rotation.z=Math.PI/8;g.add(oct);
    const[x2,z2]=[1497.5,-176.3],y2=at(x2,z2);block(g,flat('#9c9fa1'),x2,y2,z2,.06,2.3,.06);
    const dia=new THREE.Mesh(new THREE.PlaneGeometry(.6,.6),warnM());dia.position.set(x2,y2+2.25,z2+.04);dia.rotation.set(0,Math.PI,Math.PI/4);g.add(dia);
  }
  return root;
}

// a house of the row: the Fachada model (facade at z = 0 facing +z) at the facade's middle
// point, turned by th, its walls run down to the lowest ground under it
function house(g:THREE.Group,at:GroundAt,p:P2,th:number,o:Parameters<typeof buildFachada>[0]):void{
  const y=at(...p),c=Math.cos(th),s=Math.sin(th),d=(o.d??10)+(o.setback??0);
  let lo=y;for(const[u,v]of[[-o.w/2,0],[o.w/2,0],[-o.w/2,-d],[o.w/2,-d],[0,-d/2]] as P2[])lo=Math.min(lo,at(p[0]+u*c+v*s,p[1]-u*s+v*c));
  const h=buildFachada({...o,base:Math.min(-.4,lo-y-.3)});h.position.set(p[0],y,p[1]);h.rotation.y=th;g.add(h);
}
// a gable roof of sheets (metal / fibre-cement), ridge along the row, centred at c
function sheetRoof(g:THREE.Group,c:P2,len:number,hw:number,eave:number,rise:number,m:THREE.Material):void{
  const f=new THREE.Group();f.position.set(c[0],eave,c[1]);f.rotation.y=TH;g.add(f);
  const L=Math.hypot(hw,rise);
  for(const sd of[-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(len,L),m);
    p.rotation.x=-Math.PI/2+sd*Math.atan2(rise,hw);p.position.set(0,rise/2,sd*hw/2);p.castShadow=true;f.add(p);}
}
// the triangle of a gable end at c (across the row, width w), eave y, rise
function gableEnd(g:THREE.Group,c:P2,w:number,y:number,rise:number,m:THREE.Material):void{
  const f=new THREE.Group();f.position.set(c[0],y,c[1]);f.rotation.y=TH+Math.PI/2;g.add(f);
  const sh=new THREE.Shape([new THREE.Vector2(-w/2,0),new THREE.Vector2(w/2,0),new THREE.Vector2(0,rise)]);
  const t=new THREE.Mesh(new THREE.ShapeGeometry(sh),m);(t.material as THREE.Material).side=THREE.DoubleSide;f.add(t);
}
// an old lorry: cab, bonnet, bed (a tow truck carries the inclined flatbed)
function oldTruck(g:THREE.Group,at:GroundAt,p:P2,c:string,tow:boolean):void{
  const f=new THREE.Group();f.position.set(p[0],at(...p),p[1]);f.rotation.y=TH+Math.PI/2;g.add(f);
  const box=(m:THREE.Material,w:number,h:number,d:number,x:number,y:number,z:number):void=>{const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=true;f.add(b);};
  const body=flat(c),dark=flat('#1d1d1d');
  box(body,1.2,1.1,2.1,2.3,.8,0);box(body,1.4,1.5,2.1,1.2,.7,0);box(glassM(),.05,.6,1.8,1.92,1.5,0);
  if(tow){box(flat('#c9c9c4'),4.4,.15,2.2,-1.6,1.1,0);box(flat('#8a2a24'),.2,.9,2.2,-3.7,1.2,0);}
  else box(flat('#cfc6a8'),2.6,.6,1.9,-.9,.8,0);
  for(const[x,z]of[[2,.95],[2,-.95],[-1.8,.95],[-1.8,-.95]] as P2[]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.3,12),dark);w.rotation.x=Math.PI/2;w.position.set(x,.45,z);f.add(w);}
}

// ---------------- materials ----------------
const cache=new Map<string,THREE.Material>();
const get=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=cache.get(k);if(!m){m=f();cache.set(k,m);}return m;};
// cement blocks (bloco de concreto) 40 × 20 with their mortar lines; 1 tile = 1 m
function blockTex(base:string,joint:string):THREE.Texture{
  return canvasTex(128,128,(c,w,h)=>{c.fillStyle=base;c.fillRect(0,0,w,h);
    for(let i=0;i<900;i++){const v=(i*37)%40-20;c.fillStyle=`rgba(${128+v},${126+v},${120+v},.15)`;c.fillRect((i*53)%w,(i*29+i*i)%h,3,3);}
    c.fillStyle=joint;for(let r=0;r<5;r++){c.fillRect(0,r*h/5,w,2);for(let k=0;k<3;k++)c.fillRect(((k+(r%2)*.5)*w/2.5)%w,r*h/5,2,h/5);}});
}
const blockM=():THREE.Material=>get('bloco',()=>matte({map:blockTex('#c4bcac','#8c8578'),side:THREE.DoubleSide}));
const whiteBlockM=():THREE.Material=>get('blocoBranco',()=>matte({map:blockTex('#e9e8e3','#c3c1ba'),side:THREE.DoubleSide}));
const roughM=():THREE.Material=>get('chapisco',()=>matte({map:canvasTex(128,128,(c,w,h)=>{c.fillStyle='#a8a296';c.fillRect(0,0,w,h);
  for(let i=0;i<3000;i++){const v=(i*41)%70;c.fillStyle=`rgb(${120+v},${116+v},${106+v})`;c.fillRect((i*67)%w,(i*31+i*7)%h,2,2);}}),side:THREE.DoubleSide}));
const graniteM=():THREE.Material=>get('granito',()=>matte({map:canvasTex(64,128,(c,w,h)=>{c.fillStyle='#8d8f90';c.fillRect(0,0,w,h);
  for(let i=0;i<1400;i++){const v=(i*53)%120;c.fillStyle=`rgb(${80+v},${82+v},${84+v})`;c.fillRect((i*17)%w,(i*29+i*3)%h,2,2);}
  c.fillStyle='#e4e3de';c.fillRect(0,0,6,h);c.fillRect(w-6,0,6,h);})}));
const terraM=():THREE.Material=>get('terra',()=>matte({color:0xb0674a,map:canvasTex(64,64,(c,w,h)=>{c.fillStyle='#e4e4e4';c.fillRect(0,0,w,h);
  for(let i=0;i<500;i++){const v=180+(i*37)%70;c.fillStyle=`rgb(${v},${v},${v})`;c.fillRect((i*13)%w,(i*29+i)%h,2,2);}}),polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));
const corrM=(c:string):THREE.Material=>get('corr'+c,()=>matte({color:c,side:THREE.DoubleSide,map:canvasTex(64,16,(x,w,h)=>{
  for(let i=0;i<w;i++){const v=200+Math.round(40*Math.sin(i/w*Math.PI*8));x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(i,0,1,h);}})}));
const rollM=():THREE.Material=>get('roll',()=>matte({map:canvasTex(64,128,(c,w,h)=>{c.fillStyle='#b9bcbd';c.fillRect(0,0,w,h);c.fillStyle='#8e9193';for(let y=0;y<h;y+=5)c.fillRect(0,y,w,1.5);})}));
// chain-link fence: the diamond mesh (alpha-tested), 1 texture = the whole panel
const chainM=():THREE.Material=>get('alambrado',()=>matte({color:0xb7bcbf,alphaTest:.5,side:THREE.DoubleSide,map:canvasTex(256,64,(c,w,h)=>{
  c.clearRect(0,0,w,h);c.strokeStyle='#ffffff';c.lineWidth=1.2;
  for(let x=-h;x<w+h;x+=6){c.beginPath();c.moveTo(x,0);c.lineTo(x+h,h);c.stroke();c.beginPath();c.moveTo(x+h,0);c.lineTo(x,h);c.stroke();}
  c.fillRect(0,0,w,2);c.fillRect(0,h-2,w,2);})}));
const warnM=():THREE.Material=>get('warn',()=>matte({map:canvasTex(128,128,(c,w,h)=>{c.fillStyle='#f2c418';c.fillRect(0,0,w,h);
  c.strokeStyle='#111';c.lineWidth=6;c.strokeRect(6,6,w-12,h-12);c.fillStyle='#111';c.beginPath();c.arc(w/2,h*.3,9,0,Math.PI*2);c.fill();
  c.fillRect(w/2-6,h*.38,12,h*.3);c.fillRect(w/2-20,h*.72,40,6);})}));

export default {category:'Divinolândia',label:'Entorno do Monumento ao Ciclista',build};
