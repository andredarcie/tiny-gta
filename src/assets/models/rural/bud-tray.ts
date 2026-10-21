import * as THREE from 'three';
import {matte} from '../matte.ts';

// Shallow wooden TRIM TRAY on the work table: each bud snipped off the dried plant lands
// here, then the whole tray is tipped into the crate. Origin = the centre of its floor;
// userData.inside is where landed buds are parented (so they ride along when it tips) and
// userData.grip the near rim a hand lifts it by.
const woodM=matte({color:0xa9824f});
const woodDarkM=matte({color:0x7a5a33});

export const TRAY_W=.42, TRAY_D=.3;
export function makeBudTray(): THREE.Group{
  const g=new THREE.Group();
  const floor=new THREE.Mesh(new THREE.BoxGeometry(TRAY_W,.015,TRAY_D),woodDarkM);
  floor.position.y=.0075;floor.receiveShadow=true;g.add(floor);
  for(const [x,z,w,d] of [[0,TRAY_D/2,TRAY_W,.015],[0,-TRAY_D/2,TRAY_W,.015],[TRAY_W/2,0,.015,TRAY_D],[-TRAY_W/2,0,.015,TRAY_D]] as number[][]){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(w,.05,d),woodM);
    wall.position.set(x,.025,z);wall.castShadow=true;g.add(wall);
  }
  const inside=new THREE.Group();inside.position.y=.02;g.add(inside);
  const grip=new THREE.Object3D();grip.position.set(0,.05,TRAY_D/2);g.add(grip);
  g.userData.inside=inside;g.userData.grip=grip;
  return g;
}

export default {category:'Rural',label:'Bud trim tray',build:makeBudTray,zoom:3};
