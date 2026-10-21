import * as THREE from 'three';
import {matte} from '../matte.ts';

// The grow-op's galvanized WATER BUCKET — the one the player picks up at the standpipe,
// carries in first person, fills and tips over the beds. Its water is live:
// userData.setWater(f) raises/lowers the surface (0 = empty, 1 = brim), following the
// bucket's taper so the disc always touches the walls. The walls are double-sided so
// the inside (and the water level) reads when you look down into it.
//
// Origin = the top of the carrying bail, so it hangs from a fist. userData.lip marks the
// front rim point water pours from (tipping the bucket forward, toward -Z).

const R_TOP=.15,R_BOT=.115,H=.26,TOP_Y=-.02,BOT_Y=TOP_Y-H;

const outsideM=matte({color:0xb4b9bf});                        // galvanized steel
const insideM=matte({color:0x7d848c,side:THREE.BackSide});     // darker inner wall
const rimM=matte({color:0x5f6a72});
const waterM=new THREE.MeshLambertMaterial({color:0x3f8fd8,emissive:0x0c2a4a,
  transparent:true,opacity:.86});

export function makeFarmBucket(): THREE.Group{
  const g=new THREE.Group();
  const mid=(TOP_Y+BOT_Y)/2;
  const shell=new THREE.CylinderGeometry(R_TOP,R_BOT,H,16,1,true);
  const outer=new THREE.Mesh(shell,outsideM);outer.position.y=mid;outer.castShadow=true;g.add(outer);
  const inner=new THREE.Mesh(shell,insideM);inner.position.y=mid;inner.scale.setScalar(.985);g.add(inner);
  const bottom=new THREE.Mesh(new THREE.CylinderGeometry(R_BOT,R_BOT,.02,16),outsideM);
  bottom.position.y=BOT_Y;g.add(bottom);
  const rim=new THREE.Mesh(new THREE.TorusGeometry(R_TOP,.014,6,20),rimM);
  rim.rotation.x=Math.PI/2;rim.position.y=TOP_Y;g.add(rim);
  // the bail: a wire arc over the rim + its two ear lugs
  const bail=new THREE.Mesh(new THREE.TorusGeometry(R_TOP,.01,6,16,Math.PI),rimM);
  bail.position.y=TOP_Y;bail.scale.y=1.05;g.add(bail);
  for(const sx of[-1,1]){
    const ear=new THREE.Mesh(new THREE.BoxGeometry(.02,.05,.04),rimM);
    ear.position.set(sx*R_TOP,TOP_Y-.02,0);g.add(ear);
  }
  // water: a disc whose height/radius follow the fill level
  const water=new THREE.Mesh(new THREE.CircleGeometry(1,20),waterM);
  water.rotation.x=-Math.PI/2;water.visible=false;g.add(water);
  const setWater=(f: number)=>{
    const k=Math.max(0,Math.min(1,f));
    water.visible=k>.02;
    const y=BOT_Y+.012+k*(H-.035);
    water.position.y=y;
    water.scale.setScalar((R_BOT+(R_TOP-R_BOT)*((y-BOT_Y)/H))*.97);
    g.userData.water=k;
  };
  setWater(0);
  const lip=new THREE.Object3D();lip.position.set(0,TOP_Y,-R_TOP);g.add(lip);
  g.userData.setWater=setWater;
  g.userData.lip=lip;
  g.userData.rim={r:R_TOP,y:TOP_Y};
  g.userData.waterMesh=water;
  return g;
}

export default {category:'Rural',label:'Farm bucket',build:()=>{const b=makeFarmBucket();b.userData.setWater(.7);return b;},zoom:2.4};
