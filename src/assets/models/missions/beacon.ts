import * as THREE from 'three';

// ===========================================================================
// Standard objective BEACON — the glowing translucent cylinder that rises out
// of an objective spot (delivery, race checkpoint, taxi fare, target, ...).
//
// Dimensions are FIXED for the WHOLE GAME so every objective reads the same:
// callers only ever choose the COLOUR. The height is exactly TWICE the
// character's height, and the geometry is anchored at its BASE (origin at the
// bottom of the cylinder), so a caller just sets position to the ground point —
// no "+height/2" math, no floating columns.
// ===========================================================================

const CHARACTER_HEIGHT=1.8;                     // ped crown ≈ 1.8 (see characters/pedestrian.ts)
export const BEACON_HEIGHT=CHARACTER_HEIGHT*2;  // standard beacon height = 2× the character
export const BEACON_RADIUS=0.8;                 // standard radius (same for every beacon)

export function makeBeacon(color: number): THREE.Mesh{
  const geo=new THREE.CylinderGeometry(BEACON_RADIUS,BEACON_RADIUS,BEACON_HEIGHT,16,1,true);
  geo.translate(0,BEACON_HEIGHT/2,0);           // anchor at the base: origin sits on the ground
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.16,
    side:THREE.DoubleSide,depthWrite:false});
  return new THREE.Mesh(geo,mat);
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'Missions',label:'Beacon',build:(o:{color?:number})=>makeBeacon(o.color??0x19e3ff)};
