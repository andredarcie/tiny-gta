import * as THREE from 'three';
import {matte} from '../matte.js';

// WEED DELIVERY BACKPACK — a detailed military-canvas rucksack the player wears on
// their back while running a delivery (js/weed-farm.js attaches/detaches it). Built
// centered at the body's middle, with the back panel + shoulder straps on +z (the
// side that hugs the player's back) and the bulk on -z, so it sits right when added
// at a small -z offset on the player. Pure: returns a fresh Object3D, no scene.add.

const canvasM=matte({color:0x4d5a39,roughness:.95});   // olive canvas body
const panelM =matte({color:0x3c4630,roughness:.95});   // back panel / lid
const pocketM=matte({color:0x57663f,roughness:.92});   // pockets (slightly lighter)
const strapM =matte({color:0x2b3222,roughness:.9});    // webbing straps
const buckleM=matte({color:0xb98e3a,roughness:.45,metalness:.5}); // brass buckles
const matM   =matte({color:0xb09a6a,roughness:.95});   // rolled bedroll on top
const leafM  =matte({color:0x4f9a3d,roughness:.8});    // weed sprig poking out
const leafDk =matte({color:0x3c7a30,roughness:.8});
const tieM   =matte({color:0x6a5230,roughness:.9});    // leather tie

function strap(x0: number,y0: number,z0: number,x1: number,y1: number,z1: number,w=.05): THREE.Mesh {
  const a=new THREE.Vector3(x0,y0,z0),b=new THREE.Vector3(x1,y1,z1);
  const len=a.distanceTo(b),mid=a.clone().add(b).multiplyScalar(.5);
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,len,w*.6),strapM);
  m.position.copy(mid);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());
  return m;
}

export function makeWeedBackpack(): THREE.Group {
  const g=new THREE.Group();

  // ---- main body (slight taper, bulges out the back = -z) ----
  const body=new THREE.Mesh(new THREE.BoxGeometry(.42,.52,.26),canvasM);
  body.position.set(0,0,-.05);body.castShadow=true;g.add(body);
  // rounded shoulders: a thinner cap box on top + a bottom roll
  const top=new THREE.Mesh(new THREE.BoxGeometry(.4,.12,.24),canvasM);
  top.position.set(0,.27,-.05);g.add(top);
  const bottom=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.42,12),canvasM);
  bottom.rotation.z=Math.PI/2;bottom.position.set(0,-.26,-.05);g.add(bottom);

  // ---- back panel + padding (the side against the player, +z) ----
  const panel=new THREE.Mesh(new THREE.BoxGeometry(.4,.5,.05),panelM);
  panel.position.set(0,0,.1);g.add(panel);
  for(const sx of[-1,1]){ // padded spine pads
    const pad=new THREE.Mesh(new THREE.CapsuleGeometry(.05,.34,4,6),panelM);
    pad.position.set(sx*.12,-.02,.12);g.add(pad);
  }

  // ---- top flap with a buckled strap ----
  const flap=new THREE.Mesh(new THREE.BoxGeometry(.44,.2,.3),panelM);
  flap.position.set(0,.22,-.06);flap.rotation.x=.12;flap.castShadow=true;g.add(flap);
  for(const sx of[-1,1]){
    g.add(strap(sx*.12,.34,-.2,sx*.12,.02,-.22,.05));        // flap retaining straps
    const bk=new THREE.Mesh(new THREE.BoxGeometry(.07,.05,.03),buckleM);
    bk.position.set(sx*.12,.05,-.225);g.add(bk);
  }

  // ---- front pocket (faces out, -z) with its own flap + buckle ----
  const pocket=new THREE.Mesh(new THREE.BoxGeometry(.3,.24,.1),pocketM);
  pocket.position.set(0,-.08,-.21);pocket.castShadow=true;g.add(pocket);
  const pflap=new THREE.Mesh(new THREE.BoxGeometry(.32,.1,.12),panelM);
  pflap.position.set(0,.04,-.22);pflap.rotation.x=.2;g.add(pflap);
  const pbk=new THREE.Mesh(new THREE.BoxGeometry(.06,.04,.03),buckleM);
  pbk.position.set(0,-.04,-.27);g.add(pbk);

  // ---- side compression straps + side pockets ----
  for(const sx of[-1,1]){
    const sp=new THREE.Mesh(new THREE.BoxGeometry(.06,.3,.18),pocketM);
    sp.position.set(sx*.23,-.05,-.05);g.add(sp);
    const cs=new THREE.Mesh(new THREE.BoxGeometry(.07,.04,.2),strapM);
    cs.position.set(sx*.23,.08,-.05);g.add(cs);
  }

  // ---- shoulder straps: arc up over the back and forward over the shoulders ----
  for(const sx of[-1,1]){
    g.add(strap(sx*.12,.3,.12, sx*.16,.12,.18,.07));   // top of strap at the pack
    g.add(strap(sx*.16,.12,.18, sx*.17,-.18,.16,.07)); // down the front (over shoulder)
    const sternum=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.06),strapM);
    sternum.position.set(0,-.02,.2);g.add(sternum); // sternum strap across the chest
  }
  // haul handle on top
  const handle=new THREE.Mesh(new THREE.TorusGeometry(.05,.015,6,12,Math.PI),strapM);
  handle.position.set(0,.34,.02);handle.rotation.x=Math.PI/2;g.add(handle);

  // ---- a rolled bedroll lashed across the top ----
  const roll=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.46,12),matM);
  roll.rotation.z=Math.PI/2;roll.position.set(0,.34,-.06);roll.castShadow=true;g.add(roll);
  for(const sx of[-1,1]){
    const tie=new THREE.Mesh(new THREE.TorusGeometry(.075,.012,6,12),tieM);
    tie.rotation.y=Math.PI/2;tie.position.set(sx*.16,.34,-.06);g.add(tie);
  }

  // ---- a little weed sprig poking out the top (what's inside) ----
  const sprig=new THREE.Group();sprig.position.set(.1,.3,-.1);sprig.rotation.z=-.3;
  const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.22,5),leafDk);
  stalk.position.y=.11;sprig.add(stalk);
  for(const[ay,az,mat] of[[.16,.0,leafM],[.12,.6,leafDk],[.12,-.6,leafM]] as [number,number,THREE.Material][]){
    for(const side of[-1,1]){
      const blade=new THREE.Mesh(new THREE.ConeGeometry(.03,.13,5),mat);
      blade.scale.z=.25;
      const arm=new THREE.Group();arm.add(blade);blade.position.y=.065;
      arm.position.y=ay;arm.rotation.z=side*.7+az*0;arm.rotation.x=az;sprig.add(arm);
    }
  }
  g.add(sprig);

  g.userData.r=.45;
  return g;
}

export default {category:'Rural',label:'Weed backpack',build:makeWeedBackpack,zoom:1.8};
