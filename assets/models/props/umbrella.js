import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,pick} from '../../../js/constants.js';

const umbCols=[0xff2e88,0x19e3ff,0xffd24a,0x9dff2e,0xff8c2e];

// Materiais cacheados por cor (5 no maximo de cada): permite fundir todos os
// guarda-sois/toalhas num mesh por material em vez de um material por instancia
const poleMat=matte({color:0xefe6d0,roughness:.8});
const topMats=new Map(),towelMats=new Map();
const topFor=c=>{if(!topMats.has(c))topMats.set(c,
  matte({color:c,roughness:.85,side:THREE.DoubleSide}));
  return topMats.get(c);};
const towelFor=c=>{if(!towelMats.has(c))towelMats.set(c,
  matte({color:c,roughness:1}));
  return towelMats.get(c);};

// build() puro: o guarda-sol na origem. addUmbrella posiciona/funde e as vezes
// joga uma toalha ao lado.
function build(){
  const g=new THREE.Group();
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.05,.06,2.3,5),poleMat);
  pole.position.y=1.15;g.add(pole);
  const top=new THREE.Mesh(new THREE.ConeGeometry(1.5,.6,8),topFor(pick(umbCols)));
  top.position.y=2.3;top.castShadow=false;g.add(top);
  g.rotation.z=rand(-.07,.07);
  return g;
}

export default {category:'Props',label:'Beach umbrella',build};

export function addUmbrella(x0,z0){
  const g=build();
  g.position.set(x0,-.06,z0);bakeProp(g);
  if(Math.random()<.8){
    const t=new THREE.Mesh(new THREE.BoxGeometry(.95,.04,1.9),towelFor(pick(umbCols)));
    t.position.set(x0+rand(-2.4,2.4),-.03,z0+rand(-2.4,2.4));
    t.rotation.y=rand(0,Math.PI);bakeProp(t);
  }
  return g;
}
