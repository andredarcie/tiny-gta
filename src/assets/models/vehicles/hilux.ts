import carModel from './car.ts';
import * as THREE from 'three';
import {addVehicleLod} from './vehicle-lod.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';

// Toyota Hilux SRV 3.0 cabine dupla, 2015 (7th generation, second facelift, 2011–2015 — the
// Hilux sold in Brazil as the 2015 model) — modelled from photos of every side
// (docs/divinolandia/referencias-hilux, local; credits in CREDITOS.json) and its data
// sheet: 5,260 mm long, 1,835 mm wide, 1,860 mm tall, 3,085 mm wheelbase, 1,540 mm track,
// 265/65 R17 tyres, 222 mm ground clearance. Built in REAL metres with the front axle at
// z = 0 (z forward, y up, x across; -x is the driver's side, like the car rig), then scaled
// by the game's people scale (×1.06, the same as the sedan rig) onto the car rig with its
// own, longer wheelbase, so it drives, brakes, dents, opens its doors and gets stolen like
// any car.
//
// What makes it this Hilux and not just "a pickup":
//  - the tall nose: a long flat hood with the intercooler scoop, the chrome grille of three
//    bars inside a chrome surround, swept-back headlamps wrapping onto the wings;
//  - the big body-coloured bumper with the wide black intake and round fog lamps in pods;
//  - the double cab: four doors, the black B-pillar, the rear door's slanted window edge,
//    chrome mirrors and handles, the amber repeater on the wing, body-coloured arch flares;
//  - the open bed with its black liner, the chrome sport bar ("santo antônio") behind the
//    cab, tall corner tail lamps (red, white, red) and the chrome step bumper;
//  - six double-spoke 17" alloys on tall off-road tyres, side steps under the doors.
// One painted shell (dentable), black trims merged, glass and lamps separate.

const K=1.06;                               // real metres → rig units (the people scale)
const AXLE=1.64;                            // rig z of the front axle (axles centred on the rig)
const WB=3.085;                             // real wheelbase
export const HILUX_LIFT=.48;                // the cab floor sits this much higher than the sedan's (rig units)
const SEAT_FWD=.45;                         // and the seats sit further forward in the long cab
const W=.90;                                // half body width
// Side profile, measured on a true side photo of a 2014 double cab (Toyota_Hilux_2.5D_
// Double_Cab_2014, scaled by its 5,260 mm length): a SHORT, tall hood (1.19 m at the
// nose, 1.29 at the windshield base only .46 m behind the front axle) and a long cab;
// window line 1.29, bed rail 1.29, side glass top 1.76, roof 1.84; wheel arches of .52 m
// radius (top .92); sills at .53.
const NOSE=.78,TAIL=-4.38;                  // body ends (bumpers stick out past them)
const COWL=-.46;                            // windshield base
const WS_TOP_Z=-1.50,WS_TOP_Y=1.80;         // windshield top (under the roof's front edge)
const ROOF_R=-2.64,ROOF_Y=1.84,SIDE_TOP=1.76;
const CAB_R=-2.66,BED_F=-2.71;              // cab back wall, bed front wall
const DOOR_F=-.50,DOOR_R=-1.58,RDOOR_R=-2.52; // front door, rear door shut lines
const B_F=-1.55,B_R=-1.64;                  // the black B-pillar
const ARCH_R=.52,ARCH_Y=.40,REAR_AX=-WB;
const SILL=.53,BED_BOTTOM=.62,BED_FLOOR=.84;
const BELT=1.29,NOSE_Y=1.19;                // window line at the cowl, hood front edge

// ---------------------------------------------------------------- materials
const glassM=new THREE.MeshStandardMaterial({color:0x1f262b,roughness:.06,metalness:.35,
  transparent:true,opacity:.66,depthWrite:false});
const blackM=new THREE.MeshStandardMaterial({color:0x17181a,roughness:.78,metalness:.02}); // textured black plastic
const rubberM=new THREE.MeshStandardMaterial({color:0x0e0f10,roughness:.9});
const chromeM=new THREE.MeshStandardMaterial({color:0xd7dade,roughness:.16,metalness:.95});
const lensM=new THREE.MeshStandardMaterial({color:0xe8eef2,roughness:.04,metalness:.1,transparent:true,opacity:.3,depthWrite:false});
const amberM=new THREE.MeshStandardMaterial({color:0xd98a24,roughness:.2,metalness:.1,emissive:0x2a1400});
const whiteLampM=new THREE.MeshStandardMaterial({color:0xe9e9e6,roughness:.15,metalness:.2});
const fogM=new THREE.MeshStandardMaterial({color:0xf0eee4,roughness:.1,metalness:.3});
const tireM=new THREE.MeshStandardMaterial({color:0x1b1b1c,roughness:.92});
const steelM=new THREE.MeshStandardMaterial({color:0x2c2e31,roughness:.6,metalness:.4});
const plateM=new THREE.MeshStandardMaterial({color:0xe6e8e4,roughness:.6});

// ---------------------------------------------------------------- small helpers
type V3=[number,number,number];
// real metres → rig units, in place
function toRig(g:THREE.BufferGeometry):THREE.BufferGeometry{g.scale(K,K,K);g.translate(0,0,AXLE);return g;}
// a one-sided lens: w×h facing the back (dir 0) or out of the side s (dir ±1)
function lens(w:number,h:number,x:number,y:number,z:number,dir=0):THREE.BufferGeometry{
  const g=new THREE.PlaneGeometry(w,h);g.rotateY(dir===0?Math.PI:dir*Math.PI/2);g.translate(x,y,z);return g;
}
function box(w:number,h:number,d:number,x:number,y:number,z:number,rx=0,ry=0,rz=0):THREE.BufferGeometry{
  const g=new THREE.BoxGeometry(w,h,d);
  if(rx||ry||rz)g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx,ry,rz,'YXZ')));
  g.translate(x,y,z);return g;
}
// a box stretched between two points (wipers, bars), cross-section w × t
function bar(a:V3,b:V3,w:number,t:number,up:V3=[0,1,0]):THREE.BufferGeometry{
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),len=A.distanceTo(B);
  const g=new THREE.BoxGeometry(w,t,len);
  const m=new THREE.Matrix4().lookAt(B,A,new THREE.Vector3(...up));
  g.applyMatrix4(m);g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);return g;
}
// a round tube along a polyline (the sport bar)
function tube(pts:V3[],r:number):THREE.BufferGeometry{
  const c=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)),false,'catmullrom',.1);
  return new THREE.TubeGeometry(c,pts.length*8,r,8,false);
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
// both faces of a thin panel (seen from the cab and from the bed)
function twoSided(g:THREE.BufferGeometry):THREE.BufferGeometry{
  const b=nonIndexed(g.clone()),p=b.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<p.count;i+=3)for(let a=0;a<3;a++){const t=p.getComponent(i+1,a);p.setComponent(i+1,a,p.getComponent(i+2,a));p.setComponent(i+2,a,t);}
  b.computeVertexNormals();return merge([g,b]);
}
const nonIndexed=(g:THREE.BufferGeometry):THREE.BufferGeometry=>{const n=g.index?g.toNonIndexed():g;if(n.getAttribute('uv'))n.deleteAttribute('uv');return n;};
const merge=(gs:THREE.BufferGeometry[]):THREE.BufferGeometry=>mergeGeometries(gs.map(nonIndexed),false);
const geoOf=(a:number[]):THREE.BufferGeometry=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();return g;};

