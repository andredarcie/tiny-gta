import * as THREE from 'three';

type ColorMaterial=THREE.MeshLambertMaterial|THREE.MeshBasicMaterial;
const ignored=new Set(['uuid','name','version','userData','_listeners']);

// Compare every own material setting, including depth/stencil/blending/clipping flags
// that a short hand-written material key can miss. Texture identity stays significant.
// Cached per material (the town merges thousands of meshes over a few hundred materials;
// stringifying each one every time cost ~0.75 s of the boot). A material must not be
// changed after it has been merged — the town's static materials never are.
const sigCache=[new WeakMap<THREE.Material,string>(),new WeakMap<THREE.Material,string>()];
export function staticMaterialSignature(material:THREE.Material,omitColor=false):string{
  const cache=sigCache[omitColor?1:0];
  let s=cache.get(material);
  if(s===undefined){s=materialSignature(material,omitColor);cache.set(material,s);}
  return s;
}
function materialSignature(material:THREE.Material,omitColor:boolean):string{
  if(material.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile||
    material.customProgramCacheKey!==THREE.Material.prototype.customProgramCacheKey)return material.uuid;
  const values:Record<string,unknown>={};
  for(const key of Object.keys(material).sort()){
    if(ignored.has(key)||omitColor&&(key==='color'||key==='vertexColors'))continue;
    const value=(material as unknown as Record<string,unknown>)[key];
    values[key]=(value as THREE.Texture)?.isTexture?{texture:(value as THREE.Texture).uuid}:
      (value as THREE.Color)?.isColor?{linearRGB:(value as THREE.Color).toArray()}:value;
  }
  return JSON.stringify(values);
}

export function canBakeStaticColor(material:THREE.Material,geometry:THREE.BufferGeometry):material is ColorMaterial{
  if(material.constructor!==THREE.MeshLambertMaterial&&material.constructor!==THREE.MeshBasicMaterial)return false;
  const m=material as ColorMaterial;
  if(m.transparent||m.opacity!==1||!m.visible||m.alphaTest!==0||m.alphaHash||m.alphaToCoverage)return false;
  if(m.onBeforeCompile!==THREE.Material.prototype.onBeforeCompile||
    m.customProgramCacheKey!==THREE.Material.prototype.customProgramCacheKey)return false;
  // A diffuse `map` may stay: the shader multiplies colour × vertex colour × texel, so the
  // colour can move into the vertices and every tint of one texture (a street's plaster,
  // roof tiles, louvres in a dozen paints) shares a draw — the texture stays in the
  // signature. Any other map, emissive surfaces and custom/morph geometry stay out.
  if(Object.entries(m).some(([key,value])=>key!=='map'&&value?.isTexture))return false;
  if(m instanceof THREE.MeshLambertMaterial&&m.emissiveIntensity!==0&&(m.emissive.r!==0||m.emissive.g!==0||m.emissive.b!==0))return false;
  if(Object.keys(geometry.morphAttributes).length)return false;
  const color=geometry.getAttribute('color');
  return !color||color.itemSize===3;
}

// Geometry is already a clone. Three.js stores material colours in linear space;
// writing these components directly reproduces diffuseColor *= vColor (to 1/65535 — the
// colours are stored as normalised 16-bit, half the memory of floats: the town keeps
// millions of these vertices). A material without any texture also drops its UVs, which
// its shader never reads (and which kept otherwise identical batches apart).
export function bakeStaticColor(geometry:THREE.BufferGeometry,material:ColorMaterial):void{
  const count=geometry.getAttribute('position').count,source=geometry.getAttribute('color');
  const rgb=new Float32Array(count*3),c=material.color;
  let max=0;
  for(let i=0;i<count;i++){
    rgb[i*3]=c.r*(material.vertexColors&&source?source.getX(i):1);
    rgb[i*3+1]=c.g*(material.vertexColors&&source?source.getY(i):1);
    rgb[i*3+2]=c.b*(material.vertexColors&&source?source.getZ(i):1);
    max=Math.max(max,rgb[i*3],rgb[i*3+1],rgb[i*3+2]);
  }
  // (colours lifted past 1 — the foliage compensates its texture so — stay floats)
  if(max<=1){
    const u16=new Uint16Array(count*3);for(let i=0;i<u16.length;i++)u16[i]=Math.round(Math.max(0,rgb[i])*65535);
    geometry.setAttribute('color',new THREE.BufferAttribute(u16,3,true));
  }else geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
  if(!material.map&&geometry.getAttribute('uv'))geometry.deleteAttribute('uv');
  // normals as normalised bytes: a quarter of the floats, ~1° of precision
  const n=geometry.getAttribute('normal');
  if(n&&!(n.array instanceof Int8Array)){
    const i8=new Int8Array(n.count*3);
    for(let i=0;i<n.count;i++){i8[i*3]=Math.round(n.getX(i)*127);i8[i*3+1]=Math.round(n.getY(i)*127);i8[i*3+2]=Math.round(n.getZ(i)*127);}
    geometry.setAttribute('normal',new THREE.BufferAttribute(i8,3,true));
  }
}

// one white vertex-coloured material per signature for the whole town (not one per merged
// batch): fewer state changes between draws, and nothing to compile twice
const shared=new Map<string,ColorMaterial>();
export function staticColorMaterial(material:ColorMaterial):ColorMaterial{
  const key=staticMaterialSignature(material,true);
  let m=shared.get(key);
  if(!m){m=material.clone();m.color.setRGB(1,1,1);m.vertexColors=true;shared.set(key,m);}
  return m;
}
