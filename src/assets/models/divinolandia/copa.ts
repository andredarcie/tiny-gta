import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {matte} from '../matte.ts';
import {folhagemTexture} from './texturas.ts';

// Foliage kit for Divinolândia's trees, hedges and coffee rows (photoreal art direction):
// a leaf mass is a dense sphere whose surface is pushed in and out by smooth noise (a
// ragged, lumpy outline instead of a faceted low-poly ball), shaded smoothly and wrapped in
// the leaf-cluster detail texture (texturas.ts folhagemTexture). Not a model: no default
// export — arvore-praca.ts, arvore-rua.ts, vegetacao.ts and the gardens build with it.

const FOLIAGE_MEAN=.66;                 // average of the detail map: colours are lifted to match
const mats=new Map<string,THREE.MeshLambertMaterial>();
// leaf material of colour c (its daylight albedo — the detail map's average is compensated)
export function leafMat(c:THREE.ColorRepresentation):THREE.MeshLambertMaterial{
  const key=new THREE.Color(c).getHexString();
  let m=mats.get(key);
  if(!m){m=matte({color:new THREE.Color(c).multiplyScalar(1/FOLIAGE_MEAN),map:folhagemTexture()});mats.set(key,m);}
  return m;
}

// cheap smooth 3D value noise (deterministic)
function hash(x:number,y:number,z:number):number{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return v-Math.floor(v);}
function noise(x:number,y:number,z:number):number{
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=x-xi,yf=y-yi,zf=z-zi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf);
  const l=(a:number,b:number,t:number):number=>a+(b-a)*t;
  const c=(i:number,j:number,k:number):number=>hash(xi+i,yi+j,zi+k);
  return l(l(l(c(0,0,0),c(1,0,0),u),l(c(0,1,0),c(1,1,0),u),v),l(l(c(0,0,1),c(1,0,1),u),l(c(0,1,1),c(1,1,1),u),v),w);
}
const cache=new Map<string,THREE.BufferGeometry>();
// A unit leaf mass (radius ~1 round the origin): `rough` = how deep the lumps go, `seed`
// varies the pattern (a few seeds are enough: instances are also scaled and turned).
// UVs wrap the leaf texture `tiles` times round it.
export function leafMass(seed=1,rough=.22,detail=3,tiles=3):THREE.BufferGeometry{
  const key=`${seed}:${rough}:${detail}:${tiles}`;
  const hit=cache.get(key);if(hit)return hit;
  let g:THREE.BufferGeometry=new THREE.IcosahedronGeometry(1,detail);
  g.deleteAttribute('normal');g.deleteAttribute('uv');
  g=mergeVertices(g);
  const p=g.getAttribute('position') as THREE.BufferAttribute,uv=new Float32Array(p.count*2),o=seed*17.3;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const n=noise(x*2.1+o,y*2.1,z*2.1)*.65+noise(x*4.7,y*4.7+o,z*4.7)*.35;   // 0..1
    const k=1+(n-.55)*2*rough;
    p.setXYZ(i,x*k,y*k,z*k);
    uv[i*2]=(Math.atan2(z,x)/(Math.PI*2)+.5)*tiles;uv[i*2+1]=(y*.5+.5)*tiles*.6;
  }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  g.computeVertexNormals();g.computeBoundingSphere();
  cache.set(key,g);
  return g;
}
