import * as THREE from 'three';
import {matte} from '../matte.ts';
import {drape,type GroundAt,type P2} from './praca-chao.ts';
import {flat,walls,face,onFace,opening,glassM,darkM,signMat,canvasTex,block,hipRoofQuad,hPoly,pointInPoly,apron,
  corrugated,solarArray,latticeRail,type Face} from './posto-kit.ts';
import {makeGoal} from './praca.ts';
import ArvoreRua from './arvore-rua.ts';
import ArvorePraca from './arvore-praca.ts';
import Palmeira from './palmeira-fenix.ts';

// The town's public buildings and grounds, rebuilt from Google Street View and the gridded
// satellite (captures pub-*, pub2-*, sat-pub-* in docs/divinolandia/referencias-*, local):
// Centro de Saúde III, the Oftalmologia clinic of the hospital, the Congregação Cristã no
// Brasil, the Centro Espírita Allan Kardec, the Igreja de São Sebastião, the Polícia
// Militar post and the Piscina Municipal beside it, the Delegacia de Polícia Civil, the
// E.E. Dep. Vicente Nasser, the Estádio Municipal Armando Grespan and the Cemitério
// Municipal. Each entry is built in TOWN-LOCAL metres (x east, z south) shifted by its
// origin, on groundAt(x,z) = the terrain relative to the ground at the origin (as the fuel
// stations); `foot` = collision boxes [x, z, w, d, rot, height] (town-local).
// Not a single model: no default export (each entry's build() is pure).
export type Solid=[number,number,number,number,number,number];
export interface Publico{id:string;nome:string;origin:P2;build:(at:GroundAt)=>THREE.Group;foot:Solid[]}

const tex=new Map<string,THREE.Material>();
const T=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=tex.get(k);if(!m){m=f();tex.set(k,m);}return m;};
const telha=(c='#b0603f'):string=>c;
// a rectangle (centre, width along the angle a, depth across it) as its 4 corners
export function rect(cx:number,cz:number,w:number,d:number,a:number):P2[]{
  const c=Math.cos(a),s=Math.sin(a);
  return[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>[cx+u*w/2*c-v*d/2*s,cz+u*w/2*s+v*d/2*c] as P2);
}
const cen=(p:P2[]):P2=>[p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];
const solidOf=(p:P2[],h:number):Solid=>{const[c0,c1,,c3]=p,w=Math.hypot(c1[0]-c0[0],c1[1]-c0[1]),d=Math.hypot(c3[0]-c0[0],c3[1]-c0[1]),[x,z]=cen(p);
  return[x,z,w,d,Math.atan2(c1[1]-c0[1],c1[0]-c0[0]),h];};
// group shifted to the origin
function root(o:P2):{r:THREE.Group;g:THREE.Group}{const r=new THREE.Group(),g=new THREE.Group();g.position.set(-o[0],0,-o[1]);r.add(g);return{r,g};}

// A one- or two-storey masonry building on a sloping lot: walls from below the lowest
// ground to the eave, a dark plinth, an optional painted stripe, and a roof (clay hip
// following the quad, or a flat slab behind a parapet). Returns the floor height and the
// eave, plus the face of each wall (seen from outside) for the openings and signs.
function building(g:THREE.Group,at:GroundAt,P:P2[],o:{h:number;wall:string;plinth?:string;plinthH?:number;stripe?:{c:string;y:number;h:number}[];
  roof:'hip'|'flat'|'none';tile?:string;rise?:number;parapet?:string;fascia?:string;floor?:number}):{y0:number;eave:number;F:Face[]}{
  const ins=cen(P),lo=Math.min(...P.map(p=>at(...p))),hi=Math.max(...P.map(p=>at(...p)));
  const y0=o.floor??hi+.15,eave=y0+o.h;
  walls(g,P,lo-.6,eave,flat(o.wall),1,ins);
  const F=P.map((a,i)=>face(a,P[(i+1)%P.length],ins));
  if(o.plinth)for(const f of F)onFace(g,f,flat(o.plinth),f.len/2,lo-.6,f.len+.02,y0-lo+.6+(o.plinthH??.5),.012);
  for(const st of o.stripe??[])for(const f of F)onFace(g,f,flat(st.c),f.len/2,y0+st.y,f.len+.02,st.h,.016);
  if(o.roof==='hip'){
    // (hipRoofQuad wants the short ends first)
    const ab=Math.hypot(P[1][0]-P[0][0],P[1][1]-P[0][1]),bc=Math.hypot(P[2][0]-P[1][0],P[2][1]-P[1][1]);
    const Q=ab<=bc?P:[P[1],P[2],P[3],P[0]];
    hipRoofQuad(g,Q,eave,o.rise??Math.min(3.2,Math.min(ab,bc)*.22),telha(o.tile),.6);
    if(o.fascia)for(const f of F)onFace(g,f,flat(o.fascia),f.len/2,eave-.32,f.len+1.2,.3,.6,.05);
  }else if(o.roof==='flat'){
    const pc=o.parapet??o.wall;walls(g,P,eave,eave+.9,flat(pc),1,ins);
    g.add(hPoly(P,eave+.35,flat('#9e9b94')));
    for(const f of F)onFace(g,f,flat('#d9d6cf'),f.len/2,eave+.9,f.len+.1,.07,.03,.08);
  }
  return{y0,eave,F};
}
// a row of barred windows / doors along a face
function windowsAlong(g:THREE.Group,f:Face,y:number,xs:number[],w:number,h:number,grille=true,frame='#f2f2ee'):void{
  for(const s of xs){opening(g,f,s,y,w,h,{fill:glassM(),frame,panes:2});
    if(grille)for(let k=1;k<6;k++)onFace(g,f,flat(frame),s-w/2+k*w/6,y,.025,h,.07,.02);}
}
// a picket fence on a low wall from a to b (posts, rails, close white bars)
function fence(g:THREE.Group,at:GroundAt,a:P2,b:P2,o:{wall:string;wallH:number;bars:string;barH:number}):void{
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(L/2.5);
  for(let i=0;i<n;i++){
    const t0=i/n,t1=(i+1)/n,x0=a[0]+(b[0]-a[0])*t0,z0=a[1]+(b[1]-a[1])*t0,x1=a[0]+(b[0]-a[0])*t1,z1=a[1]+(b[1]-a[1])*t1;
    const xm=(x0+x1)/2,zm=(z0+z1)/2,y=at(xm,zm),seg=L/n,ry=-Math.atan2(z1-z0,x1-x0);
    const w=new THREE.Mesh(new THREE.BoxGeometry(seg,o.wallH+.4,.22),flat(o.wall));w.position.set(xm,y+o.wallH/2-.2,zm);w.rotation.y=ry;g.add(w);
    const bars=new THREE.Mesh(new THREE.PlaneGeometry(seg,o.barH),T('pick'+o.bars,()=>matte({color:o.bars,alphaTest:.5,side:THREE.DoubleSide,
      map:canvasTex(64,64,(c,W,H)=>{c.clearRect(0,0,W,H);c.fillStyle='#fff';for(let k=0;k<8;k++)c.fillRect(k*8+2,0,3,H);c.fillRect(0,4,W,4);c.fillRect(0,H-8,W,4);})})));
    const uv=bars.geometry.getAttribute('uv') as THREE.BufferAttribute;for(let k=0;k<uv.count;k++)uv.setX(k,uv.getX(k)*seg/.8);
    bars.position.set(xm,y+o.wallH+o.barH/2,zm);bars.rotation.y=ry;g.add(bars);
    const post=new THREE.Mesh(new THREE.BoxGeometry(.12,o.barH+.1,.12),flat(o.bars));post.position.set(x0,at(x0,z0)+o.wallH+o.barH/2,z0);g.add(post);
  }
}
// lettering painted straight on a wall (transparent canvas)
function letters(lines:string[],c:string,font='900 64px Arial',w=1024,h=128):THREE.Material{
  return T('let'+lines.join('|')+c+font,()=>matte({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,
    map:canvasTex(w,h,(x,W,H)=>{x.clearRect(0,0,W,H);x.fillStyle=c;x.font=font;x.textAlign='center';x.textBaseline='middle';
      lines.forEach((l,i)=>x.fillText(l,W/2,H*(i+.5)/lines.length));})}));
}
const tree=(g:THREE.Group,at:GroundAt,x:number,z:number,kind:'ficus'|'reseda'|'resedaBranca'|'palmeira'|'copa'|'ipe'|'cipreste',s=1):void=>{
  const t=kind==='copa'||kind==='ipe'||kind==='cipreste'?ArvorePraca.build({kind,r:kind==='copa'?5*s:2.5*s,h:8*s,seed:Math.round(x*7+z)}):ArvoreRua.build({kind});
  if(kind!=='copa'&&kind!=='ipe'&&kind!=='cipreste')t.scale.setScalar(s);t.position.set(x,at(x,z)-.05,z);t.rotation.y=x+z;g.add(t);
};

