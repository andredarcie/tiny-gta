import carModel from './car.js';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '../../../js/engine.js';

// Fiat Uno (Mk1 / Brazilian "Mille Fire") — the tall, square little hatchback Giugiaro
// drew with a Kamm tail. Modelled to the real Mk1: ~3689 x 1556 x 1410 mm on a 2362 mm
// wheelbase (scaled here to the car rig's 2.53-unit wheelbase). Built on that rig so it
// drives, brakes, dents and gets stolen like any car. Matches the real car:
//   - a TALL, upright greenhouse with a big glass area (low beltline) and a flat roof
//   - a short, dropping bonnet; a near-vertical Kamm tailgate
//   - wide rectangular headlights + a slim grille with the Fiat badge
//   - big matte-black plastic bumpers front & rear and a black side rub strip
//   - 45° chamfer strips fused in soften the roof shoulders / nose like the real shell
// It keeps the rig's body paint, so a colour is passed in like the sedan.
//
// Car coordinates: +z = forward, x = width, y = height from the ground (wheels touch at
// y0). Front axle z=+1.45, rear axle z=-1.08 (inherited from car.js).

const glassM=new THREE.MeshStandardMaterial({color:0x8fc3e0,roughness:.08,metalness:.6,
  transparent:true,opacity:.42,depthWrite:false});                                          // same blue glass as the car
const blackM=new THREE.MeshStandardMaterial({color:0x14161b,roughness:.85,metalness:.05});  // plastic bumpers + rub strip
const grilleM=new THREE.MeshStandardMaterial({color:0x20232a,roughness:.6,metalness:.3});
const chromeM=new THREE.MeshStandardMaterial({color:0xc8ccd2,roughness:.3,metalness:.8});
const hlM=new THREE.MeshBasicMaterial({color:0xfff2c0});                                     // headlights

// Clone a base geometry already positioned in car coordinates (same helper as car.js).
function placed(geo,x,y,z,rx=0,rz=0){
  const g=geo.clone();
  if(rx)g.rotateX(rx);
  if(rz)g.rotateZ(rz);
  g.translate(x,y,z);
  return g;
}

// Hatchback shell fused into ONE mesh (replaces the sedan body, keeps the sedan paint
// material so it takes the requested colour, stays dentable): a low body (low beltline →
// lots of glass), a short dropping bonnet, a TALL boxy cabin, a flat roof, plus 45°
// chamfer strips on the roof shoulders and nose to soften the hard edges.
const unoBodyGeo=mergeGeometries([
  placed(new THREE.BoxGeometry(1.66,.5,3.8),0,.55,.12),       // lower body (short → low beltline)
  placed(new THREE.BoxGeometry(1.58,.14,.92),0,.82,1.52,-.07),// short dropping bonnet
  placed(new THREE.BoxGeometry(1.56,.74,2.55),0,1.16,-.27),   // tall boxy cabin
  placed(new THREE.BoxGeometry(1.4,.1,2.15),0,1.5,-.32),      // flat roof cap
  placed(new THREE.BoxGeometry(.14,.14,2.2),.70,1.47,-.32,0,Math.PI/4),   // round roof shoulder L
  placed(new THREE.BoxGeometry(.14,.14,2.2),-.70,1.47,-.32,0,Math.PI/4),  // round roof shoulder R
  placed(new THREE.BoxGeometry(1.5,.13,.13),0,1.46,.6,Math.PI/4,0),       // round windshield header
],false);

// Loose detail geometries.
const windG=new THREE.BoxGeometry(1.5,.66,.05);    // steep windshield
const sideWinG=new THREE.BoxGeometry(.04,.5,2.05);  // tall boxy side window
const pillarG=new THREE.BoxGeometry(.05,.5,.06);    // B-pillar
const hatchG=new THREE.BoxGeometry(1.32,.54,.05);   // near-vertical tailgate glass
const headG=new THREE.BoxGeometry(.4,.2,.07);       // wide rectangular headlight
const grilleG=new THREE.BoxGeometry(.7,.11,.05);    // slim front grille
const badgeG=new THREE.BoxGeometry(.14,.09,.05);    // Fiat grille badge
const bumperG=new THREE.BoxGeometry(1.64,.28,.3);   // big plastic bumper
const intakeG=new THREE.BoxGeometry(.78,.09,.06);   // lower bumper intake slot
const rubG=new THREE.BoxGeometry(.04,.08,2.7);      // black side rub strip
const doorPanelG=new THREE.BoxGeometry(.06,.52,1.1); // door panel
const stalkG=new THREE.BoxGeometry(.1,.03,.03);     // mirror stalk
const mirrorG=new THREE.BoxGeometry(.05,.11,.12);   // door mirror head

