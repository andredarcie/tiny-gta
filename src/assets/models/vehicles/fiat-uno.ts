import carModel from './car.ts';
import * as THREE from 'three';
import {addVehicleLod} from './vehicle-lod.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';

// Fiat Uno Mille Fire (Brazil, 2004–2013, the "quadrado") — modelled to the real car from
// photos of every side (docs/divinolandia/referencias-uno, local; credits in CREDITOS.json)
// and its data sheet: 3,690 mm long, 1,548 mm wide, 1,445 mm tall, 2,362 mm wheelbase,
// 165/70 R13 tyres. Built in REAL metres with the front axle at z = 0 (z forward, y up,
// x across; -x is the driver's side, like the car rig), then scaled onto the game's car
// rig (car.ts: front axle z = +1.45, 2.53 wheelbase), so it drives, brakes, dents, opens
// its doors and gets stolen like any car.
//
// What makes it a Mille Fire and not just "a small hatch":
//  - the tall, flat-sided Giugiaro box: low hood line, a big upright glasshouse, a flat
//    roof that runs almost to the tail and a near-vertical tailgate (Kamm tail);
//  - the 2004 face: wide clear headlamps, the slim grille between them with three chrome
//    bars and the round Fiat badge, the big black bumper with the plate in the middle;
//  - the long 3-door with the black B-pillar, the fixed quarter window, the black flap
//    handle, the thin black side moulding and the small amber repeater on the wing;
//  - tall corner tail lamps (red over amber over white), the plate on the tailgate
//    between them, the wiper and the "Mille Fire" script;
//  - steel 13" wheels under the plastic hubcap.
// One painted shell (dentable), black trims merged, glass and lamps separate.

const K=2.53/2.362;                         // real metres → rig units (the rig's wheelbase)
const AXLE=1.45;                            // rig z of the front axle
const W=.774;                               // half body width
// Profile measured on a true side elevation (1992_Fiat_Uno_IE_1.0_Side, scaled by the
// wheelbase): hood front edge .77 m high rising to .99 at the windshield base, window line
// .975 → 1.0, side glass top 1.375, roof 1.44, a tailgate raked ~30° from vertical, wheel
// arches of .37 m radius, a tall front bumper (.20–.55).
const NOSE=.66,TAIL=-2.80;                  // body ends (bumpers stick out past them)
const COWL=-.37,ROOF_F=-.93;                // windshield base, roof front edge (the roof runs back to the rear glass)
const ROOF_Y=1.44,SIDE_TOP=1.375;           // roof top, top of the side glass
const DOOR_F=-.47,DOOR_R=-1.62;             // the 3-door's long door
const B_R=-1.70;                            // black B-pillar rear edge
const RG_BOT_Z=-2.70,RG_TOP_Z=-2.475;       // rear glass: bottom / top edges along z (the rake)
const ARCH_R=.37,ARCH_Y=.28,REAR_AX=-2.362;
const SILL=.25;
const RW_TOP=1.375,RW_BOT=1.005;            // rear glass top / bottom heights

// ---------------------------------------------------------------- materials
const glassM=new THREE.MeshStandardMaterial({color:0x232b31,roughness:.06,metalness:.35,
  transparent:true,opacity:.62,depthWrite:false});
const blackM=new THREE.MeshStandardMaterial({color:0x17181a,roughness:.78,metalness:.02}); // textured black plastic
const rubberM=new THREE.MeshStandardMaterial({color:0x0e0f10,roughness:.9});
const chromeM=new THREE.MeshStandardMaterial({color:0xd7dade,roughness:.18,metalness:.95});
const lensM=new THREE.MeshStandardMaterial({color:0xe8eef2,roughness:.04,metalness:.1,transparent:true,opacity:.28,depthWrite:false});
const amberM=new THREE.MeshStandardMaterial({color:0xd98a24,roughness:.2,metalness:.1,emissive:0x2a1400});
const whiteLampM=new THREE.MeshStandardMaterial({color:0xe9e9e6,roughness:.15,metalness:.2});
const tireM=new THREE.MeshStandardMaterial({color:0x1b1b1c,roughness:.92});
const steelM=new THREE.MeshStandardMaterial({color:0x2c2e31,roughness:.6,metalness:.4});
const plateM=new THREE.MeshStandardMaterial({color:0xe6e8e4,roughness:.6});