// ============================== Centro de Saúde III ==============================
// Rua Sete de Setembro × Rua Joaquim Garcia: a long single-storey clinic in mid-blue
// render with the white/red stripe, white eaves under a clay hip roof, the recessed entry
// under the blue name board (UBS · Centro de Saúde III Divinolândia "Dona Zula"), barred
// windows, the white picket fence on a blue wall along the street, bins, a public phone.
const SAUDE:P2[]=[[177.8,87.9],[214.9,94.5],[212.4,108.9],[175.3,102.3]];
const saude:Publico={id:'saude3',nome:'Centro de Saúde III',origin:[195,98],foot:[solidOf(SAUDE,5.5)],build(at){
  const{r,g}=root([195,98]);
  const{y0,eave,F}=building(g,at,SAUDE,{h:3.3,wall:'#6f86c6',plinth:'#5d71aa',plinthH:.4,stripe:[{c:'#f2f2ee',y:1.1,h:.1},{c:'#c9504a',y:1.2,h:.08},{c:'#f2f2ee',y:1.28,h:.06}],
    roof:'hip',rise:2.6,fascia:'#f2f2ee'});
  const N=F[0];                                                 // the street front (north), left = west
  windowsAlong(g,N,y0+1.4,[3.2,22,27,34.5],2,1.25);              // (sills just over the stripe)
  onFace(g,N,darkM(),9.5,y0,5.2,2.9,-1.6);                      // the recessed entrance hall
  opening(g,N,9,y0,1.8,2.4,{fill:glassM(),frame:'#3a3c3e',panes:2});
  onFace(g,N,signMat(['UNIDADE BÁSICA DE SAÚDE DA FAMÍLIA','CENTRO DE SAÚDE III DIVINOLÂNDIA','Isolina G. Manzoni · "Dona Zula"'],{bg:'#1f3a7a',fg:'#ffffff',w:768,h:160}),10,eave-.75,7,.7,.06,.04);
  onFace(g,N,signMat(['SUS'],{bg:'#ffffff',fg:'#1f3a7a',w:128,h:96}),5.6,eave-.75,1,.7,.06,.04);
  for(const f of[F[1],F[3]])windowsAlong(g,f,y0+1.4,[f.len/2-3,f.len/2+3],1.6,1.2);
  windowsAlong(g,F[2],y0+1.4,[4,12,20,28],1.6,1.2);
  // the fence 4 m out on the street, a gate at the entrance; bins, the phone
  const out=(s:number,o:number):P2=>{const[x,,z]=N.at(s,0,o);return[x,z];};
  fence(g,at,out(-.5,4.2),out(7,4.2),{wall:'#5d71aa',wallH:.55,bars:'#f2f2ee',barH:1.15});
  fence(g,at,out(11.5,4.2),out(37.6,4.2),{wall:'#5d71aa',wallH:.55,bars:'#f2f2ee',barH:1.15});
  apron(g,at,[out(7,0),out(11.5,0),out(11.5,4.4),out(7,4.4)]);
  for(const[k,c]of['#2f8a4e','#d9b82c','#d9b82c'].entries()){const[x,z]=out(14+k*.7,1.5);block(g,flat(c),x,at(x,z),z,.6,1.05,.6,N.ry);}
  {const[x,z]=out(20,1);const p=new THREE.Mesh(new THREE.SphereGeometry(.45,10,6,0,Math.PI*2,0,Math.PI/2),flat('#5e8ec6'));p.position.set(x,at(x,z)+2.1,z);p.rotation.x=Math.PI/2.2;g.add(p);
    block(g,flat('#7a7d80'),x,at(x,z),z,.08,1.9,.08);}
  for(const[s,c]of[[24,'#e57a2a'],[29,'#f0c22a']] as [number,string][]){const[x,z]=out(s,6.5);const t=ArvoreRua.build({kind:'reseda'});
    t.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&(m.material as THREE.MeshLambertMaterial).color?.getHexString()!=='6e5a48')m.material=flat(c);});t.position.set(x,at(x,z),z);g.add(t);}
  return r;}};

// ============================== Clínica de Oftalmologia ==============================
// in the hospital grounds: a long low clinic in pale blue under a flat roof behind a thick
// light-grey parapet band, dark window bands, the inner courtyard, rows of solar panels
const OFT:P2[]=[[-325,781.3],[-268.6,756.9],[-278,735.1],[-334.4,759.5]];
const oftalmo:Publico={id:'oftalmo',nome:'Clínica de Oftalmologia',origin:[-301.5,758.2],foot:[solidOf(OFT,5.5)],build(at){
  const{r,g}=root([-301.5,758.2]);
  const{y0,eave,F}=building(g,at,OFT,{h:3.4,wall:'#b8d2e6',plinth:'#8ca8bf',plinthH:.3,roof:'flat',parapet:'#d8dad9'});
  for(const f of[F[0],F[2]])for(let s=3;s<f.len-3;s+=5.2)opening(g,f,s,y0+.8,2.8,1.4,{fill:darkM(),frame:'#4a5a66',panes:2});
  for(const f of[F[1],F[3]])opening(g,f,f.len/2,y0,2.2,2.5,{fill:glassM(),frame:'#4a5a66',panes:2});
  // the courtyard (a hole of grass in the roof) and the PV rows, set out along the long side
  const c=cen(OFT),a=Math.atan2(OFT[1][1]-OFT[0][1],OFT[1][0]-OFT[0][0]);
  const court=rect(c[0]+2,c[1]-1,16,7,a);g.add(hPoly(court,eave+.37,flat('#6f8a4a')));
  const pv=new THREE.Group();pv.position.set(c[0],0,c[1]);pv.rotation.y=-a;g.add(pv);solarArray(pv,-26,-8,-9,1,eave+.3);solarArray(pv,12,24,-9,1,eave+.3);
  return r;}};

