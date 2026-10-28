import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
vi.mock('@/core/engine.ts',()=>({scene:new THREE.Scene()}));
import {mergeStatic} from '../../src/assets/models/props/prop-merge.ts';

function add(root:THREE.Group,material:THREE.Material,geometry=new THREE.BoxGeometry()):THREE.Mesh{
  const mesh=new THREE.Mesh(geometry,material);mesh.matrixAutoUpdate=false;mesh.updateMatrix();root.add(mesh);return mesh;
}
const merge=(root:THREE.Group):void=>mergeStatic(root,new Set(),{vertexColors:true});

describe('static colour batching',()=>{
  it('merges opaque colour variants using linear RGB and preserves indexed geometry and hard normals',()=>{
    const root=new THREE.Group(),red=new THREE.MeshLambertMaterial({color:0xb24d22}),blue=new THREE.MeshLambertMaterial({color:0x224db2});
    add(root,red);const second=add(root,blue);second.position.x=3;second.updateMatrix();merge(root);
    expect(root.children).toHaveLength(1);
    const result=root.children[0] as THREE.Mesh,geometry=result.geometry,color=geometry.getAttribute('color');
    expect(geometry.index?.count).toBe(72);expect(geometry.getAttribute('position').count).toBe(48);
    // (no texture: the UVs, which the shader never reads, are dropped; colours are 16-bit)
    expect(geometry.getAttribute('uv')).toBeUndefined();expect(geometry.getAttribute('normal').getZ(16)).toBe(1);
    expect(color.normalized).toBe(true);
    expect(color.getX(0)).toBeCloseTo(red.color.r,4);expect(color.getZ(24)).toBeCloseTo(blue.color.b,4);
    expect((result.material as THREE.MeshLambertMaterial).color.toArray()).toEqual([1,1,1]);
    expect(red.vertexColors).toBe(false);expect(red.color.getHex()).toBe(0xb24d22);
  });
  it('multiplies existing normalized vertex colours instead of replacing them',()=>{
    const root=new THREE.Group(),material=new THREE.MeshLambertMaterial({color:0x808080,vertexColors:true});
    for(let i=0;i<2;i++){
      const geometry=new THREE.BoxGeometry();geometry.setAttribute('color',new THREE.Uint8BufferAttribute(new Uint8Array(24*3).fill(128),3,true));add(root,material,geometry);
    }
    merge(root);expect(root.children).toHaveLength(1);
    expect((root.children[0] as THREE.Mesh).geometry.getAttribute('color').getX(0)).toBeCloseTo(material.color.r*128/255,4);
  });
  it('does not consolidate emissive, transparent or non-diffuse-map colour variants',()=>{
    const root=new THREE.Group(),glow=new THREE.Texture();
    for(const color of [0xff0000,0x0000ff]){
      add(root,new THREE.MeshLambertMaterial({color,emissive:0x112233}));
      add(root,new THREE.MeshLambertMaterial({color,transparent:true,opacity:.5}));
      add(root,new THREE.MeshLambertMaterial({color,emissiveMap:glow}));
    }
    merge(root);expect(root.children).toHaveLength(6);
    for(const mesh of root.children as THREE.Mesh[])expect((mesh.material as THREE.Material).vertexColors).toBe(false);
  });
  it('keeps the UVs of a textured batch and float colours lifted past 1',()=>{
    const root=new THREE.Group(),tex=new THREE.Texture();
    for(const color of [0xff0000,0x00ff00])add(root,new THREE.MeshLambertMaterial({color,map:tex}));
    const bright=new THREE.Group();
    for(let i=0;i<2;i++){const m=new THREE.MeshLambertMaterial({color:0x808080});m.color.multiplyScalar(6);add(bright,m);}
    merge(root);merge(bright);
    expect((root.children[0] as THREE.Mesh).geometry.getAttribute('uv')).toBeDefined();
    const c=(bright.children[0] as THREE.Mesh).geometry.getAttribute('color');
    expect(c.normalized).toBe(false);expect(c.getX(0)).toBeGreaterThan(1);
  });
  it('consolidates the tints of one diffuse map, keeping different maps apart',()=>{
    const root=new THREE.Group(),plaster=new THREE.Texture(),tiles=new THREE.Texture();
    for(const color of [0xff0000,0x0000ff,0x00ff00])add(root,new THREE.MeshLambertMaterial({color,map:plaster}));
    add(root,new THREE.MeshLambertMaterial({color:0xff0000,map:tiles}));add(root,new THREE.MeshLambertMaterial({color:0x0000ff,map:tiles}));
    merge(root);expect(root.children).toHaveLength(2);
    for(const mesh of root.children as THREE.Mesh[]){
      const m=mesh.material as THREE.MeshLambertMaterial;
      expect(m.vertexColors).toBe(true);expect(m.color.getHex()).toBe(0xffffff);
    }
    expect(new Set(root.children.map(c=>((c as THREE.Mesh).material as THREE.MeshLambertMaterial).map))).toEqual(new Set([plaster,tiles]));
  });
  it('separates depth, stencil, shadow, order and layer settings',()=>{
    const root=new THREE.Group();
    const materials=[new THREE.MeshLambertMaterial(),new THREE.MeshLambertMaterial({depthTest:false}),new THREE.MeshLambertMaterial({stencilWrite:true,stencilRef:4})];
    materials.forEach(m=>add(root,m));
    add(root,materials[0]).castShadow=true;add(root,materials[0]).renderOrder=4;
    const layered=add(root,materials[0]);layered.layers.set(2);layered.frustumCulled=false;
    merge(root);expect(root.children).toHaveLength(6);
    expect(root.children.some(m=>m.layers.mask===4&&!m.frustumCulled)).toBe(true);
  });
  it('is opt-in and preserves hidden groups and custom render hooks',()=>{
    const root=new THREE.Group();add(root,new THREE.MeshBasicMaterial({color:0xff0000}));add(root,new THREE.MeshBasicMaterial({color:0x0000ff}));
    mergeStatic(root);expect(root.children).toHaveLength(2);
    const hidden=new THREE.Group();hidden.visible=false;root.add(hidden);add(hidden,new THREE.MeshBasicMaterial());
    const hooked=add(root,new THREE.MeshBasicMaterial());hooked.onBeforeRender=()=>{};
    merge(root);expect(root.children).toContain(hidden);expect(root.children).toContain(hooked);expect(hidden.visible).toBe(false);
  });
  it('keeps hidden nested subtrees at their original world transform',()=>{
    const root=new THREE.Group(),parent=new THREE.Group(),hidden=new THREE.Group();
    parent.position.set(8,4,-2);hidden.position.set(2,1,3);hidden.visible=false;parent.add(hidden);root.add(parent);
    add(root,new THREE.MeshBasicMaterial({color:0xff0000}));add(root,new THREE.MeshBasicMaterial({color:0x00ff00}));
    root.updateMatrixWorld(true);const before=hidden.getWorldPosition(new THREE.Vector3());
    merge(root);root.updateMatrixWorld(true);expect(hidden.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(before.toArray());
  });
});
