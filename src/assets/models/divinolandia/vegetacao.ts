import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';

// Divinolândia vegetation, instanced (thousands of plants for a handful of draw calls):
//  - mata: the broadleaf trees of the riparian forest and the wood patches in the folds of
//    the serra, plus a few tall eucalyptus (planted everywhere in the region);
//  - café: coffee rows — the defining landscape of the town's slopes (coffee and potato are
//    the economy). Each instance is one ~9 m hedge of a row; rows follow the contour lines.
// Instances are grouped in square chunks so whole chunks are culled by distance.
const trunkM=matte({color:DIVINO.trunk});
const leafMs=DIVINO.tree.map(c=>matte({color:c,flatShading:true}));
const eucaM=matte({color:0x6f8a5a,flatShading:true}),eucaTrunkM=matte({color:0xcfc6b4});
const coffeeM=matte({color:DIVINO.coffee,flatShading:true});
const trunkG=new THREE.CylinderGeometry(.16,.26,3,5);trunkG.translate(0,1.5,0);
const crownG=new THREE.IcosahedronGeometry(2.6,0);crownG.scale(1,.78,1);crownG.translate(0,4.6,0);
const eucaTrunkG=new THREE.CylinderGeometry(.12,.2,9,5);eucaTrunkG.translate(0,4.5,0);
const eucaCrownG=new THREE.IcosahedronGeometry(1.7,0);eucaCrownG.scale(.8,1.9,.8);eucaCrownG.translate(0,10.5,0);
const coffeeG=new THREE.IcosahedronGeometry(1,1);coffeeG.scale(4.6,.95,.8);coffeeG.translate(0,.85,0);

type Inst={x:number;y:number;z:number;s:number;r:number};
const CH=400;
function chunked(list:Inst[]):Map<string,Inst[]>{
  const m=new Map<string,Inst[]>();
  for(const t of list){const k=Math.round(t.x/CH)+'_'+Math.round(t.z/CH);let a=m.get(k);if(!a){a=[];m.set(k,a);}a.push(t);}
  return m;
}
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0);
function inst(geo:THREE.BufferGeometry,mat:THREE.Material,list:Inst[],shadow:boolean):THREE.InstancedMesh{
  const im=new THREE.InstancedMesh(geo,mat,list.length);
  list.forEach((t,i)=>{_q.setFromAxisAngle(_up,t.r);_s.set(t.s,t.s,t.s);_p.set(t.x,t.y,t.z);im.setMatrixAt(i,_m.compose(_p,_q,_s));});
  im.instanceMatrix.needsUpdate=true;im.computeBoundingSphere();
  im.castShadow=shadow;im.receiveShadow=false;im.matrixAutoUpdate=false;
  return im;
}
// trees: {x,y(ground),z,s(scale),r(yaw)}; `kind` picks broadleaf vs eucalyptus by index.
export function makeTrees(list:Inst[]):THREE.Group[]{
  const out:THREE.Group[]=[];
  for(const[k,arr]of chunked(list)){
    const g=new THREE.Group(),euca=arr.filter((_,i)=>i%11===0),broad=arr.filter((_,i)=>i%11!==0);
    if(broad.length){
      g.add(inst(trunkG,trunkM,broad,false));
      // split the crowns over the leaf tones so a wood never reads as one flat green
      leafMs.forEach((m,mi)=>{const part=broad.filter((_,i)=>i%leafMs.length===mi);if(part.length)g.add(inst(crownG,m,part,true));});
    }
    if(euca.length){g.add(inst(eucaTrunkG,eucaTrunkM,euca,false));g.add(inst(eucaCrownG,eucaM,euca,true));}
    const[i,j]=k.split('_').map(Number);g.userData.cx=i*CH;g.userData.cz=j*CH;g.matrixAutoUpdate=false;
    out.push(g);
  }
  return out;
}
// coffee rows: {x,y,z,r(row yaw),s} → 3 parallel hedges 3.4 m apart per instance
export function makeCoffee(list:Inst[]):THREE.Group[]{
  const rows:Inst[]=[];
  for(const t of list)for(const o of[-3.4,0,3.4]){
    const c=Math.cos(t.r),s=Math.sin(t.r);
    // hedge long axis = local x; rotate so it runs along the row direction (c,s)
    rows.push({x:t.x-s*o,y:t.y,z:t.z+c*o,s:t.s,r:-t.r});
  }
  return makeTreesLike(rows,coffeeG,coffeeM);
}
function makeTreesLike(list:Inst[],geo:THREE.BufferGeometry,mat:THREE.Material):THREE.Group[]{
  const out:THREE.Group[]=[];
  for(const[k,arr]of chunked(list)){
    const g=new THREE.Group();g.add(inst(geo,mat,arr,false));
    const[i,j]=k.split('_').map(Number);g.userData.cx=i*CH;g.userData.cz=j*CH;g.matrixAutoUpdate=false;
    out.push(g);
  }
  return out;
}

// Model-viewer sample: a riverside wood beside three coffee rows.
function build():THREE.Group{
  const g=new THREE.Group();
  const trees:Inst[]=[];for(let k=0;k<14;k++)trees.push({x:-14+(k%5)*5,y:0,z:-8+Math.floor(k/5)*6,s:.8+(k%3)*.2,r:k});
  for(const c of makeTrees(trees))g.add(c);
  for(const c of makeCoffee([{x:14,y:0,z:0,s:1,r:Math.PI/2}]))g.add(c);
  g.traverse(o=>{o.matrixAutoUpdate=true;});
  return g;
}
export default {category:'Divinolândia',label:'Mata ciliar + cafezal',build};
