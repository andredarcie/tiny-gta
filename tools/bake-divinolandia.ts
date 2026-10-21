// Bakes Divinolândia (SP) — the real town — to /src/data/divinolandia.json.
// Run with: npm run bake:divinolandia
//
// Sources (downloaded and documented in docs/divinolandia/, see its README):
//   docs/divinolandia/osm/urbano.json   OpenStreetMap extract (streets, rivers, plazas, landmarks)
//   docs/divinolandia/relevo/dem-u16.bin.gz  SRTM-derived elevation (AWS Terrain Tiles, terrarium z15)
//
// Everything is projected to LOCAL METRES centred on the Igreja Matriz (x = east,
// z = south, so north is -z like the rest of the game and the north-up radar), at
// 1:1 real scale. The game adds a fixed world offset (DIV_OX/DIV_OZ in
// src/js/world/divinolandia/data.ts) so the town sits far from the old map.
//
// What the bake decides (deterministic, seeded):
//  - a NEAR heightfield (8 m grid) over the playable area, smoothed, with the street
//    beds levelled across (so cars don't drive tilted on every hillside) and the
//    Rio do Peixe / streams carved into a monotone (always downhill) channel;
//  - a FAR heightfield (48 m) over the whole DEM: the green serras on the horizon;
//  - houses lining the real streets (OSM has almost no buildings mapped here), only
//    inside the urban landuse, only where the satellite evidence shows a building
//    (docs/divinolandia/edificacoes) and never on roads, plazas, vacant lots or landmarks;
//  - riparian forest along the water, wood patches, and coffee rows on the slopes.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {makeRng} from '@/core/rng.ts';
// surveyed streets (lot-by-lot from Street View): no generated houses there, real paving
import {STREETS} from '@/world/divinolandia/ruas/index.ts';
import {chainPieces} from '@/world/divinolandia/ruas/spec.ts';
const SURVEYED=new Map(STREETS.map(s=>[s.rua,s]));
const SETT_STREETS=STREETS.flatMap(s=>s.settStreets??[]);

const here=dirname(fileURLToPath(import.meta.url));
const DOCS=join(here,'..','docs','divinolandia');
const {random,rand}=makeRng(19531230); // municipality created 1953-12-30

// ---------------- projection ----------------
const LAT0=-21.66209, LON0=-46.739323;               // Igreja Matriz (OSM way 542649940)
const MZ=110574, MX=111320*Math.cos(LAT0*Math.PI/180);
const toX=(lon:number):number=>(lon-LON0)*MX;
const toZ=(lat:number):number=>(LAT0-lat)*MZ;
const toLon=(x:number):number=>LON0+x/MX;
const toLat=(z:number):number=>LAT0-z/MZ;

