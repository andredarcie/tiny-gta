import * as THREE from 'three';
import {matte} from '../matte.ts';
import {stoneTexture,uvMetres,STONE_TILE_M} from './texturas.ts';

// A casa rosa da esquina — the rosy-beige house on the south-west corner of Rua José
// Augusto Machado × Rua Francisco Pereira de Souza (nº 228 / nº 58), modelled from Street
// View (nov/2024). An L-shaped house raised on its corner:
//  - along José Augusto Machado: a two-storey block (flat roof with a wide white "beiral"),
//    white garage door with a grille band under a balcony with a white railing and a
//    wooden door with shutters, a porch with white railings to its west;
//  - at the corner, facing Francisco Pereira de Souza: a big full-height panel of irregular
//    grey stone, and upstairs a glazed corner room over a white-railed balcony;
//  - along Francisco Pereira de Souza: a one-storey wing with a clay-tile hip roof and two
//    white-framed windows with louvred shutters, then a white garage door in a pink box;
//  - the lot is held by a grey stone retaining wall topped by a white diagonal-lattice
//    railing, with a garden (a yellow-flowered shrub) in the corner.
//
// Frame: origin = the lot's street corner; +x = east along José Augusto Machado, +z = south
// along Francisco Pereira de Souza. The house lies WEST and SOUTH of the corner, so it
// occupies x∈[-W,0] and z∈[0,D]. The José Augusto Machado front is the plane z=0 facing -z
// (north); the Francisco Pereira de Souza front is the plane x=0 facing +x (east).
const PINK='#dcc3b6',PINK2='#d4b7a8',WHITE='#f3f1ec',TILE='#a9573c',GLASS='#2d3944',WOOD='#7a4a2c',SHUT='#efe9df';
const mats=new Map<string,THREE.Material>();
const M=(c:string):THREE.Material=>{let m=mats.get(c);if(!m){m=matte({color:c});mats.set(c,m);}return m;};
const stone=matte({map:stoneTexture()});
export const ROSA_W=17,ROSA_D=26;          // lot extent along JAM (x) and along FPS (z)
export const ROSA_LIFT=.7;                  // the house floor sits ~0.7 m above the corner kerb

function box(g:THREE.Group,m:THREE.Material,x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,cast=true):void{
  const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m);
  b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);b.castShadow=cast;b.receiveShadow=true;g.add(b);
}
// plane facing +z (ry=0), -z (ry=π), +x (ry=π/2)
function plane(g:THREE.Group,m:THREE.Material,w:number,h:number,x:number,y:number,z:number,ry:number,tile=0):void{
  const geo=new THREE.PlaneGeometry(w,h);if(tile)uvMetres(geo,w,h,tile);
  const p=new THREE.Mesh(geo,m);p.position.set(x,y,z);p.rotation.y=ry;p.receiveShadow=true;g.add(p);
}
// white diagonal lattice railing along x (dir='x') or z, from a to b at height y0..y0+h
function lattice(g:THREE.Group,dir:'x'|'z',a:number,b:number,fixed:number,y0:number,h:number):void{
  const m=M(WHITE),L=b-a,step=.5,diag=Math.hypot(step,h);
  const bar=(len:number,cx:number,cy:number):void=>{
    const bx=new THREE.Mesh(new THREE.BoxGeometry(dir==='x'?len:.04,.05,dir==='x'?.04:len),m);
    bx.position.set(dir==='x'?cx:fixed,cy,dir==='x'?fixed:cx);g.add(bx);};
  bar(L,(a+b)/2,y0+h);bar(L,(a+b)/2,y0+.03);
  for(let t=a;t<b-.01;t+=step)for(const s of[1,-1]){
    const d=new THREE.Mesh(new THREE.BoxGeometry(.035,diag,.035),m);
    if(dir==='x'){d.position.set(t+step/2,y0+h/2,fixed);d.rotation.z=s*Math.atan2(step,h);}
    else{d.position.set(fixed,y0+h/2,t+step/2);d.rotation.x=s*Math.atan2(step,h);}
    g.add(d);
  }
}
function hip(g:THREE.Group,x0:number,x1:number,z0:number,z1:number,y:number,rise:number):void{
  const hw=(x1-x0)/2,hd=(z1-z0)/2,xc=(x0+x1)/2,zc=(z0+z1)/2,along=hw>=hd,r=Math.abs(hw-hd);
  const c0=[x0,y,z0],c1=[x1,y,z0],c2=[x1,y,z1],c3=[x0,y,z1];
  const r0=along?[xc-r,y+rise,zc]:[xc,y+rise,zc-r],r1=along?[xc+r,y+rise,zc]:[xc,y+rise,zc+r];
  const t:number[][]=along?[c3,c2,r1,c3,r1,r0,c1,c0,r0,c1,r0,r1,c0,c3,r0,c2,c1,r1]:[c0,c3,r0,c3,r1,r0,c2,c1,r1,c1,r0,r1,c3,c2,r1,c1,c0,r0];
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(t.flat(),3));geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:TILE,side:THREE.DoubleSide,flatShading:true}));m.castShadow=true;g.add(m);
}

