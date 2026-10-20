import * as THREE from 'three';
import {matte} from '../matte.ts';

// Shared instanced utility pole for the unsurveyed town streets. The surveyed José
// Augusto Machado street keeps its individually placed poles and service drops.
const concreteM=matte({color:0xb8b4ab}),armM=matte({color:0x8d9196});
const porcelainM=matte({color:0xe9e6df}),cabinetM=matte({color:0x353739});
export const posteLampMat=new THREE.MeshBasicMaterial({color:0xffd9a0});
const POLE_HEIGHT=10.5;
const poleG=new THREE.CylinderGeometry(.11,.18,POLE_HEIGHT,8);poleG.translate(0,POLE_HEIGHT/2,0);
const crossarmG=new THREE.BoxGeometry(2.2,.12,.12);crossarmG.translate(0,10.12,0);
const insulatorG=new THREE.CylinderGeometry(.07,.09,.24,8);
const rackG=new THREE.BoxGeometry(.08,.88,.08);rackG.translate(0,8.25,.2);
const cabinetG=new THREE.BoxGeometry(.27,.4,.18);cabinetG.translate(0,6.6,.2);
const armG=new THREE.BoxGeometry(.08,.08,2.35);armG.translate(0,7.82,1.18);
const headG=new THREE.BoxGeometry(.38,.16,.7);headG.translate(0,7.73,2.2);
const lampG=new THREE.BoxGeometry(.3,.025,.58);lampG.translate(0,7.63,2.2);
const transformerG=new THREE.CylinderGeometry(.35,.35,1,10);transformerG.translate(0,8.65,-.52);
const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_s=new THREE.Vector3(1,1,1),_p=new THREE.Vector3(),_up=new THREE.Vector3(0,1,0);
export type StreetPole={x:number;y:number;z:number;r:number};

function instances(geometry:THREE.BufferGeometry,material:THREE.Material,list:StreetPole[]):THREE.InstancedMesh{
  const mesh=new THREE.InstancedMesh(geometry,material,list.length);
  list.forEach((site,index)=>{
    _q.setFromAxisAngle(_up,site.r);_p.set(site.x,site.y,site.z);
    mesh.setMatrixAt(index,_m.compose(_p,_q,_s));
  });
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;
  return mesh;
}

export function makePostes(list:StreetPole[]):THREE.Group{
  const g=new THREE.Group();
  if(!list.length)return g;
  for(const [geometry,material] of [
    [poleG,concreteM],[crossarmG,armM],[rackG,armM],[cabinetG,cabinetM],
    [armG,armM],[headG,armM],[lampG,posteLampMat],
  ] as [THREE.BufferGeometry,THREE.Material][])g.add(instances(geometry,material,list));
  for(const offset of [-.95,0,.95]){
    const geometry=insulatorG.clone();geometry.translate(offset,10.36,0);
    g.add(instances(geometry,porcelainM,list));
  }
  const transformers=list.filter((_,index)=>index%19===5);
  if(transformers.length)g.add(instances(transformerG,armM,transformers));
  return g;
}

const wireM=new THREE.LineBasicMaterial({color:0x242428});
const WIRE_ATTACH=[[-.95,10.34],[0,10.34],[.95,10.34],[0,8.35],[0,7.95]] as const;
const MAX_WIRE_SPAN=65;

export function makePoleWires(routes:StreetPole[][]):THREE.LineSegments{
  const vertices:number[]=[];
  const attach=(pole:StreetPole,offset:number,height:number):[number,number,number]=>[
    pole.x+offset*Math.cos(pole.r),pole.y+height,pole.z-offset*Math.sin(pole.r),
  ];
  const span=(start:[number,number,number],end:[number,number,number],sag:number):void=>{
    let previous=start;
    for(let step=1;step<=8;step++){
      const fraction=step/8,drop=sag*4*fraction*(1-fraction);
      const next:[number,number,number]=[
        start[0]+(end[0]-start[0])*fraction,
        start[1]+(end[1]-start[1])*fraction-drop,
        start[2]+(end[2]-start[2])*fraction,
      ];
      vertices.push(...previous,...next);previous=next;
    }
  };
  for(const route of routes)for(let i=1;i<route.length;i++){
    const previous=route[i-1],current=route[i];
    const distance=Math.hypot(current.x-previous.x,current.z-previous.z);
    if(distance>MAX_WIRE_SPAN)continue;
    for(const [offset,height] of WIRE_ATTACH){
      span(attach(previous,offset,height),attach(current,offset,height),.32+distance*.012);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  return new THREE.LineSegments(geometry,wireM);
}
function build():THREE.Group{
  const g=makePostes([{x:0,y:0,z:0,r:0}]);g.traverse(o=>{o.matrixAutoUpdate=true;});return g;
}
export default {category:'Divinolândia',label:'Poste de rua',build};