// ---------------- DEM (compact: uint16 decimetres above 500 m, gzip) ----------------
// docs/divinolandia/relevo/dem-u16.bin.gz — written by docs/divinolandia/scripts/render-overview.py
// (2× downsampled z15 terrarium crop, ~8.8 m/px; SRTM itself is 30 m).
type Meta={zoom:number;south:number;west:number;north:number;east:number;rows:number;cols:number};
const meta:Meta=JSON.parse(readFileSync(join(DOCS,'relevo','dem-u16-meta.json'),'utf8'));
const raw=gunzipSync(readFileSync(join(DOCS,'relevo','dem-u16.bin.gz')));
const dem=new Float32Array(meta.rows*meta.cols);
for(let i=0;i<dem.length;i++)dem[i]=raw.readUInt16LE(2*i)/10+500;
const merc=(lat:number,lon:number):[number,number]=>{
  const n=2**meta.zoom*256;
  return[(lon+180)/360*n,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n];
};
const [MOX,MOY]=merc(meta.north,meta.west);
function demAt(lat:number,lon:number):number{
  const[mx,my]=merc(lat,lon);
  let x=(mx-MOX)/2-.5,y=(my-MOY)/2-.5;               // one DEM pixel = 2 z15 pixels
  x=Math.max(0,Math.min(meta.cols-1.001,x));y=Math.max(0,Math.min(meta.rows-1.001,y));
  const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0,C=meta.cols;
  const a=dem[y0*C+x0],b=dem[y0*C+x0+1],c=dem[(y0+1)*C+x0],d=dem[(y0+1)*C+x0+1];
  return(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
}
const demXZ=(x:number,z:number):number=>demAt(toLat(z),toLon(x));

// ---------------- grids ----------------
const CELL=8, NX0=-1500, NZ0=-1150, NNX=376, NNZ=411;  // near: x -1500..1500, z -1150..2130
const near=new Float64Array(NNX*NNZ);
for(let j=0;j<NNZ;j++)for(let i=0;i<NNX;i++)near[j*NNX+i]=demXZ(NX0+i*CELL,NZ0+j*CELL);
function blur(g:Float64Array,nx:number,nz:number):void{
  const t=new Float64Array(g);
  for(let j=1;j<nz-1;j++)for(let i=1;i<nx-1;i++){
    let s=0;for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++)s+=t[(j+b)*nx+i+a];
    g[j*nx+i]=s/9;
  }
}
blur(near,NNX,NNZ);blur(near,NNX,NNZ);
const nearAt=(x:number,z:number):number=>{            // bilinear on the near grid (bake-time only)
  let fx=(x-NX0)/CELL,fz=(z-NZ0)/CELL;
  fx=Math.max(0,Math.min(NNX-1.001,fx));fz=Math.max(0,Math.min(NNZ-1.001,fz));
  const i=Math.floor(fx),j=Math.floor(fz),u=fx-i,v=fz-j;
  const a=near[j*NNX+i],b=near[j*NNX+i+1],c=near[(j+1)*NNX+i],d=near[(j+1)*NNX+i+1];
  return(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v;
};
const inNear=(x:number,z:number,m=0):boolean=>x>NX0+m&&x<NX0+(NNX-1)*CELL-m&&z>NZ0+m&&z<NZ0+(NNZ-1)*CELL-m;

const FCELL=48;
const fx0=Math.ceil(toX(meta.west)/FCELL)*FCELL+FCELL, fz0=Math.ceil(toZ(meta.north)/FCELL)*FCELL+FCELL;
const fx1=Math.floor(toX(meta.east)/FCELL)*FCELL-FCELL, fz1=Math.floor(toZ(meta.south)/FCELL)*FCELL-FCELL;
const FNX=Math.round((fx1-fx0)/FCELL)+1, FNZ=Math.round((fz1-fz0)/FCELL)+1;
const far=new Float64Array(FNX*FNZ);
for(let j=0;j<FNZ;j++)for(let i=0;i<FNX;i++)far[j*FNX+i]=demXZ(fx0+i*FCELL,fz0+j*FCELL);

// ---------------- OSM ----------------
type OsmEl={type:string;id:number;tags?:Record<string,string>;geometry?:{lat:number;lon:number}[];lat?:number;lon?:number};
const osm:{elements:OsmEl[]}=JSON.parse(readFileSync(join(DOCS,'osm','urbano.json'),'utf8'));
type P2=[number,number];
const geomXZ=(e:OsmEl):P2[]=>(e.geometry||[]).map(p=>[toX(p.lon),toZ(p.lat)]);
const byId=new Map<string,OsmEl>();for(const e of osm.elements)byId.set(e.type+'/'+e.id,e);
function pip(p:P2,poly:P2[]):boolean{
  let ins=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const[xi,zi]=poly[i],[xj,zj]=poly[j];
    if((zi>p[1])!==(zj>p[1])&&p[0]<(xj-xi)*(p[1]-zi)/(zj-zi)+xi)ins=!ins;
  }
  return ins;
}
const centroid=(pts:P2[]):P2=>{let x=0,z=0;for(const p of pts){x+=p[0];z+=p[1];}return[x/pts.length,z/pts.length];};
function segDist(px:number,pz:number,ax:number,az:number,bx:number,bz:number):[number,number]{
  const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;
  let t=((px-ax)*dx+(pz-az)*dz)/l2;t=t<0?0:t>1?1:t;
  return[Math.hypot(px-ax-t*dx,pz-az-t*dz),t];
}
// minimum-area oriented rectangle of a polygon (rotating calipers over hull edges, brute force)
function obb(pts:P2[]):{cx:number;cz:number;w:number;d:number;rot:number}{
  let best={cx:0,cz:0,w:0,d:0,rot:0},bestA=Infinity;
  for(let i=0;i<pts.length;i++){
    const[ax,az]=pts[i],[bx,bz]=pts[(i+1)%pts.length];
    const a=Math.atan2(bz-az,bx-ax),c=Math.cos(a),s=Math.sin(a);
    let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
    for(const[x,z]of pts){const u=x*c+z*s,v=-x*s+z*c;u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);}
    const A=(u1-u0)*(v1-v0);
    if(A<bestA&&A>0){bestA=A;const uc=(u0+u1)/2,vc=(v0+v1)/2;
      best={cx:uc*c-vc*s,cz:uc*s+vc*c,w:u1-u0,d:v1-v0,rot:a};}
  }
  return best;
}
const r1=(v:number):number=>Math.round(v*10)/10;

// ---------------- roads ----------------
const HW:Record<string,number>={primary:4.6,primary_link:3.6,secondary:4.2,tertiary:4,residential:3.6,
  living_street:3,unclassified:3.3,service:2.6,track:2.2};
