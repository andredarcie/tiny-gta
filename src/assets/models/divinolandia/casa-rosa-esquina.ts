import * as THREE from 'three';
import {matte} from '../matte.ts';
import {leafMat,leafMass} from './copa.ts';
import {Kit,P,STONE,plain,holedWall,fillOpening,wallX,wallZ,dirt,railing,roof,dish,waterTank,meterBox,houseNumber,REVEAL,type Op,type Hole} from './kit-fachada.ts';

// A casa rosa da esquina — the rosy-beige house on the south-west corner of Rua José
// Augusto Machado × Rua Francisco Pereira de Souza (nº 228 / nº 58), modelled from Street
// View (nov/2024, frames 00/01/06/07 in docs/divinolandia/referencias-streetview/). An
// L-shaped house raised ~0.7 m above the corner kerb on a grey stone retaining wall topped
// by a white diagonal-lattice railing:
//  - José Augusto Machado front (north), from the corner westward: a porch behind tall
//    white lattice gates with a glazed room above it on a lattice balcony; the white
//    garage door (ventilation grille band) under a projecting balcony with white bars and a
//    door with louvred shutters; then a plain pink wall to the neighbour;
//  - the east face toward the corner: a full-height panel of irregular grey stone, glazing
//    near the street;
//  - Francisco Pereira de Souza (east): the one-storey wing with a clay hip roof, white
//    boxed eaves and three windows (closed white louvres, a small sliding one, louvres);
//    then a pink garden wall with a lattice gate and the white garage in a flat-roofed box;
//  - corner garden with the yellow-flowered shrub, rose bushes along the railing, a
//    satellite dish and a water tank on the roofs.
// Frame: origin = the lot's street corner; +x = east along José Augusto Machado, +z = south
// along Francisco Pereira de Souza. The house occupies x∈[-W,0], z∈[0,D].
const PINK='#dcc1b3',PINK_UP='#d6b9aa',WHITE='#f3f1ec',TILE='#ad5d3e';
export const ROSA_W=17,ROSA_D=26;
export const ROSA_LIFT=.7;
const L=ROSA_LIFT,F=3.0;

// a group whose local +z is the street-facing normal (kit convention), placed in the model frame
function part(parent:THREE.Group,x:number,z:number,ry:number,fill:(k:Kit)=>void,y=0):void{
  const k=new Kit();fill(k);const g=k.finish();g.position.set(x,y,z);g.rotation.y=ry;parent.add(g);
}
const N=Math.PI,E=Math.PI/2;                 // façade facing north (-z) / east (+x)

