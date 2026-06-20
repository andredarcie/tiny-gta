import * as THREE from 'three';
import {scene} from '../../../js/engine.js';

// Classic farm TRACTOR — a slow, chunky utility vehicle for the rural area. Detailed:
// a long tapering engine hood with a radiator grille and headlights, a vertical
// exhaust stack, big ribbed rear wheels under flared fenders, small STEERED front
// wheels on an axle, an open elevated seat with a raked steering wheel, a roll bar
// (ROPS) and a rear hitch. +Z is forward; the wheels sit on the ground (y≈0).
// Drivable: js/player.js spawns it (spawnTractor) with the `tractor` flag and exposes
// userData.wheels / userData.front (for spinWheels) and userData.steer.

const GREEN  =new THREE.MeshStandardMaterial({color:0x2f7d32,roughness:.5,metalness:.3});
const GREEN_D=new THREE.MeshStandardMaterial({color:0x215a24,roughness:.6,metalness:.2});
const YELLOW =new THREE.MeshStandardMaterial({color:0xf0c020,roughness:.5,metalness:.3});
const TIRE   =new THREE.MeshStandardMaterial({color:0x14141a,roughness:.95});
const METAL  =new THREE.MeshStandardMaterial({color:0xb9bec9,roughness:.3,metalness:.9});
const DARK   =new THREE.MeshStandardMaterial({color:0x1a1d24,roughness:.6,metalness:.3});
const SEATM  =new THREE.MeshStandardMaterial({color:0x23252c,roughness:.85});
const HEADM  =new THREE.MeshBasicMaterial({color:0xfff2c0});
const GRILLEM=new THREE.MeshStandardMaterial({color:0x2a2d33,roughness:.5,metalness:.6});

function box(mat: THREE.Material,w: number,h: number,d: number,x: number,y: number,z: number,rx=0,ry=0,rz=0,cast=true): THREE.Mesh{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=cast;return m;
}
function cyl(mat: THREE.Material,rt: number,rb: number,h: number,seg: number,x: number,y: number,z: number,rx=0,ry=0,rz=0,cast=true): THREE.Mesh{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg),mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=cast;return m;
}

// One wheel: dark tire (axis along X) with chunky angled tread lugs + a coloured rim,
// metal hub cap and spokes. Returns a GROUP whose rotation.x rolls it (spinWheels).
function makeWheel(r: number,w: number): THREE.Group{
  const g=new THREE.Group();
  g.add(cyl(TIRE,r,r,w,22,0,0,0,0,0,Math.PI/2));                 // tire, axis -> X
  for(let i=0;i<12;i++){                                          // ribbed tread lugs
    const a=i/12*Math.PI*2;
    g.add(box(TIRE,w+.03,.07,.13, 0,Math.cos(a)*(r-.02),Math.sin(a)*(r-.02), a+.4,0,0));
  }
  g.add(cyl(YELLOW,r*.6,r*.6,w+.015,18,0,0,0,0,0,Math.PI/2));    // rim disc
  g.add(cyl(METAL,r*.2,r*.2,w+.06,12,0,0,0,0,0,Math.PI/2,false));// hub cap
  for(let i=0;i<5;i++){const a=i/5*Math.PI*2;                     // spokes
    g.add(box(YELLOW,w*.5,.05,r*.78, 0,Math.cos(a)*r*.26,Math.sin(a)*r*.26, a,0,0,false));}
  return g;
}

// Half-pipe fender shell over a rear wheel (axis along X, only the top arc).
function fender(r: number,w: number,x: number,y: number,z: number): THREE.Mesh{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,w,18,1,true,0,Math.PI),GREEN);
  m.position.set(x,y,z);m.rotation.set(0,0,Math.PI/2);m.castShadow=true;
  m.material=GREEN;return m;
}