// ---------------------------------------------------------------- small helpers
type V3=[number,number,number];
// real metres → rig units, in place
function toRig(g:THREE.BufferGeometry):THREE.BufferGeometry{g.scale(K,K,K);g.translate(0,0,AXLE);return g;}
// a one-sided lens: w×h facing the back (dir 0) or out of the side s (dir ±1) — no back
// faces for the cabin to see through the open tail panel
function lens(w:number,h:number,x:number,y:number,z:number,dir=0):THREE.BufferGeometry{
  const g=new THREE.PlaneGeometry(w,h);g.rotateY(dir===0?Math.PI:dir*Math.PI/2);g.translate(x,y,z);return g;
}
function box(w:number,h:number,d:number,x:number,y:number,z:number,rx=0,ry=0,rz=0):THREE.BufferGeometry{
  const g=new THREE.BoxGeometry(w,h,d);
  if(rx||ry||rz)g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx,ry,rz,'YXZ')));
  g.translate(x,y,z);return g;
}
// a box stretched between two points (pillars, wipers, bars), cross-section w × t
function bar(a:V3,b:V3,w:number,t:number,up:V3=[0,1,0]):THREE.BufferGeometry{
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),len=A.distanceTo(B);
  const g=new THREE.BoxGeometry(w,t,len);
  const m=new THREE.Matrix4().lookAt(B,A,new THREE.Vector3(...up));
  g.applyMatrix4(m);g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);return g;
}
// a flat 2D outline (with holes) laid onto a surface: map(u,v) → point
function patch(outline:[number,number][],holes:[number,number][][],map:(u:number,v:number)=>V3,flip=false):THREE.BufferGeometry{
  const shape=new THREE.Shape(outline.map(([u,v])=>new THREE.Vector2(u,v)));
  for(const h of holes)shape.holes.push(new THREE.Path(h.map(([u,v])=>new THREE.Vector2(u,v))));
  const g=new THREE.ShapeGeometry(shape,6);
  const p=g.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<p.count;i++){const q=map(p.getX(i),p.getY(i));p.setXYZ(i,q[0],q[1],q[2]);}
  if(flip){const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const t=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,t);}}
  g.deleteAttribute('uv');g.deleteAttribute('normal');g.computeVertexNormals();
  return g;
}
// a convex polygon's outline pulled in by d (each edge moved inward, corners re-intersected)
function inset(poly:[number,number][],d:number):[number,number][]{
  let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[1]-b[0]*a[1];}
  const sgn=area>0?1:-1,n=poly.length,lines:[number,number,number,number][]=[];
  for(let i=0;i<n;i++){const a=poly[i],b=poly[(i+1)%n],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;
    const nx=-dy/l*sgn,ny=dx/l*sgn;lines.push([a[0]+nx*d,a[1]+ny*d,dx,dy]);}
  return lines.map((L,i)=>{const P=lines[(i+n-1)%n];
    const den=P[2]*L[3]-P[3]*L[2];if(Math.abs(den)<1e-9)return[L[0],L[1]] as [number,number];
    const t=((L[0]-P[0])*L[3]-(L[1]-P[1])*L[2])/den;return[P[0]+P[2]*t,P[1]+P[3]*t] as [number,number];});
}
// rounded-rectangle outline in 2D
function rrect(u0:number,u1:number,v0:number,v1:number,r:number,seg=4):[number,number][]{
  const o:[number,number][]=[];
  const c=(cu:number,cv:number,a0:number):void=>{for(let i=0;i<=seg;i++){const a=a0+i/seg*Math.PI/2;o.push([cu+Math.cos(a)*r,cv+Math.sin(a)*r]);}};
  c(u1-r,v1-r,0);c(u0+r,v1-r,Math.PI/2);c(u0+r,v0+r,Math.PI);c(u1-r,v0+r,Math.PI*1.5);
  return o;
}
// mirror a geometry across x (the left-hand copy of a part) keeping its faces outward
function mirrorX(g:THREE.BufferGeometry):THREE.BufferGeometry{
  g.scale(-1,1,1);
  const idx=g.getIndex();
  if(idx){for(let i=0;i<idx.count;i+=3){const t=idx.getX(i+1);idx.setX(i+1,idx.getX(i+2));idx.setX(i+2,t);}}
  else{const p=g.getAttribute('position') as THREE.BufferAttribute;for(let i=0;i<p.count;i+=3)for(let a=0;a<3;a++){const t=p.getComponent(i+1,a);p.setComponent(i+1,a,p.getComponent(i+2,a));p.setComponent(i+2,a,t);}}
  g.computeVertexNormals();return g;
}
const nonIndexed=(g:THREE.BufferGeometry):THREE.BufferGeometry=>{const n=g.index?g.toNonIndexed():g;if(n.getAttribute('uv'))n.deleteAttribute('uv');return n;};
const merge=(gs:THREE.BufferGeometry[]):THREE.BufferGeometry=>mergeGeometries(gs.map(nonIndexed),false);

// ---------------------------------------------------------------- the side profile
// top of the lower body's sides: the hood edge (rising from the nose to the cowl), then the
// window line, very slightly rising to the tail
function sideTop(z:number):number{
  if(z>COWL){const t=(NOSE-z)/(NOSE-COWL);return .765+(.985-.765)*(1-Math.pow(1-t,1.35));}
  if(z<RG_BOT_Z)return beltY(RG_BOT_Z)+(z-RG_BOT_Z)*(RW_TOP-RW_BOT)/(RG_TOP_Z-RG_BOT_Z);   // down the tailgate's rake
  return beltY(z);
}
// bottom of the sides: the sill, raised round the wheel arches
function sideBottom(z:number):number{
  let y=SILL;
  for(const ax of[0,REAR_AX]){const d=z-ax;if(Math.abs(d)<ARCH_R)y=Math.max(y,ARCH_Y+Math.sqrt(ARCH_R*ARCH_R-d*d));}
  // the bumpers' undersides tuck the ends up a little
  if(z>NOSE-.12)y=Math.max(y,SILL+(z-(NOSE-.12))*.6);
  if(z<TAIL+.1)y=Math.max(y,SILL+((TAIL+.1)-z)*.5);
  return y;
}
// half width in plan: the corners are rounded, a little more at the nose
function halfWidth(z:number):number{
  const rn=.07,rt=.08;
  if(z>NOSE-rn){const d=z-(NOSE-rn);return W-rn+Math.sqrt(Math.max(0,rn*rn-d*d));}
  if(z<TAIL+rt){const d=(TAIL+rt)-z;return W-rt+Math.sqrt(Math.max(0,rt*rt-d*d));}
  return W;
}
// window line (glass bottom) along the side, and the tumblehome of the glass
function beltY(z:number):number{return .985+Math.max(0,COWL-z)*.008;}
const glassX=(y:number,z:number):number=>{const b=beltY(z),t=(y-b)/(SIDE_TOP-b);return W-.028-t*.088;};

