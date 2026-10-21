// Divinolândia road network as a navigation graph — the town's replacement for the old
// 8×8 grid (nodeX/CELL). PURE module (no THREE, no DOM), unit-tested in
// test/unit/divino-nav.test.ts.
//
// The baked OSM streets (src/data/divinolandia.json → roads) are polylines whose shared
// vertices are the real intersections. They are split at every shared vertex into EDGES
// between NODES (junctions and dead ends); everything that moves along the streets —
// traffic, pedestrians, police routing, races, taxi fares — reads this graph:
//   - pointAt / lanePoint: a position + heading along an edge (lanes keep to the RIGHT,
//     as in Brazil; pedestrians use the same call with the sidewalk offset);
//   - nearestNode / nearestRoad: snapping a world point onto the network;
//   - findPath: A* between two nodes (police pursuit, GPS-like routes);
//   - randomRoadPoint / randomEdge: spawn and destination picks;
//   - LaneRunner: a follower that strings edges together with rounded corners, the
//     shared engine of traffic cars and walking peds.
// All coordinates are WORLD coordinates (the town offset DIV_OX/DIV_OZ is applied).
import {divData as D,DIV_OX,DIV_OZ,PLAY} from './data.ts';

export interface NavNode{x:number;z:number;edges:number[];comp:number}
export interface NavEdge{
  a:number;b:number;        // node ids (pts run a → b)
  pts:Float64Array;         // flat x,z pairs (world)
  cum:Float64Array;         // arc length at each vertex
  len:number;
  hw:number;                // road half-width (m)
  paved:boolean;
  kind:string;              // OSM highway class
  name:string;
  road:number;              // index into D.roads
}
export interface RoadPos{x:number;z:number;dx:number;dz:number}

export const nodes:NavNode[]=[];
export const edges:NavEdge[]=[];
// id of the biggest connected component (the town; stray service stubs are left out of spawns)
export let mainComp=0;

// ---------------------------------------------------------------- build
{
  const key=(x:number,z:number):string=>Math.round(x*10)+','+Math.round(z*10);
  // how many road vertices land on each position (≥2 → junction)
  const uses=new Map<string,number>();
  for(const r of D.roads)for(let i=0;i<r.pts.length;i++){
    const k=key(r.pts[i][0],r.pts[i][1]);uses.set(k,(uses.get(k)||0)+1);
  }
  const nodeAt=new Map<string,number>();
  const getNode=(x:number,z:number):number=>{
    const k=key(x,z);let id=nodeAt.get(k);
    if(id===undefined){id=nodes.length;nodes.push({x:x+DIV_OX,z:z+DIV_OZ,edges:[],comp:-1});nodeAt.set(k,id);}
    return id;
  };
  D.roads.forEach((r,ri)=>{
    const P=r.pts;if(P.length<2)return;
    let start=0;
    for(let i=1;i<P.length;i++){
      const last=i===P.length-1;
      if(!last&&(uses.get(key(P[i][0],P[i][1]))||0)<2)continue;
      const flat:number[]=[];
      for(let k=start;k<=i;k++){
        const x=P[k][0]+DIV_OX,z=P[k][1]+DIV_OZ,n=flat.length;
        if(n&&Math.hypot(x-flat[n-2],z-flat[n-1])<.05)continue;   // duplicate vertex
        flat.push(x,z);
      }
      if(flat.length>=4){
        const a=getNode(P[start][0],P[start][1]),b=getNode(P[i][0],P[i][1]);
        const pts=new Float64Array(flat),cum=new Float64Array(pts.length/2);
        for(let k=1;k<cum.length;k++)cum[k]=cum[k-1]+Math.hypot(pts[2*k]-pts[2*k-2],pts[2*k+1]-pts[2*k-1]);
        const id=edges.length;
        edges.push({a,b,pts,cum,len:cum[cum.length-1],hw:r.hw,paved:!!r.p,kind:r.k,name:r.n||'',road:ri});
        nodes[a].edges.push(id);if(b!==a)nodes[b].edges.push(id);
      }
      start=i;
    }
  });
  // connected components (BFS); the largest one is "the town"
  let best=0,bestN=0;
  for(let s=0;s<nodes.length;s++){
    if(nodes[s].comp>=0)continue;
    const c=s,stack=[s];nodes[s].comp=c;let n=0;
    while(stack.length){
      const v=stack.pop()!;n++;
      for(const e of nodes[v].edges){const E=edges[e],o=E.a===v?E.b:E.a;if(nodes[o].comp<0){nodes[o].comp=c;stack.push(o);}}
    }
    if(n>bestN){bestN=n;best=c;}
  }
  mainComp=best;
}