// ============================== Congregação Cristã no Brasil ==============================
// Rua Sebastião Moreira da Silva 59: the white church high on a podium — a stone-clad
// retaining wall at the street with the gate "59", white railings round the terrace —
// the tall nave with two rows of round-headed windows, its gable front to the street
// carrying CONGREGAÇÃO CRISTÃ NO BRASIL, a clay gable roof; palms and cypresses round it
const CCB:P2[]=[[-421.2,-53.3],[-411.9,-47.9],[-421.8,-31.1],[-431.1,-36.5]];
const congregacao:Publico={id:'congregacao',nome:'Congregação Cristã no Brasil',origin:[-421.5,-42.2],foot:[solidOf(CCB,10)],build(at){
  const{r,g}=root([-421.5,-42.2]);
  const hi=Math.max(...CCB.map(p=>at(...p)))+.15,podium=hi+1.8;
  const{eave,F}=building(g,at,CCB,{h:6.2,wall:'#f3f2ee',roof:'none',floor:podium});
  // gable roof along the long axis (ridge from the front to the back)
  const A=CCB[0],B=CCB[1],C=CCB[2],D=CCB[3],mid=(p:P2,q:P2):P2=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
  const rise=3.2,ov=.5;
  const ext=(p:P2,from:P2):P2=>{const dx=p[0]-from[0],dz=p[1]-from[1],l=Math.hypot(dx,dz);return[p[0]+dx/l*ov,p[1]+dz/l*ov];};
  const quad=(p:P2,q:P2,rr1:P2,rr2:P2):void=>{const pos=[p[0],eave,p[1],q[0],eave,q[1],rr2[0],eave+rise,rr2[1],p[0],eave,p[1],rr2[0],eave+rise,rr2[1],rr1[0],eave+rise,rr1[1]];
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,6,0,6,4,0,0,6,4,0,4],2));geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,T('ccbRoof',()=>matte({color:'#c2563c',side:THREE.DoubleSide})));m.castShadow=true;g.add(m);};
  const cA=ext(A,cen(CCB)),cB=ext(B,cen(CCB)),cC=ext(C,cen(CCB)),cD=ext(D,cen(CCB));
  quad(cA,cD,mid(cA,cB),mid(cD,cC));quad(cC,cB,mid(cD,cC),mid(cA,cB));
  // the gable triangles at both ends
  for(const[p,q]of[[A,B],[C,D]] as [P2,P2][]){const m=mid(p,q),sh=new THREE.BufferGeometry();
    sh.setAttribute('position',new THREE.Float32BufferAttribute([p[0],eave,p[1],q[0],eave,q[1],m[0],eave+rise,m[1]],3));sh.computeVertexNormals();
    g.add(new THREE.Mesh(sh,T('ccbGable',()=>matte({color:'#f3f2ee',side:THREE.DoubleSide}))));}
  const front=F[0];                                             // the gable front, to the street (north)
  onFace(g,front,letters(['CONGREGAÇÃO CRISTÃ NO BRASIL'],'#2a2a2a','700 54px Georgia, serif'),front.len/2,eave-.9,front.len-.6,.7,.03);
  onFace(g,front,flat('#e4e2dc'),front.len/2,eave-.15,front.len+.3,.25,.05,.25);           // cornice
  for(const s of[2,4.2,6.4])opening(g,front,s,podium+3.1,.8,1.5,{fill:glassM(),frame:'#f2f2ee'});
  for(const s of[1.5,3.2,5,6.8])opening(g,front,s,podium+.9,.9,1.6,{fill:glassM(),frame:'#f2f2ee'});
  for(const f of[F[1],F[3]])for(let s=1.6;s<f.len-1;s+=2.6){opening(g,f,s,podium+.9,.9,1.7,{fill:glassM(),frame:'#f2f2ee'});opening(g,f,s,podium+3.4,.8,1.4,{fill:glassM(),frame:'#f2f2ee'});}
  // podium: stone-clad wall at the street, the gate, the terrace with railings
  const stone=T('ccbStone',()=>matte({color:'#d8c3a0',map:canvasTex(128,128,(x,W,H)=>{x.fillStyle='#e6d6b8';x.fillRect(0,0,W,H);
    for(let j=0;j<8;j++)for(let i=0;i<4;i++){x.fillStyle=`rgb(${210+((i*7+j*3)%5)*6},${190+((i+j)%4)*6},${150+((i*3+j)%5)*6})`;x.fillRect(i*32+(j%2)*16+1,j*16+1,30,14);}})}));
  const ftr=face(CCB[0],CCB[1],cen(CCB));
  const wallTop=podium-.05,base=Math.min(...CCB.map(p=>at(...p)))-.4;
  onFace(g,ftr,stone,ftr.len/2,base,ftr.len+5,wallTop-base,3.2,.3);
  onFace(g,ftr,flat('#cfcac0'),ftr.len/2+2.4,base,1.2,wallTop-base+.6,3.25,.4);       // gate pillars
  onFace(g,ftr,T('gate59',()=>matte({color:'#f2f2ee',alphaTest:.5,side:THREE.DoubleSide,map:canvasTex(64,64,(x,W,H)=>{x.clearRect(0,0,W,H);x.fillStyle='#fff';for(let k=0;k<8;k++)x.fillRect(k*8+2,0,3,H);x.fillRect(0,0,W,5);x.fillRect(0,H-5,W,5);})})),
    ftr.len/2+4.4,base+.1,1.6,2.2,3.48);
  onFace(g,ftr,signMat(['59'],{bg:'#f2f2ee',fg:'#1d1d1d',w:96,h:64}),ftr.len/2+5.6,base+2.5,.5,.32,3.46,.02);
  latticeRail(g,ftr,-2,ftr.len+2.5,wallTop,1.1,3.0,'#f2f2ee');
  apron(g,at,[ftr.at(-2.5,0,3.3),ftr.at(ftr.len+2.5,0,3.3),ftr.at(ftr.len+2.5,0,0),ftr.at(-2.5,0,0)].map(([x,,z])=>[x,z] as P2));
  for(const[s,o]of[[-1.5,-3],[-1.5,-9],[ftr.len+1.6,-6]] as [number,number][]){const[x,,z]=ftr.at(s,0,o);const p=Palmeira.build({h:4.5,seed:Math.round(x)});p.scale.setScalar(1.4);p.position.set(x,podium,z);g.add(p);}
  for(const o of[-12,-15]){const[x,,z]=ftr.at(ftr.len+1.5,0,o);const t=ArvorePraca.build({kind:'cipreste',h:7,seed:Math.round(x)});t.position.set(x,podium,z);g.add(t);}
  return r;}};

