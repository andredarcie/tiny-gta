import * as THREE from 'three';
import {DIVINO} from '@/core/palette.ts';
import {Kit,P,plain,tile,holedWall,holeOf,fillOpening,dirt,type Op} from './kit-fachada.ts';
import {ROOF_TILE_M} from './texturas.ts';
import placa from './placa.ts';
import arvore from './arvore-rua.ts';

// Hospital Regional de Divinolândia — the old Sanatório Adhemar de Barros (finished in
// 1945 for tuberculosis patients, run by the CONDERG consortium since 1987), rebuilt from
// the satellite footprint (Google/Esri imagery, ~0.14 m/px), the Street View panoramas
// around the grounds (Av. Leonor Mendes de Barros: BPh-DXXWFkFXAkepKIvuwg,
// meihIjfxKNEXbSPk1R6U3Q; images kept locally in docs/divinolandia/referencias-streetview/
// hosp-*/), the 1950 scale model in the hospital lobby and the 1945/2005 photos:
//   - the MAIN BLOCK, ~83 m long, five storeys under clay hipped roofs with white hip
//     flashing: the north front is all "varandas de cura" (the open cure verandas of a TB
//     sanatorium: a column grid, cream slab bands, parapets, French doors behind), the
//     back is plain render with grey steel window grids. West wing 15 m deep with a
//     flat-fronted bay by the tower, east wing 13 m with the verandas wrapping its east end;
//   - the ENTRANCE TOWER in the middle, one storey taller, with the stepped art-deco
//     crown, corner pilasters, three window columns and the flat porch canopy on columns
//     (the hospital's name on its fascia) over the steps and the glass doors;
//   - behind the tower the stair PAVILION and the octagonal ROTUNDA;
//   - the three-storey SOUTH-WEST WING at right angles to the back, the one-storey
//     service wing with its metal roof to the south-east, and the brick boiler CHIMNEY
//     at the east end.
// build() is pure. Frame: +z = the veranda front (north-north-west in the real town),
// +x = along the block toward its west end, origin on the ground at the tower's centre
// line. HOSP_FOOT are its collision boxes [cx, cz, w, d, height]; HOSP_LOT is the centre
// of its levelled lot (sites-table.ts `hospital`) in this frame; HOSP_DOOR_Z is the glass
// entrance (the street door of the game's hospital room, models/city/hospital.ts).
const ST=3.5,BASE=.6,VD=2.6;                    // storey height, raised ground floor, veranda depth
const top=(n:number):number=>BASE+n*ST;         // wall head of an n-storey block
const H5=top(5),H6=top(6);
export const HOSP_DOOR_Z=8.5;
export const HOSP_LOT={x:-8.5,z:-19};
export const HOSP_FOOT:[number,number,number,number,number][]=[
  [21,0,32,15,H5],                // west wing
  [-25.35,1,40.7,13,H5],          // east wing
  [0,.25,10,16.5,H6],             // tower (the porch in front stays walkable)
  [-2,-12,12,8,H5],               // stair pavilion
  [-4.6,-18.6,8.4,8.4,top(4)],    // rotunda
  [19,-22.75,20,30.5,top(3)],     // south-west wing
  [-13,-32.5,8,25,4.4],           // service wing
  [-13,-48.5,11,7,4.4],           // its end block
];

const C=DIVINO;
const wallM=():THREE.Material=>P(C.hospWall);
const baseM=():THREE.Material=>P(C.hospBase);
const trimM=():THREE.Material=>plain(C.hospTrim);
const tileM=():THREE.Material=>tile(C.hospRoof);
const hipM=():THREE.Material=>plain(C.hospHip);