function build():THREE.Group{
  const g=new THREE.Group();
  const pink=P(PINK),pinkUp=P(PINK_UP);

  // ================= block A: two storeys along José Augusto Machado =================
  // x∈[-14.5,-5] (w 9.5) z∈[0.8,11] (d 10.2); kit frame: front = JAM face, kit x = viewer's right = west
  const A={x0:-14.5,x1:-5,z0:.8,z1:11},Aw=A.x1-A.x0,Ad=A.z1-A.z0,Acx=(A.x0+A.x1)/2;
  const kx=(wx:number):number=>-(wx-Acx);   // world x → kit x (rotated π)
  const opsA:Op[]=[];
  // ground floor (kit y from 0 = house floor at L)
  const porch:Hole={x0:Math.min(kx(-5.4),kx(-9)),x1:Math.max(kx(-5.4),kx(-9)),y0:0,y1:2.7};
  const gar:Op={t:'garage',x:(kx(-12.6)+kx(-9.8))/2,w:2.8,h:2.45,grille:true,c:'#eeede8'};
  const dw:Op={t:'window',x:kx(-13.6),w:1.1,h:1.1,y:1.1,grille:true};
  opsA.push(gar,dw);
  const up:Op[]=[
    {t:'glass',x:(kx(-5.6)+kx(-8.8))/2,w:3,h:1.9,y:.55,fl:1,frame:'#3a3532'},
    {t:'door',x:(kx(-10.4)+kx(-12))/2,w:1.2,h:2.15,fl:1,c:'#f1ece2'},
    {t:'window',x:kx(-13.6),w:1.2,y:1.1,fl:1,shutters:'#f4f0e8'},
  ];
  part(g,Acx,A.z0,N,k=>{
    const base=-L-.9;
    holedWall(k,pink,-Aw/2,Aw/2,base,F,0,[porch,...opsA.map(o=>({x0:o.x-o.w/2,x1:o.x+o.w/2,y0:o.y??0,y1:(o.y??0)+(o.h??2.4)}))]);
    // porch recess: dark back wall with a glass door, pillar on the open side
    const px0=porch.x0,px1=porch.x1;
    k.quad(plain('#d9c2b5'),[px0,0,-2.2],[px1,0,-2.2],[px1,2.7,-2.2],[px0,2.7,-2.2]);
    k.quad(plain('#cdbfb3'),[px0,0,0],[px1,0,0],[px1,0,-2.2],[px0,0,-2.2]);
    fillOpening(k,{t:'glass',x:(px0+px1)/2,w:1.8,h:2.2,y:0},-2.2+REVEAL,pink);
    for(const o of opsA)fillOpening(k,o,0,pink);
    holedWall(k,pinkUp,-Aw/2,Aw/2,F,2*F,0,up.map(o=>({x0:o.x-o.w/2,x1:o.x+o.w/2,y0:F+(o.y??0),y1:F+(o.y??0)+(o.h??1.2)})));
    for(const o of up)fillOpening(k,o,0,pinkUp);
    k.box(plain('#ebe7df'),-Aw/2-.05,Aw/2+.05,F-.08,F+.08,-.02,.1);             // storey band
    // lattice balcony over the porch + the projecting balcony box over the garage
    k.box(plain('#efece6'),px0-.1,px1+.1,F-.2,F,0,.9);
    railing(k,px0-.1,px1+.1,F,1.0,.85,WHITE,'lattice');
    const bx0=gar.x-1.9,bx1=gar.x+1.9;
    k.box(plain('#efece6'),bx0,bx1,F-.25,F,0,1.2);
    railing(k,bx0,bx1,F,1.0,1.15,WHITE,'bars');
    for(const x of[bx0,bx1])railing(k,x-.02,x+.02,F,1.0,.6,WHITE,'bars');
    k.box(pinkUp,bx0-.15,bx1+.15,2*F-.35,2*F,0,1.25);                          // the box's upper frame
    for(const x of[bx0-.08,bx1+.08])k.box(pinkUp,x-.08,x+.08,F,2*F-.35,1.05,1.25);
    // west + back walls (the east face is its own part with the stone panel)
    wallX(k,pink,Aw/2,-Ad,0,base,F);wallX(k,pinkUp,Aw/2,-Ad,0,F,2*F);
    wallZ(k,pink,-Ad,Aw/2,-Aw/2,base,2*F);
    dirt(k,-Aw/2,Aw/2,base,1,.035);
    roof(k,'hip',Aw,Ad,2*F,0,{tile:TILE,fascia:WHITE,soffit:'#f4f2ee',ov:.75,wall:PINK,rise:2});
    waterTank(k,1.5,2*F+.8,-Ad*.6);
    houseNumber(k,gar.x+1.8,2.2,.01);
  },L);
  // east face of block A (toward the corner): glazing near JAM, stone panel behind
  part(g,A.x1,(A.z0+A.z1)/2,E,k=>{
    // kit x = viewer's right = north (toward JAM): z_world = mid - kitx
    const hw=Ad/2,base=-L-.9;
    const holes:Hole[]=[{x0:hw-3.3,x1:hw-.4,y0:.2,y1:2.5},{x0:hw-3.3,x1:hw-.4,y0:F+.5,y1:F+2.4}];
    holedWall(k,pink,-hw,hw,base,F,0,[holes[0]]);holedWall(k,pinkUp,-hw,hw,F,2*F,0,[holes[1]]);
    fillOpening(k,{t:'glass',x:hw-1.85,w:2.9,h:2.3,y:.2},0,pink);
    fillOpening(k,{t:'glass',x:hw-1.85,w:2.9,h:1.9,y:.5,fl:1,frame:'#3a3532'},0,pinkUp);
    holedWall(k,STONE(),-hw,hw-3.8,base+.3,2*F,.02,[],.02);                      // the stone panel
    k.box(plain('#efece6'),hw-3.6,hw,F-.2,F,0,1);
    railing(k,hw-3.6,hw,F,1.0,.95,WHITE,'lattice');
  },L);

  // ================= block B: one-storey wing along Francisco Pereira de Souza =================
  const B={x0:-12,x1:-3,z0:11,z1:21},Bd=B.x1-B.x0,Bw=B.z1-B.z0;
  part(g,B.x1,(B.z0+B.z1)/2,E,k=>{
    // kit x = north; FPS windows from south to north: louvres, small sliding, louvres (photo 06)
    const ops:Op[]=[{t:'window',x:3,w:1.4,h:1.25,y:1.05,shutters:'#f2eee6'},{t:'window',x:0,w:.9,h:.8,y:1.5},{t:'window',x:-3,w:1.4,h:1.25,y:1.05,shutters:'#f2eee6'}];
    const base=-L-.9;
    holedWall(k,pink,-Bw/2,Bw/2,base,F+.2,0,ops.map(o=>({x0:o.x-o.w/2,x1:o.x+o.w/2,y0:o.y!,y1:o.y!+o.h!})));
    for(const o of ops){fillOpening(k,o,0,pink);
      k.box(plain(WHITE),o.x-o.w/2-.1,o.x+o.w/2+.1,o.y!-.1,o.y!+o.h!+.1,.0,.05);}  // white moulded surround
    wallX(k,pink,-Bw/2,-Bd,0,base,F+.2);wallX(k,pink,Bw/2,-Bd,0,base,F+.2);wallZ(k,pink,-Bd,Bw/2,-Bw/2,base,F+.2);
    dirt(k,-Bw/2,Bw/2,base,1,.01);
    roof(k,'hip',Bw,Bd,F+.2,0,{tile:TILE,fascia:WHITE,soffit:'#f4f2ee',ov:.7,wall:PINK,rise:2.2});
    dish(k,-Bw/2+1,F+1.6,-Bd+1.5,2.4);
  },L);

  // ================= garage box at the south end (flush with the FPS sidewalk) =================
  part(g,0,ROSA_D-2.5,E,k=>{
    const gw=5,gd=7;
    const gop:Op={t:'garage',x:.3,w:3.5,h:2.5,c:'#f1f0eb'};
    holedWall(k,pink,-gw/2,gw/2,-1.2,F+.1,0,[{x0:gop.x-1.75,x1:gop.x+1.75,y0:0,y1:2.5}]);
    fillOpening(k,gop,0,pink);
    wallX(k,pink,-gw/2,-gd,0,-1.2,F+.1);wallX(k,pink,gw/2,-gd,0,-1.2,F+.1);wallZ(k,pink,-gd,gw/2,-gw/2,-1.2,F+.1);
    roof(k,'flat',gw,gd,F+.1,0,{fascia:WHITE,ov:.25,wall:PINK});
    dirt(k,-gw/2,gw/2,-.3,.9,.01);
  });

  // ================= retaining wall + railings + garden =================
  part(g,0,0,0,k=>{
    const top=L+.45,lo=-1.5;
    // along FPS (x=0 plane faces +x): build as kit walls by hand (quads)
    const sm=STONE();
    k.quad(sm,[.3,lo,1.7],[.3,lo,ROSA_D-5],[.3,top,ROSA_D-5],[.3,top,1.7]);
    k.box(plain('#d9d5cc'),-.05,.38,top,top+.07,1.6,ROSA_D-5);
    // along JAM up to the porch (z=0 plane faces -z)
    k.quad(sm,[-1.7,lo,-.3],[-5.2,lo,-.3],[-5.2,top,-.3],[-1.7,top,-.3]);
    k.box(plain('#d9d5cc'),-5.2,-1.6,top,top+.07,-.38,.05);
    // chamfered corner
    k.quad(sm,[.3,lo,1.7],[-1.7,lo,-.3],[-1.7,top,-.3],[.3,top,1.7]);
    // pink garden wall + lattice gate between the wing and the garage
    k.box(pink,-.1,.3,lo,L+1.4,ROSA_D-7.5,ROSA_D-5);
  });
  // railings on top of the stone wall
  part(g,.1,0,E,k=>{railing(k,-(ROSA_D-12.2),-1.7,L+.52,1.0,0,WHITE,'lattice');});
  part(g,0,-.15,N,k=>{railing(k,1.7,5.2,L+.52,1.0,0,WHITE,'lattice');});
  part(g,-8,.1,N,k=>{                                           // tall white lattice porch gates at the sidewalk
    railing(k,-3,1,0,2.2,0,WHITE,'lattice');
    meterBox(k,1.4,.9,.02);
  });
  part(g,.32,ROSA_D-6.25,E,k=>{railing(k,-1.1,1.1,L+.2,1.4,0,WHITE,'lattice');});
  // garden: floor, the yellow-flowered shrub, roses, a small palm
  const garden=new THREE.Mesh(new THREE.BoxGeometry(4.6,.2,ROSA_D-6),matte({color:'#6f8d47'}));garden.position.set(-2.4,L-.1,(ROSA_D-6)/2+.6);g.add(garden);
  const leaf=leafMat('#46663a'),yellow=matte({color:'#e9c83a'}),rose=matte({color:'#d9708f'});
  const bush=new THREE.Mesh(leafMass(2,.26,2),leaf);bush.position.set(-3.6,L+1.6,2.6);bush.scale.set(1.7,1.9,1.5);bush.castShadow=true;g.add(bush);
  for(let i=0;i<26;i++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.12,0),yellow);const a=i*2.39,r=1.3+(i%4)*.12;
    f.position.set(-3.6+Math.cos(a)*r,L+1.3+Math.sin(i*1.3)*1.2,2.6+Math.sin(a)*r*.9);g.add(f);}
  for(let z=3;z<ROSA_D-12;z+=1.8){const b=new THREE.Mesh(leafMass(1,.26,2),leaf);b.scale.setScalar(.45);b.position.set(-.8,L+.5,z);g.add(b);
    for(let i=0;i<4;i++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.09,0),rose);f.position.set(-.8+Math.cos(i*1.6)*.4,L+.75,z+Math.sin(i*1.6)*.4);g.add(f);}}
  g.userData.h=L+2*F+2.5;
  return g;
}
// collision footprints in the model frame: [x0,x1,z0,z1,top]
export const ROSA_SOLIDS:[number,number,number,number,number][]=[
  [-15.3,-4.2,0,11.8,L+8.5],[-12.7,-2.3,10.3,21.7,L+5.6],[-7.2,.3,ROSA_D-5.2,ROSA_D+.3,3.5],
  [-5.3,-1.6,-.45,.1,L+1.6],[0,.45,1.6,ROSA_D-5,L+1.6],[-11,-5,-.1,.4,2.3],
];
export default {category:'Divinolândia',label:'Casa rosa da esquina (R. José Augusto Machado × R. Francisco P. de Souza)',build};