// ---------------------------------------------------------------- the painted shell
// The lower body is a thin-walled U lofted along z: outer side, the bottom, the other side,
// a belt cap and the inner wall (so the cabin is open above the window line and the
// interior shows through the glass). Ring segments carry a class so the door can be cut
// out of the sides and built from the very same quads.
type Seg='sideL'|'sideR'|'bottom'|'capL'|'capR'|'innerL'|'innerR';
const TH=.035,RT=.045,RB=.07;
function ring(z:number):{pts:[number,number][];seg:Seg[]}{
  const w=halfWidth(z),yt=sideTop(z),yb=sideBottom(z);
  const pts:[number,number][]=[],seg:Seg[]=[];
  const arc=(cx:number,cy:number,r:number,a0:number,a1:number,cls:Seg,n=4):void=>{
    for(let i=1;i<=n;i++){const a=a0+(a1-a0)*i/n;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);seg.push(cls);}
  };
  // start: left belt, inner edge
  pts.push([-(w-TH),yt]);
  pts.push([-(w-RT),yt]);seg.push('capL');
  arc(-(w-RT),yt-RT,RT,Math.PI/2,Math.PI,'sideL');                 // top edge, left
  pts.push([-w,yb+RB]);seg.push('sideL');
  arc(-(w-RB),yb+RB,RB,Math.PI,Math.PI*1.5,'bottom');               // bottom edge, left
  pts.push([w-RB,yb]);seg.push('bottom');
  arc(w-RB,yb+RB,RB,-Math.PI/2,0,'bottom');
  pts.push([w,yt-RT]);seg.push('sideR');
  arc(w-RT,yt-RT,RT,0,Math.PI/2,'sideR');
  pts.push([w-TH,yt]);seg.push('capR');
  pts.push([w-TH,yb+TH]);seg.push('innerR');
  pts.push([-(w-TH),yb+TH]);seg.push('bottom');
  seg.push('innerL');                                               // closes back to the start
  return{pts,seg};
}
// loft stations: dense round the arches and the ends, exactly on the door edges
const STATIONS=(():number[]=>{
  const s=new Set<number>();
  for(let z=TAIL;z<=NOSE+1e-6;z+=.06)s.add(+z.toFixed(4));
  for(const ax of[0,REAR_AX])for(let d=-ARCH_R-.02;d<=ARCH_R+.02;d+=.02)s.add(+(ax+d).toFixed(4));
  for(let z=NOSE-.14;z<=NOSE;z+=.015)s.add(+z.toFixed(4));
  for(let z=TAIL;z<=TAIL+.11;z+=.015)s.add(+z.toFixed(4));
  for(const z of[DOOR_F,DOOR_R,COWL])s.add(z);
  return[...s].filter(z=>z>=TAIL&&z<=NOSE).sort((a,b)=>a-b);
})();
function loftBody():{shell:THREE.BufferGeometry;doorL:THREE.BufferGeometry;doorR:THREE.BufferGeometry;nose:THREE.BufferGeometry;tail:THREE.BufferGeometry}{
  const rings=STATIONS.map(z=>({z,...ring(z)}));
  const shell:number[]=[],dL:number[]=[],dR:number[]=[];
  const n=rings[0].pts.length;
  for(let i=1;i<rings.length;i++){
    const A=rings[i-1],B=rings[i],inDoor=A.z>=DOOR_R-1e-6&&B.z<=DOOR_F+1e-6;
    for(let k=0;k<n;k++){
      const k2=(k+1)%n,cls=A.seg[k];
      const a=A.pts[k],b=A.pts[k2],c=B.pts[k2],d=B.pts[k];
      const quad=[a[0],a[1],A.z, d[0],d[1],B.z, c[0],c[1],B.z, a[0],a[1],A.z, c[0],c[1],B.z, b[0],b[1],A.z];
      const left=cls==='sideL'||cls==='capL'||cls==='innerL',right=cls==='sideR'||cls==='capR'||cls==='innerR';
      if(inDoor&&left)dL.push(...quad);else if(inDoor&&right)dR.push(...quad);else shell.push(...quad);
    }
  }
  const geo=(a:number[]):THREE.BufferGeometry=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();return g;};
  // end panels: the nose below the hood and the tailgate's lower panel
  const cap=(z:number,flip:boolean):THREE.BufferGeometry=>{
    const w=halfWidth(z),yt=sideTop(z),yb=sideBottom(z);
    const o=rrect(-w,w,yb,yt,.05);
    return patch(o,[],(u,v)=>[u,v,z],flip);
  };
  return{shell:geo(shell),doorL:geo(dL),doorR:geo(dR),nose:cap(NOSE,false),tail:cap(TAIL,true)};
}
// hood lid: from the nose to the cowl, between the two top edges, slightly crowned; its
// front edge rolls down onto the nose
function hood():THREE.BufferGeometry{
  const pos:number[]=[],NU=10,zs:number[]=[];
  for(let z=COWL;z<=NOSE+1e-6;z+=.05)zs.push(z);if(zs[zs.length-1]<NOSE)zs.push(NOSE);
  const P=(u:number,z:number):V3=>{
    const w=halfWidth(z)-RT,crown=.022*(1-u*u)*Math.min(1,(NOSE-z)/.12)*Math.min(1,(z-COWL)/.1+.3);
    const roll=z>NOSE-.05?(z-(NOSE-.05))*.5:0;
    return[u*w,sideTop(z)+crown-roll,z];
  };
  for(let j=1;j<zs.length;j++)for(let i=0;i<NU;i++){
    const u0=-1+2*i/NU,u1=-1+2*(i+1)/NU;
    const a=P(u0,zs[j-1]),b=P(u1,zs[j-1]),c=P(u1,zs[j]),d=P(u0,zs[j]);
    pos.push(...a,...c,...b,...a,...d,...c);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  return g;
}
// roof: a slab with a slight crown whose edges roll down to the top of the side glass, and
// whose front and rear edges roll down to the windshield / tailgate glass
function roof():THREE.BufferGeometry{
  const pos:number[]=[],zs:number[]=[];
  for(let z=RG_TOP_Z;z<=ROOF_F+1e-6;z+=.08)zs.push(z);if(zs[zs.length-1]<ROOF_F)zs.push(ROOF_F);
  const sec=(z:number):V3[]=>{
    const ends=Math.min(1,(z-RG_TOP_Z)/.07,(ROOF_F-z)/.07),drop=(1-ends)*.035;
    const o:V3[]=[];const wTop=.6,xs=glassX(SIDE_TOP,z)-.004,rx=xs-wTop,ry=ROOF_Y-drop-SIDE_TOP;
    for(let i=0;i<=5;i++){const a=i/5*Math.PI/2;o.push([-(wTop+rx*Math.cos(a)),SIDE_TOP+ry*Math.sin(a),z]);}
    for(let i=1;i<10;i++){const u=-1+i/5;o.push([u*wTop,ROOF_Y-drop+.012*(1-u*u),z]);}
    for(let i=5;i>=0;i--){const a=i/5*Math.PI/2;o.push([wTop+rx*Math.cos(a),SIDE_TOP+ry*Math.sin(a),z]);}
    return o;
  };
  for(let j=1;j<zs.length;j++){
    const A=sec(zs[j-1]),B=sec(zs[j]);
    for(let i=1;i<A.length;i++)pos.push(...A[i-1],...A[i],...B[i],...A[i-1],...B[i],...B[i-1]);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  // the loft winds inside-out on one side of the crown: face every triangle up/out
  const p=g.getAttribute('position') as THREE.BufferAttribute,nr=g.getAttribute('normal') as THREE.BufferAttribute;
  for(let i=0;i<p.count;i+=3){
    const cx=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,cy=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;
    const ox=cx,oy=cy-1.0;
    if(nr.getX(i)*ox+nr.getY(i)*oy<0){for(let a=0;a<3;a++){const t=p.getComponent(i+1,a);p.setComponent(i+1,a,p.getComponent(i+2,a));p.setComponent(i+2,a,t);}}
  }
  g.computeVertexNormals();
  return g;
}
// the upper sides (A-pillar foot, C-pillar, the panel round the quarter window) on the
// tumblehome surface between the window line and the roof, with the openings cut out
const sidePlane=(side:number,off=0)=>(z:number,y:number):V3=>[side*(glassX(y,z)+off),y,z];
const DOOR_WIN:[number,number][]=[[DOOR_F-.09,beltY(DOOR_F)-.012],[DOOR_R+.02,beltY(DOOR_R)-.012],[DOOR_R+.02,SIDE_TOP],[ROOF_F-.02,SIDE_TOP],[DOOR_F-.1,beltY(DOOR_F)+.13]];
// the fixed quarter window: its rear edge leans with the tailgate
const QUARTER_WIN:[number,number][]=[[B_R-.03,beltY(B_R)+.025],[-2.5,beltY(-2.5)+.025],[-2.36,SIDE_TOP-.05],[B_R-.03,SIDE_TOP-.05]];
function upperSides():THREE.BufferGeometry{
  const out:THREE.BufferGeometry[]=[];
  for(const s of[-1,1]){
    // C-pillar and the panel behind the quarter window, up to the roof edge
    const outline:[number,number][]=[[B_R,beltY(B_R)-.015],[RG_BOT_Z-.05,beltY(RG_BOT_Z)-.015],[RG_TOP_Z-.03,SIDE_TOP+.005],[B_R,SIDE_TOP+.005]];
    // outline is (z,y); ShapeGeometry wants a CCW polygon — map u=z, v=y and flip per side
    const g=patch(outline,[QUARTER_WIN.map(([z,y])=>[z-.0,y] as [number,number])],(u,v)=>sidePlane(s,.006)(u,v),s>0);
    out.push(g);
    // A-pillar foot: the small triangle between the door frame and the windshield
    const pos:number[]=[],N=10,ws=windshieldGeo(-.022);
    const edge=(v:number):[V3,V3]=>{const a=ws(s,v);const zb=a[2]-.075;return[a,[s*(glassX(Math.min(a[1],SIDE_TOP),zb)+.006),a[1],zb]];};
    for(let i=0;i<N;i++){const[a0,b0]=edge(i/N),[a1,b1]=edge((i+1)/N);
      if(s>0)pos.push(...a0,...b0,...b1,...a0,...b1,...a1);else pos.push(...a0,...b1,...b0,...a0,...a1,...b1);}
    const ap=new THREE.BufferGeometry();ap.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));ap.computeVertexNormals();out.push(ap);
  }
  return merge(out);
}
// tailgate surround: the painted frame round the rear window, between the C-pillars
// the raked tailgate plane: height v → z along the rake (off pushes it outward, backward)
const rearPlane=(off=0)=>(u:number,v:number):V3=>{const t=(v-RW_BOT)/(RW_TOP-RW_BOT);return[u,v,RG_BOT_Z+t*(RG_TOP_Z-RG_BOT_Z)-off];};
function tailgateFrame():THREE.BufferGeometry{
  const zAt=(v:number):number=>rearPlane()(0,v)[2];
  const xAt=(v:number):number=>v<=SIDE_TOP?glassX(v,zAt(v))+.004:.6+(glassX(SIDE_TOP,zAt(v))-.6)*Math.cos(Math.asin(Math.min(1,(v-SIDE_TOP)/(ROOF_Y-.035-SIDE_TOP))));
  const vs:number[]=[];for(let v=sideTop(TAIL);v<ROOF_Y-.04;v+=.04)vs.push(v);vs.push(ROOF_Y-.04);
  const outline:[number,number][]=[...vs.map(v=>[xAt(v),v] as [number,number]),...vs.slice().reverse().map(v=>[-xAt(v),v] as [number,number])];
  const hole=rrect(-.585,.585,RW_BOT,RW_TOP,.06).map(([u,v])=>[u*(1-(v-RW_BOT)/(RW_TOP-RW_BOT)*.06),v] as [number,number]);
  return patch(outline,[hole],rearPlane(),true);
}
// windshield frame: a band round the glass (the header under the roof, the pillars)
function windshieldGeo(inset:number):(u:number,v:number)=>V3{
  // u across (-1..1), v up (0..1): bottom edge at the cowl, top under the roof front
  return(u,v)=>{
    const z=COWL-.015+(ROOF_F+.03-(COWL-.015))*v,y=.99+(SIDE_TOP+.04-.99)*v;
    const hw=(.71-inset)+((.615-inset)-(.71-inset))*v;
    const bulge=.035*(1-u*u)*Math.sin(v*Math.PI)*0+.03*(1-u*u);
    return[u*hw,y,z+bulge*.6];
  };
}
function gridPatch(f:(u:number,v:number)=>V3,nu=8,nv=6):THREE.BufferGeometry{
  const pos:number[]=[];
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    const u0=-1+2*i/nu,u1=-1+2*(i+1)/nu,v0=j/nv,v1=(j+1)/nv;
    const a=f(u0,v0),b=f(u1,v0),c=f(u1,v1),d=f(u0,v1);
    pos.push(...a,...b,...c,...a,...c,...d);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}