const PAVED_SURF=new Set(['asphalt','paved','concrete','paving_stones','sett','cobblestone','concrete:plates']);
type Road={id:number;k:string;name:string;hw:number;paved:boolean;pts:P2[];sf?:'asphalt'|'sett'};
const roads:Road[]=[];
// urban landuse polygons (houses only inside these, or near the paved town streets)
const urbanPolys:P2[][]=[],noBuild:P2[][]=[];
for(const e of osm.elements){
  const t=e.tags||{};if(!e.geometry)continue;
  if(t.landuse==='residential'||t.landuse==='retail'||t.landuse==='commercial')urbanPolys.push(geomXZ(e));
  if(t.landuse==='greenfield'||t.landuse==='cemetery'||t.landuse==='village_green'||t.landuse==='landfill'||
     t.leisure||t.amenity||t.natural==='water'||t.man_made||t.building)noBuild.push(geomXZ(e));
}
const inUrbanPoly=(p:P2):boolean=>urbanPolys.some(q=>pip(p,q));
for(const e of osm.elements){
  const t=e.tags||{};
  if(!e.geometry||!(t.highway in HW))continue;
  const pts=geomXZ(e);
  if(!pts.some(p=>inNear(p[0],p[1],-200)))continue;
  const surf=t.surface;
  let paved=surf?PAVED_SURF.has(surf):['primary','primary_link','secondary','tertiary','residential','living_street'].includes(t.highway);
  if(!surf&&!paved)paved=inUrbanPoly(centroid(pts));
  roads.push({id:e.id,k:t.highway,name:t.name||'',hw:HW[t.highway],paved,pts});
}
// resample every 4 m with a smoothed elevation profile (bake-time road bed)
type RS={x:number;z:number;h:number;hw:number};
const roadSamples:RS[]=[];
for(const r of roads){
  const s:RS[]=[];
  for(let k=1;k<r.pts.length;k++){
    const[ax,az]=r.pts[k-1],[bx,bz]=r.pts[k],L=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(L/4));
    for(let q=(k===1?0:1);q<=n;q++){const t=q/n,x=ax+(bx-ax)*t,z=az+(bz-az)*t;s.push({x,z,h:nearAt(x,z),hw:r.hw});}
  }
  const sm=s.map((_,i)=>{let a=0,c=0;for(let w=-4;w<=4;w++){const o=s[i+w];if(o){a+=o.h;c++;}}return a/c;});
  s.forEach((p,i)=>{p.h=sm[i];});
  roadSamples.push(...s.filter(p=>inNear(p.x,p.z,-20)));
}
// spatial hash of road samples
const HC=24;
const hkey=(x:number,z:number):number=>Math.floor(x/HC)*100003+Math.floor(z/HC);
const rHash=new Map<number,RS[]>();
for(const p of roadSamples){const k=hkey(p.x,p.z);let a=rHash.get(k);if(!a){a=[];rHash.set(k,a);}a.push(p);}
function nearestRoad(x:number,z:number,reach:number):{d:number;p:RS|null}{
  let best=Infinity,bp:RS|null=null;const R=Math.ceil(reach/HC);
  const ci=Math.floor(x/HC),cj=Math.floor(z/HC);
  for(let a=-R;a<=R;a++)for(let b=-R;b<=R;b++){
    const arr=rHash.get((ci+a)*100003+cj+b);if(!arr)continue;
    for(const p of arr){const d=Math.hypot(p.x-x,p.z-z)-p.hw;if(d<best){best=d;bp=p;}}
  }
  return{d:best,p:bp};
}
// level the street beds into the near grid
for(let j=0;j<NNZ;j++)for(let i=0;i<NNX;i++){
  const x=NX0+i*CELL,z=NZ0+j*CELL,{d,p}=nearestRoad(x,z,14);
  if(!p)continue;
  const w=d<=1?1:d>=7?0:1-((d-1)/6)**2*(3-2*(d-1)/6);
  if(w>0)near[j*NNX+i]=near[j*NNX+i]*(1-w)+p.h*w;
}
// road edge heights are re-read from the levelled grid at runtime, nothing else to store

// ---------------- water ----------------
type Water={name:string;river:boolean;hw:number;pts:[number,number,number][]}; // x,z,surfaceY
const waters:Water[]=[];
// 1) every watercourse: resample 4 m, sample the valley floor (min across the channel and
// its banks: the mapped line can run a few metres off the real valley floor), force the
// surface monotone downstream (OSM ways point downstream)
type Course={name:string;river:boolean;hw:number;depth:number;cut:number;surf:[number,number,number][]};
const courses:Course[]=[];
for(const e of osm.elements){
  const t=e.tags||{};
  if(!e.geometry||(t.waterway!=='river'&&t.waterway!=='stream'))continue;
  const pts=geomXZ(e).filter(p=>inNear(p[0],p[1],4));
  if(pts.length<2)continue;
  const river=t.waterway==='river'||t.name==='Rio do Peixe';
  const hw=river?6:1.6,depth=river?2.2:.5,cut=river?hw+1.5:5;
  const s:[number,number,number][]=[];
  for(let k=1;k<pts.length;k++){
    const[ax,az]=pts[k-1],[bx,bz]=pts[k],L=Math.hypot(bx-ax,bz-az),n=Math.max(1,Math.ceil(L/4));
    const nx=-(bz-az)/(L||1),nz=(bx-ax)/(L||1);
    for(let q=(k===1?0:1);q<=n;q++){
      const tt=q/n,x=ax+(bx-ax)*tt,z=az+(bz-az)*tt;
      let m=Infinity;for(let o=-cut-CELL;o<=cut+CELL;o+=2)m=Math.min(m,nearAt(x+nx*o,z+nz*o));
      s.push([x,z,m]);
    }
  }
  for(let k=1;k<s.length;k++)s[k][2]=Math.min(s[k][2],s[k-1][2]);
  courses.push({name:t.name||'',river,hw,depth,cut,surf:s.map(p=>[p[0],p[1],p[2]-.25])});
}
// 2) a stream meets the water it flows into at that water's level (no step of water
// hanging over the river at a confluence): from its first point inside the other channel
// on, it runs no higher than the other's surface there
for(const c of courses){
  if(c.river)continue;
  for(let k=0;k<c.surf.length;k++){
    const[x,z,y]=c.surf[k];
    for(const o of courses){
      if(o===c)continue;
      for(const q of o.surf)if(q[2]<y&&Math.hypot(q[0]-x,q[1]-z)<o.cut+c.cut){c.surf[k][2]=q[2];break;}
    }
    if(k)c.surf[k][2]=Math.min(c.surf[k][2],c.surf[k-1][2]);
  }
}
// 3) carve a NARROW channel: the bed drops below the surface only within `cut` of the
// centreline (the grid is 8 m, so every cross-section keeps at least one node in it) and
// the ring of nodes just past it is kept at least BANK above the surface — the shoreline
// then lies within one cell of the channel, where water.ts finds it and the drawn water
// meets the bank instead of hovering over a wide carved ditch. Where a road crosses, its
// bed stays up and is raised clear of the water (a culvert / bridge hump). The edits of
// all the courses are applied together (a stream's bank must never refill the bed of the
// river it joins).
const BANK=.5,DECK=.8,ROAD_KEEP=5;
// (a bank or road node takes the level of the NEAREST stretch of the course: on a steep stream the
// level a few metres upstream is metres higher)
const bed=new Map<number,number>(),bank=new Map<number,{d:number;v:number}>(),deck=new Map<number,{d:number;v:number}>();
for(const c of courses){
  // (roads are kept clear of the water a little further out: the shoreline can spread)
  const reach=c.cut+2*CELL,R=Math.ceil(reach/CELL)+1;
  for(const[x,z,h]of c.surf){
    const ci=Math.round((x-NX0)/CELL),cj=Math.round((z-NZ0)/CELL);
    for(let b=-R;b<=R;b++)for(let a=-R;a<=R;a++){
      const i=ci+a,j=cj+b;if(i<0||j<0||i>=NNX||j>=NNZ)continue;
      const gx=NX0+i*CELL,gz=NZ0+j*CELL,dd=Math.hypot(gx-x,gz-z),idx=j*NNX+i;
      if(dd>reach)continue;
      // (every node of the cells the roadway crosses: a channel node one cell off would tilt it)
      if(nearestRoad(gx,gz,12).d<ROAD_KEEP){const q=deck.get(idx);if(!q||dd<q.d)deck.set(idx,{d:dd,v:h+DECK});continue;}
      if(dd>c.cut+CELL)continue;
      if(dd<c.cut)bed.set(idx,Math.min(bed.get(idx)??Infinity,h-c.depth*(1-(dd/c.cut)**2)));
      else{const b=bank.get(idx);if(!b||dd<b.d)bank.set(idx,{d:dd,v:h+BANK});}
    }
  }
  waters.push({name:c.name,river:c.river,hw:c.hw,pts:c.surf.filter((_,k)=>k%2===0||k===c.surf.length-1).map(p=>[r1(p[0]),r1(p[1]),r1(p[2])])});
}
// (a node far below the water is another valley, a road cut or a stream junction already
// carved: only the banks and road beds within a step of the water are raised)
const RAISE_MAX=1.5;
for(const[idx,{v}]of bank)if(!bed.has(idx)&&!deck.has(idx)&&near[idx]<v&&v-near[idx]<RAISE_MAX)near[idx]=v;
for(const[idx,v]of bed)if(!deck.has(idx)&&near[idx]>v)near[idx]=v;
// raise the road beds at the crossings, easing the hump out along the road: each road node
// around a raised one gets that raise minus RAMP per cell (≈ 10 %), so a culvert is a gentle
// hump, not a kerb, and the road keeps its own grade under it
{
  const RAMP=.8,lift=new Map<number,number>();
  for(const[idx,{v}]of deck)if(near[idx]<v&&v-near[idx]<RAISE_MAX)lift.set(idx,v-near[idx]);
  let front=[...lift.keys()];
  while(front.length){
    const next:number[]=[];
    for(const idx of front){
      const i=idx%NNX,j=(idx-i)/NNX,r=lift.get(idx)!;
      for(let b=-1;b<=1;b++)for(let a=-1;a<=1;a++){
        const ii=i+a,jj=j+b;if((!a&&!b)||ii<0||jj<0||ii>=NNX||jj>=NNZ)continue;
        const k=jj*NNX+ii,rk=r-RAMP*Math.hypot(a,b);
        if(rk<=.02||(lift.get(k)??0)>=rk||bed.has(k)||nearestRoad(NX0+ii*CELL,NZ0+jj*CELL,12).d>=ROAD_KEEP)continue;
        lift.set(k,rk);next.push(k);
      }
    }
    front=next;
  }
  for(const[idx,r]of lift)near[idx]+=r;
}
const waterSegs:{ax:number;az:number;bx:number;bz:number;hw:number}[]=[];
for(const w of waters)for(let k=1;k<w.pts.length;k++)
  waterSegs.push({ax:w.pts[k-1][0],az:w.pts[k-1][1],bx:w.pts[k][0],bz:w.pts[k][1],hw:w.hw});
