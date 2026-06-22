import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';

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
      // mergeGeometries exige índice CONSISTENTE: se um material reúne geometria
      // indexada (Box/Cylinder) E não-indexada (Icosahedron/Shape) no mesmo balde,
      // o merge falha e devolve null. Normaliza tudo para não-indexado nesse caso.
      let geos=b.geos;
      if(geos.some(g=>g.index)&&geos.some(g=>!g.index))
        geos=geos.map(g=>g.index?g.toNonIndexed():g);
      const merged=mergeGeometries(geos);
      if(!merged)continue; // balde incompatível por outro motivo não derruba o mundo
      const m=new THREE.Mesh(merged,mat);
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

// Assinatura visual COMPLETA do material + flags de sombra: dois meshes só se fundem
// se renderizam pixel-a-pixel igual (mesmo material, mesma sombra, mesma ordem).
function matSig(m:THREE.Material,cast:boolean,receive:boolean,order:number):string{
  const a=m as unknown as {color?:THREE.Color;opacity?:number;flatShading?:boolean;
    emissive?:THREE.Color;emissiveIntensity?:number;toneMapped?:boolean;alphaTest?:number;
    fog?:boolean;map?:{uuid:string};emissiveMap?:{uuid:string}};
  return m.type+'|'+(a.color?a.color.getHexString():'-')+'|'+(m.transparent?1:0)+'|'+
    (a.opacity??1)+'|'+m.side+'|'+(a.flatShading?1:0)+'|'+(m.vertexColors?1:0)+'|'+
    (a.emissive?a.emissive.getHexString():'-')+'|'+(a.emissiveIntensity??1)+'|'+
    (m.depthWrite?1:0)+'|'+(a.fog?1:0)+'|'+(a.toneMapped?1:0)+'|'+(a.alphaTest??0)+'|'+
    (a.map?a.map.uuid:'-')+'|'+(a.emissiveMap?a.emissiveMap.uuid:'-')+'|'+
    (cast?1:0)+'|'+(receive?1:0)+'|'+order;
}

// Funde IN-PLACE os meshes ESTÁTICOS (matrixAutoUpdate=false) da sub-árvore de `group`
// em poucos meshes por assinatura de material+sombra (geometria assada em world space;
// o group deve estar na identidade). Marcos autorais grandes — que NÃO podem entrar nos
// chunks fundidos por terem fachada que liga/desliga ou interior — viram centenas de
// draw calls soltos; isto colapsa pra um punhado, mantendo o group como unidade
// (cull/toggle seguem valendo). Meshes animados (matrixAutoUpdate=true, ex.: seta da
// porta) e sub-árvores em `preserve` (ex.: a placa FOR SALE que liga/desliga) ficam
// intactos. VISUAL-NEUTRO: só funde quem tem assinatura idêntica.
export function mergeStatic(group:THREE.Object3D,preserve:Set<THREE.Object3D>=new Set()):void{
  group.updateMatrixWorld(true);
  const statics:THREE.Mesh[]=[],keep:THREE.Object3D[]=[];
  const collect=(o:THREE.Object3D):void=>{
    for(const c of o.children){
      if(preserve.has(c)){keep.push(c);continue;}
      const m=c as THREE.Mesh;
      if(m.isMesh){
        if(c.matrixAutoUpdate===false&&c.children.length===0)statics.push(m);
        else keep.push(c); // animado, ou mesh com filhos: mantém
      }else collect(c); // Group intermediário: achata (puxa os meshes estáticos pra cima)
    }
  };
  collect(group);
  if(statics.length<2)return; // nada a ganhar
  const buckets=new Map<string,{geos:THREE.BufferGeometry[];mat:THREE.Material;cast:boolean;receive:boolean;order:number}>();
  for(const m of statics){
    const mat=m.material as THREE.Material;
    const sig=matSig(mat,!!m.castShadow,!!m.receiveShadow,m.renderOrder);
    let b=buckets.get(sig);
    if(!b){b={geos:[],mat,cast:!!m.castShadow,receive:!!m.receiveShadow,order:m.renderOrder};buckets.set(sig,b);}
    b.geos.push(m.geometry.clone().applyMatrix4(m.matrixWorld));
  }
  group.clear(); // solta todos os filhos; readiciona os preservados + os fundidos
  for(const k of keep)group.add(k); // mesma matriz local; group na identidade -> world inalterado
  for(const[,b]of buckets){
    let geos=b.geos;
    if(geos.some(g=>g.index)&&geos.some(g=>!g.index))geos=geos.map(g=>g.index?g.toNonIndexed():g);
    const merged=mergeGeometries(geos);
    if(!merged){for(const g of b.geos){const mm=new THREE.Mesh(g,b.mat);mm.castShadow=b.cast;mm.receiveShadow=b.receive;mm.renderOrder=b.order;mm.matrixAutoUpdate=false;mm.updateMatrix();group.add(mm);}continue;}
    const mesh=new THREE.Mesh(merged,b.mat);
    mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;mesh.renderOrder=b.order;
    mesh.matrixAutoUpdate=false;mesh.updateMatrix();
    group.add(mesh);
  }
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