// ---------------------------------------------------------------- the side profile
// window line (glass bottom) along the cab, rising a little to the back; the bed rail
function beltY(z:number):number{return BELT+Math.min(Math.max(0,COWL-z),COWL-CAB_R)*.006;}
// top of the lower body's sides: the hood edge (rising from the nose to the cowl), then the
// window line, then the bed rail
function sideTop(z:number):number{
  if(z>COWL){const t=(NOSE-z)/(NOSE-COWL);return NOSE_Y+(beltY(COWL)-NOSE_Y)*(1-Math.pow(1-t,1.6));}
  return beltY(z);
}
// bottom of the sides: the high sill, the bed's underside, raised round the wheel arches
function sideBottom(z:number):number{
  let y=z<BED_F?BED_BOTTOM:SILL;
  for(const ax of[0,REAR_AX]){const d=z-ax;if(Math.abs(d)<ARCH_R)y=Math.max(y,ARCH_Y+Math.sqrt(ARCH_R*ARCH_R-d*d));}
  if(z>NOSE-.12)y=Math.max(y,SILL+(z-(NOSE-.12))*.8);   // the bumper's top tucks the nose up
  return y;
}
// half width in plan: the nose corners round off, the bed's are square
function halfWidth(z:number):number{
  const rn=.06,rt=.035;
  if(z>NOSE-rn){const d=z-(NOSE-rn);return W-rn+Math.sqrt(Math.max(0,rn*rn-d*d));}
  if(z<TAIL+rt){const d=(TAIL+rt)-z;return W-rt+Math.sqrt(Math.max(0,rt*rt-d*d));}
  return W;
}
// the side glass leans in (tumblehome) from the window line to the roof
const glassX=(y:number):number=>.875-(y-BELT)*(.875-.77)/(SIDE_TOP-BELT);
// the windshield's side edge: z at height y (the A-pillar line)
const zA=(y:number):number=>COWL+(WS_TOP_Z-COWL)*(y-BELT)/(WS_TOP_Y-BELT);

