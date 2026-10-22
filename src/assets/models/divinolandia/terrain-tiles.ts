import * as THREE from 'three';

export type TerrainGrid = {x0:number;z0:number;cell:number;nx:number;nz:number};

// Copy the original attributes rather than recomputing normals per tile: shared edges
// must retain exactly the shading and texture coordinates of the original surface.
function copyGeometry(source:THREE.BufferGeometry,indices:number[]):THREE.BufferGeometry {
  const vertices:number[]=[],local=new Map<number,number>();
  const index=indices.map(id=>{
    let n=local.get(id);
    if(n===undefined){n=vertices.length;local.set(id,n);vertices.push(id);}
    return n;
  });
  const geometry=new THREE.BufferGeometry();
  for(const name of Object.keys(source.attributes)){
    const attr=source.getAttribute(name) as THREE.BufferAttribute,array=new Float32Array(vertices.length*attr.itemSize);
    for(let i=0;i<vertices.length;i++)for(let c=0;c<attr.itemSize;c++)array[i*attr.itemSize+c]=attr.getComponent(vertices[i],c);
    geometry.setAttribute(name,new THREE.BufferAttribute(array,attr.itemSize,attr.normalized));
  }
  geometry.setIndex(index);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Partition an indexed terrain grid without changing any triangle or vertex value.
 * The source stays owned by the caller; tile geometries are independent copies. */
export function tileTerrainMesh(source:THREE.Mesh,g:TerrainGrid,tileSize=384):THREE.Group {
  const cells=Math.max(1,Math.round(tileSize/g.cell)),columns=Math.ceil((g.nx-1)/cells);
  const buckets=new Map<number,number[]>(),index=source.geometry.getIndex();
  if(!index)throw new Error('Terrain tiling requires indexed geometry');
  for(let k=0;k<index.count;k+=3){
    const a=index.getX(k),b=index.getX(k+1),c=index.getX(k+2);
    const i=Math.min(a%g.nx,b%g.nx,c%g.nx),j=Math.floor(Math.min(a,b,c)/g.nx);
    const key=Math.floor(j/cells)*columns+Math.floor(i/cells);
    let bucket=buckets.get(key);if(!bucket){bucket=[];buckets.set(key,bucket);}
    bucket.push(a,b,c);
  }
  const group=new THREE.Group();group.name='terrain-tiles';
  for(const [key,indices]of buckets){
    const mesh=new THREE.Mesh(copyGeometry(source.geometry,indices),source.material);
    mesh.name=`terrain-tile-${key%columns}-${Math.floor(key/columns)}`;
    mesh.receiveShadow=source.receiveShadow;mesh.castShadow=source.castShadow;
    mesh.renderOrder=source.renderOrder;mesh.matrixAutoUpdate=false;
    group.add(mesh);
  }
  return group;
}

type LodTile={mesh:THREE.Mesh;fine:THREE.BufferGeometry;coarse:THREE.BufferGeometry;box:THREE.Box3};
const lodTiles=new WeakMap<THREE.Group,{tiles:LodTile[];distance:number}>();

/** Keep every fine edge segment, including boundaries against higher-detail tiles.
 * Only complete blocks are simplified: hole boundaries retain their original cells.
 * Error is checked at all original grid vertices; both surfaces are piecewise linear. */
export function coarseTerrainGeometry(source:THREE.BufferGeometry,g:TerrainGrid,stride=4,maxError=6):THREE.BufferGeometry{
  if(!Number.isInteger(stride)||stride<2||stride%2!==0)throw new Error('Terrain LOD stride must be a positive even integer');
  const position=source.getAttribute('position'),index=source.getIndex();
  if(!index)throw new Error('Terrain LOD requires indexed geometry');
  const gridVertex=new Map<number,number>(),cells=new Map<number,number[]>();
  let i0=Infinity,j0=Infinity,i1=-Infinity,j1=-Infinity;
  for(let v=0;v<position.count;v++){
    const i=Math.round((position.getX(v)-g.x0)/g.cell),j=Math.round((position.getZ(v)-g.z0)/g.cell);
    gridVertex.set(j*g.nx+i,v);i0=Math.min(i0,i);j0=Math.min(j0,j);i1=Math.max(i1,i);j1=Math.max(j1,j);
  }
  for(let k=0;k<index.count;k+=3){
    const ids=[index.getX(k),index.getX(k+1),index.getX(k+2)];
    const i=Math.round((Math.min(...ids.map(v=>position.getX(v)))-g.x0)/g.cell);
    const j=Math.round((Math.min(...ids.map(v=>position.getZ(v)))-g.z0)/g.cell),key=j*g.nx+i;
    let values=cells.get(key);if(!values){values=[];cells.set(key,values);}values.push(...ids);
  }
  const output:number[]=[];
  const vertex=(i:number,j:number):number=>gridVertex.get(j*g.nx+i)!;
  for(let j=j0;j<j1;j+=stride)for(let i=i0;i<i1;i+=stride){
    const w=Math.min(stride,i1-i),h=Math.min(stride,j1-j),fine:number[]=[];
    let complete=w===stride&&h===stride;
    for(let z=j;z<j+h;z++)for(let x=i;x<i+w;x++){
      const values=cells.get(z*g.nx+x);if(values)fine.push(...values);
      if(values?.length!==6)complete=false;
    }
    if(!complete){output.push(...fine);continue;}
    const ring:number[]=[];
    for(let x=i;x<i+w;x++)ring.push(vertex(x,j));
    for(let z=j;z<j+h;z++)ring.push(vertex(i+w,z));
    for(let x=i+w;x>i;x--)ring.push(vertex(x,j+h));
    for(let z=j+h;z>j;z--)ring.push(vertex(i,z));
    const center=vertex(i+w/2,j+h/2),cx=position.getX(center),cz=position.getZ(center),cy=position.getY(center);
    let error=0;
    // A fan triangle lies within one angular sector from center to a fine edge.
    // Test every original vertex and edge crossing of both triangulations, below.
    const coarse:number[]=[];
    for(let n=0;n<ring.length;n++)coarse.push(center,ring[(n+1)%ring.length],ring[n]);
    const sampleError=(x:number,z:number,y:number):void=>{
      for(let n=0;n<ring.length;n++){
        const a=ring[n],b=ring[(n+1)%ring.length];
        const ax=position.getX(a)-cx,az=position.getZ(a)-cz,bx=position.getX(b)-cx,bz=position.getZ(b)-cz;
        const det=ax*bz-az*bx,u=((x-cx)*bz-(z-cz)*bx)/det,v=(ax*(z-cz)-az*(x-cx))/det;
        if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6){
          error=Math.max(error,Math.abs(y-(cy+u*(position.getY(a)-cy)+v*(position.getY(b)-cy))));return;
        }
      }
    };
    for(let z=j;z<=j+h;z++)for(let x=i;x<=i+w;x++){
      const v=vertex(x,z);sampleError(position.getX(v),position.getZ(v),position.getY(v));
    }
    // Fine-grid diagonals can intersect fan rays between vertices. Sample their
    // crossings too, which bounds the difference over the entire original surface.
    for(let n=0;n<ring.length;n++){
      const end=ring[n],dx=position.getX(end)-cx,dz=position.getZ(end)-cz;
      for(let k=0;k<fine.length;k+=3)for(let edge=0;edge<3;edge++){
        const a=fine[k+edge],b=fine[k+(edge+1)%3],ax=position.getX(a),az=position.getZ(a);
        const ex=position.getX(b)-ax,ez=position.getZ(b)-az,det=dx*ez-dz*ex;
        if(Math.abs(det)<1e-9)continue;
        const t=((ax-cx)*ez-(az-cz)*ex)/det,u=((ax-cx)*dz-(az-cz)*dx)/det;
        if(t>=0&&t<=1&&u>=0&&u<=1)sampleError(cx+t*dx,cz+t*dz,position.getY(a)+u*(position.getY(b)-position.getY(a)));
      }
    }
    output.push(...(error<=maxError?coarse:fine));
  }
  return copyGeometry(source,output);
}