// ---------------------------------------------------------------- spatial hashes
const HC=40;
const hkey=(i:number,j:number):number=>i*92821^j*68917;
const nodeHash=new Map<number,number[]>();
for(let i=0;i<nodes.length;i++){
  const k=hkey(Math.floor(nodes[i].x/HC),Math.floor(nodes[i].z/HC));
  let a=nodeHash.get(k);if(!a){a=[];nodeHash.set(k,a);}a.push(i);
}
// segment hash: [edge, segment index] packed as edge*4096+seg
const segHash=new Map<number,number[]>();
for(let e=0;e<edges.length;e++){
  const P=edges[e].pts;
  for(let s=0;s<P.length/2-1;s++){
    const x0=Math.min(P[2*s],P[2*s+2]),x1=Math.max(P[2*s],P[2*s+2]);
    const z0=Math.min(P[2*s+1],P[2*s+3]),z1=Math.max(P[2*s+1],P[2*s+3]);
    for(let i=Math.floor(x0/HC);i<=Math.floor(x1/HC);i++)for(let j=Math.floor(z0/HC);j<=Math.floor(z1/HC);j++){
      const k=hkey(i,j);let a=segHash.get(k);if(!a){a=[];segHash.set(k,a);}a.push(e*4096+s);
    }
  }
}

export type EdgeFilter=(e:NavEdge)=>boolean;
export const anyRoad:EdgeFilter=()=>true;
export const pavedRoad:EdgeFilter=e=>e.paved;
export const dirtRoad:EdgeFilter=e=>!e.paved;
// streets a car can sensibly drive (no footpaths exist in the bake; tracks are fine)
export const drivable:EdgeFilter=e=>e.kind!=='service'||e.len>25;

// nearest node (optionally only nodes touching an edge that passes `f`)
export function nearestNode(x:number,z:number,f:EdgeFilter=anyRoad,mainOnly=true):number{
  const ci=Math.floor(x/HC),cj=Math.floor(z/HC);
  let best=-1,bd=Infinity;
  for(let r=0;r<40;r++){
    for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++){
      if(r&&i>ci-r&&i<ci+r&&j>cj-r&&j<cj+r)continue;           // ring only
      const a=nodeHash.get(hkey(i,j));if(!a)continue;
      for(const n of a){
        const N=nodes[n];if(mainOnly&&N.comp!==mainComp)continue;
        if(f!==anyRoad&&!N.edges.some(e=>f(edges[e])))continue;
        const d=(N.x-x)**2+(N.z-z)**2;if(d<bd){bd=d;best=n;}
      }
    }
    if(best>=0&&Math.sqrt(bd)<(r-1)*HC)break;                  // nothing closer can be outside this ring
  }
  return best;
}

// nearest point ON a road centreline within `maxR` (null if none)
export interface RoadHit{e:number;s:number;x:number;z:number;d:number}
export function nearestRoad(x:number,z:number,maxR=60,f:EdgeFilter=anyRoad):RoadHit|null{
  let best:RoadHit|null=null;
  const r=Math.ceil(maxR/HC);
  const ci=Math.floor(x/HC),cj=Math.floor(z/HC);
  const seen=new Set<number>();
  for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++){
    const a=segHash.get(hkey(i,j));if(!a)continue;
    for(const code of a){
      if(seen.has(code))continue;seen.add(code);
      const e=Math.floor(code/4096),s=code%4096,E=edges[e];
      if(f!==anyRoad&&!f(E))continue;
      const P=E.pts,ax=P[2*s],az=P[2*s+1],bx=P[2*s+2],bz=P[2*s+3];
      const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz||1;
      let t=((x-ax)*dx+(z-az)*dz)/l2;t=t<0?0:t>1?1:t;
      const px=ax+dx*t,pz=az+dz*t,d=Math.hypot(x-px,z-pz);
      if(d<=maxR&&(!best||d<best.d))best={e,s:E.cum[s]+t*Math.sqrt(l2),x:px,z:pz,d};
    }
  }
  return best;
}

