// Where each surveyed business stands (lojas.ts): its place snapped onto the street it faces,
// on the side of the street the place is on, the front on the sidewalk line facing the
// street. Then the corrections a Maps pin needs: a business that stands right beside
// another one (`next`) is put there; a front that would poke into a cross street slides
// along its street (or narrows); two fronts of the same street side never overlap; the
// depth stops short of the street behind. Town-LOCAL metres (bake frame, x east, z south).
// Pure (no THREE): unit-tested, used by build.ts.
import data from '../../../../data/divinolandia.json';
import type {LojaSpec} from './spec.ts';

export const SIDEWALK=2.1;                 // kerb → façade (the town's sidewalk ribbons, rua.ts)
export interface Placed{
  spec:LojaSpec;
  x:number;z:number;                       // middle of the front, on the façade line
  nx:number;nz:number;                     // unit normal from the front toward the street
  ux:number;uz:number;                     // unit along the front, left → right seen from the street
  w:number;d:number;                       // frontage and depth (setback included)
  road:string;ri:number;s:number;side:number;   // the street (name, index in the baked roads), arc position, side (±1)
}
type Seg={ax:number;az:number;bx:number;bz:number;hw:number;name:string;road:number};
const segs:Seg[]=[];
data.roads.forEach((r,ri)=>{for(let i=1;i<r.pts.length;i++)segs.push({ax:r.pts[i-1][0],az:r.pts[i-1][1],bx:r.pts[i][0],bz:r.pts[i][1],hw:r.hw,name:r.n,road:ri});});
// a 24 m spatial hash of the segments (each in every cell its roadway touches)
const CELL=24,hash=new Map<string,Seg[]>();
for(const g of segs){
  const m=g.hw+2;
  for(let a=Math.floor((Math.min(g.ax,g.bx)-m)/CELL);a<=Math.floor((Math.max(g.ax,g.bx)+m)/CELL);a++)
    for(let b=Math.floor((Math.min(g.az,g.bz)-m)/CELL);b<=Math.floor((Math.max(g.az,g.bz)+m)/CELL);b++){
      const k=a+'_'+b;let arr=hash.get(k);if(!arr){arr=[];hash.set(k,arr);}arr.push(g);}
}
const near=(x:number,z:number):Seg[]=>{const out:Seg[]=[],i=Math.floor(x/CELL),j=Math.floor(z/CELL);
  for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const g of hash.get((i+a)+'_'+(j+b))??[])out.push(g);return out;};
const norm=(s:string):string=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const LAT0=data.lat0,LON0=data.lon0,MX=data.mx,MZ=data.mz;
export const toLocal=(lat:number,lng:number):[number,number]=>[(lng-LON0)*MX,(LAT0-lat)*MZ];
function nearestOn(x:number,z:number,ok:(g:Seg)=>boolean):{g:Seg;px:number;pz:number;d:number;t:number}|null{
  let best:{g:Seg;px:number;pz:number;d:number;t:number}|null=null;
  for(const g of segs){
    if(!ok(g))continue;
    const dx=g.bx-g.ax,dz=g.bz-g.az,l2=dx*dx+dz*dz||1;let t=((x-g.ax)*dx+(z-g.az)*dz)/l2;t=t<0?0:t>1?1:t;
    const px=g.ax+t*dx,pz=g.az+t*dz,d=Math.hypot(x-px,z-pz);
    if(!best||d<best.d)best={g,px,pz,d,t};
  }
  return best;
}
// distance from a point to the nearest roadway edge of any street but `skip` (negative = inside it)
export function clearance(x:number,z:number,skip=-1):number{
  let m=30;                                          // (only streets within the 3×3 cells matter)
  for(const g of near(x,z)){
    if(g.road===skip)continue;
    const dx=g.bx-g.ax,dz=g.bz-g.az,l2=dx*dx+dz*dz||1;let t=((x-g.ax)*dx+(z-g.az)*dz)/l2;t=t<0?0:t>1?1:t;
    m=Math.min(m,Math.hypot(x-g.ax-t*dx,z-g.az-t*dz)-g.hw);
  }
  return m;
}
// the corners + edge samples of a lot (front on the façade line, back `d` behind it)
export function lotPoints(p:{x:number;z:number;nx:number;nz:number;ux:number;uz:number;w:number;d:number},step=1):[number,number][]{
  const out:[number,number][]=[];
  const nu=Math.max(1,Math.ceil(p.w/step)),nv=Math.max(1,Math.ceil(p.d/step));
  for(let a=0;a<=nu;a++)for(let b=0;b<=nv;b++){
    if(a&&a<nu&&b&&b<nv)continue;
    const u=(a/nu-.5)*p.w,v=b/nv*p.d;
    out.push([p.x+p.ux*u-p.nx*v,p.z+p.uz*u-p.nz*v]);
  }
  return out;
}

