import * as THREE from 'three';
import {matte} from '../matte.ts';
import {leafMat,leafMass} from './copa.ts';
import {drape,kerb,circle,lawnM,pathM,pathEdgeM,stoneM,type GroundAt,type P2} from './praca-chao.ts';
import {canvasTex,flat} from './posto-kit.ts';
import Ciclista from './ciclista-aco.ts';
import Palmeira from './palmeira-fenix.ts';

// Monumento ao Ciclista — the town's east entrance, where the Avenida A leaves the SP-344
// by the Mahindra dealer (Google Maps "MONUMENTO CICLISTA", 87QF+QX). Rebuilt from Google
// Street View (panoramas round the square: monumento-ciclista on the Avenida A, -w on the
// highway, -nw, -s, -e, the -zoom close-ups) and the z20/z21 satellite (gridded with
// tools/capture-satellite.ts), kept locally in docs/divinolandia/referencias-*:
//  - the MONUMENT: a raw-concrete band ~8.6 m long and 1 m thick shaped like a wave — a
//    vertical pier at the NNE end whose top is a steep ramp, a level crest, then a long
//    curve down to the ground at the SSW end, open underneath (an arch); three life-size
//    stainless-steel mountain bikers ride it toward the highway: one climbing the ramp,
//    two along the crest (ciclista-aco.ts); a dark plaque on each face of the pier;
//  - the half-moon SQUARE it stands in (11.3 m radius, flat side to the SE where the
//    ground falls away): lawn, a ring path of grey pavers with red borders, the gravel bed
//    round the monument with stepping discs, spotlights and fountain grass, round concrete
//    planters with palms, the low round flower bed, the curved concrete bench with its
//    white gravel, the bike rack of steel hoops and the grey drinking-water post.
// build({groundAt}) is pure; TOWN-LOCAL coordinates shifted by ORIGIN (as the fuel stations).
// MONUMENTO_FOOT = collision boxes [x, z, w, d, rot, height] (town-local).
export const ORIGIN:P2=[1480.3,-167.9];
const R=11.3,U:P2=[.887,-.461],N:P2=[-.461,-.887];                    // the flat side's direction, and the way into the half-moon
const M:P2=[1475.5,-173.6];                                            // middle of the monument
const AX:P2=[-.568,.823];                                              // the riding direction (NNE → SSW)
const ROT=Math.atan2(AX[1],AX[0]);                                     // AX = (cos ROT, sin ROT)
export const MONUMENTO_FOOT:[number,number,number,number,number,number][]=[
  [M[0]-AX[0]*3.1,M[1]-AX[1]*3.1,1.7,1.05,ROT,3.1],                    // the pier
  [M[0]+AX[0]*3.4,M[1]+AX[1]*3.4,2.7,1.05,ROT,2.9],                    // the curve down (you can walk under the crest)
  [1478.7,-169.6,1.4,1.4,0,.8],[1480.8,-168.6,1.4,1.4,0,.8],[1482.2,-175.3,1.4,1.4,0,.8],
];
const half=(r:number,n=40):P2[]=>{const out:P2[]=[];for(let i=0;i<=n;i++){const a=i/n*Math.PI;
  out.push([ORIGIN[0]+r*(Math.cos(a)*U[0]+Math.sin(a)*N[0]),ORIGIN[1]+r*(Math.cos(a)*U[1]+Math.sin(a)*N[1])]);}return out;};
