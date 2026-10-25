import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {matte} from '../matte.ts';
import {drape,lawnM,type GroundAt,type P2} from './praca-chao.ts';
import {canvasTex,concreteM} from './posto-kit.ts';
import {CONCRETO_TILE_M,uvMetres} from './texturas.ts';
import ArvoreRua from './arvore-rua.ts';

// Cristo Redentor of Divinolândia — the white concrete Christ with open arms on the hill
// north of the river, by the curve of the road that climbs from the SP-344 to the new
// lots (Google Maps "Cristo Redentor", -21.6578,-46.7302). Rebuilt from Street View
// (captures cristo-*, 2024 imagery) and the gridded satellite (sat-cristo, local):
//   * a square terrace of rough grey concrete, ~8 m a side and ~2.8 m high, crowned by a
//     white balustrade of turned balusters; a straight flight of steps climbs its
//     north-west face (from the north-east corner up to the south-west one), with its
//     own sloping balustrade;
//   * in the middle, a stained white pedestal (plinth, die, cornice);
//   * on it, the statue: ~9.5 m (about five times the pedestal, as in the photos), robe with deep vertical folds, arms held out level with
//     the sleeves hanging from them, head bowed a little — facing the town (south-west);
//   * a fenced plot (chain link on concrete posts with the tops bent out) with a lawn and
//     four small trees on its east side, open toward the road.
// The statue is ONE smooth surface (a signed-distance field polygonised by marching
// cubes, as the FP hands in characters/hand-sdf.ts), painted per vertex with the grey
// rain streaks of the photos. build({groundAt}) is pure; TOWN-LOCAL coordinates shifted by
// ORIGIN (as the fuel stations). CRISTO_FOOT = collision boxes [x, z, w, d, rot, height].

export const ORIGIN:P2=[937.5,-474];
// the statue faces the town (the Matriz at the town-local origin)
const FACE=Math.atan2(-ORIGIN[0],-ORIGIN[1]);          // rotation.y that turns local +z to the town
const C=Math.cos(FACE),S=Math.sin(FACE);
// terrace frame → town-local: local +z = toward the town, local +x = rotation of +z by -90°
const TL=(x:number,z:number):P2=>[ORIGIN[0]+x*C+z*S,ORIGIN[1]-x*S+z*C];
export const TERRACE=8,TERRACE_H=2.8;                   // side, height above the highest corner
const STATUE_SCALE=1.25;                                 // the 7.6 m field → ~9.5 m
const STAIR_W=1.15;
// the fenced plot (satellite), open on the west edge toward the road
const FENCE:P2[]=[[924,-493],[975,-484],[960,-458],[913,-467]];   // west edge kept ~4 m off the baked road
const GATE:[number,number]=[.42,.62];                   // fraction of the west edge (FENCE[3]→FENCE[0]) left open
const TREES:P2[]=[[952,-481],[956.5,-477],[962,-470.5],[963.5,-464.5]];

export const CRISTO_FOOT:[number,number,number,number,number,number][]=(()=>{
  const out:[number,number,number,number,number,number][]=[];
  const[tx,tz]=TL(0,0);out.push([tx,tz,TERRACE+.2,TERRACE+.2,-FACE,TERRACE_H+1.2]);out.push([tx,tz,2.5,2.5,-FACE,TERRACE_H+14]);   // the pedestal and the statue
  const[sx,sz]=TL(-TERRACE/2-STAIR_W/2,0);out.push([sx,sz,STAIR_W+.1,TERRACE,-FACE,1.4]);
  // the fence, edge by edge (the west edge in two pieces round the gate)
  const edge=(a:P2,b:P2):void=>{const L=Math.hypot(b[0]-a[0],b[1]-a[1]);out.push([(a[0]+b[0])/2,(a[1]+b[1])/2,L,.3,Math.atan2(b[1]-a[1],b[0]-a[0]),2.4]);};
  edge(FENCE[0],FENCE[1]);edge(FENCE[1],FENCE[2]);edge(FENCE[2],FENCE[3]);
  const lerp=(t:number):P2=>[FENCE[3][0]+(FENCE[0][0]-FENCE[3][0])*t,FENCE[3][1]+(FENCE[0][1]-FENCE[3][1])*t];
  edge(FENCE[3],lerp(GATE[0]));edge(lerp(GATE[1]),FENCE[0]);
  return out;
})();

