import * as THREE from 'three';
import {matte} from '../matte.ts';
import {DIVINO} from '@/core/palette.ts';
import {Kit,P,plain,tile,holedWall,holeOf,fillOpening,dirt,solarHeater,type Op} from './kit-fachada.ts';
import {corrugatedTexture} from './texturas.ts';
import {side,hip,type Kits,type Side} from './hospital-regional.ts';

// Hospital Regional — the modern ANNEX west of the old sanatorium, from the satellite
// footprint and the Street View panorama on the road below it (bNbFYXBmmu_BBNq5FqNL4A):
// a long L in pale beige render with a brown fascia band under low hipped roofs
// of light metal sheet (the white "L" seen from above), a row of skylights along the
// north–south arm, solar water heaters on the ridge; the west arm, stepping down the
// slope to the road, shows two storeys there; a lower wing with a grey metal roof
// tucked into the inside of the L, and a small clay-tiled block with solar panels at the
// south end. Built in the SAME frame as hospital-regional.ts (origin at the sanatorium's
// tower, +z = the veranda front) and placed at the same origin, on its own levelled lot
// (sites-table.ts `hospitalAnnex`; ANNEX_LOT is that lot's centre in this frame).
export const ANNEX_LOT={x:90,z:-25};
const H=4.6,H2=7.0,HW=4.0,BASE=.5;
export const ANNEX_FOOT:[number,number,number,number,number][]=[
  [105,10.5,50,17,H2],            // west arm
  [75.5,-17.5,19,89,H],           // north–south arm
  [92,-19,14,42,HW],              // grey wing inside the L
  [65,-69.5,20,15,H],             // tiled block at the south end
];

const C=DIVINO;
let roofMat:THREE.Material|null=null;
const metalM=():THREE.Material=>roofMat??=matte({color:C.annexRoof,map:corrugatedTexture(),side:THREE.DoubleSide});

function wall(k:Kit,a:number,b:number,h:number,ops:Op[]):void{
  const m=P(C.annexWall);
  holedWall(k,m,a,b,BASE,h,0,ops.map(holeOf));
  for(const o of ops)fillOpening(k,o,0,m);
  holedWall(k,P('#a99f88'),a,b,0,BASE,0,[]);
  k.box(plain(C.annexFascia),a,b,h-.45,h,0,.06);                       // the brown band under the eave
  dirt(k,a,b,0,.8,0);
}
// dark sliding windows in brown frames, one per `step` m; every third gets a metal awning
function windows(a:number,b:number,step=3.2,y=1.4):Op[]{
  const ops:Op[]=[],n=Math.max(1,Math.floor((b-a)/step)),s=(b-a)/n;
  for(let i=0;i<n;i++)ops.push({t:'window',x:a+s*(i+.5),w:1.7,h:1.25,y,frame:C.annexFascia,awning:i%3===1?'#b9bcbe':undefined});
  return ops;
}
function block(kits:Kits,x0:number,x1:number,z0:number,z1:number,h:number,sides:Side[]):void{
  for(const s of sides){const q=side(kits,s,x0,x1,z0,z1);
    wall(q.k,q.a,q.b,h,h>6?[...windows(q.a,q.b,3.2,1.1),...windows(q.a,q.b,3.2,4.2)]:windows(q.a,q.b));}
}

function build():THREE.Group{
  const g=new THREE.Group(),kits:Kits=[];
  const site=new Kit();kits.push(site);
  // west arm: x 80..130, z 2..19
  block(kits,80,130,2,19,H2,['n','s','px']);
  hip(site,metalM(),80,130,2,19,H2,1.7,.8,null,C.annexFascia,'#ece8dc');
  for(let i=0;i<5;i++)solarHeater(site,96+i*4.2,H2+1.25,10.2,.25);
  // north–south arm: x 66..85, z -62..27
  block(kits,66,85,-62,27,H,['n','s','nx']);
  // its west face shows only north of the west arm and south of the grey wing (local x = -z)
  {const q=side(kits,'px',66,85,-62,27);wall(q.k,q.a,-19,H,windows(q.a,-19));}
  {const q=side(kits,'px',66,85,-62,27);wall(q.k,40,q.b,H,windows(40,q.b));}
  hip(site,metalM(),66,85,-62,27,H,1.9,.8,null,C.annexFascia,'#ece8dc');
  for(let i=0;i<9;i++){const z=-50+i*7.5;site.box(plain('#d9dbdc'),74.3,76.7,H+1.75,H+1.95,z-1.6,z+1.6);site.box(plain('#55606a'),74.5,76.5,H+1.95,H+2.25,z-1.4,z+1.4);}
  // the grey-roofed wing inside the L
  block(kits,85,99,-40,2,HW,['s','px']);
  hip(site,plain(C.annexWing),85,99,-40,2,HW,1.3,.6,null,'#6f7376','#e2ded2');
  // clay-tiled block at the south end, solar panels on its west slope
  block(kits,55,75,-77,-62,H,['n','s','px','nx']);
  hip(site,tile(C.hospRoof),55,75,-77,-62,H,2.2,.7,plain(C.hospHip),C.hospTrim);
  {const pv=plain('#26344d');for(let i=0;i<4;i++)site.box(pv,68,73.5,H+.7+i*.12,H+.82+i*.12,-74+i*1.4,-72.8+i*1.4);}
  for(const k of kits)g.add(k.finish());
  g.userData.h=H+2;
  return g;
}
export default {category:'Divinolândia',label:'Hospital Regional (anexo)',build};
