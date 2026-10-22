import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {scene} from '@/core/engine.ts';
import {bakeStaticColor,canBakeStaticColor,staticColorMaterial,staticMaterialSignature} from './static-color-batch.ts';

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
const PROP_CULL=108;  // perf: 160→108. Props (árvores/postes/placas) são ~30 draws/chunk; cortar cedo economiza draws (a névoa a ~200 já os esconde)
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
    (m.polygonOffset?m.polygonOffsetFactor+','+m.polygonOffsetUnits:'-')+'|'+
    (cast?1:0)+'|'+(receive?1:0)+'|'+order;
}

// One material group of a multi-material mesh (a box with a sign on one face) as its own
// non-indexed geometry: merged geometries keep no groups, so a material ARRAY can't be
// merged as is — each face goes to the bucket of its own material.
function groupSlices(m:THREE.Mesh):{geo:THREE.BufferGeometry;mat:THREE.Material}[]{
  const mats=m.material as THREE.Material[],src=m.geometry.index?m.geometry.toNonIndexed():m.geometry;
  const groups=src.groups.length?src.groups:[{start:0,count:src.getAttribute('position').count,materialIndex:0}];
  const out:{geo:THREE.BufferGeometry;mat:THREE.Material}[]=[];
  for(const gr of groups){
    const mat=mats[gr.materialIndex??0];if(!mat)continue;
    const geo=new THREE.BufferGeometry();
    for(const k in src.attributes){
      const at=src.attributes[k] as THREE.BufferAttribute;
      geo.setAttribute(k,new THREE.BufferAttribute(at.array.slice(gr.start*at.itemSize,(gr.start+gr.count)*at.itemSize),at.itemSize,at.normalized));
    }
    out.push({geo,mat});
  }
  return out;
}

// Funde IN-PLACE os meshes ESTÁTICOS (matrixAutoUpdate=false) da sub-árvore de `group`
// em poucos meshes por assinatura de material+sombra (geometria assada em world space;
// o group deve estar na identidade). Marcos autorais grandes — que NÃO podem entrar nos
// chunks fundidos por terem fachada que liga/desliga ou interior — viram centenas de
// draw calls soltos; isto colapsa pra um punhado, mantendo o group como unidade
// (cull/toggle seguem valendo). Meshes animados (matrixAutoUpdate=true, ex.: seta da
// porta) e sub-árvores em `preserve` (ex.: a placa FOR SALE que liga/desliga) ficam
// intactos. VISUAL-NEUTRO: só funde quem tem assinatura idêntica.
export function mergeStatic(group:THREE.Object3D,preserve:Set<THREE.Object3D>=new Set(),options:{vertexColors?:boolean}={}):void{
  group.updateMatrixWorld(true);
  const statics:THREE.Mesh[]=[],keep:THREE.Object3D[]=[];
  const collect=(o:THREE.Object3D):void=>{
    for(const c of o.children){
      if(preserve.has(c)||!c.visible){keep.push(c);continue;}
      const m=c as THREE.Mesh;
      if(m.isMesh){
        if(c.matrixAutoUpdate===false&&c.children.length===0&&!m.customDepthMaterial&&!m.customDistanceMaterial&&
          m.onBeforeRender===THREE.Object3D.prototype.onBeforeRender&&m.onAfterRender===THREE.Object3D.prototype.onAfterRender)statics.push(m);
        else keep.push(c); // animado, ou mesh com filhos: mantém
      }else collect(c); // Group intermediário: achata (puxa os meshes estáticos pra cima)
    }
  };
  collect(group);
  if(statics.length<2)return; // nada a ganhar
  const buckets=new Map<string,{geos:THREE.BufferGeometry[];mat:THREE.Material;cast:boolean;receive:boolean;order:number;source:THREE.Mesh}>();
  for(const m of statics){
    const parts=Array.isArray(m.material)?groupSlices(m):[{geo:m.geometry.clone(),mat:m.material}];
    for(const{geo,mat}of parts){
      const colorBatch=!!options.vertexColors&&canBakeStaticColor(mat,geo);
      const signature=options.vertexColors?staticMaterialSignature(mat,colorBatch):matSig(mat,!!m.castShadow,!!m.receiveShadow,m.renderOrder);
      // Preserve mesh-specific render state and attribute layouts too. A missing UV
      // or normal must not make an otherwise compatible bucket fail its merge.
      if(colorBatch)bakeStaticColor(geo,mat as THREE.MeshLambertMaterial);
      const layout=Object.keys(geo.attributes).sort().map(k=>{
        const a=geo.getAttribute(k);return[k,a.itemSize,a.normalized,a.array.constructor.name];
      });
      const sig=signature+'|'+JSON.stringify([colorBatch,m.castShadow,m.receiveShadow,m.renderOrder,m.visible,m.layers.mask,m.frustumCulled,layout]);
      let b=buckets.get(sig);
      if(!b){b={geos:[],mat:colorBatch?staticColorMaterial(mat as THREE.MeshLambertMaterial):mat,cast:!!m.castShadow,receive:!!m.receiveShadow,order:m.renderOrder,source:m};buckets.set(sig,b);}
      b.geos.push(geo.applyMatrix4(m.matrixWorld));
    }
  }
  const inverse=group.matrixWorld.clone().invert();
  const keepMatrices=keep.map(k=>inverse.clone().multiply(k.matrixWorld));
  group.clear(); // solta todos os filhos; readiciona os preservados + os fundidos
  for(let i=0;i<keep.length;i++){
    const k=keep[i];k.matrix.copy(keepMatrices[i]);k.matrix.decompose(k.position,k.quaternion,k.scale);group.add(k);
  }
  for(const[,b]of buckets){
    let geos=b.geos;
    if(geos.some(g=>g.index)&&geos.some(g=>!g.index))geos=geos.map(g=>g.index?g.toNonIndexed():g);
    const merged=mergeGeometries(geos);
    if(!merged){for(const g of b.geos){const mm=new THREE.Mesh(g,b.mat);mm.castShadow=b.cast;mm.receiveShadow=b.receive;mm.renderOrder=b.order;mm.layers.mask=b.source.layers.mask;mm.frustumCulled=b.source.frustumCulled;mm.matrixAutoUpdate=false;mm.updateMatrix();group.add(mm);}continue;}
    const mesh=new THREE.Mesh(merged,b.mat);
    mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;mesh.renderOrder=b.order;
    mesh.layers.mask=b.source.layers.mask;mesh.frustumCulled=b.source.frustumCulled;
    mesh.matrixAutoUpdate=false;mesh.updateMatrix();
    group.add(mesh);
  }
}

