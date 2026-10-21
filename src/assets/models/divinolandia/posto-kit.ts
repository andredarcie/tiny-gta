import * as THREE from 'three';
import {matte} from '../matte.ts';
import {drape,tileSize,type GroundAt,type P2} from './praca-chao.ts';
import {concretoTexture,azulejoTexture,tijoloTexture,corrugatedTexture,CONCRETO_TILE_M} from './texturas.ts';

// Gas-station kit — the parts shared by Divinolândia's four fuel stations (posto-triangulo.ts,
// posto-passoni.ts, posto-lurain.ts, posto-taurus.ts), each rebuilt from Street View and the
// z20/z21 satellite. Not a model: no default export.
//  - the CANOPY (cobertura): a flat slab over any polygon, its fascia painted per edge in the
//    brand's livery (canvas, metres along the edge), a white ceiling with the recessed lights
//    — or, for the steel canopies, no ceiling: the corrugated roof seen from below over
//    lattice girders;
//  - COLUMNS, pump ISLANDS (raised concrete with a painted kerb), the forecourt APRON (poured
//    concrete draped on the terrain), painted bay lines, price boards, palms in planters.
// Every station is built in TOWN-LOCAL metres (the bake frame, x east, z south) with a
// groundAt(x,z) giving the terrain height relative to the station's origin, so its pieces
// stand on the real slope; the canopy itself stays level.

// ---------------- brand colours (measured on the Street View frames) ----------------
export const BR={green:'#1d7a45',yellow:'#efb51f',white:'#f2f2ee',grey:'#d9dad6'};
export const TAURUS={blue:'#1f3a92',orange:'#ee7f22',gold:'#f3c52e',white:'#f2f3f0'};
export const LURAIN={black:'#1e1e20',red:'#e0532d',steel:'#2b2c2e'};

// ---------------- materials (cached) ----------------
const cache=new Map<string,THREE.Material>();
const get=(k:string,f:()=>THREE.Material):THREE.Material=>{let m=cache.get(k);if(!m){m=f();cache.set(k,m);}return m;};
export const flat=(c:string):THREE.Material=>get('f'+c,()=>matte({color:c}));
export const glow=(c:string,e:number):THREE.Material=>get('g'+c+e,()=>matte({color:c,emissive:e}));
// surfaces that carry a tiled texture in metres (planar uv from the dominant plane, see uvBox)
export const tileWall=():THREE.Material=>get('azulejo',()=>matte({map:azulejoTexture()}));
export const brick=():THREE.Material=>get('tijolo',()=>matte({map:tijoloTexture()}));
export const corrugated=(c:string):THREE.Material=>get('corr'+c,()=>matte({color:c,map:corrugatedTexture(),side:THREE.DoubleSide}));
const off=(n:number):Partial<THREE.MeshLambertMaterialParameters>=>({polygonOffset:true,polygonOffsetFactor:-n,polygonOffsetUnits:-n});
// the forecourt sits over the town's sidewalk band (offset 2) and under the asphalt (4)
export const concreteM=tileSize(matte({map:concretoTexture(),...off(3)}),CONCRETO_TILE_M) as THREE.MeshLambertMaterial;
export const gravelM=tileSize(matte({color:0xa48f84,map:concretoTexture(),...off(3)}),CONCRETO_TILE_M*2) as THREE.MeshLambertMaterial;
const paintM=(c:string):THREE.Material=>get('paint'+c,()=>matte({color:c,...off(5)}));

// ---------------- canvas helper (blank texture outside a browser: the Node unit tests) ----------------
export function canvasTex(w:number,h:number,paint:(x:CanvasRenderingContext2D,w:number,h:number)=>void):THREE.Texture{
  if(typeof document==='undefined')return new THREE.Texture();
  const c=document.createElement('canvas');c.width=w;c.height=h;
  paint(c.getContext('2d')!,w,h);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
// a sign: text centred on a coloured board (multi-line ok)
export function signTex(lines:string[],o:{bg:string;fg:string;w?:number;h?:number;font?:string;weight?:number}):THREE.Texture{
  const W=o.w??512,Hh=o.h??128;
  return canvasTex(W,Hh,(x,w,h)=>{
    x.fillStyle=o.bg;x.fillRect(0,0,w,h);x.fillStyle=o.fg;x.textAlign='center';x.textBaseline='middle';
    const fs=Math.min(h/lines.length*.72,w/Math.max(...lines.map(l=>l.length))*1.25);
    x.font=`${o.weight??800} ${fs}px ${o.font??'Arial, Helvetica, sans-serif'}`;
    lines.forEach((l,i)=>x.fillText(l,w/2,h*(i+.5)/lines.length));
  });
}
export const signMat=(lines:string[],o:{bg:string;fg:string;w?:number;h?:number;font?:string;weight?:number}):THREE.Material=>
  get('sign'+lines.join('|')+o.bg+o.fg+(o.w??'')+(o.h??''),()=>matte({map:signTex(lines,o)}));
// a flat board (plane) facing +z after ry, centred at (x,y,z)
export function board(g:THREE.Object3D,m:THREE.Material,w:number,h:number,x:number,y:number,z:number,ry=0):THREE.Mesh{
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);p.position.set(x,y,z);p.rotation.y=ry;g.add(p);return p;
}

