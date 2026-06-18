import carModel from './car.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '../../../js/engine.js';

// Fiat Uno (Mille / Fire) — the boxy little Brazilian hatchback ("quadrado"). Built on
// the shared car rig so it drives, brakes, dents and gets stolen like any car; we just
// swap the painted shell for a short, tall, sharp-edged two-box hatch with a steep
// windshield, a near-vertical tailgate, rectangular headlights and a slim Fiat grille.
// It keeps the rig's body paint, so a colour can be passed in like the sedan.
//
// Car coordinates: +z = forward, x = width, y = height from the ground (wheels touch
// at y0). Front axle z=+1.45, rear axle z=-1.08 (inherited from car.js).

const glassM=new THREE.MeshStandardMaterial({color:0x8fc3e0,roughness:.08,metalness:.6,
  transparent:true,opacity:.42,depthWrite:false});                                          // same blue glass as the car
const grilleM=new THREE.MeshStandardMaterial({color:0x1a1d24,roughness:.6,metalness:.3});
const hlM=new THREE.MeshBasicMaterial({color:0xfff2c0});

// Clone a base geometry already positioned in car coordinates (same helper as car.js).
function placed(geo,x,y,z,rx=0,rz=0){
  const g=geo.clone();
  if(rx)g.rotateX(rx);
  if(rz)g.rotateZ(rz);
  g.translate(x,y,z);
  return g;
}

// Hatchback shell fused into ONE mesh (replaces the sedan body, stays dentable, keeps
// the sedan paint material so it takes the requested colour): a low lower body, a
// short flat hood up front, a TALL boxy cabin and a flat roof — no taper, all square.
const unoBodyGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.62,.62,3.9),0,.61,0),       // lower body
  placed(new THREE.BoxGeometry(1.54,.18,1.16),0,.96,1.30),   // short hood
  placed(new THREE.BoxGeometry(1.52,.62,2.34),0,1.16,-.3),   // tall boxy cabin
  placed(new THREE.BoxGeometry(1.36,.1,2.0),0,1.50,-.35),    // flat roof cap
],false);

// Loose detail geometries.
const windG=new THREE.BoxGeometry(1.42,.6,.05);    // steep windshield
const sideWinG=new THREE.BoxGeometry(.04,.4,1.86);  // long boxy side window
const hatchG=new THREE.BoxGeometry(1.2,.5,.05);     // near-vertical tailgate glass
const headG=new THREE.BoxGeometry(.32,.16,.06);     // rectangular headlight
const grilleG=new THREE.BoxGeometry(.7,.12,.05);    // slim front grille
const doorPanelG=new THREE.BoxGeometry(.06,.56,1.04);

function buildUno({color=0x3b7ac2}={}){
  const g=carModel.build({color}); // full car rig in the requested colour (NOT added to the scene)

  // 1) swap the sedan shell for the boxy hatch (keeps the paint material → colour, and
  //    stays dentable → dents on impact)
  const body=g.userData.dentable[0];
  body.geometry=unoBodyGeo;
  body.castShadow=true;

  // 2) hide the sedan greenhouse glass (renderOrder 3 mesh) and the inherited boxy
  //    headlights (the lone MeshBasic glow without a map) — re-added to fit the hatch.
  g.traverse(o=>{
    if(!o.isMesh)return;
    if(o.renderOrder===3)o.visible=false;
    const m=o.material;
    if(m&&m.isMeshBasicMaterial&&!m.map&&m.color&&m.color.getHex()===0xfff2c0)o.visible=false;
  });

  // 3) move the brake lights onto the short tail (keeps userData.tailM working)
  g.traverse(o=>{if(o.isMesh&&o.material===g.userData.tailM)o.position.set(0,.18,.24);});

  // 4) reshape the two doors to the compact hatch (keep the body-colour paint)
  for(const pivot of g.userData.doors){
    pivot.position.y=.6;pivot.position.z=.6;
    const panel=pivot.children[0];
    panel.geometry=doorPanelG;
    panel.position.set(0,0,-.52);
  }

  // 5) steep windshield + boxy side windows + near-vertical tailgate glass
  const ws=new THREE.Mesh(windG,glassM);
  ws.position.set(0,1.16,.84);ws.rotation.x=-.36;ws.renderOrder=3;g.add(ws);
  for(const sx of[-1,1]){
    const w=new THREE.Mesh(sideWinG,glassM);
    w.position.set(sx*.78,1.18,-.32);w.renderOrder=3;g.add(w);
  }
  const hatch=new THREE.Mesh(hatchG,glassM);
  hatch.position.set(0,1.18,-1.49);hatch.rotation.x=.16;hatch.renderOrder=3;g.add(hatch);

  // 6) rectangular headlights + slim Fiat grille across the nose
  for(const sx of[-1,1]){
    const lamp=new THREE.Mesh(headG,hlM);
    lamp.position.set(sx*.54,.8,1.9);g.add(lamp);
  }
  const grille=new THREE.Mesh(grilleG,grilleM);
  grille.position.set(0,.66,1.9);g.add(grille);

  return g;
}

// Back-compat factory: build + add to the scene (mirrors makeCar/makeAmbulance).
export function makeFiatUno(color){const g=buildUno({color});scene.add(g);return g;}

// Model-viewer descriptor (auto-discovered) with a couple of paint variants.
export default {category:'Vehicles',label:'Fiat Uno',build:buildUno,
  variants:[{label:'Fiat Uno — blue',opts:{color:0x3b7ac2}},
            {label:'Fiat Uno — red',opts:{color:0xc23b4e}}]};
