import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';
import {rand,irand} from '@/core/constants.ts';

// Lote abandonado no lugar de prédio que não nasceu: entulho, pneus, mato e
// caçamba de entulho. Mesmo truque do building.js:
// geometria vai para baldes por material e finalizeAbandonedLots() funde a
// cidade inteira em ~5 meshes (draw calls).

const concreteM=new THREE.MeshLambertMaterial({color:0x9a958c});
const tireM=new THREE.MeshLambertMaterial({color:0x1c1a20});
const binM=new THREE.MeshLambertMaterial({color:0x55684c});
const weedM=new THREE.MeshLambertMaterial({color:0x5f8a48});

// Chunking espacial (LOD por tamanho, igual aos props): entulho é objeto
// pequeno/médio → distância de corte curta. updateLotCulling esconde os longe.
const LOT_CHUNK=90, LOT_CULL=200;
type LotBuckets={concrete:THREE.BufferGeometry[],tire:THREE.BufferGeometry[],bin:THREE.BufferGeometry[],weed:THREE.BufferGeometry[]};
const newBuckets=():LotBuckets=>({concrete:[],tire:[],bin:[],weed:[]});
const chunks=new Map<string,LotBuckets>();
function chunkFor(cx:number,cz:number):LotBuckets{
  const k=Math.round(cx/LOT_CHUNK)+'_'+Math.round(cz/LOT_CHUNK);
  let b=chunks.get(k);
  if(!b){b=newBuckets();chunks.set(k,b);}
  return b;
}
export const lotChunks:THREE.Group[]=[];

function push(arr:THREE.BufferGeometry[],geo:THREE.BufferGeometry,x:number,y:number,z:number,ry=0,rx=0,rz=0):void{
  if(rx)geo.rotateX(rx);
  if(rz)geo.rotateZ(rz);
  if(ry)geo.rotateY(ry);
  geo.translate(x,y,z);
  arr.push(geo);
}

export function addAbandonedLot(cx:number,cz:number,w:number,d:number,solids:{x0:number,x1:number,z0:number,z1:number,h:number}[]):void{
  const buckets=chunkFor(cx,cz); // tudo deste lote vai pro balde do seu chunk
  // pilhas de entulho: lajes e blocos quebrados meio afundados na terra
  for(let k=0;k<irand(2,3);k++){
    const px=cx+rand(-w/2+1.2,w/2-1.2),pz=cz+rand(-d/2+1.2,d/2-1.2);
    for(let q=0;q<irand(2,4);q++)
      push(buckets.concrete,
        new THREE.BoxGeometry(rand(.5,1.3),rand(.16,.45),rand(.4,1.1)),
        px+rand(-.7,.7),rand(.08,.28),pz+rand(-.7,.7),
        rand(0,Math.PI),rand(-.1,.1),rand(-.12,.12));
  }
  // pneus largados: a maioria deitada, alguns encostados de pé
  for(let k=0;k<irand(2,4);k++){
    const flat=Math.random()<.7;
    push(buckets.tire,new THREE.TorusGeometry(.3,.11,6,12),
      cx+rand(-w/2+.8,w/2-.8),flat?.12:.41,cz+rand(-d/2+.8,d/2-.8),
      rand(0,Math.PI),flat?Math.PI/2:rand(-.2,.2));
  }
  // mato crescendo nas rachaduras
  for(let k=0;k<irand(5,9);k++){
    const h=rand(.2,.45);
    push(buckets.weed,new THREE.ConeGeometry(rand(.05,.1),h,5),
      cx+rand(-w/2+.5,w/2-.5),h/2,cz+rand(-d/2+.5,d/2-.5),
      rand(0,Math.PI),rand(-.15,.15),rand(-.15,.15));
  }
  // tambores enferrujados, alguns tombados
  for(let k=0;k<irand(0,2);k++){
    const down=Math.random()<.4;
    push(buckets.bin,new THREE.CylinderGeometry(.3,.3,.85,8),
      cx+rand(-w/2+.9,w/2-.9),down?.3:.43,cz+rand(-d/2+.9,d/2-.9),
      rand(0,Math.PI),0,down?Math.PI/2:rand(-.05,.05));
  }
  // caçamba de entulho (sólida: carro e pedestre batem nela)
  if(Math.random()<.45){
    const px=cx+rand(-w/2+1.6,w/2-1.6),pz=cz+rand(-d/2+1.4,d/2-1.4);
    const ry=rand(-.25,.25);
    push(buckets.bin,new THREE.BoxGeometry(2.1,1.0,1.15),px,.62,pz,ry);
    push(buckets.bin,new THREE.BoxGeometry(2.18,.08,1.22),px,1.16,pz,ry,0,-.06);
    solids.push({x0:px-1.25,x1:px+1.25,z0:pz-.85,z1:pz+.85,h:1.25});
  }
}

// Funde cada balde num único mesh — chamar UMA vez, depois da cidade montada
export function finalizeAbandonedLots():void{
  for(const[key,b]of chunks){
    const group=new THREE.Group();
    const add=(geos:THREE.BufferGeometry[],mat:THREE.Material,cast=true):void=>{
      if(!geos.length)return;
      const m=new THREE.Mesh(mergeGeometries(geos),mat);
      m.castShadow=cast;
      // mesh fundido nunca se move: congela a matriz local (sem recompose/frame)
      m.matrixAutoUpdate=false;m.updateMatrix();
      group.add(m);
    };
    add(b.concrete,concreteM);
    add(b.tire,tireM);
    add(b.bin,binM);
    add(b.weed,weedM,false);
    if(!group.children.length)continue;
    const[ki,kj]=key.split('_').map(Number);
    group.userData.cx=ki*LOT_CHUNK;group.userData.cz=kj*LOT_CHUNK;
    // chunk fica na identidade (geometria já em world space): congela a matriz
    group.matrixAutoUpdate=false;group.updateMatrix();
    scene.add(group);
    lotChunks.push(group);
  }
  chunks.clear();
}

// Esconde os lotes longe do jogador (distância média — entulho é pequeno).
export function updateLotCulling(px:number,pz:number):void{
  const f2=LOT_CULL*LOT_CULL;
  for(const g of lotChunks){
    const dx=g.userData.cx-px,dz=g.userData.cz-pz;
    g.visible=dx*dx+dz*dz<f2;
  }
}
