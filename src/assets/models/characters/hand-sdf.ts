import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';

// An anatomical human hand built as ONE smooth surface: a signed-distance field of the
// palm (with thenar/hypothenar pads and the wrist), four fingers of three tapering
// phalanges and a three-bone thumb, blended with smooth unions (so the fingers grow out
// of the palm and the joints are fleshy, not jointed sticks), polygonised by marching
// cubes. Each vertex is painted by where it sits (paler palm, ruddier knuckles, joint
// creases, pink fingertips). Pure geometry: no textures, no scene access.
//
// Hand frame: wrist at the origin, the hand reaching up +Y, the PALM facing -Z and the
// back of the hand +Z; `side` +1 = right hand (thumb on the -X edge), -1 = left.

export interface HandCurl{
  fingers: [number,number,number][];          // per finger: MCP, PIP, DIP bend (rad)
  thumb: [number,number,number][];            // per thumb bone: direction (x toward the thumb edge, y up, z back)
}
export interface HandGeometry{skin: THREE.BufferGeometry;nails: THREE.BufferGeometry;}

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

// index → pinky: x across the knuckles (thumb side positive in "thumb space"), knuckle
// height, phalanx lengths, root radius and the fan-out angle
const FINGERS=[
  {x:.0265,y:-.003,len:[.039,.024,.020],r:.0098,fan:.06},
  {x:.0088,y:0,    len:[.043,.027,.021],r:.0102,fan:.01},
  {x:-.0088,y:-.003,len:[.040,.026,.020],r:.0097,fan:-.03},
  {x:-.0258,y:-.011,len:[.032,.020,.018],r:.0086,fan:-.08},
];
export const MCP_Y=.045;      // knuckle line height above the wrist
const PALM_LEN=.088, PALM_W=.078, PALM_D=.026;

// ---- signed-distance primitives -------------------------------------------------
interface Cone{a: THREE.Vector3;b: THREE.Vector3;ra: number;rb: number;tag: number;}
interface Ell{c: THREE.Vector3;r: THREE.Vector3;tag: number;}
function sdCone(px: number,py: number,pz: number,c: Cone): number{
  const bax=c.b.x-c.a.x,bay=c.b.y-c.a.y,baz=c.b.z-c.a.z;
  const pax=px-c.a.x,pay=py-c.a.y,paz=pz-c.a.z;
  const h=Math.max(0,Math.min(1,(pax*bax+pay*bay+paz*baz)/(bax*bax+bay*bay+baz*baz)));
  const dx=pax-bax*h,dy=pay-bay*h,dz=paz-baz*h;
  return Math.sqrt(dx*dx+dy*dy+dz*dz)-(c.ra+(c.rb-c.ra)*h);
}
function sdEll(px: number,py: number,pz: number,e: Ell): number{
  const x=(px-e.c.x)/e.r.x,y=(py-e.c.y)/e.r.y,z=(pz-e.c.z)/e.r.z;
  const k0=Math.sqrt(x*x+y*y+z*z);
  const x1=x/e.r.x,y1=y/e.r.y,z1=z/e.r.z;
  const k1=Math.sqrt(x1*x1+y1*y1+z1*z1);
  return k1>0?k0*(k0-1)/k1:-Math.min(e.r.x,e.r.y,e.r.z);
}
const smin=(a: number,b: number,k: number)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;};

// The palm: a rounded slab, narrower at the wrist, the back domed and the palm cupped.
function sdPalm(px: number,py: number,pz: number): number{
  const t=Math.max(0,Math.min(1,(py-(MCP_Y-PALM_LEN))/PALM_LEN));   // 0 wrist .. 1 knuckles
  const w=PALM_W*(.78+.22*t)/2;
  const back=.004*Math.sin(Math.PI*Math.min(1,t*1.15))*Math.max(0,1-(px/w)**2);
  const zc=pz-(pz>0?back:-.0025*Math.sin(Math.PI*t));
  const r=.009;
  const qx=Math.abs(px)-(w-r),qy=Math.abs(py-(MCP_Y-PALM_LEN/2))-(PALM_LEN/2-r),qz=Math.abs(zc)-(PALM_D/2-r);
  const ox=Math.max(qx,0),oy=Math.max(qy,0),oz=Math.max(qz,0);
  return Math.sqrt(ox*ox+oy*oy+oz*oz)+Math.min(Math.max(qx,qy,qz),0)-r;
}

