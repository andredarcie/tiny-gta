import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {matte} from '../matte.ts';
import {leafMat,leafMass} from './copa.ts';
import {chunked,inst,CH,type Inst} from './vegetacao.ts';

// Mata ciliar — what grows along the Rio do Peixe, after the panoramas from its bridges
// (rio-ponte*-*, local): reeds at the water's edge, tall grass clumps on the muddy banks,
// thick clumps of bamboo arching over the water (the river's signature in town), and stones
// half in the water. The riverside trees themselves are the town's broadleaf trees
// (vegetacao.ts makeTrees). Instanced like the rest of the vegetation, in the same 400 m
// chunks so whole chunks are culled by distance; one draw per kind per chunk.
// makeRiverBank(list) takes {x,y(ground),z,s(scale),r(yaw),k(kind)}.
export type BankKind='junco'|'capim'|'bambu'|'pedra';
export type BankInst=Inst&{k:BankKind};

const reedM=matte({color:0xffffff}),grassM=matte({color:0xffffff}),culmM=matte({color:0x8f9a52}),stoneM=matte({color:0xffffff});
const bambooLeafM=leafMat(0x4f6e2e);
const reedColors=[0x7c8c40,0x8a9448,0x6b7c3a].map(c=>new THREE.Color(c));
const grassColors=[0x8b8a4c,0x9c9654,0x7b7d44,0xa39a5e].map(c=>new THREE.Color(c));
const stoneColors=[0x6f675c,0x7d7468,0x5c564e].map(c=>new THREE.Color(c));

function rng(seed:number):()=>number{let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// a fan of thin blades (tapered prisms) from one root, leaning out
function blades(n:number,h0:number,h1:number,lean:number,r0:number,seed:number):THREE.BufferGeometry{
  const r=rng(seed),parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<n;i++){
    const h=h0+(h1-h0)*r(),b=new THREE.CylinderGeometry(.004,r0,h,3,1);
    b.translate(0,h/2,0);b.rotateZ((r()-.5)*lean*2);b.rotateY(r()*Math.PI*2);
    b.translate((r()-.5)*.35,0,(r()-.5)*.35);parts.push(b);
  }
  const g=mergeGeometries(parts,false);for(const p of parts)p.dispose();return g;
}
const reedG=blades(16,1.4,2.5,.26,.07,11);
const grassG=blades(18,.7,1.3,.6,.08,23);
// a bamboo clump: culms rising and arching outward, leaf masses along their upper half
const bambooCulmG=(():THREE.BufferGeometry=>{
  const r=rng(37),parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<18;i++){
    const h=7.5+r()*4,a=r()*Math.PI*2,tilt=.14+r()*.3;
    const c=new THREE.CylinderGeometry(.035,.06,h,5,1);c.translate(0,h/2,0);c.rotateZ(tilt);c.rotateY(a);
    c.translate((r()-.5)*.8,0,(r()-.5)*.8);parts.push(c);
  }
  const g=mergeGeometries(parts,false);for(const p of parts)p.dispose();return g;
})();
const bambooLeafG=(():THREE.BufferGeometry=>{
  const r=rng(41),parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<30;i++){
    // small feathery sprays along the arching tops of the culms, the outer ones lower (it droops)
    const a=r()*Math.PI*2,d=.4+r()*3,y=10-d*1.35+r()*2.4;
    const l=leafMass(1+(i%3),.3,1).clone();l.scale(.55+r()*.45,.32+r()*.22,.9+r()*.6);l.rotateY(a);l.translate(Math.cos(a)*d,y,Math.sin(a)*d);parts.push(l);
  }
  const g=mergeGeometries(parts,false);for(const p of parts)p.dispose();return g;
})();
const stoneG=(():THREE.BufferGeometry=>{const g=new THREE.IcosahedronGeometry(.5,0);g.scale(1.25,.55,.9);g.translate(0,.12,0);return g;})();

export function makeRiverBank(list:BankInst[]):THREE.Group[]{
  const out:THREE.Group[]=[];
  for(const[k,arr]of chunked(list)){
    const g=new THREE.Group(),of=(kind:BankKind):BankInst[]=>(arr as BankInst[]).filter(t=>t.k===kind);
    const reeds=of('junco'),grass=of('capim'),bamboo=of('bambu'),stones=of('pedra');
    if(reeds.length)g.add(inst(reedG,reedM,reeds,false,reedColors));
    if(grass.length)g.add(inst(grassG,grassM,grass,false,grassColors));
    if(bamboo.length){g.add(inst(bambooCulmG,culmM,bamboo,true));g.add(inst(bambooLeafG,bambooLeafM,bamboo,true));}
    if(stones.length)g.add(inst(stoneG,stoneM,stones,false,stoneColors));
    const[i,j]=k.split('_').map(Number);g.userData.cx=i*CH;g.userData.cz=j*CH;g.matrixAutoUpdate=false;
    out.push(g);
  }
  return out;
}

// Model-viewer sample: a stretch of bank — reeds at the water, grass, a bamboo clump, stones.
function build():THREE.Group{
  const g=new THREE.Group(),list:BankInst[]=[];
  for(let k=0;k<10;k++)list.push({x:-10+k*2.2,y:0,z:-3+(k%2)*.6,s:.9+(k%3)*.15,r:k,k:'junco'});
  for(let k=0;k<8;k++)list.push({x:-9+k*2.6,y:0,z:1.5+(k%3)*.8,s:1,r:k*1.7,k:'capim'});
  list.push({x:4,y:0,z:5,s:1,r:0,k:'bambu'},{x:-6,y:0,z:-4.2,s:1.4,r:1,k:'pedra'},{x:-2,y:0,z:-4.5,s:.8,r:2,k:'pedra'});
  for(const c of makeRiverBank(list))g.add(c);
  g.traverse(o=>{o.matrixAutoUpdate=true;});
  return g;
}
export default {category:'Divinolândia',label:'Mata ciliar (margem do rio)',build};
