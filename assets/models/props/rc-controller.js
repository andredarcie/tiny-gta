import * as THREE from 'three';

// Tiny two-stick remote controller held by the RC Toyz operator while piloting the
// bandit. Built from primitives (no external assets), with an orange accent to
// match the RC bandit. build() is PURE (returns a fresh Object3D, no scene.add).

const caseM=new THREE.MeshStandardMaterial({color:0x23262d,roughness:.7,metalness:.2});
const panelM=new THREE.MeshStandardMaterial({color:0x14161b,roughness:.85});
const stickM=new THREE.MeshStandardMaterial({color:0x3a3f48,roughness:.5,metalness:.4});
const knobM=new THREE.MeshStandardMaterial({color:0xff7a18,roughness:.4,metalness:.3}); // matches the bandit
const antM=new THREE.MeshStandardMaterial({color:0x111114,roughness:.6});
const tipM=new THREE.MeshBasicMaterial({color:0xff3b56});
const ledM=new THREE.MeshBasicMaterial({color:0x5eff8a}); // little green power LED

function buildRcController(){
  const g=new THREE.Group();

  // case body + slightly inset top panel
  const body=new THREE.Mesh(new THREE.BoxGeometry(.26,.055,.17),caseM);
  body.castShadow=true;g.add(body);
  const panel=new THREE.Mesh(new THREE.BoxGeometry(.23,.02,.14),panelM);
  panel.position.y=.035;g.add(panel);

  // two thumb sticks (post + ball) on the panel
  for(const sx of[-1,1]){
    const post=new THREE.Mesh(new THREE.CylinderGeometry(.012,.016,.05,8),stickM);
    post.position.set(sx*.07,.06,.02);g.add(post);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),knobM);
    ball.position.set(sx*.07,.088,.02);g.add(ball);
  }

  // little power LED near the front edge
  const led=new THREE.Mesh(new THREE.BoxGeometry(.022,.008,.022),ledM);
  led.position.set(0,.046,-.05);g.add(led);

  // telescopic antenna rising up and back from the top-left corner
  const ant=new THREE.Mesh(new THREE.CylinderGeometry(.006,.008,.34,6),antM);
  ant.position.set(-.10,.18,-.06);ant.rotation.x=-.22;g.add(ant);
  const tip=new THREE.Mesh(new THREE.SphereGeometry(.018,8,6),tipM);
  tip.position.set(-.10,.355,-.10);g.add(tip);

  return g;
}

// Model pattern: descriptor for the model viewer (auto-discovery).
export default {category:'Props',label:'RC controller',build:buildRcController};

// Compat: direct factory (pure, like makeRcPad — caller adds it to the scene/parent).
export function makeRcController(){return buildRcController();}
