import * as THREE from 'three';
import {DIVINO} from '@/core/palette.ts';
import {Kit,P,plain,tile,holedWall,holeOf,fillOpening,dirt,type Op} from './kit-fachada.ts';
import {ROOF_TILE_M} from './texturas.ts';

// Hospital Regional de Divinolândia — the old Sanatório Adhemar de Barros (finished in
// 1945 for tuberculosis patients, run by the CONDERG consortium since 1987), rebuilt from
// the satellite footprint (Google/Esri imagery, ~0.14 m/px), the Street View panoramas
// around the grounds (Av. Leonor Mendes de Barros: BPh-DXXWFkFXAkepKIvuwg,
// meihIjfxKNEXbSPk1R6U3Q; images kept locally in docs/divinolandia/referencias-streetview/
// hosp-*/), the 1950 scale model in the hospital lobby and the 1945/2005 photos:
//   - the MAIN BLOCK, ~83 m long, five storeys under clay hipped roofs with white hip
//     flashing: the north front is the old "varandas de cura" of the TB sanatorium, closed
//     in long ago (visitors' photos 2019–2025: yellow pilasters, grey infill with steel
//     windows, the top storey glazed, red-tiled pent eaves), the back is plain render with
//     grey steel window grids. West wing 15 m deep with a
//     flat-fronted bay by the tower, east wing 13 m with the verandas wrapping its east end;
//   - the ENTRANCE TOWER in the middle, one storey taller, with the stepped art-deco
//     crown, corner pilasters, three window columns and the one-storey porch (square
//     pillars, a tiled eave round a flat roof, steps with a yellow handrail, a ramp) over
//     the glass doors;
//   - behind the tower the stair PAVILION and the octagonal ROTUNDA;
//   - the three-storey SOUTH-WEST WING at right angles to the back, the one-storey
//     service wing with its metal roof to the south-east, and the brick boiler CHIMNEY
//     at the east end.
// build() is pure. Frame: +z = the veranda front (north-north-west in the real town),
// +x = along the block toward its west end, origin on the ground at the tower's centre
// line. HOSP_FOOT are its collision boxes [cx, cz, w, d, height]; HOSP_LOT is the centre
// of its levelled lot (sites-table.ts `hospital`) in this frame; HOSP_DOOR_Z is the glass
// entrance (the street door of the game's hospital room, models/city/hospital.ts).
const ST=3.5,BASE=.6;                           // storey height, raised ground floor
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

