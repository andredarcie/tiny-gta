import * as THREE from 'three';

// Clothing-store accessories: small procedural hats + glasses sized to the player's tiny
// head and positioned in player-LOCAL space (the head is static relative to the body, so
// a fixed offset rides along with the player correctly, including aim turns). Variant 0 is
// always "none". Builders are pure; js/actors/player.ts attaches/removes them on the
// player group via applyPlayerClothing(). NPCs never use these.

const HAT_Y=1.78, EYE_Y=1.675, EYE_Z=.118;

function m(color:number,rough=.7,metal=0):THREE.MeshStandardMaterial{
  return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal});
}

export function makeHat(variant:number):THREE.Object3D|null{
  if(!variant)return null;
  const g=new THREE.Group();
  const col=variant===2?0xc23b4e:0x1b1d24;            // 2 = red beanie, 1 = dark cap
  const crown=new THREE.Mesh(new THREE.SphereGeometry(.16,16,10,0,Math.PI*2,0,Math.PI*0.62),m(col));
  crown.scale.set(1,variant===2?1.05:.8,1);
  crown.position.set(0,HAT_Y,-.005);
  g.add(crown);
  if(variant===1){                                    // cap: flat brim in front
    const brim=new THREE.Mesh(new THREE.BoxGeometry(.26,.028,.18),m(0x14161c));
    brim.position.set(0,HAT_Y-.02,.16);
    g.add(brim);
  }else{                                              // beanie: folded band
    const band=new THREE.Mesh(new THREE.CylinderGeometry(.156,.156,.06,16),m(0x9a2c3b));
    band.position.set(0,HAT_Y-.05,-.005);
    g.add(band);
  }
  g.traverse(o=>{(o as THREE.Mesh).castShadow=false;});
  return g;
}

export function makeGlasses(variant:number):THREE.Object3D|null{
  if(!variant)return null;
  const g=new THREE.Group();
  const lensM=m(variant===2?0x123a6b:0x0a0a0e,.25,.3); // 2 = blue tint, 1 = black shades
  for(const sx of[-1,1]){
    const lens=new THREE.Mesh(new THREE.BoxGeometry(.07,.05,.02),lensM);
    lens.position.set(sx*.06,EYE_Y,EYE_Z);
    g.add(lens);
    const temple=new THREE.Mesh(new THREE.BoxGeometry(.012,.012,.17),lensM);
    temple.position.set(sx*.096,EYE_Y,EYE_Z-.085);
    g.add(temple);
  }
  const bridge=new THREE.Mesh(new THREE.BoxGeometry(.05,.012,.02),lensM);
  bridge.position.set(0,EYE_Y+.013,EYE_Z);
  g.add(bridge);
  g.traverse(o=>{(o as THREE.Mesh).castShadow=false;});
  return g;
}