// a point of the half-moon by polar coordinates (angle from the flat side's east end)
const polar=(r:number,a:number):P2=>[ORIGIN[0]+r*(Math.cos(a)*U[0]+Math.sin(a)*N[0]),ORIGIN[1]+r*(Math.cos(a)*U[1]+Math.sin(a)*N[1])];

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);

  // ---- the square: lawn, the paver ring path with its red borders, kerb round the arc
  g.add(drape(half(R-1.7),at,.06,lawnM));
  const ring=(r0:number,r1:number):P2[]=>[...half(r1),...half(r0).reverse()];
  g.add(drape(ring(R-1.7,R),at,.08,pathEdgeM));
  g.add(drape(ring(R-.35,R-.12),at,.085,pathM));g.add(drape(ring(R-1.65,R-1.42),at,.085,pathM));
  for(const a of[.35,1.2,2.1,2.85]){                                   // red cross bands in the path
    const p=polar(R-.9,a),q=[Math.cos(a)*U[0]+Math.sin(a)*N[0],Math.cos(a)*U[1]+Math.sin(a)*N[1]],t=[-q[1],q[0]];
    g.add(drape([[p[0]-q[0]*.8-t[0]*.2,p[1]-q[1]*.8-t[1]*.2],[p[0]+q[0]*.8-t[0]*.2,p[1]+q[1]*.8-t[1]*.2],
      [p[0]+q[0]*.8+t[0]*.2,p[1]+q[1]*.8+t[1]*.2],[p[0]-q[0]*.8+t[0]*.2,p[1]-q[1]*.8+t[1]*.2]],at,.09,pathM));
  }
  kerb(g,at,half(R),false,.15,.15);kerb(g,at,half(R-1.7),false,.1,.1);

  // ---- the gravel bed round the monument, its stepping discs, spotlights and grasses
  const ell:P2[]=[];for(let i=0;i<32;i++){const a=i/32*Math.PI*2,u=Math.cos(a)*6,v=Math.sin(a)*2.4;
    ell.push([M[0]+u*AX[0]-v*AX[1],M[1]+u*AX[1]+v*AX[0]]);}
  g.add(drape(ell,at,.1,gravelM(),[],1.5));
  kerb(g,at,[...ell,ell[0]],false,.14,.08,matte({color:0xb85a3c}));
  const along=(u:number,v:number):P2=>[M[0]+u*AX[0]-v*AX[1],M[1]+u*AX[1]+v*AX[0]];
  for(const[u,v]of[[-4.6,1.4],[-1.8,1.6],[1.2,1.7],[3.9,1.3],[-3.2,-1.6]] as P2[]){
    const[x,z]=along(u,v);g.add(drape(circle(x,z,.32,12),at,.12,stoneM));
  }
  for(const[u,v]of[[-5,-1.3],[0,-1.9],[4.8,-1],[-2.5,1.9],[2.7,2]] as P2[]){
    const[x,z]=along(u,v),y=at(x,z),l=new THREE.Mesh(new THREE.BoxGeometry(.22,.16,.14),flat('#222324'));
    l.position.set(x,y+.16,z);l.rotation.set(-.6,Math.atan2(M[0]-x,M[1]-z),0,'YXZ');g.add(l);
  }
  const grass=leafMat(0x9c9a6c),plume=matte({color:0xc7b9a0,side:THREE.DoubleSide});
  const tuft=(x:number,z:number,s:number):void=>{
    const y=at(x,z),b=new THREE.Mesh(leafMass(2,.35,2),grass);b.scale.set(.45*s,.35*s,.45*s);b.position.set(x,y+.25*s,z);g.add(b);
    for(let k=0;k<6;k++){const a=k/6*Math.PI*2+x,p=new THREE.Mesh(new THREE.PlaneGeometry(.05,.55*s),plume);
      p.position.set(x+Math.cos(a)*.25*s,y+.6*s,z+Math.sin(a)*.25*s);p.rotation.set(Math.sin(a)*.5,a,Math.cos(a)*.5);g.add(p);}
  };
  for(const[u,v]of[[-5.6,0],[-4,2.1],[-2,-2.2],[.6,2.2],[2.5,-2.1],[4.2,2],[5.4,-.3],[-.8,-2.4],[3.6,-2.3],[-5.2,-2]] as P2[]){
    const[x,z]=along(u,v);tuft(x,z,1+(Math.abs(u*7+v*3)%3)*.15);}

  // ---- the monument itself
  monument(g,at);

  // ---- round concrete planters with palms, the low round flower bed, the curved bench
  const concrete=flat('#b6b5af');
  for(const[x,z]of[[1478.7,-169.6],[1480.8,-168.6],[1482.2,-175.3]] as P2[]){
    const y=at(x,z),p=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,.85,20,1,true),matte({color:0xb6b5af,side:THREE.DoubleSide}));
    p.position.set(x,y+.42,z);p.castShadow=true;g.add(p);
    const lip=new THREE.Mesh(new THREE.TorusGeometry(.66,.05,4,20),concrete);lip.rotation.x=Math.PI/2;lip.position.set(x,y+.85,z);g.add(lip);
    const soil=new THREE.Mesh(new THREE.CircleGeometry(.66,20),flat('#5a4130'));soil.rotation.x=-Math.PI/2;soil.position.set(x,y+.72,z);g.add(soil);
    const palm=Palmeira.build({h:1.8,seed:Math.round(x)});palm.position.set(x,y+.72,z);g.add(palm);
    for(let k=0;k<3;k++){const b=new THREE.Mesh(leafMass(k+1,.3,2),leafMat(0x4f7a3c));b.scale.setScalar(.18);b.position.set(x+Math.cos(k*2)*.35,y+.82,z+Math.sin(k*2)*.35);g.add(b);}
  }
  {
    const[x,z]=polar(5.6,1.15),y=at(x,z);
    const r=new THREE.Mesh(new THREE.CylinderGeometry(1.45,1.45,.45,28,1,true),matte({color:0xb6b5af,side:THREE.DoubleSide}));r.position.set(x,y+.22,z);g.add(r);
    const top=new THREE.Mesh(new THREE.RingGeometry(1.3,1.45,28),concrete);top.rotation.x=-Math.PI/2;top.position.set(x,y+.45,z);g.add(top);
    const lawn=new THREE.Mesh(new THREE.CircleGeometry(1.3,28),matte({color:0x5f7a40}));lawn.rotation.x=-Math.PI/2;lawn.position.set(x,y+.4,z);g.add(lawn);
  }
  {
    // the curved bench: a low concrete wall on an arc, white gravel in front of it
    const c=polar(6.5,.45),pts:P2[]=[],pts2:P2[]=[];
    for(let i=0;i<=16;i++){const a=-.2+i/16*1.5,dx=Math.cos(a+2.1),dz=Math.sin(a+2.1);pts.push([c[0]+dx*3,c[1]+dz*3]);pts2.push([c[0]+dx*1.8,c[1]+dz*1.8]);}
    g.add(drape([...pts,...pts2.reverse()],at,.09,stoneM));
    kerb(g,at,pts,false,.45,.45,concrete,.4);
  }
  // ---- the bike rack: five inverted-U steel hoops
  {
    const steel=flat('#b9bec2');
    for(let k=0;k<5;k++){
      const a=2.15+k*.085,[x,z]=polar(8.4,a),y=at(x,z);
      const h=new THREE.Mesh(new THREE.TorusGeometry(.32,.025,5,14,Math.PI),steel);
      const leg=(s:number):void=>{const l=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.5,6),steel);l.position.set(s*.32,-.25,0);h.add(l);};
      leg(-1);leg(1);h.position.set(x,y+.55,z);h.rotation.y=-Math.atan2(Math.sin(a)*N[1]+Math.cos(a)*U[1],Math.sin(a)*N[0]+Math.cos(a)*U[0]);g.add(h);   // each hoop across the row
    }
  }
  // ---- the drinking-water post (bebedouro) at the north corner
  {
    const[x,z]=polar(9.6,1.95),y=at(x,z);
    const b=new THREE.Mesh(new THREE.BoxGeometry(.55,1.25,.45),flat('#8f969a'));b.position.set(x,y+.62,z);b.castShadow=true;g.add(b);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.7,.06,.6),flat('#6f7579'));cap.position.set(x,y+1.28,z);g.add(cap);
    const bowl=new THREE.Mesh(new THREE.BoxGeometry(.35,.08,.25),flat('#d6d9da'));bowl.position.set(x,y+.95,z+.3);g.add(bowl);
  }
  return root;
}

