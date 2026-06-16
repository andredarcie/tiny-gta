import * as THREE from 'three';
import {buildHand} from '../characters/fp-hands.js';

// Detailed first-person CAR cockpit — ONE shared model, used by the player's car
// only while in first person inside a car (loaded/unloaded by js/player.js). It is
// authored in car-local space matching assets/models/vehicles/car.js:
//   +Z forward, driver on -X, floor y~0.12, dash ~z0.85, stock wheel ~(-0.38,0.88,
//   0.34), roof ~1.37. So it drops straight onto cur.g as a child and lines up.
// Pure factory (no scene.add). Exposes userData.steerWheel (turns with steering, with
// the driver's HANDS gripping it) and userData.speedNeedle (sweeps with speed).
//
// Sightline rule: the driver's eye is ~(-0.36, 1.09, 0.12) looking forward, so NOTHING
// sits in front of the driver above ~y0.95 — the dash, gauges and console all stay
// low and the windshield stays clear (no brow/binnacle block over the cluster).
//
// Two-tone "real car" trim: charcoal plastics + caramel leather seats/door inserts +
// brushed aluminium, so the cabin reads with detail instead of a black void. No thin
// coplanar accent strips (those z-fought and looked like a blinking LED).

const DASH   =new THREE.MeshStandardMaterial({color:0x2a2d36,roughness:.9,metalness:.08});  // charcoal
const DASHTOP=new THREE.MeshStandardMaterial({color:0x1b1d24,roughness:.95});               // anti-glare top
const TRIM   =new THREE.MeshStandardMaterial({color:0x454a55,roughness:.6,metalness:.3});   // grey plastic
const TAN    =new THREE.MeshStandardMaterial({color:0xc1995e,roughness:.75});               // caramel leather
const TAND   =new THREE.MeshStandardMaterial({color:0x916b39,roughness:.8});                // darker tan (bolsters)
const STITCH =new THREE.MeshStandardMaterial({color:0xe9dcbe,roughness:.7});                // cream stitching
const METAL  =new THREE.MeshStandardMaterial({color:0xcfd4dc,roughness:.26,metalness:.95}); // brushed alu
const WOOD   =new THREE.MeshStandardMaterial({color:0x6e4a28,roughness:.45,metalness:.1});  // walnut trim
const RUBBER =new THREE.MeshStandardMaterial({color:0x15161b,roughness:1});                 // wheel rim/knobs
const GAUGEF =new THREE.MeshBasicMaterial({color:0x0b0c12});                                // gauge face
const NEEDLE =new THREE.MeshBasicMaterial({color:0xff4338});
const GRING  =new THREE.MeshBasicMaterial({color:0xffb347});                                // warm amber gauge ring
const SCREEN =new THREE.MeshBasicMaterial({color:0x143e4a});   // glowing infotainment
const SCREENUI=new THREE.MeshBasicMaterial({color:0x3fd0e6});  // UI accents on the screen
const SKIN   =new THREE.MeshStandardMaterial({color:0xc8a06a,roughness:.85}); // driver's hands
const SLEEVE =new THREE.MeshStandardMaterial({color:0x19e3ff,roughness:.82}); // matches the player's shirt

const _q=new THREE.Quaternion(),_a=new THREE.Vector3(),_b=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0);
const DX=-.38; // driver x (car-local)

function mesh(geo,mat,x,y,z,rx=0,ry=0,rz=0){
  const m=new THREE.Mesh(geo,mat);
  m.position.set(x,y,z);m.rotation.set(rx,ry,rz);
  m.castShadow=false;m.receiveShadow=false;
  return m;
}
// A bar (box of length=dist) spanning from a→b — used for the angled A-pillars.
function bar(mat,thick,ax,ay,az,bx,by,bz){
  _a.set(ax,ay,az);_b.set(bx,by,bz);
  const len=_a.distanceTo(_b);
  const g=new THREE.Mesh(new THREE.BoxGeometry(thick,len,thick),mat);
  g.position.copy(_a).add(_b).multiplyScalar(.5);
  _q.setFromUnitVectors(_up,_b.sub(_a).normalize());
  g.quaternion.copy(_q);
  g.castShadow=g.receiveShadow=false;
  return g;
}
// A round air vent (ring + slats), facing the driver.
function vent(x,y,z){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.x=-.2;
  g.add(mesh(new THREE.TorusGeometry(.045,.01,8,18),TRIM,0,0,0));
  g.add(mesh(new THREE.CircleGeometry(.04,16),GAUGEF,0,0,-.005));
  for(let i=-1;i<=1;i++)g.add(mesh(new THREE.BoxGeometry(.07,.006,.004),METAL,0,i*.018,.002));
  return g;
}

