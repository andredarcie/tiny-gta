import * as THREE from 'three';
import {matte} from '../matte.ts';

// Trimming SHEARS — the small spring snips growers use to manicure buds. Two steel blades
// on a pivot, two green rubber handle loops. Origin = the grip between the handles (where
// the fist holds them); the blades point down local -Z. userData.tip is the blade tip
// (what touches a leaf/bud stem) and userData.setOpen(0..1) opens/closes the blades.
const steelM=matte({color:0xc9ced6});
const edgeM=matte({color:0xeef1f5});
const gripM=matte({color:0x2f8f4e});
const pivotM=matte({color:0x5a6068});

export function makeTrimShears(): THREE.Group{
  const g=new THREE.Group();
  const pivot=new THREE.Group();pivot.position.set(0,0,-.06);g.add(pivot);
  const blades: THREE.Group[]=[];
  for(const side of [-1,1]){
    const b=new THREE.Group();
    const blade=new THREE.Mesh(new THREE.BoxGeometry(.012,.006,.09),steelM);
    blade.position.set(side*.004,0,-.045);b.add(blade);
    const edge=new THREE.Mesh(new THREE.BoxGeometry(.004,.0065,.085),edgeM);
    edge.position.set(-side*.003,0,-.046);b.add(edge);
    const tipM=new THREE.Mesh(new THREE.ConeGeometry(.006,.02,4),steelM);
    tipM.rotation.x=-Math.PI/2;tipM.position.set(side*.003,0,-.099);b.add(tipM);
    pivot.add(b);blades.push(b);
  }
  const screw=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,.014,8),pivotM);
  screw.rotation.x=Math.PI/2;pivot.add(screw);
  // handle loops behind the pivot
  for(const side of [-1,1]){
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.01,.008,.05),steelM);
    arm.position.set(side*.012,0,-.035);arm.rotation.y=side*.25;g.add(arm);
    const loop=new THREE.Mesh(new THREE.TorusGeometry(.022,.007,6,12),gripM);
    loop.rotation.x=Math.PI/2;loop.position.set(side*.024,0,0);g.add(loop);
  }
  const tip=new THREE.Object3D();tip.position.set(0,0,-.165);g.add(tip);
  g.userData.tip=tip;
  g.userData.setOpen=(k: number)=>{
    const a=Math.max(0,Math.min(1,k))*.38;
    blades[0].rotation.y=a;blades[1].rotation.y=-a;
  };
  g.userData.setOpen(0);
  return g;
}

export default {category:'Rural',label:'Trimming shears',build:()=>{const s=makeTrimShears();s.userData.setOpen(.6);return s;},zoom:5};
