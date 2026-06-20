import * as THREE from 'three';
import {matte} from '../matte.ts';

// "Doente da floresta": criaturinha pequena e verde, doentia, alvo da missão
// secreta do Rick (js/story/rick.ts). Corcunda, olhos grandes amarelos, boca babando e
// manchas escuras de podridão. Fica escondida pela zona rural; sem indicador no
// mapa — o jogador precisa caçar de verdade.

const skinM=matte({color:0x6fae3a,roughness:1});
const darkM=matte({color:0x4f7d27,roughness:1});
const mouthM=matte({color:0x3a2616,roughness:1});
const eyeW=new THREE.MeshBasicMaterial({color:0xeef05a});
const eyeB=new THREE.MeshBasicMaterial({color:0x10100a});

function build(): THREE.Group{
  const g=new THREE.Group();
  // corpo corcunda
  const body=new THREE.Mesh(new THREE.SphereGeometry(.26,10,8),skinM);
  body.scale.set(1,.92,1);body.position.y=.28;body.castShadow=true;g.add(body);
  // cabeça
  const head=new THREE.Mesh(new THREE.SphereGeometry(.2,10,8),skinM);
  head.position.set(0,.55,.04);head.castShadow=true;g.add(head);
  // orelhas pontudas
  for(const s of[-1,1]){
    const ear=new THREE.Mesh(new THREE.ConeGeometry(.07,.22,6),skinM);
    ear.position.set(s*.18,.62,0);ear.rotation.z=s*-.9;g.add(ear);
  }
  // olhos grandes e doentes
  for(const s of[-1,1]){
    const w=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),eyeW);
    w.position.set(s*.08,.57,.16);g.add(w);
    const b=new THREE.Mesh(new THREE.SphereGeometry(.028,6,5),eyeB);
    b.position.set(s*.08,.57,.21);g.add(b);
  }
  // boca aberta babando
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6,0,Math.PI*2,0,Math.PI/2),mouthM);
  mouth.rotation.x=Math.PI;mouth.position.set(0,.46,.18);g.add(mouth);
  // manchas de podridão
  for(let i=0;i<5;i++){
    const a=Math.random()*Math.PI*2;
    const sp=new THREE.Mesh(new THREE.SphereGeometry(.05,6,5),darkM);
    sp.position.set(Math.cos(a)*.22,.24+Math.random()*.2,Math.sin(a)*.14+.08);g.add(sp);
  }
  // bracinhos atrofiados
  for(const s of[-1,1]){
    const arm=new THREE.Mesh(new THREE.CylinderGeometry(.04,.034,.22,6),skinM);
    arm.position.set(s*.24,.3,.06);arm.rotation.z=s*.5;g.add(arm);
  }
  // pés
  for(const s of[-1,1]){
    const foot=new THREE.Mesh(new THREE.SphereGeometry(.07,7,6),skinM);
    foot.scale.set(1,.6,1.3);foot.position.set(s*.1,.05,.06);g.add(foot);
  }
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Missions',label:'Forest sicko',build};
