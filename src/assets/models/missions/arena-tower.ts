import * as THREE from 'three';
import {matte} from '../matte.ts';

// ARENA GUARD TOWER — the MOBA-style turret each party fields on the stadium
// pitch (js/activities/party-arena.ts). build() is pure: tower at the origin,
// party colour on the band + top; the activity module positions it, gives it HP
// (it is an Npc so the player's weapons can destroy it) and makes it shoot.

const STONE=matte({color:0x8d8f99,roughness:.95});   // body (GROUND rock)
const STONE_DK=matte({color:0x5b5f6b,roughness:.9}); // base / cannon
const colMats=new Map<number,THREE.MeshLambertMaterial>();
const colFor=(c:number):THREE.MeshLambertMaterial=>{
  if(!colMats.has(c))colMats.set(c,matte({color:c,roughness:.85}));
  return colMats.get(c)!;
};

function build(opts:{color?:number}={}):THREE.Group{
  const color=opts.color??0xc23b4e;
  const mat=colFor(color);
  const g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.5,1,10),STONE_DK);
  base.position.y=.5;base.castShadow=true;g.add(base);
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.85,1.05,3,10),STONE);
  body.position.y=2.5;body.castShadow=true;g.add(body);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.92,.92,.5,10),mat);
  band.position.y=3.2;g.add(band);
  const deck=new THREE.Mesh(new THREE.CylinderGeometry(1.25,1.25,.3,10),STONE_DK);
  deck.position.y=4.15;deck.castShadow=true;g.add(deck);
  // crenellated rim + the party-colour cap
  for(let k=0;k<6;k++){
    const a=k/6*Math.PI*2;
    const m=new THREE.Mesh(new THREE.BoxGeometry(.34,.34,.34),STONE);
    m.position.set(Math.cos(a)*1.1,4.45,Math.sin(a)*1.1);g.add(m);
  }
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.55,.8,8),mat);
  cap.position.y=4.9;cap.castShadow=true;g.add(cap);
  // stubby cannon on the deck (visual only; tracers come from the activity)
  const cannon=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,1.2,8),STONE_DK);
  cannon.rotation.z=Math.PI/2;cannon.position.set(.7,4.35,0);g.add(cannon);
  g.userData.muzzleY=4.35; // where the activity spawns tracers from
  g.userData.r=1.5;g.userData.h=5.2;
  return g;
}

export default {
  category:'Missions',label:'Arena Tower',build,
  variants:[
    {label:'Red',opts:{color:0xc23b4e}},
    {label:'Blue',opts:{color:0x3b7ac2}},
  ],
};
