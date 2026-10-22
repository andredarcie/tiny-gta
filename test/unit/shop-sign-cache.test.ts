import {it,expect} from 'vitest';
import * as THREE from 'three';
import {buildLoja} from '../../src/assets/models/divinolandia/loja-comercio.ts';

it('shares only identically painted sign faces regardless of placement, depth and lighting',()=>{
  const base={lines:['TEST SIGN'],bg:'#fff',fg:'#123456',w:3,h:1,y:3};
  const shop=buildLoja({w:10,f:{wall:'#ccc',roof:'flat'},shop:{signs:[
    base,{...base,x:3,y:4,depth:.2,lit:true},{...base,lines:['OTHER SIGN']},{...base,w:4},
  ]}});
  const faces:THREE.MeshLambertMaterial[]=[];
  shop.traverse(o=>{
    const m=o as THREE.Mesh;
    if(m.isMesh&&Array.isArray(m.material)&&m.material.length===6)faces.push(m.material[4] as THREE.MeshLambertMaterial);
  });
  expect(faces).toHaveLength(4);
  expect(faces[0].map).toBe(faces[1].map);
  expect(faces[1].emissive.getHex()).toBe(0x262626);
  expect(faces[0].map).not.toBe(faces[2].map);
  expect(faces[0].map).not.toBe(faces[3].map);
});