// ---------------------------------------------------------------- the painted shell
// The lower body is a thin-walled U lofted along z: outer side, the bottom, the other side,
// a belt cap and the inner wall (so the cab and the bed are open above the window line).
// Ring segments carry a class so the front doors can be cut out of the sides.
type Seg='sideL'|'sideR'|'bottom'|'capL'|'capR'|'innerL'|'innerR';
const TH=.035,RT=.03,RB=.06;
function ring(z:number):{pts:[number,number][];seg:Seg[]}{
  const w=halfWidth(z),yt=sideTop(z),yb=sideBottom(z);
  const pts:[number,number][]=[],seg:Seg[]=[];
  const arc=(cx:number,cy:number,r:number,a0:number,a1:number,cls:Seg,n=4):void=>{
    for(let i=1;i<=n;i++){const a=a0+(a1-a0)*i/n;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r]);seg.push(cls);}
  };
  pts.push([-(w-TH),yt]);
  pts.push([-(w-RT),yt]);seg.push('capL');
  arc(-(w-RT),yt-RT,RT,Math.PI/2,Math.PI,'sideL');
  pts.push([-w,yb+RB]);seg.push('sideL');
  arc(-(w-RB),yb+RB,RB,Math.PI,Math.PI*1.5,'bottom');
  pts.push([w-RB,yb]);seg.push('bottom');
  arc(w-RB,yb+RB,RB,-Math.PI/2,0,'bottom');
  pts.push([w,yt-RT]);seg.push('sideR');
  arc(w-RT,yt-RT,RT,0,Math.PI/2,'sideR');
  pts.push([w-TH,yt]);seg.push('capR');
  pts.push([w-TH,yb+TH]);seg.push('innerR');
  pts.push([-(w-TH),yb+TH]);seg.push('bottom');
  seg.push('innerL');
  return{pts,seg};
}
const STATIONS=(():number[]=>{
  const s=new Set<number>();
  for(let z=TAIL;z<=NOSE+1e-6;z+=.08)s.add(+z.toFixed(4));
  for(const ax of[0,REAR_AX])for(let d=-ARCH_R-.02;d<=ARCH_R+.02;d+=.025)s.add(+(ax+d).toFixed(4));
  for(let z=NOSE-.16;z<=NOSE;z+=.02)s.add(+z.toFixed(4));
  for(let z=TAIL;z<=TAIL+.06;z+=.015)s.add(+z.toFixed(4));
  for(const z of[DOOR_F,DOOR_R,COWL,BED_F,BED_F+.002])s.add(z);
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
  // end panels: the front sheet below the hood, the tailgate (painted outside, both faces)
  const nose=patch(rrect(-halfWidth(NOSE),halfWidth(NOSE),sideBottom(NOSE),sideTop(NOSE),.05),[],(u,v)=>[u,v,NOSE]);
  const tail=patch(rrect(-halfWidth(TAIL),halfWidth(TAIL),BED_BOTTOM,sideTop(TAIL),.03),[],(u,v)=>[u,v,TAIL],true);
  return{shell:geoOf(shell),doorL:geoOf(dL),doorR:geoOf(dR),nose,tail};
}
// hood: from the nose to the cowl between the two top edges, nearly flat with a soft crown;
// its front edge rolls down onto the grille
function hood():THREE.BufferGeometry{
  const pos:number[]=[],NU=12,zs:number[]=[];
  for(let z=COWL;z<=NOSE+1e-6;z+=.05)zs.push(z);if(zs[zs.length-1]<NOSE)zs.push(NOSE);
  const P=(u:number,z:number):V3=>{
    const w=halfWidth(z)-RT,crown=.03*(1-u*u)*Math.min(1,(NOSE-z)/.12)*Math.min(1,(z-COWL)/.1+.3);
    const roll=z>NOSE-.05?(z-(NOSE-.05))*.6:0;
    return[u*w,sideTop(z)+crown-roll,z];
  };
  for(let j=1;j<zs.length;j++)for(let i=0;i<NU;i++){
    const u0=-1+2*i/NU,u1=-1+2*(i+1)/NU;
    const a=P(u0,zs[j-1]),b=P(u1,zs[j-1]),c=P(u1,zs[j]),d=P(u0,zs[j]);
    pos.push(...a,...c,...b,...a,...d,...c);
  }
  return geoOf(pos);
}
const hoodY=(z:number):number=>sideTop(z)+.03;      // hood surface on the centreline
// roof: a slab with a slight crown whose edges roll down to the top of the side glass and
// whose front and rear edges roll down to the windshield / the back wall
function roof():THREE.BufferGeometry{
  const pos:number[]=[],zs:number[]=[];
  for(let z=ROOF_R;z<=WS_TOP_Z+1e-6;z+=.08)zs.push(z);if(zs[zs.length-1]<WS_TOP_Z)zs.push(WS_TOP_Z);
  const sec=(z:number):V3[]=>{
    const ends=Math.min(1,(z-ROOF_R)/.07,(WS_TOP_Z-z)/.07),drop=(1-ends)*.035;
    const o:V3[]=[];const wTop=.66,xs=glassX(SIDE_TOP)-.004,rx=xs-wTop,ry=ROOF_Y-drop-SIDE_TOP;
    for(let i=0;i<=5;i++){const a=i/5*Math.PI/2;o.push([-(wTop+rx*Math.cos(a)),SIDE_TOP+ry*Math.sin(a),z]);}
    for(let i=1;i<10;i++){const u=-1+i/5;o.push([u*wTop,ROOF_Y-drop+.015*(1-u*u),z]);}
    for(let i=5;i>=0;i--){const a=i/5*Math.PI/2;o.push([wTop+rx*Math.cos(a),SIDE_TOP+ry*Math.sin(a),z]);}
    return o;
  };
  for(let j=1;j<zs.length;j++){
    const A=sec(zs[j-1]),B=sec(zs[j]);
    for(let i=1;i<A.length;i++)pos.push(...A[i-1],...A[i],...B[i],...A[i-1],...B[i],...B[i-1]);
  }
  const g=geoOf(pos);
  // face every triangle up/out of the cab
  const p=g.getAttribute('position') as THREE.BufferAttribute,nr=g.getAttribute('normal') as THREE.BufferAttribute;
  for(let i=0;i<p.count;i+=3){
    const cx=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,cy=(p.getY(i)+p.getY(i+1)+p.getY(i+2))/3;
    if(nr.getX(i)*cx+nr.getY(i)*(cy-1.45)<0){for(let a=0;a<3;a++){const t=p.getComponent(i+1,a);p.setComponent(i+1,a,p.getComponent(i+2,a));p.setComponent(i+2,a,t);}}
  }
  g.computeVertexNormals();
  return g;
}
// the upper sides of the cab on the tumblehome surface between the window line and the
// roof, with both windows cut out
const sidePlane=(side:number,off=0)=>(z:number,y:number):V3=>[side*(glassX(y)+off),y,z];
const ST=SIDE_TOP;
const FRONT_WIN:[number,number][]=[[zA(BELT+.02)-.035,beltY(-.5)+.02],[B_F,beltY(B_F)+.02],[B_F,ST-.035],[zA(ST-.035)-.035,ST-.035]];
const REAR_WIN:[number,number][]=[[B_R,beltY(B_R)+.02],[-2.50,beltY(-2.50)+.02],[-2.42,ST-.035],[B_R,ST-.035]];
function upperSides():THREE.BufferGeometry{
  const out:THREE.BufferGeometry[]=[];
  for(const s of[-1,1]){
    const outline:[number,number][]=[[COWL,beltY(COWL)-.012],[CAB_R,beltY(CAB_R)-.012],[CAB_R,ST+.005],[zA(ST+.005),ST+.005]];
    out.push(patch(outline,[FRONT_WIN,REAR_WIN],sidePlane(s,.004),s>0));
  }
  return merge(out);
}
// the cab's back wall above the window line (rear window cut out) and the bed's front wall
const backPlane=(z:number)=>(u:number,v:number):V3=>[u,v,z];
const BACK_WIN=rrect(-.56,.56,1.40,1.71,.05);
function cabBack():THREE.BufferGeometry{
  const vs:number[]=[];for(let v=beltY(CAB_R)-.012;v<ROOF_Y-.03;v+=.025)vs.push(v);vs.push(ROOF_Y-.03);
  const xAt=(v:number):number=>v<=ST?glassX(v):.66+(glassX(ST)-.66)*Math.cos(Math.asin(Math.min(1,(v-ST)/(ROOF_Y-.03-ST))));
  const outline:[number,number][]=[...vs.map(v=>[xAt(v),v] as [number,number]),...vs.slice().reverse().map(v=>[-xAt(v),v] as [number,number])];
  return twoSided(patch(outline,[BACK_WIN],backPlane(CAB_R),true));
}
const bedFront=():THREE.BufferGeometry=>twoSided(patch(rrect(-(W-TH),W-TH,BED_FLOOR,beltY(BED_F),.01),[],backPlane(BED_F),true));
// windshield surface: u across (-1..1), v up (0..1), from the cowl to under the roof front
function windshieldGeo(ins:number):(u:number,v:number)=>V3{
  return(u,v)=>{
    const y=BELT+(WS_TOP_Y-BELT)*v,z=zA(y);
    const hw=glassX(y)-ins;
    return[u*hw,y,z+.04*(1-u*u)];
  };
}
function gridPatch(f:(u:number,v:number)=>V3,nu=8,nv=6):THREE.BufferGeometry{
  const pos:number[]=[];
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){
    const u0=-1+2*i/nu,u1=-1+2*(i+1)/nu,v0=j/nv,v1=(j+1)/nv;
    const a=f(u0,v0),b=f(u1,v0),c=f(u1,v1),d=f(u0,v1);
    pos.push(...a,...b,...c,...a,...c,...d);
  }
  return geoOf(pos);
}
// a band between two windshield surfaces (outer f, inner g): the A-pillars, the rubber
function gridRing(f:(u:number,v:number)=>V3,g:(u:number,v:number)=>V3):THREE.BufferGeometry{
  const pos:number[]=[],N=24;
  const loop=(h:(u:number,v:number)=>V3):V3[]=>{const o:V3[]=[];
    for(let i=0;i<N;i++)o.push(h(-1+2*i/N,0));for(let i=0;i<N;i++)o.push(h(1,i/N));
    for(let i=0;i<N;i++)o.push(h(1-2*i/N,1));for(let i=0;i<N;i++)o.push(h(-1,1-i/N));return o;};
  const A=loop(f),B=loop(g);
  for(let i=0;i<A.length;i++){const j=(i+1)%A.length;pos.push(...A[i],...A[j],...B[j],...A[i],...B[j],...B[i]);}
  return twoSided(geoOf(pos));
}
// the bumpers: a thick rounded band round the end of the body, wrapping back to the arches
function bumper(zFace:number,dir:number,yb:number,yt:number,wrap:number,w:number,r:number,prof:[number,number][]):THREE.BufferGeometry{
  const path:[number,number][]=[];
  const zEnd=zFace-dir*wrap;
  for(let i=0;i<=3;i++)path.push([-w,zEnd+(zFace-dir*r-zEnd)*i/3]);
  for(let i=1;i<=8;i++){const a=Math.PI-i/8*Math.PI/2;path.push([-w+r+Math.cos(a)*r,zFace-dir*r+dir*Math.sin(a)*r]);}
  for(let i=1;i<10;i++)path.push([-w+r+(2*(w-r))*i/10,zFace]);
  for(let i=0;i<=8;i++){const a=Math.PI/2-i/8*Math.PI/2;path.push([w-r+Math.cos(a)*r,zFace-dir*r+dir*Math.sin(a)*r]);}
  for(let i=1;i<=3;i++)path.push([w,zFace-dir*r+(zEnd-(zFace-dir*r))*i/3]);
  const h=yt-yb,pr=prof.map(([d,t])=>[d,yb+t*h] as [number,number]);
  const pos:number[]=[];
  const out=(i:number):[number,number]=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)];const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return[dz/l*dir*-1,-dx/l*dir*-1];};
  const P=(i:number,k:number):V3=>{const[nx,nz]=out(i),[d,y]=pr[k];return[path[i][0]+nx*d,y,path[i][1]+nz*d];};
  for(let i=1;i<path.length;i++)for(let k=1;k<pr.length;k++){
    const a=P(i-1,k-1),b=P(i,k-1),c=P(i,k),e=P(i-1,k);
    if(dir>0)pos.push(...a,...c,...b,...a,...e,...c);else pos.push(...a,...b,...c,...a,...c,...e);
  }
  return geoOf(pos);
}
const FRONT_FACE=.84,REAR_FACE=-4.45;
// the front bumper's section (outward offset, height fraction): a rounded upper shoulder
// under the grille, the full face and a lip turning under
const FRONT_PROF:[number,number][]=[[-.10,1],[-.04,1],[0,.9],[.012,.7],[.012,.3],[0,.1],[-.03,0],[-.10,0]];
const REAR_PROF:[number,number][]=[[-.12,1],[-.01,1],[0,.94],[.006,.6],[0,.25],[-.02,0],[-.12,0]];
// arch flares: a band round each arch, standing a little proud of the side
function flare(ax:number,s:number):THREE.BufferGeometry{
  const sh=new THREE.Shape();const r0=ARCH_R+.005,r1=ARCH_R+.075,a0=.08,a1=Math.PI-.08,N=20;
  for(let i=0;i<=N;i++){const a=a0+(a1-a0)*i/N;const p=[Math.cos(a)*r1,Math.sin(a)*r1];if(i===0)sh.moveTo(p[0],p[1]);else sh.lineTo(p[0],p[1]);}
  for(let i=N;i>=0;i--){const a=a0+(a1-a0)*i/N;sh.lineTo(Math.cos(a)*r0,Math.sin(a)*r0);}
  const g=new THREE.ExtrudeGeometry(sh,{depth:.03,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:2,curveSegments:4});
  // shape plane (x→z along the car, y up), extruded along +z → turn it to stand out of the side
  g.rotateY(Math.PI/2);g.translate(0,ARCH_Y,ax);
  if(s>0)g.translate(W-.012,0,0);else{mirrorX(g);g.translate(-(W-.012),0,0);}
  return g;
}
// hood scoop: a low trapezoid hump on the hood's centre with a black slot facing forward
function scoop():THREE.BufferGeometry{
  const zf=.25,zr=-.17,hw=.24,h=.055,pos:number[]=[];
  const yf=hoodY(zf)-.004,yr=hoodY(zr)-.004;
  const top=(x:number,z:number,y0:number):V3=>[x,y0+h,z];
  const A:V3=[-hw,yf,zf],B:V3=[hw,yf,zf],C:V3=[hw+.06,yr,zr],D:V3=[-hw-.06,yr,zr];
  const a=top(-hw+.03,zf-.03,yf),b=top(hw-.03,zf-.03,yf),c=top(hw+.02,zr+.04,yr),d=top(-hw-.02,zr+.04,yr);
  pos.push(...a,...b,...c,...a,...c,...d);                       // top
  pos.push(...B,...C,...c,...B,...c,...b);pos.push(...D,...A,...a,...D,...a,...d); // sides
  pos.push(...C,...D,...d,...C,...d,...c);                       // rear slope
  return geoOf(pos);
}
// the sport bar ("santo antônio"): a chrome hoop behind the cab with braces to the bed rails
function sportBar():THREE.BufferGeometry{
  const y0=beltY(BED_F)+.02,zH=-2.92,x=W-.08,top=1.70;
  return merge([
    tube([[-x,y0,zH],[-x+.02,top-.12,zH],[-x+.18,top,zH],[0,top+.01,zH],[x-.18,top,zH],[x-.02,top-.12,zH],[x,y0,zH]],.032),
    tube([[-x+.02,top-.14,zH],[-x,y0+.06,-3.40]],.026),tube([[x-.02,top-.14,zH],[x,y0+.06,-3.40]],.026),
    box(.09,.02,.14,-x,y0-.005,zH),box(.09,.02,.14,x,y0-.005,zH),box(.08,.02,.12,-x,y0+.04,-3.40),box(.08,.02,.12,x,y0+.04,-3.40),
  ]);
}