// ------------------------------------------------------------------ materials
const tex=new Map<string,THREE.Material>();
const M=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=tex.get(k);if(!m){m=f();tex.set(k,m);}return m;};
const whiteM=():THREE.Material=>M('white',()=>matte({color:0xe9e7e1}));
const stainedM=():THREE.Material=>M('stained',()=>matte({color:0xffffff,map:canvasTex(128,256,(c,w,h)=>{
  // painted concrete gone grey in streaks under the cornices
  c.fillStyle='#e4e1da';c.fillRect(0,0,w,h);
  for(let i=0;i<70;i++){const x=(i*37)%w,len=h*(.25+((i*53)%40)/60),a=.05+((i*29)%10)/90;
    const g=c.createLinearGradient(0,0,0,len);g.addColorStop(0,`rgba(90,88,84,${a*2})`);g.addColorStop(1,'rgba(90,88,84,0)');
    c.fillStyle=g;c.fillRect(x,0,2+(i%4),len);}
  c.fillStyle='rgba(70,68,64,.18)';c.fillRect(0,h-18,w,18);})}));
const greyConcreteM=():THREE.Material=>concreteM;
const postM=():THREE.Material=>M('post',()=>matte({color:0xcfccc4}));
const chainM=():THREE.Material=>M('chain',()=>{
  const t=canvasTex(256,64,(c,w,h)=>{
    c.clearRect(0,0,w,h);c.strokeStyle='#ffffff';c.lineWidth=1.1;
    for(let x=-h;x<w+h;x+=6){c.beginPath();c.moveTo(x,0);c.lineTo(x+h,h);c.stroke();c.beginPath();c.moveTo(x+h,0);c.lineTo(x,h);c.stroke();}});
  t.wrapS=t.wrapT=THREE.RepeatWrapping;                 // the panel tiles it (2.2 × .55 m)
  return matte({color:0xaab0b3,alphaTest:.5,side:THREE.DoubleSide,map:t});});
const statueM=():THREE.Material=>M('statue',()=>matte({vertexColors:true}));

// ------------------------------------------------------------------ the statue (SDF)
type V3=[number,number,number];
interface Cone{a:V3;b:V3;ra:number;rb:number}
interface Ell{c:V3;r:V3}
function sdCone(x:number,y:number,z:number,c:Cone):number{
  const bx=c.b[0]-c.a[0],by=c.b[1]-c.a[1],bz=c.b[2]-c.a[2],px=x-c.a[0],py=y-c.a[1],pz=z-c.a[2];
  const h=Math.max(0,Math.min(1,(px*bx+py*by+pz*bz)/(bx*bx+by*by+bz*bz)));
  const dx=px-bx*h,dy=py-by*h,dz=pz-bz*h;
  return Math.sqrt(dx*dx+dy*dy+dz*dz)-(c.ra+(c.rb-c.ra)*h);
}
function sdEll(x:number,y:number,z:number,e:Ell):number{
  const a=(x-e.c[0])/e.r[0],b=(y-e.c[1])/e.r[1],d=(z-e.c[2])/e.r[2],k0=Math.sqrt(a*a+b*b+d*d);
  const a1=a/e.r[0],b1=b/e.r[1],d1=d/e.r[2],k1=Math.sqrt(a1*a1+b1*b1+d1*d1);
  return k1>0?k0*(k0-1)/k1:-Math.min(...e.r);
}
const smin=(a:number,b:number,k:number):number=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};
const sstep=(a:number,b:number,x:number):number=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};