const nearWater=(x:number,z:number,m:number):boolean=>waterSegs.some(s=>segDist(x,z,s.ax,s.az,s.bx,s.bz)[0]<s.hw+m);
// keep only the near-region polylines of the roads for the game
for(const r of roads)r.pts=r.pts.filter((p,k,a)=>inNear(p[0],p[1],-60)||(a[k-1]&&inNear(a[k-1][0],a[k-1][1],-60))||(a[k+1]&&inNear(a[k+1][0],a[k+1][1],-60)));

// ---------------- landmarks ----------------
type Poly={name:string;kind:string;pts:P2[]};
const plazas:Poly[]=[],areas:Poly[]=[],osmBuildings:{name:string;kind:string;cx:number;cz:number;w:number;d:number;rot:number}[]=[];
const SKIP_BLD=new Set([542649940]);                    // the Matriz gets its own model
for(const e of osm.elements){
  const t=e.tags||{};if(!e.geometry||e.type!=='way')continue;
  const pts=geomXZ(e);if(!pts.some(p=>inNear(p[0],p[1],10)))continue;
  if(t.leisure==='park')plazas.push({name:t.name||'',kind:'praca',pts});
  else if(t.landuse==='village_green')plazas.push({name:t.name||'',kind:'verde',pts});
  else if(t.leisure==='pitch')areas.push({name:t.name||'',kind:'campo',pts});
  else if(t.leisure==='stadium')areas.push({name:t.name||'',kind:'estadio',pts});
  else if(t.landuse==='cemetery')areas.push({name:t.name||'',kind:'cemiterio',pts});
  else if(t.amenity==='school')areas.push({name:t.name||'',kind:'escola',pts});
  else if(t.amenity==='hospital')areas.push({name:t.name||'',kind:'hospital',pts});
  else if(t.man_made==='tower')areas.push({name:t.name||'',kind:'torre',pts});
  if(t.building&&!SKIP_BLD.has(e.id)){const o=obb(pts);osmBuildings.push({name:t.name||'',kind:t.amenity||t.building,cx:r1(o.cx),cz:r1(o.cz),w:r1(o.w),d:r1(o.d),rot:Math.round(o.rot*1000)/1000});}
}
const pt=(id:string):P2=>{const e=byId.get(id)!;return e.geometry?centroid(geomXZ(e)):[toX(e.lon!),toZ(e.lat!)];};
const church=obb(geomXZ(byId.get('way/542649940')!));
const pracaMatriz=pt('way/542649936');                   // Praça Dr. Alcindo Cardoso de Paiva
const landmarks={
  matriz:{cx:r1(church.cx),cz:r1(church.cz),w:r1(church.w),d:r1(church.d),rot:church.rot,
    // the façade faces the main plaza: yaw that turns model +z toward it
    face:Math.atan2(pracaMatriz[0]-church.cx,pracaMatriz[1]-church.cz)},
  pracaMatriz:{x:r1(pracaMatriz[0]),z:r1(pracaMatriz[1])},
  prefeitura:pt('way/543759772').map(r1),
  hospital:pt('way/542649938').map(r1),
  torre:pt('way/543759751').map(r1),
  torresCelular:[pt('node/8051191473'),pt('node/8051191474'),pt('node/8051200595')].map(p=>p.map(r1)),
  estadio:pt('way/542649859').map(r1),
  cemiterio:pt('way/536783868').map(r1),
  posto:pt('node/13690275377').map(r1),
  policiaMilitar:pt('node/13690279160').map(r1),
};

