import * as THREE from 'three';
import {bakeGeometry,bakedMat} from '../bake.ts';

// Distance LOD for road vehicles. A detailed car is ~17 meshes (body, glass, doors,
// wheels, lights, steering wheel…) — ~17 draw calls each, the biggest share of the city's
// draws. Past VEHICLE_LOD_DIST the whole vehicle swaps to ONE baked mesh (bake.ts): same
// shape and colours, a single draw. Up close (and whenever the player could notice: the
// car they drive is always near the camera) the full detailed model is shown.
//
// Live parts stay OUTSIDE the LOD, always drawn: anything flagged userData.lodKeep (the
// police light bar that blinks, the headlight beam) and anything added later (the seated
// driver, custom parts). A customised car (paint/rims/spoiler…) just keeps full detail
// (disableVehicleLod) so its baked copy never shows stale colours.

export const VEHICLE_LOD_DIST=38; // metres

// Baked geometry is shared between vehicles of the same model + colour.
const cache=new Map<string,THREE.BufferGeometry|null>();

/** Wrap a finished vehicle's static parts in a THREE.LOD (detail near, one mesh far). */
export function addVehicleLod(g: THREE.Object3D,key: string): void{
  if(g.userData.lod)return;
  const detail=new THREE.Group();
  detail.name='lod-detail';
  for(const c of [...g.children])if(!c.userData.lodKeep)detail.add(c);
  let geo=cache.get(key);
  if(geo===undefined){geo=bakeGeometry(detail);cache.set(key,geo);}
  const lod=new THREE.LOD();
  lod.name='vehicle-lod';
  lod.addLevel(detail,0);
  if(geo){
    const low=new THREE.Mesh(geo,bakedMat);
    low.name='lod-low';
    low.castShadow=true;
    lod.addLevel(low,VEHICLE_LOD_DIST,.08);
  }
  g.add(lod);
  g.userData.lod=lod;
  g.userData.lodDetail=detail;
}

/** Always show the detailed model from now on (customised / player-modified vehicles). */
export function disableVehicleLod(g: THREE.Object3D): void{
  const lod=g.userData.lod as THREE.LOD|undefined;
  if(!lod||lod.levels.length<2)return;
  lod.levels[1].distance=Infinity;
}
