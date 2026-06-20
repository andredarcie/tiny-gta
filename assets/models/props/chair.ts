import * as THREE from 'three';
import {matte} from '../matte.ts';
import {bakeProp} from './prop-merge.ts';
import {rand,pick} from '@/core/constants.ts';

const umbCols=[0xff2e88,0x19e3ff,0xffd24a,0x9dff2e,0xff8c2e];

// Materiais cacheados por cor para a fusão de props (um material por instância
// impediria o merge)
const legM=matte({color:0xf2ead6,roughness:.8});
const seatMats=new Map<number,THREE.MeshLambertMaterial>();
const seatFor=(c: number): THREE.MeshLambertMaterial=>{if(!seatMats.has(c))seatMats.set(c,
  matte({color:c,roughness:.9}));
  return seatMats.get(c)!;};

// build() puro: a cadeira na origem (com giro aleatorio). addChair posiciona/funde.
function build(): THREE.Group{
  const m=seatFor(pick(umbCols));
  const g=new THREE.Group();
  const seat=new THREE.Mesh(new THREE.BoxGeometry(.72,.08,1.15),m);
  seat.position.y=.3;seat.castShadow=false;g.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(.72,.68,.08),m);
  back.position.set(0,.58,-.58);back.rotation.x=.4;back.castShadow=false;g.add(back);
  for(const[lx,lz]of[[-.3,.45],[.3,.45],[-.3,-.45],[.3,-.45]]){
    const leg=new THREE.Mesh(new THREE.BoxGeometry(.07,.3,.07),legM);
    leg.position.set(lx,.15,lz);g.add(leg);
  }
  g.rotation.y=rand(0,6.28);
  return g;
}

export default {category:'Props',label:'Beach chair',build};

export function addChair(x0: number,z0: number): THREE.Group{
  const g=build();
  g.position.set(x0,-.06,z0);bakeProp(g);
  return g;
}