let gm:THREE.Material|null=null;
function gravelM():THREE.Material{
  if(!gm)gm=matte({map:canvasTex(128,128,(c,w,h)=>{
    c.fillStyle='#8f8b84';c.fillRect(0,0,w,h);
    for(let i=0;i<2600;i++){const v=110+((i*73)%120);c.fillStyle=`rgb(${v},${v-3},${v-8})`;c.fillRect((i*37)%w,(i*91+i*i)%h,2,2);}
  }),polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5});
  return gm;
}

// The concrete wave and its three riders, in the monument's own frame (x along the ride,
// from the pier at x = 0 to the foot of the curve at x = 8.6; z across, 1 m thick).
function monument(g:THREE.Group,at:GroundAt):void{
  const L=8.6,T=1.0,x0=-3.9;                         // x0: the pier's back, from the middle M
  const base=Math.min(at(...along0(x0)),at(...along0(x0+L)),at(...M))-.15;
  const top=Math.max(at(...along0(x0)),at(...along0(x0+1.6)))+.05;   // the pier stands on the higher ground
  const H0=top-base;                                 // so the profile can start below grade
  const s=new THREE.Shape();
  s.moveTo(0,0);s.lineTo(0,H0+.9);                   // the pier's back
  s.lineTo(1.6,H0+2.6);                              // the steep ramp
  s.lineTo(4.9,H0+2.72);                             // the crest
  s.bezierCurveTo(7.1,H0+2.78,8.4,H0+1.6,L,0);      // the long curve down to the ground
  s.lineTo(L-.85,0);
  s.bezierCurveTo(7.4,H0+1.0,6.6,H0+2.15,4.8,H0+2.3);  // the arch's underside
  s.lineTo(1.75,H0+2.2);s.lineTo(1.6,0);s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:T,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:1,curveSegments:16});
  geo.translate(0,0,-T/2);
  const cm=matte({map:canvasTex(256,256,(c,w,h)=>{          // board-formed concrete: plank joints and stains
    c.fillStyle='#bdbab2';c.fillRect(0,0,w,h);
    for(let i=0;i<8;i++){c.fillStyle=`rgba(${120+i*7},${118+i*6},${110+i*5},.25)`;c.fillRect(0,i*32+2,w,28);c.fillStyle='rgba(90,86,80,.35)';c.fillRect(0,i*32,w,1.5);}
    for(let i=0;i<12;i++){c.fillStyle='rgba(140,100,60,.18)';c.fillRect((i*53)%w,(i*97)%h,3,30+(i*13)%40);}
  })});
  const uv=geo.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/2.5,uv.getY(i)/2.5);
  const arch=new THREE.Mesh(geo,cm);arch.castShadow=true;arch.receiveShadow=true;
  const frame=new THREE.Group();
  const[px,pz]=along0(x0);frame.position.set(px,base,pz);frame.rotation.y=-ROT;g.add(frame);
  frame.add(arch);
  // the plaques on both faces of the pier
  const pm=matte({map:canvasTex(256,192,(c,w,h)=>{
    c.fillStyle='#3c3a36';c.fillRect(0,0,w,h);c.strokeStyle='#a99a74';c.lineWidth=4;c.strokeRect(6,6,w-12,h-12);
    c.fillStyle='#d8caa0';c.textAlign='center';c.font='700 22px Georgia, serif';c.fillText('MONUMENTO',w/2,58);c.fillText('AO CICLISTA',w/2,88);
    c.font='15px Georgia, serif';c.fillText('Divinolândia · SP',w/2,128);c.fillText('Município de Interesse Turístico',w/2,154);
  })});
  for(const sd of[-1,1]){const p=new THREE.Mesh(new THREE.PlaneGeometry(.75,.55),pm);p.position.set(.8,H0+.3,sd*(T/2+.04));p.rotation.y=sd>0?0:Math.PI;frame.add(p);}
  // the riders: one up the ramp, two along the crest (pitched to the deck)
  const riders:[number,number,number,number][]=[[.85,H0+1.78,Math.atan2(1.7,1.6),.15],[2.75,H0+2.66,.035,.55],[4.35,H0+2.71,.02,.85]];
  for(const[x,y,pitch,pedal]of riders){
    const r=Ciclista.build({pedal});r.position.set(x,y,0);r.rotation.z=pitch;frame.add(r);
  }
}
const along0=(u:number):P2=>[M[0]+u*AX[0],M[1]+u*AX[1]];

export default {category:'Divinolândia',label:'Monumento ao Ciclista',build};
