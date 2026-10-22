import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {renderCensus} from '../../src/js/core/render-census.ts';

function fixture(){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  const a=new THREE.Group(),b=new THREE.Group(),hidden=new THREE.Group();
  hidden.visible=false;scene.add(a,b,hidden);
  let fail=false;
  const renderer={
    shadowMap:{enabled:true,needsUpdate:false},
    info:{autoReset:false,render:{calls:0,triangles:0},reset(){}},
    render(){
      if(fail&&!a.visible)throw new Error('render failed');
      this.info.render.calls=3+(a.visible?7:0)+(b.visible?2:0)+(hidden.visible?9:0);
      this.info.render.triangles=this.info.render.calls*10;
    },
  };
  return {scene,camera,a,b,hidden,renderer,fail:()=>{fail=true;}};
}

describe('render census',()=>{
  it('attributes color draws, retains hidden roots and reconciles the remainder',()=>{
    const f=fixture();
    expect(renderCensus(f.renderer as unknown as THREE.WebGLRenderer,f.scene,f.camera,{houses:[f.a,f.hidden],terrain:[f.b]}))
      .toEqual({__total:{draws:12,tris:120},houses:{draws:7,tris:70},terrain:{draws:2,tris:20},__remainder:{draws:3,tris:30}});
    expect(f.hidden.visible).toBe(false);
    expect(f.renderer.shadowMap).toEqual({enabled:true,needsUpdate:false});
    expect(f.renderer.info.autoReset).toBe(false);
  });
  it('restores visibility and renderer state after a failed render',()=>{
    const f=fixture();f.fail();
    expect(()=>renderCensus(f.renderer as unknown as THREE.WebGLRenderer,f.scene,f.camera,{houses:[f.a]})).toThrow('render failed');
    expect(f.a.visible).toBe(true);
    expect(f.renderer.shadowMap).toEqual({enabled:true,needsUpdate:false});
    expect(f.renderer.info.autoReset).toBe(false);
  });
  it('rejects duplicate or nested attribution roots',()=>{
    const f=fixture();
    expect(()=>renderCensus(f.renderer as unknown as THREE.WebGLRenderer,f.scene,f.camera,{a:[f.a],b:[f.a]})).toThrow('Duplicate');
    f.a.add(f.b);
    expect(()=>renderCensus(f.renderer as unknown as THREE.WebGLRenderer,f.scene,f.camera,{a:[f.a],b:[f.b]})).toThrow('Overlapping');
  });
});
