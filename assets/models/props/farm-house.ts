import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,pick} from '@/core/constants.js';

const ruralWallCols=[0xf4e3c2,0xe8d8c8,0xd9e4d0,0xf0d9b0,0xe4c9b0];
const roofCols=[0xb05438,0x8a4a3a,0xa05a40];

// Materiais cacheados por cor para a fusao de props
const doorM=matte({color:0x6e4a32,roughness:.9});
const winM=matte({color:0x9ecbe0,roughness:.4});
const wallMats=new Map<number,THREE.MeshLambertMaterial>(),roofMats=new Map<number,THREE.MeshLambertMaterial>();
const matFor=(map: Map<number,THREE.MeshLambertMaterial>,c: number,rough: number): THREE.MeshLambertMaterial=>{if(!map.has(c))map.set(c,
  matte({color:c,roughness:rough}));
  return map.get(c)!;};

// build() puro: a casa na origem; guarda raio/altura em userData para a colisao.
function build(): THREE.Group{
  const g=new THREE.Group();
  const bw=rand(4.4,5.8),bd=rand(3.6,4.6),bh=rand(2.4,2.9);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),
    matFor(wallMats,pick(ruralWallCols),.95));
  wall.position.y=bh/2;wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(bw,bd)/2+.3,1.6,4),
    matFor(roofMats,pick(roofCols),.9));
  roof.position.y=bh+.8;roof.rotation.y=Math.PI/4;roof.castShadow=true;g.add(roof);
  const door=new THREE.Mesh(new THREE.BoxGeometry(.85,1.5,.1),doorM);
  door.position.set(rand(-bw/4,bw/4),.75,bd/2+.04);g.add(door);
  for(const sx of[-1,1]){
    const win=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.08),winM);
    win.position.set(sx*bw/3,1.5,bd/2+.04);g.add(win);
  }
  g.userData.r=Math.max(bw,bd)/2+.3;g.userData.h=bh+1.7;
  return g;
}

export default {category:'Props',label:'Farm house',build};

export function addFarmHouse(cx: number,cz: number,ry: number): {x0:number;x1:number;z0:number;z1:number;h:number}{
  const g=build();
  g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  const r=g.userData.r;
  return{x0:cx-r,x1:cx+r,z0:cz-r,z1:cz+r,h:g.userData.h};
}