// ---------------------------------------------------------------- textures (badges, hubcaps)
function canvasTex(w:number,h:number,draw:(x:CanvasRenderingContext2D)=>void):THREE.Texture{
  if(typeof document==='undefined')return new THREE.Texture();
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d')!);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
// the round Fiat badge of the 2000s: chrome ring, crimson field, chrome FIAT letters
const badgeTex=canvasTex(128,128,x=>{
  const g=x.createRadialGradient(54,48,6,64,64,64);g.addColorStop(0,'#f4f6f8');g.addColorStop(1,'#8d9298');
  x.fillStyle=g;x.beginPath();x.arc(64,64,62,0,7);x.fill();
  const r=x.createRadialGradient(56,50,4,64,64,50);r.addColorStop(0,'#c22a33');r.addColorStop(1,'#6e0e16');
  x.fillStyle=r;x.beginPath();x.arc(64,64,49,0,7);x.fill();
  x.fillStyle='#eef0f2';x.font='bold 30px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText('FIAT',64,66);
});
// "Mille Fire" script of the tailgate
const scriptTex=canvasTex(256,64,x=>{
  x.fillStyle='rgba(0,0,0,0)';x.fillRect(0,0,256,64);
  x.font='italic bold 40px Arial';x.textBaseline='middle';x.fillStyle='#c9cdd2';x.strokeStyle='#4a4f55';x.lineWidth=2;
  x.strokeText('Mille Fire',8,34);x.fillText('Mille Fire',8,34);
});
// Mille Fire hubcap: silver plastic, a ring of trapezoid vents round a dished centre
const hubTex=canvasTex(256,256,x=>{
  const c=128;
  const g=x.createRadialGradient(110,105,10,c,c,128);g.addColorStop(0,'#eceef0');g.addColorStop(.7,'#b9bdc2');g.addColorStop(1,'#8c9095');
  x.fillStyle=g;x.beginPath();x.arc(c,c,127,0,7);x.fill();
  x.strokeStyle='rgba(60,64,70,.55)';x.lineWidth=3;x.beginPath();x.arc(c,c,118,0,7);x.stroke();x.beginPath();x.arc(c,c,52,0,7);x.stroke();
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2;x.save();x.translate(c,c);x.rotate(a);
    x.fillStyle='#24272b';x.beginPath();x.moveTo(-8,-62);x.lineTo(8,-62);x.lineTo(14,-108);x.lineTo(-14,-108);x.closePath();x.fill();
    x.fillStyle='rgba(255,255,255,.35)';x.fillRect(9,-104,3,38);
    x.restore();
  }
  x.fillStyle='#c8ccd1';x.beginPath();x.arc(c,c,28,0,7);x.fill();
  x.fillStyle='#7d0f18';x.beginPath();x.arc(c,c,15,0,7);x.fill();
});
const badgeM=new THREE.MeshStandardMaterial({map:badgeTex,roughness:.25,metalness:.6});
const scriptM=new THREE.MeshStandardMaterial({map:scriptTex,transparent:true,roughness:.3,metalness:.6});
const hubM=new THREE.MeshStandardMaterial({map:hubTex,roughness:.35,metalness:.55});