export function planLojas(list:LojaSpec[]):Placed[]{
  const out=new Map<string,Placed>();
  const place=(sp:LojaSpec):Placed|null=>{
    const[px,pz]=toLocal(sp.at[0],sp.at[1]),key=norm(sp.rua);
    const hit=nearestOn(px,pz,g=>!!g.name&&norm(g.name).includes(key))??nearestOn(px,pz,()=>true);
    if(!hit)return null;
    const g=hit.g,L=Math.hypot(g.bx-g.ax,g.bz-g.az)||1,tx=(g.bx-g.ax)/L,tz=(g.bz-g.az)/L;
    // which side the place is on (+1 = left of the segment direction)
    const cr=tx*(pz-hit.pz)-tz*(px-hit.px),side=cr>=0?1:-1;
    // (ox,oz): from the street toward the place's side; the front then faces back at the street
    const lx=-tz,lz=tx,ox=side>0?lx:-lx,oz=side>0?lz:-lz;
    const off=g.hw+SIDEWALK,ds=sp.ds??0;
    const x=hit.px+ox*off+tx*ds,z=hit.pz+oz*off+tz*ds;
    const nx=-ox,nz=-oz;                             // the front faces the street
    // a viewer on the street looks toward the shop, along (ox,oz): their right is (-oz, ox)
    const ux=-oz,uz=ox;
    const set=sp.f.setback??0,d=(sp.f.d??12)+set;
    return{spec:sp,x,z,nx,nz,ux,uz,w:sp.w,d,road:g.name,ri:g.road,s:segs.indexOf(g)*1000+hit.t*L,side};
  };
  // pass 1: the ones placed from their own pin; pass 2: those standing beside another
  for(const sp of list)if(!sp.next){const p=place(sp);if(p)out.set(sp.id,p);}
  for(let k=0;k<3;k++)for(const sp of list){
    if(!sp.next||out.has(sp.id))continue;
    const o=out.get(sp.next.to);if(!o)continue;
    const off=(o.w+sp.w)/2+.1,set=sp.f.setback??0;
    out.set(sp.id,{...o,spec:sp,w:sp.w,d:(sp.f.d??12)+set,x:o.x+o.ux*off*sp.next.side,z:o.z+o.uz*off*sp.next.side});
  }
  const placed=[...out.values()];
  for(const p of placed){
    const own=p.ri;
    // slide along the front away from a cross street the lot pokes into (up to 8 m), else narrow it
    const bad=():number=>{let worst=0;for(const[x,z]of lotPoints({...p,d:Math.min(p.d,6)}))worst=Math.min(worst,clearance(x,z,own)-SIDEWALK*.6);return worst;};
    for(let i=0;i<16&&bad()<0;i++){
      const left={x:p.x-p.ux*.5,z:p.z-p.uz*.5},right={x:p.x+p.ux*.5,z:p.z+p.uz*.5};
      const cl=clearance(left.x-p.ux*p.w/2,left.z-p.uz*p.w/2,own),cr=clearance(right.x+p.ux*p.w/2,right.z+p.uz*p.w/2,own);
      if(cl>cr){p.x=left.x;p.z=left.z;}else{p.x=right.x;p.z=right.z;}
    }
    while(bad()<0&&p.w>4)p.w-=.5;
    // depth: stop 1 m short of any street behind
    while(p.d>6&&lotPoints(p).some(([x,z])=>clearance(x,z,own)<.6))p.d-=.5;
  }
  // de-overlap: two lots of the same side of a street never overlap (the later one moves on)
  for(let it=0;it<6;it++)for(let i=0;i<placed.length;i++)for(let j=i+1;j<placed.length;j++){
    const a=placed[i],b=placed[j];
    if(Math.abs(a.nx*b.nx+a.nz*b.nz)<.9)continue;                  // not the same street front
    const du=(b.x-a.x)*a.ux+(b.z-a.z)*a.uz,dv=(b.x-a.x)*a.nx+(b.z-a.z)*a.nz;
    if(Math.abs(dv)>3)continue;
    const need=(a.w+b.w)/2+.05;
    if(Math.abs(du)>=need)continue;
    const push=(need-Math.abs(du))/2*(du>=0?1:-1);
    a.x-=a.ux*push;a.z-=a.uz*push;b.x+=a.ux*push;b.z+=a.uz*push;
  }
  // a lot the de-overlap pushed into a cross street narrows from that end instead
  for(const p of placed){
    const worst=(q:Placed):number=>{let m=0;for(const[x,z]of lotPoints(q))m=Math.min(m,clearance(x,z,p.ri));return m;};
    for(let i=0;i<40&&worst(p)<0&&p.w>4;i++){
      const l=clearance(p.x-p.ux*p.w/2,p.z-p.uz*p.w/2,p.ri),r=clearance(p.x+p.ux*p.w/2,p.z+p.uz*p.w/2,p.ri),k=l<r?1:-1;
      p.w-=.5;p.x+=p.ux*.25*k;p.z+=p.uz*.25*k;
    }
  }
  return placed;
}
