import carModel from './car.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.js';

// VW Kombi (Type 2 "bay window" / "pão de forma") — the classic Brazilian white van,
// modelled to the real T2: 4505 x 1720 x 1940 mm on a 2400 mm wheelbase (scaled here
// to the shared car rig's 2.53-unit wheelbase). Built on that rig so it drives, brakes,
// dents and gets stolen like any car. The shell matches the real van feature-by-feature:
//   - ONE large, slightly curved windshield (the T2 dropped the T1 split screen)
//   - a black fresh-air grille panel under it with AMBER turn-signals at its ends
//   - two round headlights low in the front corners + the VW roundel centred between them
//   - chrome wrap bumpers, a beltline trim, segmented side windows, rear engine louvres
//   - 45° chamfer strips fused into the body fake the T2's ROUNDED roof/nose edges
//
// Car coordinates: +z = forward, x = width, y = height from the ground (wheels touch at
// y0). Front axle z=+1.45, rear axle z=-1.08 (inherited from car.js).

const paintM=new THREE.MeshStandardMaterial({color:0xeef0f2,roughness:.55,metalness:.08});  // matte white body
const glassM=new THREE.MeshStandardMaterial({color:0x8fc3e0,roughness:.08,metalness:.6,
  transparent:true,opacity:.42,depthWrite:false});                                           // same blue glass as the car
const chromeM=new THREE.MeshStandardMaterial({color:0xc8ccd2,roughness:.28,metalness:.85});  // bumpers / bezels / roundel
const trimM=new THREE.MeshStandardMaterial({color:0x20232a,roughness:.6,metalness:.3});      // grille panel + louvres
const slatM=new THREE.MeshStandardMaterial({color:0x40444d,roughness:.6,metalness:.4});      // grille slats
const amberM=new THREE.MeshBasicMaterial({color:0xff9a2e});                                   // turn-signal lenses
const hlM=new THREE.MeshBasicMaterial({color:0xfff2c0});                                      // headlights

// Clone a base geometry already positioned in car coordinates (same helper as car.js).
function placed(geo: THREE.BufferGeometry,x: number,y: number,z: number,rx=0,rz=0): THREE.BufferGeometry{
  const g=geo.clone();
  if(rx)g.rotateX(rx);
  if(rz)g.rotateZ(rz);
  g.translate(x,y,z);
  return g;
}

// Van shell fused into ONE mesh (replaces the sedan body, stays dentable): a tall lower
// slab, a tumblehome greenhouse, a narrower roof, plus 45° chamfer strips along the roof
// shoulders / windshield header / lower nose to round the hard box edges like the real T2.
const vanBodyGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.80,.74,4.66),0,.69,-.03),    // lower body slab (below beltline)
  placed(new THREE.BoxGeometry(1.68,.78,4.46),0,1.45,-.06),   // greenhouse (window band, tumblehome)
  placed(new THREE.BoxGeometry(1.52,.12,4.16),0,1.91,-.10),   // roof cap (narrower)
  placed(new THREE.BoxGeometry(.18,.18,4.2),.80,1.86,-.08,0,Math.PI/4),   // round roof shoulder L
  placed(new THREE.BoxGeometry(.18,.18,4.2),-.80,1.86,-.08,0,Math.PI/4),  // round roof shoulder R
  placed(new THREE.BoxGeometry(1.62,.16,.16),0,1.86,2.1,Math.PI/4,0),     // round windshield header
  placed(new THREE.BoxGeometry(1.76,.2,.2),0,.36,2.28,-Math.PI/4,0),      // round lower nose valance
],false);

// Loose detail geometries.
const windG=new THREE.BoxGeometry(1.46,.72,.05);   // single curved-ish windshield (one piece)
const sideWinG=new THREE.BoxGeometry(.04,.58,3.4);  // long side window band
const pillarG=new THREE.BoxGeometry(.08,.58,.08);   // B/C pillar splitting the side glass
const rearWinG=new THREE.BoxGeometry(1.32,.54,.05);
const grilleG=new THREE.BoxGeometry(1.32,.26,.05);  // black front grille panel
const slatG=new THREE.BoxGeometry(1.2,.02,.06);     // grille slats
const signalG=new THREE.BoxGeometry(.18,.16,.06);   // amber turn signal at a grille end
const headG=new THREE.CylinderGeometry(.17,.17,.05,18);  // round headlight
const bezelG=new THREE.TorusGeometry(.175,.032,8,18);    // chrome rim
const badgeG=new THREE.CylinderGeometry(.185,.185,.04,20); // VW roundel disc
const badgeRingG=new THREE.TorusGeometry(.185,.024,8,20);
const beltG=new THREE.BoxGeometry(.03,.05,4.5);     // beltline chrome trim
const bumperG=new THREE.BoxGeometry(1.78,.2,.26);   // wrap bumper
const louvreG=new THREE.BoxGeometry(.02,.025,.55);  // rear engine-bay vent slat
const doorPanelG=new THREE.BoxGeometry(.06,.66,1.0); // cab door panel
const stalkG=new THREE.BoxGeometry(.14,.04,.04);    // mirror stalk
const mirrorG=new THREE.BoxGeometry(.05,.2,.14);    // big cab-door mirror head
const wiperG=new THREE.BoxGeometry(.5,.02,.025);    // windshield wiper
const overG=new THREE.BoxGeometry(.1,.24,.1);       // bumper overrider nub