// ---------------------------------------------------------------- shared geometry (built once)
const BODY=loftBody();
const SHELL_GEO=toRig(merge([BODY.shell,BODY.nose,BODY.tail,hood(),roof(),upperSides(),tailgateFrame(),
  // cowl lip under the windshield and the drip of the roof's front edge, in paint
  bar([-.69,.992,COWL+.01],[.69,.992,COWL+.01],.03,.04)]));

// black plastic: bumpers (wrapping round to the arches), the cowl panel, the side
// moulding, the B-pillar appliqué, the window rubbers, the mirrors, handles, wipers
function bumper(zFace:number,dir:number,yb:number,yt:number,wrap:number):THREE.BufferGeometry{
  // plan path round the end: from the arch on one side, round the corner, across, and back
  const r=.17,w=W+.016,path:[number,number][]=[];
  const zEnd=zFace-dir*wrap;
  for(let i=0;i<=3;i++)path.push([-w,zEnd+(zFace-dir*r-zEnd)*i/3]);
  for(let i=1;i<=8;i++){const a=Math.PI-i/8*Math.PI/2;path.push([-w+r+Math.cos(a)*r,zFace-dir*r+dir*Math.sin(a)*r]);}
  for(let i=1;i<10;i++)path.push([-w+r+(2*(w-r))*i/10,zFace]);
  for(let i=0;i<=8;i++){const a=Math.PI/2-i/8*Math.PI/2;path.push([w-r+Math.cos(a)*r,zFace-dir*r+dir*Math.sin(a)*r]);}
  for(let i=1;i<=3;i++)path.push([w,zFace-dir*r+(zEnd-(zFace-dir*r))*i/3]);
  // vertical section (outward offset d, height y): a thick rounded face with a small step
  // above the plate line and the lip under it
  const h=yt-yb,prof:[number,number][]=[[-.06,yt],[-.02,yt],[0,yt-.03],[.008,yt-.07],[.012,yb+h*.55],[.004,yb+h*.48],[.006,yb+.05],[-.01,yb],[-.06,yb]];
  const pos:number[]=[];
  const out=(i:number):[number,number]=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return[dz/l*dir*-1,-dx/l*dir*-1];};
  const P=(i:number,k:number):V3=>{const[nx,nz]=out(i),[d,y]=prof[k];return[path[i][0]+nx*d,y,path[i][1]+nz*d];};
  for(let i=1;i<path.length;i++)for(let k=1;k<prof.length;k++){
    const a=P(i-1,k-1),b=P(i,k-1),c=P(i,k),e=P(i-1,k);
    if(dir>0)pos.push(...a,...c,...b,...a,...e,...c);else pos.push(...a,...b,...c,...a,...c,...e);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  return g;
}
const FRONT_FACE=.705,REAR_FACE=-2.885;
function blackParts():THREE.BufferGeometry{
  const p:THREE.BufferGeometry[]=[];
  p.push(bumper(FRONT_FACE,1,.2,.545,FRONT_FACE-ARCH_R+.02),bumper(REAR_FACE,-1,.27,.6,-(REAR_FACE-(REAR_AX-ARCH_R))+.02));
  // the front bumper's lower intake and the plate recess are separate darker pieces (below)
  // cowl panel with its vents, between the hood and the windshield
  p.push(box(1.36,.022,.1,0,.995,COWL-.04,-.25));
  // side moulding along the sides (the door carries its own piece)
  for(const s of[-1,1]){
    p.push(box(.012,.032,DOOR_R-(REAR_AX+ARCH_R+.03),s*(W+.004),.563,(DOOR_R+REAR_AX+ARCH_R+.03)/2)); // rear quarter
    // B-pillar appliqué (black), on the tumblehome plane
    p.push(patch([[DOOR_R+.005,beltY(DOOR_R)],[B_R,beltY(B_R)],[B_R,SIDE_TOP],[DOOR_R+.005,SIDE_TOP]],[],sidePlane(s,.008),s>0));
    // quarter-window rubber: a thin black ring round the glass
    p.push(patch(inset(QUARTER_WIN,-.02),[QUARTER_WIN],sidePlane(s,.009),s>0));
  }
  // windshield rubber
  p.push(gridRing(windshieldGeo(-.012),windshieldGeo(.0)));
  // rear wiper and the two front wipers
  p.push(bar(rearPlane(.014)(.05,1.03),rearPlane(.014)(-.42,1.14),.018,.012));
  p.push(bar([-.58,.95,COWL-.06],[.02,1.0,COWL-.23],.018,.012),bar([.08,.95,COWL-.06],[.62,.99,COWL-.2],.018,.012));
  // wheel wells: a black half-drum inside every arch, closed on its inboard side
  for(const ax of[0,REAR_AX])for(const s of[-1,1]){
    const drum=new THREE.CylinderGeometry(ARCH_R-.005,ARCH_R-.005,.34,20,1,true,0,Math.PI);
    drum.rotateZ(Math.PI/2);drum.scale(-1,1,1);drum.translate(s*(W-.17),ARCH_Y,ax);
    const wall=new THREE.CircleGeometry(ARCH_R-.005,20,0,Math.PI);wall.rotateY(s>0?Math.PI/2:-Math.PI/2);wall.translate(s*(W-.34),ARCH_Y,ax);
    p.push(drum,wall);
  }
  // fuel filler flap (the car's left rear quarter): its round shut line
  {const f=new THREE.RingGeometry(.052,.06,24);f.rotateY(Math.PI/2);f.translate(W+.002,.86,-2.2);p.push(f);}
  return merge(p);
}
// a frame band between two windshield surfaces (outer f, inner g)
function gridRing(f:(u:number,v:number)=>V3,g:(u:number,v:number)=>V3):THREE.BufferGeometry{
  const pos:number[]=[],N=24;
  const loop=(h:(u:number,v:number)=>V3):V3[]=>{const o:V3[]=[];
    for(let i=0;i<N;i++)o.push(h(-1+2*i/N,0));for(let i=0;i<N;i++)o.push(h(1,i/N));
    for(let i=0;i<N;i++)o.push(h(1-2*i/N,1));for(let i=0;i<N;i++)o.push(h(-1,1-i/N));return o;};
  const A=loop(f),B=loop(g);
  for(let i=0;i<A.length;i++){const j=(i+1)%A.length;pos.push(...A[i],...A[j],...B[j],...A[i],...B[j],...B[i]);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.computeVertexNormals();
  // two-sided by duplication (the band is seen from outside only, but keep it safe)
  return merge([geo,geo.clone().scale(1,1,1)]);
}
const BLACK_GEO=toRig(blackParts());
// rubber-black: the front intake, the grille backing and the plate recesses
const RUBBER_GEO=toRig(merge([
  box(.62,.07,.02,0,.27,FRONT_FACE+.03),                      // lower intake slot
  box(.64,.15,.02,0,.64,NOSE+.006),                           // grille backing, between the lamps
]));
const CHROME_GEO=toRig(merge([
  box(.6,.016,.014,0,.69,NOSE+.018),box(.6,.016,.014,0,.645,NOSE+.018),box(.6,.016,.014,0,.6,NOSE+.018), // grille bars
  box(.64,.012,.014,0,.718,NOSE+.016),                        // grille top trim
]));
// glass: windshield, rear window, the two quarter windows (door glass rides on the doors)
const WINDSHIELD_GEO=toRig(gridPatch(windshieldGeo(.012)));
const REARGLASS_GEO=toRig(patch(rrect(-.585,.585,RW_BOT,RW_TOP,.06).map(([u,v])=>[u*(1-(v-RW_BOT)/(RW_TOP-RW_BOT)*.06),v] as [number,number]),[],rearPlane(-.004),true));
const QUARTER_GLASS_GEO=toRig(merge([-1,1].map(s=>patch(QUARTER_WIN,[],sidePlane(s,-.004),s>0))));
// lamps
function lampBox(x0:number,x1:number,y0:number,y1:number,z:number,d=.03,bev=.012):THREE.BufferGeometry{
  const s=new THREE.Shape(rrect(x0,x1,y0,y1,bev).map(([u,v])=>new THREE.Vector2(u,v)));
  const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:3});g.translate(0,0,z-d/2);return g;
}
// headlamps: the wide clear units, their outer ends wrapping slightly round the corner
const HEAD_GEO=toRig(merge([-1,1].map(s=>{
  const g=lampBox(.32,.66,.56,.728,NOSE+.012,.03,.02);if(s<0)mirrorX(g);
  return g;
})));
const HEAD_REFLECT_GEO=toRig(merge([-1,1].flatMap(s=>{
  const bowl=new THREE.ShapeGeometry(new THREE.Shape(rrect(.335,.6,.572,.716,.025).map(([u,v])=>new THREE.Vector2(u,v))));
  bowl.translate(0,0,NOSE+.02);if(s<0)mirrorX(bowl);
  const bulb=new THREE.CircleGeometry(.045,20);bulb.translate(s*.43,.645,NOSE+.024);
  return[bowl,bulb];
})));
const AMBER_GEO=toRig(merge([
  ...[-1,1].map(s=>{const g=lampBox(.605,.655,.575,.71,NOSE+.008,.012,.008);if(s<0)mirrorX(g);return g;}), // indicators in the headlamps' outer ends (behind the lens)
  ...[-1,1].map(s=>box(.008,.025,.06,s*(W-.002),.77,-.3)),                                                // side repeaters on the wings
  ...[-1,1].map(s=>lens(.18,.045,s*(W-.12),.6775,TAIL-.03)),                                          // tail: amber band
]));
// tail lamps: tall units in the corners, red over amber over white, wrapping round a little
const TAIL_RED_GEO=toRig(merge([-1,1].flatMap(s=>[lens(.18,.15,s*(W-.12),.775,TAIL-.03),lens(.07,.15,s*(W+.004),.775,TAIL+.03,s)])));
const TAIL_WHITE_GEO=toRig(merge([-1,1].map(s=>lens(.18,.055,s*(W-.12),.6275,TAIL-.03))));
const BADGE_GEO=(():THREE.BufferGeometry=>{const a=new THREE.CircleGeometry(.04,24);a.translate(0,.645,NOSE+.032);
  const b=new THREE.CircleGeometry(.035,24);b.rotateX(-.55);b.rotateY(Math.PI);const q=rearPlane(.006)(0,.93);b.translate(q[0],q[1],q[2]);return toRig(merge([a,b]));})();
