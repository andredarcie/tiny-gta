import * as THREE from 'three';
import {matte} from '../matte.ts';
import {GROUND} from '@/core/palette.ts';
import {drapePolygon,type DrapeGrid} from './terreno.ts';

// Ground surfaces laid on the real terrain from OSM polygons: the paved town plazas
// (praças: Portuguese-stone paving + garden beds), grass greens, the football pitches
// (Estádio Municipal Armando Grespan and the neighbourhood fields) and the cemetery
// yard with its whitewashed wall and rows of tombs.
export const pavingMat=matte({color:0xd9d2c2,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
export const gardenMat=matte({color:GROUND.parkGrass,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
export const pitchMat=matte({color:0x4f9a45,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
export const yardMat=matte({color:0xbfb6a2,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
const wallM=matte({color:0xf0ece2}),tombM=matte({color:0xe6e2d8}),capM=matte({color:0x9a958c}),goalM=matte({color:0xf4f4f0});
type HAt=(x:number,z:number)=>number;
export type Surface='praca'|'verde'|'campo'|'estadio'|'cemiterio'|'escola';

// (lift: just under the street ribbons, so a street always shows over a plaza edge it crosses)
export function makeSurface(kind:Surface,pts:[number,number][],hAt:HAt,grid?:DrapeGrid):THREE.Mesh{
  const mat=kind==='praca'?pavingMat:kind==='verde'?gardenMat:kind==='campo'||kind==='estadio'?pitchMat:yardMat;
  const m=new THREE.Mesh(drapePolygon(pts,hAt,.13,4,grid),mat);
  m.receiveShadow=true;m.matrixAutoUpdate=false;
  return m;
}
// Garden bed (round) for the plaza: a low green disc.
export function makeGardenBed(r:number):THREE.Mesh{
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.3,14),gardenMat);m.position.y=.15;return m;
}
// Whitewashed wall along a closed polygon outline (cemetery), standing on the terrain, in
// pieces of up to 6 m; `open(x,z)` leaves a gap where a piece would stand across a street.
export function makeWall(pts:[number,number][],hAt:HAt,h=2.2,open?:(x:number,z:number)=>boolean):THREE.Group{
  const g=new THREE.Group();
  for(let i=0;i<pts.length;i++){
    const[ax,az]=pts[i],[bx,bz]=pts[(i+1)%pts.length],L=Math.hypot(bx-ax,bz-az);
    if(L<.5)continue;
    const n=Math.ceil(L/6);
    for(let k=0;k<n;k++){
      const x0=ax+(bx-ax)*k/n,z0=az+(bz-az)*k/n,x1=ax+(bx-ax)*(k+1)/n,z1=az+(bz-az)*(k+1)/n;
      if(open&&(open(x0,z0)||open(x1,z1)||open((x0+x1)/2,(z0+z1)/2)))continue;
      const y=Math.min(hAt(x0,z0),hAt(x1,z1)),top=Math.max(hAt(x0,z0),hAt(x1,z1))+h;
      const seg=new THREE.Mesh(new THREE.BoxGeometry(L/n+.25,top-y+.6,.3),wallM);
      seg.position.set((x0+x1)/2,(y-.6+top)/2,(z0+z1)/2);seg.rotation.y=-Math.atan2(z1-z0,x1-x0);
      seg.castShadow=true;g.add(seg);
    }
  }
  return g;
}
// One tomb (jazigo): plinth + slab + small cross. Local origin on the ground.
export function makeTomb():THREE.Group{
  const g=new THREE.Group();
  const b=new THREE.Mesh(new THREE.BoxGeometry(1.1,.7,2.2),tombM);b.position.y=.35;g.add(b);
  const s=new THREE.Mesh(new THREE.BoxGeometry(1.2,.08,2.3),capM);s.position.y=.74;g.add(s);
  const cv=new THREE.Mesh(new THREE.BoxGeometry(.1,.9,.1),tombM);cv.position.set(0,1.2,-.9);g.add(cv);
  const ch=new THREE.Mesh(new THREE.BoxGeometry(.5,.1,.1),tombM);ch.position.set(0,1.4,-.9);g.add(ch);
  return g;
}
// Football goal (trave), opening toward +z.
export function makeGoal():THREE.Group{
  const g=new THREE.Group();
  for(const x of[-3.66,3.66]){const p=new THREE.Mesh(new THREE.BoxGeometry(.12,2.44,.12),goalM);p.position.set(x,1.22,0);g.add(p);}
  const bar=new THREE.Mesh(new THREE.BoxGeometry(7.44,.12,.12),goalM);bar.position.y=2.44;g.add(bar);
  return g;
}

function build():THREE.Group{
  const g=new THREE.Group(),flat=():number=>0;
  g.add(makeSurface('praca',[[-12,-10],[12,-10],[12,10],[-12,10]],flat));
  const bed=makeGardenBed(3.5);bed.position.set(-5,.15,0);g.add(bed);
  const t=makeTomb();t.position.set(6,0,0);g.add(t);
  const goal=makeGoal();goal.position.set(0,0,-9);g.add(goal);
  g.traverse(o=>{o.matrixAutoUpdate=true;});
  return g;
}
export default {category:'Divinolândia',label:'Praça / campo / cemitério',build};