// The cure verandas as they are today (the visitors' photos, 2019–2025): long since closed
// in. Bay by bay between yellow pilasters, each with its grey downpipe: the ground floor a
// plain wall with a steel window per bay; storeys 1..floors-2 recessed panels of grey render
// with one smaller steel window each; the top storey glazed across the bay in steel grids.
// Yellow bands at every slab, and a red-tiled pent eave over the ground floor and over the
// third storey. a..b along the face, face plane z=0, the infill set back to z=-RECESS.
const RECESS=.35;
function verandas(k:Kit,a:number,b:number,floors:number):void{
  const H=top(floors),n=Math.max(1,Math.round((b-a)/3.55)),s=(b-a)/n;
  const w=wallM(),infill=plain('#c3bba9'),pipe=plain('#8f9497'),tm=tileM(),t=trimM();
  const bay=(i:number):number=>a+s*(i+.5);
  // ground floor: the front wall, a steel window per bay
  const g0:Op[]=[];for(let i=0;i<n;i++)g0.push({t:'window',x:bay(i),w:1.7,h:1.5,y:BASE+.85,frame:C.hospFrame,st:'basculante'});
  holedWall(k,w,a,b,BASE,top(1),0,g0.map(holeOf));for(const o of g0)fillOpening(k,o,0,w);
  holedWall(k,baseM(),a,b,0,BASE,0,[]);dirt(k,a,b,0,.9,0);
  // the closed-in storeys: a window per bay in the grey panels, the top storey glazed
  const up:Op[]=[];
  for(let f=1;f<floors;f++)for(let i=0;i<n;i++){
    const x=bay(i);
    if(f===floors-1)up.push({t:'window',x,w:s-.95,h:2.1,y:top(f)+.75,frame:C.hospFrame,st:'basculante'});
    else up.push({t:'window',x:x+((i*7+f*3)%3-1)*.35,w:(i+f)%3?1.3:1.6,h:1.35,y:top(f)+1.05,frame:C.hospFrame,st:'basculante'});
  }
  holedWall(k,infill,a,b,top(1),H,-RECESS,up.map(holeOf));for(const o of up)fillOpening(k,o,-RECESS,infill);
  for(let i=0;i<=n;i++){                                               // pilasters and downpipes
    const x=a+s*i,hw=i===0||i===n?.32:.24;
    k.box(w,Math.max(a,x-hw),Math.min(b,x+hw),top(1),H,-RECESS,.04);
    if(i>0&&i<n)k.box(pipe,x+hw+.02,x+hw+.12,0,H-.1,.04,.14);
  }
  for(let f=1;f<=floors;f++){                                          // slab bands
    const y=top(f);k.box(w,a,b,y-.28,y+.04,-RECESS,.22);k.box(t,a,b,y+.04,y+.08,-RECESS,.24);
  }
  for(const f of[1,3])if(f<floors){                                    // the tiled pent eaves
    const y=top(f)+.1,zb=.22,zf=.95;
    k.quad(tm,[a-.1,y-.4,zf],[b+.1,y-.4,zf],[b+.1,y,zb],[a-.1,y,zb]);
    k.box(t,a-.1,b+.1,y-.48,y-.4,zf-.05,zf+.03);                        // its edge board
  }
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

// the street number on the porch's pillar (R. Leonor Mendes de Barros, 626)
let numTex:THREE.Texture|null=null;
function numberTexture():THREE.Texture{
  if(numTex)return numTex;
  if(typeof document==='undefined')return numTex=new THREE.Texture();
  const c=document.createElement('canvas');c.width=128;c.height=56;const x=c.getContext('2d')!;
  x.fillStyle='#f4f1ea';x.fillRect(0,0,128,56);x.strokeStyle='#5a5a58';x.lineWidth=4;x.strokeRect(2,2,124,52);
  x.fillStyle='#2b2b2b';x.font='700 38px "Barlow Condensed",monospace';x.textAlign='center';x.textBaseline='middle';
  x.fillText('626',64,30);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return numTex=t;
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
    const ochre=plain('#d4a24c');                                         // the ochre panels under its windows
    for(let fl=1;fl<6;fl++)for(const x of[-2.7,0,2.7])f.k.box(ochre,x-.62,x+.62,top(fl)+.08,top(fl)+.66,0,.03);
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
    // porch, as the visitors' photos show it today: a one-storey block in front of the tower,
    // square pillars with moulded capitals carrying a deep beam, a tiled pent eave round the
    // flat roof and its parapet; the steps down to the drive on the west half with a yellow
    // handrail, the ramp along the façade to the east, concrete planters of red geraniums,
    // the street number on the west pillar
    const PZ=12,yel=plain('#e0b52a'),conc=plain('#a8a49b'),tread=plain('#'+C.stepTread.toString(16).padStart(6,'0'));
    site.box(baseM(),-4.6,4.6,0,BASE,HOSP_DOOR_Z,PZ);
    for(const[x,z]of[[-4.2,PZ-.35],[4.2,PZ-.35],[-4.2,HOSP_DOOR_Z+.6],[4.2,HOSP_DOOR_Z+.6]]){
      site.box(w,x-.35,x+.35,BASE,3.3,z-.35,z+.35);                       // pillar
      site.box(t,x-.45,x+.45,3.05,3.3,z-.45,z+.45);                       // capital
    }
    site.box(w,-4.75,4.75,3.3,3.8,HOSP_DOOR_Z,PZ+.1);                      // beam
    site.box(t,-4.8,4.8,3.25,3.32,HOSP_DOOR_Z,PZ+.15);                     // its soffit band
    hip(site,tileM(),-4.75,4.75,HOSP_DOOR_Z,PZ+.1,3.8,.45,.55,hipM(),C.hospTrim);
    site.box(w,-4.1,4.1,3.8,4.75,HOSP_DOOR_Z,PZ-.55);                      // parapet over the flat roof
    site.box(t,-4.2,4.2,4.75,4.85,HOSP_DOOR_Z,PZ-.45);
    // steps: three treads down to the drive across the west half (+x)
    for(let k=0;k<3;k++)site.box(tread,.2,4.6,0,BASE-k*.2,PZ,PZ+(k+1)*.38);
    for(const x of[.35,2.4,4.45]){                                         // the yellow handrail
      site.box(yel,x-.03,x+.03,0,1.05+BASE,PZ+.05,PZ+.11);site.box(yel,x-.03,x+.03,0,1.05,PZ+1.08,PZ+1.14);
      const a=new THREE.Vector3(x,BASE+1.05,PZ+.08),b=new THREE.Vector3(x,1.05,PZ+1.11),r=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,a.distanceTo(b),6),yel);
      r.position.copy(a).lerp(b,.5);r.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());site.add(r);
    }
    // the ramp along the façade to the east (-x): from the porch floor down to the ground over 7 m
    {
      const rg=new THREE.BufferGeometry(),x0=-4.6,x1=-11.6,z0=HOSP_DOOR_Z+.1,z1=HOSP_DOOR_Z+1.7;
      const v=[x0,BASE,z0, x0,BASE,z1, x1,0,z1, x0,BASE,z0, x1,0,z1, x1,0,z0];
      rg.setAttribute('position',new THREE.Float32BufferAttribute(v,3));rg.computeVertexNormals();
      const rm=new THREE.Mesh(rg,baseM());rm.receiveShadow=true;site.add(rm);
      site.box(yel,x1,x0,.9,.95,z1-.05,z1+.01);
      for(let x=x1;x<=x0+.01;x+=1.75)site.box(yel,x-.03,x+.03,0,.95+BASE*(x-x1)/(x0-x1),z1-.05,z1+.01);
    }
    // planters of red geraniums at the porch's front and along the ramp
    for(const[x,z]of[[-3.4,PZ+.4],[-1.6,PZ+.4],[-6.2,HOSP_DOOR_Z+2.3],[-8.6,HOSP_DOOR_Z+2.3]]){
      site.box(conc,x-.55,x+.55,0,.5,z-.3,z+.3);
      for(let i=0;i<4;i++){const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.2,0),plain(i%2?'#3e6b2e':'#c2352d'));f.position.set(x-.4+i*.27,.6,z+(i%2?.08:-.06));site.add(f);}
    }
    // the street number on the west front pillar
    const nm=new THREE.Mesh(new THREE.PlaneGeometry(.5,.22),new THREE.MeshLambertMaterial({map:numberTexture()}));
    nm.position.set(4.2,2.4,PZ+.01);site.add(nm);
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
  // (the forecourt — the paver parking strip along the front, the drives and the garden
  // square — is drawn with the street: js/world/divinolandia/ruas/frente-hospital.ts)

  for(const k of kits)g.add(k.finish());
  g.userData.h=H6+3;
  return g;
}
export default {category:'Divinolândia',label:'Hospital Regional',build};