export type Kits=Kit[];
// a façade face: a Kit standing on an edge of the plan, local x along the face, local +z out
export function face(kits:Kits,x:number,z:number,ry:number):Kit{
  const k=new Kit();k.g.position.set(x,0,z);k.g.rotation.y=ry;kits.push(k);return k;
}
// the four faces of a block x0..x1 × z0..z1, each with its local range along the face
export type Side='n'|'s'|'px'|'nx';
export function side(kits:Kits,s:Side,x0:number,x1:number,z0:number,z1:number):{k:Kit;a:number;b:number}{
  if(s==='n')return{k:face(kits,0,z1,0),a:x0,b:x1};
  if(s==='s')return{k:face(kits,0,z0,Math.PI),a:-x1,b:-x0};
  if(s==='px')return{k:face(kits,x1,0,Math.PI/2),a:-z1,b:-z0};
  return{k:face(kits,x0,0,-Math.PI/2),a:z0,b:z1};
}
// rendered wall a..b on the face plane, plinth band below the raised ground floor
function wall(k:Kit,a:number,b:number,h:number,ops:Op[],z=0):void{
  const m=wallM();
  holedWall(k,m,a,b,BASE,h,z,ops.map(holeOf));
  for(const o of ops)fillOpening(k,o,z,m);
  holedWall(k,baseM(),a,b,0,BASE,z,[]);
  dirt(k,a,b,0,.9,z);
}
// grey steel window grids, one per `step` m, on storeys f0..f1-1 (skip(x,f) leaves a gap)
function grid(a:number,b:number,f0:number,f1:number,step=3.5,skip?:(x:number,f:number)=>boolean,w=1.5,h=1.7):Op[]{
  const ops:Op[]=[],n=Math.max(1,Math.floor((b-a)/step)),s=(b-a)/n;
  for(let f=f0;f<f1;f++)for(let i=0;i<n;i++){
    const x=a+s*(i+.5);if(skip?.(x,f))continue;
    ops.push({t:'window',x,w,h,y:top(f)+.9,frame:C.hospFrame,st:'basculante'});
  }
  return ops;
}

// The cure verandas on a face kit, a..b along the face, column plane z=0, back wall at
// z=-VD with a French door per bay and storey; `floors` storeys, open colonnade at ground.
function verandas(k:Kit,a:number,b:number,floors:number):void{
  const H=top(floors),n=Math.max(1,Math.round((b-a)/3.55)),s=(b-a)/n;
  const ops:Op[]=[];
  for(let f=0;f<floors;f++)for(let i=0;i<n;i++)
    ops.push({t:'glass',x:a+s*(i+.5),w:1.5,h:2.35,y:top(f),frame:C.hospTrim});
  wall(k,a,b,H,ops,-VD);
  const w=wallM(),t=trimM();
  k.box(baseM(),a,b,0,BASE,-VD,.3);                                   // veranda floor on the plinth
  for(let f=1;f<floors;f++){
    const y=top(f);
    k.box(t,a,b,y-.24,y,-VD,.06);                                      // slab with its cream edge band
    for(let i=0;i<n;i++){                                              // parapet between the columns
      const x0=a+s*i+.28,x1=a+s*(i+1)-.28;
      k.box(w,x0,x1,y,y+1,-.16,0);k.box(t,x0-.02,x1+.02,y+1,y+1.08,-.2,.04);
    }
  }
  k.box(t,a,b,H-.5,H,-VD,.06);                                         // head beam under the eave
  for(let i=0;i<=n;i++){                                               // the column grid
    const x=a+s*i,hw=i===0||i===n?.32:.25;
    k.box(w,Math.max(a,x-hw),Math.min(b,x+hw),0,H-.5,-.5,0);
  }
  for(const x of[a,b])k.box(w,Math.max(a,x-.3),Math.min(b,x+.3),0,H,-VD,-.5);  // closed ends
}

