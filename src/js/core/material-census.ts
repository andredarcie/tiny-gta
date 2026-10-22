import type * as THREE from 'three';

// Count actual submitted color draws by material kind, rather than counting scene meshes.
// Grouped/multi-material meshes are reported using the material passed by the renderer.
export function materialCensus(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,
  groups:Record<string,THREE.Object3D[]>){
  const out:Record<string,Record<string,number>>={};
  const restore:Array<()=>void>=[];
  const seen=new Set<THREE.Object3D>();
  const shadow=renderer.shadowMap.enabled,needsUpdate=renderer.shadowMap.needsUpdate;
  const autoReset=renderer.info.autoReset;
  try{
    for(const [category,roots] of Object.entries(groups)){
      out[category]={plainOpaque:0,textured:0,emissive:0,transparent:0,other:0};
      for(const root of roots)root.traverse(o=>{
        if(seen.has(o))return;seen.add(o);
        if(!(o as THREE.Mesh).isMesh)return;
        const before=o.onBeforeRender,after=o.onAfterRender;
        let start=0;
        o.onBeforeRender=function(...args){before.apply(this,args);start=renderer.info.render.calls;};
        o.onAfterRender=function(...args){
          const material=args[4] as THREE.MeshLambertMaterial;
          const kind=material.transparent?'transparent':material.emissive&&material.emissive.getHex()!==0?'emissive':material.map?'textured':material.color?'plainOpaque':'other';
          out[category][kind]+=renderer.info.render.calls-start;
          after.apply(this,args);
        };
        restore.push(()=>{o.onBeforeRender=before;o.onAfterRender=after;});
      });
    }
    renderer.shadowMap.enabled=false;renderer.info.autoReset=true;
    renderer.info.reset();renderer.render(scene,camera);
    return out;
  }finally{
    for(const fn of restore)fn();
    renderer.shadowMap.enabled=shadow;renderer.shadowMap.needsUpdate=needsUpdate;
    renderer.info.autoReset=autoReset;
  }
}