function buildKombi(): THREE.Group{
  const g=carModel.build({color:0xeef0f2}); // full car rig (NOT added to the scene)

  // 1) swap the sedan shell for the van silhouette (still dentable → dents on impact)
  const body=g.userData.dentable[0];
  body.geometry=vanBodyGeo;
  body.material=paintM;
  body.castShadow=true;

  // 2) hide the sedan greenhouse glass (renderOrder 3 mesh), the inherited boxy
  //    headlights (lone MeshBasic glow without a map) and the sedan bumpers.
  g.userData.dentable[1].visible=false; // inherited bumpers off
  const drop: THREE.Object3D[]=[];
  g.traverse((o: any)=>{
    if(!o.isMesh)return;
    if(o.renderOrder===3)o.visible=false;
    if(o.position.z>3)drop.push(o); // inherited headlight beam plane (z=4.8): inflates bounds
    const m=o.material;
    if(m&&m.isMeshBasicMaterial&&!m.map&&m.color&&m.color.getHex()===0xfff2c0)o.visible=false;
  });
  for(const o of drop)o.parent!.remove(o);

  // 3) move the brake lights to the rear corners at beltline height (keeps userData.tailM)
  g.traverse((o: any)=>{if(o.isMesh&&o.material===g.userData.tailM)o.position.set(0,.27,-.16);});

  // 4) reshape the two front doors into the cab doors hinged at the A-pillar
  for(const pivot of g.userData.doors){
    pivot.position.y=.69;pivot.position.z=1.7;
    const panel=pivot.children[0];
    panel.geometry=doorPanelG;
    panel.material=paintM;
    panel.position.set(0,0,-.5);
  }

  // 5) single windshield + long side windows (split by B/C pillars) + rear window
  const ws=new THREE.Mesh(windG,glassM);
  ws.position.set(0,1.46,2.18);ws.rotation.x=-.18;ws.renderOrder=3;g.add(ws);
  for(const sx of[-1,1]){
    const w=new THREE.Mesh(sideWinG,glassM);
    w.position.set(sx*.86,1.45,-.1);w.renderOrder=3;g.add(w);
    for(const pz of[.55,-.7]){
      const p=new THREE.Mesh(pillarG,paintM);p.position.set(sx*.862,1.45,pz);g.add(p);
    }
    // rear engine-bay air louvres on the upper rear quarter
    for(let i=0;i<4;i++){
      const l=new THREE.Mesh(louvreG,trimM);l.position.set(sx*.865,1.36+i*.08,-1.92);g.add(l);
    }
  }
  const rw=new THREE.Mesh(rearWinG,glassM);
  rw.position.set(0,1.45,-2.31);rw.renderOrder=3;g.add(rw);

  // 6) black grille panel (with slats) + amber turn signals at its ends, just under
  //    the windshield
  const grille=new THREE.Mesh(grilleG,trimM);
  grille.position.set(0,1.0,2.31);g.add(grille);
  for(let i=0;i<4;i++){
    const s=new THREE.Mesh(slatG,slatM);s.position.set(0,.91+i*.06,2.335);g.add(s);
  }
  for(const sx of[-1,1]){
    const sig=new THREE.Mesh(signalG,amberM);sig.position.set(sx*.7,1.0,2.32);g.add(sig);
  }

  // 7) round headlights with chrome bezels in the lower corners + VW roundel centred
  for(const sx of[-1,1]){
    const lamp=new THREE.Mesh(headG,hlM);
    lamp.rotation.x=Math.PI/2;lamp.position.set(sx*.74,.6,2.32);g.add(lamp);
    const bezel=new THREE.Mesh(bezelG,chromeM);
    bezel.position.set(sx*.74,.6,2.33);g.add(bezel);
  }
  const badge=new THREE.Mesh(badgeG,chromeM);
  badge.rotation.x=Math.PI/2;badge.position.set(0,.72,2.33);g.add(badge);
  const badgeRing=new THREE.Mesh(badgeRingG,trimM);
  badgeRing.position.set(0,.72,2.355);g.add(badgeRing);

  // 8) chrome wrap bumpers (front & rear) + beltline trim down each side
  const fb=new THREE.Mesh(bumperG,chromeM);fb.position.set(0,.34,2.37);g.add(fb);
  const rb=new THREE.Mesh(bumperG,chromeM);rb.position.set(0,.34,-2.43);g.add(rb);
  for(const sx of[-1,1]){
    const belt=new THREE.Mesh(beltG,chromeM);belt.position.set(sx*.915,1.04,-.06);g.add(belt);
  }

  // 9) cab-door mirrors on stalks, two windshield wipers, front bumper overriders
  for(const sx of[-1,1]){
    const stalk=new THREE.Mesh(stalkG,trimM);stalk.position.set(sx*.95,1.28,1.55);g.add(stalk);
    const head=new THREE.Mesh(mirrorG,trimM);head.position.set(sx*1.01,1.28,1.52);g.add(head);
    const over=new THREE.Mesh(overG,chromeM);over.position.set(sx*.5,.38,2.42);g.add(over);
  }
  for(const sx of[-1,1]){
    const wiper=new THREE.Mesh(wiperG,trimM);
    wiper.position.set(sx*.32,1.14,2.26);wiper.rotation.z=sx*.5;g.add(wiper);
  }

  return g;
}

// Back-compat factory: build + add to the scene (mirrors makeCar/makeAmbulance).
export function makeKombi(): THREE.Group{const g=buildKombi();scene.add(g);return g;}

// Model-viewer descriptor (auto-discovered). zoom<1 frames the tall van; yaw shows a
// front 3/4 so the grille, headlights and roundel read straight away.
export default {category:'Vehicles',label:'Kombi (Bus)',build:buildKombi,zoom:.82,yaw:.6};