// ---------------- houses ----------------
type House={x:number;z:number;w:number;d:number;rot:number;fl:number;c:number;roof:number;shop:number};
const houses:House[]=[];
const hHash=new Map<number,House[]>();
const corners=(h:{x:number;z:number;w:number;d:number;rot:number}):P2[]=>{
  const c=Math.cos(h.rot),s=Math.sin(h.rot),out:P2[]=[];
  for(const[u,v]of[[-1,-1],[1,-1],[1,1],[-1,1]]){const lu=u*h.w/2,lv=v*h.d/2;out.push([h.x+lu*c-lv*s,h.z+lu*s+lv*c]);}
  return out;
};
function obbOverlap(a:P2[],b:P2[]):boolean{               // separating axis test (2 rectangles)
  for(const poly of[a,b])for(let i=0;i<4;i++){
    const[p1,p2]=[poly[i],poly[(i+1)%4]],nx=p2[1]-p1[1],nz=p1[0]-p2[0];
    let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
    for(const p of a){const d=p[0]*nx+p[1]*nz;amin=Math.min(amin,d);amax=Math.max(amax,d);}
    for(const p of b){const d=p[0]*nx+p[1]*nz;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d);}
    if(amax<=bmin||bmax<=amin)return false;
  }
  return true;
}
// level building pads (mean height inside r, blended back to the slope over 14 m) so the
// big landmarks stand on flat ground — the same grid the physics reads, so no floating
function pad(cx:number,cz:number,r:number):void{
  let s=0,c=0;
  for(let j=0;j<NNZ;j++)for(let i=0;i<NNX;i++){const x=NX0+i*CELL,z=NZ0+j*CELL;if(Math.hypot(x-cx,z-cz)<r){s+=near[j*NNX+i];c++;}}
  if(!c)return;const m=s/c;
  for(let j=0;j<NNZ;j++)for(let i=0;i<NNX;i++){
    const x=NX0+i*CELL,z=NZ0+j*CELL,d=Math.hypot(x-cx,z-cz);if(d>r+14)continue;
    const w=d<=r?1:1-((d-r)/14)**2*(3-2*(d-r)/14);
    near[j*NNX+i]=near[j*NNX+i]*(1-w)+m*w;
  }
}
pad(church.cx,church.cz,20);
pad(landmarks.hospital[0],landmarks.hospital[1],40);
pad(landmarks.torre[0],landmarks.torre[1],16);
const MATRIZ_KEEP=Math.hypot(church.w,church.d)/2+14;
const landmarkKeep:[number,number,number][]=[
  [church.cx,church.cz,MATRIZ_KEEP],[landmarks.hospital[0],landmarks.hospital[1],70],
  [landmarks.torre[0],landmarks.torre[1],40],[landmarks.prefeitura[0],landmarks.prefeitura[1],16],
];
// keep generated houses off the surveyed street (its lots come from the street spec)
const surveyedPts=roads.filter(r=>SURVEYED.has(r.name)).map(r=>r.pts);
function nearSurveyed(x:number,z:number,m:number):boolean{
  for(const pts of surveyedPts)for(let i=1;i<pts.length;i++)
    if(segDist(x,z,pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1])[0]<m)return true;
  return false;
}
const townStreet=new Set(['residential','tertiary','secondary','primary','living_street','unclassified']);
// Where there really is a building (docs/divinolandia/edificacoes, written by
// scripts/construido.py): 1 byte per metre, bit 1 = an ML-detected building footprint,
// bit 2 = a building on the Google Maps road map, bit 4 = a zone traced on the Google Maps
// satellite photo where houses stand that neither map has yet. A generated house stands
// only where one of them says so — no house in a pasture, a wood or an empty lot.
const BUILT_META:{x0:number;z0:number;nx:number;nz:number;cell:number}=JSON.parse(readFileSync(join(DOCS,'edificacoes','construido-1m-meta.json'),'utf8'));
const built=gunzipSync(readFileSync(join(DOCS,'edificacoes','construido-1m.bin.gz')));
function builtEvidence(h:{x:number;z:number;w:number;d:number;rot:number}):boolean{
  const c=Math.cos(h.rot),s=Math.sin(h.rot),M=BUILT_META;let ms=0,gm=0,zone=0,n=0;
  for(let a=0;a<9;a++)for(let b=0;b<11;b++){
    const u=(a/8-.5)*.84*h.w,v=(b/10-.5)*.84*h.d,i=Math.floor((h.x+u*c-v*s-M.x0)/M.cell),j=Math.floor((h.z+u*s+v*c-M.z0)/M.cell);
    n++;if(i<0||j<0||i>=M.nx||j>=M.nz)continue;
    const k=built[j*M.nx+i];if(k&1)ms++;if(k&2)gm++;if(k&4)zone++;
  }
  return ms/n>=.15||gm/n>=.15||zone/n>=.5;
}
// every road as segments, with the clearance a house keeps from its centreline: the paved
// town streets get a 2.1 m sidewalk at runtime (build.ts), so their whole sidewalk stays free
type RSeg={ax:number;az:number;bx:number;bz:number;need:number};
const rsegHash=new Map<number,RSeg[]>();
for(const r of roads){
  const need=r.hw+(r.paved&&r.k!=='primary'&&r.k!=='primary_link'&&!SURVEYED.has(r.name)?2.15:.3);
  for(let k=1;k<r.pts.length;k++){
    const g:RSeg={ax:r.pts[k-1][0],az:r.pts[k-1][1],bx:r.pts[k][0],bz:r.pts[k][1],need},m=need+1;
    for(let i=Math.floor((Math.min(g.ax,g.bx)-m)/HC);i<=Math.floor((Math.max(g.ax,g.bx)+m)/HC);i++)
      for(let j=Math.floor((Math.min(g.az,g.bz)-m)/HC);j<=Math.floor((Math.max(g.az,g.bz)+m)/HC);j++){
        const key=i*100003+j;let a=rsegHash.get(key);if(!a){a=[];rsegHash.set(key,a);}a.push(g);
      }
  }
}
const onRoadBand=(x:number,z:number):boolean=>
  (rsegHash.get(Math.floor(x/HC)*100003+Math.floor(z/HC))||[]).some(g=>segDist(x,z,g.ax,g.az,g.bx,g.bz)[0]<g.need);
