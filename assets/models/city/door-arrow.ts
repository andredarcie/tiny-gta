import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '../../../js/engine.js';

// Setinha de porta estilo mundo aberto: cone neon apontando pra baixo, quicando
// rente ao chão nas portas em que dá pra entrar. Só as portas PERTO do
// jogador mostram seta: um pool pequeno de meshes reaproveitados é
// reposicionado a cada frame sobre as portas dentro do raio, em vez de uma
// seta sempre visível por porta (e sem custo de draw call pela cidade toda).

const arrowMat=new THREE.MeshBasicMaterial({color:0xff2e88,transparent:true,opacity:.92});

// Geometria de uma seta (cone com ponta pra baixo + haste), compartilhada
let sharedGeo:THREE.BufferGeometry|null=null;
function arrowGeo():THREE.BufferGeometry{
  if(sharedGeo)return sharedGeo;
  const cone=new THREE.ConeGeometry(.34,.7,6);
  cone.rotateX(Math.PI); // ponta pra baixo
  const shaft=new THREE.CylinderGeometry(.11,.11,.42,6);
  shaft.translate(0,.55,0);
  return sharedGeo=mergeGeometries([cone,shaft]);
}

export function makeDoorArrow():THREE.Mesh{return new THREE.Mesh(arrowGeo(),arrowMat);}

const spots:{x:number,y:number,z:number}[]=[];
export function addDoorArrow(x:number,y:number,z:number):void{spots.push({x,y,z});}

const POOL=8,RANGE=20;
const pool:THREE.Mesh[]=[];
export function finalizeDoorArrows():void{
  for(let i=0;i<POOL;i++){
    const m=makeDoorArrow();m.visible=false;scene.add(m);pool.push(m);
  }
}

export const arrowBob=(t:number):number=>Math.sin(t*3.4)*.16;
export function updateDoorArrows(t:number,px:number,pz:number):void{
  const bob=arrowBob(t);
  let n=0;
  for(const s of spots){
    if(n>=POOL)break;
    if(Math.hypot(px-s.x,pz-s.z)>RANGE)continue;
    const m=pool[n++];
    m.visible=true;
    m.position.set(s.x,s.y+bob,s.z);
  }
  for(let i=n;i<POOL;i++)pool[i].visible=false;
}

// Padrão de modelo: descriptor para o model-viewer (descoberta automática).
export default {category:'City',label:'Door arrow',build:()=>makeDoorArrow()};