// tags (for painting)
const T_PALM=0,T_FINGER=1,T_TIP=2,T_THUMB=3,T_KNUCKLE=4,T_WRIST=5;

interface Bound{x: number;y: number;z: number;r: number;}
interface Built{fingers: Cone[][];thumb: Cone[];bounds: Bound[];thumbBound: Bound;veins: [number,number][][];pads: Ell[];knuckles: Ell[];wrist: Cone;
  joints: THREE.Vector3[];tips: {p: THREE.Vector3;dir: THREE.Vector3;up: THREE.Vector3;r: number;len: number}[];}

// Lay the bones out for a curl. Each chain walks from its knuckle, turning by the curl
// about the finger's own sideways axis (so a curled finger folds toward the palm).
function layout(side: number,curl: HandCurl): Built{
  const sx=-side;
  const fingers: Cone[][]=[],knuckles: Ell[]=[],joints: THREE.Vector3[]=[],tips: Built['tips']=[];
  FINGERS.forEach((f,i)=>{
    const c=curl.fingers[i];
    let p=V(sx*f.x,MCP_Y+f.y,0);
    // direction (+Y fanned) and the bend axis (sideways, X)
    const dir=V(0,1,0).applyAxisAngle(V(0,0,1),sx*f.fan);
    const axis=V(1,0,0).applyAxisAngle(V(0,0,1),sx*f.fan);
    const up=V(0,0,1);                                           // back of the finger
    const radii=[f.r,f.r*.93,f.r*.86,f.r*.78];
    const chain: Cone[]=[];
    knuckles.push({c:p.clone().addScaledVector(up,.0045).addScaledVector(dir,-.003),r:V(f.r*1.05,f.r*.85,f.r*.75),tag:T_KNUCKLE});
    for(let k=0;k<3;k++){
      dir.applyAxisAngle(axis,-c[k]);up.applyAxisAngle(axis,-c[k]);   // fold toward the palm (-Z)
      const q=p.clone().addScaledVector(dir,f.len[k]);
      chain.push({a:p.clone(),b:q,ra:radii[k],rb:radii[k+1],tag:k===2?T_TIP:T_FINGER});
      if(k>0)joints.push(p.clone());
      p=q;
    }
    tips.push({p:p.clone(),dir:dir.clone(),up:up.clone(),r:radii[3],len:f.len[2]});
    fingers.push(chain);
  });
  // thumb: CMC root in the heel of the hand; each bone follows a direction given in
  // "thumb space" (x toward the thumb edge, y up, z toward the back of the hand)
  const thumb: Cone[]=[];
  const lens=[.042,.032,.028],rad=[.0135,.0119,.011,.0096];
  let p=V(sx*.027,MCP_Y-.074,-.005);
  let dir=V();
  curl.thumb.forEach((d,k)=>{
    dir=V(sx*d[0],d[1],d[2]).normalize();
    const q=p.clone().addScaledVector(dir,lens[k]);
    thumb.push({a:p.clone(),b:q,ra:rad[k],rb:rad[k+1],tag:k===2?T_TIP:T_THUMB});
    if(k>0)joints.push(p.clone());
    p=q;
  });
  // the thumbnail faces out of the thumb edge and back
  const up=V(sx*.75,0,.65).addScaledVector(dir,-V(sx*.75,0,.65).dot(dir)).normalize();
  tips.push({p:p.clone(),dir:dir.clone(),up,r:rad[3],len:lens[2]});
  const pads: Ell[]=[
    {c:V(sx*.02,MCP_Y-.062,-.008),r:V(.019,.03,.013),tag:T_PALM},       // thenar (thumb ball)
    {c:V(-sx*.024,MCP_Y-.056,-.007),r:V(.013,.03,.011),tag:T_PALM},     // hypothenar
    {c:V(0,MCP_Y-.012,-.008),r:V(.036,.011,.01),tag:T_PALM},            // pads under the knuckles
  ];
  const wrist: Cone={a:V(0,MCP_Y-PALM_LEN-.03,.001),b:V(0,MCP_Y-PALM_LEN+.012,0),ra:.0255,rb:.027,tag:T_WRIST};
  // a bounding sphere per chain lets field() skip the chains that cannot touch a point
  const bound=(ch: Cone[]): Bound=>{
    const bx=new THREE.Box3();
    for(const c of ch){for(const q of[c.a,c.b]){bx.expandByPoint(q);}}
    const cc=bx.getCenter(V());let r=0;
    for(const c of ch)r=Math.max(r,cc.distanceTo(c.a)+c.ra,cc.distanceTo(c.b)+c.rb);
    return{x:cc.x,y:cc.y,z:cc.z,r};
  };
  const y0=MCP_Y-PALM_LEN-.02;
  const veins: [number,number][][]=[
    [[sx*.004,y0],[sx*.008,MCP_Y-.06],[sx*.016,MCP_Y-.03],[sx*.018,MCP_Y-.012]],
    [[-sx*.002,y0],[-sx*.004,MCP_Y-.055],[0,MCP_Y-.03],[-sx*.002,MCP_Y-.01]],
    [[-sx*.01,y0+.01],[-sx*.016,MCP_Y-.05],[-sx*.018,MCP_Y-.025]],
    [[sx*.008,MCP_Y-.06],[-sx*.006,MCP_Y-.045]],                          // a cross-link
  ];
  return{fingers,thumb,pads,knuckles,wrist,joints,tips,veins,bounds:fingers.map(bound),thumbBound:bound(thumb)};
}