function build():THREE.Group{
  const g=new THREE.Group(),L=ROSA_LIFT,F=3.0;
  // ---- retaining wall + lattice railing along both streets (chamfered corner) ----
  const wallH=L+.45;
  box(g,M('#77736c'),-ROSA_W,-1.6,-1.5,wallH,-.35,0);           // along JAM (north edge)
  box(g,M('#77736c'),0,.35,-1.5,wallH,1.6,ROSA_D-5);              // along FPS (east edge), stops at the garage
  plane(g,stone,ROSA_W-1.6,wallH+1.2,(-ROSA_W-1.6)/2,(wallH-1.2)/2,-.36,Math.PI,STONE_TILE_M);
  plane(g,stone,ROSA_D-6.6,wallH+1.2,.36,(wallH-1.2)/2,(1.6+ROSA_D-5)/2,Math.PI/2,STONE_TILE_M);
  {const c=new THREE.Mesh(uvMetres(new THREE.PlaneGeometry(2.3,wallH+1.2),2.3,wallH+1.2,STONE_TILE_M),stone);
   c.position.set(-.8,(wallH-1.2)/2,.8);c.rotation.y=Math.PI*.75;g.add(c);
   box(g,M('#77736c'),-1.7,.1,-1.5,wallH,-.1,1.7);}
  lattice(g,'x',-9.5,-1.6,-.18,wallH,1.0);
  lattice(g,'z',1.6,ROSA_D-12,.18,wallH,1.0);
  // garden floor + the yellow-flowered shrub in the corner
  box(g,M('#6c8a45'),-ROSA_W+.2,-.2,-1.5,L,.2,ROSA_D-5.5,false);
  const bush=new THREE.Mesh(new THREE.IcosahedronGeometry(1.4,1),matte({color:'#4f8a35',flatShading:true}));bush.position.set(-3.2,L+1.3,2.8);bush.scale.set(1.2,1.1,1);bush.castShadow=true;g.add(bush);
  for(let k=0;k<14;k++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.13,0),M('#e7c53a'));const a=k*2.4,r=1.2+(k%3)*.25;f.position.set(-3.2+Math.cos(a)*r,L+1.2+Math.sin(k*1.7)*.7,2.8+Math.sin(a)*r);g.add(f);}

  // ---- two-storey block along José Augusto Machado: x∈[-15,-4.5], z∈[1.2,11] ----
  const A={x0:-15,x1:-4.5,z0:1.2,z1:11};
  box(g,M(PINK),A.x0,A.x1,-1.5,L+F,A.z0,A.z1);
  box(g,M(PINK2),A.x0,A.x1,L+F,L+2*F,A.z0,A.z1);
  box(g,M(WHITE),A.x0-.7,A.x1+.7,L+2*F,L+2*F+.3,A.z0-.7,A.z1+.7);   // flat roof, wide white beiral
  box(g,M(WHITE),A.x0-.05,A.x1+.05,L+F-.12,L+F+.12,A.z0-.05,A.z1+.05,false); // floor band
  // north face (z=A.z0, facing -z): garage under the balcony, porch windows to the west
  const zf=A.z0-.03;
  plane(g,M('#ebe8e2'),3.0,2.5,-8.6,L+1.25,zf,Math.PI);                         // garage door
  for(let k=1;k<7;k++)box(g,M('#d6d3cc'),-10.05,-7.15,L+k*.36-.02,L+k*.36+.02,zf-.04,zf-.01,false);
  plane(g,M('#2a2826'),2.8,.35,-8.6,L+2.25,zf-.02,Math.PI);
  for(const x of[-13.4,-11.6]){plane(g,M(GLASS),1.3,1.2,x,L+1.6,zf,Math.PI);lattice(g,'x',x-.7,x+.7,zf-.25,L+.3,1.0);}
  box(g,M('#ebe8e2'),-11,-6.2,L+F-.15,L+F,A.z0-1.2,A.z0,true);                 // balcony slab
  lattice(g,'x',-11,-6.2,A.z0-1.15,L+F,1.0);
  plane(g,M(WOOD),1.1,2.1,-8.6,L+F+1.05,zf,Math.PI);
  for(const s of[-1,1])plane(g,M(SHUT),.55,2.1,-8.6+s*.85,L+F+1.05,zf-.01,Math.PI);
  plane(g,M(GLASS),1.4,1.2,-13.2,L+F+1.6,zf,Math.PI);
  for(const s of[-1,1])plane(g,M(SHUT),.7,1.2,-13.2+s*1.05,L+F+1.6,zf-.01,Math.PI);
  // east face (x=A.x1, facing +x toward the corner): stone panel + glazed corner room
  const xe=A.x1+.03;
  plane(g,stone,4.2,2*F+.4,xe,L+F,A.z0+6.6,Math.PI/2,STONE_TILE_M);
  plane(g,M(GLASS),3.2,1.6,xe,L+F+1.5,A.z0+2.2,Math.PI/2);
  box(g,M('#ebe8e2'),A.x1,A.x1+1.1,L+F-.15,L+F,A.z0,A.z0+4.3);
  lattice(g,'z',A.z0,A.z0+4.3,A.x1+1.05,L+F,1.0);
  plane(g,M(GLASS),2.4,1.8,xe,L+1.1,A.z0+2.2,Math.PI/2);                          // ground-floor glass door
  lattice(g,'z',A.z0+.6,A.z0+3.8,A.x1+1.2,L,1.1);                                 // white porch gate

  // ---- one-storey wing along Francisco Pereira de Souza: x∈[-12,-3.2], z∈[11,20.5], hip roof ----
  const B={x0:-12,x1:-3.2,z0:11,z1:20.5};
  box(g,M(PINK),B.x0,B.x1,-1.5,L+F+.2,B.z0,B.z1);
  hip(g,B.x0-.5,B.x1+.5,B.z0-.5,B.z1+.5,L+F+.2,2.3);
  for(const z of[13.2,17.6]){
    plane(g,M(GLASS),1.3,1.2,B.x1+.03,L+1.6,z,Math.PI/2);
    plane(g,M('#e8e3d8'),1.3,1.2,B.x1+.04,L+1.6,z,Math.PI/2);                       // closed white louvres
    for(let k=0;k<6;k++)box(g,M('#cfc8bb'),B.x1+.04,B.x1+.07,L+1.1+k*.2,L+1.13+k*.2,z-.62,z+.62,false);
    box(g,M(WHITE),B.x1,B.x1+.1,L+.9,L+1.0,z-.8,z+.8,false);box(g,M(WHITE),B.x1,B.x1+.08,L+2.2,L+2.3,z-.8,z+.8,false);
  }
  // ---- garage box flush with the sidewalk at the south end ----
  const G={x0:-6.5,x1:0,z0:ROSA_D-5,z1:ROSA_D};
  box(g,M(PINK),G.x0,G.x1,-1.5,F,G.z0,G.z1);
  box(g,M(WHITE),G.x0-.2,G.x1+.25,F,F+.25,G.z0-.2,G.z1+.2);
  plane(g,M('#efede8'),3.6,2.5,.03,1.25,(G.z0+G.z1)/2,Math.PI/2);
  for(let k=1;k<7;k++)box(g,M('#d8d5ce'),.03,.06,k*.36-.02,k*.36+.02,(G.z0+G.z1)/2-1.75,(G.z0+G.z1)/2+1.75,false);
  g.userData.h=L+2*F+.3;
  return g;
}
// collision footprints in the model frame: [x0,x1,z0,z1,top]
export const ROSA_SOLIDS:[number,number,number,number,number][]=[
  [-15.7,-3.8,.5,11.7,ROSA_LIFT+6.3],[-12.5,-2.7,10.5,21,ROSA_LIFT+5.5],[-6.7,.3,ROSA_D-5.2,ROSA_D+.2,3.3],
  [-ROSA_W,-1.6,-.4,0,ROSA_LIFT+1.5],[0,.4,1.6,ROSA_D-5,ROSA_LIFT+1.5],
];
export default {category:'Divinolândia',label:'Casa rosa da esquina (R. José Augusto Machado × R. Francisco P. de Souza)',build};
