import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {materialCensus} from '../../src/js/core/material-census.ts';

describe('material census',()=>{
  it('counts actual submitted material draws and restores callbacks on failure',()=>{
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
    const plain=new THREE.MeshLambertMaterial({color:'red'});
    const transparent=new THREE.MeshLambertMaterial({transparent:true});
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(),[plain,transparent]);scene.add(mesh);
    const before=vi.fn(),after=vi.fn();mesh.onBeforeRender=before;mesh.onAfterRender=after;
    let fail=false;
    const renderer={
      shadowMap:{enabled:true,needsUpdate:true},
      info:{autoReset:false,render:{calls:0},reset(){this.render.calls=0;}},
      render(){
        for(const material of [plain,transparent]){
          const args=[this,scene,camera,mesh.geometry,material,null] as unknown as Parameters<typeof mesh.onBeforeRender>;
          mesh.onBeforeRender(...args);
          if(fail)throw new Error('render failed');
          // Transparent double-sided surfaces can submit two calls per callback pair.
          this.info.render.calls+=material.transparent?2:1;
          mesh.onAfterRender(...args);
        }
      },
    };
    expect(materialCensus(renderer as unknown as THREE.WebGLRenderer,scene,camera,{shops:[mesh]}).shops)
      .toEqual({plainOpaque:1,textured:0,emissive:0,transparent:2,other:0});
    expect(before).toHaveBeenCalledTimes(2);expect(after).toHaveBeenCalledTimes(2);
    expect(mesh.onBeforeRender).toBe(before);expect(mesh.onAfterRender).toBe(after);
    expect(renderer.shadowMap).toEqual({enabled:true,needsUpdate:true});expect(renderer.info.autoReset).toBe(false);
    fail=true;
    expect(()=>materialCensus(renderer as unknown as THREE.WebGLRenderer,scene,camera,{shops:[mesh]})).toThrow('render failed');
    expect(mesh.onBeforeRender).toBe(before);expect(mesh.onAfterRender).toBe(after);
    expect(renderer.shadowMap).toEqual({enabled:true,needsUpdate:true});expect(renderer.info.autoReset).toBe(false);
  });
});
