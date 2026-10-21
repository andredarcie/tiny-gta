import * as THREE from 'three';
import {matte} from '../matte.ts';
import {leafMat,leafMass} from './copa.ts';
import type {GroundAt,P2} from './praca-chao.ts';
import {TAURUS,canopy,taurusFascia,plainFascia,taurusBadge,column,island,apron,block,tiledBlock,tileWall,flat,walls,face,onFace,opening,
  glassM,darkM,signMat,canvasTex,solarArray} from './posto-kit.ts';
import Bomba from './bomba-combustivel.ts';
import Palmeira from './palmeira-fenix.ts';

// Posto Taurus — Rua Barão do Rio Branco 800, on the corner of the Avenida Marginal do Rio
// do Peixe, down by the river. Rebuilt from Google Street View (panorama
// 0-9jbuRyb-6NHkJda3Wt4Q on the Barão, posto-taurus-n / -s at the two corners, the -zoom
// close-ups) and the z20 satellite, kept locally in docs/divinolandia/referencias-*:
//  - the big square CANOPY (26 × 27 m, solar panels all over its roof): royal-blue fascia
//    with the orange and gold lines, the italic gold "Taurus" and the rainbow-wave badge;
//    white ceiling with round lights and two translucent skylight strips;
//  - two islands across it with Taurus pumps, a white column with the blue top, the white
//    lubricant tank and the yellow-and-black guard posts;
//  - under the back of the canopy the white-tiled CONVENIÊNCIA (blue sign over an orange
//    stripe, glass front) and the tiled cashier counter ("$ Caixa");
//  - south of it the TROCA DE ÓLEO block: three open white-tiled bays (Troca de Óleo, Troca
//    de Óleo, Lava-Rápido) under their blue signs, solar panels on the roof;
//  - along the Barão the blue planter wall with white posts, red ixoras and phoenix palms;
//  - the tall price pylon at the south corner and the PROMOÇÃO board at the north entrance.
// build({groundAt}) is pure; TOWN-LOCAL coordinates shifted by ORIGIN, as posto-triangulo.ts.
export const ORIGIN:P2=[55,-485];
const CANOPY:P2[]=[[43.4,-504.2],[69.6,-504.2],[69.6,-477.5],[43.4,-477.5]];
const ISL=[-498,-482];
export const POSTO_FOOT:[number,number,number,number,number,number][]=[
  ...ISL.map(z=>[54.5,z,6.6,1.3,0,2.3] as [number,number,number,number,number,number]),
  [65.55,-490.8,8.1,25.6,0,4],[60.6,-480,1.8,3,0,1.2],
  [55.75,-468.25,16.5,18.5,0,5.3],
  [43.35,-491,1.3,20,0,.7],[42.8,-461.5,1.8,.5,0,7.6],
];

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);
  let hi=-Infinity;for(const p of[...CANOPY,[56,-490]] as P2[])hi=Math.max(hi,at(p[0],p[1]));
  const CY=hi+4.8,FH=1.3;

  // ---- forecourt: from the two street kerbs to the shop, round the oil-change block
  apron(g,at,[[44.4,-512.4],[69.6,-504.9],[69.6,-503.6],[61.5,-503.6],[61.5,-477.5],[47.5,-477.5],[47.5,-459.5],[36.4,-460.3],[39.1,-478],[42.6,-501]]);

  // ---- canopy
  const panels:{x0:number;x1:number;z0:number;z1:number}[]=[];
  for(const z0 of[-503.5,-490.3])panels.push({x0:44.5,x1:68.5,z0,z1:z0+12.4});
  canopy(g,CANOPY,{y:CY,h:FH,ceiling:'#f0f0ec',roof:'#9fa1a0',lights:3.3,solar:panels,
    skylights:[[[46,-496.6],[66,-496.6],[66,-495.4],[46,-495.4]],[[46,-486.6],[66,-486.6],[66,-485.4],[46,-485.4]]],
    edges:[
      taurusFascia([13],[9.6]),                       // the Marginal front (left = east)
      plainFascia(TAURUS.blue),                       // east, over the shop
      taurusFascia([13.1],[]),                        // south, over the oil-change block
      taurusFascia([16],[1.2,11.4]),                  // the Barão front (left = north)
    ]});

  // ---- islands
  const white=flat('#f2f2ef'),blue=flat(TAURUS.blue);
  for(const z of ISL){
    const top=island(g,at,54.5,z,0,6.6,1.3,{base:'#d9d9d4',edge:'#3b6fb5'});
    column(g,at,56.6,z,CY-1.3,.6,white);                // (the blue head box carries it to the ceiling)
    block(g,blue,56.6,CY-1.25,z,.62,1.25,.62);block(g,flat(TAURUS.orange),56.6,CY-1.3,z,.64,.06,.64);
    for(const x of[51.8,54.2]){const p=Bomba.build({kind:'taurus'});p.position.set(x,top,z);g.add(p);}
    // yellow-and-black guard posts at the island's ends
    for(const x of[51.25,57.75])for(const dz of[-.4,.4]){
      const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,1,8),guardMat());p.position.set(x,top+.5,z+dz);g.add(p);}
    if(z===ISL[1]){                                    // the white lubricant tank on its cradle
      const t=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,1.4,14),white);t.rotation.z=Math.PI/2;t.position.set(50,at(50,z-.3)+.75,z-.3);g.add(t);
      block(g,flat('#c8302c'),49.9,at(49.9,z+.6),z+.6,.6,.5,.4);
    }
  }

  shop(g,at);
  oilChange(g,at);

  // ---- the planter along the Barão: blue wall, white posts with green caps, flowers, palms
  {
    const x0=42.7,x1=44,z0=-501,z1=-481,wall=flat('#4c78b8');
    for(const x of[x0,x1]){
      for(let z=z0;z<z1;z+=1){const y=Math.min(at(x,z),at(x,z+1));block(g,wall,x,y-.2,z+.5,.22,.75,1.02);}
    }
    for(const z of[z0,z1]){const y=at((x0+x1)/2,z);block(g,wall,(x0+x1)/2,y-.2,z,1.5,.75,.22);}
    for(let z=z0;z<=z1;z+=4)for(const x of[x0,x1]){
      const y=at(x,z);block(g,white,x,y,z,.32,1.05,.32);
      const cap=new THREE.Mesh(new THREE.SphereGeometry(.1,8,6),flat('#2f7a4a'));cap.position.set(x,y+1.15,z);g.add(cap);
    }
    const soil=new THREE.Mesh(new THREE.BoxGeometry(1.1,.1,z1-z0),flat('#5a4130'));soil.position.set((x0+x1)/2,at(43.3,-491)+.45,-491);g.add(soil);
    const ix=leafMat(0x3f6a35),red=leafMat(0xc23a35);
    for(let z=z0+1;z<z1-.5;z+=1.3){
      const y=at(43.3,z),b=new THREE.Mesh(leafMass(1+Math.round(z)%3,.28,2),Math.round(z*3)%4===0?red:ix);
      b.scale.set(.55,.45,.6);b.position.set(43.35,y+.85,z);g.add(b);
    }
    for(const[z,h]of[[-498,2.6],[-490,3.2],[-483,2.2]] as [number,number][]){const p=Palmeira.build({h,seed:Math.round(-z)});p.position.set(43.35,at(43.35,z)+.4,z);g.add(p);}
  }

  // ---- the price pylon at the south corner
  {
    const x=42.8,z=-461.5,y=at(x,z);
    for(const dz of[-.65,.65])block(g,white,x,y,z+dz,.3,6,.22);                // the two legs, under the panel's edges
    const logo=matte({map:canvasTex(256,256,(c,w,h)=>{c.fillStyle='#f3f3f0';c.fillRect(0,0,w,h);taurusBadge(c,w/2,h*.42,w*.62);
      c.fillStyle=TAURUS.blue;c.font='italic 900 44px Arial';c.textAlign='center';c.fillText('Taurus',w/2,h*.9);})});
    const prices=matte({map:canvasTex(256,256,(c,w,h)=>{c.fillStyle='#1b2f73';c.fillRect(0,0,w,h);
      ['GASOLINA','ETANOL','DIESEL S10','DIESEL S500'].forEach((r,k)=>{c.fillStyle='#ffffff';c.font='700 18px Arial';c.textAlign='left';c.fillText(r,10,40+k*58);
        c.fillStyle='#ff6a2a';c.font='700 34px monospace';c.textAlign='right';c.fillText(['6,08','3,99','5,98','5,99'][k],w-10,44+k*58);});})});
    const head=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.7,.4),[white,white,white,white,logo,logo]);head.position.set(x,y+7,z);head.rotation.y=Math.PI/2;g.add(head);
    const pr=new THREE.Mesh(new THREE.BoxGeometry(1.7,1.6,.36),[blue,blue,blue,blue,prices,prices]);pr.position.set(x,y+5.33,z);   // (its top meets the logo box's foot)pr.rotation.y=Math.PI/2;g.add(pr);
    block(g,blue,x,y+7.85,z,1.75,.12,.45,Math.PI/2);
  }
  // ---- the PROMOÇÃO A-frame at the north entrance
  {
    const x=45.2,z=-505.6,y=at(x,z);
    const m=matte({map:canvasTex(128,320,(c,w,h)=>{c.fillStyle='#161616';c.fillRect(0,0,w,h);c.fillStyle='#e8762b';c.font='900 20px Arial';c.textAlign='center';c.fillText('PROMOÇÃO',w/2,30);
      ['S10 6,08','S500 5,98','GAS. 5,99','ET. 3,89'].forEach((r,k)=>{c.fillStyle='#ffffff';c.font='700 18px Arial';c.textAlign='left';c.fillText(r.split(' ')[0],8,90+k*62);
        c.fillStyle='#ff6a2a';c.font='700 26px monospace';c.textAlign='right';c.fillText(r.split(' ')[1],w-8,92+k*62);});})});
    for(const s of[-1,1]){const b=new THREE.Mesh(new THREE.PlaneGeometry(.6,1.5),m);b.position.set(x,y+.72,z+s*.18);b.rotation.set(s*.12,s<0?Math.PI:0,0,'YXZ');g.add(b);}
  }
  return root;
}
let gm:THREE.Material|null=null;
function guardMat():THREE.Material{
  if(!gm)gm=matte({map:canvasTex(16,64,(c,w,h)=>{for(let i=0;i<8;i++){c.fillStyle=i%2?'#1c1c1c':'#f2c21a';c.fillRect(0,i*h/8,w,h/8);}})});
  return gm;
}

