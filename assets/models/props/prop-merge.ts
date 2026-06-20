import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.js';

// Fusão de props estáticos (palmeira, pinheiro, poste, guarda-sol, cadeira,
// posto de salva-vidas, pedras, feno): cada módulo monta o prop do jeito antigo
// (grupo + meshes), mas em vez de entrar na cena, bakeProp() assa a matriz de
// mundo de cada mesh num balde por (CHUNK espacial, material).
//
// finalizeProps() funde cada balde num mesh, agrupados por chunk. updatePropCulling()
// esconde os chunks distantes com uma distância de corte CURTA — LOD por tamanho
// estilo open-world: objeto pequeno NÃO deve ser desenhado de longe (some perto), ao
// contrário dos prédios (grandes), que aparecem de bem longe.
const PROP_CHUNK=90;  // lado do super-bloco de props (m)
const PROP_CULL=160;  // props além disso (do centro do chunk) não são desenhados
interface PropBucket{geos:THREE.BufferGeometry[];cast:boolean;receive:boolean;order:number;}
const chunks=new Map<string,Map<THREE.Material,PropBucket>>(); // chunkKey -> Map(material -> {geos,cast,receive,order})
const _wp=new THREE.Vector3();

export function bakeProp(root: THREE.Object3D): void{
  root.updateMatrixWorld(true);
  _wp.setFromMatrixPosition(root.matrixWorld); // âncora do prop pro chunk
  const key=Math.round(_wp.x/PROP_CHUNK)+'_'+Math.round(_wp.z/PROP_CHUNK);
  let cm=chunks.get(key);
  if(!cm){cm=new Map();chunks.set(key,cm);}
  root.traverse(o=>{
    if(!(o as THREE.Mesh).isMesh)return;
    const mesh=o as THREE.Mesh;
    const material=mesh.material as THREE.Material;
    let b=cm!.get(material);
    if(!b){
      b={geos:[],cast:!!mesh.castShadow,receive:!!mesh.receiveShadow,order:mesh.renderOrder};
      cm!.set(material,b);
    }
    b.geos.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
  });
}

// Grupos de chunk de props prontos (cada um com seu centro em userData).
export const propChunks: THREE.Group[]=[];

// Chamar UMA vez, no fim do world.js, depois de todos os props colocados
export function finalizeProps(): void{
  for(const[key,cm]of chunks){
    const group=new THREE.Group();
    for(const[mat,b]of cm){
      if(!b.geos.length)continue;
      const m=new THREE.Mesh(mergeGeometries(b.geos),mat);
      m.castShadow=b.cast;m.receiveShadow=b.receive;m.renderOrder=b.order;
      // mesh fundido nunca se move: congela a matriz local (sem recompose/frame)
      m.matrixAutoUpdate=false;m.updateMatrix();
      group.add(m);
    }
    if(!group.children.length)continue;
    const[ki,kj]=key.split('_').map(Number);
    group.userData.cx=ki*PROP_CHUNK;group.userData.cz=kj*PROP_CHUNK;
    // chunk fica na identidade (geometria já em world space): congela a matriz
    group.matrixAutoUpdate=false;group.updateMatrix();
    scene.add(group);
    propChunks.push(group);
  }
  chunks.clear();
}

// Esconde os chunks de props longe do jogador. Corte CURTO de propósito: objeto
// pequeno não deve aparecer de longe (LOD por tamanho — ver comentário no topo).
export function updatePropCulling(px: number,pz: number): void{
  const f2=PROP_CULL*PROP_CULL;
  for(const g of propChunks){
    const dx=g.userData.cx-px,dz=g.userData.cz-pz;
    g.visible=dx*dx+dz*dz<f2;
  }
}
