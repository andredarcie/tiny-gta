import * as THREE from 'three';
import {matte} from '../matte.js';

// Barraca de acampamento estilo "A": duas águas de lona verde, fundo fechado,
// abas da entrada abertas, vara de cumeeira, estacas e lençol de chão.

const canvasM=matte({color:0x2f6d3a,roughness:1,side:THREE.DoubleSide});
const darkM=matte({color:0x24512c,roughness:1,side:THREE.DoubleSide});
const poleM=matte({color:0x6b4a2e,roughness:1});
const floorM=matte({color:0x2a2a30,roughness:1});

function build(): THREE.Group {
  const g=new THREE.Group();
  const W=2.2,L=2.8,H=1.5;
  const slope=Math.hypot(W/2,H),ang=Math.atan2(W/2,H);
  // duas águas de lona inclinadas formando o "A"
  for(const s of[-1,1]){
    const side=new THREE.Mesh(new THREE.BoxGeometry(.05,slope,L),canvasM);
    side.position.set(s*W/4,H/2,0);side.rotation.z=s*ang;
    side.castShadow=true;g.add(side);
  }
  // frontão de trás fechado
  const tri=new THREE.Shape();
  tri.moveTo(-W/2,0);tri.lineTo(W/2,0);tri.lineTo(0,H);tri.closePath();
  const back=new THREE.Mesh(new THREE.ShapeGeometry(tri),darkM);
  back.position.set(0,0,-L/2);back.rotation.y=Math.PI;g.add(back);
  // abas da entrada (frente) escancaradas
  for(const s of[-1,1]){
    const flap=new THREE.Mesh(new THREE.PlaneGeometry(W*.52,H*.96),canvasM);
    flap.position.set(s*.38,H*.46,L/2+.03);flap.rotation.y=s*.55;g.add(flap);
  }
  // vara de cumeeira saliente nas pontas
  const ridge=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,L+.5,8),poleM);
  ridge.rotation.x=Math.PI/2;ridge.position.y=H;g.add(ridge);
  // estacas nos quatro cantos
  for(const sx of[-1,1])for(const sz of[-1,1]){
    const peg=new THREE.Mesh(new THREE.CylinderGeometry(.03,.02,.3,5),poleM);
    peg.position.set(sx*(W/2+.18),.1,sz*(L/2+.05));peg.rotation.x=sx*sz*.4;g.add(peg);
  }
  // lençol de chão
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W-.1,L-.1),floorM);
  floor.rotation.x=-Math.PI/2;floor.position.y=.02;g.add(floor);
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Rural',label:'Tent',build};