function buildUno({color=0x3b7ac2}={}){
  const g=carModel.build({color}); // full car rig in the requested colour (NOT added to the scene)

  // 1) swap the sedan shell for the boxy hatch (keeps the paint material → colour, and
  //    stays dentable → dents on impact)
  const body=g.userData.dentable[0];
  body.geometry=unoBodyGeo;
  body.castShadow=true;

  // 2) hide the sedan greenhouse glass (renderOrder 3 mesh), the inherited boxy
  //    headlights (lone MeshBasic glow without a map) and the sedan bumpers.
  g.userData.dentable[1].visible=false; // inherited bumpers off
  const drop=[];
  g.traverse(o=>{
    if(!o.isMesh)return;
    if(o.renderOrder===3)o.visible=false;
    if(o.position.z>3)drop.push(o); // inherited headlight beam plane (z=4.8): inflates bounds
    const m=o.material;
    if(m&&m.isMeshBasicMaterial&&!m.map&&m.color&&m.color.getHex()===0xfff2c0)o.visible=false;
  });
  for(const o of drop)o.parent.remove(o);

  // 3) move the brake lights up to the rear corners — Kamm-tail vertical lamps (keeps userData.tailM)
  g.traverse(o=>{if(o.isMesh&&o.material===g.userData.tailM)o.position.set(0,.28,.42);});

  // 4) reshape the two doors to the compact hatch (keep the body-colour paint)
  for(const pivot of g.userData.doors){
    pivot.position.y=.56;pivot.position.z=.62;
    const panel=pivot.children[0];
    panel.geometry=doorPanelG;
    panel.position.set(0,0,-.55);
  }

  // 5) steep windshield + tall boxy side windows (with a B-pillar) + tailgate glass
  const ws=new THREE.Mesh(windG,glassM);
  ws.position.set(0,1.16,1.0);ws.rotation.x=-.34;ws.renderOrder=3;g.add(ws);
  for(const sx of[-1,1]){
    const w=new THREE.Mesh(sideWinG,glassM);
    w.position.set(sx*.79,1.18,-.3);w.renderOrder=3;g.add(w);
    const p=new THREE.Mesh(pillarG,body.material);p.position.set(sx*.792,1.18,.12);g.add(p);
  }
  const hatch=new THREE.Mesh(hatchG,glassM);
  hatch.position.set(0,1.16,-1.55);hatch.rotation.x=.16;hatch.renderOrder=3;g.add(hatch);

  // 6) wide rectangular headlights + slim Fiat grille with badge across the nose
  for(const sx of[-1,1]){
    const lamp=new THREE.Mesh(headG,hlM);
    lamp.position.set(sx*.56,.82,2.04);g.add(lamp);
  }
  const grille=new THREE.Mesh(grilleG,grilleM);
  grille.position.set(0,.8,2.05);g.add(grille);
  const badge=new THREE.Mesh(badgeG,chromeM);
  badge.position.set(0,.8,2.07);g.add(badge);

  // 7) big black plastic bumpers (front with a lower intake) + black side rub strip +
  //    door mirrors on short stalks
  const fb=new THREE.Mesh(bumperG,blackM);fb.position.set(0,.46,2.06);g.add(fb);
  const intake=new THREE.Mesh(intakeG,grilleM);intake.position.set(0,.4,2.22);g.add(intake);
  const rb=new THREE.Mesh(bumperG,blackM);rb.position.set(0,.46,-1.82);g.add(rb);
  for(const sx of[-1,1]){
    const rub=new THREE.Mesh(rubG,blackM);rub.position.set(sx*.835,.58,.05);g.add(rub);
    const stalk=new THREE.Mesh(stalkG,blackM);stalk.position.set(sx*.84,1.0,.62);g.add(stalk);
    const head=new THREE.Mesh(mirrorG,blackM);head.position.set(sx*.9,1.0,.6);g.add(head);
  }

  return g;
}

// Back-compat factory: build + add to the scene (mirrors makeCar/makeAmbulance).
export function makeFiatUno(color){const g=buildUno({color});scene.add(g);return g;}

// Model-viewer descriptor (auto-discovered) with a couple of paint variants.
export default {category:'Vehicles',label:'Fiat Uno',build:buildUno,zoom:.7,yaw:.6,
  variants:[{label:'Fiat Uno — blue',opts:{color:0x3b7ac2}},
            {label:'Fiat Uno — red',opts:{color:0xc23b4e}}]};