// A spot just off the nearest street to a TOWN-LOCAL point (lx,lz): on the kerb side
// facing that point, `extra` metres past the road edge. For hand-placed gameplay spots
// (buyers, pickups, ramps) written as rough town coordinates.
export function roadside(lx:number,lz:number,extra=1.5,f:EdgeFilter=anyRoad):{x:number;z:number;h:number}{
  const x=lx+DIV_OX,z=lz+DIV_OZ;
  const r=nearestRoad(x,z,400,f);
  if(!r)return{x,z,h:0};
  const p=pointAt(r.e,r.s,1),E=edges[r.e];
  let nx=-p.dz,nz=p.dx;                                   // right of a→b
  if((x-r.x)*nx+(z-r.z)*nz<0){nx=-nx;nz=-nz;}             // the side the point is on
  const o=E.hw+extra;
  return{x:r.x+nx*o,z:r.z+nz*o,h:Math.atan2(p.dx,p.dz)};
}
// the nearest street point itself (centre line) to a town-local point
export function onRoad(lx:number,lz:number,f:EdgeFilter=anyRoad):{x:number;z:number;h:number}{
  const r=nearestRoad(lx+DIV_OX,lz+DIV_OZ,400,f);
  if(!r)return{x:lx+DIV_OX,z:lz+DIV_OZ,h:0};
  const p=pointAt(r.e,r.s,1);
  return{x:r.x,z:r.z,h:Math.atan2(p.dx,p.dz)};
}

// position + unit direction at arc length s along edge e, travelling a→b (dir=1) or b→a (dir=-1)
export function pointAt(e:number,s:number,dir:1|-1=1,out:RoadPos={x:0,z:0,dx:0,dz:0}):RoadPos{
  const E=edges[e],P=E.pts,C=E.cum;
  if(dir<0)s=E.len-s;
  s=s<0?0:s>E.len?E.len:s;
  let lo=0,hi=C.length-1;
  while(hi-lo>1){const m=(lo+hi)>>1;if(C[m]<=s)lo=m;else hi=m;}
  const sl=C[hi]-C[lo]||1,t=(s-C[lo])/sl;
  const ax=P[2*lo],az=P[2*lo+1],bx=P[2*hi],bz=P[2*hi+1];
  out.x=ax+(bx-ax)*t;out.z=az+(bz-az)*t;
  const l=Math.hypot(bx-ax,bz-az)||1;
  out.dx=(bx-ax)/l*dir;out.dz=(bz-az)/l*dir;
  return out;
}
// the same point shifted `off` metres to the RIGHT of the travel direction
// (right of (dx,dz) is (-dz,dx) in this engine — the classic traffic lane convention)
export function lanePoint(e:number,s:number,dir:1|-1,off:number,out:RoadPos={x:0,z:0,dx:0,dz:0}):RoadPos{
  pointAt(e,s,dir,out);
  out.x+=-out.dz*off;out.z+=out.dx*off;
  return out;
}
// lane offset for a car on this road (centre of the right-hand lane)
export const laneOff=(e:number):number=>Math.max(1.3,edges[e].hw*.5);
// sidewalk offset (just past the kerb)
export const walkOff=(e:number):number=>edges[e].hw+1.1;

export const otherEnd=(e:number,n:number):number=>edges[e].a===n?edges[e].b:edges[e].a;
// travel direction along e when leaving node n
export const dirFrom=(e:number,n:number):1|-1=>edges[e].a===n?1:-1;

type Rand=()=>number;
// pick the next edge out of node n, coming from edge `from` (never straight back unless a dead end)
export function nextEdge(n:number,from:number,f:EdgeFilter=anyRoad,rnd:Rand=Math.random):number{
  const opts=nodes[n].edges.filter(e=>e!==from&&f(edges[e]));
  if(!opts.length)return from;
  return opts[Math.floor(rnd()*opts.length)];
}

// random edge in the main component passing f, weighted by length (uniform along the streets)
const lenCache=new Map<EdgeFilter,{ids:number[];acc:number[]}>();
export function randomEdge(f:EdgeFilter=anyRoad,rnd:Rand=Math.random):number{
  let c=lenCache.get(f);
  if(!c){
    const ids:number[]=[],acc:number[]=[];let t=0;
    for(let e=0;e<edges.length;e++){const E=edges[e];if(nodes[E.a].comp!==mainComp||!f(E))continue;t+=E.len;ids.push(e);acc.push(t);}
    c={ids,acc};lenCache.set(f,c);
  }
  if(!c.ids.length)return 0;
  const r=rnd()*c.acc[c.acc.length-1];
  let lo=0,hi=c.acc.length-1;
  while(lo<hi){const m=(lo+hi)>>1;if(c.acc[m]<r)lo=m+1;else hi=m;}
  return c.ids[lo];
}