// Funde os meshes-folha DIRETOS de `group` por assinatura de material+sombra, no
// referencial LOCAL do próprio group (geometria assada com group^-1 * meshWorld), e
// devolve os fundidos como filhos do group. Diferente de mergeStatic (que assa em
// WORLD e congela): aqui o group CONTINUA se movendo (é um veículo / uma roda que
// gira), então a geometria fica no frame do group e acompanha a animação. Sub-grupos
// animados em `preserve` (rodas, volante) ficam intactos. Use em cada sub-conjunto
// RÍGIDO: o corpo do veículo, e DENTRO de cada roda (os ~20 meshes de uma roda giram
// juntos). Colapsa o tração de ~117 draws p/ ~30, sem mudar um pixel.
export function mergeRigid(group:THREE.Object3D,preserve:Set<THREE.Object3D>=new Set()):void{
  group.updateMatrixWorld(true);
  const inv=group.matrixWorld.clone().invert();
  const leaves:THREE.Mesh[]=[];
  for(const c of group.children){
    if(preserve.has(c))continue;
    const m=c as THREE.Mesh;
    if(m.isMesh&&c.children.length===0)leaves.push(m); // só funde meshes-folha rígidos
  }
  if(leaves.length<2)return;
  const buckets=new Map<string,{geos:THREE.BufferGeometry[];mat:THREE.Material;cast:boolean;receive:boolean;order:number}>();
  for(const m of leaves){
    const mat=m.material as THREE.Material;
    const sig=matSig(mat,!!m.castShadow,!!m.receiveShadow,m.renderOrder);
    let b=buckets.get(sig);
    if(!b){b={geos:[],mat,cast:!!m.castShadow,receive:!!m.receiveShadow,order:m.renderOrder};buckets.set(sig,b);}
    b.geos.push(m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)));
  }
  for(const m of leaves)group.remove(m);
  for(const[,b]of buckets){
    let geos=b.geos;
    if(geos.some(g=>g.index)&&geos.some(g=>!g.index))geos=geos.map(g=>g.index?g.toNonIndexed():g);
    const merged=mergeGeometries(geos);
    if(!merged){for(const g of b.geos){const mm=new THREE.Mesh(g,b.mat);mm.castShadow=b.cast;mm.receiveShadow=b.receive;mm.renderOrder=b.order;group.add(mm);}continue;}
    const mesh=new THREE.Mesh(merged,b.mat);
    mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;mesh.renderOrder=b.order;
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
