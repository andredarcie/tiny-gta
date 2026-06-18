import carModel from './car.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '../../../js/engine.js';

// VW Kombi (Type 2 "bread loaf" bus) — the classic Brazilian white van. Built on the
// shared car rig (wheels, doors, steering wheel, dent system, brake lights) so it
// drives, brakes, dents and gets stolen exactly like every other car; we only swap
// the painted shell for a tall, boxy forward-control van and re-dress the front
// (split windshield, round headlights, chrome roundel) and the rear glass.
//
// Car coordinates: +z = forward, x = width, y = height from the ground (wheels touch
// at y0). Front axle z=+1.45, rear axle z=-1.08 (inherited from car.js).

const paintM=new THREE.MeshStandardMaterial({color:0xf2f3f5,roughness:.5,metalness:.1});   // matte white body
const glassM=new THREE.MeshStandardMaterial({color:0x8fc3e0,roughness:.08,metalness:.6,
  transparent:true,opacity:.42,depthWrite:false});                                          // same blue glass as the car
const chromeM=new THREE.MeshStandardMaterial({color:0xc7ccd4,roughness:.3,metalness:.85});
const hlM=new THREE.MeshBasicMaterial({color:0xfff2c0});

// Clone a base geometry already positioned in car coordinates (same helper as car.js).
function placed(geo,x,y,z,rx=0,rz=0){
  const g=geo.clone();
  if(rx)g.rotateX(rx);
  if(rz)g.rotateZ(rz);
  g.translate(x,y,z);
  return g;
}

// Van shell fused into ONE mesh (replaces the sedan body, stays dentable): a tall
// lower slab, a slightly narrower greenhouse set back from the nose, and a roof cap.
// The lower nose juts ahead of the windshield base — the unmistakable Kombi profile.
const vanBodyGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.72,.66,4.04),0,.63,0),       // lower body slab
  placed(new THREE.BoxGeometry(1.66,.94,3.84),0,1.43,-.05),   // greenhouse
  placed(new THREE.BoxGeometry(1.54,.12,3.6),0,1.94,-.08),    // roof cap
],false);

// Loose detail geometries.
const winG=new THREE.BoxGeometry(.74,.78,.05);     // windshield pane (split, one each side)
const dividerG=new THREE.BoxGeometry(.07,.8,.06);  // central windshield split bar
const sideWinG=new THREE.BoxGeometry(.04,.7,2.7);  // long side window
const rearWinG=new THREE.BoxGeometry(1.18,.7,.05);
const headG=new THREE.CylinderGeometry(.13,.13,.05,16);  // round headlight disc
const bezelG=new THREE.TorusGeometry(.135,.028,8,16);    // chrome rim around it
const badgeG=new THREE.CylinderGeometry(.16,.16,.04,18); // VW-style nose roundel
const doorPanelG=new THREE.BoxGeometry(.06,.72,1.0);     // taller cab door

function buildKombi(){
  const g=carModel.build({color:0xf2f3f5}); // full car rig (NOT added to the scene)

  // 1) swap the sedan shell for the van silhouette (still dentable → dents on impact)
  const body=g.userData.dentable[0];
  body.geometry=vanBodyGeo;
  body.material=paintM;
  body.castShadow=true;

  // 2) hide the sedan greenhouse glass (single mesh at renderOrder 3) and the inherited
  //    boxy headlights (the only MeshBasic glow without a map) — we re-add van glass
  //    and round lamps below.
  g.traverse(o=>{
    if(!o.isMesh)return;
    if(o.renderOrder===3)o.visible=false;
    const m=o.material;
    if(m&&m.isMeshBasicMaterial&&!m.map&&m.color&&m.color.getHex()===0xfff2c0)o.visible=false;
  });

  // 3) move the brake lights onto the van's tall rear (keeps userData.tailM working)
  g.traverse(o=>{if(o.isMesh&&o.material===g.userData.tailM)o.position.set(0,.07,.16);});

  // 4) reshape the two front doors into tall cab doors hinged up by the nose
  for(const pivot of g.userData.doors){
    pivot.position.y=.66;pivot.position.z=1.18;
    const panel=pivot.children[0];
    panel.geometry=doorPanelG;
    panel.material=paintM;
    panel.position.set(0,0,-.5);
  }

  // 5) split windshield (two panes + central bar)
  for(const sx of[-1,1]){
    const pane=new THREE.Mesh(winG,glassM);
    pane.position.set(sx*.41,1.42,1.89);pane.renderOrder=3;g.add(pane);
  }
  const divider=new THREE.Mesh(dividerG,paintM);
  divider.position.set(0,1.42,1.9);g.add(divider);

  // 6) long side windows + rear window
  for(const sx of[-1,1]){
    const w=new THREE.Mesh(sideWinG,glassM);
    w.position.set(sx*.835,1.42,-.1);w.renderOrder=3;g.add(w);
  }
  const rw=new THREE.Mesh(rearWinG,glassM);
  rw.position.set(0,1.42,-1.99);rw.renderOrder=3;g.add(rw);

  // 7) round headlights with chrome bezels + the VW-style roundel on the nose
  for(const sx of[-1,1]){
    const lamp=new THREE.Mesh(headG,hlM);
    lamp.rotation.x=Math.PI/2;lamp.position.set(sx*.56,.62,2.03);g.add(lamp);
    const bezel=new THREE.Mesh(bezelG,chromeM);
    bezel.position.set(sx*.56,.62,2.045);g.add(bezel);
  }
  const badge=new THREE.Mesh(badgeG,chromeM);
  badge.rotation.x=Math.PI/2;badge.position.set(0,.74,2.04);g.add(badge);

  return g;
}

// Back-compat factory: build + add to the scene (mirrors makeCar/makeAmbulance).
export function makeKombi(){const g=buildKombi();scene.add(g);return g;}

// Model-viewer descriptor (auto-discovered). zoom<1 frames the tall van; yaw shows a
// rear 3/4 so the split windshield and roundel read straight away.
export default {category:'Vehicles',label:'Kombi (Bus)',build:buildKombi,zoom:.62,yaw:-.5};