// ============================== Centro Espírita "Allan Kardec" ==============================
// Rua Stello Loureiro Machado: a small white hall with grey pilasters, its parapet stepped
// up into a scalloped central gable crowned with clay ridge tiles, the name painted in
// black on the gable, a door with a fanlight and two round-headed barred windows, a grey
// plinth; a lower white wing with a cobogó panel to the right
const ESP:P2[]=[[687.6,-39.5],[695.6,-38],[693,-23.7],[685,-25.2]];
const espirita:Publico={id:'espirita',nome:'Centro de Estudos Espírita Vinha do Senhor Allan Kardec',origin:[690.3,-31.6],foot:[solidOf(ESP,6.5)],build(at){
  const{r,g}=root([690.3,-31.6]);
  const{y0,eave,F}=building(g,at,ESP,{h:4.4,wall:'#efede7',plinth:'#bfc1c0',plinthH:.4,roof:'flat',parapet:'#efede7'});
  const f=F[0];                                                 // the street front (north)
  for(const s of[.15,2.3,5.8,f.len-.15])onFace(g,f,flat('#c9cbcb'),s,y0-.4,.35,eave-y0+1.3,.04,.08);
  // the stepped scalloped gable over the middle
  const sh=new THREE.Shape([new THREE.Vector2(-1.75,0),new THREE.Vector2(1.75,0),new THREE.Vector2(1.75,.9),new THREE.Vector2(1.2,1.25)]);
  sh.absarc(0,1.25,1.2,0,Math.PI,false);sh.lineTo(-1.75,.9);sh.closePath();
  const gm=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{depth:.25,bevelEnabled:false,curveSegments:10}),flat('#efede7'));
  const[gx,,gz]=f.at(4.05,0,-.1);gm.position.set(gx,eave+.9,gz);gm.rotation.y=f.ry;g.add(gm);
  for(let k=0;k<9;k++){const a=k/8*Math.PI,[x,,z]=f.at(4.05+Math.cos(a)*1.25,0,.02);const t=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.32,6),flat('#b0603f'));
    t.position.set(x,eave+.9+1.25+Math.sin(a)*1.25+.05,z);t.rotation.set(Math.PI/2,0,f.ry+a,'YXZ');g.add(t);}
  for(const[s0,s1]of[[0,2.3],[5.8,f.len]] as [number,number][])for(let s=s0+.2;s<s1;s+=.33){const[x,,z]=f.at(s,0,.02);const t=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.3,6),flat('#b0603f'));
    t.position.set(x,eave+.97,z);t.rotation.set(0,f.ry,Math.PI/2,'YXZ');g.add(t);}
  onFace(g,f,letters(['CENTRO ESTUDOS ESPÍRITA','VINHA DO SENHOR','"ALLAN KARDEC"'],'#1d1d1d','italic 900 40px Arial',512,192),4.05,eave-.5,3.2,1.2,.05);
  opening(g,f,4.05,y0,1.15,2.6,{fill:T('espDoor',()=>matte({color:'#e9e9e4'})),frame:'#cfcfca',panes:2});
  for(const s of[1.2,7])opening(g,f,s,y0+.9,.8,1.45,{fill:glassM(),frame:'#f2f2ee'});
  return r;}};

// ============================== Igreja de São Sebastião ==============================
// beside the Praça Pedro Ribeiro de Paiva: a pink nave under a corrugated-steel barrel
// vault, pointed lancet windows with iron grilles down both sides, the lower curved
// porch at the east end, the door and the cross at the west end; a tube fence along the
// street and young resedás
const SSB:P2[]=[[583.9,334],[603.6,323.4],[596.7,310.4],[577,321]];
const saoSebastiao:Publico={id:'saosebastiao',nome:'Igreja de São Sebastião',origin:[590.3,322.2],foot:[solidOf(SSB,7.5)],build(at){
  const{r,g}=root([590.3,322.2]);
  const{y0,eave,F}=building(g,at,SSB,{h:4.2,wall:'#e6bdb4',plinth:'#c7a49c',plinthH:.3,roof:'none'});
  // barrel vault along the long axis
  const[c0,c1,,c3]=SSB,L=Math.hypot(c1[0]-c0[0],c1[1]-c0[1]),W=Math.hypot(c3[0]-c0[0],c3[1]-c0[1]),a=Math.atan2(c1[1]-c0[1],c1[0]-c0[0]),[cx,cz]=cen(SSB);
  const vault=new THREE.Mesh(new THREE.CylinderGeometry(W/2+.4,W/2+.4,L+.8,24,1,true,-Math.PI/2,Math.PI),corrugated('#a9adb0'));
  vault.rotation.set(0,-a,Math.PI/2,'YXZ');vault.scale.set(.55,1,1);vault.position.set(cx,eave,cz);vault.castShadow=true;g.add(vault);
  for(const s of[-1,1]){const end=new THREE.Mesh(new THREE.CircleGeometry(W/2,20,0,Math.PI),flat('#e6bdb4'));
    end.scale.set(1,.55,1);end.position.set(cx+Math.cos(a)*s*L/2,eave,cz+Math.sin(a)*s*L/2);end.rotation.y=-a+Math.PI/2+(s>0?0:Math.PI);g.add(end);}
  // lancet windows down both long sides
  const lancet=(f:Face,s:number):void=>{const sh=new THREE.Shape([new THREE.Vector2(-.4,0),new THREE.Vector2(.4,0),new THREE.Vector2(.4,1.4)]);
    sh.quadraticCurveTo(.35,2,0,2.3);sh.quadraticCurveTo(-.35,2,-.4,1.4);sh.closePath();
    const m=new THREE.Mesh(new THREE.ShapeGeometry(sh,6),T('lancet',()=>matte({color:'#2a2522',side:THREE.DoubleSide})));const[x,,z]=f.at(s,0,.03);m.position.set(x,y0+1,z);m.rotation.y=f.ry;g.add(m);
    for(let k=1;k<4;k++)onFace(g,f,flat('#6a6460'),s,y0+1+k*.5,.8,.03,.05,.02);};
  for(const f of[F[0],F[2]])for(let s=2.2;s<f.len-1;s+=3)lancet(f,s);
  // west end: the door and the cross; east end: the low curved porch
  const wE=F[3];opening(g,wE,wE.len/2,y0,1.6,2.6,{fill:T('ssbDoor',()=>matte({color:'#6a4630'})),frame:'#e6dcd2',panes:2});
  {const[x,,z]=wE.at(wE.len/2,0,.2);block(g,flat('#f2f2ee'),x,eave+W*.28,z,.12,1.6,.12);block(g,flat('#f2f2ee'),x,eave+W*.28+1,z,.9,.12,.12,wE.ry);}
  const eE=F[1],por=new THREE.Mesh(new THREE.CylinderGeometry(3,3,6,16,1,true,-Math.PI/2,Math.PI),corrugated('#b7babc'));
  {const[x,,z]=eE.at(eE.len/2,0,2);por.rotation.set(0,-a,Math.PI/2,'YXZ');por.scale.set(.35,1,1);por.position.set(x,y0+2.7,z);g.add(por);
    for(const k of[-1,1]){const[px,,pz]=eE.at(eE.len/2+k*2.6,0,3.6);block(g,flat('#d9d6cf'),px,at(px,pz),pz,.25,y0+2.7-at(px,pz),.25);}}
  return r;}};