const SCRIPT_GEO=(():THREE.BufferGeometry=>{const g=new THREE.PlaneGeometry(.26,.065);g.rotateX(-.55);g.rotateY(Math.PI);const q=rearPlane(.006)(.4,.93);g.translate(q[0],q[1],q[2]);return toRig(g);})();
// mirrors (housing + the black sail at the front of the door glass) and the fuel cap
function mirror(s:number):THREE.BufferGeometry{
  const g=merge([
    patch([[DOOR_F-.07,beltY(DOOR_F)+.012],[DOOR_F-.2,beltY(DOOR_F)+.012],[DOOR_F-.12,beltY(DOOR_F)+.11]],[],sidePlane(s,.01),s>0),
    box(.15,.105,.075,s*(W+.105),beltY(DOOR_F)+.105,DOOR_F-.17,0,s*.12,0),
    box(.05,.03,.05,s*(W+.025),beltY(DOOR_F)+.07,DOOR_F-.15),
  ]);
  return g;
}

// ---------------------------------------------------------------- the door (one per side)
// Built from the shell's own door-zone quads + its glass, black frame, moulding and the
// flap handle, all relative to the hinge at the front edge.
function doorParts(s:number):{paint:THREE.BufferGeometry;black:THREE.BufferGeometry;glass:THREE.BufferGeometry}{
  const paint=(s<0?BODY.doorL:BODY.doorR).clone();
  const winOuter=DOOR_WIN.map(([z,y])=>[z,y] as [number,number]);
  const frameIn=inset(winOuter,.032);
  const black=merge([
    patch(winOuter,[frameIn],sidePlane(s,.007),s>0),                                   // the black window frame
    box(.012,.032,DOOR_F-DOOR_R-.02,s*(W+.004),.563,(DOOR_F+DOOR_R)/2),               // moulding
    box(.02,.035,.13,s*(W+.01),.89,DOOR_R+.16),                                        // flap handle
    mirror(s),
  ]);
  const glass=patch(frameIn,[],sidePlane(s,-.002),s>0);
  return{paint,black,glass};
}

