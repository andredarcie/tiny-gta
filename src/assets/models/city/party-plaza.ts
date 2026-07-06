import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from '../props/prop-merge.ts';
import {addParkBench} from '../props/park-bench.ts';
import {addStreetLamp} from '../props/street-lamp.ts';
import {groundHeight} from '@/core/constants.ts';

// PARTY PLAZA — the simplified city square each political party gets on its HQ
// block (js/world/world.ts swaps the block's buildings / rich park for this).
// Deliberately SPARSE compared to a normal park (assets/models/city/park.ts):
// an open tinted floor (painted on the ground canvas by world.ts), a coloured
// centre ring where the affiliation desk stands, four tall corner flags in the
// party colour, two benches and two lamps — nothing else, so the plaza stays
// mostly free space for the wing to roam and fight on.

type Solid={x0:number;x1:number;z0:number;z1:number;h:number};

const POLE=matte({color:0x5b5f6b,roughness:.8});  // steel flag poles (FLEET grey)
const PAVE=matte({color:0xbcb6a8,roughness:1});   // sidewalk-tone paved core
// One cached material per party colour so bakeProp can merge all plaza pieces.
const colMats=new Map<number,THREE.MeshLambertMaterial>();
const colFor=(c:number):THREE.MeshLambertMaterial=>{
  if(!colMats.has(c))colMats.set(c,matte({color:c,roughness:.85}));
  return colMats.get(c)!;
};

export function buildPartyPlaza(cx:number,cz:number,inner:number,solids:Solid[],color:number):void{
  const h=inner/2,gy=groundHeight(cx,cz);
  const g=new THREE.Group();g.position.set(cx,gy,cz);
  const mat=colFor(color);

  // coloured centre ring with a paved core — the affiliation desk stands here
  const ring=new THREE.Mesh(new THREE.CircleGeometry(4.4,40),mat);
  ring.rotation.x=-Math.PI/2;ring.position.y=.03;ring.receiveShadow=true;g.add(ring);
  const core=new THREE.Mesh(new THREE.CircleGeometry(3.4,40),PAVE);
  core.rotation.x=-Math.PI/2;core.position.y=.05;core.receiveShadow=true;g.add(core);

  // four tall corner flags in the party colour, each hanging towards the centre
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const fx=sx*(h-1.3),fz=sz*(h-1.3);
    const fg=new THREE.Group();
    fg.position.set(fx,0,fz);
    fg.rotation.y=Math.atan2(-fx,-fz); // local +z points at the plaza centre
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.07,.09,5.2,8),POLE);
    pole.position.y=2.6;pole.castShadow=true;fg.add(pole);
    const flag=new THREE.Mesh(new THREE.BoxGeometry(.05,.72,1.25),mat);
    flag.position.set(0,4.66,.68);flag.castShadow=true;fg.add(flag);
    g.add(fg);
  }

  bakeProp(g); // merge the bespoke pieces into the shared prop chunks

  // two benches facing the centre + two mid-edge lamps (with their own bakes)
  for(const sx of[-1,1])
    solids.push(addParkBench(cx+sx*5.6,cz,Math.atan2(-sx,0)));
  addStreetLamp(cx,cz-(h-1.3));
  addStreetLamp(cx,cz+(h-1.3));
}