// ---------------------------------------------------------------- textures (badges, hubs)
function canvasTex(w:number,h:number,draw:(x:CanvasRenderingContext2D)=>void):THREE.Texture{
  if(typeof document==='undefined')return new THREE.Texture();
  const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d')!);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
// the oval emblem: chrome rings on a transparent field
const emblemTex=canvasTex(160,128,x=>{
  x.clearRect(0,0,160,128);x.strokeStyle='#e9ecef';x.lineCap='round';
  x.lineWidth=9;x.beginPath();x.ellipse(80,64,72,52,0,0,7);x.stroke();
  x.lineWidth=8;x.beginPath();x.ellipse(80,50,44,20,0,0,7);x.stroke();
  x.beginPath();x.ellipse(80,74,15,40,0,0,7);x.stroke();
  x.strokeStyle='rgba(60,64,70,.6)';x.lineWidth=2;x.beginPath();x.ellipse(80,64,77,57,0,0,7);x.stroke();
});
// chrome letters: "HILUX" on the tailgate and the front doors
const nameTex=canvasTex(256,64,x=>{
  x.clearRect(0,0,256,64);x.font='bold 46px Arial';x.textAlign='center';x.textBaseline='middle';
  x.fillStyle='#d9dde1';x.strokeStyle='#3d4247';x.lineWidth=2;x.strokeText('HILUX',128,34);x.fillText('HILUX',128,34);
});
// SRV 17" alloy: six double spokes, machined silver, dark windows between them
const hubTex=canvasTex(256,256,x=>{
  const c=128;
  x.fillStyle='#1d1f22';x.beginPath();x.arc(c,c,127,0,7);x.fill();
  const g=x.createRadialGradient(108,100,10,c,c,128);g.addColorStop(0,'#eef0f2');g.addColorStop(.75,'#b4b9be');g.addColorStop(1,'#8a8f95');
  x.fillStyle=g;x.lineJoin='round';
  for(let i=0;i<6;i++){
    const a=i/6*Math.PI*2;x.save();x.translate(c,c);x.rotate(a);
    for(const off of[-1,1]){x.beginPath();x.moveTo(off*6,-30);x.lineTo(off*20,-112);x.lineTo(off*6,-114);x.lineTo(off*2,-30);x.closePath();x.fill();}
    x.restore();
  }
  x.strokeStyle='#c3c7cc';x.lineWidth=12;x.beginPath();x.arc(c,c,118,0,7);x.stroke();   // rim lip
  x.strokeStyle='rgba(40,42,46,.7)';x.lineWidth=2;x.beginPath();x.arc(c,c,124,0,7);x.stroke();
  x.fillStyle=g;x.beginPath();x.arc(c,c,36,0,7);x.fill();
  x.fillStyle='#3a3d42';for(let i=0;i<6;i++){const a=i/6*Math.PI*2+Math.PI/6;x.beginPath();x.arc(c+Math.cos(a)*26,c+Math.sin(a)*26,4,0,7);x.fill();}
  x.fillStyle='#d6dade';x.beginPath();x.arc(c,c,16,0,7);x.fill();
  x.strokeStyle='#6c7177';x.lineWidth=2;x.beginPath();x.ellipse(c,c,10,7,0,0,7);x.stroke();
});
const emblemM=new THREE.MeshStandardMaterial({map:emblemTex,transparent:true,roughness:.2,metalness:.8});
const nameM=new THREE.MeshStandardMaterial({map:nameTex,transparent:true,roughness:.25,metalness:.7});
const hubM=new THREE.MeshStandardMaterial({map:hubTex,roughness:.3,metalness:.6});

// ---------------------------------------------------------------- shared geometry (built once)
const BODY=loftBody();
const SHELL_GEO=toRig(merge([BODY.shell,BODY.nose,BODY.tail,hood(),roof(),upperSides(),cabBack(),bedFront(),scoop(),
  gridRing(windshieldGeo(0),windshieldGeo(.06)),                         // A-pillars, in paint
  bumper(FRONT_FACE,1,.45,.97,FRONT_FACE-ARCH_R+.02,W+.02,.24,FRONT_PROF),
  flare(0,-1),flare(0,1),flare(REAR_AX,-1),flare(REAR_AX,1),
]));

function blackParts():THREE.BufferGeometry{
  const p:THREE.BufferGeometry[]=[];
  // cowl panel between the hood and the windshield
  p.push(box(1.62,.02,.13,0,BELT+.005,COWL-.02,-.3));
  for(const s of[-1,1]){
    // B-pillar appliqué, the rear window's sash and the shut lines of the doors
    p.push(patch([[B_F,beltY(B_F)],[B_R,beltY(B_R)],[B_R,ST],[B_F,ST]],[],sidePlane(s,.009),s>0));
    p.push(patch(inset(REAR_WIN,-.022),[REAR_WIN],sidePlane(s,.009),s>0));
    for(const z of[DOOR_F,DOOR_R,RDOOR_R])p.push(box(.008,beltY(z)-SILL-.05,.014,s*(W+.002),(beltY(z)+SILL)/2+.02,z));
    p.push(box(.008,.012,DOOR_F-RDOOR_R,s*(W-.004),SILL+.065,(DOOR_F+RDOOR_R)/2));
    // the gap between the cab and the bed
    p.push(box(.008,beltY(BED_F)-BED_BOTTOM-.04,.03,s*(W+.002),(beltY(BED_F)+BED_BOTTOM)/2,(CAB_R+BED_F)/2));
    // side step (running board) under the doors, on two brackets
    p.push(box(.16,.035,1.9,s*(W-.03),.45,-1.5),box(.04,.08,.06,s*(W-.14),.49,-.75),box(.04,.08,.06,s*(W-.14),.49,-2.25));
    // bed liner: the inner walls and the rails' caps
    p.push(box(.012,beltY(BED_F)-BED_FLOOR,BED_F-TAIL,s*(W-TH-.008),(beltY(BED_F)+BED_FLOOR)/2,(TAIL+BED_F)/2));
    p.push(box(.07,.02,BED_F-TAIL,s*(W-.03),beltY(BED_F)+.012,(TAIL+BED_F)/2));
    // wheel housings in the bed
    // (kept inboard of the side's rounded lower corner, which dips to the arch: wider, they poke through it)
    p.push(box(.22,.22,.92,s*(W-RB-.12),BED_FLOOR+.11,REAR_AX));
  }
  // bed floor with its ribs, the liner on the bed's front wall and on the tailgate's inside
  p.push(box(2*(W-TH),.02,BED_F-TAIL,0,BED_FLOOR,(TAIL+BED_F)/2));
  for(let i=-3;i<=3;i++)p.push(box(.05,.015,BED_F-TAIL-.04,i*.22,BED_FLOOR+.017,(TAIL+BED_F)/2));
  p.push(box(2*(W-TH)-.02,beltY(BED_F)-BED_FLOOR,.01,0,(beltY(BED_F)+BED_FLOOR)/2,BED_F-.008));
  p.push(box(2*(W-TH)-.02,sideTop(TAIL)-BED_FLOOR,.01,0,(sideTop(TAIL)+BED_FLOOR)/2,TAIL+.012));
  // windshield rubber, wipers
  p.push(gridRing(windshieldGeo(.06),windshieldGeo(.072)));
  p.push(bar([-.70,BELT+.015,COWL-.06],[.02,BELT+.10,COWL-.22],.02,.012),bar([.08,BELT+.015,COWL-.06],[.74,BELT+.07,COWL-.17],.02,.012));
  // rear window rubber
  p.push(patch(rrect(-.58,.58,1.38,1.73,.06),[BACK_WIN],backPlane(CAB_R-.004),true));
  // front: the grille's mesh backing, the bumper's wide lower intake with its slats and the
  // fog lamp pods, the black lip under the bumper
  p.push(box(.86,.22,.02,0,1.07,NOSE+.01));
  p.push(patch([[-.52,.53],[.52,.53],[.46,.73],[-.46,.73]],[],(u,v)=>[u,v,FRONT_FACE+.017]));
  for(let i=0;i<3;i++)p.push(box(.9-i*.04,.012,.02,0,.58+i*.05,FRONT_FACE+.022));
  for(const s of[-1,1])p.push(patch(rrect(.58,.80,.56,.74,.04),[],(u,v)=>[s*u,v,FRONT_FACE-.01+(u-.58)*-.12],s<0));
  p.push(box(1.5,.04,.1,0,.46,FRONT_FACE-.04));
  // hood-scoop slot
  p.push(box(.40,.03,.01,0,hoodY(.25)+.03,.251));
  // wheel wells: a black half-drum inside every arch, closed on its inboard side
  for(const ax of[0,REAR_AX])for(const s of[-1,1]){
    const drum=new THREE.CylinderGeometry(ARCH_R-.005,ARCH_R-.005,.38,22,1,true,0,Math.PI);
    drum.rotateZ(Math.PI/2);drum.scale(-1,1,1);drum.translate(s*(W-.19),ARCH_Y,ax);
    const wall=new THREE.CircleGeometry(ARCH_R-.005,22,0,Math.PI);wall.rotateY(s>0?Math.PI/2:-Math.PI/2);wall.translate(s*(W-.38),ARCH_Y,ax);
    p.push(drum,wall);
  }
  // fuel filler flap on the bed's left side
  {const f=new THREE.RingGeometry(.075,.083,4,1,Math.PI/4);f.rotateY(-Math.PI/2);f.translate(-(W+.002),1.10,-3.0);p.push(f);}
  return merge(p);
}
const BLACK_GEO=toRig(blackParts());
// the running gear seen under the high body: frame rails, axles, the spare and the tank
const UNDER_GEO=toRig(merge([
  box(.08,.16,4.7,-.46,.44,-1.75),box(.08,.16,4.7,.46,.44,-1.75),
  (()=>{const g=new THREE.CylinderGeometry(.06,.06,1.4,10);g.rotateZ(Math.PI/2);g.translate(0,.40,REAR_AX);return g;})(),
  (()=>{const g=new THREE.SphereGeometry(.15,10,8);g.scale(1,.9,1.1);g.translate(.1,.40,REAR_AX);return g;})(),
  (()=>{const g=new THREE.CylinderGeometry(.37,.37,.24,16);g.translate(0,.44,-3.95);return g;})(),
  box(.7,.24,.8,.25,.46,-2.2),box(1.0,.24,1.0,0,.48,.1),
]));
const CHROME_GEO=toRig(merge([
  // grille: the surround, three bars, the strip over the headlamps
  ...[-1,1].map(s=>bar([s*.44,1.175,NOSE+.03],[s*.38,.965,NOSE+.03],.04,.03)),
  box(.86,.035,.03,0,1.175,NOSE+.035),box(.78,.025,.03,0,.97,NOSE+.03),
  box(.78,.026,.025,0,1.12,NOSE+.03),box(.76,.026,.025,0,1.07,NOSE+.03),box(.74,.026,.025,0,1.02,NOSE+.03),
  // rear step bumper
  bumper(REAR_FACE,-1,.48,.70,.16,W-.02,.12,REAR_PROF),
  // tailgate handle, the rear door handles, the sport bar
  box(.24,.06,.02,0,1.18,TAIL-.012),
  ...[-1,1].map(s=>box(.02,.035,.15,s*(W+.012),1.15,RDOOR_R+.16)),
  sportBar(),
]));
// glass: windshield, the rear door windows, the rear window (front door glass rides on the doors)
const WINDSHIELD_GEO=toRig(gridPatch(windshieldGeo(.066)));
const REARGLASS_GEO=toRig(patch(BACK_WIN,[],backPlane(CAB_R-.006),true));
const SIDE_GLASS_GEO=toRig(merge([-1,1].map(s=>patch(REAR_WIN,[],sidePlane(s,-.002),s>0))));
function lampShape(pts:[number,number][],z:number,d=.03):THREE.BufferGeometry{
  const s=new THREE.Shape(pts.map(([u,v])=>new THREE.Vector2(u,v)));
  const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:3});g.translate(0,0,z-d/2);return g;
}
// headlamps: swept back from the grille, their outer ends wrapping round onto the wings
const HEAD_OUTLINE:[number,number][]=[[.45,.97],[.70,.985],[.82,1.04],[.84,1.175],[.50,1.18],[.45,1.12]];
const HEAD_GEO=toRig(merge([-1,1].flatMap(s=>{
  const f=lampShape(HEAD_OUTLINE,NOSE+.012,.035);
  const side=patch([[NOSE-.03,1.03],[NOSE-.34,1.15],[NOSE-.34,1.17],[NOSE-.03,1.175]],[],(z,y)=>[W+.004,y,z],true);
  if(s<0){mirrorX(f);mirrorX(side);}
  return[f,side];
})));
const HEAD_REFLECT_GEO=toRig(merge([-1,1].flatMap(s=>{
  const bowl=new THREE.ShapeGeometry(new THREE.Shape(inset(HEAD_OUTLINE,.015).map(([u,v])=>new THREE.Vector2(u,v))));
  bowl.translate(0,0,NOSE+.002);if(s<0)mirrorX(bowl);
  const p1=new THREE.CircleGeometry(.055,20);p1.translate(s*.58,1.09,NOSE+.006);
  const p2=new THREE.CircleGeometry(.045,20);p2.translate(s*.73,1.10,NOSE+.006);
  return[bowl,p1,p2];
})));
const FOG_GEO=toRig(merge([-1,1].map(s=>{const g=new THREE.CircleGeometry(.05,20);g.translate(s*.69,.65,FRONT_FACE-.01);return g;})));
const AMBER_GEO=toRig(merge([
  ...[-1,1].map(s=>{const g=lampShape([[.73,.995],[.80,1.035],[.815,1.08],[.73,1.06]],NOSE+.008,.01);if(s<0)mirrorX(g);return g;}), // indicators in the headlamps' outer ends
  ...[-1,1].map(s=>box(.008,.03,.07,s*(W+.012),1.12,-.30)),                       // side repeaters on the wings
]));
// tail lamps: tall units on the bed's corners, red over white over red, wrapping round
const TL_X=W-.065;
const TAIL_RED_GEO=toRig(merge([-1,1].flatMap(s=>[
  lens(.12,.22,s*TL_X,1.16,TAIL-.008),lens(.12,.08,s*TL_X,.93,TAIL-.008),
  lens(.07,.22,s*(W+.004),1.16,TAIL+.035,s),lens(.07,.08,s*(W+.004),.93,TAIL+.035,s),
])));
const TAIL_WHITE_GEO=toRig(merge([-1,1].flatMap(s=>[lens(.12,.09,s*TL_X,1.005,TAIL-.008),lens(.07,.09,s*(W+.004),1.005,TAIL+.035,s)])));
const EMBLEM_GEO=toRig((():THREE.BufferGeometry=>{const g=new THREE.PlaneGeometry(.17,.135);g.translate(0,1.07,NOSE+.05);return g;})());
const NAME_GEO=toRig((():THREE.BufferGeometry=>{const g=new THREE.PlaneGeometry(.3,.075);g.rotateY(Math.PI);g.translate(-.42,1.22,TAIL-.01);return g;})());