// ---------------------------------------------------------------- wheels
function wheelGroup():THREE.Group{
  const g=new THREE.Group();
  // tyre: a lathe of the 165/70 R13 section (rounded shoulders), revolved round the axle
  const R=.283/1,rim=.165,wHalf=.083;
  const prof:THREE.Vector2[]=[];
  prof.push(new THREE.Vector2(rim,-wHalf+.01));
  for(let i=0;i<=8;i++){const a=-Math.PI/2+i/8*Math.PI/2;prof.push(new THREE.Vector2(R-.03+Math.cos(a)*.03,-wHalf+.03+Math.sin(a)*.03));}
  for(let i=0;i<=8;i++){const a=i/8*Math.PI/2;prof.push(new THREE.Vector2(R-.03+Math.cos(a)*.03,wHalf-.03+Math.sin(a)*.03));}
  prof.push(new THREE.Vector2(rim,wHalf-.01));
  const tyre=new THREE.LatheGeometry(prof,28);tyre.rotateZ(Math.PI/2);
  const tm=new THREE.Mesh(tyre.scale(K,K,K),tireM);tm.castShadow=true;g.add(tm);
  // steel rim lip and the hubcap face on the outside (+x of the wheel; flipped per side)
  const lip=new THREE.CylinderGeometry(rim*K,rim*K,(wHalf*2-.03)*K,24,1,true);lip.rotateZ(Math.PI/2);
  g.add(new THREE.Mesh(lip,steelM));
  const cap=new THREE.CircleGeometry(.158*K,32);cap.rotateY(Math.PI/2);cap.translate((wHalf-.012)*K,0,0);
  const capM=new THREE.Mesh(cap,hubM);capM.name='hubcap';g.add(capM);
  const back=new THREE.CircleGeometry(rim*K,20);back.rotateY(-Math.PI/2);back.translate(-(wHalf-.02)*K,0,0);
  g.add(new THREE.Mesh(back,steelM));
  return g;
}

// the rig's interior geometry without its triangles past z = 2.0 (the sedan grille) and
// below y = .2 (the floor slab, under the Uno's sills) — cached: it is shared
const trimmed=new WeakMap<THREE.BufferGeometry,THREE.BufferGeometry>();
function trimNose(geo:THREE.BufferGeometry):THREE.BufferGeometry{
  const hit=trimmed.get(geo);if(hit)return hit;
  const src=geo.index?geo.toNonIndexed():geo,p=src.getAttribute('position'),keep:number[]=[];
  for(let i=0;i<p.count;i+=3)if(Math.max(p.getZ(i),p.getZ(i+1),p.getZ(i+2))<2.0&&Math.max(p.getY(i),p.getY(i+1),p.getY(i+2))>.2)
    for(let k=0;k<3;k++)keep.push(p.getX(i+k),p.getY(i+k),p.getZ(i+k));
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(keep,3));out.computeVertexNormals();
  trimmed.set(geo,out);return out;
}