// Is the chain bounded by `q` farther from (x,y,z) than `lim`? (then it cannot change a
// smooth union whose other side is already at lim - k)
function far(q: Bound,x: number,y: number,z: number,lim: number): boolean{
  const l=lim+q.r;if(l<0)return true;
  const dx=x-q.x,dy=y-q.y,dz=z-q.z;
  return dx*dx+dy*dy+dz*dz>l*l;
}
// distance + the tag of the closest part
function field(b: Built,x: number,y: number,z: number,out: {tag: number}): number{
  // wrist is an oval: squash its x
  let body=sdPalm(x,y,z),tag=T_PALM;
  const dw=sdCone(x/1.2,y,z/.8,b.wrist)*.85;
  if(dw<body)tag=T_WRIST;
  body=smin(body,dw,.012);
  for(const e of b.pads)body=smin(body,sdEll(x,y,z,e),.008);
  for(const e of b.knuckles)body=smin(body,sdEll(x,y,z,e),.004);
  let d=body,best=body;
  for(let ci=0;ci<b.fingers.length;ci++){
    if(far(b.bounds[ci],x,y,z,body+.0075))continue;          // this finger cannot reach the surface here
    const ch=b.fingers[ci];
    let f=1e9,ft=T_FINGER;
    for(const c of ch){const s=sdCone(x,y,z,c);if(s<f){f=s;ft=c.tag;}}
    if(f<best){best=f;tag=ft;}
    d=Math.min(d,smin(body,f,.0075));
  }
  if(far(b.thumbBound,x,y,z,body+.016)){out.tag=tag;return d;}
  let th=1e9,tt=T_THUMB;
  for(const c of b.thumb){const s=sdCone(x,y,z,c);if(s<th){th=s;tt=c.tag;}}
  if(th<best){tag=tt;}
  d=Math.min(d,smin(body,th,.016));
  out.tag=tag;
  return d;
}