// statue frame: feet on y = 0, facing +z, arms along ±x; height ~7.8 m, span ~6.3 m
const ARM_Y=6.2;
const ARMS:Cone[]=[1,-1].map(s=>({a:[s*.62,ARM_Y+.08,0],b:[s*3.0,ARM_Y-.05,.04],ra:.27,rb:.17}));
const SLEEVES:Ell[]=[1,-1].map(s=>({c:[s*1.3,ARM_Y-.3,-.02],r:[.78,.4,.12]}));
const HANDS:Ell[]=[1,-1].map(s=>({c:[s*3.18,ARM_Y-.1,.07],r:[.2,.15,.07]}));
const PARTS={
  chest:{c:[0,5.35,.04],r:[.72,1.15,.5]} as Ell,
  shoulders:{c:[0,ARM_Y+.05,-.01],r:[.86,.32,.42]} as Ell,
  neck:{a:[0,6.4,0],b:[0,6.85,.05],ra:.2,rb:.17} as Cone,
  head:{c:[.06,7.15,.12],r:[.26,.33,.29]} as Ell,
  nose:{c:[.07,7.12,.42],r:[.05,.09,.06]} as Ell,
  brow:{c:[.07,7.27,.35],r:[.2,.05,.06]} as Ell,
  hair:{c:[.02,7.0,-.06],r:[.33,.55,.3]} as Ell,
  beard:{c:[.03,6.98,.25],r:[.18,.21,.12]} as Ell,
  cord:{c:[0,4.15,.05],r:[.66,.09,.46]} as Ell,
  feet:[{c:[.2,.1,.66],r:[.14,.1,.22]},{c:[-.2,.1,.66],r:[.14,.1,.22]}] as Ell[],
};
function statueField(x:number,y:number,z:number):number{
  // the robe: an elliptic cone from a flared hem to the shoulders, carved with folds that
  // run down the skirt (deep at the hem, fading out at the chest)
  const a=Math.atan2(z,x);
  const zq=z/.68,r=Math.hypot(x,zq),t=Math.max(0,Math.min(1,y/6.1));
  const rad=1.0+(.6-1.0)*t+.08*sstep(.5,0,y);
  const folds=.055*Math.sin(a*11+y*.35)*sstep(5.4,1.5,y)+.025*Math.sin(a*23-y*.7)*sstep(4.5,.8,y);
  let d=Math.max((r-rad-folds)*.7,-y,y-6.25);
  d=smin(d,sdEll(x,y,z,PARTS.chest),.35);
  d=smin(d,sdEll(x,y,z,PARTS.cord),.08);
  d=smin(d,sdEll(x,y,z,PARTS.shoulders),.3);
  for(const c of ARMS)d=smin(d,sdCone(x,y,z,c),.22);
  for(const e of SLEEVES)d=smin(d,sdEll(x,y,z,e),.28);
  for(const e of HANDS)d=smin(d,sdEll(x,y,z,e),.08);
  d=smin(d,sdCone(x,y,z,PARTS.neck),.12);
  d=smin(d,sdEll(x,y,z,PARTS.hair),.12);
  d=smin(d,sdEll(x,y,z,PARTS.head),.08);
  d=smin(d,sdEll(x,y,z,PARTS.nose),.04);
  d=smin(d,sdEll(x,y,z,PARTS.brow),.05);
  // eye hollows under the brow
  for(const s of[1,-1]){const e=Math.hypot(x-.07-s*.1,y-7.2,z-.38)-.06;d=Math.max(d,-e+.0);}
  d=smin(d,sdEll(x,y,z,PARTS.beard),.06);
  for(const e of PARTS.feet)d=smin(d,sdEll(x,y,z,e),.1);
  return d;
}
let statueGeo:THREE.BufferGeometry|null=null;
// polygonise once (shared by every build): narrow band over a coarse lattice, as hand-sdf.ts
export function statueGeometry(res=88):THREE.BufferGeometry{
  if(statueGeo)return statueGeo;
  const cx=0,cy=3.9,cz=0,half=4.05;
  const mc=new MarchingCubes(res,new THREE.MeshBasicMaterial(),false,false,200000);mc.isolation=0;
  const at=(i:number):number=>((i-res/2)/(res/2))*half;
  const CC=4,nc=Math.ceil(res/CC)+1,step=2*half/res,reach=CC*step*Math.sqrt(3)*1.6;
  const coarse=new Float32Array(nc*nc*nc);
  for(let k=0;k<nc;k++)for(let j=0;j<nc;j++)for(let i=0;i<nc;i++)coarse[i+j*nc+k*nc*nc]=statueField(cx+at(i*CC),cy+at(j*CC),cz+at(k*CC));
  const f=mc.field;
  for(let ck=0;ck<nc-1;ck++)for(let cj=0;cj<nc-1;cj++)for(let ci=0;ci<nc-1;ci++){
    let near=true,inside=false;
    for(let n=0;n<8;n++){const v=coarse[(ci+(n&1))+(cj+(n>>1&1))*nc+(ck+(n>>2&1))*nc*nc];if(Math.abs(v)>=reach){near=false;inside=v<0;break;}}
    for(let k=ck*CC;k<Math.min(res,ck*CC+CC);k++)for(let j=cj*CC;j<Math.min(res,cj*CC+CC);j++)for(let i=ci*CC;i<Math.min(res,ci*CC+CC);i++)
      f[i+j*res+k*res*res]=near?-statueField(cx+at(i),cy+at(j),cz+at(k))*1000:(inside?reach*1000:-reach*1000);
  }
  mc.update();
  const n=mc.count,sp=mc.geometry.getAttribute('position').array as Float32Array;
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3);
  for(let v=0;v<n;v++){
    const x=cx+sp[v*3]*half,y=cy+sp[v*3+1]*half,z=cz+sp[v*3+2]*half;
    // the normal from the field itself (central differences): the lattice gradient MC
    // computes goes wrong where the narrow band clamps the field
    const e=.02,gx=statueField(x+e,y,z)-statueField(x-e,y,z),gy=statueField(x,y+e,z)-statueField(x,y-e,z),gz=statueField(x,y,z+e)-statueField(x,y,z-e);
    const gl=Math.hypot(gx,gy,gz)||1,ny=gy/gl;
    pos[v*3]=x;pos[v*3+1]=y;pos[v*3+2]=z;nor[v*3]=gx/gl;nor[v*3+1]=ny;nor[v*3+2]=gz/gl;
    // white concrete: grey rain streaks running down, darker undersides and fold hollows,
    // a greyer hem; a faint mottle so it never reads as plastic
    const streak=Math.max(0,Math.sin(x*9.1+Math.sin(z*3.3)*2)*Math.sin(z*7.7+x*1.3))**3*sstep(6.6,2.5,y);
    const under=Math.max(0,-ny)*.22,hem=sstep(1.4,0,y)*.12;
    const mott=.03*Math.sin(x*31+y*17)*Math.sin(z*27-y*11);
    const k=1-.16*streak-under-hem+mott;
    col[v*3]=.9*k;col[v*3+1]=.895*k;col[v*3+2]=.875*k;
  }
  mc.geometry.dispose();
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  g.setAttribute('color',new THREE.BufferAttribute(col,3));g.computeBoundingSphere();
  statueGeo=g;return g;
}

