import * as THREE from 'three';

type ColorMaterial=THREE.MeshLambertMaterial|THREE.MeshBasicMaterial;
const ignored=new Set(['uuid','name','version','userData','_listeners']);

// Compare every own material setting, including depth/stencil/blending/clipping flags
// that a short hand-written material key can miss. Texture identity stays significant.
export function staticMaterialSignature(material:THREE.Material,omitColor=false):string{
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
  // Keep all maps, emissive surfaces and custom/morph geometry out of colour batching.
  if(Object.values(m).some(value=>value?.isTexture))return false;
  if(m instanceof THREE.MeshLambertMaterial&&m.emissiveIntensity!==0&&(m.emissive.r!==0||m.emissive.g!==0||m.emissive.b!==0))return false;
  if(Object.keys(geometry.morphAttributes).length)return false;
  const color=geometry.getAttribute('color');
  return !color||color.itemSize===3;
}

// Geometry is already a clone. Three.js stores material colours in linear space;
// writing these components directly reproduces diffuseColor *= vColor exactly.
export function bakeStaticColor(geometry:THREE.BufferGeometry,material:ColorMaterial):void{
  const count=geometry.getAttribute('position').count,source=geometry.getAttribute('color');
  const rgb=new Float32Array(count*3),c=material.color;
  for(let i=0;i<count;i++){
    rgb[i*3]=c.r*(material.vertexColors&&source?source.getX(i):1);
    rgb[i*3+1]=c.g*(material.vertexColors&&source?source.getY(i):1);
    rgb[i*3+2]=c.b*(material.vertexColors&&source?source.getZ(i):1);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
}

export function staticColorMaterial(material:ColorMaterial):ColorMaterial{
  const shared=material.clone();shared.color.setRGB(1,1,1);shared.vertexColors=true;
  return shared;
}