// Distance (in the back-of-hand plane) to the nearest of a few veins running from the
// wrist toward the gaps between the knuckles.
function veinDist(b: Built,x: number,y: number): number{
  let best=1e9;
  for(const v of b.veins){
    for(let i=0;i<v.length-1;i++){
      const ax=v[i][0],ay=v[i][1],bx=v[i+1][0],by=v[i+1][1];
      const dx=bx-ax,dy=by-ay;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));
      const ex=x-ax-dx*t,ey=y-ay-dy*t;
      best=Math.min(best,Math.sqrt(ex*ex+ey*ey));
    }
  }
  return best;
}

// Build the skin (marching cubes) and the nails for one hand.
export function buildHandGeometry(side: number,curl: HandCurl,tone: THREE.Color,res=64): HandGeometry{
  const b=layout(side,curl);
  // bounds of every bone, padded
  const box=new THREE.Box3();
  const grow=(p: THREE.Vector3,r: number)=>{box.expandByPoint(V(p.x-r,p.y-r,p.z-r));box.expandByPoint(V(p.x+r,p.y+r,p.z+r));};
  for(const ch of[...b.fingers,b.thumb])for(const c of ch){grow(c.a,c.ra);grow(c.b,c.rb);}
  box.expandByPoint(V(-PALM_W/2-.012,b.wrist.a.y-.01,-.03));box.expandByPoint(V(PALM_W/2+.012,MCP_Y+.01,.03));
  const center=box.getCenter(V()),size=box.getSize(V());
  const half=Math.max(size.x,size.y,size.z)/2+.008;

  const mc=new MarchingCubes(res,new THREE.MeshBasicMaterial(),false,false,60000);
  mc.isolation=0;
  const o={tag:0};
  const at=(i: number)=>center.x+((i-res/2)/(res/2))*half;
  const aty=(j: number)=>center.y+((j-res/2)/(res/2))*half;
  const atz=(k: number)=>center.z+((k-res/2)/(res/2))*half;
  // Narrow band: sample a coarse lattice first and only evaluate the full-resolution
  // field inside coarse cells the surface can cross; elsewhere the sign is enough.
  const C=4,nc=Math.ceil(res/C)+1,step=2*half/res;
  const coarse=new Float32Array(nc*nc*nc);
  for(let k=0;k<nc;k++)for(let j=0;j<nc;j++)for(let i=0;i<nc;i++)
    coarse[i+j*nc+k*nc*nc]=field(b,at(i*C),aty(j*C),atz(k*C),o);
  const reach=C*step*Math.sqrt(3);                            // farthest a fine point sits from a cell corner
  const f=mc.field;
  for(let ck=0;ck<nc-1;ck++)for(let cj=0;cj<nc-1;cj++)for(let ci=0;ci<nc-1;ci++){
    // the field is (about) 1-Lipschitz: one corner at least a cell diagonal from the
    // surface puts the whole cell on that corner's side
    let near=true,inside=false;
    for(let n=0;n<8;n++){
      const d=coarse[(ci+(n&1))+(cj+(n>>1&1))*nc+(ck+(n>>2&1))*nc*nc];
      if(Math.abs(d)>=reach){near=false;inside=d<0;break;}
    }
    for(let k=ck*C;k<Math.min(res,ck*C+C);k++)for(let j=cj*C;j<Math.min(res,cj*C+C);j++)for(let i=ci*C;i<Math.min(res,ci*C+C);i++)
      f[i+j*res+k*res*res]=near?-field(b,at(i),aty(j),atz(k),o)*1000:(inside?reach*1000:-reach*1000);
  }
  mc.update();
  const n=mc.count;
  const src=mc.geometry;
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3);
  const sp=src.getAttribute('position').array as Float32Array,sn=src.getAttribute('normal').array as Float32Array;
  const c=new THREE.Color();
  const paint=new Map<number,number>();                     // MC repeats each vertex in several triangles
  for(let v=0;v<n;v++){
    const x=center.x+sp[v*3]*half,y=center.y+sp[v*3+1]*half,z=center.z+sp[v*3+2]*half;
    pos[v*3]=x;pos[v*3+1]=y;pos[v*3+2]=z;
    nor[v*3]=sn[v*3];nor[v*3+1]=sn[v*3+1];nor[v*3+2]=sn[v*3+2];
    const key=(((x*2e4|0)+8192)*16384+((y*2e4|0)+8192))*16384+((z*2e4|0)+8192);
    const seen=paint.get(key);
    if(seen!==undefined){col[v*3]=col[seen*3];col[v*3+1]=col[seen*3+1];col[v*3+2]=col[seen*3+2];continue;}
    paint.set(key,v);
    field(b,x,y,z,o);
    // paint: base tone; the palm side paler; knuckles and creases darker/ruddier; tips pink
    c.copy(tone);
    const palmSide=Math.max(0,-sn[v*3+2]);
    let r=1+.06*palmSide,g=1+.08*palmSide,bl=1+.09*palmSide;
    if(o.tag===T_TIP){r*=1.02;g*=.95;bl*=.94;}
    if(o.tag===T_KNUCKLE){r*=.97;g*=.9;bl*=.88;}
    for(const jn of b.joints){
      const dx=x-jn.x,dy=y-jn.y,dz=z-jn.z;
      if(dx*dx+dy*dy+dz*dz>.000064)continue;
      const d=Math.sqrt(dx*dx+dy*dy+dz*dz);
      {const w=1-d/.008;r*=1-.07*w;g*=1-.13*w;bl*=1-.14*w;}
    }
    if(o.tag===T_WRIST){r*=.99;g*=.97;bl*=.96;}
    // faint veins over the back of the hand and wrist
    if(sn[v*3+2]>.35&&(o.tag===T_PALM||o.tag===T_WRIST)){
      const vd=veinDist(b,x,y);
      if(vd<.0028){const w=(1-vd/.0028)*Math.min(1,sn[v*3+2]);r*=1-.07*w;g*=1-.05*w;bl*=1+.02*w;}
    }
    const mott=.035*(Math.sin(x*410+Math.sin(y*290)*1.7)*Math.sin(y*370+z*230)+Math.sin(z*520+x*190)*.5);
    r*=1+mott;g*=1+mott*.8;bl*=1+mott*.7;
    col[v*3]=c.r*r;col[v*3+1]=c.g*g;col[v*3+2]=c.b*bl;
  }
  mc.geometry.dispose();
  const skin=new THREE.BufferGeometry();
  skin.setAttribute('position',new THREE.BufferAttribute(pos,3));
  skin.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  skin.setAttribute('color',new THREE.BufferAttribute(col,3));
  skin.computeBoundingSphere();

  // nails: thin curved plates on the back of each fingertip, a hair proud of the skin
  const nails: THREE.BufferGeometry[]=[];
  for(const tp of b.tips){
    const g=new THREE.SphereGeometry(1,14,8,0,Math.PI*2,0,Math.PI*.5);  // a shallow cap
    g.scale(tp.r*.78,.0016,tp.len*.42);
    g.rotateX(Math.PI/2);                                    // cap faces +Z (back of the finger)... aligned below
    const m=new THREE.Matrix4();
    const side3=new THREE.Vector3().crossVectors(tp.dir,tp.up).normalize();
    m.makeBasis(side3,tp.dir,tp.up);
    m.setPosition(tp.p.clone().addScaledVector(tp.dir,-tp.len*.38).addScaledVector(tp.up,tp.r*.86));
    g.applyMatrix4(m);
    nails.push(g.index?g.toNonIndexed():g);
  }
  const merged=mergeNails(nails);
  return{skin,nails:merged};
}

function mergeNails(gs: THREE.BufferGeometry[]): THREE.BufferGeometry{
  let total=0;for(const g of gs)total+=g.attributes.position.count;
  const pos=new Float32Array(total*3),nor=new Float32Array(total*3);
  let o=0;
  for(const g of gs){pos.set(g.attributes.position.array as Float32Array,o*3);nor.set(g.attributes.normal.array as Float32Array,o*3);o+=g.attributes.position.count;g.dispose();}
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.BufferAttribute(pos,3));
  out.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  return out;
}