// ---------------------------------------------------------------- the front doors
// Built from the shell's own door-zone quads + their window (glass and black sash), the
// chrome mirror and handle and the HILUX letters, relative to the hinge at the front edge.
function doorParts(s:number):{paint:THREE.BufferGeometry;black:THREE.BufferGeometry;chrome:THREE.BufferGeometry;glass:THREE.BufferGeometry;name:THREE.BufferGeometry}{
  const paint=(s<0?BODY.doorL:BODY.doorR).clone();
  const sashIn=inset(FRONT_WIN,.025);
  const by=beltY(DOOR_F);
  const black=merge([
    patch(FRONT_WIN,[sashIn],sidePlane(s,.009),s>0),
    patch([[DOOR_F-.03,by+.01],[DOOR_F-.17,by+.01],[DOOR_F-.10,by+.12]],[],sidePlane(s,.012),s>0),   // the mirror's sail
    box(.08,.05,.07,s*(W+.035),by+.07,DOOR_F-.13),                                                  // its arm
  ]);
  const chrome=merge([
    box(.18,.13,.10,s*(W+.15),by+.10,DOOR_F-.14,0,-s*.12,0),                                       // mirror housing
    box(.02,.035,.15,s*(W+.012),1.15,DOOR_R+.16),                                                  // door handle
  ]);
  const glass=patch(sashIn,[],sidePlane(s,-.002),s>0);
  const name=new THREE.PlaneGeometry(.2,.05);name.rotateY(s*Math.PI/2);name.translate(s*(W+.004),1.14,DOOR_F-.12);
  return{paint,black,chrome,glass,name};
}