/** Opt-in for non-playable far terrain only. Near terrain is never simplified. */
export function enableTerrainLod(group:THREE.Group,g:TerrainGrid,opts:{distance?:number;stride?:number;maxError?:number}={}):void{
  if(lodTiles.has(group))throw new Error('Terrain LOD already configured');
  const tiles:LodTile[]=[];
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    const fine=object.geometry,coarse=coarseTerrainGeometry(fine,g,opts.stride??4,opts.maxError??6);
    fine.computeBoundingBox();tiles.push({mesh:object,fine,coarse,box:fine.boundingBox!.clone()});
    // Scene disposal sees whichever resolution is currently attached to the mesh.
    // Release its counterpart once, removing both listeners before recursion.
    const disposeFine=():void=>{detach();coarse.dispose();};
    const disposeCoarse=():void=>{detach();fine.dispose();};
    const detach=():void=>{
      fine.removeEventListener('dispose',disposeFine);
      coarse.removeEventListener('dispose',disposeCoarse);
    };
    fine.addEventListener('dispose',disposeFine);
    coarse.addEventListener('dispose',disposeCoarse);
  });
  lodTiles.set(group,{tiles,distance:opts.distance??1800});
}

/** Switch with 10% hysteresis, using horizontal distance to the nearest tile edge. */
export function updateTerrainLod(group:THREE.Group,camera:THREE.Vector3):void{
  const state=lodTiles.get(group);if(!state)return;
  for(const tile of state.tiles){
    const dx=Math.max(tile.box.min.x-camera.x,0,camera.x-tile.box.max.x);
    const dz=Math.max(tile.box.min.z-camera.z,0,camera.z-tile.box.max.z),distance=Math.hypot(dx,dz);
    const threshold=state.distance*(tile.mesh.geometry===tile.coarse ? .9 : 1.1);
    tile.mesh.geometry=distance>threshold?tile.coarse:tile.fine;
  }
}
