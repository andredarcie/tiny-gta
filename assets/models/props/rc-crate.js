import * as THREE from 'three';

// Floating POWER-UP crate for RC SMASH: a small glowing cube wrapped in a bright
// frame, with a halo ring and a core glow so it reads as "collectible" from afar.
// The colour is passed in by the caller (one hue per power-up: nitro/time/mega).
// build() is PURE (returns a fresh Object3D, no scene.add). The hover/spin is
// animated by the gameplay code, not here — this file is geometry only.

function buildRcCrate(color=0x19e3ff){
  const g=new THREE.Group();

  // translucent glowing shell (the "energy box")
  const shellM=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.32,
    depthWrite:false});
  const shell=new THREE.Mesh(new THREE.BoxGeometry(.78,.78,.78),shellM);
  g.add(shell);

  // bright solid frame: 12 thin edges of the cube, drawn as a single wireframe
  const frameM=new THREE.MeshBasicMaterial({color});
  const edges=new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(.8,.8,.8)),
    new THREE.LineBasicMaterial({color}));
  g.add(edges);

  // a smaller solid core cube so the centre glows even at a distance
  const core=new THREE.Mesh(new THREE.BoxGeometry(.34,.34,.34),frameM);
  g.add(core);

  // halo ring orbiting the crate (animated to spin by the caller via userData.halo)
  const halo=new THREE.Mesh(new THREE.TorusGeometry(.62,.05,6,20),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85}));
  halo.rotation.x=Math.PI/2;
  g.add(halo);
  g.userData.halo=halo;

  // ground glow disc under the crate so it pops against the asphalt
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.9,20),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:.18,
      side:THREE.DoubleSide,depthWrite:false}));
  glow.rotation.x=-Math.PI/2;
  glow.position.y=-.7;
  g.add(glow);

  return g;
}

// Model pattern: descriptor for the model-viewer (auto-discovery).
export default {category:'Props',label:'RC crate',build:o=>buildRcCrate(o.color??0x19e3ff)};

// Direct factory (matches the other props).
export function makeRcCrate(color){return buildRcCrate(color);}