// ------------------------------------------------------------------ terrace kit
const box=(g:THREE.Object3D,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number):THREE.Mesh=>{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.castShadow=true;b.receiveShadow=true;g.add(b);return b;};
// a turned baluster (lathe), 1 unit = 1 m tall
const BALUSTER=(():THREE.BufferGeometry=>{
  const p=[[.0,0],[.055,0],[.055,.06],[.04,.09],[.06,.25],[.075,.38],[.05,.52],[.035,.6],[.05,.66],[.055,.7],[0,.7]].map(([r,y])=>new THREE.Vector2(r,y));
  return new THREE.LatheGeometry(p,7);
})();
// a straight run of balusters between rails from (x0,y0,z0) to (x1,y1,z1) (rails follow the slope)
function balustrade(parts:THREE.BufferGeometry[],a:THREE.Vector3,b:THREE.Vector3,h=.95,gap=.22):void{
  const L=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(2,Math.round(L/gap)),ry=Math.atan2(-(b.z-a.z),b.x-a.x);
  for(let i=1;i<n;i++){const t=i/n,q=BALUSTER.clone();q.scale(1,(h-.24)/.7,1);q.translate(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t+.1,a.z+(b.z-a.z)*t);parts.push(q);}
  const rail=(y0:number,th:number,w:number):void=>{
    const len=Math.hypot(L,b.y-a.y),r=new THREE.BoxGeometry(len+.06,th,w);
    r.rotateZ(Math.atan2(b.y-a.y,L));r.rotateY(ry);r.translate((a.x+b.x)/2,(a.y+b.y)/2+y0+th/2,(a.z+b.z)/2);parts.push(r);};
  rail(0,.1,.2);rail(h-.12,.12,.24);
}
const post=(parts:THREE.BufferGeometry[],x:number,y:number,z:number,h=1.05):void=>{const p=new THREE.BoxGeometry(.26,h,.26);p.translate(x,y+h/2,z);parts.push(p);};

