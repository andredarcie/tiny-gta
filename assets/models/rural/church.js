import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from '../props/prop-merge.js';

// Country church: light board nave on a stone plinth, dark gable roof, corner
// buttresses, a pointed-arch double door under a rose window, Gothic pointed
// windows along the nave, and a belfry tower with louvered openings, a hanging
// bell, spire, ball finial and cross. build() is pure (church on the origin,
// front toward +z); addChurch places it in the world, bakes it into the props
// and returns the collision box (same pattern as farm-house/barn). Materials are
// module-level and shared so bakeProp can batch every church into the prop chunks.
const wallM=matte({color:0xf2ece0,roughness:.95});   // light boards
const roofM=matte({color:0x6e4632,roughness:.9});     // dark shingles
const trimM=matte({color:0x5e3c24,roughness:.85});    // dark wood trim
const doorM=matte({color:0x6e4a32,roughness:.9});
const glassM=matte({color:0x8fb6d8,roughness:.4,side:THREE.DoubleSide}); // bluish stained glass
const roseM=matte({color:0xd2a24a,roughness:.5,side:THREE.DoubleSide});  // warm rose window
const crossM=matte({color:0xe8e2d2,roughness:.7});
const stoneM=matte({color:0x9b958a,roughness:1});     // stone plinth + buttresses
const bellM=matte({color:0x9a7d3c,roughness:.5,metalness:.6}); // bronze bell

// One Gothic pointed-arch window: blue glass with a dark frame and a pointed top,
// built facing +z on the origin so a caller can rotate it onto a wall face.
function pointedWindow(w,h){
  const g=new THREE.Group();
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(w,h),glassM);
  glass.position.y=h/2;g.add(glass);
  // pointed top: a flat triangle capping the rectangle
  const tip=new THREE.Shape();
  tip.moveTo(-w/2,0);tip.lineTo(w/2,0);tip.lineTo(0,w*.7);tip.closePath();
  const top=new THREE.Mesh(new THREE.ShapeGeometry(tip),glassM);
  top.position.y=h;g.add(top);
  // thin frame: two jambs, a sill and the two raking bars of the point
  for(const sx of[-1,1]){
    const jamb=new THREE.Mesh(new THREE.BoxGeometry(.06,h,.05),trimM);
    jamb.position.set(sx*w/2,h/2,.02);g.add(jamb);
    const rake=new THREE.Mesh(new THREE.BoxGeometry(.06,w*.86,.05),trimM);
    rake.position.set(sx*w/4,h+w*.35,.02);rake.rotation.z=sx*Math.atan2(w/2,w*.7);g.add(rake);
  }
  const sill=new THREE.Mesh(new THREE.BoxGeometry(w+.14,.08,.1),trimM);
  sill.position.set(0,0,.04);g.add(sill);
  const mull=new THREE.Mesh(new THREE.BoxGeometry(.05,h,.05),trimM);
  mull.position.set(0,h/2,.03);g.add(mull);
  return g;
}

