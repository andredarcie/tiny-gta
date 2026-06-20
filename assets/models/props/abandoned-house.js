import * as THREE from 'three';
import {matte} from '../matte.js';
import {bakeProp} from './prop-merge.js';
import {rand,pick} from '../../../js/constants.js';

// Derelict country house: a weathered shack with a CAVED-IN roof, boarded-up
// windows, a door hanging off its hinges and planks strewn around the base — the
// "abandoned" look the cheerful farm-house prop couldn't sell. Pure primitives,
// merged into the prop chunks by bakeProp (one model per file, like the rest).

const wallCols=[0x8f8470,0x97897a,0x837a68,0x9a8d76]; // greyed, sun-bleached planks
const roofCols=[0x5e5444,0x6a5d49,0x564c3d];          // faded, mossy shingles
const wallMats=new Map(),roofMats=new Map();
const matFor=(map,c)=>{if(!map.has(c))map.set(c,matte({color:c,roughness:1}));return map.get(c);};
const darkM=matte({color:0x44392b,roughness:1});      // weathered dark wood: boards, rafters, door
const voidM=matte({color:0x14181c,roughness:1});      // black window/door openings

const mk=(w,h,d,mat,x,y,z,rx,ry,rz)=>{
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  m.position.set(x,y,z);if(rx||ry||rz)m.rotation.set(rx||0,ry||0,rz||0);
  m.castShadow=true;m.receiveShadow=true;return m;
};

// boarded-up window: a black opening with two planks nailed across it
function boardedWindow(g,x,y,z){
  g.add(mk(.7,.7,.06,voidM,x,y,z));
  g.add(mk(.95,.13,.05,darkM,x,y,z+.02,0,0,.5));
  g.add(mk(.95,.13,.05,darkM,x,y,z+.02,0,0,-.5));
}

function build(){
  const g=new THREE.Group();
  const bw=rand(4.6,5.6),bd=rand(3.8,4.8),bh=rand(2.5,3.0);
  const wallM=matFor(wallMats,pick(wallCols)),roofM=matFor(roofMats,pick(roofCols));

  // ---- weathered plank body + a few darker boards/gaps on the front ----
  g.add(mk(bw,bh,bd,wallM,0,bh/2,0));
  for(let i=0;i<5;i++)
    g.add(mk(.06,bh*.92,.04,darkM,-bw/2+(i+.5)*(bw/5),bh*.5,bd/2+.02));
  // a sill/foundation beam
  g.add(mk(bw+.12,.22,bd+.12,darkM,0,.11,0));

  // ---- caved-in gable roof: left slope hangs on, right slope collapsed ----
  const RISE=1.6,OVER=.35,eaveY=bh;
  const half=bw/2+OVER,slope=Math.hypot(half,RISE),ang=Math.atan2(RISE,half);
  g.add(mk(.14,.14,bd+OVER*2,darkM,0,eaveY+RISE,0));                       // ridge beam
  g.add(mk(slope,.16,bd+OVER*2,roofM,-half/2,eaveY+RISE/2,0,0,0,ang));     // LEFT slope (intact-ish)
  // RIGHT slope: only the back ~55% still there, sagged lower
  const rcov=bd*.55;
  g.add(mk(slope*.9,.16,rcov,roofM,half/2*.92,eaveY+RISE/2-.22,bd/2-rcov/2+OVER,0,0,-ang*.82));
  // exposed rafters where the front-right roof is gone
  for(let i=0;i<3;i++)
    g.add(mk(slope*.88,.07,.07,darkM,half/2,eaveY+RISE/2,-bd/2+.45+i*.55,0,0,-ang));
  // back gable triangle (front gable left open = caved in)
  const gable=new THREE.Shape();
  gable.moveTo(-bw/2,0);gable.lineTo(bw/2,0);gable.lineTo(0,RISE);gable.closePath();
  const tri=new THREE.Mesh(new THREE.ShapeGeometry(gable),wallM);
  tri.position.set(0,eaveY,bd/2);tri.castShadow=true;g.add(tri);

  // ---- boarded windows + a door hanging off its hinge ----
  boardedWindow(g,-bw/4,bh*.55,bd/2+.04);
  boardedWindow(g, bw/4,bh*.55,bd/2+.04);
  const dx=rand(-bw/5,bw/5);
  g.add(mk(.95,1.75,.1,voidM,dx,.88,bd/2+.02));        // dark doorway
  g.add(mk(.82,1.6,.08,darkM,dx-.5,.82,bd/2+.22,0,.7,.08)); // door swung open + leaning

  // ---- debris: a few fallen planks scattered out front ----
  for(let i=0;i<4;i++)
    g.add(mk(rand(.8,1.5),.06,.16,darkM,rand(-bw/2,bw/2),.05,bd/2+rand(.3,1.4),0,rand(0,Math.PI),0));

  g.userData.r=Math.max(bw,bd)/2+.3;
  g.userData.h=bh+RISE+.4;
  return g;
}

export default {category:'Props',label:'Abandoned house',build};

export function addAbandonedHouse(cx,cz,ry){
  const g=build();
  g.position.set(cx,-.02,cz);g.rotation.y=ry;bakeProp(g);
  const r=g.userData.r;
  return{x0:cx-r,x1:cx+r,z0:cz-r,z1:cz+r,h:g.userData.h};
}
