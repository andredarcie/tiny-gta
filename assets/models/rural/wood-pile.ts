import * as THREE from 'three';
import {matte} from '../matte.js';

// Pilha de lenha cortada do acampamento: toras empilhadas em pirâmide, casca
// escura e faces de corte claras voltadas pra fora.

const barkM=matte({color:0x5a3b22,roughness:1});
const ringM=matte({color:0xb9966a,roughness:1});

function build(): THREE.Group {
  const g=new THREE.Group();
  const r=.12,len=1.3;
  // (z, y) de cada tora — três fileiras formando pirâmide
  for(const[z,y]of[
    [-.26,0],[0,0],[.26,0],[-.13,.21],[.13,.21],[0,.42]
  ]){
    const log=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,9),barkM);
    log.rotation.z=Math.PI/2;log.position.set(0,y+r,z);log.castShadow=true;g.add(log);
    for(const s of[-1,1]){
      const end=new THREE.Mesh(new THREE.CircleGeometry(r,9),ringM);
      end.position.set(s*len/2,y+r,z);end.rotation.y=s*Math.PI/2;g.add(end);
    }
  }
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Rural',label:'Wood pile',build};