function build(){
  const g=new THREE.Group();
  const W=5,D=8,H=4;                       // nave
  // stone plinth the whole building sits on (reads as a foundation, not a box)
  const plinth=new THREE.Mesh(new THREE.BoxGeometry(W+.6,.5,D+.6),stoneM);
  plinth.position.y=.25;plinth.receiveShadow=true;g.add(plinth);
  const nave=new THREE.Mesh(new THREE.BoxGeometry(W,H,D),wallM);
  nave.position.y=.5+H/2;nave.castShadow=true;nave.receiveShadow=true;g.add(nave);
  const baseY=.5;                          // top of the plinth (walls start here)
  // gable roof (ridge along z)
  const RISE=1.8,OVER=.4,half=W/2+OVER,slope=Math.hypot(half,RISE),ang=Math.atan2(RISE,half);
  for(const s of[-1,1]){
    const pane=new THREE.Mesh(new THREE.BoxGeometry(slope,.18,D+OVER*2),roofM);
    pane.position.set(s*half/2,baseY+H+RISE/2,0);pane.rotation.z=-s*ang;pane.castShadow=true;g.add(pane);
  }
  // ridge cap board running the length of the roof
  const ridge=new THREE.Mesh(new THREE.BoxGeometry(.16,.16,D+OVER*2),trimM);
  ridge.position.set(0,baseY+H+RISE,0);g.add(ridge);
  // triangular gables closing the gap under the roof
  const gable=new THREE.Shape();
  gable.moveTo(-W/2,0);gable.lineTo(W/2,0);gable.lineTo(0,RISE);gable.closePath();
  const gableGeo=new THREE.ShapeGeometry(gable);
  for(const[z,ry]of[[-D/2,Math.PI],[D/2,0]]){
    const tri=new THREE.Mesh(gableGeo,wallM);tri.position.set(0,baseY+H,z);tri.rotation.y=ry;g.add(tri);
  }
  // stone corner buttresses (sloped cap) at the four nave corners
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const but=new THREE.Mesh(new THREE.BoxGeometry(.55,H*.78,.55),stoneM);
    but.position.set(sx*(W/2-.05),baseY+H*.39,sz*(D/2-.05));but.castShadow=true;g.add(but);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(.42,.4,4),stoneM);
    cap.position.set(sx*(W/2-.05),baseY+H*.78+.18,sz*(D/2-.05));cap.rotation.y=Math.PI/4;g.add(cap);
  }
  // tower / belfry at the front (+z)
  const TW=1.8,TH=6.2,tz=D/2-.2;
  const tower=new THREE.Mesh(new THREE.BoxGeometry(TW,TH,TW),wallM);
  tower.position.set(0,TH/2,tz);tower.castShadow=true;g.add(tower);
  // string course (cornice) ringing the tower below the belfry
  const cornice=new THREE.Mesh(new THREE.BoxGeometry(TW+.18,.18,TW+.18),trimM);
  cornice.position.set(0,TH-1.7,tz);g.add(cornice);
  // spire (4-sided pyramid) + ball finial + cross on top
  const spire=new THREE.Mesh(new THREE.ConeGeometry(TW*.8,2.4,4),roofM);
  spire.position.set(0,TH+1.2,tz);spire.rotation.y=Math.PI/4;spire.castShadow=true;g.add(spire);
  const finial=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),crossM);
  finial.position.set(0,TH+2.45,tz);g.add(finial);
  const cv=new THREE.Mesh(new THREE.BoxGeometry(.14,.85,.14),crossM);cv.position.set(0,TH+3.05,tz);g.add(cv);
  const chm=new THREE.Mesh(new THREE.BoxGeometry(.5,.14,.14),crossM);chm.position.set(0,TH+3.18,tz);g.add(chm);
  // belfry: a louvered (slatted) dark opening on each face, with a bell hanging inside
  for(const[ox,oz,ry]of[[0,1,0],[0,-1,0],[1,0,Math.PI/2],[-1,0,Math.PI/2]]){
    const recess=new THREE.Mesh(new THREE.BoxGeometry(TW-.5,1.5,.06),trimM);
    recess.position.set(ox*(TW/2+.02),TH-1.0,tz+oz*(TW/2+.02));recess.rotation.y=ry;g.add(recess);
    for(let k=0;k<4;k++){
      const louver=new THREE.Mesh(new THREE.BoxGeometry(TW-.55,.12,.08),wallM);
      louver.position.set(ox*(TW/2+.05),TH-1.6+k*.36,tz+oz*(TW/2+.05));
      louver.rotation.set(.5,ry,0);g.add(louver);
    }
  }
  const bell=new THREE.Mesh(new THREE.CylinderGeometry(.3,.42,.5,12,1,true),bellM);
  bell.position.set(0,TH-.95,tz);g.add(bell);
  const bellTop=new THREE.Mesh(new THREE.SphereGeometry(.42,12,6,0,Math.PI*2,0,Math.PI/2.2),bellM);
  bellTop.position.set(0,TH-.72,tz);g.add(bellTop);
  // pointed-arch double door at the base of the tower, on a small landing
  for(const sx of[-1,1]){
    const leaf=new THREE.Mesh(new THREE.BoxGeometry(.56,2.2,.1),doorM);
    leaf.position.set(sx*.3,1.1+baseY,tz+TW/2+.04);g.add(leaf);
  }
  // pointed arch + frame around the doorway
  const arch=new THREE.Shape();
  arch.moveTo(-.66,0);arch.lineTo(.66,0);arch.lineTo(0,.7);arch.closePath();
  const archMesh=new THREE.Mesh(new THREE.ShapeGeometry(arch),doorM);
  archMesh.position.set(0,baseY+2.2,tz+TW/2+.04);g.add(archMesh);
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.BoxGeometry(.1,2.35,.14),trimM);
    post.position.set(sx*.66,baseY+1.17,tz+TW/2+.06);g.add(post);
    const knob=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),crossM);
    knob.position.set(sx*.16,baseY+1.1,tz+TW/2+.11);g.add(knob);
  }
  // stone steps up to the door
  for(let s=0;s<2;s++){
    const step=new THREE.Mesh(new THREE.BoxGeometry(2.0-s*.5,.22,.5),stoneM);
    step.position.set(0,.11+s*.22,tz+TW/2+.6-s*.32);g.add(step);
  }
  // rose window on the tower face, above the door (classic facade position)
  const roseZ=tz+TW/2+.03, roseY=baseY+3.4;
  const rose=new THREE.Mesh(new THREE.CircleGeometry(.5,20),roseM);
  rose.position.set(0,roseY,roseZ);g.add(rose);
  const roseRing=new THREE.Mesh(new THREE.TorusGeometry(.52,.06,8,20),trimM);
  roseRing.position.set(0,roseY,roseZ+.02);g.add(roseRing);
  for(let k=0;k<6;k++){
    const spoke=new THREE.Mesh(new THREE.BoxGeometry(.05,.96,.04),trimM);
    spoke.position.set(0,roseY,roseZ+.03);spoke.rotation.z=k*Math.PI/6;g.add(spoke);
  }
  // pointed-arch stained-glass windows along the nave sides
  for(const sx of[-1,1])for(const dz of[-2.2,0,2.2]){
    const win=pointedWindow(.6,1.5);
    win.position.set(sx*(W/2+.03),baseY+1.0,dz);
    win.rotation.y=sx>0?-Math.PI/2:Math.PI/2;g.add(win);
  }
  g.userData.r=Math.max(W,D)/2+.3;g.userData.h=baseY+H+RISE+.5;
  return g;
}

export default {category:'Rural',label:'Country church',build};

export function addChurch(cx,cz,ry=0){
  const g=build();g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  // collision: AABB covering nave + tower (valid for ry 0 or pi, used in the village)
  return{x0:cx-2.9,x1:cx+2.9,z0:cz-4.5,z1:cz+4.5,h:g.userData.h};
}