// hipped roof over x0..x1 × z0..z1 with its eave at y: slopes in `m` (uv along the eave,
// up the slope), fascia + soffit, and optional caps along the hips and the ridge
export function hip(k:Kit,m:THREE.Material,x0:number,x1:number,z0:number,z1:number,y:number,rise:number,ov:number,capM:THREE.Material|null,fascia:string,soffit:string=C.hospTrim):number{
  const ax0=x0-ov,ax1=x1+ov,az0=z0-ov,az1=z1+ov,hw=(ax1-ax0)/2,hd=(az1-az0)/2,cx=(ax0+ax1)/2,cz=(az0+az1)/2;
  const along=hw>=hd,rr=Math.abs(hw-hd);
  type V=[number,number,number];
  const c0:V=[ax0,y,az0],c1:V=[ax1,y,az0],c2:V=[ax1,y,az1],c3:V=[ax0,y,az1];
  const r0:V=along?[cx-rr,y+rise,cz]:[cx,y+rise,cz-rr],r1:V=along?[cx+rr,y+rise,cz]:[cx,y+rise,cz+rr];
  const slope=(a:V,b:V,c:V,ea:V,eb:V):void=>{
    const e=new THREE.Vector3(eb[0]-ea[0],0,eb[2]-ea[2]).normalize(),o=new THREE.Vector3(...ea);
    const n=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]).cross(new THREE.Vector3(c[0]-a[0],c[1]-a[1],c[2]-a[2])).normalize();
    const up=new THREE.Vector3().crossVectors(n,e).normalize();
    const uv=(p:V):[number,number]=>{const d=new THREE.Vector3(...p).sub(o);return[d.dot(e)/ROOF_TILE_M,Math.abs(d.dot(up))/ROOF_TILE_M];};
    k.tri(m,a,b,c,uv(a),uv(b),uv(c));
  };
  // r0 sits by the low corners (c0/c3 when along x, c0/c1 when along z)
  if(along){slope(c3,c2,r1,c3,c2);slope(c3,r1,r0,c3,c2);slope(c1,c0,r0,c1,c0);slope(c1,r0,r1,c1,c0);slope(c0,c3,r0,c0,c3);slope(c2,c1,r1,c2,c1);}
  else{slope(c0,c3,r0,c0,c3);slope(c3,r1,r0,c0,c3);slope(c2,c1,r1,c2,c1);slope(c1,r0,r1,c2,c1);slope(c3,c2,r1,c3,c2);slope(c1,c0,r0,c1,c0);}
  if(capM){
    const cap=(a:V,b:V):void=>{
      const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),len=A.distanceTo(B);if(len<.05)return;
      const cyl=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,len,6),capM);
      cyl.position.copy(A).add(B).multiplyScalar(.5);cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());
      k.add(cyl);
    };
    cap(r0,r1);
    if(along){cap(c0,r0);cap(c3,r0);cap(c1,r1);cap(c2,r1);}else{cap(c0,r0);cap(c1,r0);cap(c2,r1);cap(c3,r1);}
  }
  // fascia boards and the soffit back to the wall line
  const fm=plain(fascia),sm=plain(soffit);
  for(const[a,b]of[[c0,c1],[c1,c2],[c2,c3],[c3,c0]] as [V,V][]){
    k.quad(fm,[a[0],y-.25,a[2]],[b[0],y-.25,b[2]],b,a);
  }
  k.quad(sm,[x0,y-.25,z0],[x1,y-.25,z0],[ax1,y-.25,az0],[ax0,y-.25,az0]);
  k.quad(sm,[x1,y-.25,z1],[x0,y-.25,z1],[ax0,y-.25,az1],[ax1,y-.25,az1]);
  k.quad(sm,[x0,y-.25,z1],[x0,y-.25,z0],[ax0,y-.25,az0],[ax0,y-.25,az1]);
  k.quad(sm,[x1,y-.25,z0],[x1,y-.25,z1],[ax1,y-.25,az1],[ax1,y-.25,az0]);
  return y+rise;
}

// the hospital's name on the porch fascia
let nameTex:THREE.Texture|null=null;
function nameTexture():THREE.Texture{
  if(nameTex)return nameTex;
  if(typeof document==='undefined')return nameTex=new THREE.Texture();
  const c=document.createElement('canvas');c.width=1024;c.height=64;const x=c.getContext('2d')!;
  x.fillStyle='#2f5466';x.font='700 40px "IBM Plex Mono",monospace';x.textAlign='center';x.textBaseline='middle';
  x.fillText('HOSPITAL REGIONAL DE DIVINOLÂNDIA',512,34);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return nameTex=t;
}

