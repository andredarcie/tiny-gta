import * as THREE from 'three';
import {matte} from '../matte.ts';

// PARTY AFFILIATION DESK — the little folding table where a party recruiter
// signs up new members (see js/places/party-hq.ts). A plain table draped with a
// party-coloured cloth, a stack of sign-up sheets, and a small desk flag.
// build() is pure: desk at the origin, front face towards +z; the system
// positions it and adds collision. NOT baked — placed at runtime by party-hq.

const LEG=matte({color:0x5b5f6b,roughness:.8});      // grey folding legs (FLEET grey)
const TOP=matte({color:0xd8c5a6,roughness:.9});      // faded table top (FACADES sand)
const PAPER=matte({color:0xffe9c9,roughness:1});     // sign-up sheets (NEON cream)
const clothMats=new Map<number,THREE.MeshLambertMaterial>();
const clothFor=(c:number):THREE.MeshLambertMaterial=>{
  if(!clothMats.has(c))clothMats.set(c,matte({color:c,roughness:.95}));
  return clothMats.get(c)!;
};

function build(opts:{color?:number}={}):THREE.Group{
  const color=opts.color??0xc23b4e;
  const cloth=clothFor(color);
  const g=new THREE.Group();
  // table top + folding legs
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.7,.07,.8),TOP);
  top.position.y=.8;top.castShadow=true;g.add(top);
  for(const[lx,lz]of[[-.72,.3],[.72,.3],[-.72,-.3],[.72,-.3]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.8,.06),LEG);
    leg.position.set(lx,.4,lz);g.add(leg);
  }
  // party-coloured cloth draped over the front (the face the player sees)
  const drape=new THREE.Mesh(new THREE.BoxGeometry(1.72,.62,.04),cloth);
  drape.position.set(0,.53,.42);drape.castShadow=true;g.add(drape);
  const runner=new THREE.Mesh(new THREE.BoxGeometry(1.74,.05,.86),cloth);
  runner.position.y=.845;g.add(runner);
  // sign-up sheets + a pen pot
  const sheets=new THREE.Mesh(new THREE.BoxGeometry(.34,.05,.46),PAPER);
  sheets.position.set(-.35,.9,.02);sheets.rotation.y=.12;g.add(sheets);
  const pot=new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,.12,8),LEG);
  pot.position.set(.15,.93,-.1);g.add(pot);
  // small desk flag on a pole at the table corner
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.55,6),LEG);
  pole.position.set(.62,1.1,-.22);g.add(pole);
  const flag=new THREE.Mesh(new THREE.BoxGeometry(.34,.2,.015),cloth);
  flag.position.set(.45,1.28,-.22);flag.castShadow=true;g.add(flag);
  g.userData.r=1.1;g.userData.h=1.4;
  return g;
}

export default {
  category:'Props',label:'Party Desk',build,
  variants:[
    {label:'Red',opts:{color:0xc23b4e}},
    {label:'Blue',opts:{color:0x3b7ac2}},
  ],
};
