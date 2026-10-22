import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {tileTerrainMesh,coarseTerrainGeometry,enableTerrainLod,updateTerrainLod,type TerrainGrid} from '../../src/assets/models/divinolandia/terrain-tiles.ts';

const grid:TerrainGrid={x0:100,z0:200,cell:8,nx:9,nz:9};
function geometry(height=(i:number,j:number)=>i*.5+j*.25,skip=(i:number,j:number)=>i===-1&&j===-1):THREE.BufferGeometry{
  const p:number[]=[],uv:number[]=[],colors:number[]=[],index:number[]=[];
  for(let j=0;j<grid.nz;j++)for(let i=0;i<grid.nx;i++){
    p.push(grid.x0+i*grid.cell,height(i,j)-1.2,grid.z0+j*grid.cell);uv.push(i/3,j/3);colors.push(i/9,j/9,.4);
  }
  for(let j=0;j<grid.nz-1;j++)for(let i=0;i<grid.nx-1;i++){
    if(skip(i,j))continue;
    const a=j*grid.nx+i;index.push(a,a+grid.nx,a+1,a+1,a+grid.nx,a+grid.nx+1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(index);g.computeVertexNormals();return g;
}
function triangleValues(g:THREE.BufferGeometry):string[]{
  const p=g.getAttribute('position'),index=g.getIndex()!,out:string[]=[];
  for(let i=0;i<index.count;i+=3)out.push([0,1,2].map(k=>{const v=index.getX(i+k);return[p.getX(v),p.getY(v),p.getZ(v)].join(',');}).join(';'));
  return out.sort();
}
function area(g:THREE.BufferGeometry):number{
  const p=g.getAttribute('position'),index=g.getIndex()!;let total=0;
  for(let i=0;i<index.count;i+=3){
    const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
    const signed=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));
    expect(signed).toBeGreaterThan(0);total+=signed/2;
  }
  return total;
}
function edges(g:THREE.BufferGeometry):string[]{
  const p=g.getAttribute('position'),index=g.getIndex()!,counts=new Map<string,number>();
  for(let i=0;i<index.count;i+=3)for(let e=0;e<3;e++){
    const key=[index.getX(i+e),index.getX(i+(e+1)%3)].map(v=>[p.getX(v),p.getY(v),p.getZ(v)].join(',')).sort().join(';');
    counts.set(key,(counts.get(key)??0)+1);
  }
  return[...counts].filter(([,n])=>n===1).map(([key])=>key).sort();
}

describe('terrain tiling and far LOD',()=>{
  it('partitions every original indexed triangle exactly once, retaining all attributes and bounds',()=>{
    const source=geometry((i,j)=>Math.sin(i)*Math.cos(j)*4),mesh=new THREE.Mesh(source,new THREE.MeshBasicMaterial());mesh.receiveShadow=true;
    const tiles=tileTerrainMesh(mesh,grid,32),values:string[]=[];
    expect(tiles.children).toHaveLength(4);
    for(const child of tiles.children){
      const tile=child as THREE.Mesh,p=tile.geometry.getAttribute('position');
      expect(tile.receiveShadow).toBe(true);expect(tile.geometry.boundingSphere).not.toBeNull();
      expect(tile.geometry.index!.array).toBeInstanceOf(Uint16Array);
      values.push(...triangleValues(tile.geometry));
      for(let v=0;v<p.count;v++){
        const i=Math.round((p.getX(v)-grid.x0)/grid.cell),j=Math.round((p.getZ(v)-grid.z0)/grid.cell),original=j*grid.nx+i;
        for(const name of ['position','normal','color','uv']){
          const attr=source.getAttribute(name) as THREE.BufferAttribute,copy=tile.geometry.getAttribute(name) as THREE.BufferAttribute;
          for(let c=0;c<attr.itemSize;c++)expect(copy.getComponent(v,c)).toBe(attr.getComponent(original,c));
        }
      }
    }
    expect(values.sort()).toEqual(triangleValues(source));
  });
  it('halves planar triangles with the same winding, area, edge segments and sampled height',()=>{
    const fine=geometry(),coarse=coarseTerrainGeometry(fine,grid,4,.001),p=coarse.getAttribute('position');
    expect(coarse.index!.count).toBe(fine.index!.count/2);
    expect(area(coarse)).toBe(area(fine));expect(edges(coarse)).toEqual(edges(fine));
    for(let i=0;i<p.count;i++)expect(p.getY(i)).toBeCloseTo((p.getX(i)-100)/16+(p.getZ(i)-200)/32-1.2,5);
  });
  it('preserves missing cells and rejects rough blocks exceeding the error limit',()=>{
    const hole=geometry(undefined,(i,j)=>i===1&&j===2),coarse=coarseTerrainGeometry(hole,grid,4,.01);
    expect(area(coarse)).toBe(area(hole));expect(edges(coarse)).toEqual(edges(hole));
    const rough=geometry((i,j)=>i%4===2&&j%4===2?20:0),retained=coarseTerrainGeometry(rough,grid,4,1);
    expect(triangleValues(retained)).toEqual(triangleValues(rough));
  });
  it('changes only opted-in far tiles based on camera distance, with hysteresis',()=>{
    const tiles=tileTerrainMesh(new THREE.Mesh(geometry()),grid,32),first=tiles.children[0] as THREE.Mesh,fine=first.geometry;
    updateTerrainLod(tiles,new THREE.Vector3(10000,0,10000));expect(first.geometry).toBe(fine);
    enableTerrainLod(tiles,grid,{distance:100});
    updateTerrainLod(tiles,new THREE.Vector3(10000,0,10000));expect(first.geometry.index!.count).toBe(fine.index!.count/2);
    updateTerrainLod(tiles,new THREE.Vector3(grid.x0,10000,grid.z0));expect(first.geometry).toBe(fine);
  });
  it.each(['fine','coarse'])('disposing the active %s geometry releases both LOD buffers exactly once',active=>{
    const tiles=tileTerrainMesh(new THREE.Mesh(geometry()),grid,32),first=tiles.children[0] as THREE.Mesh,fine=first.geometry;
    enableTerrainLod(tiles,grid,{distance:100});
    updateTerrainLod(tiles,new THREE.Vector3(10000,0,10000));
    const coarse=first.geometry;let fineDisposals=0,coarseDisposals=0;
    fine.addEventListener('dispose',()=>fineDisposals++);
    coarse.addEventListener('dispose',()=>coarseDisposals++);
    if(active==='fine')updateTerrainLod(tiles,new THREE.Vector3(grid.x0,0,grid.z0));
    first.geometry.dispose();
    expect(fineDisposals).toBe(1);expect(coarseDisposals).toBe(1);
  });
});