// points covering a footprint (edges and inside, ≤ 1 m apart)
function footprint(h:{x:number;z:number;w:number;d:number;rot:number}):P2[]{
  const c=Math.cos(h.rot),s=Math.sin(h.rot),out:P2[]=[];
  const nu=Math.ceil(h.w),nv=Math.ceil(h.d);
  for(let a=0;a<=nu;a++)for(let b=0;b<=nv;b++){
    const lu=(a/nu-.5)*h.w,lv=(b/nv-.5)*h.d;out.push([h.x+lu*c-lv*s,h.z+lu*s+lv*c]);
  }
  return out;
}
const bbox=(q:P2[]):[number,number,number,number]=>[Math.min(...q.map(p=>p[0])),Math.min(...q.map(p=>p[1])),Math.max(...q.map(p=>p[0])),Math.max(...q.map(p=>p[1]))];
const noBuildBox=noBuild.map(bbox);
const inNoBuild=(p:P2):boolean=>noBuild.some((q,k)=>{const b=noBuildBox[k];return p[0]>=b[0]&&p[0]<=b[2]&&p[1]>=b[1]&&p[1]<=b[3]&&pip(p,q);});
// the OSM buildings are drawn as boxes of at least 8 m (build.ts), the cell towers stand on 4 m pads
const osmBoxes=osmBuildings.map(b=>corners({x:b.cx,z:b.cz,w:Math.max(8,b.w)+1,d:Math.max(8,b.d)+1,rot:b.rot}));
const towerBoxes=landmarks.torresCelular.map(([x,z])=>corners({x,z,w:7,d:7,rot:0}));
let tried=0;
for(const r of roads){
  if(!townStreet.has(r.k)||SURVEYED.has(r.name))continue;
  for(const side of[-1,1]){
    for(let k=1;k<r.pts.length;k++){
      const[ax,az]=r.pts[k-1],[bx,bz]=r.pts[k],L=Math.hypot(bx-ax,bz-az);
      if(L<8)continue;
      const ux=(bx-ax)/L,uz=(bz-az)/L,nx=-uz*side,nz=ux*side;
      let s=rand(1,3);
      while(s<L-4){
        tried++;
        const shop=random();
        const w=rand(6.5,10.5),d=rand(10,15),set=r.hw+2.2+rand(0,.6);
        const mx=ax+ux*(s+w/2),mz=az+uz*(s+w/2);
        // rot turns the house's local +z (its façade: door + windows) toward this street
        const h={x:mx+nx*(set+d/2),z:mz+nz*(set+d/2),w,d,rot:Math.atan2(uz,ux)+(side>0?Math.PI:0)};
        s+=w+(random()<.55?rand(.15,.5):rand(1.5,4));
        const P:P2=[h.x,h.z],front:P2=[mx+nx*set,mz+nz*set];
        if(!inNear(h.x,h.z,40))continue;
        const dc=Math.hypot(h.x,h.z);
        const urban=inUrbanPoly(P)||inUrbanPoly(front)||(r.paved&&dc<900&&r.k!=='primary');
        if(!urban)continue;
        if(landmarkKeep.some(([x,z,R])=>Math.hypot(h.x-x,h.z-z)<R))continue;
        if(nearSurveyed(h.x,h.z,24))continue;
        if(!builtEvidence({x:r1(h.x),z:r1(h.z),w:r1(w),d:r1(d),rot:Math.round(h.rot*1000)/1000}))continue;   // (as stored)
        const fp=footprint(h);
        if(fp.some(inNoBuild))continue;
        const cs=corners(h);
        if(fp.some(p=>onRoadBand(p[0],p[1])))continue;
        if(osmBoxes.some(b=>obbOverlap(cs,b))||towerBoxes.some(b=>obbOverlap(cs,b)))continue;
        if(nearWater(h.x,h.z,d/2+3))continue;
        const hs=cs.map(c=>nearAt(c[0],c[1]));
        if(Math.max(...hs)-Math.min(...hs)>5.5)continue;
        // the door keeps to the street: the floor rises at most 2.4 m under the high corner
        // (build.ts), so a steeper lot would leave the door more than a short flight up
        if(Math.max(...hs)-nearAt(front[0],front[1])>3.5)continue;
        const k0=Math.floor(h.x/20),k1=Math.floor(h.z/20);let clash=false;
        for(let a=-1;a<=1&&!clash;a++)for(let b=-1;b<=1&&!clash;b++){
          for(const o of hHash.get((k0+a)*100003+k1+b)||[])if(obbOverlap(cs,corners({...o,w:o.w+.3,d:o.d+.3}))){clash=true;break;}  // + the rounding of the stored houses
        }
        if(clash)continue;
        const central=dc<260;
        const fl=central?(random()<.45?2:random()<.12?3:1):(random()<.16?2:1);
        const hh:House={x:r1(h.x),z:r1(h.z),w:r1(w),d:r1(d),rot:Math.round(h.rot*1000)/1000,fl,
          c:Math.floor(random()*12),roof:random()<(fl>1?.55:.2)?1:0,shop:central&&shop<.55?1+Math.floor(random()*5):0};
        houses.push(hh);
        const kk=k0*100003+k1;let arr=hHash.get(kk);if(!arr){arr=[];hHash.set(kk,arr);}arr.push(hh);
      }
    }
  }
}