// ---------------- the brand liveries painted on the fascia ----------------
// A fascia painter draws one canopy edge `len` metres long on a canvas of PX px per metre.
export type Painter=(x:CanvasRenderingContext2D,len:number,PX:number,h:number)=>void;
const PX=48;
// Petrobras "BR" mark: the green square with its yellow top band and the white BR letters
export function brLogo(x:CanvasRenderingContext2D,cx:number,cy:number,s:number):void{
  x.fillStyle=BR.green;x.fillRect(cx-s/2,cy-s/2,s,s);
  x.fillStyle=BR.yellow;x.fillRect(cx-s/2,cy-s/2,s,s*.24);
  x.fillStyle='#ffffff';x.font=`900 ${s*.56}px Arial, Helvetica, sans-serif`;x.textAlign='center';x.textBaseline='middle';
  x.fillText('BR',cx,cy+s*.14);
}
// the yellow/white (or green/yellow) comb of thin stripes where two colours of the livery meet
function comb(x:CanvasRenderingContext2D,x0:number,w:number,h:number,a:string,b:string,n=9):void{
  x.fillStyle=a;x.fillRect(x0,0,w,h);x.fillStyle=b;
  for(let i=0;i<n;i++){const t=(i+.5)/n,sw=w/n*(.15+.75*t);x.fillRect(x0+i*w/n+(w/n-sw)/2,0,sw,h);}
}
// Petrobras canopy edge, as a run of bands along it (metres): 'logo' = white panel with the
// BR mark + PETROBRAS, 'w2y'/'y2g' = the stripe combs, plain colours otherwise.
export type BrBand=['logo'|'white'|'yellow'|'green'|'w2y'|'y2g'|'g2y'|'y2w',number];
export function brFascia(bands:BrBand[]):Painter{
  return(x,len,px,h)=>{
    x.fillStyle=BR.white;x.fillRect(0,0,len*px,h);
    const total=bands.reduce((s,b)=>s+b[1],0),k=len/total;
    let at=0;
    for(const[kind,m]of bands){
      const x0=at*px,w=m*k*px;at+=m*k;
      if(kind==='yellow'){x.fillStyle=BR.yellow;x.fillRect(x0,0,w,h);}
      else if(kind==='green'){x.fillStyle=BR.green;x.fillRect(x0,0,w,h);}
      else if(kind==='w2y')comb(x,x0,w,h,BR.white,BR.yellow);
      else if(kind==='y2w')comb(x,x0+w,-w,h,BR.white,BR.yellow);
      else if(kind==='y2g')comb(x,x0,w,h,BR.yellow,BR.green);
      else if(kind==='g2y')comb(x,x0+w,-w,h,BR.yellow,BR.green);
      else if(kind==='logo'){
        const s=h*.62;brLogo(x,x0+s*.5+h*.3,h*.5,s);
        x.fillStyle=BR.green;x.font=`800 ${h*.36}px Arial, Helvetica, sans-serif`;x.textAlign='left';x.textBaseline='middle';
        x.fillText('PETROBRAS',x0+s+h*.55,h*.53);
      }
    }
    x.fillStyle='rgba(0,0,0,.18)';x.fillRect(0,h-3,len*px,3);
  };
}
// Taurus: royal blue with the orange + gold lines at the foot, the italic gold "Taurus"
// and the rainbow-wave badge at the given positions (metres)
export function taurusFascia(words:number[],badges:number[]):Painter{
  return(x,len,px,h)=>{
    x.fillStyle=TAURUS.blue;x.fillRect(0,0,len*px,h);
    x.fillStyle=TAURUS.orange;x.fillRect(0,h*.84,len*px,h*.07);x.fillStyle=TAURUS.gold;x.fillRect(0,h*.91,len*px,h*.04);
    x.fillStyle='#e9ecf3';x.fillRect(0,0,len*px,h*.05);
    for(const m of words){
      x.font=`italic 900 ${h*.42}px Arial, Helvetica, sans-serif`;x.textAlign='center';x.textBaseline='middle';
      x.fillStyle='#1a1a1a';x.fillText('Taurus',m*px+3,h*.47+3);x.fillStyle=TAURUS.gold;x.fillText('Taurus',m*px,h*.47);
    }
    for(const m of badges)taurusBadge(x,m*px,h*.45,h*.66);
  };
}
// the Taurus badge: a white square with blue, red, orange and gold waves
export function taurusBadge(x:CanvasRenderingContext2D,cx:number,cy:number,s:number):void{
  x.fillStyle='#f4f4f2';x.fillRect(cx-s/2,cy-s/2,s,s);
  const cols=['#1f3a92','#d8322c','#ee7f22','#f3c52e'];
  cols.forEach((c,i)=>{
    x.strokeStyle=c;x.lineWidth=s*.13;x.beginPath();
    const y=cy-s*.24+i*s*.16;x.moveTo(cx-s*.42,y+s*.06);x.quadraticCurveTo(cx,y-s*.12,cx+s*.42,y+s*.04);x.stroke();
  });
}
// Lurain: matt black, a thin red-orange line at the foot, POSTO LURAIN with the drop mark
export function lurainFascia(words:number[]):Painter{
  return(x,len,px,h)=>{
    x.fillStyle=LURAIN.black;x.fillRect(0,0,len*px,h);
    x.fillStyle=LURAIN.red;x.fillRect(0,h*.86,len*px,h*.07);
    for(const m of words){
      const cx=m*px,s=h*.42;
      x.font=`700 ${h*.34}px Arial, Helvetica, sans-serif`;x.textAlign='left';x.textBaseline='middle';
      const tw=x.measureText('POSTO LURAIN').width,x0=cx-(tw+s*1.4)/2;
      x.strokeStyle=LURAIN.red;x.lineWidth=3;x.strokeRect(x0,h*.45-s/2,s,s);
      x.fillStyle=LURAIN.red;x.beginPath();x.moveTo(x0+s/2,h*.45-s*.36);
      x.quadraticCurveTo(x0+s*.82,h*.45+s*.05,x0+s/2,h*.45+s*.34);x.quadraticCurveTo(x0+s*.18,h*.45+s*.05,x0+s/2,h*.45-s*.36);x.fill();
      x.fillText('POSTO LURAIN',x0+s*1.4,h*.47);
    }
  };
}
export const plainFascia=(c:string):Painter=>(x,len,px,h)=>{x.fillStyle=c;x.fillRect(0,0,len*px,h);};