export function buildTractor(): THREE.Group{
  const g=new THREE.Group();

  // ----- chassis spine -----
  g.add(box(GREEN_D,.46,.34,2.7, 0,.66,-.1));

  // ----- engine hood (tapers up toward the dash) + grille + headlights -----
  g.add(box(GREEN,.72,.6,1.5, 0,.94,1.02));            // hood block
  g.add(box(GREEN,.62,.16,1.5, 0,1.27,1.02));          // hood top ridge
  g.add(box(GREEN_D,.74,.1,1.48, 0,.66,1.02,0,0,0,false));   // lower hood trim (no shadow)
  g.add(box(GRILLEM,.62,.52,.08, 0,.86,1.79));         // radiator grille
  for(let i=0;i<5;i++)g.add(box(METAL,.52,.025,.02, 0,.7+i*.1,1.84,0,0,0,false)); // slats
  g.add(cyl(HEADM,.085,.085,.07,12, -.36,1.04,1.76,Math.PI/2,0,0,false)); // headlights
  g.add(cyl(HEADM,.085,.085,.07,12,  .36,1.04,1.76,Math.PI/2,0,0,false));
  g.add(cyl(METAL,.1,.1,.04,12, -.36,1.04,1.795,Math.PI/2,0,0,false));    // light bezels
  g.add(cyl(METAL,.1,.1,.04,12,  .36,1.04,1.795,Math.PI/2,0,0,false));

  // ----- vertical exhaust stack (front-left of the hood) -----
  g.add(cyl(DARK,.05,.055,.78,12, -.4,1.66,1.32));
  g.add(cyl(METAL,.065,.065,.08,12, -.4,2.06,1.32,0,0,.25));    // angled rain cap

  // ----- cowl / dash + steering column + wheel -----
  g.add(box(GREEN_D,.7,.42,.34, 0,1.0,.28));           // dash housing
  g.add(cyl(DARK,.04,.055,.52,10, 0,1.12,.16,-.62));   // steering column
  const steer=new THREE.Group();
  steer.position.set(0,1.34,.4);steer.rotation.x=-.62; // raked toward the driver
  steer.add(new THREE.Mesh(new THREE.TorusGeometry(.17,.024,8,22),DARK));
  for(const a of[-Math.PI/2,Math.PI*.18,Math.PI*.82])
    steer.add(box(DARK,.29,.028,.024, Math.cos(a)*.085,Math.sin(a)*.085,0, 0,0,a));
  steer.add(cyl(DARK,.05,.05,.04,12, 0,0,0, Math.PI/2));
  g.add(steer);

  // ----- open elevated seat + footplates -----
  g.add(cyl(METAL,.05,.06,.46,10, 0,.83,-.52));        // seat pedestal
  g.add(box(SEATM,.42,.1,.42, 0,1.06,-.56));           // seat base (cushion)
  g.add(box(SEATM,.42,.42,.1, 0,1.27,-.76,-.18));      // seat back
  g.add(box(SEATM,.46,.06,.12, -0,1.04,-.36));         // seat front lip
  g.add(box(METAL,.36,.04,.46, -.4,.5,.46,0,0,0,false));     // left footplate (no shadow)
  g.add(box(METAL,.36,.04,.46,  .4,.5,.46,0,0,0,false));     // right footplate (no shadow)

  // ----- rear fenders over the big wheels -----
  g.add(fender(.86,.4,-.72,.74,-.72));
  g.add(fender(.86,.4, .72,.74,-.72));

  // ----- roll bar (ROPS) behind the seat -----
  g.add(box(METAL,.07,1.05,.07, -.44,1.55,-.82));
  g.add(box(METAL,.07,1.05,.07,  .44,1.55,-.82));
  g.add(box(METAL,.95,.08,.08, 0,2.04,-.82));

  // ----- rear three-point hitch / drawbar -----
  g.add(box(DARK,.34,.2,.22, 0,.5,-1.46));
  g.add(cyl(METAL,.04,.04,.36,10, 0,.62,-1.58,0,0,Math.PI/2,false));

  // ----- wheels: 2 big rear (drive) + 2 small steered front -----
  g.userData.wheels=[];g.userData.front=[];
  for(const sx of[-1,1]){                              // rear (big)
    const w=makeWheel(.72,.34);
    w.position.set(sx*.72,.72,-.72);w.rotation.order='YXZ';
    g.add(w);g.userData.wheels.push(w);
  }
  g.add(box(DARK,1.2,.12,.14, 0,.43,1.24,0,0,0,false));      // front axle beam (no shadow)
  for(const sx of[-1,1]){                              // front (small, steered)
    const w=makeWheel(.43,.24);
    w.position.set(sx*.56,.43,1.24);w.rotation.order='YXZ';
    g.add(w);g.userData.wheels.push(w);g.userData.front.push(w);
  }

  g.userData.steer=steer;
  return g;
}

// Back-compat factory: build + add to the scene (mirrors makeCar/makeMotorcycle).
export function makeTractor(): THREE.Group{const g=buildTractor();scene.add(g);return g;}

// Model-viewer descriptor (auto-discovered).
export default {category:'Vehicles',label:'Tractor',build:buildTractor};
