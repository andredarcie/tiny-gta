import * as THREE from 'three';
import {matte} from '../matte.ts';
import {telhaTexture,ROOF_TILE_M} from '../divinolandia/texturas.ts';

// Coreto (bandstand) of the Praça Dr. Alcindo Cardoso de Paiva, Divinolândia — rebuilt
// from Street View (panorama on the street east of the square, heading 270): an octagon
// ~7.4 m across on a tall white base (~1.3 m) pierced by a band of cobogó vents, a short
// flight of steps on one face, eight slim white columns, a white ornamental lattice
// balustrade between them, a deep white fascia band with a white soffit under the eaves,
// and a low octagonal pyramid of clay tiles with a small finial. build() is pure: the
// steps face +z, origin on the ground at the centre (the base runs 1 m below ground so the
// coreto can stand on a slope).
const whiteM=matte({color:0xf1eee7}),soffitM=matte({color:0xf4f2ec,emissive:0x3b3a37,side:THREE.DoubleSide});
const ventM=matte({color:0x8f8a80}),floorM=matte({color:0xd9d2c4}),stepM=matte({color:0xc9c3b6});
const latticeM=matte({color:0xf4f2ec,map:latticeTexture(),transparent:true,alphaTest:.5,side:THREE.DoubleSide});
const roofM=matte({color:0xd99a74,map:telhaTexture(),side:THREE.DoubleSide}),finialM=matte({color:0xcfc6b6});

const R=3.7;            // circumradius of the column octagon
const BASE=1.3;         // floor level
const COL_H=2.7;        // column height
const ENTRY=2;          // face index of the entrance (toward +z): steps, no balustrade

// white ornamental lattice ("rendado") of the balustrade: rings and diagonals, alpha cut-out
function latticeTexture():THREE.Texture{
  if(typeof document==='undefined')return new THREE.Texture();
  const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d')!;
  x.clearRect(0,0,128,64);x.strokeStyle='#fff';x.lineWidth=5;
  x.strokeRect(2,2,124,60);
  for(let i=0;i<4;i++){x.beginPath();x.arc(16+i*32,32,12,0,Math.PI*2);x.stroke();x.beginPath();x.moveTo(i*32,2);x.lineTo(i*32+32,62);x.moveTo(i*32+32,2);x.lineTo(i*32,62);x.stroke();}
  const t=new THREE.CanvasTexture(c);t.wrapS=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;
}

function build(): THREE.Group {
  const g=new THREE.Group();
  const oct=(r:number,h:number,y:number,m:THREE.Material,open=false):THREE.Mesh=>{
    const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,8,1,open),m);o.position.y=y;o.rotation.y=Math.PI/8;g.add(o);return o;
  };
  // the base: white octagonal drum from below ground up to the floor, cobogó vent band
  const base=oct(R+.3,BASE+1,(BASE-1)/2,whiteM);base.castShadow=true;base.receiveShadow=true;
  const side=2*(R+.3)*Math.sin(Math.PI/8),ap=(R+.3)*Math.cos(Math.PI/8);
  for(let k=0;k<8;k++){
    if(k===ENTRY)continue;
    const a=k*Math.PI/4,v=new THREE.Mesh(new THREE.PlaneGeometry(side*.7,.32),ventM);
    v.position.set(Math.cos(a)*(ap+.01),.62,Math.sin(a)*(ap+.01));v.rotation.y=-a+Math.PI/2;g.add(v);
    for(let i=1;i<7;i++){const b=new THREE.Mesh(new THREE.BoxGeometry(.05,.32,.03),whiteM);const t=(i/7-.5)*side*.7;
      b.position.set(Math.cos(a)*(ap+.02)-Math.sin(a)*t,.62,Math.sin(a)*(ap+.02)+Math.cos(a)*t);b.rotation.y=-a+Math.PI/2;g.add(b);}
  }
  const cap=oct(R+.42,.12,BASE-.04,whiteM);cap.receiveShadow=true;
  oct(R+.25,.04,BASE+.03,floorM);
  // steps on the entrance face
  for(let s=0;s<4;s++){const st=new THREE.Mesh(new THREE.BoxGeometry(2.1,BASE-s*BASE/4,.42),stepM);st.position.set(0,(BASE-s*BASE/4)/2,ap+.2+s*.42);g.add(st);}
  // eight columns at the octagon's vertices
  for(let k=0;k<8;k++){
    const a=Math.PI/8+k*Math.PI/4,col=new THREE.Mesh(new THREE.CylinderGeometry(.09,.1,COL_H,10),whiteM);
    col.position.set(Math.cos(a)*R,BASE+COL_H/2,Math.sin(a)*R);col.castShadow=true;g.add(col);
  }
  // lattice balustrade on every face but the entrance: lattice panel, top rail, bottom rail
  const fl=2*R*Math.sin(Math.PI/8),aR=R*Math.cos(Math.PI/8);
  for(let k=0;k<8;k++){
    if(k===ENTRY)continue;
    const a=k*Math.PI/4,cx=Math.cos(a)*aR,cz=Math.sin(a)*aR,ry=-a+Math.PI/2;
    const p=new THREE.Mesh(new THREE.PlaneGeometry(fl-.2,.78),latticeM);p.position.set(cx,BASE+.47,cz);p.rotation.y=ry;
    const pu=p.geometry.getAttribute('uv') as THREE.BufferAttribute;for(let i=0;i<pu.count;i++)pu.setX(i,pu.getX(i)*2);
    g.add(p);
    for(const[y,h]of[[BASE+.9,.1],[BASE+.06,.1]] as [number,number][]){const r=new THREE.Mesh(new THREE.BoxGeometry(fl-.15,h,.12),whiteM);r.position.set(cx,y,cz);r.rotation.y=ry;g.add(r);}
  }
  // eaves: the deep white fascia band, the soffit, the clay pyramid, the finial
  const eaveY=BASE+COL_H;
  oct(R+.15,.18,eaveY+.02,whiteM);
  const fascia=oct(R+.95,.45,eaveY+.3,whiteM,true);fascia.castShadow=true;
  const sof=new THREE.Mesh(new THREE.CircleGeometry(R+.95,8),soffitM);sof.rotation.x=Math.PI/2;sof.rotation.z=Math.PI/8;sof.position.y=eaveY+.08;g.add(sof);
  const rise=1.9,rr=R+1.05,roof=new THREE.Mesh(new THREE.ConeGeometry(rr,rise,8,1,true),roofM);
  const uv=roof.geometry.getAttribute('uv') as THREE.BufferAttribute;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*2*Math.PI*rr/ROOF_TILE_M/2,uv.getY(i)*Math.hypot(rr,rise)/ROOF_TILE_M);
  roof.position.y=eaveY+.52+rise/2;roof.rotation.y=Math.PI/8;roof.castShadow=true;g.add(roof);
  const fin=new THREE.Mesh(new THREE.SphereGeometry(.13,8,6),finialM);fin.position.y=eaveY+.52+rise+.08;g.add(fin);
  const spike=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.45,6),finialM);spike.position.y=eaveY+.52+rise+.3;g.add(spike);
  g.userData.r=R+1.1;g.userData.h=eaveY+.52+rise+.5;
  return g;
}
export const CORETO_R=R+.42;
export default {category:'Divinolândia',label:'Coreto da Praça da Matriz',build};
