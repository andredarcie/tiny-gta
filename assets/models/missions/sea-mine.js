import * as THREE from 'three';

// Realistic moored naval contact mine (a Hertz-horn "sea mine"): a dark riveted
// cast-iron sphere studded with lead contact horns, an equator seam with rivets,
// a faint warning band and a mooring ring with a short chain trailing into the
// water. Used by the boat race (boat-race.js) as a path hazard the racers must
// steer around — clipping one launches the boat upward and kills its speed.
// No binary assets: pure Three.js primitives.
//
// Origin at y=0 = waterline: the body floats centred a little above it and the
// chain hangs below. The boat race positions the mine at y≈SEA_Y and bobs it.

const UP=new THREE.Vector3(0,1,0);

function build(opts={}){
  const R=opts.radius??0.9;
  const g=new THREE.Group();

  const iron=new THREE.MeshStandardMaterial({color:0x23272d,metalness:.82,roughness:.5});
  const rust=new THREE.MeshStandardMaterial({color:0x3c2a1e,metalness:.4,roughness:.9}); // weathered lower hull
  const lead=new THREE.MeshStandardMaterial({color:0x9aa0a6,metalness:.35,roughness:.55});
  const warn=new THREE.MeshStandardMaterial({color:0xc41e1e,metalness:.2,roughness:.55,emissive:0x4a0707,emissiveIntensity:.6});
  const tipM=new THREE.MeshStandardMaterial({color:0xff5a2a,emissive:0xff3a12,emissiveIntensity:.85,roughness:.5,metalness:.1});
  const dark=new THREE.MeshStandardMaterial({color:0x12151a,metalness:.6,roughness:.6});

  const cy=R*0.55; // body centre a little above the waterline

  // main cast-iron sphere
  const body=new THREE.Mesh(new THREE.SphereGeometry(R,22,16),iron);
  body.position.y=cy;body.castShadow=true;g.add(body);
  // rusted/weathered lower cap (bottom hemisphere, just proud of the hull)
  const low=new THREE.Mesh(
    new THREE.SphereGeometry(R*1.004,20,10,0,Math.PI*2,Math.PI*0.6,Math.PI*0.42),rust);
  low.position.y=cy;g.add(low);
  // equator seam (joint between the two cast halves) + thin red warning band
  const seam=new THREE.Mesh(new THREE.TorusGeometry(R*0.99,R*0.055,8,28),dark);
  seam.position.y=cy;seam.rotation.x=Math.PI/2;g.add(seam);
  const band=new THREE.Mesh(new THREE.TorusGeometry(R*0.995,R*0.04,8,28),warn);
  band.position.y=cy+R*0.17;band.rotation.x=Math.PI/2;g.add(band);
  // rivets around the seam
  const rivetGeo=new THREE.SphereGeometry(R*0.05,6,5);
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    const rv=new THREE.Mesh(rivetGeo,dark);
    rv.position.set(Math.cos(a)*R*0.99,cy,Math.sin(a)*R*0.99);
    g.add(rv);
  }

  // Hertz contact horns: lead cylinders with a rounded chemical tip, on the upper
  // hemisphere pointing radially outward — one on top plus two rings.
  function horn(theta,phi){ // theta: angle from +Y, phi: azimuth
    const len=R*0.44,rad=R*0.085;
    const h=new THREE.Group();
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(rad*0.78,rad,len,8),lead);
    stem.position.y=len/2;h.add(stem);                 // base at horn origin, grows along +Y
    const tip=new THREE.Mesh(new THREE.SphereGeometry(rad*0.95,8,6),tipM);
    tip.position.y=len;h.add(tip);
    const dir=new THREE.Vector3(
      Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));
    h.position.copy(dir).multiplyScalar(R).add(new THREE.Vector3(0,cy,0));
    h.quaternion.setFromUnitVectors(UP,dir);           // aim outward along the surface normal
    g.add(h);
  }
  horn(0,0);                                            // crown horn
  for(let i=0;i<6;i++)horn(0.72,i/6*Math.PI*2+0.3);     // upper ring (~41°)
  for(let i=0;i<3;i++)horn(1.18,i/3*Math.PI*2);         // lower ring (~68°)

  // mooring ring under the hull + a few chain links trailing down into the water
  const ring=new THREE.Mesh(new THREE.TorusGeometry(R*0.18,R*0.045,6,12),dark);
  ring.position.y=cy-R*0.98;ring.rotation.x=Math.PI/2;g.add(ring);
  let ly=cy-R*1.16;
  for(let i=0;i<4;i++){
    const link=new THREE.Mesh(new THREE.TorusGeometry(R*0.12,R*0.035,6,10),dark);
    link.position.y=ly;link.rotation.x=Math.PI/2;link.rotation.z=(i%2)?Math.PI/2:0;
    g.add(link);ly-=R*0.2;
  }
  return g;
}

// boat-race.js uses makeSeaMine(opts) for the path-hazard mines.
export function makeSeaMine(opts){return build(opts);}

// Standard model descriptor (auto-discovered by the model viewer).
export default {category:'Missions',label:'Sea mine',build};