// One round gauge facing up toward the driver's eye; returns {group, needle?}. Sits
// LOW on the dash face (no hood over it) so it never blocks the forward view.
function makeGauge(x,withNeedle){
  const g=new THREE.Group();
  g.position.set(x,.92,.52);                          // up in the wheel's top opening, visible
  g.rotation.x=-.7;                                   // tilt the face up to the eye
  g.add(mesh(new THREE.CircleGeometry(.08,24),GAUGEF,0,0,0));
  g.add(mesh(new THREE.TorusGeometry(.083,.01,8,26),METAL,0,0,.002));
  g.add(mesh(new THREE.TorusGeometry(.066,.004,6,24),GRING,0,0,.004));    // warm amber ring
  for(let i=0;i<8;i++){                               // tick marks around the dial
    const a=Math.PI*(1.25-i*(1.5/7));
    g.add(mesh(new THREE.BoxGeometry(.007,.016,.002),STITCH,
      Math.cos(a)*.057,Math.sin(a)*.057,.004,0,0,a-Math.PI/2));
  }
  let needle=null;
  if(withNeedle){
    needle=new THREE.Group();needle.position.z=.006;
    needle.add(mesh(new THREE.BoxGeometry(.012,.07,.004),NEEDLE,0,.03,0));
    needle.add(mesh(new THREE.CylinderGeometry(.013,.013,.01,10),METAL,0,0,0,Math.PI/2));
    g.add(needle);
  }
  return {group:g,needle};
}

// A sleeved forearm capsule spanning a→b (lap → wheel rim), oriented along the line.
function limb(mat,r,ax,ay,az,bx,by,bz){
  _a.set(ax,ay,az);_b.set(bx,by,bz);
  const len=_a.distanceTo(_b);
  const m=new THREE.Mesh(new THREE.CapsuleGeometry(r,Math.max(.02,len-2*r),6,12),mat);
  m.position.copy(_a).add(_b).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(_up,_b.sub(_a).normalize());
  m.castShadow=m.receiveShadow=false;
  return m;
}

// The driver's hands gripping the wheel — built in the WHEEL's local frame and added
// to the spinning wheel group, so the hands AND forearms TURN WITH the wheel when you
// steer (which is what the player asked for). The wheel's rake (wheelTilt rx=-0.46)
// makes "down toward the lap" point into -Y/-Z in this local frame, so the forearms
// render going down toward the driver — not into the wheel. Slim forearms + the
// slimmed buildHand keep them from looking chunky.
function addWheelArms(wheelSpin){
  for(const side of[-1,1]){                            // -1 = left hand, +1 = right hand
    // Grip ON the rim (radius ~.165), placed in the open TOP gap between the upper
    // spokes (~11/1 o'clock) so the wrapping fingers never hit a spoke. The hand
    // straddles the rim plane (z≈0) so the fingers actually curl AROUND the rim —
    // back of hand + knuckles toward the driver, fingertips just behind the rim. That
    // reads as gripping (GTA-style), not hovering in front.
    const hx=side*.115, hy=.115, hz=.018;
    // elbow routed far DOWN and OUTWARD so the forearm crosses the wheel plane OUTSIDE
    // the rim ring (no clipping through the wheel) on its way to the lap.
    const ex=side*.42, ey=-.5, ez=-.34;
    wheelSpin.add(limb(SLEEVE,.032, hx,hy,hz, ex,ey,ez));           // slim forearm: rim → elbow
    wheelSpin.add(mesh(new THREE.SphereGeometry(.034,10,8),SLEEVE,ex,ey,ez)); // cuff
    const hand=buildHand(SKIN,side);
    hand.position.set(hx,hy,hz);
    // tilt so the fingers curl over the top of the rim and wrap to the back
    hand.rotation.set(-.5,0,side*.35);
    wheelSpin.add(hand);
  }
}