// ---------------- the canopy ----------------
export type CanopyOpts={
  y:number;h:number;                        // underside height (above the origin's ground), fascia depth
  edges:Painter[];                          // one painter per polygon edge (pts[i] → pts[i+1])
  attached?:number[];                       // edges built against a wall: no fascia there
  ceiling?:string;                          // white ceiling colour; omitted = steel canopy (no ceiling)
  roof?:string;                             // top surface
  lights?:number;                           // spacing of the recessed lights (m), 0 = none
  skylights?:P2[][];                        // translucent strips in the ceiling (polygons)
  solar?:{x0:number;x1:number;z0:number;z1:number}[];  // PV arrays on the roof
};
// centroid of a polygon's vertices
const centre=(pts:P2[]):P2=>[pts.reduce((s,p)=>s+p[0],0)/pts.length,pts.reduce((s,p)=>s+p[1],0)/pts.length];
export function pointInPoly(x:number,z:number,pts:P2[],inset=0):boolean{
  let ins=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const[xi,zi]=pts[i],[xj,zj]=pts[j];
    if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)ins=!ins;
  }
  if(!ins||!inset)return ins;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const[ax,az]=pts[j],[bx,bz]=pts[i],dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;
    let t=((x-ax)*dx+(z-az)*dz)/l2;t=t<0?0:t>1?1:t;
    if(Math.hypot(x-ax-t*dx,z-az-t*dz)<inset)return false;
  }
  return true;
}
// horizontal polygon at height y facing up (or down)
export function hPoly(pts:P2[],y:number,m:THREE.Material,down=false):THREE.Mesh{
  const sh=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(x,down?z:-z)));
  const geo=new THREE.ShapeGeometry(sh);geo.rotateX(down?Math.PI/2:-Math.PI/2);geo.translate(0,y,0);
  const mesh=new THREE.Mesh(geo,m);mesh.receiveShadow=true;return mesh;
}
// vertical quad between a and b (x,z), y0..y1, whose face points away from `inside`; its
// u runs left → right as seen from in front of it (so a painted sign always reads right)
export function vQuad(a:P2,b:P2,y0:number,y1:number,m:THREE.Material,inside:P2,uLen=1,vLen=1):THREE.Mesh{
  const ex=b[0]-a[0],ez=b[1]-a[1],mx=(a[0]+b[0])/2-inside[0],mz=(a[1]+b[1])/2-inside[1];
  const flip=(-ez*mx+ex*mz)<0;                    // (A0,B0,B1) faces (-ez,0,ex), and then A→B is left → right
  const[p,q]=flip?[b,a]:[a,b];
  const pos=[p[0],y0,p[1],q[0],y0,q[1],q[0],y1,q[1],p[0],y0,p[1],q[0],y1,q[1],p[0],y1,p[1]];
  const uv=[0,0,uLen,0,uLen,vLen,0,0,uLen,vLen,0,vLen];
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
export function canopy(g:THREE.Group,pts:P2[],o:CanopyOpts):void{
  const c=centre(pts),y0=o.y,y1=o.y+o.h;
  pts.forEach((a,i)=>{
    if(o.attached?.includes(i))return;
    const b=pts[(i+1)%pts.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const paint=o.edges[i]??plainFascia(BR.white);
    const tex=canvasTex(Math.max(8,Math.round(len*PX)),Math.round(o.h*PX),(x,w,h)=>paint(x,len,PX,h));
    // the painter's x = 0 is the edge's LEFT end as seen standing outside, facing it
    g.add(vQuad(a,b,y0,y1,matte({map:tex}),c));
    g.add(vQuad(a,b,y0,y1-.05,flat(o.ceiling?'#cfd0cc':'#2a2b2d'),[a[0]+b[0]-c[0],a[1]+b[1]-c[1]]));  // inner face
    // white capping on top of the fascia
    const cap=vQuad(a,b,y1,y1+.06,flat('#ecebe6'),c);g.add(cap);
  });
  g.add(hPoly(pts,y1+.06,flat(o.roof??'#a9aaa6')));
  if(o.ceiling){
    const ceil=hPoly(pts,y0+.01,flat(o.ceiling),true);g.add(ceil);
    for(const s of o.skylights??[]){
      const m=hPoly(s,y0+.03,get('sky',()=>matte({color:0xdfe6ea,emissive:0x6f7478,side:THREE.DoubleSide})),true);g.add(m);
    }
    if(o.lights){
      const lm=glow('#fbfaf4',0xe9e4d6),xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
      for(let x=Math.min(...xs)+o.lights/2;x<Math.max(...xs);x+=o.lights)for(let z=Math.min(...zs)+o.lights/2;z<Math.max(...zs);z+=o.lights){
        if(!pointInPoly(x,z,pts,1.2))continue;
        const l=new THREE.Mesh(new THREE.BoxGeometry(1.2,.05,.3),lm);l.position.set(x,y0-.01,z);g.add(l);
      }
    }
  }else{
    // steel canopy: the corrugated sheet seen from below, just under the roof
    g.add(hPoly(pts,y1-.15,corrugated('#4a4c4f'),true));
  }
  for(const s of o.solar??[])solarArray(g,s.x0,s.x1,s.z0,s.z1,y1+.07);
}
// rows of photovoltaic modules lying almost flat on a roof
export function solarArray(g:THREE.Group,x0:number,x1:number,z0:number,z1:number,y:number):void{
  const pm=get('pv',()=>matte({color:0x1d2a44,emissive:0x05070c})),fm=flat('#b9bcbf');
  for(let x=x0;x<x1-1;x+=1.05)for(let z=z0;z<z1-1.6;z+=1.75){
    const p=new THREE.Mesh(new THREE.BoxGeometry(1,.04,1.7),pm);p.position.set(x+.5,y+.12,z+.85);p.rotation.x=.08;g.add(p);
  }
  const f=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,.06,.06),fm);f.position.set((x0+x1)/2,y+.05,z0);g.add(f);
}
// a lattice girder (treliça) of the steel canopies, from a to b at bottom-chord height y
export function truss(g:THREE.Group,a:P2,b:P2,y:number,depth:number,m:THREE.Material):void{
  const L=Math.hypot(b[0]-a[0],b[1]-a[1]),ry=-Math.atan2(b[1]-a[1],b[0]-a[0]);
  const t=new THREE.Group();t.position.set(a[0],y,a[1]);t.rotation.y=ry;g.add(t);
  for(const yy of[0,depth]){const ch=new THREE.Mesh(new THREE.BoxGeometry(L,.08,.12),m);ch.position.set(L/2,yy,0);t.add(ch);}
  const n=Math.max(2,Math.round(L/(depth*1.1)));
  for(let i=0;i<n;i++){
    const xa=i*L/n,xb=(i+1)*L/n,diag=Math.hypot(xb-xa,depth);
    const d=new THREE.Mesh(new THREE.BoxGeometry(.05,diag,.05),m);d.position.set((xa+xb)/2,depth/2,0);d.rotation.z=(i%2?1:-1)*Math.atan2(xb-xa,depth);t.add(d);
    const v=new THREE.Mesh(new THREE.BoxGeometry(.05,depth,.05),m);v.position.set(xa,depth/2,0);t.add(v);
  }
}