// ---------------------------------------------------------------- wheels
function wheelGroup():THREE.Group{
  const g=new THREE.Group();
  // tyre: a lathe of the 265/65 R17 section (rounded shoulders), revolved round the axle
  const R=.383,rim=.216,wHalf=.1325,sh=.045;
  const prof:THREE.Vector2[]=[];
  prof.push(new THREE.Vector2(rim,-wHalf+.015));
  for(let i=0;i<=8;i++){const a=-Math.PI/2+i/8*Math.PI/2;prof.push(new THREE.Vector2(R-sh+Math.cos(a)*sh,-wHalf+sh+Math.sin(a)*sh));}
  for(let i=0;i<=8;i++){const a=i/8*Math.PI/2;prof.push(new THREE.Vector2(R-sh+Math.cos(a)*sh,wHalf-sh+Math.sin(a)*sh));}
  prof.push(new THREE.Vector2(rim,wHalf-.015));
  const tyre=new THREE.LatheGeometry(prof,32);tyre.rotateZ(Math.PI/2);
  const tm=new THREE.Mesh(tyre.scale(K,K,K),tireM);tm.castShadow=true;g.add(tm);
  // the alloy's face on the outside (+x of the wheel; flipped per side) and its barrel
  const lip=new THREE.CylinderGeometry(rim*K,rim*K,(wHalf*2-.04)*K,24,1,true);lip.rotateZ(Math.PI/2);
  g.add(new THREE.Mesh(lip,steelM));
  const face=new THREE.CircleGeometry(rim*K,32);face.rotateY(Math.PI/2);face.translate((wHalf-.03)*K,0,0);
  const fm=new THREE.Mesh(face,hubM);fm.name='hubcap';g.add(fm);
  const back=new THREE.CircleGeometry(rim*K,20);back.rotateY(-Math.PI/2);back.translate(-(wHalf-.03)*K,0,0);
  g.add(new THREE.Mesh(back,steelM));
  return g;
}

