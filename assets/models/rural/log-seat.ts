import * as THREE from 'three';
import {matte} from '../matte.js';

// Tora caída pra sentar em volta da fogueira: cilindro deitado com casca escura
// e as faces de corte em madeira clara.

const barkM=matte({color:0x5a3b22,roughness:1});
const ringM=matte({color:0xb9966a,roughness:1});

function build(): THREE.Group {
  const g=new THREE.Group();
  const len=1.5,r=.22;
  const log=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,12),barkM);
  log.rotation.z=Math.PI/2;log.position.y=r;log.castShadow=true;g.add(log);
  for(const s of[-1,1]){
    const end=new THREE.Mesh(new THREE.CircleGeometry(r,12),ringM);
    end.position.set(s*len/2,r,0);end.rotation.y=s*Math.PI/2;g.add(end);
  }
  return g;
}

// Padrão de modelo: descriptor pro model-viewer (descoberta automática).
export default {category:'Rural',label:'Log seat',build};