// ---------------- vegetation ----------------
const trees:number[]=[];          // flat x,z,scale triplets
const coffee:number[]=[];         // flat x,z,yaw triplets (one hedge segment of a coffee row)
const blocked=(x:number,z:number,m:number):boolean=>{
  if(nearestRoad(x,z,m+8).d<m)return true;
  const k0=Math.floor(x/20),k1=Math.floor(z/20);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const o of hHash.get((k0+a)*100003+k1+b)||[])
    if(Math.hypot(o.x-x,o.z-z)<Math.max(o.w,o.d)/2+m)return true;
  return false;
};
function inHouse(x:number,z:number,m:number):boolean{
  const k0=Math.floor(x/20),k1=Math.floor(z/20);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const o of hHash.get((k0+a)*100003+k1+b)||[]){
    const c=Math.cos(o.rot),s=Math.sin(o.rot),dx=x-o.x,dz=z-o.z;
    if(Math.abs(dx*c+dz*s)<o.w/2+m&&Math.abs(-dx*s+dz*c)<o.d/2+m)return true;
  }
  return false;
}
const urbanAt=(x:number,z:number):boolean=>inUrbanPoly([x,z])||Math.hypot(x,z)<420;
// the mapped grounds the game draws (build.ts): no wood on a pitch, a schoolyard or among
// the graves; coffee on none of them
const grounds=[...plazas,...areas].map(p=>({kind:p.kind,pts:p.pts,box:bbox(p.pts)}));
const onGround=(x:number,z:number,kinds:(k:string)=>boolean):boolean=>grounds.some(g=>kinds(g.kind)&&
  x>=g.box[0]&&x<=g.box[2]&&z>=g.box[1]&&z<=g.box[3]&&pip([x,z],g.pts));
const treeBanned=(k:string):boolean=>k==='campo'||k==='estadio'||k==='cemiterio'||k==='escola'||k==='praca';
const treeBlocked=(x:number,z:number,m:number):boolean=>blocked(x,z,m)||onGround(x,z,treeBanned);
// one coffee instance = three 9.2 m hedges 3.4 m apart along the row (vegetacao.ts makeCoffee)
function coffeeBlocked(cx:number,cz:number,yaw:number):boolean{
  const c=Math.cos(yaw),s=Math.sin(yaw);
  for(const o of[-3.4,0,3.4])for(let t=-4.6;t<=4.6;t+=2.3){
    const x=cx-s*o+c*t,z=cz+c*o+s*t;
    if((rsegHash.get(Math.floor(x/HC)*100003+Math.floor(z/HC))||[]).some(g=>segDist(x,z,g.ax,g.az,g.bx,g.bz)[0]<g.need+1))return true;
    if(nearWater(x,z,1)||onGround(x,z,()=>true)||inHouse(x,z,1))return true;
  }
  return false;
}
// riparian forest: the valleys of the photos are wooded along every stream
for(const s of waterSegs){
  const L=Math.hypot(s.bx-s.ax,s.bz-s.az);
  for(let t=0;t<L;t+=rand(5,9)){
    const x0=s.ax+(s.bx-s.ax)*t/L,z0=s.az+(s.bz-s.az)*t/L;
    for(const side of[-1,1]){
      const o=s.hw+rand(3,s.hw>3?26:16),nx=-(s.bz-s.az)/L*side,nz=(s.bx-s.ax)/L*side;
      const x=x0+nx*o+rand(-2,2),z=z0+nz*o+rand(-2,2);
      if(!inNear(x,z,8)||treeBlocked(x,z,4)||nearWater(x,z,1.5)||(urbanAt(x,z)&&random()<.7))continue;
      trees.push(r1(x),r1(z),Math.round(rand(.8,1.5)*100)/100);
    }
  }
}
// low-frequency "land cover" noise: forest patches, coffee patches, pasture elsewhere
const vn=(x:number,z:number):number=>Math.sin(x*.0061+1.3)*Math.cos(z*.0053-.7)+.6*Math.sin(x*.0127-z*.0094+2.1)+.35*Math.sin(z*.021+x*.017);
const slope=(x:number,z:number):number=>Math.hypot(nearAt(x+4,z)-nearAt(x-4,z),nearAt(x,z+4)-nearAt(x,z-4))/8;
for(let n=0;n<26000;n++){
  const x=rand(NX0+20,NX0+(NNX-1)*CELL-20),z=rand(NZ0+20,NZ0+(NNZ-1)*CELL-20);
  if(urbanAt(x,z))continue;
  const v=vn(x,z);
  if(v>.85&&!treeBlocked(x,z,5)&&!nearWater(x,z,2))trees.push(r1(x),r1(z),Math.round(rand(.9,1.6)*100)/100);
  else if(v<.4&&random()<.06&&!treeBlocked(x,z,5)&&!nearWater(x,z,2))trees.push(r1(x),r1(z),Math.round(rand(1,1.7)*100)/100); // lone pasture tree
}
// coffee: rows along the contour lines (perpendicular to the slope), on moderate slopes
for(let n=0;n<9000;n++){
  const cx=rand(-1300,1300),cz=rand(-950,1900);
  const v=vn(cx,cz);if(v>-.15||v<-1.25)continue;
  if(urbanAt(cx,cz)||Math.hypot(cx,cz)<500)continue;
  const sl=slope(cx,cz);if(sl<.05||sl>.55)continue;
  const gx=nearAt(cx+4,cz)-nearAt(cx-4,cz),gz=nearAt(cx,cz+4)-nearAt(cx,cz-4);
  const yaw=Math.atan2(-gx,gz);                          // row direction ⟂ gradient
  if(blocked(cx,cz,6)||nearWater(cx,cz,6)||coffeeBlocked(cx,cz,yaw))continue;
  coffee.push(r1(cx),r1(cz),Math.round(yaw*100)/100);
  if(coffee.length>=3*7000)break;
}