function buildHilux({color=0xaeb2b5}: {color?: number}={}): THREE.Group{
  const g=carModel.build({color}); // the full car rig in the requested colour (NOT added to the scene)
  const body=g.userData.dentable[0] as THREE.Mesh;
  const paint=body.material as THREE.Material;

  // 1) the painted shell replaces the sedan's (same paint → colour, still dentable)
  body.geometry=SHELL_GEO;body.castShadow=true;

  // 2) hide the rig's sedan glass, lamps, bumpers, plate and exhaust: the Hilux brings its own
  g.userData.dentable[1].visible=false;
  g.traverse((o:THREE.Object3D)=>{
    const m=o as THREE.Mesh;if(!m.isMesh)return;
    if(m.renderOrder===3)m.visible=false;                               // sedan cabin glass
    if(m.position.z>3)m.position.z+=.25;                                // the headlight beam, ahead of the longer nose
    const mat=m.material as THREE.MeshBasicMaterial;
    if(mat&&mat.isMeshBasicMaterial&&!mat.map&&mat.color&&mat.color.getHex()===0xfff2c0)m.visible=false; // sedan headlamps
    if(m.geometry&&(m.geometry as THREE.BufferGeometry).type==='BoxGeometry'&&Math.abs(m.position.z+2.23)<.01)m.visible=false; // plate
    if(m.geometry&&(m.geometry as THREE.BufferGeometry).type==='CylinderGeometry'&&Math.abs(m.position.z+2.24)<.01)m.visible=false; // exhaust
  });

  // 3) the cab floor stands high: the rig's interior (floor, dash, column, seats, steering
  //    wheel) and whoever sits in it are lifted onto it; the seats and the wheel also move
  //    forward, into the long cab
  const steer=g.userData.steer as THREE.Object3D;
  steer.position.y+=HILUX_LIFT;steer.position.z+=SEAT_FWD;
  for(const o of g.children){
    const m=o as THREE.Mesh;if(!m.isMesh||m===body||m===steer||m.renderOrder===3||m.position.z>3)continue;
    const c=(m.material as THREE.MeshStandardMaterial).color?.getHex?.();
    if(c===0x2a2d38){m.position.y+=HILUX_LIFT;m.position.z+=SEAT_FWD;}        // seats
    else if(c===0x1a1d24){m.position.y+=HILUX_LIFT-.02;m.position.z+=.1;}     // floor, dash, column
  }
  g.userData.seat=[-.38,-.52+HILUX_LIFT,-.15+SEAT_FWD];
  g.userData.chassis='hilux';

  // 4) brake lamps: the rig's tail-lamp mesh (its material turns bright when braking) takes
  //    the shape of the Hilux's red lenses
  g.traverse((o:THREE.Object3D)=>{const m=o as THREE.Mesh;if(m.isMesh&&m.material===g.userData.tailM){m.geometry=TAIL_RED_GEO;m.position.set(0,0,0);}});

  // 5) the parts
  const add=(geo:THREE.BufferGeometry,m:THREE.Material,shadow=false,order=0):THREE.Mesh=>{
    const o=new THREE.Mesh(geo,m);o.castShadow=shadow;o.receiveShadow=true;if(order)o.renderOrder=order;g.add(o);return o;};
  add(BLACK_GEO,blackM,true);add(UNDER_GEO,rubberM,true);add(CHROME_GEO,chromeM,true);
  add(HEAD_GEO,lensM);add(HEAD_REFLECT_GEO,chromeM);add(AMBER_GEO,amberM);add(TAIL_WHITE_GEO,whiteLampM);add(FOG_GEO,fogM);
  add(EMBLEM_GEO,emblemM);add(NAME_GEO,nameM);
  add(WINDSHIELD_GEO,glassM,false,3).visible=true;add(REARGLASS_GEO,glassM,false,3);add(SIDE_GLASS_GEO,glassM,false,3);
  // plates (front on the bumper, rear on the step bumper) + the exhaust pipe
  const pf=new THREE.Mesh(new THREE.BoxGeometry(.40*K,.13*K,.012*K),plateM);pf.position.set(0,.84*K,AXLE+(FRONT_FACE+.012)*K);g.add(pf);
  const pr=new THREE.Mesh(new THREE.BoxGeometry(.40*K,.13*K,.012*K),plateM);pr.position.set(0,.59*K,AXLE+(REAR_FACE-.012)*K);g.add(pr);
  const ex=new THREE.Mesh(new THREE.CylinderGeometry(.03*K,.03*K,.2*K,10),steelM);ex.rotation.x=Math.PI/2;ex.position.set(-.5*K,.38*K,AXLE+(REAR_FACE+.12)*K);g.add(ex);

  // 6) the front doors: hinge at the front edge of each door; door pivots of the rig re-used
  g.userData.doors.forEach((pivot:THREE.Group)=>{
    const s=pivot.position.x<0?-1:1;
    const hinge=new THREE.Vector3(s*W*K,BELT*K,AXLE+DOOR_F*K);
    pivot.position.copy(hinge);
    pivot.clear();
    const d=doorParts(s);
    for(const[geo,m,order]of[[d.paint,paint,0],[d.black,blackM,0],[d.chrome,chromeM,0],[d.glass,glassM,3],[d.name,nameM,0]] as [THREE.BufferGeometry,THREE.Material,number][]){
      const gg=toRig(geo.clone());gg.translate(-hinge.x,-hinge.y,-hinge.z);
      const mesh=new THREE.Mesh(gg,m);mesh.castShadow=m!==glassM;mesh.receiveShadow=true;if(order)mesh.renderOrder=order;
      pivot.add(mesh);
    }
  });

  // 7) wheels: the rig's wheel groups keep their steering/spin; they move onto the Hilux's
  //    axles and track, and carry its alloy on a tall off-road tyre
  for(const wg of g.userData.wheels as THREE.Group[]){
    const s=wg.position.x<0?-1:1,front=wg.position.z>0;
    wg.position.set(s*.77*K,.383*K,AXLE+(front?0:REAR_AX)*K);
    wg.clear();
    const w=wheelGroup();if(s<0)w.scale.x=-1;
    wg.add(w);
  }
  return g;
}

// Back-compat factory: build + add to the scene (mirrors makeCar/makeFiatUno).
export function makeHilux(color=0xaeb2b5): THREE.Group{const g=buildHilux({color});addVehicleLod(g,'hilux:'+color);scene.add(g);return g;}

// Model-viewer descriptor (auto-discovered) with the SRV's common colours (silver first).
export default {category:'Veículos',label:'Toyota Hilux SRV 2015',build:buildHilux,zoom:.55,yaw:.6,
  variants:[{label:'Hilux SRV — prata',opts:{color:0xaeb2b5}},
            {label:'Hilux SRV — preta',opts:{color:0x1c1e21}},
            {label:'Hilux SRV — branca',opts:{color:0xeceae4}}]};
