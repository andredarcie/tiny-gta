import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';

// Banco de praça simples (ripas de madeira + pés de ferro). build() puro (banco na
// origem, assento virado para +z); addParkBench posiciona, gira, faz bake e devolve
// a colisão. Usado para mobiliar a Praça da Matriz (js/world.js).
const woodM=matte({color:0x8a5a32,roughness:.9});
const legM=matte({color:0x44444c,roughness:.7});

function build(){
  const g=new THREE.Group();
  const seat=new THREE.Mesh(new THREE.BoxGeometry(1.6,.1,.5),woodM);
  seat.position.y=.5;seat.castShadow=true;g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(1.6,.5,.1),woodM);
  back.position.set(0,.78,-.22);back.castShadow=true;g.add(back);
  for(const sx of[-1,1]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.5,.46),legM);
    leg.position.set(sx*.66,.25,0);g.add(leg);
  }
  g.userData.r=.9;g.userData.h=1.05;
  return g;
}

export default {category:'Props',label:'Park bench',build};

export function addParkBench(x,z,ry=0){
  const g=build();g.position.set(x,0,z);g.rotation.y=ry;bakeProp(g);
  // AABB ciente da rotação (bancos da praça ficam virados ao longo de x, ry=±PI/2)
  const along=Math.abs(Math.sin(ry))>.5, ex=along?.35:.85, ez=along?.85:.35;
  return{x0:x-ex,x1:x+ex,z0:z-ez,z1:z+ez,h:1.05};
}