// a random point on the streets, optionally within a distance band of (cx,cz)
export interface RoadSpot{e:number;s:number;x:number;z:number;h:number}
export function randomRoadPoint(opts:{f?:EdgeFilter;near?:{x:number;z:number};min?:number;max?:number;rnd?:Rand;inPlay?:boolean}={}):RoadSpot{
  const f=opts.f||anyRoad,rnd=opts.rnd||Math.random,min=opts.min??0,max=opts.max??Infinity;
  let fallback:RoadSpot|null=null;
  for(let k=0;k<400;k++){
    const e=randomEdge(f,rnd),E=edges[e],s=E.len*(.15+.7*rnd());
    const p=pointAt(e,s,1);
    if(opts.inPlay!==false&&(p.x<PLAY.x0+30||p.x>PLAY.x1-30||p.z<PLAY.z0+30||p.z>PLAY.z1-30))continue;
    const spot={e,s,x:p.x,z:p.z,h:Math.atan2(p.dx,p.dz)};
    if(!opts.near)return spot;
    const d=Math.hypot(p.x-opts.near.x,p.z-opts.near.z);
    if(d>=min&&d<=max)return spot;
    if(!fallback||Math.abs(d-(min+Math.min(max,min*2))/2)<Math.abs(Math.hypot(fallback.x-opts.near.x,fallback.z-opts.near.z)-min))fallback=spot;
  }
  return fallback||{e:0,s:0,x:nodes[0].x,z:nodes[0].z,h:0};
}

// A random street spot for gameplay markers (fares, patients, fires, crooks, drops): on
// a paved street of the town at `min`..`max` metres from `near`. `road` is the point in
// the right-hand lane (where a car stops), `kerb` the sidewalk beside it (where a person
// waits), `h` the street heading there.
export interface StreetSpot{road:{x:number;z:number};kerb:{x:number;z:number};h:number}
export function streetSpot(near:{x:number;z:number},min:number,max:number,f:EdgeFilter=pavedRoad):StreetSpot{
  const sp=randomRoadPoint({f,near,min,max});
  const dir:1|-1=Math.random()<.5?1:-1,s=dir>0?sp.s:edges[sp.e].len-sp.s;
  const r=lanePoint(sp.e,s,dir,laneOff(sp.e)),k=lanePoint(sp.e,s,dir,walkOff(sp.e));
  return{road:{x:r.x,z:r.z},kerb:{x:k.x,z:k.z},h:Math.atan2(r.dx,r.dz)};
}

// A* over the junction graph; returns the node ids from start to goal (inclusive), or
// [] when unreachable. Edge cost = length (dirt roads cost a little more).
export function findPath(start:number,goal:number,f:EdgeFilter=anyRoad):number[]{
  if(start<0||goal<0)return[];
  if(start===goal)return[start];
  const g=new Map<number,number>(),came=new Map<number,number>();
  const open:number[]=[start],fs=new Map<number,number>();
  const hh=(n:number):number=>Math.hypot(nodes[n].x-nodes[goal].x,nodes[n].z-nodes[goal].z);
  g.set(start,0);fs.set(start,hh(start));
  const closed=new Set<number>();
  let guard=0;
  while(open.length&&guard++<20000){
    let bi=0;for(let i=1;i<open.length;i++)if(fs.get(open[i])!<fs.get(open[bi])!)bi=i;
    const cur=open[bi];open[bi]=open[open.length-1];open.pop();
    if(cur===goal){
      const path=[cur];let c=cur;
      while(came.has(c)){c=came.get(c)!;path.push(c);}
      return path.reverse();
    }
    closed.add(cur);
    for(const e of nodes[cur].edges){
      const E=edges[e];if(!f(E))continue;
      const o=E.a===cur?E.b:E.a;if(closed.has(o))continue;
      const ng=g.get(cur)!+E.len*(E.paved?1:1.25);
      if(ng<(g.get(o)??Infinity)){
        came.set(o,cur);g.set(o,ng);fs.set(o,ng+hh(o));
        if(!open.includes(o))open.push(o);
      }
    }
  }
  return[];
}
// the edge joining two adjacent nodes (shortest one if several)
export function edgeBetween(a:number,b:number):number{
  let best=-1;
  for(const e of nodes[a].edges){const E=edges[e];if((E.a===a&&E.b===b)||(E.b===a&&E.a===b))if(best<0||E.len<edges[best].len)best=e;}
  return best;
}
// node path → dense world polyline (follows the street geometry, not straight node hops)
export function pathPoints(path:number[]):[number,number][]{
  const out:[number,number][]=[];
  for(let i=0;i<path.length-1;i++){
    const e=edgeBetween(path[i],path[i+1]);if(e<0)continue;
    const E=edges[e],n=E.pts.length/2,fwd=E.a===path[i];
    for(let k=0;k<n;k++){
      const j=fwd?k:n-1-k;
      if(out.length&&k===0)continue;
      out.push([E.pts[2*j],E.pts[2*j+1]]);
    }
  }
  if(!out.length&&path.length)out.push([nodes[path[0]].x,nodes[path[0]].z]);
  return out;
}