// ---------------- columns, islands, forecourt ----------------
// a square column from the ground at (x,z) up to the canopy underside y1
export function column(g:THREE.Group,at:GroundAt,x:number,z:number,y1:number,w:number,m:THREE.Material):number{
  const y0=at(x,z)-.2,c=new THREE.Mesh(new THREE.BoxGeometry(w,y1-y0,w),m);
  c.position.set(x,(y0+y1)/2,z);c.castShadow=true;c.receiveShadow=true;g.add(c);return y0+.2;
}
// A pump island: a raised concrete block l×w turned by rot (its long side along (cos rot,
// sin rot)), the top level with the island's highest ground + h, the sides reaching below the
// lowest; `edge` paints the kerb line round the top (the yellow of the Petrobras islands).
// Returns the top height (above the origin) for what stands on it.
export function island(g:THREE.Group,at:GroundAt,x:number,z:number,rot:number,l:number,w:number,o:{base:string;edge?:string;h?:number}):number{
  const c=Math.cos(rot),s=Math.sin(rot);
  let lo=Infinity,hi=-Infinity;
  for(const[u,v]of[[-1,-1],[1,-1],[1,1],[-1,1],[0,0]]){const y=at(x+u*l/2*c-v*w/2*s,z+u*l/2*s+v*w/2*c);lo=Math.min(lo,y);hi=Math.max(hi,y);}
  const top=hi+(o.h??.22),b=new THREE.Mesh(new THREE.BoxGeometry(l,top-lo+.3,w),flat(o.base));
  b.position.set(x,(top+lo-.3)/2,z);b.rotation.y=-rot;b.castShadow=true;b.receiveShadow=true;g.add(b);
  if(o.edge){
    const e=new THREE.Mesh(new THREE.BoxGeometry(l+.02,.1,w+.02),flat(o.edge));e.position.set(x,top-.044,z);e.rotation.y=-rot;g.add(e);   // (its top just over the block's)
    const t=new THREE.Mesh(new THREE.BoxGeometry(l-.16,.02,w-.16),flat(o.base));t.position.set(x,top+.002,z);t.rotation.y=-rot;g.add(t);
  }
  return top;
}
// the poured-concrete forecourt over a polygon (with holes), draped on the ground
export function apron(g:THREE.Group,at:GroundAt,pts:P2[],holes:P2[][]=[],m:THREE.Material=concreteM):void{
  g.add(drape(pts,at,.125,m,holes,2));
}
// a painted floor line from a to b (bay markings)
export function floorLine(g:THREE.Group,at:GroundAt,a:P2,b:P2,c:string,w=.12):void{
  const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L*w/2,nz=dx/L*w/2;
  g.add(drape([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],at,.13,paintM(c),[],1.5));
}
// a free-standing box from the ground (x,z centre, w along x, d along z, turned ry)
export function block(g:THREE.Group,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,ry=0):THREE.Mesh{
  const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y+h/2,z);b.rotation.y=ry;b.castShadow=true;b.receiveShadow=true;g.add(b);return b;
}
// a box whose faces are textured in metres (tiled walls, brick): BoxGeometry uvs scaled per face
export function tiledBlock(g:THREE.Group,m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number,tile:number,ry=0):THREE.Mesh{
  const geo=new THREE.BoxGeometry(w,h,d),uv=geo.getAttribute('uv') as THREE.BufferAttribute;
  // face order +x,-x,+y,-y,+z,-z — 4 vertices each: u spans the face width, v its height
  const dims:[number,number][]=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*dims[f][0]/tile,uv.getY(i)*dims[f][1]/tile);}
  const b=new THREE.Mesh(geo,m);b.position.set(x,y+h/2,z);b.rotation.y=ry;b.castShadow=true;b.receiveShadow=true;g.add(b);return b;
}
// the black LED price board on a post (Lurain, by the islands)
export function priceBoard(g:THREE.Group,at:GroundAt,x:number,z:number,ry:number,lines:string[]):void{
  const y=at(x,z);
  block(g,flat('#26272a'),x,y,z,.06,1.1,.06);
  const t=canvasTex(128,40*lines.length,(c,w,h)=>{
    c.fillStyle='#111';c.fillRect(0,0,w,h);c.font='700 26px monospace';c.textBaseline='middle';
    lines.forEach((l,i)=>{const[a,b]=l.split(' ');c.fillStyle='#e6e6e6';c.font='700 15px Arial';c.textAlign='left';c.fillText(a,6,40*i+20);
      c.fillStyle='#ff7a2a';c.font='700 24px monospace';c.textAlign='right';c.fillText(b??'',w-6,40*i+21);});
  });
  const b=new THREE.Mesh(new THREE.BoxGeometry(.5,.16*lines.length+.06,.05),[flat('#111'),flat('#111'),flat('#111'),flat('#111'),matte({map:t}),matte({map:t})]);
  b.position.set(x,y+1.1+.08*lines.length,z);b.rotation.y=ry;g.add(b);
}