// ---------------- real paving (surveyed) ----------------
function cut(pts:P2[],a:number,b:number):P2[]{             // sub-polyline between arc lengths a..b
  const out:P2[]=[];let acc=0;
  const at=(i:number,t:number):P2=>[pts[i-1][0]+(pts[i][0]-pts[i-1][0])*t,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t];
  for(let i=1;i<pts.length;i++){
    const L=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]),s0=acc,s1=acc+L;acc=s1;
    if(s1<a||s0>b)continue;
    if(!out.length)out.push(at(i,Math.max(0,(a-s0)/(L||1))));
    out.push(at(i,Math.min(1,(b-s0)/(L||1))));
  }
  return out;
}
{
  const out:Road[]=[];
  // each surveyed street: its OSM pieces chained into one polyline (the spec's arc-length
  // frame), then cut into the surveyed surface pieces, in order
  const done=new Set<string>();
  for(const r of roads){
    const spec=SURVEYED.get(r.name);
    if(spec){
      if(done.has(r.name))continue;done.add(r.name);
      const pts=chainPieces(roads.filter(q=>q.name===r.name).map(q=>q.pts));
      for(const[a,b,sf]of spec.surface){const p=cut(pts,a,b);if(p.length>1)out.push({...r,pts:p,sf,paved:true});}
      continue;
    }
    if(SETT_STREETS.includes(r.name))r.sf='sett';
    out.push(r);
  }
  roads.length=0;roads.push(...out);
}

// ---------------- encode ----------------
let gmin=Infinity;for(const v of near)gmin=Math.min(gmin,v);for(const v of far)gmin=Math.min(gmin,v);
const REF=Math.floor(gmin)-4;      // y = elevation - REF  (all > 0)
const enc=(g:Float64Array):string=>{const u=new Uint16Array(g.length);for(let i=0;i<g.length;i++)u[i]=Math.round((g[i]-REF)*20);return Buffer.from(u.buffer).toString('base64');};
const out={
  version:1,
  source:'OpenStreetMap (ODbL) + SRTM via AWS Terrain Tiles — see docs/divinolandia/README.md',
  lat0:LAT0,lon0:LON0,mx:MX,mz:MZ,ref:REF,
  near:{x0:NX0,z0:NZ0,cell:CELL,nx:NNX,nz:NNZ,h:enc(near)},
  far:{x0:fx0,z0:fz0,cell:FCELL,nx:FNX,nz:FNZ,h:enc(far)},
  roads:roads.filter(r=>r.pts.length>1).map(r=>({k:r.k,n:r.name,hw:r.hw,p:r.paved?1:0,sf:r.sf||'',pts:r.pts.map(p=>[r1(p[0]),r1(p[1])])})),
  waters:waters.map(wt=>({...wt,pts:wt.pts.map(p=>[p[0],p[1],r1(p[2]-REF)])})),   // surface y in game units (altitude − ref)
  plazas:plazas.map(p=>({n:p.name,k:p.kind,pts:p.pts.map(q=>[r1(q[0]),r1(q[1])])})),
  areas:areas.map(p=>({n:p.name,k:p.kind,pts:p.pts.map(q=>[r1(q[0]),r1(q[1])])})),
  buildings:osmBuildings,
  landmarks,
  houses:houses.map(h=>[h.x,h.z,h.w,h.d,h.rot,h.fl,h.c,h.roof,h.shop]),
  trees,coffee,
};
const file=join(here,'..','src','data','divinolandia.json');
writeFileSync(file,JSON.stringify(out)+'\n');
console.log(`Wrote ${file}`);
console.log(`  near ${NNX}x${NNZ} @${CELL}m  far ${FNX}x${FNZ} @${FCELL}m  ref=${REF}m`);
console.log(`  roads=${out.roads.length} waters=${waters.length} plazas=${plazas.length} areas=${areas.length} osmBuildings=${osmBuildings.length}`);
console.log(`  houses=${houses.length} (tried ${tried}) trees=${trees.length/3} coffeeRows=${coffee.length/3}`);
console.log('  matriz',landmarks.matriz,'hospital',landmarks.hospital,'torre',landmarks.torre);