// ============================== Polícia Militar + Piscina Municipal ==============================
// Rua Lourival de Medeiros: the PM post — grey render with the red stripe over a dark-grey
// base, the grey board POLÍCIA MILITAR · 190 with the SP checkerboard, a barred window,
// the grille door, a garage door, clay roof. To its west the municipal pool's front wall:
// blue below, white above with the red-and-white zigzag band and PISCINA MUNICIPAL, white
// louvred doors, phoenix palms in a blue planter; the pool behind its wall.
const ROAD_T:P2=[.963,-.269],ROAD_N:P2=[.269,.963];              // along the street (east), toward the lots (south)
const onRoad=(s:number,o:number):P2=>[1018.1+ROAD_T[0]*s+ROAD_N[0]*o,-128+ROAD_T[1]*s+ROAD_N[1]*o];
const RA=Math.atan2(ROAD_T[1],ROAD_T[0]);
const PMP=((c:P2)=>rect(c[0],c[1],15,10,RA))(onRoad(10,6.1+5));
const PISC=((c:P2)=>rect(c[0],c[1],18,6,RA))(onRoad(-7.5,6.1+3));
const POOL=((c:P2)=>rect(c[0],c[1],25,12,RA))(onRoad(-7.5,6.1+17));
const pm:Publico={id:'pm',nome:'Polícia Militar e Piscina Municipal',origin:onRoad(0,8),foot:[solidOf(PMP,5),solidOf(PISC,5),solidOf(rect(...onRoad(-7.5,6.1+17),26,13,RA),1.9)],build(at){
  const{r,g}=root(onRoad(0,8));
  {const{y0,eave,F}=building(g,at,PMP,{h:3.2,wall:'#8d9195',plinth:'#3a3c3f',plinthH:1.05,stripe:[{c:'#d9534a',y:1.05,h:.32}],roof:'hip',tile:'#b0603f',rise:2});
    const f=F[0];                                               // the street front, left = west
    onFace(g,f,T('pmSign',()=>matte({map:canvasTex(1024,128,(x,W,H)=>{x.fillStyle='#55595d';x.fillRect(0,0,W,H);x.fillStyle='#f2f2ee';x.font='800 58px Arial';x.textBaseline='middle';
      x.fillText('POLÍCIA MILITAR',30,H/2);x.fillText('☎ 190',500,H/2);for(let i=0;i<6;i++)for(let j=0;j<3;j++){x.fillStyle=(i+j)%2?'#d23a3a':'#222';x.fillRect(680+i*22,30+j*22,20,20);}
      x.fillStyle='#fff';x.font='800 34px Arial';x.fillText('SÃO PAULO',880,H/2);})})),6.2,eave-1.2,9.8,.95,.04,.04);
    opening(g,f,3.3,y0+1.25,.9,.9,{fill:glassM(),frame:'#6a6e72'});
    opening(g,f,7.8,y0+1.42,2,1.2,{fill:glassM(),frame:'#6a6e72',panes:3});
    opening(g,f,10.7,y0,1.6,2.6,{fill:T('pmGrille',()=>matte({color:'#cfd2d4',alphaTest:.5,side:THREE.DoubleSide,map:canvasTex(64,64,(x,W,H)=>{x.clearRect(0,0,W,H);x.fillStyle='#fff';for(let k=0;k<8;k++){x.fillRect(k*8,0,2,H);x.fillRect(0,k*8,W,2);}})})),frame:'#9a9c9e'});
    onFace(g,f,darkM(),10.7,y0,1.5,2.5,-.3);
    opening(g,f,13.6,y0,2.4,2.8,{fill:T('pmGarage',()=>matte({color:'#a4a7a9',map:canvasTex(64,64,(x,W,H)=>{x.fillStyle='#d9d9d9';x.fillRect(0,0,W,H);x.fillStyle='#9a9a9a';for(let k=0;k<W;k+=6)x.fillRect(k,0,2,H);})})),frame:'#7a7d80'});
  }
  {const{y0,eave,F}=building(g,at,PISC,{h:3.3,wall:'#f2f1ec',plinth:'#4f6fb8',plinthH:1.6,roof:'hip',tile:'#b0603f',rise:1.4});
    const f=F[0];
    // the red-and-white zigzag band over the blue base
    onFace(g,f,T('zig',()=>matte({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,map:canvasTex(512,64,(x,W,H)=>{x.clearRect(0,0,W,H);
      for(const[c,o]of[['#d9534a',0],['#ffffff',10],['#d9534a',20]] as [string,number][]){x.strokeStyle=c;x.lineWidth=8;x.beginPath();x.moveTo(0,H-8-o);x.lineTo(W*.35,H-8-o);x.lineTo(W*.45,8+o/2);x.lineTo(W*.75,8+o/2);x.lineTo(W*.85,H-8-o);x.lineTo(W,H-8-o);x.stroke();}})})),
      f.len/2,y0+1.25,f.len,1.1,.03);
    onFace(g,f,letters(['PISCINA MUNICIPAL'],'#5e6f5e','800 72px Arial'),f.len/2+1,eave-1.2,12,.95,.04);
    opening(g,f,f.len/2+.4,y0,1.3,2.4,{fill:T('louv',()=>matte({color:'#f4f4f2',map:canvasTex(32,64,(x,W,H)=>{x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#cfcfcf';for(let k=0;k<H;k+=5)x.fillRect(0,k,W,1.5);})})),frame:'#e9e9e6',panes:2});
    const[px,,pz]=f.at(4,0,.55),[qx,,qz]=f.at(f.len-3,0,.55);
    for(const[x,z]of[[px,pz],[qx,qz]] as P2[]){block(g,flat('#4f6fb8'),x,at(x,z)-.2,z,3.6,.75,1,f.ry);
      for(const k of[-1,1]){const[tx,,tz]=[x+Math.cos(-f.ry)*k*1.1,0,z+Math.sin(-f.ry)*k*1.1];const p=Palmeira.build({h:2.4,seed:Math.round(tx)});p.position.set(tx,at(x,z)+.5,tz);g.add(p);}}
    // the red bus shelter beside it
    {const[x,,z]=f.at(f.len+2.2,0,.9);block(g,flat('#d9534a'),x,at(x,z),z,3.4,2.2,.06,f.ry);block(g,flat('#4f8fd0'),x,at(x,z)+2.2,z,3.6,.08,1.2,f.ry);}   // (on the sidewalk)
  }
  // the pool behind its wall: blue water, white tiled edge
  const lo=Math.min(...POOL.map(p=>at(...p)));
  g.add(hPoly(POOL,lo+.2,flat('#e9e9e4')));
  const water=rect(...onRoad(-7.5,6.1+17),21,8.5,RA);g.add(hPoly(water,lo+.24,T('pool',()=>matte({color:'#4fb0d8',emissive:0x0b2a3a}))));
  walls(g,rect(...onRoad(-7.5,6.1+17),26,13,RA),lo-.4,lo+1.9,flat('#e9e9e4'),1);
  return r;}};

// ============================== Delegacia de Polícia Civil ==============================
// on the Rua Barão do Rio Branco by the Praça da Matriz: a white single-storey station with
// the red stripe over a dark base, the long black fascia board POLÍCIA · Delegacia de
// Polícia de Divinolândia with the badge, the sloping paved forecourt behind a chain-link
// fence and gate, the black POLÍCIA CIVIL totem at the corner, a patrol car
const DEL:P2=[-59,9];
const DELP=rect(DEL[0],DEL[1],18,20,Math.PI/2+.174);
const delegacia:Publico={id:'delegacia',nome:'Delegacia de Polícia Civil',origin:DEL,foot:[solidOf(DELP,5)],build(at){
  const{r,g}=root(DEL);
  const{y0,eave,F}=building(g,at,DELP,{h:3.4,wall:'#f2f1ec',plinth:'#2c2e31',plinthH:.95,stripe:[{c:'#c9504a',y:.95,h:.12}],roof:'hip',tile:'#a9573c',rise:2.2});
  // the street front is the face nearest the Barão (east)
  const f=F.reduce((b,q)=>{const[x]=q.at(q.len/2,0);const[bx]=b.at(b.len/2,0);return x>bx?q:b;});
  onFace(g,f,T('delSign',()=>matte({map:canvasTex(1024,96,(x,W,H)=>{x.fillStyle='#141416';x.fillRect(0,0,W,H);x.fillStyle='#c9a23a';x.beginPath();x.arc(60,H/2,28,0,7);x.fill();
    x.fillStyle='#ffffff';x.font='800 46px Arial';x.textBaseline='middle';x.fillText('POLÍCIA',110,H/2-14);x.font='500 24px Arial';x.fillText('Delegacia de Polícia de Divinolândia',112,H/2+24);})})),
    f.len/2,eave-.2,f.len+.6,.9,.65,.3);
  opening(g,f,4,y0,1.4,2.4,{fill:glassM(),frame:'#2a2a2a',panes:2});
  windowsAlong(g,f,y0+1.1,[9,13.5],1.6,1.2);
  // forecourt, fence, gate, totem, car
  const out=(s:number,o:number):P2=>{const[x,,z]=f.at(s,0,o);return[x,z];};
  apron(g,at,[out(0,0),out(f.len,0),out(f.len,6.5),out(0,6.5)]);
  const chain=T('chainDel',()=>matte({color:0xb7bcbf,alphaTest:.5,side:THREE.DoubleSide,map:canvasTex(128,64,(c,W,H)=>{c.clearRect(0,0,W,H);c.strokeStyle='#fff';c.lineWidth=1.2;
    for(let x=-H;x<W+H;x+=6){c.beginPath();c.moveTo(x,0);c.lineTo(x+H,H);c.stroke();c.beginPath();c.moveTo(x+H,0);c.lineTo(x,H);c.stroke();}})}));
  const[ax,az]=out(7,6.4),[bx,bz]=out(f.len,6.4),L=Math.hypot(bx-ax,bz-az);
  const fe=new THREE.Mesh(new THREE.PlaneGeometry(L,1.6),chain);fe.position.set((ax+bx)/2,at((ax+bx)/2,(az+bz)/2)+.85,(az+bz)/2);fe.rotation.y=f.ry;g.add(fe);
  for(let s=7;s<=f.len+.01;s+=2.2){const[x,z]=out(s,6.4);block(g,flat('#c9ccce'),x,at(x,z),z,.06,1.8,.06);}
  {const[x,z]=out(-1,7);const t=new THREE.Mesh(new THREE.BoxGeometry(.9,3.2,.3),[flat('#151515'),flat('#151515'),flat('#151515'),flat('#151515'),
    signMat(['POLÍCIA','CIVIL'],{bg:'#151515',fg:'#ffffff',w:128,h:384}),signMat(['POLÍCIA','CIVIL'],{bg:'#151515',fg:'#ffffff',w:128,h:384})]);
    t.position.set(x,at(x,z)+1.6,z);t.rotation.y=f.ry;g.add(t);}
  {const[x,z]=out(3.5,3);const car=new THREE.Group();car.position.set(x,at(x,z),z);car.rotation.y=f.ry+Math.PI/2;g.add(car);
    const b=new THREE.Mesh(new THREE.BoxGeometry(4.2,.75,1.75),[flat('#f2f2ee'),flat('#f2f2ee'),flat('#f2f2ee'),flat('#f2f2ee'),
      signMat(['POLÍCIA'],{bg:'#1d1d1d',fg:'#ffffff',w:256,h:48}),signMat(['POLÍCIA'],{bg:'#1d1d1d',fg:'#ffffff',w:256,h:48})]);b.position.y=.65;car.add(b);
    const t=new THREE.Mesh(new THREE.BoxGeometry(2.3,.6,1.6),flat('#1d1d1d'));t.position.set(-.2,1.32,0);car.add(t);
    const lb=new THREE.Mesh(new THREE.BoxGeometry(.25,.1,1.1),flat('#c42b2b'));lb.position.set(-.2,1.67,0);car.add(lb);
    for(const[wx,wz]of[[1.4,.85],[-1.3,.85],[1.4,-.85],[-1.3,-.85]] as P2[]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.22,12),flat('#151515'));w.rotation.x=Math.PI/2;w.position.set(wx,.32,wz);car.add(w);}}
  return r;}};

// ============================== E.E. Dep. Vicente Nasser ==============================
// the state school on the hill south of the centre: the white perimeter wall with the blue
// band, the blue steel gates and E.E. DEP. VICENTE NASSER in blue letters at the entrance
// on the west street; inside, the classroom pavilion turned on its own grid round two
// courtyards, its dark fibre-cement roofs in parallel ridges, and the covered sports court
// with its light metal roof to the east
const VN_OUT:P2[]=[[-18.8,360.5],[-14.3,346.9],[69.2,294.5],[102.4,300.5],[78.6,326.6],[94.6,353.6],[11.7,405.9]];
const VA=Math.atan2(41,52);                                       // the pavilions' grid (satellite)
const VN_MAIN=rect(30,363,56,40,VA),VN_GYM=rect(77,356,30,18,VA+Math.PI/2*0);
const vicente:Publico={id:'vicentenasser',nome:'E.E. Dep. Vicente Nasser',origin:[38,350],foot:[solidOf(VN_MAIN,5),solidOf(VN_GYM,8)],build(at){
  const{r,g}=root([38,350]);
  // perimeter wall with the blue band (the polygon's edges; the north-east one is the gate side)
  const ins=cen(VN_OUT);
  VN_OUT.forEach((a,i)=>{const b=VN_OUT[(i+1)%VN_OUT.length],f=face(a,b,ins),L=f.len;
    for(let s=0;s<L;s+=4){const w=Math.min(4,L-s),[x,,z]=f.at(s+w/2,0,0),y=at(x,z);
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,2.6,.2),flat('#f0efea'));m.position.set(x,y+.9,z);m.rotation.y=f.ry;g.add(m);
      const bl=new THREE.Mesh(new THREE.BoxGeometry(w+.01,.5,.22),flat('#2b4fa0'));bl.position.set(x,y-.1,z);bl.rotation.y=f.ry;g.add(bl);}});
  {const f=face(VN_OUT[0],VN_OUT[1],ins);
    onFace(g,f,letters(['E.E. DEP. VICENTE NASSER'],'#1f3a8a','900 60px Arial'),f.len/2,at(...VN_OUT[0])+1,f.len-1,.9,.12);
    const f2=face(VN_OUT[6],VN_OUT[0],ins);onFace(g,f2,flat('#2b4fa0'),f2.len-8,at(...VN_OUT[0])-.3,5,2.8,.13,.08);}
  // the pavilion: a ring of wings round two courtyards
  const{y0,eave,F}=building(g,at,VN_MAIN,{h:3.4,wall:'#efeee8',plinth:'#2b4fa0',plinthH:.5,roof:'none'});
  for(const f of F)for(let s=2.5;s<f.len-2;s+=3.4)opening(g,f,s,y0+1,2.4,1.3,{fill:glassM(),frame:'#2b4fa0',panes:3});
  const[c0,c1,,c3]=VN_MAIN,ua:P2=[(c1[0]-c0[0])/56,(c1[1]-c0[1])/56],va:P2=[(c3[0]-c0[0])/40,(c3[1]-c0[1])/40];
  const P=(u:number,v:number):P2=>[c0[0]+ua[0]*u+va[0]*v,c0[1]+ua[1]*u+va[1]*v];
  for(let v=2.5;v<40;v+=5){                                       // parallel roof ridges in dark fibre cement
    const a=P(0,v-2.5),b=P(56,v-2.5),c=P(56,v+2.5),d=P(0,v+2.5),ra=P(0,v),rb=P(56,v);
    const pos=[a,b,rb,a,rb,ra,ra,rb,c,ra,c,d].flatMap((p,i)=>[p[0],eave+([2,4,5,6,7,9].includes(i)?.8:0),p[1]]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();
    const m=new THREE.Mesh(geo,T('fibro',()=>matte({color:'#6c6a66',side:THREE.DoubleSide})));m.castShadow=true;g.add(m);
  }
  for(const[u,v,w,d]of[[18,12,12,8],[30,26,10,7]] as [number,number,number,number][]){const q=[P(u,v),P(u+w,v),P(u+w,v+d),P(u,v+d)];
    g.add(hPoly(q,eave+.85,T('court',()=>matte({color:'#7f9a5a',polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}))));}
  // the covered court
  {const lo=Math.min(...VN_GYM.map(p=>at(...p))),hi=Math.max(...VN_GYM.map(p=>at(...p)));
    g.add(hPoly(VN_GYM,hi+.12,flat('#4f7fb0')));walls(g,VN_GYM,lo-.5,hi+.12,flat('#d9d6cf'),1);
    const[g0,g1,,g3]=VN_GYM;for(let k=0;k<=5;k++)for(const sv of[0,1]){const t=k/5,x=g0[0]+(g1[0]-g0[0])*t+(g3[0]-g0[0])*sv,z=g0[1]+(g1[1]-g0[1])*t+(g3[1]-g0[1])*sv;block(g,flat('#8a8d90'),x,hi,z,.25,7,.25);}
    hipRoofQuad(g,[VN_GYM[1],VN_GYM[2],VN_GYM[3],VN_GYM[0]],hi+7,1.6,'#d9dcdd',.5);}   // (short ends first)
  return r;}};

// ============================== Estádio Municipal Armando Grespan ==============================
// the oval pitch inside a dirt running track, the blue concrete grandstand on the west with
// its steel roof on tubular columns, the entrance gate with its two round blue pillars on
// the street, floodlight masts on the east side, the perimeter wall
const EC:P2=[1005,28],ER=40,EH=88;                                // track: centre, half width, half length of the straights
const oval=(rx:number,hl:number,n=48):P2[]=>{const out:P2[]=[];for(let i=0;i<n;i++){const t=i/n*Math.PI*2,top=Math.sin(t)<0;
  out.push([EC[0]+Math.cos(t)*rx,EC[1]+(top?-hl:hl)+Math.sin(t)*rx]);}return out;};
const estadio:Publico={id:'estadio',nome:'Estádio Municipal Armando Grespan',origin:EC,foot:[[952,18.5,8,29,0,6],[950.5,-8.5,2.6,2.6,0,3.5],[950.5,.5,2.6,2.6,0,3.5]],build(at){
  const{r,g}=root(EC);
  const ground=T('track',()=>matte({color:'#b9946c',polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));
  g.add(drape(oval(ER+2,EH-ER),at,.12,ground,[],3));
  g.add(drape(oval(ER-7,EH-ER-2),at,.13,T('pitch',()=>matte({color:'#5d8a3f',map:canvasTex(64,64,(x,W)=>{for(let i=0;i<8;i++){x.fillStyle=i%2?'#d8d8d8':'#f0f0f0';x.fillRect(0,i*8,W,8);}}),
    polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4})),[],3));
  // the white pitch lines: touchlines, halfway line, centre circle, boxes
  const line=T('lineW',()=>matte({color:'#f2f2ee',polygonOffset:true,polygonOffsetFactor:-6,polygonOffsetUnits:-6}));
  const strip=(a:P2,b:P2,w=.12):void=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L*w/2,nz=dx/L*w/2;
    g.add(drape([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],at,.14,line,[],2));};
  const X0=EC[0]-30,X1=EC[0]+30,Z0=EC[1]-50,Z1=EC[1]+50;
  strip([X0,Z0],[X1,Z0]);strip([X1,Z0],[X1,Z1]);strip([X1,Z1],[X0,Z1]);strip([X0,Z1],[X0,Z0]);strip([X0,EC[1]],[X1,EC[1]]);
  for(let i=0;i<24;i++){const a0=i/24*Math.PI*2,a1=(i+1)/24*Math.PI*2;strip([EC[0]+Math.cos(a0)*9.15,EC[1]+Math.sin(a0)*9.15],[EC[0]+Math.cos(a1)*9.15,EC[1]+Math.sin(a1)*9.15]);}
  for(const s of[-1,1]){const zg=s<0?Z0:Z1,zb=zg-s*16.5;strip([EC[0]-20,zg],[EC[0]-20,zb]);strip([EC[0]-20,zb],[EC[0]+20,zb]);strip([EC[0]+20,zb],[EC[0]+20,zg]);
    const gl=makeGoal();gl.position.set(EC[0],at(EC[0],zg)+.14,zg);gl.rotation.y=s<0?0:Math.PI;g.add(gl);}
  // the grandstand: blue concrete terraces stepping up to the west, steel roof
  const gx=951,z0=4,z1=33,base=at(gx,18);
  for(let k=0;k<7;k++)block(g,flat(k%2?'#5f7fb8':'#6b8ac0'),gx+3.6-k*.75,base,(z0+z1)/2,.75,.45*(k+1),z1-z0);
  block(g,flat('#4f6fa8'),gx-1.2,base,(z0+z1)/2,1.2,4.8,z1-z0);
  for(let z=z0;z<=z1+.01;z+=5.8){block(g,flat('#6f8fc8'),gx+4.4,base,z,.25,7,.25);block(g,flat('#6f8fc8'),gx-1,base+4.8,z,.25,2.2,.25);}
  {const p=new THREE.Mesh(new THREE.BoxGeometry(8,.12,z1-z0+1.4),corrugated('#4c4f52'));p.position.set(gx+2,base+7.2,(z0+z1)/2);p.rotation.z=-.12;p.castShadow=true;g.add(p);}
  // entrance: two round blue pillars with a red ring, the grey sheet gates
  for(const z of[-8.5,.5]){const c=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,3.4,16),flat('#5f7fb8'));c.position.set(950.5,at(950.5,z)+1.7,z);g.add(c);
    const rr=new THREE.Mesh(new THREE.CylinderGeometry(1.34,1.34,.15,16),flat('#d9534a'));rr.position.set(950.5,at(950.5,z)+3.25,z);g.add(rr);}
  block(g,corrugated('#b7babc'),951.6,at(951.6,-4),-4,.08,2.4,6.4);                 // the sheet gate (open: pushed to the side)
  // floodlight masts on the east and the perimeter wall round the track
  for(const z of[-40,0,40,80]){const x=EC[0]+ER+5;block(g,flat('#9a9ea1'),x,at(x,z),z,.35,18,.35);block(g,flat('#d9d9d6'),x-.6,at(x,z)+18,z,.3,1,2.4);}
  const wallPts=oval(ER+6,EH-ER);wallPts.forEach((a,i)=>{const b=wallPts[(i+1)%wallPts.length],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    if(mx<EC[0]-ER+1&&mz>-6&&mz<34)return;                         // open at the grandstand
    const L=Math.hypot(b[0]-a[0],b[1]-a[1]),w=new THREE.Mesh(new THREE.BoxGeometry(L,1.1,.15),flat('#e1ddd4'));w.position.set(mx,at(mx,mz)+.55,mz);w.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(w);});
  return r;}};

// ============================== Cemitério Municipal ==============================
// the hillside cemetery: the high white retaining wall along the lower street, a lower wall
// elsewhere, the graves in rows on the grid of the satellite (≈43° off east), every grave
// different — whitewashed or granite-clad jazigos, some with headstones, crosses, a small
// chapel or a statue — the wall niches (gavetas) in grey blocks, cypresses and big trees,
// the main paths, and the chapel of rest with its cross at the top entrance
const CA=-Math.atan2(61,65);                                     // the rows' direction
const CEM:P2[]=[[-159.7,178.6],[-119.9,224.5],[-143.3,245.6],[-191.8,284.6],[-108.6,386.5],[-116.9,407],[-134.7,382.4],[-172.2,397.2],[-178.7,389.6],
  [-227.3,408],[-252.7,379.6],[-272.5,349.2],[-298.5,310.1],[-267.5,283.5],[-233.5,249],[-210.6,227.9],[-201,217.7],[-182.5,200.2]];   // OSM outline
// the streets along its edges and the three service drives through it (OSM): the walls
// stand back from the streets, the drives pass through gates, no grave on them
export const CEM_ROADS:{pts:P2[];hw:number}[]=[
  {hw:3.6,pts:[[-304.9,309],[-272.3,280.6],[-236.4,248.6],[-209.1,220.1],[-195.3,197.3],[-176.7,152]]},     // Rua Manoel Pereira de Souza
  {hw:3.3,pts:[[-304.9,309],[-282.2,342.3],[-251.1,388.5],[-233.7,413],[-222.4,434]]},
  {hw:2.6,pts:[[-209.1,220.1],[-194.9,234.3]]},
  {hw:2.6,pts:[[-251.1,388.5],[-236.5,383],[-223.5,377.8],[-210.7,370.1],[-159.6,336.3]]},
  {hw:2.6,pts:[[-282.2,342.3],[-271.5,341.6],[-260.7,340.5],[-247.9,338.1],[-235.6,337],[-211.4,339.2]]},
  {hw:3.6,pts:[[-138.2,252.3],[-140.5,255.9],[-150.7,318.2],[-150.3,324.8]]},                               // Rua Guanabura
];
// distance from (x,z) to the edge of the nearest of those roadways (negative = on it)
export function cemRoad(x:number,z:number):number{
  let m=1e9;
  for(const r of CEM_ROADS)for(let i=1;i<r.pts.length;i++){const[ax,az]=r.pts[i-1],[bx,bz]=r.pts[i],dx=bx-ax,dz=bz-az,l=dx*dx+dz*dz||1;
    let t=((x-ax)*dx+(z-az)*dz)/l;t=t<0?0:t>1?1:t;m=Math.min(m,Math.hypot(x-ax-t*dx,z-az-t*dz)-r.hw);}
  return m;
}
const cemiterio:Publico={id:'cemiterio',nome:'Cemitério Municipal',origin:[-191,300],foot:[[-158,268,8,10,0,6]],build(at){
  const{r,g}=root([-191,300]);
  const poly=CEM,ins=cen(poly);
  // walls: high and white on the lower (west) street edges, 2.2 m elsewhere; each wall piece
  // moved in off the street it borders (the OSM outline runs down the street's middle), and
  // left out where a service drive goes through (the gates)
  poly.forEach((a,i)=>{const b=poly[(i+1)%poly.length],f=face(a,b,ins),high=(a[0]+b[0])/2<-250&&(a[1]+b[1])/2>300;
    for(let s=0;s<f.len;s+=4){const w=Math.min(4,f.len-s);let o=-.12;
      for(let k=0;k<30;k++){const[x,,z]=f.at(s+w/2,0,o);if(cemRoad(x,z)>1.4)break;o-=.5;}
      const[x,,z]=f.at(s+w/2,0,o);
      if(cemRoad(x,z)<1.4||!pointInPoly(x,z,poly))continue;              // a drive's gate, or pushed out of the ground
      const y=at(x,z),h=high?3.6:2.2;
      const m=new THREE.Mesh(new THREE.BoxGeometry(w+.02,h+.6,.25),flat(high?'#f0efea':'#dcd8cf'));m.position.set(x,y+h/2-.3,z);m.rotation.y=f.ry;g.add(m);}});
  // graves on the rotated grid, inside the walls, off the paths
  const c=Math.cos(CA),s=Math.sin(CA),cols=['#efede8','#d9d6cf','#bdbab3','#8e8c88','#5a5856','#c9b9a6','#e6e0d6'];
  const rnd=(i:number):number=>{const v=Math.sin(i*12.9898)*43758.5453;return v-Math.floor(v);};
  let n=0;
  for(let u=-140;u<140;u+=3.1)for(let v=-140;v<140;v+=1.75){
    const x=ins[0]+u*c-v*s,z=ins[1]+u*s+v*c;
    if(!pointInPoly(x,z,poly,3))continue;
    if(Math.abs(v-5)<1.6||Math.abs(u-12)<1.8||Math.abs(u+50)<1.6)continue;   // the main paths
    if(cemRoad(x,z)<2.4)continue;                                              // off the drives and the streets (a grave is 2.4 m long)
    if(Math.hypot(x+158,z-268)<9)continue;                                    // the chapel
    const k=n++,rr=rnd(k),y=at(x,z),col=cols[Math.floor(rnd(k+7)*cols.length)];
    const t=new THREE.Group();t.position.set(x,y,z);t.rotation.y=-CA;g.add(t);
    const hgt=.5+rnd(k+3)*.9,bx=new THREE.Mesh(new THREE.BoxGeometry(2.3,hgt,1.15),flat(col));bx.position.y=hgt/2-.05;t.add(bx);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(2.4,.07,1.25),flat(rr>.5?'#d9d6cf':'#3a3836'));cap.position.y=hgt;t.add(cap);
    if(rr<.45){const hs=new THREE.Mesh(new THREE.BoxGeometry(.12,.9,1.0),flat(col));hs.position.set(-1.1,hgt+.45,0);t.add(hs);}
    if(rr>.3&&rr<.75){const cv=new THREE.Mesh(new THREE.BoxGeometry(.1,1,.1),flat(rr>.55?'#2a2826':'#f2f2ee'));cv.position.set(-1,hgt+.5,0);t.add(cv);
      const ch=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.55),cv.material as THREE.Material);ch.position.set(-1,hgt+.75,0);t.add(ch);}
    if(rr>.93){const ch=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.6,1.1),flat('#e6e2da'));ch.position.y=hgt+.8;t.add(ch);
      const rf=new THREE.Mesh(new THREE.ConeGeometry(1.05,.7,4),flat('#9a958c'));rf.position.y=hgt+1.95;rf.rotation.y=Math.PI/4;t.add(rf);}
    if(rnd(k+11)>.8){const fl=new THREE.Mesh(new THREE.BoxGeometry(.25,.2,.25),flat(['#e84a6a','#f2c418','#f2f2ee','#c43c8a'][k%4]));fl.position.set(.6,hgt+.12,.3);t.add(fl);}
  }
  // wall niches along the north-east wall, cypresses and big trees
  for(let k=0;k<10;k++){const a=poly[0],b=poly[1],t=.1+k*.08,x=a[0]+(b[0]-a[0])*t-3,z=a[1]+(b[1]-a[1])*t+3,y=at(x,z);
    const blk=new THREE.Mesh(new THREE.BoxGeometry(3,2.6,1.2),flat('#a6a39d'));blk.position.set(x,y+1.3,z);blk.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(blk);}
  for(const[x,z]of[[-210,248],[-232,270],[-180,232],[-250,300],[-268,322],[-160,330],[-138,350],[-225,355]] as P2[])tree(g,at,x,z,'cipreste',.9);
  for(const[x,z]of[[-175,308],[-180,325],[-205,355],[-168,215],[-232,397]] as P2[])tree(g,at,x,z,'copa',1.1);
  // the chapel of rest at the top entrance
  {const C=rect(-158,268,8,10,CA+Math.PI/2);const{y0,eave,F}=building(g,at,C,{h:3.4,wall:'#f2f1ec',plinth:'#b9b5ab',plinthH:.4,roof:'hip',tile:'#b0603f',rise:2});
    const f=F[0];opening(g,f,f.len/2,y0,1.6,2.6,{fill:T('capDoor',()=>matte({color:'#6a4630'})),frame:'#e6dcd2',panes:2});
    const[x,,z]=f.at(f.len/2,0,-1);block(g,flat('#f2f2ee'),x,eave+1.6,z,.14,1.6,.14);block(g,flat('#f2f2ee'),x,eave+2.6,z,.8,.14,.14,f.ry);
    onFace(g,f,letters(['VELÓRIO MUNICIPAL'],'#3a3a3a','800 60px Arial',768,96),f.len/2,y0+2.7,f.len-1,.45,.03);}
  return r;}};

export const PUBLICOS:Publico[]=[saude,oftalmo,congregacao,espirita,saoSebastiao,pm,delegacia,vicente,estadio,cemiterio];
// OSM building names these replace (the town build skips their generic box)
export const PUBLICOS_OSM=new Set(['Centro de Saúde III Divinolândia','Clínica de Oftalmologia','Congregação Cristã no Brasil',
  'Centro de Estudos Espírita Vinha do Senhor Allan Kardec','']);