// ---------------- simple buildings on any footprint ----------------
// A wall face from a to b seen from outside (away from `inside`): its left end, length,
// the rotation that turns a +z-facing plane onto it, and points on it — s metres from the
// left end, y up, `out` metres in front of it.
export type Face={len:number;ry:number;at:(s:number,y:number,out?:number)=>[number,number,number];n:P2};
export function face(a:P2,b:P2,inside:P2):Face{
  const ex=b[0]-a[0],ez=b[1]-a[1],mx=(a[0]+b[0])/2-inside[0],mz=(a[1]+b[1])/2-inside[1];
  const flip=(-ez*mx+ex*mz)<0,[L,R]=flip?[b,a]:[a,b],len=Math.hypot(ex,ez);
  const ux=(R[0]-L[0])/len,uz=(R[1]-L[1])/len,nx=-uz,nz=ux;              // left→right, outward
  return{len,ry:Math.atan2(nx,nz),n:[nx,nz],at:(s,y,out=0)=>[L[0]+ux*s+nx*out,y,L[1]+uz*s+nz*out]};
}
// the walls of a prism over a footprint polygon, y0..y1, uv in metres / tile
export function walls(g:THREE.Group,pts:P2[],y0:number,y1:number,m:THREE.Material,tile=1,inside?:P2):void{
  const c=inside??centre(pts);
  pts.forEach((a,i)=>{const b=pts[(i+1)%pts.length];g.add(vQuad(a,b,y0,y1,m,c,Math.hypot(b[0]-a[0],b[1]-a[1])/tile,(y1-y0)/tile));});
}
// a flat element on a face: w×h centred s metres from its left end, bottom at y, `out` in front
export function onFace(g:THREE.Group,f:Face,m:THREE.Material,s:number,y:number,w:number,h:number,out=.02,depth=0):THREE.Mesh{
  const[x,yy,z]=f.at(s,y+h/2,out+depth/2);
  const mesh=depth?new THREE.Mesh(new THREE.BoxGeometry(w,h,depth),m):new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);
  mesh.position.set(x,yy,z);mesh.rotation.y=f.ry;mesh.castShadow=depth>0;g.add(mesh);return mesh;
}
// an opening drawn on a face: the dark (or glass) recess, a frame round it, mullions
export function opening(g:THREE.Group,f:Face,s:number,y:number,w:number,h:number,o:{fill:THREE.Material;frame?:string;panes?:number}):void{
  onFace(g,f,o.fill,s,y,w,h,.015);
  const fr=flat(o.frame??'#3b3d3f'),t=.06;
  onFace(g,f,fr,s,y+h-t,w+t*2,t,0,.08);onFace(g,f,fr,s,y,w+t*2,t,0,.08);
  onFace(g,f,fr,s-w/2-t/2,y,t,h,0,.08);onFace(g,f,fr,s+w/2+t/2,y,t,h,0,.08);
  for(let p=1;p<(o.panes??1);p++)onFace(g,f,fr,s-w/2+p*w/(o.panes??1),y,.05,h,0,.06);
}
export const glassM=():THREE.Material=>get('glass',()=>matte({color:0x5b6a74,emissive:0x0d1114}));
export const darkM=():THREE.Material=>get('dark',()=>matte({color:0x2a2826}));
// a hipped roof of clay tiles over the rectangle x0..x1 × z0..z1 at eave height y
export function hipRoof(g:THREE.Group,x0:number,x1:number,z0:number,z1:number,y:number,rise:number,c:string,ov=.5):void{
  const X0=x0-ov,X1=x1+ov,Z0=z0-ov,Z1=z1+ov,w=X1-X0,d=Z1-Z0,alongX=w>=d,r=Math.abs(w-d)/2;
  const cx=(X0+X1)/2,cz=(Z0+Z1)/2;
  const R1:[number,number,number]=alongX?[cx-r,y+rise,cz]:[cx,y+rise,cz-r],R2:[number,number,number]=alongX?[cx+r,y+rise,cz]:[cx,y+rise,cz+r];
  const A:[number,number,number]=[X0,y,Z0],B:[number,number,number]=[X1,y,Z0],C:[number,number,number]=[X1,y,Z1],D:[number,number,number]=[X0,y,Z1];
  const tris=alongX?[[D,C,R2],[D,R2,R1],[B,A,R1],[B,R1,R2],[A,D,R1],[C,B,R2]]:[[A,R1,B],[C,R2,D],[D,R2,R1],[D,R1,A],[B,R1,R2],[B,R2,C]];
  const pos:number[]=[],uv:number[]=[];
  for(const t of tris)for(const v of t){pos.push(...v);uv.push((v[0]+v[2])/1.2,v[1]/.45);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,get('telha'+c,()=>matte({color:c,map:tileTex(),side:THREE.DoubleSide})));m.castShadow=true;g.add(m);
  const s=new THREE.Mesh(new THREE.BoxGeometry(w,.08,d),flat('#e7e3da'));s.position.set(cx,y-.04,cz);g.add(s);
}
// a gable roof of clay tiles, ridge along z over x0..x1 × z0..z1 at eave height y; the
// triangular gable ends are left to the walls
export function gableRoof(g:THREE.Group,x0:number,x1:number,z0:number,z1:number,y:number,rise:number,c:string,ov=.4):void{
  const X0=x0-ov,X1=x1+ov,Z0=z0-ov,Z1=z1+ov,cx=(x0+x1)/2,dr=rise*ov/((x1-x0)/2);
  const pos:number[]=[],uv:number[]=[];
  for(const[xe,s]of[[X0,1],[X1,-1]] as [number,number][]){
    const q=[[xe,y-dr,Z0],[cx,y+rise,Z0],[cx,y+rise,Z1],[xe,y-dr,Z1]];
    const tri=s>0?[0,2,1,0,3,2]:[0,1,2,0,2,3];
    for(const i of tri){const v=q[i];pos.push(...v);uv.push(v[2]/1.2,Math.abs(v[0]-cx)/.45);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,get('telha'+c,()=>matte({color:c,map:tileTex(),side:THREE.DoubleSide})));m.castShadow=true;g.add(m);
}
function tileTex():THREE.Texture{
  return canvasTex(64,64,(x,w,h)=>{
    x.fillStyle='#ffffff';x.fillRect(0,0,w,h);
    for(let r=0;r<4;r++)for(let k=0;k<4;k++){const v=Math.floor(200+((r*7+k*3)%5)*10);x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(k*16+(r%2)*8,r*16,14,16);}
    x.fillStyle='rgba(60,40,30,.5)';for(let r=0;r<4;r++)x.fillRect(0,r*16+13,w,3);
  });
}
// the diagonal-lattice steel railing of the balconies, along a face from s0 to s1
export function latticeRail(g:THREE.Group,f:Face,s0:number,s1:number,y:number,h:number,out:number,c:string):void{
  const m=flat(c);
  onFace(g,f,m,(s0+s1)/2,y+h-.05,s1-s0,.05,out,.05);onFace(g,f,m,(s0+s1)/2,y,s1-s0,.05,out,.05);
  for(let s=s0;s<=s1+1e-3;s+=Math.max(.8,(s1-s0)/Math.ceil((s1-s0)/1.6)))onFace(g,f,m,s,y,.05,h,out,.05);
  const step=.4;
  for(let s=s0;s<s1-.01;s+=step)for(const k of[1,-1]){
    const L=Math.hypot(step,h),[x,yy,z]=f.at(s+step/2,y+h/2,out+.025);
    const bar=new THREE.Mesh(new THREE.BoxGeometry(.025,L,.025),m);bar.position.set(x,yy,z);
    bar.rotation.set(0,f.ry,k*Math.atan2(step,h),'YXZ');g.add(bar);
  }
}

// A hipped clay roof over a convex QUAD [A,B,C,D] whose short ends are AB and CD (a
// trapezoid building on a wedge lot): eaves offset `ov` out of every wall, the ridge
// between the two hip apexes (each set back from its end by half that end's width).
export function hipRoofQuad(g:THREE.Group,q:P2[],y:number,rise:number,c:string,ov=.5):void{
  const cen=centre(q),n=q.length;
  // offset every edge outward by ov and intersect the neighbouring offset lines
  const off=q.map((a,i)=>{const b=q[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);let nx=dz/L,nz=-dx/L;
    if((a[0]+b[0])/2*nx+(a[1]+b[1])/2*nz<cen[0]*nx+cen[1]*nz){nx=-nx;nz=-nz;}return{p:[a[0]+nx*ov,a[1]+nz*ov] as P2,d:[dx,dz] as P2};});
  const E=q.map((_,i)=>{const L1=off[(i+n-1)%n],L2=off[i];
    const den=L1.d[0]*L2.d[1]-L1.d[1]*L2.d[0],t=((L2.p[0]-L1.p[0])*L2.d[1]-(L2.p[1]-L1.p[1])*L2.d[0])/den;
    return[L1.p[0]+L1.d[0]*t,L1.p[1]+L1.d[1]*t] as P2;});
  const[A,B,C,D]=E,mid=(p:P2,r:P2):P2=>[(p[0]+r[0])/2,(p[1]+r[1])/2];
  const m1=mid(A,B),m2=mid(C,D),ax=m2[0]-m1[0],az=m2[1]-m1[1],al=Math.hypot(ax,az);
  const h1=Math.hypot(B[0]-A[0],B[1]-A[1])/2,h2=Math.hypot(D[0]-C[0],D[1]-C[1])/2;
  const R1:P2=[m1[0]+ax/al*h1,m1[1]+az/al*h1],R2:P2=[m2[0]-ax/al*h2,m2[1]-az/al*h2];
  const V=(p:P2,top=false):[number,number,number]=>[p[0],top?y+rise:y,p[1]];
  const tris:[number,number,number][][]=[[V(A),V(B),V(R1,true)],[V(B),V(C),V(R2,true)],[V(B),V(R2,true),V(R1,true)],
    [V(C),V(D),V(R2,true)],[V(D),V(A),V(R1,true)],[V(D),V(R1,true),V(R2,true)]];
  const pos:number[]=[],uv:number[]=[];
  for(const t of tris){
    // wind every face to look up and out
    const[a,b,cc]=t,ux=b[0]-a[0],uz=b[2]-a[2],vx=cc[0]-a[0],vz=cc[2]-a[2];
    const tt=uz*vx-ux*vz<0?[a,cc,b]:t;                  // (the y of the face normal)
    for(const v of tt){pos.push(...v);uv.push((v[0]+v[2])/1.2,v[1]/.45);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();
  const m=new THREE.Mesh(geo,get('telha'+c,()=>matte({color:c,map:tileTex(),side:THREE.DoubleSide})));m.castShadow=true;g.add(m);
  // the white soffit under the eaves
  const s=hPoly(E,y-.04,flat('#e7e3da'),true);g.add(s);
}