function build():THREE.Group{
  const g=new THREE.Group(),kits:Kits=[];
  const site=new Kit();kits.push(site);

  // ---------------- WEST WING: x 5..37, z -7.5..7.5 ----------------
  {
    // the flat-fronted bay by the tower (three window columns in the 1950 model), then verandas
    const f=side(kits,'n',5,37,-7.5,7.5);
    wall(f.k,5,14,H5,grid(5,14,0,5,3));
    f.k.box(trimM(),5,14,H5-.5,H5,-.1,.06);
    verandas(f.k,14,37,5);
    // the south-west wing joins the back at x 9..29 up to its third storey
    const s=side(kits,'s',5,37,-7.5,7.5);wall(s.k,s.a,s.b,H5,grid(s.a,s.b,0,5,3.5,(x,fl)=>fl<3&&-x>8.5&&-x<29.5));
    const e=side(kits,'px',5,37,-7.5,7.5);wall(e.k,-4.9,e.b,H5,grid(-4.9,e.b,0,5,4.2));
    hip(site,tileM(),5,37,-7.5,7.5,H5,3,.9,hipM(),C.hospTrim);
  }
  // ---------------- EAST WING: x -45.7..-5, z -5.5..7.5 ----------------
  {
    const f=side(kits,'n',-45.7,-5,-5.5,7.5);verandas(f.k,-45.7,-5,5);
    const s=side(kits,'s',-45.4,-5,-5.5,7.5);wall(s.k,s.a,s.b,H5,grid(s.a,s.b,0,5));
    // the verandas wrap the east end; the corner bay belongs to the front ones
    const e=side(kits,'nx',-45.7,-5,-5.5,7.5);verandas(e.k,-5.5,4.9,5);
    hip(site,tileM(),-45.7,-5,-5.5,7.5,H5,2.8,.9,hipM(),C.hospTrim);
    // the brick boiler chimney, rising off the back slope near the east end
    site.box(plain(C.hospChimney),-40.7,-39.3,H5-3,H5+8.6,-4.2,-2.8);
    site.box(plain('#3a332e'),-40.9,-39.1,H5+8.6,H5+8.9,-4.4,-2.6);
  }
  // ---------------- ENTRANCE TOWER: x -5..5, z -8..8.5, six storeys ----------------
  {
    const f=side(kits,'n',-5,5,-8,HOSP_DOOR_Z);
    const ops:Op[]=[{t:'glass',x:0,w:2.8,h:2.7,y:BASE,frame:'#4a4d50'},
      {t:'window',x:-3,w:1.1,h:1.7,y:BASE+.9,frame:C.hospFrame,st:'basculante'},{t:'window',x:3,w:1.1,h:1.7,y:BASE+.9,frame:C.hospFrame,st:'basculante'}];
    for(let fl=1;fl<6;fl++)for(const x of[-2.7,0,2.7])ops.push({t:'window',x,w:x?1.1:1.3,h:x?1.8:2.2,y:top(fl)+(x?.8:.6),frame:C.hospFrame,st:'basculante'});
    wall(f.k,-5,5,H6,ops);
    const w=wallM(),t=trimM();
    for(const x of[-5,5])f.k.box(w,x-.35,x+.35,0,H6+1.4,0,.3);          // corner pilasters
    for(let fl=1;fl<6;fl++)f.k.box(t,-4.65,4.65,top(fl)-.12,top(fl),0,.1); // floor lines
    // the stepped art-deco crown over the front
    f.k.box(w,-5,5,H6,H6+1,-.4,.05);f.k.box(t,-5.1,5.1,H6+1,H6+1.12,-.5,.12);
    f.k.box(w,-3.4,3.4,H6+1,H6+1.9,-.4,.05);f.k.box(t,-3.5,3.5,H6+1.9,H6+2,-.5,.12);
    f.k.box(w,-2,2,H6+1.9,H6+3.1,-.4,.05);f.k.box(t,-2.1,2.1,H6+3.1,H6+3.22,-.5,.12);
    for(const x of[-1.2,1.2])f.k.box(t,x-.12,x+.12,H6-2.6,H6+3,0,.18);     // vertical fins
    // sides and back: only the top storey clears the wings and the pavilion
    for(const s of['px','nx','s'] as Side[]){
      const q=side(kits,s,-5,5,-8,HOSP_DOOR_Z);
      wall(q.k,q.a,q.b,H6,grid(q.a,q.b,5,6,s==='s'?3.3:4));
      q.k.box(w,q.a,q.b,H6,H6+1,-.4,0);q.k.box(t,q.a-.05,q.b+.05,H6+1,H6+1.12,-.5,.06);
    }
    site.box(plain(C.hospSlab),-4.6,4.6,H6-.3,H6+.2,-7.6,8.1);         // flat roof slab
    // porch: raised floor, three steps, the flat canopy on four columns, the name on it
    site.box(baseM(),-4.6,4.6,0,BASE,HOSP_DOOR_Z,12.4);
    for(let s=0;s<3;s++)site.box(plain('#'+C.stepTread.toString(16).padStart(6,'0')),-3.8,3.8,0,BASE-s*.2,12.4,12.4+(s+1)*.4);
    site.box(t,-4.8,4.8,4.1,4.55,HOSP_DOOR_Z,13.3);
    for(const x of[-4.1,-1.6,1.6,4.1]){
      const col=new THREE.Mesh(new THREE.CylinderGeometry(.2,.24,4.1-BASE,10),t);col.position.set(x,BASE+(4.1-BASE)/2,12.75);col.castShadow=true;site.add(col);
    }
    const nm=new THREE.Mesh(new THREE.PlaneGeometry(9.4,.42),new THREE.MeshLambertMaterial({map:nameTexture(),transparent:true}));
    nm.position.set(0,4.33,13.31);site.add(nm);
  }
  // ---------------- STAIR PAVILION + ROTUNDA behind the tower ----------------
  {
    for(const s of['px','nx','s'] as Side[]){const q=side(kits,s,-8,4,-16,-8);wall(q.k,q.a,q.b,H5,grid(q.a,q.b,0,5,3,undefined,1.2));}
    hip(site,tileM(),-8,4,-16,-7.6,H5,2.6,.8,hipM(),C.hospTrim);
    // octagonal rotunda, four storeys: a face per side, a window per side and storey
    const cx=-4.6,cz=-18.6,R=4.3,ap=R*Math.cos(Math.PI/8),fw=2*R*Math.sin(Math.PI/8),Hr=top(4);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+Math.PI/8,k=face(kits,cx+Math.sin(a)*ap,cz+Math.cos(a)*ap,a);
      wall(k,-fw/2,fw/2,Hr,Math.cos(a)>.5?[]:grid(-fw/2,fw/2,0,4,fw,undefined,1.1,1.6));
    }
    const Ro=R+.8,rise=2.6,tm=tileM(),cm=hipM(),fm=trimM();
    for(let i=0;i<8;i++){
      const a0=i*Math.PI/4,a1=a0+Math.PI/4,p0:[number,number,number]=[cx+Math.sin(a0)*Ro,Hr,cz+Math.cos(a0)*Ro],p1:[number,number,number]=[cx+Math.sin(a1)*Ro,Hr,cz+Math.cos(a1)*Ro];
      const L=Math.hypot(p1[0]-p0[0],p1[2]-p0[2]),sl=Math.hypot(Ro*Math.cos(Math.PI/8),rise);
      site.tri(tm,p0,p1,[cx,Hr+rise,cz],[0,0],[L/ROOF_TILE_M,0],[L/2/ROOF_TILE_M,sl/ROOF_TILE_M]);
      site.quad(fm,[p0[0],Hr-.25,p0[2]],[p1[0],Hr-.25,p1[2]],p1,p0);          // fascia strip
      const A=new THREE.Vector3(...p0),B=new THREE.Vector3(cx,Hr+rise,cz),cap=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,A.distanceTo(B),6),cm);
      cap.position.copy(A).add(B).multiplyScalar(.5);cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());site.add(cap);
    }
  }
  // ---------------- SOUTH-WEST WING: x 9..29, z -38..-7.5, three storeys ----------------
  {
    const H=top(3);
    for(const s of['px','nx','s'] as Side[]){const q=side(kits,s,9,29,-38,-7.5);wall(q.k,q.a,q.b,H,grid(q.a,q.b,0,3,3.4));}
    hip(site,tileM(),9,29,-38,-7.2,H,3,.9,hipM(),C.hospTrim);
  }
  // ---------------- SERVICE WING (metal roof) + its tiled end block ----------------
  {
    const metal=plain(C.annexWing);
    for(const s of['n','px','nx'] as Side[]){const q=side(kits,s,-17,-9,-45,-20);wall(q.k,q.a,q.b,4.4,grid(q.a,q.b,0,1,3.2,undefined,1.4,1.2));}
    hip(site,metal,-17,-9,-45,-20,4.4,1.2,.7,null,'#8c9194');
    for(const s of['n','s','px','nx'] as Side[]){const q=side(kits,s,-18.5,-7.5,-52,-45);wall(q.k,q.a,q.b,4.4,grid(q.a,q.b,0,1,3.4,undefined,1.4,1.2));}
    hip(site,tileM(),-18.5,-7.5,-52,-45,4.4,2,.7,hipM(),C.hospTrim);
  }
  // ---------------- forecourt: concrete apron from the porch out to the drive ----------------
  site.box(plain('#bdb7aa'),-14,14,0,.05,HOSP_DOOR_Z,19);
  site.box(plain('#a9a397'),-46,38,0,.02,7.5,9.5);                    // path along the verandas

  for(const k of kits)g.add(k.finish());
  // the name by the drive
  const sign=placa.build({lines:['HOSPITAL REGIONAL','DE DIVINOLÂNDIA · CONDERG'],w:6,h:1.6,bg:'#f2f2ee',fg:'#2f5466',postH:1.2});
  sign.position.set(-10,0,17.5);g.add(sign);
  // the imperial palms of the entrance garden (2005 photo)
  for(const[x,z]of[[-8,16],[8,16],[-24,12],[24,12],[38,13]]){const p=arvore.build({kind:'palmeira'});p.position.set(x,0,z);g.add(p);}
  g.userData.h=H6+3;
  return g;
}
export default {category:'Divinolândia',label:'Hospital Regional',build};