// ---------------------------------------------------------------- lane follower
// Strings edges together into one continuous offset polyline and walks it by arc length.
// Corners are rounded by cutting `round` metres off each side of a junction and joining
// the cut points with a quadratic curve through the corner, so cars turn instead of snapping.
export class LaneRunner{
  e:number;dir:1|-1;               // edge being entered last (the head of the queue)
  node:number;                     // node at the far end of that edge
  prevEdge:number;
  buf:number[]=[];                 // flat x,z of the queued polyline
  cum:number[]=[];
  s=0;                             // distance travelled along buf
  private off:(e:number)=>number;
  private f:EdgeFilter;
  private round:number;
  rnd:Rand;
  // optional fixed itinerary: when set, next edges come from here instead of random turns
  plan:number[]|null=null;
  // optional turn chooser (a fleeing driver picks the road away from the player): gets the
  // junction node and the edge arriving there, returns the edge to take
  choose:((n:number,from:number)=>number)|null=null;
  constructor(e:number,dir:1|-1,startS:number,opts:{off:(e:number)=>number;f?:EdgeFilter;round?:number;rnd?:Rand;choose?:(n:number,from:number)=>number}){
    this.off=opts.off;this.f=opts.f||anyRoad;this.round=opts.round??6;this.rnd=opts.rnd||Math.random;
    this.choose=opts.choose||null;
    this.e=e;this.dir=dir;this.prevEdge=-1;
    this.node=dir>0?edges[e].b:edges[e].a;
    this.appendEdge(e,dir,startS);
    this.fill();
  }
  private push(x:number,z:number):void{
    const n=this.buf.length;
    if(n){const d=Math.hypot(x-this.buf[n-2],z-this.buf[n-1]);if(d<.02)return;this.cum.push(this.cum[this.cum.length-1]+d);}
    else this.cum.push(0);
    this.buf.push(x,z);
  }
  private appendEdge(e:number,dir:1|-1,from=0):void{
    const E=edges[e],off=this.off(e),r=Math.min(this.round,E.len*.4),p:RoadPos={x:0,z:0,dx:0,dz:0};
    const s0=Math.max(from,this.buf.length?r:0),s1=E.len-r;
    // walk the vertices of the edge between s0 and s1 in travel order
    lanePoint(e,s0,dir,off,p);
    if(this.buf.length){
      // round the corner: quadratic from the queue's tail through the junction to p
      const n=this.buf.length,tx=this.buf[n-2],tz=this.buf[n-1];
      const J=dir>0?nodes[E.a]:nodes[E.b];
      // control point: the junction pushed onto the lanes' side
      const cx=J.x+(tx+p.x-2*J.x)*.25,cz=J.z+(tz+p.z-2*J.z)*.25;
      for(let k=1;k<=5;k++){const u=k/6,v=1-u;this.push(v*v*tx+2*v*u*cx+u*u*p.x,v*v*tz+2*v*u*cz+u*u*p.z);}
    }
    this.push(p.x,p.z);
    const C=E.cum,n=C.length;
    for(let k=1;k<n-1;k++){
      const sv=dir>0?C[k]:E.len-C[n-1-k];
      if(sv<=s0||sv>=s1)continue;
      lanePoint(e,sv,dir,off,p);this.push(p.x,p.z);
    }
    lanePoint(e,Math.max(s0,s1),dir,off,p);this.push(p.x,p.z);
  }
  // keep at least `ahead` metres of road queued past the current position
  fill(ahead=60):void{
    let guard=0;
    while(this.cum[this.cum.length-1]-this.s<ahead&&guard++<20){
      let ne:number;
      if(this.plan&&this.plan.length){
        const nxt=this.plan.shift()!;
        ne=edgeBetween(this.node,nxt);
        if(ne<0){this.plan=null;ne=nextEdge(this.node,this.e,this.f,this.rnd);}
      }else ne=this.choose?this.choose(this.node,this.e):nextEdge(this.node,this.e,this.f,this.rnd);
      const d=dirFrom(ne,this.node);
      this.prevEdge=this.e;this.e=ne;this.dir=d;this.node=d>0?edges[ne].b:edges[ne].a;
      this.appendEdge(ne,d);
    }
    // drop what is far behind (keep 20 m for the rear of long vehicles)
    let cut=0;while(cut<this.cum.length-2&&this.cum[cut+1]<this.s-20)cut++;
    if(cut>0){
      const base=this.cum[cut];
      this.buf.splice(0,cut*2);this.cum.splice(0,cut);
      for(let i=0;i<this.cum.length;i++)this.cum[i]-=base;
      this.s-=base;
    }
  }
  // position + direction at the current s (or s+ahead)
  at(ahead=0,out:RoadPos={x:0,z:0,dx:0,dz:0}):RoadPos{
    const s=this.s+ahead,C=this.cum,B=this.buf;
    let lo=0,hi=C.length-1;
    if(s>=C[hi]){lo=Math.max(0,hi-1);}
    else while(hi-lo>1){const m=(lo+hi)>>1;if(C[m]<=s)lo=m;else hi=m;}
    const sl=C[hi]-C[lo]||1,t=Math.max(0,Math.min(1,(s-C[lo])/sl));
    const ax=B[2*lo],az=B[2*lo+1],bx=B[2*hi],bz=B[2*hi+1];
    out.x=ax+(bx-ax)*t;out.z=az+(bz-az)*t;
    const l=Math.hypot(bx-ax,bz-az)||1;out.dx=(bx-ax)/l;out.dz=(bz-az)/l;
    return out;
  }
  // how sharp the road bends over the next `ahead` metres (0 = straight, 1 = U-turn)
  bend(ahead=12):number{
    const a=this.at(0,_ba),b=this.at(ahead,_bb);
    return (1-(a.dx*b.dx+a.dz*b.dz))/2;
  }
  advance(ds:number):void{this.s+=ds;this.fill();}
}
const _ba:RoadPos={x:0,z:0,dx:0,dz:0},_bb:RoadPos={x:0,z:0,dx:0,dz:0};