// The convenience shop under the back of the canopy: x 61.5..69.6, z -503.6..-478, front at x = 61.5.
function shop(g:THREE.Group,at:GroundAt):void{
  const P:P2[]=[[61.5,-503.6],[69.6,-503.6],[69.6,-478],[61.5,-478]],ins:P2=[65.5,-491];
  const y0=at(61.5,-491)+.12,base=Math.min(...P.map(([x,z])=>at(x,z)))-.5,top=y0+3.7,tw=tileWall();
  walls(g,P,base,top,tw,.6,ins);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(7.96,.15,25.46),flat('#c9c9c4'));roof.position.set(65.55,top,-490.8);g.add(roof);   // inside the walls
  const F=face(P[3],P[0],ins);                         // the front, seen from the forecourt: left = north
  onFace(g,F,flat(TAURUS.orange),F.len/2,y0+2.95,F.len,.08,.03);
  onFace(g,F,signMat(['+ Conveniência'],{bg:TAURUS.blue,fg:'#ffffff',w:512,h:80}),9.5,y0+3.05,3.4,.5,.04,.04);
  opening(g,F,9.5,y0,5.2,2.6,{fill:glassM(),frame:'#4a4d50',panes:4});
  opening(g,F,16,y0,3.2,2.6,{fill:glassM(),frame:'#4a4d50',panes:2});
  opening(g,F,2.4,y0,2.2,2.5,{fill:darkM(),frame:'#4a4d50'});           // store room
  for(const s of[8,11]){const[x,,z]=F.at(s,0,-1);block(g,flat('#9aa3a8'),x,y0,z,.45,1.8,2.2);}
  onFace(g,F,signMat(['$ Caixa'],{bg:TAURUS.blue,fg:'#ffffff',w:256,h:80}),22.3,y0+2.5,1.4,.42,.04,.04);
  // the tiled cashier counter in front of the shop's south end, glass over it
  tiledBlock(g,tw,60.6,at(60.6,-480),-480,1.8,1.15,3,.6);
  const gl=new THREE.Mesh(new THREE.BoxGeometry(.04,1.1,3),matte({color:0x9fb0b8,transparent:true,opacity:.35,depthWrite:false}));
  gl.position.set(59.75,at(60.6,-480)+1.7,-480);g.add(gl);
  block(g,tw,60.6,at(60.6,-480)+2.25,-480,1.8,.15,3);
}

