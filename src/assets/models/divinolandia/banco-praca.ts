import * as THREE from 'three';
import {matte} from '../matte.ts';

// Banco de praça — the benches of Divinolândia's town squares (Praça Dr. Alcindo, the
// Matriz garden), from Street View: two cast-concrete ends painted white, rounded on top
// into an armrest, carrying three red wooden seat slats and two backrest slats. ~2 m long.
// build() is pure: seat front toward +z, origin on the ground at the middle.
const endM=matte({color:0xeeebe3}),slatM=matte({color:0xb8412f}),footM=matte({color:0xc9c4b9});
const endG=((): THREE.BufferGeometry=>{
  // side profile of one end (in the z-y plane): foot, seat support, backrest post, armrest curl
  const s=new THREE.Shape();
  s.moveTo(-.34,0);s.lineTo(.3,0);s.lineTo(.3,.1);s.lineTo(.22,.12);s.lineTo(.22,.6);
  s.quadraticCurveTo(.24,.72,.12,.72);s.lineTo(-.18,.66);s.lineTo(-.24,.98);s.quadraticCurveTo(-.3,1.04,-.36,.98);
  s.lineTo(-.4,.6);s.lineTo(-.3,.12);s.lineTo(-.34,.1);s.closePath();
  const g=new THREE.ExtrudeGeometry(s,{depth:.16,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,curveSegments:5});
  g.rotateY(Math.PI/2);g.translate(-.08,0,0);
  return g;
})();
function build():THREE.Group{
  const g=new THREE.Group();
  for(const x of[-.92,.92]){
    const e=new THREE.Mesh(endG,endM);e.position.x=x;e.castShadow=true;g.add(e);
    const f=new THREE.Mesh(new THREE.BoxGeometry(.3,.06,.7),footM);f.position.set(x,.03,-.02);g.add(f);
  }
  for(const z of[-.16,0,.16]){const s=new THREE.Mesh(new THREE.BoxGeometry(2.1,.05,.13),slatM);s.position.set(0,.47,z);s.castShadow=true;g.add(s);}
  for(const y of[.66,.84]){const s=new THREE.Mesh(new THREE.BoxGeometry(2.1,.11,.04),slatM);s.position.set(0,y,-.27-(y-.66)*.2);s.rotation.x=-.18;s.castShadow=true;g.add(s);}
  return g;
}
export default {category:'Divinolândia',label:'Banco de praça',build};