// A runner starting on a random street (main component) passing f.
export function randomRunner(opts:{off:(e:number)=>number;f?:EdgeFilter;round?:number;rnd?:Rand;near?:{x:number;z:number};min?:number;max?:number}):LaneRunner{
  const sp=randomRoadPoint({f:opts.f,rnd:opts.rnd,near:opts.near,min:opts.min,max:opts.max});
  const dir:1|-1=(opts.rnd||Math.random)()<.5?1:-1;
  return new LaneRunner(sp.e,dir,dir>0?sp.s:edges[sp.e].len-sp.s,opts);
}

// Turn chooser for a driver running AWAY from something (the vigilante's suspect, rival
// getaways): at each junction take the street whose far end is farthest from the
// threat, with a little randomness so the route isn't fully predictable.
export function fleeChooser(threat:()=>{x:number;z:number},f:EdgeFilter=anyRoad):(n:number,from:number)=>number{
  return(n,from)=>{
    const t=threat();
    let best=-1,bs=-Infinity;
    for(const e of nodes[n].edges){
      if(e===from||!f(edges[e]))continue;
      const o=nodes[otherEnd(e,n)];
      const sc=Math.hypot(o.x-t.x,o.z-t.z)+Math.random()*40;
      if(sc>bs){bs=sc;best=e;}
    }
    return best>=0?best:from;
  };
}

// A drivable course: from the node nearest (x,z), wander the streets passing `f` without
// ever revisiting a junction or doubling back, until the route is `len` metres long (or
// it runs into a dead end). Returns the dense polyline along the street geometry.
export function routeWalk(x:number,z:number,len:number,f:EdgeFilter=anyRoad,rnd:Rand=Math.random):[number,number][]{
  const start=nearestNode(x,z,f);
  if(start<0)return[];
  const path=[start],seen=new Set([start]);
  let n=start,from=-1,acc=0;
  while(acc<len){
    const opts=nodes[n].edges.filter(e=>e!==from&&f(edges[e])&&!seen.has(otherEnd(e,n)));
    if(!opts.length)break;
    const e=opts[Math.floor(rnd()*opts.length)],o=otherEnd(e,n);
    acc+=edges[e].len;path.push(o);seen.add(o);from=e;n=o;
  }
  return pathPoints(path);
}