function terrace(at:(x:number,z:number)=>number):{g:THREE.Group;top:number}{
  const g=new THREE.Group(),h=TERRACE/2;
  const corners:[number,number][]=[[-h,-h],[h,-h],[h,h],[-h,h]];
  const lo=Math.min(...corners.map(([x,z])=>at(x,z)))-.4,top=Math.max(...corners.map(([x,z])=>at(x,z)))+TERRACE_H;
  // rough grey concrete body down to the lowest ground under it, with the slab edge on top
  const body=new THREE.Mesh(uvMetres(new THREE.BoxGeometry(TERRACE,top-lo,TERRACE),TERRACE,top-lo,CONCRETO_TILE_M),greyConcreteM());
  body.position.y=(top+lo)/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
  box(g,whiteM(),0,top-.02,0,TERRACE+.3,.16,TERRACE+.3);
  // the stair along the -x face: from the -z end (ground) up to the +z end (the top);
  // its solid flank is grey concrete like the terrace
  const x0=-h-STAIR_W,z0=-h+.4,z1=h-.2,y0=at(-h-STAIR_W/2,z0),rise=top-y0,steps=Math.max(8,Math.round(rise/.18)),run=(z1-z0)/steps;
  for(let i=0;i<steps;i++){
    const zt=z0+run*i,yt=y0+rise*(i+1)/steps,yb=Math.min(at(x0,zt),at(-h,zt))-.3;
    const st=new THREE.Mesh(new THREE.BoxGeometry(STAIR_W,yt-yb,run+.02),i%2?greyConcreteM():greyConcreteM());
    st.position.set(-h-STAIR_W/2,(yt+yb)/2,zt+run/2);st.castShadow=true;st.receiveShadow=true;g.add(st);
    const tread=new THREE.Mesh(new THREE.BoxGeometry(STAIR_W,.04,run+.04),whiteM());tread.position.set(-h-STAIR_W/2,yt+.02,zt+run/2);g.add(tread);
  }
  // white balustrades: the four edges of the terrace (open where the stair lands) and the
  // stair's outer edge, posts at the corners and ends
  const parts:THREE.BufferGeometry[]=[],y=top+.06,V=(a:number,b:number,c:number)=>new THREE.Vector3(a,b,c);
  const e=h-.12;
  balustrade(parts,V(-e,y,-e),V(e,y,-e));balustrade(parts,V(e,y,-e),V(e,y,e));balustrade(parts,V(e,y,e),V(-e,y,e));
  balustrade(parts,V(-e,y,-e),V(-e,y,e-STAIR_W-.3));
  for(const[x,z]of[[-e,-e],[e,-e],[e,e],[-e,e],[-e,e-STAIR_W-.3]])post(parts,x,y,z);
  const xs=-h-STAIR_W+.12;
  balustrade(parts,V(xs,y0+.18,z0+.2),V(xs,top+.06,z1));post(parts,xs,y0+.18,z0+.2);post(parts,xs,top+.06,z1+.05);
  const rails=new THREE.Mesh(mergeGeometries(parts),whiteM());rails.castShadow=true;g.add(rails);
  // the pedestal: plinth, die and cornice, in white paint streaked grey
  box(g,stainedM(),0,top+.1,0,2.7,.5,2.7);
  box(g,stainedM(),0,top+.6,0,2.15,1.25,2.15);
  box(g,whiteM(),0,top+1.85,0,2.45,.22,2.45);
  box(g,whiteM(),0,top+2.07,0,2.2,.12,2.2);
  return{g,top:top+2.19};
}