function buildUno({color=0x3b7ac2}: {color?: number}={}): THREE.Group{
  const g=carModel.build({color}); // the full car rig in the requested colour (NOT added to the scene)
  const body=g.userData.dentable[0] as THREE.Mesh;
  const paint=body.material as THREE.Material;

  // 1) the painted shell replaces the sedan's (same paint → colour, still dentable)
  body.geometry=SHELL_GEO;body.castShadow=true;

  // 2) hide the rig's sedan glass, lamps, bumpers, plate and exhaust: the Uno brings its own
  g.userData.dentable[1].visible=false;
  const drop:THREE.Object3D[]=[];
  g.traverse((o:THREE.Object3D)=>{
    const m=o as THREE.Mesh;if(!m.isMesh)return;
    if(m.renderOrder===3)m.visible=false;                               // sedan cabin glass
    if(m.position.z>3)drop.push(m);                                     // the headlight beam plane (z=4.8) inflates bounds
    const mat=m.material as THREE.MeshBasicMaterial;
    if(mat&&mat.isMeshBasicMaterial&&!mat.map&&mat.color&&mat.color.getHex()===0xfff2c0)m.visible=false; // sedan headlamps
    if(m.geometry&&(m.geometry as THREE.BufferGeometry).type==='BoxGeometry'&&Math.abs(m.position.z+2.23)<.01)m.visible=false; // plate
    if(m.geometry&&(m.geometry as THREE.BufferGeometry).type==='CylinderGeometry'&&Math.abs(m.position.z+2.24)<.01)m.visible=false; // exhaust
  });
  for(const o of drop)o.parent!.remove(o);
  // the rig's merged interior (floor, dash, column) also holds the sedan's grille at its
  // nose, which pokes out of the Uno's shorter front: drop those triangles
  g.traverse((o:THREE.Object3D)=>{
    const m=o as THREE.Mesh;if(!m.isMesh||m===body||!m.geometry)return;
    const geo=m.geometry as THREE.BufferGeometry;geo.computeBoundingBox();
    if(geo.boundingBox!.max.z>2.1&&geo.boundingBox!.min.z<0&&m.userData.unoTrimmed!==true){m.geometry=trimNose(geo);m.userData.unoTrimmed=true;}
  });

  // the seats sit a little higher in the Uno's floor (their bases would show under the sills)
  g.traverse((o:THREE.Object3D)=>{const m=o as THREE.Mesh;if(m.isMesh&&(m.material as THREE.MeshStandardMaterial).color?.getHex?.()===0x2a2d38)m.position.y=.08;});

  // 3) brake lamps: the rig's tail-lamp mesh (its material turns bright when braking) takes
  //    the shape of the Uno's red lenses
  g.traverse((o:THREE.Object3D)=>{const m=o as THREE.Mesh;if(m.isMesh&&m.material===g.userData.tailM){m.geometry=TAIL_RED_GEO;m.position.set(0,0,0);}});

  // 4) the parts
  const add=(geo:THREE.BufferGeometry,m:THREE.Material,shadow=false,order=0):THREE.Mesh=>{
    const o=new THREE.Mesh(geo,m);o.castShadow=shadow;o.receiveShadow=true;if(order)o.renderOrder=order;g.add(o);return o;};
  add(BLACK_GEO,blackM,true);add(RUBBER_GEO,rubberM);add(CHROME_GEO,chromeM);
  add(HEAD_GEO,lensM);add(HEAD_REFLECT_GEO,chromeM);add(AMBER_GEO,amberM);add(TAIL_WHITE_GEO,whiteLampM);
  add(BADGE_GEO,badgeM);add(SCRIPT_GEO,scriptM);
  add(WINDSHIELD_GEO,glassM,false,3).visible=true;add(REARGLASS_GEO,glassM,false,3);add(QUARTER_GLASS_GEO,glassM,false,3);
  // plates (both on the bumpers, the rear one in its recess) + the exhaust pipe
  const pf=new THREE.Mesh(new THREE.BoxGeometry(.40*K,.13*K,.012*K),plateM);pf.position.set(0,.36*K,AXLE+(FRONT_FACE+.01)*K);g.add(pf);
  const pr=new THREE.Mesh(new THREE.BoxGeometry(.40*K,.13*K,.012*K),plateM);pr.position.set(0,.43*K,AXLE+(REAR_FACE-.012)*K);g.add(pr);
  const ex=new THREE.Mesh(new THREE.CylinderGeometry(.024*K,.024*K,.14*K,10),steelM);ex.rotation.x=Math.PI/2;ex.position.set(-.45*K,.2*K,AXLE+(REAR_FACE+.07)*K);g.add(ex);

  // 5) the doors: hinge at the front edge of each door; door pivots of the rig re-used
  g.userData.doors.forEach((pivot:THREE.Group)=>{
    const s=pivot.position.x<0?-1:1;
    const hinge=new THREE.Vector3(s*W*K,.55,AXLE+DOOR_F*K);
    pivot.position.copy(hinge);
    pivot.clear();
    const d=doorParts(s);
    for(const[geo,m,order]of[[d.paint,paint,0],[d.black,blackM,0],[d.glass,glassM,3]] as [THREE.BufferGeometry,THREE.Material,number][]){
      const gg=toRig(geo.clone());gg.translate(-hinge.x,-hinge.y,-hinge.z);
      const mesh=new THREE.Mesh(gg,m);mesh.castShadow=m!==glassM;mesh.receiveShadow=true;if(order)mesh.renderOrder=order;
      pivot.add(mesh);
    }
  });

  // 6) wheels: the rig's wheel groups keep their positions/steering/spin; the Mille's steel
  //    wheel with its hubcap and a tyre of the real section goes inside each
  for(const wg of g.userData.wheels as THREE.Group[]){
    const s=wg.position.x<0?-1:1;
    wg.position.x=s*.72;                                  // real track 1,340 mm
    wg.clear();
    const w=wheelGroup();if(s<0)w.scale.x=-1;
    wg.add(w);
  }
  return g;
}

// Back-compat factory: build + add to the scene (mirrors makeCar/makeAmbulance).
export function makeFiatUno(color: number): THREE.Group{const g=buildUno({color});addVehicleLod(g,'uno:'+color);scene.add(g);return g;}

// Model-viewer descriptor (auto-discovered) with the Mille's common colours.
export default {category:'Vehicles',label:'Fiat Uno Mille Fire',build:buildUno,zoom:.7,yaw:.6,
  variants:[{label:'Uno Mille Fire — prata',opts:{color:0xb9bcbf}},
            {label:'Uno Mille Fire — vermelho',opts:{color:0xa3202a}},
            {label:'Uno Mille Fire — branco',opts:{color:0xeceae4}}]};