export function buildCarInteriorFp(){
  const g=new THREE.Group();

  // ---- dashboard: a low charcoal block (see well over it) with a soft anti-glare
  // top pad, a walnut trim band proud of the face, and a recessed cluster panel ----
  g.add(mesh(new THREE.BoxGeometry(1.52,.30,.42),DASH,0,.74,.92));      // body, top ~y0.89
  g.add(mesh(new THREE.BoxGeometry(1.54,.05,.46),DASHTOP,0,.9,.9,.16)); // sloped soft top pad
  g.add(mesh(new THREE.BoxGeometry(1.46,.04,.025),WOOD,0,.8,.735));     // walnut band (proud, no z-fight)
  g.add(mesh(new THREE.BoxGeometry(1.5,.16,.04),DASH,0,.64,1.12));      // lower face toward firewall
  // recessed instrument-cluster panel behind the dials (flat, NOT a hood/brow)
  g.add(mesh(new THREE.BoxGeometry(.46,.2,.02),GAUGEF,DX,.9,.6,-.6));
  const speedo=makeGauge(DX-.1,true);
  const tacho=makeGauge(DX+.11,false);
  g.add(speedo.group,tacho.group);
  g.userData.speedNeedle=speedo.needle;

  // ---- centre infotainment screen + climate stack (angled to the driver) ----
  g.add(mesh(new THREE.BoxGeometry(.3,.2,.02),TRIM,.06,.82,.74,0,-.18,0));   // screen bezel
  g.add(mesh(new THREE.PlaneGeometry(.26,.16),SCREEN,.06,.82,.752,0,-.18,0));
  g.add(mesh(new THREE.PlaneGeometry(.24,.022),SCREENUI,.055,.88,.753,0,-.18,0)); // status bar
  g.add(mesh(new THREE.PlaneGeometry(.07,.07),SCREENUI,.0,.8,.753,0,-.18,0));      // map tile
  g.add(mesh(new THREE.PlaneGeometry(.07,.07),GAUGEF,.1,.8,.753,0,-.18,0));
  // climate vents + knobs below the screen
  g.add(vent(-.12,.8,.71));
  g.add(vent(.62,.84,.69));
  for(const kx of[-.03,.06,.15])g.add(mesh(new THREE.CylinderGeometry(.018,.018,.02,12),METAL,kx,.71,.73,Math.PI/2));

  // ---- steering column + detailed wheel (turns with steering) + gripping hands ----
  g.add(mesh(new THREE.CylinderGeometry(.035,.045,.34,12),DASH,DX,.66,.5,-.7));
  const wheelTilt=new THREE.Group();
  wheelTilt.position.set(DX,.86,.36);
  wheelTilt.rotation.x=-.46;                            // column rake
  const wheelSpin=new THREE.Group();
  wheelTilt.add(wheelSpin);
  wheelSpin.add(mesh(new THREE.TorusGeometry(.165,.022,12,30),RUBBER,0,0,0)); // rim
  wheelSpin.add(mesh(new THREE.TorusGeometry(.165,.006,6,30),TAND,0,0,.016));  // stitched leather wrap
  for(const a of[-Math.PI/2,Math.PI*0.18,Math.PI*0.82]){ // 3 spokes (T layout)
    wheelSpin.add(mesh(new THREE.BoxGeometry(.145,.028,.022),TRIM,
      Math.cos(a)*.08,Math.sin(a)*.08,0,0,0,a));
  }
  wheelSpin.add(mesh(new THREE.CylinderGeometry(.052,.052,.03,16),TRIM,0,0,0,Math.PI/2)); // hub
  wheelSpin.add(mesh(new THREE.CircleGeometry(.03,16),METAL,0,0,.018));                    // hub badge
  // driver's hands/forearms gripping the wheel — added to wheelSpin so they TURN with
  // the wheel as you steer (see addWheelArms)
  addWheelArms(wheelSpin);
  g.add(wheelTilt);
  g.userData.steerWheel=wheelSpin;

  // ---- centre console + gear shifter + handbrake + cupholders ----
  g.add(mesh(new THREE.BoxGeometry(.32,.34,.66),DASH,0,.30,.02));
  g.add(mesh(new THREE.BoxGeometry(.28,.05,.5),TAN,0,.475,.05));        // padded leather console top
  // gear shifter
  g.add(mesh(new THREE.BoxGeometry(.1,.05,.16),TRIM,0,.5,.18));         // shifter gate
  g.add(mesh(new THREE.CylinderGeometry(.016,.02,.18,10),METAL,0,.58,.18,.14));
  g.add(mesh(new THREE.SphereGeometry(.038,12,10),WOOD,0,.68,.205));    // walnut shifter knob
  // cupholders (two recesses) + handbrake
  for(const cz of[-.06,-.18])g.add(mesh(new THREE.CylinderGeometry(.035,.035,.05,14),GAUGEF,0,.49,cz,Math.PI,0,0));
  g.add(mesh(new THREE.BoxGeometry(.028,.028,.2),TRIM,.0,.49,-.34,-.5));
  g.add(mesh(new THREE.SphereGeometry(.026,10,8),RUBBER,0,.56,-.42));

  // ---- inner door cards (both sides): two-tone (dark top, tan insert) + details ----
  for(const s of[-1,1]){
    const x=s*.83;
    g.add(mesh(new THREE.BoxGeometry(.06,.2,1.28),DASH,x,.62,.16));      // dark upper door
    g.add(mesh(new THREE.BoxGeometry(.055,.22,1.0),TAN,x-s*.005,.46,.16)); // tan leather insert
    g.add(mesh(new THREE.BoxGeometry(.058,.02,1.0),WOOD,x-s*.004,.58,.16)); // walnut divider (proud)
    g.add(mesh(new THREE.BoxGeometry(.1,.09,.42),TAND,x-s*.03,.62,.05));  // padded armrest
    g.add(mesh(new THREE.BoxGeometry(.07,.05,1.3),DASH,x,.74,.16));       // window sill
    g.add(mesh(new THREE.BoxGeometry(.05,.05,.12),METAL,x-s*.04,.66,.34)); // door handle
    g.add(mesh(new THREE.CircleGeometry(.09,18),GAUGEF,x-s*.031,.34,.42,0,s*Math.PI/2,0)); // speaker
    g.add(mesh(new THREE.TorusGeometry(.09,.008,6,20),TRIM,x-s*.031,.34,.42,0,s*Math.PI/2,0));
    for(const wz of[.5,.56])g.add(mesh(new THREE.BoxGeometry(.04,.015,.04),METAL,x-s*.04,.62,wz)); // window switches
  }

  // ---- A-pillars + windshield header + headliner (frames the glass, all overhead) ----
  g.add(bar(DASH,.055,-.7,.93,.96,-.56,1.34,.56));
  g.add(bar(DASH,.055, .7,.93,.96, .56,1.34,.56));
  g.add(mesh(new THREE.BoxGeometry(1.16,.06,.07),DASH,0,1.345,.56));     // header rail
  g.add(mesh(new THREE.BoxGeometry(1.18,.05,1.7),TRIM,0,1.35,-.32));     // headliner panel (light grey)
  // sun visors (thin, flush to the headliner so they don't block the view)
  for(const vx of[DX,.34])g.add(mesh(new THREE.BoxGeometry(.42,.02,.16),TRIM,vx,1.31,.5,-.25));

  // ---- rear-view mirror (tucked up under the header so it doesn't block the road) ----
  g.add(mesh(new THREE.CylinderGeometry(.01,.01,.07,8),DASH,.05,1.36,.6,Math.PI/2,0,.3));
  g.add(mesh(new THREE.BoxGeometry(.21,.055,.025),DASH,.05,1.33,.61));
  g.add(mesh(new THREE.BoxGeometry(.185,.042,.008),GAUGEF,.05,1.33,.6));  // mirror glass

  // ---- seats: caramel leather with darker side bolsters + headrest. Pieces are
  // sized/offset so no two boxes share a coplanar face (that coplanarity was the
  // flickering "bug" on the seat side — classic z-fighting). ----
  for(const x of[DX,.38]){
    g.add(mesh(new THREE.BoxGeometry(.5,.58,.12),TAN,x,.53,-.46,-.12));      // backrest
    g.add(mesh(new THREE.BoxGeometry(.08,.5,.22),TAND,x-.28,.54,-.38,-.12)); // side bolster L
    g.add(mesh(new THREE.BoxGeometry(.08,.5,.22),TAND,x+.28,.54,-.38,-.12)); // side bolster R
    g.add(mesh(new THREE.BoxGeometry(.46,.16,.5),TAN,x,.245,-.12));          // cushion
    g.add(mesh(new THREE.BoxGeometry(.2,.17,.12),TAN,x,.92,-.5));            // headrest
  }

  return g;
}

// Model-viewer descriptor (auto-discovered). The viewer shows the bare cockpit.
export default {category:'Vehicles',label:'Car Interior (FP)',build:buildCarInteriorFp};