// a chain-link fence on concrete posts (tops bent outward), along a polyline in town-local
function fence(g:THREE.Group,at:GroundAt,a:P2,b:P2,inside:P2):void{
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/2.6)),ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
  // outward normal (away from the plot)
  let nx=-uz,nz=ux;if(nx*(inside[0]-a[0])+nz*(inside[1]-a[1])>0){nx=-nx;nz=-nz;}
  for(let k=0;k<=n;k++){
    const x=a[0]+(b[0]-a[0])*k/n,z=a[1]+(b[1]-a[1])*k/n,y=at(x,z);
    box(g,postM(),x,y-.3,z,.13,2.45,.13);
    const tip=new THREE.Mesh(new THREE.BoxGeometry(.11,.55,.11),postM());
    tip.position.set(x+nx*.12,y+2.32,z+nz*.12);tip.rotation.set(0,0,0);tip.lookAt(x+nx*2,y+2.32+3.4,z+nz*2);tip.rotateX(Math.PI/2);g.add(tip);
  }
  const ya=at(...a),yb=at(...b),geo=new THREE.PlaneGeometry(L,1.9),uv=geo.getAttribute('uv') as THREE.BufferAttribute;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*L/2.2,uv.getY(i)*1.9/.55);   // 1 texture = 2.2 × .55 m: ~5 cm diamonds
  const p=geo.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<p.count;i++){const t=(p.getX(i)+L/2)/L;p.setY(i,p.getY(i)+(ya+(yb-ya)*t));}
  const m=new THREE.Mesh(geo,chainM());m.position.set((a[0]+b[0])/2,1.12,(a[1]+b[1])/2);m.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);g.add(m);
  // the top wire
  const w=new THREE.Mesh(new THREE.BoxGeometry(L,.02,.02),postM());w.position.set((a[0]+b[0])/2,(ya+yb)/2+2.08,(a[1]+b[1])/2);
  w.rotation.set(0,-Math.atan2(b[1]-a[1],b[0]-a[0]),Math.atan2(yb-ya,L),'YXZ');g.add(w);
}

function build(o:{groundAt?:GroundAt}={}):THREE.Group{
  const at:GroundAt=o.groundAt??(()=>0);
  const root=new THREE.Group(),g=new THREE.Group();g.position.set(-ORIGIN[0],0,-ORIGIN[1]);root.add(g);
  // lawn inside the fence (the fence and the trees on it)
  const cen:P2=[FENCE.reduce((s,p)=>s+p[0],0)/4,FENCE.reduce((s,p)=>s+p[1],0)/4];
  g.add(drape(FENCE,at,.03,lawnM));
  for(let i=0;i<4;i++){
    const a=FENCE[i],b=FENCE[(i+1)%4];
    if(i===3){const L=(t:number):P2=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];fence(g,at,a,L(GATE[0]),cen);fence(g,at,L(GATE[1]),b,cen);}
    else fence(g,at,a,b,cen);
  }
  for(const[k,[x,z]]of TREES.entries()){const t=ArvoreRua.build({kind:'ficus'});t.scale.setScalar(.5+.08*(k%3));t.position.set(x,at(x,z)-.05,z);t.rotation.y=k*1.7;g.add(t);}
  // the terrace, the pedestal and the statue, turned to face the town
  const mon=new THREE.Group();mon.position.set(ORIGIN[0],0,ORIGIN[1]);mon.rotation.y=FACE;g.add(mon);
  const{g:ter,top}=terrace((x,z)=>at(...TL(x,z)));mon.add(ter);
  const st=new THREE.Mesh(statueGeometry(),statueM());st.position.y=top;st.scale.setScalar(STATUE_SCALE);st.castShadow=true;st.receiveShadow=true;mon.add(st);
  return root;
}

export default {category:'Divinolândia',label:'Cristo Redentor',build};