// The oil-change block: x 47.5..64, z -477.3..-459 (just clear of the canopy's fascia), three bays opening on the forecourt (x = 47.5).
function oilChange(g:THREE.Group,at:GroundAt):void{
  const P:P2[]=[[47.5,-477.3],[64,-477.3],[64,-459],[47.5,-459]],ins:P2=[55.75,-468.15];
  const y0=at(47.5,-468)+.1,base=Math.min(...P.map(([x,z])=>at(x,z)))-.5,top=y0+5.1,tw=tileWall();
  walls(g,P,base,top,tw,.6,ins);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(16.36,.15,18.16),flat('#c4c4bf'));roof.position.set(55.75,top-.6,-468.15);g.add(roof);
  solarArray(g,49,62,-476.5,-461,top-.55);
  const F=face(P[3],P[0],ins);                         // seen from the forecourt: left = north, s = z + 477.3
  onFace(g,F,flat(TAURUS.orange),F.len/2,y0+4.15,F.len,.1,.03);
  const labels=['Troca de Óleo','Troca de Óleo','Lava-Rápido'];
  for(let k=0;k<3;k++){
    const s=2.8+k*4.9;
    opening(g,F,s,y0,4.2,4.0,{fill:flat('#d9dad6'),frame:'#c6c7c3'});
    onFace(g,F,flat('#4b4d4f'),s,y0,4.2,.04,-.6);                       // the dark lip of the pit
    onFace(g,F,signMat(['▲ '+labels[k]],{bg:TAURUS.blue,fg:'#ffffff',w:512,h:96}),s,y0+4.3,3,.55,.04,.04);
    const[x,,z]=F.at(s-1.3,0,-3.5);block(g,flat('#5c6266'),x,y0,z,.6,1.3,.5);
  }
  // the scenery of the bays: a hose reel, oil drums
  {const[x,,z]=F.at(1.2,0,-1);const r=new THREE.Mesh(new THREE.TorusGeometry(.3,.05,6,14),flat('#262626'));r.position.set(x,y0+1.4,z);r.rotation.y=F.ry;g.add(r);}
  for(const s of[15,15.8]){const[x,,z]=F.at(s,0,-2);const d=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.9,12),flat('#2d5aa0'));d.position.set(x,y0+.45,z);g.add(d);}
}

export default {category:'Divinolândia',label:'Posto Taurus',build};
